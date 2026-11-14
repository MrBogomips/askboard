#!/bin/sh
# One headless probe run. Usage: run-p.sh <claude-binary> <run-name> <prompt> [extra claude flags...]
# Each run gets its own PROBE_RUN_DIR under runs/<run-name>; the transcript JSON and debug log go there too.
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
PROBE=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe
CLAUDE_BIN=$1
RUN=$2
PROMPT=$3
shift 3
export PROBE_RUN_DIR="$SCRATCH/runs/$RUN"
rm -rf "$PROBE_RUN_DIR"
mkdir -p "$PROBE_RUN_DIR"
chmod 700 "$PROBE_RUN_DIR"
cd "$SCRATCH/project"
"$CLAUDE_BIN" -p "$PROMPT" \
  --plugin-dir "$PROBE" \
  --setting-sources project \
  --allowedTools "mcp__plugin_probe_probe__probe_ask,mcp__plugin_probe_probe__probe_collect,mcp__probe__probe_ask,mcp__probe__probe_collect,Bash(sleep:*)" \
  --model claude-opus-5-5 \
  --output-format json \
  --debug-file "$PROBE_RUN_DIR/debug.log" \
  "$@" > "$PROBE_RUN_DIR/result.json" 2> "$PROBE_RUN_DIR/stderr.txt"
echo "exit $? in $PROBE_RUN_DIR"
