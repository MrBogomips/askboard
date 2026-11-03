# view-and-widgets Specification

## Purpose
The view and its widgets show an ask's board in the user's browser: agent content rendered only as data, in a sandboxed view built from the board document, with every user action leaving as a typed message and nothing answered without an explicit act (AD-8, AD-9, AD-10).

## Requirements

### Requirement: Sandboxed view
The board page SHALL build the view's iframe from `srcdoc` through `assemble`, with exactly `sandbox="allow-scripts"`. The view SHALL have an opaque origin, hold no token and make no request (AD-8, NFR-5).

#### Scenario: The view's origin
- **WHEN** a board is open
- **THEN** `self.origin` inside the view is `"null"`, and the iframe's `sandbox` attribute is exactly `allow-scripts`

#### Scenario: The view tries to reach the network
- **WHEN** code inside the view calls `fetch` to the board's own address
- **THEN** the request fails and the session process receives nothing

### Requirement: The view's policy
The view's srcdoc SHALL carry a CSP meta tag with `default-src 'none'`, scripts and styles only by the hashes of its inlined chunks, `img-src data: blob:`, `font-src data:`, and `connect-src`, `object-src`, `frame-src`, `form-action` and `base-uri` all `'none'`, and never `'wasm-unsafe-eval'`, `'unsafe-eval'`, `'unsafe-inline'` or `'unsafe-hashes'`. Neither the view nor the board page SHALL raise a CSP violation (AD-8).

#### Scenario: A board loads in each engine
- **WHEN** a board is loaded in Chromium, Firefox and WebKit
- **THEN** no CSP violation is reported by the view, the board page or the console, a blocked `eval` that a library catches included

### Requirement: Agent content as text
Every agent string on the board (title, question text, header chip, option labels and descriptions) SHALL render as text, never as markup (AD-8, NFR-5).

#### Scenario: Markup in an option label
- **WHEN** an option's label is `<img src=x onerror=alert(1)>`
- **THEN** the board shows those characters as text, and no element is created from them

### Requirement: No browser storage
No AskBoard page SHALL use Web Storage, IndexedDB or cookies (AD-20).

#### Scenario: After answering
- **WHEN** a board has been loaded and answered
- **THEN** the board origin's Web Storage, IndexedDB and cookies are empty

### Requirement: View build and manifest
The view build SHALL publish a manifest of a shell chunk, library chunks and one chunk per catalog component, each with its SHA-256, its styles, the licence notices of the code it contains and the chunks it needs. Every chunk SHALL be a classic script; a chunk holding `import.meta` SHALL fail the build (AD-9).

#### Scenario: The manifest
- **WHEN** the view is built
- **THEN** the manifest validates against the contract's view manifest schema and lists the board page script, the shell, the Choice component and their library chunks, each with a hash that matches its content and its licence notices

#### Scenario: `import.meta` in a chunk
- **WHEN** a chunk's output holds `import.meta`
- **THEN** the build fails, naming the chunk

### Requirement: Chunk growth is stated
A chunk that grows past the size margin over the recorded sizes of the previous build SHALL fail the checks, unless the change records its new size (Consistency Conventions, Tests).

#### Scenario: A chunk doubles
- **WHEN** a build makes a chunk grow past the margin without updating the recorded sizes
- **THEN** the check fails, naming the chunk and both sizes

### Requirement: Assemble
`assemble(boardDocument, manifest)` SHALL be a pure function that returns the srcdoc with its CSP, inlining the shell, the chunks the board's items need and the library chunks those need (AD-9).

#### Scenario: Only the chunks a board needs
- **WHEN** a plain-question board document is assembled
- **THEN** the srcdoc holds the shell, the Choice chunk and their library chunks, and no other chunk

#### Scenario: Same input, same output
- **WHEN** one board document and manifest are assembled twice
- **THEN** both srcdocs are identical

### Requirement: Catalog components
Components SHALL register through one `CatalogRenderer` port, render from the board document and the draft record alone, keep no edit state of their own and send user actions only as typed view messages, which the board page validates before turning them into board-protocol commands (AD-9).

#### Scenario: A choice goes into the draft
- **WHEN** the user selects an option
- **THEN** the selection is held in the draft record and no message reaches `board-host`

