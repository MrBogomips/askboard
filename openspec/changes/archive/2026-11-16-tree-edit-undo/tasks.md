# Tasks

One implementer runs the groups in order: 0, 1, 2, 3, 4. Group 3 (drops) depends only on group 0 and could run beside groups 1 and 2, but task 3.4 edits `tree/widget.tsx` as task 2.6 does, so keep it in sequence. Raise the effort to high for group 1. Each task writes its tests first and sees them fail for the right reason. Commit bodies say `Refs #262`.

Terms:
- **"File run"**: `ASKBOARD_E2E_ENGINES=chromium ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/<file>` after `bun run build`. Chromium only: CI's smoke run and the pre-merge e2e train check the other engines.
- **"Dn"**: a decision in design.md. Paths are under `packages/widgets/src/tree/` unless stated.

## 0. Base

- [x] 0.1 Borrowed names (design.md, merge points): `git grep -n <name> origin/main -- packages` for each, and `openspec list` plus `.claude/worktrees/feature-accept-as-sent/openspec/changes/` for `accept-as-sent`'s seams. Tests: none. Verify: a note gives each name's file and any `accept-as-sent` seam found. A missing name stops the work for `/openspec-update-change`.
  - Note: every borrowed name was found on 95e7e31f in the files design.md lists (`onValuesChange`, `BoardContent.draft`, `keyLabel`, `useKeyPlatform` in `@askboard/view/catalog`; `linkedAdd`, `linkedDelete` in `tree/linked.ts`; `sameNodes` in `tree/model/marks.ts`; `dropOn`, `zoneOf`, `EDGE_SHARE` in `tree/model/drop.ts`; `tipOf`, `overTarget` in `tree/model/dragging.ts`; `DRAG_TIP` in `tree/classes.ts`; `TREE_KEYS` in `contract/src/widgets/tree/keys.ts`; the drag helpers in `view/test/browser/harness/tree-drag.ts`); `accept-as-sent` has artifacts only, no code seam.
- [x] 0.2 Confirm in Pragmatic drag and drop 4.0.0's documentation that `location.initial.input` (drop target `onDrag` and `onDrop` arguments) is public (D7; PO rule: documented APIs only). Tests: none. Verify: a note quotes the documentation page. If it is not documented, stop for `/openspec-update-change`.
  - Note: Pragmatic drag and drop 4.0.0's events page documents `location: DragLocationHistory` for every event, with `initial: DragLocation` ("Where the drag operation started") whose `input` holds `clientX`; so `location.initial.input.clientX` is public.

## 1. The history model (`model/history.ts`)

- [x] 1.1 Unit tests first in `model/history.test.ts` (D1, D2):
  - `entryOf` reads each `before` from the draft (none as `undefined`) and drops a no-op entry;
  - `pushed` keeps 50 and drops the oldest;
  - `liveTop` checks by reference, by structure and with `undefined`, and is stale on any other entry;
  - `undoValues` and `popped`;
  - the emptying on `disabled` and on a new `sent`;
  - a linked write of the Tree and two plans.
  - Note: not seen red first: the tests and the model went in one commit (c8640009), the red for the missing module was not recorded.

  Scenarios: Several undos, The oldest edits go, A plan edited after a linked add. Verify: red for the missing module.
- [x] 1.2 Implement `model/history.ts` (types, `TREE_HISTORY_DEPTH`, the functions of 1.1), plain ECMAScript (AD-1), and export `sameJson` unchanged from `model/marks.ts`. Tests: 1.1. Verify: 1.1 green; `marks.test.ts` green; 100% line coverage of `history.ts`; `bun run check:imports` clean.

## 2. Undo in the Tree (`history.ts`, `index.tsx`, `widget.tsx`, `toolbar.tsx`)

- [x] 2.1 Key table tests first (D6):
  - `contract/test/keys-tables.test.ts` expects `grid undo tool [mod:z] tree.tool.undo`;
  - in `toolbar.test.ts`, a two-way check between `TREE_KEYS`' `tool` entries and the labels of `itemsOf` (exported for it), with "Undo" present when nothing can be undone;
  - `widgets/test/keys-parity-tree.test.ts` is unchanged.
  - Note: the reds of 2.1 to 2.3 were seen (missing label, missing `undoTitle`, missing "Undo" tool) but not run as separate commits; the commit holds tests and code together.

  Verify: the label and two-way checks are red; parity is green.
