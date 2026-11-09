# UX update draft: Document review

**Status: applied on 2026-11-08 (task 0.1).** It rests on the proposal's open questions 3, 6, 7 and 9; an answer other than the default changes its blocks first (`/opsx:update`). New strings are marked "(to review)" with the rest of the microcopy (EXPERIENCE, Localization).

Texts changed after task 0.1 (tasks 5.9 and 6.8) were applied to EXPERIENCE and DESIGN directly; the blocks below keep what task 0.1 applied.

How to apply: replace each quoted text in `docs/ux-askboard-2026-10-27/EXPERIENCE.md` or `DESIGN.md`, set `updated:` in each file's front matter to the apply date, then run `openspec validate --all --strict --no-interactive`. Task 0.1 checks that each current text stands once, word for word, just before the edit. No block touches a line that `layouts`' or `form-widget`'s drafts replace, nor a line next to one: block 1 adds its row after the Scale's, above the LaTeX row, away from the Atoms, Layouts and Form rows.

## EXPERIENCE

### Block 1: Voice and Tone, a Document review row after the Scale row (the table with the Italian column)

Current:

```text
| Scale | "Not set" while no value is set; values and the unit in the ask's locale ("12.5 %", "12,5 %") (to review) | "Non impostato" (to review) | FR-11, TC §2.5; OpenSpec change `approval-scale-ranking` |
```

Replacement:

```text
| Scale | "Not set" while no value is set; values and the unit in the ask's locale ("12.5 %", "12,5 %") (to review) | "Non impostato" (to review) | FR-11, TC §2.5; OpenSpec change `approval-scale-ranking` |
| Document review | "Comment", "Suggest edit"; the counter "No comments yet", "Your changes: 1 comment", "Your changes: 2 comments, 1 suggested edit"; the card "Comment 1", "Suggested edit 2", "Your comment", "Replace with", "Note (optional)", "Done", "Edit", "Delete", "Close"; the pins' names "Comment 1", "Suggested edit 2"; "Detached comments", "The document changed, and these no longer match it. Delete them before you answer."; the hint "Delete the detached comments in {label} first.", the label being the title or "the document"; the messages "Select a passage of the document first.", "Select one passage.", "Select some text, not only spaces.", "Select at most 2,000 characters.", "This passage overlaps comment {n}.", "This passage repeats in the document. Select a longer one.", "This block is longer than 2,000 characters. Select part of it with the pointer." (to review) | "Commenta", "Suggerisci modifica"; "Nessun commento", "Le tue modifiche: 1 commento", "Le tue modifiche: 2 commenti, 1 modifica suggerita"; "Commento 1", "Modifica suggerita 2", "Il tuo commento", "Sostituisci con", "Nota (facoltativa)", "Fatto", "Modifica", "Elimina", "Chiudi"; "Commenti staccati", "Il documento è cambiato e questi non vi corrispondono più. Eliminali prima di rispondere."; "Elimina prima i commenti staccati in {label}.", con "il documento" senza titolo; "Seleziona prima un passaggio del documento.", "Seleziona un solo passaggio.", "Seleziona del testo, non solo spazi.", "Seleziona al massimo 2.000 caratteri.", "Questo passaggio si sovrappone al commento {n}.", "Questo passaggio si ripete nel documento. Selezionane uno più lungo.", "Questo blocco supera i 2.000 caratteri. Selezionane una parte con il puntatore." (to review) | FR-11, FR-34; OpenSpec change `document-review` |
```

### Block 2: Component Patterns, Annotation pin

Current:

```text
| **Annotation pin** | A numbered pin on a Graph's node or edge, or on the annotation overlay of a Diagram or an Image annotation. A graph or diagram pin is keyed to the element's ID, or, when it has none, to its quoted label and its occurrence, and re-attaches by that key after a re-layout, a re-render or the user's correction of the source. A pin whose element is gone, or whose match has become ambiguous, is listed as detached, never silently dropped or guessed. An image pin is an `xywh=percent:` region. A click or a keypress on a pin opens its comment card. | L70, L160, AD-7, TC §2.4, F-62 |
```

Replacement:

```text
| **Annotation pin** | A numbered pin on a Graph's node or edge, after a Document review's passage, or on the annotation overlay of a Diagram or an Image annotation. A graph or diagram pin is keyed to the element's ID, or, when it has none, to its quoted label and its occurrence, and re-attaches by that key after a re-layout, a re-render or the user's correction of the source. A Document review's pin is keyed to its quoted text and up to 200 characters of context, and re-attaches only where they occur once in the revised document. A pin whose element is gone, or whose match has become ambiguous, is listed as detached, never silently dropped or guessed. An image pin is an `xywh=percent:` region. A click or a keypress on a pin opens its comment card. Pins are numbered in the content's order. | L70, L160, AD-7, TC §2.4, F-62; OpenSpec change `document-review` |
```

### Block 3: Component Patterns, Comment card (cards write as the user types)

Current:

```text
| **Comment card** | Opens from an annotation pin, by click or keypress, in `{components.comment-card}`; placing a new pin opens an empty one. The user writes the comment, changes it with "Edit", or deletes it, which removes its pin. Esc or the close control dismisses the card, and focus returns to the pin. Open comment cards and their pins survive a theme re-render. | L160, F-35, F-65 |
```

