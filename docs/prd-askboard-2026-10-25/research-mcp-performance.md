---
title: "Research: harness-MCP interaction performance for AskBoard (contract design, async patterns, measurement, cost)"
source: targeted web research on primary sources (MCP spec and extension docs, Claude Code docs and CHANGELOG, Claude API docs and pricing, Anthropic engineering posts, vendor docs, arXiv abstracts), npm registry release dates, plus one local analysis of Claude Code transcripts on the product owner's machine
checked: 2026-10-25
scope: "Claude Code 2.1.310 (npm `latest`, released 2026-10-23; `stable` channel is 2.1.308, released 2026-10-22). MCP protocol revision 2026-07-28 (current). Claude API list prices as published on 2026-10-25."
extends: extract-research-visual-companion.md (CC 2.1.308 baseline of 2026-10-22), extract-video-harness-mcp-performance.md
note: "Marking: (v) checked against a primary source on 2026-10-25; (observed) measured locally from transcripts, not a documented contract; (secondary) blog, listing, search summary or third-party write-up; UNVERIFIED not confirmed; (inference) the researcher's reasoning. Research only: no PRD content."
---

# AskBoard: harness-MCP interaction performance (checked 2026-10-25)

**Goal.** Ground the PRD's performance KPIs: (K1) agent output tokens per question, (K2) agent thinking tokens per question, (K3) agent-side time to put a question up (from the agent deciding to ask until the question is rendered for the user), and an estimated cost for 100 questions.

**Method.** Primary documents were fetched as Markdown (`code.claude.com/docs/en/*.md`, `modelcontextprotocol.io/*.md`, `platform.claude.com/docs/en/*.md`) and searched locally. Claude Code release dates come from the npm registry. Claude Code behaviour comes from its docs and CHANGELOG at 2.1.310. One baseline was measured locally: 526 AskUserQuestion calls and 32 freehand `Write *.html` calls in this machine's Claude Code transcripts (2026-09-24 to 2026-10-25, CC 2.1.281 to 2.1.310, almost all Opus 5.5). It is a convenience sample, reported only as aggregates (§5.5).

**Sources consulted (all checked 2026-10-25).**

- Claude Code docs: MCP https://code.claude.com/docs/en/mcp, monitoring https://code.claude.com/docs/en/monitoring-usage, hooks https://code.claude.com/docs/en/hooks, headless https://code.claude.com/docs/en/headless, CLI reference https://code.claude.com/docs/en/cli-reference, env vars https://code.claude.com/docs/en/env-vars, prompt caching https://code.claude.com/docs/en/prompt-caching, model config https://code.claude.com/docs/en/model-config, tools reference https://code.claude.com/docs/en/tools-reference, subagents https://code.claude.com/docs/en/sub-agents, channels reference https://code.claude.com/docs/en/channels-reference, Agent SDK TypeScript https://code.claude.com/docs/en/agent-sdk/typescript, CHANGELOG https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md, npm https://www.npmjs.com/package/@anthropic-ai/claude-code
- MCP: versioning https://modelcontextprotocol.io/specification/versioning, 2026-07-28 changelog https://modelcontextprotocol.io/specification/2026-07-28/changelog, tools https://modelcontextprotocol.io/specification/2026-07-28/server/tools, elicitation https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation, MRTR https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr, progress https://modelcontextprotocol.io/specification/2026-07-28/basic/utilities/progress, server/discover https://modelcontextprotocol.io/specification/2026-07-28/server/discover, Tasks extension https://modelcontextprotocol.io/extensions/tasks/overview, MCP Apps https://modelcontextprotocol.io/extensions/apps/overview, client matrix https://modelcontextprotocol.io/extensions/client-matrix, ext-apps https://github.com/modelcontextprotocol/ext-apps
- Claude API docs: pricing https://platform.claude.com/docs/en/about-claude/pricing, tool search https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool, extended thinking https://platform.claude.com/docs/en/build-with-claude/extended-thinking, thinking cost https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost
- Anthropic engineering: https://www.anthropic.com/engineering/writing-tools-for-agents (2025-09-11), https://www.anthropic.com/engineering/code-execution-with-mcp (2025-11-04), https://www.anthropic.com/engineering/advanced-tool-use (2025-11-24)
- Other vendors and studies: OpenAI https://developers.openai.com/docs/guides/function-calling, Google https://ai.google.dev/gemini-api/docs/function-calling, Cloudflare https://blog.cloudflare.com/code-mode-mcp/, Microsoft Research https://www.microsoft.com/en-us/research/blog/tool-space-interference-in-the-mcp-era-designing-for-agent-compatibility-at-scale/, arXiv 2602.14878, 2508.20453 (MCP-Bench), 2509.24002 (MCPMark), 2508.14704 (MCP-Universe), video benchmark repo https://github.com/leex279/agent-html-kit

## 0. Key findings

