# Spec Delta

## Purpose

The contract is AskBoard's one shared language: the versioned JSON Schema sets, ID rules and constants for every message that crosses a unit boundary at run time, with the fixtures that hold them to the approved model contract (AD-7).

## ADDED Requirements

### Requirement: Molecule reference props
The contract SHALL define a molecule reference's props in the standalone schema `urn:askboard:input:molecule-props`: `molecule`, a molecule name, an optional `version`, a semantic version `MAJOR.MINOR.PATCH`, and `data`, an object. Any other key SHALL fail validation, naming it. Until the input format reaches 1.1, the schema SHALL belong to no schema set (AD-6, AD-9, F2).

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
The contract SHALL define the molecule definition format 1.0.0 in the standalone schema `urn:askboard:input:molecule-definition`: `format`, `molecule`, `version`, `parameters`, `items` and `fills`, and nothing else. `parameters` SHALL be a JSON Schema 2020-12 object whose `$id` is `urn:askboard:molecule:<name>:<major>`, with no root combinator, that compiles in strict mode beside the contract's widget props schemas; `items` SHALL hold exactly one widget item `{type, id, props}` (AD-9).

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
The contract SHALL check any widget item it defines, given the question that holds it and the value's origin: a Tree with the Tree's checks, a Gantt with the Gantt's, a Gantt plan's link included. A type the contract does not define SHALL be a problem naming the item and its type (AD-7, AD-10).

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
The derived values a Tree with `pert` gives an answer SHALL be each node's `expected` and `spread` whose value, rounded half away from zero to two decimals, differs from the board as sent or whose node the agent did not send, and the item's `expected` and `spread` always, each rounded so; a value in error SHALL be left out (F7, FR-12, FR-20).

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

## MODIFIED Requirements

### Requirement: Tree item props
The contract SHALL define a Tree item's props in the schema `urn:askboard:input:tree-props`, checked by `validateTreeProps`, as optional `columns`, each `{field, label, type}` with `type` `text` or `number`, `nodes`, each `{id, label, children?}` plus a value for any declared field: a string for `text`, a number for `number`, absent when empty, and, for a work breakdown, the optional `pert` and `openDepth` (Tree PERT props). Any other key SHALL fail validation, naming the node and the key. No ask SHALL carry a Tree until the input format admits one in a question's items.

#### Scenario: The UJ-2 work breakdown as a Tree
- **WHEN** the nodes of the approved `uj2-wbs-gantt` ask's `wbs` data, without their `excerpt` pointers, are validated as a Tree whose columns declare `optimistic`, `mostLikely` and `pessimistic` as numbers
- **THEN** they pass

#### Scenario: The UJ-2 work breakdown with PERT
- **WHEN** the same Tree also holds `pert` `true` and `openDepth` `2`
- **THEN** it passes

#### Scenario: An undeclared field
- **WHEN** a node carries `owner` and no column declares it
- **THEN** validation fails, naming the node's ID and the field `owner`

#### Scenario: A value of the wrong type
- **WHEN** a node holds the text `"five"` in a `number` column
- **THEN** validation fails, naming the node's ID and the field
