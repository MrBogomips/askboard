## ADDED Requirements

### Requirement: The board's frame
A board SHALL show its context header, sticky at the top, then a left rail 256 px wide and the content column, and SHALL have no bottom action bar. On a board of two or more questions, in every presentation, the rail SHALL stay under the header for the rest of the viewport's height and hold the outline navigator, which scrolls on its own, over the outbox, which stays at the rail's foot. The single-question board SHALL have no rail (FR-2, FR-24).

#### Scenario: Sections at the viewport floor
- **WHEN** a board of nine questions in three areas opens with sections at 1280×800
- **THEN** the header shows three rows, the rail is 256 px wide with the outline above the outbox, nothing on the page is fixed or sticky at the viewport's bottom, and no header row overflows its width

#### Scenario: One question per view
- **WHEN** the same board opens in one question per view
- **THEN** the rail shows the outline and the outbox beside the question shown

#### Scenario: Comfortable, in Italian
- **WHEN** an it-IT board of nine questions is in "Tutte insieme" with three answers ready and the user picks "Comoda" at 1280×800
- **THEN** no label of the outbox, its ledger or its delivery switch is clipped, and no header row overflows its width

#### Scenario: The outline scrolls, the outbox stays
- **WHEN** a board of forty questions opens at 1280×800 and the user scrolls the outline to its end
- **THEN** the outbox is still at the rail's foot, wholly in view

### Requirement: The ask row
The header's second row SHALL show the ask's title, its ID, the ask pill, the agent pill, the postponed warning while one is due, then the tools "Snapshot", "Keys", "Theme" and "Settings", the last three as icons named by those labels. The title SHALL give up width first, ending in an ellipsis with the full text on hover and focus. "Theme" SHALL open a popover holding the Theme and Density controls, which act as the quick toggles do (FR-24, FR-26, FR-35, AD-8).

#### Scenario: A crowded row
- **WHEN** at 1280×800 a board with a 120-character title has two postponed questions and the ask pill reads "Partly answered 5/9"
- **THEN** the title ends in an ellipsis, the postponed warning and both pills read in full, and the four tools show

#### Scenario: The Theme popover
- **WHEN** the user activates "Theme" and picks Dark, then Comfortable
- **THEN** the board turns dark, then comfortable, at once, and both are written as user-level settings, as from the quick toggles

#### Scenario: The ask pill's name
- **WHEN** the ask pill reads "Answered" on an en-US board, and "Con risposta" on an it-IT one
- **THEN** its accessible name is "Ask: Answered", and "Richiesta: Con risposta"

#### Scenario: Agent text in the row
- **WHEN** the ask's title holds U+202E and its ID is 40 characters long
- **THEN** both render as text, isolated from the row's order, and the row keeps its height

### Requirement: The progress strip
On a board of two or more questions that has not ended, the header's third row SHALL show the progress strip after its label: one segment per question in board order, grouped by area, showing its state of the answer state ladder as an icon, named by its short number, chip and state, with the new-question mark. The segment of the question in view SHALL be marked current. Activating a segment SHALL jump to its question as the outline does (FR-2, NFR-12).

#### Scenario: A segment's state and name
- **WHEN** in "All together" the user confirms question Q1, whose chip is "Database"
- **THEN** Q1's segment shows the ready icon, its accessible name is "Q1 Database: Ready, not sent", and the outline and the card read the same state

#### Scenario: A jump from the strip
- **WHEN** with sections the user activates question Q7's segment
- **THEN** Q7's heading has focus, lies wholly between the sticky bars, and Q7's segment and outline entry are marked current

#### Scenario: Into another tab
- **WHEN** with tabs the user activates the segment of a question in a hidden tab
- **THEN** that tab becomes active and the question's heading has focus

#### Scenario: One Tab stop
- **WHEN** the user tabs into the strip, presses the right arrow twice, then Enter
- **THEN** focus first lands on the current segment, the arrows move focus two segments on without moving the board, and Enter jumps to that segment's question

