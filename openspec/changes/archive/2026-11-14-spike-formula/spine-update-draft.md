# Spine update draft: formula spike

Replacement texts for task 7.4, drafted before the PO's decisions (task 7.3). Each block belongs to one row of "Proposed outcomes (awaiting the PO)" in `findings.md`, which uses the same row numbers, and applies only if the PO accepts that row. Each block quotes the current text exactly, then gives the replacement. A block marked with a letter (`1.A`) applies only if the PO picks that row's alternative. AD IDs stay stable: every AD is amended in place, and no AD is added.

Files, all under `docs/`:

- **Spine:** `architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`
- **Solution design:** `architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`
- **Addendum:** `prd-askboard-2026-10-25/addendum.md` (block 7.A only)

How to apply:

- Apply the blocks of accepted rows only. For a row accepted with changes, edit its blocks first.
- A phrase block replaces only the quoted phrase; the rest of the line stays. An "Insert after" or "Insert at the end" block adds its text next to the quoted anchor.
- Where two rows touch one passage, they replace different phrases or bullets of it, so their blocks apply in any order:
  - spine AD-13, References: rows 3 and 4 (3.A replaces the phrase that row 3 replaces);
  - spine AD-13, Formulas: rows 1, 2 and 10, one bullet each;
  - solution design §4.7: rows 1, 2, 3 and 12; the paragraph after the table is block 1.3, whose sentences tagged `[row 2]` and `[row 11]` follow those rows;
  - spine AD-8 and solution design §4.5: row 5, or 5.A.
- The mod delivery and renderer spikes' drafts touch the same front matter, the spine's Deferred table (other rows), solution design §12's "Architecture spikes" row and §13's table and introduction. The renderer's draft also appends a sentence to AD-8's board page CSP bullet and to §4.5's CSP bullet, and changes the addendum's licence bullet. Whichever change applies second quotes the text the first one left: the phrases quoted here survive those edits (checked against the renderer worktree on 2026-10-30), and blocks 5.A, 7.A, 13.9 and 14.3 say where.
- **Fact IDs.** The renderer spike adds F39 to F47. If they are already in §13, number this draft's new facts from the next free ID (F48 onwards) and change the `[Fn]` citations in blocks 5.A and 13.9 to match.
- A sentence tagged `[row N]` stays only if row N is accepted; drop the tag when applying.
- Set `updated:` to the apply date in every file changed (row 14).
- Verify with `git diff --exit-code origin/main -- docs/` before applying (empty: this draft changed nothing), then, after applying, with `openspec validate --all --strict --no-interactive`, `bun run check`, and a grep showing that no Deferred row of the spine still names the formula spike as pending (task 7.4).

| Row | Touches |
| --- | --- |
| 1 | Spine AD-13; solution design §4.7 |
| 2 | Spine AD-13; solution design §4.7 |
| 3 | Spine AD-13; solution design §4.7 (spine AD-7 for 3.A) |
| 4 | Spine AD-13 |
| 5 | Spine AD-8; solution design §4.5 |
| 6 | Spine Stack |
| 7 | None (addendum adoption rule for 7.A) |
| 8 | Spine AD-13 |
| 9 | Spine AD-13 |
| 10 | Spine AD-13 |
| 11 | Spine Consistency Conventions (Tests) |
| 12 | Solution design §4.7 |
| 13 | Solution design §13 |
| 14 | Spine Deferred; solution design §10.2, §12; front matter |

## Row 1: the engine

