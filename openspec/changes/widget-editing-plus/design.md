# Design

## Context

See proposal.md for why. What the code and the specs start from, read on `main` at a35a0b9b:

- **Tree** (`packages/widgets/src/tree`): a treegrid with add, rename, delete and the four moves (`moving.ts`, `model/edits.ts`: `moveUp`, `moveDown`, `indent`, `outdent`, each returning a new frozen value), a toolbar, a change highlight and the WBS's PERT cells. It computes nothing (AD-13); roll-ups come from `compute`. Estimates are refused outside 0 to 100,000 working days (`estimateProblem`). The `tree-widget` change deferred drag, virtualisation and TanStack Table (its design, "A later widget change").
- **Gantt** (`packages/widgets/src/gantt`): own SVG chart and a grid; pointer drag with `bar-drag.ts` (`move` and `resize`) and `model/drag.ts` (`moveDrop`, `resizeDrop`); `model/edits.ts` (`requestStart`, `setDuration`, `setPredecessors`); a plan's rows come from the Tree's leaves (`planTaskRows`) and have a read-only duration.
- **Contract:** a plan entry holds only `start` and `dependencies`; a plan's changes may not `set` a duration ("a plan's durations follow its work packages' estimates"); a Tree's changes already take `set` on `item.node.field` and `move` with `parent` and `after`. Input 1.4, output 1.3 on `main` (to be read again at apply).
- **Compute:** a plan task's duration is its expected effort rounded up, at least 1.
- **UX:** EXPERIENCE already says "Ranking, Kanban and Tree drag with a drag-and-drop library" with Pragmatic drag and drop 4.0.0 and a keyboard action for every move, and says Gantt tasks drag with no library. It says nothing of a Gantt switch, a resizable column, row selection or percentage edits.

ADs this design relies on: AD-1 (widgets import only `contract` and `compute`), AD-7 (typed values, the working calendar), AD-8 (agent content as text), AD-10 (fail closed: read-only after an answer), AD-13 (computation in `compute`, none in the widgets), AD-20 (the answer carries only what changed; the draft record), AD-21 (answered questions are read-only). UX sections implemented: EXPERIENCE Component Patterns (Widgets: Tree, Gantt; Molecules: WBS with PERT, Gantt plan; Change highlight; Field error), Interaction Primitives (Drag), Accessibility Floor (Keyboard core: Tree, Gantt; Tab order; Focus), Widget Scope; DESIGN Tree, Gantt and Gantt plan rows. No AD changes: nothing here alters an AD's rule; the spine's Structural Seed gains no unit.

## Goals / Non-Goals

**Goals:**

- Each of the five requests works with the pointer and from the keyboard, is covered by scenarios, and gives its answer through the contract's existing `set` and `move` operations, with a plan's requested duration the one addition.
- Every new edit is highlighted as a change and counted, and is clean when it returns to what the agent sent.
- The pure logic (percentage rounding, selection, drop-zone decisions, duration requests) lives in model files with their own tests; components stay thin.

**Non-Goals:**

- Anything the proposal lists under "Not in this change".
- Persisting view state (column width, switch, selection) in the draft, the answer or the board: nothing of it is an answer (AD-20, NFR-9, no browser storage).
- A new computation in the Tree: the percentage adjustment is an edit, not a formula (AD-13); the rounding is a pure function over decimals, living in the widget's model as the Tree's other edits do.

## Decisions

### 1. View state stays in the widget, outside the draft

The TASK column width, the "Critical path" switch and the Tree's selection are React state of the widget and its host, not part of `ItemProps`' value. A reload, which restores the draft, resets them (spec: Gantt task column resize, Gantt critical path switch, Tree row selection). *Alternative:* keep them in the draft mirror so a reload brings them back: rejected, because the draft record is for what could become an answer (AD-20) and the UX "What a reload keeps" lists none of these.

### 2. A plan's duration is a request, like its start (open question 3)

