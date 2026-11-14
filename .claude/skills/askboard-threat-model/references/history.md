# AskBoard security and invariant findings: the catalogue

Every finding below was checked on 2026-11-06 against its record: the pull request's body, the
OpenSpec change's `tasks.md` notes and `design.md` Risks, or a review comment on the pull request.
Conventions:

- **ID** as the record names it; "no ID" when the record names none. IDs repeat across reviews
  (E4 had an M1 in two reviews), so an ID is always given with its PR and review.
- **Severity** as recorded (HIGH, medium, P2 and so on); "not recorded" when the record gives none.
- **Status** at `main` 3e08a274. `main` merges by squash, so branch commit SHAs are gone; fixes are
  named by commit subject, and the PR's squash commit holds them: #4 ad69eca1, #8 d34422dd,
  #9 a670addd, #10 92ca2034, #13 38ab08f3, #18 f08bceb3, #23 cfd77e09, #24 8af94968, #28 5004ee85,
  #31 666b171e, #32 a35a0b9b.
- Change records: `openspec/changes/<id>/` or, once archived, `openspec/changes/archive/<date>-<id>/`.
  E1 is `e1-walking-skeleton`, E3 `ask-lifecycle`, E4 `push-delivery`, E5 `excerpts`, E7 `snapshot`,
  E8 `settings-languages`; the Gantt is `gantt-widget`, the formula engine `compute-engine`, the
  benchmark `early-benchmark`.

## Token secrecy and credentials (NFR-4, AD-11, AD-8)

- **No ID: the token in the view's base URL** · #8, E1 · not recorded
  The view's `document.baseURI` held the link's `?t=` token in Chromium, Firefox and WebKit: a srcdoc
  document takes its base URL from the board page, whose link carries the token.
  Where: the board page's HTML (`tools/build/board-page.ts`) and `boardPagePolicy`
  (`packages/contract/src/hash.ts`). Found: the view review of tasks 8.1 to 8.5.
  Status: fixed in #8 with a static `<base href="/">` and `base-uri 'self'`; browser tests check the
  view's base URL, referrer and location on first load and after a reload (`expectNoTokenInView`,
  `packages/view/test/browser/harness/board-test.ts`); AD-8 amended.
- **No ID: a transport that logged every message** · #8, E1 · not recorded
  ext-apps' unused `PostMessageTransport` logged every message it sent to the console.
  Where: the view's bridge to the board page. Found: the same view review.
  Status: fixed in #8; it is no longer shipped, `packages/view/src/frame-transport.ts` stands in.
- **(5): tokens left in an interrupted benchmark's files** · #10, early benchmark · not recorded
  Ctrl-C reached neither `claude` (its own process group) nor the redaction of board tokens.
  Where: `packages/bench/src/` (`redact.ts`, the run). Found: independent review of
  `git diff 017370d..HEAD -- packages/bench` (`early-benchmark/tasks.md`, note of 2026-10-31).
  Status: fixed in #10: SIGINT and SIGTERM handled, each case folder redacted as soon as its run ends.

## Network surface and outbound traffic (NFR-3, NFR-9, AD-11)

- **No ID: an unparsable request target ended the process** · #8, E1 · not recorded ("no serious
  issue" in that review)
  A target `new URL` cannot parse, such as `/\[`, threw inside the listener's `upgrade` event, which
  would end the session process.
  Where: `packages/server/src/board-host/http.ts`, `listener.ts`. Found: review of groups 6 and 7
  (2026-10-30), an independent read of the security paths.
  Status: fixed in #8: such a target, or one holding a backslash, names no route (404 over HTTP and
  as an upgrade), the gate runs before parsing, the upgrade handler reports what it throws, the
  server gets an `error` listener, and a failed listen leaves no listener behind.
- **No ID: the benchmark answerer followed any link** · #10, early benchmark · not recorded
  The scripted board answerer would connect to a board link off the loopback interface.
  Where: `packages/bench/src/answerer/board.ts`. Found: the author's own pass after the review.
  Status: fixed in #10; it refuses a non-loopback link before connecting.

## Fail closed (NFR-10, AD-10, AD-20)

- **No ID: `schemaErrors` failed open** · #13, E3 · MEDIUM
  `schemaErrors` accepted a value whose only error was an `if` error.
  Where: `packages/contract/src/compiled.ts` (`errorsIn`). Found: independent review with three
  reviewers (contract and core, server, view). Status: fixed in #13 with a test; an `if` error is
  dropped only beside other errors.
