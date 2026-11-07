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
When an ask passes validation, `ask-core` SHALL store every question at revision 1 in the ask's board document, in the areas and order the ask gives, set every question `open` and the ask `waiting`, and return the ask's first cursor `<epoch>.0` with its board link.

#### Scenario: A plain ask is created
- **WHEN** the plain-choice fixture is sent as an ask
- **THEN** the ask is `waiting`, its question has `rev` 1, and the result's cursor is `<epoch>.0`

#### Scenario: An ask with areas is created
- **WHEN** an ask of two areas holding five questions is sent
- **THEN** the board document holds both areas in order, every question at `rev` 1 and `open`

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
An answer event SHALL come only from an answer or decline act of the board on a question of an open ask, naming the question's current `rev`, or an older one the user kept (edit choice), and content that revision can hold: option labels, one unless `multiSelect` is set, "Other…" text only with `allowOther`, widget values only for its widget items, and at least a label, "Other…" text or a widget change unless it declines. Any other act SHALL be refused and append nothing (AD-10, NFR-10).

#### Scenario: A valid answer is appended
- **WHEN** the board sends an answer to question `database` with `rev` 1 and `choice: ["PostgreSQL"]`
- **THEN** one answer event is appended, carrying that choice, and the question becomes `answered`

#### Scenario: An answer the question cannot hold
- **WHEN** an answer names a label that is not an option, two labels on a single-choice question, "Other…" text on a question without `allowOther`, no label and no "Other…" text, a `rev` that is not current and not kept, or a `when` that is no real time, such as `2026-02-30T10:00:00Z`
- **THEN** it is refused and the log is unchanged

#### Scenario: A second answer to an answered question
- **WHEN** the board sends a second answer to a question already answered as E1's answer command, without an action ID, such as a retry after a dropped connection
- **THEN** it is refused, the log keeps the first answer only, and the board is told the answer it holds; an answer act with an action ID is instead acknowledged as before when that ID was applied (One command, applied once), or appended as a revision when it is new (Revising an answer)

#### Scenario: An answer to a closed ask
- **WHEN** the board sends an answer after the agent closed the ask
- **THEN** it is refused, the log is unchanged, and the board is told the ask is closed

#### Scenario: Widget values the question cannot hold
- **WHEN** an answer's `values` name an item of another question, an inherited name such as `constructor`, or a Tree value whose node has no label
- **THEN** it is refused, naming the item, and the log is unchanged

#### Scenario: Widget values equal to what was sent
- **WHEN** an answer to a question with no options carries a Tree value equal to the Tree as sent, and nothing else
- **THEN** it is refused as an answer with no content, and the log is unchanged

### Requirement: Who and when
Answers, notes and follow-ups the board sends SHALL carry `when`, the time of the user's action as the board stamped it, in RFC 3339 UTC, and `who`: the ask's `expectedUser`, else the git user name of the session project, else the operating system's login name. An answer the agent records SHALL take the same `who` and the core's time as `when` (FR-19).

#### Scenario: No expected user and no git user
- **WHEN** an ask names no `expectedUser` and the project has no git user name
- **THEN** its answer's `who` is the operating system's login name

#### Scenario: A recorded answer
- **WHEN** the agent records an answer with `update`
- **THEN** the answer's `who` follows the same rule and its `when` is the core's time of the update

### Requirement: Reading events after a cursor
`ask-core` SHALL return, for an ask and a cursor of the current epoch, the ask's state, its latest cursor and the events after that cursor, each with the cursor that follows it. A cursor of another epoch SHALL return the ask as `discarded`, with no events (AD-3, AD-10).

#### Scenario: Events after a cursor
- **WHEN** the events of an answered ask are read after `<epoch>.0`
- **THEN** the result holds its answer event with cursor `<epoch>.1`, and state `answered`

#### Scenario: A cursor from before a restart
- **WHEN** an ask is read with a cursor whose epoch is not the current one
- **THEN** the ask is reported `discarded`, never as having no answer yet

### Requirement: Received watermark
Per ask, `ask-core` SHALL keep a `received` watermark that only increases: the highest `seq` a read has returned, a stop block has carried or a push has been reported delivered. When it passes an answer's event, `board-host` SHALL be told, so that the board marks that answer delivered to the agent (AD-3).

#### Scenario: Collecting raises the watermark
- **WHEN** a read returns the answer event with `seq` 1
- **THEN** `received` becomes 1 and the board is told that the answer was delivered

#### Scenario: An older cursor does not lower it
- **WHEN** a later read passes cursor `<epoch>.0` again
- **THEN** `received` stays 1

#### Scenario: A push is reported
- **WHEN** the mod reports that it pushed the answer with `seq` 1
- **THEN** `received` becomes 1, the board marks the answer delivered, and a later poll returns nothing for that ask

#### Scenario: A stop block carries the answer
- **WHEN** the stop guard blocks with the answer with `seq` 1
- **THEN** `received` becomes 1

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
`ask-core` SHALL return, for an item of an open or closed ask's current board document, its type, `rev` and props, and for a question its state and current answer in full: its content, the full edited value of each widget item it changed and its derived values, `who`, `when`, whether it was recorded, and the cursor of its event when logged (FR-20).

#### Scenario: A deleted item
- **WHEN** the full value of a deleted item is asked for
- **THEN** none is returned, and the item is reported as deleted

