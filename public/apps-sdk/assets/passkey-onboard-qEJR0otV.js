import { j as jsxRuntimeExports, u as useToolOutput, r as reactExports, i as openLink } from "./adapter-Cqp56u5t.js";
/* empty css             */
import { c as clientExports } from "./client-DVhZ5jh_.js";
import { a as useCallToolFn } from "./use-call-tool-ClsA_gLD.js";
const WORDMARK_URL = "https://dexter.cash/wordmarks/dexter-wordmark.svg";
const POLL_INTERVAL_MS = 3e3;
const ENROLL_URL = "https://dexter.cash/wallet/setup-passkey";
function PasskeyOnboard() {
  const toolOutput = useToolOutput();
  const callTool = useCallToolFn();
  const [polling, setPolling] = reactExports.useState(false);
  const [openedAt, setOpenedAt] = reactExports.useState(null);
  const pollingRef = reactExports.useRef(false);
  const callToolRef = reactExports.useRef(callTool);
  callToolRef.current = callTool;
  reactExports.useEffect(() => {
    if (toolOutput?.vault_status === "ready" && pollingRef.current) {
      pollingRef.current = false;
      setPolling(false);
    }
  }, [toolOutput?.vault_status]);
  reactExports.useEffect(() => {
    if (!polling) return;
    pollingRef.current = true;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !pollingRef.current) return;
      try {
        await callToolRef.current("dexter_passkey", {});
      } catch {
      }
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [polling]);
  const onTapEnroll = reactExports.useCallback(() => {
    const url = toolOutput?.enroll_url || ENROLL_URL;
    openLink(url);
    setOpenedAt(Date.now());
    setPolling(true);
    pollingRef.current = true;
  }, [toolOutput?.enroll_url]);
  const onTapPair = reactExports.useCallback(() => {
    const url = toolOutput?.pairing_url;
    if (url) openLink(url);
    setOpenedAt(Date.now());
    setPolling(true);
    pollingRef.current = true;
  }, [toolOutput?.pairing_url]);
  if (!toolOutput) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Header, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__stage", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-passkey__disc", children: /* @__PURE__ */ jsxRuntimeExports.jsx(KeyGlyph, {}) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-passkey__stage-supporting", children: "Loading wallet status…" })
      ] })
    ] });
  }
  const status = toolOutput.vault_status;
  if (status === "user_not_paired" || toolOutput.user_bound === false) {
    const pairingUrl = toolOutput.pairing_url;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Header, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__stage", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-passkey__disc", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LinkGlyph, {}) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "dx-passkey__stage-heading", children: "Link your Dexter account first" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-passkey__stage-supporting", children: "Your Dexter wallet is tied to your Dexter account. Sign in to dexter.cash and the wallet will follow." }),
        pairingUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "dx-passkey__cta", onClick: onTapPair, children: "Sign in on dexter.cash" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-passkey__error", children: "Couldn't mint a sign-in link. Refresh the chat and try again." })
      ] })
    ] });
  }
  if (status === "error") {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Header, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__stage", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-passkey__disc", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorGlyph, {}) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "dx-passkey__stage-heading", children: "Couldn't load wallet status" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-passkey__error", children: toolOutput.error || "Unexpected error reading vault status." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "dx-passkey__cta dx-passkey__cta--secondary",
            onClick: () => void callTool("dexter_passkey", {}),
            children: "Try again"
          }
        )
      ] })
    ] });
  }
  if (status === "ready") {
    const vault = toolOutput.vault_address || "";
    const swig = toolOutput.swig_address || "";
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Header, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__stage dx-passkey__stage--ready", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-passkey__disc", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CheckGlyph, {}) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "dx-passkey__stage-heading", children: "Your Dexter wallet is live" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-passkey__stage-supporting", children: "Passkey-secured, on Solana mainnet. One signature controls everything." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__vault", children: [
          vault && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__vault-row", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-passkey__vault-key", children: "Vault" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-passkey__vault-val", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "a",
              {
                href: `https://solscan.io/account/${vault}`,
                target: "_blank",
                rel: "noreferrer",
                children: abbreviateAddress(vault)
              }
            ) })
          ] }),
          swig && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__vault-row", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-passkey__vault-key", children: "Swig" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-passkey__vault-val", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "a",
              {
                href: `https://solscan.io/account/${swig}`,
                target: "_blank",
                rel: "noreferrer",
                children: abbreviateAddress(swig)
              }
            ) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__status", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-passkey__status-dot dx-passkey__status-dot--ready" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "vault active" })
        ] })
      ] })
    ] });
  }
  if (status === "provisioning") {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Header, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__stage dx-passkey__stage--provisioning", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__disc", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(KeyGlyph, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-passkey__spinner", "aria-hidden": true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-passkey__spinner-dot" }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "dx-passkey__stage-heading", children: "Finishing your wallet" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-passkey__stage-supporting", children: "Passkey enrolled. Now provisioning the vault on Solana — this takes a few seconds." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "dx-passkey__cta dx-passkey__cta--secondary",
            onClick: onTapEnroll,
            children: "Resume on dexter.cash"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(PollStatus, { polling, openedAt })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Header, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__stage dx-passkey__stage--not-enrolled", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__disc", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(KeyGlyph, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-passkey__pulse", "aria-hidden": true })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "dx-passkey__stage-heading", children: "Set up your Dexter wallet" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-passkey__stage-supporting", children: "One passkey, one vault on Solana. No seed phrases, no extensions. Tap to start the ceremony at dexter.cash." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "dx-passkey__cta", onClick: onTapEnroll, children: "Set up wallet on dexter.cash" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(PollStatus, { polling, openedAt })
    ] })
  ] });
}
function Header() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__header", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: WORDMARK_URL, alt: "Dexter", className: "dx-passkey__wordmark" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-passkey__eyebrow", children: "passkey wallet" })
  ] });
}
function PollStatus({ polling, openedAt }) {
  const [, force] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => force((n) => n + 1), 1e3);
    return () => clearInterval(id);
  }, [polling]);
  if (!polling) return null;
  const elapsed = openedAt ? Math.max(0, Math.floor((Date.now() - openedAt) / 1e3)) : 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-passkey__status", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-passkey__status-dot dx-passkey__status-dot--polling" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
      "watching for completion · ",
      elapsed,
      "s"
    ] })
  ] });
}
function abbreviateAddress(addr) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function KeyGlyph() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 48 48", className: "dx-passkey__disc-glyph", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "17", cy: "24", r: "7" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M24 24 L40 24" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M36 24 L36 30" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M40 24 L40 28" })
  ] });
}
function CheckGlyph() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 48 48", className: "dx-passkey__disc-glyph", fill: "none", stroke: "var(--dx-success)", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "24", cy: "24", r: "18", stroke: "currentColor" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M16 24 L22 30 L34 18" })
  ] });
}
function LinkGlyph() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 48 48", className: "dx-passkey__disc-glyph", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M20 28 L28 20" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M16 32 a 6 6 0 0 1 0 -8 l 4 -4" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M32 16 a 6 6 0 0 1 0 8 l -4 4" })
  ] });
}
function ErrorGlyph() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 48 48", className: "dx-passkey__disc-glyph", fill: "none", stroke: "var(--dx-danger)", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "24", cy: "24", r: "18", stroke: "currentColor" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M24 16 L24 26" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "24", cy: "32", r: "1.5", fill: "currentColor", stroke: "none" })
  ] });
}
const root = document.getElementById("passkey-onboard-root");
if (root) {
  clientExports.createRoot(root).render(/* @__PURE__ */ jsxRuntimeExports.jsx(PasskeyOnboard, {}));
}
