# Findings: mod delivery spike

The exit criteria are in SOLUTION-DESIGN §10.1, and the approach is in `design.md`. Raw logs stay in the spike's scratch directory. Only excerpts appear here, with tokens and session IDs redacted.

## Method

- **Platform:** macOS (Darwin 25.6.0, arm64) for every criterion. Criteria 10, 12 and 13 run again on Linux in a devcontainer (task 4.1).
- **Versions:** the declared minimum 2.1.311 and `latest`, plus `stable` 2.1.308 for the criteria that decide the minimum. Default protocol negotiation. Installed on 2026-10-29 (task 1.2):

  | Channel | Version | Binary |
  | --- | --- | --- |
  | Declared minimum | 2.1.311 | `npm install --global --prefix <scratch>/cc-2.1.311`, then `<prefix>/bin/claude` |
  | `stable` | 2.1.308 | the same, under `<scratch>/cc-2.1.308` |
  | `latest` | 2.1.312 | the installed `claude` |

  npm skipped the package's `postinstall` script (install scripts are not allowed for global installs on this machine). Both binaries still start and report their version.
- **Configuration:** a throwaway git project in the scratch directory, which Claude Code is told to trust. The probe loads with `--plugin-dir`, with settings sources limited to the scratch project. No user plugins and no MCP server other than the probe (task 1.4 records the exact flags).
- **Proof of delivery:** every pushed message carries a nonce. An agent counts as reached only when the nonce shows up in its own transcript as a message attributed to the mod. A nonce in another agent's transcript is a routing failure.
- **Model:** `claude-opus-5-5`, as in the review of the model contract.

## Loading mode (task 1.4, 2026-10-29)

- **Command:** `claude -p <prompt> --plugin-dir probe/ --setting-sources project --allowedTools <probe tools, Bash(sleep:*)> --model claude-opus-5-5 --output-format json --debug-file <run>/debug.log`, run from the scratch project, with `PROBE_RUN_DIR` set per run (`scratchpad/run-p.sh`).
- **`--strict-mcp-config` drops plugin servers.** With the flag, the main conversation had no `probe_ask` (run `smoke-strict`), so the spike runs without it. AskBoard's benchmark cannot use the flag either. AD-17 and SOLUTION-DESIGN §7 name it in the isolated configuration: they need amending (task 5.1).
- **What still loads:** the user's claude.ai connectors (Claude Docs, Google Drive, and others) connect even with `--setting-sources project`. They sit behind tool search and are the same in every arm, so token comparisons take differences between runs.
- **The built-in guard loads on this machine:** `cc-plugin-sec-default@builtin seated outermost: the organization is team` (D10). It admitted the probe mod (`plugin.register: probe (user, probe@inline), judged by cc-plugin-sec-default: admitted`). Every result below is under the guard, which is what users on Team and Enterprise plans get.
- **Smoke run `smoke-1`, on 2.1.312:** the logs show the stub's start, `server/discover`, the API start, `tools/list` and the `probe_ask` call. They show a `PreToolUse` record sent through the session file found by `CLAUDE_CODE_SESSION_ID`, then bound by `tool_use_id`. They show the mod's `session.start`, its session-file match, one poll per second over loopback TCP, and `tool.call` with no `agentId` in the main conversation.

### Early observations, to be confirmed in their criterion

- **O1 (criterion 12, AD-2):** Claude Code stops the stdio server with **SIGINT** (`MCP server "plugin:probe:probe": Sending SIGINT to MCP server process`). AD-2 names stdin close, SIGTERM and SIGHUP. In `smoke-1` the stub did not handle SIGINT and left its session file and socket behind. With a SIGINT handler (`smoke-2`) it logs `exit` with `reason: SIGINT` and removes both.
- **O2 (criterion 14, F16):** `tools/call` carries `_meta: {"progressToken": 2, "claudecode/toolUseId": "toolu_…"}`, the same ID as the `PreToolUse` input's `tool_use_id`. The record bound by `tool_use_id`, not by the next-call rule.
- **O3 (criterion 16, F17):** every request carries the per-request envelope `io.modelcontextprotocol/clientInfo` = `{"name": "claude-code", "version": "2.1.312", …}` under protocol revision 2026-07-28. The mod's `$.session.version()` reports the same version.
- **O4 (criterion 12, F15):** a `server/discover` request with ID `server-discover-probe-1` arrives on the session's own process, before the regular `server/discover`. No sibling process started (one `start` line per run).
- **O5 (criterion 13, AD-5):** in the mod, `$.env.get('CLAUDE_CODE_SESSION_ID')` returned the **launching** session's ID (this spike's own session, inherited through the environment), while `$.session.id()`, the server's environment and the hooks' environment all had the new session's ID. A mod must take the key from `$.session.id()`, never from its environment. The difference shows whenever Claude Code is started from inside another Claude Code session, as the benchmark and CI's nested runs are.
- **O6 (AD-2):** the first request other than the handshake was `subscriptions/listen`, before `tools/list`. AD-2's "first request other than `server/discover`" therefore starts the port and session file at connection time, before any ask.

