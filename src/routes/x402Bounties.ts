import type { Express, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../prisma.js';
import { upsertX402ResourceSnapshot } from '../services/x402/catalog.js';
import { logger, style } from '../logger.js';
import { getSupabaseUserFromAccessToken } from '../utils/supabaseAdmin.js';

const log = logger.child('x402.bounties');

const bountyStatusEnum = z.enum(['draft', 'scheduled', 'open', 'voting', 'closed']);

const submissionPayloadSchema = z.object({
  submitterWallet: z.string().min(32).max(255),
  submitterUserId: z.string().min(1).max(255).optional(),
  facilitatorUrl: z.string().url('facilitator_url_invalid'),
  resourceUrl: z.string().url('resource_url_invalid'),
  resourceSnapshot: z.record(z.any()).optional(),
  notes: z.string().max(2000).optional(),
});

const votePayloadSchema = z.object({
  submissionId: z.string().uuid('submission_id_invalid'),
  voterWallet: z.string().min(32).max(255),
  voterUserId: z.string().min(1).max(255).optional(),
  weightRaw: z
    .string()
    .regex(/^\d+$/, 'weight_raw_must_be_positive_integer')
    .refine((value) => BigInt(value) > 0n, 'weight_raw_must_be_positive_integer'),
});

const createBountySchema = z.object({
  slug: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).optional(),
  prompt: z.string().trim().min(1),
  rewardAmount: z.union([z.number(), z.string().trim()]).transform((value, ctx) => {
    try {
      const decimal = new Prisma.Decimal(value as any);
      if (decimal.lte(0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reward_amount_must_be_positive' });
        return z.NEVER;
      }
      return decimal;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reward_amount_invalid' });
      return z.NEVER;
    }
  }),
  rewardCurrency: z.string().trim().min(1).max(16).default('DEXTER'),
  submissionOpenAt: z.coerce.date(),
  submissionCloseAt: z.coerce.date(),
  votingCloseAt: z.coerce.date(),
  isFeatured: z.coerce.boolean().optional(),
});

const updateBountySchema = createBountySchema.partial().extend({
  status: bountyStatusEnum.optional(),
});

const listQuerySchema = z.object({
  status: bountyStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function nowUtc(): Date {
  return new Date();
}

function decimalToString(value: Prisma.Decimal | null | undefined): string | null {
  if (value == null) return null;
  return new Prisma.Decimal(value).toString();
}

function computeStage(record: { submission_open_at: Date; submission_close_at: Date; voting_close_at: Date; status: string }) {
  const now = nowUtc();
  if (record.status === 'draft') return 'draft';
  if (now < record.submission_open_at) return 'scheduled';
  if (now < record.submission_close_at) return 'open';
  if (now < record.voting_close_at) return 'voting';
  return 'closed';
}

function serializeSubmission(record: Prisma.x402_bounty_submissions) {
  return {
    id: record.id,
    bountyId: record.bounty_id,
    submitterWallet: record.submitter_wallet,
    submitterUserId: record.submitter_user_id,
    facilitatorUrl: record.facilitator_url,
    resourceUrl: record.resource_url,
    resourceAccepts: record.resource_accepts ?? [],
    resourceMetadata: record.resource_metadata ?? {},
    notes: record.notes,
    status: record.status,
    isWinner: record.is_winner,
    winnerRank: record.winner_rank,
    totalVoteWeight: decimalToString(record.total_vote_weight) ?? '0',
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
    approvedAt: record.approved_at ? record.approved_at.toISOString() : null,
    rejectedAt: record.rejected_at ? record.rejected_at.toISOString() : null,
  };
}

function serializeBounty(record: Prisma.x402_bounties & { submissions?: Prisma.x402_bounty_submissions[] }) {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    prompt: record.prompt,
    rewardAmount: decimalToString(record.reward_amount),
    rewardCurrency: record.reward_currency ?? null,
    submissionOpenAt: record.submission_open_at.toISOString(),
    submissionCloseAt: record.submission_close_at.toISOString(),
    votingCloseAt: record.voting_close_at.toISOString(),
    status: record.status,
    stage: computeStage(record),
    isFeatured: record.is_featured,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
    finalizedAt: record.finalized_at ? record.finalized_at.toISOString() : null,
    submissions: record.submissions ? record.submissions.map(serializeSubmission) : undefined,
  };
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function validateSchedule(openAt: Date, closeAt: Date, votingCloseAt: Date) {
  if (!(openAt < closeAt && closeAt < votingCloseAt)) {
    throw new Error('invalid_schedule_order');
  }
}

async function generateUniqueSlug(baseTitle: string): Promise<string> {
  let base = normalizeSlug(baseTitle);
  if (!base) base = `bounty-${Date.now()}`;
  let candidate = base;
  let suffix = 1;
  while (await prisma.x402_bounties.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 1000) throw new Error('unable_to_generate_unique_slug');
  }
  return candidate;
}

async function upsertResourceSnapshotIfNeeded(resourceUrl: string, facilitatorUrl: string, snapshot: Record<string, unknown> | undefined) {
  if (!snapshot) return null;
  try {
    return await upsertX402ResourceSnapshot({
      resourceUrl,
      facilitatorUrl,
      response: snapshot,
      metadata: { source: 'bounty_submission' },
    });
  } catch (error: unknown) {
    log.warn(
      style.line('resource_snapshot_failed', 'warn', [
        ['resource', resourceUrl],
        ['error', error instanceof Error ? error.message : String(error)],
      ]),
    );
    return null;
  }
}

async function requireAdmin(req: Request, res: Response) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ ok: false, error: 'authentication_required' });
    return null;
  }
  const token = header.slice(7).trim();
  if (!token) {
    res.status(401).json({ ok: false, error: 'authentication_required' });
    return null;
  }
  try {
    const user = await getSupabaseUserFromAccessToken(token);
    const roles = extractRoles(user.app_metadata?.roles);
    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    const metaAdmin = normalizeBoolean(user.user_metadata?.isAdmin) || normalizeBoolean(user.user_metadata?.isSuperAdmin);
    if (!isAdmin && !metaAdmin) {
      res.status(403).json({ ok: false, error: 'admin_required' });
      return null;
    }
    return {
      userId: String(user.id),
      email: typeof user.email === 'string' && user.email.trim() ? String(user.email) : null,
    };
  } catch (error: any) {
    log.warn({ event: 'admin_lookup_failed', error: error?.message || error }, 'admin-auth-failed');
    res.status(403).json({ ok: false, error: 'admin_required' });
    return null;
  }
}

