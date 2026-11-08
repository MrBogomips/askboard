## Context

See proposal.md, Why. State on `origin/main` 7634443d:

- **The generator** (`tools/build/skills/`, askboard-skills decisions 1, 2 and 7): `generate.ts` fills `templates/SKILL.md`'s slots; `itemIndex` (`:84`) builds one line per type, `` - <noun> (`<type>`): <use> → [<type>](references/widgets/<type>.md) `` for a widget, `` - `<type>`: <use> → [context](references/context.md) `` for a context item (`contextTypes`, `CONTEXT_TEACHING`), `` - `<molecule>`: <use> → [...](references/molecules/<molecule>.md) `` for a molecule (`READY_MOLECULES`, `MOLECULE_SKILLS`). The template's line before `{{itemIndex}}` ends "Read the reference of a type before you use it:". `budgets.ts` holds `BUDGETS` (`skill` 9,000, `skillLines` 250, `reference` 6,000 for every file but `SKILL.md`, `description` 600, `alwaysLoaded` 8,400); `budgetReport` measures each generated file. `SKILL_USE_MAX` (200, `contract/src/widgets/registry.ts:237`) bounds a type's `use`.
- **Figures** (Python code points, which equal the checker's UTF-16 count here): `SKILL.md` 8,062 characters, of which the 22 index lines are 3,402 (about 155 each; the link part about 40). On the feature branches: `layouts` 8,755 (26 lines, 3,847), `form-widget` 8,987 (27, 3,982), `table-widget` 8,880 (27, 3,972); `layouts`' and `form-widget`'s other additions are their `{{layoutNote}}` (about 250) and `{{formNote}}` (about 100). No generated reference links to a file today.
- **The documentation** (read on 2026-11-08). The host's skills page asks to keep `SKILL.md` under 500 lines, to move detailed reference material to separate files, and to reference supporting files from `SKILL.md` so the agent knows what each holds and when to load it, with Markdown links in its examples; after compaction the first 5,000 tokens of an invoked skill are kept. The Agent Skills best-practices page asks to keep references one level deep from `SKILL.md`, every reference file linked directly from it, because a nested reference may be previewed with `head -100` and read partly; a reference over 100 lines carries a table of contents. Nothing here relies on the host's run-time behaviour beyond what those pages state, so no item needs a probe.
- **The benchmark** (`packages/bench/src/command.ts:85`, `toolsOf`): the AskBoard arm's tools are `ToolSearch`, `Skill` and, for a subagent case, `Agent`, with `Skill(askboard:askboard)` allowed; it has no file-reading tool, so it reads `SKILL.md` only, today and after this change. Its scenarios ask no widget question.

IDs: FR-29 (skills that say which widget or molecule fits), NFR-1 and PRD R5 (cheap asking; the skill's cost), NFR-11 and AD-18 (Agent Skills conformance), AD-6 (generated teaching), AD-17 (measurement). No PRD, spine or UX change.

## Goals / Non-Goals

**Goals:** a new item type costs `SKILL.md` one link, about 45 characters; every reference stays one level from `SKILL.md`; the widget changes in flight need no budget edit at their rebase.

**Non-Goals:** a new registry field (families, ordering); shortening any type's `use`; changing a budget, the template's prose, the description, the routing or the asking rules; any contract, schema set or version.

## Decisions

### 1. Move the per-type lines into a generated catalogue, keep the budget

`references/items.md`, the item catalogue, holds the line of each type that the index holds today, less its link: `` - <noun> (`<type>`): <use> `` for a widget type, `` - `<type>`: <use> `` for a context item or a molecule, under the headings "Context items", "Widgets" and "Molecules", after a one-line lead saying it tells what each type is for and that `SKILL.md` links each type's reference. It links no file of the skill (the one-level rule). `BUDGETS` does not change.

Estimated figures (measured on `main`'s generated text, task 0.1 records the real ones): `SKILL.md` 8,062 → about 5,690 characters (the 3,402 of the lines out, about 1,030 of decision 2's lines in), 83 → about 65 lines; `references/items.md` about 2,660 characters. With every type in flight (`layouts`' four, `form-widget`'s PickField, the Table, Document review, Image annotation, Graph, Diff review, Diagram and Spreadsheet: 12 more, plus `layoutNote` and `formNote`), `SKILL.md` is about 6,580 of 9,000 (room for about 50 more types) and the catalogue about 4,000 of 6,000 (room for about 17 more lines at 112 characters).

*Alternative rejected:* `BUDGETS.skill` raised to 10,500 (spreadsheet-widget decision 18's fallback). Measured reason against it: the in-flight types add about 1,860 index characters on top of `form-widget`'s 8,987, so 10,500 is reached again within this round (about 10,850 with every type above), and each later type still adds about 155 characters, about 39 tokens, to every invocation. *Alternative rejected:* `document-review` decision 12 alone (link-first lines, 70-character uses): it saves about 806 characters once, and spreadsheet-widget decision 18 shows the budget overrun again after six more types.

### 2. What `SKILL.md` keeps

The template stays byte-identical. The `{{itemIndex}}` slot keeps its name and place, and its value becomes four lines after the template's "Read the reference of a type before you use it:":

```
- What each type is for: [items](references/items.md)
- Context items, in [context](references/context.md): `excerpt`, `reference`, `image`
- Widgets: [`tree`](references/widgets/tree.md), [`gantt`](references/widgets/gantt.md), …
- Molecules: [`gantt-plan`](references/molecules/gantt-plan.md), [`wbs-pert`](references/molecules/wbs-pert.md)
```

Widget types in registry order, molecules in `READY_MOLECULES` order, context types in `contextTypes()` order. What `SKILL.md` must hold (skills spec: routing, asking rules, cheap asks, every item type named in backticks, the area, delivery, ownership, fallbacks) is still in it; an agent decides AskBoard against AskUserQuestion from the routing section ("needs a widget") and the widget names, and opens the catalogue only when it picks a type.

Every reference is linked from `SKILL.md` by name, as the best-practices page asks, rather than through a path rule such as `references/widgets/<type>.md` (about 13 characters a type, but a pattern the documentation does not show) or through the catalogue (a second level).

*Alternative rejected:* family lines from a new `skill.family` field (context, atoms, layouts, widgets, molecules, as spreadsheet-widget decision 18 sketches): every widget change in flight would have to add the field, a new seam for a grouping the catalogue already gives by heading.

### 3. Where the code goes

A new module, `tools/build/skills/catalogue.ts`, holds the catalogue's lines and the four index lines (the code `itemIndex` holds today, moved), so the edit to `generate.ts` is three places: `itemIndex`'s body replaced by a call, the import, and one `add("references/items.md", …)` after `references/answers.md`. The lines `layouts` and `form-widget` change in `generate.ts` (the import of `LAYOUT_TYPES`, `layoutNote`, `formNote`, `contractSchemaResolver`'s call, the slot values) and in the template (`{{itemIndex}}{{layoutNote}}{{formNote}}`) are untouched, so their rebase conflicts only where a test reads an index line (Merge points). The catalogue has no template file: `Templates` keeps its two fields, so the tests that build one stay valid. File order: `SKILL.md`, `references/answers.md`, `references/items.md`, then context, widgets, molecules.

### 4. Tests

`tools/build/skills/catalogue.test.ts` holds the delta spec's scenarios: the Tree's line in the catalogue and its link in `SKILL.md`; a probe type (`PROBE_WIDGET` with a `use`) adding one line and one link and leaving the rest of both files unchanged; every generated file but `SKILL.md` linked from `SKILL.md`, and no other file linking a file of the skill; the catalogue over 6,000 characters failing `budgetReport`, named; the skill generated with `withWidgetTypes(...ATOM_TYPES)` and twelve probe types of in-flight-sized uses within every budget. The tests on `main` that read an index line from `SKILL.md` move to the catalogue: `generate.test.ts` "SKILL.md item index" (`:241-272`: order and uses read from the catalogue, links from `SKILL.md`), the probe test (`:337-342`) and the file list (`:37-45`); `atoms-skill.test.ts:14-20`.

### 5. The benchmark protocol is unchanged

The arms, their tools and allowed tools, the environment, the measures and the report do not change, and the AskBoard arm still loads `Skill(askboard:askboard)` (skills spec, The benchmark arm loads the skill). The arm cannot read a reference, so it reads `SKILL.md` alone, before and after. What changes is a figure, not the protocol: the invoked skill is about 2,370 characters (about 590 tokens) shorter, which lowers the preparation cost the benchmark measures after a `Skill` call; runs before and after the merge are not comparable on that figure, so a comparison takes runs from one side of it (the report names no plugin version: task 0.1 records `main`'s SHA for that purpose). Outside the benchmark, an agent choosing an unfamiliar widget reads the catalogue once (about 2,660 characters now), which it reads instead of the lines `SKILL.md` no longer carries.

### 6. Versions

None: no contract schema set, constant or board message changes (askboard-contract-versioning has nothing to bind).

## Merge points

Borrowed from `origin/main` 7634443d (task 0.1 records each with file and line): `generateSkill`, `itemIndex` (module-private), `contextTypes`, `CONTEXT_TEACHING`, `WIDGET_TYPES`, `READY_MOLECULES`, `MOLECULE_SKILLS`, `budgetReport`, `BUDGETS`, `PROBE_WIDGET`, `withWidgetTypes`, `ATOM_TYPES`, `SKILL_USE_MAX`, `build:skills`, `check:skills`, `toolsOf` (read only). Nothing is borrowed from an unmerged change.

This change should merge before any of the changes below; each then reruns `bun run build:skills` at its rebase (never resolves `skills/askboard/` by hand), and its `SKILL.md` growth is one link per type.

- **`document-review`** (worktree `feature-document-review`, head 24656505, stacked on `form-widget`): its decision 12 and task 2.1 (index line `` - [`<type>`](<reference>): <use> ``, `SKILL_USE_MAX` 70, uses shortened, `index-line.test.ts`) and its delta requirement "The item index line" are **superseded, not absorbed**: the lines leave `SKILL.md`, so neither the form nor the bound saves budget. Proposed default: its next `/opsx:update` drops decision 12, task 2.1 and that requirement, keeps its own `use` within `main`'s 200, and moves `form-skill.test.ts`'s index assertions as below. If the PO wants the 70 bound for the catalogue's room, it can stay there as its own decision; nothing here depends on it.
- **`layouts`** (PR #60, head 9ae1c685): `layouts-skill.test.ts:18` and `:65` read `- <noun> (\`<type>\`)` lines from `SKILL.md`; at its rebase they read `references/items.md` (`:18`) and the links in `SKILL.md` (`:65`). Its `layoutNote` and template line are untouched.
- **`form-widget`** (head 9dbfef0a, stacked on `layouts`): `form-skill.test.ts:23-25` read the PickField's line and its link from `SKILL.md`; the line moves to the catalogue, the link stays in `SKILL.md`; `:62`'s `` (`pick-field`) `` becomes the link text `` [`pick-field`] ``. `formNote` untouched.
- **`table-widget`** (head 4cb1e7bd, on `layouts`): carries `layouts-skill.test.ts` (as above); its own registration regenerates.
- **`image-annotation`**, **`graph-widget`**, **`diff-review`**, **`diagram-widget`**, **`spreadsheet-widget`** (proposed, one commit each), and **`diagram-render`** (proposed, 9281d923): image-annotation's and table-widget's group 0 record "the item-index line builder in `generate.ts`", which is now the call into `catalogue.ts`; spreadsheet-widget decision 18 and its task 6.3 find this fix on their base, so its index line "in document-review's form" becomes the catalogue's line. Each `/opsx:update` at their rebase only rewords those references.

Seams this change creates: the file name `references/items.md`, the catalogue's line forms (decision 1) and `catalogue.ts`' exports, which the in-flight skill tests read through `generateSkill().files`.

## Risks / Trade-offs

- [An agent picks a widget from its name alone, without the catalogue] → the routing section and every name stay in `SKILL.md`, and each type's reference, which an agent reads before using the type, opens with its use; the benchmark and the PO's live checks measure skill use (askboard-skills task 4.1).
- [The catalogue reaches its 6,000 characters] → at about 112 characters a line it holds about 50 types; a change that would pass it shortens uses (document-review's 70 bound is ready) or moves the budget through a design decision.
- [A rebase resolves `SKILL.md` by hand] → the generator's drift check fails; rerun `bun run build:skills`.
- [A widget's long `use` grows `SKILL.md`] → it no longer can: `SKILL.md` carries the type only.

## Migration Plan

None beyond regenerating `skills/askboard/`. Rollback is a revert, then `bun run build:skills`.

## Open Questions

Proposed defaults, for the PO (the run is unattended; each is applied as stated):

1. The catalogue rather than a raised budget (decision 1). Default: the catalogue.
2. Links by name in `SKILL.md` (about 45 characters a type) rather than a path rule (about 13). Default: links, as the documentation shows.
3. `document-review` decision 12 superseded rather than absorbed (Merge points). Default: superseded; the 70-character bound stays available.
4. The catalogue under the existing 6,000-character reference budget, with no budget of its own. Default: yes.
