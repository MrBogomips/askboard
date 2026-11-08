## ADDED Requirements

### Requirement: Key tables in the registry
A widget type's registry entry MAY carry a key table: for each action, the part of the widget it acts in, its keys with their modifiers, the board string naming it and its visible counterpart. The registry check SHALL refuse, naming the type and the action, a table that gives an action of the shared key vocabulary other keys than the vocabulary's, binds one key twice in one part, or binds a key the browser or the system needs (NFR-12).

#### Scenario: The shipped tables
- **WHEN** the registry check runs on the shipped registry
- **THEN** it passes, and the Tree, the Gantt, the Ranking, the Kanban, the Timeline and the Chart each carry a key table

#### Scenario: Another key for a vocabulary action
- **WHEN** the registry check runs on an entry whose table binds the vocabulary's move up to Ctrl+ArrowUp
- **THEN** it reports a problem naming the type and the action

#### Scenario: A key the browser needs
- **WHEN** the registry check runs on an entry whose table binds Alt+ArrowLeft, Tab, or Cmd or Ctrl with W
- **THEN** it reports a problem naming the type and the key

#### Scenario: One key twice
- **WHEN** the registry check runs on an entry whose table binds Space to two actions in the same part
- **THEN** it reports a problem naming the type and the key, and still reports the other entries' problems

### Requirement: Help text of a widget type
A widget type's registry entry MAY carry help text for the user: how the widget is edited with the mouse, and what the agent receives, each 1 to 300 characters. The registry check SHALL refuse help text outside those bounds or of another shape, naming the type, and every shipped type SHALL carry it (FR-29).

#### Scenario: Shipped types carry help text
- **WHEN** the shipped registry is read
- **THEN** every entry has help text for the mouse and for what the agent receives, each of 1 to 300 characters

#### Scenario: Help text too long
- **WHEN** the registry check runs on an entry whose mouse help has 301 characters
- **THEN** it reports a problem naming the type
