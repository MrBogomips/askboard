# Spec Delta

## Purpose

The contract is AskBoard's one shared language: the versioned JSON Schema sets, ID rules and constants for every message that crosses a unit boundary at run time, with the fixtures that hold them to the approved model contract (AD-7).

## ADDED Requirements

### Requirement: Standalone widget schemas
A widget's item props and its `changes` SHALL be schemas of their own in the contract, with the `$id`s `urn:askboard:input:<name>-props` and `urn:askboard:output:<name>-changes`, compiled in strict mode by the contract's widget validator beside every contract schema they reference. A `changes` schema SHALL take its operations from the output format's change. Until the input format reaches 1.1, they SHALL belong to no schema set (AD-7).

#### Scenario: The Tree's schemas compile
- **WHEN** the Tree's props and changes schemas are compiled in strict mode in a validator made by `createAjv`
- **THEN** both compile, both are JSON Schema 2020-12, their `$id`s are `urn:askboard:input:tree-props` and `urn:askboard:output:tree-changes`, neither has a root combinator, and the changes schema's items are the output format's change

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
The contract SHALL define a Tree item's props in the schema `urn:askboard:input:tree-props`, checked by `validateTreeProps`, as optional `columns`, each `{field, label, type}` with `type` `text` or `number`, and `nodes`, each `{id, label, children?}` plus a value for any declared field: a string for `text`, a number for `number`, absent when empty. Any other key SHALL fail validation, naming the node and the key. No ask SHALL carry a Tree until the input format admits one in a question's items.

#### Scenario: The UJ-2 work breakdown as a Tree
- **WHEN** the nodes of the approved `uj2-wbs-gantt` ask's `wbs` data, without their `excerpt` pointers, are validated as a Tree whose columns declare `optimistic`, `mostLikely` and `pessimistic` as numbers
- **THEN** they pass

#### Scenario: An undeclared field
- **WHEN** a node carries `owner` and no column declares it
- **THEN** validation fails, naming the node's ID and the field `owner`

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
The contract SHALL define a Tree's `changes` in the schema `urn:askboard:output:tree-changes`, checked by `validateTreeChanges`, as a list of the output format's changes (AD-20) with the Tree's rules: `add`, `remove` and `move` target `item.node`; an `add`'s `value` holds the node's name and fields, without `id` or children; `set` targets `item.node.field`, the field `label` or a declared one, with a value of its type, or `null` to empty a field other than `label`.

#### Scenario: The approved UJ-2 answer
- **WHEN** the operations of `answers/uj2-wbs-gantt.json` whose target starts with `wbs.` are validated as Tree changes
- **THEN** every one passes, the `add` of `u-1` under `build` after `portal` included

#### Scenario: A set on the children
- **WHEN** a `set` operation targets `wbs.build.children`
- **THEN** validation fails, naming the target

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
