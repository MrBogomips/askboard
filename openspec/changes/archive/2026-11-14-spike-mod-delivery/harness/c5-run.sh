#!/bin/sh
# Criterion 5: the installed probe (no --plugin-dir), auto mode, no allow rule for its tools; one ask from main, one from a subagent.
set -u
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
DRIVER=$S/mp/probe/driver.ts
RUN=c5-installed-312
R=$S/runs/$RUN
rm -rf "$R"; mkdir -p "$R"; chmod 700 "$R"
tmux kill-session -t "$RUN" 2>/dev/null
tmux new-session -d -s "$RUN" -x 160 -y 50 -c "$S/project" \
  env PROBE_RUN_DIR="$R" PROBE_MAIN_VIA=hybrid PROBE_PUSH_VIA=append \
  "$S/clean.sh" claude --setting-sources project,local --permission-mode auto \
  --allowedTools "Bash(sleep:*),Agent" --model claude-opus-5-5 --debug-file "$R/debug.log"
PROBE_RUN_DIR="$R" bun "$DRIVER" auto --delay 8000 --interval 12000 --count 2 --idle 600000 > "$R/answers.jsonl" 2> "$R/auto.err" &
AUTO=$!
sleep 10
tmux capture-pane -p -t "$RUN" > "$R/screen-start.txt"
tmux send-keys -t "$RUN" -l "Call probe_ask with askId c5-main and question 'installed, main'. Then start the probe-worker agent in the background (run_in_background: true) with this task: askId c5-bg, question 'installed, subagent', steps: sleep 15, sleep 15, sleep 15, sleep 15. Then run the Bash step sleep 20 yourself and report any AskBoard probe answer nonce you have seen. When the agent finishes, repeat its NONCES line."
tmux send-keys -t "$RUN" Enter
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do sleep 10; tmux capture-pane -p -t "$RUN" >> "$R/screens.txt"; echo "=== $i" >> "$R/screens.txt"; done
tmux capture-pane -p -S -300 -t "$RUN" > "$R/screen.txt"
tmux kill-session -t "$RUN"
kill "$AUTO" 2>/dev/null
grep -n -i 'allow\|permission\|do you want\|turn on\|trust' "$R/screens.txt" "$R/screen-start.txt" | sort -u | head -20
grep -o '"via":"[a-z.]*"' "$R/logs/server.jsonl" | sort | uniq -c
grep -i 'NONCES\|GOT\|N-[0-9a-f]\{8\}' "$R/screen.txt" | tail -6
