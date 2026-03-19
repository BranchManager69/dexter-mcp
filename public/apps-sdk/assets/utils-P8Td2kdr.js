function getTokenLogoUrl(mint) {
  if (!mint) return "";
  return `https://cdn.dexscreener.com/tokens/solana/${mint}.png`;
}
function formatValue(value, fallback = "—") {
  if (value === null || value === void 0) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}
function abbreviateAddress(address, prefix = 4, suffix = 4) {
  if (!address) return "—";
  const trimmed = address.trim();
  if (trimmed.length <= prefix + suffix + 3) return trimmed;
  return `${trimmed.slice(0, prefix)}…${trimmed.slice(-suffix)}`;
}
function formatTimestamp(timestamp) {
  if (!timestamp) return "Not supplied";
  try {
    const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(String(timestamp));
    if (Number.isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleString();
  } catch {
    return "Invalid date";
  }
}
export {
  abbreviateAddress as a,
  formatTimestamp as b,
  formatValue as f,
  getTokenLogoUrl as g
};
