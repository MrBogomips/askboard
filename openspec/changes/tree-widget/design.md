# Design

## Context

See proposal.md for why the Tree comes now and what it leaves out. What the code starts from, on this branch (E1 Track B's head, 49c5853; E1 is not merged):

- **`contract`:** E1's Track 0 sets (input format with the plain question only, board document holding exactly one question, board protocol, view manifest), each folder listed in `sets.ts`, compiled once by `createAjv` and checked by `schemaSetProblems`; constants with `ID_PATTERN` and `VIEW_ID_PREFIX` (`u-`); the fixtures. The output format and its answer event with AD-20's generic diff are Track A's task 3.3 and do not exist here. The package exports three entry modules: `.`, `./validate` and `./fixtures`.
- **`view`:** the board page validates every host message with standalone validators of E1's schemas; `assemble` and `selectChunks` pick the chunks a board needs through `componentsOf`; the shell renders one card per question through `RenderItem`, the `CatalogRenderer` port (`catalog/port.ts`, shared to component chunks as `@askboard/view/catalog`), the draft record (option labels by item ID) and the ready tracker; view messages are typed in `view-protocol.ts`, and the board page's `hostView` answers them over `AppBridge`.
- **`tools/build/`:** component chunks are the folders of `packages/view/src/catalog/` holding an `index.tsx`; the shared-modules plugin maps React, `radix-ui` (`Checkbox`, `RadioGroup`), ext-apps and the port to the chunks that provide them; Tailwind per chunk over the chunk's own sources under `packages/`; `chunk-sizes.json` with a 10% margin.
- **`widgets`:** an empty package that declares nothing, with no JSX in its tsconfig; the import check already allows it `contract`, `compute` and `view/catalog` (AD-1).
- **Browser harness:** Playwright in three engines under Bun, a CSP collector over every frame and the console, E1's test server replaying Track 0's transcripts, and `assembledSrcdoc` for a view the harness builds itself.
- **Compute** (read only, `feature-compute-engine`): `buildGraph` reads items with `children` trees of `{id, fields, children}` and a `wbs-pert` kind whose `nodes` have the approved example's shape; references are flat, `item.child.field`, with child IDs unique in the item; field names match `^[A-Za-z][A-Za-z0-9]{0,63}$` and are not upper-case cells; the `FormulaEngine` port sees only engine names, which its adapter maps from addresses.

ADs this design relies on: AD-1, AD-7, AD-8, AD-9, AD-10, AD-13, AD-20, AD-21. UX sections it implements: EXPERIENCE Component Patterns (Widgets: Tree; Changes, values and board states: Change highlight, Field error; Primitives: Input atoms, for the number field), State Patterns (By surface: Widget), Interaction Primitives (Explicit acts, Drag), Accessibility Floor (Keyboard core: Tree; Tab order; Focus), Composition and Components (Board page or view; Component per widget: Tree, in part). DESIGN.md: Components (Widgets: Tree; Base controls: Widget frame, Button, Focus ring; Changes, values and board states: Change highlight, Field error), Layout & Spacing (Wide widgets).

## Goals / Non-Goals

**Goals:**

- A Tree that meets FR-11's row and EXPERIENCE's Tree rules on the board, edited from the draft record alone and sent only by "Answer".
- The seams the follow-ups extend are real: the Tree's schemas in the input and output sets, the generic element diff `ask-core` will call, widget chunks in the view's manifest, widget items in a question, and an answer message that carries a widget's full value.
- Every behaviour the specs name is tested: pure logic under `bun test` at 80% per file, the rest in three browser engines.

**Non-Goals:**

- Anything proposal.md lists under "Not in this change".
- Touching `packages/core`, `server` or `compute`, E1's existing schema files, constants and fixtures, or `docs/`.
- Screen-reader announcements and reduced motion (EXPERIENCE open item 22).

## Decisions

### 1. The workspace change comes first

As agreed with the integration session, task 1.1 alone touches manifests: `packages/widgets/package.json` gains `@askboard/contract`, `@askboard/view` and `@askboard/compute` as `workspace:*`, `react` 19.3.1, `radix-ui` 1.8.1 and, for development, `@types/react` 19.3.0; its tsconfig gains `jsx: react-jsx`. `bun install` changes `bun.lock` only in that importer entry, which the commit message says. The isolated linker resolves only declared dependencies, so `widgets` declares what it imports, and `@askboard/view` for the port's export. `radix-ui` is declared for the components that follow; the Tree imports none of it (decision 7). If the lockfile conflicts after E1 merges, `bun install` regenerates it and the diff stays additive.

### 2. The Tree's contract: new files, registered beside E1's sets

`packages/contract/src/widgets/tree/` holds:

- `tree-props.json` (`urn:askboard:input:tree-props`): `columns` (at most 8 of `{field, label, type}`, `type` `text` or `number`) and `nodes`, a recursive `$defs/node`: `id` (the input set's ID schema), `label` (1 to 200 characters), `children`, and field keys by `patternProperties` `^(?!(?:id|label|children)$)[a-z][A-Za-z0-9]{0,63}$`, each a string of at most 1,000 characters or a number (an `anyOf` inside the property, since Ajv's strict mode refuses union types); `additionalProperties: false` everywhere.
- `tree-changes.json` (`urn:askboard:output:tree-changes`): an array whose items are one of `add`, `remove`, `move`, `set`, each an object with its `op` constant. The combinator sits in `items`, never at a root.
- `index.ts`: the types (`TreeColumn`, `TreeNode`, `TreeProps`, `TreeItem` `{type: "tree", id, props}`, `TreeChange`), the limits (`TREE_MAX_NODES` 500, `TREE_MAX_DEPTH` 8, `TREE_MAX_COLUMNS` 8, `TREE_LABEL_MAX_CHARS` 200, `TREE_TEXT_MAX_CHARS` 1,000), `TREE_FIELD_PATTERN`, `TREE_SHAPE` (decision 3) and the two set parts.
- `checks.ts`, plain ECMAScript: `treePropsProblems(props, origin)` for what a schema cannot say (node IDs unique across levels; the `u-` prefix refused when `origin` is `agent`, accepted when `edited`; each field key declared by a column; each value of its column's type; column fields unique; the node count and depth limits) and `treeChangesProblems(itemId, changes, props)` (each target's item is the Tree's, each `set` field is `label` or a declared column with a value of its type, `label` never `null`). Problems name the node or operation and the field, as E1's do.
- `diff.ts` (decision 3) and `validate.ts`: `validateTreeProps(value, origin)` and `validateTreeChanges(itemId, value, props)`, the schema through `validateAgainst` and then the checks, returning E1's `Checked`.

Registration, each an append and no other change to an E1 file: `sets.ts` adds the two parts to `SCHEMA_SETS` and their IDs to `SCHEMA_IDS`, so `createAjv` compiles them and `schemaSetProblems` checks them like any set; one export block each in `index.ts` (types, limits, checks, diff), `validate.ts` (the two validators) and `fixtures/index.ts` (decision 4). The parts are `{name: "input", owner: "contract", version: INPUT_FORMAT_VERSION}` and `{name: "output", owner: "contract", version: "1.0"}`, the output part on the examples' version until Track A's output format exists (proposal, open question 20). Nothing in E1's input format references `tree-props`, so no ask can carry a Tree, and the board page's validators, generated from E1's board document, refuse any board document holding one.

*Alternatives:* a schema set of its own for the Tree (AD-7's table puts widget props in the input format and answers in the output format, so it would need a spine change); the schemas inside E1's set folders (an edit to E1's set modules, which the brief forbids); the Tree's fields under a nested `fields` object, as compute's graph source writes them (the approved examples write them flat on the node, and lean JSON keeps them there).

### 3. One generic element diff, in `contract`, for `ask-core` to call

AD-20 has the view send the item's full edited value and `ask-core` alone compute `changes`; SOLUTION-DESIGN §4.8 adds that widget-specific diffs would put widget semantics in the core. So the diff is generic over ID-keyed element trees, and each widget declares only its shape: the Tree's `TREE_SHAPE` is `{elements: "nodes", children: "children"}`, every other key of an element being a field. `elementChanges(itemId, sent, edited, shape)` and its inverse `applyElementChanges(itemId, sent, changes, shape)` live in `contract`'s `diff.ts`, plain ECMAScript, inputs untouched and outputs frozen:

1. Index both trees: each element's parent (or `null`), its sibling list and its fields.
2. Walk the edited tree in pre-order. In each sibling list, the elements that keep their parent form a longest subsequence in their sent order; they stay. Every other element gets an `add` (new) or a `move` (kept, with another parent or out of that subsequence), with `parent` and `after` from the edited tree, both `null` when there is none. Then its `set`s: the name first, then the fields in column order, `null` for a field the user emptied.
3. After the walk, one `remove` per sent element missing from the edited tree whose parent stays, in sent document order.

Applied in order, each `after` and `parent` names an element already placed, since the walk is in document order, and a removed element's subtree holds only removed elements by then, since every kept descendant moved out. A property test over seeded random edit sequences checks `apply(sent, diff(sent, edited)) = edited`; table tests check the minimal cases (one move for a node moved to the front, none for its siblings; one `remove` for a branch). `ask-core` calls it when the follow-up wires Tree answers; Block 2 of `spine-update-draft.md` records the placement (proposal, open question 4).

*Alternatives:* the diff in `packages/core` (outside this change; the follow-up would write it with no fixture to check against); a per-widget diff in `contract` (widget semantics where AD-20 wants one generic diff); the view emitting operations (AD-20 forbids it, and a reload would lose their order).

### 4. Checked against the approved UJ-2 examples, and the fixtures built from them

`asks/uj2-wbs-gantt.json` and `answers/uj2-wbs-gantt.json` are copied unchanged into `packages/contract/test/fixtures/`, the path and bytes E1's task 3.1 uses, so the two copies merge cleanly. The Tree part validates as follows:

- **The same:** node IDs, names, the three numbers per leaf, nesting under `children`; every `wbs.` operation of the answer, the `add` of `u-1` with `parent: "build"`, `after: "portal"` and a `value` of name and fields, and the `set`s on names and numbers.
- **What differs, and why:** the tree sits in a `wbs-pert` molecule's `data.nodes`, which declares its own fields, while a plain Tree is `{type: "tree", props: {columns, nodes}}`, so the check supplies the three number columns; each node's `excerpt` is the molecule's excerpt pointer (AD-12), resolved at send time and shown as a row detail, not a Tree field, so the check strips it and asserts it is the only key stripped; `schedule.u-1.dependencies` is the Gantt plan's operation, not the Tree's; and the answer lists operations in the user's order while the diff gives its own (decision 3), so the check compares them as sets and checks the diff's order separately. The answer's `derived` waits for compute (proposal, open question 3).

The fixtures (`packages/contract/src/fixtures/tree.ts`, tests only): `treeBoardDocument`, the UJ-2 plan as a board document whose question `plan` (rev 1, its text and header from the example, no options) holds the Tree item `wbs` with the three number columns and the eight nodes; `treeEditedValue`, that Tree after the approved edits; `treeAnswer`, the answer event of the example without the Gantt operation and `derived`, its `changes` in the diff's order. A contract test checks that they agree (spec, Tree fixtures). Their type is the contract's board document with a question that may hold widget items, written in the fixture file; when Track A's answer event exists, the follow-up also validates `treeAnswer` against it.

### 5. The edit model: pure functions in `packages/widgets/src/tree/model/`

Everything the Tree decides is a pure function over `TreeProps`, tested under `bun test` with no DOM:

- `rows.ts`: the visible rows from the nodes and the expanded set (depth, parent, position and set size, whether it has children and is expanded); all expanded by default (proposal, open question 8).
- `edits.ts`: `addAfter`, `addChild`, `rename`, `setField`, `remove` (with the count of nodes it takes), `moveUp`, `moveDown`, `indent`, `outdent`, each returning a new frozen value, or the same value when nothing changes; `can(edit, value, nodeId)` for the toolbar and the keys, which enforces the moving rules (proposal, open question 13) and the limits (open question 16) through the contract's constants.
- `ids.ts`: the next view-made ID, `u-<n>` with `n` one more than the highest in the value.
- `marks.ts`: per node, added, moved, renamed or which fields changed, against the sent value, and the count "Your changes" shows (proposal, open question 14); `sameNodes(a, b)`, so the component puts `undefined` in the draft when the edits come back to the agent's value.
- `number.ts`: the en-US parser (optional sign, digits with comma groups of three, optional decimal part), which refuses an ambiguous or malformed entry with a reason, and the formatter for the echo.
- `keys.ts` and `focus.ts`: the treegrid's focus position (a row, or a cell of it), its moves on the arrow keys, Home and End, expand and collapse on Right and Left, and the action of each key in navigation and in edit mode (proposal, open question 9); the toolbar's roving focus; where focus goes after a delete (next sibling, previous sibling, parent).

The model never computes a value from another (proposal, open question 3) and never builds `changes`: the marks compare nodes for display only.

### 6. The component: a treegrid in the widget frame

`packages/widgets/src/tree/index.tsx` registers `tree` through `@askboard/view/catalog`; the rest of the folder renders the model:

- **Frame** (DESIGN.md, Widget frame): a bordered frame with a toolbar row on `muted`: the tools "Add node", "Add child", "Move up", "Move down", "Indent", "Outdent" and "Delete" as `button-secondary`, each with its key in `aria-keyshortcuts` and its title, then the counter on the right. One Tab stop with arrow keys among the tools (proposal, open question 10). The delete confirmation replaces the tools in that row (open question 11).
- **Grid:** `role="treegrid"`, labelled by the question's text; a header row of `columnheader`s in `text-label` on `muted`; one `row` per visible node with `aria-level`, `aria-posinset`, `aria-setsize` and, on a parent, `aria-expanded`; `gridcell`s for the name and each field. One element holds `tabIndex` 0 (roving focus), and keyboard focus shows the focus ring. Indentation is a class per level, written for the 8 levels, not a `style` attribute (AD-8). The chevron, in `muted-foreground`, points right when closed and down when open; a click on it toggles.
- **Editing:** Enter or F2 swaps the focused cell for a text input; Enter or blur commits through the model; Escape restores. A number field shows the parsed value beside it ("= 1234.5") in `text-code`, and a refused entry a `field-error` under the row, keeping the focus and the draft. A new node opens with its name in edit mode (open question 12).
- **States:** `disabled` (answered, being sent, locked) leaves navigation, expand and collapse and turns off editing keys and tools; the change highlight from `marks.ts` uses DESIGN.md's `change`, `change-subtle` and `change-text` tokens (a changed cell's fill, text and border; an added row's 2px bar; the name of a moved row); `useReadyAfterLayout` reports ready once laid out.
- **Data it did not get through the board page:** the component checks `item.props` with `treePropsProblems(props, "agent")` and throws on a problem, so the error boundary fails the item (AD-10). Only test documents reach it before the follow-up.

*Alternatives:* TanStack Table's tree mode with Pragmatic drag and drop, as EXPERIENCE chooses (neither installed; proposal, open question 6); Radix Toolbar (not in the Stack's list of Radix primitives); a modal Alert Dialog for the confirmation (open question 11).

### 7. View integration: widget items in a question

Small edits to E1's view, each with tests first, leaving Choice's behaviour as E1's browser tests check it (proposal, open question 21):

- **Port** (`catalog/port.ts`): `ItemProps<Item, Value>` carries `item`, `questionId` (whose text labels the item), `value: Value | undefined` (the draft value; `undefined` is untouched), `onValueChange(value | undefined)`, `disabled` and `ready`; `register` takes any component. Choice reads `undefined` as no choice.
- **Draft record** (`shell/draft-store.ts`): one `unknown` value per item ID; setting `undefined` removes it; arrays compare by element and other values by identity, since the Tree's model returns the same value for an edit that changes nothing.
- **View document** (`view-document.ts`, new): the board document as the view renders it, a question whose props may hold `items` of widget items (`TreeItem` for now) and may have no options, as AD-7 (Questions) and F1 fix. E1's `BoardDocument` is assignable to it; only test documents use the wider shape before the follow-up, since the board page validates every board document against E1's schema. `boot-data.ts`, `assemble` and `selectChunks` take it.
- **Components and readiness:** `componentsOf` gives `choice` for a question with options and each widget item's `type`; a type no chunk registers fails `assemble`, and in the shell the renderer's unregistered path. A question's items for the ready tracker are its own ID when it has options, then its widget items' IDs.
- **Question card:** options when there are any, then each widget item through `RenderItem` at the card's full width; `canAnswer` when the question is answerable and has a choice or any widget draft value; the act and `shown` per item.
- **View protocol:** `ViewAnswer` gains `values` (widget item ID to the item's full edited props), and `choice` becomes optional, one of the two being required; `readViewMessage` checks `values` structurally (own-property item IDs, object values). The content is checked by whoever can carry it.
- **Board page** (`board-page/model.ts`): `answerCommandFor` refuses an answer with `values`, or without `choice`, saying the board protocol carries no widget value yet; the card's act then drops and the question is open again (E1's answer-acts rule).

### 8. Build integration: widget chunks beside the catalog's

`tools/build/paths.ts` gains `WIDGETS_SRC` (`packages/widgets/src`); `chunks.ts` finds component chunks in the folders of both roots that hold an `index.tsx`, and fails the build naming both folders when one name appears in both. Everything else applies unchanged: the shared-modules plugin maps the Tree's `react`, `react/jsx-runtime` and `@askboard/view/catalog` imports to the React chunk and the shell, so `tree` needs `react` and `shell`; Tailwind scans its sources, which are under `packages/`; its licence notices are the repository's MIT, since React and the port come from other chunks; no `import.meta`. The contract code it uses (checks and limits) is bundled into it. `chunk-sizes.json` records `tree`, and the shell's growth from decision 7, with `--record-sizes` in the same commit. Block 1 of `spine-update-draft.md` states it in AD-9 (proposal, open question 22).

*Alternative:* a separate build or manifest for `widgets` (two manifests for `board-host` to read, and `assemble` would have to merge them).

### 9. The test-only path: a widget host

The real board page cannot show a Tree: its validators refuse the document (fail closed), and bypassing them would test a path production never takes. So the Tree's browser tests use a **widget host**, test code under `packages/view/test/browser/`:

- `fixtures/widget-host-page.ts`, bundled as a classic script the way the harness bundles its throwing Choice: it reads the srcdoc from a JSON data block, creates the frame with exactly `sandbox="allow-scripts"`, calls the board page's own `hostView` before setting the srcdoc, sends one update with the question open, and passes every view message to a Playwright binding, answering an answer with `{outcome: "sent"}`.
- `harness/widget-host.ts`: a `Bun.serve` on `127.0.0.1`, port 0, serving one page per test under the board page's policy, with the host script's hash in place of the board page's and every chunk's hashes; it assembles the srcdoc from the real `dist/view/` with `assemble`, as `assembledSrcdoc` does, for a given test document and state.
- Each test opens the page in E1's `BoardContext`, so the CSP collector covers the host, the view and the console, then drives the view's frame and reads the recorded messages.

E1's test server and transcripts stay as they are: they are E1's interface with Track A. The follow-up runs the same scenarios through the real board page once the board document admits a Tree.

### 10. Tests

- **Unit** (`bun test`, 80% per file): the Tree's schemas in `schemaSetProblems`; `validateTreeProps` and `validateTreeChanges` on the UJ-2 check and on each refused case of the contract spec; the limits; `elementChanges` and `applyElementChanges` (table and seeded property tests, FR-20's 200-node case); the fixtures agreeing; the edit model, module by module; the view's port, draft record, components, readiness, card state, protocol and board-page refusal; the build's chunk discovery and its duplicate-name failure.
- **Browser** (`packages/view/test/browser/tree.browser.ts`, Chromium, Firefox and WebKit): the Tree question visible with its rows; keyboard navigation, expand and collapse; each move and its disabled edges, with the page not navigating; rename, number entry, the ambiguous number and Escape; add, the empty name and `u-1`; delete with and without the confirmation; the change highlight and counter; edits back to the original disabling "Answer"; the UJ-2 edits by keyboard giving the approved `changes` through one answer message and nothing before it; read-only after "Answer"; markup as text; a 200-node Tree becoming visible; no CSP violation in any of them. E1's browser suite keeps passing unchanged.

## Risks / Trade-offs

- [Alt+Shift with the arrow keys may be taken by an engine or a desktop] → Each binding's test fails if the page navigates or the key does nothing; if one cannot hold, the move keeps its toolbar button, the key changes, and the PO is told.
- [The tree chunk may carry the contract's schema JSON through the barrel import] → The checks module imports no JSON, and the task that first builds the chunk records whether it holds a schema `$id`. If the bundler keeps the JSON anyway, the size is recorded with its cause in the task's note, and a JSON-free `contract` entry, which needs a `package.json` change this change may not make, goes to the integration session.
- [Ajv's strict mode may refuse the look-ahead in the field-key pattern] → The schema test compiles it in strict mode first; the fallback is a plain pattern and the reserved names refused in `treePropsProblems`.
- [The widget host could drift from the board page] → It uses the board page's own `hostView`, `assemble` and policy shape; only the socket and the validators are absent, and the follow-up re-runs the scenarios through the real board page.
- [E1's view files change here, and E1's integration is still open] → Each edit is small, tested first, and listed in the proposal's Impact; E1's browser suite runs in every task that touches the view.
- [No virtualisation] → The 500-node limit, and a browser test that a 200-node Tree becomes visible and moves a node within the step timeout; virtualisation comes with the drag and TanStack change.
- [A diff in `contract` is code where AD-20 names a format] → Block 2 of the spine draft; `ask-core` is its only run-time caller, and the view never imports it outside tests.

## Migration Plan

None: nothing reaches an agent yet. Reverting the change removes the widget, the contract parts and the view's widget path; E1's behaviour is what its own tests check.

## Handed on

- **The input format widening (first follow-up after E1 merges):** the question's `items` admitting `tree` (input format 1.1), the board document's question items (1.1), the board protocol's answer command with `values` and the logged state of a widget answer (1.1), `ask-core` storing the full value and calling `elementChanges`, `collect` returning `changes`, `treeAnswer` against Track A's answer event, the conformance case, and the Tree scenarios through the real board page.
- **WBS with PERT (after compute merges):** mapping `nodes` to compute's `wbs-pert` source, the estimate columns as NumberFields with the "d" affix, roll-ups and `derived` (F7), the opening depth, the excerpt row detail, Gantt tasks for added packages (F20); also FR-12 and FR-14 for a standalone Tree.
- **E3:** the Tree's draft value in the mirrored draft record, revisions and the agent-change notice on an edited Tree.
- **A later widget change:** drag with Pragmatic drag and drop, the sandboxed-frame drag spike item, virtualised rows and the TanStack Table decision (proposal, open question 6).
- **E8 and the atoms' epics:** it-IT number input, money, date and on/off fields.

## Open Questions

None that change the approach: the proposal's open questions record the choices taken while the PO is away.
