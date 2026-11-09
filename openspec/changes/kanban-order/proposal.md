# Proposal

## Why

Issue: #79

The PO, after end-to-end test 3.2 of 2026-11-08: "I task nella kanban dovrebbero essere ordinabili anche verticalmente nella loro colonna di appartenenza". Today the Kanban moves cards between columns only, by design (`latex-kanban-timeline`, open question 5): a card always shows in the agent's order, and the answer's `changes` hold only `set`s of `<card>.column`, so a reorder is refused (contract and core specs, "A Kanban reorder"). The PO wants cards ordered within their column by drag and by keyboard, with the order carried by the answer. `keyboard-shortcuts-help` (Issue #81, in flight) leaves the Kanban's in-column keys to this change (its question 3).

## What Changes

- **AD-20's one generic diff gains a grouped flat list** (design decisions 1 and 2; AD-20 amended in place): a flat list whose elements carry their group in a field, where order counts within a group only. A `move` names the preceding element of the same group, `after` omitted for the first; an element's `set`s come before its `move`; a group whose order the user did not change gives no `move`. Applied in order to the flat list, the changes rebuild what the board showed. The Kanban declares `{elements: "cards", group: "column"}`.
- **The Kanban's changes** admit, beside the `set` of `<item>.<card>.column`, a `move` of `<item>.<card>` with an optional `after` naming a card of the same column, never a `parent` (design decision 3). A card moved to another column at the place the agent's order gives it is one `set`, as today; placed anywhere else, a `set` then a `move`. Everything else stays refused.
- **The board** (design decisions 4 to 7): a card drops at the place under the pointer, in its own column or another, with the Ranking's line where it would land; Escape cancels. The cards' Tab stop takes Alt+Shift+↑ and ↓ (up and down in the column) and Alt+Shift+Home and End or Cmd/Ctrl+Shift+↑ and ↓ (to its top and bottom), each held exactly; the arrow keys alone move the current card as today. The toolbar gains "Move up", "Move down", "To top" and "To bottom" before "Move to…", which keeps today's place. Each card gives its place in its column to assistive technology (`aria-posinset`, `aria-setsize`). The counter and the change highlight count the cards the answer reports. The held value is always one the answer's changes rebuild (`valueFits`), so a reload, "Keep mine" and a revision keep or drop it whole; read-only and Snapshot Kanbans show the order. Strings in en-US and it-IT (Italian to review).
- **The skill** teaches the order: the `cards` list gives each column's order, and how to apply a `set` and a `move` (`skills/askboard/references/widgets/kanban.md`, regenerated).
- **Versions** (design decision 8): the output format at the next minor after `main`'s; every other set keeps `main`'s.
- **Documents:** PRD FR-11's Kanban row and spine AD-20, amended in place; EXPERIENCE (Kanban, Accessibility Floor, Localization) and DESIGN (Kanban); CHANGELOG under Unreleased; the as-built note `docs/as-built/kanban-order.md`, never CLAUDE.md.
- **Not in this change:** Alt+Shift+← and → between columns, selection and the Keys panel, which the Kanban's keyboard retrofit brings (`keyboard-shortcuts-help`, question 3); adding, removing or editing cards or columns; a new dependency (the drop place comes from the pointer and the cards' boxes, with the pinned Pragmatic drag and drop 4.0.0's documented events).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contract`: "Kanban changes" and "Changes checked against their type" change (a `move` within a column is a Kanban change); new requirements for the grouped flat list of the generic diff, the Kanban's teaching text of its order, and the output format's next minor.
- `core`: "An answer's changes follow their type" changes (a reorder is logged, a value its changes do not rebuild is refused); a new requirement for answers that order a Kanban.
- `view-and-widgets`: "Kanban columns and cards", "Kanban moves by drag" and "Kanban at the keyboard" change; new requirements for the Kanban's held order, its order read-only and in a Snapshot, its strings, its order in the Approval summary, and its order end to end.

## Impact

- Code: `packages/contract` (`widgets/element-diff.ts`, `widgets/kanban/` constants, changes schema and teaching text, `schemas/output/index.ts`, a fixtures module), `packages/widgets/src/kanban/` (model, drop, drag, keys, widget, card, column, classes, text, props), `packages/view/src/strings/` (en-US, it-IT, `STRING_KEYS`), `skills/askboard/` (regenerated), `packages/view/chunk-sizes.json` if the `kanban` chunk grows past the check. No product code in `core` or `server` is expected: `ask-core`'s round trip and changes check are generic (design decision 2).
- Tests: contract, core, server board-host, widgets units; browser files in Chromium and WebKit (`kanban.browser.ts`, the edit widgets' session, Snapshot and Italian files, the hover audit); the edit widgets' conformance case. E1's transcripts and the approved examples stay byte-identical.
- No dependency, no `ComponentFacts` or port member, no board-protocol message, no tool or server instruction text.
- IDs served: FR-11 (amended), FR-18, FR-20, FR-29, FR-34; NFR-5, NFR-10, NFR-12. ADs: AD-1, AD-7, AD-9, AD-10, AD-20 (amended). UX: EXPERIENCE Component Patterns (Widgets: Kanban), Interaction Primitives (Drag), Accessibility Floor (Keyboard core, Tab order), Localization (Ranking and Kanban); DESIGN Components (Kanban).
- Merge points: `document-review` (PR #115, output format), `agent-facing-gaps` (PR #112), `reopen-start-from-answer`, `result-bound`, `keyboard-shortcuts-help` (question 3), the records change (PR #109); design.md, Merge points.

## Open questions for the PO

Each carries a proposed default, accepted under the PO's unattended handoff unless the PO answers otherwise on Issue #79 before group 1 (task 0.1).

1. **Where "Move to…" puts a card** (design decision 6). *Default:* where the agent's order puts it in the new column, as today, so the answer is one `set` and the user then places it with the new moves. *Alternative:* last in the new column (or first), which adds a `move` to most column changes.
2. **A column change at the agent's place carries no `move`** (design decision 3). *Default:* yes: a card moved to another column gives a `move` only when it stands elsewhere than the agent's order puts it, so today's answers are unchanged and an untouched order is never sent. *Alternative:* every column change carries its `move`, so the agent reads the place without applying the list.
3. **The toolbar** (design decision 5). *Default:* "Move up", "Move down", "To top" and "To bottom", then "Move to…" and the counter, each disabled where it cannot act. *Alternative:* "To top" and "To bottom" only, the moves by one place left to the keys and the drag.
4. **The keys** (design decision 5). *Default:* #81's question 3 default: Alt+Shift+↑/↓, Alt+Shift+Home/End and Cmd/Ctrl+Shift+↑/↓ within the column arrive here; Alt+Shift+←/→ between columns arrives with the Kanban's keyboard retrofit. *Alternative:* this change also binds Alt+Shift+←/→ to the previous and next column. If the PO takes #81's alternative (the retrofit adds every key), this change keeps its tools and drag and binds no key.
5. **Which cards the board marks as moved** (design decision 7). *Default:* the cards the answer reports, those with a `set` or a `move`, so the counter equals what the agent receives; after a swap of two cards the board may mark the one the user did not drag. *Alternative:* every card whose place in its column differs from the agent's, so the counter can exceed the answer's operations.
