# Tasks

Each group writes its tests first and sees them fail before it implements (the repository's TDD rule). "Checks pass" means `openspec validate --all --strict --no-interactive` and `GITHUB_TOKEN=$(gh auth token) bun run check`, run after the group; each group ends with a commit. Edit only `packages/compute`, new files in `packages/contract` with the export block that lists them, and this folder; never E1's contract files, `docs/` or another worktree.

## 1. The formula module in `contract`

- [x] 1.1 Write `packages/contract/test/formula.test.ts` first: the whitelist is exactly AD-13's operators and functions, with arguments; the seven dropped functions and `&`, `%` are absent from it; `&` and `%` are the refused operators; the field name and cell patterns accept and refuse the spec's examples (`A1`, `Q1`, `a1`, `q1`, `XFD1048576`, `XFE1`; revised during apply, proposal open question 6); the operator table's precedence order; the limits 8,192, 64 and 65,536; the eight error kinds. Verify that it fails.
- [x] 1.2 Add `packages/contract/src/formula/` (`grammar.ts`, `whitelist.ts`, `limits.ts`, `errors.ts`, `index.ts`) as design decision 1 says, and append its export block to `packages/contract/src/index.ts`. Verify that 1.1 passes and the checks pass; commit `feat(contract): formula grammar, whitelist and limits`.

## 2. The formula front end in `compute`

- [x] 2.1 Declare `"@askboard/contract": "workspace:*"` in `packages/compute/package.json` and run `bun install`. Verify that `git diff bun.lock` shows only that line in `compute`'s workspace entry and that `bun install --frozen-lockfile` then succeeds.
- [x] 2.2 Write the lexer's and the formula check's tests first: tokens, strings with `""`, numbers, `TRUE` and `FALSE`, calls; flat reference syntax (one child ID at most, then only `*`; cells and ranges only on an item; a lower-case cell; malformed IDs); `over-limit` for length, depth (parentheses, calls, unary runs) and range size, with limit and size in the reason; `not-whitelisted` naming the function or operator, unary plus included; bare names as `syntax`. Then implement `src/formula/lexer.ts` and `src/formula/check.ts`, and verify that the tests pass.
- [x] 2.3 Write the parser's tests first: precedence, left-associative `^`, unary minus above `^`, chained comparisons, `chain` nodes for long runs, arity from the contract, the probe's syntax cases, and its own nesting guard. Then port the parser to `src/formula/parser.ts` with references as indexes (design decision 6), and verify that the tests pass and that the checks pass.

## 3. `buildGraph`

- [x] 3.1 Write the source tests first: every malformed source of the spec's "Malformed sources are refused" throws a `GraphSourceError` naming the item and the problem; addresses and document order for fields, cells and children of any depth. Then implement `src/source.ts` and the node index, and verify that they pass.
- [x] 3.2 Write the resolution tests first: a child at any depth, wildcards in document order at one and two levels, children without the field skipped, a moved node, ranges row by row with empty cells, missing nodes, children and items, and the empty wildcard as `missing-reference`. Then implement `src/graph/resolve.ts` and verify that they pass.
- [x] 3.3 Write the input, currency and cycle tests first: input type checks as `value` warnings (a date of 2026-02-30); money currencies from the field or the item; inference through money formulas; a number formula over two currencies; warnings only at the origin; direct, indirect, self and wildcard cycles with fixed errors downstream; a 10,000-node chain without recursion. Then implement `src/graph/currencies.ts`, `src/order.ts` and `src/graph/build.ts`, and verify that they pass.
- [x] 3.4 Adapt the probe's `errors.json` and hostile fixtures to flat `fields` sources under `packages/compute/test/fixtures/`, noting each changed expectation (design decision 11), and verify that every warning they list comes out of `buildGraph` alone, with no engine. Verify that the checks pass; commit `feat(compute): formula check and buildGraph`.

## 4. The engine and the adapter

- [x] 4.1 Write the engine's tests first, through the port with engine names only: the interpreter's coercions and comparisons, lazy `IF`, error propagation left first, `ROUND` and `ROUNDUP` at 15 digits, `WORKDAY`, dates by integer arithmetic, a fixed error cell, a cycle that reaches the engine, and incremental `recalc` returning only the downstream names. Then port `src/engine/` (port, values, functions without the dropped seven, interpreter, own engine) and `src/dates.ts`, and verify that they pass and that the engine's table equals the contract's whitelist.
- [x] 4.2 Write the adapter's tests first: engine names in document order, dates and money converted in and out, errors mapped back to addresses, `set` refusing formula nodes and unknown addresses, `read` of an unknown address as `missing-reference`, a formula ending on an empty value reading 0. Then implement `src/evaluate.ts` and verify that they pass.
- [x] 4.3 Adapt the probe's `whitelist.json` to `packages/compute/test/fixtures/` (design decision 11) and write the fixture test: every case of a whitelisted entry gives its Excel value; every case of a dropped function reads `not-whitelisted` naming it; every error and hostile fixture reads as expected. Verify 100% of the fixtures pass, and that the hostile-ID fixture reads every node by its own ID.
- [x] 4.4 Add a test that `compute`'s sources hold no `eval`, `new Function`, `Function(`, `with (`, `Reflect.`, `Object.getPrototypeOf` or `.prototype`. Export the public API from `src/index.ts`. Verify that the checks pass; commit `feat(compute): own evaluator behind the FormulaEngine port`.

## 5. PERT and CPM

- [ ] 5.1 Write the PERT tests first: leaf and parent formulas, roll-ups at every level and on the item, a leaf split into two children, a parent's own estimates ignored, empty estimates. Then implement `src/pert.ts` and verify that they pass.
- [ ] 5.2 Write the CPM tests first: the forward and backward passes, slack and the critical flag, dates from the first working day, a weekend start, a dependency cycle, a predecessor and a dependency key that name no task, work packages that name no WBS. Then implement `src/cpm.ts` and verify that they pass, and that every generated formula passes the formula check.
- [ ] 5.3 Adapt the UJ-2 board fixture (75 values, three edits) and the spreadsheet fixture to flat addresses, and verify that every value and every edit passes, each edited graph equal to a fresh build of the edited source. Verify that the checks pass; commit `feat(compute): PERT and CPM scheduling`.

## 6. Determinism and review

- [ ] 6.1 Write the determinism test: a script under `packages/compute/test/` evaluates every fixture and prints a SHA-256 of the canonical results; the test runs it under `TZ=Pacific/Kiritimati` and `TZ=America/Adak`, each with `LANG` and `LC_ALL` set to `en_US.UTF-8` and `de_DE.UTF-8`, and expects one hash. Verify that it passes.
- [ ] 6.2 Review the whole diff once against this change's specs and the spike's decisions (findings § Proposed outcomes), fix what the review finds, and record the test count, the fixture pass rate and `compute`'s coverage in this file. Verify that the checks pass; commit `feat(compute): determinism check and review fixes`.

## Workflow follow-up

- The PO reviews the proposal's open questions; `spine-update-draft.md` applies only if open question 2 is answered as proposed.
- Spike task 8.1, the PO's Excel check of the fixture values, still stands; a value it corrects changes the fixture and the evaluator together.
- Archive after E1, so that `openspec/specs/contract/spec.md` exists and this change's requirements are added to it.
