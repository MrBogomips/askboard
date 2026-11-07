# Design

## Context

See proposal.md for why. What the change starts from, read on this branch's base 933b217f (`askboard-skills` at its group 2 fixes, stacked on `widget-registry` at 7d4423e5) and on `widget-registry`'s head 931507f3 (its pre-PR fixes, not yet under `askboard-skills`):

- **The registry and the results seam** (`widget-registry`): `WidgetType` with `result: {schema, problems?}`, `WIDGET_TYPES` (Tree, Gantt), composed input, board document and `fetch` schemas, the output set listing each entry's result schema, `ask-core` checking each result (own keys, declared type, schema then checks against the edited value else the props as sent, JSON within `JSON_MAX_DEPTH`, not holding nothing), `KeptAnswer.results`, `fetch`'s `result`, the view's results store, `ItemProps.result` and `onResultChange`, `ComponentFacts` `{shape?, name?}` through `register`, `componentFacts`. At 931507f3 only: `resultHoldsNothing` (`widgets/result-content.ts`), `registry-check.ts` with `widgetRegistryProblems`, the `result-empty` rule and `EMPTY_RESULTS`, and its deferred U-1: `resultHoldsNothing` keeps no visited set, and `item-callbacks.ts`' `onResultChange` calls it before any JSON check (`isJsonValue` is private to `view-protocol.ts`).
- **The build's two checks** (`widget-registry` decision 10, task 5.7): the view build fails on a registered type no chunk registers and on a chunk folder (one holding `index.tsx`) under `packages/widgets/src/` that no registered type names; `widgets/test/component-facts.test.ts` imports `src/<type>/index.tsx` for every entry of `WIDGET_TYPES`.
- **The skill** (`askboard-skills`): `WidgetType.skill: {use, notes?}`; `bun run build:skills` writes `skills/askboard/`, and `check:skills`, inside `bun run check`, fails when the committed files differ from the generated ones or when a shipped type has no `skill`; `packages/server/test/skills-examples.test.ts` (its task 3.1) sends every example block through `AskCore.ask`.
- **The shell** (on `main`): the open prompt (`question-card.tsx` `OpenPrompt`, label `question.note`, field `noteFieldId`), `answer` and `decline` in `card-acts.ts`, a revision's first edit seeding choice, notes and note through `fillFrom` but no widget value and no result, receipts `queued`, `sent`, `delivered` (`question-state.ts`), the mode-switch Alert Dialog with the style-element shim (`bottom-bar.tsx`), `questionItemsOf` (`ready-tracker.ts`). `BoardContent` gives a component every widget item, the draft and the shown values, but not which items its question holds.
- **Chunks** (on `main`): Pragmatic drag and drop 4.0.0 is pinned in `packages/widgets` and bundled into the Tree's chunk (`tree/drag.ts`: `combine`, `draggable`, `dropTargetForElements`; widget-editing-plus task 5.1 measured about 22 KB); the `radix` library chunk lists `AlertDialog`, `Checkbox`, `DropdownMenu`, `Popover`, `RadioGroup`, `Switch`, `Tabs`, `ToggleGroup`, not `Slider`.
- **The approved UJ-3 answer** (`packages/contract/test/fixtures/answers/uj3-sales-review.json`) already gives the Approval's result as `{decision: "approve-with-changes"}` with the reason in `note`.

ADs relied on: AD-1 (imports; `contract` and `core` plain ECMAScript), AD-6 (worded problems; generated teaching), AD-7 (the registry, results keyed by item ID, IDs, sets and minors), AD-8 (agent content as text; the style-element shim for the dialog), AD-9 (components through the port, no own edit state, one chunk per component, library chunks for shared code), AD-10 (nothing chosen for the user, fail closed), AD-19 (pins and licences, unchanged), AD-20 (results apart from values, revisions, drafts). No AD and no FR changes; EXPERIENCE and DESIGN change through `ux-update-draft.md`. Nothing here assumes Claude Code's run-time behaviour beyond what `push-delivery` verified (an answer event pushed as built), so nothing needs a probe.

