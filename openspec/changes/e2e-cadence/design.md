# Design

## Context

See proposal.md, Why. The state on `main` at a3f2708d (after #173, #171 plan item 1, and kanban-order, #175):

- **Runner.** `packages/view/test/browser/run.ts` builds the bundle, unless `--no-build` is passed. It then starts one `bun test` per engine, with the engines in parallel (`--serial` runs them in turn). Each `bun test` gets all 145 `*.browser.ts` files and runs them one after another, with `ASKBOARD_E2E_ENGINES` naming its engine. Every file loops over `enginesFrom(process.env.ASKBOARD_E2E_ENGINES)` (`harness/engines.ts`). Two files narrow that list inline: `markdown-total` and `markdown-bounds` drop Firefox.
- **Harness.**
  - `useEngine` (`harness/board-test.ts`) launches one browser per file and one session process per test.
  - `isolated()` (`harness/session-process.ts:454`) gives each session process its own `HOME`, `XDG_CONFIG_HOME` and project, but no `XDG_RUNTIME_DIR`: every session process writes its session file and socket in the machine-wide `sessionFolder` (`/tmp/askboard-<uid>`, `packages/contract/src/push/session-folder.ts:28`), which parallel files would share (task 0.3).
  - `QUIET_MS = 1_500` (`board-test.ts:30`) is slept 158 times in 61 files (task 0.5(c)): 144 `Bun.sleep(QUIET_MS)` and 14 `Bun.sleep(QUIET_MS / 3)`, counting the one in `expectNoReconnect` (7 callers) and `harness/tree-steps.ts`. Two more sites sleep the literal `1500` (`context-panel.browser.ts:308`, `connection.browser.ts:195`). Each sleep watches for something that must not happen: a draft, an act, a view message, a reconnect, a DOM change. kanban-order added 4 of them to `kanban.browser.ts` (its order tests).
  - The view's draft mirror debounces drafts by `DRAFT_DEBOUNCE_MS = 300` (`packages/view/src/board-page/draft-mirror.ts:10`).
- **Timed bounds.** The view spec's timed requirements are LaTeX bounded work and LaTeX previews one at a time (`openspec/specs/view-and-widgets/spec.md:2259-2291`), Markdown bounded work (`:2670-2675`) and A Table at its bounds on the board (`:3139`, table-widget decision 13). They are asserted in:
  - `table-bounds` (three fresh-page runs, each judged alone);
  - `markdown-total`, `markdown-bounds` and `latex-bounds`;
  - one timed test in `latex.browser.ts` (`:400-405`).
  - Outside the view spec, `document-review.browser.ts:1118-1235` ("the cost of placing", Chromium only, from document-review's task 6.4 and its Risks entry on placing cost) asserts four wall-clock gates: `busy < alone * 4 + 60`, `placed < 15_000`, `perKey < 150` and `shown < 20_000` (task 0.5(b)).
- **Conformance.** `packages/server/test/conformance/run.ts --runtime bun|node` runs AD-1's three configurations in turn, in about 2 min per runtime.
- **CI, as #173 left it.**
  - `ci.yml` runs on `pull_request`, on a push to `main`, nightly (`17 3 * * *`) and on `workflow_dispatch`. `openspec`, `check` and `codex` run on every event but a dispatch: on a pull request on `ubuntu-24.04`, otherwise `check` on `macos-latest`. `browser` and `conformance` run only on a dispatch, on `macos-latest`, each building.
  - Concurrency: `group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}`, cancelling only on `pull_request`.
  - `tools/ci/changed-paths.sh` (tested by `tools/ci/changed-paths.test.ts`) prints `code` and `codex` from the diff of a depth-2 checkout; a schedule or a dispatch gets both true. A job with nothing to do still runs and ends after one step, so its status exists under the same name for every change: a required check does not accept a job skipped by `if`.
  - `browser.yml` caches the engines' downloads in `PLAYWRIGHT_BROWSERS_PATH`, keyed by OS, engine and Playwright version (`actions/cache` v6.1.0, by SHA), then runs `playwright install --with-deps <engine>`.
  - `.github/actions/setup-bun` runs `setup.sh --ci --no-codex`: no job but `codex` fetches rulesync.
  - Workflows are tested by reading their YAML with `Bun.YAML.parse` (`tools/release/workflow.test.ts`); `tools/codex-interop.test.ts` lists the workflows that must not run `--codex-only`.
  - `release.yml` has the jobs `build`, `smoke-linux` and `publish` (`publish` needs the other two), pins `actions/upload-artifact` v7.0.2 and `actions/download-artifact` v8.0.2, and `tools/release/workflow.test.ts` asserts those jobs and needs.
- **Unit tests.** `bun run test` is `bun test --parallel --no-isolate --timeout 30000 --timings tools/test-timings.json --coverage`. `tools/test-timings.json` (`{"version": 1, "files": {<path>: <ms>}}`, the files of 1.5 s or more) makes `--parallel` start the slow files first. The rules parallel files follow (own ports below the ephemeral range, own temporary folders, no machine-wide lookup) are in `.claude/skills/askboard-implementation/references/test-harness-patterns.md`.
- **Tools.** #173 showed that Bun 1.4.4's `--parallel` (with `--no-isolate`) and `--timings` work on the unit suite. How `--parallel`, `--shard=k/n`, isolation and `--update-timings` behave with the browser files is under Needs probe.

ADs relied on:

- AD-1: the three conformance configurations in CI.
- AD-8: CSP collection in every browser file, the sandboxed view, and the bounded work of the LaTeX and Markdown renderers.
- AD-13: the Table's formulas at their bounds.
- AD-19: the adoption rule for actions, and Node 24 as the shipped runtime.
- NFR-7: Linux and CI runners. NFR-10: why session-process reuse is deferred.
- The spine's Consistency Conventions, Tests row: what CI runs.

## Goals / Non-Goals

**Goals:**

- Every pull request gets a verdict from the browser and conformance suites on Linux in about 5 min, running beside `check`.
- Every browser file runs in each of its engines on Linux every night, and on macOS every week and before every release.
- A local full run takes well under the current hour.
- No requirement, engine or check loses coverage. The timed bounds keep their values.

**Non-Goals:**

- `check`, `openspec`, `codex`, the runners, triggers and concurrency of `ci.yml`, `tools/ci/changed-paths.sh`, Dependabot, `setup.sh --no-codex`, `bun run test` and the unit-test timing gates. #171 plan item 1 built them (#173); this change uses them as they are and edits `ci.yml` only as decision 1 says.
- One session process per file (D5): #172.
- Branch rulesets and required checks: a repository setting the PO holds (Open Questions, Q2).
- Node 26: the spine lists it, and this change adds it only if the PO agrees (Q1).
- The other runs in the Tests row (live model calls, legacy negotiation, the formula, time zone and locale fixtures, the token report): unchanged.

## Defaults taken (unattended run, 2026-11-14)

The PO was unavailable. These are the coordinator's defaults for #171 and are not PO answers. Task 0.1 records any answer that differs, and `/opsx:update` follows it.

| ID | Default |
|---|---|
| D1 | Every pull request, on `ubuntu-24.04`: the browser smoke set in Chromium, and conformance in AD-1's three configurations on Bun. |
| D2 | Nightly on `main`, on `ubuntu-24.04`: the full browser suite in Chromium, Firefox and WebKit, four shards per engine; the perf pass; conformance on Node 24. |
| D3 | Weekly and before every release, on `macos-latest`: the nightly set, with conformance on Bun and Node 24. |
| D4 | Locally, `bun run test:e2e` runs the full set with files in parallel within each engine and the engines in turn (C2), then the perf files in a separate serial pass, then conformance on Bun. |
| D5 | Reusing one session process per file (#171 item C4) is deferred to its own Issue, #172, because it needs an NFR-10 review. |
| D6 | Speed gates are judged in the perf pass on the median of three runs, with the gates unchanged (#146's proposed default). |

## Coordinator decisions after group 0 (unattended run, 2026-11-14)

Group 0's record (`drafts/e2e-cadence-group0.md`) raised four findings. The coordinator decided them in the unattended run; they are not PO answers, and an answer of the PO on #171 that differs goes through `/opsx:update`.

| ID | Finding (task) | Decision | Where |
|---|---|---|---|
| C1 | `document-review.browser.ts:1118-1235` holds four Chromium-only wall-clock gates outside the view spec, which decision 6's rule would fail (0.5(b)) | They move to the perf set, judged on the median of three like the others, gates unchanged | Decisions 4 and 6, the delta spec, task 3.4 |
| C2 | Decision 5's worker default (`cores / (2 × engines)`, 2 on 14 cores) is too low; three engines at once saturate the machine and add load-only flakes (0.3(c)) | Engines run in turn, each with `availableParallelism()` workers (about 3 min per engine on 14 cores); `--workers` overrides; CI's shards stay as designed | Decision 5, task 2.2 |
| C3 | Every session process of every worker shares `/tmp/askboard-<uid>`; one load flake (`header.browser.ts`, `connect ENOENT /tmp/askboard-501/8031.sock`) came from it (0.3(a)) | Each `bun test` worker gives the session processes it starts a short runtime folder of its own, as `XDG_RUNTIME_DIR` | Decision 5a, task 2.1 |
| C4 | Two `Bun.sleep(1500)` literals escape the guard (0.5(c)) | The guard also refuses a literal equal to `QUIET_MS` | Decision 7, tasks 4.1 and 4.5 |

## Decisions

### 1. A caller workflow of its own, `e2e.yml`

A new `.github/workflows/e2e.yml` owns the cadence. Like `ci.yml`, it only composes reusable workflows. `ci.yml` keeps `openspec`, `check` and `codex` as #173 built them and loses its dispatch-only `browser` and `conformance` jobs and the comment lines about them. Its three jobs drop `if: github.event_name != 'workflow_dispatch'`, so that a dispatch of CI runs them as the nightly run does (`changed-paths.sh` already runs everything on a dispatch); `e2e.yml` takes over the manual runs of the suites.

- **Triggers:**
  - `pull_request`;
  - `schedule`: nightly `23 2 * * *` and weekly `23 4 * * 6`, both UTC, apart from `ci.yml`'s `17 3 * * *`;
  - `workflow_dispatch` with a `cadence` input (`smoke`, `nightly`, `weekly`);
  - `workflow_call` with a `cadence` input, for `release.yml`.
- **A `plan` job** on `ubuntu-24.04`, plain shell, turns the event into outputs: the runner, the engines, the shard count, the runtimes, the browser set, and `code`:

  | Cadence | Runner | Browser | Perf pass | Conformance |
  |---|---|---|---|---|
  | `smoke` (pull request) | `ubuntu-24.04` | smoke set, Chromium, one shard | no | Bun, three configurations |
  | `nightly` (daily cron) | `ubuntu-24.04` | full set, three engines × 4 shards | yes | Node 24, three configurations |
  | `weekly` (weekly cron, release call) | `macos-latest` | full set, three engines × 4 shards | yes | Bun and Node 24 |

  The cadence and the event reach its script through `env`, never as `${{ }}` inside `run`, as `tools/release/workflow.test.ts` requires of `release.yml`.
- **The `code` output** is `tools/ci/changed-paths.sh`'s, unchanged: the `plan` job checks out at depth 2 and runs the script, as `check.yml` does. The gate has one list of documents, the one `check` uses; this change adds no list and no output to the script. A schedule, a dispatch and the release call (whose event is the caller's `workflow_dispatch`) get `code=true`.
- **Every job always runs** (#173's rule). When `code` is false, `build`, `browser` and `conformance` each end after one step that says why, so the pull-request statuses exist under the same names for every change, ready for Q2's ruleset. `browser.yml` and `conformance.yml` gain an input `code` (boolean, default `true`) for this.
- **Concurrency**, in `ci.yml`'s shape with the cadence added: `group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}-${{ inputs.cadence || github.event.schedule || github.event_name }}`, with `cancel-in-progress` only for `pull_request`. A nightly, a weekly run and a dispatch on the same commit each have their own group, and no scheduled run is cancelled.
- **The jobs:** `plan`, then `build`, then `browser` (calls `browser.yml`), `perf` (calls `browser.yml` with the perf set) and `conformance` (calls `conformance.yml`). `perf` alone is skipped by `if` on a pull request (the plan's perf output is false): it is never a pull-request status, so the always-run rule does not apply to it.
- **Release.** `release.yml` gains a job `e2e-macos` that calls `e2e.yml` with `cadence: weekly`. `publish` adds it to its `needs`. This adds a gate to the requirement The release workflow (delta spec `packaging`), and `tools/release/workflow.test.ts` moves with it: the job list and `publish`'s needs.

**Alternatives:**

- Adding the schedules and the cadence to `ci.yml`. Rejected: the release call needs a `workflow_call` entry with a cadence input, and the e2e schedules, runners and concurrency differ from `ci.yml`'s (whose nightly runs `check` on macOS).
- `on.pull_request.paths-ignore`, or skipping the jobs by `if`. Rejected for the reason #173 gives: a status that is never reported does not satisfy a required check.

### 2. Build once per run

A `build` job per runner OS runs `./.github/actions/setup-bun` (which already skips the Codex files) and `bun run build`. It uploads `dist/` and `hooks/askboard-mod.js` as one artifact named `e2e-build-<os>`, with retention of 1 day, using the `upload-artifact` pin from `release.yml`. `browser.yml` and `conformance.yml` gain an input `build-artifact`. When it is set, they download that artifact (the `download-artifact` pin from `release.yml`) in place of their `bun run build` step; when it is empty, they build as today, so a manual call still works. `browser.yml` keeps #173's Playwright cache and install steps as they are, after the build or the download. An artifact is read only by the run that made it: there are no cross-run downloads.

### 3. Safe in a public repository

The repository is public, so pull requests from forks run this workflow. To keep that safe, as #173's workflows already do:

- `permissions: contents: read` at the workflow level, and no job widens it.
- The trigger is `pull_request`, never `pull_request_target`.
- No `secrets:` are passed: the suites need none, unlike `check`'s `secrets: inherit`. `release.yml`'s call passes none either.
- Every checkout uses `persist-credentials: false`.
- Only first-party `actions/*` are used, pinned by commit SHA with the version as a comment (AD-19).
- No `${{ }}` expression inside a `run` script: values come through `env`.
- Each job has a `timeout-minutes`.
- The `BROWSER` recorder stays job-wide, as in `browser.yml` today (AD-18).

`tools/ci/e2e-workflows.test.ts`, beside `changed-paths.test.ts`, checks every point above by reading the YAML with `Bun.YAML.parse`, as `tools/release/workflow.test.ts` does (task 5.1).

### 4. The manifest of browser files

`packages/view/test/browser/harness/suites.ts` exports `BROWSER_FILES`, keyed by file name. Each entry may set:

- `engines`: a subset of `ENGINES`, with `why` citing the requirement, or the archived change's task, that names fewer engines;
- `smoke: true`;
- `perf: true`.

It also exports `SPINE_CHECKS`: one entry per check that the Tests row names, giving the smoke file and test title that cover it, or the reason no file can yet (PlantUML has no widget on `main`).

- `enginesFor(file)` returns the manifest's engines intersected with `ASKBOARD_E2E_ENGINES`.
- A file whose entry narrows its engines loops over `enginesFor(import.meta.path)` instead of an inline filter. `markdown-total` and `markdown-bounds` are the narrowed files on `main`; `document-review-cost` joins them (C1).
- The runner chooses each engine's files from the manifest, so no `bun test` process starts a file that has no tests for its engine.

`harness/suites.test.ts` fails when:

- a `*.browser.ts` file has no entry, or an entry has no file;
- a narrowed entry has no `why`, or its file does not call `enginesFor`;
- any file narrows `enginesFrom(...)` inline;
- a `SPINE_CHECKS` entry names a file outside the smoke set, or a test title that is not in that file's text.

A later change that adds a browser file must therefore list it. That is how new files are classified. The manifest lists the 145 files on `main` (a3f2708d; 77eac5bd added none) and the two this change adds: `probes` (task 4.2) and `document-review-cost` (task 3.4, Chromium only, `why` citing document-review's task 6.4). kanban-order added no file: its order tests are in `kanban.browser.ts`, whose entry keeps all three engines, and `harness/kanban-drag.ts` and `fixtures/kanban-documents.ts` are helpers, not entries.

**The smoke set** is the smallest set of files that covers `SPINE_CHECKS`:

- cold load;
- reload;
- takeover;
- source view;
- `self.origin === "null"`;
- a failing view `fetch`;
- the box unchanged 1 s after visible;
- a board and a Snapshot rendered;
- CSP collection, which every file does.

It also includes the lifecycle board page, because it holds NFR-10's discarded and moved states. The candidates are `view`, `board`, `connection`, `lifecycle-board-page`, `context-panel`, `snapshot-control` and one Snapshot render file. Task 0.5 confirms the list against the titles. The budget is at most 25 files and 5 min in Chromium on `ubuntu-24.04`.

### 5. The runner: sets, workers, shards

`run.ts` keeps its options and adds:

- `--set smoke|full|perf|all`, default `all`:
  - `smoke`: the smoke files.
  - `full`: every file that is not a perf file.
  - `perf`: the perf files.
  - `all`: `full`, then `perf`.
- **Engines in turn** (C2). The smoke and full passes run one engine at a time, each engine's `bun test` with all the workers. Task 0.3 measured Chromium's `full` set at 1,442, 764, 390, 215 and 186 s with 1, 2, 4, 8 and 14 workers, and about 3 min per engine at 14 workers (about 9.5 min for three, load 15, no failure), against about 10 min for three engines at once at 4 or 8 workers each, with a load of 26 to 44 and load-only failures. `--serial` is still accepted and changes nothing, since engines in turn is now the only order.
- `--workers <n>`: passed as `--parallel=<n>` to each engine's `bun test` in the smoke and full sets. The default is `max(1, availableParallelism())`. CI's shards stay as decision 1 has them: one engine per job, which passes the runner's core count.
- `--timings`: every smoke and full pass passes `--timings packages/view/test/browser/timings/<engine>.json` when that file exists, so the slow files start first, as `bun run test` does with `tools/test-timings.json`. The files use that file's format (`{"version": 1, "files": {<path>: <ms>}}`).
- `--shard <k>/<n>`: passed to `bun test`, and balanced by the same timings file. Without the file, shards split by file count.
- **Isolation.** The browser passes keep Bun's `--parallel` default (each file isolated), unlike `bun run test`'s `--no-isolate`: the harness keeps module state per file (the browser, the engine list), and task 0.3 found `--no-isolate` within 2%. No pass takes `--no-isolate`.
- `--update-timings`: writes the timings file of each engine run. Refreshing the committed files is a manual commit, and the nightly run uploads its own timings as an artifact for that purpose.

The perf set never takes `--parallel` or `--shard`. It runs its files one at a time, with the engines in turn, after the other set has finished.

The pure parts move to `run-options.ts` (parsing) and `run-plan.ts`. `run-plan.ts` turns the manifest, the options and the engines into the passes, with each pass's per-engine file list and `bun test` arguments. Both modules are unit-tested. `run.ts` keeps the spawning, the SIGINT and SIGTERM cleanup, and a summary line per engine per pass.

`package.json`:

- `test:e2e` keeps its form (`run.ts --no-build --target session-process && conformance/run.ts --runtime bun`) and so now runs `all`.
- A new `test:e2e:smoke` runs `--set smoke --engines chromium` and then conformance on Bun: what a pull request runs.

### 5a. A runtime folder per worker

Each `bun test` worker gives the session processes it starts a runtime folder of its own (C3), so files running in parallel never share a session folder, and no run touches the machine-wide `/tmp/askboard-<uid>` or a developer's own sessions.

- `harness/runtime-dir.ts` exports `workerRuntimeDir()`. On its first call in a module instance it makes `mkdtemp(join(tmpdir(), "ab-"))` (mode 0700, as `mkdtemp` makes it) and returns the same folder after that. Bun's per-file isolation reloads the module for each file, so a worker's successive files each get their own folder, and two workers never share one. The folders are removed when the worker exits.
- **Short enough for a socket.** The folder is short so that the longest socket path the session folder can hold, `socketPathFor(sessionFolder({ env: { XDG_RUNTIME_DIR: folder }, uid }), 4_194_304)` (`<folder>/askboard/<pid>.sock`, the largest Linux PID), stays within `SOCKET_PATH_MAX_BYTES` (103 bytes on macOS, the 104 of `sun_path` less its NUL; 107 on Linux). `workerRuntimeDir()` checks this with `socketPathProblem(path, process.platform)` and throws its text when the folder is too long, rather than fall back to a shared folder.
- `isolated()` adds `XDG_RUNTIME_DIR: workerRuntimeDir()` to the session process's environment. The environment is built from `getDefaultEnvironment()` and `isolated()`'s folders (`session-process.ts:532-538`), and `findLocalApi` reads the session folder from that same environment (`session-process.ts:363`), so the harness and the process agree on the folder with no other edit.

### 6. The perf pass and the median

- **The helper.** `harness/perf.ts` exports `PERF_RUNS = 3`, `median(samples)` and `expectMedianWithin(label, samples, gate, below = false)`. The last prints one line, `perf <label> <engine> [a, b, c] median m gate g`, then asserts `m <= g`, or `m < g` when `below` is set, so a gate written with `toBeLessThan` keeps its strictness.
- **How a perf file measures.** It takes `PERF_RUNS` measurements of each form in fresh pages, asserts the functional outcomes on every run, and judges each gate once on the median. This applies the new requirement Timed bounds judged in the perf pass.
- **The perf files:** `table-bounds`, `markdown-total`, `markdown-bounds`, `latex-bounds` and the new `document-review-cost`. Task 0.5(b) found no other bound of the view spec.
  - `latex.browser.ts:400-405` moves into `latex-bounds`, and its `2_000 + QUIET_MS` allowance becomes the 2-second bound on the median.
  - `document-review.browser.ts:1118-1235` moves whole into `document-review-cost.browser.ts` (C1), which loops over `enginesFor(import.meta.path)` (Chromium only, as the block was) in place of its inline `includes("chromium")`. Each of its two tests takes `PERF_RUNS` runs, each run on fresh hosts, and asserts its functional outcomes (the placed and detached counts, the 32 marks, no CSP problem) on every run. The four gates keep their values and their strictness: `placed < 15_000`, `perKey < 150` and `shown < 20_000` on the median of their three samples, and `busy < alone × 4 + 60` with both `busy` and `alone` the medians of their three samples. The test timeouts grow with `PERF_RUNS`, and the `document-review timing` lines stay, beside the `perf` lines.
- **What the timed files keep:**
  - Markdown-total's dense board stays timed and not bounded, as task 5.16 of atoms left it.
  - `tree-layout`'s "visible within the load timeout" is a timeout, not a bound, and stays where it is.
  - The "box unchanged 1 s later" check is the spine's own 1 s, so it is not a perf check either.
- **The rule, enforced.** `perf-files.test.ts` holds that the perf files are exactly the files that import `harness/perf.ts`, and that no non-perf file holds a `toBeLessThan` or `toBeLessThanOrEqual` on a `performance.now()` or `Date.now()` difference, directly or through a variable or helper that returns one (as `document-review`'s `typing` did). A file can be exempted, with a reason in the manifest, when its timing is a timeout.

### 7. Round-trip probes in place of the quiet wait

`harness/probes.ts` exports these helpers. Each returns only after anything sent through its channel before the call has been recorded.

| Probe | Channel | How |
|---|---|---|
| `viewSettled(board)` | view → board page | Two animation frames and a macrotask inside the view frame, then a macrotask in the board page. A message the view posted before has been handled by then. |
| `draftSettled(board)` | draft mirror | `DRAFT_DEBOUNCE_MS` plus one frame, then `viewSettled`. |
| `hostSettled(run)` | board page → board-host | `viewSettled`, then a board-page macrotask. Every frame the page sent before is in `run.browser.sockets` when the probe returns; task 0.4 checks this. |
| `timerSettled(ms, board)` | a product timer under test (such as the reconnect backoff) | The timer's own constant, imported, then `viewSettled`. |
| `quiet(reason)` | none | The remaining `QUIET_MS` wait, with its reason, for a site no probe fits. |

- **Classifying each site.** Every `Bun.sleep` on `QUIET_MS`, whole or a fraction (14 sites sleep `QUIET_MS / 3`), becomes one of the five, chosen by what its assertion reads:
  - DOM or focus: `viewSettled`;
  - drafts: `draftSettled`;
  - acts or socket frames: `hostSettled`;
  - reconnects or another timer: `timerSettled`;
  - else: `quiet`.
- **`expectNoReconnect`** uses `timerSettled` with the board page's reconnect delay. Task 0.2 finds the constant's name.
- **The guard.** `harness/probes.test.ts` refuses, anywhere under `packages/view/test/browser/` except inside `quiet`, any `Bun.sleep(` whose argument names `QUIET_MS` (whole or any fraction, `QUIET_MS / 3` included) or is a numeric literal equal to `QUIET_MS`'s value, read from the import and written either way (`1500`, `1_500`; C4). It requires a non-empty reason for each `quiet` call. The two literal sites (Context) are converted in task 4.5.
- **Firefox and `hostSettled`** (task 0.4(a)). In Chromium and WebKit a frame the page sends is in `run.browser.sockets` when the `evaluate` that sent it resolves; in Firefox only after one more round trip. So `hostSettled`'s board-page macrotask is always a separate `evaluate`, after the one that flushes the view; with it, all three engines gave 200 of 200 and no channel needs a `quiet` fallback.
- **What is kept, and what is not.** A probe catches what was sent before it, but not something sent later by a timer the test does not know. That is why every timer the product uses on these paths is named and waited for, and why task 0.4 checks each probe by mutation in every engine. If ordering does not hold in an engine for a channel, that channel's sites use `quiet("<engine> does not order <channel>")` in that engine, and the note says so.

### 8. The spine's Tests row

Task 6.1 appends this text to the row, after "Node 24 and 26.", and changes nothing else in it:

> **CI cadence:** every pull request that changes more than documents runs, on Linux, the browser smoke set in Chromium (the files that cover the checks above, listed with every browser file's engines in the suite manifest) and the conformance suite in its three configurations on Bun; every night `main` runs, on Linux, every browser file in each engine the manifest gives it, the timed checks in a perf pass of their own (serially, judged on the median of three runs) and the conformance suite on Node 24; every week and before every release the same runs on macOS, with conformance on Bun and Node 24. A browser file runs in all three engines unless a requirement names fewer, and its manifest entry cites it.

If the PO accepts Q1, "on Node 24" in the nightly clause becomes "on Node 24 and 26". The frontmatter's `updated` is set to the task's date, and `sources` gains one line for this change's defaults, after kanban-order's line, which is on `main` (M2).

### 9. CLAUDE.md

Task 6.2 edits only these, in the CI section #173 wrote and in Development commands:

- the composition bullet: `ci.yml` composes `openspec.yml`, `check.yml` and `codex.yml`; `e2e.yml` composes `browser.yml` (now with its set, engines, shards, workers, shared build and `code` inputs; its Playwright cache unchanged) and `conformance.yml` (runtimes and the shared build);
- the `changed-paths.sh` bullet: the e2e jobs read the same `code` output;
- the Triggers bullet: its sentence "Browser and conformance run only on demand (`workflow_dispatch`): run them locally (…) before a merge that touches the view, the server or the conformance suite" becomes the cadence of decision 1, and the local rule becomes `bun run test:e2e:smoke` before every pull request that touches the view, the server or the conformance suite, and `bun run test:e2e` before one that changes the harness, the runner or a widget's rendering; the "Known: WebKit …" sentence stays unless task 0.6 shows it fixed or filed;
- the ruleset bullet: the e2e statuses beside the three it lists (for Q2), named as task 5.3 builds them;
- the Development commands lines for `test:e2e`, the new `test:e2e:smoke`, and the runner's `--set`, `--workers`, `--shard` and `--update-timings`; the sentence on `--engines a,b` and `--serial` says that the engines now always run in turn (decision 5).

A red scheduled run is filed by whoever sees it, as The backlog says, with `source:e2e`. The workflow writes no Issues, because it holds no write token (decision 3).

### 10. Versions

No schema set, board-protocol message or package version changes.

## Merge points

| ID | Change in flight | What overlaps | Rule |
|---|---|---|---|
| M1 | #171 plan item 1: merged as #173, a3f2708d (2026-11-14) | `ci.yml`, `check.yml`, `codex.yml`, `browser.yml`, `.github/actions/setup-bun`, `setup.sh`, `package.json`'s `test`, `tools/ci/changed-paths.sh`, the CLAUDE.md CI section | Resolved by the rebase of 2026-11-14. This change reuses #173's gate (`code`), its always-run rule, its concurrency shape, its Playwright cache step and its `setup.sh --no-codex` setup, and adds none of them again. Task 5.4 edits `ci.yml` as decision 1 says; task 6.2 edits #173's CI text as decision 9 says. |
| M2 | `kanban-order`: merged as #175, 965d5658, archived as #177, 89db975c | `kanban.browser.ts` (its order tests, 4 more quiet waits), `harness/kanban-drag.ts`, `fixtures/kanban-documents.ts`; also `edit-widgets-it`, `edit-widgets-session`, `edit-widgets-snapshot`, `hover-audit` and `keep-mine-reload-session`; the spine's `updated` and one `sources` line | Resolved: no new browser file (145 at a3f2708d). Task 0.5 and group 4's batches count these files as they are on `main`; task 6.1 keeps kanban-order's `sources` line. |
| M3 | `early-benchmark` (in `openspec list` on `main`) | None: it adds no CI runs and no browser file | None. |
| M4 | Any change that merges a browser file before this one (none in flight on 2026-11-14: #178, drafts only, merged as 77eac5bd; #190, a Dependabot bump of `package.json`'s dev dependencies) | `BROWSER_FILES`; `package.json` (#190 changes dependencies, not scripts) | Task 7.1 lists each new file in the manifest (`suites.test.ts` fails until it does) and keeps both sides of `package.json`. |

Names borrowed from `main`, checked by task 0.2:

- `ENGINES`, `enginesFrom`, `Engine` (`harness/engines.ts`);
- `useEngine`, `QUIET_MS`, `STEP_TIMEOUT_MS`, `LOAD_TIMEOUT_MS`, `expectNoReconnect`, `eventually`, `actsApplied` (`harness/board-test.ts`);
- `DRAFT_DEBOUNCE_MS` (`packages/view/src/board-page/draft-mirror.ts`);
- the board page's reconnect delay constant;
- `run.ts`'s options;
- `browser.yml` and `conformance.yml`'s `runs-on` input, and `browser.yml`'s Playwright cache step (`PLAYWRIGHT_BROWSERS_PATH`, `actions/cache`);
- the `upload-artifact` and `download-artifact` pins and the jobs `build`, `smoke-linux` and `publish` in `release.yml`, and `tools/release/workflow.test.ts`;
- `./.github/actions/setup-bun` and its `setup.sh --ci --no-codex`;
- `tools/ci/changed-paths.sh` and its `code` output; `ci.yml`'s concurrency group;
- `tools/test-timings.json`'s format;
- the workflow list in `tools/codex-interop.test.ts`;
- `fixtures/record-link.sh`.

Borrowed by decisions 5a and 6 (C1, C3), checked on `origin/main` 77eac5bd by this revision and re-checked by task 7.1: `isolated` (`harness/session-process.ts:454`), its environment (`:532-538`), `findLocalApi` (`harness/asker-project.ts:127`, called at `session-process.ts:363`), `useWidgetHost` (`harness/widget-host-test.ts:56`), `sessionFolder`, `socketPathFor` and `socketPathProblem` (`packages/contract/src/push/session-folder.ts:28`, `:40`, `:65`), `SOCKET_PATH_MAX_BYTES` (`packages/contract/src/push/constants.ts:57`), and the block `document-review.browser.ts:1118-1235`.

Nothing is borrowed from an unmerged change.

## Needs probe

None of these is a Claude Code run-time assumption. All concern tools.

- **P1, P2, P3: resolved by group 0** (tasks 0.3 and 0.4, record in `drafts/e2e-cadence-group0.md`). P1: with `--parallel=<n>` and an explicit file list the workers inherit the environment, the browsers launch isolated and with `--no-isolate`, a failure exits non-zero and the `N pass` and `N fail` lines stay; the session folder is shared (C3, decision 5a). P2: the shards cover the list exactly once, a timings file balances them and `--update-timings` writes it. P3: decision 7's Firefox note; no `quiet` fallback.
- **P4**: resolved by the rebase (`Bun.YAML.parse` exists in Bun 1.4.4).
- **P5.** How many cores do `ubuntu-24.04` and `macos-latest` give, and does Chromium's smoke set fit in 5 min there? Locally it takes 64 s serially (task 0.5(a)). Measured on the pull request's own first run (task 7.2).

## Risks / Trade-offs

- **[The known WebKit failure]** → CLAUDE.md records that WebKit fails on "ten presses of Tab never reached Answer", and no Issue names it (searched 2026-11-14). The nightly WebKit shards would be red from the first night. Task 0.6 reproduces it and files it under The backlog if it holds.
- **[Linux has never run these suites]** → The first runs may fail on Linux-only faults: signals (#160 was macOS-only), socket paths, fonts in text measurement, WebKit on Linux. The pull request's own run is the first probe. A fault in the harness is fixed in this change. A product fault becomes an Issue (`source:review`, its area, Origin naming this change and the run), and the PO decides whether it blocks.
- **[A probe misses a late send]** → Decision 7: timers are named and waited for, each probe is checked by mutation in every engine, and `quiet(reason)` remains for the rest.
- **[Parallel files contend for the CPU and slow the functional timeouts]** → The timed checks have left the parallel set. `STEP_TIMEOUT_MS` and `LOAD_TIMEOUT_MS` are left as they are. The engines run in turn (C2), which task 0.3 found faster and quieter than three at once. Of its four load-only failures, `header`'s came from the shared session folder (decision 5a); the other three (`uj2-editing-plus`, Firefox's Chart and Approval tests) are watched in task 7.2's runs, and each that recurs becomes an Issue (`source:e2e`).
- **[Engine-specific faults are found a day late]** → Weekly macOS and the release gate catch macOS. The nightly run catches Firefox and WebKit within a day. The smoke set keeps the spine's checks on every pull request.
- **[Shard imbalance]** → Committed timings files. A stale file costs time, not coverage: Bun's `--shard` covers every file.
- **[Release takes longer]** → The macOS suite adds roughly 15 to 30 min before `publish`, beside `smoke-linux`. The PO dispatches releases by hand and rarely.
- **[Nightly failures go unseen]** → GitHub notifies the PO about a failing scheduled workflow. Decision 9 puts filing in The backlog's hands.

## Migration Plan

- The merge turns the pull-request jobs on. Until the PO adds them to a ruleset (Q2), a red e2e job does not block a merge, as `check` does not today.
- **Rollback:** delete the `schedule` and `pull_request` triggers in `e2e.yml`. The runner's new options are additive, and `--set full --workers 1` runs the files one at a time as today, with the engines in turn and the probes in place of the waits.

## Open Questions

Both are posted on #171 with `needs-po`. Neither changes the tasks except where noted.

- **Q1.** Should Node 26 join the nightly and weekly conformance runs, so that the spine's "Node 24 and 26" holds? Proposed default: yes, one more matrix entry on each. If the PO says no, the Tests row says Node 26 is run on demand.
- **Q2.** Should `e2e / browser` (smoke) and `e2e / conformance` become required checks in the `main` ruleset? Proposed default: yes, after two weeks of green runs on Linux, so that first-run Linux faults do not block unrelated merges. This is a repository setting, outside this change's tasks.