#### Scenario: Forty questions
- **WHEN** a board of forty questions opens at 1280×800 and the question in view is the last one
- **THEN** the progress row does not overflow, the strip scrolls within it, and the current segment is wholly visible

### Requirement: The outbox
The outbox SHALL hold, under the label "Sending answers", the delivery switch, its helper text and the ledger, then in "All together" "Send {count} answers" and one line under it: how many answers are ready and that nothing has been sent, or "All ready: nothing has been sent yet." when nothing is left to do, or, in place of either, how many updates need a choice, which jumps to the first. On a closed, discarded or moved board its controls SHALL be disabled (FR-22, NFR-10).

#### Scenario: One by one
- **WHEN** a board of nine questions is in "One by one"
- **THEN** the outbox shows the switch, "Each answer goes to the agent as soon as you send it." and the ledger, and no Send button

#### Scenario: Three ready
- **WHEN** in "All together" the user confirms three questions while others are to do
- **THEN** the outbox shows "Send 3 answers" and under it "3 answers ready: nothing has been sent yet.", and "3 risposte pronte: niente è stato ancora inviato." in it-IT

#### Scenario: Updates that need a choice
- **WHEN** an agent-change notice sits on a question with a ready answer
- **THEN** Send is disabled, the line reads "1 update needs a choice" in place of the ready line, and activating it moves focus to that question's heading

#### Scenario: A closed board
- **WHEN** the agent closes the ask
- **THEN** the outbox still shows the ledger's counts, and its switch and Send take no input

### Requirement: The outbox ledger
The ledger SHALL show four counts: Drafts, the questions in draft; Ready, the answers held for the send, a dash in "One by one" while none is held; Sent, every question whose answer or decline the board has sent, delivered ones included; Delivered, those whose receipt says the agent received it. Sent and Delivered SHALL equal the completion panel's counts at every moment, and no count SHALL come from the ask pill or the ask state (NFR-10, AD-3, AD-10).

#### Scenario: The agent has not collected
- **WHEN** every question of nine is sent and the agent has collected two of the answers
- **THEN** the ask pill reads "Answered", the ledger reads Sent 9 and Delivered 2, seven cards read "Sent", and the completion panel reads "Sent: 9. Delivered to the agent: 2."

#### Scenario: Ready is not sent
- **WHEN** in "All together" three answers are ready and nothing was sent
- **THEN** the ledger reads Ready 3 and Sent 0, and the ask pill does not move

#### Scenario: A dash in One by one
- **WHEN** a board is in "One by one" with nothing held
- **THEN** the Ready cell shows a dash, whose description says it is not used in "One by one"

#### Scenario: A decline
- **WHEN** in "One by one" the user declines a question and the board page reports it sent
- **THEN** the ledger's Sent rises by one, and its Delivered rises once the receipt says the agent received it

### Requirement: Short question numbers
On a board of two or more questions each question SHALL carry a short number, "Q{n}" in en-US and "D{n}" in it-IT, on its card, its outline entry, its strip segment and the footer that names it. Numbers SHALL follow board order when the board first shows; a question the agent adds SHALL take the next number never given; no number SHALL change or be given again for the ask's life, across reloads and takeovers. A Snapshot shows none (AD-20).

#### Scenario: The agent adds a question
- **WHEN** a board shows Q1 to Q9 and the agent adds "Staging" after Q6
- **THEN** "Staging" reads Q10 and every other question keeps its number

#### Scenario: The agent removes a question
- **WHEN** the agent removes Q3, "Queue"
- **THEN** Q4 to Q9 keep their numbers, and while the page stays open the outline shows "Q3 removed by the agent" where it was

#### Scenario: A reload keeps the numbers
- **WHEN** after that addition and removal the user reloads the board, and the agent had added "Rollback" while the tab was closing
- **THEN** every question shows the number it showed before, and "Rollback" reads Q11

