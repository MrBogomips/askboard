# Findings: formula spike

The exit criteria are in SOLUTION-DESIGN §10.2, and the approach in `design.md`. Raw runs stay in `probe/runs/<run>/`, which git ignores; compact copies of the runs that later decisions rest on are in `evidence/`. Every verdict below names its run. Commands run from `probe/` unless they say otherwise. `<scratch>` is a scratch directory outside the repository.

## Verdicts

One row per exit criterion of SOLUTION-DESIGN §10.2, plus the mathjs parser and Linux. Verdicts:

- **pass:** holds as the design assumed;
- **pass with change:** holds once the change named in "Proposed outcomes" is made;
- **fail:** fails as measured;
- **awaiting PO:** the runs are done, and the verdict needs the PO's judgement (check 8.1; task 7.3's decisions were made on 2026-10-30);
- **untested:** with the reason.

Browser runs used Chromium, Firefox and WebKit (§ Method). The IronCalc browser runs use the adapter as built at 11:10 (adapter source `VPCh8q7pAPzXNIrU`, in every `evidence/view-*.json`); its Bun hash is unchanged.

| # | Item | Own evaluator | IronCalc 0.9.1 | Verdict | Section |
| --- | --- | --- | --- | --- | --- |
| 1 | The engine starts under the view CSP, in the view and in a Snapshot; no fetch | Pass with AD-8 as written: 1,457 passed, 0 failed, hash `7dbd69c8…` = Bun, in all three engines, view and Snapshot, 0 violations, 0 requests (`smoke`, `c1`, `c1-snapshot`) | As written: `CompileError` in all three engines (`smoke`, `c1`). With `'wasm-unsafe-eval'` also in the board page's policy (`board-wasm`): starts from `initSync`, 1,454 passed, 3 failed (criterion 8), hash `0ea63fff…` = Bun, 0 violations, 0 requests (`c1`, `c1-snapshot`). Negative controls: 15 of 15 hold (`c1-negative`) | own: **pass**; IronCalc: **pass with change** (row 5) | [§ Criterion 1](#criterion-1-the-view-csp) |
| 2 | Same build in the session process, no native addon | Plain TypeScript: hash `7dbd69c8…` in Bun (`own`), Node 24.22.2 (`own-node`) and a compiled executable (`rt-exe`) | Same `.wasm` bytes: hash `0ea63fff…` in Bun (`rt-bun`), Node (`rt-node`) and a `bun build --compile` executable (`rt-exe`); no `.node` file, no foreign library loaded | **pass**, both | [§ Criterion 2](#criterion-2-one-build-in-every-runtime) |
| 3 | Load size and its effect on the time to put a question up | Engine alone 25,580 bytes, 8,914 gzipped; adds 6.0 / 8 / 5 ms (Chromium / Firefox / WebKit medians) to a board's time to visible (`c3`) | Engine alone 2,834,532 bytes, 994,668 gzipped; adds 66.9 / 96 / 44 ms (`c3`) | **pass**: measured, against no budget; feeds row 9 | [§ Criterion 3](#criterion-3-load-size-and-time) |
| 4 | Recalculation latency at about 1,000 cells (16 ms threshold, design decision 7) | Edit median 0.10 ms, p95 0.18 ms in Bun (`latency-bun`); p95 at most 1 ms in every browser engine (`c4`) | Edit median 1.05 ms, p95 1.36 ms in Bun (`latency-bun`); p95 at most 3 ms in every browser engine (`c4`) | **pass**, both | [§ Criterion 4](#criterion-4-recalculation-latency) |
| 5 | Identical results with time zone and locale varied | One hash, `7dbd69c8…`, in 12 Bun and Node runs (`det-*`) and 18 browser loads (`c5-*`) | One hash, `0ea63fff…`, in 12 runs (`det-*`) and 18 loads (`c5-*`) | **pass**, both | [§ Criterion 5](#criterion-5-determinism) |
| 6 | References mapped to engine names, any ID | Opaque slot numbers through a `Map`; every hostile ID works as it is (`own`, fixture `hostile-ids`) | Cell addresses: 11,581 addresses on 141 graphs, each on its own cell (`names`). Defined names: 2,053 IDs encoded injectively, all accepted, same hash, after one change (one-cell ranges, names before formulas) | own: **pass**; IronCalc: **pass** (cells), pass with change (names) | [§ Criterion 6](#criterion-6-references-to-engine-names) |
| 7 | API churn across 0.x releases | Not applicable: AskBoard's own code | 16 releases read; in the last 12 months 8 releases and 1 breaking change to the adapter's methods (0.7.0, constructor 3 → 4 arguments); no changelog since 2026-01-18 (`churn`) | **pass**: measured, against no threshold | [§ Criterion 7](#criterion-7-api-churn) |
| 8 | The whitelist with fixtures | 1,457 passed, 0 failed, every whitelist, molecule and error fixture (`own`) | 1,454 passed, 3 failed (`ironcalc`): `AND`/`OR` stop at the first decisive argument (`error:mixed-currencies`), and the adapter's refusal of more than 1,000 operators (2 checks of `error:hostile-size`), needed because the parser crashes near 1,190 operators and the instance is unusable afterwards | own: **pass**; IronCalc: **fail** (3 checks) | [§ Criterion 8](#criterion-8-the-whitelist) |
| 9 | When both pass, the lighter engine wins | 8,914 bytes gzipped; start-up 6.1 ms in Bun; edit median 0.10 ms in Bun (`c3`, `latency-bun`) | 994,668 bytes gzipped (112 times); start-up 53.2 ms in Bun; edit median 1.05 ms (`c3`, `latency-bun`) | The own evaluator is lighter on every measure: decided, the own evaluator (row 1, accepted on 2026-10-30) | [§ Criterion 9](#criterion-9-the-lighter-engine) |
| P | mathjs 15.2.0 `parse()` as the own evaluator's parser | The own parser: 1,743 bytes, 901 gzipped; Excel's meaning on every fixture (`own`, `mathjs-parse`) | Not applicable | mathjs: **fail** as a parser: Excel's meaning for 118 of 151 accepted shapes as written, 3 silent differences left after a token rewrite, at least 90,412 bytes gzipped (`mathjs-parse`); row 12 | [§ mathjs as a parser](#mathjs-as-a-parser) |
| L | Linux (NFR-7) | Hash `7dbd69c8…` on linux arm64, three time zone and locale combinations (`linux`, `linux-kiritimati-de`, `linux-adak-en`) | Hash `0ea63fff…`, same runs | **pass** on arm64, matching macOS (`mac-before`, `mac-after`); x86-64, a devcontainer image, Node and the browsers on Linux: **untested** (not run) | [§ Linux](#linux) |

**Summary:** the own evaluator passes criteria 1 to 6 and 8 as written, criterion 1 with AD-8 as written. IronCalc passes criteria 2 to 6, passes criterion 1 only with `'wasm-unsafe-eval'` in the board page's policy as well as the view's, and fails criterion 8 on 3 checks; its churn (criterion 7) is measured. Both meet the 16 ms latency floor by a wide margin. On criterion 9 the own evaluator is lighter on every measure: about 112 times fewer gzipped bytes, about 9 times faster start-up in Bun and about 10 times faster edits. mathjs brings no gain as a parser. Every run on Linux arm64 matched macOS. The PO decided the engine, the whitelist, the reference addressing and the related spine changes on 2026-10-30, each as proposed (§ Proposed outcomes); the fixtures' Excel values await the PO's check in Excel (§ Product owner checks, 8.1).

## Failures and consequences

SOLUTION-DESIGN §10.2 has one rule for the choice: "When both pass, the lighter engine wins". Design decision 7 adds that if one engine fails a criterion, the other wins on that criterion's evidence, and the proposed outcome names what the loser would need. Below, each IronCalc failure and what applies.

### IronCalc fails criterion 8 on 3 checks (row 8)

- **`AND` and `OR` stop early.** `AND(FALSE,1/0)` is FALSE and `OR(TRUE,1/0)` is TRUE; Excel and the own evaluator give `#DIV/0!` (`bun tools/probe-formulas.ts`). In the suite, UJ-3's `belowMinimum` (`AND([estimate.minMargin]<>"",[estimate.margin]<[estimate.minMargin])`) reads FALSE where the expected value is the `mixed-currencies` error (run `ironcalc`, fixture `error:mixed-currencies`). The adapter cannot fix it without rewriting `AND` and `OR`.
- **The parser crashes on long formulas.** One formula of about 1,190 binary operators overflows the parser's WASM stack (`bun tools/ironcalc-quirks.ts chain 1190`: `RuntimeError: Out of bounds memory access`; `chain 1180` gives 1181). After the trap every call on the module instance fails, `new Model` included. Excel allows 8,192 characters, about 4,000 operators. The adapter refuses more than 1,000 operators as `syntax`, so the 4,001-term sum of `error:hostile-size` gives `syntax` and an extra warning instead of 4001 (2 checks, run `ironcalc`).
- **What applies:** the own evaluator wins on criterion 8 (run `own`: 1,457 passed). If the PO picks IronCalc anyway, it needs: an operator limit in the shared check for both engines (row 10) and re-creating the module instance after any trap, in the view too; the 43-line grammar check moved into the shared check (the parser silently keeps a valid prefix: `=1 2` is stored as `=1`); `AND`/`OR` either accepted as different or `belowMinimum` written so the error comes first; and exact reads through hidden shadow cells (§ The IronCalc adapter).

### IronCalc passes criterion 1 only with a change to AD-8 (row 1)

- **Measured:** the srcdoc inherits the board page's policy [F29], and AD-8's board page policy has no `'wasm-unsafe-eval'`. With it as written, the module does not compile in any engine, and the error names the board page's policy (runs `smoke`, `c1`). With `'wasm-unsafe-eval'` in the board page's `script-src` too (`board-wasm`), the suite runs with 0 violations and 0 requests (runs `c1`, `c1-snapshot`).
- **WebKit raises no violation event** for a refused WebAssembly compile; it only throws the `CompileError` (run `c1-negative`). A CI check must look for the error.
- **What applies:** with the own evaluator (row 1), no WASM runs in the view and AD-8 drops `'wasm-unsafe-eval'` (row 5). With IronCalc, the board page carries it too.

### Criterion 9: the lighter engine

| Measure | Own evaluator | IronCalc | Run |
| --- | --- | --- | --- |
| Engine bytes in the view, gzip -9 | 8,914 | 994,668 | `c3` (build of 11:10) |
| Added to a board's time to visible, Chromium / Firefox / WebKit (medians) | 6.0 / 8 / 5 ms | 66.9 / 96 / 44 ms | `c3` |
| Start-up in Bun, 926 nodes (create plus first load) | 6.1 ms | 53.2 ms | `latency-bun` |
| Edit median / p95 in Bun, 926 nodes | 0.10 / 0.18 ms | 1.05 / 1.36 ms | `latency-bun` |
| Edit median / p95 in Bun, 2,864 nodes | 0.23 / 0.53 ms | 6.07 / 6.56 ms | `latency-bun` |
| Batch mean per edit in the browser engines | 0.1 ms | 1.0 to 1.2 ms | `c4` |
| Compiled executable | 89,292,002 bytes | 91,438,562 bytes | `rt-exe` |

- The earlier build of 10:48 (adapter source `R6OJl/2FrrCeQ6Tf`) gave 994,556 bytes for IronCalc; the 11:10 build gives 994,668. The ratio is 112 either way.
- The own evaluator is lighter on every measure, and it passes everything IronCalc passes. Proposed: the own evaluator (row 1).

### Measurements that contradict a document

- **Design decision 2** says `^` is right-associative. Excel evaluates `2^3^2` as 64 (left-associative), LibreOffice agrees (run `lo-check`), and both engines give 64 (runs `own`, `ironcalc`).
- **Design decision 2** puts every node in one sheet. The adapter puts each spreadsheet item on a sheet of its own, so ranges stay 1:1 and columns cannot run out (run `names`).
- **SOLUTION-DESIGN §10.2, criterion 3** gives IronCalc 0.72 MB gzipped. That is the bare `.wasm` (720,336 bytes, run `c3`); as the view carries it (base64, glue, adapter) it is 994,668 bytes.
- **F37 and §4.7:** eleven differences, each with its source, in § Documentation read.

## Proposed outcomes (decided by the PO on 2026-10-30)

Each row was a proposal until the PO recorded a decision (task 7.3). **On 2026-10-30 the PO decided every row: each recommendation accepted, with no overrides. The engine is AskBoard's own restricted evaluator; IronCalc and `'wasm-unsafe-eval'` are out.** The replacement texts for each row are in `spine-update-draft.md`, beside this file; task 7.4 applied them to `docs/` (§ Applying the decisions, below). Byte counts are those of the 11:10 build (run `c3`).

| # | Item | Evidence | Proposed decision | Alternative | What it changes | PO decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | The engine | Verdict rows 1 to 9; § Criterion 9; runs `own`, `ironcalc`, `c1`, `c3`, `c4`, `latency-bun` | AskBoard's own restricted evaluator. It passes every criterion as written (`own`, `c1`), and on criterion 9 it is lighter: 8,914 against 994,668 bytes gzipped (`c3`), start-up 6.1 against 53.2 ms and edit median 0.10 against 1.05 ms in Bun (`latency-bun`) | IronCalc 0.9.1, with rows 5 and 7 and the adapter's changes: exact reads through hidden shadow cells, an operator limit and re-creating the instance after a crash, a grammar check before the engine, and `AND`/`OR` accepted as different or worked around | Spine AD-13, Stack, Deferred; SOLUTION-DESIGN §4.7, §10.2 | Accepted (2026-10-30) |
| 2 | The whitelist | § Criterion 8; runs `own`, `refs`, `lo-check`; 1 to 11 whitelist fixtures per entry | The field-driven set (`+ - * /` and unary minus, `= <> <`, `SUM`, `MIN`, `MAX`, `IF`, `AND`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP`, `WORKDAY`), plus AD-13's interim `^` and `ROUND` (molecules and agent-built formulas already rely on the interim set), plus `<=`, `>`, `>=` as one comparison group with `=`, `<>`, `<` (one code path in the own evaluator). Drop `OR`, `NOT`, `ABS`, `CEILING`, `AVERAGE`, `COUNT`, `NETWORKDAYS`: no field needs them. `&` and `%` are refused (fixture `not-whitelisted`) | The strict field-driven set (no `^`, `ROUND`, `<=`, `>`, `>=`), or the proposed set plus `OR` and `NOT` | Spine AD-13 (Declarations, Formulas); the `contract` epic holds the list | Accepted (2026-10-30) |
| 3 | Reference addressing: path or flat | § References and the grammar; fixture `path-not-flat`; run `refs` (15 resolution checks) | Flat: the item ID, then one child ID (unique within the item, AD-7), then `*` for each further child level, then the field (`[wbs.ux.optimistic]`, `[wbs.design.*.expected]`, `[wbs.*.expected]`). A Tree move (indent, outdent: EXPERIENCE, Tree) changes a node's path but not its ID, so a flat reference survives it; path also clashes with AD-7 for the decision matrix's ratings (`[dm.options.build.cost.rating]` reuses `cost` under every option). Not measured: the probe implements path (run `refs`) | Path, with AD-7 relaxed to sibling-unique child IDs and the view rewriting references on a move | Spine AD-13 References (AD-7 for the alternative) | Accepted (2026-10-30) |
| 4 | Spreadsheet ranges | § References and the grammar; spreadsheet fixture (`SUM`, `SUMPRODUCT` of two ranges, `MAX` over 3 by 3); hostile `[z.A1:XFD1048576]`; runs `own`, `ironcalc`, `names` | Add `[item-id.A1:B3]`: row-major, at most 65,536 cells, an empty cell reads as empty; in a cell engine each spreadsheet item maps to its own sheet. Without it a Spreadsheet item cannot write `SUM(A1:A10)` | No ranges | Spine AD-13 References | Accepted (2026-10-30) |
| 5 | AD-8's `'wasm-unsafe-eval'` | § Criterion 1; runs `smoke`, `c1`, `c1-snapshot`, `c1-negative` | With row 1: removed. No WASM runs in the view | If the PO picks IronCalc: the board page's `script-src` carries it too (the srcdoc inherits the board page's policy [F29]; as written, the module fails to compile in all three engines, runs `smoke`, `c1`), and CI detects WebKit's refusal through the `CompileError`, since WebKit raises no violation event (`c1-negative`) | Spine AD-8; SOLUTION-DESIGN §4.5 | Accepted (2026-10-30) |
| 6 | Stack | `evidence/adoption.json` (IronCalc passes the adoption rule); row 1 | With row 1: remove the `@ironcalc/wasm` row | Pin `@ironcalc/wasm` 0.9.1 exactly as the engine | Spine Stack | Accepted (2026-10-30) |
| 7 | Licences compiled into IronCalc's `.wasm` | § Documentation read (Licences inside `wasm_bg.wasm`); `THIRD-PARTY-NOTICES.md` | Moot with row 1. For the record: the `.wasm` holds Unicode-3.0 CLDR 48.2 data and part of `unicode-ident`, and Apache-2.0 WITH LLVM-exception code from `compiler_builtins`. `check:licences` reads npm metadata only and cannot see them | With IronCalc: the addendum admits both licences for compiled-in code shipped with their notices | The addendum, only under the alternative | Accepted (2026-10-30) |
| 8 | An empty wildcard | § References and the grammar; fixture `missing-item-wildcard`; run `own` | A warning naming the item ID, like a missing reference; the function sees an empty list (`SUM` gives 0). Today it gives 0 silently (run `own`), so a typo in a wildcard's middle segment goes unnoticed | Silent, as today | Spine AD-13 (the graph bullet) | Accepted (2026-10-30) |
| 9 | Currencies | § Money and currencies; fixture `mixed-currencies` (`totalCost` 20,240; `totalRevenue`, `margin`, `belowMinimum` read `mixed-currencies`); runs `own`, `ironcalc` | The graph checks money units before the engine, since no engine knows currencies; a sum over mixed currencies is a `mixed-currencies` formula error (EXPERIENCE, Derived value). The per-field `{amount, currency}` shape is confirmed in `contract` | | Spine AD-13 Determinism (one sentence) | Accepted (2026-10-30) |
| 10 | Formula limits | § References and the grammar; fixture `hostile-size`; runs `own`, `ironcalc`, `ironcalc-quirks` | `contract` holds limits on formula length, nesting depth and range size, checked by the shared check before any engine; the contract epic sets the values. The own evaluator turned 10,000-deep nesting and a 1 MB formula into warnings (run `own`); IronCalc's parser crashes near 1,190 operators (`ironcalc-quirks`) | No limits | Spine AD-13 Formulas | Accepted (2026-10-30) |
| 11 | CI | Runs `own`, `ironcalc`, `det-*`, `c1`, `c5-*`, `lo-check`; check 8.1 | The whitelist fixtures (with Excel's values), the molecule and the error fixtures become `compute`'s golden tests, run in Bun, Node and the three browser engines under AD-13's zones and locales; the PO's Excel check (8.1) settles their Excel values | | Spine Consistency Conventions (Tests) | Accepted (2026-10-30) |
| 12 | mathjs | § mathjs as a parser; run `mathjs-parse`; advisories GHSA-29qv-4j9f-fjw5, GHSA-jvff-x2qm-6286 | Out, even as a parser: 118 of 151 accepted shapes parse with Excel's meaning as written, 143 after a token rewrite, and `^` associativity, unary minus and chained comparisons stay different without an error; the smallest parse-only bundle is 90,412 bytes gzipped against the own parser's 901. Also: SOLUTION-DESIGN §4.7's row lists JSONata's CVE-2026-77413 to -77415 beside mathjs; mathjs's are CVE-2026-40897 and -41139, fixed in 15.2.0, in evaluation code | mathjs `parse()` behind the own lexer, with an allowlist walk of its tree | SOLUTION-DESIGN §4.7 | Accepted (2026-10-30) |
| 13 | Facts for SOLUTION-DESIGN §13 | § Facts (row 13) | F37 corrected; new facts, F54 to F59 in §13 (§ Facts) | | SOLUTION-DESIGN §13 | Accepted (2026-10-30) |
| 14 | The Deferred row, §10.2's outcome, §12, front matter | This table | Close the formula engine row in Deferred; record the outcome in §10.2; remove the formula spike from §12's "Architecture spikes" owner row; set `updated:` | | Spine Deferred; SOLUTION-DESIGN §10.2, §12 | Accepted (2026-10-30) |

### Facts (row 13)

The facts were proposed here as F39 to F49. In §13 they are numbered from F54: the renderer spike's F39 to F47 were applied first, and the packaging spike's pull request, merged before this one, takes F48 to F53. The draft's blocks 13.1 to 13.8 fold two of these rows into F37, leave out the one that the renderer spike's F41 already states, and give no row to two that only IronCalc's adoption would need; the Fact column gives each row's place in §13. "Verified" means a run of this change shows it on 2026-10-30.

| Fact | Statement | AD | Evidence | Proposed status | PO decision |
| --- | --- | --- | --- | --- | --- |
| F37 | Corrected: `@ironcalc/wasm` 0.9.1 fetches its `.wasm` by default and offers `initSync`; its time zone goes through the host's `Intl`, its locale does not (see F54 and the locale row below) | AD-13 | `wasm.d.ts:714`; `wasm.js:2118`, `2143`; run `c1-negative` | Corrected | Accepted (2026-10-30): F37 amended in place |
| F54 (proposed as F39) | `initSync` takes `{ module }` since 0.7.0 (bytes passed directly log a deprecation warning); the `Model` constructor takes four arguments `(name, locale, timezone, language_id)` since 0.7.0, while the package README still shows two | AD-13 | `wasm.d.ts:714`; `wasm.js:2118`; `README.md:22`; `evidence/churn.json` | Verified | Accepted (2026-10-30) |
| In F37 (proposed as F40) | The locale comes from CLDR 48.2 data built into the `.wasm`; the time zone goes through the host's `Intl` (since 0.8.0) and is read only by `NOW` and `TODAY` | AD-13 | `base/src/locale/mod.rs:96`, `base/src/tz/` at `v0.9.1`; `snippets/.../inline0.js`; runs `det-*`, `c5-*` | Verified | Accepted (2026-10-30), as part of F37's statement |
| F55 (proposed as F41) | IronCalc has no raw-value getter, and its number formats stop at 15 significant digits; exact reads need a scaled shadow cell | AD-13 | runs `precision` (3,012 of 3,013 exact with shadows, 210 without), `ironcalc-quirks` | Verified | Accepted (2026-10-30) |
| F56 (proposed as F42) | One formula of about 1,190 binary operators overflows IronCalc's parser stack; after the trap every call on the instance fails | AD-13 | `bun tools/ironcalc-quirks.ts chain 1180` and `chain 1190` | Verified | Accepted (2026-10-30) |
| F57 (proposed as F43) | IronCalc's `AND` and `OR` stop at the first decisive argument: `AND(FALSE,1/0)` is FALSE, where Excel gives `#DIV/0!` | AD-13 | `bun tools/probe-formulas.ts`; run `ironcalc` | Verified | Accepted (2026-10-30) |
| Not in §13 (proposed as F44) | IronCalc's parser keeps a valid prefix and drops the rest without an error (`=1 2` is stored as `=1`) | AD-13 | run `ironcalc-quirks` | Verified | Accepted with row 13 (2026-10-30); the draft's blocks give it no §13 row, since IronCalc is not adopted: it stays in this file (§ The IronCalc adapter) |
| F58 (proposed as F45) | IronCalc implements impure and indirect functions (`INDIRECT`, `OFFSET`, `NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, `RANDARRAY`, `INFO`, `CELL`, `HYPERLINK`, `LAMBDA`, `LET`, `MAP`, `REDUCE`…), so a whitelist check before the engine is needed | AD-13 | `base/src/functions/mod.rs` at `v0.9.1` (dispatch lines in § Documentation read) | Verified | Accepted (2026-10-30) |
| F41, the renderer spike's (proposed as F46) | WebKit raises no `securitypolicyviolation` event when the CSP refuses a WebAssembly compile; it only throws a `CompileError` | AD-8 | runs `c1-negative`, `smoke` | Verified | Accepted (2026-10-30); no new row: §13's F41 already states that WebKit reports a refused WebAssembly compile only in the console |
| F59 (proposed as F47) | Excel's `^` is left-associative (`2^3^2` = 64) and a unary minus binds tighter than `^` (`-2^2` = 4) | AD-13 | run `lo-check` (LibreOffice 26.8 agrees); both engines (`own`, `ironcalc`); Excel itself: check 8.1 | Verified in LibreOffice; Excel awaiting PO (8.1) | Accepted (2026-10-30); Excel's own value stays with check 8.1 |
| In F37 (proposed as F48) | A WebAssembly module in the view compiles only if the board page's `script-src` also carries `'wasm-unsafe-eval'` (the srcdoc inherits it, F29) | AD-8 | runs `smoke`, `c1` | Verified | Accepted (2026-10-30), as F37's status |
| Not in §13 (proposed as F49) | IronCalc's `.wasm` contains Unicode-3.0 data and Apache-2.0 WITH LLVM-exception code, which npm metadata does not show | AD-19 | `node_modules/@ironcalc/wasm/THIRD-PARTY-NOTICES.md` | Verified | Accepted with row 13 (2026-10-30); no §13 row, since nothing ships IronCalc's `.wasm` (row 7): it stays in this file (§ Licences inside `wasm_bg.wasm`); §4.7's IronCalc row names the two licences |

### Applying the decisions (tasks 7.3 and 7.4)

- **Decided:** on 2026-10-30 the PO accepted every row of the table above as recommended, with no overrides, and with them the facts listed. The engine is AskBoard's own restricted evaluator; IronCalc and `'wasm-unsafe-eval'` are out, so no IronCalc licence work follows (row 7).
- **Applied to `docs/` on 2026-10-30**, from `spine-update-draft.md`, every block of rows 1 to 14 except those named below:
  - Spine: AD-8 (the view's CSP never allows `'wasm-unsafe-eval'`) and AD-13 (Declarations, References, the graph, Formulas and Determinism) amended in place, no AD added or renumbered; Consistency Conventions (Tests); the `@ironcalc/wasm` Stack row and the formula engine's Deferred row removed; a `sources` line for this change in the front matter.
  - Solution design: §4.5 (the CSP bullet); §4.7 (the candidates table, where JSONata's advisories CVE-2026-77413 to -77415 are no longer attributed to mathjs, which gets its own row with CVE-2026-40897 and -41139; the paragraph after it); §10.2 (the Outcome paragraph); §12 (the formula phrase of the "Architecture spikes" row); §13 (F37 amended, F54 to F59 added, a sentence in the introduction); a `sources` line.
  - `updated:` was already 2026-10-30 in both files. The PRD, the addendum, the UX documents and `docs/README.md` are unchanged: no accepted row touches them (block 7.A was the addendum's only block).
- **Not applied:** the alternatives (blocks 1.A, 2.A, 3.A, 5.A, 6.A and 7.A); and the draft's F44, since §13's F41 (renderer spike) already states the same for WebKit. The facts proposed above as F44 and F49 have no §13 row, as the draft's blocks give them none.
- **Adapted to text that #4 or #5 had changed** (the draft was written against `c7026f0`; every quoted "Current" passage was still present verbatim):
  - Blocks 14.4 and 14.5 (front matter): #4 had already set `updated: '2026-10-30'`, and #4 and #5 had each added a `sources` line; the date stands, and a `sources` line for this change follows theirs, in the spine and in the solution design.
  - Block 14.2 (§10.2): #4 and #5 head their Outcome paragraphs "**Outcome (OpenSpec change `<name>`, <date>).**", name what follows the merge, and end with the change's findings. This one does the same, instead of the draft's "**Outcome (2026-10-30).**" and "the archived OpenSpec change `spike-formula` holds the evidence", and names task 8.1 as following the merge.
  - Block 13.9 (§13's introduction): #4 and #5 each added a sentence; this one goes after #4's and, like theirs, ends with where the findings are.
  - Block 5.2 (§4.5's CSP bullet): #4 added the board page's media sources and [F39] before the replaced phrase, which was unchanged; replaced as written, after #4's text.
  - Block 5.1 (AD-8): #4 appended a sentence to the board page's CSP bullet, not to the view's list item this block replaces. The block's own check holds: no accepted outcome needs WebAssembly in the view, since #4 settled PlantUML on Smetana, without Graphviz.
  - Block 14.3 (§12): #5 rewrote the mod delivery item as "The session-file key on Linux (mod delivery, task 4.1)"; only the formula phrase was removed, and the mod delivery and packaging items stay.
  - Blocks 6.1 and 14.1 (Stack, Deferred): #4 and #5 changed other rows of both tables; the formula rows were unchanged and were removed as written.
- **Corrected in the draft's text:** blocks 1.3 and 14.2 gave IronCalc 994,556 bytes gzipped, the 10:48 build's size, and 43 to 95 ms; `docs/` carries run `c3`'s figures for the 11:10 build, 994,668 bytes and 44 to 96 ms, as the rest of this file does (§ Criterion 3).
- **Fact numbers:** F54 onwards, because the packaging spike's pull request, merged first, takes F48 to F53; this merge preserves both sets of facts and both front-matter `sources` lines, and drops the formula engine's Deferred row and §12 phrase. The draft's F39 to F43 and F45 became F54 to F59, and the citations in blocks 1.2 ([F58]), 1.3 ([F55], [F56]) and 13.9 follow.
- **Open after the merge:** task 8.1, the PO's check of the fixtures' values in Excel (awaiting PO); and Linux on x86-64, untested (§ Linux).

## Product owner checks

### 8.1 Excel values of the whitelist fixtures

Status: **awaiting PO**.

The fixtures carry Excel's documented values. Excel was not run unattended; LibreOffice was (run `lo-check`).

1. Open `evidence/excel-check.xlsx` in Microsoft Excel. The checks are on sheet `check`; the inputs on sheet `inputs`.
2. Excel recalculates on open. If it does not, use Formulas > Calculate Now.
3. Read cell `H2`: it counts the rows whose column E reads `DIFFERENT`.

- LibreOffice 26.8 reads 5: `pow-zero-zero`, `lt-text-bool`, `lt-chain`, `sum-ref-bool`, `sum-direct-text`. These are places where LibreOffice is known to differ from Excel.
- Expected in Excel: 0.
- Each `DIFFERENT` row in Excel is a fixture value to correct, and the own evaluator with it.
- The workbook is built by `python3 tools/excel-check.py <out.xlsx>`.

## Method

This section and the next close task 1.1.

- **Platform:** macOS, Darwin 25.6.0, arm64, 2026-10-30.
- **Runtimes:** Bun 1.4.4; Node 24.22.2 through `volta run --node 24.22.2 node …` (Volta resolves Node 22.21.0 in `probe/`, which has no Volta pin; Node 24.22.2 strips types by default, so `run.ts` runs with no flag).
- **Browser engines** (task 1.4, run `versions`, `bun drive.ts versions`): Playwright 1.64.1 under Bun 1.4.4, headless, Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2. Playwright's own builds, used read-only from a scratch `PLAYWRIGHT_BROWSERS_PATH`; nothing was installed. Each load opens a fresh browser context.
- **Linux:** arm64 Debian container `oven/bun:1.4.4-debian` (§ Linux). x86-64 untested.
- **IronCalc:** `@ironcalc/wasm` 0.9.1, `wasm_bg.wasm` 2,090,515 bytes.
- **The exact policies** (hashes as built for runs `c1` to `c5`; `<instrument>` is `WjPva5EsnkGPysAA9yUsk7HBU0NF19Iqy1gWqUJQdqk=`):
  - View, own engine: `default-src 'none'; script-src 'sha256-<instrument>' 'sha256-<own chunk>'; style-src 'sha256-lKkUXV15UPpdSgoTDN9vEGs6NvCDPrAVyk06+3zj54M='; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`
  - View, IronCalc: the same, with `'wasm-unsafe-eval'` after the two script hashes.
  - Board page as AD-8 writes it (variant `board-as-written`): `default-src 'none'; script-src 'sha256-pa4S5bWosZjOk1dwHFVFSKYs5RHmkg2+NRSIHDdvnks=' 'sha256-<instrument>' 'sha256-<engine chunk>'; style-src 'sha256-upLLdh9/Q1toigc0IFRBCi90Cohz4RvF1uUrwN8XWkI=' 'sha256-lKkUXV15UPpdSgoTDN9vEGs6NvCDPrAVyk06+3zj54M='; connect-src 'self'; frame-src 'self'`. The first script hash is the board page's own script, the first style hash its own style.
  - Board page, variant `board-wasm`: the same, with `'wasm-unsafe-eval'` after the script hashes.
- **Harness:** `build.ts` builds one minified classic-script (IIFE) chunk per engine (IronCalc with the `.wasm` inlined as base64 and `initSync`); `assemble.ts` builds the view document (meta CSP, the instrument script first); `board.ts` serves the board page on `127.0.0.1` with its CSP as a header and sets the view as the `srcdoc` of an iframe with exactly `sandbox="allow-scripts"`; `drive.ts` drives Playwright. `sh tools/view-all.sh` repeats every view run in order, Bun hashes included; it was last run at about 11:10.
- **Verdict rule** (design decision 4), per criterion and engine: **pass** when the run shows what the criterion asks with zero violations and zero requests; **pass with change** when it passes only after a named change; **fail** otherwise; **untested**, with the reason.
- **The suite:** 1,457 checks over the whitelist fixtures, the molecule fixtures (UJ-2 WBS and Gantt with its edits, UJ-3 sales review, decision matrix, spreadsheet, the generated 926-node board) and the error fixtures. The result hash is a SHA-256 of the canonical results.

## Documentation read (task 1.1)

Sources, read on 2026-10-30: the installed `node_modules/@ironcalc/wasm/` 0.9.1 (`README.md`, `package.json`, `wasm.d.ts`, `wasm.js`, `snippets/ironcalc_base-2500202885b2b58f/inline0.js`, `THIRD-PARTY-NOTICES.md`); the IronCalc repository at tag `v0.9.1` (commit `eb9ca75`) through the GitHub contents API: `docs/docs.ironcalc.com/src/`, `base/src/functions/mod.rs`, `base/src/tz/`, `base/src/locale/mod.rs`, `base/src/expressions/utils/mod.rs`, `bindings/wasm/README.md` and `README.pkg.md`; mathjs 15.2.0's `parse` source and its advisories. Copies are in `<scratch>/ironcalc-docs-v0.9.1/`. The IronCalc repository has had no `CHANGELOG.md` since 2026-01-18.

- **Function coverage.** All 18 candidate functions are variants of the `Function` enum (497 functions) and dispatched in `base/src/functions/mod.rs`. 16 of their 18 documentation pages are stubs that point to Excel's documentation, and the `SUMPRODUCT` page says "This function is not yet available in IronCalc" while the code implements it. So the fixtures, not the documentation, settle coverage. The site says "IronCalc is in its infancy" (`docs/docs.ironcalc.com/src/index.md:9`).
- **Serial numbers** (`features/serial-numbers.md`): serial 1 is 1899-12-31, so IronCalc has no fictitious 1900-02-29; it agrees with Excel from 1900-03-01, the first date both adapters accept.
- **Dangerous and impure functions** in the v0.9.1 code (dispatch line): `INDIRECT` (2380) and `OFFSET` (2386) build references at run time; `NOW` (2492) and `TODAY` (2491) read the host clock; `RAND` (2363), `RANDBETWEEN` (2364), `RANDARRAY` (2407) read `Math.random`; `INFO` (2666) returns the host environment; `CELL` (2665) cell metadata; `HYPERLINK` (2383); `LAMBDA`, `LET`, `MAP`, `REDUCE`, `SCAN`, `BYROW`, `BYCOL` (2326, 2327, 2335, 2336, …) a larger language. Not in the enum: `WEBSERVICE`, `FILTERXML`, `CALL`, `REGISTER`, `RTD`, `IMAGE`, `GETPIVOTDATA`. The engine accepts all of these, so only a check before the engine keeps them out; `src/precheck.ts` does that for both engines (fixture `not-whitelisted`).
- **Defined names:** `newDefinedName`, `isValidDefinedName` (since 0.7.0; throws on an invalid name), `updateDefinedName`, `deleteDefinedName`, `getDefinedNameList` (`wasm.d.ts` lines 622, 646, 703, 712, 785). The rule is in the code only (`base/src/expressions/utils/mod.rs`, lines 211 to 256): 1 to 255 characters, compared in upper case; first a letter, `_` or `\`; not `TRUE`, `FALSE`, an A1 or R1C1 reference, `R` or `C`. No hyphen.
- **Locale, time zone, language:** `new Model(name, locale, timezone, language_id)` (`wasm.d.ts:714`). The locale comes from CLDR 48.2 data compiled into the module (`base/src/locale/mod.rs:96`). The time zone goes through the host's `Intl` in the WASM build since v0.8.0 (#906) and is used only to validate the constructor's argument and for `NOW` and `TODAY`. The language sets the language of function names. With `NOW` and `TODAY` refused, neither the host's time zone nor its locale reaches a result; the host still needs `Intl.DateTimeFormat` with `UTC`.
- **Host APIs in `wasm.js`:** `Date.now()` (line 1782), `Math.random()` (1789), `Intl.DateTimeFormat` (snippet), `new WebAssembly.Module` and `Instance` (2124, 2126; `initSync`), `instantiateStreaming` and `instantiate` (2077 to 2093; default `init`), `new URL('wasm_bg.wasm', import.meta.url)` and `fetch` (2143, 2148), `console.warn` (2084, 2118, 2138). Nothing in the imports evaluates text; no `eval`, `new Function` or `crypto`. `wasm.js` imports the snippet module statically, so a single view chunk must bundle it.

### Licences inside `wasm_bg.wasm`

From `THIRD-PARTY-NOTICES.md`: IronCalc is MIT OR Apache-2.0; the module also holds the Rust standard library, 28 crates and CLDR data.

| Licence | Components |
| --- | --- |
| MIT OR Apache-2.0 | Rust `core`, `alloc`, `std`, `compiler_builtins`, `dlmalloc`; bitcode, cfg-if, chrono, futures-core, futures-task, futures-util, itoa, js-sys, num-traits, once_cell, pin-project-lite, regex-lite, serde, serde_core, thiserror, wasm-bindgen, wasm-bindgen-shared |
| MIT | libm, serde-wasm-bindgen, slab, statrs |
| Apache-2.0 | approx |
| Zlib OR Apache-2.0 OR MIT | bytemuck |
| Unlicense OR MIT | csv, csv-core, memchr |
| Apache-2.0 OR BSL-1.0 | ryu |
| (MIT OR Apache-2.0) AND Unicode-3.0 | unicode-ident |
| Unicode-3.0 | CLDR 48.2 locale data (`locales.bin`) |
| Apache-2.0 WITH LLVM-exception | portions of LLVM's compiler-rt inside `compiler_builtins` |

- Every crate offers MIT or Apache-2.0. Two components carry a licence outside the addendum's named list: Unicode-3.0 (the CLDR data and the AND part of `unicode-ident`) and Apache-2.0 WITH LLVM-exception. The repository's `classify` treats any `WITH` and any unlisted identifier as outside the rule. The npm-based licence check sees only `MIT OR Apache-2.0` (row 7).

### Differences from SOLUTION-DESIGN §4.7, §10.2 and F37

| # | Where | The documents say | The sources show | Source |
| --- | --- | --- | --- | --- |
| 1 | F37 | `@ironcalc/wasm` "takes `locale` and `timezone`, resolved through the host's `Intl`" | The constructor takes four arguments, `(name, locale, timezone, language_id)`. The time zone resolves through the host's `Intl` (since v0.8.0); the locale comes from CLDR data compiled into the module | `wasm.d.ts:714`; `base/src/tz/browser_tz.rs`; `base/src/locale/mod.rs:96`; release v0.8.0, #906 |
| 2 | F37, §10.2 criterion 1 | "offers `initSync`"; "starts with `initSync` from inlined bytes" | `initSync` takes `{ module }` since 0.7.0; bytes passed directly still work but log a deprecation warning | `wasm.js:2118`; `evidence/churn.json` (0.7.0) |
| 3 | §4.7 | IronCalc 4,231 stars | 4,239 on 2026-10-30 | `evidence/adoption.json` |
| 4 | §4.7 | "docs 'in its infancy' [F37]", with F37 citing npmjs.com | The phrase is on the documentation site, not the npm page; 16 of the 18 candidate functions' pages are stubs and the `SUMPRODUCT` page wrongly says it is unavailable | `docs/docs.ironcalc.com/src/index.md:9` at `v0.9.1`; `functions/math_and_trigonometry/sumproduct.md` |
| 5 | §4.7 | "no path to JavaScript" | True for formula text, but the module calls the host: `Date.now`, `Math.random`, `Intl.DateTimeFormat`; `NOW`, `TODAY`, `RAND`, `INFO` reach the host clock, random source and environment | `wasm.js:1782`, `1789`; `inline0.js`; `functions/information/info.md` |
| 6 | §4.7 | Licence "MIT OR Apache-2.0" (pass) | The `.wasm` also contains Unicode-3.0 data and Apache-2.0 WITH LLVM-exception code; the npm-based check cannot see them | `THIRD-PARTY-NOTICES.md` |
| 7 | §4.7 | Advisories CVE-2026-77413, -77414, -77415, -40897, -41139 on the "JSONata 2.2.2, mathjs 15.2.0" row | The first three are JSONata's; mathjs has only CVE-2026-40897 and -41139, both fixed in 15.2.0 and outside `parse` | `research-stack-2026-10-27.md:44`, `:45`; GHSA-29qv-4j9f-fjw5, GHSA-jvff-x2qm-6286 |
| 8 | §10.2 criterion 3 | IronCalc 0.72 MB gzipped | The `.wasm` is 0.72 MB gzipped (720,336 bytes, run `c3`); `wasm.js` (69 KB) and the snippet come on top, and as the view carries it the engine is 994,668 bytes gzipped | `ls -l node_modules/@ironcalc/wasm`; run `c3` |
| 9 | §10.2 criterion 7 | "API churn across 0.x releases" (no figure) | One breaking change to the adapter's methods in the last 12 months (0.7.0, constructor), two in all (0.3.0, 0.7.0); no changelog since 2026-01-18 | `evidence/churn.json` |
| 10 | §10.2 candidates | "mathjs 15.2 `parse()` used only as a parser" | `parse` alone costs 90 to 191 KB gzipped and still bundles the evaluator; `=`, `<>`, `^`, unary minus and chained comparisons differ from Excel | `evidence/mathjs-parse.json` |
| 11 | README vs code | The package README shows `new Model('en', 'UTC')` | Four arguments since 0.7.0 | `node_modules/@ironcalc/wasm/README.md:22`; `bindings/wasm/README.pkg.md` on `main` |

## Adoption (task 1.2, run on 2026-10-30)

Command: `GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts`, 2026-10-30 10:47 CET. It reads every direct dependency of `probe/package.json` from the npm registry and the GitHub API and writes `evidence/adoption.json`, one row per package. The licence verdict reuses `classify` from the repository's `tools/check-licences.ts`.

The rule (addendum, Adoption rule) on the run date: licence permissive (MIT, Apache-2.0, BSD; MPL-2.0 or EPL-2.0 only unmodified); at least 1,000 stars or a named exception; a push since 2026-04-30; a release since 2025-10-30; not archived.

| Package | Pin | Licence (npm) | Licence (GitHub) | Stars | Last push | Last release | Archived | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@ironcalc/wasm` | 0.9.1 | MIT OR Apache-2.0 | Apache-2.0 | 4,239 | 2026-10-29 | 2026-10-21 (0.9.1, npm) | no | pass |
| `mathjs` | 15.2.0 | Apache-2.0 | Apache-2.0 | 15,101 | 2026-10-30 | 2026-04-07 (15.2.0, npm) | no | pass |
| `playwright` | 1.64.1 | Apache-2.0 | Apache-2.0 | 98,854 | 2026-10-30 | 2026-10-14 (1.64.1, npm) | no | pass |
| `typescript` | 7.0.2 | Apache-2.0 | Apache-2.0 | 111,673 | 2026-10-30 | 2026-10-20 (v7.1-beta, a GitHub pre-release); 7.0.2 on npm 2026-07-08 | no | pass |
| `@types/bun` | 1.4.4 | MIT | NOASSERTION | 51,460 | 2026-10-30 | 2026-10-23 (1.4.4, npm) | no | pass |

- Every row passes. Only `@ironcalc/wasm` and `mathjs` are runtime candidates; the rest are tooling and reach no chunk.
- `@types/bun`'s stars, push and archived flag are DefinitelyTyped's.
- mathjs 15.2.0 is still npm `latest`; its release window under the rule closes on 2027-04-07 unless a new release comes out.

## The probe package and the licence check (task 1.3)

- `bun install --frozen-lockfile` passes in `probe/`.
- From the repository root, `GITHUB_TOKEN=$(gh auth token) bun tools/check-licences.ts openspec/changes/spike-formula/probe` completes: "19 installed packages, 19 for other platforms read from the npm registry, 5 direct dependencies, archive step: checked, no problems".
- The root `package.json`, `bun.lock` and `packages/` are unchanged against `origin/main`.
- The root `bun run check` (with `GITHUB_TOKEN`) and `openspec validate --all --strict --no-interactive` pass before every commit of this change.

## References and the grammar

Run `refs` (`bun run.ts refs`, parts `refs,reference`): 22,702 checks passed, 0 failed (11,040 formulas, 11,536 references, 61 wildcards, 5 ranges); part `reference` 66 passed, 0 failed (360 values).

- **Lexer** (`src/refs.ts`): one linear pass, no recursion, no regular expression over the whole formula. It finds `[...]` references with their spans, strings with `""` escapes, numbers, operators and names. Characters outside the grammar (`;`, `{`, `!`, `$`, `#`, `@`, `:` outside brackets) are `syntax`.
- **Checked before any engine** (`checkFormula`, then `precheck`): grammar, Excel's 8,192-character limit, nesting over 64 (parentheses plus runs of unary signs), a function outside the whitelist or `&`/`%` (`not-whitelisted`, naming the function), a bare name (`syntax`), missing references, ranges over 65,536 cells, mixed currencies. Run `refs` shows the refusals with no engine created.
- **Path semantics, as implemented:** each segment is a child of the previous one, and `*` matches exactly one child level. `[wbs.design.*.expected]` gives the three design packages, `[wbs.*.expected]` the two phases, `[wbs.*.*.expected]` all six leaves, in document order (run `refs`, 15 resolution checks).
- **An empty wildcard** in a known item is an empty list (`SUM` gives 0, no warning); over an unknown item it is a missing reference (fixture `missing-item-wildcard`). A typo in a wildcard's middle segment therefore yields 0 silently (row 8).
- **Path or flat** (row 3). AD-13's `[item-id(.child-id)*.field]` does not say whether the child IDs form a path, and AD-7 makes child IDs unique within their item, so `[wbs.ux.optimistic]` could name the UX package directly; under the probe's path semantics it is a missing reference (fixture `path-not-flat`).
  - Path gives `*` a clear meaning and lets a matrix reuse IDs per row (`[dm.options.build.cost.rating]`), which breaks AD-7's within-item uniqueness.
  - Flat survives Tree moves; under flat, `*` needs a new definition and a matrix needs composite IDs (`build-cost`). AD-7's diff targets (`item.child.field`) share the question.
- **Cells:** `[item.A1]`, upper case only, `A`..`XFD` and `1`..`1048576` (`XFE1` is not a cell). Lower-case `a1` is a field name; `contract` should also forbid field names that match the cell pattern case-insensitively.
- **Ranges** (row 4): `[item.A1:B3]`, only as item plus two cells, row-major (`[sheet.A1:B2]` is A1, B1, A2, B2; reversed corners give the same list). Cells with no node are empty. More than 65,536 cells is `syntax` (hostile `[z.A1:XFD1048576]`). The spreadsheet fixture uses it in `SUM`, `SUMPRODUCT` of two ranges and `MAX` over a 3 by 3 block (run `own`).
- **Hostile IDs:** inside brackets any ID is just an ID; outside brackets a name is only ever a function, so `TRUE` or `SUM` as an item ID cannot clash, and cell-like IDs never become cells.
- **Hostile size** (fixture `hostile-size`, run `own`): 10,000-deep parentheses, 100 nested `SUM` calls, 5,000 unary signs, a 1 MB formula, a 1 MB text literal and a whole-sheet range are all `syntax` warnings before any engine. A 4,001-term flat sum under 8,192 characters evaluates (4,001), and so does 64-level nesting. A 10,000-node chain evaluates (fixture `hostile-chain`).

## Criterion 8: the whitelist

The probe accepts every candidate so each can be measured (`src/whitelist.ts`). "Needed by" names the derived field whose formula uses it. Run `refs` checks that every candidate has a whitelist fixture, that molecule formulas use only listed names, and that every addition beyond the interim set appears in a molecule formula. Columns: whitelist fixtures passed in run `own` (`bun run.ts own --engine own`) and run `ironcalc` (`bun run.ts ironcalc --engine ironcalc`; column by `bun tools/whitelist-column.ts runs/ironcalc/ironcalc.json`). "exact" marks a pass within 1e-9 that is not bit-identical.

| Function or operator | Excel semantics (as fixtured) | Derived field that needs it | Own (`own`) | IronCalc (`ironcalc`) |
| --- | --- | --- | --- | --- |
| `+` | Booleans 1/0, empty 0, numeric text converted, other text `#VALUE!` | WBS expected (PERT), Gantt EF | 9/9 (1 exact: `0.1+0.2`) | 9/9 (1 exact: `0.1+0.2`) |
| `-` (binary and unary) | Unary minus binds tighter than `^`: `-2^2` = 4 | WBS spread, Gantt LS and slack, margin | 5/5 | 5/5 |
| `*` | | PERT `4*mostLikely`, line cost and revenue | 6/6 | 6/6 |
| `/` | Zero divisor (also empty) is `#DIV/0!` | PERT `/6`, margin, score | 5/5 | 5/5 |
| `^` | Left-associative: `2^3^2` = 64; `0^0` is `#NUM!` | none (interim set) | 7/7 | 7/7 |
| `=` | Numbers at 15 significant digits (`0.1+0.2=0.3` is TRUE); text case-insensitive; `1="1"` FALSE; empty equals 0, "" and FALSE | Gantt critical (`slack=0`) | 8/8 | 8/8 |
| `<>` | | belowMinimum (a minimum is set) | 2/2 | 2/2 |
| `<` | Numbers < text < booleans; `1<2<3` is FALSE | belowMinimum (margin below minimum) | 4/4 | 4/4 |
| `<=`, `>`, `>=` | | none | 1/1 each | 1/1 each |
| `SUM` | Booleans and text inside references ignored, typed directly converted | WBS parent expected, sales totals, weight total | 9/9 | 9/9 |
| `MIN` | No numbers gives 0 | Gantt LF (backward pass) | 2/2 | 2/2 |
| `MAX` | No numbers gives 0 | Duration floor, ES (forward pass), project finish, best score | 2/2 | 2/2 |
| `IF` | Lazy; no else gives FALSE; an empty result reads 0 | Sales optional line | 7/7 | 7/7 |
| `ROUND` | Half away from zero on the decimal value: `ROUND(2.675,2)` = 2.68, `ROUND(-2.5,0)` = -3, `ROUND(1.005,2)` = 1.01 | none (interim set) | 10/10 | 10/10 (1 exact: `ROUND(1E21,2)` = 999999999999999900000) |
| `AND` | Text and empty inside references ignored; no logical value is `#VALUE!` | belowMinimum | 4/4 | 4/4, but stops early: fails `error:mixed-currencies` |
| `OR`, `NOT` | | none | 2/2, 1/1 | 2/2, 1/1 (`OR` stops early on TRUE) |
| `ABS` | | none | 1/1 | 1/1 |
| `SQRT` | Negative is `#NUM!` | WBS parent spread (root-sum-square) | 2/2 | 2/2 |
| `SUMSQ` | As `SUM` | WBS parent spread (root-sum-square) | 2/2 | 2/2 |
| `SUMPRODUCT` | Lists of different length `#VALUE!`; non-numbers count as 0 | Decision-matrix score | 3/3 | 3/3 |
| `ROUNDUP` | Away from zero, on the value at 15 digits: `ROUNDUP(0.1+0.2,1)` = 0.3, `ROUNDUP((0.1+0.2)*10,0)` = 3 | Gantt duration | 7/7 | 7/7 |
| `CEILING` | Positive number with negative significance `#NUM!` | none | 4/4 | 4/4 |
| `AVERAGE` | No numbers `#DIV/0!` | none | 2/2 | 2/2 |
| `COUNT` | Typed booleans and numeric text count; inside references only numbers | none | 2/2 | 2/2 |
| `WORKDAY` | Monday to Friday, no holidays; days truncated; `WORKDAY(d,0)` = d even on a weekend | Plan's first working day, task start and finish dates | 11/11 | 11/11 |
| `NETWORKDAYS` | Both ends included; negative when reversed | none | 3/3 | 3/3 |
| `&`, `%` | Excel operators | none: refused as `not-whitelisted` | refused (fixture `not-whitelisted`) | refused before the engine |

- **Proposed whitelist** (row 2): the operators and functions a derived field needs, plus AD-13's interim `^` and `ROUND`, plus `<=`, `>`, `>=` as one comparison group. Not needed by any field: `OR`, `NOT`, `ABS`, `CEILING`, `AVERAGE`, `COUNT`, `NETWORKDAYS`.
- **Excel versus JavaScript**, each a fixture that the own evaluator passes: `ROUND` halves (`Math.round(-2.5)` is -2, `toFixed` gives 2.67 for 2.675), `^` associativity (JavaScript's `**` gives 512), `-2^2` (JavaScript -4), division by zero (`Infinity`, `NaN`), overflow (Excel `#NUM!`), `0^0` (JavaScript 1), `null+1`, case-insensitive text equality, booleans inside `SUM`, 15-digit comparison and `ROUNDUP`.
- **Second implementation** (run `lo-check`, `python3 tools/libreoffice-check.py lo-check`, LibreOffice 26.8.2.2 headless): agrees on 116 of 122 cases, including `2^3^2` = 64, `-2^2` = 4, `0.1+0.2=0.3` TRUE, both 15-digit `ROUNDUP` cases, every `ROUND` and every `WORKDAY` case. It differs on 6, all where LibreOffice is known to differ from Excel (booleans as numbers, `SUM("5",1)` refused, `0^0` = 1). The fixtures keep Excel's documented values; Excel itself is the PO's check 8.1.
- **Three fixture values rest on Excel's 15-digit behaviour** (`eq-float`, `roundup-float`, `roundup-near-integer`); LibreOffice confirms them.
- **Weekend start:** the plan's first working day is `WORKDAY([start]-1,1)`, because `WORKDAY(start,0)` keeps a weekend date; UJ-2 edit 2 starts the plan on Saturday 2026-11-07.
- **Task 2.6 Verify:** every function in the table has a fixture, molecule fixtures use only listed functions (run `refs`, part `reference`); the error fixtures show a missing reference (`missing-reference@x.b`), a cycle (`cycle@x.a`, `@x.b`, `@x.c`) and a refused function (`not-whitelisted@x.f0`…`x.f15`) as load warnings whose address starts with the item ID (runs `own`, `refs`, `ironcalc`). Every molecule fixture passes in IronCalc too; its error fixtures pass except the two in § Failures and consequences.

## Criterion 6: references to engine names

- **Own evaluator: pass, no encoding needed** (run `own`, fixture `hostile-ids`). The adapter maps each address to an opaque slot number through a `Map<Address, number>`; the parser receives slot numbers, never names. IDs tried, all resolved and computed: `constructor`, `__proto__`, `toString`, `hasOwnProperty`, `prototype`, `valueOf`; `ab12`, `r1c1`, `xfd1048576`, `A1` (with the cell `[A1.B2]`); `TRUE`, `FALSE`; `SUM`; `-x`, `--`, `123.456`; a 64-character ID; `Ab` and `aB` as two IDs. IDs outside `[A-Za-z0-9_-]{1,64}` are a `syntax` warning. Function names resolve through a `Map` too: `constructor(1)`, `toString()`, `__proto__(1)`, `hasOwnProperty("x")` are `not-whitelisted`.
- **IronCalc, cell addresses** (`form: "cells"`, the default): the layout of § The IronCalc adapter; the map is built per load, so any ID works. Run `names` (`bun tools/names.ts names`): 141 fixture graphs, 11,581 addresses, no two on one cell, each mapped back. **Pass.**
- **IronCalc, defined names** (`form: "names"`): prefix `n_`, then per character `a-z`, `0-9` and `.` unchanged, an upper-case letter as `_` plus its lower-case form, `_` as `_0`, `-` as `_1`, `*` as `_2`, `:` as `_3`. No upper-case output, so case-insensitivity cannot merge two names, and decoding is a function, so the encoding is injective. Examples: `wbs.design.*.expected` → `n_wbs.design._2.expected`; `Ab` → `n__ab`; `aB` → `n_a_b`; `-x` → `n__1x`.
  - Run `names`, 2,053 IDs (53 chosen, 2,000 seeded random): all round-trip, no case collision, IronCalc accepts all, `=name` reads the named cell for all. Used raw instead: 987 refused, 20 collide by case, 10 accepted but read a cell (`ab12`, `xfd1048576`, 8 random IDs).
  - Longest encoded name in the fixtures: 74 characters, under 255.
  - The suite gives hash `0ea63fff…` in both forms. **One change was needed:** a name for one node is a one-cell range (`Sheet1!$C$5:$C$5`); defined as a cell, `SUM` counted a boolean and a numeric text inside it (`whitelist:sum-ref-bool` 1 instead of 0, `sum-ref-text` 5 instead of 0).
  - Names must be defined before the formulas: IronCalc re-parses every formula on each `newDefinedName` (800 names interleaved with 800 formulas 9.1 s, names first 0.17 s, an exploratory measurement). **Pass with change.**

## The own evaluator

- **Size:** `src/own/` has 7 files and 1,003 lines (902 without comments and blanks), plus the shared `refs.ts` (341), `precheck.ts` (153) and `whitelist.ts` (56). In the view it is 25,580 bytes, 8,914 gzipped (run `c3`, chunk `size-own`).
- **Design:** the shared lexer and precheck, then a precedence-climbing parser to an AST. A run of operators of one precedence is one `chain` node evaluated by a loop, so a flat 1 MB sum parses without a deep tree. An iterative Tarjan ordering finds the nodes on a cycle (each gets a `cycle` warning; downstream nodes read `cycle`). An interpreter runs the AST with the functions in a module-private `Map` of frozen entries.
- **Incremental recalculation:** `set` marks an input dirty; `recalc` evaluates only its transitive dependents in topological order. After 40 seeded edits on the generated board every node equals a fresh load (run `own`, internals 15 of 15).
- **Excel semantics:** unary minus above `^`, left-associative `^`, 15-digit comparison and rounding, `ROUND` half away from zero on the decimal value, type ordering in comparisons, aggregates ignoring booleans and text inside references, lazy `IF`, errors propagating left first. Dates are Excel serials converted with integer calendar arithmetic, no `Date` object; serials before 1900-03-01 are refused. `ROUNDUP((0.1+0.2)*10,0)` gives 3, so a PERT estimate that should be whole never gains a working day from a float's last bit.
- **What it refuses:** no `eval`, `Function`, `with`, `Reflect` or prototype access in `src/own/`, `refs.ts` or `precheck.ts` (`grep -nE "\beval\b|new Function|Function\(|\bwith\s*\(|Reflect\.|Object\.getPrototypeOf|\.prototype" src/own/*.ts src/refs.ts src/precheck.ts` finds nothing). The parser's own nesting guard (256) turns 10,000-deep parentheses, 10,000 unary signs and 1,000 nested calls into a parse error, not a stack overflow. Ordering 200,000 chained nodes does not recurse.
- **Compiles under `compute`'s settings:** `node_modules/.bin/tsc -p tsconfig.own.json` (`lib: ["es2024"]`, `types: []`) exits 0; so does `tsconfig.suite.json`.
- **Runs:** `own` (`bun run.ts own --engine own`): suite 1,457 passed, 0 failed, 1 exact mismatch, internals 15 of 15, hash `7dbd69c8ebc2573a48c4b3c7e0b2cf101bafe245a0812b836a268eb70a3d283c`; `own-node` (`volta run --node 24.22.2 node run.ts own-node --engine own`): same counts and hash.

## The IronCalc adapter

- **Size:** `src/ironcalc/` has 8 files and 643 lines (512 without comments and blanks): `engine.ts`, `layout.ts`, `formula.ts`, `grammar.ts`, `values.ts`, `dates.ts`, `names.ts`, `style.ts`. It reuses `refs.ts`, `precheck.ts`, `whitelist.ts` and `orderSlots` from `src/own/topo.ts`. In the view, with the glue and the base64 module: 2,834,532 bytes, 994,668 gzipped (run `c3`, chunk `size-ironcalc`).
- **Start:** `createIronCalcEngine(wasmBytes, { form?, exact? })` calls `initSync({ module: wasmBytes })` once. Each `load` builds a new `Model("askboard", "en", "UTC", "en")` and frees the previous one.
- **Before the engine:** `precheck`, the adapter's 43-line grammar check (`grammar.ts`), a limit of 1,000 binary operators per formula, then Tarjan's cycle search. A refused node is written into its cell as an error literal (`=#REF!`, `=#NAME?`, `=#ERROR!`, `=#CIRC!`, `=#N/A`, `=#VALUE!`), so IronCalc's propagation carries the kind to the dependants.
- **Layout:** field nodes on Sheet1, one column per (item, field, depth), rows in document order. A trailing wildcard's matches are consecutive rows, so `[wbs.*.*.expected]` becomes a range such as `C1:C6`. Spreadsheet cells keep their geometry on a sheet per spreadsheet item (`[s.A1:B3]` is `Sheet2!A1:B3`).
- **Formula text** is rebuilt from the shared lexer's tokens: no whitespace (Excel's intersection operator), names upper-cased, strings re-quoted, references replaced by cells, ranges or names. The engine never sees an AskBoard ID.
- **Inputs:** numbers and money as `String(Number(x))`, dates as serials (`Date.UTC` arithmetic only), booleans `TRUE`/`FALSE`, text behind the quote prefix, null as an empty cell. Evaluation is paused for good (`pauseEvaluation`); `recalc` calls `evaluate()`, which recomputes the whole workbook.
- **Exact reads:** IronCalc has no raw-value getter and its number formats stop at 15 significant digits (`=1/3` reads `0.333333333` under General; `2/3*1E-300` prints as `6.66666666666667E-30301`, run `ironcalc-quirks`). Each formula node gets a shadow cell `=Sheet1!C5*2^200` formatted `"0"`, read as an integer and divided back. Run `precision` (`bun tools/precision.ts`): 3,012 of 3,013 doubles bit-exact (the miss is 1e-50); with `exact: false`, 210 of 3,013. The shadows double the evaluated cells.
- **Error mapping:** `#DIV/0!` → `division-by-zero`; `#VALUE!`, `#NUM!` → `value`; `#REF!` → `missing-reference`; `#CIRC!` → `cycle`; `#NAME?` → `not-whitelisted`; `#ERROR!` → `syntax`; `#N/A` → `mixed-currencies` (borrowed: no whitelisted function yields it); `#SPILL!`, `#CALC!`, others → `value`.
- **Quirks** (run `ironcalc-quirks`, `bun tools/ironcalc-quirks.ts`, unless named): the parser keeps a valid prefix and drops the rest (`=1 2`, `=(1)(2)`, `=1;2` all stored as `=1`) and accepts `SUM(1,,2)`, `IF(,1,2)`, `(1+2`, `{1,2}`, `MAX()`; the parser crash near 1,190 operators; `AND`/`OR` stop early (`bun tools/probe-formulas.ts`); `ROUND(1E21,2)` is 999999999999999900000 (scaling in floating point, within 1e-9); `setUserInput` sets a number format from the input text and evaluates unless paused; text needs the quote prefix.
- **Compiles under `compute`'s settings:** `node_modules/.bin/tsc -p tsconfig.ironcalc.json` (`skipLibCheck: true`, as in `packages/compute`) exits 0. With `--skipLibCheck false`, 10 errors, all in `@ironcalc/wasm`'s `wasm.d.ts` (`Symbol.dispose`, `RequestInfo`, `URL`, `Response`, `BufferSource`, the `WebAssembly` namespace): under `compute`'s settings the argument of `initSync` is not type-checked. The glue needs `WebAssembly`, `TextDecoder`, `TextEncoder`, `FinalizationRegistry`, `Intl.DateTimeFormat`, `Date.now`, `Math.random` and `console.warn` at run time.
- **Task 2.4 Verify:** partly holds. Run `ironcalc`: 1,454 passed, 3 failed, 2 exact mismatches (`0.1+0.2`, `ROUND(1E21,2)`), hash `0ea63fff6923bfccff447f39e4512bb2642f91dfb1d0b2eba1aba03d1ffc8228`. Against run `own`, 1,453 of 1,457 values are bit-identical (`bun tools/compare.ts runs/own/own.json runs/ironcalc/ironcalc.json`).

| Fixture | Formula | Expected | IronCalc | Cause |
| --- | --- | --- | --- | --- |
| `error:mixed-currencies`, `estimate.belowMinimum` | `AND([estimate.minMargin]<>"",[estimate.margin]<[estimate.minMargin])` | `mixed-currencies` | FALSE | `AND` stops at the FALSE first argument and drops the error in `margin` |
| `error:hostile-size`, `z.flat` | `1+1+…+1` (4,000 operators, 8,001 characters) | 4001 | `syntax` | the adapter's 1,000-operator limit, which keeps the parser from crashing |
| `error:hostile-size`, `@warnings` | as above | no warning for `z.flat` | `syntax@z.flat` | same cause |

## Criterion 2: one build in every runtime

The suite through IronCalc from the same `.wasm` bytes (2,090,515 bytes):

| Run | Runtime | Passed / failed | Hash |
| --- | --- | --- | --- |
| `rt-bun` (`bun run.ts rt-bun --engine ironcalc --only whitelist,boards,errors`) | Bun 1.4.4 | 1,454 / 3 | `0ea63fff…` |
| `rt-node` (`volta run --node 24.22.2 node run.ts rt-node --engine ironcalc --only whitelist,boards,errors`) | Node 24.22.2 | 1,454 / 3 | the same |
| `rt-exe` (`sh tools/rt-exe.sh <scratch dir>`) | `bun build --compile` executable | 1,454 / 3 | the same; the own evaluator's executable gives `7dbd69c8…` |

- The executable embeds the `.wasm` as a file asset and ran from a scratch directory with no `node_modules`. Sizes: 91,438,562 bytes with IronCalc, 89,292,002 with the own evaluator; IronCalc adds 2,146,560 bytes.
- **No native addon:** `find -L node_modules/@ironcalc -name '*.node'` finds none; the package's `files` hold only `wasm_bg.wasm`, `wasm.js`, `wasm.d.ts`, `snippets/` and licences. Under `DYLD_PRINT_LIBRARIES=1` the executable loads nothing outside `/usr/lib` and `/System` except itself.
- The own evaluator gives `7dbd69c8…` in Bun (`own`), Node (`own-node`) and its executable (`rt-exe`).
- **Verdict: pass**, both engines.

## Criterion 4: recalculation latency

Threshold: 16 ms for a single-input edit on the 1,000-cell board (design decision 7). The generated board has 926 nodes (64 leaves, 76 work packages); `--leaves 200` gives 2,864 nodes, about 200 work packages with full PERT and CPM fields.

**Bun and Node** (run `latency-bun`, `bun tools/latency.ts latency-bun <own|ironcalc|ironcalc-approx> <64|200>`; run `latency-node`, `volta run --node 24.22.2 node tools/latency.ts latency-node <own|ironcalc> 64`). Start-up is engine creation plus the first `load` in a fresh process; an edit sets the first work package's estimate and recalculates the whole Gantt chain; 50 edits. `ironcalc-approx` is `exact: false`.

| Runtime | Engine | Nodes | Create (ms) | First load (ms) | Start-up (ms) | Full recalc (ms) | Edit median (ms) | Edit p95 (ms) | ≤ 16 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bun | own | 926 | 0.02 | 6.1 | 6.1 | 0.81 | 0.10 | 0.18 | yes |
| Bun | own | 2,864 | 0.02 | 14.5 | 14.5 | 1.27 | 0.23 | 0.53 | yes |
| Bun | IronCalc | 926 | 5.6 | 47.7 | 53.2 | 2.28 | 1.05 | 1.36 | yes |
| Bun | IronCalc | 2,864 | 6.1 | 81.4 | 87.5 | 7.79 | 6.07 | 6.56 | yes |
| Bun | IronCalc approx | 926 | 5.6 | 40.4 | 46.0 | 3.19 | 0.79 | 1.08 | yes |
| Bun | IronCalc approx | 2,864 | 5.5 | 67.3 | 72.8 | 7.08 | 5.29 | 5.72 | yes |
| Node | own | 926 | 0.03 | 8.8 | 8.8 | 0.74 | 0.12 | 0.23 | yes |
| Node | IronCalc | 926 | 2.7 | 71.4 | 74.1 | 2.68 | 1.64 | 1.80 | yes |

- `initSync` alone, cold, 10 fresh processes (run `init-time`): Bun median 5.6 ms (5.0 to 6.7), Node 2.9 ms (2.7 to 3.1).
- IronCalc's edit is about 10 times the own evaluator's because `evaluate()` recomputes the whole workbook, shadows included; it grows 5.8 times for 3.1 times the nodes. Its start-up is dominated by the first load, not `initSync`.
- Other agents' browser runs were active on the machine during these runs; absolute times may run slightly high, the ratios come from the same conditions. Runs `latency-own` and `latency-own-200` (`bun run.ts … --only latency`) agree for the own evaluator: edit median 0.111 and 0.27 ms.

**Browser engines** (run `c4`, `bun drive.ts c4 --repeat 5`, `evidence/view-c4.json`): `runLatency(engine, 50)` on the 926-node board, five cold loads per engine, medians of the five, in milliseconds. "Batch mean" is the mean of 500 edits timed together, because Firefox's and WebKit's 1 ms clock rounds a single edit to 0 or 1 ms; the evidence file rounds it to 0.1 ms. IronCalc runs with `board-wasm`.

| Engine, browser | Load | Full recalc | Edit median | Edit p95 (max of 5) | Batch mean |
| --- | --- | --- | --- | --- | --- |
| own, Chromium | 7.2 | 0.6 | 0.1 | 0.2 (0.4) | 0.1 |
| own, Firefox | 8 | 1 | 0 | 1 (1) | 0.1 |
| own, WebKit | 6 | 1 | 0 | 1 (1) | 0.1 |
| IronCalc, Chromium | 53.7 | 2.4 | 1.5 | 1.7 (1.7) | 1.1 |
| IronCalc, Firefox | 30 | 3 | 1 | 2 (3) | 1.2 |
| IronCalc, WebKit | 44 | 2 | 1 | 2 (2) | 1.0 |

- 30 loads, all pass, 0 violations, 0 requests.
- **Verdict: pass**, both engines, in Bun, Node and every browser engine; IronCalc's worst p95 (3 ms) is a fifth of the threshold.

## Criterion 5: determinism

**Bun and Node** (runs `det-*`, `sh tools/det.sh && bun tools/det-summary.ts`): every fixture for both engines under `TZ` = UTC, Pacific/Kiritimati and America/Adak with `LANG` and `LC_ALL` = en_US.UTF-8 and de_DE.UTF-8, in Bun 1.4.4 and Node 24.22.2; 12 runs per engine (`evidence/det-outside-browser.json`).

| Engine | Runs | Distinct hashes | Hash |
| --- | --- | --- | --- |
| own | 12 | 1 | `7dbd69c8ebc2573a48c4b3c7e0b2cf101bafe245a0812b836a268eb70a3d283c` (1,457 passed) |
| IronCalc | 12 | 1 | `0ea63fff6923bfccff447f39e4512bb2642f91dfb1d0b2eba1aba03d1ffc8228` (1,454 passed, 3 failed) |

- Each run records the resolved time zone, which follows `TZ` in every run. The hash covers the `WORKDAY`, `NETWORKDAYS` and Gantt dates, so the dates are the same in every combination.
- The two hashes differ only by the 3 failures and `ROUND(1E21,2)`.
- IronCalc's model time zone is fixed to UTC in the adapter; only `NOW` and `TODAY` read it, both refused.

**Browser engines** (runs `c5-utc-en-US`, `c5-utc-de-DE`, `c5-kiritimati-en-US`, `c5-kiritimati-de-DE`, `c5-adak-en-US`, `c5-adak-de-DE`, for example `bun drive.ts c5-kiritimati-de-DE --tz Pacific/Kiritimati --locale de-DE`; `evidence/view-c5.json`): the full suite with Playwright's `timezoneId` and `locale`, both engines, all three browser engines, 36 loads.

- Each engine's hash equals its Bun hash in every combination and browser engine: own `7dbd69c8…` 18 of 18, IronCalc `0ea63fff…` 18 of 18.
- The view saw the requested settings in every load: time zone, locale, `navigator.language`, and the offset on 2026-01-01 (Kiritimati −840 minutes, Adak +600, UTC 0).
- 0 violations, 0 requests.
- **Verdict: pass**, both engines, everywhere. IronCalc's hash includes its 3 criterion-8 failures, which are the same everywhere.

## Criterion 1: the view CSP

**Run `smoke`** (`bun drive.ts smoke`, `evidence/view-smoke.json`): `=1+2` through the `FormulaEngine` port in the view.

| Document | Board page policy | Chromium | Firefox | WebKit |
| --- | --- | --- | --- | --- |
| own | as written | 3, pass | 3, pass | 3, pass |
| IronCalc | as written | `CompileError`, fail | `CompileError`, fail | `CompileError`, fail |
| IronCalc | `board-wasm` | 3, pass | 3, pass | 3, pass |

**Negative controls** (run `c1-negative`, `bun drive.ts c1-negative`, `evidence/view-c1.json`): 15 of 15 hold.

| Control | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| IronCalc, view policy without `'wasm-unsafe-eval'`, board page `board-wasm` | `CompileError` naming `'unsafe-eval'`; violation `script-src`, blocked `wasm-eval`, view's policy | `CompileError: call to WebAssembly.Module() blocked by CSP`; violation `script-src`, `wasm-eval` | `CompileError: Refused to create a WebAssembly object …`; **no violation event** |
| The same, Snapshot from `file://` | as above | as above | as above, no violation event |
| `init()` with no bytes, board page `board-wasm` | `TypeError: Failed to fetch`; violation `connect-src`, blocked `…/wasm_bg.wasm` | `NetworkError`; violation `connect-src` | `TypeError: Load failed`; violation `connect-src` |
| `init()` with no bytes, Snapshot | violation `connect-src`, blocked `file:` | `NetworkError`, no violation: Firefox fails the `file:` fetch on its own (an inference) | violation `connect-src`, blocked `file:` |
| Recorders' control: `init()` with no policy on either page | request seen, reached the server | request seen, reached the server | request seen, reached the server |

- In every control with a policy, no request reached the server. `new WebAssembly.Module` on 2 MB of bytes, synchronously, works in all three engines.
- **The board page's policy applies to the srcdoc [F29].** With AD-8's board page policy, IronCalc's module does not compile, and the error names the board page's policy. With `'wasm-unsafe-eval'` there too (`board-wasm`), it compiles.

**Full suite** (run `c1`, `bun drive.ts c1`; run `c1-snapshot`, `bun drive.ts c1-snapshot`):

| Engine | Where | Chromium | Firefox | WebKit | Hash |
| --- | --- | --- | --- | --- | --- |
| own | view, board as written | 1,457 passed, 0 failed | same | same | `7dbd69c8…` in all three, = Bun |
| own | Snapshot | 1,457 passed, 0 failed | same | same | `7dbd69c8…`, = Bun |
| IronCalc | view, board as written | does not start (`CompileError`) | same | same | none |
| IronCalc | view, `board-wasm` | 1,454 passed, 3 failed | same | same | `0ea63fff…` in all three, = Bun |
| IronCalc | Snapshot | 1,454 passed, 3 failed | same | same | `0ea63fff…`, = Bun |

- 0 violations, 0 requests and nothing reaching the server in every load that started. The run's own summary marks the IronCalc loads `fail` because of the 3 suite failures; they are criterion 8's, identical to Bun's.
- Firefox's favicon request for the board page is the browser's own and is counted apart. Playwright's Firefox reports no event for `file:` URLs, so in Firefox Snapshots "zero requests" rests on the policy and the absence of violations.
- **Verdict:** own evaluator **pass** (AD-8 as written, view and Snapshot, all three engines). IronCalc **pass with change**: `'wasm-unsafe-eval'` in the board page's `script-src` as well as the view's (row 5).

## Criterion 3: load size and time

**Sizes** (`bun build.ts`, `dist/manifest.json`; the build of run `c3`, `evidence/view-c3.json`), gzip level 9:

| Item | Raw bytes | gzip bytes |
| --- | --- | --- |
| `wasm_bg.wasm` (the module itself) | 2,090,515 | 720,336 |
| The module as base64 (the 10:48 build) | 2,787,356 | 981,467 |
| Own engine alone (`size-own`: evaluator, precheck, references) | 25,580 | 8,914 |
| IronCalc alone (`size-ironcalc`: adapter, glue, base64 module) | 2,834,532 | 994,668 |
| Probe chunk `own` (engine plus suite and fixtures) | 85,107 | 23,969 |
| Probe chunk `ironcalc` (the same with IronCalc) | 2,894,148 | 1,010,845 |
| Instrument script | 1,437 | 787 |
| View document, no engine | 2,368 | 1,317 |
| View document, own | 87,245 | 25,051 |
| View document, IronCalc | 2,896,310 | 1,011,654 |

- IronCalc adds about 112 times the own engine's gzipped bytes to a board with a formula. Inlining as base64 costs about 33% raw over the bare module.

**Timings** (run `c3`, `bun drive.ts c3`): 20 cold loads per browser engine and document, 180 loads, all pass, 0 violations, 0 requests. Milliseconds from `t0` (the board page, just before it sets the srcdoc), median / max. "UJ-2 evaluated" loads the UJ-2 WBS and Gantt plan through the port and reads every expected value once. IronCalc runs with `board-wasm`.

| Mark (median / max) | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| No engine: chunk running | 2.5 / 2.9 | 4 / 6 | 2 / 4 |
| Own: chunk running | 3.9 / 4.4 | 8 / 30 | 3 / 4 |
| Own: engine ready | 6.1 / 6.8 | 9 / 30 | 4 / 6 |
| Own: UJ-2 evaluated | 8.5 / 9.2 | 12 / 34 | 7 / 12 |
| IronCalc: chunk running | 22.8 / 24.7 | 71.5 / 76 | 14 / 16 |
| IronCalc: base64 decoded | 35.3 / 38 | 78 / 82 | 21 / 25 |
| IronCalc: engine ready (after `initSync`) | 37.3 / 40.2 | 91 / 95 | 26 / 32 |
| IronCalc: UJ-2 evaluated | 69.4 / 73.7 | 100 / 105 | 46 / 52 |

**The engine's share of a board's time to visible**, as "UJ-2 evaluated" minus the no-engine "chunk running" (medians), beside the renderer spike's golden-case time to visible (its run `golden-time`, which has no formula):

| | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| Golden case, time to visible | 235.8 ms | 504 ms | 274.5 ms |
| Own engine adds | 6.0 ms (2.5%) | 8 ms (1.6%) | 5 ms (1.8%) |
| IronCalc adds | 66.9 ms (28%) | 96 ms (19%) | 44 ms (16%) |

- The own figure is an upper bound: its chunk carries the suite and fixtures (85 KB against 26 KB for the engine alone).
- IronCalc's time goes to parsing the 2.9 MB chunk, decoding the base64, compiling, and the first evaluation. A real board also pays the 2.9 MB document's transfer to the board page, which these times exclude.
- Firefox and WebKit give the view a 1 ms clock, Chromium 0.1 ms.
- The earlier run on the 10:48 build gave the same picture, within 2 ms per mark.
- **Verdict: pass**, measured against no budget; it decides criterion 9.

## Criterion 7: API churn

Run `churn`, 2026-10-30 10:40 CET: `GITHUB_TOKEN=$(gh auth token) bun tools/churn.ts --scratch <scratch>/churn`. It writes `evidence/churn.json`, one row for each of the 16 0.x releases of `@ironcalc/wasm` on npm (0.0.4 to 0.9.1; no 1.x).

**Method** (`tools/churn.ts`, `tools/dts-surface.ts`, `tools/churn-notes.ts`): each tarball is downloaded, its SHA-512 `integrity` checked, and only `package/wasm.d.ts` read as text. Each file is reduced to its exported declarations (each `Model` method its own entry) and diffed against the previous release. A changed method counts as breaking when it gains a required parameter, loses one, stops accepting a type or changes its return type. The installed `wasm.d.ts` is byte-identical to the downloaded 0.9.1 file.

**The adapter's surface:** `initSync`, the default `init`, the `Model` constructor, `setUserInput`, `evaluate`, `getCellContent`, `getFormattedCellValue`, `getCellType`, `newDefinedName`, `isValidDefinedName`, `updateRangeStyle`, `pauseEvaluation`, `resumeEvaluation`, and the types `SyncInitInput`, `Area`.

Releases of the last 12 months (published on or after 2025-10-30; npm dates, UTC):

| Version | Date | Exported | Added | Removed | Changed (breaking) | Breaking for the adapter | GitHub release notes read |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.7.0 | 2026-01-21 | 117 | 22 | 8 | 7 (2) | **`Model` constructor: required parameters 3 → 4** (`language_id`) | v0.6.0, v0.7.0 |
| 0.8.0 | 2026-07-29 | 177 | 62 | 2 | 6 (6, one a false positive) | none | v0.7.1, v0.8.0 |
| 0.8.1 | 2026-07-29 | 177 | 0 | 0 | 0 | none | none (tag, no release) |
| 0.8.2 | 2026-07-29 | 177 | 0 | 0 | 0 | none | v0.8.2 |
| 0.8.3 | 2026-07-31 | 177 | 0 | 0 | 0 | none | v0.8.3 |
| 0.8.4 | 2026-08-01 | 177 | 0 | 0 | 0 | none | none (no tag) |
| 0.9.0 | 2026-10-15 | 190 | 14 | 1 | 1 (1) | none | v0.9.0 |
| 0.9.1 | 2026-10-21 | 190 | 0 | 0 | 0 | none | v0.9.1 |

- **In 12 months:** 8 releases, 1 breaking change to the adapter's methods (0.7.0). Across the whole surface: 11 declarations removed, 14 changed, 9 flagged breaking (0.7.0 removed the singular row and column methods; 0.8.0 renamed `TokenType`'s variants; 0.9.0 renamed `from_bytes` to `fromBytes`).
- **Before that:** 0.3.0 changed the constructor from `(locale, timezone)` to `(name, locale, timezone)` and `updateRangeStyle`'s type. The constructor gained a required argument twice.
- `initSync` and `init` exist from 0.0.4; since 0.7.0 they take an object. None of the adapter's methods has been removed; their signatures are unchanged since 0.7.0.
- **The `.d.ts` misses behaviour changes** the release notes list: time zones (#529), local language for `NOW` and `TODAY` (#700), the browser's tz database (#906), "Fixes to the general evaluation algorithm" (#1420), "Only evaluate cells with formulas" (#1480), "Ensure loading a model never fails" (#1570). An exact pin and the fixture suite catch these.
- Cadence is uneven: six months with no release (January to July 2026), then five releases in three days. GitHub tags and npm versions do not match one to one. There is no changelog: `CHANGELOG.md` was deleted on 2026-01-18 (commit `f3be574`); the release notes are the only record and carry no "breaking" section.
- Sources: https://registry.npmjs.org/@ironcalc/wasm and its 16 tarballs; https://api.github.com/repos/ironcalc/IronCalc/releases?per_page=100; the history of `CHANGELOG.md`; `bindings/wasm/README.pkg.md` on `main`.
- **Verdict: pass**, measured against no threshold.

## mathjs as a parser

Run `mathjs-parse`, 2026-10-30 10:45 CET, mathjs 15.2.0: `bun src/mathjs-parse.ts --bundle-dir <scratch>/mathjs-bundle`. It imports only `parse` and never calls `compile` or `evaluate`; the summary is in `evidence/mathjs-parse.json`.

- **Coverage:** 11,046 formula occurrences (whitelist cases, boards, error fixtures with the hostile ones, the generated board). References renamed `r0`, `r1`…: 193 distinct shapes; 151 pass `checkFormula`, 42 are refused before any engine.
- **On the 151 accepted shapes:** 138 parse as written, 13 fail (4 Excel `=` comparisons read as assignment, 4 `<>`, 1 `""` escape, 4 expected syntax errors). Of those that parse, 19 get a different meaning: `TRUE`/`FALSE` as free symbols (14), `x=0` as an assignment (3, including the Gantt `critical` field), `2^3^2` = 512, `-2^2` = -4, `1<2<3` TRUE. So **118 of 151 parse with Excel's meaning as written.** After a token rewrite (`=` to `==`, `<>` to `!=`, `TRUE` to `true`, text re-quoted), 143 of 151 match; `^` associativity, unary minus and chained comparisons stay different without an error.
- **Molecule formulas:** 28 of 30 shapes parse with Excel's meaning (UJ-3's `belowMinimum` fails on `<>`; Gantt `critical` parses as an assignment).
- **Not checked by `parse`:** arity (`ROUND(1)` parses); `1e309` parses to `Infinity`. No depth guard: 10,000-deep parentheses throw `RangeError: Maximum call stack size exceeded`.
- **The whitelist check:** an allowlist walk of the tree (`src/mathjs-check.ts`, explicit stack) refuses all 16 `not-whitelisted` fixtures and 12 of the 16 syntax fixtures mathjs parses; the token limits catch the other 4. mathjs's grammar is much larger (19 extra constructs tried, all parse); the walk accepts `1+2 # comment`, `0x1F` and `sum(r0)`. AskBoard's own lexer is still needed, so mathjs would replace only `src/own/parser.ts` (142 lines).

| Bundle (`bun build --minify --format=iife`) | Raw bytes | gzip -9 |
| --- | --- | --- |
| mathjs: `import { parse } from "mathjs"` | 681,523 | 190,728 |
| mathjs: `create({ parseDependencies }).parse` | 323,769 | 90,412 |
| mathjs: `lib/browser/math.js` (all of mathjs) | 649,724 | 175,065 |
| Own: `src/own/parser.ts`, function table external | 1,743 | 901 |
| Own: `refs.ts` plus the parser | 15,317 | 5,287 |
| Own: the whole engine | 25,564 | 8,891 |

- Both parse-only bundles still carry the evaluator (`_compile` methods, the property guards of `utils/customs.js`).
- **Advisories** (`gh api "/repos/josdejong/mathjs/security-advisories"`, `gh api "/advisories?affects=mathjs"`, 2026-10-30): CVE-2026-40897 (GHSA-29qv-4j9f-fjw5, unsafe property setter) and CVE-2026-41139 (GHSA-jvff-x2qm-6286, unsafe array index getter), both high (CVSS 8.8), affected below 15.2.0, patched in 15.2.0, both in evaluation-time helpers that `parse()` alone never reaches; the code is still in the bundle. SOLUTION-DESIGN §4.7 lists JSONata's CVE-2026-77413 to -77415 on the same row (difference 7).
- **Verdict:** mathjs brings no gain as a parser (row 12).

## Money and currencies

- **Values:** money stays a decimal string in the graph (`"420.00"`, AD-7); each adapter converts it to a number at load (the own adapter after checking `^-?\d+(\.\d+)?$`). Both engines compute in binary floating point. A derived money value is read unrounded; display rounds it to the currency's minor unit (AD-13). The UJ-3 totals are exact; the margin (0.33567839195979897) is not exactly representable.
- **The mixed-currency check lives in the graph layer** (`src/precheck.ts`), which every adapter runs before its engine: no formula engine knows currencies, and `ask-core`'s send-time check needs the warning without an engine. A money formula's currencies are its declared one plus those of the money nodes it reads, inferred through other money formulas; more than one gives a `mixed-currencies` warning, the node reads as that error, and nodes that read it inherit it.
- **Fixture `mixed-currencies`** (runs `own`, `ironcalc`): a line priced in USD in a EUR review gives a USD revenue; `totalCost` is 20,240, while `totalRevenue`, `margin` and `belowMinimum` read `mixed-currencies` (IronCalc's `belowMinimum` reads FALSE, § Failures and consequences).
- **Per-amount currency:** the probe accepts `{ "amount": "600.00", "currency": "USD" }` for one field, standing in for AD-7's "an item may declare a currency once for all its amounts". `contract` has to fix that shape (row 9).

## Linux

Task 6.1. Run on 2026-10-30 at 11:01 CET in Docker 29.5.2 (Docker Desktop, `Linux 6.12.76-linuxkit aarch64`), the probe mounted read-only and a writable `runs/` from the scratch directory:

```sh
docker run --rm -v "$PWD":/probe:ro -v <scratch>/linux-runs:/probe/runs -w /probe \
  oven/bun:1.4.4-debian bun run.ts linux --engine both
```

- **Image:** `oven/bun:1.4.4-debian`, digest `oven/bun@sha256:93d5032fe06d163427822dc1598f420363759bb18155c9cc90eb1be05a64a19e`, linux/arm64, Bun 1.4.4. The planned `oven/bun:1.4.4` pull stalled for 7 minutes, so the Debian tag already on the machine was used.
- The macOS `node_modules` ran unchanged: the isolated linker's links are relative, and neither engine has a native part.

| Run | Platform | TZ, LANG | Own: passed, failed, hash | IronCalc: passed, failed, hash |
| --- | --- | --- | --- | --- |
| `mac-before` | darwin arm64 | Europe/Rome, C.UTF-8 | 1,457, 0, `7dbd69c8…` | 1,454, 3, `0ea63fff…` |
| `linux` | linux arm64 | UTC (unset), unset | 1,457, 0, `7dbd69c8…` | 1,454, 3, `0ea63fff…` |
| `linux-kiritimati-de` | linux arm64 | Pacific/Kiritimati, de_DE.UTF-8 | same | same |
| `linux-adak-en` | linux arm64 | America/Adak, en_US.UTF-8 | same | same |
| `mac-after` | darwin arm64 | Europe/Rome, C.UTF-8 | same | same |

- **Verdict: the hashes match macOS for both engines.** The two extra Linux runs used `--only whitelist,boards,errors`.
- **Untested:** Linux on x86-64 (CI's runners), a devcontainer image, Node on Linux, and the browser runs on Linux.
