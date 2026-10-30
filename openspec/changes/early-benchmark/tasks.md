# Tasks

Each group writes its tests first and verifies that they fail before it implements (the repository's TDD rule). "Check passes" means `openspec validate --all --strict --no-interactive` and `GITHUB_TOKEN=$(gh auth token) bun run check`. Each group ends with its commit (`feat(bench): …`). No task starts `claude` or calls a model: the model runs are group 8, awaiting the PO.

## 1. Cases, plans and settings

- [ ] 1.1 Set `packages/bench/tsconfig.json` to compile `src` with Bun's types (design decision 1), and write the AD-19 test first: it fails on `Bun.` or a `bun:` import under `packages/bench/src/`. Verify that it fails on a planted line and passes on the clean sources.
- [ ] 1.2 Write tests first, then `scenarios.ts`: the two plain questions (the approved plain-choice example and the migrations question), cases S1 (both arms, asks 1 cold and 2 warm) and S6 (AskBoard, one ask from a subagent), each question's answer plan, and the prompts of design decision 15. Verify that both arms' S1 prompts hold the same question block and differ only in the tool sentences, and that no prompt names an ask ID or a full tool name.
- [ ] 1.3 Write tests first, then `settings.ts`: the defaults of proposal open question 10, parsing the `run`, `smoke` and `report` options, and refusal of an unknown option, case, arm, effort, TTL or a run count below 1, each naming the option. Verify that the tests pass.

## 2. Stdio JSON-RPC, the stub session process and the scripted MCP client

- [ ] 2.1 Write tests first, then `mcp/jsonrpc.ts` (design decision 7): newline framing over a pair of streams, request IDs, notifications, an error for an unknown method, a parse error for a malformed line, and the 2025 `initialize` handshake on both sides. Verify that the tests pass over in-memory streams.
- [ ] 2.2 Write tests first, then the stub in `packages/bench/test/stub/` (design decision 13): `tools/list` equal to the contract's definitions; `ask` and `collect` results that validate against the contract's envelopes; `unavailable` without `BROWSER`; the board protocol with the token first, `Origin` checked, the answer checked and logged, the receipt; discard at exit. Verify with the contract's validators on every result and message.
- [ ] 2.3 Write tests first, then `agent.ts`, the scripted MCP client: start a server command, open it with `initialize`, list the tools, call `ask` and `collect` with `wait`, and close it so that the server exits. Verify against the stub as a subprocess, with no process left after the test.

## 3. The scripted user

- [ ] 3.1 Write tests first, then `redact.ts`: a board token in a link's `t=` parameter and in a `connect` message is replaced with `<redacted>`, and other text is left as it was. Verify that the tests pass.
- [ ] 3.2 Write tests first, then the board answerer (design decision 5) and its entry: the stamps in order, the `Origin` header, a validated `board` and open `state` before the answer, the plan's label at the question's `rev`, `matched: false` on a deviated question, no answer on a message outside the contract, a record without the token or the link, and an exit within its deadline. Verify in process against the stub's board, and once as the stub's `BROWSER` through `browser.sh`.
- [ ] 3.3 Write tests first, then the AskUserQuestion answerer's hook entry and the permission host (design decision 6): the hook's output for the plan's labels, `allow` with `updatedInput`, a record without question text; the permission host's `tools/list` and an `approve` call adding the answers. Verify by running the hook entry on a recorded input, and the permission host through `agent.ts`.

## 4. Transcripts and measurement

- [ ] 4.1 Write tests first, then `transcript.ts` (design decision 8), on fixture transcripts in the observed layout: grouping by `requestId` with usage counted once, t0 from the parent entry, t1 from the `tool_use` entry, tool results by `tool_use_id`, total input, observed TTL, model, version and effort, and finding the main and subagent transcripts by session ID. Verify that the tests pass.
- [ ] 4.2 Write tests first, then `measure.ts` (design decision 9): asks and failed attempts in each arm, preparing responses (tool search, a failed attempt, the stop at the previous ask and at a text-only request), K1, K2 and K3 with their splits and prep time, X, A, the context figures, the answer-to-agent time, and each validity reason in its order. Verify that the tests pass, a cold ask after a tool search and a warm ask included.

## 5. Statistics, cost model and report

- [ ] 5.1 Write tests first, then `stats.ts` and `cost.ts` (design decision 10): median, p90, minimum and maximum; the cost model on the addendum's worked inputs giving 5.02, 58.55 and 3.49 USD on Opus 5.5 and 2.51, 29.28 and 1.74 on Sonnet 5.5, the TTL line's 28.80 and 14.40; the cold and warm mix; a missing input named; an unpriced model. Verify that the tests pass.
- [ ] 5.2 Write tests first, then `report.ts`: rows S1 cold, S1 warm and S6 per arm with n valid of n run, medians and spread, the targets' ratios, the context added, the cost, the answer-to-agent time against 2 s, the settings, observed values and their differences, the MCP servers and plugins each arm loaded, the invalid runs with reasons, and the counting rules and the cost model stated. Then the Markdown rendering of the same. Verify on measurements built in the test.

## 6. Runner and commands

- [ ] 6.1 Write tests first, then `plugin.ts` and `command.ts` (design decisions 3 and 4): the plugin directory per session, the server it declares, the preflight refusals (missing manifest, unbuilt E1 server, a pinned version that differs), and each arm's argv, environment, `run-settings.json`, `mcp.json` and `browser.sh`. Verify that the AskBoard argv has `--plugin-dir` and no `--strict-mcp-config`, and that the environment holds nothing the user's had beyond the listed variables.
- [ ] 6.2 Write the stand-in `claude` (design decision 14), then tests first for `run.ts` and the `run` command (design decisions 2, 11 and 12): with one run per case on the stub, the report has every row and no invalid run; a hung run is stopped at its timeout with its process group; nothing in the run's folder holds a token; `bench/.gitignore` holds `*`. Implement. Verify that the tests pass and that no process is left after them.
- [ ] 6.3 Write tests first, then the `smoke` and `report` commands: `smoke --session stub` prints the answer and the answerer's times and exits 0; `report` on 6.2's run folder rewrites the same report without starting `claude`. Verify that the tests pass and that the check passes with every `bench` source file at 80% coverage or more.

## 7. Review and records

- [ ] 7.1 Write `spine-update-draft.md` in this change's folder: AD-17's interim board answerer and t3′ until benchmark mode, the ask ID as join key, the AskUserQuestion arm without AskBoard, the permission host and its handshake; the measurement protocol's definitions of X, A, T and prep time; AD-1 and the Stack on `bench`'s dependencies. Verify that each item names the section it amends and the decision of this change it comes from.
- [ ] 7.2 Review the whole diff once against the addendum's measurement protocol, AD-17 and this change's spec; fix what is found, tests first. Verify that the check passes and record the findings in this task's note.

## 8. Model runs (awaiting the PO)

Run from the repository root of a checkout with E1 merged and this change on top, in a terminal outside any Claude Code session, after `bun install --frozen-lockfile` and `bun run build`.

- [ ] 8.1 Awaiting PO: `bun packages/bench/src/cli.ts smoke --session e1`. Verify that it prints the scripted answer and exits 0.
- [ ] 8.2 Awaiting PO: a pilot, `bun packages/bench/src/cli.ts run --session e1 --runs 1`. Verify in `report.md` that every run is valid and that the `init` tool lists show `ask` and `collect` (AskBoard) and AskUserQuestion (AskUserQuestion arm). If the AskUserQuestion arm is invalid, rerun it with `--arms auq --auq-permission-host off` and record which works.
- [ ] 8.3 Awaiting PO: the benchmark, `bun packages/bench/src/cli.ts run --session e1`. Optionally rerun with `--cache-ttl 1h`, and with `--model claude-sonnet-5-5`. Verify that each row has 5 valid runs, and record the report's KPIs, the targets and the context added in this task's note.
- [ ] 8.4 Awaiting PO: decide, from 8.3, the spine's Deferred rows "`alwaysLoad` for the `ask` tool" and the result representation, and apply `spine-update-draft.md` with the decisions. Verify that `openspec validate --all --strict --no-interactive` passes.

## Workflow follow-up

- Merge after E1's Integration; at that point declare `@askboard/contract` and `@types/bun` in `packages/bench/package.json` and regenerate the lockfile (proposal, open question 9), and add a root `bench` script if wanted.
- Archive the change after the PO's runs, which syncs the `benchmark` capability into `openspec/specs/`.
