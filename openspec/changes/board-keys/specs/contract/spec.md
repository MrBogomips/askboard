## ADDED Requirements

### Requirement: The board's key table
The contract SHALL hold the board's own key table, checked like a widget type's under the name `board`: next open question `N`, previous open question `Shift+N`, answer the question in focus `Cmd` or `Ctrl` with Enter, and the keys panel `?`, in the part that acts across the board's controls, and send a follow-up `Cmd` or `Ctrl` with Enter in the composer's editor part. A widget type SHALL not be named `board` (NFR-12).

#### Scenario: The shipped table
- **WHEN** the registry's table check runs on the board's key table
- **THEN** it reports no problem, and the table binds next open to `N`, previous open to `Shift+N`, answer to `Cmd` or `Ctrl` with Enter, the keys panel to `?`, and send a follow-up to `Cmd` or `Ctrl` with Enter in another part

#### Scenario: Cmd or Ctrl with Enter in a table
- **WHEN** the registry's table check runs on an entry whose table binds `Cmd` or `Ctrl` with Enter, then one that binds `Cmd` or `Ctrl` with W
- **THEN** it reports no problem for the first and a problem naming the type and the key for the second

#### Scenario: A widget type named board
- **WHEN** a widget type named `board` is added to the registry and the contract's tests run
- **THEN** a test fails naming the type

### Requirement: Board keys a native control takes
The key-override check SHALL refuse giving an action of the board's part, which acts across buttons, options and links, a key a native control takes with no modifier or Shift alone (Enter, Space, Escape, the arrows, Home, End, Page Up, Page Down, Delete, Backspace), as it refuses it for the keys panel, and SHALL report a conflict between two actions of that part on one key once applied (NFR-12, NFR-10).

#### Scenario: Enter for the next open question
- **WHEN** the overrides give next open `Enter`
- **THEN** the check reports a problem naming next open and the combination

#### Scenario: Two board actions on one key
- **WHEN** the overrides give next open `Shift+n`
- **THEN** the check reports a conflict naming next open, the combination and previous open

#### Scenario: A board key on the keys panel's key
- **WHEN** the overrides give previous open `?`
- **THEN** the check reports a conflict naming previous open, the combination and the keys panel

#### Scenario: A board key a widget also takes
- **WHEN** the overrides give answer `Mod+Shift+Enter`, the key of a Tree's add a child
- **THEN** the check reports no problem, since the board's keys never act inside a widget

## MODIFIED Requirements

### Requirement: The override check's default tables
Given no tables, the key-override check SHALL read the board's key table and exactly the key tables the registry holds, from a list of those tables alone, so that `ask-core` and the board page run one check on the same tables without loading the registry's other data (NFR-10, AD-1).

#### Scenario: The check's own tables
- **WHEN** the check runs with no tables given
- **THEN** it reads the board's key table and each registered type that has a key table, with that table, and no other, and reports what it reports given the board's table and the registry's types

#### Scenario: A board action in the user's keys
- **WHEN** the check runs with no tables given on overrides that give next open `j` and send a follow-up no key
- **THEN** it reports no problem, and the actions whose keys in effect differ from their defaults are next open and send a follow-up
