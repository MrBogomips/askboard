# Spec Delta

## Purpose

The view and its widgets show an ask's board in the user's browser: agent content rendered only as data, in a sandboxed view built from the board document, with every user action leaving as a typed message and nothing answered without an explicit act (AD-8, AD-9, AD-10).

## ADDED Requirements

### Requirement: The Gantt's chunks
The Gantt SHALL be built as the component chunk `gantt` of the view's manifest, and `compute` as a library chunk that it needs; `assemble` SHALL inline them only for a board whose items render with the Gantt (AD-9).

#### Scenario: The manifest
- **WHEN** the view is built
- **THEN** the manifest lists the component chunk `gantt`, registering `gantt` and needing the shell, `react`, `radix` and `compute`, each chunk with a hash that matches its content and its licence notices

#### Scenario: Only boards with a Gantt load them
- **WHEN** the plain-choice board document and a board document holding a Gantt are assembled
- **THEN** the first srcdoc holds neither `gantt` nor `compute`, and the second holds both

#### Scenario: A Gantt board in each engine
- **WHEN** a board holding the Gantt plan is loaded, edited and answered in Chromium, Firefox and WebKit
- **THEN** no CSP violation is reported by the view, its host page or the console

### Requirement: Gantt layout
The Gantt SHALL show, in the widget frame, a grid with one row per task (its name, start, duration and predecessors) beside AskBoard's own chart on a time axis: one bar per task, finish-to-start arrows, the critical path as solid bars in the critical colour with heavier arrows, and a legend reading task, critical path and your change. Every agent string SHALL render as text (AD-8; DESIGN.md Widgets, Gantt).

#### Scenario: The UJ-2 plan opens
- **WHEN** the fixture plan opens
- **THEN** the grid lists the six work packages in the Tree's order, UX design starts on 11/2/2026, reporting ends on 12/11/2026, and the bars of UX design, the prototype, the portal and reporting are drawn as the critical path

#### Scenario: Markup in agent strings
- **WHEN** a task's name holds `<img src=x onerror=alert(1)>`
- **THEN** the grid shows those characters as text, and no element is created from them

### Requirement: Gantt plan scope
A Gantt plan SHALL take its tasks from the leaves of the Tree it names, in the Tree's order, draw no bar for a parent, and show each duration as its PERT expected effort rounded up to whole working days, read-only. Its toolbar SHALL offer the zoom "Day | Week | Month", opening at week (FR-11, FR-15; DESIGN.md and EXPERIENCE Molecules, Gantt plan).

#### Scenario: Zooming
- **WHEN** the user chooses "Month" and then "Day"
- **THEN** the axis and the bars rescale each time, "Answer" stays disabled, and no message leaves the view

#### Scenario: A standalone Gantt
- **WHEN** a Gantt with its own tasks opens
- **THEN** it shows the week scale with no zoom control and no baseline, and its durations are editable

### Requirement: Gantt dates follow the edits
Every edit SHALL reschedule the Gantt on the board within the same interaction, without the agent: the edited task's dependents move, and the critical path follows. In a plan, an estimate changed in its Tree SHALL change the task's duration and the schedule the same way (FR-12, AD-13).

#### Scenario: A task moved later
- **WHEN** the user moves the portal three working days later
- **THEN** reporting moves three working days later, and the plan ends three working days later

#### Scenario: An estimate changed in the work breakdown
- **WHEN** the user changes the portal's most likely estimate in the Tree from 12 to 20
- **THEN** the portal's duration in the plan becomes 18 working days, and reporting and the plan's end move with it

### Requirement: Gantt rescheduling by drag
The user SHALL reschedule a task by dragging its bar with the pointer. The bar SHALL snap to working days and stop at the earliest start its predecessors allow, which SHALL show as a guide during the drag. Dropping it on its earliest start SHALL clear its requested start; Escape during the drag SHALL cancel it (EXPERIENCE Widgets, Gantt; F-24).

#### Scenario: Dragging past the predecessors
- **WHEN** the user drags reporting's bar to start before the portal ends
- **THEN** the bar stops at the day after the portal ends, the guide shows there, and dropping it changes nothing

#### Scenario: Dropping on a weekend
- **WHEN** the user drops reporting's bar with its start over Saturday 12/12/2026
- **THEN** reporting starts on Monday 12/14/2026

### Requirement: Gantt durations
In a Gantt with its own tasks, the user SHALL change a task's duration by dragging the end of its bar or by typing it in the grid, as whole working days, never below one (EXPERIENCE Widgets, Gantt).

#### Scenario: Resizing a bar
- **WHEN** the user drags the end of a 6-day task's bar two working days to the right
- **THEN** its duration is 8 working days, and its dependents move two working days later

#### Scenario: Below one day
- **WHEN** the user drags the end of a 1-day task's bar to the left
- **THEN** its duration stays 1 working day

### Requirement: Gantt editing in the grid
The user SHALL edit a task's start and, in a Gantt with its own tasks, its duration in the grid: Enter or F2 starts editing, Enter or leaving the field commits, Escape restores. A start SHALL be read by AskBoard's own en-US date parser, echoing the parsed day, and refused with a message when it is no date, not a working day, or before the earliest start; an empty start SHALL clear the request.

#### Scenario: Typing a start
- **WHEN** the user types `12/9/2026` in reporting's start and presses Enter
- **THEN** reporting starts on Wednesday 12/9/2026 and the draft holds the change

