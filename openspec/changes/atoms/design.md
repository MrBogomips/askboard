# Design

## Context

See proposal.md for why. Read on `origin/main` ea05608f (`latex-kanban-timeline` merged and archived):

- **The registry** (`contract/src/widgets/registry.ts`): `WidgetType` with `props`, `propsProblems`, `edits?`, `result? {schema, shape?, problems?, answerProblems?}`, `derived?`, `wording`, `example`, `skill?`; `WIDGET_TYPES` (Tree, Gantt, Approval, Scale, Ranking, LaTeX, Kanban, Timeline); `NON_WIDGET_ITEM_TYPES` and the base `$defs` names a type may not take (none of the eight names below is taken). The Scale is the pattern of a type that gives a result and edits nothing (`widgets/scale/`).
- **Results** (`widgets/results.ts`, `result-fits.ts`, `result-content.ts`): `widgetResultProblems`, `widgetResultFits`, `resultHoldsNothing` (`""` and `null` hold nothing, `false` and `0` are content). `ask-core` checks each result; the answer event's `results` are keyed by item ID.
- **Locale entry** (`contract/src/locale/entry.ts`, settings-languages): `parseNumber`, `parseDate`, `numberEcho`, `dateEcho`, refusals worded by `entry-texts.ts`; `formatNumber`, `formatPercent`, `formatMoney`, `formatLongDate`, `tableOf` (month and weekday names), `MINOR_UNITS`, `DEFAULT_MINOR_UNITS`. No amount parser exists.
- **The view** (`packages/view/src/catalog/`): `port.ts` (`ItemProps` with `result` and `onResultChange`, `ComponentFacts.fits`, `register`, `useReadyAfterLayout`, `useStrings`, `useLocale`); `components.ts` (`renderedOf`, `componentsOf`); Choice's previews as plain text (`choice/option-details.tsx`). The build makes one component chunk per folder of `catalog/` or `packages/widgets/src/` holding `index.tsx` (`tools/build/chunks.ts`, `COMPONENT_ROOTS`); `widgetChunkProblems` requires a chunk for every registered type, through `chunkComponents`.
- **Answer and the draft** (`view/src/shell/question-state.ts`, `board-draft.ts`): `draftAnswerOf` carries the results the question's items hold; `cardState.canAnswer` reads the draft; `draftRecordOf` and `restoreDraft` mirror and restore it; the draft record schema (`contract/src/schemas/board-protocol/draft-record.json`) holds per question `values`, `results`, `other`, `optionNotes`, `note`, `composer`, `context`, `held`; `draftRecordProblems` checks its keys against the board document.
- **Links**: a web reference opens through `ViewOpenReference`, the page reading the URL from the board document and calling `openLink` (`board-page/controller.ts` `#openReference`, `start.ts`: `window.open(url, "_blank", "noopener,noreferrer")`).
- **The renderer spike** (`openspec/changes/spike-renderer/`): markdown-it with DOMPurify fails the view CSP only by markdown-it's table alignment `style` attributes, fixed by alignment classes (findings, row 14, `c-markdown-classes`; probe `components/markdown.tsx`); Chromium also reports `style` attributes DOMPurify's parse meets (findings, Diagram), so no `style` may reach it. react-day-picker in Radix's non-modal Popover passes in the five engines (`c-date-picker`). The probe has a component per atom and layout.
- **Licences**: `tools/check-licences.ts` has no named exception; markdown-it's `argparse` (PSF-2.0) is the addendum's named exception, needed only by its command line.
- **The skill**: `SKILL.md` is 6,816 characters of a 9,000 budget, one line per type (`tools/build/skills/budgets.ts`).

ADs relied on: AD-1 (imports; `contract` plain ECMAScript), AD-6 (worded problems, generated teaching), AD-7 (registry, IDs, values; amended by `spine-update-draft.md` block 1), AD-8 (agent content as data, Markdown only through a sanitizer, links; amended by block 2), AD-9 (atoms are catalog components in `view`, one chunk per component, no edit state of their own, ready rule), AD-10 (nothing set for the user, fail closed), AD-12 (no pointer here; images in Markdown are links, never loaded), AD-15 (Snapshots), AD-19 (adoption rule, exact pins, named exceptions), AD-20 (results, drafts; amended by block 3). Nothing here depends on Claude Code's run-time behaviour beyond what `push-delivery` verified: no item needs a probe.

