#!/usr/bin/env node
/**
 * Deploy Apps SDK assets to production serving path.
 * 
 * The nginx config serves /mcp/app-assets/ from dexter-fe, not dexter-mcp.
 * This script syncs built assets to the correct location after each build.
 * 
 * Called automatically by `npm run build:apps-sdk`.
 * 
 * Production flow:
 *   1. vite build → public/apps-sdk/ (local build output)
 *   2. this script → dexter-fe/public/mcp/app-assets/ (nginx-served path)
 *   3. ChatGPT fetches widget HTML via MCP resources/read
 *   4. Widget JS/CSS loaded from https://dexter.cash/mcp/app-assets/
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';

const SOURCE = path.resolve(new URL('.', import.meta.url).pathname, '../public/apps-sdk');
const TARGET = '/home/branchmanager/websites/dexter-fe/public/mcp/app-assets';

function main() {
  console.log('\n🚀 Deploying Apps SDK assets...\n');

  // Validate source exists and has content
  if (!existsSync(SOURCE)) {
    console.error(`❌ Source directory not found: ${SOURCE}`);
    console.error('   Run "npm run build:apps-sdk" first.');
    process.exit(1);
  }

  const sourceFiles = readdirSync(SOURCE);
  if (sourceFiles.length === 0) {
    console.error(`❌ Source directory is empty: ${SOURCE}`);
    process.exit(1);
  }

  // Validate target parent exists
  const targetParent = path.dirname(TARGET);
  if (!existsSync(targetParent)) {
    console.error(`❌ Target parent directory not found: ${targetParent}`);
    console.error('   Is dexter-fe checked out at the expected location?');
    process.exit(1);
  }

  // Get pre-deploy state for comparison
  const preDeployAssets = existsSync(path.join(TARGET, 'assets')) 
    ? new Set(readdirSync(path.join(TARGET, 'assets')))
    : new Set();

  // Sync with rsync (--delete removes stale files)
  try {
    const output = execSync(
      `rsync -av --delete "${SOURCE}/" "${TARGET}/"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Parse rsync output for summary
    const lines = output.trim().split('\n');
    const transferred = lines.filter(l => 
      !l.startsWith('sending') && 
      !l.startsWith('total') && 
      !l.startsWith('./') &&
      !l.endsWith('/')
    );

    const added = transferred.filter(l => !l.startsWith('deleting'));
    const deleted = transferred.filter(l => l.startsWith('deleting'));

    console.log(`📁 Source:  ${SOURCE}`);
    console.log(`📁 Target:  ${TARGET}`);
    console.log('');

    if (added.length > 0 || deleted.length > 0) {
      if (added.length > 0) {
        console.log(`   ✅ ${added.length} file(s) added/updated`);
      }
      if (deleted.length > 0) {
        console.log(`   🗑️  ${deleted.length} stale file(s) removed`);
      }
    } else {
      console.log('   ℹ️  No changes (already in sync)');
    }

    // Show asset count
    const postDeployAssets = existsSync(path.join(TARGET, 'assets'))
      ? readdirSync(path.join(TARGET, 'assets'))
      : [];
    const htmlFiles = readdirSync(TARGET).filter(f => f.endsWith('.html'));
    
    console.log('');
    console.log(`   📄 ${htmlFiles.length} widget HTML files`);
    console.log(`   📦 ${postDeployAssets.length} JS/CSS assets`);
    console.log('');
    console.log('✅ Deploy complete!\n');

  } catch (err) {
    console.error('❌ rsync failed:', err.message);
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

main();