function extractRoles(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry == null ? '' : String(entry).trim().toLowerCase()))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return lowered ? [lowered] : [];
  }
  return [];
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return lowered === 'true' || lowered === '1' || lowered === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

export function registerX402BountyRoutes(app: Express) {
  registerAdminRoutes(app);

  app.get('/api/x402/bounties/current', async (_req: Request, res: Response) => {
    try {
      const now = nowUtc();
      const bounty = await prisma.x402_bounties.findFirst({
        where: {
          OR: [
            { status: { in: ['open', 'voting'] } },
            {
              status: 'scheduled',
              submission_open_at: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
            },
          ],
        },
        orderBy: { submission_open_at: 'asc' },
        include: { submissions: { orderBy: [{ total_vote_weight: 'desc' }, { created_at: 'asc' }] } },
      });
      if (!bounty) {
        res.json({ ok: true, bounty: null });
        return;
      }
      res.json({ ok: true, bounty: serializeBounty(bounty) });
    } catch (error: unknown) {
      log.error(style.line('current_failed', 'error', [['error', error instanceof Error ? error.message : String(error)]]), error);
      res.status(500).json({ ok: false, error: 'bounty_fetch_failed' });
    }
  });

  app.get('/api/x402/bounties/:slug', async (req: Request, res: Response) => {
    try {
      const bounty = await prisma.x402_bounties.findUnique({
        where: { slug: req.params.slug },
        include: { submissions: { orderBy: [{ total_vote_weight: 'desc' }, { created_at: 'asc' }] } },
      });
      if (!bounty) {
        res.status(404).json({ ok: false, error: 'bounty_not_found' });
        return;
      }
      res.json({ ok: true, bounty: serializeBounty(bounty) });
    } catch (error: unknown) {
      log.error(style.line('detail_failed', 'error', [['slug', req.params.slug], ['error', error instanceof Error ? error.message : String(error)]]), error);
      res.status(500).json({ ok: false, error: 'bounty_fetch_failed' });
    }
  });

  app.get('/api/x402/bounties/:slug/submissions', async (req: Request, res: Response) => {
    const bounty = await prisma.x402_bounties.findUnique({ where: { slug: req.params.slug } });
    if (!bounty) {
      res.status(404).json({ ok: false, error: 'bounty_not_found' });
      return;
    }
    const submissions = await prisma.x402_bounty_submissions.findMany({
      where: { bounty_id: bounty.id },
      orderBy: [{ total_vote_weight: 'desc' }, { created_at: 'asc' }],
    });
    res.json({ ok: true, submissions: submissions.map(serializeSubmission) });
  });

  app.post('/api/x402/bounties/:slug/submissions', async (req: Request, res: Response) => {
    const parsed = submissionPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_submission_payload', details: parsed.error.flatten() });
      return;
    }

    const bounty = await prisma.x402_bounties.findUnique({ where: { slug: req.params.slug } });
    if (!bounty) {
      res.status(404).json({ ok: false, error: 'bounty_not_found' });
      return;
    }

    const stage = computeStage(bounty);
    if (stage !== 'open') {
      res.status(409).json({ ok: false, error: 'bounty_not_accepting_submissions', stage });
      return;
    }

    const { submitterWallet, submitterUserId, facilitatorUrl, resourceUrl, resourceSnapshot, notes } = parsed.data;
    let normalizedResourceUrl = resourceUrl.trim();
    try {
      const url = new URL(resourceUrl);
      url.hash = '';
      normalizedResourceUrl = url.toString();
    } catch {}

    const snapshot = await upsertResourceSnapshotIfNeeded(normalizedResourceUrl, facilitatorUrl, resourceSnapshot);
    const storedAccepts = snapshot?.accepts ?? [];
    const storedMetadata = snapshot?.metadata ?? resourceSnapshot ?? {};

    try {
      const created = await prisma.x402_bounty_submissions.create({
        data: {
          bounty_id: bounty.id,
          submitter_wallet: submitterWallet.trim(),
          submitter_user_id: submitterUserId ?? null,
          facilitator_url: facilitatorUrl,
          resource_url: normalizedResourceUrl,
          resource_accepts: storedAccepts as Prisma.InputJsonValue,
          resource_metadata: storedMetadata as Prisma.InputJsonValue,
          notes: notes ?? null,
        },
      });
      log.info(style.line('submission_created', 'info', [['slug', bounty.slug], ['submission', created.id]]));
      res.status(201).json({ ok: true, submission: serializeSubmission(created) });
    } catch (error: unknown) {
      log.error(style.line('submission_failed', 'error', [['slug', bounty.slug], ['error', error instanceof Error ? error.message : String(error)]]), error);
      res.status(500).json({ ok: false, error: 'submission_create_failed' });
    }
  });

  app.post('/api/x402/bounties/:slug/votes', async (req: Request, res: Response) => {
    const parsed = votePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_vote_payload', details: parsed.error.flatten() });
      return;
    }

    const bounty = await prisma.x402_bounties.findUnique({ where: { slug: req.params.slug } });
    if (!bounty) {
      res.status(404).json({ ok: false, error: 'bounty_not_found' });
      return;
    }

    const stage = computeStage(bounty);
    if (stage !== 'voting') {
      res.status(409).json({ ok: false, error: 'bounty_not_accepting_votes', stage });
      return;
    }

    const submission = await prisma.x402_bounty_submissions.findFirst({
      where: { id: parsed.data.submissionId, bounty_id: bounty.id },
    });
    if (!submission || submission.status === 'rejected') {
      res.status(404).json({ ok: false, error: 'submission_not_found' });
      return;
    }

    const weightDecimal = new Prisma.Decimal(parsed.data.weightRaw);
    if (weightDecimal.lte(0)) {
      res.status(400).json({ ok: false, error: 'weight_must_be_positive' });
      return;
    }

    try {
      const existing = await prisma.x402_bounty_votes.findUnique({
        where: { bounty_id_voter_wallet: { bounty_id: bounty.id, voter_wallet: parsed.data.voterWallet } },
      });
      const previousWeight = existing ? new Prisma.Decimal(existing.weight_raw) : new Prisma.Decimal(0);
      const delta = weightDecimal.minus(previousWeight);

      const [vote, updatedSubmission] = await prisma.$transaction([
        prisma.x402_bounty_votes.upsert({
          where: { bounty_id_voter_wallet: { bounty_id: bounty.id, voter_wallet: parsed.data.voterWallet } },
          update: {
            submission_id: submission.id,
            voter_user_id: parsed.data.voterUserId ?? null,
            weight_raw: weightDecimal,
            cast_at: new Date(),
          },
          create: {
            bounty_id: bounty.id,
            submission_id: submission.id,
            voter_wallet: parsed.data.voterWallet,
            voter_user_id: parsed.data.voterUserId ?? null,
            weight_raw: weightDecimal,
          },
        }),
        prisma.x402_bounty_submissions.update({
          where: { id: submission.id },
          data: {
            total_vote_weight: {
              increment: delta,
            },
            updated_at: new Date(),
          },
        }),
      ]);

      res.json({
        ok: true,
        vote: {
          id: vote.id,
          bountyId: vote.bounty_id,
          submissionId: vote.submission_id,
          voterWallet: vote.voter_wallet,
          voterUserId: vote.voter_user_id,
          weightRaw: weightDecimal.toString(),
          castAt: vote.cast_at.toISOString(),
        },
        submission: serializeSubmission(updatedSubmission),
      });
    } catch (error: unknown) {
      log.error(style.line('vote_failed', 'error', [['slug', bounty.slug], ['error', error instanceof Error ? error.message : String(error)]]), error);
      res.status(500).json({ ok: false, error: 'vote_record_failed' });
    }
  });
}

