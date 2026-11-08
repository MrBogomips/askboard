## ADDED Requirements

### Requirement: The board's message limit
`board-host` SHALL close a board's socket with the WebSocket code 1009 on a message whose payload passes the contract's message limit, without parsing it and changing nothing of the ask; a message within the limit SHALL be read as any other (AD-21, NFR-10).

#### Scenario: A message over the limit
- **WHEN** the live board sends an act command one byte over the limit
- **THEN** its socket closes with 1009 and the ask's log is unchanged

#### Scenario: A message at the limit
- **WHEN** the live board sends a message of exactly the limit
- **THEN** `board-host` reads it, refusing or applying it as its content says, and the socket stays open
