import { useOpenAIGlobal } from './use-openai-global';

/**
 * Hook for accessing the original tool input (what the user asked for).
 * Useful for showing context like "Results for: {query}"
 */
export function useToolInput<T = Record<string, unknown>>(): T | null {
  return useOpenAIGlobal('toolInput') as T | null;
}
