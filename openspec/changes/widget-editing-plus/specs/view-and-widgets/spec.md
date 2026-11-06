## ADDED Requirements

### Requirement: Gantt task column resize
The user SHALL change the width of the Gantt grid's TASK column by dragging the right edge of its header, or with the keyboard on the focused edge. The width SHALL stay between 120 px and 60% of the widget's width, be view state, and appear in no draft, answer or change (EXPERIENCE Widgets, Gantt; NFR-12).

#### Scenario: Widening by drag
- **WHEN** the user drags the TASK header's right edge 80 px to the right
- **THEN** the column is 80 px wider, the bar chart narrows to fit, and no message leaves the view

#### Scenario: The limits
- **WHEN** the user drags the edge far left, then far right
- **THEN** the width stops at 120 px, then at 60% of the widget's width

#### Scenario: The default width at the viewport floor
- **WHEN** the fixture plan opens in a 1280 px board with the column at its default width
- **THEN** the whole plan, its last bar and its end date included, is visible in the chart without scrolling

#### Scenario: Not an answer
- **WHEN** the user has only resized the column
- **THEN** "Answer" stays disabled, the draft is unchanged, and the toolbar reads "No changes"

#### Scenario: After "Answer"
- **WHEN** the question is answered or locked
- **THEN** the column still resizes

### Requirement: Gantt task column resize by keyboard and fit
The column's edge SHALL be a separator with a name, its value and its range for assistive technology. With it focused, ArrowLeft and ArrowRight SHALL change the width by 16 px, Shift with an arrow by 64 px, Home and End SHALL set the narrowest and the widest, and Enter or a double-click SHALL fit the longest visible name. A name too long for the column SHALL be cut with an ellipsis and its full text SHALL be the cell's title.

#### Scenario: Resizing by keyboard only
- **WHEN** the user tabs to the edge and presses ArrowRight three times, then End
- **THEN** the column grows by 48 px and then takes the widest width, focus stays on the edge, and the page has not navigated

#### Scenario: Fitting the longest name
- **WHEN** the user double-clicks the edge of a plan whose longest visible name needs 230 px
- **THEN** the column is as wide as that name needs, within the limits

#### Scenario: A cut name
- **WHEN** a task's name is wider than the column
- **THEN** it ends in an ellipsis and the cell's title holds the whole name

### Requirement: Gantt critical path switch
The Gantt's toolbar SHALL hold a switch "Critical path", on when the board opens, in a plan and in a Gantt with its own tasks. Off, the chart SHALL draw every bar and arrow as an ordinary one and the legend SHALL drop its critical entry, and the computed critical flags and the grid SHALL not change (FR-11, FR-15; EXPERIENCE Widgets, Gantt).

#### Scenario: Switching it off
- **WHEN** the fixture plan is open and the user turns "Critical path" off
- **THEN** the bars of UX design, the prototype, the portal and reporting are drawn as ordinary bars, the legend lists task and your change only, and the schedule is as before

#### Scenario: A Gantt that opens
- **WHEN** a plan or a Gantt with its own tasks opens
- **THEN** its critical path is highlighted and the switch is on

#### Scenario: Arrows with the highlighting off
- **WHEN** the user turns "Critical path" off
- **THEN** every arrow is drawn in the neutral border colour and routed as Gantt dependency arrows says, so the plain view stays readable

#### Scenario: By keyboard
- **WHEN** the user tabs to the toolbar, moves to "Critical path" with the arrow keys and presses Space
- **THEN** the switch toggles and the page has not navigated

### Requirement: The critical path switch is view state
The switch SHALL be in no draft, answer, change or highlight; a reload SHALL bring it back on. It SHALL work while the question is answered or locked and in a Snapshot.

#### Scenario: Not an answer
- **WHEN** the user only toggles the switch and reloads the board
- **THEN** the draft record holds nothing for the Gantt and the switch is on again

#### Scenario: After "Answer"
- **WHEN** the question is answered and the user turns the switch off
- **THEN** the highlighting goes away, and bars still do not drag

### Requirement: Gantt plan duration resize
In a Gantt plan the user SHALL change a task's duration by dragging the end of its bar or by typing it in the grid, as whole working days from 1 to 2,000, snapped to working days. The result SHALL be a requested duration, marked with a pin; the task's dependants, the critical path and the plan's finish SHALL follow within the same interaction, and Escape during a drag SHALL cancel it (FR-11, FR-12, AD-13; open question 3).

#### Scenario: Lengthening a bar
- **WHEN** the user drags the end of the portal's bar, an 18-day task, three working days to the right
- **THEN** the portal's duration is 21 working days with a pin, reporting moves three working days later, and the plan ends three working days later

#### Scenario: Below one day
- **WHEN** the user drags the end of a 1-day task's bar to the left
- **THEN** its duration stays 1 working day

#### Scenario: Typing a duration
- **WHEN** the user types `10` in the portal's duration and presses Enter
- **THEN** the portal's duration is 10 with a pin, and `2.5` is refused with a message, the focus kept and the draft unchanged

### Requirement: Duration resize feedback
While the end of a bar is dragged, the Gantt SHALL show the live duration beside the bar ("8 d") and the earliest-end guide, the end of the bar SHALL show a visible grip on hover and the `ew-resize` cursor, and a requested duration's pin SHALL differ from the mark of a duration that follows the WBS (F3 review notes; design review).

