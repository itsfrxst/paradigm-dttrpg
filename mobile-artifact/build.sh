#!/usr/bin/env bash
# Stitches the mobile build into a single self-contained HTML file, ready to
# hand to the Artifact tool as `file_path`. Fixes the actual problem that let
# the published mobile link go stale: the old process depended on
# `artifact_top.html`/`artifact_mid.html` living in a session's scratchpad,
# which gets wiped between sessions -- those two pieces now live here in the
# repo instead (template-top.html / template-mid.html), so any future
# session can run this one command with no reconstruction step.
#
# Usage:
#   cd paradigm-dttrpg && ./mobile-artifact/build.sh
# Then publish mobile-artifact/output.html via the Artifact tool with
# `url` set to the existing artifact URL (see reference_repo_locations
# memory) so it updates in place instead of creating a new one.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building mobile target..."
npx vite build --config vite.mobile.config.js

CSS_FILE=$(ls dist-mobile/assets/mobile-*.css | head -1)
JS_FILE=$(ls dist-mobile/assets/mobile-*.js | head -1)

if [ -z "$CSS_FILE" ] || [ -z "$JS_FILE" ]; then
  echo "Could not find built CSS/JS in dist-mobile/assets/ -- did the build above succeed?" >&2
  exit 1
fi

OUT="mobile-artifact/output.html"
cat mobile-artifact/template-top.html "$CSS_FILE" mobile-artifact/template-mid.html "$JS_FILE" > "$OUT"
echo '</script>' >> "$OUT"

echo "Wrote $OUT ($(wc -c < "$OUT") bytes) from:"
echo "  CSS: $CSS_FILE"
echo "  JS:  $JS_FILE"
echo "Publish it via the Artifact tool with the existing artifact URL to update in place."
