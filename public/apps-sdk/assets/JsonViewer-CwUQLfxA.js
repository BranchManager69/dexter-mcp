import { r as reactExports, j as jsxRuntimeExports } from "./adapter-DBrmdIGu.js";
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
export {
  JsonViewer as J
};