#### Scenario: Dragging the end
- **WHEN** the user drags the end of the portal's bar two days to the right
- **THEN** a label reads the live duration, "20 d", and the bar's end shows its grip

#### Scenario: Pin and derived mark
- **WHEN** the portal has a requested duration and the UX design's duration follows a WBS edit
- **THEN** the portal's cell carries the pin and the change border, and the UX design's cell carries the derived mark and no pin

### Requirement: A requested duration is cleared by returning to the estimate
A task whose requested duration equals its PERT expected effort rounded up SHALL have none. Dragging the end back to that length, pressing Delete on the duration cell, or "Use estimate" in the cell's menu SHALL clear the request; a change to the task's estimates in the Tree SHALL leave a requested duration as it is.

#### Scenario: Back to the estimate
- **WHEN** the portal has a requested duration of 21 and the user drags the end of its bar back to 18
- **THEN** the request is cleared, the pin goes, and the cell shows the effort-derived 18

#### Scenario: Clearing by keyboard
- **WHEN** the focus is on the portal's pinned duration and the user presses Delete
- **THEN** the duration returns to its effort-derived value and the pin goes

#### Scenario: The estimates change after
- **WHEN** the portal has a requested duration of 21 and the user changes its most likely estimate in the Tree
- **THEN** its duration stays 21, and the Tree's expected effort for it changes

### Requirement: A requested duration is a change
A requested duration SHALL take the change outline on its bar and the change fill on its cell, count once in "Your changes: N", and reach the agent as one `set` of `item.task.duration`, with the derived values as they stood; a request cleared before the answer SHALL leave no change.

#### Scenario: Highlight and answer
- **WHEN** the user lengthens the portal to 21 and presses "Answer"
- **THEN** the portal's bar carries the change outline and its duration cell the change fill, the toolbar reads "Your changes: 1", and the answer's `changes` hold one `set` of `schedule.portal.duration` to 21, with the `derived` values of the plan as they stood

#### Scenario: A request cleared before the answer
- **WHEN** the user lengthens the portal and then clears the request
- **THEN** the draft holds no change for it and its bar carries no outline

### Requirement: Tree row selection
The user SHALL select Tree rows with a checkbox in a leading column of each row, with Space on the focused row, with Shift and ArrowUp or ArrowDown to extend from it, and with the toolbar's "Select all" and "Select none". Selecting a parent SHALL select every node under it, and "Select all" every node, collapsed ones included. The toolbar SHALL read how many nodes are selected (EXPERIENCE Widgets, Tree; NFR-12).

#### Scenario: Selecting a branch
- **WHEN** the user selects `build`, which holds `portal`, `billing` and `reporting`
- **THEN** all four rows are selected, the toolbar reads "4 selected", and the header checkbox is partial

#### Scenario: Selecting a range by keyboard
- **WHEN** the user focuses `portal`, presses Space, then Shift+ArrowDown twice
- **THEN** `portal`, `billing` and `reporting` are selected and the focus is on `reporting`

#### Scenario: Selecting all
- **WHEN** the user presses "Select all" with `build` collapsed
- **THEN** every node, `build`'s children included, is selected

### Requirement: Tree selection is view state
Selection SHALL be in no draft, answer or change, SHALL clear when the question is answered or locked, and a deleted node SHALL leave it. A parent SHALL show the partial state when only some nodes under it are selected, and selecting SHALL not move focus out of the tree.

#### Scenario: Not an answer
- **WHEN** the user only selects rows
- **THEN** "Answer" stays disabled and the draft is unchanged

#### Scenario: A selected node is deleted
- **WHEN** the user deletes `reporting` while it is selected
- **THEN** the toolbar's count drops by one

### Requirement: Tree bulk percentage adjustment panel
With a node selected, the Tree's toolbar SHALL offer "Adjust by %…": a panel with a check box per number column (in the WBS, the three estimates, checked, one required at least), a percentage field, a preview, "Apply" and "Cancel". "Cancel" and Escape SHALL change nothing (FR-11; open questions 4 and 11).

#### Scenario: Cancel
- **WHEN** the user types a percentage and presses Escape
- **THEN** the panel closes, nothing changed and focus returns to the toolbar's button

#### Scenario: Read-only
- **WHEN** the question is answered or locked
- **THEN** "Adjust by %…" is disabled and the selection controls only select

### Requirement: The adjustment percentage
The percentage SHALL be read by AskBoard's number parser for the ask's locale, at most one decimal, from -99.9 to +1000, without an echo (Grid entries have no echo); anything else SHALL be refused with a message and "Apply" SHALL stay disabled.

#### Scenario: A percentage that is refused
- **WHEN** the user types `-100`, `+1001`, `12,5` in the en-US locale or `1.25`
- **THEN** the field shows a message, "Apply" stays disabled and the draft is unchanged

### Requirement: Tree bulk adjustment values
"Apply" SHALL change the checked columns' values of the leaves among the selected nodes in one step: each new value is the old value times (1 + p/100), in decimal arithmetic, rounded half away from zero to one decimal (open question 5). Every derived value SHALL follow within the same interaction (FR-12).

An empty field SHALL stay empty and count as skipped; a value that rounds to itself SHALL not count.

#### Scenario: Widening every likely estimate
- **WHEN** the user selects all, keeps only "Most likely" checked, types `+10` and presses "Apply", and `portal` held 12
- **THEN** `portal`'s most likely is 13.2, no other column changed, and every expected effort and spread rolled up the tree follows

