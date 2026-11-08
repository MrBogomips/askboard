## ADDED Requirements

### Requirement: The Table's grid
A Table SHALL show its `label` as a caption, a header row of its columns' labels, a formula column's header marked as computed with its formula as the header's description, one row per row of the value it shows, and a Total row when a column has a total. It SHALL be one Tab stop, ready after its first layout (FR-11, AD-9, NFR-12).

#### Scenario: The Table of roles
- **WHEN** a board shows the Table of roles
- **THEN** it shows the caption "Roles", four headers with "Amount" marked computed, the rows `pm` and `dev`, and a Total row with 90 and "$70,560.00"

#### Scenario: One Tab stop
- **WHEN** the user presses Tab into the Table, then Tab again
- **THEN** the first press focuses the grid on its current cell, and the second leaves it for the Table's toolbar

### Requirement: Typed cells in the ask's locale
A cell SHALL show its value in the ask's locale: a number with its unit and money with its currency at its minor units, as the Value atom shows them; a date in the locale's numeric form (`10/27/2026`, `27/10/2026`); a toggle as on, off or unset. Numbers and money SHALL be right-aligned in the code typography (FR-13, FR-34, AD-13).

#### Scenario: Italian formats
- **WHEN** the Table of roles is shown on an ask whose locale is it-IT
- **THEN** `pm`'s rate reads "$ 1.040,00" and the days total "90", as the it-IT Value shows them

#### Scenario: An unset toggle
- **WHEN** a toggle column's cell is empty
- **THEN** it shows unset, apart from off

### Requirement: Editing a cell
Enter, F2 or a double-click SHALL open an editor on the current input cell; the text SHALL be read by the input atom's parser in the ask's locale, its parsed value echoed while the editor is open; Enter or leaving SHALL commit a value into the draft, an empty text emptying the cell; Escape SHALL restore the cell. Space SHALL switch a toggle cell, unset to on, then off and on (AD-9, AD-10).

#### Scenario: A rate typed in Italian
- **WHEN** on an it-IT ask the user opens `pm`'s rate, types "960,00" and presses Enter
- **THEN** the editor shows "= 960,00 USD" while open, the cell reads "$ 960,00" after, and the draft holds `pm`'s rate "960.00"

#### Scenario: Escape
- **WHEN** the user types "500" in `dev`'s days and presses Escape
- **THEN** the cell reads 72, and the draft is unchanged

#### Scenario: A formula cell
- **WHEN** the user presses Enter on `pm`'s amount
- **THEN** no editor opens

### Requirement: Cell entries block "Answer"
Text a cell cannot read, or whose value breaks its column's bounds, SHALL stay in the cell with its field error as a cell entry: Enter keeps the editor open on it, leaving keeps it in the cell. While any cell holds one, the question's "Answer", "Send and switch" and Submit SHALL be disabled, described "Correct {label} first."; correcting or clearing it releases them (AD-10, AD-20, NFR-10).

#### Scenario: An ambiguous number
- **WHEN** on an en-US ask the user types "1.234,5" in `dev`'s days and leaves the cell
- **THEN** the cell shows "1.234,5" with the parser's field error under its row, the draft keeps 72 as `dev`'s days, and "Answer" is disabled, described "Correct Roles first."

#### Scenario: Out of bounds
- **WHEN** the user types "-1" in `pm`'s days, whose column's `min` is 0
- **THEN** the cell holds the entry with the error "At least 0." as the NumberField words it, and "Answer" is disabled

#### Scenario: Kept across a reload
- **WHEN** the board reloads while `dev`'s days holds the entry "1.234,5"
- **THEN** the cell shows it again with its error, and "Answer" stays disabled until the user corrects or clears it

### Requirement: Cell entries in the draft
The shell SHALL hold each item's cell entries in the draft record, each cut at 200 code points, count them as unsent work, include them in "Copy my unsent work", restore them, and drop an item's cell entries with its value (AD-20).

#### Scenario: Unsent work
- **WHEN** a cell holds an entry and nothing else on the board is unsent
- **THEN** leaving the page asks first, and "Copy my unsent work" on a closed board holds the entry's text with its item, row and column

### Requirement: Adding and deleting rows
Unless the Table has `fixedRows`, its toolbar SHALL offer "Add row", which adds an empty row after the current row (else at the end) with a view-made ID and makes its first input cell current, and "Delete row", which removes the current row. At 200 rows "Add row" SHALL be refused with a message beside the toolbar and in a polite live region (AD-7, AD-10).

#### Scenario: A row added and filled
- **WHEN** the user makes `pm` current, presses "Add row" and types "QA engineer" in its role
- **THEN** a row `u-1` stands after `pm`, the draft's rows are `pm`, `u-1`, `dev`, and the changes hold an `add` of `costs.u-1` after `pm`

#### Scenario: A row deleted
- **WHEN** the user makes `dev` current and presses "Delete row"
- **THEN** `dev` leaves the grid, the totals drop to `pm`'s, and the current row becomes `pm`

#### Scenario: Fixed rows
- **WHEN** a Table has `fixedRows: true`
- **THEN** its toolbar has neither "Add row" nor "Delete row"

