export type SearchResource = {
  name: string;
  url: string;
  method: string;
  price: string;
  network: string | null;
  description: string;
  category: string;
  qualityScore: number | null;
  verified: boolean;
  totalCalls: number;
  seller: string | null;
  authRequired?: boolean;
  authType?: string | null;
  authHint?: string | null;
};

export type SearchWidgetState = {
  selectedUrl?: string;
  detailOpen?: boolean;
  lastPromptedUrl?: string;
};
