# Proposal

## Why

After a reload (or a takeover), a question whose work was made on a revision the page never saw shows its current revision, while "Answer" names the kept one (`revisionFor`, `workingQuestion`). An edit widget then takes edits on the current revision's props, and `ask-core` diffs the edited value against the kept revision's props: the agent's own change is logged as the user's (review-table-g7 X-1, H, confirmed on the session process in Chromium and WebKit). It breaks NFR-10 and AD-10 on `main` today for the Tree, Gantt, LaTeX, Kanban and Timeline, and `table-widget` adds the Table to that set. E3 accepted "Keep mine names the kept revision while the card shows the current one"; `approval-scale-ranking` recorded its consequence for results as a refusal; for edit widgets it is an accepted answer with invented changes, which no acceptance named. The same holds for an answer's derived values, with or without a reload: the board computes them on the current revision, so an answer naming the kept one sends the agent's revision's finish date or critical path as the user's, and a computing item the agent added makes `ask-core` refuse the whole answer, the refusal reaching only the console (this change's review X-1; on `main` since the Gantt).

## What Changes

- **Edit widgets read-only on a revision the board cannot show** (NFR-10, AD-10, AD-20, FR-6): while a card shows a revision other than the one its answer would name, each item whose type edits the agent's content (its chunk registers the element `shape` that its registry entry's `edits` gives) is read-only, at every layout depth, with one line saying why. The shell takes no value for it, so nothing the user did not do on the kept revision is sent; a value it held before the reload, made on the kept revision and shown by the item, stays and is sent as before.
- **No derived values in an answer naming an earlier revision** (FR-12, NFR-10, AD-10, AD-13; design decision 7): "Answer" and Submit attach none when the answer names an earlier revision than its question's current one, with or without a reload. The agent reads the answer's `changes`, `results` and choice as before; the askboard skill's answers reference says such an answer carries no derived values.
- **The dropped-edits loss removed**: edits made on such a widget while the notice still shows after a reload, which "Keep mine" dropped silently, can no longer be made.
- **Unchanged**: "Keep mine" still drops a Kanban's or Timeline's held value when the card shows another revision (requirement "An answer sends what its widgets show"); result widgets, atoms and the question's options keep working as before; without a reload only the derived values change.
- **Documents**: EXPERIENCE (Voice and Tone, Agent-change notice rows; Component Patterns, Agent-change notice and Derived value) gains the read-only state, its line and what "Keep mine" sends; PRD FR-12's last consequence and AD-13's line on answers gain the exception of decision 7, amended in place; CLAUDE.md's Status names the change once merged.
- **Not in this change**: showing the kept revision after a reload (design decision 2, the alternative), which needs `ask-core` to keep a revision the draft names and a board message to carry it, so a contract minor; derived values computed at the kept revision (design decision 7, alternative b; follow-up change `derived-at-kept-revision`); a refused answer shown to the user (`approval-scale-ranking`'s follow-up).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: new requirements "Edit widgets on a revision the board cannot show", "What stays usable beside a read-only edit widget" and "No derived values in an answer naming an earlier revision"; "Derived values of every computing item in an answer", "Answering a question with a Gantt" and "Answering a work breakdown question" hold for an answer naming its question's current revision.
- `contract`: "WBS answer derived values" holds for an answer naming its question's current revision.

## Impact

- Code: `packages/view/src/shell/` (`agent-change.ts`: the predicate; `question-card.tsx` and `renderer.tsx`: `disabled` and the line, nested items included; `item-callbacks.ts`: no write for such an item; `card-acts.ts` and `submit.ts`: no derived values on an earlier revision), `packages/view/src/strings/` (one key, en-US and it-IT), `packages/widgets/test/component-facts.test.ts` (a chunk registers `shape` exactly when its entry gives `edits`). Tests in `packages/view/src/shell/` and one session browser file. The skill's answers template (`tools/build/skills/templates/answers.md`) and the generated `skills/askboard/references/answers.md`.
- No schema set, no `ComponentFacts` field, no widget chunk, no dependency. PRD FR-12 and spine AD-13 amended in place (design decision 7).
- Merge points with every change in flight that touches the shell or registers an edit widget: design.md, Merge points.
- IDs served: FR-6, FR-12; NFR-10, NFR-12. ADs: AD-9, AD-10, AD-13, AD-20. UX: EXPERIENCE Voice and Tone (Agent-change notice), Component Patterns (Changes, values and board states: Agent-change notice, Derived value), Interaction Primitives (Hover and focus feedback, read-only widget).

## Open questions for the PO

Each carries a proposed default, accepted under the PO's unattended handoff of 2026-11-08 (question 4 and question 2's revised wording after the group 1 review); a different answer comes back through `/opsx:update` before the group it touches.

1. **Read-only, or show the kept revision** (design decision 2). *Default:* read-only edit widgets after a reload. The user edits them again by choosing "Reload, losing my work" while the notice shows, or, once "Keep mine" is chosen, when the question holds no more work on the earlier revision: the answer is sent (its work is then cleared, and a revision of the answer starts on the current revision), or the user clears what they kept. *Alternative:* a later change that shows the kept revision after a reload (a contract minor, `ask-core` and `board-host` work).
2. **The line's wording** (design decision 4). *Default:* one line for both states (notice showing, work kept) and for a reload and a takeover alike, en-US "Read-only: your work on this question keeps an earlier version, which this tab can no longer show." and it-IT "In sola lettura: il tuo lavoro su questa domanda mantiene una versione precedente, che questa scheda non può più mostrare." (to review). Revised after review S-2: the first default, "Read-only after the reload: …", showed in a tab that took the board over without reloading. *Alternative:* a second line under the notice naming "Reload, losing my work" as the way to edit.
3. **A Kanban's or Timeline's value from before the reload** (design decision 5). *Default:* "Keep mine" still drops it, as `latex-kanban-timeline` decided; recorded as a residual loss. *Alternative:* keep it when the item shows it (`valueFits` alone), now safe since no edit can be made on the shown revision; a separate change with its own security review.
4. **Derived values of an answer naming the kept revision** (design decision 7). *Default:* none, by "Answer" and Submit alike, with or without a reload; FR-12's consequence and AD-13 say so, and the skill tells the agent. *Alternatives:* (b) `ask-core` computes them at the named revision, from the revision it keeps and the answer's values (an AD-13 amendment and `compute` at answer time; follow-up change `derived-at-kept-revision`); (c) only the derived values of items the named revision holds, with a visible refusal, rejected: an item both revisions hold still sends the agent's revision's values.
