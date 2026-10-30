# Own evaluator, references and the shared suite (tasks 2.1, 2.2, 2.3, 2.6)

All runs on macOS (darwin arm64), 2026-10-30, from `probe/`. Bun 1.4.4 unless named. Run files are in `probe/runs/<run>/` (gitignored); each records its command, runtime, `TZ`, `LANG` and the resolved time zone.

| Run | Command | Result |
| --- | --- | --- |
| `refs` | `bun run.ts refs` (parts `refs,reference`) | refs 22,702 checks passed, 0 failed (11,040 formulas, 11,536 references, 61 wildcards, 5 ranges); reference 66 passed, 0 failed (360 values) |
| `own` | `bun run.ts own --engine own` | suite 1,457 passed, 0 failed, 1 exact mismatch; internals 15 of 15; hash `7dbd69c8ebc2573a48c4b3c7e0b2cf101bafe245a0812b836a268eb70a3d283c` |
| `own-node` | `volta run --node 24.22.2 node run.ts own-node --engine own` | same counts, same hash |
| `own-det-check` | `for tz in UTC Pacific/Kiritimati America/Adak; do for l in en_US.UTF-8 de_DE.UTF-8; do TZ=$tz LANG=$l LC_ALL=$l bun run.ts own-det-check --engine own --only whitelist,boards,errors; done; done` | same hash in all six (a spot check, not task 3.3's `det-*` runs; the file keeps the last combination) |
| `latency-own` | `bun run.ts latency-own --engine own --only latency` | 926 nodes: load 6.8 ms cold (1.4 ms warm, run `own`), full recalculation 0.74 ms, edit median 0.111 ms, p95 0.248 ms |
| `latency-own-200` | `bun run.ts latency-own-200 --engine own --only latency --leaves 200` | 2,864 nodes: load 15.6 ms cold, full 1.49 ms, edit median 0.27 ms, p95 0.62 ms |
| `lo-check` | `python3 tools/libreoffice-check.py lo-check` (openpyxl, LibreOffice 26.8.2.2 headless) | 116 of 122 whitelist cases agree with a second spreadsheet implementation; the 6 differences are below |

Node in `probe/`: Volta resolves Node 22.21.0 there (the probe's `package.json` has no Volta pin), so the Node 24 run names the version. Node 24.22.2 strips types by default: `run.ts` runs with no flag.

## Criterion 6 (own evaluator part)

- **Verdict, own evaluator: pass, no encoding needed** (run `own`, error fixture `hostile-ids`). The adapter maps each address to an opaque slot number through a `Map<Address, number>`. The parser receives slot numbers, never names, so any ID that matches `[A-Za-z0-9_-]{1,64}` works as it is.
- IDs tried, all resolved and computed: `constructor`, `__proto__`, `toString`, `hasOwnProperty`, `prototype`, `valueOf`; cell-like `ab12`, `r1c1`, `xfd1048576`, `A1` (as an item ID, with the cell `[A1.B2]`); `TRUE`, `FALSE`; the function name `SUM`; `-x`, `--`, digits first (`123.456`); a 64-character ID; `Ab` and `aB` as two distinct IDs (case-sensitive, AD-7).
- IDs outside the grammar (a space, 65 characters) are a `syntax` warning on the formula that names them.
- A wildcard resolves once, at load, to an ordered slot list (document order). The own evaluator needs no contiguous layout; the order is what `SUMPRODUCT` relies on (decision matrix).
- Function names resolve through a `Map` too: `constructor(1)`, `toString()`, `__proto__(1)` and `hasOwnProperty("x")` are refused as `not-whitelisted` by `refs.ts`, and the table's `lookup` returns nothing for them (internals).
- For the IronCalc adapter, `precheck(nodes).formulas` gives each reference's span in the formula (`start`, `end`, brackets included) and its resolved addresses, so it can rewrite references to cells or ranges.

## Criterion 8: the whitelist

The probe accepts every candidate so each can be measured (`src/whitelist.ts`); "needed by" names the derived field whose formula uses it. Run `refs` checks that every candidate has a whitelist fixture, that molecule formulas use only listed names, and that every addition beyond the interim set really appears in a molecule formula. Own column: whitelist fixtures passed in run `own`. "exact" marks a pass within 1e-9 that is not bit-identical.

| Function or operator | Excel semantics (as fixtured) | Derived field that needs it | Own (run `own`) | IronCalc |
| --- | --- | --- | --- | --- |
| `+` | Booleans 1/0, empty 0, numeric text converted, other text `#VALUE!` | WBS expected (PERT), Gantt EF | 9/9 (1 exact: `0.1+0.2`) | pending |
| `-` (binary and unary) | Unary minus binds tighter than `^`: `-2^2` = 4 | WBS spread, Gantt LS and slack, margin | 5/5 | pending |
| `*` | | PERT `4*mostLikely`, line cost and revenue | 6/6 | pending |
| `/` | Zero divisor (also empty) is `#DIV/0!` | PERT `/6`, margin, score | 5/5 | pending |
| `^` | Left-associative: `2^3^2` = 64; `0^0` is `#NUM!` | none (interim set) | 7/7 | pending |
| `=` | Numbers at 15 significant digits (`0.1+0.2=0.3` is TRUE); text case-insensitive; `1="1"` FALSE; empty equals 0, "" and FALSE | Gantt critical (`slack=0`) | 8/8 | pending |
| `<>` | | belowMinimum (a minimum is set) | 2/2 | pending |
| `<` | Numbers < text < booleans; `1<2<3` is FALSE | belowMinimum (margin below minimum) | 4/4 | pending |
| `<=`, `>`, `>=` | | none | 1/1 each | pending |
| `SUM` | Booleans and text inside references ignored, typed directly converted | WBS parent expected, sales totals, weight total | 9/9 | pending |
| `MIN` | No numbers gives 0 | Gantt LF (backward pass) | 2/2 | pending |
| `MAX` | No numbers gives 0 | Duration floor, ES (forward pass), project finish, best score | 2/2 | pending |
| `IF` | Lazy; no else gives FALSE; an empty result reads 0 | Sales optional line | 7/7 | pending |
| `ROUND` | Half away from zero on the decimal value: `ROUND(2.675,2)` = 2.68, `ROUND(-2.5,0)` = -3, `ROUND(1.005,2)` = 1.01 | none (interim set) | 10/10 | pending |
| `AND` | Text and empty inside references ignored; no logical value is `#VALUE!` | belowMinimum | 4/4 | pending |
| `OR`, `NOT` | | none | 2/2, 1/1 | pending |
| `ABS` | | none | 1/1 | pending |
| `SQRT` | Negative is `#NUM!` | WBS parent spread (root-sum-square) | 2/2 | pending |
| `SUMSQ` | As `SUM` | WBS parent spread (root-sum-square) | 2/2 | pending |
| `SUMPRODUCT` | Lists of different length `#VALUE!`; non-numbers count as 0 | Decision-matrix score | 3/3 | pending |
| `ROUNDUP` | Away from zero, on the value at 15 digits: `ROUNDUP(0.1+0.2,1)` = 0.3, `ROUNDUP((0.1+0.2)*10,0)` = 3 | Gantt duration | 7/7 | pending |
| `CEILING` | Positive number with negative significance `#NUM!` | none | 4/4 | pending |
| `AVERAGE` | No numbers `#DIV/0!` | none | 2/2 | pending |
| `COUNT` | Typed booleans and numeric text count; inside references only numbers | none | 2/2 | pending |
| `WORKDAY` | Monday to Friday, no holidays; days truncated; `WORKDAY(d,0)` = d even on a weekend | Plan's first working day, task start and finish dates | 11/11 | pending |
| `NETWORKDAYS` | Both ends included; negative when reversed | none | 3/3 | pending |
| `&`, `%` | Excel operators | none: refused as `not-whitelisted` | refused (fixture `not-whitelisted`) | pending |

- **Proposed whitelist:** `+ - * / = <> <`, `SUM`, `MIN`, `MAX`, `IF`, `AND`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP`, `WORKDAY`; plus AD-13's interim `^` and `ROUND`, which no built-in field needs (keep or drop: PO).
- **Not needed by any field, proposed for removal:** `<=`, `>`, `>=`, `OR`, `NOT`, `ABS`, `CEILING`, `AVERAGE`, `COUNT`, `NETWORKDAYS`. Keeping all six comparisons as one group costs nothing in the own evaluator (they share one code path); that is a PO choice.
- **Excel versus JavaScript**, each a fixture that the own evaluator passes: `ROUND` halves (JavaScript's `Math.round(-2.5)` is -2, `toFixed` gives 2.67 for 2.675), `^` associativity (JavaScript's `**` is right-associative, 512), `-2^2` (JavaScript -4), division by zero (`Infinity`, `NaN`), overflow (`Infinity`, Excel `#NUM!`), `0^0` (JavaScript 1), `null+1`, case-insensitive text equality, booleans inside `SUM`, 15-digit comparison and `ROUNDUP`.
- **Second implementation** (run `lo-check`): LibreOffice agrees on 116 of 122 cases, including `2^3^2` = 64, `-2^2` = 4, `0.1+0.2=0.3` TRUE, `ROUNDUP(0.1+0.2,1)` = 0.3, `ROUNDUP((0.1+0.2)*10,0)` = 3, every `ROUND` and every `WORKDAY` case. It differs on 6, all where LibreOffice is known to differ from Excel: it treats booleans as numbers (`-TRUE` shown as TRUE, `"z"<TRUE` FALSE, `1<2<3` TRUE, `SUM` of a TRUE cell 1), refuses `SUM("5",1)`, and gives `0^0` = 1. The fixtures keep Excel's documented values there. Excel itself was not run: it is installed, but driving its user interface in an unattended run was not attempted.
- **Two fixture values rest on Excel's 15-digit behaviour** (`eq-float`, `roundup-float`, `roundup-near-integer`); LibreOffice confirms them, Excel does not yet.
- **Correction to design decision 2:** it says `^` is right-associative. Excel evaluates `2^3^2` as 64 (left-associative), LibreOffice agrees, and the own evaluator follows Excel. The design text should say left-associative.
- **Task 2.6 Verify:** every function in the table has at least one fixture, molecule fixtures use only listed functions (run `refs`, part `reference`); the error fixtures show a missing reference (`missing-reference@x.b`), a cycle (`cycle@x.a`, `@x.b`, `@x.c`) and a refused function (`not-whitelisted@x.f0`…`x.f15`) as load warnings whose address starts with the item ID (run `own`, run `refs`). The IronCalc column waits for run `ironcalc`.

## References and the grammar

- **Lexer** (`src/refs.ts`): one linear pass, no recursion, no regular expression over the whole formula. It finds `[...]` references with their spans, strings with `""` escapes, numbers, operators and names. Characters outside the grammar (`;`, `{`, `!`, `$`, `#`, `@`, `:` outside brackets) are `syntax`.
- **Checked before any engine** (`checkFormula`, then `precheck`): grammar, Excel's 8,192-character limit, nesting over 64 (parentheses plus runs of unary signs), a function outside the whitelist or `&`/`%` (`not-whitelisted`, with the function's name in `detail`), a bare name (`syntax`: `__proto__`, `A1` without brackets), missing references, ranges over 65,536 cells, mixed currencies. Run `refs` shows the refusals with no engine created.
- **Path semantics:** each segment is a child of the previous one, and `*` matches exactly one child level. `[wbs.design.*.expected]` gives the three design packages, `[wbs.*.expected]` the two phases, `[wbs.*.*.expected]` all six leaves, in document order (run `refs`, 15 resolution checks).
- **A wildcard that matches nothing** in a known item is an empty list (`SUM` gives 0, no warning); over an unknown item it is a missing reference (fixture `missing-item-wildcard`). A typo in a wildcard's middle segment therefore yields 0 silently. Finding: `contract` should decide whether an empty wildcard warns.
- **The grammar is ambiguous between path and flat child addressing.** AD-13's `[item-id(.child-id)*.field]` does not say whether the child IDs form a path, and AD-7 makes child IDs unique within their item, so `[wbs.ux.optimistic]` could name the UX package directly. Under the probe's path semantics it is a missing reference (fixture `path-not-flat`). Trade-offs:
  - Path gives `*` a clear meaning ("the children of this node") and lets a matrix reuse IDs per row: the decision matrix's ratings are `[dm.options.build.cost.rating]`, with the criterion ID `cost` under every option.
  - That reuse breaks AD-7's rule that child IDs are unique within their item. Path needs only uniqueness among siblings.
  - Flat survives moves: a Tree move changes the path of every node below the moved one, breaking every formula that names them by path, while a flat reference keeps working. Under flat, `*` needs a new definition, and a matrix needs composite IDs (`build-cost`).
  - AD-7's diff targets (`item.child.field`) share the question.
  - Proposed for `contract`: choose one, and align AD-7's uniqueness rule with it.
- **Cells:** `[item.A1]`, upper case only, `A`..`XFD` and `1`..`1048576` (`XFE1` is not a cell). Lower-case `a1` is a field name. AD-13 says no field name may match a cell; making the cell pattern upper-case only keeps that rule checkable, and `contract` should also forbid field names that match it case-insensitively.
- **Range extension (proposed, not in AD-13):** `[item.A1:B3]`, only as item plus two cells. It resolves row-major (`[sheet.A1:B2]` is A1, B1, A2, B2; reversed corners give the same list). Cells with no node are empty, not missing, as in a spreadsheet. More than 65,536 cells is refused as `syntax` (hostile `[z.A1:XFD1048576]`). The spreadsheet fixture uses it in `SUM`, `SUMPRODUCT` of two ranges and `MAX` over a 3 by 3 block (run `own`). Without it a Spreadsheet item cannot write `SUM(A1:A10)`.
- **Hostile IDs:** inside brackets any ID is just an ID. Outside brackets a name is only ever a function, so `TRUE` or `SUM` as an item ID cannot clash with the literal or the function, and cell-like IDs (`ab12`, `r1c1`, `xfd1048576`) never become cells.
- **Hostile size** (fixture `hostile-size`, run `own`): 10,000-deep parentheses, 100 nested `SUM` calls, 5,000 unary signs, a 1 MB formula, a 1 MB text literal and a whole-sheet range are all `syntax` warnings before any engine. A 4,001-term flat sum under 8,192 characters evaluates (4,001), and so does 64-level nesting. A 10,000-node chain evaluates (fixture `hostile-chain`).

## Money and currencies

- **Values:** money stays a decimal string in the graph (`"420.00"`, AD-7); each adapter converts it to a number at load (the own adapter after checking `^-?\d+(\.\d+)?$`). Both engines compute in binary floating point: the own evaluator in JavaScript doubles, IronCalc in Rust `f64`. A derived money value is read unrounded; display rounds it to the currency's minor unit (AD-13). The UJ-3 totals are whole numbers and exact; the margin (0.33567839195979897) is not exactly representable, and `0.1+0.2` is the suite's one exact mismatch.
- **Mixed currencies: the check lives in the graph layer**, in `src/precheck.ts`, which every adapter runs before its engine. No formula engine knows currencies, and `ask-core`'s send-time check needs the warning without an engine. A money formula's currencies are its declared one plus those of the money nodes it reads, inferred through other money formulas; more than one gives a `mixed-currencies` warning, the node reads as that error, and nodes that read it inherit it.
- **What buildGraph declares:** the item's currency on the summed columns (`totalCost`, `totalRevenue`), none on a line's products. A line priced in USD in a EUR review then has a USD revenue, and the revenue total is mixed while the cost total is not (fixture `mixed-currencies`: `totalCost` 20,240, `totalRevenue`, `margin` and `belowMinimum` read `mixed-currencies`).
- **Per-amount currency:** the probe accepts `{ "amount": "600.00", "currency": "USD" }` for one field, standing in for AD-7's "an item may declare a currency once for all its amounts". The contract has to fix that shape.
- **Proposed:** `compute` owns the currency check; the port keeps `mixed-currencies` as the kind a node reads.

## The own evaluator

- **Size:** `src/own/` has 7 files and 1,003 lines (902 without comments and blank lines). It also uses the shared `refs.ts` (341 lines), `precheck.ts` (153) and `whitelist.ts` (56), which an IronCalc adapter needs as well. Minified with `bun build --minify --format=iife` (engine, lexer, precheck, whitelist): 25,521 bytes, 8,878 gzipped at level 9. For scale, design.md records IronCalc's `wasm_bg.wasm` at 2,090,515 bytes (719,196 gzipped). The view build of task 4.1 measures the real chunks.
- **Design:** the shared lexer and precheck, then a precedence-climbing parser to an AST. A run of operators of one precedence becomes one `chain` node evaluated by a loop, so a flat 1 MB sum parses without a deep tree (internals). Then an iterative Tarjan ordering that finds the nodes on a cycle (each gets a `cycle` warning; nodes downstream read `cycle`) and an interpreter over the AST with the functions in a module-private `Map`, whose entries are frozen.
- **Incremental recalculation:** `set` marks an input dirty; `recalc` collects its transitive dependents and evaluates only those, in topological order. After 40 seeded edits on the generated board, every node equals a fresh load (internals, run `own`).
- **Excel semantics implemented:** precedence with unary minus above `^`, left-associative `^`, 15-digit comparison and rounding, `ROUND` half away from zero on the decimal value, type ordering in comparisons, booleans and text inside references ignored by aggregates, lazy `IF`, errors propagating left first, `#NUM!` cases mapped to `value`. Dates are Excel serials (serial 0 = 1899-12-30), converted to and from `full-date` with integer calendar arithmetic, with no `Date` object at all. Serials before 1900-03-01 are refused, because of Excel's fictitious 1900-02-29.
- **What it refuses:** no `eval`, `Function`, `with`, `Reflect` or prototype access in `src/own/`, `refs.ts` or `precheck.ts` (`grep -nE "\beval\b|new Function|Function\(|\bwith\s*\(|Reflect\.|Object\.getPrototypeOf|\.prototype" src/own/*.ts src/refs.ts src/precheck.ts` finds nothing). Name lookups go through `Map`s. The parser has its own nesting guard (256), independent of the shared limit of 64: 10,000-deep parentheses, 10,000 unary signs and 1,000 nested calls fed straight to it give a parse error, not a stack overflow (internals). Ordering 200,000 chained nodes does not recurse.
- **Compiles under compute's settings:** `node_modules/.bin/tsc -p tsconfig.own.json` (the own evaluator, `port.ts`, `refs.ts`, `graph.ts`, `precheck.ts`, `whitelist.ts`; `lib: ["es2024"]`, `types: []`) exits 0. So does `tsconfig.suite.json` for the suite, fixtures, reference implementation and SHA-256.
- **Latency** (criterion 4 input; task 3.2 owns the table): on the 926-node board, a single-input edit that moves the whole Gantt chain takes a median of 0.07 to 0.11 ms and a p95 of 0.10 to 0.25 ms in Bun, against the 16 ms frame budget. Load is 1.4 ms warm and 6 to 7 ms cold. At 2,864 nodes, a median edit takes 0.24 to 0.27 ms.

## Notes for the orchestrator

- **Generated board:** 64 leaves give 926 nodes (about 1,000, as criterion 4 needs) but 76 work packages, not about 200. With full PERT and CPM fields, 200 work packages is about 2,900 nodes: `--leaves 200` (2,864 nodes) measures that too.
- **Weekend start:** the plan's first working day is `WORKDAY([start]-1,1)`, because `WORKDAY(start,0)` keeps a weekend date. UJ-2 edit 2 starts the plan on Saturday 2026-11-07 and checks it.
- **ROUNDUP of a float that should be whole:** `ROUNDUP` works on the value at 15 significant digits, so `ROUNDUP((0.1+0.2)*10,0)` gives 3, not 4 (fixture `roundup-near-integer`; LibreOffice agrees). A PERT estimate that should be whole therefore never gains a working day from a float's last bit. The reference implementation does the same.
- **New shared file, not a port change:** `src/precheck.ts`. `port.ts` is unchanged.
