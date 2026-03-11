import type { SearchResource } from './types';

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const compactPath = `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    return compactPath.length > 72 ? `${compactPath.slice(0, 69)}...` : compactPath;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return shortenUrl(url);
  }
}

function looksLikeWalletFragment(label: string, payTo?: string | null): boolean {
  const trimmed = label.trim();
  if (!trimmed) return true;
  if (payTo && trimmed === payTo.slice(0, trimmed.length)) return true;
  if (/^(0x[a-fA-F0-9]{6,}|[1-9A-HJ-NP-Za-km-z]{8,})$/.test(trimmed) && !/\s/.test(trimmed)) return true;
  return false;
}

export function providerDisplayName(resource: SearchResource): string {
  const sellerName = resource.sellerMeta.displayName?.trim() || resource.seller?.trim() || '';
  if (sellerName && !looksLikeWalletFragment(sellerName, resource.sellerMeta.payTo)) {
    return sellerName;
  }
  return hostLabel(resource.url);
}

export function resourceIconUrl(resource: SearchResource): string {
  if (resource.iconUrl) return resource.iconUrl;
  try {
    const hostname = new URL(resource.url).hostname;
    return `https://dexter.cash/api/favicon?domain=${encodeURIComponent(hostname)}`;
  } catch {
    return resource.sellerMeta.logoUrl || '';
  }
}

export function scoreTone(score: number | null | undefined): 'good' | 'warn' | 'low' | 'none' {
  if (score == null || score <= 0) return 'none';
  if (score >= 80) return 'good';
  if (score >= 65) return 'warn';
  return 'low';
}
