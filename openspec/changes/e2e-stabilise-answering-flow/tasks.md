# Tasks

The groups run in order with one implementer. Each task writes its tests first and sees them fail for the right reason.

Terms used below:
- **"File run"**: `ASKBOARD_E2E_ENGINES=chromium ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/<file>` after `bun run build`.
- **"Firefox run" and "WebKit run"**: the same command with that engine alone. They are used only to reproduce and check this change's engine-specific defects (design.md, Context). On a Mac, WebKit needs keyboard navigation on.
- **"Dn"**: a decision in design.md.

Commit bodies say `Refs #n` for the Issues each group touches.

## 0. Base

- [x] 0.1 `palettes` (#235) first: once it has merged, `git rebase origin/main` and `./setup.sh --no-codex`. Its `pickTheme` (`chart-theme.browser.ts`), `harness/dom.ts` and `theme-control.tsx` are the base of task 1.2 (D8). Tests: none. Verify: `git log origin/main` holds #235, and `git grep -n "const pickTheme" -- packages/view/test/browser` finds one definition.
- [x] 0.2 Borrowed names (D8): `git grep -n <name> origin/main -- packages` for each name D8 lists. Tests: none. Verify: the note gives each name's file and line. A missing name, or one whose shape changed, stops the work for `/openspec-update-change`.

## 1. Tests written for the frame before the redesign (#236, #237, #242 in Chromium and Firefox)

- [x] 1.1 `workOf(drafts)` in `harness/draft-results.ts` (D1). Unit cases first in `harness/draft-results.test.ts`: no draft, numbers alone, and each kind of work. Then replace the 30 `run.drafts` equal to `[]` assertions in the 12 files #236 lists. Verify: unit red, then green; File runs of `kanban`, `timeline`, `document-review`, `chart`, `table` and `tree-coherence` pass.
- [x] 1.2 Move palettes' `pickTheme` into `harness/dom.ts` (D2) and use it in `chart-theme`, `chart-snapshot` (Snapshot page) and `icons` ("each icon takes the text colour… light/dark theme"). Tests: those cases. Verify: File runs of the three files pass; `git grep -n "const pickTheme"` finds the harness's alone.
- [x] 1.3 `languages.browser.ts` measures `board.progressRow`; the test is renamed "the progress row in Italian fits the 1280 px viewport with no overflow" (D2). Verify: a File run passes in the de-DE/America/Adak and de-DE/Pacific/Kiritimati configurations.
- [x] 1.4 Labels without key caps: `icons.browser.ts:173` (the jump in en-US and it-IT) and `table.browser.ts:199` read through `labelText` (D2). Verify: File runs of `icons` and `table` pass; the accessible-name assertions are unchanged.
- [x] 1.5 `tabIntoGrid` (`fixtures/gantt-input.ts`) clicks the Gantt question's heading, then presses Tab at most ten times; the Shift+Tab rule stays (D2). Tests: `gantt-plan` and `gantt-plan-duration`. Verify: File runs of both, and of every other file that calls `tabIntoGrid`, pass.
- [x] 1.6 `board-keys.browser.ts:539` expects the catalog's `key.shift` for the ask's language, or `⇧` on macOS (D2). Verify: a File run passes; the test fails when given a wrong expectation by hand.
- [x] 1.7 `answering-flow-motion.browser.ts`: a `MutationObserver` installed before the act records when the mark is set and removed (D3). Scenarios: Reduced motion, No preference. Verify: File and Firefox runs pass three times in a row; the WebKit position failure is left to 2.3.
- [x] 1.8 (added on the coordinator's word, palettes' train 43836634537) `palettes-fit.browser.ts` reports the Firefox ask-row `bdi` as clipped: `clipped` moves to `harness/fit.ts`, shared by `answering-flow-fit` and `palettes-fit`, with the inline-box rule of 3.4. Verify: Firefox runs of both pass.
- [x] 1.9 (added likewise) `palettes.browser.ts`, "more contrast under System puts Contrasto", Firefox only. Playwright's Firefox gives `matchMedia` the emulated value in the board page and the view, but dispatches no `change` event to a listener on either (a listener of the test's own on the board page stays silent), and the palette follows that event: the case is skipped in Firefox with a comment naming the limit. Not a product gap that this probe can show.
  - Note 0.2: every name of D8 exists on `origin/main` (f633470e): `revealAndFocus`, `revealDelta`, `SCROLL_MS`, `FRAME_MS`, `ARRIVAL_MS` in `shell/reveal.ts`; `onRemoval` in `shell/document-update.ts`; `shownQuestionOf` in `shell/board-view.ts`; `questionTextId`; `useHeadingFocus` in `shell/board.tsx`; `labelText` in `harness/lifecycle-test.ts`; `tabTo` there; `tabIntoTree` in `harness/tree-grid.ts`; `tabIntoGrid` in `fixtures/gantt-input.ts`; `draftResultOf` in `harness/draft-results.ts`; `themeControl`, `progressRow` in `harness/dom.ts`; `clipped` in `answering-flow-fit.browser.ts` (now `harness/fit.ts`); `key.shift` in the string catalog. Nothing changed shape.
  - Note 1.5: `tabIntoGrid` focuses the Gantt question's heading (as 3.2) instead of clicking it.

