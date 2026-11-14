#!/bin/sh
# Criterion 7: asks open 31 minutes, from the idle main conversation and from a working background subagent, then answered.
# Usage: c7.sh <claude-binary> <run-name>
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
DRIVER=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe/driver.ts
RUN=$2
R="$SCRATCH/runs/$RUN"
export PROBE_MAIN_VIA=hybrid PROBE_PUSH_VIA=append PROBE_CC_FLAGS="--permission-mode auto"
sh "$SCRATCH/run-i.sh" "$1" "$RUN"
sleep 8
tmux send-keys -t "$RUN" -l "Call probe_ask with askId c7-main and question 'main, 30 minutes'. Then start the probe-worker agent in the background (run_in_background: true) with this task: askId c7-bg, question 'background, 30 minutes', steps: seventeen times sleep 110. Then reply 'started' and end your turn. If a message with a nonce arrives later, reply with one line: GOT and the nonce. When the agent finishes, repeat its NONCES line."
tmux send-keys -t "$RUN" Enter
sleep 60
echo "asked at about $(date +%T)" > "$R/c7.txt"
PROBE_RUN_DIR="$R" bun "$DRIVER" state >> "$R/c7.txt" 2>&1
sleep 1800
echo "=== before answering ($(date +%T))" >> "$R/c7.txt"
ls -l "$R/sessions" >> "$R/c7.txt" 2>&1
PROBE_RUN_DIR="$R" bun "$DRIVER" sessions >> "$R/c7.txt" 2>&1
PROBE_RUN_DIR="$R" bun "$DRIVER" answer c7-main --text "main after 31 minutes" >> "$R/c7.txt" 2>&1
PROBE_RUN_DIR="$R" bun "$DRIVER" answer c7-bg --text "background after 31 minutes" >> "$R/c7.txt" 2>&1
sleep 240
tmux capture-pane -p -S -300 -t "$RUN" > "$R/screen.txt"
tmux kill-session -t "$RUN"
cat "$R/c7.txt"
