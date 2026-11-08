# Proposal

## Why

FR-11's Form, typed fields of text, number, money, date, a pick from a list and on/off with field checks, is the last widget the PO's order of 2026-11-07 puts on the atoms. `atoms` built five of its six fields and `layouts` the Groups and Tabs that make its sections, so a Form is now a question of input fields in layouts; what is missing is a pick from a list and the field checks (`required`, a text's length and pattern, a pick's count) that block "Answer".

## What Changes

- **No form library** (AD-7, AD-9, AD-19; EXPERIENCE amended): a Form is a question's input fields arranged by layouts, a Group per section. `@rjsf/core` and `@rjsf/utils` leave the spine's Stack unadopted: the renderer spike measured a 254 to 393 KB chunk, an internal copy of the form's data against AD-9, and a theme that maps every field back onto the atoms (design.md, decision 1).
- **A PickField** (FR-11, FR-13): the `pick-field` input atom, a single pick as radios or a multiple pick as checkboxes, from 2 to 50 options with IDs, a filter field above a long list; its result is an option ID or a list of IDs.
- **Field checks** (FR-11, FR-12, AD-7 amended, AD-10): `required` on every input field; `minLength` and `pattern` on a TextField; `minItems` and `maxItems` on a multiple PickField. A check is computed from the field's props and its value, by the contract's own code: the view shows its field error and blocks the question's "Answer", Accept recommended, the ready mark and Submit; `ask-core` refuses an answer that fails `required`, a length or a count. A value that fails a check stays in the draft, so the user corrects it.
- **Safe patterns** (NFR-5, AD-8; EXPERIENCE amended): `ask` and `update` refuse a `pattern` outside the safe subset (backreferences, lookaround, a repeated group holding a quantifier or an alternation), naming the item. The pattern runs only in the view, on the user's text, never on the session process (threat model, ReDoS); its residual cost on pathological text is measured and recorded as a known limit (PO rule of 2026-11-07).
- **The askboard skill**: the PickField's teaching text and one generated sentence on forms, within the skill's budgets.
- **Versions** (askboard-contract-versioning): the input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s, bound at the rebase. The board protocol, the Snapshot data and the view manifest do not move.
- **Documents**: `spine-update-draft.md` amends AD-7 and the Stack; `ux-update-draft.md` amends EXPERIENCE (Form, Form library, Field checks, the Choice atom, Voice and Tone) and DESIGN (Form, Input atoms). Task 0.1 applies both. The PRD does not change: FR-11's row stands as written.
- **Not in this change**: a Form over agent values (fields that start from the agent's value), an "Other…" answer on a PickField, a `form` item type, repeatable entries (EXPERIENCE: out of the first version).

## Capabilities

### New Capabilities

None: the behaviours belong to the capabilities E1 created.

### Modified Capabilities

- `contract`: the field checks and their props on the input atoms; the safe-pattern check; the PickField type; teaching text; the four sets' next minors.
- `core`: answers refused on a failing field check; PickField answers.
- `view-and-widgets`: the field block on every path to an answer; required labels; the TextField's checks as typed; the PickField component; the Tabs mark for a failing check; Forms end to end and in Snapshots; strings.

## Impact

- Code: `packages/contract` (`widgets/field-checks.ts`, `widgets/shared/pattern.ts`, `widgets/pick-field/`, the five input atoms' props, checks and entries, `registry.ts`, `fixtures/form.ts`, the four set modules), `packages/core` (`lifecycle/widget-event.ts`, `acts.ts`), `packages/view` (`catalog/port.ts`, `catalog/fields/`, the five field chunks, `catalog/pick-field/`, `shell/` entry-block readers, strings), `tools/build/skills/`, `skills/askboard/`, `packages/view/chunk-sizes.json`.
- No new dependency; RJSF is removed from the spine's pins (it was never installed). Radix Radio Group and Checkbox are in the `radix` library chunk.
- Stacked on `layouts`, itself on `atoms` (PR #57); neither is merged: merge points and borrowed seams in design.md.
- IDs served: FR-11, FR-12, FR-13, FR-3, FR-18, FR-22, FR-34; NFR-5, NFR-6, NFR-10, NFR-12; SM-1 (skill budget); R4, R6. ADs: AD-1, AD-6, AD-7 (amended), AD-8, AD-9, AD-10, AD-13 (not used, decision 2), AD-15, AD-19, AD-20. UX: EXPERIENCE Component Patterns (Primitives: Input atoms, the Choice atom; Widgets: Form; Answer; Field error), Composition and Components (Component per widget, Form library, Field checks), Voice and Tone; DESIGN Components (Input atoms, Form, Field error, Answer).

## Open questions for the PO

Each carries a proposed default, taken under the PO's unattended handoff of 2026-11-07; the PO may revisit.

1. **No form library.** *Default:* the Form is built from the atoms and layouts; RJSF leaves the spine's Stack. *Why:* every field is already an atom; RJSF adds a large chunk, its own state against AD-9 and a remount risk, for a flat form. *Alternative:* RJSF 6.11.0 themed on the atoms, as the spine pinned.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
2. **No `form` item type.** *Default:* a Form is a question's fields, a Group per section, taught as such. *Alternative:* a `form` container type, which would repeat the Group.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
3. **Field checks in the contract, not the compute graph.** *Default:* each field type's check is plain code in `contract`, the same function in the view and in `ask-core`; no graph node, nothing in an answer's `derived` (EXPERIENCE amended). *Alternative:* checks as nodes of AD-13's graph.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
4. **Where the pattern runs.** *Default:* only in the view, as the user types; `ask-core` checks the pattern's subset at send time and every other field check on the answer, never the pattern on user text. *Why:* the session process runs no agent pattern on user text (threat model, ReDoS); the text is the user's, so NFR-10 is not at stake. *Alternative:* `ask-core` also runs it.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
5. **The safe subset.** *Default:* EXPERIENCE's subset (no backreference, lookaround or nested quantifier) plus no alternation inside a repeated group, which also backtracks exponentially on short text; a pattern of at most 200 characters, `u` flag, unanchored as in JSON Schema; a field with a pattern holds at most 1,000 characters. *Alternative:* the spike's subset as is.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
6. **An empty required field.** *Default:* its label ends "(required)"; it shows no field error; "Answer" is disabled, described "Complete {label} first."; a tab holding it carries no mark. *Alternative:* "Answer" enabled, errors shown on press, as the Approval's reason.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
7. **The PickField's list.** *Default:* 2 to 50 options `{id, label, description?}`; a filter field above more than 10; a single pick has "Clear"; no "Other…". *Alternative:* no filter (DESIGN amended), or "Other…" text.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
8. **A Form over agent values.** *Default:* not in this change: fields start empty, as FR-11's minimum. *Alternative:* an initial value per field, reported unchanged when untouched.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
9. **The skill's budget.** *Default:* `SKILL.md` stays within 9,000 characters; the PickField's use and the form sentence are written short and measured in group 1; an overrun stops for `/opsx:update`. *Alternative:* raise the budget now.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
10. **Conformance.** *Default:* no new conformance file: the answer event, the push message and `collect` are generic over results, and `core`'s tests cover the refusal. *Alternative:* a Form results file in the three configurations.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
11. **The PO's check by hand.** *Default:* not blocking: task 4.3 fills a Form with a filtered pick and a pattern in Chrome and Safari.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
12. **The PickField's keyboard.** *Default:* Radix's documented radio keyboard, where an arrow key moves and picks (a pick only fills the draft). *Why:* the question's Choice gets manual activation by cancelling a click Radix makes on focus, which Radix does not document; the PO's rule of 2026-11-07 allows documented APIs only. *Alternative:* the Choice's manual activation.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
