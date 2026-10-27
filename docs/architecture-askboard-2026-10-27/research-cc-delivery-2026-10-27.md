---
title: 'AskBoard: Claude Code answer-delivery paths, state as of 2026-10-27'
checked: 2026-10-27
scope: >-
  How a local MCP server plus browser board (AskBoard) can deliver a human's answers and
  follow-up messages to a Claude Code agent that keeps working after asking, in the main
  conversation and in subagents. Re-check of the 2.1.310 / MCP 2026-07-28 baseline against
  Claude Code 2.1.311.
marking: >-
  (v) = primary source read today (code.claude.com docs, Claude Code CHANGELOG on GitHub,
  npm registry, modelcontextprotocol.io, agentskills.io). (secondary) = inferred from primary
  sources without an explicit statement, or a CHANGELOG entry whose current behaviour the
  docs do not restate. UNVERIFIED = no primary statement found. "vX" = Claude Code version in
  which the behaviour appeared or changed.
---

# Claude Code delivery paths for AskBoard (checked 2026-10-27)

## Key findings

1. **Versions** (v): npm `latest` = `next` = **2.1.311** (2026-10-26), `stable` = **2.1.308** (2026-10-22). The local 2.1.311 is current. No CHANGELOG entry since 2.1.310 changes MCP Apps, elicitation, MCP tasks, channels or auto-backgrounding.
2. **Background subagents have a documented push path** (v): they keep `Bash`, `Monitor`, `SendMessage` and every MCP tool. A background command a background subagent starts outlives its turn, and *"when that command ends, Claude Code sends the subagent a notification"* (sub-agents doc; fixes in v2.1.243 and v2.1.260).
3. **Monitor watches always have a deadline** (v, v2.1.271): 5 min by default, 30 min at most, 10 min in `-p`. At the deadline Claude gets one notice and must re-arm. Plugin-declared monitors run for the whole session, but their notifications reach "Claude", and nothing documents delivery into subagents.
4. **Mods are no longer early access** (v): they are on by default from v2.1.287 (terminal). `$.session.send({ to: { agentId } })` reaches a **running subagent**, and `$.prompt.submit` starts a main-conversation turn once the session is idle. This is the only documented way for outside code to put a message into a running subagent.
5. **Session inbox socket** (v, v2.1.224): hooks and Bash commands get `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN`. A child process can post to its own session. The message is read between tool calls, or starts a turn if the session is idle. It targets the session, not a subagent, and the message line format is not documented.
6. **Channels and MCP tasks can't share one connection** (v): Claude Code does not register a channel server that negotiates 2026-07-28. Stdio negotiates 2026-07-28 by default from v2.1.292. MCP tasks *require* 2026-07-28.
7. **Unchanged** (v): the CLI renders no MCP Apps. MCP tasks are still a public beta (v2.1.304), main conversation only. Subagent MCP calls are never backgrounded. An open elicitation dialog defers backgrounding. Nothing documents elicitation from subagents.
8. **Hooks inside subagents** (v): settings and plugin hooks fire for subagent tool calls. `PostToolUse` `additionalContext` and a `SubagentStop` block with a `reason` therefore reach a subagent. Whether `asyncRewake` reaches a subagent is UNVERIFIED.

## 1. Versions and CHANGELOG since 2.1.310

- npm dist-tags (v, `npm view`, 2026-10-27): `latest` 2.1.311 (2026-10-26T19:47Z); `next` 2.1.311; `stable` 2.1.308 (2026-10-22T04:19Z). 2.1.310 was published 2026-10-23T21:20Z.
- **2.1.311** relevant entries (v):
  - Subagents can now use MCP tools from servers that finish connecting after the subagent starts.
  - `SubagentStop` hooks now run once per subagent, when it finishes; before, they ran about twice a minute while it worked.
  - Background agents in auto mode that wait on their own shells no longer start a main-conversation turn on every wake.
  - Shell commands that reach their timeout now report the output so far and say they are still running in the background.
  - Minor fixes to MCP CLI listings, `--plugin-dir` loading, mods' `$.env.set` and `AskUserQuestion` screen-reader wording.
