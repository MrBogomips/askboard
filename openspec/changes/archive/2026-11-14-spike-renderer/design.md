# Design

## Context

See proposal.md for the motivation. The question and the six exit criteria are in SOLUTION-DESIGN §10.3, the UX checks S-1 to S-8 in `docs/ux-askboard-2026-10-27/architecture-change-requests.md`, and the components the UX chose in EXPERIENCE.md, Composition and Components, which binds this spike. The design relies on these rules:

- **AD-1:** `widgets` imports only `contract`, `compute` and `view`'s `CatalogRenderer` port; no widget imports the renderer library (AD-9).
- **AD-8:** the view is a `srcdoc` iframe with exactly `sandbox="allow-scripts"`, so it has an opaque origin. Its meta CSP applies together with the board page's policy, which the srcdoc inherits [F29]: `default-src 'none'`; scripts and styles only by the hashes of the inlined chunks; `img-src data: blob:`; `font-src data:`; `connect-src`, `object-src`, `frame-src`, `form-action` and `base-uri` all `'none'`; `'wasm-unsafe-eval'` only for a WASM formula engine; never `'unsafe-eval'`, `'unsafe-inline'` or `'unsafe-hashes'`; no storage. A hash-only `style-src` blocks `style` attributes and injected `<style>` elements [F30]. Diagram SVG is shown as `<img src="blob:…">`.
- **AD-9:** components render from the board document, the draft record and the compute graph alone, keep no edit state and report ready once their async work has settled and their content has been laid out once. The build publishes a manifest (a shell chunk and one chunk per component, each with its SHA-256, styles and licence notices), and one `assemble(boardDocument, manifest)` builds both a board's srcdoc and every Snapshot.
- **AD-15 and AD-20:** a Snapshot is assembled from the board document and the log; the draft record holds every edit.
- **AD-19:** the adoption rule (licence, stars, activity) for every dependency, pinned exactly; the supported browsers are the current and previous majors of Chrome, Edge, Firefox and Safari.

What exists: `packages/view` and `packages/widgets` have empty entry points (`view` exports `.`, `./assemble` and `./catalog`); the spine's Consistency Conventions plan browser tests in Chromium, Firefox and WebKit. On 2026-10-29 the npm registry still shows every version §9 names, and it shows facts the spike must weigh: Mermaid 12.2.0 declares `elkjs` ^0.9.3 and `katex` ^0.18.0 as dependencies; `@plantuml/core` 1.2026.9 ships `plantuml.js` (3.4 MB), `viz-global.js` (1.4 MB), `emoji.js`, `themes.js` and a vendored `fflate`; `@pierre/diffs` 1.6.2 depends on `shiki` (^3 or ^4) and `hast-util-to-html`; `@json-render/core` depends on `zod` ^4; `@modelcontextprotocol/ext-apps` 2.0.4 has the SDK v2 packages and `zod` as peers. These are registry observations; the spike measures their effect.

## Goals / Non-Goals

**Goals:**

- A verdict for each exit criterion, each S-check and each further item, per browser engine, backed by runs that someone else can repeat with one command.
- A renderer recommendation, json-render or AskBoard's own, from a measured comparison.
- Sizes per chunk, per board and per Snapshot, and the golden case's time to visible with its PlantUML share.
- A spine update draft that the product owner can accept row by row.

**Non-Goals:**

- Product code: `packages/view` and `packages/widgets` are built in the epics on the decisions recorded here. The probe is not a starting point for them.
- The board protocol, `board-host`, tokens, the reading panel and the source view: the board-page stand-in only frames the view and relays its messages.
- The formula engine (§10.2): the compute graph is a static stand-in, and the view CSP gets no `'wasm-unsafe-eval'` for it.
- Visual design fidelity: components use the DESIGN.md tokens, but the look is judged only where a task asks the product owner.
- Previous browser majors, native Windows and WSL. The previous majors are recorded as untested.
- Accessibility beyond what an S-check or a UX spike item needs.

## Decisions

### 1. A probe package in the change, outside the workspace, with exact pins

`probe/` has its own `package.json`, `bun.lock` and `bunfig.toml` (`linker = "isolated"`, `exact = true`, as at the root), and a `tools/licence-overrides.json` holding `[]`. The repository's licence check then runs against it unchanged: `GITHUB_TOKEN=$(gh auth token) bun tools/check-licences.ts openspec/changes/spike-renderer/probe`, from the repository root. A licence it flags is a finding, never an override. `probe/tools/adoption.ts` reads the stars, last push, last release and archived flag of every direct dependency from the npm registry and the GitHub API and writes `evidence/adoption.json`.

