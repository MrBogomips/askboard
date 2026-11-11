# mcp-adapter Specification

## Purpose
The MCP adapter is how agents reach AskBoard: the session process's tools over stdio, which validate every request against the contract and return compact, typed results, so that every capability works by pull alone (AD-4, AD-6).

## Requirements

### Requirement: Tool list
The session process SHALL list exactly `ask`, `update`, `collect`, `fetch` and `snapshot`, in that order, with the input schemas, descriptions and annotations of the approved model contract, as amended by the amendments the contract records, and the list SHALL NOT change during a session. Each description, and the server instructions, SHALL stay within 4,096 characters, and each full tool name within 128.

#### Scenario: Listing the tools
- **WHEN** a client lists the tools
- **THEN** it receives `ask`, `update`, `collect`, `fetch` and `snapshot`, in that order, matching the approved definitions of the contract fixtures with the recorded amendments applied

#### Scenario: A definition grows too long
- **WHEN** a tool description or the server instructions exceed 4,096 characters
- **THEN** the adapter's tests fail

#### Scenario: The update description names reply's fields
- **WHEN** a client reads the `update` tool's description
- **THEN** it says that a reply names its question in `itemId` and its follow-up's cursor in `followUp`, and that a widget joins a question through a change of the question's `items`, sent whole

### Requirement: Server instructions for the tools listed
The server instructions SHALL be the approved model contract's instructions, as amended by the amendments the contract records, keeping only the lines that apply to the tools listed.

#### Scenario: No instruction names a missing tool
- **WHEN** a client reads the server instructions
- **THEN** they name no tool other than the four listed, `ask`, `update`, `collect` and `fetch`, and never `snapshot`, which E7 adds

#### Scenario: The instructions are the approved text
- **WHEN** a client reads the server instructions
- **THEN** they equal the approved `server-instructions.md` with the recorded amendments applied, uncut

#### Scenario: The follow-up line names the question
- **WHEN** a client reads the server instructions' line on follow-ups
- **THEN** it says that the `reply` names the question's `itemId` and the follow-up's cursor

### Requirement: No side effect before the first request
The session process SHALL open no port, write no file and start no process until it receives a request other than `server/discover` (AD-2).

#### Scenario: A protocol probe
- **WHEN** a client starts the session process, sends only `server/discover`, then closes stdin
- **THEN** no port was opened, no file written and no process started

### Requirement: Validation errors
The session process SHALL validate every request against the contract. A request the agent must fix SHALL return `isError` text that names the item ID and the expected shape, puts the first problems first and stays under 4,000 characters (AD-6).

#### Scenario: An invalid ask
- **WHEN** an ask's question has no options
- **THEN** the result is an error that names the question's item ID and says that `options` is required, and no ask is created

#### Scenario: Many problems
- **WHEN** a request has more problems than fit in 4,000 characters
- **THEN** the error text lists the first problems and stays under 4,000 characters

### Requirement: The ask result
A valid `ask` SHALL return at once, without waiting for the user: its result names the versions it follows, the epoch, the ask ID, state `waiting`, the first cursor and the board link (FR-21).

#### Scenario: An ask returns at once
- **WHEN** an agent sends the plain-choice ask
- **THEN** the result arrives before any user action, with state `waiting`, cursor `<epoch>.0` and a link of the form `http://127.0.0.1:<port>/b/<askId>?t=<token>`

### Requirement: A session without hooks
An ask that arrives with no agent record SHALL be unchecked: its `ask` result SHALL say that push, ownership checks and the stop guard are unavailable and that the agent must collect before it finishes, and every `collect`, `update` and `fetch` result SHALL mark the ask as unchecked (AD-5). An ask bound to a record SHALL carry neither the warning nor the mark.

#### Scenario: A session without hooks
- **WHEN** an agent sends an ask in a session whose hooks do not run
- **THEN** the result carries the no-hooks warning, and a later `collect` marks that ask as unchecked

#### Scenario: A session with hooks
- **WHEN** an agent sends an ask whose `PreToolUse` record reached the session process
- **THEN** the result carries no no-hooks warning, and a later `collect` does not mark the ask as unchecked

#### Scenario: E1's sessions have no hooks
- **WHEN** an agent sends an ask in a session whose hooks do not run
- **THEN** the result carries the no-hooks warning, and a later `collect` marks that ask as unchecked

#### Scenario: E3's sessions have no hooks
- **WHEN** an agent sends an ask in a session whose hooks do not run, then updates, collects and fetches it
- **THEN** the `ask` result carries the no-hooks warning, and the `update`, `collect` and `fetch` results mark that ask as unchecked