#### Scenario: A start the predecessors do not allow
- **WHEN** the user types `11/20/2026` in reporting's start and presses Enter
- **THEN** the field shows a message naming 12/4/2026 as the earliest start, keeps the focus, and the draft is unchanged

#### Scenario: A duration that is not whole
- **WHEN** the user types `2.5` in a task's duration and presses Enter
- **THEN** the field shows a message, keeps the focus, and the draft is unchanged

### Requirement: Gantt predecessors
The user SHALL edit a task's predecessors from its grid row, in an inline panel listing every other task to check or uncheck. A task that would close a cycle SHALL be disabled, saying why, and a task at the limit of 50 predecessors or 50 dependents SHALL take no more (EXPERIENCE Widgets, Gantt; proposal open question 9).

#### Scenario: Linking an added package
- **WHEN** the user opens `u-1`'s predecessors and checks Architecture and Clickable prototype
- **THEN** `u-1` starts after the prototype ends, and the draft holds the change

#### Scenario: A cycle offered
- **WHEN** the user opens the prototype's predecessors
- **THEN** the portal and reporting, which depend on the prototype, are disabled

### Requirement: Gantt formula errors
A task whose schedule is in error, from a dependency cycle or a predecessor that names no task, SHALL show a field error under its row and no bar, and SHALL NOT block "Answer" (AD-13, FR-14; EXPERIENCE State Patterns, By surface).

#### Scenario: A cycle from the agent
- **WHEN** a Gantt whose two tasks depend on each other opens
- **THEN** both rows show a field error, neither has a bar, the other tasks are scheduled, and the question can be answered once the user changes something

### Requirement: Gantt edits only fill the draft
Every Gantt edit SHALL go into the draft record and SHALL send nothing. A Gantt whose edits bring it back to the agent's value SHALL hold no draft value (AD-9, AD-10, AD-20).

#### Scenario: Editing without answering
- **WHEN** the user drags, resizes, types starts and durations and changes predecessors
- **THEN** no view message other than the question's `ready` leaves the view

#### Scenario: Edits undone by hand
- **WHEN** the user drags a task later and then back onto its earliest start
- **THEN** the Gantt holds no draft value and "Answer" is disabled again

### Requirement: Answering a question with a Gantt
"Answer" SHALL send one answer message carrying each changed widget's full edited value and the Gantt's declared derived values as they stand, and nothing for an untouched Gantt. The question SHALL then be read-only (AD-10, AD-20, FR-12).

#### Scenario: The UJ-2 edits by keyboard
- **WHEN** the user makes the approved answer's edits with the keyboard, in the Tree and in the plan, and presses "Answer"
- **THEN** one answer message leaves the view; the contract's diff of the sent and the edited plan is the fixture's diff form of the approved `schedule` edit, and its derived values are `schedule.finish` `2026-12-02` and `schedule.criticalPath` `ux`, `prototype`, `portal`, `reporting`

#### Scenario: Nothing changed
- **WHEN** a Gantt question opens and the user only zooms and moves the focus
- **THEN** "Answer" stays disabled

### Requirement: Gantt change highlight
A task the user changed SHALL take the change outline on its bar and the change fill on its changed cells; in a plan, a task the user added or re-estimated in its Tree SHALL be marked the same way, and a task that moved only because a predecessor moved SHALL NOT. The toolbar SHALL read "Changes vs agent's original · none yet", then "Your changes: N", counting each task changed in the Gantt once (FR-11; EXPERIENCE Change highlight).

#### Scenario: Counting changes
- **WHEN** the user, with `u-1` added in the Tree, moves reporting later and gives `u-1` two predecessors
- **THEN** both bars carry the change outline, the portal's does not, and the toolbar reads "Your changes: 2"

### Requirement: Gantt plan baseline
A Gantt plan SHALL draw under each task's bar the dates the agent's plan gave it, as sent, and SHALL draw none for a task the agent did not send (FR-12; DESIGN.md Molecules, Gantt plan).

#### Scenario: A baseline after a move
- **WHEN** the user moves reporting three working days later
- **THEN** reporting's baseline still spans 12/4/2026 to 12/11/2026 under its moved bar

#### Scenario: An added package
- **WHEN** the user adds `u-1` in the Tree
- **THEN** `u-1` has a bar and no baseline

### Requirement: Read-only Gantt
When its question is answered, being sent or locked, the Gantt SHALL stay readable, zoomable and navigable from the keyboard, and SHALL accept no edit: bars do not drag, cells do not edit and the predecessors panel does not open (AD-10, AD-21).

#### Scenario: After "Answer"
- **WHEN** the user has pressed "Answer" on a Gantt question
- **THEN** dragging a bar and pressing Enter on a start change nothing, and the zoom still works

### Requirement: Gantt keyboard
The grid SHALL be one Tab stop and, in a plan, the toolbar another. In the grid, the arrow keys, Home and End SHALL move the focus between cells; Enter or F2 edits; Delete or Backspace on a start clears the request. These keys SHALL trigger no browser action, and every keyboard path SHALL show the focus ring (NFR-12; EXPERIENCE Accessibility Floor).

#### Scenario: Rescheduling with the keyboard only
- **WHEN** the user tabs into the grid, moves to reporting's start with the arrow keys, types `12/9/2026` and presses Enter
- **THEN** reporting starts on 12/9/2026, the focus stays on its start, and the page has not navigated

#### Scenario: Clearing a request
- **WHEN** the focus is on a requested start and the user presses Delete
- **THEN** the task moves back to its earliest start, and the cell loses its change fill
