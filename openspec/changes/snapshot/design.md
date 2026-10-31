# Design

## Context

See proposal.md for why E7 comes now and what it leaves out. What the code starts from, on `main` at 92ca203 (E1, compute-engine, the early benchmark):

- **`assemble`** (`packages/view/src/assemble/`): `assemble(data: BootData, manifest, fetched)` writes `<meta charset>`, the view policy as a meta tag, the `askboard-data` block (`{document, state}`, `<` escaped), the selected chunks' styles, `#root` and their scripts. `selectChunks` takes the shell, the chunk of each component the document's items render with, and every chunk those need, ordered libraries, shell, components. It is plain ECMAScript, and its file says a Snapshot will call it.
- **The view build** writes `dist/view/` with a manifest (`view-manifest` 1.0: each chunk's kind, script, styles, needs, components and licence notices, the texts under `licences/`). The shell imports ext-apps' `App` at load, so the shell chunk needs the `ext-apps` chunk (310,860 bytes). The shell already boots without a channel when it has no parent (`NO_CHANNEL`), following the system theme.
- **`board-host`** loads and checks the view build at the first ask (`board-host/view.ts`, `LoadedView`), and the board page fetches chunks by hash and calls `assemble` in the browser.
- **The `snapshot` unit** is an empty `packages/server/src/snapshot/index.ts`. `tools/check-imports.ts` already lets it import `core`, `contract` and `view/assemble`, and nothing imports it but the entry point. `@askboard/server` does not yet depend on `@askboard/view`.
- **`contract`**: `SCHEMA_SET_OWNERS` already names `snapshot-data` with owner `snapshot`; `sets.ts` lists six sets. The approved `tools.json` fixture holds the `snapshot` definition (`askId` only; `destructiveHint: false`, `openWorldHint: false`); the approved server instructions name no `snapshot`. No approved example holds a `snapshot` result.
- **Not on `main` yet, and borrowed** (decision 1): E3 (`ask-lifecycle`, at `882fd45`) and E4 (`push-delivery`, at `7c14b6e`), both in implementation; tree-widget (`bcb4e29`, PR #11), widget-answers (`e7592bc`, proposal) and molecules (`65491c0`, proposal).

ADs this design relies on: AD-1, AD-3, AD-5, AD-6, AD-7, AD-8, AD-9, AD-10, AD-11, AD-12, AD-14, AD-15, AD-18, AD-19, AD-20, AD-21. UX sections it implements: EXPERIENCE Snapshots (Who takes one, Content, Agent-readable data, Snapshot view, Security, Where); Component Patterns, Board chrome (Bottom action bar, Snapshot control); Changes, values and board states (Board banner: Closed, Discarded); State Patterns, By surface (the four Snapshot rows); Voice and Tone (Snapshot); Dark theme; Board page or view (Theme, the Snapshot requests row). DESIGN.md: Components, Snapshot control, Snapshot view, Board banner, Bottom action bar, Delivery receipt; Dark theme mechanism.

## Goals / Non-Goals

**Goals:**

- A Snapshot is assembled by the same `assemble`, from the same inputs, as the board the user saw (AD-9): the view renders a Snapshot as a locked board with no host.
- One gathering in `ask-core` serves both the agent and the board, under one owner check and one discard rule.
- Every addition is an appended block, so merging with E3, E4 and the widget changes stays mechanical.

**Non-Goals:**

- Configuration (`snapshotFolder`), AD-14's first-ask folders and the settings row (E8).
- Diagram renders on the board, their store and their message (the Diagram epic): E7 builds only the `assemble` seam (decision 4).
- Widget-specific Snapshot looks and references (the widget epics, E5).
- Listing, opening or deleting Snapshots from AskBoard: the folder is the interface (FR-26).

## Decisions

### 1. Base: wait for E3 and E4, then check every borrowed name

Group 0 waits until E3 and E4 have merged to `main`, rebases on it, and checks each name below in the merged code. A name that differs, or a seam that is missing, stops the work for `/opsx:update`. E7 defines nothing in parallel to these.

| From | What E7 uses | Where it is used |
| --- | --- | --- |
| E3 | `closed` ask state and `close(reason)`; the board state with per-question `rev`, state, current and previous answer, recorded flag, receipt and thread (`urn:askboard:board-protocol:board-state` at 1.1); the kept revisions (`revs`); the `Clock` port; the typed `discarded` result pattern of `update` and `fetch` (`fetch-outcome.json`); `HANDLERS` in `mcp-tools/tools.ts` and the unknown-tool error in `server.ts`; decision 8's appended steps for a board-protocol message; `bottom-bar.tsx`, `board-status.ts` (Closed banner), `unsent-work.ts`, `ViewLock` with `closed`; the action-ID format | decisions 3, 6, 7, 8 |
| E4 | `core.bind(identity)` with `{toolUseId?, tool, askIds}`, `Binding`, `OwnerRefusal` (`no-record`, `other-owner`), `ownerOf(askId)`, the refusal texts `fetch` returns; the `origin` message (`urn:askboard:board-protocol:origin`) and the function that builds it; the `unchecked` rule (only an ask without an owner); the `PreToolUse` matcher `mcp__plugin_askboard_askboard__.*` and `askIdsOf` reading `askId`, so `snapshot` needs no hook change | decisions 3, 6 |
| tree-widget | `ItemProps.disabled` and the Tree's read-only navigation; `ViewDocument` and `BootData`; the widget host for browser tests | decisions 8, 9 |
| widget-answers | the full edited values kept per answer ("Widget answers stored in full") and the board state's `values` | decision 3 |
| molecules | the expansion map beside each board document | decision 3 |

What has not reached `main` by group 0 is handled as Handed on says: E7 then gathers what exists, and the later change fills its part of the Snapshot data.

### 2. Contract

- **The `snapshot-data` set**, version 1.0, owner `snapshot`, one schema `urn:askboard:snapshot-data:snapshot-data`:

  ```text
  { versions: { snapshot, output, boardProtocol },
    snapshot: { takenAt, takenBy: "agent" | "user", who?, unsentWork?: true },
    epoch, askId,
    document,                                   // board document, current
    revisions: [ { itemId, rev, props } ],      // earlier revisions an event names
    state,                                      // board state, as the board receives it
    origin?,                                    // E4's origin message, when known
    events: [ { event, values? } ],             // the whole log in seq order, each event with its cursor
    molecules?: [ { itemId, reference, molecule, version } ],
    renders?: [ { itemId, rev, light, dark } ] }
  ```

  It `$ref`s the board document, board state, origin and output-event schemas, so it validates exactly what those sets define. `who` is required when `takenBy` is `user` and refused otherwise; `unsentWork` only with `user`. `events[].values` holds the full values `ask-core` keeps for that answer, by item ID in reference addressing (open question A2). Every level refuses fields it does not define, so a `draft` field fails.
- **Why `document` and `state` keep those names:** they are `BootData`'s, so the view boots a Snapshot through the same `parseBootData` and renders it through the same store; the extra fields are what a live board gets from other messages or never needs.
- **Tool envelopes:** `snapshot` joins `tools.json` as its fifth entry, the approved definition whole, with `urn:askboard:tool-envelopes:snapshot-request` built from it like the other requests; `snapshot-result` (`{versions, epoch, askId, state, path, unchecked?}`, `path` matching `^/`) and the typed `discarded` result, after E3's pattern for `fetch`.
- **Board protocol:** `snapshot` (page to host: `requestId`, `unsentWork?`), `snapshot-saved` (`requestId`, `path`) and `snapshot-failed` (`requestId`, `reason`, `folder` with `write-failed`), added by E3's decision 8 steps: a schema file each, names appended to `BOARD_PROTOCOL_MESSAGES` and `SCHEMA_IDS`, a recorded transcript. `requestId` reuses E3's action-ID schema.
- **View manifest 1.1:** optional `hostOnly: true` on a chunk and optional `keptRender` on a component chunk (decisions 4 and 5).
- **Constants:** `SNAPSHOT_FOLDER` (`.askboard/snapshots`), `ASKBOARD_GITIGNORE` (the four lines), `SNAPSHOT_NAME_PATTERN`, `SNAPSHOT_RANDOM` (6 characters from `[a-z0-9]`), `SNAPSHOT_NAME_TRIES` (5), `SNAPSHOT_DATA_ELEMENT` (`askboard-data`) and `SNAPSHOT_LICENCES_ELEMENT` (`askboard-licences`). The view's `BOOT_DATA_ID` takes its value from the contract's constant.
- **Versions:** `snapshot-data` starts at 1.0. The tool envelopes, the board protocol and the view manifest each take their next minor; as in E3's decision 2, the minor is a label assigned at merge, and E7 reads no other change's version number.
- **Registration:** `snapshotDataSet` appended to `SCHEMA_SETS`; new IDs appended to `SCHEMA_IDS`; one export block appended at the end of `src/index.ts`, `src/validate.ts` (`validateSnapshotData`, `validateSnapshotRequest`) and `src/fixtures/index.ts` (a Snapshot data fixture and a `snapshot` result). Schemas compile on first use; the package stays `"sideEffects": false`.

*Alternative:* the data block as a new board-protocol message. Rejected: AD-7 gives the Snapshot data block its own set and owner, and a Snapshot outlives the protocol version that wrote it.

### 3. `ask-core`: one command, one gathering, one port

- **The port.** `SnapshotWriter.write(data) → Promise<{path}>`, rejecting with `SnapshotWriteError` (`folder`, `code`, a message naming no agent content), declared in `ports.ts` beside E1's and appended to `CorePorts`. `snapshot` implements it; the entry point wires it (decision 6).
- **The command.** `snapshot(askId, request)`, where `request` is `{takenBy: "agent", caller?: Binding}` or `{takenBy: "user", unsentWork: boolean}`. In order: an ask unknown to the epoch, or discarded, is `{outcome: "discarded"}`; for the agent's request, E4's `refusal(askId, caller)` gives `{outcome: "refused", why}`, as for `fetch`; otherwise the data is gathered synchronously, so no event, document or state change can fall inside it, then handed to the writer, giving `{outcome: "saved", path, state, unchecked}` or `{outcome: "write-failed", folder, code}`. The board's request carries no binding: the board token is its authority (AD-11), as for every board command.
- **The gathering** is a pure function over the aggregate in `packages/core/src/snapshot/`, with the time from E3's `Clock` and `who` from the same rule as answers (FR-19). It reads the current board document; the revisions E3 keeps, other than the current; the board state through the function `board-host`'s `state` message uses; the origin through E4's builder; the log through the function `collect` reads it with, every entry from `seq` 1 with its cursor, unpaged; the full values widget-answers keeps per answer; the molecules' expansion map. It reads no draft record, no `BoardAddress` link, no agent record and no agent status.
- **Nothing changes.** No event, no publication on the subscription, no `received` move, no state change. A board's `unsentWork` is copied from the request, never derived from the draft record (E3's draft-record requirement: only the restore path reads it).

*Alternative:* `board-host` gathering for the board and `mcp-tools` for the agent. Rejected: two gatherings could disagree on what a Snapshot holds, and the owner check would sit in an adapter.

### 4. `assemble` builds both outputs

- **One function**, as AD-9 says: `assemble(data: BootData | SnapshotData, manifest, sources)`. Data that carries `snapshot` is a Snapshot. `sources` keeps E1's chunk texts by SHA-256 and adds `licences`, the notice texts by their manifest path, required for a Snapshot.
- **Order** (open question A3): charset; the view policy meta tag; the data block (`<` escaped, as E1 does); the styles; `#root`; the scripts; for a Snapshot, the `askboard-licences` block. The board's srcdoc is unchanged apart from the host-only chunks now selected as roots.
- **Selection** gains a mode: for a board, every `hostOnly` chunk is a root; for a Snapshot, none is, and a selected chunk that needs a host-only chunk is an error naming both (the build check of decision 5 prevents it).
- **Kept renders** (open question B3): for each component whose chunk names a `keptRender` chunk, a Snapshot whose `renders` cover every item of that component selects the kept-render chunk instead, and one that misses any selects both. Selection reads `renders` only for this; the kept-render chunk's own rendering is the Diagram epic's. Unit tests use a fixture manifest with `probe-diagram` and `probe-diagram-svg` chunks.
- **Licence notices** (open question B4): the notices of the selected chunks, one per package and version, sorted, each `{package, version, licence, text}`; the texts come from `sources.licences`, and a missing one is an error.
- **Purity:** no DOM, Node or Bun API, so the same code runs on the board page and in the session process; the server's typecheck compiles it with Node's types only.

*Alternative:* a separate `assembleSnapshot`. Rejected: AD-9 names one function, so that the board and its Snapshot cannot drift.

### 5. The view build: ext-apps only with a host

- `tools/build/chunks.ts` marks the `ext-apps` chunk `hostOnly`. The shell stops importing `App` at load: `connectToBoardPage` takes it from the shared-module registry (`shared("@modelcontextprotocol/ext-apps")`) only when `window.parent !== window`, with only a type import of `App`. The build's shared-module plugin records no need for a lookup it does not see, and a build check fails when a non-host-only chunk needs a host-only one.
- `packages/view/chunk-sizes.json` is re-recorded in the change that moves the import, saying why.

*Alternative:* a channel chunk kind holding the shell's connection code. Rejected: a new chunk kind changes the manifest more and splits the shell's boot.

### 6. The `snapshot` unit

- **Factory:** `createSnapshotWriter({projectRoot, viewBuild, randomness, report, fs?})` returns the `SnapshotWriter`. `viewBuild` is a port the unit declares, `{load(): Promise<{manifest, sources, folder}>}`; the entry point implements it over the build `board-host` loaded (open question B12), and the unit reads each notice text from `folder` by its manifest path, whose pattern admits no dot segment.
- **Folder** (open questions A5, A6): `<projectRoot>/.askboard/snapshots`, the project root being the real path of `CLAUDE_PROJECT_DIR`, else the working folder, resolved once. It creates `.askboard/` and `snapshots/` when missing, then `.askboard/.gitignore` with exclusive create (an existing file is left alone). It resolves the folder's real path and refuses one outside the project root's, with the code `outside-project`.
- **Name and write** (open questions A4, B10): the HTML is assembled first; the name is `<askId>-<takenAt in YYYYMMDDTHHMMSSZ>-<6 random characters>.html`; the bytes go to `.<name>.partial` with exclusive create and `fsync`, then `link` to the final name; `EEXIST` draws a new suffix, up to five names; `EPERM`, `ENOTSUP` or `EXDEV` from `link` falls back to an exclusive create of the final name; the partial file is always removed. The path returned is the folder's real path joined with the name.
- **Failures** reject with `SnapshotWriteError` naming the folder and the error code, and one stderr diagnostic that names the folder and the code only.
- **Platforms:** `node:fs/promises` only, so it runs the same on Bun and Node 24, macOS and Linux, devcontainer bind mounts included; the fallback covers a file system without hard links.

*Alternative:* `rename` from the partial file. Rejected: `rename` replaces an existing name, which AD-15 forbids.

### 7. `mcp-tools`: the `snapshot` tool in its own appended block

- `mcp-tools/snapshot.ts` holds the handler; `HANDLERS` gains one entry after E3's `fetch`, and the unknown-tool error names the five tools.
- Steps: validate the request with the contract (`askId` only, so a `path` is an error naming it); bind the call (`{toolUseId?, tool: "snapshot", askIds: [askId]}`) as `fetch` does; call `ask-core`'s `snapshot`; map `saved` to the result, `discarded` to the typed result, `refused` to E4's `isError` text for that refusal, `write-failed` to `isError` text naming the folder and the code.
- The server instructions stay the approved text, which names no `snapshot`; the skills epic teaches agents to read the data block.

### 8. `board-host` and the board page

- **Host:** one case appended to the page-message dispatch in `boards.ts`: `snapshot` on the ask's live socket calls `ask-core`'s `snapshot` with `{takenBy: "user", unsentWork}` and answers `snapshot-saved` or `snapshot-failed`. A closed ask is accepted (it refuses only acts); a socket that is not the live one is ignored, as E3 ignores its drafts.
- **Board page:** one `takeSnapshot()` serves the view's `snapshot` message and the Closed banner's action. It sends `snapshot` with a fresh `requestId` (E3's action-ID generator) and `unsentWork` from E3's `unsent-work.ts`, tracks the request until its reply, never queues it in the outbox and never resends it; a drop fails it at once, naming the folder only if a `snapshot-failed` said one (open question B9). The reply goes to the view as a `snapshot` field of the view update, for the bar's feedback, or to the banner.
- **Validators:** the two host messages join the board page's standalone validators (`tools/build/validators.ts`).

### 9. The view: the control and the Snapshot view

- **The control:** "Snapshot" as a secondary button in `bottom-bar.tsx`, on every board including the single-question one, beside "Select recommended"; disabled while the connection is lost, hidden once discarded. Its feedback, beside it: the unsent-work note first when the request said so, then the path in code type, or the failure with the folder.
- **The Snapshot view:** the shell's boot reads `snapshot` from the data and, with no parent, renders in Snapshot mode, a shell-context flag, not a port field (open question B8):
  - the top line above the header, its time formatted in the viewer's time zone for the ask's locale, and the unsent-work words when recorded (open questions B5, B6);
  - `document.title` set by the shell to "Snapshot · <ask title>" through the DOM, never through markup;
  - no Answer, Postpone, More, "Ask a follow-up", Settings, density switch, bottom action bar or agent pill; the ask state pill, the counts, navigators, tabs, threads and receipts stay;
  - every question card read-only: items get `disabled: true`; Choice, the open prompt and the note show E3's previous-answer look; postponed and declined questions keep their markers;
  - the origin from the data feeds E4's header row 1, as the `origin` message does on a board;
  - the Theme control (open question B11): System, Light, Dark, setting the `.dark` class only.
- **Nothing to send:** with no parent the shell keeps `NO_CHANNEL`, and in Snapshot mode no component offers an act, so nothing could be sent even if a host existed.

### 10. Tests

- **Unit** (`bun test`, 80% per file, tests first): the contract's schema, validators, fixtures and appended registrations; the gathering as a table over E3's fixtures (areas, postponed, decline, recorded, revised on an older `rev`, thread with reply, closed), with no draft, link, token or status in any output and no event or `received` change; the command's outcomes with a fake writer; `assemble`'s Snapshot (order, escaping a hostile title, host-only selection, the probe kept-render cases, notices, determinism); the build's host-only check; the unit's folder, `.gitignore`, symbolic link out of the project, name, collision, link fallback and failure clean-up in temporary folders with an injectable file system; the handler against a fake core; `board-host` against recorded transcripts; the board page's request tracking.
- **Browser** (Chromium, Firefox and WebKit, no CSP violation from the view, the board page or the console): the control on a board, its feedback and the unsent-work note; the Closed banner's action; no control on a discarded board; an opened Snapshot from `file://`, with the browser context offline and the session process stopped, recording every request (none allowed), switching tabs and themes, jumping to a postponed question, and finding no enabled answer control; a script file beside the Snapshot never running.
- **End to end** (session-process target, decision 11 of E1): an agent asks, the user answers on the real board page, the agent calls `snapshot` and gets a path under the test project's `.askboard/snapshots/`, the session process exits, and the file opens offline in each engine; its data block, cut out by the text rule, validates against `snapshot-data`.
- **Conformance** (Bun and Node 24, in AD-1's configurations as E4 leaves them): the five-tool listing, a path, the `.gitignore`, two Snapshots with two names, `discarded` after a discard and after a restart, the owner refusal with hooks, `unchecked` without hooks.

## Risks / Trade-offs

- [E3 or E4 lands with names other than decision 1's] → Group 0 checks each and stops for `/opsx:update`; nothing is built on an unmerged branch.
- [A Snapshot opened from `file://` runs AskBoard's script outside the sandboxed iframe] → The view policy rides along as a meta tag (`connect-src`, `frame-src`, `form-action`, `base-uri` `'none'`, scripts by hash); no view code creates a script element with a URL (AD-8); the browser tests record every request and include Firefox's file-script control.
- [A shared Snapshot carries project content off the machine] → By the user's choice (SOLUTION-DESIGN §6, residual risks); the file holds only what the board showed, and no token.
- [Large Snapshots: a diagram without a kept render inlines its renderer (PlantUML's chunk is 3.4 MB)] → No diagram renders on boards before the Diagram epic, which brings the kept renders; size is not bounded otherwise (FR-27 sets none).
- [Assembling a big board blocks the session process's event loop] → `assemble` is linear in the output; the end-to-end run times the golden board's Snapshot; requests are rare and user-driven.
- [The shell's lazy ext-apps breaks a board's handshake] → E1's and E3's browser suites run on every view task, and the build check fails on a static need.
- [Two branches append to the same contract and server files] → Appended blocks only; a conflict between appended blocks keeps every line of each (Merge points).
- [Hard links refused by a mount] → The exclusive-create fallback keeps "never overwrite"; only the partial-file guarantee is lost there.

## Migration Plan

New files and appended entries only; no stored data changes shape. Rollback reverts the change; Snapshots already written stay in the project, as FR-27 wants.

## Merge points

What the integration of E7 with E3, E4, tree-widget, widget-answers and molecules brings together:

- **Contract:** `sets.ts` (`snapshotDataSet` appended), `SCHEMA_IDS`, `BOARD_PROTOCOL_MESSAGES`, `tool-envelopes/tools.json` and `index.ts` (the fifth tool), `view-manifest.json`, `constants.ts`; the three appended export blocks (a conflict between appended blocks keeps every line of each).
- **Core:** `ports.ts` (`SnapshotWriter`, `SnapshotWriteError`, the `CorePorts` field appended), `core.ts` (the `snapshot` command appended), the new `snapshot/` folder.
- **Server:** the `snapshot` tool in its own appended block: one entry appended to `HANDLERS` in `mcp-tools/tools.ts` after E3's `fetch`, its handler alone in the new `mcp-tools/snapshot.ts`, and `server.ts`'s unknown-tool error naming five tools; E3's and E4's own additions to the tool list and the instructions stay as they land; `board-host/boards.ts` and `messages.ts` (one appended case); `session-process.ts` and `main.ts` (the writer's wiring); `packages/server/package.json` (`@askboard/view`).
- **View:** `assemble/index.ts`, `assemble/select.ts`, `boot-data.ts`, `shell/index.tsx`, `shell/channel.ts`, `shell/bottom-bar.tsx`, `shell/board.tsx`, `shell/board-header.tsx`, `shell/question-card.tsx`, `view-protocol.ts`, `board-page/controller.ts`, `board-page/host-messages.ts`, `board-page/board-status.ts`; `tools/build/chunks.ts`, `manifest.ts`, `validators.ts`; `packages/view/chunk-sizes.json`, re-recorded after a merge.

## Handed on

- **The Diagram epic:** the view's render message, `board-host`'s store of the latest render per item and revision, an `ask-core` port through which the gathering reads them into `renders`, the `diagram-svg` chunk named in `keptRender`, and the browser test of a kept render in an opened Snapshot.
- **E5:** a FILE reference in a Snapshot shows its path and anchor as text, "not available in a Snapshot"; a web reference opens only on a click, as a link with `noopener` and `noreferrer`, since a Snapshot has no board page.
- **E8:** `snapshotFolder`, the replacement of a folder outside the project with a warning, the settings row with its file and key, AD-14's first-ask folders, the quick toggles (the Snapshot's Theme control then reuses them, saving nothing), it-IT strings.
- **The widget epics:** each widget's Snapshot look (the lone chosen decision, a Switch as "on" or "off", change highlights), with a port flag if `disabled` is not enough.
- **widget-answers and molecules,** if they land after E7: filling `events[].values` from the stored full values, and `molecules` from the expansion map, in the gathering.
- **The skills epic:** teaching agents to find the `askboard-data` block, to read it as JSON, and that `<` is written `<` inside it.

## Open Questions

The proposal's open questions A1 to A7 and B1 to B12 each carry the default this design follows; none is left open here.
