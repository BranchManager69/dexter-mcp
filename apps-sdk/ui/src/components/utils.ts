export function formatValue(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

export function abbreviateAddress(address: string | null | undefined, prefix = 4, suffix = 4): string {
  if (!address) return '—';
  const trimmed = address.trim();
  if (trimmed.length <= prefix + suffix + 3) return trimmed;
  return `${trimmed.slice(0, prefix)}…${trimmed.slice(-suffix)}`;
}

export function initialsFromLabel(label: string | null | undefined): string {
  if (!label) return '??';
  const parts = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return label.slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function formatTimestamp(timestamp: string | number | null | undefined): string {
  if (!timestamp) return 'Not supplied';
  try {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(String(timestamp));
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
}
