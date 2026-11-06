# Design

## Context

See proposal.md for why. What the change starts from, read on this branch's base (`widget-registry` at d5adfb2f, which stacks on `origin/main`):

- **No shipped skill.** The plugin root holds `.claude-plugin/plugin.json` (the MCP server) and `hooks/hooks.json`; no `skills/` or `agents/`. `.claude/skills/askboard-*` is the repository's development harness and is not part of the plugin. `ask`'s description in `TOOL_DEFINITIONS` (`schemas/tool-envelopes/tools.json`) says "The askboard skill lists every item type and its props"; `SERVER_INSTRUCTIONS` (`server-instructions.ts`) is the only teaching today.
- **What the generator reads.** `WIDGET_TYPES` (`widgets/registry.ts`): per type `type`, `noun`, the props schema, `edits`, `result`, `derived.describe`, `wording.expected`, `example.item`. `CONTEXT_ITEM_TYPES` and the input set's `excerpt-props`, `reference-props`, `image-props`. `ASKING_RULES` (`push/asking-rules.ts`), `WITH_REFERENCES_DESCRIPTION` (`push/references.ts`), `ID_PATTERN` (`constants.ts`), `SNAPSHOT_FOLDER` (`project-folder.ts`), `SNAPSHOT_DATA_ELEMENT` (`snapshot/constants.ts`). `READY_MOLECULES` (`@askboard/molecules`), each with a parameter schema whose `title` and `description` exist. Schema descriptions carry design citations such as "(FR-11, design decision 2)", which are noise to an agent.
- **Claude Code** (documentation read on 2026-11-06: plugin manifest reference, plugin components, skills, sub-agents): plugin skills are found in `skills/<name>/SKILL.md` at the plugin root without a manifest entry, namespaced `<plugin>:<name>`; only `name` and `description` load at session start, the body on invocation, supporting files when read; subagents invoke plugin skills through the Skill tool; the listing truncates `description` plus `when_to_use` at 1,536 characters; Claude Code's guidance keeps `SKILL.md` under 500 lines. The Agent Skills specification requires `name` of 1 to 64 lowercase characters matching its directory and `description` of 1 to 1,024 characters (SOLUTION-DESIGN F38). Not documented, so **needs probe** (task 0.3): that `--plugin-dir` loads the plugin's skills; that the skill is listed with `--setting-sources ""`, as the benchmark runs; that a subagent can load `askboard:askboard`.
- **The benchmark** (`packages/bench/src/command.ts` `toolsOf`): the AskBoard arm's `--tools` holds `ToolSearch` and the agent tools, not `Skill`, so no run can load a skill; `PREPARING_TOOLS` (`measure.ts`) already counts `Skill` calls as preparing an ask.

ADs relied on: AD-3 (idempotent events, the skills teach ignoring a seen `seq`), AD-6 (references, examples and asking-rule texts generated from `contract` and `molecules`; CI fails on drift or an invalid example), AD-16 (rule texts from `contract`; advisory without hooks), AD-17 (the benchmark reports the context AskBoard adds), AD-18 (Agent Skills conformance; `unavailable` and the fallbacks), AD-19 (one plugin carries the skills; amended by `spine-update-draft.md`). UX: no board surface changes; EXPERIENCE and DESIGN are not touched.

## Goals / Non-Goals

**Goals:**

- A later widget or molecule change touches the skill only by giving its teaching data and running `bun run build:skills`; the check tells it when it forgot.
- What the skill says about items is what `contract` validates, and every example in it is accepted by `ask-core`.
- The always-loaded cost stays within PRD R5's 2,100-token line.

**Non-Goals:**

- Agents (open question 1); molecule building (open question 3); per-widget skills (open question 2).
- Changing tool descriptions or the server instructions: the skill's name matches what they say.
- Proving that agents follow the skill: that is a live PO run (task 4.1) and the benchmark.

## Decisions

### 1. One skill, its files

```text
skills/askboard/
  SKILL.md                      routing, asking rules, cheap asks, IDs, item index, delivery, follow-ups, fallbacks
  references/
    context.md                  excerpt, reference, image
    answers.md                  answers, fetch, Snapshots, one collect result example
    widgets/<type>.md           one per registered widget type, in registry order
    molecules/<name>.md         one per ready molecule
```

The frontmatter holds `name: askboard` and `description` only: no `allowed-tools` (open question 5), no `when_to_use`, so the listing holds one short text. The description is static text in the template, about when to use AskBoard, and names no widget, so it does not grow with the catalogue. `SKILL.md` links each reference by a relative path (`references/widgets/tree.md`); the item index gives one line per type, "<noun>: <use> → <link>", so an agent opens only the reference it needs.

