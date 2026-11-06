## MODIFIED Requirements

### Requirement: Gantt item props
The input format SHALL define a Gantt item's props as a `start` date and `tasks`. Without `workPackages`, `tasks` SHALL be a list of the Gantt's own tasks, each `{id, label, duration}`. With `workPackages`, the ID of a Tree item whose leaves are the tasks (the Gantt plan), `tasks` SHALL be a map from task ID to an entry. A task or an entry MAY hold a requested `start` and its `dependencies`, its predecessors' IDs; an entry MAY also hold a requested `duration`, which a task already has; an entry holds nothing else. Any other key SHALL fail validation, naming it.

#### Scenario: A Gantt's own tasks
- **WHEN** a Gantt lists six tasks, each with an ID, a label and a duration, two of them with dependencies
- **THEN** it passes

#### Scenario: The UJ-2 plan
- **WHEN** a plan over `wbs` maps `prototype`, `portal`, `billing` and `reporting` to entries holding their approved predecessors
- **THEN** it passes

#### Scenario: A plan entry with a duration
- **WHEN** a plan's entry for `portal` holds `duration` 21
- **THEN** it passes

#### Scenario: A plan entry with a label
- **WHEN** a plan's entry holds a `label`
- **THEN** validation fails, saying that a plan's tasks take their names from its Tree

#### Scenario: A list in a plan
- **WHEN** a Gantt with `workPackages` holds its `tasks` as a list
- **THEN** validation fails, saying that a plan's tasks are a map by task ID

#### Scenario: An unknown key
- **WHEN** a Gantt's props hold `calendar`
- **THEN** validation fails, naming the key `calendar`

### Requirement: Gantt changes
The output format SHALL define a Gantt's `changes` as `set` operations of AD-20's generic diff on a task's field: `item.task.duration`, a whole number of working days of a Gantt's own task, or of a plan's entry as a requested duration, or `null` to clear a plan's request; `item.task.start`, a date or `null` to clear the request; `item.task.dependencies`, the full list, or `null` for none. No other operation or field SHALL pass.

#### Scenario: The approved UJ-2 answer
- **WHEN** the operation of `answers/uj2-wbs-gantt.json` whose target starts with `schedule.` is validated as a change of the plan `schedule`
- **THEN** it passes

#### Scenario: A plan's duration
- **WHEN** a change of a Gantt plan sets `schedule.portal.duration` to 21, or to `null`
- **THEN** it passes

#### Scenario: A duration out of range
- **WHEN** a change sets `schedule.portal.duration` to 0, to 2001 or to 2.5
- **THEN** validation fails, naming the value and the range 1 to 2,000

#### Scenario: A move
- **WHEN** a Gantt's changes hold a `move` operation
- **THEN** validation fails, naming the operation

#### Scenario: The diff of a requested duration
- **WHEN** a plan's edited value holds a requested duration the sent one did not, and the diff runs
- **THEN** it returns one `set` of the entry's `duration`, valid as the plan's changes, and the diff of an edited value that dropped a sent request gives `null`

### Requirement: Tree changes
The contract SHALL define a Tree's `changes` in the schema `urn:askboard:output:tree-changes`, checked by `validateTreeChanges`, as a list of the output format's changes (AD-20) with the Tree's rules: `add`, `remove` and `move` target `item.node`; an `add`'s `value` holds the node's name and fields, without `id` or children; `set` targets `item.node.field`, the field `label` or a declared one, with a value of its type, or `null` to empty a field other than `label`. A bulk adjustment of values and a drag of a node SHALL give no operation but these: one `set` for each value that differs from what the agent sent, one `move` for each node that is elsewhere (Tree bulk percentage adjustment; Tree drag and drop).

#### Scenario: The approved UJ-2 answer
- **WHEN** the operations of `answers/uj2-wbs-gantt.json` whose target starts with `wbs.` are validated as Tree changes
- **THEN** every one passes, the `add` of `u-1` under `build` after `portal` included

#### Scenario: A set on the children
- **WHEN** a `set` operation targets `wbs.build.children`
- **THEN** validation fails, naming the target

#### Scenario: A bulk adjustment
- **WHEN** 12 leaves' most likely estimates are each raised by 10% and the diff runs
- **THEN** it returns 12 `set` operations, each on `wbs.<node>.mostLikely` with the new number, and they validate as Tree changes

#### Scenario: A drag and back
- **WHEN** a node is moved and moved back, and the diff runs
- **THEN** it returns no operation for it
