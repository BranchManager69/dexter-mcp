import { u as useOpenAIGlobal } from "./use-openai-global-CKg7e__t.js";
function useTheme() {
  const theme = useOpenAIGlobal("theme");
  return theme ?? "dark";
}
export {
  useTheme as u
};
