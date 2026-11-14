#!/bin/sh
# One interactive Claude Code session in the isolated configuration, started in tmux session p-<run>, no prompt sent:
# the isolated configuration has no usable credential, so the runs observe MCP start-up only (debug log, /mcp).
# Usage: cc-session.sh <run> <plugin-dir or -> ; env passed through: ASKBOARD_RELEASE_URL, ASKBOARD_LAUNCHER_ON_FAILURE.
set -u
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard--claude-worktrees-feature-spike-mod-delivery/50fdda78-5b18-488d-8821-6ced6d989c7e/scratchpad/pkg
C=/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-packaging/openspec/changes/spike-packaging
RUN=$1
PLUGIN=$2
OUT=$C/probe/runs/$RUN
rm -rf "$OUT" && mkdir -p "$OUT"
EXTRA=
[ "$PLUGIN" = - ] || EXTRA="--plugin-dir '$PLUGIN'"
cat >"$OUT/launch.sh" <<SCRIPT
#!/bin/sh
cd '$S/project'
exec env -i HOME='$HOME' USER='$USER' SHELL=/bin/zsh PATH='$PATH' TERM=xterm-256color LANG=en_US.UTF-8 \\
  TMPDIR='${TMPDIR:-/tmp}' CLAUDE_CONFIG_DIR='$S/cc-config' ASKBOARD_PROBE_LOG='$OUT/server.jsonl' \\
  ${ASKBOARD_RELEASE_URL:+ASKBOARD_RELEASE_URL='$ASKBOARD_RELEASE_URL'} \\
  ${ASKBOARD_LAUNCHER_ON_FAILURE:+ASKBOARD_LAUNCHER_ON_FAILURE='$ASKBOARD_LAUNCHER_ON_FAILURE'} \\
  claude --model claude-opus-5-5 --setting-sources project,local --debug-file '$OUT/debug.log' $EXTRA
SCRIPT
date +%s.%N >"$OUT/t-start"
tmux new-session -d -s "$RUN" -x 160 -y 50 "sh '$OUT/launch.sh'; sleep 3"
