/**
 * Internal Dextercard HTTP client.
 *
 * Wraps the dexter-api /internal/dextercard/* surface, signing every
 * request with the shared HMAC secret. The open MCP server uses this
 * to act on behalf of a paired user without ever holding their
 * carrier session itself.
 *
 * Auth contract (mirrors dexter-api/src/routes/internalDextercard.ts):
 *   X-Acting-User-Id:        <supabase user uuid>
 *   X-Internal-Timestamp:    <unix ms>
 *   X-Internal-Signature:    hex(hmac_sha256(secret, `${ts}.${userId}.${rawBody}`))
 */
import { createHmac } from 'node:crypto';

const DEFAULT_BASE = (process.env.DEXTER_API_URL || 'http://127.0.0.1:3030').replace(/\/+$/, '');
const SECRET = (process.env.INTERNAL_DEXTERCARD_HMAC_SECRET || '').trim();

if (!SECRET || SECRET.length < 32) {
  console.warn('[internal-dextercard] INTERNAL_DEXTERCARD_HMAC_SECRET unset or <32 chars — card tools will fail.');
}

function sign(ts, userId, rawBody) {
  return createHmac('sha256', SECRET).update(`${ts}.${userId}.${rawBody}`).digest('hex');
}

/**
 * Make an authenticated call to /internal/dextercard/<path>.
 * Returns { status, body } where body is parsed JSON when possible,
 * otherwise the raw text. Does NOT throw on 4xx/5xx — the caller
 * decides how to surface dextercard_login_required (409) etc.
 */
export async function internalDextercardCall({
  userId,
  method = 'GET',
  path,
  body = null,
  baseUrl = DEFAULT_BASE,
  signal,
}) {
  if (!SECRET) {
    return { status: 503, body: { error: 'internal_dextercard_disabled' } };
  }
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return { status: 400, body: { error: 'invalid_user_id' } };
  }

  const url = `${baseUrl}/internal/dextercard${path}`;
  const ts = String(Date.now());
  const rawBody = body == null ? '' : JSON.stringify(body);
  const signature = sign(ts, userId, rawBody);

  const headers = {
    'Content-Type': 'application/json',
    'X-Acting-User-Id': userId,
    'X-Internal-Timestamp': ts,
    'X-Internal-Signature': signature,
  };

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : rawBody,
      signal,
    });
  } catch (err) {
    return { status: 0, body: { error: 'network_error', detail: err?.message || String(err) } };
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}
