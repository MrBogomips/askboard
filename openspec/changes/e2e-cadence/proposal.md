# Proposal

## Why

Issue: #171
Issue: #146

The browser and conformance suites run in CI only when dispatched by hand. They have never run on Linux, nor on Node 26. Locally, `bun run test:e2e` takes over an hour (#171, Baseline): each engine runs its 145 files one after another, the three engines compete for the CPU, and 154 fixed waits of 1.5 s add about 215 s per engine. The spec's speed gates (#146) go red on a busy machine with no defect behind them. So the suites that guard AD-1's degradation, AD-8's sandbox and NFR-7's platforms either run rarely or report noise. The spine's Tests row ("CI runs … macOS and Linux; Node 24 and 26") has not been true since the suites were suspended to save macOS minutes. The repository has been public since 2026-11-11, so hosted runners are now free, and wall-clock time is the only cost left.

## What Changes

The PO's plan item 2 on #171. Plan item 1 merged as #173 (Linux for pull requests, the documents-only gate `tools/ci/changed-paths.sh`, the Playwright cache, parallel unit tests); this change builds on it and repeats none of it. The defaults below were taken in an unattended run and are recorded as defaults (design.md, Defaults D1 to D6, and the coordinator's decisions C1 to C6, after group 0 and the reviews). The PO answered the two open questions on #171 on 2026-11-14: Node 26 joins the nightly and weekly conformance runs (Q1, yes), and the pull-request jobs do not become required checks (Q2, no).

- **A cadence for the suites** (NFR-7, AD-1; D1 to D3):
  - Every pull request, on Linux: the Chromium smoke set, plus conformance in AD-1's three configurations on Bun.
  - Nightly on `main`, on Linux: the full browser suite in the three engines, in four shards per engine; the perf pass; conformance on Node 24 and Node 26 (Q1).
  - Weekly, and before every release, on macOS: the same browser set as the nightly run, with conformance on Bun, Node 24 and Node 26.
  - The suites move from `ci.yml`'s dispatch-only jobs to a caller workflow of their own, which uses #173's documents-only gate and always-run jobs. The dist build is made once and shared by the jobs that need it.
  - A release waits for the macOS run of the suites before it publishes, in Chromium and WebKit until Firefox's open failures (#174, #145) are fixed (C6); it reads its own build by artifact ID and restores no cache.
- **One manifest of the browser files.** Each file is listed with its engines (all three unless a requirement names fewer), whether it is in the smoke set, and whether it is a perf file. A repository test keeps the manifest and the files in agreement, and checks that the smoke set covers each check the spine names.
- **The runner runs files in parallel within an engine, one engine at a time** (D4, C2). `packages/view/test/browser/run.ts` gains a smoke, full or perf set, a worker count (all cores by default), and shards balanced by recorded timings. Each worker gives the session processes it starts a short runtime folder of its own, so parallel files never share a session folder (C3). The perf files run in a separate serial pass, one engine at a time, with nothing else running. Locally, `bun run test:e2e` runs the full set in parallel, then the perf pass. A new `bun run test:e2e:smoke` runs what a pull request runs.
- **Speed gates are judged in the perf pass, on the median of three runs** (D6, #146's proposed default), including the Document review's four Chromium gates on the cost of placing quotes (C1). The gates themselves are unchanged. The functional outcomes in the same scenarios still hold on every run. This is a new requirement in `view-and-widgets`, and it defines "the test machine" that the Markdown bounds name.
- **Round-trip probes replace the fixed 1.5 s waits.** Each wait for "nothing happened" becomes a probe whose return shows that whatever was sent before it has arrived. Where a product timer is under test, the wait is that timer's constant plus the probe. A wait that no probe can replace is named, and its reason is given. A repository test refuses a bare sleep on `QUIET_MS`, whole or a fraction, or on a literal of its value (C4).
- **The spine's Tests row** states the cadence, the smoke set's rule, the per-file engine rule and the perf pass. The CI section of `CLAUDE.md` and its Development commands describe the new commands and triggers.
- **Deferred** (D5): reusing one session process per file for tests that are not about the lifecycle (#171, item C4). It needs its own review of NFR-10's isolation of epochs and discarded asks, so it moves to its own Issue, #172.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `view-and-widgets`: a new requirement on how the timed bounds that this spec names, and the browser suite's other wall-clock gates, are judged (in the perf pass, serially, on the median of three runs, gates unchanged). It also defines the "test machine" that the Markdown bounded work requirement names.
- `packaging`: The release workflow gains a gate: the browser and conformance suites on macOS pass before publishing, in every engine but one left out while open Issues track its failures (C6); publishing reads its own build's artifact by ID.

## Impact

- **Test tooling:**
  - `packages/view/test/browser/run.ts` and new runner modules beside it.
  - `harness/suites.ts` (the manifest), `harness/perf.ts` (the median rule) and `harness/probes.ts` (the round-trip probes).
  - `harness/board-test.ts`, whose `QUIET_MS` and `expectNoReconnect` change, and `harness/session-process.ts`, whose session processes get a runtime folder per worker (`harness/runtime-dir.ts`).
  - `document-review.browser.ts`'s timing block, moved into a new perf file.
  - About 60 browser files: their waits, and the narrowed or perf files' engine loops.
  - `package.json` scripts `test:e2e` and `test:e2e:smoke`, plus new tests under `packages/view/test/browser/harness/` and `tools/ci/`; `tools/release/workflow.test.ts` and `tools/codex-interop.test.ts` follow the workflows.
- **CI:**
  - New `.github/workflows/e2e.yml`.
  - `browser.yml` and `conformance.yml` gain inputs for the set, engines, shards, workers, runtimes, the shared build and the gate's `code`; `browser.yml` keeps #173's Playwright cache, except in the release run (`cache` input).
  - `release.yml` gains the macOS suite before `publish`, and its `smoke-linux` and `publish` download the build by artifact ID.
  - `ci.yml` loses its dispatch-only `browser` and `conformance` jobs, and a dispatch of it runs `openspec`, `check` and `codex`.
- **Documents:**
  - The spine's Tests row and its frontmatter (`updated`, `sources`).
  - The CI section and Development commands in `CLAUDE.md`.
  - `docs/as-built/e2e-cadence.md`.
- **Unchanged:**
  - No product code, schema set, board-protocol message or dependency changes.
  - Only first-party actions are used, already pinned in `release.yml` and `browser.yml` (AD-19).
- **Platforms:** the first Linux runs of the browser and conformance suites will probably turn up Linux-only faults (signals, socket paths, fonts). Finding them is part of the value (NFR-7). Each one becomes an Issue or a fix task.
