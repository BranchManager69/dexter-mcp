import { useState } from 'react';
import type { HistoryRow } from './types';
import { formatBytes } from './types';

interface Props {
  /** Most recent passed run — same one feeding the Professor card. */
  run: HistoryRow | null;
  /** Resource-level fallbacks (used when run is missing or content-type differs). */
  contentType: string | null;
  sizeBytes: number | null;
}

/**
 * "What you'll get back" block. Switches on response_kind so each content
 * type renders sensibly:
 *   - json/text/html  → collapsible code block (collapsed by default)
 *   - image           → metadata badge ("PNG · 743 KB"); bytes aren't persisted
 *                       so the AI verdict from Professor Dexter does the
 *                       heavy lifting elsewhere
 *   - stream/binary   → metadata badge with kind label
 *   - unknown         → just the content-type line
 *
 * Truncation is a crime — we ship the full preview and let the user open it.
 */
export function ResponseShape({ run, contentType, sizeBytes }: Props) {
  const ct = run?.response_content_type || contentType;
  const size = run?.response_size_bytes ?? sizeBytes;
  const kind = run?.response_kind ?? inferKindFromCt(ct);
  const preview = run?.response_preview ?? null;

  if (!ct && !size && !preview) return null;

  return (
    <section className="dx-pricing__shape">
      <h2 className="dx-pricing__section-title">What you'll get</h2>
      <div className="dx-pricing__shape-meta">
        <span className="dx-pricing__shape-meta-kind">{labelForKind(kind, run)}</span>
        {typeof size === 'number' ? (
          <>
            <span className="dx-pricing__shape-meta-sep">·</span>
            <span className="dx-pricing__shape-meta-size">{formatBytes(size)}</span>
          </>
        ) : null}
      </div>
      {preview && shouldRenderPreview(kind) ? (
        <ResponsePreview kind={kind} preview={preview} />
      ) : null}
    </section>
  );
}

function inferKindFromCt(ct: string | null | undefined) {
  if (!ct) return 'unknown' as const;
  const lower = ct.toLowerCase();
  if (lower.includes('json')) return 'json' as const;
  if (lower.includes('image/')) return 'image' as const;
  if (lower.includes('html')) return 'html' as const;
  if (lower.includes('event-stream')) return 'stream' as const;
  if (lower.includes('text/')) return 'text' as const;
  if (lower.includes('octet-stream')) return 'binary' as const;
  return 'unknown' as const;
}

function labelForKind(kind: HistoryRow['response_kind'], run: HistoryRow | null): string {
  switch (kind) {
    case 'json':
      return 'JSON';
    case 'text':
      return 'Text';
    case 'html':
      return 'HTML';
    case 'image': {
      const fmt = run?.response_image_format;
      return fmt ? `${fmt} image` : 'Image';
    }
    case 'stream':
      return 'Streaming response';
    case 'binary':
      return 'Binary blob';
    case 'unknown':
    default:
      return 'Response';
  }
}

function shouldRenderPreview(kind: HistoryRow['response_kind']): boolean {
  // Image rows hold a placeholder string, not bytes — don't render those.
  // Binary rows are unrenderable in-line.
  return kind === 'json' || kind === 'text' || kind === 'html';
}

function ResponsePreview({ kind, preview }: { kind: HistoryRow['response_kind']; preview: string }) {
  const [open, setOpen] = useState(false);
  const text = kind === 'json' ? prettyJson(preview) : preview;
  return (
    <div className="dx-pricing__preview">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dx-pricing__preview-toggle"
        aria-expanded={open}
      >
        <span className="dx-pricing__preview-toggle-arrow" data-open={open ? '1' : '0'}>
          ▸
        </span>
        <span>{open ? 'Hide sample response' : 'View sample response'}</span>
      </button>
      {open ? (
        <pre className="dx-pricing__preview-body">
          <code>{text}</code>
        </pre>
      ) : null}
    </div>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
