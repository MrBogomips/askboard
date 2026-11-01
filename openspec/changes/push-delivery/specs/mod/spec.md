# Spec Delta

## Purpose

The mod is AskBoard's push transport inside Claude Code: it brings the user's answers and follow-ups to the agent that owns the ask while that agent works, and shows the user the pending asks, so that push costs latency when it is missing, never correctness (AD-4, AD-5, FR-21, FR-23).

## ADDED Requirements

### Requirement: Finding the session process
At session start the mod SHALL learn the Claude Code PID once, by one process run that prints its parent's PID, and SHALL look for the session file named by that key in the contract's session folder on every poll until it finds one. It SHALL take any session ID from the mod API, never from its environment. Without a session file it SHALL push nothing (AD-5).

#### Scenario: The session process starts after the mod
- **WHEN** the mod starts before the session process has written its session file
- **THEN** it pushes nothing, and once the file exists its next poll reaches the local API

#### Scenario: Claude Code runs inside another session
- **WHEN** `CLAUDE_CODE_SESSION_ID` in the mod's environment names the launching session
- **THEN** the mod still finds its own session's file, by the Claude Code PID

#### Scenario: The session process restarts
- **WHEN** the session file is replaced by one with another epoch
- **THEN** the mod forgets what it pushed for the old epoch and polls the new local API

### Requirement: Trusting the session file
The mod SHALL act on a session file only when its folder is a folder the user owns with mode 0700 and the file a plain file the user owns with mode 0600, neither a link. It SHALL check owner and mode by process runs of `find` when it first finds a session file, whenever the file names another `pid` or `epoch`, and once a minute while it acts on one. A check that fails or cannot run SHALL make it poll and push nothing, with one diagnostics line, and SHALL run again at the next poll (AD-5, AD-10).

#### Scenario: Another user made the folder first
- **WHEN** on a machine without `XDG_RUNTIME_DIR`, another user made `/tmp/askboard-<uid>` and wrote a session file in it
- **THEN** the mod polls nothing through that file, pushes nothing, and writes one diagnostics line

#### Scenario: A folder open to others
- **WHEN** the session folder has mode 0755
- **THEN** the mod pushes nothing, and pushes again once the folder is 0700

#### Scenario: A new session process
- **WHEN** the session file names a new `epoch`
- **THEN** the mod checks the folder and the file again before it polls the new local API

#### Scenario: The folder changes under the mod
- **WHEN** the session folder turns 0755 while the mod acts on its session process
- **THEN** within a minute the mod polls nothing more and writes one diagnostics line, and it checks again at each poll until the folder is 0700

### Requirement: Polling the local API
The mod SHALL poll the local API at the contract's poll interval from session start, and the poll SHALL survive `/clear`. A response from a major of the local API it does not support SHALL make it push nothing (AD-5, AD-7).

#### Scenario: After /clear
- **WHEN** the user runs `/clear` and an answer arrives afterwards
- **THEN** the mod still polls, and pushes the answer

#### Scenario: Another major
- **WHEN** the local API answers with a major version the mod does not support
- **THEN** the mod pushes nothing and the agent receives the answer through `collect`

### Requirement: Push only to the ask's owner
The mod SHALL push only events above an ask's `received` watermark, only for asks with a bound owner, and only to that owner, in its own session. An unchecked ask SHALL get no push (AD-3, AD-4, AD-5, NFR-2).

#### Scenario: Two subagents ask at once
- **WHEN** two subagents each own an ask and the user answers both
- **THEN** each answer reaches only the subagent that owns its ask

#### Scenario: An unchecked ask
- **WHEN** the user answers an ask that has no bound owner
- **THEN** the mod pushes nothing, and the answer waits for `collect`

### Requirement: Push to a subagent
The mod SHALL push to a subagent by appending a row addressed to its agent ID, and only while the mod API lists that subagent with a status other than `completed`, `failed` or `killed`. It SHALL NOT use `$.session.send` (AD-4, findings D1, D13).

#### Scenario: A running background subagent under auto mode
- **WHEN** a background subagent that owns an ask is still working under auto mode and the user answers
- **THEN** the answer is appended to that subagent's conversation and read at its next model request

#### Scenario: The subagent has finished
- **WHEN** the owner of an ask is no longer listed, or is listed as completed
- **THEN** the mod pushes nothing to it, so no finished subagent is resumed

### Requirement: Push to the main conversation
For an ask the main conversation owns, the mod SHALL append the push while a main turn runs and SHALL submit it as a new turn when the main conversation is idle. Its rows and turns SHALL be attributed to the plugin, never sent as the user (AD-4).

#### Scenario: An idle main conversation
- **WHEN** the main conversation is idle and the user answers its ask
- **THEN** a turn attributed to the plugin starts with the answer within 2 s, and a prompt the user is typing stays unsent and unchanged

#### Scenario: A main turn is running
- **WHEN** the main conversation is working and the user answers its ask
- **THEN** the answer is appended and read at the turn's next model request

### Requirement: Catch-up when a main turn ends
When a main turn completes, the mod SHALL submit, in one submit, every event it appended to the main conversation that no model request of that turn carried, by the rule of "An event is pushed once" (AD-4).

#### Scenario: An answer during the final reply
- **WHEN** an answer is appended while the main turn writes its final reply and the turn then completes
- **THEN** one turn is woken that carries the answer

