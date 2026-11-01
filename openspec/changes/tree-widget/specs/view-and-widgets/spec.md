# Spec Delta

## Purpose

The view and its widgets show an ask's board in the user's browser: agent content rendered only as data, in a sandboxed view built from the board document, with every user action leaving as a typed message and nothing answered without an explicit act (AD-8, AD-9, AD-10).

## ADDED Requirements

### Requirement: Widget chunks
Each widget, a folder `packages/widgets/src/<name>/` holding an `index.tsx`, SHALL be built as a component chunk of the view's one manifest, with its hash, styles, licence notices and the chunks it needs, and SHALL register through the `CatalogRenderer` port, importing nothing else from `view` (AD-1, AD-9). `assemble` SHALL inline a widget's chunk only for a board whose items render with it.

#### Scenario: The Tree's chunk
- **WHEN** the view is built
- **THEN** the manifest lists the component chunk `tree`, registering `tree`, needing the shell and the React library chunk, with a hash that matches its content and its licence notices

#### Scenario: Only boards with a Tree load it
- **WHEN** the plain-choice board document and a board document holding a Tree are assembled
- **THEN** the first srcdoc holds no Tree chunk and the second holds it

#### Scenario: A Tree board in each engine
- **WHEN** a board holding a Tree is loaded and edited in Chromium, Firefox and WebKit
- **THEN** no CSP violation is reported by the view, its host page or the console

### Requirement: One chunk per component name
A component chunk's name SHALL be unique across the widgets and the view's catalog: a name found in both SHALL fail the build (AD-9).

#### Scenario: One name in two folders
- **WHEN** a widget folder and a catalog folder of the view share a name, each holding an `index.tsx`
- **THEN** the build fails, naming both folders

### Requirement: Widget items in a question
A question SHALL render each widget item it holds, after its options if it has any, each in the item frame and error boundary, and SHALL count as visible only when its options and every widget item are ready. A widget item whose component throws, or that no chunk registers, SHALL fail its question (AD-9, AD-10).

#### Scenario: A question holding a Tree
- **WHEN** a question with no options and one Tree item opens
- **THEN** it shows its header chip, its text and the Tree, and counts as visible once the Tree has been laid out

#### Scenario: A Tree that throws
- **WHEN** the Tree's component throws while rendering
- **THEN** the item shows an error, its question offers no "Answer", and the rest of the board stays usable

### Requirement: Widget edits only fill the draft
Every edit to a widget SHALL go into the draft record and SHALL send nothing. A widget whose edits bring it back to the agent's content SHALL hold no draft value (AD-9, AD-10, AD-20).

#### Scenario: Editing without answering
- **WHEN** the user renames, adds, deletes and moves nodes and edits fields
- **THEN** no view message other than the question's `ready` leaves the view

#### Scenario: Edits undone by hand
- **WHEN** the user renames a node and then renames it back to its first name
- **THEN** the Tree holds no draft value and "Answer" is disabled again

### Requirement: Answering a question with a widget
"Answer" SHALL be enabled once the question has a choice or a widget holds a change. It SHALL send one answer message carrying the chosen options, if any, and the full edited value of each changed widget item in its input-format shape, and nothing for an untouched one. The question SHALL then be read-only (AD-10, AD-20, FR-22).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved UJ-2 answer's `wbs` edits with the keyboard and presses "Answer"
- **THEN** one answer message leaves the view, its Tree value validates as an edited value, and the contract's diff of the sent and the edited value equals the approved `wbs` operations

#### Scenario: Nothing changed
- **WHEN** a Tree question opens and the user only moves the focus and expands and collapses nodes
- **THEN** "Answer" stays disabled

### Requirement: The board page refuses widget answers for now
Until the board protocol carries a widget's value, the board page SHALL refuse an answer message that carries one, send nothing to `board-host` and leave the question open, and its validators SHALL refuse a board document whose question holds widget items (AD-10, NFR-10).

#### Scenario: An answer with a Tree value
- **WHEN** the view sends an answer that carries a Tree's value
- **THEN** the board page replies that it refused it, and no answer command reaches `board-host`

#### Scenario: A board document holding a Tree
- **WHEN** `board-host`'s board message carries a question with a Tree item
- **THEN** the board page refuses the message as outside the schema and never builds the view from it

### Requirement: Tree layout
The Tree SHALL show its nodes as a treegrid in the widget frame: a toolbar, a header row of column names, and one row per visible node, indented per level, with a chevron on a node that has children, the node's name, and its fields as columns, numbers right-aligned. Every agent string SHALL render as text (AD-8, DESIGN.md Widgets, Tree; EXPERIENCE Widgets, Tree).

#### Scenario: The fixture Tree opens
- **WHEN** the fixture Tree question opens
- **THEN** the Tree shows the column names, and the eight nodes fully expanded, `Design` and `Build` with an open chevron and their children indented one level

#### Scenario: Markup in agent strings
- **WHEN** a node's name, a column's label and a text field hold `<img src=x onerror=alert(1)>`
- **THEN** the Tree shows those characters as text, and no element is created from them

### Requirement: Tree expand and collapse
A node with children SHALL expand and collapse from its chevron and from the keyboard. A standalone Tree SHALL open fully expanded. Expanding and collapsing SHALL change no value and SHALL NOT count as a change (EXPERIENCE open item 24, proposal open question 8).

#### Scenario: Collapsing a branch
- **WHEN** the user collapses `Build`
- **THEN** its three children are hidden, its chevron points right, and "Answer" stays disabled

### Requirement: Tree editing
The user SHALL rename a node and edit its fields in place: Enter or F2 starts editing the focused name or field, Enter or leaving the field commits, Escape restores the previous value. A number field SHALL be a text input read by AskBoard's own en-US parser, echoing the parsed value and refusing an ambiguous entry with a message, and an empty name SHALL NOT be committed.

