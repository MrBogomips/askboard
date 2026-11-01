# Spec Delta

## ADDED Requirements

### Requirement: Two configuration files
The session process SHALL read the project file `.askboard/config.json` under the real path of `CLAUDE_PROJECT_DIR`, and the user file `$XDG_CONFIG_HOME/askboard/config.json` when `XDG_CONFIG_HOME` is an absolute path, else `$HOME/.config/askboard/config.json` (AD-14). Without `CLAUDE_PROJECT_DIR` it SHALL read no project file, and without an absolute `HOME` or `XDG_CONFIG_HOME` no user file (AD-12).

#### Scenario: XDG_CONFIG_HOME is honoured
- **WHEN** `XDG_CONFIG_HOME` is `/tmp/x` and `/tmp/x/askboard/config.json` sets `theme` to `dark`
- **THEN** the theme in effect is `dark`, and `$HOME/.config/askboard/config.json` is not read

#### Scenario: A relative XDG_CONFIG_HOME is ignored
- **WHEN** `XDG_CONFIG_HOME` is `conf` and `$HOME/.config/askboard/config.json` sets `theme` to `light`
- **THEN** the theme in effect is `light`

#### Scenario: No project root, no project file
- **WHEN** `CLAUDE_PROJECT_DIR` is not set and the working folder holds `.askboard/config.json`
- **THEN** that file is not read

### Requirement: Read once, on first use
The session process SHALL read both files once, the first time it needs a setting, and never before its first request after `server/discover` (AD-2). Every key except the presentation keys SHALL keep that value for the rest of the session, so a change applies from the next session (FR-35).

#### Scenario: The probe sibling reads nothing
- **WHEN** a session process answers `server/discover` and exits
- **THEN** it has opened neither configuration file

#### Scenario: A behaviour change waits for the next session
- **WHEN** the user changes `defaultLanguage` in the user file while a session runs
- **THEN** that session's later asks keep the language read at first use, and the next session uses the new one

### Requirement: Merged key by key, project keys winning
The settings in effect SHALL take each key from the project file when it sets the key, else from the user file, else the key's default: `system`, `compact`, `beside`, `en-US`, `none`, `.askboard/snapshots/`, no editor and no minimum margin (AD-14, FR-30). `editor` is the one exception.

#### Scenario: The project's asking rule wins
- **WHEN** the user file sets `askingRule` to `none` and the project file sets it to `always`
- **THEN** the asking rule in effect is `always`, from the project file

#### Scenario: Keys from both files combine
- **WHEN** the user file sets `theme` to `dark` and the project file sets `density` to `comfortable`
- **THEN** both apply

### Requirement: An invalid file is never half-applied
A file that is not JSON, fails the configuration schema or names an unsupported major version SHALL contribute no key. The session process SHALL write a diagnostic to stderr naming the file and the problem, and the settings SHALL record the file as not applied with that problem (AD-14, NFR-10). An unknown key SHALL be a warning and SHALL not stop the file applying.

#### Scenario: One bad value voids the whole file
- **WHEN** the project file sets `askingRule` to `always` and `theme` to `"sepia"`
- **THEN** neither key applies, the asking rule in effect comes from the user file or is `none`, and stderr names `.askboard/config.json` and `/theme`

#### Scenario: A file from a newer major
- **WHEN** the user file names `version` `2.0`
- **THEN** no key of it applies, and the diagnostic names the version

#### Scenario: An unknown key
- **WHEN** the user file holds `version` `1.0`, `theme` `dark` and `fontSize` `14`
- **THEN** `theme` applies, and the settings carry a warning naming `fontSize`

### Requirement: The editor comes from the user file only
`editor` SHALL be read only from the user file. A project-level `editor` SHALL be ignored with a warning, whatever the user file holds (AD-8, AD-14). An `editor` in a user file, or a folder above it, that another user can write or that the user does not own SHALL also be ignored with a warning.

#### Scenario: A project file names a command
- **WHEN** the project file sets `editor` to `["sh", "-c", "curl evil"]` and the user file sets none
- **THEN** no editor is in effect, and the settings carry a warning that the project's `editor` is ignored

#### Scenario: The user's editor stands beside a project one
- **WHEN** the project file sets `editor` to `["evil", "{file}"]` and the user file sets `["code", "--goto", "{file}:{line}"]`
- **THEN** the editor in effect is the user's

