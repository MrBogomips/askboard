## MODIFIED Requirements

### Requirement: Board protocol over a WebSocket
The board page and `board-host` SHALL talk over one WebSocket per board, whose first message carries the token. Every message SHALL follow the board protocol schema set and be refused otherwise. `board-host` SHALL send the board document on connect and after every agent change, the ask's and questions' states, receipts, acknowledgements, the draft record, closes and discards; the board page SHALL send act commands and draft records. On connect, `board-host` SHALL send the draft record it holds before the ask's state, so the board page hands the view a restored draft together with the first state (AD-20, AD-21).

#### Scenario: A message outside the schema
- **WHEN** the board page sends a message the board protocol does not define
- **THEN** `board-host` refuses it and the ask is unchanged

#### Scenario: The board connects
- **WHEN** a board page opens its WebSocket and sends its token first
- **THEN** it receives the ask's board document, then its draft record when `ask-core` holds one, then the ask's current state

#### Scenario: A board with no draft record
- **WHEN** a board page connects to an ask for which `ask-core` holds no draft record
- **THEN** it receives the ask's board document, then its current state, and no draft message

#### Scenario: A takeover's draft before the state
- **WHEN** a second tab takes the board over and the older tab sends its last draft within the takeover flush wait
- **THEN** the second tab receives the board document, then that draft record, then the ask's current state

#### Scenario: A socket that does not start with its token
- **WHEN** the first message on a board's WebSocket is not `connect` with the board's token
- **THEN** `board-host` refuses it, closes the socket with the contract's close code for a refusal, and sends nothing of the ask

#### Scenario: The agent changes a question
- **WHEN** an `update` changes a question of an ask whose board is connected
- **THEN** the board receives the new board document with that question's new `rev`, without reloading
