# AskBoard

AskBoard turns the questions a Claude Code agent asks into visual, context-rich decisions. A complicated question opens in a browser on the user's own machine, with the context it needs beside it and interactive tools (diagrams, Gantt charts, WBS estimates, visual diffs) to answer it. The agent gets back a typed answer it can act on.

AskBoard works in any Claude Code project and depends on nothing else.

## Status

Design complete and its four spikes decided. E1, the walking skeleton, is implemented: an agent asks one plain choice question with `ask`, the user answers it on a board in the browser, and the agent reads the answer with `collect`. It awaits its first live run; nothing is released yet.

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

To try AskBoard in Claude Code, build it, then start `claude --plugin-dir <this checkout>` in any project and ask the agent to ask you a choice question with AskBoard (E1 shows one question per board, single or multiple choice). The board opens in your browser; answer it there, and the agent collects the answer.

## Licence

MIT, see `LICENSE`.