#### Scenario: An answered widget question
- **WHEN** the full value of the answered UJ-2 question `plan` is asked for
- **THEN** its answer holds the edited WBS under `wbs` and the edited plan under `schedule`, and the fourteen derived values, with no expanded ID anywhere

### Requirement: Owner of an ask
The agent of the first `ask` call bound to an agent record SHALL own the ask, and a later record from another agent SHALL NOT change the owner. `ask-core` SHALL know the owner only as an opaque owner key; Claude Code identifiers stay in the local API's record table (AD-5).

#### Scenario: A subagent's ask
- **WHEN** a subagent's `ask` arrives bound to its record
- **THEN** the ask is owned by that subagent, and nothing in `ask-core` holds its `agent_id`

#### Scenario: An ask without a record
- **WHEN** an `ask` arrives with no bound record
- **THEN** the ask has no owner and is unchecked

### Requirement: Binding a record to its call
A record SHALL bind to the call that carries the same `tool_use_id`, whatever the time between them, since a permission prompt can stand between a hook and its call. A call without one SHALL bind to the first unbound record of the same tool and the same ask IDs received within the contract's record timeout. Unbound records SHALL expire after the contract's longer hold time, and their number SHALL be bounded (AD-5).

#### Scenario: Bound by tool_use_id
- **WHEN** a call carries `claudecode/toolUseId` in its `_meta` and a record with that `tool_use_id` exists
- **THEN** the call is bound to that record, whatever other records exist

#### Scenario: A stale record
- **WHEN** a record arrives, and a call without a `tool_use_id` for the same tool and ask IDs comes after the record timeout
- **THEN** the call does not bind to it

#### Scenario: A slow permission prompt
- **WHEN** the call carrying a record's `tool_use_id` arrives two minutes after the record, once the user has approved it
- **THEN** it binds to that record

### Requirement: Origin of an ask
Each owned ask SHALL keep an origin set once from its owning record: the owner key; a label, "Main agent", "Subagent <type>" with an ordinal from the second of a type, or "Teammate <name>"; the `cwd`; the root, the real path of the git worktree of the `cwd` when it belongs to the project's repository, else of the session project root; the directory, the `cwd` relative to the root; the branch; and the worktree. Without a session project root it SHALL have none of the last four (AD-5, AD-12).

#### Scenario: A subagent in another worktree
- **WHEN** a subagent working in a worktree of the project's repository asks
- **THEN** the ask's root is that worktree, and its origin names the worktree and its branch

#### Scenario: The directory is set at the bind
- **WHEN** a subagent working in `services/orders` under its worktree asks
- **THEN** the ask's origin holds the directory `services/orders`, worked out once when the record is bound, and a `cwd` outside the root is held as the absolute `cwd`

#### Scenario: A cwd outside the repository
- **WHEN** the owning record's `cwd` is outside the project's repository
- **THEN** the ask's root is the project root

#### Scenario: No session project root
- **WHEN** the session process runs without `CLAUDE_PROJECT_DIR`, or with one that is not absolute, or whose real path cannot be read or is not a folder, and a subagent working in a worktree of the repository asks
- **THEN** the ask's origin has its label and `cwd` and no root, directory, branch or worktree, git does not run for it, and the working folder never stands in for the root

#### Scenario: git pointed at another repository
- **WHEN** the session process's environment sets `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR` or `GIT_INDEX_FILE` to another repository
- **THEN** the origin is resolved from the repository of the `cwd`, since git runs without those variables

### Requirement: Only the owner acts on an owned ask
`collect` on an owned ask, and `update` and `fetch` once the ask-lifecycle change lists them, SHALL be refused, naming the ask, unless the call is bound to a record of its owner. An unchecked ask SHALL take any caller's calls (AD-5).

#### Scenario: Another subagent collects
- **WHEN** a subagent collects an ask another subagent owns
- **THEN** the call is refused, naming the ask as owned by another agent, and `received` does not move

#### Scenario: A call without a record
- **WHEN** a `collect` on an owned ask arrives with no bound record
- **THEN** it is refused, saying that the call carried no agent record and may be retried

#### Scenario: Another subagent updates
- **WHEN** a subagent sends `update` on an ask another subagent owns
- **THEN** the call is refused, naming the ask, and the ask is unchanged

### Requirement: Re-sending comes from the owner
An identical `ask` with the ID of an open owned ask SHALL return that ask's board only when it comes from the owner; from any other agent it SHALL be refused, naming the ID as in use (AD-6).

#### Scenario: Two subagents pick one ID
- **WHEN** two subagents running one skill send identical asks under the same ID
- **THEN** the first owns the ask, and the second is refused with the ID named as in use

### Requirement: Closing a finished subagent's asks
When the session process is told that a subagent finished, `ask-core` SHALL close every open ask that subagent owns with reason `agent-finished`, appending the `closed` event; their boards SHALL show the ask as closed and accept no more answers (AD-10, FR-25). The `closed` state and `ask-core`'s close come from the ask-lifecycle change.

#### Scenario: The guard lets a subagent stop
- **WHEN** a subagent owning a `waiting` ask finishes with nothing above `received`
- **THEN** the ask is closed, its log ends with a `closed` event with reason `agent-finished`, and its board shows it closed and refuses a later answer

### Requirement: Agent status of an ask
Each ask SHALL have an agent status, presence only and never an event: `waiting` while a waiting `collect` on it is pending, except a main-conversation call past Claude Code's background threshold, or while the mod reports that the owner has no turn running; `working` otherwise, from the ask's creation (AD-4).

