## ADDED Requirements

### Requirement: The question's primary button
Each question SHALL have one primary button whose label names its act: "Send answer" in "One by one" and on the single-question board, "Send the note" there when only the open prompt holds text, "Send the change" there for a revision, and "Confirm" in "All together". On a ready answer "Edit" SHALL take the place of "Confirm" and make the answer not ready (FR-22, FR-34).

#### Scenario: One by one
- **WHEN** a board of two or more questions is in "One by one" and the user selects an option of question 1
- **THEN** question 1's primary reads "Send answer"

#### Scenario: All together, then Edit
- **WHEN** in "All together" the user selects an option of question 1 and activates "Confirm"
- **THEN** question 1 is ready, its primary reads "Edit", and activating "Edit" makes it not ready, the primary reading "Confirm" again with focus on it

#### Scenario: A note alone
- **WHEN** in "One by one" question 2 holds only open-prompt text
- **THEN** its primary reads "Send the note"

#### Scenario: In Italian
- **WHEN** an it-IT board is in "Tutte insieme" and the user selects an option
- **THEN** the primary reads "Conferma"

### Requirement: Act names in these requirements
In the requirements of this capability, "Answer" SHALL name the question's primary button, Submit the board's "Send {count} answers", Postpone "Later", "Select recommended" "Prefill recommended" and "Next open" the header's "Next to do", whatever their labels; immediate delivery SHALL be "One by one" and submitted delivery "All together". The labels are those of EXPERIENCE.md's Voice and Tone (FR-34).

#### Scenario: A requirement that presses Answer in submitted delivery
- **WHEN** a scenario says the user presses "Answer" on a question in submitted delivery
- **THEN** the act is "Confirm" on that question

### Requirement: The answer state ladder
Each question SHALL show one state, as a text label with a shape: To do, Draft, Ready not sent, Not sent yet, Sent, Delivered to the agent, Postponed or Declined, the same on its card, its outline entry and its question-navigator marker. A state SHALL show only when it is true: Sent once the board page has sent the act, Delivered to the agent once the receipt says the agent received it (AD-3, AD-10, NFR-10).

#### Scenario: Ready, not sent
- **WHEN** in "All together" the user confirms question 1
- **THEN** its card, its outline entry and its tab read "Ready, not sent", and the ask pill still reads "Waiting"

#### Scenario: Delivered to the agent
- **WHEN** the agent collects question 1's answer
- **THEN** its card and its outline entry read "Delivered to the agent"

#### Scenario: A draft
- **WHEN** the user selects an option of an unanswered question and does not confirm it
- **THEN** the question reads "Draft" and still counts as to do

#### Scenario: Not sent yet
- **WHEN** the user sends an answer while the connection is lost
- **THEN** the question reads "Not sent yet", and no surface reads "Sent" for it until the board page has sent it

#### Scenario: A revision
- **WHEN** the user edits an answered question whose receipt reads "Delivered to the agent"
- **THEN** its card reads "Draft" with the latest answer and its receipt still shown, and the question does not count as to do

### Requirement: The after-answer setting
Every board SHALL offer the presentation setting "After answering", "Go to the next" (the default) or "Stay here", in the settings panel. A change SHALL apply at once and be written as the user-level setting, and a value the project file sets SHALL win and show read-only (FR-35, AD-14).

#### Scenario: The default
- **WHEN** neither configuration file sets the after-answer key
- **THEN** the settings panel shows "After answering" at "Go to the next"

#### Scenario: Stay here reaches a later board
- **WHEN** the user picks "Stay here" in the settings panel and the agent then sends a new ask
- **THEN** the board applies it at once, and the new board opens with "Stay here"

#### Scenario: Set by the project
- **WHEN** the project file sets the after-answer key to "stay"
- **THEN** the panel's row is read-only with the project file and key, and the board behaves as "Stay here"

### Requirement: After an answer
On a board of two or more questions, when the primary sends or confirms an answer, or Postpone or Decline takes effect, and a question is still to do, the board SHALL move on to the next question to do: with "Go to the next" at once, revealing and focusing its heading with an arrival mark; with "Stay here" when the user activates "Continue" in a footer of the card, which names that question and takes focus (FR-2).

