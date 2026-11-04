# Spec Delta

## ADDED Requirements

### Requirement: Assembling a Snapshot
The one `assemble` function SHALL build a Snapshot from Snapshot data: the charset, the view policy as a meta tag, the `askboard-data` block with every `<` escaped, the styles and scripts of the chunks the board's current document needs, then the licence notices. The same input SHALL give the same output (AD-9, AD-15, A3).

#### Scenario: The data block is found without rendering
- **WHEN** the text between `id="askboard-data">` and the next `</script>` of a Snapshot is parsed as JSON
- **THEN** it is the Snapshot data, and it validates against the `snapshot-data` schema

#### Scenario: Agent text that closes a script
- **WHEN** a question's text holds `</script><script>alert(1)</script>` and a Snapshot is assembled
- **THEN** the file holds that text only inside the data block, escaped, and opening the file runs no script but AskBoard's

### Requirement: No view-protocol code in a Snapshot
The view build SHALL mark the ext-apps chunk as needed only with a host, and the shell SHALL reach ext-apps' `App` only when it has a parent. `assemble` SHALL add host-only chunks to a board's srcdoc and leave them out of a Snapshot (AD-9).

#### Scenario: A board and its Snapshot
- **WHEN** one plain-question board is assembled as a srcdoc and as a Snapshot
- **THEN** the srcdoc holds the ext-apps chunk and the Snapshot does not, and the board still connects to its board page

### Requirement: Kept diagram renders in a Snapshot
For a component chunk that names a kept-render chunk, `assemble` SHALL inline the kept-render chunk instead when every item of that component has a kept render in the data, and both when any lacks one (AD-9, open question B3).

#### Scenario: Every diagram has its renders
- **WHEN** a fixture board with two probe diagrams, both with kept renders, is assembled as a Snapshot
- **THEN** the file holds the probe kept-render chunk and not the probe renderer chunk

#### Scenario: One diagram never rendered
- **WHEN** one of the two probe diagrams has no kept render
- **THEN** the file holds both chunks

### Requirement: Licence notices in a Snapshot
A Snapshot SHALL end with the `askboard-licences` JSON block listing, for each package whose code it inlines, its name, version, licence and notice text, with every `<` escaped (AD-15, NFR-6).

#### Scenario: The notices match the chunks
- **WHEN** a plain-question Snapshot is assembled
- **THEN** its notices are exactly those the manifest gives for the chunks it inlines, React's included, and ext-apps' are absent

### Requirement: The Snapshot control
The bottom action bar SHALL offer "Snapshot" on every board, the single-question board included, while the ask is open or closed; it SHALL be disabled while the connection is lost and absent once the ask is discarded. Its feedback SHALL show the saved file's path, or the failure with the Snapshot folder's path, or, when the session has no project root, a failure naming `CLAUDE_PROJECT_DIR`, or, for `internal-error`, that no Snapshot was taken (FR-26, AD-12).

#### Scenario: Taking a Snapshot from a single-question board
- **WHEN** the user presses "Snapshot" on the golden single-question board
- **THEN** the bar shows the saved file's path, and the file is in the Snapshot folder

#### Scenario: The connection is lost
- **WHEN** the board shows "Connection lost, retrying"
- **THEN** "Snapshot" is disabled, and no request leaves the page

### Requirement: A Snapshot not confirmed
A request whose connection drops, or whose reply has not come after `SNAPSHOT_REPLY_WAIT_MS`, SHALL end with feedback saying the Snapshot was not confirmed, never that it was saved or that none was taken, and SHALL NOT be sent again (FR-26, NFR-10).

#### Scenario: The connection drops while a Snapshot is taken
- **WHEN** the user presses "Snapshot" and the connection drops before the reply
- **THEN** the feedback says the Snapshot was not confirmed, and the request is not sent again on the new connection

### Requirement: A Snapshot from a closed board
The Closed banner SHALL offer "Snapshot", which takes the Snapshot as the bar's control does and shows its feedback beside it; the Discarded banner SHALL offer none (FR-26, EXPERIENCE Board banner).

#### Scenario: The agent closed the ask
- **WHEN** the user presses "Snapshot" on the Closed banner
- **THEN** the banner shows the saved file's path

#### Scenario: A discarded board
- **WHEN** the ask is discarded while its tab is open
- **THEN** no "Snapshot" control shows on the board or its banner

### Requirement: The unsent-work note
When the user takes a Snapshot while the board holds unsent work, the board SHALL show "Your unsent work will not be in the Snapshot" with the feedback, take the Snapshot without asking to confirm, and say in the request that unsent work existed (AD-15, open question B5).

#### Scenario: A ready answer not yet submitted
- **WHEN** the user takes a Snapshot in submitted delivery with a ready answer held
- **THEN** the note shows, the Snapshot is taken, and the opened file says the unsent work is not included and shows the question unanswered

### Requirement: Opening a Snapshot
A Snapshot opened from disk SHALL boot from its data block with no parent host and no view-protocol handshake, show the board in its final state with no network and no AskBoard running, request nothing, and raise no CSP violation, in Chromium, Firefox and WebKit (FR-27, AD-8, AD-9).

#### Scenario: Offline, AskBoard stopped
- **WHEN** a Snapshot is opened from `file://` in each engine, offline, after the session process has exited
- **THEN** the board shows, the page made no request, and no CSP violation was reported

#### Scenario: A script file beside the Snapshot
- **WHEN** a script file is placed in the Snapshot's folder and the Snapshot is opened in Firefox
- **THEN** that script never runs

### Requirement: The Snapshot view's chrome
An opened Snapshot SHALL start with the line "Snapshot · taken <when> by <whom> · read-only", noting unsent work when the data records it; it SHALL hide Answer, Postpone, More, "Ask a follow-up", Settings, the density switch, the bottom action bar and the agent pill, and keep the ask state pill and delivery receipts (EXPERIENCE Snapshots).

#### Scenario: The agent's Snapshot
- **WHEN** the agent's Snapshot of an answered ask is opened
- **THEN** the top line says it was taken by the agent, the header shows "answered" and no agent state, and no answer control is shown

### Requirement: Read-only and navigable
In an opened Snapshot every item SHALL render disabled, answers and the open prompt in the read-only look of a reopened question's previous answer, postponed questions marked, threads shown without a composer; tabs, navigators, expand and collapse SHALL work, and nothing SHALL be answerable or sent (FR-27).

#### Scenario: Switching and expanding
- **WHEN** the user switches tabs and jumps to a postponed question in an opened Snapshot
- **THEN** the board follows, the question shows as postponed, and no control accepts an answer

### Requirement: Theme in a Snapshot
An opened Snapshot SHALL start in the viewer's system theme and offer a Theme control that switches it and saves nothing; the page SHALL use no browser storage (EXPERIENCE Dark theme, AD-8).

#### Scenario: Dark system theme
- **WHEN** a Snapshot is opened with the system set to dark and the user switches to Light
- **THEN** the board shows in dark, then in light, and reopening the file shows it dark again
