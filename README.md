# AskBoard

**Your agent asks. You see the problem, work on it, and answer.**

AskBoard is a Claude Code plugin that turns an agent's questions into visual, context-rich decisions. Instead of a flat list of short options full of acronyms and bare references (D-01, FR-666, §5.3), the question opens on a board in your browser, with the context it refers to beside it and an interactive tool to work on the problem: a work breakdown with estimates, a Gantt plan, a table, a document to annotate. You answer what you now understand, and the agent gets back a typed answer it can act on, while it keeps working.

It runs on your machine, works in any Claude Code project, and depends on nothing else.

## Why AskBoard

An agent's question is only as good as your answer, and your answer is only as good as your understanding of the question. AskUserQuestion is perfect for "A or B?". It is the wrong tool when the question is about a plan, an estimate, a structure or a document: then you leave the terminal, hunt for what the agent is referring to, and answer from memory.

AskBoard lowers the effort a decision takes, on a board of one question as much as on a board of twenty:

- **The context comes with the question.** Excerpts of the documents the question refers to sit beside it, and the sources are one click away. No more looking up what D-01 means.
- **You work on the problem, not on a description of it.** Re-estimate a work package and watch the totals and the Gantt's critical path move. Reorder a ranking, move a card, annotate a passage, fill in a form with checks.
- **The agent gets an answer it can use.** Answers are typed data, not prose. They carry only what you changed, plus the values AskBoard derives from it, such as a plan's finish date, its critical path, or a table's totals.
- **Nobody waits for anybody.** Asking does not block the agent. Your answers reach it while it works, pushed as you give them or collected when it needs them. You can answer one question now, postpone another, decline a third, or ask the agent a follow-up from the board.
- **It stays cheap for the agent.** The agent sends content and data, never markup, and AskBoard draws them. Token cost and the time to show a question are design goals from the start, and AskBoard's own benchmark measures them against AskUserQuestion.
- **It stays on your machine.** The board listens on `127.0.0.1` only, with a token on every request. There is no telemetry. What the agent sends is shown as data in a sandboxed view, and none of its markup or code ever runs. AskBoard fails closed: it never returns an answer you did not give.

## When to use it

AskBoard sits beside AskUserQuestion. The agent weighs how hard the question is to grasp and how much context it needs, never how many questions or options there are. The cases below are examples, not a complete list.

**Use AskBoard when:**

- the questions depend on one another, such as a set of decisions about one design, where an answer changes what the next one means;
- the questions cite documents by bare IDs (D-01, FR-666, §5.3) that you would otherwise have to look up;
- the content reads better seen and worked on: a WBS, a Gantt, a chart, a UML diagram or state machine, a formula, a table, a document to review.

**Stay with AskUserQuestion when** the choice is simple and self-explanatory: "A or B?", with nothing to look up.

The agent judges whether a visual, interactive board helps. An asking rule, set at user or project level, overrides that judgement.

## How it works

1. **The agent asks.** It calls `ask` with one or many questions, grouped into areas if it likes, and carries on with its work.
2. **The board opens.** A system notification and a link in the terminal bring it up in your browser. The header shows which project, branch and agent are asking.
3. **You decide.** Answer one question at a time, or all of them with Submit. Postpone what you are not ready for, decline what you will not answer, write in the open prompt, or send the agent a follow-up and read its reply beside the question. Your unsent work survives a reload.
4. **The agent acts.** Answers reach it by themselves while it works, or when it calls `collect`. The agent can then change the ask, reopen a question (which starts from your previous answer), or close the ask.

The agent drives all this through five tools:

| Tool | What it does |
|---|---|
| `ask` | Opens a board of questions in your browser and returns at once. |
| `update` | Changes an ask: adds, changes, deletes or reopens a question, records an answer you gave elsewhere, replies to a follow-up, or closes the ask. |
| `collect` | Returns what you sent since the agent last looked (answers, postpones, declines, notes and follow-ups), and can wait for one question. |
| `fetch` | Returns one question, area or widget in full, with the complete values you edited. |
| `snapshot` | Takes a Snapshot of a board, its data and visuals, for the agent to build a document, a deck or an offer from. |

The plugin also ships the `askboard` skill. It teaches the agent when to ask through AskBoard rather than AskUserQuestion, and how to build each widget. AskBoard sits beside AskUserQuestion and does not replace it: the agent picks the better tool for each question. You can override that choice with an asking rule, at user or project level:
- `always` sends every question to AskBoard;
- `with-references` sends every question that points at a file or a URL to AskBoard.

