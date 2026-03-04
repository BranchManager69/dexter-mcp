import { useEffect, useRef } from 'react';

/**
 * Reports the widget's actual content height to ChatGPT on every layout change.
 * Uses ResizeObserver so height updates fire when content expands/collapses
 * (JSON viewer toggle, funding panel show/hide, results loading, etc.),
 * not just on the initial render.
 */
export function useIntrinsicHeight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    const notify = (window as any).openai?.notifyIntrinsicHeight;
    if (!el || typeof notify !== 'function') return;

    const report = () => notify({ height: el.scrollHeight });

    report();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(report);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  return ref;
}
