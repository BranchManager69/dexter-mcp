/**
 * Server-to-server helpers for the OpenDexter MCP pairing flow.
 *
 * The open MCP doesn't go through OAuth itself — when a card tool is
 * called and the current MCP session is not yet bound to a Dexter user,
 * we mint a connector OAuth `request_id` via dexter-api and hand the
 * resulting login URL to the agent so it can show the user where to
 * sign in. After the user signs in, dexter-api stores the result; the
 * open MCP polls /api/connector/oauth/result?request_id=... to discover
 * completion and bind the user.
 */
import { createHmac } from 'node:crypto';

const DEXTER_API = (process.env.DEXTER_API_URL || 'http://127.0.0.1:3030').replace(/\/+$/, '');
const SECRET = (process.env.INTERNAL_DEXTERCARD_HMAC_SECRET || '').trim();
const CLIENT_ID = (process.env.CONNECTOR_OPEN_MCP_CLIENT_ID || 'cid_opendexter_open_mcp').trim();
const REDIRECT_URI = (process.env.CONNECTOR_OPEN_MCP_REDIRECT_URI || 'https://dexter.cash/connector/auth/done').trim();

/**
 * Mint a fresh connector pairing request_id by calling
 * /api/connector/oauth/authorize?response_mode=json. Returns the
 * absolute URL the user should visit to sign in, plus the request_id
 * we'll later poll on completion. No HMAC needed — /authorize is a
 * public endpoint (the request_id itself is the capability).
 */
export async function mintPairingRequest(scope = 'dextercard') {
  const url = new URL(`${DEXTER_API}/api/connector/oauth/authorize`);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', scope);
  url.searchParams.set('response_mode', 'json');

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`pair_mint_failed status=${res.status} body=${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json?.ok || !json?.request_id || !json?.login_url) {
    throw new Error('pair_mint_invalid_response');
  }
  return {
    requestId: String(json.request_id),
    loginUrl: String(json.login_url),
  };
}

/**
 * Poll the result of a previously-minted pairing request_id. Gated by
 * HMAC (same scheme as /internal/dextercard/*) since this returns a
 * Dexter MCP JWT for the signed-in user.
 *
 * Returns one of:
 *   { status: 'pending' }
 *   { status: 'completed', supabaseUserId, supabaseEmail, dexterMcpJwt, expiresIn }
 *   { status: 'expired' | 'not_found' }
 */
export async function pollPairingResult(requestId) {
  if (!SECRET) throw new Error('INTERNAL_DEXTERCARD_HMAC_SECRET missing');
  if (!requestId) throw new Error('requestId required');
  const ts = String(Date.now());
  const sig = createHmac('sha256', SECRET).update(`${ts}.${requestId}`).digest('hex');

  const url = `${DEXTER_API}/api/connector/oauth/result?request_id=${encodeURIComponent(requestId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Internal-Timestamp': ts,
      'X-Internal-Signature': sig,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`pair_poll_failed status=${res.status} body=${text.slice(0, 200)}`);
  }
  return res.json();
}