#### Scenario: Go to the next
- **WHEN** with "Go to the next", in "One by one" with sections, the user sends question 3 while question 4 is to do
- **THEN** question 4's heading has focus, lies wholly between the sticky bars, carries the arrival mark, and the status region names question 4

#### Scenario: Stay here
- **WHEN** with "Stay here" the user sends question 3 while question 4 is to do
- **THEN** focus is on "Continue" in question 3's footer, which names question 4, and the page has not scrolled; when the user activates "Continue", question 4's heading has focus

#### Scenario: One question per view
- **WHEN** with "Go to the next", in one question per view, the user sends the question shown while another is to do
- **THEN** the board shows the next question to do and its heading has focus

#### Scenario: Confirm in All together
- **WHEN** with "Go to the next", in "All together", the user confirms question 3 while question 4 is to do
- **THEN** question 4's heading has focus, and the status region reads "Answer ready, not sent. 1 ready." followed by question 4's title

#### Scenario: Later moves on
- **WHEN** with "Go to the next" the user activates "Later" on question 3 while question 4 is to do
- **THEN** question 3 reads "Postponed" and question 4's heading has focus

### Requirement: What never moves the board
The board SHALL not move on after a revision, a note sent or held alone, an undo of a postpone or decline, "Edit", a blocked primary, or an act whose confirmation the user cancelled; focus then SHALL go as Focus after Answer and Submit says. The footer of "Stay here" SHALL leave once the user activates "Continue", edits that question or acts on another (FR-2).

#### Scenario: A revision
- **WHEN** with "Go to the next" the user changes an answered question and sends the change
- **THEN** focus is on that question's heading and the board has not moved

#### Scenario: A note alone
- **WHEN** with "Go to the next" the user sends only a note on question 2
- **THEN** focus stays in question 2's card, which still reads "To do"

### Requirement: Completion
When every question of a board of two or more is answered or declined and nothing is held, the board SHALL show a completion panel at the top of its content: "Every question has an answer." and "{s} sent, {d} delivered to the agent.", counted from the questions' receipts only and updated as they change, never from the ask pill. It SHALL never say the agent read anything or that the tab can be closed, and SHALL not show on a locked board or in a Snapshot (NFR-10, AD-3).

#### Scenario: All sent, none collected
- **WHEN** in "One by one" the user sends the last question to do of nine and the agent has collected none
- **THEN** the panel reads "Every question has an answer." and "9 sent, 0 delivered to the agent.", and its heading has focus

#### Scenario: Receipts arrive
- **WHEN** the agent then collects three of the answers
- **THEN** the panel reads "9 sent, 3 delivered to the agent."

#### Scenario: Independent of the ask pill
- **WHEN** every receipt reads "Sent" while the ask pill reads "Answered"
- **THEN** the panel reads "0 delivered to the agent"

#### Scenario: The agent adds a question
- **WHEN** the panel shows and the agent adds a question
- **THEN** the panel leaves, and the count to do is 1

### Requirement: Completion with postponed questions
When the only questions left to do are postponed and nothing is held, the completion panel SHALL say how many remain and that closing loses the ask, offer "Go to the first", which reveals and focuses the first of them, and SHALL not say that every question has an answer (FR-4, FR-25).

#### Scenario: One postponed left
- **WHEN** the user sends the last question to do while one question is postponed
- **THEN** the panel says that 1 postponed question remains and that closing loses this ask, and does not read "Every question has an answer."

### Requirement: All ready, nothing sent
In "All together", when no question is left to do and answers are held, the board SHALL show no completion panel: after the act that left nothing to do, focus SHALL move to "Send {count} answers", beside which a line reads "All ready: nothing has been sent yet." The panel SHALL show after the send (NFR-10).

#### Scenario: The last confirm
- **WHEN** in "All together" the user confirms the last question to do
- **THEN** focus is on "Send 3 answers", the line reads "All ready: nothing has been sent yet.", and no completion panel shows until the user sends

