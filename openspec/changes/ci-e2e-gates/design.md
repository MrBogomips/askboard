# Design

## Context

See proposal.md, Why. Relies on AD-8 (the view's bounded work), AD-19 (the release workflow), NFR-7 (macOS and Linux runners) and NFR-12 (keyboard core). Builds on `e2e-cadence` (`docs/as-built/e2e-cadence.md`): its perf pass (`harness/perf.ts`: `PERF_RUNS`, `perfRuns`, `judgeMedians`, `expectMedianWithin`, `perfLine`), its `browser.yml` (one job per engine and shard, on the caller's runner), and its release gate (`release.yml` `e2e-macos` calls `e2e.yml` with `cadence: weekly`, Chromium and WebKit, C6).

**#196, measured** (runs 43664043978 on Linux and 43664045953 on macOS, `main` at 4c87b920). The table below gives each run's worst ratio of median to bound. All other perf medians (LaTeX, Markdown bounds, Document review cost, the visible and add gates) are at most 0.72 of their bound.

| Runner | Worst | Ratio | Misses |
|---|---|---|---|
| Linux `ubuntu-24.04` | table-bounds worst, edit, WebKit, 148 against 100 | 1.48 | 6 gates, 1.00 to 1.48 |
| macOS `macos-latest` | table-bounds worst, edit, Chromium, 214 against 100 (samples 398, 214, 177) | 2.14 | 9 gates, 1.02 to 2.14 |

The dense-table Markdown case is a known limit that is timed, not bounded (task 5.16 of atoms). On Linux it was ready in 28.7 s in Chromium and 51.9 s in WebKit. On macOS it was ready in 67.8 s in Chromium, and in WebKit it was not ready within the 120 s wait, the page "does not answer (hung)".

**#197, established from sources** (research of 2026-11-15):

- Apple's Safari guide: "Tab also highlights buttons and other controls if Keyboard Navigation is turned on in Keyboard settings" (support.apple.com/guide/safari/cpsh003). Apple's Mac guide: with "Use keyboard navigation to move focus between controls" off, Tab reaches only text boxes and lists (support.apple.com/guide/mac-help/mchlp1399).
- WebKit source (commit 7e454bd3):
  - `EventHandler::tabsToAllFormControls` gates buttons on `KeyboardAccessFull` on Cocoa only; every other port returns true, which is why WebKit passes on Linux.
  - `UIProcess/Cocoa/WKFullKeyboardAccessWatcher.mm` reads the preference `AppleKeyboardUIMode` (bit 1: "controls other than text fields are included in the tab order") the first time it is used. Later changes arrive only by a distributed notification.
  - WebKit's own `WebKitTestRunner` pins the same key.
