# Tasks

One implementer runs the groups in order. Groups 1 (the alignment) and 2 (the mark) touch different files and depend only on group 0, so they could run in parallel. Group 3 follows both. Each task writes its tests first and sees them fail for the right reason. Commit bodies say `Refs #256`.

Terms:
- **"File run"**: `ASKBOARD_E2E_ENGINES=chromium ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/<file>` after `bun run build`. It runs in Chromium only. CI's smoke run and the train on the branch check the other engines.
- **"Dn"**: a decision in design.md.

## 0. Base

- [x] 0.1 Record the PO's answer on D2 (the anchor: the card's top, the default, or the heading's top), asked on #256 with `needs-po`. If the answer is the heading, run `/openspec-update-change` first: one branch of D1 and the spec's "card top" wording change. Tests: none. Verify: a note line here quotes the answer and its date; `needs-po` is off #256.
  - Note: The PO answered on 2026-11-16: the card's top, the proposed default; no artifact changes. `needs-po` is the coordinator's to clear on #256.
- [x] 0.2 Borrowed names (design.md, merge points): `git grep -n <name> origin/main -- packages tools` for each name listed there. Then grep the browser files for "has not scrolled" and `scrollY` equality after a move that goes on (D7). Tests: none. Verify: a note gives each name's file, and lists each assertion found with its fate. A missing name stops the work for `/openspec-update-change`.
  - Note: every borrowed name exists on origin/main 9d3be635: `revealAndFocus`, `revealDelta`, `REVEAL_GAP`, `SCROLL_MS`, `FRAME_MS`, `ARRIVAL_MS`, `MOVE_DEADLINE_MS`, `scrollFrames` in `shell/reveal.ts`; `measureBoardInset` in `shell/measure-inset.ts`; `requestHeading`, `HeadingRequest.smooth` in `shell/heading-request.ts`; `useHeadingFocus` in `shell/board.tsx`; `CONTRAST_PAIRS`, `contrastReport` in `tools/build/contrast.ts`; `guidanceAsk` in `test/browser/fixtures/guidance-asks.ts`, `answeringAsk` in `fixtures/answering-flow-asks.ts`; `expectBetweenBars`, `arrivedAt` in `answering-flow-advance.browser.ts`, `watchArrival`, `arrivalOf` in `answering-flow-motion.browser.ts`. `scrollY` equality: `answering-flow-advance.browser.ts` Stay here (taken before Continue: stays); `answering-flow-motion.browser.ts` reduced-motion case, which asserts the position after a move (becomes the card top at 8 px, task 2.3); the other `scrollY` reads (focus, in-view, progress) are reads, not equalities after a move that goes on.
- [x] 0.3 Fixture probe for "A question already in view": at 1280×800 with sections, measure in Chromium whether `guidanceAsk(4)`'s question 2 card can reach 8 px under the banner (the page's scroll range). Otherwise pick the smallest count that can. Tests: none (probe). Verify: a note gives the count and the measured scroll range; the probe code is not committed.
  - Note: `guidanceAsk` cards are 420 px tall at 1280×800 and question 2 starts at 549 px under a 97 px header, so no count makes the whole card fit with the page at its top (scroll ranges 1056, 1928, 2800 for 4, 6, 8 prompts). Question 2's heading is in view, which is what the least scroll left still; 1.6 asserts that (a gap between the spec's "wholly in view" and the fixture, reported). The probe is not committed.

## 1. The move to the top (`shell/reveal.ts`, `shell/board.tsx`)

- [x] 1.1 Unit tests first in `shell/reveal.test.ts` for `alignDelta` (D1, D4): a card below the bars, wholly in view, above them, past the page's end (clamped to the end), taller than the span, and a page that cannot scroll (0). Scenarios: A question already in view, The last question near the page's end, A card taller than the viewport. Verify: red because `alignDelta` is missing, then green after 1.2.
- [x] 1.2 Implement `alignDelta(target, inset, gap, scroll)` in `reveal.ts`, pure, beside `revealDelta` (D1). Tests: 1.1. Verify: 1.1 green; `revealDelta`'s cases unchanged and green.
- [x] 1.3 Unit tests first in `shell/reveal-smooth.test.ts`, with the stand-in window (D1, D4):
  - `align: "card"` moves the card's top to 8 px under the inset, smooth and instant;
  - `align: "page"` goes to 0;
  - the landing re-aligns after a card above changed height;
  - a user scroll during the move is kept;
  - the default stays the least scroll.

  Scenarios: A card above changes height during the move, The user scrolls during the move. Verify: red for the missing option.
- [x] 1.4 Implement `align` in `revealAndFocus` and `land` (D1, D3). The card is the target's closest `[data-askboard-question]`. Tests: 1.3. Verify: 1.3 and every existing `reveal-smooth` and `reveal` case green; 100% line coverage of `reveal.ts`.
  - Note: deviation: a smooth move holds `overflow-anchor: none` on the document until it ends. Scroll anchoring moved the page by 38 px when the answered card above grew back, the move read it as the user's scroll and stopped 350 px short of the place. Unit tests in `reveal-smooth.test.ts`.
