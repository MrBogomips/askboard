# Proposal

## Why

Issue: #70 (end-to-end check V1 of 2026-11-08, severity M). After the agent reopens an answered question, its widgets show the agent's values, not the user's last answer, and nothing says so. An answer that changes something else then drops the earlier edits, because `changes` are computed against the agent's revision (AD-20). "Start from my previous answer" does not help with edits either: it brings back the choice, notes and results but no widget value (`fillFrom`, `packages/view/src/shell/card-acts.ts:500`), so EXPERIENCE's "moves it into the draft" fails for every edit widget. The same gap loses edits when the user revises an answered question and leaves one of its edited widgets alone: the card shows that widget's answered value, but the revised answer omits it (design.md, Context).

## What Changes

- **A reopened question starts from the user's last answer** when its revision is unchanged since that answer's and every part of the answer still fits (`fits`, `valueFits`): its choice, notes, results and widget values fill the draft, with no gesture and nothing sent (AD-10). Otherwise it starts from the agent's revision. A line in the "Reopened by the agent" notice says which, pointing to "Start from my previous answer" when nothing was carried.
- **Carrying an answer brings back widget values.** "Start from my previous answer", a revision's start and the reopen prefill carry an item's edited value when the item is unchanged since the answer's revision and its type shows the value (`valueFits`). What is sent equals what is shown (AD-10).
- **`ask-core` says what is unchanged.** The board state's current and previous answers name the question and the items whose props equal those of the revision the answer names. The board page cannot know this after a reload.
- **On connect, `board-host` sends a held draft record before the board state**, no longer after it, so the board page's first update to the view carries the restore whenever there is one, and the prefill never runs ahead of the user's restored work (design decision 9).
- **The draft record remembers the prefill**, so a reload never repeats it over what the user undid. A marker alone counts as no unsent work.
- **Derived values** follow keep-mine-shown-revision's rule (#66). A reopened question's answer names its current revision, so it carries the derived values computed from what the board shows.
- **Versions:** the board protocol and the Snapshot data, each at the next minor after `main`'s (design decision 7).
- **Documents:** EXPERIENCE (Reopened question, its Voice and Tone rows) and DESIGN.md (Reopened question) drop "nothing carried over". Spine AD-10 and AD-20 and PRD FR-6 are amended in place. CLAUDE.md names the change once merged.
- **Decision:** the PO's proposed default from the Issue, accepted under the PO's unattended handoff of 2026-11-08 (open question 1). The opening's order (design decision 9) is this design's choice, made when task 0.1 found no restore signal, and is likewise a proposed default accepted under that handoff.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: "Reopened question" changes; new requirements for the reopen prefill, its line, and widget values carried by an answer.
- `core`: new requirement, the unchanged items of an answer in the board state.
- `contract`: new requirements, the board state's `unchanged` and the draft record's prefill marker.
- `board-host`: "Board protocol over a WebSocket" changes: on connect, the draft record comes before the state.

## Impact

- Code: `packages/core/src/lifecycle/` (`views.ts`, `model.ts`: the answer's revision kept at reopen; `unchanged`), `packages/contract/src/schemas/board-protocol/` (`board-state.json`, `draft-record.json`, the constant), `snapshot-data/` (the constant), and `packages/view/src/shell/` (`card-acts.ts` `fillFrom`, `question-card.tsx` `revise`, `change-notice.tsx`, a new `reopen-prefill.ts`, `board-draft.ts`, `index.tsx`). Also `board-page/unsent-work.ts` and the strings (en-US, it-IT). The opening's order: `packages/server/src/board-host/boards.ts` (`#openers`), `packages/view/src/board-page/controller.ts` (`#onDraft`) and `draft.json`'s description.
- Tests: core, contract, board-host, board page and shell units, and one session browser file.
- No dependency, no widget chunk, no `ComponentFacts` member, no tool or skill text.
- IDs served: FR-6, FR-12, FR-22; NFR-10. ADs: AD-7, AD-10, AD-13, AD-20, AD-21. UX: EXPERIENCE Component Patterns (Reopened question), Voice and Tone (Reopened question); DESIGN.md (Reopened question).

## Open questions for the PO

Each carries a proposed default. Question 1's was given by the Issue and is accepted under the PO's unattended handoff of 2026-11-08; the others are this design's, carried under the same handoff unless the PO answers otherwise before group 1.

1. **Prefill or notice only** (design decision 3). *Default:* prefill when the question is unchanged since the answer's revision and every part fits; otherwise the notice line points to "Start from my previous answer". *Alternative:* a notice only, no prefill.
2. **A revision of an answered question carries untouched widgets' edits** (design decision 2; Context, second divergence). *Default:* in this change: the revision's start seeds them, like the results today. *Alternative:* a separate Issue, leaving the loss on `main`.
3. **The gate is the whole question** (design decision 3). *Default:* the prefill runs only when `ask-core` lists the question itself as unchanged. A reopen with any change of the agent's falls back to the button, which carries what still fits per item. *Alternative:* prefill per unchanged item even when the agent changed the question; this risks a verdict, such as an Approval's, carried over changed siblings.
4. **Prefilled work is unsent work** (design decision 4). *Default:* yes, as soon as it fills the draft. It arms the leave-page prompt, and a later change by the agent raises the agent-change notice. *Alternative:* an untouched prefill counts as none, which needs a comparison with the previous answer on every check.
5. **The notice lines** (design decision 5). *Default:* en-US "Your previous answer is filled in. Change it or answer again." / "This question starts from the agent's version, not from your previous answer. "Start from my previous answer" brings back what still fits." it-IT "La tua risposta precedente è già inserita. Modificala o rispondi di nuovo." / "Questa domanda riparte dalla versione dell'agente, non dalla tua risposta precedente. "Parti dalla mia risposta precedente" recupera ciò che è ancora valido." (Italian to review). *Alternative:* the second line only.
