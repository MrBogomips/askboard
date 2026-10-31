# Spine update draft: Gantt widget

Two blocks, each a clarification that changes no rule. Block 1 applies only if the PO accepts the proposal's open question 6 (how the view builds the board's graph and the baseline), Block 2 only if the PO accepts open question 13 (maps keyed by element ID in the generic diff) and the `tree-widget` change's Block 2 has been applied. If the PO decides otherwise, that block does not apply and the spine stays as it is for that point. Each block quotes the text it replaces exactly, then gives the replacement; both ADs are amended in place, with their IDs unchanged.

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
    - `ask-core` alone computes the answer's `changes`, with one generic diff defined in `contract` (`add`, `remove`, `move`, `set`) that addresses elements by ID, never by array index. `contract` holds both the format and the pure function that computes it from the sent and the edited value, generic over ID-keyed elements in a flat list or a tree and over maps keyed by element ID, each widget declaring only its shape; a changed key of such a map is a `set` of that element's field, a removed key a `set` to `null`. `ask-core` is the only unit that calls it at run time. Each operation's target uses AD-13's reference syntax without brackets (`item.child.field`), and `add` and `move` name the parent and the preceding sibling, `null` for the top level or the first place. Widgets never emit diffs.
```

If the PO accepts open question 13 but not `tree-widget`'s Block 2, the sentence on keyed maps has no place to go: the current spine names no diff function. This block then waits, and the PO's decision on `tree-widget`'s open question 4 decides where the diff's description lives.
