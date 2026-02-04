/**
 * Adapted from https://github.com/openai/openai-apps-sdk-examples
 */

import { useSyncExternalStore } from 'react';
import { SET_GLOBALS_EVENT_TYPE, SetGlobalsEvent, type OpenAIGlobals } from './types';

// Debug: log on module load
console.log('[sdk] use-openai-global module loaded', { 
  hasWindow: typeof window !== 'undefined',
  hasOpenai: typeof window !== 'undefined' && !!window.openai,
  openaiKeys: typeof window !== 'undefined' && window.openai ? Object.keys(window.openai) : []
});

export function useOpenAIGlobal<K extends keyof OpenAIGlobals>(key: K): OpenAIGlobals[K] | null {
  const value = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        console.log('[sdk] useOpenAIGlobal subscribe: no window (SSR)');
        return () => {};
      }

      const handler = (event: SetGlobalsEvent) => {
        console.log('[sdk] SET_GLOBALS_EVENT received', { key, hasKey: Object.prototype.hasOwnProperty.call(event.detail.globals, key), globals: event.detail.globals });
        if (Object.prototype.hasOwnProperty.call(event.detail.globals, key)) {
          onStoreChange();
        }
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handler, { passive: true });
      return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handler);
    },
    () => {
      const val = typeof window !== 'undefined' ? window.openai?.[key] ?? null : null;
      console.log('[sdk] useOpenAIGlobal getSnapshot', { key, value: val, hasOpenai: !!window?.openai });
      return val;
    },
    () => null,
  );
  
  console.log('[sdk] useOpenAIGlobal return', { key, value });
  return value;
}
