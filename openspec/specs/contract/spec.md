# contract Specification

## Purpose
The contract is AskBoard's one shared language: the versioned JSON Schema sets, ID rules and constants for every message that crosses a unit boundary at run time, with the fixtures that hold them to the approved model contract (AD-7).

## Requirements

### Requirement: Versioned schema sets
Every message that crosses a unit boundary on E1's path SHALL have a JSON Schema 2020-12 schema in a set with its own semantic version and one owning unit: input and output formats (`contract`), tool envelopes (`mcp-tools`), board document (`ask-core`), board protocol (`board-host`), view manifest (`view`). No schema SHALL have a root `anyOf`, `oneOf` or `allOf`.

#### Scenario: Every schema is valid 2020-12
- **WHEN** the contract's tests compile every schema with the pinned validator in strict mode
- **THEN** every schema compiles, and a schema with a root combinator fails the test

#### Scenario: Every set names its version and owner
- **WHEN** the contract's schema sets are listed
- **THEN** each has a semantic version and exactly one owning unit, as in AD-7's table

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

#### Scenario: A field of a newer minor
- **WHEN** a receiver that supports board protocol 1.0 gets a 1.1 message carrying a field 1.0 does not define
- **THEN** it refuses the message as a schema error naming the field, so a minor's new field is sent only once every receiver of the set accepts it

### Requirement: Shared constants
The contract SHALL hold the constants that more than one unit reads: `collect`'s longest wait (20 minutes) and progress interval (60 s), the result limit (30,000 characters), the error-text limit (4,000 characters), the cut length of a derived title and the longest title, the default board port range, the board token's minimum length (128 bits), the board routes and token header with what each route answers, and the board WebSocket's close codes.

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

