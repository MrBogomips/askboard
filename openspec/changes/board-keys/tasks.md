# Tasks

Each task writes its tests first and sees them fail for the right reason before implementing.

Terms used below:

- **"The check"** means `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`.
- **"File run"** means `ASKBOARD_E2E_ENGINES=chromium,firefox,webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/<file>`, after `bun run build`. One browser process at a time on the machine.
- **"The fixture"** means `packages/view/test/browser/fixtures/answering-flow-asks.ts` (from `answering-flow-fixes`): nine questions in three areas as sections, tabs and one question per view, a required field and a pattern field `^[A-Z]{2}-\d{4}$`, four recommendations, and a single-question ask. Tasks that need a Ranking, a Tree or a multiple choice add asks to a fixture module of this change, `fixtures/board-keys-asks.ts`, with neutral content only (the repository is public).
- **"Dn"** refers to design.md. A requirement cited by name is in this change's delta specs (`specs/<capability>/spec.md`).
- The board's table is `BOARD_KEYS` (D1). "In effect" means with the user's overrides applied (D6). Tests name actions by ID (`board.nextOpen`), the header's jump by `/^Next open/` and `/^Prossima aperta/` (before change 4) or by `HeaderCounts`' button, and a question's primary button by `[data-askboard-primary]` inside its card, never by the name "Answer", so they hold before and after `icon-set`'s and change 4's renames.
- Commit bodies say `Refs #187`. Each group commits its own paths only (`git add <paths>`, never `-a`).
- Every new browser file is listed in `packages/view/test/browser/harness/suites.ts` with no `engines` restriction, so it runs in Chromium, Firefox and WebKit. Waits are probes (`eventually`) or `quiet(reason)`, never fixed sleeps, and no time bound is asserted. `Mod` is `Meta` on macOS and `Control` elsewhere: read it from the harness's platform, never hard-code one.

