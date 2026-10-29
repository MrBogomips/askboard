#!/bin/sh
# Criterion 5: add the local marketplace and install the probe at local scope in the scratch project.
set -u
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
cd "$S/project"
"$S/clean.sh" claude plugin marketplace add "$S/mp" --scope local
echo "marketplace exit $?"
"$S/clean.sh" claude plugin install probe@askboard-spike-mp --scope local
echo "install exit $?"
"$S/clean.sh" claude plugin list 2>&1 | grep -i -A3 probe
cat .claude/settings.local.json 2>&1
