# UX update draft: LaTeX, Kanban and Timeline

**Status: applied on 2026-11-07 (task 0.1, blocks 1 to 10).** The proposal's open questions 3 to 7 carry their answers of 2026-11-07, taken under the PO's unattended handoff; a question answered otherwise changes its blocks first (`/opsx:update`). New strings are marked "(to review)" with the rest of the microcopy (EXPERIENCE, Localization, Italian microcopy). Task 5b.3 extended Blocks 1 and 2 with the wordings group 5 added in code (the LaTeX's refused-command errors, the Timeline's range across two years, the Kanban column's name and the toolbars' names), and task 7.1 wrote them into EXPERIENCE, with the LaTeX's other texts and Block 3's refusals, bounds and render queue.

How to apply: replace each quoted text in `docs/ux-askboard-2026-10-27/EXPERIENCE.md` or `DESIGN.md`, set `updated:` in each file's front matter to the apply date, then run `openspec validate --all --strict --no-interactive`. Task 0.1 checks that each current text stands once, word for word, just before the edit. A phrase block replaces only the quoted phrase; the rest of its line stays.

## EXPERIENCE

### Block 1: Voice and Tone, Ranking and Kanban row

Current:

```text
| Ranking and Kanban | "Keep this order", "Move up", "Move down", "Move to…"; the Ranking's counter "No changes", "Order kept", "Your changes: 2 moved" (to review) | "Mantieni quest'ordine", "Sposta su", "Sposta giù", "Sposta in…"; il contatore "Nessuna modifica", "Ordine mantenuto", "Le tue modifiche: 2 spostati" (to review) | L160, TC §2.1, §2.2; OpenSpec change `approval-scale-ranking` |
```

Replacement:

```text
| Ranking and Kanban | "Keep this order", "Move up", "Move down", "Move to…"; the Ranking's counter "No changes", "Order kept", "Your changes: 2 moved" (to review); the Kanban's counter "No changes", "Your changes: 2 moved", a card's name "Fix login, in To do", a column's name "To do, 2 cards" ("To do, 1 card") and its toolbar's name "Kanban tools" (to review) | "Mantieni quest'ordine", "Sposta su", "Sposta giù", "Sposta in…"; il contatore "Nessuna modifica", "Ordine mantenuto", "Le tue modifiche: 2 spostati"; il contatore del Kanban "Nessuna modifica", "Le tue modifiche: 2 spostate", il nome di una scheda "Correggi il login, in Da fare", il nome di una colonna "Da fare, 2 schede" ("Da fare, 1 scheda") e il nome della sua barra "Strumenti del Kanban" (to review) | L160, TC §2.1, §2.2; OpenSpec changes `approval-scale-ranking`, `latex-kanban-timeline` |
```

### Block 2: Voice and Tone, Scale row, then a LaTeX row and a Timeline row

Current:

```text
| Scale | "Not set" while no value is set; values and the unit in the ask's locale ("12.5 %", "12,5 %") (to review) | "Non impostato" (to review) | FR-11, TC §2.5; OpenSpec change `approval-scale-ranking` |
```

Replacement:

