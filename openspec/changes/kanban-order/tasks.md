# Tasks

Each task writes its tests first and sees them fail for the right reason before it implements (the repository's TDD rule), and ends with a note of about five lines: what was built, the test counts, the deviations, `Refs #79`. Terms:

- "The check" is `GITHUB_TOKEN=$(gh auth token) bun run check`.
- "Coverage" is at least 80% of lines and functions for every source file the task changes, from `bun test --coverage`'s per-file table.
- "Browser files" are the named files run with `bun packages/view/test/browser/run.ts --engines chromium,webkit --target session-process -- <files>` after `bun run build`, under the browser lock.

Order: group 0, then group 1. Groups 2 and 3 may run in parallel after group 1: group 2 touches only `packages/core/test` and `packages/server/test/board-host`, group 3 only `packages/widgets/src/kanban`, `packages/widgets/src/approval` tests, `packages/view/src/strings` and `packages/view/test/browser`. Group 4 waits for both; group 5 is last. Inside a group, tasks run in order and the checkpoint closes it over the whole group's range. Contract and core groups run at high effort (`openspec/config.yaml`, operations).

## 0. Decisions and base

- [ ] 0.1 PO decisions (proposal, open questions 1 to 5; Issue #79). Tests: none. Read Issue #79's comments and record each answer here. Unless the PO answered otherwise, each is the proposed default, accepted under the PO's unattended handoff (2026-11-09), and `needs-po` stays on #79:
  1. "Move to…" puts the card where the agent's order puts it in the new column (one `set`, as today).
  2. A column change carries a `move` only when the card stands elsewhere than the sent order puts it.
  3. Toolbar: "Move up", "Move down", "To top", "To bottom", "Move to…", then the counter.
  4. Keys: #81's question 3 default (Alt+Shift+↑/↓, Alt+Shift+Home/End, Cmd/Ctrl+Shift+↑/↓ here; Alt+Shift+←/→ in the keyboard retrofit). Also record #81's answer to its question 3, if any.
  5. The board marks as moved the cards the answer reports.
  - Verify: five answers recorded with their source (the PO's comment or the handoff). An answer other than a default, or a #81 question 3 answer other than its default, stops the work for `/opsx:update` before group 1.
- [ ] 0.2 Names, versions, heads and baseline (askboard-contract-versioning, Rule 3; design.md, Merge points). Tests: none.
  - Check with `git grep -n` on `origin/main` every name design.md's Merge points borrow, and record each with its file and line.
  - Record every `*_VERSION` and `*_FORMAT` constant of `packages/contract/src`. The output format starts at main's minor plus one in task 1.3; every other set stays.
  - Record the head of each branch in Merge points and whether `document-review`, `agent-facing-gaps`, `reopen-start-from-answer`, `result-bound`, `keyboard-shortcuts-help` and the records change (#109) have merged.
  - Record the drag APIs the Kanban will use (`draggable`, `dropTargetForElements`, `location.current.input.clientY`, as `ranking/drag.ts` uses them) with the page of Pragmatic drag and drop's documentation that documents each, and that no package is added (no new dependency, design decision 6).
  - Record the pass counts of `bun test` in `packages/contract`, `packages/core`, `packages/widgets` and `packages/view`.
  - Verify: the note lists every name, version, head and count. If a name, signature or shape differs, or a name is not on `main`, or an API is not documented, stop and run `/opsx:update` before group 1.

## 1. Contract: the grouped list and the Kanban's changes

- [ ] 1.1 The grouped flat list in the generic diff (contract spec, "Grouped lists in the generic diff" and "The inverse of a grouped list"; design decision 1; AD-20).
  - Tests first, in a new `packages/contract/test/grouped-list-diff.test.ts`, over a probe shape `{elements: "cards", group: "column"}`:
    - a group reordered gives one `move` naming the in-group predecessor as `after`, or none for the first;
    - a group whose elements keep order and group gives no change, its elements interleaved with a reordered group's;
    - an element moved to another group where its sent index puts it gives one `set`; placed elsewhere, its `set`s then its `move`;
    - an `add` names its in-group predecessor; a `remove` as in a flat list;
    - the inverse throws, naming the operation, on an `after` in another group, an `after` equal to the element, an unknown `after` and a non-string group field; a shape with `group` and `children` throws in the diff and the inverse;
    - a seeded random test: 200 elements in 12 groups, 500 edits of moves within and between groups, each giving changes whose inverse rebuilds every group's order and whose diff against the rebuilt value gives the same changes;
    - a group value `__proto__` or `constructor` is a group like any other.
  - Then `ListShape.group` in `packages/contract/src/widgets/element-diff.ts`: per-group stayers over sent indices, the in-group `after`, `set`s before `move`, the inverse's group check. The flat, tree, keyed and fields shapes are unchanged.
  - Verify: the new tests fail first and pass after; every existing test of `element-diff.ts`, `fields-shape.test.ts` and the Tree's and the Table's diffs passes unchanged; coverage; the check passes.
- [ ] 1.2 The Kanban's shape and changes schema (contract spec, "Kanban changes" and "Changes checked against their type"; design decision 3).
  - Tests first, in `packages/contract/test/kanban-widget.test.ts` and `widget-changes-problems.test.ts`:
    - the moved card of `KANBAN_EDITED_PROPS` still gives exactly `KANBAN_CHANGES`;
    - a card placed first in its column gives one `move` with no `after`; `audit` placed after `write-docs` in `doing` gives its `set` then its `move`;
    - the changes check passes a `move` of a card after a card, and fails, naming the item and the operation, a `move` with `parent`, an `add`, a `remove`, a `set` of `label` and a `move` whose target names a field;
    - the test at `kanban-widget.test.ts:221` ("a reorder is a move, which the check refuses") becomes: the reversal of the one-card-per-column fixture gives no change, and an in-column reorder gives a `move` the check passes.
  - Then `KANBAN_SHAPE` `{elements: "cards", group: "column"}`, `KanbanChange` as the union of the `set` and the `move`, `kanban-changes.json` narrowed as the Table's (`allOf`, `op` enum, one `if`/`then` per op, `parent: false`), its `description` naming this change; a fixtures module `packages/contract/src/fixtures/kanban-order.ts` (a Kanban of three columns with interleaved cards, the edited props of a reorder, of a card placed in another column and of both, with their changes), exported in one appended block at the end of `src/fixtures/index.ts`.
  - Verify: tests fail first, pass after; `KANBAN_FIXTURE_ITEM`'s existing tests pass; coverage; the check passes.
- [ ] 1.3 The output format's next minor (contract spec, "Kanban order in the output format's next minor"; design decision 8).
  - Tests first, a new `packages/contract/test/kanban-order-sets.test.ts`: the output format one minor past `main`'s value recorded in task 0.2, every other set at `main`'s, the previous minor accepted and major 2 refused, `setOf("output").version` equal to the constant.
  - Then `OUTPUT_FORMAT_VERSION` at main's minor plus one and one sentence appended to `schemas/output/index.ts`'s header comment naming this change. Move every earlier exact pin of the output format (the skill's grep; `table-sets.test.ts:60` is one) to the constant or an at-least check.
  - Verify: the test fails first; `schemaSetProblems` passes; no added line names the number outside the constant and this test (`git diff -U0 origin/main -- packages | grep -E '^\+.*"1\.[0-9]+"'`); the check passes.
- [ ] 1.4 The Kanban's teaching text (contract spec, "The Kanban's teaching text of its order"; design decision 9).
  - Tests first, in `packages/contract/test/kanban-registered.test.ts`: the entry's `use` and notes name the order of `cards`, `move` and `after` and how to apply them, each within `SKILL_NOTE_MAX`; `widgetRegistryProblems` passes.
  - Then `KANBAN_WIDGET.skill`, `bun run build:skills`, and commit `skills/askboard/` as generated.
  - Verify: tests fail first, pass after; `bun run check:skills` passes, its figures recorded in the note; `skills/askboard/references/widgets/kanban.md` names `move`; the check passes.
- [ ] 1.5 Review checkpoint, group 1: spec review of the group's range by `askboard-spec-reviewer`, and security review by `askboard-security-reviewer` (the contract's schemas and the inverse that `ask-core` runs on every answer: fail-closed round trip, prototype keys in group values, the cost of the diff at 200 cards). Verify: findings recorded here; each H or M finding becomes a task in this group, fixed tests first and re-reviewed; deferred findings become Issues (`source:review`).

## 2. Core and board host: answers that order a Kanban

- [ ] 2.1 `ask-core` (core spec, "Answers that order a Kanban" and "An answer's changes follow their type"; design decision 2).
  - Tests first, in a new `packages/core/test/kanban-order.test.ts`, with the fixtures of task 1.2:
    - an in-column reorder is logged with one `move`; a card placed in another column with its `set` then its `move`; no change names a card of an untouched column; `fetch` of the item returns the edited cards in order;
    - a reorder whose list its changes do not rebuild, and the reversal of the one-card-per-column fixture, are refused naming the item, with the log unchanged and nothing kept or published;
    - after "Keep mine", an answer naming revision 1 orders cards and its changes are computed against revision 1;
    - an edited card label is still refused naming the `set` of `label`.
  - Then update `changes-follow-type.test.ts:153` (its reversal is refused by the round trip, no longer by a `move`) and any core test that expects a Kanban `move` to be refused. No product code is expected: a failure that needs one stops the work for `/opsx:update`.
  - Verify: the new tests pass (those that needed group 1 failed before it, recorded); the Tree, Gantt, WBS and Gantt plan suites pass with their counts; the check passes.
- [ ] 2.2 The board protocol (core spec, "An answer's changes follow their type").
  - Tests first, in `packages/server/test/board-host/edit-widgets-protocol.test.ts`: the "reordered Kanban" case renamed for what it is (the list order changes and no column's), still refused with the question open and the log empty; a new case acts an in-column reorder and receives the answered state, the log holding one answer event whose `changes` hold the `move`.
  - Verify: both cases pass; every message validates with `validateBoardMessage`; the check passes.
- [ ] 2.3 Review checkpoint, group 2: spec review of the group's range. Verify: findings recorded; H and M fixed tests first and re-reviewed, or deferred as Issues.

## 3. Widgets and view: the board's order

- [ ] 3.1 The Kanban's model (view-and-widgets spec, "Kanban order in the draft", "A Kanban value fits a revision", "The Approval summary of a Kanban's order"; design decisions 4 and 7).
  - Tests first, in `packages/widgets/src/kanban/model.test.ts`, `props.test.ts` and `packages/widgets/src/approval/summary.test.ts`:
    - `arranged(sent, raw)` gives the value whose changes rebuild it, and is idempotent;
    - `placeIn` at every slot within a column and into another column; "Move up", "Move down", "To top" and "To bottom" through it; `moveTo` still gives one `set`;
    - `valueFor` is `undefined` after moving everything back; `movedOf` lists the cards the changes name, one card after a swap;
    - `valueFits` holds for the agent's cards in another order in normal form, and fails for a changed label, a missing card, other columns and a list not in normal form; `shownProps` falls back to the agent's props then;
    - the summary gives one "moved" line naming a reordered card, and one line for a card moved to another column at its sent place.
  - Then `model.ts` and `props.ts` (decision 4). The summary needs no code.
  - Verify: tests fail first, pass after; coverage; the check passes.
- [ ] 3.2 Keys, tools, position and strings (view-and-widgets spec, "Kanban at the keyboard", "Kanban columns and cards", "Kanban order strings"; design decisions 5 and 7). If `keyboard-shortcuts-help` has merged, stop for `/opsx:update`: the presses then go through its `keyActionOf` and its Kanban table (design.md, Merge points).
  - Tests first, in `packages/widgets/src/kanban/keys.test.ts` and `packages/view/src/strings/kanban-strings.test.ts`:
    - `kanbanPressOf` over every key of the table under every hold (none, Shift, Alt, Alt+Shift, Ctrl, Cmd, Ctrl+Shift, Cmd+Shift, Ctrl+Cmd+Shift) and while composing: only the table's presses act, Ctrl and Cmd together never;
    - the tools' enabled states at the column's edges, with no current card and on a disabled Kanban;
    - the four strings in en-US and it-IT and in `STRING_KEYS`.
  - Then `keys.ts`, `widget.tsx` (default prevented only for a bound press; the moved card current and refocused after the render), the four tools before "Move to…" through `MoveToolbar`, `aria-posinset` and `aria-setsize` in `card.tsx`, and the strings (`kanban.moveUp`, `kanban.moveDown`, `kanban.toTop`, `kanban.toBottom`; Italian marked to review).
  - Verify: tests fail first, pass after; coverage; the check passes.
- [ ] 3.3 The drop place (view-and-widgets spec, "Kanban moves by drag"; design decision 6).
  - Tests first, in `packages/widgets/src/kanban/drop.test.ts`: `slotAt(middles, clientY)` above every middle, between two, below all and on a middle; the drag state `{dragging, over?: {column, slot}}`; the indicator (the outline for a card of another column, the line before the slot's card or after the last, none where the drop changes nothing); `afterDrop` through `placeIn` and `arranged`.
  - Then `drop.ts`, `drag.ts` (the column's `onDrag` and `onDrop` read `location.current.input.clientY` and the boxes of its other cards), `column.tsx` (the line) and `classes.ts` (the line from the tokens, as the Ranking's; no `style` attribute).
  - Verify: tests fail first, pass after; coverage; the check passes.
- [ ] 3.4 Browser files of the Kanban (view-and-widgets spec, "Kanban moves by drag", "Kanban at the keyboard", "Kanban columns and cards").
  - Tests first, in `packages/view/test/browser/kanban.browser.ts`, with a drop-at-place helper in `harness/kanban-drag.ts`: a drag within the column (the line above the target during the drag, the order, the highlight), a drag to another column below its last card, each card dragged back (no value, no highlight), Escape; Alt+Shift+Up and Down, Alt+Shift+Home and End, Cmd+Shift or Ctrl+Shift with Up and Down by platform, each keeping the focus on the moved card; Shift+Up and Alt+Up acting on nothing; at the edge nothing scrolls and the URL is unchanged; each tool from the keyboard; `aria-posinset` and `aria-setsize`; the new tools in `hover-audit.browser.ts`.
  - Then `bun run build:view`; if the `kanban` chunk grows past the check, `bun run build:view --record-sizes`, commit `chunk-sizes.json`, and say why in the note.
  - Verify: the browser files pass in Chromium and WebKit (counts recorded); the check passes.
- [ ] 3.5 Review checkpoint, group 3: spec review of the group's range (no security review: the view's sandbox, page policy and agent text paths are unchanged; the drag reads DOM boxes only). Verify: findings recorded; H and M fixed tests first and re-reviewed, or deferred as Issues.

## 4. End to end and records

- [ ] 4.1 Session and Snapshot (view-and-widgets spec, "Kanban order end to end", "Kanban order in the draft", "Kanban order read-only and in a Snapshot", "Kanban order strings").
  - Tests first, in `edit-widgets-session.browser.ts`: an answer with one column reordered and one card placed in another column reaches `collect` with the `move` and the `set` then `move`, nothing for the untouched column, and `fetch` returns the cards in order; a reorder held across a reload with the leave-page prompt armed; a reorder, an agent's change and a reload: read-only with the line, "Keep mine" drops it, the answer sends nothing for it. In `edit-widgets-snapshot.browser.ts`: a Snapshot of a reordered Kanban, read-only, in order, highlighted. In `edit-widgets-it.browser.ts`: the Italian tools. If `reopen-start-from-answer` has merged: a reopened question carries a Kanban order that still fits.
  - Verify: the browser files pass in Chromium and WebKit (counts recorded).
- [ ] 4.2 Conformance (view-and-widgets spec, "Kanban order end to end"). Tests first, in `packages/server/test/conformance/edit-widgets.e2e.ts`: the Kanban act orders a column, and the collected and pushed answer events hold its `move`. Verify: `bun packages/server/test/conformance/run.ts` passes in AD-1's three configurations, on Bun and with `--runtime node`.
- [ ] 4.3 Design documents (design decisions 1, 5, 6, 7; proposal, Documents). Tests: none.
  - PRD: FR-11's Kanban row reads "Moves cards between columns and orders them within a column (status, priority, owner)"; `updated:`.
  - Spine: AD-20's Answers bullet amended in place for the grouped flat list (`after` the preceding element of the same group, `set`s before the `move`, no `move` for a group the user kept); one `sources:` line naming this change and its open questions 1 and 2, accepted under the PO's unattended handoff; `updated:`. No AD renumbered.
  - EXPERIENCE: Component Patterns, Kanban (order within a column, the drop place, "Move to…" in the agent's order, the four tools, the keyboard moves); Interaction Primitives, Drag (a card drops before the card whose middle is below the pointer, else last); Accessibility Floor (Kanban: "Move up", "Move down", "To top", "To bottom" and "Move to…"); Localization, both "Ranking and Kanban" rows ("To top", "To bottom", "In cima", "In fondo", to review).
  - DESIGN: Kanban (the line where the card would land beside the column's outline; the toolbar's five tools as `button-secondary`s, the counter at its right).
  - Verify: `grep -n "orders them within a column" docs/prd-askboard-2026-10-25/prd.md`, `grep -n "kanban-order" docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`, and the four EXPERIENCE and one DESIGN rows read as built; no other AD changed (`git diff origin/main -- docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`).
- [ ] 4.4 Records. Tests: none. CHANGELOG: one line under `## Unreleased`, `### Added`, naming Issue #79. The change's as-built note `docs/as-built/kanban-order.md` (where the code lives; the seams created: `ListShape.group` and its semantics, `arranged`, `placeIn`, `slotAt`, `kanbanPressOf`; the versions as bound, filled at task 5.1), following `docs/as-built/README.md` once #109 has merged (no status). Never CLAUDE.md. Verify: `git diff --name-only origin/main...HEAD | grep -c '^CLAUDE.md$'` prints 0; the note exists and names every seam.
- [ ] 4.5 Review checkpoint, group 4: spec review of the group's range, the documents included. Verify: findings recorded; H and M fixed and re-reviewed, or deferred as Issues.

## 5. Merge `main`, bind, pull request

- [ ] 5.1 Rebase onto `origin/main` and bind the version labels (askboard-contract-versioning): the output format at main's minor plus one (one past `document-review`'s if it merged first), the earlier exact pins moved, the binding line in design.md decision 8, in `docs/as-built/kanban-order.md` and in the PR body, every borrowed name re-checked. Resolve tables and CHANGELOG by appending both sides; regenerate `skills/askboard/` with `bun run build:skills`, never resolve it by hand; re-record `chunk-sizes.json` if the merge moved it. If `keyboard-shortcuts-help` merged meanwhile, stop for `/opsx:update`. Verify: `git grep` finds each borrowed name on the rebased head; the diff carries no stale number; `bun install --frozen-lockfile`, the check, `bun run build` and `openspec validate --all --strict --no-interactive` pass; record main's SHA, the bound version and the counts in the note.
- [ ] 5.2 The full runs after the rebase. Verify: `bun run test:e2e` passes (browser files in Chromium and WebKit, Firefox where installed, its result recorded; conformance in three configurations on Bun), and the conformance suite on Node 24 (`--runtime node`); counts recorded.
- [ ] 5.3 Pre-PR review: spec and security reviews of `origin/main...HEAD` (askboard-review-protocol). Verify: findings recorded; H and M fixed tests first and re-reviewed; L fixed or deferred as Issues (`source:review`).
- [ ] 5.4 Pull request. Body: what changed and why, the checks and their results, the bound version, `Closes #79`, what is left for the PO (task 5.5, the open questions on #79). Comment on #79 with the PR. Verify: the PR exists; its body and commits carry no AI attribution.
- [ ] 5.5 Left to the PO (Issue #108): after `bun run build`, on a board from `claude --plugin-dir <checkout>`, in Chrome and in Safari, drag Kanban cards within a column and between columns (the line, the order, Escape), and use Alt+Shift+↑/↓, Alt+Shift+Home/End and Cmd+Shift+↑/↓ and the four tools. Add this item to #108 as a comment at task 5.4; the PO records each outcome there, a failure becoming its own defect Issue. Verify: the #108 comment exists; this task is ticked by the PO's recorded outcome, and does not block the pull request.

## Workflow follow-up

- After the PO merges the pull request: archive the change (`/opsx:archive`) in a pull request that says `Refs #79`.
