#!/bin/sh
# `command` plugin source stand-in (design decision 6): run by Claude Code at install, at update and once per session.
# Fetches the executable for this machine, checks its SHA-256 against the pinned release file, writes a complete
# plugin directory whose server runs the executable directly, and prints that directory's absolute path.
# Env: ASKBOARD_RELEASE_URL (base URL), ASKBOARD_CMDSRC_OUT (output root). Diagnostics go to stderr only.
set -u
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
RELEASE=$HERE/plugin/scripts/release.txt
VERSION=$(sed -n 's/^version //p' "$RELEASE")
BASE_URL=${ASKBOARD_RELEASE_URL:-http://127.0.0.1:47866/askboard/askboard/releases/download}
OUT_ROOT=${ASKBOARD_CMDSRC_OUT:-/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard--claude-worktrees-feature-spike-mod-delivery/50fdda78-5b18-488d-8821-6ced6d989c7e/scratchpad/pkg/cmdsrc-out}
case $(uname -s)-$(uname -m) in
  Darwin-arm64) T=darwin-arm64 ;;
  Darwin-x86_64) T=darwin-x64 ;;
  Linux-x86_64) T=linux-x64 ;;
  Linux-aarch64) T=linux-arm64 ;;
  *) echo "askboard: unsupported platform" >&2; exit 1 ;;
esac
EXPECTED=$(sed -n "s/^$T //p" "$RELEASE")
DIR=$OUT_ROOT/$VERSION-$(printf '%s' "$EXPECTED" | cut -c1-12)
if [ ! -x "$DIR/bin-askboard/askboard" ]; then
  mkdir -p "$DIR/.claude-plugin" "$DIR/bin-askboard" || exit 1
  TMP=$DIR/bin-askboard/askboard.$$.part
  curl -fsSL --connect-timeout 5 --max-time 110 -o "$TMP" "$BASE_URL/v$VERSION/askboard-$T" >&2 || { rm -f "$TMP"; echo "askboard: download failed" >&2; exit 1; }
  ACTUAL=$(shasum -a 256 "$TMP" | cut -d' ' -f1)
  [ "$ACTUAL" = "$EXPECTED" ] || { rm -f "$TMP"; echo "askboard: checksum mismatch" >&2; exit 1; }
  chmod 755 "$TMP" && mv -f "$TMP" "$DIR/bin-askboard/askboard"
fi
printf '{\n  "name": "askboard",\n  "version": "%s",\n  "description": "Packaging spike stand-in: the command source form. Not shipped."\n}\n' "$VERSION" >"$DIR/.claude-plugin/plugin.json"
printf '{\n  "mcpServers": {\n    "askboard": {\n      "command": "${CLAUDE_PLUGIN_ROOT}/bin-askboard/askboard",\n      "env": { "CLAUDE_PROJECT_DIR": "${CLAUDE_PROJECT_DIR}", "ASKBOARD_DATA_PROBE": "${CLAUDE_PLUGIN_DATA}" }\n    }\n  }\n}\n' >"$DIR/.mcp.json"
echo "$DIR"
