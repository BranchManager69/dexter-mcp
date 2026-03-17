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

  const cacheKey = String(key);
  const cached = snapshotCache.get(cacheKey);

  try {
    const serialized = JSON.stringify(value);
    if (cached && cached.serialized === serialized) {
      return cached.value as OpenAIGlobals[K];
    }
    // Freeze the value so React's === comparison works on subsequent calls.
    // Without this, window.openai[key] returns a new object each time,
    // causing useSyncExternalStore to detect a "tear" and re-render.
    const frozen = JSON.parse(serialized);
    snapshotCache.set(cacheKey, { serialized, value: frozen });
    return frozen as OpenAIGlobals[K];
  } catch {
    if (cached) return cached.value as OpenAIGlobals[K];
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
        // Only notify React if the serialized value actually changed.
        // Without this guard, ChatGPT's rapid set_globals events cause
        // useSyncExternalStore to re-render in a loop (React error #185).
        const cacheKey = String(key);
        const cached = snapshotCache.get(cacheKey);
        const next = window.openai?.[key] ?? null;
        if (cached && next !== null && typeof next === 'object') {
          try {
            if (JSON.stringify(next) === cached.serialized) return;
          } catch { /* fall through to notify */ }
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
