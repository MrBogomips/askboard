# Design

## Context

Read on `origin/main` 8e2e1247. See proposal.md, Why.

**What happens on reopen.**

- `core`: `update`'s `reopen` (`core/src/lifecycle/updates.ts:361`) keeps the latest answer as `previous` (`fullAnswer`, `lifecycle/views.ts:86`). `BoardModel.reopen` (`lifecycle/model.ts:357`) then starts a revision from the current props, which are the agent's. The user's edited values stay in the kept answers (`AskCore.keptAnswerValues`, `core.ts:486`). The board state's `previous` carries them as `values` and `results` (`answerView`, `views.ts:109`).
- `view`: the reopened card is `open`, so `cardState` gives it no `shown` (`shell/question-state.ts`). `answeredOf` skips it (`shell/board-content.ts:74`), so every item shows its props as sent.
- "Start from my previous answer" (`question-card.tsx:518`) calls `fillFrom` (`shell/card-acts.ts:500`). `fillFrom` sets the choice, "Other…", notes, note and results (approval-scale-ranking decision 6), but never reads `content.values`. `ReopenedNotice`'s "Previous answer" box (`change-notice.tsx:175`) shows choices and notes only. Nothing on the card shows or restores an edit.

**Where it diverges from the documents.**

1. EXPERIENCE (Component Patterns, Reopened question) and DESIGN.md (Reopened question) say the card starts "with nothing carried over (AD-10)", and that the button "moves it into the draft". The spec agrees ("Reopened question", `openspec/specs/view-and-widgets/spec.md:721`). The start matches. The button does not, for edit widgets: their values are never moved. The PRD is silent on what the board shows after an agent's reopen. AD-20 says only that a reopen "starts a new revision with no answer", which concerns the answer state, not the draft. AD-10's "start with nothing chosen and no value set" concerns what the agent recommends.
2. A second path loses edits the same way. On an answered question, `revise` (`question-card.tsx:425`) seeds no widget value (molecules decision 11, option A): an item the revision leaves alone shows its answer's value through `BoardContent.shown`. `answer` sends only the draft (`answerContentOf`, `board-draft.ts:659`). So a revision that edits one widget and leaves another edited widget alone sends no value for the second. `ask-core` reads that as no change, and the edit the card showed is lost. This breaks AD-10 (sent equals shown) and the spec's "Revising the WBS … carries both edited values" for any two unlinked widgets. widget-answers' design said "the draft starts from the logged values"; molecules decision 11 left the question to it, and it was never settled.

ADs relied on: AD-7, AD-10, AD-13, AD-20, AD-21. UX: EXPERIENCE Component Patterns (Reopened question) and Voice and Tone (Reopened question rows); DESIGN.md Reopened question.

## Goals / Non-Goals

**Goals:** a reopened question starts from the user's answer when it safely can, and otherwise says that it does not; carrying an answer brings back edits; what an answer sends equals what the card shows.

**Non-Goals:**

- Showing widget values or results in the "Previous answer" box: the widgets themselves show a carried answer.
- Carrying an edit onto an item the agent changed. That would revert the agent's change and log the revert as the user's (NFR-10).
- Any change to `ask-core`'s answer checks, `changes` or tool results.
- Skill or tool text.

## Decisions

### 1. `ask-core` says what an answer's revision shares with the current one

After a reload or a takeover the page holds only the current revision (keep-mine-shown-revision decision 2). So it cannot tell whether the agent changed an item after the answer. `answerView` gains `unchanged` for the current and the previous answer (core spec):

