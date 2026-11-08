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
Enter, F2 or a double-click SHALL open an editor on the current input cell other than an on/off cell; the text SHALL be read by the input atom's parser in the ask's locale, its parsed value echoed while the editor is open; Enter or leaving SHALL commit a value into the draft, an empty text emptying the cell, and an unchanged text nothing; Escape SHALL restore the cell (AD-9, AD-10).

#### Scenario: A rate typed in Italian
- **WHEN** on an it-IT ask the user opens `pm`'s rate, types "960,00" and presses Enter
- **THEN** the editor shows "= 960,00 USD" while open, the cell reads "$ 960,00" after, and the draft holds `pm`'s rate "960.00"

#### Scenario: Escape
- **WHEN** the user types "500" in `dev`'s days and presses Escape
- **THEN** the cell reads 72, and the draft is unchanged

#### Scenario: A formula cell
- **WHEN** the user presses Enter on `pm`'s amount
- **THEN** no editor opens

### Requirement: An editor across the agent's change
An open cell editor SHALL close without committing when the agent's change alters its cell's column, row or value, and SHALL not reopen on its own (AD-10, NFR-10).

#### Scenario: The agent changes the cell being edited
- **WHEN** the user has opened the editor on `pm`'s rate without typing, and the agent's update sets that rate to 1,200
- **THEN** the editor closes without committing, the cell reads the agent's rate, and the counter reads no change

### Requirement: On/off cells
An on/off cell SHALL have no editor and hold no cell entry: Space, Enter, F2 or a click SHALL switch it, not set or off to on and on to off, and Delete or Backspace SHALL return it to not set (AD-9, AD-10).

#### Scenario: An on/off cell
- **WHEN** a Table has a toggle column `billable`, and on `pm`'s cell, not set, the user presses Enter, then clicks the cell, then presses Delete
- **THEN** no editor opens, the cell reads "On", then "Off", then "Not set", the draft's `pm` row ends with no `billable`, and no cell entry is held

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

### Requirement: A refused column's error shows once
The cells and totals of columns that read a refused column SHALL read "—" with no row or total error whose origin is that column; an error of their own SHALL still show under its row or the Total row (AD-13, FR-14).

#### Scenario: A column reading a refused column
- **WHEN** `amount` reads `[@rte]` and a column `perDay` is `[@amount] / [@days]`, with no day at 0
- **THEN** one field error over the grid names "Amount", every amount and per-day cell reads "—", and no error shows under any row or the Total row

### Requirement: Money past the bound on the board
A money value a formula gives past 15 integer digits SHALL show as "—" with an error of the kind `value`, under its row or the Total row, and SHALL not disable "Answer" (AD-10, AD-13).

#### Scenario: Money past the bound
- **WHEN** a money formula cell would hold 1e30 (a rate of "999999999999999.99" times 1000000000000000 days)
- **THEN** the cell reads "—" with a field error under its row naming the column, the column's total reads "—" with its error under the Total row, and "Answer" stays enabled

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
In the grid, the arrow keys SHALL move the current cell, Home and End to its row's first and last cell; on an on/off cell Space, Enter or F2 SHALL switch it and Delete or Backspace return it to not set; the current cell SHALL be marked and focused visibly. The toolbar SHALL be its own Tab stop. Every edit, row added or deleted SHALL be reachable from the keyboard (NFR-12).

#### Scenario: Editing without a pointer
- **WHEN** the user tabs into the grid, current on `pm`'s role, presses Down, Right twice and Enter, types "16" and presses Enter
- **THEN** the editor opened on `dev`'s rate, and the draft holds `dev`'s rate "16.00"

#### Scenario: An on/off cell without a pointer
- **WHEN** on a Table with a toggle column `billable` the user moves to `dev`'s cell, not set, presses F2, then Space, then Backspace
- **THEN** the cell reads "On", then "Off", then "Not set", and no editor opened

### Requirement: A Table read-only and in Snapshots
An answered, locked or Snapshot Table SHALL show its rows, totals and formula cells with their marks, open no editor, switch no toggle and show no toolbar actions, and SHALL stay readable from the keyboard (AD-9, AD-15).

#### Scenario: A Snapshot from a file
- **WHEN** the Snapshot of an answered Table of roles is opened from `file://`
- **THEN** it shows `pm`'s rate "$960.00" with the change highlight, the totals of the edited rows, and makes no request

### Requirement: An agent's change to a Table
On "Keep mine", the shell SHALL keep a Table's draft and its cell entries on the revision the work was made on, and SHALL drop both when the card shows a revision other than that one, as after a reload, or one that cannot show the draft; the Table then shows the agent's props untouched. "Reload" drops both (FR-6, AD-10, AD-20).

#### Scenario: The agent drops a column
- **WHEN** the user has lowered `pm`'s rate, the agent's update removes the `rate` column, the tab reloads, and the user chooses "Keep mine"
- **THEN** the Table shows the agent's new revision, untouched, and its draft and cell entries are gone; without a reload, the lowered rate is kept on the revision it was made on

### Requirement: Agent and user text wraps in a Table
The caption, every header and every text cell SHALL wrap a word of 200 characters with no space inside the widget frame at DESIGN's 1,280-pixel floor; a grid wider than the frame SHALL scroll inside it, never widening the board (DESIGN Wide widgets, NFR-12).

#### Scenario: Long words
- **WHEN** a Table's label, a header and a text cell each hold 200 characters with no space, on a board 1,280 pixels wide
- **THEN** each wraps inside the frame, and the board has no horizontal scroll

### Requirement: Table strings
Every string the Table shows SHALL come from the view's tables in en-US and it-IT: the toolbar, the counter, the computed mark, the cell and row names, the field errors (a text cell over its limit by the Table's own string, never another widget's), the refusals and the hint (FR-34).

#### Scenario: An Italian board
- **WHEN** an it-IT ask shows a Table, the user adds a row and types 501 characters in its role
- **THEN** the toolbar reads "Aggiungi riga" and "Elimina riga", the cell's error reads "Una cella di testo contiene al massimo 500 caratteri.", and no English string of the Table shows in its text, accessible names or titles

### Requirement: A Table at its bounds on the board
A Table at its bounds SHALL become visible, and take a cell edit and a row added, within the gates of design decision 13 in WebKit, cold (NFR-12, AD-13).

#### Scenario: The worst form in WebKit
- **WHEN** a board holding the worst Table the bounds admit opens in a fresh WebKit page, the user edits one input cell, then adds a row
- **THEN** each step is within its gate, and the figures are recorded

#### Scenario: The fan-out form in WebKit
- **WHEN** a board holding a 200-row Table whose every formula reads a total opens in a fresh WebKit page and the user edits one input cell
- **THEN** the edit is painted within the fan-out form's gate, and the figures are recorded
