## ADDED Requirements

### Requirement: A field check blocks Answer
While any field of a question, at any depth, fails its field check or holds an entry, the question's "Answer" and "Accept recommended" SHALL be disabled, "Select recommended" SHALL not mark it ready, a held answer SHALL lose its ready mark, and Submit SHALL send nothing for it and move to it. Once every field passes, each works again (NFR-10, AD-10, AD-20).

#### Scenario: A pattern not met
- **WHEN** the user types `ab-1234` in a TextField whose pattern is `^[A-Z]{2}-\d{4}$`
- **THEN** "Answer" is disabled, and typing `AB-1234` enables it

#### Scenario: Submit with a held answer
- **WHEN** in submitted delivery the user marks a question's answer ready, then empties its required DateField and presses Submit
- **THEN** the answer is no longer ready, Submit sends nothing for that question, and the board moves to it

### Requirement: Answer names the field to fix
While "Answer" is disabled by a field, its description SHALL name the first such field in document order, by its label shown as text: "Correct {label} first." for an entry or a value that fails a check, "Complete {label} first." for an empty required field (EXPERIENCE, Voice and Tone).

#### Scenario: An empty required field
- **WHEN** a question's only blocking field is the empty required TextField "Ticket"
- **THEN** "Answer" is described "Complete Ticket first."

### Requirement: Required fields
A required field's label SHALL end with "(required)", "(obbligatorio)" in it-IT, and its control SHALL be marked required for assistive technology. An empty required field SHALL show no field error (AD-10; DESIGN, Input atoms).

#### Scenario: A required DateField
- **WHEN** a board shows a DateField `{label: "Start", required: true}` with nothing typed
- **THEN** its label reads "Start (required)", its input is marked required, and no field error shows

### Requirement: A TextField's checks as the user types
A TextField whose text fails its `minLength` or `pattern` SHALL show the field error under it as the user types, SHALL keep the text as its value in the draft, restored after a reload, and SHALL clear the error once the text passes or is emptied. Enter in any field SHALL send nothing (FR-11; EXPERIENCE, Form).

#### Scenario: Restored after a reload
- **WHEN** the user reloads the board with `ab-1234` typed in that TextField
- **THEN** the field shows `ab-1234` with its field error, and "Answer" stays disabled

#### Scenario: Enter
- **WHEN** the user presses Enter in a single-line TextField of a question
- **THEN** nothing is sent and the draft keeps the text

### Requirement: The PickField
A single PickField SHALL show its options as radios with Radix's documented radio keyboard and a "Clear" while one is picked; a multiple PickField SHALL show checkboxes. Nothing SHALL be picked until the user picks (AD-10). A multiple pick outside `minItems` or `maxItems` SHALL show its field error. The value SHALL go to the draft only (FR-11, FR-13).

#### Scenario: A single pick by keyboard
- **WHEN** the user moves into a single PickField with Tab, presses the down arrow, then activates "Clear"
- **THEN** nothing is picked on Tab, the draft holds the ID of the option the arrow moved to, then no result

#### Scenario: Too few picks
- **WHEN** the user picks one option of a multiple PickField whose `minItems` is 2
- **THEN** its field error reads "Pick at least 2." and "Answer" is disabled

### Requirement: The PickField's filter
Above a PickField of more than 10 options, a filter field SHALL show only the options whose label holds its text, ignoring case. An option the filter hides SHALL stay picked. The filter's text SHALL not be part of the draft or the answer (DESIGN, Form).

#### Scenario: A hidden pick
- **WHEN** the user picks "Italy" in a PickField of 30 countries, then types `fra` in its filter
- **THEN** only the options holding "fra" show, and the draft still holds Italy's ID

### Requirement: A tab holding a field that fails a check
A tab whose panel holds, at any depth, a field whose value fails its field check SHALL carry the field-error mark, as for an entry; an empty required field SHALL add no mark (EXPERIENCE, Primitives, Layouts).

#### Scenario: A pattern not met in a hidden tab
- **WHEN** the user types `ab-1234` in the patterned TextField of the second tab and selects the first tab
- **THEN** the second tab carries the mark and reads "needs a correction"

### Requirement: Forms read-only and in Snapshots
On an answered or locked question and in a Snapshot, a Form's fields SHALL show their values read-only, a PickField its options with the picks checked and disabled and no filter or "Clear", and no field error or required mark that asks for input (AD-15).

#### Scenario: A Snapshot of a Form
- **WHEN** a Snapshot of an answered Form is opened from `file://`
- **THEN** each field shows its value read-only and the page reports no CSP violation

### Requirement: Forms end to end
A Form, a question of every field type in Groups and Tabs, SHALL be answered on the session process with one answer whose `results` hold each field's value by item ID; editing every field, reloading and coming back SHALL show the same values and the same draft (AD-9, AD-20).

#### Scenario: The remount check
- **WHEN** the user fills every field of the Form, reloads the board, and compares
- **THEN** each field shows the same value and state, the draft record is the same, and the answer then sent holds those values

### Requirement: Form strings
The required mark, the field errors of `minLength`, `pattern`, `minItems` and `maxItems`, the "Complete {label} first." description, the PickField's "Clear", filter label and empty-filter text SHALL be shown in en-US and it-IT, with the texts of EXPERIENCE's Voice and Tone (FR-34).

#### Scenario: An Italian Form
- **WHEN** an it-IT board shows a Form with a required field, a pattern not met and a filtered PickField
- **THEN** every string the Form shows is Italian
