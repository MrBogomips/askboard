## ADDED Requirements

### Requirement: Plan IDs that name no work package are warnings
Each ID a Gantt plan's `tasks` names, as an entry's key or as a predecessor, that is no leaf of the plan's Tree SHALL be one `missing-reference` warning, addressed `<plan>.<ID>`, whose detail names the ID and the Tree, once per plan and ID. The entry SHALL still add nothing to the schedule, and a dependent of such an ID SHALL still read its own `missing-reference` error (AD-13; Issue #74).

#### Scenario: An entry for a removed leaf
- **WHEN** the UJ-2 board's Tree is mapped without `billing`, and the plan still holds `billing`'s entry
- **THEN** the graph has exactly one warning, `missing-reference` at `schedule.billing`, whose detail names `billing` and `wbs`, and every other value equals the one the plan gives with no `billing` entry

#### Scenario: A predecessor that names a removed leaf
- **WHEN** the UJ-2 board's Tree is mapped without `portal`, which `reporting` names as its predecessor and which has its own entry
- **THEN** the graph warns once at `schedule.portal`, and `reporting`'s schedule reads `missing-reference` with its own warning at its earliest start, as before

#### Scenario: A leaf that became a parent
- **WHEN** the UJ-2 board's Tree is mapped with a child under `portal`
- **THEN** the graph warns once at `schedule.portal`, `portal` has no task, and its estimates are not in the totals

#### Scenario: The approved board
- **WHEN** the UJ-2 board, or the board as the approved answer left it, is mapped and built
- **THEN** there is no warning