### Requirement: Status messages for the guided flow
The status region SHALL also announce a postpone or decline that takes effect, a change sent, a ready mark lost to a field, the next question after an act that moves on, an area left with nothing to do, every question answered or all ready, a prefill undone, and the count delivered to the agent, at most once every 5 seconds and only from receipts that read delivered (NFR-10, AD-3; WCAG 2.2 SC 4.1.3).

#### Scenario: Postponed
- **WHEN** with "Stay here" the user postpones question 3 while question 4, "Cache", is to do
- **THEN** the region reads "Postponed. Next: Cache, 4 of 9."

#### Scenario: Delivered counts batched
- **WHEN** the agent collects two sent answers within 5 seconds
- **THEN** the region reads "Delivered to the agent: 2 of 2." once

#### Scenario: A ready mark lost
- **WHEN** in "All together" a ready answer's field "Ticket" is edited to fail its pattern
- **THEN** the question is no longer ready and the region reads "No longer ready: correct Ticket."

#### Scenario: An area completed
- **WHEN** the user sends the last question to do of the area "Architecture"
- **THEN** the region reads "Architecture completed"

### Requirement: Undo of a prefill
After "Prefill recommended", the bottom action bar SHALL show how many questions it filled and that nothing was sent, with "Undo", which takes focus; "Undo" SHALL clear each selection the prefill made that is still unchanged, then focus "Prefill recommended", and SHALL leave after the user's next edit or act on the board (FR-3, AD-10).

#### Scenario: Undo restores the drafts
- **WHEN** the user prefills 4 questions, then activates "Undo"
- **THEN** the 4 questions hold no selection, nothing was sent, the region reads "Prefill undone.", and focus is on "Prefill recommended (4)"

#### Scenario: An edit ends the undo
- **WHEN** the user prefills 4 questions and then changes the choice of one of them
- **THEN** "Undo" is gone and the 4 selections stay as they are

### Requirement: Reduced motion
The board's own motion SHALL be the move to the next question, scrolled smoothly for at most 250 ms, and the arrival mark, an accent edge on the card that fades over 1.2 seconds. Under `prefers-reduced-motion: reduce` the scroll SHALL be instant, the arrival mark static for 1.2 seconds then removed, and no animation or transition of the view or the board page SHALL last longer than 0 ms (WCAG 2.2 SC 2.3.3).

#### Scenario: Reduced motion
- **WHEN** under `prefers-reduced-motion: reduce`, with "Go to the next", the user sends a question
- **THEN** the page reaches its new position at once, the arrival mark has no animation, and every element of the view and the board page computes an animation and transition duration of 0 ms

#### Scenario: No preference
- **WHEN** without a reduced-motion preference the user sends a question with "Go to the next"
- **THEN** the arrival mark shows on the next question's card and is gone after 1.2 seconds

## MODIFIED Requirements

### Requirement: Single-question board
An ask of one question SHALL show as EXPERIENCE's single-question board, whatever presentation and delivery it requests: the tab labelled "<title> · AskBoard", a header with the title and the ask state, and one question card. It SHALL show no outline navigator, count to do, next-to-do jump, "Prefill recommended", delivery switch, Send, completion panel or "Continue" footer, and SHALL work as in "One by one" (FR-22).

#### Scenario: The plain-choice board
- **WHEN** the plain-choice ask's board opens
- **THEN** the tab reads "Which database should the order service use? · AskBoard", the header shows "Waiting", and the card shows the chip "Database" and three options, each with its description, then the open prompt, "Later", "More" and "Send answer"

#### Scenario: Submitted delivery requested for one question
- **WHEN** an ask of one question requests `delivery: "submitted"`
- **THEN** the board shows no delivery switch and no Send, and "Send answer" sends at once

#### Scenario: After the send
- **WHEN** the user sends the only question
- **THEN** the card reads "Sent", focus is on its heading, and no completion panel or "Continue" shows

### Requirement: Delivery receipt on the board
A sent answer SHALL show "Sent", then "Delivered to the agent" once the board is told so; never that the agent read it. An answer given while the connection is lost SHALL show "Not sent yet" and SHALL be sent on reconnect (FR-22, NFR-10).

#### Scenario: The agent collects
- **WHEN** the agent collects the answer
- **THEN** its receipt changes from "Sent" to "Delivered to the agent"