### Requirement: An item that fails
Each item SHALL render inside an error boundary. An item that throws SHALL show an error state and report the error to the board page, and its question SHALL never count as visible or be answerable (AD-9, AD-10).

#### Scenario: A component throws
- **WHEN** an item's component throws while rendering
- **THEN** the rest of the board stays usable, the item shows an error, and its question offers no "Answer"

### Requirement: Question loading
A question SHALL show its loading state until all its items are ready, and SHALL count as visible only then (AD-9, SM-C2).

#### Scenario: A question becomes visible
- **WHEN** a plain question's options have rendered and laid out once
- **THEN** the loading state ends, and the question's box is unchanged 1 s later

### Requirement: Single-question board
A board SHALL show its ask as EXPERIENCE's single-question board: the tab labelled "<title> · AskBoard", a header with the title and the ask state, and one question card with its header chip, text, options with their descriptions, "Answer" and the delivery receipt. It SHALL show no outline navigator, counts, delivery switch or Submit.

#### Scenario: The plain-choice board
- **WHEN** the plain-choice ask's board opens
- **THEN** the tab reads "Which database should the order service use? · AskBoard", the header shows "Waiting", and the card shows the chip "Database" and three options, each with its description

### Requirement: Nothing chosen for the user
Options SHALL start with nothing selected. The arrow keys SHALL move focus only, Space or Enter SHALL select, and selecting SHALL only fill the draft. "Answer" SHALL stay disabled until the question has a choice (AD-10, NFR-10, FR-3).

#### Scenario: The board opens
- **WHEN** a board opens
- **THEN** no option is selected and "Answer" is disabled

#### Scenario: Moving with the arrow keys
- **WHEN** the user moves through the options with the arrow keys
- **THEN** focus moves, nothing is selected and nothing is sent

### Requirement: Answer sends at once
"Answer" SHALL send the question's answer at once, stamped with the time of the click, as on EXPERIENCE's single-question board. The question SHALL then show as answered and read-only, and the ask state as "Answered" (FR-22).

#### Scenario: The user answers
- **WHEN** the user selects "PostgreSQL" and presses "Answer"
- **THEN** one answer command reaches `board-host`, the question shows answered with its receipt at "sent", and the header shows "Answered"

### Requirement: Delivery receipt on the board
A sent answer SHALL show "sent", then "delivered to the agent" once the board is told so; never that the agent read it. An answer given while the connection is lost SHALL show "not sent yet" and SHALL be sent on reconnect (FR-22, NFR-10).

#### Scenario: The agent collects
- **WHEN** the agent collects the answer
- **THEN** its receipt changes from "sent" to "delivered to the agent"

#### Scenario: Answering while disconnected
- **WHEN** the user answers while the connection is lost and the ask is still open when it returns
- **THEN** the answer shows "not sent yet", is sent on reconnect once the board has the new connection's state, and is logged once

### Requirement: Board banners
The board page SHALL show EXPERIENCE's board banners: "Connection lost, retrying" while it reconnects, resuming if the ask is still open; Discarded, locking the board read-only; and Board moved, with "Continue here" to take the board back (AD-21, NFR-10, FR-25).

#### Scenario: The session ends
- **WHEN** the session process exits while the board is open
- **THEN** the board shows the ask as discarded, stays readable and accepts no answer

#### Scenario: The token is refused on reconnect
- **WHEN** the board reconnects and its token is refused, as after the session process restarted
- **THEN** the board shows the ask as discarded

#### Scenario: A short drop
- **WHEN** the connection drops and returns while the ask is open
- **THEN** the board shows "Connection lost, retrying", then resumes in the ask's current state

### Requirement: Keyboard core
Selecting options and pressing "Answer" SHALL work from the keyboard, with a visible focus ring. A newly opened board SHALL ignore keys until the user clicks or focuses inside it, and focus SHALL move to the banner when the ask is discarded (NFR-12).

#### Scenario: Answering with the keyboard only
- **WHEN** the user focuses the board, tabs to the options, selects one with Space and activates "Answer" with Enter
- **THEN** the answer is sent as with the mouse

### Requirement: Theme follows the system
The board SHALL follow the system's light or dark preference with DESIGN.md's tokens, the board page setting the view's `.dark` class.

#### Scenario: A dark system
- **WHEN** the system prefers a dark scheme
- **THEN** the board page and the view use DESIGN.md's dark tokens
