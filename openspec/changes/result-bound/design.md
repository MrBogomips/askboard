# Design

## Context

See proposal.md (Why). What the fix stands on, all on `main` ac9f891f:

- **The unresolved-pointer warnings** come from `unresolvedWarnings` (`core/src/context/warnings.ts:28`): one per pointer item a question's props hold unresolved, in board order then item order, each `{code, itemId, pointer, reason, message}` with `message` from `UNRESOLVED_MESSAGES` (`:12`). Two callers: `Ask.update` (`core/src/ask.ts:489`, the revised questions only) and `Ask.contextWarnings` (`ask.ts:505-509`, every question), which `AskCore`'s `#create` puts first in the ask's outcome (`core/src/core.ts:762`). A re-sent identical ask returns no warnings (`core.ts:701`). Context items sit only in a question's own `items`, never in a layout (spine AD-6, Questions), so no walker is needed.
- **The formula warnings** are bounded since `wbs-gantt-consistency`: `boundedFormulaWarnings(warnings, max)` (`core/src/graph-check.ts:69`) keeps them while their JSON text plus `FORMULA_WARNING_CLOSING_MAX_CHARS` (1,000, `:58`) fits `FORMULA_WARNINGS_MAX_CHARS` (10,000, `:52`), then one closing `formula` warning names the first left out and counts the rest. `formulaWarnings` applies it (`:125`); `checkedFormulaWarnings` (`:136`) serves `ask` and `update`. Its requirements, "The send-time graph check" and "The closing formula warning", are in the archive of that change (PR #110), not yet in `openspec/specs/core/spec.md` on `main`.
- **The results** are assembled in `mcp-tools`: `handleAsk` puts `NO_HOOKS_WARNING` first, then `ask-core`'s list (`server/src/mcp-tools/ask.ts:101`); `update`'s result passes `ask-core`'s list through (`update.ts:55`). Neither measures the result.
- **The limits the contract gives** (`contract/src/context/limits.ts`, `schemas/input/`): a pointer of 1 to 1,024 code points (`POINTER_MAX_CHARS`, `pointer.json`, no pattern: a pointer `readPointer` cannot read is `invalid-pointer`, not a request error), an ID of 1 to 64 of `[A-Za-z0-9_-]`, and no `maxItems` on an ask's items, an area's questions, a question's items or an update's actions. `fetch` of a question already returns every excerpt's and image's pointer, status and reason (mcp-adapter spec, Fetch omits excerpt text and image bytes).

**The warning producers of `ask` and `update` and their worst cases** (JSON text as `JSON.stringify` writes it, measured with the contract's shapes; task 0.2 re-measures them on the code):

| Producer | Where | One warning | How many | Worst on `main` | After this change |
|---|---|---|---|---|---|
| `no-hooks` | `mcp-tools/ask.ts:23`, `ask` only | 218, fixed | 0 or 1 | 218 | 218 |
| `unresolved-pointer` | `core/src/context/warnings.ts:28` | 160 typical; 1,303 with a 1,024-character pointer; 6,423 with 1,024 code points that JSON escapes to `\u00XX` (controls, lone surrogates) | one per pointer item, unbounded | unbounded (40 → 47,901, the Issue's probe; 1,000 → about 1.3 MB, or 6.4 MB escaped) | 10,000 |
| `formula` | `core/src/graph-check.ts:105` `formulaWarnings` (compute's graph warnings) | up to about 750 as a closing one | one per node in error, before the bound | 10,000 since `wbs-gantt-consistency` | 10,000, unchanged |

No other code adds a warning to these results (`git grep` of `warnings` in `core/src` and `server/src/mcp-tools`; the settings warnings of `core/src/config/` go to the board, not to a tool result).

**The other results, checked against the same bound:**

- `fetch`: bounded. A value that does not fit whole is paged, and each page's slice is measured once escaped into its result (`fetch-pages.ts` `pageOf`, `sliceFrom`; `fetch.ts:98-100`). Its typed outcomes are a few fixed fields.
- `snapshot`: bounded. Versions, epoch, ask ID, state and the file's absolute path (`SnapshotResult`), with no content.
- `collect`: bounded except where AD-20 says so. A page holds the events that fit, but one board command's events are never split and "fill a page by themselves" (mcp-adapter spec, Result size). An answer event may carry `other` and `note` of 10,000 characters each (`answer-event.json`), so a Submit of two such answers gives a page of about 40,000 characters. The spine's AD-6 and AD-20 disagree here: Issue #114, a question for the PO, outside this change.
- `update`'s `applied` list: one entry per action (96 characters for a `delete` of a 64-character ID, 417 for a recorded answer with a 256-character `who`), and actions are unbounded, so about 310 deletes pass the bound by themselves: Issue #113, outside this change.
- Errors: capped at `ERROR_TEXT_MAX_CHARS` (`mcp-tools/results.ts`).

ADs relied on: AD-6 (tool results, typed warnings, the result bound; amended in place), AD-10 (fail closed: no answer is touched, and the agent is told the list was cut), AD-12 (pointers and their reasons, never a path beyond the agent's own pointer) and AD-13 (the formula warnings' bound, unchanged). No UX surface.

## Goals / Non-Goals

**Goals:** an `ask` result within `RESULT_MAX_CHARS` whatever the input format admits; every warning kind of `ask` and `update` bounded, each with a closing warning that says what was left out; nothing changes under the bound.

**Non-Goals:** `update`'s `applied` list (#113); `collect`'s atomic page (#114); limits on the number of items or actions in the input format; any change to the board, which keeps marking every unresolved item.

## Decisions

### 1. The `unresolved-pointer` warnings get their own share: 10,000 characters

`unresolvedWarnings` returns its list bounded by `UNRESOLVED_WARNINGS_MAX_CHARS` = 10,000, so both callers (`update` and `contextWarnings`) share it, as `checkedFormulaWarnings` serves both for the formula warnings. The constant is `core`'s own, beside the warnings in `context/warnings.ts`, exported for its tests; no other unit reads it.

The bound splits `RESULT_MAX_CHARS` in thirds: one for the `formula` warnings, one for the `unresolved-pointer` warnings, one for the rest of the result (the envelope, `no-hooks`, an `update`'s `applied`). Each kind keeps its own room, so many unresolved pointers never crowd out a formula error, nor the reverse. Under the bound the list is returned as it is: every test and scenario of today stands.

*Alternatives:* one budget of 20,000 for both kinds in the result's order. Rejected: 40 long pointers would take the room the agent needs to see its formula errors, the reason `wbs-gantt-consistency` gave each plan one warning. A larger share, such as 15,000. Rejected for now: it takes room from the third that #113 needs for `applied`. Limits on items or actions in the input format. Rejected: a narrower input breaks asks that work today, and the warnings of an admitted ask still need a bound.

### 2. The closing warning, and the room it needs measured on the list

Past the bound, the warnings are kept in order while the JSON text of the kept list, plus a room for the closing warning, stays within 10,000. The last warning is then the first one left out, as an ordinary `unresolved-pointer` warning with its `itemId`, `pointer` and `reason` (all three required by the schema), and a message of fixed words (proposal, open question 3):

- "The pointer of `<item>` did not resolve (`<reason>`), and `<N>` more unresolved pointers are left out: fetch their questions to read each one's reason." N counts the warnings after it; "1 more unresolved pointer is left out: fetch its question to read its reason." for one.

There is no form for none after it: N is always at least 1 (revised on 2026-11-09, see the room below).

The words name only the item ID (`ID_PATTERN`) and the reason (an enum), never a path or whether a file exists, as `UNRESOLVED_MESSAGES` (excerpts, design decision 3).

**The room** is the longest closing warning that any warning of the list would give, measured with the list's length as its count and with a count of 1 (the singular words), whichever is longer, plus one for the comma before it (the helper's loop does not count that comma, so the caller's room does; revised on 2026-11-09 after review 1.3, X-1, and re-review 1.5, X-1), so the bound holds whatever the closing words. A closing warning repeats its pointer, so its size follows the pointers the agent sent: about 300 characters for a typical one, 1,397 for a pointer of 1,024 plain characters, 6,517 for one that JSON escapes. Measuring it on the list keeps the typical case close to the bound (about 60 warnings of 160 characters kept), while a fixed room for the worst pointer would keep about 18. The kept list plus the closing warning stays within 10,000 whatever the pointers: the largest closing warning (6,517) fits alone.

**Why the closing warning always counts the rest (N ≥ 1).** The room is at least the closing form of the list's last warning, and a closing form is longer than that warning's own JSON text plus its comma: it holds the same `code`, `itemId`, `pointer` and `reason`, and its counted words (with the item ID and the reason) are longer than any reason's message in `UNRESOLVED_MESSAGES`. So when every warning but the last fits within the share less the room, the whole list fits the share and is returned as it is. A list cut at its last warning alone cannot occur, so no closing warning stands for the last pointer with none after it. Task 1.2 found this: an exhaustive search over reasons, ID lengths, pointer lengths and list sizes found no such list. The words for "none after it" were dropped rather than measuring the room per cut, which would keep at most one more warning. The argument holds while every counted closing message is longer than every reason's message, and a direct test of the premise in 1.4 guards it (a sweep cannot: its grid misses the narrow lists a longer message would allow). The formula warnings keep their own rule ("The closing formula warning", a fixed room), which is unchanged.

*Alternatives:* a fixed room, as the formula warnings have. Rejected: 7,000 characters reserved for a pointer almost no ask holds. Cutting each pointer the warnings repeat. Rejected: the agent would read a pointer it never sent, and the schema's pointer is the item's. A new warning code, `truncated`. Rejected: it widens the output format and the tool envelopes for a count a message can carry (open question 2).

### 3. Every warning kind bounded: the worst results

The order stays as on `main`: `no-hooks` (from `mcp-tools`), then `unresolved-pointer`, then `formula` (from `ask-core`). With both shares bounded:

- **The worst `ask` result:** an envelope of at most 609 characters (versions, a 36-character epoch, a 64-character ask ID, the cursor, a board link with a 256-character token, `BOARD_TOKEN_MAX_CHARS`), `no-hooks` 218, the unresolved warnings 9,998 inside their brackets, the formula warnings 9,998, and two commas and two brackets: about **20,830** characters, 9,170 under `RESULT_MAX_CHARS`.
- **The worst `update` result:** an envelope of 231 characters without `applied`, and warnings of at most about 20,000: about **20,230** plus `applied`, which #113 bounds.

No unit measures a whole result: the bound holds by construction, and the mcp-adapter scenario "The worst ask the contract admits" pins it. A measure in `mcp-tools` that cut a too-long result could only fail closed by dropping warnings it cannot read, so it would hide a regression instead of catching it. The test is the guard.

### 4. One bound helper for both kinds

A new pure module `core/src/warning-bound.ts` holds `boundedWarnings(warnings, {max, room, closing})`: the whole list when its JSON text fits `max`; else the warnings kept in order while the kept text plus `room` fits, then `closing(firstLeftOut, countAfter)`. `boundedFormulaWarnings` becomes a call with `room = FORMULA_WARNING_CLOSING_MAX_CHARS` and its own closing words, its name, signature and output unchanged (`core/test/graph-check-bound.test.ts` stands as it is); `boundedUnresolvedWarnings(warnings, max)` in `context/warnings.ts` measures its room as decision 2 says. Plain ECMAScript (AD-1).

*Alternative:* a second copy of the loop in `context/warnings.ts`. Rejected: two copies of an off-by-one-prone measure (brackets, commas, escapes) drift apart.

### 5. Versions: none

No schema set widens: the closing warning is an ordinary `unresolved-pointer` warning (output format since 1.2, `schemas/output/warning.json`), and its message is free text. Main's values when proposed: input format 1.12, output format 1.11, tool envelopes 1.12, board document 1.11, board protocol 1.8, Snapshot data 1.2, view manifest 1.1, configuration 1.0, local API 1.0, session file 1.0. Task 0.2 re-reads them; the rebase task checks that the diff moves none.

### 6. Documents

- The spine, AD-6, Schemas and validation: the sentence "A problem confined to one item that leaves the board usable is a typed warning in a successful result: an unresolved pointer (FR-8), a formula error (FR-14)." gains ", each kind within its share of the result bound: past it, one closing warning counts the rest", amended in place, with a `sources` line for this change and `updated:` set to the documents task's date. AD-13's own clause (`wbs-gantt-consistency`) stays.
- CHANGELOG, Unreleased, Fixed: one line citing Issue #98.
- The as-built note `docs/as-built/result-bound.md`: what was built, the names (`boundedWarnings`, `boundedUnresolvedWarnings`, `UNRESOLVED_WARNINGS_MAX_CHARS`), the worst totals and that no set moved. Never CLAUDE.md (PR #109's rule; Merge points).
- No PRD, UX or skill change: FR-8 says nothing on how many warnings a result holds, and `skills/askboard/references/context.md` says only that an unread pointer is a warning.

## Merge points

Read on 2026-11-09 against `origin/main` ac9f891f. No change in flight edits `core/src/context/warnings.ts`, `core/src/graph-check.ts`, `server/src/mcp-tools/ask.ts` or `update.ts`, or modifies a requirement this change modifies. Every name borrowed above is on `main` (task 0.2 records each with its file and line).

| Change | Branch, head read | What it touches here | Resolution |
|---|---|---|---|
| `agent-facing-gaps` (PR #112) | `worktree-fix-agent-facing-gaps` aabe9979 (base ac9f891f) | `core/src/ask.ts` in `update` (`this.#expandedIds = widgets.expanded;` beside `this.#expansion = widgets.expansion;`, two lines above the warnings this change edits) and in its fetch of a deleted item (`#wasDeleted`); AD-6's typed-results line and the spine's `sources` and `updated:`; mcp-adapter "Tool list", "Server instructions", "Fetching an item" (other requirements); CHANGELOG; binds tool envelopes 1.13 | Keep both sides in `ask.ts`; different lines of AD-6, keep both `sources` lines, the later date; no set here, so its binding is unaffected |
| `reopen-start-from-answer` | `worktree-fix-reopen-start-from-answer` f4d40c6a (base a8f1d0a0) | `core/src/ask.ts:337` (`questionView`, another method); core's new "Unresolved pointers in the comparison" (another requirement, which reads the same unresolved props but no warning); spine `sources`; CHANGELOG | Keep both |
| `document-review` | `worktree-feature-document-review` b43f7b25 (base ac9f891f) | Widens the output format and the tool envelopes (other schemas); spine (AD-1's import line, annotations, manifest, `sources`); CHANGELOG; its own as-built note | Keep both; no set here |
| Records (PR #109) | `worktree-fix-claude-md-conflicts` 981ecf78 | Moves every change's record from CLAUDE.md to `docs/as-built/<change-id>.md` | This change writes `docs/as-built/result-bound.md` and no CLAUDE.md line. If #109 has not merged at the documents task, the note still goes there, and the rebase task keeps it |
| Archive of `wbs-gantt-consistency` (PR #110) | `worktree-fix-archive-wbs` 505a310e | Syncs core's "The send-time graph check" (MODIFIED) and "The closing formula warning" (ADDED) into `openspec/specs/core/spec.md` | This change modifies neither: decision 4 keeps the formula output unchanged. Its core delta modifies "An unresolved pointer never blocks the board", which #110 leaves as it is |

## Risks / Trade-offs

- [A capped list hides unresolved pointers the agent should fix] → The closing warning names the first one left out, counts the rest and says `fetch` returns them; the board marks every one. The cap starts only past 10,000 characters, about 60 typical warnings.
- [The worst closing warning takes most of the share] → Only with a pointer of 1,024 escaped characters, which no file can match and the agent would have to send on purpose; the list then holds that warning and its count, and the result stays within its bound.
- [The refactor of decision 4 changes the formula warnings] → `graph-check-bound.test.ts` and `widget-graph.test.ts` stay unchanged and must pass; the core review checkpoint compares the output on the worst plan before and after.
- [An `update` result still passes the bound through `applied`] → Issue #113, outside this change; the third of the bound left free is its room.
- [A collect page past the bound] → Issue #114, a PO question on AD-6 and AD-20.

## Open Questions

None beyond the PO's, in proposal.md (Open questions for the PO), at their proposed defaults under the PO's unattended handoff; task 0.1 records them and Issue #98 carries them. Nothing here depends on Claude Code's run-time behaviour, so no item needs a probe. What an agent's host does with a result above 30,000 characters is unknown and does not matter: AskBoard keeps its own results within AD-6.
