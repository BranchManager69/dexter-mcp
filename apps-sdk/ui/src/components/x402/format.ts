export function formatCalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function shortenHash(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

export function shortenAddress(addr: string): string {
  return shortenHash(addr, 6, 4);
}

export function formatUsdc(atomic: string | number, decimals = 6): string {
  const n = Number(atomic) / Math.pow(10, decimals);
  return `$${n.toFixed(n < 0.01 ? 4 : 2)}`;
}

export function getExplorerUrl(tx: string, network?: string): string {
  if (network?.includes('8453')) return `https://basescan.org/tx/${tx}`;
  if (network?.includes('137')) return `https://polygonscan.com/tx/${tx}`;
  if (network?.includes('42161')) return `https://arbiscan.io/tx/${tx}`;
  if (network?.includes('10') && network?.includes('eip155')) return `https://optimistic.etherscan.io/tx/${tx}`;
  return `https://solscan.io/tx/${tx}`;
}
