## MODIFIED Requirements

### Requirement: A board writes only presentation keys
`board-host` SHALL pass a `setting` message to the session process only when it names `theme`, `density`, `contextPlacement`, `afterAnswer` or `palette` with a value the configuration schema allows; any other message SHALL be refused as a `message` and nothing SHALL be written (AD-14). A board token never opens the local API (AD-11).

#### Scenario: A board tries to set the editor
- **WHEN** a client holding a board's token sends `setting` with `key` `editor` and `value` `["sh", "-c", "id"]`
- **THEN** `board-host` answers `refused` with reason `message`, and neither configuration file changes

#### Scenario: A board tries to set keys
- **WHEN** a client holding a board's token sends `setting` with `key` `keys` and a value giving Enter to an action
- **THEN** `board-host` answers `refused` with reason `message`, and neither configuration file changes

#### Scenario: A value outside the after-answer key's set
- **WHEN** a client holding a board's token sends `setting` with `key` `afterAnswer` and `value` `"back"`
- **THEN** `board-host` answers `refused` with reason `message`, and neither configuration file changes

#### Scenario: A palette the contract does not name
- **WHEN** a client holding a board's token sends `setting` with `key` `palette` and `value` `"inchiostro"`, or `"carta\"] body{"`
- **THEN** `board-host` answers `refused` with reason `message`, and neither configuration file changes

#### Scenario: A failed write reaches the board
- **WHEN** a board writes `density` `comfortable` and the user folder cannot be written
- **THEN** the page receives `settings` whose write outcome names the user file's path and the error, and the board keeps working
