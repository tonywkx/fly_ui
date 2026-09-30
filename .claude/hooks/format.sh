#!/bin/bash
# Silent auto-format of the edited file. Never blocks, never prints: zero token cost.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  *.ts|*.tsx|*.js|*.mjs|*.json|*.css) ;;
  *) exit 0 ;;
esac
cd "$CLAUDE_PROJECT_DIR" && ./node_modules/.bin/biome check --write --no-errors-on-unmatched "$f" >/dev/null 2>&1
exit 0