#### Scenario: The footer names the number
- **WHEN** with "Stay here" the user sends Q1 while Q2, "Cache", is to do
- **THEN** Q1's footer reads "Sent · Next: Cache Q2"

#### Scenario: No numbers on one question or in a Snapshot
- **WHEN** a single-question board opens, and a Snapshot of a nine-question board is opened
- **THEN** neither shows a short number

### Requirement: The question's state on its card
Each question card SHALL show its state of the answer state ladder as a badge with icon and label in the card's head, after its short number and chip and before "More", and as a stripe on its left edge in the state's colour: dashed for Draft, Not sent yet and Sent, solid for Ready not sent, Delivered to the agent and Declined, dotted for Postponed, the card's border for To do. The stripe SHALL never be the state's only sign (NFR-12, WCAG 2.2 SC 1.4.1).

#### Scenario: Sent, then delivered
- **WHEN** in "One by one" the user sends Q1, and the agent later collects it
- **THEN** Q1's badge reads "Sent" with a dashed stripe, then "Delivered to the agent" with a solid one

#### Scenario: Every state named
- **WHEN** a board holds a question in each state of the ladder
- **THEN** each card's badge names its state in text beside its icon, in the ask's language

### Requirement: The answered look and Edit
A question that is ready, sent, delivered or declined, and is not being revised, SHALL show the answered look: the chosen options marked, the others subdued, a line naming the answer, and "Edit" in place of the primary and "Later". On a ready answer "Edit" SHALL make it not ready; on any other, it SHALL move focus to the chosen option, or the first control, and send nothing. Any edit of the card SHALL start a revision as Revising an answer says (FR-22).

#### Scenario: Edit on a sent answer
- **WHEN** the user activates "Edit" on Q1, sent with "PostgreSQL"
- **THEN** focus is on the option "PostgreSQL", nothing is sent, and Q1 still reads "Sent"

#### Scenario: An edit starts a revision
- **WHEN** the user selects "SQLite" on Q1, sent with "PostgreSQL"
- **THEN** Q1 reads "Draft" with "PostgreSQL" and its receipt still shown, and its primary reads "Send the change"

#### Scenario: The answer's line
- **WHEN** Q1 is sent with "PostgreSQL" on an it-IT board
- **THEN** its card reads "Risposta: PostgreSQL" and shows "Modifica"

### Requirement: A blocked primary with nothing chosen
A question with options whose primary is blocked because nothing is chosen and no note is written SHALL show "Choose an option" beside the primary, as its description, in the ask's language (NFR-12, WCAG 2.2 SC 3.3.2).

#### Scenario: Nothing chosen
- **WHEN** a question with three options and no selection opens on an it-IT board
- **THEN** its disabled primary reads "Invia risposta" with "Scegli un'opzione" beside it, which is the button's description

#### Scenario: A note alone
- **WHEN** the user writes a note on that question and chooses nothing
- **THEN** the reason is gone and the primary reads "Send the note"

### Requirement: The feedback tray
The board SHALL show a Snapshot's outcome, a prefill's result with "Undo", and the questions the agent added with "Go" in a tray at the top right of the content. A message SHALL stay until its close control, its own end or a newer message of its kind, never on a timer. The tray SHALL never take focus on its own and SHALL not show in an opened Snapshot (FR-3, FR-26, NFR-12; WCAG 2.2 SC 2.2.1).

#### Scenario: The agent adds a question
- **WHEN** the agent adds "Retention" while focus is in another card
- **THEN** the tray reads "The agent added 1 question: Retention." with "Go", focus does not move, and "Go" reveals and focuses that question's heading

#### Scenario: The message ends when the question is seen
- **WHEN** the user scrolls "Retention" into view without activating "Go"
- **THEN** its message leaves the tray

