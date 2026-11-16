## ADDED Requirements

### Requirement: An answer accepted as sent in the answer act
The board protocol's `answer` act SHALL take the optional `asSent: true`: the user accepted the question's content as the agent sent it. With `asSent` it SHALL refuse `choice`, `other`, `optionNotes` and `results`, and admit `note`, `derived` and `values`, whose equality with what was sent `ask-core` checks (AD-10, AD-20). The board protocol moves to the next minor after main's; the field is optional, so the previous minor's acts stay valid.

#### Scenario: An accepted Tree in an act
- **WHEN** the board page sends an `act` whose answer to `plan` carries `asSent: true`, a `note` and `derived`
- **THEN** it validates against the board protocol

#### Scenario: Accepted as sent beside a choice
- **WHEN** an `answer` act carries `asSent: true` beside `choice`, `other`, `optionNotes` or `results`
- **THEN** it is refused as a schema error naming that field

### Requirement: A held answer accepted as sent in the draft record
A held answer in the draft record SHALL take the optional `asSent: true`, so that Submit sends it as accepted; no other held act SHALL take it (AD-20).

#### Scenario: A held answer accepted as sent
- **WHEN** a draft record holds, for a question, `held: {act: "answer", order: 0, asSent: true}`
- **THEN** it validates; `asSent` on a held decline, postpone, note or reopen is refused

### Requirement: An answer accepted as sent in the output format
The output format's answer event SHALL admit the optional `asSent: true`. An event with `asSent` SHALL carry no `choice`, `other`, `optionNotes`, `changes`, `results` or `declined`. It MAY carry `note`, `derived`, `replaces` and `tooLarge` (FR-18, AD-10). The output format, and the tool envelopes that name it, move to the next minor after main's.

#### Scenario: An accepted answer event
- **WHEN** an answer event carries `asSent: true`, a `note` and `derived`
- **THEN** it validates against the answer event schema

#### Scenario: Accepted as sent beside changes
- **WHEN** an answer event carries `asSent: true` and `changes`, `choice`, `results` or `declined: true`
- **THEN** it is refused as a schema error

#### Scenario: Earlier answer events
- **WHEN** each `answer` event of the fixtures `answers/*.json` is validated against the answer event schema of this minor
- **THEN** every one still passes

### Requirement: An answer accepted as sent in the board state, fetch and Snapshots
A question's current and previous answer in the board state, and the full answer in a `fetch` result, SHALL admit `asSent: true` with the same exclusions as the event. A Snapshot's data SHALL hold it as the board state and the events carry it. Snapshot data moves to the next minor after main's (FR-20, AD-15, AD-20).

#### Scenario: The board state of an accepted question
- **WHEN** the board state of a question answered with `asSent: true` is built
- **THEN** its answer holds `asSent: true`, its `when` and its receipt, and no `values`

#### Scenario: Fetching an accepted question
- **WHEN** `fetch` returns a question answered with `asSent: true`
- **THEN** its `answer` holds `asSent: true`, `who`, `when` and the event's cursor, and the result validates against the tool envelopes
