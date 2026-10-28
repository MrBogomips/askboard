# Proposal

## Why

The PRD and the architecture spine were finalised before two later sets of decisions. The architecture run asked for ten PRD changes (`SOLUTION-DESIGN.md` §11). The UX run, final on 2026-10-28, asked for 32 PRD changes (`docs/ux-askboard-2026-10-27/prd-change-requests.md`, PCR) and 12 architecture changes (`architecture-change-requests.md`, ACR). Every spike and epic cites FR, NFR and AD IDs, so the PRD and the spine must agree with the UX spines before the first of them starts.

## What Changes

- **PRD (`prd.md`).** Apply the architecture's PRD changes 1 to 6, 9 and 10, and the UX run's PCR-01 to PCR-17, PCR-20 to PCR-25 and PCR-29 to PCR-34. New requirements take the next free IDs (FR-34, FR-35, NFR-12); no ID is renumbered.
- **PCR-26 resolved by the product owner (2026-10-28).** FR-4 drops "or the agent closes them". A postponed question stays open until the user answers it, or until the agent marks it answered or deletes it (FR-6). No per-question close is added. PCR-27 and PCR-28 are already resolved by PCR-12 and PCR-13.
- **Addendum.** The question-card "Accept recommended" and "skip" leave the list of what is not in the first version (PCR-13, PCR-29). "How answers reach a working agent" is brought up to date (architecture change 2).
- **Architecture spine.**
  - Apply ACR-02 to ACR-13 by amending AD-2, AD-3, AD-4, AD-7, AD-8, AD-9, AD-10, AD-12, AD-14 and AD-20 in place. No new AD is added.
  - Add `@dagrejs/dagre` 3.1.3 to the Stack only if it passes the adoption rule (ACR-10).
  - Close the Deferred row for atoms, layouts, widget components, forms library and visual design, which the UX run settled.
  - Add the new requirement IDs to `binds:`.
- **Solution design.**
  - Mirror the spine changes where it explains them.
  - Add the UX run's checks S-1 to S-8 and its further spike items to the renderer spike (§10.3).
  - Mark §11's entries as applied or pending, and remove the UX owner from §12.
- **Not changed:**
  - NFR-6 and its licence exception (§11 entry 7) stay pending until the packaging spike (product owner, 2026-10-28), so AD-19's plain bundle on Node stays the starting path.
  - §11 entry 8 (AXFX NFR-1) is a contract change requested in the planning repository and stays pending there.
  - The withdrawn requests PCR-18, PCR-19 and ACR-01 are not applied.
  - The UX documents and the runs' `.memlog.md` files are not edited.
- **Repository records.** `docs/README.md`, `CLAUDE.md` and `README.md` stop listing the applied requests as pending.

## Capabilities

### New Capabilities

None. No capability spec exists yet: the PRD and the spine remain the requirement and architecture sources, and capability specs come with the epics. This change edits design documents only, so its `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- **Documents:**
  - `docs/prd-askboard-2026-10-25/prd.md` and `addendum.md`;
  - `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` and `SOLUTION-DESIGN.md`;
  - `docs/README.md`, `CLAUDE.md`, `README.md`.
- **No code.** No dependency is installed; ACR-10 only adds a pin to the planned Stack.
- **Unblocks** the four spikes (`SOLUTION-DESIGN.md` §10) and the first epics, which cite the updated IDs. The renderer spike gains its UX checks.
- **UX citations.** The UX spines keep citing "pending PCR-nn" and "pending ACR-nn". After this change those requests are applied, as `docs/README.md` records.