Applies only if the PO accepts row 1 (AskBoard's own restricted evaluator). AD-13's Prevents keeps "lock-in to a formula engine": the port stays.

### 1.1 Spine, AD-13, Rule, Formulas, second bullet

Current (spine):

```text
    - The engine sits behind a `FormulaEngine` port and never sees ask or item IDs; the adapter maps each reference to an engine name.
```

Replacement:

```text
    - The engine is AskBoard's own restricted evaluator, in `compute`: its own parser, a topological sort, and the whitelisted functions written as code. It runs no `eval` or other dynamic code, and looks names up only in its own tables. It sits behind a `FormulaEngine` port and never sees ask or item IDs; the adapter maps each reference to an engine name.
```

### 1.2 Solution design, §4.7, the IronCalc and own evaluator rows of the candidates table

Current (solution design):

```text
| IronCalc `@ironcalc/wasm` 0.9.1 | Pass (MIT OR Apache-2.0, 4,231 stars) | **Candidate.** Excel functions, dependency graph, cycle and reference errors, no path to JavaScript; 0.72 MB gzipped; docs "in its infancy" [F37] |
| Own restricted evaluator | n/a | **Candidate.** Own parser, topological sort, any ID grammar; must build its functions |
```

Replacement:

```text
| IronCalc `@ironcalc/wasm` 0.9.1 | Pass on paper (MIT OR Apache-2.0, 4,231 stars; the `.wasm` also holds Unicode-3.0 and Apache-2.0 WITH LLVM-exception code) | **Not adopted** (formula spike). Excel functions, dependency graph, cycle and reference errors; formula text cannot reach JavaScript, but `NOW`, `TODAY` and `RAND` reach the host [F43]; 0.72 MB gzipped; docs "in its infancy" [F37] |
| Own restricted evaluator | n/a | **Chosen** (formula spike). Own parser, topological sort, any ID grammar; about 1,000 lines, 8,914 bytes gzipped |
```

### 1.3 Solution design, §4.7, the paragraph after the candidates table

Current (solution design):

```text
The spike picks the lighter passing candidate (§10.2); meanwhile molecules use only arithmetic, `SUM`, `MIN`, `MAX`, `IF`, `ROUND` and built-in fields. CI checks determinism across extreme time zones and two locales.
```

Replacement:

```text
The formula spike chose the own evaluator on its measurements (§10.2). Each engine gave the same values in Bun, Node and the three browser engines, under every time zone and locale tried. The own evaluator adds 8,914 bytes gzipped to a board, IronCalc 994,556. It adds 5 to 8 ms to a board's time to visible, IronCalc 43 to 95 ms, and an edit on a 926-node board takes about 0.1 ms, against about 1 ms. IronCalc also needed `'wasm-unsafe-eval'` in the board page's policy, not only in the view's, and four adapter workarounds: shadow cells for exact reads [F40], a limit on operators against a parser crash [F41], a new module instance after a crash, and a grammar check for what its parser lets through. Molecules use only the whitelist in `contract` (AD-13) and built-in fields. [row 2] CI checks determinism across extreme time zones and two locales. It also checks the formula fixtures against Excel's values. [row 11]
```

### 1.A If the PO picks IronCalc

Block 1.1's replacement reads instead:

```text
    - The engine is IronCalc (`@ironcalc/wasm` 0.9.1), in `compute`, started with `initSync` from inlined bytes. It sits behind a `FormulaEngine` port and never sees ask or item IDs; the adapter maps each reference to a cell. The adapter reads values exactly, refuses a formula over 1,000 operators, creates a new module instance after a crash, and checks the grammar before the engine.
```

In block 1.2, the IronCalc row's assessment starts with "**Chosen** (formula spike)." and the own evaluator's with "**Not adopted** (formula spike)." Block 1.3's replacement reads instead:

```text
The formula spike chose IronCalc (§10.2). Each engine gave the same values in Bun, Node and the three browser engines, under every time zone and locale tried. IronCalc needs `'wasm-unsafe-eval'` in the view's and the board page's policies (AD-8), and its adapter reads values through shadow cells [F40], refuses a formula over 1,000 operators [F41], creates a new module instance after a crash, and checks the grammar before the engine. Molecules use only the whitelist in `contract` (AD-13) and built-in fields. [row 2] CI checks determinism across extreme time zones and two locales. It also checks the formula fixtures against Excel's values. [row 11]
```

Rows 5.A, 6.A and 7.A then apply.

## Row 2: the whitelist

Applies only if the PO accepts row 2.

### 2.1 Spine, AD-13, Rule, Declarations in `contract`, third bullet

Current (spine):

```text
    - each built-in derived field, as an expression over whitelisted functions. The whitelist includes PERT, roll-ups, CPM scheduling and scores.
```

Replacement:

```text
    - each built-in derived field, as an expression over whitelisted functions. The whitelist is the operators `+ - * /`, unary minus, `^` and `= <> < <= > >=`, and the functions `SUM`, `MIN`, `MAX`, `IF`, `ROUND`, `AND`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP` and `WORKDAY`, with Excel's semantics. `contract` holds the list, and `compute` holds fixtures for each entry. PERT, roll-ups, CPM scheduling and scores are written with them.
```

### 2.2 Spine, AD-13, Rule, Formulas, third bullet

Current (spine):

```text
    - Until the formula spike closes, molecules use only arithmetic, `SUM`, `MIN`, `MAX`, `IF`, `ROUND` and the built-in derived fields.
```

Replacement:

```text
    - Molecules use only the whitelist and the built-in derived fields.
```

### 2.A If the PO picks the strict set

Only what the built-in derived fields need. Block 2.1's replacement reads instead:

```text
    - each built-in derived field, as an expression over whitelisted functions. The whitelist is the operators `+ - * /`, unary minus, `=`, `<>` and `<`, and the functions `SUM`, `MIN`, `MAX`, `IF`, `AND`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP` and `WORKDAY`, with Excel's semantics. `contract` holds the list, and `compute` holds fixtures for each entry. PERT, roll-ups, CPM scheduling and scores are written with them.
```

Block 2.2 applies unchanged.

## Row 3: references, flat addressing

Applies only if the PO accepts row 3.

### 3.1 Spine, AD-13, Rule, References (phrase)

Current (spine):

```text
A reference is `[item-id(.child-id)*.field]`, where `*` stands for any one child level.
```

Replacement:

```text
A reference is the item ID, then at most one child ID, which is unique within its item (AD-7), then a `*` for each further child level, then the field: `[wbs.ux.optimistic]`, `[wbs.design.*.expected]`, `[wbs.*.expected]`. A `*` stands for the children of the node before it, in document order. A Tree move does not change a reference.
```

### 3.2 Solution design, §4.7, second paragraph (phrase)

Current (solution design):

```text
reference fields as `[item-id(.child-id)*.field]`
```

Replacement:

```text
reference fields as `[item-id.child-id.field]`, with a `*` for each further child level
```

### 3.A If the PO picks path semantics

Block 3.1's replacement reads instead:

```text
A reference is a path: the item ID, then child IDs, each a child of the one before, then the field: `[wbs.design.ux.optimistic]`, `[wbs.design.*.expected]`. A `*` stands for any one child level, in document order. When the user moves a Tree node, the view rewrites the references that name it or a node below it.
```

Leave block 3.2 out. And the spine's AD-7, Rule, IDs, third bullet:

Current (spine):

```text
    - Item IDs are unique within their ask, child IDs within their item.
```

Replacement:

```text
    - Item IDs are unique within their ask, child IDs among their siblings.
```

## Row 4: spreadsheet ranges

Applies only if the PO accepts row 4.

### 4.1 Spine, AD-13, Rule, References (insert after)

Insert after this sentence of the bullet:

```text
Spreadsheet cells are `[item-id.A1]`, which no field name may match.
```

Text to insert:

```text
A range of cells is `[item-id.A1:B3]`: it reads row by row and holds at most 65,536 cells.
```

## Row 5: AD-8, no `'wasm-unsafe-eval'`

Applies only if the PO accepts row 5 (and so row 1). Before applying, check that no other accepted outcome needs WebAssembly in the view (the renderer spike's PlantUML layout): if one does, the line keeps `'wasm-unsafe-eval'` for that use and names it.

### 5.1 Spine, AD-8, Rule, The view sandbox, the view's CSP, fifth item

Current (spine):

```text
      - `'wasm-unsafe-eval'` only if the formula engine is WASM, never `'unsafe-eval'`, `'unsafe-inline'` or `'unsafe-hashes'`;
```

Replacement:

```text
      - never `'wasm-unsafe-eval'`, `'unsafe-eval'`, `'unsafe-inline'` or `'unsafe-hashes'`;
```

### 5.2 Solution design, §4.5, CSP bullet (phrase)

Current (solution design):

```text
`'wasm-unsafe-eval'` appears only for a WASM formula engine; all target browsers support it [F30].
```

Replacement:

```text
Neither policy allows `'wasm-unsafe-eval'`: the formula engine is plain script (§4.7).
```

### 5.A If the PO picks IronCalc

Block 5.1's replacement reads instead:

```text
      - `'wasm-unsafe-eval'` for the formula engine, in this policy and the board page's; never `'unsafe-eval'`, `'unsafe-inline'` or `'unsafe-hashes'`;
```

And the spine's AD-8, Rule, Pages on the board origin, third bullet gains a sentence at its end. Insert at the end of the bullet, after the renderer spike's added sentence if it is there; the bullet currently ends:

```text
`connect-src 'self'` and `frame-src 'self'`, which serves only the reading panel's same-origin source view.
```

Text to insert:

```text
It also allows `'wasm-unsafe-eval'`: the srcdoc inherits this policy, which would otherwise refuse the formula engine's module. WebKit reports a refused module only by throwing a `CompileError`, with no violation event, so the browser tests check for that error.
```

Block 5.2's replacement reads instead:

```text
Both policies allow `'wasm-unsafe-eval'` for the formula engine, since the srcdoc inherits the board page's [F29]; all target browsers support it [F30]. WebKit reports a refused module only with a `CompileError` [F44].
```

## Row 6: the Stack row

Applies only if the PO accepts row 6 (and so row 1).

### 6.1 Spine, Stack, the `@ironcalc/wasm` row

Current (spine):

```text
| `@ironcalc/wasm` (formula engine candidate, spike) | 0.9.1 |
```

Replacement: remove the row.

### 6.A If the PO picks IronCalc

Replacement:

```text
| `@ironcalc/wasm` (formula engine) | 0.9.1 |
```

## Row 7: licences inside IronCalc's `.wasm`

With the own evaluator (row 1), nothing ships IronCalc's `.wasm`, so the adoption rule stays as it is: no block.

### 7.A If the PO picks IronCalc

The addendum's adoption rule, licence bullet (phrase). The renderer spike's draft changes a later phrase of the same bullet; this phrase survives it.

Current (addendum):

```text
- **Licence:** OSI-approved permissive (MIT, Apache-2.0, BSD) by default;
```

Replacement:

```text
- **Licence:** OSI-approved permissive (MIT, Apache-2.0, BSD) by default; Unicode-3.0 and Apache-2.0 WITH LLVM-exception only for code or data compiled into a dependency's shipped binary, shipped with their notices;
```

For reference, the whole bullet as it stands before either change:

```text
- **Licence:** OSI-approved permissive (MIT, Apache-2.0, BSD) by default; MPL-2.0 or EPL-2.0 only for unmodified dependencies; no AGPL or GPL in the shipped bundle; no source-available, "free/trial", licence-key or open-core feature AskBoard would depend on.
```

A licence exception exists only through a PRD change (NFR-6, AD-19): set the addendum's `updated:` too.

## Row 8: a wildcard that matches nothing

Applies only if the PO accepts row 8.

### 8.1 Spine, AD-13, Rule, The graph, third bullet (phrase)

Current (spine):

```text
A missing reference or a cycle does not refuse the ask:
```

Replacement:

```text
A missing reference, a wildcard that matches no node, or a cycle does not refuse the ask:
```

## Row 9: currencies

Applies only if the PO accepts row 9.

### 9.1 Spine, AD-13, Rule, Determinism, first bullet

Current (spine):

```text
    - Derived values ignore locale and timezone; money is rounded only for display, to the currency's minor unit.
```

Replacement:

```text
    - Derived values ignore locale and timezone; money is rounded only for display, to the currency's minor unit. The graph checks currencies before any engine runs: a formula over amounts in more than one currency is a formula error, and so is a formula that reads it.
```

## Row 10: limits

Applies only if the PO accepts row 10.

### 10.1 Spine, AD-13, Rule, Formulas (insert after the first bullet)

Insert after:

```text
    - Formulas are Excel-style expressions that use only the reference syntax and the function whitelist.
```

Text to insert:

```text
    - `contract` holds limits on a formula's length, its nesting depth and a range's size. The graph checks them, with the grammar and the whitelist, before any engine runs; a formula over a limit is a formula error.
```

## Row 11: CI

Applies only if the PO accepts row 11.

### 11.1 Spine, Consistency Conventions, Tests, CI runs (phrase)

Current (spine):

```text
the timezone and locale fixtures (AD-13)
```

Replacement:

```text
the formula fixtures, with Excel's values, and the timezone and locale fixtures (AD-13)
```

## Row 12: mathjs in §4.7

Applies only if the PO accepts row 12.

### 12.1 Solution design, §4.7, the JSONata and mathjs row

Current (solution design):

```text
| JSONata 2.2.2, mathjs 15.2.0 | Pass on paper | 2026 code-execution advisories (CVE-2026-77413, -77414, -77415; CVE-2026-40897, -41139); no graph |
```

Replacement (two rows):

```text
| JSONata 2.2.2 | Pass on paper | 2026 code-execution advisories (CVE-2026-77413, -77414, -77415); no graph |
| mathjs 15.2.0 | Pass on paper | Advisories CVE-2026-40897 and -41139 in evaluation code, fixed in 15.2.0; no graph. The formula spike measured `parse()` alone as a parser and rejected it: at least 90 KB gzipped, and `=`, `<>`, `^`, unary minus and chained comparisons parse with a meaning other than Excel's |
```

## Row 13: facts

Applies only if the PO accepts row 13. Status "Verified" marks a fact the formula spike checked in its own runs, as the renderer spike's rows do.

### 13.1 Solution design, §13, F37

Current (solution design):

```text
| F37 | `@ironcalc/wasm` 0.9.1 fetches its `.wasm` file by default, offers `initSync`, and takes `locale` and `timezone`, resolved through the host's `Intl` | AD-13 | https://www.npmjs.com/package/@ironcalc/wasm | CSP fit: formula spike |
```

Replacement:

```text
| F37 | `@ironcalc/wasm` 0.9.1 fetches its `.wasm` file by default and offers `initSync`; it takes a locale and a time zone. The locale comes from CLDR data inside the `.wasm`, not from `Intl`; the time zone goes through the host's `Intl`, and only `NOW` and `TODAY` use it | AD-13 | https://www.npmjs.com/package/@ironcalc/wasm; `base/src/locale/mod.rs` and `base/src/tz/` at tag v0.9.1, https://github.com/ironcalc/IronCalc | `initSync` from inlined bytes runs in the view only with `'wasm-unsafe-eval'` in both the view's and the board page's policy (formula spike, runs `smoke`, `c1`, `c1-negative`) |
```

### 13.2 to 13.8 Solution design, §13, new rows after F38

Insert after the F38 row (or after the last fact row, if other spikes added some; see Fact IDs above):

```text
| F39 | `@ironcalc/wasm`: the `Model` constructor takes four arguments, `(name, locale, timezone, language_id)`, and `initSync` takes `{ module }`, both since 0.7.0; the package README still shows two arguments | AD-13 | `wasm.d.ts`, `wasm.js` and `README.md` in the 0.9.1 package; https://github.com/ironcalc/IronCalc/releases | Verified (formula spike, criterion 7) |
| F40 | `@ironcalc/wasm` 0.9.1 has no getter for a cell's raw value, and its number formats stop at 15 significant digits | AD-13 | `wasm.d.ts` in the 0.9.1 package | Verified (formula spike, runs `ironcalc-quirks`, `precision`) |
| F41 | IronCalc 0.9.1's parser overflows its WASM stack on one formula of about 1,190 binary operators; after the trap every call on that module instance fails | AD-13 | Formula spike, run `ironcalc-quirks` | Verified |
| F42 | IronCalc 0.9.1's `AND` and `OR` stop at the first deciding argument: `AND(FALSE,1/0)` is FALSE, where the fixtures, following Excel, expect `#DIV/0!` | AD-13 | Formula spike, run `ironcalc` (fixture `error:mixed-currencies`) | Verified in IronCalc; Excel itself not run |
| F43 | IronCalc 0.9.1 has impure and indirect functions, among them `INDIRECT`, `OFFSET`, `NOW`, `TODAY`, `RAND`, `INFO`, `CELL`, `HYPERLINK` and `LAMBDA`; it accepts them all, so only a check before the engine keeps them out | AD-13 | `base/src/functions/mod.rs` at tag v0.9.1, https://github.com/ironcalc/IronCalc | Verified (formula spike, fixture `not-whitelisted`) |
| F44 | WebKit raises no `securitypolicyviolation` event when the CSP refuses a WebAssembly compile; it only throws a `CompileError` | AD-8 | Formula spike, run `c1-negative` (WebKit 27.2) | Verified; the renderer spike found the same |
| F45 | Excel evaluates operators of equal precedence left to right, so `^` is left-associative (`2^3^2` is 64), and negation binds tighter than `^` (`-2^2` is 4) | AD-13 | https://support.microsoft.com/en-us/office/calculation-operators-and-precedence-in-excel-48be406d-4975-4d31-b2b8-7af9e0e2878a | Verified in LibreOffice (formula spike, run `lo-check`) and in both engines; Excel itself not run |
```

If the renderer spike's F41 is already in §13 (it states the same for WebKit), leave F44 out, renumber, and cite that fact in block 5.A.

### 13.9 Solution design, §13, introduction (insert at the end)

The introduction ends with a sentence each from the mod delivery and renderer spikes once their drafts are applied; insert after the last one. Currently it ends:

```text
"research-cc" and "research-stack" are the research files that travel with the spine.
```

Text to insert:

```text
F39 to F45 come from the formula spike's runs and readings of 2026-10-30, and it checked F37 again.
```

## Row 14: Deferred, §10.2, §12 and front matter

Applies only if the PO accepts row 14 (with row 1, or with 1.A).

### 14.1 Spine, Deferred, the formula engine row

Current (spine):

```text
| Formula engine (IronCalc or own restricted evaluator) and the content of the function whitelist | AD-13 fixes the port, the grammar and the interim function set | Formula spike |
```

Replacement: remove the row.

### 14.2 Solution design, §10.2 (insert after)

Insert after:

```text
**What changes.** The `@ironcalc/wasm` Stack row stays or goes; `'wasm-unsafe-eval'` applies only to a WASM engine (AD-8); the interim function set gives way to the whitelist in `contract`.
```

Text to insert (a new paragraph):

```text
**Outcome (2026-10-30).** The own evaluator passed every criterion with AD-8 as written; IronCalc passed only with `'wasm-unsafe-eval'` in the board page's policy as well, four adapter workarounds, and failed three fixture checks (`AND` stopping early, and the operator limit). The own evaluator is lighter (8,914 bytes gzipped against 994,556), starts faster and recalculates an edit about ten times faster, so it goes behind `FormulaEngine` (AD-13). The whitelist, flat references with ranges, and the limits are in AD-13; the archived OpenSpec change `spike-formula` holds the evidence.
```

If the PO picks IronCalc (1.A), the second sentence reads instead:

```text
The product owner chose IronCalc, with `'wasm-unsafe-eval'` in both policies (AD-8) and the adapter's workarounds in `compute` (AD-13).
```

### 14.3 Solution design, §12, the "Architecture spikes (§10)" row (phrase)

Current (solution design):

```text
formula engine and whitelist (formula); 
```

Replacement: remove the phrase, with its trailing space. The mod delivery and renderer spikes remove their own phrases from the same cell; if the cell would be left empty, remove the row.

### 14.4 Spine, front matter

Current (spine):

```text
updated: '2026-10-29'
```

Replacement:

```text
updated: '<apply date>'
```

### 14.5 Solution design, front matter

Current (solution design):

```text
updated: '2026-10-29'
```

Replacement:

```text
updated: '<apply date>'
```

If another spike's change was applied first, the current value is its apply date; replace it all the same. Block 7.A, if applied, also sets the addendum's `updated:` (currently `updated: 2026-10-28`, unquoted) to the apply date.
