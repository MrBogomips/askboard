# Design

## Context

- **State:** `packages/compute` exists with an empty entry point, compiles without DOM, Node or Bun types, and may import only `contract` (AD-1, `tools/check-imports.ts`). This change branches from E1's Track 0 commit `577ce97`, so `contract` already has E1's layout: `constants.ts` with patterns as strings, `sets.ts`, `validate.ts` and `schemas/<set>/`. E1 leaves `compute` untouched and is built in parallel by two other sessions.
- **Decided:** the formula spike (`openspec/changes/spike-formula/`, findings § Proposed outcomes, all accepted on 2026-10-30) chose AskBoard's own restricted evaluator, the whitelist, flat references with ranges, an empty-wildcard warning, the currency check in the graph layer, limits in `contract` and Excel-valued fixtures in CI; AD-13 and SOLUTION-DESIGN §4.7 and §10.2 carry those decisions.
- **The probe** (`probe/src/own/`, `refs.ts`, `precheck.ts`, `graph.ts`) passed all 1,457 checks, but it implements path references, not the flat ones decided; its engine receives addresses; parse errors and cycles surface only when an engine loads, while AD-13's send-time check calls `buildGraph` without one; and it checks currencies only for money formulas.
- **Constraints:** no new dependency and `bun.lock` frozen until E1 is integrated; plain ECMAScript in `compute` (AD-1, SOLUTION-DESIGN §3.3); coverage at 80% or more; macOS and Linux (NFR-7), which the code meets by using no platform API.

## Goals / Non-Goals

**Goals:**

- A `compute` that a widget change can use as it is: build a graph, evaluate it, set inputs, recalculate, read values and warnings.
- Every check AD-13 assigns to the graph runs in `buildGraph`, with no engine, so `ask-core`'s send-time check and the board report the same problems.
- The engine sees engine names only (AD-13), and the whitelist exists once, in `contract`.

**Non-Goals:**

- Reading the board document, which has no widget items yet (proposal, open question 1).
- Field checks as derived values (EXPERIENCE, Field checks), the sales-review and decision-matrix fields, holidays and start constraints in CPM.
- Performance work beyond the probe's: its measurements (0.10 ms median edit at 926 nodes) are far inside the 16 ms budget.

## Decisions

### 1. `contract` holds data, `compute` holds code

