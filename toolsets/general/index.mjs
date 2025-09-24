import { z } from 'zod';

const DOCUMENTS = [
  {
    id: 'dexter-wallet-overview',
    title: 'Dexter Wallet Overview',
    url: 'https://dexter.cash/docs/wallets',
    text: 'Summary of how Dexter manages custodial and Supabase-linked wallets, including default resolution logic and session overrides.',
    metadata: { topic: 'wallets', audience: 'internal' },
  },
  {
    id: 'dexter-mcp-auth',
    title: 'Dexter MCP Authorization Flow',
    url: 'https://dexter.cash/docs/mcp-auth',
    text: 'Describes the OAuth and Supabase token handling used by the Dexter MCP server, along with expected headers and troubleshooting tips.',
    metadata: { topic: 'oauth', audience: 'developers' },
  },
  {
    id: 'dexter-connectors',
    title: 'Dexter Connector Playbook',
    url: 'https://dexter.cash/docs/connectors',
    text: 'Operational checklist for connecting external MCP clients (Claude, ChatGPT) to the Dexter stack, including environment variables and scopes.',
    metadata: { topic: 'connectors', audience: 'operators' },
  },
];

function normalizeQuery(args) {
  if (!args) return '';
  if (typeof args === 'string') return args.trim();
  if (typeof args === 'object' && typeof args.query === 'string') return args.query.trim();
  return '';
}

function searchDocuments(query) {
  if (!query) return DOCUMENTS.slice(0, 5);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return DOCUMENTS
    .map((doc) => {
      const haystack = `${doc.title} ${doc.text}`.toLowerCase();
      const score = terms.reduce((acc, term) => (haystack.includes(term) ? acc + 1 : acc), 0);
      return { doc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.doc)
    .slice(0, 5);
}

function normalizeId(args) {
  if (!args) return '';
  if (typeof args === 'string') return args.trim();
  if (typeof args === 'object' && typeof args.id === 'string') return args.id.trim();
  return '';
}

function buildSearchContent(results) {
  const payload = {
    results: results.map((doc) => ({ id: doc.id, title: doc.title, url: doc.url })),
  };
  return [{ type: 'text', text: JSON.stringify(payload) }];
}

function buildFetchContent(doc) {
  const payload = {
    id: doc.id,
    title: doc.title,
    text: doc.text,
    url: doc.url,
    metadata: doc.metadata || null,
  };
  return [{ type: 'text', text: JSON.stringify(payload) }];
}

export function registerGeneralToolset(server) {
  server.registerTool(
    'search',
    {
      title: 'Search Dexter Knowledge',
      description: 'Search Dexter operator and developer notes for troubleshooting connectors.',
      _meta: {
        category: 'knowledge-base',
        access: 'public',
        tags: ['docs', 'search']
      },
      inputSchema: {
        query: z.string().describe('Natural language search string.').optional(),
      },
    },
    async (args = {}) => {
      const query = normalizeQuery(args);
      const results = searchDocuments(query);
      return {
        content: buildSearchContent(results),
        structuredContent: { results },
      };
    }
  );

  server.registerTool(
    'fetch',
    {
      title: 'Fetch Dexter Knowledge Document',
      description: 'Retrieve full text for a previously discovered Dexter knowledge snippet.',
      _meta: {
        category: 'knowledge-base',
        access: 'public',
        tags: ['docs', 'fetch']
      },
      inputSchema: {
        id: z.string().describe('Identifier returned by the search tool.'),
      },
    },
    async (args = {}) => {
      const id = normalizeId(args);
      if (!id) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'missing_id' }) }],
          isError: true,
        };
      }
      const doc = DOCUMENTS.find((item) => item.id === id);
      if (!doc) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'not_found', id }) }],
          isError: true,
        };
      }
      return {
        content: buildFetchContent(doc),
        structuredContent: doc,
      };
    }
  );
}
