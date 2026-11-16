# AGENTS.md: AskBoard

The rules for every coding agent in this repository, edited here by hand. Claude Code reads this file through `CLAUDE.md`, a symbolic link to it, and its own lines in `.claude/CLAUDE.md`; Codex reads it directly. Folders with rules of their own have an `AGENTS.md` of their own: `docs/`, `.github/`, `tools/`. Write Issues, comments, commits, pull requests and artifacts in English.

## Overview

AskBoard is a local web board where a coding agent asks the user structured questions through widgets and gets typed answers back. It ships as one Claude Code plugin and works in any Claude Code project.

Where the project's state lives (this file holds no status, so parallel changes never edit it for their records):

- **Merged:** `git log origin/main`; the current behaviour in `openspec/specs/`; each change's artifacts in `openspec/changes/archive/`, and what it built in `docs/as-built/<change-id>.md`.
- **In flight:** `openspec list`, the open pull requests and the `in-change` Issues.
- **Left to the PO:** the Issues labelled `needs-po`.
- **Build order:** the widgets AXFX needs come first (`SOLUTION-DESIGN.md` §3.1).

## Design documents

- `docs/prd-askboard-2026-10-25/prd.md` (FR, NFR, SM, R IDs) and `addendum.md` (adoption rule, security model, benchmark protocol).
- `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`: AD-1 to AD-22 bind every change; also Consistency Conventions, Stack, Structural Seed and Deferred. `SOLUTION-DESIGN.md` beside it explains the spine and adds no rules.
- `docs/ux-askboard-2026-10-27/DESIGN.md` (how it looks) and `EXPERIENCE.md` (how it works); both win over the mockups in `mockups/`.
- `docs/README.md`: provenance and how the documents relate.

How they change:

- A change that alters a requirement or an AD updates the PRD or the spine in the same OpenSpec change.
- AD IDs stay stable: amend a decision in place, add the next AD-n for a new one, never renumber.
- Where the spine and the solution design differ, the spine wins.
- Folder names, `.memlog.md` records and citations of the planning repository: `docs/AGENTS.md`.

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

- TypeScript, built with Bun. Until AXFX NFR-1 admits the Bun-compiled executable (§11 entry 8), the shipped form is the plain JavaScript bundle on Node 24.22.1 or later (AD-19): the plugin's server entry and hooks run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/askboard`, which `exec`s the default `node` on `dist/askboard.mjs` (with Volta, the checkout's own pin applies from the plugin root). The script leaves `CLAUDE_PROJECT_DIR` as the host gave it (AD-12) and never takes it from the working directory.
- One product version, in lockstep in the root `package.json`, the ten packages and `.claude-plugin/plugin.json`. Exact pins: the spine's **Stack**; layout `packages/<unit>`, published as `@askboard/<unit>`: **Structural Seed**.
- Before touching a package, read the as-built notes that name it: `grep -l '<package or name>' docs/as-built/*.md`.

## Working documents

