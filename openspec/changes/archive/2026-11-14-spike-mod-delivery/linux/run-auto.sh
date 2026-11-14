#!/bin/sh
# A headless probe run with the auto-answerer beside it (container port of harness/run-auto.sh).
# Usage: run-auto.sh <claude-binary> <run-name> <delay-ms> <interval-ms> <count> <prompt> [extra claude flags...]
set -u
WORK=${WORK:-$HOME/work}
H=$(dirname "$0")
PROBE=$WORK/probe
CLAUDE_BIN=$1
RUN=$2
DELAY=$3
INTERVAL=$4
COUNT=$5
PROMPT=$6
shift 6
RUN_DIR="$WORK/runs/$RUN"
rm -rf "$RUN_DIR"
mkdir -p "$RUN_DIR"
chmod 700 "$RUN_DIR"
# The answerer needs no credentials, so it runs without the token.
PROBE_RUN_DIR="$RUN_DIR" env -u CLAUDE_CODE_OAUTH_TOKEN bun "$PROBE/driver.ts" auto --delay "$DELAY" --interval "$INTERVAL" --count "$COUNT" --idle 120000 > "$RUN_DIR/answers.jsonl" 2> "$RUN_DIR/auto.err" &
AUTO=$!
export PROBE_RUN_DIR="$RUN_DIR"
cd "$WORK/project"
sh "$H/clean.sh" "$CLAUDE_BIN" -p "$PROMPT" \
  --plugin-dir "$PROBE" \
  --setting-sources project \
  --allowedTools "mcp__plugin_probe_probe__probe_ask,mcp__plugin_probe_probe__probe_collect,Bash(sleep:*),Agent" \
  --model claude-opus-5-5 \
  --output-format json \
  --debug-file "$RUN_DIR/debug.log" \
  "$@" > "$RUN_DIR/result.json" 2> "$RUN_DIR/stderr.txt"
echo "claude exit $?"
kill "$AUTO" 2> /dev/null
echo "answers: $(wc -l < "$RUN_DIR/answers.jsonl")"
