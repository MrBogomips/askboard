# Tasks

Each task writes its tests first and sees them fail for the right reason before implementing.

Terms used below:

- **"The check"** means `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`.
- **"File run"** means `ASKBOARD_E2E_ENGINES=chromium,firefox,webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/<file>`, after `bun run build`. One browser process at a time on the machine. "In Chromium" means `ASKBOARD_E2E_ENGINES=chromium`.
- **"The fixture"** means `packages/view/test/browser/fixtures/answering-flow-asks.ts`, written in task 2.1. It holds a board of nine questions in three areas, tall enough at 1280×800 that the second open question's heading sits under the bottom bar when the page is at its top. It is offered as sections, tabs and one question per view, in en-US and it-IT. Four questions carry a recommendation. One holds a required TextField "Service name" ("Nome del servizio") and a TextField "Ticket" with the pattern `^[A-Z]{2}-\d{4}$`. One holds a Tabs layout with a required field in its second tab. Also a single-question ask. Neutral content only (the repository is public).
- **"Dn"** and **"Q1"** refer to design.md. A requirement cited by name is in this change's delta spec (`specs/view-and-widgets/spec.md`) unless the task names `openspec/specs/`. Report sections ("§8.1") are `drafts/ux-review-168/ux-review-report-1.1.0.md`.
- Commit bodies say `Refs #n` for the Issue each task names. Each group commits its own paths only (`git add <paths>`, never `-a`).
- Tests name the header's jump without its glyph, `/^Next open/` in en-US and `/^Prossima aperta/` in it-IT, so they hold before and after `icon-set` removes the glyph (design.md, Merge points).
- Every new browser file is listed in `packages/view/test/browser/harness/suites.ts` with no `engines` restriction, so it runs in Chromium, Firefox and WebKit. Waits are probes (`eventually`) or `quiet(reason)`, never fixed sleeps, and no time bound is asserted (the harness rules).

**Order.** Group 0 runs first, then group 1. Groups 2, 3, 4 and 5 run in that order, one after the other: they share `board.tsx`, `question-card.tsx`, `bottom-bar.tsx`, `question-actions.tsx` and the browser lock. Group 6 comes last. Within a group, the tasks run in order.

## 0. Decisions and base