## Goals / Non-Goals

**Goals:**

- Each atom is a registration: a contract folder, one registry line, a chunk under `catalog/`, its strings and its teaching text. The shared parts (the amount parser, the Markdown renderer, entries in the draft, the link message) are generic, for the Form, Document review and the Table.
- An answer carries exactly what the fields show, and nothing while a field shows text it cannot read.
- Agent Markdown is data: nothing it holds runs, styles or loads.

**Non-Goals:**

- Layouts and nested items (`layouts`, proposal open question 1), Choice and Image as items (open question 3), a formula Value (open question 4), field checks beyond each type's bounds (open question 9), a `slider` type (open question 2).

## Decisions

### 1. Eight registry entries, kebab-case types (open questions 2 and 3)

Types, appended in this order after `main`'s (and after `chart` if it merges first): `text`, `value`, `divider`, `text-field`, `number-field`, `money-field`, `date-field`, `toggle`. Kebab-case, as the conventions write values; the type is also the chunk's folder and the `$id`'s stem (`urn:askboard:input:text-field-props`, `urn:askboard:output:text-field-result`). Each has `packages/contract/src/widgets/<type>/` in the Scale's layout (`<type>-props.json`, `<type>-result.json` for the input atoms, `constants.ts`, `checks.ts` plain with no Ajv so a chunk may import it, `wording.ts`, `widget.ts`, `index.ts`). Nouns: "a Text", "a Value", "a Divider", "a TextField", "a NumberField", "a MoneyField", "a DateField", "a Toggle". No entry declares `edits` or `derived`. Code points count lengths, as LaTeX's do. Props and result bounds are the contract delta's; bounds live in each `constants.ts`.

