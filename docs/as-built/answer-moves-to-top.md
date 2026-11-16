# As built: `answer-moves-to-top`

In code since `answer-moves-to-top` (Issue #256): the move After an answer, and "Continue", brings the next question's card to the top, 8 px under the sticky bars, and the card arrives with a fill and a 4 px edge that fade. The PO's answer on D2 (2026-11-16) was the card's top, the proposed default. No contract, protocol, key table, version or chunk boundary changed.

**What was built and where.**
- `packages/view/src/shell/reveal.ts`: `alignDelta(target, inset, gap, scroll)` (pure, clamped to the page's range) beside `revealDelta`; `revealAndFocus`'s `align` option, `"least"` (default, as before), `"card"` (the closest `[data-askboard-question]`'s top under the bars) or `"page"` (the page's top); `land` re-aligns the same way at the end of the move. A smooth move also holds `overflow-anchor: none` on the document until it ends, and restores the value it found: Chromium's scroll anchoring moved the page when the answered card above grew back, which the move read as the user's scroll, so it stopped 350 px short.
- `packages/view/src/shell/board.tsx`: `useHeadingFocus` passes `align` only for a request with `smooth`: `"page"` in one question per view, `"card"` otherwise, read from a ref so that a change of presentation alone moves nothing.
- The mark: `styles/motion.css` (unlayered `[data-askboard-question][data-askboard-arrived]` with the `primary-subtle` fill and the inset 4 px `primary` edge; `askboard-arrival` holds to 25% of 1.2 s, ends at `var(--card)` and a transparent edge; the reduced-motion rule is unchanged and stays in the layer) and `styles/forced-colors.css` (a 3 px `Highlight` outline, offset 2 px).
- Contrast: four pairs end `CONTRAST_PAIRS` (`tools/build/contrast.ts`): "Text / arrival fill", "Secondary text / arrival fill", "Muted text / arrival fill", "Arrival edge / fill". The design listed three; the requirement names secondary text too. The lowest ratios are Nordico dark's: 8.04, 6.78, 4.75 and 4.24.
- Documents: DESIGN.md (Motion, the Arrival mark row, `{components.arrival-mark}`, the forced colours paragraph, the regenerated Contrast tables), EXPERIENCE.md (After an answer, Focus, Reduced motion, the Ana walkthrough). No earlier as-built note states the 2 px mark, so none is corrected.

**Tests.** Unit: `reveal.test.ts` (`alignDelta`), `reveal-smooth.test.ts` (`align`, the landing, the anchoring), `styles/arrival.test.ts` (the sheets), `tools/build/contrast.test.ts` (the pairs). Browser, Chromium only: `answering-flow-advance` ("the move to the top", and the card's top at 8 px in "Go to the next" and "Stay here"), `answering-flow-motion` (the mark at rest under reduce, the first frame otherwise, the card top under reduce), `palettes-forced-colors` (the outline, one mark at a time).

**Seams added.** `alignDelta`, `Align`, `ScrollRange` and `revealAndFocus`'s `align`; `{components.arrival-mark}`. The other focus moves keep the least scroll by design.

**Where the fixture differs from the spec.** "A question already in view" says the card is wholly in view with the page at its top. `guidanceAsk`'s cards are 420 px tall, so question 2 (549 to 968 px at 1280×800) is only in part in view, for any count; its heading is in view, which is what the least scroll left alone. The browser case asserts that and the move.

**Sizes.** `shell` 289,173 to 289,924 bytes (+751, 0.3%), within the budget; `chunk-sizes.json` not re-recorded.

**What only CI shows.** Firefox and WebKit: the smoke run, and the train on the branch the workflow follow-up asks for. The anchoring hold was found in Chromium; the other engines were not run here.
