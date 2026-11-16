---
name: askboard-delivery
description: Runs an AskBoard OpenSpec change end to end with the project's agents, from its GitHub Issue to the pull request that closes it - design with askboard-architect, one askboard-implementer running the task groups in sequence and committing each, then the rebase, the whole check once, one pre-PR review with askboard-spec-reviewer and askboard-security-reviewer, one fix round, and CI's smoke as the e2e gate; also the e2e train on main and its stabilisation change. Use it whenever you propose, apply, implement, continue, resume, review, re-review, fix review findings of, rebase or prepare the pull request of an AskBoard change, dispatch or triage an e2e train, in attended or unattended runs, and whenever /openspec-apply-change's guidance points here. Not for questions, small fixes committed directly on main, or work outside OpenSpec changes.
---

# Delivering an AskBoard change with the project's agents

The session that runs this skill is the coordinator. It holds the change's state (ids, SHAs,
findings), delegates the file-heavy work to the agents, and keeps their conclusions, not their
reading. OpenSpec owns the artifacts: everything written under `openspec/changes/<id>/` goes through
the `openspec-*` skills. GitHub Issues own the backlog: a change starts from its Issue, and the
`askboard-backlog` skill holds the procedure and the commands for every step below that touches one.

The flow is shaped to cut delivery time and token cost (the PO's answer on #227, 2026-11-16): one
implementer per change, no review between groups, one review before the pull request, and the
end-to-end suites on CI rather than in the change.

## 1. Team, model and effort

| Agent | Does | Model | Default effort | Raise to |
|---|---|---|---|---|
| `askboard-architect` | proposal, design, specs, tasks; `/openspec-update-change` | opus | high | xhigh only to design a new epic |
| `askboard-implementer` | the change's task groups in sequence, tests first; the fix round | sonnet | medium | high for contract and core groups, rebase conflicts, a second attempt |
| `askboard-spec-reviewer` | conformance, scenarios to tests, versions and seams, documents | opus | medium | none |
| `askboard-security-reviewer` | invariants and threats, only when the diff touches the paths in step 4.3 | opus | high | none |

Spawn each with its own name as the subagent type. When the effort differs from the agent's
default, pass it on the Agent call: this skill asks for it explicitly. Judgment goes to the stronger
model and throughput to the faster one; raise effort for the call that needs it instead of running
everything high.

## 2. What every call carries

- the change id, its Issue numbers and the absolute worktree path;
- for the implementer: the groups to run, from the first not done, or the fix tasks with their
  finding IDs; when it resumes another implementer's work, that one's handoff note;
- for a reviewer: the base and head SHAs, the scope, and the IDs of findings already open.

Record each group's head (`git rev-parse HEAD`) as its commit lands: a handoff resumes from it.

## 3. Flow

0. **Triage.** A question, a typo or a configuration fix is not delivery work: answer it, or commit
   it directly on `main` as AGENTS.md allows. For a change, find its Issue, or open one after the
   duplicate search (the `askboard-backlog` skill); a change with no Issue is the exception, and its report
   says why. Then read `openspec list` and `openspec status --change <id>`, and resume at the first
   step not done.
1. **Worktree.** A change runs in an integrated worktree `feature-<slug>` (AGENTS.md, Git / PR
   Working Policy).
2. **Design.** `askboard-architect` proposes the change, or revises it, given the Issue numbers; the
   proposal cites `Issue: #n`. The artifacts keep the limits of `openspec/config.yaml` (about 30
   tasks, one line each; a larger change is split into stacked changes). Once the change exists,
   comment on each Issue with the change id and the branch, and add `in-change`. The architect's
   open questions for the PO go on the Issue as a comment with `needs-po`, or as their own
   `type:question` Issue when separate; wait for the PO's answers and the proposal's approval before
   applying. In an unattended run, record the proposed defaults as such and apply only the groups the
   open questions do not touch.
3. **The groups.** One `askboard-implementer` runs the groups in sequence, in the order of the tasks
   preamble, even groups the preamble marks as parallel. For each group:
   1. Tests first; during the group only the tests it touches, the typecheck and the lint
      (`askboard-implementation`).
   2. One commit per group (conventional commit; scope = package or change) holding the code, the
      tests, the ticks and any notes: no separate notes, ticks or "wip" commits.
   3. No review checkpoint: go on with the next group.

   When its context runs low, the implementer stops after a group's commit and returns a short
   handoff note: the last group committed and its head, the next group, the open questions, and what
   the commits do not say. A fresh implementer resumes from it. A defect the change will not fix
   becomes an Issue with `source:review` and its areas.
4. **Before the pull request:**
   1. Rebase onto `origin/main`. Bind the version labels and re-check the borrowed seams with
      `askboard-contract-versioning`. Run the implementer at high effort for conflicts.
   2. The whole check, once per change: `GITHUB_TOKEN=$(gh auth token) bun run check`, then
      `bun run build`. No local full or multi-engine `test:e2e`: CI's smoke and the e2e train
      (section 4) replace it.
   3. Pre-PR review, merge base to head: `askboard-spec-reviewer` at medium. Add
      `askboard-security-reviewer` at high, in parallel, only when the diff touches
      `packages/server/src/board-host/` (with `local-api/`), `packages/hooks`, `packages/mod`, the
      contract's schemas or validators, the view's sandbox or page policy, the file system or the
      network.
   4. One fix round (`askboard-review-protocol`, section 6): the implementer fixes the findings tests
      first, and the same reviewer re-reviews only the M and H findings. An L finding is not
      re-reviewed: it is fixed in the round, accepted in the as-built note, or deferred to an Issue.
      An M or H finding still open after the re-review goes to the PO, with its Issue.
   5. The kaizen retrospective of the development workflow, then the pull request. Its body says
      `Closes #n`, or `Refs #n` when the Issue spans several changes (the last one says `Closes`).
   6. The e2e gate is CI's smoke run on the pull request, informative: read its conclusion with
      `gh pr checks <n>`, never its log, and report it. A change that alters the runner, the browser
      harness or a widget's rendering also asks for a train on its branch before merge:
      `gh workflow run e2e.yml --ref <branch> -f cadence=nightly`, then the conclusion of
      `gh run list --workflow e2e.yml --branch <branch> --limit 1`, reported in the pull request.
5. **Before `/openspec-archive-change`:** the pull request is merged; every Verify task is ticked or its reason
   recorded; the change's as-built note `docs/as-built/<change-id>.md`, written once at the end of
   the change, describes it as built (the change never edits AGENTS.md for its own record, and the
   archive does not touch it); the PRD, spine and UX documents carry the updates the change states.
   The archive pull request says `Refs #n` and never reopens the Issue.

## 4. The e2e train

- The full three-engine suite runs on CI, never inside a change: `e2e.yml`'s nightly cadence on
  `main`, every night or dispatched after a batch of merges
  (`gh workflow run e2e.yml --ref main -f cadence=nightly`).
- Its failures become Issues labelled `source:e2e`, after the duplicate search (`askboard-backlog`,
  End-to-end test sessions): a failure an open Issue already holds gets no second one.
- One stabilisation change per train fixes them, in one session with one implementer. Changes in
  flight never stop for them.

## 5. Errors and conflicts

- An agent call fails or returns nothing usable: retry once with a sharper brief. Then carry on
  without it, and record the omission in the commit body and in the final report.
- Results conflict (two reviewers, a reviewer and the implementer): keep both with their source;
  decide by the rule they cite, or ask the PO. Never delete either silently.
- The implementer reports a design problem: stop the groups that depend on it, run the architect
  through `/openspec-update-change`, then resume.
- Unattended runs: the end of a group is not a stopping point. Go on with the next unblocked group,
  record the PO's questions on the Issues (`needs-po`) and in the change, and report at the end.
  Never push, merge or touch `main` unless the handoff says so.

## 6. Report to the PO

At the end of a run: the Issues the change resolves; the groups done; the review findings by
severity, with their status, and the Issue numbers of those deferred; the checks run and their
results, with the smoke's conclusion and the train's when one ran; the open questions as the numbers
of the Issues that carry them (`needs-po`), never only in the report; what is left for the PO (live
runs, hand checks, decisions).

## 7. When the harness itself should change

Route what you learn to the right place: output quality to the skill that covers it, a missing or
miscast role to an agent definition, a wrong order to this skill, a missed trigger to a description.
Signals: a finding class that recurs, an agent that keeps failing or is bypassed, a step the PO keeps
redoing by hand. Record every change to the harness as a row of its change history, `docs/harness-history.md`
(AGENTS.md, Agent harness).