#### Scenario: Answering while disconnected
- **WHEN** the user answers while the connection is lost and the ask is still open when it returns
- **THEN** the answer shows "Not sent yet", is sent on reconnect once the board has the new connection's state, and is logged once

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

### Requirement: Tabs
With tabs, the board SHALL show one tab per area, labelled with its title and its count to do, or a done mark when none is left, and the tab strip SHALL stay under the context header as the page scrolls. The questions of hidden tabs SHALL stay mounted, so that they report ready. When an act leaves a tab with nothing to do while another tab has work, the board SHALL say "{area} completed" and move to that tab as After an answer says.

#### Scenario: A question answered in another tab
- **WHEN** the user answers the last question to do of the second area
- **THEN** that tab's label shows its done mark and no count, and the first tab's count is unchanged

#### Scenario: Handing off to the next tab
- **WHEN** with tabs and "Go to the next" the user sends the last question to do of "Architecture" while "Release" has work
- **THEN** the region reads "Architecture completed", "Release" is the active tab, its first question to do has focus, and the tab strip is in view

### Requirement: One question per view
In one question per view, the board SHALL show one question at a time, with its area's title, under the question navigator: "Question n of m", one state marker per question, and Previous and Next, which stop at the ends. The navigator SHALL hold no next-to-do jump: the header's is the only one (Counts and the next-open jump). Navigating SHALL move focus to the question's heading, and answering SHALL change the question shown only as After an answer says (FR-2).

#### Scenario: Moving to the next open question
- **WHEN** the user is on question 4 of 5 and questions 2 and 5 are to do
- **THEN** the header's "Next to do" shows question 5, then question 2

#### Scenario: One next-open control
- **WHEN** a board of five questions opens in one question per view
- **THEN** the header shows the count to do and one next-to-do control, and the question navigator shows "Question 1 of 5", the markers, Previous and Next, and no next-to-do control

#### Scenario: Stay here keeps the question
- **WHEN** with "Stay here" the user sends the question shown while another is to do
- **THEN** the same question is shown, and focus is on its "Continue"

### Requirement: Outline navigator
With sections or tabs, the board SHALL show the outline navigator: areas and questions, each question with its state of the answer state ladder, the new-question and unread-reply marks, and a jump to the question on a click or keypress that activates its tab. It SHALL mark the question in view as current, and no other entry.

#### Scenario: Jumping into another tab
- **WHEN** the user activates a question of a hidden tab in the outline
- **THEN** that tab becomes active and the question's heading takes focus

#### Scenario: The mark follows scrolling
- **WHEN** with sections the user jumps to question 2 with the outline, then, with focus on no card, scrolls until question 7's card crosses the reading line
- **THEN** question 7's outline entry is marked current, and no other entry is

#### Scenario: The entry's state
- **WHEN** in "All together" the user confirms question 2
- **THEN** question 2's outline entry reads "Ready, not sent"

### Requirement: Counts and the next-open jump
On a board of two or more questions, in every presentation, the header SHALL show the count to do (to do, draft and postponed questions, the postponed ones named apart) and "Next to do", which reaches unseen questions the agent added first, then those to do or in draft after the question in view, then the postponed ones, each in board order wrapping to the start. The ask pill SHALL show only what the agent has received: "Partly answered n/m", or "answered, 1 postponed" (FR-24).

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
- **THEN** the header reads "4 to do (1 postponed)", and "4 da fare (di cui 1 rimandata)" in it-IT

### Requirement: Open prompt
Every question SHALL show its open prompt, "Note for the agent (optional)", whose text SHALL leave only with the question's answer or decline, or alone through the primary ("Send the note" in "One by one"), leaving the question to do with "Note sent {time}" under the prompt while the page stays open; never on typing or blur (FR-7, AD-20). While an item's held result requires a reason, as with an Approval's "Approve with changes", the prompt SHALL read "Reason for the changes (required)" (FR-11).

#### Scenario: A note without an answer
- **WHEN** the user writes only a note and presses "Send the note"
- **THEN** a note is sent, the question still reads "To do" and counts as to do, and "Note sent" shows under the prompt

