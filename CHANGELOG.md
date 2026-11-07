# Changelog

All notable changes to AskBoard are recorded here, newest first, in the layout of Keep a Changelog. Versions before 1.0.0 are 0.x releases: each ships what has merged at its release time (PRD §8).

## Unreleased

## 0.1.0 - 2026-11-07

First release. AskBoard installs as a Claude Code plugin from a GitHub marketplace, at user or project scope, on macOS and Linux (Windows through WSL); it runs on Node 24.22.1 or later.

### Added

- Asking by pull through five tools, `ask`, `update`, `collect`, `fetch` and `snapshot`: a board of several questions and areas in the browser, answered one at a time or together with Submit, with postpone, decline, revise and follow-up, and the board's unsent work kept across a reload.
- Widgets: Choice (single and multiple), Tree (a work breakdown with optional PERT estimates, selection, bulk percentage change with undo, drag and drop) and Gantt (zoom, baseline, critical path, resizable task column, requested durations), with the answer carrying the edited values and the derived values such as the plan's finish and critical path.
- Widgets that give a result: Approval (approve, approve with changes and a required reason, reject, with a summary of the question's changes), Scale (a slider, one value or a range, or a rating) and Ranking (reorder by drag or with Move up and Move down).
- Widgets that the user edits and the answer carries as changes: LaTeX (one expression, a source field with a live preview drawn by KaTeX, and a refusal of macro definitions, KaTeX's internal commands and other commands a LaTeX item does not allow), Kanban (cards moved between columns, by drag or with "Move to...") and Timeline (milestones and ranges moved across lanes on the Gantt's time axis).
- The ready molecules: the work breakdown with PERT and the Gantt plan, linked to each other.
- The `askboard` skill, which tells the agent when to ask through AskBoard rather than AskUserQuestion and how to build each widget.
- Push delivery: answers reach a working agent without it asking, through a Claude Code mod; hooks give each ask its owner, show the board link in the terminal and keep a subagent from finishing before it has its answers; a system notification announces a new board.
- Snapshots of a board: its data and visuals, for the agent to build a document from.
- Languages (English and Italian) and settings.
- A start script, `scripts/askboard`, that runs the session process and the hooks on Node and, when Node is missing or too old, tells the agent why instead of failing silently.
- LaTeX draws its preview through KaTeX's documented interface alone (`katex.render`), after AskBoard's own scan of the source, which also counts stacked accents: an expression with 11 or more stacked combining marks on one character is refused as nested too deep. An expression whose KaTeX output is very large is no longer refused as too complex.
- Chart (bar, line and pie; highlighted points as the answer): the user reads a chart and highlights data points, by click or by keyboard, and the highlighted points come back as the answer's result, in the `results` of `collect` and `fetch`. The `askboard` skill teaches it.
- Atoms, the single-purpose items of a question: Text (plain or Markdown, shown as data in the sandboxed view, its `http:` and `https:` links opening in a new tab through the board page, its images as links), Value, Divider, and the input atoms TextField, NumberField, MoneyField (an amount in a currency the agent fixes or lets the user pick), DateField (with a calendar) and Toggle, each answering in the `results` of `collect` and `fetch`. An option's preview can be Markdown. Text a field cannot read stays in the field with its error and keeps "Answer" disabled until the user corrects or clears it. The `askboard` skill teaches the atoms.

### Known limits

- The repository is private: installing needs read access and git credentials.
- No automatic updates: a third-party marketplace does not update by itself (see the README).
- LaTeX, K-1: a nesting form the scan does not count, unknown today or added by a KaTeX release, can reach Chromium's crash depth (about 130 levels) and crash the board's tab, on every load if the agent sent it. The scan counts every form known on KaTeX 0.19.1, and its limit is about 12 times under the crash.
- LaTeX, K-2: a very wide expression, such as about 2,000 empty matrix cells, drew in 118 ms in Chromium and 415 ms in WebKit (measured on an M3 Max), and may pass the 2-second rule on slow hardware; no realistic formula comes near.
- The Bun executable form, `askboard doctor`, the light benchmark and the remaining widgets and molecules of the PRD come in later releases.
- A Markdown Text of the densest table (100 columns by 190 short rows, about 19,000 elements, 783 code points of source) renders in under 100 ms, but an ask of 200 such Texts is ready after about 17 s in Chromium and about 53 s in WebKit (an ask of 200 Texts at the 200,000-character cap takes about 1.0 s and 1.4 s more than a plain board). Nothing bounds the number of Texts in an ask; a pathological ask of this kind is handled later as a bug.
