---
title: "PRD addendum: AskBoard"
created: 2026-10-25
updated: 2026-10-25
---

# PRD addendum: AskBoard

Material that informs the architecture and UX work but does not belong in the PRD itself. Sources are the files in this folder and, where named, in `../prd-agentxema-2026-10-21/`. The visual-companion research calls the product HVC.

## Technical references: A2UI and Plannotator (architecture, UX; PRD FR-10, FR-11, FR-13 to FR-15)

User direction of 2026-10-22, repeated in the AXFX PRD §5.10: take A2UI and Plannotator into account as technical references (../prd-agentxema-2026-10-21/addendum.md, "Technical references for AskBoard").

- **A2UI**: "declarative UI protocol through which an agent composes UI from primitives" (same section). AskBoard's atoms and layouts closely mirror its basic catalogue (reconcile-addendum-competitive.md G1). As of 2026-10-22 it is Apache-2.0, v1.0 is a release candidate with renderers "planned", and the catalogue has "no table, chart or diagram" (extract-research-visual-companion.md §4).
- **Plannotator**: "closest existing human-review tool" (question cards, two-way "ask this session" threads, Mermaid and KaTeX annotation, multi-harness); it lacks Gantt, WBS, roadmap and PlantUML widgets and MCP App delivery (same AXFX addendum section). Apache-2.0, 9,573 stars, "releases daily" (extract-research-visual-companion.md §3). A UX reference for question cards, "Ask this session" and annotation, and a mechanism reference for non-blocking delivery (reconcile-addendum-competitive.md G1, G6).

**Open decision.** Is A2UI AskBoard's wire format, a format AskBoard maps to, or only an idea it borrows (extract-axfx-addendum-competitive.md §6 item 4)? The owner decides whether A2UI compatibility, meaning an agent that emits A2UI can drive a board, is a product requirement or an architecture preference (reconcile-addendum-competitive.md G1).

## Recommended base from the research (architecture; PRD FR-3, FR-11, FR-13, NFR-5, Risk R2)

The Claude Code CLI renders no MCP Apps (2.1.310, checked 2026-10-25; research-mcp-performance.md §4), so MCP App rendering inside Claude Code is an upside, not a prerequisite (PRD Risk R2), and a free one only if AskBoard's bundle is MCP Apps from the start (reconcile-research-visual-companion.md G-5).

From ../prd-agentxema-2026-10-21/research-visual-companion.md §3.2 and §7.2 (extract-research-visual-companion.md §6):

1. **MCP Apps packaging** (`@modelcontextprotocol/ext-apps`), the only UI format all graphical hosts render: "Keep MCP Apps the primary format so native rendering becomes a free upgrade; treat the local browser host as a bridge" (research risk R2).
2. **A thin local MCP Apps host for Claude Code**, built on the ext-apps `AppBridge` and `basic-host` reference (a double-iframe sandbox). Upstream has "no supported host implementation", so AskBoard owns the sandbox and CSP.
3. **A catalogue renderer**: "primitives as a catalog, widgets as custom catalog components". For the primitive catalogue the research shortlists json-render with `@json-render/mcp`, A2UI being the alternative. json-render is "the closest prior art": it already serves a catalogue as an MCP App, ships a Table and is Apache-2.0. Both are 0.x or release candidates; decide with a spike (../prd-agentxema-2026-10-21/research-visual-companion.md §3.2, §7.2).
4. **Elicitation-compatible JSON Schema forms**, so that "one question model serves both the native dialog and the web app": react-jsonschema-form first; JSON Forms, whose UI-schema categories group by area, as runner-up.
5. **AG-UI interrupt and resume** (typed `responseSchema`, explicit resume) as the reference design for the clarification loop, although coding harnesses do not emit AG-UI.
6. **Annotations** anchored to SVG element IDs and stored in the W3C Web Annotation Data Model.

Against spec churn (research risk R5): pin versions, put the renderer behind an adapter, spike first.

## Widget building blocks (architecture, UX; PRD FR-11, FR-12, NFR-6)

The visual-companion research lists candidate open-source components per widget (Gantt, timeline, tree and table, diagram, LaTeX, document and diff review, charts) with licence, version and activity; see extract-research-visual-companion.md §5. The visual design of the widgets is to be done with Google Stitch.

**Adoption rule.** AskBoard's own rule under its MIT licence (NFR-6), restated from the research's proposal (../prd-agentxema-2026-10-21/research-visual-companion.md §7.1, §7.2, §8):

