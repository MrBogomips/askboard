# skills Specification

## Purpose
The skills capability is what AskBoard ships to teach Claude Code agents to ask through it: the `askboard` skill at the plugin root, generated from `contract` and `molecules`, checked against them in CI, and kept within a token budget (FR-29, FR-30, NFR-1, NFR-11, AD-6).

## Requirements

### Requirement: The shipped skill
The plugin SHALL ship one skill, `skills/askboard/SKILL.md` at the plugin root, whose frontmatter holds only `name` and `description`. The `name` SHALL be `askboard`, match its directory and conform to the Agent Skills specification; the `description` SHALL be 1 to 600 characters and say when to use AskBoard (AD-18, NFR-11).

#### Scenario: The skill's frontmatter
- **WHEN** the shipped `SKILL.md` is parsed
- **THEN** its frontmatter has exactly the keys `name` and `description`, `name` is `askboard`, and `description` is between 1 and 600 characters

#### Scenario: No tool permission granted
- **WHEN** the shipped skill's files are read
- **THEN** no frontmatter grants or pre-allows a tool

### Requirement: Skill files are generated
Every file under `skills/askboard/` SHALL be the output of the skill generator, run over `contract`, `molecules` and the generator's templates. The skill check SHALL fail, naming each file, when a shipped file differs from its generated form, a generated file is missing, or a file the generator does not produce is present (AD-6).

#### Scenario: A hand-edited reference
- **WHEN** a shipped reference file is edited by hand and the skill check runs
- **THEN** the check fails naming that file

#### Scenario: A file nobody generates
- **WHEN** an extra file is added under `skills/askboard/` and the skill check runs
- **THEN** the check fails naming that file

#### Scenario: A widget registered without regenerating
- **WHEN** a widget type is added to the registry and the skill check runs before the generator
- **THEN** the check fails naming the missing reference and `SKILL.md`

### Requirement: A reference for each widget type
For each registered widget type, in registry order, the skill SHALL hold one reference file giving when to use it, its props' shape and fields from its props schema, with the bounds of each branch of a field that takes one of several forms, any notes its registry entry gives, what its answer carries (edits, a result, derived values), and its example item, and `SKILL.md`'s item index SHALL list it with a link.

#### Scenario: The Tree's reference
- **WHEN** the generator runs on the shipped registry
- **THEN** a Tree reference exists, names every top-level field of the Tree's props schema, says that the answer carries the edited nodes and the derived values, and holds the Tree's example item

#### Scenario: The Gantt's two forms of tasks
- **WHEN** the generator runs on the shipped registry
- **THEN** the Gantt reference says when `tasks` is a list and when it maps a task ID of the Tree that `workPackages` names, and gives each form's bound

#### Scenario: A type without teaching text
- **WHEN** a registered type has no teaching text or no example
- **THEN** the generator fails naming the type

### Requirement: A reference for each ready molecule
For each ready molecule, the skill SHALL hold one reference file giving when to use it, its name and version, its parameters' fields from its parameter schema, and an example molecule reference, and `SKILL.md`'s item index SHALL list it with a link (FR-15). When the molecule's teaching data names a companion, the example SHALL be an ask whose question holds the companion's example reference under the ID the teaching data gives, then the molecule's own.

#### Scenario: The WBS with PERT
- **WHEN** the generator runs on the shipped molecules
- **THEN** the `wbs-pert` reference names the parameters `nodes` and `depth` and holds an example reference of type `molecule` naming `wbs-pert`

#### Scenario: The Gantt plan with its work breakdown
- **WHEN** the generator runs on the shipped molecules
- **THEN** the `gantt-plan` reference holds an ask example whose question holds a `wbs-pert` reference under the ID that `gantt-plan`'s teaching data names, then the `gantt-plan` reference

#### Scenario: A molecule without teaching data
- **WHEN** a ready molecule has no teaching data
- **THEN** the generator fails naming the molecule

### Requirement: A reference for the context items
The skill SHALL hold one reference for the context item types (excerpt, reference, image) with each one's fields from its props schema and an example, and SHALL say that screenshots are saved under `.askboard/media/` and pointed to (FR-8, AD-12).

#### Scenario: Context items listed
- **WHEN** the generator runs
- **THEN** the context reference names each context item type of the input format with its fields and one example each

### Requirement: Examples that validate
Every ask or item example in the shipped skill SHALL be accepted by `ask-core`'s send path with the shipped molecules, with no warning other than an unresolved pointer, and every result example SHALL pass its tool envelope's schema. A test SHALL fail, naming the file and example, otherwise (AD-6).