#### Scenario: A subagent waits in collect
- **WHEN** the owning subagent calls `collect` with `wait` on the ask
- **THEN** the status becomes `waiting` at once, and `working` when the call returns

#### Scenario: A main-conversation call moves to the background
- **WHEN** the main conversation's waiting `collect` has been pending longer than Claude Code's background threshold
- **THEN** the status becomes `working`, unless the mod reports that the main conversation has no turn running

#### Scenario: The owner's turn ends
- **WHEN** the mod reports that the owning agent's turn completed
- **THEN** the status becomes `waiting`, and `working` when the mod reports its next turn

#### Scenario: Nothing reports
- **WHEN** an ask is created and neither a waiting `collect` nor the mod reports anything
- **THEN** its status stays `working`

### Requirement: Expanding molecule references
`ask-core` SHALL replace each molecule reference among a question's items by its definition's item, filled from the reference's data, in the reference's place and under the ID `<reference>__<item>`. The board document SHALL hold the expanded items and never the reference; every other item SHALL stay as sent (AD-9, AD-12).

#### Scenario: The UJ-2 ask
- **WHEN** the approved `uj2-wbs-gantt` ask's items are expanded with the shipped molecules
- **THEN** the question `plan` holds the Tree `wbs__tree` and then the Gantt plan `schedule__plan`, equal to the contract's molecule fixtures, and the question `erp-export` is unchanged

#### Scenario: A question with no reference
- **WHEN** the plain-choice ask's items are expanded
- **THEN** they are returned unchanged and no expansion is recorded

#### Scenario: A question in an area
- **WHEN** the UJ-2 question `plan` sits in an area, as E3's input format 1.1 allows, and the items are expanded
- **THEN** the area's question `plan` holds `wbs__tree` and `schedule__plan` as at the top level, and the area is otherwise unchanged

### Requirement: Fill forms
A fill SHALL put its parameter's value at its pointer: as it is (copy); as the expanded item of the molecule reference it names, else unchanged (`item`); with each value of an object turned into an entry holding it under the given field (`entries`); or without the given keys at any depth (`omit`). A parameter the data leaves out SHALL leave the composition's value (AD-9).

#### Scenario: Entries
- **WHEN** the `gantt-plan` data's `dependencies` `{prototype: ["ux"]}` fills `tasks` with `{entries: "dependencies"}`
- **THEN** `tasks` is `{prototype: {dependencies: ["ux"]}}`

#### Scenario: Omit
- **WHEN** the `wbs-pert` data's `nodes` fill the Tree's `nodes` with `{omit: ["excerpt"]}`
- **THEN** no node at any depth holds `excerpt`, and every other key is kept

#### Scenario: A parameter left out
- **WHEN** the `wbs-pert` data holds no `depth`
- **THEN** the Tree's `openDepth` is the composition's 2

### Requirement: Molecule versions
`ask-core` SHALL get each definition through the `MoleculeSource` port. A reference without `version` SHALL get the highest shipped version of the molecule's current major; one with a version, the highest shipped version of that major at or above it. A name or version with no such definition SHALL refuse the request, naming the reference and what is shipped (AD-9, AD-10).

#### Scenario: No version
- **WHEN** a reference names `wbs-pert` with no `version`, and 1.0.0 is shipped
- **THEN** it expands with `wbs-pert` 1.0.0

#### Scenario: A version not shipped
- **WHEN** a reference names `wbs-pert` version `2.0.0`
- **THEN** the request is refused, naming the reference and `wbs-pert` 1.0.0

#### Scenario: An unknown molecule
- **WHEN** a reference names `sales-estimate-review`
- **THEN** the request is refused, naming the reference and the shipped molecules `gantt-plan` and `wbs-pert`

### Requirement: Refusing an expansion
`ask-core` SHALL refuse a request, naming the reference's ID, when a reference's data fails its parameters, or when an expanded item fails its widget's checks in the question that holds it, such as a Gantt plan naming a work breakdown in another question (AD-10, NFR-10).

#### Scenario: Data outside the parameters
- **WHEN** the `schedule` reference's data also holds `calendar`
- **THEN** the request is refused, naming `schedule` and `calendar`

#### Scenario: A plan in another question
- **WHEN** `schedule` sits in a question other than the one holding `wbs`
- **THEN** the request is refused, naming `schedule` and `wbs`

#### Scenario: A day that does not exist
- **WHEN** the `schedule` reference's `data.start` is `2026-02-30`, which has the form of a date
- **THEN** the data passes its parameters, whose date is a pattern, and the request is refused at the expanded plan's own checks, naming `schedule` and `/start`

### Requirement: Expanded IDs
An expanded item's ID SHALL be at most 64 characters and SHALL NOT equal another item ID of the ask; otherwise the request SHALL be refused, naming the reference and, for a clash, the other item (AD-7, AD-9).

#### Scenario: A long reference ID
- **WHEN** a `wbs-pert` reference's ID has 59 characters, so that its expanded ID would have 65
- **THEN** the request is refused, naming the reference and the limit of 64 characters

#### Scenario: A clash
- **WHEN** an ask holds a reference `wbs` and another item whose ID is `wbs__tree`
- **THEN** the request is refused, naming both

### Requirement: The expansion map
For each board document, `ask-core` SHALL keep which expanded item belongs to which reference, with the molecule's name and version, apart from the board document, which the view, `fetch` and Snapshots read unchanged (AD-9, AD-12).

