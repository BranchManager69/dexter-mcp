const BOOTSTRAP_TEMPLATE = (baseUrl) => `
  (function () {
    try {
      var BASE_URL = ${JSON.stringify(baseUrl)};
      if (typeof BASE_URL !== 'string' || !BASE_URL) return;
      var normalizedBase = BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/';

      // Ensure <base> tag exists so relative URLs resolve to our host.
      var existingBase = document.querySelector('base');
      if (!existingBase) {
        var baseEl = document.createElement('base');
        baseEl.setAttribute('href', normalizedBase);
        if (document.head.firstChild) {
          document.head.insertBefore(baseEl, document.head.firstChild);
        } else {
          document.head.appendChild(baseEl);
        }
      } else if (!existingBase.getAttribute('href')) {
        existingBase.setAttribute('href', normalizedBase);
      }

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
