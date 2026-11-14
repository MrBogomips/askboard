# skills Specification

## Purpose
The skills capability is what AskBoard ships to teach Claude Code agents to ask through it: the `askboard` skill at the plugin root, generated from `contract` and `molecules`, checked against them in CI, and kept within a token budget (FR-29, FR-30, NFR-1, NFR-11, AD-6).

## Requirements

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

### Requirement: A reference for each widget type
For each registered widget type, in registry order, the skill SHALL hold one reference file giving when to use it, its props' shape and fields from its props schema, with the bounds of each branch of a field that takes one of several forms, any notes its registry entry gives, what its answer carries (edits, a result, derived values), and its example item; the item catalogue SHALL list it with its use, and `SKILL.md` SHALL link its reference.

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
For each ready molecule, the skill SHALL hold one reference file giving when to use it, its name and version, its parameters' fields from its parameter schema, and an example molecule reference; the item catalogue SHALL list it with its use, and `SKILL.md` SHALL link its reference (FR-15). When the molecule's teaching data names a companion, the example SHALL be an ask whose question holds the companion's example reference under the ID the teaching data gives, then the molecule's own.

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
`SKILL.md` SHALL route by the question's cognitive and contextual complexity, never by a count of questions or options, give its cases as examples and leave the agent to judge whether a visual, interactive board helps. A simple, self-explanatory choice goes to AskUserQuestion, a subagent asks through AskBoard, and an asking rule or the user's instruction overrides (FR-29, FR-30).

#### Scenario: The routing section
- **WHEN** the generated `SKILL.md` is read
- **THEN** its routing section says to choose by how hard the question is to grasp and to answer, names as cases many interconnected questions, questions that cite documents by bare IDs and content that reads better as a visual artifact, says they are examples and the agent judges, sends a simple, self-explanatory choice to AskUserQuestion, makes a subagent ask every question through AskBoard, and lets an asking rule and the user's instruction override

#### Scenario: No count
- **WHEN** the generated routing section is read
- **THEN** it routes by no number of questions or options: it holds neither "more than four" nor "several questions" as a case

#### Scenario: Why the board
- **WHEN** the generated routing section is read
- **THEN** it says that on the board the user sees the context beside the question, works on it and asks follow-ups while the agent keeps working

#### Scenario: Not in chat prose
- **WHEN** the generated routing section is read
- **THEN** it tells the agent never to put a complex question to the user in chat prose, and to ask it on the board

### Requirement: Asking-rule texts from the contract
`SKILL.md` SHALL state each asking rule of the contract's closed set with the contract's text for it, in the contract's order, and SHALL say that without hooks the rules are only advisory and the agent follows the rule the user set or asked for itself. It SHALL name no tool result as the source of the rule, since none carries it (FR-30, AD-16).

#### Scenario: The rules as the hook applies them
- **WHEN** the generated `SKILL.md` is read
- **THEN** it holds every rule name with its contract text, the `with-references` text being the one the hook's predicate is described by

#### Scenario: The advisory paragraph
- **WHEN** the generated `SKILL.md`'s paragraph after the rules is read
- **THEN** it says the rule is only advisory without hooks and that the agent follows the rule the user set or asked for, and it names no tool result

### Requirement: Every item type named
`SKILL.md` SHALL name, in backticks, every item type of the input format: each non-widget item type of the contract (questions, areas, molecule references and the context items) and each registered widget type, the latter as the text of the link to its reference. It SHALL teach the area's shape and that areas stand at the top level only, holding questions, and that once one top-level item is an area every one is (FR-2, AD-6).

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
The skill check SHALL fail when `askboard`'s description exceeds 600 characters, its `SKILL.md` 9,000 characters or 250 lines, or a reference 6,000 characters; when `askboard-help`'s description exceeds 400 characters, its `SKILL.md` 6,000 characters or 150 lines, or a reference 4,000 characters; or when the always-loaded total, the compact tool definitions, the server instructions and both skills' names and descriptions, exceeds 8,400 characters (NFR-1, PRD R5).

