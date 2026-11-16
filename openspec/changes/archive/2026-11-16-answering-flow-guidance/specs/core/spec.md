## MODIFIED Requirements

### Requirement: Writing a presentation key
The session process SHALL write only `theme`, `density`, `contextPlacement` and `afterAnswer`, with a schema value, into the user file: re-reading it, changing only that key, keeping every other key, and replacing the file atomically (AD-14). It SHALL refuse a write for a key the project file sets, or into a user file that fails its check, and SHALL leave that file unchanged.

#### Scenario: Only that key changes
- **WHEN** the user file holds `version`, `editor`, `askingRule` and `fontSize`, and a board writes `density` `comfortable`
- **THEN** the file holds the same four keys with the same values, in the same order, plus `density`, and no temporary file remains

#### Scenario: The after-answer key
- **WHEN** the user file holds `version` and `theme`, and a board writes `afterAnswer` `stay`
- **THEN** the file holds `version`, `theme` and `afterAnswer` `stay`, and the settings sent after the write show the row from the user file

#### Scenario: A key the project sets
- **WHEN** the project file sets `theme` to `light` and a board writes `theme` `dark`
- **THEN** the write is refused as set by the project, and the user file is unchanged

#### Scenario: An invalid user file is not overwritten
- **WHEN** the user file is not valid JSON and a board writes `theme` `dark`
- **THEN** the write is refused, naming the file, and its bytes are unchanged

#### Scenario: No user file yet
- **WHEN** the user folder does not exist and a board writes `theme` `dark`
- **THEN** the folder is created with mode `0700` and the file with mode `0600`, holding `version` and `theme`
