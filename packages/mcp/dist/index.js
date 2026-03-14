#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config.ts
import { homedir } from "os";
import { join } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname as pathDirname } from "path";
function getApiBase(dev) {
  return dev ? DEXTER_API_DEV : DEXTER_API_PROD;
}
function loadVersion() {
  try {
    const here = pathDirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}
var DATA_DIR, WALLET_FILE, DEXTER_API_PROD, DEXTER_API_DEV, SOLANA_RPC_URL, EVM_RPC_URLS, EVM_USDC_ADDRESSES, CHAIN_NAMES, SUPPORTED_CHAIN_LABELS, MARKETPLACE_PATH, VERSION;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    DATA_DIR = join(homedir(), ".dexterai-mcp");
    WALLET_FILE = join(DATA_DIR, "wallet.json");
    DEXTER_API_PROD = process.env.DEXTER_API_URL || "https://x402.dexter.cash";
    DEXTER_API_DEV = "http://127.0.0.1:3030";
    SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.dexter.cash/api/solana/rpc";
    EVM_RPC_URLS = {
      "eip155:8453": process.env.BASE_RPC_URL || "https://mainnet.base.org",
      "eip155:137": process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      "eip155:42161": process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      "eip155:10": process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      "eip155:43114": process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc"
    };
    EVM_USDC_ADDRESSES = {
      "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "eip155:137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      "eip155:42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "eip155:10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      "eip155:43114": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
    };
    CHAIN_NAMES = {
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": { name: "Solana", family: "svm", tier: "first" },
      "eip155:8453": { name: "Base", family: "evm", tier: "first" },
      "eip155:137": { name: "Polygon", family: "evm", tier: "second" },
      "eip155:42161": { name: "Arbitrum", family: "evm", tier: "second" },
      "eip155:10": { name: "Optimism", family: "evm", tier: "second" },
      "eip155:43114": { name: "Avalanche", family: "evm", tier: "second" }
    };
    SUPPORTED_CHAIN_LABELS = [
      "Solana",
      "Base",
      "Polygon",
      "Arbitrum",
      "Optimism",
      "Avalanche"
    ];
    MARKETPLACE_PATH = "/api/facilitator/marketplace/resources";
    VERSION = loadVersion();
  }
});

// src/widget-meta.ts
function widgetMeta(templateUri, invoking, invoked, description) {
  return {
    "openai/outputTemplate": templateUri,
    "openai/resultCanProduceWidget": true,
    "openai/widgetAccessible": true,
    "openai/widgetDomain": WIDGET_DOMAIN,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": WIDGET_CSP,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
    "openai/widgetDescription": description
  };
}
var WIDGET_DOMAIN, WIDGET_CSP, SEARCH_META, FETCH_META, CHECK_META, WALLET_META;
var init_widget_meta = __esm({
  "src/widget-meta.ts"() {
    "use strict";
    WIDGET_DOMAIN = "https://dexter.cash";
    WIDGET_CSP = {
      resource_domains: [
        "https://cdn.dexscreener.com",
        "https://raw.githubusercontent.com",
        "https://metadata.jup.ag"
      ]
    };
    SEARCH_META = widgetMeta(
      "ui://dexter/x402-marketplace-search-v2",
      "Searching marketplace\u2026",
      "Results ready",
      "Shows paid API search results as interactive cards with quality rings, prices, and fetch buttons."
    );
    FETCH_META = widgetMeta(
      "ui://dexter/x402-fetch-result",
      "Calling API\u2026",
      "Response received",
      "Shows API response data with payment receipt, transaction link, and settlement status."
    );
    CHECK_META = widgetMeta(
      "ui://dexter/x402-pricing",
      "Checking pricing\u2026",
      "Pricing loaded",
      "Shows endpoint pricing per blockchain with payment amounts and a pay button."
    );
    WALLET_META = widgetMeta(
      "ui://dexter/x402-wallet",
      "Loading wallet\u2026",
      "Wallet loaded",
      "Shows wallet address with copy button, USDC/SOL balances, and deposit QR code."
    );
  }
});

// src/tools/search.ts
var search_exports = {};
__export(search_exports, {
  cliSearch: () => cliSearch,
  registerSearchTool: () => registerSearchTool
});
import { z } from "zod";
function formatResource(r) {
  return {
    name: r.displayName || r.resourceUrl,
    url: r.resourceUrl,
    method: r.method || "GET",
    price: r.priceLabel || (r.priceUsdc != null ? `$${r.priceUsdc.toFixed(2)}` : "free"),
    network: r.priceNetwork || null,
    description: r.description || "",
    category: r.category || "uncategorized",
    qualityScore: r.qualityScore ?? null,
    verified: r.verificationStatus === "pass",
    totalCalls: r.totalSettlements ?? 0,
    seller: r.seller?.displayName || null,
    sellerReputation: r.reputationScore ?? null,
    authRequired: Boolean(r.authRequired),
    authType: r.authType ?? null,
    authHint: r.authHint ?? null
  };
}
async function searchMarketplace(params, opts) {
  const qs = new URLSearchParams();
  if (params.query) qs.set("search", params.query);
  if (params.category) qs.set("category", params.category);
  if (params.network) qs.set("network", params.network);
  if (params.maxPriceUsdc != null) qs.set("maxPrice", String(params.maxPriceUsdc));
  if (params.verifiedOnly) qs.set("verified", "true");
  qs.set("sort", params.sort || "marketplace");
  qs.set("limit", String(Math.min(params.limit || 20, 50)));
  const url = `${getApiBase(opts.dev)}${MARKETPLACE_PATH}?${qs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    throw new Error(`Marketplace returned ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  return {
    resources: (data.resources || []).map(formatResource),
    total: data.resources?.length || 0
  };
}
function registerSearchTool(server, opts) {
  server.tool(
    "x402_search",
    "Search the Dexter x402 marketplace for paid API resources. Returns services with pricing, quality scores, and verification status. Use this to discover APIs an agent can pay for and call with x402_fetch.",
    {
      query: z.string().optional().describe("Search term, e.g. 'token analysis', 'image generation'"),
      category: z.string().optional().describe("Filter by category"),
      network: z.string().optional().describe("Filter by payment network: 'solana', 'base', 'polygon'"),
      maxPriceUsdc: z.number().optional().describe("Maximum price per call in USDC"),
      verifiedOnly: z.boolean().optional().describe("Only return verified endpoints"),
      sort: z.enum(["relevance", "quality_score", "settlements", "volume", "recent", "marketplace"]).optional().describe("Sort order (default: marketplace)"),
      limit: z.number().optional().default(20).describe("Max results (1-50)")
    },
    async (args) => {
      try {
        const result = await searchMarketplace(args, opts);
        const data = {
          success: true,
          count: result.total,
          resources: result.resources,
          tip: "Use x402_fetch to call any of these endpoints."
        };
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          _meta: SEARCH_META
        };
      } catch (err) {
        const payload = { error: err.message || "search_failed", success: false, count: 0, resources: [] };
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
          _meta: SEARCH_META,
          isError: true
        };
      }
    }
  );
}
async function cliSearch(query, opts) {
  try {
    const result = await searchMarketplace({ query }, opts);
    console.log(JSON.stringify({ success: true, count: result.total, resources: result.resources }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }, null, 2));
    process.exit(1);
  }
}
var init_search = __esm({
  "src/tools/search.ts"() {
    "use strict";
    init_config();
    init_widget_meta();
  }
});