1. **On today's defaults, output and thinking tokens drive both cost and K3.** Opus 5.5 is Claude Code's default model, at `medium` effort (v). It bills output at 5x input ($20 vs $4 per MTok) and reads cache at 0.05x ($0.20 per MTok) (v). Locally, the time to emit a tool call grows by about 5.6 s per 1,000 output tokens on top of a fixed ~7 s (observed, rough fit). Payload size (K1+K2) is the main lever on cost and on K3. Input-side overhead (tool definitions, answers) is cheap once cached.
2. **A data-only contract is the decisive design choice.** Locally, a freehand HTML page costs a mean of 16,254 output tokens (3,883 of them thinking) and takes about 111 s. An AskUserQuestion costs a mean of 967 output tokens per question (518 thinking) and takes about 10–12 s per call (observed). The video's kit made a rich board in 615 tokens and 5 s, against 16,987 tokens and 137 s freehand (v, repo). On Opus 5.5 the worked estimate for 100 questions is $5.0 for a widget contract, $58.6 for freehand HTML and $3.5 for plain AskUserQuestion (§6).
3. **Claude Code defers MCP tools by default.** It loads only tool names and server instructions until a ToolSearch call loads a definition (v, 2.1.310). Server authors can force a tool upfront with `_meta["anthropic/alwaysLoad"]: true` (v). Claude Code cuts upfront descriptions and server instructions at 4,096 characters and deferred ones at 16,384 (v). A deferred ask tool pays an extra search step the first time it is used in a session (inference from v).
4. **Result limits are hard edges of the contract.** Claude Code warns above 10,000 tokens, caps results at 25,000 tokens (`MAX_MCP_OUTPUT_TOKENS`), and moves text results over 50,000 characters to a file (raise per tool with `_meta["anthropic/maxResultSizeChars"]`, ceiling 500,000). It keeps only the first and last 5,000 characters of error text over ~11,000 characters, and fails HTTP responses over 16 MiB (v).
5. **MCP changed under AskBoard's feet: revision 2026-07-28 is current.** It is stateless (no `initialize`), and elicitation now runs through Multi Round-Trip Requests (`input_required` results). Tasks moved into an official extension, and SSE resumability was removed (v). Claude Code speaks 2026-07-28 through its v2 runtime. Claude Code MCP Tasks are a **public beta from 2.1.304 (2026-10-19)**: main conversation only (not subagents), CLI, Agent SDK and GitHub Actions only (not the desktop app or VS Code) (v).
6. **Blocking asks work, within known timers.** A main-conversation call moves to the background after 2 min. Calls from subagents never move to the background. The idle timeout is 5 min for HTTP and 30 min for stdio, reset by any response or progress notification. HTTP servers must also start responding within max(60 s, tool timeout, `MCP_TIMEOUT`) (v).
7. **MCP Apps: no change since 2026-10-22.** The Claude Code CLI still renders no MCP Apps. Since 2.1.281 it hides `ui://` resources from resource lists. Neither 2.1.309 (2026-10-22) nor 2.1.310 (2026-10-23) has an MCP Apps entry (v). The Claude apps (web, Desktop) support MCP Apps (spec stable 2026-01-26) (v).
8. **K1, K2 and K3 are measurable today without patching Claude Code.** Transcripts and API usage expose `output_tokens_details.thinking_tokens` (v, observed). OTel gives per-request tokens, `ttft_ms` and tool spans; `tool_result` events carry `request_id` from 2.1.310 (v). Hooks give `tool_use_id` and timestamps (v). `claude -p --output-format json` and the Agent SDK give run receipts, the SDK with `thinkingTokens` (v). K3's end point (rendered) must come from AskBoard itself.

## 1. Contract design choices that move agent tokens and latency (RQ1)

### 1.1 Where a question costs tokens (inference, built from §5–§6 facts)

| Cost element | Paid when | Price class (Opus 5.5) | Contract lever |
|---|---|---|---|
| Thinking before the call (K2) | once, at generation | output $20/MTok | Make the decision cheap: no layout or derived values for the agent to work out; the effort level |
| Preamble text plus tool-call arguments (K1) | once, at generation | output $20/MTok | Tags plus data only; compact field names; batch questions |
| Tool definitions plus server instructions loaded upfront | every API request of the session | cache read $0.20/MTok (write $5 once) | Keep the upfront surface small, defer the rest, keep it stable |
| Question payload, answer payload, prior thinking blocks | written to cache once, then re-read by every later request | write $5, read $0.20 per MTok | Small typed answers; large artefacts on demand |
| Cache miss when the user answers after the TTL | next request after the answer | whole prefix rewritten at $5/MTok | Keep-alive or 1-hour TTL; non-blocking flow (architecture) |

### 1.2 Number and granularity of tools

- **Anthropic** (2025-09-11): "More tools don't always lead to better outcomes". Build a few thoughtful tools for high-impact workflows and consolidate multi-step flows; their example merges `list_users`, `list_events` and `create_event` into `schedule_event` (v).
- **Claude API tool search docs:** Claude's tool-selection accuracy "degrades once you exceed 30–50 available tools". Tool search is not worth it below 10 tools or for definitions under 10k tokens (v).
- **OpenAI:** "Aim for fewer than 20 functions available at the start of a turn" (a soft suggestion). "Combine functions that are always called in sequence" (v, guide undated, checked 2026-10-25).
- **Google Gemini:** "Keep active set to 10-20 tools maximum" (v, page last updated 2026-09-23).
- **Microsoft Research** (2025-09-11): of 1,470 MCP servers, most expose four tools or fewer. Large tool spaces "lower performance by up to 85% for some models", a figure cited from other studies (v).

### 1.3 Size of names, descriptions and schemas in context (Claude Code 2.1.310, v)

- **Description cuts.** Server instructions and the description of a tool loaded upfront are cut at **4,096 characters**. A description loaded through tool search is cut at **16,384**. Tool search matches only within the shorter limit, so put search words and critical details first. Before 2.1.296 the short limit was 2,048. `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` (2.1.280+) overrides both limits.
- **Name length.** The full tool name `mcp__<server>__<tool>` must be **≤128 characters**, or Claude Code drops the tool. The MCP spec also says names SHOULD be 1–128 characters (v).
- **Schema checks.** Top-level property names must be 1–64 characters of `[A-Za-z0-9_.-]`. The schema must validate against JSON Schema 2020-12. Claude Code excludes a tool that fails either check rather than letting it break every request (2.1.216+).
- **Root combinators.** A root-level `anyOf`, `oneOf` or `allOf` is flattened. Claude Code adds a sentence to the description, so the definition costs more tokens, and `required` stops being enforced by the schema.
- **Fixed overhead.** The API's tool-use system prompt costs **286 tokens** on Opus 5.5 and Sonnet 5.5 (`tool_choice` auto). Claude Code always pays it, so AskBoard adds nothing here (v, pricing page).
- **Tokenizer.** Claude 4.7 and later models produce about 30% more tokens for the same text than 4.6 and earlier (v, pricing page). Token budgets must be measured per model family.
- **Description length trade-off.** "MCP Tool Descriptions Are Smelly" (arXiv 2602.14878, Feb 2026): 97.1% of 856 tools have at least one smell. Augmenting descriptions raised median task success by 5.85 points, but execution steps rose by 67.46% (secondary: arXiv abstract via search summary). Longer is not free.
- **Tool use examples** raised accuracy on complex parameters from 72% to 90% (v, Anthropic 2025-11-24). Whether an MCP server can supply `input_examples` through Claude Code is UNVERIFIED.

### 1.4 Tool search and deferred loading in Claude Code (v, 2.1.310)

