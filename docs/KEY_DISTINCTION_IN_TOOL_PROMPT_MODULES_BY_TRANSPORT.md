# Transport Instruction Layers: Concierge vs. Raw MCP

## 1. What Exists Today
- **MCP Server (`dexter-mcp`)** exposes a catalog of tools (e.g., `twitter_search`, `kolscan_leaderboard`, `solana_list_balances`). Each tool registers a short title/description when we call `server.registerTool`.
- **Concierge Prompt Modules** (stored in Supabase) add rich, channel-specific instructions:
  - `agent.concierge.instructions` → the “Dexter Voice beta” role script.
  - `agent.concierge.transport.twitter_reply` → Twitter formatting rules.
  - `agent.concierge.tool.<toolname>` → usage guidance for each tool (parameters, output expectations).
- **Concierge-managed transports** (Dexter Voice, Twitter responder) load both the core instructions and the per-tool prompts before running the LLM.
- **ChatGPT App integration** only sees the raw MCP manifest. ChatGPT lists the tools (with their short descriptions) and the model decides how to use them—no concierge persona, no transport prompt.

## 2. Why ChatGPT Behaves Differently
- ChatGPT reads the manifest directly; we do not supply a concierge instruction block alongside the tool list.
- Therefore the app identifies itself as “Dexter ChatGPT App” and treats MCP endpoints as a flat API surface.
- Any prompt module updates (e.g., mint handling guidance, Kolscan parameter list) are **not** seen by the ChatGPT integration.

## 3. Consequences
- ChatGPT can call the tools, but it has no notion of “Dexter Voice beta,” formatting rules, or guardrails.
- The Twitter and Voice transports, on the other hand, still prepend `agent.concierge.instructions`, so they carry the full Dexter Voice persona.
- When we saw the placeholder mint in the Twitter flow, it was because our transport prompt didn’t clarify the mint lookup. We corrected that, and the agent now retries the search without placeholders.

## 4. What We Can and Cannot Do
- **We can** modify concierge transports: adjust `agent.concierge.instructions`, per-tool modules, or channel prompts, and our own runner will respect those changes.
- **We cannot** inject concierge instructions into the ChatGPT App without building a new wrapper. The OpenAI MCP integration doesn’t accept supplemental instruction text beyond the tool metadata.
- Any behaviour that depends on concierge prompts (e.g., balance formatting, mint handling) will only apply in the transports we control (voice, Twitter, future in-house channels).

## 5. Takeaways
- The ChatGPT App is a raw tool console; it’s useful for private debugging but won’t mirror concierge behaviour unless we build a wrapper around it.
- Concierge transports (voice, Twitter) do load the full instruction stack. Our voice runner *is* that wrapper—it prepends `agent.concierge.instructions` plus the transport-specific prompt before each turn—so prompt-module tweaks take effect immediately there.
- When we need deterministic formatting or persona control in third-party UIs, we must handle it on our side (e.g., pre-format the tool output, or host a proxy that provides the custom instructions before relaying to the model).