- **Licence:** OSI-approved permissive (MIT, Apache-2.0, BSD) by default; MPL-2.0 or EPL-2.0 only for unmodified dependencies; no AGPL or GPL in the shipped bundle; no source-available, "free/trial", licence-key or open-core feature AskBoard would depend on.
- **Stars:** at least 1,000 on GitHub, or a named exception where the best fit is maintained by an established team (candidates: SVAR, Annotorious, Recogito, Temml).
- **Activity:** a push within 6 months, a release within 12, not archived.
- **Avoid:** licence-key, commercial or proprietary components (tldraw, Bryntum and Highcharts Gantt, gantt-schedule-timeline-calendar, Thesys C1, Tiptap Comments), archived ones (gantt-task-react, human-mcp, LangGraph Agent Inbox, assistant-ui tool-ui) and AGPL code (SwiftLaTeX, claudecodeui, Opcode). Further traps: the bpmn-js watermark, elkjs (EPL or GPL), BlockNote XL (GPL).

**Gantt.** In the shortlisted components, critical path and auto-scheduling are paid-tier features: DHTMLX Gantt Community (MIT since v10.0) and SVAR Gantt both keep them in PRO; Frappe Gantt suits read-only reviews (same research, §5.1, §7.2). AskBoard therefore computes Gantt dates and the critical path itself (PRD FR-12, NFR-6, Risks, R6).

## How answers reach a working agent (architecture; PRD FR-21, FR-22, FR-10)

The PRD requires that an agent keeps working after sending an ask, and that answers and follow-ups reach it while it works, without it asking AskBoard for them. Claude Code 2.1.310 offers several candidate paths; none is chosen here.

**No candidate today is both generally available and able to reach subagents** (PRD Risks, R1): subagent calls are never backgrounded, MCP Tasks are a main-conversation beta, channels a research preview, mods in early access, and URL-mode elicitation blocks backgrounding. A background task notification also carries one result per call, so several answers over time need repeated calls or a push path. (reconcile-research-visual-companion.md G-2)

- **Blocking call moved to the background.** A main-conversation MCP call still running after 2 minutes becomes a background task, and its result arrives as a task notification. Subagent calls never move to the background. Idle limits: 5 minutes over HTTP, 30 over stdio, unless the server sends progress notifications; over HTTP the first byte must arrive within 60 seconds. (research-mcp-performance.md §3.2)
- **MCP Tasks.** Public beta since Claude Code 2.1.304; main conversation only; CLI, Agent SDK and GitHub Actions only. Statuses include `input_required`. (research-mcp-performance.md §3.1–3.2)
- **Channels.** Research preview; custom channels need `--dangerously-load-development-channels` and are not registered on MCP 2026-07-28 connections. (extract-research-visual-companion.md §2.4)
- **URL-mode elicitation** (since 2.1.281). A consent prompt on each open; the URL is capped at about 8,000 characters; "the dialog keeps the call from being backgrounded". Fit: a launcher carrying a short token, never the payload; the consent click adds a step to FR-23's notice. Subagent support is unverified. (extract-research-visual-companion.md §2.3, §2.5; research-mcp-performance.md §3.2; reconcile-addendum-competitive.md G5)
- **Plugin message.** Plannotator's Claude Code mod runs a non-blocking review "whose decision reaches the model later as a plugin message". Mods (since 2.1.287) are in early access, so the research keeps them optional: the "core works through MCP alone". (extract-research-visual-companion.md §2.4, §3, §6.3)
- **Other paths to evaluate.** A hook that adds new answers to the agent's context on its next turn; a tool the agent calls to collect answers when it reaches a point where it needs them, for which Plannotator's inbox tools (`send_message`, `submit_guide`, `wait_for_reply`) are prior art. (extract-research-visual-companion.md §3)

Constraints to respect whichever path is chosen: AskBoard replies to the session that asked; it never drives a Claude Code session from outside. Subagents need a path too, since AskUserQuestion is unavailable to them while MCP tools are.

## Enforcing asking rules (architecture; PRD FR-30)

FR-30's asking rule "always use AskBoard" is a guarantee that skills (FR-29) cannot enforce (reconcile-research-visual-companion.md G-10).

- **Candidate path: a `PreToolUse` hook on AskUserQuestion.** Since Claude Code 2.1.85 such a hook can answer AskUserQuestion, returning `allow` with `updatedInput` `{questions, answers}` (extract-research-visual-companion.md §2.1). Inferred, not yet verified: it could therefore redirect the question to AskBoard, or show it on a board and return the answers (reconcile-research-visual-companion.md G-10; the research documents only that the hook can answer AskUserQuestion). The benchmark uses the same hook.
- **Optional: a mod** that intercepts (`tool.call`) or redraws (`ui.render`) the dialog; in early access (same §2.1).
- **Subagents cannot use AskUserQuestion at all**: it is "removed from every subagent's tools" (same §2.1). AskBoard is their only way to ask, so there is nothing to enforce (PRD FR-30).

