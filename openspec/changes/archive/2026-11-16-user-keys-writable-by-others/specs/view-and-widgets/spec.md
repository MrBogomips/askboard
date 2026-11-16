## ADDED Requirements

### Requirement: A user file others can write in the Keys row
When the user file's `keys` is ignored because another user can write the file, the settings panel's Keys row SHALL read "Default keys" and show, in the ask's language, a warning naming the file and saying that others can write it and that its keys are not applied; no other row SHALL show that warning (AD-14, FR-34, FR-35).

#### Scenario: The warning in English
- **WHEN** the settings carry the warning that the user file `~/.config/askboard/config.json` can be written by others
- **THEN** the Keys row reads "Default keys" and shows "~/.config/askboard/config.json can be written by others: your keys are not applied", with the path isolated as file text

#### Scenario: The warning in Italian
- **WHEN** the same settings reach a board whose ask is in Italian
- **THEN** the Keys row reads "Tasti predefiniti" and shows "~/.config/askboard/config.json può essere modificato da altri: i tuoi tasti non sono applicati"

#### Scenario: With the project's warning
- **WHEN** the settings carry the project's keys warning and the user file's writable warning
- **THEN** the Keys row shows the project's warning first, then the user file's, and the panel's other rows show neither
