# Design

## Context

See proposal.md (Why) for the motivation. Everything below was read on `origin/main` 8e2e1247 on 2026-11-08.

**The causes:**

| Gap | Cause |
|---|---|
| #73 | `AskCore.fullValue` returns `{kind: "deleted"}` for an ID the model holds as deleted (`packages/core/src/ask.ts:381`; core spec "Full value of an item", scenario "A deleted item"). `notHeld` in `packages/server/src/mcp-tools/fetch.ts:26-42` turns it into `errorResult` ("…it was deleted by an update, and an item ID is never reused"). The mcp-adapter spec "Fetching an item" asks for exactly that error. `fetch-outcome.json` admits only `outcome: "discarded"`, and `FetchOutcomeResult` (`tool-envelopes/index.ts:273`) matches it. The code follows the spec. CLAUDE.md ("`fetch` of one answers `deleted`") and the layouts CHANGELOG bullet describe `ask-core`'s kind, not the tool result (layouts task 5.4, S-2, pinned it at core level only: `core/test/deleted-fetch.test.ts`). Pins of the error today: `server/test/mcp-tools/fetch.test.ts:116-122` and `server/test/conformance/lifecycle.e2e.ts:399-401`. |
| #75.1 | `reply` requires `itemId`, `followUp` and `text` (`contract/src/schemas/input/update.json`, `$defs/reply`; core spec "Replies to follow-ups"). The approved `update` description (`tool-envelopes/tools.json:71`) says "reply to a follow-up, naming its cursor". The server instructions (`contract/src/server-instructions.ts:15`) say "`update` (`reply`)". `SKILL.md` (template `tools/build/skills/templates/SKILL.md`, "After you ask") says the same. |
| #75.2 | `add.item` is `urn:askboard:input:ask#/$defs/item`, a question or an area (`update.json`, `$defs/add`). `change` merges props key by key, each key replacing its value whole (core spec "Changing an item"), so a new widget goes into a question by a `change` of its whole `items`. An item a change drops is free again (`BoardModel.inUse`, `core/src/lifecycle/model.ts:215-224`). No skill file says any of this. |
| #75.3 | The input format's ask has `language` and `locale`, enum `en-US` and `it-IT` (`input/ask.json`). `ask-core` resolves `language`, else `defaultLanguage`, else `en-US` (core spec "The ask's language is resolved when it is created"). The template never names them. |

**The skill today:**

- `SKILL.md` is 6,257 of 9,000 characters (CLAUDE.md's 8,987 dates from before `skill-index` moved each type's use into `references/items.md`).
- The always-loaded total is about 6,150 of 8,400: the compact tool JSON 4,309, the instructions 1,493, the name and description 350. Task 0.1 records the generator's own figure.
- The generator fills templates through `fill` (`tools/build/skills/generate.ts:53`), which fails on a slot no value fills. Examples are tagged blocks of the kinds `EXAMPLE_KINDS` (`blocks.ts:5`), and `packages/server/test/skills-examples.test.ts:24` keeps its own block pattern.