#### Scenario: The UJ-2 map
- **WHEN** the UJ-2 ask is expanded
- **THEN** the map gives `wbs__tree` as `wbs`, `wbs-pert` 1.0.0, and `schedule__plan` as `schedule`, `gantt-plan` 1.0.0, and the board document holds no `molecule` item

### Requirement: Answers in reference addressing
`ask-core` SHALL give every change target and derived-value key that addresses an expanded item under its reference's ID, keeping the rest of the address, so answers name no expanded ID and carry no `molecule` field; other addresses and every `parent` and `after` SHALL stay as they are (AD-9, AD-20, F15).

#### Scenario: The UJ-2 answer
- **WHEN** the UJ-2 question's changes and derived values, computed from the expanded items as sent and as the approved edits leave them, are put in reference addressing
- **THEN** the changes are the approved answer's eight operations, compared as a set, and the derived values the approved answer's fourteen, `wbs.` and `schedule.` keys alike

#### Scenario: An address of another item
- **WHEN** an answer's change targets an item that no reference expanded
- **THEN** its target is unchanged

### Requirement: Warnings in reference addressing
A warning or problem that names an expanded item SHALL name its reference's ID instead, keeping the rest of what it says (AD-6, AD-9, AD-13).

#### Scenario: A predecessor that names no task
- **WHEN** the `schedule` data gives `billing` the predecessor `review`, which is no work package, and the expanded question's graph is built
- **THEN** the graph's `missing-reference` warning names `schedule` and `review`, and no warning names `schedule__plan`

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
- **THEN** the excerpt is unresolved with reason `no-root`, whatever the origin's root says

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

### Requirement: Two configuration files
The session process SHALL read the project file `.askboard/config.json` under the real path of `CLAUDE_PROJECT_DIR`, and the user file `$XDG_CONFIG_HOME/askboard/config.json` when `XDG_CONFIG_HOME` is an absolute path, else `$HOME/.config/askboard/config.json` (AD-14). Without `CLAUDE_PROJECT_DIR` it SHALL read no project file, and without an absolute `HOME` or `XDG_CONFIG_HOME` no user file (AD-12).

#### Scenario: XDG_CONFIG_HOME is honoured
- **WHEN** `XDG_CONFIG_HOME` is `/tmp/x` and `/tmp/x/askboard/config.json` sets `theme` to `dark`
- **THEN** the theme in effect is `dark`, and `$HOME/.config/askboard/config.json` is not read

#### Scenario: A relative XDG_CONFIG_HOME is ignored
- **WHEN** `XDG_CONFIG_HOME` is `conf` and `$HOME/.config/askboard/config.json` sets `theme` to `light`
- **THEN** the theme in effect is `light`

#### Scenario: No project root, no project file
- **WHEN** `CLAUDE_PROJECT_DIR` is not set and the working folder holds `.askboard/config.json`
- **THEN** that file is not read

### Requirement: Read once, on first use
The session process SHALL read both files once, the first time it needs a setting, and never before its first request after `server/discover` (AD-2). Every key except the presentation keys SHALL keep that value for the rest of the session, so a change applies from the next session (FR-35).

#### Scenario: The probe sibling reads nothing
- **WHEN** a session process answers `server/discover` and exits
- **THEN** it has opened neither configuration file

#### Scenario: A behaviour change waits for the next session
- **WHEN** the user changes `defaultLanguage` in the user file while a session runs
- **THEN** that session's later asks keep the language read at first use, and the next session uses the new one

### Requirement: Merged key by key, project keys winning
The settings in effect SHALL take each key from the project file when it sets the key, else from the user file, else the key's default: `system`, `compact`, `beside`, `en-US`, `none`, `.askboard/snapshots/`, no editor and no minimum margin (AD-14, FR-30). `editor` is the one exception.

#### Scenario: The project's asking rule wins
- **WHEN** the user file sets `askingRule` to `none` and the project file sets it to `always`
- **THEN** the asking rule in effect is `always`, from the project file

#### Scenario: Keys from both files combine
- **WHEN** the user file sets `theme` to `dark` and the project file sets `density` to `comfortable`
- **THEN** both apply

### Requirement: An invalid file is never half-applied
A file that cannot be read, is not JSON, fails the configuration schema or names an unsupported major version SHALL contribute no key. The session process SHALL write a diagnostic to stderr naming the file and the problem, and the settings SHALL record the file as not applied with that problem (AD-14, NFR-10). An unknown key SHALL be a warning and SHALL not stop the file applying.

#### Scenario: One bad value voids the whole file
- **WHEN** the project file sets `askingRule` to `always` and `theme` to `"sepia"`
- **THEN** neither key applies, the asking rule in effect comes from the user file or is `none`, and stderr names `.askboard/config.json` and `/theme`

#### Scenario: A file that cannot be read
- **WHEN** the user file's place holds a directory, a named pipe or a file over 1 MiB
- **THEN** it counts as a file that cannot be read: no key of it applies, the settings record it as not applied, and the session process never opens it

#### Scenario: A file from a newer major
- **WHEN** the user file names `version` `2.0`
- **THEN** no key of it applies, and the diagnostic names the version

#### Scenario: An unknown key
- **WHEN** the user file holds `version` `1.0`, `theme` `dark` and `fontSize` `14`
- **THEN** `theme` applies, and the settings carry a warning naming `fontSize`

