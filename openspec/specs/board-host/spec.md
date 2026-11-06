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
