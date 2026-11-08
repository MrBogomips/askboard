## MODIFIED Requirements

### Requirement: Reopened question
A question the agent reopens SHALL show "Reopened by the agent", the previous answer read-only, and "Start from my previous answer", which moves that answer into the draft as far as the question's current revision takes it. The notice SHALL say in one line whether the board started the question from that answer or from the agent's version (AD-10, AD-20).

#### Scenario: Starting from the previous answer
- **WHEN** the user presses "Start from my previous answer" on a reopened question
- **THEN** the previous choice is selected in the draft, and nothing is sent until "Answer"

#### Scenario: The line names where the question started
- **WHEN** the agent reopens an answered question and changes nothing else
- **THEN** the notice reads "Your previous answer is filled in. Change it or answer again."

## ADDED Requirements

### Requirement: A reopened question starts from the previous answer
When the agent reopens a question and the board state lists the question itself as unchanged since its previous answer's revision, the board SHALL fill the question's draft from that answer once per revision. It SHALL do so only while the ask is not closed, the board is not closed, discarded or moved, the question holds no work on any revision, and every part of the answer fits, by the rule for an answer carried into the draft. Nothing SHALL be sent until the user answers (AD-10, AD-20, FR-22).

#### Scenario: A reopened Timeline after a reload
- **WHEN** the user moves a Timeline entry and answers, the agent reopens the question, and the user reloads the board
- **THEN** the Timeline shows the moved entry with its change mark, and the notice reads "Your previous answer is filled in. Change it or answer again."

#### Scenario: A reload with no draft record held
- **WHEN** a reopened question qualifies for the prefill, `board-host` holds no draft record for the ask, and the user reloads the board
- **THEN** the question is filled once, with the first state the view receives

#### Scenario: A restored draft comes first
- **WHEN** the user reloads a board whose restored draft record holds work on a reopened question's current revision
- **THEN** the question shows that work, and nothing of the previous answer is filled over it

#### Scenario: Answering again keeps the earlier edit
- **WHEN** on that reopened question the user moves a second entry and presses "Answer"
- **THEN** the answer names the current revision and its `changes` hold both moves

#### Scenario: Answering at once
- **WHEN** the agent reopens a question answered with a choice and a Scale's value, and the user presses "Answer" without changing anything
- **THEN** the answer carries that choice and that value

#### Scenario: Reopened while the user holds work
- **WHEN** the agent reopens an answered question that the user is revising
- **THEN** the draft is not refilled, and the notice reads the line for a question that starts from the agent's version

#### Scenario: A closed ask after a reload
- **WHEN** the user reloads a board whose ask is closed, holding a question the agent reopened and listed as unchanged since its previous answer, and `board-host` holds no draft record from before the close
- **THEN** the draft is not filled, and leaving the page asks nothing

### Requirement: A reopened question the agent changed starts from the agent's version
When the board state does not list a reopened question itself as unchanged, or a part of its previous answer no longer fits, the board SHALL fill nothing. The question SHALL show the agent's revision, and the notice SHALL read "This question starts from the agent's version, not from your previous answer. "Start from my previous answer" brings back what still fits." (AD-10, FR-6).

#### Scenario: Reopened and changed in one update
- **WHEN** the agent reopens a question answered with a Timeline move and, in the same `update`, renames one of its lanes
- **THEN** the Timeline shows the agent's revision with no change mark, the draft is empty, and the notice reads the line for a question that starts from the agent's version

### Requirement: An answer carried into the draft brings back widget values
When "Start from my previous answer", a revision's start or the reopen prefill carries an answer into the draft, each edit widget item SHALL take the answer's value for it only if the answer holds the item unchanged and the item's type shows the value on its current props. Every other item SHALL show as the agent sent it. Results, choices and notes SHALL be carried as before (AD-10, AD-20).

#### Scenario: One widget changed by the agent
- **WHEN** a question answered with edits to a Timeline and a Kanban is reopened, the agent adds a card to the Kanban, and the user presses "Start from my previous answer"
- **THEN** the draft holds the Timeline's previous value and no Kanban value, and the Kanban shows the agent's revision

#### Scenario: What is sent is what is shown
- **WHEN** after that the user presses "Answer"
- **THEN** the answer carries the Timeline's value and no Kanban value, and `ask-core` accepts it

### Requirement: Which items an answer holds unchanged
The board SHALL hold an item unchanged since an answer's revision when the answer's `unchanged` lists it. A current answer without the list SHALL hold every item unchanged, since it names the current revision; a previous answer without it SHALL hold none (AD-10, NFR-10).

#### Scenario: A previous answer without the list
- **WHEN** a reopened question's previous answer holds edits to a Timeline and no `unchanged`, and the user presses "Start from my previous answer"
- **THEN** the draft holds no Timeline value, and the Timeline shows the agent's revision

#### Scenario: A current answer without the list
- **WHEN** the user revises an answered question whose answer holds a Timeline edit and no `unchanged`
- **THEN** the draft holds the Timeline's answered value from the first edit

### Requirement: A revision keeps the widgets' edits
The first edit of an answered question SHALL put its latest answer's widget values into the draft, by the rule for an answer carried into the draft, as it puts the answer's results, choice and note. A revised answer SHALL carry the edits the user left untouched, as the card shows them (AD-10, AD-20).

#### Scenario: A revision after an answer on an earlier revision
- **WHEN** the user renames a Tree node, the agent changes the Tree, the user chooses "Keep mine" and answers, then edits another item of the question
- **THEN** the Tree shows the agent's revision, not the rename, and the revised answer carries no value for it

#### Scenario: A result the agent's revision no longer takes
- **WHEN** the user answers 7 in a NumberField, the agent sets its maximum to 5, the user chooses "Keep mine" and answers, then edits another field of the question
- **THEN** the NumberField shows no value, and the revised answer carries no result for it

#### Scenario: Revising one of two edited widgets
- **WHEN** a question answered with edits to a Timeline and a Kanban is revised by moving one more Kanban card, and "Answer" is pressed
- **THEN** the revision carries both widgets' values, and its `changes` hold the earlier Timeline edit and both Kanban moves

### Requirement: The prefill is remembered
The draft record SHALL mark a question's work on a revision the board filled from the previous answer. A reload or a takeover SHALL not fill that revision again. A question whose work holds only the mark SHALL count as holding no unsent work (AD-20).

#### Scenario: An undone prefill after a reload
- **WHEN** on a prefilled reopened question the user moves the Timeline entry back to where the agent placed it, and reloads the board
- **THEN** the Timeline shows the agent's placement and the draft holds no Timeline value

#### Scenario: The mark alone is no unsent work
- **WHEN** the question's work holds only the mark and the user closes the tab
- **THEN** no leave-page prompt shows for it

### Requirement: Derived values of a reopened question's answer
An answer to a reopened question SHALL name its current revision. It SHALL carry the derived values of every computing item, computed from what the board shows, prefilled values included (FR-12, AD-13).

#### Scenario: A reopened Gantt
- **WHEN** a question answered with a moved Gantt task is reopened unchanged, and the user presses "Answer"
- **THEN** the answer carries the Gantt's value and the finish date and critical path computed from it
