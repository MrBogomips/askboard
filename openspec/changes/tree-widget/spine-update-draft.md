# Spine update draft: Tree widget

Two blocks, each a clarification that changes no rule. Block 1 applies only if the PO accepts the proposal's open question 22 (widget chunks in the view's manifest), Block 2 only if the PO accepts open question 4 (where the diff function lives); its clause on `null` follows open question 18 and is dropped if that choice is reversed. If the PO decides otherwise, that block does not apply and the spine stays as it is for that point. Each block quotes the current text exactly, then gives the replacement; both ADs are amended in place, with their IDs unchanged.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: replace each quoted bullet, set `updated:` to the apply date and add a `sources` line for this change in the front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. Task 7.1 checks that each quoted text still matches the spine; nothing here is applied by this change.

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
    - `ask-core` alone computes the answer's `changes`, with one generic diff defined in `contract` (`add`, `remove`, `move`, `set`) that addresses elements by ID, never by array index. Each operation's target uses AD-13's reference syntax without brackets (`item.child.field`), and `add` and `move` name the parent and the preceding sibling. Widgets never emit diffs.
```

Replacement:

```text
    - `ask-core` alone computes the answer's `changes`, with one generic diff defined in `contract` (`add`, `remove`, `move`, `set`) that addresses elements by ID, never by array index. `contract` holds both the format and the pure function that computes it from the sent and the edited value, generic over ID-keyed elements in a flat list or a tree, each widget declaring only its shape; `ask-core` is the only unit that calls it at run time. Each operation's target uses AD-13's reference syntax without brackets (`item.child.field`), and `add` and `move` name the parent and the preceding sibling, `null` for the top level or the first place. Widgets never emit diffs.
```
