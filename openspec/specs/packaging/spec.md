# packaging Specification

## Purpose
Packaging is how Claude Code loads AskBoard as one plugin and starts its session process, on the platforms and runtimes the product supports (AD-19, NFR-7).

## Requirements

### Requirement: The plugin and its server entry
The repository SHALL load as a Claude Code plugin named `askboard` that declares one stdio MCP server named `askboard`. The server entry SHALL start the built bundle directly, with no launcher and no download; AD-22's launcher and AD-19's executable replace it in E11. The server entry's `env` SHALL pass `CLAUDE_PROJECT_DIR`, and it SHALL set no per-server timeout below `collect`'s longest wait (Consistency Conventions, MCP names and plugin server entry).

#### Scenario: Loading the plugin from a checkout
- **WHEN** Claude Code starts with `--plugin-dir` pointing at a built checkout
- **THEN** the server `askboard` connects, and its tools are `mcp__plugin_askboard_askboard__ask` and `mcp__plugin_askboard_askboard__collect`

### Requirement: One bundle on Bun and Node
The session process SHALL build as one plain JavaScript bundle that runs on Bun and on Node 24.22.1 or later, using no Bun-only API (AD-19). It is the form AskBoard ships on Node until AXFX NFR-1 admits the Bun executable, and the bundle every release publishes beside the executable (AD-19).

#### Scenario: The same bundle on both runtimes
- **WHEN** the conformance suite runs the built bundle on Bun and on Node 24
- **THEN** it passes on both
