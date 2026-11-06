# Spec Delta

## ADDED Requirements

### Requirement: A Snapshot requested by the board
`board-host` SHALL accept a `snapshot` message on an ask's live board connection while the ask is open or closed, have `ask-core` take the Snapshot as the user's, and answer `snapshot-saved` with the request's ID and the file's absolute path (FR-26, AD-15).

#### Scenario: The user takes a Snapshot
- **WHEN** the board page sends `snapshot` with request ID `r1` on an open ask
- **THEN** a new file exists in the Snapshot folder, and the page receives `snapshot-saved` naming `r1` and that file's path

#### Scenario: A closed ask
- **WHEN** the board page of an ask the agent closed sends `snapshot`
- **THEN** the Snapshot is taken and `snapshot-saved` answers, though every act on that board is refused

### Requirement: A board's Snapshot that fails
When the Snapshot cannot be written, `board-host` SHALL answer `snapshot-failed` with the request's ID, the reason `write-failed` and the Snapshot folder's path; when the session has no project root, with the reason `no-project-root`; when the ask was discarded meanwhile, with the reason `discarded`, before the board learns of the discard (FR-26, NFR-10, AD-12).

#### Scenario: The folder cannot be written
- **WHEN** the board page sends `snapshot` and the Snapshot folder is not writable
- **THEN** the page receives `snapshot-failed` naming the request, `write-failed` and the folder

#### Scenario: No project root
- **WHEN** the board page sends `snapshot` in a session process started without `CLAUDE_PROJECT_DIR`
- **THEN** the page receives `snapshot-failed` naming the request and `no-project-root`, and no file is written

### Requirement: A board's Snapshot AskBoard fails to take
When `ask-core` fails to take a board's Snapshot for any cause other than the folder, the project root or a discard, such as a damaged view build, `board-host` SHALL report the error and answer `snapshot-failed` with the request's ID and the reason `internal-error`, naming no folder, so every request on a live connection gets one reply (FR-26, NFR-10).

#### Scenario: The view build is damaged
- **WHEN** the board page sends `snapshot` and the view build cannot be loaded
- **THEN** the page receives `snapshot-failed` naming the request and `internal-error`, the error is reported, no file is written, and the board stays open

### Requirement: Unsent work passed on as a fact
`board-host` SHALL pass the request's `unsentWork` to `ask-core` as it came, and SHALL NOT consult the mirrored draft record for a Snapshot (AD-15, AD-20).

#### Scenario: The page says it holds unsent work
- **WHEN** the board page sends `snapshot` with `unsentWork: true`
- **THEN** the Snapshot's data records `unsentWork: true`, and holds nothing of the draft

### Requirement: A board's Snapshot is no event
A Snapshot the board takes SHALL reach the agent only as a file in the Snapshot folder: no event, no push and no `collect` entry (FR-26, open question A7).

#### Scenario: The agent collects after the user's Snapshot
- **WHEN** the user takes a Snapshot from the board and the agent collects with its last cursor
- **THEN** the result holds no event, and the file is in the Snapshot folder
