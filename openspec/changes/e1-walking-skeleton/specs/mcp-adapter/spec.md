# Spec Delta

## Purpose

The MCP adapter is how agents reach AskBoard: the session process's tools over stdio, which validate every request against the contract and return compact, typed results, so that every capability works by pull alone (AD-4, AD-6).

## ADDED Requirements

### Requirement: Tool list
The session process SHALL list exactly `ask` then `collect`, with the input schemas, descriptions and annotations of the approved model contract, and the list SHALL NOT change during a session. Each description, and the server instructions, SHALL stay within 4,096 characters, and each full tool name within 128.

#### Scenario: Listing the tools
- **WHEN** a client lists the tools
- **THEN** it receives `ask` and `collect`, in that order, matching the approved definitions of the contract fixtures

#### Scenario: A definition grows too long
- **WHEN** a tool description or the server instructions exceed 4,096 characters
- **THEN** the adapter's tests fail

### Requirement: Server instructions for the tools listed
The server instructions SHALL be the approved model contract's instructions, keeping only the lines that apply to the tools listed.

#### Scenario: No instruction names a missing tool
- **WHEN** a client reads the server instructions
- **THEN** they name no tool other than `ask` and `collect`

### Requirement: No side effect before the first request
The session process SHALL open no port, write no file and start no process until it receives a request other than `server/discover` (AD-2).

#### Scenario: A protocol probe
- **WHEN** a client starts the session process, sends only `server/discover`, then closes stdin
- **THEN** no port was opened, no file written and no process started

### Requirement: Validation errors
The session process SHALL validate every request against the contract. A request the agent must fix SHALL return `isError` text that names the item ID and the expected shape, puts the first problems first and stays under 4,000 characters (AD-6).

#### Scenario: An invalid ask
- **WHEN** an ask's question has no options
- **THEN** the result is an error that names the question's item ID and says that `options` is required, and no ask is created

#### Scenario: Many problems
- **WHEN** a request has more problems than fit in 4,000 characters
- **THEN** the error text lists the first problems and stays under 4,000 characters

### Requirement: The ask result
A valid `ask` SHALL return at once, without waiting for the user: its result names the versions it follows, the epoch, the ask ID, state `waiting`, the first cursor and the board link (FR-21).

#### Scenario: An ask returns at once
- **WHEN** an agent sends the plain-choice ask
- **THEN** the result arrives before any user action, with state `waiting`, cursor `<epoch>.0` and a link of the form `http://127.0.0.1:<port>/b/<askId>?t=<token>`

### Requirement: A session without hooks
An ask that arrives with no agent record SHALL be unchecked: its `ask` result SHALL say that push, ownership checks and the stop guard are unavailable and that the agent must collect before it finishes, and every `collect` result SHALL mark the ask as unchecked (AD-5).

#### Scenario: E1's sessions have no hooks
- **WHEN** an agent sends an ask
- **THEN** the result carries the no-hooks warning, and a later `collect` marks that ask as unchecked

### Requirement: No board can be shown
When no board can be shown, `ask` SHALL return the typed result `unavailable` with its reason and SHALL create no ask (AD-18, NFR-8).

#### Scenario: A remote host
- **WHEN** an ask arrives while `SSH_CONNECTION` is set
- **THEN** the result is `unavailable`, naming a remote host as the reason, and no board, port or ask exists afterwards

### Requirement: Collecting events
`collect` SHALL take `{askId, after}` per ask and return, grouped by ask, each ask's ID, state, latest cursor and the events after `after`. An ask ID unknown to the current epoch with a cursor of the current epoch SHALL be an error naming it (AD-3).

#### Scenario: Collecting an answer
- **WHEN** the user has answered and the agent collects after `<epoch>.0`
- **THEN** the result holds the ask with state `answered`, cursor `<epoch>.1` and the answer event

#### Scenario: Collecting after a restart
- **WHEN** the agent collects with a cursor of an earlier epoch
- **THEN** that ask is reported `discarded`, with no events

### Requirement: Waiting for an item
`collect` with `wait` SHALL return as soon as the log gains an event for that item or an event that changes the ask's state. While it waits it SHALL send progress at least every 60 s when the request carries a progress token, and after 20 minutes it SHALL return the typed result `open` (AD-4).

#### Scenario: The answer arrives while the agent waits
- **WHEN** an agent collects with `wait` on question `database` and the user then answers it
- **THEN** the call returns with the answer event, without waiting longer

#### Scenario: Nobody answers
- **WHEN** an agent collects with `wait` and no event arrives within 20 minutes
- **THEN** the call returns `open`, having sent progress at least every 60 s

### Requirement: Result size
A result SHALL stay under 30,000 characters. A `collect` result that would exceed it SHALL return the events that fit, in order, with `more: true` (AD-6).

#### Scenario: Paging a large collect
- **WHEN** the events after the cursors passed exceed 30,000 characters
- **THEN** the result holds the first events that fit, with `more: true`, and a `collect` after its cursors returns the rest

### Requirement: Exit
The session process SHALL exit when its stdin closes or on SIGINT, SIGTERM or SIGHUP, after the discard of its open asks (AD-2). Stdout SHALL carry only MCP protocol, and diagnostics SHALL go to stderr with no agent content and no token.

#### Scenario: Claude Code stops the session process
- **WHEN** the session process receives SIGINT with a board connected
- **THEN** the board is told the ask was discarded and the process exits

#### Scenario: No token in diagnostics
- **WHEN** the session process writes diagnostics while asks are open
- **THEN** stderr holds no board token and no question text
