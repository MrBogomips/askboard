## ADDED Requirements

### Requirement: Markdown rendered as data
A Text marked `markdown`, and an option preview marked `markdown`, SHALL render through the view's Markdown renderer only. Raw HTML in the source SHALL show as text, and the output SHALL hold only paragraphs, line breaks, emphasis, strong, strikethrough, inline code, code blocks, block quotes, lists, headings, rules, tables and links, with no attribute but a link's `href`, a list's `start` and the alignment classes. No element SHALL make a request (FR-13, NFR-5, AD-8).

#### Scenario: Markup in Markdown
- **WHEN** a Markdown Text holds `<img src=x onerror=alert(1)>`, `<script>alert(1)</script>` and `<span style="color:red">x</span>`
- **THEN** each shows as text, no script runs, no request leaves the view, and no CSP violation is reported in Chromium, Firefox or WebKit

#### Scenario: Plain text stays plain
- **WHEN** a Text without `format` holds `**bold**`
- **THEN** it shows the asterisks as text

### Requirement: Markdown images, tables and controls
In Markdown, an image SHALL show as a link to its source labelled with its alt text, table alignment SHALL be a class, never a `style` attribute, and text SHALL show bidirectional controls as marked escapes, as agent-written labels do (AD-8, AD-12).

#### Scenario: An image and an aligned table
- **WHEN** a Markdown Text holds `![logo](https://example.com/a.png)` and a table with right-aligned columns
- **THEN** the image shows as a link labelled "logo" and is never loaded, and the table's alignment is a class with no CSP violation

### Requirement: Markdown links in the view
A link in Markdown SHALL be a link only when its URL is `http:` or `https:`; any other shows as its source text. On the live board, a click on a link SHALL send the board page an open-link message naming the item and the URL, and SHALL NOT navigate the view. In a Snapshot, which has no board page, a link SHALL open natively in a new tab with `rel="noopener noreferrer"` (AD-8, NFR-9).

#### Scenario: A link clicked on the board
- **WHEN** the user clicks `[docs](https://example.com/docs)` in a Markdown Text
- **THEN** the view stays on the board and sends the open-link message

#### Scenario: Another scheme
- **WHEN** a Markdown Text holds `[x](javascript:alert(1))`
- **THEN** it shows as its source text and is no link

### Requirement: The board page opens Markdown links
The board page SHALL open an open-link message's URL in a new tab with `noopener` and `noreferrer` only when it is `http:` or `https:`, at most 2,048 characters, and the item it names holds Markdown in the board document; it SHALL open nothing otherwise (AD-8).

#### Scenario: A link opened
- **WHEN** the board page receives an open-link message for `https://example.com/docs` from a Markdown Text
- **THEN** it opens the URL in a new tab without an opener

#### Scenario: A forged message
- **WHEN** the board page receives an open-link message with `javascript:alert(1)`, `file:///etc/passwd`, a URL of 2,049 characters, or an item that holds no Markdown
- **THEN** it opens nothing

### Requirement: Markdown bounded work
A Markdown source SHALL render with nesting cut at 20 levels, and every source within its item's bounds SHALL render in under 2 seconds in Chromium and WebKit, measured under 500 ms on the test machine (AD-8, NFR-12).

#### Scenario: Pathological Markdown
- **WHEN** a Text holds 10,000 code points of nested block quotes, nested lists, unmatched emphasis markers or nested brackets
- **THEN** the board renders it in under 500 ms in Chromium and WebKit on the test machine and stays responsive

### Requirement: Option previews in Markdown
An option whose `previewFormat` is `markdown` SHALL show its preview, when opened, through the Text atom's component, so that it renders as Markdown under the rules above; a preview without it SHALL stay plain text (FR-3, EXPERIENCE Option preview).

#### Scenario: A Markdown preview
- **WHEN** the user opens the preview of an option with `previewFormat: "markdown"` holding a code block
- **THEN** the preview shows the code block in the code type, and the board carries the Text atom's chunk

### Requirement: Display atoms
A Text SHALL show its text in the body type, plain text keeping its line breaks; a Value SHALL show its label, if any, and its value in the code type formatted in the ask's locale (numbers, percentages, money, long dates, and durations as days); a Divider SHALL show a rule. None of them SHALL take focus or give an answer (FR-13, DESIGN Primitives).

#### Scenario: Values in Italian
- **WHEN** an it-IT board shows Values of 1234.5, 0.185 as a percent, `12480` EUR, `2026-12-09` and 12 days
- **THEN** they read `1.234,5`, `18,5%`, `€ 12.480,00`, `mer 9 dic 2026` and `12 giorni`

### Requirement: Input atoms fill the draft only
Each input atom SHALL start unset and show nothing as set before the user acts; a value the user sets SHALL go into the draft as the item's result, and clearing it SHALL remove the result; nothing SHALL be sent before the question's "Answer" (EXPERIENCE Explicit acts, AD-10). Each SHALL show its label, visibly, and its description under it, and each control SHALL work from the keyboard (NFR-12).

#### Scenario: Typing does not answer
- **WHEN** the user types in a TextField and leaves the field
- **THEN** the draft holds the text as the item's result and nothing is sent

#### Scenario: A cleared field
- **WHEN** the user empties a NumberField that held 3
- **THEN** the item holds no result and no entry

