# Proposal

## Why

The PO tested the Tree (the WBS with PERT) and the Gantt on the board and asked for five editing features that the first-version minimum (FR-11) and the Gantt plan's scope (FR-15) leave out: task names are cut off in the Gantt grid; a plan's bars cannot be resized, because a plan's durations are read-only; the critical path cannot be switched off, to read the plain bars; a whole estimate set cannot be widened or narrowed at once (a "+20% on every likely estimate" takes one edit per cell); and the Tree's rows move only with the buttons and keys, though EXPERIENCE already chooses drag and drop for the Tree and the `tree-widget` change deferred it. Each one extends the "minimum is the first-version ceiling" rule of FR-11 and changes "the critical path always highlighted" (FR-11, FR-15), so a PRD change goes with it (R4 stays bounded: the extension is limited to the Tree, the Gantt and the two molecules built on them).

## What Changes

- **Gantt, view:**
  - The TASK column of the grid is resizable by its header's right edge, with the pointer and with the keyboard; the width is view state, never part of an answer (F1).
  - A "Critical path" switch in the toolbar shows or hides the critical highlighting, on by default; it is view state and changes no answer (F2). **PRD change** to FR-11 and FR-15 (`prd-update-draft.md`).
  - In a Gantt plan, dragging the end of a bar, or typing in the grid, sets the task's duration in working days. A plan's entry gains an optional `duration`, the requested duration, which wins over the PERT expected effort rounded up; dragging back to the effort-derived length, or clearing it, removes it (F3, open question 3).
- **Tree and WBS with PERT, view:**
  - Row selection (checkboxes, Space, Shift+arrows, "Select all", "Select none"; a parent selects its subtree).
  - "Adjust by %…": the selected rows' leaf values of one, two or all three estimate columns (any number column of a plain Tree) change by a signed percentage, rounded to one decimal, previewed before it applies, applied as one step, undoable, highlighted as changes (F4, open questions 4 to 7).
  - Drag and drop moves a node with its subtree before, after or into another row, with Pragmatic drag and drop 4.0.0 as EXPERIENCE chooses; the buttons and Alt+Shift keys stay the accessible path (F5, open questions 8 and 9).
