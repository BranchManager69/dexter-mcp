/**
 * Dual-runtime SDK adapter.
 *
 * Provides unified React hooks that work in both ChatGPT (OpenAI Apps SDK)
 * and MCP Apps hosts (Cursor, Claude Desktop, VS Code).
 *
 * Host detection happens once at module load. Widgets import from this
 * module instead of directly from use-openai-global / mcp-apps-bridge.
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import type { Theme, CallTool } from './types';
import * as mcpApps from './mcp-apps-bridge';

type HostRuntime = 'chatgpt' | 'mcp-apps' | 'unknown';

function detectHost(): HostRuntime {
  if (typeof window === 'undefined') return 'unknown';
  if (typeof window.openai !== 'undefined') return 'chatgpt';
  if (window.__isMcpApp) return 'mcp-apps';
  if (window.self !== window.top) return 'mcp-apps';
  return 'unknown';
}

let _cachedHost: HostRuntime | null = null;
function getHost(): HostRuntime {
  if (_cachedHost) return _cachedHost;
  _cachedHost = detectHost();
  return _cachedHost;
}

// ── MCP Apps state store ──────────────────────────────────────────────
// Mirrors the useSyncExternalStore pattern from use-openai-global.ts
// but backs onto the MCP Apps bridge instead of window.openai.

let _mcpToolOutput: unknown = null;
let _mcpToolInput: unknown = null;
let _mcpTheme: Theme = 'dark';
let _mcpInitDone = false;
const _mcpListeners = new Set<() => void>();

function notifyMcpListeners() {
  for (const fn of _mcpListeners) fn();
}

function initMcpAppsOnce() {
  if (_mcpInitDone) return;
  _mcpInitDone = true;

  mcpApps.onNotification('ui/notifications/tool-result', (params: unknown) => {
    const p = params as { content?: Array<{ type: string; text?: string }>; structuredContent?: unknown } | undefined;
    _mcpToolOutput = p?.structuredContent ?? tryParseTextContent(p?.content);
    notifyMcpListeners();
  });

  mcpApps.onNotification('ui/notifications/tool-input', (params: unknown) => {
    _mcpToolInput = params;
    notifyMcpListeners();
  });

  mcpApps.initialize().then((result) => {
    _mcpTheme = result.hostContext?.theme ?? 'dark';
    notifyMcpListeners();
  }).catch(() => {});
}

function tryParseTextContent(content?: Array<{ type: string; text?: string }>): unknown {
  const text = content?.find(c => c.type === 'text')?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

// ── Unified hooks ─────────────────────────────────────────────────────

/**
 * Get the tool output (structured data for rendering).
 * ChatGPT: reads window.openai.toolOutput via useSyncExternalStore.
 * MCP Apps: reads from bridge notification store.
 */
export function useToolOutput<T = unknown>(): T | null {
  const host = getHost();

  // ChatGPT path — reuse existing useSyncExternalStore pattern
  const chatgptValue = useSyncExternalStore(
    (onChange) => {
      if (host !== 'chatgpt' || typeof window === 'undefined') return () => {};
      const handler = (event: CustomEvent<{ globals: Record<string, unknown> }>) => {
        if (Object.prototype.hasOwnProperty.call(event.detail.globals, 'toolOutput')) {
          onChange();
        }
      };
      window.addEventListener('openai:set_globals', handler as EventListener, { passive: true });
      return () => window.removeEventListener('openai:set_globals', handler as EventListener);
    },
    () => (host === 'chatgpt' ? (window.openai?.toolOutput ?? null) : null) as T | null,
    () => null,
  );

  // MCP Apps path
  const mcpValue = useSyncExternalStore(
    (onChange) => {
      if (host !== 'mcp-apps') return () => {};
      initMcpAppsOnce();
      _mcpListeners.add(onChange);
      return () => { _mcpListeners.delete(onChange); };
    },
    () => (host === 'mcp-apps' ? _mcpToolOutput : null) as T | null,
    () => null,
  );

  return host === 'chatgpt' ? chatgptValue : mcpValue;
}

/**
 * Get the tool input (what the user asked for).
 */
export function useToolInput<T = Record<string, unknown>>(): T | null {
  const host = getHost();

  const chatgptValue = useSyncExternalStore(
    (onChange) => {
      if (host !== 'chatgpt' || typeof window === 'undefined') return () => {};
      const handler = (event: CustomEvent<{ globals: Record<string, unknown> }>) => {
        if (Object.prototype.hasOwnProperty.call(event.detail.globals, 'toolInput')) {
          onChange();
        }
      };
      window.addEventListener('openai:set_globals', handler as EventListener, { passive: true });
      return () => window.removeEventListener('openai:set_globals', handler as EventListener);
    },
    () => (host === 'chatgpt' ? (window.openai?.toolInput ?? null) : null) as T | null,
    () => null,
  );

  const mcpValue = useSyncExternalStore(
    (onChange) => {
      if (host !== 'mcp-apps') return () => {};
      initMcpAppsOnce();
      _mcpListeners.add(onChange);
      return () => { _mcpListeners.delete(onChange); };
    },
    () => (host === 'mcp-apps' ? _mcpToolInput : null) as T | null,
    () => null,
  );

  return host === 'chatgpt' ? chatgptValue : mcpValue;
}

/**
 * Get the current theme.
 */
export function useAdaptiveTheme(): Theme {
  const host = getHost();

  const chatgptTheme = useSyncExternalStore(
    (onChange) => {
      if (host !== 'chatgpt' || typeof window === 'undefined') return () => {};
      const handler = (event: CustomEvent<{ globals: Record<string, unknown> }>) => {
        if (Object.prototype.hasOwnProperty.call(event.detail.globals, 'theme')) {
          onChange();
        }
      };
      window.addEventListener('openai:set_globals', handler as EventListener, { passive: true });
      return () => window.removeEventListener('openai:set_globals', handler as EventListener);
    },
    () => (host === 'chatgpt' ? (window.openai?.theme ?? 'dark') : 'dark'),
    () => 'dark' as Theme,
  );

  const mcpTheme = useSyncExternalStore(
    (onChange) => {
      if (host !== 'mcp-apps') return () => {};
      initMcpAppsOnce();
      _mcpListeners.add(onChange);
      return () => { _mcpListeners.delete(onChange); };
    },
    () => (host === 'mcp-apps' ? _mcpTheme : 'dark'),
    () => 'dark' as Theme,
  );

  return host === 'chatgpt' ? chatgptTheme : mcpTheme;
}

/**
 * Call another MCP tool from within a widget.
 */
export function useAdaptiveCallToolFn(): (name: string, args: Record<string, unknown>) => Promise<{ result: string }> {
  const host = getHost();
  return useCallback(async (name: string, args: Record<string, unknown>) => {
    if (host === 'mcp-apps') {
      return mcpApps.callTool(name, args);
    }
    if (typeof window !== 'undefined' && window.openai?.callTool) {
      return window.openai.callTool(name, args);
    }
    throw new Error('callTool is not available');
  }, [host]);
}

/**
 * Open an external link.
 */
export function useAdaptiveOpenExternal(): (href: string) => void {
  const host = getHost();
  return useCallback((href: string) => {
    if (host === 'mcp-apps') {
      mcpApps.openLink(href);
      return;
    }
    if (typeof window !== 'undefined' && window.openai?.openExternal) {
      window.openai.openExternal({ href });
      return;
    }
    window?.open(href, '_blank', 'noopener,noreferrer');
  }, [host]);
}

/**
 * Returns the detected host runtime.
 */
export function useHostRuntime(): HostRuntime {
  return getHost();
}