### Requirement: Formula whitelist
The contract SHALL hold the formula whitelist decided by the formula spike: the operators `+ - * /`, unary minus, `^` and `= <> < <= > >=`, and the functions `SUM`, `MIN`, `MAX`, `IF`, `ROUND`, `AND`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP` and `WORKDAY`, each with its number of arguments and Excel's semantics, and no other entry.

#### Scenario: The list matches AD-13
- **WHEN** the contract's whitelist is read
- **THEN** it holds exactly AD-13's operators and functions, each function with its least and greatest number of arguments

#### Scenario: Dropped functions stay out
- **WHEN** the whitelist is searched for `OR`, `NOT`, `ABS`, `CEILING`, `AVERAGE`, `COUNT` or `NETWORKDAYS`
- **THEN** none is found

### Requirement: Refused Excel operators
The contract SHALL name the Excel operators that formulas may not use, `&` and `%`, so that a formula using one is refused as outside the whitelist rather than as a grammar error.

#### Scenario: The refused operators
- **WHEN** the contract's refused operators are read
- **THEN** they are `&` and `%`, and neither is in the whitelist

### Requirement: Formula grammar
The contract SHALL hold the reference grammar's terminals: IDs as `[A-Za-z0-9_-]{1,64}`, field names as a letter then up to 63 letters or digits that is not a cell, cells as upper-case A1 addresses from `A1` to `XFD1048576`, and the operator precedence, from comparison (lowest) through `+ -` and `* /` to `^` (highest), every binary operator left-associative and unary minus above `^`.

#### Scenario: A field name that is a cell
- **WHEN** `A1`, `Q1` and `XFD1048576` are checked as field names, then `a1`, `q1` and `XFE1`
- **THEN** the first three are refused, because each is a cell; the last three are accepted

#### Scenario: Cells at the edge of the sheet
- **WHEN** `XFD1048576` and `XFE1` are checked as cells
- **THEN** the first is a cell and the second is not

### Requirement: Formula limits
The contract SHALL hold the formula limits that every unit checks before any engine runs: 8,192 characters per formula, a nesting depth of 64, and 65,536 cells per range.

#### Scenario: The limits
- **WHEN** the contract's formula limits are read
- **THEN** they are 8,192 characters, a depth of 64 and 65,536 cells

### Requirement: Formula error kinds
The contract SHALL name the kinds of formula error a node can read as, the same for the board and for the agent's warnings: `syntax`, `over-limit`, `not-whitelisted`, `missing-reference`, `cycle`, `mixed-currencies`, `value` and `division-by-zero`.

#### Scenario: The kinds
- **WHEN** the contract's formula error kinds are read
- **THEN** they are those eight, in kebab-case

### Requirement: No import-time effects in the contract
No module of the contract SHALL add a schema to a validator or write to a registry when it is imported, and making a widget validator SHALL compile nothing. A widget validator SHALL add its schemas on its first use, into one validator for widget schemas apart from the contract's shared validator, and SHALL report problems in the shape of the contract's other validators.

#### Scenario: Importing the contract
- **WHEN** the contract's modules are imported and no widget validator has run
- **THEN** E1's schema sets and `SCHEMA_IDS` hold none of the Tree's schemas, and the contract's shared validator has no schema with the Tree's `$id`s

#### Scenario: After a widget validator runs
- **WHEN** a widget validator has validated a value
- **THEN** the contract's shared validator still has no schema with that widget's `$id`s

### Requirement: Widget element IDs
Every widget's element IDs SHALL match `[A-Za-z0-9_-]{1,64}` and be unique within their item, at every level. An element ID the agent chooses SHALL NOT start with the view-made prefix `u-`; an edited value from the view MAY hold elements whose IDs start with it, each `u-<n>`, `n` one more than the highest such number in the item's value when the view made it (AD-7, finding F10).

#### Scenario: One ID at two levels
- **WHEN** a Tree's parent and one of its grandchildren share the ID `design`
- **THEN** validation fails, naming the repeated ID

#### Scenario: The agent uses the view's prefix
- **WHEN** the agent's Tree nodes hold one with the ID `u-1`
- **THEN** validation fails, saying that the prefix `u-` is reserved for IDs the board makes

#### Scenario: A node the user added
- **WHEN** an edited Tree value from the view holds a node `u-1`
- **THEN** it passes validation as an edited value

### Requirement: Tree item props
The contract SHALL define a Tree item's props in the schema `urn:askboard:input:tree-props`, checked by `validateTreeProps`, as optional `columns`, each `{field, label, type}` with `type` `text` or `number`, `nodes`, each `{id, label, children?}` plus a value for any declared field: a string for `text`, a number for `number`, absent when empty, and, for a work breakdown, the optional `pert` and `openDepth` (Tree PERT props). Any other key SHALL fail validation, naming the node and the key.

#### Scenario: The UJ-2 work breakdown as a Tree
- **WHEN** the nodes of the approved `uj2-wbs-gantt` ask's `wbs` data, without their `excerpt` pointers, are validated as a Tree whose columns declare `optimistic`, `mostLikely` and `pessimistic` as numbers
- **THEN** they pass

#### Scenario: The UJ-2 work breakdown with PERT
- **WHEN** the same Tree also holds `pert` `true` and `openDepth` `2`
- **THEN** it passes

#### Scenario: An undeclared field
- **WHEN** a node carries `owner` and no column declares it
- **THEN** validation fails, naming the node's ID and the field `owner`

### Requirement: No Tree before the input format admits one
No ask SHALL carry a Tree until the input format admits one in a question's items.

#### Scenario: A Tree in an ask before the input format admits it
- **WHEN** a question's items holds a Tree and the input format does not yet admit one
- **THEN** the ask is refused

#### Scenario: A value of the wrong type
- **WHEN** a node holds the text `"five"` in a `number` column
- **THEN** validation fails, naming the node's ID and the field

### Requirement: Tree field names
A column's `field` SHALL match `^[a-z][A-Za-z0-9]{0,63}$`, SHALL NOT be `id`, `label` or `children`, and SHALL be unique within the item, so that every node field is addressable by AD-13's flat reference `item.node.field` and no field name is a spreadsheet cell.

#### Scenario: A reserved or cell-like name
- **WHEN** a column declares the field `children`, `Owner` or `A1`
- **THEN** validation fails, naming the column and the field

### Requirement: Tree limits
A Tree SHALL hold at most 500 nodes, 8 levels and 8 columns; a name SHALL be 1 to 200 characters and a text field at most 1,000. The limits SHALL live in the contract, and a Tree over one SHALL fail validation, naming the limit.

#### Scenario: Too many nodes
- **WHEN** a Tree holds 501 nodes
- **THEN** validation fails, naming the limit of 500 nodes

#### Scenario: Too deep
- **WHEN** a node sits at the ninth level
- **THEN** validation fails, naming the node and the limit of 8 levels

### Requirement: Tree changes
The contract SHALL define a Tree's `changes` in the schema `urn:askboard:output:tree-changes`, checked by `validateTreeChanges`, as a list of the output format's changes (AD-20) with the Tree's rules: `add`, `remove` and `move` target `item.node`, and `set` targets `item.node.field`. A bulk adjustment of values and a drag of a node SHALL give no operation but these (Tree bulk percentage adjustment; Tree drag and drop).

#### Scenario: Operation values
- **WHEN** a Tree's operations are validated
- **THEN** an `add`'s `value` holds the node's name and fields, without `id` or children, and a `set`'s field is `label` or a declared one, with a value of its type, or `null` to empty a field other than `label`

#### Scenario: A bulk adjustment or a drag
- **WHEN** the user adjusts values in bulk or drags a node
- **THEN** the changes hold one `set` for each value that differs from what the agent sent and one `move` for each node that is elsewhere, and no other operation

#### Scenario: The approved UJ-2 answer
- **WHEN** the operations of `answers/uj2-wbs-gantt.json` whose target starts with `wbs.` are validated as Tree changes
- **THEN** every one passes, the `add` of `u-1` under `build` after `portal` included

#### Scenario: A set on the children
- **WHEN** a `set` operation targets `wbs.build.children`
- **THEN** validation fails, naming the target

#### Scenario: A bulk adjustment
- **WHEN** 12 leaves' most likely estimates are each raised by 10% and the diff runs
- **THEN** it returns 12 `set` operations, each on `wbs.<node>.mostLikely` with the new number, and they validate as Tree changes

#### Scenario: A drag and back
- **WHEN** a node is moved and moved back, and the diff runs
- **THEN** it returns no operation for it

### Requirement: Tree change positions
A Tree's `add` and `move` SHALL name the parent node and the preceding sibling, omitting `parent` at the top level and `after` at the first place; a `parent` or `after` of `null` SHALL fail validation (AD-20).

#### Scenario: An add first at the top level
- **WHEN** an `add` operation leaves out `parent` and `after`
- **THEN** it passes, placing the node first at the top level

#### Scenario: A null position
- **WHEN** an `add` or `move` operation gives `parent` or `after` as `null`
- **THEN** validation fails, naming the field

### Requirement: Computing element changes
Given an item's props as sent and as edited, and the widget's element shape, the contract's diff SHALL return the operations that, applied in order to the sent value, give the edited value, addressing elements by ID, never by position. It SHALL list no operation for an untouched element or field, one `remove` for a removed element and none for its removed descendants, and no operation for a value that ends as it was sent (AD-10, AD-20, FR-20).

#### Scenario: Nothing changed
- **WHEN** the edited value equals the sent one
- **THEN** the diff returns no operation

#### Scenario: A removed branch
- **WHEN** an element with three children is removed from a tree
- **THEN** the diff returns one `remove` naming that element

### Requirement: Element changes in the output format
Every operation the diff returns SHALL be one of the output format's changes and validate against its schema. `add` and `move` SHALL name the parent and the preceding sibling, omitting `parent` at the top level and in a flat list and `after` at the first place, and no operation SHALL hold a `null` position. Applying SHALL refuse an operation whose `parent` or `after` is `null`, naming the operation (AD-20).

#### Scenario: Every operation validates
- **WHEN** the diff runs on edits of a tree, a flat list and a keyed shape
- **THEN** each operation it returns validates against the output format's change

#### Scenario: A null position applied
- **WHEN** an operation whose `after` is `null` is applied
- **THEN** applying fails, naming that operation

### Requirement: Element shapes and fields
An element shape SHALL be a list shape or a keyed shape. A list shape SHALL name the props key that holds a list of elements and, for a tree, the element key that holds its children; without a children key the elements SHALL form a flat list, and no `add` or `move` names a `parent`. Every other key of an element but `id` SHALL be a field whose values compare as JSON values, so that a changed field of any type gets one `set` with its whole new value.

#### Scenario: An array field in a flat list
- **WHEN** one element of a flat list gets a different array in a field, and another gets an array equal to the one it had
- **THEN** the diff returns one `set` holding the first element's whole new array, and no operation for the second

#### Scenario: Moving an element to the front of a flat list
- **WHEN** the last element of a flat list is moved to the front
- **THEN** the diff returns one `move` for it, with neither `parent` nor `after`, and no operation for the others

### Requirement: Keyed element shapes
A keyed shape SHALL name the props key that holds an object from element ID to the element's fields. Its diff SHALL return only `set`s, `item.element.field`, one per field whose value differs, with `null` for a field or an entry that is gone. Applying SHALL create a missing entry, delete a field set to `null` and then an entry left with no field, and SHALL refuse `add`, `remove` and `move`. Any ID, `constructor` and `__proto__` included, SHALL be an ordinary entry.

#### Scenario: A new entry
- **WHEN** the edited value of a keyed `schedule` gains the entry `u-1` with the field `dependencies` holding `["architecture", "prototype"]`
- **THEN** the diff returns exactly one `set`, `schedule.u-1.dependencies`, holding that array

#### Scenario: A removed entry
- **WHEN** an entry with two fields is gone from the edited value
- **THEN** the diff returns one `set` of `null` for each of its two fields

#### Scenario: A move on a keyed shape
- **WHEN** a `move` is applied to a keyed shape
- **THEN** applying fails, saying that a keyed shape takes only sets

### Requirement: Order of element changes
For a list shape, the diff SHALL list, for each element of the edited value in document order, its `add` or `move` and then, for a kept element, its `set`s in field-name order (UTF-16 code units), and SHALL list the `remove`s last; each `after` and `parent` given SHALL name an element that exists at that point when the operations are applied in order. For a keyed shape, it SHALL list the `set`s by element ID and then by field, each in code-unit order.

#### Scenario: Applying the changes in order
- **WHEN** any sequence of adds, field edits, deletes and moves on a tree or on a flat list, or of field edits, new entries and removed entries on a keyed shape whose entries are non-empty and hold no `null` field, is diffed and the operations are applied in order to the sent value
- **THEN** the result equals the edited value

### Requirement: Computing a Tree's changes
The Tree SHALL declare its element shape as `nodes` with `children`, and the diff of any two Tree values that pass validation SHALL pass validation as that Tree's `changes`.

#### Scenario: Three changes in 200 nodes
- **WHEN** the user renames one node, sets one field of another and moves a third in a 200-node Tree
- **THEN** the diff returns exactly three operations, and they validate as Tree changes

#### Scenario: The UJ-2 edits
- **WHEN** the diff runs on the UJ-2 work breakdown as sent and as the user in the approved answer left it
- **THEN** it returns the approved answer's `wbs` operations, the same set in the diff's own order

### Requirement: Tree fixtures
The contract SHALL provide, for tests only, a board document whose one question holds a Tree item built from the UJ-2 work breakdown, the edited value of that Tree after the approved answer's edits, and that answer's event with its `changes`. Each part SHALL validate against the Tree's schemas, the answer SHALL validate as the output format's answer event, and the answer's `changes` SHALL equal the diff of the two values.

#### Scenario: The fixtures agree
- **WHEN** the contract's tests run
- **THEN** the fixture Tree and its edited value validate, the answer validates as an answer event, its `changes` validate as Tree changes, and the diff of the two values gives exactly those `changes`

### Requirement: Gantt schemas
The Gantt's props and changes SHALL be the schemas `urn:askboard:input:gantt-props` and `urn:askboard:output:gantt-changes`, parts of the input format and of the output format, compiled with every schema of the contract's sets (AD-7).

#### Scenario: The Gantt's schemas compile
- **WHEN** the Gantt's two schemas are compiled in strict mode with every schema of the contract's sets
- **THEN** both compile, both are JSON Schema 2020-12 with those `$id`s, neither has a root combinator, and the input format lists `gantt-props` and the output format `gantt-changes`

### Requirement: Gantt item props
The input format SHALL define a Gantt item's props as a `start` date and `tasks`. Without `workPackages`, `tasks` SHALL be a list of the Gantt's own tasks; with `workPackages`, the ID of a Tree item whose leaves are the tasks (the Gantt plan), `tasks` SHALL be a map from task ID to an entry. Any other key than those below SHALL fail validation, naming it.

#### Scenario: A task's shape
- **WHEN** a Gantt without `workPackages` lists tasks
- **THEN** each is `{id, label, duration}` and MAY hold a requested `start` and its `dependencies`, its predecessors' IDs

#### Scenario: An entry's shape
- **WHEN** a Gantt plan maps a task ID to an entry
- **THEN** the entry MAY hold a requested `start`, its `dependencies` and a requested `duration`, and nothing else

#### Scenario: A Gantt's own tasks
- **WHEN** a Gantt lists six tasks, each with an ID, a label and a duration, two of them with dependencies
- **THEN** it passes

#### Scenario: The UJ-2 plan
- **WHEN** a plan over `wbs` maps `prototype`, `portal`, `billing` and `reporting` to entries holding their approved predecessors
- **THEN** it passes

#### Scenario: A plan entry with a duration
- **WHEN** a plan's entry for `portal` holds `duration` 21
- **THEN** it passes

#### Scenario: A plan entry with a label
- **WHEN** a plan's entry holds a `label`
- **THEN** validation fails, saying that a plan's tasks take their names from its Tree

#### Scenario: A list in a plan
- **WHEN** a Gantt with `workPackages` holds its `tasks` as a list
- **THEN** validation fails, saying that a plan's tasks are a map by task ID

#### Scenario: An unknown key
- **WHEN** a Gantt's props hold `calendar`
- **THEN** validation fails, naming the key `calendar`

### Requirement: Gantt values
A Gantt's `start` and every requested start SHALL be a real calendar day from 1900-03-02 to 9999-12-31, written as an RFC 3339 `full-date`: the compute graph holds 1900-03-01, but finds a plan's first working day from the day before its start. A task's `duration` SHALL be a whole number of working days from 1 to 2,000. A task's predecessors SHALL be task IDs, each listed once (AD-7, Values).

#### Scenario: A day that does not exist
- **WHEN** a requested start is `2026-02-30`
- **THEN** validation fails, naming the task and the date

#### Scenario: The graph's first day
- **WHEN** a Gantt's `start` is `1900-03-01`
- **THEN** validation fails, naming the start and the first day a Gantt may name, 1900-03-02

#### Scenario: A fractional duration
- **WHEN** a task's `duration` is `2.5`
- **THEN** validation fails, naming the task and the field `duration`

#### Scenario: A predecessor listed twice
- **WHEN** a task's predecessors list `design` twice
- **THEN** validation fails, naming the task and `design`

### Requirement: Gantt task IDs
A Gantt's task IDs, a plan's entry keys and every predecessor SHALL follow the widget element ID rule: in what the agent sends, none SHALL start with the view-made prefix `u-`; an edited value MAY name such tasks, since a plan's tasks are its Tree's leaves and keep their IDs (AD-7, F10).

#### Scenario: One ID twice
- **WHEN** two of a Gantt's tasks share the ID `review`
- **THEN** validation fails, naming the repeated ID

#### Scenario: The agent names a view-made task
- **WHEN** the agent's tasks give `u-1` as a predecessor
- **THEN** validation fails, saying that the prefix `u-` is reserved for IDs the board makes

#### Scenario: A package the user added
- **WHEN** an edited plan maps `u-1` to the predecessors `architecture` and `prototype`
- **THEN** it passes validation as an edited value

### Requirement: Gantt plan link
A Gantt plan's `workPackages` SHALL name a Tree item in the same question whose columns declare `optimistic`, `mostLikely` and `pessimistic` as numbers. A plan whose link fails SHALL fail validation, naming the plan and the item it names (AD-10).

#### Scenario: The UJ-2 link
- **WHEN** the plan `schedule` names `wbs`, a Tree in its question with the three estimate columns
- **THEN** the link passes

#### Scenario: A link to nothing
- **WHEN** a plan names `wbs` and its question holds no item `wbs`
- **THEN** validation fails, naming the plan and `wbs`

### Requirement: Gantt references are not refused
A predecessor that names no task of the Gantt, a plan entry that names no leaf of its Tree, and a dependency cycle SHALL pass validation: they are the compute graph's concern, shown on the board, never refusals (AD-13, FR-14).

#### Scenario: A cycle
- **WHEN** a Gantt's tasks make `a` depend on `b` and `b` on `a`
- **THEN** the props pass validation

#### Scenario: A task that names itself
- **WHEN** a Gantt's changes give task `a` the predecessors `a` and `b`
- **THEN** the changes pass validation, the self-loop being a cycle

### Requirement: Gantt limits
A Gantt SHALL hold at most 500 tasks; a task at most 50 predecessors; at most 50 tasks SHALL depend on one task; a task's name SHALL be 1 to 200 characters. The limits SHALL live in the contract, and a Gantt over one SHALL fail validation, naming the limit.

#### Scenario: Too many dependents
- **WHEN** 51 tasks list `design` among their predecessors
- **THEN** validation fails, naming `design` and the limit of 50 dependent tasks

#### Scenario: Too many tasks
- **WHEN** a Gantt lists 501 tasks
- **THEN** validation fails, naming the limit of 500 tasks

### Requirement: Gantt changes
The output format SHALL define a Gantt's `changes` as `set` operations of AD-20's generic diff on a task's field: `item.task.duration`, a whole number of working days of a Gantt's own task, or of a plan's entry as a requested duration, or `null` to clear a plan's request; `item.task.start`, a date or `null` to clear the request; `item.task.dependencies`, the full list, or `null` for none. No other operation or field SHALL pass.

#### Scenario: The approved UJ-2 answer
- **WHEN** the operation of `answers/uj2-wbs-gantt.json` whose target starts with `schedule.` is validated as a change of the plan `schedule`
- **THEN** it passes

#### Scenario: A plan's duration
- **WHEN** a change of a Gantt plan sets `schedule.portal.duration` to 21, or to `null`
- **THEN** it passes

#### Scenario: A duration out of range
- **WHEN** a change sets `schedule.portal.duration` to 0, to 2001 or to 2.5
- **THEN** validation fails, naming the value and the range 1 to 2,000

#### Scenario: A move
- **WHEN** a Gantt's changes hold a `move` operation
- **THEN** validation fails, naming the operation

#### Scenario: The diff of a requested duration
- **WHEN** a plan's edited value holds a requested duration the sent one did not, and the diff runs
- **THEN** it returns one `set` of the entry's `duration`, valid as the plan's changes, and the diff of an edited value that dropped a sent request gives `null`

### Requirement: Computing a Gantt's changes
A Gantt's `changes` SHALL be those the contract's one generic element diff gives for the Gantt's shape: its own tasks as a flat list, a plan's tasks as a keyed map, every key but `id` a field. The Gantt SHALL have no diff of its own (AD-20, FR-20).

#### Scenario: Nothing changed
- **WHEN** the edited Gantt equals the sent one
- **THEN** the diff returns no operation

#### Scenario: A changed predecessor list
- **WHEN** the user gives reporting the predecessors `portal` and `billing` in the fixture Gantt
- **THEN** the diff returns exactly one `set` of `release.reporting.dependencies` with that list

#### Scenario: The UJ-2 plan edit
- **WHEN** the UJ-2 plan as sent is diffed with the plan after the approved answer's edit
- **THEN** the diff returns exactly the approved answer's `set schedule.u-1.dependencies` to `architecture` and `prototype`

#### Scenario: A plan entry cleared
- **WHEN** the user clears both the requested start and the predecessors of a plan entry that held both
- **THEN** the diff returns one `set` to `null` for each of the two fields

#### Scenario: Applying the changes
- **WHEN** any sequence of duration, start and predecessor edits is diffed and the operations are applied to the sent props
- **THEN** the result equals the edited props, an emptied plan entry being absent

### Requirement: Gantt answer derived values
The contract SHALL declare the derived values a Gantt's answer carries: `<item>.finish`, the date the plan ends, and `<item>.criticalPath`, the IDs of the tasks on the critical path in task order; a value in error SHALL be left out (F7, FR-12).

#### Scenario: The approved UJ-2 values
- **WHEN** the UJ-2 plan is computed after the approved answer's edits
- **THEN** its declared derived values are `schedule.finish` `2026-12-02` and `schedule.criticalPath` `ux`, `prototype`, `portal`, `reporting`, as in the approved answer

### Requirement: Gantt fixtures
The contract SHALL provide, for tests only, a board document whose question holds a Gantt with its own tasks, a board document whose question holds the UJ-2 work breakdown as a Tree and the UJ-2 plan over it, each value after the approved answer's edits, the plan's `changes` and the Gantt derived values. Each part SHALL validate, and the `changes` SHALL equal the diff of the sent and the edited plan and the approved answer's `schedule.` operation.

#### Scenario: The fixtures agree
- **WHEN** the contract's tests run
- **THEN** both fixture Gantts and their edited values validate, the plan's `changes` validate, and the diff of the sent and the edited plan gives exactly those `changes`, which are the approved ones

### Requirement: Input format for questions and areas
The input format SHALL accept an ask of `askId`, optional `title`, `agentName`, `expectedUser`, `presentation`, `delivery`, `language` and `locale`, and `items` holding one or more questions, or one or more areas; `language` and `locale` each take a value the input format lists (E8). Any field, item type or value it does not define SHALL fail validation, naming the item and the field.

#### Scenario: Several questions
- **WHEN** an ask holds six questions with distinct item IDs
- **THEN** it passes

#### Scenario: The approved UJ-2 ask
- **WHEN** the approved `asks/uj2-wbs-gantt.json`, whose question `plan` holds the molecule references `wbs` and `schedule`, is validated against input format 1.4
- **THEN** it passes unchanged

#### Scenario: A widget item inside a question
- **WHEN** a question's props carry `items` holding a `tree`, `gantt` or `molecule` item with its type's props (Items in a question)
- **THEN** it passes, where input format 1.3 admitted only excerpts, references and images in `items`

#### Scenario: A widget type the input format does not define
- **WHEN** a question's props carry `items` holding a `diff-review`, `graph`, `table` or `approval` item, as the approved `uj1` and `uj3` asks do
- **THEN** validation fails, naming that item's ID and its type

#### Scenario: Only English is accepted
- **WHEN** an ask sets `language` or `locale` to a value the input format does not list, such as `fr-FR` (E8 lists `en-US` and `it-IT`; the scenario keeps its name from the base spec, and a later archive of E8 renames it)
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

### Requirement: The update request
The contract SHALL define `update`'s request as `askId` and a non-empty list of actions: `add` (`item`, optional `parentId` and `after`: without `parentId` the item goes to the top level, without `after` first, as in `changes`), `change` (`itemId`, `props`), `delete`, `reopen` (`itemId`), `answer` (`itemId`, `answer` of `choice`, `other` and `note`), `reply` (`itemId`, `followUp`, `text`) and `close`. A field the action does not use SHALL fail validation, naming the action's index.

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
The ask state of results, the board state and `collect`'s ask entry SHALL admit `closed`. The board protocol's `closed` message SHALL carry `reason` as an enum holding `agent` and `agent-finished`, the second in the ask lifecycle's minor 1.1, so that a board shows an ask AskBoard closed because its owning subagent finished (AD-10, FR-6). The output format's closed event is push delivery's (Closed event).

#### Scenario: The agent closes an ask
- **WHEN** the agent closes an ask with `update`
- **THEN** `collect`'s entry for it validates with state `closed`, and the board's `closed` message with reason `agent`

#### Scenario: A closed message for a finished subagent
- **WHEN** `board-host` sends a `closed` message with reason `agent-finished`
- **THEN** it validates against the board protocol

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
The contract SHALL hold, as shared constants: the reconnect grace period (120 s), the takeover flush wait, the longest note, "Other…" text, follow-up and reply, the longest option note, preview and annotation, the longest draft record and the longest `fetch` page, the one JSON depth bound (`JSON_MAX_DEPTH`, 64 levels) and the draft record's depth bound, and no unit SHALL define its own.

#### Scenario: The grace period
- **WHEN** `ask-core` starts a grace timer
- **THEN** it uses the contract's grace period of 120 s

#### Scenario: The depth bounds
- **WHEN** `ask-core` and the board page check a result's depth and a draft record's
- **THEN** they use the contract's `JSON_MAX_DEPTH` and draft depth bound, and define none

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

### Requirement: Local API schemas
Every local API request and response SHALL have a JSON Schema 2020-12 schema with its own `$id` in the `urn:askboard:local-api:` namespace, in a set owned by `board-host` with its own semantic version that every message with a body names; a request without a body names the set's major in its path (`/v1/`). Claude Code's fields SHALL keep Claude Code's names (`agent_id`, `agent_type`, `tool_use_id`, `stop_hook_active`); every other field is camelCase (AD-7, Consistency Conventions).

#### Scenario: An agent record validates
- **WHEN** the contract's fixture agent record is validated against the local API's record schema
- **THEN** it passes, and a record carrying an unknown field fails, naming it

#### Scenario: A message from another major
- **WHEN** a local API message names major version 2 and the receiver supports 1
- **THEN** the receiver refuses it with a reason that names version 1

### Requirement: Session file schema
The session file SHALL follow a contract schema with its own `$id`, `urn:askboard:session-file:session-file`: `format` (its version), `key` (the Claude Code PID), `pid`, `epoch`, `apiAddress` (the socket's path), `sessionToken` and `startedAt`, each required; `projectDir`, the session project root, the real path of `CLAUDE_PROJECT_DIR`, only when the session has one; and nothing else (AD-5, AD-12).

#### Scenario: A session file with an extra field
- **WHEN** a session file carries a field the schema does not define
- **THEN** it fails validation, and a client treats the session as unreachable

#### Scenario: A session without a project root
- **WHEN** the session process runs without `CLAUDE_PROJECT_DIR`
- **THEN** its session file has no `projectDir`, and validates

### Requirement: Session folder and paths
The contract SHALL compute the session folder, `$XDG_RUNTIME_DIR/askboard` when that variable is set, else `${TMPDIR:-/tmp}/askboard-<uid>`, and in it the session file `<key>.json` and the socket `<key>.sock`. No unit SHALL compute these paths itself. A socket path longer than the platform's limit SHALL be reported as unusable (AD-5, AD-11).

#### Scenario: The same path from every client
- **WHEN** the session process, a hook and the mod compute the paths for one key and one environment
- **THEN** all three get the same folder, file and socket

#### Scenario: A path over the limit
- **WHEN** the socket path for a key exceeds 103 bytes on macOS
- **THEN** the contract reports it as unusable, naming the limit

### Requirement: Push message schema
The output format SHALL define the push message with its own `$id`, `urn:askboard:output:push-message`: the versions it follows, the epoch, and per ask its ID, state, latest cursor and events, each event with its cursor, as `collect` returns them; a stop block's message also lists the subagent's open asks (AD-3, AD-7).

#### Scenario: A push message validates
- **WHEN** the fixture push message holding the plain-choice answer is validated
- **THEN** it passes, and its ask entry has the same shape as the `collect` result's

### Requirement: Closed event
The output format SHALL define the event that closes an ask AskBoard closed, with its own `$id`, `urn:askboard:output:closed-event`: its cursor, `type: "closed"` and `reason: "agent-finished"`, in the output format's set at the ask lifecycle's minor 1.1 and among `collect`'s events. An agent's own close is reported in its call's result and is not an event. The mod's poll SHALL carry any event `collect` returns (AD-3, AD-10).

#### Scenario: A closed event validates
- **WHEN** the fixture closed event is validated
- **THEN** it passes, and the same event with reason `agent` fails

#### Scenario: A closed event in a collect result
- **WHEN** a `collect` result holds a closed event
- **THEN** it validates against the collect result's schema

#### Scenario: The lifecycle's events in a poll
- **WHEN** a poll response carries a postponed event of the ask lifecycle
- **THEN** it validates, and an event of a type `collect` does not return fails

### Requirement: Board presence message
The board protocol SHALL define the board page's working signal with its own `$id`, `urn:askboard:board-protocol:presence`: whether the board has focus and has had a user input in the last 60 s, and nothing else, so that it never carries content (AD-2, AD-7).

#### Scenario: Presence with content
- **WHEN** a presence message carries any field besides its version, type and working flag
- **THEN** it fails validation

### Requirement: Board origin and agent messages
The board protocol SHALL define two host messages, each with its own `$id`: `urn:askboard:board-protocol:origin`, holding who asked (label, optional name and ordinal), the expected answerer when shown, and the project, directory, branch and worktree, each optional; and `urn:askboard:board-protocol:agent`, holding the agent status, `working` or `waiting` (AD-4, AD-7, FR-24).

#### Scenario: An origin message for an unchecked ask
- **WHEN** an origin message carries a label and a project and no other field
- **THEN** it validates

#### Scenario: An agent message with another status
- **WHEN** an agent message names a status other than `working` or `waiting`
- **THEN** it fails validation

### Requirement: Who asked and where, built in the contract
The contract SHALL provide `originMessage`, which builds the origin message from the session project's folder, the ask's origin with its directory, its agent's name and the expected answerer, using no Node, Bun or DOM API, so that `board-host` and `ask-core` build the same row; a field longer than the schema allows SHALL be left out (AD-1, AD-7, FR-24).

#### Scenario: A branch too long for the schema
- **WHEN** `originMessage` is given an origin whose branch is longer than the schema allows
- **THEN** the message leaves the branch out and validates, and the board shows the branch as unknown

#### Scenario: Imported where Node is not
- **WHEN** a unit compiled without Node, Bun or DOM types, such as `ask-core`, imports `originMessage`
- **THEN** it compiles, and its message equals the one `board-host` sends for the same ask

### Requirement: New schemas are standalone
E4's schemas SHALL be standalone: compiled only by the validate functions that use them, on first call, with the validator's strict options; listed in no existing schema set or ID table; and registered by no module when it is imported. The closed event alone is the output format's, in its set and ID table at the ask lifecycle's minor 1.1 (task 14.5). Additions to the contract's entry modules SHALL be new export blocks only (AD-7).

#### Scenario: Importing the contract
- **WHEN** a module imports the contract's entry points and calls nothing
- **THEN** no schema has been compiled or registered

#### Scenario: Strict compilation
- **WHEN** the contract's tests compile E4's schemas in strict mode
- **THEN** each compiles, has its `$id` in its set's namespace and no root combinator

### Requirement: Asking rules
The contract SHALL hold the asking rules as a closed set, `none`, `always` and `with-references`; each rule's predicate is implemented once, in `hooks` (AD-16, FR-30).

#### Scenario: An unknown rule
- **WHEN** a rule outside the closed set is checked
- **THEN** it is refused as unknown

### Requirement: Push delivery constants
The contract SHALL hold the constants the session process, the hooks and the mod share: the poll interval (1 s), the record timeout, the minimum Claude Code version (2.1.311), the local API response limit (1 MiB), the hooks' request timeout and the working window (60 s) (AD-2, AD-4, AD-5, AD-18).

#### Scenario: One value for every unit
- **WHEN** the mod polls, a hook waits for the local API or the session process checks a client version
- **THEN** the value used is the contract's constant, and no unit defines its own

### Requirement: Push delivery fixtures
The contract SHALL provide fixtures for an agent record of the main conversation and of a subagent, a session file, a push message, a stop block, a pending-asks list, a closed event, and a presence, an origin and an agent message, each validating against its schema (AD-7).

#### Scenario: Every fixture validates
- **WHEN** the contract's tests validate each push delivery fixture
- **THEN** every one passes against its schema

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

#### Scenario: Parameters that do not compile
- **WHEN** a definition's parameters hold a keyword JSON Schema does not define
- **THEN** validation fails, naming `parameters`

### Requirement: Molecule fills
A definition's `fills` SHALL map a top-level parameter to a list of fills, each a JSON Pointer into `items` and a form: copy (the default), `item`, `{entries: <field>}` or `{omit: [keys]}`. A fill SHALL name a parameter its `parameters` declare and a pointer inside the item's props whose parent exists in the composition, and no two fills SHALL fill one place or places inside each other, or the definition SHALL fail validation, naming the fill (AD-9).

#### Scenario: An unknown parameter
- **WHEN** a definition fills from `calendar`, which its parameters do not declare
- **THEN** validation fails, naming `calendar`

#### Scenario: A pointer outside the composition
- **WHEN** a fill's pointer is `/0/props/schedule/start` and the item's props hold no `schedule`
- **THEN** validation fails, naming the pointer

#### Scenario: Two fills on one place
- **WHEN** a fill's pointer lies inside the place another parameter fills
- **THEN** validation fails, naming the later fill's pointer and the other parameter

### Requirement: Molecules carry no code
A molecule definition SHALL be JSON data only, read and never run: no string or key in it SHALL hold `<` or a `javascript:` URL, and no fill form SHALL evaluate anything. A definition that breaks this SHALL fail validation, naming the path (AD-8, NFR-5, FR-17).

#### Scenario: Markup in a definition
- **WHEN** a parameter's `description` holds `<script>alert(1)</script>`
- **THEN** validation fails, naming the path of that string

### Requirement: Molecule data validation
A reference's `data` SHALL be validated in strict mode against its definition's `parameters`, beside every widget props schema of the contract, so that parameters may reference them. A problem SHALL name the reference's item ID and the path in its data (AD-6, AD-10).

#### Scenario: A problem in the data
- **WHEN** the `schedule` reference's `data.start` is `11/02/2026`
- **THEN** validation fails, naming `schedule` and `/start`

### Requirement: Widget item checks
The contract SHALL check any widget item whose type the widget-type registry holds, given the question that holds it and the value's origin, through its type's entry: its props schema, its checks and its checks against the question, a Gantt plan's link included. A type the registry does not hold SHALL be a problem naming the item and its type (AD-7, AD-10).

#### Scenario: A plan whose link fails
- **WHEN** a question holds the Gantt plan `schedule__plan` whose `workPackages` names `wbs__tree`, and no item `wbs__tree`
- **THEN** the check fails, naming `schedule__plan` and `wbs__tree`

#### Scenario: An unknown widget type
- **WHEN** an item's type is `kanban`
- **THEN** the check fails, naming the item and `kanban`

### Requirement: Tree PERT props
A Tree's `pert`, when given, SHALL be `true` and SHALL require columns declaring `optimistic`, `mostLikely` and `pessimistic` as numbers; every estimate SHALL be a number of working days from 0 to 100,000. `openDepth`, an integer from 1 to 8, SHALL be accepted only with `pert`. A Tree breaking a rule SHALL fail validation, naming the node or key (AD-13, F8).

#### Scenario: PERT without its columns
- **WHEN** a Tree with `pert` declares no `pessimistic` column
- **THEN** validation fails, naming `pert` and `pessimistic`

#### Scenario: A negative estimate
- **WHEN** a node of a Tree with `pert` holds `optimistic` `-2`
- **THEN** validation fails, naming the node and `optimistic`

#### Scenario: A depth on a plain Tree
- **WHEN** a Tree without `pert` holds `openDepth` `2`
- **THEN** validation fails, saying that `openDepth` needs `pert`

### Requirement: Tree PERT derived fields
The contract SHALL declare, for a Tree with `pert`, the built-in derived fields `expected` and `spread` on every node and on the item, addressed `<item>.<node>.expected` and `<item>.expected`, which `compute` writes as PERT and its roll-ups (AD-13, FR-15).

#### Scenario: The declared fields
- **WHEN** the Tree's derived fields are read from the contract
- **THEN** they are `expected` and `spread`, on every node and on the item, and only for a Tree with `pert`

### Requirement: WBS answer derived values
The derived values a Tree with `pert` gives an answer SHALL be each node's `expected` and `spread` whose value, rounded half away from zero to two decimals, differs from the board as sent or whose node the agent did not send, and the item's `expected` and `spread` always, each rounded so; a value in error SHALL be left out. An answer that carries the Tree's value SHALL carry these derived values beside it (F7, FR-12, FR-20).

#### Scenario: The approved UJ-2 values
- **WHEN** the UJ-2 work breakdown is computed after the approved answer's edits and compared with the board as sent
- **THEN** its derived values are exactly the approved answer's twelve `wbs.` keys and values, under the Tree's item ID

#### Scenario: An untouched work breakdown
- **WHEN** the user changed nothing in the work breakdown
- **THEN** its derived values are the item's `expected` and `spread` only

### Requirement: Molecule fixtures
The contract SHALL provide, for tests only, the UJ-2 question as the expansion gives it, a Tree `wbs__tree` and a Gantt plan `schedule__plan` over it, and their values after the approved answer's edits. Each SHALL pass the widget item checks, and the diff of each sent and edited value, under its reference's ID, SHALL give the approved answer's operations.

#### Scenario: The fixtures agree
- **WHEN** the contract's tests run
- **THEN** both expanded items and both edited values pass their checks, and the diffs under `wbs` and `schedule` give exactly the approved answer's `wbs.` operations and `set schedule.u-1.dependencies`, compared as a set

### Requirement: Context items in a question
A question's `items` SHALL accept three item types: `excerpt` with exactly one of `pointer` and `text`, and an optional `title`; `reference` with exactly one of `pointer` and `url`, and an optional `title`; `image` with `pointer` and a required `alt`. Each refuses every other field, so no image data or image URL enters tool input (AD-7, AD-12, FR-8, FR-9).

#### Scenario: The approved UJ-1 excerpt
- **WHEN** the input format validates `{type: "excerpt", id: "retry-adr", props: {pointer: "docs/adr/0012-payment-retries.md#Decision"}}` inside a question's `items`
- **THEN** it passes

#### Scenario: An excerpt with both forms
- **WHEN** an excerpt holds both `pointer` and `text`
- **THEN** the request is refused with a problem naming the item and saying that an excerpt takes exactly one of them

#### Scenario: An image sent as data
- **WHEN** an `image` item holds a `data`, `src` or `url` field
- **THEN** the request is refused as a schema error naming the item and the field

#### Scenario: An image without alt text
- **WHEN** an `image` item has no `alt`
- **THEN** the request is refused, naming the item and `alt`

### Requirement: Web reference URLs
A reference's `url` SHALL be an absolute URL with the scheme `http` or `https`, a host, and no user name or password, of at most the contract's URL limit; any other is a request error naming the item (AD-8, FR-9).

#### Scenario: A script URL
- **WHEN** a reference's `url` is `javascript:alert(1)`, `data:text/html,…`, `file:///etc/passwd` or `vbscript:…`
- **THEN** the request is refused, naming the item and saying that only `http` and `https` URLs are accepted

