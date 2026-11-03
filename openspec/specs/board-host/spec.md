# board-host Specification

## Purpose
The board host serves each ask's board on the local machine only, behind that board's own token, carries the board protocol between the board page and the core, and brings a new board to the user's browser (AD-8, AD-11, AD-21).

## Requirements

### Requirement: Loopback listener
The board listener SHALL bind `127.0.0.1` only, on the first free port of the contract's default range, and SHALL open at the session's first ask (AD-11, NFR-3).

#### Scenario: Another interface
- **WHEN** a request reaches the machine's non-loopback address on the board port
- **THEN** the connection is refused

#### Scenario: The first port is taken
- **WHEN** the range's first port is in use at the first ask
- **THEN** the listener binds the next free port of the range, and the board link names it

### Requirement: A token per board
Each board SHALL have its own random token of at least 128 bits. It SHALL travel in the board link and, on every other request, only in a request header or the first WebSocket message. AskBoard SHALL set no cookies (AD-11, NFR-4).

#### Scenario: A request with another board's token
- **WHEN** a board page or WebSocket presents the token of another ask
- **THEN** it is refused, and no content of either ask is returned

#### Scenario: The view's files without the token
- **WHEN** the manifest at `/m` or a chunk at `/c/<sha256>` is requested without the token header, or with a token that opens no board of this session process
- **THEN** it is refused with status 403, and nothing of the manifest or the chunks is returned

#### Scenario: No cookies
- **WHEN** any board response is inspected
- **THEN** it sets no cookie

### Requirement: Host and Origin checks
`Host` SHALL be a loopback name. A request that carries `Origin` SHALL be served only when `Origin` equals `http://` plus its `Host`; WebSocket upgrades and requests other than GET or HEAD SHALL carry a matching `Origin`. Every response SHALL send `Referrer-Policy: no-referrer` (AD-11).

#### Scenario: DNS rebinding
- **WHEN** a request arrives with `Host: attacker.example`
- **THEN** it is refused

#### Scenario: A cross-site WebSocket
- **WHEN** a page from another origin opens a WebSocket to the board port with a valid token
- **THEN** the upgrade is refused

### Requirement: The board page and its policy
`board-host` SHALL serve a board's page at its link, with `X-Content-Type-Options: nosniff` and a CSP of nine directives, the contract's `boardPagePolicy` of the view manifest: `default-src 'none'`; scripts and styles only by the hashes of the board page's code and of the view's chunks; `connect-src 'self'`; `img-src data: blob:` and `font-src data:`; `base-uri 'self'`; `form-action 'none'`; and `frame-ancestors 'none'`; and nothing else (AD-8, AD-11).

#### Scenario: The served policy
- **WHEN** a board page is loaded with its token
- **THEN** its CSP header names exactly the nine directives, holds the hashes of the board page script and of every view chunk, and holds no `'wasm-unsafe-eval'`, `'unsafe-inline'`, `'unsafe-eval'` or `'unsafe-hashes'`

### Requirement: The board page's base URL
The board page SHALL carry a static `<base href="/">`, which its `base-uri 'self'` admits. A srcdoc document takes its base URL from the board page, whose link carries the token, so without that element the sandboxed view would inherit `?t=` (AD-8). The view's own policy keeps `base-uri 'none'`.

#### Scenario: The view's base URL holds no token
- **WHEN** a board page loaded with its token builds its view, and again after a reload
- **THEN** the view's `document.baseURI` is the board origin's root, with no `t=`

### Requirement: Invalid-link page
A link that opens no board, because it has no token, a wrong token or the ID of an ask unknown or discarded, SHALL get a short page that says why and what to do, with no board content (NFR-4, AD-21).

#### Scenario: A link without its token
- **WHEN** `/b/<askId>` is requested without `t`
- **THEN** the page says that the link is incomplete and shows nothing of the ask

#### Scenario: A discarded ask's link
- **WHEN** the link of a discarded ask is opened
- **THEN** the page says only that the ask was discarded

### Requirement: Board protocol over a WebSocket
The board page and `board-host` SHALL talk over one WebSocket per board, whose first message carries the token. Every message SHALL follow the board protocol schema set and be refused otherwise. `board-host` SHALL send the board document, the ask state and its changes, answer receipts and discards; the board page SHALL send answer commands.

#### Scenario: A message outside the schema
- **WHEN** the board page sends a message the board protocol does not define
- **THEN** `board-host` refuses it and the ask is unchanged

#### Scenario: The board connects
- **WHEN** a board page opens its WebSocket and sends its token first
- **THEN** it receives the ask's board document and current state

#### Scenario: A socket that does not start with its token
- **WHEN** the first message on a board's WebSocket is not `connect` with the board's token
- **THEN** `board-host` refuses it, closes the socket with the contract's close code for a refusal, and sends nothing of the ask

### Requirement: One live board per ask
Each ask SHALL have at most one live board connection. A new connection for the same ask SHALL take over, and the older tab SHALL be told that the board moved; closing it discards nothing (AD-21).

#### Scenario: The link is opened in a second tab
- **WHEN** a board is open and its link is opened in another tab
- **THEN** the new tab holds the live board, and the older one is told that the board moved, its socket is closed, and it shows that the board moved without reconnecting on its own

### Requirement: Delivery receipt
When the `received` watermark passes an answer's event, `board-host` SHALL tell the ask's board that the answer was delivered to the agent. The receipt SHALL claim delivery only, never that the agent read the answer (AD-3, FR-22).

#### Scenario: The agent collects
- **WHEN** the agent's `collect` returns the answer event
- **THEN** the board shows that answer as delivered to the agent

### Requirement: Opening a board in the browser
On a new ask, AskBoard SHALL open the board link with the first opener found, in this order: the command in `BROWSER`, `open` on macOS, `wslview` or `explorer.exe` under WSL, `xdg-open` on Linux with `DISPLAY` or `WAYLAND_DISPLAY`. The opener SHALL start with an argument vector, never through a shell (AD-8).

#### Scenario: A board opens on macOS
- **WHEN** an ask arrives on macOS without `BROWSER` set
- **THEN** `open` runs with the board link as its one argument

#### Scenario: A link that looks like a command
- **WHEN** the opener runs with a board link
- **THEN** no shell parses it, and the process receives the link as one argument

### Requirement: When no board can be shown
A board SHALL count as unshowable on a remote host (`SSH_CONNECTION`, `SSH_TTY`, `CODESPACES`), inside a container (`/.dockerenv`, `/run/.containerenv`, `REMOTE_CONTAINERS`, `DEVCONTAINER`), on CI (`CI`, `GITHUB_ACTIONS`) without `BROWSER`, or when no opener is found; the reason SHALL name which (AD-18).

#### Scenario: A devcontainer
- **WHEN** an ask arrives inside a container
- **THEN** no board can be shown, with the container named as the reason

#### Scenario: Linux without a display
- **WHEN** an ask arrives on Linux with `xdg-open` but neither `DISPLAY` nor `WAYLAND_DISPLAY`
- **THEN** no board can be shown, with no reachable browser as the reason
