import { useCallback } from 'react';
import { captureWidgetException } from './init-sentry';

type FollowUpOptions = { prompt: string; scrollToBottom?: boolean };

export function useSendFollowUp() {
  return useCallback(async (options: FollowUpOptions) => {
    if (typeof window === 'undefined' || !window.openai?.sendFollowUpMessage) {
      console.warn('sendFollowUpMessage is not available in this context');
      return;
    }
    try {
      await window.openai.sendFollowUpMessage(options);
    } catch (error) {
      captureWidgetException(error, { phase: 'send_follow_up', prompt: options.prompt });
    }
  }, []);
}
