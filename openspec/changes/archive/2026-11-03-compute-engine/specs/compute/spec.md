# Spec Delta

## Purpose

The compute unit builds a board's whole graph of typed values and formulas, checks every formula before any engine runs, evaluates it with AskBoard's own restricted evaluator, and computes PERT estimates and CPM schedules, so that derived values never need the agent (AD-13).

## ADDED Requirements

### Requirement: One graph from a graph source
`compute` SHALL build a graph from a graph source alone: items with typed fields, spreadsheet cells and a tree of children, plus WBS-with-PERT and Gantt-plan items. Each field or cell SHALL be one node, addressed as `item.field`, `item.child.field` or `item.A1`, holding an input value or a formula. Building SHALL be pure: the same source always gives the same graph and warnings.

#### Scenario: Nodes and addresses
- **WHEN** a source holds item `wbs` with child `design`, whose child `ux` has the field `optimistic` set to 3
- **THEN** the graph has the node `wbs.ux.optimistic` with the input 3, whatever the depth of `ux` in the tree

#### Scenario: Building twice
- **WHEN** the same source is built twice
- **THEN** both graphs have the same nodes in the same order and the same warnings

### Requirement: Malformed sources are refused
Building SHALL fail with an error naming the problem, before any graph exists, when an item or child ID does not match `[A-Za-z0-9_-]{1,64}` or repeats (item IDs within the source, child IDs within their item), when a field name is not a field name or is a cell, when a cell key is not a cell, when a field holds both a value and a formula, when a type or item kind is unknown, or when a money input has no currency, or a Gantt plan's dependency is not an ID.

#### Scenario: Two children with one ID
- **WHEN** two children of item `wbs`, under different parents, both have the ID `ux`
- **THEN** building fails, naming `wbs` and `ux`

#### Scenario: A dependency that is not an ID
- **WHEN** a plan's dependency names the task `t1.ef]+100+[p.t1`
- **THEN** building fails, naming the plan: no ID reaches formula text unchecked

#### Scenario: A field named like a cell
- **WHEN** an item declares the field `A1`
- **THEN** building fails, naming the field

### Requirement: Formulas are checked before any engine runs
Every formula SHALL be checked, in this order, before any engine sees it: its length, its grammar, its nesting depth and range sizes, the names it calls and the operators it uses, its parse, then its references. A formula that fails SHALL be a warning naming the node, with an error kind and a reason, and the node SHALL read as that error.

#### Scenario: A refused function
- **WHEN** a formula calls `NOW()`, `INDIRECT("x.a")`, `HYPERLINK("https://example.com")` or `constructor(1)`
- **THEN** the node reads as `not-whitelisted`, and the warning names the node and the function

#### Scenario: A refused operator
- **WHEN** a formula uses `&`, `%` or a unary `+`
- **THEN** the node reads as `not-whitelisted`, and the reason names the operator

#### Scenario: A grammar error
- **WHEN** a formula is `1+`, `SUM(1,,2)`, `=1+2`, `A1+1`, `ROUND(1)` or `$A$1`
- **THEN** the node reads as `syntax`, with a reason

### Requirement: Formula limits
A formula longer than the contract's character limit, nested deeper than its depth limit (parentheses, calls and runs of unary signs), or holding a range of more cells than its range limit SHALL be refused as `over-limit`, with the limit and the measured size in the reason, without being parsed further.

#### Scenario: A formula of one megabyte
- **WHEN** a formula is 1 MB long
- **THEN** the node reads as `over-limit`, and the reason names the 8,192-character limit and the length

#### Scenario: Deep nesting
- **WHEN** a formula nests 10,000 parentheses, 100 `SUM` calls or 5,000 unary minus signs
- **THEN** the node reads as `over-limit`, and nothing overflows the stack

#### Scenario: At the limits
- **WHEN** a formula nests exactly 64 parentheses, or is a flat sum of 4,001 terms under 8,192 characters
- **THEN** it evaluates (1 and 4001)

#### Scenario: A whole-sheet range
- **WHEN** a formula reads `[z.A1:XFD1048576]`
- **THEN** the node reads as `over-limit`, and no list of cells is built

