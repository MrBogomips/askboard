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
