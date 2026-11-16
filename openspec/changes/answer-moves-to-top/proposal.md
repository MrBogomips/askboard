# Proposal

## Why

After an answer with "Go to the next", the board moves focus to the next question but scrolls only when that question's heading is out of view, and only as far as needed; its arrival mark is a 2 px edge beside the card's 4 px state stripe. On a board whose next question is already in view nothing visibly happens, and the PO, trying `main` a7c81e5b, saw no move at all. The PO decided (2026-11-16, on #256) that the move always brings the next question to the top of the view and that the arrival mark becomes clearly visible.

- Issue: #256

Serves FR-2 (the guided flow After an answer) and NFR-12 (keyboard core; reduced motion instant or static, WCAG 2.2 SC 2.3.3). Relies on AD-1 (the view's imports) and AD-8 (the view's own stylesheet in the sandboxed view). Implements EXPERIENCE.md, Interaction Patterns "After an answer" and Accessibility Floor "Reduced motion"; DESIGN.md, Motion and the "Arrival mark" component.

## What Changes

- **The move to the next question goes to the top.** After an answer that moves on with "Go to the next", and on "Continue" with "Stay here", the view scrolls, smoothly within the existing 250 ms bound, until the next question's card starts just under the sticky bars (context header, tab strip, feedback tray), even when the card is already wholly in view.
  - Where the page cannot scroll that far (the last questions of a board), the card rises as far as the page allows.
  - In one question per view, the page goes to its top.
  - A card taller than the viewport is placed the same way.
  - The move ends where it was asked to go even when a card above changes height during it, and still never fights a user's own scroll.
- **A visible arrival mark.** The card arrived at takes the `primary-subtle` fill and a 4 px `primary` inner edge, held through the move, then fading to the card's own fill over the rest of the 1.2 s. It is legible in Carta, Nordico, Grafite and Contrasto, light and dark: four contrast pairs added to the report. Under forced colours it is a 3 px `Highlight` outline for 1.2 s.
- **Reduced motion unchanged in kind.** The move is instant and the mark is static for 1.2 s, then removed.
- **Every other jump unchanged.** "Next to do", the outline, the strip, an unread reply, an agent change, "Go", the navigator, tabs, Submit and the field to fix keep the least-scroll reveal.
- DESIGN.md (Motion, Arrival mark, Contrast tables) and EXPERIENCE.md (After an answer, Reduced motion, the Ana walkthrough) follow.

Decided by the PO on 2026-11-16 (design.md, D2): the move aligns the card's top, so its number, state badge and "More" stay in view, rather than the heading's top, which would hide them under the bars.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`:
  - Modified: "After an answer", "Focus moves clear the sticky bars" and "Reduced motion".
  - Added: "The move to the next question" and "The arrival mark".

## Impact

- `packages/view/src/shell/reveal.ts`: a new top alignment beside `revealDelta`, used by the move and its landing. `board.tsx` asks for the alignment on the move's heading request; `heading-request.ts` and `flow.ts` are unchanged.
- `packages/view/src/styles/motion.css` and `forced-colors.css`: the arrival mark.
- `tools/build/contrast.ts`: four pairs.
- Browser files: `answering-flow-advance`, `answering-flow-motion`, `palettes-forced-colors`. Unit files: `reveal.test.ts`, `reveal-smooth.test.ts`, and a CSS test for the mark.
- No contract, protocol, configuration, key-table or dependency change. The shell's chunk grows by well under 1 KB. The change alters a widget's rendering path (the card) and the reveal, so a train is dispatched on its branch before merge (AGENTS.md, CI).
