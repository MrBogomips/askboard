# Spine update draft: layouts

**Status: draft, applied by task 0.1.** It rests on the proposal's open questions 1 to 3 and 6, answered on 2026-11-07 with their defaults under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly as it stands on the base c3cb6241 (`atoms` applied its own blocks there; none of these phrases), then gives the replacement. AD-7 and AD-9 are amended in place; no AD is added or renumbered. The PRD needs no change: FR-13 already lets the agent arrange items with layouts.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: check that each current phrase stands once (`grep -c -F`), replace only the phrase (the rest of its line stays), set `updated:` to the apply date, and append to `sources:` the line `'OpenSpec change layouts, proposal.md, open questions 1 to 3 and 6: Stack, Row, Group and Tabs as registered types holding atoms, widgets and layouts four deep, item IDs unique at every depth (accepted under the PO''s unattended handoff, 2026-11-07)'`. Then run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these lines meanwhile, keep its text, apply this block's addition to it, and say so in task 0.1's note.

## Block 1: AD-7, questions and their layouts (open questions 1 to 3)

AD-7, Rule, Content, Questions. Current phrase:

```text
The agent sends no layout: an excerpt goes beside its question because of its type (FR-13).
```

Replacement:

```text
Its atoms and widgets may sit in layouts, the registered types Stack, Row, Group and Tabs, whose props hold items, at most four layouts deep; a Row's relative widths are weights, never lengths. Excerpts, references, images and molecule references stay in the question's own `items`, and the agent sends no layout for its context: an excerpt goes beside its question because of its type (FR-13).
```

## Block 2: AD-7, IDs at every depth (open question 6)

AD-7, Rule, IDs, third bullet. Current phrase:

```text
Item IDs are unique within their ask, child IDs within their item.
```

Replacement:

```text
Item IDs are unique within their ask, at every depth of a question's layouts, and child IDs, a Tabs' tab IDs included, within their item.
```

## Block 3: AD-9, layouts render their items through the shell

AD-9, Rule, Components, first bullet. Current phrase:

```text
Atoms, layouts and widgets are catalog components registered through one `CatalogRenderer` port.
```

Replacement:

```text
Atoms, layouts and widgets are catalog components registered through one `CatalogRenderer` port; a layout places the items it holds, which the shell renders through the port, each in its own frame and error boundary.
```
