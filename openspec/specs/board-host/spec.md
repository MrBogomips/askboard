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
`board-host` SHALL serve a board's page at its link, with `X-Content-Type-Options: nosniff` and a CSP of ten directives, the contract's `boardPagePolicy`: `default-src 'none'`; scripts and styles only by the hashes of the board page's code and of the view's chunks; `connect-src 'self'`; `img-src data: blob:` and `font-src data:`; `frame-src 'self'`; `base-uri 'self'`; `form-action 'none'`; and `frame-ancestors 'none'`; and nothing else (AD-8, AD-11).

#### Scenario: The served policy
- **WHEN** a board page is loaded with its token
- **THEN** its CSP header names exactly the ten directives, holds the hashes of the board page script and of every view chunk, allows frames only from `'self'`, which serves only the reading panel's source view, and holds no `'wasm-unsafe-eval'`, `'unsafe-inline'`, `'unsafe-eval'` or `'unsafe-hashes'`

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
The board page and `board-host` SHALL talk over one WebSocket per board, whose first message carries the token. Every message SHALL follow the board protocol schema set and be refused otherwise. `board-host` SHALL send the board document on connect and after every agent change, the ask's and questions' states, receipts, acknowledgements, the draft record, closes and discards; the board page SHALL send act commands and draft records.

#### Scenario: A message outside the schema
- **WHEN** the board page sends a message the board protocol does not define
- **THEN** `board-host` refuses it and the ask is unchanged

#### Scenario: The board connects
- **WHEN** a board page opens its WebSocket and sends its token first
- **THEN** it receives the ask's board document and current state, then its draft record when `ask-core` holds one

#### Scenario: A socket that does not start with its token
- **WHEN** the first message on a board's WebSocket is not `connect` with the board's token
- **THEN** `board-host` refuses it, closes the socket with the contract's close code for a refusal, and sends nothing of the ask

#### Scenario: The agent changes a question
- **WHEN** an `update` changes a question of an ask whose board is connected
- **THEN** the board receives the new board document with that question's new `rev`, without reloading

### Requirement: One live board per ask
Each ask SHALL have at most one live board connection. A new connection for the same ask SHALL take over: the older tab SHALL be told that the board moved, and the new one SHALL receive the draft record once the older tab's last draft has arrived or the contract's takeover flush wait has passed. Closing the older tab discards nothing (AD-21).

#### Scenario: The link is opened in a second tab
- **WHEN** a board is open and its link is opened in another tab
- **THEN** the new tab holds the live board, and the older one is told that the board moved, its socket is closed, and it shows that the board moved without reconnecting on its own

#### Scenario: Unsent work follows the takeover
- **WHEN** the user typed a note in one tab and opens the board's link in another
- **THEN** the new tab shows the note once the older tab's last draft has arrived

### Requirement: Delivery receipt
When the `received` watermark passes an answer's event, `board-host` SHALL tell the ask's board that the answer was delivered to the agent. The receipt SHALL claim delivery only, never that the agent read the answer (AD-3, FR-22).

#### Scenario: The agent collects
- **WHEN** the agent's `collect` returns the answer event
- **THEN** the board shows that answer as delivered to the agent

### Requirement: Opening a board in the browser
On a new ask, when no board of the same session is working, AskBoard SHALL open the board link with the first opener found, in this order: the command in `BROWSER`, `open` on macOS, `wslview` or `explorer.exe` under WSL, `xdg-open` on Linux with `DISPLAY` or `WAYLAND_DISPLAY`. The opener SHALL start with an argument vector, never through a shell (AD-8). While a board of the session is working, the notification and the terminal link open the new board (AD-2, FR-23).

#### Scenario: A board opens on macOS
- **WHEN** an ask arrives on macOS without `BROWSER` set
- **THEN** `open` runs with the board link as its one argument

#### Scenario: A link that looks like a command
- **WHEN** the opener runs with a board link
- **THEN** no shell parses it, and the process receives the link as one argument

