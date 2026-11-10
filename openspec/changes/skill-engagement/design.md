# Design

## Context

See proposal.md (Why) for the motivation. Everything below was read on `origin/main` e76d468c on 2026-11-10.

**The texts and where they live:**

| Text | Source | Loaded | Pinned by |
|---|---|---|---|
| Server instructions | `packages/contract/src/server-instructions.ts`. It equals the archived approved text with `APPROVED_TEXT_AMENDMENTS` (`src/fixtures/approved-amendments.ts`) applied. | Every session, in full | `contract/test/tool-envelopes.test.ts:178-189`, `approved-amendments.test.ts` (served = archive + record; no inert entry; fixture copies = archive; "the approved wording"), `server/test/mcp-tools/list.test.ts:40,92-99`, `bench/test/stub.test.ts:104` |
| `ask` description | `packages/contract/src/schemas/tool-envelopes/tools.json:5`, under the same amendment rule | With the tool definitions, deferred when tool search defers them | `tool-envelopes.test.ts:24`, `list.test.ts:73` |
| `none` asking-rule text | `ASKING_RULE_TEXTS` (`packages/contract/src/push/asking-rules.ts:19`), written into `SKILL.md` | With the skill | `contract/test/asking-rule-texts.test.ts`, `generate.test.ts:122-130` |
| `askboard` description and routing | `tools/build/skills/templates/SKILL.md:3,10-15` | Description: the skill listing. Body: on load. | `generate.test.ts:86-117,361-367` |
| Item catalogue | `catalogueText` and `itemIndex` (`tools/build/skills/catalogue.ts`) | On demand | `generate.test.ts` "the item index" |
| `askboard-help` description | `tools/build/skills/templates/help/SKILL.md:3` | The skill listing | `help.test.ts:103-117` |

The approved fixtures and the archive stay byte-identical; only the record changes ("The approved examples stay as archived", contract spec). So `packages/contract/test/fixtures/server-instructions.md` and `fixtures/tools.json` are not edited.

**Budgets now**, from `bun run check:skills`:

