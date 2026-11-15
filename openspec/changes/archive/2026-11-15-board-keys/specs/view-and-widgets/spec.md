## ADDED Requirements

### Requirement: Next and previous open by key
While the header shows the next-open jump, `N`, or the keys the user's file gives that action instead, SHALL do what the jump does, and `Shift+N` SHALL focus the heading of the open question before the question in view, in board order, wrapping to the last, scrolled clear of the bars. Each SHALL act only with focus in the view outside a text field, a widget item, a menu and a dialog, and not while an input method composes (NFR-12).

#### Scenario: From an option
- **WHEN** with sections the focus is on an option of question 2, questions 1, 2 and 4 are open and 3 is answered, and the user presses `N`, then `Shift+N`, then `Shift+N`
- **THEN** question 4's heading has focus and lies between the header and the bottom bar, then question 2's, then question 1's

#### Scenario: Wrapping back
- **WHEN** the question in view is the first open question and the user presses `Shift+N`
- **THEN** the last open question's heading has focus

#### Scenario: One question per view
- **WHEN** in one question per view question 3 is shown, questions 1 and 5 are open, and the user presses `N`, then `Shift+N`
- **THEN** question 5 is shown with its heading focused, then question 1, the open question before it

#### Scenario: A letter typed in a field
- **WHEN** the focus is in a question's note field, then in the "Other…" field, and the user presses `N`
- **THEN** each field holds "n" and the question in view does not change

#### Scenario: Inside a widget
- **WHEN** a Ranking's row has the focus and the user presses `N`
- **THEN** the focus stays on the row and the question in view does not change

#### Scenario: A newly opened board
- **WHEN** a board has just opened and the user presses `N` before clicking or focusing inside it
- **THEN** nothing in the board moves and nothing has focus in it

#### Scenario: No open question to go to
- **WHEN** every other question is answered and the user presses `N` with the focus on an option
- **THEN** the focus stays on the option and the key's default action is not prevented

#### Scenario: A key with another modifier
- **WHEN** the focus is on an option and the user presses Alt+N, then Ctrl+N on Linux
- **THEN** the question in view does not change and neither key's default action is prevented

### Requirement: Answer by key
`Mod+Enter` (`Ctrl` on Linux, `Cmd` on macOS), or the user's keys for that action, with focus on a question card's own controls outside a text field, a widget item, a link and the follow-up thread, SHALL act as a press of that question's primary button, the one that answers it, through its gates, confirmations and focus moves. The key SHALL change no choice, SHALL be taken there whether it acts or not, and a held key's repeats SHALL do nothing (NFR-12, NFR-10).

#### Scenario: Immediate delivery
- **WHEN** in immediate delivery the user selects "PostgreSQL" on question 1, moves the focus to another option without selecting it, and presses `Mod+Enter`
- **THEN** one command carrying "PostgreSQL" reaches `board-host`, the other option is not selected, and focus is on question 1's heading

#### Scenario: Submitted delivery
- **WHEN** in submitted delivery the user selects an option and presses `Mod+Enter` on it
- **THEN** the question is ready and not sent, the status region says the answer is ready and not sent, and the ask pill still shows "Waiting"

#### Scenario: A multiple choice's box
- **WHEN** a question with several choices has one box ticked and the user presses `Mod+Enter` on another, unticked box
- **THEN** the answer carries only the ticked box, and the other box stays unticked

#### Scenario: The single-question board
- **WHEN** on the single-question board the user selects an option and presses `Mod+Enter` on the heading
- **THEN** the answer is sent as with the primary button

#### Scenario: A held key
- **WHEN** the user presses `Mod+Enter` on a question with a choice and holds it, so that the key repeats on the control the focus moved to after the answer
- **THEN** one answer is sent, and no other question is answered or marked ready

#### Scenario: Inside a widget
- **WHEN** a question holds only a Ranking, the user presses Enter on a row, which keeps the order and makes the question answerable, then presses `Mod+Enter` on that row
- **THEN** the Ranking keeps the order, no command reaches `board-host`, nothing is marked ready, and the status region says nothing

#### Scenario: A received verdict
- **WHEN** the agent has received a verdict, the user changes it and presses `Mod+Enter` on the card
- **THEN** the dialog that asks before replacing it opens, and Cancel sends nothing and returns the focus to where it was

### Requirement: A blocked answer by key
While the question's primary button is disabled because a field must be fixed, because nothing is chosen and no note is written, or because the agent's change waits for the user's choice, `Mod+Enter` on that card SHALL send nothing, mark nothing ready and announce the reason in the status region. While it is disabled for any other cause it SHALL do nothing (NFR-10, NFR-12).

#### Scenario: A field to fix
- **WHEN** a pattern field holds `ab-1234` and the user presses `Mod+Enter` on the card's options
- **THEN** nothing reaches `board-host`, the status region says the question is not answered and "Correct Email first.", and the focus stays on the option

