## ADDED Requirements

### Requirement: Kanban order in the draft
A Kanban SHALL hold in the draft only a value whose changes against the revision the work counts against rebuild it, each column in the order the board shows; the agent's Kanban with no change SHALL leave no value (AD-10, AD-20, NFR-10).

#### Scenario: Reordered, then put back
- **WHEN** the user moves `add-sso` above `fix-login` in `todo`, then moves it back below
- **THEN** the draft holds no value for the item and no card shows the change highlight

#### Scenario: A held order across a reload
- **WHEN** the user reorders a column without answering and reloads the tab
- **THEN** the column shows the user's order and the leave-page prompt is armed

### Requirement: A Kanban value fits a revision
A Kanban value SHALL fit a revision only when it holds that revision's columns and cards, labels and descriptions unchanged, and its changes against that revision rebuild it; a value that does not fit SHALL be dropped whole, so the answer sends what the item shows (AD-10, AD-20, NFR-10).

#### Scenario: A held order after an agent's change and a reload
- **WHEN** the user reorders a column, the agent changes the Kanban, the tab reloads and the user keeps their draft
- **THEN** the Kanban is read-only with the line under it, "Keep mine" drops its held value, and the answer sends nothing for it

#### Scenario: A held value its changes do not rebuild
- **WHEN** the draft is restored with a Kanban value whose list its changes do not rebuild on the shown revision
- **THEN** the value is dropped and the Kanban shows the agent's cards

### Requirement: Kanban order read-only and in a Snapshot
An answered question's, a locked question's and an opened Snapshot's Kanban SHALL show the cards of each column in the shown value's order, the cards the answer reports as moved highlighted, with no tool, key move or drag acting (AD-15, AD-20).

#### Scenario: A Snapshot of a reordered Kanban
- **WHEN** a Snapshot is opened of a board answered with `add-sso` placed above `fix-login`
- **THEN** `todo` lists `add-sso` then `fix-login`, `add-sso` highlighted, and nothing can be dragged or moved

### Requirement: Kanban order strings
The Kanban's new tools SHALL come from the view's string tables in en-US and it-IT: "Move up", "Move down", "To top" and "To bottom", in Italian "Sposta su", "Sposta giù", "In cima" and "In fondo", to review (FR-34, EXPERIENCE Voice and Tone).

#### Scenario: An Italian Kanban
- **WHEN** a board in it-IT holds a Kanban
- **THEN** its toolbar reads "Sposta su", "Sposta giù", "In cima", "In fondo" and "Sposta in…", and no English chrome

### Requirement: The Approval summary of a Kanban's order
The Approval summary SHALL word a card's `move` as one "moved" line naming the card, and a card moved to another column at its sent place as one line of its column (FR-11, F-04).

#### Scenario: A reordered card beside an Approval
- **WHEN** the user places `add-sso` above `fix-login` in a Kanban of a question that holds an Approval
- **THEN** the summary is titled "1 change" and its line names `add-sso` as moved

### Requirement: Kanban order end to end
A Kanban order SHALL reach the agent through `collect` and push delivery as the answer event's `set`s and `move`s, and `fetch` SHALL return the edited cards in the board's order, on the session process (FR-18, FR-20, AD-20).

#### Scenario: Collected and pushed
- **WHEN** the user answers a question whose Kanban has a card reordered in its column and another placed in another column, on the real board
- **THEN** `collect`, and the mod where it runs, deliver one answer event whose `changes` hold the `move` of the first and the `set` then `move` of the second, and nothing for the untouched column

## MODIFIED Requirements

### Requirement: Kanban columns and cards
A Kanban SHALL show its columns side by side in the agent's order, each headed by its label and its number of cards, with each card under the column its value names, in the order of the value's `cards`, showing its label and its description. Each card SHALL give assistive technology its place in its column and its column's number of cards (FR-11, NFR-12, DESIGN Kanban).

#### Scenario: Three columns
- **WHEN** a Kanban with the columns `todo`, `doing` and `done` and the cards `a` and `c` in `todo` and `b` in `done` is shown
- **THEN** `todo` reads 2 and lists `a` then `c`, `doing` reads 0, and `done` reads 1 and lists `b`

#### Scenario: A card's place
- **WHEN** `c` is the second of two cards in `todo`
- **THEN** it carries `aria-posinset` 2 and `aria-setsize` 2 inside the column's group

