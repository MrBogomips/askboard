# Spec Delta

## ADDED Requirements

### Requirement: The board's interface in the ask's language
The view and the board page SHALL show every string of their own in the ask's language, en-US or it-IT, and SHALL set the document's `lang` to it; the agent's content SHALL show as the agent sent it (FR-34; EXPERIENCE, Localization, Voice and Tone). No control on the board SHALL change the language.

#### Scenario: An Italian ask
- **WHEN** an ask is sent with `language` `it-IT`
- **THEN** the board shows "Rispondi", "Rinvia" and "Impostazioni", and the board page's and the view's `lang` are `it`

#### Scenario: The agent's text is untouched
- **WHEN** an it-IT ask's question text is English
- **THEN** the question shows in English, inside the Italian interface

#### Scenario: No language control
- **WHEN** a user looks for a way to change the language on any board
- **THEN** there is none, and the settings panel shows the language read-only

### Requirement: Every string in both languages
Every string the view and the board page show SHALL exist in both en-US and it-IT, and a test SHALL fail when a string exists in one language only (EXPERIENCE, Open Items 4).

#### Scenario: A string added in English only
- **WHEN** a change adds a string to the en-US table and not to the it-IT one
- **THEN** the view's tests fail, naming the string's key

### Requirement: Values shown in the ask's locale
Numbers, money, percentages, dates and times SHALL show in the ask's locale, which may differ from its language; answers SHALL carry the contract's formats whatever the locale (FR-34, AD-7). Times SHALL show in the viewer's time zone.

#### Scenario: English with Italian formats
- **WHEN** an ask in `en-US` with `locale` `it-IT` holds 1234.5 in a Tree's number column
- **THEN** the board's interface is in English and the value shows as `1.234,5`

#### Scenario: The answer is locale-free
- **WHEN** the user types `1.234,5` in an it-IT board's number field and answers
- **THEN** the answer carries the JSON number 1234.5

### Requirement: Number and date entry in the ask's locale
A number field and a date field SHALL read the user's typing with the contract's entry rules for the ask's locale, echo the parsed value beside the field, and show a refusal's reason in the ask's language as a field error (EXPERIENCE, Input atoms).

#### Scenario: An Italian number
- **WHEN** the user types `1.234,5` in a number field of an it-IT board
- **THEN** the field echoes `= 1234,5` and shows no error

#### Scenario: An ambiguous Italian entry
- **WHEN** the user types `1234.5` in a number field of an it-IT board
- **THEN** the field shows "Usa i punti solo tra gruppi di tre cifre, come in 1.234,5." and the value is not taken

#### Scenario: An Italian date in the Gantt
- **WHEN** the user types `9/12/2026` as a task's start on an it-IT board
- **THEN** the field echoes `= mer 9 dic 2026` and the task starts on `2026-12-09`

### Requirement: The settings panel
Every board SHALL open a settings panel from "Settings" in the context header: a non-modal side sheet on the board page, closed with Esc or its close control, holding the presentation keys as controls, the ask's language read-only, and each behaviour key read-only with its value, file and key (FR-35; EXPERIENCE, Preferences and Settings; DESIGN, Settings panel).

#### Scenario: The panel's three groups
- **WHEN** the user presses "Settings"
- **THEN** the panel shows Theme, Density and Context placement as segmented controls, then the Language indicator, then default language, asking rules, Snapshot folder and editor under "Applies from the next session"

#### Scenario: The board stays usable
- **WHEN** the panel is open and the user answers a question
- **THEN** the answer is sent, and the panel stays open

#### Scenario: From the keyboard
- **WHEN** the user opens the panel with the keyboard, moves through a segmented control with the arrow keys and presses Esc
- **THEN** the setting changes, the panel closes, and focus returns to "Settings"

### Requirement: Presentation changes apply at once and persist
Changing theme or density from the header's quick toggles or the panel, or the context-placement default from the panel, SHALL apply to that board at once and be written as the user-level setting, so a board opened later opens with it (FR-35). No setting SHALL be kept in the browser's storage.

#### Scenario: Theme reaches a later board
- **WHEN** the user picks Dark on one board and the agent then sends a new ask
- **THEN** the new board opens dark

#### Scenario: Clearing the browser's storage
- **WHEN** the user clears the browser's storage and opens a board
- **THEN** the board opens with the settings from the configuration files

#### Scenario: A write that fails
- **WHEN** the user picks Comfortable and the user file cannot be written
- **THEN** the board turns comfortable, and the panel shows an error under Density naming the file's path

### Requirement: Keys set by the project are read-only on the board
A presentation key the project file sets SHALL show read-only in the panel with the project file and key, and its header toggle SHALL be disabled, its description naming that file and key (AD-14; EXPERIENCE, Preferences and Settings, Scopes).

#### Scenario: The project fixes the density
- **WHEN** the project file sets `density` to `comfortable`
- **THEN** the board opens comfortable, the panel's Density row is read-only with `.askboard/config.json · density`, and the header's density control is disabled

### Requirement: Theme, density and context placement
Theme SHALL be System, which follows the system's scheme and is the default, Light or Dark, on the board page and in the view. Density SHALL be Compact, the default, or Comfortable, re-pointing spacing and type. The context-placement default SHALL place each question's context, and a question's own control SHALL override it on that question (FR-13; DESIGN, Layout & Spacing).

#### Scenario: System follows the system
- **WHEN** the theme is System and the system switches to dark
- **THEN** the board page and the view turn dark

#### Scenario: Comfortable density
- **WHEN** the user picks Comfortable
- **THEN** controls are 32 px high and header rows 40 px, and Compact brings back 28 px controls and 32 px header rows

#### Scenario: Inline by default
- **WHEN** the context-placement default is `inline`
- **THEN** a question with excerpts shows them under its text, and its "Beside | Inline" control still moves that question beside

### Requirement: Snapshots in the ask's language
An opened Snapshot SHALL show its strings and values in the ask's language and locale from its board document, and its Theme control SHALL save nothing (FR-27; EXPERIENCE, Snapshots).

#### Scenario: An Italian Snapshot
- **WHEN** a Snapshot of an it-IT ask is opened from disk
- **THEN** its strings are Italian and its values use it-IT formats, and picking Dark writes no file and no browser storage