#### Scenario: A URL with credentials
- **WHEN** a reference's `url` is `https://user:secret@example.com/`
- **THEN** the request is refused, naming the item

### Requirement: The pointer grammar
The contract SHALL hold one function that reads a pointer: the text up to the first `#` is a root-relative path; what follows is the anchor, a line range when it is `L<start>-L<end>` with `1 ≤ start ≤ end`, otherwise a heading or an ID. A pointer whose path is empty, starts with `/`, holds a backslash, a control character, or an empty, `.` or `..` segment SHALL read as invalid, with its reason (Consistency Conventions, "Excerpts and media").

#### Scenario: A line range
- **WHEN** the pointer `src/retry.ts#L40-L62` is read
- **THEN** it gives the path `src/retry.ts` and the line range 40 to 62

#### Scenario: A heading
- **WHEN** the pointer `docs/prd.md#Billing` is read
- **THEN** it gives the path `docs/prd.md` and the heading or ID anchor `Billing`

#### Scenario: Paths that leave the root by their text
- **WHEN** the pointers `../secret.md#A`, `docs/../../x.md#A`, `/etc/passwd#L1-L2`, `docs//x.md#A`, `./docs/x.md#A` and `docs\x.md#A` are read
- **THEN** each reads as invalid, with its reason, and nothing touches the file system

