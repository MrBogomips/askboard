# Design

## Context

See proposal.md (Why) for the two defects and their causes. What the fix stands on, all on `main` 8e2e1247:

- **The Tree's edits** (`widgets/src/tree/model/edits.ts`) are pure: `indent` (`:262`), `addChild` (`:147`) and `moveInto` (`:347`, reached from a drop through `model/drop.ts:47` `applyDrop` and `moving.ts:46` `afterDrop`) give a node its first child and never look at the fields of the node that becomes a parent. A node keeps its estimates when it becomes a parent. `can("editEstimate")` (`:87-88`) hides a parent's estimate cells, and `compute`'s PERT ignores them (`compute/src/pert.ts:64-67`).
- **The widget** (`widgets/src/tree/widget.tsx`) routes keys and tools through `act` (`:304-312`), with moves going through `move` (`:297-302`) and adds through `add` (`:266-273`), and routes drops through `dropRow` (`:315-324`). A delete that needs confirming sets `asked` and renders `DeleteQuestion` (`delete-question.tsx`) in the toolbar row (`toolbar.tsx:326`): a `fieldset` named by its words, with the focus on "Cancel" and Escape as Cancel through `keyAction(treeKeyOf(event), "edit")`.
- **The link to plans** (`widgets/src/tree/linked.ts`, `widgets/src/board-graph/plan-link.ts`): `linkedPlans(board, treeId)` (`plan-link.ts:69`) gives the plans of the question that name the Tree, and `linkedDependents` (`linked.ts:76`) counts the tasks that depend on given packages. A move carries nothing into a plan. A leaf that becomes a parent keeps its dependents, who then name no task (molecules proposal, open question 13; view spec, Gantt predecessors that name no task).
- **The board source** (`compute/src/board.ts`): `planTasks` (`:135-162`) keeps only the entries whose key is a leaf (`:147`), so an entry for anything else gives no warning (gantt-widget open question 10; `compute/test/board-plan.test.ts:139`). `expandGanttPlan` (`cpm.ts:217`) writes each predecessor into its dependent's earliest-start formula (`cpm.ts:131-134`), and a predecessor that names no task becomes a `missing-reference` error on that formula (`compute/src/graph/build.ts:108-115`). `scheduleItem`'s `unknown` (`cpm.ts:175-179`) warns about keys that name no task, but on a board it only ever sees leaves.
- **The send-time check** (`core/src/graph-check.ts:54-72`): `ask` and `update` (`core/src/ask.ts:471-472`, `core.ts:724`) return every graph warning as a `formula` warning in reference addressing. A `change` of the WBS reference expands that reference again and leaves the plan's stored props as they were (`core/src/lifecycle/updates.ts:281-317`).

ADs relied on: AD-6 (typed warnings), AD-9 (one draft update for linked edits; expansion is data), AD-10 (fail closed: nothing the user did not do and nothing the agent did not send) and AD-13 (one graph; a missing reference is a warning, and the board shows it as an error). UX implemented: EXPERIENCE Molecules (WBS with PERT, Gantt plan), Widgets (Tree), Interaction Primitives (Drag, Explicit acts) and Accessibility Floor (focus and Escape).

## Goals / Non-Goals

**Goals:** no edit of the user's drops estimates or a plan task without a question first; no orphaned plan entry reaches the agent without a warning; the board and the agent's check read one rule from `compute`.

