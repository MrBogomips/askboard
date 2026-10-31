# Proposal

## Why

R5 says the plain-question target is at risk: AskBoard's tool definitions and the tool search before a session's first ask add cost and time that AskUserQuestion does not pay, and no budget is set. Its mitigation is to run the benchmark early and act on the results. E1 puts one plain question through every layer by pull, so the early benchmark can measure that question against AskUserQuestion (SM-1 to SM-4) the moment E1 lands. It also decides `alwaysLoad` for `ask` (spine, Deferred), and checks the answer-delivery target the PO set on 2026-10-30 for the pull path (PRD OQ2).

## What Changes

- **`bench`**, built against E1's contract: the `ask` and `collect` sets and the board protocol, imported from `@askboard/contract` (AD-1, AD-7).
- **Cases E1 can run** (SOLUTION-DESIGN §7, seed set):
  - **S1**, a plain single choice. One session asks two plain questions one after the other: the first is the cold ask, tool search included, and the second is the warm ask. It runs in both arms, AskBoard and AskUserQuestion.
  - **S6**, S1 asked from a subagent, AskBoard only.
  - **A baseline for S1:** the AskBoard arm's command and prompt without AskBoard, ended after its first request. The two first requests then differ only by AskBoard, which the AskUserQuestion arm cannot show, since its first request carries AskUserQuestion's own definition.
  - S2 to S5 and S7 wait for the epics that bring several questions per ask and widgets.
- **The runner:** `claude -p` with the pinned settings of the addendum's measurement protocol, in the isolated configuration of AD-17 (AskBoard loaded with `--plugin-dir`, without `--strict-mcp-config`, with `--max-turns`). Each case runs 5 times in its own scratch project, under a per-run timeout. The run leaves no process behind, also when the user stops the benchmark: it then keeps a report of the runs that ended.
- **The scripted user:**
  - A board answerer that the session process starts as the `BROWSER` command. It loads the board through the board protocol the way the board page does, records when the question reached it, and answers the scenario's option.
  - A scripted AskUserQuestion answerer: a `PreToolUse` hook registered only in the run's settings, with a permission host for `-p`.
- **The measurement** (addendum, "Measurement protocol"; FR-32, FR-33):
  - K1 and K2 per question from transcript usage, deduplicated by `requestId`, the preparing responses included.
  - K3 from the start of the request that emits the ask, with its splits.
  - The context AskBoard adds before the first ask, against the baseline, and what tool search loads in the session.
  - X and A for the cost model.
  - The time from an answer to the agent that waits for it in `collect`.
  - Runs whose answer never reached the agent, whose question deviated from the scenario, that sent two asks in one response, or that timed out or were stopped are excluded and listed (fail closed).
- **The report** under `.askboard/bench/<run>/`, as JSON and Markdown. It states the settings it ran with and how AskBoard was loaded, and lists the MCP servers each arm connected. It states the counting rules and the cost model, and gives medians with their spread. It gives the cost of 100 questions for the run's model and cache setting, and checks each plain-question KPI against SM-1 to SM-4.
- **Commands:**
  - `run`, the benchmark;
  - `smoke`, a check without any model: a scripted MCP client asks S1's question on the session process and the board answerer answers it;
  - `report`, which rebuilds a report from a finished run.
- **A stub session process** for the harness's tests. It speaks E1's contract over stdio and serves the board protocol on loopback. One setting, `--session stub` or `--session e1`, switches every command between the stub and E1's real session process.
- **A spine and addendum update draft** (`spine-update-draft.md`): what the early benchmark does differently from AD-17 and the measurement protocol until benchmark mode exists. The PO applies it.
- **Not in this change:** benchmark mode in the session process, with its per-run secret, the scripted answer appended by `ask-core` and the render beacon (AD-10, AD-17). A headless browser driver, deferred to the benchmark epic in the spine's Deferred table. Freehand HTML as an arm. CI runs of the benchmark. The PO's model runs, which are listed in tasks.md as awaiting the PO.

## Capabilities

### New Capabilities

- `benchmark`: the shipped benchmark and its scripted user. It covers the cases, the pinned settings and the isolated configuration, the scripted answerers, the counting rules, the cost model and the report (AD-17; SOLUTION-DESIGN §3.1, "benchmark").

### Modified Capabilities

None: `openspec/specs/` is empty, and E1's capabilities are still in flight.

## Impact

