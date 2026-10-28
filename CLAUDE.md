# AskBoard

- Session context: MRB-ASKB

This file guides Claude Code when working in this repository.

## Overview

AskBoard is a local web board where a Claude Code agent asks the user structured questions through widgets and gets typed answers back. It ships as one Claude Code plugin and works in any Claude Code project.

**Status (2026-10-28): design complete, no code.** Next: the four spikes in `SOLUTION-DESIGN.md` §10 (mod delivery, formula, renderer with the final UX documents, packaging); each runs as an OpenSpec change and ends in a spine update. Pending: the PRD changes the architecture requested (§11, logged as `PRD-CHANGE:` in the architecture `.memlog.md`) and the UX run's change requests (`docs/ux-askboard-2026-10-27/prd-change-requests.md` and `architecture-change-requests.md`), not yet applied to the PRD and the spine. Build order: the widgets AXFX needs come first (§3.1).

## Design documents

- `docs/prd-askboard-2026-10-25/prd.md` (FR, NFR, SM, R IDs) and `addendum.md` (adoption rule, security model, benchmark protocol).
- `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`: AD-1 to AD-22 bind every change; also Consistency Conventions, Stack, Structural Seed (planned source tree) and Deferred.
- `SOLUTION-DESIGN.md` beside it explains the spine and adds no rules: §3.1 capabilities and units, §10 spikes, §11 pending PRD changes, §12 open items and owners, §13 verified facts.
- `docs/ux-askboard-2026-10-27/DESIGN.md` (how it looks: tokens, components) and `EXPERIENCE.md` (how it works: information architecture, states, interactions, accessibility, key flows); both win over the mockups in `mockups/`. Beside them, the UX run's change requests to the PRD (PCR) and the architecture (ACR), with the renderer spike checks S-1 to S-8.
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

## Planned stack (not yet in code)

TypeScript, built with Bun and shipped as a Bun-compiled executable; until the NFR-6 licence exception (§11) is applied and confirmed under AXFX NFR-1, the fallback is the plain JavaScript bundle on Node 24.22.1 or later (AD-19). Exact pins: the spine's **Stack** section; planned layout `packages/<unit>`, published as `@askboard/<unit>`: **Structural Seed**.

## Working documents

| Location | Role | Status | Git |
|---|---|---|---|
| `openspec/specs/` | Current behaviour specs | Authoritative; updated only through the OpenSpec sync or archive workflow | committed |
| `openspec/changes/` | Changes in flight; epics and spikes are changes | In-flight | committed |
| `openspec/changes/archive/` | Completed changes | Archive | committed |
| `docs/` | Design documents: PRD, architecture, UX. Owned by this repository since 2026-10-27 (UX since 2026-10-28), transferred from the planning repository, which removed its copies on 2026-10-28 | Authoritative | committed |
| `.claude/commands/opsx/`, `.claude/skills/openspec-*` | OpenSpec tooling, regenerated by `openspec update`; never hand-edited | Tooling | committed |
| `.github/` | CI and Dependabot | Tooling | committed |

- OpenSpec conventions prevail: create, change and archive its artifacts only through its workflow.
- Recorded on: 2026-10-27

## OpenSpec workflow and commands

OpenSpec 1.15.0, schema `spec-driven`. The rules for its artifacts (which IDs proposals and designs cite, capabilities per `SOLUTION-DESIGN.md` §3.1, platforms per NFR-7) are in the `context` field of `openspec/config.yaml`, which every OpenSpec workflow reads: change them there, not here.

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
- No build, lint or test commands exist yet. The checks CI will run on the code are listed in the spine's Consistency Conventions (Tests).

## CI (GitHub Actions, private repository on GitHub Free)

- `ci.yml` has one Linux job, OpenSpec strict validation, on push to `main` and on every pull request, with `OPENSPEC_TELEMETRY=0`. Actions are pinned by commit SHA with the version as a comment; Dependabot bumps them weekly.
- 2,000 included Actions minutes per month, and macOS runners cost about 10x Linux minutes. The spine's CI plan covers macOS and Linux: run macOS jobs selectively (on `main` or a release), not on every pull request.
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
