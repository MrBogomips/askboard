# Spec Delta

## MODIFIED Requirements

### Requirement: Tree keyboard
The toolbar and the tree SHALL each be one Tab stop. In the tree, the arrow keys, Home and End SHALL move the focus as in a treegrid, Alt+Shift with the arrow keys SHALL move, indent and outdent, and Delete or Backspace SHALL delete. These keys SHALL trigger no browser action, and every toolbar tool SHALL work from the keyboard with a visible focus ring (NFR-12).

#### Scenario: Move, indent and outdent keys
- **WHEN** the focus is on a row
- **THEN** Alt+Shift with ArrowUp, ArrowDown, ArrowRight and ArrowLeft moves up, moves down, indents and outdents it

#### Scenario: Selection and undo keys
- **WHEN** the focus is on a row
- **THEN** Space toggles its selection, Shift with ArrowUp or ArrowDown extends the selection (Tree row selection), and Ctrl or Cmd with Z undoes the latest edit (Tree undo)

#### Scenario: Moving with the keyboard only
- **WHEN** the user tabs into the tree, moves to `billing` with the arrow keys and presses Alt+Shift+ArrowUp
- **THEN** `billing` precedes `portal`, focus stays on `billing`, and the page has not navigated

#### Scenario: Adding from the toolbar by keyboard
- **WHEN** the user tabs to the toolbar, moves to "Add node" with the arrow keys and presses Enter
- **THEN** a new node after the current one starts editing its name

### Requirement: Tree drag and drop
The user SHALL move a node, with its subtree, by dragging its row's handle. Over a row, the top quarter SHALL mean before it, the bottom quarter after it, and the middle as its last child when the pointer has moved right as "Tree nesting by drag needs a move to the right" says, else before it in the middle's upper half and after it in its lower half, with an indicator that shows which, or that the drop is not allowed. The drop SHALL make the same move the buttons make, the node SHALL keep its ID, and every roll-up and Gantt task SHALL follow within the same interaction (EXPERIENCE Interaction Primitives, Drag; open questions 8 and 9).

#### Scenario: Reordering
- **WHEN** the user drags `billing` onto the top quarter of `portal`
- **THEN** `billing` precedes `portal` under `build`, and the Gantt plan's tasks follow the Tree's order

#### Scenario: Indenting by drop
- **WHEN** the user drops `billing` on the middle of `portal`, the pointer more than one indent step right of where the drag started
- **THEN** `billing` is the last child of `portal`, and `portal` is expanded

#### Scenario: Outdenting by drop
- **WHEN** the user drops `reporting` on the bottom quarter of `build`
- **THEN** `reporting` follows `build` at the top level, and the subtree that went with it

## REMOVED Requirements

