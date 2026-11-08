## ADDED Requirements

### Requirement: What an answer's revision shares with the current one
The board state SHALL give a question's current and previous answer the item IDs unchanged since the revision the answer names, when it is earlier than the current one: a logged answer's, or the one current when a recorded answer was reopened. The IDs SHALL be the question's own when its props are equal whole, and each item's at any depth that is equal, as "How unchanged items are compared" says; the list MAY be empty (AD-20).

#### Scenario: Reopened with no other change
- **WHEN** the agent reopens question `plan`, answered at `rev` 1, holding a Timeline `roadmap` inside a Group `side`
- **THEN** `plan`'s previous answer lists `plan`, `side` and `roadmap` as unchanged

#### Scenario: Reopened and changed
- **WHEN** the agent then changes `roadmap`'s lanes
- **THEN** `plan`'s previous answer lists `side` only, neither `plan` nor `roadmap`

#### Scenario: A recorded answer reopened
- **WHEN** the agent records an answer to question `offer` at `rev` 2 and then reopens it with no other change
- **THEN** `offer`'s previous answer lists `offer` as unchanged

#### Scenario: Reopened and changed throughout
- **WHEN** the agent reopens question `plan` and, in the same `update`, changes its text and every item in it
- **THEN** `plan`'s previous answer names `unchanged: []`

#### Scenario: An answer kept on an earlier revision
- **WHEN** the agent changes question `plan`'s Kanban while the user holds work on `rev` 1, and the user keeps their work and answers naming `rev` 1
- **THEN** `plan`'s current answer lists the items equal in both revisions, without the Kanban

#### Scenario: Not in the log or the tools
- **WHEN** the agent reads `fetch` of the reopened question and `collect` returns its events
- **THEN** neither holds the unchanged IDs

### Requirement: How unchanged items are compared
Props SHALL be compared canonically as the board shows them: each revision's props with the context they point to (excerpts, images, file references) resolved for that revision, an unresolved pointer comparing as itself. A layout SHALL be compared with each item inside it replaced by its ID, so a Group whose members changed only inside is listed, and one that gained or lost a member is not. Memoised comparisons SHALL be kept only for the question's current revision (NFR-10, AD-9, AD-20).

#### Scenario: Context changed under the same props
- **WHEN** a reopened question's item points to an excerpt whose text changed between the answer's revision and the current one, its props unchanged
- **THEN** that item's ID and the question's are not in the list

#### Scenario: A new member of a Group
- **WHEN** the agent's revision adds an item inside a Group and changes nothing else
- **THEN** the other members' IDs are in the list, and the Group's and the new item's are not, since the Group's list of members changed

### Requirement: When an answer carries its unchanged items
An answer that names the question's current revision SHALL carry no unchanged list, so the board state of an answered question stays as it was. When `ask-core` cannot compare the answer's revision with the current one, it SHALL give an empty list, never none (NFR-10). A Snapshot's board state SHALL carry the same lists as the live board's (AD-15, AD-20).

#### Scenario: An answer on the current revision
- **WHEN** the user answers question `plan` and the agent changes nothing after
- **THEN** `plan`'s current answer in the board state holds no `unchanged`, and the board state is the one it was before this change

#### Scenario: A revision ask-core no longer holds
- **WHEN** a question's previous answer names a revision whose props `ask-core` does not hold
- **THEN** that answer names `unchanged: []`

#### Scenario: In a Snapshot
- **WHEN** the agent takes a Snapshot of an ask holding a reopened question
- **THEN** the data's board state names the previous answer's unchanged IDs as the live board receives them