- [x] 2.2 Tooltip test first: a pure `undoTitle(platform, say)` in `toolbar.tsx`, built on `keyLabel` and the `undo` entry, gives "Undo (⌘Z)" on macOS, "Undo (Ctrl+Z)" elsewhere and "Annulla (Ctrl+Z)" in it-IT (D5). Keys panel: none; the Tree registers no table on the board (D6). Scenario: The Undo tool. Verify: red for the missing function.
  - Note: `undoTitle` and `itemsOf` live in `toolbar-items.ts`, not `toolbar.tsx`, so that a unit test loads them without the component (80% per-file coverage).
- [x] 2.3 Browser file first: `packages/view/test/browser/tree-undo.browser.ts`, listed in `harness/suites.ts` as `{}`, on the widget host and in a WBS with PERT. Scenarios: every scenario of "Tree undo" and "Tree undo history" but "The oldest edits go" (unit, 1.1). Verify: File run red, failing on the missing "Undo" tool.
  - Note: the Italian case runs on the widget host only (the session process host builds its ask from items that carry no language); the reload and the Answer-then-Edit cases run on the session process only.
- [x] 2.4 Strings (D3, D5):
  - add `tree.tool.undo` ("Undo" / "Annulla") and `tree.undone` ("Last change undone." / "Ultima modifica annullata.");
  - remove `tree.tool.undoAdjust` and `tree.adjust.undone` from `view/src/strings/en-US.ts`, `it-IT.ts` and `keys.ts`;
  - relabel the `undo` entry in `contract/src/widgets/tree/keys.ts`.

  Tests: 2.1, the catalogue tests. Verify: the label test is green; `bun test packages/view/src/strings` is green.
- [x] 2.5 Implement `history.ts` (`useTreeHistory`, D1, D2) and route every write in `index.tsx` through `record`: the own value with its `nodeId`, and `onLinkedAdd` and `onLinkedDelete` after acceptance. Tests: 1.1, 2.3. Verify: `bun run typecheck` clean; `git grep -n "onValuesChange(" packages/widgets/src/tree` shows only `history.ts`.
- [x] 2.6 `widget.tsx` (D3):
  - drop the slot and delete `model/undo.ts` and its test;
  - take `undo` and `canUndo`, and pass `nodeId` on each write;
  - send the grid's `undo` action to the history, ignored while editing or asking;
  - set the focus and the current row, and announce `tree.undone`.
  - Note: review fix S-1: the cell editor's rename and field commits (`editing.tsx`) passed no node to `onValueChange`, so an undo did not move the focus to the renamed node; the callback now carries `nodeId` for every value commit, and an announcement count keys the Tree's live region (S-2) so that repeated undos are announced each time.

  Tests: 2.3. Verify: `git grep -n UndoSlot packages` is empty; the unit suite is green.
- [x] 2.7 `toolbar.tsx` (D5): the permanent "Undo" item, with `overflow: false`, `aria-disabled` when `canUndo` is false or the Tree is read-only, `undoTitle`, `aria-keyshortcuts="Control+Z Meta+Z"` and `data-tree-undo`. Update the header comments of `toolbar.tsx`, `widget.tsx` and `keys.ts`. Tests: 2.1, 2.2, 2.3. Verify: 2.1 and 2.2 green; File run of `tree-undo` green.
- [x] 2.8 Existing browser files:
  - in `tree-adjust.browser.ts`, "Undo adjust" becomes "Undo", and the case "another edit takes the button away" becomes "the next undo undoes that edit first";
  - `tree-toolbar.browser.ts`'s narrow it-IT board keeps "Undo" outside "More".
  - Note: `tree-moving`, `tree-deleting` and `widget-chrome-it` were re-pinned: End and the empty Tree's toolbar stop reach "Undo", and the it-IT plan board opens at 1600 px; review fix S-3 widens `tree-toolbar`'s overlap check to every toolbar button and adds the it-IT plan board at 1280 px.

  Scenarios: Undoing an adjustment, Tree toolbar overflow. Verify: File runs of both green.