#### Scenario: Nothing chosen
- **WHEN** nothing is chosen on a question and its note is empty, and the user presses `Mod+Enter` on its heading
- **THEN** nothing reaches `board-host`, and the status region says the question is not answered and that an answer or a note comes first

#### Scenario: An agent change waiting
- **WHEN** an agent-change notice sits on a question with unsent work and the user presses `Mod+Enter` on "Keep mine"
- **THEN** nothing is sent, "Keep mine" is not chosen, and the status region says the agent's update needs a choice first

### Requirement: The board's key table matches its handlers
The keys the board takes outside its widgets SHALL be those of the board's key table in effect: a key the table binds in a part SHALL do its action there, and any other key SHALL be left to the browser, so that the tooltips, the keys panel and the help skill describe what the board does (NFR-12).

#### Scenario: Each key and its neighbours
- **WHEN** each key of the board's key table, and each with Alt, Ctrl, Cmd or Shift added, is given to the board's key handlers with the focus on an option
- **THEN** the table's keys do their actions and the others do nothing

#### Scenario: The composer's send
- **WHEN** the focus is in the follow-up composer with a question written and the user presses `Mod+Enter`
- **THEN** the follow-up is sent at once and the question is not answered

### Requirement: The board's keys are discoverable
The header's next-open jump, each question's primary button and the composer's "Send" SHALL show, on hover and on keyboard focus, a tooltip with the action's name and its keys in effect, and SHALL carry those keys in `aria-keyshortcuts` (NFR-12).

#### Scenario: The jump's tooltip
- **WHEN** the user tabs to the header's next-open jump on Linux
- **THEN** a tooltip shows its name with the key N, and its `aria-keyshortcuts` is `N`

#### Scenario: The primary button's keys
- **WHEN** the pointer rests on an enabled primary button on macOS
- **THEN** a tooltip shows its name with ⌘↩, and its `aria-keyshortcuts` is `Control+Enter Meta+Enter`

### Requirement: The board's keys panel
The header SHALL show a "Keys" button on a board that is not closed or discarded. It, and `?` with focus outside a text field, a widget item, a menu and a dialog, SHALL open a "Board keys" panel listing the board's keys in effect by group, from board strings only, which closes as a widget's keys panel does (NFR-12, AD-8).

#### Scenario: Opening with the question mark
- **WHEN** the focus is on an option and the user presses `?`, then Escape
- **THEN** the "Board keys" panel opens listing next open, previous open, answer, send a follow-up and the keys panel with their keys, says that the keys do nothing in a text field or inside a widget and that sending all held answers has no key, and closes with the focus back on the option

#### Scenario: Opening with the Keys button
- **WHEN** the user activates the header's "Keys"
- **THEN** the "Board keys" panel opens and holds no text the agent sent

#### Scenario: A widget's own panel
- **WHEN** a Ranking's row has the focus and the user presses `?`
- **THEN** the Ranking's keys panel opens, and the "Board keys" panel does not

### Requirement: The user's keys on the board's own keys
The board's key handlers, tooltips and keys panel SHALL take the board's key table with the user's key overrides applied, or its default keys when the user file sets none or they were not applied. A key the overrides took away SHALL be left to the browser, and a Snapshot SHALL use the default keys (NFR-12, AD-14).

#### Scenario: The next-open jump on another key
- **WHEN** the user file gives next open `j` and the user presses `N`, then `J`, with the focus on an option
- **THEN** `N` moves nothing, `J` does what the next-open jump does, the jump's tooltip shows J, its `aria-keyshortcuts` is `J`, and the "Board keys" panel marks next open as changed

#### Scenario: Answer with no key
- **WHEN** the user file gives answer no key and the user presses `Mod+Enter` on an option of a question with a choice
- **THEN** nothing is sent, the primary button's tooltip shows the action's name with no key, and the panel lists answer with "no key"

## MODIFIED Requirements

### Requirement: Follow-up thread
Each question SHALL have a follow-up thread, collapsed until opened, with its composer at the foot: Enter adds a line, and the keys in effect for sending a follow-up, Ctrl+Enter or Cmd+Enter unless the user's file gives others, or "Send" sends at once in either delivery mode. Replies SHALL show in the thread under their follow-up with author and time, and SHALL never raise an agent-change notice (FR-10).

#### Scenario: Two rounds before answering
- **WHEN** the user sends a follow-up, reads the reply, sends another, reads its reply and answers
- **THEN** the thread holds both follow-ups and both replies in order, and the answer is sent

#### Scenario: Sending with the key
- **WHEN** the user writes a follow-up in the composer and presses Enter, then Ctrl+Enter on Linux
- **THEN** Enter adds a line, Ctrl+Enter sends the follow-up, and the question is not answered
