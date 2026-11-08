# Proposal

## Why

FR-13 lets an agent arrange a question's items with layouts, and EXPERIENCE names them (Primitives, Layouts; Composition and Components, Layouts): Stack, Row, Group and Tabs inside a question. `atoms` shipped the atoms flat in a question's `items` and left layouts and nested items to this change (atoms, open question 1). The Form's sections and Tabs inside a question need them, so this change lands before the first change that nests items.

## What Changes

- **Four layouts as registered types** (FR-13, AD-7, AD-9): `stack` (items one under another), `row` (2 to 4 items side by side, relative widths as weights from 1 to 4 keyed by item ID), `group` (a title, an optional description and items, read as one group) and `tabs` (2 to 8 tabs, each `{id, title, items}`). Each is a registry entry with its props, checks, wording, example and teaching text, and a component chunk under `packages/view/src/catalog/`. A layout gives no result and edits nothing.
- **Nested items** (AD-7, amended): a layout holds registered types only (atoms, widgets and layouts), at most four layouts deep; excerpts, references, images and molecule references stay in the question's own `items`. Item IDs are unique in the ask at every level; a tab's ID is unique in its Tabs.
- **One walker** (AD-1, AD-6): a plain module of `contract` lists and rebuilds a question's items at every depth. The request checks and their wording, the draft record's keys, the Gantt plan's link, answers, `update`'s `change`, `fetch`, the graph check, the shell, the board page and `assemble` read nested items through it; a source guard lists every direct read left, with its reason.
- **IDs held elsewhere** (FR-5): `update`'s `add` and `change` refuse an item, at any depth, whose ID another question of the ask holds at any depth. Today only question and area IDs are checked there (design.md, Context).
- **Rendering** (AD-9, amended; EXPERIENCE and DESIGN, amended): the shell renders every item a layout holds through the port, in its own frame and error boundary. A Row shows its items one under another when it is too narrow for them; a Group is a group named by its title; Tabs on Radix Tabs keep every panel mounted, follow Radix's keyboard, are labelled by the question's text, mark a tab whose panel holds a field to correct, and switch on an answered question and in a Snapshot, since switching changes nothing.
- **The askboard skill**: each layout carries its teaching text, and the skill is regenerated within its budgets (`askboard-skills`).
- **Versions** (askboard-contract-versioning): the input format, the board document and the tool envelopes each take the next minor after the base's, bound at the rebase. The output format, the board protocol and the Snapshot data do not move: answers, the draft record and Snapshot data key items by ID, which stays unique in the ask.
- **Documents**: `spine-update-draft.md` amends AD-7 and AD-9 in place; `ux-update-draft.md` amends EXPERIENCE and DESIGN. Task 0.1 applies both. The PRD does not change: FR-13 already names layouts.
- **Not in this change**: layouts in molecules; context items and molecule references inside layouts; the selected tab kept across a reload; the Form's sections, which build on this; an Image atom (Image annotation's).

## Capabilities

### New Capabilities

None: the behaviours belong to the capabilities E1 created.

### Modified Capabilities

- `contract`: the four layout types and their props; nested items in the request checks and wording, the board document, `fetch` and the draft record's keys; the molecule format refusing a layout; teaching text.
- `core`: answers, `update` and `fetch` over nested items; item IDs unique across the ask on `add` and `change`.
- `view-and-widgets`: the four components; items rendered inside layouts; the Row's narrow form; Tabs' keyboard, panels and marks; layouts end to end and in Snapshots.

## Impact