- **Default.** Tool search is on by default: "Only tool names and server instructions load at session start". Leaving `ENABLE_TOOL_SEARCH` unset (or `true`) defers all MCP tools. `auto` loads them upfront while their definitions total under 10% of the context window; `auto:N` sets a custom percentage; `false` loads all upfront.
- **Where it is off.** It is off with `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`, in HIPAA sessions, on Foundry deployments hosted on Azure, and on models earlier than Opus 4, Sonnet 4 and Haiku 4.5. Behind an `ANTHROPIC_BASE_URL` gateway it is on by default since 2.1.304. Since 2.1.305 a request rejected with 400/422 is retried without it.
- **Server-author control.** `_meta["anthropic/alwaysLoad"]: true` on a tool loads it upfront. A user's per-server `"alwaysLoad": true` exempts a whole server from deferral, and `false` keeps all of it deferred (2.1.287+).
- **Caching.** With tool search active, "the request's tool definitions don't change and the cached prefix survives". Without tool search, a server connecting or a `list_changed` that adds tools invalidates the cache (prompt-caching doc).
- **API mechanics.** A search returns up to 5 `tool_reference` blocks by default, and discovered definitions are appended inline, so the cache is preserved. Anthropic's tip: "Keep your 3–5 most frequently used tools non-deferred". The search step is not metered separately, but the definitions it loads count as input. Anthropic notes the search step "increases latency" (v, 2025-11-24).
- **Effect on AskBoard (inference).** A deferred ask tool costs one extra search step, an extra inference pass, the first time it is used in each session. That raises K3 and K1 for the first question. An `alwaysLoad` ask tool costs its definition on every request instead, cheaply once cached (§6).

### 1.5 Server instructions

- In Claude Code, server instructions load at session start with the tool names. Claude Code advises using them to say what tasks the tools handle, when Claude should search for them and the key capabilities, within 4,096 characters (v).
- In MCP 2026-07-28, `instructions` is returned by the mandatory `server/discover` RPC, because `initialize` was removed (v).

### 1.6 outputSchema and structuredContent

- **Spec (2026-07-28).** `structuredContent` may be any JSON value, and `inputSchema` and `outputSchema` accept any JSON Schema 2020-12 keyword (SEP-2106). "For backwards compatibility, a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block" (v).
- **Claude Code.** It has supported `structuredContent` since 2.0.21 (2025-10-16). 2.1.128 (2026-05-04) fixed images being dropped when a result has both structured content and content blocks (v).
- **Gap.** Which of the two representations the model reads when a result has both is UNVERIFIED. A third-party issue report says Claude Code displays `structuredContent` instead of `content[0].text`, but that concerns display (secondary). If both reach the model, the answer payload costs twice. Measure it with `OTEL_LOG_RAW_API_BODIES=file:<dir>` (§5).

### 1.7 Inline results, resource links and size limits

- **Claude Code limits (v).**
  - A warning shows above **10,000** tokens. The default cap is **25,000** tokens (`MAX_MCP_OUTPUT_TOKENS`); over the cap, a result is saved to a file under the session's `tool-results` directory and replaced by its path.
  - Text results over **50,000 characters** are saved to a file whatever their token count. A tool can raise this with `_meta["anthropic/maxResultSizeChars"]`, up to **500,000** characters.
  - Error text over ~11,000 characters keeps its first and last 5,000.
  - An HTTP or SSE response over **16 MiB** fails, and a WebSocket message over 16 MiB closes the connection.
  - Image results are shown inline and saved to a file (2.1.283+).
- **Resource links.** The spec lets tools return `resource_link` blocks, URIs the client may fetch (v). Claude Code exposes resources through `@` mentions and auto-provided list and read tools (v). How Claude Code shows a `resource_link` inside a tool result to the model is UNVERIFIED.
- **Response sizes in the wild.** Across 1,470 servers, the median tool response was 98 tokens, the mean 4,431 and the maximum 557,766; 16 tools produce more than 128,000 tokens. Long responses "can degrade performance up to 91%", a figure cited from another study (v, Microsoft Research).

### 1.8 Pagination and response shaping

- The spec paginates `*/list` with cursors. Since 2026-07-28, list results carry `ttlMs` and `cacheScope` (`CacheableResult`, SEP-2549) (v).
- Anthropic recommends pagination, range selection, filtering and truncation with sensible defaults. Its `response_format` example returned 206 tokens in "detailed" mode and 72 in "concise" mode, about a third (v, 2025-09-11).

### 1.9 Batching several questions in one call

- AskUserQuestion takes 1–4 questions with 2–4 options each (2026-10-22 baseline). Elicitation form mode takes only a flat object of primitives: string, number, boolean, single-select enum, multi-select enum array. Nested objects and arrays of objects are "intentionally not supported" (v, 2026-07-28).
- An MCP tool's own schema has no such limit. Claude Code runs calls to `readOnlyHint` tools in parallel with other read-only calls (v).
- **Local evidence (observed, uncontrolled).** Batching cuts output per question, while each call takes longer:

| Questions per AskUserQuestion call | Calls | Output per question (median) | Thinking per question (median) | Call latency (median) |
|---|---|---|---|---|
| 1 | 263 | 1,023 | 527 | 10.0 s |
| 2 | 109 | 778 | 332 | 13.5 s |
| 3 | 70 | 646 | 261 | 18.2 s |
| 4 | 84 | 628 | 300 | 17.3 s |

- Anthropic's Programmatic Tool Calling cut tokens by 37% (43,588 to 27,297). Running 20+ calls in one code block "eliminates 19+ inference passes" (v, 2025-11-24). The same logic applies to grouping questions into one call (inference).

### 1.10 Error design that avoids retries

- **Spec.** Protocol errors are separate from tool execution errors. Execution errors are returned with `isError: true` and "actionable feedback that language models can use to self-correct". Clients SHOULD pass them to the model (v).
- **Anthropic** advises specific, actionable error messages, optionally with correctly formatted input examples, not "opaque error codes or tracebacks" (v).
- **Claude Code (v).** It repeats a call that was pending when a connection closed once, on a new connection, for HTTP and connector servers, but only for tools marked `idempotentHint` or `readOnlyHint`. Other calls can fail with "connection closed before the tool call was answered". 2.1.310 changed the timeout error for an unanswered elicitation in non-interactive sessions to tell Claude "no answer came and not to repeat the call". So an unanswered question does lead models to retry.
- **Silent errors.** Of 5,983 tool results without an error flag, GPT-4.1 judged 3,536 to contain errors in their content (v, Microsoft Research). A failure should set `isError` rather than read as a successful answer.

### 1.11 Prompt-cache stability

- MCP 2026-07-28: servers SHOULD return tools in a deterministic order, which "improves LLM prompt cache hit rates" (v).
- Claude Code puts tool definitions in the system-prompt layer. A change to the loaded set invalidates the cache unless tool search is active (v).
- **Cache lifetime (v).**
  - A Claude subscription within plan usage gets a **1-hour** TTL for the main conversation. An API key, usage credits or a cloud provider gets **5 minutes**. Subagents get 5 minutes.
  - Overrides: `CLAUDE_CODE_PROMPT_CACHE_TTL`, `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`, `ENABLE_PROMPT_CACHING_1H`, `FORCE_PROMPT_CACHING_5M`.
  - The TTL counts from the start of the request, and a read refreshes it (v, API caching guidance).

