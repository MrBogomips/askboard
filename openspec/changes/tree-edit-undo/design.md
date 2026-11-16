# Design

## Context

See proposal.md (Why). Code at `origin/main` 95e7e31f, `packages/widgets/src/tree/`:

- **Writes.** The Tree writes the draft record along three paths:
  - its own value through `onValueChange`, which `widget.tsx` reaches by `edited` (cell commits, through `editing.tsx`), `change` (moves, drops) and `adjusted`;
  - an add or a delete through `onLinkedAdd` and `onLinkedDelete` in `index.tsx`. These call `linkedAdd` and `linkedDelete` (`linked.ts`), which return the Tree's value and the Gantt plans' values. They then write them in one `onValuesChange` update (AD-9, molecules D11 and D12).
- **The undo slot.** `model/undo.ts` holds the one slot (`UndoSlot`, `liveSlot`, `draftAfterUndo`). `widget.tsx` empties it on any other write. The toolbar shows "Undo adjust" only while the slot is live. The grid's `mod+z` (`model/keys.ts`, the `undo` action) runs `undoAdjust`.
- **Drops.** `model/drop.ts` decides a drop from the vertical fraction alone (`EDGE_SHARE` 0.25, `zoneOf`). `drag.ts` reads `location.current.input.clientY` from Pragmatic drag and drop 4.0.0, and `dropOn` feeds both the indicator (`dragging.ts`, `overTarget`, `indicatorOf`) and the drop (`dropRow`). The grip (`DRAG_HANDLE`, 14 px) is centred vertically in a 32 px or 40 px row. The tip under the grid (`DRAG_TIP`, `tipOf`) only says why a drop is refused.
- **What shares this model.** The WBS with PERT is the Tree component itself, with `pert` and the board's graph, so it is covered. The Gantt plan has its own editing model (`gantt/editing.ts`, `gantt/model/edits.ts`). It imports only `tree/model/rows.ts` from the Tree, so it is out of scope (#80). Its tasks follow the Tree's leaves, so an undone Tree edit reaches it as any Tree edit does.
- **The port.** `ItemProps.board.draft` (`view/src/catalog/port.ts`) is the draft record by item ID; `onValuesChange` writes several items of the question in one update, `undefined` removing an entry.

## Goals / Non-Goals

**Goals:**
- One recorder that every write of the Tree goes through, so that no edit escapes the history.
- An undo that restores the draft record's entries exactly, so that it leaves no trace: a fully undone Tree has no draft entry, as before.
- A drop rule that a one-row vertical drag cannot turn into a nest, with an indicator that never lies.

**Non-Goals:**
- Redo (D4).
- Undo in the Gantt, the Timeline, the Kanban or the Table (#80).
- A "restore what the agent sent" control, and the card's action area (`accept-as-sent`, #263).
- Moving the Tree onto `KeyHint`, `KeysButton` and the board's keys panel (the Tree's key retrofit, keyboard-shortcuts-help D14).
- Changing the other tools' tooltips.

## Decisions

### D1. One recorder at the item's boundary

A hook, `useTreeHistory` (`tree/history.ts`), lives in `index.tsx`'s `Tree`, which holds `board`, `sent`, `disabled` and `onValuesChange`. It gives:

- `record(values, nodeId?)`: for each item ID in `values`, read the entry it replaces (`board.draft.get(id)`, `undefined` for none). Write `values` with `onValuesChange`, then push the entry `{ written: id → { before, after }, nodeId }`. An entry whose every `after` equals its `before` is not pushed.
- `undo()`: on the live top entry, write every `before` with `onValuesChange` in one update, pop the entry and return its `nodeId`; `undefined` when nothing is live.
- `canUndo`: whether a live entry exists.

Every write goes through `record`:
- the widget's own value, which `index.tsx` hands to `TreeWidget` as `onValueChange = (v, nodeId) => record({ [item.id]: v }, nodeId)`;
- `onLinkedAdd` and `onLinkedDelete` record `write.values` after `linkedAdd` and `linkedDelete` accept them. A refused linked edit writes and records nothing.

