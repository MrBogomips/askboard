# Proposal

## Why

The Tree, the Gantt, the molecules and E3's ask lifecycle each build their half of a widget question, and each hands the same remainder to "the input format widening": no agent can yet put a widget or a molecule reference in an ask, the board page refuses every widget answer on purpose, and `ask-core` never computes `changes` or records `derived` (`tree-widget` proposal, open questions 1 and 20; `gantt-widget` design, Handed on; `molecules` proposal, open questions 1 and 18; E3 design, Handed on). This change connects them, so that an agent sends UJ-2's ask as the approved example writes it and reads back the approved answer through `collect` (FR-11, FR-12, FR-15, FR-18, FR-20; AXFX FR-38 and FR-40 in part). It is the last step before the widgets AXFX needs first are usable end to end (SOLUTION-DESIGN §3.1, build order).

## What Changes

- **`contract`, the next minor of five sets, on top of what `main` holds after E3, E5, E7 and E8:** input format 1.3 to **1.4**, output format 1.2 to **1.3**, tool envelopes 1.3 to **1.4**, board document 1.3 to **1.4** and board protocol 1.4 to **1.5**, adding only optional fields, enum values and schemas (E1 design decision 2; design decision 1).
  - The Tree's, the Gantt's and the molecules' standalone schemas join the sets where they stand: `tree-props`, `gantt-props`, `molecule-props` and `molecule-definition` the input format, `tree-changes` and `gantt-changes` the output format. `schemaSetProblems` checks their owner and version as set parts, and their validators move from `widgetValidator` to `validateAgainst`. Only a molecule's own parameter schemas, which ship as data in `molecules`, stay on `widgetValidator`.
  - A question's `items`, which E5 added for excerpts, references and images, also take Tree and Gantt items and molecule references, beside its options or instead of them (F1). The board document's questions hold the expanded widget items, never a reference.
  - Props problems reach the agent worded by E1's request validation (`src/requests.ts`, `src/problems.ts`), naming the item, the element and the field, through the widgets' own checks (`widgetItemProblems`).
  - The board protocol's `answer` act carries `values` (each changed widget item's full edited props) and `derived`; the board state carries a widget answer's logged `values`.
  - The output format gains a `formula` warning and an answer event's `tooLarge`. The tool envelopes let `fetch` return a widget item, a reference under its own ID, and an answer's `values` and `derived`; `update`'s result already takes warnings (E5), so only the warning code is new.
  - The approved `uj2-wbs-gantt` ask and answer validate against the full contract.
- **Board page and view:** the board page's refusal of widget answers, built on purpose by `tree-widget`, is lifted on E3's `act` path; E1's `answer` command stays choice-only for protocol 1.0 pages. An answered widget question shows the logged value, read-only, with its receipt, and a reload or takeover restores it from the board state. The Tree, Gantt and UJ-2 scenarios run through the real board page.
- **`ask-core`:** `ask` and `update` expand molecule references through a `MoleculeSource` port before storing a board document, keep the expansion map beside it, and run AD-13's send-time graph check, its warnings in reference addressing. An answer with widget values is checked with the widgets' checks, stored in full (AD-20), diffed with the contract's `elementChanges` and each widget's shape, and logged with its `changes` and checked `derived`, all in reference addressing, through the molecules change's fold. `fetch` returns a widget question's answer in full, a widget item alone, or a reference under its own ID. An `update` that changes a reference re-expands it whole. The Snapshot gathering E7 merged takes the stored full values and the expansion map from it.
- **`mcp-tools` and the session process:** the `ask` and `update` results carry the graph's warnings; `fetch` takes a widget item or reference ID; `main.ts` composes `createMoleculeSource()` into the core's ports.
- **Tests:** test-driven, `bun test` at 80% per file; browser scenarios in Chromium, Firefox and WebKit on the real board page; an end-to-end scenario on the real session process, on Bun and Node 24, in which an agent asks UJ-2's question through the MCP tools and gets back the approved UJ-2 answer through `collect`.
- **Documents:** `prd-update-draft.md` (FR-20: an answer too large for one result) and `spine-update-draft.md` (AD-20: when `changes` are computed and the too-large rule; AD-9: `fetch` in reference addressing), both applied on 2026-11-01, after the PO accepted their open questions (9, 10, 11 and 16).
- **Not in this change:** a shipped skill and any change to the approved tool descriptions or instructions (open question 15); widget values in an answer the agent records (open question 13); Table, Approval, Diff review, Graph and the other widgets, so the approved `uj1` and `uj3` asks stay refused, naming their item types; excerpts (E5, merged: a question's context items stay as they are); Snapshots (E7, merged: this change only fills the gathering's `events[].values` and `molecules`); push of widget answers, which E4 (merged) delivers from the same log with no change here.

