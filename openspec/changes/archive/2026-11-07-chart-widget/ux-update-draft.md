# UX update draft: Chart

**Status: applied by task 0.1 on 2026-11-07.** The proposal's open questions 1 to 5 carry their answers; a question answered otherwise changes its blocks first (`/opsx:update`). New strings are marked "(to review)" with the rest of the microcopy (EXPERIENCE, Localization).

How to apply: replace each quoted text in `docs/ux-askboard-2026-10-27/EXPERIENCE.md` or `DESIGN.md`, set `updated:` in each file's front matter to the apply date, then run `openspec validate --all --strict --no-interactive`. Task 0.1 checks that each current text stands once, word for word, just before the edit. Every block keeps the lines `latex-kanban-timeline`'s draft replaces, and the lines next to them, untouched (design.md, Merge points), which is why block 3 adds a line after the Approval's rather than editing the list's earlier lines.

## EXPERIENCE

### Block 1: Voice and Tone, a Chart row before the WBS with PERT row (the table with the Italian column)

Current:

```text
| WBS with PERT | Columns "Work package", "Optimistic", "Most likely", "Pessimistic", "Expected effort", "Spread" (to review) | Colonne "Pacchetto di lavoro", "Ottimistica", "Più probabile", "Pessimistica", "Stima attesa", "Scarto" (to review) | L200 (T-5) |
```

Replacement:

```text
| Chart | The counter "No points highlighted", "1 point highlighted", "3 points highlighted"; a point read at the keyboard "Fix B, Failures: 9 runs, highlighted"; the hint "Arrow keys move between points. Space highlights."; the role "chart"; values and the unit in the ask's locale ("1,234.5 €", "1.234,5 €") (to review) | "Nessun punto evidenziato", "1 punto evidenziato", "3 punti evidenziati"; "Fix B, Failures: 9 runs, evidenziato"; "Le frecce spostano tra i punti. Spazio evidenzia."; il ruolo "grafico" (to review) | FR-11, FR-34; OpenSpec change `chart-widget` |
| WBS with PERT | Columns "Work package", "Optimistic", "Most likely", "Pessimistic", "Expected effort", "Spread" (to review) | Colonne "Pacchetto di lavoro", "Ottimistica", "Più probabile", "Pessimistica", "Stima attesa", "Scarto" (to review) | L200 (T-5) |
```

### Block 2: Component Patterns, Widgets, Chart row

Current:

```text
| **Chart** | The user reads a chart and highlights data points, which the answer returns. | FR-11, L160 |
```

Replacement:

```text
| **Chart** | The user reads a bar, line or pie chart and highlights data points, which the answer returns as the item's result. A click on a point, or Space or Enter on the point the arrow keys reach, highlights it or clears it; with `highlights: "one"` a new highlight replaces the old, and with `highlights: "none"` the chart is only read. Nothing is highlighted until the user highlights a point, and an untouched Chart gives no answer. A counter under the chart says how many points are highlighted. The chart is one Tab stop: on focus its first point with a value is current and shows its tooltip; Left and Right move between categories, Up and Down between series, Home and End to the ends, skipping points with no value, and a polite live region reads each point. Hovering a point shows its tooltip, with the pointer cursor when the point can be highlighted. Read-only, the chart keeps its highlights, its tooltips and its keyboard reading, and highlights nothing. A legend never hides a series. | FR-11, L160, NFR-12; OpenSpec change `chart-widget` |
```

### Block 3: Accessibility Floor, Keyboard core, a Chart line after the Approval's

Current:

```text
  - Approval: the decision buttons.
```

Replacement:

```text
  - Approval: the decision buttons.
  - Chart: the arrow keys, Home and End move between data points, and Space or Enter highlights or clears the current one.
```

### Block 4: Composition and Components, Component per widget, Chart row

Current:

```text
| Chart | Apache ECharts 6.1.0, canvas renderer, rich-text tooltips | The mapping from AskBoard's chart format, selection in the draft record, a theme built from the tokens | — |
```

Replacement:

```text
| Chart | Apache ECharts 6.1.0, canvas renderer, rich-text tooltips | The mapping from AskBoard's chart format, the highlighted points as the item's result in the draft record, a theme built from the tokens and rebuilt on a switch, the keyboard reading, agent text kept out of ECharts' rich-text markup | The HTML tooltip's `style` attributes, settled by `tooltip.renderMode: "richText"` (renderer spike, `c-chart-rich`) |
```

