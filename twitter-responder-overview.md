# Twitter Responder Overview

## 1. Continuous Watcher (Playwright Worker)
- Runs as its own Node process (`pm2` process `twitter-mention-bot`) using the authenticated session in `sessions/twitter-session.json`.
- Poll cadence defaults to every 5 seconds for mentions and 10 seconds for DM inbox sweeps (both overrideable in `config/twitterMentionBot.json`). Each pass does:
  - **Mentions:** pulls the notifications timeline, keeps the 30 newest items, dedupes, and only processes tweets newer than the last stored tweet ID.
  - **DMs:** calls Twitter’s private inbox endpoint (`/i/api/1.1/dm/inbox_initial_state.json`), keeps the latest 100 messages, prunes anything older than 24 hours, and ignores messages authored by the bot’s own account ID.

## 2. Conversation Context Capture
- For each mention we inspect the tweet page, grab up to the last 10 tweets in that thread, and normalize them into `{handle, text, timestamp, isSelf}` structure. Non-text (e.g., emoji treated as `alt` text) is preserved; true empty messages are labeled `[non-text message]`.
- For DMs we rebuild conversation history from the inbox payload: up to 10 most recent messages in the same thread, tagged to identify whether the bot or the other party sent each one.

## 3. Identity & Wallet Linking
- Every mention/DM is normalized to a lowercase handle (stripping any leading `@`).
- We look up `user_profiles.twitter_handle` in the database, accepting both bare handle and `@handle`. No match shortcuts to the approved beta-tester messaging:
  - Mentions: “@<handle> This feature is only live for beta testers right now, but it’ll open to everyone on October 19 (time TBA). $DEXTER”
  - DMs: same copy prefixed with “Hey <handle>, …”
- A match yields the Supabase user ID, which feeds `ensureUserWallet`. That guarantees the responder has a managed wallet and an MCP JWT to act with.

## 4. Prompt Assembly & Agent Execution
- We fetch three instruction blocks before calling the concierge agent:
  1. The transport segment stored in Supabase under slug `agent.concierge.transport.twitter_reply`. This is where the “never expose bare signatures, always append the Solscan URL” rules live.
  2. Per-user memory instructions (optional) so the agent knows prior commitments.
  3. The concierge profile instructions (agent persona, tone, guardrails).
- For DMs we insert an extra paragraph reminding the agent that it’s a private reply, to stay under 240 characters, skip marketing fluff, and avoid stray `@` mentions.
- Prompt structure:
  - “Conversation so far” block with the (timestamped) history excluding the latest message.
  - “Latest tweet:” (or “Latest message:”) line summarizing the most recent user utterance.
- Execution uses the OpenAI Agents runtime with our concierge model and the hosted MCP tool (pointed at `env.MCP_URL`, authenticated via the wallet’s MCP JWT). We don’t stream; we wait for the final string result.

## 5. Posting Replies
- Mentions: prefer the internal Tweet compose API (`/i/api/1.1/statuses/update.json`) with `auto_populate_reply_metadata=true`. If Twitter returns a 4xx (common when session cookies refresh), we fall back to the browser UI: open the compose dialog, paste text, and click the Tweet button.
- DMs: navigate to `/messages/<conversationId>`, focus the composer, wipe any draft, insert the reply, and hit the send button.
- Replies longer than 280 characters get trimmed to 277 plus an ellipsis.
- Rate limiting: we remember timestamps of successful posts in the last 60 seconds; default cap is 6 replies/minute. If the cap is hit, we log and move to the next cycle so we don’t look like a bot storm.

## 6. State & Resilience
- Persistent state in `storage/twitterMentionBotState.json` tracks:
  - `lastSeenTweetId`
  - Per-conversation timestamps for mentions (`lastReplyAt`, `lastProcessedAt`)
  - Per-DM thread last message ID and timestamp
- On shutdown the worker saves state and closes the browser cleanly. On startup it reloads state so it doesn’t reprocess old content.
- There’s a `dryRun` toggle (default false). When true, everything runs except the final post; logs say “Dry run active, skipping reply”.
- `maxReplyRetries` (default 1) governs how many times we re-attempt posting when the API/UI path fails.

## 7. Logging & Alerts
- Every major step is logged: new mentions count, ID of each conversation, full incoming text, agent reply text/length, and post success/failure. Failures capture the exception message (e.g., `reply_composer_not_found`, `dm_inbox_failed:403:…`, `agent_reply_empty`).
- The Playwright client now traces each posting phase (API attempt, UI fallback, composer readiness, send confirmation) so PM2 logs show where time is spent.
- Known nuisance: when scraping mention history, Twitter’s bundled scripts occasionally call a function named `__name` that isn’t defined in our sandboxed evaluate context. We shim it to a no-op, but Playwright still logs a warning. Functionality is unaffected; removing the warning is on the follow-up list.

## 8. Supabase Prompt & Proof Links
- Public replies use `agent.concierge.transport.twitter_reply`; it keeps responses tweet-friendly while allowing the full 280 characters when needed.
- DMs now pull `agent.concierge.transport.twitter_dm`, which drops the old hard-coded copy and lets the concierge deliver longer, private answers without a strict cap.
- Both prompts enforce: never surface raw transaction signatures; always append the Solscan URL (one per transaction) on its own line. If the user explicitly requests proof, the agent still relies on the URL.
- Because all transport guidance now lives in Supabase, rolling back the database would revert behavior—no more code fallback.

## 9. Snapshot Helper & Manual QA
- `npm run twitter:snapshot -- --tweet <URL>` dumps the whole visible thread as JSON (handles, text, timestamps).
- `--conversation <ID>` does the same for DMs.
- These help ops verify conversations and agent replies without tailing logs or hitting the live API.

## 10. Current Status & Next Steps
- Deployed as of today (October 19, 2025). Both mentions and DMs respond with Solscan proofs and the new beta messaging. Manual smoke tests verified end-to-end behavior using the Branch wallet conversations.
- Outstanding work:
  - Silence the `__name` warning so error monitoring doesn’t get noisy.
  - Optionally add automated coverage around transcript generation (especially emoji and media alt-text cases).
  - Consider a dashboard/reporting view so you can monitor reply volume, response success rate, and time-to-reply without reading logs.

That’s the complete operational breakdown. If you want runbooks (start/stop, rerunning with `--guest`, session refresh workflow) or diagrams, I can prep those next.
