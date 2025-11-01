/**
 * Adapted from https://github.com/openai/openai-apps-sdk-examples
 */

import { useOpenAIGlobal } from './use-openai-global';

export function useWidgetProps<T extends Record<string, unknown>>(fallback?: T | (() => T)): T {
  const toolOutput = useOpenAIGlobal('toolOutput') as T;

  if (toolOutput) {
    return toolOutput;
  }

  if (typeof fallback === 'function') {
    return (fallback as () => T)();
  }

  return fallback ?? ({} as T);
}