- the question's ID, when its props in the current revision equal, whole, those of the revision the answer names;
- each item's ID, at any depth (`nestedItemsOf`), whose type and props are equal in both, a layout compared with each item inside it replaced by its ID (a change inside a Group lists the Group; a new member does not);
- compared with `canonicalize` (`core/src/canonical.ts:20`), over expanded items, on the props as the board shows them: `boardPropsOf(props, question.context.get(rev))` for each revision, so an excerpt or image read again at the reopen counts, and a file reference counts by what the card shows of it (the file's presence and its anchor lines, not its content); a pointer whose read timed out or was too large at either revision counts as changed, since the comparison cannot tell (re-review 1.9 X-1; proposed default accepted under the PO's unattended handoff), and one unresolved for another reason (`not-found`, `no-root`, `outside-root`) compares as itself (review 1.3 X-1; `#prune` keeps a revision's context with its props).

The revision an answer names is the logged event's `rev`. For a recorded answer it is the revision current when it was recorded, which a recorded question keeps until it is reopened. `QuestionRecord` gains `previousRev`, set by `reopen`. The model keeps that revision's props while `previous` names it, beside the revisions events name. The result is memoised per question and pair of revisions, keeping only the pairs whose current revision is the question's current one (review 1.3 X-2).

**When the field is present** (amended by `/opsx:update` on 2026-11-08, after group 1 found that sending it on every answer rewrites E1's frozen transcripts; proposed default accepted under the PO's unattended handoff of 2026-11-08):

- `unchanged` is present exactly when the answer names a revision earlier than the question's current one, and then lists the IDs unchanged since it, possibly none (`[]`).
- It is absent when the answer names the current revision: the question and every item are unchanged by definition, so the field would say nothing. The board state of every answered question therefore stays byte for byte as before, E1's transcripts included.
- When `ask-core` cannot compare (the earlier revision is not held, or `canonicalize` refuses a value), it sends `[]`, never nothing (NFR-10): absence would read as "all unchanged".
- A previous answer always carries the field, since a reopen starts a new revision (`BoardModel.reopen` calls `revise`). A current answer carries it only when it was given on an earlier revision ("Keep mine", then "Answer"; an answered or recorded question refuses the agent's `change` until it is reopened).
- The board reads it by the answer's role (decision 2): a current answer without the field holds every item unchanged; a previous answer without it holds none, so a field lost on the way never carries a value (fail closed).

*Alternatives:* (a) the view's `Revisions` store, which a reload empties; (b) sending the answered revision's props to the page, which means a larger board state for the same answer; (c) `unchanged` on every answer, as first built: it rewrites E1's frozen transcripts (`plainChoice`, `duplicateAnswer`, `resendAfterDrop`), the lifecycle `submit` and widget answer transcripts and the Snapshot's "after submit" state, for a field that says nothing on the current revision; (d) the inverse, `changed`, absent when nothing changed: as small on the wire, but a field lost on the way, or a comparison that fails, then reads as "all unchanged" on the previous answer, the one path that carries values over the agent's changes; (e) `unchanged` left out when empty, as first built, with a `rev` added to each answer so the board can tell "current" from "none": a new field on every answer, which rewrites the same transcripts.

### 2. One rule for carrying an answer into the draft

One reader, `unchangedOf(answer, role)` in `shell/question-state.ts`, gives what an answer holds unchanged, by decision 1's rule: the listed IDs when the answer carries `unchanged`; otherwise every ID for the `current` answer and none for the `previous` one. `fillFrom` takes the answer and its role and, for each value item of the question's revision (`valueItemsOf`, at any depth), puts the answer's value into the draft only when both hold:

- the item's ID is unchanged by `unchangedOf`;
- `valueFits(question, itemId, value)` (`board-draft.ts:232`) holds.

Every other value item gets `undefined`, so it shows as sent. Results, the choice, notes and the note are carried as today. Three callers use this rule:

- "Start from my previous answer", with the `previous` answer;
- `revise` (open question 2, which closes divergence 2), with the `current` answer;
- the reopen prefill (decision 3), with the `previous` answer.

`revise` now seeds the answer's values, which reverses that part of molecules decision 11. The draft then holds what the next answer sends. The change marks already compare with the agent's revision. The counters count edits the answer will carry, which is what they should count. `BoardContent.shown` stays as it is for items before the first edit.

`fillFrom` also returns whether every part of the answer it was given was carried: each value, each result, and each chosen label. The prefill reads that.

*Alternative:* `answer` merges `shown` values at send time. Then the draft no longer equals the answer, and Submit, "Select recommended", the field block and the counters each need the same merge.

### 3. The reopen prefill

A pure function in a new `shell/reopen-prefill.ts` takes the document, the board state, the draft record and the question work. It returns the questions to fill, those that meet all of these:

- the state is `open` or `postponed`, with a `previous` answer that is not a decline;
- `unchangedOf(previous, "previous")` holds the question's own ID (open question 3), so a previous answer without the field fills nothing;
- the question holds no work on its current revision;
- its work holds no `prefilled` mark for that revision.

The shell (`shell/index.tsx`, `channel.onUpdate` at `:258`) runs the function at the end of every update the board page sends, after that update's `restore` is applied, and never on the boot data alone. Decision 9 makes the first update after a reload or a takeover carry the restore whenever `board-host` held a record, so an update with no restore before it means there is none. For each question returned, it dry-runs the carry:

- if every part fits, it calls `fillFrom` with `previous` and sets the mark;
- otherwise it fills nothing and sets nothing. The check gives the same answer on the next update, since its inputs have not changed.

A question that held work when it was reopened is filled only once that work is gone, for example after "Reload, losing my work".

Nothing is sent (AD-10). The draft mirror carries the result as any edit does.

Postponed reopened questions qualify: a postpone does not change the answer they started from.

*Alternatives:* per-item prefill (open question 3); the prefill on the card's mount, which a card scrolled out of view or in another area's tab never runs.

### 4. The mark in the draft record

`draft-record.json`'s question gains `prefilled` (`const: true`). Three readers change:

- `QuestionWork` carries the mark;
- `restoreDraft` (`board-draft.ts:543`) keeps it for the revision it names and drops it with the rest of a stale revision;
- `hasUnsentWork` (`board-page/unsent-work.ts:24`) and `hasAnswerWork` (`board-draft.ts:293`) ignore an entry that holds the mark and nothing else.

"Reload, losing my work" drops the entry and its mark, as it drops any work. A prefilled draft is unsent work like any other (open question 4). `oversized-acts` decision 4, once merged, fits the record whatever it holds.

*Alternative:* no mark, filling again any reopened question with an empty draft after a reload. That would restore edits the user had undone.

### 5. The notice says where the question started

`ReopenedNotice` gains `carried: boolean`, true while the question's work on its current revision holds the mark. It shows one line under the title, and its button stays as it is:

- carried: `reopened.carried`;
- not carried: `reopened.notCarried`.

The texts are in proposal.md, open question 5. Both keys go into `keys.ts`, `en-US.ts` and `it-IT.ts`; the Italian is to review.

### 6. Derived values

keep-mine-shown-revision decision 7 holds unchanged. An answer to a reopened question names its current revision, so `answer` and Submit attach the reported derived values. The live graph reads `BoardContent.shown`, which is the draft, prefilled values included, so the values match what the board shows (FR-12, AD-13).

### 7. Versions (askboard-contract-versioning)

Main holds board protocol 1.8 and Snapshot data 1.1 (read at 8e2e1247; task 0.1 re-reads them). Two sets widen, each to the **next minor after main's**:

- the **board protocol**: `unchanged` in board state answers, and `prefilled` in the draft record;
- the **Snapshot data**: its schema refers to the board state, as widget-registry's `results` did, and its board state carries `unchanged` as the live board receives it (decision 10).

Every other set keeps main's value. Decision 9 changes the order of the opening, not a schema: the draft message keeps its shape, takes no minor of its own, and only `draft.json`'s `description` says the new order. The numbers are bound at the rebase task, with the binding line here.

Binding: (filled at task 4.2) "Bound on <date>, rebased onto origin/main <sha>: board protocol <n> (main <m>), Snapshot data <n> (main <m>)."

### 8. Documents

- **EXPERIENCE**, Component Patterns, Reopened question, becomes: the card starts from the user's previous answer when the agent changed nothing else and it all still fits, and says so; otherwise it starts from the agent's new revision and says so. The previous answer shows read-only, and "Start from my previous answer" moves into the draft what still fits. Nothing is sent until the user answers (AD-10, AD-20; reopen-start-from-answer).
- **EXPERIENCE**, Voice and Tone: both Reopened question rows gain the two lines.
- **DESIGN.md**, Reopened question: "with nothing selected" becomes "from the previous answer or from the agent's revision, as its line under the title says".
- **Spine AD-10**, the "Choice and input widgets start with nothing chosen…" bullet, gains: "A question the agent reopens may start from the user's own previous answer, which the user still sends by an explicit act (AD-20)." Amended in place.
- **Spine AD-20**, Drafts: the per-question list gains "whether the board started the revision from the question's previous answer", and "A reconnecting or taking-over board restores it from `ask-core`" gains ", which `board-host` sends before the board state, so the view takes both together" (decision 9). Amended in place.
- **PRD FR-6** gains one consequence: "When the agent reopens an answered question and changes nothing else, the board starts it from the user's previous answer and says so; otherwise it says it starts from the agent's version, and the user can start from the previous answer explicitly."
- `updated:` and `sources:` follow each document's convention.

### 9. On connect, the held draft comes before the state

Task 0.1 found that the shell cannot tell "no restore" from "restore not here yet": `board-host`'s opening sends the board, the state, then the draft only when `ask-core` holds one (`Boards.#openers`, `server/src/board-host/boards.ts:586`), and the board page hands the view a restore only when a draft message came (`#onDraft`, `view/src/board-page/controller.ts:774`). Running the prefill before the restore is not safe: the prefill fills the draft, the mirror sends it, and the page then ignores `board-host`'s record because it holds one of its own, so the restored work is lost (NFR-10).

The opening sends the draft before the state: settings, board, draft (when held), state, closed, origin, agent. Nothing else changes:

- `board-host`: the draft opener moves one place up in `#openers`; the takeover still opens the new tab once the flush ends (AD-21), so the record it restores is the older tab's last one, as today.
- The board page: `#onDraft` keeps the restore and calls `#updateView` only once the socket's state has been seen (`#stateSeen`), so the restore reaches the view together with the socket's first state, never with a previous socket's state. The view loads only after a socket's first state (`#onState`, `#loadView`), so its first update carries the restore whenever one was held. The page still takes a draft after the state, as today's order sends it.
- The shell: the prefill runs at the end of each update (decision 3). After the first update, a later restore comes only on a reconnect of a page that holds no draft of its own, whose shell then holds no work either; that update applies the restore before the prefill runs.

This reorders an entry of `#openers`, a table push-delivery made, where askboard-contract-versioning Rule 3 asks to append. No change in flight edits `#openers`, `#onDraft` or `board-host`'s requirement "Board protocol over a WebSocket" (branches read on 2026-11-08), so the move is recorded here and re-checked at the rebase task.

*Alternatives:*

- (a) as task 0.1 put it: `board-host` always sends a draft message at open, an empty record when it holds none. Rejected: `board-host` would invent a record, with a delivery mode taken from the document, that the shell then restores over its initial state; and every opening gains a message, which moves every opening-order test and the browser harness's sequences.
- (b) a `restoreSettled` flag in the `ViewUpdate`, set after a host "opened" marker. Rejected: the marker is a new board-protocol message and the flag a new `UPDATE_FIELDS` member, for what the order alone says.
- (c) the prefill only on a later state or on the first user act. Rejected: after a plain reload with the agent idle no later state comes, so the Issue's own steps fail; and a first act that refills the card under the user's pointer is worse than no prefill.

Decision: the order change, the smallest form of (a); proposed default accepted under the PO's unattended handoff of 2026-11-08.

### 10. The wire: `board-host` and the Snapshot pass `unchanged` as `ask-core` gives it

Group 1 found no step that takes `unchanged` from `ask-core`'s view to the page. Two functions copy an answer field by field and both drop it:

- `board-host`'s `currentOf` (`server/src/board-host/messages.ts:28`), for the current and the previous answer of `stateOf`;
- the Snapshot's `currentOf` (`core/src/snapshot/state.ts:18`), whose rule is `stateOf`'s, since `ask-core` may not import `board-host` (AD-1).

Each gains the one line that copies `unchanged` when the view holds it, `[]` included (a check on `undefined`, never on length or truth), as a new array. Nothing else moves: `fetch`, `collect`, the log and the local API never read `AnswerView.unchanged`.

The Snapshot passes it too, though the Snapshot view runs no prefill and has no "Start from my previous answer" act:

- core's "What a Snapshot holds" says the data holds "the board state the live board receives", and `board-host`'s test "a Snapshot's state is the one a board receives" (`server/test/board-host/snapshot-protocol.test.ts:207`) replays each E3 transcript, one of which reopens `region`; a Snapshot without the field would break both;
- the Snapshot data takes its minor (decision 7) for this field alone, so leaving it out would bump a set for nothing;
- by decision 1, the field is present only on previous answers and on answers kept on an earlier revision, so a Snapshot of answered questions, the "after submit" test's included, stays as it is.

The shell reads a Snapshot from its boot data, on which the prefill never runs (decision 3).

*Alternative:* `board-host` only, as the implementer's reverted patch did. Rejected for the three reasons above.

Decision: both; proposed default accepted under the PO's unattended handoff of 2026-11-08.

## Merge points

Read on 2026-11-08. If one merges first, the rebase keeps both sides and re-checks the names.

| Change | Head | Overlap | What it takes |
|---|---|---|---|
| `oversized-acts` (#88) | `worktree-fix-oversized-acts` 25bfc33c | `card-acts.ts` (`dispatch`, `sendActs` gain `via` and `notices`), `question-card.tsx` (`SizeNotices`), strings, the draft fit (its decision 4); no version | Keep both sides. A prefilled question too large for the mirror is left out whole with its mark, and after a reload it is filled again, which is correct. |
| `choice-documented-activation` (#87) | `worktree-fix-choice-activation` 57618b67 | The Choice and PickField radio group, `chunk-sizes.json`, EXPERIENCE (other rows); no version | No shared line: the prefill sets the Choice's draft as `fillFrom` does today. Re-record chunk sizes. |
| `document-review` | `worktree-feature-document-review` c2ff8ea4 (local only, base `main` a8f1d0a0; read 2026-11-08) | Appends `ComponentFacts.revisionBound` (not on `main`), widens `readOnlyItemsOf`, adds `AnswerContext.readOnlyOf`; edits `card-acts.ts`, `question-card.tsx`, `board-content.ts`, `index.tsx`, and `board-draft.ts`, where `hasAnswerWork` and `restoreDraft` gain a shown revision (`shown`, `shownOf`) and a new `carried.ts` clears what an act carried; no edit to `messages.ts`, `snapshot/state.ts` or `core` | Not borrowed until it merges. Then decision 2's rule gains one clause: the result of an item whose facts set `revisionBound` is carried only when `unchangedOf` holds the item. Task 4.2 adds it with a test, or task 0.1 records that it has not merged. If it merges first, task 2.3's mark (decision 4) goes into its `hasAnswerWork` and `restoreDraft` over the shown revision as well, keeping both sides. |
| `diagram-widget`, `diagram-render` | `worktree-feature-diagram` ed783fe5, `worktree-feature-diagram-render` 9281d923 | Both widen the board protocol (`render`); diagram-render also widens the Snapshot data; each registers `valueFits` | Same sets: whichever merges first takes the next minor and the other rebinds. Their `valueFits` feeds decision 2 unchanged. |
| `graph-widget`, `spreadsheet-widget`, `image-annotation`, `diff-review`, `keyboard-shortcuts-help` | `worktree-feature-graph` 482223d0, `worktree-feature-spreadsheet` 972b9622, `worktree-feature-image-annotation` 1f8f6811, `worktree-feature-diff-review` dfb0e6cb, `worktree-feature-keyboard-help` 101a9498 | Register `valueFits` (Graph, Spreadsheet), borrow `revisionBound` (Image annotation), or neither; none widens the board protocol or the Snapshot data | Nothing to borrow. A new edit widget is carried by decision 2's rule through its own `valueFits`. |
| `snapshot-toolbar` (#94) | `worktree-fix-snapshot-toolbar` e48c40fc | Takes Snapshot data at the next minor after main's, as this change does; edits `shell/index.tsx`'s boot (theme and density), not `channel.onUpdate`; edits `core/src/snapshot/gather.ts` and `core.ts`, not `snapshot/state.ts` (decision 10) | Whichever merges second rebinds the Snapshot data (task 4.2). Keep both sides of `shell/index.tsx`. |
| `wbs-gantt-consistency` | `worktree-fix-wbs-gantt-consistency` f1848541 (local; `origin` at 02f273c8) | No file this change touches: none of `messages.ts`, `snapshot/state.ts`, `core/src/lifecycle/`, the board-protocol schemas or the view shell; no set moves | Nothing to keep. |
| `backlog-issues` (#89) | `worktree-feature-backlog-issues` | `CLAUDE.md` (it moves to `AGENTS.md`) | The Status line goes wherever `main` then keeps it. |

Borrowed from `origin/main` 8e2e1247 (task 0.1 records each with its file and line):

- `fillFrom`, `namesEarlierRevision`, `withDerived` (`card-acts.ts`);
- `valueFits`, `resultFits`, `hasAnswerWork`, `restoreDraft`, `answerContentOf`, `QuestionWork` (`board-draft.ts`);
- `valueItemsOf` (`view/src/nested-items.ts`), `ReopenedNotice` (`change-notice.tsx`), `contentOf` (`question-state.ts`), `hasUnsentWork` (`board-page/unsent-work.ts`);
- `answerView`, `fullAnswer` (`views.ts`), `BoardModel.reopen` (`model.ts`), `canonicalize`, `nestedItemsOf`;
- `currentOf` and `stateOf` (`server/src/board-host/messages.ts`), the Snapshot's `currentOf` and `boardStateOf` (`core/src/snapshot/state.ts`) (decision 10; no change in flight edits either file, read 2026-11-08);
- the board state's `$defs/answer` and the draft record's `$defs/question`;
- `Boards.#openers` (`server/src/board-host/boards.ts`), `#onDraft`, `#stateSeen` and `#updateView` (`view/src/board-page/controller.ts`), `DraftRestore` (`view/src/view-protocol.ts`) (decision 9; checked by task 2.6 and the rebase task).

Seams this change creates: `unchanged` on the board state's answers, present only for an answer on an earlier revision (decision 1), its one reader `unchangedOf` (decision 2), and `prefilled` in the draft record. Seam this change reorders: the draft opener before the state opener in `Boards.#openers` (decision 9).

## Risks / Trade-offs

- [The agent reopens in one `update` and changes the question in a later one] → The prefilled draft is unsent work, so the agent-change notice shows (FR-6) though the user typed nothing. This is visible and safe: "Reload" or "Keep mine". An `update` that reopens and changes in one request gives one state with the question changed, so no prefill runs.
- [A large prefilled answer passes the draft or message limit] → `oversized-acts` handles it as for any draft or answer.
- [Content the user reaches outside the card changed while the card did not] → A file reference's content (shown in the source view or the reading panel) is not compared, only what the card shows of it, so a question can be prefilled although the file changed. The prefill is unsent work the user reviews before "Answer" (AD-10); accepted. A read that timed out or was too large counts as changed (re-review 1.9 X-1).
- [A restore after the first update] → Only on a reconnect of a page with no draft of its own, whose shell holds no work; the update applies the restore before the prefill (decision 9). Task 2.6 tests the order, task 2.3 the shell.
- [The boot render comes before the first update] → For one render a qualifying card may show the agent's version and the not-carried line; the first update, sent as the view loads, fills it and turns the line.
- [Reversing molecules decision 11's seeding] → The draft holds the answer's values from the first edit of a revision. Linked items (Tree and Gantt) stay consistent, since both values come from the same answer. Task 2.2 runs the UJ-2 revision scenario.
- [Canonical comparison cost on large widgets] → Memoised per pair of revisions (decision 1), and run only for an answer on an earlier revision.
- [`unchanged` lost between `ask-core` and the page] → For a current answer, absence reads as "all unchanged", which is true whenever the answer names the current revision; the field is present otherwise, and the wire copies it whenever `ask-core` gives it, `[]` included (decision 10, task 1.6). For a previous answer, absence reads as none, so a loss carries nothing (decision 1).

## Migration Plan

None: a board page and `board-host` come from one session process. Drafts mirrored before the change hold no mark, and a reopened question then fills once.

## Open Questions

Open questions 1 to 5 of proposal.md, each with its default, are recorded in task 0.2 before group 1.
