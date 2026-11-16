# Proposal

## Why

In the PO's local check of `main` at 95e7e31f, a Tree node ended up nested under its neighbour without the PO meaning it, and that move became the whole answer. Nothing in the Tree undoes a structural edit: the only undo is the "Adjust by %" slot, which any other edit empties. The likeliest cause is a short drag by the row handle: the middle half of a row nests, and a one-row drag from the handle, which sits at the row's vertical centre, lands in that middle.

- Issue: #262

Serves FR-11 (Tree; every editable widget shows the user's changes), FR-15 (WBS with PERT, the adjustment's undo) and NFR-10 (fail closed: an answer holds only what the user meant). Relies on AD-1 (imports), AD-8 (no agent markup; no `style` attribute), AD-9 (a widget writes the draft record through its port, linked edits in one update), AD-10 (only "Answer" answers; undo sends nothing) and AD-20 (drafts; what a reload keeps). Implements EXPERIENCE.md: Widgets "Tree", Molecules "WBS with PERT", Interaction Primitives "Drag", Accessibility Floor "Keyboard core", Voice and Tone; DESIGN.md: Components "Tree". Part of #80 (undo across complex widgets): this change covers the Tree and the WBS with PERT, without redo; #80 stays open for redo and the Gantt and Timeline.

## What Changes

- **Undo for every Tree edit.** The Tree keeps an in-memory history of the user's last 50 edits: moves, drops, indent, outdent, adds, deletes, name and field commits and the percentage adjustment, each with the edits it carried into the Gantt plans over the Tree. Ctrl or Cmd with Z in the tree, or the toolbar's "Undo", puts back the draft as it was before the latest one, one edit at a time. Undo sends nothing and is not itself recorded. The history goes on reload, while the Tree is read-only, when the agent changes the Tree, and when something other than the Tree changes what its latest edit wrote.
- **"Undo" replaces "Undo adjust".** It is always shown in the toolbar, disabled when there is nothing to undo, and never moved into "More". Its tooltip names its key for the platform ("Undo (⌘Z)", "Undo (Ctrl+Z)"). Italian: "Annulla". The undo announces "Last change undone." The view strings `tree.tool.undoAdjust` and `tree.adjust.undone` are replaced; nothing outside the view changes.
- **Nesting by drag needs a move to the right.** Over a row's middle half, a drop goes inside the row only when the pointer is at least one indent step (16 px) right of where the drag started. Otherwise the upper half drops before the row and the lower half after it. The top and bottom quarters are unchanged. The drop indicator shows what the drop will do. While the pointer is in the middle without that offset and a drop inside is allowed, the tip under the grid says "Move right to drop inside."
- **No redo** in this change (design.md, D4). **No "restore what the agent sent"**: undoing every edit gets back there, and `accept-as-sent` (#263) brings the one-click acceptance.
- The PRD (FR-11, FR-15), EXPERIENCE.md, DESIGN.md, the Tree's teaching text and the generated skills follow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`:
  - Modified: "Tree keyboard", "Tree drag and drop".
  - Removed: "Tree adjustment undo" (replaced).
  - Added: "Tree undo", "Tree undo history", "Tree nesting by drag needs a move to the right".

## Impact

- `packages/widgets/src/tree/`: `model/history.ts` (new, pure) replaces `model/undo.ts`; `history.ts` (new, the hook that records every write); `index.tsx` routes the Tree's writes through it; `widget.tsx` drops the slot and takes the history's undo; `toolbar.tsx` gets the permanent "Undo"; `model/drop.ts`, `model/dragging.ts` and `drag.ts` take the horizontal offset; `model/marks.ts` exports `sameJson`.
- `packages/contract/src/widgets/tree/keys.ts` (the `undo` entry's label) and `widget.ts` (help text). No schema set and no `*_VERSION` constant changes.
- `packages/view/src/strings/` (en-US, it-IT, keys). `skills/` regenerated.
- Browser tests: `tree-undo.browser.ts` (new) and `tree-drag.browser.ts`, `tree-adjust.browser.ts` and the `harness/tree-drag.ts` helper updated.
- The change alters a widget's rendering, so it needs the pre-merge e2e train on its branch (AGENTS.md, CI).
