# Spec Delta

## Purpose

The benchmark measures what asking costs an agent, through AskBoard and through AskUserQuestion, on the same questions. It drives Claude Code with a scripted user and reports output tokens, thinking tokens, the time to put a question up and the cost of 100 questions (FR-32, FR-33, AD-17).

## ADDED Requirements

### Requirement: Cases the early benchmark runs
The benchmark SHALL run case S1 in both arms and in a baseline, and case S6 in the AskBoard arm. S1 asks two plain single-choice questions, one after the other: its first ask is cold, its second warm. The baseline runs the AskBoard arm's command without AskBoard and ends after one request. S6 has a subagent ask S1's first question. Each case and arm SHALL run 5 times unless the user sets another count.

#### Scenario: A default run
- **WHEN** the user runs the benchmark with no case or run count
- **THEN** it runs S1 five times in each arm and in the baseline and S6 five times in the AskBoard arm, and reports S1 cold, S1 warm and S6 as separate rows

#### Scenario: The same questions in both arms
- **WHEN** an S1 run starts in either arm
- **THEN** the agent's prompt gives the same two questions, headers and options, and differs only in the tool it names

### Requirement: Pinned settings and isolated configuration
Every run of one benchmark SHALL use the same model, effort, cache TTL, tool-search mode and Claude Code version, which the user can set. Runs SHALL use `--setting-sources ""`, a restricted tool list and `--max-turns`, and SHALL NOT pass `--strict-mcp-config`. AskBoard SHALL be loaded with `--plugin-dir` in its arm only.

#### Scenario: A version other than the pinned one
- **WHEN** the user pins a Claude Code version and the installed `claude` reports another
- **THEN** the benchmark stops before any run and names both versions

#### Scenario: The command of an AskBoard run
- **WHEN** the benchmark starts an AskBoard run
- **THEN** its `claude` command passes the pinned model and effort, `--setting-sources ""`, `--tools`, `--max-turns` and `--plugin-dir`, and no `--strict-mcp-config`

### Requirement: One setting selects the session process
A single setting SHALL select the session process every benchmark command uses: E1's, which Claude Code loads from AskBoard's plugin directory, or the stub that speaks E1's contract. The stub is for the harness's own tests.

#### Scenario: Switching to the real session process
- **WHEN** the user passes `--session e1`
- **THEN** runs load AskBoard's plugin from the repository, and the smoke check starts the server that plugin declares

### Requirement: The scripted board answerer
In the AskBoard arm, the benchmark SHALL answer each board as a user would, through the board protocol. Started as the `BROWSER` command with the board link, it loads the board page, connects with the token first, validates every message against the contract, and answers the scenario's option for the question it received.

#### Scenario: A board opens
- **WHEN** the session process opens a board of the scenario's question
- **THEN** the answerer records when it started, when the board document and the open question state reached it and when it sent the answer, and the answer names the scenario's option at the question's revision

#### Scenario: A message outside the contract
- **WHEN** the session process sends the answerer a message that fails the contract's validation
- **THEN** the answerer sends no answer and records the failure

### Requirement: The scripted AskUserQuestion answerer
In the AskUserQuestion arm, a `PreToolUse` hook SHALL answer AskUserQuestion with the scenario's option. The hook is registered only in the run's own settings, never in AskBoard's plugin. A permission host for `-p` SHALL be on by default, and the user can turn it off.

#### Scenario: AskUserQuestion is called
- **WHEN** the agent calls AskUserQuestion with the scenario's question
- **THEN** the hook allows the call with the scenario's option as the answer and records when it ran

#### Scenario: AskBoard's plugin is untouched
- **WHEN** a benchmark run ends
- **THEN** AskBoard's plugin files are unchanged, and the scripted answerer appears only in that run's settings file

### Requirement: Output and thinking tokens per question
The benchmark SHALL compute K1 and K2 from transcript usage, deduplicated by `requestId`. K1 is the emitting response's non-thinking output plus that of each response that only prepares the ask: tool search, skill load, failed attempts. K2 is the billed thinking of the same responses. Both are divided by the ask's question count.

#### Scenario: A cold ask after a tool search
- **WHEN** the agent searches for the `ask` tool in one response and calls it in the next
- **THEN** the ask's K1 and K2 include both responses

#### Scenario: One response stored as several entries
- **WHEN** the transcript stores one response as several entries that repeat its usage
- **THEN** that usage counts once

#### Scenario: An ask sent again
- **WHEN** the agent sends the same ask again right after it succeeded, with the same ask ID or the same question
- **THEN** the second response counts in that ask's K1 and K2 as a retry, and the next scenario question is still the next ask

### Requirement: Time to put a question up
The benchmark SHALL measure K3 from t0, the start of the request that emits the ask, to t3′ in the AskBoard arm or t1 in the AskUserQuestion arm. t3′ is when the board document and the open question state reached the scripted answerer. It SHALL report t1 and t2′ (answerer started) as splits, and the preparing responses' time beside K3. AskBoard rows SHALL say that they end at t3′.