// src/wallet/index.ts
var wallet_exports = {};
__export(wallet_exports, {
  getAllBalances: () => getAllBalances,
  getEvmUsdcBalance: () => getEvmUsdcBalance,
  getSolanaBalance: () => getSolanaBalance,
  loadOrCreateWallet: () => loadOrCreateWallet,
  saveWalletInfo: () => saveWalletInfo,
  showWalletInfo: () => showWalletInfo
});
import { existsSync, readFileSync as readFileSync2, writeFileSync, mkdirSync, copyFileSync } from "fs";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, erc20Abi } from "viem";
import { base, polygon, arbitrum, optimism, avalanche } from "viem/chains";
import bs58 from "bs58";
function saveWalletInfo(info) {
  persistWalletFile(info);
}
function generateEvmWallet() {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return { evmPrivateKey: pk, evmAddress: account.address };
}
function persistWalletFile(info) {
  mkdirSync(DATA_DIR, { recursive: true, mode: 448 });
  writeFileSync(WALLET_FILE, JSON.stringify(info, null, 2), { mode: 384 });
}
function buildLoadedWallet(info, status = "existing") {
  return {
    info,
    solanaKeypair: info.solanaPrivateKey ? keypairFromString(info.solanaPrivateKey) : void 0,
    status
  };
}
async function loadOrCreateWallet(opts = {}) {
  const quiet = opts.quiet === true;
  const envKey = process.env.DEXTER_PRIVATE_KEY || process.env.SOLANA_PRIVATE_KEY;
  const envEvmKey = process.env.EVM_PRIVATE_KEY;
  if (envKey || envEvmKey) {
    const info2 = {
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (envKey) {
      const keypair2 = keypairFromString(envKey);
      info2.solanaPrivateKey = bs58.encode(keypair2.secretKey);
      info2.solanaAddress = keypair2.publicKey.toBase58();
    }
    if (envEvmKey) {
      const account = privateKeyToAccount(envEvmKey);
      info2.evmPrivateKey = envEvmKey;
      info2.evmAddress = account.address;
    }
    return buildLoadedWallet(info2, "env");
  }
  if (existsSync(WALLET_FILE)) {
    try {
      const raw = readFileSync2(WALLET_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (!data.solanaPrivateKey && !data.evmPrivateKey) {
        throw new Error("Missing wallet private keys");
      }
      if (!data.evmPrivateKey) {
        const evm2 = generateEvmWallet();
        data.evmPrivateKey = evm2.evmPrivateKey;
        data.evmAddress = evm2.evmAddress;
        persistWalletFile(data);
        if (!quiet) {
          console.error(`[opendexter] Added EVM wallet to existing file: ${evm2.evmAddress}`);
        }
        return buildLoadedWallet(data, "migrated");
      }
      return buildLoadedWallet(data, "existing");
    } catch (err) {
      if (!quiet) {
        console.error(`[opendexter] Corrupted wallet file: ${err.message}`);
        console.error(`[opendexter] Backing up to ${WALLET_FILE}.bak and creating fresh wallet.`);
      }
      try {
        copyFileSync(WALLET_FILE, WALLET_FILE + ".bak");
      } catch {
      }
    }
  }
  const evm = generateEvmWallet();
  const keypair = Keypair.generate();
  const info = {
    solanaPrivateKey: bs58.encode(keypair.secretKey),
    solanaAddress: keypair.publicKey.toBase58(),
    evmPrivateKey: evm.evmPrivateKey,
    evmAddress: evm.evmAddress,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  persistWalletFile(info);
  if (!quiet) {
    console.error(`[opendexter] New dual wallet created:`);
    console.error(`[opendexter]   Solana: ${info.solanaAddress}`);
    console.error(`[opendexter]   EVM:    ${evm.evmAddress}`);
    console.error(`[opendexter] Saved to ${WALLET_FILE}`);
    console.error(`[opendexter] Tip: Run \`opendexter wallet --vanity\` to regenerate with a branded dex/0x402 prefix.`);
    console.error(`[opendexter] Deposit USDC on Solana or any supported EVM chain to start paying for x402 APIs.`);
  }
  return buildLoadedWallet(info, "created");
}
function keypairFromString(key) {
  try {
    return Keypair.fromSecretKey(bs58.decode(key));
  } catch {
    try {
      const arr = JSON.parse(key);
      if (Array.isArray(arr)) {
        return Keypair.fromSecretKey(Uint8Array.from(arr));
      }
    } catch {
    }
    throw new Error("Invalid private key format. Expected base58 string or JSON byte array.");
  }
}
async function getSolanaBalance(address, rpcUrl) {
  try {
    const connection = new Connection(rpcUrl || SOLANA_RPC_URL, "confirmed");
    const pubkey = new PublicKey(address);
    const [solBalance, usdcBalance] = await Promise.all([
      connection.getBalance(pubkey).catch(() => 0),
      getUsdcBalance(connection, pubkey)
    ]);
    return { sol: solBalance / 1e9, usdc: usdcBalance };
  } catch (err) {
    console.error(`[dexter-mcp] RPC error fetching balance: ${err.message}`);
    return { sol: 0, usdc: 0 };
  }
}
async function getUsdcBalance(connection, owner) {
  try {
    const ata = await getAssociatedTokenAddress(USDC_MINT, owner);
    const info = await connection.getTokenAccountBalance(ata);
    return Number(info.value.uiAmount ?? 0);
  } catch {
    return 0;
  }
}
async function getEvmUsdcBalance(address, chainId) {
  const viemChain = VIEM_CHAINS[chainId];
  const usdcAddress = EVM_USDC_ADDRESSES[chainId];
  if (!viemChain || !usdcAddress) return 0;
  try {
    const client = createPublicClient({
      chain: viemChain,
      transport: http(EVM_RPC_URLS[chainId])
    });
    const raw = await client.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address]
    });
    return Number(raw) / 1e6;
  } catch {
    return 0;
  }
}
async function getAllBalances(wallet) {
  const chains = {};
  const solPromise = wallet.solanaAddress ? getSolanaBalance(wallet.solanaAddress).then((b) => {
    chains["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"] = { name: "Solana", usdc: b.usdc };
  }) : Promise.resolve();
  const evmPromises = wallet.evmAddress ? Object.entries(VIEM_CHAINS).map(async ([chainId]) => {
    const usdc = await getEvmUsdcBalance(wallet.evmAddress, chainId);
    const meta = CHAIN_NAMES[chainId];
    chains[chainId] = { name: meta?.name || chainId, usdc };
  }) : [];
  await Promise.all([solPromise, ...evmPromises]);
  const totalUsdc = Object.values(chains).reduce((sum, c) => sum + c.usdc, 0);
  return { totalUsdc, chains };
}
async function showWalletInfo(opts) {
  const wallet = await loadOrCreateWallet();
  if (!wallet) {
    console.log(JSON.stringify({ error: "Failed to load wallet" }));
    process.exit(1);
  }
  const { totalUsdc, chains } = await getAllBalances(wallet.info);
  const result = {
    address: wallet.info.solanaAddress || wallet.info.evmAddress || null,
    solanaAddress: wallet.info.solanaAddress || null,
    evmAddress: wallet.info.evmAddress || null,
    network: "multichain",
    chainBalances: Object.fromEntries(
      Object.entries(chains).map(([caip2, data]) => [
        caip2,
        {
          available: String(Math.round(data.usdc * 1e6)),
          name: data.name,
          tier: caip2 === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" || caip2 === "eip155:8453" ? "first" : "second"
        }
      ])
    ),
    balances: {
      usdc: totalUsdc,
      fundedAtomic: String(Math.round(totalUsdc * 1e6)),
      spentAtomic: "0",
      availableAtomic: String(Math.round(totalUsdc * 1e6))
    },
    supportedNetworks: Object.keys(chains).length > 0 ? Object.keys(chains).map((caip2) => CHAIN_NAMES[caip2]?.name?.toLowerCase() || caip2) : ["solana", "base", "polygon", "arbitrum", "optimism", "avalanche"],
    walletFile: WALLET_FILE
  };
  if (totalUsdc === 0) {
    result.tip = `Deposit USDC to ${wallet.info.solanaAddress || "your Solana wallet"}${wallet.info.evmAddress ? ` or ${wallet.info.evmAddress}` : ""} to start paying for x402 APIs.`;
  }
  console.log(JSON.stringify(result, null, 2));
}
var USDC_MINT, VIEM_CHAINS;
var init_wallet = __esm({
  "src/wallet/index.ts"() {
    "use strict";
    init_config();
    USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    VIEM_CHAINS = {
      "eip155:8453": base,
      "eip155:137": polygon,
      "eip155:42161": arbitrum,
      "eip155:10": optimism,
      "eip155:43114": avalanche
    };
  }
});

