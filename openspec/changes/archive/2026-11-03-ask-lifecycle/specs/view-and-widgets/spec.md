# Spec Delta

## MODIFIED Requirements

### Requirement: Agent content as text
Every agent string on the board (title, area titles, question text, header chips, option labels, descriptions, previews and annotations, and follow-up replies) SHALL render as text, never as markup (AD-8, NFR-5).

#### Scenario: Markup in an option label
- **WHEN** an option's label is `<img src=x onerror=alert(1)>`
- **THEN** the board shows those characters as text, and no element is created from them

#### Scenario: Markup in a reply
- **WHEN** the agent replies to a follow-up with `<script>alert(1)</script>`
- **THEN** the thread shows those characters as text, and no script runs

### Requirement: Single-question board
An ask of one question SHALL show as EXPERIENCE's single-question board, whatever presentation and delivery it requests: the tab labelled "<title> · AskBoard", a header with the title and the ask state, and one question card. It SHALL show no outline navigator, open count, next-open jump, "Select recommended", delivery switch or Submit, and SHALL work as in immediate delivery (FR-22).

#### Scenario: The plain-choice board
- **WHEN** the plain-choice ask's board opens
- **THEN** the tab reads "Which database should the order service use? · AskBoard", the header shows "Waiting", and the card shows the chip "Database" and three options, each with its description, then the open prompt, Postpone, "More" and "Answer"

#### Scenario: Submitted delivery requested for one question
- **WHEN** an ask of one question requests `delivery: "submitted"`
- **THEN** the board shows no delivery switch and no Submit, and "Answer" sends at once

### Requirement: Nothing chosen for the user
Options SHALL start with nothing selected, a recommended one included. The arrow keys SHALL move focus only, Space or Enter SHALL select, and selecting SHALL only fill the draft. "Answer" SHALL stay disabled until the question has a choice, "Other…" text or a note (AD-10, NFR-10, FR-3).

#### Scenario: The board opens
- **WHEN** a board opens with a recommended option
- **THEN** no option is selected, the recommended one carries its badge, and "Answer" is disabled

#### Scenario: Moving with the arrow keys
- **WHEN** the user moves through the options with the arrow keys
- **THEN** focus moves, nothing is selected and nothing is sent

### Requirement: Answer sends at once
In immediate delivery, and on the single-question board, "Answer" SHALL send the question's whole answer at once, stamped with the time of the click: the chosen options, the "Other…" text, the option notes and the open prompt's text. The question SHALL then show as answered, and the ask state as `ask-core` reports it (FR-22).

#### Scenario: The user answers
- **WHEN** the user selects "PostgreSQL", writes a note and presses "Answer"
- **THEN** one command carrying the choice and the note reaches `board-host`, the question shows answered with its receipt at "sent", and the header shows "Answered"

### Requirement: Board banners
The board page SHALL show EXPERIENCE's board banners: "Connection lost, retrying" while it reconnects, with Submit disabled, resuming if the ask is still open; Closed and Discarded, locking the board read-only; with unsent work, "Your unsent work was not sent" and "Copy my unsent work"; and Board moved, with "Continue here" (AD-21, NFR-10, FR-6, FR-25).

#### Scenario: The session ends
- **WHEN** the session process exits while the board is open
- **THEN** the board shows the ask as discarded, stays readable and accepts no answer

#### Scenario: The token is refused on reconnect
- **WHEN** the board reconnects and its token is refused, as after the session process restarted
- **THEN** the board shows the ask as discarded

#### Scenario: A short drop
- **WHEN** the connection drops and returns while the ask is open
- **THEN** the board shows "Connection lost, retrying", then resumes in the ask's current state

#### Scenario: The agent closes with unsent work
- **WHEN** the agent closes the ask while the user has a note typed on a question
- **THEN** the board locks with the Closed banner, says "Your unsent work was not sent", and "Copy my unsent work" puts the note on the clipboard as text

### Requirement: Keyboard core
Every act SHALL work from the keyboard with a visible focus ring: options, "Other…", "Accept recommended", "Answer", the open prompt, Postpone, "More" with Explain and Decline, the composer and Send, the agent-change choices, the delivery switch, "Select recommended", Submit and the navigators. A newly opened board SHALL ignore keys until the user clicks or focuses inside it (NFR-12).

