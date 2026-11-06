# Spine update draft: widget registry

**Status: to apply in task 0.1.** The proposal's open questions 1, 2, 3 and 5 were answered on 2026-11-06 with their defaults, under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly, as the spine stands on this change's base (`origin/main` fd80950b plus PR #38's archives), then gives the replacement. ADs are amended in place; no AD is added or renumbered. The PRD change that goes with block 4 is in `prd-update-draft.md`.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`.

How to apply: check that each current text stands once (`git grep -c`), replace it, set `updated:` to the apply date and append to `sources:` the line `'OpenSpec change widget-registry, proposal.md, open questions 1 to 7: the registry of widget types, widget results and the annotation fields (accepted under the PO''s unattended handoff, 2026-11-06)'`. Then run `openspec validate --all --strict --no-interactive`. If `widget-editing-plus` or another change has merged a different text into one of these lines meanwhile, keep its text and apply this block's addition to it, and say so in task 0.1's note.

## Block 1: AD-7, Rule, Content, Annotations

Current:

```text
    - **Annotations:** they share one shape modelled on the W3C Web Annotation Data Model, a target (item ID plus selector) and a body. Its fields are fixed in `contract` before the first annotating widget is built.
```

Replacement:

```text
    - **Annotations:** they share one shape modelled on the W3C Web Annotation Data Model, a target (item ID plus selector) and a body. Its fields are fixed in `contract` before the first annotating widget is built: `{id, target: {selector}, body: {text}}`, the item ID being the key of the answer's `results`, with one selector type per kind of position above (`element` and `label` for diagrams and graphs, `region` for images, `line` for diffs, `quote` and `position` for text).
```

## Block 2: AD-7, Rule, Content, Widgets and the open prompt, then a new bullet

Current:

```text
    - **Widgets and the open prompt:** a widget either sits in a question, and so has the open prompt (FR-7), or is display-only and returns no answer.
```

Replacement:

```text
    - **Widgets and the open prompt:** a widget either sits in a question, and so has the open prompt (FR-7), or is display-only and returns no answer.
    - **Widget types:** `contract` holds one registry of widget types. Per type it gives the props schema and checks, the element shape and `changes` schema when the user edits the agent's content, the result schema and checks when the widget gives a result, the derived declarations of AD-13, the agent-facing wording and an example item. Every unit that handles a widget item dispatches on the registry, so a widget is added by registering it; a widget's chunk gives the view what the shell needs of its type through the `CatalogRenderer` port (AD-9), so the shell does not grow with the catalogue.
```

## Block 3: AD-20, Rule, Answers, first bullet

Current:

```text
    - A view answer message carries the item's full edited value in its input-format shape, plus its derived values.
```

Replacement:

```text
    - A view answer message carries the item's full edited value in its input-format shape, plus its derived values. What a widget gives that is not an edit of the agent's content (a decision, a value, an order, annotations, highlights) is its result, held apart from its edited value; the message carries it in `results` by item ID, and `ask-core` checks it against the result its type declares in `contract` (AD-7) and logs it in the answer's `results`.
```

## Block 4: AD-20, Rule, Answers, third bullet

Current:

```text
    - `ask-core` stores the full edited value; `fetch` and Snapshots read it. It computes an answer's `changes` once, when it appends the answer, from the revision the answer names, so a revised answer's `changes` are again from what the agent sent, never from the answer it replaces. An answer whose `changes` and derived values would not fit one result is logged without them, marked `tooLarge`, and `fetch` returns them (FR-20).
```

Replacement:

```text
    - `ask-core` stores the full edited value and the results; `fetch` and Snapshots read them. It computes an answer's `changes` once, when it appends the answer, from the revision the answer names, so a revised answer's `changes` are again from what the agent sent, never from the answer it replaces. An answer whose `changes`, results and derived values would not fit one result is logged without them, marked `tooLarge`, and `fetch` returns them (FR-20).
```

## Block 5: AD-20, Rule, Drafts, first bullet

Current:

```text
    - Unsent work is a per-ask **draft record**. Per question it holds the edited values, held answers, declines, postpones, held undos and open-prompt text, keyed by item ID and `rev`, and also the question's context placement, the text in its follow-up composers and the user's notes on options. For the board it holds the delivery mode and the open tab or the question in view.
```

Replacement:

```text
    - Unsent work is a per-ask **draft record**. Per question it holds the edited values, the widgets' results, held answers, declines, postpones, held undos and open-prompt text, keyed by item ID and `rev`, and also the question's context placement, the text in its follow-up composers and the user's notes on options. For the board it holds the delivery mode and the open tab or the question in view.
```
