# Proposal

## Why

The first e2e train on `main` after `answering-flow-guidance` (#230) and `answering-flow-visual` (#232) (run 43834178556, ddf90ae8) left about 220 failures in seven groups. Most are tests still written for the board before the redesign. Some are real defects in the answering flow in Firefox and WebKit: focus moves, the reduced-motion move, Tab order and the ask row's text. This is the stabilisation change the e2e train rule asks for (#227): it fixes the groups so that the next train checks the answering flow again in every engine.

- Issue: #236
- Issue: #237
- Issue: #239
- Issue: #240
- Issue: #241
- Issue: #242
- Issue: #243
- Issue: #238

Serves NFR-7 (the three engines), NFR-10 (a status message never missing or untrue), NFR-12 (keyboard and focus), FR-6 (the agent's removals announced) and FR-24 (the board's frame).

## What Changes

- **Tests only (#236, #237, #242 in Chromium and Firefox).**
  - A harness check that a draft holds no work replaces `drafts` equal to `[]`, since the draft record now carries the short numbers.
  - The Theme choices are reached through the Theme popover, and the progress row through its hook.
  - Button labels are read without their key caps.
  - The Gantt is reached by Tab from its question's heading.
  - The keys panel's Shift is expected in the catalog's form ("Maiusc" in it-IT off macOS).
  - The arrival mark is checked as soon as the move happens.
- **The focus move holds in every engine (#241, #242 in WebKit).** The board's focus move ends with the target focused and clear of the bars, whether or not the smooth move's frames run. When the target's node was replaced, the move finds it again.
- **The removal announced before any navigation (#243).** In one question per view, the question shown is known from the first render, so the agent removing it is announced.
- **Investigated, then fixed (#240, #239).**
  - Firefox's Tab path from a question's heading to its widget, and to the outbox's delivery switch.
  - Firefox's report of the ask row's `bdi` elements as clipped.
  - Each fix goes where the cause is: the board, or the test that measures it.
- A train dispatched on the branch before merge checks the seven Issues.

Also #238, decided by the PO after the proposal: the outbox's it-IT word for "Delivered" is "Arrivate" (to review), and the rail stays at 256 px. Out of scope: #244 (a perf flake).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: scenarios added that the train showed unmet in some engines:
  - "Focus moves clear the sticky bars": a jump in each engine.
  - "Status messages for the answering flow": the first question removed before any navigation.
  - "Reduced motion": the target in view in each engine.
  - "Keyboard core": Tab from a heading to its widget, and to the delivery switch, in each engine.

## Impact

- `packages/view/src/shell/`: `reveal.ts`, `index.tsx` or `board.tsx` (the question shown at first render), and `ask-row.tsx` or the rail's scroll boxes if the investigations find the cause there.
- `packages/view/test/browser/`: the harness (`dom.ts`, `draft-results.ts`, `tree-grid.ts`, `lifecycle-test.ts`) and about 25 browser files.
- No contract, protocol or key-table change. No new dependency. Chunk sizes move by a few hundred bytes at most.
