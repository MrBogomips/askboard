# Spec Delta

## ADDED Requirements

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
