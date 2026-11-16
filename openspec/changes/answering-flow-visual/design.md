# Design

## Context

See proposal.md (Why). Inputs, all under `drafts/ux-review-168/`: report 1.1.0 (§3 to §5 the flow, §6.4 what B obliges, §8.3 P2-1, §9 the validation), `cabina-settling-1.0.0.md` (points 1 to 9) and the 1.1.0 mockup with `proposals/screenshots/b-1.1.0/` (frames cited as "frame 05"). The drafts never override `docs/` or `openspec/`; the mockup is reference only.

This change was designed on `main` at 583a0161. On 2026-11-16 it was rebased onto `answering-flow-guidance`'s head dd2c23e4, which sits on `main` 46d3dcf7 and so holds `answering-flow-fixes` (#212), `icon-set` (#210) and `board-keys` (#225), all three merged and archived; change 4 is the one not merged (Merge points, task 0.2). What it relies on, as found on that base, all under `packages/view/src/shell/` unless named:

- **Header** (`board-header.tsx`). Row 1 is `WhoAndWhere` (FR-24). Row 2 holds the title, the "Ask" label and `AskPill` (`markers.tsx`), `AgentPill`, then `HeaderActions` (`header-actions.tsx`: the count to do, the jump `data-askboard-next-to-do` with its `KeyHint`, unread replies, the agent-change flag, and `board-keys`' text "Keys" button `BoardKeysButton` with its panel, `board-keys-panel.tsx`) and `QuickToggles` (Theme and density `Segmented` controls, Settings).
- **Bar** (`bottom-bar.tsx`). The delivery switch and helper, the mode-switch and replace dialogs, "Prefill recommended" and its result with "Undo" (change 4), the postponed warning (`postponedWarningOf`), Snapshot with `SnapshotFeedback`, the updates line and Send (`data-askboard-submit`, absent in "One by one"). The board page's settings sheet sits by CSS between two header rows and `--bottom-bar` (`board-page/settings-panel.ts:32`); the reading panel by the view's measured inset (`ReferenceInset`).
- **Rail and navigators** (`navigators.tsx`). `Outline` is a sticky rail of `{spacing.outline-rail}` (212 px) in sections and tabs; one question per view has `QuestionNavigator` (n of m, a marker per question, Previous, Next) and no rail.
- **State** (change 4). On the base: `answerStateOf` and `ladderCountsOf` (`answer-state.ts`), `afterAnswerOf` and the footer (`after-answer.ts`, `guided-flow.ts`'s `Footer`, `question-footer.tsx`), `completionOf` and `receiptCountsOf` (`completion.ts`), `primaryLabelOf`, `measureBoardInset` and `TAB_STRIP` (`measure-inset.ts`), `useHeaderHeight` (`use-header-height.ts`, which places the sticky tab strip), `styles/motion.css`, the harness locators `answer`, `submit`, `postpone`, `prefill`, `nextToDo`, `delivery(mode)`, `receipt(kind)`. Still to come in change 4's later groups: `CompletionPanel` (its group 7), `prefillCountOf`, `undoPrefill` and the prefill result with "Undo" (group 8), the ladder's icons (group 9), the reduced-motion rule (group 10).
- **Moves** (change 1). `revealAndFocus`, `revealDelta` (`reveal.ts`), `measureInset` (`measure-inset.ts`: the header and the last `footer`), `useQuestionInView`, `StatusRegion`, `addedMessageOf`, `fieldToFixOf` and the visible reason beside the primary.
- **Draft** (`board-draft.ts`). `BoardDraftState` holds `delivery` and `inView`; `draftRecordOf` writes the record, `restoreDraft` reads it; `board-host` sends the held record before the state on connect. `draftRecordProblems` (`contract/src/draft-record.ts`) checks a record against the board document. Change 4 widens the board protocol and the configuration, not the draft record (its D14).
- **Unseen** (`attention.ts`). `createAttention` keeps, in memory, the questions known since boot and the unseen ones the agent added.
- **Chunks**. `chunk-sizes.json` on the base equals `main`'s: `shell` 239,027 B, `icons` 6,710 B, `board-page` 1,039,339 B; change 4 records its own growth (estimated 12 to 16 KB in `shell`) at its task 11.3.

AD IDs relied on: AD-1 (no new import edge: the view's code stays in `view`, the record crosses `contract`, `core` and `server` along existing edges), AD-3 (receipts), AD-4 (the agent pill shows presence), AD-7 (the board protocol's minor), AD-8 (agent text as text), AD-9 (chunks), AD-10 (fail closed; the ask state), AD-14 (the presentation keys the Theme popover writes, unchanged), AD-20 (the draft record, amended in place). UX: EXPERIENCE.md Board anatomy, Presentations, Board chrome, Question card, Ask states, Counting, Accessibility Floor, Interaction Primitives (Close and reload), What a reload keeps, Snapshots, Voice and Tone; DESIGN.md Layout & Spacing, Elevation & Depth, Board chrome, Question card, Icons, the YAML tokens.

## Goals / Non-Goals

**Goals:**

- B's layout as the PO settled it, on the seams changes 1, 4 and 5 leave, with no second notion of a question's state: the strip, the outline, the card, the ledger and the completion panel read the ladder and the receipts only.
- Every rule that decides what shows (numbers, ledger counts, strip segments, the outbox's line, the tray's lifetime, the answered look) is a pure function tested in Bun; the components are thin, and each scenario has a browser test, run in Chromium in the change and in the three engines in CI's e2e train on `main` (PO's decision on #227, 2026-11-16).
- Tokens only: no colour, width or height outside DESIGN.md's tokens, so `palettes` (#189) re-points the board without touching the components.

**Non-Goals:**

- Palettes, the palette row in the Theme popover, forced colours (#189). Bundling Inter and JetBrains Mono (D-4, D16). The by-hand screen-reader pass (#209). New board keys (`board-keys` owns them) and any change to the flow's rules (change 4).

## Decisions

### D1. The header's three rows

- **Row 1, who asked and where**, stays as it is (FR-24, spec "Who asked, and where"). The mockup draws only B's two rows, as it draws the flow, not the context; dropping row 1 would drop FR-24. Net height: three rows of `{spacing.header-row}` (96 px compact) against today's two plus the 48 px bar, so the content gains 16 px at 800 px.
- **Row 2, the ask row** (`ask-row.tsx`): the title (`h1`, `min-w-0 flex-1 truncate`, full text in the agent-label tooltip), the ask ID (`{typography.code}`, muted, isolated, capped like an agent label), `AskPill` without the "Ask" label (its name is `header.askPill`, "Ask: {state}"), `AgentPill`, the postponed warning (`postponedWarningOf`, `shrink-0`, the `question-marker-postponed` icon and text, no warning colour), a spacer, then the tools: `SnapshotButton` (text and camera icon), the Keys button of `board-keys` made icon-only (`aria-label` from `keys.button`; its tooltip keeps `?`), `ThemeControl`, Settings icon-only (named by `toggles.settings`). The row has one height; nothing in it wraps.
- **`ThemeControl`** (`theme-control.tsx`): an icon button named by `toggles.theme`, opening a non-modal Radix Popover (already in the `radix` chunk) with the two `Segmented` controls of today's `QuickToggles`, unchanged in behaviour, read-only states and Snapshot handling. `QuickToggles` becomes the popover's body. `palettes` adds its row there.
- **Row 3, the progress row** (`progress-row.tsx`), on boards of two or more that have not ended, Snapshots included: `progress.label`, the strip (D5), the count, a separator, "Next to do" (absent, not disabled, with nothing to do: report §6.4), "Prefill recommended", then at the row's end the unread-reply count and the agent-change flag.
- **D-5**: the header carries `{elevation.shadow-sm}`.

*Alternatives.* Folding row 1 into a tooltip on the title was rejected (FR-24's "two asks told apart by their headers alone"). Keeping the quick toggles inline was rejected: at 1280 px they leave the title about 0 px once the warning shows (frame 13, crowded).

### D2. The rail

`rail.tsx` renders, on boards of two or more in every presentation, a sticky column of `{spacing.outline-rail}` = 256 px (settling point 4): `Outline` in a `min-h-0 flex-1 overflow-y-auto` part, `Outbox` in a `flex-none` part at its foot. Its `top` is the header's height and its height the rest of the viewport, from one CSS variable `--askboard-header-height`, set on the board's root from change 4's `useHeaderHeight` (its `ResizeObserver` on the header); change 4's sticky tab strip and the tray read the same value (one measurement, no second observer; Merge points). One question per view gains the rail (settling point 2); the single-question board has none.

### D3. The outbox

`outbox.tsx` replaces `bottom-bar.tsx`, which is deleted. It moves, unchanged in behaviour: the switch (`Segmented`, full width, `data-askboard-delivery`), the helper (`bar.immediateHelp`, `bar.submittedHelp` with `bar.submitName`), both alert dialogs, Send (`data-askboard-submit`, `primaryLabelOf`'s count rule, absent in "One by one"), and the focus handling after Send and "Send and switch" (`onSubmitted`, the `sent` ref). New: the ledger (D4) and one line under Send from `outboxLineOf(...)`, pure: `updates {count, first}` while agent-change notices block held work (it replaces the others), else `all-ready` when change 4's `completionOf` is `send-all`, else `held {count}` while answers are held, else none. The label is `bar.delivery` with the `inbox` icon. On a locked board every control is disabled, as the bar's were, and the ledger still counts.

### D4. The ledger counts

`ledger.ts`: `ledgerOf(document, state, work, flights, delivery)`, pure.

- **Drafts** and **Ready** are `ladderCountsOf`'s `draft` and `ready` (change 4).
- **Sent** and **Delivered** are change 4's `receiptCountsOf(document, state)` (`completion.ts`), reused, not copied: the questions whose logged answer or decline carries a receipt (`sent` or `delivered`), a revision included, and those whose receipt is `delivered`, the same counts `completionOf` reports. A unit test runs the ledger and `completionOf` over the same boards and asserts that the ledger's two counts equal the panel's `done` counts. Neither reads `state.ask` or `askPillOf` (a test with `state.ask` `answered` and every receipt `sent` gives Delivered 0). A question being revised counts in Drafts and, by its logged receipt, in Sent.
- **Ready** is `undefined` (drawn as "–", described by `ledger.readyOff`) in "One by one" while nothing is held.
- A cell whose count rises pulses for 150 ms (`styles/motion.css`, under `prefers-reduced-motion: no-preference` only; change 4's reduce rule zeroes it otherwise). The ledger is a `group` named by `bar.delivery`; each cell reads "{count} {label}".

*Conflict settled.* The settling (§8, last paragraph) keeps declines out of the ledger and adds "1 rifiutata." to the completion line; change 4's `completionOf` counts a decline among the sent (its D6; the line now reads "Inviate: {s}. Consegnate all'agente: {d}.", #168 comment 6896717005). Two numbers for "sent" on one screen would contradict each other, so the ledger counts a decline as sent, as the panel does, and the completion line is not changed.

### D5. The progress strip

`progress-strip.tsx` over `stripOf(document, state, work, flights, unseen, numbers)`, pure: one segment per question in board order, grouped by area (a gap between groups, one group without areas), each `{questionId, state, number, chip, isNew}`. A segment is a button (28×24 px, `{rounded.md}`), its state's icon on its tone's subtle fill with a 3 px underline in the stripe's style (D8), the current one outlined in `{colors.foreground}`, a `{colors.info}` dot when new. Its accessible name is `progress.segment` ("{number} {chip}: {state}", ", New" when new), shown in the agent-label tooltip on hover and focus (the chip is agent text, AD-8).

- **Keyboard**: one Tab stop (roving `tabIndex`, the current segment holding 0); `segmentAfterKey` moves focus (arrows, Home, End) without moving the board; Enter and Space activate natively. Activation runs the board's `go`, as an outline entry does (tab activation, one-question-per-view view change, `revealAndFocus`).
- **Overflow**: the strip is `min-w-0 overflow-x-auto` inside the row; when the question in view changes, `stripScrollLeft(...)` (pure) brings its segment into the strip's box by setting `scrollLeft`, never `scrollIntoView`, which could scroll the page.
- **Current**: the question in view (change 1's `useQuestionInView`), the same as the outline's.

### D6. Short question numbers

- **The rule** (`question-numbers.ts`, pure): `numbersOf(held, boardOrder)` keeps every held number of a question still on the board, gives each question without one the next number in board order, and returns `{byId, next}`, `next` never decreasing. A removed question's number is never given again (settling point 7). `QUESTION_NUMBER_MAX` (9,999) bounds them; a board that would pass it shows no number for the questions beyond (logged as a unit test case, not expected in practice).
- **Where they live**: `BoardDraftState` gains `numbers` and `nextNumber` beside `inView`; `draftRecordOf` writes them, `restoreDraft` reads them before the first render (the record arrives before the state). Numbers are given at boot and on each document update, so a question the agent added while the tab was closed takes the next number at the next load. They are not unsent work: the leave-page prompt, "Copy my unsent work", the unsent-work note and the draft limit's drop order ignore them.
- **The removed**: an in-memory list (`removedNumbers`, beside `attention`) of `{number, area, after}` for questions removed while the page is open; the outline shows `outline.removed` in their place until the page reloads. The status region's removed message gains the title through a new key, `status.removed` (spec "Status messages for the answering flow"); the question navigator's own notice keeps `navigator.removed`.
- **Where they show**: the card's head, the outline entry, the strip segment and after the title in change 4's footer ("Next: Cache Q2", the number as its own element, no string change). Not on the single-question board (numbers are still given, so a board that grows keeps them) and not in an opened Snapshot, which has no draft record (AD-20).
- **Contract** (spec "Short question numbers in the draft record"): `draft-record.json` gains `numbers` (an object of IDs to integers 1 to `QUESTION_NUMBER_MAX`) and `nextNumber` (integer 1 to `QUESTION_NUMBER_MAX` + 1); `draftRecordProblems` refuses a duplicated number, a number not below `nextNumber` and a key naming no question, through own-property lookups as for `questions`. `QUESTION_NUMBER_MAX` is a shared contract constant. The board protocol takes the next minor after main's; `core` holds the record whole and `board-host` passes it, so neither changes source; their tests pin the round trip (askboard-contract-versioning, Rules 1 and 2). A record the board page sends while the agent's removal is in flight names a removed question and is refused like a stale `questions` key; the next mirror, after the document update, carries the right keys.
- **AD-20** is amended in place: "For the board it holds the delivery mode, the open tab or the question in view, and the short numbers it gave the questions."

*Alternatives.* Numbers from `board-host`'s log (a board-document field) were rejected: a server and document change for a view label. Numbers per page load were rejected: a reload would renumber after an addition or removal, the defect point 7 removes.

### D7. The card

- **Head**: the number (`{typography.code}`, muted), the chip, a spacer, the state badge (the ladder's icon and label on its tone's subtle fill), "More" as an icon button named `question.more` (it moves out of the actions row).
- **Stripe**: `data-askboard-state="<ladder state>"` on the card, and `styles/state.css` draws a 4 px left edge: To do the card's `{colors.border}`; Draft `{colors.primary}` dashed; Ready not sent `{colors.primary}` solid; Not sent yet `{colors.muted-foreground}` dashed; Sent `{colors.success}` dashed; Delivered `{colors.success}` solid; Postponed `{colors.muted-foreground}` dotted; Declined `{colors.muted-foreground}` solid (settling point 1 measured these pairs, 3:1 or more).
- **Options**: one row each, label then description inline; the description wraps and is never cut (agent content, AD-8; the mockup's one-line ellipsis is not adopted). The recommended badge and "Accept recommended" sit at the row's end (change 4).
- **The open prompt** stays shown on every question (spec "Open prompt", FR-7); the mockup's "+ Nota per l'agente" disclosure is not adopted.
- **Actions row**: the primary first, beside the options (F-19), with its key caps (D10) and the visible reason (change 1's field reason, or D9's), then "Later" at the row's end.
- **Answered look** (spec "The answered look and Edit"): `answeredLookOf(state, revising)` is true for Ready not sent, Sent, Delivered and Declined while no revision is in draft. The card sets `data-askboard-answered`; options stay the real controls, drawn subdued except the chosen ones, so that any edit starts a revision as today; the actions row gives way to `answer.line` ("Answer: {answer}", from the same summary the status message uses) and "Edit". On a ready answer "Edit" is change 4's primary in its released form (`data-askboard-primary`); otherwise a plain button (`data-askboard-edit`) that focuses the chosen option, or the first control, and sends nothing.
- **Footer** (change 4's "Continue"): drawn in the state's tone with the number after the title, and "Edit" before "Continue" on a sent answer (frame 03).

### D8. The question card's look in tokens

DESIGN.md's `question-card` takes `{rounded.md}` (4 px) for its radius and `{spacing.md}`/`{spacing.lg}` paddings as today; the `question` type token goes from 20 px to 15 px compact and from 22 px to 17 px comfortable (B's density, report §6.2). Every colour above is a role token, so a palette re-points it.

### D9. "Choose an option"

`nothingChosenOf(question, work)`, pure: true for a question with options whose primary is blocked only because nothing is chosen, no "Other…" text and no note. The card shows `question.chooseOption` in the slot of change 1's visible reason, as the primary's description. `board-keys`' `answerKeyOf` keeps its own message (`status.answerEmpty`, which also names the note), so no key behaviour changes (its merge point (d)).

### D10. Key caps

`button-keys.tsx`: `ButtonKeys({entry})` draws the first combination of an entry in effect with `hintOf` and `KEY_CAP`, `aria-hidden`, nothing when the entry has no keys. "Next to do" takes `board.nextOpen`'s entry and the primary `board.answer`'s, both from `board-keys`' `useBoardKeyTable`, so a user's remap shows at once; the tooltips and `aria-keyshortcuts` stay `KeyHint`'s. "Continue" shows no cap: Enter is the button's own, not an action of the board's table.

**Keys.** This change adds no binding and no widget, and changes no key table: the strip's arrows, Home and End are the composite's own navigation, as in the segmented control (`segmentAfterKey`), which no table lists; `keys-coverage.test.ts` covers widget types and is unaffected; the board's keys panel is unchanged.

### D11. The feedback tray

`feedback-tray.tsx` over `createTray()`, a store of at most one message per kind, newest first:

| Kind | Text | Action | Ends |
|---|---|---|---|
| `snapshot` | `SnapshotFeedback`'s outcome, with the unsent-work note when it applies | none | its close control, or the next Snapshot |
| `prefill` | `status.prefilled`'s text | "Undo" (change 4's `undoPrefill`) | change 4's batch end (the next draft change or act), "Undo", or close |
| `added` | `addedMessageOf`'s text | "Go": `go` to the first added question still unseen | "Go", close, or every question it names seen (`attention.unseen`) |

- **Place**: fixed under the header at the content's top right (`top` from `--askboard-header-height` plus `{spacing.sm}`, 360 px wide, `{colors.popover}`, `{elevation.shadow-md}`), after the header in DOM order, so Tab reaches it after the tools. It is not a live region (the status region speaks, change 1). It never moves focus on its own; "Undo" takes focus after a prefill, as change 4 decided (the user's act).
- **No timer** (WCAG 2.2 SC 2.2.1): the mockup's 12 s timeout is not adopted.
- **Insets**: while the tray holds a message, `measureBoardInset` (change 4) takes its bottom edge as the top inset, so every jump and the in-view band clear it (spec "Focus moves clear the sticky bars").

### D12. Insets after the bar

- With no `footer`, change 1's `measureInset` gives a bottom inset of 0; the reading panel then runs to the viewport's bottom.
- **Tab** (spec "Tab clears the sticky bars"): `scroll-padding-top` on the view's scrolling element follows the top inset (header, tab strip, tray), so that the engines' own focus scrolling keeps a tabbed control clear of the bars (probe P2). If an engine ignores it, a `focusin` listener on the view's document scrolls a focused element under the bars by `revealDelta`, instantly, without moving focus.
- **The settings panel**: the view's `open-settings` message carries `inset: ReferenceInset`, measured as for `open-reference`, checked by the same view-protocol check (`INSET_MAX`), and the board page places the sheet at it, as the reading panel does. The view protocol is the view's own, not a contract schema set: no version.

### D13. One question per view, the single-question board, Snapshots

- **One question per view**: the rail with outline and outbox (D2); `QuestionNavigator` keeps "Question n of m", Previous and Next, and loses its markers to the header's strip (settling point 2); "Go to the next" changes the question shown as change 4 builds it.
- **Single-question board**: rows 1 and 2, "Snapshot" among the tools, the card at the content's full width, no number (report §3.4, settling point 3). The postponed warning shows in row 2 (frame 12).
- **Opened Snapshot**: rows 1 to 3 without the agent pill, the warning, "Snapshot", Settings and "Prefill recommended"; the rail with the outline and no outbox; no tray; no numbers.

### D14. The ask pill (#213, option 1)

The words stay. The pill's CSS marker becomes an icon from the module: `circle` waiting, `circle-dashed` partly answered, `check` answered, `lock` closed, `circle-x` discarded; it never uses `send` or `check-check`, the receipts' icons (settling point 8). Its accessible name and tooltip are `header.askPill`. The pill's meaning is its own requirement, "What the ask pill says"; "Counts and the next-open jump" keeps only a pointer to it, which also keeps that block within OpenSpec's 500-character limit. Records corrected: EXPERIENCE.md's State pill row ("as the agent has received it" becomes "as answered on the board"), Ask states (Partly answered: "after the first answer, postpone or decline the board sends"; Answered: "as answered on the board"), Counting's Ask state pill row; the spec sentence (Counts and the next-open jump); the comment on `askPillOf`. Counting's pending-asks row keeps its wording: it is the log's, outside the board.

### D15. Icons

Lines appended to `packages/view/src/icons/index.ts` (icon-set's module), each named for its role, each used, each beside a text label or inside a named control (icon-set decision 6):

| Export | Lucide | Where |
|---|---|---|
| `IconSnapshot` | `camera` | Snapshot tool |
| `IconKeys` | `keyboard` | Keys tool |
| `IconTheme` | `palette` | Theme tool |
| `IconSettings` | `settings` | Settings tool |
| `IconOutbox` | `inbox` | outbox label |
| `IconSendAll` | `send` | the outbox's Send |
| `IconInfo` | `info` | the outbox's line |
| `IconPrefill` | `sparkles` | "Prefill recommended" |
| `IconMore` | `ellipsis` | "More" in the card's head |
| `IconEdit` | `pencil` | "Edit" |
| `IconUndo` | `undo-2` | "Undo" in the tray |
| `IconGo` | `arrow-right` | "Go" in the tray |
| `IconBlocked` | `circle-alert` | the reason beside a blocked primary |
| `IconAskWaiting`, `IconAskPartial`, `IconAskAnswered`, `IconAskClosed`, `IconAskDiscarded` | `circle`, `circle-dashed`, `check`, `lock`, `circle-x` | the ask pill (D14) |
| `IconNew` | `bell-dot` | the new mark on a segment and an outline entry |

Change 4's ladder icons (its D11, built in its group 9: `IconToDo` `circle`, `IconDraft` `pencil`, `IconReady` `package`, `IconNotSentYet` `hourglass`, `IconSent` `send`, `IconDelivered` `check-check`, `IconPostponed` `clock`, `IconDeclined` `ban`, `IconAreaDone` `check`) draw the state badge, the strip's segments and the outline; this change borrows them and adds none for a state. Four exports above reuse a Lucide icon of those (`IconAskWaiting` `circle`, `IconAskAnswered` `check`, `IconEdit` `pencil`, `IconSendAll` `send`): the module names roles, and a role may reuse an icon, as `IconSelected` and `IconAreaDone` both use `check`. Task 0.3 checks each name in the pinned tarball. The `icons` chunk grows about 320 B per icon (about 6 KB); the shell only by its imports.

### D16. Fonts: measured with Inter, shipped as today

The settling (point 4) says the product bundles Inter; it does not (D-4: `tools/build/tokens.ts` uses system stacks). Bundling the faces means adopting upstream font files under the addendum's OFL clause (unmodified files, so no subsetting) and inlining them as `data:` URLs into every board and Snapshot (AD-8, AD-9), several hundred KB each: a change of its own. Here, probe P1 measures the rail's longest labels with Inter (the upstream release, loaded from a scratch folder) and with the system stacks of macOS, in Chromium, at 1280 px in "Compatta" and "Comoda"; the fit test (task 8.2) runs on the fonts the build ships, on Linux in CI and on macOS. If 256 px clips a label in any of them, the group stops and reports to the architect: the width is the PO's (settling point 4).

### D17. Strings

New keys; Italian marked "(to review)" in EXPERIENCE.md's Voice and Tone (PO, #168, 2026-11-15), the rest of the mockup's strings as drawn. No new string holds a glyph `glyphs.test.ts` refuses.

| Key | en-US | it-IT |
|---|---|---|
| `header.askPill` | Ask: {state} | Richiesta: {state} |
| `progress.label` | Progress | Avanzamento |
| `progress.segment` | {number} {chip}: {state} | {number} {chip}: {state} |
| `question.number` | Q{n} | D{n} |
| `outline.removed` | {number} removed by the agent | {number} rimossa dall'agente |
| `outbox.held` | {count} answer ready / answers ready: nothing has been sent yet. | {count} risposta pronta / risposte pronte: niente è stato ancora inviato. |
| `ledger.drafts`, `ledger.ready`, `ledger.sent`, `ledger.delivered` | Drafts, Ready, Sent, Delivered | Bozze, Pronte, Inviate, Consegnate |
| `ledger.readyOff` | Not used in "One by one" | Non usato in «Una alla volta» |
| `answer.line` | Answer: {answer} | Risposta: {answer} |
| `question.chooseOption` | Choose an option | Scegli un'opzione |
| `tray.go`, `tray.close` | Go, Close | Vai, Chiudi |
| `status.removed` | Question removed by the agent: {title}. | Domanda rimossa dall'agente: {title}. |

Changed value: `bar.postponedWarning` in it-IT ("rinviata" becomes "rimandata": "Hai {count} domanda rimandata / domande rimandate: chiudendo perdi questa richiesta"); the status region's removed message moves from `navigator.removed` to `status.removed`. The tools reuse `toggles.theme`, `toggles.settings` and `keys.button`. The mockup's optional "La tua risposta pronta resta qui finché non scegli." is not adopted: the notice's existing strings say it.

### D18. Records and versions

- **Versions.** One set widens: the board protocol (the draft record), at the next minor after main's, bound at task 10.1 (askboard-contract-versioning, Rule 1). Change 4 widens the board protocol too and merges first, so while this branch sits on change 4's head "main's" is read as the base's: the constant is built at the base's minor plus one (task 0.2 records the numbers) and rebound at 10.1 against `origin/main` after change 4's squash merge. The configuration is not widened (its keys are unchanged) and keeps what `main` holds then. The view protocol is not a set; the Snapshot data carries no number.
- **Bound on 2026-11-16, rebased onto origin/main dd563708:** board protocol 1.12 (main 1.11); every other set keeps main's value (input 1.13, output 1.13, tool envelopes 1.14, board document 1.12, configuration 1.2, view manifest 1.1, Snapshot data 1.3).
- **Spine**: AD-20 amended in place (D6). **PRD**: none (FR-24 already says what the pill and the header show).
- **EXPERIENCE.md**: Board anatomy (three rows, the rail with the outline over the outbox, no bottom bar), Presentations (one question per view, single-question board), Board chrome (Context header, State pill, Next-open jump, Quick toggles into "Theme", Outline navigator, Question navigator, Bottom action bar removed for an Outbox row, Select recommended, Delivery mode switch, Submit, Snapshot control; new rows Progress strip, Outbox ledger, Feedback tray, Short question numbers), Question card (head, answered look, Edit, the reason with nothing chosen), Ask states and Counting (D14; the ledger row), Accessibility Floor (the strip's Tab stop, the tray never takes focus, Tab clears the bars), Interaction Primitives (the warning's place), What a reload keeps (the numbers), Snapshots (no outbox, no numbers), Voice and Tone (D17).
- **DESIGN.md**: the YAML (`outline-rail` 256 px, the `question` sizes, `bottom-bar` and `bottom-bar-comfortable` removed, components `progress-strip`, `outbox`, `ledger`, `feedback-tray`, `state-stripe`, `question-card.radius`), Layout & Spacing (the board frame), Elevation & Depth (the header's shadow, the tray's; no bar), Board chrome and Question card rows as D1 to D11 draw them, the Icons table (D15), Open Items (D-5 settled; D-4 open, D16).
- **Skills**: the help template's "The board" section names the outbox and the header's warning in place of the bar, within its budget (`bun run build:skills`, `check:skills`); `.claude/skills/askboard-implementation/references/test-harness-patterns.md`'s note on a control that covers a target names the three header rows, the sticky tab strip and the tray, citing DESIGN.md Layout and report §6.4, with a row in `docs/harness-history.md` (AGENTS.md, Agent harness), then `./setup.sh --codex-only` (AGENTS.md, Codex interop).
- **As built**: `docs/as-built/answering-flow-visual.md`; the sentences of `answering-flow-fixes.md` and `answering-flow-guidance.md` that name the bottom bar are corrected, and the new note says so.

## Merge points

| With | Shared | Rule |
|---|---|---|
| `answering-flow-fixes` (#212, merged fd14489a, archived f9f38388) | `revealAndFocus`, `revealDelta`, `measureInset`, `useQuestionInView`, `StatusRegion`, `addedMessageOf`, `fieldToFixOf`, the removed-question message; its ADDED "Focus moves clear the sticky bars" and "Status messages for the answering flow" and its MODIFIED "Counts and the next-open jump", "One question per view", "Outline navigator", "Delivery mode", all of which this delta modifies in change 4's wording; `bottom-bar.tsx`, deleted here | Merged and archived: its requirements are on `main`'s specs, in change 4's wording where change 4 modifies them. Archive order: guidance, then this change |
| `answering-flow-guidance` (change 4, `worktree-feature-answering-flow-guidance`, this branch's base at dd2c23e4, its group 6 of 11) | Borrowed: `answerStateOf`, `ladderCountsOf`, `afterAnswerOf`, the footer, `completionOf`, `receiptCountsOf`, `CompletionPanel`, `primaryLabelOf`, `prefillCountOf`, `undoPrefill`, `measureBoardInset`, `useHeaderHeight`, `styles/motion.css`, the `data-askboard-*` hooks and harness locators, `bar.submitName`, `bar.submitPlain`, `bar.allReady`, `header.openPostponed`, `question.edit`, the ladder icons. Requirements modified by both: "Single-question board", "One question per view", "Outline navigator", "Counts and the next-open jump", "Delivery mode", "Submit", "Undo of a prefill" (its ADDED), "Focus moves clear the sticky bars", "Status messages for the answering flow": this delta copies change 4's text at dd2c23e4 and changes only what D1 to D14 say (task 0.2 compared them). "Undo of a prefill" is not on `main`'s specs until change 4 is archived, so `validate --strict` reports, as information, that archive would refuse it now. Files: every shell file above, `strings/*`, `suites.ts`, EXPERIENCE.md, DESIGN.md, the help template, `chunk-sizes.json`; its sticky tab strip's `top` (D2's variable) | Change 4 merges first, by squash. Groups 1 and 2 run on its head now; group 3 and later need its groups 6 to 10 (the tab strip, the completion panel, the prefill result, the ladder icons, motion), so the coordinator rebases this branch onto its later head, or onto `origin/main` once it merges, before group 3, comparing the nine requirements again and re-applying this change's edits through `/openspec-update-change` where they differ. Task 10.1 rebases with `git rebase --onto origin/main <guidance SHA>`. Change 4's board-protocol minor is main's when this change binds its own (next minor after it). Archive order: change 4, then this change |
| `board-keys` (#187, merged as #225 8fe036d0, archived 46d3dcf7) | Borrowed: `useBoardKeyTable`, `BOARD_KEYS` (`board.nextOpen`, `board.answer`), `KeyHint` around the jump and the primary, the Keys button `BoardKeysButton` (`keys.button`) with `useBoardPanel` and `BoardKeysPanelBody`, `answerKeyOf`, `data-askboard-primary`. Its ADDED requirements are not modified here: "The board's keys panel" says the header shows "Keys", which the ask row keeps, by that name | Merged and archived. The Keys button moves into the ask row as an icon with its name and tooltip; its panel's anchor follows. EXPERIENCE.md's Accessibility Floor and the Context header row: keep its sentences, add this change's |
| `icon-set` (#210, merged, archived 8618edae) | `@askboard/view/icons` and its `icons` chunk, the Lucide import rule, `glyphs.test.ts`, the "every icon used" test, DESIGN.md's Icons section, `IconNextOpen`, `IconClose`, `IconReplies`, `IconAgentChanged` | Merged and archived. D15's exports are appended lines; the `icons` size is re-recorded with the shell's |
| `palettes` (#189, change 7; worktree `worktree-feature-palettes` created at 46d3dcf7 on 2026-11-16, nothing proposed yet) | The Theme popover (its Palette row), DESIGN.md's colour roles, `styles/state.css` | Comes with or after this change. This change uses role tokens only and adds no hex; `success-foreground` (settling point 1) stays unused |
| `early-benchmark` | none (`packages/bench`) | none |

Borrowed from `main` (task 0.2 records file and line; all present on the base dd2c23e4): `askPillOf` and `postponedWarningOf` (`board-view.ts`), `endedOf`, `Outline` and `QuestionNavigator` (`navigators.tsx`), `BoardHeader`, `QuickToggles`, `SnapshotButton` and `SnapshotFeedback`, `WhoAndWhere`, `AgentPill`, `Segmented` and `segmentAfterKey`, `createAttention`, `BoardDraftState`, `createBoardDraft`, `draftRecordOf`, `restoreDraft`, `snapshotOfferOf`, `IN_VIEW_ATTRIBUTE`, `ViewOpenSettings`, `ReferenceInset`, `INSET_MAX`, `hintOf`, `KEY_CAP`, `MenuKeys`, `draftRecordProblems`, `DraftRecord`, `BOARD_PROTOCOL_VERSION`, `BROWSER_FILES`, `STRING_KEYS`, the token `outline-rail`.

## Needs probe

None about Claude Code's run time: no mod, hook, agent or permission behaviour is assumed. Browser and library behaviour checked in group 0 before anything relies on it:

- **P1** The rail's longest labels ("Consegnate", "Tutte insieme", "Invia 3 risposte", their English forms) inside 256 px with Inter and with the macOS system stack, in Chromium, compact and comfortable (D16; PO's decision on #227, 2026-11-16).
- **P2** `scroll-padding-top` on the view's scrolling element keeps a control reached with Tab clear of a sticky header in Chromium and WebKit, the engines whose answer D12 needs (#227).
- **P3** Every Lucide name of D15 exists in the pinned `lucide-react` tarball.

## Risks / Trade-offs

- [The layout moves under almost every browser test] → change 4's stable hooks find the controls wherever they sit; task 3.1 adds locators for the new parts (`askRow`, `outbox`, `ledger(cell)`, `strip(questionId)`, `tray(kind)`, `edit`) and sweeps the files that find the bar, the toggles or the markers by place.
- [Linux system fonts are wider than macOS's, so 256 px may clip a ledger label in CI] → the fit test fails rather than clipping silently, and the width goes back to the PO (D16).
- [The tray covers the content's top right] → it reserves the top inset while it shows, holds at most three messages, and each has a close control.
- [The answered look hides the primary] → "Edit" stands where the primary was, the options stay live, and the receipt's state is in the badge and the stripe.
- [A record mirrored during the agent's removal names a removed question] → refused like a stale `questions` key; the next mirror heals it; a unit test covers the order.
- [Three header rows] → 32 px more header, 48 px less bar: the content gains 16 px at the 1280×800 floor.
- [Shell chunk growth] → the bar's module goes (about −5 KB); the ask row, the rail, the outbox and ledger, the strip, the numbers, the tray, the Theme popover and about 30 strings add about 13 to 19 KB: net +8 to 14 KB over the shell's record at the rebased base (about 250 to 255 KB after changes 4 and 5, a margin of about 25 KB). Task 9.4 records the sizes once and stops the group above +16,000 B. The `icons` chunk grows about 6 KB; the board page under 1 KB (the record's generated validator).
- [The shell chunk grows about 17,000 B over change 4's 260,749 B record, measured 16,750 B] → the outbox ledger, the progress strip, the completion panel and the tray live in the shell chunk; splitting them out is a later performance change, and the coordinator accepted the measured size (PO: "yolo, mi fido delle tue decisioni").
- [Snapshot weight] → the `icons` chunk's growth, about 6 KB per Snapshot.

## Migration Plan

A record of the previous minor has no numbers: the board numbers its questions in board order at the next load and mirrors them from then on. A board open during an upgrade picks up the new view at its next load. Rollback: revert the merge commit; a record holding numbers is then refused by the older minor's schema only if the older session process reads it, which a rollback of the whole product does not do mid-session.

## Open Questions

None for the PO: every point the change depends on is decided (#168 comments 6896151386 and 6896178334, #213, 2026-11-15).

Conflicts between sources, settled by the precedence (specs and UX documents over drafts and mockups):

- The mockup omits row 1 (who asked and where): kept (FR-24; D1).
- The settling says the product bundles Inter: it does not (D-4); measured with Inter, shipped as today (D16).
- The settling keeps declines out of the ledger: counted as sent, as change 4's completion line does (D4).
- The mockup hides the open prompt behind "+ Nota per l'agente" and cuts option descriptions to one line: neither adopted (spec "Open prompt", AD-8; D7).
- The mockup shows "Nessuna risposta pronta" in place of a disabled Send: change 4's "Submit" stands (disabled while nothing is held).
- The mockup's toasts time out after 12 s: the tray has no timer (WCAG 2.2 SC 2.2.1; D11).

Defaults this change takes, which change what the user sees; the PO may veto them on #168 before group 3 (posted as comment 6896538577; none vetoed when task 0.1 read #168 on 2026-11-16):

1. D-4 stays out of this change (D16).
2. Theme and density move into a "Theme" popover in the ask row (D1), as drawn.
3. Declines count in the ledger's Sent (D4).
4. "Continue" shows no key cap (D10).
5. An opened Snapshot shows no short numbers (D6).
6. The ask pill takes icons in place of its CSS markers (D14).
