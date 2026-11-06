# Spec Delta

## ADDED Requirements

### Requirement: Settings sent to a board when it connects
When a board page connects with its token, `board-host` SHALL send it the `settings` message before the board itself: every presentation and behaviour key in effect, with its value and the file and key that set it, the files not applied and the warnings (FR-35, AD-14). It SHALL send `settings` again after every write.

#### Scenario: A board opens with the user's theme
- **WHEN** the user file sets `theme` to `dark` and a board connects
- **THEN** the page receives `settings` with `theme` `dark` from the user file before it receives the board

#### Scenario: Read-only rows name their file and key
- **WHEN** the project file sets `askingRule` to `with-references` and a board connects
- **THEN** `settings` gives `askingRule` the value `with-references`, the project file and the key `askingRule`

### Requirement: A board writes only presentation keys
`board-host` SHALL pass a `setting` message to the session process only when it names `theme`, `density` or `contextPlacement` with a value the configuration schema allows; any other message SHALL be refused as a `message` and nothing SHALL be written (AD-14). A board token never opens the local API (AD-11).

#### Scenario: A board tries to set the editor
- **WHEN** a client holding a board's token sends `setting` with `key` `editor` and `value` `["sh", "-c", "id"]`
- **THEN** `board-host` answers `refused` with reason `message`, and neither configuration file changes

#### Scenario: A failed write reaches the board
- **WHEN** a board writes `density` `comfortable` and the user folder cannot be written
- **THEN** the page receives `settings` whose write outcome names the user file's path and the error, and the board keeps working

### Requirement: The local API reports the configured asking rule
The local API's asking rule SHALL be the `askingRule` in effect, from the project file, else the user file, else `none`, replacing the rule fixed at `none` until configuration was read (AD-14, AD-16, FR-30).

#### Scenario: The rule from the project file
- **WHEN** the project file sets `askingRule` to `always` and a hook asks the local API for the rule
- **THEN** the answer's rule is `always`

#### Scenario: A project file that fails its check
- **WHEN** the project file sets `askingRule` to `always` and fails the schema, and the user file sets none
- **THEN** the answer's rule is `none`

### Requirement: The editor command comes from configuration
The editor command `board-host` runs on "Open in editor" SHALL be the user file's `editor` in effect, with `{file}` and `{line}` replaced, and none when it is not set or was ignored (AD-8, FR-9).

#### Scenario: The user's command runs
- **WHEN** the user file sets `editor` to `["true", "{file}"]` and the user clicks "Open in editor"
- **THEN** `true` starts with the file's absolute real path as its argument

#### Scenario: A project command never runs
- **WHEN** only the project file sets `editor` and the user clicks "Open in editor"
- **THEN** no process starts, and the outcome is `no-editor`
