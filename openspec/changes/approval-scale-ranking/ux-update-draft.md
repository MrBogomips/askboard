# UX update draft: Approval, Scale and Ranking

**Status: applied on 2026-11-07 by task 0.1 (blocks 1 to 10, each current text found once, replaced word for word).** Task 0.1 applies it, with the proposal's open questions 2, 3, 4, 7 and 8 carrying their answers; a question answered otherwise changes its blocks first (`/opsx:update`). New strings are marked "(to review)" with the rest of the microcopy (EXPERIENCE, Localization, Italian microcopy).

How to apply: replace each quoted text in `docs/ux-askboard-2026-10-27/EXPERIENCE.md` or `DESIGN.md`, set `updated:` in each file's front matter to the apply date, then run `openspec validate --all --strict --no-interactive`. Task 0.1 checks that each current text stands once, word for word, just before the edit.

## EXPERIENCE

### Block 1: Voice and Tone, Approval row

Current:

```text
| Approval | "Approve", "Approve with changes", "Reject"; the label "Approval" above the decision buttons and the summary title "2 changes" (with the count) (to review); the Field error for an empty required reason, "Add the reason for your changes." (to review) | "Approva", "Approva con modifiche", "Respingi"; l'etichetta "Approvazione" sopra i pulsanti e il titolo del riepilogo "2 modifiche" (con il numero); l'errore del campo per un motivo obbligatorio vuoto, "Aggiungi il motivo delle modifiche." (to review) | FR-11, F-04, L200 (T-4), L198 |
```

Replacement:

```text
| Approval | "Approve", "Approve with changes", "Reject"; the label "Approval" above the decision buttons and the summary title "2 changes" (with the count) (to review); the Field error for an empty required reason, "Add the reason for your changes." (to review); the open prompt's label "Reason for the changes (required)"; the summary's "No changes" and "and 5 more", a switched value "on" / "off" (to review); before a received answer is revised, "Send a new answer?", "The agent has already received your earlier answer. This one replaces it.", "Send", "Cancel" (to review) | "Approva", "Approva con modifiche", "Respingi"; l'etichetta "Approvazione" sopra i pulsanti e il titolo del riepilogo "2 modifiche" (con il numero); l'errore del campo per un motivo obbligatorio vuoto, "Aggiungi il motivo delle modifiche."; l'etichetta del campo "Motivo delle modifiche (obbligatorio)"; "Nessuna modifica" e "e altre 5", un valore "attivo" / "disattivo"; prima di rivedere una risposta già ricevuta, "Inviare una nuova risposta?", "L'agente ha già ricevuto la tua risposta precedente. Questa la sostituisce.", "Invia", "Annulla" (to review) | FR-11, F-04, F-63, L200 (T-4), L198; OpenSpec change `approval-scale-ranking` |
```

### Block 2: Voice and Tone, Ranking and Kanban row, and a Scale row

Current:

```text
| Ranking and Kanban | "Keep this order", "Move up", "Move down", "Move to…" | "Mantieni quest'ordine", "Sposta su", "Sposta giù", "Sposta in…" (to review) | L160, TC §2.1, §2.2 |
```

Replacement:

```text
| Ranking and Kanban | "Keep this order", "Move up", "Move down", "Move to…"; the Ranking's counter "No changes", "Order kept", "Your changes: 2 moved" (to review) | "Mantieni quest'ordine", "Sposta su", "Sposta giù", "Sposta in…"; il contatore "Nessuna modifica", "Ordine mantenuto", "Le tue modifiche: 2 spostati" (to review) | L160, TC §2.1, §2.2; OpenSpec change `approval-scale-ranking` |
| Scale | "Not set" while no value is set; values and the unit in the ask's locale ("12.5 %", "12,5 %") (to review) | "Non impostato" (to review) | FR-11, TC §2.5; OpenSpec change `approval-scale-ranking` |
```

### Block 3: Component Patterns, Widgets, Ranking row

Current:

```text
The agent's initial order is not an answer: the user either moves an item or clicks "Keep this order", which accepts the order as it stands.
```

Replacement:

