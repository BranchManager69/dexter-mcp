/**
 * Adapted from https://github.com/openai/openai-apps-sdk-examples
 */

import { useSyncExternalStore } from 'react';
import { SET_GLOBALS_EVENT_TYPE, SetGlobalsEvent, type OpenAIGlobals } from './types';

export function useOpenAIGlobal<K extends keyof OpenAIGlobals>(key: K): OpenAIGlobals[K] | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const handler = (event: SetGlobalsEvent) => {
        if (Object.prototype.hasOwnProperty.call(event.detail.globals, key)) {
          onStoreChange();
        }
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handler, { passive: true });
      return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handler);
    },
    () => (typeof window !== 'undefined' ? window.openai?.[key] ?? null : null),
    () => null,
  );
}
