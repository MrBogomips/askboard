# Spec Delta

## Purpose

The view and its widgets show an ask's board in the user's browser: agent content rendered only as data, in a sandboxed view built from the board document, with every user action leaving as a typed message and nothing answered without an explicit act (AD-8, AD-9, AD-10).

## ADDED Requirements

### Requirement: Molecules reach the view expanded
The view SHALL receive a molecule only as the widget items its expansion gave, and SHALL hold no molecule code. A board document holding a `molecule` item SHALL fail to assemble, naming the type, since no chunk registers it (AD-9, AD-10, AD-12).

#### Scenario: A reference that was never expanded
- **WHEN** a test board document's question holds a `molecule` item
- **THEN** `assemble` fails, naming the type `molecule`, and no srcdoc is built

### Requirement: Linked edits in one draft update
A component SHALL be able to put the values of several items of its own question into the draft record in one update, `undefined` removing an item's value. An update naming an item outside the component's question SHALL change nothing and SHALL be reported as an error. The board a component reads SHALL give each item the value it shows: its draft value, else its question's latest answer's value for it, else its props as sent (AD-9, AD-20).

#### Scenario: Two items at once
- **WHEN** a test `probe` component sets its own value and its sibling's in one update
- **THEN** the draft record holds both, "Answer" is enabled, and no view message leaves the view

#### Scenario: An item of another question
- **WHEN** a `probe` component's update names an item of another question
- **THEN** the draft record is unchanged and the item reports the error

#### Scenario: A linked edit on an answered question
- **WHEN** the user revises an answered question whose answer holds edits of the plan, and names a package added in the Tree after the portal
- **THEN** the plan's draft value is the answered plan with the added package's predecessors, and the plan shows it; no other item of the question gains a draft value

### Requirement: The board graph chunk
The board graph SHALL be the library chunk `board-graph`, needing `compute`, which the `tree` and `gantt` chunks need; every computing widget on a board SHALL read one live graph per draft change and one graph of the board as sent (AD-9, AD-13).

#### Scenario: The manifest
- **WHEN** the view is built
- **THEN** the manifest lists the library chunk `board-graph`, needing `compute`, and both `tree` and `gantt` need it

#### Scenario: One graph for two widgets
- **WHEN** an estimate is committed on the UJ-2 board, where the WBS and the plan both read the graph
- **THEN** the graph is built once for that draft change

### Requirement: WBS layout
A Tree with `pert` SHALL show the columns "Work package", "Optimistic", "Most likely", "Pessimistic", "Expected effort" and "Spread" (labels provisional): estimates and values with the "d" affix, values read-only, right-aligned, with one decimal, parents with their roll-ups and no estimate cells, and a "Total" row when it has several top-level packages (EXPERIENCE and DESIGN.md Molecules, WBS with PERT).

#### Scenario: The UJ-2 work breakdown opens
- **WHEN** the expanded UJ-2 question opens
- **THEN** UX design shows 5.5 d and 1.2 d, Design shows 14.0 d and 1.6 d and no estimate cells, and the Total row shows 40.7 d and 3.2 d

#### Scenario: One top-level package
- **WHEN** a work breakdown has a single top-level package
- **THEN** that package's row shows the totals, and there is no Total row

### Requirement: WBS values follow the edits
An estimate the user changes SHALL update its package's expected effort and spread, its parents' roll-ups and the totals within the same interaction, without the agent, and SHALL send nothing (FR-12, AD-13).

#### Scenario: Re-estimating the portal
- **WHEN** the user sets the portal's estimates to 4, 6 and 10
- **THEN** the portal shows 6.3 d and 1.0 d, Build 20.3 d and Total 34.3 d, and no view message leaves the view

#### Scenario: A negative estimate
- **WHEN** the user types `-2` as an estimate and presses Enter
- **THEN** the cell shows a field error, keeps the focus, and the draft is unchanged

### Requirement: WBS opening depth
A Tree with `pert` SHALL open with the packages above its `openDepth` expanded and the rest collapsed. Expanding and collapsing SHALL change no value and SHALL NOT count as a change (EXPERIENCE Molecules, WBS with PERT).

#### Scenario: Two levels
- **WHEN** the expanded UJ-2 question opens with `openDepth` 2
- **THEN** Design and Build show open chevrons and their six children are visible

#### Scenario: One level
- **WHEN** it opens with `openDepth` 1
- **THEN** only Design and Build are visible, with closed chevrons

### Requirement: An added package's predecessors
A package the user adds to a Tree that a Gantt plan of its question names, with `pert` or without, SHALL, once named, get in that plan the predecessors the plan gives the package it was added after ("Add node") or under ("Add child"), none when that package has none, in the same draft update (F20; EXPERIENCE Molecules, WBS with PERT).