#### Scenario: The user is working on another board
- **WHEN** a board of the same session has focus and had a user input 10 s ago, and a new ask arrives
- **THEN** no opener runs, and the notification is shown

#### Scenario: Another session's board
- **WHEN** the user is working on a board of another Claude Code session and a new ask arrives
- **THEN** the new board opens

### Requirement: When no board can be shown
A board SHALL count as unshowable on a remote host (`SSH_CONNECTION`, `SSH_TTY`, `CODESPACES`), inside a container (`/.dockerenv`, `/run/.containerenv`, `REMOTE_CONTAINERS`, `DEVCONTAINER`), on CI (`CI`, `GITHUB_ACTIONS`) without `BROWSER`, or when no opener is found; the reason SHALL name which (AD-18).

#### Scenario: A devcontainer
- **WHEN** an ask arrives inside a container
- **THEN** no board can be shown, with the container named as the reason

#### Scenario: Linux without a display
- **WHEN** an ask arrives on Linux with `xdg-open` but neither `DISPLAY` nor `WAYLAND_DISPLAY`
- **THEN** no board can be shown, with no reachable browser as the reason

### Requirement: Connections reported to the core
`board-host` SHALL report to `ask-core` when an ask gains a live board and when it loses it. A takeover, which only moves the live board from one socket to another, SHALL report neither (AD-21).

#### Scenario: A takeover is no disconnection
- **WHEN** a second tab takes the board over
- **THEN** `ask-core` is told of no connection and no disconnection, and starts no grace timer

#### Scenario: The tab closes for good
- **WHEN** the live board's socket closes and no board connects within the grace period
- **THEN** the board's link then opens only the page that says the ask was discarded

### Requirement: Acknowledging commands
`board-host` SHALL answer every act command with an acknowledgement naming its action ID, or with a refusal naming the action ID, the refused act and the reason, followed by the ask's state. A refused command SHALL leave the socket open and the ask unchanged.

#### Scenario: A submit lands
- **WHEN** the board page sends a submit that `ask-core` appends
- **THEN** the page receives an acknowledgement with the submit's action ID and the new state

### Requirement: Draft mirror
`board-host` SHALL pass each draft record from the live board, or from a board being moved within the takeover flush wait, to `ask-core`, and SHALL ignore one from any other socket. A record over the contract's draft limit SHALL be refused (AD-20).

#### Scenario: A draft from a moved tab after the wait
- **WHEN** a tab that lost the board sends a draft record after the takeover flush wait
- **THEN** the record is ignored and the held draft record is the new tab's

### Requirement: A closed ask's board
When an ask closes, `board-host` SHALL tell its live board. A closed ask's link SHALL still open its board, locked and showing that the ask is closed, and its socket SHALL refuse every act (FR-6).

#### Scenario: Opening a closed ask's link
- **WHEN** the link of an ask the agent closed is opened
- **THEN** the board shows the ask, locked, with the Closed banner, and accepts no answer

### Requirement: Local API on a Unix socket
At its first request other than `server/discover`, the session process SHALL start the local API on a Unix socket in the contract's session folder, the folder 0700 and the socket set to 0600 explicitly, never on a network interface. When the socket path is over the platform's limit, it SHALL run without a local API, on pull alone, and say so on stderr (AD-2, AD-11, NFR-3).

#### Scenario: Started at connection
- **WHEN** a client sends the handshake and then `subscriptions/listen`
- **THEN** the socket exists with mode 0600 in a 0700 folder, before any ask

#### Scenario: Only the protocol probe
- **WHEN** a client sends only `server/discover` and closes stdin
- **THEN** no socket, folder or session file was created

### Requirement: Session file
With the local API, the session process SHALL write its session file, 0600, named by the PID of its parent, the Claude Code process. It SHALL replace a file of that name only when the process it names is gone, and SHALL remove other files and sockets in the folder whose process is gone. When a live process holds the name, it SHALL run without a session file, on pull alone, and say so on stderr (AD-5, AD-22).

#### Scenario: A stale file from a killed process
- **WHEN** the session file for the key names a process that no longer exists
- **THEN** the new session process replaces it with its own

