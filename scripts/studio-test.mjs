#!/usr/bin/env node
/**
 * Dexter Studio Test CLI
 * 
 * Test the Studio agent directly without MCP/Telegram.
 * 
 * Usage:
 *   node scripts/studio-test.mjs "Your task here"
 *   node scripts/studio-test.mjs --task "Your task here" --model sonnet
 */

import { startJob, getJob, listJobs } from '../toolsets/studio/lib/agentRunner.mjs';

const args = process.argv.slice(2);

function parseArgs() {
  const result = { task: '', model: 'sonnet' };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) {
      result.task = args[i + 1];
      i++;
    } else if (args[i] === '--model' && args[i + 1]) {
      result.model = args[i + 1];
      i++;
    } else if (args[i] === '--list') {
      result.list = true;
    } else if (args[i] === '--status' && args[i + 1]) {
      result.status = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      result.task = args[i];
    }
  }
  
  return result;
}

async function main() {
  const opts = parseArgs();
  
  // List jobs mode
  if (opts.list) {
    const jobs = await listJobs();
    console.log('\n=== Studio Jobs ===\n');
    if (jobs.length === 0) {
      console.log('No jobs found.');
    } else {
      for (const job of jobs) {
        console.log(`[${job.id}] ${job.status.toUpperCase()}`);
        console.log(`  Task: ${job.task.slice(0, 60)}${job.task.length > 60 ? '...' : ''}`);
        console.log(`  Turns: ${job.turns} | Started: ${job.started_at}`);
        console.log();
      }
    }
    return;
  }
  
  // Status mode
  if (opts.status) {
    const job = await getJob(opts.status);
    if (!job) {
      console.error(`Job not found: ${opts.status}`);
      process.exit(1);
    }
    console.log('\n=== Job Details ===\n');
    console.log(JSON.stringify(job, null, 2));
    return;
  }
  
  // Create job mode
  if (!opts.task) {
    console.log(`
Dexter Studio Test CLI

Usage:
  node scripts/studio-test.mjs "Your task here"
  node scripts/studio-test.mjs --task "Your task" --model sonnet
  node scripts/studio-test.mjs --list
  node scripts/studio-test.mjs --status <job_id>

Models: haiku, sonnet (default), opus
`);
    process.exit(1);
  }
  
  console.log('\n=== Starting Studio Job ===\n');
  console.log(`Task: ${opts.task}`);
  console.log(`Model: ${opts.model}`);
  console.log();
  
  const jobId = await startJob(opts.task, { model: opts.model });
  console.log(`Job ID: ${jobId}`);
  console.log();
  
  // Poll for status
  console.log('=== Monitoring Progress ===\n');
  
  let lastStep = '';
  let lastTurns = 0;
  
  while (true) {
    const job = await getJob(jobId);
    if (!job) {
      console.log('Job disappeared!');
      break;
    }
    
    // Print updates
    if (job.current_step !== lastStep || job.turns !== lastTurns) {
      const elapsed = Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000);
      console.log(`[${elapsed}s] Turn ${job.turns}: ${job.current_step}`);
      lastStep = job.current_step;
      lastTurns = job.turns;
    }
    
    // Check for completion
    if (job.status === 'completed') {
      console.log('\n=== Job Completed ===\n');
      console.log('Result:');
      console.log(job.result);
      break;
    }
    
    if (job.status === 'failed') {
      console.log('\n=== Job Failed ===\n');
      console.log('Error:', job.error);
      break;
    }
    
    if (job.status === 'cancelled') {
      console.log('\n=== Job Cancelled ===\n');
      break;
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Show event summary
  const finalJob = await getJob(jobId);
  if (finalJob) {
    console.log(`\nTotal turns: ${finalJob.turns}`);
    console.log(`Events captured: ${finalJob.events?.length || 0}`);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
