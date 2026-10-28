# AskBoard design documents

This repository owns AskBoard's requirements, architecture and UX design. They were written in the AXFX planning repository (`agentxema_prd`, local, BMad Method): the requirements and architecture were transferred here on 2026-10-27 from its commit `73d5cb6`, the UX design on 2026-10-28 from its commit `fe3f319`. The copies are byte-identical to the originals, which were removed from the planning repository on 2026-10-28 and remain in its git history (PRD at `cf5ac80`, architecture at `73d5cb6`, UX at `fe3f319`).

## Contents

| Folder | Documents | Status at transfer |
|---|---|---|
| `prd-askboard-2026-10-25/` | `prd.md`, `addendum.md`, `research-mcp-performance.md`, `.memlog.md` | final (2026-10-26) |
| `architecture-askboard-2026-10-27/` | `ARCHITECTURE-SPINE.md`, `SOLUTION-DESIGN.md`, `research-cc-delivery-2026-10-27.md`, `research-stack-2026-10-27.md`, `reviews/review-web-verification.md`, `.memlog.md` | final (2026-10-27) |
| `ux-askboard-2026-10-27/` | `DESIGN.md`, `EXPERIENCE.md`, `prd-change-requests.md`, `architecture-change-requests.md`, `validation-report.md`, `reconcile-prd.md`, `reconcile-research.md`, `.working/technical-choices-proposal.md`, `mockups/`, `.memlog.md` | final (2026-10-28) |

The folder names are the original run names, so the references between documents (for example `prd-askboard-2026-10-25/prd.md` in the spine) still resolve. Each `.memlog.md` is the append-only decision record of its run: settled decisions, deferred items with owner and revisit condition, and the requested PRD changes. For the PRD and the architecture, the intermediate working files (extracts, reconciliations, review reports other than the web verification) remain only in the planning repository's git history, at the same commits. The UX run brought the files its final documents cite: the validation report, which defines the `F-nn` findings, the two reconciliations, the technical choices proposal and the mockups. Its extracts, its lens review reports, the HTML rendering of the validation report and the palette generator remain at `fe3f319`.

## How these documents relate

- The **PRD** states what AskBoard must do (FR, NFR, SM, R IDs). The **addendum** carries the material meant for architecture.
- The **architecture spine** binds: AD-1 to AD-22 hold for every change. The **solution design** explains them, lists the verified facts (§13) and defines the spikes (§10). Where the two seem to differ, the spine wins.
- The two **UX spines** are peers: `DESIGN.md` owns how AskBoard looks (tokens and components), `EXPERIENCE.md` how it works (information architecture, states, interactions, accessibility, the key flows UJ-1 to UJ-3). Both win over the mockups in `mockups/`. The component choices come from the technical choices proposal, approved during the run.
- OpenSpec specs and changes (`openspec/`) cite these IDs. A change that alters a requirement or an architecture decision updates the PRD or the spine in the same change, and keeps AD IDs stable: amend a decision in place, add the next AD-n for a new one, never renumber.

## Changes applied after transfer

On 2026-10-28 the OpenSpec change `apply-design-change-requests` (archived under `openspec/changes/archive/`) applied these change requests to the PRD, the addendum, the spine and the solution design:

- **The architecture's PRD changes** (`SOLUTION-DESIGN.md` §11), except entries 7 and 8, listed below.
- **The UX run's PRD change requests** (`ux-askboard-2026-10-27/prd-change-requests.md`): PCR-01 to PCR-34. PCR-18 and PCR-19 were withdrawn. PCR-26 was settled by the product owner: the agent gets no per-question close, so FR-4 no longer mentions one.
- **The UX run's architecture change requests** (`ux-askboard-2026-10-27/architecture-change-requests.md`): ACR-02 to ACR-13 (ACR-01 was withdrawn), together with the renderer spike checks S-1 to S-8 (`SOLUTION-DESIGN.md` §10.3).

The change's `trace.md` records where each request landed. The UX spines were written before this change, so they still cite these requests as "pending PCR-nn" or "pending ACR-nn"; those citations now refer to applied requests.

## Still pending

- **The licence exception** (`SOLUTION-DESIGN.md` §11, entry 7). NFR-6 stays unchanged until the packaging spike, and until then AskBoard ships the plain JavaScript bundle on Node (AD-19).
- **A UX refresh.** Applying the requests settled three points that `ux-askboard-2026-10-27/EXPERIENCE.md` does not yet reflect, and a later UX update should bring it in line:
  - `editor` is read only from the user configuration, so a project-level value is ignored, and the settings panel shows it as ignored (AD-8, AD-14);
  - an ask may declare its `locale` separately from its language (FR-34, AD-7);
  - the ask state follows what the user has sent, and the delivery receipt alone shows what the agent has received (FR-24, AD-3).
- **The AXFX contract**: what AXFX requires of AskBoard (AXFX PRD §5.10, §6, §7) stays in the planning repository. AskBoard depends on nothing in AXFX; changes to that contract are requested there (`CONTRACT-CHANGE:` entries in the architecture memlog). One is still open: the AXFX NFR-1 licence confirmation (`SOLUTION-DESIGN.md` §11, entry 8).