## Criteria 1 to 4: delivery, latency, drafts and tokens

Interactive runs drive Claude Code in tmux (`run-i.sh`, `deliver-i.sh`), with a clean environment and the auto-answerer answering 8 s after the ask, then every 8 or 12 s. Run names are `d-<agent kind>-<mode>-<push path>-<version>`. Seen latency is t0 (answer created) to the first request that carries the answer (token growth) or the first assistant row quoting its nonce (`readlat.py`). Poll interval 1 s unless a run name ends in `-5s-`.

### Push paths compared

| Path | Main, turn running | Main, idle | Subagent (foreground or background) | Auto mode | Cost per answer |
| --- | --- | --- | --- | --- | --- |
| `$.session.send({ to: { agentId } })` | n/a (no `agentId`; self `sessionId` refused under `-p`) | n/a | delivered as `queued_command`, read at the next request | **refused** (D13) | about +108 input, about +80 output |
| `$.prompt.submit` | queued until the turn ends, answers batched into one woken turn | wakes in 0.4–0.8 s | n/a | allowed | one woken turn |
| `$.session.append({ agentId? })` | read at the next request | stored, **does not wake** | read at the next request | allowed | about +38 input |
| Pull (`probe_collect`) | when the model calls it | when the model calls it | when the model calls it | allowed | about +89 output, about +95 input, one extra request |

### Criterion 1: every kind of agent is reached

- **Default permission mode, `session.send` to subagents:** every answer delivered, nonce in the subagent's own transcript.

  | Run | Answers | Seen median | Seen max |
  | --- | --- | --- | --- |
  | `d-fg-default-312` | 5/5 | 8.4 s | 16.4 s |
  | `d-bg-default-312` | 5/5 | 8.1 s | 13.8 s |
  | `d-fg-default-311` | 5/5 | 8.9 s | 14.1 s |
  | `d-bg-default-311` | 5/5 | 8.1 s | 12.8 s |

  No permission prompt appeared for the mod's sends.
- **D13: auto mode refuses the mod's `$.session.send`.** Under `--permission-mode auto` (the PO's daily mode), every send to a subagent returned `isDelivered: false` with `The server-side auto mode classifier gave no verdict for SendMessage: the request that produced this action did not ask for one…`. Runs `d-fg-312`, `d-fg-311`, `d-bg-311`, `d-bg-312` and, with the self-approval below, `d-bg-auto-self-312` and `d-bg-auto-self-311`: 0 of 16 sends delivered. The subagents fell back to `probe_collect` only when their prompt let them.
  - A mod's own `tool.check` hook allowing SendMessage for its own origin does not help: the hook is not consulted for `$.session.send` (no settle line for it in the debug log), and the refusal comes from the classifier inside the send.
  - An allow rule does help: `--allowedTools SendMessage` under auto mode delivered 3/3 (`d-bg-auto-allow-312`, median 12.8 s). That rule also lets the model message any agent unreviewed, which a plugin cannot set for the user and should not ask for.
- **`$.session.append` reaches every agent, in every mode.** Under auto mode with `PROBE_PUSH_VIA=append`:

  | Run | Target | Delivered | Read |
  | --- | --- | --- | --- |
  | `d-bg-auto-append-312` | background subagent | 3/3 | at the next request: growth 133 and 167 against 95 for a plain step |
  | `d-bg-auto-append-311` | background subagent | 3/3 | the same |
  | `d-bg-append-5s-312` | background subagent, 5 s poll | 5/5 | at the next request (growth 132–168 against 95) |
  | `c1-fg-append-312` (`-p`) | foreground subagent | 5/5 | at the next request (growth 133–219 against 96) |
  | `c1-fg-append-311` (`-p`) | foreground subagent | 5/5 | the same; its report lists all five |
  | `d-main-auto-append-312` | main, turn running | 3/3 | quoted after 10.7, 15.4, 3.8 s |
  | `d-main-auto-append-311` | main, turn running | 3/3 | quoted after 10.8, 15.4, 3.3 s |
  | `c2-idle-append-312` | main, idle | stored | **never**: no turn starts |

  The appended row is a user text row in the target loop's transcript. It can sit between a `tool_use` and its `tool_result` in the file, and the engine still builds valid requests from it (every run completed). It is not subject to SendMessage's review, so it is the push path that works under auto mode.
