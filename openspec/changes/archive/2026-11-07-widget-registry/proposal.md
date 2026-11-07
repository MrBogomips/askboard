# Proposal

## Why

FR-11 lists 18 widgets and FR-13 the atoms; three ship (Choice, Tree, Gantt). Every unit that handles a widget item names `"tree"` and `"gantt"` by hand, in about twenty places across `contract`, `core`, `compute` and `view`, and the answer has nowhere to put what a widget gives that is not an edit of the agent's content: an Approval's decision, a Scale's value, a Ranking's order, annotations, chart highlights, an atom's value (FR-18). The fifteen widget changes that follow would each edit the same dispatch sites and collide, as earlier changes did on versions and seams. This change makes adding a widget a registration, and opens the `results` seam once, before they start.

## What Changes

- **One widget-type registry in `contract`** (AD-7, AD-13): per type its name, its props schema and checks, its element shape and changes schema when the user edits the agent's content, its result schema and checks when it gives a result, its answer's derived declarations, its agent-facing wording and an example item. Tree and Gantt are its two entries. Every hard-coded Tree-or-Gantt check in `contract`, `core` and `compute` reads it instead, and the input format's question items, the board document's items and `fetch`'s items are composed from it. A later widget adds a folder and one registry line. Behaviour-neutral: Tree, Gantt and Choice asks, answers, wordings and schemas stay as they are.
- **The `results` seam** (AD-20, FR-18, FR-20): a widget's result travels apart from its edited props, in the draft record, the board protocol's `answer` act, the board state, the output format's answer event (whose `results` the output format already names), `fetch` and the Snapshot data. `ask-core` checks each result against its type's declaration and keeps it with the full edited values. An answer too large for one result drops its results with its `changes` and derived values, and `fetch` returns them. The output format gains AD-7's annotation shape, which later annotating widgets reference.
- **`compute`**: a table of graph sources by widget type beside the Tree and Gantt mapping, which computing widgets append to.
- **View and build**: a widget's chunk registers, with its component, the facts the shell needs (its element shape, its name in the agent-change notice), so the shell holds no per-type table and does not grow with the catalogue; components get `result` and `onResultChange`; the build fails when a registered type has no component chunk or a widget chunk has no registered type; `packages/widgets/src/graph` (the board graph) becomes `board-graph`, freeing the Graph widget's name.
- **Versions** (askboard-contract-versioning): the output format, the tool envelopes, the board protocol and the Snapshot data each take the next minor after `main`'s, bound at the rebase; the input format and the board document keep `main`'s.
- **Documents**: `spine-update-draft.md` (AD-7: the registry and the annotation's fields; AD-20: results in the answer, the draft and the too-large rule) and `prd-update-draft.md` (FR-20), applied in task 0.1.
- **Not in this change**: any new widget, atom or layout; nested items; a scalar edit in the generic diff (open question 7); results in an answer the agent records with `update`; skills and references generated from the registry (the `askboard-skills` change).

## Capabilities

### New Capabilities

None: the behaviours belong to capabilities E1 created.

### Modified Capabilities

- `contract`: the widget-type registry and the schemas composed from it; result declarations and the annotation shape; results in the act, draft record, board state, answer event, `fetch` and Snapshot data; the four sets' minors.
- `core`: dispatch on the registry; results checked, logged, kept, too large, fetched and gathered for Snapshots.
- `compute`: graph sources by widget type.
- `board-host`: results in acts and in the draft mirror.
- `view-and-widgets`: component facts through the port, the results channel, the registry and chunk check, the board graph's folder.

## Impact

- Code: `packages/contract` (new `src/widgets/registry.ts` and per-widget entry modules; `ask-items.ts`, `widgets/*.ts`, four set modules and their schemas), `packages/core` (dispatch sites, `lifecycle/` answer path, `snapshot/gather.ts`), `packages/compute` (`board.ts`, new `board-sources.ts`), `packages/view` (port, shell, board page, view protocol), `packages/widgets` (folder rename, chunk registrations), `tools/build` (chunk check, board graph path). `packages/server` changes only in tests.
- No new dependency; no licence change (NFR-6). Chunk sizes: the shell gains only the results channel.
- Merge points with `widget-editing-plus` (in flight): design.md, Merge points.
- IDs served: FR-11, FR-12, FR-13, FR-18, FR-20, FR-22, FR-25, FR-26; NFR-5, NFR-10; R4. ADs: AD-1, AD-6, AD-7, AD-9, AD-10, AD-13, AD-15, AD-20.

## Open questions for the PO

1. **A result is a second channel beside the edited props.** A component puts its result through `onResultChange` into the draft record's `results`, apart from its edited props in `values`; an answer carries both, and a widget may give either or both (Diagram: corrected source and annotations). Tree and Gantt never write a result. *Why:* no widget's existing value changes shape, and the shell routes results without knowing any type. *Alternative:* one draft value per item, split by the type's declaration into props and result.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
2. **Results count toward the too-large rule.** An answer event over the largest event carries no `changes`, `results` or derived values, with `tooLarge: true`; `ask-core` keeps the results and `fetch` returns them; FR-20 says so. *Why:* Diff review or Document review comments are unbounded in practice. *Alternative:* results always in the event, each widget bounding its result.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
3. **AD-7's annotation shape is fixed now.** `{id, target: {selector}, body: {text}}`, the item being the key of `results`, with the selectors AD-7's positions name: `element` (node or edge ID), `label` (quoted label and occurrence), `region` (`xywh=percent:`), `line` (side, path, line), `quote` and `position`. *Why:* Diagram, Graph, Image annotation, Diff review and Document review may be built in parallel; AD-7 asks for the fields before the first annotating widget. *Alternative:* leave it to `diagram-annotations`.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
4. **The board graph's folder becomes `board-graph`.** `packages/widgets/src/graph` holds the compute board graph (library chunk `board-graph`); the Graph widget's chunk needs the folder `graph`. *Alternative:* keep the folder and give the Graph widget's chunk another folder name mapped to the component `graph`.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
5. **The view learns a type's facts from its chunk, not from the registry.** A widget chunk registers its element shape and its notice name with its component through the `CatalogRenderer` port. *Why:* the full registry carries every widget's schemas and checks, which would grow the shell chunk with each widget on every board (AD-9). *Alternative:* the shell imports the registry.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
6. **A test-only widget type proves the seam.** Contract fixtures hold a `probe` type that declares edits, a result and a derived field; contract and core tests pass a registry holding it; the first widget that declares a result carries the end-to-end and browser scenarios of a result. *Why:* no widget ships here, and the shipped registry stays the only one at run time. *Alternative:* make request validation and `AskCore` take a registry, for end-to-end tests now.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
7. **Scalar edits wait for their first widget.** A LaTeX expression or a Diagram's corrected source is an edit of one field, which AD-20's generic diff (elements by ID) does not express; the registry's element shape takes any shape the diff defines, and `diagram-render` adds a whole-field shape and amends AD-20. *Alternative:* add the shape here, unused.
   - Answer (2026-11-06): proposed default accepted under the PO's unattended handoff ("implement all remaining features"); the PO may revisit.