#### Scenario: No timer
- **WHEN** a Snapshot's outcome has shown for 60 seconds
- **THEN** it still shows, and its close control removes it

### Requirement: Key caps on the board's main controls
The header's "Next to do" and each question's primary button SHALL show their keys in effect as key caps inside the button, hidden from assistive technology, which reads `aria-keyshortcuts`; a control whose action the user's keys leave without a key SHALL show none (NFR-12).

#### Scenario: The default keys on macOS
- **WHEN** a board opens on macOS with the default keys
- **THEN** "Next to do" shows the cap N and the primary shows ⌘ and ↩

#### Scenario: The user's keys
- **WHEN** the user file gives next open `j` and takes the answer key away
- **THEN** "Next to do" shows the cap J and the primary shows no cap

### Requirement: What the ask pill says
The ask pill SHALL show what the user has answered on the board, as AD-10 defines the ask state: "Partly answered n/m", or "answered, 1 postponed". It SHALL use no word, icon or count of delivery: what the agent has received SHALL show only in the receipts, the outbox ledger and the completion panel (FR-24, AD-3, AD-10).

#### Scenario: Partly answered before the agent collects
- **WHEN** in "One by one" the user sends two questions of nine and the agent has collected none
- **THEN** the ask pill reads "Partly answered 2/9", and both receipts read "Sent"

#### Scenario: Answered before the agent collects
- **WHEN** in "One by one" the user sends every question and the agent has collected none
- **THEN** the ask pill reads "Answered" and uses no word, icon or count of delivery, while every receipt reads "Sent" and the ledger's Delivered reads 0

### Requirement: Tab clears the sticky bars
A control the user reaches with Tab SHALL end wholly below the sticky bars that Focus moves clear the sticky bars names, the feedback tray included while it holds a message, and above the viewport's bottom (WCAG 2.2 SC 2.4.11).

#### Scenario: Tabbing to a control under the header
- **WHEN** a card's "Later" sits under the header after a scroll and the user reaches it with Tab
- **THEN** "Later" lies wholly below the header's bottom edge, and has focus

## MODIFIED Requirements

### Requirement: Single-question board
An ask of one question SHALL show as EXPERIENCE's single-question board, whatever presentation and delivery it requests: the tab labelled "<title> · AskBoard", the context header without its progress row, and one question card at the content's full width. It SHALL show no left rail, outline navigator, outbox, short number, count to do, next-to-do jump, "Prefill recommended", delivery switch, Send, completion panel or "Continue" footer, and SHALL work as in "One by one" (FR-22).

#### Scenario: The plain-choice board
- **WHEN** the plain-choice ask's board opens
- **THEN** the tab reads "Which database should the order service use? · AskBoard", the header shows "Waiting", and the card shows the chip "Database" and three options, each with its description, then the open prompt, "Later", "More" and "Send answer"

#### Scenario: The frame
- **WHEN** the plain-choice ask's board opens at 1280×800
- **THEN** the header shows two rows with "Snapshot" in the second, there is no rail, the card spans the content column, and nothing on the page is fixed or sticky at the viewport's bottom

#### Scenario: Submitted delivery requested for one question
- **WHEN** an ask of one question requests `delivery: "submitted"`
- **THEN** the board shows no delivery switch and no Send, and "Send answer" sends at once

#### Scenario: After the send
- **WHEN** the user sends the only question
- **THEN** the card reads "Sent" in the answered look, focus is on its heading, and no completion panel or "Continue" shows

### Requirement: One question per view
In one question per view, the board SHALL show one question at a time, with its area's title, beside the left rail, under the question navigator: "Question n of m", and Previous and Next, which stop at the ends. The navigator SHALL hold no next-to-do jump and no state markers: the header's jump and progress strip are the only ones. Navigating SHALL move focus to the question's heading, and answering SHALL change the question shown only as After an answer says (FR-2).