### Requirement: Flat references
A reference SHALL be the item ID, then at most one child ID, unique within its item, then a `*` for each further child level, then the field. A `*` SHALL stand for the children of the node before it, in document order; a child without the field SHALL be skipped. Moving a node in its item's tree SHALL NOT change what a reference to it reads.

#### Scenario: A child anywhere in the tree
- **WHEN** `ux` is a child of `design` in item `wbs`, and a formula reads `[wbs.ux.optimistic]`
- **THEN** it reads `ux`'s optimistic estimate

#### Scenario: Wildcards in document order
- **WHEN** a formula reads `[wbs.design.*.expected]`, `[wbs.*.expected]` and `[wbs.*.*.expected]`
- **THEN** they read the children of `design`, the children of the item, and its grandchildren, each in document order

#### Scenario: A moved node
- **WHEN** `ux` moves from `design` to `build` and the graph is built again
- **THEN** `[wbs.ux.optimistic]` reads the same value

#### Scenario: Two child IDs
- **WHEN** a formula reads `[wbs.design.ux.optimistic]`
- **THEN** the node reads as `syntax`: a reference holds at most one child ID

### Requirement: Cells and ranges
A spreadsheet cell SHALL be referenced as `[item.A1]`, upper case only, columns `A` to `XFD` and rows 1 to 1,048,576. A range `[item.A1:B3]` SHALL read every cell of its rectangle row by row, either corner first. A cell of a known item with no node, alone or in a range, SHALL read as empty, as in Excel.

#### Scenario: A range with an empty cell
- **WHEN** cells A1 to A3 hold 10, 20 and 30, A4 text, A5 TRUE, A6 nothing, and a formula is `SUM([sheet.A1:A6])`
- **THEN** it gives 60

#### Scenario: An empty cell alone
- **WHEN** cell Z9 of `sheet` has no node and a formula is `[sheet.Z9]+1`
- **THEN** it gives 1, with no warning

#### Scenario: Row-major order
- **WHEN** a formula reads `[sheet.B2:A1]`
- **THEN** it reads A1, B1, A2, B2 in that order

#### Scenario: A lower-case name is a field
- **WHEN** item `sheet` has a cell A1 and no field `a1`, and a formula reads `[sheet.a1]`
- **THEN** the node reads as `missing-reference`: `a1` is a field name, not a cell

### Requirement: Missing references and empty wildcards
A reference to a field, child or item that does not exist, and a cell, wildcard or range of an item that does not exist, SHALL be a `missing-reference` warning naming the node and the reference. A wildcard that matches no node SHALL be one too. The node SHALL read as `missing-reference`, and nodes that read it SHALL read the same error without a warning of their own.

#### Scenario: A missing reference upstream
- **WHEN** `x.b` is `[x.a]+[x.nope]` and `x.c` is `[x.b]*2`
- **THEN** `x.b` and `x.c` read as `missing-reference`, and only `x.b` is a warning

#### Scenario: A wildcard that matches nothing
- **WHEN** item `x` has no children and a formula is `SUM([x.*.v])`
- **THEN** the node reads as `missing-reference`, not 0, and the warning names the wildcard

### Requirement: Cycles
A node on a cycle of references, a node that reads itself included, SHALL read as `cycle`, and each such node SHALL be a warning. Nodes that read a node on a cycle SHALL read as `cycle` without a warning; nodes off the cycle SHALL evaluate normally.

#### Scenario: An indirect cycle
- **WHEN** `x.a` reads `x.c`, `x.b` reads `x.a`, `x.c` reads `x.b`, `x.d` reads `x.c`, and `x.e` is `3+4`
- **THEN** `x.a`, `x.b` and `x.c` are warnings and read as `cycle`, `x.d` reads as `cycle`, and `x.e` is 7

#### Scenario: A cycle through a wildcard
- **WHEN** child `a`'s field `v` is `[w.total]/2` and `w.total` is `SUM([w.*.v])`
- **THEN** both are warnings and read as `cycle`

#### Scenario: A long chain
- **WHEN** 10,000 nodes each read the previous one
- **THEN** the last one evaluates to 10,000 and nothing overflows the stack

