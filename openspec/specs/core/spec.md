# core Specification

## Purpose
The core owns asks, their board documents, their states and one append-only event log per ask, so that every answer reaches the agent exactly as the user gave it, once, or the agent learns that it never will (AD-3, AD-10).

## Requirements

### Requirement: Epoch
Each session process SHALL have its own random `epoch`. Ask IDs SHALL be scoped to it, and every tool result SHALL carry it (AD-2, AD-10).

#### Scenario: Two session processes
- **WHEN** two session processes start, in one Claude Code session after a restart or in two sessions
- **THEN** their epochs differ

### Requirement: Creating an ask
When an ask passes validation, `ask-core` SHALL store its question as revision 1 of the ask's board document, set the ask to `waiting`, and return the ask's first cursor `<epoch>.0` with its board link.

#### Scenario: A plain ask is created
- **WHEN** the plain-choice fixture is sent as an ask
- **THEN** the ask is `waiting`, its question has `rev` 1, and the result's cursor is `<epoch>.0`

### Requirement: Derived title
An ask without `title` SHALL take its title from its first question's text, cut at the contract's title length with an ellipsis (FR-1).

#### Scenario: Title from the question
- **WHEN** an ask without `title` asks "Which database should the order service use?"
- **THEN** the ask's title is that text

#### Scenario: A long question is cut
- **WHEN** the first question's text is longer than the contract's title length
- **THEN** the title is the text cut to that length, ending in an ellipsis

### Requirement: One append-only event log per ask
Only `ask-core` SHALL append to an ask's log. Events SHALL be immutable, concern one ask and at most one item, and carry a per-ask `seq` that strictly increases; a cursor is exactly `<epoch>.<seq>` (AD-3).

#### Scenario: Sequence numbers increase
- **WHEN** two events are appended to one ask
- **THEN** the second's `seq` is greater than the first's, and neither event changes afterwards

### Requirement: Answers only from an explicit user action
An answer event SHALL come only from the board's answer command for an open question, naming its current `rev` and a non-empty `choice` of the question's option labels, one label unless `multiSelect` is set. Any other answer command SHALL be refused and append nothing (AD-10, NFR-10).

#### Scenario: A valid answer is appended
- **WHEN** the board sends an answer to question `database` with `rev` 1 and `choice: ["PostgreSQL"]`
- **THEN** one answer event is appended, carrying that choice, and the ask becomes `answered`

#### Scenario: An answer the question cannot hold
- **WHEN** an answer names a label that is not an option, two labels on a single-choice question, an empty choice, a `rev` that is not current, or a `when` that is no real time, such as `2026-02-30T10:00:00Z`
- **THEN** it is refused and the log is unchanged

#### Scenario: A second answer to an answered question
- **WHEN** the board sends a second answer to a question already answered, as a retry after a dropped connection
- **THEN** it is refused, the log keeps the first answer only, and the board is told the answer it holds

### Requirement: Who and when
An answer SHALL carry `when`, the time of the user's answer action as the board stamped it, in RFC 3339 UTC, and `who`: the ask's `expectedUser`, else the git user name of the session project, else the operating system's login name (FR-19).

#### Scenario: No expected user and no git user
- **WHEN** an ask names no `expectedUser` and the project has no git user name
- **THEN** its answer's `who` is the operating system's login name

### Requirement: Reading events after a cursor
`ask-core` SHALL return, for an ask and a cursor of the current epoch, the ask's state, its latest cursor and the events after that cursor, each with the cursor that follows it. A cursor of another epoch SHALL return the ask as `discarded`, with no events (AD-3, AD-10).

#### Scenario: Events after a cursor
- **WHEN** the events of an answered ask are read after `<epoch>.0`
- **THEN** the result holds its answer event with cursor `<epoch>.1`, and state `answered`

#### Scenario: A cursor from before a restart
- **WHEN** an ask is read with a cursor whose epoch is not the current one
- **THEN** the ask is reported `discarded`, never as having no answer yet

### Requirement: Received watermark
Per ask, `ask-core` SHALL keep a `received` watermark that only increases: the highest `seq` a read has returned. When it passes an answer's event, `board-host` SHALL be told, so that the board marks that answer delivered to the agent (AD-3).

#### Scenario: Collecting raises the watermark
- **WHEN** a read returns the answer event with `seq` 1
- **THEN** `received` becomes 1 and the board is told that the answer was delivered

#### Scenario: An older cursor does not lower it
- **WHEN** a later read passes cursor `<epoch>.0` again
- **THEN** `received` stays 1

### Requirement: Re-sending an ask
An `ask` with the ID of an open ask SHALL return that ask's board, opening nothing, only when the request is deep-equal to the first accepted one after RFC 8785 canonicalization. Any other `ask` with the ID of an ask of the current epoch SHALL be refused, naming the ID as in use (AD-6, FR-5).

#### Scenario: An identical resend
- **WHEN** an agent sends the same ask again after a dropped connection
- **THEN** the result returns the same board link and cursor, and no second board opens

#### Scenario: A different ask under a used ID
- **WHEN** an ask reuses the ID of an open or discarded ask with other content
- **THEN** it is refused, naming the ID as in use

### Requirement: Discard at session exit
When the session process exits, `ask-core` SHALL append a final `discarded` event with reason `session-exit` to every open ask, and its live boards SHALL be told before the process ends (AD-2, AD-21, FR-25).

#### Scenario: The session ends with an open board
- **WHEN** stdin closes while a board of a `waiting` ask is connected
- **THEN** the board shows the ask as discarded and accepts no more answers
