## MODIFIED Requirements

### Requirement: Answers only from an explicit user action
An answer event SHALL come only from a board's answer or decline act on an open ask's question, naming its current `rev` or one the user kept (edit choice), with content that revision can hold: option labels, one unless `multiSelect`; "Other…" text only with `allowOther`; values only for its widget items; and, unless it declines, a label, "Other…" text, a widget change, a result or `asSent: true` ("An answer accepted as sent"). Other acts SHALL be refused and append nothing (AD-10, NFR-10).

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
- **WHEN** an answer to a question with no options carries a Tree value equal to the Tree as sent, and nothing else, without `asSent`
- **THEN** it is refused as an answer with no content, and the log is unchanged

## ADDED Requirements

### Requirement: An answer accepted as sent
An answer with `asSent: true` SHALL be accepted only when it names the question's current revision; that revision has no options and holds an item whose widget type edits agent content; the act carries no choice, "Other…" text, option notes or decline, and results only for input fields; its widget values equal the items as sent; and the field checks pass. Its event SHALL carry `asSent: true`, the note, those results and the derived values, and no `changes` (AD-10, NFR-10).

#### Scenario: A Tree accepted as sent
- **WHEN** the board sends an answer with `asSent: true` and the note "Fine as it is" to a question with no options holding an editable Tree, naming its current `rev`
- **THEN** one answer event is appended with `asSent: true`, that note and no `changes`, and the question becomes `answered`

#### Scenario: Accepted as sent on a kept revision is refused
- **WHEN** the user kept revision 1 with an edit choice after the agent's update to revision 2, and the board sends `asSent: true` naming revision 1
- **THEN** it is refused, naming the current revision, and the log is unchanged

#### Scenario: Accepted as sent beside a change
- **WHEN** an answer with `asSent: true` carries a Tree value that moves a node
- **THEN** it is refused, naming the item, and the log is unchanged

#### Scenario: Accepted as sent where it does not apply
- **WHEN** an answer with `asSent: true` names a question that has options, holds no item whose widget edits agent content, or carries a choice, "Other…" text, option notes or a result of an item that is no input field, or comes as a decline
- **THEN** it is refused, its detail naming that reason, and the log is unchanged

#### Scenario: Accepted as sent with a required field empty
- **WHEN** an answer with `asSent: true` names a question whose Table sits beside a required TextField that has no result
- **THEN** it is refused, naming the field and its check, and the log is unchanged

#### Scenario: Accepted as sent with a filled required field
- **WHEN** an answer with `asSent: true` names an untouched Table beside a required TextField, and carries that field's result
- **THEN** one answer event is appended with `asSent: true`, the field's result in `results` and no `changes`
