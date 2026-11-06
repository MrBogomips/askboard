# AskBoard

- Session context: MRB-ASKB

This file guides Claude Code when working in this repository.

## Overview

AskBoard is a local web board where a Claude Code agent asks the user structured questions through widgets and gets typed answers back. It ships as one Claude Code plugin and works in any Claude Code project.

**Status (2026-11-06): E1 (the walking skeleton), E3 (`ask-lifecycle`), E4 (`push-delivery`), E5 (`excerpts`), E6 (`molecules`), E7 (`snapshot`), E8 (`settings-languages`) and `widget-answers` are merged and archived: an agent asks by pull and by push, with Tree, Gantt and molecule items, through the four tools `ask`, `update`, `collect` and `fetch`, on a board of several questions and areas. `widget-editing-plus` (#36, #39: Tree selection, bulk percentage adjustment with undo, drag and drop, Gantt TASK column, critical-path switch, requested plan durations) is merged and archived. `widget-registry` (a widget-type registry and the answer's `results` seam) is in flight as the base for the remaining FR-11 widgets. What the PO left to live runs and manual CI dispatches (Firefox, the full three-engine suite, Linux) is noted in the archived tasks and kept in the backlog.** Before them: the workspace and repository checks (`setup-workspace`), the approved model contract (`review-model-contract`, whose `examples/` seed `contract`), the PRD and UX change requests (§11, `apply-design-change-requests`), and the four spikes of `SOLUTION-DESIGN.md` §10 (renderer, mod delivery, packaging, formula), merged with their decisions applied to the PRD and the spine. The NFR-6 licence exception for the Bun executable was granted on 2026-10-30, subject to the AXFX NFR-1 contract change (§11 entries 7 and 8), which the PO files in the planning repository; until AXFX admits the executable, AskBoard ships the plain bundle on Node (AD-19). Next: the early benchmark on the walking skeleton (PRD R5), whose allowed tools gain `update` and `fetch` with E3. Build order: the widgets AXFX needs come first (§3.1).

## Design documents

- `docs/prd-askboard-2026-10-25/prd.md` (FR, NFR, SM, R IDs) and `addendum.md` (adoption rule, security model, benchmark protocol).
- `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`: AD-1 to AD-22 bind every change; also Consistency Conventions, Stack, Structural Seed (planned source tree) and Deferred.
- `SOLUTION-DESIGN.md` beside it explains the spine and adds no rules: §3.1 capabilities and units, §10 spikes, §11 PRD changes and their status, §12 open items and owners, §13 verified facts.
- `docs/ux-askboard-2026-10-27/DESIGN.md` (how it looks: tokens, components) and `EXPERIENCE.md` (how it works: information architecture, states, interactions, accessibility, key flows); both win over the mockups in `mockups/`. Beside them are the UX run's change requests to the PRD (PCR) and to the architecture (ACR), together with the renderer spike checks S-1 to S-8. All were applied on 2026-10-28.
- `docs/README.md`: provenance and how the documents relate.

How they change:

- A change that alters a requirement or an AD updates the PRD or the spine in the same OpenSpec change.
- AD IDs stay stable: amend a decision in place, add the next AD-n for a new one, never renumber.
- Where the spine and the solution design differ, the spine wins.
- Keep the folder names: they are the original run names, and cross-references such as `prd-askboard-2026-10-25/prd.md` in the spine depend on them.
- Each `.memlog.md` is the append-only decision record of its run: never rewrite its entries.
- Citations of working files not under `docs/` (`extract-*.md`, `review-*.md`, the PRD and architecture `reconcile-*.md`) point to the planning repository's git history (`agentxema_prd`: PRD at `cf5ac80`, architecture at `73d5cb6`, UX at `fe3f319`); citations of `../prd-agentxema-2026-10-21/` point to the AXFX PRD, which lives in the planning repository.
- The AXFX contract (AXFX PRD §5.10, §6, §7) lives in the planning repository; changes to it are requested there, not made here.

## Invariants every change respects

One line each; the binding text is in the cited IDs.

- **Independence** (FR-31, AD-19): depends on nothing in AXFX; documentation may name AXFX only as a user.
- **Licence** (NFR-6, AD-19): MIT. Every adopted component meets the adoption rule in `addendum.md` (licence, stars, activity), pinned exactly; a licence exception exists only through a PRD change.
- **No telemetry** (NFR-9, AD-11): AskBoard's own code makes no outbound connection; the one exception is the launcher fetching the pinned executable.
- **Fail closed** (NFR-10, AD-10): never return an answer the user did not give; an ask unknown to the current epoch is `discarded`, never "no answer yet".
- **Local machine only** (NFR-3, NFR-4, AD-11): listen on `127.0.0.1` (a container interface only on explicit opt-in), a token on every request.
- **Agent content is data** (NFR-5, AD-8): shown as data in a sandboxed view; no agent markup or code runs.
- **Platforms** (NFR-7): macOS and Linux, including devcontainers and CI runners; Windows only through WSL.
- **Imports** (AD-1): only along the spine's dependency diagram; `compute` and `ask-core` use no DOM, Node-only or Bun-only API.

## Stack

TypeScript, built with Bun and shipped as a Bun-compiled executable under the NFR-6 licence exception; until AXFX NFR-1 admits the executable (§11 entry 8), the shipped form is the plain JavaScript bundle on Node 24.22.1 or later (AD-19). Exact pins: the spine's **Stack** section; layout `packages/<unit>`, published as `@askboard/<unit>`: **Structural Seed**.

In code since `setup-workspace`: Bun 1.4.4 (`packageManager`), Node 24 pinned for the repository with Volta, TypeScript 7.0.2, Biome 2.6.4, every dependency pinned exactly; the ten packages of the spine's layer table under `packages/`.

In code since E1: `contract` (E1's schema sets, the board protocol, the view manifest, routes and `boardPagePolicy`, the shared fixtures), `core` (asks, epochs, event logs, cursors, answers), `server` (`mcp-tools`, `board-host`, `notifier` and the session process entry point `src/main.ts`), `view` (the board page, `assemble`, the shell and Choice), the view build in `tools/build/`, and the development plugin `.claude-plugin/plugin.json`, which runs `bun ${CLAUDE_PLUGIN_ROOT}/dist/askboard.mjs`.

In code since E3: the five sets E3 touches at their next minor (several questions and areas, FR-3's fields, the `update` and `fetch` requests and results, the lifecycle's events and states, board protocol 1.1 with act commands, action IDs, the draft record and closed asks) with the lifecycle's constants, fixtures and transcripts in `contract`; question and ask states, the user's acts applied once and atomically, revisions, the agent's updates, recorded answers, replies, closing, the draft record, the grace timer and tombstones, behind a `Clock` port, in `core`; the four approved tools and the full server instructions in `mcp-tools`, with `fetch` pages and `collect` pages and waits; protocol 1.1, the draft mirror and the takeover flush in `board-host`; and in `view` the lifecycle board: presentations and navigators, the full question card, the thread, delivery modes with Submit, agent-change notices, the draft mirror and restore, the leave-page prompt and the Closed banner.

In code since E4 (`push-delivery`): `contract`'s E4 block (standalone schemas for the local API, the session file, the push message, the closed event and the board's presence, origin and agent messages, compiled on first call; the session folder's paths; the constants), `core`'s owners and origins, `received` from pushes and stop blocks, the version gate, the agent status and the notices (`src/push/`), `board-host`'s local API on a Unix socket and the session file (`src/board-host/local-api/`), the system notification, `hooks` (`askboard hook <event>` and the local API client, `askboard client <path> [<body>]`, both run by `dist/askboard.mjs`), `mod` (built into `hooks/askboard-mod.js`), and `hooks/hooks.json` with the four hooks and the mod as the hooks module. The session folder is `$XDG_RUNTIME_DIR/askboard`, else `${TMPDIR:-/tmp}/askboard-<uid>`; the session file is named by the Claude Code PID (AD-5). In code since `widget-answers`: the widget sets in `contract` (input format 1.4, output 1.3, tool envelopes 1.4, board document 1.4, board protocol 1.5: Tree, Gantt and molecule-reference items in a question's `items`, the `answer` act's `values` and `derived`, the `formula` warning, an answer event's `tooLarge`, the widget wordings of request problems) with the approved UJ-2 ask and answer as fixtures; in `core`, the send-time expansion of molecule references through the `MoleculeSource` port (one expansion map per ask), AD-13's graph check, the widget answer check, the full edited value kept apart from the log (`AskCore.keptAnswerValues`), `changes` computed once per answer and `tooLarge` answers, and widget fetches; in `mcp-tools` and the session process, `ask` and `update` results with the graph's warnings and `fetch` of a question, a widget item, a reference or an expanded ID; and in `view` and the board page, widget answers sent, shown read-only after the logged answer with their receipt, restored after a reload, with the agent-change notice naming the widgets the agent changed. An answer carries the derived values of every computing item of its question, never alone. An agent asks widget and molecule questions by pull; `ask` and `update` refuse any other widget type, naming it. The `widgets`, `molecules`, `compute` and `bench` packages hold the Tree, Gantt, molecule definitions, formula engine and benchmark.

## Working documents

| Location | Role | Status | Git |
|---|---|---|---|
| `openspec/specs/` | Current behaviour specs | Authoritative; updated only through the OpenSpec sync or archive workflow | committed |
| `openspec/changes/` | Changes in flight; epics and spikes are changes | In-flight | committed |
| `openspec/changes/archive/` | Completed changes | Archive | committed |
| `docs/` | Design documents: PRD, architecture, UX. Owned by this repository since 2026-10-27 (UX since 2026-10-28), transferred from the planning repository, which removed its copies on 2026-10-28 | Authoritative | committed |
| `drafts/` | Working documents that later sessions need, such as spike research awaiting a decision before it becomes an OpenSpec change | Draft; never overrides `docs/` or `openspec/` | committed |
| `.claude/commands/opsx/`, `.claude/skills/openspec-*` | OpenSpec tooling, regenerated by `openspec update`; never hand-edited | Tooling | committed |
| `.claude/agents/askboard-*`, `.claude/skills/askboard-*` | The agent harness: project agents and their skills (see Agent harness); edited by hand | Tooling | committed |
| `.github/` | CI and Dependabot | Tooling | committed |
| `packages/` | Source: the ten `@askboard/<unit>` packages (spine, Structural Seed) | Source | committed |
| `tools/` | Repository checks and their tests: import boundaries (AD-1), licences (AD-19), workspace layout; the view build in `tools/build/` | Tooling | committed |
| `hooks/` | The plugin's hooks file `hooks.json` (committed) and the built mod `askboard-mod.js` (gitignored, from `bun run build:mod`) | Source and generated | `hooks.json` committed, the mod gitignored |
| `dist/` | Build output of `bun run build`: `askboard.mjs` (the session process) and `view/` (the board page, the chunks and their manifest), which the plugin and the end-to-end tests run | Generated | gitignored |

- OpenSpec conventions prevail: create, change and archive its artifacts only through its workflow.
- Recorded on: 2026-10-27; `drafts/`, `packages/` and `tools/` added on 2026-10-29; `tools/build/` and `dist/` on 2026-10-31; `hooks/` on 2026-11-01; the agent harness on 2026-11-06.

## OpenSpec workflow and commands

OpenSpec 1.15.0, schema `spec-driven`. The rules for its artifacts (which IDs proposals and designs cite, capabilities per `SOLUTION-DESIGN.md` §3.1, platforms per NFR-7) are in the `context` field of `openspec/config.yaml`, which every OpenSpec workflow reads: change them there, not here. The same file's `rules` (for designs and tasks) and `operations` (guidance for apply and archive) wire in the agent harness.

Slash commands, in workflow order: `/opsx:explore` (think; never writes code), `/opsx:propose` (creates the change and all its artifacts, then stops before implementation), `/opsx:update` (revises a change's artifacts), `/opsx:apply` (implements its tasks), `/opsx:verify`, `/opsx:sync` (merges delta specs into `openspec/specs/` without archiving), `/opsx:archive`.

```sh
openspec list                                      # changes in flight (--specs, --archived)
openspec status --change <name>                    # artifact completion of a change
openspec show <name>                               # a change or a spec
openspec validate --all --strict --no-interactive  # what CI runs
openspec update                                    # regenerate the opsx commands and skills
```

- The `openspec update` CLI command regenerates tooling; `/opsx:update` revises a change. They are unrelated.
- Keep one OpenSpec version everywhere: the local CLI, the CI pin (`@fission-ai/openspec@1.15.0` in `ci.yml`) and the `generatedBy` of the generated skills. Upgrade them together.

## Agent harness

Goal: design, implement and review OpenSpec changes with project agents whose model, effort and domain skills fit each job, and review each task group as it lands instead of only before the pull request.

- Spec process: OpenSpec owns the artifacts. `askboard-architect` writes them only through the opsx skills. `/opsx:apply` reads `operations.apply.guidance` in `openspec/config.yaml` and delegates through the `askboard-delivery` skill, which holds the flow, each agent's model and effort, and when to raise the effort.
- Entry point: there is no gate on every prompt; OpenSpec is the entry point. Use `askboard-delivery` to propose, apply, review, rebase or prepare the pull request of a change. Answer questions and make small fixes directly.
- The reviewers' memory lives outside the repository, in the user's agent memory folder, so parallel worktrees never conflict on it. Patterns they see recur become skill rules at the kaizen step before a pull request.

Change history:

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-11-06 | Initial setup: architect, implementer, spec and security reviewers; the delivery, review-protocol, threat-model, contract-versioning and implementation skills; design and tasks rules and apply and archive guidance in `openspec/config.yaml` | `.claude/agents/`, `.claude/skills/askboard-*`, `openspec/config.yaml` | Rework in PRs #8 to #35: version and seam collisions between changes, test timing and isolation, the chunk budget, spec drift found late, security findings. No gate on every prompt, by the PO's choice. |

## Development commands

```sh
bun install                                          # install the pinned dependencies (CI: --frozen-lockfile)
bun run check                                        # what CI runs, in this order, stopping at the first failure:
bun run typecheck                                    #   tsc -p on each package, then on tsconfig.test.json
bun run lint                                         #   Biome formatting and lint checks, no writes
bun run test                                         #   bun test with coverage, 80% threshold
bun run check:imports                                #   import boundaries (AD-1)
GITHUB_TOKEN=$(gh auth token) bun run check:licences #   licences and archived direct dependencies (AD-19)
bun run format                                       # Biome: format and apply safe fixes
bun run build                                        # build:server, then build:view, then build:mod:
bun run build:server                                 #   the session process, dist/askboard.mjs (ESM for Node 24 or Bun)
bun run build:view                                   #   the view, dist/view/ (board page, chunks, manifest)
bun run build:mod                                    #   the mod, hooks/askboard-mod.js (one ESM file, git-ignored)
bun run test:e2e                                     # after a build: browser tests on the session process, then conformance in AD-1's three configurations, on Bun
```

- `test:e2e` needs Playwright's engines: `node_modules/.bin/playwright install chromium firefox webkit`. The same suites on Node 24, as CI runs them: `bun packages/server/test/conformance/run.ts --runtime node` and `bun packages/view/test/browser/run.ts --no-build --target session-process --runtime node --engines chromium`. The browser runner also takes `--engines a,b`, `--serial` and `-- <bun test arguments>` after another option, since Bun drops a leading `--`.
- The mod build bundles `packages/mod/src/index.ts` with standalone validators in place of `src/validators.ts`, and fails on an `import`, `require` or `import.meta` in its output, which the mod environment cannot load; it exports `register(on)` alone.
- The view build fails when a chunk grows more than 10% over `packages/view/chunk-sizes.json`; a change that means the growth runs `bun run build:view --record-sizes` and commits the file.
- The development plugin: after `bun run build`, `claude --plugin-dir <checkout>` loads it in any project, with its hooks and the mod. A server whose start fails is skipped by new sessions for 15 minutes, so build first.
- The conformance suite runs AD-1's three configurations: mod and hooks, mod disabled, hooks disabled (`--configuration` picks one). Hooks run as processes of the built bundle, and the mod runs in a stand-in host of the mod API (`packages/server/test/conformance/mod-host.ts`), whose process runs, clock and `http.fetch` are real and whose agents, turns, appends, submits and UI calls are recorded.
- `tools/check-imports.ts` holds the rules table transcribed from the spine's dependency diagram and AD-1: a change to the diagram updates the table in the same OpenSpec change. Files in `packages/server/src` outside the six server unit folders are the session process entry point (`main.ts` and the files beside it): they compose the units, may import `core`, `contract`, every server unit and `hooks`, whose hook and client modes they dispatch, and nothing imports them (AD-1 as amended by E1 and E4). `hooks` and `mod` import only `contract`. A relative path may not leave its package or go through `node_modules`: another package is imported as `@askboard/<name>`, so its `exports` and the importer's declared dependencies apply.
- `core`, `compute` and `mod` compile without DOM, Node or Bun types, each stating its `lib` and `types` in its own `tsconfig.json`; the import check fails on a Node or Bun built-in in their sources, and on a `/// <reference types>` or non-ECMAScript `/// <reference lib>` in their sources or in `contract`'s, and the workspace test fails on import aliases (`paths`, `baseUrl`, `rootDirs`, a package.json `imports` field). Tests are `*.test.ts` files or files under `packages/<name>/test/`; they and `tools/` compile under `tsconfig.test.json`, with `@types/bun`.
- `check:licences` needs network access: packages in `bun.lock` meant for another platform are not installed, so their licences come from the npm registry. Without `GITHUB_TOKEN` it skips the archive lookups and says so; with `CI` set it fails instead. `tools/licence-overrides.json` corrects wrong package metadata only, with evidence, and never admits a licence outside the adoption rule. `tools/licence-texts.json` holds, by package and exact version, the licence text the view build ships for a package whose tarball has no licence file, with its source at a commit, its date and why; it is used only when the package.json licence matches, an entry with nothing to do fails the build, and it never admits a licence outside the adoption rule.
- Biome leaves Markdown, `docs/`, `drafts/`, `openspec/` and `.claude/` alone.
- The checks still to come are listed in the spine's Consistency Conventions (Tests).

## CI (GitHub Actions, private repository on GitHub Free)

- macOS only for now (`macos-latest`); NFR-7 still targets Linux, which comes back by passing `runs-on: ubuntu-24.04` in `ci.yml`, one line per call. `ci.yml` only composes reusable workflows (`workflow_call`, each with a `runs-on` input defaulting to `macos-latest`): `openspec.yml` (strict validation, with `OPENSPEC_TELEMETRY=0`), `check.yml` (`bun run check` with `GITHUB_TOKEN`), `browser.yml` (build, Playwright install, the browser tests against the session process, one matrix job per engine: chromium, firefox, webkit) and `conformance.yml` (the suite in its three configurations, matrix Bun and Node 24). The shared setup (Node, Bun from npm, `bun install --frozen-lockfile`) is the composite action `.github/actions/setup-bun`.
- Triggers: only openspec and check run automatically, on every pull request and push to `main`. Browser and conformance are suspended to save macOS minutes: run them locally (`bun run test:e2e`, with the conformance runs on both runtimes) before a merge that touches the view, the server or the conformance suite; in CI they run only on demand (`workflow_dispatch`). Known: `browser.yml` WebKit fails on "ten presses of Tab never reached Answer". Actions are pinned by commit SHA with the version as a comment; Dependabot bumps them and the Bun dependencies weekly, except `@types/bun`, which is bumped by hand together with the Bun pin in `packageManager` (a workspace test fails if they differ).
- 2,000 included Actions minutes per month, and macOS runners cost about 10x Linux minutes. The spine's CI plan covers macOS and Linux; with macOS only, the heavy suites stay on demand.
- When the minutes are used up, Actions usage is blocked.
- Branch rulesets and CodeQL code scanning are not available on private repositories with GitHub Free: a failing check does not block a merge, so check CI before merging.

## Git / PR Working Policy
- Worktree usage: enabled
- Worktree location: integrated
- Base branch: main
- Recorded on: 2026-10-27

Notes:

- Integrated worktrees live in `.claude/worktrees/<name>/` on branch `worktree-<name>`; name them `feature-<slug>` or `fix-<slug>`. `.claude/worktrees/` is excluded locally in `.git/info/exclude`, not in `.gitignore`.
- With the default `worktree.baseRef` (`fresh`), a worktree branches from `origin/main`: unpushed local commits are not in it.
- Small fixes (documents, typos, configuration) are committed directly on `main`; worktrees are for OpenSpec changes and extended work (recorded on 2026-10-28).
- Commits follow conventional commits: `<type>(<scope>): <description>`, scope optional.
