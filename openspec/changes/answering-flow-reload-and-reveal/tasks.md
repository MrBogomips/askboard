# Tasks

One implementer runs the groups in order. Group 1 (the restore, #250) and group 2 (the move, #259) touch different files and depend only on group 0, so they could run in parallel. Group 3 follows both. Each task writes its tests first and sees them fail for the right reason. Commit bodies say `Refs #250`, `Refs #259`, or both.

Terms:
- **"File run"**: `ASKBOARD_E2E_ENGINES=<engine> ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/<file>`, run after `bun run build`. The engine is Chromium unless the task names another. CI's smoke run and the train on the branch check every engine.
- **"Dn"**: a decision in design.md.

## 0. Base

- [x] 0.1 Check the borrowed names listed under design.md, merge points: `git grep -n <name> origin/main -- packages` for each. Tests: none. Verify: a note gives each name's file. A missing name stops the work for `/openspec-update-change`.
- [x] 0.2 Probe D3. In each engine, press the mouse on the view's viewport scrollbar (x = `innerWidth` − 4, at mid-height) of a tall board, and record whether a `pointerdown` reaches the view's window. Tests: none (probe, not committed). Verify: a note gives the answer per engine. An engine with none goes into the as-built note as the accepted residual.
  - Note: 0.1: all names found on main (files as design.md lists them). 0.2: unknown. The probe had no scrollbar to press: Playwright's headless Chromium hides scrollbars (`--hide-scrollbars`) and headless Firefox and WebKit on macOS draw overlay ones, so the `pointerdown` they delivered at the scrollbar's x came from the page, not from a scrollbar. Follow-up: #270.

## 1. A restored answer is not a revision (`shell/board-draft.ts`, #250)

- [x] 1.1 Unit tests first in `shell/board-draft.test.ts` (D1, D5), restoring with a state that logs the Tree answer:
  - a record whose widget values equal the answer: no work, no value;
  - one more renamed node: kept;
  - an extra item's value: kept;
  - equal values plus an entry: kept;
  - an earlier revision: kept;
  - the existing choice-only stale case: unchanged.

  Scenarios: A reload while the mirror still holds the sent Tree, A revision restored as one. Verify: red on the first case only.
- [x] 1.2 In `isRestoredAnswer`, split the record's `values` into the question's own labels and the widget values, and compare the widget values with `status.answer.values ?? {}` by `sameJson` (D1). Update `restoreDraft`'s doc comment. Tests: 1.1. Verify: 1.1 green; every `board-draft*.test.ts` and `answer-state.test.ts` case green.
- [x] 1.3 In `widget-answered.browser.ts`, add a case (D5): rename, wait with `mirrored` for a record holding the renamed Tree, press "Answer", reload as soon as the receipt reads "sent". Expect the receipt "sent", the stripe not `draft`, the renamed name read-only, then "delivered to the agent" after `collect`. Remove #250's entry from `known-failures.json`. Scenarios: A reload while the mirror still holds the sent Tree, A takeover in that state. Verify: File run in Firefox red before 1.2 and green after; File run in Chromium green; `bun test packages/view/test/browser/harness` green.
  - Note: review S-2: a second case opens a takeover tab after the mirror held the renamed Tree and the receipt read "sent"; the reload case is the deterministic one in Firefox.

## 2. The user's scroll during the move (`shell/reveal.ts`, #259)

- [x] 2.1 Unit tests first in `shell/reveal-smooth.test.ts` (D2, D5). Give the stand-in window `addEventListener`, `removeEventListener` and a dispatch. Cases:
  - a drift with no input re-plans and lands 8 px under the inset;
  - a drift after `wheel`, `touchstart`, `pointerdown` or `keydown` Tab stops the move with no landing;
  - a drift after focus left the target stops it;
  - a repeated `keydown` does not count;
  - every listener is removed at the end;
  - the two existing user-scroll cases dispatch `wheel` first.

  Scenarios: The browser's smooth scroll still runs, The user's wheel during the move, A focus moved during the move. Verify: red for the re-plan and the listeners.
- [x] 2.2 Implement D2 in `revealAndFocus` and `scrollSmoothly`:
  - an input watch per move, removed in `finish`;
  - the drift test (input, or focus off the target);
  - re-planning over the time left of `SCROLL_MS`, at least one frame;
  - the same test in `finish` for `land`.

  Keep the `overflow-anchor` hold (D4). Update the file's comments. Tests: 2.1. Verify: 2.1 and every `reveal*.test.ts` case green; 100% line coverage of `reveal.ts`.
- [x] 2.3 In `answering-flow-advance.browser.ts`, a describe "the move and the browser's own scroll" (D5):
  - the page starts its own smooth scroll, then Enter after 20 ms: q4's card 8 px (±2) under the header, heading focused;
  - `page.mouse.wheel` right after Enter: `scrollY` is unchanged between 300 ms and 1 s after;
  - focus moved to another heading during the move: the move stops and that heading keeps focus.

  `standingStill` stays for the other cases. Scenarios: as 2.1. Verify: File run in WebKit red before 2.2 on the first case, green after; File run in Chromium green.
  - Note: review S-1: the wheel and focus cases now expect q4's card not 8 px under the header, the page unchanged between 500 ms and 1 s after a wheel of -600 px, and q1's heading in the viewport. With the wheel/halt handling and the focus clause of `isUsers` removed, both were red in Chromium, Firefox and WebKit; green with them restored. The first form of the wheel case exposed a defect in 2.2: in Firefox and WebKit a frame's `scrollTo` right after a wheel event aborted the wheel's own scroll before the page position showed it, so the move went on. A wheel, a touch or a scrolling key now halts the move at its next frame with no landing (`Move.halt`); a pointer press alone still waits for a drift. Unit cases added in `reveal-smooth.test.ts`.
  - Note: train 43926789415 (WebKit): `answering-flow-in-view` and `answering-flow-focus` cases scrolled the page by script (`scrollBy`) while an earlier move still ran, which stood for the user's scroll under the old rule and is now the browser's own (D2). Those cases now scroll through `userScrollBy` (`harness/lifecycle-test.ts`: a `wheel` event, then the scroll). Both files were red in WebKit locally before, green after.

## 3. Documents and record

- [x] 3.1 EXPERIENCE.md (D6):
  - "After an answer": one sentence. A scroll the user makes during the move (wheel, touch, a press, a key that scrolls or moves focus) ends it where it is; a scroll the browser makes on its own does not.
  - "What a reload keeps": an answered question comes back answered with its receipt, even when the record still held its sent work.

  Verify: the wording matches the two requirement names of the delta spec.
- [x] 3.2 `docs/as-built/answering-flow-reload-and-reveal.md`:
  - what was built and where (D1, D2), with the diagnosis in one paragraph citing design.md;
  - the seams added: none exported, or the names 2.2 adds;
  - no versions bound;
  - 0.2's per-engine result and the accepted residual.

  Verify: `grep -l "answering-flow-reload-and-reveal" docs/as-built/` finds it; `bun run check:agent` passes.

## Workflow follow-up

- The change alters the reveal and how an answered card is restored: dispatch a train on the branch before merge (`gh workflow run e2e.yml --ref worktree-fix-reload-receipt-and-reveal -f cadence=nightly`). Triage its new failures as AGENTS.md, CI says. #250's test must pass in all three engines there.
- design.md's Open Question 1 (Firefox loses the `pagehide` flush) is Issue #269, "Firefox: the board's last draft save before a reload never reaches the server".
- Archive after the pull request is merged.
