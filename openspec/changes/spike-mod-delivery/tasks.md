# Tasks

## 1. Probe and environment

- [x] 1.1 Read the current mods documentation (overview, API, reference, admin) and the `plugin-authoring` skill. In `findings.md`, write the method section (versions, platform, isolated configuration, nonce rule) and list every difference from `research-cc-delivery-2026-10-27.md` §8 and §9. Verify that each listed difference cites its documentation page.
- [x] 1.2 Install Claude Code 2.1.311 and 2.1.308 under `<scratch>/cc-<version>` with `npm install --global --prefix`. Verify with `<prefix>/bin/claude --version` for both and `claude --version` for `latest`, and record the three versions in `findings.md`.
- [x] 1.3 Write `probe/` as design decision 1 lays it out: plugin manifest, `hooks/hooks.json`, `server.ts` (`@modelcontextprotocol/server` 2.4.0 pinned exactly, its own lockfile, a local API on `127.0.0.1` with a token, the session file in a 0700 folder, request log), `hook.ts`, `mod.js`, `driver.ts`, one agent definition and the agent prompts. Verify that `bun install --frozen-lockfile` works in `probe/`, that `driver.ts` can append an answer and read it back from a running stub, and that `bun run check` at the repository root still passes.
- [x] 1.4 Create the scratch git project and run one `-p` smoke session on `latest` with the isolated configuration, which tells whether `--strict-mcp-config` keeps plugin servers (design decision 2). Verify that the logs show the stub's start, a `PreToolUse` record bound to its call, the mod's `session.start` and one mod poll, and record the loading mode chosen in `findings.md`.

## 2. Identifiers, loopback and protocol facts (criteria 9 to 17, on 2.1.311 and `latest`)

- [x] 2.1 Criterion 9: from a main conversation and from both kinds of subagent, compare the hook's `agent_id`, the mod's `tool.call` `e.agentId` and the IDs from `$.agent.list()`, then send a nonce with `$.session.send` to the hook's ID. Verify by the nonce in the right subagent's transcript, and record the verdict per version.
- [x] 2.2 Criteria 10 and 11: log the headers of every mod request to the local API, `Origin` included, over loopback TCP and over the Unix socket (`socketPath`). Then load a second probe mod that refuses `http.fetch` (`findings.md` D2), and try `$.process.run` of the probe as a client. Verify each outcome from the stub's request log, and record the verdict per version.
- [x] 2.3 Criteria 12, 14 and 16: from the stub's log, record the server processes started per session (PID, parent PID, the requests each received), the `_meta` of each `tools/call`, and the client information in the handshake. After the session exits, look for leftover processes and session files. Verify with `ps` output and the log excerpts in `findings.md`.
- [x] 2.4 Criterion 13: record `CLAUDE_CODE_SESSION_ID` as the server and the hooks see it, the hook input's `session_id`, the mod's `$.session.id`, and the PID of the Claude Code process, at start and after `/clear`, `--continue` and `/resume`. Check whether the hooks and the mod still find the session file after each. Verify with a table in `findings.md`, one row per step and version.
- [x] 2.5 Criteria 15 and 17: log the `SubagentStop` input (with `stop_hook_active`, first stop and after a block), and the hook `cwd` of an `isolation: worktree` subagent against the worktree path. Verify with the log excerpts in `findings.md` and the verdict per version.

## 3. Delivery (criteria 1 to 8, on 2.1.311 and `latest`)

- [x] 3.1 Criterion 1: in tmux sessions, have the main conversation, a foreground subagent and a background subagent ask and keep working, then push 5 answers to each. Verify reception by the nonce rule (design decision 4) and record the reached and misrouted counts per kind of agent and version.
- [x] 3.2 Criterion 2: leave the main conversation idle, type a partial prompt without submitting it, push an answer, and check that the text stays unsent and the woken turn waits. Then repeat one run with the product owner at the keyboard. Verify with `capture-pane` excerpts and the product owner's confirmation in `findings.md`.
- [x] 3.3 Criteria 3 and 4: from the runs of 3.1 and 3.2, at poll intervals of 1 s and 5 s, compute `t3 − t0` per kind of agent (median and maximum, at least 5 samples), and the extra tokens per answer for push against a pull delivery of the same answer (design decision 5). Verify that each number names the runs and transcripts it comes from.
- [x] 3.4 Criterion 5: with the product owner's agreement, install the probe from a local directory marketplace at local scope in the scratch project, run one ask from a main conversation and one from a subagent, then uninstall it and remove the marketplace. Verify that no permission prompt appeared (`capture-pane`) and that the user's configuration no longer lists the probe.
- [x] 3.5 Criterion 6: run `claude -p --max-turns <n>` with an ask whose answer arrives by push after the agent has finished. Verify, from the exit code, the duration and the transcript, whether `$.prompt.submit` keeps the run alive and whether `--max-turns` bounds it.
- [x] 3.6 Criterion 7: keep an ask open for at least 30 minutes, from a main conversation and from a background subagent, then answer it. Verify that the push still arrives, the stub process is still alive and the session file is still valid, with timestamps in `findings.md`.
- [x] 3.7 Criterion 8: with the probe variant that has no hooks module (design decision 7, `findings.md` D4), check that a subagent's ask still shows the board link to the user through the `PostToolUse` `systemMessage` [F6]. Verify with a `capture-pane` excerpt.
- [x] 3.8 Only for a kind of agent that fails 3.1, or when 2.2 fails: probe the Monitor watch and `PostToolUse` `additionalContext` adapters on that kind (design decision 6). Verify reception by the nonce rule, and record the latency and the permission prompts. If nothing fails, record "not needed" in `findings.md`.

## 4. Linux and the minimum version

- [ ] 4.1 Repeat criteria 10, 12 and 13 on Linux in a devcontainer on `latest`. Verify with the same evidence as 2.2 to 2.4 and record the verdicts beside the macOS ones. Awaiting the PO: the model runs need the PO's token, and run after the merge (`findings.md`, Linux harness).
- [x] 4.2 Run criteria 1, 9 and 15 on 2.1.308 to show what fails below the provisional minimum, and derive criterion 18, the lowest version that passes all criteria. Verify that `findings.md` states the minimum and the criterion that rules out each lower version tested.

## 5. Decisions and the spine

- [x] 5.1 Complete `findings.md`: the per-criterion verdict table, the latency and token tables, the failures with their consequence from §10.1's table, and a proposed outcome for each AD, fact and Deferred row. Present them to the product owner. Verify that every criterion has a verdict on both versions, and that every proposed outcome has the product owner's decision recorded beside it.
- [x] 5.2 Apply the decisions: amend the ADs concerned in place (AD-4, AD-5, AD-10, AD-11, AD-12, AD-18, as decided), update the Stack's Claude Code minimum, close or reword the three Deferred rows, set `updated:`, update SOLUTION-DESIGN §10.1 (outcome), §12 and §13 (status of F3, F5, F6, F12, F13, F15, F16, F17, F25), and the PRD (OQ2, R1) if the product owner decided changes there. Verify with `openspec validate --all --strict --no-interactive` and `bun run check`, and with a grep showing that no Deferred row still names the mod delivery spike as pending.

## Workflow follow-up

- Open the pull request, check that CI passes, squash-merge after the product owner approves, then archive the change on main and remove the worktree and its branch.
- E1 builds `mod`, `hooks` and the local API on the decisions recorded here. When the product owner sets OQ2's target, it feeds the benchmark.
- Mark phase 1's mod delivery spike done on the "AskBoard Implementation Roadmap" page (and phase 0, still pending).
