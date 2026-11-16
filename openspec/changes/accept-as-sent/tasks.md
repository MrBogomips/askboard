# Tasks

Each task names its tests first and sees them fail for the right reason before it implements. "The check" is `bun run check:agent`. Groups run in order, 0 to 8: each reads the types or behaviour of the one before. Inside group 4, tasks 4.1 and 4.2 may run beside each other. Groups 7.1 to 7.4 may run beside group 6. A new browser file runs in Chromium only (`--engines chromium`); no local full or multi-engine e2e run.

**Pre-merge train.** This change alters a card's rendering, so before merge the coordinator dispatches `gh workflow run e2e.yml --ref worktree-feature-accept-as-sent -f cadence=nightly` and triages a red train against the last train on `main` (AGENTS.md, CI; askboard-delivery).

## 0. Base

- [x] 0.1 Names and versions (askboard-contract-versioning, Rule 3; design.md, Merge points, decision 8). Tests: none. Check with `git grep -n` on `origin/main` every name design.md borrows, and record each with its file and line in the group's commit body. Record main's constants of output format, board protocol, tool envelopes and Snapshot data. Verify: every name and version is listed; a name missing or changed stops the work for `/openspec-update-change`.

## 1. Contract (effort high)

- [x] 1.1 Tests first, in `packages/contract/test/accept-as-sent.test.ts`, with fixtures in `src/fixtures/accept-as-sent.ts` (its own export block). Cover: an `asSent` act and its exclusions; a held `asSent` answer and its refusal on other held acts; an event with `asSent` and its exclusions; every earlier `answers/*.json` still valid; the board-state and `fetch` answer with `asSent`. Scenarios: contract's three added requirements. Verify: each fails on the current schemas.
- [x] 1.2 Schemas (decision 3): `board-protocol/act.json`, `draft-record.json`, `board-state.json`; `output/answer-event.json`; `tool-envelopes/fetch-result.json`. Each description names "since accept-as-sent". Add `asSent?: true` to `AnswerEvent`, `CurrentAnswer`, `FetchAnswer` and the draft record's held type. Verify: 1.1 passes; `approved-examples.test.ts` is unchanged and green.
- [x] 1.3 Versions (decision 8): output format, board protocol, tool envelopes and Snapshot data at main's minor plus one. Each module gets one header sentence naming accept-as-sent. The change's version test is `accept-as-sent-sets.test.ts`. Move the earlier exact pins (the skill's grep). Rebuild the standalone validators. Verify: `tools/build/validators.test.ts` and the contract tests pass; the other sets equal main's.

## 2. Core (effort high)

- [x] 2.1 Tests first, in `packages/core/test/accept-as-sent.test.ts`: a Tree accepted with a note; acceptance on a kept revision; acceptance beside a moving value; acceptance on an options question, a question with no edit type, or beside a choice, other text, option notes, results or a decline; a required field left empty; equal values without `asSent` still refused; `asSent` other than `true` refused as `act`. Scenarios: core's modified requirement. Verify: each fails.
- [x] 2.2 Implement decision 4: `asSentProblem` in `lifecycle/answers.ts`; `contentProblem`'s `asSent` flag; `answered` in `acts.ts` builds the event with `asSent` and no `changes`; `withinLimit` keeps it. Verify: 2.1 passes, and `acts.test.ts` and `answer.test.ts` stay green.
- [x] 2.3 Tests, then code: `AnswerContent.asSent`, `CONTENT` in `lifecycle/views.ts`, and `currentOf` in `snapshot/state.ts`. `fetch`'s full answer, the board view's current and previous answer, and a Snapshot's state carry `asSent`. Scenarios: "The board state of an accepted question", "Fetching an accepted question". Verify: the new cases pass, the results validate against the bumped sets, and coverage holds.

## 3. Server

- [x] 3.1 Tests first, in `packages/server/test/board-host/accept-as-sent-protocol.test.ts`, then `currentOf` in `board-host/messages.ts`. Cases: a reconnect after an accepted Tree holds `asSent`, with receipt `sent` and then `delivered`; an acceptance on an options question is `refused` with reason `act` and the index, the question still open. Scenarios: board-host's added requirement. Verify: the new tests pass, and `unchanged-state.test.ts` stays green.
- [x] 3.2 Tests in the mcp-tools tests: `collect` returns the `asSent` event, and `fetch` the question's answer with `asSent`; both results validate against the tool envelopes. Verify: the tests pass with no source change beyond group 2's, or the gap is fixed and named in the commit body.

## 4. View units

- [x] 4.1 Strings (decision 6): `question.acceptAsIs`, `question.acceptAsIsHint`, `status.acceptedAsIs` and `answer.asSent` in `strings/en-US.ts`, `it-IT.ts` and `keys.ts`. Tests: the catalog parity and key tests. Verify: they fail before and pass after.
- [x] 4.2 Tests first, in `shell/accept-as-sent.test.ts`, then `acceptAsSentOffered` (decision 1). Offered on an untouched Tree, Gantt, Table, Kanban, Timeline, LaTeX and a molecule's Tree. Not offered with options, without an edit type, with a moved value, with a result, when answered, ready or declined, when locked, or in a Snapshot. Offered again once a value is moved back. Verify: coverage of the module holds.
- [x] 4.3 Tests first, in `card-acts.test.ts`, then `acceptAsSent` and `answer`'s and `pressAnswer`'s `asSent` option (decision 5). Immediate: the act carries `asSent`, the note and derived values, and no values, even with equal values held. Submitted: the hold carries `asSent`. `blockedBy` stops it; `asksFirst` confirms; `withDerived` counts `asSent`. Verify: the cases pass.
- [x] 4.4 Tests first, then `ANSWER` and `derivedAlone` in `view-protocol.ts` and `answerProblem` in `board-page/model.ts` (decision 5). An `asSent` act passes, with or without derived values; beside a choice, values or results, or on an options question, it is refused before sending. Verify: the view-protocol and board-page model tests pass.
- [x] 4.5 Tests first, then `submitActsOf` (`shell/submit.ts`) and the draft restore of a held `asSent`. Submit sends `asSent` with no values, in the user's order; a reload keeps the hold accepted; "Edit" unmarks it. Scenarios: "Accept as is in All together". Verify: `submit` and `board-draft` tests pass.
- [x] 4.6 Tests first, then the card. The button sits in `question-actions.tsx` after the primary and its reason, as `button-secondary`, with `question.acceptAsIsHint` as its description. `question-card.tsx` routes it through `onAnswer` and `runFlow("answer")`. `answerPartsOf` gives "Accepted as is", and the status is `status.acceptedAsIs`. Tests: shell component and `answer-line.test.ts`. Verify: they pass; `bun run build:view` stays within `chunk-sizes.json`.

## 5. Browser

- [x] 5.1 New `packages/view/test/browser/accept-as-sent.browser.ts`, listed in `harness/suites.ts` (not smoke), on the session process. Cases: a Tree accepted with a note in "One by one" (the `collect` event, `fetch`, the status, the answered line, the move to the top on a two-question board); "Gone with an edit, back when the edit is undone"; no button with options; blocked by a field; keyboard. Verify: it fails before group 4 and passes in Chromium.
- [x] 5.2 In the same file: "Ready, then sent by Submit" on a Kanban; "A reload keeps it ready" on a Timeline; "A Snapshot of an accepted question"; "Revising an accepted answer". Each `collect` and `fetch` result passes its schema (`checkedEvents`, `checkedFetchItem`). Verify: the cases pass in Chromium, and the suites test is green.
  - Note: an opened Snapshot has no actions row, so it showed no answer line; `ActionsRow` now draws the line alone there for an answer accepted as sent (design.md decision 5 names the answered look, the spec's scenario "A Snapshot of an accepted question" needs it).

## 6. Skills

- [x] 6.1 Teaching (decision 9): one bullet in `tools/build/skills/templates/answers.md`, a test in `tools/build/skills/references.test.ts` for the "An answer accepted as sent" scenario, then `bun run build:skills`. Verify: `bun run check:skills` passes, the reference stays under its 6,000-character budget, and `skills/` is committed regenerated.
  - Note: the test is in `tools/build/skills/generate.test.ts`, where the answers reference's tests already are; `references.test.ts` renders no answers reference.

## 7. Documents and record

- [x] 7.1 PRD (decision 10): the glossary "Answer", FR-11's sentence, FR-22's paragraph and acceptance line, and NFR-10 name "Accept as is". Tests: none. Verify: `grep -n "Accept as is" docs/prd-askboard-2026-10-25/prd.md` finds the four places, and no other requirement's text changes.
- [x] 7.2 Spine: AD-10's "What becomes an answer" amended in place, as decision 10 words it, with no renumbering. Tests: none. Verify: `git diff` touches only AD-10's bullets; SOLUTION-DESIGN.md needs no edit, or the edit is named.
- [x] 7.3 EXPERIENCE.md (decision 10): the Question card row, Answer, Interaction Primitives Explicit acts, Keyboard core, Focus, Voice and Tone (four strings, Italian to review), and State Patterns By surface. Tests: none. Verify: each section names "Accept as is" and cites `accept-as-sent`.
- [x] 7.4 DESIGN.md (decision 10): Question actions, a new "Accept as is" component row, and the Button row's `button-secondary` list. Tests: none. Verify: the rows agree with EXPERIENCE.md and with `question-actions.tsx`.
- [x] 7.5 `docs/as-built/accept-as-sent.md`: what was built, where the code lives, the seams added (design.md, Merge points), and the versions bound (filled at 8.1). No status. Tests: none. Verify: every seam listed exists in the diff.

## 8. Rebase and pull request

- [x] 8.1 Rebase onto `origin/main` and bind the version labels (askboard-contract-versioning). Each widened set goes to main's minor plus one, with the earlier exact pins moved. Write the dated binding line in design.md decision 8 and in the as-built note, and re-check every borrowed name. Verify: `git grep` finds each name on the rebased head, no stale number is in the diff, and `bun run check`, `bun run build` and `openspec validate --all --strict --no-interactive` pass. Record main's SHA and the versions in the commit body.
