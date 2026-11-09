# Proposal

## Why

Issue: #98

An `ask` or `update` result carries one `unresolved-pointer` warning per pointer item that did not resolve, and each warning repeats its pointer (up to 1,024 characters, more once JSON escapes it). Neither the number of questions nor the number of items in a question has a limit, so the result has none: the fix re-review of `wbs-gantt-consistency` (3.10) probed 40 such excerpts on `main` and got 47,901 characters, past AD-6's bound on a tool result (`RESULT_MAX_CHARS`, 30,000). `wbs-gantt-consistency` bounded only the `formula` warnings (`FORMULA_WARNINGS_MAX_CHARS`, 10,000, a closing warning counting the rest) and left this one open (its Risks).

## What Changes

- **The `unresolved-pointer` warnings get their own share of the bound** (design decisions 1 and 2). `ask-core` keeps them in board order while their JSON text, with room for a closing warning, stays within `UNRESOLVED_WARNINGS_MAX_CHARS` = 10,000 characters, a third of `RESULT_MAX_CHARS`. Past it, the last warning is the first one left out, with its item, pointer and reason and a message of fixed words that counts the rest and points to `fetch`, which already returns every pointer's status and reason. Under the bound nothing changes. The board still marks every unresolved item.
- **Every warning kind of an `ask` or `update` result is bounded, so an `ask` result stays within `RESULT_MAX_CHARS` whatever the input format admits** (design decision 3). `no-hooks` is one fixed warning (218 characters); `formula` keeps its share, unchanged; `unresolved-pointer` takes the new one. The worst `ask` result is then about 20,830 characters. An `update` result's warnings take at most about 20,000; its `applied` list, one entry per action, is unbounded and is Issue #113, outside this change.
- **One bound helper for both kinds** (design decision 4). The closing rule moves into one pure function in `core` that both shares call; the `formula` warnings keep their exact output.
- **Records.** AD-6's warnings sentence is amended in place ("each kind within its share of the result bound: past it, one closing warning counts the rest"). CHANGELOG, Unreleased, Fixed, gets one line. The change's as-built note is `docs/as-built/result-bound.md`, never CLAUDE.md. No PRD change: FR-8 says nothing on how many warnings a result holds.
- **Found while designing, not in scope:** an `update` result with many actions (Issue #113) and a `collect` page holding one large Submit (Issue #114, a question for the PO); `fetch` and `snapshot` results are already bounded (design, Context).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `core`: "An unresolved pointer never blocks the board" modified (its warnings are bounded); new requirement "The closing unresolved-pointer warning".
- `mcp-adapter`: "Unresolved pointers in ask and update results" modified (bounded, with the closing warning); new requirement "Warnings of ask and update results within the result size".

## Impact

- Code: `packages/core/src/context/warnings.ts` (the bound and the closing warning), a new pure module `packages/core/src/warning-bound.ts` that `graph-check.ts`'s `boundedFormulaWarnings` and the new `boundedUnresolvedWarnings` call. The two callers in `packages/core/src/ask.ts` (`update`, `contextWarnings`) are unchanged: `unresolvedWarnings` returns the bounded list. No change in `packages/server/src`: `mcp-tools` already puts `no-hooks` first and passes `ask-core`'s list through. Tests in `packages/core/test` and `packages/server/test/mcp-tools`.
- Versions: none. The closing warning is an ordinary `unresolved-pointer` warning (output format since 1.2); no schema, message, warning code or dependency changes (design decision 5).
- IDs served: FR-8 (context, unresolved pointers), FR-14 (formula warnings, unchanged), NFR-10 (fail closed: the agent is told the list was cut, and the board keeps every mark). ADs: AD-6 (amended in place), AD-10, AD-12, AD-13. No UX surface.

## Open questions for the PO

Each one has a proposed default, accepted under the PO's unattended handoff. Task 0.1 records them; they are posted on Issue #98 for the PO to confirm. A different answer comes back through `/opsx:update` before group 1.

1. **The share of the `unresolved-pointer` warnings.** *Default:* its own 10,000 characters, beside the `formula` warnings' 10,000, leaving a third of the bound for the rest of the result (the envelope, `no-hooks`, an `update`'s `applied`). *Alternatives:* (b) one budget of 20,000 for both kinds, in the result's order; (c) a larger share, such as 15,000, which leaves the rest of an `update` result less room.
2. **The form of the closing warning.** *Default:* an ordinary `unresolved-pointer` warning for the first pointer left out, with its pointer and reason, so no set moves. *Alternatives:* (b) a new warning code, such as `truncated`, which widens the output format and the tool envelopes; (c) keep every warning and cut each pointer it repeats, which hides what the agent sent.
3. **The closing warning's words.** *Default:* "The pointer of `<item>` did not resolve (`<reason>`), and `<N>` more unresolved pointers are left out: fetch their questions to read each one's reason." ("1 more unresolved pointer is left out: fetch its question to read its reason." for one). The count is always at least 1. The room kept for the closing warning is longer than any single warning, so a list that only its last warning would push past the bound fits whole (design decision 2). The "with none after it" wording of the first default was dropped on 2026-11-09 because it cannot occur. *Alternative:* the formula wording's pattern without the pointer to `fetch`.
