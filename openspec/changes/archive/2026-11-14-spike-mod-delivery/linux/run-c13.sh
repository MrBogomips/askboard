#!/bin/sh
# Criterion 13, headless part: session IDs across a first run, --continue and --resume <id>
# (container port of harness/run-c13.sh). Usage: run-c13.sh <claude-binary> <run-name>
set -u
WORK=${WORK:-$HOME/work}
H=$(dirname "$0")
PROBE=$WORK/probe
CLAUDE_BIN=$1
RUN=$2
export PROBE_RUN_DIR="$WORK/runs/$RUN"
PROJECT="$WORK/project-$RUN"
rm -rf "$PROBE_RUN_DIR" "$PROJECT"
mkdir -p "$PROBE_RUN_DIR" "$PROJECT"
chmod 700 "$PROBE_RUN_DIR"
cd "$PROJECT"
git init -q -b main
printf 'c13\n' > README.md
git add README.md
git -c user.name=probe -c user.email=probe@example.invalid commit -q -m "chore: c13 project"
session_of() {
  python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['session_id'])" "$1" 2> /dev/null || echo "(no result)"
}
run() {
  step=$1
  shift
  sh "$H/clean.sh" "$CLAUDE_BIN" -p "Call probe_ask with askId c13-$step and question '$step', then reply done." \
    --plugin-dir "$PROBE" --setting-sources project \
    --allowedTools "mcp__plugin_probe_probe__probe_ask" \
    --model claude-opus-5-5 --output-format json --max-turns 4 \
    --debug-file "$PROBE_RUN_DIR/debug-$step.log" "$@" > "$PROBE_RUN_DIR/result-$step.json" 2> "$PROBE_RUN_DIR/stderr-$step.txt"
  echo "$step exit $? session $(session_of "$PROBE_RUN_DIR/result-$step.json")"
}
run first
FIRST=$(session_of "$PROBE_RUN_DIR/result-first.json")
run continue --continue
run resume --resume "$FIRST"
run fork --resume "$FIRST" --fork-session
