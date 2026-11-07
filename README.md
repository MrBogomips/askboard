# AskBoard

AskBoard turns the questions a Claude Code agent asks into visual, context-rich decisions. A complicated question opens in a browser on the user's own machine, with the context it needs beside it and interactive tools (diagrams, Gantt charts, WBS estimates, visual diffs) to answer it. The agent gets back a typed answer it can act on.

AskBoard works in any Claude Code project and depends on nothing else.

## Status

Design complete and its four spikes decided. E1, the walking skeleton, is merged, and E3, the ask lifecycle, is implemented: an agent puts all its choice questions in one ask, grouped in areas if it likes; the user answers, postpones, declines, revises or asks a follow-up on a board in the browser, one at a time or together with Submit, and the board keeps unsent work across a reload; the agent reads what the user sent, changes or closes the ask, and reads one question in full. E4, push delivery, is implemented on top of E3: answers reach a working agent without it asking, through a Claude Code mod, and hooks give each ask its owner, show the board link in the terminal and keep a subagent from finishing before it has its answers. Widget questions by pull are implemented on top of them (`widget-answers`): an agent can put a Tree (a work breakdown, optionally with PERT estimates), a Gantt plan or a ready-made work breakdown linked to its plan in a question, and the user edits it on the board and answers; the answer carries what changed and the derived values, such as the plan's finish and critical path. E3 and E4 await their first live runs. The first release, 0.1.0, is prepared (see Install); its notes are in `CHANGELOG.md`.

## Tools

AskBoard gives the agent five tools:

- `ask` opens a board of questions in the user's browser and returns at once. A question holds options, widget items or both: Tree and Gantt items, or a molecule reference such as the work breakdown.
- `update` changes an ask the agent sent: adds, changes, deletes or reopens a question, records an answer the user gave elsewhere, replies to a follow-up, or closes the ask.
- `collect` returns what the user sent after the cursor the agent passes (answers, postpones, declines, notes and follow-ups), and can wait for one question.
- `fetch` returns one question or area in full, page by page when it does not fit one result, and a widget item with the full value the user edited, which an answer too large for one result leaves out.
- `snapshot` takes a Snapshot of a board, its data and visuals, for the agent to build a document from.

## Requirements

