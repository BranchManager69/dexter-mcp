import { j as jsxRuntimeExports, u as useToolOutput, e as useAdaptiveOpenExternal, f as useAdaptiveTheme, r as reactExports, b as captureWidgetException } from "./adapter-CWih0Dk2.js";
import { B as Button } from "./Button-B-UKYG31.js";
import { c as clientExports } from "./types-Du1vURRP.js";
import { B as Badge } from "./index-wQqyafyk.js";
import { g as getChain, C as CopyButton, D as DebugPanel } from "./DebugPanel-g_uSq2an.js";
import { A as Alert } from "./Alert-mkdTXL8b.js";
import { u as useDisplayMode, a as useRequestDisplayMode } from "./use-request-display-mode-GOvIJH3i.js";
import { u as useMaxHeight } from "./use-max-height-CONbE4Ud.js";
import { J as JsonViewer } from "./JsonViewer-DDb5wXQ2.js";
import { u as useIntrinsicHeight } from "./useIntrinsicHeight-Bnulb9TX.js";
import "./Check-B3pA9uZY.js";
import "./Copy-BwrnWPpY.js";
import "./Warning-Z41ZdaEH.js";
import "./use-openai-global-CHD17KWv.js";
function shortenHash(hash, head = 8, tail = 6) {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}
function formatUsdc(atomic, decimals = 6) {
  const n = Number(atomic) / Math.pow(10, decimals);
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
function getExplorerUrl(tx, network) {
  if (network?.includes("8453")) return `https://basescan.org/tx/${tx}`;
  if (network?.includes("137")) return `https://polygonscan.com/tx/${tx}`;
  if (network?.includes("42161")) return `https://arbiscan.io/tx/${tx}`;
  if (network?.includes("10") && network?.includes("eip155")) return `https://optimistic.etherscan.io/tx/${tx}`;
  return `https://solscan.io/tx/${tx}`;
}
const WORDMARK_URL = "https://dexter.cash/wordmarks/dexter-wordmark.svg";
const LOGO_MARK_URL = "https://dexter.cash/assets/pokedexter/dexter-logo.svg";
function isImageUrl(data) {
  if (typeof data !== "object" || !data) return null;
  const obj = data;
  const url = obj.image_url || obj.imageUrl || obj.url;
  if (typeof url === "string" && /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/.test(url)) return url;
  return null;
}
function proxyImageUrl(url) {
  return `https://api.dexter.cash/api/img?url=${encodeURIComponent(url)}`;
}
function QrCountdown({ expiresAt }) {
  const [timeLeft, setTimeLeft] = reactExports.useState("");
  reactExports.useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      if (remaining <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const mins = Math.floor(remaining / 6e4);
      const secs = Math.floor(remaining % 6e4 / 1e3);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1e3);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-tertiary", children: [
    "Expires in ",
    timeLeft
  ] });
}
function SessionPanel({ payload }) {
  const openExternal = useAdaptiveOpenExternal();
  const session = payload.session;
  const funding = payload.sessionFunding || session?.funding;
  const walletAddress = funding?.walletAddress || funding?.payTo;
  const qrUrl = funding?.solanaPayUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(funding.solanaPayUrl)}` : null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "warning", children: "Session Required" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-secondary", children: payload.message || "Fund an anonymous OpenDexter session to execute." }),
    funding?.amountUsdc !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm font-semibold", children: [
      "Funding target: $",
      Number(funding.amountUsdc).toFixed(2),
      " USDC"
    ] }),
    walletAddress && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary", children: "Deposit:" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-mono text-secondary truncate flex-1", children: walletAddress }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CopyButton, { copyValue: walletAddress, variant: "ghost", color: "secondary", size: "sm", children: "Copy" })
    ] }),
    qrUrl && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "p-2 bg-white rounded-lg inline-block", children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: qrUrl, alt: "Solana Pay QR", width: 140, height: 140 }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
      funding?.txUrl && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "soft", color: "secondary", size: "sm", onClick: () => openExternal(funding.txUrl), children: "Open Funding Page" }),
      funding?.solanaPayUrl && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "soft", color: "secondary", size: "sm", onClick: () => openExternal(funding.solanaPayUrl), children: "Solana Pay" })
    ] }),
    session?.expiresAt && /* @__PURE__ */ jsxRuntimeExports.jsx(QrCountdown, { expiresAt: session.expiresAt }),
    payload.requirements && /* @__PURE__ */ jsxRuntimeExports.jsx(JsonViewer, { data: payload.requirements, title: "Payment Requirements" })
  ] });
}
function FetchResult() {
  const toolOutput = useToolOutput();
  const openExternal = useAdaptiveOpenExternal();
  const theme = useAdaptiveTheme();
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode();
  const containerRef = useIntrinsicHeight();
  reactExports.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const isFullscreen = displayMode === "fullscreen";
  const requestDisplayMode = useRequestDisplayMode();
  const toggleFullscreen = reactExports.useCallback(() => {
    try {
      requestDisplayMode?.({ mode: isFullscreen ? "inline" : "fullscreen" });
    } catch (error) {
      captureWidgetException(error, { phase: "request_display_mode" });
    }
  }, [isFullscreen, requestDisplayMode]);
  const [loadingElapsed, setLoadingElapsed] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (toolOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1e3);
    return () => clearInterval(t);
  }, [toolOutput]);
  if (!toolOutput) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-theme": theme, className: "p-4 flex flex-col gap-2", style: { maxHeight: maxHeight ?? void 0 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-secondary", children: loadingElapsed < 3 ? "Submitting payment..." : loadingElapsed < 8 ? "Awaiting settlement confirmation..." : "Still processing — the endpoint may be slow." }),
      loadingElapsed >= 3 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-1 rounded-full bg-surface-secondary overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-full bg-primary/40 rounded-full transition-all duration-1000", style: { width: `${Math.min(95, loadingElapsed * 8)}%` } }) })
    ] });
  }
  const isSession = toolOutput.mode === "session_required";
  const isError = !!toolOutput.error && !isSession;
  const payment = toolOutput.payment;
  const auth = toolOutput.auth;
  const details = payment?.details;
  const networkName = details?.network ? getChain(details.network).name : "";
  const authNetworkName = auth?.network ? getChain(auth.network).name : "";
  const imageUrl = isImageUrl(toolOutput.data);
  const price = details?.requirements?.amount ? formatUsdc(details.requirements.amount, details.requirements.extra?.decimals ?? 6) : "";
  const dataStr = toolOutput.data !== void 0 ? JSON.stringify(toolOutput.data) : "";
  const isLargePayload = dataStr.length > 500;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      "data-theme": theme,
      ref: containerRef,
      className: `flex flex-col gap-4 ${isFullscreen ? "p-6" : "p-4"} overflow-y-auto`,
      style: { maxHeight: isFullscreen ? void 0 : maxHeight ?? void 0 },
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "rounded-2xl border border-default bg-surface p-4 flex flex-col gap-4",
          style: { background: "linear-gradient(135deg, rgba(209,63,0,0.08) 0%, rgba(255,107,0,0.04) 52%, transparent 100%)" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative overflow-hidden rounded-xl px-4 pt-4 pb-3 bg-surface/70", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: LOGO_MARK_URL, alt: "Dexter logo", width: 24, height: 24, style: { width: 24, height: 24, flexShrink: 0 } }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: WORDMARK_URL, alt: "Dexter", height: 22, style: { height: 22, width: "auto", opacity: 0.9 } }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary uppercase tracking-wider font-semibold", children: "x402 Execution Result" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "heading-lg", children: "Execution Ledger" })
                  ] })
                ] }),
                isLargePayload && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "soft", color: "secondary", size: "sm", onClick: toggleFullscreen, children: isFullscreen ? "Minimize" : "Expand" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute bottom-0 left-4 right-4 h-px", style: { background: "linear-gradient(90deg, #ff6b00 0%, transparent 100%)", opacity: 0.18 } })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: isError ? "danger" : "success", variant: "soft", children: "Challenge" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: isError ? "danger" : auth ? "info" : payment?.settled ? "success" : "warning", variant: "soft", children: auth ? "Access" : "Settle" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: isError ? "danger" : payment?.settled ? "success" : "secondary", variant: "soft", children: "Response" })
            ] }),
            isSession ? /* @__PURE__ */ jsxRuntimeExports.jsx(SessionPanel, { payload: toolOutput }) : isError ? /* @__PURE__ */ jsxRuntimeExports.jsx(Alert, { color: "danger", title: "Error", description: toolOutput.error }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
                payment?.settled ? /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "success", children: "Paid" }) : auth ? /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "info", children: "Wallet Proof" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "info", children: toolOutput.status }),
                price && /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { color: "info", variant: "outline", children: [
                  price,
                  " USDC"
                ] }),
                networkName && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "info", variant: "outline", children: networkName }),
                !networkName && authNetworkName && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "info", variant: "outline", children: authNetworkName })
              ] }),
              payment?.settled && details?.transaction && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-surface-secondary", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary uppercase", children: "Transaction" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "text-sm font-mono text-primary hover:underline cursor-pointer",
                        onClick: () => openExternal(getExplorerUrl(details.transaction, details.network)),
                        children: shortenHash(details.transaction)
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(CopyButton, { copyValue: details.transaction, variant: "ghost", color: "secondary", size: "sm", children: "Copy" })
                  ] })
                ] }),
                details.payer && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary uppercase", children: "Payer" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-mono text-secondary", children: shortenHash(details.payer) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(CopyButton, { copyValue: details.payer, variant: "ghost", color: "secondary", size: "sm", children: "Copy" })
                  ] })
                ] })
              ] }),
              auth?.mode && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-surface-secondary", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary uppercase", children: "Access Mode" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-secondary", children: auth.mode.toUpperCase() })
                ] }),
                auth.signedAddress && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary uppercase", children: "Signed Address" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-mono text-secondary", children: shortenHash(auth.signedAddress) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(CopyButton, { copyValue: auth.signedAddress, variant: "ghost", color: "secondary", size: "sm", children: "Copy" })
                  ] })
                ] })
              ] }),
              imageUrl ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl overflow-hidden bg-surface-secondary", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-3 py-2 text-xs text-tertiary uppercase", children: "Image" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: proxyImageUrl(imageUrl), alt: "Response", className: "w-full" })
              ] }) : toolOutput.data !== void 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(JsonViewer, { data: toolOutput.data }) : null
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DebugPanel, { widgetName: "x402-fetch-result" })
          ]
        }
      )
    }
  );
}
const root = document.getElementById("x402-fetch-result-root");
if (root) {
  root.setAttribute("data-widget-build", "2026-03-04.2");
  clientExports.createRoot(root).render(/* @__PURE__ */ jsxRuntimeExports.jsx(FetchResult, {}));
}