#### Scenario: Every shipped example accepted
- **WHEN** the examples test runs on the shipped skill
- **THEN** each ask and item example is accepted, and each result example validates

#### Scenario: An example that stops validating
- **WHEN** a schema change makes a shipped example invalid
- **THEN** the examples test fails naming the file and the example

### Requirement: Writing the skill
Writing the skill SHALL leave exactly the generated files under `skills/askboard/`, each file and folder in the generated name's case, also on a case-insensitive file system where a file or folder the generator does not produce differs from a generated one only in case. It SHALL refuse a generated name outside `skills/askboard/` before it removes or writes anything (AD-6, NFR-7).

#### Scenario: A file named like a generated one but for case
- **WHEN** `skills/askboard/skill.md` exists on a case-insensitive file system and the skill is written
- **THEN** the folder holds exactly the generated files, `SKILL.md` among them, and the skill check passes

#### Scenario: A folder named like a generated one but for case
- **WHEN** `skills/askboard/References/answers.md` and `skills/askboard/References/Widgets/tree.md` exist on a case-insensitive file system and the skill is written
- **THEN** the folder holds exactly the generated files and folders in their generated case, the skill check passes, and writing the skill again removes nothing

#### Scenario: A generated name outside the folder
- **WHEN** the generator produces a name that leaves `skills/askboard/` and a file nobody generates exists in the folder
- **THEN** writing the skill fails naming the generated name, and the extra file and every file outside the folder are unchanged

### Requirement: Routing between AskBoard and AskUserQuestion
`SKILL.md` SHALL define which questions go to AskBoard and which to AskUserQuestion: a question with references, a widget, more than four options, or several questions together goes to AskBoard; a yes/no or short choice without references goes to AskUserQuestion; a subagent asks every question through AskBoard; an asking rule overrides the choice (FR-29, FR-30).

#### Scenario: The routing section
- **WHEN** the generated `SKILL.md` is read
- **THEN** it holds the routing section with each of those cases

### Requirement: Asking-rule texts from the contract
`SKILL.md` SHALL state each asking rule of the contract's closed set with the contract's text for it, in the contract's order, and SHALL say that without hooks the rules are only advisory and the agent follows the rule the user set or asked for itself. It SHALL name no tool result as the source of the rule, since none carries it (FR-30, AD-16).

#### Scenario: The rules as the hook applies them
- **WHEN** the generated `SKILL.md` is read
- **THEN** it holds every rule name with its contract text, the `with-references` text being the one the hook's predicate is described by

#### Scenario: The advisory paragraph
- **WHEN** the generated `SKILL.md`'s paragraph after the rules is read
- **THEN** it says the rule is only advisory without hooks and that the agent follows the rule the user set or asked for, and it names no tool result

### Requirement: Every item type named
`SKILL.md` SHALL name, in backticks, every item type of the input format: each non-widget item type of the contract (questions, areas, molecule references and the context items) and each registered widget type, the latter in its item index line. It SHALL teach the area's shape and that areas stand at the top level only, holding questions, and that once one top-level item is an area every one is (FR-2, AD-6).

#### Scenario: Every type named
- **WHEN** the generator runs on the contract's non-widget item types and the shipped registry
- **THEN** each of those types is named in `SKILL.md` as `` `<type>` ``

#### Scenario: Areas taught
- **WHEN** the generated `SKILL.md` is read
- **THEN** it gives the area's shape `{type: "area", id, props: {title, items}}`, says areas stand at the top level only and hold questions, and says that once one top-level item is an area every one is

### Requirement: Cheap asks
`SKILL.md` SHALL teach putting several questions in one ask, pointing to project files instead of copying them, using molecules by name, leaving totals, estimates, dates and margins to AskBoard, and choosing ask IDs as a task slug plus a short random suffix and item IDs that match the contract's ID pattern (FR-1, FR-5, FR-8, NFR-1).

#### Scenario: The cheap-asking section
- **WHEN** the generated `SKILL.md` is read
- **THEN** it holds each of those rules and the ID pattern from the contract

### Requirement: Delivery and follow-ups
`SKILL.md` SHALL teach keeping working after `ask`, receiving answers by push or with `collect` and the latest cursor before finishing, ignoring an event whose `seq` was already seen, replying to follow-ups at once with `update`, recording an answer given in the terminal with `update`, and never opening or answering a board (FR-10, FR-21, AD-3).

#### Scenario: The delivery section
- **WHEN** the generated `SKILL.md` is read
- **THEN** it holds each of those rules

