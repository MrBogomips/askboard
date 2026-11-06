# Spec Delta

## ADDED Requirements

### Requirement: Taking a Snapshot
`ask-core` SHALL take a Snapshot of an open or closed ask on the agent's request or the board's: it SHALL gather the Snapshot's data in one step, as the ask stands at that moment, hand it to the Snapshot writer and return the file's path (FR-26, AD-15).

#### Scenario: A Snapshot of an open ask
- **WHEN** the agent asks for a Snapshot of an ask with one question answered and one open
- **THEN** the writer receives data holding the answer and the open question, and the path it returns is the result

#### Scenario: A Snapshot of a closed ask
- **WHEN** the board asks for a Snapshot of an ask the agent closed
- **THEN** the Snapshot is taken, with the ask's state `closed`

#### Scenario: An answer arrives while the file is written
- **WHEN** the user's answer is appended after the data is gathered but before the writer finishes
- **THEN** the Snapshot holds the ask as it stood before that answer

### Requirement: No Snapshot of a discarded ask
For a discarded ask, or an ask ID unknown to the current epoch, `ask-core` SHALL return `discarded` and SHALL hand nothing to the writer (FR-26, AD-10, AD-21).

#### Scenario: After the tab closed
- **WHEN** the agent asks for a Snapshot of an ask discarded after its board closed
- **THEN** the answer is `discarded`, and no file is written

#### Scenario: After a restart
- **WHEN** the agent asks for a Snapshot of an ask it sent before the session process restarted
- **THEN** the answer is `discarded`, never an error that the ask is unknown

### Requirement: What a Snapshot holds
The data SHALL hold the current board document, the revisions its events name, the board state the live board receives (threads, recorded and previous answers, receipts), the origin, every logged event with its answer's kept full values, and the expansion map when the ask holds molecules (AD-15; open questions A1 and A2).

#### Scenario: The context header as it stood
- **WHEN** a subagent's ask with a postponed question and a follow-up thread is snapshotted
- **THEN** the data names the subagent and its worktree, the ask's state, the question as postponed, and the follow-up with the agent's reply

#### Scenario: A recorded answer
- **WHEN** the agent recorded an answer with `update` and then takes a Snapshot
- **THEN** the data's board state shows the question answered and recorded, though no event holds it

#### Scenario: An answer on an older revision
- **WHEN** an answer names `rev` 1 of a question the agent then changed to `rev` 2 under an `ignore` edit choice
- **THEN** the data holds `rev` 1's props beside the current document, and the answer event names `rev` 1

### Requirement: What a Snapshot never holds
The data SHALL hold nothing of the draft record, no board or session token, no board link, no agent record or Claude Code identifier, and not the agent's working or waiting status (AD-15, AD-20, NFR-4).

#### Scenario: Unsent work at the time
- **WHEN** the board mirrors a draft with a ready answer and an open-prompt text, and the agent takes a Snapshot
- **THEN** the data holds neither, and the question is shown as the log leaves it

#### Scenario: The board link
- **WHEN** the data of any Snapshot is searched for the ask's board link and token
- **THEN** neither is found

### Requirement: Unsent work noted, never read
A Snapshot the board requests SHALL record `unsentWork: true` exactly when the request says so; `ask-core` SHALL NOT read its draft record to decide it (AD-15, AD-20).

#### Scenario: The board held unsent work
- **WHEN** the board asks for a Snapshot saying it holds unsent work
- **THEN** the data records `takenBy: "user"` and `unsentWork: true`, and nothing of the work

### Requirement: Only the owner's agent takes a Snapshot
An agent's request for a Snapshot of an owned ask SHALL pass the same owner check as `fetch`, and a refused request SHALL write nothing. A board's request carries no agent record and SHALL be taken for an open or closed ask (AD-5).

#### Scenario: Another subagent asks for a Snapshot
- **WHEN** a subagent asks for a Snapshot of an ask another subagent owns
- **THEN** the request is refused, naming the ask, and no file is written

#### Scenario: An unchecked ask
- **WHEN** an agent asks for a Snapshot of an ask that has no owner
- **THEN** the Snapshot is taken, and the outcome says the ask is unchecked

### Requirement: A Snapshot changes nothing
Taking a Snapshot, or failing to, SHALL append no event, SHALL NOT move `received`, and SHALL change neither the ask's state nor any question's (AD-3, open question A7).

#### Scenario: The user takes a Snapshot
- **WHEN** the user takes a Snapshot from the board and the agent then collects
- **THEN** the result holds no event for it, and the ask's cursor and state are as before
