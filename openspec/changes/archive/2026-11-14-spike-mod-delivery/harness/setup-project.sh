#!/bin/sh
# Creates the throwaway git project the spike's sessions run in.
set -eu
PROJECT=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad/project
rm -rf "$PROJECT"
mkdir -p "$PROJECT"
cd "$PROJECT"
git init -q -b main
printf '# Probe project\n\nThrowaway project for the mod delivery spike.\n' > README.md
git add README.md
git -c user.name=probe -c user.email=probe@example.invalid commit -q -m "chore: probe project"
git log --oneline
