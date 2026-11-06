# UX update draft: excerpts (E5)

Six blocks for `docs/ux-askboard-2026-10-27/EXPERIENCE.md`, each for one of the proposal's open questions. A block applies only if the PO accepts the choice made there; a question the PO reverses leaves its block unapplied, and the change is revised with `/opsx:update`. Each block quotes the current text exactly, then gives the replacement. DESIGN.md is unchanged: open question A8 defers highlighting without changing what the first version ships, and every look E5 builds is already in DESIGN.md's Components.

**Applied 2026-11-05** (task 9.1; the PO accepted every question these blocks serve on 2026-11-01, decisions-5). All blocks were applied word for word to `docs/ux-askboard-2026-10-27/EXPERIENCE.md` (3.2 inserted after its anchor row). The reading panel's messages follow block 4's wording: the build shows "This file is not available" for a missing file and for one outside the root, "This file cannot be shown as text", "This file is too large to show here" (without the size: board-host's source state carries none) and the no-editor note "No editor set: `editor` in ~/.config/askboard/config.json".

How to apply: replace each quoted passage (or insert where a block says so), then run `openspec validate --all --strict --no-interactive`.

## Block 1: Component Patterns, Primitives, "Display atoms" (open question A7)

Current:

```text
| **Display atoms** | Text, Image and Value show content and return no answer. Markdown in a Text goes through the view's sanitizer, the same path option previews and agent-written excerpts take. An image pointer that does not resolve shows as unresolved, like an excerpt, keeps the rest of the board working and sends the agent a typed warning (AD-6). Value shows a given or derived value in the ask's locale, or its formula error. | FR-13, L160, TC §1.2, F-41 |
```

Replacement:

```text
| **Display atoms** | Text, Image and Value show content and return no answer. Markdown in a Text goes through the view's sanitizer, the same path option previews take; an excerpt, the agent's included, always shows as source text (Excerpt). An image pointer that does not resolve shows as unresolved, like an excerpt, keeps the rest of the board working and sends the agent a typed warning (AD-6). Value shows a given or derived value in the ask's locale, or its formula error. | FR-13, L160, TC §1.2, F-41 |
```

## Block 2: Component Patterns, Context, "Context column" (open question A9)

Current:

```text
| **Context column** | Holds the question's excerpts and references. It sits beside the question (the default) or inline under the question text. The "Beside \| Inline" control sits in the context column's title row ("Excerpt and references") and stays there in both positions, so it never jumps. The board-wide placement is set in the settings panel (Preferences and Settings), and the control on a question overrides it on that question only; the override stays with the ask (What a reload keeps). Where the references go for a question without excerpts is not recorded. | L108, L111, L112, L160, F-33 |
```

Replacement:

```text
| **Context column** | Holds the question's excerpts, then its references. It sits beside the question (the default) or inline under the question text. The "Beside \| Inline" control sits in the context column's title row ("Excerpt and references") and stays there in both positions, so it never jumps. The board-wide placement is set in the settings panel (Preferences and Settings), and the control on a question overrides it on that question only; the override stays with the ask (What a reload keeps). A question with no resolved or agent-written excerpt does not split: its references and unresolved pointers show inline under the question text, under the same title, with no "Beside \| Inline" control. | L108, L111, L112, L160, F-33 |
```

## Block 3: State Patterns, By surface, large files and long excerpts (open question A11)

### 3.1 The "Very large file" row

Current:

```text
| Reading panel | Very large file | Not recorded. | F-40 |
```

Replacement:

```text
| Reading panel | Very large file | Over the source view's limit (2 MiB or 20,000 lines), the panel says "This file is too large to show here" with its path and size; "Open in editor" stays enabled. | F-40 |
```

### 3.2 A new row after "Context | Long excerpt | Excerpt. | F-60 |"

Insert after the line:

```text
| Context | Long excerpt | Excerpt. | F-60 |
```

the line:

```text
| Context | Excerpt over its limit | Unresolved, like a missing pointer: more than 1,000 lines or 64 KiB is not read, and the agent's warning says to narrow the pointer. | FR-8, AD-12 |
```

## Block 4: Voice and Tone, the Context column and Reading panel rows (open questions A10 and A14)

Current:

```text
| Context column | "Excerpt and references", "Beside \| Inline", "opens in a reading panel", "opens in browser ↗", "Open in reading panel", type labels "FILE", "GITHUB" | — | Structural mock, L160, F-60 |
| Reading panel | "Open in editor", "Changed since the agent asked" | — | L79, F-40 |
```

Replacement:

```text
| Context column | "Excerpt and references", "Beside \| Inline", "opens in a reading panel", "opens in browser ↗", "Open in reading panel", type labels "FILE", "GITHUB", "WEB" (every other web address, Atlassian's included); for an unresolved excerpt or image, "Unresolved" with its pointer (to review) | — | Structural mock, L160, F-60 |
| Reading panel | "Open in editor", "Changed since the agent asked"; "This file is not available", "This file cannot be shown as text", "This file is too large to show here", each with the path; "No editor set: `editor` in ~/.config/askboard/config.json", "Could not start the editor" (to review) | — | L79, F-40 |
```

## Block 5: Preferences and Settings, the "Editor" row (open question A4)

Current:

```text
| Editor | The command "Open in editor" uses, started with an argument vector, never through a shell | Read-only, with its file and key | Next session | L79, L80, L171, pending ACR-04 |
```

Replacement:

```text
| Editor | The command "Open in editor" uses: a list of arguments, the program first, with `{file}` and `{line}` where the file and its line go, started with that argument vector, never through a shell. While none is set, "Open in editor" is disabled and says which key to set | Read-only, with its file and key | Next session | L79, L80, L171, pending ACR-04 |
```

## Block 6: Open Items 11 and 20 (open questions A9 and A3)

### 6.1 Open Items 11

Current:

```text
11. **References without excerpts.** Where the references go for a question that has no excerpts (L106 ties the split to excerpts).
```

Replacement:

```text
11. **References without excerpts.** Decided by the OpenSpec change `excerpts` (open question A9): inline under the question text (Context column).
```

### 6.2 Open Items 20

Current:

```text
20. **Settings panel.** The scope precedence for theme, density and context placement, and what "Open in editor" does while no editor is set. The files shown on the read-only rows in the settings mock are sample values, pending the scope rule.
```

Replacement:

```text
20. **Settings panel.** The scope precedence for theme, density and context placement. The files shown on the read-only rows in the settings mock are sample values, pending the scope rule. While no editor is set, "Open in editor" is disabled and names the key (Preferences and Settings, Editor; OpenSpec change `excerpts`, open question A3).
```
