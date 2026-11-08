# Design

## Context

See proposal.md for why and what; the PO's input is `drafts/proposta-scorciatoie-tastiera-1.1.0.md` ("the input" below). Base: `origin/main` 47f3c370.

Keys today live in each widget's own code: the Tree's bindings are already a table (`widgets/src/tree/model/keys.ts`, `BINDINGS`), from which it derives `aria-keyshortcuts` and a `title`; every other widget writes its keys in a function of its own. Nothing tells the user which keys exist, apart from the Chart's screen-reader hint. The skill generator (`tools/build/skills/`) writes one skill, `skills/askboard/`, and admits only that name (`budgets.ts`, `nameProblems`); the release copies that one folder (`tools/release/assemble.ts`, `FOLDERS`) and the benchmark flags any other skill in a run's listing (`packages/bench/src/report.ts`, `EXPECTED_SKILL`). On 47f3c370, `check:skills` measures `askboard`'s description at 342 of 600 characters, `SKILL.md` at 6,217 of 9,000 and the always-loaded total at 6,152 of 8,400.

## Review of the existing widgets

The input's inventory (section 3) checked against the code on 47f3c370 and, for the Table, on `worktree-feature-table` 7890feaa (in review). Corrections:

1. **Tree.** Its tooltip is a native `title`, which shows on hover and never on focus, only on the four move tools and "Delete", with raw key names ("Move up (Alt+Shift+ArrowUp)"); "Undo adjust" has `aria-keyshortcuts` and no title. "Add node", "Add child", "Select all", "Select none" and "Adjust by %…" have no key. Its moves act on the focused node only, never on the selection, which serves the bulk adjustment. Its mouse selection is a check box that a click toggles: it has no Shift+click range, which the input's section 4.1 takes as the Tree's.
2. **Ranking, Kanban, Timeline, Chart.** Their handlers read `event.key` alone, so a key held with any modifier acts and has its default prevented: Alt+Shift+↑ moves the Ranking's cursor today, and Alt+← (history back in Firefox, and in Chromium on Linux) moves the Kanban's and the Chart's. The shared toolbars' `toolbarMoveOf(event.key)` does the same; the Tree's and the Gantt's toolbars, and the Table's, check modifiers. The Kanban has no Home or End.
3. **Chart.** Its hint (`chart.hint`, screen readers only) names the arrows and Space, not Home, End or Enter, which the Chart takes: what it describes differs from what it does.
4. **Gantt.** Besides the grid it has the Task column's edge (arrows by 16 px, Shift by 64, Home, End, Enter), the predecessors panel, the plan's zoom (the model's toolbar keys) and the "Critical path" switch (Radix, Space).
5. **Approval** is a Radix Toggle Group, not a radio group. **Scale** is Radix Slider plus AskBoard's stand-in for the unset value (Home and arrows to `min`, End to `max`), or a Toggle Group as a rating.
6. **DateField.** The calendar's keys are react-day-picker's documented ones; no requirement and no test covers them.
7. **Table** (in flight). Its grid takes the arrows, Home and End (the row's ends), Enter or F2 (edit), Space, Enter or F2 (an on/off cell), Delete or Backspace (clear an on/off cell) and Escape, never with a modifier; "Add row" and "Delete row" have no key.
8. **Choice and PickField** use manual activation (the arrows move focus only; Space or Enter selects); `choice-documented-activation` is rewriting both.

Gap table against the input's sections 4 to 6. "Retrofit" names the change that closes each gap (decision 14).

| Widget | Keys of its own today | Gaps | Retrofit |
|---|---|---|---|
| Tree (and the Tree of `wbs-pert`) | treegrid moves, Space, Shift+↑/↓, Alt+Shift+arrows (move, indent, outdent), Delete/Backspace, Enter/F2, Escape, Cmd/Ctrl+Z, toolbar arrows | to top/bottom; keys outside the vocabulary (question 1); tooltips on focus with platform labels; Shift+click range; Keys button and panel; moves of a selection (correction 1: a question for that change) | lists |
| Ranking | cursor ↑/↓/Home/End; toolbar arrows | modifiers (correction 2); moves by key; selection; to top/bottom; tooltips; Keys button and panel | **this change** |
| Kanban | cursor arrows; "Move to…" menu | modifiers (fixed here); Home/End; Alt+Shift+←/→; selection; tooltips; Keys; in-column keys with `kanban-card-order` (question 3) | lists |
| Timeline | cursor ↑/↓/Home/End; "Move earlier", "Move later", "Move to lane…" | modifiers (fixed here); Alt+Shift arrows; selection; "To top"/"To bottom" as lanes (question 4); tooltips; Keys | lists |
| Gantt (and `gantt-plan`) | grid, editor, edge, panel, zoom keys; switch | bar move by key (question 5); tooltips; Keys | grids |
| Chart | arrows, Home/End, Space/Enter | modifiers (fixed here); the hint (correction 3); Keys | grids |
| LaTeX | none (a native text area) | a keyboard requirement; Keys and panel (input section 5) | grids |
| Table (in flight) | grid and editor keys; toolbar arrows | "Add row" and "Delete row" keys (question 1); tooltips; Keys | grids, after `table-widget` merges |
| Approval, Scale, fields, Toggle, PickField, Tabs, layouts, Choice | Radix or native only | none on the board (no panel, input section 5); `askboard-help` covers them; the calendar's requirement and test | grids (calendar; Choice and PickField after `choice-documented-activation`) |

## Goals / Non-Goals

**Goals:** one source for every key a widget takes; a vocabulary checked across widgets; the Ranking at the full standard as the pattern the retrofits copy; `askboard-help` right from the first day for every widget, from tables tested against today's handlers.

**Non-Goals:** behaviour changes to widgets other than the Ranking, beyond the modifier fix (decision 7); board-wide shortcuts; customising keys; a formal WCAG target (NFR-12 stands); keys outside the vocabulary until the PO approves them (question 1).

## Decisions

### 1. The tables live in the registry, in `contract`

Each widget type's registry entry gains an optional `keys` (its key table) beside `skill`, built from a shared vocabulary in `packages/contract/src/keys/`. The registry is what the generator, the registry check and every chunk already read: the generator gets the tables without a new export, the rule "the same keys for the same action in every widget" is one check over the registry (`widgetRegistryProblems`), and each chunk registers its type's table with the shell as `ComponentFacts.keys`, as it registers `fits` and `check`, so the shell still imports no registry. Tables are plain data, no DOM (AD-1).

*Alternatives:* each widget's own `keys.ts` with a pure `@askboard/widgets/keys` export the generator reads (the input's section 12 assumed it; the cross-widget rule would then live only in tests); `view`.

### 2. The vocabulary and the table's shape

An entry is `{action, part, keys, label, shows}`:

- `action`: a vocabulary ID, or the type's own `<type>.<name>`.
- `part`: the part of the widget the keys act in (`list`, `grid`, `editor`, `toolbar`, `edge`, `zoom`, `panel`; a type may name others).
- `keys`: bindings `{key, hold}`. `key` is a UI Events `key` value, a letter in lower case. `hold` is `none`, `shift`, `alt+shift`, `mod` (exactly one of Ctrl and Cmd), `mod+shift`, or `char` (a printed character, Shift as the layout needs it, no Ctrl, Alt or Cmd). No other hold can be written, so Alt alone, Ctrl with Alt, and AltGr combinations stay the browser's.
- `label`: the view string key of the action's name. A view test checks each label is in `STRING_KEYS`.
- `shows`: the visible counterpart, for the two-way test (input section 6): `tool`, `menu`, `pointer` (a click, Shift+click or drag the spec names), `navigation` or `panel` (both exempt). An entry may be `native`: keys a Radix or browser control takes by its documentation, listed and taught but not matched by AskBoard's handler (the Gantt's switch).

