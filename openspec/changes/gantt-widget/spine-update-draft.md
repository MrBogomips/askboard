# Spine update draft: Gantt widget

One block, a clarification that changes no rule. It applies only if the PO accepts the proposal's open question 6 (how the view builds the board's graph and the baseline). If the PO decides otherwise, it does not apply and the spine stays as it is. The block quotes the current text exactly, then gives the replacement; AD-13 is amended in place, with its ID unchanged.

The Gantt adds nothing to AD-20: it uses the generic element diff as the `tree-widget` change's Block 2 describes it, with a flat list of tasks.

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
