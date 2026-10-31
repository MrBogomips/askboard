# Spec Delta

## Purpose

The molecules AskBoard ships ready-made, each written as input-format data: the parameters an agent fills, as JSON Schema, and the composition of items those parameters fill, so that an agent sends only data and no molecule carries code (AD-9, FR-15, NFR-5).

## ADDED Requirements

### Requirement: The Gantt plan is data
AskBoard SHALL ship the Gantt plan as a ready-made molecule named `gantt-plan`, version 1.0.0, written as data only: its parameters as JSON Schema, a composition of one Gantt item, and for each parameter the JSON Pointers in the composition it fills. It SHALL hold no code, markup or style (AD-9, NFR-5).

#### Scenario: Only data
- **WHEN** the shipped `gantt-plan` molecule is read
- **THEN** it is JSON with exactly the keys `molecule`, `version`, `parameters`, `composition` and `fills`, and no string in it holds markup or a script

### Requirement: The Gantt plan's parameters
The Gantt plan's parameters SHALL be `workPackages`, the ID of the work breakdown whose leaves are its tasks, `start`, the plan's start date, and an optional `dependencies`, each task's finish-to-start predecessors by ID, checked by the same definitions as the Gantt item's props. Any other parameter SHALL be refused, naming it (FR-15).

#### Scenario: The approved UJ-2 data
- **WHEN** the `data` of the approved `uj2-wbs-gantt` ask's `schedule` reference is validated against the parameters
- **THEN** it passes unchanged

#### Scenario: An unknown parameter
- **WHEN** the data also holds `calendar`
- **THEN** validation fails, naming `calendar`

### Requirement: The Gantt plan fills one Gantt
Filling the Gantt plan's composition with valid data SHALL give one Gantt item whose props are the data as given, a Gantt plan over the work breakdown the data names, valid as a Gantt item's props (AD-9).

#### Scenario: Filling with the UJ-2 data
- **WHEN** the composition is filled with the UJ-2 `schedule` data through its pointers
- **THEN** the result is one Gantt item whose props are `workPackages` `wbs`, `start` 2026-11-02 and the four dependencies, and they validate as a Gantt plan's props
