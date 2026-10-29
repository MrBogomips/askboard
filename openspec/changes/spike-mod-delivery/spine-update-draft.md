# Spine update draft: mod delivery spike

Replacement texts for task 5.2, drafted before the PO's decisions. Each block belongs to one row of "Proposed outcomes (awaiting the PO)" in `findings.md` and applies only if the PO accepts that row. Each block quotes the current text exactly, then gives the replacement. AD IDs stay stable: every AD is amended in place, and no AD is added.

Files, all under `docs/`:

- **Spine:** `architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`
- **Solution design:** `architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`
- **PRD:** `prd-askboard-2026-10-25/prd.md`
- **Addendum:** `prd-askboard-2026-10-25/addendum.md`

How to apply:

- Apply the blocks of accepted rows only. For a row accepted with changes, edit its blocks first.
- Two rows that touch one passage replace different phrases of it, so their blocks apply in any order. The blocks say where this happens.
- A phrase block replaces only the quoted phrase; the rest of the line stays.
- Set `updated:` to the apply date in every file changed.
- Verify with `openspec validate --all --strict --no-interactive`, `bun run check`, and a grep showing that no Deferred row of the spine still names the mod delivery spike as pending (task 5.2).

| Row | Touches |
| --- | --- |
| 1 | Spine AD-4, Structural Seed; solution design §4.1 |
| 2 | Spine AD-5; solution design §4.3 |
| 3 | Solution design §4.3, §7; addendum K3 |
| 4 | Spine AD-5 |
| 5 | Spine AD-2 |
| 6 | Spine AD-10; solution design §5.5 |
| 7 | Spine AD-11; solution design §6 |
| 8 | Spine AD-12; solution design §4.6 |
| 9 | Spine AD-17; solution design §7; addendum measurement protocol |
| 10 | Solution design §7, §8 |
| 11 | Spine Stack; solution design §4.9, §8 |
| 12 | Spine Consistency Conventions; solution design §5.1, §8; PRD FR-23 |
| 13 | PRD OQ2 (and, through row 18, the Deferred latency row and §12) |
| 14 | Solution design §7 |
| 15 | PRD R1; addendum "How answers reach a working agent" |
| 16 | Solution design §10.4 |
| 17 | Solution design §13, §10.4 |
| 18 | Spine Deferred; solution design §10.1, §12; front matter |

## Row 1: AD-4, the mod's push paths

Applies only if the PO accepts row 1.

### 1.1 Spine, AD-4, Prevents

Current (spine):

```text
- **Prevents:** a capability that works only when the mod runs; agents stalled where mods are disabled; a wait that blocks follow-ups; agent status mistaken for a user event.
```

Replacement:

```text
- **Prevents:** a capability that works only when the mod runs; agents stalled where mods are disabled; a wait that blocks follow-ups; agent status mistaken for a user event; a push that auto mode refuses; a push that resumes a finished subagent; a failed report causing repeated wake-ups.
```

### 1.2 Spine, AD-4, Rule, Push, first bullet

Current (spine):

```text
    - The Claude Code **mod** is the default push transport: `$.session.send` to a running subagent, `$.prompt.submit` to wake an idle main conversation. It pushes only events above `received` (AD-3) and reports what it delivered, which raises `received` and so the board's delivery receipt. Its absence costs latency, never correctness: an answer's receipt then waits for `collect` or the `SubagentStop` guard.
```

Replacement (three bullets):

```text
    - The Claude Code **mod** is the default push transport. It appends with `$.session.append` to a running subagent, and to the main conversation while its turn runs; the agent reads the row at its next model request. It wakes an idle main conversation with `$.prompt.submit`. When a main turn completes, it submits again every event it appended after that turn's last model request, since no request carried it. It does not use `$.session.send`, which auto mode refuses for a mod.
    - It pushes only to an agent that is still running: never to a subagent that `$.agent.list()` no longer lists or shows as `completed`, `failed` or `killed`, since a message would resume it. A submit that Claude Code drops after the user interrupts a turn is kept and retried at the next `turn.complete` or `turn.start`.
    - It pushes only events above `received` (AD-3) and reports what it delivered, which raises `received` and so the board's delivery receipt. An event counts as pushed once the push call is made: a report that fails is retried on its own and never causes another push. Its absence costs latency, never correctness: an answer's receipt then waits for `collect` or the `SubagentStop` guard.
```

The interrupt sentence waits for run `d-esc-312`; if that run shows a retry is not needed or does not work, the sentence changes with it.

### 1.3 Spine, AD-4, Rule, Push, second bullet

Current (spine):

```text
    - Push goes only to the agent that owns the ask, in its own session, as a message attributed to the mod and never with `asUser`. `$.prompt.submit` carries only events of asks owned by the main conversation.
```

Replacement:

```text
    - Push goes only to the agent that owns the ask, in its own session, as a message attributed to the mod and never with `asUser`: an appended row names the plugin as its origin. `$.prompt.submit`, and an append without an agent ID, carry only events of asks owned by the main conversation.
```

### 1.4 Spine, Structural Seed, "Containers and data flow"

Current (spine):

```text
  modU -.->|"session.send"| sub
  modU -.->|"prompt.submit"| main
```

Replacement:

```text
  modU -.->|"session.append"| sub
  modU -.->|"session.append, or prompt.submit when idle"| main
```

### 1.5 Spine, Structural Seed, "Answer delivery to a subagent"

Current (spine):

```text
  M-->>A: session.send(event seq 1, cursor e.1)
```

Replacement:

```text
  M-->>A: session.append(event seq 1, cursor e.1)
```