- Code: `packages/contract` (`nested-items.ts`, `widgets/{stack,row,group,tabs}/`, `widgets/compose.ts`, `widgets/registry.ts`, `ask-items.ts`, `requests.ts`, `draft-record.ts`, `widgets/gantt/checks.ts`, `molecules/validate.ts`, the three set modules, `fixtures/layouts.ts`), `packages/core` (`lifecycle/widget-values.ts`, `widget-update.ts`, `widget-fetch.ts`, `updates.ts`, `model.ts`, `graph-check.ts`), `packages/view` (`catalog/{stack,row,group,tabs}/`, `catalog/port.ts`, `catalog/components.ts`, the shell's readers of a question's items, `board-page/model.ts`, `board-page/markdown-links.ts`, strings), `tools/nested-items.test.ts` (the source guard), `tools/build/skills/`, `skills/askboard/`, `packages/view/chunk-sizes.json`.
- No new dependency: Radix Tabs is already in the `radix` library chunk (`tools/build/shared-modules.ts`).
- Stacked on `atoms`, not merged yet: merge points and borrowed seams in design.md.
- IDs served: FR-13, FR-5, FR-6, FR-18, FR-20, FR-26; NFR-5, NFR-10, NFR-12; SM-1 (skill budget), SM-C2 (ready). ADs: AD-1, AD-6, AD-7 (amended), AD-8, AD-9 (amended), AD-10, AD-13, AD-15, AD-20. UX: EXPERIENCE Component Patterns (Primitives, Layouts), Composition and Components (Layouts), Accessibility Floor (Keyboard core, Tab order), What a reload keeps, Voice and Tone; DESIGN Components (Primitives, Layouts), Layout & Spacing.

## Open questions for the PO

Each carries a proposed default, taken under the PO's unattended handoff of 2026-11-07; the PO may revisit.

1. **Layouts as registered types.** *Default:* four registry entries, so the request checks, wording, examples, teaching text, `update`, `fetch` and chunks come from the registry (AD-7, AD-9). *Alternative:* structural kinds like areas, drawn by the shell, each dispatch point written by hand.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
2. **What a layout holds.** *Default:* atoms, widgets and layouts; context items and molecule references stay in the question's own `items`, where AskBoard places context (FR-13) and molecules expand. *Alternative:* anything a question's `items` hold.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
3. **Nesting depth.** *Default:* at most four layouts deep, refused before the schema runs. *Alternative:* unbounded within the request size.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
4. **Row widths.** *Default:* 2 to 4 items, `widths` keyed by item ID with weights from 1 to 4 (1 when absent); a Row whose items would get less than 240 px each shows them one under another. *Alternative:* equal widths only.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
5. **Wide widgets in a Row.** *Default:* allowed; the Row's teaching note says to put Trees, Gantts, Timelines and Kanbans in a Stack or a tab. *Alternative:* refused, which needs a "wide" flag per type.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
6. **Tabs' shape.** *Default:* `tabs: [{id, title, items}]`, tab IDs unique in the Tabs (AD-7's child IDs), the tablist labelled by the question's text. *Alternative:* a `tab` item type allowed only inside `tabs`.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
7. **The selected tab after a reload.** *Default:* not kept; Tabs reopen on their first tab, and the board protocol does not change. *Alternative:* kept in the draft record (a board-protocol minor, AD-20 amended).
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
8. **A field to correct in a hidden tab.** *Default:* its tab shows the field-error mark and says so to assistive technology, so "Answer"'s hint can be followed. *Alternative:* no mark.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
9. **Tabs' activation.** *Default:* Radix's automatic activation, as EXPERIENCE inherits Radix's keyboard everywhere but the options. *Alternative:* manual activation.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
10. **Molecules.** *Default:* a molecule's item may not be a layout, so no expanded ID goes unprefixed. *Alternative:* the expansion prefixes nested IDs.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
11. **IDs held elsewhere on `update`.** *Default:* fixed here at every depth, since nesting multiplies item IDs (FR-5). *Alternative:* a separate fix change.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
12. **Conformance.** *Default:* no new conformance file: the output format, the answer event and the push path do not change, and the session-process browser test reads `collect`. *Alternative:* a nested-results file in the three configurations.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
13. **The PO's check by hand.** *Default:* not blocking: task 4.3 checks Tabs by keyboard and a Row at the 1280 px floor in Chrome and Safari.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
