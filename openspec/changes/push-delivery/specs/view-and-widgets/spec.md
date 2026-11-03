# Spec Delta

## ADDED Requirements

### Requirement: The board's working signal
The board page SHALL send `board-host` a presence message whenever its working signal changes, and once after each connect: working while the page has focus and has had a key or pointer input, on the board page or in its view, within the last 60 s. The message SHALL carry only that flag, never content (AD-2, AD-7).

#### Scenario: The user types an answer
- **WHEN** the user clicks an option on a focused board
- **THEN** the board page reports that it is working

#### Scenario: A minute without input
- **WHEN** a focused board has had no input for 60 s
- **THEN** the board page reports that it is not working

#### Scenario: The user switches tabs
- **WHEN** the board's tab loses focus
- **THEN** the board page reports at once that it is not working

#### Scenario: The user switches to another application from inside the view
- **WHEN** the focus is inside the view and the browser window loses focus to another application
- **THEN** the board page reports within about a second that it is not working

### Requirement: Who asked, and where
The context header's first row SHALL name who asked: "Main agent", "Subagent <type>" or "Teammate <name>", with " · <name>" when the agent gave a display name and an ordinal ("#2") for a second subagent of the same type. It SHALL then show the labelled fields Project, Directory, Branch and Worktree from the ask's origin, and "—" for a field AskBoard does not know (FR-24, EXPERIENCE Board anatomy, DESIGN.md Context header).

#### Scenario: A named subagent in a worktree
- **WHEN** a `code-reviewer` subagent named "Retry review" asks from a linked worktree on branch `fix/retry`
- **THEN** row 1 reads "Subagent code-reviewer · Retry review", with the project, its directory, `fix/retry` and the worktree's folder name

#### Scenario: Two asks from two worktrees
- **WHEN** two asks of one project come from agents in two worktrees
- **THEN** their headers alone tell them apart

#### Scenario: A second subagent of one type
- **WHEN** a second `code-reviewer` subagent of the same session asks without a name
- **THEN** row 1 reads "Subagent code-reviewer #2"

#### Scenario: A teammate in its own pane
- **WHEN** an agent-team teammate named `researcher`, running in its own pane, asks
- **THEN** row 1 of its board reads "Teammate researcher"

#### Scenario: An in-process teammate
- **WHEN** an in-process teammate named `scout-2` asks through the lead's session
- **THEN** row 1 of its board reads "Teammate scout-2", with no ordinal

#### Scenario: The lead
- **WHEN** the lead of an agent team asks
- **THEN** row 1 reads "Main agent"

#### Scenario: An unchecked ask
- **WHEN** an ask arrives with no agent record
- **THEN** row 1 reads "Agent · <its display name>", or "Agent" without one, shows the project, and shows "—" for Directory, Branch and Worktree

### Requirement: The expected answerer in the header
Row 1 SHALL show "For: <name>" after who asked only when the ask names an expected user who differs from the session project's git user name, compared without case and surrounding spaces; on a machine with no git user name, a named expected user always shows (FR-19, FR-24).

#### Scenario: The expected user is the git user
- **WHEN** an ask names as `expectedUser` the git user name of the session project
- **THEN** the header shows no "For:"

#### Scenario: Another expected user
- **WHEN** an ask names an `expectedUser` other than the git user name
- **THEN** row 1 shows "For: <that name>" after who asked

### Requirement: The agent pill
Row 2 SHALL show the agent pill, "Agent: Working" or "Agent: Waiting for your answer", as `board-host` reports it, and change it as soon as the report changes, within the interaction that caused it. The pill shows presence only, never an ask state (AD-4, FR-24, DESIGN.md State pill).

#### Scenario: The agent starts waiting
- **WHEN** the agent calls `collect` with `wait` on the board's ask
- **THEN** the pill reads "Agent: Waiting for your answer" before the user's next action

#### Scenario: The wait ends
- **WHEN** the waiting `collect` returns with the user's answer
- **THEN** the pill reads "Agent: Working"

### Requirement: Agent text and paths in the header
Every agent string and path in the header SHALL render as text, isolated for bidirectional text, capped with an ellipsis, with the full text on hover and on keyboard focus. A bidirectional control character in a path, branch or worktree SHALL show as a visible escape (AD-8, EXPERIENCE Agent-written labels).

#### Scenario: A right-to-left override in a branch name
- **WHEN** the origin's branch holds U+202E
- **THEN** the header shows it as a visible escape, and the rest of the row keeps its order

#### Scenario: A long directory
- **WHEN** the directory is longer than its field
- **THEN** it ends in an ellipsis, and the full path shows on hover and on focus
