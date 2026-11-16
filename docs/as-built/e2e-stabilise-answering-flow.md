# As built: `e2e-stabilise-answering-flow`

In code since `e2e-stabilise-answering-flow` (Issues #236, #237, #239, #240, #241, #242, #243): the train's failures after `answering-flow-guidance` and `answering-flow-visual`, one root cause each. Most were tests written for the older frame; two were board defects (the end of a focus move, the question in view). No contract, protocol, key table or chunk boundary changed.

**What was fixed and where.**
- #236: `workOf(drafts)` in `packages/view/test/browser/harness/draft-results.ts` names the questions of the latest mirrored record that hold work; 30 assertions in 12 files read it in place of `run.drafts` equal to `[]`.
- #237 (`harness/dom.ts`, the files that use it): `pickTheme` and `themeRadio` live in the harness, used by `chart-theme`, `chart-snapshot` (the Snapshot page) and `icons`; `languages` measures `progressRow`; `icons` and `table` read a label through `labelText`; `board-keys` builds its Shift expectation from the string catalog; `tabIntoGrid` focuses the Gantt question's heading first.
- #242: `answering-flow-motion` watches the arrival mark with a `MutationObserver` from before the act (`watchArrival`, `arrivalOf`) and asserts its life between 1,000 and 2,000 ms.
- #241 and #242 (WebKit), `shell/reveal.ts`: `revealAndFocus` takes `resolve` and ends every move with a settle at `MOVE_DEADLINE_MS` (282 ms), which focuses the node again when the first was replaced or focus fell to `body`, keeps a user's scroll or focus move, and lands with `scrollTo` where an engine ignored `"instant"`. The heading callers in `board.tsx` and `question-card.tsx` pass `resolve`. `answering-flow-completion` records `focusin` as well as the frame's sample.
- #241's cause, `shell/use-question-in-view.ts`: a `focusin` on a control in no card no longer sets the question in view (design D9).
- #243: no product change; the status reads the removed question's header, "Database", and the test expected "Q1".
- #239: `clipped`, now `harness/fit.ts` (shared with `palettes-fit`), skips inline boxes in the header and the rail.
- #240: `tabIntoTree` focuses the heading; `lifecycle-keyboard` starts its Tab to the delivery switch at the header's Keys button (`tabFromHeader`). `palettes.browser.ts`'s contrast case is skipped in Firefox.
- #238, decided by the PO: `ledger.delivered` in it-IT is "Arrivate" (to review); the rail stays at 256 px; EXPERIENCE.md's outbox ledger row follows.
- Review fixes: every move ends the one before it, and a move clears only its own deadline and frame (`reveal.ts`); `workOf(drafts, since)` counts work in any record from `since` on.

**Causes found.**
- 2.1: no engine skipped its frames. The failing "Next to do" went to q2 because a mouse press focused the button and `focusin` set the question in view to q1 before the click.
- 3.1: after a mouse click on a heading, or a Tab that wraps past the last card, Firefox starts the next Tab at the top of the visible area. The Tab order is the same in both engines.
- 3.3: each ask-row `bdi` is `display: inline` inside a `truncate` pill; Firefox gives it a scroll width, the other engines none.
- Playwright's Firefox gives the emulated contrast to `matchMedia` but dispatches no `change` event to the documents' listeners.

**Names added.** `workOf`, `pickTheme`, `themeRadio`, `clipped` (moved), `watchArrival`, `tabFromHeader`, `MOVE_DEADLINE_MS` and `revealAndFocus`'s `resolve`.

**Sizes.** `shell` 288,175 to 288,857 bytes (+682), recorded in `packages/view/chunk-sizes.json`.