#### Scenario: A reversed range
- **WHEN** the pointer `a.md#L9-L3` is read
- **THEN** its anchor is not a line range

### Requirement: Resolved context in the board document
The board document SHALL hold, for each pointer excerpt, its pointer, status (`resolved` or `unresolved`), and either its source text, media type and line range or its reason; for each agent-written excerpt, its text; for each image, its pointer, alt text, status, and either its media type and bytes in base64 or its reason; for each reference, its kind (`file`, `github` or `web`) and, for a pointer, its status and line range or reason (AD-12).

#### Scenario: A resolved excerpt
- **WHEN** a board document holds an excerpt with status `resolved`
- **THEN** it validates only with its text, its media type and a line range whose start is at most its end

#### Scenario: An unresolved image
- **WHEN** a board document holds an image with status `unresolved`
- **THEN** it validates only with a reason and without bytes

### Requirement: The unresolved-pointer warning
The output format's warning SHALL admit the code `unresolved-pointer`, carrying the item ID, the pointer, the reason (`no-root`, `invalid-pointer`, `outside-root`, `not-found`, `not-a-file`, `anchor-not-found`, `not-text`, `not-image`, `too-large`, `timeout`) and a message (AD-6, FR-8).

#### Scenario: A heading that does not exist
- **WHEN** an `ask` result warns that `retry-adr` points at a heading the file lacks
- **THEN** the warning validates with code `unresolved-pointer`, item `retry-adr`, its pointer and reason `anchor-not-found`

