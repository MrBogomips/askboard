# Spec Delta

## REMOVED Requirements

### Requirement: The board page refuses widget answers for now
**Reason**: Board protocol 1.2 carries a widget's value, so the refusal the `tree-widget` change built on purpose until then is lifted.
**Migration**: Replaced by "The board page sends widget answers" and "Board documents with widget items". E1's `answer` command keeps refusing widget values, since it is the choice-only command of protocol 1.0 pages.

## ADDED Requirements

### Requirement: Board documents with widget items
The board page SHALL accept a board document whose questions hold Tree and Gantt items, validate it with the standalone validators of board document 1.2, and build the view from it; a board document holding a `molecule` item SHALL still be refused (AD-9, AD-10).

#### Scenario: The UJ-2 board
- **WHEN** `board-host` sends the UJ-2 ask's board document
- **THEN** the board page builds the view, and the question `plan` shows the WBS and the plan and counts as visible

### Requirement: The board page sends widget answers
The board page SHALL turn the view's answer message with widget values into an `answer` act carrying `values` and `derived`, after the checks every answer passes (question open, at its revision, visible, no failed item), and only for widget items of that question (AD-10, AD-20, FR-22).

#### Scenario: The UJ-2 edits answered
- **WHEN** the user makes the approved UJ-2 edits by keyboard and presses "Answer" on the real board page
- **THEN** one `act` reaches `board-host`, its answer carrying `values` for `wbs__tree` and `schedule__plan` and their derived values

#### Scenario: A value for an item of another question
- **WHEN** an answer message names in `values` an item that is not in its question
- **THEN** the board page refuses it, sends nothing and leaves the question open

### Requirement: Answered widget questions
A question whose widget answer is logged SHALL show each widget read-only with the logged value and the answer's delivery receipt, also after a reload or a takeover, which restore it from the board state (AD-20, AD-21; EXPERIENCE, By surface: Question, Answered).

#### Scenario: A reload after answering
- **WHEN** the user reloads the board after answering the UJ-2 question
- **THEN** the WBS and the plan show the edited values read-only, with the receipt the board state gives

### Requirement: Revising a widget answer
While the ask is open, the user SHALL be able to revise a widget answer: its widgets become editable from the logged value, an edit fills the draft, and "Answer" sends the full edited values again (AD-20; EXPERIENCE, Interaction Primitives, Revisions).

#### Scenario: Revising the WBS
- **WHEN** the user revises the answered UJ-2 question and renames one more node
- **THEN** the change highlight still compares against the agent's original, and the new answer carries both edited values in full

### Requirement: The agent's change to a widget under unsent work
When the agent changes a widget item whose question holds unsent work, the agent-change notice's "Show the agent's change" SHALL name each widget item the agent changed and how many element operations the change holds, and the notice's choices SHALL be those of every question (FR-6; EXPERIENCE, Agent-change notice).

#### Scenario: New data for the plan while the user edits the WBS
- **WHEN** the agent changes `schedule`'s data while the user holds unsent WBS edits in `plan`
- **THEN** the notice shows, and "Show the agent's change" names the Gantt plan and its number of operations, and nothing of the user's draft is lost
