import { u as useOpenAIGlobal } from "./use-openai-global-CD95Kk1r.js";
function useTheme() {
  const theme = useOpenAIGlobal("theme");
  return theme ?? "dark";
}
export {
  useTheme as u
};