function registerAdminRoutes(app: Express) {
  app.post('/api/admin/x402/bounties', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const parsed = createBountySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    try {
      validateSchedule(parsed.data.submissionOpenAt, parsed.data.submissionCloseAt, parsed.data.votingCloseAt);
    } catch {
      res.status(400).json({ ok: false, error: 'schedule_must_be_open_lt_close_lt_voting' });
      return;
    }

    try {
      const slug = parsed.data.slug ? normalizeSlug(parsed.data.slug) : await generateUniqueSlug(parsed.data.title);
      const created = await prisma.x402_bounties.create({
        data: {
          slug,
          title: parsed.data.title,
          summary: parsed.data.summary ?? null,
          prompt: parsed.data.prompt,
          reward_amount: parsed.data.rewardAmount,
          reward_currency: parsed.data.rewardCurrency,
          submission_open_at: parsed.data.submissionOpenAt,
          submission_close_at: parsed.data.submissionCloseAt,
          voting_close_at: parsed.data.votingCloseAt,
          status: 'scheduled',
          is_featured: Boolean(parsed.data.isFeatured),
          created_by_user_id: admin.userId,
        },
      });
      log.info(style.line('bounty_create', 'info', [['slug', slug], ['admin', admin.email ?? admin.userId]]));
      res.status(201).json({ ok: true, bounty: serializeBounty(created) });
    } catch (error: unknown) {
      log.error(style.line('bounty_create_failed', 'error', [['admin', admin.email ?? admin.userId], ['error', error instanceof Error ? error.message : String(error)]]), error);
      res.status(500).json({ ok: false, error: 'bounty_create_failed' });
    }
  });

  app.patch('/api/admin/x402/bounties/:id', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const parsed = updateBountySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const bounty = await prisma.x402_bounties.findUnique({ where: { id: req.params.id } });
    if (!bounty) {
      res.status(404).json({ ok: false, error: 'bounty_not_found' });
      return;
    }

    const submissionOpenAt = parsed.data.submissionOpenAt ?? bounty.submission_open_at;
    const submissionCloseAt = parsed.data.submissionCloseAt ?? bounty.submission_close_at;
    const votingCloseAt = parsed.data.votingCloseAt ?? bounty.voting_close_at;

    try {
      validateSchedule(submissionOpenAt, submissionCloseAt, votingCloseAt);
    } catch {
      res.status(400).json({ ok: false, error: 'schedule_must_be_open_lt_close_lt_voting' });
      return;
    }

    const data: Prisma.x402_bountiesUpdateInput = {
      submission_open_at: submissionOpenAt,
      submission_close_at: submissionCloseAt,
      voting_close_at: votingCloseAt,
    };

    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.summary !== undefined) data.summary = parsed.data.summary ?? null;
    if (parsed.data.prompt !== undefined) data.prompt = parsed.data.prompt;
    if (parsed.data.rewardAmount !== undefined) data.reward_amount = parsed.data.rewardAmount;
    if (parsed.data.rewardCurrency !== undefined) data.reward_currency = parsed.data.rewardCurrency;
    if (parsed.data.isFeatured !== undefined) data.is_featured = parsed.data.isFeatured;
    if (parsed.data.slug !== undefined) data.slug = normalizeSlug(parsed.data.slug);
    if (parsed.data.status) {
      data.status = parsed.data.status;
      if (parsed.data.status === 'closed') data.finalized_at = new Date();
    }

    try {
      const updated = await prisma.x402_bounties.update({ where: { id: bounty.id }, data });
      log.info(style.line('bounty_update', 'info', [['slug', updated.slug], ['admin', admin.email ?? admin.userId]]));
      res.json({ ok: true, bounty: serializeBounty(updated) });
    } catch (error: unknown) {
      log.error(style.line('bounty_update_failed', 'error', [['id', bounty.id], ['admin', admin.email ?? admin.userId], ['error', error instanceof Error ? error.message : String(error)]]), error);
      res.status(500).json({ ok: false, error: 'bounty_update_failed' });
    }
  });

  app.post('/api/admin/x402/bounties/:id/cancel', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const bounty = await prisma.x402_bounties.findUnique({ where: { id: req.params.id } });
    if (!bounty) {
      res.status(404).json({ ok: false, error: 'bounty_not_found' });
      return;
    }

    const now = new Date();

    try {
      await prisma.$transaction(async (tx) => {
        await tx.x402_bounty_submissions.updateMany({
          where: { bounty_id: bounty.id },
          data: {
            status: 'withdrawn',
            is_winner: false,
            winner_rank: null,
            updated_at: now,
          },
        });
        await tx.x402_bounties.update({
          where: { id: bounty.id },
          data: {
            status: 'closed',
            finalized_at: now,
            is_featured: false,
            updated_at: now,
          },
        });
      });
      log.info(style.line('bounty_cancel', 'warn', [['slug', bounty.slug], ['admin', admin.email ?? admin.userId]]));
      res.json({ ok: true });
    } catch (error: unknown) {
      log.error(style.line('bounty_cancel_failed', 'error', [['slug', bounty.slug], ['admin', admin.email ?? admin.userId], ['error', error instanceof Error ? error.message : String(error)]]), error);
      res.status(500).json({ ok: false, error: 'bounty_cancel_failed' });
    }
  });

  app.get('/api/admin/x402/bounties', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }

    const { status, limit = 20 } = parsed.data;

    try {
      const records = await prisma.x402_bounties.findMany({
        where: status ? { status } : undefined,
        orderBy: { submission_open_at: 'desc' },
        take: limit,
      });
      res.json({ ok: true, bounties: records.map((record) => serializeBounty(record)) });
    } catch (error: unknown) {
      log.error(style.line('bounty_list_failed', 'error', [['admin', admin.email ?? admin.userId], ['error', error instanceof Error ? error.message : String(error)]]), error);
      res.status(500).json({ ok: false, error: 'bounty_list_failed' });
    }
  });
}