### Requirement: Currencies are checked in the graph
Every money input SHALL have one ISO 4217 currency, its own or its item's. A money formula SHALL take its declared currency, otherwise the single currency of the money it reads. A formula of any type that reads amounts in more than one currency SHALL be a `mixed-currencies` warning naming the currencies; formulas that read it SHALL read the same error without a warning.

#### Scenario: One line priced in another currency
- **WHEN** a EUR estimate has a line whose daily rate is in USD, and the revenue total, declared in EUR, sums every line's revenue
- **THEN** the USD line's revenue is 24,000, the cost total is 20,240, the revenue total is a `mixed-currencies` warning, and the margin read from it is `mixed-currencies` without a warning

#### Scenario: A number formula over two currencies
- **WHEN** a number formula divides a USD amount by a EUR amount
- **THEN** it is a `mixed-currencies` warning

### Requirement: Excel's semantics for the whitelist
Every whitelisted operator and function SHALL give Excel's value on the compute fixtures, each with Excel's documented value: unary minus binds tighter than `^`, `^` is left-associative, numbers compare and round at 15 significant digits, `ROUND` rounds half away from zero on the decimal value, `IF` is lazy, aggregates ignore text and booleans inside references, and errors propagate from the left.

#### Scenario: Where JavaScript differs
- **WHEN** the formulas `-2^2`, `2^3^2`, `ROUND(2.675,2)`, `ROUND(-2.5,0)`, `0.1+0.2=0.3`, `ROUNDUP((0.1+0.2)*10,0)` and `1/0` are evaluated
- **THEN** they give 4, 64, 2.68, -3, TRUE, 3 and `division-by-zero`

#### Scenario: Every whitelist fixture
- **WHEN** the whitelist fixtures of a whitelisted entry are evaluated
- **THEN** each gives its expected value, and a number that is not bit-identical is within 1e-9 of it, relative to its size

### Requirement: Dropped functions are refused
`OR`, `NOT`, `ABS`, `CEILING`, `AVERAGE`, `COUNT` and `NETWORKDAYS`, dropped by the formula spike's decision, SHALL be refused as `not-whitelisted`, like any other function outside the whitelist.

#### Scenario: Each dropped function
- **WHEN** a formula calls any of the seven dropped functions, in any case
- **THEN** the node reads as `not-whitelisted`, and the reason names the function

### Requirement: A formula error is never a number
A node whose formula fails, or that reads a node in error, SHALL read as an error with a kind and the address of the node where the error arose; it SHALL never read as a number or any other value. A problem found before any engine runs SHALL reach every formula that reads it, even through a branch that `IF` does not take. A formula whose result is empty SHALL read as 0, as in Excel.

#### Scenario: A branch not taken
- **WHEN** `x.a` is `IF(TRUE,1,[x.c])` with `x.c` on a cycle, and `x.b` is `IF(FALSE,[x.m],2)` with `x.m` a missing reference
- **THEN** `x.a` reads as `cycle` and `x.b` as `missing-reference`, each with its origin's address

#### Scenario: Division by zero downstream
- **WHEN** `x.a` is `1/[x.zero]` with `x.zero` set to 0, and `x.c` is `[x.a]+1`
- **THEN** both read as `division-by-zero` with the address `x.a`, and neither is a load warning

### Requirement: Dates, money and input values
A date SHALL enter and leave the graph as an RFC 3339 `full-date` and be computed as a whole day, without a time zone; a date outside 1900-03-01 to 9999-12-31 SHALL be an error, for the nodes that read it too. Numeric text past the largest number SHALL be `value`, never infinite. A money input SHALL be a decimal string. An input that does not fit its node's type SHALL be a `value` warning at build time, and SHALL read as `value` when set later.

#### Scenario: A day that does not exist
- **WHEN** a date input is `2026-02-30` and a formula adds 1 to it
- **THEN** the input is a `value` warning and the formula reads as `value`

#### Scenario: A date result
- **WHEN** a date node's formula is `WORKDAY([x.fri],1)` and `x.fri` is 2026-11-06
- **THEN** it reads `2026-11-09`