## 2. The board's focus move and first render (#241, #242 in WebKit, #243)

- [x] 2.1 Probe (D4). Firefox and WebKit runs of `answering-flow-focus.browser.ts` and `answering-flow-motion.browser.ts`, with a temporary log of the frames run, the active element at settle, whether the node was replaced, and `scrollY` before and after the instant `scrollBy`. Tests: none (probe). Verify: one note line per engine with the cause. The log is not committed.
  - Note: no failure reproduces idle on this Mac; with the idle run Firefox fails about one run in ten, never in the frames. The failing first `Next to do` click lands on q2, not q1 (it-IT, Chromium and Firefox alike): the mouse-down focuses the button, `focusin` sets the question in view to q1 (it crosses the reading line), and a click a frame later goes to the question after it. Not a lost focus. A motion probe found no engine that skips frames.
- [x] 2.2 Unit tests first in `shell/reveal-smooth.test.ts` (D4): frames that never run end the move at the deadline; a replaced node is re-resolved and focused; focus on `body` is restored; a user scroll or focus move during the move is kept; `"instant"` ignored still lands. Verify: red for the right reason against the current `reveal.ts`.
- [x] 2.3 Implement the deadline, `resolve` and settle of D4 in `reveal.ts`; the heading callers in `board.tsx` and `question-card.tsx` pass `resolve`. Scenarios: A jump in each engine, Reduced motion in each engine. Verify: 2.2 is green with 100% line coverage of `reveal.ts`; #241's and #242's cases pass in Chromium, Firefox and WebKit runs.
- [x] 2.4 WebKit completion: "All together, the last confirm…" in `answering-flow-completion.browser.ts`, logging `send, heading, panel`. If it still fails after 2.3, `useHeadingFocus` keeps the panel request while focus is the acted card's heading or `body` (D4). Verify: WebKit and File runs of the file pass.
  - Note: the log `send, panel` came from the per-frame sampling missing a heading focused for under a frame; the test now also records `focusin`. `useHeadingFocus` is unchanged.
