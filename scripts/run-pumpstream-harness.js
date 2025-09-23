#!/usr/bin/env node
// Delegates pumpstream regression runs to the shared harness in dexter-agents.

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const harnessCwd = path.resolve(__dirname, '../../dexter-agents');

const child = spawn('npm', ['run', '-s', 'pumpstream:harness', '--', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: harnessCwd,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
