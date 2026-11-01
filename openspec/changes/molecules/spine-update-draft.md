# Spine update draft: molecules

**Status: applied on 2026-11-01.** The PO accepted every open question of the proposal on 2026-11-01, among them 3 to 7, 11 and 14, which these blocks name, and the four blocks below were applied in place, their IDs unchanged (task 0.3). Three blocks for `ARCHITECTURE-SPINE.md` and one alignment of `SOLUTION-DESIGN.md`. Each amends a decision in place, its ID unchanged, and quotes the text it replaces word for word, then gives the replacement. The apply's tasks apply nothing here: each block applies only if the PO accepts the proposal's open question it names, and if the PO decides otherwise, the spine stays as it is.

Files: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (Blocks 1 to 3) and `docs/architecture-askboard-2026-10-27/SOLUTION-DESIGN.md` (Block 4).

How to apply: replace each quoted text, set the spine's `updated:` to the apply date and add a `sources` line for this change in its front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. Applied that way on 2026-11-01, with SOLUTION-DESIGN's `updated:` set to the same date. Since the apply, each block's replacement text stands in its document word for word and its current text no longer does, except as the start of Block 3's replacement, which extends it; tasks 0.2 and 11.1 check that.

Checked on 2026-10-31 against the spine on `main` at 92ca203, and again on 2026-11-01, just before the apply, on this branch, whose `docs/` were still `main`'s at 92ca203: each current text stood once, word for word. The `tree-widget` change amends AD-9's "Build and assembly" bullet and AD-20's "Answers" bullet, and the `gantt-widget` draft AD-13's "The graph" bullet; none of these blocks quotes those bullets, so they apply in any order. Group 0's rebase brings their amendments under this one; the spine's front matter is a merge point (design, Merge points).

## Block 1: AD-6, Rule, Schemas and validation, second and third bullets

Applies if the PO accepts open question 4 (where per-molecule schemas live).

Current:

```text
    - Per-widget and per-molecule schemas, and the asking-rule predicates, exist only in `contract`. Tool definitions never include them.
    - The skills' reference files, examples and asking-rule texts are generated from `contract` at build time. CI fails when a shipped file differs from its generated form, or when an example fails validation.
```

Replacement:

```text
    - Per-widget schemas, the molecule reference and definition formats, and the asking-rule predicates exist only in `contract`. Each ready-made molecule's parameter schema is part of its definition, data in `molecules` written in `contract`'s definition format. Tool definitions never include any of them.
    - The skills' reference files, examples and asking-rule texts are generated from `contract` and `molecules` at build time. CI fails when a shipped file differs from its generated form, or when an example fails validation.
```

## Block 2: AD-9, Rule, Molecules, second to fourth bullets

Applies if the PO accepts open questions 3, 5, 6 and 7 (the definition format, expanded IDs, the expansion map, versions). The first bullet ("Ready-made molecules are input-format data, not code.") and the fifth (the sales-estimate-review's `minimumMargin`) stay as they are.

Current:

```text
    - A molecule reference is an item `{type: "molecule", id, props: {molecule, version, data}}`, with `version` optional. A molecule declares its parameters as JSON Schema and, for each parameter, the JSON Pointers in its composition that the parameter fills.
    - `ask-core` expands a reference when the ask or update is sent, through the `MoleculeSource` port. Expansion prefixes every internal item ID with `<id>__` and rewrites the molecule's references to match. It refuses an expansion whose IDs exceed 64 characters.
    - Answers and warnings address a molecule's content through the reference's ID and the child IDs of its data (`wbs.portal.label`), never through the expanded IDs, and carry no `molecule` field: `ask-core` maps between the two. A reference without `version` gets the highest shipped version of the current major.
```

Replacement:

```text
    - A molecule reference is an item `{type: "molecule", id, props: {molecule, version, data}}`, with `version` optional. A molecule's definition names the version of the definition format it follows, and declares its parameters as JSON Schema, its composition and, for each parameter, the JSON Pointers in its composition that the parameter fills. A fill copies the parameter's value or applies one of the format's declarative forms: naming an item of the ask, turning an object's values into entries of one field, or leaving out named keys. No fill evaluates anything. `contract` holds the format; `molecules` holds the ready-made definitions.
    - `ask-core` expands a reference when the ask or update is sent, through the `MoleculeSource` port. Expansion prefixes every internal item ID with `<id>__` and rewrites the molecule's references to match: a parameter that names a molecule reference of the ask names that reference's expanded item. It refuses an expansion whose IDs exceed 64 characters or repeat an item ID of the ask, or whose expanded items fail their widgets' checks. The board document holds the expanded items, never the reference; `ask-core` keeps, beside it, which expanded item belongs to which reference.
    - Answers and warnings address a molecule's content through the reference's ID and the child IDs of its data (`wbs.portal.label`), never through the expanded IDs, and carry no `molecule` field: `ask-core` maps between the two. In the first version of the format a composition holds one item, whose addresses are its reference's. A reference without `version` gets the highest shipped version of the current major; one with a version, the shipped version of that major at or above it. AskBoard ships one version per major of a molecule.
```

## Block 3: AD-9, Rule, Components, second bullet

Applies if the PO accepts open questions 11 and 14 (an added package's predecessors, linked edits through the port).

Current:

```text
    - A component renders from the board document, the draft record (AD-20) and the compute graph alone, with no network and no server call. It keeps no edit state of its own: every edit goes into the draft record.
```

Replacement:

```text
    - A component renders from the board document, the draft record (AD-20) and the compute graph alone, with no network and no server call. It keeps no edit state of its own: every edit goes into the draft record. An edit that the board's links carry into another item of the same question, such as a work package added in a WBS that a Gantt plan schedules, goes into the draft record for both items in one update.
```

## Block 4: SOLUTION-DESIGN.md, §4.11 Tool surface and cost, "Generic schemas", first sentence

Applies with Block 1, so that the solution design keeps explaining the spine without a rule of its own. Only the bullet's first sentence changes; the rest of the bullet, from "Tool definitions load every session", stays.

Current:

```text
- **Generic schemas.** Per-widget and per-molecule schemas live only in `contract`, and the skills' references are generated from it.
```

Replacement:

```text
- **Generic schemas.** Per-widget schemas and the molecule formats live only in `contract`, each ready-made molecule's parameters in its definition in `molecules`, and the skills' references are generated from both.
```