## Capabilities

### New Capabilities

None: every behaviour belongs to a capability E1 created.

### Modified Capabilities

- `contract`: input 1.4, output 1.3, tool envelopes 1.4, board document 1.4 and board protocol 1.5; widget and molecule schemas in the sets; widget props problems for the agent; the `formula` warning; the too-large answer; the approved UJ-2 example validating whole.
- `core`: expansion and the send-time graph check on `ask` and `update`; widget answers checked, stored, diffed and logged with `derived`; the too-large rule; full values of widget questions, widget items and references; changing an item inside a question.
- `mcp-adapter`: warnings in `ask` and `update` results; `fetch` of widget items and references; widget answers in `collect`.
- `board-host`: widget answer acts and the logged values in the board state; the molecule source composed into the session process.
- `view-and-widgets`: widget answers sent by the board page, answered widget questions, revisions and restore, the scenarios on the real board page.

The deltas modify requirements that E1, `ask-lifecycle`, `tree-widget`, `gantt-widget` and `molecules` add, so this change is archived only after those five.

## Impact

- **Depends on** (met on 2026-11-06: all four changes, and E4, E5, E7 and E8 after them, are on `main`; the branch is rebased onto it) (task group 0, design decision 2): `ask-lifecycle` (E3), `tree-widget`, `gantt-widget` and `molecules`, each merged to `main`; this branch then rebases onto `main`, and group 0 checks every name the design borrows, stopping for `/opsx:update` if one differs. The Tree and Gantt parts could start once E3, `tree-widget` and `gantt-widget` have merged, before `molecules` (open question 2).
- **Code:** `packages/contract` (set modules, `sets.ts`, `requests.ts`, `problems.ts`, the widget validators, new schemas' `$ref`s, fixtures); `packages/core` (ports, the ask aggregate's answer and full-value paths, expansion and graph calls); `packages/server` (`mcp-tools`, `board-host`, `main.ts`); `packages/view` (board page model, the shell's answered state); `packages/view/chunk-sizes.json`; tests under `packages/*/test/`, `packages/view/test/browser/` and `packages/server/test/conformance/`.
- **Dependencies:** none added.
- **Other changes:** builds on E3's `act`, draft record, `view-document.ts` and `fetch` without redefining them (design decision 1); calls the molecules change's `expandMolecules`, `referenceAddressing` and `answerInReferenceAddressing` as its "Handed on" says.
- **CI:** the e2e job grows by the UJ-2 browser and conformance cases; no new job.
- **Requirements served:** FR-6 (changing widget items and references), FR-11 (each widget returns a typed answer), FR-12 (derived values as they stood), FR-14 (formula errors reported at send time), FR-15 (molecules by name, data only), FR-18, FR-19 (who and when on widget answers), FR-20, NFR-1, NFR-5, NFR-10; AXFX FR-38 and FR-40 in part.

## Open questions for the PO

The PO is away and asked every session to keep working. Each question records the narrowest choice and why; the change proceeds with it, and an answer that reverses one stops the work for `/opsx:update` (task 0.1). The PO answered on 2026-11-01 and accepted every open question as proposed.

1. **The next minor after `main`'s, and wait for E3.** E3's d14c58d took the five sets to 1.1, and E5, E7 and E8 moved them on; after the rebase of 2026-11-06 this change takes the next minor of each (input 1.4, output 1.3, tool envelopes 1.4, board document 1.4, board protocol 1.5). If E3 has not merged when this change starts, group 0 waits and rebases onto it. *Why:* the widening builds on E3's `act`, draft record, several-question view document and `fetch`; taking 1.1 itself would redefine them. *Alternative:* take 1.1 and leave E3 to renumber on its rebase, which E3's design decision 2 allows but which here means rebuilding E3's answer path on E1's `answer` command.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
2. **No early start.** Group 0 waits for all four changes. *Why:* one rebase and one name check. *Alternative:* start the Tree and Gantt parts (groups 1 to 3 without the molecule tasks) once E3, `tree-widget` and `gantt-widget` merge, and the molecule tasks after `molecules`.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
3. **Schemas join the sets where they stand.** The set modules list `src/widgets/tree/*.json`, `src/widgets/gantt/*.json` and `src/molecules/*.json` in their `schemas`; no file moves. *Why:* a move would break the three changes' imports for no behaviour. *Alternative:* move them under `src/schemas/input/` and `output/`, as E1's layout has one folder per set.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
4. **Molecule parameter schemas stay outside the sets.** Each definition's `parameters` (`urn:askboard:molecule:<name>:<major>`) is data in `molecules` and keeps `widgetValidator`; every other widget schema moves to `validateAgainst`. *Why:* AD-7's table has no set for per-molecule data, and the molecules change drafts AD-6 to keep them there.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
5. **A question holds options, items or both.** `options` becomes optional when `items` is present; a question needs one of the two. *Why:* F1 and the `tree-widget` view document already read it so, and UJ-2's `plan` has no options.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
6. **Three item types in a question.** `tree`, `gantt` and `molecule`; any other type is refused, naming it, so `uj1` and `uj3` stay refused. *Why:* only these have schemas and components.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
7. **What an answer's values must be.** Each key names a widget item of that question, as an own property; each value passes its widget's checks as an edited value, in the question as edited (a plan's link to its Tree included); an item whose value equals the sent one adds nothing; an answer with no choice, no "Other…" text and no change is refused. *Why:* AD-10 (untouched content is unchanged, never a chosen value) and E3's "at least one" rule.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
8. **`derived` is checked, not recomputed.** `ask-core` keeps the view's derived values after checking that each key addresses a widget item of the question and a derived field its widget declares (`GANTT_ANSWER_DERIVED`, the WBS's declarations), with a JSON value. *Why:* AD-13 has the view compute them as they stood; `compute` is deterministic. *Alternative:* `ask-core` recomputes them with `buildGraph` and refuses an answer that disagrees.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
9. **`changes` computed once, when the answer is appended.** Stored in the immutable event, so `collect` and E4's push read the same text. *Why:* events never change (AD-3). The molecules design names `collect` as the caller of the fold; the function is the same, called earlier.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
10. **An answer too large for one result.** When an answer event with its `changes` and `derived` exceeds `ANSWER_EVENT_MAX_CHARS` (24,000), it carries neither and `tooLarge: true`; `fetch` returns them. *Why:* FR-20's consequence that no answer exceeds a tool result, which the Tree's 500 nodes can break; drafts for FR-20 and AD-20. *Alternatives:* refuse the answer on the board; omit only `changes`.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
11. **`fetch` of a widget item or a reference.** `fetch` takes the ID of a widget item or molecule reference in a question and returns that item alone, as the user left it (the latest answer's value, else as sent); a reference comes under its own ID, with the expanded item's type and props, each `item`-fill slot given back as the reference's ID. *Why:* FR-20 ("any answered item") and AD-9 (the agent never sees expanded IDs); spine draft for AD-9. *Alternative:* questions only, the agent reading `values` from the question's answer.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
12. **Changing an item inside a question.** `update` `change` with the ID of a widget item or reference merges its props key by key, re-checks them, re-expands a reference whole and raises its question's `rev` (AD-20); adding or deleting an item inside a question goes through a `change` of the question's `items`. *Why:* AD-20 already counts a change to an item inside a question. *Alternative:* `add` and `delete` with `parentId` naming a question.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
13. **Recorded answers carry no widget values.** E3's `update` `answer` stays `choice`, `other` and `note`. *Why:* AD-10's recorded answers are what the user said in the terminal, where no widget is edited. *Alternative:* `answer.values`, diffed like a board answer.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
14. **The board state carries `values`, not `derived`.** The view recomputes derived values from the logged values. *Why:* one source for each value; the graph is deterministic.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
15. **No skill yet.** The approved tool descriptions and instructions, which E3 serves whole, already speak of widgets and molecules and point to "the askboard skill"; no PRD or spine line puts the skill in this step, and agents learn props from the worded problems meanwhile. *Why:* the skills capability generates its references from the sets this change completes (AD-6). *Alternative:* a minimal `askboard` skill with Tree, Gantt and molecule references and AD-6's drift check.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
16. **Revised widget answers diff against what the agent sent.** A revision's `changes` are from the revision the answer names, not from the answer it replaces. *Why:* AD-20 and FR-20 define `changes` against the agent's content, and the latest answer wins whole. *Alternative:* changes against the replaced answer.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
17. **The agent-change notice on a widget names what changed, not how.** E3 hands this change "the agent-change notice's diff for a widget's value". When the agent changes a widget item under unsent work, "Show the agent's change" lists each changed widget item by its type's name with the number of element operations the contract's diff gives between the two revisions; "Reload" and "Keep mine" are E3's. *Why:* EXPERIENCE records no element-level view of an agent's change to a widget. *Alternative:* the agent's operations shown as text, or marked inside the widget.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
