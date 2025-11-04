import { registerCodexToolset } from './toolsets/codex/index.mjs';
const tools = [];
const server = {
  registerTool(name, meta, handler) {
    tools.push({ name, meta, handler });
  }
};
registerCodexToolset(server);
console.log(JSON.stringify(tools, null, 2));
