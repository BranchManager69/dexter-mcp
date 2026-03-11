const BOOTSTRAP_TEMPLATE = (baseUrl, runtimeConfig) => `
  (function () {
    try {
      // Some browserified deps still reference Node global.
      // Ensure it exists in the widget iframe before any module code runs.
      if (typeof globalThis !== 'undefined' && typeof globalThis.global === 'undefined') {
        globalThis.global = globalThis;
      }

      var PROVIDED_BASE = ${JSON.stringify(baseUrl)};
      window.__DEXTER_WIDGET_RUNTIME__ = ${JSON.stringify(runtimeConfig)};
      window.__DEXTER_WIDGET_PREINIT_ERRORS__ = window.__DEXTER_WIDGET_PREINIT_ERRORS__ || [];

      function dexterPushPreinitError(kind, payload) {
        try {
          window.__DEXTER_WIDGET_PREINIT_ERRORS__.push({
            kind: kind,
            payload: payload,
            timestamp: Date.now(),
          });
        } catch (_preinitErr) {}
      }

      window.addEventListener('error', function (event) {
        dexterPushPreinitError('error', {
          message: event && event.message,
          filename: event && event.filename,
          lineno: event && event.lineno,
          colno: event && event.colno,
        });
      }, true);

      window.addEventListener('unhandledrejection', function (event) {
        dexterPushPreinitError('unhandledrejection', {
          reason: event && event.reason ? String(event.reason && event.reason.message ? event.reason.message : event.reason) : 'unknown',
        });
      });

      var normalizedBase = (typeof PROVIDED_BASE === 'string' && PROVIDED_BASE.trim().length)
        ? PROVIDED_BASE.trim()
        : '';
      if (normalizedBase && !normalizedBase.endsWith('/')) {
        normalizedBase += '/';
      }

      if (!normalizedBase || normalizedBase.includes('localhost')) {
        try {
          var moduleScript = document.querySelector('script[type="module"][data-dexter-entry]');
          if (!moduleScript) {
            moduleScript = document.querySelector('script[type="module"]');
          }
          if (moduleScript && moduleScript.src) {
            var parsed = new URL(moduleScript.src, window.location.href);
            var pathname = parsed.pathname.replace(/\\/app-assets\\/.*$/, '/');
            normalizedBase = parsed.origin + pathname;
            if (!normalizedBase.endsWith('/')) normalizedBase += '/';
          }
        } catch (_deriveErr) {
          normalizedBase = '';
        }
      }

      if (!normalizedBase) {
        return;
      }

      // NOTE: We do NOT create a <base> element because ChatGPT's CSP blocks
      // base-uri to external domains. Asset URLs are already absolute.
      // Just store the base URL for use by fetch rewriting below.

      window.innerBaseUrl = normalizedBase;
      window.__isChatGptApp = typeof window.openai !== 'undefined';

      var htmlElement = document.documentElement;
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var mutation = mutations[i];
          if (mutation.type === 'attributes' && mutation.target === htmlElement) {
            var attrName = mutation.attributeName;
            var lower = attrName ? attrName.toLowerCase() : '';
            if (lower !== 'suppresshydrationwarning' && lower !== 'data-theme' && lower !== 'style' && lower !== 'class') {
              htmlElement.removeAttribute(attrName);
            }
          }
        }
      });
      observer.observe(htmlElement, { attributes: true, attributeOldValue: true });

      var appOrigin;
      try {
        appOrigin = new URL(normalizedBase).origin;
      } catch (_err) {
        appOrigin = window.location.origin;
      }

      var isInIframe = window.self !== window.top;

      var originalReplaceState = history.replaceState;
      history.replaceState = function (state, unused, url) {
        if (url != null) {
          try {
            var u = new URL(url, window.location.href);
            var relative = u.pathname + u.search + u.hash;
            return originalReplaceState.call(history, state, unused, relative);
          } catch (_err) {
            return originalReplaceState.call(history, state, unused, url);
          }
        }
        return originalReplaceState.call(history, state, unused, url);
      };

      var originalPushState = history.pushState;
      history.pushState = function (state, unused, url) {
        if (url != null) {
          try {
            var u = new URL(url, window.location.href);
            var relative = u.pathname + u.search + u.hash;
            return originalPushState.call(history, state, unused, relative);
          } catch (_err) {
            return originalPushState.call(history, state, unused, url);
          }
        }
        return originalPushState.call(history, state, unused, url);
      };

      window.addEventListener('click', function (event) {
        try {
          var node = event.target;
          if (!node) return;
          var anchor = node.closest ? node.closest('a') : null;
          if (!anchor || !anchor.href) return;
          var href = anchor.href;
          var url = new URL(href, window.location.href);
          if (!window.openai || !window.openai.openExternal) return;

          var isExternal =
            url.origin !== window.location.origin &&
            (!appOrigin || url.origin !== appOrigin);

          if (isExternal) {
            event.preventDefault();
            window.openai.openExternal({ href: href });
          }
        } catch (_err) {}
      }, true);

      if (isInIframe) {
        var originalFetch = window.fetch;
        window.fetch = function (input, init) {
          try {
            var requestUrl;
            if (typeof input === 'string' || input instanceof URL) {
              requestUrl = new URL(input, window.location.href);
            } else if (input && typeof input === 'object' && input.url) {
              requestUrl = new URL(input.url, window.location.href);
            }

            if (requestUrl) {
              if (requestUrl.origin === window.location.origin) {
                var rebased = new URL(normalizedBase);
                rebased.pathname = requestUrl.pathname;
                rebased.search = requestUrl.search;
                rebased.hash = requestUrl.hash;
                requestUrl = rebased;
              }

              if (typeof input === 'string' || input instanceof URL) {
                input = requestUrl.toString();
              } else {
                input = new Request(requestUrl.toString(), input);
              }
            }
          } catch (_err) {}
          return originalFetch.call(window, input, init);
        };
      }
    } catch (_err) {
      console.warn('[dexter-apps-sdk] bootstrap failed', _err);
    }
  })();
`;

export function buildWidgetBootstrapScript(baseUrl, runtimeConfig = {}) {
  return `<script>${BOOTSTRAP_TEMPLATE(baseUrl, runtimeConfig)}</script>`;
}
