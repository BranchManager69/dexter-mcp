import { j as jsxRuntimeExports, r as reactExports, u as useToolOutput, g as useToolInput, h as useAdaptiveCallToolFn, f as useAdaptiveTheme } from "./adapter-DSGU3rCd.js";
import { B as Button } from "./Button-C3pHnmQh.js";
import { c as clientExports } from "./client-DvtNmd2S.js";
import { B as Badge } from "./index-noiJc41v.js";
import { A as Alert } from "./Alert-2Vc-bic4.js";
import { u as useMaxHeight } from "./use-max-height-BiDZLyhH.js";
import { u as useSendFollowUp } from "./use-send-followup-DfEQBBoC.js";
import { u as useIntrinsicHeight } from "./useIntrinsicHeight-B0m6hBCQ.js";
import { g as getChain, a as ChainIcon, C as CopyButton, D as DebugPanel } from "./DebugPanel-COk2WZHh.js";
import "./Warning-LBzaUP6h.js";
import "./use-openai-global-BOVEJHdZ.js";
import "./types-HVE8Lb2_.js";
import "./Check-CAIG7aXU.js";
import "./Copy-DpRQuf1N.js";
function pickPrimaryRun(rows) {
  if (!rows || !rows.length) return null;
  const passed = rows.find((r) => r.final_status === "pass" && typeof r.ai_score === "number");
  if (passed) return passed;
  return rows[0];
}
function pickFixInstructions(rows) {
  if (!rows || !rows.length) return null;
  for (const r of rows) {
    const fix = r.ai_fix_instructions;
    if (typeof fix === "string" && fix.trim().length > 0) return fix.trim();
  }
  return null;
}
function formatRelative(deltaMs) {
  const s = Math.max(0, Math.floor(deltaMs / 1e3));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function formatBytes(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function formatHitCount(n) {
  if (typeof n !== "number" || n < 0) return "0";
  if (n < 1e3) return String(n);
  if (n < 1e6) return `${(n / 1e3).toFixed(n < 1e4 ? 1 : 0)}K`;
  return `${(n / 1e6).toFixed(1)}M`;
}
function ResourceIdentity({ resource, fallbackUrl }) {
  const name = resource?.display_name || prettyHost(resource?.host || hostFromUrl(fallbackUrl));
  const meta = buildMetaLine(resource, fallbackUrl);
  const icon = resource?.icon_url || null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__identity", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__identity-icon", children: icon ? /* @__PURE__ */ jsxRuntimeExports.jsx(
      "img",
      {
        src: icon,
        alt: "",
        width: 32,
        height: 32,
        className: "dx-pricing__identity-icon-img",
        "aria-hidden": true,
        loading: "lazy"
      }
    ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__identity-icon-placeholder", "aria-hidden": true }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__identity-text", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "dx-pricing__identity-name", children: name }),
      meta ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-pricing__identity-meta", children: meta }) : null
    ] })
  ] });
}
function buildMetaLine(resource, fallbackUrl) {
  const parts = [];
  if (resource?.category) parts.push(resource.category);
  const host = resource?.host || hostFromUrl(fallbackUrl);
  if (host) parts.push(host);
  if (typeof resource?.hit_count === "number" && resource.hit_count > 0) {
    parts.push(`${formatHitCount(resource.hit_count)} calls`);
  }
  return parts.join(" · ");
}
function hostFromUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
function prettyHost(host) {
  if (!host) return "Unknown endpoint";
  return host.replace(/^www\./i, "");
}
function ResourceDescription({ description }) {
  if (!description) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-pricing__description", children: description });
}
const LOGO_URL = "https://dexter.cash/assets/pokedexter/dexter-logo.svg";
function DexterAvatar({ role, tone }) {
  const ringClass = tone === "high" ? "dx-pricing__avatar--high" : tone === "mid" ? "dx-pricing__avatar--mid" : tone === "low" ? "dx-pricing__avatar--low" : tone === "prescription" ? "dx-pricing__avatar--prescription" : "dx-pricing__avatar--unknown";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `dx-pricing__avatar ${ringClass}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "img",
      {
        src: LOGO_URL,
        alt: "",
        width: 36,
        height: 36,
        className: "dx-pricing__avatar-img",
        "aria-hidden": true
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__avatar-badge", "aria-hidden": true, children: role === "professor" ? /* @__PURE__ */ jsxRuntimeExports.jsx(MortarboardIcon, {}) : /* @__PURE__ */ jsxRuntimeExports.jsx(StethoscopeIcon, {}) })
  ] });
}
function MortarboardIcon() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 24 24", className: "dx-pricing__avatar-badge-icon", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M22 10 12 5 2 10l10 5 10-5z" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M6 12v5c3 2 9 2 12 0v-5" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M22 10v6" })
  ] });
}
function StethoscopeIcon() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 24 24", className: "dx-pricing__avatar-badge-icon", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M8 15v3a3 3 0 0 0 6 0v-1" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: 20, cy: 10, r: 2 })
  ] });
}
function Thermometer({ score, scoreKnown, tone, celebration, animate, ambient }) {
  const fillPct = scoreKnown ? Math.max(2, Math.min(100, score)) : 0;
  const [displayScore, setDisplayScore] = reactExports.useState(animate ? 0 : score);
  reactExports.useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, score]);
  const trackHeight = 88;
  const tubeWidth = 10;
  const bulbR = 9;
  const topPad = 26;
  const tubeTopY = topPad;
  const totalH = topPad + trackHeight + bulbR * 2 + 2;
  const toneClass = tone === "high" ? "dx-pricing__therm-num--high" : tone === "mid" ? "dx-pricing__therm-num--mid" : tone === "low" ? "dx-pricing__therm-num--low" : "dx-pricing__therm-num--unknown";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__therm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `dx-pricing__therm-num ${toneClass}`, children: scoreKnown ? displayScore : "—" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: 28, height: totalH, viewBox: `0 0 28 ${totalH}`, className: "dx-pricing__therm-svg", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("defs", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("linearGradient", { id: "dx-therm-fill", x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "0%", stopColor: "var(--dx-success)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "42%", stopColor: "#f59e0b" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "78%", stopColor: "#ff4d00" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "100%", stopColor: "var(--dx-danger)" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("clipPath", { id: "dx-therm-tube-clip", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "rect",
            {
              x: (28 - tubeWidth) / 2,
              y: tubeTopY,
              width: tubeWidth,
              height: trackHeight,
              rx: tubeWidth / 2,
              ry: tubeWidth / 2
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: 14, cy: tubeTopY + trackHeight + bulbR - 2, r: bulbR })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "rect",
          {
            x: (28 - tubeWidth) / 2,
            y: tubeTopY,
            width: tubeWidth,
            height: trackHeight,
            rx: tubeWidth / 2,
            ry: tubeWidth / 2,
            className: "dx-pricing__therm-track"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "circle",
          {
            cx: 14,
            cy: tubeTopY + trackHeight + bulbR - 2,
            r: bulbR,
            className: "dx-pricing__therm-bulb-empty"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { clipPath: "url(#dx-therm-tube-clip)", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "rect",
          {
            x: 0,
            y: tubeTopY + trackHeight,
            width: 28,
            height: bulbR * 2 + 4,
            fill: "url(#dx-therm-fill)",
            opacity: scoreKnown ? 1 : 0.25
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ThermometerFill,
          {
            tubeTopY,
            trackHeight,
            fillPct,
            animate
          }
        )
      ] }),
      [25, 50, 75].map((pct) => {
        const y = tubeTopY + trackHeight - trackHeight * pct / 100;
        return /* @__PURE__ */ jsxRuntimeExports.jsx(
          "line",
          {
            x1: (28 - tubeWidth) / 2 + tubeWidth + 1,
            x2: (28 - tubeWidth) / 2 + tubeWidth + 4,
            y1: y,
            y2: y,
            className: "dx-pricing__therm-tick"
          },
          pct
        );
      }),
      celebration === "sparks" && ambient && /* @__PURE__ */ jsxRuntimeExports.jsx(CelebrationSparks, { cx: 14, topY: tubeTopY, tubeW: tubeWidth }),
      celebration === "sparks" && !ambient && /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: 14, cy: tubeTopY, r: tubeWidth / 2 + 4, fill: "#facc15", opacity: 0.35 }),
      celebration === "glow" && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "circle",
        {
          cx: 14,
          cy: tubeTopY + trackHeight + bulbR - 2,
          r: bulbR + 5,
          fill: "var(--dx-success)",
          opacity: ambient ? 0.28 : 0.22,
          style: { filter: "blur(1px)" },
          className: ambient ? "dx-pricing__therm-glow" : ""
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__therm-cap", children: "/100" })
  ] });
}
function ThermometerFill({
  tubeTopY,
  trackHeight,
  fillPct,
  animate
}) {
  const targetH = trackHeight * fillPct / 100;
  const [h, setH] = reactExports.useState(animate ? 0 : targetH);
  reactExports.useEffect(() => {
    if (!animate) {
      setH(targetH);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setH(eased * targetH);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const startDelay = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 100);
    return () => {
      clearTimeout(startDelay);
      cancelAnimationFrame(raf);
    };
  }, [animate, targetH]);
  const bulbTop = tubeTopY + trackHeight;
  const y = bulbTop - h;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: 0, y, width: 28, height: h, fill: "url(#dx-therm-fill)" });
}
function CelebrationSparks({ cx, topY, tubeW }) {
  const sparks = [
    { dx: -5, hue: "#fde047" },
    { dx: 2, hue: "#facc15" },
    { dx: -1, hue: "#f97316" },
    { dx: 4, hue: "#fde047" },
    { dx: -3, hue: "#facc15" },
    { dx: 1, hue: "#f97316" },
    { dx: 3, hue: "#fde047" },
    { dx: -2, hue: "#facc15" }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { "aria-hidden": true, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "circle",
      {
        cx,
        cy: topY,
        r: tubeW / 2 + 6,
        fill: "#facc15",
        className: "dx-pricing__spark-glow dx-pricing__spark-glow--a"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "circle",
      {
        cx,
        cy: topY,
        r: tubeW / 2 + 3,
        fill: "#fb923c",
        className: "dx-pricing__spark-glow dx-pricing__spark-glow--b"
      }
    ),
    sparks.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "circle",
      {
        cx: cx + s.dx,
        cy: topY,
        r: 1.6,
        fill: s.hue,
        className: "dx-pricing__spark",
        style: { animationDelay: `${i * 0.275}s` }
      },
      i
    ))
  ] });
}
function Stamp({ letter, tone, animate }) {
  const ticks = 32;
  const toneClass = tone === "high" ? "dx-pricing__stamp--high" : tone === "mid" ? "dx-pricing__stamp--mid" : tone === "low" ? "dx-pricing__stamp--low" : "dx-pricing__stamp--unknown";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `dx-pricing__stamp ${toneClass} ${animate ? "dx-pricing__stamp--animate" : ""}`,
      "aria-label": `Grade ${letter}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 100 100", className: "dx-pricing__stamp-svg", "aria-hidden": true, children: [
          Array.from({ length: ticks }).map((_, i) => {
            const angle = i / ticks * Math.PI * 2;
            const x1 = 50 + Math.cos(angle) * 47;
            const y1 = 50 + Math.sin(angle) * 47;
            const x2 = 50 + Math.cos(angle) * 43;
            const y2 = 50 + Math.sin(angle) * 43;
            return /* @__PURE__ */ jsxRuntimeExports.jsx(
              "line",
              {
                x1,
                y1,
                x2,
                y2,
                stroke: "currentColor",
                strokeWidth: 2.2,
                strokeLinecap: "round",
                opacity: 0.85
              },
              i
            );
          }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: 50, cy: 50, r: 40, fill: "none", stroke: "currentColor", strokeWidth: 2.5, opacity: 0.9 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: 50, cy: 50, r: 34, fill: "none", stroke: "currentColor", strokeWidth: 1.4, opacity: 0.55 })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__stamp-letter", children: letter })
      ]
    }
  );
}
function SpeechBubble({ tone, className, children }) {
  const variantClass = tone === "high" ? "dx-pricing__bubble--high" : tone === "mid" ? "dx-pricing__bubble--mid" : tone === "low" ? "dx-pricing__bubble--low" : tone === "prescription" ? "dx-pricing__bubble--prescription" : "dx-pricing__bubble--unknown";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `dx-pricing__bubble ${variantClass} ${className ?? ""}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { "aria-hidden": true, viewBox: "0 0 16 24", className: "dx-pricing__bubble-tail", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M 16 0 L 0 12 L 16 24 Z", fill: "none", strokeWidth: 1.5, stroke: "currentColor", className: "dx-pricing__bubble-tail-stroke" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M 17.5 1.5 L 1.5 12 L 17.5 22.5 Z", fill: "currentColor", className: "dx-pricing__bubble-tail-fill" })
    ] }),
    children
  ] });
}
function scoreToTone(score) {
  if (typeof score !== "number") return "unknown";
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}
function scoreToLetter(score) {
  if (typeof score !== "number") return "?";
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}
function scoreToCelebration(score) {
  if (typeof score !== "number") return "none";
  if (score >= 90) return "sparks";
  if (score >= 75) return "glow";
  return "none";
}
function ProfessorDexterCard({ run, passesOfRecent, animate }) {
  if (!run) return null;
  const score = typeof run.ai_score === "number" ? run.ai_score : 0;
  const scoreKnown = typeof run.ai_score === "number";
  const tone = scoreToTone(run.ai_score);
  const letter = scoreToLetter(run.ai_score);
  const celebration = scoreToCelebration(run.ai_score);
  const receivedAt = run.completed_at ? Date.parse(run.completed_at) : Date.parse(run.attempted_at);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `dx-pricing__verdict ${animate ? "dx-pricing__verdict--animate" : ""}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__verdict-rail", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DexterAvatar, { role: "professor", tone }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Thermometer,
        {
          score,
          scoreKnown,
          tone,
          celebration,
          animate,
          ambient: true
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(SpeechBubble, { tone, className: "dx-pricing__verdict-bubble", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__verdict-bubble-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__verdict-bubble-eyebrow", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__verdict-bubble-name", children: "Professor Dexter" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__verdict-bubble-action", children: "grades it" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Stamp, { letter, tone, animate })
      ] }),
      run.ai_notes ? /* @__PURE__ */ jsxRuntimeExports.jsx(ProseReveal, { text: run.ai_notes, animate }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-pricing__verdict-bubble-empty", children: "No notes returned." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Footer,
        {
          receivedAt: Number.isFinite(receivedAt) ? receivedAt : null,
          passesOfRecent
        }
      )
    ] })
  ] });
}
function ProseReveal({ text, animate }) {
  if (!animate) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-pricing__verdict-prose", children: text });
  }
  const tokens = text.split(/(\s+)/);
  let visibleIdx = 0;
  const visibleCount = tokens.filter((t) => t.trim().length > 0).length;
  const perWord = Math.min(0.04, 1.4 / Math.max(1, visibleCount));
  return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-pricing__verdict-prose dx-pricing__verdict-prose--reveal", "aria-label": text, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": true, children: tokens.map((tok, i) => {
    if (!tok.trim().length) return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: tok }, i);
    const idx = visibleIdx++;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: "dx-pricing__verdict-word",
        style: { animationDelay: `${0.4 + idx * perWord}s` },
        children: tok
      },
      i
    );
  }) }) });
}
function Footer({
  receivedAt,
  passesOfRecent
}) {
  const [now, setNow] = reactExports.useState(() => Date.now());
  reactExports.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 6e4);
    return () => clearInterval(id);
  }, []);
  const parts = [];
  parts.push("evaluated by Dexter");
  if (receivedAt) parts.push(formatRelative(now - receivedAt));
  if (passesOfRecent && passesOfRecent.total > 1) {
    parts.push(`${passesOfRecent.passes} of ${passesOfRecent.total} recent runs passed`);
  }
  const absolute = receivedAt ? new Date(receivedAt).toISOString().replace("T", " ").slice(0, 19) + " UTC" : void 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__verdict-footer", children: parts.map((p, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { title: i === 1 && absolute ? absolute : void 0, children: [
    p,
    i < parts.length - 1 ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__verdict-footer-sep", children: " · " }) : null
  ] }, i)) });
}
function DoctorDexterCard({ fixText, animate }) {
  const [copied, setCopied] = reactExports.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(fixText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `dx-pricing__doctor ${animate ? "dx-pricing__doctor--animate" : ""}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__verdict-rail", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DexterAvatar, { role: "doctor", tone: "prescription" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__doctor-rail-cap", children: "prescription" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(SpeechBubble, { tone: "prescription", className: "dx-pricing__verdict-bubble", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__verdict-bubble-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__verdict-bubble-eyebrow", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__verdict-bubble-name", children: "Doctor Dexter" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__verdict-bubble-action", children: "prescribes" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            onClick: onCopy,
            className: "dx-pricing__doctor-copy",
            "aria-label": copied ? "Fix instructions copied" : "Copy fix instructions",
            "aria-live": "polite",
            children: copied ? "Copied" : "Copy"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "dx-pricing__doctor-text", children: fixText })
    ] })
  ] });
}
function shortenAddress(addr) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function PaymentRouteRow({ option, isBest }) {
  const { name: chainName } = getChain(option.network);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `dx-pricing__route ${isBest ? "dx-pricing__route--best" : ""}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__route-chain", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ChainIcon, { network: option.network, size: 20 }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__route-chain-text", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__route-chain-line", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__route-chain-name", children: chainName }),
          isBest ? /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "success", size: "sm", children: "Best" }) : null
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__route-chain-asset", children: "USDC" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__route-payto", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__route-payto-addr", children: shortenAddress(option.payTo) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CopyButton, { copyValue: option.payTo, variant: "ghost", color: "secondary", size: "sm" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__route-price", children: option.priceFormatted })
  ] });
}
function PaymentRoutes({ options, cheapestIndex }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "dx-pricing__routes", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "dx-pricing__section-title", children: "Pay via" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__routes-list", children: options.map((opt, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(PaymentRouteRow, { option: opt, isBest: i === cheapestIndex }, i)) })
  ] });
}
function ResponseShape({ run, contentType, sizeBytes }) {
  const ct = run?.response_content_type || contentType;
  const size = run?.response_size_bytes ?? sizeBytes;
  const kind = run?.response_kind ?? inferKindFromCt(ct);
  const preview = run?.response_preview ?? null;
  if (!ct && !size && !preview) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "dx-pricing__shape", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "dx-pricing__section-title", children: "What you'll get" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__shape-meta", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__shape-meta-kind", children: labelForKind(kind, run) }),
      typeof size === "number" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__shape-meta-sep", children: "·" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__shape-meta-size", children: formatBytes(size) })
      ] }) : null
    ] }),
    preview && shouldRenderPreview(kind) ? /* @__PURE__ */ jsxRuntimeExports.jsx(ResponsePreview, { kind, preview }) : null
  ] });
}
function inferKindFromCt(ct) {
  if (!ct) return "unknown";
  const lower = ct.toLowerCase();
  if (lower.includes("json")) return "json";
  if (lower.includes("image/")) return "image";
  if (lower.includes("html")) return "html";
  if (lower.includes("event-stream")) return "stream";
  if (lower.includes("text/")) return "text";
  if (lower.includes("octet-stream")) return "binary";
  return "unknown";
}
function labelForKind(kind, run) {
  switch (kind) {
    case "json":
      return "JSON";
    case "text":
      return "Text";
    case "html":
      return "HTML";
    case "image": {
      const fmt = run?.response_image_format;
      return fmt ? `${fmt} image` : "Image";
    }
    case "stream":
      return "Streaming response";
    case "binary":
      return "Binary blob";
    case "unknown":
    default:
      return "Response";
  }
}
function shouldRenderPreview(kind) {
  return kind === "json" || kind === "text" || kind === "html";
}
function ResponsePreview({ kind, preview }) {
  const [open, setOpen] = reactExports.useState(false);
  const text = kind === "json" ? prettyJson(preview) : preview;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dx-pricing__preview", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        type: "button",
        onClick: () => setOpen((v) => !v),
        className: "dx-pricing__preview-toggle",
        "aria-expanded": open,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "dx-pricing__preview-toggle-arrow", "data-open": open ? "1" : "0", children: "▸" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: open ? "Hide sample response" : "View sample response" })
        ]
      }
    ),
    open ? /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { className: "dx-pricing__preview-body", children: /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: text }) }) : null
  ] });
}
function prettyJson(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
function FetchAction({ selectedPrice, onFetch }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { color: "primary", block: true, onClick: onFetch, children: [
    "Fetch & pay",
    selectedPrice ? ` ${selectedPrice}` : ""
  ] });
}
const WORDMARK_URL = "https://dexter.cash/wordmarks/dexter-wordmark.svg";
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
function StateFrame({
  theme,
  maxHeight,
  children,
  containerRef,
  variant = "default"
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      "data-theme": theme,
      ref: containerRef,
      className: `dx-pricing dx-pricing--${variant}`,
      style: { maxHeight: maxHeight ?? void 0, overflowY: maxHeight ? "auto" : void 0 },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Wordmark, {}),
        children
      ]
    }
  );
}
function Wordmark() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__wordmark", children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: WORDMARK_URL, alt: "Dexter", className: "dx-pricing__wordmark-img" }) });
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
  const animate = reactExports.useMemo(() => true, []);
  if (!toolOutput) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(StateFrame, { theme, maxHeight, variant: "loading", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__state", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: loadingElapsed < 5 ? "Checking pricing…" : "Still probing endpoint — hang tight." }) }) });
  }
  if (toolOutput.authRequired) {
    const authEnrichment = toolOutput.enrichment ?? null;
    const authRecent = authEnrichment?.history?.recent ?? [];
    const authPrimary = pickPrimaryRun(authRecent);
    const authFix = pickFixInstructions(authRecent);
    const authPasses = authRecent.length ? {
      passes: authRecent.filter((r) => r.final_status === "pass").length,
      total: authRecent.length
    } : null;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(StateFrame, { theme, maxHeight, containerRef, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ResourceIdentity,
        {
          resource: authEnrichment?.resource ?? null,
          fallbackUrl: toolInput?.url ?? null
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ResourceDescription, { description: authEnrichment?.resource?.description ?? null }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Alert,
        {
          color: "warning",
          title: "Authentication required",
          description: `This endpoint requires provider authentication before the x402 payment flow.${toolOutput.message ? " " + toolOutput.message : ""}`
        }
      ),
      authPrimary ? /* @__PURE__ */ jsxRuntimeExports.jsx(ProfessorDexterCard, { run: authPrimary, passesOfRecent: authPasses, animate }) : null,
      authFix ? /* @__PURE__ */ jsxRuntimeExports.jsx(DoctorDexterCard, { fixText: authFix, animate }) : null
    ] });
  }
  if (isPricingUnavailable(toolOutput)) {
    const errEnrichment = toolOutput.enrichment ?? null;
    const errRecent = errEnrichment?.history?.recent ?? [];
    const errPrimary = pickPrimaryRun(errRecent);
    const errFix = pickFixInstructions(errRecent);
    const errPasses = errRecent.length ? {
      passes: errRecent.filter((r) => r.final_status === "pass").length,
      total: errRecent.length
    } : null;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(StateFrame, { theme, maxHeight, containerRef, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ResourceIdentity,
        {
          resource: errEnrichment?.resource ?? null,
          fallbackUrl: toolInput?.url ?? null
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ResourceDescription, { description: errEnrichment?.resource?.description ?? null }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Alert, { color: "danger", title: "Pricing unavailable", description: unavailableMessage(toolOutput) }),
      errPrimary ? /* @__PURE__ */ jsxRuntimeExports.jsx(ProfessorDexterCard, { run: errPrimary, passesOfRecent: errPasses, animate }) : null,
      errFix ? /* @__PURE__ */ jsxRuntimeExports.jsx(DoctorDexterCard, { fixText: errFix, animate }) : null
    ] });
  }
  if (isFreeEndpoint(toolOutput)) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(StateFrame, { theme, maxHeight, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ResourceIdentity,
        {
          resource: toolOutput.enrichment?.resource ?? null,
          fallbackUrl: toolInput?.url ?? null
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ResourceDescription, { description: toolOutput.enrichment?.resource?.description ?? null }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dx-pricing__state", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "No payment required — this endpoint is free to use." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { color: "success", children: "Free" })
      ] }) })
    ] });
  }
  const options = toolOutput.paymentOptions || [];
  const cheapestIndex = pickCheapestIndex(options);
  const selectedPrice = cheapestIndex >= 0 ? options[cheapestIndex].priceFormatted : null;
  const enrichment = toolOutput.enrichment ?? null;
  const recent = enrichment?.history?.recent ?? [];
  const primaryRun = pickPrimaryRun(recent);
  const fixText = pickFixInstructions(recent);
  const passesOfRecent = recent.length ? {
    passes: recent.filter((r) => r.final_status === "pass").length,
    total: recent.length
  } : null;
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(StateFrame, { theme, maxHeight, containerRef, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      ResourceIdentity,
      {
        resource: enrichment?.resource ?? null,
        fallbackUrl: toolInput?.url ?? null
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ResourceDescription, { description: enrichment?.resource?.description ?? null }),
    primaryRun ? /* @__PURE__ */ jsxRuntimeExports.jsx(ProfessorDexterCard, { run: primaryRun, passesOfRecent, animate }) : null,
    fixText ? /* @__PURE__ */ jsxRuntimeExports.jsx(DoctorDexterCard, { fixText, animate }) : null,
    /* @__PURE__ */ jsxRuntimeExports.jsx(PaymentRoutes, { options, cheapestIndex }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      ResponseShape,
      {
        run: primaryRun,
        contentType: enrichment?.resource?.response_content_type ?? null,
        sizeBytes: enrichment?.resource?.response_size_bytes ?? null
      }
    ),
    toolInput?.url ? /* @__PURE__ */ jsxRuntimeExports.jsx(FetchAction, { selectedPrice, onFetch: handleFetch }) : null,
    /* @__PURE__ */ jsxRuntimeExports.jsx(DebugPanel, { widgetName: "x402-pricing" })
  ] });
}
const root = document.getElementById("x402-pricing-root");
if (root) {
  root.setAttribute("data-widget-build", "2026-05-04.1");
  clientExports.createRoot(root).render(/* @__PURE__ */ jsxRuntimeExports.jsx(PricingCheck, {}));
}
