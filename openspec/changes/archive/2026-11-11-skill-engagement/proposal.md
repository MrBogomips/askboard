# Proposal

## Why

Issue: #155.
Issue: #122.

Since the plugin was installed at user scope (2026-11-09), 26 real sessions with AskBoard's tools available made no `ask` call and loaded the `askboard` skill zero times, while they made 21 AskUserQuestion calls, 12 of them with several questions. Complex questions go to AskUserQuestion or into chat prose, so FR-29's routing consequence is not met where the board exists to help. The causes, from #155:

- **The skill listing hides the description.** Claude Code drops descriptions from an overflowing skill listing, least-invoked skills first, so a never-invoked plugin skill shows its name only (`/skill-doctor`: `askboard:askboard`, context under 20 tokens, 0 loads). The loop does not break by itself.
- **The description names no situation.** It reads "Use when you need to ask the user something and AskBoard's tools … are available", then summarises the body. It names no trigger and has a precondition the agent cannot check when the tools are deferred.
- **The always-loaded routing contradicts the skill.** The server instructions are the only text every session loads in full. They route by count: "more than four at once … For one quick choice AskUserQuestion is fine". The skill says "several questions" and "more than four options", and FR-29 has neither the "several questions" case nor a criterion.
- **Nothing always loaded says to load the skill.** The `ask` description presents the skill as a catalogue only.

The PO decided the criterion on 2026-11-10 (#155): route by the question's **cognitive and contextual complexity**, not by a count. The indicative cases are:

- many, strongly interconnected questions;
- questions with a high cognitive load that cite documents cryptically by ID (D-01, FR-12, ADR-7);
- content that reads better as a visual artifact (a WBS, a Gantt, a chart, UML or a state machine, a LaTeX formula, a table, a document to review).

The agent judges whether a visual and interactive tool helps. A simple, self-explanatory choice stays with AskUserQuestion, and AskBoard still sits beside AskUserQuestion.

#122 comes along because this change adds amendments to the approved texts. The mcp-adapter requirement "Approved texts unchanged" still says the served texts equal the approved fixtures byte for byte, which has been untrue since `agent-facing-gaps`. This change rewrites it.

## What Changes

- **The criterion in every agent-facing text, in one wording.** Each text states the criterion, names its cases as examples and leaves the judgment to the agent. None counts questions or options any more.
- **Server instructions (approved text, by amendment).**
  - The routing paragraph becomes the criterion.
  - Two lines are added: load the `askboard` skill before the first `ask`, and never put a complex question in chat prose.
  - Recorded in `APPROVED_TEXT_AMENDMENTS`; the archived approved copies stay byte-identical.
- **`ask` tool description (approved text, by amendment).** It says to load the `askboard` skill before the first `ask`: the skill says when to ask on the board, and lists every item type and its props.
- **The `none` asking-rule text** (`ASKING_RULE_TEXTS`). It says the agent chooses by the question's complexity.
- **The `askboard` skill (generated).**
  - The description leads with the criterion and its situations. It says to load the skill before asking the user to decide or review something complex, in chat or with AskUserQuestion, and when the user asks for AskBoard. It drops the "tools are available" precondition and the summary of the body.
  - "Which tool asks" is rewritten on the criterion, with why the board helps.
  - `references/items.md` gains a generated mapping, "By what the user has to do", from user goals to the item types that help. It is declared indicative and names only registered types. A UML diagram or a state machine goes in as an `image` of a rendered file or an `excerpt` of its source until a diagram type is registered.
  - `references/items.md` also gains a complete `json ask` example that the examples test validates.
- **The `askboard-help` description.** It gains the trigger words "keyboard shortcuts" and "rebind or remap a key", and drops "It never asks anything on a board.", which the body already says. Its `SKILL.md` gets shorter.
- **Documents.**
  - PRD: FR-29 reworded on the criterion, with testable consequences; FR-30 refers to it; the §1 intent and the §4.8 introduction state it.
  - README: a "When to use it" section.
  - The as-built note `docs/as-built/skill-engagement.md`.
- **Not in this change** (design, Non-Goals): `alwaysLoad` for `ask` (#132), a SessionStart hook (it would need a new AD beside AD-16), and the R5 records (#154).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skills`: the routing requirement is rewritten on the criterion. New requirements cover the asking skill's description, the help skill's description triggers, the catalogue's mapping by user goal, and the complete ask example.
- `mcp-adapter`: new requirements for the server instructions' routing and skill line and for the `ask` description's skill line. "Approved texts unchanged" now reads "with the recorded amendments applied".
- `contract`: "Asking-rule texts" gains the `none` text's criterion.

## Impact

- **Code:**
  - `packages/contract/src/server-instructions.ts`, `src/schemas/tool-envelopes/tools.json` (`ask` description only) and `src/fixtures/approved-amendments.ts`;
  - `packages/contract/src/push/asking-rules.ts` (the `none` text);
  - `tools/build/skills/`: `templates/SKILL.md`, `templates/help/SKILL.md`, `catalogue.ts`, a new `payoff.ts`, and `generate.ts` for the example;
  - `skills/askboard/` and `skills/askboard-help/`, regenerated.
- **Tests:**
  - contract: `tool-envelopes.test.ts`, `approved-amendments.test.ts`, `asking-rule-texts.test.ts`;
  - tools: `generate.test.ts`, `help.test.ts`, a new `payoff.test.ts`;
  - server: `skills-examples.test.ts`, unchanged, picks up the new example.
- **Budgets:** the always-loaded total rises from 6,733 to about 7,545 of 8,400 characters. `SKILL.md` stays under 9,000 with room for the five widget links in flight. `askboard-help`'s `SKILL.md` shrinks (design, Risks).
- **No change** to the view, the board protocol, the hooks, any versioned schema set, any dependency or chunk.
- **IDs served:** FR-29, FR-30; NFR-1, NFR-11; PRD R5 (the always-loaded line); the §1 intent.
- **ADs relied on:** AD-6 (approved tool texts, teaching generated from `contract`), AD-16 (asking rules; the skills' texts generated from `contract`), AD-18 (skill standards). UX: none, since there is no board surface.
- **Related Issues:**
  - #108: its `askboard-skills` 4.1 live routing check is this change's live verification. Its cases are reworded on the criterion: "a question pointing to `README.md#Install` goes to AskBoard" no longer holds by itself.
  - #132: `alwaysLoad`, deferred.
  - #154: records of the same review, out of scope.
  - #122: the served texts against the approved fixtures and amendments; this change adds amendments in the recorded form.