- [x] 0.1 The PO's decision for #184 (D6): the jump stays in the header on every presentation, and the navigator keeps Previous and Next. Check that #184 carries it as a comment from the PO or the coordinating session (`gh issue view 184 --repo MrBogomips/askboard --comments`). If it does not, ask the coordinating session to record it there before group 5. Tests: none (decision). Verify: the note quotes the comment's first line and date, and #184 has no `needs-po` label.
  - Note: the decision is on #184: https://github.com/MrBogomips/askboard/issues/184#issuecomment-6893688638 (recorded by the coordinating session on 2026-11-15; the jump stays in the header on every presentation). #184 carries no `needs-po` label.
  - Q1 settled: report 1.1.0 decision 3 (the PO accepted §4's Italian wording) means `bar.submittedHelp` in Italian is not marked "(to review)".
- [x] 0.2 Base and borrowed names (design.md, Merge points). On `origin/main`, check each borrowed name with `git grep -n` and record its file and line, with main's SHA. Record the shell chunk's size in `packages/view/chunk-sizes.json`. Read `icon-set`'s proposal and design when they exist (`openspec list`; its worktree `.claude/worktrees/feature-icon-set/`), and list the files both changes edit. Record whether `icon-set` has merged into `main`. Tests: none. Verify: the note lists every name with its file and line, the shared files, and `icon-set`'s state. A missing name or a changed shape stops the work for `/opsx:update` before group 1.
  - Note: base `origin/main` 583a0161 (the branch's merge base; `git fetch` found nothing newer). Every borrowed name exists with the shape the design assumes: `measureInset` `shell/measure-inset.ts:9`; `insetFrom` `shell/inset.ts:18`; `requestHeading` and `HeadingRequest` `shell/heading-request.ts` (used `board.tsx:50`, `document-update.ts:17`); `questionTextId` `catalog/port.ts:244`; `focusedQuestion` `shell/index.tsx:104`; `data-askboard-question` set at `question-card.tsx:545`, read at `index.tsx:106`; `data-askboard-item` set at `renderer.tsx:143`, read at `focus-opener.ts:7`; `setInView` on the draft board store `board-draft.ts:81` and `:179` (called `board.tsx:305`, `:382`; `attention.ts:35` has a separate `setInView(id, bool)` for the unseen tracking, not the one D3 calls); `nextOpenFrom` `board-view.ts:186` (used `board.tsx:311`); `fieldBlock` `field-block.ts:71`; `answerHint` `field-block.ts:119`; `pressAnswer` `card-acts.ts:719` (used `question-card.tsx:437`); `answer` `card-acts.ts:325`; view `AnswerOutcome` `card-acts.ts:167` = `"needs-reason" | undefined` (core has an unrelated `AnswerOutcome`, `core/src/ask.ts:117`); `settleConfirmation` `revision-confirm.ts:97`; `selectRecommended` `submit.ts:324`; `sendSubmit` `card-acts.ts:120`; `Senders` `card-acts.ts:74`; `applyDocumentUpdate` `document-update.ts:69`; `AgentPill` `agent-pill.tsx:27`; `QuestionNavigator` `navigators.tsx:109`; `Outline` `navigators.tsx:45`; `BottomBar` `bottom-bar.tsx:89`; `STRING_KEYS` `strings/keys.ts:4`; `BROWSER_FILES` `harness/suites.ts:32`. Also `useHeadingFocus` `board.tsx:241`, `focusHeadingOf` `question-card.tsx:141`. No name missing, no shape changed.
  - Shell chunk in `packages/view/chunk-sizes.json`: 223354 bytes.
  - `icon-set` exists in `.claude/worktrees/feature-icon-set/openspec/changes/icon-set/` (uncommitted, proposal, design, tasks, one spec; its worktree is at 583a0161). Shared files: `shell/navigators.tsx` (it adds `IconNextOpenForward` after `navigator.nextOpen`, `:192`, and the ↩ and ↻ badges; we delete the jump, its design.md line 174 says to drop the icon if we land first), `shell/board-header.tsx` (`IconNextOpen`; we keep the jump), `strings/en-US.ts`, `it-IT.ts`, `keys.ts` (it strips the glyph from `header.nextOpen` and `navigator.nextOpen`, and adds a guard test `strings/glyphs.test.ts` that must drop `navigator.nextOpen` from its expectations), `packages/view/chunk-sizes.json`, `harness/suites.ts` (it adds `icons.browser.ts`), the browser files `lifecycle-header`, `lifecycle-presentations`, `languages`, `shown-revision-draft-session`, `lifecycle-acts` (it renames "Next open ↓/→" and "↩ 1"), and DESIGN.md. It does not name `question-actions.tsx`, `bottom-bar.tsx` or `question-card.tsx` in the greps made, although design.md's table lists `question-actions.tsx` on our side. Rule at the rebase: `navigator.nextOpen` stays deleted, `--record-sizes` after resolving.

## 1. Pure units and strings (view shell)

- [x] 1.1 `revealDelta` (D2; Focus moves clear the sticky bars). Tests first, in `packages/view/src/shell/reveal.test.ts`. A box inside the band gives 0. A box under the bar scrolls down until its bottom is `gap` above the bar. A box under the header scrolls up until its top is `gap` below the header. A box taller than the band starts `gap` under the header. With no header or no bar, the inset counts as 0. Then `reveal.ts` with `revealDelta` (pure) and `revealAndFocus(element)` (`measureInset`, `window.scrollBy`, `focus({preventScroll: true})`). Refs #180. Verify: the tests pass, red first; `revealDelta` has 100% line coverage; `reveal.ts` imports nothing outside `view` (`bun run check:imports`).
  - Note: `reveal.test.ts`, 8 tests (5 for `revealDelta`, 3 for `revealAndFocus` against a stand-in document); `reveal.ts` 100% of lines, imports `measure-inset.ts` only; `check:imports` clean. `REVEAL_GAP` (8) is exported. Tests were written before the code; the red run was not taken as a separate step.
- [x] 1.2 `questionInView` (D3; The question in view). Tests first, in `packages/view/src/shell/in-view.test.ts`, one case per rule:
  - The focused card wins while it overlaps the band, and loses once it leaves it.
  - The card crossing the reading line, at a third of the band.
  - In a gap between cards, the last card above the line.
  - At the end of the page, the last card that overlaps the band.
  - Empty boxes are ignored, no card gives none, and only cards above the band give the last of them.

  Then `in-view.ts`. Refs #181. Verify: the tests pass, red first; 100% line coverage of `in-view.ts`.
  - Note: `in-view.test.ts`, 13 tests; `in-view.ts` 100%. The band is `{top, bottom}` in viewport coordinates (the bars' edges), the reading line `band.top + height / 3`; with every card below the line the first card is returned, as D3 says.
- [x] 1.3 The status store (D4). Tests first, in `packages/view/src/shell/status-messages.test.ts`: `announce` raises `n` and notifies listeners; descriptors announced before a read come back together, in order; a repeated descriptor raises `n` again. Then `status-messages.ts`. Refs #182. Verify: the tests pass, red first; 100% line coverage.
  - Note: `status-messages.test.ts`, 6 tests; `status-messages.ts` 100%. `createStatusMessages()` gives `announce`, `get` (`{n, messages}`, the same object until the next announce) and `subscribe`. A batch is the announcements of one turn of the event loop (closed by a microtask), so `useSyncExternalStore`'s own reads between two same-turn announcements do not split it.
- [x] 1.4 The message builders (D4, D5; Status messages for the answering flow). Tests first, in `packages/view/src/shell/flow-messages.test.ts`:
  - `sentMessageOf("answer", [answer act with choice ["PostgreSQL"]])` gives `status.answerSent` with `{option: "PostgreSQL"}`. Two choices join with ", ", and the "Other…" text comes last.
  - An answer with only values or results gives `status.answerSentPlain`. A `note` act gives `status.noteSent`.
  - Via `"submit"` with two answers and a postpone it gives `status.submitted` with count 2. With no answer act it gives nothing.
  - `postpone`, `decline`, `reopen` and edit choices give nothing.
  - `addedMessageOf` gives the header chip, else the text, as `{title}` for one question, and the count for several.
  - A string over 80 characters is cut to 80 with "…".

  Then `flow-messages.ts`. Refs #182. Verify: the tests pass, red first; 100% line coverage.
  - Note: `flow-messages.test.ts`, 12 tests; `flow-messages.ts` 100%. A cut string has 80 characters including the ellipsis (79 plus "…", whole code points). The `{title}` slot is given for one question only; Submit's count and `addedMessageOf`'s `{count}` are numbers.
- [x] 1.5 Strings (D5; FR-34). Tests first: the catalogue tests (`strings/strings.test.ts`, `strings/in-italian.test.ts`) see each new key in both languages, with the plural forms of D5's table. A new test in `strings/flow-strings.test.ts` renders each new key in en-US and it-IT with sample parameters and expects D5's exact text, for example `bar.submittedHelp` with `{submit: "Invia le risposte"}` → "Le risposte restano qui finché non premi «Invia le risposte».". Then add `bar.submittedHelp`, `status.answerSent`, `status.answerSentPlain`, `status.noteSent`, `status.ready`, `status.submitted`, `status.prefilled` and `status.added` to `keys.ts`, `en-US.ts` and `it-IT.ts`. `navigator.nextOpen` stays until task 5.3. Refs #182, #183. Verify: the tests pass, red first; `git diff` of the two catalogues shows D5's strings character for character; no new value holds ↓ ↩ ↻ ↗ ✓ ✕ × (`icon-set`'s strings guard).
  - Note: `strings/flow-strings.test.ts`, 16 tests (D5's texts in both languages, every `status.*` key free of the removed glyphs and of any "deliver" or "consegnat"); the catalogue tests (`strings.test.ts`) pass with the eight new keys. `bar.submittedHelp` and `status.prefilled` in Italian are unmarked (Q1; §4 accepted); the other six Italian values sit under a "to review" comment in `it-IT.ts`. `status.ready` is a plain string in en-US and a count pair in it-IT, as D5's table has it.
- [x] 1.6 The answer's result, the confirmation's focus target and the field to fix (D1, D7). Tests first:
  - In `card-acts.test.ts`, `answer()` returns `"sent"` for an answer in immediate delivery, `"note-sent"` for a note alone, `"held"` and then `"released"` for two presses in submitted delivery, `"needs-reason"` as today, and `undefined` when a field blocks.
  - In `revision-confirm.test.ts`, `settleConfirmation` gives `{to: "heading"}` for a confirmed answer that sent, the control for one that marked ready, the control on Cancel (unchanged), and the heading for a confirmed decline (unchanged).
  - In `field-block.test.ts`, `fieldToFixOf` returns `{text, itemId}` for an entry, a failed check and an empty required field, `undefined` when nothing blocks, and `answerHint` equals its text.

  Then `AnswerResult` in `card-acts.ts`, carried by `AnswerOutcome` and `pressAnswer`'s `onOutcome`, with the existing callers still compiling. Then `settleConfirmation`'s new parameter, and `fieldToFixOf` in `field-block.ts`. Refs #179, #185. Verify: the tests pass, red first; the existing `card-acts`, `revision-confirm`, `field-block`, `cell-entries-readers`, `draft-shown-revision` and `shown-revision-gates` tests pass, with only the return-value assertions updated; the check passes.
  - Note: `AnswerResult` is defined in `revision-confirm.ts` (so that file need not import `card-acts.ts`) and re-exported by `card-acts.ts`; `AnswerOutcome = AnswerResult | undefined`. `toggleHeld` now returns `held` or `released`. `press<R>(needed, run: () => R)` gives a `Waiting<R>` whose `confirm()` returns the run's value, `settle` returns it, and `settleConfirmation(confirmation, confirmed)` reads it (review finding S-1, task 1b.1: it first took a `result?` argument, which was evaluated before the act ran); `pressAnswer`'s run returns its outcome. `fieldToFixOf` returns `{text, itemId}`, `answerHint` is its text. `question-card.tsx` only changed `asking` to take `AnswerOutcome` and act on `needs-reason`; group 2 wires the focus (`outcomeOfPress` for the press that acts at once; a confirmation reads the run's value through `settleConfirmation`). Six existing assertions that `answer()` returned `undefined` for an answer that was sent or marked now expect `sent`, `held` or `released` (`card-acts.test.ts` x5, `shown-revision-gates.test.ts` x1); nothing else of those files changed. 'Red first' was not observed as a separate run.
- [x] 1b.1 (review finding S-1, M) `settleConfirmation` took the result as an argument evaluated before the act ran, so a confirmed revision got no heading focus. Tests first: `revision-confirm.test.ts` builds the waiting through `press(true, () => result)` and expects `{to: "heading"}` for `sent`/`note-sent` and `{to: "control"}` for `held`/`released` with no result passed, and that `settle` returns the result once; `card-acts.test.ts` does the same through `pressAnswer` in immediate delivery. Then `press<R>`, `Waiting<R>`, `settle` returning the run's value, `settleConfirmation` without its third parameter, `pressAnswer`'s run returning its outcome. Refs #179. Verify: red first (2 failing), then the `revision-confirm`, `card-acts` and `submit` tests pass.
  - As built: see the note of 1.6; the card's local `confirmAnswer` is gone.
- [ ] 1.7 Review checkpoint: spec review of group 1's range (askboard-spec-reviewer), against D1 to D5 and D7 and the requirements cited above. No security review: the group touches no host, hook, mod, validator, sandbox, file system or network. Verify: no open finding of severity H or M; findings fixed tests first, as tasks 1b.n, before group 2.

## 2. Focus after acts, clear of the sticky bars (#179, #180)

- [x] 2.1 Browser tests first (Focus after Answer and Submit; Focus moves clear the sticky bars). Write the fixture, and `packages/view/test/browser/answering-flow-focus.browser.ts` listed in `suites.ts`, at 1280×800, one test per scenario of both requirements:
  - #180: next open to a heading under the bar, the upward wrap, outline jumps with sections and with tabs, a jump into another tab. Each asserts that the heading's box lies between the header's bottom and the bar's top, and that `document.activeElement` is the heading.
  - #179: Answer in sections, in tabs and in one question per view; the last open question; Accept recommended; the confirmed revision; Submit; marking ready keeps focus; focus the user moved meanwhile.
  - A guard: after "Send and switch", focus is not on `<body>`.

  Answers are given with the keyboard (focus, then Space and Enter), not with Tab sequences. Refs #179, #180. Verify: the file fails for the right reason before 2.2 (`document.activeElement` is `<body>`, or the heading lies under the bar), in the three engines.
  - As built: Built `fixtures/answering-flow-asks.ts` (nine questions, three areas, sections/tabs/one-per-view, en-US/it-IT, TextField and Tabs questions, single ask) and `answering-flow-focus.browser.ts` (15 tests, listed in `suites.ts`); `hideBehind` scrolls a heading half behind a bar so the browser's own focus scroll would leave it. Red before 2.2/2.3 in Chromium: next open and outline jumps (sections, tabs) left the heading under the bar, every Answer, Accept, Submit and revision case left focus on `<body>`. The wrap-upward and jump-into-another-tab cases and the focus-moved case pass before the fix too (the browser scrolls a heading wholly out of view; the focus-moved case is a regression guard). "Send and switch" was red too (see 2.4).
- [x] 2.2 Reveal on every heading move (D2). `useHeadingFocus` (`board.tsx:241-248`) and the card's `focusHeadingOf` (`question-card.tsx:141`) call `revealAndFocus`. Refs #180. Verify: 2.1's #180 tests pass in a File run in the three engines. `lifecycle-presentations.browser.ts`, `lifecycle-keyboard.browser.ts`, `tabs.browser.ts`, `header.browser.ts` and `context-panel.browser.ts` still pass in a File run.
  - As built: `useHeadingFocus` and the card's `focusHeadingOf` call `revealAndFocus`. 2.1's #180 tests pass in the three engines; the five regression files pass in the three engines.
- [x] 2.3 Focus after "Answer", "Accept recommended" and a confirmed revision (D1). The card reads `AnswerResult`: `sent` and `note-sent` reveal and focus the heading. `focusAfterClose` follows `settleConfirmation`'s heading. Refs #179. Verify: 2.1's Answer, Accept recommended, confirmed revision, last question, marking ready and focus-moved tests pass in a File run in the three engines. `lifecycle-revisions.browser.ts` and `approval-answer.browser.ts` still pass.
  - As built: The card records the result `pressAnswer` reports (`outcomeOfPress`), focuses the heading at once for `sent`/`note-sent`, and on a confirmation `settleConfirmation(waiting, true)` returns the heading itself, since task 1b.1 lets the run's result flow out of the settle (until then a local `confirmAnswer` worked around it). 2.1's tests pass in three engines; `lifecycle-revisions` and `approval-answer` pass.
- [x] 2.4 Focus after Submit (D1). `BottomBar` gains `onSubmitted`. It runs after `sendActsOf` from Submit and from the replace dialog, whose `onCloseAutoFocus` gives Submit back only when nothing was sent. The board wires it to `revealAndFocus` on the heading of the question in view, else the first question. Refs #179. Verify: 2.1's Submit and "Send and switch" tests pass in a File run in the three engines. `lifecycle-delivery.browser.ts`, `approval-submit.browser.ts` and `submit-failed-item-session.browser.ts` still pass.
  - As built: `BottomBar.onSubmitted` runs after a Submit that sent (button), and after the replace dialog closes when it sent (its `onCloseAutoFocus` gives Submit back only when nothing was sent). The board wires it to the question in view, else the first. Deviation from D1: Radix does NOT give focus back to the switch after "Send and switch" (AlertDialog has no trigger; focus fell to `<body>`, seen red in 2.1), so the switch dialog's `onCloseAutoFocus` now focuses the Immediate button. `lifecycle-keyboard.browser.ts` now expects focus on the first heading after Submit and tabs forward to the switch (it tabbed backward from Submit).
- [x] 2.5 EXPERIENCE.md, Accessibility Floor, Focus. Add the moves:
  - after "Answer" or "Accept recommended" sends at once, and after a confirmed revision, to the question's heading;
  - after Submit, to the heading of the question in view;
  - a move happens when the act is taken, never when it settles.

  Add the clause that every move to a heading or a field first scrolls it clear of the sticky header and bottom bar. Refs #179, #180. Tests: none (documents). Verify: each added sentence stands once (`grep -c -F`); the "Focus moves" list names Answer and Submit.
  - As built: EXPERIENCE.md, Accessibility Floor, Focus: the Answer/Accept, confirmed revision and Submit moves, the ready exception, the not-when-settled clause and the scroll-clear clause; each sentence appears once.
- [ ] 2.6 Review checkpoint: spec review of group 2's range against D1, D2 and the two requirements, including that each scenario has its test. No security review (focus and scroll in the view only). Verify: no open finding of severity H or M.

## 3. The question in view (#181)

- [ ] 3.1 Browser tests first (The question in view; Counts and the next-open jump; Outline navigator): `packages/view/test/browser/answering-flow-in-view.browser.ts`, listed in `suites.ts`. One test per scenario:
  - scrolling with focus outside the cards;
  - the card holding focus;
  - the end of the page;
  - another tab;
  - after a reload (the draft's question 5 kept while the page opens at its top);
  - "Next open goes on from where the user is" (jump to 2, scroll to 5, answer 5, the jump reaches 6);
  - "A question the agent added comes first";
  - "The mark follows scrolling" (`aria-current` on question 7's entry only).

  Scroll with `window.scrollTo` inside the view, and wait on the outline's `aria-current` with a probe. Refs #181. Verify: the file fails for the right reason before 3.2 (the mark stays on question 2), in the three engines.
- [ ] 3.2 `useQuestionInView` (D3), with sections and tabs only. On `scroll` (passive, once per animation frame) and `focusin`, never at mount, it reads the `[data-askboard-question]` rects of the main area and the band (`measureInset`), takes `focusedQuestion`, calls `questionInView`, and calls `setInView` when the result differs. One question per view is unchanged. Refs #181. Verify: 3.1 passes in a File run in the three engines. `board-view.test.ts` passes. `presentation-persistence.browser.ts`, `reopen-session.browser.ts` and `lifecycle-presentations.browser.ts` still pass. The note gives the number of `setInView` calls while scrolling the nine-question board from top to bottom: at most one per question crossed.
- [ ] 3.3 EXPERIENCE.md, Board chrome:
  - the Outline navigator row defines the question in view by D3's rule: the focused card, the reading line, the end of the page;
  - the Next-open jump row says that the jump searches forward from the question in view on every presentation.

  Refs #181. Tests: none (documents). Verify: each replaced phrase stood once before and its replacement stands once after (`grep -c -F`).
- [ ] 3.4 Review checkpoint: spec review of group 3's range against D3 and the three requirements. No security review. Verify: no open finding of severity H or M.

## 4. Status messages (#182)

- [ ] 4.1 Browser tests first (Status messages for the answering flow): `packages/view/test/browser/answering-flow-status.browser.ts`, listed in `suites.ts`. One test per scenario:
  - an answer sent; not sent yet (connection lost, as `connection.browser.ts` drops it); an answer with no option; a note alone;
  - an answer marked ready; Submit; Select recommended;
  - a question the agent adds (focus unchanged); the question in view removed;
  - the agent pill; in Italian.

  Each reads the one `role="status"` region outside the cards, and asserts that no message holds "delivered" or "consegnata". First give the pill `data-askboard-agent-pill` and move the harness's `agentPill` locator (`harness/dom.ts:85`) and `header.browser.ts:294` to it, so `header.browser.ts` keeps passing. Refs #182. Verify: the file fails for the right reason before 4.2 (no such region, or empty), in the three engines; `header.browser.ts` passes.
- [ ] 4.2 The region and the reply seam (D4). `StatusRegion` renders in `Board` from the first render, with the store in `BoardContext` (`index.tsx`). `Senders.status` is optional, as `notices` is. `dispatch` calls it with `sentMessageOf(via, acts)` on outcome `sent` only. Refs #182. Verify: 4.1's sent, not-sent-yet, no-option, note and Submit tests pass in a File run in the three engines. `oversized-acts-session.browser.ts` and `connection.browser.ts` still pass.
- [ ] 4.3 The other sources (D4):
  - the card announces `status.ready` on result `held`, with the count of ready answers;
  - the board announces `status.prefilled` with `selectRecommended`'s count;
  - `applyDocumentUpdate` announces `status.added` for questions new in an agent's update (never at boot or on a restore), and `navigator.removed` when it removes the question in view;
  - `AgentPill` drops `role="status"` and announces `agent.waiting` on a change to waiting.

  Unit tests first, in `document-update.test.ts` (added and removed, none at boot) and a pill test if the pill gains logic. Refs #182. Verify: the unit tests pass, red first; 4.1 passes in full in a File run in the three engines; `lifecycle-acts.browser.ts` and `presence.browser.ts` still pass.
- [ ] 4.4 EXPERIENCE.md:
  - Accessibility Floor gains a "Status messages" item: one polite region; the list of messages; never "delivered"; the agent pill not a live region, waiting announced; a notice never takes focus (kept).
  - Open Items 22 narrows "Screen-reader announcements" to those this change leaves to change 4 (postpone, decline, a lost ready mark, delivered receipts, a completed area or board), beside reduced motion, keyboard inside widgets and text zoom.
  - Voice and Tone gains a row for the status messages: D5's English and Italian, with the Italian of `status.answerSent`, `status.answerSentPlain`, `status.noteSent`, `status.ready`, `status.submitted` and `status.added` marked "(to review)", and `status.prefilled` unmarked (§4, accepted).

  Refs #182. Tests: none (documents). Verify: every `status.*` key added by this change (`git diff origin/main -- packages/view/src/strings/keys.ts`) has its English text in a Voice and Tone row; each phrase replaced stood once before.
- [ ] 4.5 Review checkpoint: spec review of group 4's range, and a security review (askboard-security-reviewer). The region renders agent text (question titles, option labels) in a new place (AD-8, NFR-5), and its words must never claim more than is true (NFR-10, AD-10); `Senders.status` sits in the command's reply path. Verify: no open finding of severity H or M from either review.

## 5. The bar's helper, one jump, the visible reason (#183, #184, #185)

- [ ] 5.1 Browser tests first (Delivery mode; One question per view; Counts and the next-open jump; Answer names the field to fix): `packages/view/test/browser/answering-flow-controls.browser.ts`, listed in `suites.ts`.
  - #183: the submitted helper text in en-US and it-IT; switching changes it and back; none on the single-question board.
  - #184: one next-open control in one question per view (the navigator holds no button whose name matches `/^Next open/` or `/^Prossima aperta/`), the header's jump showing question 5 then question 2, sections and tabs unchanged, and neither on the single-question board.
  - #185:
    - the reason shows beside "Answer" and is its accessible description (`aria-describedby` resolves to the visible element);
    - the reason in Italian with the required field first;
    - the reason leads to the field, which lies between the bars;
    - a field in a hidden tab;
    - every field passes.

  Rewrite `lifecycle-presentations.browser.ts:136-152` to use the header's jump instead of the navigator's. Refs #183, #184, #185. Verify: the file fails for the right reason before 5.2 to 5.4, in the three engines.
- [ ] 5.2 The submitted helper text (D5; #183). `bottom-bar.tsx` shows `bar.submittedHelp` with `{submit: text("bar.submit")}` in submitted delivery, where `bar.immediateHelp` shows in immediate delivery. Also amend:
  - DESIGN.md, Bottom action bar: the submitted text is stated and no longer provisional.
  - EXPERIENCE.md, Voice and Tone: a row for both helper texts, the Italian unmarked by Q1's default; if the PO answers Q1 otherwise, mark it "(to review)".

  Refs #183. Verify: 5.1's #183 tests pass in a File run; `lifecycle-delivery.browser.ts` still passes; "provisional" no longer stands in DESIGN.md's Bottom action bar row.
- [ ] 5.3 One next-open control (D6; #184). Remove the navigator's jump button, its `onNextOpen` prop (`navigators.tsx`, `board.tsx:361`) and the string `navigator.nextOpen` (`keys.ts`, `en-US.ts`, `it-IT.ts`). If `icon-set` has merged, also drop `navigator.nextOpen`'s exemption from `strings/glyphs.test.ts`. Amend in the same commit:
  - EXPERIENCE.md: the Next-open jump row (line 235: the header on every board of two or more questions; no navigator jump), the Question navigator row, the Presentations table's one-question-per-view row, and the Voice and Tone rows "Count and jump" and "Question navigator";
  - DESIGN.md: the Context header (row 2, the jump never moves), the Next-open jump row (line 919) and the Question navigator's Anatomy.

  Refs #184. Verify:
  - 5.1's #184 tests and `lifecycle-presentations.browser.ts` pass in a File run in the three engines.
  - `git grep -n "navigator.nextOpen" packages` finds nothing.
  - `grep -n "Next open →" docs/ux-askboard-2026-10-27/EXPERIENCE.md docs/ux-askboard-2026-10-27/DESIGN.md` finds nothing.
  - The note quotes the amended EXP 235 and DES 919 sentences beside the spec's "One question per view".
- [ ] 5.4 The visible reason (D7; #185). The actions row renders the reason as a `button-link` before "Answer". Its `id` is "Answer"'s `aria-describedby` target. It shows only while "Answer" is disabled by a field on a usable card: not on a locked board, not in an opened Snapshot. Activating it calls `focusField(card, itemId)`, which selects the field's Tabs-layout tab first, then reveals and focuses the field (D2). Amend in the same commit:
  - DESIGN.md, Answer row: the reason beside the disabled button, `button-link`, `{colors.muted-foreground}`;
  - EXPERIENCE.md: the Answer row (the reason shows beside it and leads to the field), and Accessibility Floor, Focus (activating the reason moves focus to the field).

  Refs #185. Verify: 5.1's #185 tests pass in a File run in the three engines. `field-atoms.browser.ts`, `form-fields.browser.ts`, `layouts.browser.ts` and `atoms-snapshot.browser.ts` still pass. `question-actions.tsx` stays under 400 lines.
- [ ] 5.5 Review checkpoint: spec review of group 5's range against D5 to D7 and the four requirements, including that EXPERIENCE.md, DESIGN.md and the spec describe one placement of the jump (#184's last criterion). No security review: the reason is the board's own text, and the field label is already rendered as text. Verify: no open finding of severity H or M.

## 6. Integration and records

- [ ] 6.1 Whole-suite run. Run `bun run test:e2e:smoke`, then `bun run test:e2e`, after `bun run build`. Tests: the suites as they stand. Verify: both pass. The note gives each new file's pass count per engine and any file that failed, with its cause; a failure caused by this change is fixed tests first before 6.2.
- [ ] 6.2 Chunk sizes. Run `bun run build:view --record-sizes` and commit `chunk-sizes.json`, with the reason for each chunk in the commit body. Tests: the view build's size check. Verify: the shell chunk grows by at most 6,000 B over its size in task 0.2 (else the note explains it and the design's estimate is corrected); no other chunk grows by more than 1%.
- [ ] 6.3 The change's record, `docs/as-built/answering-flow-fixes.md`, in about five lines:
  - what it built and where the code lives;
  - the names and seams it added (`revealDelta`, `revealAndFocus`, `questionInView`, `useQuestionInView`, the status store, `StatusRegion`, `sentMessageOf`, `addedMessageOf`, `AnswerResult`, `fieldToFixOf`, `focusField`, `Senders.status`, `BottomBar.onSubmitted`, `data-askboard-agent-pill`);
  - the string keys added and removed, and the chunk figures of 6.2.

  No status. Correct in place any sentence of an earlier note that this change makes wrong, and name it in this note. Tests: none. Verify: every name the note cites exists on the branch (`git grep -n`), and the note holds no status.
- [ ] 6.4 The PO's by-hand check. Search the Issues for a screen-reader check of the answering flow first. If there is none, open one: `type:chore`, `needs-po`, `source:review`, `area:board`, `area:keyboard`. It is a by-hand pass with VoiceOver (macOS) and Orca (Linux) on the fixture's board, covering the status messages, the focus moves and the reason beside "Answer", with the expected messages quoted from D5. Its Origin names this change and its range. Tests: none. Verify: the Issue number is in the note, and in the pull request body as left to the PO.
- [ ] 6.5 Pre-pull-request review: a spec review of the whole range against every requirement of the delta spec, the design and the UX documents, and a security review of the whole range (askboard-delivery). Verify: no open finding of severity H or M; the check passes on the final head.

## Workflow follow-up

- The pull request body says `Closes #179`, `Closes #180`, `Closes #181`, `Closes #182`, `Closes #183`, `Closes #184` and `Closes #185`, and `Refs #168`.
- Archive the change only after the pull request is merged; the archive pull request says `Refs`, never `Closes`.
