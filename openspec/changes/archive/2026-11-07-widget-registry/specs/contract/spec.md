## ADDED Requirements

### Requirement: The widget-type registry
`contract` SHALL hold one registry of the widget types a question's `items` may hold, in order, Tree then Gantt. Each entry SHALL give the type's name, its props schema and checks, its element shape and changes schema when the user edits the agent's content, its result schema and checks when it gives a result, its derived declarations, its agent-facing wording and an example item. Choice and the molecule reference SHALL stay outside it (AD-7, AD-13).

#### Scenario: The two entries
- **WHEN** the registry is read
- **THEN** it holds `tree` then `gantt`, each with its props schema, element shape, changes schema and derived declarations, and neither declares a result

#### Scenario: Every example validates
- **WHEN** each entry's example item is put in a question of an ask and the ask is validated
- **THEN** the ask passes

#### Scenario: A registry that contradicts itself
- **WHEN** the registry's own check runs over a registry holding two entries named `probe`, or an entry named `excerpt`, `option`, `contextItem` or `__proto__` (a name of the composed schemas' definitions or one every object has), or an entry whose result schema accepts `null`, `{}`, `[]` or `""`, or an entry whose props schema's `$id` is not `urn:askboard:input:<name>-props`
- **THEN** it fails, naming the entry and the rule it breaks

### Requirement: Widget items follow their registry entry
Every check, wording, element lookup and diff shape the contract applies to a widget item SHALL come from its type's registry entry, so that registering a type is enough for the contract to accept, check, word and diff its items. For Tree and Gantt every result and every wording SHALL stay as before this change (AD-7, AD-20).

#### Scenario: A test-only type
- **WHEN** a question holding an item of the fixtures' `probe` type is checked with a registry that holds `probe`
- **THEN** its props go through the probe's schema and checks, its problems name the item and the element and read from the probe's wording, and its changes follow the probe's element shape

#### Scenario: Tree and Gantt as before
- **WHEN** the contract's Tree, Gantt and molecule tests run over the registry
- **THEN** each passes with its expected values and texts unchanged

### Requirement: Schemas composed from the registry
The input format's question items, the board document's question items and `fetch`'s items SHALL list each registered type, after the context items and in registry order, with its props schema; the input and output formats SHALL list each type's props, changes and result schemas. Composed over Tree and Gantt alone, these SHALL equal the schemas before this change (AD-6, AD-7).

#### Scenario: Tree and Gantt as before
- **WHEN** the composition runs over Tree and Gantt alone
- **THEN** the question items, the board document's question items and `fetch`'s item types deep-equal, in order, those `main` held before this change

#### Scenario: One more registered type
- **WHEN** the composition runs over a registry that also holds `probe`, and its schemas are compiled
- **THEN** an ask, a board document and a `fetch` result holding a probe item validate, and one holding an item of type `kanban` fails at its type

### Requirement: Widget result declarations
A registered type that gives a result SHALL declare its result schema, `urn:askboard:output:<type>-result`, and MAY declare checks against the item's props. A result SHALL be checked by its schema, then its checks; a type with no result takes none. A result schema SHALL refuse a result that holds nothing: `null`, `""`, or an object or array of such values; `false`, `0` and other strings and numbers are content. `contract` exports that test as one function (AD-7, FR-18, NFR-10).

#### Scenario: A probe result
- **WHEN** a result the probe's schema admits is checked for a probe item
- **THEN** it passes, and a result naming an element the item does not hold fails, naming the item and the element

#### Scenario: A result for a Tree
- **WHEN** a result is checked for a Tree item
- **THEN** it fails, saying that a Tree gives no result

#### Scenario: A result schema that takes an empty result
- **WHEN** the registry's check runs over an entry whose result schema accepts `{}`
- **THEN** it fails with the rule `result-empty`, naming the entry and the empty value

