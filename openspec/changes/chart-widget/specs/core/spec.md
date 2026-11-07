## ADDED Requirements

### Requirement: Chart results through ask-core
`ask-core` SHALL check a Chart's result against the item's props in the revision the answer names, so that a point the revision does not hold, a point with no value, a second point for `highlights: "one"` and any result for `highlights: "none"` are refused with the log unchanged, nothing kept and nothing published; an accepted result SHALL be logged under the answer's `results` and returned by `fetch` of the item (AD-10, AD-20, FR-18, FR-20).

#### Scenario: A point removed by the agent
- **WHEN** the agent has removed the category `q4` from a Chart in revision 2, and an answer naming revision 2 carries a point in `q4`
- **THEN** it is refused, naming the item and the point, with the log unchanged

#### Scenario: A point of an earlier revision
- **WHEN** an answer naming revision 1 carries a point in `q4`, after "Keep mine" on the agent-change notice
- **THEN** it is logged, its points checked against revision 1

#### Scenario: Fetching a Chart alone
- **WHEN** the agent fetches a Chart item whose question's latest answer holds its points
- **THEN** the item comes with those points as its `result`