#### Scenario: An AskBoard ask
- **WHEN** an AskBoard run is measured
- **THEN** its ask has t0 from the transcript, t1 from the tool call's entry, and t2′ and t3′ from the answerer's record, joined by the ask ID

#### Scenario: An AskUserQuestion ask
- **WHEN** an AskUserQuestion run is measured
- **THEN** its K3 ends at the tool call's entry

### Requirement: Fail-closed runs
A run SHALL count only when it ended before its timeout and was not stopped, held every ask its case expects, asked each question with the scenario's options and one per response, and the scripted answer reached the agent. Any other run SHALL be excluded from the medians and listed with its reason.

#### Scenario: An answer that never reached the agent
- **WHEN** an AskBoard run's transcript holds no `collect` result carrying the scripted answer
- **THEN** the run is listed as invalid with that reason and no figure of it enters a median

#### Scenario: A run past its timeout
- **WHEN** a run is still going at its timeout
- **THEN** the benchmark stops it and every process it started, and lists the run as timed out

#### Scenario: Two asks in one response
- **WHEN** the agent sends both questions of S1 in one response
- **THEN** the run is listed as invalid with that reason

### Requirement: Stopping the benchmark
When the user stops the benchmark with SIGINT or SIGTERM, it SHALL stop the running run and every process that run started, list that run as interrupted, write the report of the runs that ended, and exit with status 130.

#### Scenario: Ctrl-C during a run
- **WHEN** the user presses Ctrl-C while a run waits on Claude Code
- **THEN** Claude Code's process group stops, the report lists that run as interrupted, no process of the run is left, and the command exits 130

### Requirement: Context added before the first ask
The benchmark SHALL report the total input of the first request of each arm and of the baseline. The AskBoard arm's median minus the baseline's is the context AskBoard adds before the first ask (NFR-1). It SHALL also report what tool search loads in the session.

#### Scenario: Reporting the context
- **WHEN** S1 has valid runs in the AskBoard arm and in the baseline
- **THEN** the report gives each median first-request input, the AskBoard arm's difference from the baseline, and the median input growth over the session's tool searches

#### Scenario: No baseline
- **WHEN** the baseline has no valid run
- **THEN** the context AskBoard adds is reported as not available, and so is AskBoard's cost, naming T

### Requirement: Cost of 100 questions
The benchmark SHALL compute the cost of 100 questions per arm with the addendum's cost model, at list prices for the run's model and cache TTL. It SHALL use the measured K1, K2, X, A and T and the addendum's defaults. A 10-question session is one cold and nine warm asks. The cost of answers after the TTL SHALL be shown apart.

#### Scenario: The worked example
- **WHEN** the cost model is given the addendum's worked inputs for Opus 5.5 with a 5-minute TTL
- **THEN** it returns 5.02, 58.55 and 3.49 USD for the three scenarios

#### Scenario: A missing input
- **WHEN** an input of the cost model was not measured in any valid run
- **THEN** that arm's cost is reported as not available, naming the input

### Requirement: The report
Each run of the benchmark SHALL write a JSON and a Markdown report under `.askboard/bench/<run>/`. Each states the settings it ran with, how AskBoard was loaded and the MCP servers each arm connected. Each gives the medians with minimum, p90 and maximum per row, the invalid runs, and each plain-question KPI against SM-1 to SM-4. Each restates the counting rules and the cost model.

#### Scenario: Plain-question targets
- **WHEN** S1 has valid runs in both arms
- **THEN** the report shows, for K1, K2, K3 and the cost, AskBoard's median as a ratio of AskUserQuestion's and whether it is within +25%

#### Scenario: Rebuilding a report
- **WHEN** the user runs the report command on a finished run's folder
- **THEN** it rewrites both reports from the saved transcripts and records, without starting Claude Code

### Requirement: Answer delivery on the pull path
The benchmark SHALL report the time from the moment the scripted answerer sends an answer to the transcript entry that carries the `collect` result with that answer. It SHALL compare this time with the 2-second target of PRD OQ2, stating that it measures an agent waiting in `collect`.

#### Scenario: A warm ask is answered
- **WHEN** the answerer answers while the agent waits in `collect`
- **THEN** the report gives that ask's answer-to-agent time

### Requirement: A check without a model
The benchmark SHALL offer a smoke check that runs no model. It starts the selected session process, asks S1's first question as a scripted MCP client, lets the board answerer answer it, and collects the answer. It succeeds only when the scripted answer comes back, and fails, saying why, when the session process does not start or does not answer within its bounds.

#### Scenario: The smoke check on the stub
- **WHEN** the user runs the smoke check with the stub
- **THEN** it prints the answer and the answerer's times and exits 0, leaving no process behind

### Requirement: Results stay local
The benchmark SHALL write only under its output folder and the scratch projects it creates, and SHALL make no network connection of its own other than to the loopback board. Nothing it keeps SHALL hold a board token: each run's folder is redacted as soon as that run ends.

#### Scenario: Records without tokens
- **WHEN** a run ends
- **THEN** no answerer record, transcript copy, report or log in the run's folder holds a board token