### 1.6 Solution design, §4.1, Decision

Current (solution design):

```text
**Decision (AD-4).** Every capability works through the MCP tools alone, with `collect` as the authoritative pull path. For push, the product owner chose the Claude Code mod (OQ1), because it is cleaner and faster than a Monitor watch or a hook: `$.session.send` reaches a running subagent, `$.prompt.submit` wakes an idle main conversation [F9]. Pull stays authoritative because organizations can switch mods off, mods skip Desktop WSL sessions [F8], and three facts the mod relies on are undocumented [F12].
```

Replacement:

```text
**Decision (AD-4).** Every capability works through the MCP tools alone, with `collect` as the authoritative pull path. For push, the product owner chose the Claude Code mod (OQ1), because it is cleaner and faster than a Monitor watch or a hook. The mod delivery spike (§10.1) settled its paths: `$.session.append` reaches a running subagent, and the main conversation while its turn runs, at the agent's next model request; `$.prompt.submit` wakes an idle main conversation; `$.session.send` is not used, because auto mode refuses it for a mod [F9]. Pull stays authoritative because organizations can switch mods off, mods skip Desktop WSL sessions [F8], and the mod relies on behaviour the spike observed but no documentation states [F9, F12].
```

### 1.7 Solution design, §4.1, candidates table

Current (solution design):

```text
| Mod: `$.session.send`, `$.prompt.submit` | Yes, while running [F9] | **Chosen push;** on by default since 2.1.287 [F8] |
| Monitor watch (`askboard watch`) | Background subagents have it; routing implied [F25] | Fallback adapter; re-arm after 5 min (30 max); Bash permissions |
| `PostToolUse` `additionalContext` | Yes, with `agent_id` [F4] | Fallback adapter; lands only at the next tool call |
```

Replacement:

```text
| Mod: `$.session.append`, `$.prompt.submit` | Yes, while running [F9]; `$.session.send` refused under auto mode | **Chosen push;** on by default since 2.1.287 [F8]; confirmed by the mod delivery spike (§10.1) |
| Monitor watch (`askboard watch`) | Background subagents have it; routing implied [F25] | Fallback adapter, not built: the mod reaches every kind of agent (§10.1); re-arm after 5 min (30 max); Bash permissions |
| `PostToolUse` `additionalContext` | Yes, with `agent_id` [F4] | Fallback adapter, not built (§10.1); lands only at the next tool call |
```

## Row 2: AD-5, the session-file key and the mod's session ID

Applies only if the PO accepts row 2.

### 2.1 Spine, AD-5, Rule, Reaching the session process, the session file

Current (spine):

```text
    - The session file is a `contract` module and schema: `{format, key, pid, epoch, apiAddress, sessionToken, projectDir, startedAt}`. It sits in a user-only runtime folder (0700, file 0600) and is named by `CLAUDE_CODE_SESSION_ID`. No unit computes its path itself. A client that finds no candidate file, or more than one, reaches none and falls back as above.
```

Replacement (three bullets):

```text
    - The session file is a `contract` module and schema: `{format, key, pid, epoch, apiAddress, sessionToken, projectDir, startedAt}`. It sits in a user-only runtime folder (0700, file 0600) and is named by its `key`, the PID of the Claude Code process. That process is the parent of the session process and of every hook; the mod learns its PID once, at `session.start`, from one `$.process.run` of a command that prints its parent's PID. `CLAUDE_CODE_SESSION_ID` is not the key: after `--continue` or `/clear` the session process and the hooks see different values. No unit computes its path itself. A client that finds no candidate file, or more than one, reaches none and falls back as above.
    - The launcher keeps Claude Code as the parent: it replaces itself with the executable (AD-19).
    - Wherever the mod needs the session ID, it takes it from `$.session.id()`, never from its environment, which holds the launching session's ID when Claude Code runs inside another session.
```

### 2.2 Spine, AD-5, Rule, Reaching the session process, polling

Current (spine):

```text
    - The local API answers at once, with no long-poll. Each response body stays under 1 MiB and is paged by `seq`. The mod polls it with `$.clock.every`, started at `session.start`.
```

Replacement:

```text
    - The local API answers at once, with no long-poll. Each response body stays under 1 MiB and is paged by `seq`. The mod polls it with `$.clock.every`, started at `session.start`; the poll survives `/clear`, which fires `session.end` and no new `session.start`.
```

### 2.3 Solution design, §4.3, Session file

Current (solution design):

```text
- **Session file,** named by `CLAUDE_CODE_SESSION_ID`, which the session process, hooks and mods all know; after `/clear` or `--continue`, the IDs the session process and the hooks see may differ [F13]. No file, or several, means pull only: a mismatch costs push, never misroutes an answer.
```

Replacement:

```text
- **Session file,** named by the PID of the Claude Code process, the parent of the session process and of every hook; the mod reads it once with `$.process.run`. `CLAUDE_CODE_SESSION_ID` cannot be the key: on `--continue` the session process gets a new ID while the hooks keep the old one, and after `/clear` the hooks move to a new ID while the session process keeps its own [F13]. No file, or several, means pull only: a mismatch costs push, never misroutes an answer.
```

## Row 3: AD-5, binding a record to its call

Applies only if the PO accepts row 3. AD-5's binding rule itself does not change.

### 3.1 Solution design, §4.3, Record (phrase)

Current phrase (solution design):

```text
The record binds to its call by `tool_use_id` when the call carries one (unverified over stdio [F16]), otherwise to the next matching call within the record timeout.
```

Replacement:

```text
The record binds to its call by `tool_use_id`, which Claude Code puts in every call's `_meta` as `claudecode/toolUseId` [F16], otherwise to the next matching call within the record timeout.
```

