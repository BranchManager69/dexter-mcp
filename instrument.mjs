import * as dotenv from 'dotenv';
dotenv.config();
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
  beforeSend(event) { return process.env.SENTRY_DSN ? event : null; },
});

function patchConsole(method, level) {
  const orig = console[method];
  console[method] = function (...args) {
    orig.apply(console, args);
    if (!process.env.SENTRY_DSN) return;
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
