# Tasks

The groups run in order with one implementer. Each task writes its tests first and sees them fail for the right reason.

Terms used below:
- **"File run"**: `ASKBOARD_E2E_ENGINES=chromium ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/<file>` after `bun run build`.
- **"Firefox run" and "WebKit run"**: the same command with that engine alone. They are used only to reproduce and check this change's engine-specific defects (design.md, Context). On a Mac, WebKit needs keyboard navigation on.
- **"Dn"**: a decision in design.md.

Commit bodies say `Refs #n` for the Issues each group touches.

## 0. Base

- [ ] 0.1 `palettes` (#235) first: once it has merged, `git rebase origin/main` and `./setup.sh --no-codex`. Its `pickTheme` (`chart-theme.browser.ts`), `harness/dom.ts` and `theme-control.tsx` are the base of task 1.2 (D8). Tests: none. Verify: `git log origin/main` holds #235, and `git grep -n "const pickTheme" -- packages/view/test/browser` finds one definition.
- [ ] 0.2 Borrowed names (D8): `git grep -n <name> origin/main -- packages` for each name D8 lists. Tests: none. Verify: the note gives each name's file and line. A missing name, or one whose shape changed, stops the work for `/openspec-update-change`.

## 1. Tests written for the frame before the redesign (#236, #237, #242 in Chromium and Firefox)

- [ ] 1.1 `workOf(drafts)` in `harness/draft-results.ts` (D1). Unit cases first in `harness/draft-results.test.ts`: no draft, numbers alone, and each kind of work. Then replace the 30 `run.drafts` equal to `[]` assertions in the 12 files #236 lists. Verify: unit red, then green; File runs of `kanban`, `timeline`, `document-review`, `chart`, `table` and `tree-coherence` pass.
- [ ] 1.2 Move palettes' `pickTheme` into `harness/dom.ts` (D2) and use it in `chart-theme`, `chart-snapshot` (Snapshot page) and `icons` ("each icon takes the text colour… light/dark theme"). Tests: those cases. Verify: File runs of the three files pass; `git grep -n "const pickTheme"` finds the harness's alone.
- [ ] 1.3 `languages.browser.ts` measures `board.progressRow`; the test is renamed "the progress row in Italian fits the 1280 px viewport with no overflow" (D2). Verify: a File run passes in the de-DE/America/Adak and de-DE/Pacific/Kiritimati configurations.
- [ ] 1.4 Labels without key caps: `icons.browser.ts:173` (the jump in en-US and it-IT) and `table.browser.ts:199` read through `labelText` (D2). Verify: File runs of `icons` and `table` pass; the accessible-name assertions are unchanged.
- [ ] 1.5 `tabIntoGrid` (`fixtures/gantt-input.ts`) clicks the Gantt question's heading, then presses Tab at most ten times; the Shift+Tab rule stays (D2). Tests: `gantt-plan` and `gantt-plan-duration`. Verify: File runs of both, and of every other file that calls `tabIntoGrid`, pass.
- [ ] 1.6 `board-keys.browser.ts:539` expects the catalog's `key.shift` for the ask's language, or `⇧` on macOS (D2). Verify: a File run passes; the test fails when given a wrong expectation by hand.
- [ ] 1.7 `answering-flow-motion.browser.ts`: a `MutationObserver` installed before the act records when the mark is set and removed (D3). Scenarios: Reduced motion, No preference. Verify: File and Firefox runs pass three times in a row; the WebKit position failure is left to 2.3.

## 2. The board's focus move and first render (#241, #242 in WebKit, #243)

- [x] 2.1 Probe (D4). Firefox and WebKit runs of `answering-flow-focus.browser.ts` and `answering-flow-motion.browser.ts`, with a temporary log of the frames run, the active element at settle, whether the node was replaced, and `scrollY` before and after the instant `scrollBy`. Tests: none (probe). Verify: one note line per engine with the cause. The log is not committed.
  - Note: no failure reproduces idle on this Mac; with the idle run Firefox fails about one run in ten, never in the frames. The failing first `Next to do` click lands on q2, not q1 (it-IT, Chromium and Firefox alike): the mouse-down focuses the button, `focusin` sets the question in view to q1 (it crosses the reading line), and a click a frame later goes to the question after it. Not a lost focus. A motion probe found no engine that skips frames.
- [x] 2.2 Unit tests first in `shell/reveal-smooth.test.ts` (D4): frames that never run end the move at the deadline; a replaced node is re-resolved and focused; focus on `body` is restored; a user scroll or focus move during the move is kept; `"instant"` ignored still lands. Verify: red for the right reason against the current `reveal.ts`.
- [x] 2.3 Implement the deadline, `resolve` and settle of D4 in `reveal.ts`; the heading callers in `board.tsx` and `question-card.tsx` pass `resolve`. Scenarios: A jump in each engine, Reduced motion in each engine. Verify: 2.2 is green with 100% line coverage of `reveal.ts`; #241's and #242's cases pass in Chromium, Firefox and WebKit runs.
- [x] 2.4 WebKit completion: "All together, the last confirm…" in `answering-flow-completion.browser.ts`, logging `send, heading, panel`. If it still fails after 2.3, `useHeadingFocus` keeps the panel request while focus is the acted card's heading or `body` (D4). Verify: WebKit and File runs of the file pass.
  - Note: the log `send, panel` came from the per-frame sampling missing a heading focused for under a frame; the test now also records `focusin`. `useHeadingFocus` is unchanged.
- [x] 2.5 #243 (D5): first a unit case in `shell/document-update.test.ts` reproducing the browser state (one per view, no navigation, q1 deleted), red. Then set `inView` at the first render. Scenarios: The first question removed before any navigation; After a reload unchanged. Verify: unit green; File runs of `answering-flow-status` and `answering-flow-in-view` pass.
  - Note (deviation): the board already announces. The probe shows the region reads "Question removed by the agent: Database.", since `answeringAsk`'s q1 has the header "Database" since #232; the test expected "Q1". The test's expectation is fixed; no unit case or first-render change (D5's premise does not hold).

## 3. Investigate, then fix (#240, #239, Firefox)

- [ ] 3.1 Probe Firefox's Tab path (D6): Firefox runs of `tree-editing.browser.ts` and `lifecycle-keyboard.browser.ts`, logging each stop from a Tree heading and from the header for 130 presses. Tests: none (probe). Verify: a note line names the extra or missing stops and the cause. A cause that needs a layout decision goes to #240 as a `needs-po` comment with D6's default.
- [ ] 3.2 Fix #240 where 3.1 found the cause (D6). First browser cases listing the Tab stops, red in Firefox: from a Tree heading to the Tree (`tree-keys.browser.ts`), and from the header to the delivery switch (`lifecycle-keyboard.browser.ts`). Scenarios: Tab from a heading to its widget in each engine; Tab reaches the delivery switch in each engine. Verify: the case passes in Firefox and File runs; Firefox runs of `tree-editing`, `approval`, `wbs-linking` and `lifecycle-keyboard` pass.
- [ ] 3.3 Probe #239 (D7): in a Firefox run of `answering-flow-fit.browser.ts` (it-IT comfortable), record a screenshot of the ask row, each pill's computed `display`, `text-overflow` and widths, and the `bdi`s' `scrollWidth` and `clientWidth`. Tests: none (probe). Verify: a note line says which reading of D7 holds.
- [ ] 3.4 Fix #239 as 3.3 decides (D7): either `clipped` skips inline elements and measures the pill, with a case showing a real overflow still counted, or the ask row's `bdi`s take `truncate` and keep their isolation (AD-8). Scenario: The board's frame, Comfortable, in Italian. Verify: Firefox and File runs of `answering-flow-fit` and `answering-flow-frame` pass.

## 4. Records and the train

- [ ] 4.1 `docs/as-built/e2e-stabilise-answering-flow.md`: what was fixed and where, the names added (`workOf`, the moved `pickTheme`, `revealAndFocus`'s `resolve` and deadline), the causes 2.1, 3.1 and 3.3 found, and no versions. EXPERIENCE.md and DESIGN.md change only if 3.2 changed the Tab order. Tests: none. Verify: every name the note cites is found with `git grep -nwF`.
- [ ] 4.2 The check: `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`, and `bun run build:view --record-sizes` only if `shell` moved. Tests: the whole check. Verify: it passes; the size of `shell` is recorded if it changed.
- [ ] 4.3 Rebase onto `origin/main` before the pull request, re-check D8's names, and `npx --yes @fission-ai/openspec@2.0.0 validate --all --strict --no-interactive`. Verify: all pass; the note gives main's SHA.
- [ ] 4.4 The train on the branch (AGENTS.md, CI): push, then `gh workflow run e2e.yml --ref worktree-fix-e2e-stabilise -f cadence=nightly`. Read the conclusion and each failure from the run's artifacts. Tests: the full three-engine suite on CI. Verify: no failure of #236, #237, #239 to #243 remains. Any other failure is matched to an open Issue or filed as `source:e2e` (`askboard-backlog`), and listed in the pull request body.

## Workflow follow-up

- The pull request body says `Closes #236`, `Closes #237`, `Closes #239`, `Closes #240`, `Closes #241`, `Closes #242` and `Closes #243`, the train's run and its result, and what is left for the PO (#238, and any #240 question).
- Archive this change only after its pull request has merged.
