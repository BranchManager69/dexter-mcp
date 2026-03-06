#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config.ts
import { homedir } from "os";
import { join } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname as pathDirname } from "path";
function getApiBase(dev) {
  return dev ? DEXTER_API_DEV : DEXTER_API_PROD;
}
function loadVersion() {
  try {
    const here = pathDirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}
var DATA_DIR, WALLET_FILE, DEXTER_API_PROD, DEXTER_API_DEV, SOLANA_RPC_URL, EVM_RPC_URLS, EVM_USDC_ADDRESSES, CHAIN_NAMES, MARKETPLACE_PATH, VERSION;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    DATA_DIR = join(homedir(), ".dexterai-mcp");
    WALLET_FILE = join(DATA_DIR, "wallet.json");
    DEXTER_API_PROD = process.env.DEXTER_API_URL || "https://x402.dexter.cash";
    DEXTER_API_DEV = "http://127.0.0.1:3030";
    SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.dexter.cash/api/solana/rpc";
    EVM_RPC_URLS = {
      "eip155:8453": process.env.BASE_RPC_URL || "https://mainnet.base.org",
      "eip155:137": process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      "eip155:42161": process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      "eip155:10": process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      "eip155:43114": process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc"
    };
    EVM_USDC_ADDRESSES = {
      "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "eip155:137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      "eip155:42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "eip155:10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      "eip155:43114": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
    };
    CHAIN_NAMES = {
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": { name: "Solana", family: "svm", tier: "first" },
      "eip155:8453": { name: "Base", family: "evm", tier: "first" },
      "eip155:137": { name: "Polygon", family: "evm", tier: "second" },
      "eip155:42161": { name: "Arbitrum", family: "evm", tier: "second" },
      "eip155:10": { name: "Optimism", family: "evm", tier: "second" },
      "eip155:43114": { name: "Avalanche", family: "evm", tier: "second" }
    };
    MARKETPLACE_PATH = "/api/facilitator/marketplace/resources";
    VERSION = loadVersion();
  }
});

// src/widget-meta.ts
function widgetMeta(templateUri, invoking, invoked, description) {
  return {
    "openai/outputTemplate": templateUri,
    "openai/resultCanProduceWidget": true,
    "openai/widgetAccessible": true,
    "openai/widgetDomain": WIDGET_DOMAIN,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": WIDGET_CSP,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
    "openai/widgetDescription": description
  };
}
var WIDGET_DOMAIN, WIDGET_CSP, SEARCH_META, FETCH_META, CHECK_META, WALLET_META;
var init_widget_meta = __esm({
  "src/widget-meta.ts"() {
    "use strict";
    WIDGET_DOMAIN = "https://dexter.cash";
    WIDGET_CSP = {
      resource_domains: [
        "https://cdn.dexscreener.com",
        "https://raw.githubusercontent.com",
        "https://metadata.jup.ag"
      ]
    };
    SEARCH_META = widgetMeta(
      "ui://dexter/x402-marketplace-search",
      "Searching marketplace\u2026",
      "Results ready",
      "Shows paid API search results as interactive cards with quality rings, prices, and fetch buttons."
    );
    FETCH_META = widgetMeta(
      "ui://dexter/x402-fetch-result",
      "Calling API\u2026",
      "Response received",
      "Shows API response data with payment receipt, transaction link, and settlement status."
    );
    CHECK_META = widgetMeta(
      "ui://dexter/x402-pricing",
      "Checking pricing\u2026",
      "Pricing loaded",
      "Shows endpoint pricing per blockchain with payment amounts and a pay button."
    );
    WALLET_META = widgetMeta(
      "ui://dexter/x402-wallet",
      "Loading wallet\u2026",
      "Wallet loaded",
      "Shows wallet address with copy button, USDC/SOL balances, and deposit QR code."
    );
  }
});

