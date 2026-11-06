# PRD update draft: widget editing plus

**Status: applied on 2026-11-06 (task 0.2), all four blocks; the PO accepted questions 1, 2, 3, 8, 9 and 11. The text below is kept as the record of what was applied.** It applies only for the proposal's open questions the PO accepts (1, 2, 3, 8, 9 and 11 reach the PRD; the others are design details); otherwise the PRD stays as it is, and the change's specs follow the PRD's current text, which gives the Tree and the Gantt their first-version scope. Four blocks, for FR-11, FR-15 and R4. FR IDs stay as they are. Each block quotes the current text exactly, as `main` holds it at a35a0b9b, then gives the replacement.

File: `docs/prd-askboard-2026-10-25/prd.md`.

Why: FR-11's "the minimum is the first-version ceiling" rule, and FR-11's and FR-15's "the critical path always highlighted", rule out what the PO asked for after testing the Tree and the Gantt: a resizable task column, a switch for the critical path, a resizable bar in a plan, percentage edits on a selection of work packages and drag and drop on the Tree. The extension is a list of five edits on two widgets and the two molecules built on them, so R4 (widget scope grows) is answered by naming the limit, not by dropping it.

How to apply: replace each quoted text, set `updated:` in the PRD's front matter to the apply date, then run `openspec validate --all --strict --no-interactive`. The task that applies it (0.2) checks that each current text stands once, word for word, just before the edit.

## Block 1: FR-11, the further scope of the molecules the journeys reach

Current:

```text
- **WBS with PERT (FR-15):** branches that expand and collapse; an excerpt per work package.
- **Gantt plan (FR-15):** day, week and month zoom; the agent's original plan shown as a baseline; the critical path always highlighted.
```

Replacement:

```text
- **WBS with PERT (FR-15):** branches that expand and collapse; an excerpt per work package; selecting work packages and changing the optimistic, most likely or pessimistic estimates of the selection by a percentage, with a preview and an undo; dragging a work package, with its children, to a new place, by the pointer or by explicit move actions from the keyboard.
- **Gantt plan (FR-15):** day, week and month zoom; the agent's original plan shown as a baseline; the critical path highlighted, which the user can switch off; a task column whose width the user changes; the length of a task changed by resizing its bar, as a duration the user requests, which the PERT expected effort does not overwrite.
```

## Block 2: FR-11, the extension of the Tree and the Gantt on their own

Current:

```text
Every other widget, and the decision matrix, stays at its minimum, which is also its first-version ceiling, with one deliberate extension: the Form also offers an on/off field.
```

Replacement:

```text
Every other widget, and the decision matrix, stays at its minimum, which is also its first-version ceiling, with two deliberate extensions: the Form also offers an on/off field, and the Tree and the Gantt offer on their own the editing that the WBS with PERT and the Gantt plan add to them (the selection and percentage change of number fields, dragging nodes, the critical path switch, the task column's width, and a task's requested duration).
```

## Block 3: FR-15, consequences

Current:

```text
- A WBS-with-PERT molecule computes the expected effort and its spread for every node from the user's three-point estimates.
```

Replacement:

```text
- A WBS-with-PERT molecule computes the expected effort and its spread for every node from the user's three-point estimates.
- In a WBS-with-PERT molecule, changing the estimates of selected work packages by a percentage changes every expected effort, spread and Gantt date that depends on them within the same interaction, is previewed before it applies, can be undone once, and reaches the agent as the changed estimates only.
- A Gantt-plan molecule opens with the critical path highlighted and lets the user switch the highlighting off without changing the schedule or the answer.
- A Gantt-plan molecule lets the user set a task's duration by resizing its bar; the dependent tasks, the critical path and the plan's end move with it, and the agent receives the requested duration as a change, next to the estimates it did not touch.
```

## Block 4: R4, mitigation

Current:

```text
Mitigation: the UX work scoped each widget and molecule that the journeys (UJ-1 to UJ-3) reach to what they need, and kept every other widget and the decision matrix at its minimum, which is also its first-version ceiling (FR-11).
```

Replacement:

```text
Mitigation: the UX work scoped each widget and molecule that the journeys (UJ-1 to UJ-3) reach to what they need, and kept every other widget and the decision matrix at its minimum, which is also its first-version ceiling (FR-11). After the product owner's tests of the Tree and the Gantt, five editing features were added to them and to the two molecules, and the list in FR-11 is the new ceiling for those widgets.
```