#### Scenario: Splitting the portal
- **WHEN** the user focuses the portal, chooses "Add node" and names the package `Customer portal: dashboards`
- **THEN** the plan's `u-1` depends on Architecture and Clickable prototype and starts after the prototype ends, both items hold draft values, and no view message leaves the view

#### Scenario: A child of a leaf
- **WHEN** the user adds and names a child of reporting, which depends on the portal
- **THEN** the new package depends on the portal in the plan

#### Scenario: An addition taken back
- **WHEN** the user chooses "Add node" and presses Escape
- **THEN** neither the Tree nor the plan holds a draft value

### Requirement: Linked edits within a plan's limits
An addition or a confirmed deletion in a Tree whose edit of a linked plan would take that plan past a limit (50 predecessors of a task, 50 dependents of a task, 500 entries) SHALL be refused with a field error naming the limit, and SHALL write nothing to the Tree or the plan (AD-9, AD-10; F20).

#### Scenario: A linked edit past a plan's limit
- **WHEN** the user names a package added after one whose predecessor already has 50 dependents in the plan
- **THEN** the name shows a field error naming the limit of 50 dependents, keeps the focus, and neither the Tree nor the plan holds a draft value

### Requirement: Deleting a package with dependents
Deleting a package on which tasks of a linked plan depend, in a Tree with `pert` or without, SHALL ask first, inline, saying how many tasks depend on it, with the focus on "Cancel". Confirming SHALL connect each dependent to the deleted packages' own predecessors, without repeats, and return each deleted package's entry to what the agent sent for it (EXPERIENCE Molecules, WBS with PERT).

#### Scenario: Deleting the portal
- **WHEN** the user deletes the portal, on which reporting depends, and confirms
- **THEN** reporting depends on Architecture and Clickable prototype, and the diff of the sent and the edited plan is one `set` of reporting's predecessors

#### Scenario: Cancelling
- **WHEN** the user deletes the portal and chooses "Cancel"
- **THEN** the Tree and the plan are unchanged

#### Scenario: Deleting a package the user added
- **WHEN** the user splits the portal into `u-1` and then deletes `u-1`
- **THEN** neither the Tree nor the plan holds a draft value, and "Answer" is disabled

### Requirement: Answering a work breakdown question
"Answer" SHALL send one answer message carrying the full edited value of each changed item and the derived values of the Tree with `pert` and of the plan as they stand (AD-20, FR-12, F7).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved answer's `wbs` edits by keyboard on the expanded UJ-2 question and presses "Answer"
- **THEN** one answer message leaves the view, holding `wbs__tree` and `schedule__plan`; put in reference addressing by `ask-core`, its changes are the approved eight operations and its derived values the approved fourteen; and no CSP violation is reported

## MODIFIED Requirements

### Requirement: Tree plain values
A Tree without `pert` SHALL show and edit node fields as plain values and SHALL compute none: no roll-up, total or formula, and its answer SHALL carry no derived value (AD-13; proposal open question 3).

#### Scenario: A child's estimate changes
- **WHEN** the user changes a number field of `portal` in a Tree without `pert`
- **THEN** no field of `build` or of any other node changes

### Requirement: Gantt predecessors
The user SHALL edit a task's predecessors from its grid row, in an inline panel listing every other task to check or uncheck. A task that would close a cycle SHALL be disabled, saying why, and a task at the limit of 50 predecessors or 50 dependents SHALL take no more (EXPERIENCE Widgets, Gantt; proposal open question 9).

#### Scenario: Linking a package
- **WHEN** the user opens billing's predecessors and also checks Clickable prototype
- **THEN** billing starts after the prototype ends, and the draft holds the change

#### Scenario: Linking an added package
- **WHEN** the user splits the portal into `u-1` and opens `u-1`'s predecessors
- **THEN** Architecture and Clickable prototype are already checked, the predecessors the split gave it (An added package's predecessors), with nothing linked by hand

#### Scenario: A cycle offered
- **WHEN** the user opens the prototype's predecessors
- **THEN** the portal and reporting, which depend on the prototype, are disabled

### Requirement: Gantt predecessors that name no task
A predecessor a task holds that names no other task, such as a work package that became a parent in the Tree, an unknown ID from the agent or the task itself, SHALL be listed checked in the task's panel, saying that it names no task, so that the user can uncheck it. The panel SHALL NOT offer the task itself, or such an ID, to any other task (FR-14).

#### Scenario: A predecessor that became a parent
- **WHEN** the user adds a child to the portal in the plan's Tree and opens reporting's predecessors
- **THEN** `portal` is listed checked, saying that it names no task, and once the user unchecks it and presses "Done", reporting is scheduled again with no field error
