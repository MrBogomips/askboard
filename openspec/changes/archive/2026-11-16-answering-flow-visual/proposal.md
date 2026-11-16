# Proposal

## Why

Issue: #168 (change 6 of the answering-flow work; its pull request closes it)
Issue: #213 (the PO chose option 1: the ask pill says what the user answered; its records are corrected here)

The PO chose direction B "Cabina" for the board (#168, 2026-11-14) and settled its open points on the 1.1.0 mockup (#168 comment 6896178334 and the Q1 to Q3 answers, #213, 2026-11-15). Changes 1, 4 and 5 give the board the flow, the state ladder and the keys; this change gives it B's layout: everything in view, delivery and its ledger in one place, and no bar at the bottom that reflows or hides the target of a jump. Input: `drafts/ux-review-168/ux-review-report-1.1.0.md` §3 to §6.4, §8.3 P2-1 and §9, `cabina-settling-1.0.0.md` and `proposals/proposal-b-cabina-1.1.0.html`. It serves FR-2, FR-3, FR-4, FR-22, FR-24, FR-25, FR-26, FR-34, NFR-10 and NFR-12.

## What Changes

- **The frame.** The context header keeps its first row (who asked and where, FR-24) and gains B's two rows: the ask row (title, ask ID, ask pill, agent pill, the postponed warning, then the tools: Snapshot, Keys, Theme, Settings) and, on a board of two or more questions, the progress row (the progress strip, the count to do, "Next to do" with its key, "Prefill recommended"). A left rail of 256 px holds the outline over the outbox, in sections, tabs and one question per view. **BREAKING** (layout): the bottom action bar is removed; the single-question board keeps only the header and its card.
- **The outbox**, at the rail's foot: the delivery switch and its helper, a four-cell ledger (Drafts, Ready, Sent, Delivered) counted from the answer states and the receipts, never from the ask pill, "Send {count} answers" in "All together" only, and the lines beside it ("{count} answers ready: nothing has been sent yet.", all ready, updates that need a choice).
- **The progress strip**: one segment per question, by area, with its state's icon and name; it marks the question in view and jumps on activation, one Tab stop with arrow keys.
- **Short question numbers** (Q1, D1 in Italian): fixed at first display, the next free number for a question the agent adds, a gap for one it removes, kept across a reload in the draft record (AD-20 amended; board protocol at the next minor after main's).
- **The card in B's look**: a state stripe (dashed on its way, solid arrived) and a state badge in its head, the number and the chip, "More" as an icon; the answered look with "Edit"; the reason beside a blocked primary for a question with nothing chosen; key caps on the primary and on "Next to do".
- **The feedback tray**, top right of the content: Snapshot feedback, the prefill result with "Undo", the agent's added question with "Go"; it never times out and never hides a focused control.
- **The ask pill** keeps its words and says what the user has answered (#213 option 1): EXPERIENCE.md's State pill, Ask states and Counting rows, the spec sentence "The ask pill SHALL show only what the agent has received" (replaced by the requirement "What the ask pill says") and the comment on `askPillOf` are corrected; delivery shows only in the receipts, the ledger and the completion panel.
- **Compact defaults**: the question text at 15 px, the card at 4 px radius, the sticky header's shadow (D-5); "Comfortable" still holds. Theme and density move into a "Theme" popover in the tools, where `palettes` (#189) adds its row.
- **Strings**: the mockup's strings outside report §4 ship as drawn, Italian marked "(to review)" (PO, 2026-11-15); the postponed warning reads "rimandata".
- **Records**: DESIGN.md and EXPERIENCE.md follow B; the spine's AD-20; the help skill's "The board" section; the implementation skill's harness note on what covers a target; `docs/as-built/answering-flow-visual.md`.
- **Out of scope**: palettes (#189); bundling Inter and JetBrains Mono (D-4), whose fonts weigh on every board and Snapshot (design D16; the rail is measured with Inter all the same); the PO's validation sessions, opened as an Issue by the last group.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: new requirements for the board's frame, the ask row, the progress strip, the outbox and its ledger, short question numbers, the card's state and answered look, the feedback tray, key caps, what the ask pill says (#213) and Tab clearing the sticky bars. Modified: "Single-question board", "One question per view", "Outline navigator", "Counts and the next-open jump", "Delivery mode", "Submit", "Undo of a prefill", "Focus moves clear the sticky bars", "Status messages for the answering flow", "The Snapshot control", "The Snapshot view's chrome", "Leave-page prompt", "Draft mirror and restore".
- `contract`: the draft record admits the board's short question numbers ("Short question numbers in the draft record").

## Impact

- `packages/contract`: the draft-record schema and `draftRecordProblems`, at the board protocol's next minor after main's; fixtures and tests. `packages/core` and `packages/server`: tests only (the record passes whole).
- `packages/view`: the shell (`board.tsx`, `board-header.tsx`, `navigators.tsx`, `question-card.tsx`, `question-actions.tsx`, `quick-toggles.tsx`, `markers.tsx`, `board-draft.ts`, `board-view.ts`; `bottom-bar.tsx` removed; new modules for the ask row, the progress strip, the outbox, the ledger, the numbers and the feedback tray), the view protocol's `open-settings` (it carries the inset), the board page's settings panel, the icon module, styles, strings, the harness and the browser tests.
- `tools/build/tokens.test.ts`, `tools/build/skills/templates/help/SKILL.md` and the regenerated `skills/askboard-help/`.
- Documents: DESIGN.md, EXPERIENCE.md, the spine's AD-20, `.claude/skills/askboard-implementation/references/test-harness-patterns.md` with its row in `docs/harness-history.md`, `docs/as-built/answering-flow-visual.md` and corrected sentences of the `answering-flow-fixes` and `answering-flow-guidance` notes.
- Stacks on `answering-flow-fixes` (#212), `board-keys` (#187, merged as #225) and `icon-set` (#210), all merged, and on `answering-flow-guidance`, not merged: this branch is rebased onto change 4's head, groups 1 and 2 start there, group 3 and later wait for change 4's later groups, and task 10.1 rebases onto `origin/main` after change 4's squash merge (design, Merge points). No new dependency. Platforms: macOS and Linux (NFR-7); browser tests in Chromium in the change, in Chromium, Firefox and WebKit in CI's e2e train on `main` (#227).
