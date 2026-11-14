# Design

## Context

See proposal.md for the motivation. The question and the 18 exit criteria are in SOLUTION-DESIGN §10.1. The facts under test are in §13, and the research behind them is in `research-cc-delivery-2026-10-27.md` (§8 hooks, §9 mods, "Unverified or conflicting"). The design relies on these rules:

- **AD-4:** pull is authoritative. The mod pushes with `$.session.send` to a running subagent and with `$.prompt.submit` to an idle main conversation. It pushes only to the ask's owner, attributed to the mod and never with `asUser`.
- **AD-5:** a `PreToolUse` hook sends agent records. The session file is named by `CLAUDE_CODE_SESSION_ID`. The mod polls the local API with `$.clock.every` from `session.start`.
- **AD-10:** the `SubagentStop` guard and its `stop_hook_active` condition.
- **AD-11:** the local API is loopback only, takes a session token and refuses a browser `Origin`.
- **AD-12:** an ask's root comes from the owner's `cwd`.
- **AD-17:** the benchmark's isolated configuration and `--max-turns`.
- **AD-18:** one minimum Claude Code version. The client version comes from the protocol, else from the mod.

On 2026-10-29: `latest` is 2.1.312 (installed on this Mac), `stable` is 2.1.308, and the provisional minimum is 2.1.311.

## Goals / Non-Goals

**Goals:**

- A verdict for each of the 18 criteria, on 2.1.311 and on `latest`, backed by evidence that someone else can rerun.
- Latency per kind of agent and extra tokens per answer, measured well enough for the product owner to set OQ2's target and for the cost model's X.
- A spine that states only what the evidence supports, amended in this change.

**Non-Goals:**

- Product code: `packages/mod`, `packages/hooks` and the local API are built in E1 on the decisions recorded here. Probe code is not a starting point for them.
- The board, the browser and the view: a driver script stands in for the user's answers.
- Desktop, VS Code, WSL and native Windows. Mods are absent from Desktop WSL sessions [F8], and other surfaces are out of the first version (NFR-8). The spike runs on macOS. A Linux run in a devcontainer covers the criteria that depend on the platform: 10 (loopback fetch), 12 (processes left behind) and 13 (the session-file key).
- Benchmark-grade numbers: the early benchmark (phase 3) measures SM-1 to SM-3.

## Decisions

### 1. A probe plugin in the change, with the Stack's MCP SDK and nothing else

`probe/` is a self-contained Claude Code plugin. It is not in the Bun workspace (`packages/*`), and Biome and the repository checks ignore `openspec/`. It has these parts:

- **Plugin files:** `.claude-plugin/plugin.json`, and `hooks/hooks.json`, which declares the settings hooks and the mod as the hooks module, as AD-19 plans.
- **Stub server** (`server.ts`): a stdio MCP server with one tool, `probe_ask`, and a log of every request it receives. It also serves a local API on `127.0.0.1` with a random token, and writes the session file in a user-only folder in the spike's runtime directory. The tool records an ask with its owner and returns its ID and a board-like link.
- **Hook script** (`hook.ts`): one script for `PreToolUse`, `PostToolUse` and `SubagentStop`. It logs its input and environment, and sends `PreToolUse` agent records to the local API.
- **Mod** (`mod.js`): it logs the events it sees (`session.start`, `tool.call`, `turn.*`) with `$.session.id`, `e.agentId` and `$.agent.list()`. It polls the local API with `$.clock.every`, pushes new answers to the ask's owner and reports what it delivered.
- **Driver** (`driver.ts`): the board stand-in. It appends an answer to an ask, with a nonce and a timestamp, and reads the stub's state.

The stub uses `@modelcontextprotocol/server` 2.4.0, the Stack's pin, which the adoption rule has already cleared. It is installed only in `probe/`, at the exact version, with the probe's own lockfile. The SDK's handshake and negotiation are then the ones the product will have. That matters for criteria 12, 14 and 16. A hand-written JSON-RPC server could hide or invent differences. The mod's module shape and API follow the `plugin-authoring` skill and the mods documentation, which the apply phase reads first.