#### Scenario: The reason's label
- **WHEN** the user selects "Approve with changes", then "Reject"
- **THEN** the prompt reads "Reason for the changes (required)", then "Note for the agent (optional)" again, keeping its text

### Requirement: Recommended option
The recommended option SHALL carry the "Recommended" badge and never start selected. "Accept recommended", on the recommended option's row and shown only while its question is to do or in draft, SHALL select it and act as the primary in one click (FR-3, AD-10).

#### Scenario: Accept recommended in immediate delivery
- **WHEN** the user presses "Accept recommended" on a question
- **THEN** its recommended option is selected and the answer is sent at once

#### Scenario: Absent once answered
- **WHEN** a question with a recommendation is answered, ready or declined
- **THEN** it shows no "Accept recommended"

### Requirement: Select recommended
On a board of two or more questions, "Prefill recommended ({count})" SHALL select the recommended option on every question to do that is not postponed, declined or ready and where the user has chosen nothing, counting those questions in its label. In either delivery mode it SHALL only fill drafts: it sends nothing and marks nothing ready. It SHALL be absent when no question can take it (FR-3, NFR-10).

#### Scenario: A choice is never replaced
- **WHEN** the user has chosen an option on one question and presses "Prefill recommended"
- **THEN** that question keeps the user's choice, the others with a recommendation get it selected, and nothing is sent

#### Scenario: Drafts only, in All together
- **WHEN** in "All together" four questions can take a recommendation and the user presses "Prefill recommended (4)"
- **THEN** the four questions read "Draft", none is ready, nothing is sent, the bar says "4 questions prefilled. Nothing was sent." with "Undo", and "Prefill recommended" is absent

### Requirement: Delivery mode
A board of two or more questions SHALL start in the delivery mode the ask requests, "One by one" when it requests none, and SHALL let the user switch to "All together" and back. There "Confirm" SHALL mark the question ready, and "Edit" or an edit SHALL make it not ready (FR-22). Beside the switch the bar SHALL show the mode's helper text in the ask's language: "Each answer goes to the agent as soon as you send it." or "Answers stay here until you press "Send answers"." (FR-34).

#### Scenario: Editing a ready question
- **WHEN** the user marks a question ready, then changes its choice
- **THEN** the question is no longer ready and Submit would not send it

#### Scenario: The submitted helper text
- **WHEN** a board of two or more questions is in "All together"
- **THEN** the bar reads, after the switch, "Answers stay here until you press "Send answers"." in en-US, and "Le risposte restano qui finché non premi «Invia le risposte»." in it-IT

#### Scenario: Switching mode changes the helper text
- **WHEN** the user switches from "One by one" to "All together", then back
- **THEN** the helper text changes to the submitted one, then back to "Each answer goes to the agent as soon as you send it."

#### Scenario: The mode names
- **WHEN** an it-IT board of two or more questions opens
- **THEN** the switch reads "Invio delle risposte" with "Una alla volta" and "Tutte insieme"

### Requirement: Submit
In "All together", "Send {count} answers", {count} being the ready answers, SHALL send every ready answer, held postpone, decline, undo and note as one command in the order the user produced them, and SHALL read "Send" when no answer is ready. It SHALL be disabled while nothing is held, while the connection is lost, and while an agent-change notice sits on a question with held work. It SHALL be absent, not disabled, in "One by one" (AD-20, FR-22).

#### Scenario: Submitting a postpone and two answers
- **WHEN** the user marks two answers ready, postpones a third question and presses "Send 2 answers"
- **THEN** one command carrying the three acts in that order reaches `board-host`, and the receipts show "Sent"

#### Scenario: Submit under a pending agent change
- **WHEN** an agent-change notice sits on a question with a ready answer
- **THEN** Submit is disabled, and the bar says how many updates need a choice and jumps to the first

#### Scenario: Absent in One by one
- **WHEN** a board of two or more questions is in "One by one"
- **THEN** the bar holds no Send button, enabled or disabled

#### Scenario: Prefills are not sent
- **WHEN** in "All together" the user prefills three questions, confirms one of them and presses "Send 1 answer"
- **THEN** only the confirmed answer is sent, and the other two keep their selections as drafts