- **Code:** `packages/bench` only: its sources, its tests, the stub session process and a stand-in `claude` for the runner's tests.
- **Dependencies:** none added to the repository.
  - `bench` imports `@askboard/contract`, as AD-1 allows. It type-checks with `@types/bun`. Until E1's Integration both resolved through the root's development dependencies, since declaring them would have changed the frozen lockfile (open question 9).
  - After the rebase onto E1's Integration, `packages/bench/package.json` declares both, and `bun.lock` gains that entry only.
- **Documents:** none edited. `spine-update-draft.md` in this change's folder carries the spine and addendum changes for the PO.
- **Requirements served:** FR-32 and FR-33, as far as E1 reaches; NFR-1 (the context added before the first ask); NFR-9 (results stay on the machine); SM-1 to SM-4 for plain questions; R5; PRD OQ2 for the pull path.
- **Runs:** each S1 run costs one Claude Code session with two plain questions; S6 adds a subagent. Five runs per case and arm: 15 sessions by default, plus 5 baseline sessions of one request each.

## Open questions for the PO

The PO asked for the work to continue without waiting. Where the documents leave a choice open, this change takes the narrowest reading that runs on E1. Each choice is recorded here for review.

1. **Cases.** S1 and S6 only. S1's second question, on schema migrations, is new; the first is the approved plain-choice example. The fixed set stays PRD OQ3. S1 for AskUserQuestion alone, and S2 for AskUserQuestion alone, would have no AskBoard counterpart on E1.
2. **Cold and warm in one session.** Each S1 run asks two questions, one after the other. The first ask is the cold row, the second the warm row. *Alternative:* separate sessions for warm runs, at twice the cost.
3. **The AskUserQuestion arm loads no AskBoard.** E1 has no hooks, so there is no asking rule to set (AD-16, AD-17). The context AskBoard adds is measured against the baseline, whose first request differs from the AskBoard arm's only by AskBoard; the AskUserQuestion arm's first request also carries AskUserQuestion's definition, so it is shown for information only. *Alternative:* load AskBoard in both arms, without a baseline.
4. **Answering through the board protocol.** E1 has no benchmark mode. Its notifier starts `BROWSER` with the link, so the early benchmark answers as the board page would: the token first, then the answer command. The answers are not marked scripted. AD-17's single path, the scripted answer that `ask-core` appends in benchmark mode, replaces this one when benchmark mode comes (spine-update-draft.md).
5. **t3 is approximated.** Without a render beacon, K3 for AskBoard ends at t3′: the board document and the open question state have reached the scripted answerer. t3′ excludes rendering and includes the answerer's start-up. The report labels it so.
6. **K3 starts at the emitting request**, as the protocol defines it. The time of the preparing responses, such as the tool search, is reported beside it, since R5 names that time.
7. **The join key is the ask ID.** E1 records no `tool_use_id`, so the answerer's times join the transcript by the agent's ask ID.
8. **A permission host in the AskUserQuestion arm** (addendum: "with a permission host under `-p`"). It is a small MCP server, without the MCP SDK, which `bench` does not declare. It speaks only the 2025 handshake, so that arm runs with `MCP_PROTOCOL_NEGOTIATION=legacy` (F27). Neither is tested with Claude Code yet; `--auq-permission-host off` turns it off.
9. **Undeclared dependencies.** `@askboard/contract` and `@types/bun` resolve through the root, as described under Impact. A test keeps `bench`'s sources free of Bun-only APIs (AD-19).
10. **Pinned defaults.**
    - Model `claude-opus-5-5`, with effort `medium` (Claude Code's default; the research's baseline ran mostly at `xhigh`).
    - Cache TTL 5 minutes (`FORCE_PROMPT_CACHING_5M=1`).
    - `ENABLE_TOOL_SEARCH=true`, the default made explicit.
    - `--max-turns 12` and a 300 s timeout per run.
11. **Cost model inputs.**
    - X: the output of the requests that call `collect`, and of a tool search between the ask and its last `collect`.
    - A: the input growth over the asking flow's tool results, the `ask` result included.
    - T: the first-request difference from the baseline plus what tool search loads in the session.
    - Per question, a 10-question session is 1 cold ask and 9 warm asks.
12. **OQ2 on the pull path.** The report gives the time from the answer to the `collect` result in the transcript, against the 2 s target for an idle conversation. The push targets wait for E4.
13. **Retries and batches.** An identical ask sent again right after the first (same ask ID or same question) is a retry: its response counts in that ask's K1 and K2, as the addendum's "retries count" says. Two asks in one response break the scenario's one-at-a-time order, so the run is invalid. *Alternative:* divide a shared response across its asks as a batched ask.

**Answer (PO, 2026-10-31):** accepted as proposed, all thirteen choices; none reversed.
