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

ADs relied on: AD-7, AD-10, AD-13, AD-20. UX: EXPERIENCE Component Patterns (Reopened question) and Voice and Tone (Reopened question rows); DESIGN.md Reopened question.

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
- each item's ID, at any depth (`nestedItemsOf`), whose type and props are equal in both;
- compared with `canonicalize` (`core/src/canonical.ts:20`), over expanded items;
- left out when empty.

The revision an answer names is the logged event's `rev`. For a recorded answer it is the revision current when it was recorded, which a recorded question keeps until it is reopened. `QuestionRecord` gains `previousRev`, set by `reopen`. The model keeps that revision's props while `previous` names it, beside the revisions events name. The result is memoised per question and pair of revisions.

*Alternatives:* (a) the view's `Revisions` store, which a reload empties; (b) sending the answered revision's props to the page, which means a larger board state for the same answer.

### 2. One rule for carrying an answer into the draft

`fillFrom` takes the answer's `unchanged` and, for each value item of the question's revision (`valueItemsOf`, at any depth), puts the answer's value into the draft only when both hold:

- the item's ID is in `unchanged`;
- `valueFits(question, itemId, value)` (`board-draft.ts:232`) holds.

Every other value item gets `undefined`, so it shows as sent. Results, the choice, notes and the note are carried as today. Three callers use this rule:

- "Start from my previous answer";
- `revise` (open question 2, which closes divergence 2);
- the reopen prefill (decision 3).

`revise` now seeds the answer's values, which reverses that part of molecules decision 11. The draft then holds what the next answer sends. The change marks already compare with the agent's revision. The counters count edits the answer will carry, which is what they should count. `BoardContent.shown` stays as it is for items before the first edit.

`fillFrom` also returns whether every part of the answer it was given was carried: each value, each result, and each chosen label. The prefill reads that.

*Alternative:* `answer` merges `shown` values at send time. Then the draft no longer equals the answer, and Submit, "Select recommended", the field block and the counters each need the same merge.

### 3. The reopen prefill

A pure function in a new `shell/reopen-prefill.ts` takes the document, the board state, the draft record and the question work. It returns the questions to fill, those that meet all of these:

- the state is `open` or `postponed`, with a `previous` answer that is not a decline;
- `previous.unchanged` holds the question's own ID (open question 3);
- the question holds no work on its current revision;
- its work holds no `prefilled` mark for that revision.

The shell (`shell/index.tsx`, `channel.onUpdate` at `:242`) runs the function after each update has applied its `restore`. It never runs before the page's first restore has been applied, or before the page has said there is none (task 0.1 finds that signal). For each question returned, it dry-runs the carry:

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
- the **Snapshot data**: its schema refers to the board state, as widget-registry's `results` did.

Every other set keeps main's value. The numbers are bound at the rebase task, with the binding line here.

Binding: (filled at task 4.2) "Bound on <date>, rebased onto origin/main <sha>: board protocol <n> (main <m>), Snapshot data <n> (main <m>)."

### 8. Documents

- **EXPERIENCE**, Component Patterns, Reopened question, becomes: the card starts from the user's previous answer when the agent changed nothing else and it all still fits, and says so; otherwise it starts from the agent's new revision and says so. The previous answer shows read-only, and "Start from my previous answer" moves into the draft what still fits. Nothing is sent until the user answers (AD-10, AD-20; reopen-start-from-answer).
- **EXPERIENCE**, Voice and Tone: both Reopened question rows gain the two lines.
- **DESIGN.md**, Reopened question: "with nothing selected" becomes "from the previous answer or from the agent's revision, as its line under the title says".
- **Spine AD-10**, the "Choice and input widgets start with nothing chosen…" bullet, gains: "A question the agent reopens may start from the user's own previous answer, which the user still sends by an explicit act (AD-20)." Amended in place.
- **Spine AD-20**, Drafts: the per-question list gains "whether the board started the revision from the question's previous answer". Amended in place.
- **PRD FR-6** gains one consequence: "When the agent reopens an answered question and changes nothing else, the board starts it from the user's previous answer and says so; otherwise it says it starts from the agent's version, and the user can start from the previous answer explicitly."
- `updated:` and `sources:` follow each document's convention.

## Merge points

Read on 2026-11-08. If one merges first, the rebase keeps both sides and re-checks the names.