### Requirement: Ownership of an ask
`SKILL.md` SHALL teach that, with AskBoard's hooks, an ask belongs to the agent that sent it, which alone can collect, update, fetch or snapshot it, and that a subagent's ask closes when the subagent finishes, so an answer given later, such as a postponed one, is lost and the main conversation can neither collect nor snapshot it (FR-25, AD-5). Without the hooks ownership is not checked, as the `ask` result's warning says.

#### Scenario: The ownership line
- **WHEN** the generated `SKILL.md`'s "After you ask" section is read
- **THEN** it holds the ownership line, stated as holding with AskBoard's hooks, and says that a subagent's ask closes when the subagent finishes and that an answer given later is lost

### Requirement: Dialogues in a background subagent
`SKILL.md` SHALL say that the agent's own asks never block it, so it asks itself and keeps working, and SHALL advise a background subagent that asks, waits and returns the answers only for a side dialogue whose answers are needed together when the subagent ends (FR-21, FR-25, UJ-2).

#### Scenario: The background subagent kept to a side dialogue
- **WHEN** the generated `SKILL.md`'s "After you ask" section is read
- **THEN** it says the agent's own asks never block it, and it offers a background subagent only for a side dialogue whose answers are needed together at its end, never as the way to keep working while the user answers

### Requirement: When an ask cannot go on
`SKILL.md` SHALL teach that when `ask` returns `unavailable` or AskBoard's tools are absent, the main conversation asks through AskUserQuestion and a subagent ends its turn and returns the question to the agent that started it; that a declined question is not asked again in the task; and that a discarded ask is asked again under a new ID if still needed (FR-4, FR-29, NFR-8, AD-18).

#### Scenario: The fallback section
- **WHEN** the generated `SKILL.md` is read
- **THEN** it holds the main-conversation and subagent fallbacks, the declined rule and the discarded rule

### Requirement: Answers and Snapshots
The skill SHALL teach that answers carry only what changed and `fetch` returns a whole item, that an answer marked `tooLarge` carries no changes, derived values or results and `fetch` returns them, and that `snapshot` returns a file's path in the Snapshot folder, whose board data is in the element the contract names; it SHALL hold one `collect` result example (FR-20, FR-26, FR-27).

#### Scenario: Reading answers and Snapshots
- **WHEN** the generated answers reference is read
- **THEN** it names the Snapshot folder and data element from the contract and holds a `collect` result example

#### Scenario: A too-large answer
- **WHEN** the generated answers reference is read
- **THEN** it says that an answer marked `tooLarge` carries no changes, derived values or results, and that `fetch` returns them

### Requirement: The skill's token budget
The skill check SHALL fail when the description exceeds 600 characters, `SKILL.md` exceeds 9,000 characters or 250 lines, any reference exceeds 6,000 characters, or the always-loaded total (the compact tool definitions, the server instructions and the skill's name and description) exceeds 8,400 characters (NFR-1, PRD R5).

#### Scenario: A reference over budget
- **WHEN** a generated reference exceeds 6,000 characters
- **THEN** the skill check fails naming the file, its size and the budget

#### Scenario: The always-loaded total
- **WHEN** the skill check runs on the shipped skill
- **THEN** it prints the always-loaded total and passes only when it is at most 8,400 characters

### Requirement: The benchmark arm loads the skill
The benchmark's AskBoard arm SHALL include the Skill tool among its tools and SHALL allow only AskBoard's skill, `Skill(askboard:askboard)`, never every skill; every arm SHALL run with Claude Code's bundled skills switched off; the tools of the AskUserQuestion and baseline arms SHALL be unchanged (NFR-1, AD-17, PRD R5).

#### Scenario: The AskBoard arm's tools
- **WHEN** the benchmark builds the AskBoard arm's command
- **THEN** its tools include `Skill`, its allowed tools include `Skill(askboard:askboard)` and no bare `Skill`, and the other arms' tools and allowed tools hold no `Skill`

#### Scenario: Bundled skills switched off
- **WHEN** the benchmark builds any arm's command
- **THEN** its environment switches Claude Code's bundled skills off

### Requirement: The benchmark reports the skills loaded
The benchmark report SHALL list the skills each arm's sessions started with and flag a run whose listing holds a skill other than AskBoard's, so that the context the skill adds is what the benchmark measures (AD-17, PRD R5).

#### Scenario: Another skill in the listing
- **WHEN** a run's init event lists a skill other than `askboard:askboard`
- **THEN** the report lists that skill for the run's arm and flags the run
