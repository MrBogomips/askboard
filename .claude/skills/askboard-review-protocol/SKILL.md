---
name: askboard-review-protocol
description: The review protocol for AskBoard OpenSpec changes - how to pin the review target (worktree, base..head SHAs, change, scope), group checkpoints versus pre-PR reviews versus fix re-reviews, what not to report, adversarial self-verification of each finding, the S-n/X-n finding format and severities, and how the coordinating session turns findings into tasks. Use it whenever an AskBoard change, task group, fix range or pull request is reviewed for spec conformance or security, by a reviewer agent or by the session that requests the review and folds its findings in. Not for reviewing code outside this repository.
---

# Reviewing an AskBoard change

A review is worth its cost only when it looks at the right code, reports what survives an honest
attempt to refute it, and lands as tasks the implementer can run. Each section below exists because
one of those three went wrong at least once in this project.

## 1. Pin the target before reading anything

A review needs four facts:

| Fact | Form |
|---|---|
| Worktree | absolute path |
| Range | base and head as commit SHAs, not branch names that move |
| Change | the OpenSpec change id |
| Scope | task groups (for example "group 3"), a fix range, or "whole change" |

Check them with commands run in the worktree:

```sh
git -C <worktree> rev-parse --show-toplevel HEAD
git -C <worktree> log --oneline <base>..<head>
cd <worktree> && openspec status --change <id>
```

Refuse the review, saying what is missing, when a fact is absent or the facts disagree: the worktree
is not at head, the range is empty, the change does not exist in that worktree. In E5 the security
review ran twice on another worktree's diff (`openspec/changes/excerpts/tasks.md`, task 8.1), and
nobody noticed until later.

Read only from the pinned worktree: `git -C <worktree> diff <base>..<head>`, and file paths under
the worktree. Never read the main checkout's copy of a file under review.

When the session is isolated in another worktree and refuses git commands in the pinned one, read
the head from the pinned worktree's git metadata (`.git` names its gitdir, which holds `HEAD`), run
`git diff <base>..<head>` from your own worktree (the object store is shared), and read files by
their absolute paths under the pinned worktree, checking that each matches the head's blob
(`git hash-object <file>` against `git rev-parse <head>:<path>`). To run tests at the head without
touching a shared worktree, extract it into a temporary folder and install there:
`D=$(mktemp -d); git archive <head> | tar -x -C "$D"; (cd "$D" && bun install --frozen-lockfile)`.
Both reviewers did this on their own in the first evaluation (2026-11-06).

## 2. Kinds of review

| Kind | Range | Reads | Default effort |
|---|---|---|---|
| Group checkpoint | the group's commits | the group's tasks, the requirements and decisions they cite, the diff, the code the diff reaches | spec medium, security high |
| Fix re-review | the fix commits | each finding being fixed, its fix and its test | as the original |
| Pre-PR | merge base with `origin/main` to head | the whole change, the seams between groups, the documents, the Issue links | spec high, security xhigh |

A fix re-review reports each finding as closed or still open, plus anything the fix broke.

The pre-PR spec review also checks the backlog links (`AGENTS.md`, The backlog): the proposal cites
`Issue: #n` for each Issue the change resolves, each one open (`gh issue view <n>`), and the
pull request body the coordinator will write says `Closes #n`, or `Refs #n` when the Issue spans
several changes and this is not the last. A missing or wrong link is an L finding citing that rule.

## 3. What not to report

- Formatting and lint that Biome enforces, and type errors: `bun run check` catches them.
- Items the change already accepted or deferred: read the change's `tasks.md` notes and its "Fixes
  from review" groups, and design.md's Risks and Open Questions. Report one again only when the range
  makes it worse, and say how.
- Items an Issue already holds: search before reporting
  (`gh issue list --repo MrBogomips/askboard --state all --search "<key words> in:title,body"`).
  Report one again only when the range makes it worse, and name the Issue.
- Taste. Every finding cites the rule it breaks: a requirement or scenario, a design decision, an
  FR, NFR or AD ID, an invariant, a UX section, or a convention in CLAUDE.md or AGENTS.md.

## 4. Verify each finding before reporting it

For each candidate:

1. Write the failing scenario concretely: the input or state, and the wrong outcome.
2. Try to refute it: look for the guard, the test that covers it, the caller that prevents it.
3. Prefer evidence that runs: a focused `bun test <file>`, or a throwaway probe in a temporary
   directory (`mktemp -d`), never written into the repository.
4. Give a confidence from 0 to 100. Report findings at 80 or more; list those from 60 to 79 under
   "Unconfirmed", each with what would confirm it; drop the rest.

## 5. Severities and format

- **H**: breaks an invariant (fail closed, the token, local machine only, agent content as data, no
  telemetry, the licence rule), loses or invents an answer, or makes a requirement scenario fail.
- **M**: a scenario untested or only partly implemented; a binding document out of step with the
  code; inconsistent versions or seams; a missing bound on untrusted input.
- **L**: a robustness or clarity defect with a concrete consequence.

IDs are S-n for the spec reviewer and X-n for the security reviewer, numbered within one report.

The example is the token leak PR #8 found and fixed:

```markdown
### X-2 (H) The view reads the link token through document.baseURI
- Rule: AD-8 (the token stays out of the view); NFR-4
- Where: tools/build/board-page.ts (the board page's HTML has no base element)
- Scenario: the board page is opened from its link, `?t=<token>`; the view's srcdoc document takes
  its base URL from the page's URL, so `document.baseURI` in the view holds the token, in Chromium,
  Firefox and WebKit, and again in Firefox after the page's URL changes
- Evidence: the browser harness reads `document.baseURI` in the view and finds `?t=`
- Confidence: 95
- Fix task (tests first): a browser test in the three engines that expects no token in the view's
  `document.baseURI` on first load, after a reload and after a URL change; then `<base href="/">`
  in the board page, allowed by `base-uri 'self'`
```

End the report with:

- counts by severity, the range reviewed and the scope;
- "Unconfirmed" candidates;
- the areas checked with no finding, one line each, so the caller knows the coverage;
- what was not reviewed, and why.

## 6. From findings to tasks (the coordinating session)

Reviewers write nothing in the repository and open no Issues. The session that asked for the
review:

- folds H and M findings into the change through `/opsx:update`, as fix tasks with tests first, in a
  "Fixes from review" group, with the finding IDs in the task text (E4 did this with M1 to M7);
- folds each L finding, or defers it: records it in `tasks.md` with a reason and opens an Issue for
  it (`type:defect`, the finding's severity, `source:review`; the finding ID, the change and the
  range in its Origin; `AGENTS.md`, The backlog), so it outlives the archived change. A finding the PO
  accepts as deferred, at any severity, becomes an Issue the same way;
- when two reviews disagree, keeps both views with their source and decides by the rule they cite, or
  asks the PO; it never drops a finding silently;
- asks for a fix re-review of the fix range once the fixes are in.

## 7. Patterns that recur

Reviewers with memory keep recurring patterns, not the findings of one change. A pattern seen in
three changes is a candidate rule for a skill (`askboard-implementation`, `askboard-threat-model` or
`askboard-contract-versioning`); the coordinator proposes it at the kaizen step before the pull
request.
