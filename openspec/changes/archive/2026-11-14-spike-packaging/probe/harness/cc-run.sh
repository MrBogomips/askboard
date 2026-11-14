#!/bin/sh
# One headless Claude Code run in the isolated configuration (design decision 7).
# Usage: cc-run.sh <run> <plugin-dir or -> <prompt>
# Env passed through: ASKBOARD_RELEASE_URL, ASKBOARD_LAUNCHER_ON_FAILURE, CLAUDE_BIN (default: claude on PATH).
set -u
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard--claude-worktrees-feature-spike-mod-delivery/50fdda78-5b18-488d-8821-6ced6d989c7e/scratchpad/pkg
C=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-packaging/openspec/changes/spike-packaging
RUN=$1
PLUGIN=$2
PROMPT=$3
OUT=$C/probe/runs/$RUN
rm -rf "$OUT" && mkdir -p "$OUT"
set -- --model claude-opus-5-5 --output-format json --debug-file "$OUT/debug.log" --setting-sources project,local \
  --allowedTools "mcp__plugin_askboard_askboard__ask"
[ "$PLUGIN" = - ] || set -- "$@" --plugin-dir "$PLUGIN"
cd "$S/project" || exit 1
date +%s.%N >"$OUT/t-start"
env -i HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" SHELL=/bin/zsh PATH="$PATH" TERM=xterm-256color \
  LANG=en_US.UTF-8 TMPDIR="${TMPDIR:-/tmp}" CLAUDE_CONFIG_DIR="$S/cc-config" ASKBOARD_PROBE_LOG="$OUT/server.jsonl" \
  ${ASKBOARD_RELEASE_URL:+ASKBOARD_RELEASE_URL="$ASKBOARD_RELEASE_URL"} \
  ${ASKBOARD_LAUNCHER_ON_FAILURE:+ASKBOARD_LAUNCHER_ON_FAILURE="$ASKBOARD_LAUNCHER_ON_FAILURE"} \
  "${CLAUDE_BIN:-claude}" -p "$PROMPT" "$@" >"$OUT/result.json" 2>"$OUT/stderr.txt"
echo "exit $?" >"$OUT/exit"
date +%s >"$OUT/t-end"
