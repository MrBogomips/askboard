# Spine update draft: Snapshots

Replacement texts for task 0.5, drafted before the PO's decisions. Each block belongs to one or more open questions of proposal.md and applies only if the PO accepts the defaults it rests on. Each block quotes the current text exactly, as it stands on `main` at 92ca203, then gives the replacement. AD IDs stay stable: AD-15 is amended in place, and no AD is added. Nothing here is applied to `docs/` until then. The PRD needs no change.

**Status (2026-11-01):** the PO accepted every open question these blocks rest on as proposed (decisions-5), so every block's condition holds and none needs rewriting; XC-A1 changes none of the quoted texts. No block is applied yet: all seven are applied in task 0.5, after the rebase of task 0.1 on E3 and E4, as "How to apply" says. On this branch (`docs/` as on `main` at 92ca203) each current text stood exactly once on 2026-11-01; task 0.5 checks them again on the rebased `main`.

Files, all under `docs/`:

- **Spine:** `architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`
- **Solution design:** `architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`
- **Experience:** `ux-askboard-2026-10-27/EXPERIENCE.md`

How to apply:

- After the rebase of task 0.1, and before task 0.5 applies anything, check that each quoted text is still on `main` word for word; E3's and E4's drafts touch none of them, but a later change might.
- Apply the blocks whose condition holds. For a question answered with another option, rewrite its blocks first.
- A phrase block replaces only the quoted phrase; the rest of the line stays.
- Set `updated:` to the apply date in every file changed.
- Verify with `openspec validate --all --strict --no-interactive`, `bun run check`, and a grep for each replacement.

| Block | Condition | Touches |
| --- | --- | --- |
| 1 | Open questions A1 and A2 | Spine AD-15 |
| 2 | Open questions A3 and B4 | Spine AD-15 |
| 3 | Open question A4 | Spine AD-15 |
| 4 | Open question B1 | Spine Structural Seed |
| 5 | Open questions A1, A3, A4 and A7 | Solution design §5.6 |
| 6 | Open questions B5 and B6 | Experience Voice and Tone |
| 7 | Open question B7 | Experience Snapshots, Open Items |

## Block 1: what the data block holds

### 1.1 Spine, AD-15, Rule, Content, second bullet (phrase)

Current:

```text
It holds the board documents (AD-12) and every event in the ask's log, each answer carried with its full edited value on its own revision (AD-20), and the kept light and dark render of each diagram (AD-9).
```

Replacement:

```text
It holds the Snapshot's own record (when it was taken, by the agent or by whom, and whether a board's Snapshot left unsent work out); the current board document and every earlier revision an event names (AD-12); the board state the live board receives, with each question's state, current and previous answer, whether it was recorded, its receipt and its follow-up thread; the ask's origin (AD-5); every event in the ask's log, each answer carried with the full edited values `ask-core` keeps for it (AD-20); the molecule expansion map; and the kept light and dark render of each diagram (AD-9). The board document, revisions and board state use expanded IDs, as the view renders them; events and their values use the molecule references, as `collect` returns them.
```

## Block 2: the data block's place and the notices

### 2.1 Spine, AD-15, Rule, Content, second bullet (phrase)

Current:

```text
comes first, with `<` escaped.
```

Replacement:

```text
comes before every style and script, after the charset declaration and the view CSP meta tag, with `<` escaped.
```

### 2.2 Spine, AD-15, Rule, Content, third bullet (phrase)

Current:

```text
After the data block come the chunks the board uses, their styles, the view CSP as a meta tag and the licence notices of the inlined code.
```

Replacement:

```text
After the data block come the styles and scripts of the chunks the board uses, then the licence notices of the inlined code, as the JSON block `<script type="application/json" id="askboard-licences">`, with `<` escaped.
```

## Block 3: the file name and the returned path

### 3.1 Spine, AD-15, Rule, Writing, first bullet (phrase)

Current:

```text
`<ask-id>-<UTC timestamp>-<short random>.html`
```