#### Scenario: All three columns
- **WHEN** the user selects `portal` and adjusts all three estimates by `-20` while they are 6, 12 and 24
- **THEN** they become 4.8, 9.6 and 19.2

#### Scenario: Rounding
- **WHEN** a value of 2.25 is adjusted by `+10`
- **THEN** the result is 2.5 (2.475 rounded half away from zero), and 3 adjusted by `+10` is 3.3, not 3.3000000000000003

#### Scenario: A value that does not change
- **WHEN** a value of 0.1 is adjusted by `+4`
- **THEN** the result 0.104 rounds to 0.1, the value does not change and it is not counted as changed

#### Scenario: An empty field
- **WHEN** the selection holds a leaf with no pessimistic estimate and "Pessimistic" is checked
- **THEN** the field stays empty and the preview counts it as skipped

#### Scenario: Parents are not edited
- **WHEN** the selection is `build` and its three leaves
- **THEN** only the leaves' values change, and `build`'s estimates roll up from them

### Requirement: Tree bulk adjustment preview
The panel's preview SHALL read how many values change and how many are skipped, show the first three changes as "name column old → new", and, when the adjustment would break the estimates' order or their range for any row, say so with the count and the first rows' names and columns, and disable "Apply". "Apply" SHALL close the panel, return focus to the toolbar's button and announce "Adjusted N values by P%. Undo" (open question 6).

#### Scenario: Using it with the keyboard only
- **WHEN** the user selects rows with Space, tabs to "Adjust by %…", presses Enter, unchecks "Optimistic" with Space, types `15` and presses Enter
- **THEN** the adjustment applies once, and the page has not navigated

### Requirement: Estimates stay in order
In a WBS with PERT, an edit SHALL NOT be committed when it would leave a row with an optimistic above its most likely, a most likely above its pessimistic, or a value outside 0 to 100,000 working days. A refused cell edit SHALL show a message naming the rule, keep the focus and the text, and leave the draft unchanged (open question 6).

#### Scenario: A cell edit that breaks the order
- **WHEN** `portal` holds 6, 12 and 24 and the user types `15` in its optimistic cell and presses Enter
- **THEN** the cell shows "Optimistic must not exceed Most likely.", keeps the focus and the text, and the draft is unchanged

#### Scenario: A cell edit that keeps it
- **WHEN** the user types `12` in that optimistic cell, equal to the most likely
- **THEN** it commits

#### Scenario: A negative value
- **WHEN** the user types `-1` in an estimate cell
- **THEN** the cell shows a message that an estimate is 0 to 100,000 working days, and the draft is unchanged

#### Scenario: Raising all three in the right order
- **WHEN** the user raises `portal`'s pessimistic to 40, then its most likely to 20, then its optimistic to 10
- **THEN** each edit commits

### Requirement: Estimates in order, the edge cases
An empty estimate SHALL take no part in the order, and a row the agent sent out of order SHALL NOT be made worse. A bulk adjustment SHALL apply to no row if any row would break the rule: all or nothing.

#### Scenario: A row that was already out of order
- **WHEN** the agent sent `billing` with optimistic 9 above its most likely 5, and the user lowers its optimistic to 7
- **THEN** it commits, because the row is not made worse

#### Scenario: A bulk adjustment that would break one row
- **WHEN** the user adjusts only "Optimistic" by `+300` and one selected row's optimistic would then exceed its most likely
- **THEN** the preview names that row and its column, "Optimistic", with the count, "Apply" is disabled, and no value of any row changes

#### Scenario: A bulk adjustment beyond the range
- **WHEN** a value of 99,999 is among those adjusted by `+10`
- **THEN** the preview names it, "Apply" is disabled, and no value changes

#### Scenario: A bulk adjustment that keeps every row coherent
- **WHEN** the user adjusts all three estimates of every selected row by `+10` or by `-20`
- **THEN** no row breaks the order, and it applies

### Requirement: A bulk adjustment is changes
Each value an adjustment changed SHALL take the change fill and border, count with its node once in "Your changes: N", and reach the agent as one `set` of `item.node.field`, with the derived values as they stood.

#### Scenario: Highlight and answer
- **WHEN** the user adjusts `portal`'s most likely by `+10` and `billing`'s by `+10`, and presses "Answer"
- **THEN** the changed cells carry the change fill and border, the toolbar reads "Your changes: 2", and the answer's `changes` hold one `set` of `wbs.portal.mostLikely` and one of `wbs.billing.mostLikely`, with the derived values of the WBS and the plan as they stood

#### Scenario: A very large adjustment
- **WHEN** the user adjusts all three estimates of a 500-node Tree and answers
- **THEN** the answer says that its changes are too large to carry, as the contract's rule says, and the agent fetches the edited Tree

### Requirement: Tree adjustment undo
After an adjustment, the Tree's toolbar SHALL offer "Undo adjust", and Ctrl or Cmd with Z SHALL do the same while the focus is in the tree. Undoing SHALL put back every value as it was, in one step, with the highlight and the count recomputed against the agent's original. The undo SHALL be available until the user's next edit of any kind, and SHALL leave no trace in the draft or the answer (open question 7).

