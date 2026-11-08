## ADDED Requirements

### Requirement: What an answer's revision shares with the current one
The board state SHALL give a question's current and previous answer, logged or recorded, the item IDs that are unchanged since the revision the answer names. That revision is the one a logged answer names, or the one current when a recorded answer was reopened. The IDs SHALL be the question's own when its props are equal whole, and each item's at any depth whose type and props are equal, compared canonically (AD-20).

#### Scenario: Reopened with no other change
- **WHEN** the agent reopens question `plan`, answered at `rev` 1, holding a Timeline `roadmap` inside a Group `side`
- **THEN** `plan`'s previous answer lists `plan`, `side` and `roadmap` as unchanged

#### Scenario: Reopened and changed
- **WHEN** the agent then changes `roadmap`'s lanes
- **THEN** `plan`'s previous answer lists `side` only, neither `plan` nor `roadmap`

#### Scenario: A recorded answer reopened
- **WHEN** the agent records an answer to question `offer` at `rev` 2 and then reopens it with no other change
- **THEN** `offer`'s previous answer lists `offer` as unchanged

#### Scenario: Not in the log or the tools
- **WHEN** the agent reads `fetch` of the reopened question and `collect` returns its events
- **THEN** neither holds the unchanged IDs
