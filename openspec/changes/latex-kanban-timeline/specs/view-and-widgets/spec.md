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

### Requirement: LaTeX source limit
The LaTeX source field SHALL hold at most 2,000 characters, counted in code points as the contract counts them, so the board never offers an expression the contract refuses (FR-11, AD-10).

#### Scenario: A paste over the limit
- **WHEN** the user pastes text that would make the expression 2,001 characters, each outside the Basic Multilingual Plane
- **THEN** the field keeps the first 2,000 and the draft holds them

### Requirement: LaTeX parse errors
While the expression does not parse, the board SHALL show KaTeX's message under the source field as a field error, as text with its bidirectional controls shown as visible escapes, and keep the last preview that rendered; an expression that never rendered SHALL leave the preview empty. A parse error SHALL NOT block "Answer": the answer carries the expression as written (FR-11, EXPERIENCE Answer).

#### Scenario: An unclosed brace
- **WHEN** the user types `\frac{1}{` in the source field
- **THEN** the field error gives KaTeX's message, the preview still shows the last expression that rendered, and "Answer" stays enabled

#### Scenario: The agent's expression does not parse
- **WHEN** the agent sends `\frac{1}{`
- **THEN** the field error shows, the preview is empty, and the item counts as ready

#### Scenario: A failure with no message
- **WHEN** rendering fails with a thrown value that carries no message
- **THEN** the field error shows the string tables' fixed text, "The expression could not be drawn." in en-US, and the last preview stays

### Requirement: LaTeX untrusted commands
The LaTeX preview SHALL render agent and user text as data: no command SHALL make a link, an image, a class, an ID, a style attribute or a request, a macro defined in one render SHALL NOT exist in the next, and macro expansion SHALL be bounded (AD-8, NFR-5, NFR-9).

#### Scenario: A link and an image
- **WHEN** the expression holds `\href{https://example.com}{x}` and `\includegraphics{https://example.com/a.png}`
- **THEN** the preview holds no link and no image, and the board makes no request

#### Scenario: A macro does not outlive its render
- **WHEN** the user types `\gdef\foo{1}` in one LaTeX item and `\foo` in another
- **THEN** the first shows the field error naming `\gdef` and renders nothing new, and the second shows a parse error naming `\foo`

### Requirement: LaTeX bounded work
An expression the contract's LaTeX check refuses SHALL NOT render: one holding a macro definition or a KaTeX internal command SHALL show a field error naming the command, and one nested past the limit a field error naming its depth and the limit, the preview keeping its last render. Every expression of at most 2,000 code points SHALL render or show a field error within 2 seconds in Chromium and WebKit, the board responding (AD-8, NFR-5).

#### Scenario: A macro definition
- **WHEN** the user types `\def\a{\a}\a`, or `\def\b{` and 900 `x` then `}\def\a{` and `\b` 540 times then `}\a`
- **THEN** the field error names `\def` within 2 seconds, KaTeX does not run, the preview keeps its last render, and the board keeps responding

#### Scenario: An internal command
- **WHEN** the user types `\color{` and 900 `x` then `}` and `\current@color` 78 times
- **THEN** the field error names `\current@color` within 2 seconds, KaTeX does not run, and the preview keeps its last render

#### Scenario: Nests at and past the limit
- **WHEN** the expression nests `\frac` or `\dfrac` numerators, `{` with `\over x}`, `x^{`, `\sqrt{` or `\boxed{` to the nesting limit, alone or repeated side by side to 2,000 code points, then one level past the limit
- **THEN** at the limit the preview renders within 2 seconds in Chromium and WebKit with the board responding, and past it the field error names the depth and the limit, KaTeX does not run, and the preview keeps its last render

#### Scenario: Nests the scan once missed
- **WHEN** the user types `\frac{` with `\over y}{x}` nested 11 times, or ``\char` {`` 130 times, then `x`, then `\over}` 130 times
- **THEN** within 2 seconds the field error names the depth and the limit for the first and the command ``\char` `` for the second, KaTeX does not run, and Chromium's renderer does not crash

