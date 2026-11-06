# Proposal

## Why

E1 delivers answers by pull alone: every ask is unchecked, the agent learns of an answer only when it calls `collect`, a subagent can finish with answers it never read, and every new board takes the browser's front. AD-4, AD-5 and AD-10 rest on a push transport, agent records and a stop guard that the mod delivery spike has now settled (decided 2026-10-30, applied to the spine), so E4 builds them: answers and follow-ups reach a working agent without it asking (FR-21, OQ2's target), each ask has an owner (NFR-2), a finishing subagent first receives what it has not read (FR-25), and a new ask announces itself without stealing the front from the board the user is working on (FR-23).

## What Changes

- **Local API and session file** (`board-host`): an HTTP API on a Unix socket, 0600, in a user-only folder, behind a session token, with no long-poll and responses under 1 MiB, started at the first request other than `server/discover` (AD-2, AD-5, AD-11). The session file `{format, key, pid, epoch, apiAddress, sessionToken, projectDir, startedAt}`, with `projectDir` only when the session has a project root, is named by the Claude Code PID, replaced only when its process is gone, and removed at exit with the socket. The local API carries agent records, the mod's polls, delivery reports and version report, the stop guard's decisions, the effective asking rule and an ask's title for the terminal link.
- **Hooks** (`hooks`, run as `askboard hook <event>` from the session process bundle): a `PreToolUse` agent record on every AskBoard call; the `PreToolUse` asking-rule hook on AskUserQuestion; the `PostToolUse` terminal link for the main conversation's asks; the `SubagentStop` guard. Each hook exits 0 with no decision when the session process cannot be reached (AD-19), and never blocks a call (AD-5).
- **Ownership and origin** (`ask-core`, `mcp-tools`): the first bound `ask` record owns its ask; `collect`, resends, and E3's `update` and `fetch`, from another agent are refused; an ask without a record stays unchecked and only its results say so (AD-5). Each ask keeps its origin: owner key, label, `cwd`, root, branch and worktree (AD-5, AD-12).
- **The mod** (`mod`, a hooks module built into one file): polls the local API, pushes events above `received` to the ask's owner only, by `$.session.append` to a running subagent or a main conversation mid-turn and by `$.prompt.submit` to an idle main conversation, with the catch-up submit, the interrupt retry and no `$.session.send` (AD-4). It reports deliveries, which raise `received` and the board's receipt, and the Claude Code version (AD-18). It shows a subagent's board link as a toast and the pending asks in a status entry (FR-23). When `$.http.fetch` is refused, it reaches the local API through the bundle run as a client (AD-5).
- **Notices** (`notifier`, `board-host`, `view`): a system notification for every new ask; the board page reports its working signal, and the browser opener runs only when no board of the session is working (AD-2, FR-23).
- **Who and where, and the agent pill** (`view`, `board-host`, `ask-core`, `mod`; open question 7): the context header's first row names who asked, as "Main agent" or "Subagent <type>" with the agent's name and an ordinal for a second subagent of a type, then the project, directory, branch and worktree from the ask's origin, and "For: <name>" only when the expected answerer differs from the machine's git user. The agent pill shows working or waiting: waiting while a waiting `collect` on the ask is pending, or, where the mod reports turns, while the owner has no turn running (AD-4, FR-24).
- **Version gate** (`ask-core`, `mcp-tools`): an ask from a Claude Code below 2.1.311 is refused, saying why (AD-18).
- **Contract**, append-only: standalone schemas with their own `$id`s for the local API, the session file, the push message, the `closed` event and the board protocol's presence, origin and agent messages; the asking rules' closed set; constants for the poll interval, record timeout, minimum Claude Code version and session folder.
- **Packaging**: `hooks/hooks.json` with the four hooks and the mod as the hooks module; `build:mod`; hook mode in the bundle.
- **Checks**: the conformance suite in AD-1's three configurations (mod and hooks, mod disabled, hooks disabled), with real hook processes and a stand-in mod host, on Bun and Node 24, macOS locally and Linux in CI; live Claude Code runs left to the PO.
- **Not in this change:** the `closed` state, `ask-core`'s close and the Closed banner, several questions, follow-ups, revisions, postpone and decline (E3, `ask-lifecycle`; E4 adds the `closed` event with reason `agent-finished`, and its close waits for E3's); reading configuration, so the asking rule stays `none` (E8); the launcher (E11), which then replaces `bun dist/askboard.mjs` in `hooks.json` and in the mod's client command; `askboard doctor`; Monitor and `PostToolUse` fallback adapters, which the spike found unneeded.

## Capabilities

### New Capabilities

- `mod`: push inside Claude Code, out of process, the pending-asks list and the agents' turn reports (AD-4, AD-5).
- `hooks`: agent records, the asking-rule hook, the board notice and the stop guard (AD-5, AD-10, AD-16, AD-19).

### Modified Capabilities

E1 creates these; E4 archives after E1, so they exist by then. Until E1's archive, `openspec/specs/` is empty.

- `contract`: the local API, session file, push message, `closed` event, presence, origin and agent schemas, the asking rules and E4's constants.
- `core`: owners and origins, `received` raised by pushes and stop blocks, closing a finished subagent's asks, the working signal, the agent status of each ask.
- `mcp-adapter`: the no-hooks result only for asks without a record, ownership refusals, the version gate.
- `board-host`: the local API and session file, the system notification, opening a board only when none is working, the origin and agent status sent to the board.
- `view-and-widgets`: the board page's working signal, the context header's who-and-where row and the agent pill.
- `packaging`: the hooks file, the mod module, hook mode.

## Impact

