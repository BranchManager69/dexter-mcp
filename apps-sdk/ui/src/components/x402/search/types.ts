export type SearchSeller = {
  payTo?: string | null;
  displayName: string | null;
  logoUrl?: string | null;
  twitterHandle?: string | null;
};

export type SearchChainOption = {
  network: string | null;
  asset?: string | null;
  priceAtomic?: string | null;
  priceUsdc?: number | null;
  priceLabel?: string | null;
};

export type SearchResource = {
  resourceId: string;
  name: string;
  url: string;
  method: string;
  price: string;
  priceAtomic?: string | null;
  priceUsdc?: number | null;
  priceAsset?: string | null;
  network: string | null;
  chains?: SearchChainOption[];
  description: string;
  category: string;
  qualityScore: number | null;
  verified: boolean;
  verificationStatus?: 'pass' | 'fail' | 'inconclusive' | 'skipped' | null;
  verificationNotes?: string | null;
  verificationFixInstructions?: string | null;
  lastVerifiedAt?: string | null;
  totalCalls: number;
  totalVolume?: string | null;
  totalVolumeUsdc?: number | null;
  iconUrl?: string | null;
  seller: string | null;
  sellerMeta: SearchSeller;
  sellerReputation?: number | null;
  authRequired?: boolean;
  authType?: string | null;
  authHint?: string | null;
  sessionCompatible?: boolean;
};

export type SearchWidgetState = {
  selectedUrl?: string;
  detailOpen?: boolean;
  searchQuery?: string;
};
