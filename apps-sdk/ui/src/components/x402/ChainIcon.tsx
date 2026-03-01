const CHAIN_MAP: Record<string, { name: string; slug: string }> = {
  solana: { name: 'Solana', slug: 'solana' },
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { name: 'Solana', slug: 'solana' },
  base: { name: 'Base', slug: 'base' },
  'eip155:8453': { name: 'Base', slug: 'base' },
  polygon: { name: 'Polygon', slug: 'polygon' },
  'eip155:137': { name: 'Polygon', slug: 'polygon' },
  'eip155:42161': { name: 'Arbitrum', slug: 'arbitrum' },
  'eip155:10': { name: 'Optimism', slug: 'optimism' },
  'eip155:43114': { name: 'Avalanche', slug: 'avalanche' },
  'eip155:2046399126': { name: 'SKALE', slug: 'skale' },
};

export function getChain(network: string | null) {
  if (!network) return { name: '', slug: '' };
  return CHAIN_MAP[network] ?? { name: network, slug: 'default' };
}

export function ChainIcon({ network }: { network: string | null }) {
  const { slug } = getChain(network);
  if (!slug) return null;
  return <span className={`x4-chain-icon x4-chain-icon--${slug}`} aria-hidden="true" />;
}
