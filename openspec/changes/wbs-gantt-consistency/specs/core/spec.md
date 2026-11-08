## ADDED Requirements

### Requirement: A plan that names no work package is warned on ask and update
When an ask or an update leaves a Gantt plan naming an ID that is no leaf of its Tree, as when an update removes a leaf or gives it a child, `ask-core` SHALL accept it and return the plan's `missing-reference` warning in reference addressing, and SHALL keep the plan's props as the agent sent them, so `fetch` returns them unchanged (AD-10, AD-13; Issue #74).

#### Scenario: An update removes a leaf
- **WHEN** after the UJ-2 ask the agent sends an update whose `change` of `wbs` sends its `data` with the nodes less `billing`
- **THEN** the update is applied, its result warns with `itemId` `schedule` and `address` `schedule.billing`, naming `wbs` and never `schedule__plan` or `wbs__tree`, and `fetch` of `schedule` still holds `billing`'s entry

#### Scenario: The plan changed in the same update
- **WHEN** the same update also changes `schedule`, sending its `data` with `dependencies` that no longer name `billing`
- **THEN** the result carries no warning about `billing`

#### Scenario: An ask that names no work package
- **WHEN** an ask's `schedule` data holds an entry for `review`, which is no work package of `wbs`
- **THEN** the ask is created, and its result warns, naming `schedule` and `review`