### Requirement: No board can be shown
When no board can be shown, `ask` SHALL return the typed result `unavailable` with its reason and SHALL create no ask (AD-18, NFR-8).

#### Scenario: A remote host
- **WHEN** an ask arrives while `SSH_CONNECTION` is set
- **THEN** the result is `unavailable`, naming a remote host as the reason, and no board, port or ask exists afterwards

### Requirement: Collecting events
`collect` SHALL take `{askId, after}` per ask and return, grouped by ask, each ask's ID, state, latest cursor and the events after `after`. An ask ID unknown to the current epoch with a cursor of the current epoch SHALL be an error naming it (AD-3).

#### Scenario: Collecting an answer
- **WHEN** the user has answered and the agent collects after `<epoch>.0`
- **THEN** the result holds the ask with state `answered`, cursor `<epoch>.1` and the answer event

#### Scenario: Collecting after a restart
- **WHEN** the agent collects with a cursor of an earlier epoch
- **THEN** that ask is reported `discarded`, with no events

### Requirement: Waiting for an item
`collect` with `wait` SHALL name a question and return as soon as the log gains an event for it, follow-ups included, or the ask's state changes; and at once when the question is postponed (outcome `postponed`), the ask closed (outcome `closed`) or the ask discarded (state `discarded`). It SHALL send progress at least every 60 s when the request carries a progress token, and SHALL return `open` after 20 minutes (AD-4).

#### Scenario: The answer arrives while the agent waits
- **WHEN** an agent collects with `wait` on question `database` and the user then answers it
- **THEN** the call returns with the answer event, without waiting longer

#### Scenario: A follow-up ends the wait
- **WHEN** an agent waits on question `q2` and the user writes a follow-up on it
- **THEN** the call returns with the `follow-up` event, so the agent can reply

#### Scenario: Waiting on a postponed question
- **WHEN** an agent waits on a question the user has postponed
- **THEN** the call returns at once with outcome `postponed`

#### Scenario: Nobody answers
- **WHEN** an agent collects with `wait` and no event arrives within 20 minutes
- **THEN** the call returns `open`, having sent progress at least every 60 s

### Requirement: Result size
A result SHALL stay under 30,000 characters. A `collect` result that would exceed it SHALL return the events that fit, in order, with `more: true`, and SHALL never split the events of one board command; a command whose events alone exceed the limit SHALL fill a page by itself (AD-6, AD-20).

#### Scenario: Paging a large collect
- **WHEN** the events after the cursors passed exceed 30,000 characters
- **THEN** the result holds the first events that fit, with `more: true`, and a `collect` after its cursors returns the rest

#### Scenario: A submit at a page's edge
- **WHEN** a page has room for only two of a submit's three events
- **THEN** the page ends before the submit, and the next `collect` returns all three

### Requirement: Exit
The session process SHALL exit when its stdin closes or on SIGINT, SIGTERM or SIGHUP, after the discard of its open asks (AD-2). Stdout SHALL carry only MCP protocol, and diagnostics SHALL go to stderr with no agent content and no token.

#### Scenario: Claude Code stops the session process
- **WHEN** the session process receives SIGINT with a board connected
- **THEN** the board is told the ask was discarded and the process exits

#### Scenario: No token in diagnostics
- **WHEN** the session process writes diagnostics while asks are open
- **THEN** stderr holds no board token and no question text

### Requirement: Updating an ask
`update` SHALL apply its actions through `ask-core` and return at once the versions, epoch, ask ID, the ask's state and, per action, its item ID with the question's new `rev` where it changed; a recorded answer SHALL be reported with its `who` and `when`. The result SHALL carry no cursor, so the agent's cursor still covers every event it has not collected (AD-3, FR-6).

#### Scenario: Adding and rewording
- **WHEN** an agent adds question `q4` and changes the text of open question `q2`
- **THEN** the result names `q4` at `rev` 1 and `q2` at `rev` 2, with the ask's state, and the board shows both without a reload

### Requirement: Refused updates
An update `ask-core` refuses SHALL return `isError` text under 4,000 characters that names the action's index, the item ID and why, and for a question whose answer is logged, that answer's cursor; the ask SHALL be unchanged (AD-6, AD-20).

#### Scenario: Changing an answered question
- **WHEN** an agent changes a question answered at `<epoch>.2`
- **THEN** the result is an error naming the action, the question and `<epoch>.2`, saying that the question must be reopened first

### Requirement: Closed and discarded asks in update and fetch
`update` on a closed ask SHALL return the typed result `closed`. `update` and `fetch` on a discarded ask, or on an ask ID unknown to the current epoch, SHALL return the typed result `discarded`, naming the ask (AD-10, AD-21).

