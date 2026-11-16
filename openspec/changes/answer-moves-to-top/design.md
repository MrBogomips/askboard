# Design

## Context

See proposal.md, Why. On `main` a7c81e5b the move After an answer is `flow.ts`'s `goTo`, which calls `requestHeading(focus, id, true)`. `useHeadingFocus` in `board.tsx` turns that request into `revealAndFocus(heading, { smooth: true, resolve })` (`shell/reveal.ts`). `revealAndFocus` scrolls by `revealDelta`, the least scroll that puts the heading wholly between the bars (`measureBoardInset`: header, tab strip, tray) and the viewport's foot, with a gap of `REVEAL_GAP` (8 px). With `smooth` set, it:

- focuses first, then runs `scrollFrames` over at most `SCROLL_MS`, unless reduced motion makes it instant;
- marks the card (`data-askboard-arrived`, `ARRIVAL_MS` 1,200 ms, one card at a time);
- lands at `MOVE_DEADLINE_MS` with `land`, which applies `revealDelta` again so that a card settling above, or a replaced node (#241), still leaves the target clear of the bars, unless the user scrolled.

Every other focus move (`focusHeading` without `smooth`, `focus-field.ts`, `question-footer.tsx`, the Submit path) uses the same function without `smooth`.

The mark is `box-shadow: inset 2px 0 0 var(--primary)` in `styles/motion.css`, inside `@layer components`, fading over 1.2 s, beside the card's 4 px state stripe (`styles/state.css`, a `border-left`). It is invisible under forced colours, where engines drop box shadows. The card is the `section[data-askboard-question]` with `bg-card` (Tailwind's utilities layer), and its card head (number, state badge, "More") and any change or reopened notice sit above the heading.

