import { u as useOpenAIGlobal } from "./use-openai-global-CzM08Fyj.js";
function useTheme() {
  const theme = useOpenAIGlobal("theme");
  return theme ?? "dark";
}
export {
  useTheme as u
};
