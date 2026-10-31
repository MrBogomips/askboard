# Spec Delta

## MODIFIED Requirements

### Requirement: Board protocol over a WebSocket
The board page and `board-host` SHALL talk over one WebSocket per board, whose first message carries the token. Every message SHALL follow the board protocol schema set and be refused otherwise. `board-host` SHALL send the board document on connect and after every agent change, the ask's and questions' states, receipts, acknowledgements, the draft record, closes and discards; the board page SHALL send act commands and draft records.

#### Scenario: A message outside the schema
- **WHEN** the board page sends a message the board protocol does not define
- **THEN** `board-host` refuses it and the ask is unchanged

#### Scenario: The board connects
- **WHEN** a board page opens its WebSocket and sends its token first
- **THEN** it receives the ask's board document and current state, then its draft record when `ask-core` holds one

#### Scenario: A socket that does not start with its token
- **WHEN** the first message on a board's WebSocket is not `connect` with the board's token
- **THEN** `board-host` refuses it, closes the socket with the contract's close code for a refusal, and sends nothing of the ask

#### Scenario: The agent changes a question
- **WHEN** an `update` changes a question of an ask whose board is connected
- **THEN** the board receives the new board document with that question's new `rev`, without reloading

### Requirement: One live board per ask
Each ask SHALL have at most one live board connection. A new connection for the same ask SHALL take over: the older tab SHALL be told that the board moved, and the new one SHALL receive the draft record once the older tab's last draft has arrived or the contract's takeover flush wait has passed. Closing the older tab discards nothing (AD-21).

#### Scenario: The link is opened in a second tab
- **WHEN** a board is open and its link is opened in another tab
- **THEN** the new tab holds the live board, and the older one is told that the board moved, its socket is closed, and it shows that the board moved without reconnecting on its own

#### Scenario: Unsent work follows the takeover
- **WHEN** the user typed a note in one tab and opens the board's link in another
- **THEN** the new tab shows the note once the older tab's last draft has arrived

## ADDED Requirements

### Requirement: Connections reported to the core
`board-host` SHALL report to `ask-core` each board connection it accepts and each close of the live connection. The older socket of a takeover SHALL NOT count as a disconnection (AD-21).

#### Scenario: A takeover is no disconnection
- **WHEN** a second tab takes the board over
- **THEN** `ask-core` is told of one connection and of no disconnection, and starts no grace timer

#### Scenario: The tab closes for good
- **WHEN** the live board's socket closes and no board connects within the grace period
- **THEN** the board's link then opens only the page that says the ask was discarded

### Requirement: Acknowledging commands
`board-host` SHALL answer every act command with an acknowledgement naming its action ID, or with a refusal naming the action ID, the refused act and the reason, followed by the ask's state. A refused command SHALL leave the socket open and the ask unchanged.

#### Scenario: A submit lands
- **WHEN** the board page sends a submit that `ask-core` appends
- **THEN** the page receives an acknowledgement with the submit's action ID and the new state

### Requirement: Draft mirror
`board-host` SHALL pass each draft record from the live board, or from a board being moved within the takeover flush wait, to `ask-core`, and SHALL ignore one from any other socket. A record over the contract's draft limit SHALL be refused (AD-20).

#### Scenario: A draft from a moved tab after the wait
- **WHEN** a tab that lost the board sends a draft record after the takeover flush wait
- **THEN** the record is ignored and the held draft record is the new tab's

### Requirement: A closed ask's board
When an ask closes, `board-host` SHALL tell its live board. A closed ask's link SHALL still open its board, locked and showing that the ask is closed, and its socket SHALL refuse every act (FR-6).

#### Scenario: Opening a closed ask's link
- **WHEN** the link of an ask the agent closed is opened
- **THEN** the board shows the ask, locked, with the Closed banner, and accepts no answer
