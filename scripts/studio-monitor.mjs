#!/usr/bin/env node
/**
 * Studio Job Monitor
 * 
 * Watch studio jobs in real-time. Shows full reasoning, tool calls, everything.
 * 
 * Usage:
 *   node scripts/studio-monitor.mjs              # Watch for new jobs
 *   node scripts/studio-monitor.mjs <job_id>    # Inspect specific job
 *   node scripts/studio-monitor.mjs --latest    # Show latest job details
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(`${c.red}Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY${c.reset}`);
    process.exit(1);
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function divider(char = '─') {
  console.log(c.gray + char.repeat(70) + c.reset);
}

function formatEvent(event, index) {
  const ts = event.ts ? new Date(event.ts).toISOString().slice(11, 19) : '??:??:??';
  const type = event.type || 'unknown';
  
  let icon = '•';
  let color = c.gray;
  
  switch (type) {
    case 'assistant':
      icon = '🧠';
      color = c.cyan;
      break;
    case 'tool_use':
      icon = '🔧';
      color = c.yellow;
      break;
    case 'tool_result':
      icon = '✓';
      color = c.green;
      break;
    case 'error':
      icon = '❌';
      color = c.red;
      break;
  }
  
  const tool = event.tool ? ` [${event.tool}]` : '';
  const content = event.content || '';
  
  // Wrap long content
  const maxLen = 100;
  const preview = content.length > maxLen ? content.slice(0, maxLen) + '...' : content;
  
  console.log(`${c.gray}[${ts}]${c.reset} ${icon} ${color}${type}${tool}${c.reset}`);
  if (content) {
    // Show full content for reasoning, truncate for tool results
    if (type === 'assistant' && content.length > 200) {
      console.log(`${c.dim}    ${content.slice(0, 500)}${content.length > 500 ? '...' : ''}${c.reset}`);
    } else {
      console.log(`${c.dim}    ${preview}${c.reset}`);
    }
  }
}

async function inspectJob(jobId) {
  const sb = getSupabase();
  
  const { data: job, error } = await sb
    .from('studio_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error || !job) {
    console.error(`${c.red}Job not found: ${jobId}${c.reset}`);
    return;
  }
  
  console.log();
  divider('═');
  console.log(`${c.cyan}${c.bold} STUDIO JOB: ${job.id} ${c.reset}`);
  divider('═');
  console.log();
  
  console.log(`${c.white}Status:${c.reset} ${job.status === 'completed' ? c.green : job.status === 'failed' ? c.red : c.yellow}${job.status}${c.reset}`);
  console.log(`${c.white}Task:${c.reset} ${job.task}`);
  console.log(`${c.white}Model:${c.reset} ${job.model}`);
  console.log(`${c.white}Turns:${c.reset} ${job.turns}`);
  console.log(`${c.white}Started:${c.reset} ${job.started_at}`);
  if (job.ended_at) console.log(`${c.white}Ended:${c.reset} ${job.ended_at}`);
  
  if (job.ai_title) {
    console.log();
    console.log(`${c.magenta}${c.bold}AI Summary:${c.reset} ${job.ai_title}`);
    if (job.ai_summary) console.log(`${c.dim}${job.ai_summary}${c.reset}`);
    if (job.ai_outcome) console.log(`${c.white}Outcome:${c.reset} ${job.ai_outcome}`);
  }
  
  console.log();
  divider();
  console.log(`${c.bold}EVENT TIMELINE (${(job.events || []).length} events):${c.reset}`);
  divider();
  
  const events = job.events || [];
  for (let i = 0; i < events.length; i++) {
    formatEvent(events[i], i);
  }
  
  if (job.result) {
    console.log();
    divider();
    console.log(`${c.bold}FINAL RESULT:${c.reset}`);
    console.log(job.result.slice(0, 1000));
  }
  
  if (job.error) {
    console.log();
    divider();
    console.log(`${c.red}${c.bold}ERROR:${c.reset}`);
    console.log(c.red + job.error + c.reset);
  }
  
  console.log();
  divider('═');
}

async function showLatest() {
  const sb = getSupabase();
  
  const { data: jobs, error } = await sb
    .from('studio_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error || !jobs?.length) {
    console.error(`${c.red}No jobs found${c.reset}`);
    return;
  }
  
  await inspectJob(jobs[0].id);
}

async function watchJobs() {
  const sb = getSupabase();
  let lastSeenId = null;
  let lastEventCount = 0;
  
  console.log();
  divider('═');
  console.log(`${c.cyan}${c.bold} STUDIO MONITOR ${c.reset} - Watching for jobs...`);
  divider('═');
  console.log(`${c.dim}Press Ctrl+C to stop${c.reset}`);
  console.log();
  
  const poll = async () => {
    const { data: jobs } = await sb
      .from('studio_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!jobs?.length) return;
    
    const job = jobs[0];
    const events = job.events || [];
    
    // New job detected
    if (job.id !== lastSeenId) {
      lastSeenId = job.id;
      lastEventCount = 0;
      console.log();
      divider();
      console.log(`${c.green}${c.bold}NEW JOB:${c.reset} ${job.id}`);
      console.log(`${c.white}Task:${c.reset} ${job.task}`);
      divider();
    }
    
    // New events
    if (events.length > lastEventCount) {
      for (let i = lastEventCount; i < events.length; i++) {
        formatEvent(events[i], i);
      }
      lastEventCount = events.length;
    }
    
    // Job completed
    if (job.status === 'completed' || job.status === 'failed') {
      if (job.ai_title) {
        console.log();
        console.log(`${c.magenta}${c.bold}Summary:${c.reset} ${job.ai_title}`);
      }
      console.log(`${c.bold}Status:${c.reset} ${job.status === 'completed' ? c.green : c.red}${job.status}${c.reset}`);
      divider();
      // Reset to watch for next job
      lastSeenId = job.id;
    }
  };
  
  // Poll every 500ms
  setInterval(poll, 500);
  await poll();
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--latest' || args[0] === '-l') {
    await showLatest();
  } else if (args[0] && !args[0].startsWith('-')) {
    await inspectJob(args[0]);
  } else {
    await watchJobs();
  }
}

main().catch(console.error);
