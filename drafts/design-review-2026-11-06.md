# AskBoard board page: UI/UX design review (2026-11-06)

**Status: draft, for the PO.** Reviewed on `main` at b4f6c104 (PR #34 included), against `docs/ux-askboard-2026-10-27/DESIGN.md` and `EXPERIENCE.md` and the `view-and-widgets` spec. The planned features of the OpenSpec change `widget-editing-plus` (branch `worktree-feature-widget-editing-plus`, at e14fe1b6) were reviewed from their proposal, design and UX draft. No product code was changed.

**Method.** The built session process (`dist/askboard.mjs`) served real boards through the browser test harness, in Chromium, with the approved fixtures: the UJ-2 ask (WBS with PERT, Gantt plan, a choice), the plain choice (golden case), the UJ-1 context ask (excerpts, a reference, an image, an unresolved pointer), the two-question ask (settings panel, Snapshot, Closed banner), and the UJ-2 ask in it-IT. Light and dark, compact and comfortable, at 1440, 1280 (the viewport floor) and 1024 px. Hover, focus, editing, error, drag, zoom, closed and follow-up states were driven by script; cursors and hover colours were read from computed styles. Contrast was computed from the token hex values.

**Evidence.** The screenshot names below are files in the review's scratch folder (`design-review/`, not committed; the review can be rerun). `L-` and `D-` prefixes are the light and dark state runs, at 1440 px, compact.

## Executive summary

The board reads calm and sober, as DESIGN.md intends, and the core paths work: tokens, change highlight, focus rings on keyboard focus, field errors with clear messages, and the follow-up thread all render as specified. The problems are concentrated in three places:

1. **Nothing tells the user what is clickable.** No control on the board sets a pointer cursor (Gantt bars, with `grab`, are the only exception), and the hover fills that exist move between two surfaces 1.13 to 1.17:1 apart, so they are practically invisible; Tree and Gantt cells have no hover at all. The PO's complaint is confirmed everywhere, not only in the widgets. The UX draft of `widget-editing-plus` adds the rule, but maps hover to shadcn's `accent`, which is the same colour as the resting toolbar buttons: it would still be invisible on them (F-01).
2. **The Tree and the Gantt hide their state.** A clicked Tree row shows no current-row mark while Move and Delete act on it; the Gantt counter says "none yet" while its cells and bars carry change marks; at the 1280 px floor the Gantt chart shows 520 of its 810 px with no visible scroll affordance, so the plan's end is out of view.
3. **Localization and the closed state are unfinished.** In an it-IT board the Tree and Gantt chrome stays in English; the Closed banner breaks its layout around the Snapshot path, and the header keeps showing a working agent and open questions on a closed ask.

On the PO's question about **"= 6" under a WBS number**: it is the spec's parsed-value echo. Keep the guarantee (the user sees how AskBoard read an entry before it counts), but stop showing it when it repeats what was typed, and never on a second line inside a grid row (F-08).

**Counts:** 6 high, 13 medium, 9 low.

## Findings

Each finding: severity, component, evidence, problem, recommendation, and the document change it needs (spec, PRD, DESIGN/EXPERIENCE, or none: an implementation fix of what the documents already say).

### High

**F-01 · High · Every interactive control (board-wide) · Hover and cursor feedback missing**
- Evidence: `L-tree-hover-cell`, `L-tree-hover-tool`, `D-tree-hover-tool`, `golden-option-hover`, `header-hover-segment`; computed styles: cursor `auto` on Tree and Gantt cells and chevrons, `default` on tool buttons, option rows, segments, Answer and references; hover fill none on cells, `muted`→`card` on tools (1.16:1 light, 1.13:1 dark), `card`→`accent`=`muted` on option rows (1.16:1).
- Problem: Tailwind 4's preflight leaves buttons on the default cursor and no style sets another, so the board never signals what responds. The fills that exist are below any perceptible step.
- Recommendation: one shared rule set, as `widget-editing-plus` design decision 9 plans: `cursor: pointer` on enabled buttons, radios, checkboxes, segments, links, chevrons and option rows; `cursor: text` on editable cells; `grab` on handles and bars; `col-resize` on the Task column edge; `not-allowed` and no hover on disabled controls. Hover look: on `card` surfaces, the `muted` fill plus, for cells, a 1px `border-strong` inset outline (3.49:1, clearly visible, distinct from the 2px focus ring and the plum change border); on toolbar buttons that rest on `muted`, a `border-strong` border and the `card` fill. Do not map toolbar hover to `accent`: it equals their resting fill.
- Change: DESIGN/EXPERIENCE (UX draft blocks 13 and 14 of `widget-editing-plus`, amended as above: add a `hover` token pair rather than reusing `accent`).

**F-02 · High · Tree (WBS) · No visible current row; tools act on an invisible target**
- Evidence: `L-tree-click` (UX design clicked: no mark, "Move down" and "Delete" enabled), `uj2-light-compact-1440` (at open, "Move down" and "Delete" already enabled with nothing marked).
- Problem: the toolbar acts on the focused row, but focus is shown only for keyboard focus (`focus-visible`). After a click, or at open, the user cannot see which package "Delete" will remove.
- Recommendation: give the current row a persistent mark independent of focus-visible: `primary-subtle` row fill and a 2px `primary` left bar, shown after a click and at open only once a row is current; until then the row tools are disabled. With `widget-editing-plus`'s checkbox selection, define both states apart: the current row (one, by click or arrows, target of Move, Indent and Delete) and the selected rows (checkboxes, target of "Adjust by %…"). Optionally name the target in the tool's accessible name ("Delete UX design").
- Change: DESIGN (Tree: current-row look) and spec (Tree keyboard and editing: what the tools act on).

**F-03 · High · Gantt plan · Chart cut at the viewport floor, no scroll affordance**
- Evidence: `uj2-light-compact-1280-top`, `uj2-dark-comfortable-1280` (scroll box 520/810 px and 488/810 px), `uj2-dark-compact-1024`, `uj2-light-comfortable-1440` (cut at 1440 too in comfortable).
- Problem: at 1280 px the Reporting bar runs off the frame; the grid takes about 48% of the widget, and the horizontal scroll is invisible (overlay scrollbar, no edge fade). The plan's end date, which is what the user is checking against the SOW, is hidden.
- Recommendation: open at the zoom that fits the whole plan in the available width ("Fit", or compute the week width from the span); show a persistent scrollbar or an edge shadow when it still overflows; let the Task column shrink (the planned resize) and move "Depends on" into the row's tooltip or an expandable column at narrow widths.
- Change: spec (Gantt layout and plan scope: initial zoom, overflow cue); DESIGN (Gantt anatomy). Fold into `widget-editing-plus` with the Task column resize.

**F-04 · High · Tree, Gantt, WBS and Gantt plan · Widget chrome not localized**
- Evidence: `uj2-it-light-compact-1440`, `uj2-it-light-compact-1024`, `uj2-it-dark-comfortable-1024`.
- Problem: in an it-IT board the board chrome is Italian, but "Add node", "Add child", "Move up", "Move down", "Indent", "Outdent", "Delete", "Changes vs agent's original · none yet", "Day | Week | Month", "Task / Start / Duration / Depends on", the legend ("task, critical path, your change") and the molecule's columns ("Work package", "Optimistic", "Most likely", "Pessimistic", "Expected effort", "Spread") stay English. These are AskBoard's strings, not the agent's.
- Recommendation: route the widget and molecule strings through the view's string catalog, add them to the Localization table, and add the it-IT board to the widget browser scenarios. Check the Italian lengths against the toolbar (F-13).
- Change: none for the requirement (the board's interface follows the ask's language); EXPERIENCE Localization table gains the strings.

**F-05 · High · Gantt grid · Double-click selects text instead of editing**
- Evidence: `L-gantt-dblclick`, `L-gantt-deps` (no editor opens; "portal" is selected as text).
- Problem: the PO expects double-click editing in both grids; the Tree has it since PR #34, the Gantt does not, and the text selection looks like a malfunction.
- Recommendation: as `widget-editing-plus` task 2.7 plans; also set `user-select: none` on non-editing grid cells so a double-click never selects.
- Change: none beyond `widget-editing-plus` (F6).

**F-06 · High · Closed banner and Snapshot feedback · Layout breaks around the saved path**
- Evidence: `closed-banner-snapshot`, `snapshot-bar-feedback`.
- Problem: the banner sits above the context header (DESIGN: directly under it), and the absolute Snapshot path squeezes its message, "This ask was closed. The board is read-only.", into a one-word-per-line column six lines tall. In the bottom bar the same path pushes "Select recommended" onto a second row.
- Recommendation: place the banner under the header; keep the message on one line (`shrink-0`); show the path project-relative (`.askboard/snapshots/…html`), cut with a middle ellipsis, full path in a tooltip and a "Copy path" link-button; put the feedback on its own line under the banner or bar rather than inline.
- Change: none for the banner position (DESIGN already says it); DESIGN Snapshot control: path display and copy action.

### Medium

**F-07 · Medium · Gantt plan · Change counter contradicts the marks**
- Evidence: `L-gantt-edit-echo` (counter "none yet" while UX design and Billing durations and bars are marked), `L-gantt-changed` ("Your changes: 1" with three marked tasks).
- Problem: durations that follow WBS edits take the full change highlight but are not counted, so the counter and the marks disagree, and the user cannot tell what they changed in the plan from what followed.
- Recommendation: mark derived changes differently from direct ones (the `change-subtle` fill without the change border, or a dotted outline on the bar), and say it in the counter: "1 change · 2 follow from the WBS".
- Change: DESIGN (Change highlight, Gantt plan) and spec (Gantt change highlight).

**F-08 · Medium · Tree number editor · The "= 6" echo (PO question)**
- Evidence: `L-tree-edit-echo`, `D-tree-edit-echo`.
- Problem: the echo of the parsed value (DESIGN Input atoms, spec Tree editing) shows on a second line under the input, so the row grows from 36 to about 56 px while typing and the grid jumps. For a plain number it repeats what was typed ("6" → "= 6") and reads as a formula or a total, which is why the PO does not understand it. Its real value is for entries the parser normalizes ("1,234.5" → 1234.5), and ambiguous entries already get a field error.
- Recommendation: keep the rule, change when and where: show the echo only when the parsed value differs from the typed text, inside the editor's row (a muted trailing hint on the left of the input, or in the tooltip), never as a second line in a grid; standalone NumberField and MoneyField keep it beside the field, as DESIGN says ("beside", not under). Do not remove it entirely: it is the guarantee that the agent receives what the user saw.
- Change: spec (Tree editing and Gantt editing: "echoing the parsed value when it differs from the entry") and DESIGN (Input atoms).

**F-09 · Medium · Gantt start editor · The date echo covers the neighbouring cells**
- Evidence: `L-gantt-edit-echo`, `L-gantt-edit-error`, `D-gantt-edit-echo`.
- Problem: "= Mon, Nov 9, 2026" floats in a bordered box over the Duration and Depends on cells. Here the echo is useful (the weekday shows a weekend at once), but it hides data the user may be checking.
- Recommendation: show it as a tooltip anchored above the editor, or in the row's message line where the field error goes; shorten it to the weekday when the date was typed in full ("Mon").
- Change: DESIGN (Input atoms or Gantt editing).

**F-10 · Medium · Tree and Gantt grids · Field error far from the field**
- Evidence: `L-tree-edit-ambiguous-enter`, `L-gantt-edit-error`.
- Problem: the message is set at the row's left edge, under the name, while the refused field is three columns to the right; it does not say which field it is about.
- Recommendation: prefix the column ("Most likely: use commas only between groups of three digits…") and tie it with `aria-describedby`; keep it under the row, but indent it to the edited cell when there is room.
- Change: DESIGN (Field error in grids).

**F-11 · Medium · Tree · A new row opens with a red error**
- Evidence: `L-tree-added`.
- Problem: "Add node" shows "No expected effort or spread: they could not be computed." in the error colour before the user has typed the name; the new row has empty estimates by design, so the message reads as a fault.
- Recommendation: show a just-added row's empty roll-ups as "—" in `muted-foreground`, with no error, until the user leaves the row with an estimate still missing; then a neutral note, not `field-error` (it does not block the answer). Show the added-row bar at once.
- Change: spec (Tree adding nodes, Derived value on an empty input) and DESIGN (Derived value).

**F-12 · Medium · Gantt plan · Baseline reads as a second bar**
- Evidence: `uj2-light-compact-1440`, `L-gantt-changed`.
- Problem: the agent's baseline is drawn under every bar in the task-bar colour, also where nothing moved, so every task looks doubled; the legend has no entry for it.
- Recommendation: draw the baseline only where it differs from the current dates (or on a toolbar switch), as a 2px outlined or dashed `border-strong` line; add "agent's plan" to the legend. This settles DESIGN open item 8 (baseline look).
- Change: DESIGN (Gantt plan baseline, open item 8).

**F-13 · Medium · Gantt chart · Dependency arrows**
- Evidence: `uj2-light-compact-1440`, `L-gantt-day`.
- Problem: the elbows overshoot the predecessor's end and turn back into bracket shapes, arrowheads are 3 to 4 px, and long links run along the row rules (Architecture to Customer portal), where they read as grid lines.
- Recommendation: leave the bar end with an 8 px stub, drop in the gap between rows, enter the successor from the left at mid-height; 6 px arrowheads; route non-critical links in `border-strong` so they separate from the gridlines.
- Change: DESIGN (Gantt anatomy).

**F-14 · Medium · Gantt drag · Earliest-start guide almost invisible**
- Evidence: `L-gantt-drag-left`, `L-gantt-drag`.
- Problem: the guide that EXPERIENCE requires during a drag is a short faint mark; a user dragging left only sees the bar stop.
- Recommendation: a full-height 2px dashed line in `foreground-secondary` with a label ("earliest 11/6") while dragging. Settles DESIGN open item 8 (guide look).
- Change: DESIGN (Gantt, open item 8).

**F-15 · Medium · Gantt zoom · Month and Day scales**
- Evidence: `L-gantt-month`, `L-gantt-day`.
- Problem: Month labels only "Dec 2026" (the first month has no label) and leaves about 40% of the chart empty; Day shows weekends like working days, though durations count working days only.
- Recommendation: label the first period; stretch short spans to the width; shade non-working days on `muted` (DESIGN open item 9).
- Change: DESIGN (open item 9).

**F-16 · Medium · Tree toolbar · Tools collide with the counter at narrow widths**
- Evidence: `uj2-dark-compact-1024`, `uj2-it-light-compact-1024` ("Delete" overprinted by "Changes vs agent's original").
- Problem: below the floor the counter does not give way; with Italian labels and the planned "Adjust by %…", "Undo adjust" and selection tools it will happen at 1280 too.
- Recommendation: `min-w-0` and truncation on the counter, a shorter idle text ("No changes"), and an overflow "More" menu for the move tools when the toolbar is full.
- Change: none (CSS); DESIGN Widget frame if the overflow menu is adopted.

**F-17 · Medium · Segmented controls in the header and settings panel · Selected segment without underline**
- Evidence: `uj2-light-compact-1440` (header Theme and Density), `settings-light`; compare the delivery switch in the bottom bar, which has it.
- Problem: DESIGN (Segmented control, F-92) gives the selected segment a 2px `primary` underline so hue and fill are not the only cue; the header and settings segments use only the `card` fill and weight.
- Recommendation: use the same segment classes as the delivery switch and the Gantt zoom.
- Change: none (CSS).

**F-18 · Medium · Closed ask · Header and controls keep the open look**
- Evidence: `closed-banner-snapshot`.
- Problem: on a closed ask the header still shows "Agent: Working", "2 open" and an enabled "Next open ↓"; option rows keep their enabled look and "Ask a follow-up" its link colour, while Postpone, More and Answer are disabled.
- Recommendation: on closed and discarded asks, hide the open count and the next-open jump, show the agent pill as ended (or hide it), and give option rows and link-buttons the disabled look.
- Change: EXPERIENCE (State Patterns, By surface: closed), DESIGN (disabled option row).

**F-19 · Medium · WBS with PERT · No excerpt per work package**
- Evidence: `uj2-light-compact-1440` (no leaf chevron; the fixture's `excerpt` pointers resolve against the project file).
- Problem: EXPERIENCE and DESIGN promise a leaf chevron that opens the package's excerpt as a row detail; the spec does not carry it and the board drops the pointers silently.
- Recommendation: either build it (it is the WBS's link to the SOW text, and the Tree has room for a row detail) or record it as deferred in the spec and DESIGN.
- Change: spec (Molecules: WBS with PERT), or a DESIGN/EXPERIENCE note that it is deferred.

### Low

**F-20 · Low · Gantt grid · Duration without unit**: "6" in the grid against "5.5 d" in the WBS (`uj2-light-compact-1440`). Show "6 d", or "Duration (working days)" in the header. Change: DESIGN (Gantt plan grid labels, provisional).

**F-21 · Low · Gantt · Two date formats**: grid "11/2/2026", axis "Nov 2" (`uj2-light-compact-1440`). Prefer the short form with the weekday in the grid ("Mon 11/2") and the year only when the plan spans two. Change: DESIGN (provisional labels).

**F-22 · Low · Tree header · "Expected effort" wraps**: the header row grows to two lines while the others stay on one (`uj2-light-compact-1440`). Label "Expected" with the full name in the tooltip, or widen the column. Change: none (provisional label).

**F-23 · Low · Tree and Gantt rows · Density ignored**: rows stay 36 px in comfortable (`uj2-light-comfortable-1440`); only the card padding changes. Re-point the row height with the other heights (32 compact, 40 comfortable). Change: DESIGN (Layout & Spacing, density tokens).

**F-24 · Low · Image item · No frame**: an image renders edge to edge in the question with no border or caption, so a UI screenshot reads as live board UI (`uj1-light-1440`). Frame it on `muted` with a border and a caption line (alt text or path). Change: DESIGN (Display atoms, Image, not mocked).

**F-25 · Low · Excerpt · Unresolved pointer offers "Open in reading panel"** (`uj1-light-1440`, "Intro"). Hide the action on an unresolved excerpt. Change: none.

**F-26 · Low · Reading panel · Literal backticks**: "No editor set: \`editor\` in ~/.config/askboard/config.json" shows the backticks (`uj1-reading-panel`). Set the key in the code face instead. Change: none.

**F-27 · Low · Option row · "+ Add your note to this option"** appears on focus but not on hover (DESIGN: both), and shifts the following options down when it appears (`golden-option-focus`, `golden-option-hover`). Reserve its line or overlay it. Change: none.

**F-28 · Low · Typography · System fonts**: the board still uses the system stack (`packages/view/src/styles/base.css`, "until the faces are adopted"), not the bundled Inter and JetBrains Mono. Track it, since every measurement in this review may shift. Also observed, cause not investigated: header row 1 is left-aligned on the UJ-1 board and right-aligned on the others (`uj1-light-1440` against `golden-light-1440`). Change: none.

## Checks with no finding

- Contrast of every load-bearing token pair meets DESIGN's table (recomputed); the change border on cells is 6.34:1 light and 5.94:1 dark; the focus ring is 3.43:1 even on the `muted` toolbar.
- Keyboard focus rings show on cells, options, the open prompt and the reading panel's close control (`L-tree-keyboard-focus`, `golden-option-focus`, `golden-prompt-focus`).
- Field error texts are clear and carry their meaning without colour (`L-tree-edit-ambiguous-enter`, `L-gantt-edit-error`).
- Day labels no longer overlap at day zoom (PR #34, `L-gantt-day`); critical links are drawn heavier.
- The follow-up thread, the More menu and the settings panel match DESIGN (`golden-thread`, `golden-more-menu`, `settings-light`, `settings-dark`).
- Target sizes: buttons are 28 px high, option rows are full-width targets; the only small targets are the 16 px chevrons and radios, which sit inside larger clickable rows (chevron: 16 px only, consider a 24 px hit area).

## Quick fixes (CSS or tokens only)

1. Pointer, text, grab and not-allowed cursors on every interactive element (F-01).
2. Visible hover: `muted` fill plus 1px `border-strong` inset outline on editable cells; `border-strong` border on toolbar tools; no hover on disabled controls (F-01).
3. Persistent current-row mark in the Tree (`primary-subtle` fill, 2px `primary` left bar) (F-02, visual part).
4. Selected-segment underline in the header and settings segmented controls (F-17).
5. Toolbar counter: `min-w-0`, truncation, shorter idle text (F-16).
6. Closed banner: under the header, message `shrink-0`; Snapshot path truncated with a middle ellipsis (F-06, visual part).
7. Echo on the input's row, not under it; Gantt date echo as a tooltip above the editor (F-08, F-09, layout part).
8. `user-select: none` on non-editing grid cells (F-05, partial).
9. Gantt baseline thinner and outlined; legend entry (F-12, visual part).
10. Disabled look for option rows and link-buttons on a closed ask (F-18, visual part).
11. Tree and Gantt row heights on the density tokens (F-23).

## To fold into widget-editing-plus

- **F7 hover rule (UX draft blocks 13 and 14):** do not use `accent` as the toolbar hover surface; add a `hover` token pair and the cell outline of F-01; list the cursors as F-01 does.
- **F6 double-click (task 2.7):** build it for the Gantt grid, with `user-select: none` (F-05).
- **Row selection vs current row:** define the current-row mark (F-02) next to the checkbox selection, and which tools act on which; disable row tools when no row is current.
- **F1 Task column resize:** pair it with the fit-to-width zoom and the overflow cue of F-03; the default width should leave the whole plan visible at 1280 px.
- **F2 critical-path switch:** with the switch off, the arrows should take the F-13 routing and colour, so the plain view stays readable.
- **F3 duration by dragging the bar's end:** show the earliest-start guide of F-14 and a live duration label ("8 d") during the drag; the resize handle needs the `col-resize` (`ew-resize`) cursor and a visible grip on hover; the "requested duration" pin must be distinguishable from the derived-change mark of F-07.
- **F4 "Adjust by %…":** its percentage field should follow F-08 (echo only when it differs); the preview's refusal message should name the rows and columns (F-10); the toolbar gains three or four buttons, so the overflow of F-16 is needed first; Italian labels in the Localization table (F-04).
- **F5 drag and drop in the WBS:** the drag handle needs `grab`/`grabbing` cursors and appears on row hover and on the current row; the drop indicator for "into" should be the `primary` outline already planned, and the not-allowed cue should carry text (a tooltip "Cannot drop inside its own branch"), not colour only.
- **Derived changes:** a requested duration and a duration that follows the WBS are different kinds of change; decide their marks and the counter wording together (F-07).
- **Localization:** every new label in the change (switch, Adjust panel, Undo adjust, Select all and none, Resize the Task column) goes through the catalog with it-IT text, and the existing widget strings are moved there in the same pass (F-04).
