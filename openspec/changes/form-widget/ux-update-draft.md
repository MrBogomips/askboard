# UX update draft: form-widget

**Status: applied by task 0.1 on 2026-11-07.** It rests on the proposal's open questions 1 to 7 and 12, answered on 2026-11-07 with their defaults under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly as it stands on the base 886739d3 (`atoms` and `layouts` applied their own blocks there; none of these texts), then gives the replacement. Italian strings are provisional, "(to review)", as `settings-languages` wrote the others.

Files: `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (blocks 1 to 6) and `DESIGN.md` (blocks 7 and 8).

How to apply: check that each current text stands once (`grep -c -F`), replace only it (block 6 inserts a row after the line it names; block 8 replaces a phrase inside its line), set `updated:` of both files to the apply date, and run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these lines meanwhile, keep its text, apply this block's change to it, and say so in task 0.1's note.

## Block 1: EXPERIENCE, Primitives, the Choice atom (open questions 7 and 12)

Current text (the Choice row of the atom table):

```text
| Choice | Single or multiple choice; options carry label, description and an optional "Other…" answer; radios or checkboxes, and a dropdown only in a Form pick field | Option ID or list of IDs, plus `other` text when used |
```

Replacement:

```text
| Choice | Single or multiple choice: the question's own options, which carry label, description and an optional "Other…" answer, or a PickField (`pick-field`) among a question's fields, whose options carry an ID, a label and a description; radios or checkboxes, never a dropdown | The question's chosen options, plus `other` text when used; a PickField's option ID or list of IDs |
```

## Block 2: EXPERIENCE, Widgets, Form (open questions 1 and 2)

Current text:

```text
| **Form** | Typed fields: text, number, money, date, a pick from a list (single or multiple) and on/off; the on/off field is a deliberate extension of FR-11's list (Widget Scope). AskBoard computes the field checks (Field checks), and a failing check shows as a Field error. A pick field may show as a dropdown, the only place a dropdown appears. Enter never submits the form: answers go by "Answer" and the delivery mode. | FR-11, L160, L165, L168, TC §3, F-23, F-39 |
```

Replacement:

```text
| **Form** | Typed fields: text, number, money, date, a pick from a list (single or multiple) and on/off; the on/off field is a deliberate extension of FR-11's list (Widget Scope). A Form is a question's input fields, TextField, NumberField, MoneyField, DateField, PickField and Toggle, arranged by layouts, a Group per section (Form). AskBoard computes the field checks (Field checks), and a failing check shows as a Field error. A pick shows as radios or checkboxes, never as a dropdown. Enter never submits the form: answers go by "Answer" and the delivery mode. | FR-11, L160, L165, L168, TC §3, F-23, F-39, OpenSpec change `form-widget` |
```

## Block 3: EXPERIENCE, Component per widget, Form (open question 1)

Current text:

```text
| Form | `@rjsf/core` and `@rjsf/utils` 6.11.0, themed with the input atoms | Field checks, the money field, locale input, a no-op validator, picks as `enum` with `ui:enumNames` (Form library) | S-4, S-7, S-8 |
```

Replacement:

```text
| Form | No form library: the input atoms and the PickField, on Radix Radio Group and Checkbox, arranged by layouts | Field checks in `contract`, the PickField's filter for a long list, locale input (Form) | S-4, S-7, S-8; OpenSpec change `form-widget` |
```

## Block 4: EXPERIENCE, Form library becomes Form (open questions 1, 2, 7 and 8)

Current text (the section from its heading to the paragraph before `### Field checks`):

```text
### Form library

The Form widget uses `@rjsf/core` 6.11.0 with `@rjsf/utils` 6.11.0, under an AskBoard theme that maps RJSF's widgets to the input atoms, so a Form looks and behaves like every other field on the board (L160, TC §3.3). Its constraints:
1. A no-op validator. Field errors come from AskBoard's field checks and are passed in as `extraErrors` (S-4).
2. `tagName="div"`, and the submit button is never rendered. Enter never submits (S-7). The sandbox alone would not stop it: WebKit fires a `<form>`'s submit event inside the sandbox, which runs RJSF's `onSubmit` (renderer spike).
3. Generated schemas carry no `default`, so nothing is prefilled (AD-10), and no `oneOf`, `anyOf`, `if` or `dependencies`. A pick field is an `enum`, with its labels in `ui:enumNames` (L183, L185, S-8).
4. Markdown in descriptions stays off.
5. Neither `@rjsf/shadcn` (it brings cmdk, S-5) nor `@rjsf/validator-ajv8` (it compiles with `eval`) is used.
6. `showErrorList={false}`: errors show only under their fields.
7. The draft record drives the Form's `formData` (AD-9). RJSF keeps its own copy in state, which AskBoard never reads as the value.

The field model is text, number, money, date, a pick from a list (single or multiple) and on/off; the on/off field is a deliberate extension of FR-11's list (L165, Widget Scope). "List" is a pick, as in MCP elicitation; repeatable entries are out of the first version (L68). A flat elicitation form shows on a board with its titled enums converted to `enum` with `ui:enumNames`, and without its defaults, which AskBoard never prefills (F-46).
```

Replacement:

