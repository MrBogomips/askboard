# Proposal

## Why

Issue: #179
Issue: #180
Issue: #181
Issue: #182
Issue: #183
Issue: #184
Issue: #185

The UX review of the answering flow (#168, report 1.1.0 §8.1, P0-1 to P0-7) found seven defects that hold whatever layout the board takes later. Focus falls to `<body>` after "Answer" and Submit, a jump can leave its target under the sticky bars, "Next open" and the outline follow the last jump and not the user, nothing is announced to screen readers, submitted delivery has no helper text, one question per view shows two next-open buttons, and a disabled "Answer" hides its reason from sighted users. They break WCAG 2.2 SC 2.4.3, 2.4.11 and 4.1.3 and the documented behaviour (NFR-12, FR-2, FR-3, FR-6, FR-22). The fixes also come first in the order of the answering-flow changes: the guidance flow (change 4), the board keys (change 5) and direction B's layout (change 6) build on the focus, reveal, question-in-view and status-message seams added here.

## What Changes

- **Focus after "Answer" and Submit** (#179, P0-1). When an act leaves the pressed control disabled, focus moves to a heading. After "Answer" or "Accept recommended" sends at once, and after a confirmed revision, it moves to the question's own heading. After Submit, it moves to the heading of the question in view. The move happens when the act is taken, never when its command settles, so focus the user has moved elsewhere is never taken. Nothing advances: one question per view still does not move on after an answer.
- **Focus moves clear the sticky bars** (#180, P0-2). Every move to a question's heading scrolls so that the heading lies wholly between the context header and the bottom action bar: the next-open jump, the outline, the unread and agent-change jumps, the question navigator, tab activation, and the focus moves above. The move to a field to fix does the same.
- **The question in view follows the user** (#181, P0-3). With sections and tabs, the question in view is the one whose card holds focus, else the one at the reading line between the bars. It follows scrolling and focus. The outline marks it, and "Next open" searches forward from it. A restored draft keeps its question in view until the user scrolls or moves focus.
- **Status messages** (#182, P0-4). One polite status region outside the cards announces what happened without taking focus: an answer sent (only once the board page reports it sent), a note sent, an answer marked ready and not sent, Submit's count, the result of "Select recommended", questions the agent added, and the question in view the agent removed. The agent pill stops being a live region: "working" is no longer announced, and "waiting for your answer" goes through the status region. No message claims delivery to the agent (NFR-10, AD-10).
- **Helper text in both delivery modes** (#183, P0-5). Submitted delivery shows "Answers stay here until you press "{Submit}"." in the ask's language. The wording is the one the PO accepted, and it names the send button by its label at the time.
- **One next-open control in one question per view** (#184, P0-6). By the PO's decision, the jump stays in the header on every board of two or more questions. The question navigator keeps "Question n of m", its markers, Previous and Next, and loses "Next open →". EXPERIENCE.md, DESIGN.md and the spec are amended together.
- **A visible reason on a blocked "Answer"** (#185, P0-7). The reason that today only screen readers hear ("Correct {label} first.", "Complete {label} first.") is shown beside the disabled "Answer" as a link-style button. It stays the button's description, and activating it moves focus to the field. When the field sits in a hidden tab of a Tabs layout, that tab is selected first.
- **Out of scope**, left to later changes of #168: the state ladder, the after-answer setting, "Continue", the completion panel, prefill with undo and the renamed labels (change 4); the board keys N, Shift+N and Mod+Enter (change 5); Lucide icons (`icon-set`); direction B's layout (change 6). Also left out here: messages for postpone, decline, a lost ready mark and delivered counts, which change 4 adds together with its renamed labels.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: new requirements "Focus after Answer and Submit", "Focus moves clear the sticky bars", "The question in view" and "Status messages for the answering flow". Modified: "Counts and the next-open jump" (searches from the question in view), "One question per view" (no jump in the navigator), "Outline navigator" (marks the question in view), "Delivery mode" (helper text in both modes) and "Answer names the field to fix" (the reason is visible and leads to the field).

## Impact

- `packages/view/src/shell/`: `board.tsx`, `question-card.tsx`, `question-actions.tsx`, `bottom-bar.tsx`, `navigators.tsx`, `agent-pill.tsx`, `card-acts.ts`, `revision-confirm.ts`, `document-update.ts`, `field-block.ts`, `index.tsx`. Also new pure modules for the reveal, the question in view and the status messages, with their unit tests.
- `packages/view/src/strings/` (`keys.ts`, `en-US.ts`, `it-IT.ts`): about nine keys added, `navigator.nextOpen` removed.
- Browser tests: four new files listed in `packages/view/test/browser/harness/suites.ts`. The focus, scroll and field-focus cases run in Chromium, Firefox and WebKit.
- Documents: `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (Accessibility Floor, Next-open jump, Outline navigator, Question navigator, Presentations, Voice and Tone; Open Items 22 narrowed), `DESIGN.md` (Context header, Next-open jump, Question navigator, Bottom action bar, Answer), and `docs/as-built/answering-flow-fixes.md`. No PRD or spine change: the fixes meet FR-2, FR-3, FR-6, FR-22, FR-34, NFR-10 and NFR-12 as written.
- No contract schema, view-protocol message, draft-record field, key table or dependency changes. The shell chunk grew by 7,215 B, from 223,354 to 230,569 B, within its 10% allowance; the build's 10% allowance resets to the recorded 230,569 B (about 23 KB) (task 6.2). Platforms: macOS and Linux (NFR-7); the browser engines are the suite's three.
