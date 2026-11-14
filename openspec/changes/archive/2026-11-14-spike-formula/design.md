# Design

## Context

See proposal.md for the motivation. The question and the nine exit criteria are in SOLUTION-DESIGN §10.2, the candidates and their adoption status in §4.7, and the rules in the spine:

- **AD-13:** `compute.buildGraph(boardDocument)` builds a board's whole graph; the view evaluates it on each edit and `ask-core`'s send-time check calls the same function. References are `[item-id(.child-id)*.field]`, where `*` stands for any one child level; spreadsheet cells are `[item-id.A1]`. Formulas are Excel-style, limited to the reference syntax and a function whitelist, behind a `FormulaEngine` port that never sees ask or item IDs: the adapter maps each reference to an engine name. A missing reference or a cycle is a warning, never a refusal. Derived values ignore locale and time zone; CI compares results under `TZ=Pacific/Kiritimati` and `TZ=America/Adak` and the locales `en-US` and `de-DE`. Critical path and rescheduling are AskBoard's own code.
- **AD-8:** the view is a `srcdoc` iframe with exactly `sandbox="allow-scripts"`; its CSP is `default-src 'none'`, scripts and styles by hash, `connect-src 'none'`, and `'wasm-unsafe-eval'` only if the formula engine is WASM. The srcdoc inherits the board page's policy as well [F29].
- **AD-1:** `compute` and `ask-core` use no DOM, Node-only or Bun-only API; `compute` compiles with `lib: ["es2024"]` and `types: []`, because it runs in the view and in the session process, on Bun and on Node.
- **AD-7:** money is a decimal string plus an ISO 4217 code, dates are `full-date`, durations whole days.
- **AD-19:** the adoption rule (licence, stars, activity), pinned exactly.

What exists: `packages/compute` has an empty entry point and the compile settings above. The model contract's worked examples (`openspec/changes/archive/2026-10-29-review-model-contract/examples/asks/`) hold the UJ-2 WBS and Gantt plan and the UJ-3 sales estimate review. EXPERIENCE.md fixes the derived fields: PERT expected effort and spread per node, a parent's spread the root-sum-square of its children's, a work package's Gantt duration its expected effort rounded up to whole working days, dates and the critical path from the graph, totals and margin, scores. On 2026-10-30 the npm registry shows `@ironcalc/wasm` 0.9.1 as `latest`: `wasm_bg.wasm` is 2,090,515 bytes (719,196 gzipped at level 9), `wasm.js` 69 KB; its glue imports `Date.now`, `Math.random` and `Intl.DateTimeFormat` into the module and reaches `fetch`, `URL` and `import.meta.url` only in the default (async) loader. Its `Model` constructor takes four arguments while its README shows two. These are registry observations; the spike measures their effect.

## Goals / Non-Goals

**Goals:**

- A verdict for each of §10.2's nine exit criteria, per engine and per runtime, backed by runs that someone else can repeat with one command.
- A proposed whitelist, with a fixture per function and per molecule's derived field, that both engines pass or whose failures are named.
- An engine recommendation from measured sizes, start-up and recalculation times, and the API churn.
- A spine update draft the product owner can accept row by row.

**Non-Goals:**

- Product code: `contract`, `compute`, `ask-core` and the widgets are built in the epics on the decisions recorded here. The probe is not a starting point for them.
- Rescheduling by drag and the Gantt's working-day calendar beyond weekends: they are AskBoard's own code (AD-13) and belong to the Gantt epic. The spike checks only that CPM's forward and backward pass can be written with whitelisted functions, against an in-house reference implementation.
- The formula bar, formula editing UX and error messages (EXPERIENCE leaves them unrecorded).
- Previous browser majors, the installed Chrome and Edge, Safari by hand, native Windows and WSL. Linux runs only if time allows; otherwise it is recorded as untested.

## Decisions

### 1. A probe package in the change, outside the workspace, with exact pins

