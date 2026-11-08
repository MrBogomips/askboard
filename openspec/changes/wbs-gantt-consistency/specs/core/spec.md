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

#### Scenario: An update that replaces the work packages
- **WHEN** after an ask of a Tree and its plan the agent sends an update whose `change` of the Tree replaces its 150 leaves with 150 new IDs, and leaves the plan as it was
- **THEN** the update is applied, its result holds one warning about the plan, naming `schedule`, the first five old IDs and "145 more", and the result's JSON text is under `RESULT_MAX_CHARS`

## MODIFIED Requirements

### Requirement: The send-time graph check
When an ask or an update with widget items is accepted, `ask-core` SHALL build the board's graph from the items as stored and return each graph problem as a `formula` warning in reference addressing, in the graph's order, while the JSON text of the warnings it returns stays within `FORMULA_WARNINGS_MAX_CHARS` (10,000 characters). When any problem is left out, the last warning SHALL be the first problem left out, with its item, address and error and a message that counts the problems after it, or says that its own detail is left out when none follows it, and the JSON text of all the warnings, the closing one included, SHALL stay within the bound. The bound SHALL hold over every `formula` warning of the result, a Table's included. A graph problem SHALL never refuse the request (AD-6, AD-13, FR-14).

#### Scenario: A predecessor that names no task
- **WHEN** an ask's `schedule` data gives `billing` the predecessor `review`, which is no work package
- **THEN** the ask is created, and its result warns, naming `schedule` and `review`, never `schedule__plan`

#### Scenario: Warnings past the bound
- **WHEN** an ask's plan gives each of 60 leaves five predecessors that name no task, so that 60 earliest starts are in error
- **THEN** the ask is created, the JSON text of its warnings is at most 10,000 characters, the last warning's message says how many more are left out, and the warnings kept, the closing one and the count make up every problem the graph found

#### Scenario: One problem past the bound
- **WHEN** an ask's Table holds two formula columns whose errors fill the bound, so that only the second is left out
- **THEN** the ask is created, and the last warning names the second column's address and error and says that its detail is left out, with no count

#### Scenario: The worst plan the contract admits
- **WHEN** an ask holds a Tree of 500 leaves and a plan whose every task names 50 distinct 64-character predecessors that are no task, and an update then sends the same plan again
- **THEN** both are accepted, and each result's JSON text is under `RESULT_MAX_CHARS`

#### Scenario: Under the bound
- **WHEN** an ask's graph has a few problems, as the UJ-2 ask with one predecessor that names no task
- **THEN** every problem is a warning and none is a closing one
