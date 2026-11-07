# UX update draft: atoms

**Status: applied on 2026-11-07 (task 0.1).** Applied with the proposal's open questions 2, 5 to 8 and 10 answered on 2026-11-07 with their defaults under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly as it stands on `origin/main` ea05608f, then gives the replacement. The Italian strings are provisional, "(to review)", as `settings-languages` wrote the others.

Files: `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (blocks 1 to 6) and `DESIGN.md` (block 7).

How to apply: check that each current text stands once (`grep -c -F`), replace only it (block 6 inserts a row after the line it names), set `updated:` of both files to the apply date, and run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these lines meanwhile (`chart-widget` adds a Voice and Tone row near block 6's), keep its text, apply this block to it, and say so in task 0.1's note.

## Block 1: EXPERIENCE, Primitives, Display atoms (open question 8)

Current text:

```text
Markdown in a Text goes through the view's sanitizer, the same path option previews take;
```

Replacement:

```text
Markdown in a Text goes through the view's sanitizer, the same path an option preview marked as Markdown takes; only its `http:` and `https:` links are links, opening on a click in a new tab through the board page, and its images show as links to their source;
```

## Block 2: EXPERIENCE, Primitives, Input atoms (open question 5)

Current text:

```text
Typing never answers: a value becomes an answer only through the question's "Answer" and the delivery mode.
```

Replacement:

```text
Typing never answers: a value becomes an answer only through the question's "Answer" and the delivery mode. Text a field cannot read, or whose value falls outside the item's bounds, stays in the field with its field error, is kept with the draft across a reload, and disables the question's "Answer" until the user corrects or clears it.
```

## Block 3: EXPERIENCE, Primitives, the Toggle and the Slider (open questions 2 and 6)

Current text:

```text
| Toggle | On or off | `true` / `false`; an untouched toggle returns no answer |
| Slider | A value, or a range, on a numeric scale | A number, or `[low, high]` |
```

Replacement:

```text
| Toggle | On or off; unset until the user presses it, and "Clear" makes it unset again | `true` / `false`; an untouched toggle returns no answer |
| Slider | A value, or a range, on a numeric scale: the Scale widget with its slider display, not a type of its own | The Scale's result: `value`, or `low` and `high` |
```

## Block 4: EXPERIENCE, Composition and Components, Atoms (open question 2)

Current text:

```text
| Slider | Slider (single value) | Slider |
```

Replacement:

```text
| Slider | Slider (single value), mapped to the Scale | Slider, through the Scale |
```

## Block 5: EXPERIENCE, Component Patterns, Option preview (open question 7)

Current text:

```text
A preview is text or data, never markup, shown with the Text and Image atoms.
```

Replacement:

```text
A preview is text or data, never markup, shown with the Text and Image atoms: plain text, or Markdown when the option marks it so.
```

## Block 6: EXPERIENCE, Voice and Tone, the atoms' strings

Insert after the line starting with `| Timeline | "Move earlier"`:

```text
| Atoms | "Not set", "On", "Off", "Clear" (Toggle); "Pick a currency." (MoneyField); "Choose a date", "Previous month", "Next month" and a day's name as a long date (DateField); the echo "= 1234.5", "= 1234.50 EUR", "= Wed, Dec 9, 2026"; the field errors "At least {min}.", "At most {max}.", "A whole number.", "A multiple of {step} from {base}.", "{currency} takes at most {n} decimals, as in {example}.", "On or after {date}.", "On or before {date}."; "Answer" while a field is in error, described "Correct {label} first."; durations "1 day", "12 days" (to review) | "Non impostato", "Attivo", "Disattivo", "Cancella"; "Scegli una valuta."; "Scegli una data", "Mese precedente", "Mese successivo"; "= 1234,5", "= 1234,50 EUR", "= mer 9 dic 2026"; "Almeno {min}.", "Al massimo {max}.", "Un numero intero.", "Un multiplo di {step} a partire da {base}.", "{currency} ammette al massimo {n} decimali, come in {example}.", "Dal {date} in poi.", "Fino al {date}."; "Correggi prima {label}."; "1 giorno", "12 giorni" (to review) | FR-13, FR-34; OpenSpec change `atoms` |
```

## Block 7: DESIGN, Primitives, Input atoms (open questions 6 and 10)

Current text:

```text
Nothing renders as set before the user acts (AD-10).
```

Replacement:

```text
Nothing renders as set before the user acts (AD-10): an unset Toggle is a Switch drawn off with "Not set" beside it in `{colors.muted-foreground}`, and a set one reads "On" or "Off" with a "Clear" `button-link`. A MoneyField whose currency the user picks shows the codes as a segmented control after the field, none pressed until picked. A DateField's calendar opens from a button after the field, in a non-modal popover with `{elevation.shadow-md}`.
```
