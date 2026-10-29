# Findings: renderer spike

The exit criteria are in SOLUTION-DESIGN §10.3, the UX checks S-1 to S-8 in `docs/ux-askboard-2026-10-27/architecture-change-requests.md`, and the approach in `design.md`. Raw runs stay in `probe/runs/<run>/`, which git ignores: one JSON file and one screenshot per load, and `summary.json`. Every verdict below names its run. Commands run from `probe/` unless they say otherwise.

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
- The fonts fail, so the probe does not adopt them. The view uses the system font stacks (`styles/base.css`; `--ab-font-sans` and `--ab-font-mono` in `dist/tokens.css`). **Awaiting PO:** the fonts' licence and source (task 8.1).
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

  Three of these (argparse, khroma, robust-predicates) concern view components the UX chose. The Tailwind ones concern the build tool. If these packages enter the root lockfile in the `view` epic, the root `check:licences` fails the same way. The product owner decides (task 8.1).
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
  - Choice is built on Radix Radio Group (single) and Checkbox (multiple), Toggle on Radix Switch, and Tabs on Radix Tabs (EXPERIENCE.md, Atoms). The four come from the `lib-radix` library chunk (43,965 bytes, 13,756 gzip), which the three chunks need.
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
| **Renderer chunk, raw / gzip bytes** | 1,476 / 765 | 194,933 / 56,347 | 194,962 / 56,366 |
| What the chunk holds (bytes in the minified output) | the renderer, 637 | zod 130,440; `@json-render/core` 40,239; `@json-render/react` 21,767; the adapter 1,461 | the same, plus the `jitless` line |
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

- **From t0**, json-render costs 6 to 28 ms more per load in every engine: it has 193 KB more script to parse. **From mount**, the two are within 10 ms of each other. json-render is slower by 3 to 10 ms in Chromium, Firefox and WebKit, and faster by 4 to 6 ms in Chrome and Edge.
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
| Script, raw / gzip | 3,955,799 / 1,093,862 bytes | 5,304,290 bytes raw |
| Style, raw / gzip | 2,387 / 947 bytes (`_diagram.tsx`'s classes) | — |
| elkjs among the inputs | none; `inputs.stubbed: ["elkjs/lib/elk.bundled.js"]` | `elk.bundled.js` |
| `org.eclipse.elk` | 0 | 342 |
| `Eclipse Layout Kernel` | 0 | 3 |
| `workerUrl` | 0 | 3 |
| `knownLayoutAlgorithms` | 0 | 1 |

- Source: `bun tools/check-elkjs.ts`, which prints "elkjs check: 0 problem(s)".
- The four identifiers occur in elkjs 0.9.3's `lib/elk.bundled.js` and survive minification. Mermaid's own glue uses option keys such as `elk.layered…` and the type name `ElkNode`, so those are not searched for.
- The control build shows that the search finds elkjs when it is there. Leaving elkjs out saves about 1.35 MB raw.
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

**The chunk's inputs and their licences** (`dist/manifest.json`). Bytes are each package's share of the minified chunk.

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
- **Unlicense reaches the chunk.** `robust-predicates`, flagged by task 1.3's licence check, is in the Mermaid chunk and so ships with it. The product owner decides (task 8.1).
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

- Graphviz is EPL-2.0, the licence of elkjs, which §9 excludes as a trap. The adoption rule admits EPL-2.0 only unmodified, and whether Viz.js's build of Graphviz is unmodified is not stated in the tarball. Keeping `viz-global.js` is therefore a licence decision as well as a CSP one (below). The product owner decides (task 8.1); the PRD addendum changes only if they do.
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
