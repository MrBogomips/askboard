# Design

## Context

See proposal.md for why this change comes now and what it leaves out. What the code will start from, once group 0 has rebased onto `main` with the four changes merged (names as their branches hold them on 2026-10-31; group 0 checks each):

- **E1 on `main` (92ca203):** six schema sets at `1.0`, each a folder under `packages/contract/src/schemas/` listed in `sets.ts` (`SCHEMA_SETS`, `SCHEMA_IDS`), compiled once by `createAjv` (`compiled.ts`), checked by `schemaSetProblems` (owner from AD-7's table, `major.minor`, `$id` in `urn:askboard:<set>:`, no root combinator, strict compile); `validateAgainst` and `validateVersioned` in `validate.ts`; request validation in `requests.ts` with the wording tables of `problems.ts` (`Wording`, `problemAt`, `schemaProblem`, `inDocumentOrder`). `ask-core`'s `Ask` aggregate and `AskCore` with the ports `BoardAddress`, `BoardShowing`, `Identity`, `Randomness`, `Report`. The conformance suite (`packages/server/test/conformance/`) drives the built bundle over stdio on Bun and Node 24 and answers on the real board page in Chromium; the browser suite (`packages/view/test/browser/run.ts`) runs the three engines against the test server or, with `--target session-process`, the built session process, sending the ask `harness/scenario-ask.ts` picks.
- **`ask-lifecycle` (E3), branch `worktree-feature-ask-lifecycle` at 5f87f8f:** the five sets at `1.1` (d14c58d): several questions and areas (`LifecycleAskInput`), the `update` request, `fetch`'s result and pages, the board protocol's `act` with its `answer` act whose content fields are all optional so that `values` and `derived` can sit beside them, `done`, the draft record whose per-question `values` are opaque JSON by item ID, and `closed`. `ask-core` applies acts once per action ID and atomically, keeps revisions, the full value of an item for `fetch` (with a generation counter for pages) and a `Clock`. Its view takes the `tree-widget` seams as given, applies their refusal of widget answers to every act, and hands "values and derived on the answer act, the logged state of a widget answer, changes from `ask-core`, and the agent-change notice's diff for a widget's value" to this change (its design, Handed on).
- **`tree-widget`, branch `worktree-feature-tree-widget` at 8da0c44:** the widget-neutral seams (`elementChanges` and `applyElementChanges` over `ElementShape` in `src/widgets/element-diff.ts`; `widgetValidator` in `src/widgets/validator.ts`; `ItemProps`, the draft record with one value per item, `view-document.ts`, `ViewAnswer.values`; `answerCommandFor` in `board-page/model.ts` refusing an answer with `values` or without `choice`; widget chunks; the widget host). The Tree: `tree-props.json` (`urn:askboard:input:tree-props`), `tree-changes.json` (`urn:askboard:output:tree-changes`), `validateTreeProps(value, origin)`, `validateTreeChanges`, `TREE_SHAPE`, `treeBoardDocument`.
- **`gantt-widget`, branch `worktree-feature-gantt-widget` at 65d9be5 (groups 5 to 7 still to come):** `gantt-props.json` and `gantt-changes.json`, `validateGanttProps`, `ganttShape(props)`, `ganttPlanLinkProblems`, `GANTT_ANSWER_DERIVED` (`finish`, `criticalPath`); `compute`'s `boardGraphSource(items)`; and, from groups 5 to 7, the port's `board` and `onDerived`, `ViewAnswer.derived`, the `compute` library chunk and `gantt-plan.json`.
- **`molecules`, branch `worktree-feature-molecules` at 65491c0 (proposed):** `molecule-props.json` and `molecule-definition.json`, `moleculeDataValidator(definition)`, `widgetItemProblems(item, question, origin)` and `elementShapeOf(item)` in `src/widgets/items.ts`, `TREE_PERT_ANSWER_DERIVED`; in `ask-core` the `MoleculeSource` port (not yet in `CorePorts`), `expandMolecules(items, source)` giving `{items, map, problems}`, `referenceAddressing(map)` and `answerInReferenceAddressing(map, question, sentItems, editedValues, derived)`; `createMoleculeSource()` in `packages/server/src/molecule-source/`; the fixtures `uj2ExpandedQuestion`, `uj2ExpandedBoardDocument`, `uj2ExpandedEditedValues` and `uj2ExpandedDerived`.

ADs this design relies on: AD-1, AD-3, AD-6, AD-7, AD-9, AD-10, AD-12, AD-13, AD-20, AD-21. UX sections it implements: EXPERIENCE Interaction Primitives (Explicit acts only, Delivery, Revisions, Live computation); State Patterns (By surface: Question, Answered and its receipt; Question, Changed by the agent; Widget, No user changes and Formula error; What a reload keeps); Component Patterns (Question card: Answer, Delivery receipt; Changes, values and board states: Agent-change notice); Key Flows (UJ-2, steps 1 to 3). DESIGN.md: Components (Question card; Changes, values and board states), under the same names. The widgets' own looks are their changes'.

## Goals / Non-Goals

**Goals:**

- One path for every widget answer, the same for a plain Tree and for an expanded molecule: the board page sends full values, `ask-core` checks them, stores them, diffs them and logs `changes` and `derived` in reference addressing.
- Build on E3's `act`, draft record, `fetch` and view document and on the widget and molecule changes' functions, adding none beside them.
- Fail closed at every new boundary: a widget value the question cannot hold, a derived key no widget declares, an edit the diff cannot express and an expanded ID reaching the agent are each refused or rewritten, never passed through.

**Non-Goals:**

- New widgets, new molecules, or any change to a widget's look or edit model.
- Recomputing derived values in `ask-core` (proposal, open question 8).
- Excerpts in molecules (E5), Snapshots (E7), the skills, and the agent recording widget values.

## Decisions

### 1. Versions: the next minor after E3's, five sets at 1.2

E3's d14c58d takes input, output, tool envelopes, board document and board protocol to `1.1`; E3's design decision 2 lets whichever change merges second take the next minor for the sets both touch. This change touches the same five and takes **1.2** for each. Each minor only adds optional fields, enum values and schemas, so E1's rule holds: a receiver on 1.1 refuses a 1.2 field as a schema error, and the board page and `board-host`, built together, send a new field only when both accept it.

**Ordering.** Group 0 waits for E3 to merge, then rebases (proposal, open question 1). Nothing here redefines what E3 owns: the draft record keeps E3's shape (its opaque per-item `values` already carry widget drafts), `view-document.ts` keeps E3's several-question shape (this change only checks, with a type test, that board document 1.2 is assignable to it), and the `answer` act keeps E3's optional `choice`, `other`, `optionNotes` and `note`, with `values` and `derived` added beside them. E3's "at least one" content rule moves into `ask-core` as "at least a label, 'Other…' text or a widget change" (core spec).

*Alternative:* take 1.1 if E3 has not merged. Rejected as the default: the widening would have to carry widget answers on E1's choice-only `answer` command and build its own `fetch`, both of which E3 replaces.

### 2. Base and order: group 0 waits for the four changes

Task 0.1 records the PO's answers; task 0.2 waits until `ask-lifecycle`, `tree-widget`, `gantt-widget` and `molecules` are merged to `main`, rebases (`git rebase origin/main`), and checks with `git grep` and their tests every name Context lists. A name or behaviour that differs stops the work for `/opsx:update`; no code works around it. Every later group edits files those changes create, so nothing starts before group 0 (proposal, open question 2, names the earlier start for the Tree and Gantt parts).

### 3. The widget schemas join the sets where they stand

The set modules (`schemas/input/index.ts`, `schemas/output/index.ts`) import the widget and molecule schema files from `src/widgets/tree/`, `src/widgets/gantt/` and `src/molecules/` and list them in their `schemas`; `SCHEMA_IDS` gains `treeProps`, `treeChanges`, `ganttProps`, `ganttChanges`, `moleculeProps` and `moleculeDefinition`. `schemaSetProblems` then checks their owner and version, and `createAjv` compiles them with the rest. `validateTreeProps`, `validateTreeChanges`, `validateGanttProps`, `validateGanttChanges`, `validateMoleculeProps` and `validateMoleculeDefinition` keep their signatures and call `validateAgainst(SCHEMA_IDS.<x>, value)` before their checks; `widgetValidator` stays only for `moleculeDataValidator`, since a definition's `parameters` is data in `molecules` (proposal, open questions 3 and 4).

- **Question props** (`question-props.json`, 1.2): `options` loses `required`; `items` is an array of `$defs/item`, `{type, id, props}`, picked by `type` with Ajv's `discriminator` (on in every contract Ajv since E3): `tree` → `tree-props`, `gantt` → `gantt-props`, `molecule` → `molecule-props`. "Options, items or both" is a check in code, since a conditional at the schema root is a combinator.
- **Board document** (1.2): its question `$defs` takes `items` of `tree` and `gantt` only; `molecule` is not an option there.
- **The board page's validators** are generated from the sets by the view build, so they now hold `tree-props` and `gantt-props`; the board page chunk grows, and its size is recorded in the task that first builds it.
- **`"sideEffects": false` holds:** a set module imports JSON and registers nothing; the widget chunks keep importing only the checks they use.

*Alternative:* move the files under `src/schemas/input/` and `output/`. Rejected: a move breaks three changes' imports and tests for no behaviour.

### 4. Request validation: one walk, the widgets' own checks, E1's wording

`validateAskRequest` (and `update`'s `add` and `change`, which share E3's `ask-items.ts` walk) gains, per question: the "options, items or both" check; the ask's ID rules over each widget item's and reference's ID (unique in the ask, `u-` refused); and, for each `tree` and `gantt` item, `widgetItemProblems(item, question, "agent")`, which runs the widget's own checks, a plan's link to its Tree included. The link is checked against its own question's items, with `ganttPlanLinkProblems(item, question)`, never against the board's: the Gantt's plan component checks its link against the port's `board.items`, which are flattened with no question boundaries, so this send-time check is what enforces the gantt-widget's rule that a plan's Tree is in its question (its design decision 9). A plan naming a Tree of another question is refused when the ask is sent, and when `update` adds or changes it. A reference's props are checked by the schema; its data, which needs the definition, is `ask-core`'s (decision 5).

Problems are worded by E1's `Wording` tables: `requests.ts` gains the expected shapes and field lists for `items[].props.items[]` and each widget's props, so that a schema error inside a Tree reads like any other (`item "wbs", props.nodes[0].label is required: …`). A widget check's problem, which already names the node or task and the field, is located under its item with `problemAt`, so it gains the item ID and sorts in document order. The agent learns a widget's props from these problems until the skill exists (proposal, open question 15).

### 5. `ask-core` on `ask` and `update`: expand, store, check the graph

- **Port.** `CorePorts` gains `molecules: MoleculeSource`; `main.ts` composes `createMoleculeSource()` into it. The adapter reads imported JSON only and does nothing before its first lookup (AD-2, AD-11).
- **Expansion.** After validation, `ask` calls `expandMolecules(items, ports.molecules)`; any problem refuses the request with problems in reference addressing, and nothing is created. The board document's revision holds the expanded items, and the `Ask` keeps `map` beside each revision, as the molecules design asks.
- **Resend.** The resend rule compares the request as the agent sent it (E1's RFC 8785 text), never the expanded items.
- **Graph check.** `ask-core` calls `compute`'s `boardGraphSource` over the board's expanded items, then `buildGraph` (AD-1 allows `ask-core` → `compute`). Each graph warning becomes `{code: "formula", itemId, address, error, message}`, mapped by `referenceAddressing(map)`, and joins the `ask` result's warnings beside the no-hooks warning. A graph problem never refuses (AD-13).
- **`update`.** `add` of a question with items runs the same steps. `change` naming a widget item or reference merges its props key by key, re-checks them, and re-expands a reference whole, replacing its expanded item and its map entry; any change raises the question's `rev` (AD-20) and is refused for an answered question, as E3 refuses any change (proposal, open question 12). The `update` result carries the graph check's warnings for the board as changed.

### 6. A widget answer: check, store, diff, log

E3's `act` applies an `answer` act on a copy, then appends. For an answer with `values` or `derived`, the act's check gains, in order, each refusing with the item named:

1. Every key of `values` is an own property naming a `tree` or `gantt` item of the answered question in the revision the answer names.
2. Each value passes `widgetItemProblems` with origin `edited`, in the question with every edited value in place, so a plan's link is checked against the edited Tree.
3. For each item, `changes = elementChanges(itemId, sentProps, editedValue, elementShapeOf(item))`, where `sentProps` are its props in the revision the answer names; then `applyElementChanges(itemId, sentProps, changes, shape)` must deep-equal the edited value. A value that the changes do not rebuild, such as one that edits a Tree's `columns` or a plan's `start`, is refused: the agent would otherwise get `changes` that miss part of what the board sent.
4. Items whose `changes` are empty drop out; with no choice, no "Other…" text and no item left, the answer is refused as one with no content (AD-10: untouched content is unchanged, never a chosen value).
5. Every `derived` key is a reference whose item is a widget item of the question and whose field the widget declares in its answer declarations (`GANTT_ANSWER_DERIVED`, `TREE_PERT_ANSWER_DERIVED`), and each value is JSON (proposal, open question 8).

Then `answerInReferenceAddressing(map, question, sentItems, editedValues, derived)` gives the event's `changes` and `derived` in reference addressing, computed once, at append (proposal, open question 9). The full edited values and the derived values as sent are stored on the question's answer, apart from the log; the event carries only `changes` and `derived` (AD-20). A revision is diffed against the revision it names, never against the answer it replaces (proposal, open question 16).

**The too-large rule.** The event is serialized as `collect` will return it; if it exceeds `ANSWER_EVENT_MAX_CHARS` (24,000, the same budget as a `fetch` page), it is logged without `changes` and `derived` and with `tooLarge: true` (proposal, open question 10). A contract test checks the arithmetic: the largest `collect` envelope E3 allows, with `COLLECT_ASKS_MAX` entries and one event of that size, stays under `RESULT_MAX_CHARS`.

*Alternative for step 3:* trust the board page's value outside the elements. Rejected: the board page is AskBoard's code, but a token holder can send any act (SOLUTION-DESIGN §6), and the check costs one apply.

### 7. `collect`, `fetch` and the board state

- **`collect`** returns the logged events unchanged; E3's pager already treats one command's events as one unit, and the too-large rule keeps each event within a page.
- **`fetch` of a question** returns E3's full value with the answer's `values` keyed by item ID and its `derived`, everything in reference addressing: an expanded item appears under its reference's ID with its expanded type and props, and each slot an `item` fill wrote (the plan's `workPackages`) names the reference again. The slots come from the definition's `fills` (`map` names the molecule and version; the port gives the definition), so the rewrite is declarative, the inverse of the `item` form only; no other value is touched.
- **`fetch` of a widget item or reference** (proposal, open question 11) returns that item alone, as the user left it: the latest answer's edited value, else the value as sent, with its question's ID and state, through the same rewrite. `validateFetchRequest` already accepts any ID; the core resolves it among the questions' items and the map's references, and an expanded ID such as `wbs__tree` is an unknown item, since the agent never sent it. Pages and generations are E3's; an answer, a revision or a change of the item raises the generation.
- **The board state** (`board-host`) carries, in a question's current and previous answer, the logged `values` by expanded item ID, and no derived value (proposal, open question 14): the view recomputes them from the graph, as it did while the user edited.

### 8. The board page and the view

- **Lifting the refusal.** E3's board page builds an `act` from the view's answer message. The seam's refusal (`answerCommandFor` refusing `values` or a missing `choice`) is removed from the `act` path: an answer with `values` and `derived` becomes an `answer` act carrying them, after the checks every answer passes (open question, at its revision, visible, no failed item) and one more, that every `values` key names a widget item of that question. E1's `answer` command, sent only to a protocol 1.0 host, keeps refusing widget values. The seam's test that a board document holding a Tree is refused flips to accepting it, and one holding a `molecule` item is still refused.
- **Answered widget questions.** When the board state holds a logged answer with `values`, the shell passes each widget its logged value as the port's `value`, with `disabled: true`; the draft holds nothing for it. A reload or a takeover restores it from the state `board-host` sends on connect (EXPERIENCE, What a reload keeps).
- **Revising.** E3's revision path makes the question editable; for a widget question the draft starts from the logged values, the change highlight still compares with the agent's original (the board document's props), and "Answer" sends the full edited values again.
- **The agent-change notice on a widget question** (E3 handed its widget diff here): when a new revision changes a widget item under unsent work, the notice's "Show the agent's change" lists, per changed widget item, its type's name and the number of element operations the contract's diff gives between the two revisions; "Reload" and "Keep mine" are E3's. An element-level view of the agent's change waits for EXPERIENCE to record one (proposal, open question 17).

### 9. Tests

- **Unit** (`bun test`, 80% per file): the five sets at 1.2 and the schema checks over the joined schemas; the "options, items or both" check and every widget props problem's wording against the spec's scenarios; the answer act, board state and fetch result schemas; `ask-core`'s expansion call, map per revision, resend over the sent request, graph warnings in reference addressing, each refusal of decision 6 (one test per step, each asserting the log is unchanged), the round-trip check, the too-large rule with a 500-node Tree, `fetch` of a question, a widget item, a reference and an expanded ID, and `update` `change` of a reference; `mcp-tools` results and errors against a fake core; `board-host` against a recorded widget-answer transcript appended to E3's (refused act, state with `values`, reconnect).
- **Browser** (Chromium, Firefox and WebKit, no CSP violation, on the real board page, `--target session-process`): `harness/scenario-ask.ts` gains the asks of the Tree, Gantt and UJ-2 fixtures; the `tree-widget`, `gantt-widget` and `molecules` scenarios that end in an answer run again through the real board page; an answered widget question after a reload and a takeover; a revision; the agent-change notice on a widget question; an answer for an item of another question refused.
- **End to end** (conformance suite, built bundle on Bun and Node 24, real board page in Chromium): an agent sends `asks/uj2-wbs-gantt.json` unchanged through the MCP client; the user makes the approved edits by keyboard, marks `plan` ready, postpones `erp-export` and submits; `collect` returns one result that matches `answers/uj2-wbs-gantt.json` once the epoch, cursors, `who` and `when` are normalized as E1's suite does, the `changes` compared as a set and the `derived` as a map; `fetch` of `wbs` and `schedule` returns the edited values with no expanded ID.

## Risks / Trade-offs

- [One of the four changes merges with names or behaviour other than Context's] → Task 0.2 checks each name and stops for `/opsx:update`; no code works around a difference.
- [The board page's standalone validators grow with `tree-props` and `gantt-props`] → The size is recorded with `--record-sizes` in the task that first builds it; if the growth passes the build's margin, the commit says why.
- [`discriminator` needs the `type` property required and each branch's `type` a `const`] → E3 already runs every contract Ajv with it; the question-props schema test compiles the item union in strict mode first.
- [The round-trip check refuses a value the widget model may legitimately produce, such as a keyed entry left empty] → The Tree's and Gantt's models never keep an empty entry or change props outside their elements (their specs); a browser scenario per widget answers after every edit kind and asserts the act is accepted.
- [The derived-value check accepts a wrong number the view computed] → Accepted (proposal, open question 8): `compute` is deterministic and runs the same fixtures under two time zones and two locales; the alternative is recorded.
- [A board-state message carrying full values for every answered question grows large] → Bounded by the Tree's and Gantt's limits and well under the draft record's 2,000,000 characters; the board document already carries the same items.
- [The `item`-fill rewrite misses a slot a future fill form writes] → The rewrite reads the definition's fills, so a new form fails the expansion's own tests until its inverse is written; format 1.0.0 has only `item` writing an ID.
- [The UJ-2 end-to-end scenario is slow under Node 24 and Playwright] → It runs once per runtime in the existing e2e job; its time is recorded in the task's note.

## Migration Plan

None: nothing has been released. Reverting the change returns the sets to E3's 1.1, the board page to refusing widget answers and `ask-core` to refusing widget items, which the three changes' own tests check.

## Handed on

- **The skills capability:** the `askboard` skill the approved `ask` description names, its Tree, Gantt and molecule references generated from the sets this change completes, and AD-6's drift check (proposal, open question 15).
- **E4 (`push-delivery`):** pushes widget answer events from the same log; the too-large rule keeps each within a result.
- **E5:** excerpts per work package, which the expansion still omits.
- **E7:** Snapshots read the logged `changes` and the stored full values, through the read-only accessor `AskCore.keptAnswerValues(askId)` (task 2.4): per answer event with widget values, by its cursor, the full edited values by item ID in reference addressing, as E7's proposal (open question A2) puts them in `events[].values`. E7 names the requirement ("Widget answers stored in full") and no accessor, so the name is this change's, after E3's `AskCore.keptRevisions(askId)`.
- **A later UX decision:** an element-level view of the agent's change to a widget (proposal, open question 17).
