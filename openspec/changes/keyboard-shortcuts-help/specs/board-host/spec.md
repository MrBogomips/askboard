## MODIFIED Requirements

### Requirement: Settings sent to a board when it connects
When a board page connects with its token, `board-host` SHALL send it the `settings` message before the board itself: every presentation and behaviour key in effect and the user's key overrides, with its value and the file and key that set it, the files not applied and the warnings (FR-35, AD-14). It SHALL send `settings` again after every write.

#### Scenario: A board opens with the user's theme
- **WHEN** the user file sets `theme` to `dark` and a board connects
- **THEN** the page receives `settings` with `theme` `dark` from the user file before it receives the board

#### Scenario: Read-only rows name their file and key
- **WHEN** the project file sets `askingRule` to `with-references` and a board connects
- **THEN** `settings` gives `askingRule` the value `with-references`, the project file and the key `askingRule`

#### Scenario: A board opens with the user's keys
- **WHEN** the user file gives to the top `Mod+Alt+ArrowUp` and a board connects
- **THEN** the page receives `settings` carrying that override from the user file, not writable, before it receives the board

### Requirement: A board writes only presentation keys
`board-host` SHALL pass a `setting` message to the session process only when it names `theme`, `density` or `contextPlacement` with a value the configuration schema allows; any other message SHALL be refused as a `message` and nothing SHALL be written (AD-14). A board token never opens the local API (AD-11).

#### Scenario: A board tries to set the editor
- **WHEN** a client holding a board's token sends `setting` with `key` `editor` and `value` `["sh", "-c", "id"]`
- **THEN** `board-host` answers `refused` with reason `message`, and neither configuration file changes

#### Scenario: A board tries to set keys
- **WHEN** a client holding a board's token sends `setting` with `key` `keys` and a value giving Enter to an action
- **THEN** `board-host` answers `refused` with reason `message`, and neither configuration file changes

#### Scenario: A failed write reaches the board
- **WHEN** a board writes `density` `comfortable` and the user folder cannot be written
- **THEN** the page receives `settings` whose write outcome names the user file's path and the error, and the board keeps working
