## ADDED Requirements

### Requirement: The plugin's skill and agents
The plugin SHALL carry its skill in the default `skills/` folder at the plugin root, where Claude Code finds it as `askboard:askboard`, and its manifest SHALL declare no `skills` or `agents` path. The first version SHALL ship no agent (FR-28, FR-29, AD-19).

#### Scenario: The plugin's layout
- **WHEN** the repository is checked as a plugin
- **THEN** `skills/askboard/SKILL.md` exists, `.claude-plugin/plugin.json` has no `skills` or `agents` key, and there is no `agents/` folder at the plugin root

#### Scenario: The tool description names the skill
- **WHEN** the `ask` tool's description is read
- **THEN** the skill it names is the shipped skill's `name`
