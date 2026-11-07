# Proposal

## Why

FR-11's catalogue ships three of its eighteen widgets, and none of them gives a result: `widget-registry` opened the `results` seam and proved it only with a test-only type. Approval, Scale and Ranking are the PO's first widgets (2026-11-07): the smallest ones, the ones whose answer is a result (a decision, a value, an order), and Approval is what UJ-3's sales estimate review ends with. They carry the first browser and session proof of a result, as `widget-registry`'s open question 6 left to the first widget that declares one.

## What Changes

- **Approval** (FR-11, FR-18, UJ-3): an `approval` item whose result is `{decision}`, one of `approve`, `approve-with-changes`, `reject`, as the approved UJ-3 answer example already shows; the reason is the question's open prompt, which reads "Reason for the changes (required)" while "Approve with changes" is selected. "Answer" with that reason blank sends nothing, shows a field error under it and moves focus there. While the question holds changes, plain "Approve" is disabled. The Approval summary lists the user's changes to the question's other items from the generic diff. Sending a new answer after the agent received the earlier one asks for confirmation (F-63). `ask-core` refuses `approve-with-changes` without a reason and `approve` beside changes (AD-10).
- **Scale** (FR-11): a `scale` item, a slider (one value or a range) or a rating (a row of at most 11 values, one toggle each), whose result is `{value}` or `{low, high}`. It starts unset; a click on the unset track sets the value at that point (renderer spike row 22), and the keyboard sets a first value too.
- **Ranking** (FR-11, AD-10): a `ranking` item whose result is `{order}`, every item ID once. Rows reorder by drag (Pragmatic drag and drop, already pinned) or with "Move up" and "Move down"; "Keep this order" accepts the agent's order. An untouched list gives no answer.
- **Shell seams for result widgets** (AD-9, AD-20): a chunk's facts may make the open prompt required and relabel it, and may ask for a confirmation before a received answer is revised; a revision starts from its latest answer's results as it starts from its choice and note; the board tells a component which items its question holds.
- **Fix carried from `widget-registry`** (its task 5.14, U-1): the contract's test for "a result that holds nothing" terminates on a value that holds itself, and the view checks a reported result is JSON before testing it, so a buggy widget cannot hang the board.
- **Chunks** (AD-9): the three component chunks; Pragmatic drag and drop moves out of the Tree's chunk into a `dnd` library chunk that the Tree and Ranking share; Radix's Slider joins the `radix` chunk.
- **The askboard skill**: each type carries its teaching text, and the skill is regenerated (`askboard-skills`).
- **Versions** (askboard-contract-versioning): the input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s, bound at the rebase.
- **Documents**: `ux-update-draft.md` (EXPERIENCE and DESIGN: the Approval's scope and confirmation, the unset Scale at the keyboard, the Ranking's counter and marks, a revision's results, the new strings marked "to review"), applied in task 0.1. No PRD or spine change.
- **Not in this change**: the Slider atom (FR-13, `atoms-and-layouts` reuses the Scale's slider), the sales estimate review molecule, Kanban and Timeline (they reuse the `dnd` chunk and the Ranking's list), a control to clear a set value.

## Capabilities

### New Capabilities

None: the behaviours belong to capabilities E1 created.

### Modified Capabilities

- `contract`: the three registered types (props, results and their checks, wording, examples, teaching text); what a result requires of its answer; the four sets' next minors; a result that holds itself.
- `core`: answers refused when a result's requirements on its answer fail.
- `view-and-widgets`: the Approval, Scale and Ranking components; the open prompt a result makes required; the confirmation before revising a received answer; revisions that keep results; the `dnd` chunk; a non-JSON result reported by a component.

## Impact

- Code: `packages/contract` (`src/widgets/{approval,scale,ranking}/`, `registry.ts`, `result-content.ts`, the four set modules, fixtures), `packages/core` (`lifecycle/acts.ts` and the widget answer path), `packages/view` (`catalog/port.ts`, the question card, open prompt, card acts, board content, item callbacks, strings), `packages/widgets` (three folders, the Tree's drag imports unchanged), `tools/build` (`shared-modules.ts`), `skills/askboard/` (regenerated), `packages/view/chunk-sizes.json`.
- No new dependency: `@atlaskit/pragmatic-drag-and-drop` 4.0.0 and `radix-ui` 1.8.1 are already pinned (Stack); no licence change (NFR-6).
- Merge points with `widget-registry`, `askboard-skills` and `diagram-render` (in flight): design.md, Merge points.
- IDs served: FR-11, FR-18, FR-20, FR-22, FR-29; NFR-5, NFR-10, NFR-12; R4; SM-C2. ADs: AD-1, AD-6, AD-7, AD-8, AD-9, AD-10, AD-19, AD-20. UX: EXPERIENCE Component Patterns (Widgets: Ranking, Approval, Approval summary, Scale; Open prompt; Field error), Interaction Primitives (Revisions, Drag), Accessibility Floor, Voice and Tone, Key Flows UJ-3; DESIGN Components (Approval, Approval summary, Button, Toggle group, Scale, Ranking, Change highlight).

## Open questions for the PO

Each carries a proposed default, taken under the PO's unattended handoff of 2026-11-07 (PO priority: Approval, Scale and Ranking first).

1. **One change for the three widgets.** *Default:* one change of about 40 tasks. *Why:* the three widen the same four sets, the registry, the strings, the skill and the chunk sizes; two changes would bind and rebase twice. *Alternative:* `approval-widget` first, then `ranking-scale-widgets`.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
2. **What "changes on the board" means for the Approval.** *Default:* the edits to the other widget items of the Approval's own question, as its answer carries them; results of other widgets (a Scale's value) are not changes. *Why:* an Approval approves what its answer carries. *Alternative:* every edit on the board.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
3. **Where the confirmation of a revised verdict sits.** *Default:* at "Answer" (and Decline) on a question holding an Approval whose latest answer was delivered to the agent; Cancel sends nothing and keeps the draft. *Alternative:* at the first edit of such a question, which would defer every edit behind a dialog.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
4. **"Approve with changes" with no edits.** *Default:* allowed; the reason says what to change. *Alternative:* disabled until the question holds an edit.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
5. **`ask-core` enforces the Approval's rules.** *Default:* it refuses `approve-with-changes` without a reason and `approve` beside changes in the same answer (AD-10), though the board never sends either. *Alternative:* the view alone.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
6. **A revision keeps the widgets' results.** *Default:* the first edit of an answered question puts its latest answer's results into the draft, as it puts the choice and the note, so a revised answer still carries the decision, value or order. *Why:* without it, revising a Tree beside an Approval would send an answer with no decision, and the latest answer wins. *Alternative:* each result widget asks the user again.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
7. **No control to clear a Scale or a Ranking.** *Default:* none (FR-11's minimum is its ceiling); a rating's pressed step and the Approval's selected decision clear when pressed again; "Reload" and not answering remain. *Alternative:* a "Clear" link in the Scale and Ranking toolbars.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
8. **The keyboard on an unset slider.** *Default:* the unset track is focusable; Home or an arrow key sets the minimum, End the maximum; Radix's keys apply after. *Alternative:* a first arrow key sets the midpoint.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
9. **The drag library in a shared chunk.** *Default:* a `dnd` library chunk holding Pragmatic drag and drop for the Tree, Ranking and later Kanban, the Tree's chunk shrinking by the same code (AD-9). *Alternative:* each chunk bundles its own copy (about 22 KB each).
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
10. **The PO's drag by hand (renderer task 6.2).** *Default:* not blocking; the Ranking ships with its keyboard moves, and the hand check in Chrome and Safari is a task awaiting the PO (task 6.6). A failure there switches the Ranking to the pointer drag EXPERIENCE names as the fallback, in a later change.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
