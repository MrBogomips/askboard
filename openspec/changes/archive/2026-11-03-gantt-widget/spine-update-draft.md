# Spine update draft: Gantt widget

One block, a clarification that changes no rule: AD-13 is amended in place, with its ID unchanged, and the block quotes the text it replaces exactly, then gives the replacement. The PO accepted the proposal's open question 6 (how the view builds the board's graph and the baseline) on 2026-10-31; task 8.1 applies it. On 2026-11-01, before the apply, the replacement was reworded to state the recalculation task 6.8 added (design decision 7): it had said the view builds the graph again after each edit. The rule and the AD ID are unchanged (proposal, open question 6).

The Gantt adds nothing to AD-20: the keyed shape of the generic diff is the `tree-widget` change's seam, and that change's AD-20 block carries its wording.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: replace the quoted bullet, set `updated:` to the apply date and add a `sources` line for this change in the front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. Task 8.1 checks that the quoted text still matches, then applies it.

## Block 1: AD-13, Rule, The graph, first bullet

Current:

```text
    - `compute` builds a board's whole graph from the board document alone, through `buildGraph(boardDocument)`. It is evaluated in the view on each edit.
```

Replacement:

```text
    - `compute` builds a board's whole graph from the board document alone: `boardGraphSource` maps the board's items onto a graph source, which `buildGraph` reads. The view builds it from the board document with the draft record's values in place of the items the user edited, and after each edit builds it again or, where the edit changes only input values the graph already holds, recalculates it in place. The Gantt plan's baseline is the same graph built from the board document as sent.
```
