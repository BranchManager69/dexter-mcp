import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerSelectedToolsets } from './toolsets/index.mjs';

const MCP_NAME = process.env.MCP_SERVER_NAME || 'dexter-mcp';
const MCP_VERSION = process.env.MCP_SERVER_VERSION || '0.1.0';

export function buildMcpServer(options = {}) {
  const instructions = [
    'Dexter connector tools exposed via MCP.',
    '- resolve_wallet provides the currently active managed wallet.',
    '- auth_info returns diagnostics for Supabase-based authentication.',
  ].join('\n');

  const server = new McpServer(
    { name: MCP_NAME, version: MCP_VERSION },
    { capabilities: { logging: {}, tools: { listChanged: true } }, instructions }
  );

  wrapRegisterTool(server);

  const requestedToolsets = options.includeToolsets;
  const loaded = registerSelectedToolsets(server, requestedToolsets);
  try {
    console.log(`[mcp-toolsets] active: ${loaded.join(', ')}`);
  } catch {}

  return server;
}

function wrapRegisterTool(server) {
  const original = server.registerTool.bind(server);

  server.registerTool = (name, meta, handler) => {
    const normalized = {
      ...meta,
      inputSchema: normalizeSchema(meta.inputSchema, {}),
      outputSchema: normalizeSchema(meta.outputSchema, undefined),
    };

    const wrapped = async (args, extra) => {
      const started = Date.now();
      try {
        console.log(`[mcp-tool] start name=${name}`);
        const result = await handler(args, extra);
        const duration = Date.now() - started;
        console.log(`[mcp-tool] ok name=${name} ms=${duration}`);
        return result;
      } catch (error) {
        const duration = Date.now() - started;
        const message = error?.stack || error?.message || String(error);
        console.error(`[mcp-tool] err name=${name} ms=${duration} error=${message}`);
        throw error;
      }
    };

    return original(name, normalized, wrapped);
  };
}

function normalizeSchema(schema, fallback) {
  if (schema === undefined || schema === null) {
    return fallback;
  }

  if (schema instanceof z.ZodObject) {
    return schema._def.shape();
  }

  if (schema instanceof z.ZodType) {
    throw new TypeError('registerTool: pass a raw object shape, not a Zod schema instance');
  }

  if (schema && typeof schema === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(schema)) {
      if (!(value instanceof z.ZodType)) {
        throw new TypeError(`registerTool: schema for "${key}" must be a Zod schema`);
      }
      out[key] = value;
    }
    return out;
  }

  throw new TypeError('registerTool: unsupported schema type');
}
