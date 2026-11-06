# UX update draft: widget editing plus

**Status: not applied.** It applies only for the proposal's open questions the PO accepts (1, 2, 3, 8, 9 and 11); otherwise EXPERIENCE and DESIGN stay as they are, and the change's specs follow their current text. Sentence-level blocks for `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (blocks 1 to 9) and `DESIGN.md` (blocks 10 to 12); each quotes the text it changes word for word, as `main` holds it at a35a0b9b, then gives the replacement. A block that adds text keeps the quoted sentence and appends to it. The new labels are provisional and carry "(to review)" in the Localization table when applied (task 0.2).

How to apply: replace each quoted text, set `updated:` in each file's front matter to the apply date, then run `openspec validate --all --strict --no-interactive`. Task 0.2 checks that each current text stands once, word for word, just before the edit.

## EXPERIENCE

### Block 1: Component Patterns, Widgets, Tree row

Current:

```text
Elements the user adds get IDs with a prefix reserved for the view, which agents may not use (pending ACR-13).
```

Replacement:

```text
Elements the user adds get IDs with a prefix reserved for the view, which agents may not use (pending ACR-13). Rows are selected with a checkbox in a leading column, with Space and with Shift and the arrow keys, and "Select all" takes every node, collapsed ones included; a parent selects its children. "Adjust by %…" changes the number fields of the selection, as the WBS with PERT says. A row drags by its handle and drops before, after or into another row; the drop is the move the buttons make.
```

### Block 2: Component Patterns, Widgets, Gantt row

Current:

```text
To move a task past a dependency, the user edits the dependency.
```

Replacement:

```text
To move a task past a dependency, the user edits the dependency. The Task column is as wide as the user makes it, by dragging its header's edge or with the keyboard on the edge, and a name that does not fit is cut with an ellipsis and holds its full text as a title. A "Critical path" switch in the toolbar shows or hides the critical highlighting, on when the Gantt opens; it is a view setting, never part of an answer.
```

### Block 3: Molecules, WBS with PERT row

Current:

```text
Deleting a package that has Gantt dependents asks for confirmation, then connects them to the package's own predecessors.
```

Replacement:

```text
Deleting a package that has Gantt dependents asks for confirmation, then connects them to the package's own predecessors. With packages selected, "Adjust by %…" opens a panel: the estimates to change (Optimistic, Most likely, Pessimistic, all checked), a signed percentage from -99.9 to +1000 with at most one decimal, and a preview of how many values change, how many are skipped (empty, or beyond the range of an estimate), the first three changes and a warning when the estimates fall out of order. The panel changes the leaves among the selection by that percentage, rounded half away from zero to one decimal, as one step; the totals and the Gantt follow, the changed cells take the change highlight, and "Undo adjust" restores them until the next edit. Dragging a package moves it with its children, and the plan's tasks follow the new order.
```

### Block 4: Molecules, Gantt plan row

Current:

```text
Each work package's duration is its PERT expected effort rounded up to whole working days, and parent packages get no summary bar.
```

Replacement:

```text
Each work package's duration is, unless the user requests another, its PERT expected effort rounded up to whole working days, and parent packages get no summary bar. The user requests a duration by dragging the end of its bar or typing it in the grid; a requested duration is marked with a pin and carries the change highlight, and it stays as it is when the estimates change; dragging the end back to the estimate's length, or "Use estimate", removes it. The "Critical path" switch is in the plan's toolbar, with the zoom.
```

### Block 5: Interaction Primitives, Drag

Current:

```text
- **Drag.** Ranking, Kanban and Tree drag with a drag-and-drop library, and wherever a drag is an answer path the same move has an explicit keyboard action (Accessibility Floor). Gantt tasks reschedule and Graph nodes move by pointer drag, with no drag-and-drop library (FR-11, L160, TC §2.2).
```

Replacement:

```text
- **Drag.** Ranking, Kanban and Tree drag with a drag-and-drop library, and wherever a drag is an answer path the same move has an explicit keyboard action (Accessibility Floor). A Tree row drags by its handle; over a row, the top quarter drops before it, the bottom quarter after it and the middle inside it as its last child, and a drop that is not allowed shows the not-allowed indicator; Escape cancels. Gantt tasks reschedule and resize, the Gantt's Task column resizes and Graph nodes move by pointer drag, with no drag-and-drop library (FR-11, L160, TC §2.2). If native drag does not work in the sandboxed frame, the Tree drags by pointer in the Gantt's way, with the same drops.
```

### Block 6: Accessibility Floor, keyboard core

Current:

```text
  - Gantt: start and duration can be edited in the grid;
  - Tree: the moves up, down, indent and outdent; Kanban: "Move to…"; Ranking: "Move up", "Move down" and "Keep this order";
