import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';

declare global {
  interface Window {
    registerComponent?: (name: string, renderer: (props: unknown) => string | HTMLElement) => void;
    openai?: {
      apps?: {
        registerComponent?: (name: string, renderer: (props: unknown) => string | HTMLElement) => void;
      };
    };
  }
}

type Renderer<P> = (props: P) => JSX.Element;

export function registerReactComponent<P = any>(name: string, renderer: Renderer<P>) {
  const register =
    window.openai?.apps?.registerComponent ||
    window.registerComponent ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).registerComponent;

  if (typeof register !== 'function') {
    console.error(`[apps-sdk] registerComponent missing for ${name}`);
    return;
  }

  register(name, (props: P) => {
    const host = document.createElement('div');
    host.className = 'dexter-app-host';

    // React root rendering
    const root = createRoot(host);
    root.render(
      <StrictMode>
        {renderer(props)}
      </StrictMode>
    );

    return host;
  });
}
