# Spec Delta

## ADDED Requirements

### Requirement: A question with context splits
A question with at least one resolved or agent-written excerpt SHALL render split, its context column of excerpts then references beside the question text and options, unless the user placed its context inline. A question with none SHALL take the full width, its references and unresolved pointers inline under the question text (FR-13; EXPERIENCE Board anatomy).

#### Scenario: One excerpt resolves
- **WHEN** a question holds a resolved excerpt and a reference
- **THEN** it renders split, with "Excerpt and references" beside the question text and options

#### Scenario: Every excerpt unresolved
- **WHEN** a question's only excerpt is unresolved and it holds a reference
- **THEN** it takes the full width, and the unresolved pointer and the reference show inline under the question text

#### Scenario: A wide widget under a split question
- **WHEN** a split question also holds a widget
- **THEN** the widget spans the card's full width below both columns

### Requirement: Context placement per question
The context column's title row SHALL hold a "Beside | Inline" control on a split question; choosing Inline moves the context under the question text, for that question only, and the choice SHALL survive a reload and a takeover through the draft record without counting as unsent work (FR-13, AD-20).

#### Scenario: Inline survives a reload
- **WHEN** the user sets one question's context to Inline and reloads the board
- **THEN** that question's context is still inline, the other questions' still beside

#### Scenario: Placement is not unsent work
- **WHEN** the only change on a board is a question's placement
- **THEN** no leave-page prompt is armed, and "Copy my unsent work" holds nothing

### Requirement: Excerpts show as source text
An excerpt SHALL show its caption (title, then path, anchor and line range) and its body as source text with its line numbers, through `textContent` only, capped in height with scrolling inside; an excerpt from a file SHALL offer "Open in reading panel". An unresolved excerpt SHALL show "Unresolved" with its pointer (FR-8, AD-8; DESIGN, Excerpt).

#### Scenario: Markup in an excerpt
- **WHEN** an excerpt's text, title or pointer holds `<img src=x onerror=alert(1)>`
- **THEN** the view shows those characters as text, adds no element and reports no CSP violation

#### Scenario: Line numbers follow the file
- **WHEN** an excerpt was read from lines 40 to 52
- **THEN** its body numbers its lines 40 to 52

#### Scenario: Bidirectional controls are visible
- **WHEN** an excerpt's text holds U+202E
- **THEN** the body shows a visible marker for it instead of reordering the line

### Requirement: References open in one click
A reference SHALL show its kind label and its path or title, and open only on an explicit click: a FILE reference in the reading panel, a GITHUB or WEB reference in a new browser tab, `http:` and `https:` only, with `noopener` and `noreferrer`. It SHALL leave the view only as an open-reference message naming its item (FR-9, AD-8).

#### Scenario: A web reference
- **WHEN** the user clicks a WEB reference to `https://example.com/a`
- **THEN** a new tab opens that URL, and the new page's `window.opener` is null

#### Scenario: The board page trusts no URL from the view
- **WHEN** a message reaches the board page naming an item that is not a reference of its board document
- **THEN** the board page opens nothing

#### Scenario: The URL is the board's own, as it stands now
- **WHEN** a message names a web reference whose URL a later revision of the board document changed
- **THEN** the board page opens the URL the board document holds for that item now, and never one that came with the message

### Requirement: Images by pointer
An image SHALL show its bytes from the board document through a `blob:` URL, with its alt text, and never load a URL; an unresolved image SHALL show "Unresolved" with its pointer and leave the rest of the board working (AD-8, AD-12).

#### Scenario: A screenshot
- **WHEN** a question holds a resolved PNG image
- **THEN** the view shows it from a `blob:` URL with its alt text, and the browser reports no CSP violation and no network request for it

### Requirement: Context counts for a visible question
A question SHALL count as visible only once its excerpts, references and images are ready: an image once decoded or found unresolved, every other context item once laid out (AD-9, SM-C2).

#### Scenario: A large image
- **WHEN** a question holds an image that takes time to decode
- **THEN** its `ready` message is sent only after the image is decoded

### Requirement: The reading panel
A FILE reference or an excerpt's "Open in reading panel" SHALL open, on the board page, a non-modal side sheet whose header holds the path, "Changed since the agent asked" when the source state says so, "Open in editor" and a close control, and whose body frames the source view at the anchor, in an iframe with an empty `sandbox` and no referrer (FR-9, AD-8; DESIGN, Reading panel).

#### Scenario: Opening at the anchor
- **WHEN** the user opens a reference to `docs/specs/checkout.md#L40-L52`
- **THEN** the panel shows the file with line 40 at the top of its view and lines 40 to 52 marked, and the frame carries an empty `sandbox`

#### Scenario: Closing returns focus
- **WHEN** the user presses Esc in the panel's header or clicks its close control
- **THEN** the panel closes and focus returns to the reference that opened it

#### Scenario: A missing file
- **WHEN** the referenced file no longer exists
- **THEN** the panel says that the file is not available, shows its path, and "Open in editor" is disabled

#### Scenario: The board locks
- **WHEN** the board is moved to another tab, closed or discarded while the panel is open
- **THEN** a moved or discarded board closes the panel, and a closed board keeps it readable

### Requirement: Open in editor on the board page
"Open in editor" SHALL send `open-editor` only on an explicit click on the board page, show the outcome when it is not `opened`, and be disabled while no editor is set or the file is not available (FR-9, AD-8).

#### Scenario: No editor set
- **WHEN** the reading panel opens and no editor command is configured
- **THEN** "Open in editor" is disabled with "No editor set" and the configuration key to set

### Requirement: Context in a Snapshot view
With no parent host, a FILE reference SHALL show its path and anchor as text, "not available in a Snapshot", an excerpt SHALL hide "Open in reading panel", and a web reference SHALL be a link that opens only on a click, with `noopener` and `noreferrer` (EXPERIENCE, Snapshots).

#### Scenario: A FILE reference offline
- **WHEN** the view renders a board document with a FILE reference and no parent host
- **THEN** the reference shows its path as text with "not available in a Snapshot", and clicking it opens nothing
