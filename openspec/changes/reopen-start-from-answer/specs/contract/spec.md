## ADDED Requirements

### Requirement: Unchanged items in the board state's answers
The board protocol's board state SHALL admit, in a question's current and previous answer, `unchanged`: a non-empty list of unique item IDs, with no count bound of its own, as `values` and `results` have none. The Snapshot data, which holds that board state, SHALL admit it too. Each set SHALL take the next minor after `main`'s and still accept a message of the previous minor (AD-7, AD-20).

#### Scenario: A previous answer with unchanged items
- **WHEN** a board state names `unchanged: ["plan", "roadmap"]` in question `plan`'s previous answer
- **THEN** it validates

#### Scenario: A malformed list
- **WHEN** a board state names `unchanged: []`, or a list holding the same ID twice, in an answer
- **THEN** validation fails, naming the field

### Requirement: The prefill mark in the draft record
The draft record SHALL admit, per question, `prefilled: true`: the board filled that question's work on its revision from the previous answer. It SHALL hold no other value. The draft record is in the board protocol, which takes the same minor as the board state's `unchanged` (AD-7, AD-20).

#### Scenario: A marked question
- **WHEN** a draft record holds question `plan` at `rev` 2 with `prefilled: true` and no values
- **THEN** it validates

#### Scenario: Any other value
- **WHEN** it holds `prefilled: false`
- **THEN** validation fails, naming the field