```text
### Form

A Form is not a component of its own: it is a question whose items are input fields (TextField, NumberField, MoneyField, DateField, PickField and Toggle), arranged by the layouts, a Group per section and Tabs for a long form, so a Form looks and behaves like every other field on the board (L160, TC §3.3). No form library is used: every field is already an atom, and the one the Form adds is the PickField, a pick from a list, single as radios or multiple as checkboxes, with a filter field above more than 10 options (OpenSpec change `form-widget`). Its rules:
1. No `<form>` element and no submit button: Enter never submits (S-7).
2. Nothing is prefilled: every field starts empty or unset (AD-10).
3. A field's errors show only under it, from AskBoard's field checks (Field checks).
4. A field keeps no state of its own: the draft record holds its value, and a reload restores it (AD-9).

The field model is text, number, money, date, a pick from a list (single or multiple) and on/off; the on/off field is a deliberate extension of FR-11's list (L165, Widget Scope). "List" is a pick, as in MCP elicitation; repeatable entries are out of the first version (L68). A flat elicitation form maps onto the fields one to one, a string onto a TextField, a number onto a NumberField, a boolean onto a Toggle and an enum onto a PickField with its titles as option labels, without its defaults, which AskBoard never prefills (F-46).
```

## Block 5: EXPERIENCE, Field checks (open questions 3 to 6)

Current text (the section's paragraph):

```text
Field checks are derived values (FR-11): AskBoard computes them in the compute graph (AD-13), and the Form shows the errors under their fields. The keyword set is fixed: `required`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `format: date`, and a date range. A `pattern` from the agent must stay within a safe subset, with no backreferences, lookaround or nested quantifiers: AskBoard checks it when the ask is sent and refuses a pattern outside it with an error naming the item (L183, F-46, S-8). No run-time schema validator passes the adoption rule under the view CSP (S-4). A failing check blocks its question's "Answer" (Component Patterns, Answer).
```

Replacement:

```text
Field checks are derived values (FR-11): AskBoard computes them from a field's props and its value with the contract's own checks, one function per field type that the view runs as the user types and `ask-core` runs on the answer, never through the compute graph; the Form shows the errors under their fields. The keyword set is fixed: `required` on every input field; `minLength`, `maxLength` and `pattern` on a TextField; `min` and `max` (`minimum` and `maximum`) on a NumberField and a MoneyField; `minItems` and `maxItems` on a multiple PickField; and the DateField's dates and range (`format: date` and a date range). A `pattern` from the agent must stay within a safe subset, with no backreferences, lookaround, nested quantifiers or alternation inside a repeated group, at most 200 characters, read with the `u` flag and unanchored as JSON Schema reads it, on a field of at most 1,000 characters: AskBoard checks it when the ask is sent and refuses a pattern outside it with an error naming the item (L183, F-46, S-8). The pattern runs only in the view, on the user's text; `ask-core` runs every other field check on the answer. No run-time schema validator passes the adoption rule under the view CSP (S-4). A failing check blocks its question's "Answer", and a value that fails one stays in its field and the draft until the user corrects it. A required field's label ends with "(required)"; while it is empty it shows no field error, and "Answer" is described "Complete {label} first." (Component Patterns, Answer).
```

## Block 6: EXPERIENCE, Voice and Tone, the Form's strings (open questions 6 and 7)

Insert after the row that starts `| Layouts |`:

```text
| Form | "(required)" after a required field's label; the field errors "At least {min} characters.", "Not in the expected form.", "Pick at least {min}.", "Pick at most {max}."; "Answer" while a required field is empty, described "Complete {label} first."; the PickField's "Clear", its filter's label "Filter the options" and "No option matches." (to review) | "(obbligatorio)"; "Almeno {min} caratteri.", "Non è nella forma attesa.", "Scegline almeno {min}.", "Scegline al massimo {max}."; "Completa prima {label}."; "Cancella", "Filtra le opzioni", "Nessuna opzione corrisponde." (to review) | FR-11, FR-34; OpenSpec change `form-widget` |
```

## Block 7: DESIGN, Components, Form (open questions 1 and 7)

Current text:

```text
| **Form** | Its fields are the input atoms, so a Form looks like every other field on the board, and it renders no submit button of its own (L160, TC §3.3). A single pick from a list renders as radios, with the Choice atom's filter field for a long list: Select, the one dropdown the UX had planned (F-23, L183, L185), fails the view CSP (renderer spike); a multiple pick uses checkboxes, and the on/off field is a Switch (L165). A failing field check shows a `field-error` under its field (F-39). Not mocked. |
```

Replacement:

```text
| **Form** | Its fields are the input atoms and the PickField, so a Form looks like every other field on the board, and it renders no submit button of its own (L160, TC §3.3); a Group per section. A single pick from a list renders as radios, with a filter field above the list when it holds more than 10 options, and a "Clear" `button-link` while a pick is set: Select, the one dropdown the UX had planned (F-23, L183, L185), fails the view CSP (renderer spike); a multiple pick uses checkboxes, and the on/off field is a Switch (L165). A failing field check shows a `field-error` under its field (F-39). Not mocked. |
```

## Block 8: DESIGN, Primitives, Input atoms (open question 6)

Current phrase, inside the Input atoms row:

```text
Radio Group, Checkbox, Select, Switch and Slider, with `{colors.input}` borders and the focus ring. Labels stay visible.
```

Replacement:

```text
Radio Group, Checkbox, Switch and Slider, with `{colors.input}` borders and the focus ring; never Select, which fails the view CSP (renderer spike). Labels stay visible, and a required field's label ends with "(required)".
```