- **2.1.310** (baseline release, for completeness, v):
  - Monitor tool and plugin monitors on Bedrock, Vertex and Foundry, and with telemetry off.
  - New error text for an MCP call that times out in a non-interactive session while an elicitation is unanswered: Claude is told no answer came and not to repeat the call.
  - Fix to the `AskUserQuestion` auto-continue timer.

## 2. MCP Apps in the CLI

- Still not rendered (v). The only CLI behaviour, from v2.1.281: `ui://` / `text/html;profile=mcp-app` resources are left out of `@` suggestions and the resource-list tool. Reading one by URI still works (mcp doc, "Reference MCP resources").
- The MCP Apps page lists Claude (web) and Claude Desktop as hosts, not Claude Code (v). The client matrix does not list Claude Code at all (v).

## 3. Elicitation

- **Form mode**: since v2.1.76 (v).
- **URL mode**:
  - On 2026-07-28 connections since v2.1.281 (v).
  - On 2025-11-25 and older connections to user-configured stdio/sse/http/ws servers since v2.1.287 (v). Claude Code declares `elicitation: {form: {}, url: {}}`. claude.ai connectors on older revisions get form only.
  - Consent: Claude Code asks before each URL open (v).
  - URL cap: about 8,000 characters as escaped, about 4,000 if the URL is mostly percent-escapes. Over the cap, the user can only decline (v).
- **Backgrounding** (v, mcp doc): "A call waiting on an open elicitation dialog isn't backgrounded while the dialog is open." Unchanged.
- **Hooks**: `Elicitation` and `ElicitationResult` can answer, decline or cancel without a dialog (v). The documented input carries `mcp_server_name`, `mode`, `url` and `requested_schema`. The common `agent_id` field applies "when the hook fires inside a subagent" (v).
- **Subagents**: no doc or CHANGELOG statement that elicitation from a subagent's MCP call is shown or supported → **UNVERIFIED**. Analogue (secondary): background-subagent permission prompts surface in the main session (v2.1.186), and agent view's "Needs input" state includes MCP elicitation.
- **Non-interactive**: inside an MCP task, `elicitation/create` is served only in interactive terminal sessions (v).

## 4. MCP tasks extension

- Status (v): "public beta in the Claude Code CLI", v2.1.304 or later.
- Conditions (v):
  - The server supports tasks.
  - The server is HTTP, stdio or claude.ai connector on revision 2026-07-28 (`MCP_PROTOCOL_NEGOTIATION=legacy` or `MCP_SDK_GENERATION=v1` rules this out).
  - The session fetches feature flags, so not Bedrock or Vertex, and not with telemetry off.
  - The surface is the terminal CLI, the Agent SDK or GitHub Actions. The VS Code extension and the desktop app don't get tasks.
  - **The call comes from the main conversation, not from a subagent.** Unchanged.
- Behaviour (v): Claude keeps working after the server returns `resultType: "task"`. Claude Code polls `tasks/get` (`pollIntervalMs` clamped 250–30000, default 2000). "If Claude is idle when the result arrives, Claude starts on it unprompted."
- `input_required` (v):
  - Claude Code reads `inputRequests` and answers each key once via `tasks/update`, at most 16 keys.
  - `elicitation/create` is served only in interactive terminal sessions. `roots/list` is served everywhere. Otherwise Claude Code cancels the task.
  - `tasks/result`, `tasks/list` and `notifications/tasks` are not used.
- Answer timing (v): on HTTP, the task answer must start within the per-request first-byte timer.

## 5. Channels

- Status (v): research preview since v2.1.80. The flags are hidden from `--help`.
  - It requires a claude.ai or Console API-key sign-in. Not available on Bedrock, Vertex or Foundry.
  - Team and Enterprise organizations must set `channelsEnabled`.
- Allowlist (v): `--channels` accepts only plugins on the Anthropic-maintained allowlist (the `claude-plugins-official` channel plugins) or on the organization's `allowedChannelPlugins`.
  - A custom channel needs `--dangerously-load-development-channels plugin:<name>@<mkt>` or `server:<name>`, with a confirmation prompt.
  - Publishing in your own marketplace doesn't change that.
