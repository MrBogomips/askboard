# e2e-cadence, group 0: probes, inventories, baseline

Working record of tasks 0.1 to 0.6 (OpenSpec change `e2e-cadence`, Issues #171 and #146). Base: `origin/main` a3f2708d; the worktree head was 7d2c648c. Machine: 14 cores, macOS, Bun 1.4.4, Node 24.22.2, Playwright 1.65.0. The baseline and timing runs ran alone on the machine; the load average is given where it matters. Group 4 reads the quiet-wait table; group 1 reads the manifest inventory; groups 2 and 3 read the probe results.

## 0.1 Answers

None has come on #171 (two comments, both the coordinator's; `needs-po` is still on it). Defaults D1 to D6 and the proposed answers to Q1 and Q2 stand. The design carries no "Answer" line.

## 0.2 Borrowed names, on `origin/main` a3f2708d

| Name | File:line |
|---|---|
| `ENGINES`, `Engine`, `enginesFrom` | `packages/view/test/browser/harness/engines.ts:4`, `:6`, `:11` |
| `TEST_TIMEOUT_MS`, `LOAD_TIMEOUT_MS`, `STEP_TIMEOUT_MS`, `QUIET_MS` | `harness/board-test.ts:22`, `:24`, `:26`, `:30` |
| `useEngine`, `eventually`, `actsApplied`, `expectNoReconnect` | `harness/board-test.ts:127`, `:165`, `:182`, `:236` |
| `DRAFT_DEBOUNCE_MS` (300) | `packages/view/src/board-page/draft-mirror.ts:10` |
| Reconnect delay | `RECONNECT_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000]` (`packages/view/src/board-page/reconnect.ts:35`), read through `reconnectDelay(attempt)` (`:38`, used at `controller.ts:787`). The first wait is 250 ms. |
| `run.ts` options | `--engines`, `--target`, `--runtime`, `--no-build`, `--serial`, `-- <bun test args>` (`run.ts:34-55`); `TEST_TIMEOUT_MS = 60_000` at `run.ts:22` |
| `runs-on` input | `.github/workflows/browser.yml:5`, `:13`; `conformance.yml:5`, `:13` |
| Playwright cache | `browser.yml:22-23` (`PLAYWRIGHT_BROWSERS_PATH`), `:34-37` (`actions/cache` v6.1.0 by SHA), `:40-41` (install) |
| `upload-artifact` v7.0.2, `download-artifact` v8.0.2 pins | `release.yml:55`; `:78`, `:98` |
| Release jobs `build`, `smoke-linux`, `publish` and their needs | `tools/release/workflow.test.ts:59` (job list), `:113-116` (needs) |
| `setup-bun` and `--no-codex` | `.github/actions/setup-bun/action.yml:19`; `setup.sh:6`, `:218` |
| `tools/ci/changed-paths.sh` and `code` | `tools/ci/changed-paths.sh:20`, `:27`, `:72` (`echo "code=$code"`) |
| `ci.yml` concurrency group | `.github/workflows/ci.yml:24-26` |
| `tools/test-timings.json` format | `{"version": 1, "files": {"<path>": <ms>}}`, paths relative to the repository root |
| Workflow list of `codex-interop.test.ts` | `tools/codex-interop.test.ts:33` (`check`, `browser`, `conformance`, `openspec`, `release`) |
| `fixtures/record-link.sh` | `packages/view/test/browser/fixtures/record-link.sh` |

- `DRAFT_DEBOUNCE_MS` can be imported by the browser harness through a relative path inside the `view` package (`../../../src/board-page/draft-mirror.ts` from `harness/`, `../../src/...` from the test folder), as `harness/widget-board.ts` already does for `view-document.ts`. Its only import is a type from `@askboard/contract`. The scratch probe file imported it that way and ran in all three engines.
- Browser files added since a3f2708d: none (145 `*.browser.ts` files, `origin/main` is a3f2708d).
- No name is missing and no shape differs.

## 0.3 Probes P1 and P2 (Chromium, Bun 1.4.4)

Five files (`connection`, `board`, `context-panel`, `snapshot-control`, `lifecycle-board-page`), `ASKBOARD_E2E_*` and `BROWSER` set, run by hand with `bun test`.

**P1: yes.**
- Serial: 51 tests (48 pass, 3 skip) in 60.3 s. `--parallel=2`: the same 51 in 30.3 s isolated, 31.2 s with `--no-isolate`.
- Workers see the variables: a scratch file printed `ENV engines=webkit target=session-process browser=/bin/echo` from a worker in both modes, and it ran WebKit tests only (counts stayed at the one engine's).
- Browsers launch in workers, isolated and not.
- Session processes stay apart for ports (each session starts its own proxy on an ephemeral port) and for `HOME`, `XDG_CONFIG_HOME` and the project (a `mkdtemp` folder per session, `session-process.ts:454-473`). They do NOT stay apart for the session folder: `isolated()` sets no `XDG_RUNTIME_DIR`, so every session process of every worker writes its session file and socket in the machine-wide `/tmp/askboard-<uid>/` (the error text of the failure below names `/tmp/askboard-501/8031.sock`). See the load findings.
- One injected failing test gave exit 1 with `8 pass`, `1 fail`, `Ran 9 tests across 2 files` in both modes; the `N pass` and `N fail` lines `run.ts` counts are kept.

**P2: yes.**
- `--shard=1/2` ran 3 of 5 files (38 tests) and `--shard=2/2` ran 2 (13 tests): 51 together, each file once. With a timings file the split was by time: board + connection (31.1 s) against context-panel + lifecycle + snapshot-control (29.2 s).
- `--timings <file> --update-timings` wrote the file in `tools/test-timings.json`'s format (`{"version": 1, "files": {"packages/view/test/browser/connection.browser.ts": 17730, ...}}`). It records every file run, with no 1.5 s floor, and the keys are relative paths although the arguments were `./`-prefixed.
- Start order: with two workers and `--timings`, the two slowest of four scratch files started first (`c d b a`); without it the order was arbitrary (`a c b d`). With `--parallel=1` files run in argument order whatever the timings say.

**(c) Chromium's whole `full` set** (141 files: all but the four perf files; 889 pass, 3 skip, 0 fail in every run below).

| Workers | Isolated | `--no-isolate` |
|---|---|---|
| 1 (serial, no `--parallel`) | 1,442 s | not run (no workers to share) |
| 2 | 764 s | 751 s |
| 4 | 390 s | 382 s |
| 8 | 215 s | 212 s |
| 14 (the core count) | 186 s | not run |

- `--no-isolate` gains at most 2 percent, within noise: keep Bun's isolation (decision 5's default).
- Load average: 3 to 4 during the serial run (the files wait, they do not compute), 8 at 8 workers, 15 at 14 workers.
- Three engines at once, each with its own `bun test --parallel=n` over the same 141 files:

| Workers per engine | Chromium | Firefox | WebKit | Load average peak |
|---|---|---|---|---|
| 4 | 519 s, 889 pass, 0 fail | 619 s, 849 pass, 38 fail | 412 s, 886 pass, 1 fail | 26 |
| 8 | 483 s, 888 pass, 1 fail | 622 s, 850 pass, 37 fail | 425 s, 887 pass, 0 fail | 44 |

- The three engines saturate the machine: 4 and 8 workers each finish at the same time (about 10 min). One engine at a time with 14 workers takes about 3 min each (about 9.5 min in all), with a load of 15 and no failures. So the worker default of decision 5, `floor(cores / (2 x engines))` = 2 here, is too low (764 s for Chromium alone at 2); `cores / engines` (4) or engines in turn at `cores` workers is the useful range.
- Failures that appear only under the three-engine load, each passing when rerun alone (3 runs of `header`, one of `uj2-editing-plus`):
  - Chromium, `header.browser.ts` "the pill reads waiting while the agent waits on the ask, and working once the answer returns" (8 workers): `connect ENOENT /tmp/askboard-501/8031.sock` from `postRecord` (`asker-project.ts:162`): the harness found a session file in the shared folder whose socket was gone.
  - WebKit, `uj2-editing-plus.browser.ts` "widen the column, switch the critical path off, ..." (4 workers): `run.logged()` returned a change list with no `length` (`:126`), a read before the session had logged.
  - Firefox, the Chart "agent removes the highlighted category" test (4 workers), and the Approval "agent records an answer after Keep mine" test (8 workers), each once.
  - Firefox's known failures (#174, #145) are 37 in a serial-per-file run, 37 or 38 here.
- Decision: keep isolated; set the worker default after group 2's tuning, and consider a per-session `XDG_RUNTIME_DIR` in the harness (macOS limits a Unix socket path to 104 bytes, and the temporary folder's path is long).