## Goals / Non-Goals

**Goals:**

- Each of the three types is a registration: its own folders in `contract` and `widgets`, one registry line, its teaching text, its strings; shared code changes are generic seams later result widgets reuse.
- The first proof of a result end to end, on the session process and in the conformance suite.
- Fail closed twice: the board never sends an Approval the rules refuse, and `ask-core` refuses it anyway.

**Non-Goals:**

- The Slider atom, layouts, the sales estimate review, Kanban and Timeline (proposal, Not in this change).
- Results recorded by the agent with `update` (`widget-registry` left them out).
- Changing how a revision carries widget values: an item the revision leaves alone still shows its answer's value without re-sending it (molecules, design decision 11).

## Decisions

### 1. Three registry entries, one folder each (open question 1)

`packages/contract/src/widgets/<type>/` per type, as the Tree's and the Gantt's: `<type>-props.json` (`urn:askboard:input:<type>-props`), `<type>-result.json` (`urn:askboard:output:<type>-result`), `constants.ts`, `checks.ts` (plain, no Ajv, so a view chunk may import it), `wording.ts` (`expected` and `fields` keyed `<type>.props…`), `widget.ts` (the entry) and `index.ts`. No entry declares `edits` or `derived`. Nouns "an Approval", "a Scale", "a Ranking".

| Type | Props | Result | Checks against the props |
|---|---|---|---|
| `approval` | `{}`, no field | `{decision}`: `approve`, `approve-with-changes`, `reject` | none; decision 2 for the answer |
| `scale` | `min`, `max` (±1e9, `max` > `min`), `step` (> 0, default 1), `range`, `display` (`slider` default, `rating`), `minLabel`, `maxLabel` (1–60), `unit` (1–20) | `{value}`, or `{low, high}` with `range` | `(max − min) / step` whole within 1e-9 and ≤ 1,000; a rating ≤ 11 values (one toggle per value from `min` to `max`, so at most 10 steps) and no `range`; each number within `min`..`max` exactly and `min + k·step` within 1e-9 of a step (the tolerance applies to the step grid, never to the bounds); `low` ≤ `high` compared as numbers, never as step indexes |
| `ranking` | `items`: 2 to 50 `{id, label (1–200), description? (1–500)}` | `{order}`: element IDs | IDs unique (props); the order holds each ID once (result) |

Every result schema has its fields required and `additionalProperties: false`, so the `result-empty` rule's samples all fail. Each entry carries `skill` (draft texts, shortened to `askboard-skills`' bounds at task 1.3 to 1.5): Approval, use "a verdict on its question's content: approve, approve with changes or reject; put it last in the question it approves", notes "The reason arrives as the answer's `note`; `approve-with-changes` always has one." and "An answer that edits the question's other items never carries `approve`."; Scale, use "a number on a slider, a range between two numbers, or a rating of up to 11 values", note "Nothing is set until the user sets it: the result is `value`, or `low` and `high` with `range`."; Ranking, use "an order of 2 to 50 items the user sets by dragging or with Move up and Move down", note "`order` lists every item ID once; an untouched Ranking gives no result.". Examples: `{type: "approval", id: "verdict", props: {}}`, a rating from 1 to 5 with labels, a Ranking of three items.

### 2. What a result requires of its answer (open questions 2, 4 and 5)

