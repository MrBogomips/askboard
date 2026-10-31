# Spec Delta

## Purpose

The contract is AskBoard's one shared language: the versioned JSON Schema sets, ID rules and constants for every message that crosses a unit boundary at run time, with the fixtures that hold them to the approved model contract (AD-7).

## ADDED Requirements

### Requirement: Gantt schemas
The Gantt's props and changes SHALL be standalone widget schemas, `urn:askboard:input:gantt-props` and `urn:askboard:output:gantt-changes`, compiled only by the Gantt's own validate functions and belonging to no schema set until the input format reaches 1.1 (AD-7).

#### Scenario: The Gantt's schemas compile
- **WHEN** the Gantt's two schemas are compiled in strict mode with `createAjv`'s options and E1's ID schema
- **THEN** both compile, both are JSON Schema 2020-12 with those `$id`s, neither has a root combinator, and no schema set lists either

### Requirement: Gantt item props
The input format SHALL define a Gantt item's props as a `start` date and exactly one task source: `tasks`, each `{id, label, duration}`, or `workPackages`, the ID of a Tree item whose leaves are the tasks (the Gantt plan). Both MAY hold `dependencies`, task ID to its predecessors' IDs, and `starts`, task ID to a requested start date. Any other key SHALL fail validation, naming it. No ask SHALL carry a Gantt until the input format admits one in a question's items.

#### Scenario: The UJ-2 plan as a Gantt
- **WHEN** the `data` of the approved `uj2-wbs-gantt` ask's `schedule` molecule is validated as a Gantt's props
- **THEN** it passes, as a Gantt plan over the item `wbs`

#### Scenario: Both task sources
- **WHEN** a Gantt's props hold both `tasks` and `workPackages`
- **THEN** validation fails, saying that a Gantt takes exactly one of them

#### Scenario: An unknown key
- **WHEN** a Gantt's props hold `calendar`
- **THEN** validation fails, naming the key `calendar`

### Requirement: Gantt values
A Gantt's `start` and every requested start SHALL be a real calendar day from 1900-03-01 to 9999-12-31, written as an RFC 3339 `full-date`. A task's `duration` SHALL be a whole number of working days from 1 to 2,000. A task's predecessors SHALL be task IDs, each listed once (AD-7, Values).

#### Scenario: A day that does not exist
- **WHEN** a requested start is `2026-02-30`
- **THEN** validation fails, naming the task and the date

#### Scenario: A fractional duration
- **WHEN** a task's `duration` is `2.5`
- **THEN** validation fails, naming the task and the field `duration`

#### Scenario: A predecessor listed twice
- **WHEN** a task's predecessors list `design` twice
- **THEN** validation fails, naming the task and `design`

### Requirement: Gantt task IDs
A Gantt's task IDs SHALL follow the widget element ID rule, and so SHALL every `dependencies` and `starts` key and every predecessor: in what the agent sends, none SHALL start with the view-made prefix `u-`; an edited value MAY name such tasks, since a plan's tasks are its Tree's leaves and keep their IDs (AD-7, F10).

#### Scenario: One ID twice
- **WHEN** two of a Gantt's `tasks` share the ID `review`
- **THEN** validation fails, naming the repeated ID

#### Scenario: The agent names a view-made task
- **WHEN** the agent's `dependencies` give `u-1` a predecessor
- **THEN** validation fails, saying that the prefix `u-` is reserved for IDs the board makes

#### Scenario: A package the user added
- **WHEN** an edited plan's `dependencies` give `u-1` the predecessors `architecture` and `prototype`
- **THEN** it passes validation as an edited value

### Requirement: Gantt plan link
A Gantt plan's `workPackages` SHALL name a Tree item in the same question whose columns declare `optimistic`, `mostLikely` and `pessimistic` as numbers. A plan whose link fails SHALL fail validation, naming the plan and the item it names (AD-10).

#### Scenario: The UJ-2 link
- **WHEN** the plan `schedule` names `wbs`, a Tree in its question with the three estimate columns
- **THEN** the link passes

#### Scenario: A link to nothing
- **WHEN** a plan names `wbs` and its question holds no item `wbs`
- **THEN** validation fails, naming the plan and `wbs`

### Requirement: Gantt references are not refused
A predecessor or a `dependencies` or `starts` key that names no task of the Gantt, and a dependency cycle, SHALL pass validation: they are the compute graph's warnings, shown on the board, never refusals (AD-13, FR-14).

#### Scenario: A cycle
- **WHEN** a Gantt's `dependencies` make `a` depend on `b` and `b` on `a`
- **THEN** the props pass validation

