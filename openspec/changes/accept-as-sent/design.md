# Design

## Context

Read on `origin/main` 95e7e31f. See proposal.md, Why. The PO handed this change over unattended ("mi fido delle tue decisioni", 2026-11-16): every decision below is taken here, with its reason, and none waits on `needs-po`.

**What refuses an untouched answer today.**

- `core`: `answered` (`core/src/lifecycle/acts.ts`) gets the widget content from `widgetContentOf` (`lifecycle/widget-values.ts:276`). That function drops every value equal to the item as sent (`sameAs`, a `canonicalize` comparison). `widgetChange` is then false, and `contentProblem` (`lifecycle/answers.ts:65`) refuses an answer with no label, no "Other…" text, no change and no result. The refusal is the core spec's scenario "Widget values equal to what was sent".
- `view`: `answer` (`shell/card-acts.ts:364`) sends only when `answerContentOf` gives a choice, values, results or "Other…" text. Otherwise it sends the note alone as a `note` act, which is what reached the agent in #263. "Answer" is disabled until the question has a choice, a widget change or a note.
- `board-host`'s `unchanged` (AD-20, reopen-start-from-answer decision 1) is not a carrier for this. It lists the items unchanged between two of the agent's revisions, appears only in the board state, and is never logged or returned to the agent.

**Which widgets cannot be answered unchanged.** The registry's widget types that declare `edits` (`contract/src/widgets/registry.ts:83`) are Tree, Gantt, Table, Kanban, Timeline and LaTeX. The `gantt-plan` and `wbs-pert` molecules expand to a Gantt and a Tree. On a question with no options, an untouched item of these types gives no content, so the question cannot be answered. The other answering widgets give a result, which counts as content:

- Ranking has "Keep this order".
- Approval has its decision.
- Scale, Chart, Document review and the Form's fields have their values, highlights or annotations.

The Form's fields start empty (AD-10), so the "Form over agent values" #263 names does not exist today: a Table is the review grid over agent values. Graph, Spreadsheet, Diagram, Diff review and Image annotation are not built. A future type that declares `edits` joins this change's rule with no further edit.

ADs relied on: AD-1 (imports), AD-7 (one minor per set), AD-8 (agent content as data), AD-10 (amended in place), AD-13 (references), AD-15 (Snapshot data), AD-20 (answers, delivery, drafts), AD-21 (reconnect). UX: EXPERIENCE.md Component Patterns (Question card: Question actions, Answer, Accept recommended; Board chrome: After an answer), Interaction Primitives (Explicit acts, Delivery, Focus), Accessibility Floor (Keyboard core), Voice and Tone, State Patterns (By surface). DESIGN.md Components (Question actions, Answer, Button).

## Goals / Non-Goals

**Goals:** one explicit click answers a review question with its content as sent; the agent receives an answer that says so in one field it cannot misread; `ask-core` accepts that answer only where it is true; the act takes "Answer"'s path in every respect.

**Non-Goals:**

- An undo or a "restore as sent" on the Tree (#262; Open Questions, 2).
- An agent-recorded `asSent` answer through `update` (Open Questions, 3).
- "No comments" acceptance for result widgets: Document review, Chart (Open Questions, 4).
- Any change to "Accept recommended", "Select recommended", the key tables or `Ctrl+Enter`.

## Decisions

### 1. One card action, "Accept as is", beside the primary

"Accept as is" (it-IT "Accetta così com'è", marked to review) is a `button-secondary` in the question actions row. It follows the primary and the primary's reason, and comes before "Later". It has no icon, so the shell imports no new icon. It is offered (`acceptAsSentOffered`, a new pure module `packages/view/src/shell/accept-as-sent.ts`) only when all of these hold:

- the question, as the card shows it (`shownOf`), has no options;
- the question holds at least one item, at any depth (`valueItemsOf`), whose type's component registered a changes shape (`componentFacts(type)?.shape`): the view-side mirror of the registry's `edits`;
- the question is to do, or in draft (a revision included): not answered, ready or declined, as "Accept recommended" (`offered` in `question-card.tsx`);
- every value the draft holds for those items gives no element change against the shown revision's props (`elementChanges(id, sent, held, shape).length === 0`, the contract's diff the agent-change notice already uses in `shell/widget-changes.ts`);
- no item of the question holds a result;
- the board is not locked and is no Snapshot.

A value moved and moved back therefore counts as no change, which is what the user sees. A type whose chunk has not registered its facts gives no shape. Its question gets no "Accept as is" until the chunk loads: fail closed, and the question is still loading anyway.

