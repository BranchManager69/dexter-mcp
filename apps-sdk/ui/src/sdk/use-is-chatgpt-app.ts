export function useIsChatGptApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__isChatGptApp);
}
