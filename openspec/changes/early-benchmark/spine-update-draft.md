# Spine update draft: early benchmark

Replacement texts for the choices this change made where the spine and the addendum describe the full benchmark, which needs benchmark mode in the session process. Each block belongs to one open question of `proposal.md` and applies only if the PO accepts that choice. Each block quotes the current text exactly, then gives the replacement. AD IDs stay stable: AD-17 is amended in place, and no AD is added.

**Not applied.** The PO decides each row, with task 8.4, after the first runs.

Files, all under `docs/`:

- **Spine:** `architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`
- **Solution design:** `architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`
- **Addendum:** `prd-askboard-2026-10-25/addendum.md`

How to apply:

- Apply the blocks of accepted rows only. For a row accepted with changes, edit its blocks first.
- A phrase block replaces only the quoted phrase; the rest of the line stays.
- Set `updated:` to the apply date in every file changed.
- Verify with `openspec validate --all --strict --no-interactive` and `bun run check`.

| Row | Proposal question | Touches |
| --- | --- | --- |
| 1 | 4, 5, 7: the interim scripted user, t3′, the ask ID as join key | Spine AD-17; solution design §7; addendum, Measurement protocol |
| 2 | 3, 8: the AskUserQuestion arm, the baseline and the permission host | Spine AD-17; addendum, Measurement protocol |
| 3 | 2, 6, 11, 13: cold and warm in one session, K3's start, X, A and T, retries and batches | Addendum, Measurement protocol and Cost model |
| 4 | 1, 10: the cases and pinned defaults | Solution design §7 (seed set) |
| 5 | Deferred: `alwaysLoad` and the result representation | Spine, Deferred |

Not a spine change: the proposal's open question 9. `bench` imports only `contract`, as the dependency diagram already allows. Declaring `@askboard/contract` and `@types/bun` in `packages/bench/package.json`, and the lockfile entry that comes with it, lands with E1's Integration (tasks.md, Workflow follow-up).

## Row 1: AD-17, the interim scripted user

Applies only if the PO accepts the proposal's open questions 4, 5 and 7.

### 1.1 Spine, AD-17, Rule, Scripted answers

Current (spine):

```text
  - **Scripted answers:**
    - The headless browser only loads boards, and in benchmark mode the view mounts every area.
    - After `board-host` has recorded a question as visible, `ask-core` appends its scripted answer, marked `scripted`, through the same command port the board page uses.
```

Replacement:

```text
  - **Scripted answers:**
    - The headless browser only loads boards, and in benchmark mode the view mounts every area.
    - After `board-host` has recorded a question as visible, `ask-core` appends its scripted answer, marked `scripted`, through the same command port the board page uses.
    - Until the session process has benchmark mode, the early benchmark's scripted user is a board answerer that the run's `BROWSER` starts with the board link. It speaks the board protocol as the board page does, with the token first, and its answers are not marked `scripted`. It exists only in the runs `bench` starts, never in normal use, and the change that brings benchmark mode removes it, so that one scripted-answer path remains.
```

### 1.2 Spine, AD-17, Rule, Timing

Current (spine):

```text
  - **Timing:** `board-host` records when each question becomes visible (AD-9). The agent record's `tool_use_id` (AD-5) is the join key for the session process's receive and visible times, and joins the transcript for the request's start and the tool call.
```

Replacement:

```text
  - **Timing:** `board-host` records when each question becomes visible (AD-9). The agent record's `tool_use_id` (AD-5) is the join key for the session process's receive and visible times, and joins the transcript for the request's start and the tool call. Until then, the early benchmark ends K3 at t3′, when the board document and the open question state reach its board answerer, and starts t2′ when the answerer starts; it joins them to the transcript by the agent's ask ID. Its reports label these times as such.
```

### 1.3 Solution design, §7, the benchmark, second bullet

Current (solution design):

```text
- A headless browser only loads boards; every area mounts, and once a question is visible `ask-core` appends its scripted answer through the board's command port. The AskUserQuestion arm uses `bench`'s scripted answerer, with an asking rule that lets AskUserQuestion through.
```

Replacement:

```text
- A headless browser only loads boards; every area mounts, and once a question is visible `ask-core` appends its scripted answer through the board's command port. The AskUserQuestion arm uses `bench`'s scripted answerer, with an asking rule that lets AskUserQuestion through. Until benchmark mode exists, the early benchmark answers through the board protocol from the run's `BROWSER`, and measures K3 to t3′, the board reaching that answerer (AD-17).
```

### 1.4 Addendum, Measurement protocol, Scripted answerer (phrase)

Current (addendum):

```text
an AskBoard test mode or a headless browser;
```

Replacement:

```text
an AskBoard test mode or a headless browser, and on E1, before the test mode exists, a board-protocol answerer started as the run's `BROWSER`;
```

## Row 2: AD-17, what each arm loads

Applies only if the PO accepts the proposal's open questions 3 and 8.

### 2.1 Spine, AD-17, Rule, Setup, second bullet

Current (spine):

```text
    - In the AskUserQuestion arm, the scripted answerer from `bench`'s run settings answers AskUserQuestion (AD-10). The run sets the asking rule so that AD-16's hook lets AskUserQuestion through, and the report states both.
```

