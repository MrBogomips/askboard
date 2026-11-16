# Design

## Context

Read on `origin/main` 95e7e31f. See proposal.md, Why. The PO handed this change over unattended ("mi fido delle tue decisioni", 2026-11-16): every decision below is taken here, with its reason, under that hand-over; none is the PO's answer, and none waits on `needs-po`.

**What refuses an untouched answer today.**

- `core`: `answered` (`core/src/lifecycle/acts.ts`) gets the widget content from `widgetContentOf` (`lifecycle/widget-values.ts:276`). That function drops every value equal to the item as sent (`sameAs`, a `canonicalize` comparison). `widgetChange` is then false, and `contentProblem` (`lifecycle/answers.ts:65`) refuses an answer with no label, no "Other…" text, no change and no result. The refusal is the core spec's scenario "Widget values equal to what was sent".
- `view`: `answer` (`shell/card-acts.ts:364`) sends only when `answerContentOf` gives a choice, values, results or "Other…" text. Otherwise it sends the note alone as a `note` act, which is what reached the agent in #263. "Answer" is disabled until the question has a choice, a widget change or a note.
- The board state's `unchanged` (AD-20) is no carrier: it compares two of the agent's revisions and never reaches the agent.

**Which widgets cannot be answered unchanged.** The registry's widget types that declare `edits` (`contract/src/widgets/registry.ts:83`) are Tree, Gantt, Table, Kanban, Timeline and LaTeX. The `gantt-plan` and `wbs-pert` molecules expand to a Gantt and a Tree. On a question with no options, an untouched item of these types gives no content, so the question cannot be answered. The other answering widgets (Ranking, Approval, Scale, Chart, Document review, the Form's fields) give a result, which counts as content. The Form's fields start empty (AD-10), so the "Form over agent values" #263 names does not exist today: a Table is the review grid over agent values. A future type that declares `edits` joins this change's rule with no further edit.

ADs relied on: AD-1 (imports), AD-7 (one minor per set), AD-8 (agent content as data), AD-10 (amended in place), AD-13 (references), AD-15 (Snapshot data), AD-20 (answers, delivery, drafts), AD-21 (reconnect). UX: EXPERIENCE.md Component Patterns (Question card: Question actions, Answer, Accept recommended; Board chrome: After an answer), Interaction Primitives (Explicit acts, Delivery, Focus), Accessibility Floor (Keyboard core), Voice and Tone, State Patterns (By surface). DESIGN.md Components (Question actions, Answer, Button).

## Goals / Non-Goals

**Goals:** one explicit click answers a review question with its content as sent; the agent receives an answer that says so in one field it cannot misread; `ask-core` accepts that answer only where it is true; the act takes "Answer"'s path in every respect.

**Non-Goals:**

- An undo or a "restore as sent" on the Tree (#262; Open Questions, 1).
- An agent-recorded `asSent` answer through `update` (Open Questions, 2).
- "No comments" acceptance for result widgets: Document review, Chart (Open Questions, 3).
- Any change to "Accept recommended", "Select recommended", the key tables or `Ctrl+Enter`.

## Decisions

### 1. One card action, "Accept as is", beside the primary

"Accept as is" (it-IT "Accetta così com'è", marked to review) is a `button-secondary` in the question actions row. It follows the primary and the primary's reason, and comes before "Later". It has no icon, so the shell imports no new icon. It is offered (`acceptAsSentOffered`, a new pure module `packages/view/src/shell/accept-as-sent.ts`) only when all of these hold:

- the question, as the card shows it (`shownOf`), has no options;
- the question holds at least one item, at any depth (`valueItemsOf`), whose type's component registered a changes shape (`componentFacts(type)?.shape`): the view-side mirror of the registry's `edits`;
- the question is to do, or in draft (a revision included): not answered, ready or declined, as "Accept recommended" (`offered` in `question-card.tsx`);
- the card shows the question's current revision and its work names it: `shown.rev === question.rev === revisionFor(question, work)`, with no item the card makes read-only (decision 11, D-B);
- every value the draft holds for those items gives no element change against the shown revision's props (`elementChanges(id, sent, held, shape).length === 0`, the contract's diff the agent-change notice already uses in `shell/widget-changes.ts`);
- no item holds a result, except an input field, whose type declares a field check (decision 11, D-A);
- the board is not locked and is no Snapshot.

A value moved and moved back therefore counts as no change, which is what the user sees. A type whose chunk has not registered its facts gives no shape. Its question gets no "Accept as is" until the chunk loads: fail closed, and the question is still loading anyway.

*Alternatives.* (a) Relabel the disabled primary "Accept as is" while nothing changed. Rejected: the primary and its key `Ctrl+Enter` would send two kinds of answer depending on state, and a stray `Ctrl+Enter` on an untouched card would accept content (decision 7). (b) A widget toolbar tool, as Ranking's "Keep this order". Rejected: the acceptance is the question's, not one item's.

