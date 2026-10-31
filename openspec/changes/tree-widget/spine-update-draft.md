# Spine update draft: Tree widget

Two blocks, each a clarification that changes no rule. Block 1 applies only if the PO accepts the proposal's open question 22 (widget chunks in the view's manifest), Block 2 only if the PO accepts open question 4 (where the diff function lives, and its keyed shapes). If the PO decides otherwise, that block does not apply and the spine stays as it is for that point. Each block quotes the current text exactly, then gives the replacement; both ADs are amended in place, with their IDs unchanged. As agreed with the integration session, the Gantt widget's own Block 2 becomes a pointer to this Block 2 for the keyed shapes.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: replace each quoted bullet, set `updated:` to the apply date and add a `sources` line for this change in the front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. Task 7.1 checks that each quoted text still matches the spine; nothing here is applied by this change.

Checked on 2026-10-31 against the spine on this branch, after E1's amendments of AD-1, AD-8 and AD-20 merged in d4a31c4 and 6b84e1c: Block 1's text is unchanged in the spine; Block 2 quotes AD-20's bullet as E1 amended it (ee10f3e), whose omitted `parent` and `after` replace the `null` clause this draft carried before.

## Block 1: AD-9, Rule, Build and assembly, first bullet

Current:

```text
    - At build time, `view` publishes a manifest: a shell chunk, library chunks for code that several components use, and one chunk per catalog component, each with its SHA-256, its styles, the licence notices of the code it contains and the chunks it needs. Nothing is bundled at run time. Every chunk is a classic script, so a chunk that holds `import.meta` fails the build.
```

Replacement:

```text
    - At build time, `view` publishes a manifest: a shell chunk, library chunks for code that several components use, and one chunk per catalog component, each with its SHA-256, its styles, the licence notices of the code it contains and the chunks it needs. The widgets in `packages/widgets` are catalog components like the atoms in `view`: the view build bundles each as a component chunk of the same manifest, and a widget imports from `view` only the `CatalogRenderer` port. Nothing is bundled at run time. Every chunk is a classic script, so a chunk that holds `import.meta` fails the build.
```

## Block 2: AD-20, Rule, Answers, second bullet

Current:

```text
    - `ask-core` alone computes the answer's `changes`, with one generic diff defined in `contract` (`add`, `remove`, `move`, `set`) that addresses elements by ID, never by array index. Each operation's target uses AD-13's reference syntax without brackets (`item.child.field`), and `add` and `move` name the parent and the preceding sibling, each omitted when there is none: the top level, the first position. Widgets never emit diffs.
```

Replacement:

```text
    - `ask-core` alone computes the answer's `changes`, with one generic diff defined in `contract` (`add`, `remove`, `move`, `set`) that addresses elements by ID, never by array index. `contract` holds both the format and the pure function that computes it from the sent and the edited value, generic over ID-keyed elements in a flat list, a tree or an object keyed by element ID, each widget declaring only its shape; `ask-core` is the only unit that calls it at run time. Each operation's target uses AD-13's reference syntax without brackets (`item.child.field`), and `add` and `move` name the parent and the preceding sibling, each omitted when there is none: the top level, the first position. Elements in an object keyed by element ID change only by `set`s, one per changed field, with `null` for a field or an element that is gone. Widgets never emit diffs.
```