**Non-Goals:** undo of a confirmed edit (Issue #80, `edit-undo`); moving estimates to a new child (open question 1, alternative c); changing CPM so that a parent stands for its leaves (molecules open question 13, alternative); rewriting the agent's plan on an update (open question 4); a question for the agent's own update, which is told by the warning.

## Decisions

### 1. One pure rule for when to ask

A new module `widgets/src/tree/grouping.ts` holds the rule. `grouped(value, edit)` gives the ID of the leaf that an edit would give its first child, or `undefined`. The edit is `{kind: "drop", nodeId, drop}`, `{kind: "indent", nodeId}` or `{kind: "addChild", nodeId}`:

- a drop of kind `into` whose target has no children;
- an indent whose previous sibling has none, read from `locate` as `indent` reads it;
- an "Add child" on a node with none.

The rule takes only an edit the existing checks already allow (`can`, `dropOn`), so a refused drop never asks.

`groupQuestionOf(value, edit, {planned, countDependents})` gives the question, `{label, estimates, task, dependents}`, or `undefined`:

- `estimates` is true when the Tree has `pert` (`isPert`) and the leaf holds a non-null value in `GANTT_PLAN_ESTIMATES`;
- `task` is true when `planned`, that is when `linkedPlans(board, treeId)` is not empty, which `index.tsx` passes in;
- `dependents` is `countDependents([leafId])`;
- there is no question when neither `estimates` nor `task` holds.

*Alternative:* ask from inside `edits.ts`. Rejected: the edits stay pure value-to-value functions that the drag and the buttons share (design decision 5 of `widget-editing-plus`). A question is view state, as the delete question is.

### 2. The question is the delete question's sibling

`group-question.tsx` renders in the toolbar row in place of the tools, as `DeleteQuestion` does: a `fieldset` named by its words, the leaf's label as text (AD-8), the focus on "Cancel" on mount, Escape as Cancel, and "Continue". The toolbar shows at most one question. The widget's `asked` state becomes a union of a delete or a group question, each with the part it came from (`TreePart`), so the focus returns where it was. The words come from new catalog keys. The clauses are joined as the delete question joins `deletedWith`, and the dependents clause reuses `tree.delete.dependsOnIt`.

New keys, appended to `keys.ts`, `en-US.ts` and `it-IT.ts`: `tree.group.becomes`, `tree.group.estimates`, `tree.group.task`, `tree.group.estimatesAndTask`, `tree.group.cancel`, `tree.group.continue`. The texts are in proposal.md, open question 5; the Italian is for the PO to review.

**Layout (pre-PR review 3.3, S-1).** The group question's words are a long catalog sentence (about 750 px in en-US and it-IT), so it is not laid out as the delete question's short tail beside a truncating name. The question is one paragraph that wraps (`whitespace-normal`, `overflow-wrap: anywhere`): the leaf's name first, whole and never cut (a Tree label is at most `TREE_LABEL_MAX_CHARS`, so it wraps like the words), then the words, with no `shrink-0`. "Cancel" and "Continue" sit on a line of their own under it, in the same order, so the focus order is unchanged. While the group question shows, the toolbar row grows from its `spacing.toolbar-row` floor to hold it (its `h-[32px]` becomes a minimum) and returns to it once the question closes. The change counter keeps its place at the row's right on the first line, and nothing passes the row's right edge. This holds at the `viewport-floor` (1,280 px) in a Row beside the plan and beside the `outline-rail`. The delete question keeps its layout: its tail is short and its own classes are unchanged. DESIGN's Tree row records the layout (decision 6).

*Alternative:* a modal dialog. Rejected: the delete question set the inline pattern (tree-widget open question 11), and a dialog in the sandboxed view adds a focus trap for no gain. *Alternative to the wrap:* keep one line and cut the words. Rejected: the dependents count ends the sentence, and the name of the leaf, which for an indent is not the row in focus, is what the user must read.

### 3. Answering re-decides on the Tree as it is

The pending edit is view state, never draft (AD-20): `{edit, from}`. "Continue" runs the same path the edit would have taken with no question (`move`, `dropRow`'s body, or `add`) on the current value. If the edit is no longer possible there (the node gone, or the drop now refused or a no-op), nothing changes, the question closes and the focus goes to the grid or the tool it came from, never to the page body (review 2.5 S-1). While the question is open, a change of the value (the agent's update or the user's own edit) after which the edit no longer makes a leaf a group with something to lose (the leaf gains children, or loses its estimates and its plan link) closes the question with nothing applied, as the delete question does (review 2.5 S-1). A confirmed edit carries nothing new into any plan: the move writes the Tree alone, as today, and "Add child" goes through `linkedAdd` once named, as today. "Cancel" and Escape close the question and return the focus (the dragged row for a drop, the grid or the tool for a key or a tool). A drop that is confirmed is announced with `tree.drag.moved`, as now.

**The question fixes its leaf when it opens (pre-PR review 3.3, X-2).** The pending edit holds the leaf it names, `leafId`, taken from `grouped(value, edit)` when the question opens, and the question's key holds it too. An indent's leaf is the node's previous sibling, which an agent update can change under an open question. So on every value, and again on "Continue", the question is checked against `grouped(value, edit)`. When that is no longer `leafId` (another leaf, or none), or when the question's words would change (the leaf renamed, its estimates, its task or its dependents changed; fix re-review 3.10 X-2, proposed default accepted under the PO's unattended handoff), the question closes with nothing applied and the focus goes as on any close (the grid, or the part the edit came from), as for a drop whose target changed. A question is never re-worded in place, and "Continue" never makes a group of a leaf the question did not name when it opened.

*Alternative:* re-run the question on "Continue" if the value changed. Rejected: the user just agreed to that leaf becoming a group, and an edit that is still possible on that same leaf makes exactly that change. *Alternative to closing:* ask anew, naming the new leaf, with the focus on "Cancel". Rejected: a fieldset whose name changes is not announced, and closing is the rule the delete question and the drop already follow.

### 4. A plan's IDs that are no leaf: one warning each, from `compute`

`planTasks` keeps leaving out of the schedule an entry whose key is no leaf. It now records each such key in a new optional field of `GanttPlanItem`, `strays: readonly string[]` (`compute/src/source.ts`, frozen, in entry order), and keeps not reading the entry's content. `expandGanttPlan` then collects the IDs the plan names that are no leaf, each ID once, in this order:

- each stray;
- then each predecessor of a scheduled task (the entry of a leaf) that names no task.

A stray entry's own predecessors are never read, so they give no warning of their own (gantt-widget open question 10; pre-PR review 3.3, S-2: the texts say "as a predecessor in the entry of a leaf"); the warning about the stray already tells the agent to fix that entry.

**One warning per plan (pre-PR review 3.3, X-1).** The IDs give one warning per plan, as the Table's problems give one per column (`groupColumnWarnings`): `{error: "missing-reference", address: "<plan>.<first ID>", detail}`. The detail names at most `PLAN_STRAYS_NAMED` (5) of the IDs, in the order above:

- one ID: "the plan names <ID>, which is no work package of <workPackages>", the text as before;
- two to five: "the plan names <a>, <b> and <c>, which are no work packages of <workPackages>";
- more: "the plan names <a>, <b>, <c>, <d>, <e> and <N> more IDs, which are no work packages of <workPackages>", with "1 more ID" for one (fix re-review 3.10 S-1).

IDs match `ID_PATTERN` (at most 64 characters), so a detail is at most 500 characters, whatever the plan holds. The constant sits in `cpm.ts`.

It does so only when `leavesOf` found the Tree, since a plan whose work packages name no Tree already warns once. The dependent's own formula error is unchanged (AD-13: the board shows it), so a predecessor that names a removed leaf gives two warnings, the cause at `<plan>.<ID>` and the effect at the dependent's `es`.

**The send-time warnings are bounded (pre-PR review 3.3, X-1).** The send-time check maps each address and text to reference addressing (`schedule.billing`, `wbs`), as before. One warning per plan bounds this change's own warnings by the number of plans, but the contract bounds neither the plans in an ask nor the dependents whose `es` is in error. On `main` a plan of 500 leaves already gives 500 such warnings, 237 KB of JSON. So `formulaWarnings` (`core/src/graph-check.ts`) now bounds the whole list, as `problemsResult` bounds an error's problems ("and N more", `server/src/mcp-tools/results.ts`):

- It keeps the warnings in the graph's order (the expansion's warnings, the plans' among them, first) while the JSON text of the kept list, plus the room for a closing warning, stays within `FORMULA_WARNINGS_MAX_CHARS` = 10,000. The text is measured as `JSON.stringify` gives it, so escapes count.
- When any warning is left out, the last warning is the first one left out, with its `itemId`, `address` and `error` and a message of fixed words: "The formula at <address> is in error (<error>), and <N> more formula warnings are left out." ("1 more formula warning is left out." for one; with none after it, no count, only that its own detail is left out: "The formula at <address> is in error (<error>); its detail is left out.", fix re-review 3.13 X-2, worded at 3.14 so the agent still sees that the list was cut). N counts the warnings after it.
- Its room is reserved up front, `FORMULA_WARNING_CLOSING_MAX_CHARS` = 1,000. That covers an `itemId` of at most 64 characters, an address of at most 256 (the warning schema's `maxLength`, quoted twice), an error kind and a count; the largest possible closing warning takes about 750.
- The list's worst text is therefore 10,000 characters, a third of `RESULT_MAX_CHARS` (30,000). This leaves the ask result's other parts (`no-hooks`, the unresolved pointers, the board link) two thirds; that room is not a bound on them: the unresolved-pointer warnings are unbounded on `main` and here (Risks; Issue #98).
- Under the bound nothing changes, so every existing test and scenario stands.

`checkedFormulaWarnings` returns the bounded list, so `ask` and `update` share it. The constant is `core`'s own, exported for its tests, since no other unit reads it.

AD-13's sentence "the result lists it as a warning naming the item ID (AD-6)" gains, in place, "within AD-6's result bound: past it, one closing warning counts the rest" (decision 6). An `ask` gets the same warning, since it runs the same check. The board's Gantt does not read graph warnings (only the Table does, `widgets/src/table/model/derived.ts:78`, by its own prefix), so nothing new shows on the board. That keeps gantt-widget open question 10's "no row and no warning" for an entry whose leaf the user deleted.

*Alternatives to the bound:* only the per-plan fold. Rejected: the number of plans and of dependents in error is not bounded by the contract, so no worst size could be computed from its limits. Only the cap in `core`. Rejected: a stale plan of 150 IDs would fill the budget with its own warnings and crowd out every other item's. A new warning code, `truncated`. Rejected: it widens the output format for a count that a `formula` warning's message can carry.

*Alternatives:* (a) drop the entry and the predecessors when the plan is expanded or the WBS changes, and warn. Rejected: the board would schedule a plan the agent did not send (AD-10), AD-13 says the board shows a missing reference as an error, and core would have to rewrite one reference when another changes (AD-9: expansion is a pure fill). (b) refuse the `update`, naming the ID. Rejected: AD-13 says a missing reference never refuses, and it would also refuse asks that are valid today. Both need AD-13 amended (open question 4).

### 5. Versions: none

No schema set widens. The `formula` warning with `missing-reference` and a free-text `address` exists since output format 1.3 (`schemas/output/warning.json`), and a new detail text, the per-plan fold and the closing warning's message are no schema change: the closing warning is an ordinary `formula` warning. The view's catalog keys are no contract set. Main's values when proposed: input format 1.12, output format 1.11, tool envelopes 1.12, board document 1.11, board protocol 1.8, Snapshot data 1.1, view manifest 1.1, configuration 1.0. Task 0.2 re-reads them, and the rebase task checks that the diff moves none.

### 6. Documents

- EXPERIENCE, Molecules, WBS with PERT: one sentence after "Dragging a package moves it with its children…", stating the question's rule (decisions 1 to 3).
- CHANGELOG, Unreleased, Fixed: one line per Issue.
- CLAUDE.md: Status, and an "In code since `wbs-gantt-consistency`" paragraph.
- DESIGN, Components, Tree: one sentence on the group question's layout (decision 2).
- The spine, AD-13, The graph: the send-time check's sentence gains "within AD-6's result bound: past it, one closing warning counts the rest", amended in place (decision 4).

The PRD's FR-14 and FR-15 stand as written, and this change follows them.

## Merge points

Read on 2026-11-08 against `origin/main` 8e2e1247, and again for the pre-PR fixes against `origin/main` a8f1d0a0. No change in flight widens a set or modifies a requirement this change modifies. That includes core's "The send-time graph check", now MODIFIED here: `reopen-start-from-answer` (b8a8308c) and `snapshot-toolbar` (e48c40fc), the only open changes with a core delta, touch other requirements, and no branch ahead of `main` edits `core/src/graph-check.ts` or `compute/src/cpm.ts`. Every name borrowed above is on `main` (task 0.2 records each with its file and line).

| Change | Branch, head read | What it touches here | Resolution |
|---|---|---|---|
| `oversized-acts` (#88) | `worktree-fix-oversized-acts` (24 commits on 8e2e1247) | Appends keys to `view/src/strings/keys.ts`, `en-US.ts` and `it-IT.ts`; `chunk-sizes.json` | Keep both sides; appended keys last; re-record sizes |
| `choice-documented-activation` (#87) | `worktree-fix-choice-activation` (20 commits) | `chunk-sizes.json`, EXPERIENCE (other rows) | Keep both; re-record sizes |
| backlog (#89) | `worktree-feature-backlog-issues` | CLAUDE.md moves to `AGENTS.md` | The Status and "In code since" lines go wherever `main` keeps them at the rebase |
| `document-review` | `worktree-feature-document-review` (40 commits, base d6c67d87) | Strings files, `chunk-sizes.json`, EXPERIENCE, CHANGELOG | Keep both |
| `snapshot-toolbar` | `worktree-fix-snapshot-toolbar` 1c235e20 (proposal) | CHANGELOG Unreleased, CLAUDE.md, `chunk-sizes.json` | Keep both |
| `reopen-start-from-answer` | `worktree-fix-reopen-start-from-answer` (being proposed) | Two string keys; the UJ-2 revision scenario (linked Tree and plan seeded from the answer) | Keep both; a revision's draft is seeded before any group question, so the two do not meet |
| `keyboard-shortcuts-help` | `worktree-feature-keyboard-help` (3 commits, base 47f3c370) | The Tree's `model/keys.ts` (`BINDINGS`), `toolbar.tsx` tooltips, its key inventory | This change adds no key and does not edit `keys.ts`. It does change what Alt+Shift+ArrowRight and "Add child" may do (ask first), and it adds a question whose Escape cancels, which that change's inventory should list. Whichever merges second updates the inventory and resolves `toolbar.tsx` by keeping both |
| Widget proposals: `graph-widget`, `spreadsheet-widget`, `diagram-widget`, `diff-review`, `image-annotation` | `worktree-feature-graph`, `-spreadsheet`, `-diagram`, `-diff-review`, `-image-annotation` | `compute` (the spreadsheet's `BOARD_SOURCES` entry and `source.ts`; graph's compute-spec change), the compute spec, `chunk-sizes.json`, CHANGELOG | Different requirements and lines (no one edits `planTasks`, `cpm.ts` or `GanttPlanItem`); keep both in `source.ts` |

## Risks / Trade-offs

- [An `ask` or `update` with many unresolved pointers passes AD-6's result bound] → One `unresolved-pointer` warning per item, each pointer up to 1,024 characters, with no count limit (40 excerpts give 47,901 characters; fix re-review 3.10). It is on `main` and this change does not make it worse; deferred to Issue #98.
- [Existing browser and unit tests indent, drop into or add children to estimated UJ-2 leaves and now meet a question] → Task 0.2 lists them with `grep`, and each group updates its own files to confirm, so that no unexpected failure shows up later.
- [Two warnings for one removed predecessor] → The cause and the effect, at different addresses. The core test that counts one warning for a predecessor that names no task (`core/test/widget-graph.test.ts:33`) moves to two, and its scenario's text still holds.
- [A question breaks UJ-2's flow] → Splitting is "Add node", which never asks. Only a child under an estimated leaf asks (open question 2).
- [A confirmed group leaves its dependents in error] → This is the documented rule. The question says how many tasks are affected, and the panel lets the user uncheck the predecessor (open question 3).
- [A capped list hides formula errors the agent should fix] → The closing warning names the first problem left out and counts the rest. The cap starts only past 10,000 characters, about 35 warnings, and the plan's own warning comes first in the graph's order. A board that holds that many errors is the agent's to resend, and every node still reads as its error on the board.
- [`tree` chunk growth] → One small module and one component. The build fails above 10% (`chunk-sizes.json`); re-record if it moves.

## Open Questions

None beyond the PO's, in proposal.md (Open questions for the PO), all at their proposed defaults under the PO's unattended handoff. Task 0.1 records them.

The pre-PR review (3.3) left two items unconfirmed. Neither needs a probe:

- What the agent's host does with a tool result far above 30,000 characters. The bound of decision 4 does not depend on it: AskBoard keeps its own results within AD-6, whatever the host does.
- Whether the real board page at the 1,280 px floor, beside the outline rail, leaves the toolbar narrower than the review's proxy. Task 3.7 measures it on the session process.

The decisions taken on the review's findings (X-1's bound, S-1's layout, X-2's fixed leaf, S-2's narrowed texts) are proposed defaults accepted under the PO's unattended handoff.
