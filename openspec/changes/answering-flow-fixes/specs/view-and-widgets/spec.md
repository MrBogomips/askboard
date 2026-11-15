## ADDED Requirements

### Requirement: Focus after Answer and Submit
When "Answer" or "Accept recommended" sends at once (immediate delivery, the single-question board), or a confirmed revision does, focus SHALL move to the question's heading; when Submit sends, to the heading of the question in view. In submitted delivery "Answer" SHALL keep focus. The move SHALL happen when the act is taken or its confirmation closes, never when its command settles, and focus SHALL never fall to the page (WCAG 2.2 SC 2.4.3; NFR-12).

#### Scenario: Answer in sections
- **WHEN** in immediate delivery with sections the user selects an option of question 1 and activates "Answer" with the keyboard
- **THEN** focus is on question 1's heading, not on the page

#### Scenario: Answer in tabs and in one question per view
- **WHEN** in immediate delivery with tabs, and again in one question per view, the user answers the question shown with the keyboard
- **THEN** focus is on that question's heading, and one question per view still shows the same question

#### Scenario: The last open question
- **WHEN** the user answers the last open question of the board
- **THEN** focus is on that question's heading

#### Scenario: Accept recommended
- **WHEN** in immediate delivery the user activates "Accept recommended" on a question
- **THEN** the answer is sent and focus is on the question's heading

#### Scenario: A confirmed revision
- **WHEN** the agent has received a verdict, the user changes it, activates "Answer" and confirms in the dialog
- **THEN** focus is on the question's heading once the dialog has closed

#### Scenario: Submit
- **WHEN** in submitted delivery two answers are ready and the user activates Submit
- **THEN** focus is on the heading of the question in view, not on the page

#### Scenario: Marking ready keeps focus
- **WHEN** in submitted delivery the user activates "Answer" on a question with a choice
- **THEN** the answer is ready and focus stays on "Answer"

#### Scenario: Focus the user moved meanwhile
- **WHEN** the user answers question 1 and moves focus into question 2's note field before question 1's receipt shows "sent"
- **THEN** focus is still in question 2's note field after the receipt shows "sent"

### Requirement: Focus moves clear the sticky bars
Each move of focus to a question's heading, or to a field to fix, SHALL first scroll the view so that the element lies wholly between the context header's bottom edge and the bottom action bar's top edge, or starts just under the header when it is taller than that space. This holds for the next-open, outline, unread-reply and agent-change jumps, the question navigator, tab activation and Focus after Answer and Submit (WCAG 2.2 SC 2.4.11).

#### Scenario: Next open to a heading under the bottom bar
- **WHEN** at 1280×800 with sections the next open question's heading sits under the bottom action bar and the user activates "Next open ↓"
- **THEN** the heading lies wholly between the header's bottom edge and the bar's top edge, and has focus

#### Scenario: A jump that wraps upward
- **WHEN** the next-open jump wraps to a question whose heading is above the viewport
- **THEN** the heading lies wholly below the header's bottom edge and above the bar's top edge

#### Scenario: An outline jump
- **WHEN** with sections, and again with tabs, the user activates the outline entry of a question whose heading is out of view
- **THEN** that heading lies wholly between the header and the bottom bar, and has focus

#### Scenario: A jump into another tab
- **WHEN** with tabs the next-open jump activates another tab
- **THEN** the target question's heading lies wholly between the header and the bottom bar, and has focus

### Requirement: The question in view
With sections or tabs, the question in view SHALL be the one whose card holds focus while that card shows between the sticky bars; else the one whose card crosses a reading line a third of the way down that space, or the last card above the line; at the end of the page, the last card shown. It SHALL follow scrolling and focus moves as well as jumps. A draft restored after a reload SHALL keep its question in view until the user scrolls or moves focus.

#### Scenario: Scrolling with focus outside the cards
- **WHEN** with sections and focus on no card the user scrolls until question 7's card crosses the reading line
- **THEN** question 7 is the question in view

#### Scenario: The card holding focus
- **WHEN** focus is in question 3's card and the card shows between the bars, while question 4's card crosses the reading line
- **THEN** question 3 is the question in view

