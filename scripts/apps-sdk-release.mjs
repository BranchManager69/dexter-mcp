import { execSync } from 'node:child_process';

function safeExec(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function resolveAppsSdkRelease() {
  const explicit = String(process.env.TOKEN_AI_APPS_SDK_RELEASE || '').trim();
  if (explicit) return explicit;

  const sha = safeExec('git rev-parse --short=12 HEAD') || 'unknown';
  const dirty = safeExec('git status --porcelain') ? '-dirty' : '';
  return `dexter-apps-sdk-${sha}${dirty}`;
}