`WidgetType.result` gains, appended, `answerProblems?(result, answer: {note: string | undefined; changed: boolean}): readonly string[]`, and `contract` exports `widgetAnswerProblems(item: {type, id}, result, answer, types = WIDGET_TYPES)`, which finds the entry by `item.type`, as `widgetResultProblems` does, and prefixes each message with `item <id>: `. An unknown type gives no problem, so it relies on `widgetResultProblems` having refused that result first (decision 3). `changed` is whether the answer's `changes` are non-empty; the Approval has no edits of its own, so it counts only the other items. The Approval's checks: `approve-with-changes` with a note holding no reason → "approving with changes needs the reason in the note"; `approve` with `changed` → "an answer that changes the content approves with changes". `approve-with-changes` with nothing changed passes. A note holds a reason when it holds a character other than white space, white space being what ECMAScript's `\s` matches plus U+0085 (NEXT LINE), which `\s` omits; so a note of U+0085 or of U+FEFF alone holds none. `contract` exports that one predicate, `noteHoldsReason(note)` (`/[^\s\u0085]/`), and `approvalNeedsReason(result)`; the Approval's checks and the view's `reason.ts` (decisions 5 and 6) call them, so the page and `ask-core` read one rule. Invisible format characters with no visible text (U+200B, U+3164 and the like) count as a reason, as the spec words it (Open Questions 1).

*Alternative:* the view alone (a page that skips its own gate would deliver an ambiguous verdict, F-63).

### 3. `ask-core` runs them where the changes exist

In `lifecycle/acts.ts` `answered`, after `widgetFieldsOf` has built the event's widget fields and before `keepWidgets`, each key of `widgets.results` runs `widgetAnswerProblems` on the question's widget item of that ID (`{type, id}`) with `act.note` and `changed = (fields.changes?.length ?? 0) > 0`, through `target.types`; the first problem refuses the answer (`content`, naming the item), so nothing is appended, kept or published. It runs only after the result checks (`widgetContentOf`'s `resultsProblem`, which runs `widgetResultProblems` and refuses a result keyed by an item the question does not hold or of an unknown type) have passed, never before or instead of them. The diff is computed once, as today. A decline carries no result (`widget-registry`), so it runs nothing. `core` names no type.

### 4. A result that holds itself (U-1, `widget-registry` task 5.14)

`resultHoldsNothing` keeps a `Set` of the objects and arrays it has pushed and pushes each once, so it ends on any value; a test runs it on self-holding values and on a million-deep array. In the view, `onResultChange(undefined)` is a component's report of no result (the port's "`undefined` for none", as a deselected Approval sends): it clears the held result and is no error. Any other value first runs `isJsonValue(result, JSON_MAX_DEPTH)` (exported from `view-protocol.ts`); a failure, a field inside the result holding `undefined` included, clears the item's held result and goes to `onError`, so the item fails and the rest of the board answers. Task 0.2 lists every caller of `resultHoldsNothing` with its file and line; task 1.1 makes the function safe for all of them, and task 3.1 adds the view's JSON check.

### 5. Facts a result widget gives the shell

`ComponentFacts` gains, appended after `widget-registry`'s `shape` and `name`:

- `reason?: (result: unknown) => {label: StringKey; missing: StringKey} | undefined`: while it returns a pair for an item's held result, the open prompt reads `label` and is required, and `missing` is its field error;
- `confirmsRevision?: true`: a revision of a question holding such an item asks first once the agent has received the latest answer.

The Approval chunk registers `{name: "change.widgetApproval", reason, confirmsRevision: true}`, its `reason` built on `approvalNeedsReason`; the Scale and Ranking chunks register a `name` only. `component-facts.test.ts` gains: for each decision, the Approval's `reason` gives a pair exactly when `widgetAnswerProblems` refuses that decision with no note and nothing changed.

*Alternative:* a type table in the shell (what `widget-registry` decision 8 removed).

### 6. The question card reads them

