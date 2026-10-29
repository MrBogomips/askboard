# Design

## Context

The repository holds documents, OpenSpec and one CI job (OpenSpec validation). The constraints come from the spine:

- **Stack:** Bun 1.4.4 as toolchain, runtime and bundler; Node 24.22.1 or later as fallback runtime; TypeScript 7.0.2, with `@typescript/typescript6` as an npm alias only for tools that need a compiler API, which TypeScript 7 does not ship.
- **AD-1:** the dependency diagram, enforced in CI. `compute` and `ask-core` use no DOM, Node-only or Bun-only API. Inside `packages/server`, six units (`mcp-tools`, `board-host`, `excerpts`, `molecule-source`, `snapshot`, `notifier`) are adapters that never import each other.
- **AD-19:** every dependency meets the addendum's adoption rule; CI fails on a licence outside it or on an archived dependency. No shipped unit uses a Bun-only API.
- **Consistency Conventions:** packages are `@askboard/<unit>`, versions follow semver, dependencies are pinned exactly.
- **Repository:** private, GitHub Free. Linux CI minutes are budgeted; macOS jobs run selectively.

## Goals / Non-Goals

**Goals:**

- The source tree the spikes and epics build in, with each package's allowed imports enforced from the first commit.
- One command that runs every local check, and the same checks in CI.
- Checks that are tested themselves, so a passing run means something.

**Non-Goals:**

- Builds, bundles and the executable (packaging spike, E11).
- Schemas and the generated-file checks of the Consistency Conventions (E1 onwards).
- Browser tests, the conformance suite and Node runs of the session process (E1 onwards).
- The adoption check's stars and activity criteria in CI: they are checked by hand when a dependency is adopted, and AD-19 asks CI only for licence and archive status.

## Decisions

### 1. Bun workspace with isolated installs

The root `package.json` declares `packages/*` as workspaces, `packageManager: bun@1.4.4` and a Volta pin for Node. Installs use Bun's isolated linker, so a package resolves only the dependencies it declares, and an undeclared `@askboard/*` import fails at resolution as well as in the import check.

*Alternative:* hoisted installs. Rejected: an undeclared import would resolve silently, leaving the import check as the only guard.

### 2. Ten packages, from the spine's layer table

`contract`, `core`, `compute`, `server`, `view`, `widgets`, `molecules`, `mod`, `hooks`, `bench`, each private, at `0.0.0`, ESM, with `src/index.ts` as its entry. `view` also exports the two entries other units may import: `./assemble` (for `snapshot`, AD-9) and `./catalog` (the `CatalogRenderer` port, for `widgets`). The server units are directories under `packages/server/src/<unit>/`.

The layer table lists `packages/hooks/` while the Structural Seed's source tree omits it; this change follows the layer table and adds the folder to the source tree, so the two agree.

### 3. TypeScript 7 with per-package configurations

A strict `tsconfig.base.json` (`module: preserve`, `moduleResolution: bundler`, `verbatimModuleSyntax`, `noEmit`): Bun runs TypeScript directly and builds come later. `core` and `compute` set `lib` to an ECMAScript level without DOM and `types: []`, so DOM, Node and Bun APIs don't type-check there (AD-1). Test files compile under a separate configuration that adds `@types/bun`, so `bun:test` stays out of the source configuration.

*Alternative:* type-check with TypeScript 6. Rejected: the Stack pins 7.0.2, and the 6 alias exists only for tools that need a compiler API.

### 4. Biome for formatting and linting

One tool, fast, with no TypeScript compiler API.

*Alternative:* ESLint with typescript-eslint. Rejected: typed linting needs a compiler API, so it would run on the TypeScript 6 alias, with two type systems in one repository.

### 5. `bun test` with an 80% coverage threshold

No dependency to add. Unit tests of runtime-neutral code can run on Bun because the type configuration in decision 3 already prevents runtime-specific APIs. The Node runs that AD-19 asks for are conformance runs that start the session process, so they don't depend on the unit test runner; browser tests come with their own runner when the view is built.

*Alternative:* Vitest, which also runs on Node and in browsers. Not chosen now: it adds a second bundler to the toolchain before any browser test exists. If the renderer spike or E1 needs one runner for both, they revisit this.

