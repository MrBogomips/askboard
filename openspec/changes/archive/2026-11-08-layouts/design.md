# Design

## Context

See proposal.md for why. Read on the base c3cb6241 (`atoms` task 5.5, stacked on `origin/main` ea05608f; `main` is now 0e151a84, `chart-widget` merged):

- **The registry and its compositions** (`contract/src/widgets/registry.ts`, `compose.ts`): `WidgetType`, `WIDGET_TYPES` (eight widgets, then the eight atoms), `widgetTypeOf`, `NON_WIDGET_ITEM_TYPES`, the reserved `$defs` names (`BASE_DEFINITIONS`); `composeQuestionProps`, `composeBoardDocument` and `composeFetchResult` add each registered type's item, its props `$ref` to `urn:askboard:input:<type>-props`, to the input format's question items, the board document's and `fetch`'s. A registered type's props are the same schema in all three sets.
- **No recursive item schema exists.** A question's `items` are one level; the only depth guard is the draft record's (`nestsWithin`, `validate.ts:147`, an explicit stack). Requests have none.
- **Readers of a question's `items`** (`atoms` task 0.2's list, re-read with `git grep`): about 30 sites read `props.items` one level, in `contract` (`ask-items.ts` `placedItem`, `itemKey`, `innerItemOf`; `requests.ts`; `draft-record.ts` `draftItemsOf`; `widgets/gantt/checks.ts:188`, the plan's link), `core` (`lifecycle/widget-values.ts` item map and `editedProps`, `widget-update.ts` `holderOf` and the merge, `widget-fetch.ts`, `updates.ts` `add`, `graph-check.ts`; `context/*`, `molecules/*`, `ask.ts` `pointerSource`) and `view` (`catalog/components.ts`, `shell/{ready-tracker,board-content,board-draft,question-state,entries,reason,revision-confirm,widget-changes}.ts`, `board-page/{model,references,markdown-links}.ts`). A Ranking's `props.items` are elements and an area's are questions, not a question's items.
- **IDs on `update`** (`core/src/lifecycle/model.ts:197`, `updates.ts:146,209`): `inUse` holds question, area and deleted IDs; `add` checks the new item's and its questions' IDs; a changed question is validated alone (`validateAskRequest({askId, items: [question]})`). So a widget item may today take the ID of another question's widget item, against FR-5 and AD-7.
- **The view** (`catalog/port.ts`): `ItemProps` (atoms appended `entry`, `onEntryChange`), `BoardContent` (`items`, `questionItems`, `draft`, `shown`), `register`, `componentFor`, `useReadyAfterLayout`, `questionTextId`. `shell/renderer.tsx` `RenderItem` wraps each item in `ItemFrame` and an error boundary and binds its draft, result and entry; `shell/question-card.tsx` renders `renderedOf(question)` sorted by `layoutOf` (choice with the text, excerpts and references in the context column, the rest below at full width); `ready-tracker.ts` `questionItemsOf` reads `renderedOf`; `componentsOf` picks the chunks `assemble` inlines.
- **The board page's validators** (`tools/build/validators.ts`): Ajv standalone code for every board-protocol message to the page, which carry the board document.
- **Radix Tabs** is already in the `radix` library chunk (`tools/build/shared-modules.ts:75`).
- **The skill**: `SKILL.md` is 7,976 bytes on the base (atoms included, the Chart's line not yet), of 9,000.

ADs relied on: AD-1 (imports; the walker is plain ECMAScript), AD-6 (worded problems, generated teaching), AD-7 (registry, IDs; amended by `spine-update-draft.md` blocks 1 and 2), AD-8 (agent content as data, no `style` attribute), AD-9 (layouts are catalog components, one chunk each, hidden containers mount their items; amended by block 3), AD-10 (fail closed), AD-13 (the graph over nested items), AD-15 (Snapshots), AD-20 (drafts, answers keyed by item ID). Nothing here depends on Claude Code's run-time behaviour: no item needs a probe.

## Goals / Non-Goals

**Goals:**

- A layout is a registration: a contract folder, one registry line, a chunk, its teaching text. What nests is generic, through one walker, so the Form's sections and later containers reuse it.
- Every unit that reads a question's items sees every item at every depth, and a source guard shows which reads stay one level and why.
- An answer, a draft and `fetch` key items by ID exactly as today: no wire shape changes outside the three sets that list item types.

**Non-Goals:**

- Context items and molecule references inside layouts (open question 2), layouts in molecules (open question 10), the selected tab in the draft record (open question 7), a "wide" flag per type (open question 5), Form sections.

## Decisions

### 1. Layouts are registry entries (open question 1)

Types, appended after the atoms in this order: `stack`, `row`, `group`, `tabs`. Each has `packages/contract/src/widgets/<type>/` in the Scale's layout (`<type>-props.json`, `constants.ts`, plain `checks.ts`, `wording.ts`, `widget.ts`, `index.ts`); nouns "a Stack", "a Row", "a Group", "a Tabs layout"; no `edits`, `result` or `derived`, so the registry's existing dispatch already refuses a value or a result for a layout (`widget-values.ts`) and `holderOf` already finds a layout as a changeable item. Bounds live in each `constants.ts` (contract spec). Code points count lengths, as the atoms' do (`widgets/shared/atoms.ts`).

*Alternatives:* structural kinds like `area`, drawn by the shell: every dispatch point (checks, wording, examples, teaching, `fetch`, `update`, chunks) by hand, against AD-7's one registry and AD-9's catalog components. A `tab` item type allowed only inside `tabs` (open question 6): a placement rule and a teaching line more for no gain; a tab is an element with a child ID, as a Tree's node is.

### 2. One walker, plain ECMAScript

`packages/contract/src/nested-items.ts` imports no JSON and no registry, so the shell, the board page and `ask-core` may all import it (the shell imports no registry, widget-registry decision 8). It exports, in an appended block:

- `LAYOUT_TYPES` (`stack`, `row`, `group`, `tabs`), `isLayoutType`, `LAYOUT_MAX_DEPTH` = 4;
- `layoutListsOf(item)`: each list of items a layout holds, with its path from the item (`props/items`, or `props/tabs/<t>/items`); nothing for any other type, so a Ranking's elements and an area's questions are never walked;
- `nestedItemsOf(items)`: every item at every depth, depth-first in document order, layouts included, each with its path and layout depth, by an explicit stack;
- `mapNestedItems(items, f)`: a new list with every item at every depth replaced by `f(item)`, each layout rebuilt around its mapped items before `f` sees it; inputs are never changed;
- `layoutDepthProblem(items)`: the first layout past `LAYOUT_MAX_DEPTH` with its path, by an explicit stack that stops there, so no depth throws.

A test pins `LAYOUT_TYPES` to the registered types whose props schema holds a `layoutItem` list. Readers that walk: every reader that asks which items a question holds, what it answers, or where an item is. Readers that stay one level, each with its reason in the guard: context resolution and warnings (`core/src/context/*`, `ask.ts` `pointerSource`, `board-page/references.ts`, `contract/src/context/document.ts`) and molecule expansion and addressing (`core/src/molecules/*`), since context items and molecule references stay in the question's own `items`; the card's own list (`renderedOf`, `layoutOf`); areas' questions; Ranking's elements.

**The source guard** (`tools/nested-items.test.ts`): it lists each direct read of `items` in the sources of `contract`, `core`, `compute`, `server`, `view` and `widgets`, outside `nested-items.ts`, against a table per package of `{file, text, reason}`; a read not in the table fails it. Task 1.1 writes it with `contract`'s table, task 2.1 appends `core`'s, `compute`'s and `server`'s, task 3.1 `view`'s and `widgets`'.

### 3. Schemas and the depth bound (open questions 2 and 3)

- `composeQuestionProps` adds `$defs/layoutItem` when the registry holds a layout: the union, by `type`, of every registered type's item, layouts included. Each layout's props refer to it as `urn:askboard:input:question-props#/$defs/layoutItem`, so the board document's and `fetch`'s layouts admit the same items, the registered types' props being one schema in every set. Context, molecule, question and area items fall outside it and fail at their type. Composed over a registry without layouts the three schemas equal the base's, so the registry goldens hold; `layoutItem` joins the names a type may not take.
- Depth: `layoutDepthProblem` runs before the schema in `validateAskRequest` and in the `update` request's item checks, so Ajv's recursion is bounded by four layouts plus the items' own shape. A board document and a `fetch` result come from `ask-core`, already bounded. The board page's standalone validators compile the recursive reference into named functions (task 3.2 checks a nested board and records the board-page chunk's growth).

*Alternative:* depth in the schema by four generated levels: four copies of the union in each set.

### 4. Checks and wording

- `placedItem` places a layout's items as it places a question's, so `repeatedIdProblems` and `reservedPrefixProblems` see every level ("item IDs are unique in the ask, areas, questions and the items in layouts included").
- `itemKey` and `innerItemOf` recurse through `layoutListsOf`: a nested item's field reads `<its type>.props.<field>`, and a problem names the innermost item. `question.props.items`' wording names the layouts apart from the widgets.
- Row: `widths` is an object whose keys match the ID pattern and, read as own properties, name an item of the Row; weights 1 to 4. Tabs: tab IDs unique in the Tabs, the `u-` prefix refused, titles of 1 to 80 code points.
- `draftItemsOf` reads `nestedItemsOf` without layouts, so a draft key naming a layout is refused like an unknown item's.
- The Gantt plan's link (`gantt/checks.ts`) reads its question's items at every depth, so a plan in one tab finds its Tree in another.
- `molecules/validate.ts` refuses a definition whose one item is a layout (open question 10).

### 5. Core

- **Answers**: `widget-values.ts` builds its item map from `nestedItemsOf` and `editedProps` through `mapNestedItems`; `graph-check.ts` hands `boardGraphSource` every item at every depth, so `compute` is unchanged.
- **`change`**: `holderOf` finds an item at any depth, a layout included; the merged question's props come from `mapNestedItems`. A layout's change merges its props key by key (`items` or `tabs` replaced whole), and the question is checked as an ask's is.
- **IDs held elsewhere** (open question 11): `BoardModel.inUse` also holds every item ID of each question's current revision at every depth, kept on `add`, `revise` and `delete`; `add` checks every ID the new item holds at every depth, and `change` every ID of the changed question that another question holds. A deleted question's or area's IDs stay refused; an item a change drops frees its ID, as today.
- **A molecule reference's ID** (checkpoints 2.3 and 3.4, tasks 2.4 and 3.8): the update's ID check also holds the own ID of every molecule reference the ask has held (`widgets.references`, never pruned) against plain items, in every question, the reference's own included, and after its question is deleted; a refusal names the reference's ID, never an expanded one.
- **`fetch`**: `findWidget` at any depth; a layout's full value is the layout through `mapNestedItems`, each item as the user left it; a question's nested items the same way. Molecule references stay at the top level, so reference addressing is unchanged.

### 6. The port and the shell

- `ItemProps.renderItem?: (item: BoardWidgetItem) => ReactNode`, appended: the shell sets it on every item; it renders one item the layout holds through `RenderItem`, with the question's ID, its item IDs, the card's read-only state, the shown answer and the revision step, so a nested item has its own frame, boundary, draft, result and entry. A layout's component with no `renderItem` throws, which shows its error state.
- `BoardContent.entries?: ReadonlySet<string>`, appended: the IDs of the items whose fields hold an entry, which Tabs read for the mark.
- `renderedOf` stays the card's top-level list (`layoutOf` puts a layout below the text, at the card's full width). `nestedRenderedOf(question)` adds the items at every depth; the tracker's `questionItemsOf` and `componentsOf` read it.
- The shell's and the board page's readers go through one view helper over `nestedItemsOf`: `itemIdsOf`, `draftAnswerOf`, `entryIdsOf`, `answerHint` (document order), `board-content.ts`'s four, `board-draft.ts`'s, `reason.ts`, `revision-confirm.ts`, `widget-changes.ts`, `board-page/model.ts`'s act checks and `markdown-links.ts`' `openLinkRefusal`. A layout holds nothing in the draft.
- Registration waits for the chunk (atoms decision 10): until tasks 3.2 and 3.3, tests pass `withWidgetTypes(...LAYOUT_WIDGETS)` from `fixtures/layouts.ts`.

### 7. The components (open questions 4 to 9; DESIGN and EXPERIENCE as amended)

- **Stack**: a column with `{spacing.md}` between items.
- **Group**: a `fieldset` with a `legend` (or `role="group"` labelled by the title) on the Card structure: `{colors.border}`, `{rounded.md}`, padded `{spacing.md}`; the title in `{typography.label}`, the description in `{colors.foreground-secondary}`; text as text.
- **Row**: a `ResizeObserver` on the Row's own box sets a data attribute: side by side while its width is at least 240 px × the total weight / the smallest weight, else a column. Weights reach the view as fixed classes (`grow`, `grow-2` to `grow-4` with `basis-0 min-w-0`, written literally for Tailwind), never a `style` attribute. It reports ready after its first measure.
- **Tabs**: Radix `Tabs` from the `radix` library chunk, automatic activation (Radix's default, EXPERIENCE Keyboard core); the selection is the component's view state, not an edit (AD-9), first tab at mount and when the agent removes the selected one; `Tabs.Content` force-mounted with the inactive panels `hidden`, since Radix shows a force-mounted panel; the list labelled by `questionTextId`; triggers stay enabled on a read-only question and in a Snapshot. The mark: a `{colors.destructive}` dot after the title and the sr-only text of `ux-update-draft.md`, while `board.entries` holds an item of the tab's items at any depth. Ready after its first layout.
- Chunks: one per layout under `catalog/`, each registering with no facts; each new chunk's size is recorded with its reason.

### 8. Versions

The input format (`layoutItem`, the layouts in a question's items), the board document (the layouts in its question items) and the tool envelopes (`fetch`'s items) each take the next minor after the base's (askboard-contract-versioning). Each constant moves in task 3.2, the first registration, which changes what the sets admit; group 1's compositions run only in tests through `withWidgetTypes`. The output format, the board protocol, the Snapshot data, the view manifest and the rest keep the base's. Comments, schema descriptions and test titles say "since layouts". Task 5.2 binds each at `main`'s minor plus one, after `atoms` binds its own.

Bound on 2026-11-07, rebased onto the head of `atoms`' branch (442850f8, itself on origin/main 0e151a84, whose own minors are input 1.8, output 1.8, tool envelopes 1.8, board document 1.7, board protocol 1.6): input format 1.10 (atoms 1.9), tool envelopes 1.10 (atoms 1.9), board document 1.9 (atoms 1.8); the output format 1.9, the board protocol 1.7, the Snapshot data 1.1 and the view manifest 1.1 stay atoms'. If `atoms` merges unchanged (a squash merge), the final rebase `git rebase --onto origin/main 442850f8` moves no version while `main` holds atoms' numbers. Confirmed on 2026-11-08: `atoms` merged as #57 (7202520c) and `latex-public-api`'s archive as #58; the final rebase onto origin/main e87841d5 moved no version, each of the three sets one minor past `main`'s.

### 9. The end-to-end proof (open question 12)

| Scenario | Where |
|---|---|
| A question arranged with layouts answered through `collect`; an entry in a hidden tab across a reload; an agent change to a nested item; `fetch` of a Group and a nested Tree | browser, session process (task 4.1) |
| A Snapshot with layouts, from `file://` | browser (task 4.2) |
| Keyboard, hidden panels, the narrow Row, the mark in Italian, hover | browser (tasks 3.2, 3.3) |

No conformance file: the output format, the answer event and the push path do not change, and task 4.1 reads `collect`.

## Merge points

Borrowed from `origin/main` 0e151a84 (task 0.2 records each with its file and line): `WidgetType`, `WIDGET_TYPES`, `widgetTypeOf`, `NON_WIDGET_ITEM_TYPES`, `CONTEXT_ONLY_ITEM_TYPES`, `registryShapeProblems`, `widgetRegistryProblems`, `composeQuestionProps`, `composeBoardDocument`, `composeFetchResult`, `placedItem`, `placedItems`, `itemKey`, `innerItemOf`, `itemExpected`, `repeatedIdProblems`, `reservedPrefixProblems`, `draftRecordProblems`, `validateAskRequest`, `withWidgetTypes`, `ID_PATTERN`, `VIEW_ID_PREFIX`, `holderOf`, `questionInReference`, `boardGraphSource`, `ItemProps`, `BoardContent`, `BoardWidgetItem`, `register`, `componentFor`, `useReadyAfterLayout`, `questionTextId`, `useStrings`, `renderedOf`, `componentsOf`, `questionItemsOf` (`ready-tracker.ts`), `boardItemsOf` and `widgetItemsByQuestion` (`board-content.ts`), `answeredResultsOf`, `draftAnswerOf`, `itemIdsOf`, `draftRecordOf`, `restoreDraft`, `RenderItem`, `layoutOf`, `widgetChanges` (`shell/widget-changes.ts`), `LIBRARY_CHUNKS` (`radix`: `Tabs`), `COMPONENT_ROOTS`, `widgetChunkProblems`, `hostValidatorsCode`, `build:skills`, `check:skills`, `skills-examples.test.ts`, `component-facts.test.ts`, `hover-audit.browser.ts`, `languages.browser.ts`.

Borrowed from `atoms`, not on `main` (read at c3cb6241; its branch `worktree-feature-atoms-and-layouts` is at e54c58aa): the atom entries `TEXT_WIDGET` to `TOGGLE_WIDGET` and `ATOM_TYPES` (examples and fixtures, tasks 1.2 and 1.3), `codePointCount` (`widgets/shared/atoms.ts`, task 1.2), `draftRecordProblems`' `entries` (task 1.3), `ItemProps.entry` and `onEntryChange`, `shell/entries.ts` (`ENTRY_ITEM_TYPES`, `isEntryType`, `entryIdsOf`, `answerHint`), `cardState`'s entry, `board-page/markdown-links.ts` (`openLinkRefusal`) (task 3.1), the entries store the mark reads (task 3.3) and `tools/build/skills/atoms-skill.test.ts` (task 1.2's pattern). Tasks 0.2 and 5.2 re-check each; a difference stops the work for `/opsx:update`.

Changes in flight:

- **`atoms`** (the base; not merged, no pull request yet). Overlaps: `WIDGET_TYPES` (the layouts follow the atoms), the three sets this change widens (atoms binds first; this change binds after its merge), `ItemProps` (both append), the shell's entries, `ux-update-draft.md` (this change's Voice and Tone row follows atoms' Atoms row), `skills/askboard/` (regenerate, never resolve), `chunk-sizes.json` (re-record), `CHANGELOG.md`, CLAUDE.md's lines. After atoms merges, task 5.2 rebases with `git rebase --onto origin/main <atoms' last commit in this branch>`.
- **`diagram-render`** (proposed on `worktree-feature-diagram-render` at 9281d923, not on `main`, its base older than `widget-registry`'s merge). Overlaps: `WIDGET_TYPES` order, the input format, the board document and the tool envelopes (whichever merges second rebinds), `componentsOf` (it adds per-item library chunks; this change makes it read nested items: keep both), the skill budget. If it is re-proposed, its design should list this change's walker as the reader of nested items.
- **`early-benchmark`** and the spikes: no overlap.

Seams this change creates, which later changes borrow once it merges: `nested-items.ts` (`LAYOUT_TYPES`, `isLayoutType`, `LAYOUT_MAX_DEPTH`, `layoutListsOf`, `nestedItemsOf`, `mapNestedItems`, `layoutDepthProblem`), `layoutItem`, the four entries and `LAYOUT_WIDGETS`, `ItemProps.renderItem`, `BoardContent.entries`, `nestedRenderedOf`, the source guard's tables. The Form's sections borrow `renderItem` and the walker.

## Risks / Trade-offs

- [A reader missed reads one level, so a nested item drops out of an answer, a draft or a check] → the source guard; each reader's test puts the item two layouts deep; each checkpoint reads the guard's tables.
- [A hostile request nests deep enough to overflow Ajv's recursion] → `layoutDepthProblem` before the schema, by explicit stack; a 100,000-deep test in `ask`, `add` and `change`; the security checkpoints.
- [The board page's standalone code mishandles or bloats on the recursive reference] → task 3.2 validates a nested board document through the generated code and records the board-page chunk's growth; a growth past the budget is stated, as `askboard-implementation` says.
- [A widget in a hidden panel measures zero and stays wrong when shown] → panels hidden with `hidden`; task 3.3 shows a Gantt drawn at its panel's width once its tab is selected; if a widget does not redraw, the task stops for `/opsx:update` (alternative: panels hidden off-screen with `visibility`).
- [The ID check on `update` refuses an update that passed before] → only one that broke FR-5; `CHANGELOG.md` says so (task 5.1).
- [The skill passes its budget] → uses of at most 70 characters, one generated sentence for nesting; `SKILL.md` re-measured after atoms' rebase onto the Chart; if `check:skills` fails, the task stops for `/opsx:update` (a budget moves only through a design decision).
- [The selected tab is lost on a reload] → by design (open question 7); the fields keep their draft and the mark leads to a field to correct.
- [Layout chunks add round trips for small components] → each is a few kilobytes; assembled inline, so no request; sizes recorded.

## Migration Plan

None: three sets widen by an added definition and four types; nothing in the output format, the board protocol or the Snapshot data changes. One session process serves the board page and `board-host`, so their minors move together. Rollback is a revert, then `bun run build:skills`.

## Open Questions

- **The agent sends no layout** (conflict between sources): AD-7, Questions, says "The agent sends no layout: an excerpt goes beside its question because of its type", while FR-13 lets the agent "arrange any items on the board with layouts". The spine's sentence is about context placement; `spine-update-draft.md` block 1 rewords it so, and the PRD wins on the requirement until task 0.1 applies it.
- **"The active tab" across a reload** (EXPERIENCE, What a reload keeps) names the board's area tabs; `ux-update-draft.md` block 3 says Tabs inside a question reopen on their first tab (open question 7).
- The proposal's thirteen questions carry their defaults, accepted under the PO's unattended handoff (2026-11-07); a different answer comes back through `/opsx:update` before the groups it touches.
