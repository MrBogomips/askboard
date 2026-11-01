# Spec Delta

## ADDED Requirements

### Requirement: Supported Claude Code versions
The session process SHALL take the client version from the protocol's client information when it names `claude-code`, else from the mod's report. An `ask` from a Claude Code below the contract's minimum SHALL be refused with an error naming the minimum and the version found, and SHALL create nothing. An unknown version SHALL be allowed, with one diagnostic on stderr (AD-18).

#### Scenario: Below the minimum
- **WHEN** an `ask` arrives from Claude Code 2.1.308
- **THEN** the result is an error naming 2.1.311 and 2.1.308, and no ask, board or notice exists afterwards

#### Scenario: The version from the mod
- **WHEN** the requests carry no client information and the mod has reported 2.1.312
- **THEN** the `ask` proceeds

#### Scenario: No version known
- **WHEN** neither the requests nor the mod name a Claude Code version
- **THEN** the `ask` proceeds, and stderr holds one diagnostic saying that the version is unknown

## MODIFIED Requirements

### Requirement: A session without hooks
An ask that arrives with no agent record SHALL be unchecked: its `ask` result SHALL say that push, ownership checks and the stop guard are unavailable and that the agent must collect before it finishes, and every `collect` result SHALL mark the ask as unchecked (AD-5). An ask bound to a record SHALL carry neither the warning nor the mark.

#### Scenario: A session without hooks
- **WHEN** an agent sends an ask in a session whose hooks do not run
- **THEN** the result carries the no-hooks warning, and a later `collect` marks that ask as unchecked

#### Scenario: A session with hooks
- **WHEN** an agent sends an ask whose `PreToolUse` record reached the session process
- **THEN** the result carries no no-hooks warning, and a later `collect` does not mark the ask as unchecked
