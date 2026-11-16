## MODIFIED Requirements

### Requirement: The configuration schema set
The contract SHALL hold the `configuration` schema set, owned by `ask-core`, starting at `1.0`, for both configuration files (AD-7, AD-14). A file SHALL name its `version` as `major.minor`. It SHALL allow the keys of the next requirement, each optional; `keys` SHALL be bounded in shape by the schema and in meaning by the key-override check.

#### Scenario: A file with every key validates
- **WHEN** the fixture holding the set's current version and one valid value for each of the eleven keys is validated against the configuration schema
- **THEN** it passes

#### Scenario: A value outside a key's set is refused, naming the key
- **WHEN** a file sets `theme` to `"sepia"`, `askingRule` to `"sometimes"`, `afterAnswer` to `"back"` or `palette` to `"inchiostro"`
- **THEN** validation fails with a problem whose path names that key

#### Scenario: A file without its version is refused
- **WHEN** a file holds `{"theme": "dark"}`
- **THEN** validation fails, naming `version`

#### Scenario: An unknown key passes the schema
- **WHEN** a file holds `version` `1.0` and a key `fontSize`
- **THEN** the schema passes it, and the contract's list of configuration keys does not hold `fontSize`

#### Scenario: The keys map is bounded
- **WHEN** a file sets `keys` to more than 64 actions, or gives an action more than 4 combinations
- **THEN** validation fails with a problem whose path names `keys`

#### Scenario: Keys of another shape
- **WHEN** a file sets `keys` to a list, or gives an action a combination that is not a string
- **THEN** validation fails with a problem whose path names `keys`

#### Scenario: A key the check refuses passes the schema
- **WHEN** a file sets `keys` to give the keys panel `F1`
- **THEN** the schema passes it, and the key-override check refuses it

### Requirement: The configuration keys and their values
The configuration schema set SHALL allow `theme` (`system`, `light`, `dark`), `density` (`compact`, `comfortable`), `contextPlacement` (`beside`, `inline`), `afterAnswer` (`next`, `stay`; `next` when neither file sets it), `palette` (`carta`, `nordico`, `grafite`, `contrasto`; `carta` when neither file sets it), `defaultLanguage` (`en-US`, `it-IT`), `askingRule` (`none`, `always`, `with-references`), `snapshotFolder`, `editor`, `defaultMinimumMargin` and `keys`, each optional.

#### Scenario: A value outside a listed set is refused
- **WHEN** a file sets `density` to `"tight"`
- **THEN** validation fails with a problem whose path names `density`

#### Scenario: The after-answer key
- **WHEN** a file sets `afterAnswer` to `"stay"`
- **THEN** it passes, and the contract's default for `afterAnswer` is `next`

#### Scenario: The palette key
- **WHEN** a file sets `palette` to `"grafite"`
- **THEN** it passes, the contract's default for `palette` is `carta`, and its list of palettes is exactly `carta`, `nordico`, `grafite`, `contrasto`

#### Scenario: A file of the previous minor
- **WHEN** a file of the previous minor, without `palette`, is validated
- **THEN** it passes

### Requirement: The presentation keys are a closed list
The contract SHALL name `theme`, `density`, `contextPlacement`, `afterAnswer` and `palette` as the presentation keys, the only keys a board may write, and SHALL name every other key of the configuration set as not writable from a board (AD-14).

#### Scenario: The writable keys
- **WHEN** a test reads the contract's presentation keys
- **THEN** they are exactly `theme`, `density`, `contextPlacement`, `afterAnswer` and `palette`

### Requirement: Settings messages on the board protocol
The board protocol SHALL add the message `settings`, host to page, carrying the presentation and behaviour settings in effect and the user's key overrides, each with its value and the file and key that set it, and with warnings that name, for overrides not applied, the rule, the action and the combination; and `setting`, page to host, carrying one key and one value. The schema of `setting` SHALL admit only the presentation keys, each with a value the configuration schema allows (AD-14).

#### Scenario: A presentation write validates
- **WHEN** the page sends `setting` with `key` `density` and `value` `comfortable`, with `key` `afterAnswer` and `value` `stay`, or with `key` `palette` and `value` `nordico`
- **THEN** the message passes the board-protocol schema

#### Scenario: Any other key fails the schema
- **WHEN** the page sends `setting` with `key` `editor`, `askingRule`, `snapshotFolder` or `keys`, with `theme` set to `"sepia"`, with `afterAnswer` set to `"back"`, or with `palette` set to `"inchiostro"`
- **THEN** the message fails the board-protocol schema

#### Scenario: The after-answer row
- **WHEN** `settings` carries an `afterAnswer` row with its value and source, and a write outcome naming `afterAnswer`
- **THEN** the message passes the board-protocol schema, and a settings message without the row passes too

#### Scenario: The palette row
- **WHEN** `settings` carries a `palette` row with its value and source, and a write outcome naming `palette`
- **THEN** the message passes the board-protocol schema, and a settings message of the previous minor, without the row, passes too

#### Scenario: The user's keys in the settings
- **WHEN** `settings` carries the user's key overrides from the user file, or none with a warning naming a conflict's rule, action, combination and other action
- **THEN** the message passes the board-protocol schema, and a settings message without them passes too

#### Scenario: Keys that no board may receive
- **WHEN** `settings` carries a `keys` row with the other file's value, or a row from the default with a value, or a row from the user file with no value
- **THEN** the message fails the board-protocol schema

### Requirement: The presentation in the Snapshot data
The Snapshot data's record SHALL take an optional `presentation` holding both `theme` (`system`, `light` or `dark`) and `density` (`compact` or `comfortable`), and optionally `palette` (`carta`, `nordico`, `grafite` or `contrasto`), the values the configuration schema allows for those keys, and nothing else (FR-26, AD-14, AD-15). Snapshot data with no `presentation`, or a `presentation` with no `palette`, SHALL stay valid.

#### Scenario: A recorded presentation
- **WHEN** Snapshot data whose record holds `presentation` `{theme: "light", density: "comfortable"}`, or `{theme: "dark", density: "compact", palette: "grafite"}`, is validated
- **THEN** it passes, for an agent's record and for a user's

#### Scenario: A value the configuration does not allow
- **WHEN** the record's `presentation` holds `theme: "sepia"` or `palette: "inchiostro"`, omits `density`, or adds `contextPlacement`
- **THEN** validation fails, naming the field

#### Scenario: A Snapshot written before
- **WHEN** Snapshot data on the previous minor, with no `presentation` or with one holding no `palette`, is validated
- **THEN** it passes