- **No ID: an all-postponed ask** · #13, E3 · MEDIUM
  An ask whose questions are all postponed was not `partly-answered` (AD-10's rule counts only
  questions that are not postponed, so it read as `answered`; inferred from the rule).
  Where: `packages/core/src/lifecycle/`. Found: the same review. Status: fixed in #13.
- **No ID: fetch continuations** · #13, E3 · LOW
  A `fetch` continuation was not bound to its ask and epoch, so it could be resumed against another
  ask or epoch. Where: `packages/server/src/mcp-tools/fetch-pages.ts`. Found: the same review.
  Status: fixed in #13.
- **No ID: E1 core and tools review** · #8, E1 · not recorded ("no fail-closed breach found")
  An ask still being created when the session ends, or arriving after, was stored and opened; an
  answer command with a mistyped `choice`, `when` or `rev` threw instead of being refused.
  Where: `packages/core/src/`, `packages/server/src/mcp-tools/`. Found: review of groups 3 to 5
  (2026-10-30). Status: fixed in #8 (outcome `ending`, refusals); the same fixes made a throwing
  handler an error result with only its class on stderr, and the shutdown reach the exit even when
  the discard or a diagnostics write throws.
- **No ID: formulas that yielded a number on error** · #9, compute engine · not recorded
  A lazy `IF` let a cycle, a missing reference or a refused formula yield a number; a date result
  out of range was an error only when read, so its readers still computed.
  Where: `packages/compute/src/`. Found: one independent read of the diff plus a trace of every
  scenario to a test (`compute-engine/tasks.md` 6.2). Status: fixed in #9, each with a test.
- **M3 (Gantt cross-review)** · #18, Gantt · medium
  `derived` values could travel without the answer's `values`. Where:
  `packages/view/src/view-protocol.ts`, E3's answer checks. Found: cross-review at the integration
  onto E3. Status: fixed in #18: `derived` only beside `values` on the message and the act,
  `protocolAct` strips it, an act carrying both is refused, Submit keeps `withDerived`.
- **No ID (task 13.1): a delivery reported before it was carried** · #23, E4 · in the review's
  CRITICAL, HIGH or answer-risking MEDIUM set; exact grade not recorded
  An answer appended during a subagent's final reply was reported delivered although no request of
  that subagent carried it, so the receipt said "delivered" and the stop guard let the stop through.
  Where: `packages/mod/src/carried.ts`, `subagent-turns.ts`, `turns.ts`. Found: the independent
  review of 2026-11-01 (three reviewers over `ee10f3e..HEAD`). Status: fixed in #23; a report waits
  for a request that carries the append, and the events stay above `received` for the guard.
- **M1 (E4 integration review, task 14.7a)** · #23, E4 · M
  The mod's poll and the stop block cut between events, not between board commands, so part of a
  Submit could reach the agent. Where: `packages/server/src/board-host/local-api/stop-block.ts`, the
  poll, `core`'s overview. Found: read-only review of the integration at `98ace68`.
  Status: fixed in #23: cuts only between commands, a page's first command goes whole, a fit that
  cuts inside a command throws before `received` is raised.
- **P2: an update with a molecule reference throws** · #32, widget answers · P2
  An `update` that changes an existing question's `props.items` to hold a valid molecule reference
  stores the items unexpanded; the graph check then reaches the throw "reached the board document
  unexpanded" instead of a result. Where: `packages/core/src/context/board-props.ts:52`.
  Found: automated review comment on #32. Status: open; no commit after #32 touches the file; not
  reproduced here.

## Bounds and resource exhaustion (AD-2, AD-7, AD-13, NFR-2)

- **Finding 1: the pre-connect stall** · #13, E3 · HIGH
  A board socket that never sent its token could send about 6 MB, schema-checked before its type,
  which stalled the host for 37 s. Where: `packages/server/src/board-host/boards.ts`.
  Found: the independent review of E3. Status: fixed in #13: a first message that is not `connect`
  with the board's token is refused before any check (about 25 ms), and a socket may send about
  64 KiB before `connect` (`PRE_CONNECT_MAX_BYTES`). Deferred part: see "Deferred and accepted".
- **No ID: an unread socket buffer** · #8, E1 · not recorded
  A board socket whose peer sends without reading grew without bound (18.9 MB on Bun's `ws` after
  20,000 one-byte messages). Where: `boards.ts`. Found: review of groups 6 and 7.
  Status: fixed in #8: a socket holding more than `SEND_BUFFER_MAX_BYTES` unsent is ended.
