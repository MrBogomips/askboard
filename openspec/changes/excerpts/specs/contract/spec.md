# Spec Delta

## ADDED Requirements

### Requirement: Context items in a question
A question's `items` SHALL accept three item types: `excerpt` with exactly one of `pointer` and `text`, and an optional `title`; `reference` with exactly one of `pointer` and `url`, and an optional `title`; `image` with `pointer` and a required `alt`. Each refuses every other field, so no image data or image URL enters tool input (AD-7, AD-12, FR-8, FR-9).

#### Scenario: The approved UJ-1 excerpt
- **WHEN** the input format validates `{type: "excerpt", id: "retry-adr", props: {pointer: "docs/adr/0012-payment-retries.md#Decision"}}` inside a question's `items`
- **THEN** it passes

#### Scenario: An excerpt with both forms
- **WHEN** an excerpt holds both `pointer` and `text`
- **THEN** the request is refused with a problem naming the item and saying that an excerpt takes exactly one of them

#### Scenario: An image sent as data
- **WHEN** an `image` item holds a `data`, `src` or `url` field
- **THEN** the request is refused as a schema error naming the item and the field

#### Scenario: An image without alt text
- **WHEN** an `image` item has no `alt`
- **THEN** the request is refused, naming the item and `alt`

### Requirement: Web reference URLs
A reference's `url` SHALL be an absolute URL with the scheme `http` or `https`, a host, and no user name or password, of at most the contract's URL limit; any other is a request error naming the item (AD-8, FR-9).

#### Scenario: A script URL
- **WHEN** a reference's `url` is `javascript:alert(1)`, `data:text/html,…`, `file:///etc/passwd` or `vbscript:…`
- **THEN** the request is refused, naming the item and saying that only `http` and `https` URLs are accepted

#### Scenario: A URL with credentials
- **WHEN** a reference's `url` is `https://user:secret@example.com/`
- **THEN** the request is refused, naming the item

### Requirement: The pointer grammar
The contract SHALL hold one function that reads a pointer: the text up to the first `#` is a root-relative path; what follows is the anchor, a line range when it is `L<start>-L<end>` with `1 ≤ start ≤ end`, otherwise a heading or an ID. A pointer whose path is empty, starts with `/`, holds a backslash, a control character, or an empty, `.` or `..` segment SHALL read as invalid, with its reason (Consistency Conventions, "Excerpts and media").

#### Scenario: A line range
- **WHEN** the pointer `src/retry.ts#L40-L62` is read
- **THEN** it gives the path `src/retry.ts` and the line range 40 to 62

#### Scenario: A heading
- **WHEN** the pointer `docs/prd.md#Billing` is read
- **THEN** it gives the path `docs/prd.md` and the heading or ID anchor `Billing`

#### Scenario: Paths that leave the root by their text
- **WHEN** the pointers `../secret.md#A`, `docs/../../x.md#A`, `/etc/passwd#L1-L2`, `docs//x.md#A`, `./docs/x.md#A` and `docs\x.md#A` are read
- **THEN** each reads as invalid, with its reason, and nothing touches the file system

#### Scenario: A reversed range
- **WHEN** the pointer `a.md#L9-L3` is read
- **THEN** its anchor is not a line range

### Requirement: Resolved context in the board document
The board document SHALL hold, for each pointer excerpt, its pointer, status (`resolved` or `unresolved`), and either its source text, media type and line range or its reason; for each agent-written excerpt, its text; for each image, its pointer, alt text, status, and either its media type and bytes in base64 or its reason; for each reference, its kind (`file`, `github` or `web`) and, for a pointer, its status and line range or reason (AD-12).

#### Scenario: A resolved excerpt
- **WHEN** a board document holds an excerpt with status `resolved`
- **THEN** it validates only with its text, its media type and a line range whose start is at most its end

#### Scenario: An unresolved image
- **WHEN** a board document holds an image with status `unresolved`
- **THEN** it validates only with a reason and without bytes

### Requirement: The unresolved-pointer warning
The output format's warning SHALL admit the code `unresolved-pointer`, carrying the item ID, the pointer, the reason (`no-root`, `invalid-pointer`, `outside-root`, `not-found`, `not-a-file`, `anchor-not-found`, `not-text`, `not-image`, `too-large`, `timeout`) and a message (AD-6, FR-8).

#### Scenario: A heading that does not exist
- **WHEN** an `ask` result warns that `retry-adr` points at a heading the file lacks
- **THEN** the warning validates with code `unresolved-pointer`, item `retry-adr`, its pointer and reason `anchor-not-found`

### Requirement: The source view route
The contract SHALL define the route `GET /s/<askId>/<itemId>` with the board token in the query parameter `t` and an optional `scheme` of `light` or `dark`, and what it answers: the source view page, 403 without a token that opens that ask's board, 410 for a discarded ask, 404 for an item that is no pointer excerpt or pointer reference of the ask. Both IDs follow the ID pattern (AD-8, AD-11).

#### Scenario: A path that is not a source route
- **WHEN** `/s/<askId>/../m`, `/s/<askId>`, `/s/<askId>/<itemId>/x` or `/s/%2e%2e/<itemId>` is parsed
- **THEN** it names no route

### Requirement: The source view's policy
The contract SHALL hold the source view's CSP: `default-src 'none'`, its stylesheet by hash, `img-src data:`, `frame-ancestors 'self'`, `base-uri 'none'` and `form-action 'none'`, and nothing else (AD-8).

#### Scenario: No script source
- **WHEN** the source view's policy is read
- **THEN** it names no `script-src`, no `'unsafe-inline'`, no `'unsafe-eval'` and no host

### Requirement: Reading panel and editor messages
The board protocol SHALL carry, page to host, `open-source` and `open-editor`, each naming one item; and host to page, `source-state` (the item, its status, whether the excerpted range changed, the current line and whether an editor can open it) and `editor-outcome` (`opened`, `no-editor`, `unavailable`, `failed` or `busy`). No message carries a path the page chose (AD-8).

#### Scenario: A message that names a file
- **WHEN** a page sends `open-source` holding a `path` field
- **THEN** it is refused as a schema error

### Requirement: Context placement in the draft record
The draft record's question SHALL admit `context`, `beside` or `inline`, the user's choice for that question (AD-20, FR-13).

#### Scenario: A placement kept in the draft
- **WHEN** a draft record question holds `context: "inline"`
- **THEN** it validates, and a value other than `beside` or `inline` is refused

### Requirement: Context limits
The contract SHALL hold the limits every unit reads for context: pointer, title, alt text and URL lengths; the largest file searched for an anchor; an excerpt's lines and bytes; an image's bytes and an ask's image bytes; the source view's bytes and lines; concurrent reads; the resolution budget. No unit SHALL define its own.

#### Scenario: One limit, one place
- **WHEN** `excerpts`, `ask-core` and `board-host` check an excerpt's length
- **THEN** each reads the same contract constant
