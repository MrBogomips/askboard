## MODIFIED Requirements

### Requirement: Asking-rule texts
The contract SHALL hold one agent-facing text for each asking rule of its closed set, in the set's order, and no text for a name outside it. The `with-references` text SHALL be the text that describes the hook's predicate. The `none` text SHALL say that the agent chooses where each question goes by how complex it is to grasp (AD-16, FR-29, FR-30).

#### Scenario: One text per rule
- **WHEN** the asking-rule texts are read
- **THEN** there is exactly one non-empty text for each of `none`, `always` and `with-references`, in that order

#### Scenario: The with-references text
- **WHEN** the `with-references` text is compared with the description of the hook's predicate
- **THEN** they are the same text

#### Scenario: The none text
- **WHEN** the `none` text is read
- **THEN** it says that no question is taken from AskUserQuestion and that the agent chooses where each question goes by how complex it is
