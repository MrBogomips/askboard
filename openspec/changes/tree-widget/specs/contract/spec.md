# Spec Delta

## Purpose

The contract is AskBoard's one shared language: the versioned JSON Schema sets, ID rules and constants for every message that crosses a unit boundary at run time, with the fixtures that hold them to the approved model contract (AD-7).

## ADDED Requirements

### Requirement: Tree item props
The input format SHALL define a Tree item's props as optional `columns`, each `{field, label, type}` with `type` `text` or `number`, and `nodes`, each `{id, label, children?}` plus a value for any declared field: a string for `text`, a number for `number`, absent when empty. Any other key SHALL fail validation, naming the node and the key. No ask SHALL carry a Tree until the input format admits one in a question's items.

#### Scenario: The UJ-2 work breakdown as a Tree
- **WHEN** the nodes of the approved `uj2-wbs-gantt` ask's `wbs` data, without their `excerpt` pointers, are validated as a Tree whose columns declare `optimistic`, `mostLikely` and `pessimistic` as numbers
- **THEN** they pass

#### Scenario: An undeclared field
- **WHEN** a node carries `owner` and no column declares it
- **THEN** validation fails, naming the node's ID and the field `owner`

#### Scenario: A value of the wrong type
- **WHEN** a node holds the text `"five"` in a `number` column
- **THEN** validation fails, naming the node's ID and the field

### Requirement: Tree node IDs
Node IDs SHALL match `[A-Za-z0-9_-]{1,64}` and be unique within their item, at every level. A node ID the agent chooses SHALL NOT start with the view-made prefix `u-`; an edited value from the view MAY hold nodes whose IDs start with it (AD-7, finding F10).

#### Scenario: One ID at two levels
- **WHEN** a parent and one of its grandchildren share the ID `design`
- **THEN** validation fails, naming the repeated ID

#### Scenario: The agent uses the view's prefix
- **WHEN** the agent's nodes hold one with the ID `u-1`
- **THEN** validation fails, saying that the prefix `u-` is reserved for IDs the board makes

#### Scenario: A node the user added
- **WHEN** an edited value from the view holds a node `u-1`
- **THEN** it passes validation as an edited value

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
The output format SHALL define a Tree's `changes` as AD-20's generic diff: `add` and `move` with `target` `item.node`, `parent` and `after` each a node ID or `null`, and for `add` a `value` holding the node's name and fields without children; `remove` with `target` only; `set` with `target` `item.node.field`, `label` included, and a value of the field's type, or `null` to empty a field other than `label`.

#### Scenario: The approved UJ-2 answer
- **WHEN** the operations of `answers/uj2-wbs-gantt.json` whose target starts with `wbs.` are validated as Tree changes
- **THEN** every one passes, the `add` of `u-1` under `build` after `portal` included

#### Scenario: An add without its position
- **WHEN** an `add` operation leaves out `after`
- **THEN** validation fails, naming the missing field

#### Scenario: A set on the children
- **WHEN** a `set` operation targets `wbs.build.children`
- **THEN** validation fails, naming the target

### Requirement: Computing a Tree's changes
Given an item's props as sent and as edited, the contract's diff SHALL return the operations that, applied in order to the sent nodes, give the edited nodes. It SHALL address nodes by ID, never by position, list no operation for an untouched node or field, list one `remove` for a removed node and none for its removed descendants, and return no operation for a tree that ends as it was sent (AD-10, AD-20, FR-20).

#### Scenario: Nothing changed
- **WHEN** the edited value equals the sent one
- **THEN** the diff returns no operation

#### Scenario: Three changes in 200 nodes
- **WHEN** the user renames one node, sets one field of another and moves a third in a 200-node Tree
- **THEN** the diff returns exactly three operations

#### Scenario: The UJ-2 edits
- **WHEN** the diff runs on the UJ-2 work breakdown as sent and as the user in the approved answer left it
- **THEN** it returns the approved answer's `wbs` operations, the same set in the diff's own order

#### Scenario: A removed branch
- **WHEN** the user deletes a node that has three children
- **THEN** the diff returns one `remove` naming that node

### Requirement: Order of a Tree's changes
The diff SHALL list, for each node of the edited tree in document order, its `add` or `move` and then its `set`s, and SHALL list the `remove`s last. Each `after` and `parent` SHALL name a node that exists at that point when the operations are applied in order.

#### Scenario: Applying the changes in order
- **WHEN** any sequence of adds, renames, field edits, deletes and moves is diffed and the operations are applied in order to the sent nodes
- **THEN** the result equals the edited nodes

### Requirement: Tree fixtures
The contract SHALL provide, for tests only, a board document whose one question holds a Tree item built from the UJ-2 work breakdown, the edited value of that Tree after the approved answer's edits, and that answer's event with its `changes`. Each part SHALL validate against the Tree's schemas, and the answer's `changes` SHALL equal the diff of the two values.

#### Scenario: The fixtures agree
- **WHEN** the contract's tests run
- **THEN** the fixture Tree and its edited value validate, the answer's `changes` validate, and the diff of the two values gives exactly those `changes`
