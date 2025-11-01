import { useOpenAIGlobal } from './use-openai-global';

export function useMaxHeight(): number | null {
  return useOpenAIGlobal('maxHeight');
}
