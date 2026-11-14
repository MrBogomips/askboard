#!/bin/sh
# Criterion 13, interactive part: ask, /clear, ask + push, /resume (first entry), ask + push.
# Usage: c13i.sh <claude-binary> <run-name>
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
DRIVER=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe/driver.ts
RUN=$2
LOGS="$SCRATCH/runs/$RUN/logs"
send() { tmux send-keys -t "$RUN" -l "$1"; tmux send-keys -t "$RUN" Enter; }
sh "$SCRATCH/run-i.sh" "$1" "$RUN"
sleep 8
send "Call probe_ask with askId c13i-start and question 'start', then reply done."
sh "$SCRATCH/wait-for.sh" "$LOGS/server.jsonl" '"askId":"c13i-start"' 90
sleep 6
send "/clear"
sleep 3
send "Call probe_ask with askId c13i-afterclear and question 'after clear', then reply done."
sh "$SCRATCH/wait-for.sh" "$LOGS/hooks.jsonl" 'c13i-afterclear' 90
sleep 8
PROBE_RUN_DIR="$SCRATCH/runs/$RUN" bun "$DRIVER" answer c13i-afterclear --text "pushed after clear" | grep nonce
sleep 15
send "/resume"
sleep 3
tmux send-keys -t "$RUN" Enter
sleep 5
send "Call probe_ask with askId c13i-afterresume and question 'after resume', then reply done."
sh "$SCRATCH/wait-for.sh" "$LOGS/hooks.jsonl" 'c13i-afterresume' 90
sleep 8
PROBE_RUN_DIR="$SCRATCH/runs/$RUN" bun "$DRIVER" answer c13i-afterresume --text "pushed after resume" | grep nonce
sleep 15
tmux capture-pane -p -t "$RUN" | grep -v '^\s*$' | tail -15
