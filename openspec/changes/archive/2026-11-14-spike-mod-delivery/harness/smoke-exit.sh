#!/bin/sh
# Does the stub exit, log "exit" and remove its session file when stdin closes?
PROBE=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe
export PROBE_RUN_DIR=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad/run-smoke2
export CLAUDE_CODE_SESSION_ID=smoke2
rm -rf "$PROBE_RUN_DIR"
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | bun "$PROBE/server.ts" > /dev/null &
PID=$!
sleep 3
if kill -0 "$PID" 2>/dev/null; then echo "still running after stdin closed"; kill "$PID"; sleep 1; else echo "exited by itself"; fi
grep -c '"kind":"exit"' "$PROBE_RUN_DIR/logs/server.jsonl"
grep '"kind":"exit"' "$PROBE_RUN_DIR/logs/server.jsonl"
echo "session files left: $(ls -A "$PROBE_RUN_DIR/sessions" | wc -l)"