- **Minor 5: a socket that never speaks** · #8, E1 · minor
  A socket that never sent its first message was never timed out (first kept as designed).
  Where: `boards.ts`. Found: Track B's read-only review of `board-host` at `0f40c73`.
  Status: fixed in #8: `CONNECT_TIMEOUT_MS` (5 s, close 4403), at most `WAITING_SOCKETS_MAX` (64)
  waiting sockets, one over the cap closed with 1013.
- **No ID: `collect` result size** · #8, E1 · not recorded
  `collect` accepted as many asks as the schema allowed. Where: `packages/server/src/mcp-tools/`,
  `COLLECT_ASKS_MAX` in `packages/contract/src/limits.ts`. Found: review of groups 3 to 5.
  Status: fixed in #8: at most 40 asks, so the largest result stays under 30,000 characters.
- **Finding 2: a loop past 2^53** · #18, Gantt · not recorded
  `addWorkingDays` never ended past 2^53, where a step no longer moved the day (reproduced as a hang
  killed after 20 s). Where: `packages/compute/src/dates.ts`. Found: the change's review at
  `25b0daf`. Status: fixed in #18 with a `RangeError` past the graph's last serial.
- **No ID (task 9.2): axis ticks at far dates** · #18, Gantt · not pinned (group 9 holds the
  review's MEDIUMs and the cross-review's fixes)
  From 2026-11-02 to 9999-12-31 the axis drew 2,912,138 day ticks in about 3.25 s, hanging the view.
  Where: `packages/widgets/src/gantt/model/scale.ts`. Found: the change's review.
  Status: fixed in #18: at most `MAX_TICKS` (2,000), counted by arithmetic, about 2 ms.
- **No ID: the plan molecule's dependencies** · #18, Gantt · not recorded
  The plan molecule's `dependencies` map had no `maxProperties`.
  Where: `packages/molecules/src/gantt-plan/gantt-plan.json`.
  Found: two reviewers at `7f22c3b`. Status: fixed in #18.
- **No ID: range expansion and numeric limits** · #9, compute engine · not recorded
  Ranges were expanded cell by cell (one 8 KB formula took 2.1 GB, now 3 ms and 15 MB); `ROUND`
  overflowed past the 15th digit; the nesting check measured unary signs differently from the
  parser's guard. Where: `packages/compute/src/`. Found: the review of task 6.2.
  Status: fixed in #9, each with a test.
- **No ID (task 13.4): held agent records** · #23, E4 · not recorded
  A call with a `tool_use_id` bound its record only within the record timeout (a slow permission
  prompt lost it), and unbound records were capped only by the table's own bound of 1,024.
  Where: `packages/server/src/board-host/local-api/records.ts`. Found: the review of 2026-11-01.
  Status: fixed in #23: such a call binds whatever the record's age; unbound records are held for
  `RECORD_HOLD_MS` (30 minutes), at most `RECORDS_HELD_MAX` (1,000), the oldest dropped first.
- **No ID (task 13.5): the stop block's size** · #23, E4 · not recorded
  The stop block was not bounded by the hook's response limit. Where: `local-api/stop-block.ts`.
  Found: the same review. Status: fixed in #23: events up to 1 MiB, open asks at most half of it.
- **(6): an unbounded wait in the benchmark** · #10, early benchmark · not recorded
  The scripted MCP client waited without bound on a server that never answered `initialize`.
  Where: `packages/bench/src/mcp/`. Found: the benchmark's independent review.
  Status: fixed in #10: killed after 30 s or on a refusal.

## Untrusted input: keys, agent JSON, formulas (NFR-5, AD-7, AD-13)

- **Finding 1: a task named `__proto__`** · #18, Gantt · medium
  A task with ID `__proto__` silently lost its predecessors and requested start: the maps were plain
  objects. Where: `packages/compute/src/board.ts`. Found: the change's review at `25b0daf`.
  Status: fixed in #18: maps built from entries, its malformed values refused; the model reads a plan
  entry under its own key only, so `__proto__`, `constructor` and `toString` are ordinary IDs.
- **Finding 6: caller-owned lists kept** · #18, Gantt · not recorded
  Predecessor lists were kept by reference, so a caller could change them after the call.
  Where: `packages/compute/src/board.ts`. Status: fixed in #18: copied and frozen.
