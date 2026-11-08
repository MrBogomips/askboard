# Spine update draft: atoms

**Status: applied on 2026-11-07 (task 0.1).** The proposal's open questions 5 and 8 were answered on 2026-11-07 with their defaults, under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly as it stands on `origin/main` ea05608f, then gives the replacement. AD-7, AD-8 and AD-20 are amended in place; no AD is added or renumbered. The PRD needs no change.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: check that each current phrase stands once (`git grep -c -F`), replace only the phrase (the rest of its line stays), set `updated:` to the apply date, and append to `sources:` the line `'OpenSpec change atoms, proposal.md, open questions 5 and 8: the FR-13 atoms in the registry, Markdown links through the board page, unreadable field text kept as entries (accepted under the PO''s unattended handoff, 2026-11-07)'`. Then run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these lines meanwhile, keep its text, apply this block's addition to it, and say so in task 0.1's note.

## Block 1: AD-7, the registry holds the atoms

AD-7, Rule, Content, Widget types. Current phrase:

```text
`contract` holds one registry of widget types.
```

Replacement:

```text
`contract` holds one registry of widget types, the FR-13 atoms' included.
```

## Block 2: AD-8, links in agent Markdown (open question 8)

AD-8, Rule, Talking to the outside, second bullet. Current phrase:

```text
A reference leaves the view only as an open-link message.
```

Replacement:

```text
A reference, or a link in agent Markdown, leaves the view only as an open-link message; an image in agent Markdown shows as a link to its source.
```

## Block 3: AD-20, entries in the draft (open question 5)

AD-20, Rule, Drafts, first bullet. Current phrase:

```text
and also the question's context placement, the text in its follow-up composers and the user's notes on options.
```

Replacement:

```text
and also the question's context placement, the text in its follow-up composers, the user's notes on options and the entries: the text an input atom holds that gives no value, which keeps its question from being answered until the user corrects or clears it.
```
