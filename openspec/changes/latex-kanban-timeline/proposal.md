# Proposal

## Why

After `approval-scale-ranking`, FR-11's catalogue ships six of its eighteen widgets. The PO's order of 2026-11-07 puts LaTeX, Kanban and Timeline next, the last of the small widgets. All three edit the agent's content rather than give a result: a LaTeX expression is corrected, a Kanban card changes column, a Timeline entry moves in time or across lanes. LaTeX also needs the whole-field edit that `widget-registry` (open question 7) left to the first widget that edits one field.

## What Changes

- **LaTeX** (FR-11, AD-8, AD-20): a `latex` item `{expression}`, at most 2,000 characters, empty allowed. The board shows a source field with a live preview through KaTeX's DOM API, untrusted commands off, fonts inlined as `data:` URLs. While the source does not parse, KaTeX's message shows under the field. The answer carries the expression as written, as one `set` of `<item>.expression`.
- **A whole field changes by one `set`** (AD-20, amended through `spine-update-draft.md`): the generic diff gains a shape over named fields of the item itself. This change takes it over from `diagram-render`'s proposal, because LaTeX lands first; `diagram-render` borrows it.
- **Kanban** (FR-11): a `kanban` item with 2 to 12 `columns` and 1 to 200 `cards`, each card naming its `column`. A card moves by drag onto a column (Pragmatic drag and drop, through the `dnd` chunk) or with "Move to…". Cards keep the agent's order. The changes are `set`s of `<item>.<card>.column`.
- **Timeline** (FR-11): a `timeline` item with 1 to 20 `lanes` and 1 to 200 `entries`. A milestone has a `date`; a range has a `start` and an inclusive `end`. An entry moves by pointer drag on the Gantt's time axis, snapped to days, a range keeping its length, or with "Move earlier", "Move later" and "Move to lane…". The changes are `set`s of `lane`, `date`, `start` and `end`.
- **Changes checked against their type** (AD-7, AD-10): `ask-core` refuses an answer whose computed changes its item's type does not declare in its changes schema, as it already refuses a result outside its result schema. Without this check, a Kanban reorder or an edited card label would reach the agent.
- **The Approval summary** names a whole-field change by its field (`approval-scale-ranking`'s summary).
- **Shared widget code**: the Gantt's dates, time scale, axis and pointer drag move to `packages/widgets/src/shared/` for the Timeline, unchanged for the Gantt.
- **Build** (AD-8, AD-9): a chunk may carry a package's stylesheet, with its woff2 fonts inlined as `data:` URLs and its other font formats dropped. The build fails on any other `url(` or `@import`.
- **The askboard skill**: each type carries its teaching text, and the skill is regenerated (`askboard-skills`).
- **Versions** (askboard-contract-versioning): the input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s, bound at the rebase.
- **Documents**: `spine-update-draft.md` amends AD-20 in place (three phrases) and `ux-update-draft.md` amends EXPERIENCE and DESIGN. Task 0.1 applies both. The PRD does not change.
- **Not in this change**: resizing a range, reordering cards within a column, adding or removing cards, entries, lanes or columns, a Timeline zoom control, MathLive, LaTeX documents and annotation (EXPERIENCE, Not adopted), Document review.

## Capabilities

### New Capabilities

None: the behaviours belong to the capabilities E1 created.

### Modified Capabilities

- `contract`: the whole-field shape; the three registered types (props, changes, checks, wording, examples, teaching text); a check of an item's changes against its type's changes schema; the four sets' next minors.
- `core`: answers refused when their changes fall outside the type's changes schema; the three types' answers.
- `view-and-widgets`: the LaTeX, Kanban and Timeline components; KaTeX's untrusted commands and fonts; package stylesheets in chunks; the Gantt on the shared time axis; the Approval summary of a whole-field change; strings in en-US and it-IT.

## Impact

- Code: `packages/contract` (`widgets/element-diff.ts`, a changes check beside `widgets/results.ts`, `widgets/{latex,kanban,timeline}/`, `registry.ts`, the four set modules, fixtures), `packages/core` (`lifecycle/widget-values.ts`), `packages/widgets` (three folders; `shared/` takes the Gantt's dates, scale, axis and pointer drag; the Approval's `summary.ts`), `packages/view` (strings), `tools/build` (package stylesheets, font inlining, the style URL check, `dnd`'s module names), `skills/askboard/` (regenerated), `packages/view/chunk-sizes.json`.
- New dependency: `katex` 0.19.1, pinned exactly in `packages/widgets`, already in the spine's Stack. It is MIT: the tarball's `LICENSE` and `package.json`, with fonts from `KaTeX/katex-fonts`, also MIT. `KaTeX/KaTeX` has 20,503 stars, is not archived, was last pushed on 2026-11-05 and released v0.19.1 on 2026-10-23 (`gh api`, 2026-11-07). It passed the adoption rule in the renderer spike (findings, pins row `katex`, accepted 2026-10-30). Its one dependency, `commander` 15.0.0 (MIT, 28,446 stars), serves only KaTeX's command line and ships in no chunk. No licence exception is needed (NFR-6).
- Merge points with `approval-scale-ranking`, `askboard-skills` and `diagram-render` (in flight): design.md, Merge points.
- IDs served: FR-11, FR-18, FR-20, FR-29, FR-34; NFR-5, NFR-6, NFR-9, NFR-10, NFR-12; R4; SM-C2. ADs: AD-1, AD-6, AD-7, AD-8, AD-9, AD-10, AD-19, AD-20 (amended). UX: EXPERIENCE Component Patterns (Widgets: LaTeX, Timeline, Kanban; Answer), Interaction Primitives (Drag), Accessibility Floor (Keyboard core, Tab order), Voice and Tone, Composition and Components (Component per widget, Drag and drop); DESIGN Components (LaTeX, Timeline, Kanban, Field error, Change highlight, Approval summary).

## Open questions for the PO

Each carries a proposed default, taken under the PO's unattended handoff of 2026-11-07 (PO priority: small widgets first: Approval, Scale, Ranking, then LaTeX, Kanban, Timeline).

1. **One change for the three widgets.** *Default:* one change of about 35 tasks. *Why:* the three widen the same four sets, the registry, the strings, the skill and the chunk sizes, and none gives a result; two changes would bind and rebase twice. *Alternative:* LaTeX alone (with KaTeX and the whole-field shape), then Kanban and Timeline.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
2. **Who lands the whole-field shape.** *Default:* this change, with `diagram-render`'s name, semantics and AD-20 wording, since LaTeX comes before the Diagram in the PO's order; `diagram-render` drops its own and borrows it. *Alternative:* LaTeX waits for `diagram-render`, or returns the expression as a result, which AD-20 keeps for content that is no edit.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
3. **A LaTeX expression that does not parse.** *Default:* the parse error shows under the field and does not block "Answer", so the answer carries the expression as written. *Why:* KaTeX covers part of LaTeX, so an expression it cannot parse may still be valid LaTeX for the agent; a formula error does not block either (EXPERIENCE, Answer). *Alternative:* the error blocks "Answer", like a failing field check.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
4. **An empty LaTeX expression.** *Default:* allowed both ways: the agent may send an empty expression for the user to write, and the user may clear one. *Alternative:* 1 character at least, which the board cannot enforce before "Answer" without a new gate.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
5. **Where a dropped Kanban card goes.** *Default:* a drop picks the column only, and cards show in the agent's order within each column. *Why:* FR-11's minimum is moving cards between columns, and an order within a column would add `move` changes. *Alternative:* a drop position within the column.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
6. **The Timeline's zoom.** *Default:* no zoom control: the Timeline opens at the finest of day, week and month at which its span fits the frame (the Gantt plan's opening rule), and scrolls. *Alternative:* the Gantt's Day, Week and Month control.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
7. **The Timeline at the keyboard.** *Default:* a toolbar with "Move earlier" and "Move later", one day at a time at Day zoom and seven days at Week and Month zoom, and "Move to lane…", a menu of the other lanes. *Alternative:* date fields in a grid, as the Gantt's.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
8. **`ask-core` checks every type's changes against its schema.** *Default:* yes, Tree and Gantt included: an answer whose changes a type does not declare is refused (AD-10). Their own edits already fit their schemas, and tests show it. *Alternative:* the check for the three new types only.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
9. **A Timeline range resized in an answer.** *Default:* the board offers moves only, but the contract does not refuse a `start` and `end` that change a range's length: it checks the changes and the edited props, not their relation to the props as sent. *Alternative:* a type check comparing sent and edited values, a new registry seam.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
10. **The PO's drag by hand.** *Default:* not blocking. The Kanban and the Timeline ship with their keyboard moves, and a task awaiting the PO (task 6.6) checks the drag by hand in Chrome and Safari, as `approval-scale-ranking`'s task 6.6 does for the Ranking.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
