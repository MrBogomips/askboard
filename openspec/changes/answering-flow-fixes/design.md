# Design

## Context

See proposal.md (Why) for the seven defects. The input is the UX review of #168: `drafts/ux-review-168/ux-review-report-1.1.0.md` §8.1 (P0-1 to P0-7), §4 (wording), §5 (focus, live region, reduced motion), and the evidence in `assessment-1.0.0.md`. The draft never overrides `docs/` or `openspec/`.

How the code works today, on `main` at 583a0161, all under `packages/view/src/shell/`:

- **Focus.** A question's heading has `tabIndex={-1}` (`question-card.tsx:491-497`). The heading takes focus in two ways. The board's request store goes `requestHeading` → `useHeadingFocus` (`board.tsx:241-248`), and the card calls `focusHeadingOf` (`question-card.tsx:141`). Both call a bare `.focus()`, so the browser scrolls only when the heading is wholly out of view, and it ignores the sticky bars (#180). "Answer" goes `onAnswer` → `pressAnswer` → `answer()` (`card-acts.ts:325-364`). In immediate delivery `answer()` starts a flight, which disables the button (`question-state.ts:196-204`, then `:208-217` once answered). Nothing moves focus, so it falls to `<body>` (#179). `settleConfirmation` gives no focus target for a confirmed answer (`revision-confirm.ts:96-107`). Submit's buttons disable themselves (`bottom-bar.tsx:236-244`), and the replace dialog sends focus back to the disabled Submit (`bottom-bar.tsx:275-281`).
- **The question in view** is `draft.inView` (`board-draft.ts:51`, kept in the draft record and mirrored with a 300 ms debounce, `board-page/draft-mirror.ts:10`). Only jumps, tab activation and removals set it (`board.tsx:303-306`, `:379-383`, `document-update.ts:52-55`). The outline's `aria-current` (`navigators.tsx:80`) and `nextOpenFrom` (`board-view.ts:186-199`) read it (#181). Cards carry `data-askboard-question`, and items carry `data-askboard-item` (`renderer.tsx:143`). `focusedQuestion` (`index.tsx:104`) finds the card that holds focus.
- **Live regions.** The agent pill is `role="status"` (`agent-pill.tsx:32`). Besides it there are only the size lines and the Snapshot feedback. `selectRecommended` returns a count that the board drops (`board.tsx:444-451`). A command's reply reaches `dispatch` (`card-acts.ts:87-110`) with an outcome of `sent`, `queued` or `refused`, and `Senders.notices?` (`card-acts.ts:74-79`) is the existing optional seam beside it (#182).
- **The bar** shows `bar.immediateHelp` only (`bottom-bar.tsx:215-217`; #183). The navigator gets `onNextOpen` (`board.tsx:361`), and the header gets the counts in every presentation but the single-question board (`board.tsx:424`; #184).
- **The blocked "Answer".** `answerHint` (`field-block.ts:119-133`) builds the text from `fieldBlock`, which knows the field's `itemId` (`field-block.ts:71-94`), and the row renders the text `sr-only` (`question-actions.tsx:140-155`; #185). The sticky bars are measured by `measureInset` (`measure-inset.ts:9`), which returns the header's bottom edge and the bar's height for the reading panel.

Constraints: AD-1 (all code stays in `view`, with no new import edge), AD-8 (agent text renders as text), AD-10 and NFR-10 (no claim beyond the truth), AD-20 (the draft and held acts are unchanged), NFR-12 (keyboard core) and FR-34 (both languages). The shell chunk is 223,354 B, with about 22 KB of headroom under the 10% rule (`chunk-sizes.json`).

## Goals / Non-Goals

**Goals:**

- Each focus, reveal and question-in-view rule is a pure function, unit-tested in Bun. The DOM glue is thin and covered by browser tests in the three engines.
- One status region, with messages built from the outcomes the board already knows. No new protocol message, draft field or contract set.
- Seams that change 4 (guidance), change 5 (board keys) and change 6 (direction B) can borrow once this change merges: the reveal-and-focus helper, `questionInView`, the status store and its message builders.

**Non-Goals:**

- Advancing after an answer, "Continue", the completion panel, the state ladder, renamed labels, prefill with undo (change 4). Board keys (change 5). Icons (`icon-set`). Layout (change 6).
- Smooth scrolling and its reduced-motion form. This change scrolls instantly, which needs no reduced-motion variant. Change 4 brings P1-8.
- SC 2.4.11 for Tab traversal in general: a control reached with Tab can still sit under a bar. This change covers the moves the board makes itself. `scroll-padding` for Tab traversal is left to change 6, which replaces the bottom bar.
- Messages for postpone, decline, a lost ready mark, delivered receipts, a completed area and a finished board. Each depends on change 4's labels or flow.

## Decisions

### D1. Focus after an act follows the act's result (#179)

`answer()` reports what it did, as a new `AnswerResult`: `"sent"` (an answer command started), `"note-sent"`, `"held"` (marked ready), `"released"` (un-marked), `"needs-reason"`, or `undefined` (blocked, nothing done). `AnswerOutcome` and `pressAnswer`'s `onOutcome` carry it. The card acts on the result:

- `sent` and `note-sent`: focus goes to the question's heading through D2's helper. This holds at once, and on a confirmation: `settleConfirmation` gives `{to: "heading"}` for a confirmed answer that sent, and the control for one that marked ready.
- `held` and `released`: focus stays on "Answer", which stays enabled.
- "Accept recommended" takes the same path (`onAccept` → `onAnswer`).

Submit: `BottomBar` gains `onSubmitted()`. It runs once `sendActsOf` has sent, from the button and from the replace dialog. The dialog's `onCloseAutoFocus` gives the Submit button back only when nothing was sent. The board wires `onSubmitted` to focus the heading of the question in view (D3), or the first question when none is set. "Send and switch" is unchanged: Radix gives focus back to the switch, which stays enabled.

The move happens when the act is taken, or when its dialog closes. It never happens when the command settles, so it cannot take focus the user has moved during the flight.

*Alternatives.* Reading `document.activeElement` after the render and refocusing when it is `<body>` was rejected: engines differ when a focused button becomes disabled (Chromium blurs it to `<body>`, Firefox can keep it as the active element), so the rule would not hold in all three. Moving focus to the next open question was rejected because it is an advance: one question per view "SHALL NOT advance", and the after-answer setting with its default is change 4's decision. Focusing the receipt or "More" was rejected: neither is a place to go on from. The heading matches what Postpone and Decline already do (EXPERIENCE, Accessibility Floor).

### D2. One reveal-and-focus helper (#180)

`shell/reveal.ts`:

- `revealDelta(target, inset, viewportHeight, gap)` is pure. `target` is the element's `{top, bottom}` and `inset` is `measureInset()`'s `{top, bottom}`. It returns the vertical scroll that puts the box wholly within `[inset.top + gap, viewportHeight − inset.bottom − gap]`. A box taller than that span gets its top at the span's top. A box already inside gets 0. `gap` is 8 px.
- `revealAndFocus(element)` is the DOM glue: `measureInset()` (on `main`), then `window.scrollBy(0, delta)` (instant), then `element.focus({preventScroll: true})`.

`useHeadingFocus`, the card's `focusHeadingOf` and D7's field focus all call it, so every heading move, the jumps included, goes through one path.

*Alternatives.* CSS `scroll-margin` or `scroll-padding` alone was rejected. The browser's focus scroll leaves an element that is already partly in the viewport where it is, which is #180's case, and the bars' heights change with density and wrapping. `scrollIntoView({block: "nearest"})` with `scroll-padding` set from measured heights was rejected because it needs a CSS variable kept in sync by a ResizeObserver, for the same result.

### D3. The question in view follows scrolling and focus (#181)

`shell/in-view.ts` exports the pure `questionInView({cards, band, focused, atEnd})`:

- `cards` are the cards in board order, each with its id and `{top, bottom}`; cards with an empty box (a hidden tab) are left out.
- `band` is the space between the bars, from `measureInset`. The reading line sits a third of the way down the band.
- The rule is the spec's ("The question in view"). First, the focused card while it overlaps the band. Else, at the end of the page, the last card that overlaps the band. Else, the card crossing the reading line. Else, the last card above it. Else, the first card.

A hook in the shell, `useQuestionInView`, runs only for sections and tabs. On `scroll` (passive, at most once per animation frame) and on `focusin`, it reads the rects of the main area's `[data-askboard-question]` elements in one pass and calls `questionInView`. When the result differs, it calls `context.board.setInView`. It never runs at mount, so a restored question in view stays until the user scrolls or moves focus. One question per view keeps today's rule: the question shown.

The outline and the jump read `draft.inView` as today, so the code that reads it does not change. Since D1 focuses the answered card's heading, the focus rule makes "Next open" go on from the question just answered.

*Alternatives.* Reusing the attention's IntersectionObservers was rejected: they report whether a card is in view, not where it lies against a line, and a band-shaped `rootMargin` would have to be rebuilt whenever a bar's height changes. A separate "reading" state beside `draft.inView` was rejected: it would give the outline, the jump and the tabs two notions of "current". The extra writes to `inView` go through the draft mirror's existing 300 ms debounce, at most one per question crossed.

### D4. One status region, messages from the outcomes (#182)

- **The store.** `shell/status-messages.ts` holds message descriptors `{key, params}` and counts each announcement (`n`). It offers `announce`, `get` and `subscribe`. Descriptors announced before the next render are read together, in order.
- **The region.** `StatusRegion` renders one `sr-only` `<div role="status" aria-live="polite" aria-atomic="true">` in `Board`, outside the cards, from the first render. Its text goes through `useStrings()`, so it follows the ask's language. Its child is keyed by `n`, so a repeated message is announced again.
- **Builders.** `shell/flow-messages.ts` builds the descriptors as pure functions:
  - `sentMessageOf(via, acts)`: an `answer` act gives `status.answerSent` with `{option}`, or `status.answerSentPlain` when the answer has no choice or "Other…" text. A `note` act gives `status.noteSent`. Via Submit it gives `status.submitted` with the count of `answer` acts, and nothing when that count is 0. Any other act gives nothing.
  - `addedMessageOf(questions)`: `status.added`, with `{title}` for one question and the count for several.
  - `{option}` is the chosen labels joined with ", ", then the "Other…" text. `{title}` is the question's header chip, else its text. Each agent or user string is cut at 80 characters with "…" and rendered as text (AD-8). The region is not visible, so no bidi markup is needed.
- **Sources.**

| Message | Raised where | When |
|---|---|---|
| `status.answerSent`, `status.answerSentPlain`, `status.noteSent`, `status.submitted` | `dispatch`'s reply, through a new optional `Senders.status` | Only on outcome `sent`. `queued` and `refused` say nothing here: the connection banner, the "not sent yet" receipt and the size lines speak for them. |
| `status.ready` | the card, on result `held` | Count: the questions holding a ready answer after the act. |
| `status.prefilled` | `board.tsx`, from `selectRecommended`'s count | Every press, 0 included. |
| `status.added` | `applyDocumentUpdate` | Questions new to the board in an agent's update. Never the boot document, never a restore. Focus is not touched. |
| `navigator.removed` (existing) | `onRemoval` | The question in view was deleted, in any presentation. The navigator line still shows only in one question per view. |
| `agent.waiting` (existing) | `AgentPill`, which loses `role="status"` and gains `data-askboard-agent-pill`, the hook the browser harness then finds it by (`harness/dom.ts:85`, `header.browser.ts:294` read it by its role today) | A change to waiting. A change to working says nothing. |

*Alternatives.* `role="alert"` was rejected: it interrupts. A region per card was rejected: many regions, and noise. Announcing "sent" at the click was rejected because it fails NFR-10: the board page may queue or refuse the command. Announcing delivered receipts is deferred to change 4, which brings a batching rule (report §5.3).

### D5. Strings (FR-34; report §4 and §3.3)

The wording is the report's, as written. Messages are the first sentences of §3.3's messages, without the "Next: {title}" clause: nothing advances here, and change 4 adds the clause together with the flow it names. Italian marked "(to review)" follows EXPERIENCE's Voice and Tone rule for strings outside §4's accepted table.

| Key | en-US | it-IT | Source |
|---|---|---|---|
| `bar.submittedHelp` | Answers stay here until you press "{submit}". | Le risposte restano qui finché non premi «{submit}». | §4, accepted. `{submit}` is `bar.submit`'s label (#183), so it reads "Submit" in en-US and «Invia le risposte» in it-IT until change 4 renames the button |
| `status.answerSent` | Answer sent: {option}. | Risposta inviata: {option}. | §3.3.1; it-IT to review |
| `status.answerSentPlain` | Answer sent. | Risposta inviata. | §3.4; it-IT to review |
| `status.noteSent` | Note sent; the question is still to do. | Nota inviata; la domanda resta da fare. | §3.3.8; it-IT to review |
| `status.ready` | Answer ready, not sent. {count} ready. | one: Risposta pronta, non inviata. {count} pronta. other: Risposta pronta, non inviata. {count} pronte. | §3.3.2; it-IT to review |
| `status.submitted` | one: {count} answer sent. other: {count} answers sent. | one: {count} risposta inviata. other: {count} risposte inviate. | §3.3.2; it-IT to review |
| `status.prefilled` | one: {count} question prefilled. Nothing was sent. other: {count} questions prefilled. Nothing was sent. | one: {count} domanda precompilata. Niente è stato inviato. other: {count} domande precompilate. Niente è stato inviato. | §4, accepted, without "· Annulla" (the undo is change 4's) |
| `status.added` | one: The agent added {count} question: {title}. other: The agent added {count} questions. | one: L'agente ha aggiunto {count} domanda: {title}. other: L'agente ha aggiunto {count} domande. | §3.3.6, without "Go". The `other` form is new; it-IT to review |

`navigator.nextOpen` is removed (D6). `bar.immediateHelp` stays as it is: its §4 rewording names "Invia risposta", the label change 4 brings.

### D6. One next-open control: the header's (#184; PO decision)

The PO decided on 2026-11-15, through the coordinating session, that the jump stays in the header on every presentation. This is #184's option 1, the place direction B gives it. The navigator loses its jump button, the `onNextOpen` prop and the string `navigator.nextOpen`. The header already shows the count and the jump in one question per view (`board.tsx:424`), so the spec requirement "Counts and the next-open jump" gains only "in every presentation".

The design found no reason against the decision. The header is sticky and always in reach, and the navigator is not. One interim blemish remains: the header's downward arrow (today's "↓", or `icon-set`'s `arrow-down` icon once it lands) reads as "scroll down" in a presentation where the jump changes the question shown. Change 4's label ("Prossima da fare", with an icon and no glyph) removes it, so this change leaves the label alone.

### D7. The reason beside a blocked "Answer" (#185)

- A sibling of `answerHint`, `fieldToFixOf`, returns `{text, itemId}` from `fieldBlock`, and `answerHint` becomes its `text`. The text, its rule and `answerHint`'s many unit tests do not change.
- The actions row renders the reason as a `<button type="button">` styled `button-link`, muted, before "Answer" in the right-hand group. Its `id` stays "Answer"'s `aria-describedby` target. It shows only while "Answer" is disabled by a field on a usable card: never on a locked board or in an opened Snapshot.
- Activating it calls `focusField(card, itemId)`: the first focusable element inside `[data-askboard-item=itemId]` within the card. When that element sits in an inactive `[role=tabpanel]`, the helper first focuses the panel's tab (`aria-labelledby`). Radix Tabs' documented automatic activation (`activationMode`, default `"automatic"`, as the Tabs layout uses it) selects the tab, and on the next animation frame D2's `revealAndFocus` focuses the field.
- Nothing is announced: focus moves to the field, whose label and error speak for themselves (the review's rule: messages are for results that are not a move of focus).

*Alternatives.* A tooltip on the disabled button was rejected: engines give a disabled button neither hover nor focus. Plain text with a separate link would be two elements for one reason.

### D8. Keys

No key changes: no binding is added or changed, no key table is touched, and `keys-coverage.test.ts` is unaffected (no widget). The reason button and the region are reached with Tab as plain buttons and text. Change 5 adds the board keys through `KEY_VOCABULARY` and `KEY_TABLES_ON_BOARD`.

### D9. Records and versions

- **Documents.** Each group amends the sections of its own items, and the last group checks them together. EXPERIENCE.md:
  - Accessibility Floor: Focus moves after Answer, Submit and the reason; reveal clear of the bars; a new "Status messages" item.
  - Board chrome rows: Next-open jump, Outline navigator ("the question in view" defined), Question navigator, Bottom action bar.
  - The Presentations table's one-question-per-view row.
  - Voice and Tone: rows for D5's strings, with the "Count and jump" and "Question navigator" rows amended.
  - Open Items 22 narrowed to the announcements left to change 4.

  DESIGN.md: Context header (row 2: no move of the jump), Next-open jump, Question navigator (no jump), Bottom action bar (the submitted text, no longer provisional), Answer (the visible reason). No PRD or spine change.
- **As-built.** `docs/as-built/answering-flow-fixes.md`.
- **Versions.** No contract set, view-protocol message, draft-record field or dependency changes, so no number is bound (askboard-contract-versioning, Rule 1). `chunk-sizes.json` is recorded once, in the last group.

## Merge points

| With | Shared paths | Rule at the rebase |
|---|---|---|
| `early-benchmark` (in flight) | none: `packages/bench` only | none |
| `icon-set` (#188, branch `worktree-feature-icon-set`; its design.md, Merge points, holds the same rules) | `navigators.tsx` (its outline badges ↩ and ↻ become images named by `header.newReplies` and `header.agentUpdated`; the navigator's jump gets `IconNextOpenForward`, which our D6 removes); `board-header.tsx` (an `arrow-down` icon after the jump's text); `strings/en-US.ts`, `it-IT.ts` (`header.nextOpen` and `navigator.nextOpen` lose their glyph, and a strings test fails on ↓ ↩ ↻ ↗ ✓ ✕ × in any value), `keys.ts` (we add `status.*` and `bar.submittedHelp`, and delete `navigator.nextOpen`); browser files whose names lose the glyph (`lifecycle-presentations` :136, which our task 5.1 rewrites, `lifecycle-header` :79 and :90, `languages` :108, `shown-revision-draft-session` :114, `context-items` :281-282, `lifecycle-acts` :365) and `harness/suites.ts` (its `icons.browser.ts`, our four files); `chunk-sizes.json` (it adds an `icons` chunk); DESIGN.md (it adds an Icons section between Shapes and Components, settles Open Items 2 and adds a Do's row; it leaves the Bottom action bar and Question card rows alone). It edits no EXPERIENCE.md and only ADDs requirements | #184's button: if this change merges first, icon-set drops `IconNextOpenForward` at its rebase; if icon-set merges first, task 5.3 deletes the button with its icon import, the export in `packages/view/src/icons/index.ts`, its row in that module's unit-test table and its row in DESIGN.md's Icons table. Our tests name the jump without its glyph (`/^Next open/`, `/^Prossima aperta/`), so they hold either way. Strings, `suites.ts` and DESIGN.md: keep both sides' lines. `chunk-sizes.json`: re-run `bun run build:view --record-sizes` after resolving, never merge the numbers by hand |
| Change 4 `answering-flow-guidance`, change 5 `board-keys`, change 6 `answering-flow-visual` (not yet proposed) | they borrow `revealAndFocus`, `questionInView`, `useQuestionInView`, the status store, `StatusRegion` and the builders, `AnswerResult`, `onSubmitted` | Each borrows them only after this change merges (`git grep` on `origin/main`) |

Borrowed from `main` (task 0.2 checks each): `measureInset`, `insetFrom`, `requestHeading`, `HeadingRequest`, `questionTextId`, `focusedQuestion`, `data-askboard-question`, `data-askboard-item`, `setInView`, `nextOpenFrom`, `fieldBlock`, `answerHint`, `pressAnswer`, `answer`, `AnswerOutcome`, `settleConfirmation`, `selectRecommended`, `sendSubmit`, `Senders`, `applyDocumentUpdate`, `AgentPill`, `QuestionNavigator`, `Outline`, `BottomBar`, `STRING_KEYS`, `BROWSER_FILES`.

## Needs probe

None. The change makes no assumption about Claude Code's run-time behaviour. Radix Tabs' activation on focus is a documented library behaviour, and the browser test of D7 checks it in the three engines.

## Risks / Trade-offs

- [Focus held on a card while the user reads the next one] → the focus rule holds only while the focused card overlaps the band. Once it scrolls out, the reading line takes over.
- [A tall card: focusing its heading after an answer scrolls the receipt out of view] → this is the same as Postpone today, and the status message says "sent". Change 4's "Continue" footer is the remedy.
- [A screen reader drops a polite message during a burst] → messages raised together are read as one text. The browser tests read the region's text only, so a by-hand pass with VoiceOver and Orca goes to the PO as an Issue (task 6.4).
- [Interim words] → the downward arrow on "Next open" in one question per view, "prefilled" beside "Select recommended", and the en-US helper naming "Submit" all last until change 4's renames. Each is true, only not final.
- [Shell chunk growth] → estimated 3 to 6 KB, which leaves at least 16 KB of headroom for `icon-set` and change 4. Task 6.2 records the figures.

## Migration Plan

None: view-only behaviour. Drafts, records and contracts are unchanged, and a board that is open picks up the new view at its next load.

## Open Questions

- **Q1. "(to review)" on the Italian `bar.submittedHelp`.** #183 says the Italian stays "(to review)" until the native review. The report's decision 3 (1.1.0 §1, §4) says the PO accepted §4's Italian strings as they stand. Default: follow decision 3 and leave it unmarked. This changes only a marker in EXPERIENCE's Voice and Tone, so it can be settled at task 5.2, or later.