- **Results are bare values** (EXPERIENCE, Primitives, typed answers): a string, a number, `{amount, currency}`, a full-date, a boolean. Each `result.shape` is the schema's rule in plain code; `result.problems` checks the result against the props (bounds, step, line breaks, currency, minor units). The NumberField's step check is its own: on a step within a billionth of a step or, when wider, eight times `Number.EPSILON` of the magnitude, and props whose bounds make that tolerance reach a quarter step are refused (so an off-step double within the tolerance passes, such as 999999999999993 on a step of 8; checkpoints 2.3 and 4.4, S-1) (checkpoint 1.8 X-1, task 1.9; the Scale's widened tolerance stays the Scale's, bounded by its step count; the Scale's tests stay green).
- **Value** is one object schema keyed by `kind` with an `if`/`then` per kind (the Scale's result does this), or a `oneOf` whose errors the entry's `schemaErrors` words; task 1.2 picks whichever gives one worded problem per field. Its `date` uses the Gantt's `fullDate` pattern and `GANTT_FIRST_DATE`/`GANTT_LAST_DATE`; its money amount is checked by the amount parser's decimal pattern, never as a float.
- **Teaching text**: uses of at most 90 characters each, so `SKILL.md` stays within 9,000 (Risks). The Scale's `use` gains "(the Slider)" through its entry, regenerating the skill.

*Alternatives:* camelCase types (`textField`), which the conventions keep for field names; an `atoms` registry beside the widgets', which every unit would dispatch on twice (AD-7 names one registry).

### 2. The amount parser

`contract/src/locale/amount.ts`: `parseAmount(input, currency, locale, language = locale)` gives `{kind: "amount", amount}` (a decimal string with exactly the currency's minor units), `{kind: "empty"}` or `{kind: "refused", code, reason}`. It reuses `entry.ts`'s character, sign, mark and grouping rules by exporting its rule function unchanged, then splits the digits as text: no `Number()` on the amount. New refusal codes `decimals` ("EUR takes at most 2 decimals, as in 12.50.") and `too-large`, worded in `entry-texts.ts` for both languages. `amountEcho(amount, currency, locale)` gives `= 1234,50 EUR`. `compareDecimal(a, b)` (pure, on validated decimal strings) serves the MoneyField's bounds in `checks.ts` and in the component. The amount pattern `^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,4})?$` is the schema's, the minor units the check's.

### 3. Entries: unreadable text in the draft (open question 5; AD-20 amended)

The draft record's question gains `entries`: item ID to a string of 1 to `ENTRY_MAX_CHARS` = 200 characters (in `lifecycle-constants.ts`), the board protocol's next minor. `draftRecordProblems` refuses an entry key naming no item of its question, as for `values` and `results`. In the view:

- `ItemProps` gains `entry: string | undefined` and `onEntryChange(entry: string | undefined)`, appended; the shell keeps entries in a store beside the results store, mirrors them through `draftRecordOf`, restores them through `restoreDraft`, and drops an item's entry when the item is gone from the question (as `resultFits` drops results).
- A field holds its text as typed. On each input it parses: a value within bounds sets the result and clears the entry; empty clears both; anything else sets the entry to the text (cut at 200) and clears the result, and the field error shows the parser's reason or the bound broken. The field's text is the entry while one is held, else the result formatted for entry (`plainNumber`, the amount, `formatDate` in the entry's form); so the component keeps no edit state of its own (AD-9).
- `cardState.canAnswer` is false while the draft holds an entry for any item of the question; the "Answer" button's description names the first field in error (Voice and Tone).
- Inputs cap their text at 200 characters (the TextField at its `maxLength`, through code points, as the LaTeX's field does), so an entry always fits.

The TextField and the Toggle never hold an entry: any text within the cap is a value, and the Toggle has no text.

*Alternatives:* the text kept only by the component (lost on reload, and AD-9 keeps no edit state in components); the last good value sent (an answer the field does not show, NFR-10).

### 4. Chunks (AD-9)

One chunk per atom, `packages/view/src/catalog/<type>/index.tsx`, each registering its type with `{fits: (result, props) => widgetResultFits({type, id: ""}, result, props), name}` (the input atoms) or nothing (the display atoms). Shared field code (the label and description, the field error, the echo, the entry handling, the hover and focus classes) is `catalog/fields/`, a folder with no `index.tsx`, bundled into each field's chunk; it imports only the port, `radix-ui` through the `radix` library chunk, and `contract`'s plain modules. markdown-it and DOMPurify live in the `text` chunk; when Document review needs them they move to a library chunk. react-day-picker and the `date-fns` functions it uses live in the `date-field` chunk. Each new chunk's size is recorded with its reason (`askboard-implementation`).

*Alternative:* one `fields` chunk registering five types through `CHUNK_COMPONENTS`, smaller in total but against AD-9's one chunk per component; the per-chunk overhead of shared field code is a few kilobytes.

### 5. Markdown (open questions 7 and 8; AD-8 amended)

`catalog/text/markdown.ts` builds one renderer per chunk:

- markdown-it `{html: false, linkify: false, typographer: false, maxNesting: 20}`; `th_open` and `td_open` turn `style="text-align:x"` into the class `md-align-x` (the spike's rule); `validateLink` admits only `http:` and `https:` (a link that fails it stays its source text, markdown-it's own behaviour); `normalizeLink` stays markdown-it's.
- The `image` rule renders `<a href="src">alt</a>` when the source passes `validateLink`, else the alt text as text.
- The `text` and `code_inline`/`code_block`/`fence` rules mark bidirectional controls as visible escapes through `agentTextRuns` (`contract`), as the excerpts and the LaTeX's message do.
- DOMPurify, one instance on the view's `window`: `ALLOWED_TAGS` exactly `a, blockquote, br, code, del, em, h1–h6, hr, li, ol, p, pre, s, strong, table, tbody, td, th, thead, tr, ul`; `ALLOWED_ATTR` exactly `href, start, class`; `ALLOWED_URI_REGEXP` `^https?:`; `ALLOW_DATA_ATTR` and `ALLOW_ARIA_ATTR` false; a hook keeps a `class` only when it is one of the three alignment classes; `RETURN_DOM_FRAGMENT`, so the component appends nodes and never sets `innerHTML` from a string. markdown-it's output never holds a `style` attribute after the alignment rule, so DOMPurify's parse raises no CSP report (a test proves it in Chromium).
- The component (`catalog/text/index.tsx`) renders plain text as text with `whitespace-pre-wrap`, and Markdown into a container it fills once per source. A click or `auxclick` on a link inside is prevented; on the live board it sends `{type: "open-link", itemId, url}`; with no host (a Snapshot) the anchors carry `target="_blank" rel="noopener noreferrer"` and open natively.
- Option previews: `renderedOf` is unchanged, but `componentsOf` adds `text` for a question holding an option with `previewFormat: "markdown"`; Choice's preview calls `componentFor("text")` with a synthetic item `{type: "text", id: <previewId>, props: {text: preview, format: "markdown"}}` and its link messages name the question; the board page accepts a question item ID whose options hold a Markdown preview. If the component is missing, the preview shows as plain text (fail safe).
- Bounded work: the source is at most 10,000 code points (Text and preview alike), the rendered HTML is at most 200,000 characters before DOMPurify (past it the item shows its source as plain text: a reference definition repeated by many images or links grows a 10,000-code-point source to megabytes, checkpoint 1.8 X-2), nesting is cut at 20, and task 5.1 times pathological sources (nested quotes, lists, emphasis runs, brackets, backticks, tables of 500 cells) in Chromium and WebKit under 500 ms, the LaTeX's margin of 4 to the 2-second bound. A source over that is a stop for `/opsx:update`, never a raised bound.

### 6. The open-link message

`ViewOpenLink {type: "open-link", itemId, url}` is appended to `ViewMessage` (`view-protocol.ts`, with its reader's check: `itemId` an ID, `url` a string of at most 2,048 characters), and one handler to the controller's `#viewHandlers`. The handler opens through the existing `openLink` dependency only when `new URL(url)` parses with protocol `http:` or `https:`, and the board document's item `itemId` is a Text with `format: "markdown"` or a question whose options hold a Markdown preview; anything else is dropped with a console diagnostic naming the reason and no agent text. The view protocol is the view package's own, not a schema set, so no version moves for it.

*Alternative:* the page checks that the URL stands in the item's source; markdown-it's normalisation (percent-encoding, entity decoding) makes that check either loose or wrong, and the URL is agent content the user chose to open, as a web reference is (AD-8).

### 7. The fields (open questions 6, 10 and 11)

Per DESIGN, Input atoms: shadcn's Field, Label, Input, Input Group, Textarea, Switch and the Date Picker, with `{colors.input}` borders and the focus ring; labels stay visible.

- **TextField**: an Input, or a Textarea when `multiline`; its input handler keeps the first `maxLength` code points (no `maxLength` attribute, which counts UTF-16 units); an empty field holds no result.
- **NumberField**: a text input with `inputMode="decimal"`, the unit as an affix, the echo `numberEcho` beside it; bound and step refusals worded "At least {min}.", "At most {max}.", "A whole number.", "A multiple of {step} from {base}." in the ask's locale.
- **MoneyField**: the amount input with the currency affix, or, with `currencies`, a segmented control of the codes after the field (Radix Toggle Group in the segmented look), unset until picked; while no currency is picked a readable amount is an entry with "Pick a currency."; the echo `amountEcho`.
- **DateField**: a text input read by `parseDate`, the echo `dateEcho`, and a calendar button opening react-day-picker in Radix's non-modal Popover (spike `c-date-picker`). `formatters` (caption, weekday names) and `labels` (navigation, the day's accessible name) come from the contract's tables and the view's strings, so no `Intl` call and no date-fns locale is used; `weekStartsOn` 0 in en-US and 1 in it-IT; `startMonth` and `endMonth` from `min` and `max`, else the Gantt's dates; days outside them disabled. A picked `Date` becomes a full-date from its local year, month and day, and the shown month is built the same way, so no time zone shifts a day. Styling through `classNames` with the tokens, no package stylesheet (`CHUNK_STYLESHEETS` is the fallback if a class cannot reach an element).
- **Toggle**: a Radix Switch drawn off while unset, "Not set" beside it; a press sets the opposite of the shown state (first press on); "On" or "Off" then reads beside it, with a "Clear" `button-link`.
- **The echo stays** (EXPERIENCE, binding; Open Questions).
- Read-only (answered, locked, a Snapshot): the value formatted in the ask's locale (`formatNumber` with the unit, `formatMoney`, `formatLongDate`, "On"/"Off"), no echo, no error, no calendar button.

### 8. Display atoms

- **Value**: label in the label type, value in `{typography.code}` right-aligned: `formatNumber` (with the unit), `formatPercent`, `formatMoney`, `formatLongDate`, and days through a string with its plural ("12 days", "12 giorni").
- **Divider**: `<hr>` with the `divider` token, `role="separator"`, not focusable.
- Both and the Text report ready after their first layout; the Text after its Markdown has been appended.

### 9. Licences and adoption (AD-19, NFR-6)

The three packages are pinned exactly in `packages/view/package.json`; `date-fns` and `@date-fns/tz` come in as react-day-picker's dependencies. `tools/licence-exceptions.json` holds the addendum's named exceptions that `check:licences` admits: `{name, licence, reason, source, shippedIn: []}` for `argparse` (PSF-2.0, "markdown-it's command-line tool; no chunk"), an entry admitted only for its exact name, and the view build fails if any chunk's notices name an excepted package (the exception holds only while nothing ships it). The table admits nothing the addendum does not list; a test compares its names with the addendum's Licence exceptions line. DOMPurify's `(MPL-2.0 OR Apache-2.0)` passes `classify` as an OR with a permissive member (task 3.1 checks; if not, `licence-overrides.json` is not the fix: stop for `/opsx:update`).

### 10. Registration waits for the chunk

As in `latex-kanban-timeline` decision 12, an entry joins `WIDGET_TYPES` only in the task that adds its chunk (group 5). Until then tests pass `withWidgetTypes(...ATOM_TYPES)` from this change's fixtures module. Each registration task regenerates the skill.

### 11. Versions

The input format (option `previewFormat`, the atoms' props), the output format (the atoms' results), the tool envelopes and the board document (their composed schemas, the option field in their question schemas), and the board protocol (`entries`) each take the next minor after `main`'s (askboard-contract-versioning). Each constant moves in the first task that changes its set: the input format, the board document and the tool envelopes in task 1.6, the board protocol in task 1.7, the output format in task 5.3 (the first registered result). The view manifest, the Snapshot data and the rest keep `main`'s. Comments, schema descriptions and test titles say "since atoms", never a number. Task 7.2 binds each at `main`'s minor plus one.

### 12. The end-to-end proof

| Scenario | Where |
|---|---|
| An atom-only question answered on the session process; an entry blocking "Answer" and restored after a reload; `fetch` of an atom | browser, session process (task 6.1) |
| A Markdown link opening through the board page (a stubbed `window.open`); a forged message refused | browser, session process (task 6.1) |
| A Snapshot of answered atoms and a Markdown Text, opened from `file://` | browser (task 6.2) |
| One answer of five input atoms, pushed by the mod or collected, each configuration, Bun and Node 24 | conformance `atom-results.e2e.ts` (task 6.3) |
| Italian strings and hover on every atom | browser (task 6.4) |

## Merge points

Borrowed from `main` (task 0.2 records each with its file and line): `WidgetType`, `WIDGET_TYPES`, `widgetTypeOf`, `NON_WIDGET_ITEM_TYPES`, `widgetResultProblems`, `widgetResultFits`, `resultHoldsNothing`, `widgetRegistryProblems`, `withWidgetTypes`, `ID_PATTERN`, `GANTT_FIRST_DATE`, `GANTT_LAST_DATE`, the Gantt's `fullDate` pattern, the Scale's step check (`scaleResultProblems`), `parseNumber`, `parseDate`, `numberEcho`, `dateEcho`, `plainNumber`, `numberRefusalText`, `dateRefusalText`, `formatNumber`, `formatPercent`, `formatMoney`, `formatDate`, `formatLongDate`, `tableOf`, `MINOR_UNITS`, `DEFAULT_MINOR_UNITS`, `agentTextRuns`, `draftRecordProblems`, `DraftRecord`, `ItemProps`, `ComponentFacts` (`fits`), `register`, `componentFor`, `useReadyAfterLayout`, `questionTextId`, `useStrings`, `useLocale`, `renderedOf`, `componentsOf`, `previewId`, `draftAnswerOf`, `cardState`, `draftRecordOf`, `restoreDraft`, `resultFits`, `ViewMessage`, `ViewOpenReference`, `readViewMessage`, `#viewHandlers`, `openLink`, `LIBRARY_CHUNKS` (`radix`: `Popover`, `Switch`, `ToggleGroup`), `COMPONENT_ROOTS`, `chunkComponents`, `widgetChunkProblems`, `CHUNK_STYLESHEETS` (fallback only), `collectNotices`, `classify` (`tools/check-licences.ts`), `build:skills`, `check:skills`, `skills-examples.test.ts`, `component-facts.test.ts`, `hover-audit.browser.ts`, `languages.browser.ts`, `widget-results.e2e.ts` and `run.ts` (conformance).

Changes in flight:

- **`chart-widget`** (PR #54, open; branch `origin/worktree-feature-chart-widget` read at 704b49b2, task 7.5 of its tasks). This change borrows none of its names (not `useTheme`, `themeOfClasses`, `chartText`, the `chart-*` tokens). Overlaps: `WIDGET_TYPES` (`chart` appended there; the atoms follow in merge order); the four sets it widens, which this change also widens (whichever merges second rebinds, Rule 1), and the board protocol, which it leaves; `catalog/port.ts` (it adds `useTheme` and theme code; this change appends `entry` and `onEntryChange` to `ItemProps`: separate hunks); `tools/build/licences.ts` (it reads a package's `licenses/` folder; this change adds the excepted-package check beside `collectNotices`: keep both); the contract's appended export blocks, the strings tables, `chunk-sizes.json` (re-record after the rebase), `skills/askboard/` (regenerate, never resolve; the budget is re-checked with the Chart's line), `bun.lock` (keep both sides, then `bun install`), conformance `run.ts` (both append a file), `ux-update-draft.md` (its Voice and Tone row and this change's sit near the Timeline row: apply both, in merge order), `CHANGELOG.md`. If it has merged by task 0.2, this branch is rebased onto `origin/main` before group 1.
- **`early-benchmark`** and the spikes: no overlap.
- **`layouts`** (follow-up, not proposed): it will extend `draftAnswerOf`, `renderedOf`, `componentsOf`, `draftRecordProblems`' item set and the ask-items walker to nested items; this change keeps each of them reading a question's `items` in one place, so that `layouts` changes one function each.

Seams this change creates, which later changes borrow once it merges: the eight types and their `checks.ts`; `parseAmount`, `amountEcho`, `compareDecimal`; `entries` in the draft record, `ItemProps.entry` and `onEntryChange`; `catalog/fields/`; `catalog/text/markdown.ts` (Document review renders through it); `ViewOpenLink`; `tools/licence-exceptions.json`.

## Risks / Trade-offs

- [A Markdown construct runs, styles or loads] → html off, a link and image rule of our own, an exact DOMPurify allow-list with a class hook, nodes appended from a fragment, and the view's CSP; task 5.1's fixtures cover the classic payloads in three engines, and the security checkpoints review the config.
- [markdown-it is slow on a hostile source] → 10,000 code points, nesting 20, and a timed fixture set in Chromium and WebKit (decision 5); a slow form stops the task for `/opsx:update`.
- [A forged open-link message opens a page] → the page opens only `http:` and `https:` from an item that holds Markdown, in a tab with no opener or referrer, on the user's click in the view; the view is sandboxed and holds no token, so the worst a forged message does is what a user's click on an agent's link does.
- [react-day-picker formats through `Intl` or shifts a day across time zones] → our formatters and labels, local-date conversion, and a browser test at UTC−10 and UTC+14 with `Intl.DateTimeFormat` stubbed to throw in the view.
- [An entry blocks "Answer" with the field out of sight] → the button's description names the field, and the field error is in the question's card.
- [The skill passes its budget with eight more lines] → uses of at most 90 characters; if `check:skills` still fails, the task stops for `/opsx:update` (a budget moves only through a design decision).
- [Kebab-case type names differ from the Tree's single words] → none collides, `ID_PATTERN` admits them, and the A2UI mapping (EXPERIENCE) is by name, not by spelling.
- [Questions of atoms answered partly] → by design (open question 9); the agent sees which atoms are absent; the Form brings `required`.
- [The `text` chunk carries markdown-it and DOMPurify for a board with one Markdown preview] → only boards with a Markdown Text or preview load it; its size is recorded.

## Migration Plan

None: five sets widen by added schemas, an optional option field and an optional draft-record field. One session process serves the board page and `board-host`, so their minors move together. Rollback is a revert, then `bun install` and `bun run build:skills`.

## Open Questions

- **The echo** (conflict between sources): the handoff's scope note said parsing "without echo"; EXPERIENCE (binding, Primitives, Input atoms) keeps the echo on the standalone atoms. This design follows EXPERIENCE (proposal, open question 11); a PO answer otherwise comes back through `/opsx:update` before task 5.4.
- The proposal's twelve questions carry their defaults, accepted under the PO's unattended handoff (2026-11-07); a different answer comes back through `/opsx:update` before the groups it touches.
- No conflict between the binding documents was found otherwise: the spine's Stack already pins the three packages, the addendum names `argparse`, and EXPERIENCE and DESIGN name the atoms this change builds.