### Requirement: The editor comes from the user file only
`editor` SHALL be read only from the user file. A project-level `editor` SHALL be ignored with a warning, whatever the user file holds (AD-8, AD-14). An `editor` in a user file, or a folder above it, that another user can write, that the user does not own, or whose owner and mode cannot be read SHALL also be ignored with a warning.

#### Scenario: A project file names a command
- **WHEN** the project file sets `editor` to `["sh", "-c", "curl evil"]` and the user file sets none
- **THEN** no editor is in effect, and the settings carry a warning that the project's `editor` is ignored

#### Scenario: The user's editor stands beside a project one
- **WHEN** the project file sets `editor` to `["evil", "{file}"]` and the user file sets `["code", "--goto", "{file}:{line}"]`
- **THEN** the editor in effect is the user's

#### Scenario: A user file others can write
- **WHEN** the user file is group-writable and sets `editor`
- **THEN** no editor is in effect, the warning names the file's mode, and the file's other keys apply

### Requirement: The Snapshot folder stays inside the project
`snapshotFolder` SHALL be a path relative to the session project root that stays inside it once normalised. An absolute path, a path starting with `~`, a backslash, or a `..` that leaves the root SHALL be replaced by `.askboard/snapshots/` with a warning (AD-14, FR-27).

#### Scenario: A folder inside the project
- **WHEN** the project file sets `snapshotFolder` to `docs/snapshots`
- **THEN** the Snapshot folder in effect is `docs/snapshots` under the project root

#### Scenario: A folder outside the project
- **WHEN** a file sets `snapshotFolder` to `../shared` or `/tmp/snaps`
- **THEN** the folder in effect is `.askboard/snapshots/`, with a warning naming the value

### Requirement: Presentation keys read again when a board opens
Each time a board connects, the session process SHALL read the user file's presentation keys again, so a board of any running session opens with a change written since (AD-14, FR-35). Project presentation keys SHALL keep the value read at first use.

#### Scenario: Another session's change reaches a later board
- **WHEN** a board of session A writes `theme` `dark`, and session B then opens a board
- **THEN** session B's board opens dark

### Requirement: Writing a presentation key
The session process SHALL write only `theme`, `density` and `contextPlacement`, with a schema value, into the user file: re-reading it, changing only that key, keeping every other key, and replacing the file atomically (AD-14). It SHALL refuse a write for a key the project file sets, or into a user file that fails its check, and SHALL leave that file unchanged.

#### Scenario: Only that key changes
- **WHEN** the user file holds `version`, `editor`, `askingRule` and `fontSize`, and a board writes `density` `comfortable`
- **THEN** the file holds the same four keys with the same values, in the same order, plus `density`, and no temporary file remains

#### Scenario: A key the project sets
- **WHEN** the project file sets `theme` to `light` and a board writes `theme` `dark`
- **THEN** the write is refused as set by the project, and the user file is unchanged

#### Scenario: An invalid user file is not overwritten
- **WHEN** the user file is not valid JSON and a board writes `theme` `dark`
- **THEN** the write is refused, naming the file, and its bytes are unchanged

#### Scenario: No user file yet
- **WHEN** the user folder does not exist and a board writes `theme` `dark`
- **THEN** the folder is created with mode `0700` and the file with mode `0600`, holding `version` and `theme`

### Requirement: The ask's language is resolved when it is created
When an ask is accepted, `ask-core` SHALL fix its language as the ask's `language`, else `defaultLanguage` in effect, else `en-US`, and its locale as the ask's `locale`, else its language, and SHALL keep both for the whole ask (FR-34, AD-7). An `update` SHALL not change them.

#### Scenario: The project's default language
- **WHEN** the project file sets `defaultLanguage` to `it-IT`, the user file to `en-US`, and an ask names no language
- **THEN** the ask's language and locale are `it-IT`

#### Scenario: The agent's language wins
- **WHEN** `defaultLanguage` in effect is `it-IT` and an ask sets `language` to `en-US`
- **THEN** the ask's language and locale are `en-US`

### Requirement: The project folders at the first ask
When a session's first ask is accepted, the session process SHALL create under the session project root `.askboard/`, `snapshots/`, `media/` and `patches/` when missing, and `.askboard/.gitignore` listing `snapshots/`, `media/`, `patches/` and `bench/` only when it creates that file (AD-14, FR-27). A `.askboard` that is a symbolic link or not a folder SHALL be a failure, and nothing SHALL be created through it. A failure SHALL be a diagnostic and SHALL not refuse the ask.

#### Scenario: A fresh project
- **WHEN** a project has no `.askboard/` and its session accepts a first ask
- **THEN** `.askboard/` holds `snapshots/`, `media/`, `patches/` and a `.gitignore` of those four lines, and no `bench/`

#### Scenario: A user's own .gitignore holds
- **WHEN** `.askboard/.gitignore` exists without `snapshots/`, because the user commits Snapshots
- **THEN** the file is unchanged after the first ask

#### Scenario: A read-only project
- **WHEN** the project root cannot be written and a first ask arrives
- **THEN** the ask is accepted, and stderr says that `.askboard/` could not be created

#### Scenario: A .askboard that leads out of the project
- **WHEN** `.askboard` is a symbolic link to a folder outside the project and a first ask arrives
- **THEN** the ask is accepted, nothing is created in that folder, and stderr says that `.askboard/` could not be created

