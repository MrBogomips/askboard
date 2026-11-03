# Proposal

## Why

The build order puts the widgets AXFX needs first: the Tree with the WBS-with-PERT molecule and the Gantt plan (SOLUTION-DESIGN §3.1, AXFX FR-38). Both rest on derived values that AskBoard computes itself, without the agent (FR-12, FR-15), and on formulas that refer to items by ID (FR-14). The formula spike decided the engine, the whitelist, flat references with ranges, the limits and the currency check on 2026-10-30, and left a probe. This change turns that probe into the `compute` unit, so the widget changes that follow have a graph to read and write. It runs beside E1, which leaves `compute` untouched.

## What Changes

- **`contract`, new files only:** the formula grammar's terminals (field names, cells, ranges, the operator table with precedence), the function whitelist with each function's arguments and Excel semantics, the refused Excel operators `&` and `%`, the limits (8,192 characters, nesting 64, ranges of 65,536 cells) and the formula error kinds (AD-13, spike rows 2, 4, 10). `contract`'s index exports them.
- **`compute`:**
  - `buildGraph`: from a graph source (items with fields, cells and a tree of children) to a graph of typed nodes. Before any engine runs, it checks each formula's limits, grammar and whitelist, resolves flat references, wildcards and ranges, checks currencies and finds cycles. Every problem is a warning naming its node, whose address starts with the item ID, and that node reads as a formula error (AD-13, FR-14, spike rows 3, 4, 8, 9, 10).
  - The `FormulaEngine` port, addressed by engine names only, and AskBoard's own restricted evaluator behind it: own parser, topological order, the whitelisted functions as code with Excel's semantics, incremental recalculation, no dynamic code (AD-13, spike row 1).
  - The adapter between the graph and the engine: it maps each address to an engine name, converts dates and money in and out, and lets a caller read a node, set an input and recalculate.
  - PERT and CPM: a WBS-with-PERT item becomes expected effort and spread per node with roll-ups, and a Gantt plan becomes durations, a forward and a backward pass, slack, the critical path and working-day dates, all written as formulas over the whitelist (FR-12, FR-15, AD-13 "In-house computations", PRD R6).
- **Tests:** the spike's 123 whitelist fixtures with Excel's values, adapted to flat references; the error, hostile-input and UJ-2 WBS-and-Gantt fixtures; a check that each dropped function is refused; the fixtures under two extreme time zones and two locales (AD-13 Determinism, spike row 11).
- **Not in this change:** widgets, the view, molecules as data, and board wiring; mapping the board document's items onto the graph source (it comes with the widget declarations, finding F7); the sales-review and decision-matrix fields; formula JSON schemas in the input format; Node and browser runs of the fixtures; the PO's Excel check of the fixtures' values (spike task 8.1).

## Capabilities

### New Capabilities

- `compute`: the compute graph, the formula check, the engine behind its port, and PERT and CPM scheduling (AD-13).
- `contract`: the formula grammar, whitelist, limits and error kinds that `contract` holds for every unit (AD-7, AD-13). E1's change adds this capability's first requirements too; whichever is archived first creates the spec, and the other adds to it.

### Modified Capabilities

None: `openspec/specs/` is empty.

## Impact

