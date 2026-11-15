# Tasks

Each task writes its tests first and sees them fail for the right reason before implementing.

Terms used below:

- **"The check"** means `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`.
- **"Browser run"** means `bun packages/view/test/browser/run.ts --no-build --target session-process` after `bun run build`, with the options the task names. Run one browser run at a time on the machine.
- **"Case (g)"** means the case "(g) a closed ask: …" of `packages/view/test/browser/reopen-session.browser.ts`. Run it alone with `ASKBOARD_E2E_ENGINES=chromium ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/reopen-session.browser.ts -t "\(g\)"`, after `bun run build`.
- **"Decision n"**, **"Dn"**, **"Hn"**, **"Pn"** and **"Q1"** refer to design.md. A requirement cited by name is in this change's delta spec, unless the task names `openspec/specs/`.
- Commit bodies say `Refs #196` for group 1, `Refs #198` for group 2, `Refs #197` for the keyboard tasks, or each that applies.

**Order.** Group 0 runs first. Then group 1, group 2 and task 3.1 may run in parallel, because their files are disjoint:

- Group 1 edits only `harness/perf.ts`, `harness/perf.test.ts` and `markdown-total.browser.ts`.
- Group 2 edits `reopen-session.browser.ts`, and, if the cause lies in the product, only the module that holds it and its unit test (decision 8). It does not edit `harness/perf.ts`.
- Task 3.1 edits only `.github/workflows/browser.yml` and `tools/ci/e2e-workflows.test.ts`.
- Each group commits its own paths only (`git add <paths>`, never `-a`).
- Browser runs never overlap: a perf run of 1.2 or 1.3 runs alone on the machine, so group 2's runs wait for it, or it waits for them.

Task 3.2 follows groups 1 and 2, since it records their names and #198's cause. Task 3.3 follows 3.1 and 3.2. Group 4 comes last.

## 0. Decisions and base

- [x] 0.1 Record the PO's answer to Q1 under design.md's Open Questions: (a), from #197's comment of 2026-11-15 (D4; decision 5). Tests: none (documents). Verify: Q1 carries its answer line, D4 says the PO decided it, and #197 has no `needs-po` label.
  - Note: done by the `/opsx:update` of 2026-11-15 that also added #198 (group 2); `needs-po` was already off #197.
- [x] 0.2 Base and borrowed names (design.md, Merge points). On `origin/main`, check each borrowed name with `git grep -n` and record its file and line, with main's SHA. This includes #198's names. Confirm that no workflow or test sets or reads `ASKBOARD_PERF_RUNNER` or writes `AppleKeyboardUIMode` yet. Tests: none. Verify: the note lists every name with its file and line. If a name is missing or its shape differs, stop for `/opsx:update` before group 1.
  - Note: checked on `origin/main` e2cc5fd3 (only a bun.lock bump past the base) with `git grep -n`; all names present, shapes as designed. `perf.ts`: `PERF_RUNS` :15, `perfLine` :33, `expectMedianWithin` :40, `judgeMedians` :62, `perfRuns` :84. `markdown-total.browser.ts`: `DENSE_WAIT_MS` :30, `DENSE_TEST_TIMEOUT_MS` :31. `browser.yml` steps :86 and :104; `release.yml` `e2e-macos` :111; `e2e-workflows.test.ts` browser.yml describe :510. #198: `reopen-session.browser.ts` (g) :613, `reopenPrefills` :62, `prefillReopened` :111, `DRAFT_DEBOUNCE_MS` :10, `reloadBoard` :110, `sentDrafts` :74, `quiet` :113, spec scenario :3604. No file outside `openspec/` and `docs/` names `ASKBOARD_PERF_RUNNER` or `AppleKeyboardUIMode`.
- [x] 0.3 Probe P1 locally, on a Mac, without touching the global setting (decision 5).
  - Read Playwright WebKit's bundle id (`CFBundleIdentifier` of `Playwright.app` in the Playwright cache) and the global `defaults read -g AppleKeyboardUIMode`.
  - Run `defaults write org.webkit.Playwright AppleKeyboardUIMode -int 0`, then a browser run of `board.browser.ts` with `--engines webkit`.
  - Run `defaults delete org.webkit.Playwright AppleKeyboardUIMode` and repeat the run.
  - Tests: none (probe).
  - Verify:
    - the first run fails with "ten presses of Tab never reached Answer";
    - the second passes;
    - after the delete, `defaults read org.webkit.Playwright AppleKeyboardUIMode` reports no such key and the global value is as read at the start.
  - Record the bundle id, the values and both outcomes in the note. If the first run passes, the hypothesis does not hold: stop for `/opsx:update`.
  - Note: P1 holds locally. Bundle id `org.webkit.Playwright` (webkit-2388 `Playwright.app`); global `AppleKeyboardUIMode` = 2, per-app key absent at start and at end. With the per-app key set to 0, `board.browser.ts` "answering with the keyboard only" on WebKit failed with "ten presses of Tab never reached Answer" (a wider `-t board` run: 12 failures of the keyboard cases); after `defaults delete` it passed (1 pass). Global value unchanged.