- **`contract`:** additive. A plan's entry may hold `duration`; a plan's changes may `set` `item.task.duration`, a whole number or `null`. The next minors of the input and output formats (open question 10). Nothing else changes in the answer: bulk edits are `set` operations on `item.node.field`, and drags are `move` operations, both already valid.
- **`compute`:** a plan task's duration is its requested duration, else its expected effort rounded up.
- **PO additions (2026-11-06):** a double-click opens a cell's editor in the Tree and the Gantt grids (F6); every interactive control and editable cell shows hover and focus feedback (F7); incoherent estimates are refused, not warned (open question 6).
- **UI polish from the design review (2026-11-06), built first (task group 1):** the review's 11 quick fixes, every High finding (F-01 to F-06, with all the Tree and Gantt chrome in the string catalogue with it-IT text for F-04), the Medium findings F-07 to F-18 and the Low findings F-20 to F-27, each with its ID in the task and a requirement or scenario where it changes behaviour (`drafts/design-review-2026-11-06.md`). The review's section "To fold into widget-editing-plus" is folded in whole: a `hover` token pair in place of `accent`; the current row against the selected rows; the Task column paired with the opening zoom and an overflow cue; neutral arrows with the switch off; the earliest-start guide and a live duration label while resizing; derived changes marked apart from requested ones; the adjustment panel's echo and refusal naming rows and columns; the drop tips; the handle's cursors; every new label in the catalogue.
- **Documents:** `prd-update-draft.md` (FR-11, FR-15, R4) and `ux-update-draft.md` (EXPERIENCE and DESIGN), each applied only after the PO accepts the questions they name. The spine needs no AD change: AD-7, AD-13, AD-20 stand; the design says why.
- **Not in this change:** the excerpt per work package (review F-19, EXPERIENCE open question A12) and the bundled fonts (review F-28);  reordering Gantt rows (open question 1), multi-row drag (open question 9), a general undo stack for the Tree (open question 7), virtualised rows and TanStack Table (the `tree-widget` change's other deferrals), any other widget, and Italian wording beyond the "to review" strings the UX drafts list.

## Capabilities

### New Capabilities

None: every behaviour belongs to a capability that exists.

### Modified Capabilities

- `view-and-widgets`: the resizable TASK column, the critical-path switch, plan duration resize, Tree selection, bulk percentage adjustment and Tree drag and drop; the Gantt layout, plan scope, durations and read-only requirements are modified.
- `contract`: a plan entry's `duration` and the Gantt changes that may `set` it.
- `compute`: the plan's scheduling and its graph source take the requested duration.

## Impact

- **Code:** `packages/widgets/src/gantt` (column resize, the toolbar switch, `bar-drag.ts` and the grid for plans, `model/` for the plan's duration entries and marks), `packages/widgets/src/tree` (a selection model, the adjust popover and its pure rounding module, drag and drop in `row.tsx` and `moving.ts`), `packages/compute` (plan source), `packages/contract` (Gantt props and changes schemas, constants, fixtures), `packages/molecules` (none expected: `gantt-plan` parameters stay data-only and the agent sends no duration).
- **Dependencies:** `@atlaskit/pragmatic-drag-and-drop` 4.0.0 (Apache-2.0), pinned exactly, passing the adoption rule of `addendum.md` and the licence check; the sandboxed-frame drag spike item (EXPERIENCE Drag) runs first, with an own pointer drag as the fallback (open question 8).
- **Docs:** PRD FR-11, FR-15 and R4; EXPERIENCE (Widgets, Molecules, Drag, Accessibility Floor, UJ-2 step 2, Widget Scope); DESIGN (Tree, Gantt, Gantt plan rows).
- **CI:** none new; browser scenarios in Chromium and WebKit run at the end of each task group (Firefox cannot launch locally).
- **Requirements served:** FR-11, FR-12 (live computation as the user edits), FR-15, FR-20 (the answer's `changes` and `derived` for each new edit), FR-21, NFR-5 (agent content as text), NFR-12 (keyboard and focus), R4 (bounded extension). **ADs relied on:** AD-1, AD-7, AD-8, AD-10, AD-13, AD-20, AD-21.

## Open questions for the PO

Each carries a recommended default. **The PO answered on 2026-11-06:** defaults accepted for 1 to 5 and 7 to 11; question 6 changed (below); two additions (12 and 13) follow question 11. A design review is running in parallel and its findings come through a later `/opsx:update`.

1. **"Draggable" TASK column.** Taken as a resizable width. *Default:* resizable only (pointer drag on the header edge, keyboard on the edge's focus, double-click fits the longest visible name, 120 px minimum). *Open:* does the PO also want drag-to-reorder of Gantt rows? *Why not by default:* a plan's rows follow its Tree's order, so a reorder belongs to the WBS, where drag and drop now exists; a Gantt with its own tasks has no `move` change in the contract.
   - **Answer (PO, 2026-11-06):** accepted as proposed.
2. **Critical path switch.** *Default:* on at open; per widget; view state only (not in the draft, the answer or after a reload); present in a standalone Gantt as well as in a plan; works in a Snapshot. FR-11 and FR-15 change from "always highlighted" to "highlighted, and the user can switch it off".
   - **Answer (PO, 2026-11-06):** accepted as proposed.
3. **Resizing a bar in a plan.** *Default (a):* the plan entry gets an optional `duration` override, the estimates stay as the agent sent them, the bar takes the change outline and the grid shows the pin mark; dependants and the critical path follow. *Alternative (b):* resizing rescales the task's three estimates so that its expected effort equals the new length, so the WBS stays the one source of the duration; it needs no contract change but rewrites three numbers for one drag and ripples into the roll-ups. *Alternative (c):* plans stay read-only and only a Gantt with its own tasks resizes.
   - **Answer (PO, 2026-11-06):** accepted as proposed.
4. **Which rows a bulk edit changes.** *Default:* the leaves under the selected rows (a parent holds roll-ups, not estimates); "all rows" is every leaf, collapsed branches included; an empty field stays empty and is reported as skipped.
   - **Answer (PO, 2026-11-06):** accepted as proposed.
5. **Rounding.** *Default:* each new value is the old value times (1 + p/100), computed in decimal arithmetic, rounded half away from zero to one decimal, never below 0; the percentage is a signed number with at most one decimal, from -99.9 to +1000; a value that rounds back to itself is not a change.
   - **Answer (PO, 2026-11-06):** accepted as proposed.
6. **Order of the three estimates.** *Default was:* warn and apply. **Answer (PO, 2026-11-06): refuse.** An edit, or a bulk percentage change, that would break optimistic ≤ most likely ≤ pessimistic, or give a negative value, is not committed: the field shows a message, and a bulk adjustment applies to no row if any row would break (all or nothing). *Edge, my reading:* a row the agent sent already out of order is not made worse, and may be edited until it is in order; an empty estimate takes no part in the order.
7. **Undo.** *Default:* a one-step "Undo adjust" button and Ctrl/Cmd+Z with the tree focused, valid until the user's next edit of any kind; no general Tree undo stack. *Alternative:* a general undo stack for all Tree edits, a larger change of its own.
   - **Answer (PO, 2026-11-06):** accepted as proposed.
8. **Drag and drop library and its fallback.** *Default:* Pragmatic drag and drop 4.0.0 as EXPERIENCE chooses, after a spike that proves native drag inside the sandboxed frame in Chromium and WebKit; if it fails, an own pointer drag with the same moves and drop zones, as the Gantt does. *Also:* TanStack Table and row virtualisation stay deferred.
   - **Answer (PO, 2026-11-06):** accepted as proposed.
9. **Drop zones and what is dragged.** *Default:* one row, with its subtree, per drag; the target row's top quarter drops before it, its bottom quarter after it, its middle makes the dragged node its last child (this is how a drag indents and outdents); a drop that would put a node inside its own subtree, or break the 8-level or 500-node limit, shows the not-allowed indicator. *Alternative:* the horizontal offset of the pointer picks the depth, as outline editors do; more precise, harder to do right with a pointer and impossible to explain by keyboard.
   - **Answer (PO, 2026-11-06):** accepted as proposed.
10. **Contract versions.** *Default:* the next minors above `main`'s (read at apply: input 1.4 and output 1.3 today, so 1.5 and 1.4), additive only; the molecule `gantt-plan` keeps its parameters, so an agent cannot send a duration override (only the user's answer carries it).
   - **Answer (PO, 2026-11-06):** accepted as proposed.
11. **Bulk adjust beyond the WBS.** *Default:* any Tree with number columns offers "Adjust by %…", over its number columns; Tree and Gantt standalone get the same editing as in the molecules, which answers EXPERIENCE open question 24 for these two widgets.
   - **Answer (PO, 2026-11-06):** accepted as proposed.
12. **Double-click opens a cell's editor (added by the PO).** In a Tree and a Gantt grid, a double-click on an editable cell opens its editor, beside Enter and F2. PR #34 built it for the Tree on `main` at b4f6c104; the spec records it for both widgets, and the Gantt's is verified or built in task 3.6.
13. **Hover and focus feedback everywhere (added by the PO).** Every interactive control and editable cell gives visible feedback on hover and on focus (cursor, background or outline), from DESIGN.md tokens. It is a board-wide rule, written into `ux-update-draft.md` and into the spec; the existing controls are audited in task 7.1.
14. **Review decisions that depart from approved UX text (folded in by the lead; the PO may amend).** *Defaults:* a plan opens at the finest zoom that fits it, not at week (F-03); the idle counter reads "No changes", not "Changes vs agent's original · none yet" (F-16); a grid number's echo shows only when it differs from the typed text (F-08); the baseline is drawn only where dates differ (F-12); grid dates read "Mon 11/2" and durations "6 d" (F-20, F-21); changes that follow the WBS are marked apart and counted apart (F-07).
