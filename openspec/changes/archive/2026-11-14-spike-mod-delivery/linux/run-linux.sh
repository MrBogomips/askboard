#!/bin/sh
# Task 4.1 from the host: criteria 10, 12 and 13 in a Linux container on Claude Code `latest`.
# Usage: run-linux.sh [all|stub]
#   all (default): the stub-only checks, then the Claude Code runs (c10-tcp, c10-unix, c13-clean). Needs
#                  CLAUDE_CODE_OAUTH_TOKEN in the caller's environment (from `claude setup-token`); it reaches
#                  the container by name only, never on a command line, in a file or in the image.
#   stub:          criterion 12 without Claude Code: no model, no token.
# Environment: IMAGE (default askboard-spike-mod-delivery:linux, built from the Dockerfile when missing),
#              LINUX_RUNS_DIR (default runs/ beside this script, ignored by git).
# Results: <runs>/<UTC time>-<mode>/ (versions, summaries, run folders, transcripts).
set -eu
MODE=${1:-all}
HERE=$(cd "$(dirname "$0")" && pwd)
PROBE=$(cd "$HERE/../probe" && pwd)
IMAGE=${IMAGE:-askboard-spike-mod-delivery:linux}
RUNS=${LINUX_RUNS_DIR:-$HERE/runs}

case $MODE in
  stub) ;;
  all)
    if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
      echo "run-linux.sh: CLAUDE_CODE_OAUTH_TOKEN is not set." >&2
      echo "Create a token with 'claude setup-token', then run from the repository root:" >&2
      echo "  CLAUDE_CODE_OAUTH_TOKEN=<token> sh openspec/changes/spike-mod-delivery/linux/run-linux.sh" >&2
      echo "'run-linux.sh stub' runs the checks that need no model and no token." >&2
      exit 2
    fi
    ;;
  *)
    echo "usage: run-linux.sh [all|stub]" >&2
    exit 2
    ;;
esac

command -v docker > /dev/null || { echo "run-linux.sh: docker is not installed" >&2; exit 2; }
docker image inspect "$IMAGE" > /dev/null 2>&1 || docker build --tag "$IMAGE" - < "$HERE/Dockerfile"
mkdir -p "$RUNS"

# Only the variable's name goes on the docker command line; docker reads the value from this environment.
if [ "$MODE" = all ]; then set -- --env CLAUDE_CODE_OAUTH_TOKEN; else set --; fi
docker run --rm --init --name "askboard-linux-$MODE-$$" \
  --volume "$PROBE:/probe:ro" --volume "$HERE:/harness:ro" --volume "$RUNS:/runs" \
  "$@" "$IMAGE" sh /harness/in-container.sh "$MODE"
