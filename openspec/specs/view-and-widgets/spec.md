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
Every agent string on the board (title, area titles, question text, header chips, option labels, descriptions, previews and annotations, and follow-up replies) SHALL render as text, never as markup (AD-8, NFR-5).

#### Scenario: Markup in an option label
- **WHEN** an option's label is `<img src=x onerror=alert(1)>`
- **THEN** the board shows those characters as text, and no element is created from them

#### Scenario: Markup in a reply
- **WHEN** the agent replies to a follow-up with `<script>alert(1)</script>`
- **THEN** the thread shows those characters as text, and no script runs

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
The Gantt SHALL show, in the widget frame, a grid with one row per task (its name, start, duration and predecessors) beside AskBoard's own chart on a time axis: one bar per task, finish-to-start arrows, the critical path as solid bars in the critical colour with heavier arrows, and a legend reading task, critical path and your change. Every agent string SHALL render as text (AD-8; DESIGN.md Widgets, Gantt).

#### Scenario: The UJ-2 plan opens
- **WHEN** the fixture plan opens
- **THEN** the grid lists the six work packages in the Tree's order, UX design starts on 11/2/2026, reporting ends on 12/11/2026, and the bars of UX design, the prototype, the portal and reporting are drawn as the critical path

#### Scenario: Markup in agent strings
- **WHEN** a task's name holds `<img src=x onerror=alert(1)>`
- **THEN** the grid shows those characters as text, and no element is created from them

### Requirement: Gantt plan scope
A Gantt plan SHALL take its tasks from the leaves of the Tree it names, in the Tree's order, draw no bar for a parent, and show each duration as its PERT expected effort rounded up to whole working days, read-only. Its toolbar SHALL offer the zoom "Day | Week | Month", opening at week (FR-11, FR-15; DESIGN.md and EXPERIENCE Molecules, Gantt plan).

#### Scenario: Zooming
- **WHEN** the user chooses "Month" and then "Day"
- **THEN** the axis and the bars rescale each time, "Answer" stays disabled, and no message leaves the view

#### Scenario: A standalone Gantt
- **WHEN** a Gantt with its own tasks opens
- **THEN** it shows the week scale with no zoom control and no baseline, and its durations are editable

### Requirement: Gantt dates follow the edits
Every edit SHALL reschedule the Gantt on the board within the same interaction, without the agent: the edited task's dependents move, and the critical path follows. In a plan, an estimate changed in its Tree SHALL change the task's duration and the schedule the same way (FR-12, AD-13).

#### Scenario: A task moved later
- **WHEN** the user moves the portal three working days later
- **THEN** reporting moves three working days later, and the plan ends three working days later

#### Scenario: An estimate changed in the work breakdown
- **WHEN** the user changes the portal's most likely estimate in the Tree from 12 to 20
- **THEN** the portal's duration in the plan becomes 18 working days, and reporting and the plan's end move with it

### Requirement: Gantt rescheduling by drag
The user SHALL reschedule a task by dragging its bar with the pointer. The bar SHALL snap to working days and stop at the earliest start its predecessors allow, which SHALL show as a guide during the drag. Dropping it on its earliest start SHALL clear its requested start; Escape during the drag SHALL cancel it (EXPERIENCE Widgets, Gantt; F-24).

#### Scenario: Dragging past the predecessors
- **WHEN** the user drags reporting's bar to start before the portal ends
- **THEN** the bar stops at the day after the portal ends, the guide shows there, and dropping it changes nothing

#### Scenario: Dropping on a weekend
- **WHEN** the user drops reporting's bar with its start over Saturday 12/12/2026
- **THEN** reporting starts on Monday 12/14/2026

### Requirement: Gantt durations
In a Gantt with its own tasks, the user SHALL change a task's duration by dragging the end of its bar or by typing it in the grid, as whole working days, never below one (EXPERIENCE Widgets, Gantt).

#### Scenario: Resizing a bar
- **WHEN** the user drags the end of a 6-day task's bar two working days to the right
- **THEN** its duration is 8 working days, and its dependents move two working days later

#### Scenario: Below one day
- **WHEN** the user drags the end of a 1-day task's bar to the left
- **THEN** its duration stays 1 working day