// src/tools/search.ts
var search_exports = {};
__export(search_exports, {
  cliSearch: () => cliSearch,
  registerSearchTool: () => registerSearchTool
});
import { z } from "zod";
function formatResource(r) {
  return {
    name: r.displayName || r.resourceUrl,
    url: r.resourceUrl,
    method: r.method || "GET",
    price: r.priceLabel || (r.priceUsdc != null ? `$${r.priceUsdc.toFixed(2)}` : "free"),
    network: r.priceNetwork || null,
    description: r.description || "",
    category: r.category || "uncategorized",
    qualityScore: r.qualityScore ?? null,
    verified: r.verificationStatus === "pass",
    totalCalls: r.totalSettlements ?? 0,
    seller: r.seller?.displayName || null,
    sellerReputation: r.reputationScore ?? null,
    authRequired: Boolean(r.authRequired),
    authType: r.authType ?? null,
    authHint: r.authHint ?? null
  };
}
async function searchMarketplace(params, opts) {
  const qs = new URLSearchParams();
  if (params.query) qs.set("search", params.query);
  if (params.category) qs.set("category", params.category);
  if (params.network) qs.set("network", params.network);
  if (params.maxPriceUsdc != null) qs.set("maxPrice", String(params.maxPriceUsdc));
  if (params.verifiedOnly) qs.set("verified", "true");
  qs.set("sort", params.sort || "marketplace");
  qs.set("limit", String(Math.min(params.limit || 20, 50)));
  const url = `${getApiBase(opts.dev)}${MARKETPLACE_PATH}?${qs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    throw new Error(`Marketplace returned ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  return {
    resources: (data.resources || []).map(formatResource),
    total: data.resources?.length || 0
  };
}
function registerSearchTool(server, opts) {
  server.tool(
    "x402_search",
    "Search the Dexter x402 marketplace for paid API resources. Returns services with pricing, quality scores, and verification status. Use this to discover APIs an agent can pay for and call with x402_fetch.",
    {
      query: z.string().optional().describe("Search term, e.g. 'token analysis', 'image generation'"),
      category: z.string().optional().describe("Filter by category"),
      network: z.string().optional().describe("Filter by payment network: 'solana', 'base', 'polygon'"),
      maxPriceUsdc: z.number().optional().describe("Maximum price per call in USDC"),
      verifiedOnly: z.boolean().optional().describe("Only return verified endpoints"),
      sort: z.enum(["relevance", "quality_score", "settlements", "volume", "recent", "marketplace"]).optional().describe("Sort order (default: marketplace)"),
      limit: z.number().optional().default(20).describe("Max results (1-50)")
    },
    async (args) => {
      try {
        const result = await searchMarketplace(args, opts);
        const data = {
          success: true,
          count: result.total,
          resources: result.resources,
          tip: "Use x402_fetch to call any of these endpoints."
        };
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          _meta: SEARCH_META
        };
      } catch (err) {
        const payload = { error: err.message || "search_failed", success: false, count: 0, resources: [] };
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
          _meta: SEARCH_META,
          isError: true
        };
      }
    }
  );
}
async function cliSearch(query, opts) {
  try {
    const result = await searchMarketplace({ query }, opts);
    console.log(JSON.stringify({ success: true, count: result.total, resources: result.resources }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }, null, 2));
    process.exit(1);
  }
}
var init_search = __esm({
  "src/tools/search.ts"() {
    "use strict";
    init_config();
    init_widget_meta();
  }
});

