import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });
import * as Sentry from '@sentry/node';

const OPEN_MCP_DSN = process.env.SENTRY_OPEN_MCP_DSN || process.env.SENTRY_DSN || '';

Sentry.init({
  dsn: OPEN_MCP_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
  initialScope: { tags: { service: 'dexter-open-mcp' } },
  beforeSend(event) { return OPEN_MCP_DSN ? event : null; },
});

function patchConsole(method, level) {
  const orig = console[method];
  console[method] = function (...args) {
    orig.apply(console, args);
    if (!OPEN_MCP_DSN) return;
    try {
      const first = args[0];
      if (first instanceof Error) {
        Sentry.captureException(first, { level, extra: { source: `console.${method}` } });
      } else {
        const msg = args.map(a => a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        if (msg.includes('deprecated')) return;
        Sentry.captureMessage(msg, { level, extra: { source: `console.${method}` } });
      }
    } catch {}
  };
}
patchConsole('error', 'error');
patchConsole('warn', 'warning');

export { Sentry };