### 6. Import check: a small tested script in `tools/`

`tools/check-imports.ts` holds the rules as one table, transcribed from the spine's diagram and AD-1 and citing them:

| Unit | May import |
| --- | --- |
| `contract` | no AskBoard unit |
| `compute` | `contract` |
| `core` | `contract`, `compute` |
| each server unit | `core`, `contract`; also `molecules` for `molecule-source`, and `view/assemble` for `snapshot`; never another server unit |
| `molecules` | `contract` |
| `view` | `contract`, `compute` |
| `widgets` | `contract`, `compute`, `view/catalog` |
| `mod`, `hooks`, `bench` | `contract` |

It extracts each file's import specifiers with Bun's transpiler and resolves `@askboard/*` specifiers and relative paths to a unit. It reports every disallowed edge with the file, the specifier and the rule broken, and fails. It also fails on Node built-ins and on `bun` or `bun:*` imports in the source files of `core` and `compute`; test files are exempt from that ban, but not from the unit boundaries. Fixtures cover each rule, in both directions.

`tools/` is repository tooling, not a shipped unit, so it may use Bun APIs; AD-19's ban applies to shipped units.

*Alternative:* dependency-cruiser. Rejected: it parses TypeScript through the compiler API, which TypeScript 7 does not ship, and the rules fit a short script with its own tests.

### 7. Licence check: a small tested script in `tools/`

`tools/check-licences.ts` enumerates every package in the lockfile and reads its licence from the installed `package.json`:

- **Passes:** MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD. The addendum names MIT, Apache-2.0 and BSD as its examples of OSI-approved permissive licences; ISC and 0BSD are the same kind.
- **Passes, unmodified only:** MPL-2.0 and EPL-2.0. The check fails if such a package is patched.
- **Fails:** anything else, including GPL, AGPL, LGPL, a missing licence, `UNLICENSED` and "SEE LICENSE IN". The LGPL exception concerns Bun's runtime, not an npm package, and is still pending.
- **SPDX expressions:** `OR` passes when one alternative passes; `AND` needs all.
- **Archived:** for each direct dependency, the check reads the repository from its `package.json` and asks the GitHub API whether it is archived. It fails if it is archived, or if no repository can be found.
- **Without a token:** a local run reports that it skipped the archive step. CI always has a token, so CI never skips it.
- **Overrides:** `tools/licence-overrides.json` corrects wrong package metadata only, each entry with the package, version, licence found and evidence. It never admits a licence outside the rule; the script refuses an override that would.

### 8. CI: one more Linux job

A `check` job on `ubuntu-24.04`:

1. `actions/checkout` and `oven-sh/setup-bun`, both pinned by commit SHA. `setup-bun` is the official action of the pinned toolchain, as `setup-node` is for Node.
2. `bun install --frozen-lockfile`.
3. `bun run check`, which runs the type check, Biome, `bun test --coverage`, the import check and the licence check, with `GITHUB_TOKEN` set.

The job uses `permissions: contents: read`. Dependabot gains the Bun ecosystem, weekly.

## Risks / Trade-offs

- [TypeScript 7.0.2's npm package, CLI name or build mode differ from what this design assumes] → The first task checks them; the fallback is one `tsc -p` per package from a root script.
- [Bun 1.4.4's isolated linker behaves differently in a workspace than expected] → A task verifies that an undeclared import fails to resolve; if it doesn't, the import check still catches it.
- [Package licence metadata is wrong or missing] → The check fails loudly; a reviewed override with evidence fixes metadata, never the rule.
- [The rules table drifts from the spine's diagram] → One table citing the spine section. A change to the diagram updates the table in the same OpenSpec change (CLAUDE.md, "How they change").
- [A custom check misses a form of import, such as dynamic `import()` or `export … from`] → Fixtures cover static imports, re-exports, dynamic imports with literal specifiers and type-only imports.

## Migration Plan

Greenfield: nothing to migrate. Rollback is reverting the merge commit.

## Open Questions

- **Where the executable's entry point lives.** It serves both the session process and `askboard hook <event>` (AD-19), in `packages/server`, `packages/hooks` or a packaging entry. The packaging spike (§10.4) settles it. This change creates both packages and no entry point, so nothing here depends on the answer.
