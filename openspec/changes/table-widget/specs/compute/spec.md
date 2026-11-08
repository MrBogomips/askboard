## ADDED Requirements

### Requirement: Row references
In a formula on a child's field, `[@field]` SHALL read that field of the same child, as Excel's this-row reference; in any other formula it SHALL read as `missing-reference`. A `[@…]` whose name is no field name SHALL read as `syntax`. A problem's detail SHALL quote the reference as written (AD-13).

#### Scenario: A row's amount
- **WHEN** row `pm` of item `costs` holds `days` 18 and `rate` "1040.00", and its `amount` is `[@days] * [@rate]`
- **THEN** `costs.pm.amount` reads 18720

#### Scenario: Outside a row
- **WHEN** an item's own field holds the formula `[@days] * 2`
- **THEN** the node reads as `missing-reference`, the detail quoting `[@days]`

#### Scenario: A cell name
- **WHEN** a column formula reads `[@A1]` or `[@]`
- **THEN** each row's node reads as `syntax`

### Requirement: Column formulas
A `fields` item MAY declare column formulas: each top-level child SHALL get a node `item.child.field` holding the column's formula, after its own fields. A child that holds a column's field itself SHALL make the source malformed. A formula text SHALL be parsed once per build, however many nodes hold it (AD-13).

#### Scenario: Every row gets the column
- **WHEN** an item with rows `pm` and `dev` declares the column formula `amount` as `[@days] * [@rate]`
- **THEN** the graph holds `costs.pm.amount` and `costs.dev.amount`, each reading its own row

#### Scenario: A row holding the column's field
- **WHEN** row `pm` also holds its own `amount`
- **THEN** the graph is refused with a source error naming the item, the row and `amount`

### Requirement: Column formulas read single fields
A column formula SHALL read single nodes only: one that holds a wildcard or a range SHALL read as `over-limit` at every row, whatever else it holds (AD-13).

#### Scenario: A share of the total
- **WHEN** a column formula reads `[@amount] / [costs.amount]`, `[costs.amount]` being a total
- **THEN** each row reads its share

#### Scenario: A wildcard in a column formula
- **WHEN** a column formula reads `[@amount] / SUM([costs.*.amount])`
- **THEN** every row's node reads as `over-limit`

### Requirement: One warning per column
The problems found at a column formula's nodes that share their kind and detail SHALL be one warning, addressed `item.*.field`; every row's node SHALL still read as the error (AD-6, AD-13, NFR-1).

#### Scenario: A formula that does not parse, over 200 rows
- **WHEN** a column formula of 200 rows is `[@days] *`
- **THEN** the build gives one `syntax` warning addressed `costs.*.amount`, and each of the 200 nodes reads as `syntax`

#### Scenario: A misspelt field
- **WHEN** a column formula is `[@days] * [@rte]`
- **THEN** the build gives one `missing-reference` warning addressed `costs.*.amount` whose detail quotes `[@rte]`

### Requirement: The Table's graph source
A `table` item SHALL map to a `fields` item: every input column of every row an input node of the column's type, `null` when empty, a money node in the column's currency; each formula column a column formula, money in its currency; each total column a node `item.field` summing that field over the rows (AD-13, FR-12).

#### Scenario: Totals of the roles
- **WHEN** the Table of roles (`pm` 18 days at "1040.00", `dev` 72 days at "720.00") is built and evaluated
- **THEN** `costs.amount` reads 70560 in USD and `costs.days` reads 90

#### Scenario: An edited rate
- **WHEN** `costs.pm.rate` is set to "960.00" and the graph recalculates
- **THEN** `costs.pm.amount` reads 17280 and `costs.amount` 69120, and `dev`'s nodes are not evaluated

#### Scenario: An empty cell
- **WHEN** `dev`'s `days` is empty
- **THEN** `costs.dev.amount` reads 0, as Excel reads an empty reference, and `costs.days` sums `pm`'s alone

#### Scenario: Another currency
- **WHEN** a money column in "USD" has the formula `[@days] * [@rateEur]`, `rateEur` being a money column in "EUR"
- **THEN** each row's node reads as `mixed-currencies`, and one warning names the column

#### Scenario: Row IDs that are object names
- **WHEN** a Table's rows are `__proto__` and `constructor` and its fields `constructor` and `toString`
- **THEN** each row's nodes and the totals read as for any other names

### Requirement: A Table at its bounds
The worst Table the bounds admit (200 rows, 10 columns, column formulas of 500 characters each reading its row's other fields) SHALL be built and evaluated, and recalculated after one cell's change, within the gates of design decision 13 on Bun and on Node 24 (AD-13, NFR-12).

#### Scenario: The worst form, cold
- **WHEN** the worst form is built and evaluated in a fresh process, then one input cell changes and the graph recalculates
- **THEN** each step's time is within its gate, and the figures are recorded
