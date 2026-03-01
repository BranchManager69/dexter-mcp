import { useEffect, useRef } from 'react';

/**
 * Reports the widget's actual content height to ChatGPT after each render.
 * Prevents scroll clipping and wasted space.
 */
export function useIntrinsicHeight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (ref.current && (window as any).openai?.notifyIntrinsicHeight) {
      (window as any).openai.notifyIntrinsicHeight({ height: ref.current.scrollHeight });
    }
  });

  return ref;
}