## Security model from the research (architecture; PRD NFR-3 to NFR-5)

Research risk R6 (likelihood Medium, impact High): "DNS rebinding, CSRF, other local processes reading answers; untrusted agent-supplied content in views". Mitigation: "Bind to loopback, per-session token, Origin checks, sandboxed views with CSP as in MCP Apps; render agent content as data through the catalog, not raw HTML" (extract-research-visual-companion.md §6.3). Against the PRD:

- **Loopback binding** (NFR-3). A devcontainer's board reached through a port forwarded to the host's loopback interface still counts as local and keeps its token (reconcile-axfx-contract.md G2).
- **Token and Origin checks** (NFR-4): a per-session token in the research, one per board in NFR-4; the URL carries the token, never the payload (research risk R4, same §6.3). Both apply to every endpoint, including an answers API or an MCP endpoint served over HTTP (reconcile-research-visual-companion.md G-7).
- **Sandboxed views and agent content as data** (NFR-5), reproducing MCP Apps: "sandboxed iframe on a separate origin through a sandbox proxy, CSP built from `_meta.ui.csp` (connect, resource and frame domains), `object-src 'none'`, no localStorage inside views" (../prd-agentxema-2026-10-21/research-visual-companion.md §3.2). The connect and resource domains keep a board from fetching outside the machine (G-7).

## Benchmark baselines, measurement protocol and cost model (PRD FR-32, FR-33, §7)

### Baselines

Aggregates only (reconcile-performance.md §5). Source: research-mcp-performance.md unless noted.

**AskUserQuestion, measured locally** (§5.5): one developer's Claude Code transcripts, 2026-09-24 to 2026-10-25, Claude Code 2.1.281 to 2.1.310, almost all Opus 5.5.

| Metric | Per call (n=526) | Per question (1,027 questions) |
|---|---|---|
| Output tokens incl. thinking | median 1,381 (p10 556, p90 3,670) | mean 967, median 840 |
| Thinking tokens | median 600 | mean 518, median 425 |
| Non-thinking output | median 679 | mean 450, median 377 |
| Time to emit the tool call | median 12.2 s (p90 31.1 s); one-question calls 10.0 s | n/a |

- Batching 1 → 4 questions per call: median output per question 1,023 → 628, call latency 10.0 → 17.3 s (§1.9).
- Caveats: a convenience sample; mostly `xhigh` effort (484 of the 533 AskUserQuestion entries found; the 526 calls measured are those whose response held exactly one tool call), not the default `medium`, so thinking is likely higher than at the default; uncontrolled context sizes; times from transcript timestamps (§5.5, §9).

**Freehand HTML** (same sample, n=32): mean 16,254 output tokens, 3,883 of them thinking; about 111 s (§5.5).

**The video's kit** (run 2026-10-12, Opus 5.5, Claude Code 2.1.296, clean configuration, middle of 3 runs): a board in 615 tokens and 5 s with the kit (573–625 across runs) against 16,987 tokens and 137 s freehand (10.8k–17.5k). The component list costs about 600 input tokens per call. The video's author calls the results directional. (extract-video-harness-mcp-performance.md §3, §4; research-mcp-performance.md §9)

