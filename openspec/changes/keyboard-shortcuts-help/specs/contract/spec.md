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

### Requirement: The key-override notation
The contract SHALL read a key combination written as `Mod`, `Alt` and `Shift`, each at most once, joined by `+` to a key name, `Mod` standing for Cmd or Ctrl. `Mod` with `Alt` SHALL be admitted in the user's overrides only, on ArrowUp, ArrowDown, Home, End and Enter, and the registry check SHALL refuse it in a key table (NFR-12).

#### Scenario: Mod with Alt in a table
- **WHEN** the registry check runs on an entry whose table binds `Mod+Alt+ArrowUp`
- **THEN** it reports a problem naming the type and the key

#### Scenario: A modifier the notation lacks
- **WHEN** the combination `Ctrl+Alt+ArrowUp` is read
- **THEN** it is refused, naming `Ctrl`

### Requirement: User key overrides and their check
The contract SHALL check the user's overrides against every registered key table once applied: each action known and not taken by a Radix or browser control, each combination admitted by the tables or the notation, no two actions of one part on one key, and no exit left without a key. A combination written twice for one action SHALL count once. Each problem SHALL name the action and the combination, and a conflict both actions (NFR-12, NFR-10).

#### Scenario: The PO's example
- **WHEN** the overrides give to the top `Mod+Alt+ArrowUp`, to the bottom `Mod+Alt+ArrowDown`, and select all no key
- **THEN** the check reports no problem

#### Scenario: Two actions on one key
- **WHEN** the overrides give to the top `Alt+Shift+ArrowUp`
- **THEN** the check reports a conflict naming to the top, the combination and move up

#### Scenario: A key the browser needs
- **WHEN** the overrides give the keys panel `F1`, or undo `Mod+w`
- **THEN** the check reports a problem naming the action and the combination

#### Scenario: A combination written twice
- **WHEN** the overrides give to the top `Mod+Alt+ArrowUp` twice
- **THEN** the check reports no problem, and the effective table holds that key once

#### Scenario: An exit without a key
- **WHEN** the overrides give cancel an edit no key
- **THEN** the check reports a problem naming cancel an edit

#### Scenario: An action nobody binds
- **WHEN** the overrides name `__proto__` or `ranking.teleport`
- **THEN** the check reports a problem naming it, and the vocabulary's add after, which no shipped table binds yet, passes

### Requirement: Keys a system composes or an editor types
The registry check and the key-override check SHALL refuse Alt with Shift on a key that types a character (a letter of any script, a digit, punctuation, a symbol or Space), which macOS composes into another character, and, in a part that edits text, a key that types a character. The key-override check SHALL also refuse giving the keys panel, which acts across the whole item, a key a native control takes or a key another action of any part takes (NFR-12).

#### Scenario: In a key table
- **WHEN** the registry check runs on an entry whose table binds Alt+Shift+K, Alt+Shift+1, Alt+Shift+é or Alt+Shift+Space, or whose editor part binds E, 1 or é with no modifier
- **THEN** it reports a problem naming the type and the key

#### Scenario: A combination macOS composes
- **WHEN** the overrides give select all `Alt+Shift+a`, or keep this order `Alt+Shift+Space`
- **THEN** the check reports a problem naming the action and the combination

#### Scenario: A letter in an editor
- **WHEN** the overrides give commit an edit `e`
- **THEN** the check reports a problem naming commit an edit and the combination

#### Scenario: The keys panel on a key a control takes
- **WHEN** the overrides give the keys panel `Enter`, or `Mod+z`
- **THEN** the check reports a problem naming the keys panel and the combination, and for `Mod+z` a conflict naming undo, though undo acts in another part

### Requirement: The effective key table
Applying the user's overrides to a key table SHALL replace the keys of each entry whose action they name with the override's, remove them for an empty list, and change nothing else of the entry; an override for an action the table lacks, for keys a Radix or browser control takes, or holding a combination that does not parse SHALL change nothing (NFR-12).

#### Scenario: Replacing and removing
- **WHEN** the overrides give to the top `Mod+Alt+ArrowUp` and select none no key, and are applied to the Ranking's table
- **THEN** to the top has only that key, select none has none, and every other entry, and every other member of those two, is unchanged

## MODIFIED Requirements

### Requirement: The configuration schema set
The contract SHALL hold the `configuration` schema set, owned by `ask-core`, starting at `1.0`, for both configuration files (AD-7, AD-14). A file SHALL name its `version` as `major.minor`. It SHALL allow `theme` (`system`, `light`, `dark`), `density` (`compact`, `comfortable`), `contextPlacement` (`beside`, `inline`), `defaultLanguage` (`en-US`, `it-IT`), `askingRule` (`none`, `always`, `with-references`), `snapshotFolder`, `editor`, `defaultMinimumMargin` and `keys`, each optional. `keys` SHALL map at most 64 actions to at most 4 combinations each; the schema SHALL bound its shape, and the key-override check its meaning.

#### Scenario: A file with every key validates
- **WHEN** the fixture holding the set's current version and one valid value for each of the nine keys is validated against the configuration schema
- **THEN** it passes

#### Scenario: A value outside a key's set is refused, naming the key
- **WHEN** a file sets `theme` to `"sepia"` or `askingRule` to `"sometimes"`
- **THEN** validation fails with a problem whose path names that key

#### Scenario: A file without its version is refused
- **WHEN** a file holds `{"theme": "dark"}`
- **THEN** validation fails, naming `version`

#### Scenario: An unknown key passes the schema
- **WHEN** a file holds `version` `1.0` and a key `fontSize`
- **THEN** the schema passes it, and the contract's list of configuration keys does not hold `fontSize`

#### Scenario: Keys of another shape
- **WHEN** a file sets `keys` to a list, or gives an action a combination that is not a string
- **THEN** validation fails with a problem whose path names `keys`

#### Scenario: A key the check refuses passes the schema
- **WHEN** a file sets `keys` to give the keys panel `F1`
- **THEN** the schema passes it, and the key-override check refuses it

### Requirement: Settings messages on the board protocol
The board protocol SHALL add the message `settings`, host to page, carrying the presentation and behaviour settings in effect and the user's key overrides, each with its value and the file and key that set it, and with warnings that name, for overrides not applied, the rule, the action and the combination; and `setting`, page to host, carrying one key and one value. The schema of `setting` SHALL admit only the presentation keys, each with a value the configuration schema allows (AD-14).

#### Scenario: A presentation write validates
- **WHEN** the page sends `setting` with `key` `density` and `value` `comfortable`
- **THEN** the message passes the board-protocol schema

#### Scenario: Any other key fails the schema
- **WHEN** the page sends `setting` with `key` `editor`, `askingRule`, `snapshotFolder` or `keys`, or with `theme` set to `"sepia"`
- **THEN** the message fails the board-protocol schema

#### Scenario: The user's keys in the settings
- **WHEN** `settings` carries the user's key overrides from the user file, or none with a warning naming a conflict's rule, action, combination and other action
- **THEN** the message passes the board-protocol schema, and a settings message of the previous minor, without them, passes too

#### Scenario: Keys that no board may receive
- **WHEN** `settings` carries a `keys` row with the other file's value, or a row from the default with a value, or a row from the user file with no value
- **THEN** the message fails the board-protocol schema
