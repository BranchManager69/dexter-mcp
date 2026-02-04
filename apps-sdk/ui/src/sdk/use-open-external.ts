import { useCallback } from 'react';

/**
 * Hook for opening external links safely through ChatGPT.
 * Links must be allowed by the widget's CSP redirect_domains.
 */
export function useOpenExternal() {
  return useCallback((href: string) => {
    if (typeof window === 'undefined' || !window.openai?.openExternal) {
      // Fallback to regular link opening
      window?.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    window.openai.openExternal({ href });
  }, []);
}