## 2. Anthropic guidance and other vendors (RQ2)

| Source (date) | Claim / number | Applies to AskBoard? (inference) |
|---|---|---|
| Anthropic, "Writing effective tools for agents" (2025-09-11) (v) | Few consolidated tools; namespacing; return high-signal fields, not UUIDs; `response_format` concise 72 vs detailed 206 tokens; pagination, filter, truncate; "Claude Code restricts tool responses to 25,000 tokens by default"; actionable errors; strict data models. Eval metrics: accuracy, runtime, number of tool calls, token consumption, tool errors | Yes: a small consolidated surface, typed compact answers, and its eval metrics map onto K1–K3 |
| Anthropic, "Code execution with MCP" (2025-11-04) (v) | One workflow went from 150,000 to 2,000 tokens (98.7%) by presenting tools as code and filtering data in the sandbox; progressive disclosure through `search_tools` with detail levels; needs "a secure execution environment with appropriate sandboxing, resource limits, and monitoring"; no latency figures | Mostly no: AskBoard has few tools and small, human-paced payloads. The analogous lever is moving rendering and derived values into the server |
| Anthropic, "Advanced tool use" (2025-11-24) (v) | Tool search: definitions 77K to 8.7K tokens (85%); MCP-eval accuracy Opus 4 49% to 74%, Opus 4.5 79.5% to 88.1%. Programmatic Tool Calling −37% tokens, removes up to 19 inference passes. Tool use examples 72% to 90%. "Keep your three to five most-used tools always loaded". Each round trip costs "hundreds of milliseconds to seconds" | Yes: keep the ask tool loaded, defer the long tail, batch to save inference passes |
| Claude API tool search docs (checked 2026-10-25) (v) | A ~55k-token multi-server example; ">85 percent" reduction; accuracy degrades past 30–50 tools; up to 5 results per search; 10,000 deferred tools max | Yes, through Claude Code's default deferral |
| OpenAI function-calling guide (undated, checked 2026-10-25) (v) | Fewer than 20 functions at the start of a turn; tool search for large surfaces; definitions billed as input tokens; "We recommend always enabling strict mode"; combine functions always called in sequence | Same direction |
| Google Gemini function calling (updated 2026-09-23) (v) | "Keep active set to 10-20 tools maximum"; strong typing; clear descriptions | Same direction |
| Cloudflare, Code Mode MCP server (2026-02-20) (v) | 2,500+ API endpoints exposed through two tools, `search()` and `execute()`: about 1,000 tokens instead of an estimated 1.17M (99.9%, measured with tiktoken); no latency figures | Shows the ceiling of the "small surface, server-side work" pattern |
| Microsoft Research, tool-space interference (2025-09-11) (v) | 1,470 servers; response tokens median 98, mean 4,431; 775 colliding tool names ("search" on 32 servers). Recommends an "MCP Server card" stating expected tokens generated and expected call latency, plus the models and clients tested | Yes: publish AskBoard's per-widget token and latency figures |
| Video benchmark, agent-html-kit (run 2026-10-12, Opus 5.5, CC 2.1.296) (v, repo) | Freeform HTML vs kit, output tokens: report 7,204 vs 726, diagram 17,314 vs 1,015, board 16,987 vs 615, plan 25,376 vs 8,911; the component list costs about 600 input tokens per call | Direct analogue of AskBoard's widget contract |

## 3. Asynchronous and long-running patterns, and Claude Code support (RQ3)

### 3.1 Spec status: revision 2026-07-28 is current (v)

- **Stateless protocol (SEP-2575).** The `initialize` handshake and `Mcp-Session-Id` are gone. Every request carries its protocol version and client capabilities in `_meta`, and `server/discover` is mandatory.
- **Tasks as an extension (SEP-2663).** Tasks left the core protocol (where they were experimental in 2025-11-25) to become the official extension `io.modelcontextprotocol/tasks`.
  - The client polls with `tasks/get` and sends input with `tasks/update`. Blocking `tasks/result` and `tasks/list` are gone, and servers may return task handles unprompted.
  - Statuses: `working`, `input_required`, `completed`, `failed`, `cancelled`. Optional `notifications/tasks` arrive through `subscriptions/listen`.
  - The extension's own list of fits names "human approvals" and "approval gates, review steps".
- **Multi Round-Trip Requests (SEP-2322)** replace server-initiated requests such as `elicitation/create`. The server returns `resultType: "input_required"` with `inputRequests`, and the client retries the original request with `inputResponses`. Every result now carries `resultType`.
- **Elicitation.** Form mode keeps flat primitive schemas. URL mode exists since 2025-11-25. Revision 2026-07-28 removes `notifications/elicitation/complete` and `elicitationId`; servers correlate retries through `requestState`.
- **Progress.** A `progressToken` in `_meta` enables `notifications/progress` on the response stream of the request it concerns.
- **No resumable streams.** SSE resumability and `Last-Event-ID` were removed: "A broken response stream loses the in-flight request; clients MUST re-issue it". Durability now comes from tasks.
- **Other changes.** `subscriptions/listen` replaces the HTTP GET stream. Roots, Sampling and Logging are deprecated (SEP-2577). `traceparent`, `tracestate` and `baggage` conventions in `_meta` are documented (SEP-414).

### 3.2 Claude Code support (2.1.310; dates are npm release dates) (v)