No file in `probe/` is named `*.test.*`, `*_test.*` or `*.spec.*`, because the root `bun test` would discover it. Biome already ignores `openspec/`, and the root `tsc` covers only `packages/` and `tools/`, so the root `bun run check` stays as it is. `probe/.gitignore` keeps `node_modules/`, `dist/` and `runs/` out of git.

Planned pins, with their adoption status read on 2026-10-29 (task 1.2 reads them again on the run date):

| Package | Pin | Role | Licence, stars, last push, last release | Status |
| --- | --- | --- | --- | --- |
| `react`, `react-dom` | 19.3.1 | View runtime (Stack pin) | MIT, 251,733, 2026-10-29, 2026-10-14 | Pass |
| `@json-render/core`, `@json-render/react` | 0.21.3 | Candidate renderer | Apache-2.0, 18,842, 2026-10-29, 2026-10-24 | Pass (0.x) |
| `zod` | 4.6.7 | json-render's peer | MIT, 44,224, 2026-10-28, 2026-10-12 | Pass |
| `mermaid` | 12.2.0 | Diagram | MIT, 90,921, 2026-10-29, 2026-10-13 | Pass; elkjs inside (S-1) |
| `@plantuml/core` | 1.2026.9 | Diagram | npm tarball MIT (repository LGPL-3.0), 13,385, 2026-10-29, 2026-10-17 | Pass on the tarball; vendored files checked (task 3.2) |
| `@pierre/diffs` | 1.6.2 | Diff review | Apache-2.0, 6,384 (`pierrecomputer/pierre`), 2026-10-29, 2026-10-26 | Pass; `shiki` 4.5.0 (MIT, 13,898, 2026-10-01) inside |
| `@rjsf/core`, `@rjsf/utils` | 6.11.0 | Form | Apache-2.0, 15,924, 2026-10-29, 2026-09-29 | Pass |
| `@rjsf/validator-ajv8` | 6.11.0 | Negative control for S-4 only, in no product chunk | Same repository | Pass |
| `radix-ui` | 1.8.1 | Input atoms; Dialog (S-6) | MIT, 19,442, 2026-10-14, 2026-10-14 | Pass |
| `react-day-picker` | 10.0.2 | Date Picker's calendar | MIT, 6,863, 2026-10-21, 2026-09-30 | Pass |
| `markdown-it` | 15.0.3 | Markdown | MIT, 22,018, 2026-10-23, 2026-10-16 | Pass |
| `dompurify` | 3.4.17 | Sanitizer | MPL-2.0 OR Apache-2.0, 17,494, 2026-10-24, 2026-10-12 | Pass |
| `katex` | 0.19.1 | LaTeX | MIT, 20,479, 2026-10-29, 2026-10-23 | Pass |
| `mathlive` | 0.111.1 | LaTeX editing (optional in the UX) | MIT, 2,191, 2026-10-23, 2026-10-09 | Pass |
| `@tanstack/react-table` | 9.3.1 | Table, Tree, Spreadsheet, the Gantt's grid | MIT, 28,533, 2026-10-21, 2026-10-12 | Pass |
| `@atlaskit/pragmatic-drag-and-drop` | 4.0.0 | Ranking, Kanban, Tree | npm Apache-2.0, 12,789, 2026-10-29, 2026-09-24 | Pass |
| `echarts` | 6.1.0 | Chart | Apache-2.0, 67,631, 2026-10-13, 2026-05-19 | Pass |
| `@xyflow/react` | 12.12.0 | Graph | MIT, 38,821, 2026-10-29, 2026-10-11 | Pass |
| `@dagrejs/dagre` | 3.1.3 | Graph layout | MIT, 5,842, 2026-10-24, 2026-10-24 | Pass |
| `@modelcontextprotocol/ext-apps` | 2.0.4 | View message set (`App`, `AppBridge`) | npm MIT, 3,026, 2026-10-29, 2026-10-27 | Pass; its peers `@modelcontextprotocol/core`, `client` and `server` pinned at 2.4.0 (Apache-2.0) |
| `tailwindcss`, `@tailwindcss/cli` | 4.3.3 | Build-time styles | MIT, 98,009, 2026-10-19, 2026-10-19 | Pass |
| `@fontsource/inter`, `@fontsource/jetbrains-mono` | 5.3.0 | Font files to inline | OFL-1.1; package repository `fontsource/font-files` 508 stars (project `fontsource/fontsource` 6,249) | Open: the licence check's list has no OFL-1.1, and the package repository is under 1,000 stars. The product owner decides the fonts' licence and source (task 8.1) |
| `playwright` | 1.64.1 | Browser driver, in no chunk | Apache-2.0, 98,816, 2026-10-29, 2026-10-29 | Pass |