### Requirement: Editing and recalculation
Setting an input SHALL take effect at the next recalculation, which SHALL evaluate only the nodes downstream of the changed inputs and say which ones it evaluated. After any sequence of edits, every node SHALL equal what a fresh build of the edited source gives. Setting a formula node or an unknown address SHALL fail.

#### Scenario: An estimate edited
- **WHEN** the UX package's pessimistic estimate in UJ-2 changes from 10 to 16 and the graph recalculates
- **THEN** its expected effort is 6.5, the WBS total is 41.67, the plan finishes on 2026-12-14, and nodes that do not depend on it are not evaluated

### Requirement: The engine behind its port
The formula engine SHALL sit behind a port addressed by engine names only, so it never sees an ask, item or child ID. It SHALL run no `eval`, `Function` or other dynamic code, and SHALL look function names up only in its own table, which holds exactly the contract's whitelist.

#### Scenario: Hostile IDs
- **WHEN** items and children are named `constructor`, `__proto__`, `toString`, `TRUE`, `SUM`, `A1`, `r1c1`, `-x` and `123`, and formulas read them
- **THEN** every reference reads its own node's value

#### Scenario: The engine's table
- **WHEN** the engine's function table is compared with the contract's whitelist
- **THEN** they hold the same names

### Requirement: Determinism
Derived values SHALL NOT depend on the time zone, the locale or the clock: the fixtures SHALL give identical results under `TZ=Pacific/Kiritimati` and `TZ=America/Adak`, each with the locales `en-US` and `de-DE`. Numeric text SHALL be read as plain decimals whatever the locale.

#### Scenario: Four environments, one result
- **WHEN** every fixture is evaluated in the four time zone and locale combinations
- **THEN** the four sets of results are identical

### Requirement: PERT estimates
A WBS-with-PERT item SHALL give each leaf an expected effort `(optimistic + 4 × most likely + pessimistic) / 6` and a spread `(pessimistic − optimistic) / 6`, each parent and the item the sum of its children's expected efforts and the square root of the sum of their squared spreads, all as formulas over the whitelist. A leaf's estimates SHALL be its inputs; a parent's SHALL be ignored.

#### Scenario: UJ-2's work breakdown
- **WHEN** UJ-2's WBS is built and evaluated
- **THEN** UX design's expected effort is 5.5 and its spread 1.17, Design's is 14 and 1.58, and the WBS total is 40.67 with a spread of 3.21

#### Scenario: A package split
- **WHEN** a leaf gets two children with their own estimates and the graph is built again
- **THEN** its expected effort becomes the sum of theirs, and its own estimates are ignored

### Requirement: CPM scheduling
A Gantt plan SHALL schedule its WBS's leaves in working days: duration the expected effort rounded up, at least 1; earliest start the latest earliest finish of its predecessors; latest finish the earliest latest start of its successors, or the plan's finish; slack, a critical flag at zero slack, and start and finish dates from the first working day on or after the plan's start.

#### Scenario: UJ-2's plan
- **WHEN** UJ-2's plan starts on Monday 2026-11-02 with its four dependencies
- **THEN** UX design, the prototype, the portal and reporting are critical, architecture has 7 days of slack and billing 17, and the plan finishes on 2026-12-11

#### Scenario: A weekend start
- **WHEN** the plan's start moves to Saturday 2026-11-07
- **THEN** every task starts from Monday 2026-11-09

#### Scenario: A dependency cycle
- **WHEN** two tasks depend on each other
- **THEN** their scheduling fields are `cycle` warnings and the plan's finish reads as `cycle`

#### Scenario: An unknown task
- **WHEN** a dependency names a task that is not one of the plan's work packages
- **THEN** it is a `missing-reference` warning naming the plan and the task

### Requirement: Plain ECMAScript
`compute` SHALL use no DOM, Node-only or Bun-only API, so the same code runs in the browser and in the session process on Bun or Node (AD-1).

#### Scenario: The repository checks
- **WHEN** `compute` is type-checked without DOM, Node or Bun types and the import check runs
- **THEN** both pass, and `compute` imports only `contract`
