# Tasks

Each task writes its tests first and sees them fail for the right reason before it implements (the repository's TDD rule).

Terms used below:

- "The check": `GITHUB_TOKEN=$(gh auth token) bun run check`.
- "Coverage": at least 80% of lines and functions for every source file the task changes, read from `bun test --coverage`'s per-file table.
- "Conformance": `bun packages/server/test/conformance/run.ts` on Bun and with `--runtime node`, after `bun run build`.

Order: group 0, then group 1. Groups 2 and 3 may then run in parallel, in separate sessions: their files are disjoint, apart from `CHANGELOG.md`, which only group 4 edits. Group 4 runs last.

## 0. Base

- [x] 0.1 Names, versions and baseline (askboard-contract-versioning, Rule 3; design.md, Merge points and decision 5). Tests: none.
  - Check with `git grep -n` on `origin/main` every name in design.md's "Borrowed" list, and record each with its file and line.
  - Record every `*_VERSION` and `*_FORMAT` constant of `packages/contract/src`. The tool envelopes start at main's minor plus one in task 1.1; every other set stays at main's.
  - Record the head of each branch in Merge points, and whether it moved; whether `document-review` or `keyboard-shortcuts-help` has merged; and, if `wbs-gantt-consistency` has a design by then, whether it touches the skill generator, the tool texts or the tool envelopes.
  - Record `bun run check:skills`' figures (SKILL.md, answers.md, the always-loaded total) and the pass counts of `bun test` for `packages/contract`, `packages/server` and `tools/build/skills`.
  - Verify: the note lists every name, version, head and figure. If a name, signature or shape differs, or a name is not on `main`, stop and run `/opsx:update` before group 1.
  - Note (2026-11-08, `origin/main` be308421, merged into the branch as 6004e1be; Refs #73, #75): every borrowed name is on main and matches the design. server: `notHeld` fetch.ts:26, `handleFetch` :106, `uncheckedMark` owner-refusal.ts:61, `jsonResult` results.ts:16, `errorResult` :24. contract: `FetchOutcomeResult` tool-envelopes/index.ts:273 (`outcome: "discarded"` only), `RESULT_VERSIONS` :113, `TOOL_DEFINITIONS` :69, `TOOL_ENVELOPES_VERSION` :49, `SERVER_INSTRUCTIONS` server-instructions.ts:5, `validateUpdateRequest` update-request.ts:151. core: `fullValue` kind `deleted` ask.ts:65 and :381. tools: `generateSkill` generate.ts:114, `SkillInputs` :37, `fill` :53 (module-local), `Templates` templates.ts:8, `DISK_TEMPLATES` :14, `EXAMPLE_KINDS` blocks.ts:5, `ExampleBody` :10, `exampleBlock` :15, `contractSchemaResolver` fields.ts:36, `budgetReport` budgets.ts:72, `BUDGETS` :8.
  - Versions on main: input 1.12, output 1.11, tool envelopes 1.12, board document 1.11, board protocol 1.8, Snapshot data 1.2 (snapshot-toolbar's), view manifest 1.1, configuration 1.0, local API 1.0, session file 1.0, molecule format 1.0.0. Only the envelopes move (task 1.1, to 1.13).
  - Merge points (heads at 2026-11-08): `document-review` worktree-feature-document-review 70eb893e (local branch, no origin branch; 67 commits past main; binds input 1.13, output 1.12, tool envelopes 1.13, board document 1.12; edits skills/askboard, not the generator or tool texts); `reopen-start-from-answer` b8a8308c (unchanged; artifacts only); `wbs-gantt-consistency` 5f68e2a3 (PR #106, moved from 8e2e1247; decision 5 "Versions: none"; touches no generator, tool text or envelopes file); `keyboard-shortcuts-help` 101a9498 (unchanged); `snapshot-toolbar` merged (#94). Neither `document-review` nor `keyboard-shortcuts-help` has merged.
  - Baseline: `check:skills` SKILL.md 6,257 of 9,000 characters and 69 of 250 lines, answers.md 2,047, items.md 3,105, always-loaded total 6,152 of 8,400. `bun test`: packages/contract 3568 pass 0 fail; packages/server 1264 pass 3 skip 0 fail; tools/build/skills 142 pass 0 fail. No mismatch.
- [x] 0.2 PO decisions (proposal.md, open questions 1 to 5). Tests: none.
  - Record each answer under this task, with its date. The date of each approved text is the `approved` field of its amendment (task 1.2).
  - Verify: five answers recorded. An answer other than the default stops the work for `/opsx:update` before group 1. If questions 1 and 2 are both declined, task 1.2 and the two mcp-adapter scenarios that name the wording are dropped there.
  - Note (Refs #73, #75): on 2026-11-08, in the coordinating session, the PO answered "Accept all (Recommended)" to every open question's default for Issues #73 and #75. Recorded, each as the proposal's default, answered 2026-11-08 (source: the PO's reply to the coordinating session):
    1. `update` description: the default wording, replacing the whole description. Accepted.
    2. Server instructions' follow-up line: the default wording. Accepted.
    3. `fetch` of a deleted item: the typed outcome `deleted`, on the tool envelopes' minor. Accepted.
    4. `fetch` description: unchanged. Accepted.
    5. Language source and precedence: the user's request, else the project's instructions in the agent's context, else none; no line in the server instructions. Accepted.
    The `approved` field of each amendment in task 1.2 is `2026-11-08`. No answer differs from its default, so nothing stops for `/opsx:update`.

## 1. Contract: the outcome, the amendments, the version

- [x] 1.1 The `fetch` outcome `deleted` and the tool envelopes' minor (contract spec, "The fetch outcome deleted"; design decisions 2 and 5).
  - Tests first, in a new `packages/contract/test/agent-facing-gaps-sets.test.ts`:
    - each scenario of the requirement: `deleted` with `itemId`, with and without `unchecked`; `deleted` without `itemId`, failing on `itemId`; `discarded` of the previous minor passing; `discarded` with `itemId` or `unchecked` failing;
    - the version test, pinning main's minor plus one.
  - Then:
    - `fetch-outcome.json` as decision 2 says, its `description` naming this change;
    - `FetchOutcomeResult` as the union of the two shapes;
    - `TOOL_ENVELOPES_VERSION` at main's minor plus one, the module's header comment gaining one sentence naming this change;
    - the earlier exact pins moved (`table-sets.test.ts:60`, and every other hit of the skill's grep that equals main's value).
  - Verify: the tests fail before the schema changes and pass after; `schemaSetProblems` passes; coverage; the check passes. The check's `check:skills` failure on the regenerated version is expected only if `skills/askboard/` is not regenerated: run `bun run build:skills` and commit it.
  - Note (Refs #73; commit below): `fetch-outcome.json` is now `outcome` in `discarded`/`deleted` with optional `itemId` and `unchecked`; an `if`/`then`/`else` requires `itemId` with `deleted` and forbids both properties otherwise (`properties: {itemId: false, unchecked: false}`, since strict mode's `strictRequired` refuses a `required` with no `properties` beside it). `FetchOutcomeResult` is the union. `TOOL_ENVELOPES_VERSION` is 1.13 (main 1.12), header comment extended. Bound at main be308421; `document-review` (70eb893e) also binds tool envelopes 1.13, so whichever merges second rebinds (askboard-contract-versioning). Pins moved: `table-sets.test.ts:60` (envelopes only, the other three stay main's); `envelopes-lifecycle.test.ts` title ("discarded or deleted", assertions unchanged). `skills/askboard/references/answers.md` regenerated (collect example prints 1.13).
  - Red first: `agent-facing-gaps-sets.test.ts` (8 tests) gave 4 pass 4 fail before the schema: `deleted` refused on `additionalProperties itemId`, no `itemId` error, version 1.12. Then 8 pass. `bun test packages/contract tools/build/skills`: 3718 pass 0 fail. `schemaSetProblems` and the strict-compile tests pass. `bun run build` and `bun run check` (with `check:licences`) pass; always-loaded total 6,152 of 8,400, SKILL.md unchanged at 6,257. Coverage: the changed files are JSON and types; no new source lines.
- [x] 1.2 The amendments record and the amended texts (contract spec, "Amendments to the approved texts" and "The approved examples stay as archived"; mcp-adapter spec, "Tool list" and "Server instructions for the tools listed"; design decision 4). Only for the questions task 0.2 accepted.
  - Tests first:
    - in a new `packages/contract/test/approved-amendments.test.ts`: the archived texts with the record applied equal `TOOL_DEFINITIONS` and `SERVER_INSTRUCTIONS`; an amendment whose `from` occurs zero times or twice throws, naming its change and target; the fixture copies still equal the archive (the existing byte-for-byte test, unchanged);
    - in `tool-envelopes.test.ts:169`, `snapshot-envelopes.test.ts:58` and `packages/server/test/mcp-tools/list.test.ts:84`: the expected text read through `amendedApprovedText`;
    - one test each that the `update` description names `itemId` and `followUp` and that the follow-up line names `itemId`.
  - Then:
    - `packages/contract/src/fixtures/approved-amendments.ts` with `APPROVED_TEXT_AMENDMENTS` and `amendedApprovedText`, exported through one appended block at the end of `src/fixtures/index.ts` (askboard-implementation's rule for appended blocks);
    - the approved wording in `tools.json`'s `update` description and in `server-instructions.ts`.
  - Verify: the new tests fail before the texts change and pass after; `bun run check:skills` prints the always-loaded total under 8,400, recorded in the note; coverage; the check passes.
  - Note (Refs #73, #75; commit below): `packages/contract/src/fixtures/approved-amendments.ts` holds `ApprovedTextAmendment`, `APPROVED_TEXT_AMENDMENTS` (two entries, change `agent-facing-gaps`, `approved` 2026-11-08: the `update` description and the server instructions' follow-up line, each as the proposal's default) and `amendedApprovedText(target, text, amendments?)`, which applies a target's entries in order and throws naming the change and target when `from` is found other than once. Exported by one appended block at the end of `fixtures/index.ts`. `tools.json` (`update` description) and `server-instructions.ts` carry the approved wording; the fixture copies are untouched and the archive byte test passes unchanged. The three tests named in the task, and `tool-envelopes.test.ts`'s tool-list test, read the approved text through `amendedApprovedText`.
  - Red first: `approved-amendments.test.ts` (12 tests) ran 8 pass 4 fail with an empty record (the record not empty, `itemId` and `followUp` in the description, the items sentence, the follow-up line naming `itemId`); then 12 pass. `bun run build` and `bun run check` (with `check:licences`): 12223 pass, 3 skip, 0 fail. `check:skills`: always-loaded total 6,410 of 8,400 (from 6,152); SKILL.md and `skills/askboard/` unchanged (the tool JSON is not in the generated files). Coverage: `approved-amendments.ts` and `server-instructions.ts` 100%.
- [x] 1.3 Review checkpoint, group 1: spec review (askboard-spec-reviewer) and security review (askboard-security-reviewer: the contract's schemas and validators) of the group's range (askboard-review-protocol). Tests: none. Verify: the findings are recorded under this task; each is fixed tests first or deferred with the PO's reason, and a fix range is re-reviewed.
  - Note (Refs #73, #75): one combined spec and security pass on 6004e1be..79857dbb (review `review-agent-facing-gaps-g13.md` in the session scratchpad): H 0, M 0, L 2, no X finding. Ran: build, `check:skills` (no drift, always-loaded 6,410 of 8,400), 3,774 contract, skills and examples tests, `openspec validate --strict`. The outcome schema refuses an extra key, an own `__proto__` or `constructor` key, `deleted` without `itemId`, `discarded` with `itemId` or `unchecked`, `unchecked: false` and an empty, 65-character or `a/../b` `itemId`, through the production `validateAgainst`. The amendment replacement keeps `$&` literal and throws when its text is found zero or two times; fixtures and archive untouched. Every other set equals main's (Snapshot data 1.2; design.md names no Snapshot number). S-1 (L) `table-sets.test.ts:53-61` still pins the envelopes exactly (1.13) under form-widget's title, and `agent-facing-gaps-sets.test.ts` titles the number and writes `output: "1.11"` as a literal; `document-review` binds 1.13 too and has made that block at-least checks, so the second to merge conflicts there: task 1.4. S-2 (L) an amendment whose target names no text is skipped silently (a misspelt tool passes every test), and the test pins every entry's change to this one: task 1.4. For group 2 the producer looks safe (`fullValue` answers `deleted` only after every lookup misses; `ownerCheck` first); 2.1 gains two cases.
- [x] 1.4 Fix S-1 and S-2 of review 1.3. Tests first: `table-sets.test.ts`'s four-set pin becomes at-least checks (as `document-review` made it), with a title that names no number; `agent-facing-gaps-sets.test.ts`'s title names the change, not "1.12", and `output` comes from `OUTPUT_FORMAT_VERSION`; `approved-amendments.test.ts`: each entry's target is `server-instructions.md` or the description of a tool in the archived `tools.json` (a misspelt tool fails), applying each entry to its target's archived text changes it (an entry with nothing to do fails, as an unused `tools/licence-exceptions.json` entry does), and the change name is any non-empty kebab-case name. Show each new check failing on a probe entry (a misspelt target, a no-op entry), then remove the probe. Verify: the tests fail on their probes and pass on the real record; the check passes.
  - Note (Refs #73, #75; commit below): test-only. `table-sets.test.ts`'s four-set pin is at-least checks (as `document-review` made it), titled with no number; `agent-facing-gaps-sets.test.ts` is titled for the change and takes `output` from `OUTPUT_FORMAT_VERSION` (its own version test keeps the one `1.13` pin). `approved-amendments.test.ts`: each entry's change is kebab-case; each target is `server-instructions.md` or `tools.json#<name>.description` of a tool in the archived `tools.json`; each entry applied to its target's archived text changes it. The "target no amendment names" test now passes its own record, so a later amendment of `fetch` cannot break it.
  - Red on probes (each added to the record, then removed, `git diff` of `src/` empty): misspelt target `tools.json#fetsh.description` failed the target test and the changes-the-text test (12 pass 2 fail); a no-op entry (`from` equal to `to`) failed the record test, the changes-the-text test and the tool-descriptions test; change name `Probe_Change` failed the record test (11 pass 3 fail). Real record: 14 pass 0 fail. `bun test packages/contract`: 3590 pass 0 fail. `bun run build` and `bun run check` (with `check:licences`) pass; always-loaded total 6,410 of 8,400. Coverage: tests only.

## 2. Server: `fetch` answers `deleted`

- [ ] 2.1 The typed outcome in `mcp-tools` (mcp-adapter spec, "Fetching an item" and "A deleted item in fetch"; design decision 1).
  - Tests first, in `packages/server/test/mcp-tools/fetch.test.ts`:
    - the test at `:116` turned into: a deleted item returns the outcome `deleted` naming the ask and the item, not an error, validating against `fetch-outcome`;
    - the same for an unchecked ask, carrying `unchecked: true`;
    - a `missing` item still an error naming it.
    - an item the ask still holds never answers `deleted` (a live question, a live item inside a Group);
    - another agent's ask is refused by `ownerCheck` before any `deleted` (review 1.3).
  - Tests first, in `packages/server/test/conformance/lifecycle.e2e.ts:399-401`: the outcome `deleted`. Add, through the session process:
    - a question deleted, then fetched;
    - a TextField inside a Group inside a deleted question, fetched;
    - an area deleted, one of its questions fetched;
    - an item a `change` dropped, fetched, giving an error;
    - a deleted question of an ask later discarded, giving `discarded`.
  - Then: `notHeld` in `fetch.ts` returns the typed result. The comment at the top of `fetch.ts` names `deleted` beside `discarded`.
  - If the area case shows that `ask-core` does not hold a deleted area's questions as deleted, stop: that is a core defect outside this design, and it goes to `/opsx:update`.
  - Verify: the tests fail before and pass after; conformance passes on Bun and Node in its three configurations; coverage; the check passes.
- [ ] 2.2 Review checkpoint, group 2, with task 1.4: one combined spec and security pass of their range (askboard-review-protocol; security: the `deleted` producer, fail closed, owner checks). Tests: none. Verify: the findings are recorded under this task; each is fixed tests first or deferred with the PO's reason.

## 3. Skill: changing an ask, the language, `deleted`

- [ ] 3.1 `references/updates.md` and `update` examples (skills spec, "The reference for changing an ask", "Adding an item to a question taught" and "Update examples that validate"; design decision 3).
  - Tests first:
    - in a new `tools/build/skills/updates-skill.test.ts`: the `reply` line names `itemId`, `followUp` and `text` as required; a schema with one more action adds one line and leaves the others unchanged; an action without a gloss fails, naming it; the file says that `add` refuses a widget and that an item left out of a change's `items` is removed; `SKILL.md`'s "After you ask" links the file;
    - in `references.test.ts`: the new file is linked once from `SKILL.md` and links nothing;
    - in `packages/server/test/skills-examples.test.ts`: `json update` blocks are found and validated. The `change` example applies through `AskCore` after the reference's ask example. The `reply` example passes `validateUpdateRequest`, and its `itemId` names a question of that ask example. Breaking the `change` example's item fails the test, naming the file and the block.
  - Then: `updates.ts`, `templates/updates.md`, `Templates.updates` with `DISK_TEMPLATES`, `EXAMPLE_KINDS` with `update` appended, the test's block pattern with `update`, and the link line in `templates/SKILL.md`. Run `bun run build:skills`.
  - Verify: the tests fail before and pass after; `bun run check:skills` passes, its figures recorded; coverage; the check passes.
- [ ] 3.2 The language section and the `deleted` line (skills spec, "The ask's language taught", "Locale and another language taught" and "A deleted item in the answers reference"; design decision 6).
  - Tests first, in a new `tools/build/skills/language-skill.test.ts`:
    - `SKILL.md` names `language`, `locale`, each enum value of the input format, the three sources in order, leaving an unlisted language out, and closing and asking again;
    - an input format with a third language value adds it to `SKILL.md`;
    - an input format without the `language` enum fails the generator, naming it;
    - `references/answers.md` names the outcomes `deleted` and `discarded`.
  - Then: the section and its two slots in `templates/SKILL.md`, the slot values in `generateSkill`, and the bullet in `templates/answers.md`. Run `bun run build:skills`.
  - Verify: the tests fail before and pass after; `SKILL.md` stays within 9,000 characters and 250 lines, recorded in the note; coverage; the check passes.
- [ ] 3.3 Review checkpoint, group 3: spec review of the group's range (askboard-review-protocol), which also reads the generated files as an agent would. Tests: none. Verify: the findings are recorded under this task; each is fixed tests first or deferred with the PO's reason.

## 4. Records, rebase and pull request

- [ ] 4.1 Documents as built (design decision 7). Tests: none (documents).
  - CLAUDE.md:
    - a Status sentence naming `agent-facing-gaps`;
    - an "In code since `agent-facing-gaps`" paragraph: the outcome, `references/updates.md` and the `update` example kind, the language section, `APPROVED_TEXT_AMENDMENTS`, and the bound version;
    - in the layouts paragraph, "`fetch` of one answers `deleted`" checked as true.
  - `CHANGELOG.md`: Unreleased entries, `fetch`'s `deleted` outcome under Changed, and the teaching under Added.
  - If #89 has merged, these lines go where `main` keeps them.
  - Verify: `npx --yes @fission-ai/openspec@1.15.0 validate --all --strict --no-interactive` passes. Each deviation in a task note is in the documents, or is listed in this note with its reason.
- [ ] 4.2 Rebase onto `origin/main` and bind the version label (askboard-contract-versioning, Rebase procedure).
  - The tool envelopes at main's minor plus one, with the earlier exact pins moved and the binding line written in design.md decision 5.
  - Every borrowed name re-checked.
  - `skills/askboard/` regenerated with `bun run build:skills`, never merged by hand.
  - Verify:
    - `git grep` finds each borrowed name on the rebased head;
    - the diff carries no stale number;
    - `bun run check`, `bun run build`, conformance and `openspec validate --all --strict --no-interactive` pass.
  - Record main's SHA, the bound version and the counts in the note.
- [ ] 4.3 Pre-PR review: spec review and security review of the whole range (askboard-review-protocol). Tests: none. Verify: the findings are recorded under this task and fixed tests first, or deferred with the PO's reason; then the PR body is written with the binding line and no attribution.

## Workflow follow-up

- Archive after the pull request merges, through `/opsx:archive`, with the CLAUDE.md lines describing the change as built.
- Close Issues #73 and #75 from the pull request.
