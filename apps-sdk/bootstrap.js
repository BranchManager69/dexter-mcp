const BOOTSTRAP_TEMPLATE = (baseUrl) => `
  (function () {
    try {
      var PROVIDED_BASE = ${JSON.stringify(baseUrl)};
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
            if (attrName && attrName.toLowerCase() !== 'suppresshydrationwarning') {
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

export function buildWidgetBootstrapScript(baseUrl) {
  return `<script>${BOOTSTRAP_TEMPLATE(baseUrl)}</script>`;
}
