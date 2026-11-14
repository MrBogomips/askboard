# Proposal

## Why

AD-9 puts every atom, layout and widget behind one `CatalogRenderer` port but leaves open what stands behind it: json-render 0.21.3 or AskBoard's own renderer. It also assumes that Mermaid and PlantUML render inside the view bundle under AD-8's view CSP (hash-only scripts and styles, no `'unsafe-inline'`, no network, no storage). Choosing components for the final UX documents turned up eight facts that contradict SOLUTION-DESIGN §9 or that CSP (S-1 to S-8 in `docs/ux-askboard-2026-10-27/architecture-change-requests.md`). Until these are settled, the `view` and `widgets` epics cannot pick their pins, and the golden single-question case, whose PlantUML render counts towards "visible" (SM-3, SM-C2), has no measured cost. So the renderer spike runs in phase 1, beside the mod delivery spike (SOLUTION-DESIGN §10.3), and ends in a spine update.

## What Changes

- **A probe**, kept in this change under `probe/` as evidence and not shipped. It is a package of its own, outside the Bun workspace, with its own lockfile and every dependency pinned exactly to a version that meets the adoption rule; it builds with Bun 1.4.4. It has:
  - a build that publishes a manifest as AD-9 describes it (a shell chunk and one chunk per catalog component, each with its SHA-256, its styles and its licence notices), and an `assemble` stand-in that builds a board's `srcdoc` and a Snapshot file, with AD-8's CSP, inlining only the chunks a board uses;
  - a board-page stand-in served on `127.0.0.1` with the board page's CSP, which frames the view as a `srcdoc` iframe with exactly `sandbox="allow-scripts"`;
  - the two candidates behind a `CatalogRenderer` stand-in: `@json-render/core` and `@json-render/react` 0.21.3, and an own renderer;
  - fixtures: the golden single-question case (EXPERIENCE.md, Key Flows), Mermaid and PlantUML diagrams, a Form with picks, a diff, and one fixture per component the UX chose (EXPERIENCE.md, Composition and Components);
  - a browser driver that loads each fixture in Chromium, Firefox and WebKit and records CSP violations, console errors, network requests, storage access, ready times and screenshots.
- **Runs** of §10.3's six exit criteria:
  1. everything runs under the view CSP with no `'unsafe-inline'` or `'unsafe-hashes'`, CSS-in-JS included;
  2. components meet AD-9: they render from the board document, the draft record and the graph alone, keep no edit state, and report ready after their async work settles;
  3. Mermaid and PlantUML render inside the bundle, with no Java, server or network;
  4. diagram SVG is shown as `blob:` images;
  5. PlantUML's sponsored-message images are suppressed;
  6. bundle size and Snapshot size, inlining only the chunks a board uses.
- **Runs of the UX checks S-1 to S-8:** S-1 Mermaid 12.2.0 and elkjs; S-2 react-arborist and react-dnd; S-3 vis-timeline and `@egjs/hammerjs`; S-4 form validation under the CSP; S-5 cmdk, next-themes and storage in the view; S-6 the Radix Dialog scroll-lock `<style>`; S-7 no `allow-forms`, so RJSF renders with `tagName="div"`; S-8 Form picks as `enum` with `ui:enumNames`, and the safe `pattern` subset checked when the ask is sent.
- **Runs of §10.3's further items:** `@pierre/diffs` syntax highlighting under the CSP; Mermaid text measurement when its injected styles are blocked; PlantUML render time in the golden single-question case. Also the items EXPERIENCE.md hands to the spike: native drag inside the sandboxed frame, the Slider's unset state, and a storage audit of every component at start-up.
- **`findings.md`**: each criterion and check with its verdict per browser engine and its evidence (the run, violation excerpts, timings, sizes); the renderer comparison; the chunk and Snapshot sizes; the golden case's time to visible. Screenshots the product owner must judge go under `evidence/`.
- **Spine update**, in this change, decided by the product owner on the findings:
  - Deferred: the catalog renderer row closes.
  - Stack: json-render gains a pin if it wins; Mermaid, `@plantuml/core` and the view components that pass gain theirs.
  - ADs amended in place where a finding requires it: AD-8 (a CSP source a component needs, or a component dropped), AD-9 (the chunk format, how a Snapshot carries diagrams, the ready rule).
  - SOLUTION-DESIGN: §9 (the status table, S-1 to S-5), §10.3 (the outcome), §12 and §13 (new facts).
  - UX documents, only where a component choice changes: EXPERIENCE.md, Composition and Components; DESIGN.md, Syntax highlighting (highlighting on or off in the first version).
  - PRD addendum, only if the product owner decides a licence question the spike raises (for example, the fonts' OFL-1.1 licence or a file vendored inside `@plantuml/core`).

## Capabilities

### New Capabilities

None. The spike settles a component choice and facts, and implements no product behaviour, so `.openspec.yaml` sets `skip_specs: true`. The `view` and `widgets` capability specs come with the epics that build them, on the decisions recorded here.

### Modified Capabilities

None.

## Impact

- **New, in this change:** `probe/` (build, `assemble` stand-in, board-page stand-in, view shell, the two renderers, components, fixtures, driver, its own `package.json`, `bunfig.toml` and `bun.lock`), `findings.md`, `evidence/`, `spine-update-draft.md`.
- **Changed after the product owner's decisions:** `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (Deferred, Stack, AD-8 and AD-9 as the findings require), `SOLUTION-DESIGN.md` (§9, §10.3, §12, §13); `docs/ux-askboard-2026-10-27/EXPERIENCE.md` and `DESIGN.md` only where a component choice changes; `docs/prd-askboard-2026-10-25/addendum.md` only for a licence decision.
- **No product code, no repository dependency:** nothing under `packages/` changes, and the root `package.json` and `bun.lock` stay as they are. The browser engines install into the spike's scratch directory, outside the repository and the user's browser cache.
- **Invariants:** the probe follows MIT and the adoption rule (NFR-6, AD-19), makes no outbound connection from the view (NFR-9, AD-8), shows agent content only as data in the sandboxed view (NFR-5, AD-8), and runs on macOS, with an optional Linux run (NFR-7).
- **Requirements and decisions served:** FR-11, FR-13, FR-15, FR-26, FR-27, FR-33, NFR-5, NFR-6, NFR-7, NFR-9, SM-3, SM-C2, R6; AD-1, AD-7, AD-8, AD-9, AD-15, AD-19, AD-20.
- **Gates:** the `view` and `widgets` epics build on the outcome; the widgets built first (SOLUTION-DESIGN §3.1: Tree with WBS with PERT, Gantt with the Gantt plan) take their components from the Stack pins this spike confirms.