#### Scenario: Two AskBoard servers start at once
- **WHEN** two session processes under one Claude Code process start their local APIs at the same moment
- **THEN** exactly one holds the session file and its socket, and the other runs on pull alone with a diagnostic

#### Scenario: A second AskBoard server in one session
- **WHEN** a second session process starts under the same Claude Code process while the first runs
- **THEN** the first's session file is unchanged, and the second runs on pull alone

### Requirement: Session file removed at exit
When the session process exits, on stdin's end or on SIGINT, SIGTERM or SIGHUP, it SHALL remove its session file and its socket after the discard of its asks (AD-2).

#### Scenario: Claude Code stops the session process
- **WHEN** the session process receives SIGINT
- **THEN** neither its session file nor its socket remains

### Requirement: Local API requests
Every local API request SHALL carry the session token from the session file in a request header and SHALL carry no `Origin`; any other request SHALL be refused. The session token SHALL be at least 128 bits, open no board route, and appear in no diagnostic; a board token SHALL open no local API route (AD-11, NFR-4).

#### Scenario: A browser-made request
- **WHEN** a request to the local API carries an `Origin` header and the right token
- **THEN** it is refused

#### Scenario: A board token on the local API
- **WHEN** a local API request carries a board's token in place of the session token
- **THEN** it is refused, and nothing of any ask is returned

### Requirement: Local API answers at once
The local API SHALL answer every request at once, with no long-poll, each response under the contract's limit of 1 MiB; a list that does not fit SHALL be paged by `seq` with a continuation, and no page SHALL end inside one board command's events (AD-5, AD-20).

#### Scenario: Many events
- **WHEN** the events above `received` exceed 1 MiB
- **THEN** the response holds the first events that fit and says that more follow

#### Scenario: A board command across the limit
- **WHEN** the events above `received` exceed 1 MiB and the events of one board command, a Submit of two answers, would straddle the limit
- **THEN** the response stops before that command, and its continuation names the command's first event

### Requirement: Events for the mod
The local API SHALL give the mod, for each ask with a bound owner, the events above `received`, with the owner's Claude Code agent ID or none for the main conversation, and SHALL raise `received` for each delivery the mod reports. It SHALL give no event of an unchecked ask, and SHALL refuse a report no poll could give, one inside a board command among them, leaving `received` where it was (AD-3, AD-4, AD-5, AD-20).

#### Scenario: A subagent's answered ask
- **WHEN** the user answers a subagent's ask and the mod polls
- **THEN** the mod receives the answer event with that subagent's agent ID

#### Scenario: A report inside a board command
- **WHEN** the mod reports a delivery up to the first of one board command's two events
- **THEN** the report is refused, and `received` does not move

### Requirement: Pending asks
The local API SHALL give the session's pending asks: each open ask, not closed or discarded, with at least one question for which the agent has received neither an answer nor a decline. Each entry SHALL carry the ask's title, its origin's label, the number of such questions, its board link and its owner's agent ID (FR-23, EXPERIENCE Counting).

#### Scenario: An answer the agent has not received
- **WHEN** the user has answered an ask's only question and the agent has not received it
- **THEN** the ask is still pending, with one open question

### Requirement: Stop decisions
For a subagent's stop, the local API SHALL return a block carrying the events above `received` of the asks it owns, open or discarded but never closed, in order and within the response limit, cut only between board commands, when there are some and `stop_hook_active` is false, raising `received` only to the last event it carries; otherwise it SHALL let the stop through and have `ask-core` close the subagent's open asks with reason `agent-finished` (AD-10, AD-20).

#### Scenario: Blocked once
- **WHEN** a subagent stops with an answer above `received` and `stop_hook_active` false
- **THEN** the decision is a block carrying the answer, and `received` passes it

#### Scenario: A discarded ask's answer
- **WHEN** a subagent stops while an ask it owns was discarded with an answer above `received`
- **THEN** the block carries that answer and the `discarded` event, `received` passes them, and the ask is not listed among the open asks

