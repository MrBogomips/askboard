# Spec Delta

## MODIFIED Requirements

### Requirement: Tool list
The session process SHALL list exactly `ask`, `update`, `collect`, `fetch` and `snapshot`, in that order, with the input schemas, descriptions and annotations of the approved model contract, and the list SHALL NOT change during a session. Each description, and the server instructions, SHALL stay within 4,096 characters, and each full tool name within 128.

#### Scenario: Listing the tools
- **WHEN** a client lists the tools
- **THEN** it receives `ask`, `update`, `collect`, `fetch` and `snapshot`, in that order, matching the approved definitions of the contract fixtures

#### Scenario: A definition grows too long
- **WHEN** a tool description or the server instructions exceed 4,096 characters
- **THEN** the adapter's tests fail

## ADDED Requirements

### Requirement: Taking a Snapshot with the tool
`snapshot` SHALL take a Snapshot of the ask it names and return the versions, epoch, ask ID, the ask's state as captured and the file's absolute path, never the file's content. It SHALL take no path and accept no field but `askId` (AD-6, AD-15, FR-26).

#### Scenario: After the user answered
- **WHEN** the user has answered and the agent calls `snapshot` with the ask's ID
- **THEN** the result names the path of a new file under `.askboard/snapshots/` and the state `answered`, and holds none of the file's content

#### Scenario: A path in the request
- **WHEN** an agent calls `snapshot` with `askId` and `path`
- **THEN** the result is an error naming `path`, and no file is written

### Requirement: Snapshot of a discarded ask
`snapshot` on a discarded ask, or on an ask ID unknown to the current epoch, SHALL return the typed result `discarded`, naming the ask and saying that it was discarded (FR-26, AD-10, AD-21).

#### Scenario: The board was closed
- **WHEN** an agent calls `snapshot` on an ask whose board was closed past the grace period
- **THEN** the result is `discarded` for that ask, not an error, and no file is written

### Requirement: Snapshot refusals
A `snapshot` call that E4's owner check refuses, as it refuses `fetch`, SHALL return an error naming the ask; a Snapshot refused because the session has no project root SHALL return an error naming `CLAUDE_PROJECT_DIR`; a Snapshot that cannot be written SHALL return an error naming the Snapshot folder and the reason. None SHALL write a file (AD-5, AD-6, AD-12).

#### Scenario: Another agent's ask
- **WHEN** a subagent calls `snapshot` on an ask the main conversation owns
- **THEN** the result is an error naming the ask as another agent's, and no file is written

#### Scenario: The folder cannot be written
- **WHEN** the Snapshot folder is not writable
- **THEN** the result is an error naming the folder and the reason

#### Scenario: No project root
- **WHEN** an agent calls `snapshot` in a session process started without `CLAUDE_PROJECT_DIR`
- **THEN** the result is an error naming `CLAUDE_PROJECT_DIR`, and no file is written

### Requirement: Snapshot of an unchecked ask
The result of `snapshot` on an ask that has no owner SHALL carry `unchecked: true`, as `collect`'s entry for that ask does (AD-5).

#### Scenario: A session without hooks
- **WHEN** an agent in a session whose hooks do not run calls `snapshot`
- **THEN** the result names the path and carries `unchecked: true`

### Requirement: The tool reads nothing to the agent
`snapshot` SHALL NOT raise `received`, SHALL return no event, and SHALL leave the agent's cursor covering every event it has not collected (AD-3).

#### Scenario: An answer not yet collected
- **WHEN** an answer is logged, the agent calls `snapshot`, then `collect` after its last cursor
- **THEN** `collect` returns the answer
