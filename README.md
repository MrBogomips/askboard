# AskBoard

AskBoard turns the questions a Claude Code agent asks into visual, context-rich decisions. A complicated question opens in a browser on the user's own machine, with the context it needs beside it and interactive tools (diagrams, Gantt charts, WBS estimates, visual diffs) to answer it. The agent gets back a typed answer it can act on.

AskBoard works in any Claude Code project and depends on nothing else.

## Status

Design complete. The workspace and its checks are set up, with no product code yet. Next: the spikes defined in the solution design (§10), then the first OpenSpec changes.

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
```

The licence check needs network access: it reads the licences of other platforms' packages from the npm registry. Without `GITHUB_TOKEN`, it skips its lookup of archived repositories and says so.

## Licence

MIT, see `LICENSE`.