## 0.4 Probe P3 (scratch file, not committed; `zz-p3.browser.ts`, 200 rounds, `ASKBOARD_E2E_TARGET=session-process`)

(a) A page-side WebSocket frame, then the page `evaluate` returns; is the frame in `run.browser.sockets`?

| Engine | Frame sent in the same evaluate | After one more `evaluate` | After a page macrotask |
|---|---|---|---|
| Chromium | 200 of 200 | 200 of 200 | 200 of 200 |
| Firefox | **0 of 200** | 200 of 200 | 200 of 200 |
| WebKit | 200 of 200 | 200 of 200 | 200 of 200 |

Firefox reports `framesent` after the evaluate that sent the frame resolves, but before the next round trip. `hostSettled` (the `viewSettled` round trips, then a page macrotask) is two or more round trips after the frame, so it holds in all three. A frame sent inside the probe's own call does not count.

(b) A view `postMessage({probe: n}, "*")`, then the view-side flush (two animation frames and a macrotask), then the board page's macrotask; has the board page's `message` listener seen it?

| Engine | Full `viewSettled` | View-side flush only |
|---|---|---|
| Chromium | 200 of 200 | 200 of 200 |
| Firefox | 200 of 200 | 200 of 200 |
| WebKit | 200 of 200 | 200 of 200 |