#### Scenario: A reference over budget
- **WHEN** a generated reference of `askboard` exceeds 6,000 characters, or one of `askboard-help` exceeds 4,000
- **THEN** the skill check fails naming the file, its size and the budget

#### Scenario: The always-loaded total
- **WHEN** the skill check runs on the shipped skills
- **THEN** it prints the always-loaded total, counting both skills' names and descriptions, and passes only when it is at most 8,400 characters

### Requirement: The benchmark arm loads the skill
The benchmark's AskBoard arm SHALL include the Skill tool among its tools and SHALL allow only AskBoard's skill, `Skill(askboard:askboard)`, never every skill; every arm SHALL run with Claude Code's bundled skills switched off; the tools of the AskUserQuestion and baseline arms SHALL be unchanged (NFR-1, AD-17, PRD R5).

#### Scenario: The AskBoard arm's tools
- **WHEN** the benchmark builds the AskBoard arm's command
- **THEN** its tools include `Skill`, its allowed tools include `Skill(askboard:askboard)` and no bare `Skill`, and the other arms' tools and allowed tools hold no `Skill`

#### Scenario: Bundled skills switched off
- **WHEN** the benchmark builds any arm's command
- **THEN** its environment switches Claude Code's bundled skills off

### Requirement: The benchmark reports the skills loaded
The benchmark report SHALL list the skills each arm's sessions started with and flag a run whose listing holds a skill other than AskBoard's two, `askboard:askboard` and `askboard:askboard-help`, so that the context AskBoard's skills add is what the benchmark measures; the AskBoard arm SHALL still allow only `Skill(askboard:askboard)` (AD-17, PRD R5).

#### Scenario: Another skill in the listing
- **WHEN** a run's init event lists a skill other than AskBoard's two
- **THEN** the report lists that skill for the run's arm and flags the run

#### Scenario: The help skill in the listing
- **WHEN** a run's init event lists `askboard:askboard` and `askboard:askboard-help`
- **THEN** the report lists both and flags nothing

### Requirement: Asking from the agent that needs the answers
`SKILL.md` SHALL tell the agent to ask from the agent that needs the answers, SHALL say that its own asks never block it, so it keeps working while the user answers, and SHALL tell it not to hand its questions to a subagent to ask for it, since that subagent's ask closes when it finishes and later answers are lost. No file of the skill SHALL offer a subagent, in the background or not, that asks on another agent's behalf (FR-21, FR-25, AD-5, UJ-2).

#### Scenario: The advice line
- **WHEN** the generated `SKILL.md`'s "After you ask" section is read
- **THEN** it says to ask from the agent that needs the answers, that the agent's own asks never block it and it keeps working while the user answers, and not to hand its questions to a subagent to ask for it, because that ask closes when the subagent finishes and later answers are lost

#### Scenario: No subagent asks on another agent's behalf
- **WHEN** every file the skill generator writes is read
- **THEN** none offers a background subagent or a side dialogue, and none advises a subagent that asks, waits and returns the answers to another agent

#### Scenario: A subagent still asks its own task's questions
- **WHEN** the generated `SKILL.md`'s routing section is read
- **THEN** it still says that a subagent asks every question through AskBoard

### Requirement: The item catalogue
The skill SHALL hold a generated reference, `references/items.md`, with one line per item type a question's `items` may hold, giving what the type is for: the context item types, then each registered widget type in registry order with its noun, then each ready molecule in order, each with the use its teaching data gives (FR-29, AD-6).

#### Scenario: The Tree in the catalogue
- **WHEN** the skill is generated on the shipped registry
- **THEN** `references/items.md` holds a line naming the Tree's noun and `` `tree` `` with the Tree's use

#### Scenario: A type registered
- **WHEN** the generator runs on a registry with one more widget type
- **THEN** `references/items.md` holds that type's line with its use, `SKILL.md` links that type's reference, and every other line of both files is unchanged

#### Scenario: The catalogue within its budget
- **WHEN** the skill check runs
- **THEN** it measures `references/items.md` against the reference budget of 6,000 characters and fails, naming it, when it is over

