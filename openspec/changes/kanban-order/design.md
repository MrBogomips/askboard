# Design

## Context

See proposal.md for why. Base: `origin/main` ac9f891f (2026-11-09).

- **The Kanban today** (`latex-kanban-timeline`, decisions 4 and 9). Props `{columns, cards}`, each card naming its `column`; a column shows its cards in the order of `cards` (`columnsOf`, `packages/widgets/src/kanban/model.ts:22`). `KANBAN_SHAPE` is the flat list `{elements: "cards"}` (`packages/contract/src/widgets/kanban/constants.ts:24`); a move rewrites a card's `column` and keeps every card at its index in `cards` (`moveTo`, `model.ts:32`), so the generic diff gives one `set` of `.column`, and `kanban-changes.json` admits nothing else. A drop names a column only: the column is the drop target (`useColumnDrop`, `drag.ts:64`) with the Tree's "into" outline (`indicatorOf`, `drop.ts:14`). The cards' Tab stop reads `event.key` alone (`kanbanKeyOf`, `keys.ts:15`), so a held modifier still moves the cursor; the toolbar is the shared `MoveToolbar` (`shared/move-toolbar.tsx:98`) with "Move to…". `valueFits` (`props.ts:87`) holds a value with the same columns and the same cards in the same order.
- **The generic diff** (`packages/contract/src/widgets/element-diff.ts`; AD-20). For a list it keeps, per sibling list, the longest run of elements in their sent order (`stayers`) and gives every other kept element a `move` naming its parent and its preceding sibling, then its `set`s; `applyElementChanges` is its inverse. `ask-core` computes an answer's changes once with it, applies them back and refuses a value they do not rebuild exactly, then checks them against the type's changes schema (`roundTripProblem`, `packages/core/src/lifecycle/widget-values.ts:212`). For a Kanban whose cards are interleaved across columns, the flat diff names as `after` a card of another column, and it can give a `move` to a card of a column the user never touched (a run of the global longest subsequence that skips it). Neither says "the order of this column" to an agent.
- **Revisions.** The view counts a Kanban's moves against the revision the question's work was made on; after a reload under kept work the Kanban is read-only and "Keep mine" drops its held value (`keep-mine-shown-revision`, `readOnlyItemsOf`, `packages/view/src/shell/agent-change.ts:113`); the shell holds a value across an agent's change only while the chunk's `valueFits` says so (`packages/view/src/shell/board-draft.ts:232`).
- **Pragmatic drag and drop 4.0.0** is the only drag library in the stack (`dnd` chunk). The Ranking and the Tree already place a drop from the pointer's `location.current.input.clientY` (`ranking/drag.ts`); the hitbox package is not installed and is not needed.

## Goals / Non-Goals

**Goals:**

- One meaning of a Kanban's order, shared by the board, `ask-core` and the agent: the order of `cards`, read per column, with changes that rebuild it when applied in order.
- An answer that carries exactly the order the user gave: no `move` for a column whose order the user kept, and none for a card that lands where the agent's order puts it.
- Every move reachable by drag, by toolbar and by keys bound as `keyboard-shortcuts-help` plans them.

**Non-Goals:**