#### Scenario: Two answers to catch up
- **WHEN** two answers were appended after the last request of a turn that completes
- **THEN** both are carried by one submit, which wakes one turn

### Requirement: After the user interrupts a turn
When a submit is dropped because the user interrupted a turn, the mod SHALL keep the event, append it when the next main turn starts, and count it carried only once that turn makes a second model request; otherwise it SHALL submit it when that turn completes (AD-4, finding D6).

#### Scenario: The user's next turn makes one request
- **WHEN** the user presses Esc, an answer arrives, and the user's next prompt starts a turn that makes one model request
- **THEN** the answer is submitted when that turn completes, and reaches the main conversation

#### Scenario: Before the user types again
- **WHEN** the user has pressed Esc and has not typed since
- **THEN** no push reaches the main conversation, and `collect` still returns the answer

### Requirement: An event is pushed once
An event SHALL count as pushed once its push call has been made, in the mod's own memory for the epoch, and SHALL NOT be pushed again by that mod. An appended row SHALL count as carried only once a model request of its agent starts after the append resolved, and, for an append made before a turn's first request, only from that turn's second request; never by clock times (AD-4, findings O7, D6).

#### Scenario: An append before the turn's first request
- **WHEN** an answer is appended to the main conversation after its turn starts and before its first model request, and the turn makes one request
- **THEN** the answer counts as not carried, and the catch-up submit carries it

#### Scenario: The delivery report fails
- **WHEN** the mod has pushed an answer and its report to the local API fails
- **THEN** the report alone is retried, and the answer is not pushed again

### Requirement: Delivery reports
The mod SHALL report a delivery to the local API, which raises the ask's `received` watermark and the board's receipt: for the main conversation once the push call succeeds, a catch-up covering an unread row; for a subagent only once the row counts as carried, and never if its turn completes first, so the stop guard carries the event. A failed push call SHALL NOT be reported (AD-3, AD-10, FR-22).

#### Scenario: A pushed answer's receipt
- **WHEN** the mod appends an answer to its owner and reports it
- **THEN** the board shows that answer as delivered to the agent, without a `collect`

#### Scenario: An answer appended during a subagent's final reply
- **WHEN** an answer is appended to a subagent while it writes its final reply, and its turn completes with no later model request
- **THEN** no delivery is reported, and the stop guard blocks the subagent's stop with the answer

#### Scenario: An append that fails
- **WHEN** an append throws
- **THEN** no delivery is reported, and the event stays above `received` for the next poll or `collect`

### Requirement: The push message
Every push SHALL carry the contract's push message: a fixed one-line preface, then for each ask its ID, state, latest cursor and the events with their cursors, as `collect` returns them (AD-3, AD-7).

#### Scenario: A pushed answer
- **WHEN** an answer is pushed
- **THEN** the agent receives the ask ID, the ask's state, the answer event and its cursor, which validate against the contract's push message

### Requirement: Client version report
Once per epoch, the mod SHALL report the Claude Code version the mod API gives to the local API (AD-18).

#### Scenario: The protocol carries no version
- **WHEN** a session's MCP requests carry no client information
- **THEN** the session process knows the version from the mod's report

### Requirement: A subagent's board link
When a new ask owned by a subagent appears in the pending asks, the mod SHALL show its board link to the user as a toast (FR-23, finding row 12).

#### Scenario: A background subagent asks
- **WHEN** a background subagent sends an ask
- **THEN** within one poll interval a toast shows the ask's title and its board link

### Requirement: Pending-asks list
The mod SHALL keep one status entry listing each pending ask on one line: its title, who asked, its number of questions still open and its board link. It SHALL update the entry whenever the list changes, an ask answered, closed or discarded included, and clear it when no ask is pending (FR-23).

#### Scenario: An ask is answered
- **WHEN** the agent receives the answer to the only pending ask
- **THEN** the status entry is cleared

#### Scenario: The owner finishes
- **WHEN** the subagent that owns a pending ask finishes and its ask closes
- **THEN** the ask leaves the status entry

### Requirement: When `$.http.fetch` is refused
When `$.http.fetch` fails, the mod SHALL send that request through the AskBoard bundle run as a client by a process run. After three requests in a row to one session process whose fetch failed while the client reached it, it SHALL send everything, polls, reports and the version report, through the client for the rest of the session; a fetch that succeeds resets the count. When both fail, it SHALL try again at the next poll (AD-5).

#### Scenario: One transient socket error
- **WHEN** one fetch fails with a reset while the session process restarts, and the next fetch succeeds
- **THEN** the mod keeps using fetch

#### Scenario: A policy mod refuses fetch
- **WHEN** a policy mod refuses `$.http.fetch` and the user answers an ask
- **THEN** the answer is pushed to its owner, and its delivery is reported through the process client

### Requirement: Turn reports
The mod SHALL report to the local API when a turn of the main conversation or of a subagent starts and when it completes, transitions only, through the same path as its polls (AD-4, Agent status).

#### Scenario: A subagent's turn completes
- **WHEN** a subagent that owns an ask completes its turn
- **THEN** the local API is told once that the subagent has no turn running

#### Scenario: Many model requests in one turn
- **WHEN** a turn makes ten model requests
- **THEN** the mod reports its start and its completion only
