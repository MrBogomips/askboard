# Proposal

## Why

Issue: #168 (Refs: change 4 of the answering-flow work; `answering-flow-visual` closes it)

After an answer the board still leads nowhere: the card barely changes, nothing names the next question, and the user has no setting for whether the board moves on. "Answer" means "send" in one delivery mode and a silent "mark ready" in the other, the mode names do not say when answers leave, "Select recommended" behaves differently per mode and reports nothing, no surface says when the board is done, and the states a question goes through are worded three ways. The UX review of #168 (report 1.1.0 §3 to §5, §8.2 P1-1 to P1-6 and P1-8) sets the shared flow that holds whatever layout the board takes, and the PO decided its open points (#168, 2026-11-14 and 2026-11-15). The focus, reveal, question-in-view and status-message seams of `answering-flow-fixes` (#212) are the base this change builds on. It serves FR-2, FR-3, FR-4, FR-7, FR-22, FR-24, FR-34, FR-35, NFR-10 and NFR-12.

## What Changes

- **One ladder of answer states on every surface** (P1-1): To do, Draft, Ready not sent, Not sent yet, Sent, Delivered to the agent, Postponed, Declined, each a text label with a shape, later an icon, on the card, the outline, the question navigator and the tabs. A state shows only when it is true (NFR-10, AD-3, AD-10).
- **After an answer** (P1-2): a user setting "After answering: Go to the next | Stay here", default "Go to the next" (PO, #168, 2026-11-15). With "Go to the next" the board moves to the next question to do, scrolled clear of the bars, with an arrival mark; with "Stay here" the card shows a footer naming the next question, with "Continue" focused. Revisions, notes alone, blocked acts and undoes never move the board. Postpone and Decline move on as an answer does. The status message names the next question.
- **The next question to do**: "Next to do" replaces "Next open". Unseen questions the agent added still come first, then questions to do or in draft after the question in view, and postponed ones last, wrapping once.
- **Completion** (P1-3): when nothing is left to do, a panel at the top of the content says "Every question has an answer. {s} sent, {d} delivered to the agent.", counted from the receipts only, never from the ask pill (AD-3, D-6 / #186). Postponed questions keep it open and say that closing loses the ask. It never says the tab can be closed. In "All together", focus goes to the send button with "All ready: nothing has been sent yet." until the send.
- **Tabs hand off** (P1-4): finishing a tab's last question to do announces "{area} completed", marks the tab done, and the board moves to the next tab with work. The tab strip is sticky under the header.
- **Wording and the two primaries** (P1-5): §4's accepted labels. "One by one | All together"; the primary reads "Send answer", "Confirm", "Send the note" or "Send the change"; a ready answer offers "Edit"; "Send {count} answers" is absent, not disabled, in "One by one" (PO decision 5); "Later" for Postpone.
- **Prefill recommended** (P1-6): "Prefill recommended ({count})" fills drafts only in both modes (PO decision 4), reports what it did with "Undo", and is absent when nothing is left to prefill. Send no longer carries prefilled selections the user did not confirm. "Accept recommended" moves to the recommended option's row and is absent once the question is answered, ready or declined.
- **Reduced motion** (P1-8): the move to the next question scrolls smoothly for at most 250 ms and the arrival mark fades, both instant or static under `prefers-reduced-motion: reduce`, as is every animation of the view and the board page.
- **Status messages** beyond the base's: postponed, declined, change sent, a ready mark lost, delivered counts (at most one message per 5 s), prefill undone, area completed, all answered, all ready.
- **Out of scope**: the board keys N, Shift+N and Mod+Enter (`board-keys`); direction B's layout, the outbox ledger, the progress strip, the removal of the bottom bar, the visible "added a question" notice with "Go", short question numbers and replacing the ask pill (`answering-flow-visual`); palettes (#189). The ask pill's behaviour is unchanged until #186 settles D-6.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: new requirements "The question's primary button", "The answer state ladder", "After an answer", "Completion", "Status messages for the guided flow", "Reduced motion". Modified: "Single-question board", "Delivery receipt on the board", "Keyboard core", "Tabs", "One question per view", "Outline navigator", "Counts and the next-open jump", "Open prompt", "Recommended option", "Select recommended", "Delivery mode", "Submit", "Revising an answer", "The board's interface in the ask's language", "The settings panel", "Presentation changes apply at once and persist", and the base's "Focus after Answer and Submit".
- `contract`: the configuration's `afterAnswer` key, a presentation key; the board protocol's `setting` and `settings` admit it ("The configuration schema set", "The configuration keys and their values", "The presentation keys are a closed list", "Settings messages on the board protocol").
- `core`: "Writing a presentation key" admits `afterAnswer`.
- `board-host`: "A board writes only presentation keys" admits `afterAnswer`.

## Impact

- `packages/contract`: configuration and board-protocol schemas and constants, each at the next minor after main's; fixtures and tests. `packages/core` and `packages/server`: tests only, as the presentation keys are read generically (`PRESENTATION_KEYS`, `CONFIGURATION_KEYS`).
- `packages/view`: shell (`board.tsx`, `question-card.tsx`, `question-actions.tsx`, `bottom-bar.tsx`, `board-header.tsx`, `navigators.tsx`, `board-view.ts`, `submit.ts`, `card-acts.ts`, `flow-messages.ts`, `markers.tsx`, `reveal.ts`, `use-question-in-view.ts`, new pure modules), `view-protocol.ts`, the board page's presentation and settings panel, `styles/`, strings (renamed values and new keys in en-US and it-IT), the icon module once `icon-set` (#210) has merged, browser tests and the harness's locators.
- `tools/build/skills/templates/help/SKILL.md` and the regenerated `skills/askboard-help/`.
- Documents: PRD FR-3, FR-22 and FR-35 and a glossary note on act names; spine AD-14 amended in place; EXPERIENCE.md (Board chrome, Question card rows, Counting, By surface, Accessibility Floor, Preferences and Settings, Voice and Tone, a new Key Flow); DESIGN.md (Markers, the chrome and card rows, new rows for the footer, the completion panel and the arrival mark, Open Items 1 settled); `docs/as-built/answering-flow-guidance.md`.
- No new dependency. Platforms: macOS and Linux (NFR-7); browser tests in Chromium, Firefox and WebKit.
