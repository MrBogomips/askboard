## ADDED Requirements

### Requirement: The presentation a Snapshot records
`ask-core` SHALL record in each Snapshot it takes, the agent's and the board's, the theme and density a board would open with at that moment: the user file's presentation keys as they are then, under the project file's, each key's default when neither sets it, after every presentation write already requested (FR-26, FR-35, AD-14). A failure to read them SHALL leave the record without `presentation` and SHALL NOT refuse or delay the Snapshot past that read.

#### Scenario: Light chosen on the board
- **WHEN** the board writes `theme` `light` and `density` `comfortable`, and the board then takes a Snapshot
- **THEN** the writer receives a record whose `presentation` is `{theme: "light", density: "comfortable"}`

#### Scenario: The agent's Snapshot
- **WHEN** the user file sets `theme` `dark` and the agent takes a Snapshot
- **THEN** the record's `presentation` names `dark`, and `density` `compact` by default

#### Scenario: The project sets the theme
- **WHEN** the project file sets `theme` `light` and the user file `dark`
- **THEN** the record names `light`

#### Scenario: The settings cannot be read
- **WHEN** reading the configuration fails as a Snapshot is taken
- **THEN** the Snapshot is written with no `presentation`, and the failure is reported on stderr

#### Scenario: A discarded ask
- **WHEN** a Snapshot of a discarded ask is requested
- **THEN** the answer is `discarded` and nothing reaches the writer, as before
