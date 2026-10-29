#!/bin/sh
# Criterion 7, subagent half: a background subagent that provably outlives an answer given 31 minutes after the ask.
# Claude Code refuses a standalone `sleep` of 25 s or more (threshold 25 in 2.1.312), so each step chains four 24 s sleeps.
# Usage: c7b.sh <claude-binary> <run-name>
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
DRIVER=$SCRATCH/probe-p1/driver.ts
RUN=$2
R="$SCRATCH/runs/$RUN"
export PROBE_DIR="$SCRATCH/probe-p1" PROBE_MAIN_VIA=hybrid PROBE_PUSH_VIA=append PROBE_CC_FLAGS="--permission-mode auto"
snap() { echo "=== screen: $1 ($(date +%T))" >> "$R/c7.txt"; tmux capture-pane -p -t "$RUN" | grep -v '^\s*$' | tail -25 >> "$R/c7.txt"; }
sh "$SCRATCH/run-i.sh" "$1" "$RUN"
sleep 8
tmux send-keys -t "$RUN" -l "Call probe_ask with askId c7-main and question 'main, 31 minutes'. Then start the probe-worker agent in the background (run_in_background: true) with this task: askId c7-bg, question 'background, 31 minutes', steps: twenty-four times the Bash command \`sleep 24 && sleep 24 && sleep 24 && sleep 24\`, each a separate Bash step. Then reply 'started' and end your turn. If a message with a nonce arrives later, reply with one line: GOT and the nonce. When the agent finishes, repeat its NONCES line."
tmux send-keys -t "$RUN" Enter
sleep 60
echo "asked at about $(date +%T)" > "$R/c7.txt"
PROBE_RUN_DIR="$R" bun "$DRIVER" state >> "$R/c7.txt" 2>&1
snap "after the ask"
sleep 1800
echo "=== before answering ($(date +%T))" >> "$R/c7.txt"
ls -l "$R/sessions" >> "$R/c7.txt" 2>&1
PROBE_RUN_DIR="$R" bun "$DRIVER" sessions >> "$R/c7.txt" 2>&1
STUB=$(grep -h '"kind":"start"' "$R/logs/server.jsonl" | tail -1 | sed -E 's/.*"pid":([0-9]+).*/\1/')
echo "=== stub pid $STUB: $(ps -o pid=,etime=,command= -p "$STUB" 2>&1 | cut -c1-120)" >> "$R/c7.txt"
echo "=== state before answering" >> "$R/c7.txt"
PROBE_RUN_DIR="$R" bun "$DRIVER" state >> "$R/c7.txt" 2>&1
snap "before answering"
PROBE_RUN_DIR="$R" bun "$DRIVER" answer c7-main --text "main after 31 minutes" >> "$R/c7.txt" 2>&1
PROBE_RUN_DIR="$R" bun "$DRIVER" answer c7-bg --text "background after 31 minutes" >> "$R/c7.txt" 2>&1
echo "=== answered ($(date +%T))" >> "$R/c7.txt"
sleep 240
snap "240 s after the answers"
tmux capture-pane -p -S -300 -t "$RUN" > "$R/screen.txt"
tmux kill-session -t "$RUN"
echo "=== done ($(date +%T))" >> "$R/c7.txt"
grep -E '^=== |asked at' "$R/c7.txt"
