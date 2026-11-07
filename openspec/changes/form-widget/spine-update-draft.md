# Spine update draft: form-widget

**Status: applied by task 0.1 on 2026-11-07.** It rests on the proposal's open questions 1, 3 and 4, answered on 2026-11-07 with their defaults under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly as it stands on the base 886739d3 (`atoms` and `layouts` applied their own blocks there; none of these phrases), then gives the replacement. AD-7 is amended in place; no AD is added or renumbered. The PRD needs no change: FR-11's Form row stands as written.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: check that each current phrase stands once (`grep -c -F`), replace only the phrase (block 2 removes its whole line), set `updated:` to the apply date, and append to `sources:` the line `'OpenSpec change form-widget, proposal.md, open questions 1, 3 and 4: the Form built from the input atoms and a PickField with no form library, field checks in the registry, the pattern run only in the view (accepted under the PO''s unattended handoff, 2026-11-07)'`. Then run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these lines meanwhile, keep its text, apply this block's change to it, and say so in task 0.1's note.

## Block 1: AD-7, field checks in the registry (open questions 3 and 4)

AD-7, Rule, Content, Widget types. Current phrase:

```text
Per type it gives the props schema and checks, the element shape and `changes` schema when the user edits the agent's content, the result schema and checks when the widget gives a result, the derived declarations of AD-13, the agent-facing wording and an example item.
```

Replacement:

```text
Per type it gives the props schema and checks, the element shape and `changes` schema when the user edits the agent's content, the result schema and checks when the widget gives a result, the field check of an input field (`required`, a text's `minLength` and `pattern`, a pick's `minItems` and `maxItems`), the derived declarations of AD-13, the agent-facing wording and an example item. A value that fails only its field check stays in the draft: the board shows its field error and blocks the question's answer, and `ask-core` refuses an answer that fails one, except a `pattern`, which runs only in the view, on the user's text, within the safe subset checked when the ask is sent.
```

## Block 2: Stack, no form library (open question 1)

Stack table. Current line, removed whole:

```text
| `@rjsf/core`, `@rjsf/utils` (Form) | 6.11.0 |
```

Replacement: none (the line goes). The Form is built from the input atoms and the PickField (OpenSpec change `form-widget`, design decision 1); `radix-ui`'s row already names Radio Group and Checkbox.
