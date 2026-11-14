#!/bin/sh
# Criterion 2: wake an idle main conversation while the user has a draft in the prompt box.
# Usage: c2-idle.sh <claude-binary> <run-name>
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
DRIVER=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe/driver.ts
RUN=$2
LOGS="$SCRATCH/runs/$RUN/logs"
OUT="$SCRATCH/runs/$RUN/c2.txt"
snap() { echo "=== $1 ($(date +%T))" >> "$OUT"; tmux capture-pane -p -t "$RUN" | grep -v '^\s*$' | tail -12 >> "$OUT"; }
sh "$SCRATCH/run-i.sh" "$1" "$RUN"
sleep 8
tmux send-keys -t "$RUN" -l "Call probe_ask with askId c2-idle and question 'main idle'. Then reply waiting and end your turn. If a message with a nonce arrives later, reply with one line: GOT and the nonce, and end your turn."
tmux send-keys -t "$RUN" Enter
sh "$SCRATCH/wait-for.sh" "$LOGS/mod.jsonl" '"kind":"turn.complete"' 90
sleep 5
tmux send-keys -t "$RUN" -l "this is my half-typed draft"
sleep 2
snap "draft typed, before the answer"
PROBE_RUN_DIR="$SCRATCH/runs/$RUN" bun "$DRIVER" answer c2-idle --text "answer while drafting" | grep -E 'nonce|t0' >> "$OUT"
sleep 12
snap "12 s after the answer, draft still in the box"
sleep 10
snap "22 s after the answer"
# Clear the draft (Ctrl+U deletes to the start of the line) and see whether the queued turn then starts.
tmux send-keys -t "$RUN" C-u
sleep 12
snap "12 s after clearing the draft"
cat "$OUT"
