import { useState } from 'react';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function syntaxHighlight(json: string): string {
  const safe = escapeHtml(json);
  return safe.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'x4-json-number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'x4-json-key' : 'x4-json-string';
      } else if (/true|false/.test(match)) {
        cls = 'x4-json-bool';
      } else if (/null/.test(match)) {
        cls = 'x4-json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

interface JsonViewerProps {
  data: unknown;
  title?: string;
  defaultExpanded?: boolean;
}

export function JsonViewer({ data, title = 'Response Payload', defaultExpanded = true }: JsonViewerProps) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isLong = jsonStr.length > 500;
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="x4-json">
      <div className="x4-json__header">
        <span>{title}</span>
        {isLong && (
          <button className="x4-json__toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      {expanded && (
        <div
          className="x4-json__body"
          dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonStr) }}
        />
      )}
    </div>
  );
}
