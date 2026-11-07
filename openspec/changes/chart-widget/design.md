# Design

## Context

See proposal.md for why. What the change starts from, read on `origin/main` 362744f1 (#50, the archive of `approval-scale-ranking`, after #49, `plugin-release`):

- **The registry and results** (`widget-registry`, `approval-scale-ranking`): `WidgetType` with `result: {schema, shape?, problems?, answerProblems?}`, `wording`, `example`, `skill`; `WIDGET_TYPES` (Tree, Gantt, Approval, Scale, Ranking); the composed input, board document and `fetch` schemas and the output set listing each result schema; `widgetResultProblems`, run by `ask-core` against the revision the answer names; `widgetResultFits` and `resultFitProblems` (`widgets/result-fits.ts`), which the board page runs before it holds or seeds a result; `registry-check.ts` with the `result-empty` rule; `withWidgetTypes` (`fixtures/approval-scale-ranking.ts:18`). A type with a result and no edits needs no `core` code: `ask-core`, `fetch`, the draft record, revisions and the Snapshot data carry results generically.
- **The view** (`catalog/port.ts`): `ItemProps` with `result`, `onResultChange`, `disabled`, `ready`, `board`; `ComponentFacts {shape?, name?, reason?, confirmsRevision?, fits?}` through `register`; `useReadyAfterLayout`, `questionTextId`, `useStrings`, `useLocale`. No port export tells a component the theme: `applyTheme` (`theme.ts:28`) toggles `.dark` on `document.documentElement` (`shell/index.tsx:180`), and the Gantt and Tree need nothing more because CSS follows the class.
- **Tokens** (`tools/build/tokens.ts`): DESIGN.md's front-matter colours become CSS variables, light and under `.dark`; fonts are the system stacks (`--font-sans`), so a canvas needs no web font.
- **Chunks** (`tools/build/chunks.ts`): one component chunk per folder under `packages/widgets/src/` holding `index.tsx`, `process.env.NODE_ENV` defined, `import.meta` refused; `LIBRARY_CHUNKS` (`shared-modules.ts:57`) for code several chunks share; licence notices per chunk from the metafile's inputs, a package's `LICENSE`, `COPYING` and `NOTICE` files included (`licences.ts:63`); `chunk-sizes.json` with the 10% growth check.
- **The renderer spike**: ECharts 6.1.0 with the canvas renderer passes in the five engines once its tooltip is drawn on the canvas (`tooltip.renderMode: "richText"`, `c-chart-rich`); its HTML tooltip writes 14 `style` attributes per hover (`c-chart`). The chart writes its own styles through the CSSOM. A bar-only chunk was 507,148 bytes, 171,464 gzipped (findings, Sizes).
- **ECharts 6.1.0 and zrender 6.1.0, read in their npm tarballs on 2026-11-07**: zrender parses rich-text markup with `STYLE_REG = /\{([a-zA-Z0-9_]+)\|([^}]*)\}/g` (`lib/graphic/helper/parseText.js:5`) whenever a text has `rich` styles (`lib/graphic/Text.js:279`), and the rich tooltip always sets them (`echarts/lib/component/tooltip/TooltipRichContent.js:87`), so an agent's label shown in a tooltip would be read as markup. Images load only for `image://` symbols and image patterns (`echarts/lib/util/symbol.js:298`, `zrender/lib/core/platform.js:59`), which AskBoard never sets. The tarball ships `LICENSE` and `NOTICE` and an `asset/logo.png` no module imports.

ADs relied on: AD-1 (imports: `widgets` imports `echarts`; `contract` stays plain ECMAScript), AD-6 (worded problems, generated teaching), AD-7 (the registry, results keyed by item ID, IDs, sets and minors), AD-8 (agent content as data, the page policies, CSSOM styles only), AD-9 (components through the port, no edit state of their own, one chunk per component, library chunks only for shared code), AD-10 (nothing chosen for the user, fail closed), AD-19 (adoption rule, exact pins; `echarts` 6.1.0 already in the Stack), AD-20 (results apart from values, revisions, drafts). No AD and no FR changes; EXPERIENCE and DESIGN change through `ux-update-draft.md`. Nothing here assumes Claude Code's run-time behaviour beyond what `push-delivery` verified (an answer event pushed as built), so nothing needs a Claude Code probe; two library behaviours are probed in task 0.5.

## Goals / Non-Goals

**Goals:**

- The Chart is one registration: its folders in `contract` and `widgets`, one registry line, its teaching text, its strings; the only shared code it adds is the port's `useTheme`.
- Agent text on a canvas stays data, with a test that fails if the chart library's markup rule changes.
- The keyboard core (NFR-12) holds for a canvas widget.

**Non-Goals:**

- Charts outside questions, other kinds, zoom, brushing, a table view, agent-set highlights (proposal, Not in this change).
- A chart library chunk shared with other components.
- Pixel-exact rendering tests: the browser tests check the draft, the live region, the counter and the absence of violations, and click at positions the layout module computes.

## Decisions

### 1. The registry entry (open questions 1 and 3)

`packages/contract/src/widgets/chart/`, in the Scale's layout: `chart-props.json` (`urn:askboard:input:chart-props`), `chart-result.json` (`urn:askboard:output:chart-result`), `constants.ts` (`CHART_KINDS`, `CHART_HIGHLIGHTS`, `CHART_MAX_CATEGORIES` 100, `CHART_MAX_SERIES` 5, `CHART_PIE_MAX_SLICES` 5, `CHART_VALUE_LIMIT` 1e15, `CHART_MAX_POINTS` 500), `checks.ts` (plain, no Ajv, so the chunk imports it), `wording.ts` (`chart.props…` keys), `widget.ts` (`CHART_WIDGET`), `index.ts`. Noun "a Chart". No `edits`, no `derived`, no `answerProblems`.

| Part | Rule |
|---|---|
| Props schema | `kind` required; `categories` 1–100 `{id, label}`; `series` 1–5 `{id, label, values}`, `values` 1–100 of number (±1e15) or `null`; `title` 1–120; `valueLabel`, `categoryLabel` 1–60; `unit` 1–20; `highlights` `many`, `one`, `none`; `additionalProperties: false` at every level; IDs by `ID_PATTERN` |
| `propsProblems` (after the schema) | category IDs unique, series IDs unique (naming the element); each series' `values` as long as `categories`; at least one number; a pie: one series, at most 5 categories, no negative value, a value above 0, no `valueLabel` or `categoryLabel` |
| Result schema | `{points}`, 1–500 `{series, category}`, both by `ID_PATTERN`, `additionalProperties: false`, required; `result-empty`'s samples all fail |
| `result.shape` | the schema's rule in plain code, as the Scale's |
| `result.problems` (against the props as revised) | each point names a series and a category of the props whose value is a number; no point twice; `highlights: "one"` exactly one; `highlights: "none"` any result refused, saying the chart takes no highlight |

The result lists points in no required order; the component sends them in the series' then the categories' order (open question 2), so equal highlights give equal answers. `skill`: use "a bar, line or pie chart the user reads and may highlight points on"; notes "Each series' `values` holds one number or null per category, in the categories' order; at most 5 series, a pie one series of at most 5 slices." and "The result is `points`, each `{series, category}`; with `highlights: \"none\"` there is no result, so give the question options or another item." (shortened to `askboard-skills`' bounds in task 1.3). Example: a bar chart of three categories and two series with a `unit`.

*Alternative:* the points with their values in the result; the agent already holds the values, and a result that copies them could disagree with them.

### 2. `core` is untouched

`widgetResultProblems` already runs the entry's schema and `problems` against the item's props in the revision the answer names, refuses before anything is kept or published, and `fetch` returns the kept result. Group 2 adds tests only (core spec, Chart results through ask-core); a failing test that needs code stops the group for `/opsx:update`.

### 3. Agent text on the canvas (NFR-5, AD-8)

`packages/widgets/src/chart/text.ts`, pure:

- `chartText(text)`: the contract's `agentTextRuns(text)` joined (controls and bidirectional characters as visible `\uXXXX` escapes, as the board header's paths), then U+2060 WORD JOINER inserted after every `{` that the rich-text rule could open, that is before `[A-Za-z0-9_]+\|`. The joiner is zero-width and not a line break; `{` U+2060 `b|x}` no longer matches `STYLE_REG`, so it draws as written. Every agent string the option holds (category and series labels, axis labels, `unit`) goes through it once, in `option.ts`, whether or not its place has `rich` styles.
- Every string `chartText` returns starts with U+2060 (review of groups 1 to 4, X-1, H): zrender 6.1.0 caches text widths in a plain object keyed by the text (`lib/core/LRU.js`), so a label equal to an inherited name (`__proto__`, `constructor`, `toString`, ...), or a truncated prefix of one, pollutes `Object.prototype` or the built-ins with `prev` and `next` in the realm the shell shares, and the view's MCP client then drops every message as an unknown key. No inherited name or prefix starts with U+2060, and the joiner draws nothing. A guard draws `chartOption` with every inherited name in every text slot and asserts that no built-in gains an own property.
- Every label and tooltip uses a formatter function that returns AskBoard's text; no string template (`{a}`, `{b}`, `{c}`) is ever set, since ECharts substitutes those in a loop and a value holding `{b}` would be substituted on a later pass.
- Guards (task 4.1): a unit test runs zrender's own `parseRichText` (pure, no DOM) on hostile labels after `chartText` and finds one plain token each; a source guard reads the pinned `zrender/lib/graphic/helper/parseText.js` and fails if `STYLE_REG` differs from the regex above, so a version bump re-opens this decision.

*Alternative:* an HTML tooltip of AskBoard's own (React text, positioned through the CSSOM); EXPERIENCE names rich-text tooltips, and the canvas tooltip keeps the chart one surface for the keyboard.

### 4. The component (open question 5)

`packages/widgets/src/chart/`:

- `props.ts`: `checkedChartProps` runs `checks.ts` and throws on a problem (the item's error boundary fails it, AD-10).
- `model.ts` (pure): `pointsOf(props)` (the points holding a number, in series then category order; for a pie the slices), `highlightedPoints(result)` (reads a held result), `toggle(points, point, highlights)` (takes and returns the highlighted points: adds or removes; `one` replaces; `none` returns them unchanged), `resultOf(points, props)` (`undefined` when empty, else `{points}` in the props' series-then-category order, whatever the order of the clicks, dropping a point the props do not hold), `move(current, key, props)` (Left and Right along categories, Up and Down across series, Home and End to the first and last point in that order, skipping `null`; a pie moves along slices with all four arrows; a current point the props do not hold gives the first point), `firstPoint(props)`, `pointAt`, `isHighlighted`, `CHART_KEYS`.
- `layout.ts` (pure): the grid insets, legend height and plot height (320px), and `pointCentre(props, point, box)`, the centre of a bar, a marker or a slice, which the browser tests click.
- `option.ts` (pure): the ECharts option from the checked props, the held or shown result, the theme tokens, the strings and the locale: `animation: false`; one value axis from zero; `legend` for bar and line of two or more series, `selectedMode: false`; series colours `chart-1` onward in order; highlighted points' `itemStyle` a 2px `change` border (a bar's border, a marker's ring with `symbolSize` 8, a slice's border), the other slices' borders 2px `card`; bars `borderRadius` 4 away from the axis and `barGap` set for a 2px gap; lines 2px with `connectNulls: false`; `emphasis.disabled: true`, so hover changes no colour and only the tooltip and cursor answer; `cursor: "pointer"` only when highlights are taken and the item is enabled, else `default`; tooltip `{trigger: "item", renderMode: "richText", backgroundColor: popover, borderColor: border, textStyle: {color: popover-foreground}}` with a formatter giving category, series and value; numbers by the contract's `formatNumber` in the ask's locale, with the `unit`. The value axis has explicit bounds from zero to one step above the highest value (below zero only for a negative value; a unit axis for subnormal values) so a point's position is known to the tests; value-axis labels are cut at 64px and category labels at their band, the tooltip and the live region carrying the full text. Unit-tested as data in Bun.
- `reading.ts` (pure): `pointReading` ("category, series: value[, highlighted]" for the live region, without the joiner of decision 3) and `counterText`. `canvas.ts`: the seven ECharts modules through `use`, one instance, `resize` then `setOption`, `showTip` and `hideTip` by a point's indexes, and the events it hands the component.
- `theme.ts`: `tokensFrom(read)` and `chartTokens(element)` read the resolved variables (`--chart-1` to `--chart-5`, `--border`, `--muted-foreground`, `--popover`, `--popover-foreground`, `--change`, `--card`, `--font-sans`, the badge size) with `getComputedStyle` (a token with no value throws).
- `widget.tsx`: `echarts.init(div, null, {renderer: "canvas"})` once, `dispose` on unmount; `setOption(option, {notMerge: true})` whenever the props, the result, the tokens (`useTheme()`, decision 6), the locale or `disabled` change; `finished` → ready through `useReadyAfterLayout` (also ready when the box has no width, as in an inactive area tab, and drawn on the next `ResizeObserver` callback); a `click` handler mapping `seriesIndex` and `dataIndex` to a point and calling `onResultChange(resultOf(toggle(...)))` unless `disabled` or `none`. The container is the one Tab stop: `role="application"`, `aria-roledescription` "chart", `aria-labelledby` the title or `questionTextId`, `aria-describedby` the keyboard hint; on focus the first point is current and `dispatchAction({type: "showTip", …})` shows its tooltip; keys as the spec says; a visually hidden `aria-live="polite"` element reads "category, series: value[, highlighted]". The counter under the plot ("No points highlighted", plural forms) shows unless `highlights` is `none`. Ring and focus ring through classes (`classes.ts`), no inline style.
- `index.tsx`: `register("chart", Chart, {name: "change.widgetChart", fits})`, `fits` over `widgetResultFits` as the other result chunks register it. ECharts modules: `echarts/core` with `BarChart`, `LineChart`, `PieChart`, `GridComponent`, `TooltipComponent`, `LegendComponent`, `CanvasRenderer` through `use`, nothing else.

### 5. Highlights across revisions and reloads

Nothing new: a held result is mirrored, restored after a reload, held for Submit, kept on "Keep mine" and dropped by the draft filter when the current props refuse it (`fits`, view-and-widgets spec "A draft holds only results its items accept"); a revision starts from its latest answer's results. Browser tests in group 6 prove each for the Chart.

### 6. The port's theme

`catalog/port.ts` gains, appended, `useTheme(): Theme`: `useSyncExternalStore` over one `MutationObserver` of `document.documentElement`'s `class` attribute, giving `dark` while the class list holds `dark`, else `light`; `themeOfClasses(list)` is its pure core. `catalog/index.ts` re-exports it, so the chunk reads it through the port's shim. It works the same on the board and in a Snapshot, whose view sets the class itself.

*Alternative:* a `MutationObserver` inside the chart chunk; the port's hook serves the Diagram's dark re-render later (DESIGN, Dark theme mechanism) and keeps one observer per page.

### 7. The palette (open question 4)

DESIGN gains `chart-1` to `chart-5`, light and dark (`ux-update-draft.md` blocks 5 to 7), which `tokens.ts` turns into variables with no code change; task 3.2 tests that they reach the stylesheet in both themes. Checked on 2026-11-07 with a CVD validator on `card` (`#fffdf9`) and `card-dark` (`#23201c`), each neighbouring pair and the pie's last and first: worst ΔE 9.2 light and 9.4 dark under colour-vision deficiency, 27.6 and 24.6 for normal vision; light `chart-3` (2.77:1) and `chart-5` (2.13:1) under 3:1 on the card, relieved by the legend, the tooltip and the live region. Series past five are refused by the contract rather than cycled.

### 8. The chunk (open question 6)

ECharts and zrender go in the `chart` component chunk; `LIBRARY_CHUNKS` does not change. Expected size about 550 to 700 KB raw (spike: 507,148 for bars alone; line, pie and legend added); task 5.2 records it with `--record-sizes` and its reason, and the board page's growth from the Chart's schemas in its standalone validators, and the shell's from the strings. The build's checks apply unchanged (no `import.meta`, `process.env.NODE_ENV` defined, `latex-kanban-timeline`'s URL check on the chunk's styles once merged, which Tailwind utilities pass).

### 9. Adoption of `echarts` (AD-19, NFR-6)

Checked on 2026-11-07, against the addendum's rule:

| Package | Pin | Licence | Stars | Last push | Last release | Archived |
|---|---|---|---|---|---|---|
| `echarts` (direct, `packages/widgets`) | 6.1.0 | Apache-2.0 | 67,690 | 2026-10-13 | 6.1.0, 2026-05-19 | no |
| `zrender` (its dependency, exact) | 6.1.0 | BSD-3-Clause | 6,310 | 2026-11-03 | 6.1.0 | no |
| `tslib` (exact dependency of both) | 2.3.0 | 0BSD | — | — | — | — |

`bun.lock` gains the three (Bun hoists `tslib@2.3.0` to the root and nests 2.8.1 beside its six earlier consumers, whose versions do not change); `check:licences` passes them (`PERMISSIVE` holds the three licences); no font, image or other asset is bundled; Apache-2.0's NOTICE reaches the chunk's notices through `LICENCE_FILE`, and so must every third-party licence an included echarts source embeds: `lib/scale/Time.js` (the time scale that `GridComponent` registers) copies d3's scale levels under BSD-3-Clause, which echarts' LICENSE does not list, so the chunk ships d3's licence text too (checkpoint 5.3, X-1; task 5.5). No spine change: the Stack already pins `echarts` 6.1.0.

### 10. Registration waits for the chunk

As in `approval-scale-ranking` decision 10: `CHART_WIDGET` joins `WIDGET_TYPES` only in task 5.1, which adds `index.tsx`; until then tests pass `withWidgetTypes(CHART_WIDGET)`. Task 5.1 also regenerates the skill (`check:skills`).

### 11. Versions

The input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s (askboard-contract-versioning): their composed schemas and the output set's list change only when the type registers, so the four constants move in task 5.1, each set module's header gaining one sentence naming this change; the binding is task 7.2's. The board protocol (results are any JSON by item ID), the Snapshot data and the view manifest keep `main`'s. Descriptions, comments and test titles say "since chart-widget", never a number.

Binding: (filled at task 7.2) "Bound on <date>, rebased onto origin/main <sha>: input format <n> (main <m>), output format …, tool envelopes …, board document …."

### 12. The end-to-end proof

| Scenario | Where |
|---|---|
| Highlight by click and by keys, counter, live region, `one` and `none`, a gap skipped, read-only after the ask closes | browser, test server (task 5.1) |
| Answered, collected with `results`, fetched alone; a reload keeping a held highlight; an agent's change removing a highlighted point, kept work dropping it | browser, session process (task 6.1) |
| Theme switch with a highlight, resize, hover, the three kinds: no CSP violation, no request, in Chromium, Firefox and WebKit | browser, session process (task 6.2) |
| A Snapshot of an answered Chart, read-only, from `file://` | browser (task 6.3) |
| One answer holding a Chart's points, pushed by the mod or collected, in each configuration, Bun and Node 24 | conformance `chart-result.e2e.ts` (task 6.4) |
| `act` refused for a point the revision does not hold and for a second point on `one` | `packages/server/test` (task 6.5) |
| it-IT strings and numbers; the cursor and tooltip on hover | browser (task 6.6) |

## Merge points

Borrowed from `main` (task 0.2 checks each with its file and line): `WidgetType`, `WIDGET_TYPES`, `widgetTypeOf`, `widgetResultProblems`, `widgetResultFits`, `resultFitProblems`, `widgetRegistryProblems`, `EMPTY_RESULTS`, `withWidgetTypes`, `ID_PATTERN`, `formatNumber`, `agentTextRuns`, `ItemProps`, `BoardContent`, `ComponentFacts` (`name`, `fits`), `register`, `componentFacts`, `useReadyAfterLayout`, `questionTextId`, `useStrings`, `useLocale`, `applyTheme`, `LIBRARY_CHUNKS`, `widgetChunkProblems`, `chunkInputs`, `collectNotices`, `boardPagePolicy`, `component-facts.test.ts`, `skills-examples.test.ts`, `build:skills`, `check:skills`, `widget-results.e2e.ts` and `run.ts` (conformance), `result-widgets-protocol.test.ts` (as the pattern of task 6.5).

Changes in flight:

- **`latex-kanban-timeline`** (branch `worktree-feature-latex-kanban-timeline`, head 465f1302 on base 0143328f, pull request soon). This change borrows none of its names (not `valueFits`, `CHUNK_STYLESHEETS`, `styleUrlProblems`, `FieldsShape`, `tools/font-licences.json`). Overlaps, re-checked at task 7.2: `WIDGET_TYPES` (both append; registry order follows merge order); the four set constants and their header sentences (whichever merges second rebinds, Rule 1); `ComponentFacts` (it appends `valueFits`; this change adds no fact); the contract's appended export blocks (`src/index.ts`, `src/validate.ts`, `src/fixtures/index.ts`: keep both blocks); the strings tables; `chunk-sizes.json` (re-record after the rebase); `skills/askboard/` (regenerate, never resolve); `packages/widgets/package.json` (`katex` there, `echarts` here) and `bun.lock` (keep both, then `bun install`); conformance `run.ts` (both append a file); `component-facts.test.ts` and tests that list the types (derived from `WIDGET_TYPES`, so no edit); EXPERIENCE and DESIGN (`ux-update-draft.md` touches none of the lines its draft replaces nor the lines beside them: its Voice and Tone rows are above the WBS row this change anchors on, with the Sales estimate row between; its Accessibility Floor phrase is on the Tree line, this change adds a line after the Approval's; its Component Patterns and Components rows are two rows away from the Chart's); `CHANGELOG.md` (if it adds an Unreleased entry, keep both lines). Its URL check on chunk styles will also run on the `chart` chunk once merged; the chart adds no stylesheet.
- **`plugin-release`** (merged as #49, on this base): a release ships `dist/view/**` with each chunk's notices, so ECharts' notices ship with no release change; `CHANGELOG.md` takes an Unreleased entry (task 7.1); the new dependency changes `bun.lock`, which the release's preflight does not read. No name borrowed.
- **`early-benchmark`** and the spikes: no overlap.

Seams this change creates, which later changes may borrow once it merges: `useTheme` and `themeOfClasses` in the port; the `chart-1` to `chart-5` tokens; `chartText` (agent text safe for ECharts' rich text), `pointCentre` as a test helper pattern.

## Risks / Trade-offs

- [ECharts or zrender changes its rich-text rule, and agent text becomes markup] → decision 3's source guard fails on any change of `STYLE_REG`; `echarts` and `zrender` are pinned exactly.
- [The word joiner shows as a glyph or changes text width in an engine] → task 0.5 measures `measureText` with and without it in Chromium, Firefox and WebKit before group 4; if any differs, the fallback is to replace `|` after `{word` by U+FF5C and the task stops for `/opsx:update`.
- [Canvas is hard to test] → the model, option and text are pure and tested in Bun; the browser tests use keys and the live region, and click at `pointCentre`'s positions; no pixel comparison.
- [A chart in an inactive area tab has no width, so ECharts does not draw and `finished` never fires] → ready when the box has no width; the `ResizeObserver` draws when it is shown.
- [Chunk size: a board with a Chart loads several hundred KB] → only boards holding a Chart load it; only the seven ECharts modules are registered; task 5.2 records the size and reason.
- [Two light slots under 3:1 on the card] → legend, tooltip and live region name every point (DESIGN Open Items 7 as settled).
- [Highlights depend on point IDs; an agent's change that renames a category drops a held highlight] → the draft filter drops what the current props refuse and the user sees the ring gone; accepted, as for the other result widgets.
- [The keyboard path differs from a screen reader's virtual cursor in `role="application"`] → best effort (EXPERIENCE Accessibility Floor, Target); the live region carries each point.
- [ECharts 6.1.0's canvas tooltip applies only the fill, padding and shadow of `textStyle`, so the tooltip draws in 12px sans-serif, not the theme's badge size and font stack (checkpoint 5.3 U-2, task 6.6)] → accepted under the PO's unattended handoff: DESIGN names no tooltip font, the colour follows the theme, and the test pins the drawn font so a library change that makes it follow the theme is noticed; an AskBoard-drawn tooltip is a later choice.
- [A held Chart result is kept or dropped whole across a revision (`fits` is boolean): an agent's change that removes one highlighted point's category drops every highlighted point (task 6.1)] → accepted: what is sent equals what is shown (AD-10), and the agent-change notice names the Chart.

## Migration Plan

None: four sets widen by an added schema and a composed item branch, and one session process serves the board page and `board-host`, so their minors move together. Rollback is a revert, then `bun install` and `bun run build:skills`.

## Open Questions

The proposal's six questions carry their proposed defaults, accepted under the PO's unattended handoff (2026-11-07); a PO answer that differs comes back through `/opsx:update` before the groups it touches (questions 1, 3 and 4 change the contract's bounds and group 1; question 4 changes blocks 5 to 9 of `ux-update-draft.md`).

1. **Documents, read together** (no conflict): EXPERIENCE's top-level item row names "a context Chart" outside any question, which the input format does not admit (areas and questions only at the top level). This change leaves that row as it is: a Chart in a question with `highlights: "none"` is the reading chart this change offers, and a top-level display item is a later change to the input format.
