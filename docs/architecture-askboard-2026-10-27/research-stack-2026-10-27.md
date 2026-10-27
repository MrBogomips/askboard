---
title: "Research: AskBoard stack verification (platform, formula language, widgets, distribution)"
checked: 2026-10-27
scope: "Re-check of the 2026-10-22 shortlist (prd-agentxema-2026-10-21/research-visual-companion.md) for the AskBoard architecture: MCP TypeScript SDK and MCP Apps, catalog renderers, forms, runtimes, formula-language candidates, widget components, single-executable distribution and plugin packaging. GitHub figures read with the GitHub REST API, npm figures with the npm registry, both on 2026-10-27."
note: "Marking: (v) checked against a primary source on 2026-10-27; (secondary) blog, search summary or third-party write-up; UNVERIFIED not confirmed. Every version, date, licence, star count, last push and archived flag in the tables is (v) unless marked. Adoption rule: OSI permissive licence (MPL-2.0/EPL-2.0 only for unmodified dependencies; no GPL/AGPL in the shipped bundle; no source-available, trial, licence-key or open-core feature the product depends on); at least 1,000 stars or a named exception; push on or after 2026-04-27, release on or after 2025-10-27, not archived. Research only: no architecture decision."
---

# AskBoard stack verification (checked 2026-10-27)

## Key findings

