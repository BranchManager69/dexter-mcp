import { useOpenAIGlobal } from './use-openai-global';

export function useRequestDisplayMode() {
  return useOpenAIGlobal('requestDisplayMode');
}
