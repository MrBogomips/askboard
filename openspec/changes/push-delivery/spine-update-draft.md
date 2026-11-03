# Spine update draft: push delivery

Replacement texts for task 1.3, drafted before the PO's decisions. Each block belongs to one open question of proposal.md, or to a fact this change settles, and applies only if the PO accepts the default it rests on. Each block quotes the current text exactly, then gives the replacement. AD IDs stay stable: every AD is amended in place, and no AD is added. Nothing here is applied to `docs/` until then.

**Applied on 2026-10-31.** The PO accepted every default the blocks rest on, so blocks 1 to 9 were applied as written (task 1.3).

Files, all under `docs/`:

- **Spine:** `architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`
- **Solution design:** `architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`
- **PRD:** `prd-askboard-2026-10-25/prd.md`
- **Experience:** `ux-askboard-2026-10-27/EXPERIENCE.md`

How to apply:

- Apply the blocks whose condition holds. For a question answered with another option, rewrite its blocks first.
- A phrase block replaces only the quoted phrase; the rest of the line stays.
- Set `updated:` to the apply date in every file changed.
- Verify with `openspec validate --all --strict --no-interactive`, `bun run check` (the import check's rules table follows block 1), and a grep for each replacement.

| Block | Condition | Touches |
| --- | --- | --- |
| 1 | Open question 8 | Spine AD-1 |
| 2 | Open question 4 | Spine AD-5 |
| 3 | Open question 6 | Spine AD-18 |
| 4 | Open question 3 | Spine Consistency Conventions; Experience Notices |
| 5 | Always (decision 1 sets the value) | Spine Deferred; solution design §12 |
| 6 | Open question 2 | PRD FR-23; Experience Surfaces, Notices |
| 7 | Always (decision 11) | Spine Consistency Conventions, Tests |
| 8 | Open question 9 | Spine AD-4 |
| 9 | Open question 9 | Experience Board anatomy, Open Items |

## Block 1: AD-1, the entry point imports `hooks`

### 1.1 Spine, AD-1, Rule, Imports, third bullet (phrase)

Current:

```text
it may import `ask-core`, `contract` and every server unit, and no unit imports it.
```

Replacement:

```text
it may import `ask-core`, `contract`, every server unit and `hooks`, whose hook mode (`askboard hook <event>`) and local API client run from the same executable (AD-19), and no unit imports it.
```

## Block 2: AD-5, the session folder

### 2.1 Spine, AD-5, Rule, Reaching the session process, second bullet (phrase)

Current:

```text
It sits in a user-only runtime folder (0700, file 0600) and is named by its `key`,
```

Replacement:

```text
It sits in a user-only runtime folder (0700, file 0600), `$XDG_RUNTIME_DIR/askboard` when that variable is set, else `${TMPDIR:-/tmp}/askboard-<uid>`, and is named by its `key`,
```

## Block 3: AD-18, the version gate's refusal

### 3.1 Spine, AD-18, Rule, Claude Code versions, second bullet (phrase)

Current:

```text
When neither is known, it allows the ask and warns. Below the minimum, it refuses the ask, saying why.
```

Replacement:

```text
When neither is known, it allows the ask and writes a diagnostic to stderr. Below the minimum, it refuses the ask with an error naming the minimum and the version found, and creates nothing.
```

## Block 4: the board notice and the pending-asks list

### 4.1 Spine, Consistency Conventions, Board link and notice (phrase)

Current:

```text
A `PostToolUse` hook on `ask` shows it to the user as a system message for the main conversation's asks, with or without the mod; for a subagent's ask, Claude Code files that message in the subagent's transcript, out of the user's sight. The mod shows a subagent's link as a toast when the ask arrives, and keeps the list of pending asks in a status entry, updated whenever an ask is answered or closes (FR-23).
```

Replacement:

```text
A `PostToolUse` hook on `ask` shows it to the user as a system message for the main conversation's asks, with or without the mod, as "AskBoard · <title> · <link>"; for a subagent's ask it returns nothing, since Claude Code would file the message in the subagent's transcript, out of the user's sight. The mod shows a subagent's link as a toast when the ask arrives, and keeps the pending asks in a status entry, one line each, "<title> · <who> · <n> open · <link>", updated whenever the list changes and cleared when it is empty (FR-23).
```

### 4.2 Experience, Notices, The terminal link (phrase)

Current:

```text
A hook shows it to the user as a system message, for the main conversation and subagents alike (ARCHITECTURE-SPINE, Conventions). Its surrounding text is not recorded.
```

Replacement:

```text
A hook shows it to the user as a system message for the main conversation's asks, as "AskBoard · <title> · <link>". For a subagent's ask, the mod shows it as a toast and in the pending-asks list; with mods off, the browser and the notification remain (ARCHITECTURE-SPINE, Conventions; FR-23).
```

### 4.3 Experience, Notices, Pending-asks list (phrase)

Current:

```text
Its wording is not recorded.
```

Replacement:

```text
Each line reads "<title> · <who> · <n> open · <link>", and the list is cleared when no ask is pending.
```

## Block 5: the record timeout

E4 sets the record timeout to 10 s in `contract` (design decision 1).

### 5.1 Spine, Deferred, the Implementation row (phrase)

Current:

```text
the reconnect grace period, the record timeout, where the file path
```

Replacement:

```text
the reconnect grace period, where the file path
```

### 5.2 Solution design §12, Implementation row (phrase)

Current:

```text
grace period, record timeout, where the file path
```

Replacement:

```text
grace period, where the file path
```

## Block 6: the macOS notification

### 6.1 PRD, FR-23, description (phrase)

Current:

```text
the notification and the terminal link then open it.
```

Replacement:

```text
the terminal link then opens it, and so does the notification where the operating system lets a notification open a link (on macOS it only announces the ask).
```

### 6.2 PRD, FR-23, Consequences, fifth bullet

Current:

```text
- The link in the terminal opens the board of that ask.
```

Replacement:

```text
- The link in the terminal opens the board of that ask, and on Linux so does the notification.
```

### 6.3 Experience, Information Architecture, Surfaces, System notification row (phrase)

Current:

```text
and opens the board (F-49)
```

Replacement:

```text
and opens the board where the system lets it: on Linux, not on macOS (F-49, FR-23)
```

### 6.4 Experience, Notices, The notification (phrase)

Current:

```text
The notification and the terminal link both open the board (F-49).
```

Replacement:

```text
The terminal link opens the board; the notification opens it on Linux, and on macOS only announces the ask (F-49, FR-23).
```

## Block 7: the conformance runs with the mod

### 7.1 Spine, Consistency Conventions, Tests, CI runs (phrase)

Current:

```text
the conformance suite with and without mod and hooks (AD-1);
```

Replacement:

```text
the conformance suite with and without mod and hooks (AD-1), the hooks as processes of the built executable and the mod in a stand-in host of the mod API;
```

## Block 8: AD-4, how the agent status combines its signals

### 8.1 Spine, AD-4, Rule, Agent status, first bullet (phrase)

Current:

```text
When the mod runs, the agent's turn state decides.
```

Replacement:

```text
When the mod runs, the agent's turn state decides as well: an owner with no turn running is waiting. A main-conversation call counts as moved to the background once it has been pending longer than Claude Code's threshold, `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` (120 s by default).
```

## Block 9: the context header's first row

### 9.1 Experience, Board anatomy, Context header, Row 1 (phrase)

Current:

```text
Which header row it sits in is not recorded (Open Items 13).
```

Replacement:

```text
It sits in row 1, after who asked. Directory is the agent's working directory relative to the ask's root ("." at the root), and a field AskBoard does not know, as for an ask with no agent record, shows "—".
```

### 9.2 Experience, Open Items, Open points, item 13

Current:

```text
13. **"For: <name>".** Which header row it goes in.
```

Replacement:

```text
13. **"For: <name>".** Decided by the OpenSpec change `push-delivery`: row 1, after who asked (Board anatomy).
```