### Requirement: LaTeX output bounded
Before any node of a preview reaches the page, the board SHALL measure the depth, the node count and the most fractions nested on one path of the output KaTeX builds for the expression. An output past the board's bounds SHALL NOT render: its field error SHALL say the expression is too complex to preview, in the editable item, the read-only item and a Snapshot alike, the preview keeping its last render and "Answer" staying enabled (AD-8, NFR-5).

#### Scenario: Too complex to preview
- **WHEN** an expression the contract's check passes has a KaTeX output deeper, larger or with more nested fractions than the board's bounds, typed by the user or sent by the agent
- **THEN** no node of it reaches the page, the field error says the expression is too complex to preview, the preview keeps its last render or stays empty, "Answer" stays enabled, and the read-only item and a Snapshot of the answer show the source with the same field error

#### Scenario: Nested fractions past the fraction bound
- **WHEN** the board's fraction bound is 3 and its depth and node bounds are not reached, and the expression is `\frac{\frac{\frac{\frac{a}{b}}{c}}{d}}{e}`, then the same with one fraction fewer, then four fractions side by side
- **THEN** the first is too complex to preview and inserts no node, and the other two render

#### Scenario: A preview that would grow past its box
- **WHEN** a LaTeX item's expression is `\raisebox{-1000000em}{X}`, sent by the agent or typed by the user
- **THEN** the preview stays within 400 px high, scrolling inside, and the controls under it stay where they are on a board whose expression is at KaTeX's largest size

### Requirement: LaTeX previews one at a time
A board SHALL draw its LaTeX previews one per task, in the order they are asked for, an item's newest expression replacing its pending draw and a draw asked for after the user's edit going before draws still pending, so that the board answers input between draws (AD-8, NFR-5).

#### Scenario: Ten LaTeX items
- **WHEN** a question holds ten LaTeX items, each the slowest expression the measurement found within the scan's limit (`\cfrac` or `\dfrac` side by side at the limit), and the user types in the last item's field while the previews draw
- **THEN** every preview draws, each key press is answered within 2 seconds, and the last item's preview or field error shows within 2 seconds of the input, in Chromium and WebKit

### Requirement: Package stylesheets in a chunk
A component chunk MAY carry a package's stylesheet. The build SHALL inline its woff2 fonts as `data:` URLs, drop its other font formats, and list the stylesheet's package among the chunk's licence notices (AD-8, AD-9, NFR-6).

#### Scenario: KaTeX's fonts
- **WHEN** a board holding a LaTeX item opens in Chromium or WebKit
- **THEN** the preview uses KaTeX's fonts, no font is requested, and no CSP violation is logged

#### Scenario: A stylesheet from a package the script does not import
- **WHEN** a chunk lists a package's stylesheet and its script imports nothing from that package
- **THEN** the chunk's licence notices hold that package's notice

### Requirement: No URL in a chunk's styles
The build SHALL parse every chunk's styles and the board page's as CSS, and SHALL fail on styles it cannot parse, on an `@import`, on any URL other than a woff2 `data:` URL in the source of a `@font-face` rule, URLs in `image-set()` and escaped forms included, and on any substitution that could put one there, so that no chunk loads a file from anywhere (AD-8, NFR-9).

#### Scenario: Substitutions that could request a file
- **WHEN** a chunk's styles hold a `var()`, an `env()` or a custom function (`--name()`) inside `image-set()`, `-webkit-image-set()` or a cursor list, or an `@function` rule anywhere
- **THEN** the build fails naming the chunk

#### Scenario: A stylesheet that names a file
- **WHEN** a chunk's package stylesheet holds `url(fonts/a.svg)` or `@import "b.css"`
- **THEN** the build fails, naming the chunk and the URL or the import

#### Scenario: Escaped and string URLs
- **WHEN** a chunk's styles hold `u\72l(http://h/x.png)`, `\75rl(http://h/x.png)`, `@\69mport "http://h/b.css"` or `image-set("http://h/x.png" 1x)`
- **THEN** the build fails, naming the chunk