A plan entry gains `duration`, the requested duration, beside `start`. `compute` takes it, else the expected effort rounded up. The widget never writes the estimates when the user resizes a bar. The model's `setDuration`, which today handles a Gantt's own tasks, gets a plan branch that sets or clears the entry's `duration`, clearing when the new value equals the effort-derived one (the same rule `requestStart` follows for the earliest start). The answer's `changes` come from the generic diff with no Gantt-specific code (contract: Computing a Gantt's changes); only the Gantt changes schema's rule on `duration` is relaxed for a plan, and the entry's `duration` is 1 to 2,000 whole days as a task's is.

*Alternatives:* (b) rescaling the three estimates: a drag then edits three numbers and the roll-ups and the PERT spread, a surprise for a gesture that reads as scheduling, and a rounding trap (an effort of 17.2 gives 18 days, so dragging to 18 rewrites it); (c) read-only plans: the PO asked for the resize on the plan the agent sends. Why (a): the estimates stay the agent's and the user's own three-point view, and the Gantt holds the schedule decision, which is where start requests already live.

*Contract versioning:* additive, optional field and a relaxed rule, so a minor of the input and the output formats; the `gantt-plan` molecule keeps its data-only parameters, because an agent asking for a pinned duration is not a use the PO named.

### 3. Selection and the adjustment are pure model functions

`tree/model/selection.ts` holds the selected set as node IDs with `toggle`, `extend` (a range from an anchor in the visible order, which collapsed rows are skipped in), `selectSubtree`, `selectAll` and the header's tri-state; parents derive their partial state from their subtree. `tree/model/adjust.ts` holds `parsePercent` (on the existing number parser in `shared/number.ts`, with the range of open question 5), `adjustValue` (decimal arithmetic on integers scaled by 10: `round(v × 10 × (1000 + 10p) / 1000)` computed with `BigInt` or scaled integers, half away from zero, so 3 × 1.1 is 3.3), `planAdjustment(value, selection, columns, percent)` returning either the new value and the counts (changed, skipped-empty) or the refusal with the offending rows (order or range, all or nothing), and `applyAdjustment` returning a new frozen `TreeProps`. The panel renders `planAdjustment`'s preview and applies exactly what it showed.

*Alternative:* floats with `toFixed`: wrong on halves (2.475) and on 1.005-like values.

### 3b. Coherence is one pure check

`tree/model/coherence.ts` gives `estimateOrderProblem(value, nodeId, field, input)`, returning the message or `undefined`, used by the cell editor next to `estimateProblem` (range) and by `planAdjustment` for every row it would change; a row's order counts only among its non-empty estimates, and a row already out of order is refused only when the edit adds a violation (one more pair out of order, or a larger gap). *Alternative:* a warning, which the PO rejected; a refusal that also blocked rows the agent sent out of order, which would trap the user.

### 4. One undo slot for the adjustment

The Tree host holds the value before the last adjustment as `undoSlot`; any other edit empties it; "Undo adjust" and Mod+Z restore it through the normal change path, so the draft, the highlight and the derived values recompute as for any edit. The browser's own Mod+Z in a text field of a cell editor is left alone: the Tree handles the key only when focus is on the tree, not in an editor. *Alternative:* a general undo stack (open question 7): every edit would need an inverse or a snapshot discipline, and the Tree's other edits have buttons that undo them (move, add, delete with confirmation); that is a change of its own.

### 5. Drag and drop: the library behind a spike, the moves unchanged

Pragmatic drag and drop 4.0.0 gives `draggable` and `dropTargetForElements` on rows, with the closest-edge hitbox (`attachClosestEdge`) turned into the three zones of the spec by `tree/model/drop.ts` (a pure function from a pointer's fraction of the row's height, the dragged node and the target to `{kind: "before" | "after" | "into"} | {kind: "refused", reason}`). `drop.ts` maps each kind to the existing edits: "into" is `indent`-like (`moveInto`), "before" and "after" are `moveBefore` and `moveAfter` added to `model/edits.ts` with the same limits checks the buttons use (`can`), so a drag and the buttons agree by construction, and the diff gives the same `move`. The spine of the work is task 5.1, a spike: native HTML5 drag inside the view's sandboxed frame (AD-8; EXPERIENCE Drag, "a spike item"), checked in Chromium and WebKit on the real board page and a scripted pointer test. If it fails, the fallback is an own pointer drag in `tree/drag.ts` (the Gantt's `bar-drag.ts` is the model), feeding the same `drop.ts`; the spec and the other tasks stay the same. The adoption rule of `addendum.md` (licence, stars, activity, pinned exactly) is checked by `check:licences` and recorded in the spike's note.

*Alternatives:* react-arborist (rejected by EXPERIENCE S-2); the horizontal-offset depth picker (open question 9): not explainable for the keyboard path, and the three zones reach every position.

### 6. The accessible path is the existing one

A drag has no keyboard form in Pragmatic drag and drop, so the Alt+Shift keys and the four toolbar buttons stay and every position a drop can reach is reachable by them (spec: Tree drag and drop, "The keyboard path"; EXPERIENCE Accessibility Floor). The drag handle is a visible grip with an accessible name "Drag <node name>", not a tab stop; the row stays the one focusable thing. Focus follows the moved node, announced by the existing live region.

### 7. The column edge is a separator

The TASK header's edge is `role="separator"` with `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and a name "Resize the Task column", one extra Tab stop in the grid's header, consistent with the grid being otherwise one Tab stop (a decision to note against the Gantt keyboard requirement; the header edge is outside the cell grid). The pointer drag uses pointer capture, like `bar-drag.ts`. The width goes into the grid's CSS template columns and the chart's x origin, so the bars and the time axis stay aligned.