| Location | Role | Status | Git |
|---|---|---|---|
| `openspec/specs/` | Current behaviour specs | Authoritative; changed only by OpenSpec sync or archive | committed |
| `openspec/changes/`, `openspec/changes/archive/` | Changes in flight (epics and spikes are changes); completed changes | In-flight; archive | committed |
| `docs/` | Design documents: PRD, architecture, UX | Authoritative | committed |
| `docs/as-built/` | One note per OpenSpec change, `<change-id>.md`, written in the change's branch: what it built, where the code lives, the names and seams it added, the versions it bound | Record; never overrides `openspec/specs/` or the code | committed |
| `ROADMAP.md` | What is done and what is left for 1.0.0, linked to the Issues; updated at each release, never by a change | Summary; never overrides the Issues, `openspec/` or the PRD | committed |
| `drafts/` | Working documents later sessions need, such as spike research awaiting a decision | Draft; never overrides `docs/` or `openspec/` | committed |
| GitHub Issues (MrBogomips/askboard) | The backlog | Authoritative | remote |
| `issue-assets` branch | Images the Issues show; never merged into `main` | Evidence | remote only |
| `.agents/skills/openspec-*`, `.agents/skills/.openspec-target`, `.claude/skills/openspec-*` | OpenSpec's skills, written by `openspec update` to `.agents/skills/` and linked into `.claude/skills/`; never hand-edited | Tooling | committed |
| `.claude/agents/askboard-*`, `.claude/skills/askboard-*` | The agent harness; edited by hand | Tooling | committed |
| `AGENTS.md` (here and in `docs/`, `.github/`, `tools/`), its `CLAUDE.md` links, `.claude/CLAUDE.md` | The instruction files (Codex interop) | Source | committed |
| the rest of `.agents/skills/`, `.codex/` | The Codex form of the project skills and agents, written by `setup.sh` (Codex interop); never edited | Generated | gitignored |
| `skills/` | The plugin's skills, generated by `bun run build:skills`; never hand-edited; `check:skills` fails on drift | Generated | committed |
| `hooks/` | `hooks.json`, and the built mod `askboard-mod.js` (`bun run build:mod`) | Source and generated | `hooks.json` committed, the mod gitignored |
| `release` branch | The built plugin tree and its `marketplace.json`, one commit per release, tagged `v<version>`; written only by `release.yml`, never merged; `main` carries no build output or marketplace file (AD-19) | Generated | remote only |
| `dist/` | Build output of `bun run build`, which the plugin and the end-to-end tests run | Generated | gitignored |

OpenSpec conventions prevail (OpenSpec workflow and commands). The agent harness's change history is in `docs/harness-history.md`.

## The backlog

The Issues of `MrBogomips/askboard` are the authoritative backlog: the PO's requests, defects, and the decisions that belong to the PO. Session notes, agent memory, chat transcripts and `drafts/` are not: an item kept only there is lost to the next session. Hand work between sessions as Issue numbers, never as lists in a message.

- **Procedure:** the `askboard-backlog` skill holds the labels (type, source, severity, area), the duplicate search, triage, the link to a change and closing. Load it before you open, label or close an Issue.
- **Tools:** GitHub's MCP server and its `github-issues` skill, set up at user level; where they have no tool, `gh`. No project skill duplicates them.
- **An Issue is self-contained:** the steps, the expected and the observed behaviour and the evidence that matters, inline; never a local path as the only evidence.
- **Never** put a board link (it carries the token in `?t=`), a token or a session file in an Issue. The repository is public: nothing of the PO's other work (a client, a project, a document, a screenshot of one); reproduce on neutral content.
- A proposed default is not the PO's answer: work that depends on it waits; an unattended run that takes a default records it and leaves `needs-po` on.

## OpenSpec workflow and commands

OpenSpec 2.0.0, schema `spec-driven`; run it as `npx --yes @fission-ai/openspec@2.0.0 <command>`, never a global `openspec` of another version (the OpenSpec skills call a bare `openspec`, so a global one must be 2.0.0 too). The rules for its artifacts are in the `context` field of `openspec/config.yaml`, which every OpenSpec workflow reads: change them there, not here; its `rules` and `operations` wire in the agent harness.

