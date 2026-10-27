# AskBoard design documents

This repository owns AskBoard's requirements and architecture. They were written in the AXFX planning repository (`agentxema_prd`, local, BMad Method) and transferred here on 2026-10-27 from its commit `73d5cb6`. The copies are byte-identical to the originals; the originals are frozen there and no longer change.

## Contents

| Folder | Documents | Status at transfer |
|---|---|---|
| `prd-askboard-2026-10-25/` | `prd.md`, `addendum.md`, `research-mcp-performance.md`, `.memlog.md` | final (2026-10-26) |
| `architecture-askboard-2026-10-27/` | `ARCHITECTURE-SPINE.md`, `SOLUTION-DESIGN.md`, `research-cc-delivery-2026-10-27.md`, `research-stack-2026-10-27.md`, `reviews/review-web-verification.md`, `.memlog.md` | final (2026-10-27) |
| `ux-askboard-2026-10-27/` | `DESIGN.md`, `EXPERIENCE.md` | not yet transferred: the UX run was still in progress |

The folder names are the original run names, so the references between documents (for example `prd-askboard-2026-10-25/prd.md` in the spine) still resolve. Each `.memlog.md` is the append-only decision record of its run: settled decisions, deferred items with owner and revisit condition, and the requested PRD changes. The intermediate working files (extracts, reconciliations, review reports other than the web verification) stay frozen in the planning repository.

## How these documents relate

- The **PRD** states what AskBoard must do (FR, NFR, SM, R IDs). The **addendum** carries the material meant for architecture.
- The **architecture spine** binds: AD-1 to AD-22 hold for every change. The **solution design** explains them, lists the verified facts (§13) and defines the spikes (§10). Where the two seem to differ, the spine wins.
- OpenSpec specs and changes (`openspec/`) cite these IDs. A change that alters a requirement or an architecture decision updates the PRD or the spine in the same change, and keeps AD IDs stable: amend a decision in place, add the next AD-n for a new one, never renumber.

## Pending at transfer

- **PRD changes requested by the architecture**: listed in `SOLUTION-DESIGN.md` §11 and logged as `PRD-CHANGE:` entries in `architecture-askboard-2026-10-27/.memlog.md`. Not yet applied to the PRD.
- **PRD changes requested by the UX run**: collected by that run in its `prd-change-requests.md`; they arrive with the UX documents.
- **The UX documents**: to be transferred here when the UX run is final.
- **The AXFX contract**: what AXFX requires of AskBoard (AXFX PRD §5.10, §6, §7) stays in the planning repository. AskBoard depends on nothing in AXFX; changes to that contract are requested there (`CONTRACT-CHANGE:` entries in the architecture memlog).
