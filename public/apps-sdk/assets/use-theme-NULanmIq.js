import { u as useOpenAIGlobal } from "./use-openai-global-CHD17KWv.js";
function useTheme() {
  const theme = useOpenAIGlobal("theme");
  return theme ?? "dark";
}
export {
  useTheme as u
};
