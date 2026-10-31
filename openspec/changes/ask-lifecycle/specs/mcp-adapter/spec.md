# Spec Delta

## MODIFIED Requirements

### Requirement: Tool list
The session process SHALL list exactly `ask`, `update`, `collect` and `fetch`, in that order, with the input schemas, descriptions and annotations of the approved model contract, and the list SHALL NOT change during a session. Each description, and the server instructions, SHALL stay within 4,096 characters, and each full tool name within 128.

#### Scenario: Listing the tools
- **WHEN** a client lists the tools
- **THEN** it receives `ask`, `update`, `collect` and `fetch`, in that order, matching the approved definitions of the contract fixtures

#### Scenario: A definition grows too long
- **WHEN** a tool description or the server instructions exceed 4,096 characters
- **THEN** the adapter's tests fail

### Requirement: Server instructions for the tools listed
The server instructions SHALL be the approved model contract's instructions, keeping only the lines that apply to the tools listed.

#### Scenario: The instructions are the approved text
- **WHEN** a client reads the server instructions
- **THEN** they equal the approved `server-instructions.md`, which names no tool that is not listed

### Requirement: A session without hooks
An ask that arrives with no agent record SHALL be unchecked: its `ask` result SHALL say that push, ownership checks and the stop guard are unavailable and that the agent must collect before it finishes, and every `update`, `collect` and `fetch` result SHALL mark the ask as unchecked (AD-5).

#### Scenario: E3's sessions have no hooks
- **WHEN** an agent sends an ask, then updates, collects and fetches it
- **THEN** the `ask` result carries the no-hooks warning, and the `update`, `collect` and `fetch` results mark that ask as unchecked

### Requirement: Result size
A result SHALL stay under 30,000 characters. A `collect` result that would exceed it SHALL return the events that fit, in order, with `more: true`, and SHALL never split the events of one board command; a command whose events alone exceed the limit SHALL fill a page by itself (AD-6, AD-20).

#### Scenario: Paging a large collect
- **WHEN** the events after the cursors passed exceed 30,000 characters
- **THEN** the result holds the first events that fit, with `more: true`, and a `collect` after its cursors returns the rest

#### Scenario: A submit at a page's edge
- **WHEN** a page has room for only two of a submit's three events
- **THEN** the page ends before the submit, and the next `collect` returns all three

### Requirement: Waiting for an item
`collect` with `wait` SHALL name a question and return as soon as the log gains an event for it, follow-ups included, or the ask's state changes; and at once when the question is postponed (outcome `postponed`), the ask closed (outcome `closed`) or the ask discarded (state `discarded`). It SHALL send progress at least every 60 s when the request carries a progress token, and SHALL return `open` after 20 minutes (AD-4).

#### Scenario: The answer arrives while the agent waits
- **WHEN** an agent collects with `wait` on question `database` and the user then answers it
- **THEN** the call returns with the answer event, without waiting longer

#### Scenario: A follow-up ends the wait
- **WHEN** an agent waits on question `q2` and the user writes a follow-up on it
- **THEN** the call returns with the `follow-up` event, so the agent can reply

#### Scenario: Waiting on a postponed question
- **WHEN** an agent waits on a question the user has postponed
- **THEN** the call returns at once with outcome `postponed`

#### Scenario: Nobody answers
- **WHEN** an agent collects with `wait` and no event arrives within 20 minutes
- **THEN** the call returns `open`, having sent progress at least every 60 s

## ADDED Requirements

### Requirement: Updating an ask
`update` SHALL apply its actions through `ask-core` and return at once the versions, epoch, ask ID, the ask's state and, per action, its item ID with the question's new `rev` where it changed; a recorded answer SHALL be reported with its `who` and `when`. The result SHALL carry no cursor, so the agent's cursor still covers every event it has not collected (AD-3, FR-6).

#### Scenario: Adding and rewording
- **WHEN** an agent adds question `q4` and changes the text of open question `q2`
- **THEN** the result names `q4` at `rev` 1 and `q2` at `rev` 2, with the ask's state, and the board shows both without a reload

### Requirement: Refused updates
An update `ask-core` refuses SHALL return `isError` text under 4,000 characters that names the action's index, the item ID and why, and for a question whose answer is logged, that answer's cursor; the ask SHALL be unchanged (AD-6, AD-20).

#### Scenario: Changing an answered question
- **WHEN** an agent changes a question answered at `<epoch>.2`
- **THEN** the result is an error naming the action, the question and `<epoch>.2`, saying that the question must be reopened first

### Requirement: Closed and discarded asks in update and fetch
`update` on a closed ask SHALL return the typed result `closed`. `update` and `fetch` on a discarded ask, or on an ask ID unknown to the current epoch, SHALL return the typed result `discarded`, naming the ask (AD-10, AD-21).

#### Scenario: After a restart
- **WHEN** an agent updates an ask it sent before the session process restarted
- **THEN** the result is `discarded`, never an error that the ask is unknown

### Requirement: Fetching an item
`fetch` SHALL return one item of an open or closed ask as `ask-core` holds it now: its type, `rev` and props, and for a question its state and current answer in full. It SHALL return nothing from the draft record, SHALL NOT raise `received`, and an item ID the ask does not hold SHALL be an error naming it (FR-20, AD-6).

#### Scenario: Fetching after a revision
- **WHEN** the user answered `database` with `PostgreSQL`, then revised it to `SQLite`, and the agent fetches `database`
- **THEN** the result holds the question at its `rev` with the answer `SQLite` and its cursor

#### Scenario: Fetching a closed ask
- **WHEN** an agent fetches a question of an ask it closed
- **THEN** the result holds the question and its answer as they were at the close

### Requirement: Fetch pages
When an item's value does not fit one result, `fetch` SHALL return consecutive slices of its RFC 8785 JSON text, each under the contract's page size, with a `continuation` naming the item's `rev` and the next offset, and none on the last slice. A continuation for a value that changed since SHALL be refused, saying to fetch again (open question 5).

#### Scenario: A long question
- **WHEN** a question's full value is longer than one page
- **THEN** `fetch` returns its first slice and a continuation, and the slices joined in order parse as the full value

#### Scenario: The value changed between pages
- **WHEN** the agent changes the item, then fetches with a continuation issued before
- **THEN** the result is an error saying the item changed and to fetch it again
