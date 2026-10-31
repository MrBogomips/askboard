# Spec Delta

## Purpose

The `snapshot` unit writes Snapshots: one self-contained HTML file per Snapshot, built through `assemble`, in the project's Snapshot folder, never overwriting a file and never written outside the project (FR-26, FR-27, AD-15).

## ADDED Requirements

### Requirement: The Snapshot folder
Snapshots SHALL be written into `.askboard/snapshots/` under the session project root, the real path of `CLAUDE_PROJECT_DIR`, else the session process's working folder. When `.askboard/` or the folder is missing, the unit SHALL create it before writing (FR-27, AD-14).

#### Scenario: The first Snapshot of a project
- **WHEN** an agent takes a Snapshot in a project that has no `.askboard/` folder
- **THEN** the file is written into `.askboard/snapshots/` under the project root, and both folders exist afterwards

#### Scenario: A subagent in another worktree
- **WHEN** a subagent whose ask's root is a worktree of the project takes a Snapshot
- **THEN** the file is written under the session project root, not under the worktree

### Requirement: Ignored by git by default
When the unit writes a Snapshot and `.askboard/.gitignore` does not exist, it SHALL create that file listing `snapshots/`, `media/`, `patches/` and `bench/`; an existing `.askboard/.gitignore` SHALL be left as it is, so a user's choice to commit Snapshots holds (FR-27, AD-14).

#### Scenario: No ignore file yet
- **WHEN** the first Snapshot is written in a project whose `.askboard/` has no `.gitignore`
- **THEN** `.askboard/.gitignore` lists the four folders, and `git status` in that project does not show the Snapshot

#### Scenario: The user chose to commit Snapshots
- **WHEN** `.askboard/.gitignore` exists without `snapshots/` and a Snapshot is written
- **THEN** the file is unchanged, and `git status` shows the new Snapshot

### Requirement: Never outside the project
The unit SHALL refuse to write when the Snapshot folder's real path is not inside the session project root's real path, as when `.askboard` or `snapshots` is a symbolic link leading out of the project, and SHALL report the failure naming the folder (AD-14, NFR-5).

#### Scenario: A link out of the project
- **WHEN** `.askboard/snapshots` is a symbolic link to a folder outside the project and a Snapshot is taken
- **THEN** nothing is written outside the project, and the failure names the Snapshot folder

### Requirement: The file's name
Each Snapshot SHALL be named `<ask-id>-<UTC timestamp>-<short random>.html`, the timestamp in the basic ISO 8601 form `YYYYMMDDTHHMMSSZ` with no colon, and the random part 6 characters from `[a-z0-9]`, so the name is valid on macOS, Linux and Windows drives under WSL (AD-15, NFR-7).

#### Scenario: A name AskBoard chooses
- **WHEN** the agent takes a Snapshot of `offer-k3x9` at 2026-10-31T16:12:05Z
- **THEN** the file's name matches `offer-k3x9-20261031T161205Z-[a-z0-9]{6}.html`

### Requirement: Never overwriting a file
The unit SHALL never replace or change an existing file: when the chosen name exists, it SHALL draw another random part, and after five names in use it SHALL fail. No file SHALL appear under its final name until it is complete (AD-15).

#### Scenario: The name is taken
- **WHEN** a file already holds the name chosen for a new Snapshot
- **THEN** that file is unchanged, and the Snapshot is written under another name

#### Scenario: Two Snapshots in the same second
- **WHEN** the agent and the user take a Snapshot of one ask in the same second
- **THEN** two files exist, each complete, with different names

### Requirement: One self-contained file
A Snapshot SHALL be one HTML file built by `assemble` from the Snapshot's data and the view build the session process serves, holding the chunks the board uses and the licence notices of the code it inlines. It SHALL load nothing else, and SHALL hold no board token and no session token (FR-27, NFR-4, AD-15).

#### Scenario: Opened elsewhere
- **WHEN** a Snapshot file is copied alone to another folder and opened in a browser with no network
- **THEN** it shows the board, and the browser requests nothing

#### Scenario: No token in the file
- **WHEN** the bytes of any Snapshot are searched for the ask's board token and the session token
- **THEN** neither is found

### Requirement: Write failures
When a Snapshot cannot be written, the unit SHALL leave no file under a final name, remove what it wrote, and report the failure with the Snapshot folder's path and the reason; a diagnostic on stderr SHALL name neither agent content nor a token.

#### Scenario: A read-only folder
- **WHEN** the Snapshot folder is not writable and a Snapshot is taken
- **THEN** the failure names the folder and the reason, and the folder holds no new file

### Requirement: Snapshots outlive their ask
AskBoard SHALL never delete, move or change a Snapshot it wrote: not on discard, not when the ask closes, not when the session process exits (FR-27).

#### Scenario: After the session ends
- **WHEN** an agent takes a Snapshot and the session process then exits, discarding the ask
- **THEN** the file is still there, unchanged, and still opens