### Requirement: Gantt limits
A Gantt SHALL hold at most 500 tasks; a task at most 50 predecessors; at most 50 tasks SHALL depend on one task; a task's name SHALL be 1 to 200 characters. The limits SHALL live in the contract, and a Gantt over one SHALL fail validation, naming the limit.

#### Scenario: Too many dependents
- **WHEN** 51 tasks list `design` among their predecessors
- **THEN** validation fails, naming `design` and the limit of 50 dependent tasks

#### Scenario: Too many tasks
- **WHEN** a Gantt lists 501 tasks
- **THEN** validation fails, naming the limit of 500 tasks

### Requirement: Gantt changes
The output format SHALL define a Gantt's `changes` as `set` operations of AD-20's generic diff on a task's field: `item.task.duration`, a number of working days, only for a Gantt that lists its tasks; `item.task.start`, a date or `null` to clear the request; `item.task.dependencies`, the full list of predecessors. No other operation or field SHALL pass.

#### Scenario: The approved UJ-2 answer
- **WHEN** the operation of `answers/uj2-wbs-gantt.json` whose target starts with `schedule.` is validated as a change of the plan `schedule`
- **THEN** it passes

#### Scenario: A plan's duration
- **WHEN** a change of a Gantt plan sets `schedule.portal.duration`
- **THEN** validation fails, saying that a plan's durations follow its work packages' estimates

#### Scenario: A move
- **WHEN** a Gantt's changes hold a `move` operation
- **THEN** validation fails, naming the operation

### Requirement: Keyed maps in the generic diff
An element shape MAY also name maps keyed by element ID, each with the field it stands for. The diff SHALL compare them as JSON values: a key whose value differs SHALL give one `set` of `item.key.field` with the edited value, a key missing from the edited value a `set` to `null`, and an unchanged key no operation. An absent elements key SHALL read as an empty list (AD-20, FR-20).

#### Scenario: A new key
- **WHEN** a plan sent without a `u-1` key in `dependencies` is edited to give `u-1` the predecessors `architecture` and `prototype`
- **THEN** the diff returns exactly `set schedule.u-1.dependencies` with that list

#### Scenario: A cleared request
- **WHEN** an edited Gantt leaves out a requested start the sent one held for `review`
- **THEN** the diff returns exactly `set` of `review`'s `start` to `null`

### Requirement: Order of keyed changes
The diff SHALL list the `set`s of keyed maps after every operation on the element list, ordered by element ID and then by field name, each in UTF-16 code-unit order, whatever the order of keys in either value.

#### Scenario: Two tasks changed
- **WHEN** an edited Gantt requests a start for `review` and changes the predecessors of `build` and of `review`
- **THEN** the diff lists `build.dependencies`, then `review.dependencies`, then `review.start`

### Requirement: Computing a Gantt's changes
Given a Gantt's props as sent and as edited, the contract's diff, with the Gantt's shape (its `tasks` as a flat element list, `dependencies` and `starts` as keyed maps), SHALL return one `set` per task field the user changed and no other operation, and none for a Gantt that ends as it was sent.

#### Scenario: Nothing changed
- **WHEN** the edited Gantt equals the sent one
- **THEN** the diff returns no operation

#### Scenario: Applying the changes
- **WHEN** any sequence of duration, start and predecessor edits is diffed and the operations are applied to the sent props
- **THEN** the result equals the edited props

### Requirement: Gantt answer derived values
The contract SHALL declare the derived values a Gantt's answer carries: `<item>.finish`, the date the plan ends, and `<item>.criticalPath`, the IDs of the tasks on the critical path in task order; a value in error SHALL be left out (F7, FR-12).

#### Scenario: The approved UJ-2 values
- **WHEN** the UJ-2 plan is computed after the approved answer's edits
- **THEN** its declared derived values are `schedule.finish` `2026-12-02` and `schedule.criticalPath` `ux`, `prototype`, `portal`, `reporting`, as in the approved answer

### Requirement: Gantt fixtures
The contract SHALL provide, for tests only, a board document whose question holds a Gantt that lists its tasks, a board document whose question holds the UJ-2 work breakdown as a Tree and the UJ-2 plan over it, each value after the approved answer's edits, and that answer's `changes` and Gantt derived values. Each part SHALL validate, and the `changes` SHALL equal the diff of the sent and the edited values.

#### Scenario: The fixtures agree
- **WHEN** the contract's tests run
- **THEN** both fixture Gantts and their edited values validate, the plan's `changes` validate, and the diff of the sent and the edited plan gives exactly those `changes`
