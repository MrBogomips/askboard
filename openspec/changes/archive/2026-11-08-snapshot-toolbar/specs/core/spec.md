## ADDED Requirements

### Requirement: The presentation a Snapshot records
`ask-core` SHALL record in each Snapshot it takes with a configuration port, the agent's and the board's, the theme and density a board would open with at that moment: the user file's presentation keys as they are then, under the project file's, each key's default when neither sets it, after every presentation write already requested (FR-26, FR-35, AD-14).

#### Scenario: Light chosen on the board
- **WHEN** the board writes `theme` `light` and `density` `comfortable`, and the board then takes a Snapshot
- **THEN** the writer receives a record whose `presentation` is `{theme: "light", density: "comfortable"}`

#### Scenario: The agent's Snapshot
- **WHEN** the user file sets `theme` `dark` and the agent takes a Snapshot
- **THEN** the record's `presentation` names `dark`, and `density` `compact` by default

#### Scenario: The project sets the theme
- **WHEN** the project file sets `theme` `light` and the user file `dark`
- **THEN** the record names `light`

#### Scenario: A discarded ask
- **WHEN** a Snapshot of a discarded ask is requested
- **THEN** the answer is `discarded` and nothing reaches the writer, as before

### Requirement: The presentation when the settings cannot be read
A user file that cannot be read or fails its check SHALL count as it does when a board opens: it contributes no key, so the record holds the project file's keys and each other key's default. When the configuration cannot give the settings at all, the record SHALL hold no `presentation`, the failure SHALL be reported on stderr, and the Snapshot SHALL NOT be refused or delayed past that read (FR-35, NFR-10).

#### Scenario: The user file cannot be read
- **WHEN** the user file cannot be read or fails its check as a Snapshot is taken, and the project file sets `density` `comfortable`
- **THEN** the Snapshot is written, and its record's `presentation` is `{theme: "system", density: "comfortable"}`, as a board opening then would show

#### Scenario: The settings cannot be read
- **WHEN** the configuration cannot give the settings at all as a Snapshot is taken
- **THEN** the Snapshot is written with no `presentation`, and the failure is reported on stderr
