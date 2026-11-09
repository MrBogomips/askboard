# Spine update draft: document-review

**Status: applied on 2026-11-08 (task 0.1).** It rests on the proposal's open questions 5 and 12; an answer other than the default changes its block first (`/opsx:update`). Each block quotes the current phrase exactly as it stands on `origin/main` e87841d5, then gives the replacement. AD-1, AD-7 and AD-9 are amended in place; no AD is added or renumbered. The PRD needs no change. `layouts`' draft (AD-7's Questions and IDs, AD-9's first Components bullet) and `form-widget`'s (AD-7's Widget types, the Stack) replace other phrases; none of theirs is quoted here.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: check that each current phrase stands once (`git grep -c -F`), replace only the phrase (the rest of its line stays), set `updated:` to the apply date, and append to `sources:` the line `'OpenSpec change document-review, proposal.md, open questions 5 and 12: suggested edits in the annotation body, the Markdown renderer shared with the widgets (accepted under the PO''s unattended handoff, <date>)'`. Then run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these phrases meanwhile, keep its text, apply this block's meaning to it, and say so in the task's note.

## Block 1: AD-1, the widgets import the Markdown renderer (open question 12)

AD-1, Rule, Imports (code), fourth bullet. Current phrase:

```text
`widgets` imports only `contract`, `compute` and `view`'s `CatalogRenderer` port.
```

Replacement:

```text
`widgets` imports only `contract`, `compute`, `view`'s `CatalogRenderer` port and `view`'s Markdown renderer, each provided at run time by one chunk (AD-9).
```

## Block 2: AD-7, the annotation body holds a suggested edit (open question 5)

AD-7, Rule, Content, Annotations. Current phrase:

```text
Its fields are fixed in `contract` before the first annotating widget is built: `{id, target: {selector}, body: {text}}`, the item ID being the key of the answer's `results`
```

Replacement:

```text
Its fields are fixed in `contract` before the first annotating widget is built: `{id, target: {selector}, body: {text?, replacement?}}`, a body holding a comment, a suggested edit that replaces the target's text (an empty one deleting it), or both, the item ID being the key of the answer's `results`
```

## Block 3: AD-9, a widget's imports from `view` (open question 12)

AD-9, Rule, Build and assembly, first bullet. Current phrase:

```text
a widget imports from `view` only the `CatalogRenderer` port.
```

Replacement:

```text
a widget imports from `view` only the `CatalogRenderer` port and the Markdown renderer, which a library chunk provides to every chunk that renders Markdown.
```

## Block 4: Structural Seed, the view package

Structural Seed, the source tree. Current phrase:

```text
view/                # board page, assemble, view shell, CatalogRenderer port, atoms, layouts
```

Replacement:

```text
view/                # board page, assemble, view shell, CatalogRenderer port, Markdown renderer, atoms, layouts
```
