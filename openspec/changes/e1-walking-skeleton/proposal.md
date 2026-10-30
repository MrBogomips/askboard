# Proposal

## Why

AskBoard has a final design, four decided spikes and no product code. E1, the walking skeleton on the implementation roadmap, puts one ask through every layer by pull: an agent calls `ask`, its board opens on loopback behind its token, the user answers a Choice question, and the agent reads the answer with `collect`. Pull always works (AD-4), so E1 waits for no mod, and the early benchmark that follows it (PRD R5) gets a real plain question to measure against AskUserQuestion (SM-1, SM-3).

## What Changes

- **`contract`**, seeded from the archived `review-model-contract` change's `examples/`, moved in as fixtures: the schema sets on E1's path (AD-7), namely the input format for an ask of one plain question, the output format's answer event (findings F4, F12), the `ask` and `collect` request and result envelopes, the board document and the board protocol. Also ID rules with the view-made prefix reserved (F10), unique option labels (F5) and the constants E1 needs.
- **`ask-core`**: asks scoped to an epoch, one append-only event log per ask with `<epoch>.<seq>` cursors and the `received` watermark (AD-3), answers only from an explicit user action (AD-10), the rev-1 board document (AD-12), the ask-ID resend rules (AD-6, FR-5), the derived title (FR-1), `who` and `when` (FR-19), and discard at session exit (AD-2, AD-21).
- **`mcp-tools`**: the stdio MCP server with `ask` and `collect` as reviewed, `collect` waiting on an item with progress (AD-4, FR-21), validation errors and typed results (AD-6), `unavailable` when no board can be shown (AD-18, packaging spike row 9), and AD-5's notice for a session without hooks. No side effect before the first request other than `server/discover` (AD-2).
- **`board-host` and `notifier`**: the board listener on `127.0.0.1` with a token per board, the `Host` and `Origin` checks, the board page under its CSP and the invalid-link page (AD-8, AD-11, NFR-4). The board protocol over a WebSocket, with takeover by a new tab and the delivery receipt (AD-3, AD-21). The browser opener, started with an argument vector.
- **`view`**: the board page, `assemble` and the manifest of classic-script chunks (AD-9), the sandboxed view with AskBoard's own `CatalogRenderer` and an error boundary per item (renderer spike rows 1 and 2), and the single-question board of EXPERIENCE: title, ask state, question card with header chip, Choice options, "Answer" and the delivery receipt, the connection-lost, discarded and moved banners, and the keyboard core (NFR-12).
- **Session process entry point and development plugin**: the code that wires the units, a plain JavaScript bundle, and a plugin manifest that Claude Code loads with `--plugin-dir` (server `askboard`, `CLAUDE_PROJECT_DIR` in `env`).
- **Checks**: the conformance suite on the pull path, run on Bun and Node 24; browser tests in Chromium, Firefox and WebKit, with every CSP violation failing; the CI checks of the Consistency Conventions that E1's code reaches (schema validity, tool list order and sizes, `import.meta` and chunk growth); one more Linux CI job.
- **Spine and records**: AD-1 amended in place for the entry point, AD-7's table gaining the view manifest, the Stack's new pins, the import rules table, the renderer spike's Tailwind licence-check correction (row 20), `CLAUDE.md` and `README.md`.
- **Not in this change:** `update`, `fetch` and `snapshot`; several questions, areas, presentations and the delivery mode; postpone, decline, the open prompt, follow-ups and revisions; draft mirroring and discard on tab close (E3). The mod, hooks, local API, session file, system notification and terminal link (E4). Widgets, formulas, `compute` and molecules (E2). Configuration and languages (E8). Snapshots (E7). The launcher and executable (E11).

## Capabilities

### New Capabilities

