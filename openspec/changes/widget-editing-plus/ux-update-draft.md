# UX update draft: widget editing plus

**Status: not applied.** It applies only for the proposal's open questions the PO accepts (1, 2, 3, 8, 9 and 11); otherwise EXPERIENCE and DESIGN stay as they are, and the change's specs follow their current text. Sentence-level blocks for `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (blocks 1 to 9, 13 and 15 to 18) and `DESIGN.md` (blocks 10 to 12, 14 and 19); blocks 13, 14 and 15 to 19 come from the design review of 2026-11-06 (`drafts/design-review-2026-11-06.md`), whose finding IDs they cite; each quotes the text it changes word for word, as `main` holds it at a35a0b9b, then gives the replacement. A block that adds text keeps the quoted sentence and appends to it. The new labels are provisional and carry "(to review)" in the Localization table when applied (task 0.2).

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
Deleting a package that has Gantt dependents asks for confirmation, then connects them to the package's own predecessors. With packages selected, "Adjust by %…" opens a panel: the estimates to change (Optimistic, Most likely, Pessimistic, all checked), a signed percentage from -99.9 to +1000 with at most one decimal, and a preview of how many values change, how many are skipped (empty), the first three changes and, when any row would fall out of order or out of the range of an estimate, a message naming the rows with "Apply" disabled: a change that breaks any row applies to none. A single estimate edit that breaks optimistic ≤ most likely ≤ pessimistic, or is negative, is refused with a Field error. The panel changes the leaves among the selection by that percentage, rounded half away from zero to one decimal, as one step; the totals and the Gantt follow, the changed cells take the change highlight, and "Undo adjust" restores them until the next edit. Dragging a package moves it with its children, and the plan's tasks follow the new order.
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
A drag shows the drop indicator, as in Ranking: a line above or below the row for before and after, `{colors.primary}` outline on the row for into, and a `{colors.destructive-text}` cue for a drop that is not allowed; the row has a grip handle at its start, in `{colors.muted-foreground}`, and a leading checkbox column holds the selection, with a tri-state one in the header. "Adjust by %…" opens a popover under the toolbar: check boxes, a signed percentage field (no echo), the preview in `{typography.body}` and the warning in the Field error pattern, "Apply" as the primary button. Changed nodes take the change highlight (F-36).
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

### Block 13: Component Patterns, Widgets and Primitives, the general feedback rule, and double-click

Add under Interaction Primitives a bullet after "Drag."; there is no current text to quote, so the block adds:

```text
- **Hover and focus feedback.** Every interactive control and every editable cell shows on hover that it responds, with a cursor (pointer on buttons, switches, segments, checkboxes, chevrons, links, option rows and rows that act; text on editable cells; grab on drag handles and Gantt bars; `ew-resize` on a bar's end; column-resize on the Task column's edge) and DESIGN's `hover` token pair (F-01), and shows the focus ring on keyboard focus. A disabled control shows none of the hover and the not-allowed cursor; a cell that is not editable and every control of a read-only widget show none. Hover differs from the change highlight and from the focus ring (L160).
- **Double-click edits.** In the Tree's and the Gantt's grids, a double-click on an editable cell opens its editor, as Enter and F2 do.
```

And in Accessibility Floor, Keyboard core, the Tree and Gantt lines (block 6) gain "Enter, F2 or a double-click starts editing a cell".

### Block 14: DESIGN, the `hover` token pair (F-01)

Current:

```text
shadcn's `accent` is a hover surface (an alias of `muted`), never the brand colour (L132).
```

Replacement:

```text
shadcn's `accent` is a hover surface (an alias of `muted`), never the brand colour (L132); it is not the hover look of controls that rest on `muted`, where it would not show. A `hover` token pair gives it: `hover.on-card` is `{colors.muted}`, for rows, option rows and cards; `hover.on-muted` is `{colors.card}` with a 1px `{colors.border-strong}` border, for toolbar buttons that rest on `muted`; `hover.outline` is a 1px inset `{colors.border-strong}`, added to editable cells, which has 3.49:1 and is neither the 2px focus ring nor the plum change border. `{colors.primary-hover}` and `{colors.primary-subtle}` stay for the buttons that have them. Disabled controls take no hover.
```

Add `hover` to the components list of DESIGN's front matter with these three entries, and to the colour page's pairs table.

### Block 15: EXPERIENCE, Localization, widget strings (F-04)

Add these rows to the Localization table; the Italian text is provisional, "(to review)". Every one goes through the view's string catalogue.

| String (en-US) | it-IT (to review) |
|---|---|
| Add node / Add child | Aggiungi nodo / Aggiungi figlio |
| Move up / Move down / Indent / Outdent / Delete | Sposta su / Sposta giù / Rientra / Riduci rientro / Elimina |
| No changes / Your changes: N / M follow from the WBS | Nessuna modifica / Le tue modifiche: N / M derivano dalla WBS |
| Day / Week / Month | Giorno / Settimana / Mese |
| Task / Start / Duration / Depends on | Attività / Inizio / Durata / Dipende da |
| Work package / Optimistic / Most likely / Pessimistic / Expected / Spread | Pacchetto di lavoro / Ottimistica / Più probabile / Pessimistica / Atteso / Dispersione |
| Critical path / agent's plan / earliest | Percorso critico / piano dell'agente / primo possibile |
| Adjust by %… / Apply / Cancel / Undo adjust | Modifica di %… / Applica / Annulla / Annulla modifica |
| Select all / Select none / N selected | Seleziona tutto / Deseleziona / N selezionati |
| Resize the Task column / Use estimate | Ridimensiona la colonna Attività / Usa la stima |
| Cannot drop inside its own branch / At most 8 levels | Impossibile rilasciare nel suo stesso ramo / Al massimo 8 livelli |
| More / Copy path | Altro / Copia percorso |

### Block 16: EXPERIENCE, State Patterns, closed asks and banners (F-06, F-18)

Add to State Patterns, By surface, for a closed or discarded ask:

```text
The header hides the open count and the next-open jump and shows the agent as ended; option rows and link-buttons take the disabled look. The Closed and Discarded banners sit directly under the context header, keep their message on one line, and show a saved Snapshot's path project-relative, cut in the middle, with the full path in a tooltip and a "Copy path" button, on its own line under the message. The bottom bar's Snapshot feedback does the same on its own line.
```

### Block 17: EXPERIENCE, Change highlight, By surface (F-07, F-16)

Add: the idle text of the Tree's and the Gantt's counters is "No changes", not "Changes vs agent's original · none yet". In a plan, a task whose duration only follows an estimate or a package changed in the Tree takes the derived mark (`change-subtle` fill, a dotted outline on its bar, no border), is not counted among "Your changes: N", and is counted apart as "M follow from the WBS". A requested duration is a direct change, with a pin, and counts. The counter truncates before it overprints a tool.

### Block 18: EXPERIENCE, Widgets and Molecules, the Tree and the Gantt (F-02, F-03, F-13, F-14, F-15, F-20 to F-21)

Add to the Tree row: the current row, the one the tools act on, is marked with a `primary-subtle` fill and a 2px `primary` left bar, apart from the selected rows; the row tools are disabled until a row is current; a drag handle shows on hover and on the current row. Add to the Gantt plan row: it opens at the finest zoom that fits the whole plan in the chart's width (Month at most), and shows a scroll cue when the chart still overflows; the grid reads dates as "Mon 11/2" (the year only when the plan spans two) and durations as "6 d"; the axis labels its first period and shades non-working days at Day zoom; a drag shows the earliest start as a full-height dashed guide labelled "earliest 11/6", and a resize shows the live duration "8 d"; dependency arrows leave the bar end with a stub, run between rows and enter from the left, the non-critical ones in the neutral border colour.

### Block 19: DESIGN, Components (F-02, F-08 to F-12, F-14, F-17, F-23, F-24)

Add: **Tree current row**: `{colors.primary-subtle}` fill with a 2px `{colors.primary}` left bar. **Field error in grids**: begins with the column name, tied to the editor, indented to the edited cell. **Input atoms, echo**: none in the grid editors and the adjustment panel's field (PO, open question 14c2); the committed cell shows the value in the ask's locale; the standalone atoms keep their echo. **Derived value**: a new row's empty roll-ups read "—" in `{colors.muted-foreground}`. **Gantt baseline** (settles Open Items 8): a 2px dashed `{colors.border-strong}` line under a bar whose dates differ from the agent's. **Gantt guide** (settles Open Items 8): a full-height 2px dashed `{colors.foreground-secondary}` line with its label. **Working calendar** (settles Open Items 9): non-working days shaded on `{colors.muted}` at Day zoom. **Segmented control**: the 2px `{colors.primary}` underline on every selected segment. **Density**: Tree and Gantt rows 32 px compact, 40 px comfortable. **Image**: a frame on `{colors.muted}` with a border and a caption line.

### Block 20: EXPERIENCE, Primitives, Input atoms, the echo in grids (F-08, F-09)

Add at the end of the Input atoms row: "In the Tree's and the Gantt's grid editors and in the adjustment panel's percentage field the parsed value is not echoed: an ambiguous or invalid entry is refused with a message, and after the commit the cell shows the value formatted in the ask's locale. The echo stays on the standalone atoms."
