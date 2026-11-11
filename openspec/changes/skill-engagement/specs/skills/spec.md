## MODIFIED Requirements

### Requirement: Routing between AskBoard and AskUserQuestion
`SKILL.md` SHALL route by the question's cognitive and contextual complexity, never by a count of questions or options. It SHALL give many interconnected questions, questions that cite documents by bare IDs and content that reads better as a visual artifact as examples, and leave the agent to judge whether a visual, interactive board helps. A simple, self-explanatory choice goes to AskUserQuestion, a subagent asks through AskBoard, and an asking rule or the user's instruction overrides (FR-29, FR-30).

#### Scenario: The routing section
- **WHEN** the generated `SKILL.md` is read
- **THEN** its routing section says to choose by how hard the question is to grasp and to answer, names the three cases, says they are examples and the agent judges, sends a simple, self-explanatory choice to AskUserQuestion, makes a subagent ask every question through AskBoard, and lets an asking rule and the user's instruction override

#### Scenario: No count
- **WHEN** the generated routing section is read
- **THEN** it routes by no number of questions or options: it holds neither "more than four" nor "several questions" as a case

#### Scenario: Why the board
- **WHEN** the generated routing section is read
- **THEN** it says that on the board the user sees the context beside the question, works on it and asks follow-ups while the agent keeps working

#### Scenario: Not in chat prose
- **WHEN** the generated routing section is read
- **THEN** it tells the agent never to put a complex question to the user in chat prose, and to ask it on the board

## ADDED Requirements

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