| Mechanism | Claude Code support | Since | Constraints that matter to AskBoard |
|---|---|---|---|
| Protocol 2026-07-28 | v2 runtime on MCP TS SDK 2.0; asks HTTP, stdio and connector servers whether they support it | v2 runtime with feature flags: 2.1.232 (2026-08-13). Default in other sessions: 2.1.274 (2026-09-16) | `MCP_SDK_GENERATION=v1` or `MCP_PROTOCOL_NEGOTIATION=legacy` forces the old handshake |
| Blocking call plus auto-background | A main-conversation call still running after 2 min becomes a background task; the result arrives as a task notification | (current) | Never backgrounds calls from **subagents**, IDE servers or non-interactive runs (unless `CLAUDE_AUTO_BACKGROUND_TASKS=1`), nor while an elicitation dialog is open. Threshold: `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`. Does not survive exiting the session |
| Idle and wall-clock timeouts | Idle abort after **5 min** (HTTP, SSE, WebSocket, connector) or **30 min** (stdio) without a response or progress notification; per-server `timeout` is a hard wall clock that progress does not extend; `MCP_TOOL_TIMEOUT` defaults to about 28 h | (current) | **HTTP only:** the first response byte must arrive within max(60 s, tool timeout, `MCP_TIMEOUT`). `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT=0` disables the idle check |
| Progress notifications | Reset the idle timer; the latest progress shows in the `/tasks` entry | (current) | Do not extend the wall clock. Whether progress text reaches the model is UNVERIFIED |
| MCP Tasks extension | **Public beta**; CC polls `tasks/get` every 2,000 ms by default, honouring `pollIntervalMs` clamped to 250–30,000; `input_required` answered through `tasks/update`, at most 16 keys | **2.1.304 (2026-10-19)** | Requires a 2026-07-28 connection and a session that fetches feature flags (so not Bedrock, and not with telemetry off). Only the terminal CLI, Agent SDK and GitHub Actions, **not the desktop app or VS Code**. **Main conversation only, not subagents.** Not in one-shot `claude -p "<prompt>"`. `elicitation/create` inside a task only in interactive terminal sessions. A task on a remote server survives exit and resumes with `--resume` |
| Elicitation, form and URL | Dialog in the terminal; `Elicitation` and `ElicitationResult` hooks can answer or override it | 2.1.76 (2026-03-14); URL mode on 2026-07-28: 2.1.281 (2026-09-23); on 2025-11-25: 2.1.287 (2026-10-01) | The URL is capped at ~8,000 characters (~4,000 if heavily percent-escaped). With `--permission-prompts none`, an elicitation no hook answers is cancelled. Whether calls from subagents get the dialog is UNVERIFIED |
| Channels (server push into the session) | `claude/channel` capability plus `--channels` opt-in; two-way through a reply tool | research preview | Custom channels are not on the allowlist (needs `--dangerously-load-development-channels`); Team and Enterprise must enable them; **not registered on 2026-07-28 connections** |
| `list_changed` | Interactive sessions refetch the list; `-p` and the SDK refresh only tools | (current) | Without tool search, adding tools invalidates the prompt cache (§1.11) |
| Retry after a dropped connection | One repeat, on a new connection, for `idempotentHint` and `readOnlyHint` tools (HTTP, connector) | (current) | Needs server-side deduplication so the same question is not asked twice (inference) |

### 3.3 What this means for an ask (inference)

- **Blocking ask from the main conversation.** It works. After 2 min it moves to the background, and the answer comes back later as a task notification. The server must keep the call alive: stdio within 30 min of silence, HTTP within 5 min and with a first byte within 60 s, both through progress notifications.
- **Blocking ask from a subagent.** It never moves to the background. It blocks that subagent until the answer arrives or the idle timeout fires. MCP Tasks do not help there.
- **MCP Tasks** are the spec-native fit for human approvals, but they are a beta in Claude Code, main conversation only, terminal or SDK only. They cannot be the only path in "any Claude Code project".

## 4. MCP Apps status (RQ4), checked 2026-10-25

- **Spec.** MCP Apps (`io.modelcontextprotocol/ui`, SEP-1865) is stable as of 2026-01-26 (v, ext-apps README). `@modelcontextprotocol/ext-apps` is at 2.0.3, released 2026-09-25 (v, npm). The 1.x and 2.x releases share one wire protocol (v).
- **Hosts.** The MCP docs list Claude (web), Claude Desktop, VS Code GitHub Copilot, Microsoft 365 Copilot, Goose, Postman, MCPJam and Archestra.AI (v). The client matrix adds ChatGPT, Cursor, PostHog Code, fast-agent, MCP Inspector and mcpc, but its check marks did not survive Markdown export, so support per cell is UNVERIFIED. Interactive apps launched in Claude on 2026-01-26 (secondary: The Register).
- **Claude Code CLI, 2.1.310.** It still renders no MCP Apps (v). UI resources (`ui://` URIs or `text/html;profile=mcp-app`) are "pages for a host application to render rather than content for Claude to read". Since 2.1.281 (2026-09-23) they are left out of `@` suggestions and of the resource-list tool; reading one by URI still works. Claude Code is not listed as an MCP Apps host.
- **Changes since 2026-10-22:** none found. The CHANGELOG entries for 2.1.309 (2026-10-22) and 2.1.310 (2026-10-23) contain no MCP Apps item (v).
- **Claude Code desktop app (Code tab).** Its docs do not mention MCP Apps, so whether it renders them is UNVERIFIED. It does not get MCP Tasks (v).

## 5. Measuring K1, K2 and K3 in Claude Code (RQ5)

### 5.1 Data sources

| Source | K1 (output, non-thinking) | K2 (thinking) | K3 (time to question) | Notes |
|---|---|---|---|---|
| **Transcript JSONL** (`~/.claude/projects/<project>/<session>.jsonl`) (observed on 2.1.310; the format is undocumented) | `message.usage.output_tokens − output_tokens_details.thinking_tokens` | `output_tokens_details.thinking_tokens` | Entry `timestamp`s (parent entry → tool_use entry); `thinkingDurationMs` | One API response is stored as one entry per content block, each repeating the same `usage`: **deduplicate by `requestId`**. Entries also record `effort`, `version`, `isSidechain` and cache writes split by TTL (`cache_creation.ephemeral_5m/1h_input_tokens`) |
| **`claude -p --output-format json`** (v) | run total (`usage`) | not split | `duration_ms`, `duration_api_ms` | Gives `total_cost_usd` plus a per-model cost breakdown; one receipt per run, which is how agent-html-kit measured |
| **Agent SDK** `SDKResultMessage` (v) | `modelUsage[model].outputTokens` | `modelUsage[model].thinkingTokens` (SDK ≥0.3.257; already included in `outputTokens`) | `duration_ms`, `duration_api_ms`, `ttft_ms` | Run-level. `thinking_tokens` stream frames from SDK 0.3.260 |
| **OTel metrics** `claude_code.token.usage`, `claude_code.cost.usage` (v) | `type=output` | **not split** | n/a | Attributes `query_source` (main, subagent, auxiliary), `effort`, `mcp_server.name`, `mcp_tool.name`; user MCP names are redacted to "custom" unless `OTEL_LOG_TOOL_DETAILS=1` |
| **OTel events** `api_request`, `tool_result`, `api_response_body` (v) | `api_request.output_tokens` | `api_response_body` with `OTEL_LOG_RAW_API_BODIES=file:<dir>`, which holds the full response including `usage` (thinking content redacted); expected to carry `thinking_tokens` (inference) | `api_request.duration_ms`; `tool_result.duration_ms` | `tool_result.request_id` joins a call to the API response that emitted it (**2.1.310+**). File mode also writes `index.jsonl` linking bodies to transcript messages |
| **OTel traces (beta)** `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` (v) | `llm_request.output_tokens` | not split | `llm_request` `duration_ms`, `ttft_ms`, `first_content_ms`; `tool` span (includes permission wait), `tool.blocked_on_user`, `tool.execution` | **HTTP MCP requests carry a W3C `traceparent` header** (when `ANTHROPIC_BASE_URL` is unset or points at Anthropic), so an HTTP AskBoard server can put its "received" and "rendered" spans in the same trace. The `_meta` `traceparent` route over stdio is UNVERIFIED |
| **Hooks** (v) | n/a | n/a | `PreToolUse` gets `tool_name`, `tool_input`, `tool_use_id`, so it can timestamp dispatch; `PostToolUse.duration_ms` is execution time excluding permission prompts and PreToolUse hooks | For a blocking ask, `PostToolUse.duration_ms` includes the user's answer time, so it is not K3. A `PreToolUse` hook can answer AskUserQuestion (echo `questions`, add `answers`), which makes an AskUserQuestion baseline reproducible in `-p` (needs a permission host) |
| **Token counting API** `/v1/messages/count_tokens` (v, skill doc) | static size of tool definitions and of sample payloads | n/a | n/a | CI-friendly budget checks of the contract; tokenizer per model |