### Requirement: Revising an answer
While the ask is open, an answered or declined question SHALL stay editable: an edit fills the draft, the card reads "Draft" while showing its latest answer with that answer's receipt, and the primary sends the revision as the delivery mode says, reading "Send the change" in "One by one". A revision SHALL never move the board on (FR-22).

#### Scenario: Revising after delivery
- **WHEN** the agent has received "PostgreSQL" and the user selects "SQLite" and presses "Send the change"
- **THEN** the revision is sent, the receipt shows "Sent", then "Delivered to the agent" once collected, and focus stays on the question's heading

### Requirement: The board's interface in the ask's language
The view and the board page SHALL show every string of their own in the ask's language, en-US or it-IT, and SHALL set the document's `lang` to it; the agent's content SHALL show as the agent sent it (FR-34; EXPERIENCE, Localization, Voice and Tone). No control on the board SHALL change the language.

#### Scenario: An Italian ask
- **WHEN** an ask is sent with `language` `it-IT`
- **THEN** the board shows "Invia risposta", "Più tardi" and "Impostazioni", and the board page's and the view's `lang` are `it`

#### Scenario: The agent's text is untouched
- **WHEN** an it-IT ask's question text is English
- **THEN** the question shows in English, inside the Italian interface

#### Scenario: No language control
- **WHEN** a user looks for a way to change the language on any board
- **THEN** there is none, and the settings panel shows the language read-only

### Requirement: The settings panel
Every board SHALL open a non-modal settings panel from "Settings" in the context header, closed with Esc or its close control. It SHALL hold the presentation keys as controls, then the user's key overrides read-only with file, key and problems and a note that they apply to the next board, the ask's language read-only, and each behaviour key read-only with value, file and key (FR-35, AD-14; EXPERIENCE, Preferences and Settings; DESIGN, Settings panel).

#### Scenario: The panel's three groups
- **WHEN** the user presses "Settings"
- **THEN** the panel shows Theme, Density, Context placement and After answering as segmented controls and Keys read-only, then the Language indicator, then default language, asking rules, Snapshot folder and editor under "Applies from the next session"

#### Scenario: The board stays usable
- **WHEN** the panel is open and the user answers a question
- **THEN** the answer is sent, and the panel stays open

#### Scenario: From the keyboard
- **WHEN** the user opens the panel with the keyboard, moves through a segmented control with the arrow keys and presses Esc
- **THEN** the setting changes, the panel closes, and focus returns to "Settings"

#### Scenario: The user's keys
- **WHEN** the user file changes the keys of two actions
- **THEN** the Keys row reads that two actions are changed, names the user file and the key `keys`, and offers no control to change them

#### Scenario: No key changed
- **WHEN** the user file sets `keys` to `{}`, or gives an action exactly its default keys
- **THEN** the Keys row reads "Default keys"

#### Scenario: Keys in the project file
- **WHEN** the project file sets `keys`
- **THEN** the Keys row shows a warning that the project's keys are ignored, and the keys in effect come from the user file or are the defaults

#### Scenario: File text in the panel
- **WHEN** a warning's action or combination, a file problem's pointer, a file's path or the project's Snapshot folder holds a line feed or a right-to-left override
- **THEN** the panel shows that text with the character escaped and isolated from the sentence around it, which reads in its own order

### Requirement: Presentation changes apply at once and persist
Changing theme or density from the header's quick toggles or the panel, or the context-placement default or the after-answer setting from the panel, SHALL apply to that board at once and be written as the user-level setting, so a board opened later opens with it (FR-35). No setting SHALL be kept in the browser's storage.

#### Scenario: Theme reaches a later board
- **WHEN** the user picks Dark on one board and the agent then sends a new ask
- **THEN** the new board opens dark

#### Scenario: Clearing the browser's storage
- **WHEN** the user clears the browser's storage and opens a board
- **THEN** the board opens with the settings from the configuration files

#### Scenario: A write that fails
- **WHEN** the user picks Comfortable and the user file cannot be written
- **THEN** the board turns comfortable, and the panel shows an error under Density naming the file's path

