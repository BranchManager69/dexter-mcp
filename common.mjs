import chalk, { Chalk } from 'chalk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerSelectedToolsets } from './toolsets/index.mjs';
import { registerAppsSdkResources } from './apps-sdk/register.mjs';

const passthrough = (value) => String(value);

const chalkStub = {
  cyan: passthrough,
  cyanBright: passthrough,
  magenta: passthrough,
  magentaBright: passthrough,
  green: passthrough,
  yellow: passthrough,
  red: passthrough,
  blue: passthrough,
  blueBright: passthrough,
  white: passthrough,
  gray: passthrough,
  bold: passthrough,
  dim: passthrough,
  underline: passthrough,
};

function getColor() {
  const force = ['1','true','yes','on'].includes(String(process.env.MCP_LOG_FORCE_COLOR || '').toLowerCase());
  if (force && !process.env.FORCE_COLOR) process.env.FORCE_COLOR = '1';
  const enabled = force || process.stdout.isTTY || process.env.FORCE_COLOR === '1';
  if (!enabled) return { ...chalkStub };
  const instance = force ? new Chalk({ level: 1 }) : chalk;
  const wrap = (...fns) => (val) => {
    const str = String(val);
    for (const fn of fns) {
      if (typeof fn === 'function') {
        try {
          return fn(str);
        } catch {}
      }
    }
    return str;
  };
  return {
    ...chalkStub,
    cyan: wrap(instance?.cyan),
    cyanBright: wrap(instance?.cyanBright, instance?.cyan),
    magenta: wrap(instance?.magenta),
    magentaBright: wrap(instance?.magentaBright, instance?.magenta),
    green: wrap(instance?.green),
    yellow: wrap(instance?.yellow),
    red: wrap(instance?.red),
    blue: wrap(instance?.blue),
    blueBright: wrap(instance?.blueBright, instance?.blue),
    white: wrap(instance?.white),
    gray: wrap(instance?.gray, instance?.white),
    bold: wrap(instance?.bold),
    dim: wrap(instance?.dim),
    underline: wrap(instance?.underline, instance?.bold),
  };
}

const MCP_NAME = process.env.MCP_SERVER_NAME || 'dexter-mcp';
const MCP_VERSION = process.env.MCP_SERVER_VERSION || '0.1.0';
const SCHEMA_DEBUG_ENABLED = isTruthyEnv(process.env.MCP_SCHEMA_DEBUG || process.env.CODEX_SCHEMA_DEBUG || '');

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

export async function buildMcpServer(options = {}) {
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
  const loaded = await registerSelectedToolsets(server, requestedToolsets);

  try {
    registerAppsSdkResources(server);
  } catch (error) {
    console.warn('[apps-sdk] failed to register resources', error?.message || error);
  }
  try {
    const color = getColor();
    const label = color.cyan('[mcp-toolsets]');
    const separator = color.dim ? color.dim(', ') : ', ';
    console.log(`${label} active: ${loaded.map((key) => color.cyanBright(key)).join(separator)}`);
  } catch {}

  return server;
}

function wrapRegisterTool(server) {
  const original = server.registerTool.bind(server);

  server.registerTool = (name, meta, handler) => {
    const color = getColor();
    const label = color.blue('[mcp-tool]');
    const inputSchemaNormalized = normalizeSchema(meta.inputSchema, {});
    if (SCHEMA_DEBUG_ENABLED && name && name.startsWith('codex_')) {
      try {
        console.log('[codex-schema-debug]', name, JSON.stringify(inputSchemaNormalized));
      } catch {}
    }
    const normalized = {
      ...meta,
      inputSchema: inputSchemaNormalized,
      outputSchema: normalizeSchema(meta.outputSchema, undefined),
    };

    const wrapped = async (args, extra) => {
      const started = Date.now();
      try {
        console.log(`${label} ${color.yellow('start')} name=${color.blueBright(name)}`);
        const result = await handler(args, extra);
        const duration = Date.now() - started;
        console.log(`${label} ${color.green('ok')} name=${color.blueBright(name)} ms=${color.cyan(duration)}`);
        return result;
      } catch (error) {
        const duration = Date.now() - started;
        const message = error?.stack || error?.message || String(error);
        console.error(`${label} ${color.red('err')} name=${color.blueBright(name)} ms=${color.cyan(duration)} error=${color.red(message)}`);
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
    const looksLikeJsonSchema =
      Object.prototype.hasOwnProperty.call(schema, 'type') ||
      Object.prototype.hasOwnProperty.call(schema, '$schema') ||
      Object.prototype.hasOwnProperty.call(schema, 'properties');
    if (looksLikeJsonSchema) {
      return schema;
    }
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
