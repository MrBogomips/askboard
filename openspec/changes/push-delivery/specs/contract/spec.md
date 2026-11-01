# Spec Delta

## ADDED Requirements

### Requirement: Local API schemas
Every local API request and response SHALL have a JSON Schema 2020-12 schema with its own `$id` in the `urn:askboard:local-api:` namespace, in a set owned by `board-host` with its own semantic version that every message with a body names; a request without a body names the set's major in its path (`/v1/`). Claude Code's fields SHALL keep Claude Code's names (`agent_id`, `agent_type`, `tool_use_id`, `stop_hook_active`); every other field is camelCase (AD-7, Consistency Conventions).

#### Scenario: An agent record validates
- **WHEN** the contract's fixture agent record is validated against the local API's record schema
- **THEN** it passes, and a record carrying an unknown field fails, naming it

#### Scenario: A message from another major
- **WHEN** a local API message names major version 2 and the receiver supports 1
- **THEN** the receiver refuses it with a reason that names version 1

### Requirement: Session file schema
The session file SHALL follow a contract schema with its own `$id`, `urn:askboard:session-file:session-file`: `format` (its version), `key` (the Claude Code PID), `pid`, `epoch`, `apiAddress` (the socket's path), `sessionToken` and `startedAt`, each required; `projectDir`, the session project root, the real path of `CLAUDE_PROJECT_DIR`, only when the session has one; and nothing else (AD-5, AD-12).

#### Scenario: A session file with an extra field
- **WHEN** a session file carries a field the schema does not define
- **THEN** it fails validation, and a client treats the session as unreachable

#### Scenario: A session without a project root
- **WHEN** the session process runs without `CLAUDE_PROJECT_DIR`
- **THEN** its session file has no `projectDir`, and validates

### Requirement: Session folder and paths
The contract SHALL compute the session folder, `$XDG_RUNTIME_DIR/askboard` when that variable is set, else `${TMPDIR:-/tmp}/askboard-<uid>`, and in it the session file `<key>.json` and the socket `<key>.sock`. No unit SHALL compute these paths itself. A socket path longer than the platform's limit SHALL be reported as unusable (AD-5, AD-11).

#### Scenario: The same path from every client
- **WHEN** the session process, a hook and the mod compute the paths for one key and one environment
- **THEN** all three get the same folder, file and socket

#### Scenario: A path over the limit
- **WHEN** the socket path for a key exceeds 103 bytes on macOS
- **THEN** the contract reports it as unusable, naming the limit

### Requirement: Push message schema
The output format SHALL define the push message with its own `$id`, `urn:askboard:output:push-message`: the versions it follows, the epoch, and per ask its ID, state, latest cursor and events, each event with its cursor, as `collect` returns them; a stop block's message also lists the subagent's open asks (AD-3, AD-7).

#### Scenario: A push message validates
- **WHEN** the fixture push message holding the plain-choice answer is validated
- **THEN** it passes, and its ask entry has the same shape as the `collect` result's

### Requirement: Closed event
The output format SHALL define the event that closes an ask AskBoard closed, with its own `$id`, `urn:askboard:output:closed-event`: its cursor, `type: "closed"` and `reason: "agent-finished"`, in the output format's set at the ask lifecycle's minor 1.1 and among `collect`'s events. An agent's own close is reported in its call's result and is not an event. The mod's poll SHALL carry any event `collect` returns (AD-3, AD-10).

#### Scenario: A closed event validates
- **WHEN** the fixture closed event is validated
- **THEN** it passes, and the same event with reason `agent` fails

#### Scenario: A closed event in a collect result
- **WHEN** a `collect` result holds a closed event
- **THEN** it validates against the collect result's schema

#### Scenario: The lifecycle's events in a poll
- **WHEN** a poll response carries a postponed event of the ask lifecycle
- **THEN** it validates, and an event of a type `collect` does not return fails

### Requirement: Closed board for a finished subagent
The board protocol's `closed` message SHALL take the reason `agent-finished` beside the ask lifecycle's `agent`, in the ask lifecycle's minor 1.1, which has not shipped, so that a board shows an ask AskBoard closed because its owning subagent finished (AD-10, FR-6).

#### Scenario: A closed message for a finished subagent
- **WHEN** `board-host` sends a `closed` message with reason `agent-finished`
- **THEN** it validates against the board protocol, and a reason outside `agent` and `agent-finished` fails

### Requirement: Board presence message
The board protocol SHALL define the board page's working signal with its own `$id`, `urn:askboard:board-protocol:presence`: whether the board has focus and has had a user input in the last 60 s, and nothing else, so that it never carries content (AD-2, AD-7).

#### Scenario: Presence with content
- **WHEN** a presence message carries any field besides its version, type and working flag
- **THEN** it fails validation

### Requirement: Board origin and agent messages
The board protocol SHALL define two host messages, each with its own `$id`: `urn:askboard:board-protocol:origin`, holding who asked (label, optional name and ordinal), the expected answerer when shown, and the project, directory, branch and worktree, each optional; and `urn:askboard:board-protocol:agent`, holding the agent status, `working` or `waiting` (AD-4, AD-7, FR-24).

#### Scenario: An origin message for an unchecked ask
- **WHEN** an origin message carries a label and a project and no other field
- **THEN** it validates

#### Scenario: An agent message with another status
- **WHEN** an agent message names a status other than `working` or `waiting`
- **THEN** it fails validation

### Requirement: Who asked and where, built in the contract
The contract SHALL provide `originMessage`, which builds the origin message from the session project's folder, the ask's origin with its directory, its agent's name and the expected answerer, using no Node, Bun or DOM API, so that `board-host` and `ask-core` build the same row; a field longer than the schema allows SHALL be left out (AD-1, AD-7, FR-24).

#### Scenario: A branch too long for the schema
- **WHEN** `originMessage` is given an origin whose branch is longer than the schema allows
- **THEN** the message leaves the branch out and validates, and the board shows the branch as unknown

#### Scenario: Imported where Node is not
- **WHEN** a unit compiled without Node, Bun or DOM types, such as `ask-core`, imports `originMessage`
- **THEN** it compiles, and its message equals the one `board-host` sends for the same ask

### Requirement: New schemas are standalone
E4's schemas SHALL be standalone: compiled only by the validate functions that use them, on first call, with the validator's strict options; listed in no existing schema set or ID table; and registered by no module when it is imported. Additions to the contract's entry modules SHALL be new export blocks only (AD-7).

#### Scenario: Importing the contract
- **WHEN** a module imports the contract's entry points and calls nothing
- **THEN** no schema has been compiled or registered

#### Scenario: Strict compilation
- **WHEN** the contract's tests compile E4's schemas in strict mode
- **THEN** each compiles, has its `$id` in its set's namespace and no root combinator

### Requirement: Asking rules
The contract SHALL hold the asking rules as a closed set, `none`, `always` and `with-references`; each rule's predicate is implemented once, in `hooks` (AD-16, FR-30).

#### Scenario: An unknown rule
- **WHEN** a rule outside the closed set is checked
- **THEN** it is refused as unknown

### Requirement: Push delivery constants
The contract SHALL hold the constants the session process, the hooks and the mod share: the poll interval (1 s), the record timeout, the minimum Claude Code version (2.1.311), the local API response limit (1 MiB), the hooks' request timeout and the working window (60 s) (AD-2, AD-4, AD-5, AD-18).

#### Scenario: One value for every unit
- **WHEN** the mod polls, a hook waits for the local API or the session process checks a client version
- **THEN** the value used is the contract's constant, and no unit defines its own

### Requirement: Push delivery fixtures
The contract SHALL provide fixtures for an agent record of the main conversation and of a subagent, a session file, a push message, a stop block, a pending-asks list, a closed event, and a presence, an origin and an agent message, each validating against its schema (AD-7).

#### Scenario: Every fixture validates
- **WHEN** the contract's tests validate each push delivery fixture
- **THEN** every one passes against its schema