#### Scenario: A closed ask
- **WHEN** a subagent stops while the only ask it owns with events above `received` is closed
- **THEN** the stop is let through

### Requirement: A teammate's stop is idle
Claude Code fires `SubagentStop` at every turn end of an in-process teammate, which then waits for a message. Its stop SHALL be blocked as a subagent's is, but a stop let through SHALL NOT close its asks. An agent the mod has not reported as a teammate is taken for one when its `agent_id` reads `a<agent_type>-<hex>`, as Claude Code 2.1.317 names a named agent (AD-10).

#### Scenario: An in-process teammate goes idle
- **WHEN** an in-process teammate's turn ends with nothing above `received` and its ask still waiting
- **THEN** the stop is let through and the ask stays open

#### Scenario: Mods off
- **WHEN** no mod runs and the agent `aresearcher-096d99adc3d94b0a`, of type `researcher`, stops with its ask waiting
- **THEN** the stop is let through and the ask stays open

### Requirement: Telling a teammate
The session process SHALL name an agent-team teammate by its team address, `<name>@<team>`: for its own main conversation, from its parent Claude Code process's `--agent-id`, `--agent-name` and `--team-name`, read once at start, the rest neither kept nor logged; for an in-process teammate, from the mod's report naming its agent ID a teammate. Otherwise the label SHALL stay "Main agent" or "Subagent <type>" (FR-24).

#### Scenario: A pane teammate
- **WHEN** the session process's parent runs with `--agent-id researcher@session-a1b2 --agent-name researcher --team-name session-a1b2`
- **THEN** its main conversation's asks are labelled "Teammate researcher"

#### Scenario: An in-process teammate
- **WHEN** the mod reports the agent `aresearcher-096d99adc3d94b0a` as the teammate `researcher`, and that agent asks
- **THEN** its ask is labelled "Teammate researcher" and takes no subagent ordinal

#### Scenario: The report comes after the ask
- **WHEN** a teammate's ask was labelled "Subagent researcher" before the mod's report arrived
- **THEN** the report relabels it "Teammate researcher", and its open board shows the new label

#### Scenario: A parent that cannot be read
- **WHEN** the parent's argument vector cannot be read, or its address does not match its name and team
- **THEN** the main conversation's asks are labelled "Main agent", with one diagnostic that names no argument

#### Scenario: A board command across the limit in a block
- **WHEN** a subagent's events above `received` exceed the response limit and the events of one board command would straddle it
- **THEN** the block ends before that command, and `received` rises only to the end of the last command it carries

#### Scenario: A first board command over the limit
- **WHEN** the first board command above a subagent's `received` alone passes the response limit
- **THEN** the block carries that ask without events, `received` does not move, and the open asks tell the subagent to collect

### Requirement: Effective asking rule
The local API SHALL report the effective asking rule and whether a board can be shown, by the rule of AD-18. Until the session process reads configuration, the rule SHALL be `none` (AD-14, AD-16).

#### Scenario: No configuration read
- **WHEN** a hook asks for the effective rule
- **THEN** the answer is `none`, with whether a board can be shown

### Requirement: System notification
For each new ask whose board can be shown, the session process SHALL show a system notification naming who asked, as the origin's label and the agent's name, the project, branch and worktree, the ask's title and its number of questions. An identical resend SHALL show none. A missing notifier SHALL leave the ask unaffected, with one diagnostic (FR-23).

#### Scenario: A subagent asks on Linux
- **WHEN** a subagent's ask arrives on Linux with `notify-send` present
- **THEN** a notification names the subagent, the project, branch and worktree, the title and "1 question"

#### Scenario: No notifier
- **WHEN** an ask arrives on Linux without `notify-send`
- **THEN** the ask and its result are unchanged, and stderr holds one diagnostic

### Requirement: Notifier commands
The notifier SHALL start with an argument vector, never through a shell. Agent text SHALL reach it only as plain, truncated arguments, and any script the notifier runs SHALL be AskBoard's constant text: `osascript` on macOS, `notify-send` on Linux, which opens the board on the notification's default action where `notify-send` supports actions (AD-8).

