# Spine update draft: excerpts (E5)

Six blocks, each for one of the proposal's open questions. A block applies only if the PO accepts the choice made there; a question the PO reverses leaves its block unapplied, and the change is revised with `/opsx:update`. Each block quotes the current text exactly, then gives the replacement. ADs are amended in place; none is added or renumbered.

**Applied 2026-11-05** (task 9.1; the PO accepted every question these blocks serve on 2026-11-01, decisions-5). Blocks 1, 2, 3.1, 4, 5, 6.1 and 6.2 were applied word for word. Blocks 3.2 and 6.3 quote rows that E3 and E4 had since changed (the grace period, the record timeout), so their intent was applied to the rows as they stand: only the phrase "where the file path and line sit in the user's `editor` command" was removed from the Deferred row of the spine and from the Implementation row of SOLUTION-DESIGN §12. The spine's `updated:` is 2026-11-05.

Files: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (blocks 1 to 5 and 6.1) and `docs/architecture-askboard-2026-10-27/SOLUTION-DESIGN.md` (block 6.2 and 6.3), which the spine wins over and which must not contradict it.

How to apply: replace each quoted passage, set the spine's `updated:` to the apply date and add a `sources` line for this change in its front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. E3 and E4 also edit the Deferred row (block 3.2): if their edits are applied first, remove only the phrase this block removes.

## Block 1: AD-8, the source view's policy and the reading panel's frame (open question A2)

### 1.1 Rule, Pages on the board origin, second bullet

Current:

```text
    - A source view is a page AskBoard builds, never the file served with its own content type. It is served with `X-Content-Type-Options: nosniff` and the CSP `default-src 'none'`, styles by hash, `img-src data:`, `frame-ancestors 'self'`: only a board page of the same origin may frame it, in its reading panel.
```

Replacement:

```text
    - A source view is a page AskBoard builds, never the file served with its own content type. It is served with `X-Content-Type-Options: nosniff` and the CSP `default-src 'none'`, styles by hash, `img-src data:`, `frame-ancestors 'self'`, `base-uri 'none'`, `form-action 'none'`: only a board page of the same origin may frame it, in its reading panel. It holds no script, and it serves only a pointer excerpt or pointer reference of its ask's current board document, named by item ID.
```

### 1.2 Rule, Talking to the outside, third bullet

Current:

```text
    - A project-file reference opens a reading panel on the board page, which frames the token-gated source view that `board-host` serves at the anchor, confined by AD-12.
```

Replacement:

```text
    - A project-file reference opens a reading panel on the board page, which frames the token-gated source view that `board-host` serves at the anchor, confined by AD-12. The frame carries an empty `sandbox` attribute and `referrerpolicy="no-referrer"`, so the source view has an opaque origin and runs nothing.
```

## Block 2: AD-11, the source view's token (open question A1)

Rule, Board requests, first bullet.

Current:

```text
    - Each board has its own random token of at least 128 bits. The token travels in the page URL, and on every other request only in a request header or the first WebSocket message. AskBoard sets no cookies.
```

Replacement:

```text
    - Each board has its own random token of at least 128 bits. The token travels in the URL of the two pages AskBoard serves on the board origin, the board page and a source view (AD-8), since a frame's navigation carries no header, and on every other request only in a request header or the first WebSocket message. AskBoard sets no cookies.
```

## Block 3: AD-8, where the file and line sit in the editor command (open question A4)

### 3.1 Rule, Talking to the outside, Editor launch, third sub-bullet

Current:

```text
      - The path enters the argument vector as its absolute real path, resolved and confined again under AD-12 at the click. The line enters as an integer that AskBoard derives. Neither is truncated, and no other agent text enters the vector.
```

Replacement:

```text
      - The path enters the argument vector as its absolute real path, resolved and confined again under AD-12 at the click. The line enters as an integer that AskBoard derives. Neither is truncated, and no other agent text enters the vector.
      - The `editor` key is itself an argument vector, a list of strings whose first is the program. AskBoard replaces exactly `{file}` and `{line}` wherever they occur inside an argument and expands nothing else; a command with no `{file}` gets the path as its last argument.
```

### 3.2 Deferred, third row, first cell

Current:

```text
| Default port range, the container opt-in setting, the host-side address and port in printed links, whether VS Code Dev Containers' `BROWSER` helper and port forwarding make the container opt-in unnecessary there, the reconnect grace period, the record timeout, where the file path and line sit in the user's `editor` command | AD-5, AD-8, AD-11 and AD-21 fix the rules; the keys are named in the configuration schema | Implementation |
```

Replacement (removes the last phrase; AD-8 now fixes it):

```text
| Default port range, the container opt-in setting, the host-side address and port in printed links, whether VS Code Dev Containers' `BROWSER` helper and port forwarding make the container opt-in unnecessary there, the reconnect grace period, the record timeout | AD-5, AD-8, AD-11 and AD-21 fix the rules; the keys are named in the configuration schema | Implementation |
```

## Block 4: Consistency Conventions, "Excerpts and media" (open questions A5 and A6)

Current:

```text
| Excerpts and media | Pointer = one string: a root-relative path, `#` and an anchor, `L<start>-L<end>` for a line range, otherwise a heading, then an ID (`docs/prd.md#Billing`, `src/retry.ts#L40-L62`). Agent-written excerpts are text. Images by pointer only (AD-12). |
```

Replacement:

```text
| Excerpts and media | Pointer = one string: a root-relative path, `#` and an anchor, `L<start>-L<end>` for a line range, otherwise a heading, then an ID (`docs/prd.md#Billing`, `src/retry.ts#L40-L62`). The first `#` ends the path; a path with an empty, `.` or `..` segment, a leading `/`, a backslash or a control character is unresolved. A heading or an ID resolves only in a Markdown file: the first ATX heading outside fenced code whose text equals the anchor, else the first that holds it as a whole word; the excerpt is that heading's section. An excerpt's pointer needs an anchor, a reference's may omit it, an image's has none. Agent-written excerpts are text. Images by pointer only (AD-12). |
```

## Block 5: Structural Seed, the `core/` line (proposal, B1)

`snapshot` (E7) drafts `SnapshotWriter` for the same list; keep both names when both apply.

Current:

```text
    core/                # ask-core: asks, revisions, board documents, event logs, drafts, ports (BoardAddress, MoleculeSource, Config, FormulaEngine use)
```

Replacement:

```text
    core/                # ask-core: asks, revisions, board documents, event logs, drafts, ports (BoardAddress, MoleculeSource, SourceFiles, Config, FormulaEngine use)
```

## Block 6: the front matter and SOLUTION-DESIGN (follows blocks 1 to 3)

### 6.1 Spine front matter, `sources`

Add, as the last entry of `sources`:

```text
  - 'OpenSpec change excerpts, proposal.md, open questions A1, A2, A4, A5, A6 and B1 (accepted by the PO, 2026-11-01)'
```

### 6.2 SOLUTION-DESIGN §4.5, "Editor arguments" (block 3)

Current:

```text
- **Editor arguments.** The file enters the argument vector as its absolute real path, resolved and confined again under AD-12 at the click: a file swapped for a symlink after the send cannot open outside the root, and a file name starting with `-` cannot pass as an option. The line enters as an integer AskBoard derives. Neither is truncated, since a truncated path would open another file, and no other agent text enters the vector. Only where the two sit in the user's command is left to implementation (§12).
```

Replacement:

```text
- **Editor arguments.** The file enters the argument vector as its absolute real path, resolved and confined again under AD-12 at the click: a file swapped for a symlink after the send cannot open outside the root, and a file name starting with `-` cannot pass as an option. The line enters as an integer AskBoard derives. Neither is truncated, since a truncated path would open another file, and no other agent text enters the vector. The `editor` key is an argument vector in which `{file}` and `{line}` mark where the two go, so `["code", "--goto", "{file}:{line}"]` and `["vim", "+{line}", "{file}"]` both work with no shell (AD-8).
```

### 6.3 SOLUTION-DESIGN §12, the Implementation row

Current:

```text
| Implementation | Default port range, container opt-in setting, host-side link address and port, VS Code Dev Containers' `BROWSER` helper and port forwarding, grace period, record timeout, where the file path and line sit in the user's `editor` command |
```

Replacement:

```text
| Implementation | Default port range, container opt-in setting, host-side link address and port, VS Code Dev Containers' `BROWSER` helper and port forwarding, grace period, record timeout |
```

SOLUTION-DESIGN §4.5, "Reading panel", also says the source view is "still text only, with `nosniff` and `default-src 'none'`", which block 1 keeps true; no change there.
