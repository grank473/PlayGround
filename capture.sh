#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the source tree.}"
: "${RUNTIME_DIR:?Set RUNTIME_DIR to the project runtime directory.}"

timed() {
  printf '[timing] %s\n' "$*"
  /usr/bin/time -p "$@"
}

timed mkdir -p "$CAPTURE_DIR"
CAPTURE_REAL="$(cd "$CAPTURE_DIR" && pwd -P)"
case "$CAPTURE_REAL/" in
  "$PROJECT_DIR"/*)
    printf 'CAPTURE_DIR must be outside the project source: %s\n' "$CAPTURE_REAL" >&2
    exit 1
    ;;
esac

timed test -f "$RUNTIME_DIR/scripts/default-capture.mjs"
timed rm -f "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"

export CAPTURE_URL CAPTURE_DIR
printf '[capture] URL: %s\n[capture] Output: %s\n' "$CAPTURE_URL" "$CAPTURE_DIR"
timed node "$RUNTIME_DIR/scripts/default-capture.mjs"

timed test -s "$CAPTURE_DIR/final-desktop.png"
timed test -s "$CAPTURE_DIR/final-mobile.png"
printf '[capture] Wrote %s and %s\n' \
  "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"
