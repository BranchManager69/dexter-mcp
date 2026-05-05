import { u as useOpenAIGlobal } from "./use-openai-global-Cs-Bqg_p.js";
function useTheme() {
  const theme = useOpenAIGlobal("theme");
  return theme ?? "dark";
}
export {
  useTheme as u
};
