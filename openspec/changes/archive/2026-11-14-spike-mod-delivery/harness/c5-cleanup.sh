#!/bin/sh
# Criterion 5 cleanup: uninstall the probe, remove the marketplace, compare the configuration with the baseline.
set -u
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
cd "$S/project"
"$S/clean.sh" claude plugin uninstall probe@askboard-spike-mp --scope local; echo "uninstall exit $?"
"$S/clean.sh" claude plugin marketplace remove askboard-spike-mp; echo "remove exit $?"
diff "$S/c5-baseline/known_marketplaces.json" ~/.claude/plugins/known_marketplaces.json > /dev/null && echo "known_marketplaces: same as before" || echo "known_marketplaces: DIFFERS"
diff "$S/c5-baseline/installed_plugins.json" ~/.claude/plugins/installed_plugins.json > /dev/null && echo "installed_plugins: same as before" || echo "installed_plugins: DIFFERS"
grep -c 'askboard-spike-mp' ~/.claude/plugins/known_marketplaces.json ~/.claude/plugins/installed_plugins.json ~/.claude/settings.json
cat .claude/settings.local.json 2>&1
