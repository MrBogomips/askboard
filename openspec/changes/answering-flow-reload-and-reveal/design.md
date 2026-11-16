# Design

## Context

See proposal.md, Why. Base: `origin/main` 40870f0f. The later 706b4944 changes only `openspec/config.yaml`.

**The restore (#250).** The board page mirrors the view's draft record to `board-host` 300 ms after the last change (`DRAFT_DEBOUNCE_MS`, `board-page/draft-mirror.ts`). It also flushes the record at `pagehide` and when the page is hidden, and sends it again on each new socket. On a reload or a takeover, `board-host` hands the record back, and `restoreDraft` (`shell/board-draft.ts`) puts it into the stores. `answerStateOf` (`shell/answer-state.ts`) shows an answered question as `draft` while it holds answer work, and as its logged receipt otherwise. `restoreDraft` already drops a "stale answer" through `isRestoredAnswer`: a record whose work equals the logged answer at the same revision. That check dates from `ask-lifecycle` (#13), before widget answers existed. It returns false as soon as the record holds a value for any item other than the question's own option labels, so a widget question's mirrored answer is never seen as stale.

**The move (#259).** `revealAndFocus(..., { smooth: true })` (`shell/reveal.ts`) runs `scrollFrames` with `requestAnimationFrame`, `SCROLL_MS` long. Each frame compares `scrollY` with the position the move last set. A difference over 2 px is read as the user's scroll: the move stops, and its landing (`land`, at `MOVE_DEADLINE_MS`) is skipped. `answer-moves-to-top` added `overflow-anchor: none` during the move, because Chromium's scroll anchoring was read the same way. Earlier work on WebKit's smooth scroll: #241 and #242 (the end of a smooth scroll is not reliably signalled in Firefox and WebKit), and the test helper `standingStill` (`answering-flow-advance.browser.ts`, #260's commit 687d441b).

ADs relied on: AD-1 (no import crosses a boundary: both fixes stay in `packages/view/src/shell`), AD-8 (the view's own script, in its sandbox), AD-10 (fail closed: the restore drops only work identical to what was logged), AD-20 (the draft record). No contract, schema set or `*_VERSION` moves, so `askboard-contract-versioning` does not apply. No widget key changes: the move's input watch reads key events without binding any key, so there is no key table and `keys-coverage.test.ts` is untouched. No Claude Code run-time behaviour is assumed.

### Diagnosis of #250

The cause is a product defect, not a wrong test expectation.

1. **CI.** The test fails in Firefox in each of the last three trains, every time at `widget-answered.browser.ts:93`, waiting for `[data-askboard-receipt="sent"]` to be visible:
   - run 43875473595, `fix-advance-webkit`;
   - run 43900156208, `fix-tree-undo`;
   - run 43907191723, `feature-accept-as-sent`.

   It failed in WebKit in run 43849966130 (`main` 4cb3ac57), in the full pass and on its rerun alone. In the same run it was flaky in Chromium. Locally on macOS, the file passes in Firefox and WebKit four runs out of four, one at a time.
2. **Under load.** A temporary probe of the same steps, ten copies at once in Firefox, failed 2 times out of 10. After the reload the card had `data-askboard-stripe="draft"`, `data-askboard-logged-receipt="sent"` and no `data-askboard-answered`: the board state said "answered, sent", and the restored draft made the card a revision. The socket frames of a failing run:
   - the view sent `act` (the answer with the renamed Tree);
   - `board-host` replied `done`, then `state` with the question answered;
   - only then did the board page send a `draft` record that still held the renamed Tree. The debounce of the edit fired between the act and the moment the view cleared the carried work.
   - The reload then came before the clearing record went out, and `board-host` restored the record with the Tree.
3. **Deterministic.** The probe was changed to wait 800 ms after the rename, so that the mirror holds the renamed Tree before "Answer", and then to reload as soon as the receipt read "sent":
   - Firefox: 3 out of 3 fail, each with `board-host` restoring the Tree record. On reload Firefox never sends the clearing record that `pagehide` flushes.
   - WebKit and Chromium: 3 out of 3 pass. Their `pagehide` flush delivers the clearing record.
   - With `isRestoredAnswer` temporarily extended to compare widget values (D1), the same probe passes 3 out of 3 in Firefox with the Tree record restored, and 24 out of 24 under load.

   The probe and the patch were removed.

So any timing that leaves the sent widget values in `board-host`'s record turns the answered card into a draft after a reload: a slow runner, or Firefox losing the `pagehide` flush. The spec already promises the logged value and the receipt after a reload ("Answered widget questions"), so the product is fixed and the test stays as it is.

### Evidence for #259

On macOS the browsers' own focus scroll is instant: sampled every 16 ms after `.focus()`, `scrollY` stayed at 1800 in all three engines. That is why #259 shows only on the Linux runner. A scroll the page starts itself reproduces it: `scrollTo(y - 600, instant)`, then `scrollTo(y, smooth)`, then Enter 20 ms later, in "Go to the next, in sections":
- On `main`: Firefox and WebKit fail 2 out of 2 ("q4 card 8 px under the bar"), Chromium passes.
- With a prototype of D2 (input-attributed scroll with re-planning): the case passes 2 out of 2 in all three engines.
- The whole `answering-flow-advance.browser.ts` (32 cases) passes in all three engines once D2 also counts a focus moved off the target as the user's. Without that, "postponed questions last" failed in Chromium, because a focus the test moved during the move was re-planned over.

The prototype was removed.

### Changes in flight and merge points

- `early-benchmark` (`openspec list`, 18/22): bench tooling, no file in common.
- No open pull request. `worktree-ui-ux-review` (046d1e33) holds only `drafts/ux-review-168/`. Changes that grow from it for #168 may touch `reveal.ts` or the card. M1: whichever merges second rebases and re-runs `reveal-smooth.test.ts`.
- Borrowed names, all on `main` (task 0.1 re-checks them):
  - `shell/board-draft.ts`: `restoreDraft`, `isRestoredAnswer`, `sameJson`;
  - `shell/reveal.ts`: `revealAndFocus`, `scrollFrames`, `SCROLL_MS`, `FRAME_MS`, `MOVE_DEADLINE_MS`, `land`;
  - `board-page/draft-mirror.ts`: `DRAFT_DEBOUNCE_MS`;
  - test helpers `mirrored`, `sentDrafts`, `openBoard`, `lifecycleScenario` (`harness/lifecycle-test.ts`) and `reloadBoard` (`harness/board-test.ts`);
  - in `answering-flow-advance.browser.ts`: `answerWithKeys`, `standingStill`, `openTall`, `expectCardUnderHeader`, `arrivedAt`;
  - the fixture `planAsk`; the hooks `data-askboard-receipt`, `data-askboard-stripe`, `data-askboard-logged-receipt`.

## Goals / Non-Goals

**Goals:**
- An answered widget question comes back answered, with its receipt, after any reload or takeover, whatever the mirror's timing.
- The move lands where it was asked to whenever only the browser moved the page during it, and still never fights the user.

**Non-Goals:**
- Firefox losing the `pagehide` flush (Open Questions, 1). This change makes the restore right whatever the mirror holds. The lost flush is a separate defect.
- No change to when the mirror sends, to `board-host`, or to the board protocol.
- The test helper `standingStill` stays (D5).

## Decisions

**D1. The stale-answer check compares widget values too (#250).** `isRestoredAnswer` splits the record's `values` into the question's own entry (the option labels, checked as today) and the rest. The rest must equal the logged answer's `values` by `sameJson` (deep, own keys, order-free). The other comparisons are unchanged: results, "Other…", note, option notes, no entries, no cell entries, same revision, a held act matching the logged one. A record whose values hold a key the answer lacks, or a different value, is not stale and is restored as before. The answer is built from the draft by `draftAnswerOf` (`question-state.ts`), the value items' values as they are, so a record mirrored before the answer carries exactly the answer's `values`.
- *Alternative: `board-host` drops a question's work from its record when it logs the answer.* Rejected. In the failing frames the stale record arrives after the log, so `board-host` would have to compare content too. It is also a server and protocol change for a view rule.
- *Alternative: order the mirror (flush before the act, or on settle).* Rejected as the fix. The record can still be stale through a lost flush (Firefox) or a crash. The restore is the one place that sees both the record and the state.
- *Alternative: change the test.* Rejected. "Answered widget questions" promises the receipt after a reload.
- NFR-10 holds: the check drops only work identical to what the agent already has. It never sends anything.

**D2. The user's scroll is told by the user's input (#259).** While a smooth move runs, it listens on the view's window, in the capture phase and passive, to:
- `wheel`, `touchstart` and `pointerdown`;
- `keydown` of a key that scrolls or moves focus: ArrowUp, ArrowDown, PageUp, PageDown, Home, End, Space and Tab.

It removes these listeners when it ends. The watch runs on every move that has a landing: the smooth ones, and the instant ones that pass `resolve`. A wheel, a touch or a listed key (Tab included; Enter is not listed) halts the move at its next frame, where it is, with no landing, whether or not the page has moved yet. The engine applies that scroll after the event, and a frame's own `scrollTo` in between aborts it (found in Firefox and WebKit). A pointer press, or focus leaving the move's target (the document's `activeElement`), ends the move only once the page has moved: at a frame or at the deadline, a position more than 2 px off the move's last one is then the user's, the move stops as today, and the landing is skipped. A press alone does not halt it, because a click on a control does not scroll.

Any other drift is the browser's. The move then plans again: new frames from the current position to the target measured now (the same `deltaFor`), over the time left of `SCROLL_MS`, at least one frame. The deadline and `land` are unchanged, and `land` uses the same test. A `keydown` with `repeat` set does not count: a key held since before the move (Space or Enter on the primary) is not new input, and a key pressed during the move gives its first, non-repeated `keydown`.

Only documented APIs: `addEventListener` with `{ capture, passive }`, `WheelEvent`, `TouchEvent`, `PointerEvent`, `KeyboardEvent.key`, `Document.activeElement`, `scrollTo`.
- *Alternative: end the running scroll first with `scrollTo(current, instant)`.* It was tried on #259 and broke "Within a tab" in WebKit: the position jumped before the first frame. No documented API says whether a smooth scroll is running.
- *Alternative: wait for `scrollend` before the move.* The end is not reliably signalled in Firefox and WebKit (#241), and waiting makes the 250 ms bound depend on the browser.
- *Alternative: a larger drift threshold.* Rejected: the drift seen was 598 px.
- Re-planning instead of ignoring the drift: our first instant `scrollTo` aborts a running smooth scroll (CSSOM View, "perform a scroll"). A browser that does not abort it is still corrected at each frame, and by the landing.

**D3. A pointer press on the scrollbar.** Engines differ on whether a press on the viewport's scrollbar dispatches `pointerdown`. Task 0.2 probes it in each engine. Where none comes, a scrollbar drag that starts within the 282 ms of a move is corrected until the landing. That is the accepted residual (Risks). Nothing in the plan depends on the result: the probe records it in the as-built note.

**D4. The `overflow-anchor` hold stays.** With D2 an anchoring jump would be re-planned rather than end the move. The hold still avoids the jump, so a move needs fewer corrections.

**D5. Tests.**
- **#250, unit (`board-draft.test.ts`).** Restore cases:
  - a widget record equal to the logged answer (no work);
  - one more renamed node (work kept);
  - an extra item value (kept);
  - widget values with an entry (kept);
  - a different revision (kept);
  - the choice-only stale case (unchanged).
- **#250, browser (`widget-answered.browser.ts`).** A case waits with `mirrored` for a record holding the renamed Tree before it presses "Answer", then reloads as soon as the receipt reads "sent". It is deterministic in Firefox, and passes before the fix in Chromium and WebKit, whose flush delivers the clearing record. Its red is therefore seen in a Firefox run of that one file, and its green in Chromium and Firefox. The quarantined test is unchanged, and #250's entry leaves `known-failures.json`.
- **#259, unit (`reveal-smooth.test.ts`).** The stand-in window gains `addEventListener` and `removeEventListener`, and a way to dispatch an event. Cases:
  - a drift with no input re-plans and lands;
  - a drift after `wheel` stops the move;
  - a drift after `keydown` Tab stops it;
  - a drift after focus left stops it;
  - repeated `keydown`s do not count;
  - the listeners are removed at the end.

  "Stops where it is when the user scrolls meanwhile" and "a scroll the user made meanwhile is kept" now dispatch a `wheel` before the drift.
- **#259, browser (`answering-flow-advance.browser.ts`).** A describe "the move and the browser's own scroll":
  - the page starts `scrollTo(y - 600, instant)` and `scrollTo(y, smooth)` before Enter, as in the evidence. Red in a WebKit file run, since Chromium does not show it.
  - a `page.mouse.wheel` right after Enter: the page stays where the wheel put it, with no landing after a second.
  - a focus moved to another heading during the move: the move stops, and that heading has focus.

**D6. Documents.** EXPERIENCE.md, "After an answer": one sentence on what ends the move. The reload paragraph: an answered question comes back answered. The as-built note for this change. `answer-moves-to-top.md` says the move read anchoring as the user's scroll, which remains true of that change, so it is not corrected.

## Risks / Trade-offs

- [A user's scroll with no listed input (a scrollbar drag in an engine without `pointerdown`, find-in-page) is corrected for at most 282 ms, then landed over] → The move is short. Task 0.2's probe could not reach a scrollbar, so which engines are affected is open: Issue #270.
- [A test that scrolls the page by script, standing for the user, is now the browser's scroll and is planned over] → Such scrolls carry the input a person's would: `userScrollBy` (`harness/lifecycle-test.ts`, commit 5b8481e8) dispatches a `wheel` event on the view's window before `scrollBy`. A scripted scroll with no input stays the browser's on purpose, as in the #259 case.
- [Re-planning chases a browser scroll that keeps running past the deadline] → The first instant frame aborts it per CSSOM View. The landing at `MOVE_DEADLINE_MS` puts the card in place. The browser cases check the place one second later.
- [A widget value compared by `sameJson` differs only in a representation (key order, `-0`)] → `sameJson` ignores key order. Any other difference keeps the work, which is the fail-safe side (no work lost).
- [The #250 browser case is red only in Firefox locally] → The unit cases are red in every runtime. The train on the branch runs the case in all three engines.

## Migration Plan

None: no stored format changes. A record mirrored by an older board restores under the new rule.

## Open Questions

1. Firefox drops the board page's `pagehide` flush on reload: `board-host` never gets the record the view sent last. So in Firefox, edits made within 300 ms before a reload are lost. It may explain #145 and #200. It is out of scope here. Filed as Issue #269.
