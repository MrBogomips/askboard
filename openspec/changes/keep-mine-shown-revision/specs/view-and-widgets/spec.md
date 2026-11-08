## ADDED Requirements

### Requirement: Edit widgets on a revision the board cannot show
While a card shows a revision other than the one its answer names, as after a reload or a takeover when the work was made on a revision the page never saw, every item whose type edits the agent's content SHALL be read-only, at every depth of its layouts, with a line under it saying why. The board SHALL take no edit of such an item, so that an answer never counts the agent's change as the user's (NFR-10, AD-10, AD-20).

#### Scenario: An agent's change is not counted as the user's after a reload
- **WHEN** a question holds a Kanban and a TextField, the user types in the TextField, the agent's `update` changes a card's text, the tab reloads and the user chooses "Keep mine"
- **THEN** the Kanban shows the agent's revision read-only with the line, and "Answer" sends the TextField's result and no value for the Kanban, naming the earlier revision, so its logged `changes` hold nothing for the Kanban

#### Scenario: No edit while the notice still shows after a reload
- **WHEN** the tab reloads while the notice shows on such a question, and the user tries to move a card by drag or by "Move to…"
- **THEN** the card does not move, the draft takes no value for the Kanban, and "Keep mine" drops no edit made after the reload

#### Scenario: An edit widget inside a layout
- **WHEN** the same happens with the Kanban inside a Group
- **THEN** the Kanban is read-only with the line, and the Group's other items behave as their own types say

### Requirement: What stays usable beside a read-only edit widget
A value an edit widget held from before the reload SHALL stay and be sent as the item shows it. The question's other items, its options, the open prompt and the notice's choices SHALL work as before. Once no work remains on the earlier revision, or the page shows the revision the work was made on, the item SHALL be editable again and the line SHALL go (FR-6, AD-20).

#### Scenario: Reload makes it editable
- **WHEN** the user chooses "Reload, losing my work" on that question
- **THEN** the line goes, the Kanban takes edits on the agent's revision, and the answer names that revision

#### Scenario: A value from before the reload is sent as shown
- **WHEN** the user edited a Tree on revision 1, the agent changes the question, the tab reloads, the user chooses "Keep mine" and presses "Answer"
- **THEN** the Tree shows the user's edited value read-only, and the answer sends that value naming revision 1, with no derived value

#### Scenario: Without a reload nothing changes
- **WHEN** the agent changes the question while the page that saw revision 1 is open, and the user chooses "Keep mine"
- **THEN** the card shows revision 1, every widget takes edits, and no line shows

### Requirement: No derived values in an answer naming an earlier revision
An answer that names an earlier revision than its question's current one, the work the user kept over the agent's change (FR-6), SHALL carry no derived values, with or without a reload: the board computes them on the current revision only, so values sent with it would count the agent's change as the user's. Its other content SHALL be sent as before, by "Answer" and by Submit alike (FR-12, NFR-10, AD-10, AD-13).

#### Scenario: A computing item the agent added, after a reload
- **WHEN** a question holds a TextField and a Kanban, the user types in the TextField, the agent's `update` adds a Gantt to the question, the tab reloads, and the user chooses "Keep mine" and presses "Answer"
- **THEN** the answer is logged naming the earlier revision, with the TextField's result and no derived value

#### Scenario: The kept revision without a reload
- **WHEN** the user renamed a work package in the UJ-2 question's Tree on revision 1, the agent changes the plan's tasks, and the user chooses "Keep mine" on the page that saw revision 1 and presses "Answer"
- **THEN** the answer names revision 1 with the rename in its `changes` and no derived value

#### Scenario: A held answer on the kept revision
- **WHEN** in submitted delivery a held answer names an earlier revision than its question's current one, its computing items report derived values, and the user presses Submit
- **THEN** its act carries no derived value, and a held answer on its question's current revision carries them as before

## MODIFIED Requirements

### Requirement: Derived values of every computing item in an answer
An answer that names its question's current revision SHALL carry the declared derived values of every computing item in its question, a widget item whose widget declares answer-derived fields, changed or not, as they stood when the user answered, so that the agent never recomputes them. Derived values SHALL never be an answer's only content: they go beside a choice, "Other…" text or a widget value, and an answer with nothing else SHALL be refused (FR-12, AD-10).

#### Scenario: Only the WBS edited
- **WHEN** the user re-estimates one work package in the UJ-2 question's WBS, leaves the plan untouched and presses "Answer"
- **THEN** the answer act's `values` hold `wbs__tree` alone, and its `derived` holds `schedule__plan.finish` and `schedule__plan.criticalPath` as the board showed them, beside the WBS's derived values

#### Scenario: A choice beside an untouched plan
- **WHEN** a question holding options and a Gantt plan is answered with an option alone
- **THEN** the answer act carries the option and the plan's derived values, and no `values`

### Requirement: Answering a question with a Gantt
"Answer" SHALL send one answer message carrying each changed widget's full edited value and, when it names the question's current revision, the declared derived values of every Gantt in the question as they stand, changed or not; an untouched Gantt sends no value, only its derived values. The question SHALL then be read-only (AD-10, AD-20, FR-12).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved answer's edits with the keyboard, in the Tree and in the plan, and presses "Answer"
- **THEN** one answer message leaves the view; the contract's diff of the sent and the edited plan equals the approved `schedule` operation, and its derived values are `schedule.finish` `2026-12-02` and `schedule.criticalPath` `ux`, `prototype`, `portal`, `reporting`

#### Scenario: Nothing changed
- **WHEN** a Gantt question opens and the user only zooms and moves the focus
- **THEN** "Answer" stays disabled

### Requirement: Answering a work breakdown question
"Answer" SHALL send one answer message carrying the full edited value of each changed item and, when it names the question's current revision, the derived values of the Tree with `pert` and of the plan as they stand (AD-20, FR-12, F7).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved answer's `wbs` edits by keyboard on the expanded UJ-2 question and presses "Answer"
- **THEN** one answer message leaves the view, holding `wbs__tree` and `schedule__plan`; put in reference addressing by `ask-core`, its changes are the approved eight operations and its derived values the approved fourteen; and no CSP violation is reported