// src/wallet/index.ts
var wallet_exports = {};
__export(wallet_exports, {
  getAllBalances: () => getAllBalances,
  getEvmUsdcBalance: () => getEvmUsdcBalance,
  getSolanaBalance: () => getSolanaBalance,
  loadOrCreateWallet: () => loadOrCreateWallet,
  showWalletInfo: () => showWalletInfo
});
import { existsSync, readFileSync as readFileSync2, writeFileSync, mkdirSync, copyFileSync } from "fs";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, erc20Abi } from "viem";
import { base, polygon, arbitrum, optimism, avalanche } from "viem/chains";
import bs58 from "bs58";
function generateEvmWallet() {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return { evmPrivateKey: pk, evmAddress: account.address };
}
async function loadOrCreateWallet() {
  const envKey = process.env.DEXTER_PRIVATE_KEY || process.env.SOLANA_PRIVATE_KEY;
  const envEvmKey = process.env.EVM_PRIVATE_KEY;
  if (envKey) {
    const keypair2 = keypairFromString(envKey);
    const info2 = {
      solanaPrivateKey: bs58.encode(keypair2.secretKey),
      solanaAddress: keypair2.publicKey.toBase58(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (envEvmKey) {
      const account = privateKeyToAccount(envEvmKey);
      info2.evmPrivateKey = envEvmKey;
      info2.evmAddress = account.address;
    }
    return { info: info2, solanaKeypair: keypair2 };
  }
  if (existsSync(WALLET_FILE)) {
    try {
      const raw = readFileSync2(WALLET_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (!data.solanaPrivateKey) throw new Error("Missing solanaPrivateKey");
      const keypair2 = keypairFromString(data.solanaPrivateKey);
      if (keypair2.secretKey.length !== 64) throw new Error("Invalid key length");
      if (!data.evmPrivateKey) {
        const evm2 = generateEvmWallet();
        data.evmPrivateKey = evm2.evmPrivateKey;
        data.evmAddress = evm2.evmAddress;
        writeFileSync(WALLET_FILE, JSON.stringify(data, null, 2), { mode: 384 });
        console.error(`[opendexter] Added EVM wallet to existing file: ${evm2.evmAddress}`);
      }
      return { info: data, solanaKeypair: keypair2 };
    } catch (err) {
      console.error(`[opendexter] Corrupted wallet file: ${err.message}`);
      console.error(`[opendexter] Backing up to ${WALLET_FILE}.bak and creating fresh wallet.`);
      try {
        copyFileSync(WALLET_FILE, WALLET_FILE + ".bak");
      } catch {
      }
    }
  }
  const keypair = Keypair.generate();
  const evm = generateEvmWallet();
  const info = {
    solanaPrivateKey: bs58.encode(keypair.secretKey),
    solanaAddress: keypair.publicKey.toBase58(),
    evmPrivateKey: evm.evmPrivateKey,
    evmAddress: evm.evmAddress,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  mkdirSync(DATA_DIR, { recursive: true, mode: 448 });
  writeFileSync(WALLET_FILE, JSON.stringify(info, null, 2), { mode: 384 });
  console.error(`[opendexter] New dual wallet created:`);
  console.error(`[opendexter]   Solana: ${info.solanaAddress}`);
  console.error(`[opendexter]   EVM:    ${evm.evmAddress}`);
  console.error(`[opendexter] Saved to ${WALLET_FILE}`);
  console.error(`[opendexter] Deposit USDC on Solana or any supported EVM chain to start paying for x402 APIs.`);
  return { info, solanaKeypair: keypair };
}
function keypairFromString(key) {
  try {
    return Keypair.fromSecretKey(bs58.decode(key));
  } catch {
    try {
      const arr = JSON.parse(key);
      if (Array.isArray(arr)) {
        return Keypair.fromSecretKey(Uint8Array.from(arr));
      }
    } catch {
    }
    throw new Error("Invalid private key format. Expected base58 string or JSON byte array.");
  }
}
async function getSolanaBalance(address, rpcUrl) {
  try {
    const connection = new Connection(rpcUrl || SOLANA_RPC_URL, "confirmed");
    const pubkey = new PublicKey(address);
    const [solBalance, usdcBalance] = await Promise.all([
      connection.getBalance(pubkey).catch(() => 0),
      getUsdcBalance(connection, pubkey)
    ]);
    return { sol: solBalance / 1e9, usdc: usdcBalance };
  } catch (err) {
    console.error(`[dexter-mcp] RPC error fetching balance: ${err.message}`);
    return { sol: 0, usdc: 0 };
  }
}
async function getUsdcBalance(connection, owner) {
  try {
    const ata = await getAssociatedTokenAddress(USDC_MINT, owner);
    const info = await connection.getTokenAccountBalance(ata);
    return Number(info.value.uiAmount ?? 0);
  } catch {
    return 0;
  }
}
async function getEvmUsdcBalance(address, chainId) {
  const viemChain = VIEM_CHAINS[chainId];
  const usdcAddress = EVM_USDC_ADDRESSES[chainId];
  if (!viemChain || !usdcAddress) return 0;
  try {
    const client = createPublicClient({
      chain: viemChain,
      transport: http(EVM_RPC_URLS[chainId])
    });
    const raw = await client.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address]
    });
    return Number(raw) / 1e6;
  } catch {
    return 0;
  }
}
async function getAllBalances(wallet) {
  const chains = {};
  const solPromise = getSolanaBalance(wallet.solanaAddress).then((b) => {
    chains["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"] = { name: "Solana", usdc: b.usdc };
  });
  const evmPromises = wallet.evmAddress ? Object.entries(VIEM_CHAINS).map(async ([chainId]) => {
    const usdc = await getEvmUsdcBalance(wallet.evmAddress, chainId);
    const meta = CHAIN_NAMES[chainId];
    chains[chainId] = { name: meta?.name || chainId, usdc };
  }) : [];
  await Promise.all([solPromise, ...evmPromises]);
  const totalUsdc = Object.values(chains).reduce((sum, c) => sum + c.usdc, 0);
  return { totalUsdc, chains };
}
async function showWalletInfo(opts) {
  const wallet = await loadOrCreateWallet();
  if (!wallet) {
    console.log(JSON.stringify({ error: "Failed to load wallet" }));
    process.exit(1);
  }
  const { totalUsdc, chains } = await getAllBalances(wallet.info);
  const result = {
    solanaAddress: wallet.info.solanaAddress,
    evmAddress: wallet.info.evmAddress || null,
    network: "multichain",
    totalUsdc,
    chains,
    walletFile: WALLET_FILE
  };
  if (totalUsdc === 0) {
    result.tip = `Deposit USDC to ${wallet.info.solanaAddress} (Solana) or ${wallet.info.evmAddress} (Base/Polygon/Arbitrum/Optimism/Avalanche) to start paying for x402 APIs.`;
  }
  console.log(JSON.stringify(result, null, 2));
}
var USDC_MINT, VIEM_CHAINS;
var init_wallet = __esm({
  "src/wallet/index.ts"() {
    "use strict";
    init_config();
    USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    VIEM_CHAINS = {
      "eip155:8453": base,
      "eip155:137": polygon,
      "eip155:42161": arbitrum,
      "eip155:10": optimism,
      "eip155:43114": avalanche
    };
  }
});

// src/tools/fetch.ts
var fetch_exports = {};
__export(fetch_exports, {
  cliFetch: () => cliFetch,
  registerFetchTool: () => registerFetchTool
});
import { z as z2 } from "zod";
async function parseResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    try {
      return await res.json();
    } catch {
      return await res.text();
    }
  }
  return await res.text();
}
function extractSettlement(res) {
  const header = res.headers.get("payment-response") || res.headers.get("PAYMENT-RESPONSE");
  if (!header) return null;
  try {
    return JSON.parse(atob(header));
  } catch {
    try {
      return JSON.parse(header);
    } catch {
      return null;
    }
  }
}
function parse402(body) {
  const obj = body;
  if (!obj?.accepts || !Array.isArray(obj.accepts)) return { requirements: null, firstAccept: null };
  return {
    requirements: { accepts: obj.accepts, x402Version: obj.x402Version ?? 2, resource: obj.resource },
    firstAccept: obj.accepts[0] || null
  };
}
async function x402Fetch(params, wallet, opts) {
  const requestHeaders = {
    "Content-Type": "application/json",
    ...params.headers || {}
  };
  const fetchOpts = {
    method: params.method || "GET",
    headers: requestHeaders
  };
  if (params.body && params.method !== "GET") {
    fetchOpts.body = params.body;
  }
  const probeRes = await fetch(params.url, { ...fetchOpts, signal: AbortSignal.timeout(15e3) });
  if (probeRes.status !== 402) {
    return { status: probeRes.status, data: await parseResponse(probeRes) };
  }
  let body402 = null;
  try {
    body402 = await probeRes.json();
  } catch {
    try {
      body402 = await probeRes.text();
    } catch {
    }
  }
  const { requirements, firstAccept } = parse402(body402);
  if (wallet) {
    try {
      const { wrapFetch } = await import("@dexterai/x402/client");
      const x402FetchFn = wrapFetch(fetch, {
        walletPrivateKey: wallet.info.solanaPrivateKey,
        evmPrivateKey: wallet.info.evmPrivateKey
      });
      const paidRes = await x402FetchFn(params.url, fetchOpts);
      const data = await parseResponse(paidRes);
      const settlement = extractSettlement(paidRes);
      return {
        status: paidRes.status,
        data,
        payment: settlement ? { settled: true, details: settlement } : { settled: false }
      };
    } catch (err) {
      return { status: 402, error: `Payment failed: ${err.message}`, requirements };
    }
  }
  return {
    status: 402,
    message: "Payment required. Configure DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (Base/Polygon/etc) for automatic settlement, or provide payment-signature manually.",
    requirements
  };
}
function registerFetchTool(server, wallet, opts) {
  const hasWallet = wallet !== null;
  const description = hasWallet ? "Call any x402-protected API with automatic USDC payment across Solana, Base, Polygon, Arbitrum, Optimism, and Avalanche. Signs and pays using your local wallet. Returns the API response directly." : "Call any x402-protected API. Returns payment requirements. Configure DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (EVM chains) to enable automatic payment.";
  const inputSchema = {
    url: z2.string().url().describe("The x402 resource URL to call"),
    method: z2.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method"),
    body: z2.string().optional().describe("JSON request body for POST/PUT")
  };
  const runFetch = async (args) => {
    try {
      const result = await x402Fetch(
        { url: args.url, method: args.method, body: args.body },
        wallet,
        opts
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        _meta: FETCH_META
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
        isError: true
      };
    }
  };
  server.tool(
    "x402_fetch",
    description,
    inputSchema,
    runFetch
  );
  server.tool(
    "x402_pay",
    "Alias of x402_fetch for clients that want an explicit payment verb. Uses the same local-wallet x402 payment flow and returns the same settlement/result payload.",
    inputSchema,
    runFetch
  );
}
async function cliFetch(url, opts) {
  try {
    const { loadOrCreateWallet: loadOrCreateWallet2 } = await Promise.resolve().then(() => (init_wallet(), wallet_exports));
    const wallet = await loadOrCreateWallet2();
    const result = await x402Fetch(
      { url, method: opts.method, body: opts.body },
      wallet,
      opts
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const msg = err.cause?.code === "ENOTFOUND" ? `Could not reach ${url} \u2014 DNS lookup failed` : err.name === "TimeoutError" ? `Request to ${url} timed out` : err.message || String(err);
    console.log(JSON.stringify({ error: msg }, null, 2));
    process.exit(1);
  }
}
var init_fetch = __esm({
  "src/tools/fetch.ts"() {
    "use strict";
    init_widget_meta();
  }
});

// src/tools/check.ts
import { z as z3 } from "zod";
function parsePaymentRequiredHeader(headerValue) {
  if (!headerValue) return null;
  const candidates = [headerValue];
  try {
    candidates.push(Buffer.from(headerValue, "base64").toString("utf-8"));
  } catch {
  }
  try {
    const normalized = headerValue.replace(/-/g, "+").replace(/_/g, "/");
    candidates.push(Buffer.from(normalized, "base64").toString("utf-8"));
  } catch {
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
    }
  }
  return null;
}
async function checkEndpoint(url, method) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method !== "GET" ? "{}" : void 0,
    signal: AbortSignal.timeout(15e3)
  });
  if (res.status !== 402) {
    if (res.status === 401 || res.status === 403) {
      const bodyText = await res.text().catch(() => "");
      return {
        error: true,
        statusCode: res.status,
        authRequired: true,
        message: bodyText || "Provider authentication required before x402 payment flow."
      };
    }
    if (res.status >= 500) {
      return { error: true, statusCode: res.status, message: "Server error" };
    }
    if (res.status >= 400) {
      return { error: true, statusCode: res.status, message: `Client error: ${res.status}` };
    }
    return { requiresPayment: false, statusCode: res.status, free: true };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
  }
  const headerParsed = parsePaymentRequiredHeader(
    res.headers.get("PAYMENT-REQUIRED") || res.headers.get("payment-required")
  );
  const source = headerParsed && typeof headerParsed === "object" ? headerParsed : body;
  const accepts = body?.accepts;
  const acceptsFromHeader = source?.accepts;
  const effectiveAccepts = accepts?.length ? accepts : acceptsFromHeader;
  if (!effectiveAccepts?.length) {
    return {
      requiresPayment: true,
      statusCode: 402,
      error: "No payment options found in 402 response"
    };
  }
  const paymentOptions = effectiveAccepts.map((a) => {
    const amount = Number(a.amount || a.maxAmountRequired || 0);
    const decimals = Number(a.extra && typeof a.extra === "object" && "decimals" in a.extra ? a.extra.decimals : 6);
    return {
      price: amount / Math.pow(10, decimals),
      priceFormatted: `$${(amount / Math.pow(10, decimals)).toFixed(decimals > 2 ? 4 : 2)}`,
      network: a.network,
      scheme: a.scheme,
      asset: a.asset,
      payTo: a.payTo
    };
  });
  return {
    requiresPayment: true,
    statusCode: 402,
    x402Version: source?.x402Version ?? 2,
    paymentOptions,
    resource: source?.resource
  };
}
function registerCheckTool(server, opts) {
  server.tool(
    "x402_check",
    "Check if an endpoint requires x402 payment and see its pricing. Does NOT make a payment \u2014 just probes for requirements.",
    {
      url: z3.string().url().describe("The URL to check"),
      method: z3.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method to probe with")
    },
    async (args) => {
      try {
        const result = await checkEndpoint(args.url, args.method);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          _meta: CHECK_META
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
          isError: true
        };
      }
    }
  );
}
var init_check = __esm({
  "src/tools/check.ts"() {
    "use strict";
    init_widget_meta();
  }
});