#### Scenario: Editing a number
- **WHEN** the user types `1,234.5` in a number field and presses Enter
- **THEN** the field holds 1234.5 and the draft holds the change

#### Scenario: An ambiguous number
- **WHEN** the user types `1,5` in a number field and presses Enter
- **THEN** the field shows a message, keeps the focus, and the draft is unchanged

#### Scenario: Escape
- **WHEN** the user edits a name and presses Escape
- **THEN** the name is as before and the draft is unchanged

### Requirement: Tree adding nodes
"Add node" SHALL insert a node right after the current one and "Add child" a last child of the current one, which expands. A new node SHALL start editing its empty name, and an empty commit or Escape SHALL take it away again. A node the user adds SHALL get the ID `u-<n>`, `n` one more than the highest such number in the item (AD-7, F10, AD-10).

#### Scenario: Adding a sibling
- **WHEN** the user focuses `portal`, chooses "Add node" and types `Customer portal: dashboards`
- **THEN** a node `u-1` with that name follows `portal` under `build`, and focus is on it

#### Scenario: A node left without a name
- **WHEN** the user chooses "Add child" and presses Escape
- **THEN** no node is added and the draft is unchanged

### Requirement: Tree deleting nodes
Deleting SHALL remove the current node with its descendants. A node with children SHALL be deleted only after an inline confirmation that says how many nodes go with it, with the focus on "Cancel". After a delete, focus SHALL move to the next sibling, else the previous one, else the parent (EXPERIENCE Widgets, Tree).

#### Scenario: Deleting a leaf
- **WHEN** the user presses Delete on `reporting`
- **THEN** `reporting` is gone and focus is on `billing`

#### Scenario: Deleting a branch
- **WHEN** the user presses Delete on `design`, which has three children
- **THEN** a confirmation says that `Design` and the 3 nodes under it will be deleted, focus is on "Cancel", and nothing is deleted until the user confirms

### Requirement: Tree moving nodes
The moves SHALL be up, down, indent and outdent, each carrying the node's subtree: up and down swap the node with its neighbouring sibling; indent makes it the last child of its previous sibling; outdent places it right after its parent. A move that is not possible SHALL be disabled, and focus SHALL follow the moved node (EXPERIENCE Widgets, Tree; proposal open question 13).

#### Scenario: Indenting
- **WHEN** the user indents `billing`, which follows `portal`
- **THEN** `billing` becomes the last child of `portal`, and `portal` is expanded

#### Scenario: Outdenting
- **WHEN** the user outdents `portal`, the first of `build`'s three children
- **THEN** `portal` follows `build` at the top level, and `billing` and `reporting` stay under `build`

#### Scenario: At the edges
- **WHEN** the focus is on the first child of a node, or on a top-level node
- **THEN** "Move up" and "Indent" are disabled on the first, "Outdent" on the second, and their keys change nothing

### Requirement: Tree keyboard
The toolbar and the tree SHALL each be one Tab stop. In the tree, the arrow keys, Home and End SHALL move the focus as in a treegrid; Alt+Shift with ArrowUp, ArrowDown, ArrowRight and ArrowLeft SHALL move up, move down, indent and outdent; Delete or Backspace SHALL delete. These keys SHALL trigger no browser action, and every toolbar tool SHALL work from the keyboard with a visible focus ring (NFR-12).

#### Scenario: Moving with the keyboard only
- **WHEN** the user tabs into the tree, moves to `billing` with the arrow keys and presses Alt+Shift+ArrowUp
- **THEN** `billing` precedes `portal`, focus stays on `billing`, and the page has not navigated

#### Scenario: Adding from the toolbar by keyboard
- **WHEN** the user tabs to the toolbar, moves to "Add node" with the arrow keys and presses Enter
- **THEN** a new node after the current one starts editing its name

### Requirement: Tree change highlight
The Tree SHALL show what the user changed against what the agent sent: changed names and fields in the change hue with its border, an added row with the change bar, a moved row with a change mark on its name. The toolbar SHALL read "Changes vs agent's original · none yet" until the first change, then "Your changes: N", counting each added, removed, moved or edited node once (FR-11; EXPERIENCE Change highlight, By surface).

#### Scenario: Counting changes
- **WHEN** the user renames `portal`, adds `u-1` and deletes `reporting`
- **THEN** the renamed name and the added row carry the change highlight and the toolbar reads "Your changes: 3"

### Requirement: Tree plain values
The Tree SHALL show and edit node fields as plain values and SHALL compute none: no roll-up, total or formula, and its answer SHALL carry no derived value (AD-13; proposal open question 3).

#### Scenario: A child's estimate changes
- **WHEN** the user changes a number field of `portal`
- **THEN** no field of `build` or of any other node changes

### Requirement: Read-only Tree
When its question is answered, being sent or locked, the Tree SHALL stay readable and navigable, expanding and collapsing included, and SHALL accept no edit: editing keys do nothing and every toolbar tool is disabled (AD-10, AD-21).

#### Scenario: After "Answer"
- **WHEN** the user has pressed "Answer" on a Tree question
- **THEN** the Tree shows the sent value, Enter and the move keys change nothing, and every toolbar tool is disabled

### Requirement: Tree limits on the board
"Add node" and "Add child" SHALL be disabled when the Tree holds 500 nodes, and "Indent" and "Add child" when the result would sit deeper than 8 levels, so an edited value never breaks the contract's limits.

#### Scenario: At the node limit
- **WHEN** a Tree holds 500 nodes
- **THEN** "Add node" and "Add child" are disabled
