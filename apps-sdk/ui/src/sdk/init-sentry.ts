import * as Sentry from '@sentry/browser';

type WidgetRuntimeConfig = {
  entryName?: string;
  templateUri?: string;
  widgetDescription?: string;
  widgetDomain?: string;
  assetBase?: string;
  release?: string;
  sentry?: {
    dsn?: string;
    org?: string;
    project?: string;
    environment?: string;
    enabled?: boolean;
    tracesSampleRate?: number;
    replaysSessionSampleRate?: number;
    replaysOnErrorSampleRate?: number;
    sendDefaultPii?: boolean;
  };
};

declare global {
  interface Window {
    __DEXTER_WIDGET_RUNTIME__?: WidgetRuntimeConfig;
    __DEXTER_WIDGET_SENTRY_INITIALIZED__?: boolean;
    __DEXTER_WIDGET_PREINIT_ERRORS__?: Array<{ kind: string; payload: Record<string, unknown>; timestamp: number }>;
  }
}

function getRuntime() {
  if (typeof window === 'undefined') return null;
  return window.__DEXTER_WIDGET_RUNTIME__ ?? null;
}

export function addWidgetBreadcrumb(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'dexter.widget',
    message,
    level: 'info',
    data,
  });
}

export function captureWidgetException(error: unknown, extras?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: extras,
  });
}

function initWidgetSentry() {
  if (typeof window === 'undefined') return;
  if (window.__DEXTER_WIDGET_SENTRY_INITIALIZED__) return;

  const runtime = getRuntime();
  const sentry = runtime?.sentry;
  if (!runtime || !sentry?.enabled || !sentry?.dsn) return;

  const integrations = [];
  if (typeof Sentry.browserTracingIntegration === 'function') {
    integrations.push(Sentry.browserTracingIntegration());
  }
  if (typeof Sentry.replayIntegration === 'function') {
    integrations.push(Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }));
  }

  Sentry.init({
    dsn: sentry.dsn,
    environment: sentry.environment || 'production',
    release: runtime.release,
    tracesSampleRate: sentry.tracesSampleRate ?? 1,
    replaysSessionSampleRate: sentry.replaysSessionSampleRate ?? 0,
    replaysOnErrorSampleRate: sentry.replaysOnErrorSampleRate ?? 1,
    sendDefaultPii: sentry.sendDefaultPii ?? true,
    integrations,
  });

  window.__DEXTER_WIDGET_SENTRY_INITIALIZED__ = true;

  Sentry.setTag('widget.entry', runtime.entryName || 'unknown');
  Sentry.setTag('widget.template_uri', runtime.templateUri || 'unknown');
  Sentry.setTag('widget.release', runtime.release || 'unknown');
  Sentry.setContext('widget_runtime', {
    entryName: runtime.entryName || null,
    templateUri: runtime.templateUri || null,
    widgetDescription: runtime.widgetDescription || null,
    widgetDomain: runtime.widgetDomain || null,
    assetBase: runtime.assetBase || null,
    sentryOrg: sentry.org || null,
    sentryProject: sentry.project || null,
    build: document.querySelector('[data-widget-build]')?.getAttribute('data-widget-build') || null,
  });

  addWidgetBreadcrumb('widget_sentry_initialized', {
    entryName: runtime.entryName,
    templateUri: runtime.templateUri,
    release: runtime.release,
  });

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dexterWidgetSentryTest') === '1') {
      Sentry.captureMessage('dexter_widget_sentry_test', {
        level: 'info',
      });
    }
    if (params.get('dexterWidgetSentryThrow') === '1') {
      Sentry.captureException(new Error('dexter_widget_sentry_stack_test'));
    }
  } catch {}

  const preinit = Array.isArray(window.__DEXTER_WIDGET_PREINIT_ERRORS__)
    ? window.__DEXTER_WIDGET_PREINIT_ERRORS__
    : [];
  for (const item of preinit) {
    Sentry.captureMessage(`preinit_${item.kind}`, {
      level: 'warning',
      extra: item.payload,
    });
  }
  window.__DEXTER_WIDGET_PREINIT_ERRORS__ = [];
}

initWidgetSentry();