(c) Mutation: a scratch line in `packages/view/src/shell/index.tsx` (reverted, `dist/` rebuilt) made an arrow key call the draft mirror. A test pressing Tab and ArrowDown, then waiting `DRAFT_DEBOUNCE_MS`, one frame and `viewSettled`, saw a draft frame in 10 of 10 runs in each of Chromium, Firefox and WebKit (0 of 10 without the mutation). Taking the message first (`viewSettled`, then the debounce, then `hostSettled`) also gave 10 of 10. So `draftSettled` as the design gives it fails on the fault in every engine.

No channel and engine pair is below 200 of 200 for the probes as designed, so no `quiet` fallback is needed.

## 0.5 Inventories

### (a) The smoke set

Seven files, 67 tests, 64 s in Chromium run serially by one `bun test` (load 4 to 9 at the start; the file times were 7.9, 12.7, 15.5, 8.3, 14.6, 2.1 and 3.2 s). Within the 25-file and 5-minute budget.

| Spine check | File | Test title (at `a3f2708d`) |
|---|---|---|
| cold load | `board.browser.ts:77` | the plain-choice board: tab title, header, chip, three options with descriptions |
| reload | `board.browser.ts:255` | a reload: the board comes back answered, delivered to the agent, revisable, with no token in the view |
| reload (page state) | `lifecycle-board-page.browser.ts:68` | a reload keeps the ready answer and the note, in submitted delivery, and nothing was sent |
| takeover | `connection.browser.ts:66` | the plain-choice session: answer, delivered, taken over by a second tab, discarded |
| takeover (drafts) | `lifecycle-board-page.browser.ts:84` | a takeover keeps the ready answer and the note: the older tab sends its last draft at once |
| source view | `context-panel.browser.ts:288` | the source view framed from http://localhost:<port> is refused |
| `self.origin === "null"` | `view.browser.ts:61` | the view's origin is opaque and its frame is sandboxed with allow-scripts only |
| a failing view `fetch` | `view.browser.ts:75` | the view tries to reach the network: the request fails and the session receives nothing |
| box unchanged 1 s later | `view.browser.ts:168` | a question becomes visible once its options have rendered, and its box is unchanged 1 s later |
| a board rendered | `board.browser.ts:77` | (as cold load) |
| a Snapshot rendered | `snapshot-view.browser.ts:96` | the agent's Snapshot: the top line, the answered state, no control that acts |
| CSP collection | `view.browser.ts:98`; `harness.browser.ts:60` | a board loads with no CSP violation from the view, the board page or the console; catches a caught eval on the board page |
| NFR-10 discarded and moved | `connection.browser.ts:89` | the session ends: the board shows the ask discarded, stays readable, accepts no answer |
| PlantUML images for an empty source and a syntax error | none | no PlantUML widget on `main` (`git grep -il plantuml packages` finds nothing in `widgets` or `view` sources) |