Alternative considered: adding the probe's dependencies to `packages/view`. That would change the root lockfile and product code before the decisions they depend on, so it was rejected.

### 2. A harness that reproduces the board page, the sandbox and both policies

- **Board-page stand-in** (`board.ts`): `Bun.serve` on `127.0.0.1`, random port. It serves `/b/<fixture>` with the board page's CSP as an HTTP header (scripts and styles by hash, the view chunks' hashes, `connect-src 'self'`, `frame-src 'self'`, as AD-8 states), and a page script that fetches the assembled view document, marks `t0`, sets it as the `srcdoc` of an iframe with exactly `sandbox="allow-scripts"`, and relays the view's messages to the driver. The srcdoc inherits this policy, and AD-8 names no image or font source for it: the stand-in starts from AD-8's text as written, so a blocked `blob:` image or `data:` font there is a finding for AD-8, not a harness fix.
- **View shell instrumentation**, the first inline script: a `securitypolicyviolation` listener; `error` and `unhandledrejection`; wrappers on `localStorage`, `sessionStorage`, `indexedDB`, `caches` and `document.cookie` that record the access and let the browser's own error through; wrappers on `Worker` and `SharedWorker`; the ready tracker. Everything goes to the board page by `postMessage`.
- **Attribution:** a component fixture holds one component, so a violation belongs to it. A **control run** loads the same fixtures in a page with no CSP and no sandbox, to tell a component bug from a CSP failure.
- **Driver** (`drive.ts`, Playwright): `bun drive.ts <run> [--fixtures a,b] [--engines chromium,firefox,webkit,chrome,msedge] [--repeat N] [--control] [--snapshot] [--color-scheme light|dark]`. `chromium`, `firefox` and `webkit` are Playwright's builds, the CI engines; `chrome` and `msedge` are the installed branded browsers, through Playwright's channels. For each fixture and engine, in a fresh context, it waits for "question visible" or 30 s, then collects the violations (directive, blocked URI, sample), console errors, every request other than the stand-in's own, storage and worker accesses, ready times and a screenshot. It writes `runs/<run>/<engine>/<fixture>.json` and `.png`, and `runs/<run>/summary.json`. `bun drive.ts versions` only opens each engine and prints its version.
- **Timing:** `performance.timeOrigin + performance.now()` on both sides, so the board page's `t0` and the view's ready times share one clock.
- **Verdict rule** per component and engine: **pass** when the CSP run has no violation, no request, no storage or worker error, reports ready, and shows the fixture's expected elements (each fixture names a selector and a value to check); **pass with change** when it passes only after a named configuration change; **fail** otherwise; **untested**, with the reason. A blocked `'unsafe-eval'` probe that a library catches while the component still works (for example `zod` testing for `new Function`) is recorded as a caught probe, and the product owner decides whether CI may tolerate it.

### 3. Chunks are classic inline scripts by hash, with the shared runtime in the shell

In an opaque `srcdoc` document under `default-src 'none'`, nothing loads by URL: modules cannot import each other, and `data:` or `blob:` script sources are outside the policy. So every chunk is a classic inline `<script>` allowed by its hash.

- The **shell** holds React, ReactDOM, the `CatalogRenderer` stand-in, the ready tracker and the instrumentation, and exposes them on one global.
- Each **component chunk** is an IIFE built with `Bun.build` (`format: "iife"`, `target: "browser"`, minified), with the shell's packages mapped to that global by a build plugin. It registers its components with the port.
- Code used by more than one component (Radix, TanStack Table, Pragmatic drag and drop) goes into **library chunks**. A component chunk lists the chunks it needs, and `assemble` inlines the closure. The size criterion also measures the alternative, a copy per chunk.
- **Styles:** Tailwind 4.3.3 builds the shell stylesheet (DESIGN.md's tokens, light and `-dark`, as CSS variables, the `.dark` switch, the base layer, the fonts as `data:` URLs) and each chunk's stylesheet from that chunk's sources only; a library's own CSS (xyflow, KaTeX) goes into its chunk's stylesheet. Each is one `<style>` element allowed by its hash.
- **Licence notices:** the build's input files (Bun's metafile) are mapped to their packages, and each chunk lists the licence texts of the packages it contains.
- **Manifest** (`dist/manifest.json`): per chunk, its name, kind (shell, library, component), the chunks it needs, the SHA-256 of its script and style, raw and gzip bytes, and its notices. `bun run build` writes it; `assemble.ts` builds a board's srcdoc or a Snapshot file from a board document and the manifest, with the `askboard-data` block.

