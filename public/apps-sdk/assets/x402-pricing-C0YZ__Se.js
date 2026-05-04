import { j as jsxRuntimeExports, u as useToolOutput, g as useToolInput, h as useAdaptiveCallToolFn, f as useAdaptiveTheme, r as reactExports } from "./adapter-DSGU3rCd.js";
import { B as Button } from "./Button-B7sB7SfF.js";
import { c as clientExports } from "./types-CzSJWBfH.js";
import { B as Badge } from "./index-B5hi6QAN.js";
import { D as DebugPanel, g as getChain, a as ChainIcon, C as CopyButton } from "./DebugPanel-Bz7iM-lB.js";
import { A as Alert } from "./Alert-BIf_2xcD.js";
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
function pickCheapestIndex(options) {
  if (!options.length) return -1;
  return options.reduce(
    (best, current, idx) => current.price < options[best].price ? idx : best,
    0
  );
}
function isFreeEndpoint(payload) {
  if (payload.free) return true;
  if (payload.requiresPayment) return false;
  const code = payload.statusCode;
  return Boolean(code && code >= 200 && code < 300);
}
function isPricingUnavailable(payload) {
  if (payload.error) return true;
  if (payload.requiresPayment && !(payload.paymentOptions || []).length) return true;
  return false;
}
function unavailableMessage(payload) {
  return payload.message || (typeof payload.error === "string" ? payload.error : void 0) || "No payment options are currently available for this endpoint.";
}
function StateFrame({
  theme,
  maxHeight,
  children,
  scroll = false,
  containerRef
}) {
  const className = scroll ? "p-4 flex flex-col gap-4 overflow-y-auto" : "p-4";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      "data-theme": theme,
      ref: containerRef,
      className,
      style: { maxHeight: maxHeight ?? void 0 },
      children
    }
  );
}
function PricingHeader({ x402Version }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative overflow-hidden rounded-xl px-4 pt-4 pb-3 bg-surface/70", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: LOGO_MARK_URL,
            alt: "Dexter logo",
            width: 24,
            height: 24,
            style: { width: 24, height: 24, flexShrink: 0 }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: WORDMARK_URL,
            alt: "Dexter",
            height: 22,
            style: { height: 22, width: "auto", opacity: 0.9 }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary", children: "Pricing" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-1.5", children: [
        x402Version && /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { color: "info", variant: "outline", children: [
          "v",
          x402Version
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "warning", children: "402" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex flex-col gap-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "heading-lg", children: "Payment Required" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-secondary", children: "Select the best settlement route before execution." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "absolute bottom-0 left-4 right-4 h-px",
        style: {
          background: "linear-gradient(90deg, #ff6b00 0%, transparent 100%)",
          opacity: 0.18
        }
      }
    )
  ] });
}
function ResourceUrl({ url }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-xl bg-surface-secondary px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-mono text-tertiary break-all", children: url }) });
}
function PaymentOptionRow({
  option,
  isBest
}) {
  const { name: chainName } = getChain(option.network);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `flex items-center gap-3 px-4 py-3 rounded-2xl ${isBest ? "bg-surface-secondary shadow-[0_0_0_1px_rgba(255,107,0,0.14)]" : "bg-surface-secondary/60"}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ChainIcon, { network: option.network, size: 20 }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col flex-1 min-w-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium", children: chainName }),
            isBest && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "success", size: "sm", children: "Best" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-1 min-w-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary", children: "USDC" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1 min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-mono text-tertiary truncate", children: shortenAddress(option.payTo) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              CopyButton,
              {
                copyValue: option.payTo,
                variant: "ghost",
                color: "secondary",
                size: "sm"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "heading-sm flex-shrink-0", children: option.priceFormatted })
      ]
    }
  );
}
function PaymentOptionList({
  options,
  cheapestIndex
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-2", children: options.map((opt, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(PaymentOptionRow, { option: opt, isBest: i === cheapestIndex }, i)) });
}
function FetchAction({
  selectedPrice,
  onFetch
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { color: "primary", block: true, onClick: onFetch, children: [
    "Fetch & Pay",
    selectedPrice ? ` ${selectedPrice}` : ""
  ] });
}
function useElapsedSeconds(pending) {
  const [elapsed, setElapsed] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((e) => e + 1), 1e3);
    return () => clearInterval(t);
  }, [pending]);
  return elapsed;
}
function PricingCheck() {
  const toolOutput = useToolOutput();
  const toolInput = useToolInput();
  const callTool = useAdaptiveCallToolFn();
  const sendFollowUp = useSendFollowUp();
  const theme = useAdaptiveTheme();
  const maxHeight = useMaxHeight();
  const containerRef = useIntrinsicHeight();
  const loadingElapsed = useElapsedSeconds(!toolOutput);
  reactExports.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  if (!toolOutput) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(StateFrame, { theme, maxHeight, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-secondary", children: loadingElapsed < 5 ? "Checking pricing..." : "Still probing endpoint — hang tight." }) });
  }
  if (toolOutput.authRequired) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(StateFrame, { theme, maxHeight, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Alert,
      {
        color: "warning",
        title: "Authentication Required",
        description: `This endpoint requires provider authentication before the x402 payment flow.${toolOutput.message ? " " + toolOutput.message : ""}`
      }
    ) });
  }
  if (isPricingUnavailable(toolOutput)) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(StateFrame, { theme, maxHeight, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Alert,
      {
        color: "danger",
        title: "Pricing Unavailable",
        description: unavailableMessage(toolOutput)
      }
    ) });
  }
  if (isFreeEndpoint(toolOutput)) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(StateFrame, { theme, maxHeight, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-default bg-surface p-4 flex flex-col gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "heading-sm", children: "Endpoint Check" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "success", children: "Free" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-secondary", children: "No payment required -- this endpoint is free to use." })
    ] }) });
  }
  const options = toolOutput.paymentOptions || [];
  const cheapestIndex = pickCheapestIndex(options);
  const selectedPrice = cheapestIndex >= 0 ? options[cheapestIndex].priceFormatted : null;
  const handleFetch = async () => {
    if (!toolInput?.url) return;
    await sendFollowUp({
      prompt: `Paying ${selectedPrice || "the listed price"} to call ${toolInput.url}`,
      scrollToBottom: false
    });
    await callTool("x402_fetch", {
      url: toolInput.url,
      method: toolInput.method || "GET"
    });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    StateFrame,
    {
      theme,
      maxHeight,
      scroll: true,
      containerRef,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "relative overflow-hidden rounded-2xl border border-default bg-surface p-4 flex flex-col gap-4",
          style: {
            background: "linear-gradient(135deg, rgba(209,63,0,0.08) 0%, rgba(255,107,0,0.04) 52%, transparent 100%)"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(PricingHeader, { x402Version: toolOutput.x402Version }),
            toolInput?.url && /* @__PURE__ */ jsxRuntimeExports.jsx(ResourceUrl, { url: toolInput.url }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(PaymentOptionList, { options, cheapestIndex }),
            toolInput?.url && /* @__PURE__ */ jsxRuntimeExports.jsx(FetchAction, { selectedPrice, onFetch: handleFetch }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Alert,
              {
                color: "info",
                variant: "soft",
                description: "Route and fee details are resolved live at execution time."
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DebugPanel, { widgetName: "x402-pricing" })
          ]
        }
      )
    }
  );
}
const root = document.getElementById("x402-pricing-root");
if (root) {
  root.setAttribute("data-widget-build", "2026-03-04.2");
  clientExports.createRoot(root).render(/* @__PURE__ */ jsxRuntimeExports.jsx(PricingCheck, {}));
}