The smoke files: `view`, `board`, `connection`, `lifecycle-board-page`, `context-panel`, `snapshot-view`, `harness`.

### (b) Timed assertions under `packages/view/test/browser/`

Bounds of the view spec, to the perf set (at `a3f2708d`):

- `table-bounds.browser.ts:164-166` (`GATES` visible 1500, edit 100, add 250 at `:29`; the fan-out WebKit edit gate 150 at `:32`), three runs each, judged alone.
- `markdown-total.browser.ts:79` (and the plain/heavy figures at `:64-126`), `markdown-bounds.browser.ts:108` (`BUDGET_MS` 500, `:19`).
- `latex-bounds.browser.ts`: `RENDER_BOUND_MS` 2,000 (`:50`) at `:79`, `:97`, `:162`, `:192`, `:214`; `PARENT_ANSWER_MS` at `:80`, `:98`, `:120`, `:164`, `:194`, `:216`; `SHOW_BOUND_MS` at `:268`, `:302`, `:325`, `:345`, `:369`, `:406`, `:435`, `:524`, `:525`.
- `latex.browser.ts:405`: `Date.now() - started < 2_000 + QUIET_MS`, to move into `latex-bounds` (task 3.3).

Timing assertions that stay, with the reason: `gantt-drag.browser.ts:253`, `:260`, `:266`, `:270` (`LOAD_TIMEOUT_MS`, `STEP_TIMEOUT_MS`: the harness's timeouts), `gantt-layout.browser.ts:257` (`STEP_TIMEOUT_MS`), `tree-layout.browser.ts:188` (`LOAD_TIMEOUT_MS`), `view.browser.ts` (the spine's own 1 s: a wait, not a bound), `board.browser.ts:226-228` and `tree-uj2.browser.ts:128-146` (a click window for an answer's `when`, no bound), `document-review-session.browser.ts:740` (a size, not a time). The `toBeLessThan` hits on pixel boxes, scroll sizes and string positions are layout checks, not timing.

**Outside the planned set:** `document-review.browser.ts:1118-1235`, a Chromium-only block ("the cost of placing", `if (enginesFrom(...).includes("chromium"))`) with four wall-clock gates: `busy < alone * 4 + 60` (`:1185`), `placed < 15_000` (`:1186`), `perKey < 150` (`:1230`) and `shown < 20_000` (`:1231`). They come from document-review's own decision 15 and task 6.4 (the figures go to CHANGELOG Known limits), not from a requirement of the view spec (`grep` of `openspec/specs` finds none). Decision 6's rule ("no non-perf file holds a `toBeLessThan` on a `performance.now()` or `Date.now()` difference") would fail on them. Needs `/opsx:update` of decisions 4 and 6: move them to the perf set, or exempt them with a reason. Baseline figures: 162 ms placed, 2.0 ms per key beside 99 quotes against 0.9 alone; 409 ms and 4.3 ms per key for 32 reviews.

### (c) The quiet waits

158 sites (144 whole, 14 `QUIET_MS / 3`) in 61 files, `expectNoReconnect` with its 7 callers (`connection` 5, `document-review-session` 1, `oversized-acts-session` 1) among them. The design says 63 files; the grep gives 61. The classes are proposed from the assertion each sleep guards (what the next lines read); each conversion confirms it, and task 4.6's mutation check decides. Counts by class: viewSettled 79, hostSettled 35, draftSettled 32, quiet 11, timerSettled 1.

The scratch rule used: the next assertion reads `sentActs` or `session.collect()` -> hostSettled; `sentDrafts`, `draftHolds` or `run.drafts` -> draftSettled; `run.messages` or DOM and focus -> viewSettled; a reconnect -> timerSettled; a direction the probes do not cover (the board page's update to the view) or a browser-queued report -> quiet.

#### Harness (task 4.2): 2 sites in 2 files

| File | Sites (line, `/3` marked) | Proposed class |
|---|---|---|
| harness/board-test.ts | 238 | timerSettled |
| harness/tree-steps.ts | 64 | viewSettled |

#### Batch 1 (task 4.3): approval, pick-field, form, document-review, atoms: 41 sites in 10 files

| File | Sites (line, `/3` marked) | Proposed class |
|---|---|---|
| approval-answer.browser.ts | 94, 101/3, 145, 237, 257, 290, 314, 331 | hostSettled 5, viewSettled 3 |
| approval-submit.browser.ts | 181, 209, 236, 263, 285, 303, 323, 350 | hostSettled |
| approval.browser.ts | 86, 297 | viewSettled 1, hostSettled 1 |
| document-review-session.browser.ts | 248, 482 | hostSettled 1, draftSettled 1 |
| document-review.browser.ts | 72, 253, 427, 838, 899, 906, 947, 970, 1061 | draftSettled 3, viewSettled 6 |
| field-atoms.browser.ts | 63, 258 | draftSettled 1, viewSettled 1 |
| form-fields.browser.ts | 159 | viewSettled |
| form-session.browser.ts | 286 | hostSettled |
| number-atoms.browser.ts | 396 | hostSettled |
| pick-field.browser.ts | 143, 151, 235, 295, 329, 364, 518 | draftSettled |

#### Batch 2 (task 4.4): tree, wbs, gantt, timeline, kanban, ranking: 69 sites in 27 files

| File | Sites (line, `/3` marked) | Proposed class |
|---|---|---|
| gantt-changes.browser.ts | 174 | viewSettled |
| gantt-column.browser.ts | 57 | viewSettled |
| gantt-critical-switch.browser.ts | 107 | viewSettled |
| gantt-keys.browser.ts | 127 | viewSettled |
| gantt-layout.browser.ts | 99, 124 | viewSettled |
| gantt-plan-duration.browser.ts | 203 | viewSettled |
| gantt-plan-tree.browser.ts | 124, 349 | viewSettled |
| gantt-plan-uj2.browser.ts | 161, 168 | viewSettled |
| gantt-plan.browser.ts | 184, 230, 265, 315 | viewSettled |
| kanban.browser.ts | 127, 183/3, 213/3, 325/3, 476/3, 644/3, 657/3, 804, 851 | draftSettled 5, viewSettled 2, hostSettled 2 |
| ranking-keys-session.browser.ts | 148, 224, 232 | hostSettled 1, viewSettled 2 |
| ranking.browser.ts | 89, 173/3, 279 | draftSettled 1, viewSettled 1, hostSettled 1 |
| timeline.browser.ts | 133, 158/3, 206/3, 234/3, 374/3, 488 | draftSettled 5, viewSettled 1 |
| tree-adding.browser.ts | 177, 253 | viewSettled |
| tree-deleting.browser.ts | 82, 192, 260 | viewSettled |
| tree-drag-answer.browser.ts | 104 | viewSettled |
| tree-editing.browser.ts | 107, 168, 192, 219, 228 | viewSettled |
| tree-layout.browser.ts | 49, 74 | viewSettled |
| tree-marks.browser.ts | 105, 179 | viewSettled |
| tree-moving.browser.ts | 112, 202 | viewSettled |
| tree-read-only.browser.ts | 142 | viewSettled |
| tree-uj2.browser.ts | 119, 132 | viewSettled |
| wbs-answer.browser.ts | 120, 129 | viewSettled |
| wbs-editing.browser.ts | 68, 113, 125 | viewSettled |
| wbs-linking.browser.ts | 175, 201, 293, 314, 350, 375 | viewSettled |
| wbs-pointer.browser.ts | 63 | viewSettled |
| wbs.browser.ts | 55 | viewSettled |

#### Batch 3 (task 4.5): the rest: 46 sites in 22 files

| File | Sites (line, `/3` marked) | Proposed class |
|---|---|---|
| board.browser.ts | 274 | hostSettled |
| chart-session.browser.ts | 137 | hostSettled |
| chart-theme.browser.ts | 150 | viewSettled |
| chart.browser.ts | 103, 171, 315 | draftSettled 2, hostSettled 1 |
| context-items.browser.ts | 307 | quiet |
| harness.browser.ts | 48 | viewSettled |
| keys-config.browser.ts | 127, 159, 193, 221 | quiet |
| keys-help.browser.ts | 209 | viewSettled |
| latex.browser.ts | 106/3, 158, 585 | viewSettled 1, draftSettled 1, hostSettled 1 |
| lifecycle-card.browser.ts | 292, 302, 329, 334 | draftSettled 2, viewSettled 1, hostSettled 1 |
| lifecycle-delivery.browser.ts | 349 | quiet |
| presence.browser.ts | 50, 98 | hostSettled |
| reopen-session.browser.ts | 307, 316/3, 408, 541, 627 | quiet |
| result-widgets-session.browser.ts | 112, 284 | hostSettled 1, draftSettled 1 |
| scale.browser.ts | 68, 251, 271 | draftSettled 1, hostSettled 2 |
| shown-revision-draft-session.browser.ts | 115, 154, 212 | draftSettled 1, hostSettled 2 |
| shown-revision-items-session.browser.ts | 156, 178 | draftSettled 1, viewSettled 1 |
| shown-revision-wiring-session.browser.ts | 168, 205 | viewSettled |
| snapshot-control.browser.ts | 133, 216 | hostSettled |
| text.browser.ts | 100 | viewSettled |
| widget-derived.browser.ts | 75 | viewSettled |
| widget-host.browser.ts | 42, 95 | viewSettled |

Sites proposed as `quiet`, with the reason:

- context-items.browser.ts:307: an image's blob fetch is a product async with no message to wait for
- keys-config.browser.ts:127: page-to-view update (user's keys applied by the first update): the probes cover view-to-page only
- keys-config.browser.ts:159: same: page-to-view update
- keys-config.browser.ts:193: same: page-to-view update
- keys-config.browser.ts:221: same: page-to-view update
- lifecycle-delivery.browser.ts:349: a CSP report the browser queues reaches the harness on its own schedule: no channel to probe
- reopen-session.browser.ts:307: 'nothing fills it late': a late fill is a page-to-view update
- reopen-session.browser.ts:316: same, QUIET_MS / 3
- reopen-session.browser.ts:408: same: page-to-view update after a reload
- reopen-session.browser.ts:541: same: page-to-view update after a reload
- reopen-session.browser.ts:627: same: page-to-view update after a reload

Sleeps the guard of task 4.1 does not name, found beside the 158 (they are not `QUIET_MS`, so they stay unless the design says otherwise): literal `Bun.sleep(1500)` equal to `QUIET_MS` at `context-panel.browser.ts:308` and `connection.browser.ts:195` (the guard should also refuse a literal 1500); `Bun.sleep(300)` at `board.browser.ts:51`, `date-atom.browser.ts:167`, `context-snapshot.browser.ts:65`, `view.browser.ts:90`, `shown-revision-act-session.browser.ts:202` (the draft debounce); `Bun.sleep(1_000)` at `view.browser.ts:116`, `:175` (the spine's 1 s); `MIRROR_SETTLE_MS` four times in `reopen-session.browser.ts`; `ranking-keys.browser.ts:505` (60 ms).

### (d) The manifest inventory

145 files, which is every `ls packages/view/test/browser/*.browser.ts`. All run in three engines except `markdown-total` and `markdown-bounds` (Chromium and WebKit, Markdown bounded work). `S` smoke, `P` perf, `N` narrowed. The helpers `harness/kanban-drag.ts` and `fixtures/kanban-documents.ts` are not entries. `kanban` has all three engines.

Two more engine conditions the planned `harness/suites.test.ts` does not model: `document-review.browser.ts:1118` (`includes("chromium")`, one describe in a three-engine file) and `lifecycle-board-page.browser.ts:164` (`if (engine === "chromium")` inside a test). Neither narrows the file's engines, so the manifest entry stays three engines; the test only looks for `enginesFrom(...).filter(`.

approval, approval-answer, approval-latex, approval-submit, atoms-it, atoms-session, atoms-snapshot, board [S], chart, chart-hover, chart-it, chart-session, chart-snapshot, chart-theme, connection [S], context-card, context-items, context-panel [S], context-reference, context-snapshot, context-uj1, date-atom, density, display-atoms, document-review, document-review-session, document-review-snapshot, edit-widgets-it, edit-widgets-session, edit-widgets-snapshot, field-atoms, form-fields, form-session, form-snapshot, gantt-axis, gantt-board, gantt-changes, gantt-column, gantt-critical-path, gantt-critical-switch, gantt-double-click, gantt-drag, gantt-editing, gantt-keys, gantt-layout, gantt-plan, gantt-plan-duration, gantt-plan-tree, gantt-plan-uj2, gantt-predecessors, gantt-reading, harness [S], header, hover-audit, hover-layer, kanban, keep-mine-reload-session, keys-browser, keys-config, keys-help, languages, latex, latex-bounds [P], layouts, layouts-session, layouts-snapshot, lifecycle-acts, lifecycle-board-page [S], lifecycle-card, lifecycle-delivery, lifecycle-header, lifecycle-keyboard, lifecycle-presentations, lifecycle-revisions, locale-widgets, markdown, markdown-bounds [PN], markdown-total [PN], number-atoms, oversized-acts-session, pick-field, presence, presentation, presentation-persistence, ranking, ranking-keys, ranking-keys-session, reopen-session, result-widgets-it, result-widgets-session, result-widgets-snapshot, scale, segment-underline, settings-panel, shown-revision-act-session, shown-revision-draft-session, shown-revision-items-session, shown-revision-wiring-session, small-fixes, snapshot-banner, snapshot-control, snapshot-session, snapshot-view [S], submit-failed-item-session, table, table-bounds [P], table-keys, table-session, table-snapshot, tabs, text, timeline, toggles, tree-adding, tree-adjust, tree-coherence, tree-current-row, tree-deleting, tree-drag, tree-drag-answer, tree-editing, tree-keys, tree-layout, tree-marks, tree-moving, tree-read-only, tree-selection, tree-toolbar, tree-uj2, uj2-editing-plus, update-components, view [S], wbs, wbs-answer, wbs-editing, wbs-linking, wbs-pointer, widget-agent-change, widget-answered, widget-board-page, widget-chrome-it, widget-derived, widget-draft-fits, widget-host, widget-revision

## 0.6 Baseline (`bun packages/view/test/browser/run.ts --no-build --target session-process`, 19:54 to 20:20, Bun, three engines at once, files serial)

Load average 3.0 at the start (the 1-minute figure rose to 9 at the peak); nothing else heavy ran.

| Engine | Pass | Skip | Fail | Time |
|---|---|---|---|---|
| Chromium | 981 | 3 | 0 | 1,554.2 s |
| Firefox | 909 | 3 | 37 | 1,566.9 s |
| WebKit | 979 | 3 | 0 | 1,247.8 s |

- The whole run: 1,567 s (26 min). Test counts per engine: 984, 949 and 982 (Chromium, Firefox, WebKit); the 145 files.
- Firefox's 37 failures are the open defect #174 (about 36 tests in the Gantt, WBS, Tree, Form, toggle and layout files, "Page crashed" or a missing focus ring) and #145 (the document-review-session reopen test, which also fails alone). Not fixed here.
- Conformance on Bun: `mod-and-hooks` 37 pass, 0 fail, 61.3 s; `mod-disabled` 71 pass, 1 skip, 0 fail, 39.3 s; `hooks-disabled` 59 pass, 5 skip, 0 fail, 27.2 s; 127 s in all.
- The perf figures, three runs each (ms; `visible`, `edit`, `add` against 1500, 100, 250): Chromium `worst` (280, 66, 59), (266, 63, 62), (263, 84, 58) and `fan-out` (249, 59, 34), (266, 59, 36), (263, 62, 34); Firefox `worst` (384, 78, 76), (368, 89, 75), (370, 78, 75) and `fan-out` (304, 83, 59), (347, 84, 60), (302, 83, 62); WebKit `worst` (250, 89, 64), (245, 90, 62), (239, 87, 63) and `fan-out` (246, 96, 43), (242, 95, 45), (228, 93, 45), against its fan-out edit gate of 150. The runner prints them as `table-bounds <form> <engine> {...}` lines.
- WebKit "ten presses of Tab never reached Answer": **does not reproduce here**. Zero WebKit failures in the baseline, in the two three-engine runs (one failure each time, in other tests), and in three more runs of the seven files that press Tab to Answer (`board`, `tree-uj2`, `gantt-plan-uj2`, `wbs-answer`, `uj2-editing-plus`, `lifecycle-keyboard`, `approval-submit`; 32 pass each). No Issue filed. The line in CLAUDE.md came from CI (macOS runners); it can only be checked there, and it stays until a hosted run shows it fixed.

## Open items for the caller

1. Decisions 4 and 6: the document-review timing block (0.5(b)).
2. The guard of decision 7: literal `1500` sleeps, and 61 files, not 63.
3. Decision 5's worker default and the shared session folder (0.3).
4. P5 is not measurable here: the first run of the pull request settles the cores and the smoke time (task 7.2). Here the smoke set takes 64 s serially with the files waiting more than computing, so it has a wide margin of the 5 minutes.
