#!/usr/bin/env node
import process from 'node:process';
import { URL } from 'node:url';
import fs from 'node:fs';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const parseJsonRpc = (line) => JSON.parse(line);
const stringifyJsonRpc = (message) => JSON.stringify(message);

class CompatStdioServerTransport {
  constructor(stdin = process.stdin, stdout = process.stdout) {
    this._stdin = stdin;
    this._stdout = stdout;
    this._buffer = Buffer.alloc(0);
    this._started = false;
    this._preferContentLength = false;

    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;

    this._onData = (chunk) => {
      if (!chunk || chunk.length === 0) return;
      this._buffer = this._buffer.length ? Buffer.concat([this._buffer, chunk]) : Buffer.from(chunk);
      this._processReadBuffer();
    };

    this._onError = (error) => {
      if (typeof this.onerror === 'function') this.onerror(error);
    };
  }

  async start() {
    if (this._started) {
      throw new Error('CompatStdioServerTransport already started');
    }
    this._started = true;
    this._stdin.on('data', this._onData);
    this._stdin.on('error', this._onError);
  }

  async close() {
    this._stdin.off('data', this._onData);
    this._stdin.off('error', this._onError);
    this._buffer = Buffer.alloc(0);
    if (typeof this.onclose === 'function') this.onclose();
  }

