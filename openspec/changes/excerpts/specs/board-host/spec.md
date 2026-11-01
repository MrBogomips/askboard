# Spec Delta

## MODIFIED Requirements

### Requirement: The board page and its policy
`board-host` SHALL serve a board's page at its link, with `X-Content-Type-Options: nosniff` and a CSP of ten directives, the contract's `boardPagePolicy` of the view manifest: `default-src 'none'`; scripts and styles only by the hashes of the board page's code and of the view's chunks; `connect-src 'self'`; `img-src data: blob:` and `font-src data:`; `frame-src 'self'`, which serves only the reading panel's source view; `base-uri 'self'`; `form-action 'none'`; and `frame-ancestors 'none'`; and nothing else (AD-8, AD-11).

#### Scenario: The served policy
- **WHEN** a board page is loaded with its token
- **THEN** its CSP header names exactly the ten directives, holds the hashes of the board page script and of every view chunk, allows frames only from `'self'`, and holds no `'wasm-unsafe-eval'`, `'unsafe-inline'`, `'unsafe-eval'` or `'unsafe-hashes'`

## ADDED Requirements

### Requirement: Pointers resolve only inside the root
`excerpts` SHALL read a pointer's file only when the file's real path lies inside the real path of the ask's root, compared exactly. It SHALL refuse, as unresolved and without reading, a path invalid by the pointer grammar and a path that leaves the root through a symlink at any level (AD-12, NFR-5).

#### Scenario: A symlink out of the root
- **WHEN** `docs/link.md` inside the root is a symlink to a file outside it
- **THEN** a pointer to `docs/link.md#L1-L3` is unresolved with reason `outside-root`, and nothing of the outside file is read

#### Scenario: A directory symlink out of the root
- **WHEN** `vendor` inside the root links to a folder outside it
- **THEN** a pointer to `vendor/a.md#L1-L2` is unresolved with reason `outside-root`

#### Scenario: A sibling folder that shares the root's name
- **WHEN** the root is `/w/proj` and `docs/x.md` links to `/w/proj-old/x.md`
- **THEN** the pointer is unresolved with reason `outside-root`

#### Scenario: A symlink that stays inside
- **WHEN** `latest.md` links to `docs/v2.md` inside the root
- **THEN** a pointer to `latest.md#L1-L2` resolves to `docs/v2.md`'s lines

#### Scenario: Case and Unicode forms on macOS
- **WHEN** on a case-insensitive APFS volume a pointer names `DOCS/X.md` for `docs/x.md`, or a name in NFC for a file stored in NFD
- **THEN** it resolves to that file inside the root, and no case or Unicode form of a path outside the root resolves

### Requirement: Only regular files are read
`excerpts` SHALL open a file without following a final symlink and without blocking, and read it only when it is a regular file of the device and inode its real path named; a directory, FIFO, socket or device SHALL be unresolved with reason `not-a-file`, and reading it SHALL not wait (AD-12).

#### Scenario: A FIFO in the root
- **WHEN** a pointer names a named pipe inside the root that no process writes
- **THEN** the pointer is unresolved with reason `not-a-file` at once, and the session process keeps answering

### Requirement: Anchors find their lines
`excerpts` SHALL resolve a line range to those lines, failing when the file has fewer; and, in a Markdown file, a heading or ID anchor to the first ATX heading outside fenced code whose text equals it, else the first that holds it as a whole word, giving that heading's section up to the next heading of the same or a higher level (FR-8).

#### Scenario: A heading inside a code block
- **WHEN** a Markdown file holds `# Setup` only inside a fenced code block and a pointer names `#Setup`
- **THEN** the pointer is unresolved with reason `anchor-not-found`

#### Scenario: An ID in a heading
- **WHEN** `docs/prd.md` has the heading `#### FR-8: Excerpts beside the question` and a pointer names `docs/prd.md#FR-8`
- **THEN** the excerpt is that heading's section, with its line range

#### Scenario: A range past the end
- **WHEN** a 40-line file is named with `#L35-L60`
- **THEN** the pointer is unresolved with reason `anchor-not-found`

