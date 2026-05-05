import { r as reactExports, j as jsxRuntimeExports, u as useToolOutput, f as useAdaptiveOpenExternal, e as useAdaptiveTheme, b as captureWidgetException } from "./adapter-DBrmdIGu.js";
import { B as Button } from "./Button-CSr1q5ix.js";
import { c as clientExports } from "./client-B5JgHWHP.js";
import { B as Badge } from "./index-B6owa9i6.js";
import { g as getChain, a as CopyButton, D as DebugPanel } from "./DebugPanel-BtjGQOge.js";
import { A as Alert } from "./Alert-8sgHTlaY.js";
import { u as useDisplayMode } from "./use-display-mode-DZ0UyQis.js";
import { u as useMaxHeight } from "./use-max-height-DZFC2PSv.js";
import { u as useRequestDisplayMode } from "./use-request-display-mode-DZHicVK7.js";
import { u as useIntrinsicHeight } from "./useIntrinsicHeight-DXrFxGic.js";
import "./Check-Bp07B38p.js";
import "./Copy-1PaP5PSB.js";
import "./Warning-0PV1c4JM.js";
import "./use-openai-global-Cs-Bqg_p.js";
function getType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
const TYPE_COLORS = {
  string: "text-[#e9967a]",
  number: "text-[#b5cea8]",
  boolean: "text-[#569cd6]",
  null: "text-[#808080]",
  object: "",
  array: ""
};
function JsonNode({ keyName, value, depth = 0, last = true }) {
  const type = getType(value);
  const isExpandable = type === "object" || type === "array";
  const [expanded, setExpanded] = reactExports.useState(depth < 2);
  if (!isExpandable) {
    let rendered;
    if (type === "string") rendered = `"${String(value)}"`;
    else if (type === "null") rendered = "null";
    else rendered = String(value);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex", style: { paddingLeft: `${depth * 16}px` }, children: [
      keyName !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[#9cdcfe] flex-shrink-0", children: [
        '"',
        keyName,
        '"',
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: ": " })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `${TYPE_COLORS[type]} break-all`, children: rendered }),
      !last && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: "," })
    ] });
  }
  const entries = type === "array" ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  const bracketOpen = type === "array" ? "[" : "{";
  const bracketClose = type === "array" ? "]" : "}";
  const isEmpty = entries.length === 0;
  if (isEmpty) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex", style: { paddingLeft: `${depth * 16}px` }, children: [
      keyName !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[#9cdcfe]", children: [
        '"',
        keyName,
        '"',
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: ": " })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-tertiary", children: [
        bracketOpen,
        bracketClose
      ] }),
      !last && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: "," })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex items-center cursor-pointer hover:bg-white/5 rounded",
        style: { paddingLeft: `${depth * 16}px` },
        onClick: () => setExpanded(!expanded),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary w-4 text-center text-2xs select-none flex-shrink-0", children: expanded ? "▼" : "▶" }),
          keyName !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[#9cdcfe]", children: [
            '"',
            keyName,
            '"',
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: ": " })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: bracketOpen }),
          !expanded && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-tertiary ml-1", children: [
            entries.length,
            " ",
            type === "array" ? "items" : "keys",
            " ",
            bracketClose,
            !last && ","
          ] })
        ]
      }
    ),
    expanded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      entries.map(([k, v], i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        JsonNode,
        {
          keyName: type === "array" ? void 0 : k,
          value: v,
          depth: depth + 1,
          last: i === entries.length - 1
        },
        k
      )),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { paddingLeft: `${depth * 16}px` }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary ml-4", children: bracketClose }),
        !last && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: "," })
      ] })
    ] })
  ] });
}
function JsonViewer({ data, title = "Response Payload", defaultExpanded = true }) {
  const parsed = reactExports.useMemo(() => {
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }, [data]);
  const [expanded, setExpanded] = reactExports.useState(defaultExpanded);
  const jsonStr = typeof data === "string" ? data : JSON.stringify(data);
  const isLong = jsonStr.length > 300;
  if (typeof parsed === "string") {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl bg-surface-secondary border border-subtle overflow-hidden", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-between px-3 py-2 bg-surface-secondary border-b border-subtle", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary uppercase font-semibold", children: title }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { className: "px-3 py-2 text-xs font-mono text-secondary overflow-x-auto whitespace-pre-wrap break-all", children: parsed })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl bg-surface-secondary border border-subtle overflow-hidden", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between px-3 py-2 border-b border-subtle", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary uppercase font-semibold", children: title }),
      isLong && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "text-2xs text-primary hover:underline cursor-pointer",
          onClick: () => setExpanded(!expanded),
          children: expanded ? "Collapse" : "Expand"
        }
      )
    ] }),
    expanded && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-2 py-2 text-xs font-mono leading-relaxed overflow-x-auto max-h-96 overflow-y-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsx(JsonNode, { value: parsed }) })
  ] });
}
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
function shortenUrl(url, max = 56) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname;
    const combined = host + path;
    if (combined.length <= max) return combined;
    return combined.slice(0, max - 1) + "…";
  } catch {
    return url.length > max ? url.slice(0, max - 1) + "…" : url;
  }
}
function SponsoredCard({
  recommendation,
  onAct
}) {
  const [visible, setVisible] = reactExports.useState(false);
  reactExports.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 220);
    return () => clearTimeout(t);
  }, []);
  const method = (recommendation.method || "GET").toUpperCase();
  const display = shortenUrl(recommendation.resourceUrl);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `relative overflow-hidden rounded-2xl border border-[rgba(255,107,0,0.28)] p-4 transition-all duration-500 ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`,
      style: {
        background: "linear-gradient(135deg, rgba(255,107,0,0.10) 0%, rgba(255,107,0,0.04) 48%, rgba(255,107,0,0.02) 100%)",
        boxShadow: "0 12px 28px rgba(255,107,0,0.08), 0 0 0 1px rgba(255,107,0,0.06) inset"
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: "absolute top-0 left-0 right-0 h-px",
            style: {
              background: "linear-gradient(90deg, transparent 0%, #ff6b00 28%, #ff6b00 72%, transparent 100%)",
              opacity: 0.5
            }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col items-center gap-1 pt-0.5 shrink-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: "inline-flex items-center rounded-full bg-[rgba(255,107,0,0.18)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#ffb787] ring-1 ring-[rgba(255,107,0,0.35)]",
              title: "Sponsored placement matched by Dexter Instinct",
              children: "Sponsored"
            }
          ) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-baseline justify-between gap-2 flex-wrap", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-base font-semibold text-primary leading-tight", children: recommendation.sponsor }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] uppercase tracking-[0.14em] text-[#ff9a52]/80", children: "You might want this next" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1.5 text-sm leading-5 text-secondary line-clamp-2", children: recommendation.description }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex items-center gap-2 text-[11px] text-tertiary min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center rounded bg-surface-secondary/70 px-1.5 py-0.5 font-mono text-[10px] text-secondary ring-1 ring-white/5", children: method }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate font-mono text-[11px]", title: recommendation.resourceUrl, children: display })
            ] })
          ] }),
          onAct && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shrink-0 self-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              variant: "solid",
              color: "primary",
              size: "sm",
              onClick: (e) => {
                e.stopPropagation();
                onAct(recommendation.resourceUrl, method);
              },
              children: "Try this →"
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 pt-2 border-t border-[rgba(255,107,0,0.12)] flex items-center justify-between text-[10px] text-tertiary", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "via Dexter Instinct" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "opacity-60", children: "Recommendations are matched by capability, not by bid." })
        ] })
      ]
    }
  );
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
              ] }) : toolOutput.data !== void 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(JsonViewer, { data: toolOutput.data }) : null,
              toolOutput.recommendations && toolOutput.recommendations.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
                SponsoredCard,
                {
                  recommendation: toolOutput.recommendations[0],
                  onAct: (url) => openExternal(url)
                }
              )
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
  root.setAttribute("data-widget-build", "2026-05-04.sponsored-card");
  clientExports.createRoot(root).render(/* @__PURE__ */ jsxRuntimeExports.jsx(FetchResult, {}));
}