### Requirement: The annotation shape
The output format SHALL define the annotation `{id, target: {selector}, body: {text}}`, its item being the key of the answer's `results`: `id` an element ID, `text` of 1 to 2,000 characters, and `selector` one of `element` (`id`), `label` (`label`, optional `occurrence`), `region` (`value`, `xywh=percent:x,y,w,h`), `line` (`side` `old` or `new`, `path`, `line`), `quote` (`exact`, optional `prefix`, `suffix`) and `position` (`start`, `end`) (AD-7).

#### Scenario: One annotation of each selector
- **WHEN** six annotations, one per selector type, are validated
- **THEN** each passes

#### Scenario: A region in pixels
- **WHEN** an annotation's `region` selector holds `xywh=pixel:10,10,40,40`
- **THEN** it fails, naming the selector's `value`

#### Scenario: An unknown selector
- **WHEN** an annotation's selector has the type `css`
- **THEN** it fails, naming the selector's type

### Requirement: Widget results in the answer act
The board protocol's `answer` act SHALL take `results`, an object from widget item ID to that item's result, with at least one entry, beside its other optional content. E1's `answer` command SHALL keep its shape (AD-20).

#### Scenario: An act with a result
- **WHEN** an `act` whose answer carries `results` for a probe item is validated
- **THEN** it passes

#### Scenario: A key that is no ID
- **WHEN** an answer act's `results` has the key `a b`
- **THEN** it fails, naming `results`

#### Scenario: Results in E1's command
- **WHEN** E1's `answer` command carries `results`
- **THEN** it fails as a schema error naming `results`

