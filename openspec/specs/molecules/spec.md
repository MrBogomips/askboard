# molecules Specification

## Purpose
The molecules AskBoard ships ready-made, each written as input-format data: the parameters an agent fills, as JSON Schema, and the items its expansion gives, so that an agent sends only data and no molecule carries code (AD-9, FR-15, NFR-5).

## Requirements

### Requirement: The Gantt plan's parameters are data
AskBoard SHALL ship the Gantt plan's parameters as data under the molecule name `gantt-plan`, version 1.0.0: a JSON Schema of `workPackages`, the ID of the work breakdown whose leaves are its tasks, `start`, the plan's start date, and an optional `dependencies`, each task's predecessors by ID, checked by the same definitions as the Gantt's props. It SHALL hold no code, markup or style, and any other parameter SHALL be refused, naming it (AD-9, FR-15, NFR-5).

#### Scenario: The approved UJ-2 data
- **WHEN** the `data` of the approved `uj2-wbs-gantt` ask's `schedule` reference is validated against the parameters
- **THEN** it passes unchanged

#### Scenario: An unknown parameter
- **WHEN** the data also holds `calendar`
- **THEN** validation fails, naming `calendar`

#### Scenario: Only data
- **WHEN** the shipped `gantt-plan` file is read
- **THEN** it is JSON with exactly the keys `molecule`, `version` and `parameters`, and no string in it holds markup or a script

### Requirement: The Gantt plan's expansion
The Gantt plan's expansion SHALL give one Gantt plan item with the data's `workPackages` and `start` and a `tasks` map holding, for each key of `dependencies`, an entry with that task's predecessors, by task ID; the leaves of the named Tree are the plan's tasks, and a key that names no leaf is kept, for the compute graph to ignore (AD-9, AD-13).

#### Scenario: Expanding the UJ-2 data
- **WHEN** the UJ-2 `schedule` data is expanded
- **THEN** the result is the fixture plan: `workPackages` `wbs`, `start` 2026-11-02, and entries for `prototype`, `portal`, `billing` and `reporting` holding the approved predecessors, whose props validate as a Gantt plan's with its link to `wbs`
