import { u as useOpenAIGlobal } from "./use-openai-global-9o-8Rsxx.js";
function useTheme() {
  const theme = useOpenAIGlobal("theme");
  return theme ?? "dark";
}
export {
  useTheme as u
};