### Requirement: The source view route
The contract SHALL define the route `GET /s/<askId>/<itemId>` with the board token in the query parameter `t` and an optional `scheme` of `light` or `dark`, and what it answers: the source view page, 403 without a token that opens that ask's board, 410 for a discarded ask, 404 for an item that is no pointer excerpt or pointer reference of the ask. Both IDs follow the ID pattern (AD-8, AD-11).

#### Scenario: A path that is not a source route
- **WHEN** `/s/<askId>/../m`, `/s/<askId>`, `/s/<askId>/<itemId>/x` or `/s/%2e%2e/<itemId>` is parsed
- **THEN** it names no route

### Requirement: The source view's policy
The contract SHALL hold the source view's CSP: `default-src 'none'`, its stylesheet by hash, `img-src data:`, `frame-ancestors 'self'`, `base-uri 'none'` and `form-action 'none'`, and nothing else (AD-8).

#### Scenario: No script source
- **WHEN** the source view's policy is read
- **THEN** it names no `script-src`, no `'unsafe-inline'`, no `'unsafe-eval'` and no host

### Requirement: Reading panel and editor messages
The board protocol SHALL carry, page to host, `open-source` and `open-editor`, each naming one item; and host to page, `source-state` (the item, its status, whether the excerpted range changed, the current line and whether an editor can open it) and `editor-outcome` (`opened`, `no-editor`, `unavailable`, `failed` or `busy`). No message carries a path the page chose (AD-8).