- No change in `core` or `server` product code: the round trip and the changes check are generic.
- No selection, no moves of several cards, no Keys panel, no Alt+Shift+← and → (the Kanban's keyboard retrofit, `keyboard-shortcuts-help` question 3).
- No live region for moves: the card's position reaches assistive technology through `aria-posinset` and `aria-setsize` (decision 7).

## Decisions

### 1. A grouped flat list in the one generic diff (AD-20 amended in place)

`ListShape` gains an optional `group`, the name of a field each element holds: `{elements: "cards", group: "column"}`. A grouped list is flat (a `children` beside `group` throws). Order counts within a group only:

- **Stayers** are computed per group of the edited value: its elements in edited order, valued by their index in the sent list, keep one longest increasing run (the existing `longestIncreasing`). An element that changed group takes part, so a card that lands where the sent order puts it in its new group stays.
- **Operations**, group by group in the order of the group values (UTF-16 code-unit order, as `Array.prototype.sort` gives), each group's elements in edited order: an `add` holds its fields, its group included; a kept element gives its `set`s first, its group's `set` among them, then its `move` when it is not a stayer. `add` and `move` name as `after` the preceding element of the same group in the edited value, omitted for the group's first, and never a `parent`. `remove`s come last, as in a flat list.
- **The inverse** is the flat list's: a `move` or `add` goes right after `after`, or first in the list when `after` is absent. It throws when `after` is not in the moved element's group at that point (after the element's own `set`s), or when the group field of the element a `move` or an `add` places is not a string (the diff refuses a non-string group in the edited value as well; `ask-core` refuses it earlier, so the inverse's check is the narrower one); `ask-core` turns the throw into a refusal naming the item.

Why this holds: the stayers keep their sent relative order, each non-stayer is placed after its edited predecessor in its group, and an element's group is final before its `move`; a mover with no `after` goes to the top of the whole list, so a later arrival can never land before it. Applied in order to the flat list, the changes give every group's edited order; the flat interleaving between groups is the inverse's own, which decision 4 relies on. A group whose order and members the user kept gives no `move`; a group a card only left gives none either.

Why group by group (revised at task 1.1): the changes then depend only on each group's members and edited order, never on how the edited list interleaves the groups, so the diff of the value they rebuild gives the same changes (a fixed point), which decision 4's `arranged` and `ask-core`'s exact round trip need. Walking the flat edited list instead is no fixed point: sent `a1 a2 b1 b2` with both groups reversed gives `move a2`, `move b2`, which rebuild `b2 a2 a1 b1`, whose own diff is `move b2`, `move a2`, which rebuild the first list again. The order of operations across groups is therefore the group values' (`doing` before `todo`), not the flat list's; within a group, and for each element, nothing changes. `grouped-list-diff.test.ts` pins both: the two-group reversal is a fixed point, and two interleavings of the same groups give the same changes.

*Alternatives:* the flat list's diff unchanged, with `after` the flat predecessor (an agent must apply moves to the whole list to read a column, an `after` can name a card of another column, and untouched columns get moves); a tree projection with columns as parents and `move` naming `parent` (it drops the `set` of `.column` that today's answers carry, a change of meaning past a minor); the order as a Kanban result `{column: [card IDs]}` (it splits one edit between `changes` and `results`, and AD-20 calls an order of the agent's own elements an edit).

### 2. `ask-core` stays generic

`roundTripProblem` already compares the rebuilt value with the edited one exactly (`canonicalize`) and checks the changes against the type's schema. With decision 1 nothing in `core` changes: a reorder is logged with its `move`s, and a value whose flat order its changes do not rebuild (one the board never sends, decision 4) is refused as "changes more than elements", with the log unchanged (NFR-10). The existing core and board-host tests that expect a reversed Kanban to be refused keep their verdict (each column of the fixture holds one card, so the reversal changes no column's order and is not rebuilt); their names and messages change.

### 3. The Kanban's changes

`KANBAN_SHAPE` becomes `{elements: "cards", group: "column"}`. `kanban-changes.json` narrows the output format's `change` the way the Table's does (`allOf` of the generic definition, an `op` enum and one `if`/`then` per op): `set` of `^<id>\.<id>\.column$` to an ID, as today, and `move` of `^<id>\.<id>$` with an optional `after` (an ID), `parent: false`. `add`, `remove`, `parent` and any other field stay refused. `KanbanChange` becomes the union of the two. The rule that an `after` is a card of the same column is the inverse's (decision 1), which the round trip runs on every answer; a schema cannot state it.

What an answer holds, by case: a card moved to another column where the sent order places it, one `set` (one card's answer, byte for byte today's); a card moved elsewhere in another column, its `set` then its `move`; a card reordered in its column, one `move`; a column the user kept, nothing; a swap of two neighbours, one `move` (of the one the longest run leaves out). Several cards' `set`s come column by column, in code-unit order of the column IDs (decision 1), so they hold the operations the flat diff gave, in another order: `set`s of different cards commute, and an agent that applies the changes in order reads the same `cards`.

### 4. The board's value is the one its changes rebuild

The Kanban's model builds every edit as a raw value, then holds `arranged(sent, raw) = applyElementChanges(id, sent, elementChanges(id, sent, raw, KANBAN_SHAPE), KANBAN_SHAPE)`, with `sent` the props the user's work counts against. The raw edits, all pure in `model.ts`:

- `placeIn(props, cardId, columnId, slot)`: the card in `columnId`, at `slot` among that column's other cards (0 to their count), placed right after the card before the slot or right before the first one; the one function of a drop, "Move up", "Move down", "To top" and "To bottom".
- `moveTo` ("Move to…") keeps today's rule: the column changes and the card keeps its place in `cards` (decision 6).

