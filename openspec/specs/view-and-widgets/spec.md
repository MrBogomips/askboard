# view-and-widgets Specification

## Purpose
The view and its widgets show an ask's board in the user's browser: agent content rendered only as data, in a sandboxed view built from the board document, with every user action leaving as a typed message and nothing answered without an explicit act (AD-8, AD-9, AD-10).

## Requirements

### Requirement: Sandboxed view
The board page SHALL build the view's iframe from `srcdoc` through `assemble`, with exactly `sandbox="allow-scripts"`. The view SHALL have an opaque origin, hold no token and make no request (AD-8, NFR-5).

#### Scenario: The view's origin
- **WHEN** a board is open
- **THEN** `self.origin` inside the view is `"null"`, and the iframe's `sandbox` attribute is exactly `allow-scripts`

#### Scenario: The view tries to reach the network
- **WHEN** code inside the view calls `fetch` to the board's own address
- **THEN** the request fails and the session process receives nothing

### Requirement: The view's policy
The view's srcdoc SHALL carry a CSP meta tag with `default-src 'none'`, scripts and styles only by the hashes of its inlined chunks, `img-src data: blob:`, `font-src data:`, and `connect-src`, `object-src`, `frame-src`, `form-action` and `base-uri` all `'none'`, and never `'wasm-unsafe-eval'`, `'unsafe-eval'`, `'unsafe-inline'` or `'unsafe-hashes'`. Neither the view nor the board page SHALL raise a CSP violation (AD-8).

#### Scenario: A board loads in each engine
- **WHEN** a board is loaded in Chromium, Firefox and WebKit
- **THEN** no CSP violation is reported by the view, the board page or the console, a blocked `eval` that a library catches included

