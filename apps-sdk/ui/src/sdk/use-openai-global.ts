/**
 * Adapted from https://github.com/openai/openai-apps-sdk-examples
 *
 * Uses useRef-based snapshot caching to avoid the infinite re-render loop
 * that occurs when useSyncExternalStore detects a "torn" read between
 * React's render and commit phases. The snapshot always returns a stable
 * reference — either the same cached object (when content unchanged) or
 * a new deep-frozen copy (when content changed).
 */

import { useRef, useSyncExternalStore } from 'react';
import { SET_GLOBALS_EVENT_TYPE, SetGlobalsEvent, type OpenAIGlobals } from './types';

export function useOpenAIGlobal<K extends keyof OpenAIGlobals>(key: K): OpenAIGlobals[K] | null {
  const cacheRef = useRef<{ serialized: string; stable: OpenAIGlobals[K] } | null>(null);

  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {};

      const handler = (event: SetGlobalsEvent) => {
        if (!Object.prototype.hasOwnProperty.call(event.detail.globals, key)) return;
        onStoreChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handler, { passive: true });
      return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handler);
    },
    () => {
      const raw = typeof window !== 'undefined' ? window.openai?.[key] ?? null : null;
      if (raw === null || raw === undefined) return null;
      if (typeof raw !== 'object') return raw;

      try {
        const serialized = JSON.stringify(raw);
        const cached = cacheRef.current;
        if (cached && cached.serialized === serialized) {
          return cached.stable;
        }
        const stable = JSON.parse(serialized) as OpenAIGlobals[K];
        cacheRef.current = { serialized, stable };
        return stable;
      } catch {
        return cacheRef.current?.stable ?? raw;
      }
    },
    () => null,
  );
}