// src/settings.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "fs";
import { join as join2 } from "path";
function loadSettings() {
  if (!existsSync2(SETTINGS_FILE)) {
    return { maxAmountUsdc: DEFAULT_MAX_AMOUNT_USDC };
  }
  try {
    const raw = JSON.parse(readFileSync3(SETTINGS_FILE, "utf-8"));
    const maxAmountUsdc = typeof raw.maxAmountUsdc === "number" && raw.maxAmountUsdc > 0 ? raw.maxAmountUsdc : DEFAULT_MAX_AMOUNT_USDC;
    return { maxAmountUsdc };
  } catch {
    return { maxAmountUsdc: DEFAULT_MAX_AMOUNT_USDC };
  }
}
function saveSettings(next) {
  const current = loadSettings();
  const merged = {
    maxAmountUsdc: typeof next.maxAmountUsdc === "number" && next.maxAmountUsdc > 0 ? next.maxAmountUsdc : current.maxAmountUsdc
  };
  mkdirSync2(DATA_DIR, { recursive: true, mode: 448 });
  writeFileSync2(SETTINGS_FILE, JSON.stringify(merged, null, 2) + "\n", { mode: 384 });
  return merged;
}
var SETTINGS_FILE, DEFAULT_MAX_AMOUNT_USDC;
var init_settings = __esm({
  "src/settings.ts"() {
    "use strict";
    init_config();
    SETTINGS_FILE = join2(DATA_DIR, "settings.json");
    DEFAULT_MAX_AMOUNT_USDC = 5;
  }
});

// src/tools/fetch.ts
var fetch_exports = {};
__export(fetch_exports, {
  cliFetch: () => cliFetch,
  registerFetchTool: () => registerFetchTool
});
import { z as z2 } from "zod";
function extractPriceUsdc(accept) {
  const amount = Number(accept.amount || 0);
  const extra = accept.extra && typeof accept.extra === "object" ? accept.extra : null;
  const decimals = Number(extra?.decimals ?? 6);
  if (!Number.isFinite(amount) || !Number.isFinite(decimals)) return null;
  return amount / Math.pow(10, decimals);
}
async function getAvailableUsdcForNetwork(wallet, network) {
  if (network.startsWith("solana:") && wallet.info.solanaAddress) {
    const { usdc } = await getSolanaBalance(wallet.info.solanaAddress);
    return usdc;
  }
  if (network.startsWith("eip155:") && wallet.info.evmAddress) {
    return await getEvmUsdcBalance(wallet.info.evmAddress, network);
  }
  return 0;
}
async function evaluatePaymentRequirements(wallet, requirements, maxAmountUsdc) {
  const accepts = Array.isArray(requirements?.accepts) ? requirements.accepts : [];
  if (accepts.length === 0) return { ok: true };
  const settings = loadSettings();
  const effectiveMaxAmount = maxAmountUsdc ?? settings.maxAmountUsdc;
  const evaluated = await Promise.all(
    accepts.map(async (accept) => {
      const network = String(accept.network || "");
      const priceUsdc = extractPriceUsdc(accept);
      const availableUsdc = network ? await getAvailableUsdcForNetwork(wallet, network) : 0;
      return { network, priceUsdc, availableUsdc };
    })
  );
  const withinPolicy = evaluated.filter((row) => row.priceUsdc != null && row.priceUsdc <= effectiveMaxAmount);
  if (withinPolicy.length === 0) {
    const prices = evaluated.filter((row) => row.priceUsdc != null).map((row) => `$${row.priceUsdc.toFixed(2)} on ${row.network}`).join(", ");
    return {
      ok: false,
      error: `Payment policy blocked this call. Available options: ${prices}. Current maxAmountUsdc is $${effectiveMaxAmount.toFixed(2)}. Use x402_settings to raise it.`
    };
  }
  const funded = withinPolicy.filter((row) => row.priceUsdc != null && row.availableUsdc >= row.priceUsdc);
  if (funded.length === 0) {
    const balances = withinPolicy.map((row) => `${row.network}: have $${row.availableUsdc.toFixed(2)}, need $${row.priceUsdc.toFixed(2)}`).join("; ");
    return {
      ok: false,
      error: `Insufficient balance for this call. ${balances}`
    };
  }
  return { ok: true };
}
async function parseResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    try {
      return await res.json();
    } catch {
      return await res.text();
    }
  }
  return await res.text();
}
function extractSettlement(res) {
  const header = res.headers.get("payment-response") || res.headers.get("PAYMENT-RESPONSE");
  if (!header) return null;
  try {
    return JSON.parse(atob(header));
  } catch {
    try {
      return JSON.parse(header);
    } catch {
      return null;
    }
  }
}
function parse402(body) {
  const obj = body;
  if (!obj?.accepts || !Array.isArray(obj.accepts)) return { requirements: null, firstAccept: null };
  return {
    requirements: { accepts: obj.accepts, x402Version: obj.x402Version ?? 2, resource: obj.resource },
    firstAccept: obj.accepts[0] || null
  };
}
async function x402Fetch(params, wallet, opts) {
  const requestHeaders = {
    "Content-Type": "application/json",
    ...params.headers || {}
  };
  const fetchOpts = {
    method: params.method || "GET",
    headers: requestHeaders
  };
  if (params.body && params.method !== "GET") {
    fetchOpts.body = params.body;
  }
  const probeRes = await fetch(params.url, { ...fetchOpts, signal: AbortSignal.timeout(15e3) });
  if (probeRes.status !== 402) {
    return { status: probeRes.status, data: await parseResponse(probeRes) };
  }
  let body402 = null;
  try {
    body402 = await probeRes.json();
  } catch {
    try {
      body402 = await probeRes.text();
    } catch {
    }
  }
  const { requirements, firstAccept } = parse402(body402);
  if (wallet) {
    try {
      const policyCheck = await evaluatePaymentRequirements(wallet, requirements, opts.maxAmountUsdc);
      if (!policyCheck.ok) {
        return { status: 402, error: policyCheck.error, requirements };
      }
      const { wrapFetch } = await import("@dexterai/x402/client");
      const x402FetchFn = wrapFetch(fetch, {
        walletPrivateKey: wallet.info.solanaPrivateKey,
        evmPrivateKey: wallet.info.evmPrivateKey
      });
      const paidRes = await x402FetchFn(params.url, fetchOpts);
      const data = await parseResponse(paidRes);
      const settlement = extractSettlement(paidRes);
      return {
        status: paidRes.status,
        data,
        payment: settlement ? { settled: true, details: settlement } : { settled: false }
      };
    } catch (err) {
      return { status: 402, error: `Payment failed: ${err.message}`, requirements };
    }
  }
  return {
    status: 402,
    message: "Payment required. Configure DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (Base/Polygon/etc) for automatic settlement, or provide payment-signature manually.",
    requirements
  };
}
function registerFetchTool(server, wallet, opts) {
  const hasWallet = wallet !== null;
  const description = hasWallet ? "Call any x402-protected API with automatic USDC payment across Solana, Base, Polygon, Arbitrum, Optimism, and Avalanche. Signs and pays using your local wallet. Returns the API response directly." : "Call any x402-protected API. Returns payment requirements. Configure DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (EVM chains) to enable automatic payment.";
  const inputSchema = {
    url: z2.string().url().describe("The x402 resource URL to call"),
    method: z2.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method"),
    body: z2.string().optional().describe("JSON request body for POST/PUT"),
    maxAmountUsdc: z2.number().positive().optional().describe("Optional per-call spend cap override in USDC.")
  };
  const runFetch = async (args) => {
    try {
      const result = await x402Fetch(
        { url: args.url, method: args.method, body: args.body },
        wallet,
        { ...opts, maxAmountUsdc: args.maxAmountUsdc }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        _meta: FETCH_META
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
        isError: true
      };
    }
  };
  server.tool(
    "x402_fetch",
    description,
    inputSchema,
    runFetch
  );
  server.tool(
    "x402_pay",
    "Alias of x402_fetch for clients that want an explicit payment verb. Uses the same local-wallet x402 payment flow and returns the same settlement/result payload.",
    inputSchema,
    runFetch
  );
}
async function cliFetch(url, opts) {
  try {
    const { loadOrCreateWallet: loadOrCreateWallet2 } = await Promise.resolve().then(() => (init_wallet(), wallet_exports));
    const wallet = await loadOrCreateWallet2();
    const result = await x402Fetch(
      { url, method: opts.method, body: opts.body },
      wallet,
      opts
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const msg = err.cause?.code === "ENOTFOUND" ? `Could not reach ${url} \u2014 DNS lookup failed` : err.name === "TimeoutError" ? `Request to ${url} timed out` : err.message || String(err);
    console.log(JSON.stringify({ error: msg }, null, 2));
    process.exit(1);
  }
}
var init_fetch = __esm({
  "src/tools/fetch.ts"() {
    "use strict";
    init_wallet();
    init_widget_meta();
    init_settings();
  }
});

// src/tools/check.ts
var check_exports = {};
__export(check_exports, {
  cliCheck: () => cliCheck,
  registerCheckTool: () => registerCheckTool
});
import { z as z3 } from "zod";
function parsePaymentRequiredHeader(headerValue) {
  if (!headerValue) return null;
  const candidates = [headerValue];
  try {
    candidates.push(Buffer.from(headerValue, "base64").toString("utf-8"));
  } catch {
  }
  try {
    const normalized = headerValue.replace(/-/g, "+").replace(/_/g, "/");
    candidates.push(Buffer.from(normalized, "base64").toString("utf-8"));
  } catch {
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
    }
  }
  return null;
}
async function checkEndpoint(url, method) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method !== "GET" ? "{}" : void 0,
    signal: AbortSignal.timeout(15e3)
  });
  if (res.status !== 402) {
    if (res.status === 401 || res.status === 403) {
      const bodyText = await res.text().catch(() => "");
      return {
        error: true,
        statusCode: res.status,
        authRequired: true,
        message: bodyText || "Provider authentication required before x402 payment flow."
      };
    }
    if (res.status >= 500) {
      return { error: true, statusCode: res.status, message: "Server error" };
    }
    if (res.status >= 400) {
      return { error: true, statusCode: res.status, message: `Client error: ${res.status}` };
    }
    return { requiresPayment: false, statusCode: res.status, free: true };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
  }
  const headerParsed = parsePaymentRequiredHeader(
    res.headers.get("PAYMENT-REQUIRED") || res.headers.get("payment-required")
  );
  const source = headerParsed && typeof headerParsed === "object" ? headerParsed : body;
  const accepts = body?.accepts;
  const acceptsFromHeader = source?.accepts;
  const effectiveAccepts = accepts?.length ? accepts : acceptsFromHeader;
  if (!effectiveAccepts?.length) {
    return {
      requiresPayment: true,
      statusCode: 402,
      error: "No payment options found in 402 response"
    };
  }
  const paymentOptions = effectiveAccepts.map((a) => {
    const amount = Number(a.amount || a.maxAmountRequired || 0);
    const decimals = Number(a.extra && typeof a.extra === "object" && "decimals" in a.extra ? a.extra.decimals : 6);
    return {
      price: amount / Math.pow(10, decimals),
      priceFormatted: `$${(amount / Math.pow(10, decimals)).toFixed(decimals > 2 ? 4 : 2)}`,
      network: a.network,
      scheme: a.scheme,
      asset: a.asset,
      payTo: a.payTo
    };
  });
  return {
    requiresPayment: true,
    statusCode: 402,
    x402Version: source?.x402Version ?? 2,
    paymentOptions,
    resource: source?.resource
  };
}
function registerCheckTool(server, opts) {
  server.tool(
    "x402_check",
    "Check if an endpoint requires x402 payment and see its pricing. Does NOT make a payment \u2014 just probes for requirements.",
    {
      url: z3.string().url().describe("The URL to check"),
      method: z3.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method to probe with")
    },
    async (args) => {
      try {
        const result = await checkEndpoint(args.url, args.method);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          _meta: CHECK_META
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
          isError: true
        };
      }
    }
  );
}
async function cliCheck(url, opts) {
  try {
    const result = await checkEndpoint(url, opts.method);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }, null, 2));
    process.exit(1);
  }
}
var init_check = __esm({
  "src/tools/check.ts"() {
    "use strict";
    init_widget_meta();
  }
});