- Create, change and archive its artifacts only through its workflow, under `openspec/changes/<id>/`; `openspec/specs/` changes only through sync or archive.
- A proposal cites `Issue: #n` beside the FR, NFR and AD IDs it serves, one line per Issue it resolves.
- A change records what it built in its own note, `docs/as-built/<change-id>.md`, never in this file. What it leaves to the PO is an Issue.
- Archive a change only after its pull request is merged.
- The steps: explore (never writes code), propose (all artifacts, then stops), update (revises a change's artifacts), apply, verify, sync, archive; the skills `openspec-explore`, `openspec-propose`, `openspec-update-change`, `openspec-apply-change`, `openspec-verify-change`, `openspec-sync-specs`, `openspec-archive-change`. Without them, the CLI: `new change <id>`, `instructions <artifact> --change <id>`, `status --change <id>`, `validate <id> --strict`, `instructions apply --change <id>`, `archive <id>`.
- `openspec validate --all --strict --no-interactive` is what CI runs. The `openspec update` CLI command regenerates OpenSpec's skills and is unrelated to the update step; after it, regenerate the Codex files.
- Keep one OpenSpec version everywhere: the local CLI, the CI pin in `openspec.yml` and the `generatedBy` of the generated skills.

## Agent harness

Project agents design, implement and review OpenSpec changes: one implementer runs a change's task groups in sequence, and the change is reviewed once, before its pull request.

- OpenSpec owns the artifacts; `askboard-architect` writes them only through the `openspec-*` skills. The apply step reads `operations.apply.guidance` in `openspec/config.yaml` and delegates through the `askboard-delivery` skill, which holds the flow and each agent's job.
- There is no gate on every prompt: use `askboard-delivery` to propose, apply, review, rebase or prepare the pull request of a change; answer questions and make small fixes directly.
- A change starts from its Issue and its pull request closes it (The backlog).
- Why the harness is shaped as it is: `docs/harness-history.md`. A change to the harness adds a row there.

## Codex interop

This file is the shared source; Codex reads it as it is.

- Claude Code reads it through `CLAUDE.md`, a symbolic link to `AGENTS.md`, here and in each folder that has one; its own lines are in `.claude/CLAUDE.md`. Edit `AGENTS.md`, never a `CLAUDE.md` link; the links need a checkout with symbolic links (`core.symlinks`, on by default on macOS, Linux and WSL's own git). This file holds no `@` import: Codex does not resolve them.
- The project skills (`.claude/skills/`, except OpenSpec's `openspec-*` links) and agents (`.claude/agents/`) are ported to `.agents/skills/` and `.codex/agents/` by the codex-port block of `setup.sh` with the latest rulesync, gitignored and never edited. Regenerate after changing a skill or an agent, after `openspec update`, after pulling `main` and in every new checkout: `./setup.sh --codex-only`; `./setup.sh --check` says, without the network, whether they are stale. CI regenerates them in the `codex` job.
- OpenSpec's skills are not ported: `openspec update` writes them to the committed `.agents/skills/openspec-*` and links them into `.claude/skills/`. The codex-port block skips every linked skill and never removes or overwrites its files, a local amendment the `port-to-codex` skill's template must keep.
- Not carried to Codex: the agents' model, effort, tools and preloaded skills. Codex loads `.codex/` only in a project the user has trusted.

## Development commands

```sh
./setup.sh                                           # set up a checkout or worktree: toolchain check, bun install, the Codex files
./setup.sh --ci                                      #   as CI runs it (set by CI=1 too): bun install --frozen-lockfile
./setup.sh --no-codex                                #   the toolchain check and the install only
./setup.sh --codex-only                              #   only regenerate the Codex files (--check: stale or not, offline; --dry-run: what it writes)
bun run check:agent                                  # the same steps, quiet: the failing step's failures and counts only, the full output in a log file
bun run check                                        # what CI runs, stopping at the first failure:
bun run typecheck                                    #   tsc -p on each package, then on tsconfig.test.json
bun run lint                                         #   Biome formatting and lint checks, no writes (bun run format applies fixes)
bun run test                                         #   bun test --parallel --no-isolate with coverage, 80% threshold
bun run check:imports                                #   import boundaries (AD-1)
bun run check:skills                                 #   skills/ matches its generator and stays within budget
GITHUB_TOKEN=$(gh auth token) bun run check:licences #   licences and archived direct dependencies (AD-19)
bun run build:skills                                 # regenerate skills/askboard/ and skills/askboard-help/ from the contract's teaching data
bun run build                                        # build:server (dist/askboard.mjs), build:view (dist/view/), build:mod (hooks/askboard-mod.js)
bun run test:e2e                                     # after a build: every browser file, engines in turn, then the perf files, then conformance in AD-1's three configurations
bun run test:e2e:smoke                               # after a build: the smoke set in Chromium, then conformance on Bun (what every pull request runs)
bun packages/view/test/browser/run.ts --set smoke|full|perf|all   # --workers <n>, --shard <k>/<n>, --engines a,b, --update-timings, --timings-out <file>; -- <bun test arguments> after another option
bun tools/release/version.ts <x.y.z>                 # one version in every manifest and bun.lock
```

- `test:e2e` needs Playwright's engines: `node_modules/.bin/playwright install chromium firefox webkit`. The same suites on Node 24, as CI runs them: `bun packages/server/test/conformance/run.ts --runtime node` (`--configuration` picks one of the three) and `bun packages/view/test/browser/run.ts --no-build --target session-process --runtime node --engines chromium`.
- The mod build bundles `packages/mod/src/index.ts` with standalone validators in place of `src/validators.ts`, and fails on an `import`, `require` or `import.meta` in its output, which the mod environment cannot load; it exports `register(on)` alone.
- The view build fails when a chunk grows more than 10% over `packages/view/chunk-sizes.json`; a change that means the growth runs `bun run build:view --record-sizes` and commits the file.
- The tests' default timeout is 30 s: a shared four-core runner takes five seconds for what a laptop does in one. Import rules, licences, test timings and tsconfig rules: `tools/AGENTS.md`.

## CI

- A change runs no full or multi-engine e2e suite locally: its new browser files are checked in Chromium only, and CI's smoke run on the pull request is its e2e gate (informative; read the conclusion with `gh pr checks`, not the log). A new browser file is listed in `packages/view/test/browser/harness/suites.ts` or a test fails.
- Agents read the browser runner's digest, never its log: counts per pass and one line per failing test, `new`, `flaky` (passed when its file ran again alone, `--rerun-failed`) or `known` (quarantined under its open Issue in `packages/view/test/browser/known-failures.json`, whose entry the change closing the Issue removes); only new failures fail a run. The quiet check is `bun run check:agent`.
- The e2e train runs the full three-engine suite on CI: `e2e.yml`'s nightly cadence on `main`, nightly or dispatched after a batch of merges. Its failures become `source:e2e` Issues, fixed in one stabilisation change; changes in flight never stop for them. A change that alters the runner, the browser harness or a widget's rendering dispatches a train on its branch before merge: `gh workflow run e2e.yml --ref <branch> -f cadence=nightly` (the PO's answer on #227, 2026-11-16). That train gates the merge: when it is red, its failures are compared with the last train on `main`, and the pull request merges only once every new failure is triaged, fixed in the change or filed as an Issue the PO accepts to defer (the PO, 2026-11-16, after #232 merged with 224 new failures).
- No ruleset requires a status yet: check that `openspec`, `check` and `codex` are green before merging. The e2e statuses are not required (the PO's answer, 2026-11-14).
- On a Mac, WebKit's keyboard cases need keyboard navigation on (System Settings > Keyboard > Keyboard navigation), or they fail with "ten presses of Tab never reached Answer".
- Workflows, cadence, runners and releases: `.github/AGENTS.md`.

## Git and pull requests

- Work on a branch in a worktree based on `origin/main`: one change, one worktree, one branch (Git / PR Working Policy).
- Agents never merge into `main` or push to it: every change goes through a pull request, which the PO merges. The one exception is a small fix (documents, typos, configuration) that the PO commits on `main` or asks to have committed there.
- Conventional commits: `<type>(<scope>): <description>`, type `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf` or `ci`, the scope optional (a package or a change). A commit body may say `Refs #n`; only a pull request body says `Closes #n`; an archive pull request says `Refs #n`.
- Before a pull request, run the checks in Development commands for what the change touches. The body says what changed and why, the checks run and their results, the `Closes` or `Refs` line, and what is left for the PO.
- No AI attribution of any kind: no tool, model or vendor named as author, co-author or generator; no co-author or session trailers; no links to an assistant's sessions or service; no "generated with" notes or badges. This holds for commits, pull requests, Issues, comments, code comments and documents.

## Git / PR Working Policy

- Worktree usage: enabled
- Worktree location: integrated
- Base branch: main
- Recorded on: 2026-10-27

- Integrated worktrees live in `.claude/worktrees/<name>/` on branch `worktree-<name>`; name them `feature-<slug>` or `fix-<slug>`. `.claude/worktrees/` is excluded locally in `.git/info/exclude`, not in `.gitignore`. Another agent creates one with `git worktree add .claude/worktrees/feature-<slug> -b worktree-feature-<slug> origin/main`.
- Run `./setup.sh` in a new worktree: `node_modules/` and the Codex files are not shared between checkouts.
- Small fixes (documents, typos, configuration) are committed directly on `main`; worktrees are for OpenSpec changes and extended work.
