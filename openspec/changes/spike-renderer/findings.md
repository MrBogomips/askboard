# Findings: renderer spike

The exit criteria are in SOLUTION-DESIGN §10.3, the UX checks S-1 to S-8 in `docs/ux-askboard-2026-10-27/architecture-change-requests.md`, and the approach in `design.md`. Raw runs stay in `probe/runs/<run>/`, which git ignores: one JSON file and one screenshot per load, and `summary.json`. Every verdict below names its run. Commands run from `probe/` unless they say otherwise.

## Verdicts

One row per exit criterion of SOLUTION-DESIGN §10.3, S-check, further item and UX spike item, and one for the renderer comparison. Verdicts:

- **pass:** holds as the design assumed;
- **pass with change:** holds once the change named in "Proposed outcomes" is made;
- **fail:** fails with every change measured;
- **awaiting PO:** the runs are done, and the verdict needs the PO's judgement (tasks 6.1, 6.2 or 8.3);
- **untested:** with the reason.

"Chrome, Edge" are the installed browsers, driven through Playwright's channels. **Linux** is task 7.1: Ubuntu 24.04.5 on arm64, in Docker on this Mac, with Playwright's Chromium, Firefox and WebKit. Wherever a run went on Linux, it matched macOS. x86-64 Linux, and Chrome and Edge on Linux, are untested (§ Linux).

