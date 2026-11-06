# Spec Delta

## ADDED Requirements

### Requirement: Widget answer acts
`board-host` SHALL pass an `act` whose answer carries widget values to `ask-core` as it passes any act, and SHALL answer it with `done` or `refused` naming the action ID and the act's index, followed by the state (AD-10, AD-20).

#### Scenario: A refused widget answer
- **WHEN** the board page sends an answer whose Tree value names a node twice
- **THEN** `board-host` sends `refused` with reason `act`, the action ID and the act's index, then the state, in which the question is still open

### Requirement: Widget answers in the board state
After a widget answer is logged, the state `board-host` sends SHALL hold the question's answer with its logged `values`, on every connect, reconnect and takeover (AD-20, AD-21).

#### Scenario: A reload after a Tree answer
- **WHEN** the board page reconnects after the UJ-2 question was answered
- **THEN** the state holds that answer's `values` for `wbs__tree` and `schedule__plan` with receipt `sent`, or `delivered` once collected

### Requirement: The session's molecule source
The session process SHALL give `ask-core` the molecule source over the shipped definitions, reading no file and opening no connection, and creating nothing before the first lookup (AD-2, AD-9, AD-11).

#### Scenario: The first ask with a reference
- **WHEN** the session process has started and an agent sends the UJ-2 ask
- **THEN** `wbs-pert` 1.0.0 and `gantt-plan` 1.0.0 are found, and no file under the project is read for them