```text
| Scale | "Not set" while no value is set; values and the unit in the ask's locale ("12.5 %", "12,5 %") (to review) | "Non impostato" (to review) | FR-11, TC §2.5; OpenSpec change `approval-scale-ranking` |
| LaTeX | "LaTeX source", "Preview"; the parse error "This expression does not render: {message}", KaTeX's message with its control characters shown as marked escapes, as an agent-written label's are; the fallback "The expression could not be drawn."; the field errors of a source the item does not allow, each naming the command or the depth: "This expression defines a macro with {command}, which a LaTeX item does not allow. Remove it before you answer." (a macro definition), "This expression uses {command}, one of KaTeX's internal commands, which a LaTeX item does not allow. Remove it before you answer." (a name holding `@`), "This expression uses {command}, which a LaTeX item does not allow. Remove it before you answer." (any other refused command) and "This expression nests {depth} levels deep, more than the limit of {limit}. Simplify it before you answer." (a nest past the limit); the too-complex error "This expression is too complex to preview. Simplify it to see it drawn."; the counter "Your changes: expression edited" (to review) | "Sorgente LaTeX", "Anteprima"; "Questa espressione non si visualizza: {message}", con il messaggio di KaTeX e i suoi caratteri di controllo mostrati come escape segnati; il ripiego "Non è stato possibile disegnare l'espressione."; gli errori del campo per un sorgente che l'elemento non ammette, ognuno con il comando o la profondità: "Questa espressione definisce una macro con {command}, che un elemento LaTeX non ammette. Rimuovila prima di rispondere.", "Questa espressione usa {command}, uno dei comandi interni di KaTeX, che un elemento LaTeX non ammette. Rimuovilo prima di rispondere.", "Questa espressione usa {command}, che un elemento LaTeX non consente. Rimuovilo prima di rispondere." e "Questa espressione ha {depth} livelli di annidamento, oltre il limite di {limit}. Semplificala prima di rispondere."; l'errore di troppa complessità "Questa espressione è troppo complessa per l'anteprima. Semplificala per vederla disegnata."; "Le tue modifiche: espressione modificata" (to review) | FR-11; OpenSpec change `latex-kanban-timeline` |
| Timeline | "Move earlier", "Move later", "Move to lane…"; the counter "No changes", "Your changes: 2 moved"; an entry's name "Checkout, Jan 5 to Jan 9, 2026, Web" and "Launch, milestone, Mar 2, 2026, Mobile", and across two years "Release, Dec 28, 2026 to Jan 3, 2027, Web" (both years named, so that the start is never misdated); its toolbar's name "Timeline tools"; dates in the ask's locale (to review) | "Sposta prima", "Sposta dopo", "Sposta nella corsia…"; "Nessuna modifica", "Le tue modifiche: 2 spostati"; "Checkout, dal 5 gen al 9 gen 2026, Web", "Lancio, traguardo, 2 mar 2026, Mobile", e su due anni "Rilascio, dal 28 dic 2026 al 3 gen 2027, Web"; il nome della sua barra "Strumenti della timeline" (to review) | FR-11; OpenSpec change `latex-kanban-timeline` |
```

### Block 3: Component Patterns, Widgets, LaTeX row

Current:

```text
| **LaTeX** | The user reads and edits one expression: a source field with a live preview, and the parse error shown while the source does not parse. | FR-11, L156, L160 |
```

Replacement:

```text
| **LaTeX** | The user reads and edits one expression: a source field with a live preview, and the parse error shown while the source does not parse. The preview keeps the last expression that rendered; one that never rendered leaves it empty. A parse error does not block "Answer": the answer carries the expression as written, which may be empty, as the agent's may be. The field takes the change highlight while it differs from the agent's expression. KaTeX's link, image and HTML commands are off, and no macro outlives its render (AD-8): a macro definition, a KaTeX internal command (a name holding `@`) or a nest past the limit is refused with a field error naming the command, or the depth and the limit, and so is any other command the item does not allow. An expression whose KaTeX output passes the board's bounds shows "too complex to preview" and does not block "Answer". The previews draw one at a time, an edited one first, so a board of many expressions stays responsive while they arrive. | FR-11, L156, L160; OpenSpec change `latex-kanban-timeline` |
```

### Block 4: Component Patterns, Widgets, Timeline row

Current:

```text
| **Timeline** | The user moves milestones and ranges across lanes, on the Gantt's time axis. | FR-11, L160 |
```

Replacement:

```text
| **Timeline** | The user moves milestones and ranges across lanes, on the Gantt's time axis. It opens at the finest of day, week and month zoom at which its span fits, with no zoom control. An entry drags by pointer, snapped to days, a range keeping its length, and drops in the lane under the pointer; Escape cancels. Entries that overlap in a lane take separate tracks. The entries are one Tab stop whose Up and Down keys move the current entry, and the toolbar ("Move earlier" and "Move later", one day at day zoom and seven days otherwise, and "Move to lane…") another. Moved entries take the change outline, and the toolbar counts them. | FR-11, L160; OpenSpec change `latex-kanban-timeline` |
```

### Block 5: Component Patterns, Widgets, Kanban row

Current:

```text
| **Kanban** | The user moves cards between columns, by drag or with "Move to…". | FR-11, L160 |
```

