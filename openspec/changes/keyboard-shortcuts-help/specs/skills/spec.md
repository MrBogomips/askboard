## MODIFIED Requirements

### Requirement: The shipped skill
The plugin SHALL ship two skills at the plugin root, `skills/askboard/SKILL.md` and `skills/askboard-help/SKILL.md`, whose frontmatter holds `name` and `description` and, for `askboard-help` only, MAY hold `disallowed-tools`. Each `name` SHALL match its directory and conform to the Agent Skills specification; `askboard`'s description SHALL say when to use AskBoard, and `askboard-help`'s when the user asks how to use the board (AD-18, NFR-11).

#### Scenario: The skill's frontmatter
- **WHEN** the shipped `SKILL.md` files are parsed
- **THEN** `askboard`'s frontmatter has exactly `name` `askboard` and `description`, and `askboard-help`'s has `name` `askboard-help`, `description` and at most `disallowed-tools`

#### Scenario: No tool permission granted
- **WHEN** the shipped skills' files are read
- **THEN** no frontmatter grants or pre-allows a tool

### Requirement: Skill files are generated
Every file under `skills/askboard/` and `skills/askboard-help/` SHALL be the output of the skill generator, run over `contract`, `molecules`, the board's English strings and the generator's templates. The skill check SHALL fail, naming each file, when a shipped file of either folder differs from its generated form, a generated file is missing, or a file the generator does not produce is present (AD-6).

#### Scenario: A hand-edited reference
- **WHEN** a shipped reference file is edited by hand and the skill check runs
- **THEN** the check fails naming that file

#### Scenario: A hand-edited help reference
- **WHEN** a file under `skills/askboard-help/` is edited by hand and the skill check runs
- **THEN** the check fails naming that file

#### Scenario: A file nobody generates
- **WHEN** an extra file is added under `skills/askboard/` or `skills/askboard-help/` and the skill check runs
- **THEN** the check fails naming that file

#### Scenario: A widget registered without regenerating
- **WHEN** a widget type is added to the registry and the skill check runs before the generator
- **THEN** the check fails naming the missing references and each `SKILL.md`

### Requirement: The skill's token budget
The skill check SHALL fail when `askboard`'s description exceeds 600 characters, its `SKILL.md` 9,000 characters or 250 lines, or a reference 6,000 characters; when `askboard-help`'s description exceeds 400 characters, its `SKILL.md` 6,000 characters or 150 lines, or a reference 4,000 characters; or when the always-loaded total, the compact tool definitions, the server instructions and both skills' names and descriptions, exceeds 8,400 characters (NFR-1, PRD R5).

#### Scenario: A reference over budget
- **WHEN** a generated reference of `askboard` exceeds 6,000 characters, or one of `askboard-help` exceeds 4,000
- **THEN** the skill check fails naming the file, its size and the budget

#### Scenario: The always-loaded total
- **WHEN** the skill check runs on the shipped skills
- **THEN** it prints the always-loaded total, counting both skills' names and descriptions, and passes only when it is at most 8,400 characters

### Requirement: The benchmark reports the skills loaded
The benchmark report SHALL list the skills each arm's sessions started with and flag a run whose listing holds a skill other than AskBoard's two, `askboard:askboard` and `askboard:askboard-help`, so that the context AskBoard's skills add is what the benchmark measures; the AskBoard arm SHALL still allow only `Skill(askboard:askboard)` (AD-17, PRD R5).

#### Scenario: Another skill in the listing
- **WHEN** a run's init event lists a skill other than AskBoard's two
- **THEN** the report lists that skill for the run's arm and flags the run

#### Scenario: The help skill in the listing
- **WHEN** a run's init event lists `askboard:askboard` and `askboard:askboard-help`
- **THEN** the report lists both and flags nothing

## ADDED Requirements

### Requirement: The help skill
`askboard-help` SHALL answer the user's questions on using the board, in the user's language: for each widget type, what it is for, how it is edited with the mouse and, given a key table, the keys, and what the agent receives; and the board's concepts, the standard keys of options and fields among them. It SHALL tell the agent to answer in the terminal from its files, never to call AskBoard's tools or open a board for it, and SHALL hold no ask example (FR-29, NFR-12).

#### Scenario: Every widget type
- **WHEN** the generator runs on the shipped registry
- **THEN** `askboard-help` holds one reference per registered type and one per ready molecule, each holding the type's or the molecule's help text

#### Scenario: The board's concepts
- **WHEN** `askboard-help`'s `SKILL.md` is read
- **THEN** it explains postponing, declining, follow-up questions, "Keep mine" and "Reload", Snapshots, the board's language and live updates

#### Scenario: Never through AskBoard
- **WHEN** `askboard-help`'s files are read
- **THEN** they tell the agent not to call `ask`, `update`, `collect`, `fetch` or `snapshot` and hold no item or ask example

