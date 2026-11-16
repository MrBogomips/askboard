## MODIFIED Requirements

### Requirement: Keyboard core
Every act SHALL work from the keyboard with a visible focus ring: options, "Other…", "Accept recommended", the primary and "Edit", the open prompt, "Later", "More" with Explain and Decline, the composer and Send, the agent-change choices, the delivery switch, "Prefill recommended" and "Undo", "Send {count} answers", "Continue", the completion panel's "Go to the first" and the navigators. A newly opened board SHALL ignore keys until the user clicks or focuses inside it (NFR-12).

#### Scenario: Answering with the keyboard only
- **WHEN** the user focuses the board, tabs to the options, selects one with Space and activates "Send answer" with Enter
- **THEN** the answer is sent as with the mouse

#### Scenario: Focus after Postpone and after a discard
- **WHEN** with "Stay here" the user postpones a question while another is to do, and later the ask is discarded
- **THEN** focus moves to the postponed card's "Continue", then to the banner

#### Scenario: Focus after Postpone with Go to the next
- **WHEN** with "Go to the next" the user postpones a question while another is to do
- **THEN** focus moves to the next question to do's heading

#### Scenario: Tab from a heading to its widget in each engine
- **WHEN** in Chromium, Firefox and WebKit the user clicks the heading of a question holding a Tree and presses Tab
- **THEN** focus enters the Tree before it reaches any control of another question

#### Scenario: Tab reaches the delivery switch in each engine
- **WHEN** in Chromium, Firefox and WebKit the user presses Tab repeatedly from the board's header
- **THEN** focus reaches the outbox's delivery switch before it comes back to the header

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

#### Scenario: A jump in each engine
- **WHEN** in Chromium, Firefox and WebKit, at 1280×800 with sections, the user activates "Next to do" towards a heading below the viewport, and again towards a heading in another tab
- **THEN** within one second the target heading has focus and lies wholly between the header, or the tab strip, and the viewport's bottom edge

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

#### Scenario: The first question removed before any navigation
- **WHEN** a board in one question per view has just opened on its first question, "Q1", and the agent deletes it before the user navigates
- **THEN** the region reads "Question removed by the agent: Q1." and the board shows the next question

### Requirement: Reduced motion
The board's own motion SHALL be the move to the next question, scrolled smoothly for at most 250 ms, and the arrival mark, an accent edge on the card that fades over 1.2 seconds. Under `prefers-reduced-motion: reduce` the scroll SHALL be instant, the arrival mark static for 1.2 seconds then removed, and no animation or transition of the view or the board page SHALL last longer than 0 ms (WCAG 2.2 SC 2.3.3).

#### Scenario: Reduced motion
- **WHEN** under `prefers-reduced-motion: reduce`, with "Go to the next", the user sends a question
- **THEN** the page reaches its new position at once, the arrival mark has no animation, and every element of the view and the board page computes an animation and transition duration of 0 ms

#### Scenario: No preference
- **WHEN** without a reduced-motion preference the user sends a question with "Go to the next"
- **THEN** the arrival mark shows on the next question's card and is gone after 1.2 seconds

#### Scenario: Reduced motion in each engine
- **WHEN** in Chromium, Firefox and WebKit, under `prefers-reduced-motion: reduce` with "Go to the next", the user sends a question whose next question to do is below the viewport
- **THEN** the next question's heading has focus and lies wholly between the header and the viewport's bottom edge at once, and its card shows the arrival mark
