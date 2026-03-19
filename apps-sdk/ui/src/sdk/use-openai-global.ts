/**
 * Adapted from https://github.com/openai/openai-apps-sdk-examples
 */

import { useSyncExternalStore } from 'react';
import { SET_GLOBALS_EVENT_TYPE, SetGlobalsEvent, type OpenAIGlobals } from './types';

const snapshotCache = new Map<string, { serialized: string; value: unknown }>();

function getStableSnapshot<K extends keyof OpenAIGlobals>(key: K): OpenAIGlobals[K] | null {
  const value = typeof window !== 'undefined' ? window.openai?.[key] ?? null : null;
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value as OpenAIGlobals[K];

  try {
    const serialized = JSON.stringify(value);
    const cacheKey = String(key);
    const cached = snapshotCache.get(cacheKey);
    if (cached && cached.serialized === serialized) {
      return cached.value as OpenAIGlobals[K];
    }
    snapshotCache.set(cacheKey, { serialized, value });
    return value as OpenAIGlobals[K];
  } catch {
    return value as OpenAIGlobals[K];
  }
}

export function useOpenAIGlobal<K extends keyof OpenAIGlobals>(key: K): OpenAIGlobals[K] | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const handler = (event: SetGlobalsEvent) => {
        if (!Object.prototype.hasOwnProperty.call(event.detail.globals, key)) return;

        // ChatGPT can emit repeated set_globals events with identical object
        // payloads during widget mount. Ignore those redundant notifications
        // so useSyncExternalStore does not get trapped in an update loop.
        const cacheKey = String(key);
        const cached = snapshotCache.get(cacheKey);
        const next = window.openai?.[key] ?? null;
        if (cached && next !== null && typeof next === 'object') {
          try {
            if (JSON.stringify(next) === cached.serialized) return;
          } catch {
            // Fall through and notify React if serialization fails.
          }
        }

        onStoreChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handler, { passive: true });
      return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handler);
    },
    () => getStableSnapshot(key),
    () => null,
  );
}
