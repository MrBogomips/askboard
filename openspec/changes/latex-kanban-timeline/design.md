# Design

## Context

See proposal.md for why. The code this change starts from, read on its base be243ddf: `approval-scale-ranking` after its group 1 fixes, stacked on `askboard-skills`, itself on `widget-registry` as merged by PR #42; `origin/main` is 1ca8d590, which adds the archive of `widget-registry` (PR #44):

- **The registry** (`widget-registry`, on `main`): `WidgetType` with `edits: {changes, shape}`, `result`, `derived`, `wording`, `example`; `WIDGET_TYPES`, which holds Tree and Gantt on `main` and, on this base, Approval, Scale and Ranking only through `withWidgetTypes`; the composed input, board document and `fetch` schemas; the output set listing each entry's changes and result schemas (`schemas/output/index.ts`); `ComponentFacts {shape?, name?}` given through `register`.
- **The generic diff** (`contract/src/widgets/element-diff.ts`): list and keyed shapes only. The output format's `reference` already admits `item.field` (`answer-event.json`, `$defs/reference`).
- **How `ask-core` takes a widget value** (`core/src/lifecycle/widget-values.ts`): the value goes through its type's checks in the question as edited (`valuesProblem`); the diff computed against the sent value must rebuild the value (`roundTripProblem`); results go through their schema and checks (`resultsProblem`). Nothing checks the computed changes against the type's changes schema, so a buggy board could send a reordered list or an edited label and the agent would get a `move` or a `set` the type never declares.
- **The shell's "Answer"** (`view/src/shell/question-state.ts`): it is enabled when the draft holds a choice, a value, a result or "Other…" text; an untouched review widget gives no answer.
- **The Gantt's time code** (`packages/widgets/src/gantt/`): `model/date.ts` (day numbers, the Gantt's days; its header says it "moves to `shared/` when a second widget needs it"), `model/say.ts`, `model/scale.ts` (zooms, `xOf`, `dateAt`, ticks, `openingZoom`), the axis drawn in `chart.tsx`, and `bar-drag.ts` (pointer capture, horizontal travel, Escape).
- **The view build** (`tools/build/view.ts`, `chunks.ts`): a chunk's styles are Tailwind's output over its own sources. CSS imported from a package is not collected, and nothing inlines fonts. Both page policies already allow `font-src data:` (`contract/src/hash.ts`, `view/src/assemble/index.ts`; renderer spike row 4).
- **The renderer spike**: `katex` 0.19.1 through its DOM API passes in the five engines once the board page allows `font-src data:`. `renderToString` into markup is caught by `style-src-attr`. The `math` chunk was 276,609 bytes of script and 369,894 of styles, 346,972 of them KaTeX's 20 woff2 faces (findings, Criterion 1 table, Fonts; probe `components/math.tsx`, `build.ts` `inlineFonts`). Pragmatic drag and drop's Kanban fixture passes in every engine (`c-kanban`).
- **In flight on this base**: `approval-scale-ranking`'s `withWidgetTypes` (its task 1.2, built). Its `dnd` library chunk (task 3.6), the Approval summary (task 4.1), `shared/toolbar-focus.ts` (task 4.3) and its registrations (tasks 5.1 to 5.3) are still to come. `askboard-skills`' `WidgetType.skill`, `build:skills`, `check:skills` and `skills-examples.test.ts` are built.

ADs relied on: AD-1 (imports; `contract` and `core` plain ECMAScript), AD-6 (worded problems, generated teaching), AD-7 (the registry, IDs, full-dates, sets and minors), AD-8 (agent content as data, the page policies, fonts as `data:` URLs), AD-9 (components through the port, no edit state of their own, one chunk per component, library chunks), AD-10 (nothing chosen for the user, fail closed), AD-19 (adoption rule, exact pins), AD-20 (values, the one generic diff, drafts; amended in place by `spine-update-draft.md` blocks 1 to 3). No FR changes; EXPERIENCE and DESIGN change through `ux-update-draft.md`. Nothing here depends on Claude Code's run-time behaviour beyond what `push-delivery` verified, so nothing needs a probe.

## Goals / Non-Goals

**Goals:**

