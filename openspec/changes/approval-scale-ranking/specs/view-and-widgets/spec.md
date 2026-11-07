## ADDED Requirements

### Requirement: Approval decisions
An Approval SHALL show, under the label "Approval", the decisions "Approve", "Approve with changes" and "Reject" in that order, as one Tab stop whose arrow keys move between them. A decision SHALL only select, filling the draft with the item's result and sending nothing; the selected one SHALL show pressed with a ✓, and pressing it again SHALL clear it (FR-11, AD-10, EXPERIENCE Approval).

#### Scenario: Selecting a decision
- **WHEN** the user presses "Reject" on an open question holding an Approval
- **THEN** "Reject" shows pressed with a ✓, the draft holds `{decision: "reject"}` for the item, "Answer" is enabled and no view message leaves the view

#### Scenario: Clearing it
- **WHEN** the user presses the selected "Reject" again
- **THEN** no decision is selected, the draft holds no result for the item and, with nothing else in the draft, "Answer" is disabled

#### Scenario: At the keyboard
- **WHEN** focus is on "Approve" and the user presses the right arrow key, then Space
- **THEN** focus moves to "Approve with changes", which Space selects

### Requirement: Approving a question that holds changes
While another widget item of the Approval's question shows a change against what the agent sent, "Approve" SHALL be disabled and "Approve with changes" SHALL be the approving decision; a held "Approve" SHALL be cleared when such a change appears. "Reject" SHALL stay available and its answer SHALL carry the edits (FR-11, F-63).

#### Scenario: Editing a Tree beside an Approval
- **WHEN** the user has selected "Approve" and then renames a node of a Tree in the same question
- **THEN** "Approve" is disabled and no longer selected, the draft holds no result for the Approval, and "Approve with changes" and "Reject" can be selected

#### Scenario: Undoing the edit
- **WHEN** the user renames the node back to the agent's label
- **THEN** "Approve" is enabled again

### Requirement: The Approval summary
Beside the decisions, the Approval SHALL list the changes the user made to the other widget items of its question, from the generic diff of each item's shown value against its props as sent: a title counting them ("2 changes"), then one line per change naming the element and, for a field, its previous and new values in the ask's locale; at most 20 lines, then "and N more" (FR-11, L74, F-04).

#### Scenario: Two changed fields
- **WHEN** the user changes a Tree node's `effort` from 12 to 10 and renames another node
- **THEN** the summary is titled "2 changes" and holds two lines, each naming its node, with 12 struck through before 10

#### Scenario: Nothing changed
- **WHEN** the question's other items show no change
- **THEN** the summary reads "No changes"

#### Scenario: Many changes
- **WHEN** the user has changed 25 fields
- **THEN** the summary is titled "25 changes" and shows 20 lines and "and 5 more"

### Requirement: A reason the answer requires
When an item's held result requires the open prompt, "Answer" SHALL stay enabled; pressed with the prompt empty or white space only, it SHALL send and mark nothing, show the field error "Add the reason for your changes." under the prompt and move focus there. The error SHALL clear once the prompt holds text or no held result requires it (FR-11, L198, AD-10).

#### Scenario: Approve with changes and an empty reason
- **WHEN** the user selects "Approve with changes" and presses "Answer" with the open prompt empty
- **THEN** nothing is sent, the field error shows under the prompt, focus is in the prompt, and the question stays open

#### Scenario: Writing the reason
- **WHEN** the user then writes a reason and presses "Answer"
- **THEN** the error is gone and one answer is sent, carrying the decision and the reason as its note

#### Scenario: Submitted delivery
- **WHEN** the board is in submitted delivery and the user presses "Answer" with "Approve with changes" selected and no reason
- **THEN** the answer is not marked ready and the field error shows

### Requirement: Revising a received verdict asks first
On a question holding an item whose chunk asks for it, such as an Approval, whose latest answer the agent has received, "Answer" and "Decline" SHALL first ask the user to confirm, in a modal dialog; confirming SHALL act as the button does, and cancelling SHALL send nothing and keep the draft (F-63, FR-22).