  async send(message) {
    const json = stringifyJsonRpc(message);
    const payload = this._preferContentLength
      ? `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`
      : `${json}\n`;

    return new Promise((resolve, reject) => {
      this._stdout.write(payload, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  _processReadBuffer() {
    while (true) {
      const result = this._readNextMessage();
      if (result === null) break;
      if (result === undefined) continue;
      try {
        if (typeof this.onmessage === 'function') this.onmessage(result);
      } catch (error) {
        if (typeof this.onerror === 'function') this.onerror(error);
      }
    }
  }

  _consumeLine() {
    const newlineIdx = this._buffer.indexOf(0x0a); // '\n'
    if (newlineIdx === -1) return null;
    const line = this._buffer.subarray(0, newlineIdx).toString('utf8').replace(/\r$/, '');
    this._buffer = this._buffer.subarray(newlineIdx + 1);
    return line;
  }

  _readNextMessage() {
    if (!this._buffer.length) return null;

    // Trim leading CR/LF noise
    while (this._buffer.length && (this._buffer[0] === 0x0a || this._buffer[0] === 0x0d)) {
      this._buffer = this._buffer.subarray(1);
    }
    if (!this._buffer.length) return null;

    const asString = this._buffer.toString('utf8');
    const headerSeparator = asString.indexOf('\r\n\r\n');
    if (headerSeparator !== -1) {
      const headerSection = asString.slice(0, headerSeparator);
      const lengthMatch = headerSection.match(/content-length\s*:\s*(\d+)/i);
      if (lengthMatch) {
        const length = Number.parseInt(lengthMatch[1], 10);
        if (Number.isNaN(length)) {
          if (typeof this.onerror === 'function') this.onerror(new Error('Invalid Content-Length header'));
          this._buffer = this._buffer.subarray(headerSeparator + 4);
          return undefined;
        }
        const totalBytesNeeded = headerSeparator + 4 + length;
        if (this._buffer.length < totalBytesNeeded) {
          return null; // wait for more data
        }
        const body = this._buffer.subarray(headerSeparator + 4, totalBytesNeeded).toString('utf8');
        this._buffer = this._buffer.subarray(totalBytesNeeded);
        if (!body.trim()) {
          return undefined;
        }
        this._preferContentLength = true;
        try {
          return parseJsonRpc(body);
        } catch (error) {
          if (typeof this.onerror === 'function') this.onerror(error);
          return undefined;
        }
      }
    }

    // Fallback to newline-delimited JSON
    const line = this._consumeLine();
    if (line === null) return null;
    if (!line.trim()) return undefined;
    this._preferContentLength = false;
    try {
      return parseJsonRpc(line);
    } catch (error) {
      if (typeof this.onerror === 'function') this.onerror(error);
      return undefined;
    }
  }
}

function parseArguments(argv) {
  const args = { headers: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--url':
      case '-u':
        args.url = argv[++i];
        break;
      case '--bearer':
        args.bearer = argv[++i];
        break;
      case '--header':
      case '-H':
        args.headers.push(argv[++i]);
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      default:
        args.headers ??= [];
        if (token.startsWith('-')) {
          console.error(`Unknown option ${token}\n`);
          args.help = true;
          return args;
        }
        args.url = args.url ?? token;
        break;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: dexter-mcp-stdio-bridge --url <https://server/mcp> [options]\n\n` +
    `Options:\n` +
    `  -u, --url <url>        MCP Streamable HTTP endpoint (required)\n` +
    `  --bearer <token>       Add Authorization: Bearer <token> header\n` +
    `  -H, --header <k:v>     Append arbitrary header (may repeat)\n` +
    `  -v, --verbose          Emit diagnostic logs to stderr\n` +
    `  -h, --help             Show this help message\n`);
}

function parseHeader(header) {
  const idx = header.indexOf(':');
  if (idx === -1) {
    throw new Error(`Invalid header format: ${header}. Expected "Key: Value".`);
  }
  const name = header.slice(0, idx).trim();
  const value = header.slice(idx + 1).trim();
  if (!name || !value) {
    throw new Error(`Invalid header format: ${header}. Expected "Key: Value".`);
  }
  return [name, value];
}

function isInitializeRequest(message) {
  return message && typeof message === 'object' && !Array.isArray(message) && message.method === 'initialize';
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help || !args.url) {
    printHelp();
    process.exit(args.help && !args.url ? 1 : 0);
  }

  if (!args.bearer && process.env.TOKEN_AI_MCP_TOKEN) {
    args.bearer = process.env.TOKEN_AI_MCP_TOKEN;
  }

  let target;
  try {
    target = new URL(args.url);
  } catch (error) {
    console.error(`Invalid URL: ${args.url}`);
    process.exit(1);
  }

  const headerEntries = [];
  if (args.bearer) {
    headerEntries.push(['Authorization', `Bearer ${args.bearer}`]);
  }
  for (const header of args.headers) {
    try {
      headerEntries.push(parseHeader(header));
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }

  const requestInit = headerEntries.length > 0 ? { headers: Object.fromEntries(headerEntries) } : undefined;

  const remote = new StreamableHTTPClientTransport(target, requestInit ? { requestInit } : undefined);
  const local = new CompatStdioServerTransport();

  let shuttingDown = false;

const verboseLog = (...messages) => {
  if (args.verbose) {
    console.error('[mcp-proxy]', ...messages);
  }
};

const CODEX_SCHEMAS = {
  codex_start: {
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
  },
  codex_reply: {
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
  },
  codex_exec: {
    type: 'object',
    properties: {
      prompt: { type: 'string', minLength: 1 },
      output_schema: {
        anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }],
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
  },
};

function sanitizeAdditionalProperties(schema) {
  if (!schema || typeof schema !== 'object') return;

  if (Array.isArray(schema)) {
    for (const entry of schema) sanitizeAdditionalProperties(entry);
    return;
  }

  if ('additionalProperties' in schema) {
    const value = schema.additionalProperties;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
      schema.additionalProperties = true;
    } else {
      sanitizeAdditionalProperties(value);
    }
  }

  if ('properties' in schema && typeof schema.properties === 'object') {
    for (const key of Object.keys(schema.properties)) {
      sanitizeAdditionalProperties(schema.properties[key]);
    }
  }

  if ('items' in schema) {
    sanitizeAdditionalProperties(schema.items);
  }

  if ('anyOf' in schema) {
    sanitizeAdditionalProperties(schema.anyOf);
  }

  if ('oneOf' in schema) {
    sanitizeAdditionalProperties(schema.oneOf);
  }

  if ('allOf' in schema) {
    sanitizeAdditionalProperties(schema.allOf);
  }
}

function patchMessageForCodex(message) {
  if (!message || typeof message !== 'object') return message;
  if (message.result && Array.isArray(message.result.tools)) {
    verboseLog('Sanitizing listTools payload from remote');
    for (const tool of message.result.tools) {
      if (tool && tool.inputSchema) {
        sanitizeAdditionalProperties(tool.inputSchema);
        if (args.verbose && (tool.name === 'codex_start' || tool.name === 'codex_reply' || tool.name === 'codex_exec')) {
          try {
            console.error('[mcp-proxy]', `${tool.name} schema post-sanitize`, JSON.stringify(tool.inputSchema));
          } catch {}
        }
      }
      if (tool && CODEX_SCHEMAS[tool.name]) {
        tool.inputSchema = CODEX_SCHEMAS[tool.name];
      }
    }
    try {
      fs.writeFileSync('/tmp/dexter-mcp-bridge-tools.json', JSON.stringify(message.result.tools, null, 2));
    } catch {}
  }
  return message;
}

  const shutdown = async (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    verboseLog('Shutting down.');
    try {
      await Promise.allSettled([remote.close(), local.close()]);
    } finally {
      process.exit(code);
    }
  };

  remote.onmessage = async (message) => {
    try {
      await local.send(patchMessageForCodex(message));
    } catch (error) {
      console.error('Failed to forward message from remote:', error);
      await shutdown(1);
    }
  };

  remote.onerror = async (error) => {
    console.error('Remote transport error:', error instanceof Error ? error.message : error);
    await shutdown(1);
  };

  remote.onclose = async () => {
    verboseLog('Remote closed connection.');
    await shutdown(0);
  };

  local.onmessage = async (message) => {
    try {
      if (isInitializeRequest(message)) {
        const protocolVersion = message.params?.protocolVersion;
        if (protocolVersion) {
          remote.setProtocolVersion(protocolVersion);
          verboseLog('Set protocol version', protocolVersion);
        }
      }
      await remote.send(message);
    } catch (error) {
      console.error('Failed to forward message to remote:', error instanceof Error ? error.message : error);
      await shutdown(1);
    }
  };

  local.onerror = async (error) => {
    console.error('Stdio transport error:', error instanceof Error ? error.message : error);
    await shutdown(1);
  };

  local.onclose = async () => {
    verboseLog('Local transport closed.');
    await shutdown(0);
  };

  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, () => {
      verboseLog(`Received ${signal}`);
      shutdown(0).catch(() => process.exit(1));
    });
  }

  await remote.start();
  await local.start();
  verboseLog(`Proxy connected. Bridging ${target.href} <-> stdio`);
}

main().catch((error) => {
  console.error('Fatal error starting MCP proxy:', error instanceof Error ? error.message : error);
  process.exit(1);
});
