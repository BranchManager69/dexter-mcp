#!/usr/bin/env node
// Delegates pumpstream regression runs to the shared harness in dexter-agents.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const harnessPath = path.resolve(__dirname, '../../dexter-agents/scripts/run-pumpstream-harness.js');

if (!fs.existsSync(harnessPath)) {
  console.error('Unable to locate shared pumpstream harness at', harnessPath);
  process.exit(1);
}

const child = spawn('node', [harnessPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
