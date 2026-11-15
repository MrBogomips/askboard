# Proposal

## Why

Issue: #196
Issue: #197
Issue: #198

`e2e-cadence` put the browser and conformance suites on a cadence, and a release's `publish` now waits for the weekly macOS run (`e2e-macos`). The first nightly (Linux) and weekly (macOS) runs on `main` at 4c87b920 are red with no product defect identified: every perf job misses gates measured on a 14-core laptop by 1% to 114%, and one Markdown case times out at its 120 s wait (#196); 17 keyboard cases fail in WebKit on the macOS runner because Tab never reaches a button (#197); and `reopen-session.browser.ts` case (g) fails in Chromium on both runners, showing the reopened answer's Timeline move on a closed ask after a reload (#198; it also failed once locally under load and passes alone). So no release can pass, and a red scheduled run hides real regressions (NFR-7, NFR-12, AD-8).

## What Changes

The PO approved the change and asked for speed. D1 to D3 are defaults recorded in design.md; D4 is the PO's answer to Q1 (2026-11-15). The PO added #198 to the change on 2026-11-15.

- **Perf bounds scaled on GitHub-hosted runners** (#196; D1, D2). The perf pass still judges every bound on the median of three runs. On a GitHub-hosted runner each bound is multiplied by that runner's factor: 2 on Linux and 3 on macOS, from the misses measured on the first runs (worst 1.48 on Linux and 2.14 on macOS) with about 35% to 40% headroom. Only the workflows name the runner, through one environment variable. Locally, the variable is absent and the bounds are as the spec states them. An unknown runner name fails the pass and does not fall back to a factor. Every judged line prints the stated bound, the factor and the bound it applied. The Markdown dense-table case, a known limit that is timed and not bounded, gets the same factor on its wait and its test timeout (D3).
- **Keyboard navigation on for the macOS runner** (#197; D4). Before any browser starts on a macOS runner, `browser.yml` turns on the system's keyboard navigation, the setting a developer's Mac has and the runner image lacks. WebKit's keyboard cases then test the same Tab order as on Linux. No test is skipped or rewritten. Apple documents the setting but not the preference key that turns it on from a script; the PO chose the key on #197 (Q1, option (a), 2026-11-15). The mechanism is reproduced locally in group 0 and confirmed on the runner in the last group.
- **Reopen-session case (g)** (#198; decision 8). The failure is reproduced under load, its root cause found (the test, or the product breaking the closed-ask scenario of "A reopened question starts from the previous answer"), and fixed tests first. The behaviour is already specified, so no requirement changes.
- **Records.** `CLAUDE.md` loses the sentence "Known: `browser.yml` WebKit fails on …", and its CI section states the scale and the macOS step. The spine's Tests row gets one clause on the scale. The harness skill's timed-checks rule names the scale. `docs/as-built/ci-e2e-gates.md` is added, with #198's root cause.
- **Out of scope.** Firefox's failures (#174, #145; the release gate still leaves Firefox out, as C6 of `e2e-cadence` says), except case (g) in Firefox if #198's cause is shared. A faster product path for the Table edit or the Markdown total: the scale admits no regression the stated bound would catch locally.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: the requirement "Timed bounds judged in the perf pass" states the runner factor on GitHub-hosted runners. A new requirement makes the keyboard cases run with the platform's keyboard navigation on.

## Impact

- `packages/view/test/browser/harness/perf.ts` (the factor, read from the environment), its unit test `perf.test.ts`, and `markdown-total.browser.ts` (the dense case's wait). The gates in `table-bounds.browser.ts` and the other perf files are unchanged.
- `.github/workflows/browser.yml`: the runner variable on the test step, and a macOS WebKit step that turns on keyboard navigation. Tested in `tools/ci/e2e-workflows.test.ts`.
- `packages/view/test/browser/reopen-session.browser.ts` case (g), and, if the cause is in the product, the module that holds it (the view's reopen prefill, the board page's draft mirror or `board-host`'s draft records) with its unit test (#198).
- Documents: `CLAUDE.md` (CI section), the spine's Tests row, `.claude/skills/askboard-implementation/references/test-harness-patterns.md`, `docs/as-built/ci-e2e-gates.md`.
- No contract set widened and no dependency added; product code changes only if #198's cause is in the product. Platforms: macOS and Linux CI runners (NFR-7); a developer's machine is unchanged.
