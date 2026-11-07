# packaging Specification

## Purpose
Packaging is how Claude Code loads AskBoard as one plugin and starts its session process, on the platforms and runtimes the product supports (AD-19, NFR-7).

## Requirements

### Requirement: The plugin and its server entry
The repository SHALL load as a Claude Code plugin named `askboard` that declares one stdio MCP server named `askboard`. The server entry SHALL run `scripts/askboard` through `sh`, which runs the built bundle on Node with no launcher or download, until AD-22's launcher and AD-19's executable replace it. Its `env` SHALL pass `CLAUDE_PROJECT_DIR`, and it SHALL set no per-server timeout below `collect`'s longest wait (Consistency Conventions, MCP names and plugin server entry).

#### Scenario: Loading the plugin from a checkout
- **WHEN** Claude Code starts with `--plugin-dir` pointing at a built checkout, with Node 24.22.1 or later on `PATH`
- **THEN** the server `askboard` connects, and its tools are `ask`, `update`, `collect`, `fetch` and `snapshot`, each named `mcp__plugin_askboard_askboard__<tool>`

#### Scenario: The server entry names the start script
- **WHEN** `.claude-plugin/plugin.json` is read
- **THEN** the server `askboard` has the command `sh` and the single argument `${CLAUDE_PLUGIN_ROOT}/scripts/askboard`, and names neither `bun` nor the bundle

### Requirement: One bundle on Bun and Node
The session process SHALL build as one plain JavaScript bundle that runs on Bun and on Node 24.22.1 or later, using no Bun-only API (AD-19). It is the form AskBoard ships on Node until AXFX NFR-1 admits the Bun executable, and the bundle every release publishes beside the executable (AD-19).

#### Scenario: The same bundle on both runtimes
- **WHEN** the conformance suite runs the built bundle on Bun and on Node 24
- **THEN** it passes on both

### Requirement: The hooks file
The plugin SHALL carry `hooks/hooks.json`, declaring the `PreToolUse` hooks on AskBoard's tools and on AskUserQuestion, the `PostToolUse` hook on `ask` and the `SubagentStop` hook, each with a 5 s timeout, and the mod as the plugin's hooks module. Each hook SHALL run the start script in hook mode, `sh "${CLAUDE_PLUGIN_ROOT}/scripts/askboard" hook <event>`; E11's launcher replaces that command (AD-19).

#### Scenario: The plugin validates
- **WHEN** `claude plugin validate` runs on a built checkout
- **THEN** it reports no error for the hooks file or the mod module

#### Scenario: Loading the plugin from a checkout
- **WHEN** Claude Code starts with `--plugin-dir` pointing at a built checkout
- **THEN** the four hooks and the mod are loaded with the server `askboard`

#### Scenario: Each hook runs the start script
- **WHEN** `hooks/hooks.json` is read
- **THEN** every hook's command is the start script in hook mode for its own event, quoted, with a 5 s timeout

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

### Requirement: The plugin's skill and agents
The plugin SHALL carry its skill in the default `skills/` folder at the plugin root, where Claude Code finds it as `askboard:askboard`, and its manifest SHALL declare no `skills` or `agents` path. The first version SHALL ship no agent (FR-28, FR-29, AD-19).

#### Scenario: The plugin's layout
- **WHEN** the repository is checked as a plugin
- **THEN** `skills/askboard/SKILL.md` exists, `.claude-plugin/plugin.json` has no `skills` or `agents` key, and there is no `agents/` folder at the plugin root

#### Scenario: The tool description names the skill
- **WHEN** the `ask` tool's description is read
- **THEN** the skill it names is the shipped skill's `name`

### Requirement: The start script runs the bundle on Node
The start script SHALL be POSIX `sh`, find the plugin root from its own path, and replace itself with Node running `dist/askboard.mjs` with the arguments it was given, so Claude Code stays the parent of the session process (AD-5). It SHALL do so only when `node` on `PATH` is 24.22.1 or later, and it SHALL make no network request.

#### Scenario: Node is recent enough
- **WHEN** the start script runs with Node 24.22.1 or later on `PATH` and no argument
- **THEN** the session process answers the MCP handshake with AskBoard's tools, and its parent process is the start script's parent

#### Scenario: Hook and client modes pass through
- **WHEN** the start script runs as `hook PreToolUse` or as `client <path>`
- **THEN** the bundle runs in that mode with the same arguments, stdin and stdout

### Requirement: The start script runs Node's own binary
The start script SHALL read the version and the executable path from one run of `node` (`process.versions.node` and `process.execPath`) and SHALL replace itself with that executable, so that a version manager's shim never stands between Claude Code and the session process, whose parent process keys the session file (AD-5).

#### Scenario: A version manager's shim
- **WHEN** `node` on `PATH` is a shim that runs the real Node as its child, and the start script runs the session process
- **THEN** the session process's parent is the process that ran the start script, and its session file is named by that process's ID

### Requirement: The start script runs outside the project
Before any `node` runs, the start script SHALL change to the plugin root, so that no file in the user's project can choose or run code through the runtime's start. It SHALL leave `CLAUDE_PROJECT_DIR` as the host gave it, never filling it from the working directory (AD-12), and SHALL pass the caller's working directory as `ASKBOARD_CALLER_CWD`, which the session process reads where it used its own working directory (NFR-5, AD-8, AD-12, AD-19).

#### Scenario: A project's runtime hooks run nothing
- **WHEN** the start script runs in hook mode from a project whose files configure the runtime's start (a Volta `hooks.json` naming a script, a `bunfig.toml` preload)
- **THEN** no script of the project runs, and the session process and hooks still see the project through `CLAUDE_PROJECT_DIR` and the hook input's `cwd`

