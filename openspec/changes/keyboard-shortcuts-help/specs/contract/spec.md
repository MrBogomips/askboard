## ADDED Requirements

### Requirement: Key tables in the registry
A widget type's registry entry MAY carry a key table: for each action, the part it acts in, its keys with their modifiers, the board string naming it, its visible counterpart and whether it needs a selection. The registry check SHALL refuse, naming the type and the action, a table that gives a vocabulary action other keys than the vocabulary's, binds one key twice in one part, or binds a key the browser or the system needs (NFR-12).

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

### Requirement: Widget types without a key table
Every shipped widget type without a key table SHALL be listed with the reason it has none: only keys the browser, Radix or the WAI-ARIA radio group define; no keys of its own; or the later change that adds its table. A type added to the registry SHALL carry a key table or such a line (NFR-12).

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