**Order and parallelism.** Group 0 first, then group 1 (contract), then group 2 (the view's pure parts and strings). Groups 3 and 4 then run one after the other: both add a file to `harness/suites.ts`, and both need the browser lock. Group 5 (the help skill) touches only `tools/build/skills/` and `skills/askboard-help/`. It may run beside group 3 or 4 once group 2 is done, since it reads group 2's strings, provided each run commits only its own paths and the two never run the check at the same time. Group 6 is last.

**Effort.** Group 1 high (contract). Groups 2 to 5 medium. Group 6 medium, high for a rebase with conflicts.

## 0. Decisions and base

- [x] 0.1 PO decision 6 (2026-11-14, report 1.1.0 §1) and Issue #187: `N` / `Shift+N` next and previous open question, `Mod+Enter` on the question outside text fields and widgets, no key for sending all held answers. Read `gh issue view 187 --repo MrBogomips/askboard --comments` for any later PO comment that changes this. Check every name design.md borrows (Merge points) with `git grep -n`: on `origin/main` for the names on `main`, and on the base head 9eb5f364 for `answering-flow-fixes`' names until #212 merges. Record each with its file and line. Record main's SHA, whether #212 and #210 have merged, and that this change widens no contract set (D9). Tests: none (decision and base). Verify: the note quotes the Issue's latest PO comment or says there is none, lists every borrowed name with file and line, and states the merge state. A missing name, a changed shape or a newer PO decision stops the work for `/opsx:update` before group 1. Done 2026-11-15. Issue #187's only comment is the change notice (no PO comment after decision 6), so decision 6 stands. `origin/main` is 583a0161; #212 (9eb5f364) and #210 (icon-set, 272d5e5f) are both open, not merged. Every borrowed name exists with the design's shape: on `origin/main`, `KEY_VOCABULARY` `keys/vocabulary.ts:106`, `keyBinding` `:86`, `vocabularyEntry` `:160`, `ownEntry` `:187`, `keyTableProblems` `keys/check.ts:299`, `reservedProblem` `:59`, `keyOverridesProblems` `keys/overrides.ts:286`, `keyExitActions` `:115`, `KEYS_OPEN_RESERVED_KEYS` `:48`, `changedKeyActions` `keys/effective.ts:87`, `effectiveKeys` `:41`, `REGISTERED_KEY_TABLES` `keys/tables.ts:28`, `keyActionOf` `keys/match.ts:62`, `pressHold` `:35`, `useKeyTable` and `KeyOverridesContext` and `useKeysOpenEntry` `view/src/catalog/keys/key-table.tsx:25,13,36`, `BoardKeys` `shell/board-keys.tsx:30`, `KeyHint` `catalog/keys/key-help.tsx:34`, `hintOf` `hint.ts:42`, `groupOf` `:79`, `panelGroups` `:117`, `PANEL_GROUPS` `:65`, `KeysPanelBody` `shell/keys-panel.tsx:19`, `openFrom` `shell/keys-frame-actions.ts:35`, `controlOf` `:45`, `stopKey` `:72`, `noteClose` `:75`, `restoreFocus` `:84`, `keyPressOf` `catalog/keys/press.ts:62`, `isTextTarget` `:38`, `checkboxKeyOf` `catalog/fields/roving.ts:70`, `optionMoveOf` `:61`, `nextOpenFrom` `shell/board-view.ts:186`, `isSendKey` `shell/thread-text.ts:56`, `pressAnswer` `shell/card-acts.ts:719`, `cardState` `shell/question-state.ts:182`, `HeaderCounts` `shell/board-header.tsx:22`, `QuestionCard` `shell/question-card.tsx:358`, `generateHelpSkill` `tools/build/skills/help.ts:123`, `keyActionsText` `help-keys.ts:210`, `configureKeysText` `:164`, `HELP_BUDGETS` `budgets.ts:21`, `STRING_KEYS` `strings/keys.ts:4`, `BROWSER_FILES` `test/browser/harness/suites.ts:32`, `data-askboard-question` and `data-askboard-item` `shell/index.tsx:106`, `focus-opener.ts:7`. On 9eb5f364: `revealAndFocus` `shell/reveal.ts:36`, `useQuestionInView` `use-question-in-view.ts:41`, `focusedQuestion` `:13`, `StatusMessages` and `announce` `shell/status-messages.ts:18,19`, `StatusRegion` `status-region.tsx:11`, `FieldToFix` `field-block.ts:115`, `fieldToFixOf` `:123`, `AnswerResult` `revision-confirm.ts:98`, `HeaderCounts.onNextOpen` `board-header.tsx:26`, `BoardContext.status` `board.tsx:82` and `:8` of its body, `status.ready` `strings/en-US.ts:581`. One small difference, no change of shape: `AnswerOutcome` is `card-acts.ts:179` (design says `revision-confirm.ts`). No file under `packages/contract` changes in this change so far; no set is widened (D9).
- [x] 0.2 Probe the three browser behaviours of design.md, Needs probe, in a scratch browser file that is not committed, in Chromium, Firefox and WebKit, on the built board with the fixture. (a) `N` pressed after the board page loads, before any click in the frame, reaches no `keydown` listener on the view's document. (b) On a focused `<button>` whose `keydown` listener prevents the default, `Control+Enter` (Linux) or `Meta+Enter` (macOS) fires no `click`. (c) On a question's Radix Checkbox, Enter's `keydown` reaches the card's `<section>` with `defaultPrevented` true. Tests: the scratch file itself, deleted after the run. Verify: the note records each result per engine. A result that differs from the design stops the work for `/opsx:update` before group 3. Done 2026-11-15, scratch file `probe-board-keys.browser.ts` run on the built board (`dist/`, session process, macOS host, Playwright 1.65) in all three engines, then deleted. Same result in Chromium, Firefox and WebKit. (a) `n` and `Shift+N` pressed after load, before any click: the view's document saw no `keydown` (`[]`); after a click on the view's blank space, `n` reached it (`["n"]`). (b) A focused `<button>` whose `keydown` prevents Enter's default: `Control+Enter` and `Meta+Enter` each produced 0 clicks. (c) On a multi-select question's checkbox, Enter's `keydown` had `defaultPrevented` true once React's handlers had run (measured by a document listener, since a native listener on the `<section>` runs before React's root handler and saw false; the card's React `onKeyDown` runs after the checkbox's, as D4 says). Also seen: `Control+Enter` and `Meta+Enter` on a box today still flip it (checked toggled each time), the defect D4's `checkboxKeyOf` change fixes. No design assumption contradicted.

## 1. Contract: the board's key table and the override check

- [x] 1.1 Tests first, the table (D1; The board's key table). In a new `packages/contract/test/keys-board-table.test.ts`:
  - `keyTableProblems(BOARD_KEY_TYPE, BOARD_KEYS)` is empty.
  - Each entry has the action, part, keys, `shows`, `readOnly` and label of D1's table.
  - `ALL_KEY_TABLES` is the board's table, then exactly `REGISTERED_KEY_TABLES` in order, frozen.
  - A table binding `Mod+Enter` passes the check, one binding `Mod+w` reports a problem naming the type and the key, and `Mod+Shift+Enter` still passes.
  - No registered widget type is named `board`, and a probe registry holding one makes the test's helper name it.

  Any case of `keys-check.test.ts` or `keys-overrides.test.ts` that pins `mod` to Z and A alone now admits Enter too. Verify: the new tests fail before 1.3 and pass after it. Done 2026-11-15. New `keys-board-table.test.ts` (8 tests): table check empty, each D1 row, `BOARD_KEY_TABLE`, `ALL_KEY_TABLES` order and frozen, `Mod+Enter` passes, `Mod+w` names type and key, `Mod+Shift+Enter` passes, no widget type named `board` with a probe-registry helper. `keys-check.test.ts`: the `mod` case now admits Enter. Failed first (missing exports), pass now.
- [x] 1.2 Tests first, the override check (D6; Board keys a native control takes; The override check's default tables). In `keys-overrides.test.ts` and `keys-effective.test.ts`, with no tables given:
  - `{"board.nextOpen": ["Enter"]}` gives a `reserved` problem; so does `Space`, `ArrowDown` or `Shift+Home` on `board.previousOpen`.
  - `{"board.nextOpen": ["Shift+n"]}` gives a conflict with `board.previousOpen`, and `{"board.previousOpen": ["?"]}` a conflict with `keys.open`.
  - `{"board.answer": ["Mod+Shift+Enter"]}` passes; `{"board.sendFollowUp": ["j"]}` gives a `reserved` problem (an editor's typing key).
  - `{"board.nextOpen": ["j"], "board.sendFollowUp": []}` passes, and `changedKeyActions` gives both.
  - `keyExitActions()` is unchanged.

  In `packages/core/test/config-keys-board.test.ts`, a user file with `board.nextOpen: ["j"]` applies with no warning, and one with `["Enter"]` gives one `keys-not-applied` warning naming `board.nextOpen`. Verify: the new cases fail before 1.3 and pass after it, and every existing case of these files passes unchanged. Done 2026-11-15. Added 8 cases to `keys-overrides.test.ts`, 2 to `keys-effective.test.ts` and 2 to `config-keys-board.test.ts` (appended to the existing file; core applies `board.nextOpen: ["j"]` with no warning, and `["Enter"]` gives one `keys-not-applied` with rule reserved). Extra cases: a widget action sharing the part name `board` stays unreserved, prototype names are no action. All existing cases pass unchanged.
- [x] 1.3 Implement D1 and D6 in `packages/contract/src/keys/`:
  - A new `board-table.ts` with `BOARD_KEYS`, `BOARD_KEY_TYPE`, `BOARD_PART`, `BoardKeyAction` and `BOARD_KEY_TABLE`. Its header comment says what the table is and that it is plain data (AD-1).
  - `tables.ts`: `ALL_KEY_TABLES`.
  - `check.ts`: `MOD_KEYS` gains `Enter`, and its comment says a handler of `Mod+Enter` leaves links alone.
  - `overrides.ts`: the `board`-part reservation; `keyOverridesProblems` and `keyExitActions` default to `ALL_KEY_TABLES`.
  - `effective.ts`: `changedKeyActions` defaults to `ALL_KEY_TABLES`.
  - `keys/index.ts`: the new exports, and one appended export block at the end of `src/index.ts` (askboard-implementation).

  No file under `src/schemas/` changes. Verify: 1.1 and 1.2 pass; the check passes; `git diff --name-only` shows no path under `packages/contract/src/schemas/`. Done 2026-11-15. New `keys/board-table.ts`; `ALL_KEY_TABLES` in `tables.ts`; `MOD_KEYS` gains `Enter`; `overrides.ts`, `effective.ts` default to `ALL_KEY_TABLES`; exports in `keys/index.ts` and one appended block in `src/index.ts`. No path under `src/schemas/` changed. Deviation from D6's wording: the board-part reservation reads the actions of the table of type `board` only, not "any table", because the Kanban's table also names a part `board` (cursor.* and move.* actions); reading every table would have reserved ArrowUp and the like on the Kanban's vocabulary actions, a regression. Check green (14801 pass).
- [ ] 1.4 Review checkpoint: spec review of group 1's range (askboard-spec-reviewer) against D1, D6, the `contract` delta spec and design.md's Merge points. Add a security review (askboard-security-reviewer): the change widens what the contract's override check admits, so check fail-closed behaviour (NFR-10), prototype keys in action names and that no schema moved. Verify: both reports are recorded in the task note, and each finding is fixed tests first or turned into an Issue (`source:review`).

## 2. View: pure parts and strings

- [ ] 2.1 Tests first, the strings and the panel groups (D5, D8). In `packages/view/src/strings/keys-strings.test.ts`, every label of `BOARD_KEYS` is a string key in en-US and it-IT, and D8's keys exist in both languages with plural-free values and `{reason}` the only slot of `status.answerBlocked`. In `catalog/keys/hint.test.ts`:
  - `groupOf("board.nextOpen")` is `board`, and `PANEL_GROUPS` starts with `board`.
  - `panelGroups(BOARD_KEYS, true, …)` gives "Questions" with next open, previous open, answer and send the follow-up in that order, then "Other" with the keys panel.
  - With `takesEdits` false it lists next open, previous open and the keys panel only.
  - The Ranking's groups are unchanged.

  Verify: the tests fail first, then pass after 2.5.
- [ ] 2.2 Tests first, the scope (D2). In a new `shell/board-key-scope.test.ts`, with element stand-ins, `boardKeyScopeOf` gives:
  - `none`: a text input, a textarea, a `role="textbox"` element; an element inside `[role=menu]`, `[role=listbox]`, `[role=combobox]`, `[role=dialog]`, `[role=alertdialog]` or a `select`; an element inside a widget item of a card (a nearest `[data-askboard-item]` whose id differs from the question's); an element inside an item frame outside any card.
  - `{card: "q1"}`: an option inside `[data-askboard-item="q1"]` within `[data-askboard-question="q1"]`; the card's heading; its "Postpone".
  - `board`: a link inside a card, an element inside a card's `[data-askboard-thread]`, `<body>` and the header's buttons.
  - `null` gives `none`.

  Verify: every case fails first, then passes after 2.5; 100% line coverage of `board-key-scope.ts`.
- [ ] 2.3 Tests first, the answer verdict and the previous open question (D3, D4). In a new `shell/answer-key.test.ts`:
  - `answerKeyOf` gives `press` when the primary button is enabled.
  - It gives `announce` with `status.answerChangePending` when a change is pending, with a field to fix as well.
  - It gives `announce` with `status.answerBlocked` and `{reason}` for a field to fix.
  - It gives `announce` with `status.answerEmpty` for nothing chosen on an answerable open question.
  - It gives `none` for an opened Snapshot, a locked board, a loading item, a command in flight and an answered card not being revised.

  In `shell/board-view.test.ts`, `previousOpenFrom`:
  - from question 4 with 1, 2 and 4 open, gives 2;
  - from the first open question, wraps to the last;
  - never gives the question in view, and gives none when no other is open;
  - with no question in view, gives the last open question;
  - ignores unseen questions' priority.

  Verify: the tests fail first, then pass after 2.5; 100% line coverage of `answer-key.ts` and of `previousOpenFrom`.
- [ ] 2.4 Tests first, the options' Enter (D4; Answer by key, "A multiple choice's box"). In `catalog/fields/roving.test.ts`, `checkboxKeyOf` with Enter and Ctrl, Cmd, Shift or Alt held gives undefined, and plain Enter still gives `flip`. The cases of `optionMoveOf` are unchanged. Verify: the new cases fail first, then pass after 2.5.
- [ ] 2.5 Implement:
  - D8's strings in `strings/en-US.ts`, `it-IT.ts` and `keys.ts`, appended.
  - The `board` group in `catalog/keys/hint.ts`.
  - `shell/board-key-scope.ts` and `shell/answer-key.ts`.
  - `previousOpenFrom` in `shell/board-view.ts`.
  - The modifier rule in `catalog/fields/roving.ts`.

  Verify: 2.1 to 2.4 pass, and the check passes.
- [ ] 2.6 Review checkpoint: spec review of group 2's range against D2, D4, D5, D8 and the scenarios they serve. Verify: the report is recorded in the task note; findings are fixed tests first or filed.

## 3. View: next and previous open, and the board's keys panel

- [ ] 3.1 Tests first, the key table against the handler and the header (The board's key table matches its handlers; D3). The pure part of `shell/use-board-keys.ts`, `boardKeyActOf(table, press, scope, available, prevented, repeat)`, gives the action to run or none. In a new `use-board-keys.test.ts`:
  - Each binding of the board's table with each scope.
  - Each binding with Alt, Ctrl, Cmd or Shift added.
  - A prevented key, a repeat, a composing press, an unavailable twin (no "Next open", no target, no Keys button).
  - `board.answer`, which the listener never runs.

  A two-way test reads `BOARD_KEYS`' `tool` entries of part `board` and the rendered header and card. Each such entry has a control carrying its `aria-keyshortcuts` (the jump `N`; the primary in group 4). Each of those controls has an entry. Verify: the tests fail first, then pass after 3.5.
- [ ] 3.2 Tests first, the tooltips and the Keys button (The board's keys are discoverable; The board's keys panel; The user's keys on the board's own keys; D5). Server-render tests of `BoardHeader`:
  - "Next open" carries `aria-keyshortcuts="N"`, and `J` under overrides `{"board.nextOpen": ["j"]}`; with `[]` it carries none.
  - The header shows "Keys" on a live board and on the single-question board, and none on an ended board. Its `aria-keyshortcuts` is `?`.

  Verify: the tests fail first, then pass after 3.5.
- [ ] 3.3 Tests first, the board's keys panel (The board's keys panel; D5). Server-render tests of the panel's body in `board-keys-panel.test.ts`:
  - The title is "Board keys" ("Tasti della board").
  - The groups follow 2.1, with D8's note, the "customised" mark under `{"board.nextOpen": ["j"]}` and "no key" under `{"board.answer": []}`.
  - With `takesEdits` false it lists only the navigation keys.
  - It holds no agent text: render with a board whose title and options hold markup, and find none of it in the panel.

  Verify: the tests fail first, then pass after 3.5.
- [ ] 3.4 Browser tests in a new `packages/view/test/browser/board-keys.browser.ts`, listed in `suites.ts`, on the fixture and `board-keys-asks.ts`, one case per scenario of "Next and previous open by key", "The board's keys are discoverable" ("Next open"), "The board's keys panel" and "The user's keys on the board's own keys":
  - From an option: `N`, `Shift+N`, `Shift+N`, each heading clear of the bars, measured with `measureInset`'s edges.
  - Wrapping back.
  - One question per view.
  - Tabs: `N` crosses to another area, which becomes active.
  - "n" typed in the note and in "Other…".
  - A Ranking's row: `N` moves nothing, and `?` opens the Ranking's panel and not the board's.
  - A newly opened board, with no click.
  - No open question to go to.
  - Alt+N and Ctrl+N.
  - `?` from an option, then Escape: focus back on the option.
  - The header's "Keys".
  - A user file giving next open `j`, set as `keys-config.browser.ts` sets it.

  Tests: the file itself. Verify: the file run passes in Chromium, Firefox and WebKit, and fails on the base head for the key cases.
- [ ] 3.5 Implement D3, D5 and D6's view part:
  - `shell/use-board-keys.ts`, with `useBoardKeys` and `useBoardKeyTable`.
  - `shell/board-keys-panel.tsx`.
  - In `board.tsx`, the hook, `previousOpen` through `go`, and the panel's open control.
  - In `board-header.tsx`, `KeyHint` on "Next open" and the "Keys" button.

  Keep `board.tsx` under 800 lines; the logic goes in the new modules. Verify: 3.1 to 3.4 pass; the check passes; `bun run test:e2e:smoke` passes.
- [ ] 3.6 Review checkpoint: spec review of group 3's range against D2, D3, D5 and D6 and the delta spec's scenarios, including that every scenario has a browser case in the three engines. Verify: the report is recorded in the task note; findings are fixed tests first or filed.

## 4. View: the answer key and the composer

- [ ] 4.1 Tests first, the card's and the composer's keys against the table (The board's key table matches its handlers; The board's keys are discoverable, the primary and "Send"; D4, D5, D6):
  - Server-render tests of `ActionsRow`: the primary button carries `data-askboard-primary`; an enabled primary carries `aria-keyshortcuts="Control+Enter Meta+Enter"`; a blocked one keeps `aria-describedby` pointing at the reason's element; under `{"board.answer": []}` it carries no `aria-keyshortcuts`.
  - A thread test: the composer's "Send" carries the same `aria-keyshortcuts`, and the thread's section carries `data-askboard-thread`.
  - `thread-text.test.ts`'s `isSendKey` cases are replaced by cases of the composer's table match. Ctrl+Enter and Cmd+Enter send. Enter, Shift+Enter, Ctrl+Shift+Enter, Ctrl+Cmd+Enter and an Enter while an input method composes do not. Under `{"board.sendFollowUp": ["Mod+Alt+Enter"]}` only that combination sends.

  Verify: the tests fail first, then pass after 4.3.
- [ ] 4.2 Browser tests in a new `packages/view/test/browser/answer-key.browser.ts`, listed in `suites.ts`, one case per scenario of "Answer by key", "A blocked answer by key" and "Follow-up thread", finding each primary by `[data-askboard-primary]` inside its card:
  - Immediate delivery: "PostgreSQL" is sent, the focused option is not selected, focus is on the heading, and one command reaches `board-host`.
  - Submitted delivery: ready, `status.ready`'s message in the status region, the pill "Waiting".
  - A multiple choice's box not flipped.
  - `Mod+Enter` on a focused "Postpone": the question is answered and not postponed.
  - The single-question board, from the heading.
  - A Tree: `Mod+Shift+Enter` adds a child, and `Mod+Enter` sends nothing.
  - A received verdict: the dialog, then Cancel with focus back on the option.
  - A field to fix, nothing chosen, and an agent change waiting: each announces its message, sends nothing and leaves "Keep mine" unchosen.
  - A held key, sent as repeated `keydown` events: one command, ready not toggled twice.
  - The composer: Enter adds a line, then `Mod+Enter` sends the follow-up and answers nothing.
  - A user file giving answer no key.

  Each case counts the commands `board-host` receives. Tests: the file itself. Verify: the file run passes in Chromium, Firefox and WebKit, and fails on the base head for the key cases.
- [ ] 4.3 Implement D4, D5 and D6's card and composer parts:
  - `question-card.tsx`: the section's `onKeyDown`, through `answerKeyOf`, `onAnswer(target)` and `context.status.announce`.
  - `question-actions.tsx`: `KeyHint` on the primary button, and `data-askboard-primary` on it (D4).
  - `thread.tsx`: the table match in the composer, `KeyHint` on "Send", and `data-askboard-thread`.
  - `thread-text.ts`: `isSendKey` removed.

  Keep `question-card.tsx` under 800 lines. Verify: 4.1 and 4.2 pass; the check passes; `bun run test:e2e:smoke` passes.
- [ ] 4.4 Review checkpoint: spec review of group 4's range against D4 to D6 and the delta spec. Add a security review (askboard-security-reviewer) for NFR-10 and AD-10. A key must never send or mark ready a choice the user did not make. Check every path to `onAnswer` from a key, the options' Enter rule, repeats, and the composer's send. The status messages render agent-written reasons as text only (AD-8). Verify: both reports are recorded in the task note; findings are fixed tests first or filed.

## 5. The help skill

- [ ] 5.1 Tests first (The board's keys in the help skill; The help skill teaches the key configuration; D7). In `tools/build/skills/help.test.ts` and `keys.test.ts`:
  - `key-actions.md` opens with "Board keys": next open N (N), previous open Shift+N (⇧N), answer Ctrl+Enter (⌘↩) "on a question's own controls", send the follow-up Ctrl+Enter (⌘↩) "in the follow-up composer", the keys panel ? (?), and "Sending all held answers has no key".
  - The list of every action includes `board.nextOpen`, `board.previousOpen`, `board.answer` and `board.sendFollowUp`.
  - `configure-keys.md` names the board's own keys and the Ranking, and no other widget.
  - The examples are checked against `[BOARD_KEY_TABLE, ...widgets]`.
  - `SKILL.md`'s last line is D7's.
  - Every file stays within `HELP_BUDGETS`, which stay as they are.

  Verify: the tests fail first, then pass after 5.2.
- [ ] 5.2 Implement D7 in `tools/build/skills/help-keys.ts`, `keys.ts`, `help.ts` and `templates/help/SKILL.md`, then `bun run build:skills` and commit `skills/askboard-help/`, never edited by hand. Verify: 5.1 passes; `bun run check:skills` passes; `SKILL.md` is at most 6,000 characters and the note records its size. If it is over, stop and report to the architect rather than raise the budget.
- [ ] 5.3 Review checkpoint: spec review of group 5's range against D7 and the `skills` delta spec. Verify: the report is recorded in the task note; findings are fixed tests first or filed.

## 6. Records, integration and the pull request

- [ ] 6.1 Documents (D9):
  - PRD NFR-12: the added sentence.
  - EXPERIENCE.md: the Accessibility Floor's Keyboard core and Shortcuts items, the Next-open jump and Context header rows, D8's Voice and Tone rows with "(to review)" on Italian strings outside report §4, and Open Items 21 closed.
  - DESIGN.md: the Context header's Keys button, the key hint on the next-open jump, the question's primary button and "Send", and the board's keys panel.

  Tests: none (documents). Verify: `grep -n "Open Items 21" docs/ux-askboard-2026-10-27/EXPERIENCE.md` shows it closed by `board-keys`; no sentence of the floor still says the board's keys or the composer's modifier are not recorded; NFR-12 holds the sentence.
- [ ] 6.2 Chunk sizes: `bun run build:view --record-sizes`, then commit `packages/view/chunk-sizes.json`. Tests: the view build's size check. Verify: the note records the shell and board-page sizes before and after, and the build passes without the flag.
- [ ] 6.3 As-built: write `docs/as-built/board-keys.md` (what was built, where, the names and seams added: `BOARD_KEYS`, `BOARD_KEY_TYPE`, `BOARD_PART`, `BOARD_KEY_TABLE`, `ALL_KEY_TABLES`, `boardKeyScopeOf`, `answerKeyOf`, `previousOpenFrom`, `useBoardKeys`, `useBoardKeyTable`, `BoardKeysPanel`, `data-askboard-thread`; no version bound). Correct the sentence of `docs/as-built/keyboard-shortcuts-help.md` that D9 names, and say so in the new note. Tests: none. Verify: `grep -n "ALL_KEY_TABLES" docs/as-built/*.md` finds both notes, and the new note holds no status.
- [ ] 6.4 By-hand check for the PO: search the Issues for the screen-reader check `answering-flow-fixes` filed (`gh issue list --state all --search "VoiceOver Orca in:title,body"`). If one is open, comment on it with this change's cases. Otherwise open one (`type:chore`, `source:review`, `needs-po`, `area:keyboard`, `area:board`). The cases: `N` in VoiceOver's and Orca's browse and focus modes; `Mod+Enter`'s blocked messages read once. Tests: none. Verify: the note gives the Issue number.
- [ ] 6.5 Integration: the check, `bun run test:e2e` (the header gains a Tab stop and two browser files are added), and `npx --yes @fission-ai/openspec@1.15.0 validate --all --strict --no-interactive`. Tests: the suites. Verify: each passes, and the note records the counts; a test that walked the header's Tab order and now fails is updated to include "Keys", with the file named in the note.
- [ ] 6.6 Rebase (askboard-contract-versioning) once #212 has merged:
  - `git fetch origin`, a backup branch, then `git rebase --onto origin/main 9eb5f364`.
  - Resolve per design.md's Merge points (`icon-set`, change 4 if merged). If change 4 merged first: `previousOpenFrom` and the requirement "Next and previous open by key" mirror its `nextOpenFrom` order (test first in `board-view.test.ts`), `keys.action.board.previousOpen` reads "Previous to do" / "Precedente da fare", one `data-askboard-primary` stays on the primary, and `SKILL.md` is re-checked against `HELP_BUDGETS`.
  - Re-check every borrowed name with `git grep -n` on the rebased head.
  - Regenerate the skills (`bun run build:skills`) and re-record the chunk sizes.
  - Confirm no contract set moved: compare `git grep -nE '^export const [A-Z_]+_(VERSION|FORMAT) = "' origin/main -- packages/contract/src` with the head.

  Verify: `grep -rn '^<<<<<<<\|^>>>>>>>' packages tools docs openspec` is empty; the check, `bun run build`, `bun run test:e2e:smoke` and the strict validation pass; the note records main's SHA and that no version was bound.
- [ ] 6.7 Pre-PR review: spec review and security review of the whole range `origin/main...HEAD`. Then the pull request body: what changed and why, the checks run with their results, `Closes #187`, and what is left for the PO (6.4's Issue). Tests: none. Verify: both reports are recorded in the note, every finding is fixed or filed, and the body holds no AI attribution.