ADs relied on: AD-1 (the view imports only along the diagram; nothing new crosses a boundary) and AD-8 (the mark is the view's own stylesheet in the sandboxed view). No contract, schema set or version moves, so `askboard-contract-versioning` does not apply. No widget key changes: no key table and no `keys-coverage.test.ts` entry. No Claude Code run-time behaviour is assumed: nothing needs a probe of it.

### Changes in flight and merge points

- `early-benchmark` (`openspec list`, 18/22): bench tooling, no file in common.
- PR #255 (`fix-icon-buttons`) touches `card-head.tsx`, `styles.ts`, `ask-row.tsx`, `board-keys-panel.tsx`, `theme-control.tsx` and `icons.browser.ts`, none of this change's files. The card head's height may change by a pixel or two, which the alignment of the card's top (D2) does not depend on. Merge point M1: rebase after #255 if it merges first; there is no conflict to expect.
- Borrowed names, all on `main` (task 0.2 rechecks them):
  - in `reveal.ts`: `revealAndFocus`, `revealDelta`, `REVEAL_GAP`, `SCROLL_MS`, `FRAME_MS`, `ARRIVAL_MS`, `MOVE_DEADLINE_MS`, `scrollFrames`;
  - `measureBoardInset` (`measure-inset.ts`);
  - `requestHeading` and `HeadingRequest.smooth` (`heading-request.ts`);
  - `useHeadingFocus` (`board.tsx`);
  - `CONTRAST_PAIRS` and `contrastReport` (`tools/build/contrast.ts`);
  - the hooks `data-askboard-arrived`, `data-askboard-question` and `data-askboard-stripe`;
  - the fixtures `guidanceAsk` and `answeringAsk`, and the browser helpers `expectBetweenBars`, `arrivedAt`, `watchArrival` and `arrivalOf`.

## Goals / Non-Goals

**Goals:**
- The move (After an answer with "Go to the next", and "Continue") always lands the next question's card just under the sticky bars, smoothly within 250 ms, instantly under reduced motion.
- A mark that the eye catches in every palette and scheme, and under forced colours.

**Non-Goals:**
- The other focus moves keep the least scroll: "Next to do" and the key N, the outline, the strip, an unread reply, an agent change, "Go", the navigator, tabs, Submit's focus and a field to fix. A move the user chose lands where the user is already looking, and pressing N through a short board would otherwise scroll on every press. The PO's decision keeps them, and nothing found here argues for aligning them.
- No space added at the end of the page (D4).
- No change to the reading line or the question in view (`use-question-in-view.ts`). During and after the move, the focused card shows between the bars, so it is the question in view, as today.

## Decisions

### D1. One alignment beside the least scroll

`reveal.ts` gains a pure `alignDelta(target, inset, gap, scroll)`. It returns `target.top - (inset.top + gap)`, clamped to `[-scroll.y, scroll.max - scroll.y]`, where `scroll.max` is `scrollHeight - innerHeight`.

`revealAndFocus` takes `align?: "least" | "card" | "page"` (default `"least"`, today's behaviour):
- `"card"` measures the target's closest `[data-askboard-question]` and applies `alignDelta`;
- `"page"` scrolls to the page's top (delta `-scrollY`).

The chosen delta feeds the same paths as today: instant `scrollBy`, or `scrollSmoothly` with `scrollFrames`. `land` takes the same `align` and re-measures, so the move ends aligned even when a card above settled meanwhile. The user-scroll guard and the deadline are unchanged.

`useHeadingFocus` passes `align` only for a request with `smooth`: `"page"` in one question per view, `"card"` otherwise. The board knows its presentation where it renders `Questions`. `HeadingRequest`, `requestHeading` and `flow.ts` are unchanged: `smooth` already means "the move".

Alternatives considered:
- Folding the alignment into `smooth`: this breaks the `reveal-smooth.test.ts` cases that pin the smooth path's arithmetic, and it ties two concerns, the motion and the target place, that reduced motion separates.
- A browser `scrollIntoView({ block: "start" })` with `scroll-margin-top`: it ignores the tray's dynamic inset unless the margin is rewritten at every move, its smooth behaviour has no duration bound (SC 2.3.3's 250 ms), and engines differ on a scroll while focus moves (the reason for #180).

### D2. The anchor is the card's top (proposed default; needs the PO)

The PO wrote "until the next question's heading sits just under the sticky bars". Above the heading sit the card's padding, its head (short number, state badge, "More") and any change or reopened notice. A heading at 8 px under the bars hides all of them under the bars at the moment the user arrives. The anchor is therefore the card's top at 8 px under the bars, and the heading sits just below its own card head, the highest it can be with the card wholly readable.

Alternatives:
- The heading's top: the PO's literal wording, with the hidden head above.
- The area's heading when the card is the first of its area (sections): it keeps the area's name in view, but two anchors cost a rule and tests for little, since the outline and the status region already name the area.

Task 0.1 records the PO's answer, asked on #256 with `needs-po`. Choosing the heading changes one branch of D1 (`"card"` measures the heading) and the spec's "card top" wording, through `/openspec-update-change`.

### D3. The gap

The gap is `REVEAL_GAP` (8 px) under the lowest sticky bar: the header, the tab strip with tabs, or the tray when it shows. These are the bars `measureBoardInset` already measures, at the move's start and again at its landing.

### D4. Edge cases

- **The last questions.** When the card cannot reach the bars because the page ends, the clamp stops at the page's end. The card then sits as high as the page allows, and its heading is still between the bars, since the clamped position lies past the least-scroll one. No end spacer is added. A spacer as tall as the viewport would let every card reach the top, but it would change the board's frame (the rail, the outbox at its foot), leave a blank end under every board, and contradict the PO's own edge case.
- **A short board that fits the viewport.** It has nothing to scroll: the move is the focus and the mark alone. The mark (D5) is what makes the move visible there.
- **One question per view.** The question shown is replaced, so the move goes to the page's top (`"page"`). The navigator and the area label stay in view, and the mark shows.
- **Tabs.** The tab strip is in the inset, so the card lands under the strip. A hand-off to another tab first activates the tab (`deps.show`), then aligns.
- **A card taller than the viewport.** It follows the same rule: its top lands under the bars and the rest reads by scrolling down. This is what the least scroll did already for a box taller than the span.
- **The tray.** A tray message that appears with the answer is measured at the start, and the landing re-measures it.
- **A move during a move.** The second cancels the first's frames and deadline (today's rule) and marks only its own card.

### D5. The arrival mark

`[data-askboard-question][data-askboard-arrived]` takes `background-color: var(--primary-subtle)` and `box-shadow: inset 4px 0 0 var(--primary)`. The rule moves out of `@layer components` to unlayered, like `state.css`, so that it wins over the `bg-card` utility when static. Where there is no reduced-motion preference, `askboard-arrival` runs for 1.2 s, ease-out, `forwards`:
- 0% to 25% (300 ms) hold the full mark, so it is whole when the 250 ms scroll lands;
- 100% is `var(--card)` and a transparent edge.

Under `prefers-reduced-motion: reduce` the existing rule zeroes the animation, so the static declarations show until `ARRIVAL_MS` removes the attribute. Under `forced-colors: active`, `forced-colors.css` gives the arrived card `outline: 3px solid Highlight; outline-offset: 2px`. Engines drop the shadow there and force the fill to `Canvas`, so the outline is the mark.

The edge is 4 px, the stripe's own width. It lies inside the state stripe, so the state's line style (dashed, dotted or solid) stays visible beside it. The new token `{components.arrival-mark}` records the fill, edge, width and timing in DESIGN.md's components.

Alternatives considered:
- An outline ring in every mode: it reads as a second focus ring next to the heading's.
- Widening the state stripe: it hides the state's line style, which is the state's non-text sign.
- A slide or scale: more motion than the move needs.

### D6. Legibility in every palette

Four pairs join `CONTRAST_PAIRS` (the requirement names secondary text beside text and muted text):
- "Text / arrival fill" (`foreground` on `primary-subtle`), text;
- "Secondary text / arrival fill" (`foreground-secondary` on `primary-subtle`), text;
- "Muted text / arrival fill" (`muted-foreground` on `primary-subtle`), text;
- "Arrival edge / fill" (`primary` on `primary-subtle`), mark.

The existing "Accent text / pressed fill" already covers `primary-text`. The lowest ratios on `main`'s tokens, computed for this design:
- text: 8.04 (Nordico dark);
- secondary text: 6.78 (Nordico dark);
- muted text: 4.75 (Nordico dark), 10.11 in Contrasto;
- edge: 4.24 (Nordico dark), 7.87 in Contrasto.

All meet their minimums. The fill against the card is 1.15 to 1.35: a tint, not a boundary, and the edge carries the 3:1 mark. A selected option, whose fill is also `primary-subtle`, keeps its check and border while the tint lasts. `bun tools/build/contrast.ts` regenerates DESIGN.md's tables.

### D7. Tests

Unit tests, first:
- `reveal.test.ts`: `alignDelta` for a card below, in view, above, at the page's end, taller than the span, and on a page that cannot scroll.
- `reveal-smooth.test.ts`, with the stand-in window: `align: "card"` and `"page"` deltas, smooth and instant; the landing re-aligning after a card above changed height; a user scroll still kept.
- A CSS test `styles/arrival.test.ts`, reading the sheets as `contrast.test.ts` does: the mark's rule is unlayered, carries the fill and the 4 px edge, the keyframes hold to 25% and end at `var(--card)`, and `forced-colors.css` has the outline.

Browser tests:
- `answering-flow-advance.browser.ts` gets a describe "the move to the top". It covers the scenarios of The move to the next question, measuring with `boxOf` the card against the banner or the strip, ±2 px, and `scrollY` before and after.
- `answering-flow-motion.browser.ts` reads the computed fill and shadow of the static mark under reduce, and the animation's first frame otherwise.
- `palettes-forced-colors.browser.ts` (Chromium only) reads the outline.

Existing assertions: no browser test asserts "the page has not scrolled" after a move that goes on. The one in "Stay here" is taken before "Continue" and stays true; `expectClearOfBars` holds for an aligned card. Task 0.2 re-greps for such assertions.

### D8. Scroll anchoring is off while a smooth move runs

Found while building group 1. A browser's scroll anchoring adjusts `scrollY` when a box above the viewport changes height. After an answer, the answered card above the target settles into its answered look and then grows back (75 px on the nine-question board), and Chromium moved the page by 38 px during the move. `revealAndFocus` reads a change of `scrollY` it did not make as the user's scroll (D1's guard), so it stopped the move and skipped the landing, 350 px short of the place.

A move with `smooth` therefore sets `overflow-anchor: none` on the document element when it starts, and restores the value it found when it ends (its deadline, its last frame, a user scroll, or the move that replaces it). The landing then re-measures the layout as it stands and aligns again. The user's own scroll is still detected, since only the page's own anchoring is off. Moves without `smooth` are unchanged.

Alternatives considered:
- Telling the user's scroll from anchoring by input events (wheel, touch, keys): more code and more engine differences, and the user-scroll tests would need events instead of positions.
- Landing even after a "user scroll": it would fight a user who really scrolled, which D1 forbids.

## Risks / Trade-offs

- [A scroll at every answer on a long board may feel busy] → It is bounded at 250 ms, never fights a user's scroll, and is instant under reduced motion. "Stay here" remains for users who want no move.
- [The clamp at the page's end looks like "no move" for the last questions] → The mark still shows, and the PO accepted this edge case.
- [Moving the mark's rule out of its layer could let it win where it should not] → It is scoped to `[data-askboard-question][data-askboard-arrived]`, lives 1.2 s, and the CSS test pins its selectors.
- [Firefox and WebKit timing of the smooth move (#241, #242 history)] → The landing and deadline of e2e-stabilise-answering-flow are reused unchanged. A train on the branch before merge (AGENTS.md, CI) checks the three engines.

## Migration Plan

None: view-only behaviour, no stored data. Rollback is a revert.

## Open Questions

- D2, the anchor: the card's top (default) or the heading's top. Asked on #256 with `needs-po`. Task 0.1 records the answer before group 1 starts.