### Requirement: Every reference one level from SKILL.md
`SKILL.md` SHALL link the item catalogue, `references/context.md` once for the context items, and each widget type's and ready molecule's reference by its type or name, and SHALL give no per-type use. No generated file other than `SKILL.md` SHALL link to a file of the skill (NFR-1, NFR-11).

#### Scenario: The Tree's link
- **WHEN** the skill is generated on the shipped registry
- **THEN** `SKILL.md` links `` `tree` `` to `references/widgets/tree.md` and does not hold the Tree's use

#### Scenario: Every generated file linked once deep
- **WHEN** the generated files are read
- **THEN** every generated file other than `SKILL.md` is the target of a link in `SKILL.md`, and no file other than `SKILL.md` links to a file of the skill

### Requirement: The reference for changing an ask
The skill SHALL hold a generated reference, `references/updates.md`, giving each `update` action in the input format's order with the fields it requires and those it may take, read from the input format's update schema, and `SKILL.md` SHALL link it from its "After you ask" section (FR-6, FR-29, AD-6).

#### Scenario: Reply's fields
- **WHEN** the generated `references/updates.md` is read
- **THEN** its `reply` line names `itemId`, `followUp` and `text` as required, and says that `itemId` is the question the follow-up event names and `followUp` that event's cursor

#### Scenario: An action added to the input format
- **WHEN** the generator runs over an update schema with one more action
- **THEN** `references/updates.md` lists that action with its fields, and the rest of the file is unchanged

#### Scenario: The link
- **WHEN** the generated `SKILL.md`'s "After you ask" section is read
- **THEN** it links `references/updates.md`

### Requirement: Adding an item to a question taught
The updates reference SHALL say that `add` takes only a question, placed in an area by `parentId`, or an area at the top level; that a widget, atom, layout or context item joins an existing question through a `change` of the question's `items`, sent whole with every item it keeps; that a `change` replaces each key it sends whole; and that a question with an answer is reopened first (FR-6).

#### Scenario: A widget added to a question
- **WHEN** the generated `references/updates.md` is read
- **THEN** it says that `add` refuses a widget, and gives the `change` of the question's `items` that adds one, keeping the items already there

#### Scenario: An item dropped by a change
- **WHEN** the generated `references/updates.md` is read
- **THEN** it says that an item left out of the `items` a change sends is removed from the question

### Requirement: Update examples that validate
Every `update` example in the shipped skill SHALL pass the contract's validation of an `update` request. An example without `reply` SHALL apply through `ask-core` to the ask example of the same reference with no refusal; a `reply` example SHALL name a question of that ask example. A test SHALL fail, naming the file and example, otherwise (AD-6).

#### Scenario: The shipped update examples
- **WHEN** the examples test runs on the shipped skill
- **THEN** each `update` example validates, the `change` example applies to the reference's ask example, and the `reply` example names one of its questions

#### Scenario: An update example that stops validating
- **WHEN** a schema change makes a shipped `update` example invalid
- **THEN** the examples test fails naming the file and the example

### Requirement: The ask's language taught
`SKILL.md` SHALL teach passing `language` on every `ask`: the language the user asked for, else the one the project's instructions in the agent's context give (CLAUDE.md or AGENTS.md), else none, so AskBoard's default applies. It SHALL give the values the input format admits, read from it, and say to leave out a language it does not admit (FR-34, FR-29).

#### Scenario: The language section
- **WHEN** the generated `SKILL.md` is read
- **THEN** it names `language`, each value the input format's `language` admits, the order of the three sources, and that an unlisted language is left out

#### Scenario: A language added to the input format
- **WHEN** the generator runs over an input format whose `language` admits one more value
- **THEN** `SKILL.md` names that value too

### Requirement: Locale and another language taught
`SKILL.md` SHALL teach passing `locale` only when the user's formats for money, dates and numbers differ from the language's, that `update` changes neither, and that for another language the agent closes the ask and sends a new one in it (FR-34).

