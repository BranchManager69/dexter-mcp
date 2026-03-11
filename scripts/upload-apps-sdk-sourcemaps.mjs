#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveAppsSdkRelease } from './apps-sdk-release.mjs';

const ASSET_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../public/apps-sdk/assets');
const RELEASE = resolveAppsSdkRelease();
const ORG = process.env.SENTRY_ORG || 'dexter-ai';
const PROJECT = process.env.SENTRY_PROJECT || 'dexter-fe';

function hasSourceMaps() {
  if (!existsSync(ASSET_DIR)) return false;
  return readdirSync(ASSET_DIR).some((file) => file.endsWith('.map'));
}

function run(command) {
  return execSync(command, { stdio: 'inherit', encoding: 'utf8' });
}

if (!hasSourceMaps()) {
  console.log('[apps-sdk:sentry] No widget sourcemaps found, skipping upload.');
  process.exit(0);
}

console.log(`[apps-sdk:sentry] Uploading widget sourcemaps for release ${RELEASE}`);

try {
run(`sentry-cli releases new -o "${ORG}" -p "${PROJECT}" "${RELEASE}"`);
} catch {
  console.log('[apps-sdk:sentry] Release already exists or could not be created cleanly, continuing.');
}

run(`sentry-cli sourcemaps upload -o "${ORG}" -p "${PROJECT}" -r "${RELEASE}" "${ASSET_DIR}" --url-prefix "~/mcp/app-assets/assets" --validate --wait`);
run(`sentry-cli releases finalize -o "${ORG}" -p "${PROJECT}" "${RELEASE}"`);

console.log('[apps-sdk:sentry] Sourcemap upload complete.');
