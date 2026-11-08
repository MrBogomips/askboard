# UX update draft: layouts

**Status: applied by task 0.1 on 2026-11-07.** It rests on the proposal's open questions 2, 4 and 6 to 9, answered on 2026-11-07 with their defaults under the PO's unattended handoff; the PO may revisit. Each block quotes the current text exactly as it stands on the base c3cb6241, then gives the replacement. The Italian string is provisional, "(to review)", as `settings-languages` wrote the others.

Files: `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (blocks 1 to 4) and `DESIGN.md` (block 5).

How to apply: check that each current text stands once (`grep -c -F`), replace only it (block 4 inserts a row after the line it names), set `updated:` of both files to the apply date, and run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into one of these lines meanwhile (`atoms` wrote the Atoms row block 4 follows), keep its text, apply this block to it, and say so in task 0.1's note.

## Block 1: EXPERIENCE, Primitives, Layouts (open questions 2, 4 and 6 to 9)

Current text:

```text
| **Layouts** | Stack, Row and Group compose items, and Tabs inside a question is optional (Composition and Components, Layouts). Layouts return no answer. The board-level layouts follow Board anatomy and Presentations. | FR-13, L160, TC §1.5 |
```

Replacement:

```text
| **Layouts** | Stack, Row, Group and Tabs inside a question arrange a question's atoms and widgets, and each other, at most four deep (Composition and Components, Layouts); excerpts, references, images and molecule references stay the question's own, and AskBoard places them. Layouts return no answer. A Row shows its items side by side while each gets at least 240 px, else one under another, in order. A Group is read as a group named by its title. Tabs keep every panel mounted, so its items report ready and keep their draft; the arrow keys, Home and End move between tabs and select (Radix's keyboard), and Tab moves into the panel. A tab whose panel holds a field to correct carries the field-error mark. Tabs switch on an answered question and in a Snapshot, since switching changes nothing. The board-level layouts follow Board anatomy and Presentations. | FR-13, L160, TC §1.5, OpenSpec change `layouts` |
```

## Block 2: EXPERIENCE, Composition and Components, Layouts (open questions 4 and 6)

Current text (two rows, each replaced alone):

```text
| Row | Items side by side, with relative widths | The agent (FR-13) |
```

```text
| Tabs inside a question (optional) | Alternative views of one question's content | The agent |
```

Replacements:

```text
| Row | 2 to 4 items side by side, with relative widths as weights from 1 to 4 | The agent (FR-13) |
```

```text
| Tabs inside a question | Alternative views of one question's content: 2 to 8 titled tabs | The agent (FR-13) |
```

## Block 3: EXPERIENCE, What a reload keeps (open question 7)

Current text:

```text
and the active tab or the question in view, come back too (pending ACR-11).
```

Replacement:

```text
and the active tab or the question in view, come back too (pending ACR-11). Tabs inside a question reopen on their first tab, with their items' draft kept.
```

## Block 4: EXPERIENCE, Voice and Tone, the tab's mark (open question 8)

Insert after the row that starts `| Atoms |`:

```text
| Layouts | "needs a correction" after a tab's title, read by assistive technology while its panel holds a field to correct (to review) | "da correggere" dopo il titolo della scheda (to review) | OpenSpec change `layouts` |
```

## Block 5: DESIGN, Primitives, Layouts (open questions 4 and 8)

Current text:

```text
| **Layouts** | Stack and Row add only spacing on the 8px grid. Group is a titled, bordered group on shadcn's Card structure. Tabs inside a question use shadcn Tabs. Not mocked. |
```

Replacement:

```text
| **Layouts** | Stack and Row add only spacing on the 8px grid, `{spacing.md}` between items; a Row's items share its width by their weights, and stack in order when one would be narrower than 240 px. Group is a titled, bordered group on shadcn's Card structure: `{colors.border}`, `{rounded.md}`, padded `{spacing.md}`, its title in `{typography.label}` and its description in `{colors.foreground-secondary}`. Tabs inside a question use shadcn Tabs; a tab whose panel holds a field to correct carries a dot in `{colors.destructive}` after its title. Not mocked. |
```
