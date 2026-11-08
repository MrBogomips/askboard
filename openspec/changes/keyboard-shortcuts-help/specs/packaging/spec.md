## MODIFIED Requirements

### Requirement: The plugin's skill and agents
The plugin SHALL carry its two skills, `askboard` and `askboard-help`, in the default `skills/` folder at the plugin root, where Claude Code finds them as `askboard:askboard` and `askboard:askboard-help`, and its manifest SHALL declare no `skills` or `agents` path. The first version SHALL ship no agent (FR-28, FR-29, AD-19).

#### Scenario: The plugin's layout
- **WHEN** the repository is checked as a plugin
- **THEN** `skills/askboard/SKILL.md` and `skills/askboard-help/SKILL.md` exist, `.claude-plugin/plugin.json` has no `skills` or `agents` key, and there is no `agents/` folder at the plugin root

#### Scenario: The tool description names the skill
- **WHEN** the `ask` tool's description is read
- **THEN** the skill it names is the `askboard` skill's `name`

### Requirement: The release tree
A release SHALL assemble the plugin as a tree holding only the plugin manifest, the marketplace file, the hooks file, the built mod, the start script, the bundle, the view build, the two skill folders, `LICENSE`, `README.md`, `CHANGELOG.md` and the bundle's notices. It SHALL hold no `package.json`, no lockfile, no `bin/` or `agents/` folder, no symbolic link, and no source, test or tooling file.

#### Scenario: Assembling from a built checkout
- **WHEN** the assembly runs after `bun run build`
- **THEN** the tree holds exactly the listed files, `skills/askboard/` and `skills/askboard-help/` included, each byte-identical to its built or committed source, and a run of the start script in the tree answers the handshake with AskBoard's tools on Node

#### Scenario: Assembling from an unbuilt checkout
- **WHEN** the assembly runs with `dist/askboard.mjs` or the built mod missing
- **THEN** it fails naming the missing file and writes no tree