### 3.2 Solution design, §7, the benchmark, K1 to K3 (phrase)

Current phrase (solution design):

```text
The hook's `tool_use_id` joins t2 and t3 to the transcript; trace context over stdio is unverified [F16].
```

Replacement:

```text
The hook's `tool_use_id`, which every call also carries in its `_meta`, joins t2 and t3 to the transcript; calls over stdio carry no trace context [F16].
```

### 3.3 Addendum, Measurement protocol, K3 (phrase)

Current phrase (addendum):

```text
Join keys: `traceparent` over HTTP, or the `tool_use_id` a `PreToolUse` hook logs; stdio `_meta` is unverified.
```

Replacement:

```text
Join keys: `traceparent` over HTTP, or the `tool_use_id` a `PreToolUse` hook logs, which calls over stdio also carry in `_meta` as `claudecode/toolUseId` (mod delivery spike).
```

## Row 4: AD-5, the mod when `$.http.fetch` is refused

Applies only if the PO accepts row 4.

### 4.1 Spine, AD-5, Rule, Reaching the session process, first bullet

Current (spine):

```text
    - `mod` and `hooks` reach the session process only through its local API (AD-11), found through the session file.
```

Replacement:

```text
    - `mod` and `hooks` reach the session process only through its local API (AD-11), found through the session file. When `$.http.fetch` is refused (an organization's policy, or a policy mod that hooks it), the mod reaches the same API through the AskBoard executable run as a client with `$.process.run`, for everything it sends: polls, delivery reports and the version report. Whether that client starts once per poll or stays up for the session is an implementation choice.
```

## Row 5: AD-2, exit signal and start

Applies only if the PO accepts row 5.

### 5.1 Spine, AD-2, Rule, Start

Current (spine):

```text
  - **Start:** the session process has no side effects (no port, no session file, no notifier, no download) until it receives its first request other than `server/discover`.
```

Replacement:

```text
  - **Start:** the session process has no side effects (no port, no session file, no notifier, no download) until it receives its first request other than `server/discover`. Claude Code sends `subscriptions/listen` right after the handshake, so the local API and the session file exist from connection, before the first ask's `PreToolUse` record needs them.
```

### 5.2 Spine, AD-2, Rule, Exit

Current (spine):

```text
  - **Exit:** it exits when its stdin closes or on SIGTERM or SIGHUP, after sending `discarded` to every live board. All its asks are then discarded (FR-25).
```

Replacement:

```text
  - **Exit:** it exits when its stdin closes or on SIGINT, SIGTERM or SIGHUP, after sending `discarded` to every live board, and removes its session file. Claude Code stops it with SIGINT. All its asks are then discarded (FR-25).
```

If row 7 is accepted too, read "removes its session file and its socket".

## Row 6: AD-10, the stop guard

Applies only if the PO accepts row 6. The condition on `stop_hook_active` does not change.

### 6.1 Spine, AD-10, Rule, Subagents, last bullet

Current (spine):

```text
    - A stop is let through for an ask with no bound owner.
```

Replacement:

```text
    - A stop is let through for an ask with no bound owner, and, without an error, for an agent the session process has no record of, such as Claude Code's own side agents (empty `agent_type`).
```

### 6.2 Solution design, §5.5, step 5

Current (solution design):

```text
5. An ask with no owner never blocks a stop. Without hooks there is no guard, and the `ask` result already said so.
```

Replacement:

```text
5. An ask with no owner never blocks a stop, nor does an agent with no record, such as Claude Code's own side agents. Without hooks there is no guard, and the `ask` result already said so.
```

## Row 7: AD-11, `Origin` and the local API's address

Applies only if the PO accepts row 7. If the PO takes the alternative (loopback TCP stays), apply only 7.A.

### 7.1 Spine, AD-11, Rule, Binding, third bullet

Current (spine):

```text
    - The local API listens on `127.0.0.1` on a port of its own and is never bound to a container interface.
```

Replacement:

```text
    - The local API listens on a Unix socket (0600) in the session-file folder (0700), never on a network interface. The socket's path stays within the platform limit (104 bytes on macOS).
```

### 7.2 Spine, AD-11, Rule, Local API requests

Current (spine):

```text
  - **Local API requests:** the local API has its own session token of at least 128 bits, held only in the session file. It refuses requests that carry a browser `Origin`.
```

Replacement:

```text
  - **Local API requests:** the local API has its own session token of at least 128 bits, held only in the session file, and the socket's file permissions admit only the user. It refuses requests that carry a browser `Origin`; the mod's `$.http.fetch` sends none.
```

### 7.3 Solution design, §6, NFR-3 row (phrase)

Current phrase (solution design):

```text
the local API never on a container interface
```

Replacement:

```text
the local API on a user-only Unix socket, never on a network interface
```

### 7.A If the PO keeps loopback TCP: spine, AD-11, Rule, Local API requests

Current (spine):

```text
  - **Local API requests:** the local API has its own session token of at least 128 bits, held only in the session file. It refuses requests that carry a browser `Origin`.
```

Replacement:

```text
  - **Local API requests:** the local API has its own session token of at least 128 bits, held only in the session file. It refuses requests that carry a browser `Origin`; the mod's `$.http.fetch` sends none.
```

## Row 8: AD-12, the root of a worktree subagent

Applies only if the PO accepts row 8. The root rule does not change.

### 8.1 Spine, AD-12, Rule, The root, first bullet

Current (spine):

```text
    - An ask's root is the git worktree of the owning agent's `cwd` (AD-5) when that worktree belongs to the project's repository. Otherwise it is the session project root, the realpath of `CLAUDE_PROJECT_DIR`.
```

