import { useState, useMemo } from 'react';

interface JsonViewerProps {
  data: unknown;
  title?: string;
  defaultExpanded?: boolean;
}

type JsonNodeType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

function getType(value: unknown): JsonNodeType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonNodeType;
}

const TYPE_COLORS: Record<JsonNodeType, string> = {
  string: 'text-[#e9967a]',
  number: 'text-[#b5cea8]',
  boolean: 'text-[#569cd6]',
  null: 'text-[#808080]',
  object: '',
  array: '',
};

function JsonNode({ keyName, value, depth = 0, last = true }: {
  keyName?: string;
  value: unknown;
  depth?: number;
  last?: boolean;
}) {
  const type = getType(value);
  const isExpandable = type === 'object' || type === 'array';
  const [expanded, setExpanded] = useState(depth < 2);

  if (!isExpandable) {
    let rendered: string;
    if (type === 'string') rendered = `"${String(value)}"`;
    else if (type === 'null') rendered = 'null';
    else rendered = String(value);

    return (
      <div className="flex" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyName !== undefined && (
          <span className="text-[#9cdcfe] flex-shrink-0">"{keyName}"<span className="text-tertiary">: </span></span>
        )}
        <span className={`${TYPE_COLORS[type]} break-all`}>{rendered}</span>
        {!last && <span className="text-tertiary">,</span>}
      </div>
    );
  }

  const entries = type === 'array'
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const bracketOpen = type === 'array' ? '[' : '{';
  const bracketClose = type === 'array' ? ']' : '}';
  const isEmpty = entries.length === 0;

  if (isEmpty) {
    return (
      <div className="flex" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyName !== undefined && (
          <span className="text-[#9cdcfe]">"{keyName}"<span className="text-tertiary">: </span></span>
        )}
        <span className="text-tertiary">{bracketOpen}{bracketClose}</span>
        {!last && <span className="text-tertiary">,</span>}
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center cursor-pointer hover:bg-white/5 rounded"
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-tertiary w-4 text-center text-2xs select-none flex-shrink-0">{expanded ? '▼' : '▶'}</span>
        {keyName !== undefined && (
          <span className="text-[#9cdcfe]">"{keyName}"<span className="text-tertiary">: </span></span>
        )}
        <span className="text-tertiary">{bracketOpen}</span>
        {!expanded && (
          <span className="text-tertiary ml-1">
            {entries.length} {type === 'array' ? 'items' : 'keys'} {bracketClose}
            {!last && ','}
          </span>
        )}
      </div>
      {expanded && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode
              key={k}
              keyName={type === 'array' ? undefined : k}
              value={v}
              depth={depth + 1}
              last={i === entries.length - 1}
            />
          ))}
          <div style={{ paddingLeft: `${depth * 16}px` }}>
            <span className="text-tertiary ml-4">{bracketClose}</span>
            {!last && <span className="text-tertiary">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

export function JsonViewer({ data, title = 'Response Payload', defaultExpanded = true }: JsonViewerProps) {
  const parsed = useMemo(() => {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return data; }
    }
    return data;
  }, [data]);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const isLong = jsonStr.length > 300;

  if (typeof parsed === 'string') {
    return (
      <div className="rounded-xl bg-surface-secondary border border-subtle overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-surface-secondary border-b border-subtle">
          <span className="text-xs text-tertiary uppercase font-semibold">{title}</span>
        </div>
        <pre className="px-3 py-2 text-xs font-mono text-secondary overflow-x-auto whitespace-pre-wrap break-all">{parsed}</pre>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-secondary border border-subtle overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-subtle">
        <span className="text-xs text-tertiary uppercase font-semibold">{title}</span>
        {isLong && (
          <button
            className="text-2xs text-primary hover:underline cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-2 py-2 text-xs font-mono leading-relaxed overflow-x-auto max-h-96 overflow-y-auto">
          <JsonNode value={parsed} />
        </div>
      )}
    </div>
  );
}
