## ADDED Requirements

### Requirement: Answers that order a Kanban
`ask-core` SHALL log a Kanban answer whose value orders cards within their columns with the `set`s and `move`s the generic diff computes against the revision the answer names, keep the full edited value, and return it whole from `fetch`; a column whose order the answer keeps SHALL get no change (AD-10, AD-20, FR-18, FR-20).

#### Scenario: A card reordered in its column
- **WHEN** the user answers with the card `add-sso` placed above `fix-login` in `todo`
- **THEN** the answer event's `changes` hold one `move` of `add-sso` with no `after`, and `fetch` of the item returns the edited cards in that order

#### Scenario: A card placed in another column
- **WHEN** the user answers with the card `audit` moved from `todo` into `doing`, right after `write-docs`, where the sent order does not put it
- **THEN** the changes hold a `set` of `audit`'s column to `doing`, then a `move` of `audit` after `write-docs`, and no change names a card of `done`

#### Scenario: An answer naming an earlier revision
- **WHEN** after "Keep mine" an answer naming revision 1 orders the cards of a Kanban the agent changed in revision 2
- **THEN** its changes are computed against revision 1's cards

## MODIFIED Requirements

### Requirement: An answer's changes follow their type
`ask-core` SHALL refuse an answer when the changes it computes for an edited widget item fall outside that item type's changes schema, naming the item and the operation, so that nothing is appended, kept or published; it SHALL check them after the edited value's own checks and its round trip, for every registered type. A diff that fails, such as for a key a fields shape does not name, and a value its changes do not rebuild, such as a Kanban whose cards change places in the list without changing any column's order, SHALL refuse the answer the same way, naming the item (AD-7, AD-10, AD-20).

#### Scenario: A Kanban reorder
- **WHEN** an answer's value for a Kanban lists the cards of one column in another order, each in its sent column, the list as the board holds it (the one its changes rebuild)
- **THEN** it is logged, its changes holding the `move`s of that column's order

#### Scenario: A reorder whose list its changes do not rebuild
- **WHEN** an answer's value for a Kanban gives a column a new order but interleaves the columns' cards otherwise than its changes rebuild them
- **THEN** it is refused, naming the item, with the log unchanged and nothing published

#### Scenario: A Kanban list order that no column shows
- **WHEN** an answer's value for a Kanban whose columns each hold one card lists its cards in another order
- **THEN** it is refused, naming the item, with the log unchanged and nothing published

#### Scenario: An edited card label
- **WHEN** an answer's value for a Kanban renames a card
- **THEN** it is refused, naming the item and the `set` of the card's `label`, with the log unchanged

#### Scenario: A key a fields shape does not name
- **WHEN** a type's props admit keys its fields shape does not name, and an answer's value changes one of them
- **THEN** it is refused, naming the item and the key, with the log unchanged and nothing kept or published

#### Scenario: Tree and Gantt answers
- **WHEN** the Tree, Gantt, WBS and Gantt plan answers of the existing suites are given
- **THEN** each is logged as before
