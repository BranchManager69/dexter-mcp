/**
 * Per-widget event log buffer.
 *
 * Buttons (especially the ones whose behavior depends on the host
 * — Solana Pay deep links, openExternal HTTPS, callTool retries)
 * push events into this buffer with a timestamp. The DebugPanel
 * reads it as `extraInfo` so we can see exactly what fired and
 * what the host did with it WITHOUT needing pm2 logs (which don't
 * see widget-side events at all).
 *
 * Module-level state — survives across renders, persists per
 * widget mount. Cleared automatically when the widget unmounts
 * (page reload or new tool invocation).
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  ts: number;
  level: LogLevel;
  tag: string;
  detail?: string;
}

const buffer: LogEntry[] = [];
const MAX_ENTRIES = 24;

export function logWidgetEvent(level: LogLevel, tag: string, detail?: unknown) {
  let detailStr: string | undefined;
  if (detail !== undefined) {
    if (typeof detail === 'string') {
      detailStr = detail.length > 200 ? detail.slice(0, 197) + '…' : detail;
    } else if (detail instanceof Error) {
      detailStr = `${detail.name}: ${detail.message}`;
    } else {
      try { detailStr = JSON.stringify(detail).slice(0, 200); }
      catch { detailStr = String(detail); }
    }
  }
  buffer.push({ ts: Date.now(), level, tag, detail: detailStr });
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  // Mirror to console so even without the debug panel we can see
  // events when remote-inspecting the iframe.
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[receipt:${tag}]`, detail ?? '');
}

/**
 * Snapshot of the buffer formatted for DebugPanel.extraInfo.
 * Each entry becomes a numbered key like `evt[3]` so they sort
 * naturally in the debug output.
 */
export function getWidgetLogForDebug(): Record<string, string> {
  const out: Record<string, string> = {};
  buffer.forEach((entry, i) => {
    const t = new Date(entry.ts).toISOString().slice(11, 23); // HH:MM:SS.sss
    const detail = entry.detail ? ` ${entry.detail}` : '';
    out[`evt[${i.toString().padStart(2, '0')}]`] = `${t} ${entry.level} ${entry.tag}${detail}`;
  });
  return out;
}