```

Replacement:

```text
  - Gantt: start and duration can be edited in the grid, a plan's included; the Task column's edge is a focusable separator that the arrow keys, Home, End and Enter resize; the "Critical path" switch works with Space;
  - Tree: the moves up, down, indent and outdent, which every drop reaches as well; Space and Shift with the arrow keys select rows; "Adjust by %…" and "Undo adjust" are toolbar buttons, and Ctrl or Cmd with Z undoes the adjustment; Kanban: "Move to…"; Ranking: "Move up", "Move down" and "Keep this order";
```

### Block 7: Key Flows, UJ-2, step 2

Current:

```text
   - The critical path stays highlighted (`{components.gantt-critical}`), and the agent's original plan shows as a baseline (Gantt plan).
```

Replacement:

```text
   - The critical path stays highlighted (`{components.gantt-critical}`) until Sara switches it off, and the agent's original plan shows as a baseline (Gantt plan).
```

### Block 8: Widget Scope, the two molecules' rows

Current:

```text
| WBS with PERT (molecule) | UJ-2 | The Tree minimum; PERT expected effort and spread per node | Expand and collapse; an excerpt per work package; change highlight | L71 |
| Gantt plan (molecule) | UJ-2 | Drag to reschedule, edit durations and dependencies; dates and critical path computed | Day, week and month zoom; the agent's baseline; the critical path always highlighted | L72, L73, L160 |
```

Replacement:

```text
| WBS with PERT (molecule) | UJ-2 | The Tree minimum; PERT expected effort and spread per node | Expand and collapse; an excerpt per work package; change highlight; row selection and "Adjust by %…" with its undo; drag to reorder and to indent or outdent | L71, PO tests 2026-11-06 |
| Gantt plan (molecule) | UJ-2 | Drag to reschedule, edit durations and dependencies; dates and critical path computed | Day, week and month zoom; the agent's baseline; the critical path highlighted, with a switch; a resizable Task column; a bar resized to request a duration | L72, L73, L160, PO tests 2026-11-06 |
```

### Block 9: Widget Scope, the single widgets, and open question 24

Current:

```text
| Choice, Ranking, Scale, Document review, LaTeX, Table, Spreadsheet, Chart, Tree, Gantt, Timeline, Kanban, Image annotation | — | Each FR-11 row | None | L68 |
```

Replacement:

```text
| Choice, Ranking, Scale, Document review, LaTeX, Table, Spreadsheet, Chart, Timeline, Kanban, Image annotation | — | Each FR-11 row | None | L68 |
| Tree, Gantt (on their own) | — | Each FR-11 row | The editing of the two molecules above: selection and "Adjust by %…", drag, the critical path switch, the Task column's width and a task's requested duration where it has a plan | PO tests 2026-11-06 |
```

and open question 24, current:

```text
24. **Single-widget scope.** Whether molecule-level scope (Gantt zoom and baseline, Tree expand and collapse) also applies when Tree, Gantt or Table stands alone, given L68's minimum-as-ceiling rule.
```

Replacement:

```text
24. **Single-widget scope.** Whether molecule-level scope (Gantt zoom and baseline, Tree expand and collapse) also applies when Tree, Gantt or Table stands alone, given L68's minimum-as-ceiling rule. Decided for the Tree and the Gantt by the OpenSpec change `widget-editing-plus` (open question 11): they offer the editing the molecules add; Table is still open.
```

## DESIGN

### Block 10: Components, Tree

Current:

```text
A drag shows the drop indicator, as in Ranking, and changed nodes take the change highlight (F-36).
```

Replacement:

```text
A drag shows the drop indicator, as in Ranking: a line above or below the row for before and after, `{colors.primary}` outline on the row for into, and a `{colors.destructive-text}` cue for a drop that is not allowed; the row has a grip handle at its start, in `{colors.muted-foreground}`, and a leading checkbox column holds the selection, with a tri-state one in the header. "Adjust by %…" opens a popover under the toolbar: check boxes, a signed percentage NumberField with its echo, the preview in `{typography.body}` and the warning in the Field error pattern, "Apply" as the primary button. Changed nodes take the change highlight (F-36).
```

### Block 11: Components, Gantt

Current:

```text
During a drag, the earliest start the dependencies allow shows as a guide (F-24).
```

Replacement:

```text
During a drag, the earliest start the dependencies allow shows as a guide (F-24). The Task column's header edge is a 1px `{colors.border}` line, 8px wide to grab, that takes `{components.focus-ring}` on focus and a col-resize cursor. A "Critical path" switch sits in the toolbar, on when the Gantt opens; off, critical bars and arrows are drawn as ordinary ones and the legend drops its critical entry. A requested duration shows a pin mark in its cell.
```

### Block 12: Components, Gantt plan

Current:

```text
the critical path always highlighted, and the agent's original plan as a baseline under the bars
```

Replacement:

```text
the critical path highlighted unless the user switches it off, and the agent's original plan as a baseline under the bars
```
