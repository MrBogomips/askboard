# compute Specification

## Purpose
The compute unit builds a board's whole graph of typed values and formulas, checks every formula before any engine runs, evaluates it with AskBoard's own restricted evaluator, and computes PERT estimates and CPM schedules, so that derived values never need the agent (AD-13).

## Requirements

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
A Gantt plan SHALL schedule its WBS's leaves in working days, giving each task its duration, earliest and latest start and finish, slack, a critical flag at zero slack, and start and finish dates from the first working day on or after the plan's start. Each plan task SHALL also give `effortDays`, the duration its estimates alone give, which a requested duration does not change.

#### Scenario: Durations and times
- **WHEN** a plan is scheduled
- **THEN** a task's duration is its requested duration, else its expected effort rounded up, at least 1; its earliest start is the latest earliest finish of its predecessors; its latest finish is the earliest latest start of its successors, or the plan's finish

#### Scenario: Effort days
- **WHEN** a task has estimates and a requested duration
- **THEN** its `effortDays` is its expected effort rounded up, at least 1, so a view can tell a requested duration from the one that follows the WBS

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

#### Scenario: A requested duration
- **WHEN** the portal's expected effort rounds up to 18 days and its entry requests 21
- **THEN** the portal lasts 21 working days, reporting starts three working days later than without the request, and the portal's expected effort in the WBS is as before

#### Scenario: The estimates' duration beside a request
- **WHEN** the portal's expected effort rounds up to 18 days and its entry requests 21
- **THEN** the portal's duration is 21 and its `effortDays` is 18, and with no request both are 18

#### Scenario: A request equal to the estimate
- **WHEN** an entry requests the duration its expected effort rounds up to
- **THEN** the schedule equals the one without the request

### Requirement: Plain ECMAScript
`compute` SHALL use no DOM, Node-only or Bun-only API, so the same code runs in the browser and in the session process on Bun or Node (AD-1).

#### Scenario: The repository checks
- **WHEN** `compute` is type-checked without DOM, Node or Bun types and the import check runs
- **THEN** both pass, and `compute` imports only `contract`

### Requirement: A Gantt's own tasks are scheduled
A Gantt with its own tasks SHALL be scheduled as a Gantt plan is, with each task's `duration` taken as given instead of from a WBS: the same forward and backward passes, slack, critical flag and working-day dates (FR-12, AD-13 "In-house computations").

#### Scenario: The UJ-2 durations, listed
- **WHEN** a Gantt lists UJ-2's six work packages with the durations the UJ-2 plan computes for them, its four dependencies and the start 2026-11-02
- **THEN** every task's start, finish and critical flag equal the UJ-2 plan's, and it finishes on 2026-12-11

### Requirement: Requested starts
A task with a requested start SHALL start on the first working day on or after it, or later if its predecessors finish later; a request before the plan's first working day SHALL have no effect. Every task SHALL also have its earliest start, the one its predecessors allow, as a number of working days and as a date.

#### Scenario: A task moved later
- **WHEN** reporting, whose earliest start is 2026-12-04, is requested to start on 2026-12-09
- **THEN** reporting starts on 2026-12-09, the plan finishes three working days later, and reporting's earliest start is still 2026-12-04

#### Scenario: A request its predecessors overtake
- **WHEN** a task requested to start on 2026-11-10 gets a predecessor that finishes on 2026-11-12
- **THEN** it starts on 2026-11-13

#### Scenario: A request on a Saturday
- **WHEN** a task is requested to start on Saturday 2026-11-14 and its predecessors allow it
- **THEN** it starts on Monday 2026-11-16

### Requirement: The board's graph source
`compute` SHALL map a board's items onto its graph source: a Gantt with its own tasks becomes a Gantt source, a Gantt plan a plan source over the Tree it names, its entries' starts, durations and predecessors taken by task ID, and that Tree a WBS-with-PERT source whose leaves' `optimistic`, `mostLikely` and `pessimistic` fields are its estimates. A plan entry that names no leaf SHALL add nothing; items that hold nothing to compute SHALL add nothing (AD-13).

