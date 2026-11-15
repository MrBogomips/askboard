# Proposal

## Why

Issue: #196
Issue: #197

`e2e-cadence` put the browser and conformance suites on a cadence, and a release's `publish` now waits for the weekly macOS run (`e2e-macos`). The first nightly (Linux) and weekly (macOS) runs on `main` at 4c87b920 are red with no product defect identified: every perf job misses gates measured on a 14-core laptop by 1% to 114%, and one Markdown case times out at its 120 s wait (#196); 17 keyboard cases fail in WebKit on the macOS runner because Tab never reaches a button (#197). So no release can pass, and a red scheduled run hides real regressions (NFR-7, NFR-12, AD-8).

## What Changes

The PO approved the change and asked for speed. The defaults it takes are recorded as defaults in design.md (D1 to D4).

- **Perf bounds scaled on GitHub-hosted runners** (#196; D1, D2). The perf pass still judges every bound on the median of three runs. On a GitHub-hosted runner each bound is multiplied by that runner's factor: 2 on Linux and 3 on macOS, from the misses measured on the first runs (worst 1.48 on Linux and 2.14 on macOS) with about 35% to 40% headroom. Only the workflows name the runner, through one environment variable. Locally, the variable is absent and the bounds are as the spec states them. An unknown runner name fails the pass and does not fall back to a factor. Every judged line prints the stated bound, the factor and the bound it applied. The Markdown dense-table case, a known limit that is timed and not bounded, gets the same factor on its wait and its test timeout (D3).
- **Keyboard navigation on for the macOS runner** (#197; D4). Before any browser starts on a macOS runner, `browser.yml` turns on the system's keyboard navigation, the setting a developer's Mac has and the runner image lacks. WebKit's keyboard cases then test the same Tab order as on Linux. No test is skipped or rewritten. Apple documents the setting but not the preference key that turns it on from a script, so the PO is asked on #197 (Q1, with a proposed default). The mechanism is reproduced locally in group 0 and confirmed on the runner in the last group.
- **Records.** `CLAUDE.md` loses the sentence "Known: `browser.yml` WebKit fails on …", and its CI section states the scale and the macOS step. The spine's Tests row gets one clause on the scale. The harness skill's timed-checks rule names the scale. `docs/as-built/ci-e2e-gates.md` is added.
- **Out of scope.** Firefox's macOS failures (#174, #145; the release gate still leaves Firefox out, as C6 of `e2e-cadence` says). A Chromium failure on the macOS runner in `reopen-session.browser.ts` (g), which no Issue tracks yet (see design.md, Open Questions). A faster product path for the Table edit or the Markdown total: the scale admits no regression the stated bound would catch locally.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: the requirement "Timed bounds judged in the perf pass" states the runner factor on GitHub-hosted runners. A new requirement makes the keyboard cases run with the platform's keyboard navigation on.

## Impact

- `packages/view/test/browser/harness/perf.ts` (the factor, read from the environment), its unit test `perf.test.ts`, and `markdown-total.browser.ts` (the dense case's wait). The gates in `table-bounds.browser.ts` and the other perf files are unchanged.
- `.github/workflows/browser.yml`: the runner variable on the test step, and a macOS WebKit step that turns on keyboard navigation. Tested in `tools/ci/e2e-workflows.test.ts`.
- Documents: `CLAUDE.md` (CI section), the spine's Tests row, `.claude/skills/askboard-implementation/references/test-harness-patterns.md`, `docs/as-built/ci-e2e-gates.md`.
- No contract set widened, no product code, no dependency added. Platforms: macOS and Linux CI runners (NFR-7); a developer's machine is unchanged.
