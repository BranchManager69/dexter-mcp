import { chromium } from 'playwright';

const DEFAULT_CHAIN = 'sol';
const DEFAULT_HOST = 'https://gmgn.ai';
const DEFAULT_CANDLE_RESOLUTION = '1m';
const DEFAULT_CANDLE_LIMIT = 142;
const DEFAULT_CANDLE_WINDOW_MS = 24 * 3600 * 1000; // 24 hours
const PLAYWRIGHT_ARGS = [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-web-security',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-gpu',
];
const PLAYWRIGHT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6545.0 Safari/537.36';

function buildTokenSlug(address, chain) {
  const trimmed = String(address || '').trim();
  if (!trimmed) throw new Error('token_address_required');
  if (trimmed.startsWith('solscan_') || trimmed.startsWith('pumpfun_') || trimmed.startsWith('moonshot_')) {
    return trimmed;
  }
  const prefix = chain === 'sol' ? 'solscan_' : `${chain}_`;
  return `${prefix}${trimmed}`;
}

function createRequestDescriptors({ chain, address, resolution, limit, includeTrades, includeSecurity, includeCandles }) {
  const now = Date.now();
  const to = now + 60 * 1000; // allow slight skew
  const from = now - DEFAULT_CANDLE_WINDOW_MS;
  const requests = [
    {
      key: 'token_stat',
      method: 'GET',
      url: `/api/v1/token_stat/${chain}/${address}`,
    },
    {
      key: 'token_pool_fee_info',
      method: 'GET',
      url: `/api/v1/token_pool_fee_info/${chain}/${address}`,
    },
    {
      key: 'token_preview',
      method: 'GET',
      url: `/api/v1/live/token_preview/${chain}/${address}`,
    },
    {
      key: 'token_link_rug_vote',
      method: 'GET',
      url: `/api/v1/mutil_window_token_link_rug_vote/${chain}/${address}`,
    },
    {
      key: 'token_wallet_tags_stat',
      method: 'GET',
      url: `/api/v1/token_wallet_tags_stat/${chain}/${address}`,
    },
    {
      key: 'recommend_slippage',
      method: 'GET',
      url: `/api/v1/recommend_slippage/${chain}/${address}`,
    },
    {
      key: 'gas_price',
      method: 'GET',
      url: `/api/v1/gas_price/${chain}`,
    },
    {
      key: 'multi_window_token_info',
      method: 'POST',
      url: '/api/v1/mutil_window_token_info',
      body: { chain, addresses: [address] },
    },
  ];

  if (includeSecurity) {
    requests.push({
      key: 'token_security_launchpad',
      method: 'GET',
      url: `/api/v1/mutil_window_token_security_launchpad/${chain}/${address}`,
    });
  }

  if (includeCandles) {
    requests.push({
      key: 'token_candles',
      method: 'GET',
      url: `/api/v1/token_candles/${chain}/${address}`,
      params: {
        resolution,
        limit,
        from,
        to,
        pool_type: 'unified',
      },
    });
  }

  if (includeTrades) {
    requests.push(
      {
        key: 'dex_trades_polling',
        method: 'GET',
        url: '/api/v1/dex_trades_polling',
        params: { chain, window: '24h' },
      },
      {
        key: 'token_trades_recent',
        method: 'GET',
        url: `/vas/api/v1/token_trades/${chain}/${address}`,
        params: { limit: 50 },
      },
      {
        key: 'token_holders',
        method: 'GET',
        url: `/vas/api/v1/token_holder_stat/${chain}/${address}`,
      },
    );
  }

  return requests;
}

