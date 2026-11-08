# Proposal

## Why

Issue: #73. Issue: #75. The end-to-end test of 2026-11-08 found four places where the agent is told too little (all severity L):

- **#73.** `fetch` of an item of a question the agent deleted answers with an error text ("it was deleted by an update"), while a discarded ask answers with the typed outcome `discarded`. `ask-core` already reports the item as `deleted` (`packages/core/src/ask.ts:381`); `mcp-tools` turns that into `isError` text (`packages/server/src/mcp-tools/fetch.ts:36-41`), as the mcp-adapter spec "Fetching an item" asks, and `fetch-outcome.json` admits only `discarded`. So the code follows the spec, and CLAUDE.md's "`fetch` of one answers `deleted`" (layouts paragraph) and the `0.1.0` CHANGELOG bullet describe `ask-core`, not the tool. The agent cannot fix such a request: the item is gone for good (FR-5). It is a state, as `discarded` is, so it becomes a typed result (AD-6, AD-10).
- **#75.1.** `update` → `reply` requires `itemId` (`packages/contract/src/schemas/input/update.json`, `$defs/reply`), but the tool description says only "naming its cursor", the server instructions say "`update` (`reply`)", and the skill says the same.
- **#75.2.** `update` → `add` takes a question or an area only. A widget, atom, layout or context item joins an existing question through a `change` of the question's `items`, sent whole, since each key replaces its value whole (core spec, "Changing an item"). Nothing teaches it.
- **#75.3.** The skill never names `language` or `locale`, though FR-34 says the agent sets the ask's language from the user's preference. Without it every board falls back to `defaultLanguage`, then `en-US`. The PO expects the agent to take the language from the project's instructions (CLAUDE.md or AGENTS.md). The board rightly has no language switch.

## What Changes

- **`fetch` of a deleted item** returns the typed outcome `deleted`, naming the ask and the item, with the ask's `unchecked` mark when the ask has no owner. An item the ask never held, or one a `change` dropped, is still an error naming it.
- **The tool envelopes** take the next minor after `main`'s: `fetch-outcome.json` admits `deleted` with `itemId`, and `unchecked` with it. No other set moves (design decision 5).
- **A new skill reference, `references/updates.md`** ("Changing an ask"). It gives each `update` action with the fields it takes, generated from the input format's update schema, and how to add an item to an existing question. It holds `update` examples that the examples test validates. `SKILL.md` links it in "After you ask".
- **A "Language" section in `SKILL.md`.** The agent passes `language` on every `ask`, taken from what the user asked for, else from the project's instructions it has in context. It passes `locale` only for formats that differ from the language, and leaves both out otherwise. The values come from the input format.
- **The answers reference** says that `fetch` of an item the agent deleted returns the outcome `deleted`.
- **Approved texts, each with the PO's approval (open questions 1 and 2):**
  - The `update` tool description names `reply`'s `itemId` and `followUp`, and says how to add a widget to a question.
  - The server instructions' follow-up line names `itemId`.
  - The contract records each amendment beside the approved model contract, whose archived examples and fixture copies stay byte-identical (design decision 4).
- **Documents:**
  - CLAUDE.md's layouts paragraph keeps "`fetch` of one answers `deleted`", now true of the tool.
  - `CHANGELOG.md` gains Unreleased entries.
  - The PRD, the spine and the UX documents are unchanged: FR-34 already says the agent sets the language, and AD-6 and AD-10 already ask for typed results for states.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mcp-adapter`: "Fetching an item", "Tool list" and "Server instructions for the tools listed" change; one new requirement, a deleted item in `fetch`.
- `contract`: new requirements, the `fetch` outcome `deleted` and the amendments to the approved texts.
- `skills`: new requirements, the reference for changing an ask, `update` examples that validate, the ask's language, and `deleted` in the answers reference.
- `core`: one new requirement, expanded IDs held against items on `add` as on `change` (review 3.3 X-1), so `fetch`'s `deleted` reads one owner per ID.

## Impact

- **Code:**
  - `packages/contract/src/schemas/tool-envelopes/` (`fetch-outcome.json`, `index.ts`: the constant and `FetchOutcomeResult`, and `tools.json` if open question 1 is accepted);
  - `packages/contract/src/server-instructions.ts` (if open question 2 is accepted) and a fixtures module for the amendments;
  - `packages/server/src/mcp-tools/fetch.ts`;
  - `tools/build/skills/` (`generate.ts`, a new `updates.ts`, the templates `SKILL.md` and `answers.md`, a new template `updates.md`);
  - `skills/askboard/`, regenerated.
- **Tests:**
  - contract: the envelopes, the amendments and the version test;
  - server: `fetch`, the tool list and `skills-examples.test.ts`, which gains `json update` blocks;
  - tools: the skill generator;
  - conformance: the `fetch` transcript of a deleted item, if any pins the error.
- **No change** to the view, the board protocol, `ask-core`'s behaviour, any dependency or chunk.
- **IDs served:** FR-5, FR-6, FR-10, FR-20, FR-29, FR-34; NFR-1, NFR-10, NFR-11; PRD R5 (the always-loaded total).
- **ADs relied on:** AD-6, AD-7, AD-10, AD-21. UX: none (no user-facing surface).

## Open questions for the PO

Each has a proposed default. Task 0.2 records the answers before group 1. An answer other than the default stops the work for `/opsx:update`.

1. **The `update` tool description (approved text).** Default, replacing the whole description: "Change an open ask by item ID: add a question or an area; change an item's props, each key you send replacing its value whole (to add a widget to a question, change the question's `items`, sent whole); delete or reopen an item; record an answer the user gave you outside the board; reply to a follow-up, naming its question in `itemId` and its cursor in `followUp`; or close the ask. A question that already has an answer can only be reopened, which starts a new revision." The alternative is to leave it as approved and teach this in the skill only.
2. **The server instructions' follow-up line (approved text).** Default: "- Reply to follow-ups at once with `update` (`reply`, with the question's `itemId` and the follow-up's cursor): the user is waiting for you." The alternative is to leave it unchanged.
3. **`fetch` of a deleted item.** Default: the typed outcome `deleted` (tool envelopes minor). The alternative keeps the error and corrects CLAUDE.md and the CHANGELOG to say that the tool answers with an error naming the deletion.
4. **The `fetch` description (approved text).** Default: unchanged. The typed result names itself, and the answers reference teaches it.
5. **Where the language comes from, and which wins.** Default, in this order:
   - the language the user asked for in the conversation;
   - else the one the project's instructions in the agent's context give (CLAUDE.md, or AGENTS.md where Claude Code reads it);
   - else none, so AskBoard's `defaultLanguage` and then `en-US` apply.

   A language the input format does not offer is left out, and the agent's own text stays in the user's language. No line goes into the server instructions.
