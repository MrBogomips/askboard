## ADDED Requirements

### Requirement: Radios with manual activation
A single choice, among a question's options or in a single PickField, SHALL be a group of radios that exposes each radio's checked state. Tab SHALL enter on the checked radio, else the first one shown. The arrow keys SHALL move the focus, wrapping, and Home and End to the ends, checking nothing. Space, Enter or a click SHALL check an unchecked radio and SHALL change nothing on a checked one (NFR-12, AD-10; EXPERIENCE Option, Keyboard core).

#### Scenario: Tab returns to the selected option
- **WHEN** the user has selected "SQLite", moves the focus out of the options with Tab and back with Shift+Tab
- **THEN** the focus is on "SQLite", which is still the only selected option

#### Scenario: The arrow keys wrap
- **WHEN** the focus is on the last option and the user presses the down arrow, then End
- **THEN** the focus moves to the first option, then to the last, and nothing is selected

#### Scenario: "Other…" text kept while moving
- **WHEN** the user has selected "Other…" and typed text in it, then presses the up arrow twice
- **THEN** "Other…" stays selected with its text and the draft is unchanged

#### Scenario: The selected option pressed again
- **WHEN** in submitted delivery the user presses Space, then Enter, on the selected option of a question whose answer is ready
- **THEN** the draft is unchanged and the answer stays ready

#### Scenario: A pick the filter hides
- **WHEN** a single PickField's picked option is hidden by its filter and the user tabs into its options
- **THEN** the focus is on the first option shown and the pick is unchanged

## MODIFIED Requirements

### Requirement: The PickField
A single PickField SHALL show its options as radios with manual activation (Radios with manual activation) and a "Clear" while one is picked; a multiple PickField SHALL show checkboxes. Nothing SHALL be picked until the user picks (AD-10). A multiple pick outside `minItems` or `maxItems` SHALL show its field error. The value SHALL go to the draft only (FR-11, FR-13).

#### Scenario: A single pick by keyboard
- **WHEN** the user moves into a single PickField with Tab, presses the down arrow, then Space, then activates "Clear"
- **THEN** nothing is picked on Tab or on the arrow, the draft holds the ID of the option the arrow moved the focus to once Space is pressed, then no result

#### Scenario: Too few picks
- **WHEN** the user picks one option of a multiple PickField whose `minItems` is 2
- **THEN** its field error reads "Pick at least 2." and "Answer" is disabled