### Requirement: Tree adjustment undo
**Reason**: Replaced by "Tree undo" and "Tree undo history", which undo every edit of the Tree, the adjustment included, one at a time, from a toolbar "Undo" that replaces "Undo adjust" (Issue #262).
**Migration**: None for agents or answers: the undo was view state and stays so. The view's strings `tree.tool.undoAdjust` and `tree.adjust.undone` become `tree.tool.undo` and `tree.undone`; the browser tests that pressed "Undo adjust" press "Undo".

## ADDED Requirements

### Requirement: Tree undo
While the Tree is editable, Ctrl or Cmd with Z in the tree, and the toolbar's "Undo", SHALL put the Tree back as it was before the user's latest edit, with the Gantt plans that edit changed, in one step: the draft as it was, the highlight and "Your changes" recomputed against the agent's original. Undoing SHALL send nothing and leave no trace in the draft or the answer (AD-10). It SHALL announce "Last change undone." (NFR-12).

#### Scenario: Undoing an accidental nest
- **WHEN** the user drops `billing` into `portal` by mistake and presses Ctrl+Z (Cmd+Z on macOS) with the focus in the tree
- **THEN** `billing` follows `portal` under `build` again, the toolbar reads "No changes", the draft holds no value for the Tree, "Answer" is disabled again if the draft is empty, and the browser has not undone anything else

#### Scenario: Undo from the toolbar
- **WHEN** the user indents `billing` with the toolbar's "Indent" and then activates "Undo"
- **THEN** `billing` is back after `portal`, the focus stays on "Undo", and the current row is `billing`

#### Scenario: Undoing a deletion with linked plans
- **WHEN** in a WBS with PERT the user deletes a package that has Gantt dependents, confirms, and presses Ctrl+Z
- **THEN** the package and its branch are back with their IDs and values, and the plan's dependents hold their predecessors as before the delete

#### Scenario: Undoing an adjustment
- **WHEN** the user adjusts 12 leaves by `+10` and activates "Undo"
- **THEN** all 12 values are as before, in one step, and the toolbar reads "No changes" if nothing else changed

#### Scenario: The Undo tool
- **WHEN** the Tree opens and the user points at "Undo"
- **THEN** "Undo" is in the toolbar, disabled, outside "More" however crowded the row is, its tooltip reads "Undo (⌘Z)" on macOS and "Undo (Ctrl+Z)" elsewhere, and its `aria-keyshortcuts` is `Control+Z Meta+Z`

#### Scenario: Undo while a cell is edited
- **WHEN** the user is typing in a name's editor and presses Ctrl+Z
- **THEN** the editor's own text undo acts, and no Tree edit is undone

#### Scenario: Italian
- **WHEN** the board is in it-IT
- **THEN** the tool reads "Annulla" and the undo announces "Ultima modifica annullata."

### Requirement: Tree undo history
The Tree SHALL keep the user's last 50 edits in memory, each move, drop, indent, outdent, add, delete, name or field commit and adjustment, and undo them latest first. An undo SHALL NOT be recorded, and an edit that changes nothing, is refused or cancelled SHALL NOT be recorded. The history SHALL be emptied on reload, while the Tree is read-only, when the agent changes the Tree, and when anything but the Tree changes what its latest edit wrote (AD-20).

#### Scenario: Several undos
- **WHEN** the user renames `portal`, moves `billing` up and deletes `reporting`, then presses Ctrl+Z three times
- **THEN** `reporting` comes back, then `billing` returns to its place, then `portal` takes its old name, and the draft holds no value for the Tree

#### Scenario: The oldest edits go
- **WHEN** the user makes 51 edits and presses Ctrl+Z 51 times
- **THEN** the 50 latest are undone, the first stays, and "Undo" is disabled

#### Scenario: A reload
- **WHEN** the user moves a node and reloads the board
- **THEN** the move is still in the draft, and "Undo" is disabled

#### Scenario: The question is answered
- **WHEN** the user edits the Tree, presses "Answer" and then "Edit"
- **THEN** "Undo" is disabled until the next edit

#### Scenario: A plan edited after a linked add
- **WHEN** in a WBS with PERT the user adds a package, then changes a dependency in the Gantt plan, then presses Ctrl+Z in the Tree
- **THEN** nothing is undone, and "Undo" is disabled

### Requirement: Tree nesting by drag needs a move to the right
A drop SHALL put the node inside a row only when the pointer is in the row's middle half and at least one indent step, 16 px, right of where the drag started. The indicator SHALL always show what a drop there does. While the pointer is in the middle half without that offset and a drop inside that row is allowed, the tip under the grid SHALL read "Move right to drop inside." (EXPERIENCE Interaction Primitives, Drag).

#### Scenario: A short drag up from the handle
- **WHEN** the user drags `trasporto` by its handle straight up one row and releases it over the middle of `imballaggio`, the pointer still over the handle's column
- **THEN** `trasporto` precedes or follows `imballaggio` as a sibling, as the indicator showed, and is not its child

#### Scenario: Nesting on purpose
- **WHEN** the user drags `billing` over the middle of `portal` and moves the pointer right by 16 px or more from where the drag started
- **THEN** the indicator shows the "into" outline, the tip is empty, and the drop makes `billing` the last child of `portal`

#### Scenario: The hint
- **WHEN** the pointer is over the middle of `portal` without the offset
- **THEN** the indicator shows a line above or below `portal`, and the tip reads "Move right to drop inside."

#### Scenario: The hint in Italian
- **WHEN** the board is in it-IT and the pointer is over the middle of a row without the offset
- **THEN** the tip reads "Sposta a destra per inserire dentro."
