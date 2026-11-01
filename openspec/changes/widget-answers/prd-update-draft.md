# PRD update draft: widget answers

**Status: applied on 2026-11-01.** The PO accepted open question 10 on 2026-11-01, and the block below was applied to the PRD in place, FR-20's ID unchanged. One block, for FR-20. It applies only if the PO accepts the proposal's open question 10 (an answer too large for one result); otherwise it does not apply and the PRD stays as it is. It quotes the current text exactly, as `main` holds it at 92ca203, then gives the replacement. FR IDs stay as they are. The spine change that goes with it is block 1 of `spine-update-draft.md`.

File: `docs/prd-askboard-2026-10-25/prd.md`.

Why: FR-20's third consequence ("No single answer AskBoard returns exceeds Claude Code's limit on the size of a tool result") cannot hold together with its first sentence for every edit the widgets allow: a Tree of 500 nodes whose every node the user renames gives `changes` far over a result. The replacement keeps the consequence and says what the answer carries then.

How to apply: replace the quoted text, set `updated:` in the PRD's front matter to the apply date, then run `openspec validate --all --strict --no-interactive`. Since the apply, the replacement text stands in the PRD word for word and the current text no longer does; task 6.1 checks that after the rebase.

Checked on 2026-11-01 against the PRD on this branch, based on `main` at 92ca203: the current text stood word for word, once, so the block was applied, with `updated: 2026-11-01`.

## Block 1: FR-20, description and consequences

Current:

```text
For a widget the user edits, the answer carries only what changed from what the agent sent, together with the derived values. The agent can fetch the full result by ask ID and item ID when it needs it.

**Consequences (testable):**
- In a 200-node WBS where the user changed 3 nodes, the answer describes the 3 changes, not the 200 nodes.
- The agent can fetch the full edited structure of any answered item while its ask is open; after a revision, it fetches the latest answer's (FR-22).
- No single answer AskBoard returns exceeds Claude Code's limit on the size of a tool result.
```

Replacement:

```text
For a widget the user edits, the answer carries only what changed from what the agent sent, together with the derived values. The agent can fetch the full result by ask ID and item ID when it needs it. When what changed and the derived values would not fit in one tool result, the answer says so and carries neither, and the agent fetches them.

**Consequences (testable):**
- In a 200-node WBS where the user changed 3 nodes, the answer describes the 3 changes, not the 200 nodes.
- The agent can fetch the full edited structure of any answered item while its ask is open; after a revision, it fetches the latest answer's (FR-22).
- No single answer AskBoard returns exceeds Claude Code's limit on the size of a tool result.
- When the user changes every node of a 500-node WBS, the answer says that its changes are too large to carry, and the agent fetches the edited WBS and its derived values.
```
