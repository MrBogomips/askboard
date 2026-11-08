## ADDED Requirements

### Requirement: Field checks on answers
`ask-core` SHALL refuse an answer, never a decline or a note, whose question holds at any depth a field that fails its `required`, `minLength`, `minItems` or `maxItems` check against the answer's results, naming the item and the check; it SHALL append, keep and publish nothing for it (NFR-10, AD-10).

#### Scenario: A required field left empty
- **WHEN** the board sends an answer to a question whose required TextField, two layouts deep, has no result
- **THEN** `ask-core` refuses it naming the item and `required`, and `collect` returns nothing for it

#### Scenario: A note alone
- **WHEN** the user sends only a note on that question
- **THEN** `ask-core` takes it as feedback, as before

#### Scenario: A decline
- **WHEN** the user declines that question
- **THEN** `ask-core` takes the decline

#### Scenario: Too many picks
- **WHEN** an answer gives a multiple PickField with `maxItems: 2` three option IDs
- **THEN** `ask-core` refuses it naming the item and `maxItems`

### Requirement: The pattern stays on the board
`ask-core` SHALL NOT run a TextField's `pattern` on an answer's text: the session process runs no agent pattern on user text. An answer whose text the pattern would not match SHALL be taken when every other check passes (NFR-10, AD-8).

#### Scenario: A text the pattern does not match
- **WHEN** an answer gives `"ab-1234"` for a TextField whose pattern is `^[A-Z]{2}-\d{4}$`, and every other check passes
- **THEN** `ask-core` takes the answer with that text as the item's result

### Requirement: Answers of PickFields
`ask-core` SHALL check a PickField's result against its type and props, keep it with the answer keyed by the item's ID, and return it through `fetch` of the item (FR-18, FR-20).

#### Scenario: A pick fetched
- **WHEN** the user answers a question whose PickField `region` holds `"eu"`
- **THEN** the answer's `results` hold `region: "eu"`, and `fetch` of `region` returns that result
