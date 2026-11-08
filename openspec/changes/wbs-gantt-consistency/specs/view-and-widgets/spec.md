## ADDED Requirements

### Requirement: Making a work package a group asks first
In a Tree with `pert`, or one a Gantt plan of its question names, an edit that gives a leaf its first child SHALL ask first when that leaf holds an estimate or is a task of such a plan: a drop into it, an indent under it (the tool or Alt+Shift+ArrowRight) and "Add child" on it. Until the user confirms, the Tree, the plan and the draft SHALL be unchanged (EXPERIENCE Molecules, WBS with PERT; Issue #71).

#### Scenario: A drop into an estimated leaf
- **WHEN** on the UJ-2 board the user drops `billing` on the middle of `portal`
- **THEN** the question opens in the Tree's toolbar row, `billing` is still under `build` after `portal`, neither the Tree nor the plan holds a draft value, and no view message leaves the view

#### Scenario: An indent by key
- **WHEN** the user focuses `billing`, which follows `portal`, and presses Alt+Shift+ArrowRight
- **THEN** the same question opens and nothing has moved

#### Scenario: Add child on an estimated leaf
- **WHEN** the user focuses `reporting` and chooses "Add child"
- **THEN** the question opens before any name editor, and no node is added

#### Scenario: Nothing to lose
- **WHEN** the leaf holds no estimate and no plan of the question names the Tree, or the Tree has no `pert` and no plan names it, as in the plain Tree fixture
- **THEN** the drop, the indent and "Add child" act at once, as before

#### Scenario: A drop that is refused
- **WHEN** a drop into an estimated leaf would put a node at level 9
- **THEN** the drop is refused as Tree drops that are refused says, and no question opens

### Requirement: The group question's words
The question SHALL name the leaf, as text; say that its estimates leave the totals while it has children, when the Tree has `pert` and the leaf holds an estimate; say that its task leaves the plan, when a plan of the question names the Tree; and say how many tasks of those plans depend on it, as the delete question does. It SHALL be a group named by its words, open with the focus on "Cancel", and offer "Cancel" and "Continue", in the ask's language.

#### Scenario: The portal
- **WHEN** the question opens for `portal` on the UJ-2 board
- **THEN** it reads "“Customer portal” becomes a group: its estimates leave the totals while it has children, and its task leaves the plan. 1 task in the plan depends on it.", and the focus is on "Cancel"

#### Scenario: A WBS with no plan
- **WHEN** the question opens for an estimated leaf of a Tree with `pert` that no plan names
- **THEN** it says the estimates leave the totals and says nothing of a plan

#### Scenario: Italian
- **WHEN** the ask's language is `it-IT`
- **THEN** the question, "Annulla" and "Continua" come from the Italian catalog

### Requirement: The group question's layout
The question's sentence SHALL wrap, the leaf's name first and whole, with "Cancel" and "Continue" under it, and the toolbar row SHALL grow to hold it. Neither the name nor the words SHALL run under a button or past the toolbar row's edge, down to the 1,280 px viewport floor, in a Row and beside the outline rail (DESIGN, Tree).

#### Scenario: At the viewport floor
- **WHEN** at a 1,280 px window the user drops `billing` into `portal`, with the UJ-2 Tree in a Row beside its plan, or on a board of several questions beside the outline rail, in en-US and in it-IT
- **THEN** "Customer portal" shows whole, the words wrap without crossing "Cancel" or "Continue", and nothing passes the toolbar row's right edge

### Requirement: The group question fixes its leaf
The question SHALL fix the leaf it names when it opens. A change of the Tree after which the edit would make another leaf, or none, a group, or after which the question's words would change, SHALL close the question with nothing applied; the question SHALL never be re-worded in place (NFR-10).

#### Scenario: The agent changes which leaf an indent would group
- **WHEN** the user presses Alt+Shift+ArrowRight on `billing`, whose question names "Customer portal", and the agent's update then moves `reporting` before `billing`
- **THEN** the question closes with nothing applied, no question names "Reporting", `billing` is still under `build` and `reporting` is still a leaf, and the focus is in the Tree's grid or toolbar

#### Scenario: The agent renames the leaf under an open question
- **WHEN** the group question is open for `portal` and the agent's update renames `portal`, or changes its estimates or the tasks that depend on it
- **THEN** the question closes with nothing applied, and the Tree is as the update left it

### Requirement: Answering the group question
"Continue" SHALL make the edit the question was asked for, on the Tree as it is then, with the focus following the node, and SHALL leave the plans unchanged. The leaf's estimates SHALL stay on it and count again once it is a leaf again. "Cancel" or Escape SHALL change nothing and return the focus to the row or control the edit came from; an edit no longer possible SHALL change nothing.

#### Scenario: Continue after the drop
- **WHEN** the user drops `billing` into `portal` and chooses "Continue"
- **THEN** `billing` is the last child of `portal`, the totals no longer count the portal's expected effort, the plan has no row for `portal`, and reporting shows the field error of a predecessor that names no task

#### Scenario: Back to a leaf
- **WHEN** the user then drags `billing` back under `build`
- **THEN** `portal` is a leaf again, its estimates count in the totals as before, and neither the Tree nor the plan holds a draft value

#### Scenario: Cancel
- **WHEN** the user drops `billing` into `portal` and chooses "Cancel", or presses Escape
- **THEN** the Tree and the plan are unchanged and the focus is on `billing`'s row

#### Scenario: Continue on "Add child"
- **WHEN** the user chooses "Add child" on `reporting` and then "Continue"
- **THEN** a child of `reporting` starts editing its empty name, and Escape there adds nothing and leaves `reporting` a leaf

## MODIFIED Requirements

### Requirement: An added package's predecessors
A package the user adds to a Tree that a Gantt plan of its question names, with `pert` or without, SHALL, once named, get in that plan the predecessors the plan gives the package it was added after ("Add node") or under ("Add child"), none when that package has none, in the same draft update (F20; EXPERIENCE Molecules, WBS with PERT).

#### Scenario: Splitting the portal
- **WHEN** the user focuses the portal, chooses "Add node" and names the package `Customer portal: dashboards`
- **THEN** the plan's `u-1` depends on Architecture and Clickable prototype and starts after the prototype ends, both items hold draft values, and no view message leaves the view

#### Scenario: A child of a leaf
- **WHEN** the user chooses "Add child" on reporting, which depends on the portal, chooses "Continue" in the group question, and names the new package
- **THEN** the new package depends on the portal in the plan

#### Scenario: An addition taken back
- **WHEN** the user chooses "Add node" and presses Escape
- **THEN** neither the Tree nor the plan holds a draft value

### Requirement: Gantt predecessors that name no task
A predecessor a task holds that names no other task, such as a work package that became a parent in the Tree, an unknown ID from the agent or the task itself, SHALL be listed checked in the task's panel, saying that it names no task, so that the user can uncheck it. The panel SHALL NOT offer the task itself, or such an ID, to any other task (FR-14).

#### Scenario: A predecessor deleted in the Tree
- **WHEN** the portal is deleted in the plan's Tree, the user confirms the question that says one task depends on it, and opens reporting's predecessors
- **THEN** reporting's predecessors are Architecture and Clickable prototype, the portal's own, and none is listed as naming no task

#### Scenario: A predecessor that became a parent
- **WHEN** the user chooses "Add child" on the portal in the plan's Tree, chooses "Continue" in the group question, names the child and opens reporting's predecessors
- **THEN** `portal` is listed checked, saying that it names no task, and once the user unchecks it and presses "Done", reporting is scheduled again with no field error
