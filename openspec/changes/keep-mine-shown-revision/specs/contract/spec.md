## MODIFIED Requirements

### Requirement: WBS answer derived values
The derived values a Tree with `pert` gives an answer SHALL be each node's `expected` and `spread` whose value, rounded half away from zero to two decimals, differs from the board as sent or whose node the agent did not send, and the item's `expected` and `spread` always, each rounded so; a value in error SHALL be left out. An answer that carries the Tree's value and names its question's current revision SHALL carry these derived values beside it (F7, FR-12, FR-20).

#### Scenario: The approved UJ-2 values
- **WHEN** the UJ-2 work breakdown is computed after the approved answer's edits and compared with the board as sent
- **THEN** its derived values are exactly the approved answer's twelve `wbs.` keys and values, under the Tree's item ID

#### Scenario: An untouched work breakdown
- **WHEN** the user changed nothing in the work breakdown
- **THEN** its derived values are the item's `expected` and `spread` only
