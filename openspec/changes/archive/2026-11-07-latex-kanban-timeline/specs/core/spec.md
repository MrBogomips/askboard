## ADDED Requirements

### Requirement: An answer's changes follow their type
`ask-core` SHALL refuse an answer when the changes it computes for an edited widget item fall outside that item type's changes schema, naming the item and the operation, so that nothing is appended, kept or published; it SHALL check them after the edited value's own checks and its round trip, for every registered type. A diff that fails, such as for a key a fields shape does not name, SHALL refuse the answer the same way, naming the item and the key (AD-7, AD-10, AD-20).

#### Scenario: A Kanban reorder
- **WHEN** an answer's value for a Kanban lists its cards in another order, each in its sent column
- **THEN** it is refused, naming the item and a `move`, with the log unchanged and nothing published

#### Scenario: An edited card label
- **WHEN** an answer's value for a Kanban renames a card
- **THEN** it is refused, naming the item and the `set` of the card's `label`, with the log unchanged

#### Scenario: A key a fields shape does not name
- **WHEN** a type's props admit keys its fields shape does not name, and an answer's value changes one of them
- **THEN** it is refused, naming the item and the key, with the log unchanged and nothing kept or published

#### Scenario: Tree and Gantt answers
- **WHEN** the Tree, Gantt, WBS and Gantt plan answers of the existing suites are given
- **THEN** each is logged as before

### Requirement: Answers of LaTeX, Kanban and Timeline
`ask-core` SHALL log a LaTeX, Kanban or Timeline answer with the changes the one generic diff computes against the revision the answer names, keep the full edited value, and refuse an edited value its type's checks refuse, with the log unchanged (AD-10, AD-20, FR-18, FR-20).

#### Scenario: A corrected expression
- **WHEN** the user answers a question holding the LaTeX item `formula` with its expression edited
- **THEN** the answer event's `changes` hold one `set` of `formula.expression`, and `fetch` of the item returns the edited expression

#### Scenario: A corrected expression that defines a macro
- **WHEN** an answer's value for the LaTeX item `formula` holds `\def\a{x}\a`
- **THEN** it is refused, naming the item and `\def`, with the log unchanged and nothing kept or published

#### Scenario: A corrected expression past the LaTeX's bounds
- **WHEN** an answer's value for the LaTeX item `formula` holds `\color{x}\current@color`, then a nest one level past the limit
- **THEN** each is refused, naming the item and `\current@color`, then the depth and the limit, with the log unchanged and nothing kept or published

#### Scenario: A moved card
- **WHEN** the user answers with a Kanban card moved from `todo` to `done`
- **THEN** the answer event's `changes` hold one `set` of the card's `column` to `done`

#### Scenario: A card moved into a column the item does not hold
- **WHEN** an answer's value for a Kanban puts a card in `blocked`, which is no column of the item
- **THEN** it is refused, naming the item and the card, with the log unchanged

#### Scenario: A milestone given an end
- **WHEN** an answer's value for a Timeline gives the milestone `launch` an `end`
- **THEN** it is refused, naming the item and `launch`, with the log unchanged

#### Scenario: A range moved
- **WHEN** the user answers with a Timeline range moved three days later
- **THEN** the answer event's `changes` hold the `set`s of its `start` and `end`, each three days later
