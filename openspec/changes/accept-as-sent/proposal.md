# Proposal

## Why

A question with no options whose content is an editable widget (a Tree, a Gantt, a Table, a Kanban, a Timeline, a LaTeX expression) cannot be answered by a user who agrees with it as the agent sent it. "Answer" stays disabled until something changes, and `ask-core` refuses an answer whose widget values equal what was sent (core spec, "Answers only from an explicit user action", scenario "Widget values equal to what was sent"). In a local check of `main` 95e7e31f the PO wrote "Va bene così" in the note, which reached the agent as a note while the question stayed to do. The PO then pressed "Answer" after an accidental move (#262), and that move became the whole answer. The PO asked (2026-11-16) for one click that accepts the content as it stands and counts as the answer. "Accept recommended" already does this for options, and "Keep this order" does it for the Ranking.

- Issue: #263

Serves FR-3 and FR-22 (explicit acts that answer, and delivery), FR-11 (review widgets), FR-18 to FR-20 (typed answers, revisions, `fetch`), NFR-10 (fail closed) and NFR-12 (keyboard core). Relies on AD-1, AD-7, AD-8, AD-10 (amended in place), AD-13 and AD-20. Implements EXPERIENCE.md Component Patterns (Question card: Question actions, Answer, Accept recommended), Interaction Primitives (Explicit acts, Delivery, Focus), Accessibility Floor (Keyboard core) and Voice and Tone. Also DESIGN.md Components (Question actions, Answer, Button).

## What Changes

- **"Accept as is"** ("Accetta così com'è", to review) sits in the question actions row, beside the primary. It is offered on a question with no options that holds at least one item whose widget edits agent content (a widget type that declares `edits` in the registry: Tree, Gantt, Table, Kanban, Timeline and LaTeX today, molecule expansions included). It shows while the question is to do or in draft and holds no edit and no result. One click answers the question with its content as sent. It takes the path of "Answer": the field checks, the confirmation of a received verdict, immediate delivery sending at once, submitted delivery marking it ready, the move After an answer, the status message and the answered look ("Answer: Accepted as is").
- **An explicit answer form.** The board protocol's `answer` act and the output format's answer event gain `asSent: true`. The event also carries the open prompt's note and the derived values, and never a choice, "Other…" text, option notes, `changes` or `results`. `fetch`, the board state and Snapshots carry it too.
- **Fail closed in `ask-core`.** An `asSent` answer is accepted only on a question whose named revision (current, or kept by an edit choice) has no options and holds an edit widget, and only when every value it carries equals the item as sent and the question's field checks pass. Anything else is refused and the log is unchanged. An answer with no `asSent` whose values equal what was sent is still refused.
- **Questions with options are unchanged.** A choice, or "Accept recommended", answers them. Untouched widget content is reported unchanged, as AD-10 says. "Accept as is" and "Accept recommended" never share a card.
- **Contract versions.** Each of output format, board protocol, tool envelopes and Snapshot data moves to the next minor after main's, bound at the rebase before the pull request.
- **Teaching.** The generated answers reference (`skills/askboard/references/answers.md`, from `tools/build/skills/templates/answers.md`) says what `asSent` means.
- **Documents.** The PRD (glossary "Answer", FR-11, FR-22, NFR-10), the spine (AD-10 amended in place), EXPERIENCE.md and DESIGN.md name "Accept as is" beside "Answer" and "Accept recommended". The change's record goes in `docs/as-built/accept-as-sent.md`.

Not in this change: a "restore as sent" or an undo for the Tree (#262, a separate defect), and an agent-recorded `asSent` answer through `update` (design.md, Open Questions).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `core`: "Answers only from an explicit user action" is modified (the `asSent` answer, its checks).
- `contract`: added "An answer accepted as sent in the answer act", "A held answer accepted as sent in the draft record", "An answer accepted as sent in the output format" and "An answer accepted as sent in the board state, fetch and Snapshots".
- `board-host`: added "Answers accepted as sent in the board state".
- `view-and-widgets`: "Answering a question with a widget" is modified; added "When Accept as is is offered", "Accept as is answers as Answer does" and "Accept as is in All together".
- `skills`: "Answers and Snapshots" is modified (the skill teaches `asSent`).

## Impact

- `packages/contract`: `answer-event.json`, `board-protocol/act.json`, `board-state.json`, `draft-record.json` (a held answer's `asSent`), `tool-envelopes/fetch-result.json`; the four set constants and their header comments; the TS types (`AnswerEvent`, `CurrentAnswer`, `FetchAnswer`); a fixtures module of the change's own.
- `packages/core`: `lifecycle/acts.ts`, `answers.ts` (`contentProblem`, `contentOf`), `model.ts` (`AnswerContent`), `views.ts` (`CONTENT`), `snapshot/state.ts` (`currentOf`).
- `packages/server`: `board-host/messages.ts` (`currentOf`).
- `packages/view`: `shell/card-acts.ts` (`answer`, `pressAnswer`, `withDerived`), a new `shell/accept-as-sent.ts` (when it is offered), `question-actions.tsx`, `question-card.tsx`, `submit.ts` (`submitActsOf`), `view-protocol.ts` (`ANSWER`, `derivedAlone`), `board-page/model.ts`, the answered look, `strings/en-US.ts`, `it-IT.ts`, `keys.ts`. One new browser file, `accept-as-sent.browser.ts`.
- `tools/build/skills/templates/answers.md` and the regenerated `skills/`.
- No new key: `Ctrl+Enter` stays the primary's. No dependency change. The shell chunk grows by about 1 KB. The change alters a card's rendering, so an e2e train is dispatched on its branch before merge (AGENTS.md, CI).
