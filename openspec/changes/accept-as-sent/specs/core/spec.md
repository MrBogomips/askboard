## MODIFIED Requirements

### Requirement: Answers only from an explicit user action
An answer event SHALL come only from an answer or decline act of the board on a question of an open ask. The act SHALL name the question's current `rev`, or an older one the user kept (edit choice). Its content SHALL be what that revision can hold: option labels, one unless `multiSelect` is set; "Other…" text only with `allowOther`; widget values only for its widget items. It SHALL also carry at least a label, "Other…" text, a widget change, a result or `asSent: true`, unless it declines. An answer with `asSent: true` SHALL be accepted only when all of these hold:

- the named revision has no options and holds at least one item whose widget type edits agent content;
- the act carries no choice, "Other…" text, option notes or results, and is no decline;
- every widget value it carries equals the item as sent;
- the question's field checks pass.

Its event SHALL carry `asSent: true`, the note and derived values the act gives, and no `changes`. Any other act SHALL be refused and append nothing (AD-10, NFR-10).

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

#### Scenario: A Tree accepted as sent
- **WHEN** the board sends an answer with `asSent: true` and the note "Fine as it is" to a question with no options holding an editable Tree, naming its current `rev`
- **THEN** one answer event is appended with `asSent: true`, that note and no `changes`, and the question becomes `answered`

#### Scenario: Accepted as sent on a kept revision
- **WHEN** the user kept revision 1 with an edit choice after the agent's update to revision 2, and the board sends `asSent: true` naming revision 1
- **THEN** the answer is checked against revision 1's items and appended naming `rev` 1

#### Scenario: Accepted as sent beside a change
- **WHEN** an answer with `asSent: true` carries a Tree value that moves a node
- **THEN** it is refused, naming the item, and the log is unchanged

#### Scenario: Accepted as sent where it does not apply
- **WHEN** an answer with `asSent: true` names a question that has options, holds no item whose widget edits agent content, or carries a choice, "Other…" text, option notes or results, or comes as a decline
- **THEN** it is refused and the log is unchanged

#### Scenario: Accepted as sent with a required field empty
- **WHEN** an answer with `asSent: true` names a question whose Table sits beside a required TextField that has no result
- **THEN** it is refused, naming the field and its check, and the log is unchanged