- `packages/contract/src/formula/` holds `grammar.ts` (ID, field name and cell patterns as strings, as `constants.ts` does; sheet bounds; the binary operator table with precedence; unary minus; the wildcard), `whitelist.ts` (each function with its least and greatest number of arguments, its Excel semantics and the derived field that needs it; the operators; the refused `&` and `%`), `limits.ts` and `errors.ts` (the eight error kinds). One export block is appended to `contract`'s `index.ts`; no E1 file changes otherwise.
- The lexer, parser and checks are code and live in `compute`, which builds its regular expressions from the contract's patterns. A test in `contract` pins the lists to AD-13; a test in `compute` pins the engine's function table to the contract's list.
- **Alternatives:** the lexer in `contract` (AD-13's "the grammar lives in `contract`"): no other unit needs it, since `ask-core` calls `buildGraph`. A JSON Schema for formulas in the input format: it would change E1's input set; it comes with the first widget that carries a formula (open question 11).
- `compute`'s `package.json` declares `"@askboard/contract": "workspace:*"`, on the spine's diagram. Without it the import resolves only through the root's development dependency, which the isolated linker does not promise. `bun install` then adds that one line to `compute`'s workspace entry in `bun.lock`, and no package.

### 2. The graph source

`buildGraph(source)` takes `{ items }`, where each item is one of:

- `fields`: an item ID, an optional currency for its money inputs, `fields` and `cells` (each a field input: a type, then a value or a formula, and a currency for money), and `children`, a tree of `{ id, fields, children }`;
- `wbs-pert`: an item ID and `nodes`, the approved UJ-2 example's `wbs-pert` data (`id`, `children`, `optimistic`, `mostLikely`, `pessimistic`; other keys ignored);
- `gantt-plan`: an item ID and the example's `gantt-plan` data (`workPackages`, `start`, `dependencies`).

The two computed kinds are expanded into `fields` items first (decision 9). Structure errors throw a `GraphSourceError` naming the item and the problem (proposal, open question 10); value errors become warnings. Trees are walked with explicit stacks, so depth costs no call stack.

### 3. `buildGraph`: one pass per check, in AD-13's order

1. Validate the structure and expand `wbs-pert` and `gantt-plan` (the plan reads its WBS's leaves, so all `wbs-pert` items expand first).
2. Index the nodes in document order: item fields, then cells row by row, then children in pre-order, each child's fields in declaration order. The index also keeps each node's parent and its children in order, per item.
3. Check each input against its type; a bad one is a fixed `value` error and a warning.
4. Check each formula: length (`over-limit`), lexing (`syntax`), nesting depth counted as the parser counts it (each open parenthesis or call, and each unary sign until its operand ends, so signs before a `(` stay open until its `)`), and range sizes from the two corners (`over-limit`), bare names (`syntax`), names and operators outside the whitelist and unary plus (`not-whitelisted`), then the parse (`syntax`, including each function's number of arguments). Range sizes come before any range is expanded, so `[z.A1:XFD1048576]` costs nothing.
5. Resolve references (decision 4); a missing node, child or item, or an empty wildcard, is `missing-reference`.
6. Order the nodes and find cycles (decision 8).
7. Check currencies in that order (decision 7). Cycles come first: two money formulas on a cycle would otherwise each read the other's mix, and neither would be its origin.

A node that fails a step keeps that step's error, is not checked further and is a warning. The result is a frozen `Graph` with `nodes` (address, type, input or formula, resolved currency) and `warnings`. The parsed expressions, reference lists and dependencies stay in a module-private `WeakMap` keyed by the graph, which `evaluateGraph` reads; a graph not made by `buildGraph` is refused.

### 4. Flat references and their resolution

- **Lexing:** the inside of `[...]` splits on `.` into the item ID, an optional child ID in second place only, then only `*` segments, then the last segment: a field name, or, with no middle segment, an upper-case cell or a range `A1:B3`. Two concrete child IDs, a child ID after a `*`, a cell after a child and a malformed ID are `syntax`, each with its reason. A lower-case `a1` is a field name, as the spine allows (proposal, open question 6).
- **Resolution:** no middle segment reads `item.last`; a child and no `*` reads `item.child.field`; otherwise the base is the child, or the item's root, and each `*` replaces the current list of nodes by their children in order. The result lists `item.node.field` for each node that has the field. A list is its size and its non-empty places as `[place, address]`: for a wildcard, every place; for a range, row by row, only the cells that exist, found from the item's cells, so a 65,536-cell range costs what its filled cells cost (review finding 5: expanding every address took 2.1 GB for one 8 KB formula). A cell of a known item without a node reads as empty, alone or in a range, as an empty cell does in Excel; the probe refused it alone as missing.
- **Why flat:** spike row 3. Because child IDs are unique within their item, `item.child.field` is also AD-20's diff target, and a Tree move changes no reference.

### 5. Error kinds and propagation

- The kinds are the contract's eight. `#NUM!` cases (`0^0`, `SQRT(-1)`, overflow) are `value`, as the spike's fixtures have them; `#DIV/0!` is `division-by-zero`.
- A problem found in a formula at build time makes its node a fixed error, and a last pass in dependency order gives every formula that reads it the same fixed error, with the origin's address and no warning. A lazy `IF` therefore cannot turn a cycle, a missing reference or a refused formula into a number (review finding 4). An input's bad value is not such a problem: `set` can put it right, so it travels as a value.
- Run-time errors (`value`, `division-by-zero`) are values and propagate left operand first, as in Excel, so `IF(FALSE,1/0,2)` is 2; they are never warnings.
- **Empty wildcard:** the spine's AD-13 makes the formula an error (proposal, open question 3).

### 6. The parser and the expression

- The probe's precedence-climbing parser, ported: a run of one precedence becomes one `chain` node evaluated in a loop, so a 4,001-term sum builds no deep tree; unary minus binds tighter than `^`; every binary operator is left-associative. A guard of its own (256 levels) backs the contract's limit of 64.
- References in an expression are indexes into the node's reference list, not addresses. The graph keeps the list resolved to addresses; the adapter gives the engine the same expression with each reference resolved to engine names. One parse serves the send-time check and the engine, and the engine never sees an ID.
- **Alternative:** the probe's tokens passed to the engine with a callback that resolves references: it parsed only in the engine, so `buildGraph` could not report syntax errors.

### 7. Currencies

- A money input's currency is its own, else its item's; without either the source is malformed.
- A money formula's currency is its declared one, else inferred from what it reads. One pass in dependency order (decision 8) replaces the probe's fixpoint: after the cycle check, what remains is acyclic.
- For every formula, of any type, the currencies of the money nodes it reads directly (inputs, and money formulas with a single currency) plus its own declared currency: more than one makes it the origin of a `mixed-currencies` warning. A formula that reads a mixed money node is a fixed `mixed-currencies` error with the origin's address and no warning, so a lazy `IF` cannot hide the mix; a money formula that does so is mixed in turn (proposal, open question 7).
- A mixed money formula has no currency; one refused by an earlier check keeps its declared one.

### 8. Order and cycles

The probe's iterative Tarjan ordering, in `compute`'s own module: edges from a node to what it reads, components out in dependency order. `buildGraph` marks every node in a component of two or more, or reading itself, as a fixed `cycle` error and a warning; nodes that read them inherit the error by value, like a missing reference. The engine runs the same ordering for its evaluation order, so a cycle that reached it would still read as `cycle`.

### 9. PERT and CPM as formulas

- **PERT:** a leaf gets `optimistic`, `mostLikely` and `pessimistic` as number inputs (empty when absent), `expected` = `([w.n.optimistic]+4*[w.n.mostLikely]+[w.n.pessimistic])/6` and `spread` = `([w.n.pessimistic]-[w.n.optimistic])/6`; a parent and the item get `SUM([w.n.*.expected])` and `SQRT(SUMSQ([w.n.*.spread]))` (for the item, `[w.*.…]`).
- **CPM**, per task `t` of plan `p` over WBS `w`: `duration` = `MAX(1,ROUNDUP([w.t.expected],0))`; `es` = `MAX(0,[p.a.ef],…)` over predecessors, else `0`; `ef` = `es+duration`; `lf` = `MIN([p.s.ls],…)` over successors, else `[p.finish]`; `ls` = `lf-duration`; `slack` = `ls-es`; `critical` = `slack=0`; `startDate` = `WORKDAY([p.firstDay],es)`; `finishDate` = `WORKDAY([p.firstDay],ef-1)`. The plan gets `start` (date input), `firstDay` = `WORKDAY([p.start]-1,1)` (a weekend start moves to Monday), `finish` = `MAX([p.*.ef])` and `finishDate`.
- Written this way, scheduling is incremental with the rest of the graph, dependency cycles are formula cycles, and a dependency that names no task becomes a `missing-reference`. Every dependency must be an ID, or the source is refused: IDs become formula text (review finding 3). A dependency key that names no task, and a `workPackages` that names no `wbs-pert` item, add a warning addressed `plan.taskId` or `plan.workPackages`.
- A test runs every generated formula through the formula check: no built-in field uses anything outside the whitelist.

### 10. The `FormulaEngine` port and the adapter

- **Port:** `load(cells)`, where cell *i* has engine name *i* and is an input, a formula (expression plus references as engine names: one name, -1 for an empty cell, or a list's size and its non-empty places; and whether its result is a date) or a fixed error; `set(name, value)`; `recalc()`, returning the names it evaluated in order; `read(name)`. Values are numbers, text, booleans, empty or an error whose origin is an engine name. Dates are serial numbers and money is a number inside the engine; a date cell's result out of 1900-03-01 to 9999-12-31 is a `value` error in the engine, so its readers see it (review finding 1). Numeric text past the largest number is `value` (finding 2), and `ROUND` and `ROUNDUP` leave a number unchanged when the place to round is past its 15th significant digit (finding 7).
- **Own engine:** the probe's interpreter, functions and incremental recalculation, with the seven dropped functions removed and the function table built from the contract's list. Names resolve through a frozen `Map`; no `eval`, `Function`, `with`, `Reflect` or prototype access, which a test checks over `compute`'s sources.
- **Adapter:** `evaluateGraph(graph, engine = createOwnEngine())` assigns engine names in document order, converts inputs (a `full-date` to a serial with integer calendar arithmetic and no `Date`; a money decimal string to a number), loads, and returns `read(address)`, `set(address, value)` and `recalc()` returning addresses. A read converts a date node's number back to a `full-date` and maps an error's origin back to its address. `set` on a formula node or an unknown address throws; `read` of an unknown address returns `missing-reference`.

### 11. Fixtures and tests

- **Adapted from the probe, not regenerated:** `whitelist.json` keeps all 123 cases verbatim (formulas, Excel values, `excel` and `js` notes); its three input sets become one `fields` item `x`, with the `list` set's children renamed so child IDs are unique within `x` (formulas read them only through wildcards, so no formula changes). The 15 cases of dropped functions stay in the file with their Excel values, as a record; the test expects `not-whitelisted` for them.
- `errors.json` and the hostile fixtures become `fields` sources with flat addresses. Expected kinds change only where a decision changed them, each noted in the fixture: `path-not-flat` now reads the flat reference and refuses the path one as `syntax`; the empty wildcard reads `missing-reference`; the size cases read `over-limit`; the money case becomes a `fields` item with the probe's formulas.
- The UJ-2 board fixture's expected values (75 nodes and three edits) are rewritten to flat addresses; the source is the approved example's data. The spreadsheet fixture becomes a `fields` item with cells.
- A one-off conversion did the address rewriting (keep the last child ID before the first `*`); the fixture files are the result and say where they come from.
- Numbers pass when bit-identical, or within 1e-9 relative, counted apart as in the probe. Every edit fixture also checks that the edited graph equals a fresh build.
- **Determinism:** a test runs a script that evaluates every fixture and prints a SHA-256 of the canonical results, under the four time zone and locale pairs, and expects one hash.

## Risks / Trade-offs

- [The graph source is not the board document] → its two computed kinds use the approved example's data shapes, so the widget changes map the board document onto it without changing `compute`'s checks.
- [PERT and CPM in `compute` may disagree with AD-13's "declarations in `contract`"] → open question 2, accepted as proposed on 2026-10-31: AD-13 now says that `compute` writes them (`spine-update-draft.md`, applied).
- [The fixtures' Excel values are Excel's documented behaviour, not yet checked in Excel] → spike task 8.1 is the PO's; a different value changes the fixture and the evaluator together.
- [`bun.lock` changes by one line while E1 freezes it] → the line is the workspace link `compute` → `contract`; recorded in the merge notes.
- [A stricter currency rule than the probe's] → only formulas that read amounts in two currencies are affected, which the spine already calls errors.

## Migration Plan

Nothing is deployed. Merge after E1's integration, or before it with the notes below; no data or configuration migrates.

- `packages/contract/src/index.ts`: the formula export block is appended at the end; if E1 appends there too, keep both blocks.
- `packages/compute/package.json` and `bun.lock`: E1 does not touch `compute`'s entry; rerun `bun install` after the merge and expect no further change.
- `openspec/specs/contract/spec.md`: whichever change is archived second adds its requirements to the first's.

## Open Questions

None. The PO accepted the proposal's thirteen open questions as proposed on 2026-10-31.
