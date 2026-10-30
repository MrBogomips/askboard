#!/bin/sh
# Creates the throwaway git project the container's sessions run in (container port of harness/setup-project.sh).
set -eu
PROJECT=${WORK:-$HOME/work}/project
rm -rf "$PROJECT"
mkdir -p "$PROJECT"
cd "$PROJECT"
git init -q -b main
printf '# Probe project\n\nThrowaway project for the mod delivery spike.\n' > README.md
git add README.md
git -c user.name=probe -c user.email=probe@example.invalid commit -q -m "chore: probe project"
git log --oneline
