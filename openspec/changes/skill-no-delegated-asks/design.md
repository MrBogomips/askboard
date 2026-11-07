## Context

See proposal.md for why. State on this branch's base, 004e655e (PR #45, `chore(openspec): archive askboard-skills`, open; it stacks on `origin/main` 66fd51f3 plus #44):

- `tools/build/skills/templates/SKILL.md:44` is the ownership line ("With AskBoard's hooks, an ask belongs to the agent that sent it ... A subagent's ask closes when the subagent finishes: an answer given later ... is lost"); `:45` is the line this change replaces ("Only for a side dialogue ... start a background subagent that asks, waits and returns them"); `:46` opens "Keep working after `ask`." The generated `skills/askboard/SKILL.md` holds them at `:52` to `:54`; it is 5,845 of 9,000 characters and 68 of 250 lines.
- `tools/build/skills/generate.test.ts:189` asserts the side-dialogue line; `:151` ("teaches delivery and follow-ups") asserts "Keep working".
- `openspec/specs/skills/spec.md:147` holds "Dialogues in a background subagent" with one scenario.
- The pattern stands nowhere else outside archived and spike changes (`git grep -i "side dialogue\|delegated dialogue\|asks, waits"`), except the spine's Deferred row "Shipped agents (FR-29)" (`ARCHITECTURE-SPINE.md:842`), whose second trigger clause is a benchmark case "S7 (a delegated dialogue of three questions)". The seed set already names S7 "LaTeX formula" (`SOLUTION-DESIGN.md` §7, line 436; `early-benchmark`). That clause came from the support-agents evaluation of 2026-11-07, which the spine's `sources:` names (`:35`) and which is not in the repository; its candidate C was the background dialogue.
- FR-29, FR-30 and the addendum teach that a subagent asks its own questions through AskBoard and returns a question it cannot ask; none states the delegated pattern. No AD states it.

ADs relied on: AD-4 (an owner's own asks never block it; push to a working owner; `collect` waits 20 minutes at most), AD-5 (an ask belongs to the agent that sent it), AD-6 (the skill is generated, and `check:skills` fails on drift and over budget).

## Goals / Non-Goals

**Goals:**

- The skill never advises a subagent to ask on another agent's behalf, and a test keeps it so in every generated file.
- The spine no longer carries a trigger that rests on the pattern.

**Non-Goals:**

- Changing what a subagent does with its own questions (routing, fallbacks) or the ownership line.
- Changing the hooks, the mod or `ask-core`: a subagent's ask still closes when it finishes (FR-25).
- A shipped agent: the Deferred row keeps its S6 trigger.

## Decisions

### 1. REMOVED plus ADDED, not RENAMED plus MODIFIED

The old requirement's behaviour is reversed, not renamed. REMOVED carries the PO's decision as its Reason and Migration into the archived spec, and the ADDED requirement states the new behaviour on its own; `openspec validate --strict` passes on it (checked when proposing). "Ownership of an ask" needs no word: it already states what the new line's reason rests on, conditioned on AskBoard's hooks.

### 2. The wording

Template line 45 becomes, in place:

> - Ask from the agent that needs the answers. Your own asks never block you: keep working while the user answers. Never hand your questions to a subagent to ask for you: its ask closes when it finishes, and later answers are lost.

Line 46's "Keep working after `ask`." would repeat it, so line 46 becomes "After `ask`, the user gets a notice and a link. Never open the board or answer it yourself." The delivery test's "Keep working" assertion moves to "keep working while the user answers"; "Delivery and follow-ups" is still met (the line is in "After you ask"). The reason follows the ownership line just above it, which states the close as holding with AskBoard's hooks. `SKILL.md` grows by a few characters only; `check:skills` and the always-loaded total do not move (the description is unchanged).

### 3. The guard test

One test reads every file `generateSkill()` writes (the `files` map the test file already builds) and fails if any contains "background subagent", "side dialogue" or "asks, waits and returns". A test asserting the new line replaces the one at `:189`; the routing test keeps "A subagent cannot use AskUserQuestion: it asks every question through AskBoard".

### 4. The spine

In the Deferred row "Shipped agents (FR-29)":

- the "Revisit when" cell ends after "need an `isError` retry": the clause from "; or a new case S7" to "with equally valid asks" goes;
- the "Why it can wait" cell gains a last sentence: "A dialogue delegated to a subagent is no use for one: the skill advises against it (OpenSpec change `skill-no-delegated-asks`, which rejects the support-agents evaluation's candidate C)."

`sources:` gains, last: `'OpenSpec change skill-no-delegated-asks, proposal.md: no subagent asks on another agent''s behalf; the support-agents evaluation''s candidate C (a background dialogue) rejected (PO decision, 2026-11-07)'`. `updated:` already reads 2026-11-07. No AD is amended or added; `SOLUTION-DESIGN.md` and the PRD stay as they are.

### 5. Nothing needs a probe

The change removes advice that rested on unprobed behaviour (`askboard-skills` decision 11); it assumes nothing new about Claude Code. The archived `askboard-skills` task 4.1 still asks the PO to run a background subagent that asks its own question, which this change keeps.

## Merge points

No seam is borrowed and no contract schema set moves. Overlaps:

- **PR #45 (`askboard-skills` archive, 004e655e, open).** The base: `openspec/specs/skills/spec.md` exists only there. This change's pull request waits for #45's merge, then rebases with `git rebase --onto origin/main 004e655e` (task 3.1).
- **`approval-scale-ranking`** (`worktree-feature-approval-scale-ranking` at 5fbdeb86): regenerates `skills/askboard/SKILL.md` (three item-index lines), not the template. Whichever rebases second resolves the generated file by rerunning `bun run build:skills`, never by hand.
- **`latex-kanban-timeline`** (`worktree-feature-latex-kanban-timeline` at 13aee2ca): carries the spine's Deferred row and `sources:` from `askboard-skills` and regenerates `SKILL.md`. If it rebases after this change, it keeps this change's row text and both changes' `sources:` lines, and regenerates the skill.
- **`early-benchmark`** (in `openspec/changes/`): its spine draft edits the Deferred `alwaysLoad` row, not this one; removing the S7 clause resolves the name clash with its S7.

## Risks / Trade-offs

- [An agent with a long dialogue now keeps it in its own context] → Asks are cheap (AD-6) and follow-ups need that context; the benchmark's SM-1 figures show the cost.
- [A later change reintroduces the pattern in a template or a reference] → The guard test fails on every generated file.

## Migration Plan

Merge after #45. Users get the new `SKILL.md` with the next plugin build; nothing is stored, so there is no rollback beyond reverting the commit.
