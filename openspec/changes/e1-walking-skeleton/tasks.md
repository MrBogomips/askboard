# Tasks

Each group writes its tests first and verifies that they fail before it implements (the repository's TDD rule). "Check passes" means `bun run check`, with `GITHUB_TOKEN=$(gh auth token)` for the licence step.

## 1. Decisions, dependencies and licences

- [ ] 1.1 Record the PO's answer to each open question in proposal.md. If an answer reverses a choice, stop and revise the change with `/opsx:update` before any other task. Verify that every question has its answer and date in this task's note.
- [ ] 1.2 Run the adoption check for `ws`, `playwright`, `@types/node`, `@types/react`, `@types/react-dom` and `@types/ws` (licence, stars, last push, last release, not archived), with data looked up now and cited with its date; pick each version, and for the `@types` packages the one matching its runtime pin. If any fails, stop for the PO. Verify that the results are in this task's note.
- [ ] 1.3 Add the dependencies of design decisions 2, 4, 5, 7 and 11 to the packages that use them, pinned exactly, at the Stack's versions where it has them: `contract` (Ajv); `server` (`@modelcontextprotocol/server`, `ws`, `@types/node`, `@types/ws`); `view` (React, React DOM, `radix-ui`, ext-apps, `@modelcontextprotocol/core`, `@modelcontextprotocol/client`, zod, Ajv, Tailwind, `@types/react`, `@types/react-dom`); the root's development dependencies (`playwright`, `@modelcontextprotocol/client` for the conformance suite). `server` compiles with Node types and never Bun's. Verify that `bun install` succeeds, `bun run typecheck` passes, and `tools/workspace.test.ts` still finds every pin exact.
- [ ] 1.4 Correct the licence check for renderer row 20's Tailwind part (design decision 12): first add tests in which a bundled dependency of a package meant for another platform counts as that package's, not as a missing install, and verify that they fail; then change `tools/check-licences.ts`. Verify that the tests pass with at least 80% coverage of the check, and that `check:licences` passes on the new lockfile. Any other finding stops the work for the PO.
- [ ] 1.5 Add the new pins to the spine's Stack (`ws`, `playwright` as a test tool, and the four `@types` packages), each after 1.2's check, and set the spine's `updated:`. Verify with a grep that each pin in `bun.lock` that the Stack names has the Stack's version.

## 2. Contract

- [ ] 2.1 Copy the approved examples of `openspec/changes/archive/2026-10-29-review-model-contract/examples/` unchanged into `packages/contract/test/fixtures/`. Write the fixture tests of the contract spec (every ask against the generic `ask` input schema; the plain-choice ask, result and answer against the full contract; every `answer` event of `answers/*.json` against the answer event), and verify that they fail. Verify with `diff -r` that the copy matches the archive.
- [ ] 2.2 Write the input format for a plain question (design decision 2), with tests first for each scenario of the contract spec's "Input format", "Agent-chosen IDs" and "Unique option labels" requirements: a second question, an unknown field, `it-IT`, a malformed ID, the `u-` prefix, a repeated label. Verify that the tests pass and that each failure names the item ID and the field.
- [ ] 2.3 Write the output format's answer event (F4, with AD-20's generic diff) and the `ask` and `collect` result envelopes (F12's two versions, warnings, `unchecked`, the outcomes `unavailable` and `open`, `more`). Verify that 2.1's fixture tests now pass.
- [ ] 2.4 Write the board document set (owner `ask-core`) and the board protocol set (owner `board-host`) for E1's messages: connect with the token, the board document and state, answer command, receipt, discarded, moved, refusal. Add the shared helper that refuses an unsupported major, saying which version is supported. Verify with tests for each message and for a major-2 message.
- [ ] 2.5 Add the constants module (contract spec, "Shared constants"; values in design decision 2) and the schema checks: every schema compiles as 2020-12 in strict mode, none has a root combinator, every tool input's top-level property names match AD-6's rule, and every set names its version and owner. Verify that a schema given a root `oneOf` fails the test.
- [ ] 2.6 Expose the contract's validation function: it returns the problems in document order, each with its item ID, field and expected shape. Verify with tests on a request with many problems, and that the check passes with `contract` at 80% coverage or more.

## 3. Ask core

- [ ] 3.1 Write tests first for the epoch, creating an ask (rev 1, `waiting`, cursor `<epoch>.0`) and the derived title, including a text longer than the title length; then implement the `Ask` aggregate, the store and the ports of design decision 3. Verify that the tests pass and that `core` still compiles without DOM, Node or Bun types.
- [ ] 3.2 Write tests first for answers (core spec, "Answers only from an explicit user action" and "Who and when"): a valid answer, each refused form, a second answer returning the logged one, `who` from `expectedUser`, the git user name and the login name through a fake `Identity`. Implement. Verify that the tests pass.
- [ ] 3.3 Write tests first for reading events after a cursor, a cursor of another epoch, an unknown ask, the `received` watermark (raised, never lowered) and the subscription (event appended, `received` raised, ask discarded). Implement. Verify that the tests pass.
- [ ] 3.4 Write tests first for the resend rule: an identical request (keys in another order), a different request under an open ID, and under a discarded ID. Implement RFC 8785 canonicalization for the JSON E1 accepts. Verify that the tests pass.
- [ ] 3.5 Write tests first for discard at session exit: every open ask gains a final `discarded` event with reason `session-exit`, and subscribers hear it. Implement. Verify that the check passes, with `core` at 80% coverage or more and no import-check finding.

## 4. MCP adapter

- [ ] 4.1 Write tests first: `tools/list` returns exactly `ask` then `collect`, equal to the contract's copy of the approved definitions; each description and the server instructions are within 4,096 characters, each full tool name within 128; the instructions name no other tool. Implement the server on `@modelcontextprotocol/server` 2.4.0 over stdio with the cut instructions of design decision 4. Verify that the tests pass.
- [ ] 4.2 Write tests first for `ask` against a fake core and fake ports: the `isError` text (item ID, expected shape, first problems first, under 4,000 characters), `unavailable` creating nothing, and the result envelope with its no-hooks warning. Implement. Verify that the tests pass.
- [ ] 4.3 Write tests first for `collect`: grouping by ask, `unchecked: true` on every entry, `discarded` for another epoch's cursor, the error for an unknown ask, and paging with `more: true` under 30,000 characters. Implement. Verify that the tests pass.
- [ ] 4.4 Write tests first for `collect` with `wait`, on a fake clock: it returns on an event for the item or a state change, sends progress at least every 60 s when given a progress token, returns `open` after 20 minutes, and stops on abort. Implement. Verify that the tests pass.
- [ ] 4.5 Write tests first for the lazy start and the exit (design decision 4): `server/discover` alone opens no port and writes no file; stdin end, SIGINT, SIGTERM and SIGHUP each discard the open asks and exit; stdout carries only protocol; stderr never holds a token or question text. Implement. Verify that the tests pass and that the check passes with the adapter at 80% coverage or more.

## 5. Board host and notifier

- [ ] 5.1 Write tests first for the listener: it binds `127.0.0.1` only, takes the next port of the range when one is taken, and opens at the first request for a board link. Implement on `node:http` (design decision 5). Verify that the tests pass.
- [ ] 5.2 Write tests first for each scenario of the board-host spec's token, `Host` and `Origin`, and invalid-link requirements, plus `Referrer-Policy`, `nosniff` and no cookies on every response. Implement. Verify that the tests pass.
- [ ] 5.3 Write tests first for the board page route and its CSP computed from a fixture manifest, and for the chunk route by hash with the token header (refused without it, and with another board's token). Implement. Verify that the tests pass and that the policy holds no `unsafe-` keyword.
- [ ] 5.4 Write tests first for the board protocol over `ws`: the token as first message, a message outside the schema refused, the board document and state on connect, an answer command reaching a fake core, the receipt, the discard, and takeover with `moved` to the older socket. Implement. Verify that the tests pass.
- [ ] 5.5 Write tests first for the detection rule as a table over platform, environment, marker files and `PATH` (the rows of packaging spike row 9, with the container always unshowable), and for the opener's argument vector, a link holding shell metacharacters included, with `spawn` faked. Implement the `notifier` unit. Verify that the tests pass, that one real run with a recorder script as `BROWSER` receives the link as its only argument, and that the check passes with these units at 80% coverage or more.

## 6. View

- [ ] 6.1 Write tests first for the build checks: a chunk holding `import.meta` fails the build, naming it; a chunk past the 10% margin over `packages/view/chunk-sizes.json` fails, naming both sizes; each manifest hash matches its chunk. Implement the build in `tools/build/` (design decision 7) with the shell, the library chunks and the Choice chunk, Tailwind per chunk with DESIGN.md's tokens in both schemes, licence notices, and the board page's standalone validators. Verify that the tests pass and that `bun run build` writes `dist/view/` with a manifest listing each chunk's licence notices.
- [ ] 6.2 Write tests first for `assemble`: only the needed chunks are inlined; the same input gives the same output; the CSP meta tag is exactly AD-8's; the `askboard-data` block escapes `<`. Implement. Verify that the tests pass.
- [ ] 6.3 Write the browser test harness in `packages/view/test/browser/` (Playwright in Chromium, Firefox and WebKit, under Bun) with a test board-protocol server, collecting CSP violations from the view, the board page and the console. Write the view spec's browser scenarios as tests and verify that they fail.
- [ ] 6.4 Implement the view shell, the `CatalogRenderer` port and AskBoard's own renderer with the item frame, error boundary, ready tracking and draft store (design decision 8). Verify with the browser tests for the sandbox, the view's origin, a failing view `fetch`, a throwing component and the question becoming visible with its box unchanged 1 s later.
- [ ] 6.5 Implement Choice with manual activation, the question card, the header and the tab title. Verify with the browser tests: nothing preselected, the arrow keys selecting nothing, "Answer" disabled until a choice, markup in a label shown as text, the keyboard-only path, and the plain-choice board as the view spec describes it.
- [ ] 6.6 Implement the board page: zod's `jitless` first, the WebSocket with the token first, the chunk fetch, `assemble`, `AppBridge`, message validation, the receipt states, the answer queue while disconnected, the three banners with "Continue here", and the theme. Verify with the browser tests for cold load, reload, takeover, a short drop, a refused token, the dark scheme, empty storage after answering, and no CSP violation in any engine, a caught `eval` probe included.

## 7. Session process, plugin and end to end

- [ ] 7.1 Write tests first in `tools/check-imports.test.ts` for design decision 9: the entry point may import `core`, `contract` and each server unit, and no unit may import the entry point. Verify that they fail; then change the rules table, amend AD-1 in place in the spine and update `CLAUDE.md`'s sentence on files outside the unit folders. Verify that the tests and `check:imports` pass.
- [ ] 7.2 Write `packages/server/src/main.ts` (design decisions 3 and 9) with the `Identity` adapter reading the git user name with an argument vector and the login name, and build `dist/askboard.mjs` from it. Verify that the bundle starts on Bun and on Node 24 and lists the two tools to an MCP client.
- [ ] 7.3 Write the conformance suite of design decision 11 over the built bundle, covering ask, board opening, answer, `collect` with and without `wait`, the receipt, resend, `unavailable`, a restart and the exit, and run it on Bun and on Node 24. Verify that it passes on both and that the `server/discover`-only probe leaves no port, file or process.
- [ ] 7.4 Add `.claude-plugin/plugin.json` (design decision 10). Verify with `claude --plugin-dir` on a built checkout that the server `askboard` connects with the two full tool names, and record in this task's note whether `${CLAUDE_PLUGIN_ROOT}` and `CLAUDE_PROJECT_DIR` reached the server.
- [ ] 7.5 Add the CI job of design decision 11 and the `build` and `test:e2e` scripts. Verify that the job's steps pass locally in order, then on the pull request, and record the job's duration in this task's note.
- [ ] 7.6 With the PO: in a scratch project, an agent loaded with the plugin asks the plain-choice question, the PO answers on the board, and the agent collects the answer; repeat with the agent waiting in `collect`. Verify that the answer reached the agent once, that the receipt reached "delivered to the agent", and record both runs in this task's note.

## 8. Records and final checks

- [ ] 8.1 Update `CLAUDE.md` (status, what is in code, the `build` and `test:e2e` commands, `tools/build/` and `dist/` in Working documents) and `README.md`. Verify that each command they list runs as written.
- [ ] 8.2 Run `openspec validate --all --strict --no-interactive`, the check, `bun run build` and `bun run test:e2e`. Verify that all pass.

## Workflow follow-up

- Open the pull request, check that CI passes, squash-merge after the PO approves, then archive the change on `main` (which syncs the six capability specs into `openspec/specs/`) and remove the worktree and its branch.
- Propose the early benchmark (roadmap, after E1; PRD R5) on the walking skeleton.
- Mark E1 done on the "AskBoard Implementation Roadmap" page.