async function runInPage(page, descriptors, baseQuery) {
  const requests = Array.isArray(descriptors) ? descriptors : [];
  const baseParams = Object.assign(
    {
      fp_did: 'unknown',
      from_app: 'gmgn',
      os: 'web',
    },
    baseQuery || {},
  );

  return page.evaluate(async ({ reqs, params }) => {
    const ensure = (value, fallback) => (value == null || value === '' ? fallback : value);
    const randomId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      return `gmgn-${Math.random().toString(16).slice(2)}-${Date.now()}`;
    };

    const defaults = { ...params };
    defaults.device_id = ensure(defaults.device_id, randomId());
    defaults.client_id = ensure(defaults.client_id, `gmgn_web_${Date.now()}`);
    defaults.app_ver = ensure(defaults.app_ver, defaults.client_id.replace('gmgn_web_', ''));
    const tz = Intl.DateTimeFormat().resolvedOptions();
    defaults.tz_name = ensure(defaults.tz_name, tz?.timeZone || 'UTC');
    defaults.tz_offset = ensure(defaults.tz_offset, String(-(new Date().getTimezoneOffset() * 60)));
    defaults.app_lang = ensure(defaults.app_lang, navigator.language || 'en-US');

    const toUrl = (rawUrl) => {
      if (!rawUrl) return '';
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
      return `https://gmgn.ai${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
    };

    const results = {};

    for (const req of reqs) {
      const method = (req.method || 'GET').toUpperCase();
      const url = new URL(toUrl(req.url));
      const query = new URLSearchParams(defaults);
      if (req.params) {
        for (const [key, value] of Object.entries(req.params)) {
          if (value != null) query.set(key, String(value));
        }
      }
      const finalUrl = url.toString().includes('?')
        ? `${url.toString()}&${query.toString()}`
        : `${url.toString()}?${query.toString()}`;

      const fetchInit = {
        method,
        credentials: 'include',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
      };

      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        fetchInit.body = req.body ? JSON.stringify(req.body) : '{}';
      }

      let data = null;
      let status = 0;
      let ok = false;

      try {
        const response = await fetch(finalUrl, fetchInit);
        status = response.status;
        ok = response.ok;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      } catch (error) {
        data = { error: error?.message || String(error) };
      }

      results[req.key] = { status, ok, data, url: finalUrl, method };
    }

    return results;
  }, { reqs: requests, params: baseParams });
}

export async function fetchGmgnTokenSnapshot({
  chain = DEFAULT_CHAIN,
  address,
  resolution = DEFAULT_CANDLE_RESOLUTION,
  candle_limit: candleLimit = DEFAULT_CANDLE_LIMIT,
  include_trades: includeTrades = true,
  include_security: includeSecurity = true,
  include_candles: includeCandles = true,
  timeout_ms: timeoutMs = 60000,
} = {}) {
  const normalizedChain = (chain || DEFAULT_CHAIN).toLowerCase();
  const slug = buildTokenSlug(address, normalizedChain);
  const rawAddress = slug.split('_').slice(1).join('_');

  const browser = await chromium.launch({
    headless: true,
    args: PLAYWRIGHT_ARGS,
  });

  const context = await browser.newContext({
    userAgent: PLAYWRIGHT_USER_AGENT,
    locale: 'en-US',
    viewport: { width: 1280, height: 720 },
    timezoneId: 'UTC',
    extraHTTPHeaders: {
      'sec-ch-ua': '"Chromium";v="128", "Not=A?Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  const targetUrl = `${DEFAULT_HOST}/${normalizedChain}/token/${slug}`;

  const baseQuery = {};
  const captureRequest = (request) => {
    const url = request.url();
    if (url.includes('/api/v1/token_stat/')) {
      const parsed = new URL(url);
      for (const [key, value] of parsed.searchParams.entries()) {
        baseQuery[key] = value;
      }
    }
  };
  page.on('request', captureRequest);

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
    await page.waitForTimeout(2000);

    const descriptors = createRequestDescriptors({
      chain: normalizedChain,
      address: rawAddress,
      resolution,
      limit: candleLimit,
      includeTrades,
      includeSecurity,
      includeCandles,
    });

    const fetched = await runInPage(page, descriptors, baseQuery);

    const cookies = await context.cookies();

    return {
      chain: normalizedChain,
      token_slug: slug,
      token_address: rawAddress,
      fetched_at: new Date().toISOString(),
      requests: fetched,
      cookies,
      base_query: baseQuery,
      target_url: targetUrl,
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

export default {
  fetchGmgnTokenSnapshot,
};