// src/tools/settings.ts
var settings_exports = {};
__export(settings_exports, {
  cliSettings: () => cliSettings,
  registerSettingsTool: () => registerSettingsTool
});
import { z as z4 } from "zod";
function registerSettingsTool(server) {
  server.tool(
    "x402_settings",
    "Read or update OpenDexter spending policy. Use this to inspect or change the default max amount the agent is allowed to spend on a single API call.",
    {
      maxAmountUsdc: z4.number().positive().optional().describe("Optional new per-call max spend in USDC.")
    },
    async (args) => {
      const settings = args.maxAmountUsdc != null ? saveSettings({ maxAmountUsdc: args.maxAmountUsdc }) : loadSettings();
      const payload = {
        settings,
        settingsFile: SETTINGS_FILE,
        tip: "x402_fetch will reject requests above maxAmountUsdc unless you raise it here."
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload
      };
    }
  );
}
async function cliSettings(opts) {
  const settings = opts.maxAmountUsdc != null ? saveSettings({ maxAmountUsdc: opts.maxAmountUsdc }) : loadSettings();
  console.log(
    JSON.stringify(
      {
        settings,
        settingsFile: SETTINGS_FILE
      },
      null,
      2
    )
  );
}
var init_settings2 = __esm({
  "src/tools/settings.ts"() {
    "use strict";
    init_settings();
  }
});

