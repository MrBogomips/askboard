## ADDED Requirements

### Requirement: Named palettes
The board SHALL offer four palettes, Carta (the default), Nordico, Grafite and Contrasto, each giving every colour role of DESIGN.md a light and a dark value. The palette in effect SHALL be named by a `data-palette` attribute on the root of the board page and of the view, absent for Carta, beside the `.dark` and `.comfortable` classes. Components SHALL read only the roles, so a palette changes no component (DESIGN, Colors).

#### Scenario: No palette set
- **WHEN** neither configuration file sets `palette` and a board opens, in light and then in dark
- **THEN** neither root carries `data-palette`, and every colour variable resolves to the value it had before palettes

#### Scenario: Grafite in both schemes
- **WHEN** the palette is Grafite and the theme switches from Light to Dark
- **THEN** both roots carry `data-palette="grafite"`, and `--card` resolves to Grafite's light value, then to its dark value

#### Scenario: Every palette and scheme
- **WHEN** each palette is applied in light and in dark
- **THEN** every colour role variable resolves to that palette's value in DESIGN.md for that scheme, and every alias to its target's value

### Requirement: Palettes in the token build
The view build SHALL read each palette from DESIGN.md's YAML and emit, for each palette but Carta, one stylesheet scoped to `:root[data-palette=<name>]` and its `.dark` form, with every colour role and no alias. It SHALL fail, naming the palette and the key, when a palette lacks a role or its dark twin, names a key that is no colour role, or sets an alias, and when DESIGN.md's palettes differ from the contract's list (DESIGN, Colors).

#### Scenario: A missing dark twin
- **WHEN** a palette in DESIGN.md sets `card` and not `card-dark`
- **THEN** the build fails with a message naming the palette and `card-dark`

#### Scenario: An alias set by a palette
- **WHEN** a palette sets `critical` or `recommended`
- **THEN** the build fails, naming the palette and the key

#### Scenario: A palette the contract does not name
- **WHEN** DESIGN.md holds a palette `inchiostro`, or holds no `nordico`
- **THEN** the build fails, naming that palette

#### Scenario: Carta's stylesheet unchanged
- **WHEN** the view is built
- **THEN** the default tokens' `:root` and `.dark` rules are byte-equal to those built from DESIGN.md's `colors` alone

### Requirement: The palette preference
The "Theme" popover, after its Density control, and the settings panel SHALL offer a palette row, "Carta | Nordico | Grafite | Contrasto". A pick SHALL apply at once to the board page and the view and be written as the user-level setting, so a later board opens with it. A palette the project file sets SHALL show read-only, naming that file and key. No palette SHALL be kept in browser storage (FR-35, AD-8, AD-14; EXPERIENCE, Preferences and Settings).

#### Scenario: Picked in the Theme popover
- **WHEN** the user activates "Theme", picks Grafite in the popover's palette row, and the agent then sends a new ask
- **THEN** both roots carry `data-palette="grafite"` at once, the user file holds `palette` `grafite`, and the new board opens in Grafite

#### Scenario: From the keyboard
- **WHEN** the user opens the settings panel with the keyboard, moves through the palette row with the arrow keys and presses Esc
- **THEN** the palette changes, the panel closes, and focus returns to "Settings"

#### Scenario: The project sets the palette
- **WHEN** the project file sets `palette` to `contrasto`
- **THEN** the board opens in Contrasto, the popover's palette row is disabled with a description naming `.askboard/config.json · palette`, and the panel's row is read-only

#### Scenario: A write that fails
- **WHEN** the user picks Nordico and the user file cannot be written
- **THEN** the board turns Nordico, and the panel shows an error under Palette naming the file's path

### Requirement: High contrast follows the system
While the theme preference is System and the system asks for more contrast, the board page and the view SHALL use Contrasto, whatever palette is chosen, and SHALL return to the chosen palette when the system stops asking or the theme is set to Light or Dark. The palette row SHALL keep the user's choice pressed and say that the system's contrast is in use. Nothing SHALL be written to a configuration file (DESIGN, Colors; EXPERIENCE, Accessibility Floor).

#### Scenario: More contrast under System
- **WHEN** the theme is System, the palette Nordico, and the system asks for more contrast
- **THEN** both roots carry `data-palette="contrasto"`, "Nordico" stays pressed, and the row's note says Contrasto is in use for the system

#### Scenario: An explicit theme
- **WHEN** the user then picks Dark
- **THEN** the board shows Nordico in dark, and the note is gone

#### Scenario: The system stops asking
- **WHEN** the theme is System and the system stops asking for more contrast
- **THEN** the board returns to Nordico without a reload, and the user file is unchanged

### Requirement: Contrasto's marks
Contrasto SHALL draw the focus ring 3 px wide and the borders of question cards, buttons and inputs 1.5 px wide, the other palettes keeping today's widths. Its values SHALL target 7:1 for text and 4.5:1 for UI marks against their surfaces, light and dark, and the contrast report SHALL name each pair under those targets (DESIGN, Colors and Contrast).

#### Scenario: The focus ring
- **WHEN** a button takes keyboard focus under Contrasto, then under Carta
- **THEN** its outline is 3 px wide in the ring colour, then 2 px

