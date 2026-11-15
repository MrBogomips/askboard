# Tasks

Each task writes its tests first and sees them fail for the right reason before implementing.

Terms used below:

- **"The check"** means `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`.
- **"Browser run"** means `bun packages/view/test/browser/run.ts --no-build --target session-process` after `bun run build`, with the options the task names. Run one browser run at a time on the machine.
- **"Decision n"**, **"Dn"**, **"Pn"** and **"Q1"** refer to design.md. A requirement cited by name is in this change's delta spec.
- Commit bodies say `Refs #196` for group 1 and `Refs #197` for the keyboard tasks, or both where a task serves both.

**Order.** Group 0 runs first. Then group 1 and task 2.1 may run in parallel, since their files are disjoint:

- Group 1 edits only `harness/perf.ts`, `harness/perf.test.ts` and `markdown-total.browser.ts`.
- Task 2.1 edits only `browser.yml` and `tools/ci/e2e-workflows.test.ts`.

Task 2.2 follows group 1, because it names group 1's names. Group 3 comes last.

## 0. Decisions and base

- [ ] 0.1 Record the PO's answer to Q1 from #197's comments under design.md's Open Questions, as "Answer (<date>): …". An answer other than (a) goes through `/opsx:update` before task 2.1: (b) adds a harness helper and its tests in place of task 2.1's step, (c) adds a narrowed engine list for WebKit on macOS. Tests: none (documents). Verify: Q1 carries an answer line. Or the note says none has come; then task 2.1 waits, or, in an unattended run, takes (a) as a recorded default with `needs-po` left on #197.
- [ ] 0.2 Base and borrowed names (design.md, Merge points). On `origin/main`, check each borrowed name with `git grep -n` and record its file and line, with main's SHA. Confirm that no workflow or test sets or reads `ASKBOARD_PERF_RUNNER` or writes `AppleKeyboardUIMode` yet. Tests: none. Verify: the note lists every name with its file and line. If a name is missing or its shape differs, stop for `/opsx:update` before group 1.
- [ ] 0.3 Probe P1 locally, on a Mac, without touching the global setting (decision 5).
  - Read Playwright WebKit's bundle id (`CFBundleIdentifier` of `Playwright.app` in the Playwright cache) and the global `defaults read -g AppleKeyboardUIMode`.
  - Run `defaults write org.webkit.Playwright AppleKeyboardUIMode -int 0`, then a browser run of `board.browser.ts` with `--engines webkit`.
  - Run `defaults delete org.webkit.Playwright AppleKeyboardUIMode` and repeat the run.
  - Tests: none (probe).
  - Verify:
    - the first run fails with "ten presses of Tab never reached Answer";
    - the second passes;
    - after the delete, `defaults read org.webkit.Playwright AppleKeyboardUIMode` reports no such key and the global value is as read at the start.
  - Record the bundle id, the values and both outcomes in the note. If the first run passes, the hypothesis does not hold: stop for `/opsx:update`.

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

## 2. The workflow and the records (#196, #197)

- [ ] 2.1 `browser.yml` (decisions 2 and 5; requirements Timed bounds on a hosted runner and Keyboard cases with the platform's keyboard navigation). Waits for 0.1.
  - Tests first, in `tools/ci/e2e-workflows.test.ts`, under the `browser.yml` describe:
    - The step "Browser tests against the built session process" sets `ASKBOARD_PERF_RUNNER: ${{ runner.os }}` in its `env`, and no other step or workflow under `.github/workflows/` names the variable.
    - A step "Keyboard navigation on (macOS)" has `if: inputs.code && runner.os == 'macOS'`. It comes after "Install the engine with its system dependencies" and before the browser tests. Its `run` writes `defaults write -g AppleKeyboardUIMode -int 2`, reads the value back and exits non-zero unless it is 2, and holds no `${{ }}`.
    - No other workflow writes a `defaults` key.
    - The step's script, run through `sh` with a stub `defaults` on `PATH`, exits 0 when the read-back is 2 and non-zero otherwise.
  - Then edit `browser.yml`.
  - Verify: the new cases fail before the edit and pass after, the whole file passes, `tools/release/workflow.test.ts` still passes, and `actionlint` is clean if installed (else say so).
- [ ] 2.2 Records (decision 6). Tests: none (documents), except that `bun run check` stays green, since `tools/` tests read `CLAUDE.md` and the spine.
  - `CLAUDE.md`, CI section: remove the sentence "Known: `browser.yml` WebKit fails on …". Add the factor and variable sentence, and the macOS step with the local Keyboard navigation setting.
  - The spine's Tests row: one clause on the hosted runners' factor.
  - `.claude/skills/askboard-implementation/references/test-harness-patterns.md`: the timed-checks rule names `PERF_FACTOR`, `perfScaled` and the variable.
  - `docs/as-built/ci-e2e-gates.md`: where the code lives; the names `PERF_RUNNER_FACTORS`, `perfFactor`, `PERF_FACTOR`, `perfScaled`, `ASKBOARD_PERF_RUNNER` and the macOS step; D1 to D4 with Q1's answer; no versions bound.
  - Verify:
    - `grep -n "never reached Answer" CLAUDE.md` finds nothing;
    - each named file carries its sentence;
    - `./setup.sh --check` reports whether the Codex files are stale, and `./setup.sh --codex-only` refreshes them if so;
    - the check passes.
- [ ] 2.3 Review checkpoint: spec review of group 2's range, plus a security review (askboard-security-reviewer), because the group changes a workflow of a public repository that the release gate calls. Verify: every finding is fixed as a task, tests first, or recorded with its reason, and both reviews' ranges and verdicts are in the note.

## 3. On the runners, then the pull request

- [ ] 3.1 Probes P1 and P2 on the hosted runners. Push the branch, then run `gh workflow run e2e.yml --ref worktree-fix-ci-e2e-gates -f cadence=weekly` and the same with `-f cadence=nightly`. Tests: the runs themselves. Verify:
  - every `perf` job is green on both runners, and the note records each runner's worst median against its scaled bound;
  - on macOS, the 17 WebKit cases #197 lists pass;
  - any other failure is mapped to an open Issue (#174, #145, #191, #198 to #201), or filed as a new one (`source:e2e`, with its area), including the dense Markdown case if it is still not ready (design.md, Risks).
  - Record both run IDs.
- [ ] 3.2 Rebase onto `origin/main` and re-check every borrowed name (askboard-contract-versioning; no set is widened, so nothing is bound). Verify:
  - `git grep` finds each name on the rebased head;
  - the check and `npx --yes @fission-ai/openspec@1.15.0 validate --all --strict --no-interactive` pass;
  - the note records main's SHA.
- [ ] 3.3 Pre-PR review: spec review and security review of the whole range, plus the kaizen step (askboard-delivery). The pull request body says:
  - `Closes #196`;
  - `Closes #197` if task 3.1 showed the 17 cases green, `Refs #197` otherwise;
  - D1 to D4 as defaults, with Q1's answer or its open state;
  - that the release gate still waits on #198.
  
  Verify: both reviews' verdicts and the pull request number are in the note.
