# Spec Delta

## MODIFIED Requirements

### Requirement: Input format for questions and areas
The input format SHALL accept an ask of `askId`, optional `title`, `agentName`, `expectedUser`, `presentation`, `delivery`, `language` and `locale`, and `items` holding one or more questions, or one or more areas. Any field, item type or value it does not define SHALL fail validation, naming the item and the field; `language` and `locale` stay `en-US` until E8.

#### Scenario: Several questions
- **WHEN** an ask holds six questions with distinct item IDs
- **THEN** it passes

#### Scenario: The approved UJ-2 ask
- **WHEN** the approved `asks/uj2-wbs-gantt.json`, whose question `plan` holds the molecule references `wbs` and `schedule`, is validated against input format 1.2
- **THEN** it passes unchanged

#### Scenario: A widget item inside a question
- **WHEN** a question's props carry `items` holding a `tree`, `gantt` or `molecule` item with its type's props (Items in a question)
- **THEN** it passes, where input format 1.1 refused any `items`, naming the field

#### Scenario: A widget type the input format does not define
- **WHEN** a question's props carry `items` holding a `diff-review`, `graph`, `table` or `approval` item, as the approved `uj1` and `uj3` asks do
- **THEN** validation fails, naming that item's ID and its type

#### Scenario: Only English is accepted
- **WHEN** an ask sets `language` or `locale` to `it-IT`
- **THEN** validation fails, naming the field

### Requirement: Question props
A question's props SHALL be `text`, optional `header`, an `options` list, optional `multiSelect`, optional `allowOther` and optional `items`, and SHALL hold a non-empty `options`, a non-empty `items`, or both (F1). An option SHALL be `{label, description?, preview?, annotation?, recommended?}`, every value text but `recommended: true`; labels SHALL be unique within the question (F5), and at most one option SHALL be recommended.

#### Scenario: A recommended option
- **WHEN** a question marks one option `recommended: true`, as the approved `uj1` ask's state-machine question does
- **THEN** its props pass

#### Scenario: Two recommended options
- **WHEN** a question marks two options as recommended
- **THEN** validation fails, naming the question's item ID and both labels

#### Scenario: Two options with one label
- **WHEN** a question holds two options labelled `PostgreSQL`
- **THEN** validation fails, naming the question's item ID and the repeated label

#### Scenario: A question with items and no options
- **WHEN** a question holds a Tree item and no `options`
- **THEN** its props pass

#### Scenario: A question with neither
- **WHEN** a question holds no `options` and no `items`
- **THEN** validation fails, naming the question's item ID and saying that a question needs options, items or both

