## ADDED Requirements

### Requirement: Plan IDs that name no work package are warnings
The IDs a Gantt plan's `tasks` names, as an entry's key or as a predecessor in the entry of a leaf, that are no leaf of the plan's Tree SHALL be a `missing-reference` warning about the plan, addressed `<plan>.<ID>`, whose detail names the ID and the Tree. A stray entry's content SHALL NOT be read, so its predecessors give no warning of their own. The entry SHALL still add nothing to the schedule, and a dependent of such an ID SHALL still read its own `missing-reference` error (AD-13; Issue #74).

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

#### Scenario: A stray entry's predecessors
- **WHEN** the plan holds an entry `old`, which is no leaf, whose dependencies name `ghost`, which is no leaf either
- **THEN** the plan's warning names `old` and never `ghost`

### Requirement: One warning per plan
The IDs of one plan that are no leaf SHALL give one warning, each ID counted once, addressed by the first of them (the entries' keys in entry order, then the predecessors). Its detail SHALL name at most five of the IDs, in that order, with a count of the rest, and SHALL be at most 500 characters, whatever the plan holds (AD-6, AD-13; Issue #74).

#### Scenario: Several IDs in one plan
- **WHEN** the plan holds entries for `design` and `nope`, which are no leaves, and a predecessor `ghost` in a leaf's entry
- **THEN** the graph has exactly one plan warning, at `schedule.design`, whose detail names `design`, `nope` and `ghost` and `wbs`

#### Scenario: A stale plan after the work packages were replaced
- **WHEN** the Tree's leaves are replaced by 150 new IDs, and the plan still holds an entry for each of the 150 old IDs
- **THEN** the graph has exactly one plan warning, addressed by the first old ID, whose detail names the first five old IDs and "145 more", and no task is scheduled from the old entries


#### Scenario: The longest detail
- **WHEN** a plan within the contract's limits names, as strays and predecessors, thousands of distinct 64-character IDs that are no leaf
- **THEN** its one warning's detail is at most 500 characters