| Figure | Now | Budget |
|---|---|---|
| `askboard` description | 342 | 600 |
| `askboard` `SKILL.md` | 7,533 characters, 76 lines | 9,000 characters, 250 lines |
| `references/items.md` | 3,209 | 6,000 |
| Always-loaded total | 6,733 | 8,400 (PRD R5's line) |
| `askboard-help` `SKILL.md` | 5,977 | 6,000 |
| `askboard-help` description | 310 | 400 |

The always-loaded total is the compact tool JSON (4,510), the instructions (1,550), `askboard`'s name and description (350) and `askboard-help`'s (323).

**What Claude Code does at run time.** None of these is assumed. Task 0.3 checks each against the documentation (`claude-code-guide`) before group 1 relies on it, and the live check (task 4.3) observes them.

- Skill descriptions are dropped from an overflowing listing, the least-invoked first, which leaves a never-invoked plugin skill with its name only. *Needs probe:* #155 quotes the skills documentation, and `/skill-doctor` showed it.
- MCP server instructions are loaded in full in every session, including when tool search defers the server's tools, up to a length cap. *Needs probe:* the cap the mcp-adapter spec uses is 4,096 characters.
- A plugin skill is listed and invoked as `askboard:askboard`. *Needs probe:* #108's benchmark run uses `Skill(askboard:askboard)`. Decision 2 names both forms, so a wrong guess costs nothing.
- When tools are deferred, the agent does not see `ask`'s description before a tool search. *Needs probe.* This is why the instructions, not the `ask` description, carry the routing.

**ADs relied on:**

- AD-6: the approved tool texts and the instructions, and teaching generated from `contract`.
- AD-16: the asking rules. The skills' texts are generated from `contract`, and without hooks a rule is only advisory.
- AD-18: the Agent Skills standard for names and descriptions.

**PRD:** FR-29, FR-30, NFR-1, NFR-11, R5 (the always-loaded line), and the §1 intent. **UX:** none, since there is no board surface.

**Merge points with the changes in flight** (`openspec list`, the worktree branches ahead of `main`):

| Change | Where it meets this one | Handling |
|---|---|---|
| `keyboard-shortcuts-help` (merged as #148, not archived) | Its skills delta MODIFIES "The shipped skill" and "The skill's token budget", and ADDS the help requirements. Its task 7.5 is on #108. | This delta MODIFIES only "Routing between AskBoard and AskUserQuestion" (on main) and ADDS four requirements of new names, so the two archive in either order. |
| `diagram-widget`, `graph-widget`, `diff-review`, `image-annotation`, `spreadsheet-widget` (proposals on their branches) | Each adds one link to `askboard`'s `SKILL.md` (about 50 characters), one line to `references/items.md` (about 130) and one link to `askboard-help`'s `SKILL.md`. Their names are not on `main`. | Budgets after this change, with all five: `SKILL.md` about 8,655 of 9,000, `items.md` about 5,400 of 6,000. `askboard-help`'s `SKILL.md` would reach about 6,210 of 6,000: that collision is between those changes and `keyboard-shortcuts-help`; this change shrinks the file by 15 characters, and the collision is reported to the coordinator. The description names none of their types (`diagram`, `graph`, `diff-review`, `image-annotation`, `spreadsheet`), so their "names no widget" check stays green. `payoff.ts` names only types on `main`. Each of them may add its type to an entry at its rebase (decision 6). |
| `kanban-order` (parked, branch ahead of `main`) | `prd.md` (the `updated:` line and the widget table's Kanban row) and the generated `skills/askboard/` files | It does not touch FR-29, §1 or §4.8. The generated files are resolved by `bun run build:skills` at whichever rebase comes second. |
| `early-benchmark` (18/22) | The benchmark measures the always-loaded cost | No code overlap. Its next run sees the larger texts (Risks). |

**Borrowed seams**, all on `main` e76d468c. Task 0.2 finds each with `git grep`:

- `APPROVED_TEXT_AMENDMENTS`, `amendedApprovedText`, `SERVER_INSTRUCTIONS`, `TOOL_DEFINITIONS`, `ASKING_RULE_TEXTS`;
- `catalogueText`, `itemIndex`, `CONTEXT_TEACHING`, `contextTypes`, `READY_MOLECULES`, `MOLECULE_SKILLS`, `WIDGET_TYPES`;
- `exampleBlock`, `taggedBlocks`, `generateSkill`, `generateHelpSkill`, `parseFrontmatter`, `BUDGETS`, `HELP_BUDGETS`.

No versioned set moves, so `askboard-contract-versioning` binds nothing here.

## Goals / Non-Goals

**Goals:**

- Every agent-facing text that routes states the PO's criterion in one wording family, and none routes by a count.
- The texts every session loads in full tell the agent to load the skill before its first `ask`.
- The skill's description triggers on the situations that call for the board.
- Within every budget, leaving room for the widgets in flight.

**Non-Goals** (each comes back if the trigger eval or the live check of task 4.3 still fails after this change):

- `alwaysLoad` for `ask` (#132). It would put `ask`'s definition in every session ahead of tool search, and it is a configuration question of its own.
- A SessionStart hook that injects the routing. It needs a new AD beside AD-16, which says the hooks enforce asking rules, not routing. It also adds a process start to every session.
- PRD R5's records and the benchmark figures (#154).
- No new asking rule, no change to the hook's predicate (AD-16), no change to the board.

## Decisions

### 1. One criterion, one wording family

Every routing text says three things in the same terms:

- choose by how hard the question is to grasp and to answer, not by how many questions or options it has;
- the cases, given as examples: many questions that depend on one another; questions that cite documents by bare IDs (D-01, FR-12, ADR-7); content that reads better seen and worked on, as a visual artifact (a plan, a WBS or a Gantt, a chart, a table, a UML diagram or a state machine, a formula, a document to review);
- the agent judges whether a visual, interactive board helps, and a simple, self-explanatory choice stays with AskUserQuestion.

The asking rule and the user's instruction come first, as before. No count survives anywhere: "more than four", "several questions" and "one quick choice" go.

*Alternative:* keep a count as a floor, such as "more than four questions always go to the board". Rejected by the PO's decision: a count was the cause of the contradiction, and the criterion is the question's complexity.

### 2. The server instructions carry the routing and the skill line

They are the one text every session loads in full, so they are the primary lever (#155, cause 1). Two amendments are appended to `APPROVED_TEXT_AMENDMENTS`, change `skill-engagement`, dated with the PO's approval (task 0.1):

- **A1**, target `server-instructions.md`. It replaces the routing paragraph:

  > Use it for questions AskUserQuestion carries badly: more than four at once, or a question that needs a diff, a plan, a tree, a table, a graph, a diagram, an image, or a file excerpt beside it. For one quick choice AskUserQuestion is fine, unless the user's asking rule says otherwise.

  with:

  > Use it when a question is hard to grasp or to answer in a terminal dialog, whatever the number of questions or options: questions that are many and depend on one another; questions that cite documents by bare IDs (D-01, FR-12, ADR-7) the user would have to look up; content that reads better seen and worked on, such as a plan, a WBS or a Gantt, a chart, a table, a diagram or a state machine, a formula, or a document to review. These are examples: judge whether a visual, interactive board helps the user decide. A simple, self-explanatory choice stays in AskUserQuestion. The user's asking rule, or the user's own instruction about how to ask, decides first.

- **A2**, target `server-instructions.md`. It replaces `- Put everything you need in one \`ask\`, then keep working.` with three lines:

  > - Load the askboard skill (as a plugin skill, `askboard:askboard`) before your first `ask`: it says how to build each item.
  > - Never put a complex question to the user in chat prose: ask it on the board.
  > - Put everything you need in one `ask`, then keep working.

The skill line names the skill and its plugin form, so it holds in Claude Code and stays readable to another harness (the Codex port, #134). It never names `snapshot` (`tool-envelopes.test.ts:187`).

The served text grows from 1,550 to about 2,130 of 4,096 characters. The comment at `server-instructions.ts:1-4` still says the instructions name "the four AskBoard lists". It is corrected: they name four of the five tools and leave out `snapshot`, and it names this change's amendments.

*Alternative:* edit the fixture copy. Rejected: the contract spec keeps the copies equal to the archive, and the record is the one place a served text differs.

### 3. The `ask` description points to the skill

**A3**, target `tools.json#ask.description`. It replaces "The askboard skill lists every item type and its props." with:

> Load the askboard skill before your first ask: it says when to ask here rather than with AskUserQuestion, and lists every item type and its props.

The description grows from 718 to about 810 characters. When `ask` is deferred the agent does not see this line before a tool search (needs probe). It is the second lever, for sessions that load the definitions.

### 4. The skill's description: criterion first, triggers, no precondition

Draft (496 characters; it names no registered or in-flight widget type, checked against `WIDGET_TYPES` and the five names in flight):

> Use to ask the user something complex on a visual, interactive board: many interdependent decisions, choices that cite documents by bare IDs (D-01, FR-12, ADR-7), or content better seen and worked on, such as a plan, a WBS, a schedule, UML or a state machine, a formula, or a document to review. Load it before you ask the user to decide or review something complex, in chat or with AskUserQuestion, and when the user asks for AskBoard. A simple, self-explanatory choice stays in AskUserQuestion.

- The first 150 characters carry the criterion, since a listing may cut descriptions short.
- The "tools are available" condition goes: the agent cannot check it while the tools are deferred.
- The summary of the body goes.
- The frontmatter keeps `name` and `description` only ("The shipped skill"; `ASKBOARD_SKILL.frontmatter` in `budgets.ts`), with no `when_to_use`.
- The description test forbids any widget type as a substring, which rules out words such as "table", "chart", "Gantt", "context" (`text`), "browser" (`row`) and "diagram" (in flight). So the description says "schedule" and "UML", and the body names the widgets.

The coordinator tunes the wording before apply with a trigger eval: five queries, baseline at task 0.4, a second run at task 2.6. It runs from the session scratchpad and is not committed. The final wording must keep the spec's rules ("The asking skill's description says when to load it"). Task 0.1 records it, and group 2 writes it.

### 5. "Which tool asks" in the skill body

Rewritten on decision 1, about 1,000 characters (now 499):

```markdown
## Which tool asks

AskBoard sits beside AskUserQuestion. Choose by how hard the question is to grasp and to answer, not by how many questions or options it has.

- Use AskBoard (`ask`) when seeing the question and working on it helps the user decide: many questions that depend on one another; questions that cite documents by bare IDs (D-01, FR-12, ADR-7), which the user would have to look up; content that reads better as a visual artifact, such as a plan, a WBS or a Gantt, a chart, a table, a UML diagram or a state machine, a formula, or a document to review.
- These cases are examples, not a list: judge whether a visual, interactive board helps. On the board the user sees the context beside the question, works on it and asks you follow-ups while you keep working.
- Use AskUserQuestion for a simple, self-explanatory choice, such as a yes or no.
- Never put a complex question to the user in chat prose: ask it on the board.
- A subagent cannot use AskUserQuestion: it asks every question through AskBoard.
- An asking rule, when one is in effect, overrides these choices. So does an instruction from the user about how to ask.
```

The last two lines and the asking-rule section are unchanged ("Asking-rule texts from the contract", "Asking from the agent that needs the answers").

### 6. "By what the user has to do": generated, in the catalogue

The mapping goes in `references/items.md`, not in `SKILL.md`:

- **Budget.** In `SKILL.md` it would cost about 600 characters, which would take the file to about 9,250 with the five widget links in flight.
- **Timing.** The agent reads the mapping when it chooses items, after it has chosen the board, and that is the catalogue's job ("what each type is for, to choose among them").
- **Routing.** The routing section keeps the PO's list of cases.

`SKILL.md`'s first index line becomes "What each type is for, the types by what the user has to do, and a complete ask: [items](references/items.md)".

A new module, `tools/build/skills/payoff.ts`, holds `PAYOFF`. It is a list of entries `{goal, types, fallback?}`. `catalogueText` renders the entries under the catalogue's intro, before "Context items":

```markdown
## By what the user has to do

Examples, not a list: any item that helps the user grasp the question fits.

- Choose among options that cite documents, one beside the question for each: `excerpt`, `reference`
- Review or re-estimate a plan: `wbs-pert`, `gantt-plan`, `tree`, `gantt`
- Prioritise or triage: `ranking`, `kanban`
- Check figures or dates: `table`, `chart`, `timeline`
- Review a document: `document-review`
- Check a formula: `latex`
- Approve or rate a proposal: `approval`, `scale`
- Judge a UML diagram or a state machine: an `image` of the rendered file, or an `excerpt` of its source
```

- **Known types.** A type is written only when it is a context type, a registered widget type (`widgets` input) or a ready molecule (`molecules` input). An entry left with no known type writes its fallback, or nothing when it has none.
- **Typos.** A test holds every type `PAYOFF` names to the shipped registry, so a misspelt name fails a test instead of being dropped without a word.
- **Types in flight.** `PAYOFF` names only types on `main`. A widget change in flight adds its own type at its rebase, for example `diagram` or `graph` to the last entry, which then drops its fallback. That is a one-line data edit, and no template is touched.

*Alternative:* static text in `SKILL.md`. Rejected for the budget, and because static text cannot keep unregistered names out.

### 7. A complete ask, generated, at the end of the catalogue

`payoff.ts` also holds `COMPLETE_ASK_EXAMPLE`. `catalogueText` writes it through `exampleBlock` under "## A complete ask", after the molecules, with one line: "One question that cites a decision by ID, with the decision beside it:". `generateSkill` reports it among its examples for `references/items.md`, so the "every tagged block is an example" test and `packages/server/test/skills-examples.test.ts` validate it. The example:

```json
{"askId": "order-store-q7v4", "language": "en-US", "items": [{"type": "question", "id": "store", "props": {
  "header": "Storage", "text": "Which store should the order service use under D-03?",
  "options": [{"label": "PostgreSQL", "description": "Meets D-03's retention with partitions", "recommended": true},
              {"label": "SQLite", "description": "One file; retention by a nightly job"}],
  "items": [{"type": "excerpt", "id": "d-03", "props": {"pointer": "docs/decisions.md#D-03", "title": "D-03: data retention"}}]}}]}
```

It adds about 920 characters pretty-printed. An unresolved pointer is a warning, not an error, as for the context reference's own examples.

*Alternative:* the example in `SKILL.md`. Rejected for the budget, as in decision 6.

### 8. The `none` asking-rule text

`ASKING_RULE_TEXTS.none` becomes "No question is taken from AskUserQuestion: the agent chooses where each question goes, by how complex it is to grasp." It is one line in `contract` and reaches `SKILL.md` through the generator. The hook is untouched, since `none` has no predicate.

### 9. The help skill's description

> Use when the user asks in the terminal how to use the AskBoard board: what a widget does, how to edit it, its keyboard shortcuts, what Answer, Postpone, Decline, Submit or a Snapshot do, or how to change, rebind or remap a key. A question asked as a follow-up on the board is not for this skill.

It is 295 characters (now 310), and its `SKILL.md` goes from 5,977 to 5,962. The sentence "It never asks anything on a board." goes. The body's Rules already say "Never call AskBoard's tools … and never open a board", and `disallowed-tools` enforces it. The phrases `help.test.ts:110-111` pins stay.

### 10. Documents

- **PRD FR-29.** The first consequence becomes: "The shipped skills define which questions go to AskBoard and which to AskUserQuestion by the question's cognitive and contextual complexity, not by a count of questions or options. Their cases are given as examples: many interconnected questions; questions that cite documentation by bare IDs; content that reads better as a visual artifact (a WBS, a Gantt, a chart, UML or a state machine, a LaTeX formula, a table, a document to review). The agent judges whether a visual, interactive board helps, and a simple, self-explanatory choice goes to AskUserQuestion."
- **The second FR-29 consequence** stays testable as a set of cases, run by the live check (#108 `askboard-skills` 4.1, reworded in task 3.4) and the trigger eval:
  - a decision of interconnected questions, or one citing documents by bare IDs, loads the skill and goes to AskBoard;
  - a plan or a diagram to review goes to AskBoard;
  - a simple, self-explanatory choice goes to AskUserQuestion.
- **A new FR-29 consequence:** the server instructions and the `ask` description state the criterion or point to the skill, and tell the agent to load the skill before its first ask. The routing then holds when the skill listing shows only the skill's name.
- **FR-30** says the agent chooses "by FR-29's criterion".
- **§1** gains two sentences after "AskBoard exists to lower the cognitive complexity…". They say the agent sends a question to AskBoard by that complexity, not by a count, give the cases as examples, and say a simple, self-explanatory choice stays with AskUserQuestion.
- **§4.8's introduction** says "by its cognitive and contextual complexity (FR-29)".
- **The PRD's `updated:` line** takes the date. R5 and the non-goals are unchanged.
- **README.** A "When to use it" section after "Why AskBoard". It has "Use AskBoard when" (the three cases, with one example each), "Stay with AskUserQuestion when" (a simple, self-explanatory choice), and one line that the agent judges and that an asking rule overrides.
- **The as-built note** `docs/as-built/skill-engagement.md`. No earlier note states the old routing (`git grep` found none), so it corrects none.

## Risks / Trade-offs

- **The always-loaded total.** It rises from 6,733 to about 7,545 of 8,400 characters: instructions +580, `ask` +91, description +154, help −15. That is about 200 more tokens in every session, against R5's +25% plain-question target. → The total stays under the 8,400 line, which `check:skills` enforces. It leaves about 855 characters for later texts. The benchmark's next run (early-benchmark, #154) records the cost.
- **Judgement-based routing cannot be tested in CI.** → The static tests pin the texts, and behaviour is checked by the trigger eval (tasks 0.4 and 2.6) and the live check (task 4.3), both recorded. If either fails, the deferred levers (#132, a hook with its AD) come back.
- **Over-routing:** the board for a simple choice. → Every text says a simple, self-explanatory choice stays with AskUserQuestion, and the live check includes that case.
- **The skill name in Claude Code is a guess.** → It needs probe (task 0.3), and A2 names both forms.
- **Budgets with the widgets in flight.** About 345 characters are left in `SKILL.md` and about 600 in `items.md`. `askboard-help`'s `SKILL.md` overflows with the five widget links whatever this change does. → Reported to the coordinator for an Issue on those changes.
- **Instructions that the agent ignores.** An agent may still call AskUserQuestion before it reads the routing. → Not addressable without a hook, which is deferred.

## Migration Plan

No data or configuration migrates. A user gets the new texts with the next plugin version. Rollback is reverting the change, since the amendment record makes the served texts follow.

## Open Questions

PO questions, each with its default. Task 0.1 records the answers, and an answer other than the default goes through `/opsx:update`.

1. **Approve A1 and A2, the server instructions (approved text).** Default: as worded in decision 2.
2. **Approve A3, the `ask` description (approved text).** Default: as worded in decision 3.
3. **Where the user-goal mapping and the complete ask go.** Default: `references/items.md` (decisions 6 and 7), for the budget. The alternative is `SKILL.md`, dropping the mapping to five lines and the example to its compact form, at about 8,900 of 9,000 with the widgets in flight.
4. **Fold #122 into this change** (the mcp-adapter requirement "Approved texts unchanged"). Default: yes, since this change adds amendments to the same texts.
5. **The `none` text** (decision 8). Default: yes.
