## MODIFIED Requirements

### Requirement: The Snapshot view's chrome
An opened Snapshot SHALL start with the line "Snapshot · taken <when> by <whom> · read-only", noting unsent work when the data records it; it SHALL hide Answer, Postpone, More, "Ask a follow-up", Settings, the bottom action bar and the agent pill, and keep the ask state pill, delivery receipts and the quick toggles, Theme and density, each shown once (EXPERIENCE Snapshots).

#### Scenario: The agent's Snapshot
- **WHEN** the agent's Snapshot of an answered ask is opened
- **THEN** the top line says it was taken by the agent, the header shows "answered" and no agent state, and no answer control is shown

#### Scenario: One toolbar
- **WHEN** a Snapshot is opened from `file://`
- **THEN** the header shows one "Theme" group and one "Compact | Comfortable" group, in the ask's language, and no "Settings"

### Requirement: Theme in a Snapshot
An opened Snapshot SHALL start in the theme its record's `presentation` names, `system` following the viewer's system theme, and in the viewer's system theme when the record names none; its Theme control SHALL switch the theme and save nothing, and the page SHALL use no browser storage (EXPERIENCE Snapshots and Dark theme, AD-8).

#### Scenario: Light on the board, dark system
- **WHEN** a Snapshot recording `theme` `light` is opened with the system set to dark
- **THEN** the board shows in light, with "Light" pressed in the Theme control

#### Scenario: System recorded
- **WHEN** a Snapshot recording `theme` `system` is opened with the system set to dark
- **THEN** the board shows in dark, with "System" pressed

#### Scenario: Dark system theme
- **WHEN** a Snapshot with no recorded presentation is opened with the system set to dark and the user switches to Light
- **THEN** the board shows in dark, then in light, no browser storage is touched, and reopening the file shows it dark again with "System" pressed

## ADDED Requirements

### Requirement: Density in a Snapshot
An opened Snapshot SHALL start in the density its record's `presentation` names, else compact, and its "Compact | Comfortable" switch SHALL change the density of the page alone, saving nothing and using no browser storage; no quick toggle in a Snapshot SHALL be disabled by a project setting (EXPERIENCE Snapshots, AD-8).

#### Scenario: Comfortable on the board
- **WHEN** a Snapshot recording `density` `comfortable` is opened
- **THEN** the page uses the comfortable spacing, with "Comfortable" pressed

#### Scenario: Switching density
- **WHEN** the user switches an opened Snapshot to Compact and reopens the file
- **THEN** the page becomes compact at once, no browser storage is touched, and the reopened file is comfortable again

#### Scenario: Taken from the board end to end
- **WHEN** the user picks Light and Comfortable on a board with the system set to dark, takes a Snapshot and opens its file
- **THEN** the Snapshot shows in light and comfortable, with one Theme control
