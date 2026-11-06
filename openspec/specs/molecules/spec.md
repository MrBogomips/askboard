# molecules Specification

## Purpose
The molecules AskBoard ships ready-made, each written as input-format data: the parameters an agent fills, as JSON Schema, and the items its expansion gives, so that an agent sends only data and no molecule carries code (AD-9, FR-15, NFR-5).

## Requirements

### Requirement: The Gantt plan's parameters are data
AskBoard SHALL ship the Gantt plan as a definition in the molecule format 1.0.0, under the molecule name `gantt-plan`, version 1.0.0, whose parameters are a JSON Schema of `workPackages`, the ID of the work breakdown whose leaves are its tasks, `start`, the plan's start date, and an optional `dependencies`, each task's predecessors by ID, checked by the same definitions as the Gantt's props. It SHALL hold no code, markup or style, and any other parameter SHALL be refused, naming it (AD-9, FR-15, NFR-5).

#### Scenario: The approved UJ-2 data
- **WHEN** the `data` of the approved `uj2-wbs-gantt` ask's `schedule` reference is validated against the parameters
- **THEN** it passes unchanged

#### Scenario: An unknown parameter
- **WHEN** the data also holds `calendar`
- **THEN** validation fails, naming `calendar`

#### Scenario: Only data
- **WHEN** the shipped `gantt-plan` file is read
- **THEN** it is JSON with exactly the keys `format`, `molecule`, `version`, `parameters`, `items` and `fills`, it passes the definition format's checks, and no string in it holds markup or a script

### Requirement: The Gantt plan's expansion
The Gantt plan's expansion SHALL give one Gantt plan item, `<reference>__plan`, with the data's `start`, a `workPackages` naming the expanded Tree when the data names a molecule reference and the named item otherwise, and a `tasks` map holding, for each key of `dependencies`, an entry with that task's predecessors, by task ID; the leaves of the named Tree are the plan's tasks, and a key that names no leaf is kept, for the compute graph to ignore (AD-9, AD-13).

#### Scenario: Expanding the UJ-2 data
- **WHEN** the UJ-2 `schedule` data is expanded beside the `wbs` reference
- **THEN** the result is the fixture plan `schedule__plan`: `workPackages` `wbs__tree`, `start` 2026-11-02, and entries for `prototype`, `portal`, `billing` and `reporting` holding the approved predecessors, whose props pass the Gantt's checks with its link to `wbs__tree`

#### Scenario: A plan over a plain Tree
- **WHEN** the `schedule` data names `wbs`, and `wbs` is a Tree item in the question, not a molecule reference
- **THEN** the expanded plan's `workPackages` is `wbs`

### Requirement: Ready-made molecules
AskBoard SHALL ship exactly two ready-made molecules in the definition format 1.0.0: `wbs-pert` 1.0.0 and `gantt-plan` 1.0.0. Each SHALL pass the contract's definition checks, and each SHALL be JSON data only (AD-9, FR-15, NFR-5).

#### Scenario: The shipped list
- **WHEN** the ready-made molecules are listed
- **THEN** they are `gantt-plan` 1.0.0 and `wbs-pert` 1.0.0, each passing the definition format's checks, with no string holding markup or a script

### Requirement: The WBS with PERT's parameters are data
The `wbs-pert` parameters SHALL be a JSON Schema of `nodes`, each `{id, label, children?}` with optional `optimistic`, `mostLikely` and `pessimistic`, numbers of working days from 0 to 100,000, and an optional `excerpt` pointer, and of an optional `depth` from 1 to 8. Any other key SHALL be refused, naming its path (AD-9, FR-15, F8).

#### Scenario: The approved UJ-2 data
- **WHEN** the `data` of the approved `uj2-wbs-gantt` ask's `wbs` reference is validated against the parameters
- **THEN** it passes unchanged

#### Scenario: An unknown key in a node
- **WHEN** a node of the data also holds `owner`
- **THEN** validation fails, naming the node's path and `owner`

#### Scenario: A depth out of range
- **WHEN** the data's `depth` is `9`
- **THEN** validation fails, naming `depth`

### Requirement: The WBS with PERT's expansion
The `wbs-pert` expansion SHALL give one Tree item, `<reference>__tree`, whose columns declare `optimistic`, `mostLikely` and `pessimistic` as numbers labelled "Optimistic", "Most likely" and "Pessimistic", with `pert` `true`, `openDepth` the data's `depth` or 2, and the data's `nodes` without their `excerpt` pointers (AD-9, AD-13; EXPERIENCE Molecules, WBS with PERT).

#### Scenario: Expanding the UJ-2 data
- **WHEN** the UJ-2 `wbs` data is expanded
- **THEN** the result is the fixture Tree `wbs__tree`, with its eight nodes, the three estimates on each leaf, `pert`, `openDepth` 2 and no `excerpt`
