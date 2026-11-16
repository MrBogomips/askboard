## MODIFIED Requirements

### Requirement: Answering a question with a widget
"Answer" SHALL be enabled once the question has a choice, a widget holds a change or a widget holds a result. It SHALL send one answer message with the chosen options, the full edited value of each changed widget item in input-format shape, each widget's result, nothing for untouched ones. On a question with no options whose widgets hold no change and no result, "Accept as is" SHALL be the act that answers with the content as sent. Then the question SHALL be read-only (AD-10, AD-20, FR-22).

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
"Accept as is" ("Accetta così com'è") SHALL sit in the question actions row beside the primary. It SHALL be offered only on a question with no options holding an edit widget (Tree, Gantt, Table, Kanban, Timeline, LaTeX, molecules included), to do or in draft, shown at its current revision with no item read-only, where no edit widget holds a change and no item but an input field holds a result. It SHALL NOT show when answered, ready or declined, on a locked board or in a Snapshot (FR-3, AD-10).

#### Scenario: Gone with an edit, back when the edit is undone
- **WHEN** the user moves a Tree node, then moves it back to where the agent sent it
- **THEN** "Accept as is" is not offered while the node is moved, and is offered again once the Tree equals what was sent

#### Scenario: Not on a kept revision
- **WHEN** the agent updates a Tree question the user had edited and holds a note on, the user chooses "Keep mine", then moves the node back to where revision 1 had it, the note still held
- **THEN** the card still shows revision 1 and "Accept as is" is not offered; after "Reload, losing my work" the card shows the current revision and offers it

#### Scenario: Not on a question with options
- **WHEN** a question has options, a recommended one among them, and an untouched Gantt
- **THEN** it shows "Accept recommended" and no "Accept as is"

#### Scenario: A Snapshot of an accepted question
- **WHEN** a Snapshot is taken of an ask with a question answered with "Accept as is"
- **THEN** the opened Snapshot shows "Answer: Accepted as is" and no "Accept as is" button

### Requirement: Accept as is answers as Answer does
One press of "Accept as is" SHALL take the path of "Answer", with its field checks, its confirmation of a received verdict, its delivery and the move After an answer. Sent, it SHALL be one answer act with `asSent: true`, the note if any, the input fields' results, the derived values and no widget value; the status says "Answer sent: accepted as is." and the card's line "Answer: Accepted as is". It has no key of its own (FR-22, AD-10, NFR-12).

#### Scenario: A Tree accepted in one click
- **WHEN** on a board in "One by one" the user presses "Accept as is" on an untouched Tree question with no options, with "Fine as it is" in its note
- **THEN** one answer act with `asSent: true`, that note and no `values` is sent, the card reads "Answer: Accepted as is", the status region says "Answer sent: accepted as is.", and the next question to do moves to the top

#### Scenario: Blocked by a field
- **WHEN** an untouched Table question also holds a required TextField left empty
- **THEN** "Accept as is" is disabled, not hidden, with the reason "Complete {label} first.", as for "Answer", and a press sends nothing

#### Scenario: A filled field travels with the acceptance
- **WHEN** the user fills that required TextField and presses "Accept as is"
- **THEN** one answer act with `asSent: true` and the field's result in `results` is sent, and no `values`

#### Scenario: Revising an accepted answer
- **WHEN** the user presses "Edit" on a question answered with "Accept as is", moves a Tree node and presses "Answer"
- **THEN** the answer sent carries the Tree's value and replaces the accepted answer, with the confirmation of a received verdict first where its items ask for one

#### Scenario: From the keyboard
- **WHEN** the user tabs to "Accept as is" and presses Enter
- **THEN** it acts as a click, and `Ctrl+Enter` on the card with no change sends nothing

### Requirement: Accept as is in All together
In submitted delivery, "Accept as is" SHALL mark the question's answer ready, held as accepted as sent. Submit SHALL send that held answer as an answer act with `asSent: true`, in the order the user produced it. A reload or takeover SHALL restore the held answer as accepted. "Edit" on that ready answer, or "Keep mine" on its question, SHALL unmark it (AD-20, FR-22).

#### Scenario: Ready, then sent by Submit
- **WHEN** in "All together" the user presses "Accept as is" on an untouched Kanban question, then presses Submit
- **THEN** the card reads "Ready, not sent" until Submit, and Submit's command carries an answer act with `asSent: true` and no `values` for it

#### Scenario: Keep mine unmarks a held acceptance
- **WHEN** in "All together" a held undo of a postpone lies beneath a held acceptance, the agent updates the question, and the user chooses "Keep mine"
- **THEN** the acceptance is no longer held and the card reads Draft while work is left (a note, a kept value or entry), else To do, the undo is held again, and Submit sends no acceptance naming the earlier revision

#### Scenario: A reload keeps it ready
- **WHEN** the user reloads the tab after marking a Timeline question ready with "Accept as is"
- **THEN** the card is still ready and accepted as is, and Submit sends it with `asSent: true`
