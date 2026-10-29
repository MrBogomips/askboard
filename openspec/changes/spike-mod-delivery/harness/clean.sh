#!/bin/sh
# Runs a command with a clean environment: no variables inherited from the Claude Code session that launched it.
# Keeps only what a login shell needs, plus the probe's own PROBE_* variables.
exec env -i \
  HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" SHELL="${SHELL:-/bin/zsh}" \
  PATH="$PATH" TERM="${TERM:-xterm-256color}" LANG="${LANG:-en_US.UTF-8}" TMPDIR="${TMPDIR:-/tmp}" \
  ${PROBE_RUN_DIR:+PROBE_RUN_DIR="$PROBE_RUN_DIR"} \
  ${PROBE_POLL_MS:+PROBE_POLL_MS="$PROBE_POLL_MS"} \
  ${PROBE_TRANSPORT:+PROBE_TRANSPORT="$PROBE_TRANSPORT"} \
  ${PROBE_MAIN_VIA:+PROBE_MAIN_VIA="$PROBE_MAIN_VIA"} \
  ${PROBE_SELF_ALLOW:+PROBE_SELF_ALLOW="$PROBE_SELF_ALLOW"} \
  ${PROBE_PUSH_VIA:+PROBE_PUSH_VIA="$PROBE_PUSH_VIA"} \
  "$@"
