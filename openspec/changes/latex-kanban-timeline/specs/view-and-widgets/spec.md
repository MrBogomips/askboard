## ADDED Requirements

### Requirement: LaTeX source and preview
A LaTeX item SHALL show a source field in the code type holding its expression, the item's value else the props as sent, with a live preview of it in display mode under the field. An edit SHALL put the whole edited props into the draft, and an edit back to the agent's expression SHALL clear the item's draft value. While the expression differs from the agent's, the field SHALL take the change highlight (FR-11, AD-9, AD-20).

#### Scenario: Typing an expression
- **WHEN** the user types `=c^2` after `a^2+b^2` in the source field
- **THEN** the preview shows the new equation and the draft holds `{expression: "a^2+b^2=c^2"}` for the item

#### Scenario: Back to the agent's expression
- **WHEN** the user deletes what they typed, so the field holds the agent's expression again
- **THEN** the draft holds no value for the item and the field shows no change highlight

#### Scenario: An empty expression from the agent
- **WHEN** the agent sends an empty expression
- **THEN** the field is empty, the preview shows nothing, and the item counts as ready

### Requirement: LaTeX parse errors
While the expression does not parse, the board SHALL show KaTeX's message under the source field as a field error and keep the last preview that rendered; an expression that never rendered SHALL leave the preview empty. A parse error SHALL NOT block "Answer": the answer carries the expression as written (FR-11, EXPERIENCE Answer).

#### Scenario: An unclosed brace
- **WHEN** the user types `\frac{1}{` in the source field
- **THEN** the field error gives KaTeX's message, the preview still shows the last expression that rendered, and "Answer" stays enabled

#### Scenario: The agent's expression does not parse
- **WHEN** the agent sends `\frac{1}{`
- **THEN** the field error shows, the preview is empty, and the item counts as ready

### Requirement: LaTeX untrusted commands
The LaTeX preview SHALL render agent and user text as data: no command SHALL make a link, an image, a class, an ID, a style attribute or a request, a macro defined in one render SHALL NOT exist in the next, and macro expansion SHALL be bounded (AD-8, NFR-5, NFR-9).

#### Scenario: A link and an image
- **WHEN** the expression holds `\href{https://example.com}{x}` and `\includegraphics{https://example.com/a.png}`
- **THEN** the preview holds no link and no image, and the board makes no request

#### Scenario: A macro does not outlive its render
- **WHEN** one LaTeX item's expression is `\gdef\foo{1}` and another's is `\foo`
- **THEN** the second shows a parse error naming `\foo`

#### Scenario: Expansion without end
- **WHEN** the expression defines a macro that expands itself
- **THEN** the preview shows a parse error and the board keeps responding

### Requirement: Package stylesheets in a chunk
A component chunk MAY carry a package's stylesheet. The build SHALL inline its woff2 fonts as `data:` URLs, drop its other font formats, and fail on any other `url(` or on an `@import`, so that no chunk loads a file from anywhere (AD-8, AD-9, NFR-9).

#### Scenario: KaTeX's fonts
- **WHEN** a board holding a LaTeX item opens in Chromium or WebKit
- **THEN** the preview uses KaTeX's fonts, no font is requested, and no CSP violation is logged

#### Scenario: A stylesheet that names a file
- **WHEN** a chunk's package stylesheet holds `url(fonts/a.svg)` or `@import "b.css"`
- **THEN** the build fails, naming the chunk and the URL or the import

### Requirement: Kanban columns and cards
A Kanban SHALL show its columns side by side in the agent's order, each headed by its label and its number of cards, with each card under the column its value names, in the agent's order of `cards`, showing its label and its description (FR-11, DESIGN Kanban).

#### Scenario: Three columns
- **WHEN** a Kanban with the columns `todo`, `doing` and `done` and the cards `a` and `c` in `todo` and `b` in `done` is shown
- **THEN** `todo` reads 2 and lists `a` then `c`, `doing` reads 0, and `done` reads 1 and lists `b`

### Requirement: Kanban moves by drag
A card SHALL move by drag onto another column, which shows the drop indicator while the card is over it; Escape SHALL cancel, and a drop from another widget SHALL be refused. A move SHALL put the whole edited props into the draft, a card moved back to its sent column leaving no change for it; moved cards SHALL take the change highlight. The drag library SHALL come from the shared drag chunk (FR-11, AD-9, AD-10).

#### Scenario: A drag to another column
- **WHEN** the user drags the card `a` from `todo` onto `doing` in Chromium or WebKit
- **THEN** `a` shows in `doing` with the change highlight, and the draft holds the props with `a`'s column `doing`

#### Scenario: Moved back
- **WHEN** the user then drags `a` back onto `todo`
- **THEN** the draft holds no value for the item and no card shows the change highlight

#### Scenario: A board with a Kanban only
- **WHEN** a board whose only widget is a Kanban is assembled
- **THEN** it inlines the Kanban's chunk and the drag library's chunk, and no Tree or Ranking chunk

### Requirement: Kanban at the keyboard
A Kanban's cards SHALL be one Tab stop whose arrow keys move the current card, Up and Down within its column, Left and Right to the nearest card of the next column that holds one. Its toolbar, "Move to…" and the counter, SHALL be another; "Move to…" SHALL open a menu of the other columns that moves the current card, which stays current. The counter SHALL read "No changes" or "Your changes: N moved" (FR-11, NFR-12, EXPERIENCE Accessibility Floor).

