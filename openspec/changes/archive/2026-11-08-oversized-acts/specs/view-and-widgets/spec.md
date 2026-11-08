## ADDED Requirements

### Requirement: An answer too large to send
The board page SHALL refuse an act command whose message would pass the contract's message limit: it SHALL send and hold nothing, stay live and keep sending later commands. Each question the command carried SHALL show that it was not sent, with its size and the limit, until its work changes or it is sent; the user's work SHALL stay in the draft, and held acts SHALL stay held. A socket closed as too large SHALL not have its commands sent again (NFR-10, AD-10, AD-21).

#### Scenario: One answer too large
- **WHEN** in immediate delivery the user presses "Answer" on a question whose answer measures over the limit
- **THEN** nothing reaches `board-host`, the card says the answer was not sent with its size and the limit, the work stays, and an answer to another question then goes and is logged

#### Scenario: Submit too large
- **WHEN** in submitted delivery the user presses Submit and its command would pass the limit
- **THEN** nothing is sent, every held act stays held, and each question in it says Submit was too large

#### Scenario: The socket closed as too large
- **WHEN** `board-host` closes the board's socket with 1009 after commands were sent on it
- **THEN** the board page reconnects, sends none of those commands again, and their questions say they were not sent; a later answer goes and is logged

### Requirement: Work too large to keep across a reload
When the draft record would pass the draft limit, the board page SHALL mirror it without the work of whole questions, the largest first, until it fits, and SHALL never mirror part of a question's work. Each question left out SHALL say that a reload would lose its work; that work SHALL stay on the board and in "Copy my unsent work" (AD-20, FR-25).

#### Scenario: One question too large to keep
- **WHEN** one question's work passes the draft limit while another question holds a note
- **THEN** the mirrored record holds the note's question and none of the large one's work, and the large one's card says a reload would lose its work

#### Scenario: Back within the limit
- **WHEN** the user shortens that work until the record fits
- **THEN** the next mirrored record holds it and the line goes

## MODIFIED Requirements

### Requirement: Leave-page prompt
The board page SHALL arm the browser's leave-page prompt while the draft holds unsent work, work too large to keep across a reload included, or postponed questions are open, and the bottom action bar SHALL then show "You have 1 postponed question: closing loses this ask", with the count (FR-25).

#### Scenario: Closing with a postponed question
- **WHEN** a question is postponed and the user closes the tab
- **THEN** the browser's prompt to leave the page appears first

#### Scenario: Closing with work too large to keep
- **WHEN** the only unsent work is a question's work left out of the mirrored record and the user closes the tab
- **THEN** the browser's prompt to leave the page appears first

#### Scenario: Taken over with work too large to keep
- **WHEN** another tab takes the board over while this tab's draft holds a question's work left out of the mirrored record, and the user closes this tab
- **THEN** the browser's prompt to leave the page appears first, since the takeover handed over only the mirrored record