`TreeWidget` loses `slot`, `liveSlot`, `slotOf`, `draftAfterUndo` and `undoAdjust`, and takes `undo` and `canUndo` as props. `model/undo.ts` and its test are deleted.

The pure part is `model/history.ts`, with no React (AD-1): the types, `TREE_HISTORY_DEPTH`, `entryOf(draftOf, values, nodeId)`, `pushed`, `liveTop`, `undoValues(entry)` and `popped`. The hook only holds the list in state and calls them; the widgets package renders no hooks in unit tests, so the hook is exercised in the browser (D8). Its liveness check compares each written item's current draft entry with its `after`, by reference first and then with `sameJson`. `sameJson` is today private in `model/marks.ts`; it gets exported, unchanged.

*Why at the item boundary:* `index.tsx` alone sees the draft record and the linked plans' entries. Recording inside `TreeWidget` would miss the plans an add or a delete writes, and an undo of a linked delete would leave the dependents rewired.

*Alternatives:*
- Snapshots of the Tree's value only, as the slot does. Rejected: it cannot undo a linked edit.
- Inverse operations (a move's reverse move). Rejected: each edit kind would need its own inverse, the linked plan edits included, and restoring entries covers every kind with one rule.

### D2. Depth, lifetime and liveness

- **Depth.** `TREE_HISTORY_DEPTH = 50`; the oldest entry goes past it. 50 covers any run of slips. The worst case, 50 values of a 500-node Tree (`TREE_MAX_NODES`) plus the plans of linked edits, is a few megabytes of shared immutable objects in one tab.
- **In memory only.** The history is view state, as the selection and today's slot are. It is never in the draft record, so a reload, a takeover in another tab or a remount of the item (a tab switch inside a question that unmounts it) starts with an empty history. The draft keeps every edit (AD-20, EXPERIENCE "What a reload keeps"). Mirroring the history to `ask-core` would put view state into the board protocol for no answer-bearing gain.
- **Emptied when:**
  - the Tree is `disabled` (answered, being sent, locked). An undo after an answer would quietly start a revision, and after "Edit" the history starts again;
  - `sent` changes (the agent's update): a `before` of "no entry" would now mean the agent's new value;
  - the top entry is no longer live: an item it wrote holds something else (a Gantt edit on a plan a linked add wrote, an agent change the shell kept). Lower entries chain from the top one, so the whole history goes, as the slot did.
- **A refused write is dropped alone.** The shell refuses a write all or nothing (a read-only item, `item-callbacks.ts`). Every item of a top entry that still holds its `before` means the draft never took that write. `kept` (`model/history.ts`) drops that entry alone and checks the next one, so the earlier edits stay undoable. A top entry that is stale for any other reason still empties the whole history (review S-7).
- **Not recorded:**
  - view state: expand, collapse, selection, focus, the pending unnamed add;
  - a refused drop or linked edit;
  - a cancelled question;
  - a move that changes nothing (`moved.value === value`, already short-circuited in `dropRow`);
  - the undo itself.

### D3. What an undo does on screen

- **The draft.** The `before` entries are written back in one `onValuesChange` update. The shell's step before a change runs as for any edit, and the marks, "Your changes" and the question's state follow the draft. Undo never answers (AD-10).
- **Focus.** The entry's `nodeId` is the node the edit acted on:
  - the moved or dropped node;
  - the node of the committed cell;
  - the deleted node;
  - for an add, its anchor, since the added node goes;
  - none for an adjustment.

  After the undo, the current row and the view's focus go to `nodeId` when the restored Tree holds it (`focusOn`), its ancestors expanded as a move's focus does. Otherwise they stay, and `shownView`'s fallback applies. From the grid key the DOM focus follows the row, as a key's edit does. From the toolbar it stays on "Undo", as every tool's does (`widget.tsx` header). The tool turns `aria-disabled` and keeps the focus when the history empties.
- **Announcement.** The status line says `tree.undone`, "Last change undone.", replacing `tree.adjust.undone`.
- **When undo does nothing.** It is ignored while a cell editor is open (its keys are the editor's: `onKeyDown` returns early, and Ctrl+Z is the input's own text undo) and while the delete or group question is open (the question takes the toolbar's place; the grid key does nothing then).

### D4. No redo

Redo would need:
- a new vocabulary action (`redo`, `Mod+Shift+Z`) in `packages/contract/src/keys/vocabulary.ts`. A new vocabulary action is the PO's to approve (keyboard-shortcuts-help D2);
- a change to `check.ts`, whose `MOD_SHIFT_KEYS` refuses `Mod+Shift+Z` as a browser key today;
- its label, the users' key overrides and the regenerated skills;
- a second permanent tool in a toolbar that already overflows at 1024 px in it-IT.

The PO's problem in #262 is recovering from an accident, which undo solves. A redo after an over-undo is a by-hand re-edit of one step. Redo stays with #80, which asks for it across widgets, where one vocabulary decision serves all of them.

### D5. The toolbar's "Undo"

- **Placement.** "Undo" (`tree.tool.undo`, "Undo" / "Annulla") takes the slot of "Undo adjust": the last of the selection and adjustment tools, `overflow: false`. It is always rendered and `aria-disabled` when `canUndo` is false or the Tree is read-only. A tool that comes and goes, as "Undo adjust" did, is what the PO could not find: a disabled tool shows where undo lives before it is needed.
- **Tooltip.** Its `title` is `"{label} ({keys})"`, the key in the platform's form: `keyLabel` for the `undo` entry's binding (`mod` + `z`) and `useKeyPlatform`, both from `@askboard/view/catalog` as `KeyHint` uses them, so "Undo (⌘Z)" or "Undo (Ctrl+Z)". The other tools keep their raw form until the Tree's retrofit. `aria-keyshortcuts` stays `Control+Z Meta+Z`.
- **The Italian word.** "Annulla" is EXPERIENCE's word for the `undo` action (Voice and Tone, Key actions) and the prefill's "Undo". It is also the adjustment panel's and the questions' "Cancel". The panel is a popover over the toolbar and the questions replace the tools, so no two "Annulla" share a visible row. The it-IT browser test names the tool by its `data-tree-undo` attribute, not by its name.
- **The overflow.** One more permanent tool makes the row crowd sooner. The existing overflow rule ("Tree toolbar overflow") still holds: the moves go into "More", and "Undo" stays out.

### D6. Keys: table and contextual help

- **Key table.** No key changes. The Tree's table (`packages/contract/src/widgets/tree/keys.ts`) keeps `vocabularyEntry("undo", GRID, "tool", …)`, the vocabulary's `mod+z`. Its label becomes `tree.tool.undo`, and its meaning becomes "undo the latest edit". No own action is added. Its visible counterpart is the toolbar's "Undo" tool, which now always exists, so the two-way "Every visible action in the table" holds at all times, not only after an adjustment.
- **Parity.** The parity test (`widgets/test/keys-parity-tree.test.ts`) is unchanged, since the handler's binding is unchanged; it must stay green. `keys-tables.test.ts` gets the new label.
- **Contextual help.** The Tree does not register its table with the board (`KEY_TABLES_ON_BOARD` is `["ranking"]`), so it has no `KeyHint`, `KeysButton` or keys panel. Its help is each tool's `title` and `aria-keyshortcuts`, and `askboard-help`'s generated table. This change keeps that state: the tooltip and `aria-keyshortcuts` of "Undo" (D5), and the regenerated `skills/askboard-help/references/widgets/tree.md` and `skills/askboard/references/widgets/tree.md` row "Undo". `keys-coverage.test.ts` is unaffected, since the Tree has a table.
- **Teaching text.** The Tree's mouse help (`widget.ts` `help.mouse`) gains the nesting rule and the undo, and `bun run build:skills` regenerates both skills.

### D7. Nesting by drag needs a move to the right

The rule, in `model/drop.ts`, is `zoneOf(fraction, offset)`, where `offset` is the pointer's horizontal distance from where the drag started, in CSS pixels:

| Pointer | Zone |
|---|---|
| `fraction < 0.25` | before |
| `fraction > 0.75` | after |
| middle, `offset ≥ NEST_OFFSET` | into |
| middle, upper half (`fraction < 0.5`) | before |
| middle, lower half | after |

`NEST_OFFSET = 16`, one indent step: DESIGN.md Tree indents by `spacing.lg` per level, written `pl-[16px]` in `classes.ts`. `drag.ts` reads `location.initial.input.clientX`, part of the `DragLocationHistory` type of Pragmatic drag and drop 4.0.0's element adapter, beside the `location.current.input` it already reads. Task 0.2 confirms it in the library's documentation (the PO's rule: documented APIs only). `RowDragEvents.over` and `drop` carry `offset`, and `dropOn` takes it. Since the indicator and the drop both come from `dropOn`, the indicator stays truthful by construction.

**Evidence for this rule over a narrower band.** The grip sits at the row's vertical centre. A drag of one row up or down from it lands at the same fraction of the target row, about 0.5, whatever the band's width. A middle band of 40% (`EDGE_SHARE` 0.3) only shrinks the target around exactly that point. It would leave the #262 path almost as likely and make deliberate before and after drops harder.

**The hint.** `DragOver` gains `nestHint: boolean`. It is true when the pointer is in the middle half with `offset < NEST_OFFSET` and a drop into the target would be allowed (`relocationProblem(..., "into")` is `undefined`). `tipOf` then gives `tree.drag.nestHint`, "Move right to drop inside." / "Sposta a destra per inserire dentro.". A refusal's tip, which `tipOf` gives first, wins.

**The confirmed group drop.** `confirmGroup` today calls `dropRow(..., INTO)` with a fraction. It now re-applies the asked `Drop` itself (`edit.drop`), since an `into` can no longer be rebuilt from a fraction alone. `INTO` goes.

*Alternatives:*
- A dwell time over the middle before "into" engages. Rejected: time-based behaviour is what this project's flaky tests come from, and the spec could not state it as a testable rule.
- A confirmation on every nest by drop. Rejected: friction on every deliberate nest, now that undo exists.
- The offset measured against the target's name column instead of the drag's start. Rejected: it depends on the target's level, so a deep node dragged onto a shallow one would nest on a vertical drag.

**The keyboard path is unchanged** (Alt+Shift+ArrowRight indents), and every drop still has its button or key ("Tree drag has a keyboard path and is a change").

### D8. Tests

- **Units, written first:**
  - `model/history.test.ts`: push, depth, liveness by reference and by structure, an `undefined` entry, the no-op entry, pop;
  - the same file: `entryOf` and `undoValues` for a linked write of the Tree and two plans, and the emptying on `disabled` and on a new `sent`;
  - `model/drop.test.ts` and `model/dragging.test.ts`: the five rows of D7's table, the hint, and a refusal's priority;
  - the existing `toolbar.test.ts`, the `keys-tables` label and the parity test.
- **Browser, Chromium locally:**
  - a new `tree-undo.browser.ts`, listed in `harness/suites.ts` with `{}` (every engine in the train, not smoke). It runs the "Tree undo" and "Tree undo history" scenarios, on the widget host and in a WBS with PERT for the linked delete;
  - `tree-drag.browser.ts` gains the vertical-drag, nesting and hint scenarios. `harness/tree-drag.ts`'s `dragOver` gains an option that keeps the pointer's x where `beginDrag` left it (`{ vertical: true }`). The default still goes to the row's centre, far right of the handle, so the existing `ZONE.into` drags keep nesting unchanged, as do `wbs-linking`, `tree-drag-answer` and `uj2-editing-plus`;
  - `tree-adjust.browser.ts`: "Undo adjust" becomes "Undo", and "another edit takes the button away" becomes "the next undo undoes that edit first".
- **The e2e train.** The change alters the Tree's rendering (a permanent tool, the drop zones) and the browser harness, so a train runs on the branch before merge (AGENTS.md, CI).

### D9. Documents

- **PRD:**
  - FR-11's WBS line: "with a preview and an undo" becomes "with a preview; the user's edits undone one at a time, latest first".
  - FR-11's extensions sentence: the Tree also offers the undo on its own.
  - FR-15: "can be undone once" becomes "can be undone, as every edit of the Tree can".
  - Behaviour grows within the PO's request (#262, #80); no requirement ID changes.
- **EXPERIENCE.md:**
  - Widgets "Tree": the undo, and "into" only with a move to the right;
  - Molecules "WBS with PERT": "Undo adjust restores them until the next edit" becomes the undo;
  - Interaction Primitives "Drag": the zones and the hint;
  - Accessibility Floor, Keyboard core "Tree": "Undo" and Ctrl or Cmd with Z for the latest edit;
  - Voice and Tone: the "Tree and Gantt chrome" row ("Undo adjust" becomes "Undo"), plus rows for "Last change undone." and the hint, "(to review)".
- **DESIGN.md:** Components "Tree": the toolbar ends with "Undo", a `button-secondary`, disabled when there is nothing to undo; the drop indicator's text is unchanged.
- **No spine change.** AD-10 and AD-20 hold as written: the history is view state and undo is a draft write.

## Changes in flight and merge points

`openspec list` shows `early-benchmark` (benchmark harness, no widget, string or UX-document overlap) and, being proposed now in `.claude/worktrees/feature-accept-as-sent` with no artifacts yet, `accept-as-sent` (#263). Merge points with `accept-as-sent`, re-checked at the rebase before the pull request:

- **Semantic seam.** Its "the editable widgets hold no change" test will read the draft record or the marks' count. This change keeps that predicate true after a full undo: the Tree's entry is removed, not set to the sent value. Neither change borrows a name from the other.
- **Textual.**
  - `packages/view/src/strings/en-US.ts`, `it-IT.ts` and `keys.ts`: both append keys;
  - EXPERIENCE.md Voice and Tone and the Tree rows;
  - `view-and-widgets` spec deltas: different requirements;
  - `harness/suites.ts`: a line each;
  - `packages/view/chunk-sizes.json`, if both grow the widgets chunk: re-record at the rebase;
  - `skills/`: regenerate after the rebase if both change teaching data.
- **Its card action area** is not touched here.

Borrowed names, all on `origin/main` 95e7e31f (task 0.1 re-checks):
- `onValuesChange`, `BoardContent.draft`, `keyLabel` and `useKeyPlatform` (`@askboard/view/catalog`);
- `linkedAdd` and `linkedDelete` (`tree/linked.ts`), `sameNodes` (`tree/model/marks.ts`), `dropOn`, `zoneOf` and `EDGE_SHARE` (`tree/model/drop.ts`), `tipOf` and `overTarget` (`tree/model/dragging.ts`), `DRAG_TIP` (`tree/classes.ts`);
- `TREE_KEYS` (`contract/src/widgets/tree/keys.ts`);
- `beginDrag`, `dragOver`, `dragDrop` and `ZONE` (`view/test/browser/harness/tree-drag.ts`).

No `packages/contract` schema set or `*_VERSION` / `*_FORMAT` constant is touched: only a key table's label and a help string. No Claude Code run-time behaviour is assumed: nothing here needs a probe.

## Risks / Trade-offs

- [Users who nested by dropping in the middle now get a sibling] → the hint says to move right, the indicator shows what the drop does, and undo reverts a wrong drop in one key.
- [The liveness check runs on every render] → it checks only the top entry, by reference first; today's `liveSlot` already compares a whole Tree each render.
- [An undo after a Gantt edit is refused, emptying the history] → stated in the spec ("A plan edited after a linked add"). Undoing across another widget's edits would need a board-wide history (#80).
- [The extra permanent tool crowds the toolbar sooner] → "Undo" never overflows. The moves overflow as today, and `tree-toolbar.browser.ts` covers the narrow board.

## Migration Plan

No data migration: the history is never persisted, and drafts and answers keep their shapes. Rollback is a revert of the change's commits.

## Open Questions

None for the PO. The decisions were taken in an unattended run; D4 (no redo) and D7 (offset over a narrower band) choose among the caller's defaults, with their reasons.
