## MODIFIED Requirements

### Requirement: Answering a question with a widget
"Answer" SHALL be enabled once the question has a choice, a widget holds a change or a widget holds a result. It SHALL send one answer message carrying the chosen options, if any, the full edited value of each changed widget item in its input-format shape, the result of each widget that holds one, and nothing for an untouched one. On a question with no options whose widgets hold no change and no result, "Accept as is" SHALL be the act that answers with the content as sent. After either, the question SHALL be read-only (AD-10, AD-20, FR-22).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved UJ-2 answer's `wbs` edits with the keyboard and presses "Answer"
- **THEN** one answer message leaves the view, its Tree value validates as an edited value, and the contract's diff of the sent and the edited value equals the approved `wbs` operations

#### Scenario: Nothing changed
- **WHEN** a Tree question with no options opens and the user only moves the focus and expands and collapses nodes
- **THEN** "Answer" stays disabled and "Accept as is" is offered

#### Scenario: A result alone
- **WHEN** a question's only content is a result its widget holds in the draft record
- **THEN** "Answer" is enabled, and the answer it sends carries `results` with that result and no `values`

## ADDED Requirements

### Requirement: When Accept as is is offered
"Accept as is" ("Accetta così com'è") SHALL sit in the question actions row beside the primary, offered only on a question with no options that holds an item whose widget edits agent content (Tree, Gantt, Table, Kanban, Timeline, LaTeX, a molecule's expansion included), while the question is to do or in draft and no item holds a change against the revision the card shows or a result. It SHALL NOT show on an answered, ready or declined question, a locked board or a Snapshot (FR-3, AD-10).

#### Scenario: Gone with an edit, back when the edit is undone
- **WHEN** the user moves a Tree node, then moves it back to where the agent sent it
- **THEN** "Accept as is" is not offered while the node is moved, and is offered again once the Tree equals what was sent

#### Scenario: Not on a question with options
- **WHEN** a question has options, a recommended one among them, and an untouched Gantt
- **THEN** it shows "Accept recommended" and no "Accept as is"

#### Scenario: A Snapshot of an accepted question
- **WHEN** a Snapshot is taken of an ask with a question answered with "Accept as is"
- **THEN** the opened Snapshot shows "Answer: Accepted as is" and no "Accept as is" button

### Requirement: Accept as is answers as Answer does
One press of "Accept as is" SHALL take the path of "Answer", with its field checks, its confirmation of a received verdict, its delivery and the move After an answer. Sent, it SHALL be one answer act with `asSent: true`, the note if any, the derived values and no widget value; the status says "Answer sent: accepted as is." and the card's line "Answer: Accepted as is". It has no key of its own (FR-22, AD-10, NFR-12).

#### Scenario: A Tree accepted in one click
- **WHEN** on a board in "One by one" the user presses "Accept as is" on an untouched Tree question with no options, with "Fine as it is" in its note
- **THEN** one answer act with `asSent: true`, that note and no `values` is sent, the card reads "Answer: Accepted as is", the status region says "Answer sent: accepted as is.", and the next question to do moves to the top

#### Scenario: Blocked by a field
- **WHEN** an untouched Table question also holds a required TextField left empty, and the user presses "Accept as is"
- **THEN** nothing is sent and the reason "Complete {label} first." shows, as for "Answer"

#### Scenario: Revising an accepted answer
- **WHEN** the user presses "Edit" on a question answered with "Accept as is", moves a Tree node and presses "Answer"
- **THEN** the answer sent carries the Tree's value and replaces the accepted answer, with the confirmation of a received verdict first where its items ask for one

#### Scenario: From the keyboard
- **WHEN** the user tabs to "Accept as is" and presses Enter
- **THEN** it acts as a click, and `Ctrl+Enter` on the card with no change sends nothing

### Requirement: Accept as is in All together
In submitted delivery, "Accept as is" SHALL mark the question's answer ready, held as accepted as sent. Submit SHALL send that held answer as an answer act with `asSent: true`, in the order the user produced it. A reload or takeover SHALL restore the held answer as accepted. "Edit" on that ready answer SHALL unmark it, as it unmarks any ready answer (AD-20, FR-22).

#### Scenario: Ready, then sent by Submit
- **WHEN** in "All together" the user presses "Accept as is" on an untouched Kanban question, then presses Submit
- **THEN** the card reads "Ready, not sent" until Submit, and Submit's command carries an answer act with `asSent: true` and no `values` for it

#### Scenario: A reload keeps it ready
- **WHEN** the user reloads the tab after marking a Timeline question ready with "Accept as is"
- **THEN** the card is still ready and accepted as is, and Submit sends it with `asSent: true`
