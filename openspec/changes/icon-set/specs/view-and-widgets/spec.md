# Spec Delta

## ADDED Requirements

### Requirement: One icon set in one chunk
The view, its components and the widgets SHALL draw every icon from Lucide through one icon module, shipped in one library chunk, `icons`, which the shell needs. No other chunk SHALL bundle Lucide's code. Icons SHALL be bundled code: no icon font, sprite or stylesheet SHALL be fetched at run time (NFR-6, NFR-9, AD-9, AD-11; DESIGN, Icons).

#### Scenario: The manifest
- **WHEN** the view is built
- **THEN** the manifest lists the library chunk `icons`, needing `react`, the shell needs `icons`, and only the `icons` chunk's licence notices name `lucide-react`, with its ISC text and Feather's MIT text

#### Scenario: A board inlines the icons once
- **WHEN** a board holding a Tree, a Ranking and a Text is assembled
- **THEN** its view inlines the `icons` chunk once, and neither the `tree` nor the `ranking` chunk holds Lucide's code

#### Scenario: A Snapshot offline
- **WHEN** a Snapshot is opened from its file with every request blocked
- **THEN** the icons it shows render as inline SVG, no request leaves the page, and no CSP violation is reported

### Requirement: Icons enter only through the icon module
`bun run check` SHALL fail on an import of `lucide-react` other than one icon by its path, in the icon module or a test (its main entry, `icons` index and dynamic loaders fail everywhere); and on an import of `lucide` other than `createElement` and icons by name from its main entry, in `board-page/icons.ts` or a test: no `createIcons`, no subpath, no other casing. A widget SHALL reach icons only through `view`'s icon module (AD-1, AD-9).

#### Scenario: The package's main entry
- **WHEN** a file under `packages/widgets/src` imports `{ Check }` from `lucide-react`
- **THEN** `bun run check:imports` fails, naming the file and the rule

#### Scenario: An icon outside the module
- **WHEN** a file under `packages/view/src/shell` imports `lucide-react/icons/check`
- **THEN** `bun run check:imports` fails, naming the file and the rule

#### Scenario: Through the module
- **WHEN** the icon module imports `lucide-react/icons/check` and a widget imports `@askboard/view/icons`
- **THEN** `bun run check:imports` passes

#### Scenario: Lucide's DOM package outside its file
- **WHEN** a file under `packages/view/src/board-page` other than `icons.ts` imports `{ X }` from `lucide`, or `icons.ts` imports `createIcons`
- **THEN** `bun run check:imports` fails, naming the file and the rule

### Requirement: Icons beside their labels
Each mark the board drew as a glyph or as an inline SVG of its own SHALL be an icon of the icon module, beside its text label where it has one (DESIGN, Icons). A glyph quoted in a label in this specification or in EXPERIENCE.md (↓ ↩ ↻ ↗ ✓ ✕ ×) SHALL be drawn as that icon: it SHALL be neither text of the label nor part of its accessible name. An icon SHALL take the text colour of the element that holds it (NFR-12, FR-34).

#### Scenario: The header's next-open jump
- **WHEN** a board of three open questions in sections is shown in en-US, then in it-IT
- **THEN** the header's jump reads "Next open", then "Prossima aperta", followed by the arrow-down icon, and its accessible name is that text alone

#### Scenario: A reference's hint
- **WHEN** the context column shows a GITHUB reference and a FILE reference
- **THEN** the GITHUB reference's hint reads "opens in browser" followed by the external-link icon, and the FILE reference's hint "opens in a reading panel" has no icon

#### Scenario: The Approval's selected decision
- **WHEN** the user selects "Reject", then presses it again
- **THEN** "Reject" first shows the check icon before its text with the accessible name "Reject", then shows no check icon

#### Scenario: The widgets' own marks
- **WHEN** a Tree with a parent node and draggable rows, a Ranking and a date field are shown
- **THEN** the Tree's chevron, both drag grips and the calendar button each draw an icon of the module, and the chevron points right when its node is closed and down when it is open

#### Scenario: Icons follow the text colour
- **WHEN** a board showing the header's jump, the outline's marks and a reference's hint is shown in the light theme, then in the dark theme
- **THEN** each icon's computed stroke equals the computed colour of the element that holds it

#### Scenario: Key names stay text
- **WHEN** the Ranking's keys panel is open
- **THEN** every key cap in it is text, its arrows and Enter included, and no key cap holds an icon

### Requirement: Accessible names of icons
An icon beside a text that says what it means SHALL be hidden from assistive technology. A mark whose only content is an icon, with or without a count, SHALL be an image named in the board's language by the string that already describes it. A control whose only content is an icon SHALL be named by the control, with its icon hidden (NFR-12, FR-34; EXPERIENCE, Accessibility Floor).

#### Scenario: Decorative icons are hidden
- **WHEN** the header's jump, a reference's hint and the Approval's selected decision are shown
- **THEN** each of their icons has `aria-hidden="true"`

#### Scenario: The outline's marks
- **WHEN** the outline shows a question with one unread reply that the agent also changed, in en-US, then in it-IT
- **THEN** the reply badge shows the reply icon and "1" and is an image named "1 new reply", then "1 nuova risposta"; the flag is an image named "The agent updated this", then "Aggiornata dall'agente"; and the entry's accessible name holds both names

#### Scenario: The comment card's close control
- **WHEN** a comment card is open
- **THEN** its close control is a button named "Close" whose icon is hidden, and it holds no × text

### Requirement: The board page's close icon
The close controls of the reading panel and of the settings panel SHALL draw Lucide's close icon, from the same Lucide release as the view's icons, hidden from assistive technology, each button keeping its name. The board page SHALL fetch nothing to draw it, and both Lucide packages SHALL be pinned to the same exact version (NFR-6, NFR-9, NFR-12; DESIGN, Icons).

#### Scenario: The reading panel's close control
- **WHEN** the reading panel is open
- **THEN** its close control is a button named "Close reading panel" holding the close icon with `aria-hidden="true"`, and no ✕ text

#### Scenario: The settings panel's close control
- **WHEN** the settings panel is open
- **THEN** its close control is a button named "Close settings" holding the close icon with `aria-hidden="true"`, and no ✕ text

#### Scenario: Two pins apart
- **WHEN** `packages/view/package.json` pins `lucide` and `lucide-react` to different versions
- **THEN** `bun run check` fails, naming both versions