Alternative considered: building the spike on the real `packages/server` skeleton. That would mean writing product code before the decisions it depends on, so it was rejected.

### 2. Isolated sessions in a scratch project, on pinned versions

- **Scratch project:** each run uses a throwaway git repository under the session scratchpad, so that the askboard repository and the user's projects stay untouched. Criterion 17 needs `isolation: worktree` subagents, so the scratch project is a git repository.
- **Loading:** Claude Code loads the probe with `--plugin-dir probe/`, in an isolated configuration as in AD-17: `--setting-sources` limited to the scratch project, `--strict-mcp-config`, and no user plugins. Only the probe's server, hooks and mod run, and token counts carry no outside context. If `--strict-mcp-config` turns out to drop plugin servers, the server comes in through `--mcp-config` instead, with the plugin hooks matching the `mcp__probe__` names (SOLUTION-DESIGN §8). The first task finds out which applies.
- **Versions:** 2.1.311 and 2.1.308 install with `npm install --global --prefix <scratch>/cc-<version> @anthropic-ai/claude-code@<version>`, never with a plain `-g`, because Volta intercepts global installs on this Mac. `latest` is the installed `claude`, at whatever version it reports when it runs; `findings.md` records that version.
- **Negotiation:** default negotiation. `MCP_PROTOCOL_NEGOTIATION=legacy` is not part of this spike; CI covers it (AD-18).

### 3. Interactive sessions driven through tmux

Criteria 1, 2, 5, 7 and 13 need an interactive session. Each one runs in its own tmux session, driven with `send-keys` and read with `capture-pane`, so that runs can be repeated and run in parallel. For criterion 2, the driver types a partial prompt without pressing Enter, appends an answer, and then checks two things: the typed text is still in the input, unsent, and the woken turn starts only after the prompt is cleared or submitted. The product owner watches one run at the keyboard, to confirm what tmux cannot show: focus, flicker and how the woken turn looks in the terminal.

Criterion 6 runs with `claude -p --max-turns <n>`, with no tmux.

### 4. Agents under test and how reception is proven

The probe plugin ships one agent definition and a set of prompts:

- the **main conversation** asks, then goes idle (criterion 2), or keeps working (criterion 1);
- a **foreground subagent** asks, then works for several minutes through a scripted loop of short Bash steps;
- a **background subagent** (`run_in_background`) does the same;
- an **`isolation: worktree` subagent** asks once, for criterion 17.

Every pushed message carries a nonce. The agent counts as reached when the nonce shows up in that agent's own transcript (the subagent's JSONL, not the main one) as a message attributed to the mod. That is the proof for criterion 1. A nonce that shows up in another agent's transcript is a routing failure.

### 5. Latency and tokens, measured from timestamps and transcripts

- **Latency (criterion 3).** For each answer: `t0`, when the driver appends it; `t1`, when the stub serves it to the mod's poll; `t2`, when the mod calls `send` or `submit`; `t3`, when the transcript entry carrying the nonce is written. The result is `t3 − t0` per kind of agent: at least 5 samples each, reported as the median and the maximum. The spike runs at two poll intervals, 1 s and 5 s, so that the product owner sees how much of the latency the interval costs. For a working agent the delay depends on when the next tool call ends: the agent prompts mix short and long Bash steps, and `findings.md` reports the step lengths beside the latency.
- **Tokens (criterion 4).** X for push is the input tokens of the pushed message as the model receives it (wrapper included), plus the output tokens the agent spends acknowledging it. Both come from the transcript's usage. They are compared with a pull delivery of the same answer (a `collect`-style call to the stub), measured the same way. The model and effort are the ones the review of the model contract used (`claude-opus-5-5`).

### 6. Fallbacks are conditional, and decided per kind of agent