- **No ID: message types read through the prototype** · #8, E1 · not recorded
  A message `type`, a chunk name in `needs` or a set name could be `constructor`, `__proto__`,
  `toString`, `hasOwnProperty` or `valueOf` and reach an inherited property.
  Where: `packages/contract/src/` (protocol, manifest, owner check). Found: review fixes of
  2026-10-30 (`e1-walking-skeleton/tasks.md`, task 2 note). Status: fixed in #8: read as own
  properties only, refused, not thrown; limits added for `token` (256), `detail` (1,000) and the
  title (256).
- **No ID: formula injection through a dependency ID** · #9, compute engine · not recorded
  A Gantt dependency was pasted into formula text unchecked: an ID such as `t1.ef]+100+[p.t1`
  changed the schedule silently. Numeric text such as `"1e400"` became Infinity.
  Where: `packages/compute/src/`. Found: the review of task 6.2. Status: fixed in #9.
- **P2: molecule IDs not checked against questions and areas** · #32, widget answers · P2
  When an added question holds a molecule reference, the collision check covers widget and reference
  IDs but not question and area IDs: a reference named like an existing question is accepted, and
  `fullValue` and `change` then reach the question, not the molecule.
  Where: `packages/core/src/lifecycle/widget-update.ts:96` (`widgetIdsOf`). Found: automated review
  comment on #32. Status: open; `widgetIdsOf` still collects widget items and references only.

## Regular expressions (ReDoS)

- **R1: quadratic Markdown section patterns** · #28, E5 · high
  The heading and fence patterns backtracked quadratically on a long run of blanks or backticks
  ending in U+2028, and the closing-run pattern on any long run of blanks: 0.23 s at 20,000
  characters, hours for a 4 MiB line, on the session process's event loop.
  Where: `packages/server/src/excerpts/anchor.ts`. Found: independent review of group 2.
  Status: fixed in #28 (`fix(excerpts): find Markdown sections in linear time`): `s` patterns, the
  closing run stripped by hand; five 100,000-character hostile lines finish within 200 ms.
- **Checked, no finding** · #31, E8: the `with-references` patterns' run time on a long input was in
  the scope of the security review (`settings-languages/tasks.md` 10.3), and none was reported.

## File system: session folder, project files, configuration (AD-5, AD-11, AD-12, AD-14)

