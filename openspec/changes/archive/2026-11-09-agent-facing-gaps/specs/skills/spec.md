## ADDED Requirements

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
