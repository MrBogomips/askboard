# AskBoard

AskBoard turns the questions a Claude Code agent asks into visual, context-rich decisions. A complicated question opens in a browser on the user's own machine, with the context it needs beside it and interactive tools (diagrams, Gantt charts, WBS estimates, visual diffs) to answer it. The agent gets back a typed answer it can act on.

AskBoard works in any Claude Code project and depends on nothing else.

## Status

Design complete and its four spikes decided. E1, the walking skeleton, is merged, and E3, the ask lifecycle, is implemented: an agent puts all its choice questions in one ask, grouped in areas if it likes; the user answers, postpones, declines, revises or asks a follow-up on a board in the browser, one at a time or together with Submit, and the board keeps unsent work across a reload; the agent reads what the user sent, changes or closes the ask, and reads one question in full. E4, push delivery, is implemented on top of E3: answers reach a working agent without it asking, through a Claude Code mod, and hooks give each ask its owner, show the board link in the terminal and keep a subagent from finishing before it has its answers. Widget questions by pull are implemented on top of them (`widget-answers`): an agent can put a Tree (a work breakdown, optionally with PERT estimates), a Gantt plan or a ready-made work breakdown linked to its plan in a question, and the user edits it on the board and answers; the answer carries what changed and the derived values, such as the plan's finish and critical path. E3 and E4 await their first live runs; nothing is released yet.

## Tools

AskBoard gives the agent four tools:

- `ask` opens a board of questions in the user's browser and returns at once. A question holds options, widget items or both: Tree and Gantt items, or a molecule reference such as the work breakdown.
- `update` changes an ask the agent sent: adds, changes, deletes or reopens a question, records an answer the user gave elsewhere, replies to a follow-up, or closes the ask.
- `collect` returns what the user sent after the cursor the agent passes (answers, postpones, declines, notes and follow-ups), and can wait for one question.
- `fetch` returns one question or area in full, page by page when it does not fit one result, and a widget item with the full value the user edited, which an answer too large for one result leaves out.

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

Requirements: Bun 1.4.4, the version in `packageManager`, and Node 24, pinned for the repository with Volta. The code lives in the ten packages under `packages/`; `tools/` holds the repository checks.

```sh
bun install                                    # install the pinned dependencies
GITHUB_TOKEN=$(gh auth token) bun run check    # what CI runs: type check, lint, tests, import and licence checks
bun run format                                 # format with Biome and apply safe fixes
bun run build                                  # dist/askboard.mjs (the session process) and dist/view/ (the board)
bun run test:e2e                               # after a build: browser tests and the conformance suite
```

The licence check needs network access: it reads the licences of other platforms' packages from the npm registry. Without `GITHUB_TOKEN`, it skips its lookup of archived repositories and says so.

The end-to-end tests run the built session process with Playwright's Chromium, Firefox and WebKit; install them once with `node_modules/.bin/playwright install chromium firefox webkit`.

To try AskBoard in Claude Code, build it, then start `claude --plugin-dir <this checkout>` in any project and ask the agent to ask you a few choice questions with AskBoard (single or multiple choice), or to ask for a work breakdown with a plan (a Tree, a Gantt or the work breakdown molecule). The board opens in your browser with a system notification, and the terminal shows its link. Answer it there: the answers reach the agent by themselves, through the plugin's mod, or when the agent collects them. `/hooks` lists AskBoard's hooks; with mods turned off, answers still arrive when the agent collects them.

## Licence

MIT, see `LICENSE`.