- Each type is a registration: its own folders in `contract` and `widgets`, one registry line, its teaching text, its strings. The shared changes are generic: a diff shape, a changes check and package stylesheets, which later widgets reuse (the Diagram, Document review's Markdown, the Form).
- Every answer of the three carries only the changes its type declares, checked by `ask-core` whatever the board sends.
- KaTeX renders agent text as data, with no request.

**Non-Goals:**

- Resizing, adding or deleting entries, cards, lanes or columns; reordering cards within a column; a zoom control (proposal, open questions 5 and 6).
- A check that a range keeps its length (open question 9).
- The Diagram's renderers and their `renders` (`diagram-render`).

## Decisions

### 1. One change, three registrations (open question 1)

The three widen the same four sets, append to the same registry, strings, skill and chunk sizes, and give no result, so one binding and one rebase serve them. Registry order follows the PO's order: `latex`, `kanban`, `timeline`, after `main`'s types and `approval-scale-ranking`'s. Each type has `packages/contract/src/widgets/<type>/` (`<type>-props.json` `urn:askboard:input:<type>-props`, `<type>-changes.json` `urn:askboard:output:<type>-changes`, `constants.ts`, `checks.ts` plain with no Ajv so a chunk may import it, `wording.ts`, `widget.ts`, `index.ts`) and `packages/widgets/src/<type>/`. Nouns: "a LaTeX", "a Kanban", "a Timeline". No entry declares `result` or `derived`. FR-11's "Rendering" for LaTeX is the board's work and never reaches the agent.

### 2. The whole-field shape lands here (open question 2)

`ElementShape` gains `FieldsShape = {readonly fields: readonly string[]}`, with `diagram-render`'s name and semantics (its design decision 2, read at 9281d923). Over it, `elementChanges` compares each named field as a JSON value and gives `{op: "set", target: "<item>.<field>", value}`, with `null` for a field that is gone, in the shape's order. A difference in any other key throws a problem naming the item and the key, which `ask-core` turns into a refusal. `applyElementChanges` sets the fields back with `define`, so that `__proto__` stays a key. A shape is told apart by `"fields" in shape`; no reader outside `element-diff.ts` reads `elements` (task 0.2 lists the readers). `spine-update-draft.md` blocks 1 and 2 carry `diagram-render`'s AD-20 blocks 3 and 4, with a LaTeX expression as the example. `diagram-render` drops its own task 1.1, its blocks 3 and 4 and its ADDED requirement of the same name, which this change's contract delta holds, and borrows `FieldsShape`.

*Alternatives:* the expression as a result `{expression}` (AD-20 keeps edits of agent content in values); LaTeX waiting for `diagram-render`, which comes later in the PO's order.

### 3. LaTeX's entry (open question 4)

Props `{expression}`, a string of 0 to `LATEX_EXPRESSION_MAX_CHARS` = 2,000 characters, `additionalProperties: false`. Shape `LATEX_SHAPE = {fields: ["expression"]}`. Changes: an array of `set`s whose target matches `^[A-Za-z0-9_-]{1,64}\.expression$` and whose value is a string of at most 2,000 characters. No check beyond the schema: the contract never parses LaTeX (KaTeX is a view dependency). Skill draft: use "one mathematical expression in LaTeX that the user reads and corrects, with a live preview"; notes "The answer's change is one `set` of `<id>.expression`: the whole expression as the user wrote it, which may not parse." and "KaTeX renders it: `\href`, `\url` and `\includegraphics` show no link or image, and no macro outlives the item." Example: `{type: "latex", id: "formula", props: {expression: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"}}`.

### 4. Kanban's entry

Props: `columns`, 2 to 12 `{id, label}` (label 1 to 60), and `cards`, 1 to 200 `{id, label, description?, column}` (label 1 to 200, description 1 to 500), each `additionalProperties: false`. `checks.ts`: IDs unique across columns and cards (AD-7, child IDs within their item); each card's `column` names a column. Problems name the element: `card "fix-login"`. Shape `{elements: "cards"}`. Changes: `set`s only, target `^<id>\.<id>\.column$`, value an ID. Skill draft: use "cards the user moves between 2 to 12 columns, such as statuses, priorities or owners"; note "Each card names its `column` by ID; the answer's changes are `set`s of `<id>.<card>.column`. The user only moves cards: their order, labels and the columns stay." Example: three columns, three cards.

### 5. Timeline's entry

Props: `lanes`, 1 to 20 `{id, label}` (label 1 to 60), and `entries`, 1 to 200 `{id, label, lane, date?, start?, end?}` (label 1 to 200), dates in the Gantt's `fullDate` pattern. `checks.ts`: IDs unique across lanes and entries; `lane` names a lane; an entry holds `date` alone or `start` and `end` together ("an entry holds `date` alone, a milestone, or `start` and `end`, a range"); every date exists and lies within `GANTT_FIRST_DATE` and `GANTT_LAST_DATE`, through the date checks the Gantt's props use; `end` is on or after `start`. One object schema with optional dates and the rule in the check gives one worded problem, where a `oneOf` would need a `schemaErrors` hook. Shape `{elements: "entries"}`. Changes: `set`s only, target `^<id>\.<id>\.(lane|date|start|end)$`, value an ID or a full-date; never `null`, so no date can be removed. A milestone given an `end`, or a range losing one, is refused by the edited props' check. Skill draft: use "milestones and date ranges the user moves in time and across lanes, as in a roadmap"; note "An entry is a milestone with `date` or a range with `start` and `end` (inclusive), in a `lane`; the answer's changes are `set`s of `lane`, `date`, `start` and `end`." Example: two lanes, a range and a milestone.

### 6. Changes checked against their type (open question 8)

`contract` exports `widgetChangesProblems(item: {type, id}, changes, types = WIDGET_TYPES): readonly Problem[]`, beside `widgetResultProblems`. It validates `changes` against the entry's `edits.changes` through the shared widget validator, compiled once per type, and prefixes `item <id>: `. An entry without `edits` refuses any change; an unknown type gives none. In `widget-values.ts`, step 3 computes each value's changes once; the round trip runs on them, then `widgetChangesProblems`; the first problem refuses the answer (`content`), so nothing is appended, kept or published. A decline carries no value and runs nothing. `core` names no type. The check runs for every type: task 2.1 replays the Tree, Gantt, WBS and Gantt plan suites, and a Tree or Gantt edit that fails its own schema stops the task for `/opsx:update`. `spine-update-draft.md` block 3 records the rule in AD-20.

*Alternative:* a check in each new type's `checks.ts` comparing sent and edited values, a new registry seam that duplicates the changes schema.

### 7. The LaTeX component (open questions 3 and 4)

`packages/widgets/src/latex/`:

- `render.ts`: one options object built fresh for each call: `displayMode: true`, `throwOnError: true`, `trust: false`, `strict: "ignore"`, `maxExpand: 1000`, `maxSize: 20`, `output: "htmlAndMathml"`, and `macros: {}` new each time, so `\gdef` never outlives a render. `renderInto(element, expression)` calls `katex.render`, which builds nodes and sets styles through the CSSOM; a `ParseError` gives `{error: message}`. KaTeX throws before it touches the element, so the last good preview stays; a test checks it. `parseProblem(expression)` runs `katex.renderToString` with the same options, for unit tests in Bun (no DOM); nothing ever puts its output into markup.
- `model.ts` (pure): `valueOf(props, text)` gives `{...props, expression: text}`, or `undefined` when `text` equals the props as sent.
- `index.tsx` registers `latex` with `{shape: () => LATEX_SHAPE, name: "change.widgetLatex"}`. It checks its props with `checks.ts` (the schema's limits, restated plain) and throws on a problem. Layout per DESIGN, LaTeX: a `<textarea>` in `{typography.code}` with the input atoms' look, `maxLength` 2,000, labelled "LaTeX source"; the preview under it on `{colors.card}`, labelled "Preview", scrolling sideways; the field error under the field, "This expression does not render: {message}", where the message is KaTeX's own, untranslated. The field takes the `{colors.change}` border while it differs from the agent's expression, and the counter reads `widget.noChanges` or "Your changes: expression edited". The preview renders in a layout effect on each change; ready (`useReadyAfterLayout`) once the first render has run, succeeded or failed, and `document.fonts.ready` has settled. When `disabled`, the field is read-only with the read-only look.

### 8. Package stylesheets in a chunk

`tools/build/stylesheets.ts` holds `CHUNK_STYLESHEETS: {latex: ["katex/dist/katex.min.css"]}`, each path resolved from `packages/widgets`. The build reads each file, keeps each `@font-face` source's woff2 entry as `url(data:font/woff2;base64,…)`, drops its woff and ttf entries, and appends the result to the chunk's styles after Tailwind's. `styleUrlProblems(chunk, css)` in `checks.ts` fails on any `url(` not followed by `data:` and on any `@import`, for every chunk's styles and the board page's. The build also fails on a listed chunk that does not exist and on a missing file. The chunk's notices already carry KaTeX's licence through its script. The rewrite is the spike's `inlineFonts`, run on the file rather than as a Bun plugin.

*Alternative:* `import "katex/dist/katex.min.css"` in the chunk. Bun's CSS output is dropped by `bundleChunk` today, it keeps `url()` paths even with a `dataurl` loader (spike), and the TypeScript sources would gain a side-effect import of a non-module.

### 9. The Kanban component (open question 5)

`packages/widgets/src/kanban/`:

- `model.ts` (pure): `columnsOf(props)` gives the columns with their cards in `cards` order; `moveTo(props, cardId, columnId)`; `valueOf(sent, edited)` (`undefined` when equal); `movedOf(sent, shown)`; `neighbour(columns, current, key)` for the arrow keys.
- `drag.ts`, on Pragmatic drag and drop through the `dnd` chunk, as the Ranking's `drag.ts`: each card is `draggable` with data `{kanbanId, cardId}`, and each column is a `dropTargetForElements` whose `canDrop` takes only its own item's cards. Entering and leaving set the column's indicator, a `{colors.primary}` outline as the Tree's "into" drop. A drop on another column is `moveTo`; Escape cancels natively.
- The cards are one Tab stop with a current card (roving `tabIndex`), the toolbar another: "Move to…", a Radix `DropdownMenu` with `modal={false}` as in the Tree's toolbar, listing the other columns by label, then the counter, `widget.noChanges` or "Your changes: N moved". It follows the Tree's toolbar rules, `aria-disabled` tools keeping the focus, through `shared/toolbar-focus.ts` if `approval-scale-ranking` moved them there. Moved cards take the change highlight. `index.tsx` registers `kanban` with `{shape, name: "change.widgetKanban"}`.

### 10. The Timeline component and the shared time code (open questions 6 and 7)

- **Shared time code** (task 3.2): `gantt/model/date.ts`, `say.ts` and `scale.ts` move to `widgets/src/shared/time/`, the axis's drawing out of `gantt/chart.tsx` to `shared/time/axis.tsx`, and `gantt/bar-drag.ts` to `shared/pointer-drag.ts`. The drag hook also reports the vertical travel `dy`, which the Gantt ignores. Their tests move with them; the Gantt imports them from there and changes no behaviour.
- `layout.ts` (pure): the span is that of every date as sent and as shown, plus the Gantt's tail, so a move never leaves the axis. The zoom is `openingZoom(days, width)` of the sent span, taken once at mount. Lanes are bands, each holding tracks: entries in order of start, then of `entries`, each on the first track where its box overlaps no other. A box is the shape (a range's days, a milestone's diamond) plus its label after it, estimated at 7 pixels a character and cut at 200. A range shows its label inside when it fits.
- `model.ts` (pure): `moveBy(props, entryId, days)` keeps a range's length and the dates within the Gantt's days; `moveToLane`; `dropOf({dx, laneAt}, zoom)` snaps to the nearest whole day; `stepOf(zoom)`, 1 at day zoom and 7 at week and month zoom; `movedOf`; `orderOf` for Up and Down (lane order, then start, then `entries` order).
- The entries are one Tab stop with a current entry; the toolbar is another, "Move earlier", "Move later", "Move to lane…" (a `DropdownMenu` as the Kanban's) and the counter. A press on an entry captures the pointer through `shared/pointer-drag.ts`; the preview follows; Escape, a lost capture or turning read-only cancels; a travel under the threshold is a click that makes the entry current. Ranges are `{colors.gantt-bar}` bars and milestones `{colors.foreground}` diamonds; a moved entry takes `gantt-user-change`. Lane labels sit in a fixed column, cut with an ellipsis and whole in a title. `index.tsx` registers `timeline` with `{shape, name: "change.widgetTimeline"}`.

### 11. The Approval summary of a whole-field change

`approval-scale-ranking`'s `widgets/src/approval/summary.ts` parses a target as `item.element.field`. A `set` whose target has two segments is a whole-field change: its line names the item by its chunk's `name` and the field, with the sent and new values through `values.ts` (a long string cut at 80 characters with "…"). Task 5.4 adds it, with a LaTeX beside an Approval.

### 12. Registration waits for the chunk

As in `approval-scale-ranking` decision 10, an entry joins `WIDGET_TYPES` only in the task that adds its chunk's `index.tsx` (tasks 5.1 to 5.3). Until then, tests pass `withWidgetTypes(LATEX_WIDGET, KANBAN_WIDGET, TIMELINE_WIDGET)`. Each registration task regenerates the skill (`check:skills`).

### 13. Versions

The input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s (askboard-contract-versioning). Their composed schemas and the output set's list change only when a type registers, so the four constants move in task 5.1. While this branch is stacked on `approval-scale-ranking`, a constant its base already holds past `main`'s stays as it is, and this change's version test asserts at least that value. Task 7.2 binds each at `main`'s minor plus one, after `approval-scale-ranking` merges. Each set module's header gains one sentence naming this change. The board protocol (an act's `values` are any object by item ID), the Snapshot data, the view manifest (a chunk's styles are already a file entry) and the rest keep `main`'s. Descriptions, comments and test titles say "since latex-kanban-timeline", never a number.

Binding: (filled at task 7.2) "Bound on <date>, rebased onto origin/main <sha>: input format <n> (main <m>), output format …, tool envelopes …, board document …."

### 14. The end-to-end proof

| Scenario | Where |
|---|---|
| A LaTeX corrected and answered: preview, a parse error that does not block, `collect` returning one `set` of `expression`, `fetch` returning the item | browser, session process (task 6.1) |
| A Kanban card dragged and one moved with "Move to…", held across a reload, answered, collected | browser, session process (task 6.1) |
| A Timeline range dragged across a lane and a milestone moved by the keyboard, answered, collected | browser, session process (task 6.2) |
| Acts refused through the board protocol: a reordered Kanban, a milestone given an end | `packages/server/test` (task 6.2) |
| A Snapshot of the three answered, read-only, fonts inline, opened from `file://` | browser (task 6.3) |
| One answer holding the three items' changes, pushed by the mod or collected, in each configuration, Bun and Node 24 | conformance `edit-widgets.e2e.ts` (task 6.4) |

## Merge points

Borrowed from `main` (task 0.2 checks each): `ElementShape`, `elementChanges`, `applyElementChanges`, `elementShapeOf`, `WidgetType`, `WIDGET_TYPES`, `widgetTypeOf`, `widgetResultProblems`, `widgetContentOf`, `roundTripProblem`, the shared widget validator, `ComponentFacts`, `register`, `useReadyAfterLayout`, `questionTextId`, `useStrings`, `useLocale`, `formatDate`, `GANTT_FIRST_DATE`, `GANTT_LAST_DATE`, the Gantt's `fullDate` pattern and date checks, `openingZoom`, `useBarDrag`, `LIBRARY_CHUNKS`, `WIDGETS_DIR`, `widgetChunkProblems`, `bundleChunk`, `inlineStyleProblem`, `collectNotices`, `widget.noChanges`, `widget.yourChanges`, `ID_PATTERN`.

Changes in flight (the coordinator says `approval-scale-ranking` and `askboard-skills` merge before this one):

- **`approval-scale-ranking`** (this branch's base be243ddf). Borrowed: `withWidgetTypes` (built, task 1.2), used by tasks 1.3 to 2.2; the `dnd` library chunk and its module list (its task 3.6), used by task 5.2, which appends any Pragmatic name the Kanban imports; the Approval summary's `summary.ts` and `values.ts` (its tasks 4.1 and 5.1), used by task 5.4; `shared/toolbar-focus.ts` (its task 4.3, if built), used by tasks 5.2 and 5.3; the Ranking's `drag.ts` as the pattern of the Kanban's. Overlaps: `WIDGET_TYPES` (its three lines before these), the four sets' constants (decision 13), the strings tables, `chunk-sizes.json`, the fixtures' export block, `skills/askboard/`. Tasks 5.2 and 5.4 wait until this branch's base holds its tasks 3.6 and 5.1 (task 0.2 records the head; a later head comes by `git rebase --onto`).
- **`askboard-skills`** (PR #43, open, under the base). Borrowed: `WidgetType.skill`, `bun run build:skills`, `check:skills`, `skills/askboard/`, `skills-examples.test.ts`. Tasks 1.3 to 1.5 and 5.1 to 5.3. If its templates or budgets change, the rebase regenerates rather than resolves.
- **`diagram-render`** (proposed, branch 9281d923, no task done). This change takes over its `FieldsShape` (its decision 2, task 1.1, spine blocks 3 and 4, and the contract requirement "A whole field changes by one set"). It needs an `/opsx:update` to borrow them; the coordinator is told. Other overlaps, re-checked at task 7.2: `WIDGET_TYPES` (`diagram` appended in merge order); `WidgetType` (`renders` there); `LIBRARY_CHUNKS` (`mermaid`, `plantuml` there; this change only appends names to `dnd`); `tools/build/chunks.ts` and `view.ts` (its elkjs plugin and `selectedBy` shims, this change's package stylesheets: separate hunks); `packages/widgets/package.json` and `bun.lock` (Mermaid's `katex` ^0.18 installs 0.18.10 beside this change's 0.19.1: keep both entries, then `bun install`); the four sets (it also widens the board protocol and the view manifest); the strings; `chunk-sizes.json`. If it merges first with its own `FieldsShape`, task 7.2 keeps its code, drops this change's duplicate and stops for `/opsx:update` if the semantics differ.
- **`early-benchmark`** and the spikes: no overlap. The benchmark's S7 (LaTeX) case is `benchmark-full-set`'s.

Seams this change creates, which later changes borrow once it merges: `FieldsShape`, `widgetChangesProblems`, `CHUNK_STYLESHEETS` and `styleUrlProblems`, `widgets/src/shared/time/` and `shared/pointer-drag.ts`, the LaTeX's `render.ts` options (Document review's Markdown math, if any).

## Risks / Trade-offs

- [A Tree or Gantt answer that fails its own changes schema is now refused] → task 2.1 replays every Tree, Gantt, WBS and Gantt plan suite before the check is on; a failure stops for `/opsx:update`, never a schema widened in passing.
- [Moving the Gantt's time code breaks the Gantt] → task 3.2 moves code only, its tests with it, and runs the Gantt's unit and browser files with task 0.3's counts.
- [KaTeX renders agent text as DOM] → `trust: false`, bounded expansion and size, fresh macros, the DOM API only (no markup string), and the view's policy; task 4.1 tests `\href`, `\url`, `\includegraphics`, `\htmlClass`, `\gdef` and a self-expanding macro, and the security checkpoints review it.
- [The LaTeX chunk is about 650 KB, 370 KB of it fonts] → only boards with a LaTeX item take it; task 5.1 records the size with its reason. A fonts chunk shared with a future MathLive is not needed while MathLive is out (renderer row 13).
- [Two KaTeX versions with the Diagram] → Mermaid brings its own 0.18 (renderer D5); a board with both carries both, as the spike measured; no change here.
- [Packed tracks guess label widths] → labels are cut at 200 pixels with the whole label in the accessible name and title; an overlap shows a cut label, never a lost entry.
- [Native drag fails by hand in Safari] → the keyboard moves answer; task 6.6 records the PO's check; a failure is a later change to pointer drag, as for the Ranking.
- [A resized range passes the contract] → the board offers no resize, and the answer still reports exactly what the value holds (open question 9).
- [The Approval summary shows column and lane IDs, not labels] → values are shown as sent; naming them by label is a later polish.

## Migration Plan

None: four sets widen by added schemas and composed item branches. The changes check refuses only answers that no shipped board sends. One session process serves the board page and `board-host`, so their minors move together. Rollback is a revert, then `bun install` and `bun run build:skills`.

## Open Questions

None open: the proposal's ten questions carry their proposed defaults, accepted under the PO's unattended handoff (2026-11-07); a PO answer that differs comes back through `/opsx:update` before the groups it touches. No conflict between the source documents was found: EXPERIENCE and DESIGN name the components and the looks this change builds, and the spine's Stack already pins `katex` 0.19.1.
