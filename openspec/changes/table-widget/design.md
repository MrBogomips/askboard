# Design

## Context

See proposal.md for why. Read on `origin/main` e87841d5 (`atoms` merged as #57, `latex-public-api` archived as #58), with `layouts` (PR #60, branch head edf6e802), `form-widget` (branch head 71e4ff16, stacked on `layouts`), `document-review` (branch head 24656505, stacked on `form-widget`, at its task 0.4) and `image-annotation` (proposed at 0ac511ec) in flight:

- **The registry** (`contract/src/widgets/registry.ts`): `WidgetType` with `props`, `propsProblems(props, origin)`, `edits {changes, shape}`, `result?`, `derived {describe, problem(rest, props)}`, `wording`, `example`, `skill?`. `WIDGET_TYPES` ends with the atoms on `main`. `ElementShape` (`element-diff.ts`) has a list shape (`elements`, optional `children`), a keyed shape and a fields shape; `elementChanges` and `applyElementChanges` are inverse, and `ask-core` refuses an edited value whose changes do not rebuild it (`widget-values.ts` `roundTripProblem`) or fall outside the type's changes schema (`widgetChangesProblems`).
- **No agent formula exists yet.** `compute` builds `fields` items (inputs and formulas on item fields, cells and children, `source.ts`), the WBS's PERT and the Gantt's CPM, whose expressions it writes itself. `BOARD_SOURCES` (`board-sources.ts`) is empty: it is the table a computing type appends to. `buildGraph` parses every node's formula on its own (`checkFormula`), and gives one warning per node in error; `ask-core`'s `formulaWarnings` (`core/src/graph-check.ts`) turns each into a `formula` warning, and the `ask` result has no cap on them. The reference grammar (`contract/src/formula/grammar.ts`, `compute/src/formula/lexer.ts`) has no form for "this row".
- **Own grids.** The Tree (`widgets/src/tree/`, a `treegrid` with roving `tabIndex`, `CellEditor`, `entry.ts`) and the Gantt's grid are AskBoard's own: `tree-widget` and `gantt-widget` installed neither TanStack Table nor a virtualiser, though the spine's Stack and EXPERIENCE still name TanStack for them and for the Table. Their editors refuse unreadable text on Enter and drop it on leaving (EXPERIENCE, Input atoms).
- **The atoms** (`atoms`): the parsers and echoes are `contract`'s (`parseNumber`, `parseAmount`, `parseDate`, `numberEcho`, `amountEcho`, `dateEcho`, `minorUnitsOf`, `MINOR_UNITS`); each input atom's `checks.ts` has `…PropsProblems` and `…ResultProblems`, plain ECMAScript; the view's readers (`catalog/{number,money,date}-field/read.ts`) add the bound wording, choosing the bound broken by restating the order (whole, minimum, maximum, step). An item's entry is one string (`ItemProps.entry`, the draft record's `entries` by item ID, `shell/entries.ts`); the view's readers are reachable from a widget only through the port (AD-9).
- **The board graph in the view** (`widgets/src/board-graph/`): `liveGraph` rebuilds unless `recalc.ts`' `inputChanges` finds only numeric input changes of a Gantt, which go through `set` and `recalc`.
- **The skill**: `SKILL.md` is 8,106 characters on `main`; `skill-index` (#61) moved the lines that describe each type out of `SKILL.md` into the catalogue `references/items.md`, so the Table adds a catalogue line (a use within `main`'s 200 characters) and one link in `SKILL.md`; `document-review`'s 70-character index line is superseded.

ADs relied on: AD-1 (imports: `widgets` imports `contract`, `compute` and the port only; `compute` stays plain ECMAScript), AD-6 (worded problems, warnings, generated teaching), AD-7 (the registry, child IDs, view-made IDs, money with a currency), AD-8 (agent content as text), AD-9 (one chunk per component, no edit state in components, facts through the port), AD-10 (fail closed), AD-13 (the graph; amended in place by `spine-update-draft.md` block 1), AD-15 (Snapshots), AD-19 (no new dependency; the Stack row, block 3), AD-20 (changes, derived values, drafts; block 2). Nothing here depends on Claude Code's run-time behaviour: no item needs a probe there; the browser and timing assumptions are probed in tasks 0.4 and 0.5.

## Goals / Non-Goals

**Goals:**

- A Table is a registration plus one graph source: everything that computes goes through AD-13's one graph, and every check of a cell is one predicate in `contract`.
- The cost of a Table is bounded by its input: rows, columns and formula length bound the graph's work, and the worst form is timed before the component is built.
- The Table carries what the sales estimate review and the decision matrix will need (toggle cells, totals readable by other items, `IF` over a row), without building them.

**Non-Goals:**

- The two Table molecules, a Spreadsheet, sorting, filtering, reordering, column widths, virtualised rows (proposal, Not in this change).

## Decisions

### 1. AskBoard's own grid, no dependency (open question 1)

The Table is `packages/widgets/src/table/`, an ARIA `grid` on a `<table>` with roving `tabIndex`, as the Tree's `treegrid` is. TanStack Table's headless core would bring row models, sorting, filtering, grouping and column sizing, none of which the Table's minimum has; what the Table needs (typed editing, cell entries, the keyboard, graph values, change marks) is AskBoard's own either way. A dependency would add an adoption check, an exact pin, a library chunk and its size record, and the documented-API rule over another library, for nothing the grid uses. The Stack row of `@tanstack/react-table`, which no change installed, goes, and the Spreadsheet's change decides its own grid (block 3); EXPERIENCE's Component per widget row and DESIGN's Table row say "own grid" (`ux-update-draft.md` blocks 4 and 8).

*Alternatives:* TanStack Table 9.3.1, as EXPERIENCE names it; extracting a shared grid from the Tree first (a Tree refactor this change does not need: the Table's grid is small, and a later change may extract both).

### 2. The type and its props (open questions 2, 7 and 12)

`packages/contract/src/widgets/table/` in the atoms' layout (`table-props.json`, `table-changes.json`, `constants.ts`, plain `checks.ts`, `cells.ts`, `projection.ts` (what the column checks and the cell check share), `derived.ts` (the addresses an answer's derived values may name), `wording.ts`, `widget.ts`, `index.ts`); type `table`, noun "a Table", appended to `WIDGET_TYPES` after `pick-field`, the last type of the base (`table-sets.test.ts` pins it as the last entry); a type registered later appends after it. Constants: `TABLE_MAX_ROWS` 200, `TABLE_MAX_COLUMNS` 10, `TABLE_TEXT_MAX_CHARS` 500 (code points), `TABLE_FORMULA_MAX_CHARS` 500, labels at `ATOM_LABEL_MAX_CHARS`; `TABLE_FIELD_PATTERN` `^(?!id$)[a-z][A-Za-z0-9]{0,63}$` (a field never matches a cell, AD-13, and never the row's `id`).

- **Columns.** The schema lists each type's keys under `if`/`then` on `type`, as the Value's does (no root combinator). `tablePropsProblems` then checks each column by its input atom's own props check over a projection `{label, …bounds}` (`numberFieldPropsProblems`, `moneyFieldPropsProblems` with `currency`, `dateFieldPropsProblems`, `textFieldPropsProblems` with `maxLength`), so a column's bounds mean what the atom's mean; problems are re-pathed under the column. Field names unique through a `Set`; `formula` only on `number`, `money`, `date`; `total` only on `number`, `money`.
- **`fixedRows`** is `const: true`, like the Tree's `pert`; `label` is the grid's caption and the shell's hint label (`labelOf` reads `props.label`).

*Alternatives:* a `currency` for the whole item (AD-7 allows it; one key per money column is plainer to teach); `readOnly` or `required` per column; a pick column (proposal, open question 2).

### 3. One cell check, and the bound each atom words (AD-10)

`cells.ts` exports `tableCellProblems(value, column)`: the cell's type, then the input atom's own result check (`numberFieldResultProblems`, `moneyFieldResultProblems` over `{amount, currency}`, `dateFieldResultProblems`, `textFieldResultProblems` with `maxLength` defaulting to `TABLE_TEXT_MAX_CHARS`, a boolean for a toggle), through the same projection. `tablePropsProblems(props, origin)` runs it on every cell, for the agent (`origin` `agent`: the view prefix refused in row IDs) and for an edited value (`edited`: allowed), so `ask`, `update`, `ask-core` and the board's reader give one verdict.

The view needs to say which bound a value breaks. Today each atom's reader restates the order of the checks to choose its words. `contract` gains, beside each atom's result check, `numberFieldBound(value, props)` (`whole`, `min`, `max`, `step` or undefined), `moneyFieldBound(amount, props)` (`min`, `max`) and `dateFieldBound(date, props)` (`min`, `max`), each the first bound the check refuses in the order the view's readers word them (whole, minimum, maximum, step), and a code exactly when the check refuses; the atoms' `read.ts` switch on them (task 4.1, their tests unchanged), and the Table's reader does the same with the same string keys (`field.whole`, `field.atLeast`, …). One rule, two wordings of one code. A text cell over its limit is worded by the Table's own key, `table.entry.textTooLong`, never the Tree's (review S-4 of review-table-g5).

*Alternative:* exporting the view's readers to `widgets` through the port or a library chunk (AD-9 allows a widget only the port; `document-review` amends AD-9 for its Markdown chunk, and a second amendment for three functions is not worth a chunk).

### 4. Formula columns in the graph (open question 3; AD-13 amended in place, block 1)

- **Row reference.** `contract`'s grammar gains `ROW_REFERENCE_PREFIX` (`@`); the lexer reads `[@field]` as `{form: "row", field}`; `referenceText` gives `@field`, so details quote it as written. `resolveReference` takes the node's own address: on `item.child.field` a row reference resolves to `item.child.<field>`; on any other node it is `missing-reference`. Excel's `[@Qty]` is the form an agent already knows.
- **Column formulas.** `FieldsItem` gains `columns?: Fields` (formula inputs only): `indexChildren` adds, after each top-level child's own fields, one entry per column at `item.child.field`, carrying its column's name; a child holding the field is a `GraphSourceError`. Deeper children get no column (the Table is flat).
- **Parsed once.** `buildGraph` keeps a `Map` from formula text to `checkFormula`'s result for one build, so 200 rows of one column parse it once; resolution stays per node.
- **Single reads.** A column entry whose checked references hold a wildcard or a range reads as `over-limit` ("a column formula reads single fields"), before resolution. This is the input-side bound of decision 13: with it a row's work is at most its formula's references (about 100 in 500 characters, a reference and its operator taking at least five), never rows × rows.
- **One warning per column.** After the build, warnings at column entries are grouped by item, column, kind and detail into one, addressed `item.*.field`; nodes keep their own errors. `ask-core`'s `formulaWarnings` passes the address through molecule addressing unchanged (task 3.2 checks a `*` survives it).

*Alternatives:* the Table's source writing each row's formula with explicit references (`[costs.pm.days]`): a text rewrite over a grammar with text literals, 200 parses, and 200 warnings; wildcards in column formulas with a product bound (rows × references), harder to teach and to check at send time.

### 5. The Table's graph source

`BOARD_SOURCES.table` (`compute/src/table-source.ts`): one `fields` item with `id`; `fields` holding each total column's node `{type, formula: "SUM([<id>.*.<field>])", currency?}`; `children` one per row in order, each holding every input column (`null` when absent, so the node set depends only on columns and row IDs) with money in the column's currency, text as `text`, toggle as `boolean`; `columns` holding each formula column with its type and, for money, its currency (AD-13: a summed money column has one fixed currency). Built with `Object.fromEntries` and own-key reads, so `__proto__` and `constructor` stay data. A Table with no rows gets totals of 0 (an empty sum, as in Excel; a wildcard over no node would be a `missing-reference`), so its source writes the formula `0` for each total. `compute` imports no registry; the existing test that every type declaring derived values has a source covers it.

### 6. Changes and the edited value (AD-20)

`TABLE_SHAPE` is `{elements: "rows"}`: every key of a row but `id` is a field. `table-changes.json` is the output format's change list narrowed by `allOf` to `add`, `remove` and `set` (a reordered edited value gives a `move`, which falls outside it and is refused). A value whose `columns`, `label` or `fixedRows` differ from the revision's fails the round trip already (`roundTripProblem`); `tablePropsProblems` keeps formula fields out of rows, so no `set` targets one. No result: the Table is a review widget, and an untouched Table is unchanged (AD-10).

### 7. Derived values and the answer (open question 8)

`derived.problem(rest, props)` accepts `[field]` for a total column and `[row, field]` for a formula column and a row of `props`, the edited value when the answer holds one (task 0.2 records which props `ask-core` passes). `TABLE_ANSWER_DERIVED` in `contract` states the answer's rule (`decimals: 6`, `itemTotals: true`, `onlyChanged: true`), as `TREE_PERT_ANSWER_DERIVED` does; `widgets/src/table/model/derived.ts` applies it: numbers through `compute`'s `roundNumber`, money through `roundNumber` at `minorUnitsOf(currency)` and written with that many decimals, dates as given, booleans and text never (no such formula column). "Changed" compares the rounded value, or the error, with the sent graph's (`sentGraph`); an added row's cells always count. The component reports them through `onDerived` on every graph change.

Money past the bound (review S-1 of review-table-g5; proposed default accepted under the PO's unattended handoff, 2026-11-08; the PO may revisit): a money value a formula gives, a formula cell or a total, whose rounded value has more than `AMOUNT_MAX_INTEGER_DIGITS` (15) integer digits, the bound of every amount the contract carries (`AMOUNT_PATTERN`, `locale/amount.ts`), is no value. `moneyDecimal` gives undefined for it and never writes an exponent form; the answer's derived values leave it out, as a value in error; for "Changed" and the derived mark it is a `value` error; the board shows the cell "—" with its row's error, or the total's under the Total row, worded by the existing kind `value` (`FORMULA_ERROR_KINDS`: "a value of the wrong kind or out of range", Excel's #NUM!; its string `table.problem.value`), so no kind is added. The graph is unchanged: a formula that reads that node reads the graph's number.

### 8. Cell entries (open question 6; AD-20 amended in place, block 2)

- **Contract.** The board protocol's draft record gains, per question, `cellEntries`: item ID → object whose keys match `^[A-Za-z0-9_-]{1,64}\.[a-z][A-Za-z0-9]{0,63}$` (`row.field`), values 1 to `ENTRY_MAX_CHARS`, at most `CELL_ENTRIES_MAX` (2,000, the cells of a Table at its bounds) per item; `draftRecordProblems` checks its item keys as it checks `entries`'. A minor addition: an optional field.
- **Port.** `ItemProps` gains, appended, `cellEntries: ReadonlyMap<string, string>` (empty when none) and `onCellEntriesChange(entries)`, which replaces the item's whole map, each text cut at 200 code points, empty ones dropped.
- **Shell.** A `cellEntries` draft store beside the entries store, mirrored, restored and dropped with the item's value (`shell/cell-entries.ts` holds the store's functions and `entriesWithCells`; `board-draft.ts` mirrors and restores); `ENTRY_ITEM_TYPES` gains `table`; one function, `entriesWithCells(entries, cellEntries)`, gives every entry reader (the block, the hint, `BoardContent.entries` through `withEntries`, held work) an entry under an item's ID while any of its cells holds one, so `fieldBlock`, the Tabs mark and Submit need no change of their own. `board-page/unsent-work.ts` counts them and copies each as `<item> · <row> · <column>: <text>`.
- **Component.** A cell's entry shows as typed with its field error; leaving keeps it; Enter keeps the editor; correcting it to a value or clearing it removes it; an entry in a row the user deletes goes with the row.

*Alternatives:* the Tree's refusal rule (no protocol change; text lost on leaving, against EXPERIENCE's Input atoms row, which names the Table); one entry per Table with its cell encoded in the text (a 200-character slot, and a format inside a string).

### 9. The component (`packages/widgets/src/table/`)

Pure modules under `model/` (plain, tested without a DOM): `columns.ts` (kinds, alignment, how a cell shows: `formatNumber` with the unit, `formatMoney`, `formatDate`, toggle states), `read.ts` (a cell's text through the parsers and decision 3's codes: value with its echo for a number, money or date, as the atoms' echo, empty or entry with error and echo; review S-5), `edits.ts` (`setCell`, `addRow`, `deleteRow`, each a new frozen value; `nextViewId`), `focus.ts` (the current cell and the key reducer), `marks.ts` (changed cells, added and deleted rows, the counter), `derived.ts` (graph reads: values, column problems from the build's `item.*.field` warnings, row errors, totals; the answer's derived values), `fits.ts` (`tableValueFits`, `shownTable`), `text.ts` (`cutCodePoints`, text in code points). Components: `index.tsx` (registers `table` with `{shape, name, valueFits}`), `widget.tsx` (the component, with `classes.ts`), `grid.tsx`, `row.tsx`, `cell-editor.tsx` (a text input on the Tree's editor pattern, never `type="number"`), `toolbar.tsx` (its own Tab stop, `toolbarFocus`), `total-row.tsx`. A toggle cell is a `role="gridcell"` with `aria-checked` (true, false, mixed for unset), no nested control and no editor (its keys: decision 10). The grid reads `liveGraph(board)` and `sentGraph(board)` from the `board-graph` chunk.

`valueFits(value, props)`: columns, `label` and `fixedRows` deep-equal to `props`', and `tablePropsProblems(value, "edited")` empty; the shell keeps a draft across an agent's change only while it fits, its cell entries with it. The component shows a held value only while it fits its props, else the agent's props, untouched, as the Kanban's `shownProps` does (`shownTable`); it never fails on a held value, so after a reload a draft made on an earlier revision leaves the card usable and "Keep mine" drops it with its cell entries (task 7.1's finding; proposed default accepted under the PO's unattended handoff on 2026-11-08).

An open editor keeps the cell's column and value as they were when it opened (`EditingCell`); when the agent's change alters either, or removes the row or the item, the editor closes without committing (`editingStands`, review-table-g6 X-1 and review-table-g7 X-2) and its state is dropped, so it never reopens on its own (X-3); an unchanged text commits nothing; only entries of input cells are reported. A row draws again only when its own data differ (`table/row-equal.ts`, `rowPropsEqual`, the memo's comparator, task 6.11), so an edit of the worst form redraws one row.

### 10. Rows and on/off cells (open question 5)

"Add row" inserts after the current row, or at the end, an empty row `u-<n>` (`nextViewId`), and makes its first input cell current without opening an editor. "Delete row" removes the current row, no confirmation, and makes the next row current, else the previous. Both are disabled while an editor is open. Until the grid has first taken the focus no row is current: "Add row" adds at the end and "Delete row" is disabled (`aria-disabled`, the toolbar's rule), so a press never removes a row the user did not choose; once the grid has had the focus, its current row stays current while the focus is in the toolbar. At `TABLE_MAX_ROWS` "Add row" stays enabled and refuses, saying so beside the toolbar and in a polite live region. A deleted row leaves the grid; the counter counts it.

An on/off cell has no text editor (review S-3 of review-table-g5; proposed default accepted under the PO's unattended handoff, 2026-11-08; the PO may revisit): Space, Enter, F2 and a click switch it, not set or off to on and on to off; Delete or Backspace returns it to not set (an empty cell); it never holds a cell entry, so a restored or kept cell entry naming a toggle cell is dropped as one naming no input cell (task 4.2's rule).

### 11. Formula errors and marks on the board (open question 11)

Column problems (build warnings at `item.*.field`) show once in a field error over the grid ("Amount: the formula reads a field or an item that does not exist."), their cells "—" in `{colors.muted-foreground}`. Errors are filtered by their origin address (the `FormulaError`'s `address`; review S-2 of review-table-g5; proposed default accepted under the PO's unattended handoff, 2026-11-08; the PO may revisit): an error whose origin is a cell or the total of a refused column (`item.<row>.<field>` or `item.<field>`, `field` refused) shows only over the grid, so the cells of columns and totals that read it show "—" with no row or total error; an error of their own still shows. Other node errors show under their row, naming the column (`errorSpan` from `shared/field-error.ts`); a total's under the Total row. Wording per kind in the view's tables, the detail never shown (it is agent text and English). The derived mark is the Gantt plan's (`change-subtle` fill, no border); it is not counted.

### 12. Recalculation in place

`board-graph/recalc.ts` gains a Table case: when a Table's columns and row IDs, in order, are unchanged, each changed input cell is one `InputChange` (`item.row.field`, the new scalar or `null`), whose value type widens from `number` to `compute`'s `Scalar`; anything else rebuilds. The Gantt's cases are unchanged.

### 13. Bounds and their gates (open question 7)

The input bounds are decision 2's; the cost they admit is timed on its worst form: 200 rows, 10 columns, one input number column and nine formula columns of 500 characters, each `[@a]+[@a]+…` chaining to the previous column (about 100 references), all totalled. Gates:

| Step | Where | Gate |
|---|---|---|
| Build and first evaluation | Bun and Node 24, fresh process | 150 ms |
| One input cell set and recalculated | Bun and Node 24 | 10 ms |
| Rebuild after a row added | Bun and Node 24 | 150 ms |
| Board visible with that Table, from the board document's arrival | WebKit, cold, 1,280 px | 1,500 ms |
| A committed cell edit painted | WebKit | 100 ms |
| A row added painted | WebKit | 250 ms |

The fan-out form (review U-1: each formula reads the item's own total, so a cell set recalculates 1,810 nodes) has its own edit gate: 150 ms in WebKit, 100 ms in Chromium. Task 6.4 measured 98 to 105 ms in WebKit, 4 to 5 of them in `compute`, the rest the paint of 200 rows: every row's computed cells change in this form, while an edit of the worst form redraws one row since task 6.11 (88 to 93 ms). `TABLE_MAX_ROWS` stays at 200 and the worst form keeps 100 ms (decision of 2026-11-08 under the PO's unattended handoff: input-side bounds, pathological residual risks as known limits).

Task 0.4 times today's `compute` on the same form written with explicit references (an upper bound: no parse cache), task 0.5 a static 200 × 10 grid in each engine; task 2.5 and task 6.4 time the built code. A gate missed lowers `TABLE_MAX_ROWS` (to 100, then 50) or `TABLE_FORMULA_MAX_CHARS` through `/opsx:update`, before the group that would rely on the bound; the figures go to CHANGELOG's Known limits. A board of many Tables is bounded per item only, as a board of many Trees is today: a known limit.

### 14. Registration waits for the chunk

As in `atoms` decision 10: `TABLE_WIDGET` joins `WIDGET_TYPES` only in task 6.3; until then tests pass `withWidgetTypes(...TABLE_TYPES)` from `fixtures/table.ts`, which also holds the Table of roles, an edited value, a draft record with a cell entry, an `act`, an answer event and a `fetch` item result, `version` from the constants.

### 15. The skill

The entry's `skill`: a use within `main`'s 200 characters ("a grid of typed columns to edit, with totals and formula columns"), notes within 300 each: the column types and their atoms' bounds, `[@field]` and single reads, totals as `[id.field]`, `fixedRows`, the answer (changes and derived values). Its catalogue line and its link in `SKILL.md` are generated, as `skill-index` made them. Task 6.3 generates the skill with every budget; an overrun stops it for `/opsx:update`.

### 16. Versions

The input format (the props, the compositions), the output format (`table-changes`), the tool envelopes (`fetch`'s composition) and the board document (its composition) take the next minor after `main`'s in task 6.3, the registration; the board protocol (the draft record's `cellEntries`) in task 1.5, the first change to its schema. The Snapshot data, the view manifest and the rest keep `main`'s. Comments, schema descriptions and test titles say "since table-widget". Task 8.2 binds each at the base's minor plus one, after `layouts`, `form-widget`, `document-review` and `image-annotation` have bound theirs.

Bound on 2026-11-08, rebased with `git rebase --onto 352664fb edf6e802` onto `form-widget`'s head 352664fb (PR #64, on `origin/main` 90b7009f, which holds `layouts` #60, `skill-index` #61, their archive #62 and the live board updates #63), then with `git rebase --onto origin/main 352664fb` onto `origin/main` 433b4d29 (PR #64 merged; its tree equals 352664fb), which holds the base's minors: input format 1.12 (base 1.11), output format 1.11 (1.10), tool envelopes 1.12 (1.11), board document 1.11 (1.10) and board protocol 1.8 (1.7, `main`'s too); the Snapshot data (1.1) and the view manifest (1.1) are unchanged. The numbers are re-read on `main` just before the merge and rebound if another change has merged first.

### 17. The end-to-end proof

| Scenario | Where |
|---|---|
| The Table of roles asked; a rate lowered, a row added and filled, a row deleted, answered through `collect` (changes and derived values); a cell entry blocking "Answer" across a reload; `fetch` of the item; the agent's `update` with "Keep mine" and with "Reload"; a Table in a Group; a misspelt column formula warned once | browser, session process (task 7.1) |
| A Snapshot of an answered Table, from `file://` | browser (task 7.2) |
| Keyboard, Italian, hover, 200-character words at 1,280 pixels, the worst form's timings | browser (tasks 6.1, 6.2, 6.4, 7.3) |
| One Table answer, pushed by the mod or collected, each configuration, Bun and Node 24 | conformance (task 7.4) |

## Merge points

Borrowed from `origin/main` e87841d5 (task 0.2 records each with its file and line): `WidgetType`, `WIDGET_TYPES`, `widgetTypeOf`, `registryShapeProblems`, `widgetRegistryProblems`, `composeQuestionProps`, `composeBoardDocument`, `composeFetchResult`, `withWidgetTypes`, `ID_PATTERN`, `VIEW_ID_PREFIX`, `ElementShape`, `elementChanges`, `applyElementChanges`, `widgetChangesProblems`, `elementShapeOf`, `widgetItemProblems`, `isFieldName`, `parseCell`, `REFERENCE_WILDCARD`, `FORMULA_MAX_CHARS`, `codePointCount`, `ATOM_LABEL_MAX_CHARS`, `ATOM_NUMBER_BOUND`, `AMOUNT_MAX_INTEGER_DIGITS` and `AMOUNT_PATTERN` (`locale/amount.ts` 14 and 21, read on 2026-11-08 for decision 7), `FORMULA_ERROR_KINDS`, `numberFieldPropsProblems`, `numberFieldResultProblems`, `moneyFieldPropsProblems`, `moneyFieldResultProblems`, `dateFieldPropsProblems`, `dateFieldResultProblems`, `textFieldPropsProblems`, `textFieldResultProblems`, `parseNumber`, `parseAmount`, `parseDate`, `numberEcho`, `amountEcho`, `dateEcho`, `formatNumber`, `formatMoney`, `formatDate`, `minorUnitsOf`, `ENTRY_MAX_CHARS`, `draftRecordProblems`, `DRAFT_RECORD_MAX_CHARS`, `TREE_PERT_ANSWER_DERIVED` (the pattern), `FieldsItem`, `checkFormula`, `parseReference`, `referenceText`, `resolveReference`, `indexSource`, `buildGraph`, `evaluateGraph`, `roundNumber`, `isFormulaError`, `BOARD_SOURCES`, `BoardSource`, `boardGraphSource`, `formulaWarnings`, `checkedFormulaWarnings`, `liveGraph`, `sentGraph`, `inputChanges`, `ItemProps` (`entry`, `onDerived`, `board`), `BoardContent`, `ComponentFacts` (`shape`, `name`, `valueFits`), `register`, `useReadyAfterLayout`, `useStrings`, `useLocale`, `useLanguage`, `say`, `questionTextId`, `nextViewId`, `toolbarFocus`, `errorSpan`, `ENTRY_ITEM_TYPES`, `entryIdsOf`, `cutEntry`, `draftRecordOf`, `restoreDraft`, `unsent-work.ts`, `LIBRARY_CHUNKS` (`compute`, `board-graph`), `COMPONENT_ROOTS`, `widgetChunkProblems`, `build:skills`, `check:skills`, `skills-examples.test.ts`, `component-facts.test.ts`, `hover-audit.browser.ts`, `languages.browser.ts`, `edit-widgets.e2e.ts` (conformance).

Borrowed from `layouts`, not on `main` (branch head edf6e802): `nestedItemsOf` and `mapNestedItems` (`contract/src/nested-items.ts`), `valueItemsOf` and `nestedItemById` (`view/src/nested-items.ts`), `BoardContent.entries` and `withEntries`, `entryIdsOf` walking nested items, `graph-check.ts` handing `boardGraphSource` every item at every depth, `GROUP_WIDGET`, `LAYOUT_WIDGETS`, `layouts.browser.ts` (patterns), `tools/nested-items.test.ts` (this change adds no direct read of `items`; a Table's `rows` are not items).

Borrowed from `form-widget`, not on `main` (branch head 71e4ff16; its view group not built yet): `fieldBlock` (`shell/field-block.ts`) and its readers, which decision 8's `entriesWithCells` feeds; the atoms' props as it extends them (`required`, `minLength`, `pattern`), which decision 2's projections leave out; `PICK_FIELD_WIDGET` (the order of `WIDGET_TYPES`).

Borrowed from `document-review`, not on `main` (design at 24656505): `DOCUMENT_REVIEW_WIDGET` (the order). Its `SKILL_USE_MAX` 70 and index-line form are superseded by `skill-index` (the catalogue `references/items.md`; `SKILL_USE_MAX` stays 200), so this change borrows neither.

Borrowed from `image-annotation`, not on `main` (design at 0ac511ec): `IMAGE_ANNOTATION_WIDGET` (the Table follows it); `ComponentFacts` and the port as it appends to them (this change appends `cellEntries` and `onCellEntriesChange` after its members).

Tasks 0.2 and 8.2 re-check each; a difference stops the work for `/opsx:update`.

Changes in flight:

- **`layouts`** (PR #60): `WIDGET_TYPES`, three of the five sets, `shell/entries.ts` and the entry readers, the port, `graph-check.ts`, `skills/askboard/` (regenerate, never resolve), `chunk-sizes.json`, `CHANGELOG.md`, CLAUDE.md.
- **`form-widget`** (stacked on `layouts`): four of the five sets, the atoms' `checks.ts` (decision 3 adds functions beside its changes, never inside them), `shell/field-block.ts` and its readers, `ComponentFacts`, the strings tables, the skill tests, `chunk-sizes.json`, `CHANGELOG.md`, CLAUDE.md.
- **`document-review`** (stacked on `form-widget`): four sets, `WIDGET_TYPES`, `generate.ts` and the skill's line format and budget, the strings tables, `chunk-sizes.json`, the Accessibility Floor's widget lines (its block 5), `CHANGELOG.md`, CLAUDE.md.
- **`image-annotation`** (proposed; after `document-review`): four sets, `WIDGET_TYPES`, the port, the skill's budget, the Accessibility Floor (its block 4, which this change's block 6 follows), `CHANGELOG.md`, CLAUDE.md.
- Plan: this change is built on `origin/main` after all four have merged; task 0.2 checks it and stops otherwise, unless the coordinator stacks it on `image-annotation`'s branch, which task 0.2 records and task 8.2 rebases with `--onto`.
- **`diagram-render`** (proposed at 9281d923, waiting): `WIDGET_TYPES` order, the input format, the board document and the tool envelopes (whichever merges second rebinds), the skill's budget.
- **PR #59** (archives `atoms`): this change's deltas add requirements only. **`early-benchmark`** and the spikes: no overlap.

Seams this change creates, which later changes borrow once it merges: `ROW_REFERENCE_PREFIX` and the row reference; `FieldsItem.columns` and the one-warning-per-column rule; `BOARD_SOURCES.table`; `tableCellProblems`; `numberFieldBound`, `moneyFieldBound`, `dateFieldBound`; the draft record's `cellEntries`, `CELL_ENTRIES_MAX`, `ItemProps.cellEntries` and `onCellEntriesChange`, `entriesWithCells`; `TABLE_ANSWER_DERIVED`; `TABLE_TYPES`. The sales estimate review, the decision matrix and the Spreadsheet borrow them.

## Risks / Trade-offs

- [The worst form misses a gate in WebKit] → tasks 0.4 and 0.5 time it before any code relies on the bounds, tasks 2.5 and 6.4 again on the built code; a miss lowers a bound through `/opsx:update` (PO rule of 2026-11-07), never a new mechanism such as virtualisation.
- [The fan-out form's edit is painted just over 100 ms in WebKit] → a known limit (decision 13): its gate is 150 ms there, and CHANGELOG's Known limits say so (task 8.1).
- [A forged edited value or draft holds prototype names] → row IDs and fields `__proto__`, `constructor` and `toString` are tested in `contract`, `compute`, `core`, the shell and the component; every map is built with `Object.fromEntries` or `Map` and read with `Object.hasOwn`.
- [A column formula reaches every row's work] → single reads only (decision 4), about 100 references per row; the worst form is the gate's.
- [200 warnings in an `ask` result] → one per column and kind (decision 4); a test over 200 rows.
- [An entry reader misses cell entries, so a path sends past an unreadable cell] → `entriesWithCells` feeds every reader through one function; task 4.3 tests Answer, "Send and switch", Submit, "Select recommended", the held mark and the Tabs mark with a cell entry nested two layouts deep.
- [The atoms' readers change behaviour when they switch to the bound codes] → their tests stay unchanged and pass; the codes come in the readers' order (whole, minimum, maximum, step), and a code exactly when the check refuses.
- [Money derived values drift by binary rounding] → `roundNumber` (Excel's ROUND at 15 significant digits) then the currency's minor units; tests at the half cent and in JPY and BHD; past 15 integer digits a money value is no value, never an exponent form (decision 7).
- [`fixedRows` taught but an agent sends rows the user should not touch] → the teaching says a Table reviews data the user may edit; read-only data goes in a Value or a Text.
- [A column formula naming its own item (`[costs.amount]`) breaks once a molecule prefixes the item's ID] → no Table molecule is in this change, and AD-9's expansion rewrites only parameters today; the sales estimate review's change decides between a rewrite and a self reference.
- [The skill passes its budget] → a use within `main`'s 200 characters; an overrun stops task 6.3 for `/opsx:update`.
- [An in-flight seam merges with another name or shape] → task 0.2 stops for `/opsx:update`.

## Migration Plan

None: five sets widen by one type, its changes and an optional draft field; one session process serves the board page and `board-host`, so their minors move together. Rollback is a revert, then `bun run build:skills`.

## Open Questions

- The proposal's twelve questions carry proposed defaults; task 0.1 records their answers, and a different answer comes back through `/opsx:update` before the groups it touches.
- **Sources that differ**: the spine's Stack and EXPERIENCE's Component per widget put the Table on TanStack Table (decision 1; block 3 of the spine draft, block 4 of the UX draft). DESIGN's Table row calls totals and formula columns "Values in footer rows"; a formula column is a column of computed cells and the totals one footer row (UX block 8). EXPERIENCE's Input atoms row gives a Table's cells the atoms' entries, while its grid-editor sentence names only the Tree's and the Gantt's grids for the refusal rule; this change follows the first (decision 8) and says so in UX block 2.