#### Scenario: A user file others can write
- **WHEN** the user file is group-writable and sets `editor`
- **THEN** no editor is in effect, the warning names the file's mode, and the file's other keys apply

### Requirement: The Snapshot folder stays inside the project
`snapshotFolder` SHALL be a path relative to the session project root that stays inside it once normalised. An absolute path, a path starting with `~`, a backslash, or a `..` that leaves the root SHALL be replaced by `.askboard/snapshots/` with a warning (AD-14, FR-27).

#### Scenario: A folder inside the project
- **WHEN** the project file sets `snapshotFolder` to `docs/snapshots`
- **THEN** the Snapshot folder in effect is `docs/snapshots` under the project root

#### Scenario: A folder outside the project
- **WHEN** a file sets `snapshotFolder` to `../shared` or `/tmp/snaps`
- **THEN** the folder in effect is `.askboard/snapshots/`, with a warning naming the value

### Requirement: Presentation keys read again when a board opens
Each time a board connects, the session process SHALL read the user file's presentation keys again, so a board of any running session opens with a change written since (AD-14, FR-35). Project presentation keys SHALL keep the value read at first use.

#### Scenario: Another session's change reaches a later board
- **WHEN** a board of session A writes `theme` `dark`, and session B then opens a board
- **THEN** session B's board opens dark

### Requirement: Writing a presentation key
The session process SHALL write only `theme`, `density` and `contextPlacement`, with a schema value, into the user file: re-reading it, changing only that key, keeping every other key, and replacing the file atomically (AD-14). It SHALL refuse a write for a key the project file sets, or into a user file that fails its check, and SHALL leave that file unchanged.

#### Scenario: Only that key changes
- **WHEN** the user file holds `version`, `editor`, `askingRule` and `fontSize`, and a board writes `density` `comfortable`
- **THEN** the file holds the same four keys with the same values, in the same order, plus `density`, and no temporary file remains

#### Scenario: A key the project sets
- **WHEN** the project file sets `theme` to `light` and a board writes `theme` `dark`
- **THEN** the write is refused as set by the project, and the user file is unchanged

#### Scenario: An invalid user file is not overwritten
- **WHEN** the user file is not valid JSON and a board writes `theme` `dark`
- **THEN** the write is refused, naming the file, and its bytes are unchanged

#### Scenario: No user file yet
- **WHEN** the user folder does not exist and a board writes `theme` `dark`
- **THEN** the folder is created with mode `0700` and the file with mode `0600`, holding `version` and `theme`

### Requirement: The ask's language is resolved when it is created
When an ask is accepted, `ask-core` SHALL fix its language as the ask's `language`, else `defaultLanguage` in effect, else `en-US`, and its locale as the ask's `locale`, else its language, and SHALL keep both for the whole ask (FR-34, AD-7). An `update` SHALL not change them.

#### Scenario: The project's default language
- **WHEN** the project file sets `defaultLanguage` to `it-IT`, the user file to `en-US`, and an ask names no language
- **THEN** the ask's language and locale are `it-IT`

#### Scenario: The agent's language wins
- **WHEN** `defaultLanguage` in effect is `it-IT` and an ask sets `language` to `en-US`
- **THEN** the ask's language and locale are `en-US`

### Requirement: The project folders at the first ask
When a session's first ask is accepted, the session process SHALL create under the session project root `.askboard/`, `snapshots/`, `media/` and `patches/` when missing, and `.askboard/.gitignore` listing `snapshots/`, `media/`, `patches/` and `bench/` only when it creates that file (AD-14, FR-27). A failure SHALL be a diagnostic and SHALL not refuse the ask.

#### Scenario: A fresh project
- **WHEN** a project has no `.askboard/` and its session accepts a first ask
- **THEN** `.askboard/` holds `snapshots/`, `media/`, `patches/` and a `.gitignore` of those four lines, and no `bench/`

#### Scenario: A user's own .gitignore holds
- **WHEN** `.askboard/.gitignore` exists without `snapshots/`, because the user commits Snapshots
- **THEN** the file is unchanged after the first ask

#### Scenario: A read-only project
- **WHEN** the project root cannot be written and a first ask arrives
- **THEN** the ask is accepted, and stderr says that `.askboard/` could not be created
