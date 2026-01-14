/**
 * Dexter Studio - Job Summarizer
 * 
 * Uses GPT-5.2-Codex (via Codex CLI) to generate structured summaries
 * of completed Studio jobs.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const SUMMARIZE_PROMPT = `You are summarizing a coding task completed by an AI agent.

TASK:
{task}

EVENTS (what the agent did):
{events}

RESULT:
{result}

Output ONLY valid JSON with this exact structure (no markdown, no explanation, just JSON):
{
  "title": "Short descriptive title (max 50 chars)",
  "summary": "1-2 sentence summary of what was accomplished",
  "steps_taken": ["Step 1 description", "Step 2 description", "..."],
  "changes": [
    {"file": "path/to/file", "action": "created|modified|read|deleted", "what": "brief description of change"}
  ],
  "outcome": "success|partial|failed",
  "outcome_detail": "Brief explanation of the outcome"
}`;

/**
 * Summarize a completed job using GPT-5.2-Codex
 */
export async function summarizeJob(job) {
  if (!job || !job.events) {
    console.log('[summarizer] No job or events to summarize');
    return null;
  }
  
  // Build the prompt
  const eventsStr = formatEvents(job.events);
  const prompt = SUMMARIZE_PROMPT
    .replace('{task}', job.task || 'Unknown task')
    .replace('{events}', eventsStr)
    .replace('{result}', job.result || job.error || 'No result captured');
  
  console.log(`[summarizer] Summarizing job ${job.id} with GPT-5.2-Codex...`);
  
  try {
    // Call codex exec with the prompt
    // Escape the prompt for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    
    const { stdout, stderr } = await execAsync(
      `codex exec -m gpt-5.2-codex '${escapedPrompt}'`,
      { 
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        cwd: '/home/branchmanager/websites/dexter-mcp'
      }
    );
    
    // Parse the output - codex exec outputs the response at the end
    const jsonMatch = stdout.match(/\{[\s\S]*"title"[\s\S]*"outcome"[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[summarizer] Could not find JSON in output:', stdout.slice(-500));
      return null;
    }
    
    const summary = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!summary.title || !summary.outcome) {
      console.error('[summarizer] Invalid summary structure:', summary);
      return null;
    }
    
    console.log(`[summarizer] Generated summary: "${summary.title}"`);
    
    return {
      ai_title: summary.title?.slice(0, 100),
      ai_summary: summary.summary?.slice(0, 2000),
      ai_steps_taken: summary.steps_taken || [],
      ai_changes: summary.changes || [],
      ai_outcome: summary.outcome,
      ai_outcome_detail: summary.outcome_detail?.slice(0, 2000),
      ai_summarized_at: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('[summarizer] Error:', error.message);
    
    // If codex exec fails, try to return a basic summary from the job data
    return {
      ai_title: `Job ${job.id}`,
      ai_summary: job.result?.slice(0, 200) || 'Job completed',
      ai_steps_taken: [],
      ai_changes: [],
      ai_outcome: job.status === 'completed' ? 'success' : 'failed',
      ai_outcome_detail: error.message,
      ai_summarized_at: new Date().toISOString(),
    };
  }
}

/**
 * Format events array for the prompt
 */
function formatEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return 'No events recorded';
  }
  
  // Limit to last 50 events to avoid token limits
  const recentEvents = events.slice(-50);
  
  return recentEvents.map((event, i) => {
    const ts = event.ts ? new Date(event.ts).toISOString().slice(11, 19) : '';
    const type = event.type || 'unknown';
    const content = event.content?.slice(0, 200) || '';
    const tool = event.tool ? ` [${event.tool}]` : '';
    
    return `${i + 1}. [${ts}] ${type}${tool}: ${content}`;
  }).join('\n');
}

export default { summarizeJob };
