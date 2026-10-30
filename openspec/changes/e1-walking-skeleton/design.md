# Design

## Context

See proposal.md for why E1 comes now and what it leaves out. What the code starts from:

- **Workspace** (`setup-workspace`): ten empty packages `@askboard/<unit>`, Bun 1.4.4 with the isolated linker and exact pins, TypeScript 7.0.2 with one `tsc -p` per package, Biome, `bun test` at 80% coverage, the import check (AD-1) and the licence check (AD-19), one CI job. `core` and `compute` compile without DOM, Node or Bun types; `server`, `contract` and the rest compile without runtime types today. No runtime dependency is installed.
- **Model contract** (`review-model-contract`, archived): approved examples of the tool definitions, server instructions, asks, results and answers, with findings F4, F5, F7, F10 and F12 assigned to `contract` (E1).
- **Renderer spike** (decided 2026-10-30): AskBoard's own renderer behind `CatalogRenderer` (row 1); an error boundary per item and hidden containers still mounted (row 2); the board page's policy names `img-src data: blob:` and `font-src data:` (row 4); Choice on Radix Radio Group and Checkbox, never Select (row 6); Tailwind's `dark:` variant on the `.dark` class (row 15); ext-apps `App` and `AppBridge` kept, with zod's `jitless` set before ext-apps loads (rows 16, 17); CI checks of the view build (row 18); the licence-check corrections of row 20.
- **Packaging spike** (decided, PR being opened): the launcher stays; the detection rule behind `unavailable` (row 9); no board heartbeat timeout under 90 s, since hidden Chrome tabs run timers once a minute (row 10).
- **Mod delivery spike** (decided 2026-10-30): its outcomes bind E4, not E1 (proposal, open question 1); its notes for the mod are under Handed on.
- **Formula spike** (decided, PR being opened): own restricted evaluator, no IronCalc and no `'wasm-unsafe-eval'`; E1 has no formula, so the view's policy keeps AD-8's form without it.

ADs this design relies on: AD-1, AD-2, AD-3, AD-4, AD-5, AD-6, AD-7, AD-8, AD-9, AD-10, AD-11, AD-12, AD-14, AD-18, AD-19, AD-20, AD-21. UX sections it implements: EXPERIENCE Presentations (Single-question board); Component Patterns (State pill; Question card, Answer, Header chip, Option, Delivery receipt, Question loading; Board banner: Connection lost, Discarded, Board moved; Invalid-link page); State Patterns (Ask states, By surface); Interaction Primitives (Explicit acts, Delivery, Banned); Accessibility Floor (Keyboard core, Shortcuts, Focus, Theme); Composition and Components (Board page or view, Atoms: Choice). DESIGN.md: Colors (both schemes), Components (the same names).

## Goals / Non-Goals

**Goals:**

- One plain question goes from an agent's `ask` to a board and back through `collect`, through every layer the spine plans, with each layer's rules enforced from its first commit.
- The seams later epics extend are real: schema sets with versions, the event log and cursors, the board protocol, the manifest and `assemble`, the `CatalogRenderer` port.
- Every check the Consistency Conventions name for the code E1 writes runs in CI.

**Non-Goals:**

- Any behaviour proposal.md lists under "Not in this change".
- The Claude Code version gate of AD-18 (minimum version from the client information): the minimum rests on mod and hook behaviour, so it comes with E4.
- The legacy-negotiation run (`MCP_PROTOCOL_NEGOTIATION=legacy`), runs on Node 26 and on macOS, and runs against several Claude Code versions: they need the live and release CI that E10 and E11 set up.
- Fonts: the board uses the system font stacks until the faces are adopted (open question 8).

## Decisions

### 1. The narrow scope is enforced by the contract, not by special cases

E1's input format defines one question type, one question per ask and English only, and every schema sets `additionalProperties: false`. A field or type that a later epic adds fails validation today with the usual error naming the item and the field, so E1 needs no "not supported yet" code path. Later epics widen the schemas with minor versions.

