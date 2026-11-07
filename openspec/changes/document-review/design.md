# Design

## Context

See proposal.md for why. Read on `origin/main` e87841d5 (`atoms` merged as #57, `latex-public-api` archived as #58), with `layouts` (branch head ba7b6732, rebased on e87841d5) and `form-widget` (branch head 095c16c4, stacked on `layouts`, at its task 1.4) still in flight:

- **The registry** (`contract/src/widgets/registry.ts`): `WidgetType` with `props`, `propsProblems`, `result? {schema, shape?, problems?, answerProblems?}`, `wording`, `example`, `skill? {use, notes?}` (`SKILL_USE_MAX` 200); `WIDGET_TYPES` ends with the atoms on `main`, then, once they merge, layouts' `stack`, `row`, `group`, `tabs` and form's `pick-field`. `widgetResultFits` (shape, then `result.problems`) decides what the board page and the shell hold; `ask-core` checks each result against the props of the revision the answer names.
- **The annotation** (`schemas/output/annotation.json`, widget-registry decision 7): `{id, target: {selector}, body: {text}}`, six selectors, `quote` being `{exact (1–2,000), prefix? (≤200), suffix? (≤200)}`. No registered type references it yet.
- **The Markdown renderer** (`view/src/catalog/text/markdown.ts`, atoms decision 5): markdown-it (`html: false`, no linkify, nesting 20) then DOMPurify (exact tags and attributes, `RETURN_DOM_FRAGMENT`), a source of at most 10,000 code points and HTML of at most 200,000 characters, past which the item shows its source as plain text; controls shown as `\uXXXX` through `agentTextRuns`. `links.ts` (`mountMarkdown`, `markExternal`) handles the anchors; the board page's `markdown-links.ts` (`holdsMarkdown`, `openLinkRefusal`) re-checks a link's item and URL. Its header already says "Document review renders through this module too"; atoms decision 4 says markdown-it and DOMPurify move to a library chunk when Document review needs them. The `text` chunk is 150,006 bytes.
- **Imports** (AD-1, `tools/check-imports.ts`): `widgets` imports only `contract`, `compute` and `view/catalog`; library chunks share modules through `LIBRARY_CHUNKS` and, for AskBoard's own files, `BY_PATH` (`tools/build/shared-modules.ts`; the port and `board-graph` are mapped so).
- **Revisions and drafts** (AD-20): the shell keeps a held result across an agent's change while the chunk's `fits` says it fits; form-widget adds `ComponentFacts.check` and the field block, which stop every answer path while a field's check fails.
- **UX**: EXPERIENCE gives the Document review one row (select a passage, comment or suggest, quote or position anchors), the Annotation pin's rule (a pin whose match is gone or ambiguous is listed as detached, never dropped or guessed) and the Comment card; DESIGN gives the look (`body-lg`, `change-subtle` with a `change` underline and a numbered pin, a suggested edit struck through with the suggestion in `change-text`, marks through classes). The Accessibility Floor has no Document review line. SOLUTION-DESIGN's component table lists `@tiptap/core` as passing; EXPERIENCE chose "Own, on the Markdown renderer" (the UX documents choose components).
- **The skill** (`tools/build/skills/`): 8,755 of 9,000 characters on form's head without the PickField registered, about 8,987 with it (form-widget decision 7). Its item index line is `- a Tree (\`tree\`): <use> → [tree](references/widgets/tree.md)`. Claude Code's skills documentation (read 2026-11-08) advises Markdown links from `SKILL.md` to supporting files, "loaded when needed", `SKILL.md` "under 500 lines", and keeps the first 5,000 tokens of each invoked skill after compaction.

ADs relied on: AD-1 (imports; amended in place by `spine-update-draft.md` block 1), AD-6 (worded problems, generated teaching), AD-7 (registry, annotations, view-made IDs; block 2), AD-8 (agent content as data, the sanitizer, links through the board page, no `style` attribute), AD-9 (one chunk per component, library chunks, no edit state in components; block 3), AD-10 (fail closed), AD-15 (Snapshots), AD-19 (no new dependency), AD-20 (results in the draft and the answer). Nothing here depends on Claude Code's run-time behaviour: the skill keeps the documented link form, so no item needs a probe. Browser behaviour in the sandboxed view (selection, a popover anchored to a portal) is probed in task 0.4.

## Goals / Non-Goals

**Goals:**

- A Document review is a registration: a contract folder, one registry line, a chunk, its teaching text; the annotation shape is settled for the later annotating widgets.
- A quote is placed by one rule, never by a guess; a quote that has lost its place blocks the answer until the user removes it.
- One Markdown renderer for every component that renders Markdown, loaded only by boards that need it.

**Non-Goals:**

- Placing quotes in `ask-core` (open question 4), quotes of the Markdown source (open question 3), position selectors, re-attaching, overlaps, a pointer document (proposal, Not in this change).

## Decisions

### 1. The type and its props (open questions 1 and 2)

`packages/contract/src/widgets/document-review/` in the Chart's layout (`document-review-props.json`, `document-review-result.json`, `constants.ts`, plain `checks.ts` and `anchors.ts`, `wording.ts`, `widget.ts`, `index.ts`); type `document-review`, noun "a Document review", appended to `WIDGET_TYPES` after `pick-field`.

- `markdown`: 1 to `DOCUMENT_REVIEW_MAX_CHARS` (= `TEXT_MAX_CHARS`, 10,000, the renderer's bound) code points, refusing every character `agentTextRuns` would escape except line feed and tab; the problem names the first such character as its escape. One predicate decides it: notice-text's escape rule, exported in an appended block (`isEscapedCodePoint`), so the contract has one list of escaped characters.
- `title`: 1 to 120 code points, as the Chart's.
- Why refuse controls: the renderer shows them as six-character escapes, which a quote would then hold and the agent's source would not; a carriage return is normalised away by markdown-it. Refusing them keeps every character of a quote the agent's own, apart from Markdown marks.

*Alternatives:* `text` plus `format` as the Text has (open question 2); a pointer resolved at send time (open question 1).

### 2. The annotation body (open question 5; AD-7 amended in place)

`annotation.json`'s body becomes `{text?, replacement?}` with `minProperties: 1`: `text` as before, `replacement` 0 to `ANNOTATION_REPLACEMENT_MAX_CHARS` = 4,000 code points (beside `ANNOTATION_MAX_CHARS` in `lifecycle-limits.ts`). A suggested edit is an annotation whose body holds `replacement`, after the W3C model's editing motivation; an empty replacement deletes the target's text. Making `text` optional and adding a field is minor-compatible (askboard-contract-versioning). A later type that takes comments only requires `body.text` in its own result schema. The output format's constant moves in task 1.1.

*Alternatives:* a separate `edits` list beside the annotations (two shapes for one act); `body.text` as the replacement under a motivation field (no deletion, no note).

### 3. The result (open questions 7 and 10)

`{annotations}`: 1 to `DOCUMENT_REVIEW_ANNOTATIONS_MAX` = 100 items, each the annotation through `$ref` narrowed by `allOf` to a `quote` selector, no combinator at the root (the registry's empty-result rule). `shape` restates the schema in plain code; `problems(result, props)` adds: each ID starts with `VIEW_ID_PREFIX` and is unique (a `Set`, so `__proto__` is an ID like any other and refused for its missing prefix); `exact` holds a code point that is not white space and is no longer than the props' `markdown`; `exact`, `prefix` and `suffix` hold no character decision 1 refuses; a `replacement` differs from its `exact`. Problems name the item and `annotation "u-3"`. No `answerProblems`; no registry `fieldCheck` (form-widget's), since `ask-core` cannot place a quote.

### 4. Placing and quoting (open questions 3 and 10)

`anchors.ts`, plain ECMAScript with no regular expression over agent text:

- `quotePassage(text, start, end)`: the exact text and up to `QUOTE_CONTEXT_CHARS` = 32 code points of context on each side, widened to 64, 128 and `QUOTE_CONTEXT_MAX_CHARS` = 200 until the joined quote occurs once; a refusal `blank`, `too-long` (over 2,000 code points) or `repeated`. Offsets are UTF-16 indices of the text; boundaries never split a surrogate pair.
- `placeQuote(text, quote)`: the place of `prefix + exact + suffix` when it occurs exactly once (counting overlapping occurrences, and stopping at the second), else `missing` or `ambiguous`.
- `placeAnnotations(text, annotations)`: each annotation's place, or `detached` with its reason; of two whose places overlap, the later in the result is detached as `overlaps`.

`quotePassage` and `placeQuote` agree by construction: a test places every quote it makes, over generated texts.

### 5. The text a quote quotes, and who places it (open questions 3 and 4)

The **reading text** is the document as the user reads it: the concatenated text nodes of the sanitized fragment the shared renderer returns, in document order, or the source when the renderer shows plain text. One function in the widget (`readingText(markdown, win)`, cached by source) gives it to the component and to the chunk's `check`, so the two never differ. Only the view can compute it: `ask-core` has no DOM (AD-1) and Markdown renders only in the view (AD-8). `ask-core` checks shapes, IDs and bounds (decision 3); a quote the text does not hold could reach it only in a board message forged with the board's token, which could as well pick any option, the reasoning of form-widget decision 3 for the TextField's pattern. The skill tells the agent to ask when it cannot find a quote, never to guess.

*Alternative:* markdown-it in `contract`, the reading text derived from its HTML in both layers: a renderer dependency in the session process and AD-8 amended, for a check a forged message could still pass.

### 6. The shared Markdown renderer (open question 12; AD-1 and AD-9 amended in place)

`packages/view/src/markdown/` takes `markdown.ts`, `links.ts` and `classes.ts` from `catalog/text/` with their tests, and an `index.ts` exporting what the Text and the Document review use. `view/package.json` exports `./markdown`. `LIBRARY_CHUNKS.markdown` provides `@askboard/view/markdown` (an exact list of names), and `BY_PATH` maps the file for the Text inside `view`, as the port is mapped; the build records the library among each importing chunk's needs, so `assemble` inlines it only for boards and Snapshots whose items render Markdown. `tools/check-imports.ts`: `widgets` may also import `view/markdown`. Licence notices follow the code into the library chunk, and `exceptedPackageProblems` still finds `argparse` in no chunk. The library chunk's stylesheet carries the Markdown element classes, so a Document review is styled as a Text is. `chunk-sizes.json` is re-recorded with the reason.

*Alternative:* the Document review as a catalog component in `view`, beside the atoms (open question 12): no import rule changes, but an FR-11 widget outside `widgets` against the Structural Seed, and still a library chunk to avoid two copies.

### 7. The component (`packages/widgets/src/document-review/`)

Pure modules over structural node interfaces, as `links.ts` is, so they run in Bun without a DOM:

- `reading.ts`: the reading text and the blocks (the innermost `p`, `h1`–`h6`, `li`, `pre`, `td`, `th` holding text) of a fragment; a selection's boundary points as reading-text offsets, skipping every element the widget adds, which carries `data-review-ui` (the sanitizer drops every data attribute of agent content, `ALLOW_DATA_ATTR: false`).
- `model.ts`: add, edit and delete annotations; the refusals (decision 4's, plus `outside`, `several-ranges`, `overlaps`); the next view-made ID (`u-` and the lowest free number); the result, `undefined` with no annotation; `check` (decision 8).
- `marks.ts`: the mark plan for the placed annotations, applied to a fresh clone of the fragment when the places change: each text node segment of a passage wrapped in a `span` with fixed classes and `data-review-mark` (its text stays in the reading text), then, after the passage, an element with `data-review-ui` holding the pin's placeholder and, for a suggested edit, a text node holding the replacement (both left out of the reading text). Typing in a card updates that text node in place; nothing re-applies while the places stay. Agent and user text reach the DOM only as text nodes; no `style` attribute, no `innerHTML`.
- `index.tsx`: the widget frame; the toolbar ("Comment", "Suggest edit", one Tab stop as the Ranking's); the counter; the document (one Tab stop, decision 9); pins rendered by React through `createPortal` into the placeholders; the comment card as Radix `Popover`, non-modal, from the `radix` library chunk, anchored to its pin, as the DateField's calendar; the detached list under the document; the selection refusal in a polite live region beside the toolbar. Ready after the first layout with marks applied.

Registered with `{fits: widgetResultFits over the contract's functions, check, name}`: `fits` is structural, so a revision keeps the result and the component re-places it.

### 8. Detached annotations block the answer (open question 6)

The chunk registers form-widget's `ComponentFacts.check(result, props)`: `placeAnnotations(readingText(props.markdown), result.annotations)`, giving `{code: "detached", count}` when any is detached. This change appends that member to `FieldCheckFailure` and its case to `fieldCheckMessage`; form's field block then stops "Answer", "Accept recommended", "Select recommended", Submit and the held mark, and `withEntries` marks a hidden tab (`kind: "check"`). The hint reads "Delete the detached comments in {label} first.", the label being the `title`, else "the document". Detached annotations stay in the draft until the user deletes them (EXPERIENCE: never silently dropped or guessed).

*Alternatives:* "Attach to selection" (more UI, open question 6); dropping them through `fits` (the user's work lost whole, as a Chart's highlights are).

### 9. Cards and the keyboard (open question 9)

- **Cards write as the user types** (AD-9): a new comment becomes an annotation at its first non-blank character; emptying its text removes it while the card, holding the passage as view state, stays open. A suggestion is held while its replacement differs from the passage or its note holds text. "Done", Escape and the close control close the card; focus returns to the pin, or to the document when the pin is gone. EXPERIENCE's and DESIGN's Comment card rows say "Done" in place of a save action (`ux-update-draft.md`), which the Diagram and the Image annotation inherit.
- **Pointer**: the widget follows `selectionchange` and keeps the last selection inside the document as offsets; the toolbar's buttons prevent their `mousedown` default, so pressing one keeps the selection. A selection reaching outside the document is cut to it; several ranges (Firefox) are refused.
- **Keyboard** (EXPERIENCE, Accessibility Floor, block 3 of the draft): the document is one Tab stop; Up, Down, Home and End move the current block, which takes focus (`tabindex="-1"`, an outline class); Left and Right move between its pins; Enter opens the current pin's card. With no selection, the toolbar anchors the current block's text, trimmed of white space, through `quotePassage`, so a repeated or over-long block is refused with its message.

### 10. Links (AD-8)

The Document review mounts its fragment through the shared `mountMarkdown`, so a click on a link sends the open-link message on the board and opens natively in a Snapshot. `holdsMarkdown` holds also for a `document-review` item, found through layouts' walker at any depth; the URL check stays `isLinkUrl`, the one predicate of both layers.

### 11. Registration waits for the chunk

As in atoms decision 10, `DOCUMENT_REVIEW_WIDGET` joins `WIDGET_TYPES` only in task 6.3; until then tests pass `withWidgetTypes(...DOCUMENT_REVIEW_TYPES)` from `fixtures/document-review.ts`, which also holds an item, results, an `act` and an answer event with `version` from the constants.

### 12. The skill's index (open question 11)

The generator writes each index line as `` - [`<type>`](<reference>): <use> `` (widget types, molecules and context items alike). `SKILL_USE_MAX` falls to 70 (the registry's `skill` rule), the generator checks the molecules' and context items' uses against the same bound, and the uses over it are shortened, what they drop moving to a note, which the type's reference shows. On form's head this saves 466 characters (the format) and about 340 (the bound); the Document review's line adds about 110, so `SKILL.md` lands near 8,300 characters, leaving room for about six more lines. The budget stays 9,000 (askboard-skills decision 7); a change that needs more raises it from the early benchmark's figures, within the documented 500 lines and 5,000 tokens. Task 2.1's test generates the skill with the Document review and every budget; an overrun stops the task for `/opsx:update`.

*Alternatives:* a raised budget now, with no benchmark figure; an index file, which the documentation's guidance of one level of references argues against and which costs one more read.

### 13. Versions

The input format (the props, the question composition), the output format (the annotation's `replacement`, the result), the tool envelopes and the board document (their compositions) each take the next minor after `main`'s. The output format's constant moves in task 1.1, the first change to what it admits; the other three in task 6.3, the registration. The board protocol, the Snapshot data, the view manifest and the rest keep `main`'s. Comments, schema descriptions and test titles say "since document-review". Task 8.2 binds each at `main`'s minor plus one, after `layouts` and `form-widget` have bound theirs.

### 14. The end-to-end proof

| Scenario | Where |
|---|---|
| A comment and a suggested edit answered through `collect`; a reload; the agent's change detaching a comment, which blocks "Answer" until deleted; `fetch` of the item; a link opened through the board page; a Document review nested in a Group inside a Tabs | browser, session process (task 7.1) |
| A Snapshot of an answered Document review, from `file://` | browser (task 7.2) |
| Keyboard, Italian, hover, 200-character words at 1,280 pixels | browser (tasks 6.2, 7.3) |
| One answer with annotations whose quotes hold line breaks, pushed by the mod or collected, each configuration, Bun and Node 24 | conformance (task 7.4) |

## Merge points

Borrowed from `origin/main` e87841d5 (task 0.2 records each with its file and line): `WidgetType`, `WIDGET_TYPES`, `widgetTypeOf`, `SKILL_USE_MAX`, `widgetRegistryProblems`, `widgetResultFits`, `widgetResultProblems`, `resultHoldsNothing`, `annotationProblems`, `EMPTY_RESULTS`, `withWidgetTypes`, `VIEW_ID_PREFIX`, `ID_PATTERN`, `ANNOTATION_MAX_CHARS`, `ANSWER_EVENT_MAX_CHARS`, `TEXT_MAX_CHARS`, `codePointCount`, `agentTextRuns`, `isLinkUrl`, `renderMarkdown`, `markdownHtml`, `sanitizerFor`, `MARKDOWN_MAX_CHARS`, `MARKDOWN_HTML_MAX_CHARS`, `mountMarkdown`, `markExternal`, `MARKDOWN`, `PLAIN`, `holdsMarkdown`, `openLinkRefusal`, `boardItemOf`, `ViewOpenLink`, `ItemProps`, `ComponentFacts` (`fits`, `name`), `register`, `componentFacts`, `questionTextId`, `useHosted`, `useOpenLink`, `useReadyAfterLayout`, `useStrings`, `useLocale`, `LIBRARY_CHUNKS` (`radix`: `Popover`), `BY_PATH`, `CATALOG_PORT`, `COMPONENT_ROOTS`, `widgetChunkProblems`, `exceptedPackageProblems`, `generateSkill`, `budgetReport`, `BUDGETS`, `MOLECULE_SKILLS`, `build:skills`, `check:skills`, `skills-examples.test.ts`, `component-facts.test.ts`, `hover-audit.browser.ts`, `languages.browser.ts`, `widget-results.e2e.ts` and `run.ts` (conformance).

Borrowed from `layouts`, not on `main` (branch head ba7b6732): `nestedItemsOf` and `layoutListsOf` (contract), the view's walker as `markdown-links.ts` and `board-content.ts` read it, `nestedRenderedOf`, `BoardContent.entries`, `GROUP_WIDGET`, `TABS_WIDGET`, `LAYOUT_WIDGETS`, `tools/nested-items.test.ts` (this change plans no new direct read of `items`; one would go in its tables), `layouts.browser.ts` and `tabs.browser.ts` (patterns).

Borrowed from `form-widget`, not on `main` (design.md at branch head 095c16c4; the view seams are not built yet): `FieldCheckFailure` and `fieldCheckMessage` (`contract/src/widgets/field-checks.ts`; one member and one case appended), `ComponentFacts.check`, `fieldBlock` (`shell/field-block.ts`), `withEntries`' `kind: "check"`, `answerHint`'s hint for a failing check, `PICK_FIELD_WIDGET` (the order of `WIDGET_TYPES`), `{{formNote}}` and `form-skill.test.ts` (its index-line assertion moves with decision 12).

Tasks 0.2 and 8.2 re-check each; a difference stops the work for `/opsx:update`.

Changes in flight:

- **`layouts`** (pull request about to open; it binds the input format, the tool envelopes and the board document one minor past `main`'s). Overlaps: `WIDGET_TYPES`, the three sets it widens (it binds first), `markdown-links.ts` (its walker; this change adds one predicate to `holdsMarkdown`), `componentsOf`, the source guard's tables, `skills/askboard/` (regenerate, never resolve), `chunk-sizes.json`, `CHANGELOG.md`, CLAUDE.md.
- **`form-widget`** (stacked on `layouts`; binds input, envelopes and board document one past layouts', and the output format). Overlaps: the four sets, `field-checks.ts` (an appended member), `shell/field-block.ts` and its readers, `ComponentFacts`, `generate.ts` and the skill tests (decision 12 changes the line format they assert), the PickField's `use`, the strings tables, `ux-update-draft.md` blocks near this change's (none on the same lines), `chunk-sizes.json`, `CHANGELOG.md`, CLAUDE.md.
- Plan: this change is built on `origin/main` after both have merged; task 0.2 checks it and stops otherwise.
- **`diagram-render`** (proposed at 9281d923, waiting). Overlaps: `WIDGET_TYPES` order, the input format, the board document and the tool envelopes (whichever merges second rebinds), the skill's budget (its line must fit decision 12's format), the annotation body (`diagram-annotations`, after it, requires `body.text` in its own result schema).
- **PR #59** (archives `atoms`, syncing its specs). This change's deltas add requirements and modify only "The annotation shape", already on `main`.
- **`early-benchmark`** and the spikes: no overlap.

Seams this change creates, which later changes borrow once it merges: `@askboard/view/markdown` and the `markdown` library chunk; the annotation body's `replacement` and `ANNOTATION_REPLACEMENT_MAX_CHARS`; `quotePassage`, `placeQuote`, `placeAnnotations`; the `detached` field-check code; the index line format and the 70-character use; `DOCUMENT_REVIEW_TYPES`. The Diff review and the Image annotation borrow the annotation, the card and the detached list's pattern.

## Risks / Trade-offs

- [Selection differs across engines in the sandboxed frame, or the shell sets `user-select: none` around items] → task 0.4 probes selection, `selectionchange`, `mousedown` on the toolbar and the portal-anchored popover in Chromium, Firefox and WebKit; offsets come from the widget's own walk, never from `Selection.toString()`.
- [The component and the check disagree on the reading text] → one cached function; a browser test reloads and compares places.
- [The agent cannot find a quote in its Markdown (marks, entities or a link inside the passage)] → `prefix` and `suffix` locate it; the teaching text says to ask rather than guess; CHANGELOG Known limits says so.
- [A block over 2,000 characters cannot be commented on from the keyboard] → the message asks for a pointer selection; Known limits.
- [Placing quotes is slow on a crafted repetitive document] → each search stops at its second occurrence and runs only when the places change; task 1.4 times 100 quotes over 10,000 characters of prose and of one repeated character in Bun, and the figure goes to Known limits if over 50 ms (PO rule of 2026-11-07).
- [The marks breach the sanitizer's guarantees] → only fixed classes and `data-review-ui` on the widget's own elements; a test walks a marked container and finds no other attribute outside DOMPurify's allow-list; security checkpoints at tasks 5.4 and 6.5.
- [The line format breaks other changes' skill tests] → task 2.1 updates them on the rebased base; `diagram-render` writes its line in the new format.
- [The shared annotation change binds later widgets] → the body's members are optional; a type narrows them in its own result schema (decision 2).
- [`layouts`' or `form-widget`'s seams merge with other names or shapes] → task 0.2 stops for `/opsx:update`.

## Migration Plan

None: four sets widen by one type, its result and an optional annotation field; the board protocol and the Snapshot data do not change. One session process serves the board page and `board-host`, so their minors move together. Rollback is a revert, then `bun run build:skills`.

## Open Questions

- The proposal's twelve questions carry proposed defaults; task 0.1 records their answers, and a different answer comes back through `/opsx:update` before the groups it touches.
- **Sources that differ**: EXPERIENCE's Document review rows allow "quote or position anchors"; this change takes quotes only, and `ux-update-draft.md` blocks 2 and 4 say so. AD-7 keeps both selectors in the format's vocabulary. SOLUTION-DESIGN's `@tiptap/core` row stays as what the adoption rule admits; it adds no rule.
