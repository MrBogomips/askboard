## ADDED Requirements

### Requirement: Table items
The registry SHALL hold the type `table`, appended after `pick-field`, the last type of the base it is built on, whose props are `columns` (1 to 10), `rows` (0 to 200), an optional `label` (1 to 200 code points) and an optional `fixedRows: true`, and nothing else. Its problems SHALL name the item and the field through the type's wording (FR-11, AD-7).

#### Scenario: A Table of roles
- **WHEN** an ask holds a `table` item `costs` labelled "Roles", whose columns are `role` (text), `days` (number, `min` 0, `total: "sum"`), `rate` (money, `currency` "USD") and `amount` (money, `currency` "USD", `formula` "[@days] * [@rate]", `total: "sum"`), and whose rows are `pm` (Project manager, 18, "1040.00") and `dev` (Developer, 72, "720.00")
- **THEN** it validates

#### Scenario: Too many columns or rows
- **WHEN** a Table holds 11 columns, or 201 rows
- **THEN** the ask is refused, naming the item and `columns` or `rows`; 10 columns and 200 rows pass

#### Scenario: An unknown key
- **WHEN** a Table's props carry `sort`
- **THEN** the ask is refused, naming the item and `sort`

### Requirement: Table columns
A column SHALL hold a `field` (a lower-case letter, then letters and digits, at most 64, never `id`, unique in the item), a `label` (1 to 200 code points) and a `type` among `text`, `number`, `money`, `date` and `toggle`, with only its input atom's bounds: `maxLength` (at most 500); `min`, `max`, `step`, `integer`, `unit`; a required `currency`, `min`, `max`; `min`, `max`; none (FR-11, FR-13, AD-7).

#### Scenario: A money column without a currency
- **WHEN** a Table's money column has no `currency`
- **THEN** the ask is refused, naming the item and the column's `currency`

#### Scenario: A bound of another type
- **WHEN** a text column carries `step`, or a number column carries `currency`
- **THEN** the ask is refused, naming the item and that key

#### Scenario: Bounds checked as the atom checks them
- **WHEN** a number column has `min` 10 and `max` 5, or a money column in "JPY" has `min` "0.5"
- **THEN** the ask is refused with the problem the NumberField or the MoneyField gives for the same props, naming the column

#### Scenario: Field names
- **WHEN** a column's `field` is `constructor`, `toString` or `a1`
- **THEN** it validates; `id`, `Rate`, `A1` and a field used twice are refused

### Requirement: Formula and total columns
A column MAY hold a `formula` (1 to 500 characters) only when its type is `number`, `money` or `date`; it is then computed and read-only. A `number` or `money` column MAY hold `total: "sum"`. A formula's own problems (syntax, references, cycles) SHALL NOT refuse the ask: they are warnings (FR-14, AD-13).

#### Scenario: A formula on a text column
- **WHEN** a text or toggle column carries a `formula`
- **THEN** the ask is refused, naming the column's `formula`

#### Scenario: A total on a date column
- **WHEN** a date column carries `total: "sum"`
- **THEN** the ask is refused, naming the column's `total`

#### Scenario: A formula too long
- **WHEN** a column's `formula` holds 501 characters
- **THEN** the ask is refused, naming the column's `formula`; 500 pass

#### Scenario: A formula that does not parse
- **WHEN** a column's `formula` is `[@days] *`
- **THEN** the ask is created, with a warning for the column

### Requirement: One check for a Table's cells
Each row SHALL hold an `id`, unique in the item, and, per input column, a value of its type within the column's bounds, checked by the input atom's own result check, or no key when empty; a formula column's field never. One check SHALL serve the agent's props, the edited value in `ask-core` and the board's cell reader (AD-10, NFR-10).

#### Scenario: A rate below its minimum
- **WHEN** a row's money cell `rate` holds "-5.00" and its column's `min` is "0"
- **THEN** the ask is refused, naming the item, the row and `rate`

#### Scenario: Decimals past the currency's minor units
- **WHEN** a row's money cell in a "JPY" column holds "1200.5"
- **THEN** the ask is refused, naming the row and the field

#### Scenario: A computed field in a row
- **WHEN** a row holds `amount`, the field of a formula column
- **THEN** the ask is refused, naming the row and `amount`

#### Scenario: Row IDs
- **WHEN** a row's ID is `__proto__`, or two rows share an ID, or a row's ID is `u-1`
- **THEN** the first validates; the second is refused, naming the ID; the third is refused in the agent's props and accepted in a user's edited value

#### Scenario: The same verdict everywhere
- **WHEN** the same cell value is checked for the agent's props, for an edited value and by the board's cell reader
- **THEN** all three give the same verdict

