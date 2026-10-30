#!/bin/sh
# Criterion 8 with the mod on: a background subagent asks once; the mod shows the link by toast and status
# (PROBE_SHOW_LINK=1). Captures the pane every 2 s for 20 s from the ask.
# Usage: c8-toast.sh <claude-binary> <run-name>
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
RUN=$2
R="$SCRATCH/runs/$RUN"
export PROBE_DIR="$SCRATCH/probe-p1" PROBE_MAIN_VIA=hybrid PROBE_PUSH_VIA=append PROBE_SHOW_LINK=1 PROBE_CC_FLAGS="--permission-mode auto"
OUT="$R/c8.txt"
sh "$SCRATCH/run-i.sh" "$1" "$RUN"
sleep 8
tmux send-keys -t "$RUN" -l "Start the probe-worker agent in the background (run_in_background: true) with this task: askId c8-toast, question 'background, is the link shown?', steps: sleep 5, four times. Then reply 'started' and end your turn. When the agent finishes, repeat its NONCES line."
tmux send-keys -t "$RUN" Enter
sh "$SCRATCH/wait-for.sh" "$R/logs/server.jsonl" '"kind":"tools/call","tool":"probe_ask"' 120 > "$OUT"
echo "ask seen ($(date +%T))" >> "$OUT"
i=0
while [ "$i" -lt 10 ]; do
  sleep 2
  i=$((i + 1))
  tmux capture-pane -p -t "$RUN" > "$R/screen-$i.txt"
  echo "capture $i ($(date +%T)): $(grep -c 'AskBoard' "$R/screen-$i.txt") lines with AskBoard" >> "$OUT"
  grep 'AskBoard' "$R/screen-$i.txt" | cut -c1-160 >> "$OUT"
done
sleep 30
tmux capture-pane -p -S -200 -t "$RUN" > "$R/screen.txt"
tmux kill-session -t "$RUN"
echo "== mod"; grep -h 'show-link\|tool.call' "$R/logs/mod.jsonl" | cut -c1-260
cat "$OUT"