#### Scenario: Undoing
- **WHEN** the user adjusts 12 leaves by `+10` and presses "Undo adjust"
- **THEN** all 12 values are as before, the toolbar reads "No changes" if nothing else changed, and "Answer" is disabled again if the draft is empty

#### Scenario: After another edit
- **WHEN** the user adjusts by `+10`, renames a node and looks at the toolbar
- **THEN** "Undo adjust" is gone

#### Scenario: By keyboard
- **WHEN** the focus is in the tree and the user presses Ctrl+Z (Cmd+Z on macOS) right after an adjustment
- **THEN** the adjustment is undone, and the browser has not undone anything else

### Requirement: Tree drag and drop
The user SHALL move a node, with its subtree, by dragging its row's handle. Over a row, the top quarter SHALL mean before it, the bottom quarter after it, and the middle as its last child, with an indicator that shows which, or that the drop is not allowed. The drop SHALL make the same move the buttons make, the node SHALL keep its ID, and every roll-up and Gantt task SHALL follow within the same interaction (EXPERIENCE Interaction Primitives, Drag; open questions 8 and 9).

#### Scenario: Reordering
- **WHEN** the user drags `billing` onto the top quarter of `portal`
- **THEN** `billing` precedes `portal` under `build`, and the Gantt plan's tasks follow the Tree's order

#### Scenario: Indenting by drop
- **WHEN** the user drops `billing` on the middle of `portal`
- **THEN** `billing` is the last child of `portal`, and `portal` is expanded

#### Scenario: Outdenting by drop
- **WHEN** the user drops `reporting` on the bottom quarter of `build`
- **THEN** `reporting` follows `build` at the top level, and the subtree that went with it

### Requirement: Tree drag handle
The handle SHALL show on a row's hover and on the current row, with the `grab` cursor, and `grabbing` while dragging.

#### Scenario: The handle
- **WHEN** the pointer rests on a row
- **THEN** its grip shows with the grab cursor, and the cursor reads grabbing during the drag

### Requirement: Tree drops that are refused
A drop SHALL be refused, with no change, onto the node itself or inside its own subtree, and when it would break the Tree's limits of 8 levels or 500 nodes. Escape during a drag SHALL cancel it, a drop where the node already is SHALL change nothing, and focus SHALL follow the moved node.

#### Scenario: Into its own subtree
- **WHEN** the user drags `build` over `portal`
- **THEN** the indicator reads not allowed, a tip says "Cannot drop inside its own branch", and dropping changes nothing

#### Scenario: A deep drop
- **WHEN** a drop would put a node at level 9
- **THEN** the indicator reads not allowed, a tip names the limit, "At most 8 levels", and the draft is unchanged

#### Scenario: Cancelling
- **WHEN** the user presses Escape during a drag
- **THEN** nothing moved and focus is back on the dragged row

### Requirement: Tree drag has a keyboard path and is a change
The buttons and the Alt+Shift keys SHALL stay, and every move a drag makes SHALL be possible with them. A drag SHALL be a change as the buttons' moves are: one `move` operation with its `parent` and its `after`, "Your changes" counting the node once, and none left when it is moved back. Rows SHALL not drag and show no handle when the question is answered or locked.

#### Scenario: The keyboard path
- **WHEN** the user focuses `billing` and presses Alt+Shift+ArrowUp, then Alt+Shift+ArrowRight
- **THEN** `billing` makes the same moves a drag onto the top of `portal` and into its previous sibling would, and the answer's `changes` are the same `move` operations either way

#### Scenario: Highlight and answer
- **WHEN** the user drags `billing` before `portal` and presses "Answer"
- **THEN** `billing`'s name carries the change mark, the toolbar reads "Your changes: 1", and the answer's `changes` hold one `move` of `wbs.billing` with its `parent` and its `after`, omitted for the first place, valid as Tree changes

#### Scenario: Back where it was
- **WHEN** the user drags a node away and then back to its original place
- **THEN** the draft holds no change for it

#### Scenario: Read-only
- **WHEN** the question is answered or locked
- **THEN** rows do not drag and show no handle

### Requirement: Double-click opens a cell's editor
In a Tree's and a Gantt's grid, a double-click on an editable cell SHALL open its editor, as Enter and F2 do, with the same commit and cancel; on a cell that is not editable, and in a read-only widget, it SHALL do nothing, and it SHALL not start a drag or change the selection (EXPERIENCE Widgets, Tree and Gantt).

#### Scenario: Editing an estimate
- **WHEN** the user double-clicks `portal`'s most likely cell
- **THEN** its editor opens with the value, Enter commits and Escape restores

#### Scenario: A name
- **WHEN** the user double-clicks `build`'s name
- **THEN** the name editor opens

#### Scenario: A Gantt start
- **WHEN** the user double-clicks reporting's start in the grid
- **THEN** the start editor opens, and a double-click on a predecessors cell opens the panel it opens with Enter

#### Scenario: No text selected
- **WHEN** the user double-clicks a cell of the Gantt grid, editable or not
- **THEN** no text of the grid becomes selected

#### Scenario: A cell that is not editable
- **WHEN** the user double-clicks a parent's estimate cell, or any cell after "Answer"
- **THEN** nothing opens

### Requirement: Hover and focus feedback
Every interactive control and every editable cell on the board SHALL give visible feedback on hover and on focus, in the light and the dark theme, different from the change highlight and the focus ring (DESIGN Components; NFR-12; review F-01).

