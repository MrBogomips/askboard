# Design

## Context

See proposal.md for why. What the code starts from, read on this change's base (`origin/main` fd80950b plus PR #38's archives, the same code as `main`):

- **Dispatch by hand.** `"tree"` and `"gantt"` are named in `contract` (`ask-items.ts` `CONTEXT_ITEM_TYPES` and two wording strings; `widgets/items.ts` `widgetItemProblems`, `elementShapeOf`; `widgets/paths.ts` `widgetRest`, `elementOf`; `widgets/request-problems.ts` `isWidget`, `widgetSchemaErrors`; `widgets/wording.ts` `WIDGET_EXPECTED`, `WIDGET_FIELDS`; the JSON schemas `input/question-props.json`, `board-document/board-document.json`, `tool-envelopes/fetch-result.json`; the set modules' `schemas` lists and `SCHEMA_IDS`), in `core` (`graph-check.ts`, `context/fetch-item.ts`, `context/board-props.ts`, `lifecycle/widget-fetch.ts`, `widget-values.ts` with its derived-key check, `widget-update.ts`), in `compute` (`board.ts` `boardGraphSource`) and in `view` (`shell/widget-changes.ts`, `shell/change-notice.tsx`).
- **Already generic.** The view renders an item with the component its type names (`catalog/components.ts`), the build makes one component chunk per folder holding an `index.tsx` (`tools/build/chunks.ts`), `assemble` picks chunks by the board's item types, the generic diff takes a shape (`widgets/element-diff.ts`), and molecule expansion and addressing call `widgetItemProblems` and `elementShapeOf`.
- **No result anywhere but the event.** The output format's answer event already names `results` (open, by item ID). The board protocol's `answer` act, the draft record, the board state, `fetch`'s answer, the kept answer (`KeptAnswer`) and the Snapshot's logged event have `values` and `derived` only; `withinLimit` drops `changes` and `derived`.
- **The board graph's folder.** `packages/widgets/src/graph/` (no `index.tsx`) is the library chunk `board-graph`, reached by path (`tools/build/paths.ts` `GRAPH_FILE`, `shared-modules.ts` `BY_PATH`, `BOARD_GRAPH`).
- **Chunk economy.** The shell chunk is shared by every board; a widget's code belongs in its own chunk (AD-9). The shell imports `TREE_SHAPE` and `ganttShape` today for the agent-change notice.

ADs relied on: AD-1 (imports along the diagram; `core` and `compute` plain ECMAScript), AD-6 (generic tool schemas; per-widget schemas only in `contract`; worded problems), AD-7 (the sets, their owners and minors; positions and annotations), AD-9 (catalog components through the port, one chunk per component), AD-10 (fail closed), AD-13 (per-type declarations in `contract`; the graph source), AD-15 (Snapshots from the log), AD-20 (answers, `changes`, drafts, too large). AD-7 and AD-20 are amended in place by `spine-update-draft.md`; FR-20 by `prd-update-draft.md`. UX: no section changes; the change is invisible on the board for Tree, Gantt and Choice. Nothing here depends on Claude Code's run-time behaviour, so nothing needs a probe.

## Goals / Non-Goals

**Goals:**

- A later widget change touches shared files only by appending: one import and one line in the registry, one line in `compute`'s source table if it computes, its schemas' version bumps; everything else lives in its own folders.
- Behaviour-neutral for Tree, Gantt, Choice and molecule references: every existing test passes unchanged (a test that enumerates the widget types may read the list from the registry, said in its task's note), and the composed schemas over Tree and Gantt equal today's.
- The `results` seam complete from the component to the agent and the Snapshot, proven at every unit with a test-only type.

**Non-Goals:**

- A widget, atom or layout; nested items; a whole-field shape in the generic diff (proposal, open question 7); results in `update`'s `answer`; skill references generated from the registry.
- Moving the Tree's and the Gantt's schemas or checks: their files stay where they are; only their wording moves into their folders.

## Decisions

### 1. One registry entry per type, one list in `contract`

`packages/contract/src/widgets/registry.ts` exports `WIDGET_TYPES: readonly WidgetType[]` (Tree, then Gantt; later types appended), `widgetTypeOf(type, types = WIDGET_TYPES)` and `widgetRegistryProblems(types)`. Each entry lives in its widget's folder (`widgets/tree/widget.ts`, `widgets/gantt/widget.ts`):

```ts
type WidgetType = {
  type: string;                 // item type, component name, chunk name
  noun: string;                 // agent-facing: "a Tree"
  props: AnySchemaObject;       // $id urn:askboard:input:<type>-props
  propsProblems(props: unknown, origin: WidgetOrigin): readonly Problem[];   // after the schema
  itemProblems?(item: unknown, question: unknown): readonly Problem[];       // Gantt plan link
  edits?: { changes: AnySchemaObject; shape(props: unknown): ElementShape }; // $id urn:askboard:output:<type>-changes
  result?: { schema: AnySchemaObject; problems?(result: unknown, props: unknown): readonly Problem[] }; // urn:askboard:output:<type>-result
  derived?: { describe: string; problem(rest: readonly string[], props: unknown): string | undefined };
  wording: { expected: Record<string, string>; fields: Record<string, string>;
             rest?(rest: Segments): Segments; element?(item: unknown, rest: Segments): string | undefined;
             schemaErrors?(errors: readonly ErrorObject[], value: unknown): readonly ErrorObject[] };
  example: { item: { type: string; id: string; props: unknown } };
};
```

`widgetRegistryProblems` refuses a duplicate type, a type that is a context item type, `molecule`, `question` or `area`, a type outside the ID pattern, and `$id`s not of the patterns above; a test runs it over `WIDGET_TYPES`. An entry module imports only JSON schemas, pure checks, constants and types, never a runtime value of `validate.ts`, `sets.ts` or a set module: the sets import the registry to compose their schemas (decision 4), and an import in the other direction would read `WIDGET_TYPES` before it is initialised for some import orders. The Tree's and Gantt's exports (`validateTreeProps`, `TREE_SHAPE`, `GANTT_ANSWER_DERIVED`, …) stay, and the entries reuse them.

*Alternatives:* a table per unit (what exists, and what collides); a code generator listing the folders (a generated file to keep in sync, and the same conflict on it).

### 2. The registry is a parameter where tests need another one

Each dispatch function takes the registry as its last parameter, defaulting to `WIDGET_TYPES`: in `contract` the item checks, the shape lookup, the wording lookups, the result check and the schema composers; in `core` the answer path (`widgetContentOf` and what calls it in `acts.ts`), the event fields, the fetch and Snapshot helpers. No unit passes another registry at run time, and request validation and `AskCore` use the shipped one only (proposal, open question 6). A schema an entry carries is validated by its `$id` through the shared validator; one no set holds (a test type) is added to the widget validator on first use, as `widgetValidator` already does, so problems read the same either way.

The test-only type is `PROBE_WIDGET` in `packages/contract/src/fixtures/widget-registry.ts`, exported in an appended block of `@askboard/contract/fixtures` with `PROBE_TYPES = [...WIDGET_TYPES, PROBE_WIDGET]`: props `{options: [{id, label}]}` (a flat list, shape `{elements: "options"}`), a result `{pick: <option ID>}` whose check refuses an ID the item does not hold, a derived field `count`, and an example. Its schemas use `$id`s under `urn:askboard:input:probe-props` and `urn:askboard:output:probe-*` and are in no set.

### 3. Choice and molecule references stay outside

Choice is the question's own `options`, not an item; a molecule reference is expanded before any unit dispatches on a widget. `CONTEXT_ITEM_TYPES` becomes the context types, then the registry's types, then `molecule`, so today's list and its wording ("…, "tree", "gantt" or "molecule"", "widgets (a Tree, a Gantt, a molecule reference)") read the same, built from the entries' `type` and `noun`.

### 4. Composed schemas

The three JSON files keep their non-widget parts; pure composers add, per registered type, a `$defs/<type>` item `{type: {const}, id, props: {$ref}}` and its reference in the discriminated `oneOf`: before `molecule` in the input's question items, after `image` in the board document's and `fetch`'s context items. `fetch`'s item `type` enum and its widget branch (today `if tree then tree-props else gantt-props`) are folded over the registry in order, the last type taking the `else`, which gives today's schema for Tree and Gantt. The input format lists each entry's props, the output format each entry's changes and result schemas; `SCHEMA_IDS` keeps its Tree and Gantt keys and gains none per type, since dispatch reaches a schema through its entry. A golden test composes over `[TREE, GANTT]` explicitly and compares with copies of `main`'s three files, so it keeps holding when a later widget registers. Tool definitions are untouched (AD-6). The board page's standalone validators compile the composed sets as they do today. TypeScript: the item unions (`WidgetItem`, `FetchItem`, `FetchContextItem`) keep their Tree and Gantt members for the code that reads their props; dispatching code reads a widget item as `{type: string; id: string; props: unknown}`, so a new type needs no union edit to be checked, stored and fetched.

*Alternative:* keep the JSON files listing every type: three files edited by every widget change.

### 5. Wording from the entries

Each entry carries its own `expected` and `fields` tables, keyed `<type>.props…`, moved out of `widgets/wording.ts`, plus its path folding (`rest`: the Tree folds children levels and column fields, the Gantt a plan's task keys), its element naming (`node "ux"`, `task "t1"`) and its schema-error filter (the Gantt's `tasks` list-or-map). `WIDGET_EXPECTED` and `WIDGET_FIELDS` become the merge of the entries' tables with the molecule reference's, and `ITEM_EXPECTED`'s `<type>.id` lines are generated per type. The texts are those of `main`, character for character.

### 6. Results: a second channel beside the edited value (open questions 1 and 2)

A component reports its result with `onResultChange(result | undefined)`, beside `onValueChange`; the view keeps results in a second store keyed by item ID, and the draft record's question holds them in `results`. Results follow every rule values follow in the view: "Answer" enabled, held for Submit, mirrored and restored, kept on "Keep mine", dropped on "Reload" and cleared once the answer settles; an item with no result holds no entry (AD-10). The shapes, each at its set's next minor:

| Where | Field | Set |
|---|---|---|
| `answer` act | `results`: item ID → result, at least one | board protocol |
| draft record question | `results`: item ID → any JSON | board protocol |
| board state's current and previous answer | `results` by expanded item ID | board protocol |
| answer event | `results` (unchanged); `tooLarge` excludes `results` | output |
| `fetch` answer; widget item alone | `results`; `result` | tool envelopes |
| Snapshot logged event | `results`, for a `tooLarge` event only | Snapshot data |

`ask-core` checks results after values (`widgetContentOf`): each key an own property naming a widget item of the question in the named revision (a `Map` lookup, so `__proto__` and `constructor` are refused); the type declares a result; the result passes the type's schema, then its `problems` against the edited value when the answer carries one, else the props as sent; each value is JSON. An answer whose only content is results is an answer; a decline carries none. The event's `results` keys are in reference addressing (`answerInReferenceAddressing` maps them as it maps values; a result's content is the widget's and names no item ID). `KeptAnswer` gains `results`, kept for every answer that gave one; the board state reads them from there, as it reads values; `withinLimit` drops `results` with `changes` and `derived`; `fetch`'s answer returns the kept results; `AskCore.keptAnswerResults(askId)` gives the Snapshot's gathering those of `tooLarge` events, which `loggedWith` puts in `results` beside `values`. A widget item fetched alone carries its latest answer's `result`.

*Alternatives:* one draft value per item split by declaration (every edited value changes shape, and the shell must know types); results never dropped (unbounded for review widgets).

### 7. Result declarations and the annotation (open question 3)

A type's result schema is `urn:askboard:output:<type>-result`, listed in the output format, with optional checks against the props. The annotation is `urn:askboard:output:annotation` in the output format: `{id, target: {selector}, body: {text}}`, `id` an element ID (a view-made one in practice), `text` 1 to 2,000 characters; `$defs/selector` a discriminated union on `type`: `element` (`id`), `label` (`label` 1 to 200 characters, `occurrence` a whole number from 1), `region` (`value` matching `xywh=percent:x,y,w,h`, four numbers from 0 to 100), `line` (`side` `old` or `new`, `path` as a pointer's path, `line` from 1), `quote` (`exact` 1 to 2,000 characters, `prefix` and `suffix` up to 200), `position` (`start` and `end` from 0). `annotationProblems` adds what a schema cannot say: `start` not after `end`, a region inside 100 by 100. A type's result schema references `urn:askboard:output:annotation` for its annotations; a later selector is a minor.

### 8. The view learns a type's facts from its chunk (open question 5)

`register(name, component, facts?)` in `catalog/port.ts` takes `facts: {shape?(props): ElementShape; name?: StringKey}`, and `componentFacts(name)` returns them. The Tree chunk registers `{shape: () => TREE_SHAPE, name: "change.widgetTree"}`, the Gantt chunk `{shape: ganttShape, name: "change.widgetGantt"}`. `widget-changes.ts` reads the shape from the facts (a type with none is not listed, as an added item is not), and `change-notice.tsx` the name, else the type as sent; `WidgetChange.type` becomes `string`. The shell imports nothing from the registry, so its chunk does not grow per widget. A `widgets` test imports each widget chunk's entry and checks its facts against the registry entry (same shape for the example props, a name present), so a widget change cannot drift.

*Alternative:* the shell imports `WIDGET_TYPES`: every widget's schemas, checks and wording in the shell chunk of every board.

### 9. `ItemProps` gains `result` and `onResultChange`

`result` is the item's held result, else its latest answer's, else `undefined`; `onResultChange` puts one into the draft record or removes it. `item-callbacks.ts` builds it as it builds `onValueChange`. `draftAnswerOf` adds `results`; `shownResultFor` reads an answer's results as `shownFor` reads values; the view protocol's answer takes `results` (`someOf` gains it, and `derivedAlone` accepts derived beside it); the board page's model refuses results keys that name no widget item of the question, as it does values'; `unsent-work.ts` counts held results. Tree and Gantt never call `onResultChange`.

### 10. The board graph's folder and the chunk check (open question 4)

`packages/widgets/src/graph/` moves to `packages/widgets/src/board-graph/`; `GRAPH_FILE`, `BY_PATH`'s tail and `BOARD_GRAPH` (`@askboard/widgets/board-graph`) follow, and every importer changes its path. The library chunk keeps its name `board-graph`, so the manifest and `chunk-sizes.json` keep their keys. `tools/build/chunks.ts` gains `widgetChunkProblems(chunks, types)`: a registered type no component chunk registers (through `chunkComponents`), and a chunk folder under `packages/widgets/src/` whose name is no registered type, each fail the build by name. The view's catalog chunks (`choice`, `context`) are not widget folders and are not checked against the registry.

### 11. `compute`'s graph sources by type

`packages/compute/src/board-sources.ts` exports `BOARD_SOURCES: Readonly<Record<string, (item: BoardSourceItem) => readonly GraphItem[]>>`, empty here. `boardGraphSource(items, sources = BOARD_SOURCES)` keeps its Tree and Gantt mapping as it stands and, for any other type, appends what that type's source gives, in board order; a type with no source adds nothing. `compute`'s sources import no registry (its chunk stays small); a `compute` test checks that every registered type that declares derived values is `tree`, `gantt` or a key of `BOARD_SOURCES`. A new computing widget appends one entry, returning existing graph item kinds or a kind it adds.

### 12. Versions

The output format, the tool envelopes, the board protocol and the Snapshot data each take the next minor after `main`'s (askboard-contract-versioning): the constant set to `main`'s minor plus one when group 2 starts, one appended sentence in each set module's header naming this change, and the binding at the rebase task. The input format and the board document widen nothing: their composed schemas equal today's. Schema descriptions, comments and test titles say "since widget-registry", never a number.

Binding: Bound on 2026-11-06, rebased onto 9322a5a6 (PR #40, on origin/main 435939d7 with `widget-editing-plus` merged): output format 1.5 (main 1.4), tool envelopes 1.5 (main 1.4), board protocol 1.6 (main 1.5), Snapshot data 1.1 (main 1.0); input format 1.5 and board document 1.4 stay at main's.

## Merge points

Borrowed from `main` (task 0.2 checks each with its file and line): `CONTEXT_ITEM_TYPES`, `ITEM_EXPECTED`, `widgetItemProblems`, `elementShapeOf`, `WidgetOrigin`, `widgetRest`, `elementOf`, `widgetProblems`, `widgetSchemaErrors`, `WIDGET_EXPECTED`, `WIDGET_FIELDS`, `treePropsProblems`, `ganttPropsProblems`, `ganttPlanLinkProblems`, `TREE_SHAPE`, `ganttShape`, `GANTT_ANSWER_DERIVED`, `TREE_PERT_ANSWER_DERIVED`, `widgetValidator`, `validateAgainst`, `createAjv`, `SCHEMA_IDS`, `ANSWER_EVENT_MAX_CHARS`, `draftRecordProblems`, `formulaWarnings`, `fetchItemOf`, `boardPropsOf`, `holderOf`, `questionInReference`, `widgetContentOf`, `widgetFieldsOf`, `withinLimit`, `KeptAnswer`, `keptAnswerValues`, `answerInReferenceAddressing`, `gatherSnapshot`, `boardGraphSource`, `register`, `componentFor`, `ItemProps`, `draftAnswerOf`, `shownFor`, `widgetChanges`, `chunkComponents`, `componentChunks`, `GRAPH_FILE`, `BOARD_GRAPH`.

Changes in flight:

- **`widget-editing-plus`**, branch `worktree-feature-widget-editing-plus-2` read at `c0b36aec` (2026-11-06), group 1 merged as #36. This change borrows nothing from it. Overlaps, each re-checked at the rebase task:
  - Versions: it widens the input and output formats; this change the output format, tool envelopes, board protocol and Snapshot data. Whichever merges second binds the output format at `main`'s minor plus one.
  - `packages/compute/src/board.ts`: it edits `planTasks` (requested durations); this change edits `boardGraphSource` and its signature. Separate hunks.
  - `packages/contract/src/schemas/output/index.ts`: both edit the constant; this change also the schemas list and the header. Take `main`'s constant, then rebind.
  - `packages/contract/src/widgets/gantt/`: it edits `checks.ts`, the two schemas and `index.ts`; this change adds `widget.ts` and moves the Gantt's wording into the folder. The moved wording carries any line it adds to `widgets/wording.ts` (none at `c0b36aec`; a plan entry's `duration` is unworded there).
  - `packages/contract/src/fixtures/index.ts`: it edits the Gantt block at the top; this change appends a block at the end.
  - `tools/build/shared-modules.ts`: it edits the `radix` list; this change `BY_PATH` and `BOARD_GRAPH`. Separate hunks.
  - `packages/widgets/src`: it adds importers of `../graph/` (`tree/model/pert.ts`, `tree/widget.tsx`, `tree/model/adjust-answer.test.ts` at `c0b36aec`). After its merge, `git grep -n "/graph/" packages/widgets/src` must find none, each moved to `board-graph`.
  - `packages/view/chunk-sizes.json`: both may re-record; follow askboard-implementation.
  - Specs: it modifies `compute` "CPM scheduling" and "The board's graph source", `contract` "Gantt item props", "Gantt changes", "Tree changes"; this change modifies none of those.
- **PR #38** (`worktree-feature-archive-merged`, open): this change's base. If it merges squashed, the rebase task runs `git rebase --onto origin/main <#38's last commit>`.
- `early-benchmark` (`packages/bench`) and the four spikes (documents): no overlap.

Seams this change creates, which later widget changes will borrow once it merges: `WidgetType`, `WIDGET_TYPES`, `widgetTypeOf`, `widgetRegistryProblems`, the annotation `$id`, `BOARD_SOURCES`, `register`'s facts and `componentFacts`, `ItemProps.result` and `onResultChange`, `PROBE_WIDGET` and `PROBE_TYPES`. Renaming any of them after another design cites it goes through the coordinator.

## Risks / Trade-offs

- [The sets import the registry; an entry importing the validator would read `WIDGET_TYPES` uninitialised] → decision 1's import rule; a test imports `@askboard/contract`, `@askboard/contract/validate` and the registry in each order, each in a fresh process (`Bun.spawn`).
- [A wording or schema drifts while moving] → every existing contract, core, server and view test runs unchanged; the golden composition test; the approved examples stay byte-identical.
- [The results path has no browser or end-to-end proof here] → each unit is tested with `PROBE_WIDGET`; `board-host` and `ask-core` are tested at their boundary for the refusal path; the first widget that declares a result (Approval or the atoms) carries the browser and session scenarios, which its design must list.
- [The answer event's `results` stay open in the schema] → `ask-core` is the gate: own-property keys, per-type schema and checks, JSON only, refused whole (AD-10); the security review at groups 2 and 3 checks it.
- [Results grow events] → the too-large rule (decision 6), tested with a probe result over the limit.
- [Concurrent widget changes still meet on the registry's two lines and the version constants] → the conflict is a kept-both append and a rebind (askboard-contract-versioning); nothing else is shared.
- [The rename breaks `widget-editing-plus`'s new imports at its rebase or ours] → merge point above; the build fails loudly on a missing path.

## Migration Plan

None: every set widens by optional fields and one added limit (`tooLarge` excludes `results`, which no producer emits yet); one session process serves the board page and `board-host`, so their minors move together. Rollback is a revert.

## Open Questions

None open: the proposal's seven questions carry their answers. Annotation field limits (decision 7) may be widened by the first annotating widget as a minor.
