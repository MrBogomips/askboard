# Tasks

## 1. Counting method

- [x] 1.1 Choose the counting method of design decision 3: check whether an API key for the token-counting endpoint is available, else prepare the Claude Code fallback. Verify by counting one short fixed text twice with the chosen method and getting the same number both times, and record the method, model and date in `measurements.md`.
  - Note (2026-10-29): no API key, so the Claude Code fallback counts by input, with a copy count as cross-check (design decision 3, amended the same day). Model `claude-opus-5-5`. A fixed 135-character text counted 53 tokens twice by input and 53 by copy. Method, model and date are in `measurements.md`.

## 2. What the model reads before the first ask

- [x] 2.1 Write `examples/tools.json`: the five tool definitions in AD-6's fixed order (`ask`, `update`, `collect`, `fetch`, `snapshot`), with descriptions, generic JSON Schema 2020-12 inputs and annotations, and the full tool names under the Consistency Conventions. Verify against AD-6: no root combinator, top-level property names 1–64 characters from `[A-Za-z0-9_.-]`, each description under 4,096 characters, no per-widget schema, each full name under 128 characters.
  - Note (2026-10-29): `examples/tools.json` is the `tools/list` result: the five tools in AD-6's order, each with a description (120 to 718 characters), a generic input schema with no root combinator and no per-widget schema, items as `{type, id, props}`, and AD-6's annotations (all `openWorldHint: false`; `collect` and `fetch` read-only; `ask` idempotent; `snapshot` `destructiveHint: false`). Top-level property names match `[A-Za-z0-9_.-]{1,64}`; full names `mcp__plugin_askboard_askboard__<tool>` are 34 to 39 characters. Checked with a script.
- [x] 2.2 Write `examples/server-instructions.md`, the MCP server instructions, under 4,096 characters. Verify the length with a command, and that the text names no AXFX term (FR-31).
  - Note (2026-10-29): 1,590 characters (`wc -m`); no AXFX term (`grep -i -E "axfx|gate|verdict"` finds none).

## 3. Asks, results and answers

- [x] 3.1 Write `examples/asks/plain-choice.json` and `examples/auq/plain-choice.json`: the same plain question as an AskBoard ask with no optional field, and as an AskUserQuestion call. Verify that both carry the same question, header, options and descriptions.
  - Note (2026-10-29): a script confirmed that both files carry the same question, header, option labels and descriptions. The AskBoard ask omits `multiSelect`, which AskUserQuestion requires.
- [x] 3.2 Write the three journey asks: `examples/asks/uj1-diff-graph.json` (Diff review with two alternative patch files and an excerpt, plus a Graph), `examples/asks/uj2-wbs-gantt.json` (the WBS-with-PERT molecule with 8 nodes, linked to a Gantt plan, an excerpt per work package) and `examples/asks/uj3-sales-review.json` (the sales-estimate-review molecule naming the expected user). Verify each against AD-7 (IDs, values, anchors, no HTML, CSS, script or geometry), AD-9 (molecule references), AD-12 (pointers only, images by path) and AD-13 (reference syntax).
  - Note (2026-10-29): `uj1-diff-graph.json` (two questions: a Diff review of two patch files with an ADR excerpt, and a Graph state machine with a recommended option), `uj2-wbs-gantt.json` (the WBS-with-PERT molecule, 8 nodes with an excerpt each, a Gantt plan linked to it by item ID, submitted delivery, and the ERP export question), `uj3-sales-review.json` (the sales-estimate-review molecule, `expectedUser: "Marco Rossi"`). A script checked ID patterns and uniqueness, dates as `full-date`, money as decimal strings and the absence of markup; references (AD-13) appear only in the answers, as change targets and derived-value keys. The shapes the spine left open are listed under Findings (3.4).
- [x] 3.3 Write, for each of the four asks, the `ask` result (`examples/results/`) and one `collect` result carrying an answer with only what changed (`examples/answers/`). For UJ-2 that is a split work package and two changed estimates, with derived values; for UJ-3, an approval with changes and its reason. Verify against AD-3 (cursor, `seq`, `askId` on each event), AD-6 (one JSON text block, typed results) and AD-20 with FR-18 to FR-20 (generic diff by ID, `rev`, who and when, open-prompt text).
  - Note (2026-10-29): `results/` holds the four `ask` results (epoch, state `waiting`, cursor `k3x9.0`, board link); `answers/` holds one `collect` result per ask. UJ-2: the split of `portal` into two packages, two changed estimates, the postponed ERP question and derived values (PERT roll-ups, finish 2026-12-02, critical path), computed by a script. UJ-3: approve with changes, its reason in `note`, a lowered rate and a switched-off optional line, with revenue, cost and margin. Every event carries `askId` and its cursor `<epoch>.<seq>`; answers carry `rev`, `who` and `when` and the generic diff by ID (AD-20).
- [ ] 3.4 Record in `measurements.md`, under Findings, every shape the spine left open and the example's choice (at least the three in design decision 1), and every gap or contradiction found, each with a proposed resolution and the AD or FR it touches. Verify that every finding names the example file that shows it.

## 4. Measurements

- [ ] 4.1 Count every file under `examples/` with the method from 1.1, and fill the tables in `measurements.md`: the plain question against AskUserQuestion with the percentage difference; each journey's ask and answer against SM-1's rich target; the tool definitions and server instructions against R5's threshold, both all loaded and up front only. Verify that each number names its file and method.
- [ ] 4.2 Generate the UJ-2 WBS at 200 nodes with a script kept outside the repository, count it, and add the 8-node and 200-node counts to `measurements.md` with a one-line description of the generator. Verify that the 8-node count matches 4.1's.

## 5. Spine and review

- [ ] 5.1 Amend AD-7 in place with the wire-format statement (lean JSON: descriptive camelCase keys, keyed objects, no positional or abbreviated encodings; the agent writes content and structure, AskBoard owns layout), add the Deferred row for the table encoding of long lists (revisit when the benchmark shows rich questions over the SM-1 target), and set `updated:`. Verify that `openspec validate --all --strict --no-interactive` passes.
- [ ] 5.2 Present the findings and measurements to the product owner. For each finding they approve as a small spine or PRD fix, amend the cited AD or FR in place; list the others in `measurements.md` with the epic that owns them. Verify that every finding has an outcome (amended, assigned or rejected) recorded beside it.

## Workflow follow-up

- Open the pull request, check that CI passes, merge after the product owner approves the model contract (roadmap gate), then archive the change and remove the worktree.
- E1 moves `examples/` into the `contract` package as fixtures.
