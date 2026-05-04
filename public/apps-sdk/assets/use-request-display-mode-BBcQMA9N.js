import { u as useOpenAIGlobal } from "./use-openai-global-BOVEJHdZ.js";
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