#### Scenario: The UJ-2 board
- **WHEN** the UJ-2 question's Tree `wbs` and plan `schedule` are mapped and the graph is built and evaluated
- **THEN** every value equals the one the approved example's `wbs-pert` and `gantt-plan` data give, and there is no warning

#### Scenario: The approved answer's edits
- **WHEN** the same board is mapped with the Tree and the plan as the approved answer left them
- **THEN** the plan finishes on 2026-12-02, and its critical tasks are UX design, the prototype, the portal and reporting

#### Scenario: A plain question
- **WHEN** a board's only item is a plain Choice question
- **THEN** the graph source holds no item

#### Scenario: A requested duration is mapped
- **WHEN** a plan's entry holds `duration` 21 for a leaf
- **THEN** the plan source gives that task 21 days and the WBS-with-PERT source is unchanged

#### Scenario: A work breakdown with no plan
- **WHEN** a board's only item is the expanded UJ-2 Tree `wbs__tree`, with `pert`
- **THEN** the graph gives each node and the item their expected effort and spread, the item's 40.67 and 3.21 among them, with no warning

#### Scenario: A plain Tree
- **WHEN** a board's only item is a Tree without `pert` whose columns declare the three estimates
- **THEN** the graph source holds no item

### Requirement: Working-day calendar helpers
`compute` SHALL give the view its working-day calendar: whether a date is a working day, the first working day on or after a date, a date a number of working days after another, and the working days between two dates, on `full-date` strings, with AD-7's default calendar and no `Date`, time zone or locale (AD-13 Determinism).

#### Scenario: Across a weekend
- **WHEN** the working day 1 after Friday 2026-11-13 is asked for
- **THEN** the answer is Monday 2026-11-16

#### Scenario: Determinism
- **WHEN** the Gantt fixtures run under `TZ=Pacific/Kiritimati` and `TZ=America/Adak` with the locales `en-US` and `de-DE`
- **THEN** every result is the same

### Requirement: Scheduling formulas stay inside the limits
Every scheduling formula `compute` writes for a Gantt within the contract's limits SHALL pass the formula check: no formula SHALL exceed the formula length limit or use a name outside the whitelist.

#### Scenario: The longest formulas
- **WHEN** a Gantt holds a task with 50 predecessors and a task with 50 dependent tasks, all with 64-character IDs, in an item with a 64-character ID
- **THEN** every formula of the graph passes the formula check

### Requirement: Graph sources by widget type
`compute` SHALL map a board item of a type other than Tree and Gantt through a table of graph sources by widget type, which a computing widget extends; an item whose type has no source SHALL add nothing. Every registered type that declares derived values SHALL be a Tree, a Gantt or a type of that table (AD-13).

#### Scenario: A source for a test-only type
- **WHEN** a board holds a probe item and the table passed to the mapping holds a source for `probe`
- **THEN** the probe's graph items are in the graph source, in board order with the Tree and Gantt items

#### Scenario: A type with no source
- **WHEN** a board holds an item of a type the table does not hold
- **THEN** the graph source is the same as without that item

#### Scenario: Computing types have sources
- **WHEN** the registry's types that declare derived values are listed
- **THEN** each is `tree`, `gantt` or a type of the table

### Requirement: Row references
In a formula on a child's field, `[@field]` SHALL read that field of the same child, as Excel's this-row reference; in any other formula it SHALL read as `missing-reference`. A `[@…]` whose name is no field name SHALL read as `syntax`. A problem's detail SHALL quote the reference as written (AD-13).

#### Scenario: A row's amount
- **WHEN** row `pm` of item `costs` holds `days` 18 and `rate` "1040.00", and its `amount` is `[@days] * [@rate]`
- **THEN** `costs.pm.amount` reads 18720

#### Scenario: Outside a row
- **WHEN** an item's own field holds the formula `[@days] * 2`
- **THEN** the node reads as `missing-reference`, the detail quoting `[@days]`

#### Scenario: A cell name
- **WHEN** a column formula reads `[@A1]` or `[@]`
- **THEN** each row's node reads as `syntax`