- **Main conversation:** with `prompt.submit` alone, an answer given while the turn runs is read only after the turn ends: headless 30–42 s; interactive `d-main` runs median about 70 s, max about 94 s, on both versions, with several answers batched into one woken turn. With append while the turn runs, it is read within one tool step (3–15 s here, the steps being 15 s). Neither path alone covers both states: the mod needs append while a turn runs and submit when idle (the hybrid, below).
- **The hybrid for the main conversation** (`PROBE_MAIN_VIA=hybrid`). The mod tracks the main turn with `turn.start` and `turn.complete` (no `agentId`) and the time of its last request with `turn.step`. While a turn runs it appends; when idle it submits. At `turn.complete` it submits again every answer appended after the last request was sent, because that request did not carry it and no later one will. `d-main-hybrid-312`, answers 8 s apart against a turn of a 10 s sleep and a 250-word reply:

  | Answer arrived | Path | Read |
  | --- | --- | --- |
  | during the sleep | append, carried by the final request | 13.4 s |
  | during the final reply | append, then catch-up submit at `turn.complete` | 8.4 s, in the woken turn |
  | during that woken turn | append, then catch-up submit again | 2.1 s |

  The same prompt with 5 answers 8 s apart, so that the last ones arrive while the conversation is idle:

  | Run | Poll | Read (all 5) | Paths | Catch-ups |
  | --- | --- | --- | --- | --- |
  | `d-main-hybrid-311` | 1 s | 14.6, 10.3, 6.1, 4.0, 2.9 s | 3 append, 2 submit | 2 |
  | `d-main-hybrid-5s-312` | 5 s | 13.4, 9.0, 5.5, 2.7, 4.5 s | 2 append, 3 submit | 1 |

  A caught-up answer reaches the transcript twice (the appended row and the submitted prompt), a few dozen tokens. The engine frames a submitted prompt as one "a plugin submits between turns", in the user's place.