### 2. Never beside "Accept recommended"

"Accept as is" is offered only on questions with no options. "Accept recommended" exists only on questions with a recommended option. The two never share a card. On a question with options and an editable widget, the choice is the answer, through "Answer" or "Accept recommended". The untouched widget is reported unchanged, with no `changes`, as AD-10 already says: a choice is an explicit answer, and nothing in it can be misread as missing. Offering both would leave the options unanswered, or give every choice answer a second meaning.

### 3. The wire form: `asSent: true`

- **Board protocol.** The `answer` act gains optional `asSent: true`. With it, `choice`, `other` and `optionNotes` are refused by the schema (`dependentSchemas`). `note`, `derived`, `results` (decision 11, D-A) and `values` stay admitted. The view sends no `values` (decision 5). `values` stays admitted so that `ask-core`, not the schema, owns the "equals as sent" check (decision 4).
- **Draft record.** A held answer gains optional `asSent: true` beside `byRecommended`, admitted on `act: "answer"` only.
- **Output format.** The answer event gains `asSent: true`. With it, `choice`, `other`, `optionNotes`, `changes` and `declined` are refused. It keeps `note`, `results`, `derived`, `replaces` and `tooLarge`.
- **Board state and `fetch`.** The current and previous answer (`board-state.json` `$defs/answer`) and `fetch`'s full answer (`fetch-result.json` `$defs/answer`) gain `asSent: true`, refusing `choice`, `other`, `optionNotes`, `declined` and `values`, and admitting `results`. Only edit items have values, and an accepted answer keeps none. `fetch` also refuses `recorded` beside `asSent`: an agent-recorded answer never carries it (decision 4).
- **Snapshot data** refers to both, so it admits the field with no schema edit of its own. Its minor moves anyway, as reopen-start-from-answer's did for `unchanged`: the data names the versions it follows.

*Why a field, and this name.* An empty `changes` is refused (`minItems: 1`), and an absent one already means "no edit" on every choice answer. `unchanged` is taken (Context), and `accepted` would read as a verdict. `asSent` was free on `main`.

### 4. `ask-core` accepts `asSent` only where it is true (NFR-10)

In `answered` (`acts.ts`), an act whose `asSent` is present must hold exactly `true`, or it is refused as `act`. An `asSent` answer must then pass `asSentProblem`, a new check in `lifecycle/answers.ts` that runs after `widgetContentOf`. It refuses with `content`, naming the question or the item, when:

- the act is a decline;
- the act names a revision other than the question's current one, even one kept by an `ignore` edit choice (decision 11, D-B);
- the current revision has options;
- that revision holds no item, at any depth, whose type in `types` declares `edits`;
- the act carries `choice`, `other` or `optionNotes`, or a result for an item whose type declares no field check (decision 11, D-A);
- `widgetContentOf` kept any value, that is, a value differs from the item as sent.

`contentProblem` gains an `asSent` flag that counts as content, beside `widgetChange`. The existing `answerRequirementProblem` and `fieldCheckProblem` then run unchanged. A required field with no result refuses the answer, naming the field. A filled one passes, and its result is logged in the event's `results`.

