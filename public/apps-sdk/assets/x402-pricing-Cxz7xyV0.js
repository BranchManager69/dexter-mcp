import { j as jsxRuntimeExports, u as useToolOutput, g as useToolInput, h as useAdaptiveCallToolFn, f as useAdaptiveTheme, r as reactExports } from "./adapter-DSGU3rCd.js";
import { B as Button } from "./Button-ChA0Xis5.js";
import { c as clientExports } from "./types-CzSJWBfH.js";
import { B as Badge } from "./index-CYEoBVLo.js";
import { g as getChain, a as ChainIcon, C as CopyButton, D as DebugPanel } from "./DebugPanel-C2xsmSU-.js";
import { A as Alert } from "./Alert-DRgwUNSw.js";
import { u as useMaxHeight } from "./use-max-height-_e37jL2O.js";
import { u as useSendFollowUp } from "./use-send-followup-DfEQBBoC.js";
import { u as useIntrinsicHeight } from "./useIntrinsicHeight-B0m6hBCQ.js";
import "./Check-CAIG7aXU.js";
import "./Copy-DpRQuf1N.js";
import "./Warning-LBzaUP6h.js";
import "./use-openai-global-CzM08Fyj.js";
const WORDMARK_URL = "https://dexter.cash/wordmarks/dexter-wordmark.svg";
const LOGO_MARK_URL = "https://dexter.cash/assets/pokedexter/dexter-logo.svg";
function shortenAddress(addr) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function PricingCheck() {
  const toolOutput = useToolOutput();
  const toolInput = useToolInput();
  const callTool = useAdaptiveCallToolFn();
  const theme = useAdaptiveTheme();
  const maxHeight = useMaxHeight();
  const containerRef = useIntrinsicHeight();
  reactExports.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const [loadingElapsed, setLoadingElapsed] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (toolOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1e3);
    return () => clearInterval(t);
  }, [toolOutput]);
  if (!toolOutput) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-theme": theme, className: "p-4", style: { maxHeight: maxHeight ?? void 0 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-secondary", children: loadingElapsed < 5 ? "Checking pricing..." : "Still probing endpoint — hang tight." }) });
  }
  if (toolOutput.authRequired) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-theme": theme, className: "p-4", style: { maxHeight: maxHeight ?? void 0 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Alert, { color: "warning", title: "Authentication Required", description: `This endpoint requires provider authentication before the x402 payment flow.${toolOutput.message ? " " + toolOutput.message : ""}` }) });
  }
  if (toolOutput.error || toolOutput.requiresPayment && !(toolOutput.paymentOptions || []).length) {
    const message = toolOutput.message || (typeof toolOutput.error === "string" ? toolOutput.error : void 0) || "No payment options are currently available for this endpoint.";
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-theme": theme, className: "p-4", style: { maxHeight: maxHeight ?? void 0 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Alert, { color: "danger", title: "Pricing Unavailable", description: message }) });
  }
  if (toolOutput.free || !toolOutput.requiresPayment && toolOutput.statusCode && toolOutput.statusCode >= 200 && toolOutput.statusCode < 300) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-theme": theme, className: "p-4", style: { maxHeight: maxHeight ?? void 0 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-default bg-surface p-4 flex flex-col gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "heading-sm", children: "Endpoint Check" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "success", children: "Free" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-secondary", children: "No payment required -- this endpoint is free to use." })
    ] }) });
  }
  const options = toolOutput.paymentOptions || [];
  const cheapestIndex = options.length ? options.reduce((best, current, idx) => current.price < options[best].price ? idx : best, 0) : -1;
  const selectedPrice = cheapestIndex >= 0 ? options[cheapestIndex].priceFormatted : null;
  const sendFollowUp = useSendFollowUp();
  const handleFetch = async () => {
    if (!toolInput?.url) return;
    await sendFollowUp({
      prompt: `Paying ${selectedPrice || "the listed price"} to call ${toolInput.url}`,
      scrollToBottom: false
    });
    await callTool("x402_fetch", { url: toolInput.url, method: toolInput.method || "GET" });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-theme": theme, ref: containerRef, className: "p-4 flex flex-col gap-4 overflow-y-auto", style: { maxHeight: maxHeight ?? void 0 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "relative overflow-hidden rounded-2xl border border-default bg-surface p-4 flex flex-col gap-4",
      style: { background: "linear-gradient(135deg, rgba(209,63,0,0.08) 0%, rgba(255,107,0,0.04) 52%, transparent 100%)" },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative overflow-hidden rounded-xl px-4 pt-4 pb-3 bg-surface/70", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: LOGO_MARK_URL, alt: "Dexter logo", width: 24, height: 24, style: { width: 24, height: 24, flexShrink: 0 } }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: WORDMARK_URL, alt: "Dexter", height: 22, style: { height: 22, width: "auto", opacity: 0.9 } }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary", children: "Pricing" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-1.5", children: [
              toolOutput.x402Version && /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { color: "info", variant: "outline", children: [
                "v",
                toolOutput.x402Version
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "warning", children: "402" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "heading-lg", children: "Payment Required" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-secondary", children: "Select the best settlement route before execution." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute bottom-0 left-4 right-4 h-px", style: { background: "linear-gradient(90deg, #ff6b00 0%, transparent 100%)", opacity: 0.18 } })
        ] }),
        toolInput?.url && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-xl bg-surface-secondary px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-mono text-tertiary break-all", children: toolInput.url }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-2", children: options.map((opt, i) => {
          const { name: chainName } = getChain(opt.network);
          const isBest = i === cheapestIndex;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `flex items-center gap-3 px-4 py-3 rounded-2xl ${isBest ? "bg-surface-secondary shadow-[0_0_0_1px_rgba(255,107,0,0.14)]" : "bg-surface-secondary/60"}`, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChainIcon, { network: opt.network, size: 20 }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col flex-1 min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium", children: chainName }),
                isBest && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "success", size: "sm", children: "Best" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-1 min-w-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary", children: "USDC" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1 min-w-0", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-mono text-tertiary truncate", children: shortenAddress(opt.payTo) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(CopyButton, { copyValue: opt.payTo, variant: "ghost", color: "secondary", size: "sm" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "heading-sm flex-shrink-0", children: opt.priceFormatted })
          ] }, i);
        }) }),
        toolInput?.url && /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { color: "primary", block: true, onClick: handleFetch, children: [
          "Fetch & Pay",
          selectedPrice ? ` ${selectedPrice}` : ""
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Alert, { color: "info", variant: "soft", description: "Route and fee details are resolved live at execution time." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DebugPanel, { widgetName: "x402-pricing" })
      ]
    }
  ) });
}
const root = document.getElementById("x402-pricing-root");
if (root) {
  root.setAttribute("data-widget-build", "2026-03-04.2");
  clientExports.createRoot(root).render(/* @__PURE__ */ jsxRuntimeExports.jsx(PricingCheck, {}));
}