## 1. The runner factor on the perf bounds (#196)

- [ ] 1.1 The factor in `harness/perf.ts` (decision 2; requirement Timed bounds on a hosted runner).
  - Tests first, in `harness/perf.test.ts`:
    - `perfFactor(undefined)` is 1, `perfFactor("Linux")` is 2 and `perfFactor("macOS")` is 3.
    - `perfFactor("Windows")` and `perfFactor("")` throw, naming the value and both keys.
    - `expectMedianWithin` with factor 3 passes `[398, 214, 177]` against gate 100, and its line ends `gate 100 factor 3 bound 300`.
    - With factor 2 it fails `[240, 260, 250]` against gate 100, and the message names the bound 200.
    - With factor 1 the line is today's text, unchanged.
    - `below` keeps its strictness at the scaled bound.
    - `judgeMedians` and `perfRuns` apply the factor they are given.
    - A child `bun` process that imports `perf.ts` with `ASKBOARD_PERF_RUNNER=Windows` exits non-zero, naming the value, before any output of a judgement.
  - Then implement `PERF_RUNNER_FACTORS`, `perfFactor`, `PERF_FACTOR` (evaluated at load), `perfScaled(ms)`, the `factor` parameter of `expectMedianWithin` and its pass-through in `judgeMedians` and `perfRuns`.
  - Verify: the new cases fail before the change and pass after, the existing `perf.test.ts` and `perf-files.test.ts` cases still pass, and coverage of `perf.ts` is at least 80%.
- [ ] 1.2 The dense Markdown case (decision 4; D3).
  - Tests first, in `harness/perf.test.ts`: `perfScaled(120_000)` is 120,000 at factor 1 and 360,000 at factor 3.
  - Then pass `DENSE_WAIT_MS` and `DENSE_TEST_TIMEOUT_MS` in `markdown-total.browser.ts` through `perfScaled`. Its "not ready in … s" line must name the scaled wait.
  - Verify:
    - the unit cases pass;
    - a browser run of `markdown-total.browser.ts` with `--set perf --engines chromium` passes locally, with no variable set;
    - `git diff` shows no change to `BOUND_MS` or any other gate.
- [ ] 1.3 The local perf pass (requirement Timed bounds judged in the perf pass, scenario "A developer's machine"). Tests: none new. Verify:
  - a browser run with `--set perf --engines chromium,webkit` passes with no variable set, and its `perf …` lines carry no `factor`;
  - the same run with `ASKBOARD_PERF_RUNNER=Linux` prints `factor 2 bound …` on every line.
  - Record the pass counts and the worst ratio in the note.
- [ ] 1.4 Review checkpoint: spec review of group 1's range (askboard-spec-reviewer). No security review: the group touches only the test harness. Verify: every finding is fixed as a task, tests first, or recorded with its reason, and the review's range and verdict are in the note.

## 2. Reopen-session case (g) (#198)

- [ ] 2.1 Reproduce case (g) and find its root cause (decision 8; `openspec/specs/view-and-widgets/spec.md`, scenario "A closed ask after a reload"). Tests: none (probe). Any instrumentation is a temporary edit and is not committed.
  - Run case (g) alone in Chromium with `--rerun-each 10`.
  - Then add load until it fails: a browser run of the whole set with `--engines chromium`, three times; then Chromium's CPU throttling (CDP `Emulation.setCPUThrottlingRate`, 4) on case (g)'s page.
  - On a failing run, log with timestamps:
    - the board states the page received;
    - each draft record `board-host` received (`sentDrafts`), against the done of the close;
    - the record restored after the reload;
    - the Timeline before the reload.
  - Verify:
    - the note gives the failure rate alone and under each load;
    - it names H1, H2, H3 or another cause, quoting the log lines that show it;
    - #198 has a comment with the cause, the evidence and the corrected Expected (design.md, Open Questions). For H3, the comment also moves #198 from `sev:M` to `sev:L`.
  - If nothing fails locally, dispatch the browser workflow on the branch for Chromium with the logging (design.md, Risks).
  - If the cause needs a spec change, stop for `/opsx:update`.
- [ ] 2.2 Fix the cause, tests first (decision 8; NFR-10, AD-10).
  - Product cause: a unit test in the package that holds the cause (for example `shell/reopen-prefill.test.ts`, the draft mirror's test, or `board-host`'s draft-record test). It reproduces 2.1's ordering with no browser or timer, and it fails before the fix. Then the fix: a closed ask is never filled, and its late records are refused.
  - Test cause: case (g) establishes its premise deterministically and keeps every assertion.
  - Verify:
    - the unit test fails before the fix and passes after (product cause);
    - case (g) passes with `--rerun-each 20` alone, and in three runs under the load that failed in 2.1;
    - `reopen-session.browser.ts` passes in a browser run with `--engines chromium,firefox,webkit`, and any other failure is mapped to #145;
    - `git diff` adds no `quiet` call or fixed wait and removes no assertion;
    - the check passes.