### 8. The critical switch is a presentation filter

The chart receives `showCritical` and draws critical bars as ordinary when off; the compute graph's flags and any text (a screen-reader label naming a task as critical, the legend's critical entry) follow it for the visual parts only: the grid keeps no critical column, so nothing else changes. A Radix Switch is in the Stack's Radix list; to confirm when writing the task.

### 9. Double-click and hover are small, shared pieces

The double-click handler of the Tree (PR #34, `tree/widget.tsx`, `onDoubleClick`) is the model for the Gantt grid's: it resolves the cell under the pointer and calls the editor the Enter key calls, and does nothing for a cell that `can` refuses. Hover feedback is one shared stylesheet rule set in `packages/view/src/styles` keyed on `data-interactive`, `data-editable` and `aria-disabled`, using DESIGN's hover tokens, so no component hand-rolls a hover; the audit (task 7.1) puts the attributes on the existing controls.

### 10. The current row and the selected rows are two states

The Tree host holds `currentId` (one node, set by a click or an arrow key, `undefined` at open) beside the selection set of decision 3. The toolbar's row tools read `currentId` and are disabled while it is `undefined`; "Adjust by %…" reads the selection. The mark is drawn from `currentId`, not from the browser's focus, so it stays after the focus leaves (review F-02). *Alternative:* using the focused row, which loses the target on any click outside.

### 11. Derived changes are marked apart

A plan task whose duration changes only because its estimates or its package were changed in the Tree is `derived`; a task the user changed in the Gantt (a requested start, duration or predecessors) is `direct`. The marks model (`gantt/model/marks.ts`) gives each task one of `direct`, `derived` or none, and the counter reads from it, so the marks and the count cannot disagree (review F-07). The pin of a requested duration is part of `direct`.

### 12. One string catalogue for the widgets, and the hover layer in CSS

All AskBoard strings of the Tree, the Gantt and the molecules move into the view's catalogue (`packages/view/src/strings`) with en-US and it-IT entries, and the widgets receive a `t` function from the host, so `widgets` keeps importing nothing from `view` (AD-1); the new labels of this change are written there from the start. The `hover` token pair, the cursors and the hover looks are CSS selectors on shared attributes (decision 9), so a new control gets them by carrying the attribute.

## Risks / Trade-offs

- [Group 1 touches most of the Tree's and the Gantt's view code before the features land, and the features then edit the same files] → Group 1 comes first by decision of the PO's lead, with its own check and browser run, so the feature groups start from the polished base and conflicts arise once, not per feature.
- [Moving every widget string into the catalogue is a wide, mechanical edit] → A test fails on any literal string left in these widgets, so nothing is missed silently.
- [Native drag may not work in the sandboxed frame] → task 5.1 spikes it first in two engines; the pointer-drag fallback keeps every other task as it is.
- [A requested duration hides a changed estimate] → The pin mark, the change highlight and the tooltip "Requested 21 days; the estimates give 18" show it; the PERT numbers stay visible in the WBS beside the plan.
- [Refusing incoherent values makes a series of edits order-dependent, and a bulk change all or nothing] → The refusal's message names the rule and the row; a row the agent sent out of order is not made worse, so it can be fixed; the preview names the first offending rows before "Apply", so nothing is lost after the click.
- [A bulk adjustment touches hundreds of values at once and the answer grows] → The preview states the counts before "Apply"; a Tree's `changes` over the answer limit take the existing "too large" path of FR-20 (scenario in the spec).
- [Rounding to one decimal moves small estimates oddly] → The preview shows the first three changes and the refused and unchanged counts, and "Undo adjust" is one click; the unit of the estimates is a working day, so 0.1 is within the PERT inputs' practical precision.
- [Selection checkboxes widen the Tree's grid] → The leading column is narrow (`{spacing.xl}`) and shown always, so the layout does not jump when a selection starts.
- [Contract version drift between this change and others in flight] → Read the constants at apply (task 2.1); the additions are optional and the relaxed rule only accepts more.
- [R4, scope growth] → The extension is bounded to five edits on the Tree and the Gantt, written into FR-11 as a list with its ceiling restated.

## Migration Plan

No migration: asks and answers that exist stay valid (additive), and a board without a requested duration schedules as before. Rollback is a revert; an answer that carries a requested duration is read by an older server as an unknown key and refused, which is why the formats move a minor together and the board reads the version from the ask.

## Open Questions

The PO's numbered questions are in proposal.md; none is deferred past the first task group. Left to the apply: the exact width of the selection column and the grip (DESIGN tokens), and the Italian wording of the new labels, which the UX draft lists as "to review".