#### Scenario: A toolbar button
- **WHEN** the pointer rests on "Adjust by %…"
- **THEN** the cursor is a pointer and the button's background takes the hover token

#### Scenario: An editable cell
- **WHEN** the pointer rests on an editable estimate cell
- **THEN** the cell shows the hover surface and the cursor is a text cursor, and a cell that is not editable shows neither

### Requirement: Hover cursors and looks
The cursor SHALL be a pointer on buttons, switches, segments, checkboxes, chevrons, links and option rows, text on editable cells, grab on handles and bars, and a resize cursor on edges. The look SHALL come from DESIGN.md's `hover` token pair: the `muted` fill on cards, a 1px `border-strong` inset outline on editable cells, and a `border-strong` border with the `card` fill on toolbar buttons.

#### Scenario: A chevron and an option row
- **WHEN** the pointer rests on a Tree chevron, then on an option row
- **THEN** the cursor is a pointer both times and the option row takes the `muted` fill

### Requirement: No hover feedback where nothing responds
A disabled control SHALL show no hover change and the not-allowed cursor; a cell that is not editable, and every control of a read-only widget, SHALL show none.

#### Scenario: A disabled control
- **WHEN** the pointer rests on a disabled "Adjust by %…"
- **THEN** its look does not change and the cursor reads not allowed

#### Scenario: A drag handle and the column edge
- **WHEN** the pointer rests on a row's drag handle, then on the TASK column's edge
- **THEN** the cursors are grab and column-resize, and the edge shows the hover outline

#### Scenario: Keyboard focus
- **WHEN** the user tabs to a control
- **THEN** it shows the focus ring, which hover alone does not give

#### Scenario: Dark theme
- **WHEN** the system theme is dark
- **THEN** the same controls show their dark hover tokens

#### Scenario: Read-only
- **WHEN** a question is answered or locked
- **THEN** its widget's cells and editing controls show no hover feedback

### Requirement: Tree current row
The Tree SHALL mark its current row, the one the toolbar's move, indent, outdent, add and delete tools act on, persistently and apart from keyboard focus: a `primary-subtle` fill and a 2px `primary` left bar, shown after a click or an arrow key. Until a row is current, the row tools SHALL be disabled. The current row, one at a time, SHALL be a different state from the selected rows, which "Adjust by %…" acts on, and each SHALL show its own mark (review F-02).

#### Scenario: Clicking a row
- **WHEN** the user clicks UX design
- **THEN** the row carries the current-row mark although the focus ring is not shown, and "Move down" and "Delete" act on it

#### Scenario: Nothing current
- **WHEN** the Tree opens and no row has been clicked or reached by the keys
- **THEN** no row carries the mark and the move, add and delete tools are disabled

#### Scenario: Current and selected apart
- **WHEN** the user selects `portal` and `billing` with the checkboxes and clicks `reporting`
- **THEN** `reporting` is the one current row, the other two show the selected mark, and "Delete" acts on `reporting` only

### Requirement: Gantt plan opening zoom
A Gantt plan SHALL open at the finest of Day, Week and Month at which the whole plan fits the chart's width, and at Month when none does; a standalone Gantt SHALL open at Week (FR-15; review F-03).

#### Scenario: The fixture at the floor
- **WHEN** the fixture plan opens in a 1280 px board
- **THEN** the zoom is the finest one that shows the plan's last bar and end date without scrolling

#### Scenario: A long plan
- **WHEN** a plan spans more than Month's width at 1280 px
- **THEN** it opens at Month and the overflow cue shows

### Requirement: Gantt overflow cue
When the chart is wider than its frame, the Gantt SHALL show that it scrolls: a persistent horizontal scrollbar or an edge shadow on the side that has more (review F-03).

#### Scenario: A cut chart
- **WHEN** the chart is wider than its frame
- **THEN** a persistent scroll cue shows without hovering

### Requirement: Widget chrome follows the ask's language
Every AskBoard string of the Tree, the Gantt and the two molecules, in the toolbar, headers, legend, counters, panels, tips and messages, SHALL come from the view's string catalog in the ask's language, en-US or it-IT, the new labels of this change included; the agent's strings stay as sent (EXPERIENCE Localization; review F-04).

#### Scenario: An it-IT board
- **WHEN** the UJ-2 ask opens in it-IT
- **THEN** the Tree's tools, its counter and the molecule's column headers, the Gantt's columns, zoom, legend and counter, the "Critical path" switch and "Adjust by %…" panel show Italian text, and none of the English strings listed in the review remains

#### Scenario: An English board
- **WHEN** the same ask opens in en-US
- **THEN** the strings are as before

### Requirement: Closed banner layout
The Closed and Discarded banners SHALL sit directly under the context header, keep their message on one line, and show a saved Snapshot's path project-relative with a middle ellipsis, the full path in a tooltip and a "Copy path" button, on its own line under the message; the bottom bar's Snapshot feedback SHALL do the same without moving its controls (EXPERIENCE Board banners; review F-06).

#### Scenario: A closed ask with a Snapshot
- **WHEN** the agent closes the ask after saving a Snapshot at an absolute path
- **THEN** the banner is under the header, "This ask was closed. The board is read-only." is on one line, the path shows as `.askboard/snapshots/…html` cut in the middle, and "Copy path" copies the full path

#### Scenario: The bottom bar
- **WHEN** a Snapshot is saved from the bottom bar
- **THEN** its path shows on its own line and "Select recommended" stays on the bar's row