#### Scenario: Moving to the next open question
- **WHEN** the user is on question 4 of 5 and questions 2 and 5 are to do
- **THEN** the header's "Next to do" shows question 5, then question 2

#### Scenario: One next-open control
- **WHEN** a board of five questions opens in one question per view
- **THEN** the header shows the progress strip, the count to do and one next-to-do control, the question navigator shows "Question 1 of 5", Previous and Next, and no next-to-do control or state markers, and the rail shows the outline and the outbox

#### Scenario: Stay here keeps the question
- **WHEN** with "Stay here" the user sends the question shown while another is to do
- **THEN** the same question is shown, and focus is on its "Continue"

#### Scenario: Sending all together from the rail
- **WHEN** in one question per view and "All together" the user confirms two questions and activates the outbox's "Send 2 answers"
- **THEN** one command carries both answers, and the ledger's Sent reads 2

### Requirement: Outline navigator
On a board of two or more questions, in every presentation, the left rail SHALL show the outline navigator: areas and questions, each question with its short number and its state of the answer state ladder, the new-question and unread-reply marks, and a jump to the question on a click or keypress, which activates its tab, or shows it in one question per view. It SHALL mark the question in view as current, and no other entry.

#### Scenario: Jumping into another tab
- **WHEN** the user activates a question of a hidden tab in the outline
- **THEN** that tab becomes active and the question's heading takes focus

#### Scenario: The mark follows scrolling
- **WHEN** with sections the user jumps to question 2 with the outline, then, with focus on no card, scrolls until question 7's card crosses the reading line
- **THEN** question 7's outline entry is marked current, and no other entry is

#### Scenario: The entry's state
- **WHEN** in "All together" the user confirms question 2
- **THEN** question 2's outline entry reads "Ready, not sent"

#### Scenario: In one question per view
- **WHEN** in one question per view, with question 1 shown, the user activates question 4's outline entry
- **THEN** question 4 is shown, its heading has focus, and its entry is marked current

### Requirement: Counts and the next-open jump
On a board of two or more questions, in every presentation, the header's progress row SHALL show the count to do (to do, first drafts and postponed, the last named apart; never a revision) and "Next to do", absent when nothing is to do, which reaches unseen questions the agent added first, then those to do or in a first draft after the question in view, then the postponed, each in board order, wrapping. The ask pill follows What the ask pill says (FR-24).

#### Scenario: A ready answer does not move the pill
- **WHEN** in submitted delivery the user marks two of three questions ready
- **THEN** the count to do drops to 1, and the ask pill still shows "Waiting" until Submit

#### Scenario: Next open goes on from where the user is
- **WHEN** with sections the user jumps to question 2 with the outline, then scrolls to question 5 and answers it, and questions 3, 6 and 7 are to do
- **THEN** "Next to do" reaches question 6

#### Scenario: A question the agent added comes first
- **WHEN** the agent has added question 9, not yet seen, and the question in view is question 5
- **THEN** "Next to do" reaches question 9 first

#### Scenario: Postponed questions last
- **WHEN** the question in view is question 2, question 3 is postponed and question 6 is to do
- **THEN** "Next to do" reaches question 6, then question 3

#### Scenario: The count names the postponed
- **WHEN** four questions are to do, one of them postponed
- **THEN** the progress row reads "4 to do (1 postponed)", and "4 da fare (di cui 1 rimandata)" in it-IT

#### Scenario: Nothing left to do
- **WHEN** no question is to do, in draft or postponed
- **THEN** the progress row shows "0 to do" and no "Next to do"

### Requirement: Delivery mode
A board of two or more questions SHALL start in the delivery mode the ask requests, "One by one" when it requests none, and SHALL let the user switch to "All together" and back. There "Confirm" SHALL mark the question ready, and "Edit" or an edit SHALL make it not ready (FR-22). Under the switch the outbox SHALL show the mode's helper text in the ask's language: "Each answer goes to the agent as soon as you send it." or "Answers stay here until you press "Send answers"." (FR-34).

