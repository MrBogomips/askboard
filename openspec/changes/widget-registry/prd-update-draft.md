# PRD update draft: widget registry

**Status: to apply in task 0.1.** The proposal's open question 2 was answered on 2026-11-06 with its default, under the PO's unattended handoff; the PO may revisit. The block quotes the current text exactly, as the PRD stands on this change's base (`origin/main` fd80950b plus PR #38's archives), then gives the replacement. It goes with block 4 of `spine-update-draft.md`.

File: `docs/prd-askboard-2026-10-25/prd.md`.

How to apply: check that the current text stands once (`git grep -c`), replace it and set `updated:` to the apply date. If another change has merged a different text into this paragraph meanwhile, keep its text and add this block's words to it, and say so in task 0.1's note.

## Block 1: FR-20, first paragraph, last sentence

Current:

```text
When what changed and the derived values would not fit in one tool result, the answer says so and carries neither, and the agent fetches them.
```

Replacement:

```text
When what changed, the widgets' results and the derived values would not fit in one tool result, the answer says so and carries none of them, and the agent fetches them.
```
