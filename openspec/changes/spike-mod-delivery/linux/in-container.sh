#!/bin/sh
# Container side of run-linux.sh. Usage: in-container.sh stub|all
# Mounts: /probe (the probe, read-only), /harness (this folder, read-only), /runs (results, read-write).
# Every run works in the container's own filesystem, so sockets, 0700 folders and process checks are Linux's
# and not the host mount's. At the end the run folders, the transcripts and the versions go to /runs/<time>-<mode>/.
set -u
MODE=$1
H=/harness
export WORK="$HOME/work"
OUT=/runs/$(date -u +%Y%m%dT%H%M%SZ)-$MODE
rm -rf "$WORK"
mkdir -p "$WORK/runs" "$OUT"

{
  echo "image build:"
  sed 's/^/  /' /opt/probe-image/versions.txt
  echo "now: node $(node --version), bun $(bun --version), claude-code $(claude --version)"
  echo "kernel: $(uname -srm)"
} | tee "$OUT/versions.txt"

# The mount is read-only and its node_modules came from macOS (pure JavaScript, no native or per-platform
# package in bun.lock, so it would load here too). Install a Linux copy from the lockfile instead, which also
# gives Claude Code a writable plugin folder.
mkdir -p "$WORK/probe"
tar -C /probe --exclude=./node_modules --exclude=./.claude-plugin/types -cf - . | tar -C "$WORK/probe" -xf -
if ! (cd "$WORK/probe" && bun install --frozen-lockfile) > "$OUT/bun-install.txt" 2>&1; then
  cat "$OUT/bun-install.txt"
  echo "in-container.sh: bun install --frozen-lockfile failed in the probe copy" >&2
  exit 1
fi
echo "probe copy installed from bun.lock: $(tail -1 "$OUT/bun-install.txt")"

echo "== criterion 12 without Claude Code: smoke-server.sh"
sh "$H/smoke-server.sh" 2>&1 | tee "$OUT/smoke-server.txt"
echo "== criterion 12 without Claude Code: smoke-exit.sh"
sh "$H/smoke-exit.sh" 2>&1 | tee "$OUT/smoke-exit.txt"

if [ "$MODE" = all ]; then
  if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    echo "in-container.sh: CLAUDE_CODE_OAUTH_TOKEN is not set; the Claude Code runs need it" >&2
    exit 2
  fi
  sh "$H/setup-project.sh"
  # The prompt of the macOS c10-unix runs.
  PROMPT="Call probe_ask with askId c10, question 'transport'. Then run the Bash step sleep 12 in the foreground. Then reply with one line: NONCES: and any nonces (N- and 8 hex characters) you received, or none."
  for transport in tcp unix; do
    run=c10-$transport-linux
    echo "== criterion 10, $transport transport: $run"
    PROBE_TRANSPORT=$transport sh "$H/run-auto.sh" claude "$run" 8000 12000 1 "$PROMPT"
    sleep 2
    sh "$H/leftovers.sh" "$WORK/runs/$run" | tee "$WORK/runs/$run/leftovers.txt"
  done
  python3 -I "$H/c10-api.py" c10-tcp-linux c10-unix-linux | tee "$OUT/c10-api.txt"

  echo "== criterion 13, headless steps: c13-clean-linux"
  sh "$H/run-c13.sh" claude c13-clean-linux
  sleep 2
  sh "$H/leftovers.sh" "$WORK/runs/c13-clean-linux" | tee "$WORK/runs/c13-clean-linux/leftovers.txt"
  python3 -I "$H/c13-ids.py" c13-clean-linux | tee "$OUT/c13-ids.txt"

  echo "== criteria 12, 14, 16 across the Claude Code runs"
  python3 -I "$H/protocol-facts.py" c10-tcp-linux c10-unix-linux c13-clean-linux | tee "$OUT/protocol-facts.txt"
  echo "how Claude Code stopped the stub (O1):"
  grep -h 'Sending SIG' "$WORK"/runs/c10-*-linux/debug.log "$WORK"/runs/c13-clean-linux/debug-*.log | cut -c1-200 | tee "$OUT/stop-signal.txt"

  [ -d "$HOME/.claude/projects" ] && cp -R "$HOME/.claude/projects" "$OUT/transcripts"
fi

# Sockets are reported by leftovers.sh and not copied.
mkdir -p "$OUT/runs"
tar -C "$WORK/runs" --exclude='*.sock' -cf - . | tar -C "$OUT/runs" -xf -
if [ "$MODE" = all ]; then python3 -I "$H/token-scan.py" "$OUT" || exit 1; fi
echo "results in $OUT (on the host: the runs folder passed to run-linux.sh)"
