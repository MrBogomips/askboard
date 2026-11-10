# Tasks

Each task writes its tests first and sees them fail for the right reason before it implements (the repository's TDD rule). Commit bodies and task notes say `Refs #155` (and `Refs #122` for task 1.1's spec wording).

Terms used below:

- "The check": `GITHUB_TOKEN=$(gh auth token) bun run check`.
- "Coverage": at least 80% of lines and functions for every source file the task changes, read from `bun test --coverage`'s per-file table.
- "The figures": the lines of `bun run check:skills` for `askboard`'s description, `SKILL.md` (characters and lines), `references/items.md`, the always-loaded total, and `askboard-help`'s description and `SKILL.md`.

Order: group 0, then group 1, then group 2: group 2 regenerates `skills/` after group 1 has changed the `none` text and the always-loaded texts. Tasks 3.1 to 3.3 may run in parallel with groups 1 and 2, in a separate session; their files (`docs/prd-askboard-2026-10-25/prd.md`, `README.md`) are disjoint from those groups'. Task 3.4 waits for groups 1 and 2. Group 4 runs last.

## 0. Base

- [x] 0.1 PO decisions (design.md, Open Questions 1 to 5). Tests: none.
  - Record each answer under this task, with its date and its source (a comment on #155). The date of A1 to A3's approval is the `approved` field of their amendments (tasks 1.1 and 1.2).
  - Record the `askboard` description the coordinator settled after the trigger eval (task 0.4). It must keep the rules of the skills requirement "The asking skill's description says when to load it".
  - Verify: five answers and the final description recorded. An answer other than the default stops the work for `/opsx:update` before group 1. If question 4 is declined, the mcp-adapter MODIFIED requirement leaves this change, and `Issue: #122` leaves the proposal.
  - As built (2026-11-10, #155 comment 6775174245): the PO delegated the five decisions to the coordinator ("Rispondi tu per me e chiudi tutto"). Every question takes its default:
    1. A1 and A2 are approved as worded.
    2. A3 is approved as worded.
    3. The mapping and the complete ask go in `items.md`.
    4. #122 is folded in.
    5. The `none` text changes as decision 8 gives it.

    The approval date of A1 to A3 is 2026-11-10. The final description is design.md's draft, 496 characters, unchanged.
- [ ] 0.2 Names, heads and baseline (design.md, Context: merge points and borrowed seams). Tests: none.
  - Find with `git grep -n` on `origin/main` every name in design.md's "Borrowed seams" list, and record each with its file and line.
  - Record the head of each branch in the merge-point table, and whether it moved since e76d468c. Record whether `keyboard-shortcuts-help` has been archived, and whether any of the five widget changes has merged; a merged one moves the budget figures.
  - Record the figures, and the pass counts of `bun test` for `packages/contract`, `packages/server/test/mcp-tools` and `tools/build/skills`.
  - Verify: the note lists every name, head and figure. If a name or shape differs, or a name is not on `main`, stop and run `/opsx:update` before group 1.
- [x] 0.3 What Claude Code does (design.md, Context, the four "needs probe" items). Tests: none.
  - As built (2026-11-10), from Claude Code's documentation, read through `claude-code-guide`, and from the eval runs:
    - **Descriptions dropped.** Documented in skills.md, "Skill descriptions are cut short": "When the listing overflows, Claude Code drops descriptions starting with the skills you invoke least". The budget is 1% of the context window. Plugin skills are not affected by `skillOverrides`.
    - **Server instructions.** Documented in mcp.md, "Scale with MCP tool search": "Only tool names and server instructions load at session start". Server instructions are cut at 4,096 characters.
    - **Skill name.** The command form `/askboard:askboard` is documented in plugins/components.md. The Skill tool's string `askboard:askboard` is not documented, but every eval run invoked it under that name, and the listing shows it as such.
    - **Deferred tools.** Only the names load before a tool search (the same mcp.md sentence). The eval runs saw the AskBoard tools as deferred, by name only.
    - **Extra lever, not used here.** A server can set `"anthropic/alwaysLoad": true` in a tool's `_meta` (mcp.md, "Mark a tool to load upfront"), which bears on #132.

    None of these contradicts decisions 2, 3 or 4.
  - Check each item against Claude Code's documentation through `claude-code-guide`, recording the page and the sentence:
    - descriptions dropped from an overflowing listing, least-invoked first;
    - server instructions loaded in full with deferred tools, and their cap;
    - the plugin skill's listed and invoked name;
    - deferred tools' descriptions unseen before a tool search.
  - Verify: each item is recorded as documented (with the quote) or not documented. An item that contradicts a decision (2, 3 or 4) stops the work for `/opsx:update`. An undocumented item stays for the live check (task 4.3).
- [x] 0.4 Trigger eval, baseline (coordinator; design.md, decision 4). Tests: none (an eval, run from the session scratchpad and not committed).
  - Run the five queries against the current description and record, for each, whether the skill triggered and which tool asked.
  - Suggested queries, which the coordinator may replace:
    - a decision on D-01 to D-04 cited by ID;
    - a WBS with estimates to review;
    - "commit now, yes or no?", which must stay with AskUserQuestion;
    - a state machine to check before a change;
    - "ask me on AskBoard which README fix to apply".
  - Verify: the five outcomes are recorded under this task, with the description run.
  - As built (2026-11-10; #155 comment 6774897578 has the method and the table).
    - **Setup.** The coordinator replaced the suggested queries with these five:
      1. three interconnected ADR decisions cited by ID (IT);
      2. a WBS with three-point estimates to sign off;
      3. a pricing formula to verify (IT);
      4. an 11-state state machine to review;
      5. a rename and a yes/no question (IT), the near miss.

      Each ran 3 times with `claude -p` on Opus 5.5, with AskUserQuestion made available through the bench permission host and the plugin 0.1.0 loaded with `--plugin-dir`.
    - **Results.** Board first on queries 1 to 4:
      - 6 of 12 with every description dropped (`SLASH_COMMAND_TOOL_CHAR_BUDGET=1`);
      - 7 of 12 with the description shown.

      Query 1 went to AskUserQuestion in 3 of 3 runs with the description dropped. The near miss never went to the board, but with the description shown it loaded the skill once.
    - **Candidate texts.** A1 to A3 and the draft description, patched into a copy of 0.1.0. The run was stopped after 9 of 30 runs. In those runs query 1 went to the board first in 2 of 3 runs with the description dropped.

## 1. Contract: the amendments and the `none` text

- [ ] 1.1 Server instructions, A1 and A2 (mcp-adapter spec, "The server instructions route by complexity" and "Approved texts unchanged"; design.md, decision 2). Refs #155, #122.
  - Tests first, in `packages/contract/test/approved-amendments.test.ts`, "the approved wording":
    - the routing paragraph names "depend on one another", "bare IDs", "a document to review", "These are examples" and "self-explanatory", and holds neither "more than four" nor "one quick choice";
    - one line says "Load the askboard skill" and "before your first `ask`";
    - one line says "Never put a complex question to the user in chat prose".
  - The existing tests stay as they are and must pass: served = archive + record, no inert entry, the fixture copies equal the archive, `tool-envelopes.test.ts:178-189` (no `snapshot`), and `server/test/mcp-tools/list.test.ts:40,92-99` (at most 4,096).
  - Append A1 and A2 to `APPROVED_TEXT_AMENDMENTS`, with change `skill-engagement`, target `server-instructions.md` and the date from task 0.1, worded as task 0.1 records. Set `SERVER_INSTRUCTIONS` to the result. Correct the comment at `server-instructions.ts:1-4`: four of the five tools, `snapshot` left out, and this change's amendments named.
  - Leave `packages/contract/test/fixtures/` and the archive untouched.
  - Verify: `bun test packages/contract packages/server/test/mcp-tools packages/bench` passes; `git diff --stat` shows no file under `packages/contract/test/fixtures/` or `openspec/changes/archive/`; the served text's length is recorded.
- [ ] 1.2 `ask` description, A3 (mcp-adapter spec, "The ask description points to the skill"; design.md, decision 3).
  - Tests first, in `approved-amendments.test.ts`, "the approved wording": `ask`'s description holds "Load the askboard skill before your first ask" and still "lists every item type and its props".
  - Append A3 to the record (target `tools.json#ask.description`). Change only that description in `packages/contract/src/schemas/tool-envelopes/tools.json`; every input schema and annotation stays byte-identical.
  - Verify: the contract and `mcp-tools` tests pass, and `git diff` of `tools.json` shows one changed line, the `ask` description.
- [ ] 1.3 The `none` text (contract spec, "Asking-rule texts", scenario "The none text"; design.md, decision 8).
  - Tests first, in `packages/contract/test/asking-rule-texts.test.ts`: the `none` text holds "No question is taken from AskUserQuestion" and "how complex it is".
  - Change `ASKING_RULE_TEXTS.none`.
  - Verify: `bun test packages/contract` passes, and the existing tests of the set (one text per rule, single line, frozen, distinct) still pass.
- [ ] 1.4 Review checkpoint, group 1.
  - A spec review (`askboard-spec-reviewer`) of the group's range against the mcp-adapter and contract deltas and decisions 2, 3 and 8.
  - A security review (`askboard-security-reviewer`), since the group touches a file under the contract's schemas (`tools.json`): no input schema, annotation or validator changes, and no served text invites agent content to run.
  - Fixes go in tests first.
  - Verify: both reports are recorded under this task with no open finding of M or above; the check passes.

## 2. The skill generator

- [ ] 2.1 "Which tool asks" (skills spec, "Routing between AskBoard and AskUserQuestion"; design.md, decision 5).
  - Tests first: replace the "SKILL.md routing" block of `tools/build/skills/generate.test.ts` (lines 99-117) with one test per scenario:
    - **The routing section:** "how hard the question is to grasp", "depend on one another", "bare IDs", "visual artifact", "examples", "judge", "simple, self-explanatory choice", the subagent line verbatim, "asking rule", "overrides".
    - **No count:** the section between "## Which tool asks" and the next heading holds neither "more than four" nor "several questions".
    - **Why the board:** "sees the context beside the question", "follow-ups", "while you keep working".
    - **Not in chat prose:** "Never put a complex question to the user in chat prose".
  - Rewrite the section of `tools/build/skills/templates/SKILL.md` as decision 5 gives it.
  - Verify: `bun test tools/build/skills` passes, and the asking-rule, ownership and help-pointer tests are unchanged and green.
- [ ] 2.2 The `askboard` description (skills spec, "The asking skill's description says when to load it"; design.md, decision 4).
  - Tests first, in the "SKILL.md frontmatter" block of `generate.test.ts`:
    - at most 600 characters;
    - the first 150 characters hold "complex" and "visual, interactive board";
    - it holds "AskUserQuestion", "AskBoard" and "before you ask";
    - it holds no "are available";
    - the existing no-widget-type test is kept.
  - Write the description that task 0.1 records into the template's frontmatter.
  - Verify: `bun test tools/build/skills` passes, and the description's length is recorded.
- [ ] 2.3 "By what the user has to do" (skills spec, "Item types by what the user has to do"; design.md, decision 6).
  - Tests first, in a new `tools/build/skills/payoff.test.ts`:
    - every type `PAYOFF` names is a context type, a registered type of `WIDGET_TYPES` or a ready molecule, which catches typos;
    - the rendered section says "Examples, not a list";
    - with a registry without `kanban`, the triage entry names `ranking` alone;
    - with a test-made entry whose only type is unregistered and which has a fallback, the fallback is written; without a fallback, the line is absent;
    - the diagram entry writes "an `image` of the rendered file, or an `excerpt` of its source".
  - In `generate.test.ts`, "the item index":
    - the catalogue holds "## By what the user has to do" before "## Context items";
    - every backticked name in that section is known;
    - `SKILL.md`'s index line says "the types by what the user has to do, and a complete ask".
    - The ordering test of context types, widgets and molecules still passes.
  - Add `tools/build/skills/payoff.ts` (`PAYOFF` and a renderer). `catalogueText` writes the section, and `itemIndex` changes its first line.
  - Verify: `bun test tools/build/skills` passes; coverage of `payoff.ts` and `catalogue.ts`.
- [ ] 2.4 A complete ask (skills spec, "A complete ask in the catalogue"; design.md, decision 7).
  - Tests first, in `generate.test.ts`: the last tagged block of `references/items.md` is a `json ask` with `askId`, `language` and one question holding an `excerpt` and options with exactly one `recommended`; and `examples` holds it with file `references/items.md`. The "hold every tagged block as one of the examples, in order" test stays green.
  - Add `COMPLETE_ASK_EXAMPLE` to `payoff.ts`. Write it under "## A complete ask" in `catalogueText` through `exampleBlock`, and report it from `generateSkill`.
  - Verify: `bun test tools/build/skills` passes; after `bun run build:skills`, `bun test packages/server/test/skills-examples.test.ts` passes and its count of `json ask` blocks rose by one.
- [ ] 2.5 The help description (skills spec, "The help skill's description names its triggers"; design.md, decision 9).
  - Tests first, in `tools/build/skills/help.test.ts` (the frontmatter test at lines 103-117): the description holds "keyboard shortcuts", "rebind" and "remap", still holds "asks in the terminal" and "follow-up on the board is not for this skill", is at most 400 characters, and holds no "It never asks anything on a board".
  - Change `templates/help/SKILL.md:3`.
  - Verify: `bun test tools/build/skills` passes, and `askboard-help`'s `SKILL.md` is no longer than 5,977 characters.
- [ ] 2.6 Regenerate and measure.
  - Run `bun run build:skills` and commit `skills/askboard/` and `skills/askboard-help/`.
  - Record the figures, and the margins left for the five widgets in flight: `SKILL.md` at most about 8,450, `items.md` at most about 4,800, the always-loaded total at most about 7,600 (design.md, Risks).
  - The coordinator runs the trigger eval's second iteration on the shipped description and records it beside task 0.4's baseline.
  - Verify: `bun run check:skills` reports no drift and every figure within budget; the eval's five outcomes are recorded. A query that still fails stays a finding for task 4.3, not a stop.
- [ ] 2.7 Review checkpoint, group 2.
  - A spec review of the group's range against the skills delta and decisions 4 to 7 and 9, including that no generated file names an AI tool or vendor (`generate.test.ts`, "name no AI tool or vendor").
  - No security review: the group touches only the generator and its generated Markdown.
  - Verify: the report is recorded with no open finding of M or above; the check passes.

## 3. Documents

- [ ] 3.1 PRD (design.md, decision 10; FR-29, FR-30, §1, §4.8).
  - In `docs/prd-askboard-2026-10-25/prd.md`:
    - reword FR-29's first and second consequences and add the new third one as decision 10 gives them;
    - add "by FR-29's criterion" to FR-30's description;
    - add the two sentences to §1 after "AskBoard exists to lower the cognitive complexity…";
    - reword §4.8's introduction;
    - set `updated:` to the day.
  - Leave R5, the non-goals and every other FR as they are.
  - Tests: none (a document).
  - Verify:
    - `grep -n "more than four" docs/prd-askboard-2026-10-25/prd.md` finds nothing;
    - FR-29 names "cognitive and contextual complexity" and says its cases are examples;
    - `git diff` touches only FR-29, FR-30, §1, §4.8 and the front matter.
- [ ] 3.2 README "When to use it" (design.md, decision 10).
  - Add the section after "Why AskBoard", with three parts:
    - "Use AskBoard when": the three cases, one example each;
    - "Stay with AskUserQuestion when": a simple, self-explanatory choice;
    - one line that the agent judges and that an asking rule overrides.
  - Change the "How it works" sentence on the skill ("It teaches the agent when to ask through AskBoard rather than AskUserQuestion") only if it contradicts the new section.
  - Tests: none.
  - Verify: the section exists, names no count of questions or options, and says AskBoard sits beside AskUserQuestion.
- [ ] 3.3 #108's live check reworded (coordinator).
  - Write a comment on #108 replacing the cases of `askboard-skills` 4.1 with the criterion's:
    - a simple, self-explanatory choice goes to AskUserQuestion;
    - a decision of interconnected questions citing documents by bare IDs loads the `askboard` skill first and goes to AskBoard in one ask;
    - a plan or a state machine to review goes to AskBoard;
    - the subagent and `CI=1` cases and the benchmark run, unchanged.
  - Note that "a question pointing to `README.md#Install` goes to AskBoard" no longer holds by itself (the `with-references` rule still sends it).
  - Tests: none.
  - Verify: the comment's link is recorded under this task.
- [ ] 3.4 As-built note (after groups 1 and 2). Write `docs/as-built/skill-engagement.md`, about five lines, with no status:
  - the amendments A1 to A3 in `APPROVED_TEXT_AMENDMENTS`;
  - the `none` text;
  - `payoff.ts` (`PAYOFF`, `COMPLETE_ASK_EXAMPLE`) and the catalogue's two sections;
  - the descriptions;
  - the figures, and that no versioned set moved;
  - the deviations from design.md, if any.
  - Tests: none.
  - Verify: the note names every file this change added, and `git grep -n "more than four" -- ':!openspec/changes/archive'` finds nothing outside this change's own artifacts.
- [ ] 3.5 Review checkpoint, group 3.
  - A spec review of the group's range: the PRD and README against the specs and decision 10, the as-built note against the code, and #108's comment against the scenarios.
  - Verify: the report is recorded with no open finding of M or above.

## 4. Integration

- [ ] 4.1 The whole check.
  - Run `bun run build:skills`, then the check.
  - No browser or conformance run: the change touches no view, server unit or conformance file, and the served instructions are read through `SERVER_INSTRUCTIONS`, which `list.test.ts` covers.
  - Verify: the check passes, with the test counts recorded against task 0.2's.
- [ ] 4.2 Pre-PR review.
  - A spec review and a security review of the whole range (`askboard-delivery`, pull request step). Then the rebase on `origin/main`: re-check task 0.2's merge points, rerun `bun run build:skills`, and rerun the check.
  - Verify: both reports are recorded with no open finding of M or above. The figures after the rebase are recorded. If a widget change merged first, the description test still sees none of its types.
- [ ] 4.3 Live check, left to the PO (#108, `askboard-skills` 4.1 as reworded in task 3.3).
  - After `bun run build`, in a scratch project with no asking rule, run `claude --plugin-dir <worktree>` and go through the cases.
  - Record whether the agent loaded `askboard:askboard` before its first `ask`, and the listed skill name.
  - Tests: none (live).
  - Verify: the outcome is recorded on #108. The task is ticked by the PO's recorded outcome and does not block the pull request. A failing case reopens the deferred levers (design.md, Non-Goals) as an Issue.

## Workflow follow-up

- Archive after the pull request (`Closes #155`, `Closes #122`) is merged; the archive pull request says `Refs #155`.