#### Scenario: After a restart
- **WHEN** an agent updates an ask it sent before the session process restarted
- **THEN** the result is `discarded`, never an error that the ask is unknown

### Requirement: Fetching an item
`fetch` SHALL return one item of an open or closed ask as `ask-core` holds it now: its type, `rev` and props, and for a question its state and current answer in full. It SHALL return nothing from the draft record, SHALL NOT raise `received`, and an item ID the ask does not hold and never deleted SHALL be an error naming it (FR-20, AD-6).

#### Scenario: Fetching after a revision
- **WHEN** the user answered `database` with `PostgreSQL`, then revised it to `SQLite`, and the agent fetches `database`
- **THEN** the result holds the question at its `rev` with the answer `SQLite` and its cursor

#### Scenario: Fetching a closed ask
- **WHEN** an agent fetches a question of an ask it closed
- **THEN** the result holds the question and its answer as they were at the close

#### Scenario: An item the ask never held
- **WHEN** an agent fetches `budget` from an ask that has never held an item `budget`
- **THEN** the result is an error naming the ask and `budget`

#### Scenario: An item a change dropped
- **WHEN** the agent changed question `plan`'s `items` to a list without the TextField `owner`, then fetches `owner`
- **THEN** the result is an error naming the ask and `owner`, never the outcome `deleted`

### Requirement: Fetch pages
When an item's value does not fit one result, `fetch` SHALL return consecutive slices of its RFC 8785 JSON text, each under the contract's page size, with a `continuation` naming the item's `rev` and the next offset, and none on the last slice. A continuation for a value that changed since SHALL be refused, saying to fetch again (open question 5).

#### Scenario: A long question
- **WHEN** a question's full value is longer than one page
- **THEN** `fetch` returns its first slice and a continuation, and the slices joined in order parse as the full value

#### Scenario: The value changed between pages
- **WHEN** the agent changes the item, then fetches with a continuation issued before
- **THEN** the result is an error saying the item changed and to fetch it again

### Requirement: Supported Claude Code versions
The session process SHALL take the client version from the protocol's client information when it names `claude-code`, else from the mod's report. An `ask` from a Claude Code below the contract's minimum SHALL be refused with an error naming the minimum and the version found, and SHALL create nothing. An unknown version SHALL be allowed, with one diagnostic on stderr (AD-18).

#### Scenario: Below the minimum
- **WHEN** an `ask` arrives from Claude Code 2.1.308
- **THEN** the result is an error naming 2.1.311 and 2.1.308, and no ask, board or notice exists afterwards

#### Scenario: The version from the mod
- **WHEN** the requests carry no client information and the mod has reported 2.1.312
- **THEN** the `ask` proceeds

#### Scenario: No version known
- **WHEN** neither the requests nor the mod name a Claude Code version
- **THEN** the `ask` proceeds, and stderr holds one diagnostic saying that the version is unknown

### Requirement: Unresolved pointers in ask and update results
The results of `ask` and `update` SHALL carry one `unresolved-pointer` warning for each pointer of the revisions the call created that did not resolve, within `ask-core`'s bound on them, a closing warning counting any left out, beside any other warning, and the call SHALL succeed (AD-6, FR-8).

#### Scenario: An update that adds a missing image
- **WHEN** an `update` adds an image whose file does not exist
- **THEN** the update is applied, and its result carries a warning naming the image, its pointer and reason `not-found`

#### Scenario: Many missing excerpts
- **WHEN** an agent asks with 40 excerpts whose pointers of 1,024 characters lead outside the project folder
- **THEN** the `ask` result holds the board link, the `unresolved-pointer` warnings that fit and one closing warning counting the rest, and `fetch` of the question returns every excerpt's pointer, status and reason

### Requirement: Fetch omits excerpt text and image bytes
A `fetch` result SHALL carry each excerpt's pointer, title, status, reason and line range, each image's pointer, alt text, status and media type, and each reference as the board document holds it, but never an excerpt's text, written or read, nor an image's bytes (AD-6).

#### Scenario: Fetching a question with context
- **WHEN** the agent fetches a question holding a resolved excerpt, an agent-written excerpt and an image
- **THEN** the result holds no excerpt text and no image bytes, and the excerpt's status and line range are there

### Requirement: Approved texts unchanged
The tool definitions and server instructions SHALL stay the approved texts with the amendments the contract records applied, which already teach pointers (`path#Heading`, `path#L10-L40`) and screenshots saved under `.askboard/media/`; E5 adds nothing to them (NFR-1).