Replacement:

```text
    - In the AskUserQuestion arm, the scripted answerer from `bench`'s run settings answers AskUserQuestion (AD-10), with a permission host under `-p` that the run declares beside it. The run sets the asking rule so that AD-16's hook lets AskUserQuestion through, and the report states both. While AskBoard has no hooks, that arm loads no AskBoard.
    - A baseline runs the AskBoard arm's command and prompt without AskBoard and ends after its first request. The context AskBoard adds before the first ask is the difference between the two first requests: the AskUserQuestion arm's first request also carries AskUserQuestion's own definition.
```

### 2.2 Addendum, Measurement protocol, Pinned settings (phrase)

Current (addendum):

```text
one model per comparison, as tokenizers differ (§1.3).
```

Replacement:

```text
one model per comparison, as tokenizers differ (§1.3). A bench-provided server that speaks only the 2025 handshake, such as the permission host, runs with `MCP_PROTOCOL_NEGOTIATION=legacy`, and the report says so.
```

## Row 3: counting rules the early benchmark had to settle

Applies only if the PO accepts the proposal's open questions 2, 6, 11 and 13.

### 3.1 Addendum, Measurement protocol, Counting

Current (addendum):

```text
- **Counting:** the first ask of a session counts as it happens, tool search included; retries count. For a batched ask, K1 and K2 per question are the ask's figures divided by its question count, and K3 is the ask's own time (FR-32). Arms are compared at equal batch sizes, at most 4 questions per AskUserQuestion call.
```

Replacement:

```text
- **Counting:** the first ask of a session counts as it happens, tool search included; retries count. For a batched ask, K1 and K2 per question are the ask's figures divided by its question count, and K3 is the ask's own time (FR-32). Arms are compared at equal batch sizes, at most 4 questions per AskUserQuestion call.
  - A session may ask several questions one after the other: its first ask is the cold row, the later ones warm rows. A successful ask sent again with the same ask ID or the same question is a retry of that ask, not the next one; a case that asks one question at a time is invalid when two asks share a response.
  - K3 starts at the request that emits the ask. The time of the responses that only prepare it, such as the tool search, is reported beside K3.
```

### 3.2 Addendum, Cost model for 100 questions, Per question and Per session

Current (addendum):

```text
- **Per question:** output K1, thinking K2 (K2′ kept in context, assumed equal on Opus 5.5), X extra output to collect the answer, A answer tokens as the model receives them.
- **Per session:** T, tool definitions and instructions loaded at start; N_req model requests; n_w cache rewrites. A deferred ask tool keeps T near 0 until first use, then adds one search step.
```

Replacement:

```text
- **Per question:** output K1, thinking K2 (K2′ kept in context, assumed equal on Opus 5.5), X extra output to collect the answer, A answer tokens as the model receives them. Measured, X is the output of the requests that collect the answer, a tool search that loads the collecting tool included, and A is the input growth over the asking flow's tool results, the ask's own result included. A 10-question session counts 1 cold and 9 warm asks.
- **Per session:** T, tool definitions and instructions loaded at start; N_req model requests; n_w cache rewrites. A deferred ask tool keeps T near 0 until first use, then adds one search step. Measured, T is the first-request difference from the baseline plus what tool search loads in the session, since a definition loaded on first use stays in context.
```

## Row 4: the early benchmark's cases

Applies only if the PO accepts the proposal's open questions 1 and 10.

### 4.1 Solution design, §7, after the seed question set table

Current (solution design): the line after the table's last row, `| S7 | LaTeX formula | AskBoard |`, is blank, then `## 8. Operational envelope (AD-18, AD-22)`.

Insert after the table:

```text
The early benchmark (OpenSpec change `early-benchmark`) runs what E1 can ask: S1 as two plain questions in one session, the first cold and the second warm, in both arms and a baseline, and S6. Its pinned defaults are Opus 5.5 at effort `medium`, a 5-minute cache TTL, `ENABLE_TOOL_SEARCH=true`, 12 turns and 300 s per run; the report states them.
```

## Row 5: the Deferred rows the first runs decide

Applies after task 8.3, with the PO's decisions.

### 5.1 Spine, Deferred, `alwaysLoad`

Current (spine):

```text
| `alwaysLoad` for the `ask` tool | No context budget in the PRD; decided by data | First benchmark run |
```

Replacement, when the PO decides from task 8.3:

```text
Remove the row, and write the decision into AD-6 in place: <always loaded | deferred>, from the early benchmark run of <date> (context added before the first ask <n> tokens, tool search <n> tokens; S1 cold K1 <ratio>, K3 <ratio> of AskUserQuestion's).
```

Or, when the PO defers it:

```text
| `alwaysLoad` for the `ask` tool | No context budget in the PRD; the early benchmark measured <figures> on <date> | The benchmark epic, with rich questions |
```

### 5.2 Solution design, §12, Benchmark owner row (phrase)

Current (solution design):

```text
`alwaysLoad` for `ask` and the result representation (first run);
```

Replacement, matching 5.1:

```text
the result representation (first run);
```
