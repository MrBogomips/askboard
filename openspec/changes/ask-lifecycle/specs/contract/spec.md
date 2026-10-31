# Spec Delta

## REMOVED Requirements

### Requirement: Input format for a plain question
**Reason**: E3 accepts several questions, areas and the rest of FR-3, so the one-question input format of E1 no longer holds.
**Migration**: Replaced by "Input format for questions and areas", "Areas" and "Question props". The plain-choice ask still validates unchanged, and an ask in `it-IT` is still refused until E8.

## MODIFIED Requirements

### Requirement: Answer event in the output format
The output format SHALL define the answer event as `cursor`, `type: "answer"`, `itemId`, `rev`, `who` and `when`, plus optional content: `choice`, `other`, `optionNotes` (by label), `note`, `changes`, `results`, `derived`, `declined: true` and `replaces` (the replaced answer's cursor). In `changes`, `add` and `move` SHALL omit `parent` when there is none (the top level) and `after` when there is none (the first position). It SHALL contain no AXFX term (FR-18).

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

## ADDED Requirements

### Requirement: Input format for questions and areas
The input format SHALL accept an ask of `askId`, optional `title`, `agentName`, `expectedUser`, `presentation`, `delivery`, `language` and `locale`, and `items` holding one or more questions, or one or more areas. Any field, item type or value it does not define SHALL fail validation, naming the item and the field; `language` and `locale` stay `en-US` until E8.

#### Scenario: Several questions
- **WHEN** an ask holds six questions with distinct item IDs
- **THEN** it passes

#### Scenario: A widget item inside a question
- **WHEN** a question's props carry `items`, as the approved `uj1`, `uj2` and `uj3` asks do
- **THEN** validation fails, naming the question's item ID and the field `items`

#### Scenario: Only English is accepted
- **WHEN** an ask sets `language` or `locale` to `it-IT`
- **THEN** validation fails, naming the field

### Requirement: Areas
An area SHALL be an item `{type: "area", id, props: {title, items}}` at the top level of an ask, whose `title` is a non-empty string and whose `items` hold one or more questions. Areas SHALL NOT nest, and either every top-level item of an ask is an area or none is (FR-2).

#### Scenario: Questions in three areas
- **WHEN** an ask holds three titled areas, each with two questions
- **THEN** it passes

#### Scenario: A question beside an area
- **WHEN** an ask's top-level items are an area and a question
- **THEN** validation fails, naming the question and saying that every top-level item must then be an area

#### Scenario: An area inside an area
- **WHEN** an area's `items` hold an area
- **THEN** validation fails, naming the inner area

### Requirement: Question props
A question's props SHALL be `text`, optional `header`, a non-empty `options` list, optional `multiSelect` and optional `allowOther`. An option SHALL be `{label, description?, preview?, annotation?, recommended?}`, every value text but `recommended: true`; labels SHALL be unique within the question (F5), and at most one option SHALL be recommended.

#### Scenario: A recommended option
- **WHEN** a question marks one option `recommended: true`, as the approved `uj1` ask's state-machine question does
- **THEN** its props pass

#### Scenario: Two recommended options
- **WHEN** a question marks two options as recommended
- **THEN** validation fails, naming the question's item ID and both labels

#### Scenario: Two options with one label
- **WHEN** a question holds two options labelled `PostgreSQL`
- **THEN** validation fails, naming the question's item ID and the repeated label

### Requirement: The update request
The contract SHALL define `update`'s request as `askId` and a non-empty list of actions: `add` (`item`, optional `parentId` and `after`, each omitted when there is none, as in `changes`), `change` (`itemId`, `props`), `delete`, `reopen` (`itemId`), `answer` (`itemId`, `answer` of `choice`, `other` and `note`), `reply` (`itemId`, `followUp`, `text`) and `close`. A field the action does not use SHALL fail validation, naming the action's index.

#### Scenario: Adding a question to an area
- **WHEN** an update adds a question with `parentId` naming an area of the ask
- **THEN** the request passes

#### Scenario: A field the action does not use
- **WHEN** a `delete` action carries `props`
- **THEN** validation fails, naming the action's index and the field

#### Scenario: A reply without its follow-up
- **WHEN** a `reply` action has no `followUp`
- **THEN** validation fails, naming the action's index and saying that `followUp` is required

### Requirement: Lifecycle events
Beside the answer and discarded events, the output format SHALL define, each with its `cursor`: `postponed` and `reopened` (`itemId`, `rev`); `note` (`itemId`, `rev`, `who`, `when`, `note`); `follow-up` (`itemId`, `rev`, `who`, `when`, `text`); and `edit-choice` (`itemId`, `rev`, `edit` of `reload` or `ignore`, and `keptRev` with `ignore`). The discarded event's reason SHALL also admit `board-closed`.

#### Scenario: The approved postponed event
- **WHEN** the `postponed` event of `answers/uj2-wbs-gantt.json` is validated against the output format
- **THEN** it passes

#### Scenario: An ignore without the kept revision
- **WHEN** an `edit-choice` event says `ignore` and names no `keptRev`
- **THEN** it fails validation

#### Scenario: A discard after the tab closed
- **WHEN** a discarded event carries the reason `board-closed`
- **THEN** it passes

### Requirement: Ask and question states
Results and board-protocol messages SHALL report an ask state of `waiting`, `partly-answered`, `answered`, `closed` or `discarded`, and a question state of `open`, `answered`, `postponed` or `declined` (AD-10).

#### Scenario: The approved UJ-2 answer
- **WHEN** `answers/uj2-wbs-gantt.json`, an `answered` ask with a postponed question, is validated against the `collect` result envelope
- **THEN** it passes

### Requirement: Closed asks on the wire
The ask state of results, the board state and `collect`'s ask entry SHALL admit `closed`. The board protocol's `closed` message SHALL carry `reason` as an enum holding `agent`, which a later minor may extend. The output format's closed event is not defined by this change: `push-delivery` defines it.

#### Scenario: The agent closes an ask
- **WHEN** the agent closes an ask with `update`
- **THEN** `collect`'s entry for it validates with state `closed`, and the board's `closed` message with reason `agent`

#### Scenario: A reason outside the enum
- **WHEN** a `closed` message carries the reason `timeout`
- **THEN** it fails validation, naming the field

### Requirement: Envelopes of update and fetch
The tool envelopes SHALL define `update`'s and `fetch`'s results, and `collect`'s outcomes `postponed` and `closed` beside `open`. Every result SHALL name its versions (F12) and carry the epoch, and the typed results `closed` and `discarded` SHALL name the ask.

#### Scenario: A fetch result validates
- **WHEN** the lifecycle fixture's `fetch` result is validated against the `fetch` result envelope
- **THEN** it passes and names a result and an output version

### Requirement: Board document for several questions
The board document SHALL hold the ask's title, its requested presentation and delivery, and its items as the input format places them, with every question's current `rev` and props. It SHALL hold no draft, no event and no token.

#### Scenario: An ask with areas
- **WHEN** an ask of two areas is created
- **THEN** its board document holds both areas with their titles and questions, each question at `rev` 1

### Requirement: Acts on the board protocol
The board page SHALL send user actions as `act` commands, each holding one or more acts: `answer`, `decline`, `postpone`, `reopen`, `note`, `follow-up` and `edit-choice`. `board-host` SHALL send per-question states with their answers, previous answers and follow-up threads, acknowledgements, refusals, the restored draft record, and `closed`.

#### Scenario: A submit of three acts
- **WHEN** the board page sends one `act` command holding two answers and a postpone
- **THEN** it validates against the board protocol

#### Scenario: An act the protocol does not define
- **WHEN** an `act` command holds an act of type `approve`
- **THEN** it is refused as a schema error naming the act's index

### Requirement: Action IDs
Every `act` command SHALL carry an `actionId` of 22 base64url characters made by the board page, and every acknowledgement or refusal of a command SHALL name it.

#### Scenario: A command without its action ID
- **WHEN** an `act` command carries no `actionId`
- **THEN** it is refused as a schema error

### Requirement: Draft record message
The draft record SHALL be a board-protocol schema: the delivery mode, the question in view, and per question its `rev`, the values keyed by item ID as the view holds them, the "Other…" text, option notes, open-prompt text, follow-up composer text and any held act with its order. A record over the contract's draft limit SHALL be refused.

#### Scenario: An oversized record
- **WHEN** the board page sends a draft record longer than the draft limit
- **THEN** it is refused as a schema error and the held record is unchanged

#### Scenario: A question key that is no own property
- **WHEN** a draft record keys a question as `constructor`
- **THEN** it is refused like any other unknown item ID

### Requirement: Lifecycle constants
The contract SHALL hold, as shared constants: the reconnect grace period (120 s), the takeover flush wait, the longest note, "Other…" text, follow-up and reply, the longest option note, preview and annotation, the longest draft record and the longest `fetch` page, and no unit SHALL define its own.

#### Scenario: The grace period
- **WHEN** `ask-core` starts a grace timer
- **THEN** it uses the contract's grace period of 120 s

### Requirement: Approved examples E3 completes
The approved `update` and `fetch` definitions and the full approved server instructions SHALL be served as the fixtures hold them, and every event of `answers/*.json` whose type the output format defines SHALL validate against it.

#### Scenario: The tool definitions
- **WHEN** the contract's tool definitions are compared with `tools.json`
- **THEN** they equal its `ask`, `update`, `collect` and `fetch` entries, in that order

### Requirement: Lifecycle fixtures
The contract SHALL add fixtures for E3's types, each validating against the full contract: an ask with areas, several questions and FR-3's fields; `update` requests of every action; a `fetch` result; and a `collect` result holding every event type.

#### Scenario: A fixture that diverges
- **WHEN** a lifecycle fixture is edited so that it no longer validates
- **THEN** the contract's tests fail, naming the fixture
