import { j as jsxRuntimeExports, r as reactExports, d as addWidgetBreadcrumb, b as captureWidgetException } from "./adapter-DSGU3rCd.js";
import { B as Button } from "./Button-ChA0Xis5.js";
import { c as clientExports, S as SET_GLOBALS_EVENT_TYPE } from "./types-CzSJWBfH.js";
import { S as Search } from "./Search-DPxG9ijK.js";
import { W as Warning } from "./Warning-LBzaUP6h.js";
import { E as EmptyMessage } from "./EmptyMessage-CQGftd-_.js";
import { a as useCallToolFn } from "./use-call-tool-DSp1P910.js";
import { C as CopyButton, a as ChainIcon, U as UsdcIcon, D as DebugPanel } from "./DebugPanel-C2xsmSU-.js";
import { J as JsonViewer } from "./JsonViewer-BBB7i5Zv.js";
import "./Check-CAIG7aXU.js";
import "./Copy-DpRQuf1N.js";
const WORDMARK_URL = "https://dexter.cash/wordmarks/dexter-wordmark.svg";
function MarketplaceSummaryHeader({
  queryValue,
  onQueryChange,
  onSearchSubmit,
  resultCount,
  strongCount,
  relatedCount,
  rerankApplied = false,
  isSearching,
  isFullscreen,
  onToggleFullscreen
}) {
  const hasTieredCounts = typeof strongCount === "number" && typeof relatedCount === "number";
  const tierLabel = hasTieredCounts ? `${strongCount} strong · ${relatedCount} related` : `${resultCount.toLocaleString()} result${resultCount !== 1 ? "s" : ""}`;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "relative overflow-hidden rounded-[24px] border border-[rgba(255,107,0,0.16)] px-4 py-4 sm:px-5",
      style: {
        background: "linear-gradient(180deg, rgba(255,107,0,0.09) 0%, rgba(255,107,0,0.03) 22%, rgba(255,255,255,0.01) 58%, rgba(0,0,0,0) 100%)"
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: "pointer-events-none absolute inset-x-10 top-0 h-px",
            style: { background: "linear-gradient(90deg, transparent 0%, rgba(255,107,0,0.28) 36%, rgba(255,107,0,0.06) 64%, transparent 100%)" }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2 text-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: WORDMARK_URL, alt: "Dexter", height: 20, style: { height: 20, width: "auto", opacity: 0.95 } }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.28em] text-tertiary", children: "X402 Search" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-stretch gap-2 rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.02)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-transparent px-2.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Search, {}),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    value: queryValue,
                    onChange: (event) => onQueryChange(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onSearchSubmit();
                      }
                    },
                    placeholder: "Search paid APIs...",
                    className: "w-full border-0 bg-transparent py-2 text-sm text-primary outline-none placeholder:text-tertiary"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { color: "primary", size: "sm", onClick: onSearchSubmit, disabled: isSearching, children: isSearching ? "Searching…" : "Search" })
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 self-start sm:self-auto", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] text-tertiary", children: tierLabel }),
              rerankApplied && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "span",
                {
                  className: "inline-flex items-center rounded-full bg-[rgba(255,107,0,0.1)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ff9a52] ring-1 ring-[rgba(255,107,0,0.28)]",
                  title: "Top results reordered by an LLM cross-encoder pass",
                  children: "Reranked"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "soft", color: "secondary", size: "sm", onClick: onToggleFullscreen, children: isFullscreen ? "Minimize" : "Expand" })
            ] })
          ] })
        ] })
      ]
    }
  );
}
function formatCompactNumber(value) {
  if (value == null || Number.isNaN(value)) return "0";
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}
function shortenUrl(url) {
  try {
    const parsed = new URL(url);
    const compactPath = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    return compactPath.length > 72 ? `${compactPath.slice(0, 69)}...` : compactPath;
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}
function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return shortenUrl(url);
  }
}
function looksLikeWalletFragment(label, payTo) {
  const trimmed = label.trim();
  if (!trimmed) return true;
  if (payTo && trimmed === payTo.slice(0, trimmed.length)) return true;
  if (/^(0x[a-fA-F0-9]{6,}|[1-9A-HJ-NP-Za-km-z]{8,})$/.test(trimmed) && !/\s/.test(trimmed)) return true;
  return false;
}
function providerDisplayName(resource) {
  const sellerName = resource.sellerMeta.displayName?.trim() || resource.seller?.trim() || "";
  if (sellerName && !looksLikeWalletFragment(sellerName, resource.sellerMeta.payTo)) {
    return sellerName;
  }
  return hostLabel(resource.url);
}
function resourceIconUrl(resource) {
  if (resource.iconUrl) return resource.iconUrl;
  try {
    const hostname = new URL(resource.url).hostname;
    return `https://dexter.cash/api/favicon?domain=${encodeURIComponent(hostname)}`;
  } catch {
    return resource.sellerMeta.logoUrl || "";
  }
}
function scoreTone(score) {
  if (score == null || score <= 0) return "none";
  if (score >= 80) return "good";
  if (score >= 65) return "warn";
  return "low";
}
function SearchIdentityIcon({ resource, size = 44 }) {
  const src = reactExports.useMemo(() => resourceIconUrl(resource), [resource]);
  const [failed, setFailed] = reactExports.useState(false);
  const label = hostLabel(resource.url).slice(0, 1).toUpperCase() || "?";
  if (!src || failed) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "flex items-center justify-center rounded-[18px] border border-subtle bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] text-sm font-semibold text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        style: { width: size, height: size },
        "aria-hidden": "true",
        children: label
      }
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "img",
    {
      src,
      alt: "",
      width: size,
      height: size,
      className: "rounded-[18px] border border-subtle bg-surface-secondary object-cover shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
      style: { width: size, height: size },
      onError: () => setFailed(true),
      "aria-hidden": "true"
    }
  );
}
function toneClasses(tone) {
  if (tone === "good") {
    return "border-emerald-500/28 bg-emerald-500/10 text-emerald-300 shadow-[0_6px_18px_rgba(16,185,129,0.14)]";
  }
  if (tone === "warn") {
    return "border-amber-500/28 bg-amber-500/10 text-amber-300 shadow-[0_6px_18px_rgba(245,158,11,0.12)]";
  }
  if (tone === "low") {
    return "border-rose-500/28 bg-rose-500/10 text-rose-300 shadow-[0_6px_18px_rgba(244,63,94,0.12)]";
  }
  return "border-subtle bg-surface-secondary text-tertiary";
}
function SearchScoreBadge({
  score,
  variant = "card"
}) {
  const tone = scoreTone(score);
  const sizeClasses = variant === "detail" ? "min-h-[52px] min-w-[52px] text-xl rounded-[18px]" : "min-h-[40px] min-w-[40px] text-base rounded-[14px]";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: `inline-flex items-center justify-center border px-2.5 py-2 font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${sizeClasses} ${toneClasses(tone)}`,
      title: score != null ? `AI verification score ${score}` : "No AI verification score yet",
      children: score != null && score > 0 ? score : "—"
    }
  );
}
function SearchResultCard({
  resource,
  index,
  featured = false,
  selected = false,
  onInspect,
  onCheckPrice,
  onFetch
}) {
  const [visible, setVisible] = reactExports.useState(false);
  const [checking, setChecking] = reactExports.useState(false);
  const [fetching, setFetching] = reactExports.useState(false);
  reactExports.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50 + index * 35);
    return () => clearTimeout(t);
  }, [index]);
  async function handleCheckPrice(e) {
    e.stopPropagation();
    setChecking(true);
    try {
      await onCheckPrice(resource);
    } finally {
      setChecking(false);
    }
  }
  async function handleFetch(e) {
    e.stopPropagation();
    setFetching(true);
    try {
      await onFetch(resource);
    } finally {
      setFetching(false);
    }
  }
  const providerName = providerDisplayName(resource);
  const compactUrl = shortenUrl(resource.url);
  const chainOptions = resource.chains?.length ? resource.chains : [{ network: resource.network ?? null }];
  const visibleChainOptions = chainOptions.filter((chain, chainIndex, list) => {
    const key = chain.network ?? "unknown";
    return list.findIndex((item) => (item.network ?? "unknown") === key) === chainIndex;
  });
  const fetchLabel = resource.price === "free" ? "Fetch free" : resource.price.replace(/^\$/, "");
  const tier = resource.tier;
  const similarityPct = typeof resource.similarity === "number" && resource.similarity > 0 ? Math.round(resource.similarity * 100) : null;
  const whyText = resource.why?.trim() || "";
  const gamingSuspicious = resource.gamingSuspicious === true;
  const gamingFlags = Array.isArray(resource.gamingFlags) ? resource.gamingFlags : [];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `group relative rounded-[24px] border p-4 transition-all duration-300 ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"} ${selected ? "border-[#ff6b00]/45 bg-[rgba(255,107,0,0.06)] shadow-[0_0_0_1px_rgba(255,107,0,0.12),0_18px_40px_rgba(255,107,0,0.10)]" : featured ? "border-[#ff6b00]/20 bg-surface shadow-[0_14px_32px_rgba(255,107,0,0.06)]" : "border-default bg-surface"} hover:border-[#ff6b00]/38`,
      onClick: () => onInspect(resource),
      role: "button",
      tabIndex: 0,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute right-4 top-4 z-10 flex items-center gap-1.5", children: [
          tier === "strong" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center rounded-full bg-[rgba(255,107,0,0.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ff9a52] ring-1 ring-[rgba(255,107,0,0.32)]", children: "Strong" }),
          tier === "related" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-tertiary ring-1 ring-white/10", children: "Related" }),
          similarityPct !== null && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "span",
            {
              className: "inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-secondary ring-1 ring-white/8",
              title: "Cosine similarity between your query and this resource",
              children: [
                similarityPct,
                "%"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(SearchScoreBadge, { score: resource.qualityScore, variant: "card" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3 pr-14 sm:pr-16", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(SearchIdentityIcon, { resource }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "pr-1 text-lg font-semibold leading-snug text-primary [overflow-wrap:anywhere]", children: resource.name }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-primary/90", children: providerName }),
                  resource.verified && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: "✓" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Verified" })
                  ] }),
                  gamingSuspicious && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "span",
                    {
                      className: "inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300",
                      title: gamingFlags.length ? `Gaming signals: ${gamingFlags.join(", ")}` : "Usage signals look suspicious",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: "⚠" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Suspicious usage" })
                      ]
                    }
                  ),
                  resource.totalCalls > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-tertiary", children: [
                    formatCompactNumber(resource.totalCalls),
                    " calls"
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 flex items-center gap-2 text-[11px] text-tertiary", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate max-w-full", children: compactUrl }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    CopyButton,
                    {
                      copyValue: resource.url,
                      variant: "ghost",
                      color: "secondary",
                      size: "sm",
                      onClick: (e) => e.stopPropagation(),
                      children: "Copy"
                    }
                  )
                ] })
              ] }),
              whyText && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 rounded-xl border border-[rgba(255,107,0,0.18)] bg-[rgba(255,107,0,0.04)] px-3 py-2 text-xs leading-5 text-[#ffb787] sm:pr-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[9px] uppercase tracking-[0.2em] text-[#ff9a52]/80", children: "Why this matches" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1", children: whyText })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm leading-6 text-secondary sm:pr-4", children: resource.description || "No description yet. Inspect the endpoint before paying." })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5", children: [
              visibleChainOptions.map((chain, chainIndex) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center justify-center rounded-full bg-surface-secondary/90 p-1.5 ring-1 ring-white/5", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChainIcon, { network: chain.network, size: 16 }) }, `${chain.network ?? "unknown"}-${chainIndex}`)),
              resource.authRequired && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-amber-300", title: resource.authHint || "Provider authentication required.", children: "Auth required" })
            ] }),
            featured && tier === "strong" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] uppercase tracking-[0.16em] text-[#ff9a52]", children: "Top strong match" }),
            featured && tier !== "strong" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] uppercase tracking-[0.16em] text-tertiary", children: "Lead result" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "soft", color: "secondary", size: "sm", onClick: (e) => {
              e.stopPropagation();
              onInspect(resource);
            }, children: "Inspect" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "soft", color: "secondary", size: "sm", onClick: handleCheckPrice, disabled: checking, children: checking ? "Checking…" : "Check Price" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { className: "sm:ml-auto", color: "primary", size: "sm", onClick: handleFetch, disabled: fetching, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1.5", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: fetching ? "Fetching…" : "Fetch" }),
              !fetching && resource.price !== "free" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(UsdcIcon, { size: 14 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: fetchLabel })
              ] }),
              !fetching && resource.price === "free" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: fetchLabel.replace(/^Fetch /, "") })
            ] }) })
          ] })
        ] })
      ]
    }
  );
}
const API_ORIGIN = "https://api.dexter.cash";
function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1e3) return `${ms}ms`;
  return `${(ms / 1e3).toFixed(1)}s`;
}
function formatBytes(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatWhen(iso) {
  if (!iso) return "No verification timestamp";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown verification time";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function buildWhyBlock(resource) {
  if (resource.why && resource.why.trim().length > 0) return resource.why.trim();
  if (resource.verificationNotes) return resource.verificationNotes;
  if (resource.verified && (resource.qualityScore ?? 0) >= 85) {
    return "High-confidence candidate with strong verification and quality signals.";
  }
  if (resource.verified) {
    return "Positive trust signals, but inspect before paying.";
  }
  if (resource.authRequired) {
    return "Surfaced as a candidate, but this provider requires an auth step before it will behave cleanly.";
  }
  return "Candidate surfaced from the capability index — trust picture is still lightweight until more verification data lands.";
}
function buildDexterAssessment(resource, statusPayload) {
  if (statusPayload?.notes) return statusPayload.notes;
  if (resource.verificationNotes) return resource.verificationNotes;
  return buildWhyBlock(resource);
}
function SearchResourceDetail({
  resource,
  inline = false,
  onClose,
  onCheckPrice,
  onFetch
}) {
  const providerName = providerDisplayName(resource);
  const [historyLoading, setHistoryLoading] = reactExports.useState(true);
  const [schemaLoading, setSchemaLoading] = reactExports.useState(true);
  const [history, setHistory] = reactExports.useState([]);
  const [statusPayload, setStatusPayload] = reactExports.useState(null);
  const [schemaPayload, setSchemaPayload] = reactExports.useState(null);
  const [detailError, setDetailError] = reactExports.useState(null);
  const [selectedHistoryId, setSelectedHistoryId] = reactExports.useState(null);
  reactExports.useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setSchemaLoading(true);
    setDetailError(null);
    setSelectedHistoryId(null);
    async function loadDetail() {
      try {
        addWidgetBreadcrumb("detail_fetch_start", {
          resourceId: resource.resourceId,
          url: resource.url
        });
        const [historyRes, statusRes, schemaRes] = await Promise.all([
          fetch(`${API_ORIGIN}/api/x402gle/capability/resources/${encodeURIComponent(resource.resourceId)}/history?limit=10`, { cache: "no-store" }),
          fetch(`${API_ORIGIN}/api/x402gle/capability/resources/${encodeURIComponent(resource.resourceId)}/verification-status`, { cache: "no-store" }),
          fetch(`${API_ORIGIN}/api/facilitator/resource/schema?url=${encodeURIComponent(resource.url)}`, { cache: "no-store" })
        ]);
        const historyJson = await historyRes.json().catch(() => null);
        const statusJson = await statusRes.json().catch(() => null);
        const schemaJson = await schemaRes.json().catch(() => null);
        if (cancelled) return;
        setHistory(Array.isArray(historyJson?.history) ? historyJson.history : []);
        setStatusPayload(statusJson);
        setSchemaPayload(schemaJson);
        addWidgetBreadcrumb("detail_fetch_success", {
          resourceId: resource.resourceId,
          historyCount: Array.isArray(historyJson?.history) ? historyJson.history.length : 0,
          hasSchema: Boolean(schemaJson?.schema)
        });
      } catch (error) {
        if (cancelled) return;
        setDetailError(error instanceof Error ? error.message : "Failed to load endpoint detail");
        captureWidgetException(error, {
          phase: "detail_fetch",
          resourceId: resource.resourceId,
          url: resource.url
        });
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
          setSchemaLoading(false);
        }
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [resource.resourceId, resource.url]);
  reactExports.useEffect(() => {
    if (!history.length) return;
    const preferred = history.find((entry) => entry.ai_status === "pass") ?? history[0];
    setSelectedHistoryId(preferred.id);
  }, [history]);
  const selectedHistory = reactExports.useMemo(
    () => history.find((entry) => entry.id === selectedHistoryId) ?? history[0] ?? null,
    [history, selectedHistoryId]
  );
  const assessment = buildDexterAssessment(resource, statusPayload);
  const whyText = resource.why?.trim() || "";
  const similarityPct = typeof resource.similarity === "number" && resource.similarity > 0 ? Math.round(resource.similarity * 100) : null;
  const tier = resource.tier;
  const gamingSuspicious = resource.gamingSuspicious === true;
  const gamingFlags = Array.isArray(resource.gamingFlags) ? resource.gamingFlags : [];
  const chainOptions = resource.chains?.length ? resource.chains : [{ network: resource.network ?? null }];
  const fetchLabel = resource.price === "free" ? "free" : resource.price.replace(/^\$/, "");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "aside",
    {
      className: `rounded-[24px] border border-[rgba(255,107,0,0.18)] bg-surface p-4 shadow-[0_22px_48px_rgba(255,107,0,0.08)] ${inline ? "" : "sticky top-4"}`,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,107,0,0.10),rgba(255,107,0,0.03)_42%,rgba(255,255,255,0.02)_100%)] p-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SearchIdentityIcon, { resource, size: 52 }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.22em] text-tertiary", children: "Inspection Deck" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mt-1 text-lg font-semibold leading-tight text-primary [overflow-wrap:anywhere]", children: resource.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-xs text-tertiary", children: shortenUrl(resource.url) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: providerName }),
              resource.verified && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 text-emerald-400", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: "✓" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Verified" })
              ] }),
              statusPayload?.lastVerifiedAt && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-tertiary", children: [
                "Last checked ",
                formatWhen(statusPayload.lastVerifiedAt)
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-end gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(SearchScoreBadge, { score: statusPayload?.score ?? resource.qualityScore, variant: "detail" }),
            onClose && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "soft", color: "secondary", size: "sm", onClick: onClose, children: "Close" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-subtle bg-surface-secondary/80 px-3.5 py-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-2", children: chainOptions.map((chain, index) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center justify-center rounded-full bg-surface px-1.5 py-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChainIcon, { network: chain.network, size: 16 }) }, `${chain.network ?? "unknown"}-${index}`)) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "soft", color: "secondary", size: "sm", onClick: () => onCheckPrice(resource), children: "Check Price" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { color: "primary", size: "sm", onClick: () => onFetch(resource), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1.5", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Fetch" }),
              resource.price !== "free" && /* @__PURE__ */ jsxRuntimeExports.jsx(UsdcIcon, { size: 14 }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: fetchLabel })
            ] }) })
          ] })
        ] }),
        (whyText || similarityPct !== null || tier || gamingSuspicious) && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-[22px] border border-[rgba(255,107,0,0.22)] bg-[rgba(255,107,0,0.04)] px-4 py-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-[#ff9a52]", children: "Why This Result" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [
              tier === "strong" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center rounded-full bg-[rgba(255,107,0,0.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ff9a52] ring-1 ring-[rgba(255,107,0,0.32)]", children: "Strong" }),
              tier === "related" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-tertiary ring-1 ring-white/10", children: "Related" }),
              similarityPct !== null && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "span",
                {
                  className: "inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-secondary ring-1 ring-white/8",
                  title: "Cosine similarity between your query and this resource",
                  children: [
                    similarityPct,
                    "% match"
                  ]
                }
              ),
              gamingSuspicious && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "span",
                {
                  className: "inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 ring-1 ring-amber-500/30",
                  title: gamingFlags.length ? `Gaming signals: ${gamingFlags.join(", ")}` : "Usage signals look suspicious",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: "⚠" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Suspicious usage" })
                  ]
                }
              )
            ] })
          ] }),
          whyText && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm leading-6 text-[#ffcfa8]", children: whyText })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-[22px] border border-subtle bg-surface-secondary/80 px-4 py-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "Dexter Take" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm leading-6 text-secondary", children: assessment }),
            (statusPayload?.fixInstructions || resource.verificationFixInstructions) && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-xs leading-5 text-amber-300", children: statusPayload?.fixInstructions || resource.verificationFixInstructions })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-[22px] border border-subtle bg-surface-secondary/80 px-4 py-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "Provider" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 text-sm font-medium text-primary", children: providerName })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "Usage Signal" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 text-sm font-medium text-primary", children: resource.totalCalls > 0 ? `${formatCompactNumber(resource.totalCalls)} historical calls` : "No historical call count" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-4 border-t border-white/6 pt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "Endpoint" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 font-mono text-xs leading-5 text-secondary break-all", children: resource.url })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(CopyButton, { copyValue: resource.url, variant: "ghost", color: "secondary", size: "sm", children: "Copy" })
            ] }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-[22px] border border-subtle bg-surface-secondary/80 px-4 py-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "Verification History" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-tertiary", children: historyLoading ? "Loading…" : `${history.length} checks` })
          ] }),
          detailError ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm text-danger", children: detailError }) : historyLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 space-y-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-11 animate-pulse rounded-2xl bg-surface" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-11 animate-pulse rounded-2xl bg-surface" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-11 animate-pulse rounded-2xl bg-surface" })
          ] }) : history.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm text-tertiary", children: "No verification history yet." }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-4 space-y-2 border-l border-white/8 pl-4", children: history.map((entry) => {
            const active = selectedHistory?.id === entry.id;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                type: "button",
                onClick: () => setSelectedHistoryId(entry.id),
                className: `relative w-full rounded-2xl border px-3 py-3 text-left transition-colors ${active ? "border-[#ff6b00]/35 bg-surface shadow-[0_10px_22px_rgba(255,107,0,0.05)]" : "border-subtle bg-transparent hover:border-[#ff6b00]/20"}`,
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `absolute -left-[21px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${entry.ai_status === "pass" ? "bg-emerald-400" : entry.ai_status === "fail" ? "bg-rose-400" : "bg-amber-300"}` }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-secondary", children: formatWhen(entry.attempted_at) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-tertiary", children: entry.ai_status ?? "unknown" })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-primary", children: entry.ai_score ?? "—" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: formatDuration(entry.duration_ms) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-tertiary", children: entry.response_status ?? "—" }),
                      entry.paid && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-emerald-400", children: "Paid" })
                    ] })
                  ] })
                ]
              },
              entry.id
            );
          }) }),
          selectedHistory && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 rounded-2xl border border-subtle bg-surface px-3.5 py-3", children: [
            selectedHistory.ai_notes && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "AI Assessment" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm leading-6 text-secondary", children: selectedHistory.ai_notes })
            ] }),
            selectedHistory.ai_fix_instructions && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "How To Fix" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm leading-6 text-amber-300", children: selectedHistory.ai_fix_instructions })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-tertiary", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                "Probe ",
                selectedHistory.probe_status ?? "—"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                "HTTP ",
                selectedHistory.response_status ?? "—"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                "Duration ",
                formatDuration(selectedHistory.duration_ms)
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                "Size ",
                formatBytes(selectedHistory.response_size_bytes)
              ] })
            ] }),
            (selectedHistory.test_input_generated || selectedHistory.test_input_reasoning) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 space-y-3", children: [
              selectedHistory.test_input_reasoning && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "Why This Input" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm leading-6 text-secondary", children: selectedHistory.test_input_reasoning })
              ] }),
              selectedHistory.test_input_generated && /* @__PURE__ */ jsxRuntimeExports.jsx(JsonViewer, { data: selectedHistory.test_input_generated, title: "Generated Test Input", defaultExpanded: false })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-[22px] border border-subtle bg-surface-secondary/80 px-4 py-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-tertiary", children: "Schemas" }),
          schemaLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 h-20 animate-pulse rounded-2xl bg-surface" }) : schemaPayload?.schema ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 space-y-3", children: [
            schemaPayload.schema.input && /* @__PURE__ */ jsxRuntimeExports.jsx(JsonViewer, { data: schemaPayload.schema.input, title: "Input Schema", defaultExpanded: false }),
            schemaPayload.schema.output && /* @__PURE__ */ jsxRuntimeExports.jsx(JsonViewer, { data: schemaPayload.schema.output, title: "Output Schema", defaultExpanded: false }),
            !schemaPayload.schema.input && !schemaPayload.schema.output && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-tertiary", children: "Schema data exists, but no structured input/output contract was found." })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm text-tertiary", children: "No saved schema is available for this endpoint yet." })
        ] })
      ] })
    }
  );
}
function cloneJsonValue(value) {
  if (value === null || value === void 0) return value;
  if (typeof value !== "object") return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}
