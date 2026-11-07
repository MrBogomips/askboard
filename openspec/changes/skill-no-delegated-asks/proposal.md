## Why

The shipped skill advises a background subagent that asks, waits and returns the answers for a "side dialogue" (`skills/askboard/SKILL.md:53`, from `askboard-skills` design decision 11). Weighed at the PO's request on 2026-11-07, its advantage does not hold up against its risk, and by the PO's rule the behaviour goes:

- **Advantage claimed, already given or small.** The agent keeps working while the user answers without any subagent: its own asks never block it, and push delivers each answer to a working owner (FR-21, FR-22, AD-4). Keeping a long dialogue out of the main context saves little: asks are cheap by design (AD-6), the answers come back to the main conversation anyway, and follow-ups need the main conversation's context to be answered well, while the subagent answers them from its brief only.
- **Risks, all from binding text or recorded facts.** An ask belongs to the agent that sent it (AD-5) and closes when a subagent finishes (FR-25): a postponed answer (UJ-2), or any answer given after the subagent ends, is lost with the user's work. The main conversation can neither `collect`, `update`, `fetch` nor `snapshot` the ask. Answers arrive as one batch at the end, not as they come (FR-22). A `collect` wait lasts 20 minutes at most (AD-4) and each wake of a subagent pays the 5-minute cache TTL (addendum, benchmark protocol). The brief plus the subagent's own ask cost more output tokens than asking directly (SM-1). How the hooks bind and guard a background subagent's ask, and whether it meets permission prompts, was never probed (`askboard-skills` decision 11, "needs probe"; its PO task 4.1 not run). The mod delivery spike's first background-subagent run of criterion 7 was inconclusive because the subagent had ended when the answer came (`openspec/changes/spike-mod-delivery/findings.md:350`).

## What Changes

- `SKILL.md`'s "After you ask" section no longer offers any subagent to ask on another agent's behalf. It says: ask from the agent that needs the answers; your own asks never block you, so keep working while the user answers; do not hand your questions to a subagent to ask for you, since its ask closes when it finishes and later answers are lost.
- Unchanged: a subagent asks the questions of its own task through AskBoard (routing), the ownership line, the fallbacks.
- The spine's Deferred row "Shipped agents (FR-29)" loses its trigger's second clause, the new benchmark case "S7 (a delegated dialogue of three questions)", which rests on the removed pattern and clashes with the seed set's S7 (LaTeX formula, `SOLUTION-DESIGN.md` §7, and `early-benchmark`). The support-agents evaluation's candidate C (a background dialogue) is recorded as rejected. No AD changes; FR-29 and the addendum do not state the pattern and stay as they are.
- No contract schema set changes; no version moves.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skills`: the requirement "Dialogues in a background subagent" is removed and replaced by "Asking from the agent that needs the answers"; the skill offers no subagent that asks on another agent's behalf.

## Impact

- `tools/build/skills/templates/SKILL.md`, `tools/build/skills/generate.test.ts`, and the generated `skills/askboard/SKILL.md` (regenerated, never hand-edited). The `check:skills` budgets stay met.
- `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`: the Deferred row for shipped agents and the `sources:` list.
- Serves FR-21, FR-22, FR-25, FR-29, SM-1, UJ-2, NFR-10 (an answer the user gave is never silently dropped by the advice the skill gives); relies on AD-4, AD-5, AD-6.
