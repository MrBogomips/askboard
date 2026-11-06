## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Answers too large for one result
When an answer event with its `changes`, `results` and derived values would exceed the contract's largest answer event, `ask-core` SHALL log it without them and with `tooLarge: true`, keeping the full edited values, results and derived values for `fetch` (FR-20, AD-6).

#### Scenario: Every node of a large Tree renamed
- **WHEN** the user renames all 500 nodes of a Tree and answers
- **THEN** the event carries `tooLarge: true` and no `changes` or `derived`, and the question's full value holds the edited Tree and its derived values

#### Scenario: A large result
- **WHEN** an answer's probe result alone takes the event over the largest answer event
- **THEN** the event carries `tooLarge: true` and no `results`, and the question's full value holds the result
