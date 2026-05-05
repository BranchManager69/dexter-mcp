/**
 * MCP Apps JSON-RPC 2.0 bridge over postMessage.
 *
 * Implements the client (view) side of the MCP Apps extension protocol
 * so widgets can run inside any MCP Apps-capable host (Cursor, Claude Desktop,
 * VS Code, etc.) using the same React components that already work in ChatGPT.
 *
 * @see https://modelcontextprotocol.io/extensions/apps/overview
 */

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type JsonRpcNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
};

type PendingRequest = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
};

export type McpAppsTheme = 'light' | 'dark';

export type McpAppsInitResult = {
  hostContext?: {
    theme?: McpAppsTheme;
    locale?: string;
    [key: string]: unknown;
  };
  capabilities?: Record<string, unknown>;
};

export type McpAppsToolResult = {
  content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

export type McpAppsToolInput = Record<string, unknown>;

type NotificationHandler = (params: unknown) => void;

let _nextId = 1;
const _pending = new Map<number, PendingRequest>();
const _notificationHandlers = new Map<string, Set<NotificationHandler>>();
let _initialized = false;
let _initResult: McpAppsInitResult | null = null;

function sendRequest(method: string, params?: unknown): Promise<unknown> {
  const id = _nextId++;
  const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

  return new Promise((resolve, reject) => {
    _pending.set(id, { resolve, reject });
    window.parent.postMessage(msg, '*');
  });
}

function sendNotification(method: string, params?: unknown): void {
  const msg: JsonRpcNotification = { jsonrpc: '2.0', method, params };
  window.parent.postMessage(msg, '*');
}

function handleMessage(event: MessageEvent): void {
  const data = event.data;
  if (!data || data.jsonrpc !== '2.0') return;

  if ('id' in data && (data.result !== undefined || data.error !== undefined)) {
    const pending = _pending.get(data.id);
    if (!pending) return;
    _pending.delete(data.id);

    if (data.error) {
      pending.reject(new Error(data.error.message ?? 'MCP Apps RPC error'));
    } else {
      pending.resolve(data.result);
    }
    return;
  }

  if ('method' in data && !('id' in data)) {
    const handlers = _notificationHandlers.get(data.method);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(data.params); } catch { /* don't crash on handler errors */ }
      }
    }
  }
}

export function onNotification(method: string, handler: NotificationHandler): () => void {
  let set = _notificationHandlers.get(method);
  if (!set) {
    set = new Set();
    _notificationHandlers.set(method, set);
  }
  set.add(handler);
  return () => { set!.delete(handler); };
}

export async function initialize(): Promise<McpAppsInitResult> {
  if (_initialized && _initResult) return _initResult;

  window.addEventListener('message', handleMessage);

  // MCP Apps spec / official @modelcontextprotocol/ext-apps SDK requires:
  //   - protocolVersion = "2026-01-26"
  //   - appCapabilities (NOT `capabilities`) declaring availableDisplayModes
  //   - appInfo with name + version (REQUIRED — host rejects init without it)
  //   - widget MUST send `ui/notifications/initialized` after receiving result
  //   - widget MUST send `ui/notifications/size-changed` with non-zero height
  //     or the host iframe stays collapsed (empty render space)
  //
  // ChatGPT uses window.openai globals (a different code path entirely) and
  // is unaffected by these handshake requirements.
  const result = await sendRequest('ui/initialize', {
    protocolVersion: '2026-01-26',
    appCapabilities: {
      availableDisplayModes: ['inline'],
    },
    appInfo: {
      name: 'dexter-apps-sdk',
      version: '0.1.0',
    },
  }) as McpAppsInitResult;

  sendNotification('ui/notifications/initialized');

  _initResult = result;
  _initialized = true;

  // Start emitting size-changed notifications so the host can grow the
  // iframe to fit our content. Without this the iframe renders at height: 0
  // and the user sees an empty space where the widget should be.
  startSizeChangedNotifications();

  return result;
}

/**
 * Mirror of @modelcontextprotocol/ext-apps' setupSizeChangedNotifications.
 * Watches the document for size changes and posts ui/notifications/size-changed
 * to the host so it can grow the iframe to fit content.
 */
function startSizeChangedNotifications(): void {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;

  let scheduled = false;
  let lastWidth = 0;
  let lastHeight = 0;

  const measure = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const root = document.documentElement;
      // Snapshot inline styles so we can probe natural size without
      // permanently changing layout.
      const prevWidth = root.style.width;
      const prevHeight = root.style.height;
      root.style.width = 'fit-content';
      root.style.height = 'max-content';
      const rect = root.getBoundingClientRect();
      root.style.width = prevWidth;
      root.style.height = prevHeight;

      const scrollbarWidth = window.innerWidth - root.clientWidth;
      const width = Math.ceil(rect.width + scrollbarWidth);
      const height = Math.ceil(rect.height);

      if (width !== lastWidth || height !== lastHeight) {
        lastWidth = width;
        lastHeight = height;
        sendNotification('ui/notifications/size-changed', { width, height });
      }
    });
  };

  // Initial measurement.
  measure();

  // Observe both <html> and <body> so we catch React-driven content changes.
  const observer = new ResizeObserver(measure);
  observer.observe(document.documentElement);
  if (document.body) observer.observe(document.body);
}

export function getInitResult(): McpAppsInitResult | null {
  return _initResult;
}

export function isInitialized(): boolean {
  return _initialized;
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: string }> {
  const response = await sendRequest('tools/call', { name, arguments: args });
  const typed = response as McpAppsToolResult | undefined;
  const textContent = typed?.content?.find(c => c.type === 'text');
  return { result: textContent?.text ?? JSON.stringify(typed?.structuredContent ?? response) };
}

export function openLink(href: string): void {
  sendRequest('ui/open-link', { url: href }).catch(() => {
    window.open(href, '_blank', 'noopener,noreferrer');
  });
}

// Probe variant: surfaces success/failure without falling back, so a
// capability test can distinguish "host honored ui/open-link" from
// "host rejected, no escape hatch available." Returns the host's response
// (or the rejection error). Do NOT use this in production widgets — use
// openLink() above which has the safety fallback.
export async function openLinkProbe(href: string): Promise<{ok: true; response: unknown} | {ok: false; error: string}> {
  try {
    const response = await sendRequest('ui/open-link', { url: href });
    return { ok: true, response };
  } catch (err) {
    const e = err as Error;
    return { ok: false, error: e?.message ?? String(err) };
  }
}

export function updateModelContext(context: { text: string }): void {
  sendNotification('ui/update-model-context', context);
}

export function isMcpAppsHost(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__isMcpApp) return true;
  if (typeof window.openai !== 'undefined') return false;
  return window.self !== window.top;
}

declare global {
  interface Window {
    __isMcpApp?: boolean;
  }
}
