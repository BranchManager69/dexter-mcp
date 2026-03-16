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

  const result = await sendRequest('ui/initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
  }) as McpAppsInitResult;

  _initResult = result;
  _initialized = true;
  return result;
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
