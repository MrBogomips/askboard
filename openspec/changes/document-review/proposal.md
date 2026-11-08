# Proposal

## Why

FR-11's Document review row ("Comments on passages and suggests edits") is the catalogue's first text widget after the atoms' Markdown Text. An agent that drafts a plan, release notes or a spec section today asks for feedback in free text, and the user quotes the passages by hand; a Document review lets the user select a passage of the rendered document, comment on it or suggest its replacement, and returns each as a typed annotation (AD-7) the agent can apply.

Its detached check is the first field check whose outcome follows the agent's content, so its main flow reaches a mismatch on `main` since `form-widget`: after "Keep mine" the card's blocks read the revision it shows, and the presses the current one, so "Answer" can send nothing without a word. This change fixes it for every field check.

Issue: #92

## What Changes

- **The Document review's registry entry** (FR-11, FR-18, AD-7): a `document-review` item whose props are `markdown`, the document (1 to 10,000 characters, with no control or bidirectional character but line feeds and tabs), and an optional `title`. Its result is `{annotations}`: 1 to 100 annotations, each a comment or a suggested edit, anchored by a `quote` selector (`exact`, `prefix`, `suffix`) to the text as the board shows it. An untouched Document review gives no result.
- **Suggested edits in the annotation shape** (AD-7, amended in place): the annotation's body becomes `text`, `replacement` or both. A suggested edit's `replacement` replaces the quoted text, and an empty one deletes it. The Document review is the first widget to give annotations, so the shape is settled now, as AD-7 asks.
- **Anchors that fail closed** (NFR-10, AD-10): the board anchors a passage only where the user selected it, and only when its quote, with up to 200 characters of context, occurs once in the document's text. An annotation held on a revision whose text no longer holds its quote once (put back from an earlier answer after the agent changed the document) is listed as detached and blocks "Answer" until the user deletes it (EXPERIENCE, Annotation pin: never silently dropped or guessed); after "Keep mine" the card shows the revision the annotations were made on, where they stay placed. `ask-core` checks every annotation's shape, IDs and bounds; only the board, which renders the document, checks a quote against its text.
- **The component** (AD-8, AD-9): the document through the atoms' Markdown renderer; commented passages marked through classes with numbered pins; suggested edits shown struck through with the replacement after them; comment cards that write into the draft as the user types, which with the numbered pin and the annotation list live in `widgets/src/shared/annotations/` for the later annotating widgets; a toolbar ("Comment", "Suggest edit") and a counter; a keyboard path through the document's blocks and pins; links opened through the board page, never by a pin or a suggested replacement beside them; read-only once the ask is closed or the board locked, and in Snapshots, and, as `keep-mine-shown-revision` makes the edit widgets, while the card shows a revision other than the one its answer names, through a component fact the Image annotation borrows (question 13).
- **The answer gates read the revision the card shows** (Issue #92; NFR-10, AD-10, AD-20; design decision 15): "Answer", "Accept recommended", "Select recommended", Submit and a hidden tab's mark read each field at the revision the card shows and the answer names, as the card's state and hint already do, so a press never refuses what the card shows as ready.
- **The Markdown renderer as a library chunk** (AD-1 and AD-9, amended in place; atoms design decision 4): markdown-it, DOMPurify and AskBoard's renderer module move from the `text` chunk to a `markdown` library chunk, shared as `@askboard/view/markdown`, which the Text and the Document review both import, so no chunk carries a second copy.
- **The skill**: the Document review's teaching text joins the generated skill as `skill-index` (#61) lays it out: its use in `references/items.md`, within `SKILL_USE_MAX`, and one link in `SKILL.md`, whose 9,000-character budget stays.
- **Versions** (askboard-contract-versioning): the input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s, bound at the rebase.
- No new dependency: markdown-it 15.0.3 and DOMPurify 3.4.17 are already pinned in `view`, and so is `react-dom` 19.3.1, which `widgets` now declares at the same pin for the pins' portals. The solution design's `@tiptap/core` row is a candidate the final UX did not choose ("Own, on the Markdown renderer").
- **Not in this change**: a document by pointer to a project file; plain-text documents; re-attaching a detached annotation; overlapping annotations; suggested edits counted as changes by an Approval; annotations recorded by the agent with `update`; a Document review in a molecule.

## Capabilities

### New Capabilities

None: the behaviours belong to capabilities E1 and `askboard-skills` created.

### Modified Capabilities

- `contract`: the `document-review` type (props, result, checks, wording, example, teaching text), the rule that places a quote, the annotation body's `replacement`, the four sets' next minors.
- `core`: a Document review's result checked by `ask-core`, logged and fetched.
- `view-and-widgets`: the Document review component (selection, cards, marks, detached annotations, keyboard, links, read-only and Snapshot views, strings), the shared Markdown renderer, and the answer gates reading the revision the card shows (a new requirement beside form-widget's "A field check blocks Answer", which stays as it is).

## Impact

- Code: `packages/contract` (`src/widgets/document-review/`, `schemas/output/annotation.json`, `registry.ts`, the four set modules, fixtures), `packages/core` (tests only), `packages/view` (`src/markdown/` moved from `catalog/text/`, `package.json` export, `board-page/markdown-links.ts`, `catalog/port.ts`, the read-only fact and the answer gates in `src/shell/`, strings), `packages/widgets` (`src/document-review/`, `src/shared/annotations/`), `tools/build/shared-modules.ts`, `tools/check-imports.ts`, `skills/askboard/` (regenerated), `packages/view/chunk-sizes.json`, `CHANGELOG.md`, `CLAUDE.md`.
- Documents: the spine (AD-1, AD-7, AD-9 amended in place; Structural Seed) through `spine-update-draft.md`; EXPERIENCE and DESIGN through `ux-update-draft.md`. No PRD change.
- Merge points: `layouts` (merged, #60), `skill-index` (merged, #61), `form-widget` (merged, #64, this branch's base), `keep-mine-shown-revision` (merged, #66, whose read-only rule this change extends), `table-widget` (#68), `choice-documented-activation` (#87) and `oversized-acts` (#88) (merged), `diagram-render`, `image-annotation` and `keyboard-shortcuts-help` (proposed): design.md, Merge points.
- IDs served: FR-7, FR-11, FR-13, FR-18, FR-20, FR-22, FR-26, FR-29, FR-34; NFR-1, NFR-5, NFR-10, NFR-12; SM-5. ADs: AD-1, AD-6, AD-7, AD-8, AD-9, AD-10, AD-15, AD-19, AD-20. UX: EXPERIENCE Component Patterns (Widgets: Document review; Annotation pin; Comment card; Widget frame), Accessibility Floor (Keyboard core, Tab order, Focus), Voice and Tone, Component per widget (Document review); DESIGN Components (Document review, Comment card, Annotation pin), Colors (user-change hue).

## Open questions for the PO

Each carries a proposed default. Task 0.1 records each answer under its question before anything relies on it; under the PO's unattended handoff the answer reads "proposed default accepted under the PO's unattended handoff".

1. **The document by value.** *Default:* the agent sends the Markdown in the props, at most 10,000 characters (the renderer's bound); a longer document goes as one item per section. *Alternative:* a pointer to a project file, resolved at send time like an excerpt (AD-12), cheaper in output tokens but a second resolution path in `ask-core`.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
2. **Markdown only.** *Default:* the document is Markdown; plain text that holds no Markdown marks reads the same. *Alternative:* a `format` of `plain` or `markdown`, as the Text has.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
3. **What a quote quotes.** *Default:* the text as the board shows it (Markdown marks removed), with `prefix` and `suffix`; the agent finds the passage in its source, and asks when it cannot. *Alternative:* quotes of the Markdown source, which markdown-it's documented interface cannot map from a selection without guessing.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
4. **Who checks a quote against the text.** *Default:* the board, which renders the document; `ask-core` checks shapes, IDs and bounds, as with the TextField's pattern in `form-widget`. *Alternative:* markdown-it in `contract`, so that `ask-core` derives the text too (AD-8 amended, a larger session process).
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
5. **Suggested edits as annotations.** *Default:* the shared annotation's body gains `replacement` (AD-7 amended in place). *Alternative:* a separate list of edits beside the annotations.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
6. **Detached annotations.** *Default:* listed under the document with their quote, text and "Delete"; they block "Answer" until deleted. *Alternative:* "Attach to selection" on each, or dropping them with a notice.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
7. **Overlaps.** *Default:* none: one annotation per passage, and the board refuses a selection that overlaps one. *Alternative:* overlapping comments, marked in layers.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
8. **Suggested edits and an Approval.** *Default:* they are a result, not changes, so a plain "Approve" stays available beside them (EXPERIENCE, Approval: another widget's result is no change). *Alternative:* count them as changes, so the Approval asks for "Approve with changes".
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
9. **The keyboard path.** *Default:* the arrow keys move between the document's blocks and their pins; "Comment" and "Suggest edit" act on the selected text, else on the current block. *Alternative:* a "Find passage" field that selects the text typed in it.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
10. **Bounds.** *Default:* 100 annotations per item; a quote of at most 2,000 characters (the annotation's); a comment of at most 2,000; a replacement of at most 4,000; context of 32 characters, widened to 200 only to make a quote occur once. *Alternative:* other figures.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
11. **The skill's budget.** Withdrawn on 2026-11-08: `skill-index` (#61) moved each type's use into `references/items.md`, so the Document review costs `SKILL.md` one link and the budget stays 9,000.
12. **Where the renderer lives.** *Default:* a `markdown` library chunk shared as `@askboard/view/markdown`, the Document review in `packages/widgets` like every FR-11 widget, AD-1 and AD-9 amended in place. *Alternative:* the Document review as a catalog component in `view`, beside the atoms, with no import rule changed.
   Answer (2026-11-08): proposed default accepted under the PO's unattended handoff; the PO may revisit.
13. **Comments after a reload under kept work.** *Default:* a Document review is read-only, as `keep-mine-shown-revision` makes the edit widgets, while the card shows a revision other than the one its answer names (after a reload or a takeover), its held annotations sent as before, a detached one not blocking "Answer" there; a component fact `revisionBound` widens the predicate (design decision 15). *Alternative:* a known limit, comments made on the new text and sent naming the old revision.
   Answer (2026-11-08): coordinator decision under the PO's unattended handoff, following the PO's answer to `image-annotation`'s question 13 ("estendiamo la regola di sola lettura"); the field block's read-only skip is a proposed default the PO may revisit.
