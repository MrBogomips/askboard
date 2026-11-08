# UX update draft: Table

**Status: applied on 2026-11-08 in task 0.1; blocks 1, 3 and 6 revised on 2026-11-08 after review-table-g5 (S-2, S-3, S-4), applied by tasks 5.7 (replacements 2 and 3) and 5.8 (replacement 1), as the Revision section below says.** It rests on the proposal's open questions 1, 5, 6, 10 and 11; an answer other than the default changes its blocks first (`/opsx:update`). New strings are marked "(to review)" with the rest of the microcopy (EXPERIENCE, Localization).

How to apply: replace each quoted text in `docs/ux-askboard-2026-10-27/EXPERIENCE.md` or `DESIGN.md`, set `updated:` in each file's front matter to the apply date, then run `openspec validate --all --strict --no-interactive`. Each current text is quoted as it stands on `origin/main` e87841d5; none of the drafts of `layouts`, `form-widget`, `document-review` or `image-annotation` quotes it, except where blocks 1 and 6 append after their rows. Task 0.1 checks that each stands once, word for word, just before the edit.

## EXPERIENCE

### Block 1: Voice and Tone, a Table row after the last widget row

Insert a row after the Image annotation's row of the table with the Italian column (its draft's block 1), else, if `image-annotation` has not merged, after the Chart's row (the row that begins `| Chart | The counter "No points highlighted"`):

```text
| Table | The toolbar's "Add row" and "Delete row" and its name "Table tools"; the counter "No changes", "Your changes: 3"; the Total row's "Total"; a computed column's mark "Computed"; an on/off cell "On", "Off", "Not set"; a cell's name "Rate, row 2"; the refusal "A table holds at most 200 rows."; a text cell over its limit "A text cell holds at most 500 characters."; a column formula's problem "Amount: the formula cannot be read.", "Amount: the formula uses a function AskBoard does not offer.", "Amount: the formula is too long or reads more than one field at a time.", "Amount: the formula reads a field or an item that does not exist.", "Amount: the formula depends on itself.", "Amount: the formula mixes currencies."; a row's "Per day: a value of the wrong kind.", "Per day: division by zero."; a formula cell with no value "—" (to review) | "Aggiungi riga", "Elimina riga", "Strumenti della tabella"; "Nessuna modifica", "Le tue modifiche: 3"; "Totale"; "Calcolata"; "Sì", "No", "Non impostato"; "Tariffa, riga 2"; "Una tabella contiene al massimo 200 righe."; "Una cella di testo contiene al massimo 500 caratteri."; "Importo: la formula non si legge.", "Importo: la formula usa una funzione che AskBoard non offre.", "Importo: la formula è troppo lunga o legge più di un campo alla volta.", "Importo: la formula legge un campo o un elemento che non esiste.", "Importo: la formula dipende da sé stessa.", "Importo: la formula mescola valute."; "Al giorno: un valore del tipo sbagliato.", "Al giorno: divisione per zero." (to review) | FR-11, FR-14, FR-34; OpenSpec change `table-widget` |
```

### Block 2: Component Patterns, Primitives, Input atoms (open question 6)

Current phrase, inside the Input atoms row:

```text
The echo stays on the standalone atoms.
```

Replacement:

```text
The echo stays on the standalone atoms and on a Table cell's editor, and text a Table's cell cannot read, or whose value falls outside its column's bounds, stays in the cell as an entry, as a field's does (OpenSpec change `table-widget`).
```

### Block 3: Component Patterns, Widgets, Table (open questions 5, 6 and 11)

Current row:

```text
| **Table** | The user edits a grid with typed columns. Totals and formula columns follow from the compute graph (Derived value). | FR-11, FR-12, L160 |
```

Replacement:

```text
| **Table** | The user edits a grid with typed columns: text, number, money, date and on/off, each with its input atom's bounds, a money column in one currency. The grid is one Tab stop: the arrow keys move the current cell, Home and End to its row's ends; Enter, F2 or a double-click opens an input cell's editor, which reads the text with the atom's parser in the ask's locale and echoes the value; Enter or leaving commits, Escape restores, and an emptied cell is empty. An on/off cell has no editor: Space, Enter, F2 or a click switches it, not set or off to on and on to off, and Delete or Backspace returns it to not set. Text a cell cannot read, or outside its bounds, stays in the cell with its Field error and blocks "Answer", as a field's entry does, across a reload too. "Add row", after the current row, and "Delete row" sit in the toolbar, another Tab stop, unless the agent fixes the rows; at 200 rows "Add row" says so. Columns declared as formulas and a Total row follow from the compute graph (Derived value) and are read-only; a column formula's problem shows once over the grid, the columns that read it showing "—" with no error of their own from it, an error of one row's values under that row, and none blocks "Answer". Changed cells and added rows take the change highlight, formula cells and totals that moved take the derived mark and are not counted, and the toolbar counts the user's changes. Read-only, the grid stays readable from the keyboard. | FR-11, FR-12, FR-14, L160, AD-10, AD-13; OpenSpec change `table-widget` |
```

### Block 4: Composition and Components, Component per widget, Table (open question 1)

Current row:

```text
| Table | TanStack Table 9.3.1 (headless), with shadcn Table styling and atoms as cells | Typed cells, totals and formula columns from the compute graph, the change highlight | — |
```

Replacement:

```text
| Table | Own grid, no library, with shadcn Table styling; cells read and shown with the input atoms' parsers and formats | The grid and its keyboard, typed cells and their entries, rows added and deleted, totals and formula columns from the compute graph, the change highlight and the derived mark | — |
```

### Block 5: Component Patterns, Changes, values and board states, Field error (open question 11)

Current phrase, inside the Field error row:

```text
An inline error under a field, or under a cell's row in a grid (`{components.field-error}`), for a failing field check, a formula error or an empty required reason (Approval).
```

Replacement:

```text
An inline error under a field, or under a cell's row in a grid (`{components.field-error}`), for a failing field check, a cell's entry, a formula error or an empty required reason (Approval); a Table's column formula problem shows once, over the grid.
```

### Block 6: Accessibility Floor, Keyboard core, a Table line after the last widget line

Insert after the Image annotation's line (its draft's block 4), else after the Document review's (its draft's block 5), else after the Chart's line, which stands on `main` as:

```text
  - Chart: the arrow keys, Home and End move between data points, and Space or Enter highlights or clears the current one.
```

The line to insert:

```text
  - Table: the grid is one Tab stop whose arrow keys move the current cell, Home and End to its row's ends; Enter, F2 or a double-click opens an input cell's editor, Enter commits and Escape restores; Space, Enter or F2 switches an on/off cell and Delete or Backspace returns it to not set; "Add row" and "Delete row" are in the toolbar's Tab stop.
```

### Block 7: Open Items, 24, Single-widget scope (open question 10)

Current phrase:

```text
Decided for the Tree and the Gantt by the OpenSpec change `widget-editing-plus` (open question 11): they offer the editing the molecules add; Table is still open.
```

Replacement:

```text
Decided for the Tree and the Gantt by the OpenSpec change `widget-editing-plus` (open question 11): they offer the editing the molecules add; and for the Table by the OpenSpec change `table-widget` (open question 10): it stays at its FR-11 minimum, optional lines and the minimum margin being the sales estimate review's.
```

## DESIGN

### Block 8: Components, Table (open questions 1 and 11)

Current row:

```text
| **Table** | shadcn Table styling: a header row on `{colors.muted}` with headers in `{typography.label}`, rows separated by 1px `{colors.border}` rules, cells in `{typography.body}`, and numbers and money right-aligned in `{typography.code}`. Editable cells are input atoms, and totals and formula columns are Values in footer rows, the first set off by a `{colors.border-strong}` rule, with the row labels semibold. Changed cells take the change highlight, and a failing cell shows a `field-error` (F-36). Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html), inside the sales estimate review; not mocked: a failing cell. |
```

Replacement:

```text
| **Table** | AskBoard's own grid with shadcn Table styling: an optional caption in `{typography.label}`; a header row on `{colors.muted}` with headers in `{typography.label}`, a computed column's header carrying an "ƒ" mark in `{colors.muted-foreground}`; rows separated by 1px `{colors.border}` rules, cells in `{typography.body}`, and numbers and money right-aligned in `{typography.code}`. Input cells read as text until edited, when an Input fills the cell; formula cells are Values. The Total row is a footer row set off by a `{colors.border-strong}` rule, its label semibold. The current cell is outlined 2px in `{colors.primary}`. Changed cells take the change highlight, an added row the change hue along its start, and formula cells and totals that moved the derived mark (`{colors.change-subtle}` fill, no border) (F-36). A cell holding an entry shows its text with a `{colors.destructive}` border and a `field-error` under its row; a column formula's problem shows one `field-error` over the grid, its cells "—" in `{colors.muted-foreground}`. Text wraps inside its cell, and a grid wider than the frame scrolls inside it. Rows are 32px compact and 40px comfortable. Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html), inside the sales estimate review; not mocked: a cell entry, an added row, a column problem. |
```

## Revision of 2026-11-08 (review-table-g5)

Blocks 1, 3 and 6 above hold the revised text. EXPERIENCE holds the text task 0.1 applied; tasks 5.7 and 5.8 made these replacements in it, each current phrase standing once before (`grep -c -F`) and its replacement once after:

1. Block 1, English column: `the refusal "A table holds at most 200 rows.";` becomes `the refusal "A table holds at most 200 rows."; a text cell over its limit "A text cell holds at most 500 characters.";`. Italian column: `"Una tabella contiene al massimo 200 righe.";` becomes `"Una tabella contiene al massimo 200 righe."; "Una cella di testo contiene al massimo 500 caratteri.";`.
2. Block 3: `Space switches an on/off cell, unset to on, then off and on.` becomes `An on/off cell has no editor: Space, Enter, F2 or a click switches it, not set or off to on and on to off, and Delete or Backspace returns it to not set.`; `a column formula's problem shows once over the grid, an error` becomes `a column formula's problem shows once over the grid, the columns that read it showing "—" with no error of their own from it, an error`.
3. Block 6: `Space switches an on/off cell; "Add row"` becomes `Space, Enter or F2 switches an on/off cell and Delete or Backspace returns it to not set; "Add row"`.
