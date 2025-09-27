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

const EXEC_KEY_MAP = {
  output_schema: 'outputSchema',
  metadata: 'metadata',
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

const START_JSON_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string', minLength: 1 },
    approval_policy: { type: 'string' },
    base_instructions: { type: 'string' },
    config: { type: 'object', additionalProperties: true },
    include_plan_tool: { type: 'boolean' },
    model: { type: 'string' },
    profile: { type: 'string' },
    sandbox: { type: 'string' },
  },
  required: ['prompt'],
  additionalProperties: false,
  $schema: 'http://json-schema.org/draft-07/schema#',
};

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

const REPLY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    conversation_id: { type: 'string', minLength: 1 },
    prompt: { type: 'string', minLength: 1 },
    approval_policy: { type: 'string' },
    base_instructions: { type: 'string' },
    config: { type: 'object', additionalProperties: true },
    include_plan_tool: { type: 'boolean' },
    model: { type: 'string' },
    profile: { type: 'string' },
    sandbox: { type: 'string' },
  },
  required: ['conversation_id', 'prompt'],
  additionalProperties: false,
  $schema: 'http://json-schema.org/draft-07/schema#',
};

const execSchema = z
  .object({
    prompt: z.string().min(1, 'prompt_required'),
    output_schema: z.union([z.string(), z.record(z.any())]).optional(),
    metadata: z.record(z.any()).optional(),
    approval_policy: z.string().optional(),
    base_instructions: z.string().optional(),
    config: z.record(z.any()).optional(),
    include_plan_tool: z.boolean().optional(),
    model: z.string().optional(),
    profile: z.string().optional(),
    sandbox: z.string().optional(),
  })
  .passthrough();

const EXEC_JSON_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string', minLength: 1 },
    output_schema: {
      anyOf: [
        { type: 'string' },
        { type: 'object', additionalProperties: true },
      ],
    },
    metadata: { type: 'object', additionalProperties: true },
    approval_policy: { type: 'string' },
    base_instructions: { type: 'string' },
    config: { type: 'object', additionalProperties: true },
    include_plan_tool: { type: 'boolean' },
    model: { type: 'string' },
    profile: { type: 'string' },
    sandbox: { type: 'string' },
  },
  required: ['prompt'],
  additionalProperties: false,
  $schema: 'http://json-schema.org/draft-07/schema#',
};

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
      inputSchema: START_JSON_SCHEMA,
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
      inputSchema: REPLY_JSON_SCHEMA,
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

  server.registerTool(
    'codex_exec',
    {
      title: 'Codex Exec Session',
      description:
        'Run Codex exec with optional JSON schema. Returns structuredContent when the schema is provided.',
      _meta: {
        category: 'codex.session',
        access: 'managed',
        tags: ['codex', 'exec', 'structured'],
      },
      inputSchema: EXEC_JSON_SCHEMA,
    },
    async (input, extra) => {
      const parsed = execSchema.parse(input || {});
      const { sandbox, ...rest } = parsed;
      if (sandbox && sandbox !== 'read-only') {
        warnSandboxOverride('codex_exec', sandbox);
      }
      const args = mapArguments(rest, EXEC_KEY_MAP, { omit: ['sandbox'] });
      const result = await bridge.execSession(args, extra);
      const structured = formatStructuredResult(result);
      const { structuredContent, raw, ...summary } = result;
      return {
        structuredContent: structuredContent || summary,
        content: [
          {
            type: 'text',
            text: buildTextResponse(structured),
          },
        ],
        metadata: {
          conversationId: structured.conversationId,
          durationMs: structured.durationMs,
          structuredContent: structuredContent || null,
          raw: raw || null,
        },
      };
    },
  );
}