*Alternative:* accept everything the tool schema allows and ignore what E1 cannot show. Rejected: a recommended option or an open prompt the board silently drops is an answer path the user never saw (AD-10).

### 2. Contract layout and validation

- Schemas are JSON files under `packages/contract/src/schemas/<set>/`, one folder per set, each set with its version in one module. TypeScript types are written beside them and tested against the fixtures.
- Two layers, as AD-6 asks: the tool input schemas stay generic (items are `{type, id, props}`), and the server then validates the request against the contract's input format.
- The server compiles the schemas with Ajv 8.20.0 (`ajv/dist/2020`) once, at the first request. The board page cannot compile under its CSP (no `eval`), so the view build generates standalone validators for the board-protocol messages the board page receives (AD-7, SOLUTION-DESIGN §4.4).
- Checks a schema cannot express run in the contract's own validation function and report like schema errors: unique option labels (F5), unique item IDs, the reserved prefix (F10).
- Versions on the wire are `major.minor` strings, as the approved examples write them. A receiver compares the major only.
- **F12:** results keep both versions, `{result, output}`, as the examples do. *Alternative:* one version for the envelope and the output format together; rejected because the two have different owners (AD-7).
- **F10:** the reserved prefix is `u-`, the prefix of the approved example. It applies to every agent-chosen ID, as AD-7 says.
- **F4:** the answer event carries `choice`, `note`, `changes`, `results` and `derived`, all optional; `changes` is AD-20's generic diff (`add`, `remove`, `move`, `set` with `target`, `parent`, `after`, `value`), and `results` and `derived` stay open objects until each widget's epic narrows them (F7). E1 fills only `choice`.
- The approved examples are copied into `packages/contract/test/fixtures/` unchanged. Every ask passes the generic `ask` input schema; the plain-choice ask, result and answer pass the full contract; every `answer` event of every answer fixture passes the answer event schema. Each later epic adds the fixtures its types complete.
- Constants (the contract spec's list) live in one module. Values E1 chooses: board port range 47200 to 47299, which holds the examples' 47213; derived-title length 80 characters, a provisional value for EXPERIENCE's open item 9.

### 3. `ask-core`: one aggregate per ask, ports for everything outside

- An `Ask` aggregate holds the request as accepted, the board document's revisions, the state, the event log and `received`, and changes only through its methods (`answer`, `markRead`, `discard`). An `AskStore` keyed by ask ID holds the epoch's asks in memory (AD-14).
- Ports `ask-core` declares and adapters implement: `BoardAddress` (`board-host`: the link of an ask), `BoardShowing` (`notifier`: whether a board can be shown, and opening one), `Identity` (the server entry: git user name, then login name), `Clock`, `Randomness` (the epoch). `ask-core` stays runtime-neutral (AD-1).
- `ask-core` publishes what happened through one subscription: events appended, `received` raised, ask discarded. `board-host` forwards them to the live board, and `mcp-tools` wakes its waiting `collect` calls. No adapter reads another (AD-1).
- RFC 8785 canonicalization for the resend rule is a small function in `ask-core`: E1's JSON has strings, booleans and arrays, and integers only where the schema allows them.
- `ask` creation order follows SOLUTION-DESIGN §5.1: validate, check `BoardShowing` (else `unavailable`, nothing created), create the ask and its rev-1 board document, return the result, then open the board.

### 4. `mcp-tools` on the MCP SDK v2, over stdio

- `@modelcontextprotocol/server` 2.4.0 with its stdio transport. The tool definitions come from the contract's copy of the approved `tools.json` (`ask` and `collect` only), so the listed definitions cannot drift from the reviewed ones; the server instructions are the approved text minus the lines about `update`, `fetch`, follow-ups, postponing and declining, held in the contract.
- **Lazy start (AD-2):** the entry point creates the board listener the first time `ask-core` asks `BoardAddress` for a link, so `server/discover`, `initialize` and `tools/list` touch nothing.
- **Results:** one text block of JSON in its envelope (AD-6). The no-hooks notice is a warning `{code: "no-hooks", message}` in every `ask` result, and every `collect` ask entry carries `unchecked: true`. *Alternative:* the notice in the `ask` result only; rejected because AD-5 says every result of an unchecked ask says so.
- **Waiting:** `collect` with `wait` registers a waiter on the subscription and races it against a 20-minute timer and the request's abort signal; when the request carries a progress token, a 60-second timer sends progress. On timeout the result is the typed outcome `open`.
- **Exit:** stdin end, SIGINT, SIGTERM and SIGHUP call one shutdown that discards every open ask (the core requirement), waits for the boards' sockets to flush with a short bound, closes the listener and exits.

### 5. `board-host` on `node:http` and `ws`

- AD-19 rules out `Bun.serve` in a shipped unit, and Node has no WebSocket server. The listener is `node:http`, and the WebSocket server is the `ws` package, adopted after its adoption check and pinned. *Alternatives:* hand-written RFC 6455 framing (security-sensitive code AskBoard would own) or a streaming `fetch` response with POSTs (two channels where AD-11 assumes one).
- Routes: `GET /b/<askId>?t=<token>` serves the board page; `GET /c/<sha256>` serves one view chunk's source, with the token in the `X-AskBoard-Token` header; the WebSocket upgrade at `/ws/<askId>` takes the token in its first message. Everything else is the invalid-link page or 404. Tokens are 16 random bytes in base64url (22 characters, as in the examples), compared in constant time.
- The board page's CSP is computed once from the manifest: the board page script's hash and every chunk's script and style hashes. `frame-src 'self'` is left out until the reading panel needs it (E5).
- **Takeover:** a second WebSocket for one ask becomes the live one; the first receives `moved` and is closed. "Continue here" reconnects, which takes the board back.
- No heartbeat: liveness comes from the WebSocket closing, and with no grace timer in E1 nothing waits on it. When E3 adds one, its timeout is at least 90 s (packaging spike row 10).

### 6. `notifier`: a pure detection rule and an argument-vector opener

The detection rule is a pure function over the platform, the environment, two marker files and a `PATH` lookup, tested as a table of rows from the packaging spike (row 9). E1 has no container opt-in, so a container always gives `unavailable` (open question 6). `BROWSER` is taken as one command, never split, and every opener starts with `spawn(command, [link], {shell: false, detached: true, stdio: "ignore"})`. E1 opens every new board (open question 5).

### 7. The view build: Bun's bundler, classic-script chunks, Tailwind per chunk

- A build script in `tools/build/` (repository tooling, so Bun APIs are allowed and it type-checks under `tsconfig.test.json`) builds each chunk with `Bun.build` as an IIFE. A bundler plugin maps the shared libraries to globals that their library chunks define: React and React DOM, `radix-ui`, and ext-apps with zod and the MCP client and core. Its resolve filters name only the modules they map (renderer row 18).
- Each chunk's styles come from the Tailwind CLI over that chunk's sources, with DESIGN.md's tokens as CSS variables and `@custom-variant dark (&:where(.dark, .dark *))` (row 15).
- The manifest records each chunk's SHA-256, styles, dependencies and licence notices, the notices collected from the license files of the packages the bundler's metafile lists for that chunk.
- The build fails on `import.meta` in any chunk. `packages/view/chunk-sizes.json` records each chunk's size; the build fails when a chunk grows more than 10% over it, and a change that means the growth updates the file, so the diff says so.
- Output goes to `dist/` at the repository root: `dist/askboard.mjs` (the session process) and `dist/view/` (board page, chunks, manifest, standalone validators). The session process finds `dist/view/` beside itself.
- *Alternative:* Vite or Rollup for the view. Rejected: Bun is the Stack's bundler, and the renderer spike built every chunk with it.

### 8. Board page and view at run time

- **Board page** (`packages/view/src/board-page/`): sets zod's `jitless` first, opens the WebSocket and sends the token, receives the board document and state, picks the chunks with `assemble`'s selection step, fetches their sources by hash, calls `assemble`, sets the iframe's `srcdoc`, and hosts ext-apps' `AppBridge`. It validates every board-protocol message with the standalone validators and every view message structurally, shows the banners, and queues answer commands while disconnected, sending them in order on reconnect with backoff.
- **View** (`packages/view/src/shell/`): boots from the `askboard-data` block of the srcdoc (board document and state), connects ext-apps' `App` to the board page, and renders through AskBoard's own renderer: each item in an `ItemFrame` with an error boundary and a ready tracker (rows 1, 2). The draft record lives in the view and is not mirrored in E1 (open question 5).
- **Messages across the iframe:** view messages (`answer`, `ready`, `item-error`) go as `App` tool calls under `askboard.view.*` names, which the board page's `AppBridge` answers itself and never forwards. State changes after boot reach the view as ext-apps host notifications. Both directions are typed in `view`, since the board page and the view are one unit; only the board protocol is a contract schema set (AD-7).
- **Choice** (`packages/view/src/catalog/choice/`): Radix Radio Group for single choice and Checkbox for multiple choice. EXPERIENCE asks for manual activation, while Radix's radio group selects on arrow keys, so the component handles the arrow keys itself and selects only on Space, Enter or a click.
- **Question card and header** are view chrome around the catalog: header chip, text, the Choice options, "Answer" (disabled until there is a choice) and the receipt; the header shows the title and the ask state.
- **Answer idempotence:** a retried answer cannot be logged twice, because `ask-core` refuses a second answer to an answered question and the board then shows the logged one (core spec). E3's revisions will need a client action ID instead.

### 9. The session process entry point and AD-1

`packages/server/src/main.ts` builds the store, the adapters and the subscriptions, and starts the stdio server. It imports `ask-core`, `contract` and the server units, which AD-1 does not allow any adapter to do. E1 amends AD-1 in place: the session process entry point composes the units, may import `ask-core`, `contract` and every server unit, and nothing imports it. The import check's `server` row changes to match, with tests first.

### 10. The development plugin runs the bundle on Bun

`.claude-plugin/plugin.json` names the plugin `askboard` and its server `askboard`, which runs `bun ${CLAUDE_PLUGIN_ROOT}/dist/askboard.mjs` with `CLAUDE_PROJECT_DIR` in `env`. Bun is the repository's pinned toolchain and the runtime the executable will embed, while `node` on the user's `PATH` may resolve, through Volta, to a version below 24.22.1 outside this repository. CI runs the same bundle on Node 24 too. E11 replaces the command with the launcher. *Alternative:* `node`; rejected for the version reason above.

### 11. Tests: unit, conformance and browser

- **Unit** (`bun test`, 80%): contract schemas and fixtures, `ask-core` (states, log, cursors, `received`, resend, title, who), `mcp-tools` handlers against a fake core, `board-host` routes and checks against a fake core, the detection rule, `assemble`, the manifest and chunk checks.
- **Conformance** (`packages/server/test/conformance/`): the built bundle under Bun and under Node 24, driven over stdio by `@modelcontextprotocol/client` 2.4.0 (pinned already as ext-apps' peer), with `BROWSER` pointing at a recorder script and Playwright standing in for the user. It covers the specs' scenarios end to end: ask, open, answer, collect with and without `wait`, receipt, resend, `unavailable`, restart and exit. It runs without mod and hooks, the one configuration AD-1's three that exists.
- **Browser** (`packages/view/test/browser/`): Playwright's Chromium, Firefox and WebKit, under Bun as in the renderer spike. Cold load, reload, takeover, `self.origin === "null"`, a view `fetch` that fails, an item's box unchanged 1 s after visible, the keyboard path, the banners, and no CSP violation from the view, the board page or the console, a caught `eval` probe included (row 17).
- Scripts: `bun run build`, and `bun run test:e2e` for conformance and browser tests together; `bun run check` stays as it is and gains the contract checks through `bun test`.
- **CI:** one more Linux job: install Bun, `bun install --frozen-lockfile`, install the three Playwright engines with their system dependencies, build, `test:e2e` on Bun, then the conformance suite on Node 24. About five minutes per run; no macOS job.

### 12. Licence check: the Tailwind part of renderer row 20

Tailwind's CLI brings `@tailwindcss/oxide-wasm32-wasi`, which bundles dependencies meant for another platform; the check takes them for missing installs today. The check learns to treat the bundled dependencies of a package that is not for this platform as that package's, with tests first. `robust-predicates`, `khroma` and `argparse` come with Mermaid and markdown-it, so their corrections stay with the epic that adopts those (open question 8). Any other finding on E1's lockfile stops the work for the PO.

## Risks / Trade-offs

- [Radix's radio group selects on arrow keys, and overriding its keyboard handling may fight its roving focus] → The browser tests assert that the arrow keys select nothing, in every engine. If the override cannot hold, Choice renders its own `role="radio"` buttons on Radix's primitives and the PO is told.
- [The ext-apps host notification that carries state into the view is not one the renderer spike exercised] → The browser tests cover a receipt and a discard reaching a booted view. Fallback: rebuild the srcdoc from the new state, which costs focus and is reported.
- [`connect-src 'self'` may not admit `ws:` in some engine] → The WebKit and Firefox runs of the browser tests settle it; if one refuses, the policy names `ws://127.0.0.1:<port>` explicitly, still with no wildcard.
- [`${CLAUDE_PLUGIN_ROOT}` or `CLAUDE_PROJECT_DIR` may not be substituted under `--plugin-dir`, as `${CLAUDE_PLUGIN_DATA}` was not in the packaging spike] → A live run with `--plugin-dir` checks both. Without `CLAUDE_PROJECT_DIR`, `who` falls back to the login name and nothing else in E1 needs it.
- [The MCP SDK, ext-apps and Tailwind may bring licences the check refuses] → The adoption checks run before any pin, and the work stops for the PO on a finding outside row 20's Tailwind part.
- [Opening every new board takes the front from the user] → Accepted for E1 (open question 5); E4 adds AD-2's working-board rule with the notification.
- [About five more Linux CI minutes per run, against 2,000 a month] → No macOS job; the job's time is recorded in the CI task, and the PO decides if it should run only on `main`.
- [The single-question limit makes agents split multi-question asks] → E1 is not released; the early benchmark compares single questions, as AskUserQuestion's plain case does.

## Migration Plan

None: E1 is the first product code. A revert of the change removes it whole.

## Handed on

What the spikes and reviews left for E1 that this proposal moves to a later epic, so that its proposal picks it up:

- **E4 (mod, from the mod delivery spike's probe review):** stamp the append time before the append; count only `isDelivered: true` as delivered; send the catch-up answers of a completed turn in one submit, since run D6 read one answer twice; update the status-line entry when an ask closes, not only when it is answered. Also AD-2's working-board rule with FR-23's notification and terminal link, and AD-18's version gate.
- **E2:** finding F7 (which derived values an answer carries, per widget), the formula grammar, the function whitelist and the formula limits in `contract` (formula spike).
- **The epic that adopts Mermaid and markdown-it:** renderer row 20's `robust-predicates` (the Unlicense in the permissive set), `khroma` (an override citing its MIT licence file) and `argparse` (the addendum's licence exception).
- **E3:** a client action ID on answer commands, for revisions; the reconnect grace timer, with a timeout of at least 90 s.
- **The epic that completes the board's look:** the Inter and JetBrains Mono faces and their subsets (renderer row 19), unless the PO brings them into E1.

## Open Questions

None that change the specs or the tasks; the scope choices are in proposal.md for the PO.
