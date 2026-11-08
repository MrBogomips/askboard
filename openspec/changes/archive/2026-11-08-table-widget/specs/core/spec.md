## ADDED Requirements

### Requirement: Table answers through ask-core
`ask-core` SHALL take a Table's edited value only when every cell passes the contract's cell check against the revision's columns, and SHALL compute its `changes` with the rows' shape; it SHALL refuse an answer whose Table value fails, whose columns differ, or whose derived values name a field the Table does not declare, appending and publishing nothing (AD-10, AD-20, NFR-10).

#### Scenario: A lowered rate answered
- **WHEN** the user answers the Table of roles with `pm`'s rate "960.00" and the derived values the board gives
- **THEN** the answer event's `changes` are one `set` of `costs.pm.rate`, its derived values are those the board sent, and `fetch` of `costs` returns the edited rows

#### Scenario: A cell out of bounds
- **WHEN** an answer's Table value holds `days` -1 in a column whose `min` is 0
- **THEN** the answer is refused, naming the item, the row and `days`; nothing is appended or published

#### Scenario: Columns changed
- **WHEN** an answer's Table value drops the `rate` column
- **THEN** the answer is refused, naming the item

#### Scenario: An untouched Table beside a choice
- **WHEN** a question holding options and the Table of roles is answered with a choice and no Table value
- **THEN** the answer event holds no change of `costs`, and its derived values hold the Table's totals

### Requirement: A Table's send-time warnings
When an ask or an update holds a Table, at any depth of its question's layouts, `ask-core` SHALL return each graph problem of its formulas as a `formula` warning naming the item, one per column formula and kind, and SHALL never refuse the request for one (AD-13, FR-14).

#### Scenario: A misspelt field in a Group
- **WHEN** an ask holds, inside a Group, a Table of 200 rows whose `amount` formula reads `[@rte]`
- **THEN** the ask is created, and its result holds one warning naming `costs` and `costs.*.amount`

### Requirement: Cell entries stay in the draft
`ask-core` SHALL hold a question's cell entries with its draft record, apart from the log, restore them to a reconnecting or taking-over board, and never expose them to `collect`, `fetch`, Snapshots, the mod or the local API (AD-20).

#### Scenario: A cell entry across a reconnection
- **WHEN** the board mirrors a draft holding the cell entry "12,5" for `costs` `pm.rate`, then reconnects
- **THEN** the restored draft holds it, and no `collect`, `fetch` or Snapshot result contains "12,5"
