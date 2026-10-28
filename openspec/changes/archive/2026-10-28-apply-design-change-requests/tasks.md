# Tasks

## 1. Trace file

- [x] 1.1 Create `trace.md` in this change with one row per request: SOLUTION-DESIGN §11 entries 1 to 10, PCR-01 to PCR-34, ACR-01 to ACR-13, S-1 to S-8. Each row has the ID, an outcome (applied, resolved, withdrawn or pending) and the location. Pre-fill the decided outcomes: PCR-18, PCR-19 and ACR-01 withdrawn; PCR-26 resolved (design decision 1); PCR-27 and PCR-28 resolved by PCR-12 and PCR-13; §11 entries 7 and 8 pending (design decision 2). Verify that it has 65 rows.

## 2. PRD (`docs/prd-askboard-2026-10-25/prd.md`)

- [x] 2.1 Apply §11 entries 1 to 6, 9 and 10 (NFR-3, R1, FR-25 and Glossary "Ask", FR-5, §11 Assumptions, FR-29 and NFR-8, FR-19). Verify each amended passage against its entry, and fill in its trace row.
- [x] 2.2 Apply PCR-01 to PCR-16 to the requirements they name, and resolve PCR-26 in FR-4 (design decision 1). Verify each amended passage against the request row and the EXPERIENCE.md section behind it, and fill in the trace rows.
- [x] 2.3 Add §4.10 with FR-34 (PCR-17) and FR-35 (PCR-20), NFR-12 (PCR-24), the §1 Vision principle (PCR-25) and the §8.2 entries (PCR-33), as placed in design decision 1. Each new requirement has testable consequences, as the existing FRs do. Verify that §4's introduction and §8.1 In Scope list the new section, and fill in the trace rows.
- [x] 2.4 Apply PCR-21 to PCR-23, PCR-29 to PCR-32 and PCR-34 to the requirements they name (FR-2, FR-3, FR-4, FR-7, FR-11, FR-12, FR-13, FR-15, FR-18, FR-21 to FR-24, NFR-1, SM-1, R1, R4), with FR-4's new title. Verify against the request rows and fill in the trace rows.
- [x] 2.5 Update the Glossary (ask title, the answered state with postponed and declined questions, decline), check that §0's AXFX coverage still holds (no request touches FR-36 to FR-41), and set `updated: 2026-10-28`. Verify with a script that every FR, NFR, SM and R ID cited in `prd.md` is defined in it.

## 3. Addendum (`docs/prd-askboard-2026-10-25/addendum.md`)

- [x] 3.1 Remove the question-card "Accept recommended" and "skip" from the list of what is not in the first version (PCR-13, PCR-29). Bring "How answers reach a working agent" up to date (§11 entry 2). Set `updated: 2026-10-28`. Verify both passages, and add the addendum to the trace rows of PCR-13, PCR-29 and §11 entry 2.

## 4. Architecture spine (`docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`)

- [x] 4.1 Apply ACR-02, ACR-03 and ACR-04: in AD-14, the board's write path for presentation preferences and every configuration key from design decision 1; in AD-8, the `frame-ancestors 'self'` exception for the source view and the editor-launch rule. Verify against the ACR rows and fill in the trace rows.
- [x] 4.2 Apply ACR-05, ACR-08 and ACR-11 to AD-10 and AD-20: the "question reopened by the user" event, `declined` as an answer kind and a terminal state with the new "answered" condition, and the extended draft record. Verify against the ACR rows and fill in the trace rows.
- [x] 4.3 Apply ACR-06, ACR-07 and ACR-13 to AD-7, AD-9, AD-12 and AD-14: the optional title, display name, language and locale; the minimum margin with its project default; Diff review alternatives as patch files read at send time; the reserved prefix for view-made IDs. Verify against the ACR rows and fill in the trace rows.
- [x] 4.4 Apply ACR-09 to AD-3 and AD-4 (the board learns when an answer passes the `received` watermark), and ACR-12 to AD-2 and AD-7 (the working signal and the bring-to-front rule). Verify against the ACR rows and fill in the trace rows.
- [x] 4.5 Run the adoption check of `@dagrejs/dagre` 3.1.3 against the addendum's rule (licence, stars, activity), with data looked up now and cited with its date. If it passes, add it to the Stack pins (ACR-10). If it fails, stop and ask the product owner (design decision 6). Record the result in the ACR-10 trace row.
- [x] 4.6 Remove the Deferred row for atoms, layouts, widget components, forms library and visual design, now settled by the UX run. Add FR-34, FR-35 and NFR-12 to `binds:` where the spine relies on them, and set `updated: 2026-10-28`. Verify with a script that every AD, FR and NFR ID cited in the spine exists in the spine or the PRD.

## 5. Solution design (`docs/architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`)

- [x] 5.1 Update the sections that explain the amended ADs: §3.2 and §4 where they restate AD-2, AD-3, AD-4, AD-7, AD-8, AD-9, AD-10, AD-12, AD-14 and AD-20, and the §5 key flows. Verify that no passage contradicts the amended spine, and list the touched sections in the trace rows.
- [x] 5.2 Add the UX run's checks S-1 to S-8, and the further spike items (`@pierre/diffs` highlighting under the CSP, Mermaid text measurement with its injected styles blocked, PlantUML render time in the golden single-question case), to the renderer spike in §10.3. Verify against the ACR file's spike section, and fill in the S-1 to S-8 trace rows.
- [x] 5.3 Give each §11 entry a status (applied on 2026-10-28 by this change; entry 7 pending until the packaging spike; entry 8 pending in the planning repository). In §12, remove the UX owner row and add the licence decision to the product owner's items. Add dagre to §9's component table if 4.5 passed, and set `updated: 2026-10-28`. Verify by reading §9, §11 and §12.

## 6. Repository records

- [x] 6.1 In `docs/README.md`, replace "Pending at transfer" with what this change applied and what stays pending (§11 entries 7 and 8). State that the UX spines' "pending PCR-nn" and "pending ACR-nn" citations now refer to applied requests (design decision 5). Verify by reading the section.
- [x] 6.2 Update the status lines in `CLAUDE.md` and `README.md`. Verify with grep that no file outside `docs/ux-askboard-2026-10-27/` and the archived change still calls an applied request pending.

## 7. Integration checks

- [x] 7.1 Compare `trace.md` with the three input lists. Verify that every ID is present with an outcome and a location, and that no row is blank.
- [x] 7.2 Run a review by a reviewer who did not make the edits: one pass per document, each trace row compared with the edited text, and the PRD, the spine and the UX spines checked for contradictions. Fix the findings and record them, with their outcomes, in `trace.md`. Verify that no finding is left open.
- [x] 7.3 Run `openspec validate --all --strict --no-interactive` and verify that it passes. Scan the changed files for AI-tool names used as author, and for AI or session URLs, and verify that none is found.

## Workflow follow-up

- Commit on the change branch, push it, open a pull request to `main`, check CI, and merge.
- After the merge, archive the change with `/opsx:archive`.