#### Scenario: The end of the page
- **WHEN** the user scrolls to the end of the page and the last question's card shows, above the reading line
- **THEN** the last question is the question in view

#### Scenario: Another tab
- **WHEN** with tabs the user activates another tab
- **THEN** the question in view is a question of that tab, and follows scrolling within it

#### Scenario: After a reload
- **WHEN** a board reloads with question 5 as its draft's question in view, and the page opens at its top
- **THEN** question 5 stays the question in view until the user scrolls or moves focus

### Requirement: Status messages for the answering flow
The board SHALL hold one polite status region outside the cards, present from the first render, which announces each result of the answering flow as text in the ask's language without moving focus. A message SHALL never say more than is true: sent is not delivered, ready is not sent, and "sent" is said only once the board page reports the command sent (NFR-10, AD-10; WCAG 2.2 SC 4.1.3). The agent pill SHALL not be a live region.

#### Scenario: An answer sent
- **WHEN** in immediate delivery the user answers "PostgreSQL" and the board page reports the command sent
- **THEN** the region reads "Answer sent: PostgreSQL.", and no message says the answer was delivered to the agent

#### Scenario: An answer that is not sent yet
- **WHEN** the user answers while the connection is lost
- **THEN** the region does not read "Answer sent"

#### Scenario: An answer with no option
- **WHEN** in immediate delivery the user answers a question that holds only a widget, and the board page reports it sent
- **THEN** the region reads "Answer sent."

#### Scenario: A note alone
- **WHEN** in immediate delivery the user sends only a note, and the board page reports it sent
- **THEN** the region reads "Note sent; the question is still to do."

#### Scenario: An answer marked ready
- **WHEN** in submitted delivery one answer is ready and the user marks a second one ready
- **THEN** the region reads "Answer ready, not sent. 2 ready."

#### Scenario: Submit
- **WHEN** the user submits two ready answers and a postpone, and the board page reports the command sent
- **THEN** the region reads "2 answers sent."

#### Scenario: Select recommended
- **WHEN** "Select recommended" selects the recommended option on 3 questions
- **THEN** the region reads "3 questions prefilled. Nothing was sent."

#### Scenario: A question the agent adds
- **WHEN** the agent adds the question "Retention" while focus is in another card
- **THEN** the region reads "The agent added 1 question: Retention.", and focus does not move

#### Scenario: The question in view removed
- **WHEN** in one question per view the agent deletes the question in view
- **THEN** the region reads "Question removed by the agent"

#### Scenario: The agent pill
- **WHEN** the agent pill changes to "Agent: Working", and later to "Agent: Waiting for your answer"
- **THEN** the first change is not announced, and the region reads "Agent: Waiting for your answer" after the second

#### Scenario: In Italian
- **WHEN** the ask's language is it-IT and an answer "PostgreSQL" is reported sent
- **THEN** the region reads "Risposta inviata: PostgreSQL."

## MODIFIED Requirements

### Requirement: Counts and the next-open jump
On a board of two or more questions, in every presentation, the header SHALL show the open count (unanswered and postponed questions) and "Next open ↓", which reaches new questions first, then the open questions after the question in view in board order, wrapping to the start. The ask pill SHALL show only what the agent has received: "Partly answered n/m", or "answered, 1 postponed" (FR-24).

#### Scenario: A ready answer does not move the pill
- **WHEN** in submitted delivery the user marks two of three questions ready
- **THEN** the open count drops to 1, and the ask pill still shows "Waiting" until Submit

#### Scenario: Next open goes on from where the user is
- **WHEN** with sections the user jumps to question 2 with the outline, then scrolls to question 5 and answers it, and questions 3, 6 and 7 are open
- **THEN** "Next open ↓" reaches question 6

#### Scenario: A question the agent added comes first
- **WHEN** the agent has added question 9, not yet seen, and the question in view is question 5
- **THEN** "Next open ↓" reaches question 9 first

