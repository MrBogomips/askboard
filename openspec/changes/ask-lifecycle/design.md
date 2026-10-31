# Design

## Context

See proposal.md for why E3 comes now and what it leaves out. What the code starts from:

- **E1 as built** (integration head `4913f52`, final checks `1e2c855`): six schema sets at `1.0` in `packages/contract/src/schemas/`, with `validateAskRequest` reading only `items[0]`, `discarded` admitting only `session-exit` and the ask state only `waiting`, `answered` and `discarded`. `ask-core`'s `AskCore` holds `Ask` aggregates in a map; an `Ask` has one frozen rev-1 document, a log of `{seq, event}`, `received`, and refuses a second answer to an answered question. Its ports are `BoardAddress`, `BoardShowing`, `Identity`, `Randomness` and `Report`; there is no clock. `board-host`'s `Boards` takes over and closes sockets but reports nothing to the core ("closing a board discards nothing"). The view renders one question card per item through `CatalogRenderer`, keeps a draft store that is not mirrored, and the board page queues answers across drops. The approved `tools.json` and `server-instructions.md` sit in the fixtures whole; E1 lists two tools and cuts five lines from the instructions.
- **The tree-widget change's view seams**, as its design decision 7 defines them at `383d0a3` on `worktree-feature-tree-widget`: the draft record, the port `ItemProps`, the view document's widget items, `ViewAnswer.values`, and the board page's refusal of widget answers until the widget follow-up. E3 takes them as given and does not restate them; their final API is the one that lands. The gantt-widget change builds on the same seams.
- **The `push-delivery` change (E4)**, at `0fc6897`: it defines the closed event with reason `agent-finished`, enforces owner checks on `update` and `fetch`, owns FR-24's who-and-where row and the agent pill, and adds the standalone board-protocol message `presence`.
- **No roadmap document.** E1's proposal line 17 and the spine define the epic; the four places where E1 hands work to E3 are its open questions 2, 3 and 5 and its design's Handed on (a client action ID; the grace timer, at least 90 s).

ADs this design relies on: AD-1, AD-2, AD-3, AD-4, AD-5, AD-6, AD-7, AD-8, AD-9, AD-10, AD-11, AD-12, AD-14, AD-20, AD-21. UX sections it implements: EXPERIENCE Information Architecture (Board anatomy, Presentations); Voice and Tone (the strings of the components below); Component Patterns (Board chrome: State pill, Next-open jump, Outline navigator, Question navigator, Area, Bottom action bar, Select recommended, Delivery mode switch, Submit; Question card: all rows; Changes, values and board states: Agent-change notice, Reopened question, Board banner, Mode-switch confirmation, Invalid-link page); State Patterns (Ask states, Counting, By surface for the board and the question, What a reload keeps); Interaction Primitives (Explicit acts, Delivery, Revisions, Close and reload); Accessibility Floor (Keyboard core, Shortcuts, Focus). DESIGN.md: Components, Board chrome, Question card, and Changes, values and board states, under the same names.

## Goals / Non-Goals

**Goals:**

- Every lifecycle path of the PRD's asking half works by pull alone, through `ask`, `update`, `collect` and `fetch` (AD-4).
- One writer and one log hold: every user act, every agent change and every discard goes through `ask-core`, and nothing reaches the agent that the user did not send (AD-3, AD-10).
- E3 widens E1's seams instead of adding parallel ones: the same sets at new minors, the same aggregate, the tree-widget change's draft record and view document.

**Non-Goals:**

- Ownership and agent records: every result stays `unchecked` until E4 binds owners (AD-5).
- Widget values on the wire: the answer act and the draft record leave room for them (decision 2), and the widget follow-up carries them.
- A heartbeat: liveness stays the WebSocket's close (SOLUTION-DESIGN §8, F33).

## Decisions

### 1. E3 builds on E1's head and on the tree-widget seams

