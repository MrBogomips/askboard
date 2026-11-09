# Proposal

Input: the PO's change request `drafts/proposta-scorciatoie-tastiera-1.1.0.md` (Italian; sections 3 to 8 and 12 decided by the PO), which supersedes `drafts/proposta-scorciatoie-tastiera-1.0.0.md`. Corrections to its inventory (section 3) are in design.md, "Review of the existing widgets". Second input, 2026-11-09: `drafts/proposta-scorciatoie-configurabili-1.1.0.md` (Italian; its section 10 holds the PO's decisions D1 to D5 and wins over the rest of it), summarised in the last comment on Issue #81.

## Why

Issue: #81

In the PO's end-to-end test on `main` 433b4d29 (test 2.4, the Ranking) the PO had to ask which keys to press: most widgets have keys, but the board never says which, and the list widgets lack the moves users expect (select a row or a range, move it up, down, to the top or the bottom). NFR-12's keyboard core is met in code and invisible on the board. Task 0.5 probed the vocabulary in the page only: on a real Mac or Linux desktop the system may take some keys first (Mission Control, a layout switch on Alt+Shift), and users bring other habits, so the PO wants each user able to change them.

## What Changes

This change is the foundation and the pilot. The retrofit of the other widgets follows in two later changes (design.md, decision 14), so the pull request says `Refs #81` and the last retrofit closes it.

