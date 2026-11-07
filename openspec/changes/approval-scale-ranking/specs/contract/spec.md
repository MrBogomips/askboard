## ADDED Requirements

### Requirement: Approval items
The registry SHALL hold `approval`, whose props are an empty object and whose result is `{decision}`, one of `approve`, `approve-with-changes` or `reject`, with no other field. The reason SHALL travel as the answer's note, never in the result (FR-11, FR-18, AD-7).

#### Scenario: An Approval in a question
- **WHEN** an ask holds a question whose `items` hold `{type: "approval", id: "verdict", props: {}}`
- **THEN** it passes

#### Scenario: Props the Approval does not define
- **WHEN** an Approval's props hold a field, such as `summary`
- **THEN** validation fails, naming the item and the field

#### Scenario: The approved UJ-3 answer's result
- **WHEN** the result `{decision: "approve-with-changes"}` of the approved `uj3-sales-review` answer is checked as an Approval's result
- **THEN** it passes, and `{decision: "maybe"}` and `{decision: "approve", reason: "ok"}` fail, naming the field

### Requirement: Scale items
The registry SHALL hold `scale`: `min` and `max` within ±1,000,000,000 with `max` above `min`, an optional `step` above 0 (1 when absent) dividing `max − min` into at most 1,000 steps, optional `range` and `display` (`slider` or `rating`), and optional `minLabel`, `maxLabel` (1 to 60 characters) and `unit` (1 to 20). A rating SHALL hold at most 11 values, one toggle for each value from `min` to `max`, and no range (FR-11).

#### Scenario: A slider and a rating
- **WHEN** an ask holds a Scale `{min: 0, max: 100, step: 5, unit: "%"}` and a Scale `{min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High"}`
- **THEN** it passes

#### Scenario: Steps that do not divide the scale
- **WHEN** a Scale has `min` 0, `max` 10 and `step` 3, or `max` equal to `min`, or 2,000 steps
- **THEN** validation fails, naming the item and the field

#### Scenario: A rating range
- **WHEN** a Scale has `display: "rating"` with `range: true`, or a rating from 0 to 20
- **THEN** validation fails, naming the item and saying a rating takes one value out of at most 11

#### Scenario: Eleven values and twelve
- **WHEN** a Scale has `display: "rating"` from 0 to 10, and another from 0 to 11
- **THEN** the first passes, and the second fails, naming the item and saying a rating takes one value out of at most 11 and that this scale has 12 values

### Requirement: Scale results
A Scale's result SHALL be `{value}` when its props have no `range`, else `{low, high}` with `low` not above `high`; each number SHALL lie within `min` and `max` exactly, and on a step: `min` plus a whole number of steps within a billionth of a step. The billionth-of-a-step tolerance applies to the step grid only, never to the bounds (FR-11, FR-18, AD-10).

#### Scenario: A value on a step
- **WHEN** a result `{value: 35}` is checked for a Scale from 0 to 100 by 5
- **THEN** it passes, and `{value: 37}`, `{value: 105}` and `{low: 10, high: 20}` fail, naming the item and the field

#### Scenario: A range
- **WHEN** a result `{low: 20, high: 20}` is checked for a Scale with `range`
- **THEN** it passes, and `{low: 30, high: 20}` and `{value: 20}` fail

#### Scenario: Decimal steps
- **WHEN** a result `{value: 0.3}` is checked for a Scale from 0 to 1 by 0.1
- **THEN** it passes

#### Scenario: A hair outside the bounds
- **WHEN** a result `{value: 10.0000000005}` (`max` plus 5e-10) or `{value: -0.0000000005}` (`min` minus 5e-10) is checked for a Scale from 0 to 10 by 1
- **THEN** it fails, naming the item and the field, though each lies within a billionth of a step of a step

### Requirement: Ranking items
The registry SHALL hold `ranking`, whose props hold `items`: 2 to 50 elements `{id, label, description?}`, IDs matching the ID pattern and unique within the item, `label` 1 to 200 characters, `description` 1 to 500 (FR-11, AD-7).

