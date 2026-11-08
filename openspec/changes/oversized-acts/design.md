# Design

## Context

See proposal.md, Why, and `document-review`'s group 3 and 4 review, finding X-1 (worktree `review-document-review`, 778c3fe7). The paths on `main` 433b4d29 (base of this change):

- `server/src/board-host/boards.ts:83` `MESSAGE_MAX_BYTES` = max(`CHOICE_LABELS_MAX_CHARS`, `DRAFT_RECORD_MAX_CHARS`) × 3 + 4,096 = 6,004,096, passed as ws's `maxPayload` (`board-host/index.ts:148`); ws closes a socket whose message passes it with 1009 (`server/test/board-host/protocol.test.ts:250`). Its comment assumes "an act command carries what a draft holds of the same questions", which no layer enforces.
- `view/src/board-page/controller.ts:534` `#command` sends an act command while live and holds it either way (`outbox.ts:53` `hold`), with no size check; `:617` `#resume` resets `#attempt` and `flush` (`outbox.ts:135`) resends every sent, unacknowledged command; `reconnect.ts:10` `closeKindOf` reads 1009 as a drop.
- `controller.ts:215` `draftRefusal` refuses a record whose `JSON.stringify` length passes `DRAFT_RECORD_MAX_CHARS` and `:579` `#takeDraft` only logs it; the view's `report` (`shell/index.tsx:225`) ignores the reply. `board-host` refuses such a record too (`contract/src/validate.ts:166`), keeping the one it holds.
- The view drops a refused flight and keeps the draft (`shell/answer-acts.ts`, `replied`; `card-acts.ts:64` `dispatch`, console only). Submit sends one command of every held act (`bottom-bar.tsx:113`, AD-20's atomic append); held acts are released only when settled done.
- The board page and the view are one unit and their messages are typed in `view/src/view-protocol.ts`, not in a contract set (AD-7; that file's header).

Binding text: NFR-10; AD-10; AD-20 (Drafts: the mirror and restore; Delivery modes: Submit as one atomic append, action IDs applied once); AD-21 (Connections); FR-22 (receipts), FR-25 (unsent work, leave-page prompt); EXPERIENCE Interaction Primitives (Close and reload), State Patterns (Question, What a reload keeps), Voice and Tone.

## Goals / Non-Goals

**Goals:** no act, draft or retry loop ever passes `board-host`'s limit unnoticed; the user always sees why work was not sent or not kept; nothing partial reaches the agent or the host's draft; no schema set moves.

**Non-Goals:** an input-side bound (decision 5); splitting Submit; raising either limit; a visible line for the board page's other refusals (an ended ask has its banner; a board changed under a queued act is logged, as today).

## Decisions

### 1. One limit and one measure, in `contract`

A new module `contract/src/message-size.ts`, plain ECMAScript, exported in one appended block of `src/index.ts`:

- `BOARD_MESSAGE_MAX_BYTES`: today's formula and value, moved from `boards.ts`. `boards.ts` keeps `export const MESSAGE_MAX_BYTES = BOARD_MESSAGE_MAX_BYTES` with its comment pointing here, since `diagram-widget`'s design and `document-review`'s server test borrow that name.
- `MESSAGE_TOO_BIG_CLOSE` = 1009, RFC 6455's "message too big", which ws sends on `maxPayload`. Not a member of `BOARD_CLOSE_CODES`, whose codes carry the board's own meanings.
- `utf8Length(text)`: the UTF-8 byte length of a string, counting a lone surrogate as 3 (the WebSocket API sends a string as UTF-8 of its scalar values, replacing a lone surrogate with U+FFFD). Hand-written, because `contract` uses no DOM or Node API; the tests compare it with `TextEncoder` and `Buffer.byteLength`.
- `boardMessageBytes(message)`: `utf8Length(JSON.stringify(message))`, the exact text the board page's socket sends.
- `draftRecordChars(record)`: `JSON.stringify(record).length`, the count `validate.ts:166` and `draftRefusal` apply, which both then call.
- A test pins the invariant the server comment assumed: a draft message whose record is at `DRAFT_RECORD_MAX_CHARS`, every character three bytes, measures within `BOARD_MESSAGE_MAX_BYTES` (each UTF-16 unit takes at most 3 bytes; the envelope stays under 4,096 bytes). So a draft the board page accepts never closes the socket.

### 2. The board page refuses an act too large to send

In `#command`, after the command is built and before it is sent or held: `boardMessageBytes(command) > BOARD_MESSAGE_MAX_BYTES` gives `{outcome: "refused", detail, size: {bytes, max}}`, logs once, and leaves the outbox and the status as they were. `ActReply`'s refused variant gains the optional `size`, read by `readActReply` (two positive safe integers, else ignored).

The view: `dispatch` (`card-acts.ts`) records, on a refusal with `size`, a size notice for each question its acts name, `answer` or, when the bottom bar's Submit sent it (the bottom bar marks its dispatch), `submit`; the notices live in a small store (`shell/size-notices.ts`) that the card reads. A question's notice goes when its work changes or a later command of it is sent. The draft and the held acts stay, as for any refusal today; "Send and switch" switches as before, which leaves the user in immediate delivery to answer one question at a time. The line sits under the question actions in DESIGN's Field error style, as a polite status (NFR-12). "Answer" stays enabled. Submit is never split (proposal, open question 2): one Submit stays one atomic append (AD-20).

### 3. A 1009 close drops what was sent on that socket

`reconnect.ts` gains `isTooBigClose(code)`; `closeKindOf` keeps 1009 a drop, so the status, banner and reconnect stay as for any drop. In the socket's `onClose`, when the code is 1009 and the socket's state had come (read before `#onClose` resets it), `refusedTooLarge(outbox)` (`outbox.ts`) removes every held command that is sent and not acknowledged and settles each `{actionId, outcome: "refused", tooLarge: true}`; the page logs and updates the view, then retries. After a state, every unacknowledged held command was sent on the current socket (`#resume` flushes them all), so these are exactly the commands that socket carried. The board page cannot tell which frame passed the limit, and by decision 2 none should: the close means the two layers disagree. Dropping all of them fails closed: nothing is resent unseen, and each question asks the user to answer again; a command `board-host` had already applied shows answered in the state that follows. `SettledAct` gains the optional `tooLarge`, which `isSettledAct` accepts and `reconcile` (`answer-acts.ts`) passes to the card as a `closed` notice.

### 4. The draft mirror keeps whole questions that fit

`board-page/draft-fit.ts`, pure: `fitDraftRecord(record)` returns the record unchanged when `draftRecordChars(record) <= DRAFT_RECORD_MAX_CHARS`; else, the question entries ordered by their own `JSON.stringify` length, largest first (board order breaking ties), are removed one at a time until it fits, giving `{record, leftOut}`. `#takeDraft` runs every other check of `draftRefusal` first (depth, schema, the board's questions), then the fit; if the board-level fields alone passed the limit it refuses as today. The page keeps the view's whole record (`#viewDraft`) and mirrors the fitted one: `copyUnsentWork`, `leavePromptArmed`, the closed and discarded banners' unsent flag and the Snapshot request's `unsentWork` read the whole record, so nothing the user typed is outside "Copy my unsent work" or the prompt. The reply to the view's `draft` carries `leftOut` when non-empty; the view's `report` for drafts reads it (the latest reply wins) and the card of each listed question shows the draft line until a later reply leaves it out of the list. A left-out question's work is never mirrored in part: after a reload it comes back as the host last held it before passing the limit, or not at all, and the line has said so.

Why the page and not the view: the page owns the mirror and the limit check already; the view only shows what the page says.

### 5. No input-side bound here (proposed default, open question 1)

What passes the limit is what the user writes: values, results, notes and entries, each bounded per item, summed over the items of one question or one Submit. A bound at `ask` and `update` can only sum worst cases. An item count (alternative a) stops the many-TextFields path but not two Document reviews, and refuses asks that work today; a per-type worst case (b) needs every registry entry, the ones in flight included, to declare one, and refuses questions that are almost never filled. The board page's check measures the real message, so it is the fix in every case; a widget whose single item can approach the limit may add its own budget (c), as `document-review` may through its own design.

### 6. Versions

None moves (askboard-contract-versioning): `message-size.ts` holds constants and functions, no schema; no board-protocol message is added (1009 is the WebSocket standard's code, which `board-host` already sends); `ActReply`, `SettledAct` and the draft reply are view-protocol types, outside AD-7's sets. Task 0.2 records `main`'s constants; the rebase task checks none moved.

### 7. Strings

Keys `send.tooLarge`, `send.tooLargeSubmit`, `send.tooLargeClosed`, `draft.tooLarge` in `keys.ts`, `en-US.ts` and `it-IT.ts`. Sizes in megabytes (bytes ÷ 1,000,000) with one decimal through `contract`'s `formatNumber` in the board's language, the size rounded up and the limit down, so a refused size never reads equal to the limit. Wording (proposal, open question 3), en-US as there; it-IT, to review:

- `send.tooLarge`: "Non inviata: questa risposta è troppo grande ({size} MB, al massimo {max} MB). Accorcia il tuo lavoro su questa domanda, poi rispondi di nuovo."
- `send.tooLargeSubmit`: "Non inviate: l'invio è troppo grande per una volta sola ({size} MB, al massimo {max} MB). Passa a Immediata e rispondi alle domande una alla volta, o accorcia il tuo lavoro."
- `send.tooLargeClosed`: "Non inviata: la board ha rifiutato questa risposta perché troppo grande. Accorcia il tuo lavoro su questa domanda, poi rispondi di nuovo."
- `draft.tooLarge`: "Troppo grande per conservarlo dopo un ricaricamento: rispondi a questa domanda prima di ricaricare, o accorcia il tuo lavoro."

### 8. Documents

Spine, amended in place: AD-20 Drafts gains "A record over the draft limit is mirrored without the work of whole questions, largest first, and the board says which; the board page keeps the whole record for the user's copy and the leave-page prompt."; AD-21 Connections gains "The board page never sends a message over the contract's message limit; a socket `board-host` closes as too large has its unacknowledged commands dropped, never resent." EXPERIENCE: State Patterns, By surface, two Question rows (answer too large to send; work too large to keep across a reload), What a reload keeps (a question left out comes back as last kept), Voice and Tone a "Size limits" row; `updated:` is the apply date. CHANGELOG, Unreleased, Known limits: the limits in the user's terms (an answer or a Submit up to about 6 MB; a board's unsent work up to about 2 million characters across a reload) and what the user sees.

## Merge points

Read on 2026-11-08 at the heads named. If one merges first, this change's rebase keeps both sides and re-checks the names below.

| Change | Head | Overlap | What it takes |
|---|---|---|---|
| `document-review` | `worktree-feature-document-review` 778c3fe7 | Appends to `contract/src/lifecycle-limits.ts` and `src/index.ts`'s export blocks; `server/test/board-host/document-review-size.test.ts` imports `MESSAGE_MAX_BYTES` from `boards.ts`; `chunk-sizes.json`; its Risks line for U-1 and its Known limits | Keep both export blocks (this change's in its own module). The import stays valid (decision 1). Its review X-1 is fixed here: its design's U-1 line and Known limits cite this change instead of "refused whole"; the reviewer's optional in-widget budget is its own (decision 5, c). |
| `table-widget` | `worktree-feature-table` 14f19ad4 | `shell/index.tsx` (the draft record gains `cellEntries`), `shell/card-acts.ts`, `shell/question-card.tsx`, `board-page/unsent-work.ts`, the strings, the draft record schema (board protocol minor) | Keep both sides; a question's `cellEntries` are part of its work, so decision 4 keeps or leaves them out with it. No version collision: this change moves none. |
| `keep-mine-shown-revision` (#66) | merged on `origin/main` d6f5e453 after this change's base, read at 32c804b0 | `shell/card-acts.ts`, `shell/question-card.tsx`, the strings, `chunk-sizes.json` | Keep both sides in the card and the strings tables. |
| `diagram-widget` | `worktree-feature-diagram` ed783fe5 (proposal) | Borrows `MESSAGE_MAX_BYTES`; its own `RENDER_MESSAGE_MAX_BYTES` and a board-page byte measure of its render message | Kept name; once this change merges it borrows `boardMessageBytes` and `BOARD_MESSAGE_MAX_BYTES` from `contract` in place of its own measure (its `/opsx:update`). |
| `image-annotation`, `graph-widget`, `diff-review`, `spreadsheet-widget` | 5bf4d85b, 482223d0, dfb0e6cb, 972b9622 (proposals) | Widgets whose results or values can grow large | Nothing to code: their answers go through `#command` and their drafts through the fit. Their Known limits may cite this change. |
| `choice-documented-activation` | `worktree-fix-choice-activation` (proposal, this session) | EXPERIENCE (other rows), `chunk-sizes.json` | Keep both. |

Names borrowed, all on `main` 433b4d29 (task 0.2 records file and line): `MESSAGE_MAX_BYTES`, `CHOICE_LABELS_MAX_CHARS`, `DRAFT_RECORD_MAX_CHARS`, `BOARD_CLOSE_CODES`, `formatNumber`, `withinDraftLimit` (`contract/src/validate.ts:161`), `closeKindOf`, `hold`, `flush`, `refusedCommand`, `draftRefusal`, `ActReply`, `SettledAct`, `ViewDraft`, `readActReply`, `hasUnsentWork`, `unsentWorkText`, `sendActs`, `createAnswerActs`, the controller's test harness in `controller.test.ts`, and the browser harness's `lifecycleScenario` and `openBoard`. Seams this change creates: `BOARD_MESSAGE_MAX_BYTES`, `MESSAGE_TOO_BIG_CLOSE`, `utf8Length`, `boardMessageBytes`, `draftRecordChars`, `fitDraftRecord`, `refusedTooLarge`, `isTooBigClose`, `ActReply.size`, `SettledAct.tooLarge`, the draft reply's `leftOut`, the size-notice store.

## Risks / Trade-offs

- [Measuring a large command costs a second `JSON.stringify` and a pass over the text] → once per act, at most about 6 MB; the draft path measures as it does today, and only measures each question when the record passes the limit.
- [A 1009 close may drop a command the host applied just before the oversize frame] → only when the layers disagree, which decision 1's shared measure and its tests rule out; the state that follows shows the question answered.
- [A left-out question's work is lost on a reload] → the card says so before any reload, the leave-page prompt is armed, and "Copy my unsent work" holds it; answering it needs no mirror.
- [A Submit near the limit refuses whole] → the line says how to send it (Immediate, one question at a time); proposal, open question 2.
- [The draft record grows with in-flight changes (`table-widget`'s `cellEntries`)] → decision 4 measures whatever the record holds.

## Migration Plan

None: the board page, the view and `board-host` ship in one session process; the limit's value does not change. Rollback is a revert.

## Open Questions

The proposal's three questions carry their proposed defaults (task 0.1). No conflict between source documents: the server comment's assumption is made true by decision 1's test, and AD-20 and AD-21 gain one sentence each.
