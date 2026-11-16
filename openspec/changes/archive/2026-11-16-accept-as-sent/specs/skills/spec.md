## MODIFIED Requirements

### Requirement: Answers and Snapshots
The skill SHALL teach:

- that answers carry only changes and `fetch` returns a whole item;
- that a `tooLarge` answer carries no changes, derived values or results, which `fetch` returns;
- that an answer with `asSent: true` accepts the editable content as sent, may carry field results, and is never a missing answer;
- that `snapshot` returns a path in the Snapshot folder, its board data in the contract's element.

It SHALL hold one `collect` result example (FR-20, FR-26, FR-27, AD-10).

#### Scenario: Reading answers and Snapshots
- **WHEN** the generated answers reference is read
- **THEN** it names the Snapshot folder and data element from the contract and holds a `collect` result example

#### Scenario: A too-large answer
- **WHEN** the generated answers reference is read
- **THEN** it says that an answer marked `tooLarge` carries no changes, derived values or results, and that `fetch` returns them

#### Scenario: An answer accepted as sent
- **WHEN** the generated answers reference is read
- **THEN** it says that an answer with `asSent: true` accepts the question's content as sent, carries no `changes`, and may carry the user's note, the input fields' `results` and the derived values