#### Scenario: Answering with the keyboard only
- **WHEN** the user focuses the board, tabs to the options, selects one with Space and activates "Answer" with Enter
- **THEN** the answer is sent as with the mouse

#### Scenario: Focus after Postpone and after a discard
- **WHEN** the user postpones a question, and later the ask is discarded
- **THEN** focus moves to the question's heading, then to the banner

## ADDED Requirements

### Requirement: Presentations
A board of two or more questions SHALL show its areas, or its questions as one group when the ask has none, in the presentation the ask requests: sections, tabs or one question per view, and sections when it requests none. Each area SHALL be a distinct part labelled with its title, and an area the agent has emptied SHALL be hidden (FR-2).

#### Scenario: Three areas as sections
- **WHEN** an ask of three areas without a presentation opens
- **THEN** the board shows three titled sections, one after another

#### Scenario: Tabs without areas
- **WHEN** an ask of four questions without areas requests tabs
- **THEN** the board shows them as one group, with no tab strip

### Requirement: Tabs
With tabs, the board SHALL show one tab per area, labelled with its title and its open count. The questions of hidden tabs SHALL stay mounted, so that they report ready.

#### Scenario: A question answered in another tab
- **WHEN** the user answers the last open question of the second area
- **THEN** that tab's label shows no open question, and the first tab's count is unchanged

### Requirement: One question per view
In one question per view, the board SHALL show one question at a time, with its area's title, under the question navigator: "Question n of m", one state marker per question, Previous and Next, which stop at the ends, and "Next open →", which wraps. Navigating SHALL move focus to the question's heading, and answering SHALL NOT advance (FR-2).

#### Scenario: Moving to the next open question
- **WHEN** the user is on question 4 of 5 and questions 2 and 5 are open
- **THEN** "Next open →" shows question 5, then question 2

### Requirement: Outline navigator
With sections or tabs, the board SHALL show the outline navigator: areas and questions, each question with its state marker, the new-question and unread-reply marks, and a jump to the question on a click or keypress that activates its tab.

#### Scenario: Jumping into another tab
- **WHEN** the user activates a question of a hidden tab in the outline
- **THEN** that tab becomes active and the question's heading takes focus

### Requirement: Counts and the next-open jump
On a board of two or more questions the header SHALL show the open count (unanswered and postponed questions) and "Next open ↓", which reaches new questions first, then open ones in board order. The ask pill SHALL show only what the agent has received: "Partly answered n/m", or "answered, 1 postponed" (FR-24).

#### Scenario: A ready answer does not move the pill
- **WHEN** in submitted delivery the user marks two of three questions ready
- **THEN** the open count drops to 1, and the ask pill still shows "Waiting" until Submit

### Requirement: Open prompt
Every question SHALL show its open prompt, "Note for the agent (optional)". Its text SHALL leave only with the question's answer or decline, or alone through "Answer", which sends it as a note and leaves the question open; never on typing or blur (FR-7, AD-20).

#### Scenario: A note without an answer
- **WHEN** the user writes only a note and presses "Answer"
- **THEN** a note is sent, and the question still counts as open

### Requirement: Other row
A question with `allowOther` SHALL show "Other…" as its last option, with its own text field, whose text is the answer's "Other…" text and stays apart from the open prompt. In a single choice, choosing "Other…" SHALL clear the selected option, and choosing an option SHALL clear "Other…" (FR-3).

#### Scenario: Answering with Other
- **WHEN** the user chooses "Other…", types "MariaDB" and presses "Answer"
- **THEN** the answer carries the "Other…" text "MariaDB" and no option label

### Requirement: Recommended option
The recommended option SHALL carry the "Recommended" badge and never start selected. "Accept recommended", shown only on a question with a recommendation, SHALL select it and act as "Answer" in one click (FR-3, AD-10).

#### Scenario: Accept recommended in immediate delivery
- **WHEN** the user presses "Accept recommended" on a question
- **THEN** its recommended option is selected and the answer is sent at once

