# Proposal

Input: the PO's change request `drafts/proposta-scorciatoie-tastiera-1.1.0.md` (Italian; sections 3 to 8 and 12 decided by the PO), which supersedes `drafts/proposta-scorciatoie-tastiera-1.0.0.md`. Corrections to its inventory (section 3) are in design.md, "Review of the existing widgets".

## Why

In the PO's end-to-end test on `main` 433b4d29 (test 2.4, the Ranking) the PO had to ask which keys to press: most widgets have keys, but the board never says which, and the list widgets lack the moves users expect (select a row or a range, move it up, down, to the top or the bottom). NFR-12's keyboard core is met in code and invisible on the board.

## What Changes

This change is the foundation and the pilot. The retrofit of the other widgets follows in two later changes (design.md, decision 14).

- **One key vocabulary** (NFR-12; PO, section 4): the Tree's keys become every widget's, plus "to top / to bottom" (Alt+Shift+Home/End, with Cmd/Ctrl+Shift+↑/↓ beside them on every platform) and `?` for the keys panel. Keys held with other modifiers, keys pressed while an input method composes, and Alt+Shift+arrows in a text field stay the browser's.
- **One key table per widget, as data** (PO, section 6): in the widget's registry entry in `contract`, from which the key handler, the tooltips, `aria-keyshortcuts`, the keys panel, the Keys section of the skill's widget reference and `askboard-help` all derive. A registry check holds every table to the vocabulary: the same keys for the same action in every widget, and no key the browser or the system needs.
- **Tables of today's keys** for the Tree, the Gantt, the Kanban, the Timeline and the Chart, each tested against the widget's handler, so the help states what the board does from the first day. No behaviour changes there, apart from the next item.
- **A fix** (anti-goal "a shortcut steals a browser key"): the Ranking's, Kanban's, Timeline's and Chart's keys and the shared toolbars' arrow keys act today whatever modifiers are held, so Alt+← (history back in Firefox and on Linux) is taken; they take only the keys their tables name.
- **Contextual help on the board** (PO, section 5): tooltips on hover and on focus with the action's name and keys, by platform; `aria-keyshortcuts`; a "Keys" button and `?` outside text fields opening the widget's keys panel, which Escape closes, with focus back where it was. Board strings only, no agent markup (AD-8).
- **The Ranking, to the full standard** (PO, sections 4 and 4.1): selection by Space, Shift+↑/↓, a click on a row's check box and Shift+click; moves of the selection, or of the current row, up, down, to the top and to the bottom, by key and by the new "To top" and "To bottom" tools; "Select none"; the "More" menu when the toolbar is crowded.
- **`askboard-help`** (PO, section 7): a second plugin skill, `askboard:askboard-help`, generated like `askboard` and covered by its drift check. It answers the user's questions on using the board in the terminal, in the user's language, and never calls AskBoard's tools. `askboard` points to it. Each widget type gains user-facing help text (mouse and answer) beside its teaching text. The `askboard` reference of each type with a key table gains a Keys section.
- **The keyboard step in the harness** (PO, section 8): `openspec/config.yaml` (`rules.design`, `rules.tasks`), the architect, the implementation skill, the review protocol, the spec reviewer and CLAUDE.md's Agent harness history.
- **No version moves**: no schema set changes (design.md, decision 12).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: the key vocabulary, keys left to the browser, discoverable shortcuts, the keys panel, key labels by platform; the Ranking's selection, moves and keyboard.
- `contract`: key tables in the registry and their check; help text of a widget type.
- `skills`: two shipped skills, both generated; the help skill; Keys sections from the key tables; budgets; the benchmark's expected skills.
- `packaging`: the plugin and the release tree carry both skill folders.

## Impact

