import { useOpenAIGlobal } from './use-openai-global';

export function useDisplayMode() {
  return useOpenAIGlobal('displayMode');
}
