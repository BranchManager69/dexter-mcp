import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import request from 'supertest';
import { Keypair } from '@solana/web3.js';

const managedWalletFindUnique = vi.fn();
const twitterLinksFindFirst = vi.fn();
const userProfilesFindMany = vi.fn();

vi.mock('../src/prisma.js', () => ({
  default: {
    managed_wallets: {
      findUnique: managedWalletFindUnique,
    },
    twitter_links: {
      findFirst: twitterLinksFindFirst,
    },
    user_profiles: {
      findMany: userProfilesFindMany,
    },
  },
}));

vi.mock('../src/utils/supabase.js', () => ({
  getSupabaseUserIdFromRequest: vi.fn(async () => 'test-user'),
}));

vi.mock('../src/payments/registerX402.js', () => ({
  registerX402Routes: () => {},
}));

vi.mock('../src/tasks/tokenConfigRefresh.js', () => ({
  startTokenConfigRefreshLoop: () => {},
}));

const listTokenBalancesMock = vi.fn();
const fetchTokenPricesUsdMock = vi.fn();
const sendTokenMock = vi.fn();

vi.mock('../src/solana/tradingService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/solana/tradingService.js')>(
    '../src/solana/tradingService.js',
  );
  return {
    ...actual,
    listTokenBalances: listTokenBalancesMock,
    fetchTokenPricesUsd: fetchTokenPricesUsdMock,
    sendToken: sendTokenMock,
  };
});

const DEXTER_MINT = process.env.DEXTER_TOKEN_MINT || 'EfPoo4wWgxKVToit7yX5VtXXBrhao4G8L7vrbKy6pump';
const SOURCE_WALLET = Keypair.generate().publicKey.toBase58();
const DESTINATION_WALLET = Keypair.generate().publicKey.toBase58();

describe('POST /api/solana/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managedWalletFindUnique.mockResolvedValue({
      public_key: SOURCE_WALLET,
      encrypted_private_key: '{}',
      assigned_supabase_user_id: 'test-user',
      status: 'assigned',
    });
    twitterLinksFindFirst.mockResolvedValue(null);
    userProfilesFindMany.mockResolvedValue([]);
    listTokenBalancesMock.mockReset();
    fetchTokenPricesUsdMock.mockReset();
    sendTokenMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires explicit confirmation when USD value meets or exceeds $50', async () => {
    listTokenBalancesMock.mockResolvedValue([
      {
        mint: DEXTER_MINT,
        ata: null,
        amountRaw: '100000000000',
        amountUi: 100000,
        decimals: 6,
        isNative: false,
      },
    ]);

    fetchTokenPricesUsdMock.mockResolvedValue(new Map([[DEXTER_MINT, 0.0008]]));

    const { app } = await import('../src/app.js');

    const response = await request(app)
      .post('/api/solana/send')
      .set('Content-Type', 'application/json')
      .send({
        walletAddress: SOURCE_WALLET,
        recipientType: 'wallet',
        recipientValue: DESTINATION_WALLET,
        mint: DEXTER_MINT,
        amountUi: '100000',
      });

    expect(response.status).toBe(200);
    expect(response.body?.ok).toBe(false);
    expect(response.body?.error).toBe('confirmation_required');
    expect(response.body?.transfer?.valueUsd).toBeGreaterThanOrEqual(50);
    expect(sendTokenMock).not.toHaveBeenCalled();
  });

  it('executes transfer immediately when below $50 threshold', async () => {
    listTokenBalancesMock.mockResolvedValue([
      {
        mint: DEXTER_MINT,
        ata: null,
        amountRaw: '80000000000',
        amountUi: 80000,
        decimals: 6,
        isNative: false,
      },
    ]);

    fetchTokenPricesUsdMock.mockResolvedValue(new Map([[DEXTER_MINT, 0.0005]]));

    sendTokenMock.mockResolvedValue({
      walletAddress: SOURCE_WALLET,
      destination: DESTINATION_WALLET,
      mint: DEXTER_MINT,
      amountRaw: '40000000000',
      amountUi: 40000,
      decimals: 6,
      memo: null,
      signature: 'mock-signature',
      solscanUrl: 'https://solscan.io/tx/mock-signature',
    });

    const { app } = await import('../src/app.js');

    const response = await request(app)
      .post('/api/solana/send')
      .set('Content-Type', 'application/json')
      .send({
        walletAddress: SOURCE_WALLET,
        recipientType: 'wallet',
        recipientValue: DESTINATION_WALLET,
        mint: DEXTER_MINT,
        amountUi: '40000',
      });

    expect(response.status).toBe(200);
    expect(response.body?.ok).toBe(true);
    expect(response.body?.result?.valueUsd).toBeCloseTo(20, 5);
    expect(response.body?.result?.signature).toBe('mock-signature');
    expect(sendTokenMock).toHaveBeenCalledTimes(1);
  });
});
