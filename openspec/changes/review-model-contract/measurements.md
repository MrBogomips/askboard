# Measurements

Token counts of the worked model contract in `examples/`, and the findings that writing it exposed (design decisions 1, 3 and 4).

## Method

- **Counting method:** the Claude Code fallback of design decision 3, by input. No API key for the token-counting endpoint is available (product owner, 2026-10-29).
- **Model:** `claude-opus-5-5` (Opus 5.5), the model of the addendum's baselines. Tokenizers differ between models, so every count below holds for this model only.
- **Runs:** Claude Code 2.1.312, `claude -p --output-format json --model claude-opus-5-5 --effort low`, with `--setting-sources ""`, `--strict-mcp-config`, `--tools ""`, `--disable-slash-commands`, `--no-session-persistence` and a one-line system prompt, started from an empty directory outside the repository.
- **Input count:** the document, without its final newline, is the user message, and the system prompt asks for the reply `OK`. The count is the run's input tokens (`input_tokens` plus `cache_creation_input_tokens` plus `cache_read_input_tokens`) minus those of a baseline run whose message is `.`, plus 1 for that `.`.
- **Copy count (cross-check):** the system prompt asks the model to reproduce the message verbatim. The count is `output_tokens` minus that of a baseline copy of `.`, plus 1. A run whose copy differs from the document is rejected.
- **Date:** 2026-10-29.
- **Repeatability (task 1.1):** a fixed 135-character JSON text (a question, a header and two options) counted 53 tokens by input in two runs, and 53 tokens by copy.

## Counts

All counts by input, model `claude-opus-5-5`, 2026-10-29. JSON documents are counted in compact form (no whitespace), as a model emits tool arguments, for both AskBoard and AskUserQuestion. The tool definitions are counted as the model reads them: full name, description and input schema, without annotations. Three documents were cross-checked by copy and gave the same counts: `asks/plain-choice.json` 189, `auq/plain-choice.json` 147, `answers/uj3-sales-review.json` 372.

### Plain question (SM-1: within +25% of AskUserQuestion)

| Document | Tokens | Against AskUserQuestion |
| --- | ---: | ---: |
| `auq/plain-choice.json` | 147 | — |
| `asks/plain-choice.json` | 189 | +28.6% |
| the same ask without `versions` (F11) | 168 | +14.3% |

As written, the plain ask misses the plain-question target, and the `versions` field accounts for the difference: 21 tokens. Without it the ask is within the target, and it still saves AskUserQuestion's required `multiSelect` (F5). SM-1 counts the agent's whole output per question, thinking included (addendum: 967 tokens per AskUserQuestion question on average), so this comparison is the part of the budget the format controls, not the metric itself.

### Rich questions (SM-1: within 2× a plain AskUserQuestion question)

| Ask | Questions | Tokens | Per question | Against 2 × 147 (like for like) | Against 2 × 450 (addendum, measured non-thinking output) |
| --- | ---: | ---: | ---: | ---: | ---: |
| `asks/uj1-diff-graph.json` | 2 | 779 | 390 | 1.32× the target | 0.43× the target |
| `asks/uj2-wbs-gantt.json` | 2 | 853 | 427 | 1.45× the target | 0.47× the target |
| `asks/uj3-sales-review.json` | 1 | 358 | 358 | 1.22× the target | 0.40× the target |

Against the like-for-like plain document (147 tokens), every journey's ask is over twice its size per question. Against the measured AskUserQuestion output per question (mean 450 non-thinking tokens), every journey is well inside the target. The two references bracket the result. The benchmark decides it, because the measured baseline includes what a model writes around a call, and a rich ask needs that too. Without `versions` each ask is 21 tokens smaller.

### Answers and results (what the agent reads back)

Answers are input to the agent, not part of SM-1; they count in the cost model's answer tokens (A) and re-reads (R).

| Document | Tokens | Grouped by ask, state in the ask entry (F13) | Reference IDs (F15) |
| --- | ---: | ---: | ---: |
| `answers/plain-choice.json` | 214 | 155 (−28%) | — |
| `answers/uj1-diff-graph.json` | 568 | 440 (−23%) | — |
| `answers/uj2-wbs-gantt.json` | 830 | 749 (−10%) | 761 (−8%) |
| `answers/uj3-sales-review.json` | 372 | 311 (−16%) | 354 (−5%) |
| `results/*.json` (the four `ask` results) | 124 to 129 | — | — |

### Context before the first ask (R5: about 2,100 tokens)

