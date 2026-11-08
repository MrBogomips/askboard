# Proposal

## Why

FR-11's Table row ("Edits a grid with typed columns", derived values "Totals, columns declared as formulas") is the Numbers family's first widget, and the base the sales estimate review and the decision matrix (FR-15, UJ-3) are built on. It is also the first item where the agent writes formulas, so it delivers FR-14 on the board: a column defined by a formula, recomputed as the user edits (FR-12), reported to the agent when sent and shown as an error when it fails (AD-13).

## What Changes

- **The Table's registry entry** (FR-11, FR-18, AD-7): a `table` item with `columns` (1 to 10) and `rows` (0 to 200), an optional `label` and `fixedRows`. A column has a `field`, a `label` and a type: `text`, `number`, `money`, `date` or `toggle`, with the bounds of the matching input atom (FR-13) and a fixed currency for money. A column with a `formula` is computed and read-only; a number or money column may declare `total: "sum"`. A row is its ID and one value per input column, absent when empty.
- **One cell check** (AD-10, NFR-10): `contract` checks every cell against its column with the input atom's own result check, for the agent's props, the user's edited value in `ask-core` and the board's cell reader alike.
- **Formula columns and totals in the compute graph** (FR-12, FR-14, AD-13, amended in place): `[@field]`, Excel's this-row reference, reads a field of the formula's own row; a column formula reads single fields only (no wildcard, no range) and holds at most 500 characters; a total is `[item.field]`, the SUM over the rows. A column formula's problem is one warning per column, never per row, and never refuses the ask or the answer.
- **Typed cells on the board** (FR-11, FR-13, FR-34, NFR-12): AskBoard's own grid, one Tab stop, with the atoms' parsers and echoes in the ask's locale (`parseNumber`, `parseAmount`, `parseDate`, ISO 4217's minor units). Text a cell cannot read, or whose value breaks its column's bounds, stays in the cell as a **cell entry** with its field error, is kept with the draft across a reload, and disables "Answer" until corrected or cleared (AD-20, amended in place).
- **Rows** (AD-7): "Add row" and "Delete row" unless the agent sets `fixedRows`; rows the user adds get view-made IDs.
- **The answer** (FR-18, FR-20, AD-20): the generic `changes` over the rows (`add`, `remove`, `set`), no result; the derived values are the totals and the formula cells of added or changed rows. Changed cells take the change highlight, derived values that moved take the derived mark, and a counter counts the user's changes.
- **The skill**: the Table's teaching text and index line, in the format and bound `document-review` sets, within the 9,000-character budget.
- **Versions** (askboard-contract-versioning): the input format, the output format, the tool envelopes, the board document and the board protocol (the draft record's cell entries) each take the next minor after `main`'s, bound at the rebase.
- **No new dependency**: AskBoard's own grid, as the Tree's and the Gantt's are; the spine's Stack row of TanStack Table, which no change installed, goes, and the Spreadsheet's change decides its own grid.
- **Not in this change**: the sales estimate review and the decision matrix molecules (optional lines, the minimum margin, scores); sorting, filtering, reordering, resizing or hiding columns; a pick (Choice) column, required cells and patterns; a calendar in date cells; aggregates other than the sum; formula columns of text or booleans; cells holding their own formulas (the Spreadsheet).

## Capabilities

### New Capabilities

None: the behaviours belong to capabilities that E1, `compute-engine` and `widget-registry` created.

### Modified Capabilities

- `contract`: the `table` type (props, columns, cell check, changes, derived declarations, teaching text), the row reference in the formula grammar, the draft record's cell entries, the five sets' next minors.
- `compute`: row references, column formulas parsed once and checked for single reads, one warning per column, the Table's graph source with its totals.
- `core`: Table answers (changes, derived addresses, cells refused), the send-time warnings of a Table, cell entries held in the draft record and never exposed.
- `view-and-widgets`: the Table component (grid, typed cells, editing, cell entries, rows, totals and formula columns, change marks, keyboard, read-only and Snapshot views, strings) and the shell's cell entries.

## Impact

- Code: `packages/contract` (`src/widgets/table/`, `src/formula/grammar.ts`, the draft record schema and `draft-record.ts`, the atoms' bound codes, the five set modules, fixtures), `packages/compute` (lexer, resolution, build, `board-sources.ts`), `packages/core` (tests; no product code expected), `packages/view` (`catalog/port.ts`, `shell/` cell entries, `board-page/unsent-work.ts`, the atoms' readers, strings), `packages/widgets` (`src/table/`, `src/board-graph/recalc.ts`), `skills/askboard/` (regenerated), `packages/view/chunk-sizes.json`, `CHANGELOG.md`, `CLAUDE.md`.
- Documents: the spine (AD-13 and AD-20 amended in place, the Stack's TanStack row) through `spine-update-draft.md`; EXPERIENCE and DESIGN through `ux-update-draft.md`. No PRD change.
- Merge points: `layouts` (PR #60), `form-widget`, `document-review` and `image-annotation`, in that order before this change (design.md, Merge points).
- IDs served: FR-11, FR-12, FR-13, FR-14, FR-18, FR-19, FR-20, FR-22, FR-26, FR-34; NFR-1, NFR-5, NFR-10, NFR-12; SM-1, SM-5; R4, R6. ADs: AD-1, AD-6, AD-7, AD-8, AD-9, AD-10, AD-13, AD-15, AD-19, AD-20. UX: EXPERIENCE Component Patterns (Widgets: Table; Derived value; Field error; Change highlight; Input atoms), Composition and Components (Component per widget: Table), Accessibility Floor (Keyboard core, Tab order), Widget Scope, Open Items 24; DESIGN Components (Table, Derived value, Field error).

## Open questions for the PO

Each carries a proposed default. Task 0.1 records each answer under its question before anything relies on it; under the PO's unattended handoff the answer reads "proposed default accepted under the PO's unattended handoff".

1. **Grid component.** *Default:* AskBoard's own grid in `widgets/src/table/`, as the Tree's and the Gantt's are; no dependency. TanStack Table's headless row models, sorting, filtering and column sizing serve nothing in the Table's minimum, while the editing, the keyboard, the entries and the graph values are AskBoard's own either way. *Alternative:* TanStack Table 9.3.1 as EXPERIENCE names it, a new library chunk.
2. **Column types.** *Default:* `text`, `number`, `money`, `date` and `toggle`, each taking the bounds of its input atom (`min`, `max`, `step`, `integer`, `unit`; a money column's required `currency`, `min`, `max`; a date's `min`, `max`; a text's `maxLength`). *Alternative:* add a pick column, `required`, a text `pattern` or a per-column read-only flag.
3. **Formula columns.** *Default:* `[@field]` reads the row's own field; a column formula reads single fields only (its row's, another item's, or a total), holds at most 500 characters and gives a number, money or a date. *Alternative:* wildcards and ranges in column formulas, with a cost bound on rows times references.
4. **Totals.** *Default:* `total: "sum"` on a number or money column, addressable as `[item.field]`, shown in a Total row. *Alternative:* other aggregates, or a total written as a formula.
5. **Rows.** *Default:* "Add row" (after the current row) and "Delete row", no confirmation; a deleted row leaves the grid and is counted; `fixedRows: true` keeps the agent's rows; no reordering. *Alternative:* deleted agent rows kept struck through with "Restore row"; reordering.
6. **Unreadable cell text.** *Default:* a cell entry, as the atoms' entries: kept in the cell with its field error, restored after a reload, blocking "Answer"; the editor echoes the parsed value as the atoms do. *Alternative:* the Tree's grid rule (refused on Enter, dropped on leaving), with no board-protocol change.
7. **Bounds.** *Default:* 200 rows, 10 columns, a text cell of 500 code points, labels of 200, a column formula of 500 characters; lowered before the component if the timings of tasks 0.4, 0.5 or 2.5 exceed their gates. *Alternative:* other figures.
8. **The answer's derived values.** *Default:* every total, and the formula cells of added rows and of rows whose value differs from the board as sent; numbers rounded half away from zero to 6 decimals, money as a decimal string at its currency's minor units, dates as `full-date`; a value in error never. *Alternative:* every formula cell, or none but the totals.
9. **Date cells.** *Default:* typed and read by the DateField's parser, with no calendar. *Alternative:* the DateField's calendar popover in the cell editor.
10. **Single-widget scope** (EXPERIENCE Open Items 24). *Default:* the Table stays at its FR-11 minimum, which is its ceiling; optional lines and the minimum margin belong to the sales estimate review. *Alternative:* the molecule's scope on a lone Table.
11. **Formula errors on the board.** *Default:* a column formula's problem shows once, over the grid, naming the column, and its cells read "—"; an error that depends on a row's values (a value of the wrong kind, a division by zero) shows under that row; a total's under the Total row; none blocks "Answer". *Alternative:* every error under its row.
12. **Label.** *Default:* an optional `label` (1 to 200 code points) captions the grid and names it in the "Answer" hint; without it the hint names the item ID. *Alternative:* a required label.
