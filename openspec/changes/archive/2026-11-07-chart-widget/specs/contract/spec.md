## ADDED Requirements

### Requirement: Chart items
The registry SHALL hold `chart`, whose props hold `kind` (`bar`, `line` or `pie`), `categories`: 1 to 100 elements `{id, label}`, and `series`: 1 to 5 elements `{id, label, values}`, where `values` holds one number within ±1,000,000,000,000,000 or `null` per category, in the categories' order. IDs SHALL match the ID pattern and be unique among the item's categories and among its series; `label` SHALL be 1 to 60 characters. Every chart SHALL hold at least one number (FR-11, AD-7).

#### Scenario: A bar chart in a question
- **WHEN** an ask holds a Chart `{kind: "bar", categories: [{id: "a", label: "Fix A"}, {id: "b", label: "Fix B"}], series: [{id: "fails", label: "Failures", values: [4, 9]}], unit: "runs"}`
- **THEN** it passes

#### Scenario: Values that do not match the categories
- **WHEN** a Chart has three categories and a series with two values
- **THEN** validation fails, naming the item and the series, and saying that each series holds one value per category

#### Scenario: A repeated ID
- **WHEN** a Chart's categories hold the ID `q1` twice, or its series hold the ID `cost` twice
- **THEN** validation fails, naming the item and the repeated element

#### Scenario: Six series
- **WHEN** a Chart holds six series
- **THEN** validation fails, naming the item and `series`

#### Scenario: Nothing to draw
- **WHEN** a line chart's every value is `null`
- **THEN** validation fails, naming the item and saying that a chart holds at least one number

### Requirement: Chart options
A Chart's props MAY also hold `title` (1 to 120 characters), `valueLabel` and `categoryLabel` (1 to 60), `unit` (1 to 20) and `highlights` (`many`, `one` or `none`; `many` when absent), and SHALL hold nothing else (FR-11, AD-7).

#### Scenario: A field the Chart does not take
- **WHEN** a Chart's props hold `stacked: true`
- **THEN** validation fails, naming the item and `stacked`

#### Scenario: A reading chart
- **WHEN** a Chart has `highlights: "none"` and a `title` of 120 characters
- **THEN** it passes

### Requirement: Chart pies
A Chart of kind `pie` SHALL hold one series, at most 5 categories, no negative value, at least one value above 0, and no `valueLabel` or `categoryLabel` (FR-11).

#### Scenario: A pie that is not a part of a whole
- **WHEN** a pie holds two series, or six categories, or a negative value, or only zeros and `null`, or a `valueLabel`
- **THEN** validation fails, naming the item and saying what a pie takes

### Requirement: Chart results
A Chart's result SHALL be `{points}`: 1 to 500 elements `{series, category}`, each naming a series and a category of the item's props in the answer's revision whose value there is a number, no point twice. A Chart with `highlights: "one"` SHALL take exactly one point, and one with `highlights: "none"` SHALL take no result (FR-11, FR-18, AD-10).

#### Scenario: Two points highlighted
- **WHEN** a result `{points: [{series: "fails", category: "a"}, {series: "fails", category: "b"}]}` is checked for the bar chart above
- **THEN** it passes

#### Scenario: A point the chart does not hold
- **WHEN** a result names the category `c` the chart does not hold, or a series it does not hold, or a point whose value is `null`, or the same point twice
- **THEN** it fails, naming the item and the point

#### Scenario: One point only
- **WHEN** a result with two points is checked for a Chart with `highlights: "one"`
- **THEN** it fails, naming the item and saying that this chart takes one point

#### Scenario: A chart to read
- **WHEN** any result is checked for a Chart with `highlights: "none"`
- **THEN** it fails, naming the item and saying that this chart takes no highlight

#### Scenario: Nothing highlighted
- **WHEN** a result `{points: []}` is checked
- **THEN** it fails at `/points`

### Requirement: The Chart's teaching text
The Chart's registry entry SHALL carry its teaching text, saying when to use it (a bar, line or pie chart the user reads and whose points the user may highlight) and that its result lists the highlighted points, that `values` follow the categories' order, and that a Chart with `highlights: "none"` gives no result, so its question needs options or another item to be answered; and an example item that validates (FR-29, AD-6).

#### Scenario: The generated reference
- **WHEN** the skill is generated
- **THEN** it holds a Chart reference naming every top-level field of the Chart's props schema, the result's `points`, and the example, which `AskCore.ask` accepts

### Requirement: The Chart in the sets' next minors
The input format, the output format, the tool envelopes and the board document SHALL each take the next minor after the one `main` holds, admitting the Chart's items, props and result; every other set SHALL keep `main`'s version (AD-7).

#### Scenario: The previous minor
- **WHEN** an ask holding a Chart is validated by the input format's previous minor
- **THEN** it fails, naming the item and its type

#### Scenario: A fetch of a Chart alone
- **WHEN** a `fetch` result holds a Chart item with its `result`
- **THEN** it validates, and the same item with a Scale's result fails at `/item/result`

#### Scenario: Sets this change leaves alone
- **WHEN** the version constants are read after this change
- **THEN** the board protocol, the Snapshot data, the view manifest, the configuration, the local API and the session file equal `main`'s