*Alternatives.* (a) Relabel the disabled primary "Accept as is" while nothing changed. Rejected: the primary and its key `Ctrl+Enter` would send two kinds of answer depending on state, and a stray `Ctrl+Enter` on an untouched card would accept content (decision 7). (b) A widget toolbar tool, as Ranking's "Keep this order". Rejected: a question may hold several edit widgets, and the acceptance is the question's, not one item's.

### 2. Never beside "Accept recommended"

"Accept as is" is offered only on questions with no options. "Accept recommended" exists only on questions with a recommended option. The two never share a card. On a question with options and an editable widget, the choice is the answer, through "Answer" or "Accept recommended". The untouched widget is reported unchanged, with no `changes`, as AD-10 already says: a choice is an explicit answer, and nothing in it can be misread as missing.

*Why not offer both:* an answer to an options question without a choice would leave the agent's actual question unanswered. Sending `asSent` with a choice would add a second meaning to every choice answer, which the agent would have to learn for no gain.

### 3. The wire form: `asSent: true`

- **Board protocol.** The `answer` act gains optional `asSent: true`. With it, `choice`, `other`, `optionNotes` and `results` are refused by the schema (`if`/`then`, as `declined` does in the event). `note`, `derived` and `values` stay admitted. The view sends no `values` (decision 5). `values` stays admitted so that `ask-core`, not the schema, owns the "equals as sent" check (decision 4).
- **Draft record.** A held answer gains optional `asSent: true` beside `byRecommended`, admitted on `act: "answer"` only.
- **Output format.** The answer event gains `asSent: true`. With it, `choice`, `other`, `optionNotes`, `changes`, `results` and `declined` are refused. It keeps `note`, `derived`, `replaces` and `tooLarge`.
- **Board state and `fetch`.** The current and previous answer (`board-state.json` `$defs/answer`) and `fetch`'s full answer (`fetch-result.json` `$defs/answer`) gain `asSent: true`, with the same exclusions.
- **Snapshot data** refers to both, so it admits the field with no schema edit of its own. Its minor moves anyway, as reopen-start-from-answer's did for `unchanged`: the data names the versions it follows.

*Why a field, and why this name.* An empty `changes` is refused by the schema (`minItems: 1`), and an absent `changes` already means "no edit" on every choice answer: neither says "the user accepted". `unchanged` is taken (Context). `accepted` would read as a verdict, and Approval already has one. `asSent` says what the user did, relative to what the agent sent, and is free on `main` (`git grep asSent origin/main` finds nothing).

### 4. `ask-core` accepts `asSent` only where it is true (NFR-10)

In `answered` (`acts.ts`), an act whose `asSent` is present must hold exactly `true`, or it is refused as `act`. An `asSent` answer must then pass `asSentProblem`, a new check in `lifecycle/answers.ts` that runs after `widgetContentOf`. It refuses with `content`, naming the question or the item, when:

- the act is a decline;
- the revision the act names (`propsFor`: the current one, or one kept by an `ignore` edit choice) has options;
- that revision holds no item, at any depth, whose type in `types` declares `edits`;
- the act carries `choice`, `other`, `optionNotes` or `results`;
- `widgetContentOf` kept any value, that is, a value differs from the item as sent.

`contentProblem` gains an `asSent` flag that counts as content, beside `widgetChange`. The existing `answerRequirementProblem` and `fieldCheckProblem` then run unchanged: a required field with no result refuses the answer, naming the field.

The event is `head`, then `contentOf(act)` (the note), then `asSent: true`, then the widget fields (`derived` only, since no value is kept), then `replaces`. `withinLimit` keeps `asSent` when it drops `derived`. `contentOf` itself is not widened, so a recorded answer through `update` can never carry `asSent`.

`AnswerContent` (`lifecycle/model.ts`) gains `asSent?: true`. `CONTENT` (`lifecycle/views.ts:81`) gains `"asSent"`, so `fullAnswer`, the board view and `fetch` carry it. Both `currentOf` copies carry it: `core/src/snapshot/state.ts:20` and `server/src/board-host/messages.ts:30`.

An answer with values equal to what was sent and no `asSent` is still refused, as today: the explicit act stays the only way to accept unchanged content (AD-10).

### 5. The view takes "Answer"'s path

`card-acts.ts` gains `acceptAsSent(question, context)` and an `asSent` option on `answer` and `pressAnswer`. With it:

- `blockedBy` gates first, as for "Answer" and "Accept recommended", so a failing field shows its reason and nothing is sent.
- The content is `answerContentOf(...)` with `values`, `choice` and `results` dropped and `asSent: true` added: only the note survives. `withDerived` counts `asSent` as answering content, so the derived values the question's computing items reported go with it, as they go with any answer (widget-answers decision 10).
- In immediate delivery one `answer` act is dispatched. In submitted delivery `toggleHeld(..., "answer")` holds it with `asSent: true` on the held record. `submitActsOf` (`shell/submit.ts:132`) builds an `asSent` act for such a hold, with no values.
- `pressAnswer`'s `asksFirst("answer", ...)` confirmation applies unchanged. It asks only where the question's items ask for a received verdict.
- `question-card.tsx` routes the press through its `onAnswer` path, with `runFlow("answer", outcome)`. The move After an answer, with its top alignment (answer-moves-to-top), and the focus moves follow with no new code.
- The status region says `status.acceptedAsIs` when the act is sent, and `status.ready` when it is held. The answered look reads `answer.line` with `answer.asSent` ("Accepted as is") when the answer the card shows carries `asSent`. `answerPartsOf` gains the case.
- "Edit" on a ready accepted answer unmarks it, as any ready answer. A revision that edits the widget then answers through "Answer" with `replaces`, as today.

The view's own message check (`view-protocol.ts`, `ANSWER`) gains `asSent` as a check (`oneOf(true)`), in `someOf`. `derivedAlone` treats it as answering content. The board page's `answerProblem` (`board-page/model.ts`) admits `asSent` and refuses it beside a choice, "Other…" text, values or results, or on a question with options at the current revision. The core still decides, so nothing on the page widens what can be appended.

### 6. Strings