### Requirement: Widget results in the draft record
A draft record's question SHALL take `results`, from item ID to the result the view holds, any JSON value nested no deeper than `JSON_MAX_DEPTH`, beside `values`; its keys SHALL be checked as `values`' keys are, and a record nested deeper than the draft depth bound (that bound plus the record's own four levels) SHALL be refused at `/record` in both directions (AD-20).

#### Scenario: A held result
- **WHEN** a draft record whose question holds a result for a probe item is validated
- **THEN** it passes

#### Scenario: A record nested too deep
- **WHEN** a draft record holds a result nested past the draft depth bound, or one that holds itself
- **THEN** the message fails at `/record` in both directions, with nothing thrown, and the board page refuses to mirror it

#### Scenario: A key that names no question item
- **WHEN** the record's question holds a result under an ID that is no item of that question in the board document
- **THEN** the draft record's check against the board document reports it, naming the key

### Requirement: Logged widget results in the board state
The board state SHALL carry, in a question's current and previous answer, the logged `results` of each widget item the answer gave one for, by expanded item ID (AD-20).

#### Scenario: An answered probe question
- **WHEN** a board state whose question's answer holds `results` for a probe item is validated
- **THEN** it passes

### Requirement: A too-large answer carries no results
An answer event marked `tooLarge` SHALL carry no `results`, as it carries no `changes` and no `derived` (FR-20, AD-20).

#### Scenario: A too-large event with results
- **WHEN** an answer event carries `tooLarge: true` and `results`
- **THEN** it fails, naming `results`

### Requirement: Widget results in fetch results
`fetch`'s result SHALL hold, in a question's answers, the answer's `results` by item ID in reference addressing, and, for a widget item fetched alone, its `result` as its latest answer gave it, when there is one (FR-20, AD-9).

#### Scenario: A question with a result
- **WHEN** a `fetch` result whose question's answer holds `results` for a probe item is validated
- **THEN** it passes

#### Scenario: A widget item with its result
- **WHEN** a `fetch` result of a probe item alone holds its `result`
- **THEN** it passes, and a question or an area holding `result` fails, naming it

### Requirement: Kept results in the Snapshot data
A Snapshot data block's logged event SHALL take `results`: the results `ask-core` keeps for an answer event logged `tooLarge`, by item ID in reference addressing (FR-26, AD-15).

#### Scenario: A too-large answer in a Snapshot
- **WHEN** a Snapshot data block whose logged `tooLarge` event holds `results` beside `values` is validated
- **THEN** it passes

### Requirement: This change's sets at their next minor
The output format, the tool envelopes, the board protocol and the Snapshot data SHALL each take the minor after the one `main` holds when this change rebases, adding only optional fields, schemas and limits; every other set SHALL keep `main`'s version (AD-7).

#### Scenario: The versions
- **WHEN** the contract's schema sets are listed
- **THEN** the four sets each name `main`'s minor plus one, and every other set names `main`'s version

#### Scenario: A receiver on the previous minor
- **WHEN** a board-protocol receiver at the previous minor gets an `act` whose answer carries `results`
- **THEN** it refuses the message as a schema error naming `results`

## MODIFIED Requirements

### Requirement: Widget item checks
The contract SHALL check any widget item whose type the widget-type registry holds, given the question that holds it and the value's origin, through its type's entry: its props schema, its checks and its checks against the question, a Gantt plan's link included. A type the registry does not hold SHALL be a problem naming the item and its type (AD-7, AD-10).

#### Scenario: A plan whose link fails
- **WHEN** a question holds the Gantt plan `schedule__plan` whose `workPackages` names `wbs__tree`, and no item `wbs__tree`
- **THEN** the check fails, naming `schedule__plan` and `wbs__tree`

#### Scenario: An unknown widget type
- **WHEN** an item's type is `kanban`
- **THEN** the check fails, naming the item and `kanban`

### Requirement: Widget items in a question
A question's `items`, which hold the context items of excerpts (`excerpt`, `reference` and `image`), SHALL also hold items `{type, id, props}` whose `type` is one the widget-type registry holds (`tree` and `gantt`) or `molecule`, each picked by `type` and with the props of its type's schema, in the same list and the same order. Their IDs SHALL follow the ask's ID rules with every other item's: unique in the ask, the `u-` prefix refused (AD-7, AD-9).

#### Scenario: A Tree and a Gantt
- **WHEN** a question holds the fixture Tree `wbs` and a Gantt with its own tasks
- **THEN** the ask passes

#### Scenario: A Tree beside an excerpt
- **WHEN** a question holds an excerpt and a Tree in its `items`
- **THEN** the ask passes, both kept in the order sent

#### Scenario: An item ID used twice
- **WHEN** a question's Tree has the ID of another question of the ask, or of one of its own excerpts
- **THEN** validation fails, naming the ID as used twice

### Requirement: Widget items in the board document
The board document's questions SHALL hold their widget items as `ask-core` expanded them, among the resolved context items of excerpts and in the same list, of the types the widget-type registry holds only, with the props each item's schema defines; a `molecule` item SHALL fail the board document's validation (AD-9, AD-12).

#### Scenario: The UJ-2 board
- **WHEN** the UJ-2 ask's board document is validated
- **THEN** it passes, its question `plan` holding the Tree `wbs__tree` and the Gantt plan `schedule__plan`

#### Scenario: A reference in a board document
- **WHEN** a board document's question holds a `molecule` item
- **THEN** validation fails, naming the item and its type

### Requirement: Lifecycle constants
The contract SHALL hold, as shared constants: the reconnect grace period (120 s), the takeover flush wait, the longest note, "Other…" text, follow-up and reply, the longest option note, preview and annotation, the longest draft record and the longest `fetch` page, the one JSON depth bound (`JSON_MAX_DEPTH`, 64 levels) and the draft record's depth bound, and no unit SHALL define its own.

#### Scenario: The grace period
- **WHEN** `ask-core` starts a grace timer
- **THEN** it uses the contract's grace period of 120 s

#### Scenario: The depth bounds
- **WHEN** `ask-core` and the board page check a result's depth and a draft record's
- **THEN** they use the contract's `JSON_MAX_DEPTH` and draft depth bound, and define none