- **Code:** `packages/compute` (new modules and tests); `packages/contract/src/formula/` and `packages/contract/test/formula.test.ts`, new; one export block appended to `packages/contract/src/index.ts`.
- **Dependencies:** none added. `compute` declares its existing dependency on `@askboard/contract` (`workspace:*`, on the spine's diagram), which adds that line to `compute`'s entry in `bun.lock` and no package.
- **Documents:** no PRD change. A spine clarification of AD-13, drafted in `spine-update-draft.md`, was applied after the PO accepted open question 2 (2026-10-31).
- **Requirements served:** FR-12, FR-14, FR-15 (WBS with PERT and the Gantt plan's computation), NFR-5 (no agent code runs), NFR-10, AXFX FR-38 through the widgets it unblocks; PRD R6.

## Open questions for the PO

The PO is away and asked for the work to continue. Each question records the narrowest choice made; every choice can be reversed in a later change.

1. **The graph's input.** AD-13 has `buildGraph(boardDocument)`, but E1's board document holds only plain questions, and the widget declarations that say which item fields are nodes come with the widget changes (F7). `buildGraph` therefore takes a graph source: items with typed fields and cells, a tree of children, and two computed item kinds, `wbs-pert` and `gantt-plan`, whose data has the shape of the approved UJ-2 example. The widget changes map the board document onto it.
2. **Where PERT and CPM are written.** AD-13 puts each widget type's built-in derived fields in `contract` as expressions; the spine's Structural Seed and SOLUTION-DESIGN §3.1 put PERT and CPM in `compute`. Here `compute` writes them, only with whitelisted functions, which a test checks. If the PO keeps that, `spine-update-draft.md` holds a one-sentence clarification of AD-13; otherwise they move to `contract` with the widget declarations.
3. **An empty wildcard is a formula error.** Spike row 8 proposed a warning while the function still sees an empty list (`SUM` gives 0); the spine, as applied, says the board shows that formula as an error. The spine wins: a warning, and the node reads as `missing-reference`.
4. **Over-limit formulas have their own error kind, `over-limit`,** with the limit and the measured size in the reason. The probe reported them as `syntax`.
5. **Unary plus is refused as `not-whitelisted`:** AD-13 lists unary minus only. No fixture uses unary plus.
6. **A field name may not be a cell, and cells are upper case,** as the spine says: `A1` and `Q1` are refused as field names, `a1` and `q1` are accepted. The spike's findings recommended refusing them in any case, but that refused natural names such as `f1` and `s1`, which the spike's own fixtures use as fields (revised during apply). `[sheet.a1]` is therefore a field reference, and a `missing-reference` unless the item has that field.
7. **Every formula reading amounts in two currencies is an error, whatever its type.** The probe checked money formulas only; the spine says "a formula over amounts in more than one currency". Only the formula where the mix starts is a warning; formulas that read it are errors without a warning of their own, like a missing reference.
8. **Money and currencies in the graph.** An item's currency applies to its money inputs; a money formula takes its declared currency, otherwise the one it reads. Derived money values are numbers, unrounded (AD-13), with the node's currency beside them; the answer format that carries them comes later.
9. **CPM's model.** Tasks are the WBS's leaves in document order; dependencies are finish-to-start without lag; a task lasts the expected effort rounded up to whole working days, at least one; the plan starts on the first working day on or after its start date; the calendar is Monday to Friday without holidays (AD-7's default). Dragging a task (a start constraint) and holidays come with the Gantt widget. A dependency that names no task of the plan is a `missing-reference` warning, and so is a plan whose work packages name no WBS.
10. **Malformed sources throw.** Duplicate or malformed IDs, malformed field names or cells, unknown item kinds and a money input without a currency are refused with an error before any graph exists: the input format's schemas refuse them at send time.
11. **The formula's JSON Schema** (a string of at most 8,192 characters) joins the input format with the first widget that carries a formula; this change leaves E1's sets untouched.
12. **Determinism runs in Bun only:** the fixtures run under `TZ=Pacific/Kiritimati` and `TZ=America/Adak` with `en-US` and `de-DE` in the test suite. Node and the browser engines run them when `compute` reaches the view.
13. **A formula problem found at build time reaches every reader, even through a branch that `IF` does not take** (added after the review, design decision 5): `IF(TRUE,1,[x.c])` with `x.c` on a cycle reads `cycle`, where Excel's lazy `IF` would give 1. Run-time errors stay Excel's: `IF(FALSE,1/0,2)` is 2. An input with a bad value also stays a run-time value, since the user can set it right.

**Answer (PO, 2026-10-31):** accepted as proposed, all thirteen choices; none reversed.