// src/tools/wallet-tool.ts
function registerWalletTool(server, wallet, opts) {
  server.tool(
    "x402_wallet",
    "Show wallet addresses (Solana + EVM), USDC balances across all chains, and deposit instructions. The wallet is used to automatically pay for x402 API calls on Solana, Base, Polygon, Arbitrum, Optimism, and Avalanche.",
    {},
    async () => {
      if (!wallet) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "No wallet configured",
                tip: "Set DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (EVM) env var, or run `npx @dexterai/opendexter wallet` to create one."
              }, null, 2)
            }
          ]
        };
      }
      try {
        const { totalUsdc, chains } = await getAllBalances(wallet.info);
        const chainBalances = Object.fromEntries(
          Object.entries(chains).map(([caip2, chain]) => [
            caip2,
            {
              available: String(Math.round(chain.usdc * 1e6)),
              name: chain.name,
              tier: caip2 === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" || caip2 === "eip155:8453" ? "first" : "second"
            }
          ])
        );
        const data = {
          address: wallet.info.solanaAddress || wallet.info.evmAddress || null,
          solanaAddress: wallet.info.solanaAddress,
          evmAddress: wallet.info.evmAddress || null,
          network: "multichain",
          // Keep the wallet contract aligned with the hosted MCP surfaces so
          // ChatGPT widgets can normalize once and render every producer safely.
          chainBalances,
          balances: {
            usdc: totalUsdc,
            fundedAtomic: String(Math.round(totalUsdc * 1e6)),
            spentAtomic: "0",
            availableAtomic: String(Math.round(totalUsdc * 1e6))
          },
          supportedNetworks: Object.keys(chainBalances).length > 0 ? Object.keys(chainBalances) : ["solana", "base", "polygon", "arbitrum", "optimism", "avalanche"],
          walletFile: WALLET_FILE
        };
        if (totalUsdc === 0) {
          data.tip = `Deposit USDC to ${wallet.info.solanaAddress || "your Solana wallet"}${wallet.info.evmAddress ? ` or ${wallet.info.evmAddress}` : ""} to start paying.`;
        }
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          _meta: WALLET_META
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: err.message }) }
          ],
          isError: true
        };
      }
    }
  );
}
var init_wallet_tool = __esm({
  "src/tools/wallet-tool.ts"() {
    "use strict";
    init_wallet();
    init_config();
    init_widget_meta();
  }
});