- **Code:** `packages/contract`, `core`, `server` (`board-host`, `mcp-tools`, `notifier`, the entry point), `hooks`, `mod`, `view` (the board page's working signal, the header's first row and the agent pill), `tools/build/` (the mod build and the board page's validators), `tools/check-imports.ts` and the workspace test, `hooks/hooks.json`.
- **Dependencies:** none new. The mod uses only the mod API; the notification uses `osascript` on macOS and `notify-send` on Linux when present.
- **CI:** the existing jobs gain the hooks and mod conformance runs, about one more minute on Linux; no macOS job.
- **Documents:** drafted in `spine-update-draft.md`, applied after the PO decides: AD-1 (the entry point imports `hooks`), AD-5 (the session folder), AD-18 (the gate's refusal and an unknown version), the Consistency Conventions' board notice, the Deferred row on the record timeout, PRD FR-23 and EXPERIENCE Notices (the macOS notification), AD-4's agent status and EXPERIENCE's open item 13 (the row's details).
- **Requirements served:** FR-10 and FR-21 (push), FR-22 (receipt by push), FR-23, FR-24 (who asked, where, the expected answerer and the agent state), FR-25 (subagent finish), FR-30 (in part), NFR-2, NFR-3, NFR-4, NFR-7, NFR-8 (version), NFR-9, NFR-10; R1 and OQ2 through the spike's paths and the early benchmark.

## Open questions for the PO

Each question is one the documents leave open. The change proceeds with the default, the narrowest option; an answer that reverses one stops the work for `/opsx:update` (task 1.1). Question 7 was resolved by the coordinator, not by the PO; on 2026-10-31 the PO accepted every other default as proposed, and each answer is recorded under its question.

1. **Asking rules before configuration.** The effective rule comes from configuration (AD-14), which E8 reads, and nothing defines `with-references`' predicate. *Default:* E4 builds the AskUserQuestion hook, the closed set and the predicates of `none` and `always`; the session process reports `none` until E8, which adds `with-references`' predicate with the rule's source. *Alternative:* the whole asking-rule hook in E8.
   - **Answer (PO, 2026-10-31):** accepted as proposed.
2. **The system notification and its click.** FR-23 says the notification opens the board; macOS has no built-in notifier with a click action. *Default:* macOS `osascript`, with AskBoard's constant script and agent text as plain arguments, announcing only; Linux `notify-send`, opening the board through a default action where it supports one; none under WSL until the PO's WSL check; FR-23 and EXPERIENCE amended for macOS. *Alternative:* `terminal-notifier` with `-open` when it is on `PATH`.
   - **Answer (PO, 2026-10-31):** accepted as proposed.
3. **Wording of the terminal link, the toast and the pending-asks list.** EXPERIENCE records none. *Default:* link "AskBoard · <title> · <link>"; toast the same, for a subagent's ask; status one line per pending ask, "<title> · <who> · <n> open · <link>", cleared when none is pending.
   - **Answer (PO, 2026-10-31):** accepted as proposed.
4. **The session folder.** AD-5 says only "user-only runtime folder". *Default:* `$XDG_RUNTIME_DIR/askboard` when it is set, else `${TMPDIR:-/tmp}/askboard-<uid>`; a socket path over the platform limit leaves the session on pull, with a diagnostic.
   - **Answer (PO, 2026-10-31):** accepted as proposed.
5. **Poll interval and the process client.** *Default:* 1 s over the socket; where `$.http.fetch` is refused, one `$.process.run` per poll at the same interval, which keeps OQ2's target.
   - **Answer (PO, 2026-10-31):** accepted as proposed.
6. **The version gate's form.** AD-18 says "refuses ... saying why" and "allows the ask and warns". *Default:* below 2.1.311 an `isError` text naming both versions; an unknown version allowed with a stderr diagnostic, so no result schema changes. *Alternative:* `unavailable` with a new reason and a result warning, an output-format minor.
   - **Answer (PO, 2026-10-31):** accepted as proposed.
7. **FR-24's context header row of who and where, and the agent-state pill.** E4's roadmap line does not name them, and E3's draft proposal (its open question 6) leaves them to E4. The proposed default was to leave them out of E4.
   - **Resolved (coordinator, 2026-10-31):** E4 owns both. The agent pill shows working or waiting, which is presence, and E4 already adds the board protocol's `presence` message (AD-2); the who-and-where row needs the agent identity and subagent attribution that E4's hooks and agent records provide. The row also applies FR-24's rule on the expected answerer: the board names that user only when they differ from the machine's git user. E3 keeps leaving both out. Built in task group 8.
8. **Hook mode in the one bundle.** AD-19 runs hooks as `askboard hook <event>` from the same executable, so the entry point imports `hooks`, which AD-1 does not allow. *Default:* amend AD-1 in place, as E1 did for the entry point. *Alternative:* a second bundle for hooks until E11.
   - **Answer (PO, 2026-10-31):** accepted as proposed.
9. **The row's and the pill's unrecorded details.** EXPERIENCE leaves open where "For: <name>" sits (its open item 13), how Directory reads, and what a field AskBoard does not know shows; AD-4 says the mod's turn state decides the agent status but not how it combines with a waiting `collect`. *Default:* "For: <name>" in row 1, after who asked; Directory as the agent's `cwd` relative to the ask's root ("." at the root, absolute outside it); a field AskBoard does not know, as for an unchecked ask, shows "—"; the agent pill reads waiting while a waiting `collect` on the ask is pending, except a main-conversation call past Claude Code's background threshold (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`, 120 s by default), or, where the mod reports turns, while the owner has no turn running, and working otherwise; AD-4 and EXPERIENCE amended to say so.
   - **Answer (PO, 2026-10-31):** accepted as proposed.
