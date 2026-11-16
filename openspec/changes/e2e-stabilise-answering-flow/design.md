# Design

## Context

The train run 43834178556 on `main` ddf90ae8 left about 220 failures. The triage digest groups them by root cause, one Issue per root (proposal.md, Why). Three kinds of cause:

1. **Tests written for the frame before the redesign** (#236, #237, the Chromium and Firefox part of #242). The board behaves as `answering-flow-visual` designed it, and these tests still assume the older frame. Each section below names its harness seam on `main`:
   - The draft record now always carries the short numbers ("Draft mirror and restore"), so `expect(run.drafts).toEqual([])` fails at 30 sites in 12 files.
   - The Theme radios are inside the Theme popover (`themeControl`, `data-askboard-theme`).
   - Header row 2 is the progress row (`progressRow`, `data-askboard-progress-row`).
   - Key caps sit inside the main buttons, and `labelText` in `harness/lifecycle-test.ts` reads a label without them.
   - Ten Tabs from the board's opening focus no longer reach the Gantt (`tabIntoGrid` in `fixtures/gantt-input.ts`).
   - it-IT names Shift "Maiusc" off macOS (`key.shift`).
   - The arrival mark lives `ARRIVAL_MS` (1,200 ms) and the test looks for it after about a second of waits.
2. **The board in Firefox and WebKit** (#241, the WebKit part of #242, #243). These are focus and announcement duties of the answering flow that pass in Chromium, or fail everywhere (#243).
3. **Causes not yet known** (#240, #239), both Firefox only.

Constraints: no full or multi-engine suite runs locally (AGENTS.md, CI). An engine-specific defect is reproduced with a File run of the failing file in that engine, which is not a suite run. The rest is checked in Chromium, and by the train dispatched on the branch before merge. No contract, protocol, key table or chunk boundary changes. ADs relied on: AD-1 (imports), AD-8 (the `bdi` isolation stays), AD-10 (no announcement says more than is true).

## Goals / Non-Goals

**Goals:**
- Every failure of the seven Issues passes in the train on the branch.
- Each product defect is fixed in the board, with a unit or browser test that fails without the fix.

**Non-Goals:**
- #238, the outbox's Italian label, which waits for the PO.
- #244, a perf flake.
- #174, Firefox's crashes.
- Any test whose failure the train did not show.
- Any change to the answering flow's design.

## Decisions

### D1. A draft that holds no work (#236)

`harness/draft-results.ts` gains `workOf(drafts)`. It returns the questions of the latest draft record that hold work (an answer, a result, a note, a held act or a change). Each of the 30 sites asserts `workOf(run.drafts)` equal to `[]` in place of `run.drafts` equal to `[]`. A unit test, `harness/draft-results.test.ts`, pins `workOf`:
- empty for no draft;
- empty for a record of numbers alone;
- non-empty for each kind of work.

*Alternative:* filter number-only drafts out of `run.drafts` in the host. Rejected: it would hide the mirror the spec requires, and other tests read its order.

### D2. The frame's locators (#237)

- **Theme.** `pickTheme(board, name)` moves into the harness (`harness/dom.ts`). It opens the Theme popover only when the radio is hidden. `palettes` (#235) adds it to `chart-theme.browser.ts`; this change moves that function, never a second copy. It is then used by `chart-snapshot.browser.ts`, on the Snapshot page with the same popover, and by `icons.browser.ts`.
- **Header row 2.** `languages.browser.ts` measures `board.progressRow`. The test name becomes "the progress row in Italian fits the 1280 px viewport with no overflow".
- **Key caps.** `icons.browser.ts:173` and `table.browser.ts:199` read the label with `labelText`. A key cap is not part of a label; the accessible name already passes.
- **The Gantt.** `tabIntoGrid` starts as `tabIntoTree` does: a click on the question's heading, then at most ten Tabs. Its WebKit rule for Shift+Tab stays.
- **Shift in it-IT.** `board-keys.browser.ts:539` builds its expectation from the catalog: `key.shift` of the ask's language, and `⇧` on macOS. It no longer admits a hand-written list.

### D3. The arrival mark is read when it is there (#242, Chromium and Firefox)

`answering-flow-motion.browser.ts` starts watching for the mark before the act. A `MutationObserver` installed in the view records when `data-askboard-arrived` is set on the target card and when it is removed. The test then asserts three things:
- the mark was set within one frame of the move;
- its animation name is `none` under `reduce`;
- it was removed between 1,000 and 2,000 ms after it was set (the bound allows a loaded runner).

The position checks keep their order. This holds for both cases of the file.

### D4. The focus move ends where it was asked to (#241, #242 in WebKit)

`revealAndFocus` (`shell/reveal.ts`) gives focus at once, then scrolls. It runs the smooth path by `requestAnimationFrame`, and the reduced-motion path by one `setTimeout` settle. It ends correctly only when three things hold, and the failures show they do not hold in Firefox and WebKit:
- the frames run;
- the element it was given is still the target's node;
- the instant `scrollBy` lands where `revealDelta` said.

Two cases show this. In Firefox and WebKit, focus never reaches the heading within 5 s. In WebKit under `reduce`, the heading ends 67 px below the foot.

The decision: **one end of move that always runs**. Task 2.1 confirms the cause first.
- `revealAndFocus` takes an optional `resolve: () => HTMLElement | null`. The heading callers pass `() => document.getElementById(questionTextId(id))`.
- One deadline timer fires at `SCROLL_MS + 2 × FRAME_MS` (282 ms), cleared at the next move. It ends the move if the frames have not: cancel the frame, scroll to the frames' last position, settle.
- **Settle** re-resolves the target. If focus is on `body`, or on a node no longer in the document, it re-focuses the resolved target with `preventScroll`. Then it scrolls by `revealDelta` with `behavior: "instant"`. If an engine ignores `"instant"`, which task 2.1 checks, settle uses `scrollTo({top})` without a behavior instead. A user who moved focus or scrolled meanwhile keeps the focus and the scroll (`|scrollY − last| > 2` as today).
- The reduced-motion path uses the same deadline in place of its own timer.

Unit tests extend `reveal-smooth.test.ts`'s stand-in window:
- frames that never run;
- a target node replaced before settle;
- focus that fell to `body`;
- a user scroll during the move, where nothing is re-focused;
- `"instant"` ignored.

The browser cases are the failing ones of #241 and #242, run in Firefox and WebKit File runs during the task, then in the train.

*Alternatives:*
- Listen for `scrollend`. Rejected: WebKit does not fire it, and it never fires when no scroll happens.
- Native `scrollIntoView({behavior: "smooth"})`. Rejected for the guidance change's reasons (its D4: the duration is the engine's).

**WebKit completion** (#241's "send, heading, panel"). The panel request (`useHeadingFocus`'s waiting effect) is dropped when the active element is outside the acted card. After D4, focus stays on the heading through settle. Task 2.2 checks the case, and changes the wait only if it still fails: it keeps the request while the active element is the acted card's heading or `body`.

### D5. The question shown is known from the first render (#243)

`onRemoval` (`shell/document-update.ts`) announces only when `stores.shownQuestion()` names a removed question. In one question per view, `shownQuestionOf(before, board.get().inView)` falls back to the first question when `inView` is unset. The train shows no announcement before any navigation in all three engines, so something on the first render differs from that reading. The candidates are an `inView` set to a question that is not shown, or a `before` document that does not hold the question yet.

Task 2.3 confirms which with a unit test in `document-update.test.ts`, built from the browser case's state. Then the board sets `inView` once at the first render of a one-per-view board to `shownQuestionOf(document, undefined)`. That is the same rule the jumps use, so `shownQuestion` and the navigator agree from the first frame. The fix does not touch the reload rule ("The question in view", After a reload): a restored `inView` wins.

### D6. Firefox's Tab path (#240): probe, then fix where the cause is

Task 3.1 runs `tree-editing.browser.ts` and `lifecycle-keyboard.browser.ts` in Firefox. A probe logs `document.activeElement` (tag, role, hook, `tabIndex`) after each Tab:
- from a Tree question's heading;
- from the header through 130 presses.

Expected leads:
- Firefox makes a scrolling box a Tab stop (the rail's outline, the ledger, the main column). The view loses focus to the board page and cycles there.
- The rail precedes the content column in the DOM.

The fix follows the cause:
- A scrolling box with focusable children takes `tabIndex={-1}` only if the probe shows it as a stop. The outline's entries stay reachable.
- A focus that leaves the frame is a harness matter: the test's start point.
- An order defect becomes a DOM order fix. That is a frame change, so DESIGN.md's rail row is checked.

The spec's two "Keyboard core" scenarios are the bar, and the train is the check. If the probe finds a cause that needs a layout decision (moving the rail after the content), task 3.2 stops. That decision goes to the PO on #240 with the default "the content column first in the Tab order, the rail after it".

### D7. Firefox's clipped `bdi` (#239): probe, then fix where the cause is

`clipped` in `answering-flow-fit.browser.ts` counts an element whose `scrollWidth > clientWidth + 1`. The ask row's `bdi` elements are inline. For an inline box, `clientWidth` is 0 by CSSOM, and Firefox reports a `scrollWidth` where Chromium and WebKit report 0. Task 3.3 looks at the Firefox render: a screenshot of the ask row at it-IT comfortable, plus the pills' computed `text-overflow` and widths.
- **Ellipsis present** (the expected lead): `clipped` measures only elements whose computed `display` is not `inline`. The parent pill, which carries the ellipsis, is what counts.
- **Text cut without an ellipsis:** the pill's `bdi` takes `truncate` (block-level, `min-w-0`) in `ask-row.tsx`, keeping its isolation (AD-8), and the fit test stays as it is.

### D8. Merge points and records

- **`palettes` (#235)** merges first. It touches `chart-theme.browser.ts` (its `pickTheme`), `harness/dom.ts`, `theme-control.tsx`, `snapshot-session.browser.ts` and `suites.ts`. Task 0.1 rebases onto it once merged. Group 1's Theme task moves palettes' `pickTheme` and does not write its own. The rebase before the pull request (task 4.3) re-checks the names below.
- **`early-benchmark`**: none (`packages/bench`).
- **Borrowed from `main`** (task 0.2 records file and line):
  - shell and contract: `revealAndFocus`, `revealDelta`, `SCROLL_MS`, `FRAME_MS`, `ARRIVAL_MS`, `onRemoval`, `shownQuestionOf`, `questionTextId`, `useHeadingFocus`, `key.shift`;
  - harness: `labelText`, `tabTo`, `tabIntoTree`, `tabIntoGrid`, `draftResultOf`, `themeControl`, `progressRow`, `clipped`.
- **Versions**: none. **Keys**: no key table is touched; `keys-coverage.test.ts` is unaffected (no widget's keys change).
- **Chunks**: `shell` grows by the deadline and the first-render line, well inside its 10%.
- **Records**: `docs/as-built/e2e-stabilise-answering-flow.md`. EXPERIENCE.md and DESIGN.md change only if D6 changes the Tab order.

## Risks / Trade-offs

- [The deadline re-focuses a target the user just left] → re-focus only when focus is on `body` or a detached node; a user scroll stops the move as today.
- [D4's cause differs from the lead] → task 2.1 probes before the fix. The unit tests pin the end state, whatever the cause.
- [File runs in Firefox and WebKit on a Mac differ from the Linux runner] → WebKit needs keyboard navigation on (AGENTS.md, CI). The train on the branch is the deciding run.
- [palettes moves the Theme seam again] → task 0.1 runs after its merge, and 4.3 re-checks.
- [D6 needs a layout decision] → it stops at a `needs-po` question with a default, and the other Issues go ahead.

## Migration Plan

None. The board reads and writes the same records.
