# Spec Delta

## MODIFIED Requirements

### Requirement: Creating an ask
When an ask passes validation, `ask-core` SHALL store every question at revision 1 in the ask's board document, in the areas and order the ask gives, set every question `open` and the ask `waiting`, and return the ask's first cursor `<epoch>.0` with its board link.

#### Scenario: A plain ask is created
- **WHEN** the plain-choice fixture is sent as an ask
- **THEN** the ask is `waiting`, its question has `rev` 1, and the result's cursor is `<epoch>.0`

#### Scenario: An ask with areas is created
- **WHEN** an ask of two areas holding five questions is sent
- **THEN** the board document holds both areas in order, every question at `rev` 1 and `open`

### Requirement: Answers only from an explicit user action
An answer event SHALL come only from an answer or decline act of the board on a question of an open ask, naming the question's current `rev`, or an older one the user kept (edit choice), and content that revision can hold: option labels, one unless `multiSelect` is set, "Other…" text only with `allowOther`, and at least a label or "Other…" text unless it declines. Any other act SHALL be refused and append nothing (AD-10, NFR-10).

#### Scenario: A valid answer is appended
- **WHEN** the board sends an answer to question `database` with `rev` 1 and `choice: ["PostgreSQL"]`
- **THEN** one answer event is appended, carrying that choice, and the question becomes `answered`

#### Scenario: An answer the question cannot hold
- **WHEN** an answer names a label that is not an option, two labels on a single-choice question, "Other…" text on a question without `allowOther`, no label and no "Other…" text, a `rev` that is not current and not kept, or a `when` that is no real time, such as `2026-02-30T10:00:00Z`
- **THEN** it is refused and the log is unchanged

#### Scenario: An answer to a closed ask
- **WHEN** the board sends an answer after the agent closed the ask
- **THEN** it is refused, the log is unchanged, and the board is told the ask is closed

### Requirement: Who and when
Answers, notes and follow-ups the board sends SHALL carry `when`, the time of the user's action as the board stamped it, in RFC 3339 UTC, and `who`: the ask's `expectedUser`, else the git user name of the session project, else the operating system's login name. An answer the agent records SHALL take the same `who` and the core's time as `when` (FR-19).

#### Scenario: No expected user and no git user
- **WHEN** an ask names no `expectedUser` and the project has no git user name
- **THEN** its answer's `who` is the operating system's login name

#### Scenario: A recorded answer
- **WHEN** the agent records an answer with `update`
- **THEN** the answer's `who` follows the same rule and its `when` is the core's time of the update

## ADDED Requirements

### Requirement: Question states
Each question SHALL be `answered` or `declined` while its latest answer, logged or recorded, says so; `postponed` while a logged postpone of it is not undone; and `open` otherwise. A reopen by the agent or the user SHALL make it `open` (AD-10).

#### Scenario: A postponed question
- **WHEN** the user postpones question `erp-export`
- **THEN** its state is `postponed` until the user answers, declines or undoes it, or the agent records an answer or deletes it

### Requirement: Ask states
An open ask SHALL be `waiting` until its first answer, decline or postpone; `answered` while every question that is not postponed is answered or declined and at least one is; `partly-answered` otherwise. Closing SHALL make it `closed` and a discard `discarded`. An answered ask SHALL become `partly-answered` again when a question is added or reopened (AD-10).

#### Scenario: Answered with one postponed
- **WHEN** of three questions two are answered and one is postponed
- **THEN** the ask is `answered`

#### Scenario: Every question postponed
- **WHEN** the user postpones the only question of an ask
- **THEN** the ask is `partly-answered`, never `answered`

#### Scenario: The user reopens a declined question
- **WHEN** the user undoes a logged decline on an answered ask
- **THEN** the ask becomes `partly-answered`

### Requirement: One command, applied once
`ask-core` SHALL apply an `act` command at most once per action ID within its ask: a command whose action ID it has applied SHALL append nothing and SHALL be acknowledged as before. A command without an action ID SHALL be handled as E1's answer command, refused when its question is answered.

#### Scenario: A submit retried after a drop
- **WHEN** the board resends a submit with the action ID of one already appended
- **THEN** the log holds its events once, and the board is told the submit landed

### Requirement: Atomic commands
The acts of one command SHALL each be checked against the state the earlier acts leave, then appended together, in order and with consecutive sequence numbers, or not at all; one refused act SHALL refuse the whole command, naming the act (AD-20).

#### Scenario: A submit with a stale question
- **WHEN** a submit holds three acts and the second names a revision the agent has just replaced
- **THEN** nothing is appended, and the refusal names the second act and its question

### Requirement: Postponing
A postpone act SHALL apply only to an `open` question at its current `rev`, and SHALL append a `postponed` event (FR-4).

#### Scenario: Postponing an answered question
- **WHEN** the board postpones a question whose answer is logged
- **THEN** the act is refused and the log is unchanged