#### Scenario: A delivered verdict revised
- **WHEN** the agent has collected "approve" and the user selects "Reject" and presses "Answer"
- **THEN** the confirmation opens and nothing is sent; "Cancel" closes it with "Reject" still selected, and confirming sends the revision, which names the answer it replaces

#### Scenario: Not yet delivered
- **WHEN** the latest answer's receipt reads "sent" and the user revises it
- **THEN** "Answer" sends the revision with no confirmation

### Requirement: A revision keeps the widgets' results
The first edit of an answered question SHALL put its latest answer's results into the draft for the items its current revision holds, as it puts the answer's choice and note, so that the revised answer carries them unless the user changes them (AD-20, FR-22).

#### Scenario: Revising a Tree beside an Approval
- **WHEN** a question answered "reject" with an Approval and a Tree is revised by renaming a Tree node, and "Answer" is pressed
- **THEN** the revision carries the Tree's change and `{decision: "reject"}` for the Approval

#### Scenario: Starting from a previous answer
- **WHEN** the user presses "Start from my previous answer" on a reopened question whose previous answer held a Scale's value
- **THEN** the draft holds that value for the Scale

### Requirement: Scale as a slider
A Scale slider SHALL start unset, with no thumb and "Not set" beside it. A click on the unset track SHALL set the value at the clicked point, snapped to a step; Home or an arrow key SHALL set `min`, End `max`; after that the slider SHALL move by its steps. A range SHALL start both thumbs at the first value. Values SHALL show in the ask's locale (FR-11, AD-10, renderer spike row 22).

#### Scenario: A first click on the track
- **WHEN** the user clicks an unset slider from 0 to 100 by 5 at 36% of its track
- **THEN** its value is 35, shown in the ask's locale, and the draft holds `{value: 35}` for the item

#### Scenario: The keyboard from unset
- **WHEN** the user focuses an unset slider and presses End
- **THEN** its value is its `max`

#### Scenario: A range
- **WHEN** the user clicks an unset range slider at 40, then drags the upper thumb to 70
- **THEN** the draft holds `{low: 40, high: 70}` for the item

#### Scenario: Untouched
- **WHEN** a question holding only an untouched Scale is shown
- **THEN** the draft holds no result and "Answer" is disabled

### Requirement: Scale as a rating
A Scale with `display: "rating"` SHALL show one joined toggle per step from `min` to `max`, with `minLabel` and `maxLabel` at its ends, none pressed until the user presses one; pressing the pressed step again SHALL clear the value (FR-11, DESIGN Toggle group).

#### Scenario: Rating 4 of 5
- **WHEN** the user presses the step 4 of a rating from 1 to 5
- **THEN** it shows pressed, the others not, and the draft holds `{value: 4}` for the item

### Requirement: Ranking reorder
A Ranking SHALL show its items in the agent's order with a handle on each row. A row SHALL move by drag, with a drop indicator before or after the target row and Escape cancelling, or by "Move up" and "Move down"; "Keep this order" SHALL accept the order as it stands. A move or "Keep this order" SHALL put the whole order into the draft; an untouched Ranking SHALL hold no result (FR-11, AD-10).

#### Scenario: Untouched
- **WHEN** a question holding only an untouched Ranking is shown
- **THEN** the draft holds no result and "Answer" is disabled

#### Scenario: Keep this order
- **WHEN** the user presses "Keep this order"
- **THEN** the draft holds the agent's order for the item and "Answer" is enabled

#### Scenario: A drag
- **WHEN** the user drags the third row onto the top half of the first in Chromium or WebKit
- **THEN** the third item is first, the draft holds the new order, and the moved rows take the change highlight

### Requirement: Ranking at the keyboard
A Ranking's list SHALL be one Tab stop whose arrow keys move the current row, and its toolbar, "Move up", "Move down" and "Keep this order", another; a move SHALL keep the moved row current, and a tool that cannot act on it SHALL be disabled without losing focus. The toolbar SHALL count the moved rows ("Your changes: 2 moved") (FR-11, NFR-12, EXPERIENCE Accessibility Floor).

