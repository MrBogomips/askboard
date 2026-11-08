# Spine update draft: table-widget

**Status: draft, to apply in task 0.1.** It rests on the proposal's open questions 1, 3, 4 and 6; an answer other than the default changes its block first (`/opsx:update`). Each block quotes the current phrase exactly as it stands on `origin/main` e87841d5; none of the drafts of `layouts`, `form-widget`, `document-review` or `image-annotation` quotes these phrases. AD-13 and AD-20 are amended in place; no AD is added or renumbered. The PRD needs no change.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: check that each current phrase stands once (`grep -c -F`), replace only the phrase (the rest of its line stays), set `updated:` to the apply date, and append to `sources:` the line `'OpenSpec change table-widget, proposal.md, open questions 1, 3, 4 and 6: the Table on its own grid, column formulas with row references and single reads, totals as item fields, cell entries in the draft (accepted under the PO''s unattended handoff, <date>)'`. Then run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these phrases meanwhile, keep its text, apply this block's meaning to it, and say so in task 0.1's note.

## Block 1: AD-13, row references, column formulas and totals (open questions 3 and 4)

AD-13, Rule, References, first bullet. Current phrase:

```text
A range of cells is `[item-id.A1:B3]`: it reads row by row and holds at most 65,536 cells. The grammar lives in `contract`.
```

Replacement:

```text
A range of cells is `[item-id.A1:B3]`: it reads row by row and holds at most 65,536 cells. In a formula on a child's field, `[@field]` reads that field of the same child, as Excel's this-row reference. A Table's column formula, which every row holds, reads its own row so and other nodes one at a time, never through a wildcard or a range, so that a row's work is bounded by its formula's length; its problems are one warning per column and kind, addressed `[item.*.field]`. A Table's totals are fields of the item, `[item.field]`, each the SUM of its column over the rows. The grammar lives in `contract`.
```

## Block 2: AD-20, a Table's cell entries in the draft (open question 6)

AD-20, Rule, Drafts, first bullet. Current phrase:

```text
and the entries: the text an input atom holds that gives no value, which keeps its question from being answered until the user corrects or clears it.
```

Replacement:

```text
and the entries: the text an input atom, or a Table's cell by row and field, holds that gives no value, which keeps its question from being answered until the user corrects or clears it.
```

## Block 3: Stack, no TanStack Table (open question 1)

Stack table. Current line, removed whole:

```text
| `@tanstack/react-table` (Table, Tree, Spreadsheet, the Gantt's grid) | 9.3.1 |
```

Reason: it was never installed. The Tree, the Gantt's grid (`tree-widget`, `gantt-widget`) and the Table (`table-widget`, design decision 1) are AskBoard's own grids; the Spreadsheet's change decides its own grid and adds a row if it adopts a library. SOLUTION-DESIGN §9's status table, which records what the adoption rule admits, stays as it is.