1. **Shortlisted items now failing the rule:** react-markdown (last release 2025-03-07); `@dnd-kit/core` (last release 2024-12-05; only the 0.x `@dnd-kit/react` ships); git-diff-view (743 stars) and Annotorious (869), which need named exceptions; SVAR Gantt (215/260 stars). Failing formula candidates: HyperFormula (GPL-3.0 or proprietary licence key), expr-eval (unpatched code-execution CVEs), `@formulajs/formulajs` (823 stars), fast-formula-parser, jexl, filtrex (dormant), cel-js (archived).
2. **MCP TypeScript SDK v2** (`@modelcontextprotocol/server` 2.4.0) is the stable line and implements revision 2026-07-28: `server/discover` instead of `initialize`, per-request stateless serving, multi-round-trip requests (`inputRequired()` with `requestState`), and a legacy shim for 2025 clients. **The Tasks extension (SEP-2663) is not implemented** (issue #2189 open).
3. **MCP Apps:** ext-apps 2.0.4 still states "no *supported* host implementation" beyond `examples/basic-host`. `AppBridge` ships as the `app-bridge` subpath. No supported standalone browser host exists. `@mcp-ui/client` `AppRenderer` calls itself "the recommended SDK for MCP Apps Hosts".
4. **`@json-render/mcp` 0.21.3 depends on SDK v1 (^1.27.1) and ext-apps v1 (^1.2.0)**. Next to SDK v2, that puts two SDK majors in one server.
5. **A2UI v1.0 is still a candidate**; production is v0.9.1. `@a2ui/react` 0.14.0 ships, but documents v0.9 only. Basic catalog v1 still has no table or chart. A separate VegaChart catalog now adds charts.
6. **Runtimes:** Node 26 becomes Active LTS on 2026-10-28 (EOL 2029-04-30). Node 24 has been in maintenance since 2026-10-20 (EOL 2028-04-30). React 19.3.1, Vite 8.3.5. New majors: TanStack Table 9, Mermaid 12.
7. **Formula language:** JSONata (three critical code-execution advisories, 2026-08) and mathjs (two high advisories, 2026-04) show that sandboxes evaluating against JavaScript objects break. **IronCalc** (Rust/WASM, MIT OR Apache-2.0, 4,231 stars) is the only engine that passes the rule with a dependency graph, cycle and missing-reference errors, and no path to JavaScript.
8. **Gantt:** DHTMLX Community has been MIT since v10.0. PRO keeps critical path, auto-scheduling, baselines, undo, calendars, markers and the ready-made React component. Community export uses DHTMLX's online service. No MIT or Apache CPM library has 1,000 stars.
9. **Distribution:** `bun build --compile` and `deno compile` are stable and cross-compile to macOS/Linux x64/arm64. Node SEA is still at Stability 1.1, and Node's CI skips macOS x64. Official marketplace plugins launch MCP servers with `npx`, `uvx`, `docker`, `bun run` or remote HTTP; none of the 14 sampled ships a compiled binary.

## A. Platform and host

| Item | Version (date) | Licence | Stars | Last push | Adoption rule | Notes |
|---|---|---|---|---|---|---|
| MCP TS SDK v2 `@modelcontextprotocol/server`, `/client` | 2.4.0 (2026-10-23); 2.0.0 on 2026-07-27 | LICENSE: MIT-to-Apache-2.0 transition, new code Apache-2.0; npm Apache-2.0 | 13,661 | 2026-10-27 | Pass | Node ≥20, Bun, Deno. 2026-07-28 core implemented; Tasks extension not (`tasks/get`/`tasks/cancel` hand-registrable). 2.4.0 adds Skills over MCP (SEP-2640, experimental). |
| MCP TS SDK v1 `@modelcontextprotocol/sdk` | 1.32.2 (2026-10-23) | npm MIT | (same repo) | | Pass | Fixes for ≥6 months after 2026-07-27; 2025-11-25 only. |
| `@modelcontextprotocol/ext-apps` | 2.0.4 (2026-10-27) | LICENSE Apache-2.0 with transition notice; npm still MIT | 3,011 | 2026-10-27 | Pass | Spec stable 2026-01-26 plus draft; wire unchanged 1.x to 2.x; peers SDK v2. No supported host. |
| `@mcp-ui/client` | 7.1.1 (2026-05-09) | Apache-2.0 | 5,235 | 2026-09-16 | Pass | React `AppRenderer`; a library, not a host. |
| json-render `@json-render/core`, `react`, `mcp` | 0.21.3 (2026-10-24) | Apache-2.0 | 18,809 | 2026-10-24 | Pass (0.x) | Dynamic props `$state`, `$cond`, `$template`, `$computed` (registered functions: the formula hook). Table, no charts. `mcp` pins SDK v1 and ext-apps v1. |
| A2UI `@a2ui/react`, `@a2ui/web_core` | 0.14.0 (2026-10-17); protocol v0.9.1, v1.0 candidate | Apache-2.0 | 16,837 | 2026-10-27 | Pass (README: "early stage public preview") | Basic catalog v1: 18 components, no Table or Chart; separate VegaChart and MCP (`McpApp`) catalogs. |
| `@rjsf/core` | 6.11.0 (2026-09-29) | Apache-2.0 | 15,923 | 2026-10-27 | Pass | |
| `@jsonforms/react` | 3.8.0 (2026-06-16); next 3.9.0-alpha.2 | MIT | 2,752 | 2026-10-26 | Pass | |
| Node.js | 26.12.1 (2026-10-21); LTS 24.22.1 (2026-10-20) | MIT plus bundled-dependency licences | 123,138 | 2026-10-27 | Pass | 24 maintenance from 2026-10-20, EOL 2028-04-30; 26 LTS from 2026-10-28, EOL 2029-04-30; 27 alpha 2026-10-28 (annual schedule). |
| React | 19.3.1 (2026-10-14) | MIT | 251,895 | 2026-10-27 | Pass | No 20.x tag on npm. |
| Vite | 8.3.5 (2026-10-21) | MIT | 83,600 | 2026-10-27 | Pass | |

## B. Formula language

| Item | Version (date) | Licence | Stars | Last push | Adoption rule | Notes |
|---|---|---|---|---|---|---|
| HyperFormula | 3.5.0 (2026-10-09) | GPL-3.0-only or proprietary, chosen "by the license key you apply" | 2,821 | 2026-10-27 | **Fail** (licence) | Fits the requirement otherwise: dependency graph, named expressions, cycle errors, about 400 functions (secondary). |
| IronCalc `@ironcalc/wasm`, `@ironcalc/nodejs` | 0.9.1 (2026-10-21) | MIT OR Apache-2.0 | 4,231 | 2026-10-27 | Pass | WASM 2.09 MB (0.72 MB gzip). Excel syntax and functions, automatic recalculation; WASM API has `newDefinedName`, `getTokens`, `cycleReference`. Docs: "in its infancy". |
| mathjs | 15.2.0 (2026-04-07) | Apache-2.0 | 15,098 | 2026-09-13 | Pass, if hardened | AST parser, no `eval`. CVE-2026-40897 and -41139 (high, fixed in 15.2.0); code execution 2017, prototype pollution 2020. Docs: sandbox "should" hold; disable `import`, `createUnit`, `reviver`; use a Worker. Maths only; no graph. |
| JSONata | 2.2.2 (2026-07-16) | MIT | 2,704 | 2026-10-20 | Pass, with a security caveat | JSON query language. Critical code execution CVE-2026-77413/-77414/-77415 (fixed 2.2.0/2.2.1), CVE-2024-27307. Not spreadsheet-like; no graph. |
| `@formulajs/formulajs` | 4.6.1 (2026-07-28) | MIT | 823 | 2026-10-01 | **Fail** (stars) | Excel function library only: no parser, no graph. |
| fast-formula-parser | 1.0.19 (2020-11-26) | MIT | 522 | 2025-09-10 | **Fail** | Excel parser with `DepParser`; dormant. |
| jexl | 2.3.0 (2020-09-15) | MIT | 662 | 2023-09-18 | **Fail** | Dormant. |
| expr-eval | 2.0.2 (2019-09-28) | MIT | 1,356 | 2024-08-15 | **Fail** | CVE-2025-12735, CVE-2025-13204, CVE-2026-12866 (critical): code execution, unpatched; fixed only in `expr-eval-fork`. |
| filtrex (original / cshaa fork) | 3.1.0 (2024-10-14) | MIT | 1,070 / 92 | 2021-03-16 / 2024-10-14 | **Fail** | Stale. |
| cel-js (ChromeGG) | 0.8.2 (2025-07-11) | MIT | 125 | archived | **Fail** | |
| `@marcbachmann/cel-js` | 8.0.0 (2026-07-07) | MIT | 210 | 2026-10-05 | **Fail** (stars) | CEL: safe by design; no graph, no spreadsheet functions. |
| `@bufbuild/cel` | 0.6.1 (2026-08-27) | Apache-2.0 | 40 | 2026-10-14 | Fail (stars); exception candidate (Buf) | Same CEL profile. |
| Univer `@univerjs/engine-formula` | 1.2.0 (2026-10-22) | Apache-2.0 | 22,737 | 2026-10-27 | Passes on paper; open core | Pro adds "server-side calculation, and performance-enhanced formula features"; 40.7 MB unpacked, needs `@univerjs/core`, rxjs. |
| Formualizer | (no npm release checked) | Apache-2.0 | 205 | 2026-10-25 | **Fail** (stars) | Rust/WASM engine. |
| FortuneSheet formula parser | 0.2.13 (2024-07-21) | MIT | 3,744 | 2025-12-15 | **Fail** (activity) | |

### Fit against the requirement

| Requirement | IronCalc | Own evaluator | mathjs | JSONata | CEL | HyperFormula |
|---|---|---|---|---|---|---|
| Spreadsheet-style syntax and functions | yes (Excel) | own subset | maths only | no | no | yes |
| Refer to board items by ID | via defined names (Excel name rules) | any ID grammar | identifiers | JSON paths | variables | named expressions |
| Recalculate as the user edits, across widgets | yes | own graph | own graph | own graph | own graph | yes |
| Detect cycles and missing references | `#CIRC!`; `#REF!`/`#NAME?` | topological sort; unresolved symbols | own | own | own | yes |
| Cannot run arbitrary code | yes: WASM, and formulas have no bridge to JavaScript | yes: AST interpreter with a whitelist | sandbox, broken in 2026 | sandbox, broken in 2026 | yes | yes |
| Adoption rule | pass | n/a | pass | pass | fail | fail |

**Recommendation: IronCalc** (`@ironcalc/wasm` behind a `FormulaEngine` adapter). Each referenceable item becomes a defined name bound to a hidden cell, or to a range for a table column. Agents write Excel syntax (`=SUM(costs)-budget`), and engine errors map to AskBoard's cycle and missing-reference states. The server can pre-check references with `getTokens` from the same engine. Use the WASM build on the server too, because `@ironcalc/nodejs` is a native addon, which is awkward in a single executable (inference). Run the engine in the board's sandboxed iframe or a Worker. Spike first:
- whether AskBoard IDs can follow Excel name rules (no hyphens, nothing like `A1`);
- recalculation latency at about 1,000 cells;
- the cost of loading 0.72 MB of gzipped WASM;
- deterministic locale and timezone;
- churn in the 0.x API.

**Runner-up: an own restricted evaluator.** An Excel-like grammar with a hand-written parser, or with mathjs 15.2 `parse()` used only as a parser (never `evaluate`/`compile`). It evaluates with whitelisted pure functions and builds its own graph: Kahn's topological sort detects cycles, and unresolved symbols mark missing references. It has no dependency and accepts any ID grammar. The cost is the function library, since formulajs fails the stars threshold.

## C. Widget components

| Item | Version (date) | Licence | Stars | Last push | Adoption rule | Notes |
|---|---|---|---|---|---|---|
| DHTMLX Gantt Community `dhtmlx-gantt` | 10.0.3 (2026-09-03) | MIT (v10.0, 2026-06-11) | 1,867 | 2026-09-03 | Pass, for Community features only | Community: grid, tree, inline editing, four link types with lag, drag, zoom, summary tasks, milestones. PRO only: critical path, slack, auto-scheduling, baselines, constraints, calendars, undo, WBS codes, markers, multi-select, ready-made `ReactGantt`. Export uses the DHTMLX online service. |
| Frappe Gantt | 1.2.2 (2026-02-25) | MIT | 6,154 | 2026-06-18 | Pass (push window closes 2026-12-18) | SVG bars, progress, dependency arrows; no grid. |
| SVAR Gantt `@svar-ui/react-gantt` | 2.8.2 (2026-10-27) | MIT core; PRO $749 to $6,799 | 215 (React) / 260 (Svelte) | 2026-10-27 | **Fail** (stars) | PRO only: critical path, auto-scheduling, baselines, slack, calendars, undo, markers, export. |
| CPM or scheduling library | n/a | | | | none qualifies | GitHub search finds only 0–11-star repos; bryntum/chronograph (MIT, 130 stars) is a reactive graph engine, not CPM. Write the forward/backward pass in-house. |
| vis-timeline | 8.5.6 (2026-10-26) | Apache-2.0 OR MIT | 2,571 | 2026-10-27 | Pass | |
| react-arborist | 4.0.1 (2026-10-11) | MIT | 3,714 | 2026-10-11 | Pass | Repository moved to jameskerr/react-arborist. |
| TanStack Table `@tanstack/react-table` | 9.3.1 (2026-10-12) | MIT | 28,526 | 2026-10-21 | Pass | v9 is the new major. |
| dnd-kit | `@dnd-kit/react` 0.5.1 (2026-10-15); `@dnd-kit/core` 6.3.1 (2024-12-05) | MIT | 17,753 | 2026-10-27 | Pass only through the 0.x `@dnd-kit/react` | The classic `core` package fails the release window. |
| Pragmatic drag and drop | 4.0.0 (2026-09-24) | Apache-2.0 | 12,788 | 2026-10-23 | Pass | |
| xyflow `@xyflow/react` | 12.12.0 (2026-09-24) | MIT | 38,797 | 2026-10-27 | Pass | |
| Mermaid | 12.2.0 (2026-10-13) | MIT | 90,891 | 2026-10-27 | Pass | Major 12. |
| `@plantuml/core` | 1.2026.9 (2026-10-17) | Tarball LICENSE MIT; repo LICENSE LGPL-3.0 | 13,380 | 2026-10-27 | Pass, on the npm MIT tarball | 7 MB unpacked. Licence header: "can occasionally display sponsored or advertising messages" on welcome and error images. |
| KaTeX | 0.19.1 (2026-10-23) | MIT | 20,475 | 2026-10-27 | Pass | |
| MathLive | 0.111.1 (2026-10-09) | MIT | 2,189 | 2026-10-23 | Pass | |
| `@pierre/diffs` | 1.6.2 (2026-10-26) | Apache-2.0 | 6,375 | 2026-10-27 | Pass | |
| git-diff-view `@git-diff-view/react` | 0.1.8 (2026-10-15) | MIT | 743 | 2026-10-17 | **Fail** (stars) | Single maintainer. |
| Apache ECharts | 6.1.0 (2026-05-19) | Apache-2.0 | 67,610 | 2026-10-13 | Pass | |
| Vega-Lite | 6.5.0 (2026-10-08) | BSD-3-Clause | 5,532 | 2026-10-21 | Pass | Matches A2UI's VegaChart catalog. |
| Annotorious | 3.9.5 (2026-10-20) | BSD-3-Clause | 869 | 2026-10-20 | **Fail** (stars); exception candidate | |
| react-markdown | 10.1.0 (2025-03-07) | MIT | 15,925 | 2026-10-03 | **Fail** (no release in 12 months) | Passing replacements: markdown-it 15.0.3 (MIT, 22,017) with DOMPurify 3.4.17 (MPL-2.0 OR Apache-2.0, 17,488), or streamdown 2.7.1 (Apache-2.0, 5,730). |
| Tiptap `@tiptap/core` | 3.32.0 (2026-10-13) | MIT | 38,876 | 2026-10-27 | Pass, core only | Avoid paid Pro extensions such as Comments (2026-10-22 research). |
| Excalidraw `@excalidraw/excalidraw` | 0.18.1 (2026-04-20) | MIT | 134,649 | 2026-10-27 | Pass | |

## D. Distribution of the MCP server

| Item | Version (date) | Licence | Stars | Last push | Adoption rule | Notes |
|---|---|---|---|---|---|---|
| Node SEA (`node --build-sea`, Node ≥25.5) | in 26.12.1 | MIT | (node) | 2026-10-27 | Pass; feature not stable | "Stability: 1.1 - Active development" (VFS 1.0). ESM entry and `assets` supported. macOS CI arm64 only ("x64 is not currently supported"). Cross-builds: target `node` as `executable`, code cache off. macOS needs `codesign`. |
| `bun build --compile` | Bun 1.4.4 (2026-10-22) | MIT, but statically links LGPL-2 JavaScriptCore | 96,434 | 2026-10-27 | Licence review needed (LGPL-2 inside the binary) | Stable; targets darwin and linux x64/arm64 (glibc, musl), windows; embeds assets and HTML imports. Owned by the harness vendor since 2025-12; the harness CLI ships this way (secondary). |
| `deno compile` | Deno 2.9.8 (2026-10-21) | MIT | 108,788 | 2026-10-26 | Pass | Stable; six targets "regardless of the host platform"; npm packages; assets via `--include`; `--bundle` experimental. |
| `@yao-pkg/pkg` | 6.24.0 (2026-10-23) | MIT | 930 | 2026-10-23 | **Fail** (stars) | vercel/pkg is archived. |
| MCP Bundles (`.mcpb`) | CLI 2.1.2 (2025-12-04) | MIT-to-Apache-2.0 transition | 2,154 | 2026-05-26 | Pass | Plugins accept a `.mcpb` path or URL (unpacked into `.mcpb-cache/`); Node bundles rely on a host Node. |

**How plugins ship MCP servers** (the 14 `.mcp.json` files in the official marketplace repository, 44,871 stars): `npx` (Playwright `@playwright/mcp@latest`, Firebase); `uvx` (Serena); `docker` (Terraform); `bun run --cwd ${CLAUDE_PLUGIN_ROOT}` (Discord, Telegram, iMessage, fakechat, which need Bun installed); remote HTTP (Context7, example plugin). The plugin reference also offers `${CLAUDE_PLUGIN_ROOT}` for bundled binaries, `${CLAUDE_PLUGIN_DATA}` for installed dependencies such as `node_modules` (kept across updates), `.mcpb` bundles, and `bin/` on the Bash PATH, but "claude.ai and Cowork don't install a plugin that has this directory" (v: https://code.claude.com/docs/en/plugins-reference).

**Recommendation.**
- **Default:** `npx -y <package>@<exact version>`, never `@latest`. Needs Node ≥20 (the SDK floor); target 24 or 26 LTS.
- **No Node:** a launcher under `scripts/` (not `bin/`) that, when `node` is missing or too old, downloads the platform executable from GitHub Releases into `${CLAUDE_PLUGIN_DATA}`, checks its SHA-256 and runs it.
- **Build tool:** `deno compile`: stable, all four targets from one CI host, permissive licences, and Deno is a supported SDK runtime. Run the MCP conformance and end-to-end suites against each binary.
- **Runner-up:** Node SEA (one runtime) once it reaches Stability 2 and tests macOS x64. Bun is the most proven toolchain, but needs an explicit LGPL-2 decision first.

## Unverified or conflicting

- **ext-apps and SDK v1 licence:** repo LICENSE Apache-2.0 with an MIT transition notice; npm says MIT. Legacy contributions stay MIT, so both apply.
- **`@plantuml/core` licence:** npm tarball MIT; plantuml/plantuml repo LGPL-3.0 (multi-licence project). Use the npm artifact.
- **DHTMLX editions:** the blog lists export and framework wrappers as PRO; README and docs comparison put export in Community (online service). Markers: PRO in the README, both editions in the docs comparison.
- **expr-eval CVE-2025-12735 severity:** GHSA says high; NVD and Tuxcare say 9.8 critical (secondary).
- **Function counts:** IronCalc publishes none on its docs landing page; about 400 for HyperFormula is secondary.
- UNVERIFIED: how the agent harness runs a Node-type `.mcpb` without Node; executable sizes for SEA, Bun and Deno; reliable SEA cross-builds for macOS x64.
- **Bun ownership and the harness CLI shipping as a Bun executable:** secondary (press coverage, 2025-12-03).

Sources (v): GitHub REST API (`repos`, `releases`, `license`, `advisories`), npm registry, https://github.com/nodejs/Release/blob/main/schedule.json, https://nodejs.org/api/single-executable-applications.html, https://bun.com/docs/bundler/executables, https://docs.deno.com/runtime/reference/cli/compile/, https://github.com/modelcontextprotocol/typescript-sdk (README, ROADMAP.md, docs/protocol-versions.md, docs/migration/support-2026-07-28.md), https://github.com/modelcontextprotocol/ext-apps, https://github.com/a2ui-project/a2ui (catalogs/, specification/v1_0), https://github.com/vercel-labs/json-render, https://github.com/DHTMLX/gantt, https://docs.dhtmlx.com/gantt/guides/editions-comparison/, https://dhtmlx.com/blog/meet-dhtmlx-gantt-community-edition-mit-license/, https://svar.dev/react/gantt/pricing/, https://mathjs.org/docs/expressions/security.html, https://docs.ironcalc.com/, https://github.com/ironcalc/IronCalc, https://github.com/dream-num/univer, https://github.com/anthropics/claude-plugins-official, https://github.com/modelcontextprotocol/mcpb. Secondary: https://kb.cert.org/vuls/id/263614, https://nvd.nist.gov/vuln/detail/CVE-2025-12735, https://devclass.com/2025/12/03/bun-javascript-runtime-acquired-by-anthropic-tying-its-future-to-ai-coding/.