### Requirement: Molecules expanded when an ask is sent
When an ask or an update holds molecule references, `ask-core` SHALL expand them through its molecule source before storing the board document, keep the expansion map beside it, and refuse the request when any reference does not expand, naming the reference; nothing SHALL be stored then (AD-9, AD-12).

#### Scenario: The UJ-2 ask
- **WHEN** the approved UJ-2 ask is sent
- **THEN** its board document's question `plan` holds the Tree `wbs__tree` and the Gantt plan `schedule__plan`, and no `molecule` item

#### Scenario: An unknown molecule
- **WHEN** an ask's reference names the molecule `org-chart`
- **THEN** the ask is refused, naming the reference and the molecules shipped, and no ask is created

### Requirement: The send-time graph check
When an ask or an update with widget items is accepted, `ask-core` SHALL build the board's graph from the items as stored and return each graph problem as a `formula` warning in reference addressing; a graph problem SHALL never refuse the request (AD-13, FR-14).

#### Scenario: A predecessor that names no task
- **WHEN** an ask's `schedule` data gives `billing` the predecessor `review`, which is no work package
- **THEN** the ask is created, and its result warns, naming `schedule` and `review`, never `schedule__plan`

### Requirement: Widget answers stored in full
For an answer with widget values, `ask-core` SHALL keep the full edited value of each widget item the answer changed, as the board sent it, apart from the log, until the ask is discarded (AD-20).

#### Scenario: The full value after the answer
- **WHEN** the UJ-2 answer is appended
- **THEN** the edited Tree and plan are held whole, and the log's event carries only their changes

### Requirement: Changes computed by the core
For each widget item an answer changed, `ask-core` SHALL compute `changes` with the contract's generic diff and that widget's shape, from the item's props in the revision the answer names to its edited value, once, when it appends the answer; the event SHALL carry them in reference addressing (AD-9, AD-20).

#### Scenario: The UJ-2 changes
- **WHEN** the UJ-2 edits are answered
- **THEN** the answer event's `changes` are the approved answer's eight operations, compared as a set, `wbs.u-1` and `schedule.u-1.dependencies` among them

#### Scenario: A revised widget answer
- **WHEN** the user revises a Tree answer, restoring one of two renamed nodes
- **THEN** the new event, naming the first in `replaces`, carries one `set` for the node still renamed, against the Tree as sent

#### Scenario: An edit the changes cannot describe
- **WHEN** an answer's Tree value also changes the Tree's `columns`, which no element operation expresses
- **THEN** the answer is refused, naming the item, since its changes would not rebuild the edited value, and the log is unchanged

### Requirement: Derived values in an answer
`ask-core` SHALL log an answer's derived values as the board sent them, in reference addressing, after checking that each key addresses a widget item of the question and a derived field its widget declares, and that each value is JSON; an answer whose derived values fail the check SHALL be refused (AD-13, FR-12).

#### Scenario: The UJ-2 derived values
- **WHEN** the UJ-2 answer carries the WBS's and the plan's derived values
- **THEN** the event's `derived` holds the approved fourteen keys, `wbs.expected` and `schedule.criticalPath` among them

#### Scenario: A field no widget declares
- **WHEN** an answer's `derived` holds `schedule__plan.margin`
- **THEN** the answer is refused, naming the key, and the log is unchanged

### Requirement: Answers too large for one result
When an answer event with its `changes`, `results` and derived values would exceed the contract's largest answer event, `ask-core` SHALL log it without them and with `tooLarge: true`, keeping the full edited values, results and derived values for `fetch` (FR-20, AD-6).

#### Scenario: Every node of a large Tree renamed
- **WHEN** the user renames all 500 nodes of a Tree and answers
- **THEN** the event carries `tooLarge: true` and no `changes` or `derived`, and the question's full value holds the edited Tree and its derived values

#### Scenario: A large result
- **WHEN** an answer's probe result alone takes the event over the largest answer event
- **THEN** the event carries `tooLarge: true` and no `results`, and the question's full value holds the result

### Requirement: Full value of a widget item
`ask-core` SHALL return, for a widget item or a molecule reference in a question, that item alone as the user left it: the latest answer's edited value, else the value as sent, with its question's state. A reference SHALL come under its own ID, with its expanded item's type and props and each `item`-fill slot naming the reference (AD-9, FR-20).

#### Scenario: Fetching the plan by its reference
- **WHEN** the full value of `schedule` is asked for after the UJ-2 answer
- **THEN** it is a Gantt plan with the ID `schedule`, `workPackages: "wbs"`, and the entry `u-1` with its dependencies

#### Scenario: An untouched Tree
- **WHEN** the full value of a Tree whose question is still open is asked for
- **THEN** it is the Tree as the agent sent it

#### Scenario: A widget item beside an excerpt
- **WHEN** a question holds an excerpt and a Tree, and the full value of the question is asked for
- **THEN** the excerpt keeps the form the excerpts change gives `fetch` (no text, no bytes), and the Tree comes in full, as the user left it

### Requirement: Changing an item inside a question
An `update` `change` naming a widget item or a molecule reference SHALL merge the given props into its props key by key, check them as an ask's are, re-expand a reference whole, and raise its question's `rev`; a question whose latest answer is logged SHALL NOT change unless reopened (AD-20, FR-6).

#### Scenario: New data for a reference
- **WHEN** the agent changes `schedule`'s `data` in an open question
- **THEN** `schedule__plan` is expanded again from the new data, the question `plan` is at `rev` 2, and the board receives the new board document

