# As built: `answering-flow-reload-and-reveal`

In code since `answering-flow-reload-and-reveal` (Issues #250 and #259): an answered widget question comes back answered after a reload, and the move After an answer lands when only the browser scrolled the page. No contract, protocol, key table, version or chunk boundary changed; both fixes stay in `packages/view/src/shell`.

**Diagnosis.** #250: `isRestoredAnswer` (`board-draft.ts`) dated from before widget answers and returned false for any record holding a value other than the question's option labels, so a mirrored sent Tree was restored as a revision (the card read Draft) whenever the mirror still held it after the answer: under load, or in Firefox, which loses the `pagehide` flush. #259: a drift of the page's position during the move was always read as the user's scroll, so a smooth scroll the browser or page had started itself ended the move short. Details and the evidence: `openspec/changes/answering-flow-reload-and-reveal/design.md`.

**What was built and where.**
- `shell/board-draft.ts`: `isRestoredAnswer` splits the record's values into the question's own labels and the widget values, and compares those with the logged answer's `values` by `sameJson` (D1).
- `shell/reveal.ts`: `watchInput` (passive capture listeners on the window for `wheel`, `touchstart`, `pointerdown` and `keydown` of ArrowUp, ArrowDown, PageUp, PageDown, Home, End, Space, Tab, ignoring repeats), `isUsers` (a wheel, a touch or a listed key (`SCROLLING_KEYS`, Tab included) also halts the move at its next frame, since a frame's own `scrollTo` right after the event aborted the engine's pending scroll in Firefox and WebKit; a drift is the user's after such input or when focus left the target) and re-planning in `scrollSmoothly` over the time left of `SCROLL_MS`; `land` uses the same test (D2). The `overflow-anchor` hold stays (D4).

**Tests.** Unit: `board-draft.test.ts` (the stale widget answer cases), `reveal-smooth.test.ts` (re-plan, input, focus, listeners; `reveal.ts` at 100% lines). Browser: `widget-answered` (the mirror holding the sent Tree, red before the fix in Firefox only), `answering-flow-advance` ("the move and the browser's own scroll": red before the fix in Firefox and WebKit on the page-started smooth scroll). #250's entry left `known-failures.json`.

**Seams added.** None exported.

**The pointer on a scrollbar (D3).** Unknown: the probe had no scrollbar to press. Playwright's headless Chromium hides scrollbars, and headless Firefox and WebKit on macOS draw overlay ones, so whether a press on a classic scrollbar dispatches `pointerdown` is not shown. Where none arrives, a drag starting within a move's 282 ms is corrected until the landing. Follow-up: #270.

**What only CI shows.** The train on the branch (`e2e.yml`, nightly cadence) for the Linux runner, where #259 shows. Open: Firefox loses the board page's `pagehide` flush (design.md, Open Question 1), Issue #269.
