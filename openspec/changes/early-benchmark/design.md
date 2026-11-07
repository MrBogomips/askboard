# Design

## Context

See proposal.md for why the early benchmark comes now. What it starts from:

- **E1** (Track A's head, from which this change branches): `contract` holds the input format for one plain question, the `ask` and `collect` request and result envelopes, the board document, the board protocol, the routes and constants, and the shared fixtures. `ask-core` and `mcp-tools` exist. `board-host`, `notifier`, the session process entry point and `.claude-plugin/plugin.json` are Track A's groups 6 and 7, not committed yet.
  - E1's design fixes what the benchmark relies on. The notifier starts `BROWSER` as one command with the link as its only argument (design decision 6). The board WebSocket at `/ws/<askId>` takes the token as its first message and needs a matching `Origin` (design decision 5; board-host spec). The development plugin runs `bun ${CLAUDE_PLUGIN_ROOT}/dist/askboard.mjs` (design decision 10).
  - E1 has no hooks, no mod and no benchmark mode.
- **`packages/bench`** is empty: an entry point, and a manifest with no dependencies. `bun.lock` is frozen, so `bench` can declare nothing (proposal, open question 9).
  - The import check lets `bench` import `contract` only.
  - AD-19 forbids Bun-only APIs in a unit.
- **The mod delivery spike's harness** (`openspec/changes/spike-mod-delivery/harness/`) shows the transcript layout and the method:
  - transcripts are `<projects>/<folder>/<session>.jsonl`, and subagents' are `<session>/subagents/agent-<id>.jsonl`;
  - total input is input plus cache creation plus cache read;
  - a nested `claude` needs an environment cleaned of the launching session's variables (finding O5);
  - stamp a time before the action it measures.

ADs this design relies on: AD-1, AD-7, AD-10, AD-11, AD-17, AD-18, AD-19. Requirements: FR-32, FR-33, NFR-1, NFR-9, SM-1 to SM-4, SM-C2, R5, PRD OQ2.

## Goals / Non-Goals

**Goals:**

- One command runs S1 and S6 on E1 the day E1 lands, with nothing but `--session e1`, which is the default.
- Every figure in the report traces back to a transcript entry or an answerer record kept in the run's folder.
- The harness is tested end to end without any model: a stand-in `claude`, the stub session process and the real answerers.

**Non-Goals:**

- Benchmark mode in the session process, the render beacon, and a timing log written by the session process (AD-10, AD-17).
- A browser driver; freehand HTML; cases beyond what E1 can run; CI runs.
- Statistical tests beyond medians and spread (FR-32 asks for medians).

## Decisions

### 1. `bench` is an out-of-process client that speaks only the contract

`bench` imports `@askboard/contract` and nothing else of AskBoard (AD-1). It reaches the session process the same three ways a user's setup does:

- Claude Code starts the session process from AskBoard's plugin;
- the notifier starts `bench`'s answerer through `BROWSER`;
- the answerer talks to `board-host` over the board protocol on loopback.

Its sources use Node APIs and the globals Bun and Node 24 share (`fetch`, `WebSocket`), never a Bun-only API (AD-19). A test fails on `Bun.` or a `bun:` import under `src/`. The stub and the stand-in `claude` are test code and may use Bun.

*Alternative:* import `ask-core` and the server units to build the stub; AD-1 forbids it, and a stub that shares code with the real process would test neither.

### 2. Process topology of a run

```
bench run ──spawn──▶ claude -p (clean env, scratch project, --session-id <uuid>)
                      ├─ AskBoard arm: --plugin-dir <plugin> ──▶ session process (E1 or stub)
                      │        └─ opener: BROWSER=<case>/browser.sh <link> ──▶ board answerer
                      │                 └─ GET /b/<askId>?t=…, then WS /ws/<askId> (board protocol)
                      ├─ AskUserQuestion arm: --settings <case>/run-settings.json
                      │        ├─ PreToolUse hook on AskUserQuestion ──▶ bench auq-hook
                      │        └─ --permission-prompt-tool ──▶ bench permission host (stdio MCP)
                      └─ baseline (S1): the AskBoard arm's command without --plugin-dir, --max-turns 1
bench ◀── transcripts (<projects>/*/<uuid>.jsonl, subagents/) + answerer records + stream-json
```

- Each run gets its own scratch project under the system temporary folder, outside any repository, so no `CLAUDE.md` of the AskBoard checkout loads. Its own folder is `.askboard/bench/<run>/cases/<case>-<arm>-<n>/`.
- `--session-id` is a UUID that `bench` draws, so it finds the transcript under any project folder name, without assuming how Claude Code names it.
- **The baseline** exists to measure what AskBoard adds before the first ask. The AskUserQuestion arm cannot serve: its first request also carries AskUserQuestion's own definition, which the AskBoard arm's `--tools` leaves out, so the difference between the arms would understate AskBoard's context by that definition. The baseline gets the AskBoard arm's prompt, and its `--tools` and allowed tools without `Skill` (askboard-skills design decision 9: the baseline has no skill to load), without `--plugin-dir` and `BROWSER`, and `--max-turns 1`: one request, whose input is all it measures.

### 3. The pinned command

```
claude -p <prompt> --session-id <uuid> --model <model> --effort <effort>
  --setting-sources "" --settings <case>/run-settings.json --tools <arm's tools>
  --allowedTools <arm's tools> --max-turns <n> --output-format stream-json --verbose
  [--plugin-dir <plugin>]                                           (AskBoard arm)
  [--permission-prompt-tool mcp__bench__approve --mcp-config <case>/mcp.json]  (AUQ arm, host on)
```

- **Environment.** `HOME`, `USER`, `LOGNAME`, `SHELL`, `PATH`, `TERM`, `LANG` and `TMPDIR` come from the user's. So do the credentials Claude Code reads, when set: `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY` and `CLAUDE_CONFIG_DIR`. Nothing else is inherited (O5). `bench` then adds:
  - `DISABLE_AUTOUPDATER=1`;
  - `ENABLE_TOOL_SEARCH=<mode>`;
  - `FORCE_PROMPT_CACHING_5M=1` or `ENABLE_PROMPT_CACHING_1H=1`;
  - `BROWSER` (AskBoard arm);
  - `MCP_PROTOCOL_NEGOTIATION=legacy` (AskUserQuestion arm with the permission host, decision 6).
- **Tools.**
  - AskBoard arm: `ToolSearch`, `Skill`, plus `Agent` for S6; the baseline: `ToolSearch`, plus `Agent` for S6 (askboard-skills design decision 9). Allowed tools of both: AskBoard's `ask` and `collect` under both of the names AD-19's hooks match, then the arm's own tools.
  - AskUserQuestion arm: `AskUserQuestion` and `ToolSearch`. AskUserQuestion is not in the allowed tools: the hook decides.
- **`stream-json`** is kept only for its `system/init` message, which lists the MCP servers, plugins, model and tools the session started with (AD-17: "lists the MCP servers connected"). Figures come from transcripts, never from the `result` message (spike finding on woken turns).
- **Preflight**, before any run: `claude --version` is read, and checked against `--claude-version` when the user pins one. The session's plugin manifest must exist. With `--session e1`, the server's script must be built (`dist/askboard.mjs`).

### 4. One setting for the session process

`--session e1` (default) uses the repository root as the plugin directory: E1's `.claude-plugin/plugin.json` and `dist/askboard.mjs`. `--session stub` uses `packages/bench/test/stub/`, a plugin directory whose server is the stub.

- Every command derives the plugin directory from this one setting:
  - `run` passes it to `--plugin-dir`;
  - `smoke` reads the server the plugin declares, from `plugin.json`'s `mcpServers` or the plugin's `.mcp.json`, with `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PROJECT_DIR}` substituted, and starts it itself.
- `--plugin-dir` overrides the directory, for a checkout elsewhere.
- With `--session stub`, `run` adds `MCP_PROTOCOL_NEGOTIATION=legacy`, since the stub serves only the 2025 handshake (decision 7). This path is meant for the stand-in `claude` and is untested with Claude Code.

### 5. The board answerer

- **Launch.** `bench` writes `browser.sh`, a POSIX `sh` script that `exec`s the current runtime (`process.execPath`) on the answerer's entry, with the case's plan and record paths and `"$1"`. The script is the `BROWSER` value, a single command as E1's notifier requires. The notifier starts it detached with no stdio, so the answerer keeps its own deadline (60 s) and exits on its own.
- **Sequence:**
  1. Stamp `started` (t2′) first, before loading anything.
  2. Parse the link with the contract's `parseBoardRoute`.
  3. `GET` the board page.
  4. Open `ws://127.0.0.1:<port>/ws/<askId>` with `Origin: http://127.0.0.1:<port>` (board-host's Origin rule), and send `connect` with the token.
  5. Stamp `shown` (t3′) when the `board` message and a `state` with the question open have both arrived.
  6. Validate both with `validateBoardMessage("toPage", …)`. A message that fails stops the answerer before it answers, and the record says why.
  7. Choose the option, stamp `answered` before sending `answer` with the question's `rev` and `when`.
  8. Wait for the `state` showing the logged answer, stamp `acknowledged`, close.
- **Choice.** The case's plan lists, per question, the option labels it was asked with and the label to choose. The answerer matches the board's labels as a set.
  - With no match, it answers the first option and records `matched: false`, so the run ends quickly and measurement rejects it as deviated.
  - *Alternative:* answer nothing and let the run time out, at five minutes per deviation.
- **Records** are JSON lines in the case's folder: the ask ID, the stamps in epoch milliseconds, the chosen labels, the outcome. They never hold the token or the link.
- **Validator start-up.** The contract's validators compile with Ajv at first use. The answerer starts loading them while it connects and validates after stamping, so the compilation does not delay t3′.

### 6. The AskUserQuestion answerer and the permission host

- **Hook.** `run-settings.json` registers one `PreToolUse` hook with matcher `AskUserQuestion`, running `bench`'s `auq-hook` entry. It reads the hook input, stamps the time, picks each question's label from the plan, and prints:
  - `hookSpecificOutput` with `permissionDecision: "allow"`;
  - `updatedInput`: the input's `questions` with `answers` keyed by question text (research §5.1).
  It appends a record without the question text.
- **Permission host.** `--permission-prompt-tool mcp__bench__approve` names a tool of `bench`'s own stdio MCP server, declared in the case's `mcp.json` through `--mcp-config`. The tool answers `{"behavior":"allow","updatedInput":…}`, adding the plan's answers to an AskUserQuestion input that lacks them. On by default; `--auq-permission-host off` leaves out both flags and the server.
- *Alternative:* the SDK's `canUseTool`. That needs the Agent SDK as a dependency, outside the frozen lockfile and the adoption rule's reach today.

### 7. A minimal JSON-RPC over stdio, 2025 handshake only

The permission host, the scripted MCP client of `smoke` and the stub share one small module: newline-delimited JSON-RPC 2.0 over a pair of streams, with request IDs, notifications, and errors for unknown methods.

- The server side answers `initialize` with protocol version 2025-11-25, or the client's version when it is one of the 2025 versions SDK v2 serves. It also answers `notifications/initialized`, `ping`, `tools/list` and `tools/call`.
- The client side sends `initialize` with 2025-11-25. A server that has not answered it within 30 s, Claude Code's own `MCP_TIMEOUT`, or that refuses it, is killed and the start fails with the reason.
- E1's server, on SDK v2, serves 2025 openings by default (AD-18), so the smoke check reaches it.
- *Alternative:* the MCP SDK. `bench` does not declare it, and the root carries only the client package.

### 8. Reading transcripts

- **Location.** `<projects>` is `$CLAUDE_CONFIG_DIR/projects`, else `~/.claude/projects`, which tests override. The main transcript is the one `<uuid>.jsonl` found under `<projects>/*/`; subagents' are `<projects>/*/<uuid>/subagents/agent-*.jsonl`. Copies, with board tokens redacted, go to the case's `transcripts/` folder. `report` reads the copies.
- **Requests.** Assistant entries are grouped by `requestId`, falling back to `message.id`. A request's usage is counted once. Its content blocks are the union of its entries'. Its first entry's `parentUuid` names the entry that triggered it, whose timestamp is t0; without a parent, the preceding entry in file order is used. A tool call's t1 is the timestamp of the entry holding its `tool_use` block. Tool results are read from user entries by `tool_use_id`, with `is_error` and their text.
- **Fields read:**
  - `usage.output_tokens` and `usage.output_tokens_details.thinking_tokens`;
  - `input_tokens`, `cache_creation_input_tokens` and `cache_read_input_tokens` for the total input;
  - `cache_creation.ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens` for the observed TTL;
  - `message.model`, `version` and `effort` where present, for the report's observed settings.
- A field missing from every entry is reported as not observed, never as zero.

### 9. Measuring a run

- **Asks.**
  - AskBoard: a call of `^mcp__(plugin_askboard_)?askboard__ask$` whose result parses as an `ask` result with a `board`.
  - AskUserQuestion: a call of `AskUserQuestion` whose result is not an error.
  - Any other call of the asking tool counts as a failed attempt.
  - A successful call with the same ask ID, or the same question, as the ask before it is a retry of that ask (addendum: "retries count"): its request counts in that ask's K1, K2 and A, and its ask ID joins the ask's, for the answerer's record and the `collect` results. The next scenario question is the next ask that differs.
- **Preparing responses.** Walking back from the emitting request, a request is preparing while every tool call it makes is `ToolSearch`, `Skill` or a failed attempt of the asking tool. The walk stops at the previous ask's emitting request and at any other request, a text-only one included. K1 and K2 sum over the preparing requests and the emitting one; per question, they are divided by the ask's question count.
- **K3.**
  - AskBoard: t3′ − t0, joined to the answerer's record by ask ID, with the splits t1 − t0, t2′ − t1 and t3′ − t2′.
  - AskUserQuestion: t1 − t0.
  - Prep time: t0 of the emitting request minus t0 of the first preparing request.
- **X:** the output tokens, thinking included, of the requests that call `collect` for the ask before the next ask, and of a request between the ask and its last `collect` that only searches for tools: it loads `collect`, so it is part of collecting. It is 0 for AskUserQuestion. A tool search after the last `collect` is preparing for the next ask, so nothing counts twice.
- **A:** for each tool result of the asking flow (the `ask` result and the `collect` results for AskBoard; the AskUserQuestion result), the growth (total input of the next request − total input of the calling request − output of the calling request), summed. With no next request, A is not measured.
- **Context:** the total input of the session's first request, and the growth over every request of the session that calls `ToolSearch`: a definition loaded on first use stays in context like one loaded upfront.
- **Answer to agent:** the timestamp of the user entry carrying the `collect` result with the answer, minus the answerer's `answered` stamp.
- **Validity, in this order** (the first failure names the run's reason):
  1. the benchmark was stopped during the run (interrupted);
  2. the run timed out;
  3. the transcript is missing; for the baseline, also a transcript with no request, and nothing else;
  4. an expected ask is missing (S1 two, S6 one, in the subagent's transcript);
  5. a question was asked with labels other than the scenario's (deviated);
  6. two asks were sent in one response: the scenario asks one at a time;
  7. the answer never reached the agent: no `collect` result carries the scripted choice, or the AskUserQuestion result does not name the label;
  8. an AskBoard ask has no answerer record with `shown`.

### 10. Statistics, cost and targets

- **Statistics.** The median is the middle value, or the mean of the two middle values; p90 uses the nearest rank. Rows show n valid of n run.
- **Cost model.** The addendum's formula, coded once and tested on its worked results.
  - Prices: research §6.1's list prices, USD per million tokens, checked 2026-10-25, for Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.1. Any other model gets no cost and says so.
  - The cache-write price follows the run's TTL: the requested one, or the observed one when the transcripts disagree, flagged.
  - Defaults: 10 sessions of 10 questions, N_req 150, R 50, one write of T per session.
  - Per question: (1 × cold + 9 × warm) / 10 for each of K1, K2, X and A.
  - T: AskBoard's is max(0, the AskBoard arm's median first input minus the baseline's) plus the median tool-search growth; without a valid baseline it is not available. AskUserQuestion's is 0, as in the addendum's scenario (c).
  - The TTL line, answers after expiry at a 60k context, is shown apart.
- **Targets.** For S1, the ratio of AskBoard's median to AskUserQuestion's for K1, K2, K3 and the cost, cold and warm, with "within +25%" or not (SM-1 to SM-4). The answer-to-agent time against 2 s (OQ2, pull).

### 11. Output and redaction

- **Layout.** Under `.askboard/bench/<UTC run id>/`:
  - `settings.json`;
  - per case `cases/<case>-<arm>-<n>/`, holding `prompt.txt`, `command.json` (argv with the prompt elided, and the variable names `bench` set), `run-settings.json`, `mcp.json`, `browser.sh`, `plan.json`, `answerer.jsonl`, `stream.jsonl`, `stderr.txt`, `transcripts/` and `measure.json`;
  - `report.json` and `report.md`.
- **Git.** `bench/` gets its own `.gitignore` holding `*`, so `.askboard/.gitignore` stays the session process's to create (AD-14).
- **Redaction.** Each case folder is redacted as soon as its run ends, and the whole run folder again with the report: the value of a `t=` query parameter and of a `connect` message's `token` becomes `<redacted>`. A benchmark stopped midway keeps no token.

### 12. The commands

```
bun packages/bench/src/cli.ts run    [--session e1|stub] [--cases S1,S6] [--arms askboard,auq] [--runs 5]
                                     [--model …] [--effort …] [--cache-ttl 5m|1h] [--tool-search true]
                                     [--max-turns 12] [--timeout 300] [--claude claude] [--claude-version x.y.z]
                                     [--plugin-dir …] [--auq-permission-host on|off] [--out .askboard/bench]
                                     [--keep-projects]
bun packages/bench/src/cli.ts smoke  [--session e1|stub] [--plugin-dir …]
bun packages/bench/src/cli.ts report <run folder>
```

- The root `package.json` belongs to E1's tracks, so no root script is added. Integration can add `bench`.
- **Timeout.** On a run's timeout, `bench` sends SIGINT to `claude`'s process group, and `claude` stops its MCP servers with SIGINT (spike O1). Ten seconds later it sends SIGKILL to the group, and once more when `claude` has exited, for anything left in it.
- **Stopping.** `claude` runs in its own process group, so a Ctrl-C to `bench` does not reach it. While it runs, `bench` handles SIGINT and SIGTERM: it stops the current run the way a timeout does, starts no other, lists the run as interrupted, writes the report of the runs that ended, and `run` exits 130. `report` rebuilds a case folder without `run.json`, a run stopped before it was recorded, as interrupted.

### 13. The stub session process (tests)

`packages/bench/test/stub/` is a plugin directory, `.claude-plugin/plugin.json` with server `askboard`, and its server.

- **Tools.** Over decision 7's stdio JSON-RPC, it lists the contract's `TOOL_DEFINITIONS`, with `SERVER_INSTRUCTIONS` in its `initialize` result.
  - `ask` validates with `validateAskRequest`, creates the ask at `<epoch>.0`, and returns the envelope with the no-hooks warning.
  - `collect` validates with `validateCollectRequest`, returns events after each cursor with `unchecked: true`, and waits on `wait` until an event arrives or its bound expires.
- **Board.** `Bun.serve` on `127.0.0.1` serves the board page and the board protocol: the token first, `board` and `state`, `answer` checked against the question's labels and `rev`, then `state`. The receipt turns `delivered` after a `collect` returns the answer.
- **Opening.** A board opens only through `BROWSER`, spawned with the link as its only argument. Without `BROWSER`, `ask` returns `unavailable` (`no-browser`), so a test never opens a real browser.
- **Exit.** At stdin's end and on SIGINT or SIGTERM, every live board gets `discarded` and the process exits.
- Its results and messages are checked against the contract's validators in its own tests. It is a stand-in that speaks the contract, not a second implementation of the core.

### 14. The stand-in `claude` (tests)

`packages/bench/test/fake-claude.ts`, an executable, answers `--version` and stands in for `claude -p`. It parses the same flags.

- It reads the questions from the prompt's fixed block, writes a `system/init` line, and writes a transcript in the observed layout under `$CLAUDE_CONFIG_DIR/projects/<folder>/`. Usage is synthetic and deterministic; times are real.
- **AskBoard arm.** It starts the plugin's server with the scripted MCP client. Then:
  - one `ToolSearch` request, then `ask`, then `collect` with `wait`, per question;
  - for S6, it writes the calls to a subagent transcript instead.
- **AskUserQuestion arm.** It runs the `PreToolUse` hook command from `--settings` and records its answer.

With `--max-turns 1`, the baseline's flag, it writes one request and stops, as Claude Code does at that limit. It lets the runner's tests cover the whole pipeline. Its transcript layout is checked against the format facts of decision 8, not against Claude Code.

### 15. Prompts

One template per arm and case, sharing the question block:

```
Question 1 (single choice)
Header: Database
Text: Which database should the order service use?
- PostgreSQL: Relational, already run by the platform team; needs a managed instance.
- SQLite: Embedded file, no server to run; one writer at a time.
- DynamoDB: Managed key-value store that scales without tuning; no joins.
```

- The AskBoard prompt asks for one question per ask, and for `collect` with `wait` after each ask.
- The AskUserQuestion prompt asks for one question per AskUserQuestion call.
- Both ask the agent to wait for each answer before the next question, to write each question exactly as given, and to end with one line naming the chosen labels.
- S6 wraps the AskBoard prompt for question 1 as a subagent's task.
- The prompt never names an ask ID or a tool's full name: the agent finds the tool as a user's agent would.

## Risks / Trade-offs

- [AskUserQuestion's `answers` format, the hook's answer under `-p` and the permission host are taken from the research, untested here] → The first PO run shows it: an unanswered AskUserQuestion makes every run in that arm invalid, with the reason, and `--auq-permission-host off` is one switch away. The runs wait for the PO (tasks.md).
- [`--tools` may not accept `ToolSearch`, or restricting it may change deferral] → The tool lists are settings in one module. The `init` message's tool list is in every case folder, so the first run shows what loaded.
- [t3′ is earlier than the true t3: no rendering] → Labelled in the report. AD-17's beacon comes with benchmark mode. For E1, the PO compares t3′ with AskUserQuestion's t1, which also excludes rendering.
- [The answerer's start-up adds tens of milliseconds to t2′ and t3′] → A user's browser start adds more. The report says the answerer's start-up is included.
- [Claude Code's transcript format is undocumented] → Every field read is listed in decision 8. A field missing everywhere is reported as not observed. The fixtures follow the spike's observed rows.
- [Answers through the board protocol are a second scripted-answer path, which AD-17 prevents] → Started only through the `BROWSER` of a run `bench` spawns, so normal use never reaches it. The spine update draft records it as interim until benchmark mode.
- [Undeclared dependencies resolve through the root] → Proposal open question 9; declared after the rebase onto E1's Integration (2026-10-31).
- [The `claude` binary is updated between runs] → `DISABLE_AUTOUPDATER=1`, and every transcript's `version` field is compared with the preflight version. A difference is flagged in the report, as is a run whose transcripts wrote both 5-minute and 1-hour caches.
- [The baseline's first request still differs from the AskBoard arm's by anything Claude Code loads late, such as a connector that connects after the first request] → The report lists each arm's MCP servers; arms are compared by difference, as AD-17 says.

## Migration Plan

None: `bench` is new. When benchmark mode lands, its change replaces the board answerer with the in-process scripted answer and t3′ with t3, and amends this capability.

## Open Questions

None that change what is built. The PO accepted the proposal's thirteen open questions as proposed on 2026-10-31.
