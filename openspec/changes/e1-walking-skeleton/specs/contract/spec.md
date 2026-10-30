# Spec Delta

## Purpose

The contract is AskBoard's one shared language: the versioned JSON Schema sets, ID rules and constants for every message that crosses a unit boundary at run time, with the fixtures that hold them to the approved model contract (AD-7).

## ADDED Requirements

### Requirement: Versioned schema sets
Every message that crosses a unit boundary on E1's path SHALL have a JSON Schema 2020-12 schema in a set with its own semantic version and one owning unit: input format and output format (`contract`), tool envelopes (`mcp-tools`), board document (`ask-core`), board protocol (`board-host`). No schema SHALL have a root `anyOf`, `oneOf` or `allOf`.

#### Scenario: Every schema is valid 2020-12
- **WHEN** the contract's tests compile every schema with the pinned validator in strict mode
- **THEN** every schema compiles, and a schema with a root combinator fails the test

#### Scenario: Every set names its version and owner
- **WHEN** the contract's schema sets are listed
- **THEN** each has a semantic version and exactly one owning unit, as in AD-7's table

### Requirement: Input format for a plain question
The input format SHALL accept an ask of `askId`, optional `title`, `agentName`, `expectedUser`, `presentation`, `delivery`, `language` and `locale`, and `items` holding exactly one item of type `question`. Its props SHALL be `text`, optional `header`, a non-empty `options` list of `{label, description?}`, and optional `multiSelect`. Any other field, item type or value SHALL fail validation, naming it.

#### Scenario: The approved plain-choice ask validates
- **WHEN** the fixture `asks/plain-choice.json` is validated against the input format
- **THEN** it passes

#### Scenario: A second question is refused
- **WHEN** an ask holds two items of type `question`
- **THEN** validation fails with a message that names the second item's ID and says that one question per ask is accepted

#### Scenario: A field E1 does not define is refused
- **WHEN** a question's props carry `recommended`, `items` or an option `preview`
- **THEN** validation fails, naming the item ID and the unknown field

#### Scenario: Only English is accepted
- **WHEN** an ask sets `language` or `locale` to `it-IT`
- **THEN** validation fails, naming the field

### Requirement: Agent-chosen IDs
Ask IDs and item IDs SHALL match `[A-Za-z0-9_-]{1,64}`, item IDs SHALL be unique within their ask, and no agent-chosen ID SHALL start with the prefix the contract reserves for view-made IDs, `u-` (finding F10).

#### Scenario: A malformed ID is refused
- **WHEN** an ask ID holds a space or is 65 characters long
- **THEN** validation fails, naming the field

#### Scenario: The view-made prefix is reserved
- **WHEN** an agent sends an item with the ID `u-1`
- **THEN** validation fails, saying that the prefix `u-` is reserved for IDs the board makes

### Requirement: Unique option labels
Option labels SHALL be unique within a question, since an answer names the chosen options by label (finding F5).

#### Scenario: Two options with one label
- **WHEN** a question holds two options labelled `PostgreSQL`
- **THEN** validation fails, naming the question's item ID and the repeated label

### Requirement: Answer event in the output format
The output format SHALL define the answer event as `cursor`, `type: "answer"`, `itemId`, `rev`, `who` and `when`, plus the answer's content fields of finding F4, each optional: `choice` (the chosen option labels), `note`, `changes` (AD-20's generic diff), `results` and `derived`. It SHALL contain no AXFX term (FR-18).

#### Scenario: Every approved answer event validates
- **WHEN** each `answer` event of the fixtures `answers/*.json` is validated against the answer event schema
- **THEN** every one passes

#### Scenario: A Choice answer
- **WHEN** an answer to a plain question is built
- **THEN** it carries `choice` as a list of option labels, and none of the other content fields

### Requirement: Results name their versions
Every tool result SHALL name both the version of its result envelope and the version of the output format it carries, as `versions: {result, output}` (finding F12). A tool request SHALL name no version (AD-7).

#### Scenario: The approved plain-choice results validate
- **WHEN** the fixtures `results/plain-choice.json` and `answers/plain-choice.json` are validated against the `ask` and `collect` result envelopes
- **THEN** both pass, and each names a result and an output version

### Requirement: Unsupported major versions are refused
A receiver of a document or message that names a major version of its schema set it does not support SHALL refuse it, saying which version it supports.

#### Scenario: A board-protocol message from another major
- **WHEN** a board-protocol message names major version 2 of the board protocol and the receiver supports 1
- **THEN** the receiver refuses it with a reason that names version 1

### Requirement: Shared constants
The contract SHALL hold the constants that more than one unit reads: `collect`'s longest wait (20 minutes) and progress interval (60 s), the result limit (30,000 characters), the error-text limit (4,000 characters), the cut length of a derived title, the default board port range and the board token's minimum length (128 bits).

#### Scenario: Units read the constants from the contract
- **WHEN** `collect` waits, a result is paged or a token is made
- **THEN** the value used is the contract's constant, and no unit defines its own

### Requirement: Approved examples as fixtures
The contract SHALL keep the approved examples of the `review-model-contract` change as fixtures, unchanged. Each SHALL validate against the schemas the contract defines for it, and an example changes only through an OpenSpec change that says why.

#### Scenario: Every fixture passes the generic tool schemas
- **WHEN** the fixtures `asks/*.json` are validated against the `ask` tool's input schema
- **THEN** every one passes, including those whose item types the input format does not define yet

#### Scenario: A fixture that diverges is caught
- **WHEN** a fixture is edited so that it no longer validates against a schema it is checked against
- **THEN** the contract's tests fail, naming the fixture