## What you can ask with

| Family | Widgets |
|---|---|
| Choice and input | **Choice** (single or multiple, with option previews), **Scale** (a slider, a range or a rating), **Ranking** (by drag or by keyboard), **Approval** (approve, approve with changes and a required reason, or reject, with a summary of your changes), **Form** (text, number, money, date, on/off and pick-list fields, with required fields and checks) |
| Text | **Document review** (select a passage, comment on it or suggest a replacement), **LaTeX** (edit one expression with a live preview), Markdown text shown safely as data |
| Numbers | **Table** (typed columns, formula columns and totals, rows to add and delete), **Chart** (bar, line and pie; highlight the points that matter) |
| Structures | **Tree** (a work breakdown with optional PERT estimates, bulk percentage changes with preview and undo, drag and drop) |
| Time | **Gantt** (zoom, baseline, critical path, durations by resizing), **Timeline** (milestones and ranges across lanes), **Kanban** (cards moved between columns) |

**Ready-made molecules** combine widgets and formulas, so the agent sends only data. The **WBS with PERT** is linked to a **Gantt plan**: change an estimate and the expected effort, the spread, the dates and the critical path follow, without a round trip to the agent.

**Building blocks** let the agent compose a question when no widget fits. The atoms are Text, Value, Divider and the input fields. The layouts are Stack, Row, Group and Tabs, nested up to four deep.

**On every board:**
- a navigator, and a jump to the next open question;
- a context panel beside or under each question;
- what you changed shows apart from what the agent sent;
- revisions and follow-ups;
- Snapshots;
- English and Italian;
- light and dark themes, compact or comfortable density, and settings you change on the board.

