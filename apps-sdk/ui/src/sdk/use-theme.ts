import { useOpenAIGlobal } from './use-openai-global';
import type { Theme } from './types';

/**
 * Hook for getting the current ChatGPT theme (light/dark).
 * Defaults to 'dark' if not available.
 */
export function useTheme(): Theme {
  const theme = useOpenAIGlobal('theme');
  return theme ?? 'dark';
}

/**
 * Hook that returns theme-aware CSS class names.
 */
export function useThemeClass(darkClass: string, lightClass: string): string {
  const theme = useTheme();
  return theme === 'light' ? lightClass : darkClass;
}
