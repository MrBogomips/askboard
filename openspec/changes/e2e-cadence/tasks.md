# Tasks

Each task writes its tests first and sees them fail for the right reason before implementing. Terms used below:

- **"The check"** means `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`.
- **"Coverage"** means at least 80% of lines and functions for every file the task adds or changes under `bun test --coverage`. Browser files are not counted, since `bun run test` does not run them.
- **"Browser run"** means `bun packages/view/test/browser/run.ts --no-build --target session-process` after `bun run build`, with the options the task names. Run one browser run at a time on the machine: other worktrees run theirs too.
- **"Decision n"** and **"Dn"** refer to design.md. The requirement cited by name is in this change's delta spec.
- Commit bodies say `Refs #171` (and `Refs #146` for group 3).

**Order.** Group 0 comes first, then group 1. Groups 2, 3 and 4 then run in parallel, with disjoint files:

- Group 2 edits only `run.ts`, the new `run-options.ts`, `run-plan.ts` and their tests, `timings/`, and the `test:e2e` and `test:e2e:smoke` lines of `package.json`.
- Group 3 edits only `harness/perf.ts`, `harness/perf-files.test.ts`, the four perf files, `latex.browser.ts` and the manifest's `perf` flags.
- Group 4 edits only `harness/probes.ts`, `harness/probes.test.ts`, `harness/board-test.ts`, `harness/tree-steps.ts` and the other browser files. Task 4.5 waits for task 3.3, because both touch `latex.browser.ts`.

Group 5 follows group 2; #171 plan item 1 has merged (#173, design.md M1), so no task waits for another change. Group 6 follows group 5, and group 7 comes last.

## 0. Decisions and base

- [ ] 0.1 Record the PO's answers. Under Open Questions Q1 and Q2 and under the Defaults table (D1 to D6), add "Answer (<date>): …" from #171's comments. An answer that differs from its default goes through `/opsx:update` before any group that relies on it. Q1 changes task 5.3 and decision 8's text; D1 to D6 change groups 2 to 6. Tests: none (documents). Verify: each question and default carries an answer line, or the note says that none has come and that the defaults stand, with `needs-po` still on #171.
- [ ] 0.2 Base and borrowed names (design.md, Merge points). On `origin/main`, check with `git grep -n` every name the Merge points list, and record each with its file and line: #173's (`tools/ci/changed-paths.sh` and its `code` output, `ci.yml`'s concurrency group, `browser.yml`'s cache step, `setup-bun`'s `--no-codex`, `tools/test-timings.json`'s format, the workflow list in `tools/codex-interop.test.ts`, the jobs and needs `tools/release/workflow.test.ts` asserts) as well as the harness's. Also record:
  - the name and value of the board page's reconnect delay constant (decision 7);
  - whether `DRAFT_DEBOUNCE_MS` can be imported from the browser harness through the package's own relative path;
  - main's SHA (a3f2708d or later) and any browser file added since (M4).
  
  Tests: none. Verify: the note lists every name with its file and line. If a name is missing or its shape differs, stop for `/opsx:update` before group 1.
- [ ] 0.3 Probe P1 and P2 (design.md, Needs probe; P4 is resolved). On five browser files in Chromium, with `bun test` driven by hand outside `run.ts`:
  - (a) Check P1: `--parallel=2` with an explicit file list, `ASKBOARD_E2E_*` and `BROWSER` set, isolated (the default) and with `--no-isolate`. Do the workers see the variables, do the browsers launch, do two files' session processes stay apart (ports, session folders), does one injected failure (a scratch edit, not committed) give a non-zero exit, and does the summary keep its `N pass` and `N fail` lines?
  - (b) Check P2: `--shard=1/2` and `--shard=2/2` on the same list together cover it exactly once; with a scratch `--timings` file in `tools/test-timings.json`'s format and `--update-timings`, the file is written and the slow files start first.
  - (c) Time Chromium's whole `full` set with `--parallel` at 1, 2, 4 and 8 workers, isolated and with `--no-isolate`, then three engines in parallel at the best value, and report the load average.
  
  Tests: none (probe). Verify: the note holds (a) to (c) with the commands and the output lines. A "no" in (a) or (b) stops the work for `/opsx:update` of decision 5. (c) sets the worker default and the isolation choice of decision 5.
