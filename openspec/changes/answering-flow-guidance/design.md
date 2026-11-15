# Design

## Context

See proposal.md (Why). Input: `drafts/ux-review-168/ux-review-report-1.1.0.md` §3 (flows), §4 (wording), §5 (focus, live region, motion), §8.2 P1-1 to P1-6 and P1-8; the mockups in `proposals/` are reference only and the report wins. PO decisions on #168: 2026-11-14 (decisions 2 to 5, postpone unchanged, no "you can close the tab") and 2026-11-15 (after-answer default "Go to the next", comment 6895112837).

The branch is based on `origin/main` 46d3dcf7, which holds `answering-flow-fixes` (#212), `icon-set` (#210) and `board-keys` (#225), each merged and archived; their notes in `docs/as-built/` list their seams. Below, "the base" is `answering-flow-fixes` as merged, and "the base's Dn" a decision of its design. What this design relies on, all under `packages/view/src/shell/` unless named:

- **Marks and counts.** As #212 left them, `markOf` (`board-view.ts`) gave five marks (`unanswered`, `ready`, `answered`, `postponed`, `declined`) from the board state and the work, and `isOpen`, `openCountOf`, `tabOpenCount` and `nextOpenFrom` read it; group 5 replaced them with D1's eight states, read through a `Ladder`. `QuestionMarker` (`markers.tsx`) draws a CSS shape per mark; the outline and the navigator show `markLabel`. The receipt (`question-state.ts`, `RECEIPTS`) comes from the logged answer's `receipt` (`sent` or `delivered`, contract `Receipt`) or from the card's flight (`acts.of(question.id, CARD_ACTS)`), whose outcome `queued` reads "not sent yet".
- **The primary.** `ActionsRow` (`question-actions.tsx`) renders `board-keys`' `PrimaryButton` (`primary-button.tsx`: `data-askboard-primary`, the answer key's hint), whose label is `primaryLabelOf`'s (D5); the card's `onAnswer` goes through `pressAnswer`, which reports an `AnswerResult` (`sent`, `note-sent`, `held`, `released`, `note-held`, `note-released`, `needs-reason`) or `undefined` (blocked). In submitted delivery a second press on a ready answer releases it. Focus after an act follows #212's D1: the question's heading for `sent`, the control for `held`.
- **Board keys** (`board-keys`). `HeaderActions` (`header-actions.tsx`) holds the counts, the jump (`data-askboard-next-to-do`, `IconNextOpen`, `N`'s hint) and the Keys button; `previousOpenFrom` (`board-view.ts`) sits beside `nextOpenFrom`, both taking the `Ladder` and started from `shownQuestionOf(document, current)` (`board.tsx`); `Mod+Enter` runs the card's `onAnswer` through `answerKeyHandling` (`answer-key.ts`); `Shift+N`'s name is `keys.action.board.previousOpen`, and `skills/askboard-help/references/key-actions.md` is generated from the board strings.
- **Icons** (`icon-set`). `IconNextOpen` (`arrow-down`) in `packages/view/src/icons/index.ts`, drawn by `HeaderActions` after the jump's text; `strings/glyphs.test.ts` keeps arrows out of the strings.
- **The bar.** `BottomBar` holds the delivery switch with its helper, "Select recommended", the postponed warning, the updates line and Submit (disabled in immediate delivery). `selectRecommended` (`submit.ts:324`) holds each selection for Submit in submitted delivery (`held: {act: "answer", byRecommended: true}`) and returns a count.
- **Moves.** `revealAndFocus` (`reveal.ts`) scrolls instantly clear of `measureInset()` (the header and the last `footer`), then focuses; `useQuestionInView` uses the same band. The tab strip (`board.tsx:180`, Radix `Tabs.List`) is not sticky.
- **Messages.** One `StatusRegion`; `sentMessageOf` and `addedMessageOf` (`flow-messages.ts`); `Senders.status` called on outcome `sent` only.
- **Settings.** The configuration's presentation keys are `PRESENTATION_KEYS` (`contract/src/schemas/configuration/index.ts:22`), read generically by `ask-core` (`core/src/config/presentation.ts`, `settings.ts`) and `board-host`; the board protocol's `setting.json` enumerates them and `settings.json` holds one row per configuration key (`keys` optional); the board page maps a settings message to `ViewPresentation` (`board-page/presentation.ts`) and the panel's controls from `CHOICES` and `LABELS` (`board-page/settings-panel-data.ts:75`). On main (46d3dcf7, unchanged since 583a0161): configuration 1.1, board protocol 1.10.
- **Motion.** The only animation is the reading panel's skeleton (`board-page/reading-panel.ts:69`, `animate-pulse`); `styles/base.css` is shared by both documents.

AD IDs relied on: AD-1 (view code stays in `view`; the setting crosses contract, core and server only along existing edges), AD-3 (receipts), AD-7 (versions), AD-8 (agent text as text), AD-10 (fail closed), AD-14 (configuration and the board's writes), AD-20 (held acts). UX: EXPERIENCE.md Board chrome, Question card, Counting, By surface, Accessibility Floor, Preferences and Settings, Voice and Tone; DESIGN.md Markers, Board chrome, Question card, Open Items 1.

## Goals / Non-Goals

**Goals:**

- Every rule of the flow (the state, the next question, what happens after an act, completion, prefill eligibility and undo, scroll frames, message gating) is a pure function unit-tested in Bun; the DOM glue is thin and each Given/When/Then has a browser test, focus and scroll ones in the three engines.
- Seams `answering-flow-visual` (change 6) can borrow: the ladder state and its counts, the after-answer decision and footer store, the completion model.
- Tests find controls by stable hooks, not labels, so the renames land once and later label changes cost nothing.

**Non-Goals:**

- New board keys or bindings (`board-keys`, #187, merged): this change aligns only `Shift+N`'s order and name and the answer key's focus with its flow (D2, D3, D13). Direction B's layout: the outbox ledger, the progress strip, the bottom bar's removal (its postponed warning moves with it), "Edit" on a sent card, the visible "The agent added … · Go" notice, short question numbers, compact defaults (change 6). Palettes (#189).
- The ask pill and its words: unchanged. #186 found that it follows the ask state computed from the log (`askStateOf`, no watermark), so it reads "Answered" while receipts still read "Sent"; what it claims is PO question #213, and its records are change 6's (#213's proposed default).
- Messages for a follow-up reply or an agent's edit to a question.

## Decisions

### D1. One ladder state per question

`shell/answer-state.ts` exports `answerStateOf(inputs)`, pure, giving one of `todo`, `draft`, `ready`, `not-sent-yet`, `sent`, `delivered`, `postponed`, `declined`:

1. A held act decides first: `answer` is `ready`, `decline` `declined`, `postpone` `postponed`; a held `reopen` or an undo goes straight to rule 5.
2. A flight whose outcome is `queued` is `not-sent-yet`.
3. A command the board page has sent (outcome `sent`) reads as its act until it settles: `answer` is `sent`, `decline` `declined`, `postpone` `postponed`; a `reopen` or a `note` falls through; the work it carries is not read as a revision, so a revision on its way never claims the old answer's receipt (review finding S-14).
4. A logged `answered` or `declined` status is `draft` while the question is revising; else `delivered` or `sent` from the logged answer's `receipt`, or `declined`. `postponed` is `postponed`.
5. An open question, or one a held `reopen` or undo reopens, is `draft` while it holds answer work, else `todo`.

"Answer work" and "revising" are one rule, the base's: `questionRevising` (`revising.ts`), that is `hasAnswerWork` (`board-draft.ts`) on the revision the work was made on: an item's value, result or typed entry, "Other…", an option note or the note. The caller passes it in as `revising`, and `answerStateOf` derives nothing from the content itself, so the card's revision rule and the ladder never disagree (review finding S-3: an answered question holding only an unparsed entry, or only a note, is a revision and reads Draft, never "Delivered"). The board builds it once as `revisingOfBoard` (`revising.ts`): the board's `RevisingSnapshot` set for an answered or declined question, and `questionRevising` itself, the same predicate, for the others, since the set holds only answered and declined questions and a first draft is answer work too (review finding S-15). A note alone still never moves the board (D3).

`Mark` becomes this union; `markOf` keeps its name and, with `isOpen`, `openCountOf`, `tabOpenCount`, `postponedWarningOf`, `nextOpenOrder` and `nextOpenFrom`, takes a `Ladder` (`flightOf`, `revisingOf`), built once in `board.tsx` and passed to every surface, so no surface derives its own. `isOpen` is `todo`, `postponed`, or `draft` when the draft is not a revision. A **revision** is a `draft` over a logged answer or decline that no held or sent undo reopens (a held `reopen`, a `QuestionWork.undo`, or a `reopen` command not yet settled): it reads Draft on the card and in the outline but is not counted as to do and is never a next-question target: the agent holds an answer, and counting it would make an answered board look unfinished (report §3.1 draws "Delivered → Draft"; its "counts as open" column describes a first draft). A reopened question being edited is a first draft and counts as to do, since the undo reopens it (review finding S-9). One pure predicate, `isRevision` in `answer-state.ts`, decides it for `isOpen`, `ladderCountsOf` and `completionOf` (D6). `ladderCountsOf(document, state, work, flightOf, revisingOf)` counts each state over the board, and `revisions`, so the count to do is `todo + draft − revisions + postponed` (Counts and the next-open jump): change 6's ledger reads it. `flightOf(questionId)` gives the card's unsettled command and the act it carries for the question (`acts.of(id, CARD_ACTS)`), `revisingOf` the rule above.

Delivery and the lost connection, as these rules give them. In "One by one" an answer sent while the connection is lost reads Not sent yet (rule 2). In "All together" Send's held acts stay held until its command settles done (`CARRIED`, `carried.ts`), so an answer reads Ready, not sent while Send's command is on its way, and while it is queued if the connection drops after the press (Send is disabled while the connection is lost), never Not sent yet or Sent before it is done: it under-claims, which is safe. An answer the board page sent just before the connection was lost stays Sent until the board page hears back (review finding X-2, accepted): on reconnect the command goes again under its action ID, and if the ask has ended it is dropped and the question reads Draft. An answer the agent recorded itself has the receipt `delivered` (an answer with no cursor counts as received, `core/src/lifecycle/views.ts`) and reads Delivered to the agent.

The card shows the state as a line in its actions row, where the receipt shows today, text plus shape, and nowhere else: no marker stands beside the header chip, since a marker never stands without its label (review finding S-18). The receipt's words become the Sent, Delivered and Not sent yet labels (report §4: unchanged words, now state labels). Icons come in D11.

**Note sent** (requirement "Note sent under the prompt", split from "Open prompt" to keep each within OpenSpec's 500 characters). "Note sent {time}" under the prompt is written when the note's command settles done, beside `clearCarried`, into a board store (`noteSent`, page memory, never browser storage, AD-8); never at the press, so a note queued, refused or dropped never shows it, and the line and the state line never disagree (review findings S-10, X-1). {time} is the note act's `when`: when the user sent the note, the time the agent's event carries, stamped at the press that sends it ("Send the note", `card-acts.ts`; Send's click in "All together", `submit.ts`), not when its command is done, so a note queued while the connection is lost shows its press time once it goes (review findings S-23, X-3, decision (a)). In "All together" "Confirm" only holds a note alone, and the line shows once Send's command is done, by the same write, never at "Confirm" (review finding S-22).

*Alternatives.* A separate `ladderOf` beside `markOf` was rejected: two notions of a question's state is the defect (F-14).

### D2. The next question to do

`nextOpenFrom` keeps its name (`board-keys` reads it for `N`; its label `header.nextOpen` reaches `board-keys`' tooltip and keys panel as it is); since group 5 it takes the board's `Ladder` after `work`, as `isOpen` does (D1). It changes its order: unseen questions the agent added first, then `todo` and `draft` questions after `current` in board order, wrapping; then `postponed` ones after `current`, wrapping (report §3.2: a postponed question is reached last, not skipped). The header button keeps `header.nextOpen` as its key, with the value "Next to do". `board-keys` landed first (#225) with `previousOpenFrom` beside it (open questions before the question in view, wrapping); the rebase gave it the `Ladder` (b0d6fb36) and left its order as it was. Task 6.2 aligns it in the commit of `nextOpenFrom`'s order: `todo` and `draft` questions before `current`, wrapping to the last, then `postponed` ones before `current`, wrapping likewise; and `keys.action.board.previousOpen` becomes "Previous to do" / "Precedente da fare". This delta MODIFIES `board-keys`' "Next and previous open by key" to match (copied from main at 46d3dcf7).

### D3. After an answer

`shell/after-answer.ts` exports `afterAnswerOf(input)`, pure. Input: the act (`answer`, `postpone`, `decline`), its result (`AnswerResult`, or `took-effect` for a postpone or decline that took effect), whether it was a revision or an undo, `single` (a board of one question), the setting, the delivery mode, and:

- `next`: the target `nextOpenFrom` gives from the acted question when that target is to do or a first draft, else none. A postponed target is left out, so a board with only postponed questions left gives `complete` or `send-all`, never a move;
- `held`: the acts held for Submit once the act is taken, of any kind (answer, decline, postpone, note, undo);
- `area`: the acted question's area (id and title), the questions to do it still has, and the target's area.

Output, one of:

| Output | When | The board then |
|---|---|---|
| `stay` | revision, note alone (`note-sent`, `note-held`), undo, `released` ("Edit"), blocked, cancelled confirmation, single-question board | focus as the base's D1 (the question's heading, or the control) |
| `move {target, newFromAgent, areaDone?}` | setting `next`, a question to do remains | reveal and focus the target's heading (D4), arrival mark, tab or view change |
| `footer {target, newFromAgent, areaDone?}` | setting `stay`, a question to do remains | the card's footer; focus to "Continue" |
| `complete` | no `next`, and not `send-all` | completion panel; focus to its heading (D6) |
| `send-all` | no `next`, "All together", any act held | focus to the send button, the "All ready" line (D6) |

`target` is `next`; when only postponed questions remain there is no `next` and the output is `complete` (the panel's postponed variant offers "Go to the first"). `areaDone` names the acted question's area when it has no question to do left and the target is in another area.

- **Where it runs.** At the act, never at the reply (the base's D1 rule): the card calls it from its outcome handling, which `pressAnswer`, "Accept recommended", Postpone and Decline already reach; `board-keys`' `Mod+Enter` calls the same `onAnswer(control)` and so gets it too. There `control` is the element that had focus (an option or the heading), so that a cancelled confirmation returns focus to it: the flow never takes `control` for the primary, and finds the primary as `[data-askboard-primary]` inside the card where it needs it ("Edit" keeping focus, the `stay` output). Decline's move runs after the More menu's close (`onCloseAutoFocus` prevented), so the menu does not give focus back to its trigger.
- **A held key (NFR-10).** The move happens on the act, while the key that made it may still be down. Until that key's keyup, the board ignores key events with `repeat` set on the moved-to card and on "Continue" (`preventDefault`, before any other handler), so a held or auto-repeated key never selects, answers or continues on the next question. `board-keys`' handlers ignore `repeat` for `Mod+Enter`, `N`, `Shift+N` and `?` (its D3 and D4). Its `answer-key.browser.ts` expects focus on the answered question's heading after `Mod+Enter`; with the default "Go to the next" focus goes to the next question to do, so task 6.1 updates those cases and adds the "Stay here" variant of the held key, as this delta's MODIFIED "Answer by key" says.
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
- Send: `bar.submit` is "Send {count} answers" with {count} the held answer acts (plural forms); with held work but no held answer it reads `bar.submitPlain` "Send" (Q2). The bar renders no Send button in immediate delivery. The replace dialog with nothing sent returns focus to Send, which is present whenever the dialog is (review finding S-17; narrowed by task 4b.7).
- The submitted helper names the button as `bar.submitName` ("Send answers", «Invia le risposte»), not its counted label (Q1).
- The replace dialog's confirm, where Send asks before it replaces answers the agent has received, reads `revision.confirmSend` ("Send" / "Invia"), as the single revision dialog's confirm does, not the counted `bar.submit`: the dialog lists only the questions whose answers it replaces while the press sends every held act, so a count there would name the wrong number (review finding S-3). Its body's en-US value stops naming Submit ("…Sending replaces them:"), as the Italian «L'invio le sostituisce:» already reads.
- "Accept recommended" moves to the recommended option's row, after its badge, and renders only while the question is `todo` or `draft` (F-18).
- **Stable hooks.** The primary carries `data-askboard-primary`, Send `data-askboard-submit`, Postpone `data-askboard-postpone`, Prefill `data-askboard-prefill`, the header jump `data-askboard-next-to-do`, each delivery segment `data-askboard-delivery="immediate|submitted"`, the replace dialog's confirm `data-askboard-confirm`, the card's state line `data-askboard-state` (and `data-askboard-receipt` for its three sent states), `data-askboard-marker` (its state) on each marker beside a state's label (the card's state line, the outline entry, the question navigator, and the bar's postponed warning beside its text) and on none drawn inside a control beside the control's own label (`QuestionMarker`'s `inControl`: the held marker in the primary, the postponed one in Postpone, the declined indicator of More's Decline), so a card holds one, on its state line (review findings S-18, S-20), and the card `data-askboard-logged-receipt="sent|delivered"` while the board state holds a logged answer or decline with that receipt, rendered from the same status the confirmation rule (`confirmsRevisionOf`) reads: the probe of delivery where the state line cannot show it, under a held act or on a decline (review finding S-11; the ask pill is no such probe, since it follows the log, `askStateOf`, and changes when the act is logged, not on `collect`). The harness's locators (`harness/dom.ts`) use them, and browser tests find controls through the harness, never by these labels. Since the rebase, `data-askboard-primary` is on `board-keys`' `PrimaryButton`, once, and `data-askboard-next-to-do` on the jump in its `HeaderActions`.

The strings, by key (EN, IT). "Accepted" is report §4, decision 3; the rest are Italian "(to review)" in EXPERIENCE's Voice and Tone.

| Key | en-US | it-IT | Status |
|---|---|---|---|
| `bar.delivery` | Sending answers | Invio delle risposte | accepted |
| `bar.immediate`, `bar.submitted` | One by one, All together | Una alla volta, Tutte insieme | accepted |
| `bar.immediateHelp` | Each answer goes to the agent as soon as you send it. | Ogni risposta parte appena la invii. | accepted |
| `bar.submitName` (new) | Send answers | Invia le risposte | Q1 default |
| `bar.submit` | Send {count} answer / answers | Invia {count} risposta / risposte | accepted |
| `bar.submitPlain` (new) | Send | Invia | Q2 default, to review |
| `revision.submitBody` (en-US value only) | The agent has already received your earlier answers to these questions. Sending replaces them: | unchanged | S-3 |
| `bar.switchTitle` | Switch to "One by one"? | Passare a «Una alla volta»? | accepted |
| `question.answer` | Send answer | Invia risposta | accepted |
| `question.confirm`, `question.edit`, `question.sendNote` (new) | Confirm, Edit, Send the note | Conferma, Modifica, Invia la nota | accepted |
| `question.sendChange` (new) | Send the change | Invia la modifica | to review |
| `question.postpone` | Later | Più tardi | accepted |
| `question.more` | More | Altro | accepted |
| `question.noteSentAt` (new) | Note sent {time} | Nota inviata {time} | to review |
| `mark.unanswered`, `mark.ready`, `mark.postponed` | To do, Ready, not sent, Postponed | Da fare, Pronta, non inviata, Rimandata | accepted |
| `bar.postponedWarning` (it-IT value only) | unchanged | Hai {count} domanda rimandata / domande rimandate: chiudendo perdi questa richiesta | to review: §4's word for `mark.postponed` ("same root as «Più tardi»") in place of "rinviata", so the bar and the header name a postponed question alike (review finding S-7 of group 4; D10) |
| `mark.draft` (new) | Draft | Bozza | to review |
| `receipt.notSentYet`, `receipt.sent`, `receipt.delivered` | Not sent yet, Sent, Delivered to the agent | Non ancora inviata, Inviata, Consegnata all'agente | accepted (§4; "Not sent yet" capitalised as §3.1) |
| `header.open`, `areas.open` | {count} to do | {count} da fare | accepted |
| `header.openPostponed` (new) | {open} to do ({count} postponed) | {open} da fare (di cui {count} rimandata / rimandate) | accepted |
| `header.nextOpen` | Next to do | Prossima da fare | accepted |
| `keys.action.board.previousOpen` (`board-keys`' key) | Previous to do | Precedente da fare | to review (D2; the English is report §5.1's) |
| `bar.selectRecommended` | Prefill recommended ({count}) | Precompila le consigliate ({count}) | accepted |
| `bar.undoPrefill` (new) | Undo | Annulla | accepted |
| `footer.next`, `footer.continue`, `footer.newFromAgent` (new) | Next: {title}, Continue, New from the agent | Prossima: {title}, Continua, Nuova dall'agente | to review (Q3) |
| `completion.title` (new) | Every question has an answer. | Tutte le domande hanno una risposta. | accepted |
| `completion.counts` (new) | Sent: {s}. Delivered to the agent: {d}. | Inviate: {s}. Consegnate all'agente: {d}. | to review: §4's "{s} inviate, {d} consegnate all'agente" read "1 consegnate", and the catalogue picks forms by `count` only, so no plural form serves two counts (review finding S-2, the coordinator's decision of 2026-11-15) |
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

{n} of {m} is the target's position among the board's questions; no short question numbers (change 6). The messages for every question answered and all ready have no keys of their own: their builders reuse `completion.title`, `completion.counts` and `bar.allReady`. `header.openPostponed` and `completion.postponed` take `count` for the postponed number, which picks the plural form, and `open` for the count to do.

### D6. Completion

`completionOf(document, state, work, flightOf, revisingOf, delivery)`, pure, in `shell/completion.ts`, with D1's inputs:

- `none` while a question is `todo` or a `draft` that is not a revision (D1's `isRevision`: a reopened question being edited is a first draft), or any act is in flight.
- `send-all {count}` in "All together" while any act is held and nothing is to do; `count` is the held answers, which Send's label shows (Q2).
- `postponed {count, first}` while only postponed questions remain to do and nothing is held.
- `done {sent, delivered}` when every question has a logged answer or decline and nothing is held, a revision in progress included: the user is editing an answer the agent already holds, so "Every question has an answer" stays true, and the panel stays (the spec's rule; review finding S-4). In "All together" a confirmed revision is held, which gives `send-all`.

The counts are `receiptCountsOf(document, state)`, pure, in the same module: `sent` is the board's questions whose logged answer or decline has a receipt (`sent` or `delivered`), revisions included, `delivered` those whose receipt is `delivered`. `completionOf` and the delivered messages read it, never `ladderCountsOf`, whose `sent` and `delivered` leave out a question while it is revising.

It reads the questions' receipts only, never `state.ask` or the ask pill, so neither #186's finding nor #213's answer changes anything here. `CompletionPanel` renders at the top of the main content, from the model, with a focusable heading (`tabIndex={-1}`); it takes focus only from an act (D3's `complete`, or after Send), never when it renders at load, after a reload or on a state update, and nothing in this change focuses the view at load (a new board ignores keys until the user clicks or focuses in it, EXPERIENCE's Accessibility Floor); not on a locked board or in an opened Snapshot. `send-all` renders the `bar.allReady` line beside Send instead. The panel never says the tab can be closed (PO, 2026-11-14).

**Delivered messages.** `createDeliveredGate()` (pure, `shell/delivered-messages.ts`: `observe(counts, now)`, `dueAt()`, `due(now)`) takes `receiptCountsOf` from each state update and gives at most one `status.delivered` per 5 s, the latest counts at the window's end; the first observation is the baseline, and a count that has not changed, or is 0, says nothing. The base's guard that no message says "delivered" (`answering-flow-status.browser.ts`, `strings/flow-strings.test.ts`) exempts `status.delivered` and `completion.counts` only.

### D7. More status messages

`flow-messages.ts` gains builders for D5's `status.*` keys. `sentMessageOf` keeps its signature and result; `sentMessagesOf(via, acts, {next, revision})` returns the list a sent command says: the answer's (or `status.changeSent` for a revision), then `status.next` when D3 recorded a target for the acted question at the act (a map in `BoardContext`, read once, then cleared). So "Answer sent: {option}." and "Next: {title}, {n} of {m}." are said together when the board page reports the command sent, never earlier. A held answer (`held`) says `status.ready` plus `status.next` at once, as the base does. Postpone and decline say theirs on `sent` in "One by one" and at the act when held. `status.readyLost` is raised when a field check releases a held answer (`releaseFailed`, `heldWithBlock` in `submit.ts`), with `fieldToFixOf`'s label. The all-answered messages (`allAnsweredMessagesOf`, the two `completion.*` lines) and the all-ready one (`allReadyMessageOf`, `bar.allReady`) are raised when `completionOf` turns `done` or `send-all`. Titles go in as text, cut at 80 characters (the base's D4).

### D8. Prefill recommended

- `selectRecommended` keeps its eligibility rule and stops holding: it only sets drafts, in both modes (decision 4), and returns the batch it filled (`{questionId, label}[]`) instead of a count. `HeldAct.byRecommended` is no longer written; the field stays in the draft-record schema (a removal would be a major, AD-7), and a restored draft that holds one is an answer the user marked ready under the old rule, sent as before.
- `prefillCountOf` (same predicate, no writes) gives the label's count; the button is absent at 0.
- The bar shows `status.prefilled`'s text and "Undo" while the batch is live; focus moves to "Undo" (the button it came from is gone at 0; report §5.2 says focus stays on the button, P1-6 says the button goes: Undo is where the user can still act). `undoPrefill(batch)` clears each selection still equal to the prefilled label on a question holding no held act, announces `status.prefillUndone` and focuses "Prefill recommended". The batch dies on the next draft change or act (the draft store's subscription), so Undo never clears a choice the user made.
- Submit sends held acts only, so prefilled drafts never leave unconfirmed (PRD FR-3 and FR-22 amended).

### D9. The after-answer setting

- **Contract** (next minor after main's, configuration and board protocol): `config.json` gains `afterAnswer` (`next`, `stay`); `PRESENTATION_KEYS` and `CONFIGURATION_KEYS` gain it after `contextPlacement`; `ConfigurationValues.afterAnswer: AfterAnswer`; `CONFIGURATION_DEFAULTS.afterAnswer = "next"`. `setting.json`'s key enum and its `if/then` chain admit it; `settings.json` gains an optional `afterAnswer` row (a new required row would be a major) and `write.key` admits it. Fixtures in a module of this change (`fixtures/after-answer.ts`).
- **core and server**: no source change expected, since both read the key lists; their tests pin the new key (`askboard-contract-versioning`, Rule 2).
- **Board page and view**: `presentationOf` reads the row, `next` when absent; `ViewPresentation.afterAnswer` and `isPresentation` (its `locked` too) admit it; the panel's `CHOICES` and `LABELS` gain a segmented row "After answering". No quick toggle: the settings panel is the board page's and writes to `board-host` itself, so no view control writes `afterAnswer`, and the view's `setting` message keeps admitting only `theme`, `density` and `contextPlacement` (least privilege), each with `settingProblems`' value check. A refused or failed write keeps the user's pick, as for the other keys. An opened Snapshot passes `next` (it never answers). Group 1 shipped the contract before the view read the key, with stopgaps that task 6.5 replaces (review finding S-2).
- AD-14 is amended in place (the presentation keys, the board's writes) and FR-35 names the preference.

### D10. Report conflicts settled here

- §4 renames `state.postponedPart` while its note keeps `state.*` until D-6: the pill and its words wait for #213 and change 6 (coordinator, 2026-11-15), so the pill keeps "rinviata" while the marks say "Rimandata". `bar.postponedWarning` names the questions' state, not the ask's, so it takes "rimandata" with the marks, the header and the completion panel (D5); the pill is then the only "rinviata" left.
- §3.2's flowchart activates the next tab before the setting's branch; with "Stay here" that would hide the card holding the footer, so the tab activates on "Continue" (D3).
- §3.3.1's "Prossima: {title} {number}" uses change 6's short numbers; here the footer names the title, and the message gives "{n} of {m}".
- §5.2 (prefill keeps focus) against P1-6 (the button goes at 0): D8.

### D11. Icons

`icon-set` is on the base. Lines added to `packages/view/src/icons/index.ts`, decorative (`aria-hidden`) beside their text: `IconToDo` `circle`, `IconDraft` `pencil`, `IconReady` `package`, `IconNotSentYet` `hourglass`, `IconSent` `send`, `IconDelivered` `check-check`, `IconPostponed` `clock`, `IconDeclined` `ban`, `IconAreaDone` `check`, `IconComplete` `circle-check-big`; `IconNextOpen` changes from `arrow-down` to `arrow-right` (report §4: one label, no direction glyph, since in one question per view the jump changes the question shown), still drawn by `HeaderActions`. The ladder's icon replaces the CSS shape of `QuestionMarker` on the card's state line, the outline and the navigator, keeping `data-askboard-marker`; the ask pill keeps its shapes. Each new export is imported by a non-test source, as `icons/index.test.ts` requires. DESIGN.md's Icons table gains the rows. This delta MODIFIES `icon-set`'s "Icons beside their labels" (the jump's scenario: its new label and `arrow-right`) and gives the ladder the scenario "The state's icon".

### D12. Reduced motion

`styles/motion.css`, imported by `styles/base.css` (both documents): the arrival edge's keyframes inside `@media (prefers-reduced-motion: no-preference)`, and inside `@media (prefers-reduced-motion: reduce)` `*, ::before, ::after { animation-duration: 0s !important; animation-iteration-count: 1 !important; transition-duration: 0s !important; scroll-behavior: auto !important }`. The reading panel's skeleton pulse is covered by that rule. No component uses enter or exit animations today (`git grep animate-`), so no dialog waits for an animation event. DESIGN.md Open Items 1 becomes a motion inventory (§5.4) and is marked settled.

### D13. Keys

No binding is added or changed and no key table is touched: `board-keys` (#187) owns `N`, `Shift+N` and `Mod+Enter`, and routes `Mod+Enter` through the primary's own path, so D3 applies to it. What changes on its side is `Shift+N`'s order and name (D2) and where focus lands after `Mod+Enter` (D3); this delta MODIFIES "Next and previous open by key" and "Answer by key" for them, and `bun run build:skills` regenerates `key-actions.md` with the new name (`check:skills` fails on drift). "Continue", "Edit", "Undo" and "Go to the first" are plain buttons reached with Tab; "Continue" takes Enter natively. `keys-coverage.test.ts` is unaffected (no widget).

### D14. Records and versions

- **Versions.** Configuration and board protocol each at the next minor after main's, bound at the rebase task (`askboard-contract-versioning`). No other set, no view-manifest, Snapshot-data or draft-record change. Re-checked at the rebase onto 46d3dcf7: main still holds configuration 1.1 and board protocol 1.10 (no constant moved since 583a0161; `board-keys` and `icon-set` bound none), so the branch's 1.2 and 1.11 stand; task 11.7 binds them against main as it stands before the pull request.
- **PRD**: FR-3 and FR-22 (prefill fills drafts only; Submit sends what the user confirmed), FR-35 (the after-answer preference), and a glossary note that the PRD's act names ("Answer", Submit, "Select recommended", Postpone) are the acts, labelled as EXPERIENCE.md's Voice and Tone says. **Spine**: AD-14 amended in place.
- **EXPERIENCE.md**: Board chrome (Next-open jump, Outline navigator, Question navigator, Area, Bottom action bar, Select recommended, Delivery mode switch, Submit), Question card (Answer, Question marker, Accept recommended, Open prompt, Postpone, Delivery receipt), Counting (the ladder), By surface (completion), Accessibility Floor (focus destinations of §5.2, the new messages, reduced motion), Preferences and Settings (the after-answer row), Voice and Tone (D5's strings, the act-names note), a Key Flow "Answering a long board", Open Items 22 narrowed to keyboard inside widgets and text zoom. **DESIGN.md**: Colors, Markers (the ladder), Header chip (no marker beside it), Next-open jump, Bottom action bar, Select recommended, Delivery mode switch, Submit, Answer, Question marker, Accept recommended, Delivery receipt, Settings panel, new rows "Continue footer", "Completion panel", "Arrival mark", the Icons table (D11), Open Items 1.
- `docs/as-built/answering-flow-guidance.md`; `tools/build/skills/templates/help/SKILL.md`'s "The board" section, regenerated with `bun run build:skills`.

## Merge points

| With | Shared | Rule |
|---|---|---|
| `answering-flow-fixes` (#212; merged fd14489a, archived f9f38388) | every seam of Context; its requirements "Counts and the next-open jump", "One question per view", "Outline navigator", "Delivery mode", "Focus after Answer and Submit", "Focus moves clear the sticky bars", "Status messages for the answering flow", which this delta MODIFIES | Resolved as built: the branch was rebased onto main 46d3dcf7; those seven blocks equal main's text plus this change's edits, and "Focus after Answer and Submit" keeps main's nine scenarios by name (two adapted to D3), so archive drops none |
| `icon-set` (#210; merged c9d550b6, archived 8618edae) | `packages/view/src/icons/index.ts`, `IconNextOpen` (drawn by `HeaderActions`), `strings/glyphs.test.ts` (no ↓ ↩ ↻ ↗ ✓ ✕ × in a value: no new string holds one), DESIGN.md Icons, `chunk-sizes.json`, `icons.browser.ts` (the jump's case already reads "Next to do"), its requirement "Icons beside their labels" | Resolved as built: on the base, so group 9 is not blocked; this delta MODIFIES "Icons beside their labels" (D11) |
| `board-keys` (#187; merged as #225, 8fe036d0, archived 46d3dcf7) | `PrimaryButton` (`primary-button.tsx`), `HeaderActions` (`header-actions.tsx`), `previousOpenFrom` (`board-view.ts`), `answer-key.ts`, `board.tsx`, strings, `suites.ts`, `answer-key.browser.ts`, `board-keys.browser.ts`, `hint.test.ts`, `board-keys-panel.test.ts`, the help skill's `key-actions.md`, `chunk-sizes.json`; its requirements "Next and previous open by key" and "Answer by key" | Resolved as built at the rebase: `data-askboard-primary` once, on `PrimaryButton`, whose children are `primaryLabelOf`'s label; `data-askboard-next-to-do` on the jump in `HeaderActions`; `nextOpenFrom` and `previousOpenFrom` take the `Ladder` (b0d6fb36) and start from `shownQuestionOf`; its tests find controls by hook (60ceafb2); `key-actions.md` regenerated with "Next to do" (7faa6f3f). Left to group 6: `previousOpenFrom`'s order and name (6.2, D2) and the tests whose focus the default moves (6.1, D3); this delta MODIFIES both requirements |
| `answering-flow-visual` (change 6, not proposed) | borrows `answerStateOf`, `ladderCountsOf`, `afterAnswerOf`, the footer store, `completionOf` | Only after this change merges |
| `early-benchmark` | none (`packages/bench`) | none |

Borrowed from `main`, all found on `origin/main` 46d3dcf7 at the rebase (task 0.2 recorded file and line for the first list): `markOf`, `isOpen`, `openCountOf`, `tabOpenCount`, `nextOpenFrom`, `Mark`, `markLabel`, `QuestionMarker`, `askPillOf`, `selectRecommended`, `hasRecommendation`, `submitStateOf`, `releaseFailed`, `heldWithBlock`, `pressAnswer`, `measureInset`, `PRESENTATION_KEYS`, `CONFIGURATION_KEYS`, `CONFIGURATION_DEFAULTS`, `ConfigurationValues`, `ViewPresentation`, `isPresentation`, `presentationOf` (board page), `CHOICES`, `LABELS`, `Receipt`, `HeldAct`, `BROWSER_FILES`, `STRING_KEYS`; from #212: `revealAndFocus`, `revealDelta`, `REVEAL_GAP`, `questionInView`, `useQuestionInView`, `createStatusMessages`, `StatusRegion`, `sentMessageOf`, `addedMessageOf`, `Senders.status`, `AnswerResult`, `BottomBar.onSubmitted`, `shownQuestionOf`, `fieldToFixOf`, `focusField`, `fixtures/answering-flow-asks.ts`, harness `Board.status`, `data-askboard-agent-pill`; from `board-keys` and `icon-set`: `previousOpenFrom`, `PrimaryButton`, `HeaderActions`, `answerKeyHandling`, `keys.action.board.previousOpen`, `IconNextOpen`.

## Needs probe

None about Claude Code's run time: no mod, hook, agent or permission behaviour is assumed. Browser behaviours the tasks check rather than assume: a `position: sticky` tab strip inside the view's scroll container in the three engines (task 6.1), and `matchMedia("(prefers-reduced-motion: reduce)")` under Playwright's `reducedMotion` emulation in the three engines (task 10.1).

## Risks / Trade-offs

- [The renames break many browser tests] → group 2 moves every test onto stable hooks before any label changes, so group 4's renames touch only tests that assert text.
- [A smooth scroll races the in-view hook] → focus is on the target from the first frame, and the focus rule of the question in view wins once the card is in the band; the draft mirror's debounce absorbs the intermediate writes.
- [The default moves focus away from the card just answered, so its receipt is out of view] → the status message says what happened, and "Stay here" is one setting away.
- [The "Note sent" line does not survive a reload] → the board state holds no sent notes; adding them is a protocol change this flow does not need.
- [Two messages close together (sent, then delivered) and a screen reader drops one] → the delivered gate's 5 s window; a by-hand pass with VoiceOver and Orca is #209's.
- [Shell chunk growth] → estimate 12 to 16 KB (six modules, two components, about 45 strings in two languages) on main's recorded 239,027 B (46d3dcf7, with #212, `board-keys` and `icon-set`), inside its 10% allowance of about 23.9 KB. Task 11.3 bounds the growth at 16,000 B over that figure and re-records.

## Migration Plan

None for data: the configuration key is optional and defaults to `next`; a draft restored from an older page keeps its held acts, `byRecommended` included. A board open during an upgrade picks up the new view at its next load.

## Open Questions

Posted on #168 with `needs-po`, each with its default; task 0.1 records the answers.

- **Q1.** The accepted submitted helper names «Invia le risposte», but the button now reads "Invia {count} risposte". Default: keep the accepted sentence with the fixed name «Invia le risposte» (`bar.submitName`). Alternative: name the counted label ("…finché non premi «Invia 2 risposte»"), which changes as the count does.
- **Q2.** What "{count}" counts when the held work holds postpones, declines or notes. Default: ready answers only, and "Invia" alone when none is held, so the button never calls a postpone an answer and matches "{k} risposte inviate". Alternative: every held act.
- **Q3.** Strings outside §4: "Continua", "Prossima: {title}", "Nuova dall'agente", "Invia la modifica", "Bozza" and D5's "to review" rows, and whether "{area} completata" may stay for a masculine area title ("Rilascio completata"). Default: ship them marked "(to review)" and keep "{area} completata" as accepted.
