---
name: askboard-implementation
description: How to implement one task group of an AskBoard OpenSpec change in this repository, test-first, without the rework this project keeps paying for (flaky timing, environment leaks, cross-browser failures, broken locators, view chunk budget, i18n catalogs, Bun and Biome quirks). Use it whenever you edit packages/*, tools/build, tests under packages/*/test, or the view build for a task of an openspec/changes/<name>/tasks.md. Not for generic coding questions or for writing OpenSpec artifacts.
---

# Implementing an AskBoard task group

You implement ONE task group of an OpenSpec change, inside the change's worktree, as the coordinator assigned it (the session that runs `/opsx:apply` or the `askboard-delivery` skill). This skill adds what the OpenSpec workflow does not know: the rework classes of this repository. `CLAUDE.md` holds the commands, the working documents and the invariants; do not restate them, follow them. The test patterns are in `references/test-harness-patterns.md`: read it before writing any browser, conformance or timing-dependent test.

## Per-group workflow

1. **Read first.** The group's tasks in `openspec/changes/<name>/tasks.md`, each task's Verify clause, the design decisions and spec requirements the tasks cite, and the spine's ADs they name. Check the names a task borrows with `git grep` before relying on them. If a name or behaviour differs from the plan, stop and report it; do not work around it (widget-answers task 0.2 is the example).
2. **Name the tests, then write them first.** One failing test per Verify clause and per spec scenario. Run them and see them fail for the right reason (the message names the missing behaviour, not a typo or a missing import). A test that cannot fail proves nothing: E1's dialog assertion could not fail and was removed in review (#8).
3. **Implement the minimum** that passes. Keep files under about 400 lines and functions short.
4. **Run the package's tests**, then the whole check: `GITHUB_TOKEN=$(gh auth token) bun run check` (stops at the first failure). Coverage of every file you add or change must be at least 80% of lines and functions, read from the per-file table, not the total.
5. **View, widgets or `tools/build/` changed:** run `bun run build:view` and handle the chunk budget (below). Run the browser files that touch what you changed, on Chromium and WebKit (`bun packages/view/test/browser/run.ts --engines chromium,webkit --target session-process -- -t <pattern>`: the file argument does not narrow a run, see the reference). Do not run the full three-engine suite unless the caller asks.
6. **Stay in the group's packages.** If the task needs an edit outside them (another package, `docs/`, specs, CI, `package.json`, `bun.lock`), say so in the report and keep that edit minimal and separate. Never hand-edit `.claude/commands/opsx/` or `.claude/skills/openspec-*`.
7. **Tick and note.** Tick the task box in `tasks.md` and add a `  - Note:` of about five lines: what was built, the commit, test counts (pass, skip, fail), deviations from the plan. Notes over 2,000 characters bury the decisions (several in widget-answers and push-delivery do); reasoning belongs in the design, through the caller. Where the task or the change has a GitHub Issue (the proposal's `Issue: #n`), the note names it, and so does the commit body (`Refs #n`, never `Closes`, which only the pull request says). Do not commit unless the caller says so; when you do, use conventional commits with no attribution lines.
8. **Report to the caller:** tasks done, test counts, files touched (absolute paths), deviations, open questions, the Issues opened, and what only CI can verify.

A defect you find outside the group's tasks is not fixed in passing: after the duplicate search, it becomes a new Issue labelled `source:review` with its type and severity (`CLAUDE.md`, The backlog), named in the note of the task where you found it and in the report.

## When to stop and ask

Stop and report as a question, with what you found, instead of choosing:
- A runtime behaviour of Claude Code or the mod API that you cannot read in code, a probe or a spec. Never guess it: #24 reworked E4 after merge because an in-process teammate's hook `agent_id` was assumed to be `name@team`; the probe showed an opaque ID.
- A task or design decision that contradicts the spine, the PRD or the current code.
- A wording, label or UX choice the change lists as open for the PO.
- A fix that would need weakening an existing assertion to pass.
- A change to a contract set version, an AD or a requirement that the task does not name.

## Rules by area

### View chunk budget
`bun run build` fails when a chunk grows more than 10% over `packages/view/chunk-sizes.json`. Growth within 10% still moves the baseline for the next change, so when the growth is yours and meant, record it in the same commit: `bun run build:view --record-sizes`, with the reason in the commit body. #29 let growth pass unrecorded and it surfaced later as a surprise. Do not record to silence an unexplained jump; find the cause first.
- #8: the contract leaked agent-side schemas into view chunks until `packages/contract/package.json` got `"sideEffects": false`. Import only what the view needs from `@askboard/contract` subpaths.
- #13: the shell went from 28 to 83 KB. A new dependency belongs in a lazily loaded chunk or in the shared library chunk (`shared-modules.ts`; #18 added Toggle Group to `radix` that way).
- Rebasing onto a change that re-recorded the file conflicts here: take main's file, rebuild, record again (#31 re-recorded four times).

### i18n (E8, #31)
The en-US and it-IT string tables are in `packages/view/src/strings/`: `keys.ts` (`STRING_KEYS`), `en-US.ts`, `it-IT.ts`, `index.ts` (`t`, `fill`). A new user-facing string needs the key in `keys.ts`, its text in BOTH tables with the same `{slots}` (and `one` and `other` forms, `other` holding `{count}`, for counts), and a call through `t`, never a literal in a component. `packages/view/src/strings/strings.test.ts` fails when the tables disagree in keys, slots, emptiness or plural forms; `in-italian.test.ts` checks the Italian side. Agent content is never a string here (FR-34). Number, money, percentage and date formats come from `packages/contract/src/locale/` (AskBoard's own, no `Intl`).
Known gap: Tree and Gantt chrome (toolbar, "Day | Week | Month", legend, molecule columns) is English-only. `drafts/design-review-2026-11-06.md` F-04 asks to move it into the catalogue; F-21 (two date formats in the Gantt) and F-26 (literal backticks in a string) are related. Do not add new widget chrome as a literal English string unless the task says the gap stays; if a task adds widget chrome, route it through the catalogue and add an it-IT browser scenario.

### Bun and Biome quirks
- Bun 1.4.4 `toMatchObject` writes `expect.any(...)` matchers into the checked object: validate the object first, or match a copy.
- Bun drops a leading `--` in argument lists: the browser runner takes extra `bun test` arguments after another option (`--no-build -- <args>`), never first.
- The browser runner's file argument does not narrow a run (#18): select with `-- -t <pattern>` and check the output names the tests you meant.
- Bun's `realpath` on macOS refuses a Unix socket (#28): resolve the socket's folder instead (see the walk in `packages/server/src/excerpts`).
- Bun's native WebSocket buffers one whole frame, up to the live board's limit of about 6 MB, before AskBoard sees it, while Node cuts a pre-connect socket at 64 KiB (#13, review finding 1): a test of pre-connect limits asserts the refusal, not the byte count at which it happens, and runs on both runtimes.
- `@types/bun` is pinned per package to the Bun pin in `packageManager` (#10); a workspace test fails if any manifest differs. Bump by hand, all together.
- Biome reorders export blocks: an appended export block goes last in the entry module, with a blank line, a detached comment, a blank line (#18, #23). Run `bun run format` and check that `git status` shows only your files.

### Import boundaries and shared seams
AD-1 binds imports; `tools/check-imports.ts` holds the table (`bun run check:imports`). `core`, `compute` and `mod` use no DOM, Node or Bun API; `hooks` and `mod` import only `contract`. Another package is imported as `@askboard/<name>`, never by relative path. A change to the dependency diagram updates the table in the same OpenSpec change. Contract set versions move only as the task says; a test that pinned an old version is updated to state the new one, with no assertion about behaviour weakened.

### Fail closed
Every task that touches answers, revisions or epochs includes a test that the failing case appends nothing and reports nothing the user did not send (NFR-10, AD-10). A graph or check that cannot be built refuses the request; it never throws past the tool and never reports "no answer yet".

## Pointer
Test patterns, helpers with paths, cross-engine notes and the CI-only rule: `references/test-harness-patterns.md`.