### 5.2 How thinking is billed and reported (v)

- Thinking is billed as output tokens. The full internal reasoning is billed whatever the `display` setting; the visible summary, or nothing at all with `display: "omitted"` (the default on Opus 5.5), does not match the billed count.
- `usage.output_tokens_details.thinking_tokens` reports the billed reasoning tokens and is never more than `output_tokens`. When streaming, it appears only on the final `message_delta`.
- Opus 4.5 and models numbered 4.6 and later keep prior turns' thinking blocks in context and bill them as input.
- Opus 5.5 thinking cannot be disabled; effort is the only control. Its default effort is `medium` in both the API and Claude Code (model-config doc).
- **Rule for K2:** never estimate it from visible thinking text; read `thinking_tokens`.

### 5.3 Measurement pitfalls (inference from §5.1–5.2)

- **Fix the variables.** Pin the model, effort (`--effort`), Claude Code version (the system prompt changes between versions), cache TTL (`CLAUDE_CODE_PROMPT_CACHE_TTL`) and tool-search mode. Run cold (first ask in the session, which includes a ToolSearch) separately from warm.
- **Attribute the right response.** Count only the API response that emits the ask, plus any responses that exist only to prepare it: ToolSearch, writing the HTML file and opening it in arm (b). The preamble text in the same response counts as K1.
- **Watch the tokenizer.** Opus 4.7 and later count about 30% more tokens than 4.6 and earlier, so compare arms only on the same model.
- **Keep the main conversation apart from subagents** (`isSidechain`, `agent_id`, `query_source`), because their timers and cache TTLs differ (§3.2, §1.11).

### 5.4 Existing benchmarks and their methods

- **MCP-Bench** (Accenture and UC Berkeley, arXiv 2508.20453, 2025-08-28). It connects 20 LLMs to 28 live servers with 250 tools. Rule-based checks cover schema compliance and execution success. An LLM judge scores task fulfilment, grounding, tool appropriateness, parameter accuracy, dependency awareness and parallelism/efficiency (secondary: search summaries of the paper and leaderboard).
- **MCPMark** (arXiv 2509.24002, 2025-09-28). 127 tasks, each with a programmatic verification script, run in "a minimal agent framework that operates in a tool-calling loop". It reports pass@1 and pass^4 and averages 16.2 turns and 17.4 tool calls per task (v, abstract).
- **MCP-Universe** (Salesforce, arXiv 2508.14704, 2025-08-20). 11 servers across 6 domains, scored by format, static and dynamic evaluators. It notes that "the number of input tokens increases rapidly with the number of interaction steps" (v, abstract).
- **agent-html-kit** (2026-10-12) (v, repo). 72 runs of Opus 5.5 in CC 2.1.296, 3 runs per cell with the median reported. Each call ran in an empty temp folder with `--setting-sources ""`, no MCP servers and no skills. Tokens come from `claude -p --output-format json` receipts, time is API time, dollars are list prices from the receipts, and input sizes come from token-counting calls.
- **Gap.** None of these measures human-in-the-loop questions: tokens per question or time until the question is rendered. AskBoard needs its own harness (§7).

### 5.5 Local baseline (observed, this machine, 2026-09-24 to 2026-10-25)

Only responses with exactly one tool call are included. Latency runs from the timestamp of the transcript entry that triggered the request to the timestamp of the tool_use entry. Almost every call ran on Opus 5.5, **mostly at `xhigh` effort** (484 of 533 AskUserQuestion entries), not Claude Code's default `medium`. K2 is therefore likely higher here than it would be at the default.

| Metric | AskUserQuestion: per call (n=526) | AskUserQuestion: per question (1,027 questions) | Freehand `Write *.html` (n=32) |
|---|---|---|---|
| Output tokens incl. thinking | median 1,381 (p10 556, p90 3,670) | mean 967, median 840 | mean 16,254, median 15,521 |
| Thinking tokens | median 600 | mean 518, median 425 | mean 3,883, median 576 |
| Non-thinking output | median 679 | mean 450, median 377 | mean 12,371, median 13,086 |
| Tool input size | median 1,255 characters | median 724 characters | median 30,292 characters |
| Time to emit the tool call | median 12.2 s, p90 31.1 s; single-question calls median 10.0 s (n=261) | n/a | median 113 s, mean 111 s |

- **Rough latency model** (OLS over 555 calls, uncontrolled): time to emit a tool call ≈ 6.8 s + 5.6 s per 1,000 output tokens, about 178 tokens/s at the margin.
- Calls with fewer than 50 thinking tokens (n=69) had a median of 596 output tokens and 6.4 s.
- The freehand numbers agree with the video's board: 16,987 tokens, 137 s.

## 6. Prices and the 100-question cost model (RQ6)

### 6.1 Claude API list prices, USD per million tokens (v, pricing page, 2026-10-25)

