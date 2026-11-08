# Proposal

## Why

An act command larger than `board-host`'s message limit (`MESSAGE_MAX_BYTES`, 6,004,096 bytes, `server/src/board-host/boards.ts:83`) makes `board-host` close the board's socket with 1009. The board page reads 1009 as an ordinary drop (`reconnect.ts`, `closeKindOf`), reconnects, resets its backoff on the new state and resends every sent command (`controller.ts` `#resume`, `outbox.ts` `flush`): the same act goes every 250 ms without end, no banner stays, and every later act on any question queues behind it and never arrives; a reload empties the outbox and the answer is gone. A draft record over `DRAFT_RECORD_MAX_CHARS` (2,000,000) is refused by the board page and only logged (`draftRefusal`, `controller.ts:227`), so the host keeps an older draft and a reload restores less than the user wrote, without a word. Nothing partial reaches the agent (NFR-10 holds), but the user loses work silently and the board stops delivering. It is reachable on `main` today with about 160 full TextFields in one question (a question's `items` has no maximum), and `document-review` makes it reachable with two or three reviews (its review, finding X-1, on 778c3fe7).

## What Changes

- **One limit and one measure** (design decision 1): `contract` holds the board's message limit in UTF-8 bytes (`BOARD_MESSAGE_MAX_BYTES`, the value `board-host` already uses), the WebSocket close code for a message too big (1009), and plain functions measuring a message as the UTF-8 length of its JSON text and a draft record as `board-host` counts it. `board-host`, the board page and the view use these, so they cannot disagree; `board-host`'s `MESSAGE_MAX_BYTES` stays as its name for the same constant.
- **An answer too large to send** (decision 2): the board page measures each act command before it sends or holds it; one over the limit is refused with nothing sent or held, the board stays live, and later commands go. Each question the command carried shows a line saying the answer was not sent, with its size and the limit, and keeps the user's work (NFR-10). In submitted delivery the line names Submit and every held act stays held.
- **A socket closed as too large** (decision 3): on a 1009 close, the board page settles the commands it sent on that socket and has not seen acknowledged as refused, never resends them, tells their questions as above, and reconnects as after any drop.
- **Work too large to keep across a reload** (decision 4): when the view's draft record passes the draft limit, the board page mirrors it without the work of whole questions, the largest first, until it fits, never part of a question's work. Each question left out shows that a reload would lose its work; the board page keeps the whole record for "Copy my unsent work", the leave-page prompt and the unsent-work banners.
- **Documents**: spine AD-20 (Drafts) and AD-21 (Connections) amended in place, one sentence each; EXPERIENCE State Patterns (Question rows), Voice and Tone (a size-limits row, en-US and it-IT to review) and What a reload keeps; CHANGELOG Known limits under Unreleased.
- **Not in this change**: an input-side bound on a question's size at `ask` and `update` (open question 1); splitting a Submit into several commands (decision 2); a visible line for the board page's other refusals of an act (the board changed meanwhile, an ended ask), which keep their banners or the log.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contract`: new requirement "The board's message limit and its measure".
- `board-host`: new requirement "The board's message limit".
- `view-and-widgets`: new requirements "An answer too large to send" and "Work too large to keep across a reload"; "Leave-page prompt" also arms on work too large to keep.

## Impact

- Code: `packages/contract/src/` (a new module, its export block), `packages/server/src/board-host/boards.ts` (the constant from `contract`), `packages/view/src/board-page/` (`controller.ts`, `outbox.ts`, `reconnect.ts`, a new `draft-fit.ts`, `unsent-work.ts`), `packages/view/src/view-protocol.ts` (optional reply and settlement fields, not a contract set), `packages/view/src/shell/` (`card-acts.ts`, `index.tsx`'s draft report, `answer-acts.ts`, the card's line in `question-actions.tsx`), `packages/view/src/strings/`. Tests beside each, and one session browser file.
- No schema set moves, no board-protocol message, no dependency (design decision 6).
- IDs served: FR-22, FR-25; NFR-10, NFR-12. ADs: AD-7, AD-10, AD-20 (amended), AD-21 (amended). UX: EXPERIENCE State Patterns (By surface: Question; What a reload keeps), Voice and Tone, Interaction Primitives (Close and reload); DESIGN Components (Field error, for the line's look).

## Open questions for the PO

Each carries a proposed default, accepted under the PO's unattended handoff of 2026-11-08; task 0.1 records them, and a different answer comes back through `/opsx:update` before group 1.

1. **An input-side bound** (design decision 5). *Default:* none in this change; the board page's check is the fix, since what passes the limit is what the user writes, which no bound on the agent's `ask` can measure. *Alternatives:* (a) a maximum count of items per question at `ask` and `update` (a minor of the input format, the tool envelopes and the board document; it stops the many-TextFields path on `main` but not two Document reviews, and refuses asks that work today); (b) a worst-case answer size per item type, summed per question at `ask` (complete, but every registry entry must declare one and it refuses questions that are almost never filled, such as three Document reviews); (c) a budget inside a widget whose one item can approach the limit, such as `document-review`, as that change's own design.
2. **Submit too large** (decision 2). *Default:* refused whole, every act kept held, the line telling the user to switch to immediate delivery and answer the questions one at a time, or shorten the work; Submit stays one atomic append (AD-20). *Alternative:* the board page splits Submit into several commands, which changes what one Submit means to the agent.
3. **The wording** (decision 7). *Default:* en-US "Not sent: this answer is too large ({size} MB, at most {max} MB). Shorten your work on this question, then answer again."; Submit: "Not sent: Submit is too large to send at once ({size} MB, at most {max} MB). Switch to Immediate and answer the questions one at a time, or shorten your work."; after a 1009 close: "Not sent: the board refused this answer as too large. Shorten your work on this question, then answer again."; a question left out of the draft: "Too large to keep across a reload: answer this question before you reload, or shorten your work."; it-IT in design decision 7, marked to review. *Alternative:* the same lines without sizes.
