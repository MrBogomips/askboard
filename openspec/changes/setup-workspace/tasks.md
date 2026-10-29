# Tasks

## 1. Toolchain and adoption checks

- [ ] 1.1 Confirm the toolchain: `bun --version` prints 1.4.4, and `volta run --node 24 node --version` prints 24.22.1 or later. Record both exact versions in this task's note.
- [ ] 1.2 Check TypeScript 7.0.2 on npm: package name, compiler CLI name, and whether its build mode (`-b`) supports project references. Verify by running the CLI on a two-file throwaway project in the session scratchpad, and record the result and the fallback chosen (design, Risks).
- [ ] 1.3 Run the adoption check for `@biomejs/biome` and `@types/bun` (licence, stars, last push, last release, not archived) with data looked up now and cited with its date. If either fails, stop and ask the product owner. Verify that the results are recorded in this task's note.

## 2. Workspace and packages

- [ ] 2.1 Create the root `package.json` (private, `workspaces: ["packages/*"]`, `packageManager: bun@1.4.4`, Volta Node pin, exact development dependencies from 1.2 and 1.3), `bunfig.toml` (isolated linker, coverage threshold 80%) and `.gitignore` additions (`coverage/`, `*.tsbuildinfo`). Verify that `bun install` writes `bun.lock` and succeeds.
- [ ] 2.2 Create the ten packages (`contract`, `core`, `compute`, `server`, `view`, `widgets`, `molecules`, `mod`, `hooks`, `bench`) as `@askboard/<name>`, private, `0.0.0`, ESM, with `src/index.ts`. Add `view`'s `./assemble` and `./catalog` entries and the six server unit folders under `packages/server/src/`. Verify that `bun pm ls` lists the ten workspace packages.
- [ ] 2.3 Verify the isolated linker: a throwaway import of `@askboard/core` from `contract`, without declaring it, fails to resolve under `bun run`. Remove the throwaway import and record the result in this task's note.

## 3. TypeScript, formatting, linting and tests

- [ ] 3.1 Add `tsconfig.base.json` and per-package configurations as in design decision 3, with the test configuration that adds `@types/bun`, and a root `typecheck` script. Verify that `bun run typecheck` passes, and that a throwaway `document.title` or `process.env` use in `core` makes it fail; then remove it.
- [ ] 3.2 Add `biome.json` and the `lint` and `format` scripts. Verify that `bun run lint` passes on the tree.
- [ ] 3.3 Add the `test` script (`bun test --coverage`). Verify that it runs with zero failures.

## 4. Import-boundary check (AD-1)

- [ ] 4.1 Write the fixtures and tests first for `tools/check-imports.ts`: each allowed edge of design decision 6 passes; each disallowed edge fails, including server unit to server unit, `widgets` to `view` outside `./catalog`, and a server unit other than `snapshot` to `view/assemble`; Node built-ins and `bun:*` fail in `core` and `compute` sources and pass in their tests; static imports, re-exports, literal dynamic imports and type-only imports are all seen. Verify that the tests fail before the implementation exists.
- [ ] 4.2 Implement `tools/check-imports.ts` with the rules table citing the spine's Invariants & Rules diagram and AD-1, and a `check:imports` script. Verify that the tests from 4.1 pass with at least 80% coverage, and that `bun run check:imports` passes on the tree.

## 5. Licence check (AD-19)

- [ ] 5.1 Write the fixtures and tests first for `tools/check-licences.ts`: each licence class of design decision 7, SPDX `OR` and `AND`, a patched MPL-2.0 package, a missing licence, an override that corrects metadata and an override refused for admitting a licence outside the rule, and the archive step with the GitHub API mocked (archived, not archived, no repository, no token). Verify that the tests fail before the implementation exists.
- [ ] 5.2 Implement `tools/check-licences.ts`, `tools/licence-overrides.json` (empty) and a `check:licences` script. Verify that the tests from 5.1 pass with at least 80% coverage, and that `bun run check:licences` passes on the installed tree with a token.

## 6. One command, CI and Dependabot

- [ ] 6.1 Add the root `check` script that runs `typecheck`, `lint`, `test`, `check:imports` and `check:licences` in that order and stops at the first failure. Verify that `bun run check` passes locally.
- [ ] 6.2 Add the `check` job to `.github/workflows/ci.yml` as in design decision 8, with each action pinned by commit SHA and the version as a comment, and add the Bun ecosystem to `.github/dependabot.yml`. Verify on the pull request that both CI jobs pass.

## 7. Spine and repository records

- [ ] 7.1 Amend the spine: add `packages/hooks/` and `tools/` to the Structural Seed's source tree, add the Biome pin to the Stack with a note that `@types/bun` follows the Bun pin, and set `updated: 2026-10-29`. Verify that `openspec validate --all --strict --no-interactive` passes, and that the source tree and the layer table list the same packages.
- [ ] 7.2 Update `CLAUDE.md` (status; commands replacing "No build, lint or test commands exist yet"; `tools/` and `packages/` in the Working documents table if needed) and `README.md` (status, development commands). Verify that every documented command runs as written.

## Workflow follow-up

- Open the pull request, check that CI passes, merge after review, then archive the change and remove the worktree.