### Requirement: Select recommended
On a board of two or more questions where one has a recommendation, "Select recommended" SHALL select the recommended option on every unanswered question that is not postponed, declined or ready and where the user has chosen nothing, and send nothing. Submit SHALL send the selections it made that the user left in place (FR-3, FR-22).

#### Scenario: A choice is never replaced
- **WHEN** the user has chosen an option on one question and presses "Select recommended"
- **THEN** that question keeps the user's choice, the others with a recommendation get it selected, and nothing is sent

### Requirement: Option previews
An option with a preview SHALL show "Show preview", which opens the preview below the option as plain text, one preview open at a time (FR-3; open question 9).

#### Scenario: Two previews
- **WHEN** the user opens one option's preview, then another's
- **THEN** only the second preview is open

### Requirement: Option annotations and notes
The agent's annotation SHALL show under its option, prefixed "Agent:". The user SHALL be able to add a note to any option with "+ Add your note to this option", and the notes SHALL return with the answer, by option label (FR-3, FR-18).

#### Scenario: A note on an option not chosen
- **WHEN** the user notes "too costly" on DynamoDB and answers PostgreSQL
- **THEN** the answer carries `choice: ["PostgreSQL"]` and the note under the label DynamoDB

### Requirement: Postpone
Postpone SHALL mark an open question postponed, sent at once in immediate delivery and held in submitted delivery, and pressed again SHALL undo it. It SHALL be disabled on an answered, declined or ready question, and a postponed question SHALL stay on the board, open (FR-4).

#### Scenario: Undoing a sent postpone
- **WHEN** in immediate delivery the user postpones a question, then undoes it
- **THEN** a postpone and then a reopen reach `board-host`, and the question is open

### Requirement: Decline
"More" SHALL hold Explain and Decline. Decline SHALL close its question as declined, with the open prompt's text as the reason, following the delivery mode, and SHALL be undone like Postpone. It SHALL be disabled on an answered or ready question (FR-4).

#### Scenario: Declining in submitted delivery
- **WHEN** in submitted delivery the user declines a question with a reason
- **THEN** the question shows declined, nothing is sent, and Submit sends the decline with its reason

### Requirement: Explain
Explain SHALL send the follow-up "Why are you asking, and what changes with each option?" on its question at once, in either delivery mode, and stay disabled until a reply to it arrives (FR-10).

#### Scenario: Explain in submitted delivery
- **WHEN** in submitted delivery the user chooses Explain
- **THEN** the follow-up is sent at once, and Explain is disabled until the agent replies

### Requirement: Follow-up thread
Each question SHALL have a follow-up thread, collapsed until opened, with its composer at the foot: Enter adds a line, and Ctrl+Enter, Cmd+Enter or "Send" sends at once in either delivery mode. Replies SHALL show in the thread under their follow-up with author and time, and SHALL never raise an agent-change notice (FR-10).

#### Scenario: Two rounds before answering
- **WHEN** the user sends a follow-up, reads the reply, sends another, reads its reply and answers
- **THEN** the thread holds both follow-ups and both replies in order, and the answer is sent

### Requirement: Unread replies
A reply that arrives while its question is out of view SHALL mark the question in the outline or question navigator and count in the header ("1 new reply"), whose activation jumps to it; the mark SHALL clear once the reply has been in view.

#### Scenario: A reply off-screen
- **WHEN** a reply arrives for a question scrolled out of view
- **THEN** the header shows "1 new reply", and activating it brings the reply into view and clears the mark

### Requirement: Delivery mode
A board of two or more questions SHALL start in the delivery mode the ask requests, immediate when it requests none, and SHALL let the user switch. In submitted delivery "Answer" SHALL mark the question ready, and an edit to a ready question SHALL make it not ready (FR-22).

#### Scenario: Editing a ready question
- **WHEN** the user marks a question ready, then changes its choice
- **THEN** the question is no longer ready and Submit would not send it

### Requirement: Submit
In submitted delivery, Submit SHALL send every ready answer, held postpone, decline and undo, and the selections of "Select recommended" left in place, as one command in the order the user produced them. It SHALL be disabled while nothing is held, while the connection is lost, and while an agent-change notice sits on a question with held work (AD-20).