#### Scenario: A function whose name ends in url
- **WHEN** a chunk's styles hold `#a{--v:xurl(data:a ")")}#b{background-image:image-set("http://h/x.png" 1x)}`
- **THEN** the build fails, naming the chunk and `http://h/x.png`

#### Scenario: A value substituted into image-set
- **WHEN** a chunk's styles hold `#a{--a:"http://h/var.png";background-image:image-set(var(--a) 1x)}`, the same with `-webkit-image-set`, or `a{cursor:image-set(env(x) 1x),auto}`
- **THEN** the build fails, naming the chunk

#### Scenario: A data URL outside a font face
- **WHEN** a chunk's styles hold `a{background:url(data:image/png;base64,AAAA)}`
- **THEN** the build fails, naming the chunk

#### Scenario: Styles that do not parse
- **WHEN** a chunk's styles hold `a{background:url(http://h/x y.png)}`
- **THEN** the build fails, naming the chunk and the parser's message

#### Scenario: A chunk's own styles and the board page's
- **WHEN** a chunk's own styles, or the board page's, hold `url(x.png)`
- **THEN** the build fails, naming the chunk or the board page

### Requirement: Font licences in a chunk's notices
Fonts a chunk inlines SHALL be the package's font files unmodified, and the chunk's licence notices SHALL carry the fonts' own licence text when it differs from the package's, with the fonts' copyright and Reserved Font Name lines, wherever the chunk carries those fonts or package code holding glyph outlines derived from them. The build SHALL fail when a chunk inlines fonts whose licence is not recorded (NFR-6, AD-19, PRD addendum, Adoption rule, as amended by this change).

#### Scenario: KaTeX's font licence
- **WHEN** the view is built with a chunk carrying KaTeX's stylesheet
- **THEN** that chunk's notice for `katex` names `MIT AND OFL-1.1` and its text holds KaTeX's MIT licence, the fonts' copyright lines, their Reserved Font Names and the full SIL Open Font License 1.1, and every inlined font decodes to the bytes of its woff2 file in the package

#### Scenario: Fonts with no recorded licence
- **WHEN** a chunk inlines the fonts of a package version that has no font licence entry, or an entry names a package version whose fonts and derived files no chunk carries
- **THEN** the build fails, naming the package version

#### Scenario: KaTeX's script without its stylesheet
- **WHEN** a chunk bundles KaTeX's script, whose glyph outlines derive from KaTeX's fonts, and lists no KaTeX stylesheet
- **THEN** that chunk's notice for `katex` names `MIT AND OFL-1.1` and holds the same text as with the stylesheet

### Requirement: An answer sends what its widgets show
A Kanban's or a Timeline's value in the draft SHALL be one the item can show on the revision the card shows, so that the answer sends what the item shows. "Keep mine" SHALL drop such a value when the card shows a revision other than the one the work was made on, or one that cannot show it; the item then shows the agent's props as untouched. The user's moves SHALL be counted against the revision they were made on, never counting the agent's own changes (AD-10, AD-20, NFR-10).

#### Scenario: Keeping a Kanban move across a reload and an agent's change
- **WHEN** the user moves card `a` to Doing, the agent changes the Kanban, the tab reloads, the user keeps their draft and presses "Answer"
- **THEN** the Kanban shows "No changes" and the answer sends nothing for it, since the page no longer holds the revision the move was made on; without a reload, the move is kept and sent

#### Scenario: The agent's own move is not the user's
- **WHEN** the agent moves card `b` to Doing while the user's draft holds a move of card `a`, on a page that saw both revisions, and the user keeps their draft
- **THEN** the Kanban counts only the user's move of `a`, `b` is not marked as the user's, and the answer sends the move of `a`

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

#### Scenario: A milestone on the first day
- **WHEN** a Timeline's earliest date is a milestone's, at month zoom
- **THEN** its diamond draws whole, inside the chart's left edge

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
