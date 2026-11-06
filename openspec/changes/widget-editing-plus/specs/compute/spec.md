## MODIFIED Requirements

### Requirement: CPM scheduling
A Gantt plan SHALL schedule its WBS's leaves in working days: duration the task's requested duration, else the expected effort rounded up, at least 1; earliest start the latest earliest finish of its predecessors; latest finish the earliest latest start of its successors, or the plan's finish; slack, a critical flag at zero slack, and start and finish dates from the first working day on or after the plan's start. Each plan task SHALL also give `effortDays`, the duration its estimates alone give (its expected effort rounded up, at least 1), which a requested duration does not change, so a view can tell a requested duration from the one that follows the WBS.

#### Scenario: UJ-2's plan
- **WHEN** UJ-2's plan starts on Monday 2026-11-02 with its four dependencies
- **THEN** UX design, the prototype, the portal and reporting are critical, architecture has 7 days of slack and billing 17, and the plan finishes on 2026-12-11

#### Scenario: A weekend start
- **WHEN** the plan's start moves to Saturday 2026-11-07
- **THEN** every task starts from Monday 2026-11-09

#### Scenario: A dependency cycle
- **WHEN** two tasks depend on each other
- **THEN** their scheduling fields are `cycle` warnings and the plan's finish reads as `cycle`

#### Scenario: An unknown task
- **WHEN** a dependency names a task that is not one of the plan's work packages
- **THEN** it is a `missing-reference` warning naming the plan and the task

#### Scenario: A requested duration
- **WHEN** the portal's expected effort rounds up to 18 days and its entry requests 21
- **THEN** the portal lasts 21 working days, reporting starts three working days later than without the request, and the portal's expected effort in the WBS is as before

#### Scenario: The estimates' duration beside a request
- **WHEN** the portal's expected effort rounds up to 18 days and its entry requests 21
- **THEN** the portal's duration is 21 and its `effortDays` is 18, and with no request both are 18

#### Scenario: A request equal to the estimate
- **WHEN** an entry requests the duration its expected effort rounds up to
- **THEN** the schedule equals the one without the request

### Requirement: The board's graph source
`compute` SHALL map a board's items onto its graph source: a Gantt with its own tasks becomes a Gantt source, a Gantt plan a plan source over the Tree it names, its entries' starts, durations and predecessors taken by task ID, and that Tree a WBS-with-PERT source whose leaves' `optimistic`, `mostLikely` and `pessimistic` fields are its estimates. A plan entry that names no leaf SHALL add nothing; items that hold nothing to compute SHALL add nothing (AD-13).

#### Scenario: The UJ-2 board
- **WHEN** the UJ-2 question's Tree `wbs` and plan `schedule` are mapped and the graph is built and evaluated
- **THEN** every value equals the one the approved example's `wbs-pert` and `gantt-plan` data give, and there is no warning

#### Scenario: The approved answer's edits
- **WHEN** the same board is mapped with the Tree and the plan as the approved answer left them
- **THEN** the plan finishes on 2026-12-02, and its critical tasks are UX design, the prototype, the portal and reporting

#### Scenario: A plain question
- **WHEN** a board's only item is a plain Choice question
- **THEN** the graph source holds no item

#### Scenario: A requested duration is mapped
- **WHEN** a plan's entry holds `duration` 21 for a leaf
- **THEN** the plan source gives that task 21 days and the WBS-with-PERT source is unchanged

#### Scenario: A work breakdown with no plan
- **WHEN** a board's only item is the expanded UJ-2 Tree `wbs__tree`, with `pert`
- **THEN** the graph gives each node and the item their expected effort and spread, the item's 40.67 and 3.21 among them, with no warning

#### Scenario: A plain Tree
- **WHEN** a board's only item is a Tree without `pert` whose columns declare the three estimates
- **THEN** the graph source holds no item
