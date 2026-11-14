# Proposal

## Why

AD-13 puts the formula engine behind a `FormulaEngine` port but leaves open what stands behind it: `@ironcalc/wasm` 0.9.1 or AskBoard's own restricted evaluator. It also leaves the function whitelist open beyond the interim set (arithmetic, `SUM`, `MIN`, `MAX`, `IF`, `ROUND` and the built-in derived fields). Until both are settled, the `contract` epic cannot publish the formula grammar and whitelist, `compute` cannot pick its adapter, AD-8 does not know whether the view needs `'wasm-unsafe-eval'`, and the spine's Stack keeps a candidate pin. The widgets built first (SOLUTION-DESIGN §3.1: Tree with the WBS-with-PERT molecule, Gantt with the Gantt plan) depend on PERT, roll-ups and CPM scheduling, so the formula spike runs now (SOLUTION-DESIGN §10.2) and ends in a spine update.

## What Changes

- **A probe**, kept in this change under `probe/` as evidence and not shipped. It is a package of its own, outside the Bun workspace, with its own lockfile and every dependency pinned exactly to a version that meets the adoption rule. It has:
  - a `FormulaEngine` port stand-in and a `buildGraph` stand-in that turns a small board document into graph nodes addressed by `[item-id(.child-id)*.field]` references;
  - two adapters behind the port: `@ironcalc/wasm` 0.9.1, started with `initSync` from inlined bytes; and AskBoard's own evaluator (own lexer and parser, topological sort, the whitelisted functions), written with no DOM, Node-only or Bun-only API;
  - a check of mathjs 15.2.0 `parse()` used only as a parser for the own evaluator;
  - fixtures: the whitelist, one function and operator at a time; the four ready-made molecules' derived fields (WBS with PERT, Gantt plan with CPM, sales estimate review, decision matrix) on the model contract's worked examples; errors (missing reference, cycle, a function outside the whitelist, hostile input); and a generated board of about 1,000 cells;
  - a board-page stand-in on `127.0.0.1` and a Playwright driver that run both engines in a `srcdoc` view with AD-8's CSP, and in a Snapshot opened from `file://`, in Chromium, Firefox and WebKit.
- **Runs** of §10.2's nine exit criteria:
  1. the engine starts with `initSync` from inlined bytes under the view CSP, in the view and in a Snapshot opened from disk, while the default loader's fetch is blocked by `connect-src 'none'`;
  2. the session process runs the same WASM build, not a native addon (Bun, the Bun-compiled executable and Node 24);
  3. load size and its effect on the time to put a question up (SM-3);
  4. recalculation latency at about 1,000 cells;
  5. identical results with locale and time zone pinned (UTC) in Bun, Chromium, Firefox and WebKit, and under AD-13's CI zones and locales;
  6. a mapping from hyphenated `[item-id(.child-id)*.field]` references to engine names under Excel name rules, wildcards included;
  7. API churn across `@ironcalc/wasm`'s 0.x releases;
  8. the whitelist, with fixtures: arithmetic, `SUM`, `MIN`, `MAX`, `IF`, `ROUND`, PERT, roll-ups, CPM scheduling and scores;
  9. when both pass, the lighter engine wins.
- **`findings.md`**: each criterion with its verdict per engine and runtime and its evidence (the run, sizes, timings, result hashes); the engine comparison; the proposed whitelist; "Proposed outcomes (awaiting the PO)".
- **Spine update**, in this change, decided by the product owner on the findings, drafted first in `spine-update-draft.md`:
  - Deferred: the formula engine row closes.
  - Stack: the `@ironcalc/wasm` row stays as a pin or goes.
  - ADs amended in place where a finding requires it: AD-13 (the engine, the whitelist, how references map to engine names, the interim function set), AD-8 (`'wasm-unsafe-eval'` stays conditional or goes).
  - SOLUTION-DESIGN: §4.7 (the candidates table and the outcome), §10.2 (the outcome), §12 and §13 (F37's status and new facts).
  - EXPERIENCE.md only if a finding changes what a formula error shows.

## Capabilities

### New Capabilities

None. The spike settles an engine choice, a whitelist and facts, and implements no product behaviour, so `.openspec.yaml` sets `skip_specs: true`. The `compute` and `contract` capability specs come with the epics that build them, on the decisions recorded here.

### Modified Capabilities

None.

## Impact

- **New, in this change:** `probe/` (port and graph stand-ins, the two adapters, the mathjs check, fixtures, Bun runner, view build, board-page stand-in, Playwright driver, its own `package.json`, `bunfig.toml` and `bun.lock`), `findings.md`, `evidence/`, `spine-update-draft.md`.
- **Changed after the product owner's decisions:** `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (Deferred, Stack, AD-13 and AD-8 as the findings require), `SOLUTION-DESIGN.md` (§4.7, §10.2, §12, §13); `docs/ux-askboard-2026-10-27/EXPERIENCE.md` only if a formula error's display changes.
- **No product code, no repository dependency:** nothing under `packages/` changes, and the root `package.json` and `bun.lock` stay as they are. Browser engines come from a scratch directory, outside the repository and the user's browser cache.
- **Invariants:** the probe follows MIT and the adoption rule (NFR-6, AD-19); the view makes no outbound connection (NFR-9, AD-8); formulas cannot run arbitrary code (FR-14); the own evaluator uses no DOM, Node-only or Bun-only API (AD-1); it runs on macOS, with Linux recorded as untested unless time allows (NFR-7).
- **Requirements and decisions served:** FR-12, FR-14, FR-15, NFR-5, NFR-6, NFR-9, SM-3, SM-C2, R6; AD-1, AD-7, AD-8, AD-13, AD-19.
- **Gates:** the `contract` epic publishes the formula grammar and whitelist decided here; the `compute` epic builds `buildGraph` and the chosen adapter; the Tree, WBS-with-PERT, Gantt and Gantt-plan widgets take their derived fields from the whitelist.