#### Scenario: Locale and a switch
- **WHEN** the generated `SKILL.md`'s language section is read
- **THEN** it names `locale` with when to pass it, and says to close the ask and ask again for another language

### Requirement: A deleted item in the answers reference
The answers reference SHALL say that `fetch` of an item the agent deleted returns the outcome `deleted`, and of an ask that is gone, the outcome `discarded` (FR-20, AD-10).

#### Scenario: Reading the fetch outcomes
- **WHEN** the generated `references/answers.md` is read
- **THEN** it names the outcomes `deleted` and `discarded` of `fetch` and when each comes

### Requirement: The asking skill's description says when to load it
`askboard`'s description SHALL open with the routing criterion and its cases, given as examples. It SHALL say to load the skill before asking the user to decide or review something complex, in chat or with AskUserQuestion, and when the user asks for AskBoard, and that a simple choice stays with AskUserQuestion. It SHALL set no condition on the tools being available and name no widget type (FR-29, AD-18).

#### Scenario: The description's lead
- **WHEN** the shipped `askboard` `SKILL.md` is parsed
- **THEN** its description is at most 600 characters, its first 150 characters say it asks the user something complex on a visual, interactive board, and it names AskUserQuestion, AskBoard and the moment before the agent asks

#### Scenario: No precondition and no widget
- **WHEN** the description is read
- **THEN** it does not make the skill depend on AskBoard's tools being available, and it names no registered widget type

### Requirement: The help skill's description names its triggers
`askboard-help`'s description SHALL name keyboard shortcuts and changing, rebinding or remapping a key among the usage questions it serves. It SHALL still say that it serves questions the user asks in the terminal and that a follow-up on the board is not for it, within 400 characters (FR-29, NFR-12).

#### Scenario: The triggers
- **WHEN** the shipped `askboard-help` `SKILL.md` is parsed
- **THEN** its description names keyboard shortcuts, rebinding and remapping a key, says "asks in the terminal" and "follow-up on the board is not for this skill", and is at most 400 characters

### Requirement: Item types by what the user has to do
The item catalogue SHALL hold a section that maps what the user has to do to the item types that help, said to be examples. It SHALL name only context types, registered widget types and ready molecules. An entry with none of its types registered SHALL give its fallback or be left out. A UML diagram or a state machine, while its entry names no registered type, SHALL go in as an `image` of a rendered file or an `excerpt` of its source (FR-29, FR-11).

#### Scenario: The section
- **WHEN** the generator runs on the shipped registry
- **THEN** `references/items.md` holds the section, says its entries are examples, and every type it names in backticks is a context type, a registered widget type or a ready molecule

#### Scenario: A type not registered
- **WHEN** the generator runs with a registry from which one type of an entry is missing
- **THEN** that entry leaves the type out, and an entry left with no type gives its fallback or is not written

#### Scenario: A diagram while its entry names no registered type
- **WHEN** the generator runs on the shipped registry
- **THEN** the entry for a UML diagram or a state machine says to send an `image` of the rendered file or an `excerpt` of its source

#### Scenario: The link from SKILL.md
- **WHEN** the generated `SKILL.md` is read
- **THEN** its line linking `references/items.md` says the catalogue also holds the types by what the user has to do and a complete ask

### Requirement: A complete ask in the catalogue
The item catalogue SHALL end with one complete `json ask` example: an ask with `language` and one question that cites a document by ID. The question SHALL have an `excerpt` of that document beside it and options, one of them recommended. The example SHALL be one of the generator's examples and validate as every shipped example does (FR-29, FR-3, FR-8).

#### Scenario: The example
- **WHEN** the generator runs on the shipped registry
- **THEN** the last tagged block of `references/items.md` is a `json ask` with `askId`, `language` and one question holding an `excerpt` and options with one `recommended`, and it is among the examples the generator reports

#### Scenario: The example validates
- **WHEN** the examples test runs on the shipped skill
- **THEN** the catalogue's `json ask` is accepted by `AskCore.ask`

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
