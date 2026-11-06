# Spec Delta

## Purpose

The core owns asks, their board documents, their states and one append-only event log per ask, so that every answer reaches the agent exactly as the user gave it, once, or the agent learns that it never will (AD-3, AD-10).

## ADDED Requirements

### Requirement: Expanding molecule references
`ask-core` SHALL replace each molecule reference among a question's items by its definition's item, filled from the reference's data, in the reference's place and under the ID `<reference>__<item>`. The board document SHALL hold the expanded items and never the reference; every other item SHALL stay as sent (AD-9, AD-12).

#### Scenario: The UJ-2 ask
- **WHEN** the approved `uj2-wbs-gantt` ask's items are expanded with the shipped molecules
- **THEN** the question `plan` holds the Tree `wbs__tree` and then the Gantt plan `schedule__plan`, equal to the contract's molecule fixtures, and the question `erp-export` is unchanged

#### Scenario: A question with no reference
- **WHEN** the plain-choice ask's items are expanded
- **THEN** they are returned unchanged and no expansion is recorded

#### Scenario: A question in an area
- **WHEN** the UJ-2 question `plan` sits in an area, as E3's input format 1.1 allows, and the items are expanded
- **THEN** the area's question `plan` holds `wbs__tree` and `schedule__plan` as at the top level, and the area is otherwise unchanged

### Requirement: Fill forms
A fill SHALL put its parameter's value at its pointer: as it is (copy); as the expanded item of the molecule reference it names, else unchanged (`item`); with each value of an object turned into an entry holding it under the given field (`entries`); or without the given keys at any depth (`omit`). A parameter the data leaves out SHALL leave the composition's value (AD-9).

#### Scenario: Entries
- **WHEN** the `gantt-plan` data's `dependencies` `{prototype: ["ux"]}` fills `tasks` with `{entries: "dependencies"}`
- **THEN** `tasks` is `{prototype: {dependencies: ["ux"]}}`

#### Scenario: Omit
- **WHEN** the `wbs-pert` data's `nodes` fill the Tree's `nodes` with `{omit: ["excerpt"]}`
- **THEN** no node at any depth holds `excerpt`, and every other key is kept

#### Scenario: A parameter left out
- **WHEN** the `wbs-pert` data holds no `depth`
- **THEN** the Tree's `openDepth` is the composition's 2

### Requirement: Molecule versions
`ask-core` SHALL get each definition through the `MoleculeSource` port. A reference without `version` SHALL get the highest shipped version of the molecule's current major; one with a version, the highest shipped version of that major at or above it. A name or version with no such definition SHALL refuse the request, naming the reference and what is shipped (AD-9, AD-10).

#### Scenario: No version
- **WHEN** a reference names `wbs-pert` with no `version`, and 1.0.0 is shipped
- **THEN** it expands with `wbs-pert` 1.0.0

#### Scenario: A version not shipped
- **WHEN** a reference names `wbs-pert` version `2.0.0`
- **THEN** the request is refused, naming the reference and `wbs-pert` 1.0.0

#### Scenario: An unknown molecule
- **WHEN** a reference names `sales-estimate-review`
- **THEN** the request is refused, naming the reference and the shipped molecules `gantt-plan` and `wbs-pert`

### Requirement: Refusing an expansion
`ask-core` SHALL refuse a request, naming the reference's ID, when a reference's data fails its parameters, or when an expanded item fails its widget's checks in the question that holds it, such as a Gantt plan naming a work breakdown in another question (AD-10, NFR-10).

#### Scenario: Data outside the parameters
- **WHEN** the `schedule` reference's data also holds `calendar`
- **THEN** the request is refused, naming `schedule` and `calendar`

#### Scenario: A plan in another question
- **WHEN** `schedule` sits in a question other than the one holding `wbs`
- **THEN** the request is refused, naming `schedule` and `wbs`

#### Scenario: A day that does not exist
- **WHEN** the `schedule` reference's `data.start` is `2026-02-30`, which has the form of a date
- **THEN** the data passes its parameters, whose date is a pattern, and the request is refused at the expanded plan's own checks, naming `schedule` and `/start`

### Requirement: Expanded IDs
An expanded item's ID SHALL be at most 64 characters and SHALL NOT equal another item ID of the ask; otherwise the request SHALL be refused, naming the reference and, for a clash, the other item (AD-7, AD-9).

#### Scenario: A long reference ID
- **WHEN** a `wbs-pert` reference's ID has 59 characters, so that its expanded ID would have 65
- **THEN** the request is refused, naming the reference and the limit of 64 characters

#### Scenario: A clash
- **WHEN** an ask holds a reference `wbs` and another item whose ID is `wbs__tree`
- **THEN** the request is refused, naming both

### Requirement: The expansion map
For each board document, `ask-core` SHALL keep which expanded item belongs to which reference, with the molecule's name and version, apart from the board document, which the view, `fetch` and Snapshots read unchanged (AD-9, AD-12).

#### Scenario: The UJ-2 map
- **WHEN** the UJ-2 ask is expanded
- **THEN** the map gives `wbs__tree` as `wbs`, `wbs-pert` 1.0.0, and `schedule__plan` as `schedule`, `gantt-plan` 1.0.0, and the board document holds no `molecule` item

### Requirement: Answers in reference addressing
`ask-core` SHALL give every change target and derived-value key that addresses an expanded item under its reference's ID, keeping the rest of the address, so answers name no expanded ID and carry no `molecule` field; other addresses and every `parent` and `after` SHALL stay as they are (AD-9, AD-20, F15).

#### Scenario: The UJ-2 answer
- **WHEN** the UJ-2 question's changes and derived values, computed from the expanded items as sent and as the approved edits leave them, are put in reference addressing
- **THEN** the changes are the approved answer's eight operations, compared as a set, and the derived values the approved answer's fourteen, `wbs.` and `schedule.` keys alike

#### Scenario: An address of another item
- **WHEN** an answer's change targets an item that no reference expanded
- **THEN** its target is unchanged

### Requirement: Warnings in reference addressing
A warning or problem that names an expanded item SHALL name its reference's ID instead, keeping the rest of what it says (AD-6, AD-9, AD-13).

#### Scenario: A predecessor that names no task
- **WHEN** the `schedule` data gives `billing` the predecessor `review`, which is no work package, and the expanded question's graph is built
- **THEN** the graph's `missing-reference` warning names `schedule` and `review`, and no warning names `schedule__plan`
