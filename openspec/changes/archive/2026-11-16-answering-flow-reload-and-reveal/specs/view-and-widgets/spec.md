## ADDED Requirements

### Requirement: A restored answer is not a revision
When a reload or a takeover restores a draft record whose work on a question equals the answer the board state logged for it at the same revision (choice, widget values, results, "Other…" text and notes, with no field or cell entry), the board SHALL restore no work for that question: its card SHALL show the logged answer read-only with the receipt the board state gives. Work that differs in any part SHALL come back as a revision (AD-20, FR-25, NFR-10).

#### Scenario: A reload while the mirror still holds the sent Tree
- **WHEN** the user renames a node of the Tree, the board page has mirrored the renamed Tree, the user sends the answer and reloads as soon as the receipt reads "sent"
- **THEN** the card reads Sent, not Draft, the Tree shows the renamed node read-only, and the receipt reads "sent", then "delivered to the agent" once the agent collects

#### Scenario: A takeover in that state
- **WHEN** another tab opens the board while `board-host` holds that mirrored record
- **THEN** the new tab's card shows the renamed node read-only with the receipt "sent"

#### Scenario: A revision restored as one
- **WHEN** the restored record's Tree differs from the logged answer by one more renamed node
- **THEN** the card reads Draft, and the Tree shows both renamed nodes, editable, as a revision of the logged answer

### Requirement: The user's scroll during the move
The move to the next question SHALL stop where it is, with no landing, at its next frame after a wheel, a touch or a key that scrolls or moves focus (Tab included) pressed during the move, and once the page has moved after a pointer press or a focus moved off the target. A key held since before the move SHALL not stop it. Any other movement is the browser's: the move SHALL go on from where the page is and land as asked (FR-2, NFR-12).

#### Scenario: The browser's smooth scroll still runs
- **WHEN** with "Go to the next", in sections, the page is still running a smooth scroll it started itself when the user presses Enter on question 3's "Send answer"
- **THEN** within one second question 4's card top lies 8 px (±2 px) under the header's bottom edge, and its heading has focus

#### Scenario: The user's wheel during the move
- **WHEN** the user turns the mouse wheel while the move runs
- **THEN** the move stops, and the page stays where the wheel put it

#### Scenario: A key pressed during the move
- **WHEN** the user presses Tab while the move runs
- **THEN** the move stops where the page is at its next frame, no landing follows, and focus is where Tab put it

#### Scenario: A focus moved during the move
- **WHEN** the user moves focus to another question's heading while the move runs
- **THEN** the move stops, the page shows that heading, and focus stays on it