- **Reason** (`shell/reason.ts`, pure): the first item of the question, in order, whose facts' `reason` gives a pair for its held result, else its shown result while the card shows an answer. `OpenPrompt` takes `label` and `error`; the card keeps the error flag. "Answer" stays enabled; pressed while a pair applies and the note fails `noteHoldsReason` (decision 2), it sends nothing, marks nothing ready, sets the flag and focuses `noteFieldId`. The flag clears as soon as the note holds a reason or no pair applies, and stays cleared if the text is then deleted, until a press sets it again. Unmarking a marked answer is never refused. Decline needs no reason.
- **Every path to an answer runs the same checks** (review of groups 2 and 3, 2026-11-07): "Accept recommended" acts as "Answer" (EXPERIENCE, Accept recommended): it selects the recommended option, then runs the reason check, then the confirmation, in `onAnswer`'s order. "Select recommended" in submitted delivery selects the option on every question it reaches, but does not mark ready a question whose reason check fails; it counts it as selected. Submit makes a last reason check over every held answer before anything else: if one fails, Submit sends nothing and moves to that question's open prompt with the field error (the first such question in board order).
- **Confirmation** (open question 3; `shell/revision-confirm.ts`, pure, and an Alert Dialog in the card reusing the bottom bar's dialog classes and its style-element shim path): needed when the question's status holds a latest answer or decline whose receipt is `delivered` and the question holds an item whose facts have `confirmsRevision`. "Answer" and "Accept recommended" (each after the reason check) and Decline open it at the press; confirming runs the act; Cancel or Escape closes it with the draft as it was and focus back on the control pressed: "Answer", "Accept recommended", or the question's More menu trigger for Decline, whose menu item is gone. With no `AlertDialog.Trigger`, Radix restores no focus, so the card keeps a ref to the pressed control at the press and gives `AlertDialog.Content` an `onCloseAutoFocus` that prevents the default and focuses it; a confirmed Decline still moves focus to the heading. Postpone and follow-ups never ask.
- **Confirmation in submitted delivery** (default accepted under the PO's unattended handoff, 2026-11-07): the press-time ask stays, judged on the receipt at the press. Submit, after its last reason check, asks once more when any held answer or decline would, at the moment of Submit, replace a latest answer or decline whose receipt reads `delivered` on a question holding a `confirmsRevision` item, whether or not it was asked at its press (the receipt may have turned `delivered` since). One Alert Dialog in the bottom bar lists those questions by the label the outline shows (its header chip, else its text), cut with an ellipsis; Cancel or Escape sends nothing, keeps everything held and returns focus to Submit; confirming sends the whole command. A pure function in `revision-confirm.ts` lists the questions from the held work and the board state.
- **Revisions keep results** (open question 6): `fillFrom` takes the results store and puts the answer's `results` for each item ID the question's current revision holds, so a revision's first edit and "Start from my previous answer" start from them. `contentOf` (`question-state.ts`) carries the answer's results.
- **Strings:** `question.reasonRequired`, `question.reasonMissing`, `revision.confirmTitle`, `revision.confirmBody`, `revision.confirmSend`, `revision.confirmCancel` (texts: `ux-update-draft.md` block 1); for Submit's confirmation, `revision.submitTitle` "Send new answers?" / "Inviare nuove risposte?" and `revision.submitBody` "The agent has already received your earlier answers to these questions. Submit replaces them:" / "L'agente ha già ricevuto le tue risposte precedenti a queste domande. L'invio le sostituisce:", with the buttons `bar.submit` and `bar.cancel` (texts to review; EXPERIENCE gains them with task 4b.12).

### 7. The board tells a component its question's items

`BoardContent` gains `questionItems?: ReadonlyMap<string, readonly string[]>`, question ID to its widget items' IDs in order, built once from the board document beside `items`; optional in the type so the widgets' fixtures stand, always set by the shell (and in a Snapshot). The Approval reads its siblings from it.

### 8. The three components (open questions 7 and 8)

All three register through the port, check their props with their `checks.ts` and throw on a problem (the item's error boundary fails it, AD-10), report ready through `useReadyAfterLayout`, render their result disabled when `disabled`, and route every string through the view's tables.

- **Approval** (`packages/widgets/src/approval/`): the decisions are a Radix Toggle Group, `type="single"`, styled `button-decision`, one Tab stop with roving focus; selecting puts `{decision}`, deselecting puts `undefined`. `summary.ts` (pure): for each other widget item of the question whose chunk gives a `shape`, `elementChanges(id, props as sent, board.shown value)`; a line per operation, naming the element by its `label` when that is a string, else its ID, read from the element as sent (`was ?? now`: the shown one only for an added element), so an element renamed and moved has one name on every line; for a `set` its field with the sent and the new value; `values.ts` formats a value for the ask's locale with `contract`'s formatters (numbers, money `{amount, currency}`, `full-date` strings, booleans "on"/"off" from the string tables ("attivo"/"disattivo" in it-IT, passed in as `ValueWords`), `null` "—" (a glyph, not a string), other strings and JSON cut at 80 characters with "…"). Changes > 0 disables "Approve", and an effect puts `undefined` when the held decision is `approve`. Layout per DESIGN Approval: a block above a `{colors.border}` rule, the decisions under the "Approval" label on the left, the summary on the right; at most 20 lines, then "and N more".
- **Scale** (`packages/widgets/src/scale/`): `model.ts` (pure): `stepsOf`, `snap` (to the nearest step, clamped to `[min, max]`: step index 0 is `min` and the top index, `round((max − min) / step)`, is `max` itself; the steps between are `min + k·step` rounded to the decimals of `min` and `step`, so every value it makes passes the contract's exact bounds even when `step` divides the scale only within a billionth; built in task 4.2), `valueAt(fraction)`, `firstValue(key)` (Home and arrows give `min`, End `max`), `resultOf`. The slider is Radix Slider, controlled: unset, the root holds no thumb, and AskBoard's wrapper, a focusable `role="slider"` with `aria-valuetext` "Not set", takes the first pointer down on the track (its fraction of the track's box) and the first key; set, Radix's thumbs and keys apply, a range with both thumbs at the first value. Each `onValueChange` puts the result. The rating is a Radix Toggle Group, one toggle per step, `minLabel` and `maxLabel` at its ends. Values and `unit` in the ask's locale.
- **Ranking** (`packages/widgets/src/ranking/`): `model.ts` (pure): `orderOf(result, props)`, `moveBy(order, id, ±1)`, `dropAt(order, id, targetId, fraction)` (top half before, bottom half after; a drop in place keeps the order), `movedOf(order, props)`. `drag.ts` on Pragmatic drag and drop, as `tree/drag.ts`: a row draggable by its handle and a drop target, data `{rankingId, itemId}` so another Ranking's or a Tree's drops are refused, Escape cancelling natively. The list is one Tab stop with a current row moved by the arrow keys; the toolbar ("Move up", "Move down", "Keep this order", then the counter) is another, following the Tree's toolbar rules (`aria-disabled` tools keep focus); if the Tree's `toolbarFocus` and `toolbarStop` are pure, they move unchanged to `widgets/src/shared/toolbar-focus.ts` and both import them. A move or "Keep this order" puts `{order}`; moved rows take the change highlight; the counter reads "No changes", "Order kept" or "Your changes: N moved".

### 9. Library chunks (open question 9)

`LIBRARY_CHUNKS` gains `dnd`, `{from: WIDGETS_DIR, modules: {"@atlaskit/pragmatic-drag-and-drop/combine": ["combine"], "@atlaskit/pragmatic-drag-and-drop/element/adapter": [the names the Tree and Ranking import]}}`, appended after `board-graph`; `radix`'s list gains `Slider`. The Tree's sources do not change: the shared-module plugin compiles their imports to shims, its chunk loses the library and needs `dnd`. `chunk-sizes.json` is re-recorded with the reason (askboard-implementation).

### 10. Registration waits for the chunk

An entry joins `WIDGET_TYPES` only in the task that adds its chunk's `index.tsx` (tasks 5.1 to 5.3), since decision 10 of `widget-registry` and `component-facts.test.ts` fail a type with no chunk and a chunk with no type. Until then, tests pass a registry through the parameter seam: `withWidgetTypes(...entries)` in `src/fixtures/approval-scale-ranking.ts` returns `WIDGET_TYPES` plus the given entries it does not already hold, so the same tests pass before and after registration. Each registration task also regenerates the skill (`check:skills`).

### 11. Versions

The input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s (askboard-contract-versioning): their composed schemas and the output set's list change only when a type registers, so the four constants move to `main`'s minor plus one in the first registration task (5.1), each set module's header gains one sentence naming this change, and the binding is task 7.2's. The board protocol (results are any JSON by item ID in the act, the draft record and the board state), the Snapshot data and the view manifest (a new library chunk is data) keep `main`'s. Descriptions, comments and test titles say "since approval-scale-ranking", never a number.

Binding: (filled at task 7.2) "Bound on <date>, rebased onto origin/main <sha>: input format <n> (main <m>), output format …, tool envelopes …, board document …."

### 12. The end-to-end proof of a result (`widget-registry` open question 6)

| Scenario | Where |
|---|---|
| Approval with a Tree: "Approve" disabled after an edit, the reason's label and field error, the summary, the answer collected with `results`, the note and the Tree's `changes` | browser, session process (task 6.1) |
| A received verdict revised: confirmation, Cancel and Escape with focus back on the control pressed, confirm, the revision naming the one it replaces; "Accept recommended" asking the same; Submit asking in submitted delivery | browser, session process (task 6.1) |
| A held Scale value across a reload, the leave-page prompt armed; a Ranking's order fetched alone as `result` | browser, session process (task 6.2) |
| A Snapshot of the answered three, read-only | browser (task 6.3) |
| One answer with the three results pushed by the mod and collected, each configuration, Bun and Node 24 | conformance `widget-results.e2e.ts` (task 6.4) |
| `act` refused through the board protocol for `approve-with-changes` without a note | `packages/server/test` (task 6.5) |

## Merge points

Borrowed from `main` (task 0.2 checks each): `ItemProps`, `BoardContent`, `register`, `useReadyAfterLayout`, `questionTextId`, `useStrings`, `useLocale`, `elementChanges`, `ElementShape`, `formatNumber`, `formatMoney`, `formatDate`, `fillFrom`, `contentOf` (view), `answer`, `decline` (`card-acts.ts`), `OpenPrompt`, `noteFieldId`, `ActionsRow`, `questionItemsOf`, `LIBRARY_CHUNKS`, `WIDGETS_DIR`, the receipt `delivered`, `ID_PATTERN`. Added by the review fixes (group 4b), found on `origin/main` on 2026-11-07: `acceptRecommended` (`card-acts.ts`), `selectRecommended`, `submitActsOf`, `heldWorkOf` (`submit.ts`), the strings `bar.submit` and `bar.cancel`.

Changes in flight (the coordinator says both merge before this one):

- **`widget-registry`** (branch head 931507f3; this branch's base holds it at 7d4423e5). Borrowed: `WidgetType` (`result`, `wording`, `example`), `WIDGET_TYPES`, `widgetTypeOf`, `widgetRegistryProblems`, `registryShapeProblems`, `EMPTY_RESULTS`, `resultHoldsNothing`, `widgetResultProblems`, the composers, `withinLimit`, `widgetFieldsOf`, `keepWidgets`, `ActsContext.types`, `JSON_MAX_DEPTH`, `isJsonValue` (private there; task 3.1 exports it), `ComponentFacts`, `componentFacts`, `ItemProps.result`, `onResultChange`, `itemCallbacks`, `draftAnswerOf`, `resultIdsOf`, `widgetChunkProblems`, `component-facts.test.ts`, `PROBE_TYPES`. Tasks 1.1 to 6.5 use them; task 0.2 rebases onto a base that holds 931507f3 before group 1. This change appends `result.answerProblems` to `WidgetType` and `reason`, `confirmsRevision` to `ComponentFacts`, and closes its U-1.
- **`askboard-skills`** (this branch's base 933b217f, unmerged). Borrowed: `WidgetType.skill`, `bun run build:skills`, `check:skills`, the generated `skills/askboard/`, `skills-examples.test.ts` (its task 3.1, not yet built at 933b217f). Tasks 1.3 to 1.5 and 5.1 to 5.3. If its later tasks change the skill's templates or budgets, the rebase regenerates rather than resolves.
- **`diagram-render`** (proposed, branch 9281d923, stacked on `widget-registry`). Overlaps, re-checked at task 7.2: both append to `WIDGET_TYPES` (keep both lines, registry order follows merge order), `WidgetType` (`renders` there), `ItemProps` (`keptRender`, `onRender` there), `LIBRARY_CHUNKS` (`mermaid`, `plantuml` there, `dnd` here: keep all, in merge order), the strings tables, `chunk-sizes.json`, the fixtures' export block, and four of the same sets (input, output, tool envelopes, board document; it also widens the board protocol and the view manifest). Whichever merges second rebinds. Its ADDED requirement "This change's sets at their next minor" shares a name with `widget-registry`'s; this change's is named apart.
- **`early-benchmark`** and the spikes: no overlap. Renderer task 6.2 (the PO's drag by hand) is task 6.6 here, not blocking (open question 10).

Seams this change creates: `WidgetType.result.answerProblems` and `widgetAnswerProblems`, `approvalNeedsReason`, `noteHoldsReason`, `ComponentFacts.reason` and `confirmsRevision`, `BoardContent.questionItems`, the `dnd` library chunk, `withWidgetTypes`, the Scale's slider (which `atoms-and-layouts` may move into the Slider atom) and the Ranking's list model and drag (which Kanban may reuse).

## Risks / Trade-offs

- [A registered type with no chunk, or a chunk with no type, breaks the build between tasks] → decision 10: registration in the chunk's own task.
- [The Tree's drag changes when the library moves to `dnd`] → task 0.3 recorded the Tree's drag browser files before the move; task 6.8 runs them after it, in Chromium and WebKit, at the same counts.
- [Native drag fails by hand in Safari (renderer task 6.2)] → the keyboard moves answer; task 6.6 records the PO's result; a failure is a later change to pointer drag (EXPERIENCE, Drag).
- [Radix Slider's behaviour when unset differs by version or engine] → the wrapper owns the unset state entirely; browser tests click and key the unset track in Chromium and WebKit.
- [Floating steps (0.1 + 0.2)] → `snap` rounds to the step's decimals and clamps to the bounds, the top step being `max`; the contract's check allows a billionth of a step on the grid only, and compares bounds and `low` with `high` as numbers; tests with decimal steps on both sides.
- [A second path to an act skips the gate added to the first: "Accept recommended", "Select recommended" and Submit reach an answer apart from "Answer"] → decision 6: each runs the same reason check and confirmation, one reason predicate in `contract`; a test on each path.
- [The summary reads values the user cannot see as names (keyed Gantt plans)] → the element's ID stands in when it has no `label`.
- [Chunk growth: three chunks, `Slider` in `radix`, the composed validators in the board page] → each task records its sizes; the Tree's chunk shrinks by the library.
- [Revisions now seed results] → it changes no answer already sent; tests cover the Tree beside an Approval and "Start from my previous answer".

## Migration Plan

None: four sets widen by added schemas and composed item branches only, and one session process serves the board page and `board-host`, so their minors move together. Rollback is a revert, then `bun run build:skills`.

## Open Questions

The proposal's ten questions carry their proposed defaults, accepted under the PO's unattended handoff (2026-11-07); a PO answer that differs comes back through `/opsx:update` before the groups it touches. So do the review defaults of 2026-11-07 written into decisions 6 and 8 (Submit's confirmation and last reason check, "Select recommended" not marking ready, one name per element in the summary).

1. **For the PO** (security review of groups 2 and 3, X-4): does a note of invisible format characters with no visible text (U+200B, U+200D, U+2060, U+00AD, U+3164, U+115F, U+2800) count as the reason for approving with changes? Proposed default, applied: yes, since the spec refuses only a note with no character other than white space, and these are not white space. Task 4b.2 pins the default in one named test; a different answer changes `noteHoldsReason` and that test, and adds a scenario to the contract spec.