### Requirement: A closed ask looks closed
On a closed or discarded ask, the header SHALL hide the open count and the next-open jump and show the agent as ended, and option rows and link-buttons such as "Ask a follow-up" SHALL show the disabled look (EXPERIENCE State Patterns; review F-18).

#### Scenario: After the close
- **WHEN** the agent closes an ask with two questions still open
- **THEN** the header shows no "2 open" and no "Next open", the agent reads as ended, and the option rows are disabled

### Requirement: Grid entries have no echo
The Tree's and the Gantt's grid editors and the adjustment percentage field SHALL show no echo of the parsed value, and the editor SHALL not change its row's height. An ambiguous or invalid entry SHALL still be refused with a message, and after the commit the cell SHALL show the value formatted in the ask's locale. Standalone fields keep their echo (review F-08, F-09; open question 14c2).

#### Scenario: A plain number
- **WHEN** the user types `6` in an estimate cell
- **THEN** no echo shows and the row's height does not change

#### Scenario: A normalised number
- **WHEN** the user types `1,234.5` in an estimate cell and presses Enter
- **THEN** no echo shows while typing, and the cell then shows 1,234.5 as the en-US locale writes it

#### Scenario: A date
- **WHEN** the user types `11/9/2026` in a Gantt start and presses Enter
- **THEN** no tip or echo shows, the Duration and Depends on cells stay visible, and the cell shows "Mon 11/9"

#### Scenario: A start that is not a working day
- **WHEN** the user types `11/7/2026`, a Saturday, and presses Enter
- **THEN** the field shows a message that it is not a working day, and the draft is unchanged

#### Scenario: The percentage field
- **WHEN** the user types `+10` in the adjustment panel
- **THEN** no echo shows beside it, and `1.25` is refused with its message

### Requirement: Grid field errors name their field
A refusal message in the Tree's and the Gantt's grids SHALL begin with the name of the column it is about, be tied to its editor for assistive technology, and sit under the row, indented to the edited cell when there is room (DESIGN Field error; review F-10).

#### Scenario: An ambiguous estimate
- **WHEN** the user types `1,5` in the most likely cell
- **THEN** the message begins "Most likely:", and the editor names it as its description

### Requirement: An added row's empty roll-ups
A node the user has just added SHALL show its empty roll-ups as "—" in the muted colour, with no error, and the added-row bar at once; once the user leaves the row with an estimate still missing, a neutral note SHALL say so and the answer SHALL stay possible (review F-11).

#### Scenario: Adding a node
- **WHEN** the user chooses "Add node"
- **THEN** the new row shows "—" for the expected effort and the spread, no error colour, and the change bar

#### Scenario: Leaving it unestimated
- **WHEN** the user names the node and leaves the row with no estimates
- **THEN** a neutral note says the effort could not be computed, and "Answer" is not disabled by it

### Requirement: Gantt dependency arrows
An arrow SHALL leave the predecessor's bar end with a short stub, run in the gap between rows and enter the successor from the left at mid-height with a visible head; a non-critical arrow SHALL use the neutral border colour so it does not read as a grid line (DESIGN Gantt; review F-13).

#### Scenario: A long link
- **WHEN** a plan links architecture to the portal over several rows
- **THEN** the arrow runs between rows, not along a row's rule, and ends with its head at the portal's left edge

### Requirement: Gantt time axis
The axis SHALL label its first period at every zoom, stretch a short span to the frame's width, and shade non-working days on the `muted` surface at the Day zoom (DESIGN open item 9; review F-15).

#### Scenario: Month
- **WHEN** the user chooses "Month" on a plan starting in November
- **THEN** November is labelled, and the plan fills the chart's width

#### Scenario: Day
- **WHEN** the user chooses "Day"
- **THEN** Saturdays and Sundays are shaded

### Requirement: Tree toolbar overflow
The Tree's counter SHALL truncate before it overprints a tool, and when the toolbar's tools do not fit, the move tools SHALL go into a "More" menu, with every tool still reachable by keyboard (review F-16).

#### Scenario: A narrow board
- **WHEN** the board is 1024 px wide in it-IT with the adjustment tools present
- **THEN** no label overprints another and the move tools are in "More"

### Requirement: Segmented controls show the selection by an underline
Every segmented control, the header's Theme and Density, the settings panel's, the delivery switch and the Gantt zoom, SHALL mark its selected segment with the 2px `primary` underline besides the fill (DESIGN Segmented control; review F-17).

#### Scenario: The header's Theme
- **WHEN** the board opens with the system theme
- **THEN** the selected Theme and Density segments carry the underline

### Requirement: Gantt grid labels and dates
The Gantt grid's duration SHALL read with its unit, "6 d", and its start with the weekday, "Mon 11/2", the year shown only when the plan spans two years; the Tree's "Expected effort" header SHALL fit on one line, the full name in its tip (review F-20 to F-22).

#### Scenario: The fixture plan
- **WHEN** the fixture plan opens
- **THEN** UX design reads "Mon 11/2" and "6 d", and the Tree's headers are on one line

### Requirement: Row heights follow density
The Tree's and the Gantt's rows SHALL be 32 px in the compact density and 40 px in the comfortable one (DESIGN density tokens; review F-23).