*Alternatives:* one skill per widget family (one more listing entry each); everything in `SKILL.md` (every widget's fields loaded on each invocation).

### 2. The whole folder is generated

`tools/build/skills/` holds the generator and its inputs: `templates/SKILL.md` and `templates/answers.md` (hand-written prose with `{{slot}}` markers), `fields.ts` (decision 4), `references.ts` (the widget, molecule and context renderers), `generate.ts` (`generateSkill(): {files: ReadonlyMap<string, string>, examples: readonly SkillExample[]}`, pure, no file system). `tools/build/skills.ts` is the command: without arguments it writes the files under `skills/askboard/` and removes any other regular file there; with `--check` it writes nothing, compares, prints each missing, extra or different file and each budget overrun (decision 7), and exits 1 on any. It refuses to follow a symlink under `skills/` and never touches a path outside `skills/askboard/`. Root `package.json` gains `build:skills` and `check:skills`; `check` runs `check:skills` after `check:imports`, so CI's `check.yml` runs it. `build` does not run it: the skill is committed source, and a build must not rewrite it. Biome ignores Markdown, so formatting never fights the generator.

Slots in the templates: `{{askingRules}}`, `{{itemIndex}}`, `{{idPattern}}`, `{{snapshotFolder}}`, `{{snapshotElement}}`, `{{collectExample}}`. An unknown slot or an unused value fails the generator. Generated text uses no date, no absolute path and a stable order (registry order, `READY_MOLECULES` order, `ASKING_RULES` order), so two runs give the same bytes.

*Alternatives:* a hand-written `SKILL.md` with generated blocks between markers (markers cost tokens on every load, and a hand edit outside them is unchecked); generated references only (the asking-rule texts and the item index in `SKILL.md` would drift).

### 3. Teaching data lives where a type is registered

- **Widgets:** `WidgetType` gains `skill?: {use: string; notes?: readonly string[]}` (appended to the type; `use` 1 to 200 characters, each note 1 to 300). `widgetRegistryProblems` gains a rule `skill` that refuses out-of-bounds text when present. The generator fails naming every shipped type with no `skill`. Optional in the type so `PROBE_WIDGET` and a later entry still type-check, required where it matters. The Tree's and the Gantt's entries get their texts in task 1.2.
- **Molecules:** `packages/molecules/src/<name>/skill.json` beside the definition, `{use, example}`, `example` being the `data` an agent sends; `@askboard/molecules` exports `MOLECULE_SKILLS: Readonly<Record<string, {use: string; example: unknown}>>`, keyed by molecule name, frozen. A molecules test checks that its keys equal the ready molecules' names and each example passes `moleculeDataValidator` and the definition's checks.
- **Context items** are few and stable: their `use` lines live in the template, their fields come from their props schemas, and their examples in `tools/build/skills/context-examples.ts`.

*Alternatives:* `use` text inside each props schema's `description` (that text is a schema comment written for maintainers, with citations); a table of uses in the generator (a shared file every widget change edits, the collision `widget-registry` removed).

### 4. Field summaries from the schemas

`fieldLines(schema, resolve)` turns a props or parameter schema into one line per field: dotted path (`nodes[].children`), type (with `enum` values, `const`, `minimum`/`maximum`, `minItems`/`maxItems`, `maxLength`), "required" when listed, and the description. `$ref` resolves by `$id` through the contract's schemas (every set's schemas and every registry entry's props) and by `#/$defs/<name>` within its document; a `$defs` entry is expanded once and later referenced as "as `<name>` above", which also stops recursion (the Tree's children). Combinators list their branches by their `title` or type. Depth stops at four levels, after which "see the example" stands. Descriptions lose parenthesised citations: a parenthesis whose content starts with `FR-`, `NFR-`, `AD-`, `SM-`, `R` plus a digit, or holds "design decision", is dropped with its leading space; tests pin the cases in today's schemas. The props' agent-facing shape is `wording.expected["<type>.props"]` when the entry has one.

