# AskBoard

AskBoard turns the questions a Claude Code agent asks into visual, context-rich decisions. A complicated question opens in a browser on the user's own machine, with the context it needs beside it and interactive tools (diagrams, Gantt charts, WBS estimates, visual diffs) to answer it. The agent gets back a typed answer it can act on.

AskBoard works in any Claude Code project and depends on nothing else.

## Status

Design complete, no code yet. Next: the spikes defined in the solution design (§10), then the first OpenSpec changes.

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

## Licence

MIT, see `LICENSE`.