New keys, en-US and it-IT (the Italian marked "to review" in EXPERIENCE.md's Voice and Tone):

- `question.acceptAsIs`: "Accept as is", "Accetta così com'è".
- `question.acceptAsIsHint`: "Answers with the content as the agent sent it.", "Risponde con il contenuto così come l'ha inviato l'agente." It is the button's accessible description, as the primary's reason is the primary's.
- `status.acceptedAsIs`: "Answer sent: accepted as is.", "Risposta inviata: accettata così com'è."
- `answer.asSent`: "Accepted as is", "Accettata così com'è".

### 7. Keys: none added

"Accept as is" is a card button in the Tab order, activated by Enter, Space or a click, like "Accept recommended", which has no key either. `Ctrl+Enter` stays the primary's (`answerKeyOf`). On an untouched card the primary is disabled, so the key sends nothing. Binding the key to the acceptance would let a held or stray key accept content the user never looked at, the failure #262 shows from the pointer side.

The change alters no widget's keys. No `KEY_VOCABULARY` entry, `KeyHint`, `KeysButton` or keys-panel row changes. `keys-coverage.test.ts` is untouched: the button is the card's, not a widget tool. The board keys panel's `Ctrl+Enter` row stays true as written.

### 8. Contract versions (askboard-contract-versioning)

The change widens four sets, each to the **next minor after main's**:

- output format: `asSent` on the answer event;
- board protocol: the act, the draft record's held answer, the board state's answer;
- tool envelopes: `fetch`'s answer, and `collect`, which names the output format;
- Snapshot data: through its references.

The input format, the board document, the view manifest, the configuration, the local API and the session file keep main's values. Group 0 records main's values. The constants are set to main's plus one when group 1 starts, and are bound at the rebase task. The binding line goes here then, dated, with main's SHA. Header comments, schema descriptions, fixture comments and test titles say "since accept-as-sent", never a number.

Bound on 2026-11-16, rebased onto origin/main 95e7e31f (main had not moved since the proposal): output format 1.14 (main 1.13), board protocol 1.15 (main 1.14), tool envelopes 1.15 (main 1.14), Snapshot data 1.5 (main 1.4); the other sets keep main's.

### 9. Teaching

`tools/build/skills/templates/answers.md` gains one bullet after `tooLarge`'s: an answer with `asSent: true` is the user's explicit acceptance of the question's content exactly as sent, carries no `changes`, may carry the note and the derived values, and is never a missing answer. `bun run build:skills` regenerates `skills/askboard/references/answers.md` (2,323 characters, within its 6,000 budget). No widget's teaching text says an untouched editable item gives no answer (checked: none of the six), so none changes.

### 10. Documents in the change

- **PRD.** The glossary "Answer", FR-22's paragraph and acceptance line, and NFR-10 list "Accept as is" beside "Answer" and "Accept recommended". FR-11 gains one sentence under its table: a question with no options whose widgets edit agent content can be answered with its content as sent.
- **Spine.** AD-10, "What becomes an answer", is amended in place: "Accept as is" answers a question with no options with its editable content as sent, reported as `asSent`, never as a chosen value; `ask-core` accepts it only on such a question with no change.
- **EXPERIENCE.md.** A new row "Accept as is" in Question card. "Answer" says it stays disabled on an untouched card where "Accept as is" answers. Interaction Primitives, Explicit acts, names the third act. Keyboard core and Focus name it beside "Accept recommended". Voice and Tone gets the four strings. State Patterns, By surface, gets a row "Editable widget untouched".
- **DESIGN.md.** "Question actions" places it. A new "Accept as is" row in Components. The Button row lists it among `button-secondary`.

## Merge points and borrowed seams

`openspec list` shows one change in flight, `early-benchmark`. It touches `packages/bench`, which only validates through the contract: no overlap, though it would see the new optional field if it validates collected answers. The open pull requests: none. `origin/worktree-feature-advance-to-top` and `origin/worktree-feature-palettes` were squash-merged as #257 and #235; their branches carry no unmerged work.

Borrowed names, all on `origin/main` 95e7e31f, re-checked by task 0.1 and at the rebase:

- contract: `WidgetType.edits` (`widgets/registry.ts:83`), `elementChanges` (`widgets/element-diff.ts:390`), `AnswerEvent` (`schemas/output/index.ts:100`), `CurrentAnswer` (`schemas/board-protocol/index.ts:374`), `FetchAnswer` (`schemas/tool-envelopes/index.ts:208`);
- core: `contentProblem`, `contentOf` (`lifecycle/answers.ts:65`, `:92`), `CONTENT` (`lifecycle/views.ts:81`), `currentOf` (`snapshot/state.ts:20`);
- server: `currentOf` (`board-host/messages.ts:30`);
- view: `componentFacts` (`catalog/port.ts:243`), `withDerived` and `pressAnswer` (`shell/card-acts.ts:198`, `:758`), `submitActsOf` (`shell/submit.ts:132`), `ANSWER` and `derivedAlone` (`view-protocol.ts:509`, `:530`), `answerPartsOf` (`shell/answered-look.ts:36`).

Seams this change adds: `asSent` on the five schemas; `acceptAsSentOffered`; `acceptAsSent`; `asSentProblem`; the four string keys.

## Risks / Trade-offs

- **View and core compare differently.** The view tests "no element change" and the core tests canonical equality. A value with no element change but a different canonical form would be one the diff cannot describe, which the core refuses anyway. The view sends no values with `asSent`, so the core sees none to compare. The risk left is the view offering the button where the core would refuse because of options or the edit types. Both read the same props and the same registry, and a refusal leaves the work in the draft (AD-10).
- **A submit refused whole.** A held `asSent` act the core refuses would refuse Submit's atomic command. The hold is made only when the button is offered, and the card is locked while ready, so the conditions cannot change under it, except through an agent update. An agent update raises the agent-change notice and disables Submit until the user chooses (existing behaviour).
- **Agents of an older skill** see an answer with no `changes` and an unknown `asSent`. They read it as "nothing changed", which is true. The regenerated skill states the meaning.
- **Rendering change.** The card's action row changes, so the pre-merge e2e train is dispatched on the branch (AGENTS.md, CI; the PO's answer on #227). Its failures are triaged against the last train on `main` before merge.

## Open Questions

None needs the PO. Notes for later work:

1. **The Italian strings** are marked to review, as every new Italian string is.
2. **#262 and "Restore as sent".** A per-item tool that drops the item's draft value would pair with this change: after an accidental move, one click restores the agent's content, and "Accept as is" is offered again (decision 1 already counts a value equal to what was sent as no change). It belongs to #262's fix, which also has to find the cause of the move. It is not folded in here.
3. **Recorded acceptance.** A user who says in the terminal "the plan is fine" cannot have it recorded with `update` as `asSent`, because the input format's recorded answer has no such field. That would widen the input format and FR-19's recorded answers. It is left until an agent needs it.
4. **Result widgets.** An untouched Document review or Chart gives no answer, and their teaching text tells the agent to add options. A "No comments" acceptance would be a result, not `asSent`, and belongs to those widgets.