### Requirement: Table changes
A Table SHALL be edited as a flat list of rows keyed by ID: its `changes` SHALL be `add` of a row with its fields, `remove` of a row and `set` of an input column's field (`item.row.field`, `null` when emptied), and nothing else; its changes schema is `urn:askboard:output:table-changes`. An edited value whose columns, `label` or `fixedRows` differ from the revision's SHALL be refused (AD-20).

#### Scenario: A lowered rate and an added row
- **WHEN** the edited `costs` holds `pm`'s rate "960.00" and a row `u-1` after `dev`
- **THEN** its changes are a `set` of `costs.pm.rate` to "960.00" and an `add` of `costs.u-1` after `dev` with its fields

#### Scenario: A move or a computed field
- **WHEN** an answer's Table changes hold a `move`, or its edited value holds `costs.pm.amount` in a row
- **THEN** the `move` falls outside the Table's changes and the value fails the rows' check, and the answer is refused, appending nothing

### Requirement: Table derived values
A Table SHALL declare as derived each total, `item.field`, and each formula column's field of every row of the value, `item.row.field`. An answer naming its question's current revision SHALL carry as derived values every total and the formula cells of added rows and of rows whose value differs from the board as sent, never one in error, each at the type's precision (FR-12, FR-20); one naming an earlier revision carries none (keep-mine-shown-revision).

#### Scenario: Declared addresses
- **WHEN** an answer's derived values name `costs.amount`, `costs.pm.amount` and `costs.u-1.amount` for an edited value holding `u-1`
- **THEN** they are accepted; `costs.pm.rate` and `costs.days.x` are refused as fields the type does not declare

#### Scenario: Only what moved
- **WHEN** the user lowers `pm`'s rate to "960.00" in the Table of roles and answers
- **THEN** the derived values are `costs.days` 90, `costs.amount` "69120.00" and `costs.pm.amount` "17280.00", and no value of `dev`

#### Scenario: An answer naming an earlier revision
- **WHEN** the user keeps work on a Table through "Keep mine" after the agent changed the question, and answers, the answer naming the kept revision
- **THEN** the answer carries no derived value of the Table

### Requirement: Money derived values within the amount bound
A money value a Table's formula gives, a formula cell or a total, whose rounded value has more than 15 integer digits SHALL be no value: an answer's derived values SHALL leave it out, as one in error, and no derived value SHALL be written with an exponent (AD-7, AD-10, NFR-10).

#### Scenario: Money past the bound
- **WHEN** a Table's money column `rate` holds "999999999999999.99", a number column `days` holds 1000000000000000, and its money formula column `amount` is `[@rate] * [@days]` with `total: "sum"`
- **THEN** the answer's derived values hold neither the row's `amount` nor the `amount` total, and no derived value of the answer is written with an exponent

### Requirement: Cell entries in the draft record
A question of the draft record MAY hold `cellEntries`: by item ID, by cell (`row.field`), the text the cell holds that gives no value, 1 to 200 characters, at most 2,000 per item. Its item keys SHALL name items of the question; cell entries are unsent work and SHALL never be part of an answer (AD-20).

#### Scenario: A cell entry
- **WHEN** a draft record's question holds `cellEntries: {costs: {"pm.rate": "12,5"}}`
- **THEN** it validates

#### Scenario: Malformed cell entries
- **WHEN** a cell entry's text holds 201 characters, its cell key is `pm.rate.x` or `pm`, or its item key names no item of the question
- **THEN** the record is refused, naming the path

### Requirement: The Table's teaching text
The Table's entry SHALL carry a use within the skill's budget for a use (200 characters) and notes of at most 300 each, naming the column types and their bounds, `[@field]`, single reads in a column formula, totals read as `[item.field]`, `fixedRows`, and that the answer gives the changes and the derived values. Its example SHALL validate (FR-29, AD-6).

#### Scenario: The generated skill
- **WHEN** `bun run build:skills` runs with the Table registered
- **THEN** the item catalogue `references/items.md` holds the Table's line, `SKILL.md` links the Table's reference and stays within 9,000 characters, and the Table's reference holds an example that validates

### Requirement: The Table in the sets' next minors
The input format, the output format, the tool envelopes and the board document SHALL admit the Table at their next minor after `main`'s, a question's items and a layout's included; the board protocol SHALL admit cell entries at its next minor. Documents of each previous minor SHALL still validate (AD-7).

#### Scenario: A Table in a Group
- **WHEN** an ask holds the Table of roles inside a Group inside a question
- **THEN** it validates, and the board document and a `fetch` result holding it validate

#### Scenario: The previous minor
- **WHEN** a draft record or an ask of the previous minor, holding no Table and no cell entry, is validated
- **THEN** it validates
