# Private DM Support for Twitter Transport

## Goal
Allow the existing Twitter responder to operate on direct messages so we can debug privately (or service select users) without disturbing the public mention flow.

## 1. Discovery / Feasibility
- Confirm the bot account can receive DMs from the tester (mutual follow or “allow DMs from everyone”).
- Use the headed Playwright session to inspect `https://x.com/messages`:
  - Capture DOM structure for the conversation list (detecting new/unread items).
  - Identify how individual messages are represented (message bubbles, sender handle, timestamps, message IDs).
  - Verify the composer element and send button for replying.
- Ensure the session isn’t gated by CAPTCHA or additional auth prompts.

## 2. State Model
- Extend the existing state file (`storage/twitterMentionBotState.json`) or create a sibling to track DM cursors:
  - `lastSeenDmId`
  - Per-conversation metadata (conversation ID → last processed message ID, last reply timestamp).
- Keep mention state and DM state separate so the public workflow is unaffected.

## 3. Playwright Client Changes
- Add `fetchLatestDirectMessages(limit)`:
  - Navigate to `https://x.com/messages`.
  - Wait for the conversation list to hydrate.
  - Iterate conversations, collect the newest incoming message per chat with fields:
    - `conversationId` / URL
    - `id` (message ID)
    - `authorHandle`
    - `text`
    - `createdAt`
  - Return messages ordered newest → oldest so the worker can filter “already processed.”
- Add `postDirectMessage(conversationId, replyText)`:
  - Open the conversation by URL.
  - Locate the composer (same stealth tweaks we use elsewhere).
  - Insert `replyText` and click the send button.
  - Confirm the message bubble appears; raise if send fails.
- Reuse the existing anti-automation init script so Twitter UI stays stable.
- Add minimal retry/backoff if the DM view is slower than notifications.

## 4. Worker / Orchestration Updates
- Update `twitterMentionBot/index.ts` to poll both mentions and DMs:
  - (a) existing `fetchLatestMentions`
  - (b) new `fetchLatestDirectMessages`
- Normalize DM messages into the same shape as mentions (plus `channel: 'dm'`) so `/internal/twitter/mentions/execute` can stay untouched.
- Extend state persistence (`lastSeenDmId`, per-conversation markers).
- When `channel === 'dm'`, use `postDirectMessage` instead of `postReply`.
- Update logging to distinguish channels (e.g., `processing DM from @handle`).

## 5. Configuration / Rollout
- Gate DM polling behind a flag (`ENABLE_DM_POLLING`) so production can keep the mention-only behavior until we’re ready.
- Document prerequisites (mutual follow, DM permissions).
- Optionally maintain an allowlist of handles permitted to DM the bot for private testing.

## 6. QA
- Run the worker in headed mode, confirm it:
  - Detects new DMs.
  - Produces an agent reply.
  - Sends the DM response successfully.
- Restart the worker to ensure DM state prevents duplicate replies.
- Review logs for DM-specific errors (missing composer, send failure, auth issues).
- Verify the agent’s instructions make sense in DM context (adjust transport prompt later if needed).
