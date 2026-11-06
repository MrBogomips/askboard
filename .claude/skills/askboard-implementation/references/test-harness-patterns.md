# Test harness patterns

Each rule says why and which PR taught it. Paths are relative to the repository root. Read a helper before writing a new one: most needs are already met.

## Unit tests (`bun test`: `*.test.ts` and `packages/<name>/test/`)

- **Bound by outcome, not by a tight clock.** A bound that holds on a laptop fails on a loaded CI runner. d36b1ebe raised a pre-connect refusal bound from 100 ms to 2 s: the refusal takes about 25 ms, the regression it guards took over 35 s, and the 100 ms bound had failed at 101 and 137 ms. Pick a bound the regression still exceeds by a wide margin and the runner never reaches. Use the injected `Clock` port (`packages/core/src/ports.ts`) for time logic; do not sleep.
- **Wait for the condition, not for a delay.** Poll a named condition with a timeout (`eventually` in `packages/view/test/browser/harness/board-test.ts`). #31 waited for the `.gitignore` content before reading it (2f9ea069) and for the settings messages before asserting on them.
- **Scope every process or file lookup to your own children and temp folders.** #14: a machine-wide `pgrep -f` matched other worktrees' suites and failed `bun run check` at random. Use `packages/bench/test/support/processes.ts` (`pgrep -P <parent> -f`; a `pgrep` error throws). Start a decoy with the same command line and prove the check ignores it; assert exactly one match was found, so a check cannot pass by looking at nothing.
- **Isolate from the developer's environment.** #31 (eee4c9ad): the session process read the developer's real `HOME`, `XDG_CONFIG_HOME` and project. Tests give the process its own `HOME`, `XDG_CONFIG_HOME`, `XDG_RUNTIME_DIR` (a short path: Unix socket paths have a length limit; conformance has `shortFolder()` in `packages/server/test/conformance/modes.ts`), `TMPDIR` and `CLAUDE_PROJECT_DIR`. #33: the browser harness now always sets `CLAUDE_PROJECT_DIR`; a test that needs a session outside a project passes the `withoutProject` scenario option. Never read the real home or the real project in a test.
- **Validate before `toMatchObject`** (Bun 1.4.4 mutates the checked object with `expect.any` matchers).
- **Test the refusal, not only the success.** For answers, epochs and revisions, assert the failing case appends nothing (NFR-10).
- **A test that pinned an old state is updated to state the new one.** Never delete or weaken an assertion to pass; say so in the report.

## Browser tests (`packages/view/test/browser/*.browser.ts`)

