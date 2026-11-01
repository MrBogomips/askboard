# Spine update draft: widget answers

**Status: applied on 2026-11-01.** The PO accepted open questions 9, 10, 11 and 16 on 2026-11-01, and both blocks below were applied to the spine in place, their IDs unchanged. Two blocks, both clarifications of rules the spine already states. Block 1 applies only if the PO accepts the proposal's open questions 9, 10 and 16 (when `changes` are computed, the too-large answer, revisions diffed against what the agent sent); block 2 only if the PO accepts open question 11 (`fetch` of a widget item or reference). If the PO decides otherwise, that block does not apply and the spine stays as it is for that point. Each block quotes the current text exactly, as `main` holds it at 92ca203, then gives the replacement; ADs are amended in place, with their IDs unchanged. The PRD change that goes with block 1 is in `prd-update-draft.md`.

Files: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

Interplay with other drafts, checked by task 6.1 after the rebase of task 0.2 (neither draft below is on this branch yet, so the rebase may conflict on these lines; a conflict keeps the other change's text and this block's replacement as described):

- `tree-widget` amends AD-20's Answers bullet "`ask-core` alone computes the answer's `changes`, …" (its e27d592). Block 1 replaces the next bullet, which that amendment leaves as it is.
- `molecules`' Block 2 rewrites AD-9's Molecules bullets, the one block 2 touches among them, keeping that bullet's first sentence word for word. Block 2 replaces only that sentence, so it applies to the bullet in either form.

How to apply: replace each quoted text, set `updated:` to the apply date and add a `sources` line for this change in the spine's front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. Since the apply, each block's replacement text stands in the spine word for word, and Block 2's current text no longer does (Block 1's replacement begins with its current text); task 6.1 checks that after the rebase.

Checked on 2026-11-01 against the spine on this branch, based on `main` at 92ca203: each block's current text stood word for word, once, so both blocks were applied, with `updated: '2026-11-01'` and this change's `sources` line appended at the end of the list.

## Block 1: AD-20, Rule, Answers, third bullet

Current:

```text
    - `ask-core` stores the full edited value; `fetch` and Snapshots read it.
```

Replacement:

```text
    - `ask-core` stores the full edited value; `fetch` and Snapshots read it. It computes an answer's `changes` once, when it appends the answer, from the revision the answer names, so a revised answer's `changes` are again from what the agent sent, never from the answer it replaces. An answer whose `changes` and derived values would not fit one result is logged without them, marked `tooLarge`, and `fetch` returns them (FR-20).
```

## Block 2: AD-9, Rule, Molecules, the bullet on addressing, first sentence

Current:

```text
Answers and warnings address a molecule's content through the reference's ID and the child IDs of its data (`wbs.portal.label`), never through the expanded IDs, and carry no `molecule` field: `ask-core` maps between the two.
```

Replacement:

```text
Answers, warnings and `fetch` results address a molecule's content through the reference's ID and the child IDs of its data (`wbs.portal.label`), never through the expanded IDs, and carry no `molecule` field: `ask-core` maps between the two. `fetch` of a reference returns its expanded item, as the user left it, under the reference's ID, with each value the expansion filled with an expanded ID naming the reference again.
```
