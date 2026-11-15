# As built: `e2e-cadence`

In code since `e2e-cadence` (Issues #171 and #146): the browser and conformance suites run on a cadence, in sets, in parallel files, with timed checks judged apart on a median and the fixed quiet waits replaced by round-trip probes. No contract set is widened and no version is bound.

**Where the code lives.**
- `packages/view/test/browser/harness/suites.ts`: the manifest of the browser files, with `suites.test.ts`.
- `packages/view/test/browser/harness/perf.ts`: the perf pass's helpers, with `perf-files.test.ts` and `perf.test.ts`.
- `packages/view/test/browser/harness/probes.ts` and `quiet-guard.ts`: the probes and the guard.
- `packages/view/test/browser/harness/runtime-dir.ts`: a runtime folder per worker.
- `packages/view/test/browser/run-options.ts` and `run-plan.ts`: the runner's options and passes; `run.ts` spawns them.
- `packages/view/test/browser/timings/{chromium,firefox,webkit}.json`: the committed per-file timings.
- `packages/view/test/browser/document-review-cost.browser.ts`: the Document review's timed checks.
- `.github/workflows/e2e.yml` with `tools/ci/e2e-workflows.test.ts`, and `tools/ci/merge-timings.ts`.

**Names and seams.**
- `BROWSER_FILES` (one entry per browser file: `engines` and `why`, `smoke`, `perf`, `timeout`), `SPINE_CHECKS` (the spine's checks and the smoke tests that cover them), `enginesFor(file)` (a file with narrowed engines loops over it), `suitesProblems`.
- `PERF_RUNS` (3), `perfRuns(name, body)` (the body runs `PERF_RUNS` times with a `gate` recorder, and the gates are judged once on the medians), `judgeMedians` (the judging step, which `document-review-cost` calls directly) and `expectMedianWithin` (the single-gate form): a perf gate is judged on the median of its runs.
- The five probes of `probes.ts`: `viewSettled`, `draftSettled`, `hostSettled`, `timerSettled` and `quiet(reason)`; `QUIET_MS`, `TIMER_SLACK`, `NO_RECONNECT_FLOOR_MS` and `noReconnectWaitMs`. The guard refuses a `Bun.sleep` on `QUIET_MS` (or a literal equal to it) outside `quiet`.
- `createRuntimeDir` and `removeRuntimeDir` (`runtime-dir.ts`): `isolated()` gives each session process a short `XDG_RUNTIME_DIR` of its own, beside its HOME and configuration folder, and the session's cleanup removes it after the process has exited; no test scope owns it.
- The runner's options: `--set smoke|full|perf|all`, `--workers`, `--shard <k>/<n>`, `--update-timings`, `--timings-out <file>`; `--engines` and `--target` as before, `--serial` accepted with no effect (the engines always run in turn). `bun run test:e2e:smoke` is the smoke set in Chromium then conformance on Bun.
- Workflow inputs: `e2e.yml` takes `cadence` (dispatch and call), and, for a call, `engines` (a JSON list that replaces the cadence's) and `no-cache`; `browser.yml` takes `set`, `engines`, `shards`, `workers`, `build-artifact`, `code` and `cache`; `conformance.yml` takes `runtimes` (`bun`, `node-24`, `node-26`), `build-artifact`, `code` and `cache`. `release.yml`'s `e2e-macos` calls `e2e.yml` with `cadence: weekly`, `engines` and `no-cache`, `e2e-firefox-smoke` with `cadence: smoke`, `engines: ["firefox"]` and `no-cache`, and `publish` waits for both; its `build` job outputs `artifact-id`, which `smoke-linux` and `publish` download by ID.
- `tools/ci/merge-timings.ts <base> <shard file>… --out <file>`: combines the shards' timings files of an engine (the nightly's `timings` job uploads the result; committing it is manual).

**Reused from #173.** The `code` output of `tools/ci/changed-paths.sh` (the e2e jobs read it), the always-run rule (a job with nothing to do ends after one step, so every status exists), the Playwright cache step of `browser.yml` (now off through `cache`), and the timings file format. `ci.yml` no longer holds the browser and conformance jobs; it composes `openspec.yml`, `check.yml` and `codex.yml`. No sentence of `docs/as-built/` says the browser and conformance jobs run on demand only, so none is corrected there.

**A later browser file** must be listed in `BROWSER_FILES` (its engines with the requirement that names fewer, its smoke or perf membership), or `suites.test.ts` fails.

**Defaults and decisions.**
- D1 to D6, taken under the unattended run of 2026-11-14: smoke on every pull request; nightly on Linux (three engines in four shards, the perf pass, conformance on Node 24 and 26); weekly and before a release on macOS (conformance on Bun, Node 24 and 26); locally `bun run test:e2e` with files in parallel and the engines in turn; one session process per file left to #172; speed gates on the median of three.
- The PO's answers of 2026-11-14: Q1, yes (Node 26 joins the nightly and weekly conformance); Q2, no (the e2e statuses are not required checks).
- The coordinator's decisions C1 to C6: C1, the four wall-clock gates of `document-review` move to the perf set; C2, the engines run in turn, each with one worker per core; C3, a runtime folder per session process; C4, the guard also refuses a literal equal to `QUIET_MS`; C5, `--timings-out` and the merge script, so shards can refresh the timings; C6, the release gate runs Chromium and WebKit only until #174 and #145 are both closed, with Firefox's smoke set still run on Linux by `e2e-firefox-smoke`, and restoring Firefox is dropping that job and the `engines` input of `e2e-macos`.

**`document-review`.** Its timing block (four wall-clock gates, formerly in `document-review.browser.ts`) lives in `document-review-cost.browser.ts`, in the perf set, Chromium only, each gate on the median of `PERF_RUNS` runs. `docs/as-built/document-review.md` does not place the block, so no sentence there is corrected.