#### Scenario: A title that looks like a script
- **WHEN** an ask's title holds quotes, a backslash and `do shell script`
- **THEN** the notification shows that text as written, and no command runs but the notifier

### Requirement: Working boards
`board-host` SHALL keep each live board's working signal from its presence messages. A board is working while its last signal says so; a board that disconnects, or whose signal ends, is not (AD-2, AD-7).

#### Scenario: The board loses focus
- **WHEN** a working board's page reports that it lost focus
- **THEN** the board is no longer working

### Requirement: Who asked and the agent status on the board
After the board document on each connect, and whenever they change, `board-host` SHALL send the board its who-and-where data (who asked, the expected answerer when shown, project, directory, branch, worktree) and the agent status, each in its contract message, and nothing of either before the board's token is accepted (AD-4, AD-7, FR-24).

#### Scenario: A board connects
- **WHEN** a board page sends `connect` with its token
- **THEN** it receives the board document, the state, then the who-and-where message and the agent status

#### Scenario: The status changes with no board connected
- **WHEN** the agent status changes while no board of the ask is connected
- **THEN** the board receives the current status when it connects, and no queued history

### Requirement: Molecule source
The `molecule-source` adapter SHALL serve, through `ask-core`'s `MoleculeSource` port, the ready-made definitions AskBoard ships and no other: by name, and by the version rule of AD-9, reading nothing from the file system or the network (AD-9, AD-11, NFR-9).

#### Scenario: Looking up the WBS with PERT
- **WHEN** `ask-core` asks for `wbs-pert` with no version
- **THEN** the adapter gives the shipped `wbs-pert` 1.0.0 definition

#### Scenario: Only shipped molecules
- **WHEN** a file `wbs-pert.json` sits under the project's `.askboard/` folder
- **THEN** the adapter never reads it, and gives the shipped definition

### Requirement: Shipped definitions are checked before use
The adapter SHALL check each definition against the contract's definition format on its first lookup, not when the session process starts, and SHALL refuse to serve one that fails, or whose format major it does not support, saying why, so that a broken definition never expands (AD-2, AD-10, FR-17).

#### Scenario: A broken definition
- **WHEN** the adapter is given a definition whose `fills` name an undeclared parameter
- **THEN** its lookup fails with a problem naming the molecule and the fill, and nothing expands from it

#### Scenario: Start-up
- **WHEN** the session process starts and answers `server/discover`
- **THEN** no definition has been read or checked

### Requirement: Pointers resolve only inside the root
`excerpts` SHALL read a pointer's file only when the file's real path lies inside the real path of the ask's root, compared exactly. It SHALL refuse, as unresolved and without reading, a path invalid by the pointer grammar and a path that leaves the root through a symlink at any level (AD-12, NFR-5).

#### Scenario: A symlink out of the root
- **WHEN** `docs/link.md` inside the root is a symlink to a file outside it
- **THEN** a pointer to `docs/link.md#L1-L3` is unresolved with reason `outside-root`, and nothing of the outside file is read

#### Scenario: A directory symlink out of the root
- **WHEN** `vendor` inside the root links to a folder outside it
- **THEN** a pointer to `vendor/a.md#L1-L2` is unresolved with reason `outside-root`

#### Scenario: A dangling link out of the root
- **WHEN** `docs/gone.md` inside the root is a symlink to a file outside the root that does not exist
- **THEN** a pointer to `docs/gone.md#L1-L3` is unresolved with reason `outside-root`, the same reason as for a link to an outside file that exists, so the reason never tells whether a file outside the root exists

#### Scenario: A dangling link inside the root
- **WHEN** `docs/later.md` inside the root is a symlink to `docs/missing.md`, which does not exist
- **THEN** the pointer is unresolved with reason `not-found`

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

### Requirement: A Snapshot requested by the board
`board-host` SHALL accept a `snapshot` message on an ask's live board connection while the ask is open or closed, have `ask-core` take the Snapshot as the user's, and answer `snapshot-saved` with the request's ID and the file's absolute path (FR-26, AD-15).

