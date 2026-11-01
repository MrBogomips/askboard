# Spec Delta

## ADDED Requirements

### Requirement: Owner of an ask
The agent of the first `ask` call bound to an agent record SHALL own the ask, and a later record from another agent SHALL NOT change the owner. `ask-core` SHALL know the owner only as an opaque owner key; Claude Code identifiers stay in the local API's record table (AD-5).

#### Scenario: A subagent's ask
- **WHEN** a subagent's `ask` arrives bound to its record
- **THEN** the ask is owned by that subagent, and nothing in `ask-core` holds its `agent_id`

#### Scenario: An ask without a record
- **WHEN** an `ask` arrives with no bound record
- **THEN** the ask has no owner and is unchecked

### Requirement: Binding a record to its call
A record SHALL bind to the call that carries the same `tool_use_id`, whatever the time between them, since a permission prompt can stand between a hook and its call. A call without one SHALL bind to the first unbound record of the same tool and the same ask IDs received within the contract's record timeout. Unbound records SHALL expire after the contract's longer hold time, and their number SHALL be bounded (AD-5).

#### Scenario: Bound by tool_use_id
- **WHEN** a call carries `claudecode/toolUseId` in its `_meta` and a record with that `tool_use_id` exists
- **THEN** the call is bound to that record, whatever other records exist

#### Scenario: A stale record
- **WHEN** a record arrives, and a call without a `tool_use_id` for the same tool and ask IDs comes after the record timeout
- **THEN** the call does not bind to it

#### Scenario: A slow permission prompt
- **WHEN** the call carrying a record's `tool_use_id` arrives two minutes after the record, once the user has approved it
- **THEN** it binds to that record

### Requirement: Origin of an ask
Each owned ask SHALL keep an origin set once from its owning record: the owner key; a label, "Main agent" or "Subagent <type>", with an ordinal for the second and later subagents of one type; the `cwd`; the root, the real path of the git worktree of the `cwd` when it belongs to the project's repository, else of the session project root; the directory, the `cwd` relative to the root; the branch; and the worktree. Without a session project root it SHALL have none of the last four (AD-5, AD-12).

#### Scenario: A subagent in another worktree
- **WHEN** a subagent working in a worktree of the project's repository asks
- **THEN** the ask's root is that worktree, and its origin names the worktree and its branch

#### Scenario: The directory is set at the bind
- **WHEN** a subagent working in `services/orders` under its worktree asks
- **THEN** the ask's origin holds the directory `services/orders`, worked out once when the record is bound, and a `cwd` outside the root is held as the absolute `cwd`

#### Scenario: A cwd outside the repository
- **WHEN** the owning record's `cwd` is outside the project's repository
- **THEN** the ask's root is the project root

#### Scenario: No session project root
- **WHEN** the session process runs without `CLAUDE_PROJECT_DIR`, or with one whose real path cannot be read, and a subagent working in a worktree of the repository asks
- **THEN** the ask's origin has its label and `cwd` and no root, directory, branch or worktree, git does not run for it, and the working folder never stands in for the root

#### Scenario: git pointed at another repository
- **WHEN** the session process's environment sets `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR` or `GIT_INDEX_FILE` to another repository
- **THEN** the origin is resolved from the repository of the `cwd`, since git runs without those variables

### Requirement: Only the owner acts on an owned ask
`collect` on an owned ask, and `update` and `fetch` once the ask-lifecycle change lists them, SHALL be refused, naming the ask, unless the call is bound to a record of its owner. An unchecked ask SHALL take any caller's calls (AD-5).

#### Scenario: Another subagent collects
- **WHEN** a subagent collects an ask another subagent owns
- **THEN** the call is refused, naming the ask as owned by another agent, and `received` does not move

#### Scenario: A call without a record
- **WHEN** a `collect` on an owned ask arrives with no bound record
- **THEN** it is refused, saying that the call carried no agent record and may be retried

#### Scenario: Another subagent updates
- **WHEN** a subagent sends `update` on an ask another subagent owns
- **THEN** the call is refused, naming the ask, and the ask is unchanged

### Requirement: Re-sending comes from the owner
An identical `ask` with the ID of an open owned ask SHALL return that ask's board only when it comes from the owner; from any other agent it SHALL be refused, naming the ID as in use (AD-6).

#### Scenario: Two subagents pick one ID
- **WHEN** two subagents running one skill send identical asks under the same ID
- **THEN** the first owns the ask, and the second is refused with the ID named as in use

### Requirement: Closing a finished subagent's asks
When the session process is told that a subagent finished, `ask-core` SHALL close every open ask that subagent owns with reason `agent-finished`, appending the `closed` event; their boards SHALL show the ask as closed and accept no more answers (AD-10, FR-25). The `closed` state and `ask-core`'s close come from the ask-lifecycle change.

#### Scenario: The guard lets a subagent stop
- **WHEN** a subagent owning a `waiting` ask finishes with nothing above `received`
- **THEN** the ask is closed, its log ends with a `closed` event with reason `agent-finished`, and its board shows it closed and refuses a later answer

### Requirement: Agent status of an ask
Each ask SHALL have an agent status, presence only and never an event: `waiting` while a waiting `collect` on it is pending, except a main-conversation call past Claude Code's background threshold, or while the mod reports that the owner has no turn running; `working` otherwise, from the ask's creation (AD-4).

#### Scenario: A subagent waits in collect
- **WHEN** the owning subagent calls `collect` with `wait` on the ask
- **THEN** the status becomes `waiting` at once, and `working` when the call returns

#### Scenario: A main-conversation call moves to the background
- **WHEN** the main conversation's waiting `collect` has been pending longer than Claude Code's background threshold
- **THEN** the status becomes `working`, unless the mod reports that the main conversation has no turn running

#### Scenario: The owner's turn ends
- **WHEN** the mod reports that the owning agent's turn completed
- **THEN** the status becomes `waiting`, and `working` when the mod reports its next turn

#### Scenario: Nothing reports
- **WHEN** an ask is created and neither a waiting `collect` nor the mod reports anything
- **THEN** its status stays `working`

## MODIFIED Requirements

### Requirement: Received watermark
Per ask, `ask-core` SHALL keep a `received` watermark that only increases: the highest `seq` a read has returned, a stop block has carried or a push has been reported delivered. When it passes an answer's event, `board-host` SHALL be told, so that the board marks that answer delivered to the agent (AD-3).

#### Scenario: Collecting raises the watermark
- **WHEN** a read returns the answer event with `seq` 1
- **THEN** `received` becomes 1 and the board is told that the answer was delivered

#### Scenario: An older cursor does not lower it
- **WHEN** a later read passes cursor `<epoch>.0` again
- **THEN** `received` stays 1

#### Scenario: A push is reported
- **WHEN** the mod reports that it pushed the answer with `seq` 1
- **THEN** `received` becomes 1, the board marks the answer delivered, and a later poll returns nothing for that ask

#### Scenario: A stop block carries the answer
- **WHEN** the stop guard blocks with the answer with `seq` 1
- **THEN** `received` becomes 1
