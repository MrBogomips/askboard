## ADDED Requirements

### Requirement: Atom types in the registry
The registry SHALL hold the FR-13 atoms as widget types, appended in order: the display atoms `text`, `value` and `divider`, with neither edits nor a result, then the input atoms `text-field`, `number-field`, `money-field`, `date-field` and `toggle`, each with a result and no edits. A question's `items` SHALL take each, and an answer SHALL carry an input atom's value in `results` under its item ID (FR-13, FR-18, AD-7, AD-20).

#### Scenario: A question built from atoms
- **WHEN** an ask holds a question whose `items` are a Text, a TextField, a NumberField, a MoneyField, a DateField, a Toggle, a Divider and a Value, with no options
- **THEN** it passes, and each example item of the eight entries passes alone

#### Scenario: A display atom gives no result
- **WHEN** an answer carries a result for a Text, a Value or a Divider
- **THEN** the result is refused, naming the item and saying the type gives no result

### Requirement: Atom labels and descriptions
Each atom's entry SHALL carry its noun, wording, an example item and its teaching text. An input atom's `label` SHALL be 1 to 200 characters and its optional `description` 1 to 1,000, counted as code points (FR-13, AD-7).

#### Scenario: A label at its bound
- **WHEN** a TextField's label holds 200 code points, then 201
- **THEN** the first passes and the second fails, naming the item and the field

### Requirement: Text items
A `text` item SHALL hold `text`, 1 to 10,000 code points, and an optional `format`, `plain` (the default) or `markdown` (FR-13, AD-8).

#### Scenario: Bounds
- **WHEN** a Text holds 10,000 code points, then 10,001, or an empty `text`, or `format: "html"`
- **THEN** the first passes and the others fail, naming the item and the field

### Requirement: Value items
A `value` item SHALL hold an optional `label` and a `kind` with its value: `number` or `percent` with a number `value` within ±1,000,000,000,000,000 and an optional `unit` (1 to 20) for `number`; `money` with an `amount` decimal string within the currency's minor units and a `currency` ISO 4217 code; `date` with a `date` full-date within the Gantt's first and last dates; `duration` with whole `days` from 0 to 100,000. Any other field for the kind SHALL fail, naming it (FR-13, AD-7).

#### Scenario: Each kind
- **WHEN** Values of each kind are sent with their fields
- **THEN** they pass, and a `money` Value without `currency`, a `date` Value with `2026-02-30` and a `percent` Value holding `unit` fail, naming the item and the field

#### Scenario: An amount finer than its currency
- **WHEN** a `money` Value holds `0.5` in JPY or `-0.004` in EUR
- **THEN** it fails, naming the item and `amount`

### Requirement: Divider items
A `divider` item SHALL hold empty props (FR-13).

#### Scenario: Props on a divider
- **WHEN** a Divider holds `{}`, then `{label: "x"}`
- **THEN** the first passes and the second fails, naming the field

### Requirement: TextField items and results
A `text-field` item SHALL hold `label`, an optional `description`, an optional `multiline` and an optional `maxLength` from 1 to 10,000 (10,000 when absent). Its result SHALL be a string of 1 to `maxLength` code points, holding no line feed or carriage return unless `multiline` is true (FR-13, FR-18).

#### Scenario: A short text
- **WHEN** a TextField `{label: "Name", maxLength: 40}` receives `"Ada"`, then 41 code points, then `"a\nb"`
- **THEN** the first passes, and the others fail, naming the item and the limit or the line break

### Requirement: NumberField items and results
A `number-field` item SHALL hold `label`, an optional `description`, optional `min` and `max` within ±1,000,000,000,000,000 with `max` not below `min`, an optional `step` above 0, an optional `integer` and an optional `unit` (1 to 20). Its result SHALL be a JSON number within the bounds, whole when `integer` is true, and on a step when `step` is given, counted from `min` (else 0) within the grid's tolerance, which props keep under a quarter step (FR-13, AD-10).

#### Scenario: Bounds and steps
- **WHEN** a NumberField `{label: "Days", min: 0, max: 20, step: 0.5}` receives `3.5`, `21`, `3.25`
- **THEN** `3.5` passes, and the others fail, naming the item and the bound or the step

#### Scenario: The grid's tolerance
- **WHEN** a value lies off its step by less than a billionth of a step, or by less than eight times `Number.EPSILON` of the larger of `|min|` and the value when that is wider
- **THEN** it counts as on the step, so `{step: 8}` near 1e15 accepts 999999999999993

#### Scenario: A step finer than the doubles
- **WHEN** a `number-field` holds `min` -1e15 and `step` 1, or bounds near 1e15 with `step` 2 or 3
- **THEN** its props are refused, naming `step`, since a double there cannot tell a value on the step from one off it