Replacement:

```text
`<ask-id>-<YYYYMMDDTHHMMSSZ>-<6 characters from [a-z0-9]>.html`, with no colon
```

### 3.2 Spine, AD-15, Rule, Writing, second bullet

Current:

```text
    - The tool returns the file path, not the content.
```

Replacement:

```text
    - The tool returns the file's absolute path, not the content.
```

## Block 4: the port in the source tree

### 4.1 Spine, Structural Seed, Source tree, `core/` line (phrase)

Current:

```text
ports (BoardAddress, MoleculeSource, Config, FormulaEngine use)
```

Replacement:

```text
ports (BoardAddress, MoleculeSource, Config, SnapshotWriter, FormulaEngine use)
```

## Block 5: the Snapshot flow

### 5.1 Solution design, §5.6, step 1

Current:

```text
1. The owner calls `snapshot`, which takes no path.
```

Replacement:

```text
1. The owner calls `snapshot`, which takes no path, or the user presses Snapshot on the board. `ask-core` gathers the data at once and hands it to its `SnapshotWriter` port, which the `snapshot` unit implements.
```

### 5.2 Solution design, §5.6, step 2 (phrase)

Current:

```text
`assemble` writes the `askboard-data` block first (`<` escaped), with the board documents, the whole log, each answer's full value stored with its revision, and the light and dark render `board-host` kept for each diagram; then the chunks used, their styles, the view CSP and the licence notices.
```

Replacement:

```text
`assemble` writes the view CSP, then the `askboard-data` block (`<` escaped), with the Snapshot's record, the board document and the revisions events name, the board state, the origin, the whole log with each answer's full values, the expansion map, and the light and dark render `board-host` kept for each diagram; then the chunks used and their styles, and the licence notices last.
```

### 5.3 Solution design, §5.6, step 3 (phrase)

Current:

```text
The file `<ask-id>-<UTC timestamp>-<short random>.html`
```

Replacement:

```text
The file `<ask-id>-<YYYYMMDDTHHMMSSZ>-<short random>.html`
```

### 5.4 Solution design, §5.6, step 4 (phrase)

Current:

```text
The tool returns the path (FR-26).
```

Replacement:

```text
The tool returns the absolute path (FR-26). A Snapshot the user takes is no event: the agent finds it in the folder.
```

## Block 6: the Snapshot strings

### 6.1 Experience, Voice and Tone, Snapshot row

Current:

```text
| Snapshot | "Your unsent work will not be in the Snapshot"; on a project-file reference, "not available in a Snapshot"; the top line of an opened Snapshot, "Snapshot · taken Oct 28, 2026, 4:12 PM by the agent · read-only" (when and by whom; to review) | — | F-80, F-69, L207 |
```

Replacement:

```text
| Snapshot | "Your unsent work will not be in the Snapshot", shown as the Snapshot is taken, with no confirmation; on a project-file reference, "not available in a Snapshot"; the top line of an opened Snapshot, "Snapshot · taken Oct 28, 2026, 4:12 PM by the agent · read-only" (when and by whom; to review), with "by <who>" when the user took it and "· your unsent work is not included" before "· read-only" when the board held unsent work (to review) | — | F-80, F-69, L207; OpenSpec change `snapshot` |
```

## Block 7: whether the board shows the agent's Snapshot

### 7.1 Experience, Snapshots, last bullet

Current:

```text
- **Not recorded:** whether the board shows a Snapshot the agent took.
```

Replacement:

```text
- **The agent's Snapshots:** the board does not show a Snapshot the agent took; the agent's result names the file (OpenSpec change `snapshot`).
```

### 7.2 Experience, Open Items, Open points, item 19

Current:

```text
19. **Snapshot feedback.** Whether the board shows a Snapshot the agent took.
```

Replacement:

```text
19. **Snapshot feedback.** Decided by the OpenSpec change `snapshot`: the board does not show a Snapshot the agent took (Snapshots).
```
