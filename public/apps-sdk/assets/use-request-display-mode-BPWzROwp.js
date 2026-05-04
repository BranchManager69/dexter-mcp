import { u as useOpenAIGlobal } from "./use-openai-global-CKg7e__t.js";
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
