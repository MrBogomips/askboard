# As built: `accept-as-sent`

In code since `accept-as-sent` (Issue #263): "Accept as is" answers a question with no options whose widgets edit agent content with that content as the agent sent it, as one explicit click that takes the path of "Answer". The agent receives an answer marked `asSent: true`, with the open prompt's note and the derived values and no `changes`, `choice` or `results`. `ask-core` accepts it only where it is true. The PO's answer was the proposal's: a card action beside the primary, never beside "Accept recommended", no key of its own.

**What was built and where.**
- Contract (`packages/contract`): `asSent: true` on the board protocol's `answer` act (`schemas/board-protocol/act.json`), the draft record's held answer (`draft-record.json`), the board state's answers (`board-state.json`), the output format's answer event (`schemas/output/answer-event.json`) and `fetch`'s answer (`schemas/tool-envelopes/fetch-result.json`), each with its exclusions (`dependentSchemas`); the types `AnswerAct`, `HeldAct`, `CurrentAnswer`, `AnswerEvent`, `FetchAnswer`; the fixtures `src/fixtures/accept-as-sent.ts`.
- Core (`packages/core`): `asSentProblem` and `contentProblem`'s `asSent` flag (`lifecycle/answers.ts`), `holdsEditWidget` (`lifecycle/widget-values.ts`, the same walk `widgetContentOf` makes), `answered` in `lifecycle/acts.ts` (the check on `act.asSent`, the event with `asSent` and no `changes`), `AnswerContent.asSent` (`lifecycle/model.ts`), `CONTENT` (`lifecycle/views.ts`) and `currentOf` (`snapshot/state.ts`).
- Server (`packages/server`): `currentOf` in `board-host/messages.ts`. `collect` and `fetch` needed no change.
- View (`packages/view`): `shell/accept-as-sent.ts` (`acceptAsSentOffered`, pure), `shell/accept-as-sent-button.tsx`, `ActionsRow`'s `acceptAsIs` and `accepted` props (`question-actions.tsx`), `acceptAsSent` and the `asSent` option of `answer` and `pressAnswer` (`shell/card-acts.ts`), `submitActsOf`'s case for a held `asSent` answer (`shell/submit.ts`), `sentMessageOf` (`shell/flow-messages.ts`), `answerPartsOf`'s `accepted` argument (`shell/answered-look.ts`), `ANSWER` and `derivedAlone` (`view-protocol.ts`), `asSentProblem` in `board-page/model.ts`, and the strings `question.acceptAsIs`, `question.acceptAsIsHint`, `status.acceptedAsIs` and `answer.asSent` in en-US and it-IT.
- Skills: one bullet in `tools/build/skills/templates/answers.md`; `skills/askboard/references/answers.md` regenerated.
- Documents: the PRD (glossary "Answer", FR-11, FR-22, NFR-10), the spine (AD-10, "What becomes an answer", in place), EXPERIENCE.md (Question card, Answer, Explicit acts, Keyboard core, Focus, Voice and Tone, State Patterns) and DESIGN.md (Question actions, a new row, Button).

**Behaviour to know.**
- The button is offered only on a question with no options that holds an item whose component registered an element shape, while the question is to do or in draft, nothing holds a result, and every draft value equals the item as sent by the contract's `elementChanges`. A type whose chunk has not registered its shape gives no button until it does.
- It is disabled (not hidden) while a field blocks, a notice waits or a command of the card is on its way.
- An opened Snapshot has no actions row, so it named no answer; `ActionsRow` draws the answer line alone there for an answer accepted as sent, which no chosen option would otherwise show.
- An asSent answer beside values equal to what was sent is accepted and keeps none; any other value refuses it (`content`, "an answer accepted as sent holds values that differ from the content as sent").

**Versions bound.** Output format 1.14 (main 1.13), board protocol 1.15 (main 1.14), tool envelopes 1.15 (main 1.14), Snapshot data 1.5 (main 1.4), bound on 2026-11-16 against origin/main 95e7e31f; every other set keeps main's. The earlier exact pins moved with them; `accept-as-sent-sets.test.ts` pins the new ones.

**Tests.** Contract: `accept-as-sent.test.ts`, `accept-as-sent-sets.test.ts`. Core: `accept-as-sent.test.ts`. Server: `test/board-host/accept-as-sent-protocol.test.ts`, `test/mcp-tools/accept-as-sent.test.ts`. View: `shell/accept-as-sent.test.ts`, `card-acts-accept-as-sent.test.ts`, `submit-accept-as-sent.test.ts`, `accept-as-sent-button.test.ts`, `strings/accept-as-sent-strings.test.ts`, cases in `view-protocol.test.ts`, `board-page/model.test.ts` and `answer-line.test.ts`. Skills: `tools/build/skills/generate.test.ts`. Browser, Chromium only: `accept-as-sent.browser.ts` (nine cases on the session process; not in the smoke set).

**Seams added.** `asSent` on the five schemas and their types; `acceptAsSentOffered`; `acceptAsSent`; `asSentProblem`; `holdsEditWidget`; the four string keys.

**Sizes.** `shell` 289,173 to 292,107 bytes (+2,934), `board-page` 1,063,260 to 1,067,727 (+4,467: the validators and the strings), both within 10%; `chunk-sizes.json` re-recorded.

**Left open.** A "restore as sent" tool for the Tree (#262) and an agent-recorded `asSent` answer through `update` (design.md, Open Questions). The Italian strings are marked to review.