Replacement:

```text
| **Kanban** | The user moves cards between columns, by drag or with "Move to…". A card drops on a column, which shows the drop indicator, and takes its place there in the agent's order; Escape cancels. The cards are one Tab stop whose arrow keys move the current card, and the toolbar ("Move to…", a menu of the other columns) another. Moved cards take the change highlight, and the toolbar counts them. | FR-11, L160; OpenSpec change `latex-kanban-timeline` |
```

### Block 6: Interaction Primitives, Drag, a phrase

Current phrase:

```text
Gantt tasks reschedule and resize, the Gantt's Task column resizes and Graph nodes move by pointer drag, with no drag-and-drop library
```

Replacement:

```text
Gantt tasks reschedule and resize, the Gantt's Task column resizes, Timeline entries move and Graph nodes move by pointer drag, with no drag-and-drop library
```

### Block 7: Accessibility Floor, Keyboard core, a phrase

Current phrase:

```text
Kanban: "Move to…"; Ranking:
```

Replacement:

```text
Kanban: "Move to…"; Timeline: "Move earlier", "Move later" and "Move to lane…"; Ranking:
```

## DESIGN

### Block 8: Components, LaTeX row

Current:

```text
| **LaTeX** | A source field in `{typography.code}` with the input atoms' look, the KaTeX preview under it on `{colors.card}`, and a parse error as a `field-error` under the field (F-36). Not mocked. |
```

Replacement:

```text
| **LaTeX** | A source field in `{typography.code}` with the input atoms' look, the KaTeX preview under it on `{colors.card}`, and a parse error as a `field-error` under the field (F-36). The field takes a `{colors.change}` border while it differs from the agent's expression, and a counter under the preview reads "Your changes: expression edited" in `{colors.muted-foreground}` (provisional). A preview wider than the frame scrolls sideways. Read-only, the field takes the read-only look. Not mocked. |
```

### Block 9: Components, Timeline row

Current:

```text
| **Timeline** | Lanes as rows on the Gantt's time axis (L160), ranges as `{colors.gantt-bar}` bars and milestones as diamonds in `{colors.foreground}`. A moved item takes the `gantt-user-change` outline (F-36). Not mocked. |
```

Replacement:

```text
| **Timeline** | Lanes as rows on the Gantt's time axis (L160), ranges as `{colors.gantt-bar}` bars and milestones as diamonds in `{colors.foreground}`. A moved item takes the `gantt-user-change` outline (F-36). Lane labels sit in a fixed column at the left in `{typography.label}`, cut with an ellipsis; a lane whose entries overlap grows one track per overlap, each the Gantt's row height. An entry's label, in `{typography.badge}`, sits after its shape, or inside a range bar wide enough for it. The current entry takes `{components.focus-ring}`. The toolbar holds "Move earlier", "Move later" and "Move to lane…" as `button-secondary`s, and the counter at its right, as the Tree's toolbar does (provisional). Not mocked. |
```

### Block 10: Components, Kanban row

Current:

```text
| **Kanban** | Columns on `{colors.muted}`, each headed by its name in `{typography.label}` and a count, holding cards on `{colors.card}` with a `{colors.border}` border and `{rounded.md}`, titled in `{typography.body}`. A drag shows the drop indicator, and a moved card takes the change highlight. "Move to…" opens a menu on `{colors.popover}` with `{elevation.shadow-md}` (F-36). Not mocked. |
```

Replacement:

```text
| **Kanban** | Columns on `{colors.muted}`, each headed by its name in `{typography.label}` and a count, holding cards on `{colors.card}` with a `{colors.border}` border and `{rounded.md}`, titled in `{typography.body}`. A drag shows the drop indicator, and a moved card takes the change highlight. "Move to…" opens a menu on `{colors.popover}` with `{elevation.shadow-md}` (F-36). A card's description sits under its title in `{colors.muted-foreground}`. The drop indicator is the Tree's "into" outline, `{colors.primary}`, on the column under the card. The current card takes the Tree's current-row look, `{colors.primary-subtle}` with a 2px `{colors.primary}` left bar. The toolbar holds "Move to…" as a `button-secondary`, and the counter at its right (provisional). Not mocked. |
```
