## MODIFIED Requirements

### Requirement: Answers and Snapshots
The skill SHALL teach:

- that answers carry only what changed and `fetch` returns a whole item;
- that an answer marked `tooLarge` carries no changes, derived values or results, and `fetch` returns them;
- that an answer with `asSent: true` is the user's explicit acceptance of the question's editable content exactly as the agent sent it, with no change, may carry the input fields' results, and is never a missing answer;
- that `snapshot` returns a file's path in the Snapshot folder, whose board data is in the element the contract names.

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
