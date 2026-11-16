## ADDED Requirements

### Requirement: Answers accepted as sent in the board state
`board-host` SHALL pass an `act` whose answer carries `asSent: true` to `ask-core` as it passes any act. The state it then sends SHALL hold the question's answer with `asSent: true` on every connect, reconnect and takeover, in the current and in the previous answer (AD-10, AD-20, AD-21).

#### Scenario: A reload after an accepted Tree
- **WHEN** the board page reconnects after a Tree question was answered with "Accept as is"
- **THEN** the state holds that answer with `asSent: true` and no `values`, with receipt `sent`, or `delivered` once collected

#### Scenario: A refused acceptance
- **WHEN** the board page sends an answer with `asSent: true` on a question with options
- **THEN** `board-host` sends `refused` with reason `act`, the action ID and the act's index, then the state, in which the question is still open
