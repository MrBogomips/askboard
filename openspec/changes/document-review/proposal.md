# Proposal

## Why

FR-11's Document review row ("Comments on passages and suggests edits") is the catalogue's first text widget after the atoms' Markdown Text. An agent that drafts a plan, release notes or a spec section today asks for feedback in free text, and the user quotes the passages by hand; a Document review lets the user select a passage of the rendered document, comment on it or suggest its replacement, and returns each as a typed annotation (AD-7) the agent can apply.

## What Changes

- **The Document review's registry entry** (FR-11, FR-18, AD-7): a `document-review` item whose props are `markdown`, the document (1 to 10,000 characters, with no control or bidirectional character but line feeds and tabs), and an optional `title`. Its result is `{annotations}`: 1 to 100 annotations, each a comment or a suggested edit, anchored by a `quote` selector (`exact`, `prefix`, `suffix`) to the text as the board shows it. An untouched Document review gives no result.
- **Suggested edits in the annotation shape** (AD-7, amended in place): the annotation's body becomes `text`, `replacement` or both. A suggested edit's `replacement` replaces the quoted text, and an empty one deletes it. The Document review is the first widget to give annotations, so the shape is settled now, as AD-7 asks.
- **Anchors that fail closed** (NFR-10, AD-10): the board anchors a passage only where the user selected it, and only when its quote, with up to 200 characters of context, occurs once in the document's text. After the agent changes the document, an annotation whose quote no longer occurs once is listed as detached and blocks "Answer" until the user deletes it (EXPERIENCE, Annotation pin: never silently dropped or guessed). `ask-core` checks every annotation's shape, IDs and bounds; only the board, which renders the document, checks a quote against its text.
- **The component** (AD-8, AD-9): the document through the atoms' Markdown renderer; commented passages marked through classes with numbered pins; suggested edits shown struck through with the replacement after them; comment cards that write into the draft as the user types; a toolbar ("Comment", "Suggest edit") and a counter; a keyboard path through the document's blocks and pins; links opened through the board page; read-only after the answer and in Snapshots.
- **The Markdown renderer as a library chunk** (AD-1 and AD-9, amended in place; atoms design decision 4): markdown-it, DOMPurify and AskBoard's renderer module move from the `text` chunk to a `markdown` library chunk, shared as `@askboard/view/markdown`, which the Text and the Document review both import, so no chunk carries a second copy.
- **The skill within its budget**: `SKILL.md`'s item index lists each type as a link named by its type followed by its use, each use at most 70 characters; the 9,000-character budget stays, the Document review's line fits, and room is left for the remaining FR-11 widgets.
- **Versions** (askboard-contract-versioning): the input format, the output format, the tool envelopes and the board document each take the next minor after `main`'s, bound at the rebase.
- No new dependency: markdown-it 15.0.3 and DOMPurify 3.4.17 are already pinned in `view`. The solution design's `@tiptap/core` row is a candidate the final UX did not choose ("Own, on the Markdown renderer").
- **Not in this change**: a document by pointer to a project file; plain-text documents; re-attaching a detached annotation; overlapping annotations; suggested edits counted as changes by an Approval; annotations recorded by the agent with `update`; a Document review in a molecule.

## Capabilities

### New Capabilities

None: the behaviours belong to capabilities E1 and `askboard-skills` created.

### Modified Capabilities

- `contract`: the `document-review` type (props, result, checks, wording, example, teaching text), the rule that places a quote, the annotation body's `replacement`, the four sets' next minors.
- `core`: a Document review's result checked by `ask-core`, logged and fetched.
- `view-and-widgets`: the Document review component (selection, cards, marks, detached annotations, keyboard, links, read-only and Snapshot views, strings) and the shared Markdown renderer.
- `skills`: the item index line and the bound on a use.

## Impact

