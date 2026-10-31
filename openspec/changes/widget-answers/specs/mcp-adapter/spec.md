# Spec Delta

## ADDED Requirements

### Requirement: Widget asks refused with worded problems
An `ask` or `update` whose widget items or molecule references fail validation or expansion SHALL return `isError` text that names each item's ID in the agent's addressing, the field and the expected shape, first problems first, under 4,000 characters (AD-6).

#### Scenario: Data outside a molecule's parameters
- **WHEN** an agent sends the UJ-2 ask with `schedule`'s `start` set to `11/02/2026`
- **THEN** the result is an error naming `schedule`, `data.start` and the date form a plan takes, and no board opens

### Requirement: Formula warnings in results
The `ask` and `update` results SHALL carry each `formula` warning the send-time graph check gives, beside the no-hooks warning, and the request SHALL succeed (AD-6, AD-13, FR-14).

#### Scenario: A cycle in a plan
- **WHEN** an agent asks a Gantt whose two tasks depend on each other
- **THEN** the `ask` result holds the board link and a `formula` warning of kind `cycle` naming the Gantt's ID

### Requirement: Collecting widget answers
`collect` SHALL return a widget answer's event as `ask-core` logged it: its `changes` and `derived` in reference addressing, or `tooLarge: true` without them, and SHALL never return a full edited value (FR-18, FR-20).

#### Scenario: The UJ-2 answer by pull
- **WHEN** an agent collects after the user answered the UJ-2 question and postponed `erp-export` with one Submit
- **THEN** the result holds one answer event to `plan` whose `changes` and `derived` are the approved ones and the `postponed` event of `erp-export`, as the approved answer has them

### Requirement: Fetching widget items and references
`fetch` SHALL take the ID of a widget item or molecule reference in a question and return that item as `ask-core` gives it, paged as any long value; for a question, the answer it returns SHALL hold the edited values and derived values in reference addressing (FR-20, AD-9).

#### Scenario: Fetching the WBS
- **WHEN** an agent fetches `wbs` after the UJ-2 answer
- **THEN** the result holds a Tree with the ID `wbs` whose nodes include `u-1`, and no expanded ID

#### Scenario: Fetching a too-large answer
- **WHEN** an agent fetches the question of an answer logged with `tooLarge: true`
- **THEN** the result, in pages if needed, holds the answer's edited values and derived values
