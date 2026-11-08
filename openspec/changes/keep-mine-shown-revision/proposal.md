# Proposal

## Why

After a reload (or a takeover), a question whose work was made on a revision the page never saw shows its current revision, while "Answer" names the kept one (`revisionFor`, `workingQuestion`). An edit widget then takes edits on the current revision's props, and `ask-core` diffs the edited value against the kept revision's props: the agent's own change is logged as the user's (review-table-g7 X-1, H, confirmed on the session process in Chromium and WebKit). It breaks NFR-10 and AD-10 on `main` today for the Tree, Gantt, LaTeX, Kanban and Timeline, and `table-widget` adds the Table to that set. E3 accepted "Keep mine names the kept revision while the card shows the current one"; `approval-scale-ranking` recorded its consequence for results as a refusal; for edit widgets it is an accepted answer with invented changes, which no acceptance named.

## What Changes

- **Edit widgets read-only on a revision the board cannot show** (NFR-10, AD-10, AD-20, FR-6): while a card shows a revision other than the one its answer would name, each item whose type edits the agent's content (its chunk registers the element `shape` that its registry entry's `edits` gives) is read-only, at every layout depth, with one line saying why. The shell takes no value for it, so nothing the user did not do on the kept revision is sent; a value it held before the reload, made on the kept revision and shown by the item, stays and is sent as before.
- **The dropped-edits loss removed**: edits made on such a widget while the notice still shows after a reload, which "Keep mine" dropped silently, can no longer be made.
- **Unchanged**: "Keep mine" still drops a Kanban's or Timeline's held value when the card shows another revision (requirement "An answer sends what its widgets show"); result widgets, atoms and the question's options keep working as before; nothing changes without a reload.
- **Documents**: EXPERIENCE (Voice and Tone, Agent-change notice rows; Component Patterns, Agent-change notice) gains the read-only state and its line; CLAUDE.md's Status names the change once merged.
- **Not in this change**: showing the kept revision after a reload (design decision 2, the alternative), which needs `ask-core` to keep a revision the draft names and a board message to carry it, so a contract minor; a refused answer shown to the user (`approval-scale-ranking`'s follow-up).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: a new requirement, "Edit widgets on a revision the board cannot show".

## Impact

- Code: `packages/view/src/shell/` (`agent-change.ts`: the predicate; `question-card.tsx` and `renderer.tsx`: `disabled` and the line, nested items included; `item-callbacks.ts`: no write for such an item), `packages/view/src/strings/` (one key, en-US and it-IT), `packages/widgets/test/component-facts.test.ts` (a chunk registers `shape` exactly when its entry gives `edits`). Tests in `packages/view/src/shell/` and one session browser file.
- No schema set, no `ComponentFacts` field, no widget chunk, no dependency, no PRD or spine change.
- Merge points with every change in flight that touches the shell or registers an edit widget: design.md, Merge points.
- IDs served: FR-6; NFR-10, NFR-12. ADs: AD-9, AD-10, AD-20. UX: EXPERIENCE Voice and Tone (Agent-change notice), Component Patterns (Changes, values and board states: Agent-change notice), Interaction Primitives (Hover and focus feedback, read-only widget).

## Open questions for the PO

Each carries a proposed default, accepted under the PO's unattended handoff of 2026-11-08; a different answer comes back through `/opsx:update` before the group it touches.

1. **Read-only, or show the kept revision** (design decision 2). *Default:* read-only edit widgets after a reload. The user edits them again by choosing "Reload, losing my work" while the notice shows, or, once "Keep mine" is chosen, when the question holds no more work on the earlier revision: the answer is sent (its work is then cleared, and a revision of the answer starts on the current revision), or the user clears what they kept. *Alternative:* a later change that shows the kept revision after a reload (a contract minor, `ask-core` and `board-host` work).
2. **The line's wording** (design decision 4). *Default:* one line for both states (notice showing, work kept), en-US "Read-only after the reload: your work on this question keeps an earlier version, which the board can no longer show." and it-IT "In sola lettura dopo il ricaricamento: il tuo lavoro su questa domanda mantiene una versione precedente, che la board non può più mostrare." (to review). *Alternative:* a second line under the notice naming "Reload, losing my work" as the way to edit.
3. **A Kanban's or Timeline's value from before the reload** (design decision 5). *Default:* "Keep mine" still drops it, as `latex-kanban-timeline` decided; recorded as a residual loss. *Alternative:* keep it when the item shows it (`valueFits` alone), now safe since no edit can be made on the shown revision; a separate change with its own security review.