#### Scenario: Move to a column from the keyboard
- **WHEN** the user makes `c` current with the arrow keys, opens "Move to…" from the keyboard and chooses `done`
- **THEN** `c` shows in `done` and is still the current card, and the counter reads "Your changes: 1 moved"

#### Scenario: No current card
- **WHEN** no card is current
- **THEN** "Move to…" is disabled and keeps the focus if it had it

### Requirement: Timeline layout
A Timeline SHALL show its lanes as rows, labelled at the left, under the Gantt's time axis, at the finest of day, week and month zoom at which its span fits the frame. Ranges SHALL be bars and milestones diamonds, each on the first track of its lane where it overlaps nothing, its label after it or inside a range that fits it, and whole in its accessible name (FR-11, DESIGN Timeline).

#### Scenario: Two overlapping ranges
- **WHEN** two ranges in one lane overlap in time
- **THEN** they show on two tracks of that lane, and a third that overlaps neither shares the first track

#### Scenario: A span of a year
- **WHEN** a Timeline's entries span 2026-01-05 to 2026-12-18 in a frame 900 pixels wide
- **THEN** it opens at month zoom

### Requirement: Timeline moves by drag
An entry SHALL move by pointer drag, with no drag library. The horizontal travel SHALL snap to whole days, a range keeping its length and every date staying within the contract's days; the lane under the pointer at the drop SHALL be its lane. Escape SHALL cancel, and nothing SHALL reach the draft before the drop. Moved entries SHALL take the change outline; an entry moved back leaves no change (FR-11, AD-9, AD-10).

#### Scenario: A range dragged a week later and down a lane
- **WHEN** the user drags the range `checkout`, 2026-01-05 to 2026-01-09 in `web`, seven days to the right and onto `mobile`, in Chromium or WebKit
- **THEN** it shows from 2026-01-12 to 2026-01-16 in `mobile` with the change outline, and the draft holds those dates and that lane

#### Scenario: Escape
- **WHEN** the user presses Escape during a drag
- **THEN** the entry is back where it was and the draft is unchanged

### Requirement: Timeline at the keyboard
A Timeline's entries SHALL be one Tab stop whose Up and Down keys move the current entry, lane by lane and by date, and Home and End to the first and last. Its toolbar SHALL be another: "Move earlier" and "Move later", by one day at day zoom and seven days at week and month zoom, "Move to lane…", a menu of the other lanes, and the counter; a move SHALL keep the entry current, and a tool that cannot act SHALL be disabled without losing focus (FR-11, NFR-12, EXPERIENCE Accessibility Floor).

#### Scenario: A milestone a week later
- **WHEN** the user makes the milestone `launch` current on a Timeline at week zoom and presses "Move later" from the keyboard
- **THEN** its date is seven days later, it is still current, and the counter reads "Your changes: 1 moved"

#### Scenario: One lane
- **WHEN** a Timeline has a single lane
- **THEN** "Move to lane…" is disabled

### Requirement: LaTeX, Kanban and Timeline read-only
An answered question's, a locked question's and an opened Snapshot's LaTeX, Kanban and Timeline SHALL show the shown value disabled: the expression read-only with its preview, the cards in their columns, the entries in place, each with its change highlight, and nothing SHALL be editable or movable (AD-15, AD-20).

#### Scenario: A Snapshot of an answered board
- **WHEN** a Snapshot is opened of a board answered with an edited expression, a moved card and a moved range
- **THEN** each widget shows the answer's value read-only, with KaTeX's fonts inline, and nothing can be typed, dragged or moved

### Requirement: The Approval summary of a whole-field change
The Approval summary SHALL word a change to a whole field of an item, such as a LaTeX expression, as one line naming the item's widget and the field, with the previous and new values (FR-11, F-04).

#### Scenario: A LaTeX item beside an Approval
- **WHEN** the user edits the expression of a LaTeX item in a question that holds an Approval
- **THEN** the summary is titled "1 change" and its line names the LaTeX item's `expression`, the agent's expression struck through before the new one

### Requirement: The Gantt on the shared time axis
The Gantt's dates, time scale, axis and pointer drag SHALL be the widgets' shared code that the Timeline uses too, and the Gantt SHALL behave as before (FR-11, AD-9).

#### Scenario: The Gantt's scenarios
- **WHEN** the Gantt's unit tests and its drag and axis browser scenarios run in Chromium and WebKit
- **THEN** they pass with the counts they had before the move

### Requirement: LaTeX, Kanban and Timeline strings
Every string the LaTeX, the Kanban and the Timeline show SHALL come from the view's string tables in en-US and it-IT, and an Italian board SHALL show them in Italian, dates in the ask's locale (FR-34, EXPERIENCE Voice and Tone).

#### Scenario: An Italian board
- **WHEN** a board in it-IT holds the three widgets
- **THEN** it shows "Sorgente LaTeX", "Sposta in…", "Sposta dopo" and "Sposta nella corsia…", and no English chrome

### Requirement: LaTeX, Kanban and Timeline end to end
An edit of a LaTeX, Kanban or Timeline item SHALL reach the agent through `collect` and push delivery as the answer event's `changes`, be returned whole by `fetch`, and be kept in the draft mirror across a reload, on the session process (FR-18, FR-20, AD-20).

#### Scenario: Collected and pushed
- **WHEN** the user answers a question holding an edited expression, a moved card and a moved range on the real board
- **THEN** `collect`, and the mod where it runs, deliver one answer event whose `changes` hold the three items' `set`s

#### Scenario: Held across a reload
- **WHEN** the user moves a card without answering and reloads the tab
- **THEN** the card shows in its new column and the leave-page prompt is armed
