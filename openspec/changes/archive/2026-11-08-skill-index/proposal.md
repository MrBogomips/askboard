## Why

`skills/askboard/SKILL.md` must stay within 9,000 characters (askboard-skills decision 7), and its item index grows by one line of about 155 characters per item type: 22 lines are 3,402 of its 8,062 characters on `main` 7634443d. `layouts` (PR #60) brings it to 8,755, `form-widget` to 8,987, `table-widget` to 8,880, and the three together to about 9,112, so each of the nine widget changes in flight stops on the budget at its rebase. This change lands first and makes the cost of a new type in `SKILL.md` a link of about 45 characters (FR-29, NFR-1, NFR-11, AD-6).

## What Changes

- The per-type lines (noun, type and use) move from `SKILL.md` into a new generated reference, `references/items.md`, which says what each item type is for and links no file.
- `SKILL.md`'s item index becomes four lines: a link to `references/items.md`, the context item types with one link to `references/context.md`, the widget types in registry order, each a link to its reference, and the molecules, each a link to its reference. Every reference stays one level from `SKILL.md`.
- The routing section, the asking rules, cheap asks, the question and area shapes, delivery and the fallbacks stay in `SKILL.md` unchanged; the template does not change.
- Budgets unchanged: `SKILL.md` 9,000 characters and 250 lines, each reference (the new file included) 6,000, the description 600, the always-loaded total 8,400. `check:skills` keeps its drift check and budgets.
- A widget or molecule change still only gives its teaching data and runs `bun run build:skills`; the generator places its line in `references/items.md` and its link in `SKILL.md`.
- `document-review`'s design decision 12 (a new index-line form and a 70-character use bound) loses its reason and is superseded: see design.md, Merge points.
- The benchmark protocol is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skills`: the item index splits into `SKILL.md`'s links and the generated item catalogue `references/items.md`; the requirements on the widget and molecule references and on naming every item type say where each type is listed.

## Impact

- `tools/build/skills/`: `generate.ts` (the `itemIndex` value and one more generated file), a new `catalogue.ts` and its test, and the tests on main that read an index line from `SKILL.md` (`generate.test.ts`, `atoms-skill.test.ts`).
- `skills/askboard/`: `SKILL.md` regenerated, `references/items.md` added.
- No change to `packages/`, the plugin manifest, the contract's schema sets or versions, the PRD, the spine, the UX documents or the benchmark.
- The widget changes in flight rerun `bun run build:skills` at their rebase, and their skill tests that read an index line read it from `references/items.md` (design.md, Merge points).
