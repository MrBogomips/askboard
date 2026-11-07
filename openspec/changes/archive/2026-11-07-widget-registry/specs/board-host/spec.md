## ADDED Requirements

### Requirement: Widget results in acts and the draft mirror
`board-host` SHALL pass an act whose answer carries `results` to `ask-core` as it passes any act, answering `done` or `refused` naming the action ID and the act's index, then the state; and SHALL keep a draft record's `results` and give them back on connect, reconnect and takeover as it does `values` (AD-20, AD-21).

#### Scenario: A result the Tree cannot give
- **WHEN** the board page sends an answer act whose `results` name a Tree item
- **THEN** `board-host` sends `refused` with reason `act`, the action ID and the act's index, then the state, in which the question is still open

#### Scenario: A held result after a takeover
- **WHEN** a board page mirrors a draft record whose question holds a result, and a second board page takes the ask over
- **THEN** the second page receives that draft record with the result unchanged
