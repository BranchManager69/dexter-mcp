import { z } from 'zod';

import { getCodexBridge, formatStructuredResult } from '../../codex-bridge.mjs';

const bridge = getCodexBridge();

const START_KEY_MAP = {
  approval_policy: 'approval-policy',
  base_instructions: 'base-instructions',
  include_plan_tool: 'include-plan-tool',
};

const REPLY_KEY_MAP = {
  conversation_id: 'conversationId',
  approval_policy: 'approval-policy',
  base_instructions: 'base-instructions',
  include_plan_tool: 'include-plan-tool',
};

function mapArguments(source, keyMap = {}, { omit = [] } = {}) {
  const out = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (value === undefined || omit.includes(key)) continue;
    const mappedKey = keyMap[key] || key;
    out[mappedKey] = value;
  }
  return out;
}

const startSchema = z
  .object({
    prompt: z.string().min(1, 'prompt_required'),
    approval_policy: z.string().optional(),
    base_instructions: z.string().optional(),
    config: z.record(z.any()).optional(),
    include_plan_tool: z.boolean().optional(),
    model: z.string().optional(),
    profile: z.string().optional(),
    sandbox: z.string().optional(),
  })
  .passthrough();

const replySchema = z
  .object({
    conversation_id: z.string().min(1, 'conversation_id_required'),
    prompt: z.string().min(1, 'prompt_required'),
    approval_policy: z.string().optional(),
    base_instructions: z.string().optional(),
    config: z.record(z.any()).optional(),
    include_plan_tool: z.boolean().optional(),
    model: z.string().optional(),
    profile: z.string().optional(),
    sandbox: z.string().optional(),
  })
  .passthrough();

function buildTextResponse({ conversationId, message }) {
  const lines = [];
  if (message) {
    lines.push(String(message));
  }
  lines.push(`conversation_id: ${conversationId}`);
  return lines.join('\n\n');
}

function warnSandboxOverride(tool, sandbox) {
  console.warn(
    '[codex-toolset]',
    `${tool} ignoring sandbox override (${sandbox}); bridge enforces read-only sandbox.`,
  );
}

export function registerCodexToolset(server) {
  server.registerTool(
    'codex_start',
    {
      title: 'Start Codex Session',
      description: 'Begin a new Codex conversation (read-only, search-enabled).',
      _meta: {
        category: 'codex.session',
        access: 'managed',
        tags: ['codex', 'session', 'start'],
      },
      inputSchema: startSchema.shape,
    },
    async (input, extra) => {
      const parsed = startSchema.parse(input || {});
      const { prompt, sandbox, ...rest } = parsed;
      if (sandbox && sandbox !== 'read-only') {
        warnSandboxOverride('codex_start', sandbox);
      }
      const args = mapArguments(rest, START_KEY_MAP, { omit: ['sandbox'] });
      const result = await bridge.startSession({ prompt, ...args }, extra);
      const structured = formatStructuredResult(result);
      return {
        structuredContent: structured,
        content: [
          {
            type: 'text',
            text: buildTextResponse(structured),
          },
        ],
      };
    },
  );

  server.registerTool(
    'codex_reply',
    {
      title: 'Continue Codex Session',
      description: 'Send a follow-up prompt to an existing Codex conversation.',
      _meta: {
        category: 'codex.session',
        access: 'managed',
        tags: ['codex', 'session', 'reply'],
      },
      inputSchema: replySchema.shape,
    },
    async (input, extra) => {
      const parsed = replySchema.parse(input || {});
      const { conversation_id, sandbox, ...rest } = parsed;
      if (sandbox && sandbox !== 'read-only') {
        warnSandboxOverride('codex_reply', sandbox);
      }
      const args = mapArguments(rest, REPLY_KEY_MAP, { omit: ['sandbox'] });
      const result = await bridge.continueSession({ conversationId: conversation_id, ...args }, extra);
      const structured = formatStructuredResult(result);
      return {
        structuredContent: structured,
        content: [
          {
            type: 'text',
            text: buildTextResponse(structured),
          },
        ],
      };
    },
  );
}
