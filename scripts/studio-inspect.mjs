#!/usr/bin/env node
/**
 * Dexter Studio Inspect CLI
 * 
 * View full details of a Studio job including event timeline.
 * 
 * Usage:
 *   node scripts/studio-inspect.mjs <job_id>
 *   node scripts/studio-inspect.mjs <job_id> --events
 *   node scripts/studio-inspect.mjs <job_id> --json
 */

import { getJob, listJobs } from '../toolsets/studio/lib/agentRunner.mjs';

const args = process.argv.slice(2);
const jobId = args.find(a => !a.startsWith('--'));
const showEvents = args.includes('--events');
const jsonOutput = args.includes('--json');

function formatTimestamp(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString();
}

async function main() {
  if (!jobId) {
    // List all jobs
    const jobs = listJobs();
    
    if (jsonOutput) {
      console.log(JSON.stringify(jobs, null, 2));
      return;
    }
    
    console.log('\n=== All Studio Jobs ===\n');
    
    if (jobs.length === 0) {
      console.log('No jobs found.');
      console.log('\nUsage: node scripts/studio-inspect.mjs <job_id>');
      return;
    }
    
    for (const job of jobs) {
      const statusEmoji = {
        pending: '⏳',
        running: '🔄',
        completed: '✅',
        failed: '❌',
        cancelled: '🚫',
      }[job.status] || '❓';
      
      console.log(`${statusEmoji} [${job.id}] ${job.status.toUpperCase()}`);
      console.log(`   Task: ${job.task.slice(0, 70)}${job.task.length > 70 ? '...' : ''}`);
      console.log(`   Step: ${job.current_step}`);
      console.log(`   Turns: ${job.turns} | Model: ${job.model}`);
      console.log(`   Started: ${job.started_at}`);
      if (job.ended_at) {
        console.log(`   Ended: ${job.ended_at}`);
      }
      console.log();
    }
    
    console.log('Use: node scripts/studio-inspect.mjs <job_id> --events');
    return;
  }
  
  // Get specific job
  const job = getJob(jobId);
  
  if (!job) {
    console.error(`Job not found: ${jobId}`);
    process.exit(1);
  }
  
  if (jsonOutput) {
    console.log(JSON.stringify(job, null, 2));
    return;
  }
  
  // Pretty print job
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log(`║ Job: ${job.id.padEnd(58)} ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  
  const statusEmoji = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
    cancelled: '🚫',
  }[job.status] || '❓';
  
  console.log(`║ Status: ${statusEmoji} ${job.status.toUpperCase().padEnd(53)} ║`);
  console.log(`║ Model: ${job.model.padEnd(57)} ║`);
  console.log(`║ Turns: ${String(job.turns).padEnd(57)} ║`);
  console.log('╟──────────────────────────────────────────────────────────────────╢');
  console.log('║ Task:                                                            ║');
  
  // Word wrap task
  const taskLines = job.task.match(/.{1,64}/g) || [job.task];
  for (const line of taskLines.slice(0, 3)) {
    console.log(`║   ${line.padEnd(63)} ║`);
  }
  if (taskLines.length > 3) {
    console.log('║   ...                                                            ║');
  }
  
  console.log('╟──────────────────────────────────────────────────────────────────╢');
  console.log(`║ Current Step: ${job.current_step.slice(0, 50).padEnd(50)} ║`);
  console.log('╟──────────────────────────────────────────────────────────────────╢');
  console.log(`║ Started: ${job.started_at.padEnd(55)} ║`);
  if (job.ended_at) {
    console.log(`║ Ended:   ${job.ended_at.padEnd(55)} ║`);
  }
  
  if (job.result) {
    console.log('╟──────────────────────────────────────────────────────────────────╢');
    console.log('║ Result:                                                          ║');
    const resultLines = job.result.match(/.{1,64}/g) || [job.result];
    for (const line of resultLines.slice(0, 10)) {
      console.log(`║   ${line.padEnd(63)} ║`);
    }
    if (resultLines.length > 10) {
      console.log('║   ...                                                            ║');
    }
  }
  
  if (job.error) {
    console.log('╟──────────────────────────────────────────────────────────────────╢');
    console.log('║ Error:                                                           ║');
    console.log(`║   ${job.error.slice(0, 63).padEnd(63)} ║`);
  }
  
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  // Event timeline
  if (showEvents && job.events.length > 0) {
    console.log('\n=== Event Timeline ===\n');
    
    for (const event of job.events) {
      const time = formatTimestamp(event.ts);
      const typeEmoji = {
        start: '🚀',
        assistant: '💬',
        tool_use: '🔧',
        result: '📤',
        complete: '✅',
        error: '❌',
        cancel: '🚫',
      }[event.type] || '•';
      
      console.log(`[${time}] ${typeEmoji} ${event.type.toUpperCase()}`);
      
      if (event.tool) {
        console.log(`         Tool: ${event.tool}`);
      }
      
      if (event.content) {
        const preview = event.content.slice(0, 100);
        console.log(`         ${preview}${event.content.length > 100 ? '...' : ''}`);
      }
      
      console.log();
    }
  } else if (job.events.length > 0) {
    console.log(`\n${job.events.length} events captured. Use --events to view timeline.`);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
