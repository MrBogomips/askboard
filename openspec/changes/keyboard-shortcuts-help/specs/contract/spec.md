## ADDED Requirements

### Requirement: Key tables in the registry
A widget type's registry entry MAY carry a key table: for each action, the part it acts in, its keys, the board string naming it, its visible counterpart, whether it acts while the item takes no edits, and whether it needs a selection. The registry check SHALL refuse, naming the type and the action, a table that gives a vocabulary action other keys than the vocabulary's, binds one key twice in one part, or binds a key the browser or the system needs (NFR-12).

#### Scenario: The shipped tables
- **WHEN** the registry check runs on the shipped registry
- **THEN** it passes, and the Tree, the Gantt, the Ranking, the Kanban, the Timeline and the Chart each carry a key table

#### Scenario: Another key for a vocabulary action
- **WHEN** the registry check runs on an entry whose table binds the vocabulary's move up to Ctrl+ArrowUp
- **THEN** it reports a problem naming the type and the action

#### Scenario: The keys the PO approved
- **WHEN** the registry check runs on an entry whose table binds add after to Alt+Shift+Enter, select all to Cmd or Ctrl+A, select none to Escape on a selection, and adjust by percentage to `%` on a selection
- **THEN** it reports no problem

#### Scenario: A key the browser needs
- **WHEN** the registry check runs on an entry whose table binds Alt+ArrowLeft, Tab, or Cmd or Ctrl with W
- **THEN** it reports a problem naming the type and the key

#### Scenario: One key twice
- **WHEN** the registry check runs on an entry whose table binds Space to two actions in the same part
- **THEN** it reports a problem naming the type and the key, and still reports the other entries' problems

### Requirement: Keys on an item that takes no edits
Each key table entry SHALL say whether its keys still act while the item takes no edits (answered, locked, read-only, a Snapshot), as the widget does; that, and not the entry's visible counterpart, SHALL decide what a read-only widget's keys panel lists. The registry check SHALL refuse an action that changes the answer marked as acting then (NFR-12, NFR-10).

#### Scenario: A move that acts on a read-only item
- **WHEN** the registry check runs on an entry whose table marks move up as acting while the item takes no edits
- **THEN** it reports a problem naming the type and move up

#### Scenario: The Gantt's column edge
- **WHEN** the Gantt's key table is read
- **THEN** its column edge's keys act while the item takes no edits, and its cell editor's and predecessors panel's do not

#### Scenario: A toolbar whose every tool is off
- **WHEN** the Ranking's, the Kanban's and the Timeline's key tables are read
- **THEN** their toolbars' arrow, Home and End keys do not act while the item takes no edits, since every tool of those toolbars is then off, and their cursor keys do

### Requirement: Key tables list every tool
A key table SHALL list every tool and menu of its widget's toolbar that acts on the content or the selection; one that no key takes SHALL be an entry of the type's own with no keys. The registry check SHALL refuse a vocabulary action with no keys (NFR-12).

#### Scenario: A tool with no key
- **WHEN** the registry check runs on an entry whose table lists a tool of the type's own with no keys, then the vocabulary's move up with no keys
- **THEN** it reports no problem for the first and a problem naming the type and move up for the second

#### Scenario: The Timeline's tools
- **WHEN** the Timeline's key table is read
- **THEN** it lists "Move earlier", "Move later" and "Move to lane…" with no keys

### Requirement: Widget types without a key table
Every shipped widget type without a key table SHALL be listed with the reason it has none: only keys the browser or an adopted library documents, or the WAI-ARIA radio group defines; no keys of its own; or the later change that adds its table. A type added to the registry SHALL carry a key table or such a line (NFR-12).

#### Scenario: The shipped types
- **WHEN** the contract's tests run on the shipped registry
- **THEN** every type without a key table is listed with its reason, the LaTeX, the Table and the Document review with the change that adds their tables

#### Scenario: A type registered without keys or a reason
- **WHEN** a type with no key table and no listed reason is added to the registry and the contract's tests run
- **THEN** a test fails naming the type

### Requirement: Help text of a widget type
A widget type's registry entry MAY carry help text for the user: how the widget is edited with the mouse, and what the agent receives, each 1 to 300 characters. The registry check SHALL refuse help text outside those bounds or of another shape, naming the type, and every shipped type SHALL carry it (FR-29).

#### Scenario: Shipped types carry help text
- **WHEN** the shipped registry is read
- **THEN** every entry, the Table and the Document review included, has help text for the mouse and for what the agent receives, each of 1 to 300 characters

#### Scenario: Help text too long
- **WHEN** the registry check runs on an entry whose mouse help has 301 characters
- **THEN** it reports a problem naming the type