`probe/` has its own `package.json`, `bun.lock` and `bunfig.toml` (`linker = "isolated"`, `exact = true`, as at the root), `tools/licence-overrides.json` holding `[]`, and a `.gitignore` for `node_modules/`, `dist/` and `runs/`. The repository's licence check runs against it unchanged: `GITHUB_TOKEN=$(gh auth token) bun tools/check-licences.ts openspec/changes/spike-formula/probe`, from the repository root; a licence it flags is a finding, never an override. No file in `probe/` is named `*.test.*` or `*.spec.*`, so the root `bun test` does not discover it; Biome and the root `tsc` already leave `openspec/` alone.

Planned pins, read on 2026-10-30 (task 1.2 records the full adoption row):

| Package | Pin | Role | Licence, stars, last push | Status |
| --- | --- | --- | --- | --- |
| `@ironcalc/wasm` | 0.9.1 | Candidate engine | MIT OR Apache-2.0 (repository Apache-2.0), 4,239, 2026-10-29 | Pass (0.x) |
| `mathjs` | 15.2.0 | Parser-only check for the own evaluator | Apache-2.0, 15,101, 2026-10-30 | Pass on paper; 2026 code-execution advisories (§4.7) |
| `playwright` | 1.64.1 | Browser driver, in no chunk | Apache-2.0, 98,850, 2026-10-30 | Pass |

The browser engines are Playwright 1.64.1's Chromium, Firefox and WebKit builds, read from a scratch `PLAYWRIGHT_BROWSERS_PATH` outside the repository.

### 2. One port, one graph stand-in, two adapters

