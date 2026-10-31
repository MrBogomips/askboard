# UX update draft: molecules

Two sentences of `docs/ux-askboard-2026-10-27/EXPERIENCE.md`, worded as the model contract review resolved F20 (an added package takes the split package's predecessors) and as the proposal's open question 11 proposes. Each block quotes the text it replaces word for word, then gives the replacement. Nothing here is applied by this change: the blocks apply only if the PO accepts open question 11; otherwise EXPERIENCE stays as it is and the rule follows its current text, which gives a split package no predecessors, unlike the approved UJ-2 answer.

How to apply: replace each quoted text, set EXPERIENCE's `updated:` to the apply date, then run `openspec validate --all --strict --no-interactive`. Checked on 2026-10-31 against `main` at 92ca203; task 9.1 checks again after group 0's rebase.

## Block 1: Component Patterns, Molecules, WBS with PERT, behavioural rules

Only this sentence of the table row changes; the row's other sentences and its Source column stay.

Current:

```text
A work package the user adds, as in a split, gets a Gantt task whose duration is its PERT expected effort, rounded up to whole working days, and whose predecessors are its parent's.
```

Replacement:

```text
A work package the user adds gets a Gantt task whose duration is its PERT expected effort, rounded up to whole working days, and whose predecessors are those of the package it was added after, as in a split, or of its parent when it is added as a child.
```

## Block 2: Key Flows, UJ-2, step 2, first bullet

Current:

```text
   - Each work package Sara adds gets a Gantt task, with its PERT expected effort as its duration and its parent's predecessors (WBS with PERT; F-09).
```

Replacement:

```text
   - Each work package Sara adds gets a Gantt task, with its PERT expected effort as its duration and the predecessors of the package she split (WBS with PERT; F-09, F20).
```
