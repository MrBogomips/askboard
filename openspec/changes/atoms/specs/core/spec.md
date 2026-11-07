## ADDED Requirements

### Requirement: Answers of atoms
`ask-core` SHALL take an answer to a question of atoms as it takes any widget result: each input atom's result in `results` under its item ID, checked against its type's schema and checks before anything is appended; an atom the user left unset SHALL be absent; a result that holds nothing, a result for a display atom, or a result outside the item's bounds SHALL refuse the answer, so that nothing is appended, kept or published (FR-13, FR-18, AD-10, AD-20).

#### Scenario: A question of atoms answered
- **WHEN** the user answers a question holding a TextField, a NumberField, a MoneyField, a DateField, a Toggle and a Text, setting all but the DateField and switching the Toggle off
- **THEN** the answer's `results` hold the five set values under their item IDs, the Toggle's as `false`, and none for the DateField or the Text

#### Scenario: A result past its bounds
- **WHEN** an answer carries `{days: 21}` for a NumberField whose `max` is 20, or `""` for a TextField
- **THEN** the answer is refused, naming the item, and nothing is appended or published

#### Scenario: Large text answers
- **WHEN** a question of five TextFields is answered with 10,000 code points in each
- **THEN** the answer is logged `tooLarge`, without its results, and `fetch` of each item returns its result

### Requirement: Values only for items that take edits
`ask-core` SHALL refuse an answer whose `values` hold a value for an item whose type takes no edits (its registry entry declares none: the atoms, the Approval, Scale, Ranking and Chart among them), naming the item, so that nothing is appended, kept or published; the result of an item whose type takes no edits SHALL be checked against the props the agent sent (AD-10, AD-20, NFR-10).

#### Scenario: A forged value
- **WHEN** an answer carries a value for a Ranking adding an element `drop-db` with a result ranking it first, or a value for a NumberField raising its `max`
- **THEN** the answer is refused, naming the item, and nothing is appended or published

#### Scenario: Edits still answered
- **WHEN** an answer carries the edited value of a Tree or a Gantt plan
- **THEN** it is taken as before

### Requirement: Entries stay in the draft
`ask-core` SHALL hold a draft record's entries with the rest of the draft, apart from the log, and SHALL never expose them to `collect`, `fetch`, Snapshots, the mod or the local API (AD-20).

#### Scenario: An entry and a collect
- **WHEN** the draft record holds an entry `1.23` for a NumberField and the agent collects and fetches the item
- **THEN** neither result holds the entry or any trace of it