Replacement:

```text
    - An ask's root is the git worktree of the owning agent's `cwd` (AD-5) when that worktree belongs to the project's repository. Otherwise it is the session project root, the realpath of `CLAUDE_PROJECT_DIR`.
    - For an `isolation: worktree` subagent, that `cwd` is its own worktree, which Claude Code removes when the subagent finishes with no change. AskBoard reads files under a root only at send time, so its boards and Snapshots keep their content.
```

### 8.2 Solution design, §4.6, Root

Current (solution design):

```text
- **Root.** The owning agent's git worktree when it belongs to the project, else the realpath of `CLAUDE_PROJECT_DIR` [F14], so agents in worktrees get their own files and distinct board headers (FR-24). Pointers that escape the root through `..` or symlinks count as unresolved.
```

Replacement:

```text
- **Root.** The owning agent's git worktree when it belongs to the project, else the realpath of `CLAUDE_PROJECT_DIR` [F14], so agents in worktrees get their own files and distinct board headers (FR-24). An `isolation: worktree` subagent's hook `cwd` is its own worktree, gone once it finishes unchanged [F5]: board documents already hold what was read. Pointers that escape the root through `..` or symlinks count as unresolved.
```

## Row 9: AD-17 and §7, `--strict-mcp-config`

Applies only if the PO accepts row 9. If the PO takes the alternative (`--mcp-config` under `--strict-mcp-config`), its text is drafted after a run shows that it loads the server, the hooks and the mod together.

### 9.1 Spine, AD-17, Rule, Setup, first bullet

Current (spine):

```text
    - A benchmark run loads AskBoard with `--plugin-dir` as the plugin under test, inside the isolated configuration, and passes `--max-turns`. Its server, hooks and mod are then the only extensions loaded, and the report says how AskBoard was loaded.
```

Replacement:

```text
    - A benchmark run loads AskBoard with `--plugin-dir` as the plugin under test, inside the isolated configuration, and passes `--max-turns`. The isolated configuration leaves out `--strict-mcp-config`, which drops plugin servers. AskBoard's server, hooks and mod are then the only plugin extensions loaded; the account's connectors may still connect, behind tool search. The report says how AskBoard was loaded and lists the MCP servers connected, and arms are compared by their differences.
```

### 9.2 Solution design, §7, the benchmark, first bullet (phrase)

Row 10 replaces another phrase of the same bullet (10.1).

Current phrase (solution design):

```text
in an isolated configuration (`--setting-sources ""`, `--strict-mcp-config`, restricted `--tools`)
```

Replacement:

```text
in an isolated configuration (`--setting-sources ""` and restricted `--tools`, without `--strict-mcp-config`, which drops plugin servers; the account's connectors still connect, and the report lists them)
```

### 9.3 Addendum, Measurement protocol, Pinned settings (phrase)

Current phrase (addendum):

```text
and an isolated configuration (`--setting-sources ""`, `--strict-mcp-config`, restricted `--tools`)
```

Replacement:

```text
and an isolated configuration (`--setting-sources ""` and restricted `--tools`, without `--strict-mcp-config`, which drops plugin servers)
```

## Row 10: `-p` and `--max-turns`

Applies only if the PO accepts row 10. Spine AD-17 keeps "passes `--max-turns`" as it is.

### 10.1 Solution design, §7, the benchmark, first bullet (phrase)

Row 9 replaces another phrase of the same bullet (9.2).

Current phrase (solution design):

```text
with `--max-turns`, because `$.prompt.submit` can keep a `-p` run alive; managed `disableSideloadFlags` would reject `--plugin-dir` [F11].
```

Replacement:

```text
with `--max-turns`, which bounds the turns the mod may start: `-p` ends with the turn, and a submit queued past the limit is dropped. The benchmark reads transcripts, never the JSON `result`, which a woken turn replaces. Managed `disableSideloadFlags` would reject `--plugin-dir` [F11].
```

### 10.2 Solution design, §8, CI

Current (solution design):

```text
- **CI** runs `claude -p --plugin-dir --max-turns`; mods and hooks run under `-p` [F11], where calls are not backgrounded by default [F18].
```

Replacement:

```text
- **CI** runs `claude -p --plugin-dir --max-turns`; mods and hooks run under `-p` [F11], where calls are not backgrounded by default [F18]. A `-p` run ends with its turn, so a CI case that needs an answer waits for it with `collect`.
```

## Row 11: AD-18, the minimum version

Applies only if the PO accepts row 11. AD-18's rule does not change.

### 11.1 Spine, Stack, Claude Code minimum

Current (spine):

```text
| Claude Code minimum (provisional, confirmed by the spike; above `stable` 2.1.308 at authoring, so release waits) | 2.1.311 |
```

Replacement:

```text
| Claude Code minimum (confirmed by the mod delivery spike: 2.1.308 fires `SubagentStop` while a subagent works; `stable` was still 2.1.308 on 2026-10-29, so release waits) | 2.1.311 |
```

### 11.2 Solution design, §8, Versions and the release gate

Current (solution design):

```text
- **Versions and the release gate.** One minimum for all units, provisionally 2.1.311 (AD-18): that release made `SubagentStop` fire only when a subagent finishes and let subagents use MCP servers that connect late [F2], which a cold start makes likely. On 2026-10-27 `stable` was 2.1.308 and `latest` 2.1.311 [F1], so release waits until `stable` reaches the minimum. The version comes from client information, else from the mod's report. An unknown version is allowed with a warning; a known one below the minimum is refused with the reason, and only then, because the specification discourages changing behaviour based on client information [F17]. CI covers the minimum, `stable` and `latest`, and on `latest` checks AskUserQuestion's input against FR-3.
```