- Code: `packages/contract` (`src/keys/`, the registry entries' `keys` and `help`, `registry-check.ts`), `packages/widgets` (`ranking/`, `kanban/keys.ts`, `timeline/keys.ts`, `chart/`, `shared/toolbar-focus.ts`, `shared/move-toolbar.tsx`, `tree/use-crowded.ts` moved to `shared/`, parity tests of the Tree's and the Gantt's tables), `packages/view` (`catalog/port.ts` and `catalog/keys/`, `shell/renderer.tsx`'s item frame, `strings/`, a `./strings` package export), `packages/molecules` (`skill.json` help), `packages/bench` (`report.ts`), `tools/build/skills/` and `tools/build/skills.ts`, `tools/build/shared-modules.ts` (Radix Tooltip), `tools/release/assemble.ts`, `skills/askboard/` and `skills/askboard-help/` (generated), `packages/view/chunk-sizes.json`.
- Harness: `openspec/config.yaml`, `.claude/agents/askboard-architect.md`, `.claude/agents/askboard-spec-reviewer.md`, `.claude/skills/askboard-implementation/SKILL.md`, `.claude/skills/askboard-review-protocol/SKILL.md`, `CLAUDE.md`. Never `.claude/skills/openspec-*` or `.claude/commands/opsx/`.
- Documents: PRD FR-29 (one consequence) and NFR-12 (one sentence), amended in place; EXPERIENCE (Accessibility Floor, Widgets: Ranking) and DESIGN (tooltip, key caps, keys panel, the Ranking's selection and tools). No spine change.
- Dependencies: none new; Radix Tooltip comes from the pinned `radix-ui` and joins the `radix` library chunk.
- Merge points: `table-widget`, `document-review`, `image-annotation`, `graph-widget`, `diff-review`, `diagram-widget`, `spreadsheet-widget`, `choice-documented-activation`, `oversized-acts`, `early-benchmark`, and the planned `kanban-card-order` (design.md, Merge points).
- IDs served: FR-11, FR-29, FR-34; NFR-1, NFR-5, NFR-11, NFR-12; SM-1; R5. ADs: AD-1, AD-6, AD-8, AD-9, AD-17, AD-18, AD-19. UX: EXPERIENCE Accessibility Floor (Keyboard core, Shortcuts, Tab order, Focus), Interaction Primitives (Hover and focus feedback, Drag), Component Patterns (Widget frame; Widgets: Ranking), Localization; DESIGN Components (Agent-written labels' tooltip, Ranking).

## Open questions for the PO

Each carries a proposed default. Task 0.1 records each answer before anything relies on it. Under an unattended handoff an answer reads "proposed default accepted under the PO's unattended handoff", except question 1, whose approval the PO reserved (input 1.1.0, section 4.2): until the PO answers it, no spec or code carries a key it proposes.

1. **Keys for actions outside the vocabulary** (section 4.2; also confirm section 12's fourth row: the architect proposes, the PO approves). *Default*, same rules as the vocabulary (one key per action in every widget, no browser key taken, nothing that needs Insert):

   | Action | Proposed keys | Widgets |
   |---|---|---|
   | Add after the current row | Alt+Shift+Enter | Tree "Add node", Table "Add row" |
   | Add a child | Cmd/Ctrl+Shift+Enter | Tree "Add child" |
   | Select all | Cmd/Ctrl+A, outside text fields | Tree; a list only with a visible "Select all" |
   | Select none | Escape, outside text fields, while something is selected | Tree, Ranking, later Kanban and Timeline |
   | Adjust by % | `%`, outside text fields, with a selection | Tree |
   | Keep this order | Enter on the list | Ranking |
   | Delete the row where Delete clears a cell | Alt+Shift+Delete or Alt+Shift+Backspace | Table "Delete row"; beside Delete in the Tree |
   | Approval decisions | none: Radix Toggle Group keys (arrows, Space, Enter); so no table and no panel | Approval |
   | Critical path, zoom | none: Space on the switch, the arrows on the zoom, listed in the Gantt's panel | Gantt |

   In this change only "Keep this order" and "Select none" of the Ranking depend on it (task 4.6). *Alternative*: no key for actions outside the vocabulary.
2. **Moving a selection that is not contiguous** (section 9). *Default*: each selected row moves one place past its nearest unselected neighbour, keeping the order among the selected; rows already packed at the end stay; "To top" and "To bottom" gather the selection into one block, in order. *Alternatives*: the first move gathers the rows into a block; or only a contiguous range moves.
3. **The Kanban's keys within a column** (planned change `kanban-card-order`). *Default*: they arrive with `kanban-card-order` (Alt+Shift+↑/↓, Alt+Shift+Home/End, Cmd/Ctrl+Shift+↑/↓, "To top" and "To bottom" within the column); the Kanban's retrofit brings only Alt+Shift+←/→ between columns, selection and the panel, and leaves those keys unbound until then. *Alternative*: the retrofit waits for `kanban-card-order` and adds them itself.
4. **The Timeline's "To top" and "To bottom"** (section 4.1). *Default*: the first and the last lane, dates unchanged; Alt+Shift+←/→ move earlier and later by the zoom's step, Alt+Shift+↑/↓ to the lane above and below. *Alternative*: the earliest and the latest date.
5. **The Gantt** (section 9). *Default*: no row reordering; Alt+Shift+←/→ on a task's row move its bar by the zoom's step, as the drag does; the start cell stays the other keyboard path. *Alternative*: no Alt+Shift keys; the start cell stays the only path.
6. **Key labels by platform** (section 5). *Default*: on macOS ⌃ ⌥ ⇧ ⌘ and ↩ ⌫ ⌦; elsewhere Ctrl, Alt, Shift and the key's name; arrows as ↑ ↓ ← → everywhere; Italian names (Maiusc, Invio, Canc, Spazio) provisional, to review. *Alternative*: one text form everywhere.
7. **The Keys button and the panel's look** (section 5). *Default*: "Keys" (`button-secondary`, tooltip "Keys (?)") as the last stop of the toolbar row, never in "More", or beside the counter in a widget with no toolbar; the panel is a non-modal popover anchored to it, titled "<Widget> keys" from board strings, listing the keys by group (Cursor, Selection, Move, Edit, Other); a read-only widget lists only the keys that still act. *Alternative*: a "?" icon button in the item's frame and a modal dialog.
8. **The Ranking's mouse selection** (section 4.1). *Default*: a check box in a leading column of each row, as the Tree's, out of the Tab order; a click toggles the row, Shift+click selects the range from the last row clicked; a click on the row still makes it current; a drag still moves the dragged row alone. *Alternative*: a click on the row selects it and a drag moves the selection.
9. **`askboard-help`'s budgets and frontmatter**. *Default*: description at most 400 characters, `SKILL.md` at most 6,000 characters and 150 lines, each reference at most 4,000; both skills' names and descriptions count in the 8,400-character always-loaded total (6,152 on 47f3c370); the frontmatter adds `disallowed-tools` naming AskBoard's five tools if task 0.4's probe confirms it works for a plugin's MCP tools, else prose only. *Alternative*: the `askboard` budgets; prose only.
10. **`askboard-help` in the benchmark**. *Default*: the report counts `askboard:askboard-help` as AskBoard's own skill and flags only others; the AskBoard arm still allows only `Skill(askboard:askboard)`; its description is part of the context AskBoard adds (NFR-1). *Alternative*: keep it out of the arm's listing, which Claude Code documents no way to do for one plugin skill.
11. **The split** (section 9). *Default*: this change, then `keyboard-retrofit-lists` (Tree, Kanban, Timeline) and `keyboard-retrofit-grids` (Gantt and its molecules, Chart, LaTeX, Table, the DateField's calendar, Choice and PickField after `choice-documented-activation`), each proposed once this one merges, the two in parallel. *Alternative*: one retrofit change in groups.