Since the held value is in normal form, `ask-core` rebuilds it exactly, and `arranged` is idempotent: the diff of the rebuilt value gives the same changes (decision 1, group by group). `valueFor(sent, value)` is `undefined` when its changes are empty, so moving everything back leaves no value. `movedOf(sent, shown)` is the cards the changes name. `valueFits(value, props)` holds when the value is a Kanban with the props' columns (IDs, labels, order) and the props' cards by ID (labels and descriptions equal, any order), and when it is in normal form against `props`: so "Keep mine", a restored draft and a value carried from an earlier answer (`reopen-start-from-answer`'s `fillFrom`) hold only a value `ask-core` will take, and drop anything else whole, as they do today.

*Alternative:* `ask-core` compares per group instead of exactly (a generic `core` change for one shape, and a kept value whose flat order the changes do not describe).

### 5. Keys and tools

On the cards' Tab stop, a press reader `kanbanPressOf({key, altKey, shiftKey, ctrlKey, metaKey, composing})` replaces `kanbanKeyOf`:

| Hold | Keys | Action |
|---|---|---|
| none | ↑ ↓ ← → | the current card, as today |
| Alt+Shift | ↑, ↓ | move up, down in the column |
| Alt+Shift | Home, End | to the top, to the bottom of the column |
| Ctrl or Cmd (exactly one) + Shift | ↑, ↓ | to the top, to the bottom |

Any other hold, and any press while an input method composes, does nothing and keeps its default; a bound press has its default prevented also where it cannot act (on the first card, Alt+Shift+↑). These are `keyboard-shortcuts-help`'s vocabulary bindings `cursor.*`, `move.up`, `move.down`, `move.top` and `move.bottom`, so its Kanban key table can take them unchanged (Merge points). The moved card stays current and keeps the focus; the widget refocuses it after the render if the browser dropped it.

The toolbar, through `MoveToolbar` (no change to it): "Move up", "Move down", "To top", "To bottom", "Move to…", then the counter. A tool is enabled while a current card of an editable Kanban can make its move (not the first card for "Move up" and "To top", not the last for "Move down" and "To bottom"); a disabled tool keeps the focus, as `MoveToolbar` already does. New strings `kanban.moveUp`, `kanban.moveDown`, `kanban.toTop`, `kanban.toBottom` (en-US "Move up", "Move down", "To top", "To bottom"; it-IT "Sposta su", "Sposta giù", "In cima", "In fondo", to review), under the `kanban.` prefix so no other change's key collides.

*Alternatives:* the keys left to the retrofit (#81's question 3 alternative; the tools and the drag would ship alone); Alt+Shift+← and → here (proposal, question 4).

### 6. The drop place and "Move to…"

The column stays the only drop target. Its `onDrag` and `onDrop` read the pointer's `location.current.input.clientY` (the API the Ranking uses) and the boxes of the column's other cards (`getBoundingClientRect`, a DOM call); the pure `slotAt(middles, clientY)` counts the cards whose vertical middle is above the pointer. The drag state becomes `{dragging, over?: {column, slot}}`. The indicator: the "into" outline on a column while a card of another column is over it, as today, and the Ranking's line (`primary`) before the card at the slot, or after the last card; no line where the drop would change nothing. Escape gives `end` with no `drop`, as today; a drop from another widget is not taken.

"Move to…" keeps today's place, where the sent order puts the card in its new column (proposal, question 1), so its answer is one `set` as today; "Move up", "Move down", "To top" and "To bottom" then place it.

*Alternatives:* each card a nested drop target (it relies on the order of `location.current.dropTargets`, which the project has not used); the `@atlaskit/pragmatic-drag-and-drop-hitbox` package (a new dependency for a computation of four lines).

### 7. What the board shows

- Each card gives `aria-posinset` (its place in its column, from 1) and `aria-setsize` (its column's count), inside the column's `fieldset`, whose role is `group`, as the Tree's rows do. Its accessible name stays "Fix login, in To do", so locators and strings stay.
- The change highlight and the counter ("Your changes: N moved") follow `movedOf`: the cards the answer reports (proposal, question 5).
- Read-only (answered, locked, a Snapshot, a reload under kept work) the Kanban shows the shown value's order, its moved cards highlighted, with no tool, key move or drag, as today.
- The Approval summary needs no code: a `move` is one "moved" line naming the card (`summarise`, `packages/widgets/src/approval/summary.ts:134`); a test pins it.

### 8. Versions (askboard-contract-versioning)

The output format takes the next minor after `main`'s: it admits the Kanban's `move`. Every other set keeps `main`'s: the props are unchanged (input format, board document, the tool envelopes' composed `fetch`, which carries props), the draft record holds props (board protocol), and events carry the output format's generic `change` (Snapshot data, the envelopes, whose results name the output format's version). Comments, descriptions and test titles name this change, never a number; the constant and this change's version test hold the number, set to `main`'s minor plus one in task 1.3 and bound at task 5.1. `document-review` (PR #115) also widens the output format: whichever merges second rebinds.

Binding line, written at task 5.1: "Bound on <date>, rebased onto origin/main <sha>: output format <n> (main <m>)."

### 9. The skill

`KANBAN_WIDGET.skill`: `use` "cards the user moves between 2 to 12 columns and orders within them, such as statuses, priorities or owners"; notes (each at most 300 characters, `SKILL_NOTE_MAX`): the order of `cards` is each column's order, top to bottom; the changes are `set`s of `<id>.<card>.column` and `move`s of `<id>.<card>`, applied in order to the `cards` list, a `move` going right after `after` (a card of the same column) or first in the list without it; a column the user did not reorder gets no `move`. `bun run build:skills` regenerates `skills/askboard/`; `check:skills` keeps its budgets.

## Merge points

Borrowed from `origin/main` ac9f891f (task 0.2 records each with its file and line; task 5.1 re-checks them):

- `contract`: `elementChanges`, `applyElementChanges`, `ElementShape` and `ListShape` (`widgets/element-diff.ts:277`, `:507`, `:37`, `:18`); `KANBAN_SHAPE`, `KanbanChange` (`widgets/kanban/constants.ts:24`, `:48`); `KANBAN_WIDGET` (`widgets/kanban/widget.ts:13`); `widgetChangesProblems` (`widgets/results.ts:69`); `elementShapeOf` (`widgets/items.ts:58`); `OUTPUT_FORMAT_VERSION` (`schemas/output/index.ts:39`); `KANBAN_FIXTURE_ITEM`, `KANBAN_EDITED_PROPS`, `KANBAN_CHANGES` (`fixtures/latex-kanban-timeline.ts:83`, `:101`, `:109`); `withWidgetTypes` (`fixtures/approval-scale-ranking.ts:18`); `SKILL_NOTE_MAX` (`widgets/registry.ts:266`).
- `core`: `roundTripProblem` (`lifecycle/widget-values.ts:212`), read only.
- `widgets`: `columnsOf`, `moveTo`, `movedOf`, `valueFor`, `neighbour` (`kanban/model.ts:22`, `:32`, `:44`, `:53`, `:80`); `kanbanKeyOf`, `kanbanTools`, `otherColumns` (`kanban/keys.ts:15`, `:25`, `:34`); `indicatorOf`, `afterDrop` (`kanban/drop.ts:14`, `:24`); `useCardDrag`, `useColumnDrop` (`kanban/drag.ts:38`, `:64`); `valueFits`, `shownProps` (`kanban/props.ts:87`, `:99`); `KanbanWidget` (`kanban/widget.tsx:23`); `MoveToolbar`, `MoveTool` (`shared/move-toolbar.tsx:98`, `:25`); `summarise` (`approval/summary.ts:134`).
- `view`: `ComponentFacts` (`catalog/port.ts:151`), `register` (`:204`), `valueFits` (`shell/board-draft.ts:232`), `readOnlyItemsOf` (`shell/agent-change.ts:113`), `STRING_KEYS` (`strings/keys.ts:4`); the browser harness `cardOf`, `columnOf`, `cardsIn` (`test/browser/harness/kanban-drag.ts:11`, `:15`, `:19`).

Changes in flight, read on 2026-11-09:

| Change (branch, head) | State | Overlap | What happens |
|---|---|---|---|
| `document-review` (PR #115, `worktree-feature-document-review` 04fb0cb6) | Open, bound on be308421: input 1.13, output 1.12, tool envelopes 1.13, board document 1.12 | The output format; `ComponentFacts.revisionBound` and `shownDocumentOf` (the Kanban then receives the shown revision's props as `item.props`, which decision 4 normalizes against, unchanged); strings tables, `chunk-sizes.json`, CHANGELOG, EXPERIENCE and DESIGN (other rows), the spine's front matter, `skills/askboard/` | Whichever merges second takes the output format one past the other's. Append both sides in tables and CHANGELOG; regenerate `skills/askboard/`, never resolve it by hand. |
| `agent-facing-gaps` (PR #112, `worktree-fix-agent-facing-gaps` aabe9979) | Open; tool envelopes one past `main`'s | `skills/askboard/SKILL.md`, the spine's front matter and AD-6, CHANGELOG | No set in common. Regenerate the skill at the rebase; keep both `sources:` lines. |
| `reopen-start-from-answer` (`worktree-fix-reopen-start-from-answer` 4f6d9696) | Bound on ac9f891f: board protocol 1.9, Snapshot data 1.3 | `fillFrom` carries a value only when `valueFits` holds, which decision 4 makes stricter for the Kanban; AD-20 (its Drafts bullets, this change's Answers bullet), PRD (FR-6, here FR-11), EXPERIENCE, DESIGN, strings, `chunk-sizes.json`, CHANGELOG | No set in common. Different lines of AD-20; keep both front-matter lines. If it merges first, task 4.1 adds its carried-answer case to the Kanban's session test. |
| `result-bound` (`worktree-fix-result-bound` b33a85aa) | Proposed; no set | CHANGELOG, the spine's AD-6 | Append. |
| `keyboard-shortcuts-help` (`worktree-feature-keyboard-help` 101a9498; Issue #81, `needs-po`) | Proposed on 47f3c370 | Its question 3 names this change `kanban-card-order` and leaves it the Kanban's in-column keys and "To top"/"To bottom"; its decision 7 (keys act only with no modifier) and decision 9 (a Kanban key table with a parity test against `kanbanKeyOf`) touch `kanban/keys.ts` and `widget.tsx` | Decision 5 binds exactly its default. If it merges first, task 3.2 routes the presses through its `keyActionOf` and appends the four `move.*` entries (`shows: tool`) to its Kanban table, through `/opsx:update` here. If this change merges first, its `/opsx:update` writes the Kanban table with these keys (they are what the Kanban takes then) and renames `kanban-card-order` to `kanban-order`. If the PO takes question 3's alternative, this change drops its keys (proposal, question 4). |
| Records (PR #109, `worktree-fix-claude-md-conflicts` 981ecf78) | Open | A change's record is `docs/as-built/<change-id>.md`, never CLAUDE.md | Task 4.4 writes `docs/as-built/kanban-order.md` by that README's rules (no status, versions as bound), whether or not #109 has merged; this change edits no CLAUDE.md. |

Seams this change creates, for later changes: the grouped list (`ListShape.group`) and its semantics; `arranged` (the Kanban's normal form, in `kanban/model.ts`); `placeIn` and `slotAt`; `kanbanPressOf`.

## Needs probe

No assumption about Claude Code's run time: the change touches no mod, hook, agent ID or permission path. Browser and system key handling (whether macOS or a Linux desktop takes Ctrl+Shift+↑ or Cmd+Shift+↑ before the page, and that no bound key scrolls or navigates) is checked by the browser files in Chromium and WebKit (task 3.4) and by the PO's by-hand check (task 5.5).

## Risks / Trade-offs

- [A swap of two neighbours marks the card the longest run leaves out, which may be the one the user did not drag] → accepted (proposal, question 5): the board marks what the agent receives; the alternative makes the counter disagree with the answer.
- [The Kanban chunk now runs the diff and its inverse on each edit] → at most 200 cards, one longest run per column; `elementChanges` already ships in the shell. The chunk may grow past the size check: task 3.4 records it with `--record-sizes` and says why. As built in task 1.1, the grouped branch of `elementChanges` ships in the `shell` and `approval` chunks, re-recorded in 0fdfeea9: `shell` 187,964 to 189,019 bytes, `approval` 20,124 to 21,194, `kanban` 21,212 to 21,227, each under the 10% check.
- [The drag adapter's import path] → the Kanban keeps `@atlaskit/pragmatic-drag-and-drop/element/adapter`, which the package marks `@deprecated` in favour of `adapter/element-adapter`, for consistency with the Ranking, the Tree and today's Kanban; the package's deprecation note (`dist/types/entry-point/element/adapter.d.ts:2`) points to the same `draggable` and `dropTargetForElements` at the new path, documented (task 0.2), so only documented APIs are used. Moving every widget to the new path is a separate chore.
- [A held value made on another revision fails the stricter `valueFits` and is dropped] → the same rule as today for a value that does not fit; it only adds values `ask-core` would refuse, so nothing reaches the agent that the board did not show (AD-10).
- [An agent that ignores `move`s reads the old order] → the skill teaches applying the changes in order, and `fetch` returns the whole value; agents that read only `set`s keep today's meaning for them.
- [`keyboard-shortcuts-help` and this change both rewrite the Kanban's key handler] → one press reader with the vocabulary's bindings; Merge points say who adapts.

## Migration Plan

None: answers already logged keep their `set`s; a board opened after the update shows cards as before until the user reorders them. Rollback is the revert of the merge; the output format's new minor then stays unused.

## Open Questions

The PO's questions are in proposal.md (five, with defaults, task 0.1). No conflict between source documents: PRD FR-11's Kanban row and AD-20 are amended in place by task 4.3.