#### Scenario: A Ranking in a question
- **WHEN** an ask holds a Ranking of three items with distinct IDs
- **THEN** it passes

#### Scenario: A repeated ID
- **WHEN** a Ranking's items hold the ID `speed` twice
- **THEN** validation fails, naming the item and the element `speed`

#### Scenario: One item
- **WHEN** a Ranking holds a single item
- **THEN** validation fails, naming the item and `items`

### Requirement: Ranking results
A Ranking's result SHALL be `{order}`, the IDs of the item's elements as sent in the answer's revision, each exactly once (FR-11, FR-18).

#### Scenario: Every ID once
- **WHEN** a result naming each of the three items once, in another order, is checked
- **THEN** it passes

#### Scenario: A missing, extra or repeated ID
- **WHEN** a result leaves out `cost`, names `color` the item does not hold, or names `speed` twice
- **THEN** it fails, naming the item and the element

### Requirement: What a result requires of its answer
A registered type MAY declare checks of the answer its result travels in, given the answer's note and whether the answer changes any element; a refusal SHALL name the item. The Approval SHALL refuse `approve-with-changes` without a note holding a character other than white space, and `approve` in an answer that changes an element (FR-11, AD-10, F-63).

#### Scenario: Approving with changes needs the reason
- **WHEN** the Approval's checks run on `{decision: "approve-with-changes"}` with no note, or with a note of three spaces
- **THEN** each fails, naming the item and saying approving with changes needs the reason in the note

#### Scenario: Approving beside changes
- **WHEN** the Approval's checks run on `{decision: "approve"}` in an answer that changes an element
- **THEN** it fails, naming the item and saying an answer that changes the content approves with changes

#### Scenario: Rejecting beside changes
- **WHEN** the Approval's checks run on `{decision: "reject"}` in an answer that changes an element, with no note
- **THEN** it passes

### Requirement: A result that holds itself
The contract's test of a result that holds nothing SHALL end for any value, one that holds itself or is nested a million levels deep included, and SHALL read each object it reaches once (AD-10, NFR-10).

#### Scenario: A value that holds itself
- **WHEN** the test runs on an object whose field holds the object itself, and on an array holding itself beside `""`
- **THEN** it returns, saying each holds nothing, within the test's time limit

#### Scenario: A deep value
- **WHEN** the test runs on an array nested a million levels with `1` at the bottom
- **THEN** it returns, saying the value holds something

### Requirement: Teaching text of the three widgets
The `approval`, `scale` and `ranking` entries SHALL each carry the teaching text the skill's references are generated from, within its bounds, and each entry's example item SHALL be accepted in an ask (FR-29, AD-6).

#### Scenario: The registry's own check
- **WHEN** the registry's own check runs over the shipped registry
- **THEN** it passes, the three types' result schemas refusing every result that holds nothing

#### Scenario: The skill names the three
- **WHEN** the skill is generated from the shipped registry
- **THEN** its item index lists Tree, Gantt, Approval, Scale and Ranking in that order, and each of the three has a reference with its result's fields

### Requirement: Approval, Scale and Ranking in the sets' next minors
The input format, the output format, the tool envelopes and the board document SHALL each take the next minor after the one `main` holds, admitting the three types' items, props and results; every other set SHALL keep `main`'s version (AD-7).

#### Scenario: The previous minor
- **WHEN** an ask holding an Approval is validated by the input format's previous minor
- **THEN** it fails, naming the item and its type

#### Scenario: A fetch of a Ranking alone
- **WHEN** a `fetch` result holds a Ranking item with its `result`
- **THEN** it validates, and the same item with a Scale's result fails at `/item/result`

#### Scenario: Sets this change leaves alone
- **WHEN** the version constants are read after this change
- **THEN** the board protocol, the Snapshot data, the view manifest, the configuration, the local API and the session file equal `main`'s
