---
name: askboard-delivery
description: Runs an AskBoard OpenSpec change end to end with the project's agents - design with askboard-architect, implementation one task group at a time with askboard-implementer, a review checkpoint after each group with askboard-spec-reviewer and askboard-security-reviewer, fixes tests first, then the rebase, the checks and the pre-PR review. Use it whenever you propose, apply, implement, continue, resume, review, re-review, fix review findings of, rebase or prepare the pull request of an AskBoard change, in attended or unattended runs, and whenever /opsx:apply's guidance points here. Not for questions, small fixes committed directly on main, or work outside OpenSpec changes.
---

# Delivering an AskBoard change with the project's agents

The session that runs this skill is the coordinator. It holds the change's state (ids, SHAs,
findings), delegates the file-heavy work to the agents, and keeps their conclusions, not their
reading. OpenSpec owns the artifacts: everything written under `openspec/changes/<id>/` goes through
the opsx skills.

## 1. Team, model and effort

| Agent | Does | Model | Default effort | Raise to |
|---|---|---|---|---|
| `askboard-architect` | proposal, design, specs, tasks; `/opsx:update` | opus | xhigh | none; lower to high for small updates |
| `askboard-implementer` | one task group, tests first | sonnet | medium | high for contract and core groups, rebase conflicts, a second attempt |
| `askboard-spec-reviewer` | conformance, scenarios to tests, versions and seams, documents | opus | medium | high for the pre-PR review |
| `askboard-security-reviewer` | invariants and threats | opus | high | xhigh for the pre-PR review |

Spawn each with its own name as the subagent type. When the effort differs from the agent's
default, pass it on the Agent call: this skill asks for it explicitly. Judgment goes to the stronger
model and throughput to the faster one; raise effort for the call that needs it instead of running
everything high.

## 2. What every call carries

- the change id and the absolute worktree path;
- for the implementer: the group number, or the fix tasks with their finding IDs;
- for a reviewer: the base and head SHAs, the scope, and the IDs of findings already open.

After each group is committed, record `git rev-parse HEAD`: it is the head of that group's review
and the base of the next one.

## 3. Flow

0. **Triage.** A question, a typo or a configuration fix is not delivery work: answer it, or commit
   it directly on `main` as CLAUDE.md allows. For a change, read `openspec list` and
   `openspec status --change <id>`, and resume at the first step not done.
1. **Worktree.** A change runs in an integrated worktree `feature-<slug>` (CLAUDE.md, Git / PR
   Working Policy).
2. **Design.** `askboard-architect` proposes the change, or revises it. Relay its open questions to
   the PO and wait for the proposal's approval before applying. In an unattended run, record the
   proposed defaults as such and apply only the groups the open questions do not touch.
3. **Each group,** in the order of the tasks preamble:
   1. `askboard-implementer` on the group. Groups the preamble marks as parallel run as parallel
      calls only when they touch different packages; groups on the same package run in sequence.
   2. Commit the group (conventional commit; scope = package or change) and record its head.
   3. Review checkpoint: `askboard-spec-reviewer` on the group's range. Add
      `askboard-security-reviewer`, in parallel, when the group touches
      `packages/server/src/board-host/` (with `local-api/`), `packages/hooks`, `packages/mod`, the
      contract's schemas or validators, the view's sandbox or page policy, the file system or the
      network.
   4. Fold the findings (`askboard-review-protocol`, section 6). The implementer fixes them tests
      first, then the same reviewer re-reviews the fix range.
4. **Before the pull request:**
   1. Rebase onto `origin/main`. Bind the version labels and re-check the borrowed seams with
      `askboard-contract-versioning`. Run the implementer at high effort for conflicts.
   2. `GITHUB_TOKEN=$(gh auth token) bun run check`, then `bun run build`.
   3. `bun run test:e2e` when the change touches the view, the server or the conformance suite, with
      the conformance runs on both runtimes (CLAUDE.md, CI section).
   4. Pre-PR review: both reviewers in parallel, merge base to head, at raised effort. Fold, fix and
      re-review.
   5. The kaizen retrospective of the development workflow, then the pull request.
5. **Before `/opsx:archive`:** the pull request is merged; every Verify task is ticked or its reason
   recorded; the CLAUDE.md Status and "In code since" lines describe the change as built; the PRD,
   spine and UX documents carry the updates the change states.

## 4. Errors and conflicts

- An agent call fails or returns nothing usable: retry once with a sharper brief. Then carry on
  without it, and record the omission in the task note and in the final report.
- Results conflict (two reviewers, a reviewer and the implementer): keep both with their source;
  decide by the rule they cite, or ask the PO. Never delete either silently.
- The implementer reports a design problem: stop the groups that depend on it, run the architect
  through `/opsx:update`, then resume.
- Unattended runs: the end of a group is not a stopping point. Go on with the next unblocked group,
  record the PO's questions in the change, and report at the end. Never push, merge or touch `main`
  unless the handoff says so.

## 5. Report to the PO

At the end of a run: the groups done; the review findings by severity, with their status; the checks
run and their results; open questions; what is left for the PO (live runs, hand checks, decisions).

## 6. When the harness itself should change

Route what you learn to the right place: output quality to the skill that covers it, a missing or
miscast role to an agent definition, a wrong order to this skill, a missed trigger to a description.
Signals: a finding class that recurs, an agent that keeps failing or is bypassed, a step the PO keeps
redoing by hand. Record every change to the harness in the change history of CLAUDE.md's Agent
harness section.