#### Scenario: Comfortable
- **WHEN** the density is comfortable
- **THEN** each row of the Tree and of the Gantt grid is 40 px high

### Requirement: Board polish of images, excerpts and notes
An image item SHALL show in a frame on `muted` with a border and a caption line; an unresolved excerpt SHALL offer no "Open in reading panel"; the reading panel SHALL show a configuration key in the code face without literal backticks; an option's "+ Add your note to this option" SHALL show on hover and on focus without moving the options below it (review F-24 to F-27).

#### Scenario: An image
- **WHEN** a question holds an image
- **THEN** it shows inside a bordered frame with its caption

#### Scenario: An unresolved excerpt
- **WHEN** an excerpt's pointer does not resolve
- **THEN** it shows no "Open in reading panel"

#### Scenario: The editor hint
- **WHEN** the reading panel says that no editor is set
- **THEN** the key `editor` is in the code face and no backtick shows

#### Scenario: The note line
- **WHEN** the pointer rests on an option
- **THEN** "+ Add your note to this option" shows and the following options stay where they were

## MODIFIED Requirements

### Requirement: Gantt layout
The Gantt SHALL show, in the widget frame, a grid with one row per task (its name, start, duration and predecessors) beside AskBoard's own chart on a time axis: one bar per task, finish-to-start arrows, the critical path, while the "Critical path" switch is on, as solid bars in the critical colour with heavier arrows, and a legend reading task, critical path and your change (and, in a plan, the agent's plan). The grid's TASK column SHALL be resizable (Gantt task column resize). Every agent string SHALL render as text (AD-8; DESIGN.md Widgets, Gantt).

#### Scenario: The UJ-2 plan opens
- **WHEN** the fixture plan opens
- **THEN** the grid lists the six work packages in the Tree's order, UX design starts on Mon 11/2, reporting ends on Fri 12/11, and the bars of UX design, the prototype, the portal and reporting are drawn as the critical path

#### Scenario: Markup in agent strings
- **WHEN** a task's name holds `<img src=x onerror=alert(1)>`
- **THEN** the grid shows those characters as text, and no element is created from them

### Requirement: Gantt plan scope
A Gantt plan SHALL take its tasks from the leaves of the Tree it names, in the Tree's order, draw no bar for a parent, and show each duration as its requested duration, else its PERT expected effort rounded up to whole working days; the user changes a duration as Gantt plan duration resize says. Its toolbar SHALL offer the zoom "Day | Week | Month", opening as Gantt plan opening zoom says, and the "Critical path" switch (FR-11, FR-15; DESIGN.md and EXPERIENCE Molecules, Gantt plan).

#### Scenario: Zooming
- **WHEN** the user chooses "Month" and then "Day"
- **THEN** the axis and the bars rescale each time, "Answer" stays disabled, and no message leaves the view

#### Scenario: A standalone Gantt
- **WHEN** a Gantt with its own tasks opens
- **THEN** it shows the week scale with no zoom control and no baseline, its durations are editable, and its toolbar holds the "Critical path" switch alone

### Requirement: Gantt durations
In a Gantt with its own tasks, the user SHALL change a task's duration by dragging the end of its bar or by typing it in the grid, as whole working days, never below one; in a plan the same acts set a requested duration (Gantt plan duration resize) (EXPERIENCE Widgets, Gantt).

#### Scenario: Resizing a bar
- **WHEN** the user drags the end of a 6-day task's bar two working days to the right
- **THEN** its duration is 8 working days, and its dependents move two working days later

#### Scenario: Below one day
- **WHEN** the user drags the end of a 1-day task's bar to the left
- **THEN** its duration stays 1 working day

### Requirement: Read-only Gantt
When its question is answered, being sent or locked, the Gantt SHALL stay readable, zoomable and navigable from the keyboard, and its column resize and "Critical path" switch SHALL keep working, as view state; it SHALL accept no edit: bars do not drag or resize, cells do not edit and the predecessors panel does not open (AD-10, AD-21).

#### Scenario: After "Answer"
- **WHEN** the user has pressed "Answer" on a Gantt question
- **THEN** dragging a bar, resizing its end and pressing Enter on a start change nothing, and the zoom, the switch and the column resize still work

### Requirement: Tree keyboard
The toolbar and the tree SHALL each be one Tab stop. In the tree, the arrow keys, Home and End SHALL move the focus as in a treegrid; Alt+Shift with ArrowUp, ArrowDown, ArrowRight and ArrowLeft SHALL move up, move down, indent and outdent; Space SHALL toggle the focused row's selection and Shift with ArrowUp or ArrowDown SHALL extend it (Tree row selection); Ctrl or Cmd with Z SHALL undo a bulk adjustment (Tree adjustment undo); Delete or Backspace SHALL delete. These keys SHALL trigger no browser action, and every toolbar tool SHALL work from the keyboard with a visible focus ring (NFR-12).

#### Scenario: Moving with the keyboard only
- **WHEN** the user tabs into the tree, moves to `billing` with the arrow keys and presses Alt+Shift+ArrowUp
- **THEN** `billing` precedes `portal`, focus stays on `billing`, and the page has not navigated

#### Scenario: Adding from the toolbar by keyboard
- **WHEN** the user tabs to the toolbar, moves to "Add node" with the arrow keys and presses Enter
- **THEN** a new node after the current one starts editing its name