Alternatives considered: one bundle holding everything, which fails "inlining only the chunks a board uses"; ES modules with an import map of `data:` or `blob:` URLs, which needs `script-src data:` or `blob:`, which AD-8 forbids.

### 4. Two renderers behind one port, compared on measurements

- **The port stand-in:** a component receives `{ item, draft, graph, emit, ready }`: its item from the board document, its slice of the draft record, the compute graph's values (static), `emit` for typed view messages, and `ready()`. Components import nothing but the port and their own library; `tools/imports.ts` in the probe checks `components/` for that (AD-1's rule for `widgets`).
- **json-render adapter:** maps the board document's item tree to json-render's flat spec (`root`, `elements`) and registers every component in one json-render catalog and registry. json-render's state is bound to the draft record, so every edit becomes a draft update and json-render holds no state of its own; task 2.2 finds out whether its `StateProvider` allows that.
- **Own renderer:** a recursive React render of the item tree through a registry keyed by item type.
- **Criterion 2**, scripted per renderer in the driver: determinism (two renders of one input give the same DOM); no edit state (an edit, then an unmount and a remount from the draft record, gives the same DOM and values); no network (no request, no `connect-src` violation); ready after async work (a fixture with a delayed item reports ready only after the work settled, and the item's box is unchanged 1 s after ready).
- **Compared on:** criteria 1 and 2; the renderer's bytes, raw and gzip; the adapter's lines of code; render time of a 200-item board; json-render's API churn over its 0.x releases of the last 12 months (breaking changes per minor, from its changelog); the adoption status. The product owner chooses (task 8.3).

### 5. Diagrams render to an SVG string, then to a `blob:` image

- **Mermaid** runs with `htmlLabels: false`, `securityLevel: 'strict'` and the `base` theme with DESIGN.md's diagram `themeVariables`, light and dark. The build replaces `elkjs` with an empty module (S-1); its absence is checked in the build's input list and by searching the chunk.
- **PlantUML** comes from the npm tarball only, and its chunk holds only the files a diagram type needs. The spike finds which types need `viz-global.js` (Graphviz) and whether that needs `'wasm-unsafe-eval'`, which AD-8 admits only for a WASM formula engine. It reads the licence of every file it inlines: the tarball's LICENSE, the code vendored in `viz-global.js`, and `vendor/`.
- **Both:** the render becomes an SVG string; the hit map of the annotation overlay (EXPERIENCE.md, Annotation overlay, step 2) is taken from it; the SVG is shown as `<img src="blob:…">` (criterion 4). For criterion 5, the welcome image (an empty source) and the error images (a source with a syntax error) are rendered, and the SVG is searched for embedded images and sponsor text. The suppression is a renderer option if one exists, otherwise a filter on the SVG before it becomes a blob.
- **Mermaid text measurement:** Mermaid measures labels in a live SVG whose injected `<style>` the CSP blocks, so a label may be sized in a fallback font while the `<img>` draws it in the theme font. Each label's text extent is compared with its box under the CSP and in the control run. Mitigations, tried in order: a rule in the hashed shell stylesheet that sets the diagram font on Mermaid's measurement container; the font set through the CSSOM, which the CSP allows; `fontFamily` in Mermaid's configuration aligned with the shell font.
- **Snapshots** carry a light and a dark render of every diagram (DESIGN.md, Dark theme mechanism). Two options are measured: the renderer chunk inlined, rendering at open, or the two SVG renders as data, with no renderer chunk.
- **Render time** in the golden case: 20 cold loads per engine, from `t0` to the diagram's ready and to the question visible; and the re-render after the golden flow's source edit (step 4).

### 6. Component checks, one fixture each

Each component of EXPERIENCE.md, Composition and Components, and each library behind the input atoms gets a fixture with a realistic minimum: one rendered instance and one user action. The S-checks add:

- **S-4:** the no-op validator with errors passed as `extraErrors`; `@rjsf/validator-ajv8` as a negative control, whose compile the CSP should block.
- **S-6:** Radix Dialog and Alert Dialog as modals: what the blocked scroll-lock `<style>` breaks (scroll lock, focus trap, Esc), and the non-modal variant.
- **S-7:** RJSF with `tagName="div"` and no submit button, Enter not submitting; a `<form>` as a negative control, whose submission the sandbox blocks.
- **S-8:** picks as `enum` with `ui:enumNames`, single (radios and Select) and multiple (checkboxes), with the values they return. `pattern-check.ts` implements the safe `pattern` subset as a send-time check with no DOM, Node-only or Bun-only API, as `ask-core` will need. It runs under Bun on a fixture list of accepted and refused patterns, each refusal naming the item ID, and the accepted patterns then run in the view with `RegExp` under the CSP.
- **S-5:** the storage audit from the shell's wrappers in every fixture, the `.dark` class switch, and the registry dates of cmdk and next-themes. **S-2 and S-3:** registry and GitHub facts on the run date, with no install.
- **`@pierre/diffs`:** highlighted tokens as classes mapped to DESIGN.md's five `syntax-*` tokens, with no inline style and with Shiki's JavaScript regex engine rather than its WASM one. If no configuration passes, highlighting is off in the first version, as DESIGN.md allows.
- **UX spike items:** native drag of Pragmatic drag and drop in the sandboxed frame, automated in every engine and then tried by the product owner in installed browsers; whether a click on an unset Slider's track sets a value.
- **KaTeX:** rendered through its DOM API, whose styles go through the CSSOM; `renderToString` with `innerHTML` as a negative control.

### 7. Sizes come from the manifest and the assembled files

`tools/sizes.ts` writes `evidence/sizes.json`: each chunk, raw and gzip; three boards (the golden case; a UJ-1-like board with Diff review, Graph and a Markdown excerpt; a board with every component), as srcdoc and as Snapshot; library chunks against copies; the fonts' share; the two Snapshot diagram options.

### 8. Platforms and browsers

macOS for every check: Playwright's Chromium, Firefox and WebKit, plus the installed Chrome and Edge. Playwright cannot drive Safari, so the product owner opens the golden board in Safari (task 6.2). The browsers install into `PLAYWRIGHT_BROWSERS_PATH=<scratch>/ms-playwright`, not the user's cache. Linux is an optional last group: Playwright's image `mcr.microsoft.com/playwright:v1.64.1-noble` with Bun 1.4.4 added and the probe mounted read-only (NFR-7).

### 9. Findings, decisions and the spine update

As in `spike-mod-delivery`: `findings.md` holds one row per criterion, check and engine with its verdict and evidence, plus the comparison and size tables. Raw runs stay in `probe/runs/`, which git ignores; summaries and the screenshots the product owner judges go to `evidence/`. Proposed outcomes and `spine-update-draft.md` are written before any `docs/` edit; the product owner decides each outcome; amendments go into the spine in place, with AD IDs stable. Validation is `openspec validate --all --strict --no-interactive`, plus `bun run check` to show that nothing outside the change was touched.

## Risks / Trade-offs

- **[Playwright under Bun 1.4.4 fails]** → the driver runs on Node 24 with type stripping (`node drive.ts`); `findings.md` records which runtime ran it.
- **[Playwright's engines are not the branded browsers, and Safari cannot be driven]** → the `chrome` and `msedge` channels run too, and the product owner checks the golden board in Safari.
- **[CSP behaviour differs per engine]** (a meta policy in a srcdoc, the inherited policy) → negative fixtures prove that each engine reports each kind of violation, including a chunk hashed in the view's policy but missing from the board page's, before any component verdict counts.
- **[Caught feature probes produce violations]** → they are classified separately, and the product owner decides whether CI tolerates them.
- **[A multi-megabyte srcdoc]** (PlantUML alone is 3.4 MB of script) → time to visible is measured per engine; a slowdown or a limit is a finding, and the Snapshot options are measured.
- **[Automated drag differs from a person's]** → the product owner drags at the keyboard in installed browsers.
- **[The registry moves during the spike]** → pins are exact, and task 1.2 records the status on the run date.
- **[Breadth: about twenty components]** → one generic fixture runner and minimal fixtures; depth only where §10.3 or an S-check asks for it.
- **[Browser downloads fail]** → that engine is untested, with the reason, and the run continues on the others.

## Migration Plan

None: no shipped behaviour changes. When the change is archived, `probe/`, `evidence/` and `findings.md` stay in the archive as evidence. Nothing in the probe is referenced from `packages/`.

## Open Questions

- The question-loading time limit (EXPERIENCE.md, Component Patterns, Question loading: not recorded) and an absolute budget for the board's share of SM-3 are set in the `view` epic and by the benchmark. The spike gives the measurements.