- **When the mod fails to reach a kind of agent (criterion 1):** the spike probes the two fallback adapters on that kind only. One is a Monitor watch on `probe watch`; its routing to the subagent that armed it is unverified [F25]. The other is `PostToolUse` `additionalContext`. `findings.md` records which one reaches the agent, with its latency and permission prompts.
- **When `$.http.fetch` fails (criteria 10 and 11):** the mod falls back to `$.process.run` of the probe executable as a client (criterion 11). If that fails too, the result is "AskBoard runs on pull alone", which goes to the product owner as a decision, not as an amendment made here.

### 7. Settings changes stay out of the user's own configuration

- **Criterion 5** (no permission prompt after installation) needs a real installation, not `--plugin-dir`. The probe installs from a local directory marketplace, at local scope, in the scratch project, and is removed afterwards. Adding the marketplace writes to the user's Claude Code configuration, so the task asks the product owner first and removes it at the end.
- **Criterion 8** (mods disabled) runs a probe variant with no hooks module. A user cannot turn mods off while keeping settings hooks: `disableAllHooks` stops both, and `allowManagedModsOnly` works only in managed settings (`findings.md` D4). For AskBoard the effect is the same: no mod, settings hooks still running.
- **Criterion 11** (policy refuses fetch): a `WebFetch` deny rule does not stop `$.http.fetch` (`findings.md` D2). A second probe mod, loaded beside the first, refuses `http.fetch` as an organization's policy mod would. The scratch run checks that the refusal reaches the probe mod, then tries the `$.process.run` fallback.
- **Unix socket** (`findings.md` D3): beside the loopback check of criterion 10, the stub also listens on a 0600 Unix socket, and the mod tries `$.http.fetch` with `socketPath`. This tells AD-11 whether the local API needs a TCP port at all.

### 8. Findings, decisions and the spine update

- **`findings.md`:** one table row per criterion and version, with its verdict (pass, fail, partial), the evidence (log excerpt, transcript line, timing) and the AD or fact it settles. Raw logs stay in the scratch directory. Only excerpts go into the change, with tokens and session IDs redacted.
- **Decisions:** as in `review-model-contract`, the product owner decides every finding that would change an AD or the PRD. Amendments go into the spine in place, with AD IDs stable. The §13 facts get their new status, and §10.1 gets a closing note.
- **Close:** the Deferred rows close or are reworded, and `updated:` is set. Validation is `openspec validate --all --strict --no-interactive`, plus `bun run check` to show that nothing outside the change was touched.

## Risks / Trade-offs

- **[`latest` moves during the spike]** → each run records the version it actually ran. A new `latest` is rerun only on criteria 1, 2 and 9, unless its changelog touches mods or hooks.
- **[Undocumented behaviour that varies from run to run]** (routing, idle detection) → 5 samples per kind of agent for criteria 1 and 3. A partial result counts as a fail for the Deferred row, and the conditions go into `findings.md`.
- **[A wake that disturbs the user's typing goes unseen in tmux]** → the product owner watches one criterion-2 run at the keyboard.
- **[The spike burns subscription usage]** (interactive sessions, 30-minute runs) → short agent prompts, low effort where the criterion allows it, and the 30-minute runs (criterion 7) only on 2.1.311 and `latest`, one main conversation and one background subagent each, in parallel.
- **[The installation check touches the user's Claude Code configuration]** → it runs only after the product owner agrees, and the marketplace and plugin are removed at the end (decision 7).
- **[Mod API details differ from the research notes]** (event names, `e.agentId`) → the apply phase reads the current mods documentation and the `plugin-authoring` skill before writing `mod.js`, and records any difference as a finding.
- **[The probe hides a product difference]** (a hand-built transport) → it uses the Stack's SDK pin (decision 1) and AD-5's session-file and record shapes, so what it shows carries over to E1.

## Migration Plan

None: no shipped behaviour changes. When the change is archived, `probe/` and `findings.md` stay in the archive as evidence. Nothing in the probe is referenced from `packages/`.

## Open Questions

- The poll interval the product ships with is chosen in E1. The spike gives the latency at 1 s and at 5 s.
- Whether OQ2's target is set as soon as the findings are in, or after the early benchmark, is the product owner's call. Either way the spine's latency row records the measurements.