### Requirement: Gantt rescheduling by drag
The user SHALL reschedule a task by dragging its bar with the pointer. The bar SHALL snap to working days and stop at the earliest start its predecessors allow, which SHALL show during the drag as a full-height 2px dashed guide with the label "earliest 11/6". Dropping it on its earliest start SHALL clear its requested start; Escape during the drag SHALL cancel it (EXPERIENCE Widgets, Gantt; F-24; review F-14).

#### Scenario: Dragging past the predecessors
- **WHEN** the user drags reporting's bar to start before the portal ends
- **THEN** the bar stops at the day after the portal ends, the guide shows there with its label, and dropping it changes nothing

#### Scenario: Dropping on a weekend
- **WHEN** the user drops reporting's bar with its start over Saturday 12/12/2026
- **THEN** reporting starts on Monday 12/14/2026

### Requirement: Gantt editing in the grid
The user SHALL edit a task's start and, in a Gantt with its own tasks or a plan, its duration in the grid: Enter, F2 or a double-click starts editing, Enter or leaving the field commits, Escape restores. A start SHALL be read by AskBoard's own en-US date parser, with no echo (Grid entries have no echo), and refused with a message when it is no date, not a working day, or before the earliest start; an empty start SHALL clear the request.

#### Scenario: Typing a start
- **WHEN** the user types `12/9/2026` in reporting's start and presses Enter
- **THEN** reporting starts on Wednesday 12/9/2026 and the draft holds the change

#### Scenario: A start the predecessors do not allow
- **WHEN** the user types `11/20/2026` in reporting's start and presses Enter
- **THEN** the field shows a message beginning "Start:" naming 12/4/2026 as the earliest start, keeps the focus, and the draft is unchanged

#### Scenario: A duration that is not whole
- **WHEN** the user types `2.5` in a task's duration and presses Enter
- **THEN** the field shows a message, keeps the focus, and the draft is unchanged

### Requirement: Gantt change highlight
A task the user changed in the Gantt SHALL take the change outline on its bar and the change fill on its changed cells; a plan task whose duration only follows an estimate or an added package the user changed in the Tree SHALL take the derived mark, the `change-subtle` fill with a dotted bar outline and no border. The toolbar SHALL read "No changes", then "Your changes: N" counting each task changed in the Gantt once, and, in a plan, "Your changes: N · M follow from the WBS" when M tasks carry the derived mark; a task that moved only because a predecessor moved SHALL carry neither (FR-11; EXPERIENCE Change highlight; review F-07).

#### Scenario: Counting changes
- **WHEN** the user, with `u-1` added in the Tree, moves reporting later and gives `u-1` two predecessors
- **THEN** both bars carry the change outline, the portal's does not, and the toolbar reads "Your changes: 2"

#### Scenario: A re-estimate in the Tree
- **WHEN** the user changes UX design's estimates in the Tree so that its duration changes, and edits nothing in the Gantt
- **THEN** UX design's bar and duration carry the derived mark, and the toolbar reads "No changes · 1 follows from the WBS"

#### Scenario: Both kinds
- **WHEN** the user also lengthens the portal's bar
- **THEN** the portal carries the change outline and the toolbar reads "Your changes: 1 · 1 follows from the WBS"

### Requirement: Gantt plan baseline
A Gantt plan SHALL draw, under the bar of a task whose dates differ from the agent's, the dates the agent's plan gave it as a 2px dashed `border-strong` line, and none where they are the same or the agent sent none; its legend SHALL name "agent's plan" (FR-12; DESIGN Molecules, Gantt plan; review F-12).

#### Scenario: A baseline after a move
- **WHEN** the user moves reporting three working days later
- **THEN** reporting's baseline still spans 12/4/2026 to 12/11/2026 under its moved bar

#### Scenario: Nothing moved
- **WHEN** the fixture plan opens
- **THEN** no task shows a baseline, and the legend names the agent's plan only once one does

#### Scenario: An added package
- **WHEN** the user adds `u-1` in the Tree
- **THEN** `u-1` has a bar and no baseline

### Requirement: Tree editing
The user SHALL rename a node and edit its fields in place: Enter, F2 or a double-click starts editing the name or field, Enter or leaving the field commits, Escape restores the previous value. A number field SHALL be a text input read by AskBoard's own en-US parser, with no echo (Grid entries have no echo) and refusing an ambiguous entry with a message, and an empty name SHALL NOT be committed.

#### Scenario: Editing a number
- **WHEN** the user types `1,234.5` in a number field and presses Enter
- **THEN** the field holds 1234.5 and the draft holds the change

#### Scenario: An ambiguous number
- **WHEN** the user types `1,5` in a number field and presses Enter
- **THEN** the field shows a message, keeps the focus, and the draft is unchanged

#### Scenario: Escape
- **WHEN** the user edits a name and presses Escape
- **THEN** the name is as before and the draft is unchanged

### Requirement: Tree change highlight
The Tree SHALL show what the user changed against what the agent sent: changed names and fields in the change hue with its border, an added row with the change bar, a moved row with a change mark on its name. The toolbar SHALL read "No changes" until the first change, then "Your changes: N", counting each added, removed, moved or edited node once (FR-11; EXPERIENCE Change highlight, By surface).

#### Scenario: Counting changes
- **WHEN** the user renames `portal`, adds `u-1` and deletes `reporting`
- **THEN** the renamed name and the added row carry the change highlight and the toolbar reads "Your changes: 3"
