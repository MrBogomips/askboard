# PRD update draft: askboard skills

**Status: applied in task 0.1 on 2026-11-07.** The proposal's open question 1 was answered on 2026-11-06 with its default, under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly, as the PRD stands on this change's base (`widget-registry` at d5adfb2f), then gives the replacement. It goes with `spine-update-draft.md`.

File: `docs/prd-askboard-2026-10-25/prd.md`.

How to apply: check that each current text stands once (`git grep -c -F`), replace it and set `updated:` to the apply date. If another change has merged a different text into one of these lines meanwhile, keep its text and add this block's words to it, and say so in task 0.1's note.

## Block 1: FR-28, Consequences, last bullet

Current:

```text
- One installation brings the MCP tools, the skills and the agents together.
```

Replacement:

```text
- One installation brings the MCP tools, the skills and any shipped agents together.
```

## Block 2: FR-29, first paragraph, first sentence

Current:

```text
AskBoard ships skills and agents that teach Claude Code agents when to use AskBoard rather than AskUserQuestion,
```

Replacement:

```text
AskBoard ships skills, and agents where a task needs one of its own, that teach Claude Code agents when to use AskBoard rather than AskUserQuestion,
```
