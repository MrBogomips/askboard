## MODIFIED Requirements

### Requirement: Unresolved pointers in ask and update results
The results of `ask` and `update` SHALL carry one `unresolved-pointer` warning for each pointer of the revisions the call created that did not resolve, within `ask-core`'s bound on them, a closing warning counting any left out, beside any other warning, and the call SHALL succeed (AD-6, FR-8).

#### Scenario: An update that adds a missing image
- **WHEN** an `update` adds an image whose file does not exist
- **THEN** the update is applied, and its result carries a warning naming the image, its pointer and reason `not-found`

#### Scenario: Many missing excerpts
- **WHEN** an agent asks with 40 excerpts whose pointers of 1,024 characters lead outside the project folder
- **THEN** the `ask` result holds the board link, the `unresolved-pointer` warnings that fit and one closing warning counting the rest, and `fetch` of the question returns every excerpt's pointer, status and reason

## ADDED Requirements

### Requirement: Warnings of ask and update results within the result size
The warnings of an `ask` result SHALL be the no-hooks warning when it applies, then the `unresolved-pointer` warnings, then the `formula` warnings, each kind within its own bound, so that an `ask` result stays under 30,000 characters whatever the input format admits; an `update` result's warnings SHALL keep the same order and bounds (AD-6).

#### Scenario: The worst ask the contract admits
- **WHEN** an agent in a session without hooks asks with 200 excerpts and images whose pointers are 1,024 characters that JSON escapes, and a Gantt plan whose every task names 50 predecessors that are no task
- **THEN** the ask is created, and its result's text is under 30,000 characters, valid against the ask result's schema, with the no-hooks warning first and a closing warning of each other kind

#### Scenario: The same on update
- **WHEN** an `update` changes that ask's question so that its excerpts and its plan are sent again
- **THEN** the update is applied, and its result's warnings, of both kinds, each with its closing warning, take at most 20,000 characters
