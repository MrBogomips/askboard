# AskBoard roadmap

**Where AskBoard is going:**
- **1.0.0** is the whole MVP scope of the PRD (`docs/prd-askboard-2026-10-25/prd.md` §8.1):
  - asking, context, typed answers, the question lifecycle, Snapshots, setup, languages and settings;
  - all 18 widgets of FR-11;
  - the four ready-made molecules of FR-15;
  - a light benchmark against AskUserQuestion.
- **Before 1.0.0:** 0.x releases, each shipping what has merged by its release time.

This file is a summary, updated at each release, not by each change. Parallel changes never edit it, so it never causes merge conflicts. The live state is elsewhere:
- the GitHub Issues, which are the backlog;
- `openspec list`, for the changes in flight;
- `CHANGELOG.md`, for what each release ships.

## Done: 0.1.0

0.1.0 is prepared on `main`, and its notes are in `CHANGELOG.md`. Dispatching the release waits for GitHub Actions to run again (#86).

| Area | What is there |
|---|---|
| Foundation | The ten packages and their import boundaries; the contract with its versioned schema sets; the compute engine for derived values and formulas; strict validation that fails closed |
| Asking | Many questions in one ask, grouped into areas; options, open prompt, item IDs; changing, reopening and closing an ask after sending it (FR-1 to FR-7) |
| Context | Excerpts beside the question, references one click away, follow-ups through the board (FR-8 to FR-10) |
| Question lifecycle | Non-blocking asks; immediate or submitted delivery; a notice of a new ask; one tab per ask with a context header; postpone, decline and revise; unsent work kept across a reload; a reopened question that starts from the previous answer (FR-21 to FR-25) |
| Push delivery | Answers reach a working agent through a Claude Code mod, and every capability also works by pull. Hooks give each ask its owner, show the board link and keep a subagent from finishing before it has its answers |
| Typed answers | Only what changed, plus the derived values, who answered and when (FR-18 to FR-20) |
| Widgets: 13 of 18 | Choice, Scale, Ranking, Approval, Form, Document review, LaTeX, Table, Chart, Tree, Gantt, Timeline, Kanban (FR-11) |
| Building blocks | Eight atoms and the PickField; the layouts Stack, Row, Group and Tabs; field checks (FR-13) |
| Molecules: 2 of 4 | The WBS with PERT, linked to the Gantt plan (FR-15) |
| Snapshots | A board's data and visuals, saved in the project for the agent to reuse (FR-26, FR-27) |
| Setup | A Claude Code plugin at user, project or local scope; the `askboard` skill; asking rules beside AskUserQuestion (FR-28 to FR-31) |
| Languages and settings | English and Italian; theme, density and context placement on the board (FR-34, FR-35) |
| Release tooling | The release workflow, the release tree, the smoke test on plain Node |

## Left for 1.0.0

### Widgets and molecules

| Item | What the user does | Requirement | Issue |
|---|---|---|---|
| Diff review | Compares an agent's changes line by line, and accepts or rejects each change or a whole file | FR-11, UJ-1 | #125 |
| Graph | Edits a DAG, a dependency network or a state machine, with checks such as cycles | FR-11, UJ-1 | #126 |
| Diagram | Annotates and corrects a Mermaid or PlantUML diagram | FR-11 | #127 |
| Spreadsheet | Edits cells, including cells that hold formulas | FR-11, FR-14 | #128 |
| Image annotation | Places pins, boxes and comments on a screenshot or a mockup | FR-11 | #129 |
| Sales estimate review | Adjusts rates, effort and scope lines, watches the margin, and approves | FR-15, UJ-3 | #130 |
| Decision matrix | Changes weights and ratings and sees each option's score | FR-15 | #131 |

Proposals for the first five widgets were drafted on 2026-11-08 and are checked against current `main` when each one starts.

### Measurement

| Item | Requirement | Issue |
|---|---|---|
| Light benchmark: the fixed question set, AskBoard against AskUserQuestion, the three KPIs and the cost of 100 questions. The early benchmark (`openspec/changes/early-benchmark`) waits for the PO's runs. | FR-32, FR-33, SM-1 to SM-4 | #132 |

### Improvements the PO asked for

| Item | Issue | State |
|---|---|---|
| Kanban: order cards within their column | #79 | In change (`kanban-order`) |
| Keyboard shortcuts, contextual help and the `askboard-help` skill | #81 | Proposed (`keyboard-shortcuts-help`) |
| Undo when editing complex widgets and molecules | #80 | Open |
| LaTeX: a larger formula and a tighter layout | #77 | Open |
| Timeline: a more contrasted palette, and a colour per bar | #78 | Open |
| Artifact-ready Snapshot with a Publish button | #90 | Open |

### Quality

- **Open defects, M:**
  - #96: a reload drops, without a word, work held only on an item the agent removed;
  - #104: a first edit after "Keep mine" reverts the agent's change;
  - #113: an `update` result with many actions can pass the 30,000-character bound.
- **Open defects, L:** #76, #95, #97, #101, #111, #120, #121, #122.
- **Questions waiting for the PO:** #82, #83, #84, #114. By-hand checks and live runs: #108.
- **Infrastructure:**
  - Actions refused for billing (#86) blocks the release workflow and the Firefox runs in CI;
  - Linux comes back to CI with one `runs-on` line per job (NFR-7).

### Proposed order

This order is proposed; the PO decides it.

1. **0.1.0:** dispatch the release once Actions runs again (#86).
2. **0.2.0, from real use:** the M defects, the Kanban order, the keyboard help, the early benchmark's runs, and whatever daily use of 0.1.0 turns up.
3. **0.3.0, the journeys:** Diff review and Graph complete UJ-1; the sales estimate review completes UJ-3.
4. **0.4.0, the rest of the catalogue:** Diagram, Spreadsheet, Image annotation, the decision matrix, and the light benchmark across the fixed set.
5. **1.0.0:** the whole of §8.1, with the benchmark's targets checked.

## After 1.0.0

Deferred by the PRD (§8.2) or the architecture (the spine's Deferred section):

- Registering molecules for reuse (FR-16).
- Exporting molecules and a molecule repository on GitHub (FR-17).
- The full benchmark, with settings the user chooses (part of FR-32).
- The Bun executable form, with its launcher and `askboard doctor` (AD-19). The plain JavaScript bundle on Node ships until AXFX admits the executable.
- Boards in the Claude Desktop Browser pane (NFR-8).
