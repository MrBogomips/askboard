## ADDED Requirements

### Requirement: A result's requirements on its answer
`ask-core` SHALL run the answer checks of each result's type with the answer's note and whether the answer's `changes` are empty, after the event's widget fields are built and before anything is kept; a failure SHALL refuse the answer, naming the item, with nothing appended, kept or published (AD-10, NFR-10, FR-11).

#### Scenario: Approving with changes and a reason
- **WHEN** an answer carries `results: {verdict: {decision: "approve-with-changes"}}`, a Tree value with one change and the note "Show the training as an extra"
- **THEN** it is logged, its event carrying the result, the note and the Tree's change

#### Scenario: Approving with changes and no reason
- **WHEN** an answer carries `{decision: "approve-with-changes"}` for the Approval and no note, or a note of white space only (U+0085 included)
- **THEN** it is refused, naming `verdict` and the missing reason, and nothing is appended or published

#### Scenario: Approving beside a change
- **WHEN** an answer carries `{decision: "approve"}` for the Approval and a Tree value with one change
- **THEN** it is refused, naming `verdict`, and nothing is appended or published

#### Scenario: Approving with nothing changed
- **WHEN** an answer carries `{decision: "approve"}` alone
- **THEN** it is logged

### Requirement: Results of the shipped result widgets
`ask-core` SHALL check an Approval's, a Scale's and a Ranking's result against the item's props in the revision the answer names, so that a value off a step, an order that misses an element or names one the revision does not hold, and a decision outside the three are refused with the log unchanged (AD-10, AD-20, FR-18).

#### Scenario: An order for an earlier revision
- **WHEN** the agent has removed `cost` from a Ranking in revision 2 and an answer naming revision 1 carries an order with `cost`, after "Keep mine" on the agent-change notice
- **THEN** it is logged, its order checked against revision 1

#### Scenario: An order missing an element
- **WHEN** an answer naming the current revision carries an order that leaves out one of the Ranking's items
- **THEN** it is refused, naming the item and the element, with the log unchanged

#### Scenario: A Scale value off its step
- **WHEN** an answer carries `{value: 37}` for a Scale from 0 to 100 by 5
- **THEN** it is refused, naming the item, with the log unchanged

#### Scenario: Fetching a widget alone
- **WHEN** the agent fetches a Ranking item whose question's latest answer holds its order
- **THEN** the item comes with that order as its `result`