More widgets are on the way: Diff review, Graph, Diagram, Spreadsheet and Image annotation, and the sales estimate review and decision matrix molecules. See the [roadmap](https://github.com/MrBogomips/askboard/blob/main/ROADMAP.md).

## Who it is for

Anyone who works in Claude Code and makes the decisions its agents ask for:

- **Engineers** answering design, plan and change questions, with the decision record beside the question.
- **PMs** planning and estimating a PRD or an SOW: review the work breakdown, adjust the estimates and see the plan move.
- **Sales people** turning an estimate into an offer, then having the agent build the offer from a Snapshot of the board.

## Requirements

- Node 24.22.1 or later as the default `node` on the `PATH` that Claude Code gives its plugins. The plugin runs the session process and the hooks on Node through a small start script, and its folder pins no Node version. With Volta, run `volta install node@24` so that the default Node qualifies: the start script runs Node from the plugin's folder, so a project's own Node pin does not apply. Without a qualifying Node, AskBoard offers no tools and says why in its instructions, and the agent asks another way.
- Claude Code 2.1.311 or later (the `stable` channel reaches it), with mods on, which is the default. Mods give push delivery; without them, answers still arrive when the agent collects them.
- macOS or Linux, including devcontainers. On Windows, use WSL.
- A browser on the same machine, for the board.
- While the repository is private, read access to `MrBogomips/askboard` and git credentials that work without a prompt. For GitHub, that means `gh auth login` then `gh auth setup-git`.

## Install

Releases are published on the `release` branch, tagged `v<version>`, as a ready-built plugin: nothing is built or installed on your machine. From a terminal:

```sh
claude plugin marketplace add MrBogomips/askboard#release
claude plugin install askboard@askboard --scope user
```

The first command adds the marketplace `askboard`, which follows the `release` branch. The second installs the plugin `askboard` from it for you, in every project. Restart Claude Code, or start a new session, to load it. Inside Claude Code, the same two steps are `/plugin marketplace add MrBogomips/askboard#release` and `/plugin install askboard@askboard`.

To install it for one project only, so that it travels with the repository:

```sh
claude plugin marketplace add MrBogomips/askboard#release --scope project
claude plugin install askboard@askboard --scope project
```

This writes the marketplace and `enabledPlugins` to the project's `.claude/settings.json`, which you commit. Each teammate still runs the same `marketplace add` and `install` commands on their own machine, and Claude Code asks each of them to approve the project's AskBoard server before it runs. For yourself only in one project, use `--scope local` instead.

To hold a version rather than follow releases, add the marketplace at its tag:

```sh
claude plugin marketplace add MrBogomips/askboard#v0.1.0
```

To check the installation:
- `claude mcp list` shows AskBoard as connected. It also does when Node is too old, because the server then answers with no tools.
- In a session, `/mcp` lists its five tools. With none listed, the server's instructions name the Node version it found.
- `/hooks` lists its hooks.

Then ask the agent to ask you a few questions with AskBoard, or to plan a piece of work as a work breakdown with a Gantt plan.

## Update

A third-party marketplace does not update by itself. To move to a new release:

```sh
claude plugin marketplace update askboard
claude plugin update askboard@askboard
```

Restart Claude Code to apply it. A marketplace added at `#v<version>` stays at that tag; add `#release` or a newer tag to move.

## Uninstall

```sh
claude plugin uninstall askboard@askboard
claude plugin marketplace remove askboard
```

Uninstalling removes the plugin from that scope and deletes its data folder under `~/.claude/plugins/data/` (unless you pass `--keep-data`). It leaves behind, until you delete them by hand:
- the `.askboard/` folder in each project, which holds the board's saved state and configuration;
- the session folder, `$XDG_RUNTIME_DIR/askboard` or else `${TMPDIR:-/tmp}/askboard-<uid>`, which is empty when no session runs;
- the marketplace entry, until you remove it.

## Documents

- What has shipped, release by release: `CHANGELOG.md`
- What is done and what is left before 1.0.0: `ROADMAP.md`
- Requirements: `docs/prd-askboard-2026-10-25/prd.md` and `addendum.md`
- Architecture: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (the binding decisions AD-1 to AD-22) and `SOLUTION-DESIGN.md` (why, facts, spikes)
- UX: `docs/ux-askboard-2026-10-27/DESIGN.md` (how it looks) and `EXPERIENCE.md` (how it works), with the mockups in `mockups/`
- Where these documents come from and how they change: `docs/README.md`

## Development

Changes are driven by [OpenSpec](https://github.com/Fission-AI/OpenSpec): propose a change, implement it, archive it into `openspec/specs/`. The backlog is the repository's GitHub Issues.

```sh
npx --yes @fission-ai/openspec@1.15.0 list                    # changes in flight
npx --yes @fission-ai/openspec@1.15.0 validate --all --strict  # what CI runs
```

Requirements: Bun 1.4.4, the version in `packageManager`, and Node 24.22.1 or later, pinned for the repository with Volta. The code lives in the ten packages under `packages/`; `tools/` holds the repository checks.

```sh
bun install                                    # install the pinned dependencies
bun run build                                  # dist/askboard.mjs (the session process) and dist/view/ (the board)
GITHUB_TOKEN=$(gh auth token) bun run check    # what CI runs: type check, lint, tests, import and licence checks
bun run format                                 # format with Biome and apply safe fixes
bun run test:e2e                               # after a build: browser tests and the conformance suite
```

- **Licence check:** it needs network access, because it reads the licences of other platforms' packages from the npm registry. Without `GITHUB_TOKEN`, it skips its lookup of archived repositories and says so.
- **End-to-end tests:** they run the built session process with Playwright's Chromium, Firefox and WebKit. Install the engines once with `node_modules/.bin/playwright install chromium firefox webkit`.

To try a checkout in Claude Code:
1. Build it.
2. Start `claude --plugin-dir <this checkout>` in any project. The plugin's server and hooks run on Node through `scripts/askboard`, a POSIX `sh` start script, with the same files that a release ships. With Volta, the checkout's own Node pin applies.
3. Ask the agent to ask you a few questions with AskBoard.

To install a frozen copy that later builds in the checkout do not change, assemble a release tree into an empty folder outside the checkout and add it as a local marketplace:

```sh
bun tools/release/assemble.ts --out <empty dir>
claude plugin marketplace add <empty dir>
claude plugin install askboard@askboard --scope local
```

Release commands (for maintainers):

```sh
bun tools/release/version.ts 0.2.0                 # set one version in every manifest and bun.lock
bun tools/release/assemble.ts --out <empty dir>    # after bun run build: the release tree, with its marketplace file
node tools/release/smoke.ts <tree> --tools <file>  # the tree's start script answers the handshake on plain Node
```

- The release workflow runs these on `main`, and it is dispatched by hand. Merging a change does not release it.
- Add a `## <version>` section to `CHANGELOG.md` before dispatching. The workflow refuses without one, and the section's body becomes the release notes.

## Licence

MIT, see `LICENSE`.
