## ADDED Requirements

### Requirement: The board's keys in the help skill
`askboard-help` SHALL list the board's own keys from the board's key table: each action by its English board string, where it acts, and its default keys as on Linux with the macOS form beside it, and SHALL say that they do nothing in a text field or inside a widget, apart from the follow-up's send, and that sending all held answers has no key, so that a board table changed without regenerating fails the skill check (NFR-12, FR-29).

#### Scenario: The board's keys
- **WHEN** the generator runs on the shipped registry and the board's key table
- **THEN** `askboard-help` lists the next open question with N, the previous with Shift+N and ⇧N, answering the question in focus with Ctrl+Enter and ⌘↩, sending a follow-up from the composer with Ctrl+Enter and ⌘↩, and says that sending all held answers has no key

#### Scenario: A board table changed without regenerating
- **WHEN** the board's key table changes and the skill check runs before the generator
- **THEN** the check fails naming the help skill's file that lists the board's keys

#### Scenario: Within the help skill's budgets
- **WHEN** the generator writes `askboard-help` with the board's keys
- **THEN** every file of the skill stays within the help skill's budgets, which this change leaves as they are

## MODIFIED Requirements

### Requirement: The help skill teaches the key configuration
`askboard-help` SHALL explain where the user's key overrides go, how they are written, the rules they meet, what a refused file does, that a project file's overrides are ignored, and where and when they apply, naming the board's own keys and the widget types whose chunk registers its key table with the board as the only ones they reach. It SHALL list every action an override may name with its default keys, generated from the key tables, the board's included, and each of its examples SHALL pass the key-override check (NFR-12, FR-29, AD-14).

#### Scenario: Where the user's keys apply
- **WHEN** `askboard-help`'s key configuration reference is read
- **THEN** it names the board's own keys and the Ranking as what the user's keys reach, and no other widget type

#### Scenario: When the user's keys apply
- **WHEN** `askboard-help`'s key configuration reference is read
- **THEN** it says that a change applies to boards opened afterwards and that an open board may take it when it reconnects or after a change in its settings panel, and never that an open board keeps its keys

#### Scenario: Every action
- **WHEN** the generator runs on the shipped registry
- **THEN** `askboard-help` lists every vocabulary action and every own action a key table binds, the board's table included, each with its default keys in the Linux and the macOS form

#### Scenario: Examples the check accepts
- **WHEN** the generator runs with an example of overrides that the key-override check refuses
- **THEN** it fails naming the example and the problem
