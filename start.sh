#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
export PORT
STATIC_DIR="$PROJECT_DIR/dist"
export STATIC_DIR
WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:?}/omgithub-web}"
export WEB_DIR

timed() {
  printf '[timing] %s\n' "$*"
  /usr/bin/time -p "$@"
}

timed mkdir -p "$WEB_DIR"

if [[ -f package-lock.json ]]; then
  timed npm ci --no-audit --no-fund --ignore-scripts --prefer-offline
else
  timed npm install --no-audit --no-fund --ignore-scripts --prefer-offline
fi

timed node scripts/build.mjs
timed test -f "$STATIC_DIR/index.html"

timed node -e '
const fs = require("node:fs");
const path = require("node:path");
const [webDir, projectDir, outputDir] = process.argv.slice(1);
const project = path.resolve(projectDir);
const directory = path.resolve(outputDir);
if (directory !== project && !directory.startsWith(project + path.sep)) {
  throw new Error(`Build directory must stay inside the project: ${directory}`);
}
fs.mkdirSync(webDir, { recursive: true });
fs.writeFileSync(
  path.join(webDir, "deployment-output.json"),
  JSON.stringify({ project, directory })
);
console.log(`Deployment output: ${path.join(webDir, "deployment-output.json")}`);
' "$WEB_DIR" "$PROJECT_DIR" "$STATIC_DIR"

printf '[start] Serving %s on port %s (foreground)\n' "$STATIC_DIR" "$PORT"
exec /usr/bin/time -p node scripts/serve.mjs