The event is `head`, then `contentOf(act)` (the note), then `asSent: true`, then the widget fields (the input fields' `results` and `derived`, since no value is kept), then `replaces`. `withinLimit` keeps `asSent` when it drops `derived`. `contentOf` itself is not widened, so a recorded answer through `update` can never carry `asSent`.

`AnswerContent` (`lifecycle/model.ts`) gains `asSent?: true`. `CONTENT` (`lifecycle/views.ts:81`) gains `"asSent"`, so `fullAnswer`, the board view and `fetch` carry it. Both `currentOf` copies carry it: `core/src/snapshot/state.ts:20` and `server/src/board-host/messages.ts:30`.

An answer with values equal to what was sent and no `asSent` is still refused, as today: the explicit act stays the only way to accept unchanged content (AD-10).

### 5. The view takes "Answer"'s path

`card-acts.ts` gains `acceptAsSent(question, context)` and an `asSent` option on `answer` and `pressAnswer`. With it:

- `answer` re-checks the current revision (decision 11, D-B) and sends nothing otherwise.
- `blockedBy` gates first, as for "Answer" and "Accept recommended". While a required field is empty the button is disabled, not hidden, with "Complete {label} first.", and nothing is sent.
- The content is `answerContentOf(...)` with `values` and `choice` dropped, `asSent: true` added, and the input fields' results kept (decision 11, D-A). `withDerived` counts `asSent` as answering content, so the derived values the question's computing items reported go with it, as they go with any answer (widget-answers decision 10).
- In immediate delivery one `answer` act is dispatched. In submitted delivery `toggleHeld(..., "answer")` holds it with `asSent: true` on the held record. `submitActsOf` (`shell/submit.ts:132`) builds an `asSent` act for such a hold, with no values.
- `pressAnswer`'s `asksFirst("answer", ...)` confirmation applies unchanged. It asks only where the question's items ask for a received verdict.
- `question-card.tsx` routes the press through `onAnswer` and `runFlow("answer", outcome)`, so the move After an answer and the focus moves follow.
- The status region says `status.acceptedAsIs` when the act is sent, and `status.ready` when it is held. The answered look reads `answer.line` with `answer.asSent` ("Accepted as is") when the answer the card shows carries `asSent`. `answerPartsOf` gains the case.
- "Edit" on a ready accepted answer unmarks it, as any ready answer. A revision that edits the widget then answers through "Answer" with `replaces`, as today.

The view's own message check (`view-protocol.ts`, `ANSWER`) gains `asSent` as a check (`oneOf(true)`), in `someOf`. `derivedAlone` treats it as answering content. The board page's `answerProblem` (`board-page/model.ts`) admits `asSent` and refuses it beside a choice, "Other…" text or values, on a revision that is not current, or on a question with options. The core still decides, so nothing on the page widens what can be appended.

### 6. Strings

New keys, en-US and it-IT (the Italian marked "to review" in EXPERIENCE.md's Voice and Tone):

- `question.acceptAsIs`: "Accept as is", "Accetta così com'è".
- `question.acceptAsIsHint`: "Answers with the content as the agent sent it.", "Risponde con il contenuto così come l'ha inviato l'agente." It is the button's accessible description, as the primary's reason is the primary's.
- `status.acceptedAsIs`: "Answer sent: accepted as is.", "Risposta inviata: accettata così com'è."
- `answer.asSent`: "Accepted as is", "Accettata così com'è".

### 7. Keys: none added

"Accept as is" is a card button in the Tab order, activated by Enter, Space or a click, like "Accept recommended", which has no key either. `Ctrl+Enter` stays the primary's (`answerKeyOf`). On an untouched card the primary is disabled, so the key sends nothing. Binding the key to the acceptance would let a held or stray key accept content the user never looked at, the failure #262 shows from the pointer side.

No widget's keys change: no `KEY_VOCABULARY` entry, `KeyHint`, `KeysButton` or keys-panel row, and `keys-coverage.test.ts` is untouched (the button is the card's, not a widget tool).

### 8. Contract versions (askboard-contract-versioning)

The change widens four sets, each to the **next minor after main's**:

- output format: `asSent` on the answer event;
- board protocol: the act, the draft record's held answer, the board state's answer;
- tool envelopes: `fetch`'s answer, and `collect`, which names the output format;
- Snapshot data: through its references.

The other sets keep main's values. The constants are bound at the rebase task, with the binding line below. Comments, schema descriptions and test titles say "since accept-as-sent", never a number. Decision 11 adds no field to any set: it changes which fields are admitted beside `asSent`, inside the same minors.

Bound on 2026-11-16, rebased onto origin/main 95e7e31f (main had not moved since the proposal): output format 1.14 (main 1.13), board protocol 1.15 (main 1.14), tool envelopes 1.15 (main 1.14), Snapshot data 1.5 (main 1.4); the other sets keep main's. Re-checked on 2026-11-16 after the review fixes, rebased onto origin/main 816a737e (tree-edit-undo merged, no set moved): the same four minors, each main's plus one.

### 9. Teaching

`tools/build/skills/templates/answers.md` gains one bullet after `tooLarge`'s: an answer with `asSent: true` is the user's explicit acceptance of the question's content exactly as sent, carries no `changes`, may carry the note, the input fields' `results` (decision 11, D-A) and the derived values, and is never a missing answer. `bun run build:skills` regenerates `skills/askboard/references/answers.md` (2,323 characters, within its 6,000 budget). No widget's teaching text says an untouched editable item gives no answer (checked: none of the six), so none changes.

### 10. Documents in the change

- **PRD.** The glossary "Answer", FR-22's paragraph and acceptance line, and NFR-10 list "Accept as is" beside "Answer" and "Accept recommended". FR-11 gains one sentence under its table: a question with no options whose widgets edit agent content can be answered with its content as sent.
- **Spine.** AD-10, "What becomes an answer", is amended in place: "Accept as is" answers a question with no options with its editable content as sent, reported as `asSent`, never as a chosen value; `ask-core` accepts it only on such a question with no change.
- **EXPERIENCE.md.** A new row "Accept as is" in Question card. "Answer" says it stays disabled on an untouched card where "Accept as is" answers. Interaction Primitives, Explicit acts, names the third act. Keyboard core and Focus name it beside "Accept recommended". Voice and Tone gets the four strings. State Patterns, By surface, gets a row "Editable widget untouched".
- **DESIGN.md.** "Question actions" places it. A new "Accept as is" row in Components. The Button row lists it among `button-secondary`.

### 11. Review decisions (2026-11-16)

The coordinator took these after the pre-PR reviews, under the PO's unattended hand-over. They are not the PO's answer.

**D-A: input fields' results travel with an acceptance (closes S-1).** "Accepted as sent" means the question's edit widgets are unchanged. Before this, an untouched Table beside a required TextField could never be accepted: the button sent no results, and the field check refused the answer. Results are now admitted beside `asSent` for items whose type declares a `fieldCheck` in the registry: TextField, NumberField, MoneyField, DateField, Toggle and PickField. The field checks must pass. The button is disabled with the field's reason while a required field is empty, stays offered once it is filled, and sends the results.

Why `fieldCheck` and not "every type without `edits`": the other result types give the user's own verdict or work on the question. An Approval's "Reject" or a moved Ranking beside an answer labelled "Accepted as is" would contradict it. Those results keep "Answer" as their path, and the core refuses them beside `asSent`. No shipped type declares both `edits` and a result.

**D-B: only on the current revision (closes X-1, X-2).** After "Keep mine", the card shows an older revision, or a revision with items read-only. An acceptance there would claim the agent's current content was accepted, while the user saw other content: `fetch`, Snapshots and the card would then disagree with the claim. So the view offers "Accept as is" only on the current revision, with nothing read-only, and `answer` re-checks this. The core refuses an `asSent` answer whose `rev` is not current, even a kept one (fail closed, NFR-10), with `content` naming the current revision. The path back is "Reload, losing my work", which shows the current revision, where "Accept as is" is offered again.

## Merge points and borrowed seams

`openspec list` shows one change in flight, `early-benchmark`. It touches `packages/bench`, which only validates through the contract: no overlap, though it would see the new optional field if it validates collected answers. No pull request was open.

Borrowed names, all on `origin/main` 95e7e31f, re-checked by task 0.1 and at the rebase:

- contract: `WidgetType.edits` (`widgets/registry.ts:83`), `elementChanges` (`widgets/element-diff.ts:390`), `AnswerEvent` (`schemas/output/index.ts:100`), `CurrentAnswer` (`schemas/board-protocol/index.ts:374`), `FetchAnswer` (`schemas/tool-envelopes/index.ts:208`);
- core: `contentProblem`, `contentOf` (`lifecycle/answers.ts:65`, `:92`), `CONTENT` (`lifecycle/views.ts:81`), `currentOf` (`snapshot/state.ts:20`);
- server: `currentOf` (`board-host/messages.ts:30`);
- view: `componentFacts` (`catalog/port.ts:243`), `withDerived` and `pressAnswer` (`shell/card-acts.ts:198`, `:758`), `submitActsOf` (`shell/submit.ts:132`), `ANSWER` and `derivedAlone` (`view-protocol.ts:509`, `:530`), `answerPartsOf` (`shell/answered-look.ts:36`).

Seams this change adds: `asSent` on the five schemas; `acceptAsSentOffered`; `acceptAsSent`; `asSentProblem`; the four string keys.

## Risks / Trade-offs

- **View and core compare differently.** The view tests "no element change" and the core tests canonical equality. A value with no element change but a different canonical form would be one the diff cannot describe, which the core refuses anyway. The view sends no values with `asSent`, so the core sees none to compare. The risk left is the view offering the button where the core would refuse (options, edit types, the revision, a result type). Both read the same props, registry and revision, and a refusal leaves the work in the draft (AD-10).
- **A submit refused whole.** A held `asSent` act the core refuses would refuse Submit's atomic command. The hold is made only where the button is offered, and a ready card is locked; an agent update raises the agent-change notice, which disables Submit until the user chooses.
- **Rendering change.** The card's action row changes, so the pre-merge e2e train is dispatched on the branch (AGENTS.md, CI; the PO's answer on #227). Its failures are triaged against the last train on `main` before merge.

## Open Questions

None needs the PO. Notes for later work:

1. **#262 and "Restore as sent".** A per-item tool that drops the item's draft value would pair with this change: "Accept as is" is then offered again (decision 1). It belongs to #262's fix.
2. **Recorded acceptance.** A user who says in the terminal "the plan is fine" cannot have it recorded with `update` as `asSent`, because the input format's recorded answer has no such field. That would widen the input format and FR-19's recorded answers. It is left until an agent needs it.
3. **Result widgets.** An untouched Document review or Chart gives no answer, and their teaching text tells the agent to add options. A "No comments" acceptance would be a result, not `asSent`, and belongs to those widgets.