#### Scenario: Submitting a postpone and two answers
- **WHEN** the user marks two answers ready, postpones a third question and presses Submit
- **THEN** one command carrying the three acts in that order reaches `board-host`, and the receipts show "sent"

#### Scenario: Submit under a pending agent change
- **WHEN** an agent-change notice sits on a question with a ready answer
- **THEN** Submit is disabled, and the bar says how many updates need a choice and jumps to the first

### Requirement: Mode-switch confirmation
Switching from submitted to immediate delivery while work is held SHALL ask the user to confirm in a modal dialog. Confirming SHALL send the held work as Submit does and switch; cancelling SHALL keep submitted delivery. It SHALL be blocked as Submit is (FR-22).

#### Scenario: Cancelling the switch
- **WHEN** the user switches to immediate with a ready answer held and cancels
- **THEN** nothing is sent and the board stays in submitted delivery

### Requirement: Revising an answer
While the ask is open, an answered or declined question SHALL stay editable: an edit fills the draft, and "Answer" sends the revision as the delivery mode says. The question SHALL show its latest answer with that answer's receipt (FR-22).

#### Scenario: Revising after delivery
- **WHEN** the agent has received "PostgreSQL" and the user selects "SQLite" and presses "Answer"
- **THEN** the revision is sent, the receipt shows "sent", then "delivered to the agent" once collected

### Requirement: Agent changes without unsent work
An agent's change to a question without unsent work SHALL show at once, without a reload or a notice. A question the agent adds SHALL carry "New" until it has been in view; a question it deletes SHALL disappear, and its unsent work with it, and in one question per view the navigator SHALL move on and say "Question removed by the agent" (FR-6; open question 8).

#### Scenario: An added question
- **WHEN** the agent adds a question while the user works on another
- **THEN** the new question appears with "New", the open count grows by one, and the next-open jump reaches it first

### Requirement: Agent-change notice
When the agent changes a question holding unsent work, the board SHALL keep that work and show, inline and without taking focus, "The agent updated this", the count of the user's changes, "Show the agent's change", "Reload, losing my work" and "Keep mine". The choice SHALL be sent at once, and an answer kept by "Keep mine" SHALL name the kept revision (FR-6).

#### Scenario: The user reloads the question
- **WHEN** the user chooses "Reload, losing my work"
- **THEN** a `reload` edit choice is sent, the question's draft is dropped, and the question shows its new revision

#### Scenario: The user keeps their work
- **WHEN** the user chooses "Keep mine" and answers
- **THEN** an `ignore` edit choice is sent first, then the answer naming the earlier revision

### Requirement: Reopened question
A question the agent reopens SHALL show "Reopened by the agent" and its new revision with nothing chosen, the previous answer read-only beside it, and "Start from my previous answer", which moves that answer into the draft (AD-10, AD-20).

#### Scenario: Starting from the previous answer
- **WHEN** the user presses "Start from my previous answer" on a reopened question
- **THEN** the previous choice is selected in the draft, and nothing is sent until "Answer"

### Requirement: Recorded answers on the board
A question the agent answered on the user's behalf SHALL show as answered, with the recorded answer, and SHALL count as answered (FR-6).

#### Scenario: A postponed question answered in the terminal
- **WHEN** the agent records an answer to a postponed question
- **THEN** the board shows the question answered with that answer, and the postponed count drops by one

### Requirement: Draft mirror and restore
The board page SHALL mirror the draft record to `board-host` after each change and when the page is hidden, and restore it on reconnect, reload and takeover, with the delivery mode and the question in view. Work restored for a question whose `rev` changed meanwhile SHALL raise the agent-change notice (AD-20, FR-25).

#### Scenario: A reload keeps unsent work
- **WHEN** the user has a ready answer and a note in submitted delivery and reloads the tab
- **THEN** the board comes back in submitted delivery with the ready answer and the note, and nothing was sent

### Requirement: Leave-page prompt
The board page SHALL arm the browser's leave-page prompt while the draft holds unsent work or postponed questions are open, and the bottom action bar SHALL then show "You have 1 postponed question: closing loses this ask", with the count (FR-25).

#### Scenario: Closing with a postponed question
- **WHEN** a question is postponed and the user closes the tab
- **THEN** the browser's prompt to leave the page appears first
