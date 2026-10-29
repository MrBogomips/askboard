# Findings: mod delivery spike

The exit criteria are in SOLUTION-DESIGN §10.1, and the approach is in `design.md`. Raw logs stay in the spike's scratch directory. Only excerpts appear here, with tokens and session IDs redacted.

## Verdicts

One row per exit criterion. `latest` is 2.1.312. Verdicts: **pass** (holds as the design assumed), **pass with change** (holds once a rule or path changes, named in the proposed outcomes), **fail**, **untested**, **pending** (a Phase 1 run still in progress). Linux: task 4.1 reruns criteria 10, 12 and 13 in a devcontainer; the other criteria are not planned on Linux (`design.md`, Non-Goals).

| # | Criterion | 2.1.311 | `latest` (2.1.312) | 2.1.308 | Linux | Verdict | Section |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | The right agent is reached | pass by append and the hybrid: subagents 5/5 (`c1-fg-append-311`) and 3/3 (`d-bg-auto-append-311`), main 3/3 and 5/5 (`d-main-auto-append-311`, `d-main-hybrid-311`); `session.send` 5/5 in default mode (`d-*-default-311`), refused under auto mode (D13) | the same (`c1-fg-append-312`, `d-bg-auto-append-312`, `d-main-auto-append-312`, `d-main-hybrid-312`, `d-*-default-312`); D13 in `d-fg-312`, `d-bg-312` | pass by append and the hybrid (`c1-fg-append-308`, `d-bg-append-308`, `d-main-hybrid-308`) | — | pass with change: append and submit replace `session.send` (row 1); load and interrupt checks pending | [§ Criterion 1](#criterion-1-every-kind-of-agent-is-reached) |
| 2 | An idle main conversation is woken without disturbing a draft | wake: pass (`c7-311`, `c13i-311`); draft: not run | pass, the draft stays unsent and unchanged (`c2-idle-312`; `c2-po-312` with the PO at the keyboard) | — | — | pass (draft checked on `latest` only) | [§ Criterion 2](#criterion-2-an-idle-main-conversation-with-a-draft) |
| 3 | Latency per kind of agent | `session.send` to subagents: median 8.9 s and 8.1 s; hybrid main: median 6.1 s, max 14.6 s (`d-*-default-311`, `d-main-hybrid-311`) | the same order at a 1 s poll; a 5 s poll adds at most its length (`d-main-hybrid-5s-312`, `d-bg-append-5s-312`) | hybrid main: max 12.5 s (`d-main-hybrid-308`) | — | pass: measured; the target is OQ2 (row 13) | [§ Criterion 3](#criterion-3-latency) |
| 4 | Extra tokens per answer | append: the same growth as on `latest` (`d-bg-auto-append-311`); send and pull not measured | append about +38 input; send about +108 input and +80 output; pull about +95 input, +89 output and one request (`tokens.py`, `c4-pull-312`) | — | — | pass: measured (row 14) | [§ Criterion 4](#criterion-4-tokens) |
| 5 | No permission prompt after installation | not run | pass (`c5-installed-312`) | — | — | pass (`latest` only) | [§ Criterion 5](#criterion-5-a-real-install-no-permission-prompt-task-34-with-the-pos-agreement) |
| 6 | `-p` with `--max-turns` | as on `latest` (`c6-during-max3-311`) | `-p` ends with the turn: a late answer is never pushed, and past `--max-turns` a queued submit is dropped (`c6-*-312`) | — | — | pass with change: F11 narrowed, append under `-p` (row 10) | [§ Criterion 6](#criterion-6--p-and---max-turns) |
| 7 | An ask open 30 minutes or more | main: pass (`c7-311`); background subagent: pending: Phase 1 run `c7b-311` | main: pass (`c7-312`); background subagent: pending: Phase 1 run `c7b-312` | — | — | pending (main conversation: pass) | [§ Criterion 7](#criterion-7-an-ask-open-30-minutes-or-more-task-36-partial) |
| 8 | The board link is visible for a subagent's ask with mods disabled | fail (`c8-nomod-311`) | fail (`c8-nomod-312`); with the mod on: pending: Phase 1 run `c8-toast-312` | — | — | fail (row 12) | [§ Criterion 8](#criterion-8-the-board-link-for-a-subagents-ask) |
| 9 | The hook's `agent_id` is the ID `$.session.send` accepts | pass (`c9-fg-311`) | pass (`c9-fg-312`, `c1-bg-312`) | pass (`c9-fg-308`) | — | pass | [§ Criterion 9](#criterion-9-the-hooks-agent_id-is-the-id-sessionsend-accepts) |
| 10 | `$.http.fetch` reaches `127.0.0.1`, and whether it sends `Origin` | pass, no `Origin`; a Unix socket too (`c9-fg-311`, `c10-unix-311`) | the same (`c9-fg-312`, `c1-bg-312`, `c10-unix-312`) | — | pending, 4.1 | pass (row 7) | [§ Criterion 10](#criterion-10-httpfetch-reaches-127001-and-whether-it-sends-origin) |
| 11 | A fallback when policy refuses `$.http.fetch` | pass by `$.process.run` (`c11-block-tcp-311`, `c11-block-process-311`) | pass (`c11-block-tcp-312`, `c11-block-process2-312`) | — | — | pass (rows 1 and 4) | [§ Criterion 11](#criterion-11-a-fallback-when-policy-refuses-httpfetch) |
| 12 | AskBoard processes per session, nothing left behind | one process, no sibling; nothing left once SIGINT is handled (`c9-fg-311`, `c1-bg-311`) | the same (`smoke-1` left its files without a SIGINT handler; `smoke-2`, `c9-fg-312`, `c1-bg-312`) | — | pending, 4.1 | pass with change: AD-2 adds SIGINT (row 5) | [§ Criteria 12, 14, 16](#criteria-12-14-16-processes-tool_use_id-in-_meta-client-version) |
| 13 | `CLAUDE_CODE_SESSION_ID` after `/clear`, `--continue` and `/resume` | the session-ID key is lost on `--continue` and after `/clear`; the PID key finds the file in every step (`c13-clean-311`, `c13i-311`) | the same (`c13-clean-312`, `c13i-312`) | — | pending, 4.1 | pass with change: key by the Claude Code PID (row 2) | [§ Criterion 13](#criterion-13-claude_code_session_id-after-clear---continue-and-resume) |
| 14 | `tool_use_id` in the MCP call's `_meta` | pass (`c9-fg-311`, `c1-bg-311`) | pass (`smoke-2`, `c9-fg-312`, `c1-bg-312`, `c1-main-submit-312`, `c10-unix-312`) | — | — | pass (row 3) | [§ Criteria 12, 14, 16](#criteria-12-14-16-processes-tool_use_id-in-_meta-client-version) |
| 15 | `stop_hook_active` in the `SubagentStop` input | pass (`c15-stop-311`) | pass (`c15-stop-312`) | the field: pass (`c15-stop2-308`); the hook fires while a background subagent works: fail (`d-bg-append-308`) | — | pass from 2.1.311 (row 6) | [§ Criterion 15](#criterion-15-stop_hook_active-in-the-subagentstop-input) |
| 16 | The client version in the protocol's client information | pass (`c9-fg-311`, `c1-bg-311`) | pass (the runs of criterion 14) | — | — | pass (row 11) | [§ Criteria 12, 14, 16](#criteria-12-14-16-processes-tool_use_id-in-_meta-client-version) |
| 17 | The hook `cwd` for `isolation: worktree` subagents | pass (`c17-worktree-311`) | pass (`c17-worktree-312`) | — | — | pass (row 8) | [§ Criterion 17](#criterion-17-the-hook-cwd-of-isolation-worktree-subagents) |
| 18 | The minimum version that passes all of the above | the minimum: every criterion run on it behaves as on `latest` | — | ruled out by criterion 15 (`d-bg-append-308`) | — | pass: 2.1.311 confirmed (row 11) | [§ Criterion 18](#criterion-18-the-minimum-version-task-42) |

**Summary:** 12 pass, 4 pass with change (1, 6, 12, 13), 1 fail (8), 1 pending (7), none untested. On `latest` only: the draft half of criterion 2, criterion 5, and the send and pull tokens of criterion 4. Pending Phase 1 runs: criterion 7's subagent half (`c7b-312`, `c7b-311`), criterion 8 with the mod on (`c8-toast-312`), and two risk checks for criterion 1 (`d-stress-312`, `d-stress-311`, `d-esc-312`).

## Failures and consequences

SOLUTION-DESIGN §10.1 has an "If it fails" row only for criteria 9 to 17. For the other failures, the quote is the text that assumed the opposite.

### D13: auto mode refuses the mod's `$.session.send` (criterion 1)

- **§10.1:** no row for criterion 1. Its "What changes otherwise" reads: "If criterion 1 fails for a kind of agent, a Monitor or `PostToolUse` adapter serves that kind (AD-4)."
- **What applies:** not that clause, because no kind of agent is left without push. `$.session.append` reached every kind of agent in every mode tested, on 2.1.308, 2.1.311 and `latest`, so no fallback adapter is needed (task 3.8). The mod's push paths change instead (row 1), and D13 goes upstream (row 15).

### Criterion 8: a subagent's board link is not shown to the user

- **§10.1:** no row. The criterion reads "The board link is visible for a subagent's ask with mods disabled [F6]". The spine's Consistency Conventions assume it: "A `PostToolUse` hook on `ask` shows it to the user as a system message, for the main conversation and subagents, with or without the mod."
- **What applies:** F6 is refuted for subagents. With mods off, a subagent's ask has no terminal link: the browser and the system notification remain. In a devcontainer, where "the terminal link is the notice that always works" (SOLUTION-DESIGN §8), a subagent's ask has no notice that always works. The mod can show the link (row 12; confirm with `c8-toast-312`).

### Criterion 6: `-p` ends with the turn

- **§10.1:** no row. SOLUTION-DESIGN §7 assumed the opposite: "`claude -p` loads AskBoard with `--plugin-dir` in an isolated configuration (…) with `--max-turns`, because `$.prompt.submit` can keep a `-p` run alive" [F11].
- **What applies:** F11 narrows. Only a submit queued before the turn ends keeps the run alive, for one woken turn, and `--max-turns` drops it. Pull covers headless runs: an agent that needs an answer waits in its turn with `collect`. The benchmark keeps `--max-turns` for another reason and reads transcripts, not the JSON `result` (row 10).

### Criterion 13: the session-ID key is lost on `--continue` and after `/clear`

- **§10.1, row 13:** "AD-5's key changes (a review suggested the PID of the Claude Code process, which is the parent of both the session process and the hook)".
- **What applies:** the row as written. The parent PID matched across the server, the hooks and the mod in every step on both versions (row 2). Linux: task 4.1.

### `--strict-mcp-config` drops plugin servers (task 1.4)

- **§10.1:** no row. SOLUTION-DESIGN §7 names the flag in the benchmark's "isolated configuration (`--setting-sources ""`, `--strict-mcp-config`, restricted `--tools`)", and AD-17 rests on that configuration: "Its server, hooks and mod are then the only extensions loaded".
- **What applies:** the benchmark cannot use the flag with `--plugin-dir`, and without it the account's connectors still load (row 9). The addendum's measurement protocol names the flag too.

### Other changes the criteria forced

- **Criterion 12, §10.1 row:** "—". The stub left its session file and socket behind until it handled SIGINT (O1). AD-2 adds SIGINT (row 5).
- **Criterion 15 on 2.1.308, §10.1 row:** "AD-10's condition changes". Not from 2.1.311, where the condition holds. It rules out 2.1.308 instead (criterion 18, row 11).

## Proposed outcomes (awaiting the PO)

Each row is a proposal until the PO records a decision. The replacement texts for each row are in `spine-update-draft.md`, beside this file; none applies before its row is accepted.

| # | Item | Evidence | Proposed decision | Alternative | PO decision |
| --- | --- | --- | --- | --- | --- |
| 1 | AD-4: the mod's push paths | Criterion 1 (D13, D14, the hybrid runs on 2.1.308, 2.1.311 and `latest`), criterion 3, D1, D6, O7 | The mod pushes by `$.session.append` to a running subagent, and to the main conversation while its turn runs; by `$.prompt.submit` when the main conversation is idle; and at `turn.complete` it submits again every answer appended after the turn's last request (`turn.step`). It drops `$.session.send` (D13). It never pushes to a subagent that has finished (D1). It keeps a submit dropped after an interrupt and retries it (D6). An event counts as pushed once the push call is made (O7). Pull stays authoritative. Confirm with `d-stress-312`, `d-stress-311` and `d-esc-312`. | Keep `$.session.send` for subagents outside auto mode: two paths, and send costs about +108 input and +80 output tokens against +38 for append. Or reach the main conversation by submit alone: about 70 s while a turn runs. | |
| 2 | AD-5: the session-file key and the mod's session ID | Criterion 13 (`c13-clean-*`, `c13i-*`), O5 | Name the session file by the PID of the Claude Code process: the parent PID of the session process and of each hook; the mod gets it once, at `session.start`, with one `$.process.run`. The launcher keeps Claude Code as the parent (it `exec`s the executable). The mod takes any session ID from `$.session.id()`, never from its environment. Confirm on Linux (task 4.1). | Keep `CLAUDE_CODE_SESSION_ID`, and lose push, ownership checks and the guard after `--continue` and `/clear` (pull covers it). Or look up by session ID first, then by PID. | |
| 3 | AD-5: binding a record to its call | Criterion 14 (O2); no `traceparent` in `_meta` in any run checked | No change to the rule: every call carried `tool_use_id` in `_meta["claudecode/toolUseId"]`, and the next-call rule stays as the fallback. SOLUTION-DESIGN §4.3, §7 and the addendum's K3 stop calling it unverified. | Drop the next-call rule: a call without `tool_use_id` stays unbound and unchecked. | |
| 4 | AD-5: the mod when `$.http.fetch` is refused | Criterion 11 (`c11-block-*`) | When `$.http.fetch` is refused, the mod sends everything through the AskBoard executable run as a client by `$.process.run`: polls, delivery reports and the version report. E1 chooses between one process per poll (3,600 an hour at a 1 s poll) and one `$.process.spawn` client per session, on the numbers. | AskBoard runs on pull alone where `$.http.fetch` is refused. | |
| 5 | AD-2: exit signal and start | O1, O4, O6; criterion 12 | Add SIGINT to the exit signals: Claude Code stops the session process with it. Keep the start rule, and note that it fires at connection: Claude Code sends `subscriptions/listen` right after the handshake, so the local API is up before the first ask's `PreToolUse` record needs it. No probe sibling occurs (F15). | Defer side effects to the first `tools/call`: the first ask's record, sent by its `PreToolUse` hook before the call, would find no session file. | |
| 6 | AD-10: the stop guard | Criterion 15 (`c15-stop-*`), criterion 18 (`d-bg-append-308`), criterion 13 (side agents) | No change to the condition from 2.1.311. Add: a stop from an agent with no record, such as Claude Code's side agents (empty `agent_type`), is let through without an error. | — | |
| 7 | AD-11: `Origin` and the local API's address | Criterion 10 (`c9-fg-*`, `c1-bg-312`, `c10-unix-*`), D3 | Record that the mod sends no `Origin`. Move the local API to a Unix socket, 0600, in the 0700 session-file folder: no TCP port, and file permissions on top of the token. Hooks and the process client use it too. Conditions: the Linux run of criterion 10 (task 4.1), and a socket path within the platform limit (104 bytes on macOS). | Keep the local API on loopback TCP, which passed on both versions; only the `Origin` note changes. | |
| 8 | AD-12: the root of a worktree subagent | Criterion 17 (`c17-worktree-*`) | No change to the root rule: the hook `cwd` is the subagent's own worktree (F5 settled). Add that Claude Code removes an unchanged subagent worktree when the subagent finishes; AskBoard reads files only at send time, so boards and Snapshots keep their content. | — | |
| 9 | AD-17 and SOLUTION-DESIGN §7: `--strict-mcp-config` | Task 1.4 (`smoke-strict`) | Drop the flag from the isolated configuration: with it, `--plugin-dir` loads no plugin server. The account's connectors then still connect, behind tool search and alike in every arm: the report lists the servers connected, and arms are compared by difference. Amend AD-17, §7 and the addendum's measurement protocol. | Keep the flag and load the server with `--mcp-config` beside `--plugin-dir` (hooks and mod from the plugin; tools named `mcp__askboard__*`, which the hook matchers accept). Untested. | |
| 10 | Criterion 6: `-p` and `--max-turns` (F11, AD-17, SOLUTION-DESIGN §7 and §8) | Criterion 6 (`c6-*-312`, `c6-during-max3-311`), D7 | Keep `--max-turns` in benchmark and CI runs as a bound on the turns the mod may start, no longer "because `$.prompt.submit` can keep a `-p` run alive". The benchmark reads transcripts, never `-p`'s JSON `result`, which a woken turn replaces. Headless agents wait for answers in their turn with `collect`. | — | |
| 11 | AD-18: the minimum version | Criterion 18 (the `*-308` runs), criterion 16 | Confirm 2.1.311: 2.1.308 fires `SubagentStop` while a background subagent works. `stable` was still 2.1.308 on 2026-10-29, so the release gate holds. The version comes from client information, present on every request; the mod's report stays the fallback. The Stack row drops "provisional". | — | |
| 12 | FR-21 to FR-25, F6: a subagent's board link | Criterion 8 (`c8-nomod-*`); no subagent's link on the main screen in any `d-bg-*` or `d-fg-*` run | The mod shows a subagent's board link: a toast when the ask arrives and a status entry with the open asks (`$.ui.toast`, `$.ui.status`; confirm with `c8-toast-312`). The `PostToolUse` system message stays for the main conversation's asks. With mods off, a subagent's ask has the browser and the system notification only; FR-23 and the Consistency Conventions say so. | With mods off, a main-conversation hook (for example on `UserPromptSubmit`) lists open boards at the user's next prompt (untested). Or the subagent passes the link in its report (late). | |
| 13 | PRD OQ2: the latency target | Criterion 3, per kind of agent, at 1 s and 5 s polls | Set it now: an idle main conversation within 2 s of the answer (measured 0.4–0.8 s); a working agent, main conversation or subagent, at its next model request after the answer, plus at most the poll interval (hybrid median 6.1 s, max 14.6 s, with 15 s tool steps). The early benchmark checks it. | Set it after the early benchmark; the Deferred row stays, reworded. | |
| 14 | The cost model's X for push (criterion 4, SOLUTION-DESIGN §7) | Criterion 4 (`tokens.py`; `c4-pull-312`, `c9-fg-312`, `d-bg-auto-append-*`) | Record in §7: by append, about +38 input tokens per answer and no extra request (the output reaction was not measured; for `session.send` it was about 80 tokens); by `collect`, about +95 input, +89 output and one extra request. The cost model's 100-question figures stay as they are, on the pull assumption. | Recompute the cost model with push. | |
| 15 | PRD R1 and the addendum: D13 | D13 and D14 (criterion 1) | Reword R1: the mod passed the spike; what remains is an organization disabling mods, and behaviour the mod relies on that is observed, not documented (D13 shows it can change). Mitigation unchanged, plus CI on the minimum, `stable` and `latest`. The addendum's "Plugin message" names append and submit. D13 is reported upstream: a plugin-originated `$.session.send` gives the auto-mode classifier no request to judge. | Leave R1 as it is until upstream answers D13. | |
| 16 | Packaging spike (SOLUTION-DESIGN §10.4): a failed start is cached | Criterion 13 (`~/.claude/mcp-needs-auth-cache.json`, about 15 minutes) | Add an exit criterion: a missing executable or a failed checksum reaches the user without Claude Code caching a failed start, which would leave later sessions without AskBoard's tools for about 15 minutes. Candidate: the launcher answers the handshake and reports the error, rather than exiting. | Leave it for the packaging spike to find. | |
| 17 | SOLUTION-DESIGN §13: the facts the spike checked | [Fact statuses](#fact-statuses-row-17), below | Set each status as listed there. | Per fact, below. | |
| 18 | The spine's Deferred rows, SOLUTION-DESIGN §12, and §10.1's outcome | [Deferred rows](#deferred-rows-row-18), below | Close or reword each row as listed there, and record the outcome in §10.1. | Per row, below. | |

### Fact statuses (row 17)

| Fact | Status now | Proposed status | Evidence | PO decision |
| --- | --- | --- | --- | --- |
| F1 | (primary source, 2026-10-27) | On 2026-10-29: `latest` 2.1.312, `stable` still 2.1.308 | Method | |
| F2 | (primary source) | Confirmed: 2.1.308 fired `SubagentStop` about every 30 s while a background subagent worked; 2.1.311 and `latest` fire it once, at finish | Criterion 18 | |
| F3 | `stop_hook_active` unverified | Verified on 2.1.311 and `latest`: false on a first stop, true after a block; the block's reason became the subagent's next input | Criterion 15 | |
| F5 | partly unverified | Verified: an `isolation: worktree` subagent's hook `cwd` is its own worktree, removed when it finishes unchanged | Criterion 17 | |
| F6 | partly unverified | Refuted for subagents: their message goes to the subagent's transcript, not to the user; shown for the main conversation | Criterion 8 | |
| F9 | (primary source) | Narrowed: auto mode refuses a mod's `$.session.send` (D13); `$.session.append` reaches running agents, attributed to the plugin (D14) | Criterion 1 | |
| F11 | (primary source) | Narrowed: a submit keeps a `-p` run alive only when queued before the turn ends, for one woken turn, within `--max-turns` | Criterion 6 | |
| F12 | unverified | Verified: the hook's `agent_id` is the ID `$.session.send` takes (criterion 9); `$.http.fetch` reaches `127.0.0.1` without `Origin` (criterion 10). Narrowed: a `WebFetch` deny rule does not refuse `$.http.fetch`; an organization policy or a policy mod does (D2) | Criteria 9, 10, 11 | |
| F13 | `/resume` unverified | Verified and extended: the server's ID diverges from the hooks' and the mod's on `--continue` and after `/clear`, and agrees after `/resume`; the Claude Code PID is common to all | Criterion 13 | |
| F15 | unverified for Claude Code | Refuted for Claude Code: the SDK's probe arrives on the session's own process | Criterion 12 | |
| F16 | unverified | Verified: `tool_use_id` in `_meta` as `claudecode/toolUseId`; no `traceparent` | Criterion 14 | |
| F17 | presence unverified | Presence verified: `claude-code` and its version in every request | Criterion 16 | |
| F25 | Monitor routing unverified | Unchanged: not probed; no fallback adapter needed | Task 3.8 | |

### Deferred rows (row 18)

| Spine Deferred row, or other text | Proposed | Condition | PO decision |
| --- | --- | --- | --- |
| "Push transport confirmed (…); else Monitor watch or a `PostToolUse` hook as further adapters" | Close: the mod reaches every kind of agent with append and submit (row 1); no further adapter | Runs `c7b-*`, `d-stress-*` and `d-esc-312` confirm | |
| "Latency target for answers reaching a working agent (PRD OQ2, product owner)" | Close if row 13 sets the target now; otherwise reword: measured per kind of agent, revisited at the first benchmark run | Row 13 | |
| "Minimum Claude Code version; behaviour of the session-file key after `/clear`, `--continue` and `/resume`" | Close: 2.1.311 confirmed (row 11); key by the Claude Code PID (row 2) | The Linux run of criterion 13 (task 4.1) | |
| SOLUTION-DESIGN §12, "Architecture spikes" and "Product owner" | Drop the mod delivery items; drop the latency target if row 13 sets it | Rows 13 and 18 | |
| SOLUTION-DESIGN §10.1 | Add an "Outcome" paragraph | The rows it cites | |

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

  The appended row is a user text row in the target loop's transcript. It carries `origin: {kind: "plugin", name: "probe"}` and `isMeta: true`, so it is attributed to the mod (`d-main-auto-append-312`, `c1-fg-append-311`, `d-bg-auto-append-311`). It can sit between a `tool_use` and its `tool_result` in the file, and the engine still builds valid requests from it (every run completed). It is not subject to SendMessage's review, so it is the push path that works under auto mode.
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

#### Append under load

Pending: runs `d-stress-312`, `d-stress-311`.

#### Interrupt, then push (D6)

Pending: run `d-esc-312`.

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

## Criterion 7: an ask open 30 minutes or more (task 3.6, partial)

Runs `c7-312` and `c7-311`, interactive, auto mode, hybrid main path and append. Asked at 18:24:35, answered at 18:54:35 (30 minutes).

- **Main conversation: pass on both versions.** Before the answer, the stub (the same PID since 18:23:27) was alive and its session file present and unchanged (`-rw-------`, 542 bytes). The idle conversation was woken by submit and replied `GOT N-81974b84` (2.1.312) and `GOT N-3ce1bd34` (2.1.311). The stub exited only at shutdown (SIGINT, 18:58:35).
- **Background subagent: inconclusive, to rerun.** When the answer came, the subagent was no longer in `$.agent.list()` (`skip-finished`, status `absent`), so the mod correctly did not push, and the agent reported `NONCES: none`. Its 17 steps of `sleep 110` should have lasted past the answer. The rerun needs a subagent that is shown to be running when the answer arrives (log `$.agent.list()` just before, or answer at 25 minutes).
- **Why the subagent had finished: Claude Code refused its steps, not the push.** On both versions it refused the worker's `sleep 110` steps (`Blocked: standalone sleep 110 …` in both subagent transcripts): the 2.1.312 binary refuses a standalone `sleep` of 25 s or more (constant `mLr=25`). Each subagent finished after about 12 s (11.99 s on 2.1.311, 12.65 s on 2.1.312, from its first to its last transcript row). Push did not fail. The rerun chains four `sleep 24` per step.
- **Rerun:** pending: runs `c7b-312`, `c7b-311`.

## Criterion 8: the board link for a subagent's ask

### Without mods

Probe variant with no hooks module (`hooks.json` without `modules`, D4), interactive, auto mode: `c8-nomod-312`, `c8-nomod-311`. A background subagent asks once.

- **Fails on both versions.** The `PostToolUse` hook ran and returned `{"systemMessage": "probe board for c8-bg: http://127.0.0.1:<port>/b/c8-bg"}` (debug log: `Hook PostToolUse:mcp__plugin_probe_probe__probe_ask (PostToolUse) success`), but the main screen never showed it. The engine filed it in the subagent's own transcript as a `hook_system_message` attachment, which the model reads and the user does not see.
- **It is not caused by disabling mods.** No interactive run with the mod loaded showed a subagent's link on the main screen either (`d-bg-*`, `d-fg-*`, both versions; interactive sessions run every subagent in the background, criterion 1). For an ask from the main conversation the link does show (`c2-idle-312`: `PostToolUse:mcp__plugin_probe_probe__probe_ask says: probe board for c2-idle: …`).
- **Consequence for F6 and FR-21 to FR-25:** a subagent's ask cannot rely on the hook's `systemMessage` to show the user its board. Candidates for the PO (task 5.1): the mod shows it (`$.ui.toast`, a status entry or a band, so only with mods on); the board's own notice in the browser of an already-open board; the subagent passes the link to the main conversation in its report (late); with mods off, a pull-only fallback where the main conversation lists open boards on its next turn.

### With the mod on

Pending: run `c8-toast-312`.

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
- **Criterion 14, `tool_use_id` in `_meta`:** every `tools/call` carries `_meta["claudecode/toolUseId"]`, equal to the `PreToolUse` input's `tool_use_id`, beside `progressToken` and the 2026-07-28 envelope keys (`io.modelcontextprotocol/protocolVersion`, `clientInfo`, `clientCapabilities`). Every ask bound by `tool_use_id`. AD-5's next-call rule is a fallback the observed versions never needed. No call in these runs carried `traceparent` (the stub logs the whole `params`).
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