#### Scenario: A message that names a file
- **WHEN** a page sends `open-source` holding a `path` field
- **THEN** it is refused as a schema error

### Requirement: Context placement in the draft record
The draft record's question SHALL admit `context`, `beside` or `inline`, the user's choice for that question (AD-20, FR-13).

#### Scenario: A placement kept in the draft
- **WHEN** a draft record question holds `context: "inline"`
- **THEN** it validates, and a value other than `beside` or `inline` is refused

### Requirement: Context limits
The contract SHALL hold the limits every unit reads for context: pointer, title, alt text and URL lengths; the largest file searched for an anchor; an excerpt's lines and bytes; an image's bytes and an ask's image bytes; the source view's bytes and lines; concurrent reads; the resolution budget. No unit SHALL define its own.

#### Scenario: One limit, one place
- **WHEN** `excerpts`, `ask-core` and `board-host` check an excerpt's length
- **THEN** each reads the same contract constant

### Requirement: Snapshot data schema set
The contract SHALL hold the `snapshot-data` set at version 1.0, owned by `snapshot` (AD-7), whose one schema describes a Snapshot's `askboard-data` block. Like every set, it SHALL refuse fields it does not define and SHALL have no root combinator.

#### Scenario: The set is listed
- **WHEN** the contract's schema sets are listed
- **THEN** `snapshot-data` is among them at 1.0, with `snapshot` as its owner

