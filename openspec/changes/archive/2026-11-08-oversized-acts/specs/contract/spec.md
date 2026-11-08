## ADDED Requirements

### Requirement: The board's message limit and its measure
The contract SHALL define the largest message a board page may send, in UTF-8 bytes, and the measure of a message: the UTF-8 length of its JSON text, a lone surrogate counted as the three bytes of the replacement character the socket sends. It SHALL be plain ECMAScript that `board-host` and the board page share. A draft record within the draft limit SHALL always measure, in its message, within the message limit (AD-7, AD-20, NFR-10).

#### Scenario: Text the socket sends
- **WHEN** a message's JSON text holds "é", "€", an emoji and a lone surrogate
- **THEN** its measure is the length a UTF-8 encoder gives that text, counting 2, 3, 4 and 3 bytes for them

#### Scenario: A full draft record
- **WHEN** a draft record exactly at the draft limit, every character taking three bytes in UTF-8, is wrapped in its message
- **THEN** the message measures within the message limit
