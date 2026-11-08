# Design

## Context

See proposal.md for why. Read on the base 886739d3 (`layouts` task 5.3, stacked on `atoms` 442850f8, itself on `origin/main` 0e151a84; `main` is now 1a7482e2, `latex-public-api` merged, and PR #57 holds `atoms` rebased onto it at b1568f02):

- **The registry** (`contract/src/widgets/registry.ts`): `WidgetType` with `props`, `propsProblems`, `result? {schema, shape?, problems?, answerProblems?}`, `wording`, `example`, `skill?`; `WIDGET_TYPES` ends with the atoms, then `stack`, `row`, `group`, `tabs`. `widgetResultFits` (shape and `result.problems`) decides what the board page and the shell hold; `ask-core` checks each result (`widget-values.ts`) and then `answerRequirementProblem` over the results (`widget-event.ts`, called from `acts.ts` `answered`). A note alone is a `note` act and a decline reads no results, so neither reaches those checks.
- **The input atoms** (atoms): `text-field` `{label, description?, multiline?, maxLength?}`, `number-field`, `money-field`, `date-field` with their bounds, `toggle` `{label, description?}`; each `checks.ts` is plain ECMAScript a chunk imports. NumberField, MoneyField and DateField keep unreadable or out-of-bounds text as an entry; the TextField and the Toggle never hold one.
- **The shell** (atoms, layouts): `shell/entries.ts` (`entryIdsOf`, `entryBlock`, `holdsEntry`, `answerHint`) is read by `question-card.tsx`, `card-acts.ts`, `question-actions.tsx` and `submit.ts`; `cardState`'s `entry` disables "Answer"; layouts' `nested-items.ts` (`valueItemsOf`, `nestedItemById`) walks a question's items, and `withEntries` fills `BoardContent.entries`, which the Tabs read for their mark. `ComponentFacts` (`fits`, `reason`, `valueFits`) is what a chunk tells the shell of its type; the shell imports no registry.
- **The renderer spike** (`openspec/changes/spike-renderer/findings.md`, § Form, § S-8, D13 to D17): RJSF 6.11.0 needs a no-op validator, `tagName="div"` (WebKit fires a `<form>`'s submit event in the sandbox), `showErrorList={false}`; it keeps its own `formData` in state even when controlled (D16), so the spike left the remount check to the Form; its chunk was 254,166 bytes (86,627 gzip), 78,544 of them markdown-to-jsx with Markdown off (D15), and `@rjsf/core` re-exports a test registry that imports `@rjsf/validator-ajv8`. `probe/pattern-check.ts` (110 lines, no DOM or Node API) checks EXPERIENCE's subset: 8 patterns accepted, 11 refused.
- **The threat model** (§3.7): a pattern on agent, file or page text runs in linear time on the session process's event loop.
- **The radix library chunk** holds `RadioGroup` and `Checkbox` (`tools/build/shared-modules.ts`). The question's Choice gets manual activation by cancelling a click Radix dispatches from its focus handler (`catalog/choice/single-choice.tsx`), which Radix does not document.
- **The skill**: `SKILL.md` is 8,755 characters on the base, of 9,000.

ADs relied on: AD-1 (contract modules plain ECMAScript), AD-6 (worded problems, generated teaching), AD-7 (the registry; amended by `spine-update-draft.md` block 1), AD-8 (agent content as data: labels, options and patterns), AD-9 (one chunk per component, no edit state in components, facts through the port), AD-10 (nothing set for the user; refuse what fails), AD-13 (not used: decision 2), AD-15 (Snapshots), AD-19 (no new dependency; the Stack's RJSF row removed by block 2), AD-20 (results in the draft). Nothing here depends on Claude Code's run-time behaviour: no item needs a probe.

## Goals / Non-Goals

**Goals:**

- A Form is what the agent already composes: input fields in a question, a Group per section, Tabs for long forms. This change adds only the missing field (the PickField) and the field checks.
- One function per field type decides its check, in `contract`; the view, the shell and `ask-core` call it and never restate it.
- A value that fails a check is the user's draft, kept and shown with its error, never dropped or sent.

**Non-Goals:**

- A form library, a `form` item type, fields that start from the agent's value, "Other…" on a pick, repeatable entries (proposal, open questions 1, 2, 7 and 8).

## Decisions

### 1. No form library (open questions 1 and 2; spine block 2, EXPERIENCE amended)

A Form is a question whose items are input fields, arranged by layouts. RJSF would turn a JSON Schema into fields that the AskBoard theme maps back onto the atoms, so it adds a schema walk the registry and layouts' `renderItem` already do, and costs:

- **AD-9**: its own copy of the form's data (D16), the source of the roadmap's "RJSF state against the draft record" risk and of the remount check; the atoms keep none.
- **AD-7**: a second field model beside the registry (JSON Schema properties with `ui:` options), each check, wording, example and teaching line mapped twice.
- **AD-19, NFR-6, R6**: a pinned dependency and a chunk of about 254 KB with markdown-to-jsx unused, and the test registry pulling `@rjsf/validator-ajv8`.
- **AD-8**: no `<form>` element exists, so WebKit's submit event (S-7) has nothing to fire on.

The Stack's `@rjsf/core`, `@rjsf/utils` row goes (it was never installed); EXPERIENCE's Form library section becomes a Form section (`ux-update-draft.md` blocks 3 and 4). An MCP elicitation form maps onto the fields one to one (string, number, boolean, enum), which the PickField's teaching says.

*Alternatives:* RJSF as pinned; a `form` container type (a Group by another name); a `form` item holding a JSON Schema rendered by AskBoard's own mapping, whose fields would need entries and results keyed inside one item, a board-protocol change.

### 2. Field checks: one function per type in the registry (open question 3; spine block 1)

`contract/src/widgets/field-checks.ts` (plain, no JSON, no registry import) holds `FieldCheckFailure`, one of `{code: "required"}`, `{code: "min-length", min}`, `{code: "pattern"}`, `{code: "min-items", min}`, `{code: "max-items", max}`; `requiredFailure(props, result)`; `fieldCheckMessage(failure)`, the English wording of a refusal; and `fieldCheckProp(failure)`, the prop the failure is a check of (`required`, `minLength`, `pattern`, `minItems`, `maxItems`), one switch typed exhaustively over the codes, which `ask-core`'s refusal and the view's wording both read, so neither restates it (review S-1). `WidgetType` gains, appended, `fieldCheck?: (result: unknown, props: unknown) => FieldCheckFailure | undefined`, with `result` `undefined` when the item has none; each input atom's `checks.ts` exports its own (`textFieldFieldCheck`, `numberFieldFieldCheck`, …, `pickFieldFieldCheck`), and its entry names it. `widgetFieldCheck(item, result, types)` dispatches on the registry; it lives in `widgets/widget-field-check.ts`, not in `field-checks.ts`, because the entries import `field-checks.ts` and the registry imports the entries, so a dispatcher that imports the registry in that module would make an import cycle (as built in task 1.2).

- **Apart from fit.** A field check never enters `result.problems`, so `widgetResultFits` stays true for a value that fails only its check: the shell holds it, the draft record mirrors it, a reload restores it (spec: A value that fails a check still fits). The TextField keeps its text as its result; no entry is needed, and the board protocol does not move.
- **Not AD-13.** A check has no address, no formula and no place in an answer's `derived`: the answer goes only once every check passes, so it would always read "passed". The graph stays for values; EXPERIENCE's "in the compute graph" becomes "by the contract's checks, in the view and in `ask-core`" (`ux-update-draft.md` block 5). AD-13's "a send-time check that disagrees with the board" is met by one function in both.
- **Existing bounds stay where atoms put them**: `min`, `max`, `step`, a date's range and `maxLength` are entries or input caps; EXPERIENCE's keyword set maps onto them (block 5).
- **Props.** `required` on the five input atoms and the PickField; `minLength` and `pattern` on the TextField. Each `checks.ts` restates them in its `KEYS` and limits; `minLength` above `maxLength` (10,000 when absent) is refused naming the item.

### 3. The pattern runs only in the view (open questions 4 and 5)

- **Send time** (`ask`, `update`): `contract/src/widgets/shared/pattern.ts` `patternProblem(pattern)`, called by `textFieldPropsProblems`, starts from the spike's `pattern-check.ts`: at most `PATTERN_MAX_CHARS` = 200 code points; compiles with `new RegExp(pattern, "u")` inside a `try`; then one pass over the characters, tracking escapes, classes and a stack of groups (each frame: holds a quantifier, holds an alternation), refuses `\1`–`\9` and `\k<…>`, `(?=`, `(?!`, `(?<=`, `(?<!`, every other `(?` form but `(?:` and `(?<name>` (a modifier group, `(?i:a)`, compiles on Bun 1.4.4 and may not in the user's browser, so that no pattern the server accepts can fail to compile on the board), a group name used twice or spelled with an escape, and a group repeated by `*`, `+` or `{n,…}` other than `{0}` and `{1}` that holds a quantifier or a `|`, and a `\p{…}` or `\P{…}` that names anything but a General_Category value (alone or after `General_Category=` or `gc=`) or one of ECMAScript 2018's binary properties (`shared/property-names.ts`, in a class too; `Script`, `sc`, `Script_Extensions` and `scx` are refused, since a script added to Unicode after the user's browser was built compiles on the server and never on that board: review X-2b, task 1.13). That claim covers group syntax and property names, not every engine difference. The same pass keeps a cost budget, `PATTERN_MAX_REPEATS` = 3 in `contract`, read by the wording, the skill note and the refusal: it counts each quantifier whose count can vary (`?`, `*`, `+`, `{n,}`, `{n,m}` with m over n, lazy or not), each group holding a `|` (one for a top-level `|`), and one more when the pattern does not start with `^`, and refuses a pattern that costs more, naming the count. Linear in the pattern; no regular expression scans it. A TextField with a `pattern` takes `maxLength` at most `PATTERN_TEXT_MAX_CHARS` = 100, and 100 when absent: the bound is also a fit rule, since `textFieldResultProblems` limits a text to `maxLength`, else 100 for a field with a pattern, else 10,000, so a text over 100 characters is unfit for a patterned field without `maxLength` (the shell drops it, as for a lowered `maxLength`), and a `minLength` above that limit is refused at send time (as built in task 1.2; review note S-2; the 1,000 of task 1.2 became 100 in task 1.12).
- **On the board**: `textFieldPatternFailure(result, props)` (`text-field/checks.ts`) compiles once per pattern string (a map of at most 64 in the chunk) and runs `.test(text)`, unanchored, as JSON Schema's `pattern`; a pattern that does not compile fails the check, never passes. The TextField chunk registers `check` as `textFieldFieldCheck` then `textFieldPatternFailure`.
- **In `ask-core`**: the registry's `fieldCheck` for the TextField is `textFieldFieldCheck`, which never reads `pattern`: the session process runs no agent pattern on user text (threat model §3.7). The text is the user's, so taking it is no answer the user did not give (NFR-10); only a board message forged with the board's token could send it.
- **Residual**: the subset leaves no exponential nesting (a repeated group holds neither a quantifier nor an alternation), and the budget bounds how many variable quantifiers or alternations are written in a row (`^\d*\d*\d*\d*$` took 39.5 s on Bun at 1,000 characters: review finding X-1). The budget alone does not bound the work of each attempt: a fixed tail after the quantifiers (`{k}` or literal atoms) multiplies it, so `^\d*\d*\d*\d{250}$` took 36 s and `^.*.*.*.{250}$` on a text ending in U+2028 171 s on Node 24 at 1,000 characters (second review). The input-side bound is the cap of `PATTERN_TEXT_MAX_CHARS` = 100 characters, with no new mechanism (PO rule of 2026-11-07, coordinator's decision): task 1.12 timed the worst shapes at 100 characters (`.` and `\d` heads, anchored and not; no tail, `{24}`, `{50}`, `{75}` and `{99}` tails and literal tails of 75 and of the pattern limit; endings `x`, `!` and U+2028; each regular expression run cold, since V8 interprets a new one first), and the worst case, found by review X-2 of task 1.14 and timed in task 1.16, is about 341 ms on Node 24 (V8): a class uniting property escapes, `C = [\p{L}\p{N}\p{S}\p{P}\p{M}\p{Cf}\p{Co}]`, as the head of `C*C*C{75}$` (or `^C*C*C*C{99}$`) over 99 astral code points (U+20000) and U+2028, each step slower on V8 than `.` on ASCII (the `.` and `\d` heads of task 1.12 reach 131 ms, 146 ms at most over a sweep of every tail); on Bun 1.4.4 (JavaScriptCore) the worst is 4.2 ms. That is under the 500 ms gate, so the cap stays at 100 and not at 80 or 64 (about 140 ms), but with a margin of 1.5: on a machine two or three times slower the first keystroke on such a field could pass 500 ms. Those figures go to CHANGELOG Known limits. The cost is paid once per keystroke: every reader of the text (the board's failing IDs, the card's block and hint, the field's own error, Submit) asks `textFieldPatternFailure`, which keeps the outcome per pattern and text in a memo of at most 64 entries (a `Map` keyed by the pattern's length, the pattern and the text, oldest unused first, so no text is an object's key), and review X-1 of task 3.4 counted four to five runs per keystroke before it; the `patternRunCount` seam counts the runs in tests.

*Alternatives:* `ask-core` running the pattern too (an agent pattern on the event loop); a worker with a timeout (a new mechanism); the spike's subset alone, which accepts `^(a|aa)*$`, exponential on 30 characters a user may type.

### 4. The PickField (open questions 7 and 12)

`packages/contract/src/widgets/pick-field/` in the atoms' layout (`pick-field-props.json`, `pick-field-result.json`, `constants.ts`, plain `checks.ts`, `wording.ts`, `widget.ts`, `index.ts`); noun "a PickField"; appended to `WIDGET_TYPES` after `tabs`.

- **Props** (contract spec): option IDs follow `ID_PATTERN`, are unique in the item (AD-7's child IDs) and refuse `VIEW_ID_PREFIX`; option labels 1 to 200 code points, descriptions 1 to 1,000 (`widgets/shared/atoms.ts`); `minItems`/`maxItems` only with `multiple`.
- **Result**: a schema of `if {type: string}` `then` a string of 1 to 64 characters matching the ID pattern `else` an array of 1 to 50 distinct strings matching it, not a `type: ["string", "array"]` union (the contract compiles every schema in strict mode, which refuses a type union, and its root-combinator rule refuses a root `oneOf`, `anyOf` or `allOf`; `if`/`then`/`else` is neither, and it is narrower than the union the design first named, as built in task 1.3); the registry's empty-result rule holds (`null`, `{}`, `[]`, `""` are refused); `shape` and `problems` check single against string, multiple against list, each ID an option's, the options' order. An agent update that removes a picked option or switches `multiple` makes the result unfit, so the shell drops it.
- **Component** (`catalog/pick-field/index.tsx`, chunk `pick-field`, `fits` and `check` and `name` registered): the `Field` frame; a single pick on Radix `RadioGroup` with Radix's documented keyboard (open question 12) and a "Clear" `button-link` while set; a multiple pick on `Checkbox`, one per option; option labels and descriptions as text. Above more than `PICK_FILTER_OVER` = 10 options, a filter input (`fields/` classes) shows the options whose label, lowercased with `toLowerCase`, holds the filter's text lowercased; it is view state, never in the draft, and a hidden pick stays picked. Read-only: the controls disabled with the picks checked, no filter, no "Clear". Ready after its first layout. As built (task 3.3): a multiple pick is a `fieldset` named by the label, whose accessible name carries the "(required)" mark since a group takes no `aria-required`; a single pick is Radix's group with `aria-required`; "Clear" hands focus to the first radio; the pick-field chunk draws no `style` attribute of its own, and Radix's roving-focus root sets `outline: none` through the CSSOM, as the Choice's and the Approval's groups do.

### 5. The field block in the shell

- `ComponentFacts.check?: (result: unknown, props: unknown) => FieldCheckFailure | undefined`, appended: the chunks of the five input atoms and the PickField register it over their contract functions (decision 3 for the TextField).
- `shell/field-block.ts`: `fieldBlock(question, entries, results)` gives the first field of the question in document order (`valueItemsOf`) that holds an entry (`kind: "entry"`), whose check fails on a value (`kind: "check"`), or whose check fails as `required` (`kind: "required"`), with its label (`labelOf` moved here from `entries.ts`). Every reader of atoms' entry block reads it instead: `cardState`'s `entry` input, renamed `fieldBlock`, `answerHint` (results appended; "Correct {label} first." or `question.requiredHint` "Complete {label} first."), `card-acts.ts`, `question-actions.tsx`, `submit.ts` (`selectRecommended`, `submitPress`, `confirmedPress`, `submitStateOf`) and the answer press. A held answer stops being ready while its question has a block, as for an entry.
- `withEntries` (layouts) adds to `BoardContent.entries` the IDs of fields whose check fails on a value (`kind: "check"`), so the Tabs mark covers them; an empty required field adds none (open question 6). The name stays: layouts' design cites it.

### 6. The fields' own display

- `fields/field.tsx` `Field` takes `required`: the label ends with the `field.required` string ("(required)") in its own span, and the control gets `aria-required`. No field error shows for an empty required field.
- The TextField shows `field.minLength` ("At least {min} characters.") or `field.pattern` ("Not in the expected form.") under it as typed, with `aria-invalid` and `aria-describedby`, as atoms' entry fields do; the agent explains the expected form in `description`. A multiple PickField shows `field.minItems` or `field.maxItems`.
- Enter: no `<form>` exists, and the single-line input handles no Enter; a test pins that nothing is sent.
- Every new string goes in both tables with `ux-update-draft.md` block 6's texts, Italian marked to review.

### 7. Teaching and the skill (open question 9)

The PickField's `use` is at most 60 characters ("one or several options picked from a list, as in a form"); its notes give the elicitation mapping, `multiple`, the counts and that a pick returns IDs. The TextField's notes gain `minLength` and `pattern` (the subset, unanchored, `u` flag); each input atom's reference lists `required` from its schema. One generated sentence of at most 100 characters, `{{formNote}}`, beside layouts' `{{layoutNote}}` and empty until `pick-field` is registered: "For a form, put fields in the question, a Group per section; a `required` field must be filled." Task 1.3's `tools/build/skills/form-skill.test.ts` builds the skill over the registry plus the PickField and checks every budget; an overrun stops the task for `/opsx:update`.

### 8. Registration waits for the chunk

As in atoms decision 10: `PICK_FIELD_WIDGET` joins `WIDGET_TYPES` only in task 3.3 (done there, after `tabs`, with the output format's minor); until then tests pass `withWidgetTypes(...FORM_TYPES)` from `fixtures/form.ts`, which also holds `FORM_QUESTION` (a Group "Contact" and a Group "Preferences" in a Tabs, one field of each type, required and patterned fields, IDs no other fixture uses).

### 9. Versions

The input format (the new props, the PickField's props), the board document and the tool envelopes (their compositions) move in task 1.2, the first change to a registered type's props; the output format (the PickField's result) in task 3.3, its registration. Each takes the next minor after the base's while building and is bound at the rebase (task 5.2) at `main`'s minor plus one, after `atoms` and `layouts` have merged. The board protocol, the Snapshot data, the view manifest and the rest keep `main`'s. Comments, schema descriptions and test titles say "since form-widget".

### 10. The end-to-end proof

| Scenario | Where |
|---|---|
| A Form of every field type in Groups inside Tabs answered through `collect`; the remount check; a required field and a pattern blocking "Answer" across a reload; `fetch` of a PickField; Enter sends nothing | browser, session process (task 4.1) |
| A Snapshot of an answered Form, from `file://` | browser (task 4.2) |
| The PickField's keyboard, filter and counts; the TextField's errors; the required mark; the Tabs mark; Italian; hover | browser (tasks 3.2, 3.3) |

No conformance file (open question 10): the answer event, the push message and `collect` carry results generically, and `ask-core`'s refusal is covered in `core`.

## Merge points

Borrowed from `origin/main` 1a7482e2 (task 0.2 records each with its file and line): `WidgetType`, `WIDGET_TYPES`, `widgetTypeOf`, `widgetRegistryProblems`, `widgetResultFits`, `widgetResultProblems`, `resultHoldsNothing`, `withWidgetTypes`, `ID_PATTERN`, `VIEW_ID_PREFIX`, `answerRequirementProblem`, `widgetContentOf` (`WidgetContent`), `answered` (`core/src/lifecycle/acts.ts`), `ComponentFacts` (`fits`, `reason`), `register`, `componentFacts`, `useStrings`, `useLocale`, `cardState`, `draftRecordOf`, `restoreDraft`, `LIBRARY_CHUNKS` (`radix`: `RadioGroup`, `Checkbox`), `COMPONENT_ROOTS`, `widgetChunkProblems`, `BUDGETS`, `build:skills`, `check:skills`, `skills-examples.test.ts`, `component-facts.test.ts`, `hover-audit.browser.ts`, `languages.browser.ts`.

Borrowed from `atoms`, not on `main` (PR #57; read on this base at 442850f8, the PR's head b1568f02 being the same work rebased onto 1a7482e2): `TEXT_FIELD_WIDGET`, `NUMBER_FIELD_WIDGET`, `MONEY_FIELD_WIDGET`, `DATE_FIELD_WIDGET`, `TOGGLE_WIDGET` and their `checks.ts` functions and `KEYS`, `ATOM_TYPES`, `codePointCount`, `ATOM_LABEL_MAX_CHARS`, `ATOM_DESCRIPTION_MAX_CHARS`, `TEXT_FIELD_MAX_CHARS`, `catalog/fields/` (`Field`, `classes.ts`, `entry-field.tsx`), the five field chunks, `ItemProps.entry`, `shell/entries.ts` (`entryIdsOf`, `entryBlock`, `holdsEntry`, `answerHint`, `labelOf`), `cardState`'s `entry`, `submit.ts`' entry checks (`selectRecommended`, `submitPress`, `confirmedPress`, `submitStateOf`), the `question.entryHint` and `toggle.clear` strings, `tools/build/skills/atoms-skill.test.ts`.

Borrowed from `layouts`, not on `main` (this branch's base 886739d3): `nestedItemsOf`, `LAYOUT_MAX_DEPTH` (contract `nested-items.ts`), `WidgetContent.sent` at every depth, `valueItemsOf` and `nestedItemById` (view `nested-items.ts`), `BoardContent.entries`, `withEntries`, `GROUP_WIDGET`, `TABS_WIDGET`, `LAYOUT_WIDGETS`, the `{{layoutNote}}` slot (`tools/build/skills/generate.ts`), `layouts.browser.ts` and `tabs.browser.ts` (patterns), `tools/nested-items.test.ts` (any new direct read of `items` goes in its tables).

Tasks 0.2 and 5.2 re-check each; a difference stops the work for `/opsx:update`.

Changes in flight:

- **`atoms`** (PR #57, open). Overlaps: the five input atoms' props, checks and chunks (this change appends keys and a check to each); `shell/entries.ts` and its readers (the field block replaces the entry block's use); `WIDGET_TYPES`; the four sets (atoms binds first); `ux-update-draft.md` (its Atoms Voice and Tone row stands above this change's Form row); the strings tables, `chunk-sizes.json`, `skills/askboard/`, `CHANGELOG.md`, CLAUDE.md's lines.
- **`layouts`** (the base; no pull request yet; binds after `atoms`). Overlaps: `withEntries` and `BoardContent.entries`, the skill's layout note, the three sets it widens, `WIDGET_TYPES` (the PickField follows `tabs`), the source guard's tables. Rebase plan: when `atoms` merges, `layouts` rebases with `git rebase --onto origin/main 442850f8` and this branch follows with `git rebase --onto <layouts' new head> 886739d3`; when `layouts` merges, `git rebase --onto origin/main <layouts' last commit in this branch>`.
- **`diagram-render`** (proposed on `worktree-feature-diagram-render` at 9281d923, waiting). Overlaps: `WIDGET_TYPES` order, the input format, the board document and the tool envelopes (whichever merges second rebinds), the skill's budget.
- **`latex-public-api`'s archive** (PR #58): CLAUDE.md's Status line only.
- **`early-benchmark`** and the spikes: no overlap.

Seams this change creates, which later changes borrow once it merges: `FieldCheckFailure`, `WidgetType.fieldCheck`, `widgetFieldCheck`, `fieldCheckMessage`, `fieldCheckProp`, `patternProblem`, `ComponentFacts.check`, `shell/field-block.ts` (`fieldBlock`), the PickField and `FORM_TYPES`, the `{{formNote}}` slot. The Table's typed cells and Document review's fields borrow the field checks.

## Risks / Trade-offs

- [An agent pattern backtracks on the user's text and stalls the view] → the subset leaves no exponential nesting and a cost budget of 3 repetitions bounds the unrolled forms, a patterned field holds at most 100 characters (worst case about 341 ms on Node 24, a margin of 1.5 to the 500 ms gate), the session process never runs it, each keystroke costs at most one run, for the field whose text changed (the pattern check keeps its outcome per pattern and text in a memo of 64 entries, least recently used first, so the board's readers share one run; task 3.5), and the figures of tasks 1.12 and 1.16 go to Known limits (PO rule).
- [A reader of the entry block is missed, so one path sends past a failing check] → `ask-core` refuses `required`, lengths and counts whatever the board does; task 3.1 tests each path (Answer, Accept recommended, Select recommended, Submit, the held mark) with a check failing and with an empty required field.
- [The field check and the result check disagree on what fits] → one test per type that each failure code leaves `widgetResultFits` true and each `result.problems` failure makes it false.
- [A required field in a hidden tab cannot be found] → the description names its label; tabs are at most 8 (open question 6 records the alternative).
- [The skill passes 9,000 characters] → short texts measured in task 1.3; an overrun stops for `/opsx:update`.
- [Radix's documented arrow keys pick while moving] → a pick only fills the draft (AD-10); the keyboard test pins it.

## Migration Plan

None: four sets widen by optional props, one type and its result. One session process serves the board page and `board-host`, so their minors move together. Rollback is a revert, then `bun run build:skills`.

## Open Questions

- **Sources that disagree**, settled by the proposal's answers and the drafts: the spine's Stack pins RJSF and EXPERIENCE's Form library is RJSF's (open question 1); EXPERIENCE puts field checks in the compute graph and the roadmap row "via compute `fields`" (open question 3); EXPERIENCE's Form row allows a dropdown that the renderer spike ruled out, which DESIGN already says (blocks 2 and 7).
- DESIGN's Form row cites "the Choice atom's filter field for a long list"; the Choice has none, so the PickField carries its own (decision 4).
- The question's Choice relies on cancelling an undocumented Radix click for manual activation, against the PO's rule of 2026-11-07; this change does not touch it (proposal, open question 12) and reports it to the PO.
- The proposal's twelve questions carry their defaults, accepted under the PO's unattended handoff (2026-11-07); a different answer comes back through `/opsx:update` before the groups it touches.