#### Scenario: The listed tools
- **WHEN** a client lists the tools after this change
- **THEN** each definition and the instructions equal the approved fixtures with the recorded amendments applied

### Requirement: Taking a Snapshot with the tool
`snapshot` SHALL take a Snapshot of the ask it names and return the versions, epoch, ask ID, the ask's state as captured and the file's absolute path, never the file's content. It SHALL take no path and accept no field but `askId` (AD-6, AD-15, FR-26).

#### Scenario: After the user answered
- **WHEN** the user has answered and the agent calls `snapshot` with the ask's ID
- **THEN** the result names the path of a new file under `.askboard/snapshots/` and the state `answered`, and holds none of the file's content

#### Scenario: A path in the request
- **WHEN** an agent calls `snapshot` with `askId` and `path`
- **THEN** the result is an error naming `path`, and no file is written

### Requirement: Snapshot of a discarded ask
`snapshot` on a discarded ask, or on an ask ID unknown to the current epoch, SHALL return the typed result `discarded`, naming the ask and saying that it was discarded (FR-26, AD-10, AD-21).

#### Scenario: The board was closed
- **WHEN** an agent calls `snapshot` on an ask whose board was closed past the grace period
- **THEN** the result is `discarded` for that ask, not an error, and no file is written

### Requirement: Snapshot refusals
A `snapshot` call that E4's owner check refuses, as it refuses `fetch`, SHALL return an error naming the ask; a Snapshot refused because the session has no project root SHALL return an error naming `CLAUDE_PROJECT_DIR`; a Snapshot that cannot be written SHALL return an error naming the Snapshot folder and the reason. None SHALL write a file (AD-5, AD-6, AD-12).

#### Scenario: Another agent's ask
- **WHEN** a subagent calls `snapshot` on an ask the main conversation owns
- **THEN** the result is an error naming the ask as another agent's, and no file is written

#### Scenario: The folder cannot be written
- **WHEN** the Snapshot folder is not writable
- **THEN** the result is an error naming the folder and the reason

#### Scenario: No project root
- **WHEN** an agent calls `snapshot` in a session process started without `CLAUDE_PROJECT_DIR`
- **THEN** the result is an error naming `CLAUDE_PROJECT_DIR`, and no file is written

### Requirement: Snapshot of an unchecked ask
The result of `snapshot` on an ask that has no owner SHALL carry `unchecked: true`, as `collect`'s entry for that ask does (AD-5).

#### Scenario: A session without hooks
- **WHEN** an agent in a session whose hooks do not run calls `snapshot`
- **THEN** the result names the path and carries `unchecked: true`

### Requirement: The tool reads nothing to the agent
`snapshot` SHALL NOT raise `received`, SHALL return no event, and SHALL leave the agent's cursor covering every event it has not collected (AD-3).

#### Scenario: An answer not yet collected
- **WHEN** an answer is logged, the agent calls `snapshot`, then `collect` after its last cursor
- **THEN** `collect` returns the answer

### Requirement: Widget asks refused with worded problems
An `ask` or `update` whose widget items or molecule references fail validation or expansion SHALL return `isError` text that names each item's ID in the agent's addressing, the field and the expected shape, first problems first, under 4,000 characters (AD-6).

#### Scenario: Data outside a molecule's parameters
- **WHEN** an agent sends the UJ-2 ask with `schedule`'s `start` set to `11/02/2026`
- **THEN** the result is an error naming `schedule`, `data.start` and the date form a plan takes, and no board opens

### Requirement: Formula warnings in results
The `ask` and `update` results SHALL carry each `formula` warning the send-time graph check gives, beside the no-hooks warning, and the request SHALL succeed (AD-6, AD-13, FR-14).

#### Scenario: A cycle in a plan
- **WHEN** an agent asks a Gantt whose two tasks depend on each other
- **THEN** the `ask` result holds the board link and a `formula` warning of kind `cycle` naming the Gantt's ID

### Requirement: Collecting widget answers
`collect` SHALL return a widget answer's event as `ask-core` logged it: its `changes` and `derived` in reference addressing, or `tooLarge: true` without them, and SHALL never return a full edited value (FR-18, FR-20).

#### Scenario: The UJ-2 answer by pull
- **WHEN** an agent collects after the user answered the UJ-2 question and postponed `erp-export` with one Submit
- **THEN** the result holds one answer event to `plan` whose `changes` and `derived` are the approved ones and the `postponed` event of `erp-export`, as the approved answer has them

### Requirement: Fetching widget items and references
`fetch` SHALL take the ID of a widget item or molecule reference in a question and return that item as `ask-core` gives it, paged as any long value; for a question, the answer it returns SHALL hold the edited values and derived values in reference addressing (FR-20, AD-9).

