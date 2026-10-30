#!/bin/sh
# Criterion 1 and 3, interactive: one agent kind, <count> answers <interval> ms apart, first after 8 s.
# Usage: deliver-i.sh <claude-binary> <run-name> <seconds-to-run> <count> <interval-ms> <prompt>
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
DRIVER=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe/driver.ts
BIN=$1
RUN=$2
DURATION=$3
COUNT=$4
INTERVAL=$5
PROMPT=$6
sh "$SCRATCH/run-i.sh" "$BIN" "$RUN"
PROBE_RUN_DIR="$SCRATCH/runs/$RUN" bun "$DRIVER" auto --delay 8000 --interval "$INTERVAL" --count "$COUNT" --idle 600000 > "$SCRATCH/runs/$RUN/answers.jsonl" 2> "$SCRATCH/runs/$RUN/auto.err" &
AUTO=$!
sleep 8
tmux send-keys -t "$RUN" -l "$PROMPT"
tmux send-keys -t "$RUN" Enter
sleep "$DURATION"
tmux capture-pane -p -S -200 -t "$RUN" > "$SCRATCH/runs/$RUN/screen.txt"
tmux kill-session -t "$RUN"
kill "$AUTO" 2>/dev/null
echo "$RUN: answers $(wc -l < "$SCRATCH/runs/$RUN/answers.jsonl"), screen saved"