#### Scenario: No project directory from the host
- **WHEN** the start script runs with `CLAUDE_PROJECT_DIR` unset
- **THEN** the session process gets no `CLAUDE_PROJECT_DIR`, its session file names no project directory, and `ASKBOARD_CALLER_CWD` holds the caller's working directory

### Requirement: The mod's client fallback runs the start script
The mod's client fallback SHALL run the start script in client mode, never `bun` (AD-19).

#### Scenario: The mod's fallback names the start script
- **WHEN** the mod's client fallback command is built for a plugin root
- **THEN** it is `sh <root>/scripts/askboard client` and names neither `bun` nor the bundle

### Requirement: The session process refuses an unusable Node with a reason
When `node` is missing from `PATH` or older than 24.22.1, the start script run with no argument SHALL answer the MCP handshake itself, with no tools and instructions naming the Node version required and the version found (or that none was found), and keep answering until stdin closes. It SHALL write one stderr line with the same reason and never exit with a failure Claude Code would cache (AD-22, NFR-8).

#### Scenario: Node is too old
- **WHEN** the start script runs with Node 22 first on `PATH` and receives `initialize` then `tools/list`
- **THEN** `initialize` returns instructions naming 24.22.1 and 22, `tools/list` returns an empty list, and the process is still running until stdin closes, then exits 0

#### Scenario: Node is missing
- **WHEN** the start script runs with no `node` on `PATH` and receives `initialize`
- **THEN** the instructions say that Node 24.22.1 or later was not found on `PATH`

### Requirement: Hooks and the client refuse an unusable Node quietly
When `node` is missing or older than 24.22.1, the start script in hook mode SHALL exit 0 with no output on stdout and one stderr line naming the reason (AD-19), and in client mode SHALL exit non-zero with one stderr line naming the reason.

#### Scenario: A hook with Node too old
- **WHEN** the start script runs as `hook PreToolUse` with Node 22 first on `PATH`
- **THEN** it exits 0, writes nothing on stdout and one line on stderr naming 24.22.1

### Requirement: One product version
The root `package.json`, every `packages/*/package.json` and `.claude-plugin/plugin.json` SHALL carry the same semantic version, and the session process SHALL report it as its server version. A check that the repository's tests run SHALL fail, naming each file that differs, when they disagree. The first release is 0.1.0.

#### Scenario: A version differs
- **WHEN** one package's version differs from the root's
- **THEN** the test suite fails naming that package's file and both versions

#### Scenario: The server reports the product version
- **WHEN** a client completes the handshake with the session process
- **THEN** the server's reported version equals the version in `.claude-plugin/plugin.json`

### Requirement: The release tree
A release SHALL assemble the plugin as a tree holding only the plugin manifest, the marketplace file, the hooks file, the built mod, the start script, the bundle, the view build, the skill folder, `LICENSE`, `README.md`, `CHANGELOG.md` and the bundle's notices. It SHALL hold no `package.json`, no lockfile, no `bin/` or `agents/` folder, no symbolic link, and no source, test or tooling file.

#### Scenario: Assembling from a built checkout
- **WHEN** the assembly runs after `bun run build`
- **THEN** the tree holds exactly the listed files, each byte-identical to its built or committed source, and a run of the start script in the tree answers the handshake with AskBoard's tools on Node

#### Scenario: Assembling from an unbuilt checkout
- **WHEN** the assembly runs with `dist/askboard.mjs` or the built mod missing
- **THEN** it fails naming the missing file and writes no tree

### Requirement: The marketplace on the release branch
The release tree SHALL carry `.claude-plugin/marketplace.json` naming the marketplace `askboard`, its owner, and one plugin `askboard` whose source is the tree's root (`./`), with no `version` in the entry. `main` SHALL carry no marketplace file. Each release SHALL be committed to the `release` branch, whose commits hold only release trees, and tagged `v<version>` (FR-28).

#### Scenario: The marketplace file in the tree
- **WHEN** the tree's `.claude-plugin/marketplace.json` is read
- **THEN** it has `name`, `owner` and one plugin entry `askboard` with source `./` and no `version`, and `claude plugin validate` on the tree reports no error

#### Scenario: Installing at user and project scope
- **WHEN** a user adds the marketplace from the repository at `#release` and installs `askboard@askboard` at user scope, or at project scope in one project
- **THEN** AskBoard's tools, skill and hooks are present in every project, or in that project only

### Requirement: The release workflow
A release SHALL run only from a manual dispatch on `main`. Before publishing it SHALL fail when the versions disagree, the tag `v<version>` exists, `CHANGELOG.md` has no section for the version, the Claude Code `stable` channel is below the declared minimum (AD-18), the repository checks fail, or the tree's start script does not answer the handshake on Node 24 on macOS and on Linux. Publishing SHALL be its only step with write access.

#### Scenario: A release that passes its gates
- **WHEN** the workflow is dispatched on `main` at a version with a CHANGELOG section and no tag
- **THEN** the `release` branch gains one commit holding the tree, tagged `v<version>`, and a GitHub release `v<version>` holds the bundle, the tree as an archive and a SHA-256 file for both, with the CHANGELOG section as its notes

#### Scenario: A version already released
- **WHEN** the workflow is dispatched and the tag `v<version>` exists
- **THEN** it fails before building, naming the tag, and pushes nothing

### Requirement: Notices for the bundle
The release tree SHALL carry the licence notices of every third-party package bundled into `dist/askboard.mjs`, each with its name, version, licence and licence text, taken as the view build takes its notices (NFR-6, AD-19). The assembly SHALL fail when a bundled package has no licence text.

#### Scenario: The bundle's packages each have a notice
- **WHEN** the tree is assembled
- **THEN** its notices file names every third-party package of the bundle's inputs with its licence text, and no package outside them