### Requirement: Focus after Answer and Submit
When an act leaves the pressed control disabled, focus SHALL move as After an answer, Completion and All ready, nothing sent say, else to the question's heading, as after a revision or a note. After Submit sends, it SHALL move to the completion panel's heading when nothing is left to do, else to the next question to do. The move SHALL happen when the act is taken or its confirmation closes, never when its command settles, and focus SHALL never fall to the page (WCAG 2.2 SC 2.4.3; NFR-12).

#### Scenario: Answer in sections
- **WHEN** in "One by one" with sections and "Go to the next" the user selects an option of question 1 and activates "Send answer" with the keyboard
- **THEN** focus is on the next question to do's heading, not on the page

#### Scenario: A note alone in tabs and in one question per view
- **WHEN** in "One by one" with tabs, and again in one question per view, the user sends only a note on the question shown with the keyboard
- **THEN** focus is on that question's heading, and one question per view still shows the same question

#### Scenario: The last open question
- **WHEN** in "One by one" the user answers the last question to do of the board
- **THEN** focus is on the completion panel's heading

#### Scenario: Accept recommended
- **WHEN** in "One by one" with "Stay here" the user activates "Accept recommended" on a question while another is to do
- **THEN** the answer is sent and focus is on the question's "Continue"

#### Scenario: A confirmed revision
- **WHEN** the agent has received a verdict, the user changes it, activates "Send the change" and confirms in the dialog
- **THEN** focus is on the question's heading once the dialog has closed

#### Scenario: Submit
- **WHEN** in "All together" two answers are ready, another question is to do, and the user activates "Send 2 answers"
- **THEN** focus is on the heading of the next question to do, not on the page

#### Scenario: Send and switch
- **WHEN** in submitted delivery with a ready answer the user switches to immediate delivery and confirms "Send and switch", directly or after the dialog that asks before replacing a received verdict
- **THEN** the held work is sent and focus is on the delivery switch's "One by one"

#### Scenario: Edit keeps focus
- **WHEN** in "All together" the user activates "Edit" on a ready answer
- **THEN** the answer is not ready and focus is on the question's "Confirm"

#### Scenario: Focus the user moved meanwhile
- **WHEN** the user answers question 1 and moves focus into question 2's note field before question 1's receipt shows "Sent"
- **THEN** focus is still in question 2's note field after the receipt shows "Sent"

### Requirement: Focus moves clear the sticky bars
Each move of focus to a question's heading, or to a field to fix, SHALL first scroll the view so that the element lies wholly between the sticky bars (the context header, or the tab strip with tabs, and the bottom action bar), or starts just under the top one when taller than that space. This holds for the next-to-do, outline, unread-reply and agent-change jumps, the question navigator, tab activation, After an answer and Focus after Answer and Submit (WCAG 2.2 SC 2.4.11).

#### Scenario: Next open to a heading under the bottom bar
- **WHEN** at 1280×800 with sections the next question to do has its heading under the bottom action bar and the user activates the header's "Next to do"
- **THEN** the heading lies wholly between the header's bottom edge and the bar's top edge, and has focus

#### Scenario: A jump that wraps upward
- **WHEN** the next-to-do jump wraps to a question whose heading is above the viewport
- **THEN** the heading lies wholly below the header's bottom edge and above the bar's top edge

#### Scenario: An outline jump
- **WHEN** with sections, and again with tabs, the user activates the outline entry of a question whose heading is out of view
- **THEN** that heading lies wholly between the header, or the tab strip, and the bottom bar, and has focus

#### Scenario: A jump into another tab
- **WHEN** with tabs the next-to-do jump activates another tab
- **THEN** the target question's heading lies wholly between the tab strip and the bottom bar, and has focus

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
- **WHEN** in one question per view the agent deletes the question in view
- **THEN** the region reads "Question removed by the agent"

#### Scenario: The agent pill
- **WHEN** the agent pill changes to "Agent: Working", and later to "Agent: Waiting for your answer"
- **THEN** the first change is not announced, and the region reads "Agent: Waiting for your answer" after the second

#### Scenario: In Italian
- **WHEN** the ask's language is it-IT and an answer "PostgreSQL" is reported sent
- **THEN** the region's text begins "Risposta inviata: PostgreSQL."
