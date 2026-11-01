# Spec Delta

## ADDED Requirements

### Requirement: The configuration schema set
The contract SHALL hold the `configuration` schema set, owned by `ask-core`, starting at `1.0`, for both configuration files (AD-7, AD-14). A file SHALL name its `version` as `major.minor`. It SHALL allow `theme` (`system`, `light`, `dark`), `density` (`compact`, `comfortable`), `contextPlacement` (`beside`, `inline`), `defaultLanguage` (`en-US`, `it-IT`), `askingRule` (`none`, `always`, `with-references`), `snapshotFolder`, `editor` and `defaultMinimumMargin`, each optional.

#### Scenario: A file with every key validates
- **WHEN** the fixture holding `version` `1.0` and one valid value for each of the eight keys is validated against the configuration schema
- **THEN** it passes

#### Scenario: A value outside a key's set is refused, naming the key
- **WHEN** a file sets `theme` to `"sepia"` or `askingRule` to `"sometimes"`
- **THEN** validation fails with a problem whose path names that key

#### Scenario: A file without its version is refused
- **WHEN** a file holds `{"theme": "dark"}`
- **THEN** validation fails, naming `version`

#### Scenario: An unknown key passes the schema
- **WHEN** a file holds `version` `1.0` and a key `fontSize`
- **THEN** the schema passes it, and the contract's list of configuration keys does not hold `fontSize`

### Requirement: The editor key is an argument vector
`editor` SHALL be a non-empty list of non-empty strings whose first is the program, at most 32 strings of at most 1,024 characters each; `{file}` and `{line}` are its only placeholders (AD-8). A string, an empty list or a list holding a non-string SHALL fail validation.

#### Scenario: A command line as one string is refused
- **WHEN** a file sets `editor` to `"code --goto {file}:{line}"`
- **THEN** validation fails, naming `editor`

#### Scenario: An argument vector validates
- **WHEN** a file sets `editor` to `["code", "--goto", "{file}:{line}"]`
- **THEN** it passes

### Requirement: The presentation keys are a closed list
The contract SHALL name `theme`, `density` and `contextPlacement` as the presentation keys, the only keys a board may write, and SHALL name every other key of the configuration set as not writable from a board (AD-14).

#### Scenario: The writable keys
- **WHEN** a test reads the contract's presentation keys
- **THEN** they are exactly `theme`, `density` and `contextPlacement`

### Requirement: An ask's language and locale
The input format SHALL accept `language` and `locale`, each optional, each `en-US` or `it-IT` (FR-34, AD-7). Any other value SHALL fail validation, naming the field. This replaces E1's en-US-only rule.

#### Scenario: An Italian ask validates
- **WHEN** an ask sets `language` to `it-IT` and no `locale`
- **THEN** it passes

#### Scenario: English with Italian formats validates
- **WHEN** an ask sets `language` to `en-US` and `locale` to `it-IT`
- **THEN** it passes

#### Scenario: Another language is refused
- **WHEN** an ask sets `language` to `fr-FR`
- **THEN** validation fails with a problem naming `language` and saying that `en-US` and `it-IT` are accepted

### Requirement: The board document names the ask's language and locale
The board document SHALL carry the ask's resolved `language` and `locale` at its root, each `en-US` or `it-IT`. A board document without them SHALL be read as `en-US` for both, so an older Snapshot still opens (AD-12, FR-34).

#### Scenario: A board document in Italian
- **WHEN** a board document with `language` and `locale` set to `it-IT` is validated
- **THEN** it passes

#### Scenario: An older board document
- **WHEN** a board document of an earlier minor, without either field, is read by the view
- **THEN** the view shows it in English with en-US formats

### Requirement: Settings messages on the board protocol
The board protocol SHALL add the message `settings`, host to page, carrying the presentation and behaviour settings in effect, each with its value and the file and key that set it, and `setting`, page to host, carrying one key and one value. The schema of `setting` SHALL admit only the presentation keys, each with a value the configuration schema allows (AD-14).

#### Scenario: A presentation write validates
- **WHEN** the page sends `setting` with `key` `density` and `value` `comfortable`
- **THEN** the message passes the board-protocol schema

#### Scenario: Any other key fails the schema
- **WHEN** the page sends `setting` with `key` `editor`, `askingRule` or `snapshotFolder`, or with `theme` set to `"sepia"`
- **THEN** the message fails the board-protocol schema

### Requirement: Locale formats
The contract SHALL format numbers, money, percentages, calendar dates and times for `en-US` and `it-IT` with its own tables, giving the same text whatever the runtime's locale and time zone (AD-7, AD-13). Calendar dates SHALL never pass through a time zone; a time SHALL show at the UTC offset it is given, which the view takes from the viewer's time zone.

#### Scenario: The same value in both locales
- **WHEN** 12480 EUR, 1234.5, 0.185 as a percentage and the date `2026-10-27` are formatted
- **THEN** en-US gives `€12,480.00`, `1,234.5`, `18.5%` and `10/27/2026`, and it-IT gives `€ 12.480,00`, `1.234,5`, `18,5%` and `27/10/2026`

#### Scenario: A time in each locale
- **WHEN** `2026-10-28T15:12:00Z` is formatted as a date and time at the offset `+01:00`
- **THEN** en-US gives `Oct 28, 2026, 4:12 PM` and it-IT gives `28 ott 2026, 16:12`

#### Scenario: The runtime's locale and time zone change nothing
- **WHEN** the locale fixtures run under `TZ=Pacific/Kiritimati` and `TZ=America/Adak` and under the runtime locales `en-US` and `de-DE`
- **THEN** every result equals the fixture's, and `2026-10-27` formats as the same day in each run

### Requirement: Number entry in the ask's locale
The contract SHALL read a number typed in the ask's locale and return a number, an empty entry or a refusal with a reason in the ask's language (EXPERIENCE, Input atoms). In it-IT, `,` SHALL be the one decimal mark and `.` SHALL stand only between groups of three digits; an entry that breaks either SHALL be refused. The echo SHALL write the value without grouping.

#### Scenario: An Italian entry with grouping and decimals
- **WHEN** `1.234,5` is read in it-IT
- **THEN** it reads as 1234.5, and its echo is `= 1234,5`

#### Scenario: An English habit in Italian is refused
- **WHEN** `1234.5` or `1.23` is read in it-IT
- **THEN** it is refused with the reason "Usa i punti solo tra gruppi di tre cifre, come in 1.234,5."

#### Scenario: The en-US rules are unchanged
- **WHEN** `1,234.5` is read in en-US
- **THEN** it reads as 1234.5, and its echo is `= 1234.5`

### Requirement: Date entry in the ask's locale
The contract SHALL read a calendar date typed in the ask's locale, in en-US as `M/D/YYYY` and in it-IT as `D/M/YYYY`, and in both as `YYYY-MM-DD`, and SHALL refuse a day that does not exist, with a reason in the ask's language. The echo SHALL name the weekday as the ask's locale writes a long date.

#### Scenario: An Italian date
- **WHEN** `9/12/2026` is read in it-IT
- **THEN** it reads as `2026-12-09`, and its echo is `= mer 9 dic 2026`

#### Scenario: The same text in English
- **WHEN** `9/12/2026` is read in en-US
- **THEN** it reads as `2026-09-12`, and its echo is `= Sat, Sep 12, 2026`

#### Scenario: A day that does not exist
- **WHEN** `31/11/2026` is read in it-IT
- **THEN** it is refused with a reason in Italian
