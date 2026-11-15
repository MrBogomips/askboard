# Design documents: working rules

Loaded when working under `docs/`. The list of documents and how a change updates them are in the root `AGENTS.md` (Design documents).

- Keep the folder names: they are the original run names, and cross-references such as `prd-askboard-2026-10-25/prd.md` in the spine depend on them.
- Each `.memlog.md` is the append-only decision record of its run: never rewrite its entries.
- Citations of working files not under `docs/` (`extract-*.md`, `review-*.md`, the PRD and architecture `reconcile-*.md`) point to the planning repository's git history (`agentxema_prd`: PRD at `cf5ac80`, architecture at `73d5cb6`, UX at `fe3f319`); citations of `../prd-agentxema-2026-10-21/` point to the AXFX PRD, which lives in the planning repository.
- The AXFX contract (AXFX PRD §5.10, §6, §7) lives in the planning repository; changes to it are requested there, not made here.
- `docs/as-built/<change-id>.md`: one note per OpenSpec change (AGENTS.md, Working documents). It states no status (merged, awaiting, dates); a later change that makes a sentence of an earlier note wrong corrects that sentence and says so in its own note.