Replacement:

```text
- **Versions and the release gate.** One minimum for all units, 2.1.311 (AD-18), confirmed by the mod delivery spike (§10.1): that release made `SubagentStop` fire only when a subagent finishes, which 2.1.308 failed in the spike, and let subagents use MCP servers that connect late [F2], which a cold start makes likely. On 2026-10-29 `stable` was still 2.1.308 and `latest` 2.1.312 [F1], so release waits until `stable` reaches the minimum. The version comes from client information, which every request carried on 2.1.311 and 2.1.312, else from the mod's report. An unknown version is allowed with a warning; a known one below the minimum is refused with the reason, and only then, because the specification discourages changing behaviour based on client information [F17]. CI covers the minimum, `stable` and `latest`, and on `latest` checks AskUserQuestion's input against FR-3.
```

### 11.3 Solution design, §4.9, the `SubagentStop` guard (phrase)

Current phrase (solution design):

```text
Before 2.1.311 the hook fired about twice a minute during work [F2] and would have used up the cap of 8 consecutive continuations [F3]: one reason for the 2.1.311 minimum.
```

Replacement:

```text
Before 2.1.311 the hook fired during work, about twice a minute by the changelog and about every 30 s for a background subagent on 2.1.308 in the mod delivery spike [F2], and would have used up the cap of 8 consecutive continuations [F3]: one reason for the 2.1.311 minimum.
```

## Row 12: a subagent's board link (FR-21 to FR-25, F6)

Applies only if the PO accepts row 12. The mod's toast and status entry wait for run `c8-toast-312`; if it shows they do not appear, these blocks change before they apply. `ux-askboard-2026-10-27/EXPERIENCE.md` ("Terminal link and pending-asks list") may need the same distinction; that is for the UX owner, and no text is drafted here.

### 12.1 Spine, Consistency Conventions, Board link and notice

Current (spine):

