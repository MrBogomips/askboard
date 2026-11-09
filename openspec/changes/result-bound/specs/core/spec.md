## MODIFIED Requirements

### Requirement: An unresolved pointer never blocks the board
A pointer that does not resolve SHALL leave the ask created or the update applied, its item marked unresolved with its reason in the board document, and SHALL add one `unresolved-pointer` warning naming the item to that call's result, in board order, while the JSON text of the call's `unresolved-pointer` warnings stays within `UNRESOLVED_WARNINGS_MAX_CHARS` (10,000 characters) (FR-8, AD-6).

#### Scenario: One good and one missing excerpt
- **WHEN** an ask holds an excerpt pointing at an existing heading and one pointing at a missing file
- **THEN** the ask is created, the first excerpt is resolved, the second is unresolved with reason `not-found`, and the result carries one warning, for the second

#### Scenario: Under the bound
- **WHEN** an ask holds five excerpts whose pointers name missing files
- **THEN** the result carries five `unresolved-pointer` warnings, each with its reason's own message, and none is a closing one

## ADDED Requirements

### Requirement: The closing unresolved-pointer warning
When the bound leaves any unresolved pointer out, the last `unresolved-pointer` warning SHALL be the first one left out, with its item, pointer and reason and a message of fixed words that counts the warnings after it, or says that its own message is left out when none follows it. The JSON text of all of them, the closing one included, SHALL stay within the bound, and the board document SHALL still mark every unresolved item (AD-6, AD-10, FR-8).

#### Scenario: Forty long pointers on an ask
- **WHEN** an ask holds 40 excerpts, each with a pointer of 1,024 characters to a file outside the project folder
- **THEN** the ask is created, the JSON text of its `unresolved-pointer` warnings is at most 10,000 characters, the last one's message says how many more are left out, the warnings kept, the closing one and that count make up the 40, and the board document marks all 40 excerpts unresolved

#### Scenario: Pointers that JSON escapes
- **WHEN** an ask holds 10 images whose pointers are 1,024 control characters each, which no file can match
- **THEN** the ask is created, each image is unresolved with reason `invalid-pointer`, and the JSON text of its `unresolved-pointer` warnings is at most 10,000 characters, a closing warning counting the rest

#### Scenario: An update past the bound
- **WHEN** an `update` adds a question with 60 excerpts whose pointers of 300 characters name missing files
- **THEN** the update is applied, and its `unresolved-pointer` warnings take at most 10,000 characters, the last one counting the rest

#### Scenario: One pointer past the bound
- **WHEN** the warnings of an ask's unresolved pointers exceed the bound by part of the last warning only
- **THEN** the last warning names that pointer, its item and its reason and says that its message is left out, with no count