#### Scenario: The card's border
- **WHEN** a board shows a question card under Contrasto
- **THEN** the card's border is 1.5 px wide, and the board at 1280 px wide clips no label of the rail or the header

### Requirement: Forced colours
Under forced colours the board page and the view SHALL draw focus rings, borders, and selected and pressed states with system colours, show disabled controls in `GrayText`, and keep every answer state told apart by its shape and text. Colour SHALL stay the palette's only where it carries data: Chart series, diff marks and the change highlight (EXPERIENCE, Accessibility Floor; DESIGN, Colors).

#### Scenario: Focus and selection
- **WHEN** forced colours are active and the user tabs to a segmented control
- **THEN** the focus outline is visible in the system's `Highlight` colour, and the selected segment is marked in a system colour beside its weight

#### Scenario: Answer states
- **WHEN** forced colours are active on a board with a question in each answer state
- **THEN** each state's badge shows its icon and its text, and each state stripe keeps its dashed, dotted or solid line

#### Scenario: Data keeps its colour
- **WHEN** forced colours are active on a board holding a Chart and a value the user changed
- **THEN** the Chart's series keep their palette colours, and the changed value keeps its change fill

### Requirement: A palette in a Snapshot
A Snapshot SHALL carry Carta's tokens and the stylesheet of the palette its record names, and no other palette's. An opened Snapshot SHALL show in that palette, in Carta when the record names none or a palette the page does not know, SHALL offer no palette row, and SHALL not follow the system's contrast (FR-26, AD-8, AD-9; EXPERIENCE, Snapshots).

#### Scenario: Taken in Grafite
- **WHEN** a Snapshot is taken while the user file sets `palette` `grafite`
- **THEN** its record names `grafite`, the file holds Grafite's stylesheet and no rule of Nordico or Contrasto, and it opens with `data-palette="grafite"`

#### Scenario: Taken in Carta
- **WHEN** a Snapshot is taken with no palette set
- **THEN** the file holds no palette stylesheet, and it opens with no `data-palette`

#### Scenario: A record the page does not know
- **WHEN** an opened Snapshot's record names `palette` `"sepia"`
- **THEN** it shows in Carta

#### Scenario: No palette row
- **WHEN** the user activates "Theme" in an opened Snapshot
- **THEN** its popover holds one Theme group and one Density group, and no palette row

### Requirement: The contrast and role report
A test SHALL compute the WCAG 2 contrast ratio of every pair of DESIGN.md's Contrast table, and of the pairs the board's layout adds, for each palette and scheme, and the hue distances the colour role rules ask for. It SHALL report each pair under its minimum (4.5:1 text and 3:1 marks; Contrasto 7:1 and 4.5:1) and each rule not met, without failing, and SHALL fail when a pair names a role a palette lacks (PRD L27, L28; DESIGN, Contrast).

#### Scenario: The ratio
- **WHEN** the report computes `#000000` on `#ffffff`, and Carta's "Primary text / page" in light
- **THEN** it gives 21.00 and 13.61

#### Scenario: A pair under its minimum
- **WHEN** a palette gives a text pair 4.2:1
- **THEN** the report names the palette, the scheme, the pair and the ratio, and the test passes

#### Scenario: Every palette and scheme
- **WHEN** the report runs over DESIGN.md
- **THEN** it holds every pair for each of the eight palette and scheme combinations

### Requirement: Carta on the board's layout
Each palette SHALL hold on the board's layout: at 1280 px wide, compact and comfortable, light and dark, in en-US and it-IT, no label of the rail, the ledger or the header is clipped. In Carta, light and dark, the report's pairs for the state stripes, the ledger's counts and the progress strip's underlines SHALL meet their minimum (DESIGN, Board chrome and Contrast).

#### Scenario: Fit in every palette
- **WHEN** a board of nine questions in three areas opens at 1280 by 800 px, in it-IT, in each palette and scheme, compact and comfortable
- **THEN** no element of the rail, the ledger or the header has a scroll width above its client width

#### Scenario: Carta's marks
- **WHEN** the report runs
- **THEN** Carta's stripe, ledger and underline pairs meet their minimum in light and in dark

## MODIFIED Requirements

### Requirement: A Chart follows the theme
The catalog port SHALL tell a component the theme in effect, light or dark, and the palette in effect, and re-render it when either switches. A Chart SHALL build its colours, fonts and lines from DESIGN's tokens as resolved in that theme and palette, and redraw with them on a switch, keeping its highlights, on the board and in a Snapshot (DESIGN Dark theme mechanism, EXPERIENCE Dark theme).

#### Scenario: Switching to dark
- **WHEN** a board holding a highlighted Chart switches from Light to Dark
- **THEN** the chart is redrawn with the dark tokens, `chart-1` resolved in dark among them, and the highlight stays

#### Scenario: Switching the palette
- **WHEN** a board holding a highlighted Chart switches from Carta to Grafite
- **THEN** the chart is redrawn with Grafite's tokens, `card` and `border` resolved in Grafite among them, and the highlight stays