- **Port** (`src/port.ts`): `FormulaEngine` is what `compute` calls. It takes graph nodes addressed by AskBoard references (an input value, or a formula in AskBoard's syntax), lets one input change, recalculates, and reads a value or a typed error per node. Its errors are AskBoard's (`missing-reference`, `cycle`, `not-whitelisted`, `syntax`, `value`, `division-by-zero`), so neither engine's error codes leak.
- **Graph stand-in** (`src/graph.ts`): `buildGraph(boardDocument)` for the probe's fixtures. It expands each molecule into nodes with their built-in derived fields written as formulas over the whitelist, so the molecules' arithmetic lives in formulas, not in widget code (AD-13).
- **References** (`src/refs.ts`): one lexer for `[item-id(.child-id)*.field]` and `[item-id.A1]`, shared by both adapters. It finds every reference, resolves wildcards to the list of matching nodes, and rejects a function outside the whitelist before any engine sees the formula. The own evaluator would need this anyway; the IronCalc adapter needs it too, because the engine must never see AskBoard IDs and the whitelist must be enforced before the engine parses.
- **Own evaluator** (`src/own/`): a lexer and a precedence-climbing parser to an AST, a topological sort with cycle detection, and an interpreter over the AST with the whitelisted functions as a frozen table. No `eval`, `Function`, `with`, dynamic property access by user text, or prototype lookups: names resolve through `Map`s. Excel semantics where they differ from JavaScript: `ROUND` half away from zero, `=` and `<>` for comparison, `^` left-associative (`2^3^2` is 64) with unary minus binding tighter (`-2^2` is 4), booleans coerced as Excel does in arithmetic. It compiles under `compute`'s settings (`lib: ["es2024"]`, `types: []`).
- **IronCalc adapter** (`src/ironcalc/`): `initSync` from bytes the caller passes (inlined base64 in the view, a file read in Bun or Node). It lays out every node in one hidden sheet and rewrites each reference to a cell address, so the engine sees only A1 references. The layout is a column per item, field and depth, with rows in depth-first order, so that the nodes a wildcard matches (the descendants of one node at one depth) are always one contiguous range and `[wbs.*.expected]` becomes `C2:C4`. Defined names are tried as well, with an injective encoding of hyphenated IDs under Excel name rules, to answer criterion 6 for both forms.
- **mathjs check** (`src/mathjs-parse.ts`): `parse()` from `mathjs` 15.2.0 on every fixture formula after the references are replaced by plain names. It records which formulas parse, the AST node types, and the bytes `parse` alone adds to a bundle. It is an alternative parser for the own evaluator, never an evaluator.

Alternative considered: the own evaluator compiling formulas to JavaScript closures with `new Function`. Rejected: the view CSP has no `'unsafe-eval'`, and FR-14 forbids arbitrary code.

### 3. Fixtures: the whitelist, the molecules, errors and a 1,000-cell board

- **Whitelist fixtures** (`fixtures/whitelist.json`): per operator and function, inputs and the expected value, Excel's value where Excel and JavaScript differ (rounding of halves, `0.1 + 0.2`, division by zero, empty references, booleans). The candidate whitelist starts from AD-13's interim set and adds only what a molecule's derived field needs: comparisons, `AND`, `OR`, `NOT`, `ABS`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP`, `CEILING`, `AVERAGE`, `COUNT`, `WORKDAY` and `NETWORKDAYS`. Each addition names the field that needs it; one that no field needs is dropped.
- **Molecule fixtures** (`fixtures/boards/`): the UJ-2 WBS with PERT and its Gantt plan, and the UJ-3 sales estimate review, taken from the model contract's examples; a decision matrix written for the probe; a spreadsheet item with A1 cells. Expected values come from a plain TypeScript reference implementation (`src/reference.ts`) of PERT, roll-ups, CPM's forward and backward pass in working days, totals, margin and scores, which stands in for AskBoard's in-house code.
- **Error fixtures:** a missing reference, a direct and an indirect cycle, a function outside the whitelist (`INDIRECT`, `OFFSET`, `HYPERLINK`, `WEBSERVICE`, `NOW`, `RAND`), a syntax error, mixed currencies in one sum, and hostile input: names such as `constructor`, `__proto__` and `toString`, item IDs that look like cell addresses (`ab12`, `r1c1`), 10,000-deep nesting and a 1 MB formula.
- **The 1,000-cell board** (`fixtures/generate.ts`): a generated WBS of about 200 work packages with PERT fields, roll-ups and a Gantt chain, about 1,000 nodes in all, seeded so every run builds the same board.

### 4. Runs and what each measures

- **Bun runner** (`run.ts`): `bun run.ts <run> [--engine own|ironcalc] [--tz <zone>] [--locale <tag>]` loads every fixture into each engine, checks each value against the expected one, and writes `runs/<run>/<engine>.json` with the values, a SHA-256 of the canonical results, and timings: start-up (`initSync` and the first `load`), full recalculation, and a single-input edit on the 1,000-cell board (median and 95th percentile of 50). The same script runs under Node 24 (`node --experimental-strip-types` or a bundled copy) and as a `bun build --compile` executable that embeds the `.wasm` bytes (criterion 2).
- **View build** (`build.ts`): one classic-script chunk per engine built with `bun build --format=iife`, the IronCalc chunk carrying the `.wasm` as base64 and calling `initSync`. `assemble.ts` builds a srcdoc and a Snapshot file with AD-8's view CSP, the chunks inlined by SHA-256 hash, `'wasm-unsafe-eval'` only in the IronCalc document. It records raw and gzip bytes per chunk.
- **Board-page stand-in** (`board.ts`): `Bun.serve` on `127.0.0.1`, random port, the board page's CSP as an HTTP header, a page script that marks `t0`, sets the view document as the `srcdoc` of an iframe with exactly `sandbox="allow-scripts"`, and relays the view's messages.
- **Driver** (`drive.ts`, Playwright): `bun drive.ts <run> [--engines chromium,firefox,webkit] [--repeat N] [--snapshot] [--tz <zone>] [--locale <tag>]`. For each engine and document, in a fresh context, it records CSP violations (a `securitypolicyviolation` listener in the view and the console), every request, the result hash and per-fixture failures, and the timings the view reports: from `t0` to the chunk running, to the engine ready, to the first full evaluation, and the single-edit recalculation on the 1,000-cell board.
- **Negative controls**, run first: the IronCalc document without `'wasm-unsafe-eval'` must fail to compile the module, and the default async loader must be blocked by `connect-src 'none'` and make no request. Without them, a pass proves nothing.
- **Verdict rule** per criterion and engine: **pass** when the run shows what the criterion asks with zero violations and zero requests; **pass with change** when it passes only after a named change; **fail** otherwise; **untested**, with the reason.

### 5. Criterion 6: references to engine names

The mapping is tested on the fixtures and on a generated list of IDs: hyphens, digits first, IDs equal to Excel cell addresses or R1C1 references (`ab12`, `r1c1`, `xfd1048576`), `true` and `false`, function names, 64-character IDs, and Unicode letters. For IronCalc, two forms: cell addresses (decision 2's layout) and defined names under Excel's rules (start with a letter or underscore; letters, digits, `_` and `.`; not a cell or R1C1 reference; at most 255 characters; case-insensitive). The encoding must be injective and case-safe, which the run checks by round-tripping every ID. For the own evaluator, the adapter maps references to opaque node indices, so any ID grammar passes; the run records that.

### 6. Criterion 7: API churn

`tools/churn.ts` downloads the `@ironcalc/wasm` tarballs of every 0.x release from the npm registry into a scratch directory, extracts `wasm.d.ts`, and diffs the public surface the adapter uses (`initSync`, `Model`'s constructor, `setUserInput`, `evaluate`, `getCellContent`, `getFormattedCellValue`, cell-type and value reads, `newDefinedName`) and the whole exported surface per release. It also reads the GitHub releases and changelog of `ironcalc/IronCalc`. The table counts breaking changes per release over the last 12 months.

### 7. Choosing the engine

Criterion 9 decides once both pass: the lighter engine wins, lighter meaning bytes added to every board that holds a formula and the start-up those bytes cost (criterion 3), with recalculation latency (criterion 4) as a floor both must meet. A target for criterion 4 does not exist in the documents; the spike uses the frame budget, 16 ms for a single edit on the 1,000-cell board, as its threshold and says so. If one engine fails a criterion, the other wins on that criterion's evidence, and the proposed outcome names what the loser would need.

## Risks / Trade-offs

- **[A 2 MB module as base64 in every srcdoc]** → measured per engine (bytes, compile time, time to the first evaluation); the IronCalc chunk is inlined only on boards with a formula or a derived field, and the Snapshot measures both with and without the engine.
- **[IronCalc's results differ from Excel's or the reference's in the last bit]** → fixtures compare with an absolute tolerance of 1e-9 and record every exact mismatch; display rounds money to the currency's minor unit (AD-13), so the run also checks that every displayed value agrees.
- **[The own evaluator gets Excel semantics wrong]** → the whitelist fixtures carry Excel's values for the known differences, and both engines run them; a disagreement between the two engines is a finding either way.
- **[Wildcards do not map to contiguous ranges]** → the layout of decision 2 makes them contiguous; if a reference shape breaks it, the adapter expands the wildcard into an argument list, and the run records which functions still work.
- **[Playwright under Bun fails, or an engine is missing]** → the driver runs under Node 24; an engine that cannot run is untested, with the reason.
- **[Time box]** → the run is unattended and ends at 13:30 on 2026-10-30. Groups 1 to 4 come before the browser groups' extra runs; whatever is left is recorded in `findings.md` and stays `[ ]` in `tasks.md`.

## Migration Plan

None: no shipped behaviour changes. When the change is archived, `probe/`, `evidence/` and `findings.md` stay in the archive as evidence. Nothing in the probe is referenced from `packages/`.

## Open Questions

- A latency budget for recalculation, and an absolute budget for the board's share of SM-3, are set by the `view` epic and the benchmark; the spike gives the measurements and uses the frame budget only as a threshold.