## DESIGN

### Block 5: Front matter, the light palette after `gantt-bar`

Current:

```text
  gantt-bar: '#8f877a'
```

Replacement:

```text
  gantt-bar: '#8f877a'
  # Chart categorical palette (AskBoard extension; settles Open Items 7)
  chart-1: '#2a78d6'
  chart-2: '#eb6834'
  chart-3: '#1baf7a'
  chart-4: '#6250d6'
  chart-5: '#eda100'
```

### Block 6: Front matter, the dark palette after `gantt-bar-dark`

Current:

```text
  gantt-bar-dark: '#7a7266'
```

Replacement:

```text
  gantt-bar-dark: '#7a7266'
  # Chart categorical palette (AskBoard extension)
  chart-1-dark: '#3987e5'
  chart-2-dark: '#d95926'
  chart-3-dark: '#199e70'
  chart-4-dark: '#9085e9'
  chart-5-dark: '#c98500'
```

### Block 7: Colors, the token table, Chart rows after the Gantt's critical path

Current:

```text
|  | critical path | `critical` † → `foreground` | `#2b2722` | `#ebe6dd` |
```

Replacement:

```text
|  | critical path | `critical` † → `foreground` | `#2b2722` | `#ebe6dd` |
| Chart | series 1 · blue | `chart-1` † | `#2a78d6` | `#3987e5` |
|  | series 2 · orange | `chart-2` † | `#eb6834` | `#d95926` |
|  | series 3 · aqua | `chart-3` † | `#1baf7a` | `#199e70` |
|  | series 4 · violet | `chart-4` † | `#6250d6` | `#9085e9` |
|  | series 5 · yellow | `chart-5` † | `#eda100` | `#c98500` |
```

### Block 8: Components, Chart row

Current:

```text
| **Chart** | Drawn on canvas with a theme built from the tokens and rebuilt on a theme switch (L160): axes and grid lines in `{colors.border}`, labels in `{typography.badge}` and `{colors.muted-foreground}`, tooltips on `{colors.popover}`. A data point the user highlights takes a `{colors.change}` ring (F-36). Its categorical palette is open (Open Items, 7). Not mocked. |
```

Replacement:

```text
| **Chart** | Drawn on canvas with a theme built from the tokens and rebuilt on a theme switch (L160): axes and grid lines in `{colors.border}`, labels in `{typography.badge}` and `{colors.muted-foreground}`, tooltips drawn on the canvas on `{colors.popover}` with `{colors.popover-foreground}` text and a `{colors.border}` edge. Series and pie slices take `chart-1` to `chart-5` in order, never cycled, so a chart holds at most five (settles Open Items 7). Bars have 4px rounded ends away from the axis and a 2px gap between the bars of a category; lines are 2px with 8px markers; pie slices are parted by a 2px `{colors.card}` gap and labelled with their category. A legend above the plot names the series of a bar or line chart of two or more. The title sits above the chart in `{typography.label}`. A data point the user highlights takes a 2px `{colors.change}` ring (F-36); the counter under the chart is in `{typography.body}` and `{colors.muted-foreground}`. Focused, the chart takes `{components.focus-ring}` and its current point shows its tooltip. The plot is 320px high and as wide as the widget frame. Not mocked. |
```

### Block 9: Open Items 7, settled

Current:

```text
7. **Chart colours** (F-73). No categorical palette is chosen for the Chart widget (shadcn's `chart-*` variables are not set). The inherited shadcn default is the fallback until a Chart is mocked.
```

Replacement:

```text
7. **Chart colours** (F-73). Settled by the OpenSpec change `chart-widget` (2026-11-07): the tokens `chart-1` to `chart-5`, light and dark (Colors), checked on the card colour of each theme: every pair of neighbouring slots, the last and the first included for a pie, is at least ΔE 8 apart under protanopia, deuteranopia and tritanopia and at least ΔE 15 for normal vision (OKLab ×100). `chart-3` and `chart-5` sit under 3:1 on the light card, so the legend, the tooltip and the keyboard reading name every point. The order holds no magenta or red, which the change highlight and destructive states take. shadcn's `chart-*` defaults were set aside: two of their light slots are near oranges.
```