- Playwright: the maintainers say its WebKit "does the same as Safari on Mac" (microsoft/playwright #41808, #2114) and offer no launch option for it.
- The PO's Mac reads `AppleKeyboardUIMode` = 2, and the local Playwright WebKit's bundle id is `org.webkit.Playwright` (observed 2026-11-15). This explains why the PO's local runs pass.
- Apple documents the setting but not the key or its values.

**#198, observed** (same runs, `browser / Browser tests, chromium, shard 3/4` on Linux and macOS). Case (g) of `reopen-session.browser.ts` (:613, added by `reopen-start-from-answer`, #70) sends one `update` holding a reopen of `plan` and a close, reloads, and expects the Timeline as the agent sent it (`AS_SENT`: lane `web`, start 2026-01-05, no mark). The board showed the reopened answer's move (lane `mobile`, start 2026-01-12, mark `moved`): something filled the draft, and the fill survived the reload. It failed in Chromium on both OSes and in Firefox on Linux, passed in WebKit, failed once locally under load during e2e-cadence's runs, and passes alone. The binding behaviour is the view spec's scenario "A closed ask after a reload" (requirement "A reopened question starts from the previous answer"); the prefill gate `reopenPrefills` fills nothing once `state.ask` is `closed`. Decision 8.

## Goals / Non-Goals

**Goals:**
- The perf jobs pass on the hosted runners on today's code, and still fail on a regression past each runner's factor.
- WebKit's keyboard cases run on macOS as they do on Linux, through the platform's own setting.

**Non-Goals:**
- The other failures of the first runs: Firefox (#174, #145; case (g) in Firefox is in scope only if it shares #198's cause), #191, #199, #200 and #201.
- Faster Table edits or Markdown renders, and new or changed bounds.
- A runner-side check of a developer's Mac: a Mac with keyboard navigation off fails as the runner did, and `CLAUDE.md` names the setting.

## Defaults taken and PO decisions (2026-11-15)

D1 to D3 are the architect's defaults on the coordinator's recommendation. D4 is the PO's answer to Q1 on #197 (option (a), 2026-11-15; `needs-po` removed). #198 joined the change at the PO's request on the same day.

| ID | Default | Reason |
|---|---|---|
| D1 | Scale the bounds on hosted runners (#196's option 1), not "perf informational in CI" (option 3) or a calibration loop (option 2) | Decision 1 |
| D2 | Factor 2 on Linux and 3 on macOS, per runner OS, in one table beside the perf helpers | Decision 2 |
| D3 | The dense Markdown case's wait and test timeout take the same factor | Decision 4 |
| D4 | The macOS runner turns on keyboard navigation with `defaults write -g AppleKeyboardUIMode -int 2` before any browser starts | Decision 5; decided by the PO (Q1 (a)) |

## Decisions

### 1. Scale, not informational

A factor keeps a gate on every runner. On Linux, a regression that doubles the Table edit (120 to 240 ms) fails at 200. With option 3, nothing on CI would catch it, and the release gate would carry no perf check at all. The local rule ("run `bun run test:e2e` before a merge that touches the view") is a habit, not a check. Option 2 measures a JavaScript loop, while the misses are layout and paint. Its ratio would add noise of its own, and it would cost a calibration step and its tests. The trade-off: on macOS a bound of three times the laptop's catches only gross regressions. The nightly Linux run is the sharper tripwire.

### 2. The factor table and how a runner is named

- In `harness/perf.ts`, the table `PERF_RUNNER_FACTORS = { Linux: 2, macOS: 3 }` and a pure `perfFactor(value)`:
  - an absent value (`undefined`) gives 1;
  - a key gives its factor;
  - any other value, including the empty string, throws, naming the value and the keys.
- The module evaluates `PERF_FACTOR = perfFactor(process.env.ASKBOARD_PERF_RUNNER)` at load. A perf file whose runner is unknown therefore fails at import, before it measures anything (spec, "A runner the pass does not know").
- Only `browser.yml` sets the variable, on its test step: `ASKBOARD_PERF_RUNNER: ${{ runner.os }}`. The repository runs on GitHub-hosted runners only (CLAUDE.md, CI), so `runner.os` names a hosted image. A third OS fails the pass instead of passing silently.
- The values come from the worst measured ratio plus headroom: 1.48 to 2 on Linux (35%) and 2.14 to 3 on macOS (40%). One factor per OS rather than per engine or gate, so the table holds two numbers that a later Issue can revisit with figures.
- `expectMedianWithin` gains a last parameter, `factor = PERF_FACTOR`. It judges `median ≤ gate × factor`, or `<` when `below`. `judgeMedians` and `perfRuns` pass it through, so every perf file gets the factor with no edit to its gates.
- `perfLine` keeps today's text when the factor is 1, so local notes stay comparable with e2e-cadence's. Otherwise it appends ` factor f bound b`. The failure message names the bound applied.
- `perfScaled(ms)` returns `ms × PERF_FACTOR` for the waits of decision 4.
- Alternative rejected: a numeric `ASKBOARD_PERF_SCALE` set in the YAML. It would put the numbers in the workflows, away from the gates and their unit tests, and let any caller pick any number.

### 3. What stays

The gates in `table-bounds.browser.ts` (`GATES`, `FAN_OUT_WEBKIT_EDIT_GATE`), `markdown-total.browser.ts` (`BOUND_MS`), `markdown-bounds`, `latex` and `document-review-cost` keep their values. Also unchanged: `PERF_RUNS` (3), the median rule, the serial perf pass and `perf-files.test.ts`'s rule that only perf files time anything.

### 4. The dense Markdown case

`DENSE_WAIT_MS` and `DENSE_TEST_TIMEOUT_MS` go through `perfScaled`: 120 s and 240 s locally, 360 s and 720 s on macOS. The macOS Chromium figure (67.8 s) and the Linux WebKit figure (51.9 s) suggest WebKit on macOS needs about 130 s. Its "hung" report at 120 s may still be a real hang, so the runner run in task 4.1 settles it (Risks).

### 5. Keyboard navigation on the macOS runner (needs probe; Q1 answered (a))

`browser.yml` gets a step "Keyboard navigation on (macOS)" with `if: inputs.code && runner.os == 'macOS'`. It runs after the engine's install and before the browser tests, for every engine, as on a developer's Mac. It runs `defaults write -g AppleKeyboardUIMode -int 2`, then reads the value back and fails unless it is 2. The write comes before any browser starts, since WebKit reads the key once per process. Value 2 sets bit 1 alone, the PO's own value. `-g` is used rather than `org.webkit.Playwright`, because Playwright does not document that bundle id, and the runner is discarded after the job. No `${{ }}` reaches the script.

Alternatives:

- **Option-Tab in WebKit on macOS**, through a harness helper. Apple documents the key, but about thirteen files' key presses would change. Widget handlers would see `altKey`, and the tests would no longer press plain Tab, the key users press.
- **Skip WebKit's keyboard cases on macOS.** This hides NFR-12 coverage on a platform NFR-7 names.
- **`tabindex` on every button.** A product change that overrides a Safari user's own setting.

The key is an OS preference that WebKit's open source reads, not an API that AskBoard's code calls. Apple's documentation names the setting but not the key. Because the PO forbids undocumented APIs, the choice was put to the PO, who chose it (Q1, (a), 2026-11-15).

### 6. Records

- `CLAUDE.md`, CI section: the sentence "Known: `browser.yml` WebKit fails on …" is removed. One sentence states the factor and the variable. One sentence names the macOS step and says a developer's Mac needs System Settings > Keyboard > Keyboard navigation on for WebKit's keyboard cases.
- The spine's Tests row gets one clause: on hosted runners each bound is judged at its value times the runner's factor. The binding text stays in this change's spec.
- `test-harness-patterns.md`'s timed-checks rule names `PERF_FACTOR`, `perfScaled` and the variable.
- `docs/as-built/ci-e2e-gates.md`, with #198's root cause, its evidence and its fix.

### 7. Versions

No contract set is widened, so no version is bound.

### 8. Reopen-session case (g) (#198)

The cause is found by evidence before any fix. Hypotheses, to be confirmed or ruled out in task 2.1:

- **H1, product, ordering.** The page applies the reopen and the close as two states. On the first, the ask is still open, so `prefillReopened` fills the question, and the draft mirror (`DRAFT_DEBOUNCE_MS`) sends the filled work. `board-host` keeps the record, and after the reload it is restored ("A restored draft comes first"). If the record reached `board-host` after the close, keeping it is the fault. Case (g)'s last assertion (nothing mirrored for the question) would fail too, but it runs after the one that failed.
- **H2, product, reload.** After the reload the page runs the prefill before it applies the closed state, so the gate sees an open ask.
- **H3, test.** The case does not establish its premise ("closes the ask before a draft is mirrored"). Under load the mirror goes out before the close lands. The record then predates the close, and the spec's "A restored draft comes first" applies, which is not a fault.

How the fix follows the cause:

- The evidence goes in task 2.1's note: the states the page received, each draft record `board-host` received and its order against the close, and the record restored after the reload.
- **Product cause (H1, H2).** The spec stands. A unit test fails first, in the package where the cause lies (`packages/view` or `packages/server`), reproducing the ordering without a browser or a timer. Then the fix. It fails closed (NFR-10, AD-10): a closed ask is never filled, and its late records are refused. No fill is ever widened.
- **Test cause (H3).** Case (g) establishes its premise deterministically and keeps every assertion. `#198` gets a comment saying so, and its severity drops to L, as the Issue says.
- **A cause that needs the spec changed** stops the group for `/opsx:update`, with a `needs-po` question on #198. An example: the scenario cannot hold for a reopen and a close in one `update`.
- The fix holds under load, not only alone (task 2.2).

## Merge points

None in flight. `openspec list` shows only `early-benchmark`, which is on `main` and touches none of these files. No other feature branch or open pull request exists (checked 2026-11-15, `origin/main` e2cc5fd3, one Dependabot bump of `bun.lock` since the base 16c6d23f).

Borrowed names, all on `origin/main` e2cc5fd3:

- `perf.ts`: `PERF_RUNS` :15, `perfLine` :33, `expectMedianWithin` :40, `judgeMedians` :62, `perfRuns` :84.
- `markdown-total.browser.ts`: `DENSE_WAIT_MS` :30, `DENSE_TEST_TIMEOUT_MS` :31.
- `browser.yml`: steps "Install the engine with its system dependencies" :86 and "Browser tests against the built session process" :104.
- `release.yml`: `e2e-macos` :111.
- `tools/ci/e2e-workflows.test.ts`: `describe("browser.yml …")` :510.
- #198: `reopen-session.browser.ts` case (g) :613; `shell/reopen-prefill.ts` `reopenPrefills` :62, `prefillReopened` :111; `board-page/draft-mirror.ts` `DRAFT_DEBOUNCE_MS` :10; `harness/board-test.ts` `reloadBoard` :110; `harness/lifecycle-test.ts` `sentDrafts` :74; `harness/probes.ts` `quiet` :113; `openspec/specs/view-and-widgets/spec.md` scenario "A closed ask after a reload" :3604.

Task 0.2 re-checks them, and task 4.2 checks them again after the rebase.

## Needs probe

- **P1**: `defaults write -g AppleKeyboardUIMode -int 2` makes headless Playwright WebKit tab to buttons on `macos-latest`.
  - Task 0.3 reproduces it locally: the per-app domain set to 0 overrides the PO's global 2.
  - Task 4.1 confirms it on the runner.
  - Evidence that it works on hosted runners: third-party workflows only (kosolabs/kosui `ci.yml`, ITenthusiasm/custom-elements `playwright.yml`).
- **P2**: the factors pass today's code on both runners. Task 4.1 dispatches the nightly and weekly cadences on the branch.

## Risks / Trade-offs

- **[A gate within 10% of its scaled bound turns flaky]** → The headroom is 35% to 40%. A repeated near miss becomes an Issue with its figures, and the factor table changes only with them.
- **[Regressions under the factor go unseen on CI]** → The bounds are judged unscaled on a developer's machine, and the Linux nightly bound is the tighter one.
- **[WebKit's dense case on macOS is a real hang]** → If task 4.1 sees "not ready" at 360 s, it files an Issue (`source:e2e`, `area:widgets`) with the figures. The case keeps failing, and the PO decides on that Issue. Nothing else in this change waits for it.
- **[The key is renamed or dropped in a later macOS or WebKit]** → The step's read-back still passes, but the keyboard cases fail again on the runner. They are the alarm, and #197 then reopens as a regression Issue.
- **[#198 does not reproduce locally]** → Task 2.1 adds load: the whole parallel set, and Chromium's CPU throttling. If it still passes, task 2.1 runs the case on the runner through a dispatch on the branch, with the evidence logged. Group 2 does not guess a fix.
- **[#198's fix hides a real fault behind a wait]** → No assertion is weakened, and no fixed wait is added (`quiet-guard.ts`). Task 2.3's review checks both.
- **[A developer's Mac has keyboard navigation off]** → The local WebKit keyboard cases fail with "never reached Answer". `CLAUDE.md` names the setting.

## Migration Plan

Merging is enough. Rollback: revert the commit. Locally nothing changes unless `ASKBOARD_PERF_RUNNER` is set.

## Open Questions

- **Q1 (PO, on #197, `needs-po`)**: may the macOS runner turn on keyboard navigation through the preference key `AppleKeyboardUIMode`, which Apple's documentation does not name but WebKit's source reads?
  - Options:
    - (a) Yes: decision 5.
    - (b) No, use Option-Tab in WebKit on macOS through a harness helper.
    - (c) No, leave WebKit's keyboard cases out of the macOS gate, tracked by #197.
  - Proposed default: (a). It is runner configuration, not a dependency API AskBoard's code calls. Apple documents the setting it stands for, and WebKit's own test runner pins the key. (b) changes what about thirteen files test, and (c) hides NFR-12 coverage.
  - **Answer (2026-11-15): (a)**, from the PO on #197: the macOS runner sets `AppleKeyboardUIMode` to 2 with `defaults write` and reads it back before WebKit runs. `needs-po` is removed. Task 0.1 records it.
- **Source conflict on #198, resolved by precedence.** The Issue's Expected says the reload shows "the question as the user sent it (the first answer)". The spec ("the draft is not filled") and the test (`AS_SENT`, the agent's version) say otherwise. The spec wins, and the Issue's wording is corrected in task 2.1's comment on #198.
