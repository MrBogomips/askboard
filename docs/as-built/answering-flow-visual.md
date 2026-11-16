# As built: `answering-flow-visual`

In code since `answering-flow-visual` (Issues #168 and #213, direction B of the UX review): the board's frame is three header rows, a 256 px rail with the outline over the outbox, a feedback tray and no bottom bar; the progress strip, the outbox ledger, short question numbers, the card's head, badge, stripe and answered look, key caps in the main buttons, the ask pill's records and a compact density. The board protocol is widened by one minor (the draft record's `numbers` and `nextNumber`); the version is bound at task 10.1: <to be bound at 10.1>.

**Where the code lives.** All in `packages/view/src/shell/` unless said.
- The frame: `board-header.tsx` (three rows, `shadow-sm`), `ask-row.tsx` (title, ID, the ask pill, the agent pill, the postponed warning, the tools), `theme-control.tsx` (the Theme popover holding `QuickToggles`), `progress-row.tsx` (count, "Next to do", "Prefill recommended", unread, agent change), `progress-strip.tsx`, `rail.tsx`, `outbox.tsx` (from `bottom-bar.tsx`, deleted) with `ledger-cells.tsx`, `feedback-tray.tsx`, `snapshot-button.tsx` (`SnapshotOutcome` for the tray), `button-keys.tsx`, `use-scroll-padding.ts`.
- The card: `card-head.tsx` (number, chip, state badge, "More"), `question-actions.tsx` (the primary first, "Later" last, the answered look with `answer.line` and "Edit"), `question-footer.tsx` (toned, with the number and "Edit"), `styles/state.css` (the stripe, keyed on `data-askboard-stripe`), `catalog/choice/option-text.tsx` (inline descriptions).
- Pure units, each with a test: `ledger.ts` (`ledgerOf`), `progress-strip-model.ts` (`stripOf`, `stripScrollLeft`), `question-numbers.ts` (`numbersOf`), `removed-numbers.ts`, `outbox-line.ts` (`outboxLineOf`), `answered-look.ts` (`answeredLookOf`, `answerLineOf`), `feedback-tray-store.ts` (`createTray`, `goTargetOf`), `reason.ts` (`nothingChosenOf`), `board-view.ts` (`askPillIconOf`).
- Contract and records: `draft-record.json` (`numbers`, `nextNumber`), `QUESTION_NUMBER_MAX` (9,999), `draftRecordProblems`; the spine's AD-20; `BoardDraftState.numbers` and `nextNumber` with `setNumbers`, `draftRecordOf`, `restoreDraft`.
- Insets and the view protocol: `inset.ts` and `measure-inset.ts` (no footer, `TRAY`), `open-settings` carries `inset`, `board-page/settings-panel.ts` places the sheet at it.
- Tokens: `tools/build/tokens.ts` emits `--outline-rail` (`FIXED_SPACING`); DESIGN.md's YAML has the 256 px rail, the 15 and 17 px question and the `outbox`, `ledger`, `progress-strip`, `feedback-tray` and `state-stripe` components.

**Names and seams.**
- `--askboard-header-height`, set once on the board's root from `useHeaderHeight`: the rail's `top` and height and the tray's `top` read it.
- The test hooks and locators (`harness/dom.ts`): `askRow`, `progressRow`, `rail`, `outbox`, `ledger(cell)`, `strip(id)`, `tray(kind)`, `edit(id)`, `themeControl`; `barButton` searches the header and the outbox; `moreOf`, `labelText` and `viewportBottom` in `harness/lifecycle-test.ts`. Hooks on the page: `data-askboard-ask-row`, `-progress-row`, `-rail`, `-outbox`, `-ledger`, `-strip`, `-progress-strip`, `-tray` (message) and `-tray-box` (the column), `-edit`, `-card-head`, `-number`, `-stripe`, `-answered`, `-answer-line`, `-outline-removed`, `-theme`, `-warning`, `-ask-id`.
- The Tab rule: `scroll-padding-top` follows the top inset only while Tab is down; always on, it made an automated click on a sticky header control scroll the page. `revealAndFocus` settles at the end of a smooth move.
- The tray's Snapshot message keeps a live region (its words are not strings of the status region); the added kind comes from `applyDocumentUpdate`, and ends on `attention.unseen`.
- `answered = answeredLookOf(mark, revising && mark !== "ready")`: `questionRevising` is true for a held ready answer, which looks answered.

**Change 4's parts.** Built on `answering-flow-guidance`'s head b7da3fea: the ladder's icons (the strip, the badge and the outline draw `QuestionMarker`'s icons), the prefill result's "Undo" (a button of the tray's prefill message, `data-askboard-undo`, which takes focus; "Prefill recommended ({count})" is in the progress row), the completion panel in the main content (the outbox's line says "All ready" with `data-askboard-all-ready`) and the reduced-motion rule, which covers the ledger's pulse.

**Corrections.** `answering-flow-fixes.md`'s sentence on the bars (the bottom bar was one) is corrected.

**Sizes** (`packages/view/chunk-sizes.json`, bytes). On change 4's head b7da3fea: shell 260,749, `icons` 8,837, `board-page` 1,045,253. Now: shell 277,499 (+16,750, within the 17,000 B bound accepted at the re-base), `icons` 13,513 (+4,676), `board-page` 1,051,016 (+5,763).

**Deviations from the design.** The stripe's attribute is `data-askboard-stripe` (the badge keeps `data-askboard-state`, which twenty tests count); the Tab rule above; the Snapshot message's live region; "Next to do" is absent, not disabled, with nothing to do (D1); a Draft revision shows no receipt (change 4's rule, which the scenario now follows); "Prefill recommended ({count})" is `bar.selectRecommended`, change 4's string.

**Decisions at the re-base.** `IconNextOpen` stays `arrow-right` (change 4's); a revision reads Draft with no receipt, as in change 4. Sizes on b7da3fea: shell +16,750, accepted up to 17,000.