// src/tools/wallet-tool.ts
function registerWalletTool(server, wallet, opts) {
  server.tool(
    "x402_wallet",
    "Show wallet addresses (Solana + EVM), USDC balances across all chains, and deposit instructions. The wallet is used to automatically pay for x402 API calls on Solana, Base, Polygon, Arbitrum, Optimism, and Avalanche.",
    {},
    async () => {
      if (!wallet) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "No wallet configured",
                tip: "Set DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (EVM) env var, or run `npx @dexterai/opendexter wallet` to create one."
              }, null, 2)
            }
          ]
        };
      }
      try {
        const { totalUsdc, chains } = await getAllBalances(wallet.info);
        const data = {
          solanaAddress: wallet.info.solanaAddress,
          evmAddress: wallet.info.evmAddress || null,
          network: "multichain",
          totalUsdc,
          chains,
          walletFile: WALLET_FILE
        };
        if (totalUsdc === 0) {
          data.tip = `Deposit USDC to ${wallet.info.solanaAddress} (Solana) or ${wallet.info.evmAddress || "configure EVM key"} (Base/Polygon/Arbitrum/Optimism/Avalanche) to start paying.`;
        }
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          _meta: WALLET_META
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: err.message }) }
          ],
          isError: true
        };
      }
    }
  );
}
var init_wallet_tool = __esm({
  "src/tools/wallet-tool.ts"() {
    "use strict";
    init_wallet();
    init_config();
    init_widget_meta();
  }
});