### Requirement: Text and images are recognised by content
`excerpts` SHALL read an excerpt as UTF-8 text, a file with a NUL byte or invalid UTF-8 being `not-text`, and an image by its first bytes as PNG, JPEG, GIF or WebP, anything else being `not-image`, whatever its extension. A file or excerpt over the contract's limits SHALL be `too-large` (AD-12).

#### Scenario: An HTML file named as an image
- **WHEN** an image pointer names `.askboard/media/shot.png`, whose bytes are HTML
- **THEN** the image is unresolved with reason `not-image`

#### Scenario: An SVG
- **WHEN** an image pointer names an SVG file
- **THEN** the image is unresolved with reason `not-image`

### Requirement: Resolution has a time budget
Resolving one send's pointers SHALL take at most the contract's budget; a pointer still being read when it ends SHALL be unresolved with reason `timeout`, and the call SHALL return (FR-8).

#### Scenario: A slow file system
- **WHEN** a read does not complete within the budget
- **THEN** the ask is created with that pointer unresolved with reason `timeout`

### Requirement: The source view
`board-host` SHALL serve `GET /s/<askId>/<itemId>` only with a token that opens that ask's board, for a pointer excerpt or pointer reference of its current board document, as a page it builds from the file's current text, every character escaped, with line numbers and the anchor's lines marked, and `nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` and the source view's policy (AD-8, AD-11, NFR-4).

#### Scenario: A source file that holds markup
- **WHEN** the referenced file holds `</pre><script>alert(1)</script><meta http-equiv="refresh" content="0;url=https://example.com">`
- **THEN** the source view shows those characters as text, holds no script, meta or link element from the file, and the browser reports no CSP violation

#### Scenario: Without the board's token
- **WHEN** the source view is requested with no `t`, with another ask's token, or with the token of a discarded ask
- **THEN** it answers 403 or 410 as plain text, and holds nothing of the file

#### Scenario: An item that is not a pointer
- **WHEN** the source view is requested for an image, an agent-written excerpt, a web reference or an unknown item
- **THEN** it answers 404 as plain text

#### Scenario: A missing or binary file
- **WHEN** the referenced file is now missing, outside the root, not text or too large
- **THEN** the page says so with the pointer's path, and shows none of the file

#### Scenario: Framed by another origin
- **WHEN** a page served from another origin, such as `http://localhost:<port>` for a board on `127.0.0.1`, frames the source view
- **THEN** the browser refuses to show it

### Requirement: Reading panel messages
`board-host` SHALL answer `open-source` with `source-state` for the item, from `ask-core`'s current state of that source, and SHALL accept both reading panel messages only on an ask's live board connection (AD-8, AD-21).

#### Scenario: A changed excerpt
- **WHEN** the board page sends `open-source` for an excerpt whose lines changed since the ask
- **THEN** `source-state` says that the range changed and gives the anchor's current line

### Requirement: The editor launch
`board-host` SHALL start the editor only on `open-editor` from a live board, with the command from its configured source, as an argument vector with `{file}` and `{line}` replaced and no shell, the file being `ask-core`'s confined real path and the line an integer; at most once per ask per second, and never on any other message or agent call (AD-8, FR-9).

#### Scenario: A file name that looks like a shell command
- **WHEN** the user clicks "Open in editor" on `docs/$(touch pwned);x.md`, whose name holds quotes, spaces and a semicolon
- **THEN** the editor's program receives the file's absolute real path as one argument, unchanged, and no shell runs

#### Scenario: No editor set
- **WHEN** no editor command is configured and the board page sends `open-editor`
- **THEN** no process starts and `editor-outcome` says `no-editor`

#### Scenario: Only a click launches
- **WHEN** an agent sends an ask or update holding pointers, and a board loads it and opens its reading panel
- **THEN** no editor starts

### Requirement: The session process composes context
The session process SHALL give `ask-core` the `excerpts` adapter as its `SourceFiles` port, with the real path of `CLAUDE_PROJECT_DIR` or none, and SHALL give `board-host` the editor command source, which supplies no command until configuration does (AD-1, AD-12, AD-14).

#### Scenario: Started without the variable
- **WHEN** the session process starts with no `CLAUDE_PROJECT_DIR`
- **THEN** it starts, and every pointer resolves as unresolved with reason `no-root`
