# Tasks

Each task writes its tests first and sees them fail for the right reason before it implements (the repository's TDD rule). Terms used below:

- "The check": `GITHUB_TOKEN=$(gh auth token) bun run check`.
- "Coverage": at least 80% of lines and functions for every source file the task changes, read from `bun test --coverage`'s per-file table.
- "Browser files": the named files run with `bun packages/view/test/browser/run.ts --engines chromium,webkit,firefox --target session-process` after `bun run build`, under the browser lock; `-- -t <pattern>` narrows a run.

Order:

- Group 0 runs first.
- Groups 1 (`compute` and `core`, Issue #74) and 2 (`widgets` and `view`, Issue #71) then run in either order. They share no file and no type; in this worktree they run one after the other.
- Group 3 runs last.

Inside a group, tasks run in their order.

## 0. Base

- [x] 0.1 Record the PO's decisions (proposal, open questions 1 to 5). Under this task, record each answer: the proposed default, accepted under the PO's unattended handoff, unless the PO answered otherwise on Issue #71 or #74. Tests: none. Verify: five answers are recorded. An answer other than the default stops the work for `/opsx:update` before groups 1 and 2:
  - question 1 answered (b) or (c) replaces group 2;
  - question 2 answered "moves only" drops the "Add child" scenarios and the two MODIFIED requirements;
  - question 4 answered "drop" or "refuse" replaces group 1 and amends AD-13.
  - Note (Refs #71, #74): ticked 2026-11-08. The PO accepted every proposed default on 2026-11-08 (recorded on Issues #71 and #74): 1 ask first (a); 2 every edit that gives a carrying leaf its first child (drop, indent, "Add child"); 3 dependents keep the former leaf as a predecessor that names no task; 4 a warning on `ask` and `update`, the plan stays as sent; 5 the wording of open question 5, the Italian approved as it is. No answer differs from the default, so groups 1 and 2 stand as written.
- [x] 0.2 Check names, versions and the baseline (askboard-contract-versioning, Rule 3; design.md, Context, Merge points and decision 5). Tests: none. Record each item under this task:
  - Every name design.md borrows, checked with `git grep -n` on `origin/main`, with its file and line: `indent`, `addChild`, `moveInto`, `relocationProblem`, `can`, `isPert`, `locate` (`tree/model/`), `afterDrop`, `afterMove` (`tree/moving.ts`), `dropOn`, `applyDrop`, `DeleteQuestion`, `deleteQuestionOf`, `deletedWith`, `keyAction`, `treeKeyOf`, `linkedPlans`, `linkedDependents`, `linkedAdd`, `GANTT_PLAN_ESTIMATES`, `planTasks`, `GanttPlanItem`, `expandGanttPlan`, `scheduleItem`, `checkedFormulaWarnings`, `referenceAddressing`, and the keys `tree.delete.dependsOnIt` and `tree.drag.moved`.
  - Every `*_VERSION` and `*_FORMAT` constant of `packages/contract/src`. This change moves none.
  - The heads of the branches in Merge points, and whether any of them now edits `compute/src/board.ts`, `cpm.ts`, `GanttPlanItem`, `tree/widget.tsx`, `tree/toolbar.tsx` or `tree/model/keys.ts`.
  - The tests that indent, drop "into" or "Add child" on an estimated leaf of a Tree with `pert` or a plan (`grep -n` in `packages/view/test/browser/{wbs,tree,gantt,uj2}*.browser.ts` and `packages/widgets/src/tree/**/*.test.ts`), listed by file and test name.
  - The pass counts of `bun test` for `packages/compute`, `packages/core` and `packages/widgets`, and the `tree` chunk's size.

  Verify: the note lists every name, version, head and listed test. A name that is missing or changed, or another change editing `planTasks` or `expandGanttPlan`, stops the work for `/opsx:update`.
  - Note (Refs #74, #71): ticked 2026-11-08 on `origin/main` 8e2e1247. Every borrowed name is on `main` as designed: `indent` `tree/model/edits.ts:262`, `addChild` `:147`, `moveInto` `:347`, `relocationProblem` `:306`, `can` `:107`, `isPert` `model/nodes.ts:11`, `locate` `model/nodes.ts:26`, `afterMove` `tree/moving.ts:35`, `dropOn` `model/drop.ts:35`, `applyDrop` `:47`, `DeleteQuestion` `delete-question.tsx:24`, `deleteQuestionOf` `deleting.ts:53`, `deletedWith` `:81`, `keyAction` `model/keys.ts:100`, `treeKeyOf` `key-event.ts:22`, `linkedPlans` `board-graph/plan-link.ts:69`, `linkedAdd` `linked.ts:61`, `linkedDependents` `:76`, `GANTT_PLAN_ESTIMATES` `contract/src/widgets/gantt/index.ts:38`, `planTasks` `compute/src/board.ts:135`, `expandGanttPlan` `cpm.ts:217`, `scheduleItem` `:165`, `GanttPlanItem` imported by `board.ts:14` and `cpm.ts:17` (defined in `source.ts`), `checkedFormulaWarnings` `core/src/graph-check.ts:82`, `referenceAddressing` `core/src/molecules/addressing.ts:49`; keys `tree.delete.dependsOnIt` (`en-US.ts:225`) and `tree.drag.moved` (`:255`). `afterDrop` is in `tree/moving.ts` (other widgets have their own).
  - Versions on `main`: input 1.12, output 1.11, tool envelopes 1.12, board document 1.11, board protocol 1.8, Snapshot data 1.1, view manifest 1.1, configuration 1.0, local API 1.0, session file 1.0, molecule format 1.0.0. This change moves none.
  - Heads read: oversized-acts 25bfc33c, choice-activation 57618b67, backlog-issues 7046d8a6, snapshot-toolbar 1c235e20, reopen-start-from-answer b8a8308c, keyboard-help 101a9498. None edits `compute/src/board.ts`, `cpm.ts`, `source.ts`, `tree/widget.tsx`, `tree/toolbar.tsx` or `tree/model/keys.ts`. The document-review, graph, spreadsheet, diagram, diff-review and image-annotation branches are not on the remote (not checked).
  - Browser files that indent, drop into or add children on Tree leaves with UJ-2 or plan data (candidates for group 2, by file, found by `grep`; test names to be pinned when group 2 runs them): `wbs-linking.browser.ts` ("a child named under reporting depends on the portal", the portal split), `tree-uj2`, `uj2-editing-plus`, `tree-moving`, `tree-drag-answer`, `tree-adding`, `tree-keys`, `tree-deleting`, `gantt-predecessors` (no match for "became a parent" by that text). Unit files using these edits: `widgets/src/tree/{linked,moving,adding,classes,drag-view}.test.ts` and `tree/model/{moves,drop-answer,overflow,focus,drop,keys,marks,edits}.test.ts` (pure edits, unchanged by this change).
  - Baseline `bun test`: compute 515 pass, core 1097 pass, widgets 1933 pass, 0 fail. `tree` chunk 78,744 bytes (`chunk-sizes.json`).

## 1. A plan's stray IDs are warned (Issue #74)

- [x] 1.1 Warn about the IDs a plan names that are no work package (compute spec: Plan IDs that name no work package are warnings, every scenario; design decision 4). Tests first, in `packages/compute/test/board-plan.test.ts`:
  - Rewrite "adds nothing, and no warning, for an entry that names no leaf" (`:139`) as "adds nothing to the schedule": the source's scheduled entries equal the UJ-2 board's, and the graph warns once at `schedule.design`, once at `schedule.nope`, and once at `schedule.build` with a non-object entry, which is still neither read nor refused.
  - The UJ-2 Tree without `billing`: one warning `missing-reference` at `schedule.billing`, whose detail names `billing` and `wbs`; every other value equals the board's with no `billing` entry.
  - Without `portal`: one warning at `schedule.portal`, and `reporting`'s `es` warning as before.
  - A child under `portal`: one warning at `schedule.portal`, no `portal` task, and the WBS total without the portal's expected effort.
  - An ID that is a stray and a predecessor at once: one warning.
  - A plan whose `workPackages` names no Tree: only the existing work-packages warning.
  - The UJ-2 board and the approved answer's board: no warning.

  Then:
  - add `GanttPlanItem.strays` (optional, frozen) in `compute/src/source.ts`, appended last;
  - make `planTasks` record each non-leaf key in entry order, without reading the entry;
  - in `expandGanttPlan`, warn about the strays, then about each predecessor of a scheduled task that names no task, deduplicated by ID, only when `leavesOf` found the Tree;
  - update the header comments of `board.ts` and `cpm.ts`.

  Verify: the new tests fail first on the missing warnings, then pass; `bun test packages/compute` passes; coverage; the check passes.
  - Note (Refs #74): `GanttPlanItem.strays` (omitted when empty, frozen), `planTasks` records each non-leaf key unread, and `warnAboutStrays` in `cpm.ts` warns for strays then for predecessors of scheduled tasks, once per ID, only when the Tree is found. Seven new tests in `board-plan.test.ts` (six red first, the UJ-2 no-warning guard already green); `bun test packages/compute` 522 pass, 0 fail; `board.ts`, `cpm.ts`, `source.ts` 100% covered. Deviation: two existing compute tests (`board-wbs.test.ts` predecessor test, `cpm.test.ts` "warns about a predecessor or a dependency") also gain the cause warning at `<plan>.<ID>`, as decision 4 says; the task did not list them. The full check runs after 1.2.
- [x] 1.2 Warn on `ask` and `update` (core spec: A plan that names no work package is warned on ask and update, every scenario; compute's warning reaching the agent). Tests first, in `packages/core/test/widget-graph.test.ts`:
  - An update after the UJ-2 ask whose `change` of `wbs` sends its data without `billing`: the update is applied, and its result holds a `formula` warning with `itemId` `schedule`, `address` `schedule.billing` and `error` `missing-reference`, whose text names `wbs` and never `schedule__plan` or `wbs__tree`. `fetch` of `schedule` still holds `billing`'s entry.
  - The same update with a second `change` of `schedule`, whose `dependencies` no longer name `billing`: no warning names `billing`.
  - An ask with an entry for `review`: created, warning names `schedule` and `review`.
  - Move "a predecessor that names no task warns…" (`:33`) from one formula warning to two, the plan's at `schedule.review` and the dependent's at `schedule.billing.es`.

  Then: nothing in `core/src` should need to change (design decision 4). If it does, record why. Verify: the tests pass, after failing first where group 1.1 is not yet in; `bun test packages/core` passes; coverage; the check passes.
  - Note (Refs #74): three new tests in `widget-graph.test.ts` (an entry for `review` on ask; a Tree without `billing` on update, with the plan's entry kept; a second change that drops the entry, no warning) and `:33` moved from one warning to two; `widget-update.test.ts` "a formula error in the board as changed" moves from one to two likewise (not listed in the task). Run against compute without 1.1: 4 red, the second-change test is a green guard; with it, `bun test packages/core` 1100 pass, 0 fail. No change to `core/src` was needed.
- [x] 1.3 Review checkpoint for group 1. Tests: none (review). A spec review by askboard-spec-reviewer that checks:
  - every compute and core scenario has a test;
  - decision 4 holds: one warning per plan and ID, the stored props untouched, no refusal;
  - the gantt-widget open question 10's board behaviour is unchanged;
  - no set moved.

  Verify: findings recorded under this task as S-n and fixed, each fix tests first, before group 3.
  - Note (Refs #74): reviewed with 2.5 in one spec pass over 02f273c8..8658ca77 (review file kept by the coordinator): no finding in group 1. Every compute and core scenario has a test; decision 4 holds on the board path (one warning per plan and ID, entries never read, no refusal, props kept); the board's Gantt shows nothing new; no set moved (every constant equals `origin/main` a8f1d0a0).

## 2. The Tree asks before making a leaf a group (Issue #71)

- [x] 2.1 Write the rule (view spec: Making a work package a group asks first, "Nothing to lose" and "A drop that is refused"; The group question's words; design decision 1). Tests first, in a new `packages/widgets/src/tree/grouping.test.ts`, over the UJ-2 Tree with `pert`, the plain Tree fixture (`treeBoardDocument`) and the tall-branch Tree:
  - `grouped` gives `portal` for a drop `into` it, for an indent of `billing` and for "Add child" on it;
  - it gives `undefined` for a drop before or after, for a drop into a parent, for an indent under a parent, for a refused drop (`depth`, `own-branch`) and for an unknown node;
  - `groupQuestionOf` gives `{label: "Customer portal", estimates: true, task: true, dependents: 1}` with `planned` true;
  - it gives `estimates: true, task: false` with `planned` false;
  - it gives `undefined` for a leaf with no estimate and no plan, and for the plain Tree with no plan;
  - it gives `task: true, estimates: false` for a leaf with no estimate under a plan.

  Then `grouping.ts`, with no React, importing only `@askboard/contract`, `./model/` and the type `Say` from `@askboard/view/catalog` (which `tools/check-imports.ts` allows, as `deleting.ts` imports it). Verify: the tests fail first, then pass; coverage; the check passes.
  - Note (Refs #71): `grouping.ts` holds `grouped`, `groupQuestionOf`, `GroupEdit`, `GroupQuestion` and `GroupContext`, no React, importing `@askboard/contract` and `./model/` only; an indent is read through `can("indent")` and the previous sibling, so a refused indent never asks. 14 tests in `grouping.test.ts` (red first on the missing module), 100% covered; a partly estimated leaf counts as holding estimates. Beyond the list: the indent past the depth limit, a drop on an unknown node or target, and a plain Tree a plan names (task only). The check runs after 2.2.
- [x] 2.2 Add the question's strings (view spec: The group question's words, every scenario; proposal, open question 5). Tests first:
  - in `widgets/src/tree/italian.test.ts` and a new `grouping-words.test.ts`, `groupedWith(question, text)` gives the en-US sentence of the portal scenario, the WBS-with-no-plan sentence, the plan-only sentence and the Italian ones;
  - the catalog completeness test fails on the missing keys.

  Then append the six keys of decision 2 at the end of the Tree's block in `view/src/strings/keys.ts`, `en-US.ts` and `it-IT.ts` (Italian marked for review in the note), and `groupedWith` in `grouping.ts`. Verify: the tests fail first, then pass; the check passes.
  - Note (Refs #71): the six `tree.group.*` keys at the end of the Tree's block in `keys.ts`, `en-US.ts` and `it-IT.ts`, and `groupedWith(question, text)` in `grouping.ts`, which gives the words after the leaf's name as `deletedWith` does (the component puts “label” first). The Italian is the PO's approved text; the dependents clause reuses `tree.delete.dependsOnIt` as decision 2 says, whose Italian reads "dipende da esso" where proposal open question 5 wrote "da essa" (for `/opsx:update` if the PO wants "essa"). `grouping.ts` now also imports the type `Say` from `@askboard/view/catalog`. Tests: 6 in `grouping-words.test.ts` and 1 in `italian.test.ts` (red first on the missing export); `bun test packages/widgets/src/tree packages/view/src/strings` 523 pass, 0 fail (catalog completeness green). The check runs after 2.4.
- [x] 2.3 Wire the question into the widget (view spec: Making a work package a group asks first, Answering the group question; design decisions 2 and 3). Tests first, in a new `widgets/src/tree/group-question.test.ts`, render tests with `react-dom/server` and the widget host:
  - the question is a `fieldset` named by its words, the label is text (a label holding `<b>` shows literally), the focus starts on "Cancel", and Escape calls cancel;
  - the toolbar shows the question in place of the tools, and never both questions;
  - `widget.tsx`'s pending edit: a confirmed drop applies `afterDrop` on the value as it is then, and a drop no longer possible changes nothing;
  - a confirmed indent moves the node and a confirmed "Add child" starts the name editor;
  - Cancel returns the focus to the dragged row or the tool.

  Then:
  - `group-question.tsx`;
  - the `asked` union in `widget.tsx`, with `act` (indent, `addChild`) and `dropRow` asking through `groupQuestionOf`;
  - `toolbar.tsx` rendering the one question;
  - `index.tsx` passing `planned` from `linkedPlans(board, item.id).length > 0`;
  - the header comments.

  Verify: the tests fail first, then pass; the existing `widgets/src/tree` tests pass, with those listed in 0.2 updated to confirm; coverage; the check passes.
  - Note (Refs #71): `group-question.tsx` (`GroupQuestion`, `questionKeyDown`), `Asking` in `toolbar.tsx` now a union of a delete and a group question (one `key` each, one question at a time), `Asked` in `widget.tsx` a union too, with `perform`, `askGroup`, `confirmGroup` and `dropRow`'s `confirmed`; `index.tsx` passes `planned`. A confirmed edit acts on the node it was asked of, not the current row, and a drag's `end` leaves the focus on "Cancel". 14 new tests in `group-question.test.ts` (red first on the missing module; 8658ca77 replaced the three toolbar render tests with a source check, so 13 remain; the widget's pending edit is pinned by source assertions as `drag-view.test.ts` does, since no DOM exists in `bun test`; its behaviour is task 2.4's); `bun test packages/widgets` 1968 pass, 0 fail. Coverage (80% of lines and functions) holds for `grouping.ts` and `group-question.tsx` only: no unit test loads `widget.tsx`, `toolbar.tsx` or `index.tsx`, which the browser files cover, as for the Tree's earlier components. Outside the group: `packages/widgets/package.json` and `bun.lock` gain `react-dom` 19.3.1 and `@types/react-dom` 19.3.0 as devDependencies (the versions `view` pins) so a widgets test can use `react-dom/server`. The component renders in en-US only in a unit (the language context is not exported by the catalog entry); Italian is in `grouping-words.test.ts` and the browser. No test of 0.2's list needed a change yet; the browser files are 2.4's.
- [x] 2.4 Run the browser scenarios (every view scenario of this change, end to end). Tests first:
  - In `wbs-linking.browser.ts`, on the UJ-2 board, each with the Tree and plan draft values checked:
    - drop `billing` into `portal`: the question's text, focus on "Cancel", nothing moved;
    - "Continue": `billing` under `portal`, the total without the portal, no `portal` row in the plan, reporting's field error;
    - drag back: no draft value;
    - Cancel and Escape: unchanged, focus on `billing`'s row;
    - Alt+Shift+ArrowRight on `billing`: the question;
    - "Add child" on `reporting`, then "Continue", then Escape on the name: no node, no draft value.
  - In `tree-drag.browser.ts`: the plain Tree fixture's "Indenting by drop" still moves at once.
  - Update the scenarios of `gantt-plan-tree.browser.ts` ("A predecessor that became a parent") and the add scenario in `wbs-linking.browser.ts` ("A child of a leaf") to confirm, as their MODIFIED requirements say. Update every other file listed in 0.2 likewise.

  Then run `bun run build:view --record-sizes` if the `tree` chunk moved, and commit `chunk-sizes.json`. Verify: the new tests fail on `main`'s build first (no question), then pass in the three engines; the browser files pass; the check and `bun run build` pass.
  - Note (Refs #71): `wbs-linking.browser.ts` gains a describe of 8 tests per engine (the drop asks with nothing changed; Continue, with the totals, the portal's missing plan row, reporting's field error, only the Tree drafted, then the drag back leaving no draft; Cancel and Escape returning the focus to billing's row; Alt+Shift+ArrowRight; Add child with Cancel, Continue and Escape on the name; Add node never asking; it-IT), and its add scenario \"a child named under reporting depends on the portal\" now confirms. `gantt-predecessors.browser.ts` needs no change: \"a predecessor that became a parent\" is `gantt-plan-tree.browser.ts`'s last test, now confirming. `tree-drag.browser.ts`: the plain Tree's drop into `portal` asserts no question. No other file of 0.2 failed. Helpers: `groupQuestion`, `askedGroup`, `continueGroup`. Red on 2.3's old widget files: 9 of 10 targeted tests failed on the question never showing (the Add node guard stayed green). Green: chromium 200 pass, 0 fail, and webkit 200 pass, 0 fail (192 existing plus 8). Firefox not run: CI only, on demand, blocked by #86; left to the PO. Full check at the head of 2.8: `bun run build`, then `GITHUB_TOKEN=$(gh auth token) bun run check`, both pass (groups 1 and 2 ran it together here). A fix came out of it: a drop's drag `end` took the focus off \"Cancel\"; `dropRow` now clears the pending focus move when it asks, and `end` leaves the focus while a group question is asked. Sizes recorded (bytes): `tree` 78,730 to 81,472 (+3.5%), `shell` 187,378 to 188,069, `board-page` 979,038 to 979,729, `compute` 43,227 to 43,620 (group 1).
- [x] 2.5 Review checkpoint for group 2. Tests: none (review). A spec review by askboard-spec-reviewer that checks:
  - every view scenario has a unit or browser test;
  - decisions 1 to 3 hold: the edits stay pure, the pending edit is view state, nothing leaves the view before "Continue";
  - the strings are the catalogs', and the agent's label renders as text (AD-8);
  - the MODIFIED scenarios match their tests.

  Verify: findings recorded under this task as S-n and fixed, each fix tests first, before group 3.
  - Note (Refs #71): one spec pass over 02f273c8..8658ca77 with 1.3: H 0, M 1, L 4. The view scenarios and both MODIFIED scenarios match their tests; decisions 1 to 3 hold; the agent's label renders as text (AD-8); the new keys are appended at the end of the Tree's block. The implementer's points: the `Say` type import is allowed (`check-imports.ts`, as `deleting.ts`); the en-US-only unit render is covered in Italian elsewhere; closing with nothing applied when the question stops applying is accepted as behaviour (S-1 asks for its test); the `react-dom` devDependencies are exact, equal to `view`'s, dev-only and absent from `tree.js`; the focus fix is tested through `askedGroup`. Findings: S-1 (M) "an edit no longer possible changes nothing" and the question closing on an agent update are untested (fix 2.6; design decision 3 gains the sentence); S-2 (L) a second drop of the same node keeps the question's React key, so the focus stays off "Cancel" (fix 2.7); S-3 (L) "esso" is right (the node, "nodo"); the proposal now says so, and a `keys.ts` comment and an `italian.test.ts` title still call the shipped text approved (fix 2.8); S-4 (L) records: the proposal's Impact and task 2.4's file name corrected, task 2.1 names the `Say` import, the 2.3 note's test count (fix 2.8); S-5 (L) Verify clauses: Firefox not run (CI only, on demand, blocked by #86), no note records the full check, 2.3's coverage clause cannot load `widget.tsx`, `toolbar.tsx` or `index.tsx` (fix 2.8). Unconfirmed: the focus after "Continue" on a drop the agent made impossible (2.6 settles it).

- [x] 2.6 Fix S-1 of review 2.5 (view spec: Answering the group question, "an edit no longer possible SHALL change nothing"; design decision 3, its new sentence). Tests first, in `wbs-linking.browser.ts`, Chromium and WebKit: with the question open on a drop of `billing` into `portal`, (a) the agent's update gives `portal` a child: the question closes, nothing is applied, the Tree and draft are as the update left them, and the focus is on a row or the grid, never the page body; (b) the agent's update moves `portal` under `billing`, then "Continue": nothing changes and the question closes, with the focus as in (a). Each case fails on a mutant that applies the pending edit regardless. Fix the focus if (a) or (b) shows it falling to the body. Verify: the cases pass in both engines; the check passes.
  - Note (Refs #71): (a) passed before any fix in Chromium and WebKit (the question closes, nothing applied, the focus stays in the Tree); (b) lost the focus to the page body in WebKit (Chromium kept it), so `confirmGroup` now moves the focus to the grid (a drop) or to the part the edit came from (a key) when the confirmed edit is no longer possible. Mutants: confirming a question as it closes fails (a) in both engines; applying the drop on the value from when it was asked fails (b) in both engines. Decision 3 gains the focus clause. Cases in `wbs-linking.browser.ts`.
- [x] 2.7 Fix S-2 of review 2.5. Tests first: a browser case in `wbs-linking.browser.ts` (Chromium and WebKit) where a second drop of the same node onto another leaf, while a question is open, moves the focus to the new question's "Cancel" and shows its words; then the question's React key includes the target. Verify: the case fails before the key change, then passes; the check passes.
  - Note (Refs #71): the second-drop case failed in both engines before the key change (the focus was not on "Cancel"); `groupKey` puts the drop's target in the key and the case passes in both engines.
- [x] 2.8 Fix S-3 to S-5 of review 2.5 (records). The `keys.ts` comment and the `italian.test.ts` title stop calling the shipped Italian "approved by the PO" (the PO reviews it in the pull request); the 2.3 note says 8658ca77 replaced its three toolbar render tests with a source check (13 tests remain), and that 2.3's coverage clause holds for `grouping.ts` and `group-question.tsx` only, since no unit test loads `widget.tsx`, `toolbar.tsx` or `index.tsx` (Bun's per-file threshold); the 2.4 note records Firefox as not run (CI on demand, #86) and each group's note records the full check run (`bun run build`, then `bun run check`). Tests: none (records, a comment and a title). Verify: `bun run check` passes; `openspec validate --all --strict --no-interactive` passes.
  - Note (Refs #71): the `keys.ts` comment and the `italian.test.ts` title say the PO reviews the Italian in the pull request; the 2.3 note records 13 tests, the coverage scope and the browser-only files; the 2.4 note records Firefox as not run (#86) and the full check (`bun run build`, then `bun run check`, both pass, as does `openspec validate --all --strict --no-interactive`). The proposal and the texts of 2.1 and 2.4 (S-3, S-4) are `/opsx:update` records for the caller, not edited here.
- [ ] 2.9 Fix re-review of 2.6 to 2.8 (askboard-spec-reviewer, the fix range). Verify: findings recorded and fixed before group 3.

## 3. Records and the pull request

- [ ] 3.1 Update the documents (design decision 6). Tests: none (documents). Make these edits:
  - EXPERIENCE, Molecules, WBS with PERT: the question's sentence, and `updated:` set to the apply date;
  - CHANGELOG, Unreleased, Fixed: one line citing Issue #71 and one citing Issue #74;
  - CLAUDE.md: Status, and an "In code since `wbs-gantt-consistency`" paragraph naming `grouping.ts`, `group-question.tsx`, `GanttPlanItem.strays` and the plan's stray warning, with no set moved.

  Verify: each new text stands once (`grep -c -F`); `openspec validate --all --strict --no-interactive` passes.
- [ ] 3.2 Rebase onto `origin/main` (askboard-contract-versioning, Rebase procedure). Resolve the strings, `chunk-sizes.json`, CHANGELOG and CLAUDE.md conflicts by keeping both sides (Merge points), and re-check every borrowed name. If `keyboard-shortcuts-help` has merged, add the question's Escape and the asking keys to its inventory. Tests: the full suite. Verify:
  - `git grep` finds each borrowed name on the rebased head;
  - `git diff origin/main...HEAD -- packages/contract/src` moves no `*_VERSION` constant;
  - `bun run check`, `bun run build`, `bun run test:e2e` and `openspec validate --all --strict --no-interactive` pass.

  Record main's SHA and the counts in the note.
- [ ] 3.3 Run the pre-PR review. Tests: none (review). askboard-spec-reviewer reviews `origin/main...HEAD`, with askboard-security-reviewer on the same range for the agent label in the new question (AD-8) and the warning text's content (askboard-review-protocol). Verify: findings recorded and fixed, tests first; the PR body cites "Issue: #71" and "Issue: #74" and closes both.
- [ ] 3.4 The PO checks Issue #71's steps by hand in Chrome and Safari: the `wbs-pert` and `gantt-plan` board, drop `portal` onto the estimated `backend`, read the question, then Cancel, then Continue; and Issue #74's: an `update` without a leaf named by the plan, and its warning. Tests: none (manual). Verify: the PO's result is recorded under this task. If the session cannot run a browser by hand, leave the check to the PO and say so in the PR body.

## Workflow follow-up

- Undo of a confirmed group edit arrives with Issue #80 (`edit-undo`), not here.
- Archive after the pull request merges, with CLAUDE.md's Status naming the change as merged.
