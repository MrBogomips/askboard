# Spec Delta

## Purpose

The contract is AskBoard's one shared language: the versioned JSON Schema sets, ID rules and constants for every message that crosses a unit boundary at run time, and the formula grammar, whitelist and limits every unit reads (AD-7, AD-13).

## ADDED Requirements

### Requirement: Formula whitelist
The contract SHALL hold the formula whitelist decided by the formula spike: the operators `+ - * /`, unary minus, `^` and `= <> < <= > >=`, and the functions `SUM`, `MIN`, `MAX`, `IF`, `ROUND`, `AND`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP` and `WORKDAY`, each with its number of arguments and Excel's semantics, and no other entry.

#### Scenario: The list matches AD-13
- **WHEN** the contract's whitelist is read
- **THEN** it holds exactly AD-13's operators and functions, each function with its least and greatest number of arguments

#### Scenario: Dropped functions stay out
- **WHEN** the whitelist is searched for `OR`, `NOT`, `ABS`, `CEILING`, `AVERAGE`, `COUNT` or `NETWORKDAYS`
- **THEN** none is found

### Requirement: Refused Excel operators
The contract SHALL name the Excel operators that formulas may not use, `&` and `%`, so that a formula using one is refused as outside the whitelist rather than as a grammar error.

#### Scenario: The refused operators
- **WHEN** the contract's refused operators are read
- **THEN** they are `&` and `%`, and neither is in the whitelist

### Requirement: Formula grammar
The contract SHALL hold the reference grammar's terminals: IDs as `[A-Za-z0-9_-]{1,64}`, field names as a letter then up to 63 letters or digits, cells as upper-case A1 addresses from `A1` to `XFD1048576`, and the operator precedence, from comparison (lowest) through `+ -` and `* /` to `^` (highest), every binary operator left-associative and unary minus above `^`.

#### Scenario: A field name that looks like a cell
- **WHEN** `a1`, `Q1` or `xfd1048576` is checked as a field name
- **THEN** it is refused, because it matches the cell pattern in some case

#### Scenario: Cells at the edge of the sheet
- **WHEN** `XFD1048576` and `XFE1` are checked as cells
- **THEN** the first is a cell and the second is not

### Requirement: Formula limits
The contract SHALL hold the formula limits that every unit checks before any engine runs: 8,192 characters per formula, a nesting depth of 64, and 65,536 cells per range.

#### Scenario: The limits
- **WHEN** the contract's formula limits are read
- **THEN** they are 8,192 characters, a depth of 64 and 65,536 cells

### Requirement: Formula error kinds
The contract SHALL name the kinds of formula error a node can read as, the same for the board and for the agent's warnings: `syntax`, `over-limit`, `not-whitelisted`, `missing-reference`, `cycle`, `mixed-currencies`, `value` and `division-by-zero`.

#### Scenario: The kinds
- **WHEN** the contract's formula error kinds are read
- **THEN** they are those eight, in kebab-case