### Requirement: Gantt editing in the grid
The user SHALL edit a task's start and, in a Gantt with its own tasks, its duration in the grid: Enter or F2 starts editing, Enter or leaving the field commits, Escape restores. A start SHALL be read by AskBoard's own en-US date parser, echoing the parsed day, and refused with a message when it is no date, not a working day, or before the earliest start; an empty start SHALL clear the request.

#### Scenario: Typing a start
- **WHEN** the user types `12/9/2026` in reporting's start and presses Enter
- **THEN** reporting starts on Wednesday 12/9/2026 and the draft holds the change

#### Scenario: A start the predecessors do not allow
- **WHEN** the user types `11/20/2026` in reporting's start and presses Enter
- **THEN** the field shows a message naming 12/4/2026 as the earliest start, keeps the focus, and the draft is unchanged

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
"Answer" SHALL send one answer message carrying each changed widget's full edited value and the Gantt's declared derived values as they stand, and nothing for an untouched Gantt. The question SHALL then be read-only (AD-10, AD-20, FR-12).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved answer's edits with the keyboard, in the Tree and in the plan, and presses "Answer"
- **THEN** one answer message leaves the view; the contract's diff of the sent and the edited plan equals the approved `schedule` operation, and its derived values are `schedule.finish` `2026-12-02` and `schedule.criticalPath` `ux`, `prototype`, `portal`, `reporting`

#### Scenario: Nothing changed
- **WHEN** a Gantt question opens and the user only zooms and moves the focus
- **THEN** "Answer" stays disabled

### Requirement: Gantt change highlight
A task the user changed SHALL take the change outline on its bar and the change fill on its changed cells; in a plan, a task the user added or re-estimated in its Tree SHALL be marked the same way, and a task that moved only because a predecessor moved SHALL NOT. The toolbar SHALL read "Changes vs agent's original · none yet", then "Your changes: N", counting each task changed in the Gantt once (FR-11; EXPERIENCE Change highlight).

#### Scenario: Counting changes
- **WHEN** the user, with `u-1` added in the Tree, moves reporting later and gives `u-1` two predecessors
- **THEN** both bars carry the change outline, the portal's does not, and the toolbar reads "Your changes: 2"

### Requirement: Gantt plan baseline
A Gantt plan SHALL draw under each task's bar the dates the agent's plan gave it, as sent, and SHALL draw none for a task the agent did not send (FR-12; DESIGN.md Molecules, Gantt plan).

#### Scenario: A baseline after a move
- **WHEN** the user moves reporting three working days later
- **THEN** reporting's baseline still spans 12/4/2026 to 12/11/2026 under its moved bar

#### Scenario: An added package
- **WHEN** the user adds `u-1` in the Tree
- **THEN** `u-1` has a bar and no baseline

### Requirement: Read-only Gantt
When its question is answered, being sent or locked, the Gantt SHALL stay readable, zoomable and navigable from the keyboard, and SHALL accept no edit: bars do not drag, cells do not edit and the predecessors panel does not open (AD-10, AD-21).

#### Scenario: After "Answer"
- **WHEN** the user has pressed "Answer" on a Gantt question
- **THEN** dragging a bar and pressing Enter on a start change nothing, and the zoom still works

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
Every question SHALL show its open prompt, "Note for the agent (optional)". Its text SHALL leave only with the question's answer or decline, or alone through "Answer", which sends it as a note and leaves the question open; never on typing or blur (FR-7, AD-20).

#### Scenario: A note without an answer
- **WHEN** the user writes only a note and presses "Answer"
- **THEN** a note is sent, and the question still counts as open

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
An option with a preview SHALL show "Show preview", which opens the preview below the option as plain text, one preview open at a time (FR-3; open question 9).

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
The board page SHALL arm the browser's leave-page prompt while the draft holds unsent work or postponed questions are open, and the bottom action bar SHALL then show "You have 1 postponed question: closing loses this ask", with the count (FR-25).

#### Scenario: Closing with a postponed question
- **WHEN** a question is postponed and the user closes the tab
- **THEN** the browser's prompt to leave the page appears first

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
"Answer" SHALL send one answer message carrying the full edited value of each changed item and the derived values of the Tree with `pert` and of the plan as they stand (AD-20, FR-12, F7).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved answer's `wbs` edits by keyboard on the expanded UJ-2 question and presses "Answer"
- **THEN** one answer message leaves the view, holding `wbs__tree` and `schedule__plan`; put in reference addressing by `ask-core`, its changes are the approved eight operations and its derived values the approved fourteen; and no CSP violation is reported
