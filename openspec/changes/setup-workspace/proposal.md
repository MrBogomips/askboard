# Proposal

## Why

AskBoard has a finished design and no code. Every spike and epic on the roadmap builds in the source tree the spine plans (Structural Seed), and AD-1 and AD-19 ask CI to fail on imports that cross the dependency diagram and on dependencies outside the adoption rule. Setting up the workspace and those two checks first means the first spike already builds in the right layout, and no boundary or licence slip gets in unnoticed.

## What Changes

- **Toolchain pins.** Bun 1.4.4 (`packageManager`), Node 24.22.1 or later pinned for the repository with Volta, TypeScript 7.0.2, as in the spine's Stack.
- **Bun workspace.** A root `package.json` with `packages/*` as workspaces and one package per unit group in the spine's layer table: `contract`, `core`, `compute`, `server`, `view`, `widgets`, `molecules`, `mod`, `hooks`, `bench`. Each is `@askboard/<name>`, private, at `0.0.0`, with an empty entry point. No product code.
- **TypeScript.** A strict base configuration; `core` and `compute` compile without DOM, Node or Bun types, so a use of those APIs fails the type check (AD-1).
- **Format, lint and tests.** Biome for formatting and linting; `bun test` with coverage.
- **Import-boundary check (AD-1).** A repository check that fails on any import crossing the spine's dependency diagram, between packages and between the units inside `packages/server`, and on Node or Bun built-ins in `core` and `compute`. It has its own tests.
- **Licence check (AD-19).** A repository check that fails on an installed dependency whose licence is outside the addendum's adoption rule, and on a direct dependency whose repository is archived. It has its own tests.
- **CI.** A second Linux job runs install, type check, lint, tests, the import check and the licence check on every push to `main` and every pull request. The OpenSpec job stays. Dependabot also bumps the Bun dependencies weekly, except `@types/bun`, which moves with the Bun pin.
- **Spine.** The Structural Seed's source tree gains `packages/hooks/`, which the layer table already lists, and `tools/` for the repository checks. The Stack gains the pins of the tooling this change adopts, each after its adoption check.
- **Repository records.** `CLAUDE.md` and `README.md` list the new commands and the new status.
- **Not in this change:** the plugin manifest, `hooks/hooks.json`, `skills/`, `agents/`, the launcher under `scripts/`, any schema, and the browser and conformance test set-ups. They arrive with the spikes and epics that need them.

## Capabilities

### New Capabilities

None. The change adds tooling and no product behaviour, so its `.openspec.yaml` sets `skip_specs: true`. Capability specs come with the epics (SOLUTION-DESIGN §3.1).

### Modified Capabilities

None.

## Impact

- **New files:** root `package.json`, `bun.lock`, `tsconfig.base.json`, `biome.json`, `bunfig.toml`; `packages/<name>/` for the ten packages; `tools/` with the two checks and their tests.
- **Changed files:** `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitignore`, `CLAUDE.md`, `README.md`, `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (Structural Seed source tree, Stack).
- **Dependencies (development only):** `typescript` 7.0.2, `@biomejs/biome`, `@types/bun`, each checked against the adoption rule before it is pinned. No runtime dependency.
- **CI minutes:** one more Linux job of about two minutes per run; no macOS job.
- **Requirements and decisions served:** NFR-6, NFR-7; AD-1, AD-19; the spine's Consistency Conventions (unit and package names, versions, dependencies, tests).
