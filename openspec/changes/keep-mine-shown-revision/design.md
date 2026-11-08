# Design

## Context

See proposal.md, Why. The defect's path on `main` 919e6503 (base of this change; `layouts` merged there as #60):

- `packages/view/src/shell/agent-change.ts:89` `workingQuestion` shows the revision the work was made on only while the page's `Revisions` (made per page load, `shell/index.tsx:209`) holds it, else the current one. After a reload or a takeover it never holds it.
- `shell/card-acts.ts:145` `revisionFor` names `work.rev`, and `answer` (`:232`) and `decline` send under it; `keepMine` (`:402`) sends `ignore` with `keptRev: work.rev`.
- `question-card.tsx:451-457` renders every item with `disabled={readOnly}` only; nested items inherit it (`renderer.tsx:220-228`, `layouts` decision 6).
- An edit widget renders the current props (`value ?? sent` in the Tree, Gantt and LaTeX; `shownProps` with `valueFits` in the Kanban and Timeline), so an edit made then is built on the current revision, held under `work.rev`, and diffed by `ask-core` against the kept revision (AD-20, Answers). `keepMine` drops a Kanban's or Timeline's value when the shown revision differs (`board-draft.ts:244` `valueDropped`, from `latex-kanban-timeline`'s security review X-2), which is also how edits made while the notice shows after a reload are lost silently; the Tree, Gantt and LaTeX register no `valueFits`, so their edits survive and are sent with the agent's change in them.
- The value-giving widget types on `main` are exactly those whose registry entry gives `edits` (`contract/src/widgets/registry.ts:72`): Tree, Gantt, LaTeX, Kanban, Timeline. Each registers `ComponentFacts.shape` (`catalog/port.ts:139`), and `packages/widgets/test/component-facts.test.ts` fails a chunk whose `shape` differs from `edits.shape`. Only the Kanban and Timeline register `valueFits` (`port.ts:168`).

Binding text: FR-6 ("ignores the update and keeps that work"); AD-10 (an answer only from the user's act; a review widget reports untouched content as unchanged); AD-20 (an answer names a `rev`; `ask-core` keeps every revision an event names; no AskBoard page uses Web Storage); EXPERIENCE, Component Patterns, Agent-change notice; NFR-10.

## Goals / Non-Goals

**Goals:** after a reload, no edit widget can produce a value whose diff against the kept revision holds the agent's change; nothing changes for a page that saw the kept revision; no contract set moves.

**Non-Goals:** showing the kept revision after a reload (decision 2); results (a result checked at the kept revision is refused, never invented, `approval-scale-ranking` Risks); the question's own options (an option label checked at the kept revision); a refused answer shown to the user.

## Decisions

### 1. The predicate: the card shows another revision, and the item's type edits the agent's content

An item takes no edit when `shown.rev !== revisionFor(question, work)` and `factsOf(item.type)?.shape !== undefined`. One pure function in `agent-change.ts`, `readOnlyItemsOf(question, shown, work, factsOf = componentFacts): ReadonlySet<string>`, returns the IDs at every depth (`valueItemsOf(shown.props.items)`, `view/src/nested-items.ts:29`); the card computes it once.

- **Why `shape`, not `valueFits`** (the reviewer's suggestion): on `main` `valueFits` covers the Kanban and Timeline only. The Tree and Gantt answer by element diff and the LaTeX by one `set` of the whole expression; an edit on the current revision carries the agent's change into each. `shape` is registered by exactly the types whose entry gives `edits`; task 1.1 adds the converse to `component-facts.test.ts` (no `shape` without `edits`), so the predicate equals "the answer's `changes` are computed from this item's value", for every type registered now or later (the Table registers `shape` on its branch).
- **Alternatives rejected:** a new fact `edits: true` (five chunk edits, a `ComponentFacts` field every in-flight edit widget must add, for what `shape` already says); "every item that gives no result" (disables display atoms and layouts and shows the line on them).

### 2. Read-only, not the kept revision shown

**Chosen:** read-only edit widgets (proposed default, open question 1).

- **Against FR-6:** the work is kept and the answer names the kept revision, as FR-6 says; what the user loses after a reload is editing those widgets on that question until its work on the earlier revision is gone (answer sent and cleared by `clearCarried`, `shell/index.tsx:102`, or the kept work cleared, which `prune` forgets, `board-draft.ts:340`), or until "Reload, losing my work".
- **Against EXPERIENCE's "Keep mine":** EXPERIENCE says only that the user "ignores the update and keeps that work", and leaves "what remains on an item after Keep mine" open (F-81); this change states it for edit widgets after a reload and adds the line (decision 4).
- **Against AD-10:** an untouched read-only item sends nothing and is reported unchanged against the revision the `ignore` names; a value held from before the reload was made on that revision and is what the item shows, so it is sent. The answer holds only the user's acts.
- **The alternative, showing the kept revision:** it would satisfy all three fully (the item shows what is answered and stays editable), but the page keeps no revision across a load (AD-20: no Web Storage), and `ask-core` keeps a revision only once an event names it, while before "Keep mine" only the draft record names it. It needs `ask-core` to keep a revision the draft names (an AD-20 amendment), a board message or board-document field to carry it (a contract minor), `board-host` dispatch and view work: not a small fix. Left to a later change if the PO wants it.

### 3. No write reaches the draft for such an item

`RenderItem` takes `readOnlyItems` (the set) and renders each item with `disabled={disabled || readOnlyItems.has(item.id)}`, passing the set to nested items. `itemCallbacks` (`item-callbacks.ts:53`) takes the same set: `onValueChange` of such an item, and `onValuesChange` naming one, write nothing, run no `onBeforeChange`, and report on the console naming the item, without failing it (a disabled component that still writes is a component defect, not a reason to block the question). `answerContentOf` is unchanged: the held value is the one the item shows (decision 2).

### 4. The line

One string key, `change.readOnlyAfterReload` (en-US and it-IT, open question 2), rendered by `RenderItem` under each read-only item, in the meta style of the notice's stake line; it takes no focus and is no live region (EXPERIENCE: the notice never takes focus). Nothing else on the card changes: the notice, its choices and "Answer" keep their rules (NFR-12's keyboard core unchanged).

### 5. A Kanban's or Timeline's value from before the reload

Unchanged: `keepMine` still drops it through `valueDropped` (requirement "An answer sends what its widgets show"). With decision 3 that drop is no longer needed for safety, since no value can be made on the shown revision, but relaxing it changes a security-reviewed guard; it stays, recorded as a residual loss (open question 3).

### 6. Versions

None: no schema set, board message or `ComponentFacts` field changes (askboard-contract-versioning). Task 0.1 records main's constants; the rebase task checks none moved.

## Merge points

Read on 2026-11-08 at the branch heads named. Each takes this change at its rebase if this one merges first; if one merges first, this change's rebase task re-checks the names below and keeps its hunks.

| Change | Branch head | Overlap | What it takes |
|---|---|---|---|
| `table-widget` | `worktree-feature-table` 8b3a635a | Registers the Table with `shape` and `valueFits`; edits `card-acts.ts`, `board-draft.ts`, `renderer.tsx` | The Table is read-only by decision 1 with no Table edit. Its design Risks (design.md:175) must drop "the edits a user makes on a Table while the notice still shows after a reload are dropped by Keep mine": they can no longer be made. Its review X-1 browser test (Table and TextField) is added at its rebase, expecting the read-only Table. Its cell editor must honour `disabled` (no editor opens). |
| `form-widget` | `worktree-feature-form` 9dbfef0a | Edits `item-callbacks.ts`, `card-acts.ts`, `port.ts` (`check`) | Keep both sides in `itemCallbacks`' inputs. The PickField gives a result, so it is not read-only. |
| `document-review` | `worktree-feature-document-review` c30f5d31 | Edits `question-card.tsx`, the shell | Keep both sides at the `RenderItem` call. If its type's entry gives `edits`, it is read-only by decision 1. |
| `image-annotation`, `graph-widget`, `diff-review`, `diagram-widget`, `diagram-render`, `spreadsheet-widget` | 0ac511ec, d58d9368, 85268e26, 087c00ea, 9281d923, 1dff3ab2 (proposals) | Any edit widget they register | Nothing to code: an entry with `edits` registers `shape` (component-facts test) and is read-only by decision 1. Each design cites this change's requirement where it states its behaviour after "Keep mine". |
| `skill-index` (#61) | 445be187 | None | Nothing. |
| `layouts` (#60) | merged, `main` 919e6503 | `renderItem` for nested items | Base of this change: decision 3 passes the set to nested items. |

Names borrowed, all on `main` 919e6503 (task 0.1 records file and line): `workingQuestion`, `createRevisions`, `revisionFor`, `keepMine`, `valueDropped`, `answerContentOf`, `itemCallbacks`, `RenderItem`, `valueItemsOf`, `ComponentFacts.shape`, `componentFacts`, `WidgetType.edits`, `withWidgetTypes`, and the session harness's `lifecycleScenario`, `openBoard` (`test/browser/harness/lifecycle-test.ts`), `reloadAndWait` (`harness/reload.ts`) and `kanbanAsk` (`fixtures/kanban-documents.ts`). Seam this change creates: `readOnlyItemsOf`, and `readOnlyItems` on `RenderItem` and `itemCallbacks`.

## Risks / Trade-offs

- [After a reload, a user who chose "Keep mine" cannot edit an edit widget on that question until the answer is sent or the kept work cleared] → the line says why; the PO's open question 1. Fails closed.
- [A read-only item shows the agent's revision while the answer names the earlier one; the agent reads "unchanged" against the earlier revision] → accepted: the `ignore` edit choice tells the agent which revision the user kept (FR-6), and nothing is invented (AD-10).
- [A Kanban's or Timeline's work from before the reload is still dropped at "Keep mine"] → residual, unchanged from `latex-kanban-timeline`; open question 3.
- [A future edit widget registers `edits` without `shape`] → `component-facts.test.ts` already fails it; task 1.1 adds the converse.
- [A component ignores `disabled` and still writes] → decision 3 drops the write in the shell; the unit test of task 1.2 drives it.
- [E3's accepted note "Keep mine names the kept revision while the card shows the current one" stays true] → it no longer reaches an edit widget's answer.

## Migration Plan

None: the view alone changes, and one session process serves the board page. Rollback is a revert.

## Open Questions

The proposal's three questions carry their proposed defaults, accepted under the PO's unattended handoff of 2026-11-08 (task 0.2 records them). No conflict between source documents was found: EXPERIENCE leaves the state after "Keep mine" open (F-81), and this change fills it for edit widgets after a reload.