The worktree starts at E1's integration head. Before any view task, it takes the code commits of the tree-widget change's groups 1 and 2 (the widget-neutral seams), not their `docs(tree-widget)` tick commits, as the gantt-widget change does; once those reach `main`, a rebase on `main` replaces the picks. E3 then uses the seams as they land, adds beside them only what the lifecycle needs (decision 6), and defines no second draft, port or view document. If E1 or tree-widget gain commits after this proposal, task 0.2 reads their latest state first.

*Alternative:* E3's own draft store. Rejected: two drafts for one question could disagree on what is unsent, and the team asked for one seam.

### 2. Contract: next minors of E1's sets, met with the widget follow-up at merge

- **What changes, and where.** Every new schema joins the set it extends (`input`, `output`, `tool-envelopes`, `board-document`, `board-protocol`), with an `$id` `urn:askboard:<set>:<name>` like E1's, listed in `sets.ts` and `SCHEMA_IDS`. Nothing is standalone, since nothing is outside E1's sets. New exports go in one block appended at the end of `src/index.ts`, `src/validate.ts` and `src/fixtures/index.ts`; the package stays `"sideEffects": false`, and schemas compile on first use, as E1's do.
- **Versions.** Each set E3 touches takes its next minor and only adds optional fields or enum values, so a receiver still on `1.0` refuses the new ones as schema errors (E1's rule).
- **How E3 meets the widget follow-up.** Tree and Gantt plan "the follow-up that takes the input format to 1.1" for the input format, the board document and the board protocol, and E3 needs the same three sets. The minor is a label assigned at merge: whichever change reaches `main` first takes `1.1` for each set it touches, and the other, on its rebase, takes the next minor, `1.2`, for the sets both touch. They widen different parts: E3 the ask (several questions, areas, FR-3's fields, the lifecycle messages), the follow-up a question's `items` and the answer's widget values, so the second to merge rebases its schema edits onto the first's without changing what either means. The two shared shapes are built for each other: E3's `answer` act has its content fields optional with "at least one" checked by the core, so the follow-up adds `values` and `derived` beside them without restructuring; and the draft record carries each item's value as an opaque JSON value from the start, so a Tree's draft survives a reload as soon as the Tree reaches the board. If the two land together, the integration session may give them one `1.1`.
- **Shapes, briefly** (the contract spec holds the rules):
  - Question props gain `allowOther`; an option gains `preview`, `annotation` and `recommended`. An area is `{type: "area", id, props: {title, items}}` (proposal, open question 2).
  - Events: `answer` gains `other`, `optionNotes` (label to note), `declined`, `replaces` (a cursor); new `postponed` and `reopened` (`itemId`, `rev`), `note` and `follow-up` (`itemId`, `rev`, `who`, `when`, and `note` or `text`), `edit-choice` (`itemId`, `rev`, `edit`, `keptRev`). `postponed` keeps the approved example's shape exactly.
  - `update`'s result is `{versions, epoch, askId, state, applied: [{action, itemId?, rev?, recorded?}], unchecked}`; `fetch`'s is `{versions, epoch, askId, state, item: {type, id, rev, props, state?, answer?, previous?}, unchecked}`, or a page `{…, itemId, part, continuation?}`; typed results `closed` and `discarded` name the ask.
  - Board protocol, page to host: `connect`, E1's `answer` (kept for `1.0` pages), `act {actionId, acts}` and `draft {record}`. Host to page: `board`, `state` (per question its `rev`, state, current answer with receipt and whether recorded, previous answer, thread), `receipt`, `done {actionId}`, `refused` (now naming `actionId` and the act's index), `draft {record}`, `closed {reason}`, `discarded {reason}`, `moved`.
  - Closing: `closed` joins the ask state of results, the board state and `collect`'s ask entry. The board protocol's `closed` message carries `reason` as an enum holding `agent`, which E4 extends with `agent-finished` in a minor. The output format gets no closed event from E3: E4 defines it (decision 8).
  - The draft record: `{delivery, inView?, questions: {<id>: {rev, values?, other?, optionNotes?, note?, composer?, held?: {act, order, byRecommended?}}}}`, keys checked as own properties.
- **Constants** (values E3 chooses): grace period 120 s (open question 4); takeover flush wait 1 s; note, "Other…" text, follow-up and reply 10,000 characters each; option note and annotation 2,000; preview 10,000; draft record 2,000,000 characters of JSON, above anything the per-field limits admit for a board; `fetch` page 24,000 characters of value text, so a page's envelope stays under 30,000.
- **Instructions and tools.** `TOOL_DEFINITIONS` becomes the approved `ask`, `update`, `collect` and `fetch`; `SERVER_INSTRUCTIONS` the approved text, uncut. E1's tests that assert the cut flip to assert equality.
- **One fixture changes.** E1's `schemaRefusalTranscript` uses `{type: "draft"}` as a message the protocol does not define; E3 defines `draft`, so the transcript's example becomes `{type: "telemetry"}`, with that reason in the commit.

*Alternative:* standalone E3 schemas joined later, as tree-widget does. Rejected: E3 changes the messages E1's sets already define (the ask, the answer event, the board document), so a standalone copy would be a second definition of the same message.

### 3. `ask-core`: one aggregate, states derived, acts applied once and atomically

- **Model.** `Ask` gains: the questions and areas in board order, each question with its current `rev`, the props of every revision an event names (AD-20), a recorded answer if any, a previous answer after a reopen, and its thread of follow-ups and replies; the IDs of deleted items; the applied action IDs; the draft record; the live-connection count and the grace timer; `closed` with its reason. It changes only through its methods: `act`, `update`, `close`, `holdDraft`, `connected`, `disconnected`, `discard`.
- **States are derived, not stored.** A pure function over the questions, the log and the recorded answers gives each question's state and the ask's (the core spec's two state requirements), tested as a table that includes every back transition of the spine's lifecycle diagram. `closed` and `discarded` are the only stored states.
- **Acts.** `act(command)` checks each act against the state the earlier acts leave, on a copy, then appends every event in one step with consecutive `seq`s and publishes them together, so a waiting `collect` sees the whole submit. The action ID is recorded in the same step; a repeat returns the earlier outcome. A command without one is E1's `answer` and keeps E1's duplicate refusal.
- **Revisions.** Every question keeps `revs: Map<rev, props>`, pruned to the current revision plus those an event or a kept `ignore` names. An answer naming an older `rev` is accepted only while the latest `edit-choice` of the current `rev` is an `ignore` keeping it; its content is checked against that revision. A reopen moves the latest answer to `previous` and starts a new `rev`.
- **Agent changes** follow the core spec: in order and atomic, on a copy; `add` places an item as the generic diff places an element since E1's `ee10f3e`, with `parentId` omitted at the top level and `after` omitted for the first position, never `null`; `change` merges props key by key and re-validates the merged question with the contract; a postponed question stays postponed through a change (its postpone named the older `rev`); deleted IDs are never reused.
- **Recorded answers** (open question 3) live on the question, `{content, who, when, recorded: true}`, with no event. The board's state shows them; a later board answer to that question is an ordinary answer event with no `replaces`.
- **Closing** is `close(reason)`. E3 passes only `agent`, from `update`, and appends no event, since the agent's own change is reported in its result (AD-3). E4's `SubagentStop` guard calls the same method with `agent-finished` and appends its own closed event (decision 8).
- **Clock port.** E3 adds `Clock` (`now()` and `after(ms, fn)` returning a cancel function) beside E1's ports, implemented in the server entry with `Date` and `setTimeout`, so `ask-core` stays runtime-neutral (AD-1).
- **Grace timer and tombstone** as the core spec says. On discard the aggregate drops everything but the tombstone fields; a `read` on a discarded ask drops the events at or below its `after`.
- **Subscription** gains `document` (board document changed), `state` (a recorded answer, a reopen or a delete that changed states without an event), `closed`, and keeps `appended`, `received`, `discarded`.

*Alternative:* a submit as several appends under a lock. Rejected: `collect` could page between them, which AD-20 forbids.

### 4. `mcp-tools`: two more handlers and wider `collect`

- `update` and `fetch` handlers beside `ask` and `collect` in `HANDLERS`, each validating its request with the contract, then calling the core. Typed `closed` and `discarded` results are not errors (AD-6); an unknown ask is `discarded` (AD-10).
- **`fetch` pages** (open question 5): the item's value is serialized with `ask-core`'s existing RFC 8785 function, and sliced at code-point boundaries into pages of the contract's page size. The continuation is base64url of `{itemId, rev, generation, offset}`, where `generation` is a counter `ask-core` raises whenever the item or its answer changes; a continuation whose generation is not current is refused.
- **`collect`** reports the new states and events; its pager treats one command's events as one unit (an internal group number on each log entry, never on the wire); `wait` accepts only a question's ID, and an item inside a question is an error naming that question; it returns at once on a postponed question or a closed ask, with the outcome `postponed` or `closed`, and on a discarded ask, whose state says so. `agent-waiting` presence stays with E4.
- Every `update` and `fetch` result carries `unchecked: true`, as `collect`'s do (AD-5).

### 5. `board-host`: protocol 1.1, connection reports, takeover flush

- `Boards` answers `act` with `done` or `refused` plus `state`, passes `draft` to the core, and sends `board`, `state` and then `draft` (when held) on connect. The new page messages enter the dispatch as appended cases, after E1's, by the pattern of decision 8.
- It reports `connected` when an ask gains a live board and `disconnected` when it loses it; a takeover only moves the live board between sockets, so it reports neither, and `ask-core`'s count of live boards never stays above zero after one.
- **Takeover.** It sends `moved` to the old socket and accepts that socket's `draft` for the contract's flush wait, then closes it with 4409 and sends the held record to the new tab. A draft from any other non-live socket is ignored.
- **Closed asks.** The board link serves the page; the socket is accepted; every act is refused with reason `closed`. Discarded asks keep E1's behaviour, now also after a grace discard (410 page, 4410 close).

### 6. View: chrome around the catalog, one draft, the board page owns action IDs

- **Where things render** (EXPERIENCE, Board page or view): the header's second row, the outline and question navigators, areas, question cards, threads, notices and the bottom action bar render in the view; banners, the leave-page prompt and the clipboard copy on the board page.
- **Choice** grows the "Other…" row, the Recommended badge, previews as plain text, the agent's annotation and the user's option notes; the question card adds the open prompt, "Accept recommended", Postpone, "More" (Radix Dropdown Menu, keyboard operable) with Explain and Decline, the thread, and the notices. Previews, annotations and replies render with `textContent` only (AD-8).
- **The header.** E3 builds the ask-state pill (ask states, the partly-answered count, the postponed and declined counts), the open count, the next-open jump, the unread-reply count and the agent-change flag. FR-24's who-and-where row and the agent pill come from E4: the pill shows E4's `presence`, and the row the agent identity from E4's hooks and agent records. Until then the header shows the title in their place.
- **Widget answers stay refused.** The board page's refusal of widget answers (the seam) holds until the widget follow-up, and E3's `act` path applies it to every act that would carry a widget value.
- **The draft.** The seam's draft record stays the store of item values, as it lands. Beside it, a `BoardDraft` in `shell/` holds what EXPERIENCE's "What a reload keeps" lists that E3 has: per question the `rev` the work was made on, "Other…" text, option notes, open-prompt text, composer text and the held act with its order and whether "Select recommended" made it; for the board the delivery mode and the question in view. The view sends the combined record to the board page as a view message after each change; the board page debounces it by 300 ms, flushes it on `pagehide` and when the page is hidden, sends it as `draft`, keeps the last copy for "Copy my unsent work" and the leave-page prompt, and hands a restored record back to the view in its state notification.
- **Acts.** The view sends acts as view messages; the board page turns them into `act` commands, giving each a fresh action ID from `crypto.getRandomValues`, keeps them in its outbox until `done` or `refused`, and resends them with the same ID after a reconnect. Submit is one view message and one command.
- **Agent changes.** When a new board document arrives, the view compares each question's `rev` with the `rev` its draft work was made on: no work, or the same `rev`, renders the new revision in place; older work raises the agent-change notice, whose "Show the agent's change" diff is the props' text fields and options, marked. "Keep mine" sends `ignore` with the work's `rev`, and the answer then names that `rev`.
- **Mode-switch confirmation** is Radix Alert Dialog, modal, with the view's style-element shim that the renderer spike settled for S-6, so its scroll lock runs under the view's CSP.
- **Readiness** stays per question (AD-9): hidden tabs and hidden questions in one question per view stay mounted.

### 7. Tests

- **Unit** (`bun test`, 80% or more): the contract's new schemas, checks and fixtures; the state table; acts, atomicity, action IDs, revisions, edit choice, agent changes, recorded answers, replies, close, draft, grace timer with a fake `Clock`, tombstone; `update`, `fetch` (pages, generation) and `collect` (paging units, wait outcomes) against a fake core; `board-host` against new recorded transcripts (submit, takeover with flush, draft restore, closed ask, grace discard).
- **Grace discard without a real 120 s wait.** The timer's expiry is tested with a fake `Clock` in `ask-core`, and end to end in `session-process.test.ts`, which composes the real units with an injected clock. The shipped bundle has no override.
- **Conformance** (Bun and Node 24, the real board page): an ask with areas, answered, postponed, declined, undone, revised and submitted; `update` with every action; `fetch` with pages; `collect` paging around a submit and waiting through a follow-up; a reload and a takeover that keep the draft; a closed ask's link.
- **Browser** (Chromium, Firefox and WebKit, no CSP violation): the three presentations and the single-question board, navigators and counts, every question-card control, delivery modes with the confirmation dialog, revisions, the agent-change notice both ways, the reopened question, threads and unread replies, draft restore on reload and takeover, the leave-page prompt armed, Closed and Discarded banners with "Copy my unsent work", and the keyboard core.

### 8. The split with E4, and how a board-protocol message is added

The split agreed with `push-delivery` (E4, `0fc6897`):

- **E3 provides:** the `closed` ask state, `close(reason)` in `ask-core` (E3 itself uses only `agent`), and the Closed banner, with the locked board a closed ask's link opens.
- **E4 defines:** the closed event `urn:askboard:output:closed-event` with reason `agent-finished`. After E3's output-format minor merges, E4 adds it to `collect`'s event union.
- **E4 enforces:** owner checks on E3's `update` and `fetch`; until then every result says `unchecked: true`.
- **E4 owns** FR-24's who-and-where row and the agent pill (decision 6).

A new board-protocol message type is added in four appended steps, which E3 follows and E4's `presence` can follow too:

1. **Schema.** A file in `packages/contract/src/schemas/board-protocol/` with the `$id` `urn:askboard:board-protocol:<name>`. A message that joins the set has its name appended at the end of its direction's list in `BOARD_PROTOCOL_MESSAGES` and of `SCHEMA_IDS`. A standalone message, as E4's `presence` is, stays outside the set until its change joins it.
2. **Validation.** `validateBoardMessage(direction, value)` stays the set's one entry point. E3 changes neither its signature nor the order of E1's entries, so a standalone message checked ahead of it keeps working unchanged.
3. **Dispatch.** In `board-host`, one case is appended to the page-message dispatch in `boards.ts`, after E1's `connect` and `answer`. In the board page, one validator is appended to the host-message validators and one case to the controller's handler, after E1's. Nothing existing is reordered.
4. **Transcript.** The exchange is recorded in `packages/contract/src/fixtures/transcript.ts` and appended to `transcripts`.

Two changes that add messages then merge by keeping both sides' appended entries.

## Risks / Trade-offs

- [E3 and E4 both add board-protocol messages and dispatch cases] → Decision 8's appended steps; neither change reorders E1's entries, and a merge keeps both sides' appended lines.
- [The view files E3 extends are the ones tree-widget and gantt-widget edit] → Decision 1 takes their seams first; E3's edits to shared files are additive and listed in tasks.md, Merge points; E1's and the seams' browser suites run in every view task.
- [The contract's minors collide with the widget follow-up] → Decision 2's merge-order rule; neither change reads the other's version number, only its own.
- [The whole board document is re-sent on every agent change] → Fine at E3's sizes (no widgets on the wire); the widget epics may send one question's revision instead, as a minor of the board protocol.
- [Radix Alert Dialog under the view's CSP] → The renderer spike settled S-6 with the style-element shim; the browser test asserts no CSP violation in each engine. Fallback: an inline, non-modal confirmation in the bottom action bar, and the PO is told.
- [The clipboard in Firefox and WebKit under Playwright] → The browser test checks "Copy my unsent work" through the page's clipboard call where the engine grants it, and through the text the board page builds where it does not.
- [`beforeunload` shows the browser's own prompt, which tests cannot read] → Tests check that the handler is armed and disarmed, and Playwright's dialog event in Chromium.
- [A hidden tab's reconnect waits for Chrome's once-a-minute timers] → 120 s leaves one minute of margin over a throttled first retry; F33's 90 s floor holds.
- [A laptop asleep with the socket already closed] → The timer is measured on the session process's monotonic clock; a wake that lands past the grace period discards the ask, as a closed tab would, and the agent is told (FR-25).
- [Agents that cached E1's two-tool list] → None outside this repository: E1 is not released. The early benchmark's allowed-tools list and context count change (Handed on).

## Migration Plan

None: nothing has been released. Reverting the change returns the code to E1's behaviour, which E1's tests still check.

## Merge points

What the integration of E3 with E1, tree-widget and gantt-widget brings together:

- **Contract:** the five sets' folders and version constants, `sets.ts`, `SCHEMA_IDS`, `requests.ts`, `constants.ts` and `limits.ts`, the instruction and tool tests; the three appended export blocks (a conflict between appended blocks keeps every line of each).
- **View:** `view-protocol.ts`, `shell/draft-store.ts` (extended, never replaced), `shell/question-card.tsx`, `shell/question-state.ts`, `shell/answer-acts.ts`, `shell/board.tsx`, `shell/board-header.tsx`, `board-page/controller.ts`, `model.ts`, `outbox.ts` and `board-status.ts`, `catalog/choice/`; `packages/view/chunk-sizes.json`, re-recorded after a merge.
- **Server:** `board-host/boards.ts` and `messages.ts`, `mcp-tools/tools.ts`, `collect.ts`, `wait.ts`, the entry point's wiring (the `Clock`).

## Handed on

- **E4 (`push-delivery`), as decision 8 splits it:** the closed event `urn:askboard:output:closed-event` with reason `agent-finished`, added to `collect`'s event union after E3's output-format minor merges, and `close(reason)` called with that reason by its `SubagentStop` guard; owner checks on `update` and `fetch`; `presence` on the board protocol, AD-2's working-board rule and `agent-waiting`; FR-24's who-and-where row and the agent pill (proposal, open question 6); the pending-asks list, counted from E3's question states.
- **E7 (Snapshots):** the `snapshot` tool and files; they read the kept revisions, the log, recorded answers, previous answers and threads, which E3 keeps until discard and, for closed asks, until exit; "Your unsent work will not be in the Snapshot" reads the draft record's presence, never its content.
- **The widget follow-up:** `values` and `derived` on the `answer` act, the logged state of a widget answer, `changes` from `ask-core`, and the agent-change notice's diff for a widget's value; E3's draft mirror already carries the widget values.
- **E5:** context placement in the draft record, the context column and references.
- **E8:** the grace period as a configuration key; Italian strings.
- **Later UX:** the option filter for long lists (EXPERIENCE open item 8) and the key bindings (open item 21).
- **The early benchmark:** add `update` and `fetch` to its allowed tools and re-measure the context before the first ask (T); its scenarios S2 to S5 and S7 can run once E3 merges. Its board answerer's close after answering now starts a grace timer, which discards the ask 120 s later, after the answer has been collected.

## Open Questions

None beyond the proposal's, which record the narrowest choice taken for each.