#### Scenario: The user takes a Snapshot
- **WHEN** the board page sends `snapshot` with request ID `r1` on an open ask
- **THEN** a new file exists in the Snapshot folder, and the page receives `snapshot-saved` naming `r1` and that file's path

#### Scenario: A closed ask
- **WHEN** the board page of an ask the agent closed sends `snapshot`
- **THEN** the Snapshot is taken and `snapshot-saved` answers, though every act on that board is refused

### Requirement: A board's Snapshot that fails
When the Snapshot cannot be written, `board-host` SHALL answer `snapshot-failed` with the request's ID, the reason `write-failed` and the Snapshot folder's path; when the session has no project root, with the reason `no-project-root`; when the ask was discarded meanwhile, with the reason `discarded`, before the board learns of the discard (FR-26, NFR-10, AD-12).

#### Scenario: The folder cannot be written
- **WHEN** the board page sends `snapshot` and the Snapshot folder is not writable
- **THEN** the page receives `snapshot-failed` naming the request, `write-failed` and the folder

#### Scenario: No project root
- **WHEN** the board page sends `snapshot` in a session process started without `CLAUDE_PROJECT_DIR`
- **THEN** the page receives `snapshot-failed` naming the request and `no-project-root`, and no file is written

### Requirement: A board's Snapshot AskBoard fails to take
When `ask-core` fails to take a board's Snapshot for any cause other than the folder, the project root or a discard, such as a damaged view build, `board-host` SHALL report the error and answer `snapshot-failed` with the request's ID and the reason `internal-error`, naming no folder, so every request on a live connection gets one reply (FR-26, NFR-10).

#### Scenario: The view build is damaged
- **WHEN** the board page sends `snapshot` and the view build cannot be loaded
- **THEN** the page receives `snapshot-failed` naming the request and `internal-error`, the error is reported, no file is written, and the board stays open

### Requirement: Unsent work passed on as a fact
`board-host` SHALL pass the request's `unsentWork` to `ask-core` as it came, and SHALL NOT consult the mirrored draft record for a Snapshot (AD-15, AD-20).

#### Scenario: The page says it holds unsent work
- **WHEN** the board page sends `snapshot` with `unsentWork: true`
- **THEN** the Snapshot's data records `unsentWork: true`, and holds nothing of the draft

### Requirement: A board's Snapshot is no event
A Snapshot the board takes SHALL reach the agent only as a file in the Snapshot folder: no event, no push and no `collect` entry (FR-26, open question A7).

#### Scenario: The agent collects after the user's Snapshot
- **WHEN** the user takes a Snapshot from the board and the agent collects with its last cursor
- **THEN** the result holds no event, and the file is in the Snapshot folder

### Requirement: Settings sent to a board when it connects
When a board page connects with its token, `board-host` SHALL send it the `settings` message before the board itself: every presentation and behaviour key in effect, with its value and the file and key that set it, the files not applied and the warnings (FR-35, AD-14). It SHALL send `settings` again after every write.

#### Scenario: A board opens with the user's theme
- **WHEN** the user file sets `theme` to `dark` and a board connects
- **THEN** the page receives `settings` with `theme` `dark` from the user file before it receives the board

#### Scenario: Read-only rows name their file and key
- **WHEN** the project file sets `askingRule` to `with-references` and a board connects
- **THEN** `settings` gives `askingRule` the value `with-references`, the project file and the key `askingRule`

### Requirement: A board writes only presentation keys
`board-host` SHALL pass a `setting` message to the session process only when it names `theme`, `density` or `contextPlacement` with a value the configuration schema allows; any other message SHALL be refused as a `message` and nothing SHALL be written (AD-14). A board token never opens the local API (AD-11).

#### Scenario: A board tries to set the editor
- **WHEN** a client holding a board's token sends `setting` with `key` `editor` and `value` `["sh", "-c", "id"]`
- **THEN** `board-host` answers `refused` with reason `message`, and neither configuration file changes