- 2026-07-28 (v): on the v2 runtime, a channel server that negotiates 2026-07-28 "can't deliver channel messages", so it isn't registered.
  - Workaround: the server doesn't offer 2026-07-28, or the user sets `MCP_PROTOCOL_NEGOTIATION=legacy`, which affects every server.
- Delivery (v): events queue into the session and are processed in order. Events that arrive while Claude is busy are delivered together on the next turn.
  - Nothing documents delivery to subagents (secondary: main conversation only).
- Side effects:
  - `AskUserQuestion` and plan-mode tools are disabled while `--channels` is active (v2.1.83; secondary, not restated in the current docs).
  - Permission relay needs v2.1.234 or later.

## 6. Blocking MCP calls and timeouts

All unchanged (v, mcp doc and env-vars doc).

- Main-conversation calls move to a background task after **120 s** (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`, v2.1.212; `0` turns it off). The result arrives as a task notification, and the task shows the latest progress (v2.1.283).
- Never backgrounded:
  - calls from **subagents**;
  - calls to IDE servers;
  - `-p` runs, unless `CLAUDE_AUTO_BACKGROUND_TASKS=1`.
- Idle timeout: **5 min** for HTTP, SSE, WS and connectors; **30 min** for stdio. A response or progress notification resets it (`CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`, `0` disables it). A per-server `timeout` of at least 1000 ms sets a floor.
- Wall clock: per-server `timeout`, or `MCP_TOOL_TIMEOUT` (default about 28 h). Progress doesn't extend it.
- HTTP/SSE first byte: within max(60 s, the server's tool timeout, `MCP_TIMEOUT`). `MCP_TIMEOUT` is startup only, default 30 s. Stdio and WS have no per-request timer.
- Output: warning at 10k tokens; cap 25k tokens (`MAX_MCP_OUTPUT_TOKENS`). A foreground text result over 50,000 characters is saved to a file. `_meta["anthropic/maxResultSizeChars"]` raises a tool's threshold to as much as 500,000. Error text over about 11k characters is trimmed to its first and last 5k.

## 7. Background Bash and Monitor

**Background Bash** (`run_in_background: true`): GA and documented (v).
- The agent gets a completion notification when the command exits. There is no per-line notification. Output goes to a file the agent can `Read`.
- A command that the main conversation or a **background** subagent starts keeps running after the final response.
- A command that a **foreground** subagent starts stops when that subagent's run ends.
- A background subagent is notified when its command ends (sub-agents doc). Related fixes:
  - "background subagents not waking when their last background Bash task completes" (v2.1.243);
  - the one-hour limit on subagent background commands was removed (v2.1.260).
- Time limits: none in a local interactive terminal, desktop app or VS Code session. Unattended sessions (`-p`, SDK, CI, cloud) have 30 min by default and 2 h at most (`BASH_DEFAULT_TIMEOUT_MS` and `BASH_MAX_TIMEOUT_MS` raise them). A text-prompt `-p` run has 10 min (v2.1.285; v2.1.288 limited it to unattended sessions).

**Monitor tool**: GA and documented (v), added in v2.1.98.
- It runs a command in the background and feeds **each output line** to Claude as a notification. "You keep working in the same session and Claude interjects when an event arrives." It can also open a WebSocket, with one event per text message.
- Deadline (v2.1.271): 5 min default, 30 min max, 10 min in single-prompt `-p`. One notice at the deadline, then Claude must re-arm. The old no-timeout `persistent` option was removed.
- A script's final output and its exit arrive as one notification (v2.1.274).
- It follows Bash permission rules (prompted unless allowed). Auto mode sets aside allow rules that name `Monitor`. On native Windows it needs Git Bash.
- WebSocket source: Claude Code denies private, link-local and cloud-metadata addresses. Whether `ws://127.0.0.1` is allowed is UNVERIFIED.
- **Subagents**:
  - `Monitor` is in the background-subagent tool set (v).
  - Stopping a subagent stops its monitors (v; fix in v2.1.257).
  - The subagent itself, not the main conversation, receives the per-line events (secondary). Basis: the docs, plus CHANGELOG v2.1.299 ("an agent is only waiting on its own background work") and v2.1.311 (background agents woken by their own shells).

**Plugin monitors** (`monitors/monitors.json` or `experimental.monitors`) (v):
- Session-long processes, started at session start or with `when: "on-skill-invoke:<skill>"`.
- Not started under `-p`. They can't use `${user_config.*}`.
- The manifest key is marked experimental.
- Delivery to subagents: UNVERIFIED.

## 8. Hooks that inject or wake

- `additionalContext` (v):
  - `PreToolUse` (v2.1.9) and `PostToolUse`: next to the tool result.
  - `UserPromptSubmit` (v1.0.59): with a user prompt, so main conversation only.
  - `Stop` and `SubagentStop` (v2.1.163): the conversation continues.
  - Values over 10,000 characters spill to a file.
- `Stop`/`SubagentStop` `decision: "block"` + `reason` (v): keeps the agent running. For `SubagentStop` the reason is delivered "to the subagent as its next instruction". The same 8-consecutive-continuation cap applies.
- `async: true` (v): output is delivered on the next turn. If the session is idle it waits for user interaction. `-p` cancels async hooks at teardown.
- `asyncRewake: true` (v, documented; introducing version not found; fix in v2.1.287): exit code 2 "wakes Claude immediately even when the session is idle", with stderr shown as a system reminder. `timeout` is enforced.
- In subagents (v): hooks from settings, managed policy and plugins all apply inside subagents. Tool events fire for subagent calls, and the hook input carries `agent_id` and `agent_type`. Agent-frontmatter `Stop` becomes `SubagentStop`. Plugin agents ignore frontmatter `hooks`, `mcpServers` and `permissionMode`.
- Where async and `asyncRewake` output lands when the hook fired from a subagent's tool call: UNVERIFIED.
- `AskUserQuestion` (v):
  - A `PreToolUse` hook can answer it with `permissionDecision: "allow"` plus `updatedInput.answers` (v2.1.85).
  - `"defer"` works only in `-p`.
  - `AskUserQuestion` is removed from every subagent (first filter).
  - An MCP tool marked `_meta["anthropic/requiresUserInteraction"]` can't be auto-allowed by a hook.

## 9. Mods

- Status (v): "Mods are on by default", terminal v2.1.287+, Desktop v2.1.286+. `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` from early access is ignored.
- Where they run (v): CLI, Desktop and VS Code (2.1.299+). Hooks also run in `-p` and the SDK. Not in Desktop WSL sessions.
- Off switches (v): organizations can stop user mods (`allowManagedModsOnly`), and `disableAllHooks` stops them too.
- **Message the model reads later** (v): `$.prompt.submit({ text })` "waits until the session is idle and then starts a new turn". Claude reads the text after a sentence naming the mod as sender, or as user text with `asUser: true`.
  - This matches the described Plannotator "plugin message". Plannotator's own code was not checked: UNVERIFIED.
- **Subagents** (v):
  - `$.session.send({ to: { agentId }, text })` makes "the same delivery the SendMessage tool makes". "A subagent that's still running receives the message."
  - `$.agent.list()` gives ids.
  - `turn.step`, `turn.complete` and `tool.call` fire for subagents, with `e.agentId` (v2.1.299).
- Practical limits (v): a hook's own time is 10 s; `$.http.fetch` has a 30 s timeout and a 4 MiB body; `$.process.run` 30 s by default. Background polling uses `$.clock.every` from `session.start`.

## 10. Agent-to-agent and outside-in messaging

- `SendMessage` (v): resumes or messages subagents and teammates. It reaches other local sessions from v2.1.224 on macOS/Linux/WSL 2 and v2.1.234 on native Windows.
  - Delivery: "The receiving Claude reads the message between tool calls during an active turn". An idle session starts a new turn.
  - Inbound controls (`crossSessionInbound`) can hold or refuse. A bypass-permissions receiver holds by default.
- **Outside process → session** (v, inbox socket): a Unix socket, or a named pipe on Windows, at `CLAUDE_CODE_MESSAGING_SOCKET`.
  - It is exported to hooks and Bash commands. Whether stdio MCP server processes get it is UNVERIFIED.
  - Optional auth line `{"type":"auth","token":…}`, required on Windows. The connection must send a complete line within 30 s (v2.1.243).
  - Own-child messages are delivered by default. On macOS that holds only while the posting process is alive, or with the token.
  - The message wire format after the auth line is not documented: UNVERIFIED.
- **Outside process → running subagent**: documented only via a mod (`$.session.send`). No socket or MCP mechanism addresses a subagent: UNVERIFIED / not offered.

## 11. Plugins

- One plugin can bundle skills, commands, agents, hooks (`hooks/hooks.json`), MCP servers, LSP servers, monitors, channels, themes, default settings and `userConfig` (v, components doc).
- MCP servers are declared in a root `.mcp.json` or inline in `plugin.json`, and start automatically when the plugin is enabled (v).
  - Supported transports: stdio, SSE, HTTP, WS, and packaged MCPB.
  - `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and `${CLAUDE_PROJECT_DIR}` are substituted in `command`, `args` and `env` (stdio) and in `url`, `headers` and `headersHelper` (remote).
  - Tool names are `mcp__plugin_<plugin>_<server>__<tool>`; the server is `plugin:<plugin>:<server>`.
- Install scopes (v):
  - user: `~/.claude/settings.json`;
  - project: `.claude/settings.json`, committed, but each collaborator still installs;
  - local: `.claude/settings.local.json`.
  - Precedence: local > project > user.
- Marketplace (v): `/plugin marketplace add owner/repo[#ref]` (GitHub; SSH probe, then HTTPS), any git URL, a local path, or a hosted `marketplace.json`.

## 12. Tool search

- Still on by default (v). It is on behind gateways from v2.1.304, with a silent retry without it from v2.1.305.
- `_meta["anthropic/alwaysLoad"]: true` is honoured (v). The value `false` needs v2.1.285. A server-level `alwaysLoad: false` (v2.1.287) can defer even marked tools.
- Description limits (v):
  - 4,096 characters for server instructions and for upfront tools (2,048 before v2.1.296).
  - 16,384 characters for descriptions loaded via tool search (before v2.1.295 the short limit applied to all).
  - Override with `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` (v2.1.280+).
- Mods can register tools with `isDeferred: false` (v2.1.293).

## 13. Specifications

- MCP current revision: **2026-07-28** (v, `specification/latest` points at `schema/2026-07-28/schema.ts`). Tasks and MCP Apps are optional extensions.
- Claude Code negotiates 2026-07-28 on the v2 runtime (v):
  - stdio on every install from v2.1.292;
  - HTTP from v2.1.232 with flags, v2.1.274 without;
  - claude.ai connectors from v2.1.295;
  - cloud and Remote Control connectors from v2.1.299.
  - `MCP_PROTOCOL_NEGOTIATION=legacy` opts out. Earlier revisions (2025-11-25) still connect.
- Agent Skills (v): https://agentskills.io/specification carries no version identifier.
  - Required: `name` (≤64, lowercase-hyphen, matches the directory) and `description` (≤1024).
  - Optional: `license`, `compatibility` (≤500), `metadata`, and `allowed-tools` (experimental).

## 14. Platforms

- Supported (v, setup doc): macOS 13.0+, Windows 10 1809+ / Server 2019+, Ubuntu 20.04+, Debian 10+, Alpine 3.19+.
- Native Windows is supported. Git for Windows is optional, but Bash and Monitor need Git Bash, and sandboxing isn't supported.
- WSL 2: supported, with sandboxing. WSL 1: supported, without sandboxing.
- Cross-session messaging (v): macOS, Linux, WSL 2, and native Windows (v2.1.234).
- Mods (v): not in Desktop WSL sessions.

## Delivery-path candidates as of today

| Candidate | Main conversation | Subagent | GA or beta | Blocking? | Caveats |
| --- | --- | --- | --- | --- | --- |
| Long-poll MCP tool (`askboard_wait`) | Yes. It moves to a background task after 120 s and the result arrives as a notification | Yes, but it blocks the subagent for the whole wait (never backgrounded) | GA | Main: 2 min, then no. Subagent: yes | Needs progress notifications under the 30 min stdio / 5 min HTTP idle timeout. HTTP first byte within 60 s. Lost on session exit |
| MCP tasks (`resultType: "task"`) | Yes. An idle Claude acts on the result unprompted | No | Public beta (v2.1.304), CLI/SDK/GHA only | No | Needs 2026-07-28 and feature flags, so it conflicts with channels. Elicitation via `input_required` only in an interactive terminal |
| Form elicitation | Yes (terminal dialog) | UNVERIFIED | GA (v2.1.76) | Yes; the dialog defers backgrounding | The answer UI is the terminal, not the board |
| URL elicitation (open the board) | Yes | UNVERIFIED | GA (v2.1.281 / v2.1.287) | While the dialog is open | Consent on every open. Cap of about 8,000 characters. The elicitation reply carries only accept, decline or cancel; the answers come back in the pending tool call's result or by another path. No waiting dialog stays on screen when the server can't confirm completion (v2.1.281) |
| Channels | Yes (queued into the session) | No (secondary) | Research preview | No | Custom channels need `--dangerously-load-development-channels`. Not on 2026-07-28. `channelsEnabled` on Team and Enterprise. `AskUserQuestion` disabled (secondary) |
| Background Bash `askboard wait <ask-id>` (exits on answer) | Yes, a notification on exit | Background subagent: yes, it survives the turn and the subagent is notified. Foreground subagent: dies at the end of the run | GA | No | One notification per exit, so relaunch for each batch. Unattended time limit 30 min / 2 h |
| Monitor `askboard watch <ask-id>` (one line per answer) | Yes, per line | Tool available (v); routing to the subagent (secondary) | GA | No | Deadline 5 min by default, 30 min max, so re-arm. Bash permission rules. Windows needs Git Bash |
| Plugin monitor (session-long watch) | Yes | UNVERIFIED | Experimental manifest key | No | Not under `-p`. No `userConfig` |
| `PostToolUse` hook injecting new answers as `additionalContext` | Yes | Yes (v), with `agent_id` for routing | GA | No | Arrives only at the agent's next tool call. Adds latency to every call |
| `asyncRewake` hook | Yes, it wakes even an idle session | UNVERIFIED | GA (documented) | No | Exit-2 "failure" semantics. `timeout` enforced |
| `SubagentStop` / `Stop` block with `reason` | Yes | Yes (v) | GA | Holds the stop | Only when the agent tries to stop. 8-continuation cap |
| Mod: `$.session.send` / `$.prompt.submit` | Yes; `prompt.submit` waits for idle | Yes: delivered to a running subagent (v) | GA (on by default since v2.1.287) | No | JavaScript mod with in-process limits (10 s hook, 30 s fetch). Organization can block it. Not in Desktop WSL |
| Inbox socket post from a hook/Bash child | Yes, between tool calls or as a new turn | Not addressable (UNVERIFIED) | GA (v2.1.224) | No | Wire format undocumented. Inbound controls apply. MCP-process access UNVERIFIED |
| Pull tool (`askboard_collect`) | Yes | Yes | GA | No | The agent must remember to call it |

## Unverified or conflicting

- Elicitation (form or URL) from a subagent's MCP call: no statement in the docs or CHANGELOG.
- Monitor per-line events routed to the subagent that armed the watch: strongly implied (v2.1.257, v2.1.299, v2.1.311), never stated.
- Plugin-monitor and `asyncRewake` / `async` hook output delivery when the trigger came from a subagent.
- Inbox-socket message format, whether a socket message can address a subagent, and whether stdio MCP server processes inherit `CLAUDE_CODE_MESSAGING_SOCKET`.
- Whether Monitor's WebSocket source accepts loopback (`ws://127.0.0.1`). The docs deny private, link-local and metadata addresses but don't name loopback.
- Whether `AskUserQuestion` is still disabled under `--channels` (v2.1.83 entry; not in the current channels docs).
- The "consent per open" wording comes from the docs ("asks whether to open a link"). How often the consent repeats within one server session is not specified.
- Plannotator's mechanism (assumed to be `$.prompt.submit`): its source was not checked.
- The version that introduced `asyncRewake`: not found in the CHANGELOG.