Run with `bun packages/view/test/browser/run.ts` (flags in the file's header; `bun run test:e2e` after a build). `bun run test` never runs them. Each `*.browser.ts` file runs once per engine, the engines in parallel, each in its own process; `ASKBOARD_E2E_ENGINES` names the engine. Needs `node_modules/.bin/playwright install chromium firefox webkit`.

### Helpers to use
- Board and locators: `harness/dom.ts` (`boardOf`, `Board`, `VIEW_FRAME`: the view lives in a sandboxed iframe, so every locator goes through it); `harness/lifecycle-test.ts` (`lifecycleScenario`, `openBoard`, `card`, `optionOf`, `answerOf`, `noteOf`, `buttonOf`, `barButton`, `tabTo`, `sentActs`, `actsSent`, `actsDone`); `harness/board-test.ts` (`useEngine`, `waitForQuestion`, `eventually`, `answerWith`, `expectNoCspProblem`, `expectNoReconnect`, and the timeouts `STEP_TIMEOUT_MS`, `LOAD_TIMEOUT_MS`, `RECONNECT_TIMEOUT_MS`).
- The agent's side after a user's act: `actsApplied(run, n)` (`board-test.ts`) or `actsDone` (`lifecycle-test.ts`). A card shows "sent" once the page has sent the act, before board-host applies it, so collecting, replying or updating on that receipt races. #25: on slow CI, WebKit found no follow-up to reply to (lifecycle-acts) and a collect returned nothing (lifecycle-revisions). Wait for board-host's done on the act commands, and await the ws write before the next step in transcript replays.
- Reload: `reloadBoard` (`board-test.ts`) over `harness/reload.ts`. #25: Playwright's Firefox driver sometimes loses the view's iframe after a reload (frame at `about:blank`; about 1 reload in 20 to 60 under CPU load, not a product bug). The helper reloads once more only when the frame is lost, says so, and fails otherwise. Never write a bare reload followed by a view locator.
- Widgets: `harness/widget-board.ts` (`widgetBoardFor`, with the places `widget host` and `session process`), `harness/widget-host-test.ts`, `harness/tree-steps.ts`, `harness/gantt-steps.ts`, `harness/tree-grid.ts`.
- Session and environment: `harness/session-process.ts` (isolated folders; scenario options `files`, `config`, `projectDir`, `withoutProject`), `harness/link-recorder.ts` (`waitForOpened`), `harness/snapshot-file.ts`. #29: await the browser recorder before taking a directory baseline in Snapshot tests.
- A new harness helper gets its unit test beside it (`harness/*.test.ts`); those run in `bun run check`.

### Locators that survive other changes
New UI keeps breaking other changes' tests. Scope to what you mean:
- Count a question's options, not every `radio`: the header gained density and theme toggle radios (#31 d5953a7a; #33: the Closed banner test counted them). Use `optionOf(board, id, label)` or the question card's locator.
- A control that is always rendered can cover a target: the Snapshot control made the single-question bottom bar always render and sticky, and the Gantt helper clicked under it (#29). Scroll the target into view, clear of the sticky bar, in the shared helper, not in one test.
- Prefer role and accessible name over text or position. Agent content is data: do not key a locator to a string the agent chose unless the test wrote it.
- After adding UI, run the browser files of the neighbouring features (header, lifecycle, snapshot, widgets), not only yours. #32 merged with two known failures per engine (Snapshot on the Closed banner; Snapshot without `CLAUDE_PROJECT_DIR`) that E8 caused and #33 fixed.
- Keyboard tests (`board.browser.ts`, `gantt-plan.browser.ts`, `tree-uj2.browser.ts`) press Tab up to ten times to reach a target. Known CI failure: WebKit, "ten presses of Tab never reached Answer". Do not widen the loop or drop the test; report it if you touch focus order.

## Cross-engine notes (found, not designed)

- **Firefox, Shift+Tab with Radix** (#18): Radix's roving focus on the Toggle Group sent Shift+Tab back to the chosen option. The Gantt zoom takes its focus from the model's own toolbar keys, with Radix's turned off.
- **Firefox timing** (#18): a first or cleared Gantt request at the full limits (500 tasks) takes up to 132 ms in Firefox, over the 100 ms aim; the design records it as accepted. Do not assert 100 ms there.
- **Far-future SVG widths** (#18, `gantt-layout.browser.ts`): a chart reaching 9999-12-31 is about 43.7 million px wide; Chromium and WebKit lay it out at 33,554,428 px, Firefox at 17,895,190 px, and Firefox draws no box for the far bar. The test asserts only the designed outcome (field error visible, at most 2,000 axis ticks). Do not assert how an engine clamps.
- **Firefox images and favicon** (#30): Firefox keeps a decoded image by its URL (a revocation shows only on the call), hangs on a refused frame, and requests a favicon in the standalone view. Tests of blob images and of the standalone view account for it.
- **WebKit input methods**: Enter that confirms an input method candidate has `keyCode 229` and is not a commit (Tree editing).
- **WebKit and CSP logs**: WebKit logs some CSP blocks only in the console; `harness/browser.ts` and `harness/policy.ts` count those. Every CSP problem fails a test (`expectNoCspProblem`).
- **WebKit on slow CI** races on anything that reads the agent side right after a user act: see `actsApplied`.
- **WebKit, seen after a scroll** (#13): a reply that landed right after a scroll was counted as seen while its card was out of view. The view now checks the card again before counting it as seen; the test passed 20 of 20 WebKit runs. Visibility logic gets a WebKit run with scrolling, not only Chromium.

## Conformance tests (`packages/server/test/conformance/`)

Run with `bun packages/server/test/conformance/run.ts` (`--runtime node` for Node 24; `--configuration` picks one of AD-1's three: mod and hooks, mod disabled, hooks disabled). Files: `*.e2e.ts` scenarios, `session.ts` (`startSession`, `cleanUp`, isolated `HOME`, `XDG_CONFIG_HOME`, `CLAUDE_PROJECT_DIR`), `modes.ts`, `push-steps.ts`, `real-board.ts`, `board-page.ts` (a scripted board page speaking the protocol).

- **Stand-in mod host**: `mod-host.ts`, `mod-host-api.ts`, `mod-host-band.ts`. It runs the built `hooks/askboard-mod.js` with a real process runner, clock and `http.fetch`; agents, turns, appends, submits and UI calls are recorded. A member of the mod API the host does not implement is reported as a problem, never a silent `undefined`. Add to the host only what the real mod API provides, as read from a probe or a spec. Do not guess Claude Code's runtime values (agent IDs, event order): use recorded probe facts (#24: teammate IDs like `aresearcher-096d99adc3d94b0a`) or stop and ask.
- Every scenario gives the session its own `XDG_RUNTIME_DIR` (`shortFolder()`, `modes.ts`), so socket paths stay short and sessions never meet.
- Hooks run as processes of the built bundle: run `bun run build` first, since a stale `dist/` tests old code.
- Cover the fallbacks (mod off, hooks off), not only the happy configuration.

## When only CI can run an engine

Firefox cannot launch in the local sandbox (#27, #28, #31) and Linux is not covered locally. CI runs the browser and conformance suites only on demand (`workflow_dispatch` of `ci.yml`). So:
1. Run Chromium and WebKit locally and report the counts.
2. Write Firefox-sensitive tests (focus order, image URLs, frame loss, huge SVG layout, first-request timing) by the notes above, without a local run.
3. In the report, under "only CI can verify", list each browser file you touched or added, the engines not run, and the specific Firefox risk you see. The caller ticks the "CI green" task after the run; you do not.
4. Never loosen an assertion to pass on an engine you cannot run, and never skip a test for an engine without a comment naming the engine behaviour.
5. For a CI-only failure, reproduce under CPU load if the engine launches; otherwise report the log and your diagnosis. Do not raise a bound without evidence (d36b1ebe gave measured numbers).