The vocabulary (`KEY_VOCABULARY`), from the Tree (input section 4):

| Action | Keys |
|---|---|
| `cursor.up`, `cursor.down`, `cursor.left`, `cursor.right` | ↑, ↓, ←, → |
| `cursor.first`, `cursor.last` | Home, End |
| `select.toggle` | Space |
| `select.extendUp`, `select.extendDown` | Shift+↑, Shift+↓ |
| `move.up`, `move.down`, `move.left`, `move.right` | Alt+Shift with the arrow, along the widget's axis (the Tree's indent and outdent are its `move.right` and `move.left`, with their own labels) |
| `move.top`, `move.bottom` | Alt+Shift+Home or Cmd/Ctrl+Shift+↑; Alt+Shift+End or Cmd/Ctrl+Shift+↓ (vertical only; no widget binds a horizontal top or bottom) |
| `edit.start`, `edit.commit`, `edit.cancel` | Enter or F2; Enter; Escape (in an editor) |
| `delete` | Delete, Backspace |
| `undo` | Cmd/Ctrl+Z |
| `keys.open` | `?` (outside text fields) |
| `toolbar.previous`, `toolbar.next`, `toolbar.first`, `toolbar.last` | ←, →, Home, End among a toolbar's tools |

`keyTableProblems(type, table)` refuses, naming the type and the action or key: a vocabulary action with other keys than the vocabulary's; one binding twice in one part; Tab or Shift+Tab; `mod` with any key but `z`; `mod+shift` with any key but ↑ and ↓; `char` with any character but `?`; F1 and F3 to F12; an empty label; a keyless entry whose `shows` is not `tool` or `menu`. `widgetRegistryProblems` runs it for each entry. Question 1's keys join the vocabulary, and these rules widen to admit them, only after the PO approves them (task 4.6).

