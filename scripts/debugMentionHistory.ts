import process from 'node:process';
import { MentionBotBrowserClient } from '../dist/workers/twitterMentionBot/playwrightClient.js';
import { loadMentionBotConfig } from '../dist/workers/twitterMentionBot/config.js';

async function main(): Promise<void> {
  const mentionUrl = process.argv[2]?.trim();
  if (!mentionUrl) {
    console.error('Usage: npx tsx scripts/debugMentionHistory.ts <mention_url>');
    process.exitCode = 1;
    return;
  }

  const limit = Number(process.argv[3]) || 10;

  const config = await loadMentionBotConfig();
  const client = new MentionBotBrowserClient(config.sessionPath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ensureContext = (client as any).ensureContext?.bind(client);
  if (typeof ensureContext !== 'function') {
    throw new Error('Unable to access MentionBotBrowserClient.ensureContext');
  }

  const context = await ensureContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    const scope = globalThis as typeof globalThis & { __name?: unknown };
    if (typeof scope.__name !== 'function') {
      Object.defineProperty(scope, '__name', {
        configurable: true,
        value: (value: unknown) => value,
      });
    }
  });

  page.on('console', (msg) => {
    const args = msg.args();
    const renderedArgs = args.length
      ? args.map((arg) => {
          try {
            return arg.jsonValue();
          } catch {
            return arg.toString();
          }
        })
      : [];
    void Promise.all(renderedArgs).then((values) => {
      const serialised = values.map((value) => JSON.stringify(value)).join(' ');
      console.log(`[page.console] ${msg.type()}: ${serialised || msg.text()}`);
    });
  });

  page.on('pageerror', (error) => {
    console.error('[page.error]', error);
  });

  try {
    console.log(`Navigating to mention: ${mentionUrl}`);
    await page.goto(mentionUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2_000);

    const globalNameType = await page.evaluate(() => typeof (globalThis as any).__name);
    console.log(`typeof globalThis.__name before shim: ${globalNameType}`);

    const afterShim = await page.evaluate(() => typeof (globalThis as any).__name);
    console.log(`typeof globalThis.__name after shim: ${afterShim}`);
    console.log('fetchMentionConversation implementation:\n', MentionBotBrowserClient.prototype.fetchMentionConversation.toString());
    console.log('Scraping conversation entries…');
    const BOT_HANDLE = 'dexteraiagent';
    const entries = await page.evaluate(
      ({ sliceLimit, botHandle }) => {
        function __name<T>(value: T): T {
          return value;
        }
        function extractText(root: Element | null): string {
          if (!root) return '';
          const parts: string[] = [];
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
          let current: Node | null = walker.nextNode();
          while (current) {
            if (current.nodeType === Node.TEXT_NODE) {
              parts.push(current.textContent || '');
            } else if (current.nodeType === Node.ELEMENT_NODE) {
              const el = current as HTMLElement;
              if (el.tagName === 'IMG' && el.hasAttribute('alt')) {
                parts.push(el.getAttribute('alt') || '');
              }
            }
            current = walker.nextNode();
          }
          return parts.join('').replace(/[ \t\n\r]+/g, ' ').trim();
        }

        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const selected = articles.slice(-sliceLimit);
        return selected.map((article) => {
          const handle =
            Array.from(article.querySelectorAll('[data-testid="User-Name"] span'))
              .map((span) => span.textContent || '')
              .find((text) => text.startsWith('@')) || '';
          const text = extractText(article.querySelector('[data-testid="tweetText"]'));
          const time = article.querySelector('time')?.getAttribute('datetime') || null;
          const normalisedHandle = handle.replace(/^@/, '').toLowerCase();
          const isSelf = normalisedHandle === botHandle.toLowerCase();
          return {
            handle: handle || (isSelf ? `@${botHandle}` : ''),
            text,
            timestamp: time,
            isSelf,
          };
        });
      },
      { sliceLimit: limit, botHandle: BOT_HANDLE },
    );
    console.dir(entries, { depth: null });
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browser: any = (client as any).browser;
    await browser?.close?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error('debugMentionHistory failed:', error);
  process.exitCode = 1;
});
