## ADDED Requirements

### Requirement: Gantt task column resize
The user SHALL change the width of the Gantt grid's TASK column by dragging the right edge of its header, or with the keyboard on the focused edge. The width SHALL stay between 120 px and 60% of the widget's width, be view state, and appear in no draft, answer or change (EXPERIENCE Widgets, Gantt; NFR-12).

#### Scenario: Widening by drag
- **WHEN** the user drags the TASK header's right edge 80 px to the right
- **THEN** the column is 80 px wider, the bar chart narrows to fit, and no message leaves the view

#### Scenario: The limits
- **WHEN** the user drags the edge far left, then far right
- **THEN** the width stops at 120 px, then at 60% of the widget's width

#### Scenario: Not an answer
- **WHEN** the user has only resized the column
- **THEN** "Answer" stays disabled, the draft is unchanged, and the toolbar reads "Changes vs agent's original · none yet"

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
The percentage SHALL be read by AskBoard's number parser for the ask's locale, with its echo, at most one decimal, from -99.9 to +1000; anything else SHALL be refused with a message and "Apply" SHALL stay disabled.

#### Scenario: A percentage that is refused
- **WHEN** the user types `-100`, `+1001`, `12,5` in the en-US locale or `1.25`
- **THEN** the field shows a message, "Apply" stays disabled and the draft is unchanged

### Requirement: Tree bulk adjustment values
"Apply" SHALL change the checked columns' values of the leaves among the selected nodes in one step: each new value is the old value times (1 + p/100), in decimal arithmetic, rounded half away from zero to one decimal (open question 5). Every derived value SHALL follow within the same interaction (FR-12).

An empty field SHALL stay empty and count as skipped; a value that rounds to itself SHALL not count; one that would leave 0 to 100,000 working days SHALL stay and count as refused.

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

#### Scenario: Over the range
- **WHEN** a value of 99,999 is adjusted by `+10`
- **THEN** it stays 99,999, the preview counts it as refused for the range, and the other values still change

#### Scenario: Parents are not edited
- **WHEN** the selection is `build` and its three leaves
- **THEN** only the leaves' values change, and `build`'s estimates roll up from them

### Requirement: Tree bulk adjustment preview
The panel's preview SHALL read how many values change, how many are skipped and how many are refused, show the first three changes as "name column old → new", and warn, naming the count, when the result leaves a row with an optimistic estimate above its most likely or a most likely above its pessimistic, without refusing it. "Apply" SHALL close the panel, return focus to the toolbar's button and announce "Adjusted N values by P%. Undo" (open question 6).

#### Scenario: Estimates out of order
- **WHEN** the user adjusts only "Optimistic" by `+300` and a row's optimistic then exceeds its most likely
- **THEN** the preview warns with the count of such rows, "Apply" still works, and the rows show the field check afterwards

#### Scenario: Using it with the keyboard only
- **WHEN** the user selects rows with Space, tabs to "Adjust by %…", presses Enter, unchecks "Optimistic" with Space, types `15` and presses Enter
- **THEN** the adjustment applies once, and the page has not navigated

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
- **THEN** all 12 values are as before, the toolbar reads "Changes vs agent's original · none yet" if nothing else changed, and "Answer" is disabled again if the draft is empty

#### Scenario: After another edit
- **WHEN** the user adjusts by `+10`, renames a node and looks at the toolbar
- **THEN** "Undo adjust" is gone

#### Scenario: By keyboard
- **WHEN** the focus is in the tree and the user presses Ctrl+Z (Cmd+Z on macOS) right after an adjustment
- **THEN** the adjustment is undone, and the browser has not undone anything else

### Requirement: Tree drag and drop
The user SHALL move a node, with its subtree, by dragging its row's handle. Over a row, the top quarter SHALL mean before it, the bottom quarter after it, and the middle as its last child, with a drop indicator that shows which, or that the drop is not allowed. The drop SHALL make the same move the buttons make, the node SHALL keep its ID, and every roll-up and Gantt task SHALL follow within the same interaction (EXPERIENCE Interaction Primitives, Drag; open questions 8 and 9).

#### Scenario: Reordering
- **WHEN** the user drags `billing` onto the top quarter of `portal`
- **THEN** `billing` precedes `portal` under `build`, and the Gantt plan's tasks follow the Tree's order

#### Scenario: Indenting by drop
- **WHEN** the user drops `billing` on the middle of `portal`
- **THEN** `billing` is the last child of `portal`, and `portal` is expanded

#### Scenario: Outdenting by drop
- **WHEN** the user drops `reporting` on the bottom quarter of `build`
- **THEN** `reporting` follows `build` at the top level, and the subtree that went with it

### Requirement: Tree drops that are refused
A drop SHALL be refused, with no change, onto the node itself or inside its own subtree, and when it would break the Tree's limits of 8 levels or 500 nodes. Escape during a drag SHALL cancel it, a drop where the node already is SHALL change nothing, and focus SHALL follow the moved node.

#### Scenario: Into its own subtree
- **WHEN** the user drags `build` over `portal`
- **THEN** the indicator reads not allowed, and dropping changes nothing

#### Scenario: A deep drop
- **WHEN** a drop would put a node at level 9
- **THEN** the indicator reads not allowed and the draft is unchanged

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

## MODIFIED Requirements

### Requirement: Gantt layout
The Gantt SHALL show, in the widget frame, a grid with one row per task (its name, start, duration and predecessors) beside AskBoard's own chart on a time axis: one bar per task, finish-to-start arrows, the critical path, while the "Critical path" switch is on, as solid bars in the critical colour with heavier arrows, and a legend reading task, critical path and your change. The grid's TASK column SHALL be resizable (Gantt task column resize). Every agent string SHALL render as text (AD-8; DESIGN.md Widgets, Gantt).

#### Scenario: The UJ-2 plan opens
- **WHEN** the fixture plan opens
- **THEN** the grid lists the six work packages in the Tree's order, UX design starts on 11/2/2026, reporting ends on 12/11/2026, and the bars of UX design, the prototype, the portal and reporting are drawn as the critical path

#### Scenario: Markup in agent strings
- **WHEN** a task's name holds `<img src=x onerror=alert(1)>`
- **THEN** the grid shows those characters as text, and no element is created from them

### Requirement: Gantt plan scope
A Gantt plan SHALL take its tasks from the leaves of the Tree it names, in the Tree's order, draw no bar for a parent, and show each duration as its requested duration, else its PERT expected effort rounded up to whole working days; the user changes a duration as Gantt plan duration resize says. Its toolbar SHALL offer the zoom "Day | Week | Month", opening at week, and the "Critical path" switch (FR-11, FR-15; DESIGN.md and EXPERIENCE Molecules, Gantt plan).

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
