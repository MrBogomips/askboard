#!/bin/sh
# D6, interrupt then push: the main conversation asks and sleeps, Esc at ask+10 s, answers at ask+15 s and ask+40 s,
# then the user's next input at about ask+62 s. Records each answer's fate.
# Usage: d-esc.sh <claude-binary> <run-name> [probe-dir]
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
RUN=$2
export PROBE_DIR="${3:-$SCRATCH/probe-p1}" PROBE_MAIN_VIA=hybrid PROBE_PUSH_VIA=append PROBE_CC_FLAGS="--permission-mode auto"
DRIVER=$PROBE_DIR/driver.ts
R="$SCRATCH/runs/$RUN"
OUT="$R/esc.txt"
snap() { echo "=== $1 ($(date +%T))" >> "$OUT"; tmux capture-pane -p -t "$RUN" | grep -v '^\s*$' | tail -14 >> "$OUT"; }
sh "$SCRATCH/run-i.sh" "$1" "$RUN"
PROBE_RUN_DIR="$R" bun "$DRIVER" auto --delay 15000 --interval 25000 --count 2 --idle 600000 > "$R/answers.jsonl" 2> "$R/auto.err" &
AUTO=$!
sleep 8
tmux send-keys -t "$RUN" -l "Call probe_ask with askId esc-main and question 'main, interrupted'. Then run these Bash steps one at a time, in the foreground: sleep 24, sleep 24. If a message with a nonce (N- and 8 hexadecimal characters) arrives at any time, reply with one line per nonce: GOT and the nonce."
tmux send-keys -t "$RUN" Enter
sh "$SCRATCH/wait-for.sh" "$R/logs/server.jsonl" '"kind":"tools/call","tool":"probe_ask"' 120 >> "$OUT"
echo "ask seen ($(date +%T))" >> "$OUT"
sleep 10
tmux send-keys -t "$RUN" Escape
echo "Esc sent ($(date +%T))" >> "$OUT"
sleep 2
snap "2 s after Esc"
sleep 35
snap "ask+47 s, after both answers"
sleep 15
snap "ask+62 s, before the user's next input"
tmux send-keys -t "$RUN" -l "Did any message with a nonce reach you? Reply with one line per nonce: GOT and the nonce, or NONE."
tmux send-keys -t "$RUN" Enter
echo "user input sent ($(date +%T))" >> "$OUT"
sleep 30
snap "30 s after the user's input"
tmux capture-pane -p -S -200 -t "$RUN" > "$R/screen.txt"
tmux kill-session -t "$RUN"
kill "$AUTO" 2>/dev/null
echo "== answers"; cat "$R/answers.jsonl" | sed -E 's/.*"seq":([0-9]+).*"nonce":"([^"]*)".*"t0":([0-9]+).*/seq \1 \2 t0 \3/'
echo "== mod"; grep -h 'turn\.\|submit\|catch-up\|skip' "$R/logs/mod.jsonl" | sed -E 's/.*"iso":"([^"]*)".*"kind":"([^"]*)"(.*)/\1 \2 \3/' | cut -c1-160
echo "== deliveries"; grep -h '"kind":"delivered"' "$R/logs/server.jsonl" | cut -c1-220
cat "$OUT"