#### Scenario: A failed write reaches the board
- **WHEN** a board writes `density` `comfortable` and the user folder cannot be written
- **THEN** the page receives `settings` whose write outcome names the user file's path and the error, and the board keeps working

### Requirement: The local API reports the configured asking rule
The local API's asking rule SHALL be the `askingRule` in effect, from the project file, else the user file, else `none`, replacing the rule fixed at `none` until configuration was read (AD-14, AD-16, FR-30).

#### Scenario: The rule from the project file
- **WHEN** the project file sets `askingRule` to `always` and a hook asks the local API for the rule
- **THEN** the answer's rule is `always`

#### Scenario: A project file that fails its check
- **WHEN** the project file sets `askingRule` to `always` and fails the schema, and the user file sets none
- **THEN** the answer's rule is `none`

### Requirement: The editor command comes from configuration
The editor command `board-host` runs on "Open in editor" SHALL be the user file's `editor` in effect, with `{file}` and `{line}` replaced, and none when it is not set or was ignored (AD-8, FR-9).

#### Scenario: The user's command runs
- **WHEN** the user file sets `editor` to `["true", "{file}"]` and the user clicks "Open in editor"
- **THEN** `true` starts with the file's absolute real path as its argument

#### Scenario: A project command never runs
- **WHEN** only the project file sets `editor` and the user clicks "Open in editor"
- **THEN** no process starts, and the outcome is `no-editor`

### Requirement: Widget answer acts
`board-host` SHALL pass an `act` whose answer carries widget values to `ask-core` as it passes any act, and SHALL answer it with `done` or `refused` naming the action ID and the act's index, followed by the state (AD-10, AD-20).

#### Scenario: A refused widget answer
- **WHEN** the board page sends an answer whose Tree value names a node twice
- **THEN** `board-host` sends `refused` with reason `act`, the action ID and the act's index, then the state, in which the question is still open

### Requirement: Widget answers in the board state
After a widget answer is logged, the state `board-host` sends SHALL hold the question's answer with its logged `values`, on every connect, reconnect and takeover (AD-20, AD-21).

#### Scenario: A reload after a Tree answer
- **WHEN** the board page reconnects after the UJ-2 question was answered
- **THEN** the state holds that answer's `values` for `wbs__tree` and `schedule__plan` with receipt `sent`, or `delivered` once collected

### Requirement: The session's molecule source
The session process SHALL give `ask-core` the molecule source over the shipped definitions, reading no file and opening no connection, and creating nothing before the first lookup (AD-2, AD-9, AD-11).

#### Scenario: The first ask with a reference
- **WHEN** the session process has started and an agent sends the UJ-2 ask
- **THEN** `wbs-pert` 1.0.0 and `gantt-plan` 1.0.0 are found, and no file under the project is read for them

### Requirement: Widget results in acts and the draft mirror
`board-host` SHALL pass an act whose answer carries `results` to `ask-core` as it passes any act, answering `done` or `refused` naming the action ID and the act's index, then the state; and SHALL keep a draft record's `results` and give them back on connect, reconnect and takeover as it does `values` (AD-20, AD-21).

#### Scenario: A result the Tree cannot give
- **WHEN** the board page sends an answer act whose `results` name a Tree item
- **THEN** `board-host` sends `refused` with reason `act`, the action ID and the act's index, then the state, in which the question is still open

#### Scenario: A held result after a takeover
- **WHEN** a board page mirrors a draft record whose question holds a result, and a second board page takes the ask over
- **THEN** the second page receives that draft record with the result unchanged

### Requirement: The board's message limit
`board-host` SHALL close a board's socket with the WebSocket code 1009 on a message whose payload passes the contract's message limit, without parsing it and changing nothing of the ask; a message within the limit SHALL be read as any other (AD-21, NFR-10).

#### Scenario: A message over the limit
- **WHEN** the live board sends an act command one byte over the limit
- **THEN** its socket closes with 1009 and the ask's log is unchanged

#### Scenario: A message at the limit
- **WHEN** the live board sends a message of exactly the limit
- **THEN** `board-host` reads it, refusing or applying it as its content says, and the socket stays open