#### Scenario: Moving a row down twice
- **WHEN** the user makes the first row current and presses "Move down" twice from the keyboard
- **THEN** that item is third, it is still the current row, and the counter reads "Your changes: 3 moved"

#### Scenario: The last row
- **WHEN** the current row is the last one
- **THEN** "Move down" is disabled and keeps the focus if it had it

### Requirement: Result widgets read-only
An answered question's, a locked question's and an opened Snapshot's Approval, Scale and Ranking SHALL show their logged result disabled: the selected decision with the summary of the answer's changes, the value or the rating, the order with its moved rows marked (AD-15, AD-20).

#### Scenario: A Snapshot of an answered board
- **WHEN** a Snapshot is opened of a board whose question was answered "approve-with-changes" with a Scale at 4 and a Ranking reordered
- **THEN** each widget shows its result read-only, and nothing can be selected, moved or set

### Requirement: The drag library in a shared chunk
Pragmatic drag and drop SHALL reach the Tree's and the Ranking's chunks from one library chunk, which a board loads only when it holds one of them; the Tree's drag SHALL behave as before (AD-9, SM-C2).

#### Scenario: A board with a Ranking only
- **WHEN** a board whose only widget is a Ranking is assembled
- **THEN** it inlines the Ranking's chunk and the drag library's chunk, and no Tree chunk

#### Scenario: The Tree's drag
- **WHEN** the Tree's drag scenarios run in Chromium and WebKit
- **THEN** they pass unchanged

### Requirement: A result that is not JSON
A result a component reports that is not JSON within the depth bound, one that holds itself included, SHALL go to the item's error path and be held nowhere; the board SHALL keep working (AD-9, AD-10).

#### Scenario: A result that holds itself
- **WHEN** a component reports an object whose field holds the object itself
- **THEN** the call returns, the item shows its error state, the draft holds no result for it, and the other items still answer

### Requirement: A widget result end to end
A result given on the board SHALL reach the agent through `collect` and push delivery in the answer event's `results`, be returned by `fetch`, be kept in the draft mirror across a reload and be shown in a Snapshot, on the session process (FR-18, FR-20, AD-20).

#### Scenario: Collected and pushed
- **WHEN** the user answers a question with "Approve with changes", a reason and a Tree edit on the real board
- **THEN** `collect`, and the mod where it runs, deliver one answer event with `results`, the note and the Tree's `changes`

#### Scenario: Held across a reload
- **WHEN** the user sets a Scale's value without answering and reloads the tab
- **THEN** the Scale shows that value and the leave-page prompt is armed

### Requirement: The three widgets' strings
Every string the Approval, the Scale and the Ranking show SHALL come from the view's string tables in en-US and it-IT, and an Italian board SHALL show them in Italian (FR-34, EXPERIENCE Voice and Tone).

#### Scenario: An Italian board
- **WHEN** a board in it-IT holds the three widgets
- **THEN** it shows "Approvazione", "Approva con modifiche", "Mantieni quest'ordine" and "Sposta su", and no English chrome

## MODIFIED Requirements

### Requirement: Open prompt
Every question SHALL show its open prompt, "Note for the agent (optional)". Its text SHALL leave only with the question's answer or decline, or alone through "Answer", which sends it as a note and leaves the question open; never on typing or blur (FR-7, AD-20). While an item's held result requires a reason, as an Approval's "Approve with changes" does, the prompt SHALL read "Reason for the changes (required)" (FR-11, F-04).

#### Scenario: A note without an answer
- **WHEN** the user writes only a note and presses "Answer"
- **THEN** a note is sent, and the question still counts as open

#### Scenario: The reason's label
- **WHEN** the user selects "Approve with changes", then "Reject"
- **THEN** the prompt reads "Reason for the changes (required)", then "Note for the agent (optional)" again, keeping its text
