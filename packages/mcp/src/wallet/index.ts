import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import bs58 from "bs58";
import { DATA_DIR, WALLET_FILE, SOLANA_RPC_URL } from "../config.js";

export interface WalletInfo {
  solanaPrivateKey: string;
  solanaAddress: string;
  evmPrivateKey?: string;
  evmAddress?: string;
  createdAt: string;
}

export interface LoadedWallet {
  info: WalletInfo;
  solanaKeypair: Keypair;
}

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export async function loadOrCreateWallet(): Promise<LoadedWallet | null> {
  // Env var override takes priority
  const envKey = process.env.DEXTER_PRIVATE_KEY || process.env.SOLANA_PRIVATE_KEY;
  if (envKey) {
    const keypair = keypairFromString(envKey);
    return {
      info: {
        solanaPrivateKey: bs58.encode(keypair.secretKey),
        solanaAddress: keypair.publicKey.toBase58(),
        createdAt: new Date().toISOString(),
      },
      solanaKeypair: keypair,
    };
  }

  if (existsSync(WALLET_FILE)) {
    try {
      const raw = readFileSync(WALLET_FILE, "utf-8");
      const data = JSON.parse(raw) as WalletInfo;
      if (!data.solanaPrivateKey) throw new Error("Missing solanaPrivateKey");
      const keypair = keypairFromString(data.solanaPrivateKey);
      if (keypair.secretKey.length !== 64) throw new Error("Invalid key length");
      return { info: data, solanaKeypair: keypair };
    } catch (err: any) {
      console.error(`[dexter-mcp] Corrupted wallet file: ${err.message}`);
      console.error(`[dexter-mcp] Backing up to ${WALLET_FILE}.bak and creating fresh wallet.`);
      try { copyFileSync(WALLET_FILE, WALLET_FILE + ".bak"); } catch {}
    }
  }

  // Generate new wallet
  const keypair = Keypair.generate();
  const info: WalletInfo = {
    solanaPrivateKey: bs58.encode(keypair.secretKey),
    solanaAddress: keypair.publicKey.toBase58(),
    createdAt: new Date().toISOString(),
  };

  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(WALLET_FILE, JSON.stringify(info, null, 2), { mode: 0o600 });

  console.error(`[dexter-mcp] New wallet created: ${info.solanaAddress}`);
  console.error(`[dexter-mcp] Saved to ${WALLET_FILE}`);
  console.error(`[dexter-mcp] Deposit USDC (Solana) to this address to start paying for x402 APIs.`);

  return { info, solanaKeypair: keypair };
}

function keypairFromString(key: string): Keypair {
  try {
    // Try base58
    return Keypair.fromSecretKey(bs58.decode(key));
  } catch {
    // Try JSON array
    try {
      const arr = JSON.parse(key);
      if (Array.isArray(arr)) {
        return Keypair.fromSecretKey(Uint8Array.from(arr));
      }
    } catch {}
    throw new Error("Invalid private key format. Expected base58 string or JSON byte array.");
  }
}

export async function getSolanaBalance(
  address: string,
  rpcUrl?: string,
): Promise<{ sol: number; usdc: number }> {
  try {
    const connection = new Connection(rpcUrl || SOLANA_RPC_URL, "confirmed");
    const pubkey = new PublicKey(address);

    const [solBalance, usdcBalance] = await Promise.all([
      connection.getBalance(pubkey).catch(() => 0),
      getUsdcBalance(connection, pubkey),
    ]);

    return { sol: solBalance / 1e9, usdc: usdcBalance };
  } catch (err: any) {
    console.error(`[dexter-mcp] RPC error fetching balance: ${err.message}`);
    return { sol: 0, usdc: 0 };
  }
}

async function getUsdcBalance(connection: Connection, owner: PublicKey): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(USDC_MINT, owner);
    const info = await connection.getTokenAccountBalance(ata);
    return Number(info.value.uiAmount ?? 0);
  } catch {
    return 0;
  }
}

export async function showWalletInfo(opts: { dev: boolean }): Promise<void> {
  const wallet = await loadOrCreateWallet();
  if (!wallet) {
    console.log(JSON.stringify({ error: "Failed to load wallet" }));
    process.exit(1);
  }

  const balance = await getSolanaBalance(wallet.info.solanaAddress);

  console.log(JSON.stringify({
    address: wallet.info.solanaAddress,
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    balances: {
      sol: balance.sol,
      usdc: balance.usdc,
    },
    walletFile: WALLET_FILE,
    tip: balance.usdc === 0
      ? `Deposit USDC (Solana) to ${wallet.info.solanaAddress} to start paying for x402 APIs.`
      : undefined,
  }, null, 2));
}
