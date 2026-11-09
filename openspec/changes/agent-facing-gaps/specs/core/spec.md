## ADDED Requirements

### Requirement: Expanded IDs are held against items
`ask-core` SHALL hold every ID a molecule reference of the ask has expanded to, for as long as the ask lives, against the IDs of the items an `add` or a `change` sends. It SHALL refuse an `add` whose molecule reference would expand to an ID the ask holds, held or deleted, naming the ID as in use, as `change` already does (FR-5, AD-9).

#### Scenario: A plain item named like an expanded ID
- **WHEN** on the UJ-2 ask the agent's `change` of `plan` drops the reference `schedule`, then an `add` sends a question holding a Toggle `schedule__plan`
- **THEN** the update is refused, naming `schedule__plan` as in use

#### Scenario: A reference that would expand to a deleted ID
- **WHEN** the agent deletes a question holding a plain Toggle `wbs__tree`, then adds a question holding the molecule reference `wbs`
- **THEN** the update is refused, naming `wbs__tree` as in use