| Change | Head | Overlap | What it takes |
|---|---|---|---|
| `oversized-acts` (#88) | `worktree-fix-oversized-acts` 25bfc33c | `card-acts.ts` (`dispatch`, `sendActs` gain `via` and `notices`), `question-card.tsx` (`SizeNotices`), strings, the draft fit (its decision 4); no version | Keep both sides. A prefilled question too large for the mirror is left out whole with its mark, and after a reload it is filled again, which is correct. |
| `choice-documented-activation` (#87) | `worktree-fix-choice-activation` 57618b67 | The Choice and PickField radio group, `chunk-sizes.json`, EXPERIENCE (other rows); no version | No shared line: the prefill sets the Choice's draft as `fillFrom` does today. Re-record chunk sizes. |
| `document-review` | `worktree-feature-document-review` 2c35cf1e | Appends `ComponentFacts.revisionBound` (not on `main`), widens `readOnlyItemsOf`, adds `AnswerContext.readOnlyOf`; edits `card-acts.ts`, `question-card.tsx`, `board-content.ts` | Not borrowed until it merges. Then decision 2's rule gains one clause: the result of an item whose facts set `revisionBound` is carried only when the item is in `unchanged`. Task 4.2 adds it with a test, or task 0.1 records that it has not merged. |
| `diagram-widget`, `diagram-render` | `worktree-feature-diagram` ed783fe5, `worktree-feature-diagram-render` 9281d923 | Both widen the board protocol (`render`); diagram-render also widens the Snapshot data; each registers `valueFits` | Same sets: whichever merges first takes the next minor and the other rebinds. Their `valueFits` feeds decision 2 unchanged. |
| `graph-widget`, `spreadsheet-widget`, `image-annotation`, `diff-review`, `keyboard-shortcuts-help` | `worktree-feature-graph` 482223d0, `worktree-feature-spreadsheet` 972b9622, `worktree-feature-image-annotation` 1f8f6811, `worktree-feature-diff-review` dfb0e6cb, `worktree-feature-keyboard-help` 101a9498 | Register `valueFits` (Graph, Spreadsheet), borrow `revisionBound` (Image annotation), or neither; none widens the board protocol or the Snapshot data | Nothing to borrow. A new edit widget is carried by decision 2's rule through its own `valueFits`. |
| `backlog-issues` (#89) | `worktree-feature-backlog-issues` | `CLAUDE.md` (it moves to `AGENTS.md`) | The Status line goes wherever `main` then keeps it. |

Borrowed from `origin/main` 8e2e1247 (task 0.1 records each with its file and line):

- `fillFrom`, `namesEarlierRevision`, `withDerived` (`card-acts.ts`);
- `valueFits`, `resultFits`, `hasAnswerWork`, `restoreDraft`, `answerContentOf`, `QuestionWork` (`board-draft.ts`);
- `valueItemsOf` (`view/src/nested-items.ts`), `ReopenedNotice` (`change-notice.tsx`), `contentOf` (`question-state.ts`), `hasUnsentWork` (`board-page/unsent-work.ts`);
- `answerView`, `fullAnswer` (`views.ts`), `BoardModel.reopen` (`model.ts`), `canonicalize`, `nestedItemsOf`;
- the board state's `$defs/answer` and the draft record's `$defs/question`.

Seams this change creates: `unchanged` on the board state's answers, and `prefilled` in the draft record.

## Risks / Trade-offs

- [The agent reopens in one `update` and changes the question in a later one] → The prefilled draft is unsent work, so the agent-change notice shows (FR-6) though the user typed nothing. This is visible and safe: "Reload" or "Keep mine". An `update` that reopens and changes in one request gives one state with the question changed, so no prefill runs.
- [A large prefilled answer passes the draft or message limit] → `oversized-acts` handles it as for any draft or answer.
- [The restore arrives after the first state] → Decision 3 waits for the first restore. Task 2.3 tests a state before its restore.
- [Reversing molecules decision 11's seeding] → The draft holds the answer's values from the first edit of a revision. Linked items (Tree and Gantt) stay consistent, since both values come from the same answer. Task 2.2 runs the UJ-2 revision scenario.
- [Canonical comparison cost on large widgets] → Memoised per pair of revisions (decision 1).

## Migration Plan

None: a board page and `board-host` come from one session process. Drafts mirrored before the change hold no mark, and a reopened question then fills once.

## Open Questions

Open questions 1 to 5 of proposal.md, each with its default, are recorded in task 0.2 before group 1.
