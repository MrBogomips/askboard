# Spine update draft: compute engine

One block, for the proposal's open question 2 (where PERT and CPM are written). It applies only if the PO accepts the choice made there: `compute` writes the expressions of the PERT and CPM fields, only with whitelisted functions. If the PO decides instead that they move to `contract` with the widget declarations, nothing here applies and the spine stays as it is. The block quotes the current text exactly, then gives the replacement; AD-13 is amended in place.

**Applied** on 2026-10-31, after the PO accepted open question 2 as proposed.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: replace the quoted bullet, set `updated:` to the apply date and add a `sources` line for this change in the front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`.

## Block 1: AD-13, Rule, Declarations in `contract`, third bullet

Current:

```text
    - each built-in derived field, as an expression over whitelisted functions. The whitelist is the operators `+ - * /`, unary minus, `^` and `= <> < <= > >=`, and the functions `SUM`, `MIN`, `MAX`, `IF`, `ROUND`, `AND`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP` and `WORKDAY`, with Excel's semantics. `contract` holds the list, and `compute` holds fixtures for each entry. PERT, roll-ups, CPM scheduling and scores are written with them.
```

Replacement:

```text
    - each built-in derived field, as an expression over whitelisted functions. The whitelist is the operators `+ - * /`, unary minus, `^` and `= <> < <= > >=`, and the functions `SUM`, `MIN`, `MAX`, `IF`, `ROUND`, `AND`, `SQRT`, `SUMSQ`, `SUMPRODUCT`, `ROUNDUP` and `WORKDAY`, with Excel's semantics. `contract` holds the list, and `compute` holds fixtures for each entry. PERT, roll-ups, CPM scheduling and scores are written with them; `compute` writes the expressions of PERT and CPM scheduling, whose number of terms depends on the tree and the dependencies, and checks them against the whitelist like any other formula.
```
