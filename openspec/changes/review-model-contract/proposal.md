# Proposal

## Why

The model contract is what the agent's model reads and writes to use AskBoard: the tool definitions loaded before the first ask, the input document it writes to put a question up, and the answers it reads back. Its cost is the product's first success metric (SM-1, SM-2, PRD R5), and every later unit depends on it through `contract`. The spine fixes its rules (AD-6, AD-7, AD-9, AD-12, AD-20), but the documents hold no worked example of an ask or an answer, and no measurement of what one costs. The `contract` package is the first code E1 writes, so the format is settled before then.

The product owner settled the two choices this review started from (2026-10-29):

- **What the model writes: content and structure.** Questions, widgets with their data, excerpts and images by pointer, formulas, molecule references. AskBoard owns the layout. This is the current design (FR-13, AD-7), so it stays.
- **Syntax: lean JSON only.** Descriptive camelCase keys and keyed objects for every record, with no positional rows and no abbreviated keys, as the tool's native JSON arguments. A table encoding for long lists (column names once, rows as arrays) was compared and left out for simplicity and robustness. It is revisited only if the benchmark shows rich questions missing the SM-1 target.

## What Changes

- **Spine, AD-7 (wire format).** State the lean-JSON rule above and the split of work: the agent writes content and structure, AskBoard owns layout. Amended in place.
- **Spine, Deferred.** Add a row for the table encoding of long lists, revisited when the benchmark shows rich questions over the SM-1 target.
- **Worked model contract**, kept in this change under `examples/` as the seed fixtures for `contract` in E1 and the reference for the skills:
  - the five tool definitions (names, descriptions, generic input schemas, annotations) and the server instructions, per AD-6;
  - four sample asks in the input format: a plain Choice question, UJ-1 (Diff review and Graph with an excerpt), UJ-2 (WBS with PERT linked to a Gantt plan), UJ-3 (the sales estimate review molecule);
  - for each, the `ask` result and one answer as `collect` returns it, with only what changed (FR-18 to FR-20);
  - the same plain question as an AskUserQuestion call, for a like-for-like comparison.
- **Measurements** in `measurements.md`:
  - token counts of each document;
  - the plain question against its AskUserQuestion equivalent (SM-1 allows +25%);
  - the WBS at 8 nodes and at 200, FR-20's example size, to record what the Deferred row watches;
  - the tool definitions and server instructions against R5's threshold of about 2,100 tokens.
- **Findings.** Where writing the examples exposes a gap or a contradiction in the spine or the PRD, the change records it. A fix that changes an AD or a requirement is made in this change only if it is small and the product owner approves it; otherwise it is listed for the epic that owns it.

## Capabilities

### New Capabilities

None. The change settles the format and records evidence; it implements no behaviour, so its `.openspec.yaml` sets `skip_specs: true`. The `contract` capability spec comes with E1, built on these examples.

### Modified Capabilities

None.

## Impact

- **Changed:** `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (AD-7, Deferred, `updated:`).
- **New, in this change:** `examples/` (tool definitions, server instructions, asks, results, answers, the AskUserQuestion equivalent), `measurements.md`.
- **No code, no dependency.** Counting tokens uses the token-counting API, or Claude Code runs as the fallback (design).
- **Requirements and decisions served:** NFR-1, SM-1, SM-2, R5; FR-13, FR-15, FR-18 to FR-20; AD-6, AD-7, AD-9, AD-12, AD-13, AD-20.
- **Gates:** E1 builds `contract` from the approved examples (roadmap gate "Approve the model contract").
