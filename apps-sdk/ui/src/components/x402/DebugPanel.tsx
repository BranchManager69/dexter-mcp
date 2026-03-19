import { useState } from 'react';

/**
 * Debug panel for x402 widgets. Shows SDK state, theme, CSP, callTool status.
 * Tap "Debug" to toggle. Copy-paste the output when reporting issues.
 */
type DebugValue = string | number | boolean | null | undefined;

export function DebugPanel({ widgetName, extraInfo }: { widgetName: string; extraInfo?: Record<string, DebugValue> }) {
  const [open, setOpen] = useState(false);
  const oa = (window as any).openai;

  if (!open) {
    return (
      <div style={{ padding: '4px 8px', textAlign: 'right' }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            all: 'unset', cursor: 'pointer', fontSize: 9, opacity: 0.3,
            fontFamily: 'monospace', color: 'inherit',
          }}
        >
          [debug]
        </button>
      </div>
    );
  }

  const info: Record<string, string> = {
    widget: widgetName,
    build: document.querySelector('[data-widget-build]')?.getAttribute('data-widget-build') || '?',
    theme: oa?.theme || '?',
    displayMode: oa?.displayMode || '?',
    maxHeight: String(oa?.maxHeight ?? '?'),
    locale: oa?.locale || '?',
    hasCallTool: typeof oa?.callTool === 'function' ? 'YES' : 'NO',
    hasSendFollowUp: typeof oa?.sendFollowUpMessage === 'function' ? 'YES' : 'NO',
    hasOpenExternal: typeof oa?.openExternal === 'function' ? 'YES' : 'NO',
    hasWidgetState: typeof oa?.setWidgetState === 'function' ? 'YES' : 'NO',
    hasNotifyHeight: typeof oa?.notifyIntrinsicHeight === 'function' ? 'YES' : 'NO',
    hasRequestModal: typeof oa?.requestModal === 'function' ? 'YES' : 'NO',
    hasUploadFile: typeof oa?.uploadFile === 'function' ? 'YES' : 'NO',
    hasRequestDisplayMode: typeof oa?.requestDisplayMode === 'function' ? 'YES' : 'NO',
    userAgent: oa?.userAgent ? JSON.stringify(oa.userAgent) : '?',
    toolInputKeys: oa?.toolInput ? Object.keys(oa.toolInput).join(', ') : '?',
    toolOutputType: oa?.toolOutput ? typeof oa.toolOutput : 'null',
    toolOutputKeys: oa?.toolOutput && typeof oa.toolOutput === 'object' ? Object.keys(oa.toolOutput).join(', ') : '?',
    isChatGptApp: String((window as any).__isChatGptApp ?? '?'),
  };

  if (extraInfo) {
    for (const [key, value] of Object.entries(extraInfo)) {
      info[key] = value == null ? String(value) : String(value);
    }
  }

  const text = Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('\n');

  return (
    <div style={{
      margin: '8px 0 0', padding: 10, borderRadius: 8,
      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
      fontFamily: 'monospace', fontSize: 10, lineHeight: 1.6,
      color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: '#facc15' }}>DEBUG — {widgetName}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { navigator.clipboard.writeText(text); }}
            style={{ all: 'unset', cursor: 'pointer', color: '#60a5fa', fontSize: 10 }}
          >
            [copy]
          </button>
          <button
            onClick={() => setOpen(false)}
            style={{ all: 'unset', cursor: 'pointer', color: '#fb7185', fontSize: 10 }}
          >
            [close]
          </button>
        </div>
      </div>
      {text}
    </div>
  );
}
