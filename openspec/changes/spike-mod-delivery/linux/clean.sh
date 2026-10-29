#!/bin/sh
# Runs a command with a clean environment (container port of harness/clean.sh).
# The macOS version starts from `env -i` and names what it keeps, values included. Here the OAuth token must
# reach Claude Code without ever appearing on a command line, so every variable outside the list is unset
# by name instead, and the kept ones are inherited as they are.
for name in $(awk 'BEGIN { for (k in ENVIRON) print k }'); do
  case $name in
    HOME | USER | LOGNAME | SHELL | PATH | TERM | LANG | TMPDIR) ;;
    CLAUDE_CODE_OAUTH_TOKEN | DISABLE_AUTOUPDATER) ;;
    PROBE_RUN_DIR | PROBE_POLL_MS | PROBE_TRANSPORT | PROBE_MAIN_VIA | PROBE_SELF_ALLOW | PROBE_PUSH_VIA | PROBE_SHOW_LINK) ;;
    *) unset "$name" 2> /dev/null ;;
  esac
done
exec "$@"