### Requirement: Agent content as text
Every agent string on the board (title, area titles, question text, header chips, option labels, descriptions, previews and annotations, follow-up replies, and the atoms' text, labels and values) SHALL render as text, never as markup, except a Text or an option preview the agent marks as Markdown, which SHALL render only through the view's Markdown renderer (AD-8, NFR-5).

#### Scenario: Markup in an option label
- **WHEN** an option's label is `<img src=x onerror=alert(1)>`
- **THEN** the board shows those characters as text, and no element is created from them

#### Scenario: Markup in a reply
- **WHEN** the agent replies to a follow-up with `<script>alert(1)</script>`
- **THEN** the thread shows those characters as text, and no script runs

#### Scenario: Markup in an atom's label
- **WHEN** a TextField's label is `<b>Name</b>`
- **THEN** the field's label shows those characters as text

### Requirement: No browser storage
No AskBoard page SHALL use Web Storage, IndexedDB or cookies (AD-20).

#### Scenario: After answering
- **WHEN** a board has been loaded and answered
- **THEN** the board origin's Web Storage, IndexedDB and cookies are empty

### Requirement: View build and manifest
The view build SHALL publish a manifest of a shell chunk, library chunks and one chunk per catalog component, each with its SHA-256, its styles, the licence notices of the code it contains and the chunks it needs. Every chunk SHALL be a classic script; a chunk holding `import.meta` SHALL fail the build (AD-9).

#### Scenario: The manifest
- **WHEN** the view is built
- **THEN** the manifest validates against the contract's view manifest schema and lists the board page script, the shell, the Choice component and their library chunks, each with a hash that matches its content and its licence notices

#### Scenario: `import.meta` in a chunk
- **WHEN** a chunk's output holds `import.meta`
- **THEN** the build fails, naming the chunk

### Requirement: Chunk growth is stated
A chunk that grows past the size margin over the recorded sizes of the previous build SHALL fail the checks, unless the change records its new size (Consistency Conventions, Tests).

#### Scenario: A chunk doubles
- **WHEN** a build makes a chunk grow past the margin without updating the recorded sizes
- **THEN** the check fails, naming the chunk and both sizes

### Requirement: Assemble
`assemble(boardDocument, manifest)` SHALL be a pure function that returns the srcdoc with its CSP, inlining the shell, the chunks the board's items need and the library chunks those need (AD-9).

#### Scenario: Only the chunks a board needs
- **WHEN** a plain-question board document is assembled
- **THEN** the srcdoc holds the shell, the Choice chunk and their library chunks, and no other chunk

#### Scenario: Same input, same output
- **WHEN** one board document and manifest are assembled twice
- **THEN** both srcdocs are identical

### Requirement: Catalog components
Components SHALL register through one `CatalogRenderer` port, render from the board document and the draft record alone, keep no edit state of their own and send user actions only as typed view messages, which the board page validates before turning them into board-protocol commands (AD-9).

#### Scenario: A choice goes into the draft
- **WHEN** the user selects an option
- **THEN** the selection is held in the draft record and no message reaches `board-host`

### Requirement: An item that fails
Each item SHALL render inside an error boundary. An item that throws SHALL show an error state and report the error to the board page, and its question SHALL never count as visible or be answerable (AD-9, AD-10).

#### Scenario: A component throws
- **WHEN** an item's component throws while rendering
- **THEN** the rest of the board stays usable, the item shows an error, and its question offers no "Answer"

### Requirement: Question loading
A question SHALL show its loading state until all its items are ready, and SHALL count as visible only then (AD-9, SM-C2).

#### Scenario: A question becomes visible
- **WHEN** a plain question's options have rendered and laid out once
- **THEN** the loading state ends, and the question's box is unchanged 1 s later

### Requirement: Single-question board
An ask of one question SHALL show as EXPERIENCE's single-question board, whatever presentation and delivery it requests: the tab labelled "<title> · AskBoard", a header with the title and the ask state, and one question card. It SHALL show no outline navigator, open count, next-open jump, "Select recommended", delivery switch or Submit, and SHALL work as in immediate delivery (FR-22).

#### Scenario: The plain-choice board
- **WHEN** the plain-choice ask's board opens
- **THEN** the tab reads "Which database should the order service use? · AskBoard", the header shows "Waiting", and the card shows the chip "Database" and three options, each with its description, then the open prompt, Postpone, "More" and "Answer"

#### Scenario: Submitted delivery requested for one question
- **WHEN** an ask of one question requests `delivery: "submitted"`
- **THEN** the board shows no delivery switch and no Submit, and "Answer" sends at once

### Requirement: Nothing chosen for the user
Options SHALL start with nothing selected, a recommended one included. The arrow keys SHALL move focus only, Space or Enter SHALL select, and selecting SHALL only fill the draft. "Answer" SHALL stay disabled until the question has a choice, "Other…" text or a note (AD-10, NFR-10, FR-3).

#### Scenario: The board opens
- **WHEN** a board opens with a recommended option
- **THEN** no option is selected, the recommended one carries its badge, and "Answer" is disabled

#### Scenario: Moving with the arrow keys
- **WHEN** the user moves through the options with the arrow keys
- **THEN** focus moves, nothing is selected and nothing is sent

### Requirement: Answer sends at once
In immediate delivery, and on the single-question board, "Answer" SHALL send the question's whole answer at once, stamped with the time of the click: the chosen options, the "Other…" text, the option notes and the open prompt's text. The question SHALL then show as answered, and the ask state as `ask-core` reports it (FR-22).

#### Scenario: The user answers
- **WHEN** the user selects "PostgreSQL", writes a note and presses "Answer"
- **THEN** one command carrying the choice and the note reaches `board-host`, the question shows answered with its receipt at "sent", and the header shows "Answered"

### Requirement: Delivery receipt on the board
A sent answer SHALL show "sent", then "delivered to the agent" once the board is told so; never that the agent read it. An answer given while the connection is lost SHALL show "not sent yet" and SHALL be sent on reconnect (FR-22, NFR-10).

#### Scenario: The agent collects
- **WHEN** the agent collects the answer
- **THEN** its receipt changes from "sent" to "delivered to the agent"

#### Scenario: Answering while disconnected
- **WHEN** the user answers while the connection is lost and the ask is still open when it returns
- **THEN** the answer shows "not sent yet", is sent on reconnect once the board has the new connection's state, and is logged once

### Requirement: Board banners
The board page SHALL show EXPERIENCE's board banners: "Connection lost, retrying" while it reconnects, with Submit disabled, resuming if the ask is still open; Closed and Discarded, locking the board read-only; with unsent work, "Your unsent work was not sent" and "Copy my unsent work"; and Board moved, with "Continue here" (AD-21, NFR-10, FR-6, FR-25).

#### Scenario: The session ends
- **WHEN** the session process exits while the board is open
- **THEN** the board shows the ask as discarded, stays readable and accepts no answer

#### Scenario: The token is refused on reconnect
- **WHEN** the board reconnects and its token is refused, as after the session process restarted
- **THEN** the board shows the ask as discarded

#### Scenario: A short drop
- **WHEN** the connection drops and returns while the ask is open
- **THEN** the board shows "Connection lost, retrying", then resumes in the ask's current state

#### Scenario: The agent closes with unsent work
- **WHEN** the agent closes the ask while the user has a note typed on a question
- **THEN** the board locks with the Closed banner, says "Your unsent work was not sent", and "Copy my unsent work" puts the note on the clipboard as text

### Requirement: Keyboard core
Every act SHALL work from the keyboard with a visible focus ring: options, "Other…", "Accept recommended", "Answer", the open prompt, Postpone, "More" with Explain and Decline, the composer and Send, the agent-change choices, the delivery switch, "Select recommended", Submit and the navigators. A newly opened board SHALL ignore keys until the user clicks or focuses inside it (NFR-12).

#### Scenario: Answering with the keyboard only
- **WHEN** the user focuses the board, tabs to the options, selects one with Space and activates "Answer" with Enter
- **THEN** the answer is sent as with the mouse

#### Scenario: Focus after Postpone and after a discard
- **WHEN** the user postpones a question, and later the ask is discarded
- **THEN** focus moves to the question's heading, then to the banner

### Requirement: Theme follows the system
The board SHALL follow the system's light or dark preference with DESIGN.md's tokens, the board page setting the view's `.dark` class.

#### Scenario: A dark system
- **WHEN** the system prefers a dark scheme
- **THEN** the board page and the view use DESIGN.md's dark tokens

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
"Answer" SHALL be enabled once the question has a choice, a widget holds a change or a widget holds a result. It SHALL send one answer message carrying the chosen options, if any, the full edited value of each changed widget item in its input-format shape, and the result of each widget that holds one, and nothing for an untouched one. The question SHALL then be read-only (AD-10, AD-20, FR-22).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved UJ-2 answer's `wbs` edits with the keyboard and presses "Answer"
- **THEN** one answer message leaves the view, its Tree value validates as an edited value, and the contract's diff of the sent and the edited value equals the approved `wbs` operations

#### Scenario: Nothing changed
- **WHEN** a Tree question opens and the user only moves the focus and expands and collapses nodes
- **THEN** "Answer" stays disabled

#### Scenario: A result alone
- **WHEN** a question's only content is a result its widget holds in the draft record
- **THEN** "Answer" is enabled, and the answer it sends carries `results` with that result and no `values`

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
The toolbar and the tree SHALL each be one Tab stop. In the tree, the arrow keys, Home and End SHALL move the focus as in a treegrid, Alt+Shift with the arrow keys SHALL move, indent and outdent, and Delete or Backspace SHALL delete. These keys SHALL trigger no browser action, and every toolbar tool SHALL work from the keyboard with a visible focus ring (NFR-12).

#### Scenario: Move, indent and outdent keys
- **WHEN** the focus is on a row
- **THEN** Alt+Shift with ArrowUp, ArrowDown, ArrowRight and ArrowLeft moves up, moves down, indents and outdents it

#### Scenario: Selection and undo keys
- **WHEN** the focus is on a row
- **THEN** Space toggles its selection, Shift with ArrowUp or ArrowDown extends the selection (Tree row selection), and Ctrl or Cmd with Z undoes a bulk adjustment (Tree adjustment undo)

#### Scenario: Moving with the keyboard only
- **WHEN** the user tabs into the tree, moves to `billing` with the arrow keys and presses Alt+Shift+ArrowUp
- **THEN** `billing` precedes `portal`, focus stays on `billing`, and the page has not navigated

#### Scenario: Adding from the toolbar by keyboard
- **WHEN** the user tabs to the toolbar, moves to "Add node" with the arrow keys and presses Enter
- **THEN** a new node after the current one starts editing its name

### Requirement: Tree change highlight
The Tree SHALL show what the user changed against what the agent sent: changed names and fields in the change hue with its border, an added row with the change bar, a moved row with a change mark on its name. The toolbar SHALL read "No changes" until the first change, then "Your changes: N", counting each added, removed, moved or edited node once (FR-11; EXPERIENCE Change highlight, By surface).

#### Scenario: Counting changes
- **WHEN** the user renames `portal`, adds `u-1` and deletes `reporting`
- **THEN** the renamed name and the added row carry the change highlight and the toolbar reads "Your changes: 3"

### Requirement: Tree plain values
A Tree without `pert` SHALL show and edit node fields as plain values and SHALL compute none: no roll-up, total or formula, and its answer SHALL carry no derived value (AD-13; proposal open question 3).

#### Scenario: A child's estimate changes
- **WHEN** the user changes a number field of `portal` in a Tree without `pert`
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

### Requirement: The Gantt's chunks
The Gantt SHALL be built as the component chunk `gantt` of the view's manifest, and `compute` as a library chunk that it needs; `assemble` SHALL inline them only for a board whose items render with the Gantt (AD-9).

#### Scenario: The manifest
- **WHEN** the view is built
- **THEN** the manifest lists the component chunk `gantt`, registering `gantt` and needing the shell, `react`, `radix` and `compute`, each chunk with a hash that matches its content and its licence notices

#### Scenario: Only boards with a Gantt load them
- **WHEN** the plain-choice board document and a board document holding a Gantt are assembled
- **THEN** the first srcdoc holds neither `gantt` nor `compute`, and the second holds both

#### Scenario: A Gantt board in each engine
- **WHEN** a board holding the Gantt plan is loaded, edited and answered in Chromium, Firefox and WebKit
- **THEN** no CSP violation is reported by the view, its host page or the console

### Requirement: Gantt layout
The Gantt SHALL show, in the widget frame, a grid with one row per task (its name, start, duration and predecessors) beside AskBoard's own chart on a time axis: one bar per task and finish-to-start arrows. The grid's TASK column SHALL be resizable (Gantt task column resize). Every agent string SHALL render as text (AD-8; DESIGN.md Widgets, Gantt).

#### Scenario: Critical path and legend
- **WHEN** the "Critical path" switch is on
- **THEN** the critical path is drawn as solid bars in the critical colour with heavier arrows, and the legend reads task, critical path and your change (and, in a plan, the agent's plan)

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

### Requirement: Gantt dates follow the edits
Every edit SHALL reschedule the Gantt on the board within the same interaction, without the agent: the edited task's dependents move, and the critical path follows. In a plan, an estimate changed in its Tree SHALL change the task's duration and the schedule the same way (FR-12, AD-13).

#### Scenario: A task moved later
- **WHEN** the user moves the portal three working days later
- **THEN** reporting moves three working days later, and the plan ends three working days later

#### Scenario: An estimate changed in the work breakdown
- **WHEN** the user changes the portal's most likely estimate in the Tree from 12 to 20
- **THEN** the portal's duration in the plan becomes 18 working days, and reporting and the plan's end move with it

### Requirement: Gantt rescheduling by drag
The user SHALL reschedule a task by dragging its bar with the pointer. The bar SHALL snap to working days and stop at the earliest start its predecessors allow, which SHALL show during the drag as a full-height 2px dashed guide with the label "earliest 11/6". Dropping it on its earliest start SHALL clear its requested start; Escape during the drag SHALL cancel it (EXPERIENCE Widgets, Gantt; F-24; review F-14).

#### Scenario: Dragging past the predecessors
- **WHEN** the user drags reporting's bar to start before the portal ends
- **THEN** the bar stops at the day after the portal ends, the guide shows there with its label, and dropping it changes nothing

#### Scenario: Dropping on a weekend
- **WHEN** the user drops reporting's bar with its start over Saturday 12/12/2026
- **THEN** reporting starts on Monday 12/14/2026

### Requirement: Gantt durations
In a Gantt with its own tasks, the user SHALL change a task's duration by dragging the end of its bar or by typing it in the grid, as whole working days, never below one; in a plan the same acts set a requested duration (Gantt plan duration resize) (EXPERIENCE Widgets, Gantt).

#### Scenario: Resizing a bar
- **WHEN** the user drags the end of a 6-day task's bar two working days to the right
- **THEN** its duration is 8 working days, and its dependents move two working days later

#### Scenario: Below one day
- **WHEN** the user drags the end of a 1-day task's bar to the left
- **THEN** its duration stays 1 working day

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

### Requirement: Gantt predecessors
The user SHALL edit a task's predecessors from its grid row, in an inline panel listing every other task to check or uncheck. A task that would close a cycle SHALL be disabled, saying why, and a task at the limit of 50 predecessors or 50 dependents SHALL take no more (EXPERIENCE Widgets, Gantt; proposal open question 9).

#### Scenario: Linking a package
- **WHEN** the user opens billing's predecessors and also checks Clickable prototype
- **THEN** billing starts after the prototype ends, and the draft holds the change

#### Scenario: Linking an added package
- **WHEN** the user splits the portal into `u-1` and opens `u-1`'s predecessors
- **THEN** Architecture and Clickable prototype are already checked, the predecessors the split gave it (An added package's predecessors), with nothing linked by hand

#### Scenario: A cycle offered
- **WHEN** the user opens the prototype's predecessors
- **THEN** the portal and reporting, which depend on the prototype, are disabled

### Requirement: Gantt predecessors that name no task
A predecessor a task holds that names no other task, such as a work package that became a parent in the Tree, an unknown ID from the agent or the task itself, SHALL be listed checked in the task's panel, saying that it names no task, so that the user can uncheck it. The panel SHALL NOT offer the task itself, or such an ID, to any other task (FR-14).

#### Scenario: A predecessor deleted in the Tree
- **WHEN** the portal is deleted in the plan's Tree, the user confirms the question that says one task depends on it, and opens reporting's predecessors
- **THEN** reporting's predecessors are Architecture and Clickable prototype, the portal's own, and none is listed as naming no task

#### Scenario: A predecessor that became a parent
- **WHEN** the user adds a child to the portal in the plan's Tree and opens reporting's predecessors
- **THEN** `portal` is listed checked, saying that it names no task, and once the user unchecks it and presses "Done", reporting is scheduled again with no field error

### Requirement: Gantt formula errors
A task whose schedule is in error, from a dependency cycle or a predecessor that names no task, SHALL show a field error under its row and no bar, and SHALL NOT block "Answer" (AD-13, FR-14; EXPERIENCE State Patterns, By surface).

#### Scenario: A cycle from the agent
- **WHEN** a Gantt whose two tasks depend on each other opens
- **THEN** both rows show a field error, neither has a bar, the other tasks are scheduled, and the question can be answered once the user changes something

### Requirement: Gantt edits only fill the draft
Every Gantt edit SHALL go into the draft record and SHALL send nothing. A Gantt whose edits bring it back to the agent's value SHALL hold no draft value (AD-9, AD-10, AD-20).

#### Scenario: Editing without answering
- **WHEN** the user drags, resizes, types starts and durations and changes predecessors
- **THEN** no view message other than the question's `ready` leaves the view

#### Scenario: Edits undone by hand
- **WHEN** the user drags a task later and then back onto its earliest start
- **THEN** the Gantt holds no draft value and "Answer" is disabled again

### Requirement: Answering a question with a Gantt
"Answer" SHALL send one answer message carrying each changed widget's full edited value and, when it names the question's current revision, the declared derived values of every Gantt in the question as they stand, changed or not; an untouched Gantt sends no value, only its derived values. The question SHALL then be read-only (AD-10, AD-20, FR-12).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved answer's edits with the keyboard, in the Tree and in the plan, and presses "Answer"
- **THEN** one answer message leaves the view; the contract's diff of the sent and the edited plan equals the approved `schedule` operation, and its derived values are `schedule.finish` `2026-12-02` and `schedule.criticalPath` `ux`, `prototype`, `portal`, `reporting`

#### Scenario: Nothing changed
- **WHEN** a Gantt question opens and the user only zooms and moves the focus
- **THEN** "Answer" stays disabled

### Requirement: Gantt change highlight
A task the user changed in the Gantt SHALL take the change outline on its bar and the change fill on its changed cells. A plan task whose duration only follows an estimate or an added package the user changed in the Tree SHALL take the derived mark, the `change-subtle` fill with a dotted bar outline and no border (FR-11; EXPERIENCE Change highlight; review F-07).

#### Scenario: The toolbar's count
- **WHEN** the toolbar shows changes
- **THEN** it reads "No changes", then "Your changes: N" counting each task changed in the Gantt once, and, in a plan, "Your changes: N · M follow from the WBS" when M tasks carry the derived mark

#### Scenario: A task that only moved
- **WHEN** a task moved only because a predecessor moved
- **THEN** it carries neither the change outline nor the derived mark

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

### Requirement: Read-only Gantt
When its question is answered, being sent or locked, the Gantt SHALL stay readable, zoomable and navigable from the keyboard, and its column resize and "Critical path" switch SHALL keep working, as view state; it SHALL accept no edit: bars do not drag or resize, cells do not edit and the predecessors panel does not open (AD-10, AD-21).

#### Scenario: After "Answer"
- **WHEN** the user has pressed "Answer" on a Gantt question
- **THEN** dragging a bar, resizing its end and pressing Enter on a start change nothing, and the zoom, the switch and the column resize still work

### Requirement: Gantt keyboard
The grid SHALL be one Tab stop and, in a plan, the toolbar another. In the grid, the arrow keys, Home and End SHALL move the focus between cells; Enter or F2 edits; Delete or Backspace on a start clears the request. These keys SHALL trigger no browser action, and every keyboard path SHALL show the focus ring (NFR-12; EXPERIENCE Accessibility Floor).

#### Scenario: Rescheduling with the keyboard only
- **WHEN** the user tabs into the grid, moves to reporting's start with the arrow keys, types `12/9/2026` and presses Enter
- **THEN** reporting starts on 12/9/2026, the focus stays on its start, and the page has not navigated

#### Scenario: Clearing a request
- **WHEN** the focus is on a requested start and the user presses Delete
- **THEN** the task moves back to its earliest start, and the cell loses its change fill

### Requirement: Presentations
A board of two or more questions SHALL show its areas, or its questions as one group when the ask has none, in the presentation the ask requests: sections, tabs or one question per view, and sections when it requests none. Each area SHALL be a distinct part labelled with its title, and an area the agent has emptied SHALL be hidden (FR-2).

#### Scenario: Three areas as sections
- **WHEN** an ask of three areas without a presentation opens
- **THEN** the board shows three titled sections, one after another

#### Scenario: Tabs without areas
- **WHEN** an ask of four questions without areas requests tabs
- **THEN** the board shows them as one group, with no tab strip

### Requirement: Tabs
With tabs, the board SHALL show one tab per area, labelled with its title and its open count. The questions of hidden tabs SHALL stay mounted, so that they report ready.

#### Scenario: A question answered in another tab
- **WHEN** the user answers the last open question of the second area
- **THEN** that tab's label shows no open question, and the first tab's count is unchanged

### Requirement: One question per view
In one question per view, the board SHALL show one question at a time, with its area's title, under the question navigator: "Question n of m", one state marker per question, Previous and Next, which stop at the ends, and "Next open →", which wraps. Navigating SHALL move focus to the question's heading, and answering SHALL NOT advance (FR-2).

#### Scenario: Moving to the next open question
- **WHEN** the user is on question 4 of 5 and questions 2 and 5 are open
- **THEN** "Next open →" shows question 5, then question 2

### Requirement: Outline navigator
With sections or tabs, the board SHALL show the outline navigator: areas and questions, each question with its state marker, the new-question and unread-reply marks, and a jump to the question on a click or keypress that activates its tab.

#### Scenario: Jumping into another tab
- **WHEN** the user activates a question of a hidden tab in the outline
- **THEN** that tab becomes active and the question's heading takes focus

### Requirement: Counts and the next-open jump
On a board of two or more questions the header SHALL show the open count (unanswered and postponed questions) and "Next open ↓", which reaches new questions first, then open ones in board order. The ask pill SHALL show only what the agent has received: "Partly answered n/m", or "answered, 1 postponed" (FR-24).

#### Scenario: A ready answer does not move the pill
- **WHEN** in submitted delivery the user marks two of three questions ready
- **THEN** the open count drops to 1, and the ask pill still shows "Waiting" until Submit

### Requirement: Open prompt
Every question SHALL show its open prompt, "Note for the agent (optional)". Its text SHALL leave only with the question's answer or decline, or alone through "Answer", which sends it as a note and leaves the question open; never on typing or blur (FR-7, AD-20). While an item's held result requires a reason, as an Approval's "Approve with changes" does, the prompt SHALL read "Reason for the changes (required)" (FR-11, F-04).

#### Scenario: A note without an answer
- **WHEN** the user writes only a note and presses "Answer"
- **THEN** a note is sent, and the question still counts as open

#### Scenario: The reason's label
- **WHEN** the user selects "Approve with changes", then "Reject"
- **THEN** the prompt reads "Reason for the changes (required)", then "Note for the agent (optional)" again, keeping its text

### Requirement: Other row
A question with `allowOther` SHALL show "Other…" as its last option, with its own text field, whose text is the answer's "Other…" text and stays apart from the open prompt. In a single choice, choosing "Other…" SHALL clear the selected option, and choosing an option SHALL clear "Other…" (FR-3).

#### Scenario: Answering with Other
- **WHEN** the user chooses "Other…", types "MariaDB" and presses "Answer"
- **THEN** the answer carries the "Other…" text "MariaDB" and no option label

### Requirement: Recommended option
The recommended option SHALL carry the "Recommended" badge and never start selected. "Accept recommended", shown only on a question with a recommendation, SHALL select it and act as "Answer" in one click (FR-3, AD-10).

#### Scenario: Accept recommended in immediate delivery
- **WHEN** the user presses "Accept recommended" on a question
- **THEN** its recommended option is selected and the answer is sent at once

### Requirement: Select recommended
On a board of two or more questions where one has a recommendation, "Select recommended" SHALL select the recommended option on every unanswered question that is not postponed, declined or ready and where the user has chosen nothing, and send nothing. Submit SHALL send the selections it made that the user left in place (FR-3, FR-22).

#### Scenario: A choice is never replaced
- **WHEN** the user has chosen an option on one question and presses "Select recommended"
- **THEN** that question keeps the user's choice, the others with a recommendation get it selected, and nothing is sent

### Requirement: Option previews
An option with a preview SHALL show "Show preview", which opens the preview below the option, as plain text unless the option's `previewFormat` is `markdown`, one preview open at a time (FR-3; open question 9).

#### Scenario: Two previews
- **WHEN** the user opens one option's preview, then another's
- **THEN** only the second preview is open

### Requirement: Option annotations and notes
The agent's annotation SHALL show under its option, prefixed "Agent:". The user SHALL be able to add a note to any option with "+ Add your note to this option", and the notes SHALL return with the answer, by option label (FR-3, FR-18).

#### Scenario: A note on an option not chosen
- **WHEN** the user notes "too costly" on DynamoDB and answers PostgreSQL
- **THEN** the answer carries `choice: ["PostgreSQL"]` and the note under the label DynamoDB

### Requirement: Postpone
Postpone SHALL mark an open question postponed, sent at once in immediate delivery and held in submitted delivery, and pressed again SHALL undo it. It SHALL be disabled on an answered, declined or ready question, and a postponed question SHALL stay on the board, open (FR-4).

#### Scenario: Undoing a sent postpone
- **WHEN** in immediate delivery the user postpones a question, then undoes it
- **THEN** a postpone and then a reopen reach `board-host`, and the question is open

### Requirement: Decline
"More" SHALL hold Explain and Decline. Decline SHALL close its question as declined, with the open prompt's text as the reason, following the delivery mode, and SHALL be undone like Postpone. It SHALL be disabled on an answered or ready question (FR-4).

#### Scenario: Declining in submitted delivery
- **WHEN** in submitted delivery the user declines a question with a reason
- **THEN** the question shows declined, nothing is sent, and Submit sends the decline with its reason

### Requirement: Explain
Explain SHALL send the follow-up "Why are you asking, and what changes with each option?" on its question at once, in either delivery mode, and stay disabled until a reply to it arrives (FR-10).

#### Scenario: Explain in submitted delivery
- **WHEN** in submitted delivery the user chooses Explain
- **THEN** the follow-up is sent at once, and Explain is disabled until the agent replies

### Requirement: Follow-up thread
Each question SHALL have a follow-up thread, collapsed until opened, with its composer at the foot: Enter adds a line, and Ctrl+Enter, Cmd+Enter or "Send" sends at once in either delivery mode. Replies SHALL show in the thread under their follow-up with author and time, and SHALL never raise an agent-change notice (FR-10).

#### Scenario: Two rounds before answering
- **WHEN** the user sends a follow-up, reads the reply, sends another, reads its reply and answers
- **THEN** the thread holds both follow-ups and both replies in order, and the answer is sent

### Requirement: Unread replies
A reply that arrives while its question is out of view SHALL mark the question in the outline or question navigator and count in the header ("1 new reply"), whose activation jumps to it; the mark SHALL clear once the reply has been in view.

#### Scenario: A reply off-screen
- **WHEN** a reply arrives for a question scrolled out of view
- **THEN** the header shows "1 new reply", and activating it brings the reply into view and clears the mark

### Requirement: Delivery mode
A board of two or more questions SHALL start in the delivery mode the ask requests, immediate when it requests none, and SHALL let the user switch. In submitted delivery "Answer" SHALL mark the question ready, and an edit to a ready question SHALL make it not ready (FR-22).

#### Scenario: Editing a ready question
- **WHEN** the user marks a question ready, then changes its choice
- **THEN** the question is no longer ready and Submit would not send it

### Requirement: Submit
In submitted delivery, Submit SHALL send every ready answer, held postpone, decline and undo, and the selections of "Select recommended" left in place, as one command in the order the user produced them. It SHALL be disabled while nothing is held, while the connection is lost, and while an agent-change notice sits on a question with held work (AD-20).

#### Scenario: Submitting a postpone and two answers
- **WHEN** the user marks two answers ready, postpones a third question and presses Submit
- **THEN** one command carrying the three acts in that order reaches `board-host`, and the receipts show "sent"

#### Scenario: Submit under a pending agent change
- **WHEN** an agent-change notice sits on a question with a ready answer
- **THEN** Submit is disabled, and the bar says how many updates need a choice and jumps to the first

### Requirement: Mode-switch confirmation
Switching from submitted to immediate delivery while work is held SHALL ask the user to confirm in a modal dialog. Confirming SHALL send the held work as Submit does and switch; cancelling SHALL keep submitted delivery. It SHALL be blocked as Submit is (FR-22).

#### Scenario: Cancelling the switch
- **WHEN** the user switches to immediate with a ready answer held and cancels
- **THEN** nothing is sent and the board stays in submitted delivery

### Requirement: Revising an answer
While the ask is open, an answered or declined question SHALL stay editable: an edit fills the draft, and "Answer" sends the revision as the delivery mode says. The question SHALL show its latest answer with that answer's receipt (FR-22).

#### Scenario: Revising after delivery
- **WHEN** the agent has received "PostgreSQL" and the user selects "SQLite" and presses "Answer"
- **THEN** the revision is sent, the receipt shows "sent", then "delivered to the agent" once collected

### Requirement: Agent changes without unsent work
An agent's change to a question without unsent work SHALL show at once, without a reload or a notice. A question the agent adds SHALL carry "New" until it has been in view; a question it deletes SHALL disappear, and its unsent work with it, and in one question per view the navigator SHALL move on and say "Question removed by the agent" (FR-6; open question 8).

#### Scenario: An added question
- **WHEN** the agent adds a question while the user works on another
- **THEN** the new question appears with "New", the open count grows by one, and the next-open jump reaches it first

### Requirement: Agent-change notice
When the agent changes a question holding unsent work, the board SHALL keep that work and show, inline and without taking focus, "The agent updated this", the count of the user's changes, "Show the agent's change", "Reload, losing my work" and "Keep mine". The choice SHALL be sent at once, and an answer kept by "Keep mine" SHALL name the kept revision (FR-6).

#### Scenario: The user reloads the question
- **WHEN** the user chooses "Reload, losing my work"
- **THEN** a `reload` edit choice is sent, the question's draft is dropped, and the question shows its new revision

#### Scenario: The user keeps their work
- **WHEN** the user chooses "Keep mine" and answers
- **THEN** an `ignore` edit choice is sent first, then the answer naming the earlier revision

### Requirement: Reopened question
A question the agent reopens SHALL show "Reopened by the agent" and its new revision with nothing chosen, the previous answer read-only beside it, and "Start from my previous answer", which moves that answer into the draft (AD-10, AD-20).

#### Scenario: Starting from the previous answer
- **WHEN** the user presses "Start from my previous answer" on a reopened question
- **THEN** the previous choice is selected in the draft, and nothing is sent until "Answer"

### Requirement: Recorded answers on the board
A question the agent answered on the user's behalf SHALL show as answered, with the recorded answer, and SHALL count as answered (FR-6).

#### Scenario: A postponed question answered in the terminal
- **WHEN** the agent records an answer to a postponed question
- **THEN** the board shows the question answered with that answer, and the postponed count drops by one

### Requirement: Draft mirror and restore
The board page SHALL mirror the draft record to `board-host` after each change and when the page is hidden, and restore it on reconnect, reload and takeover, with the delivery mode and the question in view. Work restored for a question whose `rev` changed meanwhile SHALL raise the agent-change notice (AD-20, FR-25).

#### Scenario: A reload keeps unsent work
- **WHEN** the user has a ready answer and a note in submitted delivery and reloads the tab
- **THEN** the board comes back in submitted delivery with the ready answer and the note, and nothing was sent

### Requirement: Leave-page prompt
The board page SHALL arm the browser's leave-page prompt while the draft holds unsent work, work too large to keep across a reload included, or postponed questions are open, and the bottom action bar SHALL then show "You have 1 postponed question: closing loses this ask", with the count (FR-25).

#### Scenario: Closing with a postponed question
- **WHEN** a question is postponed and the user closes the tab
- **THEN** the browser's prompt to leave the page appears first

#### Scenario: Closing with work too large to keep
- **WHEN** the only unsent work is a question's work left out of the mirrored record and the user closes the tab
- **THEN** the browser's prompt to leave the page appears first

#### Scenario: Taken over with work too large to keep
- **WHEN** another tab takes the board over while this tab's draft holds a question's work left out of the mirrored record, and the user closes this tab
- **THEN** the browser's prompt to leave the page appears first, since the takeover handed over only the mirrored record

### Requirement: The board's working signal
The board page SHALL send `board-host` a presence message whenever its working signal changes, and once after each connect: working while the page has focus and has had a key or pointer input, on the board page or in its view, within the last 60 s. The message SHALL carry only that flag, never content (AD-2, AD-7).

#### Scenario: The user types an answer
- **WHEN** the user clicks an option on a focused board
- **THEN** the board page reports that it is working

#### Scenario: A minute without input
- **WHEN** a focused board has had no input for 60 s
- **THEN** the board page reports that it is not working

#### Scenario: The user switches tabs
- **WHEN** the board's tab loses focus
- **THEN** the board page reports at once that it is not working

#### Scenario: The user switches to another application from inside the view
- **WHEN** the focus is inside the view and the browser window loses focus to another application
- **THEN** the board page reports within about a second that it is not working

### Requirement: Who asked, and where
The context header's first row SHALL name who asked: "Main agent", "Subagent <type>" or "Teammate <name>", with " · <name>" when the agent gave a display name and an ordinal ("#2") for a second subagent of the same type. It SHALL then show the labelled fields Project, Directory, Branch and Worktree from the ask's origin, and "—" for a field AskBoard does not know (FR-24, EXPERIENCE Board anatomy, DESIGN.md Context header).

#### Scenario: A named subagent in a worktree
- **WHEN** a `code-reviewer` subagent named "Retry review" asks from a linked worktree on branch `fix/retry`
- **THEN** row 1 reads "Subagent code-reviewer · Retry review", with the project, its directory, `fix/retry` and the worktree's folder name

#### Scenario: Two asks from two worktrees
- **WHEN** two asks of one project come from agents in two worktrees
- **THEN** their headers alone tell them apart

#### Scenario: A second subagent of one type
- **WHEN** a second `code-reviewer` subagent of the same session asks without a name
- **THEN** row 1 reads "Subagent code-reviewer #2"

#### Scenario: A teammate in its own pane
- **WHEN** an agent-team teammate named `researcher`, running in its own pane, asks
- **THEN** row 1 of its board reads "Teammate researcher"

#### Scenario: An in-process teammate
- **WHEN** an in-process teammate named `scout-2` asks through the lead's session
- **THEN** row 1 of its board reads "Teammate scout-2", with no ordinal

#### Scenario: The lead
- **WHEN** the lead of an agent team asks
- **THEN** row 1 reads "Main agent"

#### Scenario: An unchecked ask
- **WHEN** an ask arrives with no agent record
- **THEN** row 1 reads "Agent · <its display name>", or "Agent" without one, shows the project, and shows "—" for Directory, Branch and Worktree

### Requirement: The expected answerer in the header
Row 1 SHALL show "For: <name>" after who asked only when the ask names an expected user who differs from the session project's git user name, compared without case and surrounding spaces; on a machine with no git user name, a named expected user always shows (FR-19, FR-24).

#### Scenario: The expected user is the git user
- **WHEN** an ask names as `expectedUser` the git user name of the session project
- **THEN** the header shows no "For:"

#### Scenario: Another expected user
- **WHEN** an ask names an `expectedUser` other than the git user name
- **THEN** row 1 shows "For: <that name>" after who asked

### Requirement: The agent pill
Row 2 SHALL show the agent pill, "Agent: Working" or "Agent: Waiting for your answer", as `board-host` reports it, and change it as soon as the report changes, within the interaction that caused it. The pill shows presence only, never an ask state (AD-4, FR-24, DESIGN.md State pill).

#### Scenario: The agent starts waiting
- **WHEN** the agent calls `collect` with `wait` on the board's ask
- **THEN** the pill reads "Agent: Waiting for your answer" before the user's next action

#### Scenario: The wait ends
- **WHEN** the waiting `collect` returns with the user's answer
- **THEN** the pill reads "Agent: Working"

### Requirement: Agent text and paths in the header
Every agent string and path in the header SHALL render as text, isolated for bidirectional text, capped with an ellipsis, with the full text on hover and on keyboard focus. A bidirectional control character in a path, branch or worktree SHALL show as a visible escape (AD-8, EXPERIENCE Agent-written labels).

#### Scenario: A right-to-left override in a branch name
- **WHEN** the origin's branch holds U+202E
- **THEN** the header shows it as a visible escape, and the rest of the row keeps its order

#### Scenario: A long directory
- **WHEN** the directory is longer than its field
- **THEN** it ends in an ellipsis, and the full path shows on hover and on focus

### Requirement: Molecules reach the view expanded
The view SHALL receive a molecule only as the widget items its expansion gave, and SHALL hold no molecule code. A board document holding a `molecule` item SHALL fail to assemble, naming the type, since no chunk registers it (AD-9, AD-10, AD-12).

#### Scenario: A reference that was never expanded
- **WHEN** a test board document's question holds a `molecule` item
- **THEN** `assemble` fails, naming the type `molecule`, and no srcdoc is built

### Requirement: Linked edits in one draft update
A component SHALL be able to put the values of several items of its own question into the draft record in one update, `undefined` removing an item's value. An update naming an item outside the component's question SHALL change nothing and SHALL be reported as an error. The board a component reads SHALL give each item the value it shows: its draft value, else its question's latest answer's value for it, else its props as sent (AD-9, AD-20).

#### Scenario: Two items at once
- **WHEN** a test `probe` component sets its own value and its sibling's in one update
- **THEN** the draft record holds both, "Answer" is enabled, and no view message leaves the view

#### Scenario: An item of another question
- **WHEN** a `probe` component's update names an item of another question
- **THEN** the draft record is unchanged and the item reports the error

#### Scenario: A linked edit on an answered question
- **WHEN** the user revises an answered question whose answer holds edits of the plan, and names a package added in the Tree after the portal
- **THEN** the plan's draft value is the answered plan with the added package's predecessors, and the plan shows it; no other item of the question gains a draft value

### Requirement: The board graph chunk
The board graph SHALL be the library chunk `board-graph`, needing `compute`, which the `tree` and `gantt` chunks need; every computing widget on a board SHALL read one live graph per draft change and one graph of the board as sent (AD-9, AD-13).

#### Scenario: The manifest
- **WHEN** the view is built
- **THEN** the manifest lists the library chunk `board-graph`, needing `compute`, and both `tree` and `gantt` need it

#### Scenario: One graph for two widgets
- **WHEN** an estimate is committed on the UJ-2 board, where the WBS and the plan both read the graph
- **THEN** the graph is built once for that draft change

### Requirement: WBS layout
A Tree with `pert` SHALL show the columns "Work package", "Optimistic", "Most likely", "Pessimistic", "Expected effort" and "Spread" (labels provisional): estimates and values with the "d" affix, values read-only, right-aligned, with one decimal, parents with their roll-ups and no estimate cells, and a "Total" row when it has several top-level packages (EXPERIENCE and DESIGN.md Molecules, WBS with PERT).

#### Scenario: The UJ-2 work breakdown opens
- **WHEN** the expanded UJ-2 question opens
- **THEN** UX design shows 5.5 d and 1.2 d, Design shows 14.0 d and 1.6 d and no estimate cells, and the Total row shows 40.7 d and 3.2 d

#### Scenario: One top-level package
- **WHEN** a work breakdown has a single top-level package
- **THEN** that package's row shows the totals, and there is no Total row

### Requirement: WBS values follow the edits
An estimate the user changes SHALL update its package's expected effort and spread, its parents' roll-ups and the totals within the same interaction, without the agent, and SHALL send nothing (FR-12, AD-13).

#### Scenario: Re-estimating the portal
- **WHEN** the user sets the portal's estimates to 4, 6 and 10
- **THEN** the portal shows 6.3 d and 1.0 d, Build 20.3 d and Total 34.3 d, and no view message leaves the view

#### Scenario: A negative estimate
- **WHEN** the user types `-2` as an estimate and presses Enter
- **THEN** the cell shows a field error, keeps the focus, and the draft is unchanged

### Requirement: WBS opening depth
A Tree with `pert` SHALL open with the packages above its `openDepth` expanded and the rest collapsed. Expanding and collapsing SHALL change no value and SHALL NOT count as a change (EXPERIENCE Molecules, WBS with PERT).

#### Scenario: Two levels
- **WHEN** the expanded UJ-2 question opens with `openDepth` 2
- **THEN** Design and Build show open chevrons and their six children are visible

#### Scenario: One level
- **WHEN** it opens with `openDepth` 1
- **THEN** only Design and Build are visible, with closed chevrons

### Requirement: An added package's predecessors
A package the user adds to a Tree that a Gantt plan of its question names, with `pert` or without, SHALL, once named, get in that plan the predecessors the plan gives the package it was added after ("Add node") or under ("Add child"), none when that package has none, in the same draft update (F20; EXPERIENCE Molecules, WBS with PERT).

#### Scenario: Splitting the portal
- **WHEN** the user focuses the portal, chooses "Add node" and names the package `Customer portal: dashboards`
- **THEN** the plan's `u-1` depends on Architecture and Clickable prototype and starts after the prototype ends, both items hold draft values, and no view message leaves the view

#### Scenario: A child of a leaf
- **WHEN** the user adds and names a child of reporting, which depends on the portal
- **THEN** the new package depends on the portal in the plan

#### Scenario: An addition taken back
- **WHEN** the user chooses "Add node" and presses Escape
- **THEN** neither the Tree nor the plan holds a draft value

### Requirement: Linked edits within a plan's limits
An addition or a confirmed deletion in a Tree whose edit of a linked plan would take that plan past a limit (50 predecessors of a task, 50 dependents of a task, 500 entries) SHALL be refused with a field error naming the limit, and SHALL write nothing to the Tree or the plan (AD-9, AD-10; F20).

#### Scenario: A linked edit past a plan's limit
- **WHEN** the user names a package added after one whose predecessor already has 50 dependents in the plan
- **THEN** the name shows a field error naming the limit of 50 dependents, keeps the focus, and neither the Tree nor the plan holds a draft value

### Requirement: Deleting a package with dependents
Deleting a package on which tasks of a linked plan depend, in a Tree with `pert` or without, SHALL ask first, inline, saying how many tasks depend on it, with the focus on "Cancel". Confirming SHALL connect each dependent to the deleted packages' own predecessors, without repeats, and return each deleted package's entry to what the agent sent for it (EXPERIENCE Molecules, WBS with PERT).

#### Scenario: Deleting the portal
- **WHEN** the user deletes the portal, on which reporting depends, and confirms
- **THEN** reporting depends on Architecture and Clickable prototype, and the diff of the sent and the edited plan is one `set` of reporting's predecessors

#### Scenario: Cancelling
- **WHEN** the user deletes the portal and chooses "Cancel"
- **THEN** the Tree and the plan are unchanged

#### Scenario: Deleting a package the user added
- **WHEN** the user splits the portal into `u-1` and then deletes `u-1`
- **THEN** neither the Tree nor the plan holds a draft value, and "Answer" is disabled

### Requirement: Answering a work breakdown question
"Answer" SHALL send one answer message carrying the full edited value of each changed item and, when it names the question's current revision, the derived values of the Tree with `pert` and of the plan as they stand (AD-20, FR-12, F7).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved answer's `wbs` edits by keyboard on the expanded UJ-2 question and presses "Answer"
- **THEN** one answer message leaves the view, holding `wbs__tree` and `schedule__plan`; put in reference addressing by `ask-core`, its changes are the approved eight operations and its derived values the approved fourteen; and no CSP violation is reported

### Requirement: A question with context splits
A question with at least one resolved or agent-written excerpt SHALL render split, its context column of excerpts then references beside the question text and options, unless the user placed its context inline. A question with none SHALL take the full width, its references and unresolved pointers inline under the question text (FR-13; EXPERIENCE Board anatomy).

#### Scenario: One excerpt resolves
- **WHEN** a question holds a resolved excerpt and a reference
- **THEN** it renders split, with "Excerpt and references" beside the question text and options

#### Scenario: Every excerpt unresolved
- **WHEN** a question's only excerpt is unresolved and it holds a reference
- **THEN** it takes the full width, and the unresolved pointer and the reference show inline under the question text

#### Scenario: A wide widget under a split question
- **WHEN** a split question also holds a widget
- **THEN** the widget spans the card's full width below both columns

### Requirement: Context placement per question
The context column's title row SHALL hold a "Beside | Inline" control on a split question; choosing Inline moves the context under the question text, for that question only, and the choice SHALL survive a reload and a takeover through the draft record without counting as unsent work (FR-13, AD-20).

#### Scenario: Inline survives a reload
- **WHEN** the user sets one question's context to Inline and reloads the board
- **THEN** that question's context is still inline, the other questions' still beside

#### Scenario: Placement is not unsent work
- **WHEN** the only change on a board is a question's placement
- **THEN** no leave-page prompt is armed, and "Copy my unsent work" holds nothing

### Requirement: Excerpts show as source text
An excerpt SHALL show its caption (title, then path, anchor and line range) and its body as source text with its line numbers, through `textContent` only, capped in height with scrolling inside; an excerpt from a file SHALL offer "Open in reading panel". An unresolved excerpt SHALL show "Unresolved" with its pointer (FR-8, AD-8; DESIGN, Excerpt).

#### Scenario: Markup in an excerpt
- **WHEN** an excerpt's text, title or pointer holds `<img src=x onerror=alert(1)>`
- **THEN** the view shows those characters as text, adds no element and reports no CSP violation

#### Scenario: Line numbers follow the file
- **WHEN** an excerpt was read from lines 40 to 52
- **THEN** its body numbers its lines 40 to 52

#### Scenario: Bidirectional controls are visible
- **WHEN** an excerpt's text holds U+202E
- **THEN** the body shows a visible marker for it instead of reordering the line

### Requirement: References open in one click
A reference SHALL show its kind label and its path or title, and open only on an explicit click: a FILE reference in the reading panel, a GITHUB or WEB reference in a new browser tab, `http:` and `https:` only, with `noopener` and `noreferrer`. It SHALL leave the view only as an open-reference message naming its item (FR-9, AD-8).

#### Scenario: A web reference
- **WHEN** the user clicks a WEB reference to `https://example.com/a`
- **THEN** a new tab opens that URL, and the new page's `window.opener` is null

#### Scenario: The board page trusts no URL from the view
- **WHEN** a message reaches the board page naming an item that is not a reference of its board document
- **THEN** the board page opens nothing

#### Scenario: The URL is the board's own, as it stands now
- **WHEN** a message names a web reference whose URL a later revision of the board document changed
- **THEN** the board page opens the URL the board document holds for that item now, and never one that came with the message

### Requirement: Images by pointer
An image SHALL show its bytes from the board document through a `blob:` URL, with its alt text, and never load a URL; an unresolved image SHALL show "Unresolved" with its pointer and leave the rest of the board working (AD-8, AD-12).

#### Scenario: A screenshot
- **WHEN** a question holds a resolved PNG image
- **THEN** the view shows it from a `blob:` URL with its alt text, and the browser reports no CSP violation and no network request for it

### Requirement: Context counts for a visible question
A question SHALL count as visible only once its excerpts, references and images are ready: an image once decoded or found unresolved, every other context item once laid out (AD-9, SM-C2).

#### Scenario: A large image
- **WHEN** a question holds an image that takes time to decode
- **THEN** its `ready` message is sent only after the image is decoded

### Requirement: The reading panel
A FILE reference or an excerpt's "Open in reading panel" SHALL open, on the board page, a non-modal side sheet whose header holds the path, "Changed since the agent asked" when the source state says so, "Open in editor" and a close control, and whose body frames the source view at the anchor, in an iframe with an empty `sandbox` and no referrer (FR-9, AD-8; DESIGN, Reading panel).

#### Scenario: Opening at the anchor
- **WHEN** the user opens a reference to `docs/specs/checkout.md#L40-L52`
- **THEN** the panel shows the file with line 40 at the top of its view and lines 40 to 52 marked, and the frame carries an empty `sandbox`

#### Scenario: Closing returns focus
- **WHEN** the user presses Esc in the panel's header or clicks its close control
- **THEN** the panel closes and focus returns to the reference that opened it

#### Scenario: A missing file
- **WHEN** the referenced file no longer exists
- **THEN** the panel says that the file is not available, shows its path, and "Open in editor" is disabled

#### Scenario: The board locks
- **WHEN** the board is moved to another tab, closed or discarded while the panel is open
- **THEN** a moved or discarded board closes the panel, and a closed board keeps it readable

### Requirement: Open in editor on the board page
"Open in editor" SHALL send `open-editor` only on an explicit click on the board page, show the outcome when it is not `opened`, and be disabled while no editor is set or the file is not available (FR-9, AD-8).

#### Scenario: No editor set
- **WHEN** the reading panel opens and no editor command is configured
- **THEN** "Open in editor" is disabled with "No editor set" and the configuration key to set

### Requirement: Context in a Snapshot view
With no parent host, a FILE reference SHALL show its path and anchor as text, "not available in a Snapshot", an excerpt SHALL hide "Open in reading panel", and a web reference SHALL be a link that opens only on a click, with `noopener` and `noreferrer` (EXPERIENCE, Snapshots).

#### Scenario: A FILE reference offline
- **WHEN** the view renders a board document with a FILE reference and no parent host
- **THEN** the reference shows its path as text with "not available in a Snapshot", and clicking it opens nothing

### Requirement: Assembling a Snapshot
The one `assemble` function SHALL build a Snapshot from Snapshot data: the charset, the view policy as a meta tag, the `askboard-data` block with every `<` escaped, the styles and scripts of the chunks the board's current document needs, then the licence notices. The same input SHALL give the same output (AD-9, AD-15, A3).

#### Scenario: The data block is found without rendering
- **WHEN** the text between `id="askboard-data">` and the next `</script>` of a Snapshot is parsed as JSON
- **THEN** it is the Snapshot data, and it validates against the `snapshot-data` schema

#### Scenario: Agent text that closes a script
- **WHEN** a question's text holds `</script><script>alert(1)</script>` and a Snapshot is assembled
- **THEN** the file holds that text only inside the data block, escaped, and opening the file runs no script but AskBoard's

### Requirement: No view-protocol code in a Snapshot
The view build SHALL mark the ext-apps chunk as needed only with a host, and the shell SHALL reach ext-apps' `App` only when it has a parent. `assemble` SHALL add host-only chunks to a board's srcdoc and leave them out of a Snapshot (AD-9).

#### Scenario: A board and its Snapshot
- **WHEN** one plain-question board is assembled as a srcdoc and as a Snapshot
- **THEN** the srcdoc holds the ext-apps chunk and the Snapshot does not, and the board still connects to its board page

### Requirement: Kept diagram renders in a Snapshot
For a component chunk that names a kept-render chunk, `assemble` SHALL inline the kept-render chunk instead when every item of that component has a kept render in the data, and both when any lacks one (AD-9, open question B3).

#### Scenario: Every diagram has its renders
- **WHEN** a fixture board with two probe diagrams, both with kept renders, is assembled as a Snapshot
- **THEN** the file holds the probe kept-render chunk and not the probe renderer chunk

#### Scenario: One diagram never rendered
- **WHEN** one of the two probe diagrams has no kept render
- **THEN** the file holds both chunks

### Requirement: Licence notices in a Snapshot
A Snapshot SHALL end with the `askboard-licences` JSON block listing, for each package whose code it inlines, its name, version, licence and notice text, with every `<` escaped (AD-15, NFR-6).

#### Scenario: The notices match the chunks
- **WHEN** a plain-question Snapshot is assembled
- **THEN** its notices are exactly those the manifest gives for the chunks it inlines, React's included, and ext-apps' are absent

### Requirement: The Snapshot control
The bottom action bar SHALL offer "Snapshot" on every board, the single-question board included, while the ask is open or closed; it SHALL be disabled while the connection is lost and absent once the ask is discarded. Its feedback SHALL show the saved file's path, or the failure with the Snapshot folder's path, or, when the session has no project root, a failure naming `CLAUDE_PROJECT_DIR`, or, for `internal-error`, that no Snapshot was taken (FR-26, AD-12).

#### Scenario: Taking a Snapshot from a single-question board
- **WHEN** the user presses "Snapshot" on the golden single-question board
- **THEN** the bar shows the saved file's path, and the file is in the Snapshot folder

#### Scenario: The connection is lost
- **WHEN** the board shows "Connection lost, retrying"
- **THEN** "Snapshot" is disabled, and no request leaves the page

### Requirement: A Snapshot not confirmed
A request whose connection drops, or whose reply has not come after `SNAPSHOT_REPLY_WAIT_MS`, SHALL end with feedback saying the Snapshot was not confirmed, never that it was saved or that none was taken, and SHALL NOT be sent again (FR-26, NFR-10).

#### Scenario: The connection drops while a Snapshot is taken
- **WHEN** the user presses "Snapshot" and the connection drops before the reply
- **THEN** the feedback says the Snapshot was not confirmed, and the request is not sent again on the new connection

### Requirement: A Snapshot from a closed board
The Closed banner SHALL offer "Snapshot", which takes the Snapshot as the bar's control does and shows its feedback beside it; the Discarded banner SHALL offer none (FR-26, EXPERIENCE Board banner).

#### Scenario: The agent closed the ask
- **WHEN** the user presses "Snapshot" on the Closed banner
- **THEN** the banner shows the saved file's path

#### Scenario: A discarded board
- **WHEN** the ask is discarded while its tab is open
- **THEN** no "Snapshot" control shows on the board or its banner

### Requirement: The unsent-work note
When the user takes a Snapshot while the board holds unsent work, the board SHALL show "Your unsent work will not be in the Snapshot" with the feedback, take the Snapshot without asking to confirm, and say in the request that unsent work existed (AD-15, open question B5).

#### Scenario: A ready answer not yet submitted
- **WHEN** the user takes a Snapshot in submitted delivery with a ready answer held
- **THEN** the note shows, the Snapshot is taken, and the opened file says the unsent work is not included and shows the question unanswered

### Requirement: Opening a Snapshot
A Snapshot opened from disk SHALL boot from its data block with no parent host and no view-protocol handshake, show the board in its final state with no network and no AskBoard running, request nothing, and raise no CSP violation, in Chromium, Firefox and WebKit (FR-27, AD-8, AD-9).

#### Scenario: Offline, AskBoard stopped
- **WHEN** a Snapshot is opened from `file://` in each engine, offline, after the session process has exited
- **THEN** the board shows, the page made no request, and no CSP violation was reported

#### Scenario: A script file beside the Snapshot
- **WHEN** a script file is placed in the Snapshot's folder and the Snapshot is opened in Firefox
- **THEN** that script never runs

### Requirement: The Snapshot view's chrome
An opened Snapshot SHALL start with the line "Snapshot · taken <when> by <whom> · read-only", noting unsent work when the data records it; it SHALL hide Answer, Postpone, More, "Ask a follow-up", Settings, the bottom action bar and the agent pill, and keep the ask state pill, delivery receipts and the quick toggles, Theme and density, each shown once (EXPERIENCE Snapshots).

#### Scenario: The agent's Snapshot
- **WHEN** the agent's Snapshot of an answered ask is opened
- **THEN** the top line says it was taken by the agent, the header shows "answered" and no agent state, and no answer control is shown

#### Scenario: One toolbar
- **WHEN** a Snapshot is opened from `file://`
- **THEN** the header shows one "Theme" group and one "Compact | Comfortable" group, in the ask's language, and no "Settings"

### Requirement: Read-only and navigable
In an opened Snapshot every item SHALL render disabled, answers and the open prompt in the read-only look of a reopened question's previous answer, postponed questions marked, threads shown without a composer; tabs, navigators, expand and collapse SHALL work, and nothing SHALL be answerable or sent (FR-27).

#### Scenario: Switching and expanding
- **WHEN** the user switches tabs and jumps to a postponed question in an opened Snapshot
- **THEN** the board follows, the question shows as postponed, and no control accepts an answer

### Requirement: Theme in a Snapshot
An opened Snapshot SHALL start in the theme its record's `presentation` names, `system` following the viewer's system theme, and in the viewer's system theme when the record names none; its Theme control SHALL switch the theme and save nothing, and the page SHALL use no browser storage (EXPERIENCE Snapshots and Dark theme, AD-8).

#### Scenario: Light on the board, dark system
- **WHEN** a Snapshot recording `theme` `light` is opened with the system set to dark
- **THEN** the board shows in light, with "Light" pressed in the Theme control

#### Scenario: System recorded
- **WHEN** a Snapshot recording `theme` `system` is opened with the system set to dark
- **THEN** the board shows in dark, with "System" pressed

#### Scenario: Dark system theme
- **WHEN** a Snapshot with no recorded presentation is opened with the system set to dark and the user switches to Light
- **THEN** the board shows in dark, then in light, no browser storage is touched, and reopening the file shows it dark again with "System" pressed

### Requirement: The board's interface in the ask's language
The view and the board page SHALL show every string of their own in the ask's language, en-US or it-IT, and SHALL set the document's `lang` to it; the agent's content SHALL show as the agent sent it (FR-34; EXPERIENCE, Localization, Voice and Tone). No control on the board SHALL change the language.

#### Scenario: An Italian ask
- **WHEN** an ask is sent with `language` `it-IT`
- **THEN** the board shows "Rispondi", "Rinvia" and "Impostazioni", and the board page's and the view's `lang` are `it`

#### Scenario: The agent's text is untouched
- **WHEN** an it-IT ask's question text is English
- **THEN** the question shows in English, inside the Italian interface

#### Scenario: No language control
- **WHEN** a user looks for a way to change the language on any board
- **THEN** there is none, and the settings panel shows the language read-only

### Requirement: Every string in both languages
Every string the view and the board page show SHALL exist in both en-US and it-IT, and a test SHALL fail when a string exists in one language only (EXPERIENCE, Open Items 4).

#### Scenario: A string added in English only
- **WHEN** a change adds a string to the en-US table and not to the it-IT one
- **THEN** the view's tests fail, naming the string's key

### Requirement: Values shown in the ask's locale
Numbers, money, percentages, dates and times SHALL show in the ask's locale, which may differ from its language; answers SHALL carry the contract's formats whatever the locale (FR-34, AD-7). Times SHALL show in the viewer's time zone.

#### Scenario: English with Italian formats
- **WHEN** an ask in `en-US` with `locale` `it-IT` holds 1234.5 in a Tree's number column
- **THEN** the board's interface is in English and the value shows as `1.234,5`

#### Scenario: The answer is locale-free
- **WHEN** the user types `1.234,5` in an it-IT board's number field and answers
- **THEN** the answer carries the JSON number 1234.5

### Requirement: Number and date entry in the ask's locale
A number field and a date field SHALL read the user's typing with the contract's entry rules for the ask's locale, echo the parsed value beside the field, and show a refusal's reason in the ask's language as a field error (EXPERIENCE, Input atoms).

#### Scenario: An Italian number
- **WHEN** the user types `1.234,5` in a number field of an it-IT board
- **THEN** the field echoes `= 1234,5` and shows no error

#### Scenario: An ambiguous Italian entry
- **WHEN** the user types `1234.5` in a number field of an it-IT board
- **THEN** the field shows "Usa i punti solo tra gruppi di tre cifre, come in 1.234,5." and the value is not taken

#### Scenario: An Italian date in the Gantt
- **WHEN** the user types `9/12/2026` as a task's start on an it-IT board
- **THEN** the field echoes `= mer 9 dic 2026` and the task starts on `2026-12-09`

### Requirement: The settings panel
Every board SHALL open a settings panel from "Settings" in the context header: a non-modal side sheet on the board page, closed with Esc or its close control, holding the presentation keys as controls, the ask's language read-only, and each behaviour key read-only with its value, file and key (FR-35; EXPERIENCE, Preferences and Settings; DESIGN, Settings panel).

#### Scenario: The panel's three groups
- **WHEN** the user presses "Settings"
- **THEN** the panel shows Theme, Density and Context placement as segmented controls, then the Language indicator, then default language, asking rules, Snapshot folder and editor under "Applies from the next session"

#### Scenario: The board stays usable
- **WHEN** the panel is open and the user answers a question
- **THEN** the answer is sent, and the panel stays open

#### Scenario: From the keyboard
- **WHEN** the user opens the panel with the keyboard, moves through a segmented control with the arrow keys and presses Esc
- **THEN** the setting changes, the panel closes, and focus returns to "Settings"

### Requirement: Presentation changes apply at once and persist
Changing theme or density from the header's quick toggles or the panel, or the context-placement default from the panel, SHALL apply to that board at once and be written as the user-level setting, so a board opened later opens with it (FR-35). No setting SHALL be kept in the browser's storage.

#### Scenario: Theme reaches a later board
- **WHEN** the user picks Dark on one board and the agent then sends a new ask
- **THEN** the new board opens dark

#### Scenario: Clearing the browser's storage
- **WHEN** the user clears the browser's storage and opens a board
- **THEN** the board opens with the settings from the configuration files

#### Scenario: A write that fails
- **WHEN** the user picks Comfortable and the user file cannot be written
- **THEN** the board turns comfortable, and the panel shows an error under Density naming the file's path

### Requirement: Keys set by the project are read-only on the board
A presentation key the project file sets SHALL show read-only in the panel with the project file and key, and its header toggle SHALL be disabled, its description naming that file and key (AD-14; EXPERIENCE, Preferences and Settings, Scopes).

#### Scenario: The project fixes the density
- **WHEN** the project file sets `density` to `comfortable`
- **THEN** the board opens comfortable, the panel's Density row is read-only with `.askboard/config.json · density`, and the header's density control is disabled

### Requirement: Theme, density and context placement
Theme SHALL be System, which follows the system's scheme and is the default, Light or Dark, on the board page and in the view. Density SHALL be Compact, the default, or Comfortable, re-pointing spacing and type. The context-placement default SHALL place each question's context, and a question's own control SHALL override it on that question (FR-13; DESIGN, Layout & Spacing).

#### Scenario: System follows the system
- **WHEN** the theme is System and the system switches to dark
- **THEN** the board page and the view turn dark

#### Scenario: Comfortable density
- **WHEN** the user picks Comfortable
- **THEN** controls are 32 px high and header rows 40 px, and Compact brings back 28 px controls and 32 px header rows

#### Scenario: Inline by default
- **WHEN** the context-placement default is `inline`
- **THEN** a question with excerpts shows them under its text, and its "Beside | Inline" control still moves that question beside

### Requirement: Snapshots in the ask's language
An opened Snapshot SHALL show its strings and values in the ask's language and locale from its board document, and its Theme control SHALL save nothing (FR-27; EXPERIENCE, Snapshots).

#### Scenario: An Italian Snapshot
- **WHEN** a Snapshot of an it-IT ask is opened from disk
- **THEN** its strings are Italian and its values use it-IT formats, and picking Dark writes no file and no browser storage

### Requirement: Derived values of every computing item in an answer
An answer that names its question's current revision SHALL carry the declared derived values of every computing item in its question, a widget item whose widget declares answer-derived fields, changed or not, as they stood when the user answered, so that the agent never recomputes them. Derived values SHALL never be an answer's only content: they go beside a choice, "Other…" text or a widget value, and an answer with nothing else SHALL be refused (FR-12, AD-10).

#### Scenario: Only the WBS edited
- **WHEN** the user re-estimates one work package in the UJ-2 question's WBS, leaves the plan untouched and presses "Answer"
- **THEN** the answer act's `values` hold `wbs__tree` alone, and its `derived` holds `schedule__plan.finish` and `schedule__plan.criticalPath` as the board showed them, beside the WBS's derived values

#### Scenario: A choice beside an untouched plan
- **WHEN** a question holding options and a Gantt plan is answered with an option alone
- **THEN** the answer act carries the option and the plan's derived values, and no `values`

### Requirement: Board documents with widget items
The board page SHALL accept a board document whose questions hold Tree and Gantt items, validate it with the standalone validators of board document 1.4, and build the view from it; a board document holding a `molecule` item SHALL still be refused (AD-9, AD-10).

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
A task whose requested duration equals its PERT expected effort rounded up SHALL have none. Dragging the end back to that length, pressing Delete on the duration cell, or the pin's "Use estimate" control in the cell SHALL clear the request; a change to the task's estimates in the Tree SHALL leave a requested duration as it is.

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

### Requirement: Component facts through the port
A component chunk SHALL register, with its component, the facts the shell needs of its type: its element shape when the user edits the agent's content, and its name in the agent-change notice. The shell SHALL hold no table by widget type, and a widget whose chunk gives no name SHALL be named by its type (AD-9).

#### Scenario: The Tree and Gantt notices as before
- **WHEN** the agent changes a Tree and a Gantt plan under unsent work and the user opens "Show the agent's change"
- **THEN** each is listed by its name, "Tree" or "Gantt", with the number of element operations, as before this change

#### Scenario: The facts agree with the registry
- **WHEN** the widget chunks' registrations are read beside the contract's registry
- **THEN** each registered widget type's chunk gives the element shape its registry entry gives, and a name

### Requirement: Widget results only fill the draft
A component SHALL put its result into the draft record through the port, apart from its edited value, and SHALL send nothing; it SHALL hold no result while the user has given none. A held result SHALL be mirrored, restored, held for Submit, kept on "Keep mine" and dropped on "Reload" as a widget's edited value is (AD-9, AD-10, AD-20).

#### Scenario: A result reported
- **WHEN** a component reports a result and then reports none
- **THEN** the question's draft record holds the result under `results`, then holds no entry for the item, and no view message leaves the view

#### Scenario: A reload keeps a held result
- **WHEN** the draft record mirrored to `board-host` holds a result and the tab reloads
- **THEN** the restored draft gives the component that result

### Requirement: Answered results shown read-only
An answered question SHALL give each widget the result its latest logged answer holds for it, read-only, after a reload or a takeover too; a widget with no logged result SHALL get none (AD-20, AD-21).

#### Scenario: A reload after an answer with a result
- **WHEN** the board state's answer to a question holds `results` for one of its items and the tab reloads
- **THEN** that item's component gets the logged result and is disabled

### Requirement: Results in the view protocol and the board page
The view protocol SHALL take `results` as an answer's content beside a choice, widget values and "Other…" text, and derived values SHALL come only beside one of them; the board page SHALL refuse to send an answer whose `results` name an item that is not a widget item of its question (AD-10, AD-20).

#### Scenario: Results alone
- **WHEN** the view sends an answer whose only content is `results`
- **THEN** the board page accepts it and sends one `act` whose answer carries those results

#### Scenario: A result for another question's item
- **WHEN** the view sends an answer whose `results` name an item of another question
- **THEN** the board page refuses it, naming the key, and sends nothing to `board-host`

#### Scenario: Derived values beside a result
- **WHEN** the view sends an answer with `results` and `derived`
- **THEN** the board page accepts it

### Requirement: Registered widget types have chunks
The view build SHALL fail when a widget type the contract's registry holds has no component chunk registering it, naming the type, or when a chunk folder under `packages/widgets/src/` registers no registered type, naming the folder. The board graph's code SHALL live in `packages/widgets/src/board-graph/`, so that no widget type's folder name is taken (AD-9).

#### Scenario: A registered type with no chunk
- **WHEN** the build runs with a registry that holds `probe` and no chunk registers `probe`
- **THEN** it fails, naming `probe`

#### Scenario: A widget chunk with no registered type
- **WHEN** the build finds `packages/widgets/src/kanban/index.tsx` and the registry holds no `kanban`
- **THEN** it fails, naming the folder

#### Scenario: Today's catalogue
- **WHEN** the view is built
- **THEN** it passes, the manifest lists the component chunks `tree` and `gantt` and the library chunk `board-graph` as before, and no folder `packages/widgets/src/graph` exists

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
Beside the decisions, the Approval SHALL list the changes the user made to the other widget items of its question, from the generic diff of each item's shown value against its props as sent: a title counting them ("2 changes"), then one line per change naming the element, by its name as the agent sent it (as shown only for an element the user added), and, for a field, its previous and new values in the ask's locale; at most 20 lines, then "and N more" (FR-11, L74, F-04).

#### Scenario: Two changed fields
- **WHEN** the user changes a Tree node's `effort` from 12 to 10 and renames another node
- **THEN** the summary is titled "2 changes" and holds two lines, each naming its node, with 12 struck through before 10

#### Scenario: A node renamed and moved
- **WHEN** the user renames a Tree node from "Build" to "Construction" and moves it to the top
- **THEN** both the move's line and the rename's line name it "Build"

#### Scenario: Nothing changed
- **WHEN** the question's other items show no change
- **THEN** the summary reads "No changes"

#### Scenario: Many changes
- **WHEN** the user has changed 25 fields
- **THEN** the summary is titled "25 changes" and shows 20 lines and "and 5 more"

### Requirement: A reason the answer requires
When an item's held result requires the open prompt, "Answer" SHALL stay enabled; pressed with the prompt empty or white space only, it SHALL send and mark nothing, show the field error "Add the reason for your changes." under the prompt and move focus there. The error SHALL clear once the prompt holds a reason or no held result requires it, and SHALL NOT return when the text is then deleted until a press asks for the reason again (FR-11, L198, AD-10).

#### Scenario: Approve with changes and an empty reason
- **WHEN** the user selects "Approve with changes" and presses "Answer" with the open prompt empty
- **THEN** nothing is sent, the field error shows under the prompt, focus is in the prompt, and the question stays open

#### Scenario: Writing the reason
- **WHEN** the user then writes a reason and presses "Answer"
- **THEN** the error is gone and one answer is sent, carrying the decision and the reason as its note

#### Scenario: Submitted delivery
- **WHEN** the board is in submitted delivery and the user presses "Answer" with "Approve with changes" selected and no reason
- **THEN** the answer is not marked ready and the field error shows

#### Scenario: Deleting the reason
- **WHEN** the field error shows, the user writes a reason, then deletes it
- **THEN** the error is gone once the reason is written and does not return until "Answer" is pressed again

### Requirement: Every path to an answer checks the reason
"Accept recommended" SHALL run the reason check of "Answer" after selecting the recommended option. In submitted delivery, "Select recommended" SHALL NOT mark ready a question whose held result requires a reason its note lacks, and Submit SHALL send nothing while a held answer lacks a reason its held result requires, moving focus to that question's prompt with the error (FR-11, L186, AD-10).

#### Scenario: Accept recommended without the reason
- **WHEN** a question holds options with a recommended one and an Approval with "Approve with changes" selected, the prompt is empty, and the user presses "Accept recommended"
- **THEN** the recommended option is selected, nothing is sent or marked ready, and the field error shows with focus in the prompt

#### Scenario: Select recommended without the reason
- **WHEN** the board is in submitted delivery, the same question has no option chosen, and the user presses "Select recommended"
- **THEN** the recommended option is selected and the question is not marked ready

#### Scenario: Submit with a held answer missing its reason
- **WHEN** Submit is pressed while a held answer's question holds "Approve with changes" and a note with no reason
- **THEN** no command is sent, every held act stays held, and focus moves to that question's prompt with the field error

### Requirement: Revising a received verdict asks first
On a question holding an item whose chunk asks for it, such as an Approval, whose latest answer the agent has received, "Answer", "Accept recommended" and "Decline" SHALL first ask the user to confirm, in a modal dialog; confirming SHALL act as the button does, and cancelling, by "Cancel" or Escape, SHALL send nothing, keep the draft and return focus to the control pressed (the question's "More" menu button for Decline) (F-63, FR-22, NFR-12).

#### Scenario: A delivered verdict revised
- **WHEN** the agent has collected "approve" and the user selects "Reject" and presses "Answer"
- **THEN** the confirmation opens and nothing is sent; "Cancel" closes it with "Reject" still selected and focus on "Answer", and confirming sends the revision, which names the answer it replaces

#### Scenario: Escape
- **WHEN** the confirmation opened from "Answer" and the user presses Escape
- **THEN** it closes, nothing is sent, the draft is as it was and focus is on "Answer"

#### Scenario: Accept recommended on a delivered verdict
- **WHEN** a question holding options with a recommended one and an Approval has a delivered answer, and the user presses "Accept recommended"
- **THEN** the recommended option is selected and the confirmation opens with nothing sent; "Cancel" keeps the selection and returns focus to "Accept recommended"

#### Scenario: Not yet delivered
- **WHEN** the latest answer's receipt reads "sent" and the user revises it
- **THEN** "Answer" sends the revision with no confirmation

### Requirement: Submit asks before replacing a received verdict
In submitted delivery, each press SHALL ask as in immediate delivery, and Submit SHALL ask once more when, at its press, a held answer or decline would replace a latest answer the agent has received on a question holding an item whose chunk asks for it, naming those questions; cancelling SHALL send nothing, keep every act held and return focus to Submit (F-63, FR-22, NFR-12).

#### Scenario: Delivered between the mark and Submit
- **WHEN** in submitted delivery the user marks a revision ready while the latest answer's receipt reads "sent", the receipt turns "delivered", and the user presses Submit
- **THEN** a confirmation naming the question opens and nothing is sent; "Cancel" keeps the revision held with focus on Submit, and confirming sends the command

### Requirement: A revision keeps the widgets' results
The first edit of an answered question SHALL put its latest answer's results into the draft for the items its current revision holds, as it puts the answer's choice and note, so that the revised answer carries them unless the user changes them (AD-20, FR-22).

#### Scenario: Revising a Tree beside an Approval
- **WHEN** a question answered "reject" with an Approval and a Tree is revised by renaming a Tree node, and "Answer" is pressed
- **THEN** the revision carries the Tree's change and `{decision: "reject"}` for the Approval

#### Scenario: Starting from a previous answer
- **WHEN** the user presses "Start from my previous answer" on a reopened question whose previous answer held a Scale's value
- **THEN** the draft holds that value for the Scale

### Requirement: A draft holds only results its items accept
The draft SHALL never hold a result that its item's type refuses against the item's current props: a result put back from an earlier answer, or kept in a draft that the card shows against the item's current props, that the type's check refuses is dropped, and the item shows as untouched. Work the card still shows on the revision it was made on is kept, and its answer names that revision (AD-10, AD-20).

#### Scenario: A previous result the revision no longer accepts
- **WHEN** the agent reopens an answered question and adds an element to its Ranking and turns its Scale into a range, and the user presses "Start from my previous answer"
- **THEN** the draft holds no result for the Ranking or the Scale, both show as untouched, the Approval's decision is put back, and "Answer" sends nothing the board host refuses

#### Scenario: Keeping a draft the current props refuse
- **WHEN** the card shows a Scale's current props, after the agent lowered its `max` below the value the draft holds, and the user keeps their draft
- **THEN** the draft holds no result for the Scale, which shows as unset

#### Scenario: Keeping work made on the earlier revision
- **WHEN** the card still shows the revision on which the user set a Scale's value, and the user keeps their draft across the agent's change of that Scale
- **THEN** the value is kept and the answer names the revision it was made on

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
The Approval, Scale and Ranking of a question that cannot be answered (ask closed, board locked, answer in flight) or of an opened Snapshot SHALL show their logged result disabled: the decision with the summary, the value or rating, the order with moved rows marked (AD-15, AD-20). While the ask is open, an answered question's widgets SHALL show its result and stay editable (EXPERIENCE, Revisions).

#### Scenario: An answered question while the ask is open
- **WHEN** a question holding a Scale is answered at 100 and its receipt reads delivered
- **THEN** the Scale shows 100 and is enabled, and setting another value starts a revision

#### Scenario: The ask closed
- **WHEN** the agent closes the ask after the question was answered
- **THEN** each widget shows its logged result disabled, and nothing can be selected, moved or set

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
A result a component reports that is not JSON within the depth bound, one that holds itself included, SHALL go to the item's error path and be held nowhere; the board SHALL keep working. `undefined`, a component's report that it holds no result, SHALL clear the held result and is no error (AD-9, AD-10).

#### Scenario: A result that holds itself
- **WHEN** a component reports an object whose field holds the object itself
- **THEN** the call returns, the item shows its error state, the draft holds no result for it, and the other items still answer

#### Scenario: Clearing a result
- **WHEN** a component that held a result reports `undefined`, as an Approval does when its decision is pressed again
- **THEN** the draft holds no result for it and the item shows no error

### Requirement: A widget result end to end
A result given on the board SHALL reach the agent through `collect` and push delivery in the answer event's `results`, be returned by `fetch`, be kept in the draft mirror across a reload and be shown in a Snapshot, on the session process (FR-18, FR-20, AD-20).

#### Scenario: Collected and pushed
- **WHEN** the user answers a question with "Approve with changes", a reason and a Tree edit on the real board
- **THEN** `collect`, and the mod where it runs, deliver one answer event with `results`, the note and the Tree's `changes`

#### Scenario: Held across a reload
- **WHEN** the user sets a Scale's value without answering and reloads the tab
- **THEN** the Scale shows that value and the leave-page prompt is armed

### Requirement: The three widgets' strings
Every string the Approval, the Scale and the Ranking show SHALL come from the view's string tables in en-US and it-IT, and an Italian board SHALL show them in Italian (FR-34, EXPERIENCE Voice and Tone). The Approval summary SHALL format the values it lists in the ask's locale, and a switched value, when a widget gives one, SHALL read "on" and "off", "attivo" and "disattivo" in it-IT.

#### Scenario: An Italian board
- **WHEN** a board in it-IT holds the three widgets
- **THEN** it shows "Approvazione", "Approva con modifiche", "Mantieni quest'ordine" and "Sposta su", and no English chrome

#### Scenario: A changed number in Italian
- **WHEN** on an it-IT board the user changes a Tree node's `effort` from 1234.5 to 10 beside an Approval
- **THEN** the summary's line reads "1.234,5" struck through before "10"

### Requirement: LaTeX source and preview
A LaTeX item SHALL show a source field in the code type holding its expression, the item's value else the props as sent, with a live preview of it in display mode under the field. An edit SHALL put the whole edited props into the draft, and an edit back to the agent's expression SHALL clear the item's draft value. While the expression differs from the agent's, the field SHALL take the change highlight (FR-11, AD-9, AD-20).

#### Scenario: Typing an expression
- **WHEN** the user types `=c^2` after `a^2+b^2` in the source field
- **THEN** the preview shows the new equation and the draft holds `{expression: "a^2+b^2=c^2"}` for the item

#### Scenario: Back to the agent's expression
- **WHEN** the user deletes what they typed, so the field holds the agent's expression again
- **THEN** the draft holds no value for the item and the field shows no change highlight

#### Scenario: An empty expression from the agent
- **WHEN** the agent sends an empty expression
- **THEN** the field is empty, the preview shows nothing, and the item counts as ready

### Requirement: LaTeX source limit
The LaTeX source field SHALL hold at most 2,000 characters, counted in code points as the contract counts them, so the board never offers an expression the contract refuses (FR-11, AD-10).

#### Scenario: A paste over the limit
- **WHEN** the user pastes text that would make the expression 2,001 characters, each outside the Basic Multilingual Plane
- **THEN** the field keeps the first 2,000 and the draft holds them

### Requirement: LaTeX parse errors
While the expression does not parse, the board SHALL show KaTeX's message under the source field as a field error, as text with its bidirectional controls shown as visible escapes, and keep the last preview that rendered; an expression that never rendered SHALL leave the preview empty. A parse error SHALL NOT block "Answer": the answer carries the expression as written (FR-11, EXPERIENCE Answer).

#### Scenario: An unclosed brace
- **WHEN** the user types `\frac{1}{` in the source field
- **THEN** the field error gives KaTeX's message, the preview still shows the last expression that rendered, and "Answer" stays enabled

#### Scenario: The agent's expression does not parse
- **WHEN** the agent sends `\frac{1}{`
- **THEN** the field error shows, the preview is empty, and the item counts as ready

#### Scenario: A failure with no message
- **WHEN** rendering fails with a thrown value that carries no message
- **THEN** the field error shows the string tables' fixed text, "The expression could not be drawn." in en-US, and the last preview stays

### Requirement: LaTeX untrusted commands
The LaTeX preview SHALL render agent and user text as data: no command SHALL make a link, an image, a class, an ID, a style attribute or a request, a macro defined in one render SHALL NOT exist in the next, and macro expansion SHALL be bounded (AD-8, NFR-5, NFR-9).

#### Scenario: A link and an image
- **WHEN** the expression holds `\href{https://example.com}{x}` and `\includegraphics{https://example.com/a.png}`
- **THEN** the preview holds no link and no image, and the board makes no request

#### Scenario: A macro does not outlive its render
- **WHEN** the user types `\gdef\foo{1}` in one LaTeX item and `\foo` in another
- **THEN** the first shows the field error naming `\gdef` and renders nothing new, and the second shows a parse error naming `\foo`

### Requirement: LaTeX bounded work
An expression the contract's LaTeX check refuses SHALL NOT render: one holding a macro definition or a KaTeX internal command SHALL show a field error naming the command, and one nested past the limit a field error naming its depth and the limit, the preview keeping its last render. Every expression of at most 2,000 code points SHALL render or show a field error within 2 seconds in Chromium and WebKit, the board responding (AD-8, NFR-5).

#### Scenario: A macro definition
- **WHEN** the user types `\def\a{\a}\a`, or `\def\b{` and 900 `x` then `}\def\a{` and `\b` 540 times then `}\a`
- **THEN** the field error names `\def` within 2 seconds, KaTeX does not run, the preview keeps its last render, and the board keeps responding

#### Scenario: An internal command
- **WHEN** the user types `\color{` and 900 `x` then `}` and `\current@color` 78 times
- **THEN** the field error names `\current@color` within 2 seconds, KaTeX does not run, and the preview keeps its last render

#### Scenario: Nests at and past the limit
- **WHEN** the expression nests `\frac` or `\dfrac` numerators, `{` with `\over x}`, `x^{`, `\sqrt{` or `\boxed{` to the nesting limit, alone or repeated side by side to 2,000 code points, then one level past the limit
- **THEN** at the limit the preview renders within 2 seconds in Chromium and WebKit with the board responding, and past it the field error names the depth and the limit, KaTeX does not run, and the preview keeps its last render

#### Scenario: Nests the scan once missed
- **WHEN** the user types `\frac{` with `\over y}{x}` nested 11 times, or ``\char` {`` 130 times, then `x`, then `\over}` 130 times
- **THEN** within 2 seconds the field error names the depth and the limit for the first and the command ``\char` `` for the second, KaTeX does not run, and Chromium's renderer does not crash

#### Scenario: Stacked combining marks typed
- **WHEN** the user types `x` followed by 130 combining circumflex accents (U+0302)
- **THEN** the field error names the depth and the limit, KaTeX does not run, the preview keeps its last render or stays empty, and Chromium's renderer does not crash

#### Scenario: Stacked combining marks sent
- **WHEN** the agent sends `x` followed by 130 combining circumflex accents (U+0302) in an `ask` or an `update`
- **THEN** the request is refused, naming the item, and nothing reaches the board

### Requirement: LaTeX previews one at a time
A board SHALL draw its LaTeX previews one per task, in the order they are asked for, an item's newest expression replacing its pending draw and a draw asked for after the user's edit going before draws still pending, so that the board answers input between draws (AD-8, NFR-5).

#### Scenario: Ten LaTeX items
- **WHEN** a question holds ten LaTeX items, each the slowest expression the measurement found within the scan's limit (`\cfrac` or `\dfrac` side by side at the limit), and the user types in the last item's field while the previews draw
- **THEN** every preview draws, each key press is answered within 2 seconds, and the last item's preview or field error shows within 2 seconds of the input, in Chromium and WebKit

### Requirement: Package stylesheets in a chunk
A component chunk MAY carry a package's stylesheet. The build SHALL inline its woff2 fonts as `data:` URLs, drop its other font formats, and list the stylesheet's package among the chunk's licence notices (AD-8, AD-9, NFR-6).

#### Scenario: KaTeX's fonts
- **WHEN** a board holding a LaTeX item opens in Chromium or WebKit
- **THEN** the preview uses KaTeX's fonts, no font is requested, and no CSP violation is logged

#### Scenario: A stylesheet from a package the script does not import
- **WHEN** a chunk lists a package's stylesheet and its script imports nothing from that package
- **THEN** the chunk's licence notices hold that package's notice

### Requirement: No URL in a chunk's styles
The build SHALL parse every chunk's styles and the board page's as CSS, and SHALL fail on styles it cannot parse, on an `@import`, on any URL other than a woff2 `data:` URL in the source of a `@font-face` rule, URLs in `image-set()` and escaped forms included, and on any substitution that could put one there, so that no chunk loads a file from anywhere (AD-8, NFR-9).

#### Scenario: Substitutions that could request a file
- **WHEN** a chunk's styles hold a `var()`, an `env()` or a custom function (`--name()`) inside `image-set()`, `-webkit-image-set()` or a cursor list, or an `@function` rule anywhere
- **THEN** the build fails naming the chunk

#### Scenario: A stylesheet that names a file
- **WHEN** a chunk's package stylesheet holds `url(fonts/a.svg)` or `@import "b.css"`
- **THEN** the build fails, naming the chunk and the URL or the import

#### Scenario: Escaped and string URLs
- **WHEN** a chunk's styles hold `u\72l(http://h/x.png)`, `\75rl(http://h/x.png)`, `@\69mport "http://h/b.css"` or `image-set("http://h/x.png" 1x)`
- **THEN** the build fails, naming the chunk

#### Scenario: A function whose name ends in url
- **WHEN** a chunk's styles hold `#a{--v:xurl(data:a ")")}#b{background-image:image-set("http://h/x.png" 1x)}`
- **THEN** the build fails, naming the chunk and `http://h/x.png`

#### Scenario: A value substituted into image-set
- **WHEN** a chunk's styles hold `#a{--a:"http://h/var.png";background-image:image-set(var(--a) 1x)}`, the same with `-webkit-image-set`, or `a{cursor:image-set(env(x) 1x),auto}`
- **THEN** the build fails, naming the chunk

#### Scenario: A data URL outside a font face
- **WHEN** a chunk's styles hold `a{background:url(data:image/png;base64,AAAA)}`
- **THEN** the build fails, naming the chunk

#### Scenario: Styles that do not parse
- **WHEN** a chunk's styles hold `a{background:url(http://h/x y.png)}`
- **THEN** the build fails, naming the chunk and the parser's message

#### Scenario: A chunk's own styles and the board page's
- **WHEN** a chunk's own styles, or the board page's, hold `url(x.png)`
- **THEN** the build fails, naming the chunk or the board page

### Requirement: Font licences in a chunk's notices
Fonts a chunk inlines SHALL be the package's font files unmodified, and the chunk's licence notices SHALL carry the fonts' own licence text when it differs from the package's, with the fonts' copyright and Reserved Font Name lines, wherever the chunk carries those fonts or package code holding glyph outlines derived from them. The build SHALL fail when a chunk inlines fonts whose licence is not recorded (NFR-6, AD-19, PRD addendum, Adoption rule, as amended by this change).

#### Scenario: KaTeX's font licence
- **WHEN** the view is built with a chunk carrying KaTeX's stylesheet
- **THEN** that chunk's notice for `katex` names `MIT AND OFL-1.1` and its text holds KaTeX's MIT licence, the fonts' copyright lines, their Reserved Font Names and the full SIL Open Font License 1.1, and every inlined font decodes to the bytes of its woff2 file in the package

#### Scenario: Fonts with no recorded licence
- **WHEN** a chunk inlines the fonts of a package version that has no font licence entry, or an entry names a package version whose fonts and derived files no chunk carries
- **THEN** the build fails, naming the package version

#### Scenario: KaTeX's script without its stylesheet
- **WHEN** a chunk bundles KaTeX's script, whose glyph outlines derive from KaTeX's fonts, and lists no KaTeX stylesheet
- **THEN** that chunk's notice for `katex` names `MIT AND OFL-1.1` and holds the same text as with the stylesheet

### Requirement: An answer sends what its widgets show
A Kanban's or a Timeline's value in the draft SHALL be one the item can show on the revision the card shows, so that the answer sends what the item shows. "Keep mine" SHALL drop such a value when the card shows a revision other than the one the work was made on, or one that cannot show it; the item then shows the agent's props as untouched. The user's moves SHALL be counted against the revision they were made on, never counting the agent's own changes (AD-10, AD-20, NFR-10).

#### Scenario: Keeping a Kanban move across a reload and an agent's change
- **WHEN** the user moves card `a` to Doing, the agent changes the Kanban, the tab reloads, the user keeps their draft and presses "Answer"
- **THEN** the Kanban shows "No changes" and the answer sends nothing for it, since the page no longer holds the revision the move was made on; without a reload, the move is kept and sent

#### Scenario: The agent's own move is not the user's
- **WHEN** the agent moves card `b` to Doing while the user's draft holds a move of card `a`, on a page that saw both revisions, and the user keeps their draft
- **THEN** the Kanban counts only the user's move of `a`, `b` is not marked as the user's, and the answer sends the move of `a`

### Requirement: Kanban columns and cards
A Kanban SHALL show its columns side by side in the agent's order, each headed by its label and its number of cards, with each card under the column its value names, in the agent's order of `cards`, showing its label and its description (FR-11, DESIGN Kanban).

#### Scenario: Three columns
- **WHEN** a Kanban with the columns `todo`, `doing` and `done` and the cards `a` and `c` in `todo` and `b` in `done` is shown
- **THEN** `todo` reads 2 and lists `a` then `c`, `doing` reads 0, and `done` reads 1 and lists `b`

### Requirement: Kanban moves by drag
A card SHALL move by drag onto another column, which shows the drop indicator while the card is over it; Escape SHALL cancel, and a drop from another widget SHALL be refused. A move SHALL put the whole edited props into the draft, a card moved back to its sent column leaving no change for it; moved cards SHALL take the change highlight. The drag library SHALL come from the shared drag chunk (FR-11, AD-9, AD-10).

#### Scenario: A drag to another column
- **WHEN** the user drags the card `a` from `todo` onto `doing` in Chromium or WebKit
- **THEN** `a` shows in `doing` with the change highlight, and the draft holds the props with `a`'s column `doing`

#### Scenario: Moved back
- **WHEN** the user then drags `a` back onto `todo`
- **THEN** the draft holds no value for the item and no card shows the change highlight

#### Scenario: A board with a Kanban only
- **WHEN** a board whose only widget is a Kanban is assembled
- **THEN** it inlines the Kanban's chunk and the drag library's chunk, and no Tree or Ranking chunk

### Requirement: Kanban at the keyboard
A Kanban's cards SHALL be one Tab stop whose arrow keys move the current card, Up and Down within its column, Left and Right to the nearest card of the next column that holds one. Its toolbar, "Move to…" and the counter, SHALL be another; "Move to…" SHALL open a menu of the other columns that moves the current card, which stays current. The counter SHALL read "No changes" or "Your changes: N moved" (FR-11, NFR-12, EXPERIENCE Accessibility Floor).

#### Scenario: Move to a column from the keyboard
- **WHEN** the user makes `c` current with the arrow keys, opens "Move to…" from the keyboard and chooses `done`
- **THEN** `c` shows in `done` and is still the current card, and the counter reads "Your changes: 1 moved"

#### Scenario: No current card
- **WHEN** no card is current
- **THEN** "Move to…" is disabled and keeps the focus if it had it

### Requirement: Timeline layout
A Timeline SHALL show its lanes as rows, labelled at the left, under the Gantt's time axis, at the finest of day, week and month zoom at which its span fits the frame. Ranges SHALL be bars and milestones diamonds, each on the first track of its lane where it overlaps nothing, its label after it or inside a range that fits it, and whole in its accessible name (FR-11, DESIGN Timeline).

#### Scenario: Two overlapping ranges
- **WHEN** two ranges in one lane overlap in time
- **THEN** they show on two tracks of that lane, and a third that overlaps neither shares the first track

#### Scenario: A span of a year
- **WHEN** a Timeline's entries span 2026-01-05 to 2026-12-18 in a frame 900 pixels wide
- **THEN** it opens at month zoom

#### Scenario: A milestone on the first day
- **WHEN** a Timeline's earliest date is a milestone's, at month zoom
- **THEN** its diamond draws whole, inside the chart's left edge

### Requirement: Timeline moves by drag
An entry SHALL move by pointer drag, with no drag library. The horizontal travel SHALL snap to whole days, a range keeping its length and every date staying within the contract's days; the lane under the pointer at the drop SHALL be its lane. Escape SHALL cancel, and nothing SHALL reach the draft before the drop. Moved entries SHALL take the change outline; an entry moved back leaves no change (FR-11, AD-9, AD-10).

#### Scenario: A range dragged a week later and down a lane
- **WHEN** the user drags the range `checkout`, 2026-01-05 to 2026-01-09 in `web`, seven days to the right and onto `mobile`, in Chromium or WebKit
- **THEN** it shows from 2026-01-12 to 2026-01-16 in `mobile` with the change outline, and the draft holds those dates and that lane

#### Scenario: Escape
- **WHEN** the user presses Escape during a drag
- **THEN** the entry is back where it was and the draft is unchanged

### Requirement: Timeline at the keyboard
A Timeline's entries SHALL be one Tab stop whose Up and Down keys move the current entry, lane by lane and by date, and Home and End to the first and last. Its toolbar SHALL be another: "Move earlier" and "Move later", by one day at day zoom and seven days at week and month zoom, "Move to lane…", a menu of the other lanes, and the counter; a move SHALL keep the entry current, and a tool that cannot act SHALL be disabled without losing focus (FR-11, NFR-12, EXPERIENCE Accessibility Floor).

#### Scenario: A milestone a week later
- **WHEN** the user makes the milestone `launch` current on a Timeline at week zoom and presses "Move later" from the keyboard
- **THEN** its date is seven days later, it is still current, and the counter reads "Your changes: 1 moved"

#### Scenario: One lane
- **WHEN** a Timeline has a single lane
- **THEN** "Move to lane…" is disabled

### Requirement: LaTeX, Kanban and Timeline read-only
An answered question's, a locked question's and an opened Snapshot's LaTeX, Kanban and Timeline SHALL show the shown value disabled: the expression read-only with its preview, the cards in their columns, the entries in place, each with its change highlight, and nothing SHALL be editable or movable (AD-15, AD-20).

#### Scenario: A Snapshot of an answered board
- **WHEN** a Snapshot is opened of a board answered with an edited expression, a moved card and a moved range
- **THEN** each widget shows the answer's value read-only, with KaTeX's fonts inline, and nothing can be typed, dragged or moved

### Requirement: The Approval summary of a whole-field change
The Approval summary SHALL word a change to a whole field of an item, such as a LaTeX expression, as one line naming the item's widget and the field, with the previous and new values (FR-11, F-04).

#### Scenario: A LaTeX item beside an Approval
- **WHEN** the user edits the expression of a LaTeX item in a question that holds an Approval
- **THEN** the summary is titled "1 change" and its line names the LaTeX item's `expression`, the agent's expression struck through before the new one

### Requirement: The Gantt on the shared time axis
The Gantt's dates, time scale, axis and pointer drag SHALL be the widgets' shared code that the Timeline uses too, and the Gantt SHALL behave as before (FR-11, AD-9).

#### Scenario: The Gantt's scenarios
- **WHEN** the Gantt's unit tests and its drag and axis browser scenarios run in Chromium and WebKit
- **THEN** they pass with the counts they had before the move

### Requirement: LaTeX, Kanban and Timeline strings
Every string the LaTeX, the Kanban and the Timeline show SHALL come from the view's string tables in en-US and it-IT, and an Italian board SHALL show them in Italian, dates in the ask's locale (FR-34, EXPERIENCE Voice and Tone).

#### Scenario: An Italian board
- **WHEN** a board in it-IT holds the three widgets
- **THEN** it shows "Sorgente LaTeX", "Sposta in…", "Sposta dopo" and "Sposta nella corsia…", and no English chrome

### Requirement: LaTeX, Kanban and Timeline end to end
An edit of a LaTeX, Kanban or Timeline item SHALL reach the agent through `collect` and push delivery as the answer event's `changes`, be returned whole by `fetch`, and be kept in the draft mirror across a reload, on the session process (FR-18, FR-20, AD-20).

#### Scenario: Collected and pushed
- **WHEN** the user answers a question holding an edited expression, a moved card and a moved range on the real board
- **THEN** `collect`, and the mod where it runs, deliver one answer event whose `changes` hold the three items' `set`s

#### Scenario: Held across a reload
- **WHEN** the user moves a card without answering and reloads the tab
- **THEN** the card shows in its new column and the leave-page prompt is armed

### Requirement: Chart drawing
A Chart SHALL be drawn on a canvas as its `kind` says: bars grouped by category, lines with a marker at each number and a gap at each `null`, or a pie of one series. Bar and line charts SHALL have one value axis starting at zero and a category axis, with their axis labels when sent. `title` SHALL show as text above the chart (FR-11; DESIGN Components, Chart).

#### Scenario: Two series of bars
- **WHEN** a bar chart of three categories and two series is shown
- **THEN** each category holds two bars, in `chart-1` and `chart-2`, and a legend names the two series

#### Scenario: A gap in a line
- **WHEN** a line chart's series holds `[3, null, 5]`
- **THEN** the line breaks at the second category and no marker is drawn there

### Requirement: Chart colours and legend
A Chart's series, and a pie's slices, SHALL take the palette's colours in order, the first `chart-1`, never cycled; a bar or line chart of two or more series SHALL show a legend that hides no series when clicked; a pie SHALL label each slice with its category (FR-11; DESIGN Colors, Components, Chart).

#### Scenario: A pie of three slices
- **WHEN** a pie of three categories is shown
- **THEN** its slices take `chart-1`, `chart-2` and `chart-3`, each labelled with its category, and no legend is shown

#### Scenario: A legend clicked
- **WHEN** the user clicks a series' name in the legend
- **THEN** every series stays drawn

### Requirement: Chart tooltips
A Chart's tooltip SHALL be drawn on the canvas, on `{colors.popover}`, naming the category, the series and the value; numbers on the axis and in tooltips SHALL show in the ask's locale with the `unit` (FR-11, FR-34, AD-8; renderer spike).

#### Scenario: A tooltip in Italian
- **WHEN** the pointer rests on a bar of value 1234.5 with `unit` "€" on an it-IT board
- **THEN** the tooltip, drawn on the canvas, reads the category, the series and "1.234,5 €"

### Requirement: Charts request nothing
Drawing a Chart, hovering, highlighting, switching the theme and resizing SHALL request nothing over the network, use no browser storage and cause no CSP violation (NFR-9, AD-8, AD-11).

#### Scenario: No violation
- **WHEN** a board holding a bar, a line and a pie chart is hovered, highlighted, switched to dark and resized in each engine
- **THEN** no CSP violation is reported and no request leaves the page

### Requirement: Agent text on a chart
A Chart SHALL draw every label, series name, axis label and unit as the agent sent it, as text: control and bidirectional characters SHALL show as visible escapes, as the board's other agent text does, and no agent text SHALL be read as the chart library's markup or template, on the canvas or in a tooltip (NFR-5, AD-8).

#### Scenario: Markup in a label
- **WHEN** a category's label is `{b|Fix} {c}` and its tooltip is shown
- **THEN** the tooltip reads `{b|Fix} {c}` as written, with no style applied and nothing substituted

#### Scenario: A bidirectional control
- **WHEN** a series label holds U+202E
- **THEN** the legend and the tooltip show `\u202E` in its place

### Requirement: Highlighting data points
A click on a point (a bar, a line's marker or a pie slice) of a Chart that takes highlights SHALL highlight it, and a click on a highlighted point SHALL clear it; with `highlights: "one"`, highlighting a point SHALL clear the other. A point with no value SHALL not be highlighted. A highlighted point SHALL take a 2px `{colors.change}` ring, and the counter SHALL say how many are highlighted (FR-11, AD-10; DESIGN Components, Chart).

#### Scenario: Two points
- **WHEN** the user clicks the bar of `fails` in `a`, then the bar of `fails` in `b`
- **THEN** both take the ring and the counter reads "2 points highlighted"

#### Scenario: One point
- **WHEN** the user highlights a point, then another, on a Chart with `highlights: "one"`
- **THEN** only the second is highlighted

### Requirement: A Chart's highlights as its result
A Chart SHALL hold its highlighted points as its result through the port, in the series' then the categories' order, and no result while none is highlighted; a held highlight SHALL follow the draft rules of every result (AD-9, AD-10, AD-20).

#### Scenario: Highlighted in any order
- **WHEN** the user highlights the bar of `fails` in `b`, then the one in `a`
- **THEN** the draft holds `{points: [{series: "fails", category: "a"}, {series: "fails", category: "b"}]}` for the item

#### Scenario: Cleared
- **WHEN** the user clicks the only highlighted point again
- **THEN** the counter reads "No points highlighted", the draft holds no result for the item, and "Answer" is disabled if nothing else answers the question

#### Scenario: Removed by the agent
- **WHEN** the user has highlighted a point in `q4` and the agent's change removes `q4`, and the user keeps their work
- **THEN** the draft drops that point's result, as for any result the item's current props refuse

### Requirement: A Chart at the keyboard
A Chart SHALL be one Tab stop. On focus it SHALL make its first point holding a number current, show that point's tooltip and take the focus ring; Left and Right SHALL move to the previous and next category holding a number in the current series, Up and Down to the previous and next series holding a number in the current category, Home and End to the first and last point; Space or Enter SHALL highlight or clear the current point as a click does (NFR-12; EXPERIENCE Accessibility Floor).

#### Scenario: Highlighting from the keyboard
- **WHEN** the user tabs to a bar chart, presses Right, then Space
- **THEN** the second category's point of the first series is highlighted

#### Scenario: A gap skipped
- **WHEN** the current point is before a `null` and the user presses Right
- **THEN** the current point is the next one holding a number

### Requirement: A Chart's points read aloud
Each move of a Chart's current point and each highlight or clear SHALL be announced through a polite live region: the category, the series, the value in the ask's locale with the `unit`, and "highlighted" when the point is (NFR-12; EXPERIENCE Accessibility Floor).

#### Scenario: A highlighted point read
- **WHEN** the user presses Space on the point of `Failures` in `Fix B`, of value 9 with `unit` "runs"
- **THEN** the live region reads "Fix B, Failures: 9 runs, highlighted"

### Requirement: Charts to read and read-only charts
A Chart with `highlights: "none"`, and a Chart that is disabled (its question cannot be answered, or the board is a Snapshot), SHALL highlight nothing on a click or a key and show no counter control; tooltips and the keyboard reading SHALL still work, with the default cursor. A disabled Chart SHALL show the highlights its question's latest answer holds (FR-11, AD-20; EXPERIENCE Hover and focus feedback).

#### Scenario: A Snapshot
- **WHEN** a Snapshot of a board whose Chart was answered with two points is opened from `file://`
- **THEN** the chart is drawn with the two rings, clicks and keys change nothing, and no CSP violation is reported

#### Scenario: A chart to read
- **WHEN** the user clicks a bar of a Chart with `highlights: "none"`
- **THEN** nothing is highlighted and the draft holds no result for the item

### Requirement: A Chart follows the theme
The catalog port SHALL tell a component the theme in effect, light or dark, and re-render it when the theme switches. A Chart SHALL build its colours, fonts and lines from DESIGN's tokens as resolved in that theme, and redraw with them on a switch, keeping its highlights, on the board and in a Snapshot (DESIGN Dark theme mechanism, EXPERIENCE Dark theme).

#### Scenario: Switching to dark
- **WHEN** a board holding a highlighted Chart switches from Light to Dark
- **THEN** the chart is redrawn with the dark tokens, `chart-1` resolved in dark among them, and the highlight stays

### Requirement: The Chart's chunk
The Chart SHALL be one component chunk, `chart`, holding the chart library's canvas renderer and only the chart and component modules the Chart uses; a board holding no Chart SHALL load none of it. The chunk's licence notices SHALL hold the chart library's licence and NOTICE texts and those of the packages it bundles (AD-9, AD-19).

#### Scenario: A board without a Chart
- **WHEN** a board holding only a Scale is assembled
- **THEN** it inlines no `chart` chunk

#### Scenario: The notices
- **WHEN** the view is built
- **THEN** the `chart` chunk's notices name `echarts` under Apache-2.0 with its NOTICE text and the d3 BSD-3-Clause text its time scale embeds, `zrender` under BSD-3-Clause and `tslib` under 0BSD

### Requirement: The Chart's strings
The Chart's own words (the counter, the live region's "highlighted", the keyboard hint, the chart's role description and its name in the agent-change notice) SHALL show in the ask's language, en-US or it-IT (FR-34).

#### Scenario: An Italian chart
- **WHEN** an it-IT board holds a Chart with one point highlighted
- **THEN** the counter reads "1 punto evidenziato" and no English word of the board's own shows on the item

### Requirement: A Chart's result end to end
A Chart's highlighted points SHALL travel in the answer's `results` by item ID to the agent, by `collect` and by the mod's push, and `fetch` of the item SHALL return them as its `result` (FR-18, FR-20, AD-20).

#### Scenario: Answered and collected
- **WHEN** the user highlights two points and answers, and the agent collects
- **THEN** the answer event holds the item's `{points}` under `results`, and it validates against the output format

### Requirement: LaTeX preview within its box
The LaTeX preview SHALL stay within 400 px high, scrolling inside, whatever KaTeX draws, so the controls under it stay where they are (DESIGN Components: LaTeX; AD-8).

#### Scenario: A preview that would grow past its box
- **WHEN** a LaTeX item's expression is `\raisebox{-1000000em}{X}`, sent by the agent or typed by the user
- **THEN** the preview stays within 400 px high, scrolling inside, and the controls under it stay where they are on a board whose expression is at KaTeX's largest size

### Requirement: Markdown rendered as data
A Text marked `markdown`, and an option preview marked `markdown`, SHALL render through the view's Markdown renderer only. Raw HTML in the source SHALL show as text, and the output SHALL hold only paragraphs, line breaks, emphasis, strong, strikethrough, inline code, code blocks, block quotes, lists, headings, rules, tables and links, with no attribute but a link's `href`, a list's `start` and the alignment classes. No element SHALL make a request (FR-13, NFR-5, AD-8).

#### Scenario: Markup in Markdown
- **WHEN** a Markdown Text holds `<img src=x onerror=alert(1)>`, `<script>alert(1)</script>` and `<span style="color:red">x</span>`
- **THEN** each shows as text, no script runs, no request leaves the view, and no CSP violation is reported in Chromium, Firefox or WebKit

#### Scenario: Plain text stays plain
- **WHEN** a Text without `format` holds `**bold**`
- **THEN** it shows the asterisks as text

### Requirement: Markdown images, tables and controls
In Markdown, an image SHALL show as a link to its source labelled with its alt text, table alignment SHALL be a class, never a `style` attribute, and text SHALL show bidirectional controls as marked escapes, as agent-written labels do (AD-8, AD-12).

#### Scenario: An image and an aligned table
- **WHEN** a Markdown Text holds `![logo](https://example.com/a.png)` and a table with right-aligned columns
- **THEN** the image shows as a link labelled "logo" and is never loaded, and the table's alignment is a class with no CSP violation

### Requirement: Markdown links in the view
A link in Markdown SHALL be a link only when its URL is a non-empty `http:` or `https:` URL of at most 2,048 characters with no user name or password, the board page's own check. On the live board, a click on a link SHALL send the board page an open-link message naming the item and the URL and SHALL NOT navigate the view. In a Snapshot, which has no board page, a link SHALL open natively in a new tab with `rel="noopener noreferrer"` (AD-8, NFR-9).

#### Scenario: A link clicked on the board
- **WHEN** the user clicks `[docs](https://example.com/docs)` in a Markdown Text
- **THEN** the view stays on the board and sends the open-link message

#### Scenario: Another scheme
- **WHEN** a Markdown Text holds `[x](javascript:alert(1))`
- **THEN** it shows as its source text and is no link

### Requirement: Refused Markdown links
A Markdown link that is no link SHALL show as its source text, except that one with nothing but spaces between its parentheses SHALL show its label; an image whose source is empty SHALL show its alt text, or its source text when the alt is empty too, and an image whose source is otherwise refused SHALL show its source text (AD-8).

#### Scenario: Empty destinations
- **WHEN** a Markdown Text holds `[a]()`, `[a]( )`, `[a](<>)`, `![x]()` and `![]()`
- **THEN** they read `a`, `a`, `[a](<>)`, `x` and `![]()` as text, and none is a link

#### Scenario: An image with a refused source
- **WHEN** a Markdown Text holds `![x](javascript:alert(1))`
- **THEN** it reads `![x](javascript:alert(1))` as text and is no link

#### Scenario: A link too long
- **WHEN** a Markdown Text holds a link whose URL is 2,049 characters
- **THEN** it shows as its source text and is no link

### Requirement: The board page opens Markdown links
The board page SHALL open an open-link message's URL in a new tab with `noopener` and `noreferrer` only when it is `http:` or `https:` with no user name or password, at most 2,048 characters, and the item it names holds Markdown in the board document; it SHALL open nothing otherwise (AD-8).

#### Scenario: A link opened
- **WHEN** the board page receives an open-link message for `https://example.com/docs` from a Markdown Text
- **THEN** it opens the URL in a new tab without an opener

#### Scenario: A forged message
- **WHEN** the board page receives an open-link message with `javascript:alert(1)`, `file:///etc/passwd`, a URL of 2,049 characters, or an item that holds no Markdown
- **THEN** it opens nothing

### Requirement: Markdown bounded work
A Markdown source SHALL render with nesting cut at 20 levels, and every source within its item's bounds SHALL render in under 2 seconds in Chromium and WebKit, measured under 500 ms on the test machine (AD-8, NFR-12).

#### Scenario: Pathological Markdown
- **WHEN** a Text holds 10,000 code points of nested block quotes, nested lists, unmatched emphasis markers or nested brackets
- **THEN** the board renders it in under 500 ms in Chromium and WebKit on the test machine and stays responsive

### Requirement: Option previews in Markdown
An option whose `previewFormat` is `markdown` SHALL show its preview, when opened, through the Text atom's component, so that it renders as Markdown under the rules above; a preview without it SHALL stay plain text (FR-3, EXPERIENCE Option preview).

#### Scenario: A Markdown preview
- **WHEN** the user opens the preview of an option with `previewFormat: "markdown"` holding a code block
- **THEN** the preview shows the code block in the code type, and the board carries the Text atom's chunk

### Requirement: Display atoms
A Text SHALL show its text in the body type, plain text keeping its line breaks; a Value SHALL show its label, if any, and its value in the code type formatted in the ask's locale (numbers, percentages, money, long dates, and durations as days); a Divider SHALL show a rule. None of them SHALL give an answer, and none SHALL take focus except a Markdown Text's links; a label SHALL wrap, never pushing the value out of the card (FR-13, DESIGN Primitives).

#### Scenario: Values in Italian
- **WHEN** an it-IT board shows Values of 1234.5, 0.185 as a percent, `12480` EUR, `2026-12-09` and 12 days
- **THEN** they read `1.234,5`, `18,5%`, `€ 12.480,00`, `mer 9 dic 2026` and `12 giorni`

#### Scenario: A long label
- **WHEN** a Value's label is 200 characters, with or without spaces, in a window at the board's 1280-pixel floor (DESIGN `viewport-floor`)
- **THEN** the label wraps, the figure stays inside the card, and the page does not scroll sideways

### Requirement: Input atoms fill the draft only
Each input atom SHALL start unset and show nothing as set before the user acts; a value the user sets SHALL go into the draft as the item's result, and clearing it SHALL remove the result; nothing SHALL be sent before the question's "Answer" (EXPERIENCE Explicit acts, AD-10). Each SHALL show its label, visibly, and its description under it, and each control SHALL work from the keyboard (NFR-12).

#### Scenario: Typing does not answer
- **WHEN** the user types in a TextField and leaves the field
- **THEN** the draft holds the text as the item's result and nothing is sent

#### Scenario: A cleared field
- **WHEN** the user empties a NumberField that held 3
- **THEN** the item holds no result and no entry

### Requirement: Number, amount and date entry in the fields
NumberField, MoneyField and DateField SHALL be text inputs read with the contract's parsers in the ask's locale, never the browser's number or date inputs, and SHALL echo the value they read beside the field. A MoneyField with `currencies` SHALL offer them as a segmented control after the field (FR-13, FR-34, AD-7).

#### Scenario: An Italian amount
- **WHEN** the user types `1.234,5` in an it-IT MoneyField in EUR
- **THEN** the echo reads `= 1234,50 EUR` and the draft holds `{amount: "1234.50", currency: "EUR"}`

### Requirement: The DateField's calendar
A DateField SHALL also open a calendar in a non-modal popover from a button beside the field, with month and weekday names from AskBoard's own tables in the ask's language, weeks from Sunday in en-US and from Monday in it-IT, and days outside the item's range disabled. A picked day SHALL be the date the calendar shows, whatever the viewer's time zone (FR-13, FR-34, NFR-12).

#### Scenario: A day picked across time zones
- **WHEN** the user picks 9 December 2026 in the calendar with the browser's time zone at UTC−10 and at UTC+14
- **THEN** the draft holds `2026-12-09` both times

#### Scenario: The calendar from the keyboard
- **WHEN** the user opens the calendar with Enter, moves with the arrow keys, picks with Enter, and presses Escape on a second opening
- **THEN** the picked day fills the field, and Escape closes the popover with focus back on its button

### Requirement: An entry blocks Answer
Text in a NumberField, MoneyField or DateField that its parser refuses, or whose value falls outside the item's bounds, SHALL stay in the field with its field error, SHALL be kept in the draft record as the item's entry and restored after a reload, and SHALL leave the item with no result; while any item of a question holds an entry, its "Answer" SHALL be disabled. Correcting or clearing the text SHALL remove the entry (NFR-10, AD-10, AD-20).

#### Scenario: An English habit in Italian
- **WHEN** the user types `1.23` in an it-IT NumberField
- **THEN** the field error gives the parser's reason, the item holds no result, and "Answer" is disabled

#### Scenario: Restored after a reload
- **WHEN** the user reloads the board with `21` typed in a NumberField whose `max` is 20
- **THEN** the field shows `21` with its field error, and "Answer" stays disabled until the user corrects it

### Requirement: The Toggle's unset state
An unset Toggle SHALL show a switch drawn off with "Not set" beside it; a press SHALL set it on, the next off, each read "On" or "Off", and "Clear" SHALL return it to unset, removing its result (FR-13, EXPERIENCE Primitives).

#### Scenario: Off, chosen
- **WHEN** the user presses an unset Toggle twice with Space
- **THEN** it reads "Off" and the draft holds `false` as its result

### Requirement: Atoms read-only and in Snapshots
After its question is answered, and in a Snapshot, each input atom SHALL show the answer's value read-only, formatted in the ask's locale, with no echo or field error, and the display atoms as on the board (FR-13, AD-15).

#### Scenario: A Snapshot of answered atoms
- **WHEN** a board answered with every input atom set is taken as a Snapshot and opened from `file://`
- **THEN** each atom shows its value read-only, and a Markdown Text's link opens in a new tab with `rel="noopener noreferrer"`

### Requirement: Atoms end to end
A question built only from atoms SHALL render and return a typed answer through the session process: `collect` and the mod's push SHALL deliver its `results` by item ID, in each conformance configuration, on Bun and on Node 24 (FR-13, FR-18, FR-21).

#### Scenario: Pushed and collected
- **WHEN** the user answers a question of the five input atoms on the real board
- **THEN** the agent receives one answer whose `results` hold the five values, by push where the mod runs and by `collect` everywhere

### Requirement: Atom strings
Every string the atoms show, the calendar's labels and the field errors included, SHALL come from the view's string tables in en-US and it-IT, with the texts of `ux-update-draft.md` (FR-34).

#### Scenario: An Italian board of atoms
- **WHEN** an it-IT board shows every atom, an unset Toggle and an open calendar
- **THEN** every string is Italian, "Non impostato", the month caption and the weekday names included

### Requirement: Items inside layouts
A layout SHALL place the items it holds, each rendered through the port in its own item frame and error boundary. A question SHALL count as visible only when every item at every depth, its layouts included, is ready, and an item that throws at any depth SHALL fail its question (AD-9, AD-10, SM-C2).

#### Scenario: A field inside a Group inside a tab
- **WHEN** the user types in a NumberField that sits in a Group in the second tab, then reloads the board
- **THEN** the value is in the draft record under the NumberField's ID, comes back after the reload, and "Answer" sends it

#### Scenario: A nested item that throws
- **WHEN** a component inside a Row throws while rendering
- **THEN** the item shows its error state, its question offers no "Answer", and the rest of the board stays usable

#### Scenario: Chunks of nested items
- **WHEN** a board's only TextField sits in a Group
- **THEN** the board's srcdoc holds the `group` and `text-field` chunks

### Requirement: Stack and Group
A Stack SHALL show its items one under another. A Group SHALL show its title and its description above its items in a bordered frame, and SHALL be exposed as a group named by its title. Titles and descriptions SHALL show as text (AD-8; EXPERIENCE and DESIGN, Layouts).

#### Scenario: A Group read by assistive technology
- **WHEN** a Group titled "Contact" holds two TextFields
- **THEN** the accessibility tree holds a group named "Contact" around both fields

### Requirement: Row
A Row SHALL show its items side by side, each taking its weight's share of the Row's width, while every item gets at least 240 px; otherwise it SHALL show them one under another, in order. Widths SHALL reach the view through classes, never a `style` attribute (AD-8; DESIGN, Layouts).

#### Scenario: Wide and narrow
- **WHEN** a Row of two items weighted 2 and 1 is 960 px wide, then 400 px wide
- **THEN** the items first sit side by side with the first twice as wide, then one under another, and no `style` attribute or CSP report appears

### Requirement: Tabs inside a question
Tabs SHALL show one tab per entry with its title, select the first, keep every panel mounted and hidden but the selected one, follow Radix's keyboard, and be labelled by their question's text. Switching SHALL stay possible on an answered or locked question and in a Snapshot (AD-9; EXPERIENCE, Keyboard core, Tab order).

#### Scenario: The keyboard
- **WHEN** focus is on the first tab and the user presses ArrowRight, then End, then Tab
- **THEN** the second tab is selected, then the last, and focus moves into the last tab's panel

#### Scenario: Items in hidden panels
- **WHEN** a question's third tab holds a Gantt and the board opens
- **THEN** the question counts as visible without showing that tab, and the Gantt draws at the panel's width once its tab is selected

#### Scenario: After a reload
- **WHEN** the user selects the second tab, types in a field there, and reloads
- **THEN** the Tabs show their first tab, and the field's text is back in the second

### Requirement: A tab holding a field to correct
A tab whose panel holds, at any depth, a field with an entry SHALL show the field-error mark, and its accessible name SHALL say so, in en-US and it-IT; the mark SHALL clear once the entry is corrected or cleared (NFR-10, AD-20; EXPERIENCE, Voice and Tone).

#### Scenario: An entry in a hidden tab
- **WHEN** the user types `12,5` in an en-US NumberField of the second tab and selects the first tab
- **THEN** the second tab carries the mark and reads "needs a correction", and "Answer" stays disabled until the field is corrected

### Requirement: Layouts end to end
On the session process, a question arranged with layouts SHALL be answered with its results keyed by item ID at every depth through `collect`, SHALL come back from the draft after a reload, and an agent change to an item inside a layout SHALL show the agent-change notice naming that item's widget (FR-6, FR-13, FR-20).

#### Scenario: Answered through collect
- **WHEN** the user fills the arranged question's fields in several tabs and answers
- **THEN** `collect` returns one answer whose `results` hold each field's item ID

### Requirement: Layouts in Snapshots
A Snapshot SHALL show layouts as the board does, read-only, with Tabs still switching, opened from `file://` with no CSP report (FR-26, AD-15).

#### Scenario: A Snapshot of an answered arranged question
- **WHEN** a Snapshot of the answered question is opened from `file://`
- **THEN** each field shows its answered value read-only, the Tabs switch, and no CSP problem is reported

### Requirement: A field check blocks Answer
While any field of a question, at any depth, fails its field check or holds an entry, the question's "Answer" and "Accept recommended" SHALL be disabled, "Select recommended" SHALL not mark it ready, a held answer SHALL lose its ready mark, and Submit SHALL send nothing for it and move to it. Once every field passes, each works again (NFR-10, AD-10, AD-20).

#### Scenario: A pattern not met
- **WHEN** the user types `ab-1234` in a TextField whose pattern is `^[A-Z]{2}-\d{4}$`
- **THEN** "Answer" is disabled, and typing `AB-1234` enables it

#### Scenario: Submit with a held answer
- **WHEN** in submitted delivery the user marks a question's answer ready, then empties its required DateField and presses Submit
- **THEN** the answer is no longer ready, Submit sends nothing for that question, and the board moves to it

### Requirement: Answer names the field to fix
While "Answer" is disabled by a field, its description SHALL name the first such field in document order, by its label shown as text: "Correct {label} first." for an entry or a value that fails a check, "Complete {label} first." for an empty required field (EXPERIENCE, Voice and Tone).

#### Scenario: An empty required field
- **WHEN** a question's only blocking field is the empty required TextField "Ticket"
- **THEN** "Answer" is described "Complete Ticket first."

### Requirement: Required fields
A required field's label SHALL end with "(required)", "(obbligatorio)" in it-IT, and its control SHALL be marked required for assistive technology. An empty required field SHALL show no field error (AD-10; DESIGN, Input atoms).

#### Scenario: A required DateField
- **WHEN** a board shows a DateField `{label: "Start", required: true}` with nothing typed
- **THEN** its label reads "Start (required)", its input is marked required, and no field error shows

### Requirement: A TextField's checks as the user types
A TextField whose text fails its `minLength` or `pattern` SHALL show the field error under it as the user types, SHALL keep the text as its value in the draft, restored after a reload, and SHALL clear the error once the text passes or is emptied. Enter in any field SHALL send nothing (FR-11; EXPERIENCE, Form).

#### Scenario: Restored after a reload
- **WHEN** the user reloads the board with `ab-1234` typed in that TextField
- **THEN** the field shows `ab-1234` with its field error, and "Answer" stays disabled

#### Scenario: Enter
- **WHEN** the user presses Enter in a single-line TextField of a question
- **THEN** nothing is sent and the draft keeps the text

### Requirement: The PickField
A single PickField SHALL show its options as radios with manual activation (Radios with manual activation) and a "Clear" while one is picked; a multiple PickField SHALL show checkboxes. Nothing SHALL be picked until the user picks (AD-10). A multiple pick outside `minItems` or `maxItems` SHALL show its field error. The value SHALL go to the draft only (FR-11, FR-13).

#### Scenario: A single pick by keyboard
- **WHEN** the user moves into a single PickField with Tab, presses the down arrow, then Space, then activates "Clear"
- **THEN** nothing is picked on Tab or on the arrow, the draft holds the ID of the option the arrow moved the focus to once Space is pressed, then no result

#### Scenario: Too few picks
- **WHEN** the user picks one option of a multiple PickField whose `minItems` is 2
- **THEN** its field error reads "Pick at least 2." and "Answer" is disabled

### Requirement: The PickField's filter
Above a PickField of more than 10 options, a filter field SHALL show only the options whose label holds its text, ignoring case. An option the filter hides SHALL stay picked. The filter's text SHALL not be part of the draft or the answer (DESIGN, Form).

#### Scenario: A hidden pick
- **WHEN** the user picks "Italy" in a PickField of 30 countries, then types `fra` in its filter
- **THEN** only the options holding "fra" show, and the draft still holds Italy's ID

### Requirement: A tab holding a field that fails a check
A tab whose panel holds, at any depth, a field whose value fails its field check SHALL carry the field-error mark, as for an entry; an empty required field SHALL add no mark (EXPERIENCE, Primitives, Layouts).

#### Scenario: A pattern not met in a hidden tab
- **WHEN** the user types `ab-1234` in the patterned TextField of the second tab and selects the first tab
- **THEN** the second tab carries the mark and reads "needs a correction"

### Requirement: Forms read-only and in Snapshots
On an answered or locked question and in a Snapshot, a Form's fields SHALL show their values read-only, a PickField its options with the picks checked and disabled and no filter or "Clear", and no field error or required mark that asks for input (AD-15).

#### Scenario: A Snapshot of a Form
- **WHEN** a Snapshot of an answered Form is opened from `file://`
- **THEN** each field shows its value read-only and the page reports no CSP violation

### Requirement: Forms end to end
A Form, a question of every field type in Groups and Tabs, SHALL be answered on the session process with one answer whose `results` hold each field's value by item ID; editing every field, reloading and coming back SHALL show the same values and the same draft (AD-9, AD-20).

#### Scenario: The remount check
- **WHEN** the user fills every field of the Form, reloads the board, and compares
- **THEN** each field shows the same value and state, the draft record is the same, and the answer then sent holds those values

### Requirement: Form strings
The required mark, the field errors of `minLength`, `pattern`, `minItems` and `maxItems`, the "Complete {label} first." description, the PickField's "Clear", filter label and empty-filter text SHALL be shown in en-US and it-IT, with the texts of EXPERIENCE's Voice and Tone (FR-34).

#### Scenario: An Italian Form
- **WHEN** an it-IT board shows a Form with a required field, a pattern not met and a filtered PickField
- **THEN** every string the Form shows is Italian

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

### Requirement: The Table's grid
A Table SHALL show its `label` as a caption, a header row of its columns' labels, a formula column's header marked as computed with its formula as the header's description, one row per row of the value it shows, and a Total row when a column has a total. It SHALL be one Tab stop, ready after its first layout (FR-11, AD-9, NFR-12).

#### Scenario: The Table of roles
- **WHEN** a board shows the Table of roles
- **THEN** it shows the caption "Roles", four headers with "Amount" marked computed, the rows `pm` and `dev`, and a Total row with 90 and "$70,560.00"

#### Scenario: One Tab stop
- **WHEN** the user presses Tab into the Table, then Tab again
- **THEN** the first press focuses the grid on its current cell, and the second leaves it for the Table's toolbar

### Requirement: Typed cells in the ask's locale
A cell SHALL show its value in the ask's locale: a number with its unit and money with its currency at its minor units, as the Value atom shows them; a date in the locale's numeric form (`10/27/2026`, `27/10/2026`); a toggle as on, off or unset. Numbers and money SHALL be right-aligned in the code typography (FR-13, FR-34, AD-13).

#### Scenario: Italian formats
- **WHEN** the Table of roles is shown on an ask whose locale is it-IT
- **THEN** `pm`'s rate reads "$ 1.040,00" and the days total "90", as the it-IT Value shows them

#### Scenario: An unset toggle
- **WHEN** a toggle column's cell is empty
- **THEN** it shows unset, apart from off

### Requirement: Editing a cell
Enter, F2 or a double-click SHALL open an editor on the current input cell other than an on/off cell; the text SHALL be read by the input atom's parser in the ask's locale, its parsed value echoed while the editor is open; Enter or leaving SHALL commit a value into the draft, an empty text emptying the cell, and an unchanged text nothing; Escape SHALL restore the cell (AD-9, AD-10).

#### Scenario: A rate typed in Italian
- **WHEN** on an it-IT ask the user opens `pm`'s rate, types "960,00" and presses Enter
- **THEN** the editor shows "= 960,00 USD" while open, the cell reads "$ 960,00" after, and the draft holds `pm`'s rate "960.00"

#### Scenario: Escape
- **WHEN** the user types "500" in `dev`'s days and presses Escape
- **THEN** the cell reads 72, and the draft is unchanged

#### Scenario: A formula cell
- **WHEN** the user presses Enter on `pm`'s amount
- **THEN** no editor opens

### Requirement: An editor across the agent's change
An open cell editor SHALL close without committing when the agent's change alters its cell's column, row or value, and SHALL not reopen on its own (AD-10, NFR-10).

#### Scenario: The agent changes the cell being edited
- **WHEN** the user has opened the editor on `pm`'s rate without typing, and the agent's update sets that rate to 1,200
- **THEN** the editor closes without committing, the cell reads the agent's rate, and the counter reads no change

### Requirement: On/off cells
An on/off cell SHALL have no editor and hold no cell entry: Space, Enter, F2 or a click SHALL switch it, not set or off to on and on to off, and Delete or Backspace SHALL return it to not set (AD-9, AD-10).

#### Scenario: An on/off cell
- **WHEN** a Table has a toggle column `billable`, and on `pm`'s cell, not set, the user presses Enter, then clicks the cell, then presses Delete
- **THEN** no editor opens, the cell reads "On", then "Off", then "Not set", the draft's `pm` row ends with no `billable`, and no cell entry is held

### Requirement: Cell entries block "Answer"
Text a cell cannot read, or whose value breaks its column's bounds, SHALL stay in the cell with its field error as a cell entry: Enter keeps the editor open on it, leaving keeps it in the cell. While any cell holds one, the question's "Answer", "Send and switch" and Submit SHALL be disabled, described "Correct {label} first."; correcting or clearing it releases them (AD-10, AD-20, NFR-10).

#### Scenario: An ambiguous number
- **WHEN** on an en-US ask the user types "1.234,5" in `dev`'s days and leaves the cell
- **THEN** the cell shows "1.234,5" with the parser's field error under its row, the draft keeps 72 as `dev`'s days, and "Answer" is disabled, described "Correct Roles first."

#### Scenario: Out of bounds
- **WHEN** the user types "-1" in `pm`'s days, whose column's `min` is 0
- **THEN** the cell holds the entry with the error "At least 0." as the NumberField words it, and "Answer" is disabled

#### Scenario: Kept across a reload
- **WHEN** the board reloads while `dev`'s days holds the entry "1.234,5"
- **THEN** the cell shows it again with its error, and "Answer" stays disabled until the user corrects or clears it

### Requirement: Cell entries in the draft
The shell SHALL hold each item's cell entries in the draft record, each cut at 200 code points, count them as unsent work, include them in "Copy my unsent work", restore them, and drop an item's cell entries with its value (AD-20).

#### Scenario: Unsent work
- **WHEN** a cell holds an entry and nothing else on the board is unsent
- **THEN** leaving the page asks first, and "Copy my unsent work" on a closed board holds the entry's text with its item, row and column

### Requirement: Adding and deleting rows
Unless the Table has `fixedRows`, its toolbar SHALL offer "Add row", which adds an empty row after the current row (else at the end) with a view-made ID and makes its first input cell current, and "Delete row", which removes the current row. At 200 rows "Add row" SHALL be refused with a message beside the toolbar and in a polite live region (AD-7, AD-10).

#### Scenario: A row added and filled
- **WHEN** the user makes `pm` current, presses "Add row" and types "QA engineer" in its role
- **THEN** a row `u-1` stands after `pm`, the draft's rows are `pm`, `u-1`, `dev`, and the changes hold an `add` of `costs.u-1` after `pm`

#### Scenario: A row deleted
- **WHEN** the user makes `dev` current and presses "Delete row"
- **THEN** `dev` leaves the grid, the totals drop to `pm`'s, and the current row becomes `pm`

#### Scenario: Fixed rows
- **WHEN** a Table has `fixedRows: true`
- **THEN** its toolbar has neither "Add row" nor "Delete row"

### Requirement: Totals and formula columns on the board
Formula cells and totals SHALL read the board's live graph and update within the same interaction as the edit, with no agent; a cell edit SHALL recalculate the graph in place, and adding or deleting a row SHALL rebuild it (FR-12, AD-13).

#### Scenario: A rate lowered
- **WHEN** the user commits `pm`'s rate "960.00"
- **THEN** `pm`'s amount reads "$17,280.00" and the amount total "$69,120.00" within the same interaction

### Requirement: Formula errors on the board
A column formula's problem SHALL show once, over the grid, naming the column and its wording, with its cells reading "—"; an error that depends on a row's values SHALL show under that row, a total's under the Total row. No formula error SHALL disable "Answer" (AD-13, FR-14).

#### Scenario: A misspelt field
- **WHEN** a Table's `amount` formula reads `[@rte]`
- **THEN** one field error over the grid names "Amount", every amount cell reads "—", and "Answer" stays enabled

#### Scenario: A division by zero in one row
- **WHEN** a column `perDay` is `[@amount] / [@days]` and `dev`'s days is 0
- **THEN** a field error under `dev`'s row names "Per day" and the division by zero, and `pm`'s value shows

### Requirement: A refused column's error shows once
The cells and totals of columns that read a refused column SHALL read "—" with no row or total error whose origin is that column; an error of their own SHALL still show under its row or the Total row (AD-13, FR-14).

#### Scenario: A column reading a refused column
- **WHEN** `amount` reads `[@rte]` and a column `perDay` is `[@amount] / [@days]`, with no day at 0
- **THEN** one field error over the grid names "Amount", every amount and per-day cell reads "—", and no error shows under any row or the Total row

### Requirement: Money past the bound on the board
A money value a formula gives past 15 integer digits SHALL show as "—" with an error of the kind `value`, under its row or the Total row, and SHALL not disable "Answer" (AD-10, AD-13).

#### Scenario: Money past the bound
- **WHEN** a money formula cell would hold 1e30 (a rate of "999999999999999.99" times 1000000000000000 days)
- **THEN** the cell reads "—" with a field error under its row naming the column, the column's total reads "—" with its error under the Total row, and "Answer" stays enabled

### Requirement: Changes shown apart
A changed cell SHALL take the change highlight, an added row too; a formula cell or total whose value differs from the board as sent SHALL take the derived mark and is not counted. The toolbar's counter SHALL read "No changes", else "Your changes: N", N counting changed cells, added rows and deleted rows (FR-11, EXPERIENCE Change highlight).

#### Scenario: A lowered rate
- **WHEN** the user lowers `pm`'s rate
- **THEN** that cell takes the change highlight, `pm`'s amount and the amount total take the derived mark, and the counter reads "Your changes: 1"

### Requirement: The Table's answer from the board
"Answer" SHALL send the Table's full edited value when it differs from the agent's and, when the answer names the question's current revision, the Table's derived values by the contract's rule, changed or not; an untouched Table sends no value. A board-made answer SHALL never hold a cell entry (AD-10, AD-20, FR-12).

#### Scenario: Answered after an edit
- **WHEN** the user lowers `pm`'s rate to "960.00" and presses "Answer"
- **THEN** the answer message holds the edited rows and the derived values `costs.days`, `costs.amount` and `costs.pm.amount`, and the Table turns read-only

#### Scenario: Answered on a kept earlier revision
- **WHEN** the user kept work on an earlier revision through "Keep mine" and presses "Answer"
- **THEN** the answer message names that revision and holds no derived value of the Table

### Requirement: The Table at the keyboard
In the grid, the arrow keys SHALL move the current cell, Home and End to its row's first and last cell; on an on/off cell Space, Enter or F2 SHALL switch it and Delete or Backspace return it to not set; the current cell SHALL be marked and focused visibly. The toolbar SHALL be its own Tab stop. Every edit, row added or deleted SHALL be reachable from the keyboard (NFR-12).

#### Scenario: Editing without a pointer
- **WHEN** the user tabs into the grid, current on `pm`'s role, presses Down, Right twice and Enter, types "16" and presses Enter
- **THEN** the editor opened on `dev`'s rate, and the draft holds `dev`'s rate "16.00"

#### Scenario: An on/off cell without a pointer
- **WHEN** on a Table with a toggle column `billable` the user moves to `dev`'s cell, not set, presses F2, then Space, then Backspace
- **THEN** the cell reads "On", then "Off", then "Not set", and no editor opened

### Requirement: A Table read-only and in Snapshots
An answered, locked or Snapshot Table SHALL show its rows, totals and formula cells with their marks, open no editor, switch no toggle and show no toolbar actions, and SHALL stay readable from the keyboard (AD-9, AD-15).

#### Scenario: A Snapshot from a file
- **WHEN** the Snapshot of an answered Table of roles is opened from `file://`
- **THEN** it shows `pm`'s rate "$960.00" with the change highlight, the totals of the edited rows, and makes no request

### Requirement: An agent's change to a Table
On "Keep mine", the shell SHALL keep a Table's draft and its cell entries on the revision the work was made on, and SHALL drop both when the card shows a revision other than that one, as after a reload, or one that cannot show the draft; the Table then shows the agent's props untouched. "Reload" drops both (FR-6, AD-10, AD-20).

#### Scenario: The agent drops a column
- **WHEN** the user has lowered `pm`'s rate, the agent's update removes the `rate` column, the tab reloads, and the user chooses "Keep mine"
- **THEN** the Table shows the agent's new revision, untouched, and its draft and cell entries are gone; without a reload, the lowered rate is kept on the revision it was made on

### Requirement: A Table on a revision the board cannot show
A Table the card shows on a revision other than the one its work was made on, as after a reload, SHALL be read-only with the line (keep-mine-shown-revision): it takes no cell write and no cell entry, and "Keep mine" SHALL drop the cell entries it holds even where it holds no value, so that none blocks "Answer" on a Table the user cannot edit (FR-6, AD-10, NFR-10).

#### Scenario: A cell entry held across a reload
- **WHEN** the user has typed text a cell cannot read in `dev`'s days, the agent's update changes the question, the tab reloads and the user chooses "Keep mine"
- **THEN** the Table is read-only with the line and takes no cell write and no cell entry, the held entry is gone, "Answer" is not blocked by it, and the answer names the kept revision with no derived value

### Requirement: Agent and user text wraps in a Table
The caption, every header and every text cell SHALL wrap a word of 200 characters with no space inside the widget frame at DESIGN's 1,280-pixel floor; a grid wider than the frame SHALL scroll inside it, never widening the board (DESIGN Wide widgets, NFR-12).

#### Scenario: Long words
- **WHEN** a Table's label, a header and a text cell each hold 200 characters with no space, on a board 1,280 pixels wide
- **THEN** each wraps inside the frame, and the board has no horizontal scroll

### Requirement: Table strings
Every string the Table shows SHALL come from the view's tables in en-US and it-IT: the toolbar, the counter, the computed mark, the cell and row names, the field errors (a text cell over its limit by the Table's own string, never another widget's), the refusals and the hint (FR-34).

#### Scenario: An Italian board
- **WHEN** an it-IT ask shows a Table, the user adds a row and types 501 characters in its role
- **THEN** the toolbar reads "Aggiungi riga" and "Elimina riga", the cell's error reads "Una cella di testo contiene al massimo 500 caratteri.", and no English string of the Table shows in its text, accessible names or titles

### Requirement: A Table at its bounds on the board
A Table at its bounds SHALL become visible, and take a cell edit and a row added, within the gates of design decision 13 in WebKit, cold (NFR-12, AD-13).

#### Scenario: The worst form in WebKit
- **WHEN** a board holding the worst Table the bounds admit opens in a fresh WebKit page, the user edits one input cell, then adds a row
- **THEN** each step is within its gate, and the figures are recorded

#### Scenario: The fan-out form in WebKit
- **WHEN** a board holding a 200-row Table whose every formula reads a total opens in a fresh WebKit page and the user edits one input cell
- **THEN** the edit is painted within the fan-out form's gate, and the figures are recorded

### Requirement: Radios with manual activation
A single choice, among a question's options or in a single PickField, SHALL be a group of radios that exposes each radio's checked state. Tab SHALL enter on the checked radio, else the first one shown. The arrow keys SHALL move the focus, wrapping, and Home and End to the ends, checking nothing. Space, Enter or a click SHALL check an unchecked radio and SHALL change nothing on a checked one (NFR-12, AD-10; EXPERIENCE Option, Keyboard core).

#### Scenario: Tab returns to the selected option
- **WHEN** the user has selected "SQLite", moves the focus out of the options with Tab and back with Shift+Tab
- **THEN** the focus is on "SQLite", which is still the only selected option

#### Scenario: The arrow keys wrap
- **WHEN** the focus is on the last option and the user presses the down arrow, then End
- **THEN** the focus moves to the first option, then to the last, and nothing is selected

#### Scenario: "Other…" text kept while moving
- **WHEN** the user has selected "Other…" and typed text in it, then presses the up arrow twice
- **THEN** "Other…" stays selected with its text and the draft is unchanged

#### Scenario: The selected option pressed again
- **WHEN** in submitted delivery the user presses Space, then Enter, on the selected option of a question whose answer is ready
- **THEN** the draft is unchanged and the answer stays ready

#### Scenario: A pick the filter hides
- **WHEN** a single PickField's picked option is hidden by its filter and the user tabs into its options
- **THEN** the focus is on the first option shown and the pick is unchanged

### Requirement: An answer too large to send
The board page SHALL refuse an act command whose message would pass the contract's message limit: it SHALL send and hold nothing, stay live and keep sending later commands. Each question the command carried SHALL show that it was not sent, with its size and the limit, until its work changes or it is sent; the user's work SHALL stay in the draft, and held acts SHALL stay held. A socket closed as too large SHALL not have its commands sent again (NFR-10, AD-10, AD-21).

#### Scenario: One answer too large
- **WHEN** in immediate delivery the user presses "Answer" on a question whose answer measures over the limit
- **THEN** nothing reaches `board-host`, the card says the answer was not sent with its size and the limit, the work stays, and an answer to another question then goes and is logged

#### Scenario: Submit too large
- **WHEN** in submitted delivery the user presses Submit and its command would pass the limit
- **THEN** nothing is sent, every held act stays held, and each question in it says Submit was too large

#### Scenario: The socket closed as too large
- **WHEN** `board-host` closes the board's socket with 1009 after commands were sent on it
- **THEN** the board page reconnects, sends none of those commands again, and their questions say they were not sent; a later answer goes and is logged

### Requirement: Work too large to keep across a reload
When the draft record would pass the draft limit, the board page SHALL mirror it without the work of whole questions, the largest first, until it fits, and SHALL never mirror part of a question's work. Each question left out SHALL say that a reload would lose its work; that work SHALL stay on the board and in "Copy my unsent work" (AD-20, FR-25).

#### Scenario: One question too large to keep
- **WHEN** one question's work passes the draft limit while another question holds a note
- **THEN** the mirrored record holds the note's question and none of the large one's work, and the large one's card says a reload would lose its work

#### Scenario: Back within the limit
- **WHEN** the user shortens that work until the record fits
- **THEN** the next mirrored record holds it and the line goes

### Requirement: Density in a Snapshot
An opened Snapshot SHALL start in the density its record's `presentation` names, else compact, and its "Compact | Comfortable" switch SHALL change the density of the page alone, saving nothing and using no browser storage; no quick toggle in a Snapshot SHALL be disabled by a project setting (EXPERIENCE Snapshots, AD-8).

#### Scenario: Comfortable on the board
- **WHEN** a Snapshot recording `density` `comfortable` is opened
- **THEN** the page uses the comfortable spacing, with "Comfortable" pressed

#### Scenario: Switching density
- **WHEN** the user switches an opened Snapshot to Compact and reopens the file
- **THEN** the page becomes compact at once, no browser storage is touched, and the reopened file is comfortable again

#### Scenario: Taken from the board end to end
- **WHEN** the user picks Light and Comfortable on a board with the system set to dark, takes a Snapshot and opens its file
- **THEN** the Snapshot shows in light and comfortable, with one Theme control
