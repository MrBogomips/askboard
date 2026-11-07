## ADDED Requirements

### Requirement: Asking from the agent that needs the answers
`SKILL.md` SHALL tell the agent to ask from the agent that needs the answers, SHALL say that its own asks never block it, so it keeps working while the user answers, and SHALL tell it not to hand its questions to a subagent to ask for it, since that subagent's ask closes when it finishes and later answers are lost. No file of the skill SHALL offer a subagent, in the background or not, that asks on another agent's behalf (FR-21, FR-25, AD-5, UJ-2).

#### Scenario: The advice line
- **WHEN** the generated `SKILL.md`'s "After you ask" section is read
- **THEN** it says to ask from the agent that needs the answers, that the agent's own asks never block it and it keeps working while the user answers, and not to hand its questions to a subagent to ask for it, because that ask closes when the subagent finishes and later answers are lost

#### Scenario: No subagent asks on another agent's behalf
- **WHEN** every file the skill generator writes is read
- **THEN** none offers a background subagent or a side dialogue, and none advises a subagent that asks, waits and returns the answers to another agent

#### Scenario: A subagent still asks its own task's questions
- **WHEN** the generated `SKILL.md`'s routing section is read
- **THEN** it still says that a subagent asks every question through AskBoard

## REMOVED Requirements

### Requirement: Dialogues in a background subagent
**Reason**: Removed by the PO's decision of 2026-11-07 (OpenSpec change `skill-no-delegated-asks`): a subagent that asks for another agent loses every answer given after it finishes, a postponed one included (FR-25, UJ-2), its ask cannot be collected, updated, fetched or snapshotted by the main conversation (AD-5), its answers arrive as one batch at its end (FR-22), it costs more output tokens than asking directly (SM-1), and how the hooks guard its ask was never probed. Keeping working while the user answers needs no subagent (FR-21, AD-4).
**Migration**: Ask from the agent that needs the answers and keep working; see "Asking from the agent that needs the answers". A subagent still asks the questions of its own task through AskBoard ("Routing between AskBoard and AskUserQuestion").
