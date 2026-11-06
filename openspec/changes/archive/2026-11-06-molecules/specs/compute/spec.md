# Spec Delta

## Purpose

The compute unit builds a board's whole graph of typed values and formulas, checks every formula before any engine runs, evaluates it with AskBoard's own restricted evaluator, and computes PERT estimates and CPM schedules, so that derived values never need the agent (AD-13).

## MODIFIED Requirements

### Requirement: The board's graph source
`compute` SHALL map a board's items onto its graph source: a Gantt with its own tasks becomes a Gantt source, a Gantt plan a plan source over the Tree it names, its entries' starts and predecessors taken by task ID, and that Tree, like every Tree with `pert`, a WBS-with-PERT source whose leaves' `optimistic`, `mostLikely` and `pessimistic` fields are its estimates. A plan entry that names no leaf SHALL add nothing; items that hold nothing to compute SHALL add nothing (AD-13).

#### Scenario: The UJ-2 board
- **WHEN** the UJ-2 question's Tree `wbs` and plan `schedule` are mapped and the graph is built and evaluated
- **THEN** every value equals the one the approved example's `wbs-pert` and `gantt-plan` data give, and there is no warning

#### Scenario: The approved answer's edits
- **WHEN** the same board is mapped with the Tree and the plan as the approved answer left them
- **THEN** the plan finishes on 2026-12-02, and its critical tasks are UX design, the prototype, the portal and reporting

#### Scenario: A plain question
- **WHEN** a board's only item is a plain Choice question
- **THEN** the graph source holds no item

#### Scenario: A work breakdown with no plan
- **WHEN** a board's only item is the expanded UJ-2 Tree `wbs__tree`, with `pert`
- **THEN** the graph gives each node and the item their expected effort and spread, the item's 40.67 and 3.21 among them, with no warning

#### Scenario: A plain Tree
- **WHEN** a board's only item is a Tree without `pert` whose columns declare the three estimates
- **THEN** the graph source holds no item
