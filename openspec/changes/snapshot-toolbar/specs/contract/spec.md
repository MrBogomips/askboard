## ADDED Requirements

### Requirement: The presentation in the Snapshot data
The Snapshot data's record SHALL take an optional `presentation` holding both `theme` (`system`, `light` or `dark`) and `density` (`compact` or `comfortable`), the values the configuration schema allows for those keys, and nothing else (FR-26, AD-14, AD-15). Snapshot data with no `presentation` SHALL stay valid.

#### Scenario: A recorded presentation
- **WHEN** Snapshot data whose record holds `presentation` `{theme: "light", density: "comfortable"}` is validated
- **THEN** it passes, for an agent's record and for a user's

#### Scenario: A value the configuration does not allow
- **WHEN** the record's `presentation` holds `theme: "sepia"`, omits `density`, or adds `contextPlacement`
- **THEN** validation fails, naming the field

#### Scenario: A Snapshot written before
- **WHEN** Snapshot data on the previous minor, with no `presentation`, is validated
- **THEN** it passes

### Requirement: This change's Snapshot data at its next minor
The Snapshot data SHALL take the minor after the one `main` holds when this change rebases, adding only the optional `presentation`; every other set SHALL keep `main`'s version (AD-7).

#### Scenario: The versions
- **WHEN** the contract's schema sets are listed
- **THEN** `snapshot-data` names `main`'s minor plus one, and every other set names `main`'s version
