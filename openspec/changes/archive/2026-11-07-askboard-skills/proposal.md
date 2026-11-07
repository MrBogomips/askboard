# Proposal

## Why

FR-29 asks for shipped skills that teach agents when to use AskBoard rather than AskUserQuestion, which widget or molecule fits, and how to keep asks cheap; FR-30's asking rules are only advisory without hooks, so they must be taught too (AD-16). The plugin ships no `skills/` folder today: `ask`'s description and the server instructions point to "the askboard skill", which does not exist. AD-6 requires the skill's references, examples and asking-rule texts to be generated from `contract` and `molecules` and checked in CI, and every widget change that follows `widget-registry` needs one place to register what agents learn about it.

## What Changes

- **One shipped skill, `skills/askboard/`** (FR-29, NFR-11, AD-18): `SKILL.md` (routing between AskBoard and AskUserQuestion, the asking rules, cheap asks, IDs, delivery by pull and push, follow-ups, subagents, a board AskBoard cannot show, declined and discarded asks, the item index) and `references/` (one file per widget type, one per ready molecule, one for the context items, one on answers and Snapshots). Loaded by Claude Code from the plugin root as `askboard:askboard`.
- **Generated, never hand-edited** (AD-6): a generator in `tools/build` writes every file under `skills/askboard/` from the widget-type registry, the input schemas, the asking rules, the reference patterns, the Snapshot constants, the ready molecules and two prose templates. `bun run build:skills` writes them; `bun run check:skills`, part of `bun run check` and so of CI, fails on a file that differs, is missing or is extra.
- **Examples that validate** (AD-6): every example in the shipped skill is sent through `ask-core`'s send path with the shipped molecules in a test, and every result example is validated against its tool envelope; one that stops validating fails `bun run test`.
- **Teaching data where each type is registered**: the widget-type registry gains an optional `skill` field (when to use the widget, and notes such as a renderer's limits), required by the generator for every shipped type; each ready molecule gains a `skill.json` beside its definition (when to use it, an example reference). A later widget or molecule change adds those, runs `bun run build:skills` and commits the result.
- **Asking-rule texts in `contract`** (AD-16, FR-30): one text per rule of `ASKING_RULES`, the `with-references` text being the one the hook's predicate is described by.
- **A token budget, tested** (NFR-1, AD-6, AD-17, PRD R5): the skill's description, `SKILL.md`, each reference, and the always-loaded total (tool definitions, server instructions and the skill's description) each have a character budget that `check:skills` enforces.
- **No shipped agent in the first version** (FR-28, FR-29; open question 1): subagents load plugin skills through the Skill tool, so no task needs an agent of its own. `prd-update-draft.md` (FR-28, FR-29) and `spine-update-draft.md` (AD-19's bundle, the Structural Seed's `agents/`, a Deferred row) say so, applied in task 0.1.
- **The benchmark's AskBoard arm may load the skill, and only it** (NFR-1, AD-17): `Skill` joins that arm's tools, allowed only as `Skill(askboard:askboard)`; every arm runs with Claude Code's bundled skills switched off, and the report lists and flags the skills each run lists, so the context measured is the skill's own.
- **Versions**: no schema set changes; every set keeps the base's version.
- **Not in this change**: building and registering molecules (FR-16 is a later version; open question 3); a live check that agents follow the skill, which is a PO run (task 4.1); any widget, molecule or tool text change.

## Capabilities

### New Capabilities

- `skills`: the shipped skill, its generation, its drift and example checks, what it teaches, its budgets, and the benchmark arm that loads it.

### Modified Capabilities

- `contract`: asking-rule texts; the widget-type registry's teaching field.
- `molecules`: teaching data for each ready molecule.
- `packaging`: the plugin carries the skill from its root and no agent.

## Impact

- New: `skills/askboard/` (generated, committed), `tools/build/skills.ts` and `tools/build/skills/` (generator, templates, tests), `packages/server/test/skills-examples.test.ts` (examples sent through `ask-core`), `packages/molecules/src/<name>/skill.json`.
- Changed: `packages/contract` (`push/asking-rules.ts`, `widgets/registry.ts`, the Tree's and Gantt's `widget.ts`, an appended export block), `packages/molecules/src/index.ts`, `packages/bench/src/` (`command.ts`, the init event's skills in `transcript.ts` and the report), root `package.json` (`build:skills`, `check:skills`, workspace dev dependencies for the generator), `CLAUDE.md`, the PRD and the spine through the drafts.
- No new third-party dependency; no licence change (NFR-6); no outbound connection (NFR-9); no view chunk changes.
- Merge points with `widget-registry` (this branch's base, unmerged) and `diagram-render` (proposed): design.md, Merge points.
- IDs served: FR-28, FR-29, FR-30, FR-4, FR-15, FR-21, FR-26, FR-27; NFR-1, NFR-8, NFR-11; SM-1, SM-2; R5. ADs: AD-3, AD-6, AD-16, AD-17, AD-18, AD-19.

## Open questions for the PO

1. **No shipped agent in the first version.** FR-29 and FR-28 say "skills and agents". Claude Code documents that subagents invoke plugin skills through the Skill tool, and no PRD journey needs a dedicated AskBoard agent; an agent would add its description to every session's context (R5). Default: ship the skill only; amend FR-28 and FR-29 to "any shipped agents", and add a spine Deferred row naming when an agent comes back. *Alternative:* a small `askboard:asker` agent that preloads the skill, for delegating a batch of questions.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
2. **One skill, not several.** One `askboard` skill with references loaded on demand keeps one description in the always-loaded listing; per-widget skills would each add one. Default: one skill, references per type. *Alternative:* a routing skill plus one skill per widget family.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
3. **Molecule building waits for FR-16.** FR-29 lists "how to build and register a molecule", but registering molecules is a later version (PRD §4, FR-16, FR-17). Default: the skill teaches the ready molecules by name; teaching how to build one comes with FR-16. *Alternative:* teach the definition format now, for agents reading `molecules`' files.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
4. **Budgets.** Description at most 600 characters (the Agent Skills limit is 1,024); `SKILL.md` at most 9,000 characters and 250 lines; each reference at most 6,000 characters; the always-loaded total at most 8,400 characters, about 2,100 tokens at four characters a token (PRD R5). Default: these, enforced by `check:skills`; the benchmark measures the real tokens. *Alternative:* report only, as the spine's CI reports do.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
5. **The skill grants no tool permission.** Its frontmatter holds `name` and `description` only, with no `allowed-tools`, so loading it never widens what an agent may run unprompted. Default: as stated. *Alternative:* pre-allow AskBoard's five tools while the skill is active.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
