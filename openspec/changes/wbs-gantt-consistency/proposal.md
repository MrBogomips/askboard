# Proposal

## Why

Issue: #71. Issue: #74. The end-to-end test of 2026-11-08 found two silent breaks of the link between a work breakdown and the Gantt plan over it, both on `main` 8e2e1247:

- **#71 (the user).** Dropping a node into an estimated WBS leaf, indenting under one, or adding a child to one turns the leaf into a group with no word to the user. Its estimates leave the totals (`wbs.expected` 36.83 to 27.33) and its Gantt task goes, its dependents left naming a task that no longer exists. The edits never look at the leaf they change (`widgets/src/tree/model/edits.ts:262` `indent`, `:147` `addChild`, `:347` `moveInto` through `moving.ts:46` `afterDrop`); `compute` ignores a parent's estimates by design (`compute/src/pert.ts:64-67`; compute spec, PERT estimates, "A package split") and keeps a former leaf's dependents naming it (molecules proposal, open question 13). The documents cover what happens after, but EXPERIENCE (Molecules, WBS with PERT) says nothing on telling the user first.
- **#74 (the agent).** An `update` that removes a leaf from the WBS, or makes it a parent, leaves the plan's entry for it and the predecessors naming it, and the agent is not told about the entry. `compute`'s board source skips an entry that names no leaf, with no warning (`compute/src/board.ts:146-147`; compute spec, The board's graph source; `compute/test/board-plan.test.ts:139`). So `cpm.ts`'s own "no task of the plan" warning (`cpm.ts:174-187`) never runs for a plan. A predecessor naming a removed leaf gives only an indirect warning, on its dependent's earliest start (`schedule.uat.es`, "reference [schedule.x.ef] names no child x"). `fetch` returns the plan as sent.

## What Changes

- **The Tree asks before making a leaf a group** (design decisions 1 to 3). In a Tree with `pert`, or one that a Gantt plan of its question names, three edits give a leaf its first child: a drop into it, an indent under it (the tool or Alt+Shift+ArrowRight), and "Add child" on it. When the leaf holds an estimate or is a plan task, each of these edits first asks an inline question in the toolbar row, as a delete does. The question names the leaf and says that its estimates leave the totals while it has children and that its task leaves the plan, with how many tasks depend on it. Cancel or Escape changes nothing. Confirming makes the edit; the plan stays as it is, and the estimates stay on the node, counting again once it is a leaf again. This is the PO's proposed default (a), accepted under the PO's unattended handoff (open question 1). Undo comes later with Issue #80 (`edit-undo`), out of scope.
- **A plan that names no work package is a warning** (design decision 4). `compute` gives one `missing-reference` warning per plan for each ID that the plan's `tasks` names, as an entry or a predecessor, that is no leaf of its Tree. It is addressed `<plan>.<ID>` and names the Tree. `ask` and `update` results carry it in reference addressing, through the existing send-time graph check. The plan's props stay as the agent sent them, and the board keeps showing the dependent's error. Neither dropping nor refusing is chosen: by AD-13 a missing reference is a warning that the board shows as an error, and by AD-10 AskBoard never shows the user a plan the agent did not send (open question 4).
- **Documents.** EXPERIENCE Molecules, WBS with PERT, gains the question's rule. CHANGELOG, Unreleased, Fixed, gets two lines, and CLAUDE.md gets Status and "In code since". No PRD or spine change: FR-15 and AD-13 already hold the behaviour, and this change follows them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: new requirements "Making a work package a group asks first", "The group question's words" and "Answering the group question"; "An added package's predecessors" and "Gantt predecessors that name no task" modified (their "Add child" scenarios now confirm the question).
- `compute`: new requirement "Plan IDs that name no work package are warnings".
- `core`: new requirement "A plan that names no work package is warned on ask and update".

## Impact

- Code: `packages/widgets/src/tree/`: a new pure module `grouping.ts` and its question component `group-question.tsx`; `widget.tsx` for the drop, indent and add paths; `toolbar.tsx`, which shows one question at a time; `index.tsx`, which says whether a plan names the Tree. `packages/view/src/strings/` (`keys.ts`, `en-US.ts`, `it-IT.ts`) gets the question's keys. `packages/compute/src/board.ts` (`planTasks`), `compute/src/cpm.ts` (`expandGanttPlan`, `scheduleItem`) and `compute/src/source.ts` (`GanttPlanItem`). Tests in `compute/test`, `core/test` and `widgets/src/tree`, and the browser files `wbs-linking`, `wbs-editing`, `tree-drag` and `gantt-predecessors`. `packages/view/chunk-sizes.json` if the `tree` chunk moves.
- Versions: none. No schema, board-protocol message, warning code or dependency changes. The `formula` warning and `missing-reference` exist since output format 1.3 (design decision 5).
- IDs served: FR-11, FR-12, FR-14 and FR-15; NFR-10 and NFR-12. ADs: AD-6, AD-9, AD-10 and AD-13. UX: EXPERIENCE Molecules (WBS with PERT, Gantt plan), Widgets (Tree), Interaction Primitives (Drag) and Accessibility Floor.

## Open questions for the PO

Each one has a proposed default, accepted under the PO's unattended handoff. Task 0.1 records them. A different answer comes back through `/opsx:update` before group 1.

1. **#71: what a drop onto an estimated leaf does.** *Default:* (a) ask first, naming the leaf and saying its estimates leave the totals and its task leaves the plan; Cancel leaves the Tree unchanged. Undo is Issue #80's. *Alternatives:* (b) refuse a drop onto an estimated leaf; (c) keep the estimates on a new child.
2. **Which edits ask.** *Default:* every edit that gives a carrying leaf its first child: a drop into it, an indent under it and "Add child" on it, since all three lose the same estimates. *Alternative:* the drop and the indent only, as the Issue names them; "Add child" keeps splitting with no question.
3. **The dependents on confirm.** *Default:* they keep the former leaf as a predecessor that names no task, shown under their row and in their panel for the user to uncheck. This is the documented rule (molecules open question 13; view spec, Gantt predecessors that name no task), and the question says how many there are. *Alternative:* hand them the leaf's own predecessors, as a confirmed delete does.
4. **#74: the agent's orphaned dependency.** *Default:* a warning in the `ask` and `update` result, naming the plan, the ID and the Tree; the plan stays as sent (AD-10, AD-13). *Alternatives:* drop the entry and the predecessors when the plan is expanded, and warn; or refuse the `update`, naming them. Either one needs AD-13 amended.
5. **Wording.** *Default:* "“Customer portal” becomes a group: its estimates leave the totals while it has children, and its task leaves the plan. 1 task in the plan depends on it." with "Cancel" and "Continue". The Italian is for the PO to review: "“Customer portal” diventa un gruppo: le sue stime escono dai totali finché ha figli, e la sua attività esce dal piano. 1 attività del piano dipende da essa." with "Annulla" and "Continua".