```text
The agent's initial order is not an answer: the user either moves an item or clicks "Keep this order", which accepts the order as it stands. A row drags by its handle and drops before or after another row, by the half of the row the pointer is over; Escape cancels. The list is one Tab stop whose arrow keys move the current row, and the toolbar ("Move up", "Move down", "Keep this order") another. Moved rows take the change highlight, and the toolbar counts them.
```

### Block 4: Component Patterns, Widgets, Approval row

Current:

```text
With changes on the board, plain "Approve" is disabled and "Approve with changes" is the approving act, and "Reject" sends the edits as context. Revising a verdict the agent has received asks for confirmation.
```

Replacement:

```text
With changes in its question, that is edits to the question's other widget items (another widget's result is no change), plain "Approve" is disabled, a selected "Approve" is cleared, and "Approve with changes" is the approving act; without edits, "Approve with changes" stays available, its reason saying what to change. "Reject" sends the edits as context. A selected decision pressed again is cleared. Once the agent has received the question's answer, "Answer" and Decline ask for confirmation before they send a revision; Cancel sends nothing and keeps the draft. AskBoard refuses an answer that approves beside edits, or approves with changes without a reason.
```

### Block 5: Component Patterns, Widgets, Approval summary row

Current:

```text
Lists what the user changed on the board, built from the change highlight's diff (`{components.approval-summary}`), beside the decision buttons, before the answer is sent.
```

Replacement:

```text
Lists what the user changed in the Approval's question, built from the change highlight's diff (`{components.approval-summary}`), beside the decision buttons: before the answer is sent, and read-only after. It shows at most 20 lines, then "and N more", and reads "No changes" when there are none.
```

### Block 6: Component Patterns, Widgets, Scale row

Current:

```text
A click on an unset slider's track sets the value at that point: Radix's Slider sets none there, so AskBoard's sets it itself (renderer spike).
```

Replacement:

```text
A click on an unset slider's track sets the value at that point: Radix's Slider sets none there, so AskBoard's sets it itself (renderer spike). From the keyboard, the unset slider takes Home or an arrow key for its minimum and End for its maximum; then Radix's keys apply. A range starts with both thumbs at the first value. A rating's pressed step, pressed again, clears the value; a slider has no control that clears it.
```

### Block 7: Interaction Primitives, Revisions

Current:

```text
the question becomes editable again, an edit fills the draft, and "Answer" sends the revision, in submitted delivery through Submit.
```

Replacement:

```text
the question becomes editable again, the first edit starts the draft from the answer (its choice, its notes, its note and its widgets' results), and "Answer" sends the revision, in submitted delivery through Submit.
```

## DESIGN

### Block 8: Components, Ranking

Current:

```text
A list in the widget frame, with a drop indicator while an item is dragged and "Keep this order" as a `button-secondary` (L160, TC §2.1). Not mocked.
```

Replacement:

```text
A list in the widget frame, with a drop indicator while an item is dragged and "Keep this order" as a `button-secondary` (L160, TC §2.1). Each row holds a grip handle in `{colors.muted-foreground}`, its position number in `{typography.code}`, its label in `{typography.body}` and its description in `{colors.muted-foreground}`; the drop indicator is the Tree's line above or below the row. A moved row's position number takes the change highlight. The toolbar holds "Move up", "Move down" and "Keep this order" as `button-secondary`s and, at its right, the counter, as the Tree's toolbar does (provisional). Not mocked.
```

### Block 9: Components, Scale

Current:

```text
In rating mode, a toggle group of the scale's steps (F-36). Not mocked, the unset state included (TC §2.5).
```

Replacement:

```text
In rating mode, a toggle group of the scale's steps (F-36), with the minimum and maximum labels at its ends in `{colors.muted-foreground}`. Unset, the slider's track shows no thumb and "Not set" in `{colors.muted-foreground}` where the value label goes, and keyboard focus rings the track (provisional). Not mocked, the unset state included (TC §2.5).
```

### Block 10: Components, Approval summary

Current:

```text
a switched line reads "on" and "off" (provisional) (F-04).
```

Replacement:

```text
a switched line reads "on" and "off" (provisional) (F-04). With no change it reads "No changes" and lists nothing; past 20 lines, a last line "and N more" in `{colors.muted-foreground}` (provisional).
```
