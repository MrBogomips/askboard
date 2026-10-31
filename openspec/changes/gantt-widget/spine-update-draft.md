# Spine update draft: Gantt widget

Two blocks, each a clarification that changes no rule; each AD is amended in place, with its ID unchanged, and each block quotes the text it replaces exactly, then gives the replacement.

- Block 1 applies only if the PO accepts the proposal's open question 6 (how the view builds the board's graph and the baseline).
- Block 2 is the `tree-widget` change's to carry: the keyed shape of the generic diff is its seam. It applies only if the PO accepts that change's Block 2 and that block, when applied, does not already describe keyed maps; if it does, this block drops out. Task 8.1 checks which holds.

If the PO decides otherwise, a block does not apply and the spine stays as it is for that point.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: replace each quoted bullet, set `updated:` to the apply date and add a `sources` line for this change in the front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. Task 8.1 checks that each quoted text still matches; nothing here is applied by this change.

## Block 1: AD-13, Rule, The graph, first bullet

Current:

```text
    - `compute` builds a board's whole graph from the board document alone, through `buildGraph(boardDocument)`. It is evaluated in the view on each edit.
```

Replacement:

```text
    - `compute` builds a board's whole graph from the board document alone: `boardGraphSource` maps the board's items onto a graph source, which `buildGraph` reads. The view builds it from the board document with the draft record's values in place of the items the user edited, and builds it again after each edit. The Gantt plan's baseline is the same graph built from the board document as sent.
```

## Block 2: AD-20, Rule, Answers, second bullet, as the `tree-widget` change's Block 2 leaves it

Current, after `tree-widget`'s Block 2:

```text
    - `ask-core` alone computes the answer's `changes`, with one generic diff defined in `contract` (`add`, `remove`, `move`, `set`) that addresses elements by ID, never by array index. `contract` holds both the format and the pure function that computes it from the sent and the edited value, generic over ID-keyed elements in a flat list or a tree, each widget declaring only its shape; `ask-core` is the only unit that calls it at run time. Each operation's target uses AD-13's reference syntax without brackets (`item.child.field`), and `add` and `move` name the parent and the preceding sibling, `null` for the top level or the first place. Widgets never emit diffs.
```

Replacement:

```text
    - `ask-core` alone computes the answer's `changes`, with one generic diff defined in `contract` (`add`, `remove`, `move`, `set`) that addresses elements by ID, never by array index. `contract` holds both the format and the pure function that computes it from the sent and the edited value, generic over ID-keyed elements in a flat list, a tree or a map from element ID to fields, each widget declaring only its shape; `ask-core` is the only unit that calls it at run time. Each operation's target uses AD-13's reference syntax without brackets (`item.child.field`), and `add` and `move` name the parent and the preceding sibling, `null` for the top level or the first place. On a map the diff gives only `set`s, one per changed field, `null` for a field or an entry that is gone. Widgets never emit diffs.
```
