# Design

## Context

See proposal.md (Why). Input: `drafts/ux-review-168/ux-review-report-1.1.0.md` §3 (flows), §4 (wording), §5 (focus, live region, motion), §8.2 P1-1 to P1-6 and P1-8; the mockups in `proposals/` are reference only and the report wins. PO decisions on #168: 2026-11-14 (decisions 2 to 5, postpone unchanged, no "you can close the tab") and 2026-11-15 (after-answer default "Go to the next", comment 6895112837).

The branch is stacked on `answering-flow-fixes` (#212, head 9eb5f364, not merged); `docs/as-built/answering-flow-fixes.md` lists its seams. What this design relies on, on that base, all under `packages/view/src/shell/` unless named:

- **Marks and counts.** `markOf` (`board-view.ts`) gives five marks (`unanswered`, `ready`, `answered`, `postponed`, `declined`) from the board state and the work; `isOpen`, `openCountOf`, `tabOpenCount` and `nextOpenFrom` read it. `QuestionMarker` (`markers.tsx`) draws a CSS shape per mark; the outline and the navigator show `markLabel`. The receipt (`question-state.ts`, `RECEIPTS`) comes from the logged answer's `receipt` (`sent` or `delivered`, contract `Receipt`) or from the card's flight (`acts.of(question.id, CARD_ACTS)`), whose outcome `queued` reads "not sent yet".
- **The primary.** `ActionsRow` (`question-actions.tsx`) renders `question.answer`; the card's `onAnswer` goes through `pressAnswer`, which reports an `AnswerResult` (`sent`, `note-sent`, `held`, `released`, `note-held`, `note-released`, `needs-reason`) or `undefined` (blocked). In submitted delivery a second press on a ready answer releases it. Focus after an act follows D1 of the base: the question's heading for `sent`, the control for `held`.
- **The bar.** `BottomBar` holds the delivery switch with its helper, "Select recommended", the postponed warning, the updates line and Submit (disabled in immediate delivery). `selectRecommended` (`submit.ts:324`) holds each selection for Submit in submitted delivery (`held: {act: "answer", byRecommended: true}`) and returns a count.
- **Moves.** `revealAndFocus` (`reveal.ts`) scrolls instantly clear of `measureInset()` (the header and the last `footer`), then focuses; `useQuestionInView` uses the same band. The tab strip (`board.tsx:180`, Radix `Tabs.List`) is not sticky.
- **Messages.** One `StatusRegion`; `sentMessageOf` and `addedMessageOf` (`flow-messages.ts`); `Senders.status` called on outcome `sent` only.
- **Settings.** The configuration's presentation keys are `PRESENTATION_KEYS` (`contract/src/schemas/configuration/index.ts:22`), read generically by `ask-core` (`core/src/config/presentation.ts`, `settings.ts`) and `board-host`; the board protocol's `setting.json` enumerates them and `settings.json` holds one row per configuration key (`keys` optional); the board page maps a settings message to `ViewPresentation` (`board-page/presentation.ts`) and the panel's controls from `CHOICES` and `LABELS` (`board-page/settings-panel-data.ts:75`). On main: configuration 1.1, board protocol 1.10.
- **Motion.** The only animation is the reading panel's skeleton (`board-page/reading-panel.ts:69`, `animate-pulse`); `styles/base.css` is shared by both documents.

AD IDs relied on: AD-1 (view code stays in `view`; the setting crosses contract, core and server only along existing edges), AD-3 (receipts), AD-7 (versions), AD-8 (agent text as text), AD-10 (fail closed), AD-14 (configuration and the board's writes), AD-20 (held acts). UX: EXPERIENCE.md Board chrome, Question card, Counting, By surface, Accessibility Floor, Preferences and Settings, Voice and Tone; DESIGN.md Markers, Board chrome, Question card, Open Items 1.

## Goals / Non-Goals

**Goals:**

- Every rule of the flow (the state, the next question, what happens after an act, completion, prefill eligibility and undo, scroll frames, message gating) is a pure function unit-tested in Bun; the DOM glue is thin and each Given/When/Then has a browser test, focus and scroll ones in the three engines.
- Seams `answering-flow-visual` (change 6) can borrow: the ladder state and its counts, the after-answer decision and footer store, the completion model.
- Tests find controls by stable hooks, not labels, so the renames land once and later label changes cost nothing.

**Non-Goals:**

- Board keys (`board-keys`, #187). Direction B's layout: the outbox ledger, the progress strip, the bottom bar's removal (its postponed warning moves with it), "Edit" on a sent card, the visible "The agent added … · Go" notice, short question numbers, compact defaults (change 6). Palettes (#189).
- The ask pill and its words: unchanged. #186 found that it follows the ask state computed from the log (`askStateOf`, no watermark), so it reads "Answered" while receipts still read "Sent"; what it claims is PO question #213, and its records are change 6's (#213's proposed default).
- Messages for a follow-up reply or an agent's edit to a question.

## Decisions

### D1. One ladder state per question

`shell/answer-state.ts` exports `answerStateOf(inputs)`, pure, giving one of `todo`, `draft`, `ready`, `not-sent-yet`, `sent`, `delivered`, `postponed`, `declined`:

1. A held act decides first: `answer` is `ready`, `decline` `declined`, `postpone` `postponed`; a held `reopen` or an undo falls through to the content rule.
2. A flight whose outcome is `queued` is `not-sent-yet`.
3. A logged `answered` status with draft work on the question (a revision) is `draft`; else `delivered` or `sent` from the logged answer's `receipt`. `declined` is `declined`; `postponed` is `postponed`.
4. An open question is `draft` when its work holds a choice, "Other…" text, an option note, a note or a widget value, else `todo`.

`Mark` becomes this union; `markOf` gains the flight and keeps its name, so its callers (`board.tsx`, `navigators.tsx`, `bottom-bar.tsx`) change only where they render. `isOpen` is `todo`, `draft` or `postponed`. A revision reads Draft on the card and in the outline but is not counted as to do and is never a next-question target: the agent holds an answer, and counting it would make an answered board look unfinished (report §3.1 draws "Delivered → Draft"; its "counts as open" column describes a first draft). `ladderCountsOf(document, state, work, flights)` counts each state over the board: the completion panel reads it now, and change 6's ledger later.

The card shows the state as a line in its actions row, where the receipt shows today, text plus shape; the receipt's words become the Sent, Delivered and Not sent yet labels (report §4: unchanged words, now state labels). Icons come in D11.

*Alternatives.* A separate `ladderOf` beside `markOf` was rejected: two notions of a question's state is the defect (F-14).

### D2. The next question to do

`nextOpenFrom` keeps its name and signature (`board-keys` reads it for `N`; its label `header.nextOpen` reaches `board-keys`' tooltip and keys panel as it is) and changes its order: unseen questions the agent added first, then `todo` and `draft` questions after `current` in board order, wrapping; then `postponed` ones after `current`, wrapping (report §3.2: a postponed question is reached last, not skipped). The header button keeps `header.nextOpen` as its key, with the value "Next to do". `board-keys` adds `previousOpenFrom` beside it (at 89ac61b4: open questions before the question in view, wrapping). Whichever change lands second aligns it in the commit of its order rule: to-do and draft questions before the question in view, wrapping, then postponed ones; and its label `keys.action.board.previousOpen` becomes "Previous to do" / "Precedente da fare".

### D3. After an answer

`shell/after-answer.ts` exports `afterAnswerOf(input)`, pure. Input: the act (`answer`, `postpone`, `decline`), its result (`AnswerResult`, or "took effect" for postpone and decline), whether it was a revision or an undo, the presentation, the setting, the delivery mode, and what `nextOpenFrom` and `ladderCountsOf` read. Output, one of:

| Output | When | The board then |
|---|---|---|
| `stay` | revision, note alone (`note-sent`, `note-held`), undo, `released` ("Edit"), blocked, cancelled confirmation, single-question board | focus as the base's D1 (the question's heading, or the control) |
| `move {target, newFromAgent, areaDone?}` | setting `next`, a question to do remains | reveal and focus the target's heading (D4), arrival mark, tab or view change |
| `footer {target, newFromAgent, areaDone?}` | setting `stay`, a question to do remains | the card's footer; focus to "Continue" |
| `complete` | "One by one", nothing to do or held | completion panel; focus to its heading (D6) |
| `send-all` | "All together", nothing to do, answers held | focus to the send button, the "All ready" line (D6) |

`target` is `nextOpenFrom(current = the acted question)`, `todo`/`draft` first; when only postponed questions remain the output is `complete` (the panel's postponed variant offers "Go to the first"). `areaDone` names the acted question's area when it has no question to do left and the target is in another area.

- **Where it runs.** At the act, never at the reply (the base's D1 rule): the card calls it from its outcome handling, which `pressAnswer`, "Accept recommended", Postpone and Decline already reach; `board-keys`' `Mod+Enter` calls the same `onAnswer(control)` and so gets it too. There `control` is the element that had focus (an option or the heading), so that a cancelled confirmation returns focus to it: the flow never takes `control` for the primary, and finds the primary as `[data-askboard-primary]` inside the card where it needs it ("Edit" keeping focus, the `stay` output). Decline's move runs after the More menu's close (`onCloseAutoFocus` prevented), so the menu does not give focus back to its trigger.
- **The footer.** A store in `BoardContext` holds `{from, target}`; the card whose id is `from` renders "{state label} · Next: {title}" (with "New from the agent" or "(area)" when so) and "Continue", which takes focus. "Continue" runs the `move`. The store clears on "Continue", on an edit or act on `from`, on an act on another question, and when the target leaves the board. The title is agent text: rendered as text, with the agent-label truncation and bidi isolation of EXPERIENCE's Agent-written labels (AD-8).
- **Tabs.** With `move`, the target's tab activates at once; with `footer`, on "Continue". `status.areaDone` is announced at the act in every presentation with areas.
- **One question per view.** `move` sets the question shown, as the header jump does today.

*Alternatives.* Advancing on the reply was rejected: it would take focus the user moved during the flight. A move after "Edit" or a note was rejected: neither finishes the question.

### D4. The move itself: sticky strip, smooth scroll, arrival

- **Inset.** `measureBoardInset(doc)` (new, beside `measureInset`) is `measureInset` with its top raised to the bottom of the sticky tab strip (`[data-askboard-tab-strip]`) when present. `revealAndFocus` and `useQuestionInView` use it; the reading panel keeps `measureInset`. The strip becomes `sticky` under the context header (its `top` is the header's height, measured once per resize).
- **Smooth.** `revealAndFocus(element, {smooth})`: `smooth` only for D3's `move` and "Continue". `scrollFrames(from, to, duration)` (pure, ease-out, at most 250 ms) drives `requestAnimationFrame`; under `matchMedia("(prefers-reduced-motion: reduce)")` the scroll is instant. Focus is given first, with `preventScroll`. Every other move stays instant, as the base built it, so its tests keep their timing.
- **Arrival.** The target card gets `data-askboard-arrived` for 1.2 s (one timer, cleared on the next move); `styles/motion.css` draws a 2px `{colors.primary}` left edge, fading under `prefers-reduced-motion: no-preference`, static otherwise.

*Alternatives.* `scrollBy({behavior: "smooth"})` was rejected: its duration is the engine's, not bounded by 250 ms. A `scroll-margin` was rejected for the base's reasons (its D2).

### D5. The primary, "Edit", Send and the wording

- `primaryLabelOf({single, delivery, ready, noteOnly, revision})`, pure: "Edit" on a ready answer; "Confirm" in "All together"; else "Send the note", "Send the change" or "Send answer". "Edit" is the same button and press (`released`), so focus stays on it and it reads "Confirm" after.
- Send: `bar.submit` is "Send {count} answers" with {count} the held answer acts (plural forms); with held work but no held answer it reads `bar.submitPlain` "Send" (Q2). The bar renders no Send button in immediate delivery; the base's paths that focus Submit (the replace dialog with nothing sent) fall back to the delivery switch's "One by one" when it is absent.
- The submitted helper names the button as `bar.submitName` ("Send answers", «Invia le risposte»), not its counted label (Q1).
- "Accept recommended" moves to the recommended option's row, after its badge, and renders only while the question is `todo` or `draft` (F-18).
- **Stable hooks.** The primary carries `data-askboard-primary`, Send `data-askboard-submit`, Postpone `data-askboard-postpone`, Prefill `data-askboard-prefill`, the header jump `data-askboard-next-to-do`, each delivery segment `data-askboard-delivery="immediate|submitted"`. The harness's locators (`harness/dom.ts`) use them, and browser tests find controls through the harness, never by these labels. `board-keys` puts the same `data-askboard-primary` on the same button; the rebase keeps one.

The strings, by key (EN, IT). "Accepted" is report §4, decision 3; the rest are Italian "(to review)" in EXPERIENCE's Voice and Tone.

| Key | en-US | it-IT | Status |
|---|---|---|---|
| `bar.delivery` | Sending answers | Invio delle risposte | accepted |
| `bar.immediate`, `bar.submitted` | One by one, All together | Una alla volta, Tutte insieme | accepted |
| `bar.immediateHelp` | Each answer goes to the agent as soon as you send it. | Ogni risposta parte appena la invii. | accepted |
| `bar.submitName` (new) | Send answers | Invia le risposte | Q1 default |
| `bar.submit` | Send {count} answer / answers | Invia {count} risposta / risposte | accepted |
| `bar.submitPlain` (new) | Send | Invia | Q2 default, to review |
| `bar.switchTitle` | Switch to "One by one"? | Passare a «Una alla volta»? | accepted |
| `question.answer` | Send answer | Invia risposta | accepted |
| `question.confirm`, `question.edit`, `question.sendNote` (new) | Confirm, Edit, Send the note | Conferma, Modifica, Invia la nota | accepted |
| `question.sendChange` (new) | Send the change | Invia la modifica | to review |
| `question.postpone` | Later | Più tardi | accepted |
| `question.more` | More | Altro | accepted |
| `question.noteSentAt` (new) | Note sent {time} | Nota inviata {time} | to review |
| `mark.unanswered`, `mark.ready`, `mark.postponed` | To do, Ready, not sent, Postponed | Da fare, Pronta, non inviata, Rimandata | accepted |
| `mark.draft` (new) | Draft | Bozza | to review |
| `receipt.notSentYet`, `receipt.sent`, `receipt.delivered` | Not sent yet, Sent, Delivered to the agent | Non ancora inviata, Inviata, Consegnata all'agente | accepted (§4; "Not sent yet" capitalised as §3.1) |
| `header.open`, `areas.open` | {count} to do | {count} da fare | accepted |
| `header.openPostponed` (new) | {count} to do ({p} postponed) | {count} da fare (di cui {p} rimandata / rimandate) | accepted |
| `header.nextOpen` | Next to do | Prossima da fare | accepted |
| `bar.selectRecommended` | Prefill recommended ({count}) | Precompila le consigliate ({count}) | accepted |
| `bar.undoPrefill` (new) | Undo | Annulla | accepted |
| `footer.next`, `footer.continue`, `footer.newFromAgent` (new) | Next: {title}, Continue, New from the agent | Prossima: {title}, Continua, Nuova dall'agente | to review (Q3) |
| `completion.title`, `completion.counts` (new) | Every question has an answer., {s} sent, {d} delivered to the agent. | Tutte le domande hanno una risposta., {s} inviate, {d} consegnate all'agente. | accepted |
| `completion.postponed`, `completion.goToFirst` (new) | {p} postponed question(s) remain. Closing loses this ask., Go to the first | Restano {p} rimandate. Chiudendo perdi questa richiesta., Vai alla prima | to review |
| `bar.allReady` (new) | All ready: nothing has been sent yet. | Tutte pronte: niente è stato ancora inviato. | to review |
| `areas.done` (new, the tab's text for screen readers) | completed | completata | to review |
| `settings.afterAnswer`, `settings.goToNext`, `settings.stayHere` (new) | After answering, Go to the next, Stay here | Dopo la risposta, Vai alla prossima, Resta qui | accepted |
| `status.next` (new) | Next: {title}, {n} of {m}. | Prossima: {title}, {n} di {m}. | to review |
| `status.postponed`, `status.declined`, `status.changeSent` (new) | Postponed., Declined., Change sent. | Rimandata., Rifiutata., Modifica inviata. | to review |
| `status.readyLost` (new) | No longer ready: correct {label}. | Non più pronta: correggi {label}. | to review |
| `status.delivered` (new) | Delivered to the agent: {d} of {s}. | Consegnate all'agente: {d} di {s}. | to review |
| `status.prefillUndone` (new) | Prefill undone. | Precompilazione annullata. | to review |
| `status.areaDone` (new) | {area} completed | {area} completata | accepted |
| `status.allAnswered` | the two `completion.*` lines | idem | accepted |
| `status.allReady` | as `bar.allReady` | idem | to review |

{n} of {m} is the target's position among the board's questions; no short question numbers (change 6).

### D6. Completion

`completionOf(document, state, work, flights, delivery)`, pure, in `shell/completion.ts`:

- `none` while a question is `todo` or `draft`, or any act is in flight.
- `send-all {count}` in "All together" while answers are held and nothing is to do.
- `postponed {count, first}` while only postponed questions remain to do and nothing is held.
- `done {sent, delivered}` when every question is `sent`, `delivered` or `declined` and nothing is held: `sent` counts the questions with a receipt (`sent` or `delivered`, a decline included), `delivered` those whose receipt is `delivered`.

It reads the questions' receipts only, never `state.ask` or the ask pill, so neither #186's finding nor #213's answer changes anything here. `CompletionPanel` renders at the top of the main content, from the model, with a focusable heading (`tabIndex={-1}`); not on a locked board or in an opened Snapshot. `send-all` renders the `bar.allReady` line beside Send instead. The panel never says the tab can be closed (PO, 2026-11-14).

**Delivered messages.** `deliveredGate(now)` (pure, `shell/delivered-messages.ts`) takes the delivered count from each state update and gives at most one `status.delivered` per 5 s, the latest count at the window's end; a count that has not changed says nothing. The base's guard that no message says "delivered" (`answering-flow-status.browser.ts`, `strings/flow-strings.test.ts`) exempts `status.delivered` and `completion.counts` only.

### D7. More status messages

`flow-messages.ts` gains builders for D5's `status.*` keys. `sentMessageOf(via, acts, nextOf?)` appends `status.next` when D3 recorded a target for the acted question at the act (a map in `BoardContext`, read once, then cleared), so "Answer sent: {option}. Next: {title}, {n} of {m}." is said when the board page reports the command sent, never earlier. A held answer (`held`) says `status.ready` plus `status.next` at once, as the base does. Postpone and decline say theirs on `sent` in "One by one" and at the act when held. `status.readyLost` is raised when a field check releases a held answer (`releaseFailed`, `heldWithBlock` in `submit.ts`), with `fieldToFixOf`'s label. `status.allAnswered` and `status.allReady` are raised when `completionOf` turns `done` or `send-all`. Titles go in as text, cut at 80 characters (the base's D4).

### D8. Prefill recommended

- `selectRecommended` keeps its eligibility rule and stops holding: it only sets drafts, in both modes (decision 4), and returns the batch it filled (`{questionId, label}[]`) instead of a count. `HeldAct.byRecommended` is no longer written; the field stays in the draft-record schema (a removal would be a major, AD-7), and a restored draft that holds one is an answer the user marked ready under the old rule, sent as before.
- `prefillCountOf` (same predicate, no writes) gives the label's count; the button is absent at 0.
- The bar shows `status.prefilled`'s text and "Undo" while the batch is live; focus moves to "Undo" (the button it came from is gone at 0; report §5.2 says focus stays on the button, P1-6 says the button goes: Undo is where the user can still act). `undoPrefill(batch)` clears each selection still equal to the prefilled label on a question holding no held act, announces `status.prefillUndone` and focuses "Prefill recommended". The batch dies on the next draft change or act (the draft store's subscription), so Undo never clears a choice the user made.
- Submit sends held acts only, so prefilled drafts never leave unconfirmed (PRD FR-3 and FR-22 amended).

### D9. The after-answer setting

- **Contract** (next minor after main's, configuration and board protocol): `config.json` gains `afterAnswer` (`next`, `stay`); `PRESENTATION_KEYS` and `CONFIGURATION_KEYS` gain it after `contextPlacement`; `ConfigurationValues.afterAnswer: AfterAnswer`; `CONFIGURATION_DEFAULTS.afterAnswer = "next"`. `setting.json`'s key enum and its `if/then` chain admit it; `settings.json` gains an optional `afterAnswer` row (a new required row would be a major) and `write.key` admits it. Fixtures in a module of this change (`fixtures/after-answer.ts`).
- **core and server**: no source change expected, since both read the key lists; their tests pin the new key (`askboard-contract-versioning`, Rule 2).
- **Board page and view**: `presentationOf` reads the row, `next` when absent; `ViewPresentation.afterAnswer`, `isPresentation` and the view protocol's `PRESENTATION_VALUES` admit it; the panel's `CHOICES` and `LABELS` gain a segmented row "After answering". No quick toggle. An opened Snapshot passes `next` (it never answers).
- AD-14 is amended in place (the presentation keys, the board's writes) and FR-35 names the preference.

### D10. Report conflicts settled here

- §4 renames `state.postponedPart` while its note keeps `state.*` until D-6: the pill and its words wait for #213 and change 6 (coordinator, 2026-11-15), so the pill keeps "rinviata" while the marks say "Rimandata".
- §3.2's flowchart activates the next tab before the setting's branch; with "Stay here" that would hide the card holding the footer, so the tab activates on "Continue" (D3).
- §3.3.1's "Prossima: {title} {number}" uses change 6's short numbers; here the footer names the title, and the message gives "{n} of {m}".
- §5.2 (prefill keeps focus) against P1-6 (the button goes at 0): D8.

### D11. Icons (after `icon-set`)

Lines added to `packages/view/src/icons/index.ts`, decorative (`aria-hidden`) beside their text: `IconToDo` `circle`, `IconDraft` `pencil`, `IconReady` `package`, `IconNotSentYet` `hourglass`, `IconSent` `send`, `IconDelivered` `check-check`, `IconPostponed` `clock`, `IconDeclined` `ban`, `IconAreaDone` `check`, `IconComplete` `circle-check-big`; `IconNextOpen` changes from `arrow-down` to `arrow-right` (report §4: one label, no direction glyph, since in one question per view the jump changes the question shown). The ladder's icon replaces the CSS shape of `QuestionMarker` on the card, the outline and the navigator; the ask pill keeps its shapes. DESIGN.md's Icons table gains the rows.

### D12. Reduced motion

`styles/motion.css`, imported by `styles/base.css` (both documents): the arrival edge's keyframes inside `@media (prefers-reduced-motion: no-preference)`, and inside `@media (prefers-reduced-motion: reduce)` `*, ::before, ::after { animation-duration: 0s !important; animation-iteration-count: 1 !important; transition-duration: 0s !important; scroll-behavior: auto !important }`. The reading panel's skeleton pulse is covered by that rule. No component uses enter or exit animations today (`git grep animate-`), so no dialog waits for an animation event. DESIGN.md Open Items 1 becomes a motion inventory (§5.4) and is marked settled.

### D13. Keys

No binding is added or changed and no key table is touched: `board-keys` (#187) owns `N`, `Shift+N` and `Mod+Enter`, and routes `Mod+Enter` through the primary's own path, so D3 applies to it. "Continue", "Edit", "Undo" and "Go to the first" are plain buttons reached with Tab; "Continue" takes Enter natively. `keys-coverage.test.ts` is unaffected (no widget).

### D14. Records and versions

- **Versions.** Configuration and board protocol each at the next minor after main's, bound at the rebase task (`askboard-contract-versioning`). No other set, no view-manifest, Snapshot-data or draft-record change.
- **PRD**: FR-3 and FR-22 (prefill fills drafts only; Submit sends what the user confirmed), FR-35 (the after-answer preference), and a glossary note that the PRD's act names ("Answer", Submit, "Select recommended", Postpone) are the acts, labelled as EXPERIENCE.md's Voice and Tone says. **Spine**: AD-14 amended in place.
- **EXPERIENCE.md**: Board chrome (Next-open jump, Outline navigator, Question navigator, Area, Bottom action bar, Select recommended, Delivery mode switch, Submit), Question card (Answer, Question marker, Accept recommended, Open prompt, Postpone, Delivery receipt), Counting (the ladder), By surface (completion), Accessibility Floor (focus destinations of §5.2, the new messages, reduced motion), Preferences and Settings (the after-answer row), Voice and Tone (D5's strings, the act-names note), a Key Flow "Answering a long board", Open Items 22 narrowed to keyboard inside widgets and text zoom. **DESIGN.md**: Colors, Markers (the ladder), Next-open jump, Bottom action bar, Select recommended, Delivery mode switch, Submit, Answer, Question marker, Accept recommended, Delivery receipt, Settings panel, new rows "Continue footer", "Completion panel", "Arrival mark", the Icons table (D11), Open Items 1.
- `docs/as-built/answering-flow-guidance.md`; `tools/build/skills/templates/help/SKILL.md`'s "The board" section, regenerated with `bun run build:skills`.

## Merge points

| With | Shared | Rule |
|---|---|---|
| `answering-flow-fixes` (#212, base, 9eb5f364) | every seam below; its MODIFIED requirements "Counts and the next-open jump", "One question per view", "Outline navigator", "Delivery mode" and its ADDED "Focus after Answer and Submit", "Focus moves clear the sticky bars", "Status messages for the answering flow", which this delta MODIFIES | After #212 merges: `git rebase --onto origin/main 9eb5f364`; re-check each borrowed name on `origin/main`; re-copy those seven requirements from what merged and re-apply this change's edits; archive this change only after `answering-flow-fixes` is archived (validate already notes "Archive would refuse" until then) |
| `icon-set` (#210) | `packages/view/src/icons/index.ts`, `IconNextOpen`, `strings/glyphs.test.ts` (no ↓ ↩ ↻ ↗ ✓ ✕ × in a value: no new string holds one), DESIGN.md Icons, `chunk-sizes.json`, strings, browser files naming the jump | Group 9 starts only once `icon-set` is on `origin/main` and this branch is rebased on it; until then no task imports the icon module |
| `board-keys` (#187, branch `worktree-feature-board-keys`, read at 89ac61b4) | `board-view.ts` (its new `previousOpenFrom`; D2), `board-header.tsx` (`KeyHint` around the jump, a Keys button before the quick toggles), `question-card.tsx` (an `onKeyDown` on the section), `question-actions.tsx` (`KeyHint` around the primary, `data-askboard-primary`), `board.tsx` (one hook, previous open, the panel), strings (appended), `harness/suites.ts` (two files), the help template's last line, EXPERIENCE.md (Accessibility Floor, one sentence on the Next-open row, Context header, Voice and Tone, Open Items 21), DESIGN.md (Context header, the hints), `chunk-sizes.json`, the export block at the end of `contract/src/index.ts` (it widens no set). It does not touch `harness/dom.ts`; this change does not touch its `thread.tsx`, `thread-text.ts`, `catalog/fields/roving.ts` or `catalog/keys/hint.ts` | No requirement is modified by both: it ADDs its own and modifies only "Follow-up thread", and names controls by role, not label. Its tests find the primary by `data-askboard-primary` or the harness locator. Strings, `suites.ts`, both export blocks and documents: keep both sides' lines; `previousOpenFrom` and its label as D2 says; `data-askboard-primary` kept once; the help skill (within its budget, task 11.1) and `chunk-sizes.json` are regenerated, never merged by hand |
| `answering-flow-visual` (change 6, not proposed) | borrows `answerStateOf`, `ladderCountsOf`, `afterAnswerOf`, the footer store, `completionOf` | Only after this change merges |
| `early-benchmark` | none (`packages/bench`) | none |

Borrowed from `main` (task 0.2 records file and line): `markOf`, `isOpen`, `openCountOf`, `tabOpenCount`, `nextOpenFrom`, `Mark`, `markLabel`, `QuestionMarker`, `askPillOf`, `selectRecommended`, `hasRecommendation`, `submitStateOf`, `releaseFailed`, `heldWithBlock`, `pressAnswer`, `measureInset`, `PRESENTATION_KEYS`, `CONFIGURATION_KEYS`, `CONFIGURATION_DEFAULTS`, `ConfigurationValues`, `ViewPresentation`, `isPresentation`, `presentationOf` (board page), `CHOICES`, `LABELS`, `Receipt`, `HeldAct`, `BROWSER_FILES`, `STRING_KEYS`. Borrowed from the base (re-checked at the rebase): `revealAndFocus`, `revealDelta`, `REVEAL_GAP`, `questionInView`, `useQuestionInView`, `createStatusMessages`, `StatusRegion`, `sentMessageOf`, `addedMessageOf`, `Senders.status`, `AnswerResult`, `BottomBar.onSubmitted`, `shownQuestionOf`, `fieldToFixOf`, `focusField`, `fixtures/answering-flow-asks.ts`, harness `Board.status`, `data-askboard-agent-pill`.

## Needs probe

None about Claude Code's run time: no mod, hook, agent or permission behaviour is assumed. Browser behaviours the tasks check rather than assume: a `position: sticky` tab strip inside the view's scroll container in the three engines (task 6.1), and `matchMedia("(prefers-reduced-motion: reduce)")` under Playwright's `reducedMotion` emulation in the three engines (task 10.1).

## Risks / Trade-offs

- [The renames break many browser tests] → group 2 moves every test onto stable hooks before any label changes, so group 4's renames touch only tests that assert text.
- [A smooth scroll races the in-view hook] → focus is on the target from the first frame, and the focus rule of the question in view wins once the card is in the band; the draft mirror's debounce absorbs the intermediate writes.
- [The default moves focus away from the card just answered, so its receipt is out of view] → the status message says what happened, and "Stay here" is one setting away.
- [The "Note sent" line does not survive a reload] → the board state holds no sent notes; adding them is a protocol change this flow does not need.
- [Two messages close together (sent, then delivered) and a screen reader drops one] → the delivered gate's 5 s window; a by-hand pass with VoiceOver and Orca is #209's.
- [Shell chunk growth] → estimate 12 to 16 KB (six modules, two components, about 45 strings in two languages) on the base's 230,569 B, inside its 10% allowance of about 23 KB; `board-keys` adds 5 to 8 KB, so whichever lands second re-records. Task 11.2 bounds the growth at 16,000 B.

## Migration Plan

None for data: the configuration key is optional and defaults to `next`; a draft restored from an older page keeps its held acts, `byRecommended` included. A board open during an upgrade picks up the new view at its next load.

## Open Questions

Posted on #168 with `needs-po`, each with its default; task 0.1 records the answers.

- **Q1.** The accepted submitted helper names «Invia le risposte», but the button now reads "Invia {count} risposte". Default: keep the accepted sentence with the fixed name «Invia le risposte» (`bar.submitName`). Alternative: name the counted label ("…finché non premi «Invia 2 risposte»"), which changes as the count does.
- **Q2.** What "{count}" counts when the held work holds postpones, declines or notes. Default: ready answers only, and "Invia" alone when none is held, so the button never calls a postpone an answer and matches "{k} risposte inviate". Alternative: every held act.
- **Q3.** Strings outside §4: "Continua", "Prossima: {title}", "Nuova dall'agente", "Invia la modifica", "Bozza" and D5's "to review" rows, and whether "{area} completata" may stay for a masculine area title ("Rilascio completata"). Default: ship them marked "(to review)" and keep "{area} completata" as accepted.