#### Scenario: Editing a ready question
- **WHEN** the user marks a question ready, then changes its choice
- **THEN** the question is no longer ready and Submit would not send it

#### Scenario: The submitted helper text
- **WHEN** a board of two or more questions is in "All together"
- **THEN** the outbox reads, under the switch, "Answers stay here until you press "Send answers"." in en-US, and "Le risposte restano qui finché non premi «Invia le risposte»." in it-IT

#### Scenario: Switching mode changes the helper text
- **WHEN** the user switches from "One by one" to "All together", then back
- **THEN** the helper text changes to the submitted one, then back to "Each answer goes to the agent as soon as you send it."

#### Scenario: The mode names
- **WHEN** an it-IT board of two or more questions opens
- **THEN** the outbox reads "Invio delle risposte" with "Una alla volta" and "Tutte insieme"

### Requirement: Submit
In "All together", the outbox's "Send {count} answers", {count} being the ready answers, SHALL send every ready answer, held postpone, decline, undo and note as one command in the order the user produced them, and SHALL read "Send" when no answer is ready. It SHALL be disabled while nothing is held, while the connection is lost, and while an agent-change notice sits on a question with held work. It SHALL be absent, not disabled, in "One by one" (AD-20, FR-22).

#### Scenario: Submitting a postpone and two answers
- **WHEN** the user marks two answers ready, postpones a third question and presses "Send 2 answers"
- **THEN** one command carrying the three acts in that order reaches `board-host`, and the receipts show "Sent"

#### Scenario: Submit under a pending agent change
- **WHEN** an agent-change notice sits on a question with a ready answer
- **THEN** Submit is disabled, and the outbox says, in place of its line of ready answers, how many updates need a choice, and jumps to the first

#### Scenario: Absent in One by one
- **WHEN** a board of two or more questions is in "One by one"
- **THEN** the outbox holds no Send button, enabled or disabled

#### Scenario: Prefills are not sent
- **WHEN** in "All together" the user prefills three questions, confirms one of them and presses "Send 1 answer"
- **THEN** only the confirmed answer is sent, and the other two keep their selections as drafts

### Requirement: Undo of a prefill
After "Prefill recommended", the feedback tray SHALL show how many questions it filled and that nothing was sent, with "Undo", which takes focus; "Undo" SHALL clear each selection the prefill made that is still unchanged, then focus "Prefill recommended", and the message SHALL leave after the user's next edit or act on the board (FR-3, AD-10).

#### Scenario: Undo restores the drafts
- **WHEN** the user prefills 4 questions, then activates "Undo"
- **THEN** the 4 questions hold no selection, nothing was sent, the region reads "Prefill undone.", and focus is on "Prefill recommended (4)"

#### Scenario: An edit ends the undo
- **WHEN** the user prefills 4 questions and then changes the choice of one of them
- **THEN** "Undo" is gone and the 4 selections stay as they are

### Requirement: Focus moves clear the sticky bars
Each move of focus to a question's heading, or to a field to fix, SHALL first scroll the view so that the element lies wholly between the sticky bars (the context header, the tab strip with tabs, the feedback tray) and the viewport's bottom, or starts just under them when taller than that space. This holds for the next-to-do, outline, strip, unread-reply, agent-change and "Go" jumps, the question navigator, tab activation, After an answer and Focus after Answer and Submit (WCAG 2.2 SC 2.4.11).

#### Scenario: Next open to a heading under the bottom bar
- **WHEN** at 1280×800 with sections the next question to do has its heading's bottom edge 16 px above the viewport's bottom, where the bottom action bar stood, and the user activates the header's "Next to do"
- **THEN** the view does not scroll, nothing covers the heading, and it has focus