### Requirement: MoneyField items and results
A `money-field` item SHALL hold `label`, an optional `description`, exactly one of `currency` (an ISO 4217 code) and `currencies` (2 to 10 unique codes), and optional `min` and `max` as decimal strings. Its result SHALL be `{amount, currency}`: `amount` a decimal string of at most 15 integer digits and at most the currency's minor units in decimals, within `min` and `max` compared as decimals, never as binary floats; `currency` the item's `currency` or one of its `currencies` (FR-13, AD-7).

#### Scenario: A fixed currency
- **WHEN** a MoneyField `{label: "Budget", currency: "EUR", min: "0"}` receives `{amount: "12480.50", currency: "EUR"}`, `{amount: "12480.505", currency: "EUR"}`, `{amount: "-1", currency: "EUR"}`, `{amount: "10", currency: "USD"}`
- **THEN** the first passes, and the others fail, naming the item and the decimals, the bound or the currency

#### Scenario: A currency without minor units
- **WHEN** a MoneyField `{label: "Price", currencies: ["EUR", "JPY"]}` receives `{amount: "1500", currency: "JPY"}`, then `{amount: "1500.5", currency: "JPY"}`
- **THEN** the first passes and the second fails

### Requirement: DateField items and results
A `date-field` item SHALL hold `label`, an optional `description`, and optional `min` and `max` full-dates within the Gantt's first and last dates, `max` not before `min`. Its result SHALL be a full-date within them (FR-13, AD-7).

#### Scenario: A date out of range
- **WHEN** a DateField `{label: "Start", min: "2026-01-01"}` receives `"2026-03-02"`, then `"2025-12-31"`, then `"2026-02-30"`
- **THEN** the first passes and the others fail, naming the item

### Requirement: Toggle items and results
A `toggle` item SHALL hold `label` and an optional `description`. Its result SHALL be `true` or `false`; `false` is an answer, and an untouched Toggle gives none (FR-13, EXPERIENCE Primitives).

#### Scenario: Off is an answer
- **WHEN** a Toggle's result is `false`
- **THEN** it passes and does not count as holding nothing

### Requirement: Amount entry in the ask's locale
The contract SHALL read an amount typed in the ask's locale for a currency and return a decimal string, an empty entry or a refusal with a reason in the ask's language, by the number entry's rules for marks and grouping, refusing more decimals than the currency's minor units and more than 15 integer digits. The value SHALL never pass through a binary float. The echo SHALL write the amount without grouping and with the currency's minor units, followed by the code (EXPERIENCE, Input atoms).

#### Scenario: An Italian amount
- **WHEN** `1.234,5` is read in it-IT for EUR
- **THEN** it reads as `"1234.50"`, and its echo is `= 1234,50 EUR`

#### Scenario: Too many decimals
- **WHEN** `12.345` is read in en-US for EUR, or `12.5` for JPY
- **THEN** it is refused, the reason naming the currency and its decimals

#### Scenario: Precision kept
- **WHEN** `999999999999999.99` is read in en-US for USD
- **THEN** it reads as `"999999999999999.99"` exactly

### Requirement: Markdown option previews
An option MAY carry `previewFormat`, `plain` (the default) or `markdown`, and only beside a `preview`, in the input format, the board document and `fetch`'s question; a preview without it SHALL keep its plain-text meaning (FR-3, AD-8).

#### Scenario: A format without a preview
- **WHEN** an option holds `previewFormat: "markdown"` and no `preview`
- **THEN** validation fails, naming the option

### Requirement: Teaching text of the atoms
Each atom's entry SHALL carry its teaching text within the registry's bounds, and the generated skill SHALL list the eight within its budgets; the Scale's text SHALL name it as the slider (askboard-skills, SM-1).

#### Scenario: The regenerated skill
- **WHEN** `bun run build:skills` runs after the eight register
- **THEN** `check:skills` passes, every budget included, and each example item passes `AskCore.ask`

## MODIFIED Requirements

### Requirement: Draft record message
The draft record SHALL be a board-protocol schema: the delivery mode, the question in view, and per question its `rev`, the values keyed by item ID as the view holds them, the "Other…" text, option notes, open-prompt text, follow-up composer text, any held act with its order, and, since `atoms`, the entries keyed by item ID: the text an input atom holds that gives no value, each 1 to 200 characters. An entry key that names no item of its question SHALL be refused like a value key. A record over the contract's draft limit SHALL be refused.

#### Scenario: An oversized record
- **WHEN** the board page sends a draft record longer than the draft limit
- **THEN** it is refused as a schema error and the held record is unchanged

#### Scenario: A question key that is no own property
- **WHEN** a draft record keys a question as `constructor`
- **THEN** it is refused like any other unknown item ID

#### Scenario: An entry for an unknown item
- **WHEN** a draft record holds an entry for `days` under a question that has no item `days`, or an entry of 201 characters
- **THEN** it is refused, naming the entry, and the held record is unchanged
