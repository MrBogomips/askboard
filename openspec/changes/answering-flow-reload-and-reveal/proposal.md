# Proposal

## Why

Two defects of the answering flow that only Firefox and WebKit show. After a reload, an answered widget question can come back as a draft, without its receipt, because the restore treats a mirrored copy of the sent widget values as a new revision. And the move After an answer stops about 350 px short when the browser is still scrolling on its own as it starts, because it treats any change of position as the user's scroll.

- Issue: #250
- Issue: #259

Serves FR-2 (the move After an answer), FR-25 and AD-20 (the draft record survives a reload or a takeover), NFR-10 (fail closed: the restore drops only work identical to the logged answer) and NFR-12 (keyboard core). Relies on AD-1 and AD-8. Implements EXPERIENCE.md, Interaction Patterns "After an answer" and the reload paragraph of the draft record; the view-and-widgets requirements "Answered widget questions" and "The move to the next question".

## What Changes

- **A restored answer is not a revision, widgets included (#250).** When a reload or a takeover restores a draft record whose work on an answered question is the answer the board state logged, the board restores no work for it. Today that holds for a choice, results, "Other…" and notes, but not for widget values. The card then shows the logged answer read-only with its receipt. Work that differs from the logged answer in any way still comes back as a revision.
- **The move tells the user's scroll from the browser's (#259).** A change of position during the smooth move ends it only when the user gave input during the move: a wheel, a touch, a pointer press, a key that scrolls or moves focus, or a focus moved off the target. A scroll the browser makes on its own (a smooth scroll still running when the move starts, a focus scroll, scroll anchoring) no longer ends the move. The move goes on from where the page is and lands as asked.
- The browser test quarantined under #250 leaves `known-failures.json`. New cases pin both behaviours in a way that fails without the fix: a reload while the mirror still holds the sent Tree, and a smooth scroll the page started itself, still running when Enter is pressed.
- EXPERIENCE.md says what ends the move.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`, two requirements added: "A restored answer is not a revision" and "The user's scroll during the move".

## Impact

- `packages/view/src/shell/board-draft.ts`: the restore's stale-answer check also compares widget values. `packages/view/src/shell/reveal.ts`: the smooth move watches the user's input while it runs, and starts again from where the page is when the browser moved it.
- Unit files: `board-draft.test.ts` and `reveal-smooth.test.ts`. Browser files `widget-answered.browser.ts` and `answering-flow-advance.browser.ts`, already listed in `harness/suites.ts`. `known-failures.json` loses #250's entry.
- No contract, board protocol, schema set, configuration, key table, dependency or chunk boundary changes. The `shell` chunk grows by well under 1 KB.
- The change alters the reveal and how a card is restored, so a train is dispatched on its branch before merge (AGENTS.md, CI).
