## MODIFIED Requirements

### Requirement: Key overrides come from the user file only
`keys` SHALL be read only from the user file; a project-level `keys` SHALL be ignored with a warning, whatever the user file holds. A user file's `keys` SHALL also be ignored, with its own warning and before the key-override check, when another user can write the file or the folder holding it, when another user owns either, or when their owner and mode cannot be read; the file's other keys SHALL still apply (NFR-5, NFR-10, AD-8, AD-14).

#### Scenario: A project file sets keys
- **WHEN** the project file sets `keys` giving to the top `Mod+Alt+ArrowUp`, and the user file sets none
- **THEN** no override is in effect, and the settings carry a warning that the project's `keys` is ignored

#### Scenario: The user's keys apply
- **WHEN** the user file gives to the top `Mod+Alt+ArrowUp`
- **THEN** the settings carry that override from the user file, which no board may write

#### Scenario: Both files set keys
- **WHEN** the project file sets `keys`, even `{}`, and the user file gives to the top `Mod+Alt+ArrowUp`
- **THEN** the user's override is in effect, from the user file with no other file's value, the settings carry the project's warning, and the `settings` message built from them passes the board-protocol schema

#### Scenario: A user file others can write
- **WHEN** the user file is group-writable, sets `theme` to `dark` and gives answer the question in focus the key `x`
- **THEN** no override is in effect and every key is the default, `theme` is `dark`, the settings carry one warning that the user file can be written by others and its `keys` is ignored, stderr writes one line saying so at the session's first read, and the `settings` message built from them passes the board-protocol schema

#### Scenario: A writable file's keys are not checked
- **WHEN** the user file is owned by another user and its `keys` gives to the top `Alt+Shift+ArrowUp`, which the key-override check refuses, while the project file sets `keys`
- **THEN** the settings carry the project's warning, then the warning that the user file can be written by others, and no warning naming a rule or an action
