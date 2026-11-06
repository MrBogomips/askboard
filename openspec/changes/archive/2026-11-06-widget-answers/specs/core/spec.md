# Spec Delta

## MODIFIED Requirements

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

### Requirement: Full value of an item
`ask-core` SHALL return, for an item of an open or closed ask's current board document, its type, `rev` and props, and for a question its state and current answer in full: its content, the full edited value of each widget item it changed and its derived values, `who`, `when`, whether it was recorded, and the cursor of its event when logged (FR-20).

#### Scenario: A deleted item
- **WHEN** the full value of a deleted item is asked for
- **THEN** none is returned, and the item is reported as deleted

#### Scenario: An answered widget question
- **WHEN** the full value of the answered UJ-2 question `plan` is asked for
- **THEN** its answer holds the edited WBS under `wbs` and the edited plan under `schedule`, and the fourteen derived values, with no expanded ID anywhere

## ADDED Requirements

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
When an answer event with its `changes` and derived values would exceed the contract's largest answer event, `ask-core` SHALL log it without them and with `tooLarge: true`, keeping the full edited values and derived values for `fetch` (FR-20, AD-6).

#### Scenario: Every node of a large Tree renamed
- **WHEN** the user renames all 500 nodes of a Tree and answers
- **THEN** the event carries `tooLarge: true` and no `changes` or `derived`, and the question's full value holds the edited Tree and its derived values

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