| # | Item | Chromium | Firefox | WebKit | Chrome, Edge | Linux | Verdict | Section |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Criterion 1: everything under the view CSP, no `'unsafe-inline'` or `'unsafe-hashes'` | The own renderer, and json-render with `jitless`: pass (`renderers`). Every component but Radix Select: pass as written or with a named change (`matrix`, `matrix-media`). The diagrams: pass with the style shim (`mermaid-shim`, `plantuml-shim`) | as Chromium | as Chromium | as Chromium | the 33 component fixtures: the same verdicts in all 99 loads (`linux-matrix`) | pass with change (rows 4, 5, 12, 13, 14, 16, 17, 18) | [§ Criterion 1](#criterion-1-components-under-the-view-csp-task-41), [§ Diagram style writes](#diagram-style-writes-under-the-view-csp-criterion-1-the-diagrams-share) |
| 1a | Criterion 1, Radix Select | fail: 2 `style-src-elem`; 1 with the style-element shim (`c-select`, `c-select-shim`) | fail as written; pass with the shim | fail: 1 more, a `style-src-attr` for its hidden native `<select>`; 1 left with the shim | fail, as Chromium | the same (`linux-matrix`) | **fail** (row 6) | [§ Criterion 1](#criterion-1-components-under-the-view-csp-task-41) |
| 2 | Criterion 2: AD-9's rules for components | own, json-render, json-render-jitless: pass (`c2`) | pass | pass | pass | untested: not run on Linux | pass, for both renderers. The Form's RJSF was not put through it (row 23) | [§ Criterion 2](#criterion-2-task-22) |
| 3 | Criterion 3: Mermaid and PlantUML inside the bundle, no Java, server or network | pass: no request in 330 loads (`c3c4`, `c3c4-snapshot`, `c3c4-blob` and the diagram runs), with AskBoard's refusing PlantUML loader | pass | pass | pass | pass (`linux-c3c4`, `linux-c3c4-blob`, `linux-c3c4-snapshot`) | pass with change: the refusing loader (row 10) | [§ Criteria 3 and 4](#criteria-3-and-4-rendering-inside-the-bundle-shown-as-blob-images-task-33) |
| 4 | Criterion 4: diagram SVG shown as `blob:` images | on the board as written: fail, the board page's policy blocks the image (`c3c4`). With `img-src blob:` on the board page: pass (`c3c4-blob`). In a Snapshot: pass (`c3c4-snapshot`) | as Chromium | as Chromium, 2 violations per image | as Chromium | the same (`linux-c3c4*`) | pass with change: AD-8's board policy (row 4); task 3.3 awaiting PO | [§ Criteria 3 and 4](#criteria-3-and-4-rendering-inside-the-bundle-shown-as-blob-images-task-33) |
| 5 | Criterion 5: PlantUML's sponsored-message images suppressed | pass: 1.2026.9 shows no sponsored message; error and crash images become render errors (`sponsor`) | pass | pass | pass | untested: not run on Linux | pass, with the filter and its CI check (rows 10, 18) | [§ Criterion 5](#criterion-5-plantumls-sponsored-messages-task-34) |
| 6 | Criterion 6: bundle and Snapshot size, inlining only the chunks a board uses | measured (`evidence/sizes.json`); Snapshots pass (`snapshot`) | as Chromium | the every-component Snapshot fails on Radix Select's native `<select>` (`snapshot`) and passes with radios (`snapshot-radios`) | as Chromium | as macOS (`linux-snapshot`, `linux-snapshot-radios`) | pass: measured, against no budget; task 5.2 awaiting PO (rows 3, 6, 18) | [§ Criterion 6](#criterion-6-bundle-and-snapshot-size-tasks-51-and-52) |
| S-1 | Mermaid 12.2.0 without elkjs | pass with `elkjs` stubbed, `layout: 'dagre'` and `layout` in `secure` (`mermaid`, `mermaid-shim`; `tools/check-elkjs.ts`) | as Chromium | as Chromium | as Chromium | the Mermaid fixtures of `linux-c3c4*` render; the `layout: elk` fixtures: untested | pass with change (row 11) | [§ S-1](#s-1-mermaid-without-elkjs-task-31) |
| S-2 | react-arborist and react-dnd | registry facts (`evidence/adoption.json`); the replacement's `c-tree`, `c-ranking` and `c-kanban` pass (`matrix`, `drag-slider`) | as Chromium | as Chromium | as Chromium | `c-tree`, `c-ranking`, `c-kanban` pass (`linux-matrix`) | pass: react-dnd fails the rule (last release 2022-04-19); the UX's replacement holds (row 21) | [§ S-2 and S-3](#s-2-and-s-3-task-47) |
| S-3 | vis-timeline and `@egjs/hammerjs` | no browser run: registry facts only, and no Timeline fixture | no browser run | no browser run | no browser run | no browser run | pass: hammer.js, a peer of vis-timeline, fails the rule. The own Timeline: untested (row 21) | [§ S-2 and S-3](#s-2-and-s-3-task-47) |
| S-4 | Form validation under the CSP | pass: the no-op validator with `extraErrors`; Ajv's compile is blocked (`form`) | pass | pass; the blocked compile is reported to the board page | pass | untested: not run on Linux | pass | [§ Form](#form-task-44) |
| S-5 | cmdk, next-themes and storage in the view | pass: no fixture touched storage or made a worker; the `.dark` switch works once Tailwind's `dark:` variant follows the class (`theme`) | pass | pass | pass | untested: run `theme` not run on Linux | pass with change: Tailwind's variant (row 15) | [§ S-5](#s-5-storage-workers-and-the-dark-switch-task-46) |
| S-6 | Radix Dialog and Alert Dialog | as written: 1 `style-src-elem` per opening, and PageDown scrolls the page behind the modal; focus trap and Esc work. With the style-element shim: 0 violations and a full lock. Non-modal: pass (`dialog`) | as Chromium | as Chromium | as Chromium | untested: not run on Linux | pass with change (row 7) | [§ S-6](#s-6-radix-dialog-and-alert-dialog-task-43) |
| S-7 | No `allow-forms`: RJSF with `tagName="div"` | pass: Enter submits nothing; a `<form>` submission is blocked (`form`) | pass; the `<form>` is blocked silently | pass; but with a `<form>`, the submit event fires on Enter inside the sandbox | pass | untested: not run on Linux | pass: `tagName="div"` is required, not only the sandbox (row 23) | [§ Form](#form-task-44) |
| S-8 | Form picks as `enum` with `ui:enumNames`; the safe `pattern` subset | pass: picks return their `enum` values (`form`); `pattern-check.ts` accepts 8 and refuses 11 as listed; `pattern` shows 0 violations | pass | pass | pass | untested: not run on Linux | pass | [§ Form](#form-task-44), [§ S-8](#s-8-the-safe-pattern-subset-task-45) |
| F1 | `@pierre/diffs` syntax highlighting under the CSP | as written and in every configuration without a shim: fail (52 `style-src-attr`, 1 `style-src-elem`). With the markup shim and the CSS-variables theme: pass, DESIGN.md's colours (`diffs`, `diffs-dark`). No configuration gives token classes | as Chromium | as Chromium | as Chromium | `c-diff` and `c-diff-vars-shim` as on macOS (`linux-matrix`); run `diffs` not run | **awaiting PO**: on or off, and the look (row 12, task 6.1) | [§ Diff highlighting](#diff-highlighting-task-42) |
| F2 | Mermaid text measurement with its injected styles blocked | as configured: 2 of 8 flowchart labels overflow; 0 with the shell rule, the CSSOM rule, `config` or the style shim (`measure`) | as Chromium | as Chromium | as Chromium | untested: not run on Linux | pass with change (row 11); the look awaiting PO (task 6.1) | [§ Mermaid text measurement](#mermaid-text-measurement-task-35) |
| F3 | PlantUML render time in the golden single-question case | visible at 235.8 ms (median of 20), 86% of it PlantUML's (`golden-time`) | 504 ms, 93% | 274.5 ms, 86% | 240.3 ms and 233.5 ms, 86% and 87% | 315.3, 555 and 321 ms (median of 10), 88% to 91% (`linux-golden-time`) | pass: measured. Smetana is 11.5 to 70.5 ms faster (row 8) | [§ Golden case time](#golden-case-time-task-37) |
| U1 | Native drag of Pragmatic drag and drop inside the sandboxed frame | pass, automated (`drag-slider`) | pass | pass | pass | `c-ranking` and `c-kanban` pass (`linux-matrix`) | **awaiting PO**: by hand in Chrome and Safari (task 6.2, row 22) | [§ UX spike items](#ux-spike-items-task-48) |
| U2 | A click on an unset Slider's track | sets no value (`drag-slider`); the same without CSP or sandbox (`drag-slider-control`) | as Chromium | as Chromium | as Chromium | untested: not run on Linux | pass with change: AskBoard's Slider sets it (row 22) | [§ UX spike items](#ux-spike-items-task-48) |
| U3 | Storage access of every component at start-up | no access in any fixture (S-5) | as Chromium | as Chromium | as Chromium | untested: run `theme` not run on Linux | pass | [§ S-5](#s-5-storage-workers-and-the-dark-switch-task-46) |
| R | The renderer comparison: json-render 0.21.3 or AskBoard's own | measured (`renderers`, `c2`, `atoms`) | measured | measured | measured | untested: not run on Linux | **awaiting PO** (row 1, task 8.3) | [§ Renderer comparison](#renderer-comparison-task-23) |

**Summary:** of 22 rows, 10 pass (2, 5, 6, S-2, S-3, S-4, S-7, S-8, F3, U3), 8 pass with change (1, 3, 4, S-1, S-5, S-6, F2, U2), 1 fails (1a, Radix Select) and 3 await the PO (F1, U1, R). On Linux, every run of task 7.1 matched macOS (`linux-matrix`, `linux-c3c4*`, `linux-golden-time`, `linux-snapshot*`); the other rows are untested there.

## Failures and consequences

SOLUTION-DESIGN §10.3 has one rule for failures, in "What changes": "a component failing the CSP is out". Below, each failure and what applies.

### Radix Select fails criterion 1 (row 1a)

- **Measured:** opening it fires two blocked `<style>` elements, the scroll lock's and the viewport's. In WebKit, its hidden native `<select>` adds a `style-src-attr` violation. The style-element shim passes it in Firefox only (`c-select-shim`). Select still works in every engine: the picked value reaches the draft record.
- **What applies:** the rule as written. Select is out, and with it the Form's single pick from a list as a dropdown (EXPERIENCE, Atoms and Form library; DESIGN.md, Components, Form). With radios for single picks, the every-component Snapshot passes in every engine (`snapshot-radios`). A native `<select>` is no fallback: WebKit reports every one (row 6).

### Criterion 4 fails on the board under AD-8 as written (row 4)

- **Measured:** every diagram image is blocked by the board page's policy, which names no `img-src`. The srcdoc inherits it, and the view's own `img-src data: blob:` cannot widen it (`c3c4`). KaTeX's inlined fonts are blocked the same way: 20 `font-src` violations (`matrix`).
- **What applies:** not the component rule: the diagrams and KaTeX are not at fault, AD-8's two policies disagree. AD-8 changes instead (row 4).

### Components that fail as written and pass with a change

Under §10.3's rule, each is out if the PO refuses its change.

| Component | Fails as written with | The change, measured | Row |
| --- | --- | --- | --- |
| Mermaid, PlantUML | `style` attributes and a `<style>` written while they render | the diagram style shim (`mermaid-shim`, `plantuml-shim`) | 5 |
| PlantUML class, component and state diagrams | WebAssembly refused (Graphviz) | Smetana (`plantuml-shim`), or `'wasm-unsafe-eval'` (`plantuml-wasm`) | 8 |
| `@pierre/diffs` | `style` attributes in its markup, highlighting on or off | the markup shim (`c-diff-vars-shim`). No other diff library passes the adoption rule (git-diff-view: 743 stars, §9) | 5, 12 |
| MathLive | its keyboard proxy throws in the opaque frame; `style` attributes; blocked fonts | three changes (`c-mathlive-shim` with `board-media`) | 13 |
| KaTeX | blocked fonts | the board page's `font-src data:` (`matrix-media`) | 4 |
| Radix Dialog, Alert Dialog, modal Popover | the scroll lock's `<style>` | the style-element shim (`s6-dialog-shim`, `c-popover-modal-shim`) | 5, 7 |
| markdown-it | table alignment as `style` attributes | alignment as classes (`c-markdown-classes`), as EXPERIENCE already says | 14 |
| ECharts | its HTML tooltip's `style` attributes | `tooltip.renderMode: "richText"` (`c-chart-rich`), as EXPERIENCE already says | 14 |
| xyflow | `import.meta` in a classic script does not parse | the build defines `import.meta.env` (`graph-import-meta`) | 18 |
| json-render, ext-apps' `App` | zod's caught `new Function` probe | zod's `jitless` set first (`smoke`, `c-app-jitless`) | 1, 16, 17 |

### Measurements that contradict a document

- §10.3, S-2: react-dnd's last release is 2022-04-19, not 2022-06-25; S-3: hammer.js is a peer of vis-timeline, not a dependency (row 21).
- EXPERIENCE, Diagram: "Mermaid with `htmlLabels: false`" is not enough. ELK is Mermaid's default layout, and Mermaid's `secure` list leaves its layout and theme keys open to the agent's directives (D1, D3; row 11).
- DESIGN.md, Syntax highlighting: "through classes". No configuration of `@pierre/diffs` 1.6.2 gives token classes (D10); its CSS-variables theme does the same job (row 12).
- AD-8: "`'wasm-unsafe-eval'` only if the formula engine is WASM". PlantUML's Graphviz needs it too, unless Smetana lays out (row 8).
- AD-8: the board page's policy, as written, blocks the view's `blob:` images and `data:` fonts (row 4).

## Proposed outcomes (awaiting the PO)

Each row is a proposal until the PO records a decision (task 8.3). The replacement texts for each row are in `spine-update-draft.md`, beside this file; none applies before its row is accepted. Byte counts are those of the current build (§ Criterion 6).

| # | Item | Evidence | Proposed decision | Alternative | What it changes | PO decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | The catalog renderer | `atoms`, `c2`, `renderers`, `smoke`; D18 to D21; § Renderer comparison | AskBoard's own renderer. Both candidates give the same DOM and pass criterion 2 in every engine (`atoms`, `c2`). json-render passes criterion 1 only with zod's `jitless` (`renderers`). In AskBoard's use it adds a tree walk and a state context: its props expressions, its own state, its actions and its validation are all switched off (D18, D19). It adds 158,241 bytes to every board (159,717 against 1,476). It hides a failing item from the board page (D20). Its releases labelled 20 changes breaking across 18 minors in 8.5 months. | json-render 0.21.3, with zod's `jitless` set first, its store bound to the draft record, and its error boundary replaced (row 2) | Spine Deferred (row 25), AD-9 (a phrase), Stack (pins only for the alternative); SOLUTION-DESIGN §9, §10.3 | |
| 2 | AD-9: an item that throws, and items a container hides | `renderers` (`throws`), D20; § The renderer (Tabs); `c2` (`delayed-early`) | Each item renders inside an error boundary. It shows an error state and reports the error to the board page, and the question then never counts as visible, so nothing is answered on a partial board (AD-10). Neither renderer did this as measured: the own renderer lost the whole view, and json-render hid the item and told the board page nothing. A container that hides items, such as Tabs, still mounts them, hidden, so they report ready; otherwise the question never counts as visible. The boundary as written is untested. | Leave both to the `view` epic, with no AD text | Spine AD-9 | |
| 3 | AD-9 and AD-15: how a Snapshot carries diagrams | `snapshot`, `snapshot-renders`, `snapshot-radios`, `linux-snapshot`, `linux-snapshot-radios`; § Boards and Snapshots | A Snapshot carries each diagram's light and dark SVG render as data, and the `diagram-svg` chunk (7,123 bytes) that shows the scheme's render as a `blob:` image. It carries no diagram renderer chunk. The golden Snapshot is 429,393 bytes against 5,044,979, and visible in 42 to 115 ms against 217 to 491 ms (`snapshot`). Every Snapshot passes in every engine and scheme, apart from Radix Select (row 6). How the renders reach `snapshot`, which assembles from the board document and the log (AD-15): the view renders each diagram in both themes and sends the SVG text to the board page as a typed view message; `board-host` keeps the latest per item and board revision as data, never served as a page (AD-8); `assemble` takes the renders it has, and inlines a diagram's renderer chunk when no render exists (a board never opened). The message path and the second theme's render time are untested. | Snapshots inline the renderer chunks, as boards do. It also passes (`snapshot`), and the golden Snapshot is 12 times larger | Spine AD-9, AD-15; SOLUTION-DESIGN §5.6 | |
| 4 | AD-8: the board page's policy names the view's media sources | `c3c4`, `c3c4-blob`, `c3c4-snapshot`, `matrix`, `matrix-media`, `theme`, `linux-c3c4*`; § Criteria 3 and 4 | The board page's CSP adds `img-src data: blob:` and `font-src data:`, the view's own media sources (variant `board-media`). The srcdoc inherits the board page's policy, which names neither, so `default-src 'none'` blocks every diagram image (criterion 4) and every inlined font (KaTeX: 20 `font-src` violations), and the view's own policy cannot widen it. The view's meta policy still bounds the view. With the variant, the diagrams, KaTeX and MathLive pass in every engine (`c3c4-blob`, `matrix-media`). Closes task 3.3. | `img-src blob:` only (`board-img-blob`): the diagrams pass, while KaTeX, MathLive and the bundled faces stay blocked | Spine AD-8; SOLUTION-DESIGN §4.5, §13 | |
| 5 | AD-8: style writes go through the CSSOM (three shims) | `negative` (`pos-cssom-style`), `mermaid-blob`, `mermaid-shim`, `plantuml-shim`, `plantuml-wasm`, `dialog`, `matrix` (`c-popover-modal-shim`, `c-diff-vars-shim`, `c-mathlive-shim`), `measure`; D4, D10, D11 | The policy stays hash-only, and the view carries three shims that route a library's own style writes through the CSSOM and constructed stylesheets (`adoptedStyleSheets`). Every engine allows both under a hash-only `style-src`. **Diagram style shim** (77 lines, in the diagram chunks): during a render, `setAttribute("style", v)` becomes `style.cssText = v`, Mermaid's `<style>` becomes a constructed sheet, and `style` attributes are renamed around DOMPurify's parse. **Style-element shim** (50 lines, 846 bytes minified): a `<style>` added at run time becomes a constructed sheet (modal Dialog, Alert Dialog, modal Popover). **Markup shim** (81 lines, 1,602 bytes minified): `style` attributes in markup a library parses are applied through the CSSOM (`@pierre/diffs`, MathLive). A style set this way loads nothing: `img-src` and `font-src` still bound any `url()` (an inference). Without the shims, Mermaid, PlantUML, Diff review, MathLive and the modal dialogs fail criterion 1 in every engine. | `'unsafe-inline'` for `style-src-attr` and `style-src-elem`, which AD-8 and criterion 1 forbid; or those components are out. For the diagram shim's third step alone: Mermaid's sanitizing pass off (`securityLevel: 'loose'`), not measured | Spine AD-8; SOLUTION-DESIGN §4.5, §13 | |
| 6 | Radix Select | `matrix` (`c-select`, `c-select-popper`, `c-select-shim`), `form`, `form-shim`, `snapshot`, `snapshot-radios`, `linux-snapshot-radios`; `tools/check-native-select.ts` | Out, as §10.3 says of a component that fails the CSP: it fails in Chromium, Chrome, Edge and WebKit with every change measured. A Form's single pick from a list renders as the Choice atom's radios (Radix Radio Group), with its filter field for long lists. With radios, the every-component Snapshot passes in every engine (`snapshot-radios`), and task 5.2 closes as run. A native `<select>` is no way out: WebKit reports a `style-src-attr` violation for every one it creates. | A listbox on the non-modal Radix Popover, or Select without its `Viewport` part: both untested, to run under the CSP in the `widgets` epic before use | EXPERIENCE Atoms (Choice); DESIGN.md Components (Form) | |
| 7 | S-6: the mode-switch confirmation | `dialog`, `dialog-control` | A modal Alert Dialog with the style-element shim (row 5): 0 violations, with scroll lock, focus trap and Esc in every engine. As written, its scroll-lock `<style>` is blocked and PageDown scrolls the page behind it. If row 5 is refused: non-modal. | Non-modal, which passes as written. Or modal with the static `body[data-scroll-locked]` rule, which restores the lock but leaves one violation per opening (against row 17) | EXPERIENCE Changes, values and board states; DESIGN.md Components | |
| 8 | PlantUML: Smetana, or Graphviz with `'wasm-unsafe-eval'` | `plantuml`, `plantuml-shim`, `plantuml-wasm`, `golden-time`, `linux-golden-time`; `evidence/diagrams/layout/`; § Criterion 6 | Ship `plantuml.js` without `viz-global.js`. PlantUML lays out class, component and state diagrams with Smetana; nothing needs WebAssembly, AD-8 stays as written, and Graphviz's EPL-2.0 never ships (row 9). The chunk is 1,457,830 bytes smaller, and the golden case is visible 11.5 to 70.5 ms sooner (`golden-time`). Subject to the PO's view of the Smetana layouts (task 6.1). | Keep Graphviz. AD-8 admits `'wasm-unsafe-eval'` in both policies for PlantUML's Graphviz; CI checks PlantUML's crash image, since WebKit fires no violation when WebAssembly is refused; row 9's licence question is decided | Stack (row 14); SOLUTION-DESIGN §9; EXPERIENCE Component per widget (Diagram); AD-8 only for the alternative | |
| 9 | Licences of the files inside `@plantuml/core` | § PlantUML (task 3.2), D9 | With row 8, `viz-global.js` (Viz.js MIT, Graphviz EPL-2.0, Expat MIT) never ships. Nor do `emoji.js` (Twemoji graphics, CC-BY-4.0) and `themes.js`, which no chunk inlines. The PlantUML chunk's notices add the licence texts the tarball lacks, taken from their repositories: TeaVM (Apache-2.0), Brotli (MIT), CafeUndZopfli (Apache-2.0) and ASCIIMathML (MIT), all compiled into `plantuml.js`. The adoption rule's stars and activity criteria apply to `@plantuml/core`, the package AskBoard adopts, not to code vendored inside it: CafeUndZopfli has 83 stars, last pushed on 2019-11-25. | If Graphviz is kept: the addendum admits Graphviz, as Viz.js builds it, as an unmodified EPL-2.0 dependency (the tarball does not say whether it is modified); its licence text ships; and the build replaces the `node:url` stand-in that Bun bundles for Viz's Node branch (8,126 bytes, no notice) with an empty module | SOLUTION-DESIGN §9; PRD addendum only for the alternative | |
| 10 | PlantUML: resources and error images | `c3c4`, `c3c4-snapshot` (`plantuml-resources`, `plantuml-resources-default`); `tools/check-file-scripts.ts`; `evidence/file-scripts/installed-firefox-124.png`; `sponsor` | AD-8 adds: no view code creates a script element with a URL. PlantUML's `PLANTUML_STDLIB_LOADER` refuses every library, theme, emoji and icon load, and `PLANTUML_FILE_LOADER` stays unset. The reason: Firefox runs a relative `<script src>` from a `file://` Snapshot despite a hash-only `script-src` (Playwright's Firefox 157 and the installed 124). A source that asks for a resource (`!theme`, `!include <C4/…>`) shows PlantUML's message as a render error, and the shipped skills tell agents so. Error and crash images (first text line "PlantUML version " or "An error has occurred") become render errors; 1.2026.9 shows no sponsored message (criterion 5). The PO decides whether to report the Firefox behaviour to Mozilla. | — Without the refusing loader, an agent's source makes the view request the session process from the board, and run a local file from a Snapshot in Firefox | Spine AD-8; SOLUTION-DESIGN §9, §13; CI (row 18) | |
| 11 | Mermaid's configuration (S-1; D1 to D5) | `mermaid`, `mermaid-shim`, `measure`, `anchors`, `anchors-dark`; `tools/check-elkjs.ts` | Mermaid 12.2.0 is built with `elkjs` replaced by an empty module, and CI checks its absence (S-1; about 1.35 MB raw saved, against the group 3 build). The configuration sets `layout: 'dagre'`, since ELK is Mermaid's default (D1); top-level `htmlLabels: false` (D2); and `securityLevel: 'strict'`, since `'sandbox'` frames a `data:` URL that `frame-src 'none'` blocks (D4). AskBoard adds `htmlLabels`, `layout`, `theme`, `themeVariables`, `themeCSS`, `fontFamily` and `look` to `secure`, so an agent's directive cannot change them: otherwise an agent's `layout: elk` fails the render (D3, `mermaid-elk-open`). Labels: with row 5's diagram shim, Mermaid lays out as with no CSP (`flow-shim`); without it, a hashed shell rule gives Mermaid's measuring container the theme font (0 overflows, `measure`). Mermaid's own KaTeX 0.18.10 (278,393 bytes) stays in its chunk. | For the labels: Mermaid's `fontFamily` set to the page's, which draws them at 13 px (`flow-config`); the PO judges `evidence/measure/` (task 6.1). For KaTeX: an empty module in Mermaid's chunk too, which drops math in labels (untested) | EXPERIENCE Component per widget (Diagram); SOLUTION-DESIGN §9; CI (row 18) | |
| 12 | Diff review: highlighting on or off, and the grammars | `diffs`, `diffs-dark`, `diffs-trim`, `sizes-diffs-trim`, `sizes-diffs-plain`, `snapshot`; D10 to D12; `evidence/diffs/` | Highlighting on. The markup shim (row 5) with `@pierre/diffs`' CSS-variables theme, mapped onto DESIGN.md's five `syntax-*` tokens, passes in every engine with exactly DESIGN.md's colours, and the `.dark` class re-points them with no re-render (`c-diff-vars-shim`). No configuration gives token classes (D10), so DESIGN.md's "through classes" becomes "through the five tokens as CSS variables". Shiki's JavaScript engine, no worker, and a fixed grammar list: the spike's 17 grammars cut the chunk from 11,483,932 to 1,644,861 bytes, leaving out the theme catalogs, the Oniguruma WebAssembly and the Highlights backend (`sizes-diffs-trim`). The `widgets` epic may change the list. Subject to the PO's view of `evidence/diffs/` (task 6.1). WebKit took 1.33 to 1.37 s to show the UJ-1-like Snapshot with every grammar (`snapshot`); the trimmed build's time was not measured. | Highlighting off: 516,571 bytes (`sizes-diffs-plain`). The markup shim is still needed, because the layout writes `style` attributes too (`c-diff-plain`) | DESIGN.md Syntax highlighting; EXPERIENCE Component per widget (Diff review); Stack (row 14) | |
| 13 | MathLive | `matrix`, `matrix-media` (`c-mathlive`, `c-mathlive-sandboxed`, `c-mathlive-shim`); § Fonts | Not in the first version; EXPERIENCE marks it optional. It needs three changes in the sandboxed view: its virtual keyboard mounted in the frame with the `sandboxed` policy (in a frame it posts to `window.top` with origin `"null"`, which throws in every engine); the markup shim; and `font-src data:` on the board page. Its chunk is 1,179,504 bytes. The LaTeX widget stays KaTeX, with a monospace source field and a live preview. | Adopt MathLive 0.111.1 with the three changes, and put the 20 font faces it shares byte for byte with KaTeX into one font chunk (AD-9's manifest): 346,972 bytes saved on a board with both | EXPERIENCE Component per widget (LaTeX); SOLUTION-DESIGN §9; Stack only for the alternative | |
| 14 | Stack pins for the view's components | § Adoption, § Criterion 1, rows 1 to 13 | The spine's Stack gains the components that passed, pinned as run: [Stack pins](#stack-pins-row-14), below. React 19.3.1, `@dagrejs/dagre` 3.1.3 and ext-apps 2.0.4 are pinned already. | The `view` and `widgets` epics add each pin when they adopt the component | Spine Stack; SOLUTION-DESIGN §9 | |
| 15 | Tailwind's `dark:` variant | `theme-media-query`, `theme`, `regress-g5-theme` | Each chunk's Tailwind input carries `@custom-variant dark (&:where(.dark, .dark *))`, so `dark:` utilities follow the `.dark` class the board page drives. By default they follow `prefers-color-scheme`: in `theme-media-query`, a `dark:` utility stayed light under `.dark`. | No `dark:` utilities: components read only the token variables, which the class re-points | EXPERIENCE Dark theme | |
| 16 | ext-apps' `App` in the view | `matrix` (`c-app`, `c-app-jitless`); § What the pending decisions change | Keep AD-8's `App` and `AppBridge`. `App` reaches the board page's `AppBridge` from the opaque view in every engine, once zod's `jitless` is set before ext-apps loads, in the view and on the board page (row 17). It costs 313,693 bytes on every board (the MCP client 163,992, zod 101,475), more than React; `assemble` leaves it out of a Snapshot, which has no host. Its parse time was not measured: the `view` epic measures it against SM-3. | AskBoard's own channel for the ext-apps message set in the view, with `AppBridge` kept on the board page: no zod or MCP client in the view. Untested; AD-8's sentence changes | Spine AD-9 (a sentence); AD-8 only for the alternative | |
| 17 | The caught-probe rule for CI | `smoke`, `renderers`, `matrix` (`c-app`, `c-app-jitless`), `negative`; design decision 2 | CI tolerates no caught probe: a blocked `eval` or `new Function` fails a browser test even when the library catches it. zod's `jitless` is set before any module that uses zod loads, in the view and on the board page; with it, json-render and ext-apps leave no probe. CI collects violations from both documents and counts CSP lines in the console, since WebKit reports a blocked `eval` only to the board page and a refused WebAssembly compile only in the console. | Tolerate caught probes, listed by library, as the spike's "probe" verdict did. A real `eval` behind a `try` then passes unseen | Spine Consistency Conventions (Tests) | |
| 18 | CI checks of the view build, among them a per-chunk size check | § Sizes (the globals plugin), `graph-import-meta`, `tools/check-elkjs.ts`, `sponsor`, `c2` (`delayed-early`), `regress-g5*` | CI fails on: a chunk that grows past a margin over the previous build without the change saying so (a resolve filter that matched every import took the chart chunk from 507,148 to 1,075,115 bytes, and no test failed); `import.meta` left in a chunk (a classic script holding it does not parse: the Graph chunk failed in every engine); an `elkjs` input or identifier in a chunk, with a control build that proves the search (S-1); PlantUML's filter missing the error image of an empty source or of a syntax error; an item whose box moves between "visible" and 1 s later. A bundler plugin's resolve filter names only the modules it maps. The `view` epic sets the margin. No absolute size budget is proposed: none exists to amend (§ Budget). | Report sizes without failing, as the spike did | Spine Consistency Conventions (Tests) | |
| 19 | Fonts: licence and source | § Adoption; § Fonts (`evidence/sizes.json`, `fonts.design`); `gh api` on 2026-10-30 for the upstream repositories; the SPDX licence list (release of 2026-10-28) for OSI approval | The addendum admits SIL OFL-1.1, which is OSI-approved, beside MPL-2.0 and EPL-2.0, for unmodified font files shipped with their licence text. DESIGN.md already chose two OFL-1.1 faces (L131). The files come from `@fontsource/inter` (or `@fontsource-variable/inter`) and `@fontsource/jetbrains-mono` 5.3.0, under a named stars exception: their repository `fontsource/font-files` has 509 stars, the Fontsource project 6,249, and both pass the activity criterion. The upstream repositories pass stars but fail activity: `rsms/inter` (20,012 stars) last released on 2024-11-16 and was last pushed on 2024-11-19; `JetBrains/JetBrainsMono` (13,134 stars) on 2023-01-14 and 2025-01-31. The `view` epic picks the subsets: latin and latin-ext with variable Inter add 217,172 bytes to every board and Snapshot. | No bundled faces: the system font stacks the probe used. DESIGN.md's Typography changes, and boards look different per platform | PRD addendum (adoption rule); SOLUTION-DESIGN §9 (named exceptions); Stack (row 14); DESIGN.md only for the alternative | |
| 20 | The licence check on the probe's lockfile | Task 1.3 (`tools/check-licences.ts` on `probe/`); `probe/dist/manifest.json` (current build) and `probe/dist/variants/catch-all/manifest.json` (group 4 build); the SPDX licence list | The `view` epic's root lockfile fails `check:licences` on four findings unless they are settled. **`robust-predicates`** (the Unlicense, through Mermaid's d3-delaunay): 1,962 bytes in the group 4 build's Mermaid chunk, and in no chunk since group 5's tree-shaking fix. The Unlicense is OSI-approved and permissive, so the check's permissive set gains it, as it already holds ISC and 0BSD; the PO confirms that reading of the addendum. **`khroma`** has no `license` field, and its licence file is MIT: an override that cites the file. **The Tailwind WASI fallback's packages:** the check takes a bundled dependency of a package for another platform for a missing install; the check is corrected. **`argparse`** (PSF-2.0, markdown-it's command-line tool, in no chunk): PSF-2.0 is not OSI-approved, so the addendum names it as a licence exception, the only route the PRD allows. | The addendum names `robust-predicates` as a licence exception too, rather than the check reading the Unlicense as permissive | PRD addendum (`argparse`); the `view` epic changes `tools/check-licences.ts` and `tools/licence-overrides.json` | |
| 21 | S-2 and S-3 facts, and §9's status table | `evidence/adoption.json` (2026-10-29); § S-2 and S-3 | §10.3's S-2 reads react-dnd's last release as 2022-04-19 (16.0.1, `latest`), not 2022-06-25; S-3 reads `@egjs/hammerjs` as a peer of vis-timeline, not a dependency. Neither changes the conclusion: the UX's replacements hold. The Tree, Ranking and Kanban fixtures pass; the own Timeline was not built. §9's status table, re-dated 2026-10-29, moves react-arborist and vis-timeline to "Failing today" for their peers, settles the catalog renderer row (row 1), and notes the Mermaid and PlantUML builds (rows 8, 11). The ACR file stays as the UX run's record. | Leave §9 as the 2026-10-27 snapshot, and record the corrections only in §10.3's outcome | SOLUTION-DESIGN §9, §10.3 | |
| 22 | UX spike items: native drag, the unset Slider, the storage audit | `drag-slider`, `drag-slider-control`, `drag-slider-set`, `linux-matrix` (`c-ranking`, `c-kanban`); § S-5; task 6.2 | Native drag: Pragmatic drag and drop works inside the sandboxed frame in every engine Playwright drives; EXPERIENCE's spike item closes once the PO's drag by hand in Chrome and Safari passes (task 6.2). The unset Slider: Radix sets no value from a click on an unset track, because it moves the nearest thumb and there is none. AskBoard's Slider sets the value at the clicked point itself while unset (`widgets` epic), so a first click counts as an explicit act. The storage audit: no component touched storage or made a worker. | For the Slider: keep Radix's behaviour, and EXPERIENCE says how an unset Slider takes its first value (not measured) | EXPERIENCE Component Patterns (Scale); Composition and Components (Ranking, Scale, Kanban, Drag and drop, Dark theme) | |
| 23 | The Form library's constraints | `form`, `form-control`, `form-shim`; D13 to D17 | EXPERIENCE's Form library gains three points. `tagName="div"` is required, not only the sandbox: WebKit fires the submit event inside the sandbox without `allow-forms`, so a `<form>` runs RJSF's `onSubmit` on Enter (S-7). `showErrorList={false}`: by default RJSF lists every error above the form (D13). The draft record drives the Form's `formData` (AD-9): RJSF keeps its own copy in state (D16), and the `widgets` epic runs criterion 2's remount check on the Form, which the spike did not. Noted: `markdown-to-jsx` ships in the chunk although Markdown stays off (78,544 bytes, D15). | — | EXPERIENCE Form library | |
| 24 | SOLUTION-DESIGN §13: the facts the spike found | [Facts](#facts-row-24), below | Add each fact, or set each status, as listed there. | Per fact | SOLUTION-DESIGN §13 | |
| 25 | The Deferred row, §12, §10.3's outcome, front matter | [Deferred and open items](#deferred-and-open-items-row-25), below | Close the catalog renderer row, and record the outcome in §10.3. | Per row | Spine Deferred; SOLUTION-DESIGN §10.3, §12 | |

### Stack pins (row 14)

Pins as the probe ran them (design decision 1; § Adoption, run on 2026-10-29). Shiki 4.5.0 comes with `@pierre/diffs`, and Radix's primitives with `radix-ui`.

| Package | Pin | Role, as run | Condition | PO decision |
| --- | --- | --- | --- | --- |
| `radix-ui` | 1.8.1 | Radio Group, Checkbox, Switch, Tabs, Slider, Toggle Group, Popover (non-modal); Dialog and Alert Dialog with the style-element shim. Not Select | Rows 5, 6, 7 | |
| `react-day-picker` | 10.0.2 | The Date Picker's calendar, in the non-modal Popover | — | |
| `markdown-it` | 15.0.3 | Markdown, `html: false`, table alignment as classes | Row 20 (`argparse`) | |
| `dompurify` | 3.4.17 | The Markdown sanitizer | — | |
| `katex` | 0.19.1 | LaTeX, through its DOM API | Row 4 | |
| `@tanstack/react-table` | 9.3.1 | Table, Tree, Spreadsheet, the Gantt's grid | — | |
| `@atlaskit/pragmatic-drag-and-drop` | 4.0.0 | Ranking, Kanban, Tree | — | |
| `echarts` | 6.1.0 | Chart, canvas renderer, `tooltip.renderMode: "richText"` | — | |
| `@xyflow/react` | 12.12.0 | Graph; the build defines `import.meta.env` | Row 18 | |
| `mermaid` | 12.2.0 | Diagram, built without elkjs | Row 11 | |
| `@plantuml/core` | 1.2026.9 | Diagram, `plantuml.js` only | Rows 8, 9 | |
| `@pierre/diffs` | 1.6.2 | Diff review | Rows 5, 12 | |
| `@rjsf/core`, `@rjsf/utils` | 6.11.0 | Form | Row 23 | |
| `tailwindcss`, `@tailwindcss/cli` | 4.3.3 | Build-time styles | Row 15 | |
| `@modelcontextprotocol/core`, `@modelcontextprotocol/client` | 2.4.0 | ext-apps 2.0.4's peers, beside the pinned `@modelcontextprotocol/server` | Row 16 | |
| `zod` | 4.6.7 | ext-apps' peer, with `jitless` | Rows 16, 17 | |
| `@json-render/core`, `@json-render/react` | 0.21.3 | Only if row 1 picks json-render | Row 1 | |
| `mathlive` | 0.111.1 | Only if row 13 keeps MathLive | Row 13 | |
| `@fontsource/inter` or `@fontsource-variable/inter`, `@fontsource/jetbrains-mono` | 5.3.0 | Only if row 19 adopts them | Row 19 | |

### Facts (row 24)

New facts take the next free IDs after F38. "Verified" means a run of this change shows it, on 2026-10-29 or 2026-10-30.

| Fact | Statement | AD | Evidence | Proposed status | PO decision |
| --- | --- | --- | --- | --- | --- |
| F28 | ext-apps 2.0.4's classes accept an opaque-origin view | AD-8 | `c-app`, `c-app-jitless` | Verified: `App` reaches `AppBridge` from the sandboxed view in every engine; zod needs `jitless` first | |
| F30 | Hash-only `style-src` blocks `style` attributes and injected `<style>` | AD-8 | `negative` | Verified in every engine; see F40 for what it lets through | |
| F39 (new) | The srcdoc inherits the board page's policy, so a `blob:` image or a `data:` font the view's policy allows is blocked unless the board page's policy allows it too | AD-8 | `c3c4`, `matrix`, `c3c4-blob`, `matrix-media` | Verified | |
| F40 (new) | A hash-only `style-src` lets CSSOM writes (`style.cssText`, `insertRule`) and constructed stylesheets (`adoptedStyleSheets`) through, in Chromium, Firefox and WebKit | AD-8 | `negative` (`pos-cssom-style`), the shims' runs | Verified | |
| F41 (new) | Chromium checks a `<style>` against `style-src` when it is connected, whatever its `type`. WebKit reports a `style-src-attr` violation for every native `<select>` it creates. WebKit reports a blocked `eval` only to the board page, and a refused WebAssembly compile only in the console. Firefox blocks a sandboxed `<form>` submission silently; WebKit fires its submit event | AD-8; Tests | `c-select-shim`, `tools/check-native-select.ts`, `negative`, `plantuml`, `form` | Verified | |
| F42 (new) | Firefox runs a relative `<script src>` from a `file://` page despite a hash-only `script-src` | AD-8, AD-15 | `tools/check-file-scripts.ts` (Firefox 157 and the installed 124) | Verified | |
| F43 (new) | Mermaid 12.2.0: ELK is the default layout; the default `secure` list leaves out `htmlLabels`, `layout`, `theme`, `themeVariables`, `themeCSS` and `fontFamily`; `securityLevel: 'sandbox'` frames a `data:` URL; it brings KaTeX 0.18 | AD-8 | D1 to D5; `mermaid` | Verified | |
| F44 (new) | `@plantuml/core` 1.2026.9: Graphviz comes as Viz.js WebAssembly and needs `'wasm-unsafe-eval'`, and without it Smetana lays out; no sponsored message, but error and crash images; resources load by script tag unless the host supplies loaders; the tarball lacks the licence texts of the code compiled into it | AD-8, AD-19 | § PlantUML; `plantuml-wasm`, `sponsor`, `c3c4` | Verified | |
| F45 (new) | `@pierre/diffs` 1.6.2 writes token colours and layout as `style` attributes in markup it parses; `useCSSClasses` is declared but not read | AD-8 | D10; `diffs` | Verified | |
| F46 (new) | json-render 0.21.3: its store can be bound to an outside record; its error boundary renders `null` and tells only the console; zod 4 probes `new Function` unless `jitless` is set | AD-9 | D18 to D21; `c2`, `renderers` | Verified | |
| F47 (new) | Bun 1.4.4: a bundler plugin whose `onResolve` matches every import makes the bundler ignore `sideEffects` | AD-9 | § Sizes | Verified | |

### Deferred and open items (row 25)

| Spine Deferred row, or other text | Proposed | Condition | PO decision |
| --- | --- | --- | --- |
| "Catalog renderer behind `CatalogRenderer` (json-render 0.21 or own); Mermaid and PlantUML rendering inside the view bundle" | Remove: the renderer is decided (row 1), and both diagram renderers run inside the bundle (criterion 3) | Rows 1, 4, 5 | |
| A new Deferred row, "How diagram renders reach `snapshot`" | Add only if row 3 is accepted without its message path; revisit in the `view` and `snapshot` epics | Row 3 | |
| SOLUTION-DESIGN §12, "Architecture spikes" | Drop "catalog renderer with Mermaid and PlantUML (renderer, with UX)" | — | |
| SOLUTION-DESIGN §10.3 | Add an "Outcome" paragraph | The rows it cites | |

### Not for the PO: left to the epics

Each is recorded in its section; none needs a decision now.

- **`view`:** label-and-occurrence anchors for PlantUML activity diagrams, and Mermaid state edges keyed by their ends (§ Anchors); hit regions on a scaled image (§ Anchors); whether a reload restores the keyboard tab stop (ACR-11; § Criterion 2); the fonts' subsets (row 19); folding `lib-table` into `table` (§ Library chunks); the board page's icon, since Firefox requests `/favicon.ico` and the board policy blocks it (§ Method); the second theme's render time for Snapshots (row 3).
- **`widgets`:** the grammar list (row 12); the Slider's first click (row 22); the Form's remount check (row 23); a Tree whose rows are dragged (§ S-2 and S-3); the Timeline (S-3).
- **Platforms:** x86-64 Linux, Chrome and Edge on Linux, and the browsers' previous majors are untested (§ Linux; design.md, Non-Goals). Safari is the PO's (task 6.2).

## Product owner checks (tasks 6.1 and 6.2)

Both tasks stay open, awaiting PO. Paths are relative to the change folder. The screenshots under `evidence/` are committed; `probe/runs/` and `probe/dist/` are git-ignored and present in this worktree on 2026-10-30.

### 6.1 Screenshots to judge

| Set | Files (runs) | What to look for | PO verdict |
| --- | --- | --- | --- |
| Golden case, light and dark | `evidence/golden/{chromium,firefox,webkit}-{light,dark}.png` (`golden-look`, `golden-look-dark`) | The golden board as the view draws it, with the PlantUML diagram in DESIGN.md's diagram theme (Colors, Diagram theme) in both schemes. The text is in the system font stacks: the bundled faces wait on row 19 | |
| Diagram themes and hit regions | `evidence/diagrams/{light,dark}/{chromium,firefox,webkit}/`: `plantuml-golden.png`, `mermaid-flowchart.png`, `mermaid-sequence.png`, `mermaid-class.png`, `mermaid-state.png` (`anchors`, `anchors-dark`) | Colours against DESIGN.md's Diagram theme table, light and dark. The dashed outlines (hit regions) sit on each participant, message, node and edge. Seen, not judged: Mermaid's `neo` look leaves a light halo around nodes in dark | |
| Smetana against Graphviz (row 8) | `evidence/diagrams/layout/plantuml-{class,component,state}-{graphviz,smetana}.png` (`plantuml-wasm`, `plantuml-shim`; Chromium, light) | Whether Smetana's layouts are acceptable for class, component and state diagrams | |
| Mermaid labels (row 11) | `evidence/measure/{chromium,firefox,webkit}/flow-*.png` and `sequence-*.png` (`measure`) | `flow-none.png` shows the failure: the "yes" label runs past the image's left edge, and both edge labels past their backgrounds. Compare against `flow-control.png` (no CSP): `flow-shim.png` (the style shim, the control's layout), `flow-shell-rule.png` and `flow-cssom.png` (the shell rule, 6% wider), `flow-config.png` (labels at 13 px). The sequence diagrams are unaffected | |
| Diff highlighting (row 12) | `evidence/diffs/{chromium,firefox,webkit}-{light,dark}.png` (`diffs`, `diffs-dark`); for comparison `chromium-default-no-shim.png` and `chromium-pierre-theme-shim.png` | The five `syntax-*` colours on the diff backgrounds, legible in both schemes. The comparison files show the diff as written (no colour) and in Pierre's own palette | |

### 6.2 At the keyboard, in Chrome and Safari

Playwright cannot drive Safari, and a person's drag can differ from Playwright's.

1. In a terminal, from the change folder:

   ```sh
   cd probe
   bun install --frozen-lockfile   # only if node_modules/ is missing
   bun run build                   # only if dist/ is missing
   bun board.ts --port 4610        # prints the board stand-in's URL and one URL per fixture
   ```

   Leave it running, and stop it with Ctrl+C at the end.
2. In Safari, turn on Settings → Advanced → "Show features for web developers", to get Develop → Show JavaScript Console.
3. In the installed Chrome, then in Safari, open each board below and act on it:

   | Board | Do | Expected |
   | --- | --- | --- |
   | `http://127.0.0.1:4610/b/ux-ranking` | Drag C onto A, then A onto B | The order C, B, A |
   | `http://127.0.0.1:4610/b/ux-kanban` | Drag k1 onto the Done lane, then k3 onto card k2 | To do: k3, k2; Doing: empty; Done: k1 |
   | `http://127.0.0.1:4610/b/golden?variants=board-media` | Look, then answer the question | The diagram shows, and the question works. The variant is row 4's board policy: without it, the board page's policy blocks the diagram, as criterion 4 records |

4. After each board, in the console of the board page (the top frame, not the view's):

   ```js
   __probeSend("state", {}, 1)
   __probe.events.filter((e) => e.kind === "command").at(-1).result.draft      // the draft record
   __probe.events.filter((e) => e.kind === "violation").length + __probe.board.length   // CSP violations: expect 0
   ```

5. Optional, Safari only: open the golden Snapshot from `file://`, `open -a Safari probe/runs/snapshot/snapshots/golden.own.svg.light.html` (renders only) and `golden.own.chunks.light.html` (with the PlantUML chunk). Expected: the diagram shows.

| Browser | `ux-ranking` | `ux-kanban` | Golden board | Golden Snapshot (optional) | PO verdict |
| --- | --- | --- | --- | --- | --- |
| Chrome (installed) | | | | — | |
| Safari 26.6.2 | | | | | |

## Method

- **Platform:** macOS 26.6.2 (Darwin 25.6.0, arm64), on 2026-10-29. Linux is the optional group 7.
- **Runtime:** Bun 1.4.4 runs the build, the board-page stand-in and the driver. Playwright 1.64.1 works under Bun 1.4.4 in all five engines, so the Node fallback of design.md (Risks) was not needed. The probe pins Node 24.22.2 with Volta, as the repository does; nothing in the probe uses it.
- **Engines** (task 1.4, `bun drive.ts versions`). Playwright's builds are installed with `PLAYWRIGHT_BROWSERS_PATH=<scratch>/ms-playwright node node_modules/playwright/cli.js install chromium firefox webkit`, outside the repository and the user's browser cache. Every run below uses headless mode.

  | Engine | Version | Source |
  | --- | --- | --- |
  | `chromium` | Chrome for Testing 156.0.8078.4 | Playwright build (CI engine) |
  | `firefox` | Firefox 157.0 | Playwright build (CI engine) |
  | `webkit` | WebKit 27.2 | Playwright build (CI engine) |
  | `chrome` | Google Chrome 156.0.8078.73 | installed, Playwright channel `chrome` |
  | `msedge` | Microsoft Edge 156.0.4314.50 | installed, Playwright channel `msedge` |
  | Safari | 26.6.2 | installed; Playwright cannot drive it, so the product owner opens it (task 6.2) |

  The installed Firefox 124.0.2 is not used: the CI engine is Playwright's Firefox 157.0.
- **The two policies** (`probe/csp.ts`), exactly as AD-8 states them. The view's policy is a meta tag in the srcdoc; the board page's is an HTTP header, and the srcdoc inherits it. The hashes are those of the chunks a board inlines; for the `hello` fixture:

  ```text
  view:  default-src 'none'; script-src 'sha256-2Vy1…' 'sha256-HLAC…' 'sha256-NX3f…' 'sha256-emTE…'; style-src 'sha256-vwQG…' 'sha256-fBGu…'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'
  board: default-src 'none'; script-src 'sha256-j+iD…' <the view's script hashes>; style-src 'sha256-F5c/…' <the view's style hashes>; connect-src 'self'; frame-src 'self'
  ```

  The board page's policy names no `img-src` or `font-src`, because AD-8 names none. The stand-in keeps that on purpose: a blocked `blob:` image or `data:` font in the view is a finding for AD-8 (group 3), not a harness fix.
- **The harness** (design decisions 2 and 3; task 1.5):
  - `bun run build` (`build.ts`) builds every chunk as a classic IIFE with `Bun.build`, minified, for the browser. A build plugin maps imports of React, ReactDOM, the JSX runtime and the port to the shell's `__askboard.modules` global, and imports of `radix-ui` to the `lib-radix` library chunk. The chunks a chunk imports from become its `needs`. Tailwind 4.3.3 builds each chunk's stylesheet from that chunk's own sources. The shell's stylesheet adds DESIGN.md's tokens, read from its front matter: light and `-dark` values as CSS variables, with the `.dark` switch. `dist/manifest.json` lists, per chunk: its kind, the chunks it needs, the components it registers, the SHA-256 of its script and style, raw and gzip bytes, its local and package inputs (Bun's metafile), and its licence notices (`dist/notices/<chunk>.txt`).
  - `assemble.ts` builds a board's srcdoc and a Snapshot file with one function. It inlines the instrumentation, the shell, the renderer chunk, and the chunks the board's item types need, in that order. It also writes the `askboard-data` block and the view policy.
  - `board.ts` is the board-page stand-in: `Bun.serve` on `127.0.0.1`, random port. It serves `/b/<fixture>` with the board policy as a header. Its one script fetches `/v/<fixture>`, marks `t0` and sets the iframe's `srcdoc`; the iframe has exactly `sandbox="allow-scripts"`. `/s/<fixture>` serves the Snapshot file. `/leak/*` logs any request that escapes the view. `?control=1` serves the control page: no CSP and no sandbox.
  - `shell/instrument.ts` is the view's first script. It records `securitypolicyviolation` events, errors and rejections. It wraps `localStorage`, `sessionStorage`, `indexedDB`, `caches`, `document.cookie`, `Worker` and `SharedWorker`, records each access and lets the browser's own result or error through. It also records `<style>` and `<link>` elements added after parsing, and posts everything to the board page.
  - The shell's ready tracker: an item is ready when its component calls `ready()`. Components do that after their async work has settled and one animation frame after layout. The question counts as visible when every item is ready. At that moment the tracker posts every item's box, and it posts them again 1 s later.
  - `drive.ts`: `bun drive.ts <run> [--fixtures] [--engines] [--renderers] [--repeat] [--control] [--snapshot] [--color-scheme] [--script loads|compare|c2]`. Each load runs in a fresh browser context at 1280×800. The driver waits for "visible", or 30 s, then 1.3 s more. It asks the view to check the fixture's element and to dump its DOM, collects everything, and takes a screenshot.
- **Verdict rule** (design decision 2):
  - **pass:** no violation, no request other than the stand-in's own, no storage or worker error, no script error, the question is visible, the fixture's element shows its text, and every `<style>` the view carries has applied (`document.styleSheets` against `<style>` elements).
  - **probe:** as pass, except that the only violations are blocked `eval` probes that the library catches. The product owner decides whether CI tolerates these.
  - **fail:** anything else, with the reasons. **untested:** with the reason.
  - A negative fixture is **caught** when every expected signal shows (a violation with the named directive, a storage error, or no request), and **missed** otherwise.
- **What the harness taught us** (each shown by a run named below):
  - **Both policies report.** Chromium, Chrome, Edge and Firefox fire one `securitypolicyviolation` per policy: one for the view's meta policy and one for the inherited board policy. The event's `originalPolicy` tells them apart (run `negative`).
  - **WebKit reports eval to the board page.** WebKit reports a blocked `eval` or `new Function` once, to the board page's document, under the board policy. The view gets no event. The driver therefore collects violations from both documents (run `negative`, `neg-eval` and `neg-function` in `webkit`).
  - **The board policy does not stop the view's requests.** Its `connect-src 'self'` allows the session process's origin, so only the view's meta policy reports a `fetch` (run `negative`, `neg-fetch`: one `connect-src` event per engine, from the view policy). The view's meta policy is therefore load-bearing for `connect-src`, and also for `img-src` and `font-src`.
  - **Firefox's favicon.** Firefox requests `/favicon.ico` for the board page itself, and the board policy blocks it (`img-src` falls back to `default-src 'none'`). The board page receives a violation and Firefox logs an error from `FaviconLoader.sys.mjs`. This is the browser's request, not the view's: the driver records it as `browserFavicon` and does not count it. A product board page needs a favicon rule.
  - **WebKit screenshots inject a stylesheet.** In WebKit, a Playwright screenshot injects a stylesheet that the CSP refuses. WebKit logs "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive" but fires no violation event. A standalone page with a hashed `<style>` logs nothing after `goto`, and one line after `page.screenshot()`, with `caret` set to `initial` or left at its default. The driver tags console lines logged during the screenshot (`phase: "screenshot"`) and ignores them.
  - **React's `useId` values differ between mounts.** DOM comparisons after a remount therefore replace them with a placeholder. Two fresh loads compare raw.

## Documentation read (task 1.1, 2026-10-29)

These differences from SOLUTION-DESIGN §9 and §10.3, from EXPERIENCE.md, Composition and Components, and from AD-8 and AD-9 come from the installed packages' own files. Paths are relative to `probe/node_modules/.bun/`. Each is the input of the task that settles it.

| # | Design says | The package says | Source | Settled in |
| --- | --- | --- | --- | --- |
| D1 | S-1: Mermaid 12.2.0 lists elkjs as a dependency; strip it from the build | ELK is Mermaid's **default** layout ("Defaults to `elk`, which is bundled with mermaid"), registered through a dynamic `import("./elk-…mjs")` that imports `elkjs/lib/elk.bundled.js`. Mermaid falls back to dagre only when `elk` is not registered. Stripping elkjs therefore also needs `layout: 'dagre'` and `layout` in `secure` | `mermaid@12.2.0/…/dist/config.type.d.ts:85`; `chunks/mermaid.core/chunk-DSNLSHJZ.mjs:4675` (`"layout": "elk"`); `chunk-EJLWFMJV.mjs:66`, `:113-121` | 3.1 |
| D2 | Mermaid with `htmlLabels: false` | Only the top-level `htmlLabels` is current: per-diagram settings (`flowchart.htmlLabels`) "are deprecated". The effective default is `true` | `config.type.d.ts:233`; `chunk-DSNLSHJZ.mjs:5295` | 3.1 |
| D3 | AD-8: agent content is data | Mermaid's default `secure` list leaves out `htmlLabels`, `layout`, `theme`, `themeVariables`, `themeCSS` and `fontFamily`, so a diagram's own init directive can change them. AskBoard must add them to `secure` | `chunk-DSNLSHJZ.mjs:4684-4690`; `config.type.d.ts:268` | 3.1, 3.6 |
| D4 | Mermaid text measurement when its injected styles are blocked | `render` inserts a temporary SVG into `document.body`, then a `<style>` element with the theme rules (`document.createElement("style")`), before it draws. With a container it also sets a `style` attribute (`font-family`). d3's `.style()` writes go through the CSSOM, which the CSP allows. `securityLevel: 'sandbox'` frames a `data:text/html` URL, which `frame-src 'none'` blocks, so only `strict` is usable | `mermaid@12.2.0/…/dist/mermaid.core.mjs:1330`, `:1361-1363`, `:1263`, `:1391` | 3.5 |
| D5 | EXPERIENCE.md: KaTeX 0.19.1 | Mermaid declares `katex` ^0.18.0 and loads it with `await import("katex")`: the probe installs KaTeX 0.18.10 beside 0.19.1 | `mermaid@12.2.0/…/package.json:70`; `chunk-DSNLSHJZ.mjs:5480` | 3.1 |
| D6 | AD-8: `'wasm-unsafe-eval'` only for a WASM formula engine | `@plantuml/core`'s `viz-global.js` is Viz.js 3.24.0, Graphviz compiled to WebAssembly (`WebAssembly.instantiate` on an embedded module). Without it, "diagrams that need Graphviz fall back to the Smetana layout engine". No `fetch`, `XMLHttpRequest`, `eval`, `new Function`, `Worker` or `WebAssembly` in `plantuml.js` (text search) | `@plantuml+core@1.2026.9/…/viz-global.js:1-9`; `GITHUB_INTEGRATION.md:287-288` | 3.2 |
| D7 | Criterion 3: no network | Themes, emoji, OpenIconic and the stdlib load by "a script tag with a relative URL" unless the host supplies them (`PLANTUML_THEMES`, `PLANTUML_STDLIB_LOADER`, `PLANTUML_FILE_LOADER`); Viz goes in through `globalThis.PLANTUML_VIZ`. A hash-only `script-src` blocks script tags by URL | `GITHUB_INTEGRATION.md:229`; `README.md:34-38`, `:62-66`, `:86-93` | 3.2, 3.3 |
| D8 | Criterion 5: sponsored images suppressed | No option is documented. The LICENSE says PlantUML "can occasionally display sponsored or advertising messages" on welcome or error images | `@plantuml+core@1.2026.9/…/LICENSE:40-41` | 3.4 |
| D9 | §9: `@plantuml/core` used as its MIT tarball | `viz-global.js` holds "Graphviz … Expat" "in object code form" with no licence text; the LICENSE credits the themes and Twemoji without licence text | `viz-global.js:1-8`; `LICENSE:70-71` | 3.2 |
| D10 | EXPERIENCE.md, Diff review: highlighting class-based, or off in v1 | `@pierre/diffs` writes token colours as inline `style` attributes (`` `color:${token.color}` ``, then `setAttribute("style", …)`, into `innerHTML`). `useCSSClasses` is declared, but no code reads it. The layout itself uses inline styles too (`grid-row: span …`, a CSS variable on `<pre>`), so turning highlighting off does not avoid `style` attributes | `@pierre+diffs@1.6.2+…/dist/utils/tokenStyle.js:18`; `utils/createSpanNodeFromToken.js:5`; `types.d.ts:349`; `DiffHunksRenderer.js:979`; `utils/createPreElement.js:19` | 4.2 |
| D11 | AD-8: styles only by hash | `@pierre/diffs` renders in an open shadow root. It puts its theme in a `<style>` there, and its base CSS in a constructed `CSSStyleSheet` through `adoptedStyleSheets`. Whether a hash-only `style-src` blocks constructed stylesheets is untested | `utils/hostTheme.js:14`; `components/web-components.js:12-15` | 4.2 |
| D12 | §10.3: highlighting under the CSP | Its default engine is Shiki's JavaScript regex engine (`"shiki-js"`), which needs no `eval` or WASM. `shiki-wasm` and `highlights` need WebAssembly; workers run only through a host `workerFactory` | `dist/constants.js:30`; `README.md:3-4`; `utils/canUseWASM.js:5-7`; `worker/types.d.ts:102` | 4.2 |
| D13 | Form library, item 1: a no-op validator | The `validator` prop is required and `noValidate` is deprecated, so a no-op `ValidatorType` (`validateFormData`, `isValid`, `rawValidation`) is the supported route. `extraErrors` are non-blocking by default. `showErrorList` defaults to `top` and needs `false`, which the design does not say | `@rjsf+core@6.11.0+…/lib/components/Form.d.ts:14`, `:113`, `:122`, `:157`; `@rjsf+utils@6.11.0+…/lib/types.d.ts:1027-1062` | 4.4 |
| D14 | Form library, items 2 and 3 | Confirmed: `tagName` ("submitting when the `Enter` key is pressed, may no longer work"); `ui:submitButtonOptions.norender` removes the submit button; `ui:enumNames` is supported, not deprecated, as an array or a record. Multiple picks take their labels from the items' uiSchema | `Form.d.ts:102-106`; `types.d.ts:868-869`, `:925-928`; `lib/components/fields/ArrayField.js:128` | 4.4 |
| D15 | Form library, item 4: Markdown in descriptions off | Off unless `enableMarkdownInDescription` is set, but `markdown-to-jsx` is a hard dependency that other fields import, so it ships in the bundle | `types.d.ts:388`; `lib/components/RichDescription.js:12` | 4.4, 5.1 |
| D16 | AD-9: no edit state in a component | RJSF's `Form` keeps its own `formData` in state, even when controlled through the `formData` prop | `Form.d.ts:18-22`, `:232` | 4.4 |
| D17 | Form library, item 5: `@rjsf/validator-ajv8` compiles with `eval` | It also offers precompiled validators "avoiding dynamic code compilation when prohibited by a browser's Content Security Policy". They are compiled per schema at build time, and a Form's schema arrives with the ask, so S-4's conclusion stands (an inference) | `@rjsf+validator-ajv8@6.11.0+…/lib/compileSchemaValidators.d.ts:6-7` | 4.4 |
| D18 | AD-9: no state of its own in the renderer | json-render keeps an internal store unless a `store` is passed ("The store is the single source of truth"). It also has two-way `$bindState`, `watch`, and the built-in actions `setState`, `pushState`, `removeState` and `validateForm`, which overlap the draft record and the compute graph | `@json-render+react@0.21.3+…/README.md:208`, `:388`; `@json-render+core@0.21.3/…/README.md:393` | 2.2 |
| D19 | AD-8: agent content is data | json-render resolves `$state`, `$bindState`, `$cond`, `$template` and `$computed` objects in any prop value. The probe's adapter therefore passes only the item ID through json-render's props | `@json-render+react@0.21.3+…/README.md:313-358` | 2.1 |
| D20 | AD-10: fail closed | json-render's `ElementErrorBoundary` renders `null` for a component that throws and only calls `console.error`: the item disappears and never reports ready | `@json-render+react@0.21.3+…/dist/index.mjs:801-825` | 2.2 |
| D21 | Exit criterion 1: no `'unsafe-eval'` | json-render depends on zod 4.6.7, which probes `new Function` unless `jitless` is set. zod's own comment says "strict CSPs report the caught `new Function` as a `securitypolicyviolation`". json-render's sources also hold two `fetch` calls (`ai-gateway.vercel.sh`, `useUIStream`); the built chunk contains neither (`grep -c 'fetch(' dist/chunks/renderer-json-render.js` gives 0) | `zod@4.6.7/…/v4/core/util.js:219`; `@json-render+core@0.21.3/…/dist/index.mjs:3336`; `@json-render+react@0.21.3+…/dist/index.mjs:1670` | 2.3 |

The citations of D1, D4, D6, D8, D10, D20 and D21 were re-read by hand; the others come from the same reading.

## Adoption (task 1.2, run on 2026-10-29)

`GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts 2026-10-29` writes `evidence/adoption.json`. Licences are classified by the repository's own `tools/check-licences.ts`. Stars, last push and the archived flag come from the GitHub API, and the last release is the npm publish date of the `latest` tag. The rule on that date: a push since 2026-04-29, a release since 2025-10-29, at least 1,000 stars.

| Package | Pin | Role | Licence | Stars (repository) | Last push | Last release (latest) | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `@atlaskit/pragmatic-drag-and-drop` | 4.0.0 | direct | Apache-2.0 | 12,789 (atlassian/pragmatic-drag-and-drop) | 2026-10-29 | 2026-09-24 (4.0.0) | Pass |
| `@dagrejs/dagre` | 3.1.3 | direct | MIT | 5,842 (dagrejs/dagre) | 2026-10-24 | 2026-10-24 (3.1.3) | Pass |
| `@json-render/core`, `@json-render/react` | 0.21.3 | direct | Apache-2.0 | 18,843 (vercel-labs/json-render) | 2026-10-29 | 2026-10-24 (0.21.3) | Pass (0.x) |
| `@modelcontextprotocol/core`, `client`, `server` | 2.4.0 | direct (ext-apps peers) | Apache-2.0 | 13,679 (modelcontextprotocol/typescript-sdk) | 2026-10-28 | 2026-10-23 (2.4.0) | Pass |
| `@modelcontextprotocol/ext-apps` | 2.0.4 | direct | MIT | 3,026 (modelcontextprotocol/ext-apps) | 2026-10-29 | 2026-10-27 (2.0.4) | Pass |
| `@pierre/diffs` | 1.6.2 | direct | apache-2.0 | 6,384 (pierrecomputer/pierre, from design.md: the package names no repository) | 2026-10-29 | 2026-10-26 (1.6.2) | Pass |
| `@plantuml/core` | 1.2026.9 | direct | MIT | 13,385 (plantuml/plantuml) | 2026-10-29 | 2026-10-17 (1.2026.9) | Pass |
| `@rjsf/core`, `@rjsf/utils`, `@rjsf/validator-ajv8` | 6.11.0 | direct | Apache-2.0 | 15,924 (rjsf-team/react-jsonschema-form) | 2026-10-29 | 2026-09-29 (6.11.0) | Pass |
| `@tanstack/react-table` | 9.3.1 | direct | MIT | 28,533 (TanStack/table) | 2026-10-21 | 2026-10-12 (9.3.1) | Pass |
| `@xyflow/react` | 12.12.0 | direct | MIT | 38,821 (xyflow/xyflow) | 2026-10-29 | 2026-09-24 (12.12.0) | Pass |
| `dompurify` | 3.4.17 | direct | (MPL-2.0 OR Apache-2.0) | 17,494 (cure53/DOMPurify) | 2026-10-24 | 2026-10-12 (3.4.17) | Pass |
| `echarts` | 6.1.0 | direct | Apache-2.0 | 67,632 (apache/echarts) | 2026-10-13 | 2026-05-19 (6.1.0) | Pass |
| `katex` | 0.19.1 | direct | MIT | 20,479 (KaTeX/KaTeX) | 2026-10-29 | 2026-10-23 (0.19.1) | Pass |
| `markdown-it` | 15.0.3 | direct | MIT | 22,018 (markdown-it/markdown-it) | 2026-10-23 | 2026-10-16 (15.0.3) | Pass |
| `mathlive` | 0.111.1 | direct | MIT | 2,191 (arnog/mathlive) | 2026-10-23 | 2026-10-09 (0.111.1) | Pass |
| `mermaid` | 12.2.0 | direct | MIT | 90,920 (mermaid-js/mermaid) | 2026-10-29 | 2026-10-13 (12.2.0) | Pass |
| `radix-ui` | 1.8.1 | direct | MIT | 19,442 (radix-ui/primitives) | 2026-10-14 | 2026-10-12 (1.8.1) | Pass |
| `react`, `react-dom` | 19.3.1 | direct | MIT | 251,735 (react/react) | 2026-10-29 | 2026-10-14 (19.3.1) | Pass |
| `react-day-picker` | 10.0.2 | direct | MIT | 6,863 (gpbl/react-day-picker) | 2026-10-21 | 2026-09-30 (10.0.2) | Pass |
| `zod` | 4.6.7 | direct | MIT | 44,225 (colinhacks/zod) | 2026-10-29 | 2026-10-12 (4.6.7) | Pass |
| `tailwindcss`, `@tailwindcss/cli` | 4.3.3 | direct (build) | MIT | 98,009 (tailwindlabs/tailwindcss) | 2026-10-19 | 2026-07-16 (4.3.3) | Pass |
| `playwright` | 1.64.1 | direct (driver) | Apache-2.0 | 98,817 (microsoft/playwright) | 2026-10-29 | 2026-10-14 (1.64.1) | Pass |
| `elkjs` | 0.9.3 | S-1 (Mermaid's dependency) | EPL-2.0 | 2,863 (kieler/elkjs) | 2026-10-28 | 2026-10-28 (0.12.1) | Pass by the rule's text (EPL-2.0 unmodified); the addendum's avoid list names it |
| `react-arborist` | 4.0.1 | S-2 | MIT | 3,714 (jameskerr/react-arborist) | 2026-10-11 | 2026-10-11 (4.0.1) | Pass; its peer `react-dnd` ^16 fails |
| `react-dnd` | 16.0.1 | S-2 (react-arborist's peer) | MIT | 21,628 (react-dnd/react-dnd) | 2025-07-06 | 2022-04-19 (16.0.1) | Fail: push and release too old |
| `vis-timeline` | 8.5.6 | S-3 | (Apache-2.0 OR MIT) | 2,573 (visjs/vis-timeline) | 2026-10-29 | 2026-10-26 (8.5.6) | Pass; its peer `@egjs/hammerjs` ^2.0.0 fails |
| `@egjs/hammerjs` | 2.0.17 | S-3 (vis-timeline's peer) | MIT | 45 (naver/hammer.js) | 2021-02-01 | 2019-12-16 (2.0.17) | Fail: stars, push and release |
| `cmdk` | 1.1.1 | S-5 | MIT | 13,052 (pacocoursey/cmdk) | 2025-10-29 | 2025-03-14 (1.1.1) | Fail: push and release too old |
| `next-themes` | 0.4.6 | S-5 | MIT | 6,348 (pacocoursey/next-themes) | 2026-02-25 | 2025-03-11 (0.4.6) | Fail: push and release too old |
| `@fontsource/inter`, `@fontsource/jetbrains-mono` | 5.3.0 | fonts | OFL-1.1 | 508 (fontsource/font-files) | 2026-10-25 | 2026-07-19 (5.3.0) | Fail: licence outside the rule, stars under 1,000 |

- Every direct dependency of the probe passes.
- The fonts fail, so the probe does not adopt them. The view uses the system font stacks (`styles/base.css`; `--ab-font-sans` and `--ab-font-mono` in `dist/tokens.css`). **Awaiting PO:** the fonts' licence and source (task 8.1, row 19).
- **elkjs and the licence check.** The repository's licence check admits EPL-2.0 for unmodified dependencies, so it passes elkjs. Only the addendum's avoid list excludes it, and no check enforces that list. S-1's CI check has to name elkjs itself (task 3.1).
- **Dates that differ from design.md's table:** the `react-dnd` release is 2022-04-19 here (16.0.1 is `latest`), not 2022-06-25; the Tailwind release is 2026-07-16 (4.3.3), not 2026-10-19.

## The probe package and the licence check (task 1.3)

- `probe/package.json` pins the packages of design decision 1 exactly, except the fonts. Its `bunfig.toml` sets `linker = "isolated"` and `exact = true`, `tools/licence-overrides.json` holds `[]`, and `.gitignore` keeps `node_modules/`, `dist/` and `runs/` out of git. `tsconfig.json` sets the JSX transform.
- `bun install` installed 343 packages and wrote `bun.lock`. It blocked one lifecycle script, `@parcel/watcher`'s `node scripts/build-from-source.js`, a fallback that Tailwind's CLI does not need on this platform. `bun install --frozen-lockfile` reports "no changes".
- The repository's licence check, run from the repository root: `GITHUB_TOKEN=$(gh auth token) bun tools/check-licences.ts openspec/changes/spike-renderer/probe`. It completed with exit code 1: "343 installed packages, 33 for other platforms read from the npm registry, 29 direct dependencies, archive step: checked, 11 problems". Each problem is a finding; none is overridden:

  | Problem as printed | Comes from | Meaning |
  | --- | --- | --- |
  | `argparse@3.0.4: licence PSF-2.0 is outside the adoption rule` | `markdown-it` 15.0.3 (its CLI) | The Markdown renderer brings a licence outside the rule. Only the CLI uses `argparse`, so it never reaches a chunk (to confirm in 4.1), but the check counts every package in the lockfile |
  | `khroma@2.1.0: no licence` | `mermaid` 12.2.0 | The package.json has no `license` field. The package ships a `license` file; reading its text is task 3.1 |
  | `robust-predicates@3.0.3: licence Unlicense is outside the adoption rule` | `mermaid` → `d3` → `d3-delaunay` → `delaunator` | Unlicense is not in the rule's list |
  | `@pierre/diffs: no GitHub repository in its package.json` | direct | The archive step cannot check it; `tools/adoption.ts` checks `pierrecomputer/pierre` from design.md's hint |
  | `@tailwindcss/oxide-wasm32-wasi@4.3.3: bundles dependencies, which this check cannot see` | `@tailwindcss/cli` | The WASI fallback of Tailwind's engine (`cpu: none`) |
  | `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`, `tslib@2.8.1`: "listed in bun.lock but not installed" | the same WASI package's bundled dependencies | The check takes these for missing installs. They carry no `os` or `cpu` field of their own |

  Three of these (argparse, khroma, robust-predicates) concern view components the UX chose. The Tailwind ones concern the build tool. If these packages enter the root lockfile in the `view` epic, the root `check:licences` fails the same way. The product owner decides (task 8.1, row 20).
- `git diff --exit-code origin/main -- package.json bun.lock packages/` at the repository root is empty, and the root `bun run check` passes: 226 tests, import and licence checks clean.

## Harness (task 1.5)

### Run `smoke`

`bun drive.ts smoke --fixtures hello --renderers own,json-render,json-render-jitless`. The `hello` fixture holds one harness item. The verification is the own renderer's column; the json-render columns are input for group 2.

| Engine | own | json-render | json-render-jitless |
| --- | --- | --- | --- |
| `chromium` | pass, visible 31.9 ms | probe (2 eval probes) | pass |
| `firefox` | pass, 50 ms | probe (2) | pass |
| `webkit` | pass, 102 ms | probe (1, on the board page) | pass |
| `chrome` | pass, 27.6 ms | probe (2) | pass |
| `msedge` | pass, 36.1 ms | probe (2) | pass |

- Every own load: zero violations in either document (apart from Firefox's favicon on the board page, above), zero requests besides `/b/hello` and `/v/hello`, `self.origin` `"null"` in the view, both `<style>` elements applied, and the page background is the token colour `rgb(247, 245, 240)`.
- **As a Snapshot** (run `smoke-snapshot`, `--snapshot`: the Snapshot file opened from `file://`), the result is the same in every engine: own passes, json-render shows one eval probe, json-render-jitless passes. The first WebKit load took 2,524 ms to visible; that is one cold sample, and group 3 measures time.
- **In the control page** (run `smoke-control`, `--control`: no CSP, no sandbox), all three renderers pass in every engine.

### Run `negative`

`bun drive.ts negative --fixtures pos-cssom-style,neg-style-attribute,neg-style-element,neg-inline-handler,neg-eval,neg-function,neg-fetch,neg-form,neg-local-storage,neg-worker,neg-chunk`. Each negative fixture holds one probe item, so whatever it triggers belongs to it. The result: 50 of 50 caught, and the positive control passes in all five engines.

| Probe (fixture) | Signal in every engine | Per engine |
| --- | --- | --- |
| `style` attribute set from script (`neg-style-attribute`) | `style-src-attr` | 2 events in the view, one per policy |
| `<style>` injected at run time (`neg-style-element`) | `style-src-elem` | 2 events in the view |
| Inline event handler, then a click (`neg-inline-handler`) | `script-src-attr`; the handler does not run | 2 events in the view |
| `eval` (`neg-eval`) and `new Function` (`neg-function`) | `script-src`, blocked URI `eval`; `EvalError` thrown | 2 events in the view in Chromium, Chrome, Edge and Firefox; in WebKit 1 event, **on the board page**, under the board policy |
| `fetch("/leak/fetch")` (`neg-fetch`) | `connect-src`, from the view policy only; no request reached the stand-in | 1 event in the view |
| `<form>` submission with `requestSubmit()` (`neg-form`) | No request to `/leak/form`, and the view still answers afterwards | Chromium, Chrome, Edge and WebKit log "Blocked form submission … the form's frame is sandboxed and the 'allow-forms' permission is not set". **Firefox blocks it silently**: no console line, no violation |
| `localStorage.getItem` (`neg-local-storage`) | The wrapper records `localStorage` throwing `SecurityError`; no violation | same everywhere |
| `new Worker(blob:…)` (`neg-worker`) | `worker-src`; the constructor returns, and the worker never loads | 2 events in the view |
| A chunk hashed in the view policy only (`neg-chunk`) | `script-src-elem` and `style-src-elem` under the board policy; the chunk's component never registers, and the rest of the view renders | 2 events in the view |
| React `style` prop (`pos-cssom-style`, positive control) | none: CSSOM writes are allowed | pass |

**Control run `negative-control`** (`--control`, the same fixtures without CSP or sandbox): every probe ran in every engine. Each negative fixture is "missed" there and `pos-cssom-style` passes. The stand-in logged five `GET /leak/fetch` and five `POST /leak/form`, one per engine. Each probe therefore does what it claims, and the CSP run is what stops it.

## The renderer: the port, the two candidates and the atoms (task 2.1)

- **The port stand-in** (`port/index.ts`, 125 lines with the draft store and helpers). A component receives `{ item, draft, ui, graph, emit, ready }`:
  - `item`: its item from the board document;
  - `draft` and `ui`: its slices of the draft record (`values`, and view state such as the open tab);
  - `graph`: the compute graph's values (static here);
  - `emit`: typed view messages (`draft.set`, `ui.set`);
  - `ready()`: called once its work has settled.

  Components register with `register(type, component)`. Both renderers put the same `ItemFrame` (`<div data-item-id data-item-type>`) around every item; the ready tracker measures its box.
- **Own renderer** (`renderers/own.tsx`, 46 lines): a recursive render of the item tree through the registry. Each item reads its slice of the draft record with `useSyncExternalStore`.
- **json-render adapter** (`renderers/_json-render-adapter.tsx`, 125 lines, plus a 7-line entry per variant):
  - It maps the item tree to json-render's flat spec (`root`, `elements`), with a synthetic root element for the board's top-level list.
  - It wraps every registered component once into json-render's registry.
  - It mounts `JSONUIProvider` with `store`, a `createStoreAdapter` over the draft record. Reads go through `useStateValue`, writes through `useStateStore().set`.
  - Only the item ID passes through json-render's props (D19).
  - Two variants: `json-render`, as documented, and `json-render-jitless`, which sets zod's `config({ jitless: true })` before json-render builds its schemas (`renderers/_zod-jitless.ts`, imported first).
- **Atoms and layouts**, registered once, one chunk each: Text, Value, TextField, NumberField, Choice, Toggle, Stack, Row, Group and Tabs.
  - Choice is built on Radix Radio Group (single) and Checkbox (multiple), Toggle on Radix Switch, and Tabs on Radix Tabs (EXPERIENCE.md, Atoms). The four come from the `lib-radix` library chunk (43,965 bytes, 13,756 gzip, in the group 2 build; 145,266 and 47,208 in the current build, with the primitives group 4 added), which the three chunks need.
  - NumberField is a text input with a locale parser, never `type="number"`.
  - Row sets relative widths through React's `style` prop, which writes through the CSSOM.
  - Tabs keeps the open tab in the draft record (`ui`). It mounts every panel (`forceMount`) and hides the inactive ones with a class. Without that, the items of an inactive tab never mount, never report ready, and the question never counts as visible. **The `view` epic needs the same rule for any container that hides items.**
- **Imports** (AD-1's rule for `widgets`): `bun tools/imports.ts --self-test` prints "a renderer import and a shell import are flagged, the port is not" and "14 files in components/, 0 violation(s)". A component imports only React, the port, files of `components/` and its own library (`radix-ui` for Choice, Toggle and Tabs).
- **Run `atoms`** (`bun drive.ts atoms --script compare --fixtures atoms --renderers own,json-render,json-render-jitless`). The `atoms` fixture holds every atom and layout above under a Stack: 16 items. In all five engines, both json-render variants give a DOM identical to the own renderer's, character for character, without normalising: 7,228 characters, or 7,232 in WebKit's serialisation. The verdicts: own **pass**, json-render-jitless **pass**, and json-render **probe**: zod's blocked `new Function`, 2 events in the view, or 1 on the board page in WebKit. Radix Radio Group, Checkbox, Switch and Tabs therefore run under the view CSP with no violation, and group 4 extends this to the full matrix.

## Criterion 2 (task 2.2)

Run `c2`: `bun drive.ts c2 --script c2 --renderers own,json-render,json-render-jitless`, in every engine. Per renderer and engine it makes six loads under the CSP: `atoms` twice, `atoms` with edits, `delayed`, and `delayed-early`.

| Check | How | own | json-render | json-render-jitless |
| --- | --- | --- | --- | --- |
| Determinism | Two fresh loads of `atoms` give the same DOM, raw | pass ×5 | pass ×5 | pass ×5 |
| No edit state | Edits: a text field, a number field, a radio, a checkbox, two switches and a tab. Then unmount and remount from the draft record. The values, the draft record and the DOM are the same (the DOM after the Radix bookkeeping below is set aside) | pass ×5 | pass ×5 | pass ×5 |
| Reads the draft record | After the remount, the board page writes `tf1` into the draft record (`setDraft`); the field shows it | pass ×5 | pass ×5 | pass ×5 |
| No network | No request other than the stand-in's own, and no `connect-src` violation, in any of the loads | pass ×5 | pass ×5 | pass ×5 |
| Ready after async work | `delayed`: the item settles 700 ms after mount and reports ready 712–741 ms after mount. The boxes of all items are unchanged 1 s after the question counts as visible | pass ×5 | pass ×5 | pass ×5 |
| CSP verdict of the loads | design decision 2 | pass | probe (zod's eval probe) | pass |

×5: Chromium, Firefox, WebKit, Chrome and Edge.

- **The draft record after the edits:** `{"values": {"tf1": "Flaky upstream", "nf1": "3", "c1": "expo", "c2": ["get"], "tg1": true, "tg2": true}, "ui": {"tb1": "1"}}`. It is identical before and after the remount in every engine and renderer.
- **json-render's state can be bound to the draft record.** Through `StateProvider`'s controlled mode (`store`), json-render holds none of its own: the remount restores every value from the draft record, and a write to the draft record from outside shows at once. Without `store` it keeps an internal store (D18).
- **What the strict comparison found** (`runs/c2/<engine>/c2.<renderer>.edited.html` against `.remounted.html`). The DOM differs only in Radix bookkeeping that a remount resets and that is not an edit:
  - Roving focus keeps the last-clicked radio and tab as the tab stop (`tabindex="0"`; after a remount, `-1`).
  - React's `useId` values (`_r_2_` against `_r_7_`).
  - Radix Presence's `animation-duration: 0s`, set through the CSSOM on a panel's first mount.

  The comparison sets these aside by name (`drive.ts`, `withoutTabStops`). Focus position is not in the draft record. If a reload must restore the keyboard tab stop too, that is a `view` epic decision; ACR-11 names only the open tab and the question in view.
- **The ready check has teeth.** The negative control `delayed-early` reports ready 10–32 ms after mount, before its work settles. Its boxes then change after "visible" in every engine and renderer (`boxesStable: false`), so the check catches a component that reports ready too early. The general verdict rule of design decision 2 does not include this box check: it runs in `c2`, and group 3 should apply it to the diagrams.

## Renderer comparison (task 2.3)

Run `renderers`: `bun drive.ts renderers --fixtures hello,atoms,delayed,throws,items-200 --renderers own,json-render,json-render-jitless --repeat 10 --repeat-only items-200`, in every engine. That is 42 loads per engine: the first four fixtures once per renderer, and `items-200` ten times per renderer. Bytes come from `dist/manifest.json` (`bun run build`, which records each package's bytes in the minified output from Bun's metafile).

| | own | json-render | json-render-jitless |
| --- | --- | --- | --- |
| **Criterion 1, view CSP** (`hello`, `atoms`, `delayed`, `items-200`; run `renderers`) | pass in all 5 engines, 0 violations | **probe** in all 5 engines: zod's blocked `new Function`, 2 events per load (28 in 14 loads), or 1 per load in WebKit, on the board page (14) | pass in all 5 engines, 0 violations |
| **Criterion 2** (run `c2`, § Criterion 2) | pass ×5 | pass ×5 | pass ×5 |
| **Same DOM as own** (run `atoms`) | — | yes, raw, ×5 | yes, raw, ×5 |
| **Renderer chunk, raw / gzip bytes** (the build of these runs; the current build in brackets, § Criterion 6) | 1,476 / 765 (the same) | 194,933 / 56,347 (159,692 / 47,007) | 194,962 / 56,366 (159,717 / 47,019) |
| What the chunk holds (bytes in the minified output; the current build in brackets) | the renderer, 637 | zod 130,440 (95,422); `@json-render/core` 40,239 (40,233); `@json-render/react` 21,767 (21,707); the adapter 1,461 | the same, plus the `jitless` line |
| **Adapter lines** (`wc -l`) | 46 (`renderers/own.tsx`) | 125 (`_json-render-adapter.tsx`) + 7 (entry) | 125 + 7 + 6 (`_zod-jitless.ts`) |
| **A component that throws** (`throws`, run `renderers`, every engine) | React unmounts the whole view. The view receives an `error` event, which reaches the board page. Never visible | The failing item disappears and the two others render. The error goes only to the console ("[json-render] Rendering error in <Throws>"), so the board page learns nothing. Never visible (D20) | same as json-render |
| **API churn** (0.x) | — | 18 minors in 8.5 months, from 0.4.0 (2026-02-05) to 0.21.3 (2026-10-24). 20 entries are labelled breaking: 0.4 (3), 0.5 (5), 0.6 (10), 0.9 (1), 0.20 (1). The repository was created on 2026-01-14, so the 12-month window covers its whole history | same |
| **Adoption** (§ Adoption) | own code | Apache-2.0, 18,843 stars, pass (0.x) | same |

Sources for the churn row: `gh api repos/vercel-labs/json-render/releases --paginate`, whose notes contain "breaking" for 0.4.0, core 0.5.0, 0.6.0, 0.9.0 and 0.20.0, and the root `CHANGELOG.md` from 0.16 on. The entries were counted from those notes.

**Render time of `items-200`** (one Stack with 199 atoms, 200 items): the median of 10 loads per engine, with the maximum in brackets, in ms. "From t0" runs from the board page setting the srcdoc to the question counting as visible, so it includes parsing every chunk. "From mount" runs from the renderer's mount to visible: the renderer's own work.

| Engine | own, from t0 | json-render, from t0 | jitless, from t0 | own, from mount | json-render, from mount | jitless, from mount |
| --- | --- | --- | --- | --- | --- | --- |
| `chromium` | 61.4 (62.3) | 79.7 (81.0) | 73.6 (75.6) | 42.5 (43.3) | 45.7 (47.3) | 45.6 (46.7) |
| `firefox` | 83 (87) | 107.5 (113) | 111 (114) | 56.5 (60) | 66 (69) | 66.5 (70) |
| `webkit` | 59.5 (62) | 73 (76) | 71.5 (73) | 47.5 (49) | 52.5 (56) | 51 (54) |
| `chrome` | 67.6 (70.0) | 74.7 (84.7) | 73.6 (79.2) | 53.0 (54.5) | 48.6 (49.3) | 47.3 (49.7) |
| `msedge` | 66.3 (67.4) | 83.1 (85.0) | 77.3 (80.1) | 50.6 (51.7) | 46.5 (47.2) | 46.3 (47.7) |

- **From t0**, json-render costs 6 to 28 ms more per load in every engine: in the build these runs used it had 193 KB more script to parse (158 KB in the current build, § Criterion 6). **From mount**, the two are within 10 ms of each other. json-render is slower by 3 to 10 ms in Chromium, Firefox and WebKit, and faster by 4 to 6 ms in Chrome and Edge.
- **What json-render contributes in this adapter:** the tree walk and a state context. The adapter switches off or bypasses everything else, for the reasons recorded above:
  - its props expressions, since agent content must stay data (D19);
  - its own state, replaced by the draft record (D18);
  - actions, watchers and validation, which AskBoard has elsewhere: the board protocol, the compute graph, field checks.

  It also brings zod, two thirds of its chunk, which needs `jitless` to keep the CSP clean.
- **A failing component** is contained differently. json-render hides it, and the board page cannot tell. The own renderer, as written, loses the whole view, but the board page receives the error. Either way the question never counts as visible, so nothing is answered on a partial board (AD-10). A product renderer should wrap each item in an error boundary that renders an error state and reports it to the board page. That is a few lines in the own renderer; with json-render it means replacing its boundary (`ElementErrorBoundary` is internal).
- The choice between the renderers belongs to the product owner (task 8.3); the proposed outcome goes in group 8.

## Diagrams: what group 3 added to the harness

- **Components.** `components/mermaid.tsx` registers `Mermaid`; `components/plantuml.tsx` registers `PlantUML`, with Graphviz (`viz-global.js`); `components/plantuml-smetana.tsx` registers `PlantUMLSmetana`, without it. They share `_diagram.tsx` and `_plantuml.tsx`.
  - `_diagram.tsx` renders the source to an SVG string and takes the hit map from that string. It shows the SVG as `<img src="blob:…">`, under an SVG overlay of hit regions. Each render carries a generation, and only the latest is applied. A failed render keeps the last good one and shows the renderer's message. The corrected source lives in the draft record.
  - The item reports ready once its image has loaded or failed, or its render has failed. The port's probe-only `trace()` hands the render time, the SVG text, the hit map and the image's outcome to the instrumentation.
- **Hit map without violations.** The hit map is measured on an off-screen copy of the SVG in the view. A document made by `DOMParser` takes the view's CSP, and Chromium reports every `style` attribute and `<style>` element it parses: 44 violations for one Mermaid flowchart, in a trial run made before this design and not kept. So the copy is parsed from the text with those removed, along with scripts, foreign objects and image sources, and measuring it reports nothing. The blob is made from the renderer's own text, unchanged.
- **Policy variants** (`csp.ts`, `VARIANTS`; `--variants` in the driver, `variants=` on the stand-in). Each is a candidate amendment of AD-8, measured as input to a proposed outcome, never the default:
  - `board-img-blob` adds `img-src blob:` to the board page's policy;
  - `wasm` adds `'wasm-unsafe-eval'` to `script-src` in both policies.
- **The verdict rule gains three checks** (`drive.ts`, `judge`):
  - each `expectDiagrams` item's latest render shows as a loaded `blob:` image;
  - each `expectAnchors` key is in the item's hit map;
  - no item's box moves between "visible" and 1 s later. This check ran only in `--script c2` until now; it now applies to every load.
- **Earlier verdicts hold** (run `regress-g3`, Chromium, Firefox and WebKit). `hello`, `atoms`, `delayed` and `pos-cssom-style` still pass, and `neg-style-element`, `neg-fetch` and `neg-chunk` are still caught. `delayed-early`, the ready rule's negative control, now fails in an ordinary load with "boxes moved after visible". No group 3 load failed that check.
- **Scripts.** `--script measure` (task 3.5) and `--script golden` (task 3.7). After any single load, each diagram's image and overlay are also screenshotted whole (`<fixture>.<renderer>.<item>.png`), since the 1280×800 viewport cuts tall boards.
- **Build** (`build.ts`):
  - `STUBBED` replaces `elkjs` with an empty module; the manifest lists it under `inputs.stubbed`.
  - Node built-ins a package imports are listed under `inputs.builtins`.
  - `<!--` is written as `\x3C!--` and counted in `escapedCommentOpens`; before, the build stopped on it. Mermaid has 3 occurrences (marked's regex, DOMPurify's strings) and PlantUML 15 (its Brotli dictionary), all in strings, templates or regexes.
- **Tools:**
  - `tools/diagram-fixtures.ts` writes the diagram fixtures;
  - `tools/diagram-report.ts <run>` summarises a run per fixture and engine;
  - `tools/check-elkjs.ts` is S-1's check;
  - `tools/check-file-scripts.ts` checks whether a page opened from `file://` runs a script tag with a relative URL (§ Criteria 3 and 4).

## S-1: Mermaid without elkjs (task 3.1)

**Build.** `bun run build` makes the `mermaid` chunk from `components/mermaid.tsx`. Every import of `elkjs` resolves to `module.exports = {}`. Mermaid's own ELK glue, `elk-QONTBCTQ.mjs` (MIT, Mermaid's code), stays in the chunk.

| | `mermaid` chunk | Control: `mermaid.core.mjs` built with elkjs |
| --- | --- | --- |
| Script, raw / gzip | 3,955,799 / 1,093,862 bytes (group 3 build; 3,800,778 / 1,039,692 in the current build, § Criterion 6) | 5,304,290 bytes raw |
| Style, raw / gzip | 2,387 / 947 bytes (`_diagram.tsx`'s classes) | — |
| elkjs among the inputs | none; `inputs.stubbed: ["elkjs/lib/elk.bundled.js"]` | `elk.bundled.js` |
| `org.eclipse.elk` | 0 | 342 |
| `Eclipse Layout Kernel` | 0 | 3 |
| `workerUrl` | 0 | 3 |
| `knownLayoutAlgorithms` | 0 | 1 |

- Source: `bun tools/check-elkjs.ts`, which prints "elkjs check: 0 problem(s)".
- The four identifiers occur in elkjs 0.9.3's `lib/elk.bundled.js` and survive minification. Mermaid's own glue uses option keys such as `elk.layered…` and the type name `ElkNode`, so those are not searched for.
- The control build shows that the search finds elkjs when it is there. Leaving elkjs out saves about 1.35 MB raw, against the group 3 build.
- **The licence check does not catch elkjs.** It admits EPL-2.0 for unmodified packages (§ Adoption), so S-1's CI check must name elkjs itself. `tools/check-elkjs.ts` is a model: no elkjs input in the manifest, no elkjs identifier in the chunk, and a control build that proves the search works.

**What `layout: elk` does** (run `mermaid`, every engine). AskBoard's configuration sets `layout: 'dagre'` and adds `layout` to `secure` (D1, D3).

| Fixture | Source | Result |
| --- | --- | --- |
| `mermaid-elk-secure` | the flowchart, with front matter `config: layout: elk` | The front matter's `layout` is dropped. The diagram renders with dagre, and its SVG is the flowchart fixture's, character for character (18,600 bytes, Chromium) |
| `mermaid-elk-open` | the same, under Mermaid's own `secure` list (`probe.secure: false`) | Mermaid loads its ELK glue, which calls `new ELK()` on the empty module. The render fails: "FFe.default is not a constructor" in Chromium, Chrome, Edge and Firefox; "Object is not a constructor (evaluating 'new FFe.default')" in WebKit. The Diagram shows the message and no image |

- Mermaid's default layout is `elk` (D1). Without `layout: 'dagre'` in the configuration, every flowchart of a stripped build would take the path `mermaid-elk-open` takes and fail (an inference from that run). Without `layout` in `secure`, an agent's front matter makes one fail (measured).

**The four fixtures render in every engine.** In all five engines Mermaid makes the SVG of the flowchart, sequence, class and state fixtures, under each of these policies:

| Run | Policy | What shows | Verdict |
| --- | --- | --- | --- |
| `mermaid` | AD-8 as written | The board policy blocks the image (`img-src`, § Criteria 3 and 4) | fail |
| `mermaid-blob` | variant `board-img-blob` | The image loads. Mermaid's style writes are still blocked (§ Diagram style writes) | fail |
| `mermaid-shim` | variant `board-img-blob`, with the style shim | The image loads, with 0 violations | pass, 5 engines × 4 fixtures |

Render time in run `mermaid-shim`: Mermaid's own work, from the call to the SVG text, in ms, one load each.

| Fixture | Chromium | Firefox | WebKit | Chrome | Edge |
| --- | --- | --- | --- | --- | --- |
| flowchart | 50.1 | 38 | 55 | 43.6 | 60.7 |
| sequence | 25.7 | 18 | 24 | 26.2 | 27.0 |
| class | 50.2 | 36 | 50 | 50.3 | 49.6 |
| state | 48.7 | 34 | 45 | 48.8 | 46.1 |

**The chunk's inputs and their licences** (`dist/manifest.json`). Bytes are each package's share of the minified chunk, in the group 3 build. In the current build (§ Sizes) the four largest shares differ by less than 0.2%, `lodash-es` falls to 42,009, `khroma` to 11,740, and `robust-predicates` and `delaunator` are gone (below).

| Licence | Packages | Members, the largest first |
| --- | --- | --- |
| MIT | 22 | `mermaid` 12.2.0 (1,713,538), `@mermaid-js/parser` 2.0.1 (662,594), `cytoscape` 3.34.4 (455,796), **`katex` 0.18.10 (278,683)**, `lodash-es` 4.18.1 (121,141), `layout-base` 1.0.2 and 2.0.1, `cose-base` 1.0.3 and 2.2.0, `marked` 16.4.2, `dagre-d3-es` 7.0.14, `roughjs`, `es-toolkit`, `@upsetjs/venn.js`, `cytoscape-fcose`, `cytoscape-cose-bilkent`, `dayjs`, `@iconify/utils`, `stylis`, `@braintree/sanitize-url`, `uuid`, `ts-dedent` |
| ISC | 32 | the d3 modules (`d3-selection`, `d3-shape`, `d3-scale-chromatic` and others) |
| Apache-2.0 | 5 | `chevrotain` 13.2.0 and its four `@chevrotain/*` packages (112,391 together) |
| BSD-3-Clause | 5 | `d3-sankey`, `d3-path` 1.0.9, `d3-ease`, `d3-shape` 1.3.7, `d3-array` 2.12.1 |
| MPL-2.0 OR Apache-2.0 | 1 | `dompurify` 3.4.17 (33,418) |
| none in `package.json` | 1 | `khroma` 2.1.0 (12,460); its `license` file is the MIT licence |
| **Unlicense** | 1 | **`robust-predicates` 3.0.3 (1,962)**, through `d3-delaunay` and `delaunator` |

- **Two KaTeX versions.** Mermaid brings its own KaTeX 0.18.10 for math in labels (D5): 278,683 bytes in this chunk. The LaTeX widget pins 0.19.1, so a board with both carries both.
- **Unlicense reaches the chunk** in the group 3 and 4 builds. `robust-predicates`, flagged by task 1.3's licence check, is in the Mermaid chunk and so ships with it. Since group 5's tree-shaking fix it is not: `robust-predicates` and `delaunator` are not among the current build's inputs, and `d3-delaunay` keeps 15 bytes (`dist/manifest.json`, built 2026-10-29T23:31:16Z, against `dist/variants/catch-all/manifest.json`). It stays in the lockfile, so the licence check still flags it. The product owner decides (row 20).
- The chunk's notices (`dist/notices/mermaid.txt`) carry each package's licence file; `khroma`'s comes from its `license` file.
- What else makes the chunk large, for criterion 6: Mermaid's own code (1.71 MB), its Langium parsers (`@mermaid-js/parser`, 0.66 MB) and cytoscape (0.46 MB, for the mindmap and architecture diagrams).

## PlantUML (task 3.2)

**Build.** Both chunks come from the npm tarball of `@plantuml/core` 1.2026.9 (`bun run build`, `dist/manifest.json`):

| Chunk | Holds | Script, raw / gzip | Style, raw / gzip |
| --- | --- | --- | --- |
| `plantuml` | `plantuml.js` and `viz-global.js`, the latter handed to the engine as `PLANTUML_VIZ` (bundled, the UMD attaches `Viz` to its exports, as the README says) | 4,643,642 / 1,664,453 | 2,100 / 879 |
| `plantuml-smetana` | `plantuml.js` only | 3,185,812 / 1,052,168 | 2,100 / 879 |

- `viz-global.js` adds 1,457,830 bytes raw and 612,285 gzip.
- Its UMD has a Node branch that calls `require("url")`. That branch never runs in a document, yet Bun bundles its browser stand-in for `node:url`: 8,126 bytes, listed under `inputs.builtins`, with no licence notice. A build plugin can replace it with an empty module, as for elkjs.

**The files of the tarball and their licences.** "Inlined" means the file is in a chunk.

| File | Inlined | What it holds | Licence and source |
| --- | --- | --- | --- |
| `plantuml.js` (3.2 MB) | both chunks | PlantUML compiled by TeaVM. It carries TeaVM's runtime (`teavm_meta`, "TeaVM") and the code the LICENSE credits: a Brotli decoder (its dictionary is in the file), CafeUndZopfli and ASCIIMathML | MIT: the tarball's `LICENSE`; the README says versions from 1.2026.6 on are MIT, earlier ones GPL-3.0-or-later. The repository `plantuml/plantuml` is LGPL-3.0 (GitHub API). The vendored parts: TeaVM Apache-2.0 (`konsoletyper/teavm`), Brotli MIT (`google/brotli`), CafeUndZopfli Apache-2.0 (`eustas/CafeUndZopfli`, 83 stars, last push 2019-11-25), ASCIIMathML MIT (`asciimath/asciimathml`). **The tarball carries none of their licence texts**, only credits for Brotli, CafeUndZopfli and ASCIIMathML |
| `viz-global.js` (1.4 MB) | `plantuml` only | Viz.js 3.24.0 with "Graphviz" and "Expat" "in object code form" (its header): Graphviz 14.1.1 (`Viz.graphvizVersion`) compiled to WebAssembly, embedded as base64 | Viz.js MIT (`mdaines/viz-js`, 4,356 stars). **Graphviz EPL-2.0** (`gitlab.com/graphviz/graphviz`, GitLab API). Expat MIT (`libexpat/libexpat`). The tarball carries no licence text for any of the three |
| `vendor/fflate-0.8.2.min.js` | no: only the demo page's `main.js` uses it | fflate 0.8.2 | MIT, `vendor/fflate-LICENSE.txt` |
| `emoji.js` (1.8 MB) | no | Twemoji's SVG paths | Twemoji: code MIT, **graphics CC-BY 4.0** (`twitter/twemoji` README); CC-BY-4.0 is not in the adoption rule's list |
| `themes.js` (319 KB) | no: AskBoard themes diagrams with skinparams | The `!theme` definitions, whose `author:` fields name Brett Schwarz (22 themes), Drakemor (8), Matthew Leather (6), future-architect (3) and others | The LICENSE credits "Themes (c) by Brett Schwarz" (`bschwarz/puml-themes`, MIT, 273 stars); the other authors' themes carry no licence |
| `openiconic.js` | no | Open Iconic's icons | MIT for the SVG markup (`iconic/open-iconic` README) |

- Graphviz is EPL-2.0, the licence of elkjs, which §9 excludes as a trap. The adoption rule admits EPL-2.0 only unmodified, and whether Viz.js's build of Graphviz is unmodified is not stated in the tarball. Keeping `viz-global.js` is therefore a licence decision as well as a CSP one (below). The product owner decides (task 8.1, row 9); the PRD addendum changes only if they do.
- The chunk notices (`dist/notices/plantuml*.txt`) hold the tarball's MIT `LICENSE` only. A product build must add the licence texts of TeaVM, Brotli, CafeUndZopfli and ASCIIMathML, and for the `plantuml` chunk those of Viz.js, Graphviz and Expat, from their repositories.

**What renders without `viz-global.js`, and whether it needs `'wasm-unsafe-eval'`.** Five fixtures (sequence, class, activity, component, state), each through both chunks, in every engine:

| Diagram | `plantuml-smetana`, AD-8 as written (runs `plantuml`, `plantuml-shim`) | `plantuml`, AD-8 as written (same runs) | `plantuml`, variant `wasm` (run `plantuml-wasm`) |
| --- | --- | --- | --- |
| sequence | renders | renders | renders |
| activity | renders | renders | renders |
| class | renders (Smetana) | **fails**: Graphviz cannot start | renders (Graphviz) |
| component | renders (Smetana) | **fails** | renders (Graphviz) |
| state | renders (Smetana) | **fails** | renders (Graphviz) |

- **`viz-global.js` needs `'wasm-unsafe-eval'`.** Under AD-8 as written, Graphviz's `WebAssembly.instantiate` is refused, and PlantUML answers with its crash image: "For some reason, dot/GraphViz has crashed. RootCause … CompileError … 'unsafe-eval' is not an allowed source of script". AskBoard turns that image into a render error (§ Criterion 5).
- **The smallest policy change** is `'wasm-unsafe-eval'` in `script-src` of both policies: the board page's inherited policy blocks WebAssembly too. AD-8 admits it only for a WASM formula engine. With it (run `plantuml-wasm`, with the style shim and `board-img-blob`), the five types pass in all five engines.
- **WebKit reports nothing.** Chromium, Chrome, Edge and Firefox fire a `script-src` violation with blocked URI `wasm-eval`, one per policy. WebKit fires none and only logs "Refused to create a WebAssembly object because 'unsafe-eval' or 'wasm-unsafe-eval' is not an allowed source of script". A CI check that relies on violation events misses it in WebKit. The error-image filter catches it in every engine.
- **Without `viz-global.js`, nothing needs WebAssembly.** PlantUML logs "falling back to the Smetana layout engine", and the three Graphviz types render. Of the five fixtures, only the class, component and state diagrams differ in layout; screenshots of both layouts are in `evidence/diagrams/` (task 6.1).

Render time in ms, PlantUML's own work from `renderToString` to the SVG text, one load each, the first render after the chunk loads:

| Diagram, chunk | Chromium | Firefox | WebKit | Chrome | Edge | Run |
| --- | --- | --- | --- | --- | --- | --- |
| sequence, `plantuml` | 82.7 | 93 | 112 | 76.9 | 99 | `plantuml-wasm` |
| sequence, `plantuml-smetana` | 79.5 | 97 | 101 | 73.3 | 117.9 | `plantuml-shim` |
| class, Graphviz | 107.5 | 121 | 138 | 109.3 | 113.6 | `plantuml-wasm` |
| class, Smetana | 103.7 | 119 | 131 | 101.3 | 99.1 | `plantuml-shim` |
| state, Graphviz | 107.6 | 130 | 137 | 107 | 109.7 | `plantuml-wasm` |
| state, Smetana | 107.2 | 120 | 133 | 107.4 | 102.4 | `plantuml-shim` |

- **Anchors** (run `plantuml-shim`). PlantUML marks participants and entities with their source name (`data-qualified-name`), and messages and links with their ends (`data-entity-1`, `data-entity-2`). The hit map finds 16 anchors in the sequence diagram, 5 in the class and component diagrams, and 10 in the state diagram (5 entities, 5 links).
- **Activity diagrams carry no such marks**, so the hit map finds no anchor there. The annotation overlay would need label-and-occurrence anchors taken from the text, a `view` epic item.

## Diagram style writes under the view CSP (criterion 1, the diagrams' share)

Both renderers set styles while they draw, and AD-8's hash-only `style-src` blocks every such write. Per render, counted once per policy (each blocked write fires one event under the view's policy and one under the board's):

| Where the write comes from | Mermaid flowchart, Chromium, Chrome, Edge | Mermaid flowchart, Firefox | Mermaid flowchart, WebKit | PlantUML golden sequence, every engine |
| --- | --- | --- | --- | --- |
| A script sets a `style` attribute in the live DOM: d3's `.attr("style", …)` in Mermaid's temporary SVG; PlantUML's `setAttribute("style", "white-space: pre")` on each text and a `style` on its root `<svg>` | 39 | 37 | 39 | 17 |
| Mermaid's `<style>` with the theme rules, inserted into its temporary SVG (D4) | 1 | 1 | 1 | — |
| DOMPurify parses the serialized SVG with `DOMParser` (`securityLevel: 'strict'`), and Chromium reports each `style` attribute and `<style>` element the parsed document holds | 44 + 1 | — | — | — |

Sources:
- The sites: `bun tools/diagram-report.ts mermaid-blob --sites chromium mermaid-flowchart` and `bun tools/diagram-report.ts plantuml --sites chromium plantuml-sequence` map each violation's line and column in the srcdoc onto the chunk. They find d3's `setAttribute`, Mermaid's `document.createElement("style")` then `insertBefore`, DOMPurify's `parseFromString`, and PlantUML's two `setAttribute("style", …)`.
- The counts come from runs `mermaid-blob` and `plantuml`, through `bun tools/diagram-report.ts`. Per fixture and engine, a Mermaid render fires 4 events (the sequence diagram, Firefox) to 202 (the class diagram, Chromium), a PlantUML render 13 to 52.

**The output does not change.** A blocked write still sets the attribute, so it stays in the SVG text. The text of `mermaid-blob`'s flowchart holds 44 `style` attributes and its `<style>` element, as the shimmed one does, and the image applies them, because an image's own styles are outside the page's CSP (AD-8). What the blocks do affect is Mermaid's measurement of labels in its temporary SVG (§ Mermaid text measurement).

**The style shim** (`props.probe.shim`; `withCssomStyles` in `_diagram.tsx`, `renderShimmed` in `mermaid.tsx`) is AskBoard code around the render. It does three things:
1. While a diagram renders, `Element.prototype.setAttribute("style", v)` becomes `element.style.cssText = v`. That is a CSSOM write, which the CSP allows. A `style` attribute in parsed markup is still blocked; only a script's own writes change route, and a script can already make them through the CSSOM.
2. Mermaid's `<style>` is not inserted. Its rules are applied as a constructed stylesheet through `document.adoptedStyleSheets`, which the CSP allowed in every engine (this settles D11's open question for constructed sheets). After the render, its text goes back into the SVG text.
3. Before DOMPurify parses the SVG text, ` style="` is renamed ` data-ab-style="`, and renamed back after. DOMPurify keeps `data-` attributes.

With the shim and the `board-img-blob` variant, every diagram fixture passes with 0 violations in all five engines:
- runs `mermaid-shim` (4 Mermaid fixtures);
- `plantuml-shim` (the 5 Smetana fixtures, and the sequence and activity diagrams through the Graphviz chunk);
- `plantuml-wasm` (the 5 Graphviz fixtures, with the `wasm` variant as well).

The shim is 77 lines, comments included: 26 in `_diagram.tsx` and 51 in `mermaid.tsx`.

- **The policy alternative** would be `'unsafe-inline'` for `style-src-attr` and `style-src-elem`, which AD-8 and criterion 1 forbid. Without the shim or that, Mermaid and PlantUML fail criterion 1 in every engine.
- **What the shim's third step means.** The renaming hides `style` attributes from DOMPurify's parse. DOMPurify allows `style` attributes by default anyway and never parses their CSS, and the SVG is only ever shown as an image, where no style can load anything. The product owner decides whether AskBoard carries the shim, or Mermaid's sanitizing step is dropped (`securityLevel: 'loose'`) as a smaller change. That alternative was not measured.

## Criteria 3 and 4: rendering inside the bundle, shown as `blob:` images (task 3.3)

Fixtures:
- four diagrams with the style shim: the Mermaid flowchart and sequence diagrams, the PlantUML golden sequence diagram, and the Smetana class diagram;
- `plantuml-resources`: a source that asks for a theme (`!theme cerulean`), a standard-library include (`!include <C4/C4_Context>`), an emoji and an icon, with AskBoard's refusing loader;
- `plantuml-resources-default`: the same source with the engine's own script-tag loader.

Each fixture loaded in every engine, 30 loads per run:

| Run | Where | Requests | `connect-src` violations | `img-src` violations | Image source per diagram | Verdict of the four diagrams |
| --- | --- | --- | --- | --- | --- | --- |
| `c3c4` | board, AD-8 as written | 0 | 0 | 24: one per diagram load, two in WebKit, all from the **board page's policy** | `blob:`, blocked | fail, 5 engines |
| `c3c4-snapshot` | Snapshot opened from `file://` | 0 | 0 | 0 | `blob:`, loaded | pass, 5 engines |
| `c3c4-blob` | board, variant `board-img-blob` | 0 | 0 | 0 | `blob:`, loaded | pass, 5 engines |

"Requests" counts any request besides the stand-in's own board page and view document. The `plantuml-resources-default` loader's attempts, below, are listed apart.

**Criterion 3 passes.** Mermaid and PlantUML render inside the view's bundle, with no Java, no server and no request, in every engine, on the board and in a Snapshot. Across the 330 loads of runs `mermaid`, `mermaid-blob`, `mermaid-shim`, `plantuml`, `plantuml-shim`, `plantuml-wasm`, `c3c4`, `c3c4-snapshot`, `c3c4-blob`, `sponsor`, `anchors` and `anchors-dark`, the view made no request (besides the blocked script tags of the engine's own loader, below), no worker and no storage access, and fired no `connect-src` or `worker-src` violation.

**Criterion 4 fails on the board under AD-8 as written.** Every diagram is an `<img>` whose `src` is a `blob:` URL (`blob:null/…`, made in the opaque view). The board page's policy names no `img-src`, so `default-src 'none'` blocks the image. The srcdoc inherits that policy, and the view's own `img-src data: blob:` cannot widen it (the hand-off's risk, now measured).
- **The smallest change** is `img-src blob:` in the board page's policy (variant `board-img-blob`). With it the four diagrams pass in all five engines (run `c3c4-blob`).
- A Snapshot has no board page, so its diagrams load as written (run `c3c4-snapshot`).
- **The same gap applies to `data:` images and `data:` fonts in the view** (an inference, not measured here). The board policy names no `font-src` either, so the fonts AD-8 inlines as `data:` URLs (KaTeX's, the bundled families) would be blocked the same way. Group 4's components that inline fonts should be run with and without the variant.

**PlantUML's script-tag loader** (`plantuml-resources-default`; D7). The engine makes `<script src="themes.js">` and `<script src="c4.min.js">`.
- **On the board** the relative URLs resolve against the board page's URL: `/b/themes.js` and `/b/c4.min.js` on the session process's origin. Both policies block them (`script-src-elem`, two events per script in every engine). Chromium, Chrome and Edge record each as a request that failed with "csp"; Firefox and WebKit record none. Had the policy allowed scripts by URL, these would have reached the session process.
- **In a Snapshot** they resolve to `file:` URLs in the Snapshot's own folder.
  - Chromium, Chrome and Edge block them under the view's policy.
  - WebKit refuses with "Not allowed to load local resource".
  - **Firefox does not apply `script-src` to them.** In the Snapshot run it only logged "Loading failed for the <script>", because no such file was there. `bun tools/check-file-scripts.ts` puts a `themes.js` beside a page opened from `file://` whose only allowed script is hashed. In Playwright's Firefox 157 the script runs ("script ran: true", no violation); in Chromium and WebKit it is blocked. The installed Firefox 124.0.2 runs it too (`--firefox`; its headless screenshot reads "SCRIPT RAN", `evidence/file-scripts/installed-firefox-124.png`). So in Firefox, a file placed next to a Snapshot runs if any code in the view makes a script tag with a relative URL.
- **AskBoard's refusing loader** (`plantuml-resources`): `PLANTUML_STDLIB_LOADER` answers every library, theme, emoji and icon load with an error. No script tag is made in any engine, on the board or in a Snapshot. PlantUML answers with its error image, and the Diagram shows "cannot include <C4/C4_Context> (line 14)" (§ Criterion 5). The refusing loader is therefore required, not a nicety: without it, a source the agent writes makes the view request the session process on the board, and run a local file from a Snapshot in Firefox.
- PlantUML's `!include` of a local file goes to `PLANTUML_FILE_LOADER`, which AskBoard does not set, so such an include fails in the same way (README).

**Task 3.3 stays open, awaiting PO.** Its runs are complete, but its verification asks for no `img-src` violation on the board, and under AD-8 as written there is one per diagram. It holds only with the board policy's `img-src blob:`, an AD-8 amendment the product owner decides (task 8.3).

## Criterion 5: PlantUML's sponsored messages (task 3.4)

Run `sponsor`, in every engine, with the style shim and the `board-img-blob` variant. AskBoard's filter (below) is on. The search runs on each SVG as PlantUML returned it, before the filter (`drive.ts`, `contentOf`): embedded `<image>` elements, `data:image/` URLs, and the text pattern `sponsor|advert|patreon|liberapay|paypal|professional|donat|plantuml.com|plantuml@|upgrad|qrcode`, with the `<?plantuml-src …?>` instruction left out.

| Fixture | Source | What PlantUML returns, through its success callback | Embedded images | Matches of the pattern | Shown |
| --- | --- | --- | --- | --- | --- |
| `sponsor-empty` | an empty source | An error image: "PlantUML version $version$ … [From textarea (line 1)] … Empty description (Assumed diagram type: sequence)", green on black | 0 | none | no: "Empty description (Assumed diagram type: sequence) (line 1)" |
| `sponsor-empty-diagram` | `@startuml` and `@enduml` only | the same, line 2 | 0 | none | no |
| `sponsor-error` | a syntax error | An error image: the source echoed, then "Syntax Error? (Assumed diagram type: sequence)" | 0 | none | no: "Syntax Error? (Assumed diagram type: sequence) (line 3)" |
| `sponsor-crash` | a class diagram while Graphviz cannot start | A crash image: "An error has occurred!", **a random quote** ("Reality is the only thing that's real" in Firefox, "Therese, c'est une catastrophe" in Chrome, a different one each load), the Java stack, then "You should send this diagram and this image to plantuml@gmail.com or post to https://plantuml.com/qa" and "Please go to https://plantuml.com/graphviz-dot" | 0 | `plantuml.com`, `plantuml@` | no: "For some reason, dot/GraphViz has crashed." |
| `sponsor-golden` | the golden source | the diagram | 0 | none | yes |

The table is the same in all five engines. The crash fixture's verdict is "fail" in Chromium, Chrome, Edge and Firefox because of the blocked WebAssembly (§ PlantUML), not because of anything shown.

**What 1.2026.9 holds.**
- No welcome image: an empty source gives "Empty description".
- No sponsored or advertising message on any image, and no embedded image. Text searches of `plantuml.js` find "sponsor", "advert", "professional" and "welcome" only inside its Brotli dictionary. They find no "patreon", "liberapay", "paypal" or "donat". The strings "Diagram source: (Use http://zxing.org/w/decode.jspx to decode the qrcode)" and "This version of PlantUML is … days old, so you should consider upgrading from https://plantuml.com/download" are in the code, and none of these runs produced either.
- The LICENSE's warning ("can occasionally display sponsored or advertising messages … on welcome or error images") matches the build only in that error images carry text AskBoard does not want shown: the random quote, the request to mail the diagram, and links to plantuml.com.

**The suppression** (`errorImage` in `_plantuml.tsx`). No renderer option suppresses these images (D8), so the filter works on the SVG before it becomes a blob:
- an SVG whose first text line starts with "PlantUML version " (empty source, syntax error, a refused include) or "An error has occurred" (crash) is an error image;
- it becomes a render error carrying PlantUML's message and line;
- the Diagram shows that message and keeps its last good render, as EXPERIENCE.md asks for a source that does not render (F-07).

Run `sponsor` shows no image for the four error fixtures, and the golden diagram shown, in every engine. So no PlantUML welcome, error or crash image reaches the board.

**Where the images come from.**
- PlantUML returns error and crash images through `renderToString`'s success callback; the error callback is kept for its own limits ("Diagram too large for browser rendering").
- The images carry no attribute that tells them from a diagram. Sequence, class, component and state diagrams carry `data-source-line` attributes and an error image has none, but neither do activity diagrams. The filter therefore relies on the first line's text, which a later PlantUML version may change. The `view` epic should pin a check of it, rendering an empty source and a syntax error in CI.

## Anchors and diagram theme (task 3.6)

Runs `anchors` (light) and `anchors-dark` (`--color-scheme dark`), with the style shim and the `board-img-blob` variant. Fixtures:
- `anchors-plantuml`: the golden PlantUML source;
- `anchors-mermaid`: the four Mermaid fixtures on one board.

Hit regions are drawn as dashed outlines (`props.showHits`). Each fixture lists the anchors its source calls for (`expectAnchors`, written by `tools/diagram-fixtures.ts` from the source, not from the output). The verdict fails on a missing one.

**Result:** both fixtures pass in all five engines, light and dark, with 0 violations. Every expected anchor is in the hit map (10 runs × 2 fixtures).

**How an anchor is keyed** (`<kind>:id:<source id>#<n>` or `<kind>:label:<label>#<occurrence>`; AD-7, F-62):

| Diagram | Anchors (Chromium; the same keys in every engine) | Taken from |
| --- | --- | --- |
| Golden, PlantUML | `participant:id:Customer#1`, `Web#1`, `API#1`, `Orders#1`, `Gateway#1` (the heads) and `#2` of each (the feet); `message:label:Place order#1`, `POST /checkout#1`, `create order#1`, `authorize payment#1`, `authorized#1`, `order confirmed#1` | `data-qualified-name` on `g.participant`; each drawn `g.message` group and its text |
| Mermaid flowchart | `node:id:A#1` to `E#1`; `edge:id:L_A_B_0#1`, `L_B_C_0#1` ("yes"), `L_B_D_0#1` ("no"), `L_D_C_0#1`, `L_C_E_0#1` | the node's element ID, `<render id>-flowchart-A-0`, with the source ID inside; `data-id` on the edge path |
| Mermaid sequence | `participant:id:Agent#1`, `Board#1`, `User#1` and `#2` of each; `message:label:ask(question)#1`, `show question#1`, `answer#1`, `answer delivered#1`; `note:label:draft record holds edits#1` | `data-et="participant"` and `rect.actor-bottom[name]`; `data-et="message"` with its `messageText`; `data-et="note"` |
| Mermaid class | `node:id:Ask#1`, `Answer#1`, `FollowUp#1`; `edge:id:id_Ask_Answer_1#1` ("receives"), `id_Ask_FollowUp_2#1` | as the flowchart (`…-classId-Ask-0`) |
| Mermaid state | `node:id:root_start#1`, `Open#1`, `Answered#1`, `Discarded#1`, `root_end#1`; `edge:id:edge0#1` to `edge4#1` | as the flowchart (`…-state-Open-2`); `data-id` on the edge path |

What the hit maps show:
- **Messages are keyed by label, never by the renderer's number.**
  - PlantUML numbers messages by position (`msg1` to `msg6`); Mermaid does too (`i0` to `i3`).
  - The golden flow's source edit moves "create order" from third to fifth place, so a pin keyed to `msg3` would land on "authorize payment".
  - Keyed by label, the pin follows its message: run `golden-time` reads `message:label:create order#1` at y = 149 before the edit and y = 205 after it, in every load (§ Golden case time).
- **Mermaid's state edges are positional too** (`edge0` to `edge4`), and the unlabelled ones have no label to fall back on. A reordered state source would move their pins. Keying them by their ends needs the source's transitions, which the SVG does not carry: a `view` epic item.
- **PlantUML draws each message twice**: an empty `g.message` placeholder first, then the drawn group, both with the same ID. Only the drawn one is an anchor. Its box joins the arrow and the label, and hit regions are at least 8 units across, so a straight edge stays clickable.
- **Hit regions sit on the drawn shapes.** The overlay is an SVG with the diagram's own `viewBox`, absolutely placed over the `<img>`. In the screenshots below, at the image's natural size, the outlines sit on the shapes. A scaled image was not measured; the overlay scales with the same `viewBox`.

**Diagram theme** (DESIGN.md, Diagram theme). At each render, the component reads the `diagram` tokens from the CSS variables (`--card`, `--foreground`, `--muted`, `--border-strong`, `--foreground-secondary`), so the `.dark` class re-points them.
- **Mermaid**: the `base` theme with the mapped `themeVariables`, `darkMode` for dark, and the sequence message font `--ab-font-mono` at 12px.
- **PlantUML**: the mapped skinparams after the `@start…` line, with `DefaultFontName sans-serif` and `ArrowFontName monospace`, because a CSS font stack does not fit a skinparam. Dark adds PlantUML's own `{ dark: true }`.
- With no parent host, the view follows `prefers-color-scheme` (`theme: system`), as a Snapshot does.
- A switch of the `.dark` class while a board is open re-renders each diagram (the component watches the class). That switch is task 4.6's run `theme`.

**Screenshots for the product owner** (task 6.1), each diagram whole with its hit regions drawn, in Chromium, Firefox and WebKit:
- `evidence/diagrams/light/<engine>/` and `evidence/diagrams/dark/<engine>/`: `plantuml-golden.png`, `mermaid-flowchart.png`, `mermaid-sequence.png`, `mermaid-class.png`, `mermaid-state.png`;
- `evidence/diagrams/layout/`: the PlantUML class, component and state fixtures laid out by Graphviz (`*-graphviz.png`, run `plantuml-wasm`) and by Smetana (`*-smetana.png`, run `plantuml-shim`), in Chromium, light.

**Awaiting PO** (task 6.1): the light and dark diagram themes, the hit regions, and the Smetana layouts against Graphviz.
- Seen by the probe, not judged: Mermaid 12 draws nodes in its `neo` look (`data-look="neo"`), with a soft shadow that shows as a light halo in dark. AskBoard's configuration does not set `look`, and `look` is in `secure`.

## Mermaid text measurement (task 3.5)

Run `measure` (`--script measure`, with the `board-img-blob` variant), in every engine. Two label-heavy fixtures, each holding the same source five times, once per way of measuring:
- `measure-flow`: a top-down flowchart with long node and edge labels;
- `measure-sequence`: three participants with long names, four long messages and a note.

Each board loads under the CSP and in the control page (no CSP, no sandbox). The method:
- The final SVG of each item is drawn in a page with no CSP, in the same engine, at one pixel per user unit. Its own `<style>` applies there, as it does inside the image.
- A label overflows when its text extends more than 0.5 px past its box: a node's shape, an edge label's background, a participant's or a note's rectangle, or for a message the span between its two lifelines.
- Each fixture has 8 labels per item.

Overflowing labels, out of 8:

| Way of measuring (`props.measure`) | flowchart, CSP | sequence, CSP | both, control |
| --- | --- | --- | --- |
| `none`: Mermaid as configured, the font Mermaid's default (`"trebuchet ms", verdana, arial, sans-serif`, 16px) | **2** in every engine | 0 | 0 |
| `shell-rule`: a rule in the hashed shell stylesheet gives Mermaid's temporary container (`div[id^="dmermaid-shell-rule-"]`, `styles/base.css`) that font and size | 0 | 0 | 0 |
| `cssom`: the same rule inserted through the CSSOM (`insertRule` on a hashed sheet) | 0 | 0 | 0 |
| `config`: Mermaid's `fontFamily` and `fontSize` set to the page's own (the shell's sans stack, 13px) | 0 | 0 | 0 |
| `shim`: the style shim, which applies Mermaid's own `<style>` as a constructed stylesheet (§ Diagram style writes) | 0 | 0 | 0 |

The two overflowing labels under `none` are both edge labels: text width against its background's width, overflow in px.

| Engine | "yes, within the time limit" | "no, or the gateway timed out" |
| --- | --- | --- |
| Chromium, Chrome, Edge | 183.2 against 150.2, 16.5 | 211.1 against 177.3, 16.9 |
| Firefox | 189.4 against 154.4, 17.5 | 217.3 against 181.5, 17.9 |
| WebKit | 183.3 against 150.5, 16.4 | 211.2 against 177.9, 16.6 |

**Why.** Under the CSP, Mermaid measures a label in its temporary SVG while its `<style>` is blocked (D4), so the text takes the page's font: the shell's sans stack at 13px. The image then draws the same text in the theme's font at 16px. The `config` item confirms it: drawn in the page's font, it has exactly the geometry of the `none` item.
- Flowchart labels are sized from that measurement: the edge-label backgrounds come out about 18% too narrow, and the diagram is laid out too wide and too short (491 × 586 user units, against 449 × 698 in the control run, Chromium).
- The sequence diagram is not affected: 0 overflows under the CSP. Mermaid sizes sequence text from its own font settings, written through the CSSOM (D4), so the blocked `<style>` does not change them (an inference from the code D4 cites).

**The chosen mitigation is the first in design decision 5's order, the shell rule: 0 overflowing labels in all five engines.**
- Its cost is one hashed rule in the shell stylesheet, which must name the same font and size as Mermaid's configuration.
- The CSSOM variant does the same at run time.
- `config` also reaches 0, by drawing the labels at the page's 13px. It changes how the diagrams look, and the product owner judges it on the screenshots.

**How close each comes to an unrestricted render** (viewBox of the flowchart; the same proportions in every engine):
- Chromium: shim 449.3 × 698.2, exactly the control's; shell rule and CSSOM 475.2 × 698.2; `config` 491.4 × 586.4.
- Firefox: shim 456.4 × 703.2, again the control's.
- WebKit: shim 449.3 × 696.2, again the control's.

With the shim, Mermaid lays out under the CSP as it does without one. If the product owner adopts the shim for criterion 1, the shell rule is not needed. The shell rule's diagram is 6% wider than the control's because other theme rules, such as edge-label padding, are still missing during measurement. No label overflows.

**Screenshots** (task 6.1), each item whole, in Chromium, Firefox and WebKit, in `evidence/measure/<engine>/`:
- `flow-none.png`, where the "yes" label runs past the left edge of the image and both edge labels run past their backgrounds;
- `flow-shell-rule.png`, `flow-cssom.png`, `flow-config.png`, `flow-shim.png`;
- `flow-control.png`, the same source with no CSP;
- the same six for `sequence-…`.

**Awaiting PO** (task 6.1): the Mermaid labels after the mitigation.

## Golden case time (task 3.7)

Run `golden-time` (`--script golden --repeat 20`, with the `board-img-blob` variant): 20 loads per fixture and engine, 300 loads, every one "pass". Each load opens a fresh browser context and assembles the view again; the browser process stays up. Fixtures:
- `golden`: the golden board with the PlantUML chunk that holds `viz-global.js`;
- `golden-smetana`: the same board with the chunk without it;
- `golden-text`: the same board with a Text in the diagram's place, the baseline.

The diagram carries the style shim. Times are from `t0`, when the board page sets the srcdoc, in ms: median (maximum).

| Engine | Fixture | Renderer's mount | PlantUML render starts | Render, its own time | Image loaded | Diagram ready | **Question visible** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chromium | `golden` | 134.7 (139.6) | 140.3 (145.4) | 83.7 (93.0) | 233.8 (252.3) | 235.7 (271.6) | **235.8 (271.6)** |
| | `golden-smetana` | 116.4 (120.5) | 121.8 (126.3) | 83.2 (86.9) | 215.0 (221.5) | 221.3 (225.3) | **221.3 (225.4)** |
| | `golden-text` | 18.7 (20.0) | — | — | — | — | **32.1 (34.6)** |
| Firefox | `golden` | 386 (427) | 390 (431) | 102.5 (123) | 498.5 (558) | 504 (566) | **504 (566)** |
| | `golden-smetana` | 312.5 (328) | 316.5 (332) | 103 (111) | 426.5 (446) | 433.5 (464) | **433.5 (464)** |
| | `golden-text` | 25 (27) | — | — | — | — | **37.5 (53)** |
| WebKit | `golden` | 116.5 (130) | 127.5 (142) | 105.5 (119) | 242 (273) | 274.5 (298) | **274.5 (299)** |
| | `golden-smetana` | 108.5 (112) | 119 (123) | 106 (110) | 234.5 (242) | 263 (275) | **263 (275)** |
| | `golden-text` | 11 (13) | — | — | — | — | **39.5 (48)** |
| Chrome | `golden` | 137.4 (168.5) | 143.1 (174.5) | 84.8 (87.8) | 234.6 (266.7) | 240.2 (271.6) | **240.3 (271.6)** |
| | `golden-smetana` | 122.3 (127.1) | 128.2 (132.9) | 84.7 (87.5) | 218.4 (224.9) | 225.6 (232.4) | **225.7 (232.5)** |
| | `golden-text` | 13.9 (24.9) | — | — | — | — | **33.1 (40.9)** |
| Edge | `golden` | 132 (162.2) | 137.8 (171.3) | 83.3 (110.1) | 226.5 (291.4) | 233.5 (304.2) | **233.5 (304.3)** |
| | `golden-smetana` | 115.1 (118.6) | 120.6 (124.4) | 82.4 (85.7) | 209.5 (214.8) | 217 (222.8) | **217.1 (222.9)** |
| | `golden-text` | 14.7 (22.8) | — | — | — | — | **30 (37.4)** |

**The PlantUML share of the time to visible**, from the medians:

| Engine | `golden` minus `golden-text` | Share of `golden`'s time to visible | Of which: parsing the chunks (mount, `golden` minus `golden-text`) | PlantUML's render and image (render start to diagram ready) |
| --- | --- | --- | --- | --- |
| Chromium | 203.7 | 86% | 116.0 | 95.4 |
| Firefox | 466.5 | 93% | 361.0 | 114.0 |
| WebKit | 235.0 | 86% | 105.5 | 147.0 |
| Chrome | 207.2 | 86% | 123.5 | 97.2 |
| Edge | 203.5 | 87% | 117.4 | 95.7 |

- **The PlantUML diagram is most of the golden case's time to visible**, in every engine: 86 to 93%.
  - About half of it is parsing and compiling the 4.6 MB chunk before anything mounts. In Firefox it is three quarters: 361 ms.
  - The rest is PlantUML's first render (83 to 106 ms), then loading the image and laying it out once.
- **The Smetana chunk is faster to visible**, from 11.5 ms (WebKit) to 70.5 ms (Firefox), because it is 1.46 MB smaller to parse. Its render time is the same.
- **WebKit takes about 30 ms from the image's load to the diagram's ready**, against 2 to 7 ms elsewhere. Ready waits for one layout and an animation frame after the image loads.
- **The golden flow's source edit** (step 4) is written to the draft record, and the diagram re-renders in place. From the render's start to the new image loaded, the median (maximum) is:

  | Engine | `golden` | `golden-smetana` |
  | --- | --- | --- |
  | Chromium | 14.3 (20.0) | 14.6 (21.4) |
  | Firefox | 28.5 (39) | 30.5 (36) |
  | WebKit | 25.5 (41) | 26 (34) |
  | Chrome | 16.3 (19.9) | 17.3 (19.1) |
  | Edge | 15.6 (18.1) | 16.3 (19.6) |

  PlantUML's own part is 9 to 25 ms once the engine is warm.
- **The pin follows "create order".** In each of the 200 loads with a diagram, `message:label:create order#1` is at y = 149 before the edit and at y = 205 after it (207 in Firefox; 148.8 and 204.8 in WebKit), where the message moved (§ Anchors).
- These are the board's own times on this machine (macOS, arm64), with the view served by the stand-in. SM-3's budget and the question-loading limit are set elsewhere (design.md, Open Questions); this gives the PlantUML part of them.
- Screenshots of the golden board, light and dark, in Chromium, Firefox and WebKit (run `golden-look` and `golden-look-dark`, single loads, both fixtures): `evidence/golden/<engine>-light.png`, `evidence/golden/<engine>-dark.png`, for task 6.1.

## Components: what group 4 added to the harness

- **Fixtures.** `bun tools/component-fixtures.ts` writes group 4's 53 fixtures: one component per fixture, with one user action and the draft value it must leave (design decision 6). The JSON files in `fixtures/` are the record.
- **User actions** (`actions` in a fixture; `runActions` in `drive.ts`): click (at a position if given), fill, type, press, focus, hover, drag (Playwright's `dragTo`), wheel and a shell command. They run after "visible" in every load. After each, the shell's `state` command records the draft record, the scroll position, the focused element, the body's computed `overflow`, the scroll-lock attribute and the open dialogs (`steps` in the load's JSON).
- **The verdict rule gains four checks** (`judge` in `drive.ts`):
  - each action ran without error;
  - the draft record holds what the fixture expects (`expectDraft`; `ui:<id>` for view state);
  - computed styles match (`expectComputed`) and each diagram's last render has the expected theme (`expectThemes`);
  - **no CSP line in the console** outside the screenshot. WebKit logs some blocks without firing a violation event (group 3), so every engine's lines count. Firefox's favicon line and blocked `eval` probes, which are judged as probes, are left out.
- **Negative fixtures** gain a `draft` signal (a key of the draft record holds a value after the actions) and exact-URL `no-request`.
- **Policy variants** (`csp.ts`): `board-font-data` adds `font-src data:` to the board page's policy, and `board-media` adds `img-src data: blob:` and `font-src data:`, the view policy's own media sources. As with `board-img-blob`, each is a candidate amendment of AD-8, never the default.
- **The board page can host an ext-apps `AppBridge`** (`bridge` fixtures). `shell/bridge.ts` is built as a probe chunk (`bridge`), inlined into the board page by hash before the page script and never into a view. It logs every request and notification from the view in `__bridgeLog`. The board page now keeps only the view's probe events (`askboardProbe`), so the view's JSON-RPC messages no longer reach the driver's event list.
- **Build** (`build.ts`):
  - Library chunks take several modules: `lib-radix` (ten Radix primitives), `lib-table` (TanStack Table's names used by Table, Tree and Spreadsheet) and `lib-dnd` (Pragmatic drag and drop's adapter, `combine` and `reorder`). `lib-radix` grew from 43,965 to 145,318 bytes (47,238 gzip; 145,266 and 47,208 in the current build) with Select, Slider, Toggle Group, Popover, Dialog and Alert Dialog.
  - **Fonts inline as `data:` URLs.** Bun's CSS bundler leaves a stylesheet's `url()` paths as they are, even with a `dataurl` loader (checked on `mathlive-fonts.css`), so the build rewrites each `.woff2` URL of a package stylesheet into a `data:font/woff2` URL when the file loads. KaTeX lists each face as woff2, woff and ttf; the woff and ttf entries are dropped. KaTeX's stylesheet becomes 369,894 bytes, MathLive's 352,196.
  - **`import.meta` stops the build.** zustand, xyflow's store, reads `import.meta.env`. A classic inline script that holds `import.meta` does not parse at all: in run `graph-import-meta` (built with `PROBE_KEEP_IMPORT_META=1`) the whole Graph chunk fails in every engine, and the item shows as unknown (§ Criterion 1). The build now defines `import.meta.env` as `undefined` and fails on any `import.meta` left in a chunk.
  - **Tailwind's `dark:` variant follows the `.dark` class** (`@custom-variant dark (&:where(.dark, .dark *))`), measured in § S-5.
- **Tools:** `tools/component-report.ts <run> [--steps]` lists each load's violations by directive and policy, and the state after each action; `tools/matrix-table.ts <run>…` prints the component-by-engine table, or the storage and worker accesses with `--storage`.
- **Imports:** `bun tools/imports.ts` checks the 47 files in `components/` against each one's own libraries (0 violations); the Pattern probe imports `../pattern-check.ts`, AskBoard's own check.

## Criterion 1: components under the view CSP (task 4.1)

Three runs of the same 33 fixtures in all five engines (165 loads each), on 2026-10-29, with the engines of § Method:
- `matrix`: `bun drive.ts matrix --fixtures <the 33 c-* fixtures>`, AD-8's policies as written;
- `matrix-media`: the same with `--variants board-media` (the board page's policy allows the view's own `img-src data: blob:` and `font-src data:`);
- `matrix-control`: the same with `--control`, no CSP and no sandbox.

`bun tools/matrix-table.ts matrix matrix-media matrix-control` prints the tables below from the runs' summaries. Counts are violations **per policy**: every blocked write fires one event under the view's policy and one under the board's, except the board-only `font-src` blocks. A fixture holds one component, so its violations are the component's.

| Component (fixture) | Chromium | Firefox | WebKit | Chrome | Edge |
| --- | --- | --- | --- | --- | --- |
| Radix Radio Group, Choice single (`c-radio`) | pass | pass | pass | pass | pass |
| Radix Checkbox, Choice multiple (`c-checkbox`) | pass | pass | pass | pass | pass |
| Radix Switch, Toggle (`c-switch`) | pass | pass | pass | pass | pass |
| Radix Tabs (`c-tabs`) | pass | pass | pass | pass | pass |
| Radix Select (`c-select`; `c-select-popper` the same) | fail: 2 `style-src-elem` | fail: 2 `style-src-elem` | fail: 2 `style-src-elem`, 1 `style-src-attr` | fail: 2 `style-src-elem` | fail: 2 `style-src-elem` |
| Radix Select with the style-element shim (`c-select-shim`) | fail: 1 `style-src-elem` | **pass with change** | fail: 1 `style-src-attr` | fail: 1 `style-src-elem` | fail: 1 `style-src-elem` |
| Radix Slider (`c-slider`) | pass | pass | pass | pass | pass |
| Radix Toggle Group (`c-toggle-group`) | pass | pass | pass | pass | pass |
| Radix Popover, non-modal (`c-popover`) | pass | pass | pass | pass | pass |
| Radix Popover, modal (`c-popover-modal`) | fail: 1 `style-src-elem` | fail: 1 | fail: 1 | fail: 1 | fail: 1 |
| Radix Popover, modal, style-element shim (`c-popover-modal-shim`) | pass with change | pass with change | pass with change | pass with change | pass with change |
| Date Picker: react-day-picker in a Radix Popover (`c-date-picker`) | pass | pass | pass | pass | pass |
| markdown-it with DOMPurify (`c-markdown`) | fail: 12 `style-src-attr` | fail: 6 | fail: 6 | fail: 12 | fail: 12 |
| markdown-it, alignment as classes (`c-markdown-classes`) | pass with change | pass with change | pass with change | pass with change | pass with change |
| KaTeX through its DOM API (`c-katex`) | fail: 20 `font-src`, board policy | fail: 23 | fail: 20 | fail: 20 | fail: 20 |
| the same with `board-media` (run `matrix-media`) | pass with change | pass with change | pass with change | pass with change | pass with change |
| KaTeX `renderToString` into `innerHTML`, negative control (`c-katex-string`) | caught: 37 `style-src-attr` | caught | caught | caught | caught |
| MathLive (`c-mathlive`) | fail: `postMessage` throws, no edit reaches the draft; 20 `font-src` | fail: the same | fail: the same | fail: the same | fail: the same |
| MathLive, keyboard in the frame (`c-mathlive-sandboxed`) | fail: 24 `style-src-attr`, 20 `font-src` | fail: 23, 22 | fail: 23, 20 | fail: 24, 20 | fail: 24, 20 |
| MathLive, keyboard in the frame and the markup shim (`c-mathlive-shim`) | fail: 20 `font-src` | fail: 22 | fail: 20 | fail: 20 | fail: 20 |
| the same with `board-media` (run `matrix-media`) | pass with change | pass with change | pass with change | pass with change | pass with change |
| TanStack Table, table (`c-table`) | pass | pass | pass | pass | pass |
| TanStack Table, tree (`c-tree`) | pass | pass | pass | pass | pass |
| TanStack Table, A1 grid (`c-spreadsheet`) | pass | pass | pass | pass | pass |
| Pragmatic drag and drop, Ranking (`c-ranking`) | pass | pass | pass | pass | pass |
| Pragmatic drag and drop, Kanban (`c-kanban`) | pass | pass | pass | pass | pass |
| ECharts, canvas renderer (`c-chart`) | fail: 14 `style-src-attr` | fail: 14 | fail: 14 | fail: 14 | fail: 14 |
| ECharts, tooltip drawn on the canvas (`c-chart-rich`) | pass with change | pass with change | pass with change | pass with change | pass with change |
| xyflow with dagre (`c-graph`) | pass with change (build) | pass with change | pass with change | pass with change | pass with change |
| `@pierre/diffs` (`c-diff`) | fail: 52 `style-src-attr`, 1 `style-src-elem` | fail: the same | fail: the same | fail: the same | fail: the same |
| `@pierre/diffs`, CSS-variables theme and the markup shim (`c-diff-vars-shim`) | pass with change | pass with change | pass with change | pass with change | pass with change |
| ext-apps `App` to the board page's `AppBridge` (`c-app`) | probe: zod's `new Function`, 1 per policy | probe: the same, and 1 from the bridge on the board page | probe: 2 on the board page | probe | probe |
| the same with zod's `jitless` set when the chunk loads (`c-app-jitless`) | pass with change | probe: 1, from the bridge on the board page | probe: 1, the same | pass with change | pass with change |
| Tailwind stylesheets (`c-tailwind`) | pass | pass | pass | pass | pass |

**The control run** (`matrix-control`): every fixture passes in all five engines, MathLive's three variants and the default `@pierre/diffs` included, and the negative control renders ("missed"). Each failure above is therefore the CSP or the sandbox, not the component. No load in the three runs made a request, touched storage or made a worker (§ S-5).

What fails, with the violation and the change measured:
- **Radix Select.** Opening it fires two blocked `<style>` elements: the scroll lock's (react-remove-scroll-bar, as in § S-6) and the viewport's, a `<style>` React renders in Select's portal (`[data-radix-select-viewport]{scrollbar-width:none;…}`, `lib-radix`). In WebKit a third block comes from the hidden native `<select>` Radix renders for forms: **WebKit reports a `style-src-attr` violation for any native `<select>` it creates**, whatever its styles. `bun tools/check-native-select.ts` shows it on a standalone page with a hash-only `style-src`: 2 violations for 2 `<select>` elements in WebKit, none in Chromium or Firefox. With the style-element shim (§ S-6), only Firefox passes. Chromium, Chrome and Edge still block the viewport's `<style>`: they check the CSP when a `<style>` is connected, whatever its `type` (a trial run made while writing the shim, not kept: with only the non-CSS `type`, they still reported the head's scroll-lock `<style>` too, which is why the shim moves that one into a detached holder). WebKit still reports the native `<select>`. Popper position (`c-select-popper`) changes nothing. Select works in every engine (the picked value reaches the draft record); the failure is the CSP's.
- **Radix Popover, modal**: the scroll lock's `<style>`, 1 per policy; the style-element shim passes it in all five engines. The non-modal Popover, which is what the Date Picker uses, passes as written.
- **markdown-it**: a table column's alignment becomes `style="text-align:…"` on each cell, 6 cells in the fixture. Chromium reports each twice per policy, once when DOMPurify parses the HTML and once when it is inserted. A renderer rule that writes the alignment as a class (`props.alignClasses` in `components/markdown.tsx`, a dozen lines) passes in all five engines. DOMPurify kept the escaped `<script>` and `<img onerror>` text as text, since markdown-it runs with `html: false`.
- **KaTeX**: the 20 fonts inlined as `data:` URLs are blocked by the **board page's** policy, which names no `font-src`. The view's own `font-src data:` cannot widen it, as for `img-src blob:` (§ Criteria 3 and 4). With `board-media` it passes in all five engines. Its styles go through the CSSOM: no style violation.
- **MathLive** needs three changes:
  1. In a frame, MathLive makes `window.mathVirtualKeyboard` a proxy that posts to `window.top` with `window.origin` as the target origin. That is `"null"` in the sandbox, and every engine's `postMessage` throws ("Invalid target origin 'null'" in Chromium; "An invalid or illegal string was specified" in Firefox; "The string did not match the expected pattern" in WebKit), so typing never reaches the draft record. The change removes the proxy and mounts the keyboard in the frame (`initVirtualKeyboardInCurrentBrowsingContext`, MathLive's own export) with the `sandboxed` keyboard policy.
  2. It then writes the formula as markup with `style` attributes into the field's shadow root: 23 to 25 per policy. The markup shim (§ Diff highlighting) passes it.
  3. Its fonts need `font-src data:` on the board page, as KaTeX's do.

  With the three, `x^2` typed key by key reaches the draft record as `x^2` in all five engines. Playwright's `keyboard.type` right after the click loses keys in MathLive, in the control run too, so the fixtures type one key at a time.
- **ECharts**: its HTML tooltip is set with `innerHTML` and inline `style` attributes when the pointer is over a bar (the click hovers it first): 14 per policy. ECharts' own `tooltip.renderMode: "richText"` draws the tooltip on the canvas and passes in all five engines. The chart itself writes styles through the CSSOM.
- **xyflow** passes as written once the build defines `import.meta.env`; without that the chunk does not parse in any engine (run `graph-import-meta`, built with `PROBE_KEEP_IMPORT_META=1`: "Cannot use 'import.meta' outside a module" in Chromium, Chrome and Edge; "import.meta may only appear in a module" in Firefox; "import.meta is only valid inside modules" in WebKit). The change is in the build, not the component (§ Components: what group 4 added). The attribution link is hidden with xyflow's `proOptions.hideAttribution`; it is a link, not a request.
- **`@pierre/diffs`**: § Diff highlighting.
- **ext-apps**: the view's `App` connects to the board page's `AppBridge` over `postMessage` with target origin `*`. It sends `ui/update-model-context`, and the bridge logs `ui/notifications/initialized` and `ui/update-model-context`, in all five engines. `App` sets zod's `jitless` in its constructor (its own documentation), but zod has already probed `new Function` once by then. Setting `jitless` before ext-apps loads (`components/_zod-jitless.ts`, imported first) removes the view's probe. The probe left in Firefox and WebKit is the board page's own: the stand-in's `AppBridge` bundles zod without `jitless`, and those two engines report its probe to the board page. A product board page needs the same `jitless` line.
- **Tailwind**: the hashed chunk stylesheets apply in every engine: a token colour (`rgb(11, 110, 127)`), `rounded-md` (4px), the `question` type scale (20px, 600), an arbitrary width (137px), `grid` and a `data-[state=on]` variant. Tailwind's `dark:` variant needed a build change (§ S-5).

What this means under §10.3's "What changes" ("a component failing the CSP is out"), as input to the proposed outcomes of task 8.1:
- **Pass as written** in every engine: Radix Radio Group, Checkbox, Switch, Tabs, Slider, Toggle Group and the non-modal Popover; the Date Picker; TanStack Table as table, tree and grid; Pragmatic drag and drop; the Tailwind stylesheets.
- **Pass with a change named above**, in every engine: KaTeX (board policy `font-src data:`), markdown-it (alignment classes), ECharts (`richText` tooltip), xyflow (the build's `import.meta.env`), ext-apps (`jitless` first, on both pages), the modal Popover (the style-element shim), MathLive (three changes), `@pierre/diffs` (the markup shim).
- **Fail with every change measured:** Radix Select, in Chromium, Chrome, Edge and WebKit, and with it the Form's single pick from a list (§ Form). Untested alternatives: a native `<select>` (which WebKit reports too, see above), a Radix Popover with a listbox, or Select without its `Viewport` part.

## Diff highlighting (task 4.2)

Run `diffs`: seven configurations of `components/diff-review.tsx` in all five engines; run `diffs-dark`: the two shimmed configurations with `--color-scheme dark` in Chromium, Firefox and WebKit. The fixture is a five-line TypeScript change shown unified, with `disableWorkerPool` (no worker). Each load reports what the shadow root holds: the highlighted spans, their classes and their computed colours.

| Configuration (fixture) | Violations per policy, every engine | Classes on the token spans | Token colours (computed) | Verdict |
| --- | --- | --- | --- | --- |
| Its default themes, Shiki's JavaScript engine (`c-diff`) | 52 `style-src-attr`, 1 `style-src-elem` | none | all `rgb(0, 0, 0)`: the blocked `style` attributes carry them | fail |
| `useCSSClasses: true` (`c-diff-classes`) | the same | none: the option is declared but not read (D10) | the same | fail |
| A CSS-variables theme on the five `syntax-*` tokens (`c-diff-vars`) | 51, 1 | none | the same | fail |
| No highlighting: the files named `.txt` (`c-diff-plain`) | 2, 1 | none | the same | fail |
| Default themes and the markup shim (`c-diff-shim`) | 0 | none | Pierre's palette | pass with change |
| **CSS-variables theme and the markup shim (`c-diff-vars-shim`)** | **0** | none | exactly DESIGN.md's tokens: light `#6b3fa0`, `#1d6b52`, `#9a4a0b`, `#2b5c8a`, `#6b6358` and the foreground `#2b2722`; the `-dark` values under `.dark` | pass with change |
| No highlighting and the markup shim (`c-diff-plain-shim`) | 0 | none | foreground | pass with change |

- **What the CSP blocks.** `@pierre/diffs` builds its rows as HTML strings (`hastToHtml`) and writes them with `innerHTML` and `insertAdjacentHTML`, often into elements not yet attached. Token colours, the `grid-row` spans and a CSS variable on `<pre>` are `style` attributes in that markup, and a theme `<style>` goes into its shadow root (`hostTheme.js`). Turning highlighting off removes the token styles but not the other three (`c-diff-plain`).
- **No configuration gives token classes.** No span carries a class in any configuration, so the task's first branch cannot be met: as the task says, **highlighting off in the first version** is recorded, with the violations above. **But off is not enough:** the component fails the CSP without highlighting too.
- **The measured alternative is the markup shim** (`components/_markup-shim.ts`, 81 lines, shared with MathLive). It is in scope inside a listed host's shadow root, or in a detached element:
  - before markup is parsed, its `style` attributes become `data-ab-style`, and they are applied through the CSSOM after;
  - `setAttribute("style", v)` becomes `style.cssText = v`;
  - a `<style>` appended to the shadow root becomes a constructed stylesheet.

  The CSS-variables theme (`registerCustomCSSVariableTheme`, the package's own export) then maps Shiki's scopes onto `var(--syntax-keyword)` and the four others, so the `.dark` switch re-points them with no re-render. Its scope map sends `number`, `boolean`, `constant` and `property` to the number token, and `function`, `constructor`, `type` and `attribute` to the function token, as DESIGN.md's table groups them.
- **The decision is the product owner's** (tasks 6.1 and 8.3): the shim with highlighting, or the shim with highlighting off. Either way, Diff review needs the shim or a different library. Screenshots, light and dark, of `c-diff-vars-shim` in Chromium, Firefox and WebKit: `evidence/diffs/<engine>-light.png` and `<engine>-dark.png`; for comparison, `evidence/diffs/chromium-default-no-shim.png` (as written: no colour) and `chromium-pierre-theme-shim.png` (Pierre's own palette).
- **For group 5:** in the group 4 build the chunk is 11,604,703 bytes (2,091,962 gzip; the current build's script is 11,480,812 and 2,060,577, § Criterion 6). Shiki's grammars are 7,991,265 bytes of it (7,991,212 in the current build): `import("shiki/langs")` bundles every language into the classic script. Its themes are 1,333,572, `@pierre/highlights` 650,847 and the Oniguruma engine 629,400, unused here. Time to visible is about 300 ms in Chromium, 600 ms in Firefox and 1,330 ms in WebKit; with `.txt` files in WebKit, 195 ms.

## S-6: Radix Dialog and Alert Dialog (task 4.3)

Runs `dialog` and `dialog-control`, all five engines. Each fixture holds the trigger, then a 2,400 px block, so the view has a page to scroll. The actions, with the view's state recorded after each:
1. open the dialog;
2. wheel 600 px over the page;
3. press PageDown;
4. press Tab four times;
5. press Escape;
6. wheel 600 px again.

**The blocked `<style>`**, one per opening and per policy, in every engine (`style-src-elem`). The instrumentation's record of it begins:

```css
.with-scroll-bars-hidden { overflow: hidden !important; padding-right: 0px !important; }
body[data-scroll-locked] { overflow: hidden !important …
```

It is react-remove-scroll-bar's, appended to `document.head` through react-style-singleton. Chromium logs "Applying inline style violates the following Content Security Policy directive 'style-src …'"; WebKit "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive".

| Fixture | Violations per policy | Body `overflow` while open | Wheel while open | PageDown while open (scrollY) | Focus after each Tab | Esc |
| --- | --- | --- | --- | --- | --- | --- |
| Modal Dialog as written (`s6-dialog`) | 1 | `visible` | blocked (scrollY 0) | **scrolls**: 760 in Chromium, Chrome, Edge; 640 in WebKit; 0 in Firefox, where focus is in the text field | stays in the dialog, 4 of 4 | closes; focus returns to the trigger |
| Alert Dialog as written (`s6-alert`) | 1 | `visible` | blocked | **scrolls**: 760; 639 in WebKit; 768 in Firefox | stays in, 4 of 4 | closes; focus to the trigger |
| Modal Dialog with the static rule (`s6-dialog-rule`) | 1 | `hidden` | blocked | 0 | stays in | closes |
| Modal Dialog, style-element shim (`s6-dialog-shim`) | **0** | `hidden` | blocked | 0 | stays in | closes |
| Alert Dialog, style-element shim (`s6-alert-shim`) | **0** | `hidden` | blocked | 0 | stays in | closes |
| Non-modal Dialog (`s6-nonmodal`) | **0** | `visible`, no lock by design | scrolls 600 | scrolls (1,360; 600 in Firefox) | stays in, 4 of 4 | closes; focus to the trigger |
| Control, modal and alert (`dialog-control`) | 0 | `hidden` | blocked | 0 | stays in | closes |

After Escape the page scrolls again in every case (600).

- **What the block breaks:** only the keyboard half of the scroll lock. The wheel is still stopped by react-remove-scroll's own event handler (script), the focus trap and Esc work in every engine, and focus returns to the trigger. The page behind a modal scrolls with PageDown, and the scrollbar gap is not compensated.
- **Two measured changes:**
  1. **The static rule** (`styles/scroll-lock.css` as the `scroll-lock` chunk's hashed stylesheet: `body[data-scroll-locked] { overflow: hidden !important; overscroll-behavior: contain }`) restores the lock in every engine, but the blocked `<style>` still fires its violation.
  2. **The style-element shim** (`components/_style-shim.ts`, 50 lines) passes with 0 violations and the full lock in every engine. A `<style>` appended to `document.head` goes into a detached holder and its rules become a constructed stylesheet in `document.adoptedStyleSheets`, which the CSP allows (D11). Removing it removes the sheet. A `<style>` inserted anywhere else gets a non-CSS `type` and the same treatment, which is enough in Firefox only (§ Criterion 1, Radix Select).
- **The non-modal variant passes as written.** The settings side sheet is non-modal (S-6's own text), so it is not affected. For the mode-switch confirmation, the product owner chooses between non-modal, a modal with the shim, and a modal with the static rule plus a tolerated violation (task 8.1, row 7).

## Form (task 4.4)

Runs `form` and `form-control`, all five engines. The Form is RJSF 6.11.0 with:
- the AskBoard theme stand-in (`components/_form.tsx`): RJSF widgets on the atoms' parts, a text input, Radix Radio Group, Select and Checkbox;
- `tagName="div"`, no submit button (`ui:submitButtonOptions.norender`) and `showErrorList={false}`;
- the no-op validator (`validateFormData`, `isValid`, `rawValidation`, `reset`);
- `extraErrors` on the name field, standing in for AskBoard's field check.

The schema has a name with a `pattern`; a colour as `enum` with `ui:enumNames` shown as radios; a size, the same, shown as a Select; and tags, an array of `enum` items with the items' `ui:enumNames`, shown as checkboxes (S-8).

| Check | Chromium | Firefox | WebKit | Chrome | Edge |
| --- | --- | --- | --- | --- | --- |
| Values after the picks (`form`): `{"name":"Ada","colour":"g","size":"m","tags":["a","c"]}` in the draft record; the labels Red, Green, Blue, Medium, Alpha, Beta, Gamma shown | yes | yes | yes | yes | yes |
| Enter in the name field submits nothing (`ui:f1` stays empty) | yes | yes | yes | yes | yes |
| The field error from `extraErrors` shows ("Use a capitalised name …") | yes | yes | yes | yes | yes |
| Violations in `form` (all from Radix Select, § Criterion 1) | 2 `style-src-elem` | 2 | 2, and 1 `style-src-attr` | 2 | 2 |
| `form-shim`, with the style-element shim | 1 `style-src-elem`: fail | **pass with change** | 1 `style-src-attr`: fail | 1: fail | 1: fail |
| S-7 negative control, a `<form>` with its submit button (`form-tag`): Enter, then the button | blocked: "Blocked form submission to '' because the form's frame is sandboxed and the 'allow-forms' permission is not set", twice; no submit event | blocked silently; no submit event | **the submit event fires on Enter: RJSF's `onSubmit` ran**; no request | blocked, as Chromium | blocked, as Chromium |
| S-4 negative control, `@rjsf/validator-ajv8` validating live (`form-ajv`) | caught: `script-src`, blocked URI `eval`, at Ajv's first compile | caught | caught (reported to the board page) | caught | caught |

- **The control run** (`form-control`, no sandbox and no CSP) shows each negative probe does what it claims: the `<form>` submits (RJSF's `onSubmit` runs) and Ajv compiles with no violation, in all five engines. `form` passes there too.
- **S-7 holds, and more strongly than its text.** WebKit fires the submit event in a sandboxed frame without `allow-forms`: only the navigation is blocked. A `<form>` there runs RJSF's submit handler on Enter. `tagName="div"` is what keeps Enter from submitting, in every engine.
- **S-4 holds.** The no-op validator with `extraErrors` shows AskBoard's errors and compiles nothing, and Ajv's compile is blocked as expected.
- **S-8's picks hold.** `enum` with `ui:enumNames` returns the `enum` values (`g`, `m`, `["a","c"]`) and shows the labels, for radios, Select and checkboxes.
- **The Form fails criterion 1 only through Radix Select** (single pick from a list). With radios for single picks, the Form's violations would be those of the atoms, which pass. That is a design choice the product owner makes with Select's verdict (task 8.1, row 6).
- **For group 5:** in the group 4 build, the `form` chunk carries Ajv (103,550 bytes) and `@rjsf/validator-ajv8` although the Form never uses them. The current build has neither: its `form` script is 254,166 bytes (86,627 gzip), markdown-to-jsx 78,544 of it (§ Sizes). `@rjsf/core`'s index re-exports `getTestRegistry`, which imports `@rjsf/validator-ajv8`, and the bundle keeps it; markdown-to-jsx adds 78,632 bytes (D15). The chunk is 393,146 bytes (129,062 gzip). The Ajv instance it constructs at load compiles nothing: no `eval` violation in `form`.

## S-8: the safe `pattern` subset (task 4.5)

- **`pattern-check.ts`** (probe root, 110 lines) implements the subset as a send-time check, `checkPattern(itemId, pattern)`. A pattern is refused when:
  - it does not compile as an ECMAScript regular expression with the `u` flag;
  - it holds a backreference (`\1` to `\9`, `\k<name>`);
  - it holds a lookahead (`(?=`, `(?!`) or a lookbehind (`(?<=`, `(?<!`);
  - a group that holds a quantifier is itself repeated by `*`, `+` or a braced quantifier other than `{0}` and `{1}` (`?` is allowed).

  Each refusal names the item: "item r-nested-plus: pattern "^(a+)+$" nests quantifiers (a repeated group holds a quantifier), outside the safe subset (S-8)".
- **`bun pattern-check.ts`** runs the fixture list and prints "8 accepted, 11 refused, all as listed". It accepts 8 patterns: a name, a phone number, an email shape, an optional subdomain (a quantified group made optional with `?`), named groups, an alternation, a class holding `(+*)]` and a ticket key. It refuses 11:
  - a backreference and a named backreference;
  - a lookahead and a negative lookahead;
  - a lookbehind and a negative lookbehind;
  - four nested quantifiers: `(a+)+`, `(?:\w*\s?)*`, `(\d{2,})+` and `((ab)*c)+`;
  - one invalid pattern.
- **No DOM, Node-only or Bun-only API:** `tsc` 7.0.2 compiles it with `--lib es2022 --types ''` (no DOM, Node or Bun types). The same command on a control file that reads `document`, `process` and `Bun` fails with TS2584, TS2591 and TS2868. The runner reads `import.meta.main`, which Bun and Deno set on the entry module; the check itself does not.
- **Run `pattern`**, all five engines: the Pattern probe checks the 8 accepted patterns again in the view, then evaluates them with `RegExp` (`u` flag) against 9 strings that must match and 9 that must not. It shows "all patterns behave as listed", with 0 violations: **pass** in every engine.

## S-5: storage, workers and the `.dark` switch (task 4.6)

**Storage and worker accesses.** `bun tools/matrix-table.ts matrix matrix-media form diffs dialog theme pattern drag-slider --storage` reads every load's `storage` and `worker` records: the shell's wrappers on `localStorage`, `sessionStorage`, `indexedDB`, `caches`, `document.cookie`, `Worker` and `SharedWorker` (§ Harness).

| Component | API | Outcome |
| --- | --- | --- |
| Every group 4 fixture: 33 in `matrix` and `matrix-media`, 4 in `form`, 7 in `diffs`, 6 in `dialog`, `theme`, `pattern` and 3 in `drag-slider`, in all five engines | any of the seven | **no access** |
| cmdk 1.1.1 (S-5, `evidence/adoption.json`) | not installed | fails the adoption rule: last push 2025-10-29, last release 2025-03-14 |
| next-themes 0.4.6 (S-5, `evidence/adoption.json`) | not installed | fails the adoption rule: last push 2026-02-25, last release 2025-03-11; its `localStorage` would throw in the view (§ Harness, `neg-local-storage`) |

`@pierre/diffs` ran with `disableWorkerPool`, so it made no worker. Its worker pool runs only through a host `workerFactory` (D12), and a `blob:` worker is blocked by `worker-src` (§ Harness).

**The `.dark` switch** (fixture `theme`: the Tailwind swatches, a Mermaid flowchart and a PlantUML Smetana diagram, both with the style shim; the action is the shell's `theme` command, which sets the `.dark` class; the `board-media` variant, so the diagrams' `blob:` images load):

| Run | Tokens re-point (page background `rgb(27, 25, 22)`; `bg-primary` `rgb(95, 180, 194)`) | Diagrams re-render dark (last render's theme) | Tailwind `dark:` utility under `.dark` (`#tw-dark`, expected the dark primary `rgb(95, 180, 194)`) | Verdict |
| --- | --- | --- | --- | --- |
| `theme-media-query`, the build before the change | yes, five engines | yes, Mermaid and PlantUML, five engines | **no**: `rgb(235, 230, 221)`, the dark foreground | fail |
| `theme`, with `@custom-variant dark (&:where(.dark, .dark *))` in each chunk's Tailwind input | yes | yes | yes | **pass**, five engines |

- **The tokens follow the class** as built (§ Harness): `.dark` re-points the CSS variables, and the diagrams re-render dark through their theme subscription.
- **Tailwind's `dark:` variant needs one line**: by default it follows `prefers-color-scheme`, not the class the UX drives. The build now carries `@custom-variant dark (&:where(.dark, .dark *))`.
- **S-5's conclusion holds:** no component reads storage, and the `.dark` class does what next-themes would, with no dependency.

## S-2 and S-3 (task 4.7)

From `evidence/adoption.json` (task 1.2, run on 2026-10-29: the npm registry for versions, dependencies and publish dates, the GitHub API for stars and pushes), against the adoption rule on that date (a push since 2026-04-29, a release since 2025-10-29, at least 1,000 stars):

| Package | Fact | Source, date | Rule |
| --- | --- | --- | --- |
| `react-arborist` 4.0.1 | Peer dependencies `react-dnd` ^16 and `react-dnd-html5-backend` ^16 (its own dependencies are `redux`, `react-window`) | npm registry, `react-arborist@4.0.1`, read 2026-10-29 | The package passes (MIT, 3,714 stars, pushed 2026-10-11, released 2026-10-11) |
| `react-dnd` 16.0.1 | Last release 2022-04-19 (16.0.1, `latest`); last push 2025-07-06; 21,628 stars | npm registry and GitHub `react-dnd/react-dnd`, 2026-10-29 | **Fails**: release older than 12 months, push older than 6 months |
| `vis-timeline` 8.5.6 | `@egjs/hammerjs` ^2.0.0 is a **peer** dependency, with `propagating-hammerjs` and seven others; vis-timeline itself declares no direct dependency | npm registry, `vis-timeline@8.5.6`, 2026-10-29 | The package passes ((Apache-2.0 OR MIT), 2,573 stars, pushed 2026-10-29, released 2026-10-26) |
| `@egjs/hammerjs` 2.0.17 | Repository `naver/hammer.js`: last push 2021-02-01, 45 stars; last release 2019-12-16 | GitHub and npm registry, 2026-10-29 | **Fails**: stars, push and release |

- **Differences from the ACR's wording:** react-dnd's last release is 2022-04-19, not 2022-06-25 (§ Adoption), and hammer.js is a peer of vis-timeline, not a dependency. Neither changes the conclusion: installing either component brings in a package that fails the rule.
- **Verdict on S-2's replacement, TanStack Table tree mode with Pragmatic drag and drop: holds.** Both pass the adoption rule (§ Adoption). Under the view CSP, the Tree fixture (TanStack Table's expanding feature, from `lib-table`) and the Ranking and Kanban fixtures (Pragmatic drag and drop's native drag, from `lib-dnd`) are in § Criterion 1 and § UX spike items. The two were run apart: a tree whose rows are dragged is the `widgets` epic's to build.
- **Verdict on S-3's replacement, AskBoard's own Timeline: holds, untested here.** It removes the failing peer. The spike built no Timeline fixture: it would be React and CSS with no library of its own, which the atoms already show pass (§ The renderer).

## UX spike items (task 4.8)

Runs `drag-slider` and `drag-slider-control` (all five engines), and `drag-slider-set` (the comparison click). Drags use Playwright's `dragTo`, which drives the native HTML5 drag events Pragmatic drag and drop listens to, inside the sandboxed frame. The draft record after each action:

| Fixture: action | Chromium | Firefox | WebKit | Chrome | Edge |
| --- | --- | --- | --- | --- | --- |
| `ux-ranking`: drag C onto A | `["c","a","b"]` | the same | the same | the same | the same |
| `ux-ranking`: then drag A onto B | `["c","b","a"]` | the same | the same | the same | the same |
| `ux-kanban`: drag k1 onto the Done lane | todo `[k2]`, doing `[k3]`, done `[k1]` | the same | the same | the same | the same |
| `ux-kanban`: then drag k3 onto card k2 | todo `[k3,k2]`, doing `[]`, done `[k1]` | the same | the same | the same | the same |
| `ux-slider-unset`: click the track at 192 px of 208, no value set | **no value** | no value | no value | no value | no value |
| `ux-slider-set`: the same click with the value 30 | 92 | 92 | 92 | 92 | 92 |

- Every load passes the verdict rule, with 0 violations; the control run gives the same draft records.
- **Native drag works in the sandboxed frame** in every engine Playwright drives. Pragmatic drag and drop needs no permission the sandbox withholds. A person's drag in the installed Chrome and in Safari is task 6.2, awaiting PO.
- **A click on an unset Slider's track sets no value**, in every engine and in the control run, so it is Radix's behaviour, not the CSP's. Radix finds the thumb nearest the click (`getClosestValueIndex`, `@radix-ui/react-slider` `dist/index.mjs:655-660`). With no value there is no thumb, the index is -1, and `getNextSortedValues` (`:632-636`) writes the value at index -1, which the sorted array drops. The same click on a set Slider moves it to 92. The track is 208 px wide at the view's 13 px root size, so 192 px is 92%. To set a value on the first click, AskBoard's Slider would have to handle the track's `pointerdown` itself while unset: a `widgets` epic decision.

## Sizes: what group 5 added to the harness

- **The build kept code it should have dropped.** Up to group 4, the globals plugin's `onResolve` matched every import (`filter: /.*/`) and returned nothing for most of them. In Bun 1.4.4 a plugin like that makes the bundler ignore the packages' `sideEffects` field, so modules no one uses stay in the chunk. Built alone, `components/chart.tsx` is 504,703 bytes; with a catch-all `onResolve` that returns nothing, 1,072,623 (a check made while writing the fix, not kept). The plugin now matches only the modules it maps and the port (`build.ts`, `globals`). Chunks that shrank, script and style together, before and after:
  - chart 1,075,115 → 507,148;
  - form 396,928 → 257,948: Ajv and `@rjsf/validator-ajv8` are gone, so § Form's note "the `form` chunk carries Ajv" holds only for the group 4 build;
  - json-render (jitless) 194,962 → 159,717; ext-apps `App` 353,456 → 313,693;
  - mermaid 3,958,186 → 3,803,165; markdown 148,324 → 136,335; diff-review 11,607,925 → 11,483,932;
  - the board page's bridge (probe only) 351,299 → 311,507.

  The byte counts in the sections of groups 2 to 4 are those of the group 4 build. `PROBE_CATCH_ALL_RESOLVE=1` rebuilds it (variant `catch-all`), so both builds are measured below.
- **The fix changed no verdict.** The fixtures of the earlier runs ran again on the new build, all five engines, on 2026-10-30, and `bun tools/compare-runs.ts` compared each load with its earlier one:
  - run `regress-g5` (the fixtures of runs `matrix`, `form`, `dialog`, `drag-slider`, `diffs` and `pattern`): 260 loads, the same verdict and the same number of violations in each;
  - `regress-g5-blob` (variant `board-img-blob`): the 20 loads of run `mermaid-shim` the same; `golden` and `golden-smetana` pass in all five engines, as in run `golden-time`;
  - `regress-g5-renderers` (`hello`, `atoms`, `delayed` and `throws` through the three renderers): the 60 loads of run `renderers` the same;
  - `regress-g5-theme` (variant `board-media`): the 5 loads of run `theme` the same.
- **Size variants** (`build.ts`): `PROBE_DIST` builds into another folder, and `tools/sizes.ts` builds four variants under `dist/variants/`:
  - `catch-all`: the group 4 build;
  - `copy` (`PROBE_COPY_LIBRARIES=1`): no library chunks, each component chunk carries its own copy;
  - `trim` (`PROBE_SHIKI_LANGS=<list>`): Diff review with only the listed Shiki grammars (below);
  - `plain` (`PROBE_SHIKI_LANGS=`): Diff review with no grammar, for highlighting off.

  `board.ts` serves any of them with `PROBE_DIST`, so a variant's chunks can be run.
- **Diff review trimmed** (`shikiTrim` in `build.ts`, `onLoad` only, since an `onResolve` on relative imports would defeat tree-shaking again). Shiki's language list keeps the named grammars. Its theme list and the theme catalogs of `@pierre/theming` and `@pierre/highlights` become empty, since the measured configuration registers its own CSS-variables theme (§ Diff highlighting). The inlined Oniguruma WebAssembly and `@pierre/diffs`' second backend, Highlights, become stubs that refuse to start: Shiki's JavaScript engine is the one that runs. DESIGN.md names no language list, so the spike chose 17 grammars: TypeScript, TSX, JavaScript, JSX, JSON, Markdown, YAML, TOML, CSS, HTML, shell, Python, Go, Rust, Java, SQL and diff (`LANGS` in `tools/sizes.ts`).
  - Run `sizes-diffs-trim` (`PROBE_DIST=dist/variants/trim`, all five engines): the highlighted TypeScript diff (`c-diff-vars-shim`) and highlighting off (`c-diff-plain-vars-shim`) pass, with 0 violations. The token colours are DESIGN.md's light `syntax-*` values, as in run `diffs`. `c-diff-plain-shim`, which asks for the package's default themes, fails as expected: "no line rendered in 10 s".
  - Run `sizes-diffs-plain` (`PROBE_DIST=dist/variants/plain`): highlighting off passes in all five engines; the TypeScript diff fails, as it must with no grammar.
- **A gap in the verdict rule, closed.** Diff review reported ready after 10 s even when it had drawn no line, and such a load passed. Run `diffs-trim` (the `trim` build) showed it: `c-diff-plain-shim` asks for the package's default themes, which the trimmed build lacks, and it "passed" in all five engines at about 10,050 ms, with "No valid theme loader registered for "pierre-dark"" only in the console. The component now raises an error when it has no line after 10 s (`components/diff-review.tsx`). Its new configuration `plain-variables` is highlighting off with the CSS-variables theme (fixture `c-diff-plain-vars-shim`).
- **Snapshots that carry renders instead of renderers** (design decision 5's second option):
  - `assemble` takes the renders as an option and swaps each rendered diagram item for a `DiagramSvg` that holds its light and dark SVG text; the diagram renderer chunks are then not inlined (`withRenders` in `assemble.ts`);
  - `components/diagram-svg.tsx` (5,023 bytes) shows the render the `.dark` class picks as a `blob:` image, through the same `DiagramView` as the renderers, with no hit map;
  - `bun drive.ts <run> --script renders --engines chromium` loads each fixture on the board, keeps every diagram's light render, switches the shell's `.dark` class (S-5) and keeps the dark render, in `runs/<run>/renders/<fixture>.json`. In the product the view would hand its renders to the board page; the spike only measures the option;
  - `/s/<fixture>?renders=<run>` on the stand-in, and `--renders <run>` in the driver, assemble such a Snapshot.
- **The Snapshot run** (`--script snapshot --renders <run>`) opens every fixture as a Snapshot from `file://` four times: with the renderer chunks and with the renders only, each in the light and the dark colour scheme. In Snapshot loads the verdict rule gains a check: the view's `.dark` class, and every diagram's latest render, follow the colour scheme. A `file:` request other than the Snapshot itself now counts as a request; before, every `file:` URL was left out.
- **Fixtures** (`bun tools/size-fixtures.ts`, from the group 2 to 4 fixtures): `size-uj1`, a UJ-1-like board (Diff review beside a Markdown excerpt of a decision record, a Choice, a Graph of the retry state machine, a TextField); `size-all`, every component the spike built, each in the configuration it passed with (§ Criterion 1), 40 items; `c-diff-plain-vars-shim`. The golden board is group 3's `golden`. Not built by the spike, so in no board: Image, MoneyField, Approval, Gantt, Timeline and Image annotation, which are AskBoard's own code with no library of their own.
- **Tools:** `tools/sizes.ts` (below); `tools/compare-runs.ts <new> <old>,…` compares verdicts per engine, fixture and renderer.

## Criterion 6: bundle and Snapshot size (tasks 5.1 and 5.2)

`bun run build && bun tools/sizes.ts --renders snapshot-renders` on 2026-10-30 writes `evidence/sizes.json`. It reads `probe/dist/manifest.json` (built 2026-10-29T23:31:16Z, Bun 1.4.4) and the four variant builds of § Sizes, and assembles every board with the one `assemble` the board and the Snapshot share. Bytes are raw / gzip (level 9). A chunk's gzip is its script's and its style's, each compressed alone; a board's is the whole file's, as a server or an archive would send it. Board and Snapshot files leave out the probe's instrumentation (2,367 bytes; its hash stays in the view policy). No board here holds the ext-apps `App` (below).

### Chunks

The chunks the boards use, and the alternatives measured; the probe's own chunks are left out (`probeOnly` in `evidence/sizes.json`). Script and style together:

| Chunk | What it holds | Raw / gzip | Group 4 build, raw | Boards |
| --- | --- | --- | --- | --- |
| `diff-review` | `@pierre/diffs`, Shiki, every Shiki grammar (7,991,212 bytes) and theme (1,333,572), `@pierre/highlights` (650,847), the Oniguruma WebAssembly (629,400) | 11,483,932 / 2,061,499 | 11,607,925 | UJ-1, all |
| `diff-review`, `trim` build | the same with 17 grammars (1,126,814) and no theme catalog, Oniguruma or Highlights | 1,644,861 / 278,790 | — | — |
| `diff-review`, `plain` build | no grammar: highlighting off | 516,571 / 148,672 | — | — |
| `plantuml` | `plantuml.js` and `viz-global.js` (Graphviz) | 4,645,742 / 1,665,332 | 4,645,742 | golden, all |
| `mermaid` | Mermaid, its parser, cytoscape, KaTeX 0.18 | 3,803,165 / 1,040,639 | 3,958,186 | all |
| `plantuml-smetana` | `plantuml.js` only | 3,187,912 / 1,053,047 | 3,187,912 | golden with Smetana |
| `mathlive` | MathLive, its 20 fonts (346,972 / 267,241) | 1,179,504 / 495,903 | 1,179,504 | all |
| `math` | KaTeX 0.19, its 20 fonts (346,972 / 267,213) | 646,503 / 350,363 | 646,503 | all |
| `chart` | ECharts' bar chart, grid, tooltip and canvas renderer, zrender | 507,148 / 171,464 | 1,075,115 | all |
| `app-channel-jitless` | ext-apps `App` with the MCP client and zod | 313,693 / 83,574 | 353,456 | none (below) |
| `form` | RJSF core and utils, markdown-to-jsx | 257,948 / 87,738 | 396,928 | all |
| `graph` | xyflow, dagre, xyflow's stylesheet | 251,625 / 80,312 | 251,625 | UJ-1, all |
| `shell` | React, ReactDOM, the port, the tokens and base styles | 235,753 / 73,853 | 235,753 | every board |
| `renderer-json-render-jitless` | json-render and zod | 159,717 / 47,019 | 194,962 | — |
| `lib-radix` | ten Radix primitives | 145,266 / 47,208 | 145,318 | every board |
| `markdown` | markdown-it, DOMPurify | 136,335 / 55,188 | 148,324 | UJ-1, all |
| `date-picker` | react-day-picker, date-fns | 90,420 / 24,326 | 90,420 | all |
| `lib-table` | TanStack Table | 41,185 / 13,162 | 41,197 | all |
| `lib-dnd` | Pragmatic drag and drop | 22,880 / 7,123 | 22,880 | all |
| `diagram-svg` | a Snapshot's diagram from its renders | 7,123 / 3,290 | — | Snapshots with renders |
| the 20 other chunks | the atoms, layouts and own widgets, `renderer-own` (1,476), and `select`, `popover` and `scroll-lock`, which no board uses | 75,750 / 32,839 together; 857 to 8,358 each | the same | — |

### Boards and Snapshots

Each board through `assemble`, as srcdoc and as Snapshot, in the build and in its variants. The srcdoc and the Snapshot with the renderer chunks are one file: the same `assemble` writes both (AD-9). The Snapshot with renders only carries each diagram's light and dark SVG from run `snapshot-renders` and the `diagram-svg` chunk instead of the renderers.

| Board | Build | srcdoc, and Snapshot with the renderer chunks | Snapshot with renders only |
| --- | --- | --- | --- |
| **Golden** (6 items: Group, Row, PlantUML, Text, Choice, TextField; 9 chunks) | build | **5,044,979 / 1,789,603** | **429,393 / 129,730** |
| | `copy` | 4,935,506 / 1,753,829 | 319,920 / 94,637 |
| | `catch-all` (group 4) | 5,045,031 / 1,789,637 | 429,445 / 129,758 |
| Golden, `plantuml-smetana` chunk | build | 3,587,156 / 1,177,296 | as golden: the renders replace either chunk |
| **UJ-1-like** (8 items: Diff review, Markdown, Choice, Graph, TextField, layouts; 10 chunks) | build | **12,269,536 / 2,318,676** | the same: it has no diagram |
| | `trim` (17 grammars) | 2,430,465 / 537,102 | the same |
| | `plain` (highlighting off) | 1,302,175 / 406,461 | the same |
| | `copy` | 12,160,063 / 2,283,808 | the same |
| | `catch-all` (group 4) | 12,405,570 / 2,355,779 | the same |
| **Every component** (40 items; 31 chunks) | build | **23,519,941 / 6,180,832** | **15,142,527 / 3,484,794** |
| | `trim` | 13,680,870 / 4,397,811 | 5,303,456 / 1,703,089 |
| | `plain` | 12,552,580 / 4,267,123 | 4,175,166 / 1,572,735 |
| | `copy` | 23,745,730 / 6,256,029 | 15,368,316 / 3,560,464 |
| | `catch-all` (group 4) | 24,517,955 / 6,496,927 | 15,985,520 / 3,748,587 |

- **Inlining only the chunks a board uses works** (criterion 6's condition): `assemble` inlines the shell, the renderer and the closure of the board's item types, and no other chunk (`chunks` per board in `evidence/sizes.json`).
- **Three chunks set every size.** Diff review is 94% of the UJ-1-like board. The PlantUML chunk is 92% of the golden board, and the golden case's time to visible follows it (§ Golden case time). On the every-component board, Diff review, PlantUML and Mermaid are 85%.
- **A Snapshot that carries renders is 12 times smaller for the golden case**: 429,393 bytes against 5,044,979, gzip 129,730 against 1,789,603. On the every-component board the renders save 8,377,414 bytes, the two diagram renderers less the two diagrams' four SVG renders (57,376 bytes of SVG text, escaped in the data block). The SVG renders also open without parsing a renderer (§ Run `snapshot`).
- **Diff review is the next lever.** With the 17 grammars the UJ-1-like board is 2,430,465 bytes, a fifth of the build's; with highlighting off, 1,302,175. Highlighting is a PO decision (§ Diff highlighting); the grammar list is a `widgets` epic decision. Either way the theme catalogs, the Oniguruma WebAssembly and the Highlights backend can go: Diff review uses none of them.

### Library chunks against a copy per chunk

The `copy` build bundles each component's own copy of the library code it imports. A copy holds only what that component uses, while a library chunk holds every primitive any component uses:

| Library chunk | Shared, script bytes | The copies in its users' chunks, together | Per user |
| --- | --- | --- | --- |
| `lib-radix` | 145,266 | 513,780 | form 104,749; select 91,541; popover 70,102; date-picker 70,010; dialog 44,322; choice 35,865; slider 29,398; tabs 28,203; toggle-group 25,947; toggle 13,643 |
| `lib-table` | 41,185 | 40,164 | table (Table, Tree and Spreadsheet are one chunk) |
| `lib-dnd` | 22,880 | 43,035 | ranking 21,541; kanban 21,494 |

- **Per board** the trade-off goes both ways. The golden and UJ-1-like boards use one Radix primitive, through Choice, and are 109,473 bytes smaller with copies. The every-component board is 225,789 bytes larger with copies.
- **Either way the difference is under 1% of a board with Diff review or a diagram, and 2% of the golden board.** The library chunks are the right default once a board holds two or more Radix components. `lib-table` is used by one chunk, so it could fold into `table`.

### Fonts

- **The build inlines KaTeX's fonts twice.** KaTeX's 20 faces are 346,972 bytes raw (267,213 gzip) of the `math` chunk's 369,894-byte stylesheet. MathLive's 20 faces are the same 20 files, byte for byte (SHA-256 of each `data:` URL), in the `mathlive` chunk. The every-component board carries both: 693,944 bytes, 3.0% of it. A font chunk the two share, like a library chunk, would save 346,972 bytes on a board with both.
- **DESIGN.md's faces are not in the build.** Inter (400, 500, 600) and JetBrains Mono (400) are to be inlined into every board and every Snapshot (DESIGN.md, Typography), but their `@fontsource` packages are not installed: their licence and source are open (design.md, decision 1; task 8.1). `tools/sizes.ts` therefore fetches `@fontsource/inter`, `@fontsource/jetbrains-mono` and `@fontsource-variable/inter`, all 5.3.0, from the npm registry, checks each tarball's integrity, and builds what the shell's stylesheet would carry: each package's own `@font-face` rules, woff2 only, as `data:` URLs. What that adds to every board and Snapshot:

  | Subsets | Inter static 400, 500, 600 and JetBrains Mono 400: woff2; CSS raw / gzip | Inter variable and JetBrains Mono 400: woff2; CSS raw / gzip |
  | --- | --- | --- |
  | latin | 93,556; 126,053 / 96,935 | 69,424; 93,240 / 71,751 |
  | latin and latin-ext | 208,176; 280,298 / 215,987 | 161,828; 217,172 / 167,522 |
  | every subset (with Cyrillic, Greek, Vietnamese) | 332,496; 450,722 / 344,540 | 261,656; 352,599 / 270,797 |

  Base64 makes the CSS a third larger than the woff2 files, and gzip takes most of that back. With latin and latin-ext, the faces add 5.6% to the golden board as built, but 65% to its Snapshot with renders only (429,393 bytes), where they would be 40% of the file. The UI ships in English and Italian (EXPERIENCE.md, Languages), which the latin subset covers; agent content in other scripts would fall back to a system font. The subset choice is a `view` epic decision; the licence is the product owner's (task 8.1).

### What the pending decisions change

| Decision (owner) | Size effect, raw bytes |
| --- | --- |
| Radix Select out of the view (§ Criterion 1, PO) | `@radix-ui/react-select` is 20,742 bytes of `lib-radix`'s 145,266; the `select` chunk, 6,776, is in no board. Small either way |
| The style-element and markup shims (§ S-6, § Diff highlighting, PO) | 846 and 1,602 bytes minified, 405 and 712 gzip (`shims` in `evidence/sizes.json`); the diagram style shim lives in the diagram chunks |
| Board policy `img-src blob:`, `font-src data:` (AD-8, PO) | None: policy text only |
| Highlighting on or off (§ Diff highlighting, PO) | Diff review 11,483,932 as built; 1,644,861 with 17 grammars and no unused theme or engine; 516,571 off. The UJ-1-like board: 12,269,536; 2,430,465; 1,302,175 |
| Graphviz (`viz-global.js`) in or out (§ PlantUML, PO) | 1,457,830 on every board with a PlantUML diagram: the golden board is 5,044,979 with it and 3,587,156 without |
| The view's message set on ext-apps' `App` (§ Criterion 1) | 313,693 on every board, more than the shell's 235,753: zod (101,475) and the MCP client (163,992). A Snapshot has no host, so it needs none of it. Not in the boards above |
| json-render rather than AskBoard's own renderer (§ Renderer comparison, PO) | 158,241 more on every board (159,717 against 1,476) |
| DESIGN.md's fonts (task 8.1, PO) | 93,240 to 450,722 on every board and every Snapshot, by subsets (above) |

### Budget

None is named. SOLUTION-DESIGN §10.3 asks for the bundle and Snapshot sizes "inlining only the chunks a board uses", and design.md (Open Questions) leaves an absolute budget for the board's share of SM-3 to the `view` epic and the benchmark. The PRD sets SM-3 as a time, not a size, and no NFR names a size. The sizes above are therefore reported against no budget; the time they cost the golden case is in § Golden case time, and the time to open the Snapshots is below.

### Run `snapshot` (task 5.2)

First `bun drive.ts snapshot-renders --script renders --engines chromium --variants board-media --fixtures golden,size-uj1,size-all` keeps the renders: 3 loads, all pass. Then `bun drive.ts snapshot --script snapshot --renders snapshot-renders --fixtures golden,size-uj1,size-all` opens each board as a Snapshot file from `file://`, with the renderer chunks and with the renders only, each in the light and the dark colour scheme: 60 loads, on 2026-10-30, with the engines of § Method. Verdict and time to visible in ms from the navigation's start (`performance.timeOrigin`), one load each:

| Board | Diagrams | Scheme | Chromium | Firefox | WebKit | Chrome | Edge |
| --- | --- | --- | --- | --- | --- | --- | --- |
| golden | renderer chunks | light | pass 224.7 | pass 491 | pass 333 | pass 249.2 | pass 292.1 |
| | | dark | pass 216.7 | pass 478 | pass 276 | pass 224.5 | pass 233.7 |
| | renders only | light | pass 42.4 | pass 115 | pass 65 | pass 60.5 | pass 48.7 |
| | | dark | pass 43 | pass 111 | pass 68 | pass 62.9 | pass 48.3 |
| UJ-1-like | renderer chunks (no diagram) | light | pass 253.2 | pass 543 | pass 1374 | pass 263.2 | pass 286.5 |
| | | dark | pass 254.6 | pass 541 | pass 1370 | pass 260.6 | pass 267 |
| | renders only (the same file) | light | pass 252.7 | pass 545 | pass 1359 | pass 246.2 | pass 261.3 |
| | | dark | pass 253.2 | pass 548 | pass 1331 | pass 259.1 | pass 278 |
| every component | renderer chunks | light | pass 704.3 | pass 1873 | **fail** 1938 | pass 697.5 | pass 757.3 |
| | | dark | pass 686.8 | pass 1823 | **fail** 1929 | pass 693.8 | pass 686.9 |
| | renders only | light | pass 404.1 | pass 974 | **fail** 1520 | pass 399.5 | pass 427 |
| | | dark | pass 420.5 | pass 953 | **fail** 1518 | pass 413 | pass 411.6 |

- **Every Snapshot renders, makes no request and follows the colour scheme.** No load requested anything besides the file itself (`file:` URLs included). In each load the view's `.dark` class matched the scheme and every diagram's latest render had the scheme's theme. The screenshots are in `probe/runs/snapshot/<engine>/`.
- **The four failures are Radix Select's, not the Snapshot's.** Each WebKit load of the every-component board has one `style-src-attr` violation, which the script reports from ReactDOM's line. ReactDOM is creating the hidden native `<select>` Radix renders for the Form's single pick from a list, and WebKit reports any native `<select>` under a hash-only `style-src` (§ Criterion 1). Run `snapshot-radios` opens the same board with that pick shown as radios (`size-all-radios`), with its own renders run, `snapshot-renders-radios`: all 20 loads pass, in every engine, mode and scheme.
- **Renders open faster.** The golden Snapshot with renders only is visible in 42 to 115 ms, against 217 to 491 ms with the PlantUML chunk, which the browser no longer parses. On the every-component board: 400 to 974 ms against 687 to 1,873 ms, leaving WebKit's failing loads aside.
- **WebKit is slow on Diff review**: 1.33 to 1.37 s to visible for the UJ-1-like board, against 246 to 548 ms elsewhere, as § Diff highlighting found for the highlighted diff on the board.
- **The files** are the sizes of § Boards and Snapshots plus the probe's instrumentation, 2,385 bytes: `probe/runs/snapshot/snapshots/`, from 431,778 bytes (golden, renders only) to 23,522,326 (every component, renderer chunks). Firefox opened the 23.5 MB file in 1.8 s.

**Task 5.1 is done; task 5.2 stays open, awaiting PO.** Task 5.2's runs are complete, and the Snapshot sizes are in the table above. Its verification asks for no violation, and the every-component Snapshot shows one in WebKit, from the Form's Radix Select. The board passes everywhere with that pick shown as radios (run `snapshot-radios`). The task closes when the product owner decides Radix Select (task 8.3): with radios for single picks it passes as run; with Select kept, the violation is the one § Criterion 1 already records.

**For group 8** (proposed outcomes and the spine update):
- **How Snapshots carry diagrams:** propose the renders, with no renderer chunk: 12 times smaller for the golden case (429,393 bytes against 5,044,979), visible in 42 to 115 ms, and passing in every engine and scheme. The alternative, the renderer chunks inlined, also passes. DESIGN.md already says a Snapshot carries a light and a dark render of every diagram. What the spine lacks is how the renders reach `snapshot`, which assembles from the board document and the log (AD-15, AD-20), not from the view; that is a `view` and `snapshot` epic item, or an AD-9 sentence.
- **AD-9's manifest and `assemble`:** the measured shape holds: library chunks, each board inlining the closure of its item types. Two additions to propose: a font chunk shared by KaTeX and MathLive (346,972 bytes saved where both are used), and the build rule that a bundler plugin's resolve filter names only what it maps, with a CI size check per chunk against the previous build, since a filter that matched every import doubled the chart chunk with no visible failure.
- **Diff review:** if highlighting stays on, propose a fixed grammar list in the `widgets` epic, and drop the theme catalogs, the Oniguruma WebAssembly and the Highlights backend from the chunk: 11,483,932 → 1,644,861 bytes with 17 grammars. Off: 516,571.
- **Fonts:** the faces add 93,240 to 450,722 bytes to every board and Snapshot, by subset and by static or variable Inter. The PO decides the licence and source (task 8.1); the `view` epic decides the subsets.
- **ext-apps `App`:** 313,693 bytes on every board if the view's message set is built on it. That is more than React; a Snapshot needs none of it.
- **No size budget exists** to amend; if the PO wants one, SM-3's benchmark is where it would be set.

## Linux (task 7.1)

- **Image:** `askboard-spike-renderer:linux`, ID `sha256:e35be09d0e971a030bf7d75e44c305d084331514d597911de07eb8e33d5b8c6a`, built by `linux/Dockerfile` from Playwright's own image `mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea`, with Bun 1.4.4 copied from `oven/bun:1.4.4-debian@sha256:93d5032fe06d163427822dc1598f420363759bb18155c9cc90eb1be05a64a19e` (the mod delivery spike's pin).
- **Platform:** Ubuntu 24.04.5 LTS, aarch64, in Docker Desktop's Linux VM on this Mac. The engines are the same Playwright builds as on macOS (`chromium-1248`, `firefox-1555`, `webkit-2370`): Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2. Chrome and Edge are not in the image ("Chromium distribution 'chrome' is not found"), so the Linux column covers the three CI engines. x86-64 Linux, the architecture of GitHub's hosted runners, is untested: this machine pulls the image's arm64 variant.
- **How:** `sh linux/run-linux.sh <runs dir>`, from the change folder, after `bun run build` and the renders runs. The probe is mounted read-only, with its macOS `dist/` and `node_modules/`: the driver and the stand-in are JavaScript, and the build's native tools are not needed. A runs folder is mounted over `probe/runs`, the container runs with `--ipc=host` and is removed when it exits. The runs were made on 2026-10-30 and copied into `probe/runs/linux-*`. `linux-snapshot-radios` was run after the others, with the same image and mounts, and then added to the script.

| Linux run (macOS run) | Loads | Against macOS |
| --- | --- | --- |
| `linux-matrix` (`matrix`) | 99 | The same verdict in all 99 (`bun tools/compare-runs.ts linux-matrix matrix`), and the same number of violations in 97. The MathLive variant with its keyboard in the frame and no shim (`c-mathlive-sandboxed`), which fails on both, makes 22 blocked style writes per policy in Firefox and WebKit, against 23 |
| `linux-c3c4`, `linux-c3c4-blob`, `linux-c3c4-snapshot` (`c3c4`, `c3c4-blob`, `c3c4-snapshot`) | 18 each | The same verdicts and violation counts. Criterion 3 passes; criterion 4 fails on the board as written and passes with `board-img-blob` and in a Snapshot. Under group 5's request rule, Linux Chromium's Snapshot of `plantuml-resources-default` records the engine's four blocked `file:` script loads (`themes.js`, `c4.min.js`) as requests; that fixture fails on both platforms |
| `linux-golden-time` (`golden-time`, with `--repeat 10` instead of 20) | 90 | All pass |
| `linux-snapshot` (`snapshot`) | 36 | As on macOS: all pass except the every-component Snapshot in WebKit, with the same `style-src-attr` from Radix Select's native `<select>` |
| `linux-snapshot-radios` (`snapshot-radios`) | 12 | All pass |

Golden case time on Linux, in ms from `t0`, median (maximum) of 10 loads, beside macOS's 20 (§ Golden case time):

| Engine | `golden`, Linux | `golden`, macOS | `golden-smetana`, Linux | `golden-text`, Linux | Source edit, render start to image, Linux |
| --- | --- | --- | --- | --- | --- |
| Chromium | 315.3 (341.9) | 235.8 (271.6) | 286.4 (307.1) | 38.6 (46.3) | 17.8 (20) |
| Firefox | 555 (570) | 504 (566) | 477.5 (503) | 52 (56) | 27 (30) |
| WebKit | 321 (346) | 274.5 (299) | 315.5 (337) | 33 (36) | 18 (23) |

- **The PlantUML diagram is 88 to 91% of the golden case's time to visible on Linux** (`golden` minus `golden-text`: 276.7 ms in Chromium, 503 in Firefox, 288 in WebKit), as on macOS (86 to 93%). The VM's times are 10 to 34% above the Mac's and are not comparable to the millisecond; the engines rank the same.
- **The pin follows "create order"** on Linux too: in every load with a diagram the anchor moves from y = 153 to 213 (Chromium), 155 to 215 (Firefox) and 154 to 214 (WebKit). The system fonts differ from macOS's, so the positions do too.
- **Snapshots open on Linux** as on macOS: the golden Snapshot with renders only in 45 to 85 ms, against 282 to 489 ms with the PlantUML chunk.
- **Not run on Linux** (task 7.1 names only the four runs above): criterion 2, criterion 5, the S-checks, Diff highlighting, the anchors, the Mermaid label measurement and the renderer comparison. Their Linux cells are untested.