| Model | Input | 5-min cache write | 1-hour cache write | Cache read | Output |
|---|---|---|---|---|---|
| Opus 5.5 (Claude Code default) | 4.00 | 5.00 | 8.00 | **0.20 (0.05x)** | 20.00 |
| Sonnet 5.5 | 2.00 | 2.50 | 4.00 | **0.10 (0.05x)** | 10.00 |
| Haiku 5.5 (prompts ≤100k tokens) | 0.10 | 0.125 | 0.20 | 0.01 | 0.50 |
| Fable 5.1 | 10.00 | 12.50 | 20.00 | 0.25 (0.025x) | 50.00 |
| Opus 5, 4.8, 4.7, 4.6 | 5.00 | 6.25 | 10.00 | 0.50 | 25.00 |
| Sonnet 5 | 2.00 | 2.50 | 4.00 | 0.20 | 10.00 |
| Sonnet 4.6 | 3.00 | 3.75 | 6.00 | 0.30 | 15.00 |

- **Modifiers.** US-only `inference_geo` costs 1.1x. Fast mode on Opus 5.5 costs $8/$40. The batch discount (50%) does not apply to interactive use. 4.6 and later models (except Haiku 5.5) get the full 1M context at standard prices. Tool search is not metered separately.
- **Subscriptions.** Pro, Max, Team and Enterprise are not billed per token. The figures below are list-price equivalents, which is also how Claude Code computes `total_cost_usd` and the cost metric.

### 6.2 Cost model (inference)

For each question: K1 non-thinking output, K2 thinking, X extra output needed to collect the answer, A answer tokens. For each session: T tool-definition and instruction tokens loaded upfront, N_req main-conversation requests. Prices: P_out output, P_w cache write, P_r cache read.

```
Cost(100 q) = Σ_q [ P_out·(K1+K2+X)                 # generation
                  + P_w·(K1+K2'+X+A)                # new context written to cache once
                  + P_r·R·(K1+K2'+X+A) ]            # re-read by R later requests
            + Σ_sessions [ T·(N_req·P_r + n_w·P_w) ]   # AskBoard surface loaded upfront
            + Σ_q [ 1(wait > TTL) · C_ctx·(P_w − P_r) ] # cache expired while waiting for the user
```

- K2′ is the thinking kept in context. It equals K2 on keep-all models such as Opus 5.5 (an assumption; see §9).
- n_w is the number of cache rewrites per session. C_ctx is the context size when the answer arrives.
- A deferred ask tool sets T ≈ 0 until its first use. It then adds one search step per session, after which its definition is re-read like T.

### 6.3 Worked example: Opus 5.5, API key with the 5-minute TTL

**Common assumptions:**
- 100 questions spread over 10 sessions of 10 questions each.
- N_req = 150 main-conversation requests per session.
- Each question's tokens are re-read by R = 50 later requests.
- One cache write of T per session.

| Parameter | (a) Widget/data contract | (b) Agent writes freehand HTML | (c) Plain AskUserQuestion |
|---|---|---|---|
| K1 (non-thinking output) | 700: kit board 615 (video) plus question text, rounded | 12,400: local mean | 450: local mean per question |
| K2 (thinking) | 520: same as AskUserQuestion, because the contract removes design thinking but not the decision itself | 3,900: local mean | 520: local mean |
| X (answer collection) | 0: answer returned by the call | 300: open the page and ask "done?" | 0 |
| A (answer tokens) | 150: typed JSON | 300: answer read from a file | 60 |
| T (upfront surface) | 1,500: one always-loaded ask tool plus instructions | 0: uses Write and Bash | 0: built in |

Results in USD per 100 questions:

| Component | (a) Widget contract | (b) Freehand HTML | (c) AskUserQuestion |
|---|---|---|---|
| Generation, P_out·(K1+K2+X) | 2.44 | 33.20 | 1.94 |
| Cache write of the new context | 0.69 | 8.45 | 0.52 |
| Re-reads (R=50) | 1.37 | 16.90 | 1.03 |
| Tool-definition overhead | 0.53 | 0.00 | 0.00 |
| **Total, Opus 5.5** | **5.02** (≈$0.050 per question) | **58.55** (≈$0.586) | **3.49** (≈$0.035) |
| **Total, Sonnet 5.5** | 2.51 | 29.28 | 1.74 |
| K3, rough (§5.5 fit, before server and render time) | ≈14 s (video kit: 5 s) | ≈100 s plus answer collection (video: 137 s) | ≈12 s (local single-question median 10 s) |

**Sensitivities (inference):**
- **Waiting past the TTL.** If every answer arrives after a 5-minute expiry with 60k tokens in context, add **$28.80** per 100 questions on Opus 5.5 ($14.40 on Sonnet 5.5) in every scenario. That is larger than (a) and (c) combined, and a blocking design that waits on a person triggers it. Mitigations: a 1-hour TTL (subscription default) or keep-alives.
- **Upfront surface.** T = 5,000 instead of 1,500 raises (a)'s overhead to about $1.75.
- **Re-reads.** R = 150 triples the re-read line.
- **Effort.** At `medium` effort, K2 is probably lower than the local xhigh-heavy sample.
- **Comparing (a) with (c).** (c) cannot show a WBS, Gantt or UML at all. The fair comparison for rich content is (a) against (b). For simple choices, (a) should stay close to (c).

## 7. Measurement protocol candidates (K1–K3 and the 100-question estimate)