function readSearchWidgetSnapshot() {
  const openai = typeof window !== "undefined" ? window.openai : void 0;
  const userAgent = openai?.userAgent;
  return {
    toolOutput: cloneJsonValue(openai?.toolOutput ?? null),
    toolInput: cloneJsonValue(openai?.toolInput ?? null),
    theme: openai?.theme ?? "dark",
    maxHeight: typeof openai?.maxHeight === "number" ? openai.maxHeight : null,
    displayMode: openai?.displayMode ?? "inline",
    isMobile: userAgent?.device?.type === "mobile"
  };
}
function serializeSearchWidgetSnapshot(snapshot) {
  try {
    return JSON.stringify(snapshot);
  } catch {
    return String(Date.now());
  }
}
function useSearchWidgetSnapshot() {
  const [snapshot, setSnapshot] = reactExports.useState(() => readSearchWidgetSnapshot());
  const signatureRef = reactExports.useRef(serializeSearchWidgetSnapshot(snapshot));
  reactExports.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleGlobals = (event) => {
      const globals = event.detail?.globals;
      if (!globals) return;
      const relevantKeys = [
        "toolOutput",
        "toolInput",
        "theme",
        "maxHeight",
        "displayMode",
        "userAgent"
      ];
      if (!relevantKeys.some((key) => Object.prototype.hasOwnProperty.call(globals, key))) {
        return;
      }
      const next = readSearchWidgetSnapshot();
      const nextSignature = serializeSearchWidgetSnapshot(next);
      if (nextSignature === signatureRef.current) return;
      signatureRef.current = nextSignature;
      setSnapshot(next);
    };
    window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleGlobals, { passive: true });
    return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleGlobals);
  }, []);
  return snapshot;
}
function normalizeSearchResource(resource) {
  const sellerValue = resource.seller;
  const sellerMeta = resource.sellerMeta ?? {
    payTo: null,
    displayName: null,
    logoUrl: null,
    twitterHandle: null
  };
  if (sellerValue && typeof sellerValue === "object") {
    const sellerObj = sellerValue;
    return {
      ...resource,
      seller: typeof sellerObj.displayName === "string" ? sellerObj.displayName : null,
      sellerMeta: {
        payTo: typeof sellerObj.payTo === "string" ? sellerObj.payTo : sellerMeta.payTo ?? null,
        displayName: typeof sellerObj.displayName === "string" ? sellerObj.displayName : sellerMeta.displayName ?? null,
        logoUrl: typeof sellerObj.logoUrl === "string" ? sellerObj.logoUrl : sellerMeta.logoUrl ?? null,
        twitterHandle: typeof sellerObj.twitterHandle === "string" ? sellerObj.twitterHandle : sellerMeta.twitterHandle ?? null
      }
    };
  }
  return {
    ...resource,
    seller: typeof sellerValue === "string" ? sellerValue : null,
    sellerMeta
  };
}
function normalizeSearchPayload(payload) {
  if (!payload) return payload;
  const resources = Array.isArray(payload.resources) ? payload.resources.map(normalizeSearchResource) : [];
  const strongResults = Array.isArray(payload.strongResults) ? payload.strongResults.map(normalizeSearchResource) : void 0;
  const relatedResults = Array.isArray(payload.relatedResults) ? payload.relatedResults.map(normalizeSearchResource) : void 0;
  return {
    ...payload,
    resources,
    strongResults,
    relatedResults
  };
}
function MarketplaceSearch() {
  const { toolOutput, toolInput, theme, maxHeight, displayMode, isMobile } = useSearchWidgetSnapshot();
  const callTool = useCallToolFn();
  const isFullscreen = displayMode === "fullscreen";
  const [liveResult, setLiveResult] = reactExports.useState(null);
  const [isSearching, setIsSearching] = reactExports.useState(false);
  const activeOutput = reactExports.useMemo(
    () => normalizeSearchPayload(liveResult ?? toolOutput),
    [liveResult, toolOutput]
  );
  const externalQuery = toolInput?.query ?? "";
  const [queryDraft, setQueryDraft] = reactExports.useState(externalQuery);
  const [selectedUrl, setSelectedUrl] = reactExports.useState(void 0);
  const [detailOpen, setDetailOpen] = reactExports.useState(false);
  reactExports.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  reactExports.useEffect(() => {
    if (!liveResult) {
      setQueryDraft(externalQuery);
    }
  }, [externalQuery, liveResult]);
  reactExports.useEffect(() => {
    if (!activeOutput) return;
    addWidgetBreadcrumb("search_payload_normalized", {
      count: Array.isArray(activeOutput.resources) ? activeOutput.resources.length : 0
    });
  }, [activeOutput]);
  const strongResults = activeOutput?.strongResults ?? [];
  const relatedResults = activeOutput?.relatedResults ?? [];
  const hasTieredShape = strongResults.length > 0 || relatedResults.length > 0;
  const resources = hasTieredShape ? [...strongResults, ...relatedResults] : activeOutput?.resources ?? [];
  const strongCount = activeOutput?.strongCount ?? strongResults.length;
  const relatedCount = activeOutput?.relatedCount ?? relatedResults.length;
  const rerankApplied = activeOutput?.rerank?.applied === true;
  const noMatchReason = activeOutput?.noMatchReason ?? null;
  const searchMode = activeOutput?.searchMeta?.mode ?? "none";
  const searchNote = activeOutput?.searchMeta?.note ?? "";
  const effectiveSelectedUrl = reactExports.useMemo(() => {
    if (selectedUrl && resources.some((resource) => resource.url === selectedUrl)) {
      return selectedUrl;
    }
    return resources[0]?.url;
  }, [resources, selectedUrl]);
  const selectedResource = reactExports.useMemo(
    () => resources.find((resource) => resource.url === effectiveSelectedUrl) ?? resources[0] ?? null,
    [effectiveSelectedUrl, resources]
  );
  const runCheckPrice = reactExports.useCallback(async (resource) => {
    addWidgetBreadcrumb("check_price_clicked", { url: resource.url, method: resource.method });
    await callTool("x402_check", { url: resource.url, method: resource.method || "GET" });
  }, [callTool]);
  const runFetch = reactExports.useCallback(async (resource) => {
    addWidgetBreadcrumb("fetch_clicked", { url: resource.url, method: resource.method });
    await callTool("x402_fetch", { url: resource.url, method: resource.method || "GET" });
  }, [callTool]);
  const handleInspectResource = reactExports.useCallback(async (resource) => {
    addWidgetBreadcrumb("inspect_opened", { url: resource.url, resourceId: resource.resourceId });
    setSelectedUrl(resource.url);
    setDetailOpen(true);
  }, []);
  const handleCloseDetail = reactExports.useCallback(async () => {
    addWidgetBreadcrumb("inspect_closed");
    setDetailOpen(false);
  }, []);
  const handleSearchSubmit = reactExports.useCallback(async () => {
    const nextQuery = queryDraft.trim();
    addWidgetBreadcrumb("search_submit", { query: nextQuery });
    setIsSearching(true);
    try {
      const previousSelectedUrl = selectedUrl;
      const previousDetailOpen = detailOpen;
      const response = await callTool("x402_search", {
        query: nextQuery,
        limit: typeof toolInput?.limit === "number" ? toolInput.limit : void 0,
        unverified: typeof toolInput?.unverified === "boolean" ? toolInput.unverified : void 0,
        testnets: typeof toolInput?.testnets === "boolean" ? toolInput.testnets : void 0
      });
      const next = normalizeSearchPayload(response?.structuredContent ?? null);
      if (!next) return;
      setLiveResult(next);
      addWidgetBreadcrumb("search_result_loaded", {
        query: nextQuery,
        count: next.count,
        mode: next.searchMeta?.mode ?? "unknown"
      });
      const nextSelectedUrl = next.resources.some((resource) => resource.url === previousSelectedUrl) ? previousSelectedUrl : next.resources[0]?.url;
      setQueryDraft(nextQuery);
      setSelectedUrl(nextSelectedUrl);
      setDetailOpen(previousDetailOpen && Boolean(nextSelectedUrl));
    } catch (error) {
      captureWidgetException(error, { phase: "search_submit", query: nextQuery });
      throw error;
    } finally {
      setIsSearching(false);
    }
  }, [callTool, detailOpen, queryDraft, selectedUrl, toolInput]);
  const toggleFullscreen = reactExports.useCallback(() => {
    try {
      window.openai?.requestDisplayMode?.({ mode: isFullscreen ? "inline" : "fullscreen" });
    } catch (error) {
      captureWidgetException(error, { phase: "request_display_mode" });
    }
  }, [isFullscreen]);
  const [loadingElapsed, setLoadingElapsed] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (activeOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1e3);
    return () => clearInterval(t);
  }, [activeOutput]);
  if (!activeOutput) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-theme": theme, className: "p-4", style: { maxHeight: maxHeight ?? void 0 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(EmptyMessage, { className: "rounded-2xl border border-subtle bg-surface px-4 py-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Icon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Search, {}) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Title, { children: loadingElapsed < 5 ? "Building the market board…" : "Dexter is still surveying the market." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Description, { children: loadingElapsed < 5 ? "Ranking paid APIs and trust signals." : "This is taking longer than usual, but the search is still in flight." })
    ] }) });
  }
  if (activeOutput.error) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-theme": theme, className: "p-4", style: { maxHeight: maxHeight ?? void 0 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(EmptyMessage, { className: "rounded-2xl border border-subtle bg-surface px-4 py-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Icon, { color: "danger", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Warning, {}) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Title, { color: "danger", children: activeOutput.error }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Description, { children: "Dexter could not build the marketplace view for this request." })
    ] }) });
  }
  if (activeOutput.count === 0) {
    const queryLabel = externalQuery || queryDraft;
    const emptyTitle = noMatchReason === "below_strong_threshold" ? `Only weak matches${queryLabel ? ` for "${queryLabel}"` : ""}` : `No x402 APIs found${queryLabel ? ` for "${queryLabel}"` : ""}`;
    const emptyDescription = noMatchReason === "below_similarity_threshold" ? "Nothing in our capability index matches that query yet. Try rephrasing, or widen the description of what you want to do." : noMatchReason === "below_strong_threshold" ? "We found some adjacent services but nothing cleared the strong-match bar. Try a more specific verb for the capability you want." : "Try a broader query or a different angle.";
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-theme": theme, className: "p-4", style: { maxHeight: maxHeight ?? void 0 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(EmptyMessage, { className: "rounded-2xl border border-subtle bg-surface px-4 py-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Icon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Search, {}) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Title, { children: emptyTitle }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMessage.Description, { children: emptyDescription })
    ] }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      "data-theme": theme,
      className: `flex flex-col overflow-y-auto ${isFullscreen ? "p-5 sm:p-6" : "p-0"}`,
      style: { maxHeight: isFullscreen ? void 0 : maxHeight ?? void 0 },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-4 pt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          MarketplaceSummaryHeader,
          {
            queryValue: queryDraft,
            onQueryChange: setQueryDraft,
            onSearchSubmit: handleSearchSubmit,
            resultCount: activeOutput.count,
            strongCount: hasTieredShape ? strongCount : void 0,
            relatedCount: hasTieredShape ? relatedCount : void 0,
            rerankApplied,
            isSearching,
            isFullscreen,
            onToggleFullscreen: toggleFullscreen
          }
        ) }),
        !isMobile && !isFullscreen && detailOpen && selectedResource && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-4 pt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          SearchResourceDetail,
          {
            resource: selectedResource,
            inline: true,
            onClose: handleCloseDetail,
            onCheckPrice: runCheckPrice,
            onFetch: runFetch
          }
        ) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `px-4 py-4 ${isFullscreen ? "grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]" : ""}`, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-5", children: hasTieredShape ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            strongResults.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2 flex items-center gap-2 px-0.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff9a52]", children: "Strong matches" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] text-tertiary", children: strongResults.length }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 border-t border-[rgba(255,107,0,0.18)]" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `grid gap-3 ${isFullscreen ? "xl:grid-cols-2" : "grid-cols-1"}`, children: strongResults.map((resource, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                SearchResultCard,
                {
                  resource,
                  index,
                  featured: index === 0,
                  selected: effectiveSelectedUrl === resource.url,
                  onInspect: handleInspectResource,
                  onCheckPrice: runCheckPrice,
                  onFetch: runFetch
                },
                `strong-${resource.url}-${index}`
              )) })
            ] }),
            relatedResults.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2 flex items-center gap-2 px-0.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-semibold uppercase tracking-[0.22em] text-tertiary", children: "Related services" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] text-tertiary", children: relatedResults.length }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 border-t border-white/8" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `grid gap-3 ${isFullscreen ? "xl:grid-cols-2" : "grid-cols-1"}`, children: relatedResults.map((resource, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                SearchResultCard,
                {
                  resource,
                  index,
                  featured: false,
                  selected: effectiveSelectedUrl === resource.url,
                  onInspect: handleInspectResource,
                  onCheckPrice: runCheckPrice,
                  onFetch: runFetch
                },
                `related-${resource.url}-${index}`
              )) })
            ] })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `grid gap-3 ${isFullscreen ? "xl:grid-cols-2" : "grid-cols-1"}`, children: resources.map((resource, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            SearchResultCard,
            {
              resource,
              index,
              featured: index === 0,
              selected: effectiveSelectedUrl === resource.url,
              onInspect: handleInspectResource,
              onCheckPrice: runCheckPrice,
              onFetch: runFetch
            },
            `${resource.url}-${index}`
          )) }) }),
          isFullscreen && !isMobile && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-w-0", children: detailOpen && selectedResource ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            SearchResourceDetail,
            {
              resource: selectedResource,
              onClose: handleCloseDetail,
              onCheckPrice: runCheckPrice,
              onFetch: runFetch
            }
          ) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "sticky top-4 rounded-[22px] border border-dashed border-subtle bg-surface px-4 py-6 transition-all duration-200", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-[0.22em] text-tertiary", children: "Inspection Deck" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mt-2 text-lg font-semibold text-primary", children: "Select a result to inspect" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm leading-6 text-secondary", children: "Fullscreen mode now supports a dedicated review surface. Pick any candidate to compare pricing, trust signals, and endpoint context without losing the market board." }),
            selectedResource && /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { className: "mt-4", variant: "soft", color: "secondary", size: "sm", onClick: () => handleInspectResource(selectedResource), children: [
              "Open ",
              selectedResource.name
            ] })
          ] }) })
        ] }),
        isMobile && detailOpen && selectedResource && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 z-20 flex items-end bg-black/50 px-3 py-3 backdrop-blur-sm", onClick: () => {
          void handleCloseDetail();
        }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "max-h-[92vh] w-full overflow-y-auto animate-[fadein_.18s_ease-out]", onClick: (event) => event.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          SearchResourceDetail,
          {
            resource: selectedResource,
            inline: true,
            onClose: handleCloseDetail,
            onCheckPrice: runCheckPrice,
            onFetch: runFetch
          }
        ) }) }),
        activeOutput.tip && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-tertiary px-4 pb-3", children: activeOutput.tip }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          DebugPanel,
          {
            widgetName: "x402-marketplace-search",
            extraInfo: {
              externalQuery,
              queryDraft,
              liveResultCount: liveResult?.count ?? 0,
              activeResultCount: activeOutput?.count ?? 0,
              strongCount,
              relatedCount,
              topSimilarity: activeOutput?.topSimilarity ?? null,
              noMatchReason: noMatchReason ?? "",
              rerankApplied,
              rerankReason: activeOutput?.rerank?.reason ?? "",
              intentCapabilityText: activeOutput?.intent?.capabilityText ?? "",
              searchMode,
              searchNote,
              selectedUrl: effectiveSelectedUrl ?? "",
              detailOpen,
              isSearching,
              isMobile,
              isFullscreen
            }
          }
        )
      ]
    }
  );
}
const root = document.getElementById("x402-marketplace-search-root");
if (root) {
  root.setAttribute("data-widget-build", "2026-04-16.1");
  clientExports.createRoot(root).render(/* @__PURE__ */ jsxRuntimeExports.jsx(MarketplaceSearch, {}));
}
