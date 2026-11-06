# Spine update draft: askboard skills

**Status: applied in task 0.1 on 2026-11-07; block 3's trigger amended on 2026-11-07 by the support-agents evaluation, applied to the spine by task 2.12.** The proposal's open question 1 was answered on 2026-11-06 with its default, under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly, as the spine stands on this change's base (`widget-registry` at d5adfb2f), then gives the replacement. AD-19 is amended in place; no AD is added or renumbered. The PRD change that goes with it is in `prd-update-draft.md`.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: check that each current text stands once (`git grep -c -F`), replace it, set `updated:` to the apply date and append to `sources:` the line `'OpenSpec change askboard-skills, proposal.md, open questions 1 to 5: one generated skill, no shipped agent in the first version, the skill''s budgets (accepted under the PO''s unattended handoff, 2026-11-06)'`. Then run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these lines meanwhile, keep its text and apply this block's change to it, and say so in task 0.1's note.

## Block 1: AD-19, Rule, Bundle, second bullet

Current:

```text
    - One Claude Code plugin from a GitHub marketplace carries the MCP server, the skills, the agents and `hooks/hooks.json`.
```

Replacement:

```text
    - One Claude Code plugin from a GitHub marketplace carries the MCP server, the skills, any shipped agents and `hooks/hooks.json`.
```

## Block 2: Structural Seed, `agents/` line

Current:

```text
  agents/                # shipped agents
```

Replacement:

```text
  agents/                # shipped agents (none in the first version; Deferred)
```

## Block 3: Deferred, a new row after "Molecule registry, export and repository (FR-16, FR-17); full benchmark settings"

Current: none (a new row).

Addition:

```text
| Shipped agents (FR-29) | Subagents load the plugin's skill through the Skill tool, and no first-version task needs an agent of its own; each agent's description would load every session (PRD R5) | In the benchmark, more than 1 of 5 S6 subagent runs call `ask` without loading the skill or need an `isError` retry; or a new case S7 (a delegated dialogue of three questions) shows an agent with the skill preloaded at least 15% below a general-purpose subagent with the skill on median output plus thinking tokens per question, with equally valid asks |
```
