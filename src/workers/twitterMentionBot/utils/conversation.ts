import type { TwitterMention, ConversationEntry } from '../types.js';

export type ReplyTarget = 'bot' | 'other' | 'unknown';

function normaliseHandle(handle: string | null | undefined): string {
  return (handle || '').trim().replace(/^@+/, '').toLowerCase();
}

function normaliseEntries(entries: ConversationEntry[] | undefined | null): ConversationEntry[] {
  if (!entries || !entries.length) return [];
  return entries.filter((entry) => entry && (entry.text || entry.handle));
}

export function inferReplyTargetForMention(mention: TwitterMention, botHandle: string): ReplyTarget {
  const history = normaliseEntries(mention.history);
  if (history.length <= 1) {
    return 'unknown';
  }

  const bot = normaliseHandle(botHandle);
  for (let index = history.length - 2; index >= 0; index -= 1) {
    const entry = history[index];
    if (!entry) continue;
    if (entry.isSelf) {
      return 'bot';
    }
    const handle = normaliseHandle(entry.handle);
    if (handle && handle !== bot) {
      return 'other';
    }
    if (!entry.isSelf && !handle && (entry.text || '').length) {
      return 'other';
    }
  }

  return 'unknown';
}