- [x] 2.9 UX documents (D9):
  - EXPERIENCE.md: Widgets "Tree", Molecules "WBS with PERT", Keyboard core "Tree", and Voice and Tone (the "Tree and Gantt chrome" row, and a "Last change undone." row marked "(to review)");
  - DESIGN.md: Components "Tree" ("Undo" at the toolbar's end, disabled when empty).

  Tests: none. Verify: `grep -n "Undo adjust" docs/ux-askboard-2026-10-27/*.md` is empty.

## 3. Nesting needs a move to the right (`model/drop.ts`, `model/dragging.ts`, `drag.ts`)

- [x] 3.1 Unit tests first (D7):
  - in `model/drop.test.ts`, the five rows of D7's table at `NEST_OFFSET` ±1, and `dropOn` with an offset;
  - in `model/dragging.test.ts`, `nestHint` (middle half, no offset, into allowed), its absence when into is refused, a refusal's tip winning, and `tipOf` giving `tree.drag.nestHint`.

  Verify: red.
- [x] 3.2 Implement `zoneOf(fraction, offset)`, `NEST_OFFSET = 16`, the `offset` parameter of `dropOn`, `DragOver.nestHint` and `tipOf`. Add `tree.drag.nestHint` ("Move right to drop inside." / "Sposta a destra per inserire dentro.") to the three string files. Tests: 3.1. Verify: 3.1 green; the existing `drop` and `dragging` cases updated only where the middle without an offset changed.
- [x] 3.3 Browser tests first:
  - `harness/tree-drag.ts`'s `dragOver` takes `{ vertical: true }`, which keeps x where `beginDrag` left it;
  - `tree-drag.browser.ts` gains the scenarios "A short drag up from the handle", "Nesting on purpose", "The hint" and "The hint in Italian" (it-IT host, as `edit-widgets-it` sets it).

  Verify: File run red on the vertical cases only.
- [x] 3.4 `drag.ts` reads `location.initial.input.clientX` and gives `offset` to `over` and `drop`. `widget.tsx` passes it to `dropOn`, and `confirmGroup` applies the asked `Drop` (`INTO` goes). Update the header comments. Tests: 3.1, 3.3. Verify: File runs of `tree-drag`, `tree-drag-answer` and `wbs-linking` green; the unit suite green.
- [x] 3.5 EXPERIENCE.md, Interaction Primitives "Drag" and Widgets "Tree" (the zones, the move to the right, the hint), and a Voice and Tone row for the hint marked "(to review)". Tests: none. Verify: `grep -n "middle inside it" docs/ux-askboard-2026-10-27/EXPERIENCE.md` is empty and the new rule is there.

## 4. Records

- [x] 4.1 `contract/src/widgets/tree/widget.ts` `help.mouse`: drag to the right to drop inside a row, and Ctrl or Cmd with Z or "Undo" undoes the latest edit. Run `bun run build:skills` and commit `skills/`. Tests: the skills generator tests. Verify: `bun run check:skills` green; both skill references read "Undo".
- [x] 4.2 PRD, as D9 says: FR-11's WBS line and its extensions sentence, and FR-15's "can be undone once". Tests: none. Verify: `grep -n "undone once" docs/prd-askboard-2026-10-25/prd.md` is empty.
- [x] 4.3 `bun run build:view`. If the widgets chunk passes `chunk-sizes.json`, run `--record-sizes` and commit the file. Then run `bun run check:agent`. Tests: the whole check. Verify: `check:agent` green, with 80% coverage.
- [x] 4.4 Write `docs/as-built/tree-edit-undo.md`:
  - what was built and where the code lives;
  - the names added: `useTreeHistory`, `TREE_HISTORY_DEPTH`, `NEST_OFFSET`, `nestHint`, `undoTitle`, the strings;
  - the names removed: `model/undo.ts`, `tree.tool.undoAdjust`, `tree.adjust.undone`;
  - no versions bound.

  Tests: none. Verify: the note exists and names every path changed (`git diff --stat origin/main`).

## 5. Fixes from review

All landed in bbfe0988.

- [x] 5.1 S-1: undoing a rename or field edit puts the focus and the current row back on its node; `editing.tsx` passes the node ID with its write (D3). Tests: `tree-undo.browser.ts`, "a rename undone with the focus elsewhere". Verify: File run green, seen red first.
- [x] 5.2 S-2: each undo is announced, also when two come in a row; the Tree's live region keys its child by an announcement count (D3). Tests: `tree-undo.browser.ts`, "two undos in a row are announced twice", which uses a `MutationObserver`. Verify: File run green, seen red first.
- [x] 5.3 S-3: the overlap check covers every toolbar button, selection tools included (`allTools` in `harness/tree-grid.ts`), and adds the it-IT plan board at 1280 px (D5). Tests: `tree-toolbar.browser.ts`. Verify: File run green; the as-built note records the moves in "More" there.
- [x] 5.4 A refused write is not recorded: `kept` drops a top entry whose items all still hold their `before`, alone, and a top that is stale for any other reason still empties the history (D2, review S-7). Tests: two cases of `kept` in `model/history.test.ts`. Verify: unit suite green.

## Workflow follow-up

- The change alters a widget's rendering and the browser harness: before merge, dispatch the e2e train on the branch (`gh workflow run e2e.yml --ref <branch> -f cadence=nightly`) and triage any new failure (AGENTS.md, CI).
- The pull request says `Closes #262` and `Refs #80`; #80 stays open for redo and the Gantt and Timeline (D4).
- Archive after the pull request is merged.
