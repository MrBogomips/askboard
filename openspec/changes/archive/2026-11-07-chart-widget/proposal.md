# Proposal

## Why

FR-11's Chart row ("reads a chart and highlights data points") is the first of the medium widgets in the PO's order of 2026-11-07, after Approval, Scale and Ranking and beside LaTeX, Kanban and Timeline. Agents asking about numbers (costs per option, failures per fix, a trend) today send a table of figures the user must picture; a Chart shows them, and the points the user highlights come back as a typed result (EXPERIENCE, Component Patterns, Chart: "highlights data points, which the answer returns").

## What Changes

- **The Chart's registry entry** (FR-11, FR-18, AD-7): a `chart` item of kind `bar`, `line` or `pie`, with `categories` (1 to 100, each `{id, label}`) and `series` (1 to 5, each `{id, label, values}`, one number or `null` per category), an optional `title`, axis labels and `unit`, and `highlights`: `many` (the default), `one` or `none`. Its result is `{points}`, each `{series, category}`, naming points that hold a number; a Chart with nothing highlighted, or with `highlights: "none"`, gives no result. The contract bounds every list and string and checks the props and the result against each other.
- **The Chart component** (AD-8, AD-9): Apache ECharts 6.1.0 with the canvas renderer and tooltips drawn on the canvas (`tooltip.renderMode: "richText"`, renderer spike, `c-chart-rich`), in its own `chart` chunk. A click on a point, or Space or Enter on the point the arrow keys reach, highlights it or clears it; a highlighted point takes a `{colors.change}` ring; a counter says how many are highlighted. The theme comes from DESIGN's tokens and is rebuilt when the `.dark` class switches, on the board and in a Snapshot.
- **Agent text on the canvas** (NFR-5, AD-8): labels and series names are drawn as text: control and bidirectional characters as visible escapes (the contract's `agentTextRuns`), and ECharts' rich-text markup (`{name|text}`) never formed from agent text.
- **A categorical palette** (DESIGN Open Items 7, F-73): five tokens `chart-1` to `chart-5`, light and dark, validated for colour-vision deficiency, which settles the open item; DESIGN and EXPERIENCE gain the Chart's look, keyboard and strings through `ux-update-draft.md`.
- **The port's theme** (AD-9): `useTheme()` in the catalog port tells a component the theme in effect, so canvas components redraw on a switch.
- **The askboard skill**: the entry's teaching text and example; the skill is regenerated.
- **Versions** (askboard-contract-versioning): the input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s, bound at the rebase.
- **A new dependency**: `echarts` 6.1.0 in `packages/widgets`, already in the spine's Stack; it brings `zrender` 6.1.0 (BSD-3-Clause) and `tslib` 2.3.0 (0BSD). Adoption checked on 2026-11-07 (design decision 9).
- **Not in this change**: a Chart outside a question (EXPERIENCE's "context Chart" as a top-level item, which the input format does not admit yet), scatter, area, stacked or dual-axis charts, zoom and brushing, a data-table view, highlights recorded by the agent with `update`.

## Capabilities

### New Capabilities

None: the behaviours belong to capabilities E1 created.

### Modified Capabilities

- `contract`: the `chart` type (props, result and their checks, wording, example, teaching text); the four sets' next minors.
- `core`: a Chart's result checked against the revision its answer names.
- `view-and-widgets`: the Chart component, its highlighting by pointer and keyboard, its theme and palette, agent text on the canvas, its chunk and strings, and the port's theme.

## Impact

- Code: `packages/contract` (`src/widgets/chart/`, `registry.ts`, the four set modules, fixtures), `packages/view` (`catalog/port.ts` and `catalog/index.ts`, strings), `packages/widgets` (`src/chart/`, `package.json`), `tools/build` (tokens through DESIGN.md, sizes), `skills/askboard/` (regenerated), `packages/view/chunk-sizes.json`, `bun.lock`, `CHANGELOG.md` (Unreleased). `packages/core`: tests only.
- No spine change: `echarts` 6.1.0 is pinned in the Stack and the renderer spike accepted it (AD-19); no PRD change.
- Merge points with `latex-kanban-timeline` (in flight) and `plugin-release` (merged as #49): design.md, Merge points.
- IDs served: FR-11, FR-18, FR-20, FR-22, FR-29, FR-34; NFR-5, NFR-6, NFR-9, NFR-10, NFR-12; SM-5. ADs: AD-1, AD-6, AD-7, AD-8, AD-9, AD-10, AD-19, AD-20. UX: EXPERIENCE Component Patterns (Widgets: Chart; Widget frame), Accessibility Floor (Keyboard core, Tab order), Interaction Primitives (Hover and focus feedback), Voice and Tone, Dark theme, Component per widget (Chart); DESIGN Colors, Dark theme mechanism, Components (Chart), Open Items 7.

## Open questions for the PO

Each carries a proposed default, accepted under the PO's unattended handoff of 2026-11-07 (PO priority: the Chart first among the medium widgets).

1. **Which charts.** *Default:* bar (grouped by category), line and pie, one value axis. *Why:* they read most business figures; one axis avoids dual-axis misreadings. *Alternative:* add scatter and stacked bars (more modules in the chunk, a second point shape).
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
2. **What the answer carries.** *Default:* the highlighted points as a result, `{points: [{series, category}]}` in the series' then the categories' order; nothing when none is highlighted. *Alternative:* the points with their values (the agent already holds them).
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
3. **How many points.** *Default:* `highlights` `many` (default), `one` (a new highlight replaces the old) or `none` (a chart to read, no result). *Alternative:* a numeric maximum.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
4. **The palette** (DESIGN Open Items 7). *Default:* five slots, blue, orange, aqua, violet, yellow, light `#2a78d6 #eb6834 #1baf7a #6250d6 #eda100`, dark `#3987e5 #d95926 #199e70 #9085e9 #c98500`; so at most five series, and five pie slices. No magenta or red, so a series never looks like the change ring or a destructive state. Aqua and yellow sit under 3:1 on the light card: a legend, the tooltip and the keyboard text name every point. *Alternative:* shadcn's default `chart-*` (two near oranges in light).
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
5. **No data-table view.** *Default:* none (FR-11's minimum is its ceiling); the keyboard reads each point aloud through a live region. *Alternative:* a "Table" toggle under the chart.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
6. **ECharts in the component chunk.** *Default:* in `chart`, not in a library chunk, since no other component uses it (AD-9). *Alternative:* an `echarts` library chunk for a later Spreadsheet chart.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
