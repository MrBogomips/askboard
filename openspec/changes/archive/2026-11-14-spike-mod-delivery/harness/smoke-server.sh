#!/bin/sh
# Smoke test of the probe's stub server over stdio, then the driver against its local API.
set -eu
PROBE=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe
export PROBE_RUN_DIR=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad/run-smoke
export CLAUDE_CODE_SESSION_ID=smoke-session
rm -rf "$PROBE_RUN_DIR"
mkfifo /private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad/smoke-in 2>/dev/null || true
FIFO=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad/smoke-in
bun "$PROBE/server.ts" < "$FIFO" > "$PROBE_RUN_DIR.out" 2> "$PROBE_RUN_DIR.err" &
SERVER=$!
exec 3> "$FIFO"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' >&3
printf '%s\n' '{"jsonrpc":"2.0","method":"notifications/initialized"}' >&3
printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' >&3
sleep 1
printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"probe_ask","arguments":{"askId":"smoke-1","question":"q"},"_meta":{"claudecode/toolUseId":"toolu_smoke"}}}' >&3
sleep 1
bun "$PROBE/driver.ts" answer smoke-1 --text "first answer"
bun "$PROBE/driver.ts" events | head -20
printf '%s\n' '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"probe_collect","arguments":{"askId":"smoke-1","after":0}}}' >&3
sleep 1
echo "--- events after collect (expect none):"
bun "$PROBE/driver.ts" events
exec 3>&-
sleep 1
echo "--- server stdout:"
cat "$PROBE_RUN_DIR.out"
echo "--- server stderr:"
cat "$PROBE_RUN_DIR.err"
echo "--- session files left:"
ls "$PROBE_RUN_DIR/sessions"
echo "--- log kinds:"
cut -c1-200 "$PROBE_RUN_DIR/logs/server.jsonl"
kill "$SERVER" 2>/dev/null || true
