## ADDED Requirements

### Requirement: Key overrides come from the user file only
`keys` SHALL be read only from the user file; a project-level `keys` SHALL be ignored with a warning, whatever the user file holds (NFR-5, AD-8, AD-14).

#### Scenario: A project file sets keys
- **WHEN** the project file sets `keys` giving to the top `Mod+Alt+ArrowUp`, and the user file sets none
- **THEN** no override is in effect, and the settings carry a warning that the project's `keys` is ignored

#### Scenario: The user's keys apply
- **WHEN** the user file gives to the top `Mod+Alt+ArrowUp`
- **THEN** the settings carry that override from the user file, which no board may write

### Requirement: Key overrides are never half-applied
The user's `keys` SHALL apply only when it passes the key-override check against every registered key table. Otherwise none of it SHALL apply, every widget SHALL keep its default keys, the file's other keys SHALL still apply, and the settings and stderr SHALL name each problem's rule, action and combination (NFR-10, NFR-12, AD-14).

#### Scenario: One refused combination voids the overrides only
- **WHEN** the user file sets `theme` to `dark` and gives to the top `Alt+Shift+ArrowUp`
- **THEN** no override is in effect, `theme` is `dark`, the settings carry a warning naming the conflict, to the top, the combination and move up, and stderr names them, quoted

#### Scenario: Keys of another shape void the file
- **WHEN** the user file sets `theme` to `dark` and `keys` to a list
- **THEN** no key of that file applies, as for any file that fails the configuration schema

## MODIFIED Requirements

### Requirement: Read once, on first use
The session process SHALL read both files once, the first time it needs a setting, and never before its first request after `server/discover` (AD-2). Every key except the presentation keys and `keys` SHALL keep that value for the rest of the session, so a change applies from the next session (FR-35).

#### Scenario: The probe sibling reads nothing
- **WHEN** a session process answers `server/discover` and exits
- **THEN** it has opened neither configuration file

#### Scenario: A behaviour change waits for the next session
- **WHEN** the user changes `defaultLanguage` in the user file while a session runs
- **THEN** that session's later asks keep the language read at first use, and the next session uses the new one

### Requirement: Merged key by key, project keys winning
The settings in effect SHALL take each key from the project file when it sets the key, else from the user file, else the key's default: `system`, `compact`, `beside`, `en-US`, `none`, `.askboard/snapshots/`, no editor, no minimum margin and no key overrides (AD-14, FR-30). `editor` and `keys` are the exceptions: each is read from the user file only.

#### Scenario: The project's asking rule wins
- **WHEN** the user file sets `askingRule` to `none` and the project file sets it to `always`
- **THEN** the asking rule in effect is `always`, from the project file

#### Scenario: Keys from both files combine
- **WHEN** the user file sets `theme` to `dark` and the project file sets `density` to `comfortable`
- **THEN** both apply

### Requirement: Presentation keys read again when a board opens
Each time a board connects, the session process SHALL read the user file's presentation keys and `keys` again, so a board of any running session opens with a change written since (AD-14, FR-35). Project presentation keys SHALL keep the value read at first use.

#### Scenario: Another session's change reaches a later board
- **WHEN** a board of session A writes `theme` `dark`, and session B then opens a board
- **THEN** session B's board opens dark

#### Scenario: Keys edited between two boards
- **WHEN** the user adds `keys` to the user file while a session runs, and the session then opens a board
- **THEN** that board's settings carry the new overrides, checked as at first use