| What loads | Tokens |
| --- | ---: |
| `server-instructions.md` | 528 |
| `tools.json`, all five tools | 1,809 |
| `tools.json` without `versions` (F11) | 1,659 |
| the `ask` tool alone | 646 |
| the five full tool names, as a list (deferred tools, approximate) | 96 |
| **Everything loaded:** instructions and five tools | **2,337** (2,187 without `versions`) |
| **Up front with tool search (Claude Code's default):** instructions and the five names | **624** |
| **Up front with `ask` always loaded:** instructions, `ask`, the other four names | **1,251** |

With every tool loaded, the context is over R5's threshold by 237 tokens, or by 87 without `versions`. With tool search, which Claude Code applies by default (SOLUTION-DESIGN F19), only the instructions and the names load before the first ask: 624 tokens. Claude Code loads MCP server instructions up front even when the server's tools are deferred, which is why they count in both lines. The Deferred row for `alwaysLoad` (first benchmark run) chooses between 624 and 1,251 tokens.

## Scale

The UJ-2 ask at 8 and at 200 nodes, FR-20's example size, counted by input. A generator outside the repository repeats the example's work-package pattern (2 parents, 6 work packages, 4 dependencies) 25 times, suffixing IDs with `-<copy>` and labels with ` (phase <copy>)`. At 8 nodes its output is byte for byte the example's compact form.

| Document | Nodes | Tokens |
| --- | ---: | ---: |
| `asks/uj2-wbs-gantt.json` (generator at 8 nodes) | 8 | 853 |
| generated | 200 | 14,749 |

Each further node costs about 72 tokens: ID, label, three estimates, an excerpt pointer and its share of the dependencies. A 200-node WBS sent in lean JSON is about 14,700 output tokens, the cost the Deferred row for the table encoding watches. The answer stays small whatever the size, since it carries only what changed (FR-20).

## Findings

Each finding names the example that shows it, the AD or FR it touches and a proposed resolution. "Spine fix" marks the ones small enough to amend in this change if the product owner approves (design decision 5). The others go to the capability that owns them (SOLUTION-DESIGN §3.1). The outcome column is filled by task 5.2.

### Shapes the spine left open

| # | Finding | Example | Touches | Proposed resolution | Outcome |
| --- | --- | --- | --- | --- | --- |
| F1 | **A widget inside a question.** A question's `props` holds its text, `header`, `options` and `multiSelect`; its widgets, excerpts and molecules go in `props.items`, each `{type, id, props}`, with IDs unique in the ask. The agent sends no layout: an excerpt goes beside its question because of its type (FR-13). | `asks/uj1-diff-graph.json` | AD-6, AD-7, FR-13 | Spine fix: state the question shape in AD-7, Content. | |
| F2 | **The molecule reference.** It takes AD-6's form, `{type: "molecule", id, props: {molecule, version, data}}`, with `version` optional. AD-9's form puts `molecule`, `version` and `data` beside `type`. | `asks/uj2-wbs-gantt.json`, `asks/uj3-sales-review.json` | AD-6, AD-9 | Spine fix: align AD-9's sentence to AD-6's form. | |
| F3 | **Answers to nested elements.** Change targets and derived-value keys use AD-13's reference syntax without brackets (`item.child.field`, `item.field`). Child IDs are unique within their item, so a path never names a collection. `add` gives `parent` and `after`, and `remove` names only the target. | `answers/uj1-diff-graph.json`, `answers/uj2-wbs-gantt.json` | AD-13, AD-20 | Spine fix: state in AD-20 that the generic diff addresses elements with the reference syntax. | |
| F4 | **What an answer holds.** `choice` lists the chosen options, `note` is the open-prompt text, `changes` is the generic diff of agent content the user edited, `results` holds per item what a widget produces that is not an edit (an Approval decision, Diff review decisions), and `derived` the derived values. | `answers/uj1-diff-graph.json`, `answers/uj3-sales-review.json` | FR-18, AD-20 | Owned by `contract` (E1): the output format. | |
| F5 | **Options carry no ID.** As in AskUserQuestion, an answer names the chosen options by label. Labels must then be unique within a question. Options are not a collection the user edits, so AD-7 asks no ID of them. | `asks/plain-choice.json`, `answers/plain-choice.json` | FR-3, FR-18, AD-7 | Owned by `contract` (E1): a rule that labels are unique in a question. | |
| F6 | **Pointers as one string.** `path#anchor`, with `#L10-L40` for a line range, otherwise a heading or an ID. A heading and an ID can collide: the examples assume the heading is tried first. | `asks/uj1-diff-graph.json`, `asks/uj2-wbs-gantt.json` | Consistency Conventions (Excerpts and media), AD-12 | Spine fix: state the string form and the lookup order in the convention. | |
| F7 | **Which derived values an answer carries.** The examples carry those that changed plus the item's totals: efforts to two decimals, money as decimal strings. For the Gantt they carry only the finish date and the critical path, not every task's dates. | `answers/uj2-wbs-gantt.json`, `answers/uj3-sales-review.json` | FR-12, FR-20, AD-13 | Owned by `contract` (E1), per widget. | |
| F8 | **Units.** WBS estimates are working days, with no unit field. The sales-estimate-review lines use `days`, `dailyCost` and `dailyRate`, and the margin is derived as a percentage. The unit of `minimumMargin` is not fixed anywhere. | `asks/uj2-wbs-gantt.json`, `asks/uj3-sales-review.json` | AD-9, FR-15 | Owned by `molecules` (E2 for the WBS; the sales molecule's epic): fix the units in each molecule's parameter schema, `minimumMargin` as a percentage. | |
| F9 | **Undecided diff changes.** EXPERIENCE says the answer lists every undecided change. The example lists them only for the fix the user kept: every change of the other fix is undecided too, and listing them would only add tokens. | `answers/uj1-diff-graph.json` | EXPERIENCE (Diff review), AD-10 | Owned by the Diff review epic: undecided changes of the kept alternative only. | |
| F10 | **View-made IDs.** The package the user adds gets `u-1`; `contract` still has to reserve the prefix. | `answers/uj2-wbs-gantt.json` | AD-7 | Owned by `contract` (E1). | |

### Gaps and contradictions

| # | Finding | Example | Touches | Proposed resolution | Outcome |
| --- | --- | --- | --- | --- | --- |
| F11 | **A version on every request.** AD-7 asks every message to name its schema version, so every tool request carries `versions`, and the tool schemas require it. The server and the skills that teach the format ship in one plugin version, so a request cannot be skewed, and every ask pays for the field. Measured: 21 tokens per request, which alone takes the plain ask from +14.3% to +28.6% against AskUserQuestion, over SM-1's +25%; 150 tokens in the tool definitions. | `asks/*.json`, `tools.json` | AD-7, NFR-1, SM-1 | Spine fix: tool requests name no version; results name the versions the session serves. | |
| F12 | **Two versions in every result.** The result envelope (`mcp-tools`) and the output format (`contract`) are separate schema sets, so a result names both (FR-18 asks every answer to name its version). | `results/*.json`, `answers/*.json` | AD-7, FR-18 | Owned by `contract` (E1): keep both, or version the envelope with the output format. | |
| F13 | **`askId` on every event, and state changes as events.** AD-3 puts the ask ID on every event and logs the state changes that answers cause, so a `collect` result repeats the ask ID and adds a `state` event per change. Grouping events by ask and carrying the state in the ask's entry gives the same information. Push messages and stop-block reasons, which carry single events, keep `askId`. Measured: the four answers shrink by 10% to 28% (214 to 155 tokens for the plain one). | `answers/*.json` | AD-3, AD-6 | Spine fix: in `collect` results, events are grouped per ask and the ask's entry carries its state. | |
| F14 | **The `seq` is carried in the cursor.** Events carry `cursor` (`<epoch>.<seq>`) and no separate `seq`, since AD-3 makes the cursor exactly that. | `answers/*.json` | AD-3 | Spine fix: say so in AD-3. | |
| F15 | **Answers name expanded molecule IDs.** AD-9 makes answers name the expanded IDs (`wbs__tree.portal.label`), so the agent must know a molecule's internal composition, which it never wrote. AD-9 also asks answers to carry `molecule: <id>`, which the `<id>__` prefix already gives, and which is ambiguous when one answer touches two molecules (UJ-2). The examples omit it. Measured: naming the reference's own IDs instead (`wbs.portal.label`) saves 69 tokens on the UJ-2 answer (8%) and 18 on UJ-3's (5%). | `answers/uj2-wbs-gantt.json`, `answers/uj3-sales-review.json` | AD-9 | Spine fix: answers and warnings address a molecule through the reference's ID and the child IDs of its data, and carry no `molecule` field. | |
| F16 | **Optional ask fields missing from AD-7.** The examples use `expectedUser` (FR-19), `delivery` (FR-22) and `presentation` (FR-2, in the schema); AD-7's list of optional ask fields names only `title`, `agentName`, `language` and `locale`. | `asks/uj2-wbs-gantt.json`, `asks/uj3-sales-review.json` | AD-7, NFR-1, FR-2, FR-19, FR-22 | Spine fix: add the three to AD-7's list, each optional with its default. | |
| F17 | **The Diff review's base.** AD-7 says the item names the base its patches apply to, but the base is always the files under the root at send time, so there is nothing to name. The example names none. | `asks/uj1-diff-graph.json` | AD-7, AD-12, FR-11 | Spine fix: drop "naming the base" from AD-7. | |
| F18 | **No folder for patch files.** The example writes them under `.askboard/patches/`, beside `media/`. | `asks/uj1-diff-graph.json` | AD-14, AD-12 | Spine fix: add `patches/` to `.askboard/` and its `.gitignore` in AD-14, and the skills say so. | |
| F19 | **The working calendar.** AD-7 counts durations against a working calendar declared on the item; the Gantt plan declares none. | `asks/uj2-wbs-gantt.json` | AD-7, NFR-1 | Spine fix: the calendar is optional, Monday to Friday with no holidays by default. | |
| F20 | **A split package's predecessors.** EXPERIENCE gives a package the user adds "its parent's" predecessors. In a split the new package is a sibling, and the parent (`build`) has no bar and no predecessors, so the example gives it the split package's predecessors. | `answers/uj2-wbs-gantt.json` | FR-15, EXPERIENCE (WBS with PERT) | Owned by `molecules` and `widgets` (E2): the split package's predecessors. | |
| F21 | **Money's currency.** AD-7 pairs every amount with an ISO 4217 code; the example declares the currency once per item. | `asks/uj3-sales-review.json`, `answers/uj3-sales-review.json` | AD-7 | Spine fix: the code may be declared once per item. | |
