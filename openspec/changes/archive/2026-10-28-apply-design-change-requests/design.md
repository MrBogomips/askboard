# Design

## Context

See `proposal.md`, Why. The inputs are three lists, each giving the decision, the places it touches and what the target must say:

- `docs/architecture-askboard-2026-10-27/SOLUTION-DESIGN.md` §11: the architecture's ten PRD changes;
- `docs/ux-askboard-2026-10-27/prd-change-requests.md`: PCR-01 to PCR-34, with section D (UX-owned, no PRD change) and section E (notes for architecture);
- `docs/ux-askboard-2026-10-27/architecture-change-requests.md`: ACR-01 to ACR-13 and the renderer spike checks S-1 to S-8.

The requests leave wording and placement to this pass. The UX spines (`DESIGN.md`, `EXPERIENCE.md`) hold the full behaviour behind each UX request. The PRD orders its FR IDs by section (FR-1 to FR-33 across §4.1 to §4.9), and NFR-1 to NFR-11 sit in §5. The spine binds through AD-1 to AD-22. The rules from `CLAUDE.md` apply: AD IDs stay stable, decisions are amended in place, nothing is renumbered, and folder names are kept.

## Goals / Non-Goals

**Goals:**
- Every request has one recorded outcome: applied (with its location), resolved, withdrawn, or pending (with the reason).
- The PRD, the addendum, the spine and the solution design agree with each other and with the UX spines.
- A reader of an amended FR or AD finds the rule there, not only in a UX file.

**Non-Goals:**
- Rewriting text that no request touches, or polishing the documents beyond the edits.
- Copying presentation detail into the PRD. Where a request says the detail is UX-owned (theme, density, layout set, strings), the PRD points to `ux-askboard-2026-10-27/EXPERIENCE.md`.
- Settling anything a spike decides: the renderer, the formula engine, the push transport, packaging and the licence exception.
- Writing capability specs (`skip_specs: true`). They come with the epics.

## Decisions

### 1. Placement follows each request's own target column, except for the choices below

Each request already names its PRD places or its ADs. This pass uses them, and decides only where a request leaves a choice:

| Request | Choice | Alternative rejected |
|---|---|---|
| PCR-03 ask title | Glossary "Ask", FR-1 (the ask model) and FR-24 (tab label) | FR-5, which is about item IDs |
| PCR-17 languages, PCR-20 settings | New §4.10 "Languages and settings" with FR-34 (UI languages, locale formats, per-ask language and its fallback, a new ask for a new language) and FR-35 (settings panel, user and project scopes, presentation preferences editable and applied at once, behavioural settings read-only and applied from the next session) | Inserting them under §4.6 or §4.8 out of numeric order |
| PCR-24 platform and accessibility | New NFR-12 "Desktop board and keyboard core": the viewport floor of about 1280px and the keyboard core. Theme and density stay UX-owned | Extending NFR-7, which is about operating systems |
| PCR-25 design principle | One paragraph in §1 Vision. No new journey or success metric: SM-1 already measures the plain single question, and the golden single-question case is in EXPERIENCE.md | A new single-question journey UJ-4 |
| PCR-26 | FR-4 drops "or the agent closes them (FR-6)": a postponed question stays open until the user answers it, or until the agent marks it answered or deletes it (FR-6) | Adding a per-question close to FR-6. The product owner chose against it on 2026-10-28 |
| PCR-29 decline | FR-4 becomes "Postponing and declining questions", since the two share their consequences; FR-18 adds the answer kind; FR-24 and the Glossary add the state | A separate FR |
| PCR-33 not in v1 | §8.2 Out of Scope for MVP | §6 Non-Goals, which lists what AskBoard never does |
| ACR-04 editor launch | A rule inside AD-8: only an explicit click launches it, the command comes from the settings, it starts as an argument vector, and the path is confined by AD-12. AD-14 adds the `editor` key | A new AD-23, which would carry a single rule |
| ACR-12 working signal | AD-2 (when a new board comes to the front) and AD-7 (the board-protocol message, presence only) | A new AD |
| ACR-02, ACR-07 configuration keys | AD-14 names every key the board shows (`theme`, `density`, `contextPlacement`, `defaultLanguage`, `editor`, the asking-rule and Snapshot-folder keys, the minimum-margin default); the schema lives in `contract` (AD-7) | Leaving the key names to the implementation |

So no new AD is added, and `openspec/config.yaml`'s "AD-1 to AD-22" stays true.

### 2. Requests that are not applied are recorded, not dropped

- PCR-18, PCR-19 and ACR-01 were withdrawn, and are recorded as withdrawn.
- PCR-27 and PCR-28 are recorded as resolved by PCR-12 and PCR-13.
- §11 entry 7 (NFR-6 licence exception) stays pending until the packaging spike, on the product owner's decision. AD-19 already ships the plain bundle on Node until the exception applies, so the spine needs no edit.
- §11 entry 8 (AXFX NFR-1) is a contract change requested in the planning repository, and stays pending there.

`SOLUTION-DESIGN.md` §11 gains a status per entry. A trace file in this change records the outcome and location of every request.

### 3. One trace file is the completeness check

`trace.md`, beside this design, has one row per request (§11 entries 1 to 10, PCR-01 to PCR-34, ACR-01 to ACR-13, S-1 to S-8): its outcome and the sections it landed in. It is filled in as each document is edited, and the final check compares it with the three input lists. This replaces tests, since the change has no code.

### 4. Each document is edited once, in dependency order

The PRD comes first, then the addendum, then the spine, then the solution design, and the repository records last. The spine's `binds:` and the solution design's citations then point to IDs that already exist. Frontmatter `updated:` becomes 2026-10-28 and `status: final` stays. The documents get no change log: the archived change is the record, and `docs/README.md` points to it.

### 5. The UX documents stay byte-identical

The UX spines cite "pending PCR-nn" and "pending ACR-nn". They are not edited: the transfer kept them byte-identical to the planning repository's final run, and a later UX update can refresh them. `docs/README.md` states that this change applied those requests.

### 6. dagre enters the Stack only after the adoption rule

ACR-10 asks for an adoption check first. The check uses the addendum's rule (licence, stars, activity) with data looked up when the task runs. If dagre fails, the pass stops and asks, because the UX's auto-layout depends on it.

## Risks / Trade-offs

- [A paraphrase drifts from the decision the UX run took] → Each edit works from the request row and from the EXPERIENCE.md or DESIGN.md section behind it. A review by a reviewer who did not make the edits compares each trace row with the edited text.
- [The edits grow the PRD and spine past what a reader can hold] → Behaviour goes into the PRD and rules into the spine. Presentation stays in the UX spines, cited by section.
- [Spikes started in parallel read the old text] → This change merges before the spike changes branch. Worktrees branch from `origin/main`.
- [dagre fails the adoption rule] → Stop and ask (decision 6).
- [The UX spines' "pending" citations read as stale] → `docs/README.md` records that this change applied the requests (decision 5).