- **R2: a folder swapped for a symlink before the open (TOCTOU)** · #28, E5 · medium
  `lstat` and `open` both followed a folder swapped for a symlink just after `realpath`, so their
  identities agreed and an outside file was read (about 18% of 19,073 reads on Bun, 1.6% of 24,412
  on Node 24, with a rename-swap loop). Where: `packages/server/src/excerpts/open.ts`.
  Found: both reviews of group 2 (the automated security review scored it below its reporting bar,
  since the attacker must run a swap loop as the user). Status: fixed in #28 (`fix(excerpts): refuse
  a folder swapped for a symlink before the open`): `O_NOFOLLOW_ANY` on macOS; on Linux the open
  file's path from `/proc/self/fd` must equal the real path; device and inode still matched.
- **L1: an existence oracle** · #28, E5 · low
  Through a symlink in the root, the reason told whether a file outside it exists (`outside-root`
  versus `not-found`). Where: `packages/server/src/excerpts/confine.ts`, `walk.ts`.
  Found: independent review of group 2. Status: fixed in #28 (`fix(excerpts): never tell whether a
  file outside the root exists`): a component walk that stops at the root's edge. Residual: see
  "Deferred and accepted".
- **L3: error codes** · #28, E5 · low
  Node's own `ERR_…` codes counted as system errors and made a pointer `not-found`.
  Where: `packages/server/src/excerpts/`. Status: fixed in #28: only errno names count; a failing
  `close()` rejects the operation, which fails closed.
- **H2: the mod trusted an unchecked session file** · #23, E4 · HIGH
  The mod used the session folder and file without checking owner and mode.
  Where: `packages/mod/src/locate.ts` (`privateCheck`, `isPrivate`), `poll.ts`; `prepareFolder` in
  `packages/server/src/board-host/local-api/session-file.ts`. Found: findings passed on after the
  review of 2026-11-01 (task 13.10). Status: fixed in #23: `find` checks a 0700 folder and a 0600
  file of the user's, failing closed with one debug line; `prepareFolder` clears special bits such as
  an inherited set-group-ID bit, which the exact mode check would refuse.
- **No ID (task 13.15): a folder remade between checks** · #23, E4 · not recorded
  After a check passed, the mod trusted the folder until the file named another process, so a folder
  removed and remade by another user with the same `pid` and `epoch` stayed trusted.
  Where: `packages/mod/src/poll.ts`. Status: fixed in #23: checked again every sixtieth poll.
- **L3 (task 14.7a): `find -uid`** · #23, E4 · L
  The private check now uses `find … -uid <uid>`, which BSD and GNU `find` answer alike.
  Where: `packages/mod/src/locate.ts`. Status: fixed in #23.
- **H1: the project root and git's environment** · #23, E4 · HIGH (with PO decision XC-A1)
  A fallback made the working folder the session project root, and the origin's git run honoured
  `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR` and `GIT_INDEX_FILE`, which made a linked worktree's
  origin another repository's. Where: `sessionProjectRoot` in
  `packages/server/src/push-composition.ts`, `packages/server/src/board-host/local-api/origin.ts`.
  Status: fixed in #23: the root is the real path of `CLAUDE_PROJECT_DIR` or none; git runs without
  those four variables.
- **L2 (task 14.7a): a project root that is no folder** · #23, E4 · L
  Status: fixed in #23 (`fix(server): a session project root only for an absolute
  CLAUDE_PROJECT_DIR naming a folder`).
- **No ID (task 13.5): two starters, one session file** · #23, E4 · not recorded
  Two local APIs started together under one key could both claim the session file. A first fix,
  claiming before listening, left "the socket still 0700 behind a file already written".
  Where: `local-api/session-file.ts` (`claimSessionFile`), `local-api/index.ts`.
  Status: fixed in #23: each starter listens on its own 0600 socket, writes its file under a
  temporary name and links it to `<key>.json`, which fails when the name exists; only the holder
  moves its socket onto `<key>.sock`.
- **F1: a relative `CLAUDE_PROJECT_DIR`** · #31, E8 · not recorded
  A relative `CLAUDE_PROJECT_DIR` named a project for the configuration files.
  Where: `packages/server/src/config-files.ts`. Found: E8's security review (task 10.3).
  Status: fixed in #31 (`fix(server): a relative CLAUDE_PROJECT_DIR names no project`).
- **F4: a write through a dangling link** · #31, E8 · not recorded
  The configuration write could go through a link whose folder is missing.
  Where: `config-files.ts`. Status: fixed in #31 (`fix(server): refuse a write through a link whose
  folder is missing`), tested in `packages/server/test/config-write.test.ts`.
- **F3: an ancestor-folder swap** · #31, E8 · low · deferred
  `writableByOthers` (`config-files.ts:144`) checks the real file, its folder and the link's folder,
  no ancestor, so a swap higher up is not seen. Status: recorded as a follow-up, out of scope.

## Agent content as data; process launches (NFR-5, AD-8)

- **No ID: bidirectional controls shown raw** · #28, E5 · low (two findings)
  The pointer grammar and the URL check refuse only control characters of category Cc, so U+202E and
  its kin pass; the reading panel's header, its "not available" line and frame title, and the
  reference chip's tooltip showed them unmarked. Where: `packages/view/src/catalog/context/marks.ts`
  (`markedString`), the reading panel, `reference.tsx`. Found: the second part of task 8.1, an
  independent review briefed with the diff and the board-host spec. Status: fixed in #28: shown as
  `\uXXXX`, with a unit test and a browser scenario.
- **No ID: the editor could launch any file** · #28, E5 · review note for E8
  An `open`-style editor command could launch an arbitrary file by association.
  Where: `packages/server/src/excerpts/files.ts` (`editorTarget`, `looksLikeText`). Status: fixed in
  #28: a file with a NUL byte or invalid UTF-8 in its first 8 KiB is refused as `not-text`.
- **Minor 4: the board page's inlined code** · #8, E1 · minor
  The view build check accepted the board page script's bytes outside the exact `<script>` element
  the policy's hash matches (in a comment, a module script, a `<template>`).
  Where: `tools/build/`. Found: Track B's review of `board-host`. Status: fixed in #8: exact
  substrings required.
- **F42: scripts from `file://` in Firefox** · #4, renderer spike · design finding, accepted
  2026-10-30
  Firefox runs a relative `<script src>` from a `file://` page despite a hash-only `script-src`.
  Where: `openspec/changes/archive/2026-11-14-spike-renderer/findings.md`. Status: AD-8's rule that no view code creates
  a script element with a URL, and a loader that refuses such loads.

## The mod and the hooks (AD-4, AD-10, AD-19)