#### Scenario: Next open to a heading below the viewport
- **WHEN** at 1280×800 with sections the next question to do has its heading below the viewport and the user activates the header's "Next to do"
- **THEN** the heading lies wholly between the header's bottom edge and the viewport's bottom edge, and has focus

#### Scenario: A jump that wraps upward
- **WHEN** the next-to-do jump wraps to a question whose heading is above the viewport
- **THEN** the heading lies wholly below the header's bottom edge and above the viewport's bottom edge

#### Scenario: An outline jump
- **WHEN** with sections, and again with tabs, the user activates the outline entry of a question whose heading is out of view
- **THEN** that heading lies wholly between the header, or the tab strip, and the viewport's bottom edge, and has focus

#### Scenario: A jump into another tab
- **WHEN** with tabs the next-to-do jump activates another tab
- **THEN** the target question's heading lies wholly between the tab strip and the viewport's bottom edge, and has focus

#### Scenario: A message in the tray
- **WHEN** a message shows in the feedback tray and the user jumps to a question whose heading would sit beside it
- **THEN** the heading lies wholly below the tray's bottom edge, and has focus

### Requirement: Status messages for the answering flow
The board SHALL hold one polite status region outside the cards, present from the first render, which announces each result of the answering flow as text in the ask's language without moving focus. A message SHALL never say more than is true: sent is not delivered, ready is not sent, and "sent" is said only once the board page reports the command sent (NFR-10, AD-10; WCAG 2.2 SC 4.1.3). The agent pill SHALL not be a live region.

#### Scenario: An answer sent
- **WHEN** in immediate delivery the user answers "PostgreSQL" and the board page reports the command sent
- **THEN** the region's text begins "Answer sent: PostgreSQL.", followed by the next question when the board moves on, and no message says the answer was delivered to the agent

#### Scenario: An answer that is not sent yet
- **WHEN** the user answers while the connection is lost
- **THEN** the region does not read "Answer sent"

#### Scenario: An answer with no option
- **WHEN** in immediate delivery the user answers a question that holds only a widget, and the board page reports it sent
- **THEN** the region's text begins "Answer sent."

#### Scenario: A note alone
- **WHEN** in immediate delivery the user sends only a note, and the board page reports it sent
- **THEN** the region reads "Note sent; the question is still to do."

#### Scenario: An answer marked ready
- **WHEN** in submitted delivery one answer is ready and the user marks a second one ready
- **THEN** the region's text begins "Answer ready, not sent. 2 ready."

#### Scenario: A note alone held
- **WHEN** in submitted delivery the user activates "Confirm" on a question that holds only a note
- **THEN** the note is held, and the region does not read "Answer ready, not sent"

#### Scenario: Submit
- **WHEN** the user submits two ready answers and a postpone, and the board page reports the command sent
- **THEN** the region's text begins "2 answers sent."

#### Scenario: Select recommended
- **WHEN** "Prefill recommended" selects the recommended option on 3 questions
- **THEN** the region reads "3 questions prefilled. Nothing was sent."

#### Scenario: A question the agent adds
- **WHEN** the agent adds the question "Retention" while focus is in another card
- **THEN** the region reads "The agent added 1 question: Retention.", and focus does not move

#### Scenario: The question in view removed
- **WHEN** in one question per view the agent deletes the question in view, "Queue"
- **THEN** the region reads "Question removed by the agent: Queue."

#### Scenario: The agent pill
- **WHEN** the agent pill changes to "Agent: Working", and later to "Agent: Waiting for your answer"
- **THEN** the first change is not announced, and the region reads "Agent: Waiting for your answer" after the second

#### Scenario: In Italian
- **WHEN** the ask's language is it-IT and an answer "PostgreSQL" is reported sent
- **THEN** the region's text begins "Risposta inviata: PostgreSQL."