- **Interactive sessions start subagents in the background** even when the prompt asks for the foreground (`Backgrounded agent` on screen, `d-fg-*`). The foreground case is reached only under `-p` (criterion 9's runs).

- **Fallback adapters (task 3.8): not needed.** The only failure was `session.send` to subagents under auto mode (D13), and `$.session.append` reaches every kind of agent in every mode tested, without a permission prompt or an allow rule. The Monitor watch and `PostToolUse` `additionalContext` adapters were not probed. Pull (`probe_collect`) stays the authoritative path (AD-4).

### Criterion 2: an idle main conversation with a draft

- `c2-idle-312` (submit): with "this is my half-typed draft" in the prompt box, the answer started a woken turn within the poll interval, and the draft stayed in the box, unsent and unchanged.
- `c2-idle-append-312` (append): the row was stored and nothing else happened; the draft stayed, and the answer was never read.
- **With the PO at the keyboard** (`c2-po-312`, hybrid mod, auto mode, 2026-10-29 18:43): the PO typed "this is my draft" in the idle session without sending it, and an answer was pushed. The engine started a turn shown as "Prompt from the probe plugin" (the pushed text, then "This is how Claude Code surfaces a prompt a plugin submits between turns — it starts this turn in the user's place"), and the model replied `GOT N-2e22b560` within 2 s. The draft stayed in the box, unsent, with the cursor at its end. Confirmed by the PO with a screenshot of the attached session.

### Criterion 3: latency

- Mod side, t0 to push: median 0.1–0.8 s, max about 1 s at a 1 s poll; median 2.0–2.5 s, max 4.6 s at a 5 s poll (`d-main-hybrid-5s-312`, `d-bg-append-5s-312`). Both versions, every path.
- Seen, by path, at a 1 s poll (5 s poll in brackets):

  | Agent | Path | Median | Max | Runs |
  | --- | --- | --- | --- | --- |
  | Subagent, default mode | `session.send` | 8.1–8.9 s | 16.4 s | `d-{fg,bg}-default-{311,312}` |
  | Subagent, any mode | append | next request, within one tool step | one step (15 s here) | `d-bg-auto-append-*`, `c1-fg-append-*` (`d-bg-append-5s-312`) |
  | Main, turn running | submit alone | about 70 s interactive, 30–42 s headless | about 94 s | `d-main-*` |
  | Main, hybrid | append, submit, catch-up | 6.1 s (5.5 s) | 14.6 s (13.4 s) | `d-main-hybrid-{311,312}` (`d-main-hybrid-5s-312`) |
  | Main, idle | submit | 0.4–0.8 s | 0.8 s | `c2-idle-312`, `c13i` runs |
- The poll interval adds at most its own length; the target's step length dominates.
- Seen latency is bounded by the target's next request, not by the transport: about one tool step for subagents and, with append, for the main conversation; the rest of the turn for the main conversation with submit alone.

### Criterion 4: tokens

Measured on latest from per-request usage (`tokens.py`), main and subagent transcripts:

- `session.send` push to a subagent: the request after the push grew by 203 tokens against 95 for a plain step, so about +108 input tokens per message (the `queued_command` framing), plus about 80 output tokens of reaction.
- `session.append`: about +38 input tokens per answer (133 and 167 against 95, one and two answers).
- Pull (`c4-pull-312` against `c9-fg-312`): the collect call costs 89 output tokens, about 95 input tokens of result, and one extra request.

## Criterion 5: a real install, no permission prompt (task 3.4, with the PO's agreement)

- `claude plugin marketplace add <scratch>/mp --scope local` and `claude plugin install probe@askboard-spike-mp --scope local`, from the scratch project, on 2.1.312: both succeeded; the project's `settings.local.json` gained `extraKnownMarketplaces` and `enabledPlugins` entries.
- Session `c5-installed-312`: the installed probe (no `--plugin-dir`), `--setting-sources project,local`, auto mode, no allow rule for the probe's tools, hybrid main path and append. One ask from the main conversation and one from a background subagent: **no permission prompt** on any of the twelve screen captures, and 4 answers pushed by append, each reported by its agent (main: `N-4a0bc357`, `N-10a06a8f`; subagent: `N-ef751fb1`, `N-8123b79f`).
- Cleanup: `claude plugin uninstall probe@askboard-spike-mp --scope local` and `claude plugin marketplace remove askboard-spike-mp`. The user's `known_marketplaces.json` and `installed_plugins.json` are byte-identical to the copies taken before the install, and no user file names the marketplace.

## Criterion 6: `-p` and `--max-turns`

Headless runs (`c6.sh`, `c6b.sh`), main conversation, push by `$.prompt.submit`.

| Run | Version | Answer arrives | `--max-turns` | Exit | Duration | JSON `subtype`, `result` | Push |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `c6-none-312` | 2.1.312 | 15 s after the ask, after the turn ended | none | 0 | 7 s | `success`, "waiting" | never made: the run had exited |
| `c6-max2-312` | 2.1.312 | the same | 2 | 1 | 6 s | `error_max_turns` | never made |
| `c6-max1-312` | 2.1.312 | the same | 1 | 1 | 4 s | `error_max_turns` | never made |
| `c6-during-none-312` | 2.1.312 | 5 s after the ask, during a 15 s step | none | 0 | 25 s | `success`, "GOT N-…" | queued, one woken turn |
| `c6-during-max3-312` | 2.1.312 | the same | 3 | 1 | 22 s | `error_max_turns` | dropped: `the prompt was removed from the queue before it ran` |
| `c6-during-max3-311` | 2.1.311 | the same | 3 | 1 | 22 s | the same | the same |

- **`-p` ends with the turn.** Nothing keeps the run alive for an answer that has not arrived. F11's "`$.prompt.submit` can keep a run alive" holds only for a push queued before the turn ends, and only for one woken turn.
- **`--max-turns` bounds it.** A queued submit past the limit is dropped and the run fails with `error_max_turns`. The answer is lost, never altered (NFR-10 holds).
- **The JSON result changes.** With a woken turn, `result` is the woken turn's text and `num_turns` counts that turn only, so a caller parsing `-p` output loses the original turn's answer. The benchmark (AD-17) must not rely on it.
- **Under `-p`, append is the better path.** An answer appended during a tool step is read inside the same turn (criterion 1), with no extra turn and no `--max-turns` exposure. An ask that must be answered in a headless run needs the agent to stay in its turn (wait with `probe_collect` or a sleep loop) until the answer arrives.

## Criterion 8: the board link for a subagent's ask, without mods

Probe variant with no hooks module (`hooks.json` without `modules`, D4), interactive, auto mode: `c8-nomod-312`, `c8-nomod-311`. A background subagent asks once.

- **Fails on both versions.** The `PostToolUse` hook ran and returned `{"systemMessage": "probe board for c8-bg: http://127.0.0.1:<port>/b/c8-bg"}` (debug log: `Hook PostToolUse:mcp__plugin_probe_probe__probe_ask (PostToolUse) success`), but the main screen never showed it. The engine filed it in the subagent's own transcript as a `hook_system_message` attachment, which the model reads and the user does not see.
- **It is not caused by disabling mods.** No interactive run with the mod loaded showed a subagent's link on the main screen either (`d-bg-*`, `d-fg-*`, both versions; interactive sessions run every subagent in the background, criterion 1). For an ask from the main conversation the link does show (`c2-idle-312`: `PostToolUse:mcp__plugin_probe_probe__probe_ask says: probe board for c2-idle: …`).
- **Consequence for F6 and FR-21 to FR-25:** a subagent's ask cannot rely on the hook's `systemMessage` to show the user its board. Candidates for the PO (task 5.1): the mod shows it (`$.ui.toast`, a status entry or a band, so only with mods on); the board's own notice in the browser of an already-open board; the subagent passes the link to the main conversation in its report (late); with mods off, a pull-only fallback where the main conversation lists open boards on its next turn.

## Criterion 18: the minimum version (task 4.2)

Criteria 1, 9 and 15 on `stable` 2.1.308, with the paths the spike recommends:

| Run | Criterion | Result on 2.1.308 |
| --- | --- | --- |
| `c9-fg-308` | 9 | pass: hook `agent_id`, mod `agentId` and the `session.send` target are one ID; 2/2 delivered |
| `c1-fg-append-308` (`-p`) | 1 | pass: 5/5 appended to a foreground subagent, all five in its report |
| `d-bg-append-308` | 1 | pass: 5/5 appended to a background subagent |
| `d-main-hybrid-308` | 1, 3 | pass: 5/5 read, max 12.5 s, one catch-up |
| `c15-stop2-308` (60 s poll, so the answer is pending at the stop) | 15 | pass: `stop_hook_active` false, block; then true, allow; nonce reported |
| `d-bg-append-308` | 15, AD-10 | **fail**: `SubagentStop` fired 6 times in 108 s while the background subagent was still working (17:29:44 to 17:31:35, about every 30 s) |

- **What rules out 2.1.308:** AD-10 reads `SubagentStop` as "the subagent finished": the guard blocks once for pending events and then closes the agent's asks with `agent-finished`. On 2.1.308 the hook fires while the agent works, so asks would be closed under a running agent, and the guard's block would be injected mid-task. This is the 2.1.311 CHANGELOG fix ("`SubagentStop` hooks now run once per subagent, when it finishes"). A foreground subagent of 100 s fired it once (`c1-fg-append-308`), so the old behaviour shows on background subagents.
- On 2.1.311 and `latest`, background subagents fire it only when they finish (the extra firing in some runs is the side agent of criterion 13, `agent_type` `''`).
- **Minimum: 2.1.311**, confirmed. No version between 2.1.308 and 2.1.311 was tested; 2.1.309 and 2.1.310 predate the fix by its CHANGELOG entry. `stable` was still 2.1.308 on 2026-10-29, so AD-18's release gate holds.
- `$.session.append`, `turn.step` and `$.prompt.read` all exist on 2.1.308, so the push paths set no higher minimum than the guard does.

## Criterion 7: an ask open 30 minutes or more (task 3.6, partial)

Runs `c7-312` and `c7-311`, interactive, auto mode, hybrid main path and append. Asked at 18:24:35, answered at 18:54:35 (30 minutes).

- **Main conversation: pass on both versions.** Before the answer, the stub (the same PID since 18:23:27) was alive and its session file present and unchanged (`-rw-------`, 542 bytes). The idle conversation was woken by submit and replied `GOT N-81974b84` (2.1.312) and `GOT N-3ce1bd34` (2.1.311). The stub exited only at shutdown (SIGINT, 18:58:35).
- **Background subagent: inconclusive, to rerun.** When the answer came, the subagent was no longer in `$.agent.list()` (`skip-finished`, status `absent`), so the mod correctly did not push, and the agent reported `NONCES: none`. Its 17 steps of `sleep 110` should have lasted past the answer. The rerun needs a subagent that is shown to be running when the answer arrives (log `$.agent.list()` just before, or answer at 25 minutes).

## Criteria 9 to 17: identifiers, loopback and protocol facts

Runs are headless (`-p`) unless stated, with the auto-answerer (`driver.ts auto`) answering each ask 8 s after it is asked, then every 12 s. Each run is named `c<criterion>-<case>-<version>`, and its logs are under `scratchpad/runs/<run>/`.

### Criterion 9: the hook's `agent_id` is the ID `$.session.send` accepts

| Run | Kind of agent | Hook `agent_id` | Mod `tool.call` `agentId` | `session.send` result | Nonce in that agent's transcript |
| --- | --- | --- | --- | --- | --- |
| `c9-fg-312` | foreground subagent | `a19c05fdf24e1b9a2` | same | `isDelivered: true` ×2 | yes ×2, as `attachment` `queued_command` |
| `c9-fg-311` | foreground subagent | `a15a2b48b17fa2ea7` | same | `isDelivered: true` ×2 | yes ×2, same form |
| `c1-bg-312` | background subagent | `aa130a0b7b4ea3e1d` | same | `isDelivered: true` ×2 | yes ×2, same form |

- In every run the `PreToolUse` input's `agent_id`, the mod's `tool.call` `e.agentId` and the ID `$.session.send({ to: { agentId } })` delivered to were one ID. The pushed text reached that subagent's own transcript (`subagents/agent-<id>.jsonl`), and no other transcript until the subagent's final report.
- The pushed text arrives as an attachment of type `queued_command` between two of the subagent's tool calls. The worker read and reported each nonce.
- Main conversation: no `agent_id` and no `agentId`, as F4 states. Its push path is `$.prompt.submit`, covered in criterion 1.

### Criterion 10: `$.http.fetch` reaches `127.0.0.1`, and whether it sends `Origin`

- **Reaches loopback:** yes, on both versions. Every mod poll reached the stub's local API (`c9-fg-312`: 58 polls, `c9-fg-311`: 58, `c1-bg-312`: 57).
- **Headers:** `accept`, `accept-encoding`, `connection`, `content-type`, `host: 127.0.0.1:<port>`, `user-agent: Bun/1.4.4` and the probe's token header. **No `Origin`**, on 2.1.311 and 2.1.312. AD-11's refusal of requests with a browser `Origin` does not affect the mod.
- **Unix socket (D3):** `$.http.fetch` with `socketPath` reaches the stub's 0600 socket on both versions (`c10-unix-312`, `c10-unix-311`: 29 requests each over the socket, `host: probe`, no `Origin`), and the answer was pushed as over TCP. A local API on a Unix socket in the 0700 session-file folder needs no port, and the file permissions guard it on top of the token.

### Criterion 11: a fallback when policy refuses `$.http.fetch`

- **Refusal:** with `probe-fetch-block` loaded beside the probe (a user-tier mod hooking `http.fetch`, standing in for an organization's policy mod), every probe request failed with `$.http.fetch: probe-fetch-block: network requests are refused by policy`, on both versions (`c11-block-tcp-312`, `c11-block-tcp-311`). Nothing reached the stub from the mod. The hooks are separate processes, so their records still arrived.
- **Fallback:** with `PROBE_TRANSPORT=process`, the mod polled by running `bun driver.ts events` through `$.process.run` (about 18 ms per poll). The answer reached the main conversation's queue 0.34 s after it was given (`c11-block-process-312`). `$.process.run` is not a network path, so neither a web-fetch policy nor an `http.fetch` hook covers it (admin page). The mod's delivery report still went through `$.http.fetch` and was refused. The product's fallback must send everything it says to the session process through the process client: polling, delivery reports and the version report. The same run on 2.1.311 (`c11-block-process-311`) behaved alike.
- **O7, a failed report must not repeat a push:** in the first fallback runs the probe advanced its watermark only after its report succeeded. With the report refused, it pushed the same answer on every poll: 21 `$.prompt.submit` calls on 2.1.312 and 18 deliveries on 2.1.311, each one waking the main conversation again. AD-3's idempotence keeps the agent's state right but not the cost: every duplicate is a wake-up. The rule for `mod`: an event counts as pushed once the push call is made, kept in the mod's own memory. The report to the session process is a separate step that can fail without causing a resend. After the fix (`c11-block-process2-312`): one push, with the report sent through the process client.
- **Cost:** one process start per poll. At a 1 s interval that is 3,600 short processes an hour per session. A `$.process.spawn` client kept alive for the session would avoid it. E1 decides, on the numbers.

### Criteria 12, 14, 16: processes, `tool_use_id` in `_meta`, client version

Every run so far on both versions (`protocol-facts.py`; `smoke-2`, `c9-fg-312`, `c1-bg-312`, `c1-main-submit-312`, `c10-unix-312`, `c9-fg-311`, `c1-bg-311`):

- **Criterion 12, processes per session:** one stub process per session. The SDK's protocol probe (`server/discover` with ID `server-discover-probe-1`) arrives on the session's own process, together with a regular `server/discover` (ID `0`), so F15's short-lived sibling does not occur in Claude Code. The method order is `server/discover`, `subscriptions/listen`, `server/discover`, `tools/list`, `tools/call`. Claude Code stops the server with SIGINT (O1). With SIGINT handled, no session file, socket or process was left behind after any run.
- **Criterion 14, `tool_use_id` in `_meta`:** every `tools/call` carries `_meta["claudecode/toolUseId"]`, equal to the `PreToolUse` input's `tool_use_id`, beside `progressToken` and the 2026-07-28 envelope keys (`io.modelcontextprotocol/protocolVersion`, `clientInfo`, `clientCapabilities`). Every ask bound by `tool_use_id`. AD-5's next-call rule is a fallback the observed versions never needed.
- **Criterion 16, client version:** every request's envelope carries `io.modelcontextprotocol/clientInfo` = `{name: "claude-code", version: "2.1.311" | "2.1.312", …}`. AD-18's protocol source is always present on these versions. The mod's report, through `$.session.version()`, gives the same value.

### Criterion 13: `CLAUDE_CODE_SESSION_ID` after `/clear`, `--continue` and `/resume`

Headless runs `c13-clean-312` and `c13-clean-311` use a first run, `--continue`, `--resume <id>` and `--resume <id> --fork-session`, each a new process. Interactive runs `c13i-312` and `c13i-311` stay in one tmux session: an ask, `/clear`, an ask and a push, `/resume` of the first conversation, then an ask and a push. All runs use a clean environment (`clean.sh`).

| Step | Server env `CLAUDE_CODE_SESSION_ID` | Hook env and input `session_id` | Mod `$.session.id()` | Lookup by key | Lookup by Claude Code PID |
| --- | --- | --- | --- | --- | --- |
| First run | S | S | S | found | found |
| `--continue` (new process) | **S′, a new ID** | S | S | **none: record lost, mod finds nothing** | found |
| `--resume S` (new process) | S | S | S | found | found |
| `--resume S --fork-session` | F | F | F | found | found |
| `/clear` (same process) | S (fixed at server start) | **C, a new ID** | **C** | **none** | found |
| `/resume S` after `/clear` (same process) | S | S | S | found | found |

Both versions gave the same table. Pushes after `/clear` and after `/resume` reached the main conversation on both (2 deliveries each).

- **AD-5's key breaks on `--continue` and after `/clear`.** On `--continue` the server is handed a fresh ID while the hooks, the mod and the transcript keep the continued session's ID. After `/clear` the server keeps the ID it started with while everything else moves to a new one. In both cases a lookup by `CLAUDE_CODE_SESSION_ID` finds no session file: no agent record, no ownership, no push. F13 is confirmed and extended: `--continue` diverges as well.
- **The PID of the Claude Code process works as the key in every case.** The server's parent PID, each hook's parent PID and the mod's `sh -c 'echo $PPID'` (through `$.process.run`, run once at `session.start`) were equal in every step on both versions. The mod API has no PID of its own (searched the 2.1.312 declarations), so the mod needs one `$.process.run`, which is CLI-only, the only surface AskBoard supports.
- **One server process lives through `/clear` and `/resume`.** The mod's timers survive `/clear` too (`session.end` with `reason: clear`, and no new `session.start`, as the reference states), so polling and pushing carry on.
- **The mod's environment:** in a clean launch `$.env.get('CLAUDE_CODE_SESSION_ID')` is undefined. In a nested launch it is the parent's ID (O5). The mod must never read it.
- **Side agents:** Claude Code's own side agents (the prompt-suggestion agent among them) fire `SubagentStop` with `agent_type: ''` and their own `agent_id`. AD-10's guard lets a stop through when the agent owns no open ask, so they are harmless. The guard must not treat an unknown agent as an error.
- **A failed start is cached across sessions:** when the probe server failed once (a missing variable), later sessions skipped it for about 15 minutes, with "a cached recent failure" in the model's view and an entry in `~/.claude/mcp-needs-auth-cache.json`. One failed start of AskBoard's session process would leave the next sessions without AskBoard's tools for 15 minutes. The packaging spike's launcher (missing executable, checksum failure) should fail by answering the handshake with an error rather than by exiting.

### Criterion 15: `stop_hook_active` in the `SubagentStop` input

Runs `c15-stop-312` and `c15-stop-311`: the mod's poll set to 10 minutes, so an answer given 3 s after the ask was still pending when the foreground subagent stopped.

| Version | First stop | Guard | Second stop | Guard | Nonce in the subagent's transcript |
| --- | --- | --- | --- | --- | --- |
| 2.1.312 | `stop_hook_active: false` | block, 1 pending | `stop_hook_active: true` | allow | yes, +7.2 s, as a `user` row with `isMeta: true` (the block reason) |
| 2.1.311 | `stop_hook_active: false` | block, 1 pending | `stop_hook_active: true` | allow | yes, +7.6 s, same form |

- The field is present and behaves as AD-10 assumes: false on a first stop, true on the stop that follows a block. The block's reason became the subagent's next input (F3), and the worker reported the nonce it carried.
- With `stop_hook_active` as the loop breaker, the guard needs no memory of its own to "never block twice". The product's guard still raises `received` when it carries events in a block (AD-3). The probe did not, which is why its second stop still counted 1 pending.

### Criterion 17: the hook `cwd` of `isolation: worktree` subagents

| Version | Hook `cwd` of the subagent's `probe_ask` | Push reached it |
| --- | --- | --- |
| 2.1.312 (`c17-worktree-312`) | `<project>/.claude/worktrees/agent-adfff84afaa0a258e` | yes, +4.2 s |
| 2.1.311 (`c17-worktree-311`) | `<project>/.claude/worktrees/agent-abac706e7b29fce72` | yes, +6.3 s |

- The hook `cwd` is the subagent's own worktree, named after its agent ID, so AD-12 can keep the hook `cwd` as the root source. F5 is settled for these versions.
- The worktree was gone after the run (`git worktree list` shows only the main checkout): Claude Code removes an unchanged subagent worktree when the subagent finishes. AD-12 already resolves excerpts at send time, so a board keeps its content. But a later `update` from another agent, or a Snapshot that reads files again, cannot rely on that root still existing. AD-15 builds Snapshots from board documents only, so it is unaffected.

## Documentation read (task 1.1, 2026-10-29)

The pages read were the mods overview, API, reference and admin pages under `https://code.claude.com/docs/en/plugins/mods/`, together with the `plugin-authoring` skill and the type declarations of 2.1.312. The table lists where they differ from, or add to, `research-cc-delivery-2026-10-27.md` §8 and §9, or what the design assumed.

| # | What the documentation says | Research or design said | Source | Consequence |
| --- | --- | --- | --- | --- |
| D1 | `$.session.send({ to: { agentId } })` to a subagent that **finished** resumes it from its transcript with the message. Only after a user interruption is it refused (`Agent "<id>" was not resumed`). | "A subagent that's still running receives the message" (§9): finished subagents were not covered | api, "What refused calls return"; types `SessionSendAddress` | The mod must never push to a finished subagent: a push would restart an agent the `SubagentStop` guard has let go, and AD-10 has already closed its asks with `agent-finished`. The mod checks `$.agent.list()` status before sending. Recorded for AD-4 (task 5.1). |
| D2 | A `WebFetch` deny rule or `CLAUDE_CODE_DISABLE_WEB_FETCH` does **not** stop `$.http.fetch`. Only an organization policy that disallows WebFetch does, or a policy mod hooking `http.fetch`. | F12: "policy that disallows WebFetch refuses `$.http.fetch`". Design decision 7 planned a `WebFetch` deny rule for criterion 11 | admin, "Know which controls still apply" | Criterion 11 is reproduced with a second probe mod that refuses `http.fetch` (design and task 2.2 amended). F12's wording is narrowed. |
| D3 | `$.http.fetch` takes `socketPath`, which sends the request over a Unix socket instead of TCP. | Not mentioned; AD-5 and AD-11 assume a loopback TCP listener | api, "Reach files, processes, and the network"; types `HttpInit` | Gives a candidate local API on a 0600 Unix socket in the session-file folder: the hooks can use it too, and no `Origin` and no port are involved. Probed beside the loopback check (task 2.2) as input to AD-11. |
| D4 | User-level switches: disabling the plugin stops all of it; `disableAllHooks` in user settings stops mods **and** settings hooks; `--safe-mode` stops every customization. Only managed `allowManagedModsOnly` stops mods while keeping settings hooks. | Design decision 7 looked for a user-level switch that stops only mods | overview, "Turn mods on or off"; admin, "Choose how much to allow" | Criterion 8 uses the probe variant with no hooks module, the fallback decision 7 already names. |
| D5 | A `/clear` fires `session.end` with `reason: 'clear'`, and no `session.start` follows. Timers started in `session.start` stop only when the module reloads. | §9 described polling with `$.clock.every` from `session.start` only | reference, "Session"; `plugin-authoring` reference | Whether the mod's poll survives `/clear`, and under which session ID, is part of criterion 13 (task 2.4). |
| D6 | `$.prompt.submit` waits until the session is idle, starts a new turn and resolves when that turn starts. After a user interruption it resolves `{ drop }` and queues nothing, until the user's next input (2.1.304+). | §9: "waits until the session is idle and then starts a new turn" | api, "Start a turn from a background job", "Calls and background work after the user interrupts a turn" | A push after Esc is dropped, not delayed. The mod must keep it and retry from `turn.complete`. The pull path covers it in the meantime. Recorded for AD-4 (task 5.1). |
| D7 | Under `-p`, a mod's `$.prompt.submit` is refused once `--max-turns` is reached (2.1.299+), and subagent turns started by a mod count toward it (2.1.304+). | F11: "`$.prompt.submit` can keep a run alive" | api, "Calls refused in `claude -p` runs" | Criterion 6 checks the refusal (`{ drop: 'the run reached its --max-turns limit' }`) on 2.1.311 and `latest`. |
| D8 | `$.prompt.read()` returns the draft in the prompt box and the cursor. | Not mentioned | types `prompt.read` | Criterion 2 can check from inside the mod that the user's draft survives a wake. The mod can also hold a push while the user is typing. |
| D9 | `$.session.id()` is asynchronous and returns the transcript file's name. `$.session.version()` returns the engine's version. | §9: `$.session.id` | types `session.id`, `session.version` | The mod can report the client version (criterion 16) without a protocol field. |
| D10 | Where managed settings exist, or the credential is a Team or Enterprise `/login`, the built-in guard `cc-plugin-sec-default` loads ahead of user mods. It skips their hooks on `classic.*` and some other events, and stops them from approving past `ask` and `deny` rules. | Not mentioned | admin, "Know what happens by default" | The probe mod hooks none of the skipped events. Task 1.4 records whether the guard loads on this machine. |
| D11 | An untrusted directory loads no mod until the trust prompt is answered. | Not mentioned | admin, "Know which controls still apply" | The scratch project must be trusted before each interactive run. |
| D12 | `turn.complete`, `turn.start` and `tool.call` carry `agentId` for a subagent. `$.agent.list()` gives `id`, `type`, `description` and `status` (`pending`, `running`, `waiting`, `idle`, `completed`, `failed`, `killed`). The classic events spell the same ID `agent_id`. | §9: `e.agentId` on `turn.*` and `tool.call` (2.1.299) | types `AgentInfo`; api | The types state that the classic `agent_id` and the mod's `agentId` are one ID. Criterion 9 still checks this end to end. |
| D13 | Not documented; observed. Under auto mode, a mod's `$.session.send` goes through the auto-mode classifier as a SendMessage, which refuses it for want of a model request (`gave no verdict for SendMessage`). A mod's `tool.check` hook is not consulted. | §9 and AD-4: `$.session.send` pushes to subagents | runs `d-*-312`, `d-*-311`, `d-bg-auto-self-*` (criterion 1) | Under auto mode, `session.send` reaches no subagent. AD-4's push path for subagents changes to `$.session.append` (below). Worth reporting upstream: a plugin-originated send has no request for the classifier to judge. |
| D14 | `$.session.append({ message, agentId? })` adds a user text row to the main conversation or to a running subagent's. The model reads it at that loop's next request. It starts no turn. | Not mentioned | types `SessionAppendArgs`; runs `d-*-append-*` (criterion 1) | The push path that works in every permission mode, and the only one that reaches the main conversation while a turn runs. An idle main conversation still needs `$.prompt.submit`. Recorded for AD-4 (task 5.1). |