### Requirement: Number, amount and date entry in the fields
NumberField, MoneyField and DateField SHALL be text inputs read with the contract's parsers in the ask's locale, never the browser's number or date inputs, and SHALL echo the value they read beside the field. A MoneyField with `currencies` SHALL offer them as a segmented control after the field (FR-13, FR-34, AD-7).

#### Scenario: An Italian amount
- **WHEN** the user types `1.234,5` in an it-IT MoneyField in EUR
- **THEN** the echo reads `= 1234,50 EUR` and the draft holds `{amount: "1234.50", currency: "EUR"}`

### Requirement: The DateField's calendar
A DateField SHALL also open a calendar in a non-modal popover from a button beside the field, with month and weekday names from AskBoard's own tables in the ask's language, weeks from Sunday in en-US and from Monday in it-IT, and days outside the item's range disabled. A picked day SHALL be the date the calendar shows, whatever the viewer's time zone (FR-13, FR-34, NFR-12).

#### Scenario: A day picked across time zones
- **WHEN** the user picks 9 December 2026 in the calendar with the browser's time zone at UTC−10 and at UTC+14
- **THEN** the draft holds `2026-12-09` both times

#### Scenario: The calendar from the keyboard
- **WHEN** the user opens the calendar with Enter, moves with the arrow keys, picks with Enter, and presses Escape on a second opening
- **THEN** the picked day fills the field, and Escape closes the popover with focus back on its button

### Requirement: An entry blocks Answer
Text in a NumberField, MoneyField or DateField that its parser refuses, or whose value falls outside the item's bounds, SHALL stay in the field with its field error, SHALL be kept in the draft record as the item's entry and restored after a reload, and SHALL leave the item with no result; while any item of a question holds an entry, its "Answer" SHALL be disabled. Correcting or clearing the text SHALL remove the entry (NFR-10, AD-10, AD-20).

#### Scenario: An English habit in Italian
- **WHEN** the user types `1.23` in an it-IT NumberField
- **THEN** the field error gives the parser's reason, the item holds no result, and "Answer" is disabled

#### Scenario: Restored after a reload
- **WHEN** the user reloads the board with `21` typed in a NumberField whose `max` is 20
- **THEN** the field shows `21` with its field error, and "Answer" stays disabled until the user corrects it

### Requirement: The Toggle's unset state
An unset Toggle SHALL show a switch drawn off with "Not set" beside it; a press SHALL set it on, the next off, each read "On" or "Off", and "Clear" SHALL return it to unset, removing its result (FR-13, EXPERIENCE Primitives).

#### Scenario: Off, chosen
- **WHEN** the user presses an unset Toggle twice with Space
- **THEN** it reads "Off" and the draft holds `false` as its result

### Requirement: Atoms read-only and in Snapshots
After its question is answered, and in a Snapshot, each input atom SHALL show the answer's value read-only, formatted in the ask's locale, with no echo or field error, and the display atoms as on the board (FR-13, AD-15).

#### Scenario: A Snapshot of answered atoms
- **WHEN** a board answered with every input atom set is taken as a Snapshot and opened from `file://`
- **THEN** each atom shows its value read-only, and a Markdown Text's link opens in a new tab with `rel="noopener noreferrer"`

### Requirement: Atoms end to end
A question built only from atoms SHALL render and return a typed answer through the session process: `collect` and the mod's push SHALL deliver its `results` by item ID, in each conformance configuration, on Bun and on Node 24 (FR-13, FR-18, FR-21).

#### Scenario: Pushed and collected
- **WHEN** the user answers a question of the five input atoms on the real board
- **THEN** the agent receives one answer whose `results` hold the five values, by push where the mod runs and by `collect` everywhere

### Requirement: Atom strings
Every string the atoms show, the calendar's labels and the field errors included, SHALL come from the view's string tables in en-US and it-IT, with the texts of `ux-update-draft.md` (FR-34).

#### Scenario: An Italian board of atoms
- **WHEN** an it-IT board shows every atom, an unset Toggle and an open calendar
- **THEN** every string is Italian, "Non impostato", the month caption and the weekday names included

## MODIFIED Requirements

### Requirement: Agent content as text
Every agent string on the board (title, area titles, question text, header chips, option labels, descriptions, previews and annotations, follow-up replies, and the atoms' text, labels and values) SHALL render as text, never as markup, except a Text or an option preview the agent marks as Markdown, which SHALL render only through the view's Markdown renderer (AD-8, NFR-5).

#### Scenario: Markup in an option label
- **WHEN** an option's label is `<img src=x onerror=alert(1)>`
- **THEN** the board shows those characters as text, and no element is created from them

#### Scenario: Markup in a reply
- **WHEN** the agent replies to a follow-up with `<script>alert(1)</script>`
- **THEN** the thread shows those characters as text, and no script runs

#### Scenario: Markup in an atom's label
- **WHEN** a TextField's label is `<b>Name</b>`
- **THEN** the field's label shows those characters as text

### Requirement: Option previews
An option with a preview SHALL show "Show preview", which opens the preview below the option, as plain text unless the option's `previewFormat` is `markdown`, one preview open at a time (FR-3; open question 9).

#### Scenario: Two previews
- **WHEN** the user opens one option's preview, then another's
- **THEN** only the second preview is open
