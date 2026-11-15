# Proposal

## Why

Issue: #187

A user moving through 10 to 30 questions has no key at board level: going to the next question and answering it needs the mouse or a long Tab walk (finding F-25 of the UX review of #168, report 1.1.0 §5.1 and §8.2 P1-7). The PO accepted the keys on 2026-11-14 (decision 6): `N` and `Shift+N` for the next and previous open question, `Mod+Enter` on the question in focus, outside text fields and widgets, and no key for sending everything held. EXPERIENCE.md has left these bindings unrecorded since the first UX run (Open Items 21). This change comes after `answering-flow-fixes` (#212), whose focus, reveal, question-in-view and status seams the keys reuse. It serves NFR-12, NFR-10, FR-10, FR-22, FR-29 and FR-34.

## What Changes

- **A key table for the board.** The contract gains the board's own key table, built from the key vocabulary like a widget's and checked by the same table check. `N` goes to the next open question and `Shift+N` to the previous one. `Mod+Enter` answers the question in focus, and also sends a follow-up from the composer. `?` opens the board's keys panel. A widget type may not be named `board`.
- **The user's keys reach the board.** The key-override check reads the board's table besides the registered widget tables, so a user file may change or remove the board's keys. As for the keys panel's own key, an action that acts across the board's controls may not take a key a native control needs (Enter, Space, the arrows and the like). `Cmd`/`Ctrl` with Enter becomes a key a table may bind. Every other `Cmd`/`Ctrl` letter but Z and A stays the browser's.
- **Next and previous open by key.** `N` does what "Next open" does, from the question in view. `Shift+N` goes to the open question before it, wrapping to the last. Both act only where focus is in the view, outside a text field, a widget, a menu and a dialog, and so not before the user has clicked or focused inside a newly opened board.
- **Answer by key.** `Mod+Enter` on a question card's own controls (its heading, options, actions and agent-change choices) presses that question's "Answer". The key takes the button's own path, with its gates, confirmations and focus move, so it sends nothing the button would not send. While "Answer" is blocked by a field, by nothing chosen or by an agent change waiting for a choice, the key sends nothing and the status region says why. The options' Enter acts only with no modifier, so the key never changes the choice it answers with (NFR-10).
- **The composer's send through the table.** The follow-up composer sends on the board table's send keys, `Ctrl+Enter` or `Cmd+Enter` unless the user's file says otherwise. The board's answer key never acts in a text field, so the composer keeps the key.
- **Discoverable board keys.** "Next open", "Answer" and the composer's "Send" show their keys in a tooltip and in `aria-keyshortcuts`. A "Keys" button in the context header, and `?`, open a "Board keys" panel. It lists the board's keys in effect, marks the user's changes, and says the keys do nothing in a text field or inside a widget and that sending all held answers has no key.
- **The help skill.** The generated `askboard-help` lists the board's keys from the table and every board action an override may name, and its key configuration reference says the user's keys reach the board as well as the Ranking. The skill is regenerated with `bun run build:skills`, never edited by hand.
- **Out of scope:** a default key for sending all held answers (the PO left it unset). Visible key caps on the controls and the keys button's icon (direction B, change 6). The renamed labels (change 4), whose keys the entries reuse. Board keys inside a widget (D2).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contract`: new requirements "The board's key table" and "Board keys a native control takes"; modified "The override check's default tables" (the board's table is read too).
- `view-and-widgets`: new requirements "Next and previous open by key", "Answer by key", "A blocked answer by key", "The board's key table matches its handlers", "The board's keys are discoverable", "The board's keys panel" and "The user's keys on the board's own keys"; modified "Follow-up thread" (the composer sends on the keys in effect).
- `skills`: new requirement "The board's keys in the help skill"; modified "The help skill teaches the key configuration" (the board's keys are reached and listed).

## Impact

- `packages/contract/src/keys/`: a new `board-table.ts`, `tables.ts` (the tables the override check reads by default), `check.ts` (`Mod+Enter` admitted), `overrides.ts` and `effective.ts` (the new default), and the export block at the end of `src/index.ts`. `packages/core` is unchanged: `ask-core`'s check follows the contract's default.
- `packages/view/src/`: `catalog/keys/hint.ts` (a panel group for the board's actions), `catalog/fields/roving.ts` (Enter flips a box only with no modifier), and in `shell/` `board.tsx`, `board-header.tsx`, `board-view.ts`, `question-card.tsx`, `question-actions.tsx`, `thread.tsx` and `thread-text.ts`. Also new modules for the board's key scope, the answer key, the board's key handler and the board's keys panel, and the strings in `en-US.ts`, `it-IT.ts` and `keys.ts`.
- Browser tests: two new files in `packages/view/test/browser/harness/suites.ts`. The key, focus and scroll cases run in Chromium, Firefox and WebKit. The header's Tab order gains the Keys button, which tests that walk the header follow.
- `tools/build/skills/` (`help.ts`, `help-keys.ts`, `keys.ts`, `templates/help/SKILL.md`) and the regenerated `skills/askboard-help/`, within the help skill's budgets.
- Documents: PRD NFR-12 (the board's own keys), EXPERIENCE.md (Accessibility Floor, Next-open jump, Context header, Voice and Tone, Open Items 21 closed), DESIGN.md (Context header, the key hint on "Next open" and "Answer", the board's keys panel), `docs/as-built/board-keys.md`, and one sentence of `docs/as-built/keyboard-shortcuts-help.md` (the check's default tables). No spine change.
- No contract schema set changes: the configuration schema bounds `keys` by shape only, and the override check gives it its meaning. No view-protocol message, draft field or dependency changes. The shell chunk grows about 5 to 8 KB within its allowance. Platforms: macOS and Linux (NFR-7).
