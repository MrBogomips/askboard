# Spine update draft: latex-kanban-timeline

**Status: blocks 1 to 3 applied on 2026-11-07 (task 0.1), no other change had touched these lines. Block 4 added on 2026-11-07 (4.7 re-review X-3, proposal open question 14) and applied on 2026-11-07 (task 3.9), no other change had touched its row.** The proposal's open questions 2 and 8 were answered on 2026-11-07 with their defaults, under the PO's unattended handoff; the PO may revisit. Blocks 1 and 2 are `diagram-render`'s spine blocks 3 and 4 (its `spine-update-draft.md` at 9281d923), with a LaTeX expression as the example, since this change lands the whole-field shape first. Each block quotes the current text exactly as it stands on this change's base, then gives the replacement. AD-20 is amended in place; no AD is added or renumbered. The PRD needs no change.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`, AD-20, Rule, Answers, second bullet.

How to apply: check that each current phrase stands once (`git grep -c -F`), replace only the phrase (the rest of its line stays), set `updated:` to the apply date, and append to `sources:` the line `'OpenSpec change latex-kanban-timeline, proposal.md, open questions 2 and 8: a whole field changed by one set, changes checked against their type (accepted under the PO''s unattended handoff, 2026-11-07)'`. Then run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into this bullet meanwhile, keep its text, apply this block's addition to it, and say so in task 0.1's note.

## Block 1: the shapes the diff covers (open question 2)

Current phrase:

```text
generic over ID-keyed elements in a flat list, a tree or an object keyed by element ID, each widget declaring only its shape;
```

Replacement:

```text
generic over ID-keyed elements in a flat list, a tree or an object keyed by element ID, or over named fields of the item itself, each widget declaring only its shape;
```

## Block 2: a whole field changes by one set (open question 2)

Current phrase:

```text
Elements in an object keyed by element ID change only by `set`s, one per changed field, with `null` for a field or an element that is gone. Widgets never emit diffs.
```

Replacement:

```text
Elements in an object keyed by element ID change only by `set`s, one per changed field, with `null` for a field or an element that is gone. A named field of the item itself, such as a LaTeX item's expression, changes only by one `set` of the whole field, targeted `item.field`, and the item's other fields may not change. Widgets never emit diffs.
```

## Block 3: changes checked against their type (open question 8)

Current phrase:

```text
`ask-core` is the only unit that calls it at run time.
```

Replacement:

```text
`ask-core` is the only unit that calls it at run time, and it refuses an answer whose changes fall outside the changes schema the item's type declares (AD-7).
```

## Block 4: lightningcss in the Stack (open question 14)

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`, Stack, the table. Applied by task 3.9, only if it adopts lightningcss (if it falls back to the hand scanner, mark this block dropped with the date).

How to apply: check that the current row stands once (`git grep -c -F`), replace it with the replacement (the row, then the new row under it), set `updated:` to the apply date, and append to `sources:` the line `'OpenSpec change latex-kanban-timeline, proposal.md, open question 14: lightningcss for the view build''s URL check (accepted under the PO''s unattended handoff, 2026-11-07)'`. Then run `openspec validate --all --strict --no-interactive`. If another change has added rows under it meanwhile, keep them and put this row after them.

Current row:

```text
| `tailwindcss`, `@tailwindcss/cli` (build-time styles) | 4.3.3 |
```

Replacement:

```text
| `tailwindcss`, `@tailwindcss/cli` (build-time styles) | 4.3.3 |
| `lightningcss` (build-time: the view build's check of URLs in styles; Tailwind's own CSS engine; MPL-2.0, unmodified) | 1.32.0 |
```
