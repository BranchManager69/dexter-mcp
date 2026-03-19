import { u as useOpenAIGlobal } from "./use-openai-global-CHD17KWv.js";
function useDisplayMode() {
  return useOpenAIGlobal("displayMode");
}
function useRequestDisplayMode() {
  return useOpenAIGlobal("requestDisplayMode");
}
export {
  useRequestDisplayMode as a,
  useDisplayMode as u
};
