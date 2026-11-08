# Proposal

## Why

The question's single Choice gets the manual activation EXPERIENCE requires (Option row, Keyboard core; F-02, L168) by cancelling the click that Radix Radio Group dispatches from its focus handler when an arrow key moves the focus (`packages/view/src/catalog/choice/single-choice.tsx:31-39`). Radix does not document that click: its documented keyboard checks a radio on the arrow keys, and no prop of Root or Item selects manual activation. The PO's rule of 2026-11-07 allows only documented dependency APIs, and a Radix update can break the trick silently, sending the user's arrow presses into the draft. `form-widget` reported it (proposal, open question 12; design, Risks) and left the PickField on Radix's automatic activation for that reason alone, which contradicts EXPERIENCE's "Moving through the options with the arrow keys never selects". The PO decided on 2026-11-08: "Choice di Form: to be fixed".

## What Changes

- **AskBoard's own radio group** (design decisions 1 and 3): the question's single Choice and the single PickField render a `radiogroup` of buttons with the `radio` role and `aria-checked`, a roving tab stop and the keyboard of WAI-ARIA's radio group in a toolbar (the APG's documented manual checking): Tab enters on the checked radio, else the first; the arrow keys, Home and End move the focus only, wrapping; Space, Enter or a click checks an unchecked radio and does nothing on a checked one. It rests only on HTML buttons, ARIA roles and focus, so no library behaviour, documented or not, decides what is checked.
- **The Choice** keeps its behaviour and every existing keyboard test; one refinement: Space or Enter on the selected option no longer rewrites the draft, so a ready answer stays ready (APG).
- **The PickField** (design decision 2): its single pick takes the same group, so its arrow keys move the focus only and Space, Enter or a click picks; the scenario "A single pick by keyboard" changes accordingly.
- **The `radix` library chunk** no longer carries Radio Group, which no source imports any more (design decision 4).
- **Documents**: EXPERIENCE (Component Patterns, Option; Accessibility Floor, Keyboard core; Composition and Components, the atoms table and Component per widget, Choice and Form) names AskBoard's own radio group; the spine's Stack line for `radix-ui` drops Radio Group. The PRD does not change.
- **Not in this change**: the multiple Choice (Radix Checkbox with AskBoard's roving focus, documented API only) and the multiple PickField (one Tab stop per box) are unchanged; the radio roles that Radix Toggle Group renders for the Approval, the MoneyField's currencies and the Gantt's zoom (open question 3).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: new requirement "Radios with manual activation"; "The PickField" (from `form-widget`, archived in #67) takes it in place of Radix's documented radio keyboard.

## Impact

- Code: `packages/view/src/catalog/fields/` (new `roving.ts` with `nextFocus` moved from `choice/selection.ts`, new `radios.ts`), `catalog/choice/single-choice.tsx`, `multiple-choice.tsx` (import path only), `catalog/pick-field/index.tsx`, `tools/build/shared-modules.ts` (`LIBRARY_CHUNKS.radix`), `packages/view/chunk-sizes.json`. Tests in those folders, `tools/build/shared-modules.test.ts`, and browser files `board.browser.ts`, `lifecycle-card.browser.ts`, `pick-field.browser.ts`.
- No dependency added or removed (`radix-ui` 1.8.1 stays for the other primitives); no schema set, board message or port member.
- IDs served: FR-3, FR-11, FR-13; NFR-10, NFR-12. ADs: AD-9, AD-10, AD-19. UX: EXPERIENCE Component Patterns (Primitives: Option), Interaction Primitives (Explicit acts), Accessibility Floor (Keyboard core, Tab order), Composition and Components (Atoms, Component per widget: Choice, Form); DESIGN Components (Option: the focus ring without the selected look, unchanged).

## Open questions for the PO

Each carries a proposed default, accepted under the PO's unattended handoff of 2026-11-08 except question 1's premise, which the PO decided ("to be fixed"); task 0.1 records them, and a different answer comes back through `/opsx:update` before group 1.

1. **How the Choice gets manual activation on documented ground** (design decision 1). *Default:* (b) AskBoard's own radio group. *Alternatives:* (a) Radix's documented automatic activation, where an arrow key checks and a check only fills the draft, which reverses F-02 in EXPERIENCE and the spec and lets an arrow press clear typed "Other…" text and unready a ready answer; (c) Radix Toggle Group in single mode, whose documented keyboard is manual but whose radio roles and re-press clearing are undocumented.
2. **The PickField follows** (design decision 2). *Default:* yes, so every radio on a board behaves alike and EXPERIENCE's rule holds without an exception. *Alternative:* the Choice only, leaving the PickField on Radix's automatic activation and adding the exception to EXPERIENCE's Keyboard core.
3. **Toggle Group's radio roles** (Approval, MoneyField currencies, Gantt zoom). *Default:* unchanged here: their behaviour uses only Toggle Group's documented API and keyboard, and only the `radiogroup` and `radio` roles they render are undocumented. *Alternative:* a later change that gives them AskBoard's own group too.