### Requirement: What the Snapshot data names
The Snapshot data SHALL name its versions (the set's, the output format's and the board protocol's), the epoch and the ask ID, and SHALL hold the Snapshot's record: `takenAt` in UTC, `takenBy` (`agent` or `user`), `who` for the user's, and `unsentWork: true` only for a board's Snapshot taken with unsent work (AD-15).

#### Scenario: The agent's Snapshot
- **WHEN** the Snapshot data of an agent's Snapshot is validated
- **THEN** it passes with `takenBy: "agent"`, a UTC `takenAt` and no `who` or `unsentWork`

#### Scenario: A user's Snapshot without its taker
- **WHEN** Snapshot data with `takenBy: "user"` and no `who` is validated
- **THEN** it fails, naming `who`

### Requirement: What the Snapshot data holds
The Snapshot data SHALL hold the current board document, the earlier revisions its events name, the board state as the board protocol carries it, the ask's origin as the board protocol's `origin` message carries it when known, and every event of the log, each with the full values kept for its answer; optionally the molecule expansion map and kept diagram renders (AD-15, open questions A1 and A2).

#### Scenario: The fixture validates
- **WHEN** the contract's Snapshot data fixture, with areas, a postponed question, a thread with a reply, a recorded answer and a revised answer, is validated
- **THEN** it passes against the `snapshot-data` schema

#### Scenario: A draft in the data
- **WHEN** Snapshot data carries a `draft` field
- **THEN** it fails validation, naming the field

### Requirement: The snapshot tool's envelopes
The tool envelopes SHALL define the `snapshot` request as the approved definition's input schema (`askId` only) and its result: the versions, epoch, ask ID, the ask's state, the file's absolute `path`, and `unchecked: true` for an ask without an owner; and the typed result `discarded` naming the ask (AD-6, FR-26).

#### Scenario: A result validates
- **WHEN** the Snapshot fixture's `snapshot` result is validated against the `snapshot` result envelope
- **THEN** it passes and names a result and an output version

#### Scenario: A relative path
- **WHEN** a `snapshot` result whose `path` does not start with `/` is validated
- **THEN** it fails, naming `path`

### Requirement: The approved snapshot definition
The contract's tool definitions SHALL be the approved `ask`, `update`, `collect`, `fetch` and `snapshot`, in that order, equal to the approved `tools.json`, with `snapshot`'s description and annotations unchanged (`destructiveHint: false`, `openWorldHint: false`). The server instructions SHALL stay the approved text.

#### Scenario: The tool definitions
- **WHEN** the contract's tool definitions are compared with the approved `tools.json`
- **THEN** they are equal, all five entries in order

### Requirement: Snapshot messages on the board protocol
The board protocol SHALL define, page to host, `snapshot` with a `requestId` and an optional `unsentWork: true`; and host to page, `snapshot-saved` with the `requestId` and the file's absolute `path`, and `snapshot-failed` with the `requestId`, a `reason` of `write-failed`, `no-project-root`, `internal-error` or `discarded`, and the Snapshot folder's path for `write-failed` only (FR-26, AD-12).

#### Scenario: A request without its ID
- **WHEN** a `snapshot` message without `requestId` is validated
- **THEN** it fails, naming `requestId`

#### Scenario: A failure inside AskBoard names no folder
- **WHEN** a `snapshot-failed` with the reason `internal-error` and a `folder` is validated
- **THEN** it fails, naming `folder`

#### Scenario: The recorded exchange
- **WHEN** the recorded transcript of a board's Snapshot, saved and then failed, is validated in both directions
- **THEN** every message passes

### Requirement: Host-only and kept-render chunks
The view manifest SHALL admit, at its next minor, an optional `hostOnly: true` on a chunk needed only when the view has a parent host, and an optional `keptRender` on a component chunk naming the chunk that shows its kept renders (AD-9, open questions B2 and B3).

#### Scenario: A host-only chunk
- **WHEN** a manifest whose ext-apps chunk carries `hostOnly: true` is validated
- **THEN** it passes

#### Scenario: A kept-render chunk that does not exist
- **WHEN** a manifest names in `keptRender` a chunk it does not list
- **THEN** the view build's manifest check fails, naming both chunks

### Requirement: Snapshot constants
The contract SHALL hold, as shared constants, the default Snapshot folder `.askboard/snapshots`, the lines of `.askboard/.gitignore`, the file-name pattern, the random part's length and alphabet, the number of names tried, and the IDs of the `askboard-data` and `askboard-licences` elements; no unit SHALL define its own.

#### Scenario: The data element's ID
- **WHEN** `assemble` writes a Snapshot and the contract's tests read the element ID
- **THEN** both use the contract's `askboard-data`

### Requirement: Snapshot registrations are appended
Every schema, export and fixture this change adds SHALL be registered by entries appended after the existing ones (`sets.ts`, `SCHEMA_IDS`, the board protocol's message lists, and one export block at the end of `src/index.ts`, `src/validate.ts` and `src/fixtures/index.ts`), and importing the contract SHALL register nothing.

#### Scenario: Existing order kept
- **WHEN** the contract's sets, schema IDs and board-protocol messages are listed
- **THEN** the entries before this change's keep their order, and this change's follow them

### Requirement: The configuration schema set
The contract SHALL hold the `configuration` schema set, owned by `ask-core`, starting at `1.0`, for both configuration files (AD-7, AD-14). A file SHALL name its `version` as `major.minor`. It SHALL allow `theme` (`system`, `light`, `dark`), `density` (`compact`, `comfortable`), `contextPlacement` (`beside`, `inline`), `defaultLanguage` (`en-US`, `it-IT`), `askingRule` (`none`, `always`, `with-references`), `snapshotFolder`, `editor` and `defaultMinimumMargin`, each optional.

#### Scenario: A file with every key validates
- **WHEN** the fixture holding `version` `1.0` and one valid value for each of the eight keys is validated against the configuration schema
- **THEN** it passes

#### Scenario: A value outside a key's set is refused, naming the key
- **WHEN** a file sets `theme` to `"sepia"` or `askingRule` to `"sometimes"`
- **THEN** validation fails with a problem whose path names that key

#### Scenario: A file without its version is refused
- **WHEN** a file holds `{"theme": "dark"}`
- **THEN** validation fails, naming `version`

#### Scenario: An unknown key passes the schema
- **WHEN** a file holds `version` `1.0` and a key `fontSize`
- **THEN** the schema passes it, and the contract's list of configuration keys does not hold `fontSize`

### Requirement: The editor key is an argument vector
`editor` SHALL be a non-empty list of non-empty strings whose first is the program, at most 32 strings of at most 1,024 characters each; `{file}` and `{line}` are its only placeholders (AD-8). A string, an empty list or a list holding a non-string SHALL fail validation.

#### Scenario: A command line as one string is refused
- **WHEN** a file sets `editor` to `"code --goto {file}:{line}"`
- **THEN** validation fails, naming `editor`

#### Scenario: An argument vector validates
- **WHEN** a file sets `editor` to `["code", "--goto", "{file}:{line}"]`
- **THEN** it passes

### Requirement: The presentation keys are a closed list
The contract SHALL name `theme`, `density` and `contextPlacement` as the presentation keys, the only keys a board may write, and SHALL name every other key of the configuration set as not writable from a board (AD-14).

#### Scenario: The writable keys
- **WHEN** a test reads the contract's presentation keys
- **THEN** they are exactly `theme`, `density` and `contextPlacement`

### Requirement: An ask's language and locale
The input format SHALL accept `language` and `locale`, each optional, each `en-US` or `it-IT` (FR-34, AD-7). Any other value SHALL fail validation, naming the field. This replaces E1's en-US-only rule.

#### Scenario: An Italian ask validates
- **WHEN** an ask sets `language` to `it-IT` and no `locale`
- **THEN** it passes

#### Scenario: English with Italian formats validates
- **WHEN** an ask sets `language` to `en-US` and `locale` to `it-IT`
- **THEN** it passes

#### Scenario: Another language is refused
- **WHEN** an ask sets `language` to `fr-FR`
- **THEN** validation fails with a problem naming `language` and saying that `en-US` and `it-IT` are accepted

### Requirement: The board document names the ask's language and locale
The board document SHALL carry the ask's resolved `language` and `locale` at its root, each `en-US` or `it-IT`. A board document without them SHALL be read as `en-US` for both, so an older Snapshot still opens (AD-12, FR-34).

#### Scenario: A board document in Italian
- **WHEN** a board document with `language` and `locale` set to `it-IT` is validated
- **THEN** it passes

#### Scenario: An older board document
- **WHEN** a board document of an earlier minor, without either field, is read by the view
- **THEN** the view shows it in English with en-US formats

### Requirement: Settings messages on the board protocol
The board protocol SHALL add the message `settings`, host to page, carrying the presentation and behaviour settings in effect, each with its value and the file and key that set it, and `setting`, page to host, carrying one key and one value. The schema of `setting` SHALL admit only the presentation keys, each with a value the configuration schema allows (AD-14).

#### Scenario: A presentation write validates
- **WHEN** the page sends `setting` with `key` `density` and `value` `comfortable`
- **THEN** the message passes the board-protocol schema

#### Scenario: Any other key fails the schema
- **WHEN** the page sends `setting` with `key` `editor`, `askingRule` or `snapshotFolder`, or with `theme` set to `"sepia"`
- **THEN** the message fails the board-protocol schema

### Requirement: Locale formats
The contract SHALL format numbers, money, percentages, calendar dates and times for `en-US` and `it-IT` with its own tables, giving the same text whatever the runtime's locale and time zone (AD-7, AD-13). Calendar dates SHALL never pass through a time zone; a time SHALL show at the UTC offset it is given, which the view takes from the viewer's time zone.

#### Scenario: The same value in both locales
- **WHEN** 12480 EUR, 1234.5, 0.185 as a percentage and the date `2026-10-27` are formatted
- **THEN** en-US gives `€12,480.00`, `1,234.5`, `18.5%` and `10/27/2026`, and it-IT gives `€ 12.480,00`, `1.234,5`, `18,5%` and `27/10/2026`

#### Scenario: A time in each locale
- **WHEN** `2026-10-28T15:12:00Z` is formatted as a date and time at the offset `+01:00`
- **THEN** en-US gives `Oct 28, 2026, 4:12 PM` and it-IT gives `28 ott 2026, 16:12`

#### Scenario: The runtime's locale and time zone change nothing
- **WHEN** the locale fixtures run under `TZ=Pacific/Kiritimati` and `TZ=America/Adak` and under the runtime locales `en-US` and `de-DE`
- **THEN** every result equals the fixture's, and `2026-10-27` formats as the same day in each run

### Requirement: Number entry in the ask's locale
The contract SHALL read a number typed in the ask's locale and return a number, an empty entry or a refusal with a reason in the ask's language (EXPERIENCE, Input atoms). In it-IT, `,` SHALL be the one decimal mark and `.` SHALL stand only between groups of three digits; an entry that breaks either SHALL be refused. The echo SHALL write the value without grouping.

#### Scenario: An Italian entry with grouping and decimals
- **WHEN** `1.234,5` is read in it-IT
- **THEN** it reads as 1234.5, and its echo is `= 1234,5`

#### Scenario: An English habit in Italian is refused
- **WHEN** `1234.5` or `1.23` is read in it-IT
- **THEN** it is refused with the reason "Usa i punti solo tra gruppi di tre cifre, come in 1.234,5."

#### Scenario: The en-US rules are unchanged
- **WHEN** `1,234.5` is read in en-US
- **THEN** it reads as 1234.5, and its echo is `= 1234.5`

### Requirement: Date entry in the ask's locale
The contract SHALL read a calendar date typed in the ask's locale, in en-US as `M/D/YYYY` and in it-IT as `D/M/YYYY`, and in both as `YYYY-MM-DD`, and SHALL refuse a day that does not exist, with a reason in the ask's language. The echo SHALL name the weekday as the ask's locale writes a long date.

#### Scenario: An Italian date
- **WHEN** `9/12/2026` is read in it-IT
- **THEN** it reads as `2026-12-09`, and its echo is `= mer 9 dic 2026`

#### Scenario: The same text in English
- **WHEN** `9/12/2026` is read in en-US
- **THEN** it reads as `2026-09-12`, and its echo is `= Sat, Sep 12, 2026`

#### Scenario: A day that does not exist
- **WHEN** `31/11/2026` is read in it-IT
- **THEN** it is refused with a reason in Italian

### Requirement: The widening as the next minor
The input format, output format, tool envelopes, board document and board protocol SHALL each take the minor after what `main` holds when this change rebases, adding only optional fields, enum values and schemas, so a receiver on the earlier minor refuses each new field as a schema error (AD-7): input format 1.4 (after 1.3), output format 1.3 (after 1.2), tool envelopes 1.4 (after 1.3), board document 1.4 (after 1.3) and board protocol 1.5 (after 1.4).

#### Scenario: The five versions
- **WHEN** the contract's schema sets are listed
- **THEN** the input format names 1.4, the output format 1.3, the tool envelopes 1.4, the board document 1.4 and the board protocol 1.5, each with the owner AD-7's table gives it, and the view manifest keeps its version

#### Scenario: A board protocol 1.4 receiver meets a widget answer
- **WHEN** a receiver that supports board protocol 1.4 gets an `act` whose answer carries `values`
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
The board document's questions SHALL hold their widget items as `ask-core` expanded them, among the resolved context items of excerpts and in the same list, of the types the widget-type registry holds only, with the props each item's schema defines; a `molecule` item SHALL fail the board document's validation (AD-9, AD-12).

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
- **THEN** it validates against board protocol 1.5

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
- **THEN** the warning validates with code `formula`, item `schedule` and kind `missing-reference`, and takes none of the `pointer` and `reason` fields of an `unresolved-pointer` warning

#### Scenario: A formula warning in an update result
- **WHEN** an `update` result, whose `warnings` field the excerpts change already admits, carries a `formula` warning
- **THEN** it validates against the `update` result envelope

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

### Requirement: The approved UJ-2 example validates whole
The approved `uj2-wbs-gantt` ask, `ask` result and `collect` answer SHALL validate against the full contract at its current minors, and the contract's fixtures SHALL hold the UJ-2 board document and the logged answer the end-to-end scenario expects.

#### Scenario: The approved files
- **WHEN** `asks/uj2-wbs-gantt.json`, `results/uj2-wbs-gantt.json` and `answers/uj2-wbs-gantt.json` are validated against the input format, the `ask` result and the `collect` result
- **THEN** each passes unchanged

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

### Requirement: Asking-rule texts
The contract SHALL hold one agent-facing text for each asking rule of its closed set, in the set's order, and no text for a name outside it. The `with-references` text SHALL be the text that describes the hook's predicate (AD-16, FR-30).

#### Scenario: One text per rule
- **WHEN** the asking-rule texts are read
- **THEN** there is exactly one non-empty text for each of `none`, `always` and `with-references`, in that order

#### Scenario: The with-references text
- **WHEN** the `with-references` text is compared with the description of the hook's predicate
- **THEN** they are the same text

### Requirement: A widget type's teaching text
A widget type's registry entry MAY carry teaching text: when to use the widget, 1 to 200 characters, and notes, each 1 to 300 characters. The registry check SHALL refuse teaching text outside those bounds or of another shape, naming the type, and SHALL report it rather than stop, so that the other entries' problems are reported too; every shipped type SHALL carry teaching text (FR-29).

#### Scenario: Shipped types carry teaching text
- **WHEN** the shipped registry is read
- **THEN** every entry has a teaching text of 1 to 200 characters

#### Scenario: A teaching text too long
- **WHEN** the registry check runs on an entry whose teaching text has 201 characters
- **THEN** it reports a problem naming the type

#### Scenario: A teaching text of another shape
- **WHEN** the registry check runs on entries one of which has a teaching text that is not an object, or notes that are not a list
- **THEN** it reports a problem naming that type, and still reports the other entries' problems

### Requirement: Approval items
The registry SHALL hold `approval`, whose props are an empty object and whose result is `{decision}`, one of `approve`, `approve-with-changes` or `reject`, with no other field. The reason SHALL travel as the answer's note, never in the result (FR-11, FR-18, AD-7).

#### Scenario: An Approval in a question
- **WHEN** an ask holds a question whose `items` hold `{type: "approval", id: "verdict", props: {}}`
- **THEN** it passes

#### Scenario: Props the Approval does not define
- **WHEN** an Approval's props hold a field, such as `summary`
- **THEN** validation fails, naming the item and the field

#### Scenario: The approved UJ-3 answer's result
- **WHEN** the result `{decision: "approve-with-changes"}` of the approved `uj3-sales-review` answer is checked as an Approval's result
- **THEN** it passes, and `{decision: "maybe"}` and `{decision: "approve", reason: "ok"}` fail, naming the field

### Requirement: Scale items
The registry SHALL hold `scale`: `min` and `max` within ±1,000,000,000 with `max` above `min`, an optional `step` above 0 (1 when absent) dividing `max − min` into at most 1,000 steps, optional `range` and `display` (`slider` or `rating`), and optional `minLabel`, `maxLabel` (1 to 60 characters) and `unit` (1 to 20). A rating SHALL hold at most 11 values, one toggle for each value from `min` to `max`, and no range (FR-11).

#### Scenario: A slider and a rating
- **WHEN** an ask holds a Scale `{min: 0, max: 100, step: 5, unit: "%"}` and a Scale `{min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High"}`
- **THEN** it passes

#### Scenario: Steps that do not divide the scale
- **WHEN** a Scale has `min` 0, `max` 10 and `step` 3, or `max` equal to `min`, or 2,000 steps
- **THEN** validation fails, naming the item and the field

#### Scenario: A rating range
- **WHEN** a Scale has `display: "rating"` with `range: true`, or a rating from 0 to 20
- **THEN** validation fails, naming the item and saying a rating takes one value out of at most 11

#### Scenario: Eleven values and twelve
- **WHEN** a Scale has `display: "rating"` from 0 to 10, and another from 0 to 11
- **THEN** the first passes, and the second fails, naming the item and saying a rating takes one value out of at most 11 and that this scale has 12 values

### Requirement: Scale results
A Scale's result SHALL be `{value}` when its props have no `range`, else `{low, high}` with `low` not above `high`, the two compared as numbers; each number SHALL lie within `min` and `max` exactly, and on a step: `min` plus a whole number of steps within the grid's tolerance, a billionth of a step or, when wider, eight times the double precision (`Number.EPSILON`) of the larger of `|min|` and the number. The tolerance applies to the step grid only, never to the bounds (FR-11, FR-18, AD-10).

#### Scenario: A step a double cannot hold exactly
- **WHEN** a Scale from 1000000 to 1000001 by 0.001 receives, for each of its 1,001 steps, the double nearest `min` plus that many steps
- **THEN** each passes, while a value half a step off still fails

#### Scenario: A value on a step
- **WHEN** a result `{value: 35}` is checked for a Scale from 0 to 100 by 5
- **THEN** it passes, and `{value: 37}`, `{value: 105}` and `{low: 10, high: 20}` fail, naming the item and the field

#### Scenario: A range
- **WHEN** a result `{low: 20, high: 20}` is checked for a Scale with `range`
- **THEN** it passes, and `{low: 30, high: 20}` and `{value: 20}` fail

#### Scenario: Decimal steps
- **WHEN** a result `{value: 0.3}` is checked for a Scale from 0 to 1 by 0.1
- **THEN** it passes

#### Scenario: A hair outside the bounds
- **WHEN** a result `{value: 10.0000000005}` (`max` plus 5e-10) or `{value: -0.0000000005}` (`min` minus 5e-10) is checked for a Scale from 0 to 10 by 1
- **THEN** it fails, naming the item and the field, though each lies within a billionth of a step of a step

#### Scenario: A range a hair inverted
- **WHEN** a result `{low: 5.0000000001, high: 5}` or `{low: 5, high: 4.9999999999}` is checked for a Scale from 0 to 10 by 1 with `range`
- **THEN** each fails at `/low`, saying `low` is above `high`, though both lie within a billionth of a step of the same step; `{low: 5, high: 5}` passes

### Requirement: Ranking items
The registry SHALL hold `ranking`, whose props hold `items`: 2 to 50 elements `{id, label, description?}`, IDs matching the ID pattern and unique within the item, `label` 1 to 200 characters, `description` 1 to 500 (FR-11, AD-7).

#### Scenario: A Ranking in a question
- **WHEN** an ask holds a Ranking of three items with distinct IDs
- **THEN** it passes

#### Scenario: A repeated ID
- **WHEN** a Ranking's items hold the ID `speed` twice
- **THEN** validation fails, naming the item and the element `speed`

#### Scenario: One item
- **WHEN** a Ranking holds a single item
- **THEN** validation fails, naming the item and `items`

### Requirement: Ranking results
A Ranking's result SHALL be `{order}`, the IDs of the item's elements as sent in the answer's revision, each exactly once (FR-11, FR-18).

#### Scenario: Every ID once
- **WHEN** a result naming each of the three items once, in another order, is checked
- **THEN** it passes

#### Scenario: A missing, extra or repeated ID
- **WHEN** a result leaves out `cost`, names `color` the item does not hold, or names `speed` twice
- **THEN** it fails, naming the item and the element

### Requirement: What a result requires of its answer
A registered type MAY declare checks of the answer its result travels in, given the answer's note and whether the answer changes any element; a refusal SHALL name the item. The Approval SHALL refuse `approve-with-changes` without a note holding a character other than white space, white space being what ECMAScript's `\s` matches and U+0085 (NEXT LINE), one predicate shared by the Approval's checks and the board page, and `approve` in an answer that changes an element (FR-11, AD-10, F-63).

#### Scenario: Approving with changes needs the reason
- **WHEN** the Approval's checks run on `{decision: "approve-with-changes"}` with no note, or with a note of three spaces
- **THEN** each fails, naming the item and saying approving with changes needs the reason in the note

#### Scenario: A note of invisible white space
- **WHEN** the Approval's checks run on `{decision: "approve-with-changes"}` with a note of `"\u0085"`, of `" \u0085\t"` or of `"\uFEFF"`
- **THEN** each fails as a note with no reason does

#### Scenario: Approving beside changes
- **WHEN** the Approval's checks run on `{decision: "approve"}` in an answer that changes an element
- **THEN** it fails, naming the item and saying an answer that changes the content approves with changes

#### Scenario: Rejecting beside changes
- **WHEN** the Approval's checks run on `{decision: "reject"}` in an answer that changes an element, with no note
- **THEN** it passes

### Requirement: A result that holds itself
The contract's test of a result that holds nothing SHALL end for any value, one that holds itself or is nested a million levels deep included, and SHALL read each object it reaches once (AD-10, NFR-10).

#### Scenario: A value that holds itself
- **WHEN** the test runs on an object whose field holds the object itself, and on an array holding itself beside `""`
- **THEN** it returns, saying each holds nothing, within the test's time limit

#### Scenario: A deep value
- **WHEN** the test runs on an array nested a million levels with `1` at the bottom
- **THEN** it returns, saying the value holds something

### Requirement: Teaching text of the three widgets
The `approval`, `scale` and `ranking` entries SHALL each carry the teaching text the skill's references are generated from, within its bounds, and each entry's example item SHALL be accepted in an ask (FR-29, AD-6).

#### Scenario: The registry's own check
- **WHEN** the registry's own check runs over the shipped registry
- **THEN** it passes, the three types' result schemas refusing every result that holds nothing

#### Scenario: The skill names the three
- **WHEN** the skill is generated from the shipped registry
- **THEN** its item index lists Tree, Gantt, Approval, Scale and Ranking in that order, and each of the three has a reference with its result's fields

### Requirement: Approval, Scale and Ranking in the sets' next minors
The input format, the output format, the tool envelopes and the board document SHALL each take the next minor after the one `main` holds, admitting the three types' items, props and results; every other set SHALL keep `main`'s version (AD-7).

#### Scenario: The previous minor
- **WHEN** an ask holding an Approval is validated by the input format's previous minor
- **THEN** it fails, naming the item and its type

#### Scenario: A fetch of a Ranking alone
- **WHEN** a `fetch` result holds a Ranking item with its `result`
- **THEN** it validates, and the same item with a Scale's result fails at `/item/result`

#### Scenario: Sets this change leaves alone
- **WHEN** the version constants are read after this change
- **THEN** the board protocol, the Snapshot data, the view manifest, the configuration, the local API and the session file equal `main`'s