#### Scenario: Fetching the WBS
- **WHEN** an agent fetches `wbs` after the UJ-2 answer
- **THEN** the result holds a Tree with the ID `wbs` whose nodes include `u-1`, and no expanded ID

#### Scenario: Fetching a too-large answer
- **WHEN** an agent fetches the question of an answer logged with `tooLarge: true`
- **THEN** the result, in pages if needed, holds the answer's edited values and derived values

### Requirement: Warnings of ask and update results within the result size
The warnings of an `ask` result SHALL be the no-hooks warning when it applies, then the `unresolved-pointer` warnings, then the `formula` warnings, each kind within its own bound, so that an `ask` result stays under 30,000 characters whatever the input format admits; an `update` result's warnings SHALL keep the same order and bounds (AD-6).

#### Scenario: The worst ask the contract admits
- **WHEN** an agent in a session without hooks asks with 200 excerpts and images whose pointers are 1,024 characters that JSON escapes, and a Gantt plan whose every task names 50 predecessors that are no task
- **THEN** the ask is created, and its result's text is under 30,000 characters, valid against the ask result's schema, with the no-hooks warning first and a closing warning of each other kind

#### Scenario: The same on update
- **WHEN** an `update` changes that ask's question so that its excerpts and its plan are sent again
- **THEN** the update is applied, and its result's warnings, of both kinds, each with its closing warning, take at most 20,000 characters

### Requirement: A deleted item in fetch
`fetch` of an item the agent deleted, or of an item at any depth inside a question or area it deleted, SHALL return the typed result `deleted`, naming the ask and the item, never an error. It SHALL carry the versions and the epoch, and `unchecked: true` while the ask has no owner (FR-5, FR-6, AD-6, AD-10).

#### Scenario: A deleted question
- **WHEN** the agent deletes question `erp-export` with `update`, then fetches `erp-export`
- **THEN** the result is the typed outcome `deleted` naming the ask and `erp-export`, and it is not marked as an error

#### Scenario: An item inside a deleted question
- **WHEN** the agent deletes question `plan`, which holds a Group `owner-group` holding the TextField `owner`, then fetches `owner`
- **THEN** the result is the outcome `deleted` naming `owner`

#### Scenario: A molecule reference inside a deleted question
- **WHEN** the agent deletes the UJ-2 question `plan`, which holds the molecule references `wbs` and `schedule`, then fetches `wbs`, and then `wbs__tree`
- **THEN** `wbs` gives the outcome `deleted` naming `wbs`, and `wbs__tree`, an expanded ID the agent never sent, gives the error for an item the ask never held

#### Scenario: A deleted item of an unchecked ask
- **WHEN** an ask sent with no agent record has a question deleted, and the agent fetches it
- **THEN** the outcome `deleted` carries `unchecked: true`

#### Scenario: A discarded ask still wins
- **WHEN** the ask that held a deleted question is discarded, and the agent fetches that question
- **THEN** the result is the outcome `discarded` naming the ask

### Requirement: The server instructions route by complexity
The server instructions SHALL route by the question's cognitive and contextual complexity, never by a count of questions or options, and give its cases as examples for the agent to judge. A simple, self-explanatory choice SHALL stay with AskUserQuestion, and the user's asking rule or instruction SHALL come first. The instructions SHALL tell the agent to load the `askboard` skill before its first `ask`, and never to put a complex question in chat prose (FR-29, FR-30, AD-6).

#### Scenario: The routing paragraph
- **WHEN** a client reads the server instructions
- **THEN** they name many interconnected questions, questions that cite documents by bare IDs and content that reads better seen and worked on, say these are examples to judge by, keep a simple, self-explanatory choice with AskUserQuestion, and hold neither "more than four" nor "one quick choice"

#### Scenario: The skill line
- **WHEN** a client reads the server instructions
- **THEN** one line tells the agent to load the `askboard` skill before its first `ask`

#### Scenario: Not in chat prose
- **WHEN** a client reads the server instructions
- **THEN** one line tells the agent never to put a complex question in chat prose but to ask it on the board

#### Scenario: Within the limits
- **WHEN** a client reads the server instructions
- **THEN** they are at most 4,096 characters and never name `snapshot`

### Requirement: The ask description points to the skill
The `ask` tool's description SHALL tell the agent to load the `askboard` skill before its first `ask`, the skill saying when to ask on the board and listing every item type and its props (FR-29, AD-6).

#### Scenario: The ask description
- **WHEN** a client lists the tools
- **THEN** `ask`'s description tells the agent to load the `askboard` skill before its first ask, and stays within 4,096 characters