### Requirement: One question per view
In one question per view, the board SHALL show one question at a time, with its area's title, under the question navigator: "Question n of m", one state marker per question, and Previous and Next, which stop at the ends. The navigator SHALL hold no next-open jump: the header's is the only one (Counts and the next-open jump). Navigating SHALL move focus to the question's heading, and answering SHALL NOT advance (FR-2).

#### Scenario: Moving to the next open question
- **WHEN** the user is on question 4 of 5 and questions 2 and 5 are open
- **THEN** the header's "Next open ↓" shows question 5, then question 2

#### Scenario: One next-open control
- **WHEN** a board of five questions opens in one question per view
- **THEN** the header shows the open count and one next-open control, and the question navigator shows "Question 1 of 5", the markers, Previous and Next, and no next-open control

### Requirement: Outline navigator
With sections or tabs, the board SHALL show the outline navigator: areas and questions, each question with its state marker, the new-question and unread-reply marks, and a jump to the question on a click or keypress that activates its tab. It SHALL mark the question in view as current, and no other entry.

#### Scenario: Jumping into another tab
- **WHEN** the user activates a question of a hidden tab in the outline
- **THEN** that tab becomes active and the question's heading takes focus

#### Scenario: The mark follows scrolling
- **WHEN** with sections the user jumps to question 2 with the outline, then, with focus on no card, scrolls until question 7's card crosses the reading line
- **THEN** question 7's outline entry is marked current, and no other entry is

### Requirement: Delivery mode
A board of two or more questions SHALL start in the delivery mode the ask requests, immediate when it requests none, and SHALL let the user switch. In submitted delivery "Answer" SHALL mark the question ready, and an edit to a ready question SHALL make it not ready (FR-22). Beside the switch, the bottom action bar SHALL show the helper text of the mode in force, in the ask's language: in immediate delivery "Answers go to the agent as you give them.", in submitted delivery "Answers stay here until you press "<Submit's label>"." (FR-34).

#### Scenario: Editing a ready question
- **WHEN** the user marks a question ready, then changes its choice
- **THEN** the question is no longer ready and Submit would not send it

#### Scenario: The submitted helper text
- **WHEN** a board of two or more questions is in submitted delivery
- **THEN** the bar reads, after the switch, "Answers stay here until you press "Submit"." in en-US, and "Le risposte restano qui finché non premi «Invia le risposte»." in it-IT

#### Scenario: Switching mode changes the helper text
- **WHEN** the user switches from immediate to submitted delivery, then back
- **THEN** the helper text changes to the submitted one, then back to the immediate one

### Requirement: Answer names the field to fix
While "Answer" is disabled by a field, its description SHALL name the first such field in document order, by its label shown as text: "Correct {label} first." for an entry or a value that fails a check, "Complete {label} first." for an empty required field (EXPERIENCE, Voice and Tone). The description SHALL show as text beside the disabled "Answer", and activating it SHALL move focus to that field, first selecting the tab of a Tabs layout that holds the field.

#### Scenario: An empty required field
- **WHEN** a question's only blocking field is the empty required TextField "Ticket"
- **THEN** "Answer" is described "Complete Ticket first."

#### Scenario: The reason shows beside Answer
- **WHEN** the patterned TextField "Ticket" holds `ab-1234` and no other field blocks
- **THEN** "Correct Ticket first." shows beside the disabled "Answer" and is its accessible description

#### Scenario: The reason in Italian
- **WHEN** in it-IT the empty required TextField "Nome del servizio" comes first in document order, before a "Ticket" that fails its pattern
- **THEN** "Completa prima Nome del servizio." shows beside the disabled "Rispondi"

#### Scenario: The reason leads to the field
- **WHEN** the user activates the reason "Correct Ticket first."
- **THEN** focus is in the "Ticket" field, which lies wholly between the header and the bottom bar

#### Scenario: A field in a hidden tab
- **WHEN** the blocking field is in the second tab of a Tabs layout, the first tab is selected, and the user activates the reason
- **THEN** the second tab is selected and focus is in the field

#### Scenario: Every field passes
- **WHEN** the user corrects "Ticket" to `AB-1234` and no other field blocks
- **THEN** the reason is gone and "Answer" is enabled