- [ ] 2.3 Review checkpoint: spec review of group 2's range (askboard-spec-reviewer). Add a security review (askboard-security-reviewer) when the range touches `packages/view/src` or `packages/server/src`; otherwise the note says the range is test-only. Verify: every finding is fixed as a task, tests first, or recorded with its reason, and each review's range and verdict are in the note.

## 3. The workflow and the records (#196, #197, #198)

- [ ] 3.1 `browser.yml` (decisions 2 and 5, D4 as the PO chose it; requirements Timed bounds on a hosted runner and Keyboard cases with the platform's keyboard navigation).
  - Tests first, in `tools/ci/e2e-workflows.test.ts`, under the `browser.yml` describe:
    - The step "Browser tests against the built session process" sets `ASKBOARD_PERF_RUNNER: ${{ runner.os }}` in its `env`, and no other step or workflow under `.github/workflows/` names the variable.
    - A step "Keyboard navigation on (macOS)" has `if: inputs.code && runner.os == 'macOS'`. It comes after "Install the engine with its system dependencies" and before the browser tests. Its `run` writes `defaults write -g AppleKeyboardUIMode -int 2`, reads the value back and exits non-zero unless it is 2, and holds no `${{ }}`.
    - No other workflow writes a `defaults` key.
    - The step's script, run through `sh` with a stub `defaults` on `PATH`, exits 0 when the read-back is 2 and non-zero otherwise.
  - Then edit `browser.yml`.
  - Verify: the new cases fail before the edit and pass after, the whole file passes, `tools/release/workflow.test.ts` still passes, and `actionlint` is clean if installed (else say so).
- [ ] 3.2 Records (decision 6). After groups 1 and 2. Tests: none (documents), except that `bun run check` stays green, since `tools/` tests read `CLAUDE.md` and the spine.
  - `CLAUDE.md`, CI section: remove the sentence "Known: `browser.yml` WebKit fails on …". Add the factor and variable sentence, and the macOS step with the local Keyboard navigation setting.
  - The spine's Tests row: one clause on the hosted runners' factor.
  - `.claude/skills/askboard-implementation/references/test-harness-patterns.md`: the timed-checks rule names `PERF_FACTOR`, `perfScaled` and the variable.
  - `docs/as-built/ci-e2e-gates.md`: where the code lives; the names `PERF_RUNNER_FACTORS`, `perfFactor`, `PERF_FACTOR`, `perfScaled`, `ASKBOARD_PERF_RUNNER` and the macOS step; D1 to D3 as defaults and D4 as the PO's answer to Q1; #198's cause, its evidence and its fix (task 2.1's note); no versions bound.
  - Verify:
    - `grep -n "never reached Answer" CLAUDE.md` finds nothing;
    - each named file carries its sentence;
    - `./setup.sh --check` reports whether the Codex files are stale, and `./setup.sh --codex-only` refreshes them if so;
    - the check passes.
- [ ] 3.3 Review checkpoint: spec review of group 3's range, plus a security review (askboard-security-reviewer), because the group changes a workflow of a public repository that the release gate calls. Verify: every finding is fixed as a task, tests first, or recorded with its reason, and both reviews' ranges and verdicts are in the note.

## 4. On the runners, then the pull request

- [ ] 4.1 Probes P1 and P2, and #198's fix on the hosted runners. Push the branch, then run `gh workflow run e2e.yml --ref worktree-fix-ci-e2e-gates -f cadence=weekly` and the same with `-f cadence=nightly`. Tests: the runs themselves. Verify:
  - every `perf` job is green on both runners, and the note records each runner's worst median against its scaled bound;
  - on macOS, the 17 WebKit cases #197 lists pass;
  - case (g) passes in Chromium on both runners, and in Firefox on Linux;
  - any other failure is mapped to an open Issue (#174, #145, #191, #199 to #201), or filed as a new one (`source:e2e`, with its area), including the dense Markdown case if it is still not ready (design.md, Risks).
  - Record both run IDs.
- [ ] 4.2 Rebase onto `origin/main` and re-check every borrowed name (askboard-contract-versioning; no set is widened, so nothing is bound). Verify:
  - `git grep` finds each name on the rebased head;
  - the check and `npx --yes @fission-ai/openspec@1.15.0 validate --all --strict --no-interactive` pass;
  - the note records main's SHA.
- [ ] 4.3 Pre-PR review: spec review and security review of the whole range, plus the kaizen step (askboard-delivery). The pull request body says:
  - `Closes #196`;
  - `Closes #197` if task 3.1 showed the 17 cases green, `Refs #197` otherwise;
  - `Closes #198` if task 4.1 showed case (g) green on both runners; otherwise `Refs #198`, and the plan goes back through `/opsx:update`;
  - D1 to D3 as defaults, D4 as the PO's answer to Q1, and #198's cause.

  Verify: both reviews' verdicts and the pull request number are in the note.
