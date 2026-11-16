## ADDED Requirements

### Requirement: The help skill names a user file others can write
`askboard-help`'s key configuration reference SHALL say that a user file another user can write, or whose folder another user can write, has its `keys` ignored with a warning, and how the user makes the file and its folder writable by them alone, within the help skill's budgets (NFR-12, AD-14).

#### Scenario: A user file others can write
- **WHEN** `askboard-help`'s key configuration reference is read
- **THEN** it says that the keys of a user file others can write are ignored with a warning, and that `chmod go-w` on the file and its folder makes them apply at the next board

#### Scenario: Within the help skill's budgets
- **WHEN** the generator writes `askboard-help` with that sentence
- **THEN** every file of the skill stays within the help skill's budgets, which this change leaves as they are