### Requirement: Answer event in the output format
The output format SHALL define the answer event as `cursor`, `type: "answer"`, `itemId`, `rev`, `who` and `when`, plus optional content: `choice`, `other`, `optionNotes` (by label), `note`, `changes`, `results`, `derived`, `declined: true`, `replaces` (the replaced answer's cursor) and `tooLarge: true`. In `changes`, `add` and `move` SHALL omit `parent` when there is none (the top level) and `after` when there is none (the first position). It SHALL contain no AXFX term (FR-18).

#### Scenario: Every approved answer event validates
- **WHEN** each `answer` event of the fixtures `answers/*.json` is validated against the answer event schema
- **THEN** every one passes

#### Scenario: A Choice answer
- **WHEN** an answer to a question with options is built from a selection alone
- **THEN** it carries `choice` as a list of option labels, and none of the other content fields

#### Scenario: An element added or moved to the top level
- **WHEN** a change adds or moves an element to the top level, first or after a sibling
- **THEN** it omits `parent`, names `after` only when a sibling precedes it, and validates; a `parent` or `after` of `null` is refused

#### Scenario: Other text and option notes
- **WHEN** the user answers with "Other…" text "MariaDB" and a note on the option `DynamoDB`
- **THEN** the answer carries `other: "MariaDB"` and `optionNotes` with that note under the label `DynamoDB`

#### Scenario: A decline
- **WHEN** a decline with a reason is built
- **THEN** it carries `declined: true` and the reason as `note`, and no `choice` or `other`

#### Scenario: A revised answer
- **WHEN** the user revises an answer logged at cursor `k3x9.4`
- **THEN** the new answer event carries `replaces: "k3x9.4"`

#### Scenario: An answer too large for a result
- **WHEN** an answer event carries `tooLarge: true` together with `changes` or `derived`
- **THEN** it fails validation, naming the field

### Requirement: Gantt schemas
The Gantt's props and changes SHALL be the schemas `urn:askboard:input:gantt-props` and `urn:askboard:output:gantt-changes`, parts of the input format and of the output format, compiled with every schema of the contract's sets (AD-7).

#### Scenario: The Gantt's schemas compile
- **WHEN** the Gantt's two schemas are compiled in strict mode with every schema of the contract's sets
- **THEN** both compile, both are JSON Schema 2020-12 with those `$id`s, neither has a root combinator, and the input format lists `gantt-props` and the output format `gantt-changes`

### Requirement: Molecule reference props
The contract SHALL define a molecule reference's props in the schema `urn:askboard:input:molecule-props`, a part of the input format: `molecule`, a molecule name, an optional `version`, a semantic version `MAJOR.MINOR.PATCH`, and `data`, an object. Any other key SHALL fail validation, naming it (AD-6, AD-9, F2).

#### Scenario: The UJ-2 references
- **WHEN** the props of the approved `uj2-wbs-gantt` ask's `wbs` and `schedule` items are validated
- **THEN** both pass unchanged

#### Scenario: A version that is not semantic
- **WHEN** a reference's `version` is `1.0`
- **THEN** validation fails, naming `version`

#### Scenario: No data
- **WHEN** a reference names `wbs-pert` and holds no `data`
- **THEN** validation fails, naming `data`

### Requirement: Molecule definition format
The contract SHALL define the molecule definition format 1.0.0 in the schema `urn:askboard:input:molecule-definition`, a part of the input format: `format`, `molecule`, `version`, `parameters`, `items` and `fills`, and nothing else. `parameters` SHALL be a JSON Schema 2020-12 object whose `$id` is `urn:askboard:molecule:<name>:<major>`, with no root combinator; `items` SHALL hold exactly one widget item `{type, id, props}` (AD-9).

#### Scenario: Two items
- **WHEN** a definition's `items` holds two widget items
- **THEN** validation fails, saying that format 1.0.0 composes one item

#### Scenario: Parameters with a root combinator
- **WHEN** a definition's `parameters` has `anyOf` at its root
- **THEN** validation fails, naming `parameters`

#### Scenario: Another format
- **WHEN** a definition's `format` is `2.0.0`
- **THEN** validation fails, naming the format versions the contract supports

## REMOVED Requirements

### Requirement: Standalone widget schemas
**Reason**: The input format's 1.2 minor admits widget items, so the Tree's schemas, and every widget schema after them, join the input and output sets instead of standing apart.
**Migration**: Replaced by "Widget schemas in the schema sets". The `$id`s stay `urn:askboard:input:<name>-props` and `urn:askboard:output:<name>-changes`, and a `changes` schema still takes its operations from the output format's change.

## ADDED Requirements

### Requirement: The widening as the next minor
The input format, output format, tool envelopes, board document and board protocol SHALL each take the minor after `ask-lifecycle`'s 1.1, version 1.2, adding only optional fields, enum values and schemas, so a receiver on 1.1 refuses each new field as a schema error (AD-7).

#### Scenario: The five versions
- **WHEN** the contract's schema sets are listed
- **THEN** those five sets name version 1.2, each with the owner AD-7's table gives it, and the view manifest keeps its version

#### Scenario: A 1.1 receiver meets a widget answer
- **WHEN** a receiver that supports board protocol 1.1 gets an `act` whose answer carries `values`
- **THEN** it refuses the message as a schema error naming `values`

### Requirement: Widget schemas in the schema sets
A widget's item props and its `changes` SHALL be schemas of the input format and the output format, `urn:askboard:input:<name>-props` and `urn:askboard:output:<name>-changes`, checked as set parts with their owner and version, and validated through the contract's shared validator. A `changes` schema SHALL take its operations from the output format's change (AD-7).

#### Scenario: The Tree's schemas are set parts
- **WHEN** the schema checks of the Consistency Conventions run over the contract's sets
- **THEN** they cover `tree-props` and `tree-changes` with the input and output formats' owner and version, and report no problem

#### Scenario: One validator for every set schema
- **WHEN** a Tree's props are validated by `$id`
- **THEN** they are checked by the same validator as every other schema of the sets, and its problems read as E1's

### Requirement: Molecule parameters stay data
A ready-made molecule's `parameters` schema SHALL stay with its definition, outside the schema sets, and SHALL be compiled on first use beside every widget props schema it references (AD-9).

#### Scenario: The plan's parameters
- **WHEN** the `gantt-plan` definition's parameters validate the approved `schedule` data
- **THEN** they pass, resolving their references into `gantt-props`, and no schema set lists `urn:askboard:molecule:gantt-plan:1`

### Requirement: Items in a question
A question's `items` SHALL hold items `{type, id, props}` whose `type` is `tree`, `gantt` or `molecule`, each with the props of its type's schema. Their IDs SHALL follow the ask's ID rules: unique in the ask, the `u-` prefix refused (AD-7, AD-9).

#### Scenario: A Tree and a Gantt
- **WHEN** a question holds the fixture Tree `wbs` and a Gantt with its own tasks
- **THEN** the ask passes

#### Scenario: An item ID used twice
- **WHEN** a question's Tree has the ID of another question of the ask
- **THEN** validation fails, naming the ID as used twice

### Requirement: Widget props problems for the agent
A widget item whose props fail its schema or its widget's checks SHALL fail the request with problems worded as every request problem is: each names the item's ID, the element and the field where there is one, and the expected shape, in document order (AD-6).

#### Scenario: A Tree node without a label
- **WHEN** an ask's Tree `wbs` holds the node `ux` with no `label`
- **THEN** the request fails with a problem naming item `wbs`, node `ux` and the field `label`, and saying what a node holds

#### Scenario: A Gantt predecessor with the reserved prefix
- **WHEN** an agent's Gantt names the predecessor `u-3`
- **THEN** the request fails, naming the Gantt's ID and the task, and saying that the prefix `u-` is reserved for IDs the board makes

#### Scenario: A plan whose Tree is missing
- **WHEN** a question's Gantt plan names `workPackages: "wbs"` and the question holds no Tree `wbs`
- **THEN** the request fails, naming the plan and `wbs`

#### Scenario: A plan whose Tree is in another question
- **WHEN** a question's Gantt plan names `workPackages: "wbs"` and the Tree `wbs` is an item of another question of the same ask
- **THEN** the request fails, naming the plan and `wbs`, as if the question held no Tree `wbs`

### Requirement: Widget items in the board document
The board document's questions SHALL hold their widget items as `ask-core` expanded them, Tree and Gantt items only, with the props each item's schema defines; a `molecule` item SHALL fail the board document's validation (AD-9, AD-12).

#### Scenario: The UJ-2 board
- **WHEN** the UJ-2 ask's board document is validated
- **THEN** it passes, its question `plan` holding the Tree `wbs__tree` and the Gantt plan `schedule__plan`

#### Scenario: A reference in a board document
- **WHEN** a board document's question holds a `molecule` item
- **THEN** validation fails, naming the item and its type

### Requirement: Widget values in the answer act
The board protocol's `answer` act SHALL take, beside its other optional content, `values`, an object from widget item ID to that item's full edited props, and `derived`, an object from reference to JSON value. E1's `answer` command SHALL keep its choice-only shape (AD-20).

#### Scenario: A Tree answer act
- **WHEN** the board page sends an `act` whose answer to `plan` carries `values` for `wbs__tree` and `schedule__plan` and their `derived`
- **THEN** it validates against board protocol 1.2

#### Scenario: Values in E1's command
- **WHEN** a board page sends E1's `answer` command with `values`
- **THEN** it is refused as a schema error naming `values`

### Requirement: Logged widget values in the board state
The board state SHALL carry, in a question's current and previous answer, the logged `values` of each widget item the answer changed, by expanded item ID, and no derived value (AD-20).

#### Scenario: An answered Tree question
- **WHEN** the board state of an answered UJ-2 question is built
- **THEN** its answer holds `values` for `wbs__tree` and `schedule__plan` as the user sent them, with its `when` and receipt

### Requirement: Formula warnings
The output format's warning SHALL admit the code `formula`, with the item ID in reference addressing, the address of the node in error, its formula error kind and a message, so that a graph problem confined to one item is a warning in a successful result (AD-6, AD-13, FR-14).

#### Scenario: A predecessor that names no task
- **WHEN** an `ask` result warns that the plan `schedule` names the predecessor `review`, which is no task
- **THEN** the warning validates with code `formula`, item `schedule` and kind `missing-reference`

### Requirement: The largest answer event
The contract SHALL hold `ANSWER_EVENT_MAX_CHARS`, 24,000 characters of an answer event's JSON text, chosen so that a `collect` result holding that event and the most ask entries a `collect` takes stays under the result limit; no unit SHALL define its own.

#### Scenario: The largest event fits a page
- **WHEN** a `collect` result is built with the most ask entries and one answer event of `ANSWER_EVENT_MAX_CHARS`
- **THEN** its text is under 30,000 characters

### Requirement: Widget answers in fetch results
`fetch`'s result SHALL hold, for a question, an answer's `values` (by item ID in reference addressing) and `derived`, and SHALL admit as the item a Tree, a Gantt or a molecule reference's expanded item under the reference's ID, with its props as the user left them (FR-20, AD-9).

#### Scenario: Fetching the WBS
- **WHEN** the lifecycle fixture's `fetch` result of the reference `wbs` is validated
- **THEN** it passes, its item a Tree with the ID `wbs`

### Requirement: Warnings in update results
`update`'s result SHALL admit `warnings`, the same warnings an `ask` result carries, for the items the update added or changed (AD-6).

#### Scenario: An update that leaves a formula error
- **WHEN** an `update` result carries a `formula` warning
- **THEN** it validates against the `update` result envelope

### Requirement: The approved UJ-2 example validates whole
The approved `uj2-wbs-gantt` ask, `ask` result and `collect` answer SHALL validate against the full contract at 1.2, and the contract's fixtures SHALL hold the UJ-2 board document and the logged answer the end-to-end scenario expects.

#### Scenario: The approved files
- **WHEN** `asks/uj2-wbs-gantt.json`, `results/uj2-wbs-gantt.json` and `answers/uj2-wbs-gantt.json` are validated against the input format, the `ask` result and the `collect` result
- **THEN** each passes unchanged