// src/server/index.ts
var server_exports = {};
__export(server_exports, {
  startServer: () => startServer
});
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
async function startServer(opts) {
  let wallet;
  try {
    wallet = await loadOrCreateWallet();
  } catch (err) {
    console.error(`[dexter-mcp] Wallet initialization failed: ${err.message}`);
    console.error("[dexter-mcp] Starting in search-only mode. Set DEXTER_PRIVATE_KEY or fix ~/.dexterai-mcp/wallet.json to enable payments.");
    wallet = null;
  }
  const server = new McpServer({
    name: "Dexter x402 Gateway",
    version: VERSION
  });
  registerSearchTool(server, opts);
  registerFetchTool(server, wallet, opts);
  registerCheckTool(server, opts);
  registerWalletTool(server, wallet, opts);
  if (opts.transport !== "stdio") {
    console.error("HTTP transport not yet implemented. Use --transport=stdio");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
var init_server = __esm({
  "src/server/index.ts"() {
    "use strict";
    init_config();
    init_search();
    init_fetch();
    init_check();
    init_wallet_tool();
    init_wallet();
  }
});

// src/cli/install/clients.ts
import { homedir as homedir2 } from "os";
import { join as join2 } from "path";
import { existsSync as existsSync2 } from "fs";
function getConfigDir() {
  const platform = process.platform;
  if (platform === "win32") {
    return process.env.APPDATA || join2(homedir2(), "AppData", "Roaming");
  }
  if (platform === "darwin") {
    return join2(homedir2(), "Library", "Application Support");
  }
  return process.env.XDG_CONFIG_HOME || join2(homedir2(), ".config");
}
function getClientConfig(client, dev) {
  const cmd = dev ? SERVER_CMD_DEV : SERVER_CMD;
  switch (client) {
    case "cursor":
      return {
        configPath: join2(homedir2(), ".cursor", "mcp.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
    case "claude-code":
      return {
        configPath: join2(homedir2(), ".claude.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
    case "codex": {
      const codexHome = process.env.CODEX_HOME || join2(homedir2(), ".codex");
      return {
        configPath: join2(codexHome, "config.toml"),
        sectionKey: "mcp_servers",
        entry: cmd,
        manual: true
        // TOML requires different handling
      };
    }
    case "vscode": {
      const configDir = getConfigDir();
      const vscodeDirs = ["Code", "Code - Insiders"];
      const dir = vscodeDirs.find((d) => existsSync2(join2(configDir, d))) || "Code";
      return {
        configPath: join2(configDir, dir, "User", "mcp.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
    }
    case "windsurf":
      return {
        configPath: join2(homedir2(), ".codeium", "windsurf", "mcp_config.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
    case "gemini-cli":
      return {
        configPath: join2(homedir2(), ".gemini", "settings.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
  }
}
var CLIENTS, SERVER_CMD, SERVER_CMD_DEV;
var init_clients = __esm({
  "src/cli/install/clients.ts"() {
    "use strict";
    CLIENTS = {
      cursor: {
        name: "Cursor",
        description: "Cursor AI code editor"
      },
      "claude-code": {
        name: "Claude Code",
        description: "Anthropic Claude Code CLI"
      },
      codex: {
        name: "Codex",
        description: "OpenAI Codex CLI"
      },
      vscode: {
        name: "VS Code",
        description: "Visual Studio Code with MCP support"
      },
      windsurf: {
        name: "Windsurf",
        description: "Codeium Windsurf editor"
      },
      "gemini-cli": {
        name: "Gemini CLI",
        description: "Google Gemini CLI"
      }
    };
    SERVER_CMD = {
      command: "npx",
      args: ["-y", "@dexterai/opendexter@latest"]
    };
    SERVER_CMD_DEV = {
      command: "node",
      args: [process.cwd() + "/dist/index.js", "--dev"]
    };
  }
});

// src/cli/install/index.ts
var install_exports = {};
__export(install_exports, {
  runInstall: () => runInstall
});
import { existsSync as existsSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync2, mkdirSync as mkdirSync2, copyFileSync as copyFileSync2 } from "fs";
import { dirname } from "path";
async function runInstall(opts) {
  console.log("Setting up wallet...");
  const wallet = await loadOrCreateWallet();
  if (!wallet) {
    console.error("Failed to create wallet. Exiting.");
    process.exit(1);
  }
  console.log(`Solana: ${wallet.info.solanaAddress}`);
  if (wallet.info.evmAddress) console.log(`EVM:    ${wallet.info.evmAddress}`);
  console.log();
  let clientId = opts.client;
  if (!clientId) {
    if (opts.yes) {
      console.error("--client is required when using --yes");
      process.exit(1);
    }
    console.log("Select an AI client to install into:\n");
    const ids = Object.keys(CLIENTS);
    ids.forEach((id, i) => console.log(`  ${i + 1}. ${CLIENTS[id].name}`));
    console.log();
    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question("Choice (number): ", resolve);
    });
    rl.close();
    const idx = parseInt(answer, 10) - 1;
    if (idx < 0 || idx >= ids.length) {
      console.error("Invalid choice.");
      process.exit(1);
    }
    clientId = ids[idx];
  }
  if (!CLIENTS[clientId]) {
    console.error(`Unknown client: ${clientId}`);
    console.error(`Available: ${Object.keys(CLIENTS).join(", ")}`);
    process.exit(1);
  }
  const config = getClientConfig(clientId, opts.dev);
  if (config.manual) {
    console.log(`
${CLIENTS[clientId].name} requires manual configuration.
`);
    console.log("Add this to your MCP config:\n");
    console.log(JSON.stringify(config.entry, null, 2));
    console.log(`
Config file: ${config.configPath}`);
    return;
  }
  console.log(`
Installing into ${CLIENTS[clientId].name}...`);
  mkdirSync2(dirname(config.configPath), { recursive: true });
  let existing = {};
  if (existsSync3(config.configPath)) {
    const raw = readFileSync3(config.configPath, "utf-8");
    try {
      existing = JSON.parse(raw);
    } catch {
      console.error(`Warning: ${config.configPath} contains invalid JSON. Backing up and creating fresh.`);
      copyFileSync2(config.configPath, config.configPath + ".bak");
      existing = {};
    }
    if (Object.keys(existing).length > 0) {
      copyFileSync2(config.configPath, config.configPath + ".bak");
    }
  }
  const section = existing[config.sectionKey] || {};
  section["dexter-x402"] = config.entry;
  existing[config.sectionKey] = section;
  writeFileSync2(config.configPath, JSON.stringify(existing, null, 2) + "\n");
  console.log(`Written to ${config.configPath}`);
  console.log(`
Dexter x402 Gateway installed for ${CLIENTS[clientId].name}.`);
  console.log(`Solana: ${wallet.info.solanaAddress}`);
  if (wallet.info.evmAddress) console.log(`EVM:    ${wallet.info.evmAddress}`);
  console.log(`
Deposit USDC on Solana or any supported EVM chain to start paying for x402 APIs.`);
}
var init_install = __esm({
  "src/cli/install/index.ts"() {
    "use strict";
    init_wallet();
    init_clients();
  }
});

// src/index.ts
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
async function main() {
  await yargs(hideBin(process.argv)).scriptName("opendexter").usage("$0 [command] [options]").option("dev", {
    type: "boolean",
    description: "Use localhost endpoints instead of production",
    default: false
  }).command(
    ["$0", "server"],
    "Start the MCP server (default)",
    (y) => y.option("transport", {
      choices: ["stdio", "http"],
      default: "stdio",
      description: "Transport mode"
    }),
    async (args) => {
      const { startServer: startServer2 } = await Promise.resolve().then(() => (init_server(), server_exports));
      await startServer2({
        transport: args.transport,
        dev: args.dev
      });
    }
  ).command(
    "install",
    "Install Dexter MCP into an AI client (Cursor, Claude, Codex, etc.)",
    (y) => y.option("client", {
      type: "string",
      description: "Client to install into"
    }).option("yes", {
      alias: "y",
      type: "boolean",
      description: "Skip prompts",
      default: false
    }),
    async (args) => {
      const { runInstall: runInstall2 } = await Promise.resolve().then(() => (init_install(), install_exports));
      await runInstall2({ client: args.client, yes: args.yes, dev: args.dev });
    }
  ).command(
    "wallet",
    "Show wallet address and balances",
    () => {
    },
    async (args) => {
      const { showWalletInfo: showWalletInfo2 } = await Promise.resolve().then(() => (init_wallet(), wallet_exports));
      await showWalletInfo2({ dev: args.dev });
    }
  ).command(
    "search <query>",
    "Search the Dexter x402 marketplace",
    (y) => y.positional("query", { type: "string", demandOption: true }),
    async (args) => {
      const { cliSearch: cliSearch2 } = await Promise.resolve().then(() => (init_search(), search_exports));
      await cliSearch2(args.query, { dev: args.dev });
    }
  ).command(
    "fetch <url>",
    "Fetch an x402-protected resource with automatic payment",
    (y) => y.positional("url", { type: "string", demandOption: true }).option("method", {
      choices: ["GET", "POST", "PUT", "DELETE"],
      default: "GET"
    }).option("body", { type: "string", description: "JSON request body" }),
    async (args) => {
      const { cliFetch: cliFetch2 } = await Promise.resolve().then(() => (init_fetch(), fetch_exports));
      await cliFetch2(args.url, {
        method: args.method,
        body: args.body,
        dev: args.dev
      });
    }
  ).command(
    "pay <url>",
    "Alias of fetch for clients that want an explicit payment verb",
    (y) => y.positional("url", { type: "string", demandOption: true }).option("method", {
      choices: ["GET", "POST", "PUT", "DELETE"],
      default: "GET"
    }).option("body", { type: "string", description: "JSON request body" }),
    async (args) => {
      const { cliFetch: cliFetch2 } = await Promise.resolve().then(() => (init_fetch(), fetch_exports));
      await cliFetch2(args.url, {
        method: args.method,
        body: args.body,
        dev: args.dev
      });
    }
  ).strict().help().parseAsync();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map