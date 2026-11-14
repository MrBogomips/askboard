#!/bin/sh
# Criterion 5 setup: save config baselines, build a local directory marketplace holding a copy of the probe.
set -eu
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
cd "$S"
mkdir -p c5-baseline mp/.claude-plugin
cp ~/.claude/plugins/known_marketplaces.json ~/.claude/plugins/installed_plugins.json c5-baseline/
if [ -f project/.claude/settings.local.json ]; then cp project/.claude/settings.local.json c5-baseline/project-settings.local.json; fi
rm -rf mp/probe
cp -R /Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery/openspec/changes/spike-mod-delivery/probe mp/probe
rm -rf mp/probe/.claude-plugin/types
cat > mp/.claude-plugin/marketplace.json <<'EOF'
{
  "name": "askboard-spike-mp",
  "owner": { "name": "AskBoard spike" },
  "plugins": [
    { "name": "probe", "source": "./probe", "description": "Mod delivery spike probe (criterion 5)" }
  ]
}
EOF
claude plugin validate mp 2>&1 | tail -2
ls -la project/.claude 2>&1