**Data-only estimate** (§6.3; K1 and K2 as defined in the measurement protocol): K1 700 (the kit's 615 plus question text), K2 520 as for AskUserQuestion. These are rich-question figures, +44% cost and +17% time against a plain AskUserQuestion question, not a plain-question expectation (reconcile-performance.md P-04).

### Measurement protocol

From the research (§5, §7); the counting rules are those the PRD adopts in FR-32 (reconcile-performance.md P-02, P-11).

- **K1:** non-thinking output (`output_tokens − thinking_tokens`) of the response that emits the ask, plus every response that only prepares it: tool search, skill load, failed or repeated attempts.
- **K2:** billed `thinking_tokens` of the same responses, never estimated from visible thinking.
- **Data source:** transcript `usage` deduplicated by `requestId`, since one response is stored as one entry per content block; `claude -p` JSON and OTel metrics do not split out thinking.
- **K3:** from t0, the start of the model request that emits the ask, to t3, AskBoard's render beacon once the whole question is visible (FR-33, SM-C2); split at t1 (tool call emitted) and t2 (AskBoard receives the call, after dispatch, permissions and hooks). Join keys: `traceparent` over HTTP, or the `tool_use_id` a `PreToolUse` hook logs; stdio `_meta` is unverified.
- **K3 for AskUserQuestion** (FR-32): K3 ends at t1, when the AskUserQuestion tool call is emitted, since AskUserQuestion has no board and in the benchmark a hook answers it, so it is never shown.
- **Counting:** the first ask of a session counts as it happens, tool search included; retries count. For a batched ask, K1 and K2 per question are the ask's figures divided by its question count, and K3 is the ask's own time (FR-32). Arms are compared at equal batch sizes, at most 4 questions per AskUserQuestion call.
- **Pinned settings:** model, effort, Claude Code version, cache TTL, tool-search mode (`ENABLE_TOOL_SEARCH`), and an isolated configuration (`--setting-sources ""`, `--strict-mcp-config`, restricted `--tools`); one model per comparison, as tokenizers differ (§1.3).
- **Scripted answerer:** an AskBoard test mode or a headless browser; AskUserQuestion is answered by a `PreToolUse` hook or the SDK's `canUseTool`, with a permission host under `-p`.
- **Runs:** 5 per case, medians compared (FR-32); the research also reports p90.

### Cost model for 100 questions

From §6.2:

```
Cost(100 q) = Σ_q [ P_out·(K1+K2+X) + P_w·(K1+K2'+X+A) + P_r·R·(K1+K2'+X+A) ]
            + Σ_sessions [ T·(N_req·P_r + n_w·P_w) ]
            + Σ_q [ 1(wait > TTL) · C_ctx·(P_w − P_r) ]
```

- **Per question:** output K1, thinking K2 (K2′ kept in context, assumed equal on Opus 5.5), X extra output to collect the answer, A answer tokens as the model receives them.
- **Per session:** T, tool definitions and instructions loaded at start; N_req model requests; n_w cache rewrites. A deferred ask tool keeps T near 0 until first use, then adds one search step.
- **Re-reads:** R later model requests re-read each question.
- **Cache:** write P_w and read P_r prices; C_ctx, the context re-written when the user answers after the TTL has expired. The TTL is 1 hour for the main conversation on a subscription, 5 minutes on an API key and for subagents (§1.11).
- **Reporting:** per model and per cache setting, at list prices (list-price equivalents on a subscription, §6.1). Defaults: 10 sessions of 10 questions, N_req = 150, R = 50, one write of T per session, a 60k context for the TTL line (§6.3).

Worked results, 5-minute TTL, USD per 100 questions (§6.3):

| Scenario | K1 | K2 | X | A | T | Opus 5.5 | Sonnet 5.5 | K3, rough |
|---|---|---|---|---|---|---|---|---|
| (a) Widget/data contract | 700 | 520 | 0 | 150 | 1,500 | **5.02** | 2.51 | ≈14 s |
| (b) Freehand HTML | 12,400 | 3,900 | 300 | 300 | 0 | **58.55** | 29.28 | ≈100 s plus collection |
| (c) Plain AskUserQuestion | 450 | 520 | 0 | 60 | 0 | **3.49** | 1.74 | ≈12 s |

Sensitivities: answers after a 5-minute expiry at 60k context add $28.80 on Opus 5.5 ($14.40 on Sonnet 5.5) in every scenario; T = 5,000 raises (a)'s tool overhead from $0.53 to about $1.75; R = 150 triples the re-read cost (§6.3). By the reconciliation's arithmetic, the plain-question +25% cost target holds only while T stays below about 2,100 tokens (reconcile-performance.md P-04; PRD Risks, R5).

## Plannotator features not matched (PRD §6, Risks)

Plannotator features the PRD neither matches nor rejects (reconcile-addendum-competitive.md §3, G8), with the status the owner's decisions imply. The competitive risk is PRD Risks, R3.

- **Ruled out:** Inbox mode, which persists pending reviews (asks are transient, FR-25); multi-harness reach across nine harnesses (Claude Code only, §6); delivery in VS Code (CLI only, NFR-8); encrypted share links (local machine only, NFR-3; Snapshots are the sharing path).
- **Covered:** Mermaid and KaTeX annotation, as separate widgets: Diagram (Mermaid) and LaTeX (FR-11).
- **Not in scope for the first version, revisit later:**
  - plan-mode review, through a `PermissionRequest` hook on `ExitPlanMode` with a 345,600 s timeout (extract-research-visual-companion.md §3); AskBoard opens only when an agent asks;
  - question-card "Accept recommended", one click for every recommended option;
  - question-card "skip", declining to answer (FR-4 only postpones);
  - labels on annotated passages;
  - review of Markdown, HTML and URLs as named document formats;
  - Graphviz (DOT) diagrams;
  - delivery in a TUI.
