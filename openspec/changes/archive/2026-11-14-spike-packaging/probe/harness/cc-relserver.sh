#!/bin/sh
# Starts the release-server stand-in in a tmux session p-rel-<run>. Usage: cc-relserver.sh <run> <port> [RATE] [DELAY]
C=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-packaging/openspec/changes/spike-packaging
tmux new-session -d -s "p-rel-$1" "cd $C/probe && RUN=$1 PORT=$2 RATE=${3:-0} DELAY=${4:-0} WRITE_RELEASE=0 bun release-server.ts"