- [x] 1.5 `useHeadingFocus` in `board.tsx` passes `align: "page"` in one question per view and `"card"` otherwise, only on a request with `smooth` (D1). Tests: 1.6. Verify: `bun run typecheck` clean; the non-smooth calls are unchanged (diff review).
- [x] 1.6 In `answering-flow-advance.browser.ts`, a describe "the move to the top" (D7). It measures the card's box against the banner or the strip (±2 px) and `scrollY`, waiting with `eventually`. Scenarios:
  - A question already in view (fixture from 0.3);
  - A question below the viewport;
  - Within a tab;
  - The last question near the page's end;
  - One question per view scrolled down;
  - A jump to a question in view keeps the page still ("Next to do").

  Verify: File run red before 1.5, then green.
- [x] 1.7 Existing cases in the same file: "Go to the next, in sections" asserts the card top at 8 px under the banner. "Stay here" also asserts it after "Continue"; its "page has not scrolled" stays before "Continue". Apply the fate of each assertion 0.2 found. Scenarios: Go to the next, Stay here. Verify: File run of `answering-flow-advance` green.

## 2. The arrival mark (`styles/motion.css`, `styles/forced-colors.css`, `tools/build/contrast.ts`)

- [ ] 2.1 A CSS unit test first, `styles/arrival.test.ts`, reading the sheets as `contrast.test.ts` does (D5):
  - the arrived card's rule is outside every `@layer`;
  - its selector is `[data-askboard-question][data-askboard-arrived]`;
  - it sets `var(--primary-subtle)` and `inset 4px 0 0 var(--primary)`;
  - the keyframes hold to 25% and end at `var(--card)`;
  - the duration is 1.2 s;
  - `forced-colors.css` sets a 3 px `Highlight` outline on it.

  Verify: red against today's sheet.
- [ ] 2.2 Rewrite the mark in `motion.css` (unlayered, the hold and fade of D5), keeping the reduced-motion rule as it is, and add the forced-colours outline to `forced-colors.css`. Update both sheets' header comments. Tests: 2.1. Verify: 2.1 green; `bun run build:view` within `chunk-sizes.json`, else `--record-sizes` and commit the file.
- [ ] 2.3 `answering-flow-motion.browser.ts`:
  - under reduce, the arrived card computes the `primary-subtle` background (resolved through a probe element) and a box shadow with a 4 px inset, with no animation;
  - with no preference, the animation is `askboard-arrival`, 1.2 s, and the first sample's background is `primary-subtle`;
  - the reduce scenario's position check becomes the card top at 8 px.

  Scenarios: The mark at rest under reduced motion, The mark animates, Reduced motion in each engine. Verify: File run red before 2.2, then green.
- [ ] 2.4 `palettes-forced-colors.browser.ts`: after a send with "Go to the next", the arrived card's outline is 3 px solid in the resolved `Highlight` and is gone after 1.2 s. Also "One mark at a time": two quick moves leave only the second card marked. Scenarios: Forced colours, One mark at a time. Verify: File run red before 2.2, then green.
- [ ] 2.5 Add the three pairs of D6 to `CONTRAST_PAIRS`, with cases in `tools/build/contrast.test.ts` asserting each pair meets its minimum in every palette and scheme. Scenario: Every palette. Verify: `bun test tools/build/contrast.test.ts` green; `bun tools/build/contrast.ts` prints the new rows.

## 3. Documents and record

- [ ] 3.1 DESIGN.md:
  - Motion: the move lands the card just under the bars; the mark is the fill and the 4 px edge, held, then faded; forced colours;
  - the "Arrival mark" row of the components table;
  - a `{components.arrival-mark}` token group (fill, edge, width, hold, duration);
  - the Contrast tables regenerated from 2.5.

  Verify: `bun run check` reads the tokens (`readDesignTokens` succeeds); the tables match the printout.
- [ ] 3.2 EXPERIENCE.md:
  - the "After an answer" row: the card at the top, the page's end, one question per view, and the other jumps unchanged;
  - Accessibility Floor's focus paragraph and "Reduced motion";
  - the Ana walkthrough (#168): question 4's card rises under the header with the mark.

  Verify: the wording matches the delta spec's requirement names; `grep -n "2px\|2 px" EXPERIENCE.md` finds no arrival mark.
- [ ] 3.3 `docs/as-built/answer-moves-to-top.md`: what was built and where (`alignDelta`, `align`, the mark's sheets, the pairs); the seams added (`align`, `alignDelta`, `{components.arrival-mark}`); no versions bound. Correct the 2 px mark sentence of an earlier note, if one says so, and name the correction. Verify: `grep -l "answer-moves-to-top" docs/as-built/` finds the note; `bun run check:agent` passes.

## Workflow follow-up

- The change alters the card's rendering and the reveal: dispatch a train on the branch before merge (`gh workflow run e2e.yml --ref worktree-feature-advance-to-top -f cadence=nightly`). Triage its new failures as AGENTS.md, CI says.
- Archive after the pull request is merged.
