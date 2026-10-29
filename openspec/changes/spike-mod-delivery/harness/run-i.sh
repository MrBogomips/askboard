#!/bin/sh
# Starts an interactive probe session in a detached tmux session, with a clean environment.
# Usage: run-i.sh <claude-binary> <run-name> [extra claude flags...]
# The tmux session is named after the run. Drive it with tmux send-keys; read it with tmux capture-pane.
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
PROBE=${PROBE_DIR:-/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe}
CLAUDE_BIN=$1
RUN=$2
shift 2
export PROBE_RUN_DIR="$SCRATCH/runs/$RUN"
rm -rf "$PROBE_RUN_DIR"
mkdir -p "$PROBE_RUN_DIR"
chmod 700 "$PROBE_RUN_DIR"
PROJECT=${PROBE_PROJECT:-$SCRATCH/project}
tmux kill-session -t "$RUN" 2>/dev/null
tmux new-session -d -s "$RUN" -x 160 -y 50 -c "$PROJECT" \
  env PROBE_RUN_DIR="$PROBE_RUN_DIR" PROBE_POLL_MS="${PROBE_POLL_MS:-1000}" PROBE_TRANSPORT="${PROBE_TRANSPORT:-tcp}" PROBE_MAIN_VIA="${PROBE_MAIN_VIA:-submit}" PROBE_SELF_ALLOW="${PROBE_SELF_ALLOW:-0}" PROBE_PUSH_VIA="${PROBE_PUSH_VIA:-send}" \
  "$SCRATCH/clean.sh" "$CLAUDE_BIN" \
  --plugin-dir "$PROBE" --setting-sources project \
  --allowedTools "mcp__plugin_probe_probe__probe_ask,mcp__plugin_probe_probe__probe_collect,Bash(sleep:*),Agent" \
  --model claude-opus-5-5 --debug-file "$PROBE_RUN_DIR/debug.log" ${PROBE_CC_FLAGS:-} "$@"
echo "tmux session $RUN started in $PROJECT, logs in $PROBE_RUN_DIR"
