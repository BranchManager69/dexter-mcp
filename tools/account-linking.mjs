import { z } from 'zod';

// Helper to get headers from extra object (matching pattern from wallet-auth.mjs)
function headersFromExtra(extra){
  try {
    if (extra?.requestInfo?.headers) return extra.requestInfo.headers;
  } catch {}
  try {
    if (extra?.request?.headers) return extra.request.headers;
  } catch {}
  try {
    if (extra?.httpRequest?.headers) return extra.httpRequest.headers;
  } catch {}
  return {};
}

function getIdentity(args, extra) {
  try {
    const headers = headersFromExtra(extra);
    const issuer = String(args?.__issuer || headers['x-user-issuer'] || '').trim();
    const subject = String(args?.__sub || headers['x-user-sub'] || '').trim();
    const email = String(args?.__email || headers['x-user-email'] || '').trim();
    return { issuer, subject, email, headers };
  } catch {
    return { issuer: '', subject: '', email: '', headers: headersFromExtra(extra) };
  }
}

// Generate secure 6-char code (avoiding confusing characters)
function generateLinkingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O, 1/I/L
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function registerAccountLinkingTools(server) {
  // Check if current MCP user has a linked Dexter account
  server.registerTool('check_dexter_account_link', {
    title: 'Check Dexter Account Link',
    description: 'Check if the current MCP user has a linked Dexter account.',
    inputSchema: {},
    outputSchema: { 
      is_linked: z.boolean(),
      supabase_user_id: z.string().nullable(),
      linked_at: z.string().nullable()
    }
  }, async (args, extra) => {
    try {
      const { issuer, subject } = getIdentity(args, extra);
      
      if (!issuer || !subject) {
        try {
          console.log('[linking] missing identity', { issuer, subject, args, sid: extra?.sessionId, headers: Object.fromEntries(Object.entries(getIdentity(args, extra).headers || {})) });
        } catch {}
        return { 
          content: [{ type: 'text', text: 'no_oauth_identity' }], 
          isError: true 
        };
      }
      
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const link = await prisma.account_links.findUnique({
        where: { 
          oauth_provider_oauth_subject: { 
            oauth_provider: issuer, 
            oauth_subject: subject 
          } 
        }
      });
      
      if (link) {
        return {
          structuredContent: {
            is_linked: true,
            supabase_user_id: link.supabase_user_id,
            linked_at: link.linked_at.toISOString()
          },
          content: [{ 
            type: 'text', 
            text: `Linked to Dexter account: ${link.supabase_user_id}` 
          }]
        };
      }
      
      return {
        structuredContent: {
          is_linked: false,
          supabase_user_id: null,
          linked_at: null
        },
        content: [{ 
          type: 'text', 
          text: 'No Dexter account linked' 
        }]
      };
    } catch (e) {
      return { 
        content: [{ type: 'text', text: e?.message || 'check_failed' }], 
        isError: true 
      };
    }
  });

  // Generate a linking code for the current MCP user
  server.registerTool('generate_dexter_linking_code', {
    title: 'Generate Dexter Linking Code',
    description: 'Generate a code to link your MCP account with a Dexter account on the website.',
    inputSchema: {},
    outputSchema: { 
      code: z.string(),
      expires_at: z.string(),
      instructions: z.string()
    }
  }, async (args, extra) => {
    try {
      const { issuer, subject } = getIdentity(args, extra);
      
      if (!issuer || !subject) {
        try {
          console.log('[linking] missing identity', { issuer, subject, args, sid: extra?.sessionId, headers: Object.fromEntries(Object.entries(getIdentity(args, extra).headers || {})) });
        } catch {}
        return { 
          content: [{ type: 'text', text: 'no_oauth_identity' }], 
          isError: true 
        };
      }
      
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      // Check if already linked
      const existing = await prisma.account_links.findUnique({
        where: { 
          oauth_provider_oauth_subject: { 
            oauth_provider: issuer, 
            oauth_subject: subject 
          } 
        }
      });
      
      if (existing) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Already linked to Dexter account' 
          }],
          isError: true
        };
      }
      
      // Clean up old expired codes for this user
      await prisma.linking_codes.deleteMany({
        where: {
          oauth_provider: issuer,
          oauth_subject: subject,
          expires_at: { lt: new Date() }
        }
      });
      
      // Check for recent code (rate limiting)
      const recentCode = await prisma.linking_codes.findFirst({
        where: {
          oauth_provider: issuer,
          oauth_subject: subject,
          expires_at: { gt: new Date() },
          used: false
        },
        orderBy: { created_at: 'desc' }
      });
      
      if (recentCode && recentCode.created_at > new Date(Date.now() - 60000)) {
        // Return existing code if created less than 1 minute ago
        return {
          structuredContent: {
            code: recentCode.code,
            expires_at: recentCode.expires_at.toISOString(),
            instructions: `Visit https://dexter.cash/link and enter code: ${recentCode.code}`
          },
          content: [{ 
            type: 'text', 
            text: `Your linking code: ${recentCode.code}\n\nVisit https://dexter.cash/link to complete linking.\nCode expires at ${recentCode.expires_at.toLocaleTimeString()}.` 
          }]
        };
      }
      
      // Generate new code
      const code = generateLinkingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await prisma.linking_codes.create({
        data: {
          code,
          oauth_provider: issuer,
          oauth_subject: subject,
          expires_at: expiresAt,
          used: false,
          attempts: 0
        }
      });
      
      return {
        structuredContent: {
          code,
          expires_at: expiresAt.toISOString(),
          instructions: `Visit https://dexter.cash/link and enter code: ${code}`
        },
        content: [{ 
          type: 'text', 
          text: `Your linking code: ${code}\n\nVisit https://dexter.cash/link to complete linking.\nCode expires in 10 minutes.` 
        }]
      };
    } catch (e) {
      return { 
        content: [{ type: 'text', text: e?.message || 'generate_failed' }], 
        isError: true 
      };
    }
  });

  // Get linked Dexter account details
  server.registerTool('get_linked_dexter_account', {
    title: 'Get Linked Dexter Account',
    description: 'Get details about your linked Dexter account.',
    inputSchema: {},
    outputSchema: {
      supabase_user_id: z.string(),
      linked_at: z.string(),
      link_initiated_by: z.string()
    }
  }, async (args, extra) => {
    try {
      const { issuer, subject } = getIdentity(args, extra);
      
      if (!issuer || !subject) {
        return { 
          content: [{ type: 'text', text: 'no_oauth_identity' }], 
          isError: true 
        };
      }
      
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const link = await prisma.account_links.findUnique({
        where: { 
          oauth_provider_oauth_subject: { 
            oauth_provider: issuer, 
            oauth_subject: subject 
          } 
        }
      });
      
      if (!link) {
        return {
          content: [{ 
            type: 'text', 
            text: 'No linked Dexter account found. Use generate_dexter_linking_code to link your account.' 
          }],
          isError: true
        };
      }
      
      return {
        structuredContent: {
          supabase_user_id: link.supabase_user_id,
          linked_at: link.linked_at.toISOString(),
          link_initiated_by: link.link_initiated_by
        },
        content: [{ 
          type: 'text', 
          text: `Linked to Dexter account: ${link.supabase_user_id}\nLinked on: ${link.linked_at.toLocaleDateString()}\nInitiated from: ${link.link_initiated_by}` 
        }]
      };
    } catch (e) {
      return { 
        content: [{ type: 'text', text: e?.message || 'get_failed' }], 
        isError: true 
      };
    }
  });

  // Unlink Dexter account (for testing/troubleshooting)
  server.registerTool('unlink_dexter_account', {
    title: 'Unlink Dexter Account',
    description: 'Remove the link between your MCP and Dexter accounts.',
    inputSchema: { 
      confirm: z.boolean().describe('Set to true to confirm unlinking')
    },
    outputSchema: { ok: z.boolean() }
  }, async ({ confirm }, extra) => {
    try {
      if (!confirm) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Set confirm=true to unlink your account' 
          }],
          isError: true
        };
      }
      
      const { issuer, subject } = getIdentity(args, extra);
      
      if (!issuer || !subject) {
        return { 
          content: [{ type: 'text', text: 'no_oauth_identity' }], 
          isError: true 
        };
      }
      
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.account_links.delete({
        where: { 
          oauth_provider_oauth_subject: { 
            oauth_provider: issuer, 
            oauth_subject: subject 
          } 
        }
      });
      
      return {
        structuredContent: { ok: true },
        content: [{ 
          type: 'text', 
          text: 'Successfully unlinked Dexter account' 
        }]
      };
    } catch (e) {
      // If record doesn't exist, that's ok
      if (e?.code === 'P2025') {
        return {
          structuredContent: { ok: true },
          content: [{ 
            type: 'text', 
            text: 'No linked account to remove' 
          }]
        };
      }
      return { 
        content: [{ type: 'text', text: e?.message || 'unlink_failed' }], 
        isError: true 
      };
    }
  });
}