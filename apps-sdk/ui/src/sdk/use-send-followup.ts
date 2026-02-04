import { useCallback } from 'react';

/**
 * Hook for sending follow-up messages to ChatGPT from widgets.
 * This triggers the AI to respond as if the user sent the message.
 */
export function useSendFollowUp() {
  return useCallback(async (prompt: string) => {
    if (typeof window === 'undefined' || !window.openai?.sendFollowUpMessage) {
      console.warn('sendFollowUpMessage is not available in this context');
      return;
    }
    await window.openai.sendFollowUpMessage({ prompt });
  }, []);
}