**Operational definitions (proposal, inference):**
- **K1.** The non-thinking output tokens (`output_tokens − thinking_tokens`) of the API response that emits the ask, plus all responses that exist only to prepare it (ToolSearch on a cold start, HTML writing, opening the browser). Report per question, dividing by the number of questions in a batched call.
- **K2.** The `thinking_tokens` of the same responses.
- **K3.** From t0, the start of the API request whose response emits the ask (OTel `llm_request` span start, or the transcript parent-entry timestamp), to t3, when the question is visible in the browser (AskBoard's render beacon). Break it down into t0→t1 (tool_use complete), t1→t2 (server receives `tools/call`; harness dispatch, permissions, hooks) and t2→t3 (server plus browser render).

**P-A: lab benchmark (headline KPIs).**
- **Scenarios:** S1 a simple choice (AskUserQuestion-equivalent), S2 a batch of 4 questions, S3 a WBS review board with about 20 items, S4 a Gantt or roadmap review, S5 annotatable UML, S6 S1 asked from a subagent.
- **Arms:** (a) AskBoard, (b) freehand HTML (agent writes the page and opens it), (c) AskUserQuestion for S1 and S2.
- **Runner:** `claude -p --output-format stream-json --verbose` or the Agent SDK.
- **Pinned settings:** `--model`, `--effort`, Claude Code version, `--strict-mcp-config --mcp-config <askboard>`, `--setting-sources ""`, restricted `--tools`, `CLAUDE_CODE_PROMPT_CACHE_TTL`, `ENABLE_TOOL_SEARCH` per arm, and `OTEL_LOG_RAW_API_BODIES=file:<dir>` for per-request usage.
- **Answering:**
  - AskBoard test mode, or a headless browser that records t3 and submits scripted answers.
  - AskUserQuestion answered by a `PreToolUse` hook or the SDK's `canUseTool`.
- **Runs:** at least 5 per cell, reporting median and p90. The video used 3; its freehand board ranged from 10.8k to 17.5k tokens across runs.
- **Cold vs warm:** both.

**P-B: field telemetry (dogfooding, real distributions).**
- Export Claude Code OTel to a local collector.
- Join `tool_result` events where `tool_name ~ mcp__askboard__*` to `api_request` events by `request_id` (2.1.310+), giving per-ask tokens.
- Take K2 from `api_response_body` files or transcripts.
- Take render times from AskBoard's own spans, joined through `traceparent` over HTTP, or through `tool_use_id` logged by a `PreToolUse` hook.
- This yields N_req, R, C_ctx and the distribution of answer waits that the cost model needs.

**P-C: static contract budget checks in CI (no model runs).**
- Count tokens of the upfront tool definitions plus instructions per model tokenizer (`count_tokens`), and of a golden minimal call per widget, which gives a floor for K1.
- Fail the build on budget overruns.
- Also check: descriptions ≤4,096 characters, full names ≤128, JSON Schema 2020-12 valid with no root combinators, deterministic `tools/list` order.

**100-question estimate.**
- Apply the P-A means per scenario to a scenario mix (for example 60% S1, 30% S2, 10% S3–S5).
- Take N_req, R, C_ctx and the share of waits beyond the TTL from P-B, and insert all of it into §6.2.
- Report per model (Opus 5.5 default, Sonnet 5.5) and per TTL (5-minute API key, 1-hour subscription), with the worked §6.3 table as the template.

## 8. Implications for the AskBoard PRD (researcher's inference)

**Capability requirements:**

1. **Data-only contract.** The agent sends a widget type, data and question text. AskBoard renders and computes layout and derived values; the agent writes no HTML, CSS, SVG or coordinates. Candidate targets: a rich board within about 1.5x of an AskUserQuestion question's K1 (≈700 non-thinking tokens), and K3 comparable to AskUserQuestion (≈10–15 s on Opus 5.5).
2. **Small, stable upfront surface.** One always-loaded ask tool (`anthropic/alwaysLoad`), the rest deferred. A fixed token budget for definitions plus instructions (for example ≤1,500 tokens), descriptions ≤4,096 characters, deterministic tool order, and no tool-list churn mid-session.
3. **Grouped asking.** Several questions or widgets in one call, beyond AskUserQuestion's 4. Local data shows about 38% less output per question at 4 questions per call.
4. **Compact typed answers.** Small answer payloads returned in the result. Large artefacts (annotated UML, an edited plan) are fetched on demand. Results stay well below Claude Code's 10k-token warning, 25k-token cap and 50k-character limit.
5. **Outcomes that prevent retries.** Explicit typed outcomes (answered, dismissed, timed out, browser closed, still open with an id) with "do not re-ask" semantics. `isError` is reserved for actionable input errors, and duplicate calls are deduplicated.
6. **Works from the main conversation and from subagents,** without hitting Claude Code's timers: keep-alive or progress before the idle limits, a fast first byte over HTTP, and a non-blocking path for long waits (cost of waits beyond the TTL, §6.3).
7. **Measurable by design.** A render timestamp or span joinable to Claude Code telemetry, a scripted-answer test mode for benchmarks, and a published per-widget "server card" with expected tokens and latency.

**Decisions to leave to architecture:**

8. **Transport and protocol revision:** stdio (30-min idle window, no `traceparent` header) or Streamable HTTP (60-s first-byte timer, `traceparent` propagation); 2025-11-25 handshake or 2026-07-28 stateless with MRTR.
9. **Asynchronous mechanism and fallback chain:** blocking call plus progress, the MCP Tasks extension (beta, main conversation only), URL-mode elicitation, or channels (research preview, allowlisted).
10. **Result representation and host reuse:** text-only or `structuredContent` (risk of reading the payload twice), and whether the same widget bundle also ships as an MCP App for the Claude apps.

## 9. Unverified or conflicting

- **Representation the model sees.** When a result has both `content` text and `structuredContent`, which one Claude Code gives the model is UNVERIFIED. The only report found (secondary) is about display.
- **Resource links.** How Claude Code shows `resource_link` blocks in tool results to the model is UNVERIFIED.
- **Trace context over stdio.** Whether Claude Code sends `traceparent` or `tool_use_id` in MCP `_meta` over stdio is UNVERIFIED. Only the HTTP `traceparent` header is documented.
- **Progress and subagents.** Whether progress messages reach the model, and whether elicitation dialogs are served for calls from subagents, is UNVERIFIED.
- **Thinking re-read as input.** On keep-all models with `display: "omitted"`, the billed input size of prior thinking blocks is assumed equal to K2. UNVERIFIED.
- **Sonnet 5.5 cache-read price.** The live pricing page says $0.10 (0.05x). An offline reference table cached on 2026-10-06 says $0.20. The live page is used here.
- **Cloudflare figure.** The article says 1.17M tokens without Code Mode; the page metadata says "over 2 million".
- **Tool search default.** Older secondary sources describe an `auto` default with a 10% threshold. Current docs say unset defers all MCP tools and `auto` is opt-in, so those sources are out of date. A third-party issue reports that the `auto` threshold grows to about 100k tokens on 1M-context models (secondary).
- **MCP client matrix.** Check marks were not readable in the Markdown export, so support per cell is UNVERIFIED. Rendering of MCP Apps by the Claude Code desktop app's Code tab is UNVERIFIED (its docs are silent).
- **Local baseline caveats.** One user's sessions, mostly `xhigh` effort, uncontrolled context sizes, latency taken from transcript write timestamps; the latency fit is rough.
- **Video benchmark caveats.** One model, 3 runs per cell; the author calls the results directional.
- **Microsoft Research percentages.** "Up to 85%" and "up to 91%" are quoted from other studies. The "Smelly descriptions" figures come from a search summary of the arXiv abstract.
- **Not used.** MCPMark per-run cost figures exist only in a social media thread (secondary).