### Requirement: Kanban moves by drag
A card SHALL move by drag to the place under the pointer, in its own column or another: before the first card of the column whose vertical middle is below the pointer, else last. While a card is dragged, the column under it SHALL show the drop indicator, the outline when the card comes from another column and a line where the card would land, with no line where the drop would change nothing; Escape SHALL cancel, and a drop from another widget SHALL be refused. A move SHALL put the whole edited props into the draft; moved cards SHALL take the change highlight. The drag library SHALL come from the shared drag chunk (FR-11, AD-9, AD-10).

#### Scenario: A drag to another column
- **WHEN** the user drags the card `a` from `todo` onto `doing`, below its last card, in Chromium or WebKit
- **THEN** `a` shows last in `doing` with the change highlight, and the draft holds the props with `a`'s column `doing`

#### Scenario: A drag within the column
- **WHEN** the user drags `c` above `a` in `todo`, in Chromium or WebKit
- **THEN** the line shows above `a` during the drag, `todo` then lists `c` then `a`, and `c` takes the change highlight

#### Scenario: A drag into another column marks the dragged card only
- **WHEN** the user drags `a` from `todo` into `done`, right below `b`, a card the sent order puts after `a`, in Chromium or WebKit
- **THEN** `done` lists `b` then `a`, only `a` takes the change highlight, and the counter reads "Your changes: 1 moved"

#### Scenario: Moved back
- **WHEN** the user then drags each moved card back to its place
- **THEN** the draft holds no value for the item and no card shows the change highlight

#### Scenario: Escape
- **WHEN** the user presses Escape while dragging `c` over `doing`
- **THEN** every card is where it was and the draft is unchanged

#### Scenario: A board with a Kanban only
- **WHEN** a board whose only widget is a Kanban is assembled
- **THEN** it inlines the Kanban's chunk and the drag library's chunk, and no Tree or Ranking chunk

### Requirement: Kanban at the keyboard
A Kanban's cards SHALL be one Tab stop whose arrow keys, held with no modifier, move the current card, Up and Down within its column, Left and Right to the nearest card of the next column that holds one. Alt+Shift+Up and Alt+Shift+Down SHALL move the current card one place up or down in its column, and Alt+Shift+Home, Alt+Shift+End, Ctrl or Cmd with Shift and Up, and Ctrl or Cmd with Shift and Down, to its top or bottom; the card SHALL stay current and keep the focus. A bound key SHALL have its default prevented even where it cannot act; any other modifier, and a key while an input method composes, SHALL do nothing. Its toolbar, "Move up", "Move down", "To top", "To bottom", "Move to…" and the counter, SHALL be another Tab stop; each tool SHALL be disabled without losing focus where it cannot act, and "Move to…" SHALL open a menu of the other columns that moves the current card where the agent's order puts it, the card staying current. The counter SHALL read "No changes" or "Your changes: N moved", N the cards the answer reports (FR-11, NFR-12, EXPERIENCE Accessibility Floor).

#### Scenario: Move to a column from the keyboard
- **WHEN** the user makes `c` current with the arrow keys, opens "Move to…" from the keyboard and chooses `done`
- **THEN** `c` shows in `done` and is still the current card, and the counter reads "Your changes: 1 moved"

#### Scenario: Up within the column
- **WHEN** `c`, second in `todo`, is current and the user presses Alt+Shift+Up
- **THEN** `todo` lists `c` then `a`, `c` keeps the focus, and the counter reads "Your changes: 1 moved"

#### Scenario: To the bottom
- **WHEN** `a`, first of three cards in `todo`, is current and the user presses Cmd+Shift+Down on macOS or Ctrl+Shift+Down elsewhere, or "To bottom"
- **THEN** `a` is last in `todo` and still current

#### Scenario: A held modifier
- **WHEN** the user presses Shift+Up or Alt+Up on a card
- **THEN** the current card and the draft do not change, and the key's default is not prevented

#### Scenario: At the edge
- **WHEN** the first card of a column is current
- **THEN** "Move up" and "To top" are disabled, and Alt+Shift+Up changes nothing, scrolls nothing and navigates nowhere

#### Scenario: No current card
- **WHEN** no card is current
- **THEN** every tool is disabled and keeps the focus if it had it