A widget reference holds, in order: the noun as heading, `skill.use`, the shape line, the fields, `skill.notes`, "In the answer" (edits: the edited value and `changes` by element ID; `result`: the result's fields from its schema; `derived.describe`), and the example item in a `json item` block. A molecule reference: name, version, `use`, the parameter schema's description, the fields, and an example reference item `{type: "molecule", id, props}` whose `props` hold the molecule's name and the example data, in a `json item` block, as the molecule reference format (`validateMoleculeProps`) defines it.

### 5. Examples: tagged, generated, sent through `ask-core`

Every JSON example the generator writes is a fenced block whose info string is `json ask`, `json item` or `json result` (Markdown renders the first word; the second tells the test what it is). `generateSkill` also returns them as `SkillExample` values `{file, kind, value}`, and a generator test checks that parsing the tagged blocks of the generated files gives exactly that list.

`packages/server/test/skills-examples.test.ts` reads the shipped files under `skills/askboard/` (by path, no import from `tools`, which AD-1's import check would refuse from a package test) and parses their tagged blocks. It sends each `ask` example, and each `item` example wrapped in one question of one ask with a fresh ask ID, through `AskCore.ask` with the ports the server's widget tests compose and `createMoleculeSource()` (the shipped molecules): each must be accepted with no warning except an unresolved pointer (context examples point to files that do not exist in the test root). Each `result` example passes `validateAgainst` on its tool envelope's `$id` (`collect` here). Since `check:skills` holds the shipped files equal to the generated ones, this tests what ships. The `collect` example is built from a contract fixture that task 0.2 names, its versions from the constants.

*Alternatives:* `validateAskRequest` alone (misses molecule expansion, the graph check and widget checks); the conformance suite (a session process per example, minutes in CI).

### 6. Asking-rule texts in `contract`

`push/asking-rules.ts` gains `ASKING_RULE_TEXTS: Readonly<Record<AskingRule, string>>`, frozen: `none` (the agent chooses per question, as the routing section says), `always` (every question goes through AskBoard), `with-references` = `WITH_REFERENCES_DESCRIPTION`. Exported in one appended block at the end of `src/index.ts` (askboard-implementation's layout). The generator writes each as "`<rule>`: <text>" in `ASKING_RULES` order, then the advisory sentence: without AskBoard's hooks the rule is not enforced, so the agent applies the rule the `ask` result reports. The hook's predicate is untouched.

### 7. Budgets

| What | Budget | Why |
|---|---|---|
| `description` | 600 characters | Loaded in every session and every subagent's listing; about 150 tokens |
| `SKILL.md` | 9,000 characters and 250 lines | Loaded once per invocation; about 2,250 tokens, under Claude Code's 500 lines |
| each reference | 6,000 characters | Read on demand, one or two per ask |
| always-loaded total | 8,400 characters | `TOOL_DEFINITIONS` as compact JSON, `SERVER_INSTRUCTIONS`, the skill's name and description: about 2,100 tokens at 4 characters a token, PRD R5's line |

On the base, the tool definitions are about 4,300 characters compact and the instructions about 1,500, so the total starts near 6,400 with a full description. The characters are a proxy; the benchmark reports tokens per model (AD-17). `check:skills` prints every figure with its budget, and a test pins each rule with a synthetic overrun. A widget change that pushes a reference over budget shortens its `use`, notes or schema descriptions; the budget does not move without a design decision.

### 8. No agent; the plugin unchanged

The plugin manifest stays as it is: `skills/` is the default path and adds nothing to `plugin.json` (a `skills` key would add to the default scan, an `agents` key would replace it). A workspace test (`tools/workspace.test.ts`) holds the packaging requirement: the skill's file exists, the manifest has neither key, no `agents/` folder, and the skill named in `ask`'s description equals the skill's `name`. PRD FR-28 and FR-29 and the spine's AD-19, Structural Seed and Deferred change through the drafts (open question 1).

### 9. The benchmark arm loads the skill

`toolsOf` adds `Skill` to the AskBoard arm's `tools` and `allowed`; the AskUserQuestion arm and the baseline stay as they are. The report already counts a `Skill` call as preparation (`PREPARING_TOOLS`) and T as the first-request difference from the baseline, which now includes the skill's listing entry.

### 10. Versions

No schema set widens: the change adds a TypeScript field, a constant and generated Markdown. Every set keeps the base's version, and the rebase task checks that no `*_VERSION` or `*_FORMAT` constant differs from the base it lands on (askboard-contract-versioning).

## Merge points

Borrowed from `main` (task 0.2 checks each on `origin/main` with its file and line): `ASKING_RULES`, `AskingRule`, `WITH_REFERENCES_DESCRIPTION`, `ID_PATTERN`, `SNAPSHOT_FOLDER`, `SNAPSHOT_DATA_ELEMENT`, `SERVER_INSTRUCTIONS`, `TOOL_DEFINITIONS`, `CONTEXT_ITEM_TYPES`, `validateAgainst`, `validateMoleculeProps`, `moleculeDataValidator`, `READY_MOLECULES`, `createMoleculeSource`, `AskCore` and its `ask`, the server tests' composition helper (`packages/server/test/composed-session.ts`, or whatever `session-process-widgets.test.ts` uses), `toolsOf`, `PREPARING_TOOLS`.

Changes in flight:

- **`widget-registry`** (this branch's base d5adfb2f, unmerged; being rebased onto `origin/main` 435939d7 plus `widget-editing-plus`'s archive). Borrowed: `WidgetType` with `noun`, `props`, `edits`, `result`, `derived.describe`, `wording.expected`, `example.item`; `WIDGET_TYPES`, `widgetRegistryProblems`, `TREE_WIDGET`, `GANTT_WIDGET` and their files `widgets/tree/widget.ts`, `widgets/gantt/widget.ts`; `PROBE_WIDGET`, `PROBE_TYPES`. Tasks 1.2, 2.1, 2.2, 2.3 and 3.1 use them. This change edits `widgets/registry.ts` (the `skill` field and rule, appended) and the two entry files (one field each). Task 4.3 rebases onto `widget-registry`'s final head, or `origin/main` once it merges (`git rebase --onto <target> d5adfb2f`), re-checks each name and regenerates the skill. Adding `WidgetType.skill` extends its seam; the coordinator is told so.
- **`diagram-render`** (proposed, stacked on `widget-registry`, artifacts at its branch head 9281d923). It registers the `diagram` type and adds `WidgetType.renders`, which the generator does not read; its proposal leaves the teaching of PlantUML's `!include` and `!theme` to this change. Whichever merges second carries the join:
  - If `diagram-render` merges first: task 4.3 adds the Diagram's `skill` (use: correcting a Mermaid or PlantUML diagram; notes: PlantUML's `!include`, `!theme` and standard library are refused, Mermaid's configuration is AskBoard's) and regenerates.
  - If this change merges first: `diagram-render` needs a task, before its own rebase task, to give its entry that `skill` and run `bun run build:skills`; its check fails until it does. The coordinator adds it with `/opsx:update`.
  - Both edit `widgets/registry.ts` (its `renders`, this `skill`): appended lines, keep both.
- **`widget-editing-plus`** (merged as #39 into `origin/main` 435939d7): it changes the Gantt's props schema; the generated Gantt reference follows at the rebase. Nothing borrowed.
- **`early-benchmark`** (code on `main`, PO tasks 8.1 to 8.4 open): task 3.3 edits `toolsOf`; the PO's runs after this change measure the skill. Its spine draft (the `alwaysLoad` decision) does not touch the lines `spine-update-draft.md` edits.
- Every later widget or molecule change: gives its teaching data, runs `bun run build:skills` and commits `skills/askboard/` (the roadmap's "regenerate skill references").

Seams this change creates: `WidgetType.skill`, `ASKING_RULE_TEXTS`, `MOLECULE_SKILLS` and `skill.json` beside a molecule, `generateSkill` and `SkillExample`, the `json ask|item|result` info strings, `build:skills` and `check:skills`.

## Risks / Trade-offs

- [Claude Code loads plugin skills differently from the documentation] → probe task 0.3 before group 2 relies on the layout; a difference stops for `/opsx:update`.
- [Every widget change now also regenerates Markdown, and two in flight conflict on `SKILL.md`'s item index] → the index is one line per type in registry order, so a conflict is two appended lines; the rebase reruns the generator rather than resolving the file by hand.
- [A budget blocks a later widget] → each reference is per type, so one widget's text cannot push another over; the always-loaded total grows only with tool definitions and the description, which widgets do not touch.
- [The skill teaches behaviour the agent ignores] → the routing and fallback texts follow FR-29's consequences word for word; the live check (task 4.1) and the benchmark measure it.
- [Citation stripping removes meaningful text] → only parentheses starting with an ID or naming a design decision; tests pin today's cases, and the drift check shows any change in review.
- [The generator deletes files] → only regular files under `skills/askboard/`, never through a symlink; security review at group 2.

## Migration Plan

None: new files, an optional field and a constant. Rollback is a revert; Claude Code then finds no skill, as today.

## Open Questions

None open: the proposal's five questions carry their answers. FR-29's "how to build and register a molecule" and FR-16's "later versions" disagree; the PRD's own scope line wins (open question 3), and the teaching comes with FR-16.