- [x] 2.5 #243 (D5): first a unit case in `shell/document-update.test.ts` reproducing the browser state (one per view, no navigation, q1 deleted), red. Then set `inView` at the first render. Scenarios: The first question removed before any navigation; After a reload unchanged. Verify: unit green; File runs of `answering-flow-status` and `answering-flow-in-view` pass.
  - Note (deviation): the board already announces. The probe shows the region reads "Question removed by the agent: Database.", since `answeringAsk`'s q1 has the header "Database" since #232; the test expected "Q1". The test's expectation is fixed; no unit case or first-render change (D5's premise does not hold).
- [x] 2.6 #241's cause (D9): a browser case first, red in Chromium: "Next to do" pressed and released 300 ms apart on a fresh board goes to q1. Then `useQuestionInView` ignores a `focusin` outside every card. Verify: the case passes in Chromium; the four other #241 cases are run once each in Firefox and WebKit.

## 3. Investigate, then fix (#240, #239, Firefox)

- [x] 3.1 Probe Firefox's Tab path (D6): Firefox runs of `tree-editing.browser.ts` and `lifecycle-keyboard.browser.ts`, logging each stop from a Tree heading and from the header for 130 presses. Tests: none (probe). Verify: a note line names the extra or missing stops and the cause. A cause that needs a layout decision goes to #240 as a `needs-po` comment with D6's default.
  - Note: no extra or missing stop and no layout cause. Firefox, after a mouse click on a heading or when a Tab leaves the page past the last card, starts the next Tab at the top of the visible area (in the board, at the last card's note field, so the header, the rail and the outbox are not reached by wrapping); a programmatic `focus()` on the heading keeps Tab's start. The Tab order is the same in both engines (header, outline, outbox, cards); the rail precedes the content in the DOM in both, so no PO question.
- [x] 3.2 Fix #240 where 3.1 found the cause (D6). First browser cases listing the Tab stops, red in Firefox: from a Tree heading to the Tree (`tree-keys.browser.ts`), and from the header to the delivery switch (`lifecycle-keyboard.browser.ts`). Scenarios: Tab from a heading to its widget in each engine; Tab reaches the delivery switch in each engine. Verify: the case passes in Firefox and File runs; Firefox runs of `tree-editing`, `approval`, `wbs-linking` and `lifecycle-keyboard` pass.
  - Note: a harness fix only: `tabIntoTree` focuses the heading instead of clicking it; `lifecycle-keyboard` starts its Tab to the delivery switch at the header's Keys button (`tabFromHeader`). The two new cases are the heading to the Tree and the header to the delivery switch. `wbs-linking` in Firefox then shows `Page crashed` on 26 of its 33 cases on this Mac (Firefox's crashes, #174), which the Tab failure hid.
- [x] 3.3 Probe #239 (D7): in a Firefox run of `answering-flow-fit.browser.ts` (it-IT comfortable), record a screenshot of the ask row, each pill's computed `display`, `text-overflow` and widths, and the `bdi`s' `scrollWidth` and `clientWidth`. Tests: none (probe). Verify: a note line says which reading of D7 holds.
  - Note: D7's first reading holds. Each `bdi` is `display: inline` (clientWidth 0, Firefox's scrollWidth 40, 55, 266) inside a `truncate` block pill with `text-overflow: ellipsis`, whose own scrollWidth equals its clientWidth or is clipped by the ellipsis.
- [x] 3.4 Fix #239 as 3.3 decides (D7): either `clipped` skips inline elements and measures the pill, with a case showing a real overflow still counted, or the ask row's `bdi`s take `truncate` and keep their isolation (AD-8). Scenario: The board's frame, Comfortable, in Italian. Verify: Firefox and File runs of `answering-flow-fit` and `answering-flow-frame` pass.
  - Note: `clipped` skips inline elements in the header and the rail; the new case adds a header box that really overflows, which is still counted. The outbox part of `clipped` is unchanged (#238).

## 4. Records and the train

- [ ] 4.1 `docs/as-built/e2e-stabilise-answering-flow.md`: what was fixed and where, the names added (`workOf`, the moved `pickTheme`, `revealAndFocus`'s `resolve` and deadline), the causes 2.1, 3.1 and 3.3 found, and no versions. EXPERIENCE.md and DESIGN.md change only if 3.2 changed the Tab order. Tests: none. Verify: every name the note cites is found with `git grep -nwF`.
- [ ] 4.2 The check: `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`, and `bun run build:view --record-sizes` only if `shell` moved. Tests: the whole check. Verify: it passes; the size of `shell` is recorded if it changed.
- [ ] 4.3 Rebase onto `origin/main` before the pull request, re-check D8's names, and `npx --yes @fission-ai/openspec@2.0.0 validate --all --strict --no-interactive`. Verify: all pass; the note gives main's SHA.
- [ ] 4.4 The train on the branch (AGENTS.md, CI): push, then `gh workflow run e2e.yml --ref worktree-fix-e2e-stabilise -f cadence=nightly`. Read the conclusion and each failure from the run's artifacts. Tests: the full three-engine suite on CI. Verify: no failure of #236, #237, #239 to #243 remains. Any other failure is matched to an open Issue or filed as `source:e2e` (`askboard-backlog`), and listed in the pull request body.

## Workflow follow-up

- The pull request body says `Closes #236`, `Closes #237`, `Closes #239`, `Closes #240`, `Closes #241`, `Closes #242` and `Closes #243`, the train's run and its result, and what is left for the PO (#238, and any #240 question).
- Archive this change only after its pull request has merged.