### Requirement: The Snapshot control
The header's tools SHALL offer "Snapshot" on every board, the single-question board included, while the ask is open or closed; it SHALL be disabled while the connection is lost and absent once the ask is discarded. Its feedback SHALL show in the feedback tray: the saved file's path, or the failure with the Snapshot folder's path, or, when the session has no project root, a failure naming `CLAUDE_PROJECT_DIR`, or, for `internal-error`, that no Snapshot was taken (FR-26, AD-12).

#### Scenario: Taking a Snapshot from a single-question board
- **WHEN** the user presses "Snapshot" on the golden single-question board
- **THEN** the feedback tray shows the saved file's path, and the file is in the Snapshot folder

#### Scenario: The connection is lost
- **WHEN** the board shows "Connection lost, retrying"
- **THEN** "Snapshot" is disabled, and no request leaves the page

### Requirement: The Snapshot view's chrome
An opened Snapshot SHALL start with the line "Snapshot · taken <when> by <whom> · read-only", noting unsent work when the data records it; it SHALL hide Answer, Postpone, More, "Ask a follow-up", Settings, "Snapshot", "Prefill recommended", the outbox, the feedback tray and the agent pill, and keep the ask state pill, delivery receipts, the outline, the progress strip and the "Theme" control with Theme and density, each shown once (EXPERIENCE Snapshots).

#### Scenario: The agent's Snapshot
- **WHEN** the agent's Snapshot of an answered ask is opened
- **THEN** the top line says it was taken by the agent, the header shows "answered" and no agent state, and no answer control is shown

#### Scenario: One toolbar
- **WHEN** a Snapshot is opened from `file://`
- **THEN** the header shows one "Theme" control, whose popover holds one "Theme" group and one "Compact | Comfortable" group in the ask's language, and neither "Settings" nor "Snapshot"

#### Scenario: No outbox
- **WHEN** a Snapshot of a nine-question board in "All together" is opened
- **THEN** the rail shows the outline and no outbox, and nothing on the page offers a send

### Requirement: Leave-page prompt
The board page SHALL arm the browser's leave-page prompt while the draft holds unsent work, work too large to keep across a reload included, or postponed questions are open, and the header's ask row SHALL then show "You have 1 postponed question: closing loses this ask", with the count, after the agent pill and without changing the row's height (FR-25).

#### Scenario: Closing with a postponed question
- **WHEN** a question is postponed and the user closes the tab
- **THEN** the browser's prompt to leave the page appears first

#### Scenario: The warning's place
- **WHEN** on a nine-question board, and again on a single-question board, the user postpones a question
- **THEN** the ask row shows the warning after the agent pill, in Italian "Hai 1 domanda rimandata: chiudendo perdi questa richiesta", and no row of the header changes height

#### Scenario: Closing with work too large to keep
- **WHEN** the only unsent work is a question's work left out of the mirrored record and the user closes the tab
- **THEN** the browser's prompt to leave the page appears first

#### Scenario: Taken over with work too large to keep
- **WHEN** another tab takes the board over while this tab's draft holds a question's work left out of the mirrored record, and the user closes this tab
- **THEN** the browser's prompt to leave the page appears first, since the takeover handed over only the mirrored record

### Requirement: Draft mirror and restore
The board page SHALL mirror the draft record to `board-host` after each change and when the page is hidden, and restore it on reconnect, reload and takeover, with the delivery mode, the question in view and the short question numbers. Work restored for a question whose `rev` changed meanwhile SHALL raise the agent-change notice. The short numbers SHALL not count as unsent work (AD-20, FR-25).

#### Scenario: A reload keeps unsent work
- **WHEN** the user has a ready answer and a note in submitted delivery and reloads the tab
- **THEN** the board comes back in submitted delivery with the ready answer and the note, and nothing was sent

#### Scenario: Numbers alone are not unsent work
- **WHEN** the board holds nothing unsent but its short numbers, and the user closes the tab
- **THEN** no leave-page prompt appears, and "Copy my unsent work" has nothing to copy