*Alternative:* a key table per widget with free keys and a cross-widget test; it cannot refuse an action under two keys until the test is written for that pair.

### 3. One matcher, one press reader

`keyActionOf(table, part, press)` in `contract` (pure, from the Tree's `holdOf` and `keyAction`): the entry whose binding matches the press's key and hold, else undefined; a press while an input method composes matches nothing. `keyPressOf(event)` in the port reads a React or DOM event, with the Tree's rule that `keyCode` 229 counts as composing (`tree/key-event.ts`). `isTextTarget(target)` in the port says whether a key goes to a text field (an `input` that takes text, a `textarea`, `contenteditable`, `role="textbox"`): there `?` and every `char` binding match nothing. A handler maps the entry's action through a typed record from the table's action union to a function, so an action without a handler fails the type check. A key the table binds has its default prevented also where it cannot act (Alt+Shift+↑ on the first row), as the Tree does; any other key never is.

### 4. Labels and `aria-keyshortcuts`

`ariaKeyShortcuts(keys)` (contract, pure) writes WAI-ARIA 1.2's form: `Alt+Shift+ArrowUp`; `mod` and `mod+shift` as both `Control+…` and `Meta+…`, space-separated, as the Tree's undo does; `char` as the character, in the form task 1.2 checks against the WAI-ARIA 1.2 text. `keyLabel(binding, platform, say)` (port) writes what the user reads, by platform (question 6): macOS `⌃⌥⇧⌘` in that order then the key, with ↩ ⌫ ⌦; elsewhere `Ctrl+Alt+Shift+Key` with the key's name; arrows ↑ ↓ ← → everywhere; names from the strings (`key.*`, Italian provisional). `useKeyPlatform()` reads `navigator.userAgent` once (`Macintosh` or `Mac OS X`), and tests pass the platform in. The generator writes the Linux form with the macOS form beside it, in English.

### 5. Contextual help: hint, button, panel

- `KeyHint` (port) wraps a control in a Radix Tooltip, opened on hover and on keyboard focus and closed by Escape, showing the action's name and its keys as key caps, and puts `aria-keyshortcuts` on the control from the table. Radix Tooltip joins the `radix` library chunk (`LIBRARY_CHUNKS.radix`); its provider sits in the shell. The look is DESIGN's tooltip for agent-written labels (`{colors.popover}`, `{elevation.shadow-md}`, `{typography.body}`); a key cap is `{typography.code}` on `{colors.muted}` with a 1px `{colors.border}` and the small radius.
- `KeysButton` (port): a `button-secondary` "Keys", `aria-haspopup="dialog"`, its tooltip "Keys" with `?`; the last stop of the toolbar row and never in "More", or beside the counter where a widget has no toolbar (question 7). It opens the frame's panel through `useKeysPanel()`.
- `KeysPanel` (shell) lives in the item frame (`ItemFrame`, `shell/renderer.tsx`) for a type whose facts hold `keys`. A Radix Popover, non-modal, anchored to the Keys button, `role="dialog"`, named "<Widget> keys" from the type's string name (`ComponentFacts.name`), focus moving into it; it lists each entry's name and key caps by group, the group following the action's family (cursor, selection, move, edit, other). A disabled item (answered, locked, Snapshot) lists only `navigation`, `panel` and `native` entries. Escape or "Close" closes it and returns the focus to the element that held it before it opened. The frame opens it on `?` when the key was not prevented, no input method composes and the target is not a text field; the nearest frame wins, so a Ranking in a Group opens its own panel. Only board strings and the table reach it; no agent text (AD-8).

### 6. Keys outside the vocabulary wait for the PO

Until question 1 is answered, an entry may have no keys when it shows as a tool or a menu. `packages/contract/test/keys-awaiting.test.ts` lists every keyless entry of the shipped tables with its reason and fails on a new one, as `tools/nested-items.test.ts` does for direct reads. In this change the Ranking's "Keep this order" and "Select none" are keyless until task 4.6.

### 7. The modifier fix

The Ranking's list, the Kanban, the Timeline and the Chart act only on a key held with no modifier, and their handlers prevent the default of no other key. `toolbarMoveOf(key)` stays as it is, since `table-widget` borrows it; a new `toolbarPressMove(press)` beside it adds the hold check, and the Ranking's toolbar and `MoveToolbar` switch to it. This is the only behaviour change outside the Ranking (input section 2, anti-goal 2).

### 8. The Ranking, to the standard

- Model, pure, in `widgets/src/ranking/`: `selection.ts` (toggle, extend from the anchor by key, range by Shift+click, filter to the order's IDs after an agent's revision) and `moves.ts` (each move for a selection or a single row, question 2's rule, and whether it moves anything, for the tools' enabled state).
- `RANKING_KEYS` in `contract/src/widgets/ranking/keys.ts`, in the registry entry. Parts `list` and `toolbar`. `list` holds the cursor moves, `select.toggle`, `select.extendUp` and `select.extendDown` (`shows: pointer`), `move.up`, `move.down`, `move.top` and `move.bottom` (`tool`), `ranking.keep` and `ranking.selectNone` (`tool`, keyless until task 4.6) and `keys.open` (`panel`). `toolbar` holds the toolbar moves.
- The component: a leading check box per row, out of the Tab order, as the Tree's (`SelectBox` moves to `widgets/src/shared/select-box.tsx`); Shift+click from the last row clicked (question 8). Tools: "Move up", "Move down", "To top", "To bottom", "Keep this order", "Select none", each in a `KeyHint`, then "More" when crowded (`useCrowded` moves to `widgets/src/shared/`), then "Keys". The row reads "N selected" before the counter. A read-only Ranking shows no check box. The drag is unchanged and moves the dragged row alone.
- The selection is component state: in no draft, result, answer or Snapshot, and lost on reload (AD-9, AD-10).

### 9. Tables of today's keys, tested against the handlers

The Tree, the Gantt, the Kanban, the Timeline and the Chart each get a table of exactly the keys they take today. Each type gets a parity test in `packages/widgets`: for each part, every binding of its table, every vocabulary binding and each of the arrows, Home, End, Enter, Space, Delete, Backspace, Escape and F2 under each hold goes to the widget's own key function (`keyAction`, `toolbarKey`, `gridKeyAction`, `toolbarKeyMove`, `keyWidth`, `kanbanKeyOf`, `timelineKeyOf`, `isChartKey`), and the action it gives, through a map from the widget's action type to the table's IDs, must be the table's, or nothing. No handler moves onto `keyActionOf` here; the retrofits do it, and the parity tests then become the handlers' own tests. These tables feed `askboard-help` now. They reach the board only when a retrofit registers them as `ComponentFacts.keys`.

### 10. `askboard-help`, generated

- The generator writes two folders. `generateSkill` stays for `askboard`, `generateHelpSkill` beside it writes `askboard-help`, and `tools/build/skills.ts` writes and checks both under the same confinement as today (no symlink followed, each path resolved inside its folder, only regular files removed). `budgetReport` takes a skill's name and budgets, and the always-loaded total counts both skills' names and descriptions (question 9).
- `askboard-help` holds its `SKILL.md` and a reference per registered type and per ready molecule. `SKILL.md` gives the rules, the board's concepts and the index. The rules: answer in the user's language, from these files, in the terminal; never call `ask`, `update`, `collect`, `fetch` or `snapshot`, and never open a board. The concepts, hand-written in `tools/build/skills/templates/help/SKILL.md` from EXPERIENCE: Answer and Submit, Postpone, Decline and Explain, follow-up questions, the agent-change notice with "Keep mine" and "Reload", read-only states, Snapshots, the language and live updates, and the fields' standard keys, Choice's manual activation among them. A type's reference holds what it is for (`skill.use`), its new `help.mouse` and `help.answer`, and its keys from its table. A molecule's holds its new `skill.json` `help` sentence and links the references of the types it expands into.
- Frontmatter: `name`, `description` (static, at most 400 characters) and, if task 0.4 confirms that Claude Code honours it for a plugin's MCP tools, `disallowed-tools` naming AskBoard's five tools as the session names them.
- `askboard`: a Keys section in each widget reference that has a table, and one line in `SKILL.md` sending usage questions to `askboard-help` (about 150 characters).
- English action names come from the view's English strings through a new pure package export, `@askboard/view/strings`, so the skills name each action as the board's tooltips do.
- Help text: `help: {mouse, answer}` in each registry entry, 1 to 300 characters each, checked like `skill`. Every shipped type carries it, and the generator fails, naming the type, on a type without it.

*Alternative:* a hand-written `askboard-help`. It would drift from the tables, which the input's section 6 forbids.

This supersedes `askboard-skills` design decision 1 ("One skill"), which the archive keeps as written; the skills and packaging specs change here.

### 11. Release, packaging and the benchmark

`tools/release/assemble.ts` copies `skills/askboard-help` beside `skills/askboard`. In `packages/bench/src/report.ts`, `EXPECTED_SKILL` becomes the set of AskBoard's two skills. `command.ts` is unchanged: the AskBoard arm allows only `Skill(askboard:askboard)` (question 10). If task 0.4 finds the init event's names unqualified, both follow what it finds, and the spec's scenario is updated through `/opsx:update`.

### 12. Versions

None (askboard-contract-versioning). The key tables and help text are TypeScript data in the registry, not schemas. The selection and the panel are view state, in no draft record, board-protocol message or Snapshot data. The view manifest gains no chunk: Tooltip joins `radix` and the panel joins the shell. Every set stays at main's value; the rebase task checks it.

### 13. Chunks

Expected growth: `radix` (Tooltip) a few per cent; `shell` (panel, labels, the frame's listener) a few per cent; `ranking` (selection, check boxes, overflow, hints) probably over 10%; `kanban`, `timeline` and `chart` a few bytes. Each group that grows a chunk past the check runs `bun run build:view --record-sizes`, commits `chunk-sizes.json` and says why in its note (askboard-implementation).

### 14. The split and its order

This change is the foundation and the Ranking. Two retrofits follow, each proposed once this change merges, since they borrow its seams (`KeyHint`, `KeysButton`, `ComponentFacts.keys`, `keyActionOf`, the tables). They can run in parallel: their widget folders are disjoint, and they share only appends to strings and `chunk-sizes.json` and the regeneration of `skills/`.

- `keyboard-retrofit-lists`: the Tree, the Kanban and the Timeline, which take selection, moves and "To top" and "To bottom" (questions 3 and 4). The Kanban's in-column keys arrive with `kanban-card-order`. The Tree's "moves act on the selection" question is that change's.
- `keyboard-retrofit-grids`: the Gantt and its molecules (question 5), the Chart (its hint), the LaTeX (a table of its field's keys, its requirement), the Table once `table-widget` merges (question 1's "Add row" and "Delete row"), the DateField's calendar (requirement and browser test), and the Choice's and PickField's help text once `choice-documented-activation` merges.

Widget changes still in design (`document-review`, `image-annotation`, `graph-widget`, `diff-review`, `diagram-widget`, `spreadsheet-widget`) declare their tables under the new design rule once this change merges, through `/opsx:update` before their widget groups. A widget that merges before this change joins a retrofit.

### 15. The harness step

One line or rule each, naming this change's seams:

- `openspec/config.yaml`, `rules.design`: a change that adds or alters a widget's keys declares its key table (vocabulary actions, own actions approved by the PO, each entry's visible counterpart) and its contextual help (`KeyHint`, `KeysButton`, the panel), or says why the widget has none.
- `openspec/config.yaml`, `rules.tasks`: such a group names first the tests of its table (parity with the handler, both directions with the toolbar), its tooltips and its panel, with a Verify clause.
- `.claude/agents/askboard-architect.md`: a working principle with the same check.
- `.claude/skills/askboard-implementation/SKILL.md`: a "Keyboard" rule under "Rules by area" (handler through `keyActionOf`; `KeyHint` and `KeysButton`; modifiers, input methods and text fields; default prevented only for keys taken; strings in both catalogues; browser checks in Chromium, Firefox and WebKit that nothing navigates or scrolls), and key tests at step 2 of the per-group workflow.
- `.claude/skills/askboard-review-protocol/SKILL.md` and `.claude/agents/askboard-spec-reviewer.md`: check that the table, the handler, the tooltips, the panel, the references and `askboard-help` agree, and that any key outside the vocabulary carries the PO's recorded approval.
- `CLAUDE.md`: a row in the Agent harness change history, and `skills/askboard-help/` in Working documents.

## Merge points

Seams this change borrows, all on `origin/main` 47f3c370 (task 0.2 re-checks them):

- `contract`: `WidgetType` (`widgets/registry.ts:61`), `WIDGET_TYPES` (`:146`) and `widgetRegistryProblems` (`widgets/registry-check.ts:60`); the fixtures' `PROBE_WIDGET` (`fixtures/widget-registry.ts:77`) and `withWidgetTypes` (`fixtures/approval-scale-ranking.ts:18`).
- `view`: `ComponentFacts` (`catalog/port.ts:138`), `register` (`:191`) and `componentFacts` (`:205`); `ItemFrame` and `RenderItem` (`shell/renderer.tsx:101`, `:167`); `STRING_KEYS` (`strings/keys.ts:4`), `EN_US` (`strings/en-US.ts`) and `IT_IT` (`strings/it-IT.ts:8`).
- `widgets`: `toolbarMoveOf`, `toolbarFocus` and `toolbarStop` (`shared/toolbar-focus.ts:16`, `:26`, `:48`); `MoveToolbar` (`shared/move-toolbar.tsx:98`); `RankingToolbar` (`ranking/toolbar.tsx:27`); `currentAfterKey` and `rankingTools` (`ranking/keys.ts:17`, `:41`); `moveBy` (`ranking/model.ts:42`); `kanbanKeyOf` (`kanban/keys.ts:15`); `timelineKeyOf` (`timeline/keys.ts:20`); `isChartKey` (`chart/model.ts:104`); `keyAction` and `toolbarKey` (`tree/model/keys.ts:100`, end of file); `treeKeyOf` (`tree/key-event.ts:22`); `useCrowded` (`tree/use-crowded.ts:8`); `SelectBox` (`tree/select-box.tsx:10`); `gridKeyAction` and `toolbarKeyMove` (`gantt/model/keys.ts:87`, `:101`); `keyWidth` (`gantt/model/column-width.ts:31`).
- `tools` and the rest: `generateSkill` (`tools/build/skills/generate.ts:114`); `budgetReport`, `BUDGETS` and `SKILL_NAME` (`budgets.ts:72`, `:8`, `:21`); `DISK_TEMPLATES` (`templates.ts:14`); `SKILL_DIR` (`tools/build/skills.ts:28`); `FOLDERS` (`tools/release/assemble.ts:38`); `LIBRARY_CHUNKS` (`tools/build/shared-modules.ts:57`); `MOLECULE_SKILLS` (`packages/molecules/src/index.ts:52`); `EXPECTED_SKILL` and `ASKBOARD_SKILL_RULE` (`packages/bench/src/report.ts:310`, `command.ts:72`).

Changes in flight, read on 2026-11-08:

| Change (branch, head) | State | Overlap | What happens |
|---|---|---|---|
| `table-widget` (`worktree-feature-table`, 7890feaa) | PR open, 63 of 67, rebased on 47f3c370 | Its registry entry needs `help`, its keys a table. It appends `ItemProps` members and strings, and borrows `toolbarMoveOf` (kept by decision 7). | If it merges first, this change's rebase writes the Table's `help` and leaves its table to the grids retrofit. If this change merges first, the Table's rebase adds `help` (the registry check demands it). |
| `document-review` (733b4753) | 18 of 39; widget groups 5 to 7 not started | Appends `ComponentFacts.revisionBound` (this change appends `keys`); adds the `markdown` library chunk to `LIBRARY_CHUNKS`; has its own document and toolbar keys; strings | Append both sides at the rebase. Its widget groups declare a key table and `help` through `/opsx:update` once this change merges, else it joins a retrofit. |
| `image-annotation` (1f8f6811) | 0 of 34; builds after `document-review` | Its planned focus hint states keys outside any table (PageUp and PageDown, Alt+arrows resize) | `/opsx:update` after this merge: a key table and the Keys panel replace the hint. PageUp and PageDown are allowed own keys, and Alt+arrows is not a writable hold (decision 2), so its resize keys change there. |
| `graph-widget` (482223d0) | 0 of 31 | Six toolbar tools; Delete, F2, Enter keys | Adopts the standard through `/opsx:update` after this merge. Its "Add node" takes question 1's "Add after" key if approved. |
| `diff-review` (dfb0e6cb) | 0 of 33 | Row keys, Space or Enter on the row's buttons; its single-letter keys were rejected | Adopts the standard through `/opsx:update`. |
| `diagram-widget` (ed783fe5) and `diagram-render` (9281d923, superseded by diagram-widget) | 0 of 32 | Native keys only | `help` text only. |
| `spreadsheet-widget` (972b9622) | 0 of 42; stacked on `table-widget` | Moves the Table's key guard to `widgets/src/shared/grid/keys.ts` | The grids retrofit puts that guard onto `keyActionOf`; whichever lands second adapts. |
| `choice-documented-activation` (`worktree-fix-choice-activation`, 307ac2b6) | 0 of 10 | Drops `RadioGroup` from `LIBRARY_CHUNKS.radix`, where this change adds `Tooltip`; rewrites the keys of Choice and PickField | Keep both edits at the rebase. The concepts template describes manual activation as `main` has it when this change rebases, and the grids retrofit updates it. |
| `oversized-acts` (`worktree-fix-oversized-acts`) | Not yet proposed (no commit past 433b4d29) | Unknown | Re-check at the rebase (task 7.1). |
| `early-benchmark` (on main, 18 of 22) | Live runs left to the PO | `EXPECTED_SKILL` changes here | The PO's next live run counts `askboard-help`'s description in the context AskBoard adds. |
| `kanban-card-order` (planned by the PO, not proposed) | — | The Kanban's in-column order | Question 3: its keys within a column and its "To top" and "To bottom" arrive with it. |
| `keep-mine-shown-revision` and `form-widget` | Merged (#66, #64), not archived | None: read-only items list only keys that act (decision 5); the PickField takes `help` | — |

## Needs probe

- **Claude Code's skills** (task 0.4): documented that a plugin's `skills/<name>/` folders are discovered without a manifest key and invoked as `/askboard:askboard-help`; that descriptions load in every session and are cut, least-used first, past the listing budget (1% of the context, else 8,000 characters); that `disallowed-tools` exists as a frontmatter key, and that `skillOverrides` does not reach plugin skills. Not documented: the name the listing, the Skill tool and the `-p` init event's `skills` use (`askboard:askboard-help` or bare); whether `disallowed-tools` accepts a plugin's MCP tool names; whether a usage question routes to `askboard-help`. The probe settles the first two; routing is the PO's live check (task 7.4).
- **Browsers and systems** (task 0.5): that every vocabulary binding, Alt+Shift+Home and End and Cmd/Ctrl+Shift+↑ and ↓ included, has its default prevented without navigating or scrolling in Chromium, Firefox and WebKit, and which of them macOS or a Linux desktop takes before the page (Mission Control on ⌃↑; Ctrl+Shift arrows on some desktops). What CI cannot see goes to the PO's live check.

## Risks / Trade-offs

- [Every session loads `askboard-help`'s description, about 100 tokens, and the listing may cut it on a crowded machine] → at most 400 characters, counted in the 8,400 total and in the benchmark (question 10); its name stays listed when its description is cut, and `askboard` points to it.
- [The Tree's moves act on the focused node, against the vocabulary's rule "the selection if any"] → recorded (correction 1); the lists retrofit asks the PO.
- [Tables of today's keys drift while the retrofits change handlers] → the parity tests fail on any drift, and the retrofits replace them with the handlers' own tests.
- [Tooltips on focus are read with `aria-keyshortcuts`, so a screen reader may hear the keys twice] → accepted under NFR-12's best effort; the browser checks look at what is announced once per engine.
- [Cmd/Ctrl+Shift+↑ on macOS may be taken by the system with Ctrl] → `mod` accepts either key and shows ⌘ on macOS; task 0.5 and the PO's live check confirm.
- [In-flight widget changes ship without the standard] → the config rule and the merge-point table; a retrofit takes any that merges first.

## Migration Plan

None: new data and components, and one fix. Rollback is a revert. After a rollback `skills/askboard-help/` goes with the generator, and the release copies one folder again.

## Open Questions

The PO's questions are in proposal.md. Conflicts recorded under the precedence rules:

- EXPERIENCE, Accessibility Floor, says "Key bindings are not recorded". The PO's input records a vocabulary, so task 6.3 amends that line in place to point to the key tables and the keys panel.
- The input's section 12 assumes the tables in the widgets package; decision 1 puts them in `contract`, which the input left to the builder (section 9).
- The input's section 4.1 says the Tree selects a range by Shift+click; it does not (correction 1). The Ranking gets it here, and the Tree in the lists retrofit.
- `askboard-skills` design decision 1 ("One skill") is superseded by decision 10; the archived design stays as written.