### Requirement: Declining
A decline act SHALL apply to a question of an open ask at its current `rev`, and SHALL append an answer event with `declined: true` and the optional reason as `note`; it closes the question like an answer and supersedes an earlier answer (AD-20).

#### Scenario: Declining with a reason
- **WHEN** the user declines question `erp-export` with the reason "Not my call"
- **THEN** an answer event with `declined: true` and `note: "Not my call"` is appended, and the question is `declined`

### Requirement: Undoing a sent postpone or decline
A reopen act SHALL apply to a `postponed` or `declined` question whose postpone or decline is logged, and SHALL append a `reopened` event; the question becomes `open` (FR-4, AD-20).

#### Scenario: Undoing a logged postpone
- **WHEN** the user undoes the logged postpone of `erp-export`
- **THEN** a `reopened` event is appended and the question is `open`

### Requirement: A note without an answer
A note act SHALL append a `note` event carrying the open-prompt text for an `open` or `postponed` question at its current `rev`, and SHALL leave the question's state as it was (FR-7).

#### Scenario: Feedback alone
- **WHEN** the user sends only a note on an open question
- **THEN** a `note` event is appended and the question is still `open`

### Requirement: Follow-ups
A follow-up act SHALL append a `follow-up` event on any question of an open ask, whatever its state, and SHALL change neither the question's `rev` nor its state (FR-10).

#### Scenario: A follow-up on an answered question
- **WHEN** the user writes a follow-up on an answered question
- **THEN** a `follow-up` event is appended and the question stays `answered`

### Requirement: Revising an answer
An answer or decline to a question whose latest answer is logged SHALL append a new answer event that names that answer's cursor in `replaces`; the latest answer per question holds (FR-22, AD-20).

#### Scenario: The user changes a sent answer
- **WHEN** the user answers `database` with `SQLite` after `PostgreSQL` was logged at `<epoch>.1`
- **THEN** a new answer event with `replaces: "<epoch>.1"` is appended, and `fetch` returns `SQLite`

### Requirement: Revisions of a question
Each question SHALL have a `rev` that starts at 1 and increments with every change the agent makes to it or to an item inside it, and with a reopen; a reply SHALL NOT increment it. `ask-core` SHALL keep every revision an event names until the ask is discarded (AD-20).

#### Scenario: A reply leaves the revision
- **WHEN** the agent replies to a follow-up on a question at `rev` 2
- **THEN** the question is still at `rev` 2

### Requirement: Edit choice
An edit-choice act SHALL name the question's current `rev` and append an `edit-choice` event: `reload`, or `ignore` with the earlier `rev` it keeps. While the log holds an `ignore` for the current `rev`, an answer or decline naming the kept `rev` SHALL be checked against that revision and accepted (FR-6, AD-20).

#### Scenario: The user keeps their work
- **WHEN** the agent changes question `q3` to `rev` 2 while the user has unsent work at `rev` 1, and the user chooses to ignore the update and answers
- **THEN** the log holds the `ignore` edit choice keeping `rev` 1, then the answer naming `rev` 1

#### Scenario: An old revision without the choice
- **WHEN** an answer names `rev` 1 of a question at `rev` 2 and the log holds no `ignore` keeping `rev` 1 for `rev` 2
- **THEN** it is refused

### Requirement: Updates apply atomically
`update` SHALL apply its actions in order, each checked against the state the earlier ones leave; one refused action SHALL leave the ask unchanged and refuse the update, naming the action's index and item ID (AD-6).

#### Scenario: A second action refused
- **WHEN** an update adds a question, then changes a question whose answer is logged
- **THEN** neither applies, and the refusal names action 1 and the answered question

### Requirement: Adding an item
An `add` SHALL insert a question into the area `parentId` names, or at the top level without `parentId`, and an area at the top level, after the sibling `after` names, or first without `after`, as `changes` places elements; the all-or-none rule for areas holds. A new question SHALL start at `rev` 1, `open`. An item ID in use in the ask, deleted ones included, SHALL be refused (FR-5, FR-6).

#### Scenario: Adding first and adding last
- **WHEN** the agent adds question `q0` with no `after`, and question `q9` with `after` naming the last question
- **THEN** `q0` comes first and `q9` last in the board document

#### Scenario: A question added to an answered ask
- **WHEN** the agent adds a question to an `answered` ask
- **THEN** the question is `open` at `rev` 1, and the ask is `partly-answered`

#### Scenario: Reusing a deleted item's ID
- **WHEN** the agent adds an item with the ID of an item it deleted earlier
- **THEN** the update is refused, naming the ID as in use

### Requirement: Changing an item
A `change` SHALL merge the given props into the item's props key by key, each given key replacing the old value whole, check the result against the input format, and increment the `rev` of the question it is or sits in. A question whose latest answer or decline is logged or recorded SHALL NOT change unless reopened, and the refusal SHALL name that answer (AD-20).

