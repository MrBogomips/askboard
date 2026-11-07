## ADDED Requirements

### Requirement: Document review results through ask-core
`ask-core` SHALL check a Document review's result against the item's props in the revision the answer names, refusing a fault with the log unchanged, nothing kept and nothing published. It SHALL NOT place a quote in the document's text, which only the board renders. An accepted result SHALL be logged under the answer's `results` and returned by `fetch` of the item (AD-10, AD-20, FR-18, FR-20).

#### Scenario: A comment and a suggested edit answered
- **WHEN** an answer naming revision 1 carries a Document review's result with a comment and a suggested edit
- **THEN** the answer event holds the result under the item's ID, and `fetch` of the item returns it as its `result`

#### Scenario: A quote longer than the revision's document
- **WHEN** the agent has shortened the document in revision 2, and an answer naming revision 2 carries a quote longer than the new document
- **THEN** it is refused, naming the item and the annotation, with the log unchanged and nothing published

#### Scenario: A quote the text does not hold
- **WHEN** an answer carries a well-formed quote that the document's text does not hold
- **THEN** `ask-core` logs it, since only the board places quotes, and the answer is the user's own act on the board

#### Scenario: Annotations too large for one answer
- **WHEN** an answer carries 100 annotations whose replacements make its results longer than an answer event holds
- **THEN** the event says `tooLarge` and carries no results, and `fetch` of the item returns them in pages