Replacement:

```text
| **Comment card** | Opens from an annotation pin, by click or keypress, in `{components.comment-card}`; placing a new pin opens an empty one. The user writes the comment, which enters the draft as they type, changes it with "Edit", or deletes it, which removes its pin; a comment emptied of its text is removed. "Done", Esc or the close control closes the card, and focus returns to the pin, or to the widget when the pin is gone. Open comment cards and their pins survive a theme re-render. | L160, F-35, F-65; OpenSpec change `document-review` |
```

### Block 4: Component Patterns, Widgets, Document review

Current:

```text
| **Document review** | The user selects a passage to comment on it or to suggest an edit. Comments anchor to the quoted text or to its position (AD-7). | FR-11, L160 |
```

Replacement:

```text
| **Document review** | The user selects a passage of the rendered document and presses "Comment" or "Suggest edit" in the toolbar, and a comment card opens for it. A comment, or a suggested edit (a replacement field that starts with the passage's text, and an optional note), enters the draft as the user types; an empty replacement suggests deleting the passage. A commented passage takes a numbered pin, and a suggested edit shows the passage struck through with the replacement after it. An annotation anchors to the quoted text with up to 200 characters of context, only where the user selected it and only when that quote occurs once in the document; a blank, over-long (2,000 characters), overlapping or repeated passage is refused with a message beside the toolbar. One annotation per passage. After the agent changes the document, an annotation whose quote no longer occurs once is listed as detached under the document, with "Delete", and the question cannot be answered until it is deleted. An untouched Document review gives no answer. Links open through the board page, as a Text's do. Read-only, the marks and pins stay and the cards open without "Edit" or "Delete". | FR-11, L160, AD-7, AD-10; OpenSpec change `document-review` |
```

### Block 5: Accessibility Floor, Keyboard core, a Document review line after the Chart's

Current:

```text
  - Chart: the arrow keys, Home and End move between data points, and Space or Enter highlights or clears the current one.
```

Replacement:

```text
  - Chart: the arrow keys, Home and End move between data points, and Space or Enter highlights or clears the current one.
  - Document review: the document is one Tab stop whose Up, Down, Home and End move between its blocks (paragraphs, headings, list items, table cells, code blocks) and whose Left and Right move between the current block's pins, Enter opening a pin's card; "Comment" and "Suggest edit", in the toolbar's Tab stop, act on the selected text, else on the current block.
```

### Block 6: Composition and Components, Component per widget, Document review

Current:

```text
| Document review | Own, on the Markdown renderer, with text-quote anchors | Selecting a passage to comment or suggest a replacement; quote or position anchors (AD-7); inline marks through classes | — |
```

Replacement:

```text
| Document review | Own, on the board's one Markdown renderer (markdown-it and DOMPurify in the `markdown` library chunk), with text-quote anchors; comment cards on Radix Popover | Selecting a passage to comment or suggest a replacement; quote anchors placed where they occur once, or listed as detached (AD-7); inline marks through classes | Selection and the anchored popover in the sandboxed view (task 0.4 of `document-review`) |
```

## DESIGN

### Block 7: Components, Comment card

Current:

```text
While the user writes or edits, the body is a Textarea with its save action as `button-secondary` (F-35; golden-1-base, colour page). Mock: golden-1-base; not mocked: the editing state. |
```

Replacement:

```text
While the user writes or edits, the body is a Textarea that writes into the draft as the user types, and "Done" as `button-secondary` closes the card (F-35; golden-1-base, colour page). A suggested edit's card holds the "Replace with" Textarea above the note's. Mock: golden-1-base; not mocked: the editing state. |
```

### Block 8: Components, Document review

Current:

```text
| **Document review** | The document through the Markdown renderer, in `{typography.body-lg}`. A commented passage sits on `{colors.change-subtle}` with a `{colors.change}` underline and a numbered pin, and a suggested edit shows the passage struck through and the suggestion in `{colors.change-text}` on `{colors.change-subtle}`. Each comment opens a comment card. Marks are set through classes (F-36). Not mocked. |
```

Replacement:

```text
| **Document review** | **Surface.** In the widget frame. Its toolbar holds "Comment" and "Suggest edit" as `button-secondary` and the counter ("No comments yet", "Your changes: 2 comments, 1 suggested edit"); a message about a refused passage sits beside them in `{colors.muted-foreground}`. A title, when given, heads the frame in `{typography.label}`.<br>**Anatomy.** The document through the Markdown renderer, in `{typography.body-lg}`. A commented passage sits on `{colors.change-subtle}` with a `{colors.change}` underline and a numbered `annotation-pin` after it, and a suggested edit shows the passage struck through and the suggestion in `{colors.change-text}` on `{colors.change-subtle}`, then its pin. Each pin opens a comment card. Marks are set through classes (F-36). The current block, from the keyboard, takes `{components.focus-ring}`. Detached annotations sit under the document on `{colors.muted}`, headed "Detached comments": each its quote in `{colors.muted-foreground}`, its text, and "Delete" as a `button-link`. Every element holding agent or user text wraps a long word.<br>**States.** Read-only (answered, locked, a Snapshot): no toolbar; the marks and pins stay, and a card shows no "Edit" or "Delete". Not mocked. |
```