- **No ID (task 13.3): top-level function bindings** · #23, E4 · not recorded
  The built mod passed `$` to functions bound with top-level `var`, against the rule the review
  quoted. Where: `tools/build/mod-bindings.ts`, `js-scan.ts`. Status: fixed in #23: rewritten to
  `const`, and the build fails on any left.
- **G1: an in-process teammate's idle stop closed its asks** · #24, E4 follow-up · not recorded
  An in-process teammate's hook `agent_id` is opaque, so it was taken for a subagent: its first idle
  `SubagentStop` closed its asks, and the answer could never wake it (G2).
  Where: `packages/mod/src/` (turn reports), the stop route in `board-host/local-api/`.
  Found: the PO's probe 17.6. Status: fixed in #24: the mod names teammates from `$.agent.list()`;
  the stop route decides idle or finished from that report or the ID form.
- See also task 13.1 (fail closed) and H2, 13.15, L3 (file system).

## Cross-session state and ownership (NFR-2, AD-5, AD-14)

- **F2: a lost update across sessions** · #31, E8 · low · deferred
  Two sessions writing the user `config.json` can lose one write. Status: recorded as a follow-up in
  `settings-languages/tasks.md` 10.3.
- **No ID (task 13.7): another agent's identical resend** · #23, E4 · not recorded
  An identical resend by another agent got E1's `in-use`, with advice to send again.
  Where: `packages/core/src/`, `packages/server/src/mcp-tools/owner-refusal.ts`.
  Status: fixed in #23: outcome `other-owner`, telling the agent to choose a new ID.
- See also task 13.5 (file system).

## Dependencies and licences (NFR-6, AD-19)

No finding recorded. Related: `react-remove-scroll-bar` 2.3.8's tarball ships no licence file, so
`tools/licence-texts.json` supplies its MIT text for that exact version (#13); it is not a licence
exception.

## Deferred and accepted

Not new findings unless a range makes them worse.

- **Bun's pre-connect frame** (#13): on Bun's native WebSocket the runtime buffers one whole frame,
  up to about 6 MB, before AskBoard sees it; the cut-off before `connect` holds where `ws` reads the
  stream (Node, the shipped bundle). E11 sets `maxPayloadLength` on the upgrade, or checks the
  request before it, and runs finding 1's tests on the executable.
  (`archive/2026-11-03-ask-lifecycle/design.md`, Risks)
- **E8 F2 and F3** (#31): above. (`settings-languages/tasks.md` 10.3)
- **E5** (#28; `excerpts/design.md` Risks, `tasks.md` 2.5 and 8.1):
  - a hard link in the root to an outside file is read, pinned by a test in `files.test.ts`;
  - a chain that leaves the root and returns to an existing file inside still shows whether its
    outside folder or link exists (for the PO);
  - L2: Bun's `realpath` on macOS opens its target, so an outside FIFO or device behind an in-root
    link is opened, non-blocking and never read, before confinement;
  - L4: the adapter takes any absolute root (`/proc/self` would expose `environ`); the root comes
    only from `CLAUDE_PROJECT_DIR` and E4's origin, never from agent text;
  - `holdsWord` is O(n·m), about 1.3 s for a 4 MiB heading and a 1,000-character anchor, within the
    limits, slowing only the agent's own session.
- **E4** (#23, #24; `push-delivery/design.md`, Risks):
  - a stop block's `received` raise is lost if Claude Code drops the hook's output;
  - L6: no end-to-end test runs `update` and `fetch` owner checks with real hooks;
  - auto mode refuses the mod's `$.session.send` (spike D13): the answer waits for the next turn;
  - a named subagent whose name equals its type keeps its asks open at its stop until discard; a
    teammate respawned under the same name gets a new ID, and its old asks wait for `collect`.
- **Gantt** (#18): changes pushing a task past 50 dependents still pass `validateGanttChanges`;
  `compute` recalculates a `set` of a plan's `start` to stale offsets; every item re-renders on any
  draft change; a focus jump when a question reopens; four components over 50 lines; the chart's
  width is unbounded, and engines clamp the SVG past about year 5290 (Firefox) or 8150.
- **E1** (#8): board tokens stay known for the process's life, so a discarded ask's link can say so.
- **E7** (#29): a Snapshot the user shares carries project content off the machine, by the user's
  choice; the file holds no token.
- **E8** (#31): the settings panel shows the editor's argument vector, by design.
- **Open, not deferred**: the two P2 comments on #32 (`board-props.ts:52`, `widget-update.ts:96`).