### Requirement: Column formulas
A `fields` item MAY declare column formulas: each top-level child SHALL get a node `item.child.field` holding the column's formula, after its own fields. A child that holds a column's field itself SHALL make the source malformed. A formula text SHALL be parsed once per build, however many nodes hold it (AD-13).

#### Scenario: Every row gets the column
- **WHEN** an item with rows `pm` and `dev` declares the column formula `amount` as `[@days] * [@rate]`
- **THEN** the graph holds `costs.pm.amount` and `costs.dev.amount`, each reading its own row

#### Scenario: A row holding the column's field
- **WHEN** row `pm` also holds its own `amount`
- **THEN** the graph is refused with a source error naming the item, the row and `amount`

### Requirement: Column formulas read single fields
A column formula SHALL read single nodes only: one that holds a wildcard or a range SHALL read as `over-limit` at every row, whatever else it holds (AD-13).

#### Scenario: A share of the total
- **WHEN** a column formula reads `[@amount] / [costs.amount]`, `[costs.amount]` being a total
- **THEN** each row reads its share

#### Scenario: A wildcard in a column formula
- **WHEN** a column formula reads `[@amount] / SUM([costs.*.amount])`
- **THEN** every row's node reads as `over-limit`

### Requirement: One warning per column
The problems found at a column formula's nodes that share their kind and detail SHALL be one warning, addressed `item.*.field`; every row's node SHALL still read as the error (AD-6, AD-13, NFR-1).

#### Scenario: A formula that does not parse, over 200 rows
- **WHEN** a column formula of 200 rows is `[@days] *`
- **THEN** the build gives one `syntax` warning addressed `costs.*.amount`, and each of the 200 nodes reads as `syntax`

#### Scenario: A misspelt field
- **WHEN** a column formula is `[@days] * [@rte]`
- **THEN** the build gives one `missing-reference` warning addressed `costs.*.amount` whose detail quotes `[@rte]`

### Requirement: The Table's graph source
A `table` item SHALL map to a `fields` item: every input column of every row an input node of the column's type, `null` when empty, a money node in the column's currency; each formula column a column formula, money in its currency; each total column a node `item.field` summing that field over the rows (AD-13, FR-12).

#### Scenario: Totals of the roles
- **WHEN** the Table of roles (`pm` 18 days at "1040.00", `dev` 72 days at "720.00") is built and evaluated
- **THEN** `costs.amount` reads 70560 in USD and `costs.days` reads 90

#### Scenario: An edited rate
- **WHEN** `costs.pm.rate` is set to "960.00" and the graph recalculates
- **THEN** `costs.pm.amount` reads 17280 and `costs.amount` 69120, and `dev`'s nodes are not evaluated

#### Scenario: An empty cell
- **WHEN** `dev`'s `days` is empty
- **THEN** `costs.dev.amount` reads 0, as Excel reads an empty reference, and `costs.days` sums `pm`'s alone

#### Scenario: Another currency
- **WHEN** a money column in "USD" has the formula `[@days] * [@rateEur]`, `rateEur` being a money column in "EUR"
- **THEN** each row's node reads as `mixed-currencies`, and one warning names the column

#### Scenario: Row IDs that are object names
- **WHEN** a Table's rows are `__proto__` and `constructor` and its fields `constructor` and `toString`
- **THEN** each row's nodes and the totals read as for any other names

#### Scenario: A Table with no rows
- **WHEN** a Table with total columns has no rows
- **THEN** each total reads 0, as an empty sum does in Excel, and no warning is given

### Requirement: A Table at its bounds
The worst Table the bounds admit (200 rows, 10 columns, column formulas of 500 characters each reading its row's other fields) SHALL be built and evaluated, and recalculated after one cell's change, within the gates of design decision 13 on Bun and on Node 24 (AD-13, NFR-12).

#### Scenario: The worst form, cold
- **WHEN** the worst form is built and evaluated in a fresh process, then one input cell changes and the graph recalculates
- **THEN** each step's time is within its gate, and the figures are recorded
