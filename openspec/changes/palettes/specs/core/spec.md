## MODIFIED Requirements

### Requirement: Writing a presentation key
The session process SHALL write only `theme`, `density`, `contextPlacement`, `afterAnswer` and `palette`, with a schema value, into the user file: re-reading it, changing only that key, keeping every other key, and replacing the file atomically (AD-14). It SHALL refuse a write for a key the project file sets, or into a user file that fails its check, and SHALL leave that file unchanged.

#### Scenario: Only that key changes
- **WHEN** the user file holds `version`, `editor`, `askingRule` and `fontSize`, and a board writes `density` `comfortable`
- **THEN** the file holds the same four keys with the same values, in the same order, plus `density`, and no temporary file remains

#### Scenario: The after-answer key
- **WHEN** the user file holds `version` and `theme`, and a board writes `afterAnswer` `stay`
- **THEN** the file holds `version`, `theme` and `afterAnswer` `stay`, and the settings sent after the write show the row from the user file

#### Scenario: The palette key
- **WHEN** the user file holds `version` and `theme`, and a board writes `palette` `grafite`
- **THEN** the file holds `version`, `theme` and `palette` `grafite`, and the settings sent after the write show the row from the user file

#### Scenario: A key the project sets
- **WHEN** the project file sets `theme` to `light` and a board writes `theme` `dark`
- **THEN** the write is refused as set by the project, and the user file is unchanged

#### Scenario: A palette the project sets
- **WHEN** the project file sets `palette` to `contrasto` and a board writes `palette` `carta`
- **THEN** the write is refused as set by the project, and the user file is unchanged

#### Scenario: An invalid user file is not overwritten
- **WHEN** the user file is not valid JSON and a board writes `theme` `dark`
- **THEN** the write is refused, naming the file, and its bytes are unchanged

#### Scenario: No user file yet
- **WHEN** the user folder does not exist and a board writes `theme` `dark`
- **THEN** the folder is created with mode `0700` and the file with mode `0600`, holding `version` and `theme`

### Requirement: The presentation a Snapshot records
`ask-core` SHALL record in each Snapshot it takes with a configuration port, the agent's and the board's, the theme, density and palette a board would open with at that moment: the user file's presentation keys as they are then, under the project file's, each key's default when neither sets it, after every presentation write already requested (FR-26, FR-35, AD-14).

#### Scenario: Light chosen on the board
- **WHEN** the board writes `theme` `light`, `density` `comfortable` and `palette` `nordico`, and the board then takes a Snapshot
- **THEN** the writer receives a record whose `presentation` is `{theme: "light", density: "comfortable", palette: "nordico"}`

#### Scenario: The agent's Snapshot
- **WHEN** the user file sets `theme` `dark` and the agent takes a Snapshot
- **THEN** the record's `presentation` names `dark`, `density` `compact` and `palette` `carta` by default

#### Scenario: The project sets the theme
- **WHEN** the project file sets `theme` `light` and `palette` `contrasto`, and the user file `theme` `dark` and `palette` `grafite`
- **THEN** the record names `light` and `contrasto`

#### Scenario: A discarded ask
- **WHEN** a Snapshot of a discarded ask is requested
- **THEN** the answer is `discarded` and nothing reaches the writer, as before

### Requirement: The presentation when the settings cannot be read
A user file that cannot be read or fails its check SHALL count as it does when a board opens: it contributes no key, so the record holds the project file's keys and each other key's default. When the configuration cannot give the settings at all, the record SHALL hold no `presentation`, the failure SHALL be reported on stderr, and the Snapshot SHALL NOT be refused or delayed past that read (FR-35, NFR-10).

#### Scenario: The user file cannot be read
- **WHEN** the user file cannot be read or fails its check as a Snapshot is taken, and the project file sets `density` `comfortable`
- **THEN** the Snapshot is written, and its record's `presentation` is `{theme: "system", density: "comfortable", palette: "carta"}`, as a board opening then would show

#### Scenario: The settings cannot be read
- **WHEN** the configuration cannot give the settings at all as a Snapshot is taken
- **THEN** the Snapshot is written with no `presentation`, and the failure is reported on stderr
