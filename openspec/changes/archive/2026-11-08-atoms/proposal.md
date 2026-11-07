# Proposal

## Why

FR-13 lets an agent build a question from atoms when no widget fits, and the PO's order of 2026-11-07 puts Image annotation, the Form and Document review after the Chart; all three need the atoms, and the Form builds on them. Today a question holds options and widget items only: an agent that needs a typed number, an amount, a date, a short text or an on/off answer has no item for it, and option previews are plain text only.

## What Changes

- **Eight atoms as registered types** (FR-13, AD-7, AD-9): the display atoms `text` (plain text or Markdown), `value` (a given number, money, date, duration or percent, in the ask's locale) and `divider`, which give no answer; the input atoms `text-field`, `number-field`, `money-field`, `date-field` and `toggle`, each giving a result, so a question's answer carries `results` keyed by atom item ID (FR-13, FR-18). Each is a registry entry with its props, checks, result schema and checks, wording, example and teaching text, and a component chunk in `packages/view/src/catalog/` (AD-9: atoms live in `view`).
- **Markdown as data** (NFR-5, AD-8): a Text marked `format: "markdown"` and an option preview marked `previewFormat: "markdown"` render through markdown-it with raw HTML off and DOMPurify with an explicit allow-list; table alignment as classes; images as links; only `http:` and `https:` links, opened on a click through the board page in a new tab (a new view message), never by the frame; bounded nesting and input size.
- **Locale entry without guessing** (FR-34, AD-7, EXPERIENCE Input atoms): NumberField and DateField use `contract`'s existing parsers and echoes; MoneyField gets the contract's own amount parser, giving a decimal string that never passes through a binary float, and its echo. The DateField adds a calendar (react-day-picker in Radix's non-modal Popover) whose captions, weekday names and labels come from AskBoard's own tables, never `Intl`.
- **Field text the atom cannot read blocks "Answer"** (NFR-10, AD-10, AD-20, amended): text that does not parse or falls outside the item's bounds stays in the field with its field error, is kept in the draft record as the item's entry, survives a reload, and disables the question's "Answer" until corrected or cleared. The board protocol's draft record gains `entries`; AD-20's Drafts bullet names them (`spine-update-draft.md`).
- **The Slider atom is the Scale** (EXPERIENCE amended): the Scale's slider display already is the Slider atom (EXPERIENCE, Component per widget), so no new type.
- **Licences** (NFR-6, AD-19): `markdown-it` 15.0.3, `dompurify` 3.4.17 and `react-day-picker` 10.0.2, already pinned in the spine's Stack and accepted by the renderer spike, are installed exactly; `check:licences` learns the addendum's named exception for `argparse` (markdown-it's command-line tool), admitted only while no chunk ships it.
- **The askboard skill**: each type carries its teaching text, and the skill is regenerated (`askboard-skills`), within its budgets.
- **Versions** (askboard-contract-versioning): the input format, the output format, the tool envelopes, the board document and the board protocol each take the next minor after `main`'s, bound at the rebase.
- **Documents**: `spine-update-draft.md` amends AD-7, AD-8 and AD-20 in place; `ux-update-draft.md` amends EXPERIENCE and DESIGN. Task 0.1 applies both. The PRD does not change.
- **Not in this change**: layouts (Stack, Row, Group, Tabs inside a question) and nested items, left to the follow-up change `layouts` (open question 1); an inline Image atom (Image annotation brings it); a Choice atom as an item (the Form's pick fields); a Value computed by a formula; `required`, `pattern` and other field checks (the Form's).

## Capabilities

### New Capabilities

None: the behaviours belong to the capabilities E1 created.

### Modified Capabilities

- `contract`: the eight atom types (props, results, checks, wording, examples, teaching text); the amount parser; Markdown option previews; entries in the draft record; the five sets' next minors.
- `core`: atom answers through `ask-core`; entries held apart and never exposed.
- `view-and-widgets`: the eight components; Markdown rendered as data, its links and its bounds; option previews in Markdown; an entry blocking "Answer"; strings in en-US and it-IT; the atoms end to end and in Snapshots.

## Impact

- Code: `packages/contract` (`widgets/{text,value,divider,text-field,number-field,money-field,date-field,toggle}/`, `registry.ts`, `locale/` amount entry, option schemas, `schemas/board-protocol/draft-record.json`, `draft-record.ts`, the five set modules, fixtures), `packages/core` (tests only, expected), `packages/view` (`catalog/<atom>/`, `catalog/fields/` shared code, `catalog/text/markdown.ts`, `catalog/components.ts`, the Choice preview, the shell's entries, `view-protocol.ts` and `board-page/controller.ts` for the link message, strings), `tools/check-licences.ts` and a named-exceptions table, `tools/build` (only if a chunk check needs the exception), `skills/askboard/` (regenerated), `packages/view/chunk-sizes.json`.
- New dependencies, pinned exactly in `packages/view`: `markdown-it` 15.0.3 (MIT; 22,032 stars, pushed 2026-10-23; its `argparse` is PSF-2.0, the addendum's named exception), `dompurify` 3.4.17 (MPL-2.0 OR Apache-2.0, taken as Apache-2.0; 17,509 stars, pushed 2026-11-07), `react-day-picker` 10.0.2 (MIT; 6,865 stars, pushed 2026-10-21) with `date-fns` (MIT, 36,659 stars) and `@date-fns/tz` (`gh api` and `npm view`, 2026-11-07). All three passed the adoption rule in the renderer spike (findings, pins, accepted 2026-10-30) and stand in the spine's Stack; task 0.3 re-reads the evidence.
- Merge points with `chart-widget` (PR #54, open): design.md, Merge points.
- IDs served: FR-13, FR-11 (the Scale as Slider), FR-18, FR-20, FR-34; NFR-5, NFR-6, NFR-9, NFR-10, NFR-12; SM-1 (skill budget). ADs: AD-1, AD-6, AD-7 (amended), AD-8 (amended), AD-9, AD-10, AD-12, AD-19, AD-20 (amended). UX: EXPERIENCE Component Patterns (Primitives; Option preview), Interaction Primitives (Explicit acts), Accessibility Floor (Keyboard core), Localization (Values, Formats), Voice and Tone, Composition and Components (Atoms); DESIGN Components (Primitives: Display atoms, Input atoms, Divider; Field error).

## Open questions for the PO

Each carries a proposed default, taken under the PO's unattended handoff of 2026-11-07 (PO priority: after the Chart, Image annotation, the Form and Document review, which need the atoms).

1. **Atoms now, layouts next.** *Default:* this change ships the atoms only, about 35 tasks; layouts and nested items (the input schema's nested items, the ask-items walker, the board document, the draft record, `fetch` and ID uniqueness across levels) follow as the change `layouts`. *Trigger:* `layouts` is proposed when this change merges, and lands before the first change that nests items (the Form's sections, Tabs inside a question). *Alternative:* one change of about 48 tasks.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
2. **The Slider atom is the Scale.** *Default:* no `slider` type; the Scale's `display: "slider"` is FR-13's Slider, its result `value`, or `low` and `high`; EXPERIENCE's atom tables say so. *Why:* two types with one behaviour cost the agent tokens (SM-1) and the user nothing. *Alternative:* a `slider` type over the Scale's component.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
3. **Choice and Image as items.** *Default:* not in this change; a question's own options remain its one Choice, several picks per question come with the Form's pick fields, and an inline image with Image annotation. *Alternative:* a `choice` item type now.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
4. **A Value computed by a formula.** *Default:* a Value shows a value the agent gives; one computed from other atoms waits for the first change that needs it (the Form's or the Table's totals), which joins it to the compute graph (AD-13). *Alternative:* `formula` on a Value now.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
5. **Unreadable field text.** *Default:* kept in the draft record as the item's entry; it shows its field error, survives a reload and disables "Answer" until corrected or cleared (a board-protocol minor, AD-20 amended). *Why:* sending the last good value or none would send what the field does not show (NFR-10). *Alternative:* text held only by the component, lost on reload.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
6. **An unset Toggle.** *Default:* a Switch drawn off with "Not set" beside it; a press sets it on, the next off, each read "On" or "Off"; "Clear" returns it to unset. *Why:* EXPERIENCE: an untouched toggle returns no answer, and nothing renders as set before the user acts. *Alternative:* a segmented "On | Off" with neither pressed.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
7. **Markdown option previews.** *Default:* opt-in through `previewFormat: "markdown"`; a preview without it stays plain text, as today. *Why:* existing previews keep their meaning (a minor). *Alternative:* every preview read as Markdown, which changes a field's meaning (a major).
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
8. **Markdown links.** *Default:* only `http:` and `https:` links are links; a click sends the board page an open-link message and the page opens a new tab with `noopener` and `noreferrer`; images show as links to their source; any other scheme shows as text. In a Snapshot, which has no board page, a link opens natively in a new tab with the same `rel`. *Alternative:* links shown as text only.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
9. **Field checks on atoms.** *Default:* none beyond each type's bounds (`maxLength`, `min`, `max`, `step`, `integer`, date range, currency); `required` and `pattern` stay the Form's field checks; a question of atoms can be answered with some atoms unset. *Alternative:* `required` per atom now.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
10. **The MoneyField's currency.** *Default:* the agent fixes `currency`, or lists 2 to 10 `currencies` the user picks from with a segmented control; amounts within 15 integer digits, with at most the currency's minor units; optional `min` and `max` as decimal strings. *Alternative:* a fixed currency only.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
11. **The parsed-value echo.** *Default:* kept beside NumberField, MoneyField and DateField as EXPERIENCE (binding) says ("= 1234,5"). The handoff's note said "without echo"; EXPERIENCE wins (design.md, Open Questions). *Alternative:* no echo, which needs an EXPERIENCE change.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
12. **The PO's check by hand.** *Default:* not blocking: task 6.5 checks the calendar and a Markdown link by hand in Chrome and Safari.
    - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