```text
| Board link and notice | `http://<loopback host>:<port>/b/<ask-id>?t=<token>`, computed once by a `BoardAddress` port that `board-host` implements and `ask-core` holds. The `ask` result returns it. A `PostToolUse` hook on `ask` shows it to the user as a system message, for the main conversation and subagents, with or without the mod. The mod adds the list of pending asks (FR-23). The shipped skills forbid agents from opening or answering boards. |
```

Replacement:

```text
| Board link and notice | `http://<loopback host>:<port>/b/<ask-id>?t=<token>`, computed once by a `BoardAddress` port that `board-host` implements and `ask-core` holds. The `ask` result returns it. A `PostToolUse` hook on `ask` shows it to the user as a system message for the main conversation's asks, with or without the mod; for a subagent's ask, Claude Code files that message in the subagent's transcript, out of the user's sight. The mod shows a subagent's link as a toast when the ask arrives, and keeps the list of pending asks in a status entry (FR-23). With mods off, a subagent's ask has the browser and the system notification only. The shipped skills forbid agents from opening or answering boards. |
```

### 12.2 Solution design, §5.1, step 5

Current (solution design):

```text
5. The notifier opens the tab, unless a board of the same session is working (§3.2), and shows a notification; the `PostToolUse` hook shows the link to the user, for subagents too; the mod lists pending asks (FR-23).
```

Replacement:

```text
5. The notifier opens the tab, unless a board of the same session is working (§3.2), and shows a notification; the `PostToolUse` hook shows the link to the user for the main conversation's asks; for a subagent's ask the mod shows it as a toast; the mod lists pending asks (FR-23).
```

### 12.3 Solution design, §8, Devcontainers (phrase)

Current phrase (solution design):

```text
Container binding is opt-in, and the terminal link is the notice that always works there (FR-23, §6).
```

Replacement:

```text
Container binding is opt-in, and the terminal link is the notice that always works there, for a subagent's ask only when the mod runs (FR-23, §6).
```

### 12.4 PRD, FR-23, Consequences

A PRD change: the PRD and the spine change in the same OpenSpec change (`CLAUDE.md`, "How they change").

Current (PRD):

```text
- On the user's machine, outside a container, a new ask produces all three notices, unless the user is working on another board of the same session.
```

Replacement:

```text
- On the user's machine, outside a container, a new ask produces all three notices, unless the user is working on another board of the same session. A subagent's ask shows its terminal link only where AskBoard's push path runs (R1); without it, the browser and system notices still appear.
```

Current (PRD):

```text
- When Claude Code runs in a devcontainer, the link in the terminal is the notice that always works; the browser and system notices appear where the host allows them.
```

Replacement:

```text
- When Claude Code runs in a devcontainer, the link in the terminal is the notice that always works, for a subagent's ask where AskBoard's push path runs; the browser and system notices appear where the host allows them.
```

## Row 13: PRD OQ2, the latency target

Applies only if the PO accepts row 13. The values are the proposal's; the PO's decision replaces them. Row 18 closes the Deferred latency row and the §12 entry when this row is accepted.

### 13.1 PRD, §10 Open Questions, item 2

Current (PRD):

```text
2. How quickly must an answer reach a working agent to feel interactive? A target is needed once the mechanism is known (FR-21, FR-22).
```

Replacement:

```text
2. How quickly must an answer reach a working agent to feel interactive? Settled by the product owner on <decision date>, from the mod delivery spike's measurements: an idle main conversation receives an answer within 2 s; a working agent, main conversation or subagent, at its next model request after the answer, plus at most the mod's poll interval. The early benchmark checks it (FR-21, FR-22).
```

## Row 14: the cost model's X for push

Applies only if the PO accepts row 14.

### 14.1 Solution design, §7, Cost model (phrase)

Current phrase (solution design):

```text
The mod delivery spike (§10.1) measures X for push.
```

Replacement:

```text
The mod delivery spike (§10.1) measured X for push: by append, about 38 input tokens per answer and no extra request; by `collect`, about 89 output tokens, 95 input tokens and one extra request. The figures above keep the `collect` assumption.
```

## Row 15: PRD R1 and the addendum

Applies only if the PO accepts row 15. Reporting D13 upstream is not a document change: the PO files it, or names who does, with the excerpts in `findings.md` (D13, criterion 1).

### 15.1 PRD, §9 Risks, R1

Current (PRD):

```text
- **R1. The push path may fail or be disabled.** The architecture pushes answers and follow-ups to a working agent through a Claude Code mod: mods have been on by default since Claude Code 2.1.287 and reach a running subagent (addendum). The mod may fail the delivery spike, and an organization can disable mods. Either takes push delivery away, and with it part of the interactivity of FR-10, FR-21 and FR-22. Mitigation: every capability also works by pull, so the agent waits for or collects the answers and follow-ups at the point it needs them, and the board shows the user which answers have reached the agent (FR-22).
```

Replacement:

```text
- **R1. The push path may be disabled or change.** The architecture pushes answers and follow-ups to a working agent through a Claude Code mod: mods have been on by default since Claude Code 2.1.287, and the delivery spike showed the mod reaching the main conversation and running subagents, foreground and background, in every permission mode tested (addendum). An organization can disable mods, and part of what the mod relies on is observed rather than documented: one of the push calls Claude Code offers mods is already refused under auto mode. Either takes push delivery away, and with it part of the interactivity of FR-10, FR-21 and FR-22. Mitigation: every capability also works by pull, so the agent waits for or collects the answers and follow-ups at the point it needs them, and the board shows the user which answers have reached the agent (FR-22); CI runs against the minimum, `stable` and `latest` Claude Code.
```

### 15.2 Addendum, How answers reach a working agent, introduction (phrase)

Current phrase (addendum):

```text
The candidate paths below were found at Claude Code 2.1.310 and corrected at 2.1.311.
```

Replacement:

```text
The candidate paths below were found at Claude Code 2.1.310 and corrected at 2.1.311; the mod delivery spike checked the mod's paths on 2.1.311 and 2.1.312.
```

### 15.3 Addendum, How answers reach a working agent, Plugin message (phrase)

Current phrase (addendum):

```text
A mod's `$.session.send` reaches a running subagent, and `$.prompt.submit` wakes an idle main conversation. The core still works through MCP alone. (../architecture-askboard-2026-10-27/SOLUTION-DESIGN.md §4.1, §13 F8, F9)
```

Replacement:

```text
A mod's `$.session.append` reaches a running subagent, and the main conversation while its turn runs, and `$.prompt.submit` wakes an idle main conversation; auto mode refuses a mod's `$.session.send`, so AskBoard does not use it. The core still works through MCP alone. (../architecture-askboard-2026-10-27/SOLUTION-DESIGN.md §4.1, §10.1, §13 F8, F9)
```

## Row 16: packaging spike, a failed start is cached

Applies only if the PO accepts row 16.

### 16.1 Solution design, §10.4, Exit criteria: a new item after 13

Insert after (solution design):

```text
13. A background board tab not discarded after an hour [F33].
```

Text:

```text
14. A failed start (missing executable, checksum failure) reaches the user without Claude Code caching it: a cached failed start leaves later sessions without AskBoard's tools for about 15 minutes (§10.1). Candidate: the launcher answers the handshake and reports the error, rather than exiting.
```

## Row 17: §13, the facts the spike checked

Applies only if the PO accepts row 17. A fact the PO rejects keeps its current row.

### 17.1 Solution design, §13, introduction

Current (solution design):

```text
All facts were checked on 2026-10-27. Status is empty when a primary source states the fact; otherwise it marks a secondary source, or an unverified fact with the spike that checks it. "research-cc" and "research-stack" are the research files that travel with the spine.
```

Replacement:

```text
All facts were checked on 2026-10-27. Status is empty when a primary source states the fact; otherwise it marks a secondary source, or an unverified fact with the spike that checks it. "research-cc" and "research-stack" are the research files that travel with the spine. The mod delivery spike checked F1, F2, F3, F5, F6, F9, F11, F12, F13, F15, F16, F17 and F25 again on 2026-10-29, on Claude Code 2.1.311 and 2.1.312, and its status says so; its findings are in the archived OpenSpec change `spike-mod-delivery`.
```

### 17.2 Solution design, §13, fact rows

Current (solution design):

```text
| F1 | Claude Code `latest` 2.1.311 (2026-10-26), `stable` 2.1.308 (2026-10-22) | AD-18 | https://www.npmjs.com/package/@anthropic-ai/claude-code | |
| F2 | 2.1.311: `SubagentStop` runs once, at finish (before, about twice a minute while working); subagents reach MCP servers that connect late | AD-10, AD-18 | https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md | |
| F3 | A `SubagentStop` block's reason becomes the subagent's next instruction; cap of 8 consecutive continuations, reset at each tool call | AD-10 | https://code.claude.com/docs/en/hooks | `stop_hook_active` unverified: mod spike |
```

Replacement:

```text
| F1 | Claude Code `latest` 2.1.311 (2026-10-26), `stable` 2.1.308 (2026-10-22) | AD-18 | https://www.npmjs.com/package/@anthropic-ai/claude-code | On 2026-10-29 `latest` was 2.1.312 and `stable` still 2.1.308: mod delivery spike |
| F2 | 2.1.311: `SubagentStop` runs once, at finish (before, about twice a minute while working); subagents reach MCP servers that connect late | AD-10, AD-18 | https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md | Confirmed by the mod delivery spike: 2.1.308 fired it about every 30 s during a background subagent's work |
| F3 | A `SubagentStop` block's reason becomes the subagent's next instruction; cap of 8 consecutive continuations, reset at each tool call | AD-10 | https://code.claude.com/docs/en/hooks | `stop_hook_active` verified: mod delivery spike |
```

Current (solution design):

```text
| F5 | Hook `cwd` follows session worktrees; `isolation: worktree` subagents not stated | AD-5, AD-12 | https://code.claude.com/docs/en/worktrees | partly unverified: mod spike |
| F6 | A `PostToolUse` `systemMessage` is shown to the user; for a subagent's call, not stated | Board notice | https://code.claude.com/docs/en/hooks | partly unverified: mod spike |
```

Replacement:

```text
| F5 | Hook `cwd` follows session worktrees; an `isolation: worktree` subagent's is its own worktree, which Claude Code removes when the subagent finishes unchanged | AD-5, AD-12 | https://code.claude.com/docs/en/worktrees | subagents: mod delivery spike |
| F6 | A `PostToolUse` `systemMessage` is shown to the user for a main-conversation call; for a subagent's call it goes to the subagent's transcript, unseen by the user | Board notice | https://code.claude.com/docs/en/hooks | subagents: mod delivery spike |
```

Current (solution design):

```text
| F9 | `$.session.send({ to: { agentId } })` reaches a running subagent; `$.prompt.submit` starts a turn once idle, attributed to the mod unless `asUser` | AD-4 | https://code.claude.com/docs/en/plugins/mods/api | |
```

Replacement:

```text
| F9 | `$.session.send({ to: { agentId } })` reaches a running subagent, but auto mode refuses it for a mod; `$.session.append` adds a row, attributed to the plugin, that a running subagent or main conversation reads at its next request; `$.prompt.submit` starts a turn once idle, attributed to the mod unless `asUser` | AD-4 | https://code.claude.com/docs/en/plugins/mods/api | auto-mode refusal and append: mod delivery spike |
```

Current (solution design):

```text
| F11 | Mods run under `-p`, where `$.prompt.submit` can keep a run alive; `--plugin-dir` loads a plugin for one session, and managed `disableSideloadFlags` rejects it | AD-17 | https://code.claude.com/docs/en/cli-reference | |
| F12 | Whether the hook's `agent_id` is the ID `$.session.send` takes, and whether `$.http.fetch` reaches `127.0.0.1` without `Origin`; policy that disallows WebFetch refuses `$.http.fetch` (confirmed) | AD-4, AD-5, AD-11 | https://code.claude.com/docs/en/plugins/mods/admin | unverified: mod spike |
| F13 | `CLAUDE_CODE_SESSION_ID` reaches stdio servers and hooks, `$.session.id` mods; the IDs diverge after `/clear` and may on `--continue` | AD-5 | https://code.claude.com/docs/en/env-vars | `/resume`: mod spike |
```

Replacement:

```text
| F11 | Mods run under `-p`, where a `$.prompt.submit` queued before the turn ends keeps the run alive for one woken turn, within `--max-turns`; `--plugin-dir` loads a plugin for one session, and managed `disableSideloadFlags` rejects it | AD-17 | https://code.claude.com/docs/en/cli-reference | narrowed: mod delivery spike |
| F12 | The hook's `agent_id` is the ID `$.session.send` takes; `$.http.fetch` reaches `127.0.0.1`, and a Unix socket through `socketPath`, without `Origin`; an organization policy that disallows WebFetch, or a policy mod that hooks `http.fetch`, refuses it, and a `WebFetch` deny rule does not | AD-4, AD-5, AD-11 | https://code.claude.com/docs/en/plugins/mods/admin | verified: mod delivery spike |
| F13 | `CLAUDE_CODE_SESSION_ID` reaches stdio servers and hooks, `$.session.id` mods; the server's ID diverges from the hooks' and the mod's on `--continue` and after `/clear`, and agrees after `/resume`; the Claude Code process is the parent of the server and the hooks in every case | AD-5 | https://code.claude.com/docs/en/env-vars | mod delivery spike |
```

Current (solution design):

```text
| F15 | The SDK's stdio client probes the protocol revision on a short-lived sibling process; Claude Code's v2 runtime uses that SDK | AD-2 | https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md | unverified for Claude Code: mod spike |
| F16 | Whether MCP calls over stdio carry `tool_use_id` or `traceparent` in `_meta` | AD-5, AD-17 | none found | unverified: mod spike |
| F17 | `clientInfo` is optional, and servers SHOULD NOT change behaviour on it | AD-18 | https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts | presence: mod spike |
```

Replacement:

```text
| F15 | The SDK's stdio client probes the protocol revision on a short-lived sibling process; Claude Code's v2 runtime uses that SDK | AD-2 | https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md | refuted for Claude Code: the probe arrives on the session's own process (mod delivery spike) |
| F16 | MCP calls over stdio carry `tool_use_id` in `_meta` as `claudecode/toolUseId`, and no `traceparent` | AD-5, AD-17 | mod delivery spike (observed) | observed on 2.1.311 and 2.1.312 |
| F17 | `clientInfo` is optional, and servers SHOULD NOT change behaviour on it | AD-18 | https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts | presence verified: mod delivery spike |
```

Current (solution design):

```text
| F25 | Monitor: a notification per line, 5-minute default deadline (30 max), Bash permissions, available to background subagents; background Bash notifies on exit and dies with a foreground subagent | AD-4 | https://code.claude.com/docs/en/sub-agents; research-cc §7 | Monitor routing unverified |
```

Replacement:

```text
| F25 | Monitor: a notification per line, 5-minute default deadline (30 max), Bash permissions, available to background subagents; background Bash notifies on exit and dies with a foreground subagent | AD-4 | https://code.claude.com/docs/en/sub-agents; research-cc §7 | Monitor routing unverified; not needed (mod delivery spike) |
```

### 17.3 Solution design, §10.4, Exit criteria, item 4 (F15)

Current (solution design):

```text
4. Temporary-name download and rename under a lock, safe with concurrent sessions and the probe sibling.
```

Replacement:

```text
4. Temporary-name download and rename under a lock, safe with concurrent sessions (Claude Code starts no probe sibling, §10.1).
```

## Row 18: the Deferred rows, §12 and §10.1's outcome

Applies only if the PO accepts row 18, row by row as in `findings.md` ("Deferred rows").

### 18.1 Spine, Deferred, the push-transport row: remove

Current (spine), removed:

```text
| Push transport confirmed (the mod reaches every kind of agent, wakes an idle conversation, and its identifiers and loopback fetch work); else Monitor watch or a `PostToolUse` hook as further adapters | AD-3, AD-4 and AD-5 hold for any transport | Mod delivery spike |
```

### 18.2 Spine, Deferred, the minimum-version row: remove

Current (spine), removed:

```text
| Minimum Claude Code version; behaviour of the session-file key after `/clear`, `--continue` and `/resume` | Provisionally 2.1.311; AD-5 and AD-18 fix the rules | Mod delivery spike |
```

If the Linux run of criterion 13 (task 4.1) has not passed when 5.2 applies, reword it instead:

```text
| The session-file key (the Claude Code PID) on Linux | Passed on macOS; AD-5 fixes the rule | Task 4.1 of the mod delivery spike, in a devcontainer |
```

### 18.3 Spine, Deferred, the latency row

Current (spine):

```text
| Latency target for answers reaching a working agent (PRD OQ2, product owner) | Needs the spike's measurements | After the mod delivery spike |
```

If row 13 is accepted: remove the row. Otherwise, replacement:

```text
| Latency target for answers reaching a working agent (PRD OQ2, product owner) | The mod delivery spike measured it per kind of agent | First benchmark run |
```

### 18.4 Solution design, §12, owners

Current (solution design):

```text
| Architecture spikes (§10) | Push transport, with the minimum Claude Code version and the session-file key (mod delivery); formula engine and whitelist (formula); catalog renderer with Mermaid and PlantUML (renderer, with UX); Bun packaging and "no reachable browser" detection (packaging) |
| Product owner | Latency target (OQ2), after the mod delivery spike; A2UI inbound translator (OQ5); molecule registry, export and repository (FR-16, FR-17) and full benchmark settings; MCP Apps in Claude hosts, other surfaces, native Windows, remote hosts |
```

Replacement (with row 13 accepted):

```text
| Architecture spikes (§10) | Formula engine and whitelist (formula); catalog renderer with Mermaid and PlantUML (renderer, with UX); Bun packaging and "no reachable browser" detection (packaging) |
| Product owner | A2UI inbound translator (OQ5); molecule registry, export and repository (FR-16, FR-17) and full benchmark settings; MCP Apps in Claude hosts, other surfaces, native Windows, remote hosts |
```

With row 13 not accepted, the "Product owner" row reads "Latency target (OQ2), after the first benchmark run; A2UI inbound translator (OQ5); …".

### 18.5 Solution design, §10.1, a closing paragraph

Insert after (solution design):

```text
**What changes otherwise.** If all pass, the push and minimum-version Deferred rows close. If criterion 1 fails for a kind of agent, a Monitor or `PostToolUse` adapter serves that kind (AD-4). Then the product owner sets OQ2's target from criterion 3.
```

Text (drop each `[row N]` tag; replace or drop a sentence whose row was not accepted):

```text
**Outcome (OpenSpec change `spike-mod-delivery`, 2026-10-29).** On Claude Code 2.1.311 and 2.1.312 the mod reaches every kind of agent, in every permission mode tested, through `$.session.append` and `$.prompt.submit`; auto mode refuses its `$.session.send`, so AD-4 no longer uses it, and no fallback adapter is needed [row 1]. The session file is keyed by the Claude Code PID, because `CLAUDE_CODE_SESSION_ID` diverges on `--continue` and after `/clear` (AD-5) [row 2]. The session process also exits on SIGINT (AD-2) [row 5]. AD-10's condition holds from 2.1.311, while 2.1.308 fires `SubagentStop` during work, so the minimum stays 2.1.311 (AD-18) [row 11]. Criterion 8 fails: a subagent's board link reaches the user only through the mod (FR-23) [row 12]. The benchmark leaves out `--strict-mcp-config` (AD-17) [row 9]. The change's findings hold the latency and token measurements; OQ2's target was set on <decision date> [row 13]. Criteria 10, 12 and 13 on Linux: <task 4.1's result>.
```

### 18.6 Front matter

- Solution design, `sources:`, add: `  - 'OpenSpec change spike-mod-delivery, findings.md: Claude Code 2.1.308, 2.1.311 and 2.1.312 (2026-10-29)'`.
- Spine, `sources:`, add the same line.
- Every file changed: `updated:` set to the apply date.