**What Claude Code loads (its documentation's memory, sub-agents and skills pages, read on 2026-11-08; not guessed):**

- CLAUDE.md is loaded at session start.
- AGENTS.md is read only when no CLAUDE.md applies, unless the "Project instructions" setting includes it, or CLAUDE.md imports it.
- Subagents load the CLAUDE.md hierarchy, except Explore and Plan. Whether a plugin-defined subagent loads it is not documented: **needs probe, not relied on** (decision 6 degrades to "none").
- A skill's body enters the conversation that already holds CLAUDE.md.

ADs relied on: AD-6 (tool texts, generated teaching, typed warnings versus `isError`), AD-7 (the tool envelopes' minor), AD-10 (typed results for states the agent cannot fix), AD-21 (`discarded` before anything else). PRD: FR-5, FR-6, FR-10, FR-20, FR-29, FR-34; NFR-1 and R5 (the always-loaded total). UX: none.

## Goals / Non-Goals

**Goals:**

- `fetch` names a deleted item as a typed state.
- The skill, and with the PO's approval the two tool texts, teach `reply`'s `itemId`, adding to a question, and the ask's language.

**Non-Goals:**

- `collect`'s `wait` on a deleted question (`mcp-tools/wait.ts:76-79`) stays a request problem. The agent named a question it removed itself, and must fix the wait.
- `update` actions that name a deleted ID stay refusals (core spec "Adding an item").
- An `add` of a widget into a question (a new `parentId` meaning) is not added. Teaching the `change` is enough, and adding it would widen the input format.
- No language switch on the board, and no translation (FR-34).
- No change to the `fetch` or `ask` descriptions (open question 4).

## Decisions

### 1. `deleted` is a typed `fetch` outcome

`notHeld` returns, for `kind: "deleted"`, `{versions: RESULT_VERSIONS, epoch, askId, itemId, outcome: "deleted"}`, with `uncheckedMark(core, askId)` spread in. The ask exists, so the mcp-adapter rule that every `fetch` result of an unchecked ask carries the mark applies. `missing` keeps its error. An item a `change` dropped is `missing`, since the model frees its ID. `fullValue` already answers `discarded` before it looks at items, so a discarded ask still answers `discarded`.

`ask-core` reads deleted IDs in reference addressing, as every agent-facing read does (AD-9): a molecule reference inside a deleted question or area is `deleted`, and an expanded ID (`wbs__tree`) is `missing`, as it is while the question lives. Its `#deleted` set held the expanded IDs of a forgotten question's stored props and never the reference IDs; `inUse` stays as it is, so expanded IDs stay unusable (review 2.2 X-1, task 2.3).

*Alternative:* keep the error and correct the documents (open question 3). Rejected as the default: the agent cannot fix the request, and AD-10 makes such states typed, as `discarded` and `closed` are. The error text already names the cause, so the gap is the shape, not the meaning.

### 2. The outcome's schema

- `fetch-outcome.json`: `outcome` becomes `enum: ["discarded", "deleted"]`, beside an optional `itemId` (`urn:askboard:input:id`) and an optional `unchecked` (`const: true`).
- An `if`/`then`/`else` on `outcome` requires `itemId` with `deleted` and forbids `itemId` and `unchecked` otherwise. The form is the one the PickField result used under the contract's strict compilation; there is no root `oneOf`.
- The description names this change.
- `FetchOutcomeResult` becomes a union of the two shapes.
- `fetch`'s result union in `mcp-tools` is unchanged in shape: it still returns `jsonResult`.

### 3. `references/updates.md`, generated

- A new module, `tools/build/skills/updates.ts`, renders one line per action of `update.json`'s `$defs/action` `oneOf`, in order. Each line gives the action's required and optional fields, read from the schema, and a short gloss. Glosses are kept in a table keyed by action, and the generator fails, naming the action, when an action has no gloss. That keeps the file true to the schema, as the widget references are.
- A new template, `templates/updates.md`, holds the prose:
  - `add` takes a question (into an area by `parentId`) or an area;
  - a widget, atom, layout or context item joins a question by a `change` of the question's `items`, sent whole with every item kept, by its own ID;
  - an item left out is removed from the question;
  - an item's own props can be changed by its own ID;
  - a question with an answer is reopened first;
  - `reply` names the question the follow-up event names in `itemId`, and that event's cursor in `followUp`.
- The template has three examples:
  - a `json ask` with one question;
  - a `json update` whose `change` adds a TextField to that question's `items`, keeping the existing one;
  - a `json update` with a `reply`, whose `followUp` is a well-formed cursor.
- `Templates` gains `updates`, and `DISK_TEMPLATES` reads it. `generateSkill` adds `references/updates.md` with its examples.
- `EXAMPLE_KINDS` gains `update`, appended, and so does the test's block pattern.
- `SKILL.md`'s "After you ask" links the reference in one line: "How to change an ask: add, change, reply and the rest: [updates](references/updates.md)."
- The reference stays far below the 6,000-character budget.

*Alternative:* put it all in `SKILL.md`. Rejected: it is read on demand only when the agent updates, and `SKILL.md` is loaded on every invocation (NFR-1).

### 4. Amendments to the approved texts

- The approved texts are the archived `review-model-contract` examples. Their fixture copies must stay byte-identical (`packages/contract/test/approved-examples.test.ts:31`), and the archive is never edited.
- A new fixtures module, `packages/contract/src/fixtures/approved-amendments.ts`, exports `APPROVED_TEXT_AMENDMENTS`. Each entry is `{change, approved, target, from, to}`, where `target` is `tools.json#<tool>.description` or `server-instructions.md`, and `approved` is the date of the PO's answer (task 0.2). It also exports `amendedApprovedText(target, text)`, which applies the target's amendments in order and throws, naming the change and target, when `from` is not found exactly once.
- The module is exported through an appended block at the end of `src/fixtures/index.ts`.
- The current texts (`tools.json`, `server-instructions.ts`) carry the amended wording.
- Three tests read the approved text through `amendedApprovedText`: `contract/test/tool-envelopes.test.ts:169`, `snapshot-envelopes.test.ts:58` and `server/test/mcp-tools/list.test.ts:84`. The tests that compare tool names only are unchanged.
- The wording is the proposal's open questions 1 and 2, as the PO answers them.
- If the PO declines both, task 0.2 says so, and `/opsx:update` drops this decision, group 3 and the two mcp-adapter scenarios that name the wording.

*Alternative:* edit the fixture copies. Rejected: the byte-for-byte rule is the only proof that the shipped texts started from what was approved.

### 5. Versions (askboard-contract-versioning)

- `main` holds tool envelopes 1.12 (8e2e1247). Only the **tool envelopes** widen, to the **next minor after main's**: `fetch-outcome.json`'s `deleted`.
- The amended descriptions ride on the same minor. They change no schema.
- Every other set keeps `main`'s value. The output format is untouched, since the outcome refers only to `urn:askboard:output:epoch`.
- The constant moves in task 1.1. The module's header comment gains one sentence naming this change.
- Known exact pin: `packages/contract/test/table-sets.test.ts:60` (`envelopes: "1.12"`).
- The answers reference's `collect` example prints the envelopes version, so the skill is regenerated at every binding.

Binding: (filled at task 4.2) "Bound on <date>, rebased onto origin/main <sha>: tool envelopes <n> (main <m>)."

### 6. The language section

- A short "## Language" section in `SKILL.md`, after "Keep asks cheap", from the template with two slots, `{{languages}}` and `{{locales}}`. The slots are the `enum` of the input format's `language` and `locale` (`input/ask.json`), read through the same resolver as the widget fields. The generator fails if either enum is missing.
- Proposed text, about 650 characters (open question 5):

  > Set `language` on every `ask` to the user's language: the one the user asked for, else the one your project's instructions give (CLAUDE.md or AGENTS.md, as you have them). AskBoard offers {{languages}}; for another language, or when nothing says, leave it out and AskBoard uses its configured default, else `en-US`. Write your own text in the user's language either way. Set `locale` ({{locales}}) only when the user's formats for money, dates and numbers differ from the language's. `update` changes neither: for another language, close the ask and send a new one in it.

- The words "as you have them" keep the agent from reading a file it was not given. A subagent without CLAUDE.md, or a plugin subagent (needs probe, see Context), falls back to the configured default, as FR-34 allows.
- `SKILL.md` grows to about 7,000 characters.
- The answers template gains one bullet after the `fetch` bullet: "`fetch` of an item you deleted returns the outcome `deleted`; of an ask that is gone, `discarded`."

### 7. Documents

- CLAUDE.md: the layouts paragraph's "`fetch` of one answers `deleted`" becomes true as written. Task 4.1 adds a Status sentence and an "In code since `agent-facing-gaps`" paragraph: the outcome, the reference, the language section, the amendments record and the bound version.
- `CHANGELOG.md`: Unreleased entries for the outcome and the teaching.
- The PRD, the spine and the UX documents are unchanged. FR-34 and FR-29 already ask for this teaching, and AD-6 and AD-10 already make states typed.

## Merge points

Read on 2026-11-08. Whichever merges first, the rebase keeps both sides and re-checks the names. `skills/askboard/` is generated: its conflicts are never resolved by hand. After the source conflicts are resolved, run `bun run build:skills` and commit the result.

| Change | Head | Overlap | What it takes |
|---|---|---|---|
| `oversized-acts` (#88) | `worktree-fix-oversized-acts` 25bfc33c | `CHANGELOG.md`, `CLAUDE.md`; no set widened, no skill or tool text | Keep both entries. |
| `choice-documented-activation` (#87) | `worktree-fix-choice-activation` 57618b67 | `CLAUDE.md` only | Keep both. |
| backlog (#89) | `worktree-feature-backlog-issues` 7046d8a6 | `CLAUDE.md` moves to `AGENTS.md` | The Status and "In code since" lines go wherever `main` keeps them then. The language teaching names both files anyway. |
| `document-review` | `worktree-feature-document-review` c5383fbe (based on d6c67d87) | Widens the input format, output format, tool envelopes and board document. Appends a widget (one link line in `SKILL.md`, one catalogue line). Regenerates `references/answers.md` (the `collect` example's versions). Appends export blocks in `contract/src/index.ts` and `fixtures/index.ts`. | Tool envelopes: whichever merges first takes the next minor, and the other rebinds. Keep both export blocks, `main`'s first. Regenerate the skill. Its `document-review-fetch.test.ts` fetches items, not deleted ones: no clash. |
| `snapshot-toolbar` | `worktree-fix-snapshot-toolbar` 1c235e20 | Snapshot data only; no tool or skill text | None. |
| `reopen-start-from-answer` | `worktree-fix-reopen-start-from-answer` b8a8308c | Board protocol and Snapshot data; "no tool or skill text" (its proposal) | None. |
| `wbs-gantt-consistency` | `worktree-fix-wbs-gantt-consistency` at 8e2e1247, no artifacts yet | Unknown. A molecule or widget teaching change would regenerate the skill. | Task 0.1 reads its design if one exists by then. Regenerate the skill at the rebase. |
| `keyboard-shortcuts-help` | `worktree-feature-keyboard-help` 101a9498 (artifacts only) | Edits `generate.ts`, `templates.ts` (`Templates`, `DISK_TEMPLATES`), `budgets.ts` (`budgetReport` per skill) and `tools/build/skills.ts`. Adds about 150 characters to `SKILL.md`. Its skills delta MODIFIES "Skill files are generated" and "The skill's token budget". | This change only ADDS skills requirements, so the two deltas never edit the same block. In `Templates` and `generateSkill`, keep both sides' fields and files. `SKILL.md` stays near 7,150 of 9,000 with both. |

Other feature branches that widen the tool envelopes (`diagram-widget`, `graph-widget`, `spreadsheet-widget`, `image-annotation`, `diff-review`) follow the same rule: whichever merges first takes the next minor.

Borrowed from `origin/main` 8e2e1247 (task 0.1 records each with its file and line):

- server: `notHeld`, `handleFetch` (`fetch.ts`), `uncheckedMark` (`owner-refusal.ts:61`), `jsonResult`, `errorResult` (`results.ts`);
- contract: `FetchOutcomeResult` (`tool-envelopes/index.ts:273`), `RESULT_VERSIONS`, `TOOL_ENVELOPES_VERSION`, `SERVER_INSTRUCTIONS`, `TOOL_DEFINITIONS`, `validateUpdateRequest` (`update-request.ts:151`);
- core: `AskCore.fullValue`'s `deleted` kind (`ask.ts:65`, `:381`);
- tools: `generateSkill`, `SkillInputs`, `fill` (`generate.ts:114`, `:37`, `:53`), `Templates`, `DISK_TEMPLATES` (`templates.ts:8`, `:14`), `EXAMPLE_KINDS`, `ExampleBody`, `exampleBlock` (`blocks.ts:5`, `:10`, `:15`), `contractSchemaResolver` (`fields.ts:36`), `budgetReport`, `BUDGETS`.

Seams this change creates: the `deleted` outcome, `APPROVED_TEXT_AMENDMENTS` (later amendments append to it), the `update` example kind, and `Templates.updates`.

## Risks / Trade-offs

- [An agent written against the error text] → The text is not a contract. The typed result names the same cause. The conformance pin moves with it (task 2.1).
- [The amended texts grow the always-loaded total] → About 250 characters, which leaves it near 6,400 of 8,400. `check:skills` prints the figure, and task 3.1 records it.
- [The agent's context holds no project language] → It leaves `language` out, and the configured default applies (FR-34).
- [`keyboard-shortcuts-help` and this change both edit the generator] → Merge point above. Both only append fields and files.

## Open Questions

The PO's questions and their defaults are in proposal.md (Open questions for the PO, 1 to 5). Task 0.2 records the answers. None is deferred past group 0.