- `contract`: the versioned schema sets, ID rules, constants and fixtures every unit speaks (AD-7).
- `core`: asks, epochs, event logs, cursors, answers and ask states, owned by `ask-core` alone (AD-3, AD-10).
- `mcp-adapter`: the MCP tools over stdio, their validation and their results (AD-4, AD-6).
- `board-host`: the board listener, its tokens and checks, the board protocol, and opening a board in the browser (AD-8, AD-11, AD-21).
- `view-and-widgets`: the board page, the sandboxed view, its build and assembly, and the components E1 renders (AD-8, AD-9).
- `packaging`: how Claude Code loads AskBoard as a plugin and starts its session process (AD-19).

### Modified Capabilities

None: `openspec/specs/` is empty.

## Impact

- **Code:** `packages/contract`, `core`, `server` (`mcp-tools`, `board-host`, `notifier` and the entry point) and `view`, `tools/build/`, `.claude-plugin/`.
- **Dependencies:** the Stack's `@modelcontextprotocol/server`, Ajv, React, `radix-ui`, ext-apps with its peers and zod, Tailwind. New, each after its adoption check and pinned in the Stack: `ws`, `playwright` (tests only), and `@types/node`, `@types/react`, `@types/react-dom`, `@types/ws`.
- **CI:** a Linux job of about five minutes per run (build, conformance, three browser engines); no macOS job.
- **Documents:** spine (AD-1, AD-7, Stack); no PRD change.
- **Work:** two sessions in parallel after a shared Track 0 (design decision 13, tasks.md).
- **Requirements served:** FR-1 (title), FR-3 (in part), FR-5, FR-18, FR-19 (who and when), FR-21 (pull), FR-22 (receipt), FR-24 (tab label), FR-25 (session end, lost connection), NFR-3, NFR-4, NFR-5, NFR-7, NFR-8 (`unavailable`), NFR-9, NFR-10, NFR-12; R5 through the early benchmark it unblocks.

## Open questions for the PO

Where the documents leave E1's scope open, this proposal takes the narrowest reading that reaches working product soonest. Each choice below can be reversed before apply.

1. **Pull only.** The roadmap puts push and hooks in E4; the mod delivery spike's documents say "E1 builds `mod`, `hooks` and the local API". E1 follows the roadmap and runs without hooks, under AD-5's rule for that case. The spike's notes for the mod go to E4 (design.md, Handed on).
2. **One question per ask.** E1 builds EXPERIENCE's single-question board, which has no outline navigator, counts, delivery switch or Submit, and refuses an ask of two or more questions. FR-1's many questions come with E3, together with areas, presentations and the delivery mode.
3. **FR-3 in part.** Single and multiple choice, option descriptions and the header chip. "Other…", the recommended option, previews, annotations and the open prompt (FR-7) fail validation until E3.
4. **Two tools.** `ask` and `collect` are listed, as reviewed; the server instructions keep only the lines about them. The early benchmark's count of what loads before the first ask then covers two tools. The alternative is to list all five, with three refusing until their epics.
5. **Lifecycle left to E3 and E4.** Every new board opens in the browser: holding one back while the user works on another board (AD-2) would leave it unseen until E4 brings the notification and the terminal link. Closing a tab discards nothing until E3's grace timer, and a reload loses an unsent choice until E3 mirrors the draft record.
6. **Devcontainers get `unavailable`.** Container binding needs an opt-in setting, and E1 reads no configuration.
7. **Contract scope.** F7 (derived values per widget), the formula grammar, whitelist and limits (formula spike) and the configuration schema come with E2 and E8, which use them.
8. **Fonts and licence fixes.** E1 uses DESIGN.md's tokens with the system font stacks. The bundled faces (renderer row 19) change the time to visible the early benchmark measures, so they could come in E1 instead. Of row 20, E1 applies only the Tailwind correction its lockfile needs.
9. **Two spine gaps, amended in place.** The diagram gives no rule to the code that wires the units, so AD-1 lets the entry point import `ask-core`, `contract` and the server units, and nothing imports it. `board-host` reads the view's manifest at run time, which AD-7's table does not list, so the table gains a view manifest set owned by `view`.