#### Scenario: A change that does not expand
- **WHEN** the agent changes `wbs`'s `data` to hold a node without `label`
- **THEN** the update is refused, naming `wbs`, and the question keeps its `rev`

### Requirement: Widget answers in a Snapshot
`ask-core` SHALL give the Snapshot's gathering, for each answer event it logged with widget values, the full edited values kept for it, by item ID in reference addressing, and the expansion map's entries of the ask's molecule references, so that a Snapshot's data holds `events[].values` and `molecules` (FR-26, AD-15, AD-20).

#### Scenario: A Snapshot of the answered UJ-2 ask
- **WHEN** a Snapshot is taken of the ask after the UJ-2 answer
- **THEN** the answer's event holds `values` for `wbs` and `schedule` as the user left them, and `molecules` lists the references `wbs` and `schedule` with their molecule and version

#### Scenario: A Snapshot of an ask without widget answers
- **WHEN** a Snapshot is taken of an ask whose answers are choices only
- **THEN** no event holds `values` and the data holds no `molecules` entry

### Requirement: ask-core dispatches on the widget-type registry
`ask-core` SHALL find a question's widget items, check an answer's values and derived keys, resolve, update and fetch widget items, and decide whether the send-time graph check runs, through the widget-type registry, naming no widget type in its own code. For Tree and Gantt every outcome SHALL stay as before this change (AD-1, AD-7, AD-13).

#### Scenario: A test-only type
- **WHEN** an answer's values and derived keys for a probe item are checked, and the item is fetched, with a registry that holds `probe`
- **THEN** the value goes through the probe's checks, its derived keys through the probe's declarations, and the fetch returns it as the user left it

#### Scenario: Tree and Gantt as before
- **WHEN** `ask-core`'s Tree, Gantt, molecule and graph-check tests run
- **THEN** each passes with its expected values and texts unchanged

#### Scenario: A board with no computing type
- **WHEN** an ask holds only Choice questions and context items
- **THEN** no graph is built and no `formula` warning is given

### Requirement: Widget results in an answer
`ask-core` SHALL accept an answer's `results` only when each key, an own property, names a widget item of the answered question in the named revision whose type declares a result, and each result passes that type's schema and checks against the item's edited value, else its props as sent. Any failure SHALL refuse the answer with the log unchanged. A result SHALL count as an answer's content (AD-10, AD-20, NFR-10).

#### Scenario: A probe result
- **WHEN** an answer carries a result its type admits for a probe item, and nothing else
- **THEN** the answer is logged, its event carrying the result

#### Scenario: A result for a Tree
- **WHEN** an answer carries `results` for a Tree item
- **THEN** the answer is refused, naming the item and saying that a Tree gives no result, and nothing is appended or published

#### Scenario: A key that is not an own item
- **WHEN** an answer's `results` holds the key `__proto__` or the ID of an item of another question
- **THEN** the answer is refused, naming the key, with the log unchanged

#### Scenario: A result its schema refuses
- **WHEN** a probe result fails the probe's result schema
- **THEN** the answer is refused, naming the item and the problem, with the log unchanged

#### Scenario: A decline with a result
- **WHEN** a decline carries `results`
- **THEN** it is refused, with the log unchanged

### Requirement: A result that holds nothing is no answer
`ask-core` SHALL refuse a result that holds nothing, as the contract defines it (`null`, `""`, or an object or array whose every value holds nothing), whatever its type's schema admits, naming the item and saying it holds nothing, with the log unchanged (AD-10, NFR-10).

#### Scenario: A result that holds nothing
- **WHEN** an answer's only content is a result `{}` or `{annotations: []}` that its type's schema admits
- **THEN** the answer is refused, saying the item's result holds nothing, and nothing is appended or published

### Requirement: Results and derived values are bounded JSON
A result and a derived value SHALL be JSON nested no deeper than 64 levels, the contract's one bound (`JSON_MAX_DEPTH`); a deeper one, or one that holds itself, SHALL be refused naming the depth, never walked (AD-10, NFR-10).

#### Scenario: A result nested past the bound
- **WHEN** an answer carries a result, or a derived value, nested deeper than 64 levels
- **THEN** the answer is refused, saying it is nested deeper than 64 levels, with the log unchanged

### Requirement: Widget results logged and kept
`ask-core` SHALL log an answer's results in its event's `results`, keyed in reference addressing, keep them with the answer's full edited values apart from the log until the ask is discarded, and give them to the board state's current and previous answers by expanded item ID (AD-9, AD-20).

#### Scenario: A result in a molecule's item
- **WHEN** an answer carries a result for the expanded item `ref__item` of the reference `ref`
- **THEN** the event's `results` names `ref`, and the board state's answer names `ref__item`

### Requirement: Widget results in fetch and Snapshots
`ask-core` SHALL return a question's answer with its kept `results`, a widget item fetched alone with its latest answer's `result`, and SHALL give the Snapshot's gathering the kept results of each answer event logged `tooLarge`, all in reference addressing (FR-20, FR-26, AD-15).

#### Scenario: Fetching an answered probe question
- **WHEN** the full value of a question whose answer gave a probe result is asked for
- **THEN** its answer holds that result under the item's ID

#### Scenario: A Snapshot after a too-large answer
- **WHEN** a Snapshot is taken after an answer logged `tooLarge` that gave a result
- **THEN** that event's logged entry holds the result in `results`, and an event logged whole holds none there