- [ ] 0.4 Probe P3, and check the probes by mutation (decision 7). In a scratch file that is not committed, use the harness's `useEngine` in each engine:
  - (a) A board-page `evaluate` that sends one WebSocket frame and returns: is the frame always in `run.browser.sockets` when the call resolves? Run it 200 times.
  - (b) A view `postMessage` followed by the `viewSettled` flush, drafted in the scratch file: has the board page always handled the message? Run it 200 times.
  - (c) A scratch build in which pressing an arrow key in the plain-choice board sends one draft after `DRAFT_DEBOUNCE_MS`: does a test using `draftSettled` fail in each engine?
  
  Tests: none (probe). Verify: the note gives, per engine, the counts for (a) and (b) and the outcome of (c). Any channel and engine pair that is not 200 out of 200 is recorded as a `quiet` fallback in decision 7 through `/opsx:update`.
- [ ] 0.5 Inventories, read-only:
  - (a) The smoke set: for each spine check of decision 4, the file and the exact test title that covers it, chosen from the candidates; a check no file covers names why. Also the set's file count, and its Chromium time, measured serially, when uncontended.
  - (b) The perf assertions: every assertion of a time bound of the view spec under `packages/view/test/browser/` (grep `toBeLessThan`, `toBeLessThanOrEqual` and `performance.now`/`Date.now`), with its file and line and whether it moves to the perf set; each other timing assertion, with why it stays (a timeout, the spine's 1 s).
  - (c) The quiet waits: every `Bun.sleep` on `QUIET_MS`, whole or `QUIET_MS / 3`, with its file and line and its probe class (decision 7), as a table split into group 4's three batches. It includes the Kanban order tests kanban-order added to `kanban.browser.ts` (M2).
  - (d) The manifest inventory: the 145 `*.browser.ts` files on `main`, each with its engines and its smoke or perf class, `kanban.browser.ts` with all three engines; the helpers `harness/kanban-drag.ts` and `fixtures/kanban-documents.ts` are not entries.
  
  Tests: none. Verify: (a) covers every spine check, within 25 files and 5 min; (b) and (c) cover every grep hit (158 sites in 63 files at a3f2708d: 144 whole, 14 `QUIET_MS / 3`, with `expectNoReconnect` and its 7 callers); (d) lists every file `ls packages/view/test/browser/*.browser.ts` gives. (a) over budget, or (b) a bound outside the four perf files plus `latex.browser.ts`, goes through `/opsx:update` of decisions 4 and 6.
- [ ] 0.6 Baseline. On the base commit, record:
  - the pass, skip and fail counts per engine of a full browser run (`--serial` if the machine is busy, with its load average);
  - its time per engine;
  - conformance on Bun, per configuration;
  - the `perf` lines that `table-bounds` prints;
  - whether WebKit's "ten presses of Tab never reached Answer" (CLAUDE.md, CI) still fails; if it does, file it under The backlog (`type:defect`, `source:e2e`, after the duplicate search; none found on 2026-11-14) and give its number.
  
  Tests: none. Verify: the note holds the counts and times, and the WebKit outcome with its Issue number if filed. Group 7 compares against them: the same test count per engine, give or take only the tests that moved and the median runs that now share one test (task 3.2).

## 1. The manifest of browser files

- [ ] 1.1 Tests first: write `harness/suites.test.ts` (decision 4). It covers the failures decision 4 lists: a file with no entry, an entry with no file, a narrowed entry without `why` or without `enginesFor` in its file, an inline `enginesFrom(...).filter(`, and a `SPINE_CHECKS` entry outside the smoke set or with a title not in its file. It also tests `enginesFor`, which returns the manifest's engines intersected with `ASKBOARD_E2E_ENGINES`, in the harness's order. Run against `main`'s files, the test fails for the missing manifest. Verify: `bun test packages/view/test/browser/harness/suites.test.ts` fails for that reason only.
- [ ] 1.2 Write `harness/suites.ts`: `BROWSER_FILES` with every file from task 0.5(d)'s inventory and 0.5(a)'s classification, `SPINE_CHECKS` from task 0.5(a), and `enginesFor`. Switch `markdown-total` and `markdown-bounds` to `enginesFor(import.meta.path)`, with `why` citing Markdown bounded work ("in Chromium and WebKit"). Tests: task 1.1. Verify: task 1.1 passes, the check is green, and coverage is met for `suites.ts`. A browser run of the two narrowed files in all three engines shows no Firefox test and the same Chromium and WebKit counts as task 0.6.
- [ ] 1.3 Review checkpoint: spec review (askboard-spec-reviewer) of group 1's range against decision 4 and the spine's Tests row. Verify: no open finding of severity high or medium. Each finding becomes a task before groups 2 to 4, or is answered in the note.

## 2. The runner: sets, workers, shards

- [ ] 2.1 Tests first: write `run-options.test.ts` and `run-plan.test.ts` (decision 5).
  - Options: parse `--set`, `--workers`, `--shard k/n` and `--update-timings` beside the existing options. Refuse a bad set, `0` workers, `k > n` or a malformed shard, with the usage line. `--set` defaults to `all`, and the worker default follows task 0.3's value.
  - Plan: `smoke` gives the smoke files per engine with `--parallel`. `full` gives every non-perf file, filtered per engine by the manifest. `perf` gives the perf files with no `--parallel`, no `--shard` and no `--timings`, engines in turn. `all` gives `full` then `perf`. Smoke and full passes add `--timings` only when the engine's file exists, with or without `--shard`; `--no-isolate` appears only if task 0.3 chose it.
  
  Verify: both fail for the missing modules.
- [ ] 2.2 Write `run-options.ts` and `run-plan.ts`, and move `run.ts` onto them. Keep the spawning, the signal cleanup and a summary line per engine per pass (pass, fail and seconds). Add `timings/` with one file per engine, in `tools/test-timings.json`'s format, written by `--update-timings` on one full run; smoke and full passes pass `--timings` so the slow files start first. Isolation follows task 0.3(c). Tests: task 2.1. Verify: task 2.1 passes, the check is green, and coverage is met. A browser run of `--set smoke --engines chromium` passes. A browser run of `--set full --engines chromium --shard 1/2` and then `2/2` together hold task 0.6's Chromium count of `full` files.
- [ ] 2.3 `package.json`: `test:e2e` keeps its command (now `all`), and `test:e2e:smoke` runs `run.ts --no-build --target session-process --set smoke --engines chromium && bun packages/server/test/conformance/run.ts --runtime bun` (D1, D4). Tests: a case in `run-options.test.ts` that reads both scripts from `package.json` and parses their runner arguments. Verify: the test passes. `bun run build && bun run test:e2e:smoke` passes, and its time is in the note.
- [ ] 2.4 Review checkpoint: spec review of group 2's range against decision 5 and D4. Verify: no open finding of severity high or medium. Each finding becomes a task, or is answered in the note.

## 3. The perf pass and the median

- [ ] 3.1 Tests first: write `harness/perf.test.ts` and `harness/perf-files.test.ts` (decision 6; requirement Timed bounds judged in the perf pass).
  - `perf.test.ts`: `median` of three, and of an even count, refused for none; `expectMedianWithin` passes on [92, 131, 97] against 100 and fails on [1,900, 2,300, 2,450] against 2,000, printing the `perf` line with all three figures. These are the delta spec's first two scenarios.
  - `perf-files.test.ts`: the manifest's `perf` files are exactly those that import `harness/perf.ts`, and no other file holds a bounded timing assertion, except entries whose reason names a timeout.
  
  Verify: both fail for the right reasons (no module; four files not yet importing it).
- [ ] 3.2 Write `harness/perf.ts`. Convert `table-bounds`, `markdown-total`, `markdown-bounds` and `latex-bounds`, and every other site from task 0.5(b), so that each form takes `PERF_RUNS` fresh-page runs inside one test, asserts its functional outcomes on every run (the delta spec's third scenario), and judges each gate once on the median. Gates and budgets stay as they are (D6). Set `perf: true` on those files in the manifest. Tests: task 3.1. Verify: task 3.1 passes and the check is green. A browser run of `--set perf --engines chromium,webkit` passes on an idle machine and prints a `perf` line for every gate; the note lists the medians beside task 0.6's figures.
- [ ] 3.3 Move `latex.browser.ts`'s timed test (`:400-405` at a3f2708d) into `latex-bounds`, judged on the median against the 2-second bound with no `QUIET_MS` allowance (decision 6, LaTeX previews one at a time). Tests: `perf-files.test.ts` (no bounded timing left in `latex.browser.ts`). Verify: the test passes. The browser run of `latex` and `latex-bounds` in Chromium and WebKit keeps the moved test's title, and its pass count is unchanged.
- [ ] 3.4 Review checkpoint: spec review of group 3's range against decision 6 and the delta spec. Every scenario must have a test: the fourth (no bound in the parallel set) through `perf-files.test.ts` and `run-plan.test.ts`; the fifth through the spine text of task 6.1. Verify: no open finding of severity high or medium. Each finding becomes a task, or is answered in the note.

## 4. Round-trip probes in place of the quiet wait

- [ ] 4.1 Tests first: write `harness/probes.test.ts` (decision 7).
  - The guard: no `Bun.sleep(` whose argument names `QUIET_MS` (`QUIET_MS / 3` included) under `packages/view/test/browser/` outside `quiet`, and every `quiet(` call carries a non-empty string literal. A case feeds it a scratch text with `Bun.sleep(QUIET_MS / 3)` and expects a refusal.
  - Unit cases with a fake board for `draftSettled` (waits at least `DRAFT_DEBOUNCE_MS`) and for `timerSettled`.
  
  Verify: the guard fails, listing the sites from task 0.5(c); the unit cases fail for the missing module.
- [ ] 4.2 Write `harness/probes.ts` with the five helpers, applying task 0.4's per-engine fallbacks. Move `expectNoReconnect` onto `timerSettled` with the constant from task 0.2, and `harness/tree-steps.ts:64` onto its probe class. Tests: task 4.1's unit cases, plus one browser case per probe in a new `probes.browser.ts` (manifest entry, all engines). Each case is given a scratch-free positive control: an action that does send, which the probe must observe. Verify: the unit cases pass, and a browser run of `probes` passes in the three engines.
- [ ] 4.3 Batch 1 of task 0.5(c): the approval, pick-field, form, document-review and atoms files. Replace each site by its class. Tests: the guard counts down; the batch's files are the tests. Verify: a browser run of the batch's files in the three engines has the same pass count as task 0.6, with no failure. The note gives the time saved per engine and lists each `quiet` kept, with its reason.
- [ ] 4.4 Batch 2: the tree, wbs, gantt, timeline, kanban (with the order tests kanban-order added, which sleep `QUIET_MS / 3` three times) and ranking files. Tests and Verify as for task 4.3.
- [ ] 4.5 Batch 3: the rest, including `latex.browser.ts` once task 3.3 has landed. Tests: the guard passes with no site left outside `quiet`. Verify: as for task 4.3, and the guard passes.
- [ ] 4.6 Mutation check (decision 7). Re-run task 0.4(c)'s scratch fault on two converted sites per probe class, in the three engines. Verify: each converted test fails on the fault in every engine and passes without it. The note lists the sites and outcomes.
- [ ] 4.7 Review checkpoint: spec review of group 4's range against decision 7. The reviewer checks a sample of ten converted sites for class fit, and that no assertion was weakened (the same expectations, only the wait changed). Verify: no open finding of severity high or medium. Each finding becomes a task, or is answered in the note.

## 5. The workflows

- [ ] 5.1 Tests first: write `tools/ci/e2e-workflows.test.ts` (decisions 1 to 3), beside `changed-paths.test.ts`, reading the YAML with `Bun.YAML.parse` as `tools/release/workflow.test.ts` does. It checks:
  - `e2e.yml`'s triggers and the cron lines;
  - the `plan` job's cadence table, through a shell-free extraction of its `case` mapping, or a fixture per event if the extraction is not practical;
  - that the `plan` job takes `code` from `sh tools/ci/changed-paths.sh` on a checkout of depth 2, and that no e2e workflow holds a path list of its own;
  - that `build`, `browser` and `conformance` have no job-level `if` on `code` and end after one step when it is false (#173's always-run rule), and that only `perf` is skipped by `if`;
  - the concurrency group in `ci.yml`'s shape with the cadence, cancelling only on `pull_request`;
  - D1's pull-request jobs: `ubuntu-24.04`, smoke set, Chromium, Bun with three configurations;
  - D2 and D3's matrices: three engines × 4 shards, and the perf job;
  - `browser.yml`'s Playwright cache step unchanged after the build or the download;
  - `permissions: contents: read` and no wider grant in any job;
  - no `pull_request_target`, no `secrets:`, no `${{ }}` inside a `run` script, and `persist-credentials: false` on each checkout;
  - every `uses:` either a local path or an `actions/*` action pinned by a 40-character SHA;
  - a `timeout-minutes` on each job.
  
  Verify: the test fails for the missing workflow.
- [ ] 5.2 `browser.yml` and `conformance.yml`:
  - Add the inputs `code` (boolean, default `true`), `build-artifact`, `set`, `engines` (JSON), `shards` (JSON list of `k/n`), `runtimes` (JSON) and `workers`. Defaults keep today's manual behaviour.
  - With `code` false, the job ends after one step that says why (as `check.yml` does).
  - With `build-artifact`, download the build in place of `bun run build`; the cache and install steps stay as #173 left them.
  - The browser job passes `--set`, `--shard` and `--workers` to `run.ts`, and uploads `timings/` as an artifact when the set is `full`.
  
  Tests: task 5.1's cases for both files. Verify: they pass, and `actionlint` is clean if installed (the note says if not).
- [ ] 5.3 Write `e2e.yml` (decisions 1 to 3, D1 to D3; with Node 26 per Q1's answer in task 0.1), and add `release.yml`'s `e2e-macos` job to `publish`'s `needs` (delta spec `packaging`, The release workflow). Tests first: task 5.1's cases for `e2e.yml`; a case in `tools/ci/e2e-workflows.test.ts` that `publish` needs `e2e-macos`, which calls `e2e.yml` with `cadence: weekly` and no secrets; `tools/release/workflow.test.ts`'s job list and needs moved to include `e2e-macos` (its other cases unchanged); `e2e` added to the workflow list of `tools/codex-interop.test.ts`. Verify: they pass and the check is green. `gh workflow view` is not needed: the first live run is task 7.2.
- [ ] 5.4 `ci.yml` (decision 1): delete the `browser` and `conformance` jobs and the comment lines that send the suites to a dispatch; drop the three `if: github.event_name != 'workflow_dispatch'` lines, so a dispatch runs `openspec`, `check` and `codex`; keep every other line #173 wrote. Tests first: cases in `tools/ci/e2e-workflows.test.ts` asserting that `ci.yml` calls neither `browser.yml` nor `conformance.yml` and that its three jobs run on a dispatch; `tools/ci/changed-paths.test.ts` stays green unchanged. Verify: the tests pass, and `git diff origin/main -- .github/workflows/ci.yml` shows only those lines.
- [ ] 5.5 Review checkpoint: spec review of group 5's range against decisions 1 to 3, D1 to D3 and the `packaging` delta, plus a security review (askboard-security-reviewer). This group adds workflows that a public repository runs on pull requests from forks: check token scope, the trigger kind, secrets, expressions in run scripts, artifact use within one run, and pinned actions (AD-19). Verify: no open finding of severity high or medium. Each finding becomes a task, or is answered in the note.

## 6. Documents

- [ ] 6.1 The spine (decision 8). Append the CI cadence clause to the Tests row, in the words of decision 8, adjusted per task 0.1. Set `updated` to the task's date, and add one `sources` line naming this change's defaults D1 to D6 as taken under the unattended run of 2026-11-14, after kanban-order's line (M2). Tests: none (document). Verify: `git diff` of the spine changes only the frontmatter and that row. The row's existing sentences are byte-identical, and the clause names the smoke set, the manifest's engine rule, the perf pass and the three cadences.
- [ ] 6.2 `CLAUDE.md` (decision 9), after task 5.4: in the CI section #173 wrote, the composition bullet, the `changed-paths.sh` bullet, the Triggers bullet's browser and conformance sentence and its local rule, and the ruleset bullet's status names; in Development commands, the lines for `test:e2e`, `test:e2e:smoke` and the runner's `--set`, `--workers`, `--shard` and `--update-timings`. Tests: `tools/codex-interop.test.ts` (it reads `CLAUDE.md`). Verify: it passes, `./setup.sh --check` reports no stale Codex files after `./setup.sh --codex-only`, and the diff touches only those bullets and lines.
- [ ] 6.3 `docs/as-built/e2e-cadence.md`. Record:
  - where the code lives (`suites.ts`, `perf.ts`, `probes.ts`, `run-options.ts`, `run-plan.ts`, `timings/`, `e2e.yml`, `tools/ci/e2e-workflows.test.ts`);
  - the names and seams added (`BROWSER_FILES`, `SPINE_CHECKS`, `enginesFor`, `PERF_RUNS`, `expectMedianWithin`, the five probes, the runner's options, the workflow inputs, `release.yml`'s `e2e-macos`);
  - what it reuses from #173 (the `code` gate, the always-run rule, the cache step, the timings format) and the sentence of `docs/as-built/` it makes wrong, if any, corrected there;
  - that a later browser file must be listed in the manifest;
  - the defaults taken.
  
  No versions are bound, and no status is given. Tests: none. Verify: every name in the note is found by `git grep` on the head.
- [ ] 6.4 Review checkpoint: spec review of group 6's range against decisions 8 and 9, the delta spec's fifth scenario and CLAUDE.md's Working documents rules. Verify: no open finding of severity high or medium. Each finding becomes a task, or is answered in the note.

## 7. Integration and the pull request

- [ ] 7.1 Rebase onto `origin/main` and re-check (askboard-contract-versioning, Rebase procedure: no set is widened). Re-check every borrowed name from task 0.2 on the head, #173's included. Add the browser files that merged since to the manifest (M4). Tests: `suites.test.ts`, `tools/ci/e2e-workflows.test.ts` and `tools/release/workflow.test.ts`. Verify: the check, `bun run build` and `npx --yes @fission-ai/openspec@1.15.0 validate --all --strict --no-interactive` pass, and the note records main's SHA.
- [ ] 7.2 Full runs. Run `bun run test:e2e` locally (all three engines, `all`, then conformance on Bun) and `bun packages/server/test/conformance/run.ts --runtime node`. Then push the branch and open the pull request, whose own `e2e` run is the first Linux run of the suites (P5). Dispatch `e2e.yml` on the branch is not possible before the merge, so the nightly and weekly matrices are checked by `workflow_dispatch` right after the merge, as follow-up bullets. Tests: the suites. Verify: the counts per engine match task 0.6, apart from what tasks 3.2 and 3.3 moved. The local time is in the note, beside task 0.6's. The pull request's smoke and conformance jobs are green on Linux, or each Linux-only failure has an Issue or a fix task (design.md, Risks). Their times are in the note.
- [ ] 7.3 Pre-PR review: spec review and security review of the whole range, plus the kaizen step (askboard-delivery). The pull request body says `Closes #146` and `Closes #171` (plan item 1 merged as #173; item C4 moved to #172), unless #171 then names other open work, in which case `Refs #171`; it lists D1 to D6 as defaults and names Q1 and Q2. Verify: no open finding of severity high or medium, and the body has no AI attribution.

## Workflow follow-up

- After the merge, dispatch `e2e.yml` with `cadence: nightly` and `cadence: weekly` on `main` once each, and file any failure under The backlog with `source:e2e`.
- Refresh `timings/` from the first nightly's artifact if the shards differ by more than 2×.
- Archive the change once its pull request is merged, with `Refs #171`.
