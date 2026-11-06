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

### Requirement: The hooks file
The plugin SHALL carry `hooks/hooks.json`, declaring the `PreToolUse` hooks on AskBoard's tools and on AskUserQuestion, the `PostToolUse` hook on `ask` and the `SubagentStop` hook, each with a 5 s timeout, and the mod as the plugin's hooks module. Each hook SHALL run the built bundle in hook mode; E11's launcher replaces that command (AD-19).

#### Scenario: The plugin validates
- **WHEN** `claude plugin validate` runs on a built checkout
- **THEN** it reports no error for the hooks file or the mod module

#### Scenario: Loading the plugin from a checkout
- **WHEN** Claude Code starts with `--plugin-dir` pointing at a built checkout
- **THEN** the four hooks and the mod are loaded with the server `askboard`

### Requirement: Hook mode
The bundle run as `askboard hook <event>` SHALL read the hook input from stdin, run that hook, write only the hook's output on stdout, and exit. It SHALL start no MCP server, open no port and write no file (AD-19).

#### Scenario: A PreToolUse hook run
- **WHEN** the bundle runs as `hook PreToolUse` with an AskBoard call's input on stdin
- **THEN** it sends the record, writes nothing that is a decision, and exits 0

#### Scenario: An unknown event
- **WHEN** the bundle runs as `hook` with an event it does not know
- **THEN** it exits 0 with no output on stdout and one line on stderr

### Requirement: Client mode
The bundle run as `askboard client <request>` SHALL send that one local API request to the session process of its parent Claude Code process, found through the session file, and print the response; the session token never appears on its command line (AD-5).

#### Scenario: The mod polls through the client
- **WHEN** the mod runs the bundle as a client to poll
- **THEN** the client prints the same response the local API gives over the socket

### Requirement: The mod module
The mod SHALL be built into one self-contained module file that the hooks file names, which loads nothing at run time and reaches the machine only through the mod API (AD-1, AD-4).

#### Scenario: The mod module's imports
- **WHEN** the built mod module is inspected
- **THEN** it holds no import or require statement