### Requirement: A result's requirements on its answer
`ask-core` SHALL run the answer checks of each result's type with the answer's note and whether the answer's `changes` are empty, after the event's widget fields are built and before anything is kept; a failure SHALL refuse the answer, naming the item, with nothing appended, kept or published (AD-10, NFR-10, FR-11).

#### Scenario: Approving with changes and a reason
- **WHEN** an answer carries `results: {verdict: {decision: "approve-with-changes"}}`, a Tree value with one change and the note "Show the training as an extra"
- **THEN** it is logged, its event carrying the result, the note and the Tree's change

#### Scenario: Approving with changes and no reason
- **WHEN** an answer carries `{decision: "approve-with-changes"}` for the Approval and no note, or a note of white space only (U+0085 included)
- **THEN** it is refused, naming `verdict` and the missing reason, and nothing is appended or published

#### Scenario: Approving beside a change
- **WHEN** an answer carries `{decision: "approve"}` for the Approval and a Tree value with one change
- **THEN** it is refused, naming `verdict`, and nothing is appended or published

#### Scenario: Approving with nothing changed
- **WHEN** an answer carries `{decision: "approve"}` alone
- **THEN** it is logged

### Requirement: Results of the shipped result widgets
`ask-core` SHALL check an Approval's, a Scale's and a Ranking's result against the item's props in the revision the answer names, so that a value off a step, an order that misses an element or names one the revision does not hold, and a decision outside the three are refused with the log unchanged (AD-10, AD-20, FR-18).

#### Scenario: An order for an earlier revision
- **WHEN** the agent has removed `cost` from a Ranking in revision 2 and an answer naming revision 1 carries an order with `cost`, after "Keep mine" on the agent-change notice
- **THEN** it is logged, its order checked against revision 1

#### Scenario: An order missing an element
- **WHEN** an answer naming the current revision carries an order that leaves out one of the Ranking's items
- **THEN** it is refused, naming the item and the element, with the log unchanged

#### Scenario: A Scale value off its step
- **WHEN** an answer carries `{value: 37}` for a Scale from 0 to 100 by 5
- **THEN** it is refused, naming the item, with the log unchanged

#### Scenario: Fetching a widget alone
- **WHEN** the agent fetches a Ranking item whose question's latest answer holds its order
- **THEN** the item comes with that order as its `result`

### Requirement: An answer's changes follow their type
`ask-core` SHALL refuse an answer when the changes it computes for an edited widget item fall outside that item type's changes schema, naming the item and the operation, so that nothing is appended, kept or published; it SHALL check them after the edited value's own checks and its round trip, for every registered type. A diff that fails, such as for a key a fields shape does not name, SHALL refuse the answer the same way, naming the item and the key (AD-7, AD-10, AD-20).

#### Scenario: A Kanban reorder
- **WHEN** an answer's value for a Kanban lists its cards in another order, each in its sent column
- **THEN** it is refused, naming the item and a `move`, with the log unchanged and nothing published

#### Scenario: An edited card label
- **WHEN** an answer's value for a Kanban renames a card
- **THEN** it is refused, naming the item and the `set` of the card's `label`, with the log unchanged

#### Scenario: A key a fields shape does not name
- **WHEN** a type's props admit keys its fields shape does not name, and an answer's value changes one of them
- **THEN** it is refused, naming the item and the key, with the log unchanged and nothing kept or published

#### Scenario: Tree and Gantt answers
- **WHEN** the Tree, Gantt, WBS and Gantt plan answers of the existing suites are given
- **THEN** each is logged as before

### Requirement: Answers of LaTeX, Kanban and Timeline
`ask-core` SHALL log a LaTeX, Kanban or Timeline answer with the changes the one generic diff computes against the revision the answer names, keep the full edited value, and refuse an edited value its type's checks refuse, with the log unchanged (AD-10, AD-20, FR-18, FR-20).

#### Scenario: A corrected expression
- **WHEN** the user answers a question holding the LaTeX item `formula` with its expression edited
- **THEN** the answer event's `changes` hold one `set` of `formula.expression`, and `fetch` of the item returns the edited expression

#### Scenario: A corrected expression that defines a macro
- **WHEN** an answer's value for the LaTeX item `formula` holds `\def\a{x}\a`
- **THEN** it is refused, naming the item and `\def`, with the log unchanged and nothing kept or published

#### Scenario: A corrected expression past the LaTeX's bounds
- **WHEN** an answer's value for the LaTeX item `formula` holds `\color{x}\current@color`, then a nest one level past the limit
- **THEN** each is refused, naming the item and `\current@color`, then the depth and the limit, with the log unchanged and nothing kept or published

#### Scenario: A moved card
- **WHEN** the user answers with a Kanban card moved from `todo` to `done`
- **THEN** the answer event's `changes` hold one `set` of the card's `column` to `done`

#### Scenario: A card moved into a column the item does not hold
- **WHEN** an answer's value for a Kanban puts a card in `blocked`, which is no column of the item
- **THEN** it is refused, naming the item and the card, with the log unchanged

#### Scenario: A milestone given an end
- **WHEN** an answer's value for a Timeline gives the milestone `launch` an `end`
- **THEN** it is refused, naming the item and `launch`, with the log unchanged

#### Scenario: A range moved
- **WHEN** the user answers with a Timeline range moved three days later
- **THEN** the answer event's `changes` hold the `set`s of its `start` and `end`, each three days later