### Requirement: The help skill's references one level deep
`askboard-help`'s `SKILL.md` SHALL link each of its references, and no other file of the skill SHALL link a file of the skill, as in `askboard` (NFR-1, NFR-11).

#### Scenario: Every reference linked from SKILL.md
- **WHEN** the generated files of `askboard-help` are read
- **THEN** every file other than `SKILL.md` is the target of a link in `SKILL.md`, and no file other than `SKILL.md` links to a file of the skill

#### Scenario: A molecule's reference
- **WHEN** `askboard-help`'s reference of the Gantt plan is read
- **THEN** it holds the molecule's help text and names the widget types it expands into, without a link

### Requirement: Keys from the key tables
For each widget type with a key table, `askboard`'s widget reference and `askboard-help`'s SHALL list its default keys from the table, each action by its English board string and each key as on Linux, with the macOS form beside it, so that a table changed without regenerating fails the skill check (NFR-12, AD-6).

#### Scenario: The Ranking's keys
- **WHEN** the generator runs on the shipped registry
- **THEN** both Ranking references list "Move up" with Alt+Shift+↑ and ⌥⇧↑, "To top" with Alt+Shift+Home and Ctrl+Shift+↑, ⌥⇧Home and ⇧⌘↑, and "Keep this order" with Enter and ↩

#### Scenario: A table changed without regenerating
- **WHEN** a key table changes and the skill check runs before the generator
- **THEN** the check fails naming the two references of that type

### Requirement: The keys panel only where the board shows it
For a widget type whose chunk registers its key table with the board, as the contract's list of such types records, both skills' references SHALL say that the board's keys panel shows the keys in effect; for any other type with a key table they SHALL say that the board shows no keys panel for it yet and that the user's key changes do not reach it, and SHALL claim neither (NFR-12, FR-29).

#### Scenario: The keys panel where the board shows it
- **WHEN** the generator runs on the shipped registry, the Ranking being the type whose chunk registers its key table
- **THEN** both Ranking references say that the board's keys panel shows the keys in effect

#### Scenario: A table the board does not show yet
- **WHEN** the generator runs on the shipped registry
- **THEN** both Gantt references list the Gantt's default keys, say that the board shows no keys panel for the Gantt yet and that the user's key changes do not reach it, and make no unconditional claim of a keys panel

### Requirement: The asking skill points to the help skill
`askboard`'s `SKILL.md` SHALL tell the agent that a question the user asks in the terminal about using the board, its widgets or its keys goes to the `askboard-help` skill, never into an ask. A usage question that arrives as a follow-up on the board SHALL be answered on the board at once with `update`, from `askboard`'s own files or `askboard-help`'s files read as files, without loading `askboard-help`, since loading it takes `update` away for the turn (FR-10, FR-29).

#### Scenario: A usage question
- **WHEN** `askboard`'s `SKILL.md` is read
- **THEN** it names `askboard-help` for questions on using the board asked in the terminal

#### Scenario: A usage question as a follow-up
- **WHEN** `askboard`'s `SKILL.md` is read
- **THEN** it tells the agent to reply to a usage question asked as a follow-up with `update` at once, without loading `askboard-help`, and no line of it sends a follow-up to `askboard-help`

### Requirement: The help skill teaches the key configuration
`askboard-help` SHALL explain where the user's key overrides go, how they are written, the rules they meet, what a refused file does, that a project file's overrides are ignored, and where and when they apply, naming the widget types whose chunk registers its key table with the board as the only ones they reach. It SHALL list every action an override may name with its default keys, generated from the key tables, and each of its examples SHALL pass the key-override check (NFR-12, FR-29, AD-14).

#### Scenario: Where the user's keys apply
- **WHEN** `askboard-help`'s key configuration reference is read
- **THEN** it names the Ranking as the widget the user's keys reach, and no other widget type

#### Scenario: When the user's keys apply
- **WHEN** `askboard-help`'s key configuration reference is read
- **THEN** it says that a change applies to boards opened afterwards and that an open board may take it when it reconnects or after a change in its settings panel, and never that an open board keeps its keys

#### Scenario: Every action
- **WHEN** the generator runs on the shipped registry
- **THEN** `askboard-help` lists every vocabulary action and every own action a key table binds, each with its default keys in the Linux and the macOS form

#### Scenario: Examples the check accepts
- **WHEN** the generator runs with an example of overrides that the key-override check refuses
- **THEN** it fails naming the example and the problem

### Requirement: The help skill writes only the user file
`askboard-help` SHALL tell the agent to write key overrides into the user file only when the user asks, keeping the file's other keys, and never into the project file (AD-14, NFR-5).

#### Scenario: The user file, on the user's request
- **WHEN** `askboard-help`'s `SKILL.md` is read
- **THEN** it tells the agent to write key overrides only into the user file, only when the user asks, keeping the file's other keys, and never into the project file
