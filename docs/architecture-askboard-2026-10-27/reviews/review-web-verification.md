---
title: 'AskBoard architecture spine: web-verification review'
reviews: ARCHITECTURE-SPINE.md (status draft, updated 2026-10-27)
lens: 'Every committed decision web-researched or reality-checked, not asserted from training data'
checked: 2026-10-27
inputs: research-cc-delivery-2026-10-27.md, research-stack-2026-10-27.md
---

# Web-verification review: AskBoard architecture spine

**Verdict:** The versions and most of the Claude Code behaviours the spine rests on hold against primary sources today, but three committed rules contradict current browser or protocol behaviour (AD-11's Origin check, AD-8's "srcdoc gives an opaque origin" and its view CSP, and AD-18's refusal of the 2025 handshake). AD-2's one-process invariant is also exposed to an undocumented sibling process at connect time, so the spine needs the rewording below before it is adopted.

**Method.** I re-read both research files and checked the spine's load-bearing claims against them. Everything they did not cover I checked today against primary sources:

- Claude Code docs (`code.claude.com/docs/en/*.md`) and the GitHub CHANGELOG (top entry 2.1.311);
- the npm registry, through `npm view` and an unpacked `@ironcalc/wasm@0.9.1` tarball;
- the MCP `schema/2026-07-28/schema.ts`, the TypeScript SDK `docs/protocol-versions.md`, and the ext-apps spec and source;
- the WHATWG HTML spec, MDN content, browser-compat-data, W3C TRs, Bun `LICENSE.md` and docs, the Node release schedule, and the TypeScript 7.0 announcement.

Status meanings:
- **confirmed**: a primary source states it today.
- **contradicted**: a primary source states otherwise.
- **unverified**: no primary statement either way.

Totals: **52 claims: 39 confirmed, 7 contradicted, 6 unverified.**

## Claims checked

| # | Claim | AD | Status | Source |
| --- | --- | --- | --- | --- |
| 1 | Claude Code npm `latest` = 2.1.311 (2026-10-26), `stable` = 2.1.308 (2026-10-22) | Stack, AD-18 | confirmed | https://www.npmjs.com/package/@anthropic-ai/claude-code (`npm view … dist-tags`, `time`) |
| 2 | The provisional minimum 2.1.311 respects "never above `stable` at release" | AD-18, Stack | contradicted today (2.1.311 > `stable` 2.1.308) | same, plus https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md |
| 3 | A `SubagentStop` block keeps the subagent running and delivers `reason` "as its next instruction". The 8-continuation cap resets at each tool call; `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` raises it | AD-10 | confirmed | https://code.claude.com/docs/en/hooks |
| 4 | `SubagentStop` fires once, when the subagent finishes | AD-10 | confirmed, but only from 2.1.311 ("instead of about twice a minute" while working) | CHANGELOG 2.1.311 |
| 5 | `PreToolUse` input for an MCP tool carries `tool_input`, `tool_use_id`, `cwd`, `agent_id`/`agent_type` (absent in the main conversation) and `mcp_server` | AD-5, AD-17 | confirmed | https://code.claude.com/docs/en/hooks (common input fields, PreToolUse input) |
| 6 | Hook `cwd` is the worktree root | AD-5, AD-12 | confirmed for session worktrees ("`cwd` follows Claude"); not stated for `isolation: worktree` subagents | https://code.claude.com/docs/en/worktrees |
| 7 | A `PostToolUse` `systemMessage` is shown to the user | Conventions (board notice) | confirmed ("Warning message shown to the user"); for a subagent's call, unverified (already a spike criterion) | hooks |
| 8 | A `PreToolUse` hook can deny `AskUserQuestion` with a reason, or answer it with `allow` + `updatedInput.answers`. `AskUserQuestion` is removed from every subagent | AD-16, AD-17 | confirmed | hooks; https://code.claude.com/docs/en/sub-agents |
| 9 | `$.session.send({ to: { agentId } })` reaches a running subagent, with the id from `$.agent.list()` | AD-4 | confirmed | https://code.claude.com/docs/en/plugins/mods/api |
| 10 | `$.prompt.submit` waits for idle and starts a turn. The text follows a sentence naming the mod, unless `asUser: true` | AD-4 | confirmed | mods/api; https://code.claude.com/docs/en/plugins/mods/reference |
| 11 | Background polling is done with `$.clock.every`, started from `session.start` | AD-5 | confirmed | mods/api |
| 12 | The hook's `agent_id` is the same identifier that `$.agent.list()` returns and `$.session.send` accepts | AD-4, AD-5 | **unverified** | hooks; mods/api (neither says so) |
| 13 | The mod reaches the local API on `127.0.0.1` with `$.http.fetch` | AD-5 | **unverified**. No loopback rule is documented. Every mod's `$.http.fetch` is refused where the organization's policy disallows WebFetch. Limits: 30 s, 4 MiB | https://code.claude.com/docs/en/plugins/mods/admin |
| 14 | The mod's `$.http.fetch` sends no `Origin` header (the local API refuses any request that has one) | AD-11 | **unverified** | mods/api |
| 15 | The mod can read the session file (`$.fs.read`, 4 MiB) | AD-5 | confirmed | mods/reference (Limits) |
| 16 | A plugin can carry a mod with no separate installation | AD-19, Deferred | confirmed ("A mod is a plugin"; `hooks/hooks.json` holds `modules` and can also hold settings `hooks`). The spine still treats this as pending | https://code.claude.com/docs/en/plugins/mods/overview; mods/reference (Files) |
| 17 | Mod hooks run under `claude -p` | AD-4, AD-17 | confirmed. Drawing doesn't; `$.prompt.submit` keeps a `-p` run alive without `--max-turns` | mods/overview (Where mods run); mods/api |
| 18 | `--plugin-dir` loads a plugin, mod included, for one session | AD-17 | confirmed. Managed `disableSideloadFlags` rejects it | https://code.claude.com/docs/en/cli-reference; mods/reference |
| 19 | Plugin tool names are `mcp__plugin_<plugin>_<server>__<tool>` | Conventions | confirmed | https://code.claude.com/docs/en/mcp; https://code.claude.com/docs/en/plugins/components |
| 20 | `${CLAUDE_PROJECT_DIR}` is substituted in a plugin MCP server's `env` | AD-12 | confirmed. Claude Code also sets it in every stdio server's environment, since 2.1.139 | mcp; CHANGELOG 2.1.139 |
| 21 | A key that the session process, the hooks and the mod all know | Deferred (session file) | confirmed: `CLAUDE_CODE_SESSION_ID` in stdio MCP servers and hook commands, `$.session.id` in mods. It diverges after `/clear` and on `--continue` | https://code.claude.com/docs/en/env-vars |
| 22 | Claude Code acts on `readOnlyHint` (runs such calls in parallel) and `idempotentHint` (repeats a pending call once) | AD-6 | confirmed. The repeat applies to HTTP servers and connectors only, not stdio | mcp ("Mark tools that are safe to call twice") |
| 23 | Annotation defaults: `destructiveHint` true, `openWorldHint` true; `idempotentHint` meaningful only when not read-only | AD-6 | confirmed | https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts |
| 24 | Progress resets the idle timeout. Stdio idle window is 30 min; main-conversation calls go to the background after 120 s, subagent calls never; wall clock is about 28 h | AD-4 | confirmed | mcp; env-vars |
| 25 | Results: warning at 10k tokens, cap at 25k tokens, foreground text over 50,000 characters saved to a file, error text trimmed above about 11k characters | AD-6 | confirmed | mcp (MCP output limits) |
| 26 | Server instructions and upfront tool descriptions are capped at 4,096 characters | Conventions | confirmed | mcp |
| 27 | A tool name is at most 128 characters, `^[a-zA-Z0-9_-]{1,128}$` | Conventions | confirmed | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools |
| 28 | No root `anyOf`/`oneOf`/`allOf`; property names `[A-Za-z0-9_.-]{1,64}` | AD-6 | confirmed, secondary only (API 400 error reports; not in the official reference) | https://github.com/anthropics/claude-code/issues/27337; https://community.clay.com/x/support/wsidaqprlzqs/understanding-the-invalidrequesterror-in-claude-37 |
| 29 | MCP 2026-07-28 is current, and `inputSchema` defaults to JSON Schema 2020-12 | AD-6, AD-7, AD-18 | confirmed (`LATEST_PROTOCOL_VERSION = "2026-07-28"`) | schema.ts |
| 30 | The session process can learn the Claude Code version and refuse an ask below the minimum | AD-18 | **unverified**. `io.modelcontextprotocol/clientInfo` is optional, and "Servers SHOULD NOT use it to change their behavior". No version variable is documented for servers or hooks | schema.ts; env-vars |
| 31 | Serving 2026-07-28 only costs no supported setup | AD-18 | **contradicted**. The SDK's `serveStdio` serves 2025 openings unless given `legacy: 'reject'`. Claude Code users can force the old handshake (`MCP_PROTOCOL_NEGOTIATION=legacy`, the documented workaround for channel servers, or `MCP_SDK_GENERATION=v1`) | https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md; env-vars; mcp |
| 32 | Exactly one AskBoard process per Claude Code session | AD-2 | **unverified**. The SDK's stdio client probes the revision on "a short-lived sibling process spawned from the same parameters". Claude Code's v2 runtime is built on that SDK and probes stdio servers (CHANGELOG mentions "the protocol-version probe") | protocol-versions.md; mcp (MCP client runtimes) |
| 33 | `@modelcontextprotocol/server` 2.4.0 is `latest`; Node >= 20 | Stack | confirmed | npm |
| 34 | `@modelcontextprotocol/ext-apps` 2.0.4 is `latest`; it peers SDK v2 and zod ^4.2 | Stack, AD-8 | confirmed | npm |
| 35 | ext-apps works with an opaque-origin iframe | AD-8 | confirmed: `PostMessageTransport` checks `event.source` and posts with `"*"`, `AppBridge` accepts a `null` client, and `onopenlink` handles `ui/open-link` | https://github.com/modelcontextprotocol/ext-apps/blob/main/src/message-transport.ts; src/app-bridge.ts |
| 36 | The board page and the view speak "the MCP Apps view protocol" | AD-8 | **contradicted** as conformance. The spec says a host that is a web page "MUST wrap the View … through an intermediate Sandbox proxy" on a different origin | https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx (Sandbox proxy) |
| 37 | An iframe built from `srcdoc` has an opaque origin | AD-8 | **contradicted** as worded. An `about:srcdoc` document takes its initiator's origin; only `sandbox` without `allow-same-origin` makes it opaque | https://html.spec.whatwg.org/multipage/browsing-the-web.html; https://html.spec.whatwg.org/multipage/browsers.html |
| 38 | The view's CSP is the one listed in AD-8 | AD-8 | **contradicted** in part. For `about:srcdoc`, the policy container is "a clone of parentPolicyContainer", so the board page's CSP applies inside the view too | https://html.spec.whatwg.org/multipage/browsers.html (policy containers) |
| 39 | `'wasm-unsafe-eval'` allows WebAssembly compilation without `'unsafe-eval'` | AD-8, AD-13 | confirmed: Chrome 97, Firefox 102, Safari 16 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy; mdn/browser-compat-data |
| 40 | Styles are allowed only by hash | AD-8 | confirmed. This also blocks inline `style` attributes and injected `<style>` elements; only direct `element.style.x` writes still work | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src |
| 41 | Every board request carries `Origin` = `http://` + `Host` | AD-11 | **contradicted**. Browsers add `Origin` to same-origin requests "except for GET or HEAD", and not to navigations | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin |
| 42 | W3C Web Annotation selectors and `xywh=percent:` | AD-7 | confirmed (Web Annotation Data Model Rec 2017-02-23; Media Fragments 1.0 Rec 2012-09-25, `FragmentSelector` `conformsTo` media-frags) | https://www.w3.org/TR/annotation-model/; https://www.w3.org/TR/media-frags/ |
| 43 | Bun 1.4.4 is `latest` (2026-10-22); `--compile` targets darwin x64/arm64 and linux x64/arm64 for glibc and musl | AD-19, Stack | confirmed | npm; https://bun.com/docs/bundler/executables |
| 44 | JavaScriptCore (LGPL-2), unmodified, is the only licence exception the executable needs | AD-19, Deferred | **contradicted** in part. Bun links "the patched version of WebKit" (oven-sh/WebKit), and also statically links tinycc (LGPL v2.1) | https://github.com/oven-sh/bun/blob/main/LICENSE.md |
| 45 | TypeScript 7.0.2 | Stack | confirmed (`latest` since 2026-07-08). It ships no compiler API ("does not ship with an API"; a new one is expected in 7.1). The package's `.` export is only `lib/version.cjs` | npm; https://devblogs.microsoft.com/typescript/?p=5246 |
| 46 | React 19.3.1 | Stack | confirmed (2026-10-14) | npm |
| 47 | Node 24 is in maintenance LTS and Node 26 is LTS | Stack, AD-19 | confirmed. Node 24 has been in maintenance since 2026-10-20 (EOL 2028-04-30); Node 26 becomes Active LTS on **2026-10-28** | https://github.com/nodejs/Release/blob/main/schedule.json |
| 48 | `@ironcalc/wasm` 0.9.1, licensed MIT OR Apache-2.0 | Stack, AD-13 | confirmed | npm |
| 49 | IronCalc runs under AD-8's CSP and meets AD-13's determinism rule | AD-13, Deferred | **unverified**. The `Model` constructor takes `locale`, `timezone` and `language_id`, and timezones are resolved with the host's `Intl`. The default `init` fetches `wasm_bg.wasm` through `new URL(…, import.meta.url)`, which `connect-src 'none'` blocks; `initSync` exists | `@ironcalc/wasm@0.9.1` tarball (`wasm.d.ts`, `wasm.js`, snippets) |
| 50 | `@json-render/mcp` pins SDK v1 and ext-apps v1 | Deferred | confirmed (`^1.27.1`, `^1.2.0`) | npm |
| 51 | `MCP_TIMEOUT` (server start) is 30 s | Deferred (packaging) | confirmed | env-vars |
| 52 | Agent Skills limits: `name` at most 64, `description` at most 1,024 | AD-18 | confirmed by today's research, not re-fetched | research-cc-delivery §13 (agentskills.io) |

## Findings

### High

**H1. AD-11's Origin rule would refuse the board page itself** (claim 41, contradicted).
- Browsers send no `Origin` on top-level navigations or on same-origin GET/HEAD subresource loads. As written, the user's own load of `http://127.0.0.1:<port>/b/<ask-id>?t=…` would be refused, and so would its assets and the source-view tab.
- Separately, `Referrer-Policy: no-referrer` turns `Origin` into `null` for non-CORS form posts.
- **Fix (reword AD-11, Credentials):**
  - When `Origin` is present, it must equal `http://` + `Host`.
  - WebSocket upgrades and every non-GET/HEAD request must carry a matching `Origin`.
  - GET/HEAD without `Origin` are accepted only with the board token and a loopback `Host`.
  - The page sends mutations only through `fetch` or WebSocket, never form posts.
  - Add a browser test in CI that loads a board cold, reloads it, and opens a source view.

**H2. AD-8's isolation rests on an attribute the AD doesn't name, and ignores CSP inheritance** (claims 37 and 38, contradicted).
- An `about:srcdoc` iframe takes the board page's origin. The opaque origin, and with it "the view makes no request to the session process", comes only from `sandbox` without `allow-same-origin`. Without that attribute, the view would share an origin with the page that holds the board token.
- A srcdoc document also inherits a clone of the board page's policy container. So the board page's own CSP applies inside the view in addition to the view's meta CSP, and it must admit the view bundle's script and style hashes, or the view won't run.
- **Fix (reword AD-8, Sandbox):**
  - "The iframe carries exactly `sandbox="allow-scripts"`: no `allow-same-origin`, `allow-popups`, `allow-top-navigation*`, `allow-forms` or `allow-modals`."
  - "The board page's CSP admits the view bundle's hashes, and the view's own CSP is delivered as a meta tag in the srcdoc. Both policies apply."
  - Add a browser test that asserts `self.origin === "null"` inside the view and that `fetch` to the session process fails.

**H3. AD-2's "only runtime for that session" may not hold at connect time** (claim 32, unverified, load-bearing).
- SDK v2's stdio client probes the protocol revision on a short-lived sibling process started from the same command and environment, then reaps it. Claude Code's v2 runtime is built on that SDK and probes stdio servers.
- If AskBoard binds its port, writes the session file (keyed by the same `CLAUDE_CODE_SESSION_ID`), opens the browser or runs the launcher's download at start-up, the sibling does it too. It then dies and leaves a stale session file or a half-written executable, and hooks and mod silently fall back to pull.
- **Fix:**
  - Add to AD-2: "The session process has no side effects (port, session file, notifier, launcher download) until it receives its first request other than `server/discover`."
  - Add to the packaging spike: "the launcher downloads to a temporary name and renames it into place, under a lock."
  - Add to the mod delivery spike: "count AskBoard processes started per session on the declared minimum and on `latest`, with default negotiation."

### Medium

**M1. AD-18 "revision 2026-07-28 only" drops supported setups** (claim 31, contradicted).
- SDK v2's `serveStdio` serves 2025 openings by default. Refusing them (`legacy: 'reject'`) breaks AskBoard for anyone who sets `MCP_PROTOCOL_NEGOTIATION=legacy`, which the docs give as the workaround that lets custom channel servers register, or `MCP_SDK_GENERATION=v1`.
- **Fix:**
  - Reword to "targets 2026-07-28 through SDK v2 and keeps the SDK's default 2025 serving". Alternatively, keep the refusal and make it a stated product limit with a stderr message naming the variable.
  - Add a CI run with `MCP_PROTOCOL_NEGOTIATION=legacy`.

**M2. AD-18 refuses asks below a minimum Claude Code version, but names no trustworthy source for that version** (claim 30, unverified).
- On 2026-07-28, `io.modelcontextprotocol/clientInfo` is optional, and the spec says servers "SHOULD NOT use it to change their behavior". No environment variable carries the version to a stdio server or a hook. The mod has `$.session.version`, but only when the mod runs.
- **Fix:** Name the source in AD-18: `clientInfo.version` when present, else the mod's report through the local API, else "unknown, allowed with a warning". Alternatively, move the per-ask refusal to Deferred and enforce the minimum at install time (plugin docs and setup check).

**M3. The provisional minimum breaks AD-18's own rule today, and AD-10 depends on it** (claims 2 and 4).
- 2.1.311 is above `stable` (2.1.308). On releases before 2.1.311, `SubagentStop` ran "about twice a minute" for each running subagent. AD-10's guard would then block working subagents repeatedly and use up the continuation cap.
- **Fix:**
  - State in Stack/AD-18 that release waits for `stable` to reach 2.1.311, or that the guard tolerates the old firing pattern.
  - Add 2.1.308 to the CI matrix to see the difference.

**M4. The mod transport has three undocumented links** (claims 12, 13 and 14, unverified).
- (a) The hook's `agent_id` and the id that `$.session.send` needs share one identifier space.
- (b) `$.http.fetch` reaches `http://127.0.0.1`. It is refused outright where the organization's policy disallows WebFetch.
- (c) `$.http.fetch` sends no `Origin`, which AD-11's local API would otherwise refuse.
- **Fix:** Add (a) to (c) as explicit exit criteria of the mod delivery spike. Name the fallback channel in AD-5 for when `$.http.fetch` is refused, for example `$.process.run` of the AskBoard executable as a client. As a cross-check for (a), the mod can read `e.agentId` on `tool.check` (2.1.290+).

**M5. The Deferred "session file key" can be closed now, with one caveat** (claim 21).
- `CLAUDE_CODE_SESSION_ID` is set for stdio MCP servers and hook commands, and the mod has `$.session.id`.
- The docs warn that the MCP server "retains the ID it was spawned with" while hooks get the new ID after `/clear`, and that `--continue` may hand the server the startup ID.
- **Fix:** Move the key into AD-5/AD-11 ("session file named by `CLAUDE_CODE_SESSION_ID`"). Keep in the spike: behaviour after `/clear`, `--continue` and `/resume`, and how hooks find the process when the IDs differ.

**M6. AD-19 and the Deferred push row still hedge on something the docs settle** (claim 16).
- "A mod is a plugin". One `hooks/hooks.json` declares the hooks module (`modules`) and the settings hooks (`hooks`). Mods are on by default (terminal 2.1.287+), and `disableAllHooks`, `allowManagedModsOnly` or `allowManagedHooksOnly` stop only the mod, while the plugin's MCP server, skills and agents load.
- **Fix:**
  - Reword AD-19: "The plugin carries the mod as its hooks module, declared in `hooks/hooks.json` next to the settings hooks."
  - Drop "installing the mod is part of setup".
  - Trim the Deferred row to behaviour criteria only.

**M7. AD-19's licence exception is incomplete** (claim 44, contradicted in part).
- Bun links a *patched* WebKit/JavaScriptCore, with source at `github.com/oven-sh/WebKit`, pinned by `WEBKIT_VERSION`. It also statically links tinycc (LGPL v2.1).
- **Fix:**
  - Name both LGPL components in the exception, or show that tinycc is absent from `bun build --compile` output.
  - Link the oven-sh/WebKit commit pinned by Bun 1.4.4, plus Bun's relink steps.
  - Close the Deferred item "JavaScriptCore confirmed unmodified upstream or its modifications' source located" (answer: modified, source located).
  - Keep the PRD change for the licence policy.

**M8. AD-8 calls the view channel "the MCP Apps view protocol", but AskBoard isn't a conforming MCP Apps host** (claims 35 and 36).
- The spec requires a web-page host to put a separate-origin sandbox proxy (`allow-scripts allow-same-origin`) between itself and the view. AskBoard uses one opaque-origin srcdoc iframe instead.
- The ext-apps code works this way: `event.source` checks, `"*"` target, `AppBridge(null, …)`, `onopenlink`.
- **Fix:** Reword AD-8: "uses the ext-apps 2.x message set and its `App` and `AppBridge` classes. The board page is not an MCP Apps host and implements no sandbox proxy." In the Deferred row "MCP Apps rendering inside Claude hosts", note that such a surface would need the proxy.

**M9. The formula spike omits checks that the IronCalc package shows are needed** (claim 49, unverified).
- The default loader fetches the `.wasm` file, which AD-8's `connect-src 'none'` and a `file://` Snapshot block. So IronCalc must be instantiated with `initSync` from inlined bytes, and `'wasm-unsafe-eval'` is then required, not optional.
- `locale` and `timezone` are constructor inputs, and timezone resolution uses the host `Intl`, which can differ between Bun's JavaScriptCore and the browsers.
- The research's "AskBoard IDs vs Excel name rules" check is also missing.
- **Fix:** Add to the Deferred formula spike:
  - "instantiate with `initSync` from inlined bytes under AD-8's CSP";
  - "pin locale and `UTC`, and compare results in Bun and in three browsers";
  - "map `[item-id.field]` (hyphens) to defined names".

**M10. AD-8's hash-only styles will block common diagram and widget output** (claim 40).
- Inline `style` attributes and injected `<style>` elements are blocked. That covers Mermaid and PlantUML SVG inserted as markup, and CSS-in-JS libraries.
- **Fix:**
  - Add "renders under AD-8's CSP with no `unsafe-inline` or `unsafe-hashes`" to the renderer spike and to the UX component adoption checks.
  - Name the escape route: render diagram SVG as `<img src="blob:…">`, which `img-src blob:` allows and whose internal styles the page CSP does not govern.

### Low

**L1. AD-6 annotations.**
- "Marked neither" leaves `update` and `snapshot` with the spec defaults `destructiveHint: true` and `openWorldHint: true`. Set `openWorldHint: false` on all five tools, and `destructiveHint: false` on `snapshot` (it never overwrites).
- `collect` acknowledges through its cursor, and Claude Code runs read-only calls in parallel. Make acknowledgement monotonic (highest cursor wins), or drop `readOnlyHint` from `collect`.
- `idempotentHint` on `ask` has no effect over stdio in Claude Code, which repeats calls only to HTTP servers and connectors. Keep it, but don't rely on it.

**L2. AD-6's schema-shape rules rest on API error reports, not the official reference** (claim 28). Keep the CI checks, and add one live conformance call per supported model that loads the five tool definitions.

**L3. AD-12's "when `CLAUDE_PROJECT_DIR` is missing"** applies only outside Claude Code 2.1.139+, which sets it in every stdio server's environment (claim 20). Keep the `env` pass-through, and reword the fallback as "a host that does not set it".

**L4. TypeScript 7.0.2 ships no compiler API** (claim 45). Anything that imports `typescript` breaks under it: typescript-eslint, declaration bundlers, and some schema-to-type generators. Add `@typescript/typescript6`, which re-exports the 6.0 API, as an npm alias for those tools. Otherwise, state in Stack that no tool needs the API.

**L5. Node: the CI fallback targets 24, which entered maintenance on 2026-10-20** (claim 47). Node 26 becomes Active LTS tomorrow. Either run the fallback CI on 26 as well, or move it to 26 and keep 24 until its 2028-04-30 EOL.

**L6. AD-17 benchmark under `claude -p`** (claims 17 and 18).
- The mod's `$.prompt.submit` can keep a `-p` run going indefinitely, so the runner must pass `--max-turns`.
- Mod calls are refused after an interrupt until the next input (2.1.304+).
- Managed `disableSideloadFlags` rejects `--plugin-dir`.
- Fix: state all three in AD-17's setup.

**L7. Subagent-specific cases the spine assumes but the docs don't state** (claims 6 and 7):
- hook `cwd` for an `isolation: worktree` subagent;
- a `PostToolUse` `systemMessage` from a subagent's call reaching the user.

The second is already a spike criterion. Add the first.

**L8. On native Windows the launcher can only print its WSL message if the `command` Claude Code spawns runs there.** A POSIX script won't. This is unverified; add it to the packaging spike, which already covers WSL.

## Confirmed without findings

The following load-bearing claims hold as written:
- the CLI version figures (`latest` 2.1.311, `stable` 2.1.308);
- the mod APIs for push and polling;
- the `PreToolUse` input fields AD-5 records;
- `SubagentStop` delivery and its cap;
- the `AskUserQuestion` hook controls;
- `--plugin-dir`;
- plugin tool naming;
- the MCP timeout and result-size figures;
- the 4,096 and 128 character limits;
- MCP 2026-07-28 and its default JSON Schema 2020-12 dialect;
- SDK v2 2.4.0, ext-apps 2.0.4, React 19.3.1, Bun 1.4.4 with its targets, IronCalc 0.9.1, json-render's SDK v1 pin;
- `'wasm-unsafe-eval'` support;
- the W3C selector model.