// src/server/index.ts
var server_exports = {};
__export(server_exports, {
  startServer: () => startServer
});
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
async function startServer(opts) {
  let wallet;
  try {
    wallet = await loadOrCreateWallet();
  } catch (err) {
    console.error(`[dexter-mcp] Wallet initialization failed: ${err.message}`);
    console.error("[dexter-mcp] Starting in search-only mode. Set DEXTER_PRIVATE_KEY or fix ~/.dexterai-mcp/wallet.json to enable payments.");
    wallet = null;
  }
  const server = new McpServer({
    name: "Dexter x402 Gateway",
    version: VERSION
  });
  registerSearchTool(server, opts);
  registerFetchTool(server, wallet, opts);
  registerCheckTool(server, opts);
  registerSettingsTool(server);
  registerWalletTool(server, wallet, opts);
  if (opts.transport !== "stdio") {
    console.error("HTTP transport not yet implemented. Use --transport=stdio");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
var init_server = __esm({
  "src/server/index.ts"() {
    "use strict";
    init_config();
    init_search();
    init_fetch();
    init_check();
    init_settings2();
    init_wallet_tool();
    init_wallet();
  }
});

// src/cli/install/clients.ts
import { homedir as homedir2 } from "os";
import { join as join3 } from "path";
import { existsSync as existsSync3 } from "fs";
function detectInstalledClients() {
  const configDir = getConfigDir();
  const codexHome = process.env.CODEX_HOME || join3(homedir2(), ".codex");
  const checks = [
    ["cursor", existsSync3(join3(homedir2(), ".cursor"))],
    ["claude-code", existsSync3(join3(homedir2(), ".claude.json")) || existsSync3(join3(homedir2(), ".claude"))],
    ["codex", existsSync3(codexHome)],
    ["vscode", existsSync3(join3(configDir, "Code")) || existsSync3(join3(configDir, "Code - Insiders"))],
    ["windsurf", existsSync3(join3(homedir2(), ".codeium", "windsurf"))],
    ["gemini-cli", existsSync3(join3(homedir2(), ".gemini"))]
  ];
  return checks.filter(([, present]) => present).map(([id]) => id);
}
function getConfigDir() {
  const platform = process.platform;
  if (platform === "win32") {
    return process.env.APPDATA || join3(homedir2(), "AppData", "Roaming");
  }
  if (platform === "darwin") {
    return join3(homedir2(), "Library", "Application Support");
  }
  return process.env.XDG_CONFIG_HOME || join3(homedir2(), ".config");
}
function getClientConfig(client, dev) {
  const cmd = dev ? SERVER_CMD_DEV : SERVER_CMD;
  switch (client) {
    case "cursor":
      return {
        configPath: join3(homedir2(), ".cursor", "mcp.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
    case "claude-code":
      return {
        configPath: join3(homedir2(), ".claude.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
    case "codex": {
      const codexHome = process.env.CODEX_HOME || join3(homedir2(), ".codex");
      return {
        configPath: join3(codexHome, "config.toml"),
        sectionKey: "mcp_servers",
        entry: cmd,
        manual: true
        // TOML requires different handling
      };
    }
    case "vscode": {
      const configDir = getConfigDir();
      const vscodeDirs = ["Code", "Code - Insiders"];
      const dir = vscodeDirs.find((d) => existsSync3(join3(configDir, d))) || "Code";
      return {
        configPath: join3(configDir, dir, "User", "mcp.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
    }
    case "windsurf":
      return {
        configPath: join3(homedir2(), ".codeium", "windsurf", "mcp_config.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
    case "gemini-cli":
      return {
        configPath: join3(homedir2(), ".gemini", "settings.json"),
        sectionKey: "mcpServers",
        entry: cmd
      };
  }
}
var CLIENTS, SERVER_CMD, SERVER_CMD_DEV;
var init_clients = __esm({
  "src/cli/install/clients.ts"() {
    "use strict";
    CLIENTS = {
      cursor: {
        name: "Cursor",
        description: "Cursor AI code editor"
      },
      "claude-code": {
        name: "Claude Code",
        description: "Anthropic Claude Code CLI"
      },
      codex: {
        name: "Codex",
        description: "OpenAI Codex CLI"
      },
      vscode: {
        name: "VS Code",
        description: "Visual Studio Code with MCP support"
      },
      windsurf: {
        name: "Windsurf",
        description: "Codeium Windsurf editor"
      },
      "gemini-cli": {
        name: "Gemini CLI",
        description: "Google Gemini CLI"
      }
    };
    SERVER_CMD = {
      command: "npx",
      args: ["-y", "@dexterai/opendexter@latest"]
    };
    SERVER_CMD_DEV = {
      command: "node",
      args: [process.cwd() + "/dist/index.js", "--dev"]
    };
  }
});

// src/cli/install/index.ts
var install_exports = {};
__export(install_exports, {
  runInstall: () => runInstall
});
import { existsSync as existsSync4, readFileSync as readFileSync4, writeFileSync as writeFileSync3, mkdirSync as mkdirSync3, copyFileSync as copyFileSync2 } from "fs";
import { dirname } from "path";
import { intro, outro, log, select, spinner } from "@clack/prompts";
import chalk from "chalk";
function writeClientConfig(clientId, dev) {
  const config = getClientConfig(clientId, dev);
  if (config.manual) {
    return {
      ok: false,
      message: `${CLIENTS[clientId].name} requires manual configuration at ${config.configPath}`
    };
  }
  mkdirSync3(dirname(config.configPath), { recursive: true });
  let existing = {};
  if (existsSync4(config.configPath)) {
    const raw = readFileSync4(config.configPath, "utf-8");
    try {
      existing = JSON.parse(raw);
    } catch {
      console.error(`Warning: ${config.configPath} contains invalid JSON. Backing up and creating fresh.`);
      copyFileSync2(config.configPath, config.configPath + ".bak");
      existing = {};
    }
    if (Object.keys(existing).length > 0) {
      copyFileSync2(config.configPath, config.configPath + ".bak");
    }
  }
  const section = existing[config.sectionKey] || {};
  section["dexter-x402"] = config.entry;
  existing[config.sectionKey] = section;
  writeFileSync3(config.configPath, JSON.stringify(existing, null, 2) + "\n");
  return {
    ok: true,
    message: `Installed into ${CLIENTS[clientId].name} (${config.configPath})`
  };
}
async function promptForClient() {
  const ids = Object.keys(CLIENTS);
  const answer = await select({
    message: "Choose a client to install OpenDexter into",
    options: ids.map((id) => ({
      value: id,
      label: CLIENTS[id].name,
      hint: CLIENTS[id].description
    }))
  });
  if (typeof answer !== "string" || !CLIENTS[answer]) {
    throw new Error("No client selected.");
  }
  return answer;
}
async function runInstall(opts) {
  let wallet = null;
  if (!opts.skipWalletSetup) {
    intro(chalk.bold("OpenDexter install"));
    const s = spinner();
    s.start("Activating wallet");
    wallet = await loadOrCreateWallet({ quiet: true });
    if (!wallet) {
      s.stop("Wallet activation failed");
      process.exit(1);
    }
    const statusMessage = wallet.status === "created" ? "New wallet activated" : wallet.status === "migrated" ? "Wallet upgraded for multichain use" : wallet.status === "env" ? "Wallet loaded from environment" : "Wallet online";
    s.stop(statusMessage);
    log.info(`Solana rail: ${wallet.info.solanaAddress}`);
    if (wallet.info.evmAddress) log.info(`EVM rail:    ${wallet.info.evmAddress}`);
  } else {
    wallet = await loadOrCreateWallet({ quiet: true });
    if (!wallet) {
      console.error("Failed to load wallet. Exiting.");
      process.exit(1);
    }
  }
  let targetClients = [];
  if (opts.all) {
    targetClients = detectInstalledClients();
    if (targetClients.length === 0) {
      console.error("No supported AI clients were auto-detected on this machine.");
      process.exit(1);
    }
    log.step(`Detected clients: ${targetClients.map((id) => CLIENTS[id].name).join(", ")}`);
  } else {
    let clientId = opts.client;
    if (!clientId) {
      if (opts.yes) {
        console.error("--client is required when using --yes, unless you pass --all");
        process.exit(1);
      }
      clientId = await promptForClient();
    }
    if (!CLIENTS[clientId]) {
      console.error(`Unknown client: ${clientId}`);
      console.error(`Available: ${Object.keys(CLIENTS).join(", ")}`);
      process.exit(1);
    }
    targetClients = [clientId];
  }
  const successes = [];
  const failures = [];
  for (const clientId of targetClients) {
    const s = spinner();
    s.start(`Installing into ${CLIENTS[clientId].name}`);
    const result = writeClientConfig(clientId, opts.dev);
    if (result.ok) {
      s.stop(`${CLIENTS[clientId].name} installed`);
      successes.push(result.message);
    } else {
      s.stop(`${CLIENTS[clientId].name} needs manual setup`);
      failures.push(result.message);
    }
  }
  log.step("Install summary");
  for (const line of successes) log.success(line);
  for (const line of failures) log.warn(line);
  if (!opts.skipWalletSetup) {
    outro("OpenDexter is wired in. Fund your rails when you're ready to settle your first paid call.");
  }
}
var init_install = __esm({
  "src/cli/install/index.ts"() {
    "use strict";
    init_wallet();
    init_clients();
  }
});

// src/cli/onboard.ts
var onboard_exports = {};
__export(onboard_exports, {
  runSetup: () => runSetup
});
import { intro as intro2, outro as outro2, log as log2, note } from "@clack/prompts";
import chalk2 from "chalk";
function fundingAdvice(totalUsdc, wallet) {
  if (totalUsdc > 0) {
    return [
      `Treasury online with ${totalUsdc.toFixed(2)} USDC available across active rails.`,
      "You are ready to search, inspect, and settle paid API calls."
    ];
  }
  const lines = ["Treasury created, but no USDC is loaded yet."];
  if (wallet.solanaAddress) {
    lines.push(`- Solana funding rail: ${wallet.solanaAddress}`);
  }
  if (wallet.evmAddress) {
    lines.push(`- EVM funding rail:    ${wallet.evmAddress}`);
  }
  lines.push("Once funded, your agent can settle x402 API calls automatically.");
  return lines;
}
async function runSetup(opts) {
  intro2(chalk2.bold("OpenDexter setup"));
  log2.message("Activating your agent wallet, wiring your clients, and bringing multichain settlement online.");
  const wallet = await loadOrCreateWallet({ quiet: true });
  if (!wallet) {
    console.error("Failed to create or load wallet.");
    process.exit(1);
  }
  const walletStatus = wallet.status === "created" ? "Fresh wallet activated" : wallet.status === "migrated" ? "Wallet upgraded for multichain settlement" : wallet.status === "env" ? "Wallet loaded from environment" : "Wallet online";
  log2.step(walletStatus);
  if (wallet.info.solanaAddress) log2.info(`Solana rail: ${wallet.info.solanaAddress}`);
  if (wallet.info.evmAddress) log2.info(`EVM rail:    ${wallet.info.evmAddress}`);
  const detected = detectInstalledClients();
  if (detected.length > 0) {
    await runInstall({
      dev: opts.dev,
      yes: opts.yes,
      all: true,
      skipWalletSetup: true
    });
  } else {
    log2.warn("No supported clients were auto-detected.");
    log2.message("You can still run `opendexter install --client <name>` manually later.");
  }
  const { totalUsdc } = await getAllBalances(wallet.info);
  note(`Settlement live across: ${SUPPORTED_CHAIN_LABELS.join(" \xB7 ")}`, "Rails");
  note(fundingAdvice(totalUsdc, wallet.info).join("\n"), "Funding");
  note(
    [
      "1. Run `opendexter wallet` to confirm your addresses and balances.",
      "2. Run `opendexter search <what-you-need>` to browse the marketplace.",
      "3. Run `opendexter check <url>` on any result before your first paid call.",
      "4. Run `opendexter fetch <url>` once your wallet is funded."
    ].join("\n"),
    "First-use path"
  );
  let nextMove = "";
  if (totalUsdc > 0) {
    nextMove = "Treasury funded. Start with a real marketplace search for the task you actually want to complete.";
  } else {
    nextMove = "Fund a rail, then start with `opendexter search <what-you-need>`.";
  }
  outro2(nextMove);
}
var init_onboard = __esm({
  "src/cli/onboard.ts"() {
    "use strict";
    init_wallet();
    init_install();
    init_clients();
    init_config();
  }
});

// src/wallet/vanity-progress.ts
function formatTime(ms) {
  const s = ms / 1e3;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
function truncateAddress(addr, len = 42) {
  if (addr.length <= len) return addr;
  return addr.slice(0, len - 3) + "...";
}
function renderBar(ratio) {
  const clamped = Math.min(ratio, 1);
  const filled = Math.round(clamped * BAR_WIDTH);
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_WIDTH - filled);
}
function renderLine(label, chain) {
  if (chain.found && chain.result) {
    const addr = truncateAddress(chain.result.address);
    const time = formatTime(chain.result.elapsedMs);
    return `  ${label}  ${addr}  \u2713 ${time}`;
  }
  if (chain.expectedAttempts === 0) return "";
  const ratio = chain.attempts / chain.expectedAttempts;
  const pct = Math.min(Math.round(ratio * 100), 99);
  const bar = renderBar(ratio);
  return `  ${label}  ${bar}  ${String(pct).padStart(2)}%`;
}
function createProgressRenderer() {
  let linesWritten = 0;
  const startTime = Date.now();
  let headerWritten = false;
  return (progress) => {
    const output = process.stderr;
    if (!headerWritten) {
      output.write("\n  Creating your Dexter wallet...\n\n");
      headerWritten = true;
      linesWritten = 0;
    }
    if (linesWritten > 0) {
      output.write(`\x1B[${linesWritten}A`);
    }
    const lines = [];
    const solLine = renderLine("Solana  (dex...)", progress.solana);
    if (solLine) lines.push(solLine);
    const evmLine = renderLine("EVM     (0x402DD...)", progress.evm);
    if (evmLine) lines.push(evmLine);
    for (const line of lines) {
      output.write(`\x1B[2K${line}
`);
    }
    linesWritten = lines.length;
    if (progress.solana.found && progress.evm.found) {
      output.write("\n");
      output.write("  Deposit USDC to either address to start.\n");
      output.write("\n");
    }
  };
}
var BAR_WIDTH, FILLED, EMPTY;
var init_vanity_progress = __esm({
  "src/wallet/vanity-progress.ts"() {
    "use strict";
    BAR_WIDTH = 24;
    FILLED = "\u2588";
    EMPTY = "\u2591";
  }
});

// src/wallet/vanity.ts
import { Worker } from "worker_threads";
import { cpus } from "os";
import { fileURLToPath as fileURLToPath2 } from "url";
import { dirname as dirname2, join as join4 } from "path";
function estimateAttempts(target) {
  const prefix = target.prefix.replace(/^0x/i, "");
  const len = prefix.length;
  if (target.chain === "solana") {
    if (target.caseSensitive) return Math.pow(58, len);
    let combos2 = 1;
    const b58alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const b58digits = "123456789";
    for (const ch of prefix) {
      const lower = ch.toLowerCase();
      const upper = ch.toUpperCase();
      if (lower !== upper && b58alpha.includes(lower) && b58alpha.includes(upper)) {
        combos2 *= 2;
      }
    }
    return Math.round(Math.pow(58, len) / combos2);
  }
  let combos = 1;
  for (const ch of prefix) {
    if (/[a-fA-F]/.test(ch)) {
      combos *= 2;
    }
  }
  return Math.round(Math.pow(16, len) / combos);
}
function grindOne(target, numWorkers) {
  const workers = [];
  let totalAttempts = 0;
  let cancelled = false;
  const start = Date.now();
  const promise = new Promise((resolve) => {
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(WORKER_PATH, {
        workerData: {
          chain: target.chain,
          prefix: target.prefix,
          caseSensitive: target.caseSensitive ?? false
        }
      });
      worker.on("message", (msg) => {
        if (msg.type === "progress") {
          totalAttempts += msg.attempts;
        }
        if (msg.type === "found" && !cancelled) {
          cancelled = true;
          const result = {
            chain: target.chain,
            address: msg.address,
            privateKey: msg.privateKey,
            attempts: totalAttempts + msg.attempts,
            elapsedMs: Date.now() - start
          };
          for (const w of workers) w.terminate();
          resolve(result);
        }
      });
      workers.push(worker);
    }
  });
  return {
    promise,
    getAttempts: () => totalAttempts,
    cancel: () => {
      cancelled = true;
      for (const w of workers) w.terminate();
    }
  };
}
async function generateVanityWallet(opts) {
  const totalCores = cpus().length;
  const hasSolana = !!opts.solanaPrefix;
  const hasEvm = !!opts.evmPrefix;
  if (!hasSolana && !hasEvm) throw new Error("At least one prefix required");
  const solanaCores = hasSolana && hasEvm ? Math.max(2, Math.floor(totalCores * 0.6)) : totalCores;
  const evmCores = hasEvm ? totalCores - (hasSolana ? solanaCores : 0) : 0;
  const solanaExpected = hasSolana ? estimateAttempts({ chain: "solana", prefix: opts.solanaPrefix, caseSensitive: opts.caseSensitive }) : 0;
  const evmExpected = hasEvm ? estimateAttempts({ chain: "evm", prefix: opts.evmPrefix, caseSensitive: opts.caseSensitive }) : 0;
  const results = {};
  const solanaGrind = hasSolana ? grindOne({ chain: "solana", prefix: opts.solanaPrefix, caseSensitive: opts.caseSensitive }, solanaCores) : null;
  const evmGrind = hasEvm ? grindOne({ chain: "evm", prefix: opts.evmPrefix, caseSensitive: opts.caseSensitive }, evmCores) : null;
  const progress = {
    solana: { attempts: 0, expectedAttempts: solanaExpected, found: false },
    evm: { attempts: 0, expectedAttempts: evmExpected, found: false }
  };
  const interval = opts.onProgress ? setInterval(() => {
    if (solanaGrind && !progress.solana.found) {
      progress.solana.attempts = solanaGrind.getAttempts();
    }
    if (evmGrind && !progress.evm.found) {
      progress.evm.attempts = evmGrind.getAttempts();
    }
    opts.onProgress(progress);
  }, opts.progressIntervalMs ?? 200) : null;
  const pending = [];
  if (solanaGrind) {
    pending.push(
      solanaGrind.promise.then((r) => {
        results.solana = r;
        progress.solana.found = true;
        progress.solana.result = r;
        progress.solana.attempts = r.attempts;
      })
    );
  }
  if (evmGrind) {
    pending.push(
      evmGrind.promise.then((r) => {
        results.evm = r;
        progress.evm.found = true;
        progress.evm.result = r;
        progress.evm.attempts = r.attempts;
      })
    );
  }
  await Promise.all(pending);
  if (interval) clearInterval(interval);
  if (opts.onProgress) opts.onProgress(progress);
  return results;
}
var WORKER_PATH;
var init_vanity = __esm({
  "src/wallet/vanity.ts"() {
    "use strict";
    WORKER_PATH = join4(dirname2(fileURLToPath2(import.meta.url)), "wallet", "vanity-worker.js");
  }
});

// src/wallet/vanity-flow.ts
var vanity_flow_exports = {};
__export(vanity_flow_exports, {
  runVanityFlow: () => runVanityFlow
});
import { confirm, intro as intro3, log as log3, outro as outro3, select as select2, text } from "@clack/prompts";
import chalk3 from "chalk";
function applyVanity(current, vanity) {
  return {
    ...current,
    ...vanity.solana ? {
      solanaAddress: vanity.solana.address,
      solanaPrivateKey: vanity.solana.privateKey
    } : {},
    ...vanity.evm ? {
      evmAddress: vanity.evm.address,
      evmPrivateKey: vanity.evm.privateKey
    } : {}
  };
}
async function runVanityFlow(opts) {
  intro3(chalk3.bold("OpenDexter vanity wallet"));
  log3.message("Mint a more recognizable agent wallet identity without changing how OpenDexter works.");
  const wallet = await loadOrCreateWallet({ quiet: true });
  if (!wallet) {
    console.error("Failed to load wallet.");
    process.exit(1);
  }
  log3.info(`Current Solana: ${wallet.info.solanaAddress}`);
  if (wallet.info.evmAddress) log3.info(`Current EVM:    ${wallet.info.evmAddress}`);
  let solanaPrefix = opts.solanaPrefix;
  let evmPrefix = opts.evmPrefix;
  let caseSensitive = opts.caseSensitive ?? false;
  if (!solanaPrefix && !evmPrefix) {
    const preset = await select2({
      message: "Choose the vanity wallet style",
      options: Object.entries(PRESETS).map(([value, presetValue]) => ({
        value,
        label: presetValue.label,
        hint: presetValue.hint
      }))
    });
    if (typeof preset !== "string") {
      throw new Error("No vanity preset selected.");
    }
    const selected = PRESETS[preset];
    solanaPrefix = selected.solanaPrefix;
    evmPrefix = selected.evmPrefix;
    if (preset === "custom") {
      const solanaAnswer = await text({
        message: "Solana prefix (optional)",
        placeholder: "Dex"
      });
      const evmAnswer = await text({
        message: "EVM prefix after 0x (optional)",
        placeholder: "402dd"
      });
      solanaPrefix = typeof solanaAnswer === "string" && solanaAnswer.trim() ? solanaAnswer.trim() : void 0;
      evmPrefix = typeof evmAnswer === "string" && evmAnswer.trim() ? evmAnswer.trim() : void 0;
    }
  }
  if (!solanaPrefix && !evmPrefix) {
    console.error("At least one vanity prefix is required.");
    process.exit(1);
  }
  const proceed = opts.yes ? true : await confirm({
    message: `Generate a vanity wallet${solanaPrefix ? ` (Solana: ${solanaPrefix})` : ""}${evmPrefix ? ` (EVM: 0x${evmPrefix})` : ""}?`
  });
  if (!proceed) {
    outro3("Vanity wallet generation cancelled.");
    return;
  }
  const progressRenderer = createProgressRenderer();
  log3.step("Grinding vanity addresses");
  const result = await generateVanityWallet({
    solanaPrefix,
    evmPrefix,
    caseSensitive,
    onProgress: progressRenderer
  });
  const nextWallet = applyVanity(wallet.info, result);
  saveWalletInfo(nextWallet);
  if (result.solana) {
    log3.success(`New Solana vanity: ${result.solana.address}`);
  }
  if (result.evm) {
    log3.success(`New EVM vanity:    ${result.evm.address}`);
  }
  log3.info(`Saved to ${WALLET_FILE}`);
  outro3("Vanity wallet is live. OpenDexter will use it for future local payments.");
}
var PRESETS;
var init_vanity_flow = __esm({
  "src/wallet/vanity-flow.ts"() {
    "use strict";
    init_vanity_progress();
    init_vanity();
    init_wallet();
    init_config();
    PRESETS = {
      balanced: {
        label: "Balanced",
        hint: "Fast enough to generate, still looks branded",
        solanaPrefix: "Dex",
        evmPrefix: "402"
      },
      branded: {
        label: "Branded",
        hint: "Stronger Dexter feel, slightly slower",
        solanaPrefix: "Dex",
        evmPrefix: "402dd"
      },
      solana: {
        label: "Solana-first",
        hint: "Only grind the Solana address",
        solanaPrefix: "Dex",
        evmPrefix: void 0
      },
      custom: {
        label: "Custom",
        hint: "Set your own Solana and/or EVM prefix",
        solanaPrefix: void 0,
        evmPrefix: void 0
      }
    };
  }
});

// src/index.ts
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
async function main() {
  await yargs(hideBin(process.argv)).scriptName("opendexter").usage("$0 [command] [options]").option("dev", {
    type: "boolean",
    description: "Use localhost endpoints instead of production",
    default: false
  }).command(
    ["$0", "server"],
    "Start the MCP server (default)",
    (y) => y.option("transport", {
      choices: ["stdio", "http"],
      default: "stdio",
      description: "Transport mode"
    }),
    async (args) => {
      const { startServer: startServer2 } = await Promise.resolve().then(() => (init_server(), server_exports));
      await startServer2({
        transport: args.transport,
        dev: args.dev
      });
    }
  ).command(
    "install",
    "Install Dexter MCP into an AI client (Cursor, Claude, Codex, etc.)",
    (y) => y.option("client", {
      type: "string",
      description: "Client to install into"
    }).option("yes", {
      alias: "y",
      type: "boolean",
      description: "Skip prompts",
      default: false
    }).option("all", {
      type: "boolean",
      description: "Install into all auto-detected supported clients",
      default: false
    }),
    async (args) => {
      const { runInstall: runInstall2 } = await Promise.resolve().then(() => (init_install(), install_exports));
      await runInstall2({ client: args.client, yes: args.yes, all: args.all, dev: args.dev });
    }
  ).command(
    "setup",
    "Set up wallet, install into detected clients, and show the fastest path to first use",
    (y) => y.option("yes", {
      alias: "y",
      type: "boolean",
      description: "Skip prompts where possible",
      default: false
    }),
    async (args) => {
      const { runSetup: runSetup2 } = await Promise.resolve().then(() => (init_onboard(), onboard_exports));
      await runSetup2({ yes: args.yes, dev: args.dev });
    }
  ).command(
    "check <url>",
    "Inspect an endpoint's x402 pricing and requirements without paying",
    (y) => y.positional("url", { type: "string", demandOption: true }).option("method", {
      choices: ["GET", "POST", "PUT", "DELETE"],
      default: "GET"
    }),
    async (args) => {
      const { cliCheck: cliCheck2 } = await Promise.resolve().then(() => (init_check(), check_exports));
      await cliCheck2(args.url, {
        method: args.method,
        dev: args.dev
      });
    }
  ).command(
    "settings",
    "Read or update OpenDexter spending policy",
    (y) => y.option("max-amount", {
      type: "number",
      description: "Set the default max amount allowed per paid call (USDC)"
    }),
    async (args) => {
      const { cliSettings: cliSettings2 } = await Promise.resolve().then(() => (init_settings2(), settings_exports));
      await cliSettings2({
        maxAmountUsdc: args["max-amount"]
      });
    }
  ).command(
    "wallet",
    "Show wallet address and balances",
    (y) => y.option("vanity", {
      type: "boolean",
      description: "Generate a vanity wallet address",
      default: false
    }).option("solana-prefix", {
      type: "string",
      description: "Desired Solana prefix (example: Dex)"
    }).option("evm-prefix", {
      type: "string",
      description: "Desired EVM prefix after 0x (example: 402dd)"
    }).option("case-sensitive", {
      type: "boolean",
      description: "Treat vanity prefixes as case-sensitive",
      default: false
    }).option("yes", {
      alias: "y",
      type: "boolean",
      description: "Skip prompts where possible",
      default: false
    }),
    async (args) => {
      if (args.vanity) {
        const { runVanityFlow: runVanityFlow2 } = await Promise.resolve().then(() => (init_vanity_flow(), vanity_flow_exports));
        await runVanityFlow2({
          dev: args.dev,
          solanaPrefix: args["solana-prefix"],
          evmPrefix: args["evm-prefix"],
          caseSensitive: args["case-sensitive"],
          yes: args.yes
        });
        return;
      }
      const { showWalletInfo: showWalletInfo2 } = await Promise.resolve().then(() => (init_wallet(), wallet_exports));
      await showWalletInfo2({ dev: args.dev });
    }
  ).command(
    "search <query>",
    "Search the Dexter x402 marketplace",
    (y) => y.positional("query", { type: "string", demandOption: true }),
    async (args) => {
      const { cliSearch: cliSearch2 } = await Promise.resolve().then(() => (init_search(), search_exports));
      await cliSearch2(args.query, { dev: args.dev });
    }
  ).command(
    "fetch <url>",
    "Fetch an x402-protected resource with automatic payment",
    (y) => y.positional("url", { type: "string", demandOption: true }).option("method", {
      choices: ["GET", "POST", "PUT", "DELETE"],
      default: "GET"
    }).option("max-amount", {
      type: "number",
      description: "Optional per-call spend cap override in USDC"
    }).option("body", { type: "string", description: "JSON request body" }),
    async (args) => {
      const { cliFetch: cliFetch2 } = await Promise.resolve().then(() => (init_fetch(), fetch_exports));
      await cliFetch2(args.url, {
        method: args.method,
        body: args.body,
        maxAmountUsdc: args["max-amount"],
        dev: args.dev
      });
    }
  ).command(
    "pay <url>",
    "Alias of fetch for clients that want an explicit payment verb",
    (y) => y.positional("url", { type: "string", demandOption: true }).option("method", {
      choices: ["GET", "POST", "PUT", "DELETE"],
      default: "GET"
    }).option("max-amount", {
      type: "number",
      description: "Optional per-call spend cap override in USDC"
    }).option("body", { type: "string", description: "JSON request body" }),
    async (args) => {
      const { cliFetch: cliFetch2 } = await Promise.resolve().then(() => (init_fetch(), fetch_exports));
      await cliFetch2(args.url, {
        method: args.method,
        body: args.body,
        maxAmountUsdc: args["max-amount"],
        dev: args.dev
      });
    }
  ).strict().help().parseAsync();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map