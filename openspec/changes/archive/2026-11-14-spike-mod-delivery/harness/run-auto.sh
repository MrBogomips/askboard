#!/bin/sh
# A headless probe run with the auto-answerer beside it.
# Usage: run-auto.sh <claude-binary> <run-name> <delay-ms> <interval-ms> <count> <prompt> [extra claude flags...]
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
PROBE=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe
CLAUDE_BIN=$1
RUN=$2
DELAY=$3
INTERVAL=$4
COUNT=$5
PROMPT=$6
shift 6
RUN_DIR="$SCRATCH/runs/$RUN"
rm -rf "$RUN_DIR"
mkdir -p "$RUN_DIR"
chmod 700 "$RUN_DIR"
PROBE_RUN_DIR="$RUN_DIR" bun "$PROBE/driver.ts" auto --delay "$DELAY" --interval "$INTERVAL" --count "$COUNT" --idle 120000 > "$RUN_DIR/answers.jsonl" 2> "$RUN_DIR/auto.err" &
AUTO=$!
# run-p.sh recreates the run dir, so keep the answerer's files out of its way by starting claude directly here.
export PROBE_RUN_DIR="$RUN_DIR"
cd "$SCRATCH/project"
"$SCRATCH/clean.sh" "$CLAUDE_BIN" -p "$PROMPT" \
  --plugin-dir "$PROBE" \
  --setting-sources project \
  --allowedTools "mcp__plugin_probe_probe__probe_ask,mcp__plugin_probe_probe__probe_collect,Bash(sleep:*),Agent" \
  --model claude-opus-5-5 \
  --output-format json \
  --debug-file "$RUN_DIR/debug.log" \
  "$@" > "$RUN_DIR/result.json" 2> "$RUN_DIR/stderr.txt"
echo "claude exit $?"
kill "$AUTO" 2>/dev/null
echo "answers: $(wc -l < "$RUN_DIR/answers.jsonl")"
