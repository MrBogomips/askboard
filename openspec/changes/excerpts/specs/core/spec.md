# Spec Delta

## ADDED Requirements

### Requirement: Context resolved when an ask or update is sent
When an `ask` or an `update` creates a question's revision, `ask-core` SHALL resolve every excerpt pointer, image pointer and reference pointer of that revision through its `SourceFiles` port, before the revision is stored, and SHALL keep the result with that revision until the revision is pruned (AD-12, FR-8).

#### Scenario: The board shows what was read at send time
- **WHEN** an ask holds an excerpt pointing at `docs/a.md#Intro`, and the file changes after the ask is sent
- **THEN** the board document of that revision still holds the section as it read at send time

#### Scenario: An update re-reads only what it changes
- **WHEN** an `update` changes question `q2` of an ask whose question `q1` also holds an excerpt
- **THEN** only `q2`'s pointers are read again, and `q1`'s board document is unchanged

### Requirement: The ask's root
The root a pointer resolves against SHALL be the `root` of the ask's origin when the ask has one (AD-5), else the session project root, the real path of `CLAUDE_PROJECT_DIR`. When `CLAUDE_PROJECT_DIR` is not set, every pointer SHALL resolve as unresolved with reason `no-root`, and no other folder SHALL stand in for it (AD-12).

#### Scenario: A subagent in its own worktree
- **WHEN** a subagent whose origin's root is its worktree asks with the pointer `src/retry.ts#L1-L5`
- **THEN** the excerpt is read from that worktree, not from the main checkout

#### Scenario: No project directory
- **WHEN** the session process runs without `CLAUDE_PROJECT_DIR` and an ask holds a pointer to a file in its working directory
- **THEN** the excerpt is unresolved with reason `no-root`, and the ask is created

#### Scenario: An owned ask without a project directory
- **WHEN** the session process runs without `CLAUDE_PROJECT_DIR` and an owned ask, whose origin gives a root, holds a pointer to a file in that root
- **THEN** the excerpt is unresolved with reason `no-root`, and no folder of the origin stands in for the project root

### Requirement: An unresolved pointer never blocks the board
A pointer that does not resolve SHALL leave the ask created or the update applied, its item marked unresolved with its reason in the board document, and SHALL add one `unresolved-pointer` warning naming the item to that call's result (FR-8, AD-6).

#### Scenario: One good and one missing excerpt
- **WHEN** an ask holds an excerpt pointing at an existing heading and one pointing at a missing file
- **THEN** the ask is created, the first excerpt is resolved, the second is unresolved with reason `not-found`, and the result carries one warning, for the second

### Requirement: Agent-written excerpts are kept as written
An excerpt given as `text` SHALL reach the board document exactly as the agent wrote it, read nothing from disk, and count as resolved (FR-8).

#### Scenario: Text that looks like markup
- **WHEN** an excerpt's text is `<script>alert(1)</script>`
- **THEN** the board document holds that text unchanged

### Requirement: A source's current state for the reading panel
`ask-core` SHALL answer, for a pointer excerpt or pointer reference of an ask's current board document, the file's current state: available, missing, outside the root, not text or too large; the current line of its anchor; and, for an excerpt, whether the excerpted range now differs from its text. It SHALL resolve and confine the pointer again under AD-12 against the ask's root (AD-8).

#### Scenario: A file edited since the ask
- **WHEN** the lines an excerpt was read from change after the ask was sent
- **THEN** the source's state says that the range changed

#### Scenario: An item that is not a pointer
- **WHEN** `board-host` asks for the source of an agent-written excerpt, an image or an unknown item
- **THEN** `ask-core` answers that there is no such source

### Requirement: The editor target is confined again at the click
For "Open in editor", `ask-core` SHALL give the file's absolute real path and an integer line only after resolving and confining the item's pointer again under AD-12 at that moment; a pointer that no longer resolves inside the root SHALL give no target (AD-8).

#### Scenario: A file swapped for a symlink after the send
- **WHEN** a referenced file is replaced by a symlink to a file outside the root after the ask was sent, and the user clicks "Open in editor"
- **THEN** `ask-core` gives no target and no editor starts

### Requirement: Discard drops resolved context
On discard, `ask-core` SHALL drop every revision's resolved context with its board documents, so no excerpt text or image bytes of a discarded ask stay in memory (AD-21).

#### Scenario: A discarded ask
- **WHEN** an ask holding an image is discarded
- **THEN** its tombstone holds no excerpt text and no image bytes
