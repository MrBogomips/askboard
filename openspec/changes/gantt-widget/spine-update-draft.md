# Spine update draft: Gantt widget

One block, a clarification that changes no rule: AD-13 is amended in place, with its ID unchanged, and the block quotes the text it replaces exactly, then gives the replacement. It applies only if the PO accepts the proposal's open question 6 (how the view builds the board's graph and the baseline); if the PO decides otherwise, the spine stays as it is.

The Gantt adds nothing to AD-20: the keyed shape of the generic diff is the `tree-widget` change's seam, and that change's AD-20 block carries its wording.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: replace the quoted bullet, set `updated:` to the apply date and add a `sources` line for this change in the front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. Task 8.1 checks that the quoted text still matches; nothing here is applied by this change.

## Block 1: AD-13, Rule, The graph, first bullet

Current:

```text
    - `compute` builds a board's whole graph from the board document alone, through `buildGraph(boardDocument)`. It is evaluated in the view on each edit.
```

Replacement:

```text
    - `compute` builds a board's whole graph from the board document alone: `boardGraphSource` maps the board's items onto a graph source, which `buildGraph` reads. The view builds it from the board document with the draft record's values in place of the items the user edited, and builds it again after each edit. The Gantt plan's baseline is the same graph built from the board document as sent.
```