- **One key vocabulary** (NFR-12; PO, section 4): the Tree's keys become every widget's, plus "to top / to bottom" (Alt+Shift+Home/End, with Cmd/Ctrl+Shift+↑/↓ beside them on every platform) and `?` for the keys panel, plus the keys the PO approved for actions outside it (question 1): Alt+Shift+Enter adds after, Cmd/Ctrl+Shift+Enter adds a child, Cmd/Ctrl+A selects all and Escape selects none outside text fields, `%` adjusts by %, Alt+Shift+Delete/Backspace deletes where Delete clears a cell. Keys held with other modifiers, keys pressed while an input method composes, and in a text field every key but its editor's stay the browser's. The Tree and the Table bind their approved keys in the retrofits.
- **One key table per widget, as data** (PO, section 6): in the widget's registry entry in `contract`, from which the key handler, the tooltips, `aria-keyshortcuts`, the keys panel, the Keys section of the skill's widget reference and `askboard-help` all derive. A registry check holds every table to the vocabulary: the same keys for the same action in every widget, and no key the browser or the system needs. A shipped type without a table is listed with its reason.
- **Tables of today's keys** for the Tree, the Gantt, the Kanban, the Timeline and the Chart, each tested against the widget's handler, so the help states what the board does from the first day. The Table and the Document review, merged since the proposal, get theirs in the grids retrofit. No behaviour changes there, apart from the next item.
- **A fix** (anti-goal "a shortcut steals a browser key"): the Ranking's, Kanban's, Timeline's and Chart's keys, the shared toolbars' and the Document review's toolbar's arrow keys, and the options' arrow keys (AskBoard's own radio group and the multiple choice's roving focus, since `choice-documented-activation`) act today whatever modifiers are held, so Alt+← (history back in Firefox and on Linux) is taken; they take only the keys with no modifier, or those their tables name.
- **Contextual help on the board** (PO, section 5): tooltips on hover and on focus with the action's name and keys, by platform; `aria-keyshortcuts`; a "Keys" button and `?` outside text fields opening the widget's keys panel, which Escape closes, with focus back where it was. Board strings only, no agent markup (AD-8).
- **The Ranking, to the full standard** (PO, sections 4 and 4.1): selection by Space, Shift+↑/↓, a click on a row's check box and Shift+click; moves of the selection, or of the current row, up, down, to the top and to the bottom, by key and by the new "To top" and "To bottom" tools; "Select none", also by Escape; "Keep this order", also by Enter on the list; the "More" menu when the toolbar is crowded.
- **`askboard-help`** (PO, section 7): a second plugin skill, `askboard:askboard-help`, generated like `askboard` and covered by its drift check. It answers the user's questions on using the board in the terminal, in the user's language, and never calls AskBoard's tools. `askboard` points to it. Each widget type gains user-facing help text (mouse and answer) beside its teaching text. The `askboard` reference of each type with a key table gains a Keys section.
- **The keyboard step in the harness** (PO, section 8): `openspec/config.yaml` (`rules.design`, `rules.tasks`), the architect, the implementation skill, the review protocol, the spec reviewer and CLAUDE.md's Agent harness history. The change's record goes in `docs/as-built/keyboard-shortcuts-help.md`.
- **The user's own keys** (PO, 2026-11-09, decisions D1 to D5 below): in the user configuration file only, key `keys`, the user replaces or removes the keys of an action, of the vocabulary or a type's own, in every widget that has it (`{"move.top": ["Mod+Alt+ArrowUp"], "select.all": []}`; `Mod` is Cmd on macOS and Ctrl elsewhere; Mod+Alt is admitted there only). The result is checked as the tables are (the allowed holds, no browser or system key, no two actions of one part on one key, no exit left without a key); any problem keeps every default key and shows in the settings panel and on stderr. A project file's `keys` is ignored with a warning (NFR-5, AD-8), and the ask carries none. No board editor, key capture or presets: `askboard-help` explains the file and helps write it. Tooltips, `aria-keyshortcuts` and the keys panel show the keys in effect.
- **Two versions move**: the configuration (`keys`) and the board protocol (the `settings` message's `keys` row and warnings), each the next minor after main's, bound at the rebase (design.md, decision 12, amended by D1).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: the key vocabulary and the approved keys outside it, keys left to the browser, discoverable shortcuts, the keys panel, key labels by platform; the Ranking's selection, moves and keyboard; the user's keys on the board; the settings panel's Keys row.
- `contract`: key tables in the registry and their check; the types without a table; help text of a widget type; the key-override notation, the effective table and the overrides check; the configuration's `keys`; the `settings` message's `keys` row and warnings.
- `core`: `keys` read from the user file only, checked, never half-applied, and read again when a board opens.
- `board-host`: `settings` carries the `keys` row; a board never writes `keys`.
- `skills`: two shipped skills, both generated; the help skill and its references one level deep; Keys sections from the key tables; the help skill's key configuration; budgets; the benchmark's expected skills.
- `packaging`: the plugin and the release tree carry both skill folders.

## Impact

- Code: `packages/contract` (`src/keys/`, the registry entries' `keys` and `help`, `registry-check.ts`, `schemas/configuration/`, `schemas/board-protocol/settings.json`), `packages/core` (`src/config/`), `packages/server` (board-host tests), `packages/widgets` (`ranking/`, `kanban/keys.ts`, `timeline/keys.ts`, `chart/`, `document-review/frame-handlers.ts`, `shared/toolbar-focus.ts`, `shared/move-toolbar.tsx`, `tree/use-crowded.ts` and `tree/select-box.tsx` moved to `shared/`, parity tests of today's tables), `packages/view` (`catalog/port.ts` and `catalog/keys/`, `catalog/fields/roving.ts`, `catalog/choice/multiple-choice.tsx`, `shell/renderer.tsx`'s item frame, `view-protocol.ts`, `board-page/` (the keys passed on, the settings panel's Keys row), `strings/`, a `./strings` package export), `packages/molecules` (`skill.json` help), `packages/bench` (`report.ts`), `tools/build/skills/` and `tools/build/skills.ts`, `tools/build/shared-modules.ts` (Radix Tooltip), `tools/release/assemble.ts`, `skills/askboard/` and `skills/askboard-help/` (generated), `packages/view/chunk-sizes.json`.
- Harness: `openspec/config.yaml`, `.claude/agents/askboard-architect.md`, `.claude/agents/askboard-spec-reviewer.md`, `.claude/skills/askboard-implementation/SKILL.md`, `.claude/skills/askboard-review-protocol/SKILL.md`, `CLAUDE.md` (the Agent harness history row and the `skills/` row). Never `.claude/skills/openspec-*` or `.claude/commands/opsx/`.
- Documents: PRD FR-29 (one consequence), FR-35 (one consequence) and NFR-12 (one sentence), amended in place; the spine's AD-14, amended in place (`keys` from the user file only, read again when a board opens, never written by a board); EXPERIENCE (Accessibility Floor, Widgets: Ranking, Preferences and Settings) and DESIGN (tooltip, key caps, keys panel, the Ranking's selection and tools, the settings panel's Keys row); the as-built note `docs/as-built/keyboard-shortcuts-help.md`.
- Dependencies: none new; Radix Tooltip comes from the pinned `radix-ui` and joins the `radix` library chunk.
- Merge points: `kanban-order` (Issue #79, in flight), `image-annotation`, `graph-widget`, `diff-review`, `diagram-widget` (it also widens the board protocol), `spreadsheet-widget`, `early-benchmark`, `codex-porting` (PR #139, the harness files), and the undo of Issue #80, not yet proposed (design.md, Merge points).
- IDs served: FR-11, FR-29, FR-34, FR-35; NFR-1, NFR-5, NFR-10, NFR-11, NFR-12; SM-1; R5. ADs: AD-1, AD-6, AD-7, AD-8, AD-9, AD-14, AD-17, AD-18, AD-19. UX: EXPERIENCE Accessibility Floor (Keyboard core, Shortcuts, Tab order, Focus), Interaction Primitives (Hover and focus feedback, Drag), Component Patterns (Widget frame; Widgets: Ranking), Preferences and Settings, Localization; DESIGN Components (Agent-written labels' tooltip, Ranking, Settings panel).

## Open questions for the PO

Each carried a proposed default. The PO answered all eleven on 2026-11-09, in the session and in a comment on Issue #81 (`needs-po` removed): question 1 approved as proposed, questions 2 to 11 the proposed defaults accepted, an explicit answer each. Task 0.1 recorded them below.

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

   In this change only "Keep this order" and "Select none" of the Ranking depend on it (design.md, decisions 6 and 8). *Alternative*: no key for actions outside the vocabulary.

   Answer (2026-11-09): approved exactly as the table states. The approved actions join the vocabulary (design.md, decisions 2 and 6); this change binds only the Ranking's Enter and Escape, and the retrofits bind the Tree's and the Table's.
2. **Moving a selection that is not contiguous** (section 9). *Default*: each selected row moves one place past its nearest unselected neighbour, keeping the order among the selected; rows already packed at the end stay; "To top" and "To bottom" gather the selection into one block, in order. *Alternatives*: the first move gathers the rows into a block; or only a contiguous range moves.

   Answer (2026-11-09): the proposed default, accepted by the PO.
3. **The Kanban's keys within a column** (the change then planned as `kanban-card-order`, now `kanban-order`, Issue #79). *Default*: they arrive with `kanban-order` (Alt+Shift+↑/↓, Alt+Shift+Home/End, Cmd/Ctrl+Shift+↑/↓, "To top" and "To bottom" within the column); the Kanban's retrofit brings only Alt+Shift+←/→ between columns, selection and the panel, and leaves those keys unbound until then. *Alternative*: the retrofit waits for `kanban-order` and adds them itself.

   Answer (2026-11-09): the proposed default, accepted by the PO. `kanban-order` binds exactly these keys (its design decision 5); design.md, Merge points, says how this change takes them.
4. **The Timeline's "To top" and "To bottom"** (section 4.1). *Default*: the first and the last lane, dates unchanged; Alt+Shift+←/→ move earlier and later by the zoom's step, Alt+Shift+↑/↓ to the lane above and below. *Alternative*: the earliest and the latest date.

   Answer (2026-11-09): the proposed default, accepted by the PO (for `keyboard-retrofit-lists`).
5. **The Gantt** (section 9). *Default*: no row reordering; Alt+Shift+←/→ on a task's row move its bar by the zoom's step, as the drag does; the start cell stays the other keyboard path. *Alternative*: no Alt+Shift keys; the start cell stays the only path.

   Answer (2026-11-09): the proposed default, accepted by the PO (for `keyboard-retrofit-grids`).
6. **Key labels by platform** (section 5). *Default*: on macOS ⌃ ⌥ ⇧ ⌘ and ↩ ⌫ ⌦; elsewhere Ctrl, Alt, Shift and the key's name; arrows as ↑ ↓ ← → everywhere; Italian names (Maiusc, Invio, Canc, Spazio) provisional, to review. *Alternative*: one text form everywhere.

   Answer (2026-11-09): the proposed default, accepted by the PO.
7. **The Keys button and the panel's look** (section 5). *Default*: "Keys" (`button-secondary`, tooltip "Keys (?)") as the last stop of the toolbar row, never in "More", or beside the counter in a widget with no toolbar; the panel is a non-modal popover anchored to it, titled "<Widget> keys" from board strings, listing the keys by group (Cursor, Selection, Move, Edit, Other); a read-only widget lists only the keys that still act. *Alternative*: a "?" icon button in the item's frame and a modal dialog.

   Answer (2026-11-09): the proposed default, accepted by the PO.
8. **The Ranking's mouse selection** (section 4.1). *Default*: a check box in a leading column of each row, as the Tree's, out of the Tab order; a click toggles the row, Shift+click selects the range from the last row clicked; a click on the row still makes it current; a drag still moves the dragged row alone. *Alternative*: a click on the row selects it and a drag moves the selection.

   Answer (2026-11-09): the proposed default, accepted by the PO.
9. **`askboard-help`'s budgets and frontmatter**. *Default*: description at most 400 characters, `SKILL.md` at most 6,000 characters and 150 lines, each reference at most 4,000; both skills' names and descriptions count in the 8,400-character always-loaded total (6,152 on 47f3c370, 6,410 on 700eebd9); the frontmatter adds `disallowed-tools` naming AskBoard's five tools if task 0.4's probe confirms it works for a plugin's MCP tools, else prose only. *Alternative*: the `askboard` budgets; prose only.

   Answer (2026-11-09): the proposed default, accepted by the PO.
10. **`askboard-help` in the benchmark**. *Default*: the report counts `askboard:askboard-help` as AskBoard's own skill and flags only others; the AskBoard arm still allows only `Skill(askboard:askboard)`; its description is part of the context AskBoard adds (NFR-1). *Alternative*: keep it out of the arm's listing, which Claude Code documents no way to do for one plugin skill.

    Answer (2026-11-09): the proposed default, accepted by the PO.
11. **The split** (section 9). *Default*: this change, then `keyboard-retrofit-lists` (Tree, Kanban, Timeline) and `keyboard-retrofit-grids` (Gantt and its molecules, Chart, LaTeX, Table, the DateField's calendar, Choice and PickField after `choice-documented-activation`), each proposed once this one merges, the two in parallel. *Alternative*: one retrofit change in groups.

    Answer (2026-11-09): the proposed default, accepted by the PO. Since the proposal, `choice-documented-activation` (#87), the Table (#68) and the Document review (#115) have merged: the PickField's help text comes here, and the grids retrofit takes the Table's and the Document review's key tables (design.md, decision 14).

## Decisions on user-configurable keys

The PO's request of 2026-11-09 (Issue #81, last comment; `drafts/proposta-scorciatoie-configurabili-1.1.0.md`, section 10). Each was a question with a proposed default; task 0.6 recorded the decisions.

- **D1, the plan.** Decision (2026-11-09): everything in this change, as further groups (8 to 10, and additions to groups 0 and 4 to 7); design decision 12 is amended, since two versions move. The draft's default had been a seam here and a later change.
- **D2, Mod+Alt.** Decision (2026-11-09): admitted, Ctrl+Alt on macOS included, in the user's overrides only, never in the registry's tables (design decision 17).
- **D3, the board.** Decision (2026-11-09): the file only. No Keys section in Settings, no key capture, no board write path; `askboard-help` explains the format, lists the actions with their default keys and helps the user write `keys` in the user file; the keys panel, the tooltips and `aria-keyshortcuts` show the keys in effect (decisions 19 and 20). The draft's default had been the file and a Settings section together.
- **D4, presets.** Decision (2026-11-09): none; to be weighed after the live checks on macOS and Linux (task 7.5).
- **D5, the scope.** Decision (2026-11-09): vocabulary actions and a type's own actions, under the same rules (decision 18).
