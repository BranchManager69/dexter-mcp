export type PortfolioWallet = {
  address?: string | null;
  public_key?: string | null;
  publicKey?: string | null;
  label?: string | null;
  is_default?: boolean | null;
  status?: string | null;
};

export type PortfolioPayload = {
  user?: { id?: string | null } | null;
  wallets?: PortfolioWallet[];
};

export type ResolveWalletPayload = {
  wallet_address?: string | null;
  source?: string | null;
  user_id?: string | null;
  detail?: string | null;
  bearer_source?: string | null;
  override_session?: string | null;
};

export type TokenLookupResult = {
  name?: string | null;
  symbol?: string | null;
  address?: string | null;
  mintAddress?: string | null;
  mint?: string | null;
  category?: string | null;
  tokenType?: string | null;
  decimals?: number | null;
  liquidityUsd?: number | null;
  fdvUsd?: number | null;
  priceUsd?: number | null;
  priceChange24hPct?: number | null;
  volume24hUsd?: number | null;
  logoUri?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
  pairUrl?: string | null;
  raw?: unknown;
};

export type TokenLookupPayload = {
  query?: string | null;
  limit?: number | null;
  results?: TokenLookupResult[];
};

export type SwapRequest = {
  inputMint?: string | null;
  outputMint?: string | null;
  amountUi?: number | string | null;
  walletAddress?: string | null;
  slippageBps?: number | null;
  mode?: string | null;
  desiredOutputUi?: number | string | null;
};

export type SwapQuote = {
  expectedOutputUi?: number | string | null;
  priceImpactPct?: number | null;
  networkFeeSol?: number | null;
  route?: string | null;
  expiresAt?: string | null;
  quoteId?: string | null;
  mode?: string | null;
  amountUi?: number | string | null;
  walletAddress?: string | null;
  inputMint?: string | null;
  outputMint?: string | null;
  desiredOutputUi?: number | string | null;
  slippageBps?: number | null;
  expired?: boolean | null;
};

export type SwapExecution = {
  swapId?: string | null;
  txSignature?: string | null;
  transactionSignature?: string | null;
  signature?: string | null;
  status?: string | null;
  priceImpactPct?: number | null;
  networkFeeSol?: number | null;
  route?: string | null;
  amountUi?: number | string | null;
  expectedOutputUi?: number | string | null;
  outputAmountUi?: number | string | null;
  inputMint?: string | null;
  outputMint?: string | null;
  walletAddress?: string | null;
  slippageBps?: number | null;
};

export type SwapPayload = {
  request?: SwapRequest;
  result?: SwapQuote | SwapExecution | null;
};

export type SolanaSendTransfer = {
  walletAddress?: string | null;
  destination?: string | null;
  recipient?: string | null;
  recipientHandle?: string | null;
  mint?: string | null;
  amountUi?: number | string | null;
  amountRaw?: string | null;
  decimals?: number | null;
  isNative?: boolean | null;
  priceUsd?: number | null;
  valueUsd?: number | null;
  memo?: string | null;
  signature?: string | null;
  solscanUrl?: string | null;
};

export type SolanaSendPayload = {
  ok?: boolean;
  error?: string | null;
  message?: string | null;
  thresholdUsd?: number | null;
  transfer?: SolanaSendTransfer | null;
  result?: SolanaSendTransfer | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Identity Types
// ─────────────────────────────────────────────────────────────────────────────

export type IdentityService = {
  name?: string | null;
  endpoint?: string | null;
  version?: string | null;
};

export type Identity = {
  id?: string | null;
  supabaseUserId?: string | null;
  managedWalletPublicKey?: string | null;
  chain?: string | null;
  agentRegistry?: string | null;
  agentId?: string | null;
  agentWallet?: string | null;
  agentUri?: string | null;
  agentUriHash?: string | null;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  services?: IdentityService[];
  status?: string | null;
  mintTxHash?: string | null;
  mintError?: string | null;
  gasSponsored?: boolean | null;
  gasCostNative?: string | null;
  gasCostUsd?: string | null;
  mintedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type IdentityStatusPayload = {
  hasIdentity?: boolean;
  hasBase?: boolean;
  hasSolana?: boolean;
  recommended?: string | null;
  identity?: Identity | null;
  identities?: Identity[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Reputation Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReputationFeedback = {
  id?: string | null;
  rating?: number | null;
  comment?: string | null;
  createdAt?: string | null;
  fromAgentId?: string | null;
};

export type ReputationPayload = {
  agentId?: string | null;
  chain?: string | null;
  score?: number | null;
  totalRatings?: number | null;
  averageRating?: number | null;
  recentFeedback?: ReputationFeedback[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Bundle Types
// ─────────────────────────────────────────────────────────────────────────────

export type BundleTool = {
  name?: string | null;
  description?: string | null;
};

export type BundleCurator = {
  userId?: string | null;
  name?: string | null;
};

export type Bundle = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  category?: string | null;
  tags?: string[];
  priceUsdc?: number | null;
  usesPerPurchase?: number | null;
  totalPurchases?: number | null;
  avgRating?: number | null;
  ratingCount?: number | null;
  isFeatured?: boolean | null;
  isVerified?: boolean | null;
  toolCount?: number | null;
  tools?: BundleTool[];
  curator?: BundleCurator | null;
};

export type BundlePayload = {
  ok?: boolean;
  bundle?: Bundle | null;
  bundles?: Bundle[];
  total?: number | null;
  categories?: string[];
  hasAccess?: boolean | null;
  remainingUses?: number | null;
};
