# Tasks

Each task writes its tests first and sees them fail for the right reason before it implements (the repository's TDD rule). Terms used below:

- "The check" means `GITHUB_TOKEN=$(gh auth token) bun run check`.
- "Coverage" means at least 80% of lines and functions for every source file the task changes, read from `bun test --coverage`'s per-file table.
- "Browser files" means the named files run with `bun packages/view/test/browser/run.ts --engines chromium,webkit --target session-process`, under the browser lock.

Order: group 0, then 1, 2, 3 and 4, in order. Inside group 2: 2.1, then 2.6, then 2.2 and 2.3 (2.3 relies on 2.6's opening order), then 2.4, and the checkpoint 2.5 last, over the whole group, 2.6 included. Inside group 3, 3.2 may run beside 3.1. No group runs in parallel with another: group 2 reads the types group 1 adds.

## 0. Base

- [x] 0.1 Names, versions, signals and baseline (askboard-contract-versioning, Rule 3; design.md, Merge points and decisions 3 and 7). Tests: none.
  - Check with `git grep -n` on `origin/main` every name design.md borrows, and record each with its file and line.
  - Record every `*_VERSION` and `*_FORMAT` constant of `packages/contract/src`. The board protocol and the Snapshot data start at main's minor plus one in task 1.1; the others stay.
  - Record the head of each branch in Merge points, and whether it moved since the head named there. Record whether `document-review` has merged.
  - Find, in `shell/index.tsx` and the board page, the signal that the page's first restore has been applied or that there is none. Record it with its file and line.
  - Record the pass counts of `bun test` for `packages/contract`, `packages/core` and `packages/view`.
  - Verify: the note lists every name and version and the restore signal. If a name, signature or shape differs, or a name is not on `main`, or there is no such signal, stop and run `/opsx:update` before group 1.
  - Note (STOPPED, not ticked; Refs #70): merged `origin/main` a8f1d0a0 as 0010dadf, no conflicts; `bun run build` and the check green (12157 pass, 0 fail). Every borrowed name is on main (paths under `packages/`): `view/src/shell/card-acts.ts` `fillFrom` 523, `namesEarlierRevision` 188, `withDerived` 150; `shell/board-draft.ts` `resultFits` 215, `valueFits` 232, `hasAnswerWork` 293, `restoreDraft` 543, `answerContentOf` 659, `QuestionWork` 34; `view/src/nested-items.ts` `valueItemsOf` 29; `shell/change-notice.tsx` `ReopenedNotice` 195; `shell/question-state.ts` `contentOf` 256; `board-page/unsent-work.ts` `hasUnsentWork` 24; `shell/question-card.tsx` `revise` 440, `fillFrom` calls 453 and 539; `core/src/lifecycle/views.ts` `fullAnswer` 86, `answerView` 109; `lifecycle/model.ts` `reopen` 357; `core/src/canonical.ts` `canonicalize` 20; `contract/src/nested-items.ts` `nestedItemsOf` 91. Line drift from the design's numbers only (`revise` 425 to 440, `fillFrom` 500 to 523, `ReopenedNotice` 175 to 195).
  - Constants on main a8f1d0a0: input 1.12, output 1.11, tool envelopes 1.12, board document 1.11, board protocol 1.8, Snapshot data 1.1, view manifest 1.1, configuration 1.0, local API 1.0, session file 1.0, molecule format 1.0.0. This change takes board protocol 1.9 and Snapshot data 1.2 in task 1.1.
  - Heads: `document-review` is a local branch only, 02ed0dfb (design named 2c35cf1e), not merged, labels input 1.13, output 1.12, tool envelopes 1.13, board document 1.12, board protocol 1.8, Snapshot data 1.1: no collision. `snapshot-toolbar` (PR #94) e48c40fc holds Snapshot data 1.2: COLLISION with this change's 1.2; whichever merges second rebinds (to 1.3 if this one). `wbs-gantt-consistency` 02f273c8: no set moves. `keyboard-help` 101a9498 as named. `diagram`, `diagram-render`, `diff-review`, `graph`, `image-annotation`, `spreadsheet`: heads as named, bases old, no board protocol 1.9 or Snapshot 1.2 label read.
  - Baseline `bun test`: contract 3552 pass, core 1097 pass, view 2002 pass, 0 fail each.
  - NO RESTORE SIGNAL. The page's first restore is `update.restore` (id above `restored`) in `shell/index.tsx:258-299`; it exists only when `board-host` holds a draft (`boards.ts:592-595`, `draftToRestore`, `core.ts:429`). Opener order is board, state (`sendState`), then draft, so the first state reaches the shell before its restore, and a board with no record sends no message at all and sets no `restore` (`controller.ts:380`, `#onDraft` 774). The shell cannot tell "none" from "not yet". Design decision 3 and task 2.3 need one; group 1 does not use it. Stopped per this task's Verify: needs `/opsx:update`.
  - Gate resolved (`/opsx:update`, 2026-11-08; Refs #70): design decision 9 makes the signal. `board-host` sends a held draft record before the state on connect (the draft opener one place up in `Boards.#openers`, `boards.ts:586`), and the board page's `#onDraft` (`controller.ts:774`) holds the restore until the socket's first state, so the view's first update after a reload or a takeover carries the restore whenever one was held; the shell runs the prefill at the end of each update, after its restore, never on the boot data. Option (a) in its smallest form (the order, no new message), proposed default accepted under the PO's unattended handoff; (b) and (c) are rejected in decision 9. New task 2.6 builds the order; task 2.3 relies on it. The rest of this task's checks were done above, so it is ticked; group 1 runs as written. Snapshot data collides with `snapshot-toolbar` (#94): recorded in design.md, Merge points.
- [x] 0.2 PO decisions (proposal, open questions 1 to 5). Record each answer under this task: question 1's default was given by the Issue and is accepted under the PO's unattended handoff of 2026-11-08; questions 2 to 5 take their proposed defaults under the same handoff unless the PO answered on Issue #70. Tests: none. Verify: five answers recorded. An answer other than the default stops the work for `/opsx:update` before group 1.
  - Note (done 2026-11-08; Refs #70): the PO answered "Accept all" on Issue #70 on 2026-11-08 (comment: "The PO accepted every proposed default on 2026-11-08"). Recorded as accepted: (1) prefill when unchanged and fitting, else a notice pointing to "Start from my previous answer"; (2) a revision carries untouched widgets' edits, in this change; (3) the gate is the whole question; (4) prefilled work is unsent work; (5) the notice lines of the proposal, en-US and it-IT (Italian to review). No answer differs from its default.

## 1. Contract and core: what an answer's revision shares

- [ ] 1.1 The two schema fields (contract spec, both requirements; design decisions 4 and 7).
  - Tests first, in `packages/contract/test/board-protocol.test.ts` and `snapshot-data.test.ts`:
    - a board state whose previous answer, and one whose current answer, names `unchanged: ["plan", "roadmap"]` validates;
    - `unchanged: []`, a repeated ID, or an ID the input format's `id` refuses fails, naming the field;
    - a draft record question with `prefilled: true` and no values validates, and `prefilled: false` fails;
    - a Snapshot data file holding such a board state validates;
    - a board state and a draft record of the previous minor still validate.
  - Then:
    - `unchanged` in `board-state.json`'s `$defs/answer`, `uniqueItems`, `minItems` 1, items `urn:askboard:input:id`, its `description` naming this change;
    - `prefilled` (`const: true`) in `draft-record.json`'s `$defs/question`;
    - the TypeScript types that mirror them;
    - `BOARD_PROTOCOL_VERSION` and `SNAPSHOT_DATA_VERSION` at main's minor plus one, each module's header comment gaining one sentence naming this change;
    - the change's version test in a new `packages/contract/test/reopen-start-sets.test.ts`;
    - every earlier exact pin of the two sets moved (the skill's grep; `table-sets.test.ts:72` is one).
  - Verify: the tests fail before the schemas change and pass after; `schemaSetProblems` passes; coverage; the check passes.
- [ ] 1.2 `unchanged` in the board state (core spec, all four scenarios; design decision 1).
  - Tests first, in `packages/core/test/revisions.test.ts`, each over the board state `lifecycleView` gives:
    - a question with a Timeline inside a Group, answered and reopened with no change, lists the question, the Group and the Timeline in `previous.unchanged`;
    - after a `change` of the Timeline's lanes it lists the Group only;
    - a recorded answer reopened with no change lists the question;
    - an answered question's current answer lists every item;
    - an answer kept on an earlier revision ("Keep mine", then answered) lists only the items equal in both revisions;
    - `fetch` and `collect` of that ask hold no `unchanged`;
    - two board states in a row compute the comparison once (a spy on the memo).
  - Then:
    - `QuestionRecord.previousRev`, set by `BoardModel.reopen` from the event's `rev`, or from the current `rev` for a recorded answer;
    - that revision kept while `previous` names it;
    - `answerView` given the question and the model, building `unchanged` with `nestedItemsOf` and `canonicalize` over expanded items, memoised per question and pair of revisions.
  - Verify: the tests fail before and pass after; the existing core tests still pass; coverage of `views.ts` and `model.ts`; the check passes.
- [ ] 1.3 Review checkpoint for group 1. Tests: none (review).
  - Spec review (askboard-spec-reviewer): every scenario of the contract and core deltas has its test; decisions 1 and 7 hold; the two sets moved one minor and no other set moved; no number is written outside the constants and the version test.
  - Security review (askboard-security-reviewer; the contract's schemas and validators are touched): the new fields refuse anything but their shape; `unchanged` reaches no tool result, no log entry and no local API reply; the comparison cannot be made to run unbounded.
  - Verify: the check passes; each finding is recorded as S-n or X-n under this task and turned into a task before group 2.

## 2. View shell: carry an answer, prefill a reopened question

- [ ] 2.1 One rule for carrying an answer (view-and-widgets: An answer carried into the draft brings back widget values; design decision 2).
  - Tests first, in `packages/view/src/shell/card-acts.test.ts` with stub facts. `fillFrom` with an answer whose `values` hold a Timeline and a Kanban value:
    - both `unchanged`, both fit: both enter the draft;
    - the Kanban not in `unchanged`: only the Timeline's;
    - the Timeline's `valueFits` refuses: it gets none;
    - an item inside a Tabs layout: carried like a top-level one;
    - a type with no `valueFits` and in `unchanged`: carried.
    - Its return value says whether every part was carried. Results, choice and notes are carried as before (the existing tests stand).
  - Then `fillFrom` reads `unchanged` and `values` through `contentOf`, which keeps `unchanged`. "Start from my previous answer" passes `previous`.
  - Verify: the tests fail before and pass after; coverage of `card-acts.ts` and `question-state.ts`; the check passes.
- [ ] 2.2 A revision keeps the widgets' edits (view-and-widgets: A revision keeps the widgets' edits; design decision 2; open question 2).
  - Tests first:
    - in `card-acts.test.ts`, the first edit of an answered question holding answered values for a Timeline and a Kanban seeds both, and `answer` after one more Kanban move sends both values;
    - in `packages/view/test/browser/widget-revision.browser.ts`, the same on the session process, `collect` giving `changes` for the earlier Timeline move and both Kanban moves;
    - the UJ-2 revision (Tree and Gantt linked) still sends both values, with the WBS's earlier edits.
  - Then `revise` (`question-card.tsx:425`) passes the answer with its `unchanged`. Its comment and the renderer's header comment say that the start of a revision seeds the answer's values, citing this change.
  - Verify: the unit tests fail before and pass after; the browser file passes in Chromium and WebKit with the counts in the note; the check passes.
- [ ] 2.3 The reopen prefill and its mark (view-and-widgets: A reopened question starts from the previous answer; A reopened question the agent changed starts from the agent's version; The prefill is remembered; design decisions 3 and 4).
  - Tests first, in a new `packages/view/src/shell/reopen-prefill.test.ts`. The pure function returns a reopened `open` or `postponed` question whose `previous.unchanged` holds its ID and whose work is empty on its revision. It returns none for:
    - a question not in `unchanged`;
    - a question holding work on any revision;
    - a question whose work holds the mark;
    - a declined previous answer;
    - an answered question.
  - Tests first, in `board-draft.test.ts`:
    - `restoreDraft` keeps the mark on the current revision and drops it with a stale one;
    - `hasAnswerWork` is false for a mark alone;
    - `unsent-work.test.ts`: `hasUnsentWork` is false for a mark alone.
  - Tests first, in a shell test over `channel.onUpdate` (design decisions 3 and 9):
    - the boot data alone fills nothing, though it holds a qualifying question;
    - a first update with no restore fills the question once, and the mirrored record holds the mark;
    - a first update whose restore holds work on the question's current revision fills nothing, and the restored work stands;
    - a first update whose restore holds the mark alone fills nothing;
    - a first update whose restore holds work on other questions only fills the question once, after the restore;
    - a second state fills nothing more;
    - a part that does not fit fills nothing and sets no mark.
  - Then `shell/reopen-prefill.ts`, `QuestionWork`'s mark, the readers above, and the shell's call at the end of each update, after its restore is applied (decision 9's order, built by task 2.6).
  - Verify: the tests fail before and pass after; coverage of every changed file; the check passes.
- [ ] 2.4 The notice line (view-and-widgets: Reopened question; design decision 5; open question 5).
  - Tests first:
    - `strings.test.ts` expects `reopened.carried` and `reopened.notCarried` in en-US and it-IT with the texts of open question 5;
    - a server-render test of `ReopenedNotice` shows the carried line when `carried` is true and the other line when it is false, with the button in both.
  - Then the keys in `keys.ts`, `en-US.ts` and `it-IT.ts` (Italian to review), and `carried` from the card (the mark on the current revision).
  - Verify: the tests fail before and pass after; chunk sizes re-recorded with `bun run build:view --record-sizes`, each moved chunk in the note; the check passes.
- [ ] 2.5 Review checkpoint for group 2. Tests: none (review).
  - Spec review: every view and board-host scenario of group 2 has its test; decisions 2 to 5 and 9 hold; `#openers` changed by the one move decision 9 records.
  - Security review (the view and `board-host`; NFR-10, AD-10, AD-21): no path carries a value onto an item missing from `unchanged`, or one its `valueFits` refuses; nothing is sent without a press of "Answer" or Submit; the prefill never overwrites restored work; an answer's values equal what the card shows, nested items included; the opening still sends nothing of the ask before the token is accepted, and a takeover still restores the older tab's last draft.
  - Verify: the check passes; findings recorded as S-n or X-n and turned into tasks before group 3.

- [ ] 2.6 The held draft before the state on connect (board-host delta: Board protocol over a WebSocket, all its scenarios; view-and-widgets: A reopened question starts from the previous answer, "A restored draft comes first"; design decision 9).
  - Tests first, in `packages/server/test/board-host/`:
    - every opening that holds a draft expects the board, the draft, then the state: `connections.test.ts` (the `types(…, 3)` checks at 158, 227 and 438, and the takeover read at 140) and `lifecycle-protocol.test.ts:492` (`["board", "draft", "state", "closed"]`); find the rest with `grep -rn '"draft"' packages/server/test`;
    - an opening with no record still sends the board then the state, and no draft (the existing `["board", "state"]` checks stand, `settings-connect.test.ts` included).
  - Tests first, in `packages/view/src/board-page/controller.test.ts`:
    - a draft before the socket's first state sends the view nothing; the first update after the view loads carries the state and the restore together;
    - on a reconnect of a page with no record of its own, a draft before the new socket's state reaches the view with that state, never with the previous socket's;
    - a draft after the state still becomes a restore (the existing test at 549 stands);
    - a page holding its own record ignores the held one (the existing test at 538, its messages in the new order).
  - Then:
    - the draft opener one place up in `Boards.#openers` (`boards.ts:586`), before the state's, and the comment above the table saying the new order and citing this change;
    - `#onDraft` (`controller.ts:774`) keeps the restore and calls `#updateView` only once the socket's state has been seen (`#stateSeen`);
    - `draft.json`'s `description`: the held record goes after the board document and before the state on connect.
  - Verify: the order tests fail before and pass after; the conformance suite passes in its three configurations on Bun (`bun packages/server/test/conformance/run.ts`); coverage of `boards.ts` and `controller.ts`; the check passes.

## 3. Session scenarios and documents

- [ ] 3.1 The Issue's steps on the session process (view-and-widgets scenarios of the three reopen requirements and "Derived values of a reopened question's answer").
  - Tests first, in a new `packages/view/test/browser/reopen-session.browser.ts`:
    - (a) the Issue's steps: a Timeline ask, a move, "Answer", `update` `reopen`, a reload. The moved entry shows with its mark and the carried line. A second move and "Answer": `collect` gives an answer naming the new revision whose `changes` hold both moves.
    - (b) "Answer" at once after the reopen sends the previous value.
    - (c) reopen and a lane rename in one `update`: no prefill, the other line, then "Start from my previous answer" carries nothing onto the changed Timeline.
    - (d) a Timeline and a Kanban, reopen, then a second `update` adding a Kanban card: the agent-change notice shows (prefilled work); "Reload, losing my work"; "Start from my previous answer" carries the Timeline only. "Answer": `ask-core` accepts it, and its changes hold the Timeline move only.
    - (e) the prefill undone by hand, then a reload: no second fill.
    - (f) a Gantt reopened unchanged: "Answer" carries derived values matching the prefilled plan.
  - Verify: each case fails before group 2's fix (record which, by a mutation of `reopenPrefills` returning none for (a), (b) and (f)) and passes after, in Chromium and WebKit; `keep-mine-reload-session`, `widget-revision`, `result-widgets-session`, `connection` and `lifecycle-board-page` (reloads and takeovers on decision 9's order) pass in the same run; counts in the note.
- [ ] 3.2 Documents (design decision 8). Tests: none (documents).
  - EXPERIENCE: Component Patterns, Reopened question; both Voice and Tone rows for Reopened question (en-US and it-IT, Italian to review).
  - DESIGN.md: Reopened question.
  - Spine: AD-10 and AD-20, amended in place, with a `sources:` entry naming this change and open question 1.
  - PRD: FR-6's new consequence.
  - `updated:` of each is the apply date.
  - Verify: each old text stood once and each new one stands once (`grep -c -F`); `npx --yes @fission-ai/openspec@1.15.0 validate --all --strict --no-interactive` passes.
- [ ] 3.3 Review checkpoint for group 3. Tests: none (review).
  - Spec review: the browser cases assert what their scenarios say; the documents match what was built and cite this change; no document still says "nothing carried over".
  - Security review of 3.1's harness use: no test-only path reaches the shipped build.
  - Verify: findings recorded and turned into tasks before group 4.

## 4. Rebase and pull request

- [ ] 4.1 Full suites: `bun run test:e2e`, plus the conformance and browser runs on Node 24 (CLAUDE.md, CI). Tests: none new. Verify: all pass; counts per suite and runtime in the note.
- [ ] 4.2 Rebase onto `origin/main` and bind the version labels (askboard-contract-versioning).
  - Bind the board protocol and the Snapshot data at main's minor plus one, and move the earlier exact pins.
  - Write the binding line in design.md, decision 7.
  - Re-check every borrowed name, and that no change merged since edited `Boards.#openers` or `#onDraft` (decision 9).
  - If `document-review` has merged, add decision 2's `revisionBound` clause with a test first in `card-acts.test.ts`.
  - Set CLAUDE.md's Status and an "In code since" line naming the change and its versions.
  - Verify: `git grep` finds each borrowed name on the rebased head; the diff carries no stale number; `bun run check`, `bun run build` and `openspec validate --all --strict --no-interactive` pass; the note records main's SHA, the bound versions and the counts.
- [ ] 4.3 Pre-PR review (askboard-review-protocol): one spec and one security pass over the whole range. Tests: none (review). Verify: no H or M finding is left open; the PR body cites Issue #70, the bound versions and the PO's defaults.

## Workflow follow-up

- After merge, archive the change and close Issue #70 with the merge commit.