- Code: `packages/contract` (`src/widgets/document-review/`, `schemas/output/annotation.json`, `registry.ts`, the four set modules, fixtures), `packages/core` (tests only), `packages/view` (`src/markdown/` moved from `catalog/text/`, `package.json` export, `board-page/markdown-links.ts`, strings), `packages/widgets` (`src/document-review/`), `tools/build` (`shared-modules.ts`, `skills/`), `tools/check-imports.ts`, `packages/molecules` (shorter uses), `skills/askboard/` (regenerated), `packages/view/chunk-sizes.json`, `CHANGELOG.md`, `CLAUDE.md`.
- Documents: the spine (AD-1, AD-7, AD-9 amended in place; Structural Seed) through `spine-update-draft.md`; EXPERIENCE and DESIGN through `ux-update-draft.md`. No PRD change.
- Merge points: `layouts` and `form-widget` (in flight; this change is built after both merge), `diagram-render` (proposed), PR #59 (atoms' archive): design.md, Merge points.
- IDs served: FR-7, FR-11, FR-13, FR-18, FR-20, FR-22, FR-26, FR-29, FR-34; NFR-1, NFR-5, NFR-10, NFR-12; SM-5. ADs: AD-1, AD-6, AD-7, AD-8, AD-9, AD-10, AD-15, AD-19, AD-20. UX: EXPERIENCE Component Patterns (Widgets: Document review; Annotation pin; Comment card; Widget frame), Accessibility Floor (Keyboard core, Tab order, Focus), Voice and Tone, Component per widget (Document review); DESIGN Components (Document review, Comment card, Annotation pin), Colors (user-change hue).

## Open questions for the PO

Each carries a proposed default. Task 0.1 records each answer under its question before anything relies on it; under the PO's unattended handoff the answer reads "proposed default accepted under the PO's unattended handoff".

1. **The document by value.** *Default:* the agent sends the Markdown in the props, at most 10,000 characters (the renderer's bound); a longer document goes as one item per section. *Alternative:* a pointer to a project file, resolved at send time like an excerpt (AD-12), cheaper in output tokens but a second resolution path in `ask-core`.
2. **Markdown only.** *Default:* the document is Markdown; plain text that holds no Markdown marks reads the same. *Alternative:* a `format` of `plain` or `markdown`, as the Text has.
3. **What a quote quotes.** *Default:* the text as the board shows it (Markdown marks removed), with `prefix` and `suffix`; the agent finds the passage in its source, and asks when it cannot. *Alternative:* quotes of the Markdown source, which markdown-it's documented interface cannot map from a selection without guessing.
4. **Who checks a quote against the text.** *Default:* the board, which renders the document; `ask-core` checks shapes, IDs and bounds, as with the TextField's pattern in `form-widget`. *Alternative:* markdown-it in `contract`, so that `ask-core` derives the text too (AD-8 amended, a larger session process).
5. **Suggested edits as annotations.** *Default:* the shared annotation's body gains `replacement` (AD-7 amended in place). *Alternative:* a separate list of edits beside the annotations.
6. **Detached annotations.** *Default:* listed under the document with their quote, text and "Delete"; they block "Answer" until deleted. *Alternative:* "Attach to selection" on each, or dropping them with a notice.
7. **Overlaps.** *Default:* none: one annotation per passage, and the board refuses a selection that overlaps one. *Alternative:* overlapping comments, marked in layers.
8. **Suggested edits and an Approval.** *Default:* they are a result, not changes, so a plain "Approve" stays available beside them (EXPERIENCE, Approval: another widget's result is no change). *Alternative:* count them as changes, so the Approval asks for "Approve with changes".
9. **The keyboard path.** *Default:* the arrow keys move between the document's blocks and their pins; "Comment" and "Suggest edit" act on the selected text, else on the current block. *Alternative:* a "Find passage" field that selects the text typed in it.
10. **Bounds.** *Default:* 100 annotations per item; a quote of at most 2,000 characters (the annotation's); a comment of at most 2,000; a replacement of at most 4,000; context of 32 characters, widened to 200 only to make a quote occur once. *Alternative:* other figures.
11. **The skill's budget.** *Default:* index lines shaped `- [`type`](reference): use` with uses of at most 70 characters; the budget stays 9,000 characters. *Alternative:* raise the budget, once the early benchmark gives figures (the documented ceilings are 500 lines and the 5,000 tokens a skill keeps after compaction); or an index file, one more read and a second level of references.
12. **Where the renderer lives.** *Default:* a `markdown` library chunk shared as `@askboard/view/markdown`, the Document review in `packages/widgets` like every FR-11 widget, AD-1 and AD-9 amended in place. *Alternative:* the Document review as a catalog component in `view`, beside the atoms, with no import rule changed.