#### Scenario: Rewording an open question
- **WHEN** the agent changes the text of an open question at `rev` 1
- **THEN** the question is at `rev` 2 with the new text and its other props as they were

#### Scenario: Changing an answered question
- **WHEN** the agent changes a question whose answer is logged at `<epoch>.3`
- **THEN** the update is refused, naming `<epoch>.3` and saying that the question must be reopened first

### Requirement: Deleting an item
A `delete` SHALL remove an item and everything in it. It SHALL be refused for a question whose latest answer or decline is logged or recorded, for an area holding one, and when no question would remain. A deleted question SHALL leave every count, and an ask whose other questions are all answered or declined SHALL become `answered` (FR-4, FR-6).

#### Scenario: Deleting a postponed question
- **WHEN** the agent deletes the only postponed question of an ask whose other questions are answered
- **THEN** the question is gone and the ask is `answered`

#### Scenario: Deleting the last question
- **WHEN** the agent deletes the only question of an ask
- **THEN** the update is refused, saying to close the ask instead

### Requirement: Reopening a question
A `reopen` SHALL apply to a question whose latest answer or decline is logged or recorded, and SHALL start a new `rev` with no answer, keeping the previous answer for the board to show. An `answered` ask SHALL become `partly-answered` (AD-10, AD-20).

#### Scenario: Reopening a recorded verdict
- **WHEN** the agent reopens question `offer`, answered at `rev` 1
- **THEN** `offer` is `open` at `rev` 2 with no answer, and its `rev` 1 answer is kept as its previous answer

### Requirement: Recording an answer
An `update` `answer` SHALL record the user's answer to an `open` or `postponed` question at its current `rev`, checked as a board answer would be, marked as recorded. It SHALL append no event: the `update` result reports it, and the question becomes `answered` (FR-6, FR-19; open question 3).

#### Scenario: The user answered in the terminal
- **WHEN** the agent records `choice: ["Yes"]` on the postponed question `erp-export`
- **THEN** the question is `answered`, marked as recorded, the log is unchanged, and no `collect` returns it

### Requirement: Replies to follow-ups
A `reply` SHALL append the agent's text to the follow-up thread of its question, under the follow-up whose cursor `followUp` names, which SHALL be a `follow-up` event of that question in the current epoch. It SHALL append no event (FR-10, AD-20).

#### Scenario: A reply to an unknown follow-up
- **WHEN** a reply names a cursor that is not a follow-up of that question
- **THEN** the update is refused, naming the cursor

### Requirement: Closing an ask
A `close` SHALL make an open ask `closed` with reason `agent`, wake its waiting `collect` calls, refuse every later act and update, keep its board documents, log and full values until the session process exits, and never discard it (FR-6, AD-21).

#### Scenario: The agent closes the ask
- **WHEN** the agent closes an ask with one question still open
- **THEN** the ask is `closed`, its board is told so, and a later answer from the board is refused

### Requirement: The draft record
`ask-core` SHALL hold one draft record per ask, replaced whole by each draft message from its live board, apart from the log. Only `board-host` restoring it to the ask's board SHALL read it: no tool result, event or other unit (AD-20).

#### Scenario: Unsent work stays unsent
- **WHEN** the board mirrors a draft with a ready answer and the agent collects
- **THEN** the result holds no event and no field from the draft

### Requirement: Grace timer
`ask-core` SHALL start the grace timer when the last live connection of an open ask that has connected before closes, cancel it when a board connects, and discard the ask with reason `board-closed` when it ends. A closed ask and an ask never connected SHALL start no timer (AD-21).

#### Scenario: A reload
- **WHEN** a board reloads and reconnects within the grace period
- **THEN** the ask is still open, with its draft record

#### Scenario: The tab is closed
- **WHEN** a board's only connection closes and no board connects within the grace period
- **THEN** a `discarded` event with reason `board-closed` is appended and waiting `collect` calls return

### Requirement: Tombstone
On a discard, `ask-core` SHALL drop the ask's board documents, revisions, threads, draft record and action IDs, and keep its ID, epoch, state, `received` and the events the agent has not acknowledged, dropping each once a read names a cursor at or above it. The ID SHALL stay in use until the session process exits (AD-21, FR-5).

#### Scenario: An answer logged before the discard
- **WHEN** an ask is discarded after an answer was logged but before the agent collected it
- **THEN** a `collect` returns the answer, then the `discarded` event

### Requirement: Full value of an item
`ask-core` SHALL return, for an item of an open or closed ask's current board document, its type and props, with its `rev` when it is a question, and for a question its state and current answer in full: its content, `who`, `when`, whether it was recorded, and the cursor of its event when logged (FR-20).

#### Scenario: A deleted item
- **WHEN** the full value of a deleted item is asked for
- **THEN** none is returned, and the item is reported as deleted