- Node 24.22.1 or later as the default `node` on the `PATH` that Claude Code gives its plugins. The plugin runs the session process and the hooks on Node through a small start script, and its folder pins no Node version: with Volta, run `volta install node@24` so that the default Node qualifies (Volta follows a project's own Node pin, so a pinned project may work while others do not). Without a qualifying Node, AskBoard offers no tools and says why in its instructions, and the agent asks another way.
- Claude Code 2.1.311 or later (the `stable` channel reaches it), with mods on (the default): they give push delivery. Without mods, answers still arrive when the agent collects them.
- macOS or Linux, including devcontainers. On Windows, use WSL.
- A browser on the same machine, for the board.
- While the repository is private (0.1.0), read access to `MrBogomips/askboard` and git credentials that work without a prompt: for GitHub, `gh auth login` then `gh auth setup-git`.

## Install

Releases are published on the `release` branch, tagged `v<version>`, as a ready-built plugin: nothing is built or installed on your machine. From a terminal:

```sh
claude plugin marketplace add MrBogomips/askboard#release
claude plugin install askboard@askboard --scope user
```

The first command adds the marketplace `askboard`, which follows the `release` branch; the second installs the plugin `askboard` from it for you, in every project. Restart Claude Code, or start a new session, to load it. The same two steps run inside Claude Code as `/plugin marketplace add MrBogomips/askboard#release` and `/plugin install askboard@askboard`.

For one project, so that it travels with the repository:

```sh
claude plugin marketplace add MrBogomips/askboard#release --scope project
claude plugin install askboard@askboard --scope project
```

This writes the marketplace and `enabledPlugins` to the project's `.claude/settings.json`, which you commit. Each teammate still installs the plugin on their own machine (the same `marketplace add` and `install` commands), and Claude Code asks each of them to approve the project's AskBoard server before it runs.

To hold a version rather than follow releases, add the marketplace at its tag:

```sh
claude plugin marketplace add MrBogomips/askboard#v0.1.0
```

Check it with `claude mcp list` (AskBoard is connected) and, in a session, `/hooks`. Then ask the agent to ask you a few choice questions with AskBoard.

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

Uninstalling removes the plugin from that scope and deletes its data folder under `~/.claude/plugins/data/` (unless you pass `--keep-data`). It leaves the `.askboard/` folder in each project (the board's saved state and configuration), the session folder (`$XDG_RUNTIME_DIR/askboard`, else `${TMPDIR:-/tmp}/askboard-<uid>`, empty when no session runs), and the marketplace entry until you remove it. Delete those by hand if you want them gone.

## Documents

- Requirements: `docs/prd-askboard-2026-10-25/prd.md` and `addendum.md`
- Architecture: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (binding decisions AD-1 to AD-22) and `SOLUTION-DESIGN.md` (why, facts, spikes)
- UX: `docs/ux-askboard-2026-10-27/DESIGN.md` (how it looks) and `EXPERIENCE.md` (how it works), with the mockups in `mockups/`
- Where they come from and how they change: `docs/README.md`

## Development workflow

Changes are driven by [OpenSpec](https://github.com/Fission-AI/OpenSpec): propose a change, implement it, archive it into `openspec/specs/`.

```sh
openspec list                              # changes in flight
openspec validate --all --strict           # what CI runs
```

## Development

Requirements: Bun 1.4.4, the version in `packageManager`, and Node 24.22.1 or later, pinned for the repository with Volta. The code lives in the ten packages under `packages/`; `tools/` holds the repository checks.

```sh
bun install                                    # install the pinned dependencies
GITHUB_TOKEN=$(gh auth token) bun run check    # what CI runs: type check, lint, tests, import and licence checks
bun run format                                 # format with Biome and apply safe fixes
bun run build                                  # dist/askboard.mjs (the session process) and dist/view/ (the board)
bun run test:e2e                               # after a build: browser tests and the conformance suite
```

The licence check needs network access: it reads the licences of other platforms' packages from the npm registry. Without `GITHUB_TOKEN`, it skips its lookup of archived repositories and says so.

The end-to-end tests run the built session process with Playwright's Chromium, Firefox and WebKit; install them once with `node_modules/.bin/playwright install chromium firefox webkit`.

The plugin's server and hooks run on Node through `scripts/askboard`, a POSIX `sh` start script, with the same files that a release ships: the development plugin needs Node 24.22.1 or later as the default `node` too. To try AskBoard in Claude Code, build it, then start `claude --plugin-dir <this checkout>` in any project and ask the agent to ask you a few choice questions with AskBoard (single or multiple choice), or to ask for a work breakdown with a plan (a Tree, a Gantt or the work breakdown molecule). The board opens in your browser with a system notification, and the terminal shows its link. Answer it there: the answers reach the agent by themselves, through the plugin's mod, or when the agent collects them. The plugin also carries a skill, `askboard`, which tells the agent when to ask through AskBoard rather than AskUserQuestion and how to build each widget; Claude Code lists it among its skills. `/hooks` lists AskBoard's hooks; with mods turned off, answers still arrive when the agent collects them.

Release commands (maintainers; the release workflow runs them on `main`, dispatched by hand, and merging a change does not release):

```sh
bun tools/release/version.ts 0.2.0                 # set one version in every manifest and bun.lock
bun tools/release/assemble.ts --out <empty dir>    # after bun run build: the release tree, with its marketplace file
node tools/release/smoke.ts <tree> --tools <file>  # the tree's start script answers the handshake on plain Node
```

Add a `## <version>` section to `CHANGELOG.md` before dispatching: the workflow refuses without it, and its body is the release's notes.

## Licence

MIT, see `LICENSE`.
