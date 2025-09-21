#!/usr/bin/env bash
set -euo pipefail

# bootstrap npm dependencies for dexter-mcp inside the Codex cloud workspace
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not installed.\nInstall Node.js >= 20 before running codex/setup.sh." >&2
  exit 1
fi

pushd "$ROOT_DIR" >/dev/null

npm install

env_file="$ROOT_DIR/.env"
if [ ! -f "$env_file" ]; then
  cat <<'NOTE'
No .env present in the workspace. Codex cloud environments normally inject secrets via the dashboard or `codex env set`.
Populate the necessary variables (Supabase keys, OAuth endpoints, etc.) before launching the server.
Reference: https://developers.openai.com/codex/cloud/environments#manual-setup
NOTE
fi

cat <<'NEXT'
Setup complete.
Run `npm start` to launch the HTTPS transport or `node server.mjs --tools=wallet` for stdio mode.
NEXT

popd >/dev/null
