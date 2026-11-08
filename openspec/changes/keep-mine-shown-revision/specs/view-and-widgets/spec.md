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
- **THEN** the Tree shows the user's edited value read-only, and the answer sends that value naming revision 1

#### Scenario: Without a reload nothing changes
- **WHEN** the agent changes the question while the page that saw revision 1 is open, and the user chooses "Keep mine"
- **THEN** the card shows revision 1, every widget takes edits, and no line shows
