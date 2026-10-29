#!/bin/sh
# Criterion 12 without Claude Code (container port of harness/smoke-server.sh, extended): the stub over stdio,
# its handshake, local API and session file, an answer through the driver, then its exit on stdin close and on
# SIGINT, and what each exit leaves behind (processes, session folder, sockets). No model and no token.
set -u
WORK=${WORK:-$HOME/work}
H=$(dirname "$0")
PROBE=$WORK/probe
export CLAUDE_CODE_SESSION_ID=smoke-session

INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'
INITIALIZED='{"jsonrpc":"2.0","method":"notifications/initialized"}'
LIST='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
ASK='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"probe_ask","arguments":{"askId":"smoke-1","question":"q"},"_meta":{"claudecode/toolUseId":"toolu_smoke"}}}'
COLLECT='{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"probe_collect","arguments":{"askId":"smoke-1","after":0}}}'

# Starts the stub on a FIFO and opens fd 3 on its stdin. A background job of a non-interactive shell starts
# with SIGINT ignored; --default-signal gives the stub the disposition Claude Code's child processes get.
start() {
  export PROBE_RUN_DIR=$WORK/runs/$1
  FIFO=$WORK/fifo-$1
  rm -rf "$PROBE_RUN_DIR" "$FIFO"
  mkdir -p "$PROBE_RUN_DIR"
  chmod 700 "$PROBE_RUN_DIR"
  mkfifo "$FIFO"
  env --default-signal=INT bun "$PROBE/server.ts" < "$FIFO" > "$PROBE_RUN_DIR/stdout.jsonl" 2> "$PROBE_RUN_DIR/stderr.txt" &
  STUB=$!
  exec 3> "$FIFO"
}
send() { printf '%s\n' "$1" >&3; }
# Waits up to 10 s for a fixed string in a file.
wait_for() {
  n=0
  until grep -qF -- "$2" "$1" 2> /dev/null || [ "$n" -ge 100 ]; do
    sleep 0.1
    n=$((n + 1))
  done
  grep -qF -- "$2" "$1" 2> /dev/null || echo "timeout waiting for $2 in $1"
}
# Waits up to 5 s for the stub to exit, then prints its exit status.
wait_exit() {
  n=0
  while kill -0 "$STUB" 2> /dev/null && [ "$n" -lt 50 ]; do
    sleep 0.1
    n=$((n + 1))
  done
  if kill -0 "$STUB" 2> /dev/null; then
    echo "stub $STUB still running after 5 s"
    kill -KILL "$STUB"
  else
    wait "$STUB"
    echo "stub $STUB exited, status $?"
  fi
}
files() {
  echo "  run folder: $(stat -c '%A' "$PROBE_RUN_DIR"), sessions folder: $(stat -c '%A' "$PROBE_RUN_DIR/sessions" 2> /dev/null || echo absent)"
  for f in "$PROBE_RUN_DIR"/sessions/*.json "$PROBE_RUN_DIR"/*.sock; do
    [ -e "$f" ] && echo "  $(stat -c '%A %F' "$f") ${f#"$PROBE_RUN_DIR"/}"
  done
}
log() {
  python3 -I -c '
import json, sys
for line in open(sys.argv[1]):
    r = json.loads(line)
    extra = [str(r[k]) for k in ("transport", "method", "path", "reason", "apiAddress", "rule", "nonce") if r.get(k)]
    print(" ", r["iso"], "pid", r["pid"], r["kind"], *extra)
' "$PROBE_RUN_DIR/logs/server.jsonl"
}

echo "== case 1: handshake, local API, an answer, exit on stdin close"
start smoke-stdin
send "$INIT"
wait_for "$PROBE_RUN_DIR/stdout.jsonl" '"id":1'
echo "handshake reply: $(head -1 "$PROBE_RUN_DIR/stdout.jsonl" | cut -c1-200)"
echo "after the handshake alone (AD-2: no port, no session file):"
files
send "$INITIALIZED"
send "$LIST"
wait_for "$PROBE_RUN_DIR/logs/server.jsonl" '"kind":"api-start"'
echo "after tools/list:"
files
echo "session file, token left out:"
bun "$PROBE/driver.ts" sessions
echo "stub process: $(ps -o pid=,ppid=,args= -p "$STUB")"
send "$ASK"
wait_for "$PROBE_RUN_DIR/stdout.jsonl" '"id":3'
bun "$PROBE/driver.ts" answer smoke-1 --text "first answer" | grep -E '"(seq|nonce)"'
echo "events before collect: $(bun "$PROBE/driver.ts" events | grep -c '"nonce"')"
send "$COLLECT"
wait_for "$PROBE_RUN_DIR/stdout.jsonl" '"id":4'
echo "events after collect (expect 0): $(bun "$PROBE/driver.ts" events | grep -c '"nonce"')"
exec 3>&-
wait_exit
echo "server log:"
log
sh "$H/leftovers.sh" "$PROBE_RUN_DIR"
rm -f "$FIFO"

echo "== case 2: exit on SIGINT, stdin still open"
start smoke-sigint
send "$INIT"
send "$INITIALIZED"
send "$LIST"
wait_for "$PROBE_RUN_DIR/logs/server.jsonl" '"kind":"api-start"'
echo "before SIGINT:"
files
kill -INT "$STUB"
wait_exit
exec 3>&-
echo "server log:"
log
sh "$H/leftovers.sh" "$PROBE_RUN_DIR"
rm -f "$FIFO"