### Requirement: Totals and formula columns on the board
Formula cells and totals SHALL read the board's live graph and update within the same interaction as the edit, with no agent; a cell edit SHALL recalculate the graph in place, and adding or deleting a row SHALL rebuild it (FR-12, AD-13).

#### Scenario: A rate lowered
- **WHEN** the user commits `pm`'s rate "960.00"
- **THEN** `pm`'s amount reads "$17,280.00" and the amount total "$69,120.00" within the same interaction

### Requirement: Formula errors on the board
A column formula's problem SHALL show once, over the grid, naming the column and its wording, with its cells reading "—"; an error that depends on a row's values SHALL show under that row, a total's under the Total row. No formula error SHALL disable "Answer" (AD-13, FR-14).

#### Scenario: A misspelt field
- **WHEN** a Table's `amount` formula reads `[@rte]`
- **THEN** one field error over the grid names "Amount", every amount cell reads "—", and "Answer" stays enabled

#### Scenario: A division by zero in one row
- **WHEN** a column `perDay` is `[@amount] / [@days]` and `dev`'s days is 0
- **THEN** a field error under `dev`'s row names "Per day" and the division by zero, and `pm`'s value shows

### Requirement: Changes shown apart
A changed cell SHALL take the change highlight, an added row too; a formula cell or total whose value differs from the board as sent SHALL take the derived mark and is not counted. The toolbar's counter SHALL read "No changes", else "Your changes: N", N counting changed cells, added rows and deleted rows (FR-11, EXPERIENCE Change highlight).

#### Scenario: A lowered rate
- **WHEN** the user lowers `pm`'s rate
- **THEN** that cell takes the change highlight, `pm`'s amount and the amount total take the derived mark, and the counter reads "Your changes: 1"

### Requirement: The Table's answer from the board
"Answer" SHALL send the Table's full edited value when it differs from the agent's, and the Table's derived values by the contract's rule, changed or not; an untouched Table sends no value. A board-made answer SHALL never hold a cell entry (AD-10, AD-20, FR-12).

#### Scenario: Answered after an edit
- **WHEN** the user lowers `pm`'s rate to "960.00" and presses "Answer"
- **THEN** the answer message holds the edited rows and the derived values `costs.days`, `costs.amount` and `costs.pm.amount`, and the Table turns read-only

### Requirement: The Table at the keyboard
In the grid, the arrow keys SHALL move the current cell, Home and End to its row's first and last cell; the current cell SHALL be marked and focused visibly. The toolbar SHALL be its own Tab stop. Every edit, row added or deleted SHALL be reachable from the keyboard (NFR-12).

#### Scenario: Editing without a pointer
- **WHEN** the user tabs into the grid, current on `pm`'s role, presses Down, Right twice and Enter, types "16" and presses Enter
- **THEN** the editor opened on `dev`'s rate, and the draft holds `dev`'s rate "16.00"

### Requirement: A Table read-only and in Snapshots
An answered, locked or Snapshot Table SHALL show its rows, totals and formula cells with their marks, open no editor, switch no toggle and show no toolbar actions, and SHALL stay readable from the keyboard (AD-9, AD-15).

#### Scenario: A Snapshot from a file
- **WHEN** the Snapshot of an answered Table of roles is opened from `file://`
- **THEN** it shows `pm`'s rate "$960.00" with the change highlight, the totals of the edited rows, and makes no request

### Requirement: An agent's change to a Table
On "Keep mine", the shell SHALL keep a Table's draft only while its columns, `label` and `fixedRows` equal the new revision's and every cell passes its check there, else drop it with its cell entries; "Reload" drops both (AD-10, AD-20).

#### Scenario: The agent drops a column
- **WHEN** the user has lowered `pm`'s rate, the agent's update removes the `rate` column, and the user chooses "Keep mine"
- **THEN** the Table shows the agent's new revision, untouched, and its draft is gone

### Requirement: Agent and user text wraps in a Table
The caption, every header and every text cell SHALL wrap a word of 200 characters with no space inside the widget frame at DESIGN's 1,280-pixel floor; a grid wider than the frame SHALL scroll inside it, never widening the board (DESIGN Wide widgets, NFR-12).

#### Scenario: Long words
- **WHEN** a Table's label, a header and a text cell each hold 200 characters with no space, on a board 1,280 pixels wide
- **THEN** each wraps inside the frame, and the board has no horizontal scroll

### Requirement: Table strings
Every string the Table shows SHALL come from the view's tables in en-US and it-IT: the toolbar, the counter, the computed mark, the cell and row names, the field errors, the refusals and the hint (FR-34).

#### Scenario: An Italian board
- **WHEN** an it-IT ask shows a Table and the user adds a row
- **THEN** the toolbar reads "Aggiungi riga" and "Elimina riga", and no English string of the Table shows in its text, accessible names or titles

### Requirement: A Table at its bounds on the board
A Table at its bounds SHALL become visible, and take a cell edit and a row added, within the gates of design decision 13 in WebKit, cold (NFR-12, AD-13).

#### Scenario: The worst form in WebKit
- **WHEN** a board holding the worst Table the bounds admit opens in a fresh WebKit page, the user edits one input cell, then adds a row
- **THEN** each step is within its gate, and the figures are recorded
