# Spec Delta

## Purpose

The compute unit builds a board's whole graph of typed values and formulas, checks every formula before any engine runs, evaluates it with AskBoard's own restricted evaluator, and computes PERT estimates and CPM schedules, so that derived values never need the agent (AD-13).

## ADDED Requirements

### Requirement: A Gantt's own tasks are scheduled
A Gantt that lists its tasks SHALL be scheduled as a Gantt plan is, with each task's `duration` taken as given instead of from a WBS: the same forward and backward passes, slack, critical flag and working-day dates (FR-12, AD-13 "In-house computations").

#### Scenario: The UJ-2 durations, listed
- **WHEN** a Gantt lists UJ-2's six work packages with the durations the UJ-2 plan computes for them, its four dependencies and the start 2026-11-02
- **THEN** every task's start, finish and critical flag equal the UJ-2 plan's, and it finishes on 2026-12-11

### Requirement: Requested starts
A task with a requested start SHALL start on the first working day on or after it, or later if its predecessors finish later; a request before the plan's first working day SHALL have no effect. Every task SHALL also have its earliest start, the one its predecessors allow, as a number of working days and as a date.

#### Scenario: A task moved later
- **WHEN** reporting, whose earliest start is 2026-12-04, is requested to start on 2026-12-09
- **THEN** reporting starts on 2026-12-09, the plan finishes three working days later, and reporting's earliest start is still 2026-12-04

#### Scenario: A request its predecessors overtake
- **WHEN** a task requested to start on 2026-11-10 gets a predecessor that finishes on 2026-11-12
- **THEN** it starts on 2026-11-13

#### Scenario: A request on a Saturday
- **WHEN** a task is requested to start on Saturday 2026-11-14 and its predecessors allow it
- **THEN** it starts on Monday 2026-11-16

### Requirement: The board's graph source
`compute` SHALL map a board's items onto its graph source: a Gantt that lists its tasks becomes a Gantt source, a Gantt plan a plan source over the Tree it names, and that Tree a WBS-with-PERT source whose leaves' `optimistic`, `mostLikely` and `pessimistic` fields are its estimates. Items that hold nothing to compute SHALL add nothing (AD-13).

#### Scenario: The UJ-2 board
- **WHEN** the UJ-2 question's Tree `wbs` and plan `schedule` are mapped and the graph is built and evaluated
- **THEN** every value equals the one the approved example's `wbs-pert` and `gantt-plan` data give, and there is no warning

#### Scenario: The approved answer's edits
- **WHEN** the same board is mapped with the Tree and the plan as the approved answer left them
- **THEN** the plan finishes on 2026-12-02, and its critical tasks are UX design, the prototype, the portal and reporting

#### Scenario: A plain question
- **WHEN** a board's only item is a plain Choice question
- **THEN** the graph source holds no item

### Requirement: Working-day calendar helpers
`compute` SHALL give the view its working-day calendar: whether a date is a working day, the first working day on or after a date, a date a number of working days after another, and the working days between two dates, on `full-date` strings, with AD-7's default calendar and no `Date`, time zone or locale (AD-13 Determinism).

#### Scenario: Across a weekend
- **WHEN** the working day 1 after Friday 2026-11-13 is asked for
- **THEN** the answer is Monday 2026-11-16

#### Scenario: Determinism
- **WHEN** the Gantt fixtures run under `TZ=Pacific/Kiritimati` and `TZ=America/Adak` with the locales `en-US` and `de-DE`
- **THEN** every result is the same

### Requirement: Scheduling formulas stay inside the limits
Every scheduling formula `compute` writes for a Gantt within the contract's limits SHALL pass the formula check: no formula SHALL exceed the formula length limit or use a name outside the whitelist.

#### Scenario: The longest formulas
- **WHEN** a Gantt holds a task with 50 predecessors and a task with 50 dependent tasks, all with 64-character IDs, in an item with a 64-character ID
- **THEN** every formula of the graph passes the formula check
