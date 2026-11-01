# Design

## Context

See proposal.md for why E5 comes now and what it leaves out. What the code starts from, and what it waits for:

- **`main` at 92ca203** (E1 d34422d, compute-engine a670add, the early benchmark): `packages/server/src/excerpts/index.ts` is an empty module, which `tools/check-imports.ts` already lets import only `core` and `contract`. `boardPagePolicy` (`packages/contract/src/hash.ts`) has nine directives and says "`frame-src 'self'` waits for the reading panel (E5)". `BOARD_ROUTES` holds `/b/`, `/c/`, `/m` and `/ws/`, parsed by `parseBoardRoute` and answered by `http.ts`'s `replyTo`. Every response already carries `nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`. The warning is `{code: "no-hooks", message}`, and no schema names an excerpt, a pointer or an image. The approved `ask` description and server instructions already teach `path#Heading`, `path#L10-L40` and `.askboard/media/`. The approved UJ-1 ask holds `{type: "excerpt", id: "retry-adr", props: {pointer: "docs/adr/0012-payment-retries.md#Decision"}}`.
- **E3, `ask-lifecycle`** (branch `worktree-feature-ask-lifecycle`, f2f7dcd, not merged, not yet rebased onto 92ca203): five sets at 1.1 with `SCHEMA_SET_OWNERS`; `LifecycleBoardDocument` with `BoardQuestion {type, id, rev, props}`; `QuestionRecord` with `revs: Map<number, QuestionProps>` and `BoardModel.document(...)` in `packages/core/src/lifecycle/model.ts`; `CorePorts` gains `Clock`; `HostCore` is a `Pick<AskCore, …>`; board-protocol messages are added in four appended steps (its design decision 8); the draft record's `DraftQuestion` refuses unknown fields. Its Handed on gives E5 "context placement in the draft record, the context column and references". It has no resolution, no context item and no split rule (`question-card.tsx` puts each widget item at the card's full width).
- **E4, `push-delivery`** (branch `worktree-feature-push-delivery`, not merged): `Origin {label, ordinal?, cwd, root, branch?, worktree?}` in `packages/core/src/push/ports.ts`, read through `AskCore.ownerOf(askId)?.origin`. Only an `ask` binding has one, and an unchecked ask has none. `root`, a required string, is the git worktree of `cwd` when it shares the project's git common dir, else the real path of `projectDir` (at 2b8734a). `session-process.ts` sets `projectDir = env.CLAUDE_PROJECT_DIR || cwd`, so without the variable an owned ask's `root` comes from the working folder (E4 cross-review, H1). E4 changes no board route, `http.ts`, `tokens.ts`, `gate.ts` or `pages.ts`.
- **`widget-answers`** (proposal only): brings a question's `items`, a discriminator by `type` (`tree`, `gantt`, `molecule`), `warnings` on `update`'s result and the `formula` warning `{code, itemId, address, error, message}`, at the next minor after E3's.
- **`tree-widget`** (PR #11): the view document's `WidgetItem`, `ItemProps`, `register`, and the widget host for browser tests, whose `update()` and `colorScheme` come from its commit 5eec3ca, not from the seams E3 took.
- **`snapshot`** (E7, proposal) holds the board document "as `ask-core` holds it" and hands E5 the FILE reference's Snapshot look; **`molecules`** (proposal) leaves the excerpt per work package to E5.

ADs this design relies on: AD-1, AD-5, AD-6, AD-7, AD-8, AD-9, AD-10, AD-11, AD-12, AD-14, AD-15, AD-20, AD-21. UX sections it implements: EXPERIENCE Information Architecture (Surfaces: Reading panel; Board anatomy: question card with excerpts), Component Patterns (Context: Context column, Excerpt, Reference, Reading panel; Primitives: Display atoms, Image), State Patterns (Context; Reading panel), What a reload keeps (context placement), Interaction Primitives (Explicit acts), Accessibility Floor (Focus, after the reading panel closes), Preferences and Settings (Context placement, Editor), Snapshots (Snapshot view, references), Composition and Components (Board page or view: Reading panel). DESIGN.md: Layout & Spacing (Question card, Wide widgets), Components (Context column, Excerpt, Reference, Reading panel, Section label), the `context-column`, `excerpt`, `reference` and `reading-panel` tokens, Elevation (`shadow-lg`).

## Goals / Non-Goals

**Goals:**

- A pointer never reads anything outside the ask's root, whatever its text, whatever symlinks the root holds, and whatever happens on disk between the send and a click.
- Nothing a file or an agent wrote runs or renders as markup: not in the view, not on the board page, not in the source view.
- An unresolved pointer costs the agent a warning and the user a marked item, never a refused ask or a blocked board.
- Every addition to a file E3, E4 or `widget-answers` also edits is an appended block, so the merges are mechanical.

**Non-Goals:**

- Everything the proposal lists under "Not in this change".
- Reading configuration: the `editor` command and the `contextPlacement` default come from E8 (proposal, A3 and A13).
- Searching for a bare ID across files (FR-9, Out of Scope).
- A source view served for anything the agent did not put in the board document.

## Decisions

### 1. Group 0 waits for E3 and E4, then checks every borrowed name

E5 builds on E3's lifecycle model and board protocol and on E4's origin, so its first task waits until both are on `main`, rebases, and checks each name this design borrows against the code: `QuestionRecord`, `revs`, `BoardModel.document`, `LifecycleBoardDocument`, `BoardQuestion`, `DraftQuestion`, `BOARD_PROTOCOL_MESSAGES`, `SCHEMA_IDS`, `HostCore`, `CorePorts`, `Clock`, `validateBoardMessage`, `fixtures/transcript.ts`, `Origin`, `ownerOf`, `projectDir`, and the `update` result envelope. A name that differs stops the work for `/opsx:update`. It also checks that an owned ask's `origin.root` is absent when `CLAUDE_PROJECT_DIR` is unset (E4 cross-review, H1; decision 4, Root), and stops the same way if E4 still falls back to the working folder. It also notes whether `widget-answers`, `tree-widget`, `molecules` and `snapshot` have merged, which decides decision 2's version labels and decision 11's harness options.

*Alternative:* start on E1's head with stubs for E3's model. Rejected: resolution is stored per revision, and E1 has no revisions.

### 2. Contract: next minors, appended blocks, and the question's `items`

- **Sets.** The input format, output format, board document and board protocol each take the next minor after what `main` holds at group 0. If only E3 has merged, that is 1.2; if `widget-answers` has too, 1.3. Tool envelopes change only if `update`'s `warnings` is not there yet. Every addition is an optional field, an enum value or a new schema, so a receiver on an older minor refuses it as a schema error (E1 design decision 2).
- **The question's `items`.** If `widget-answers` has merged, E5 appends `excerpt`, `reference` and `image` to its `$defs/item` discriminator in the input format and the board document. If not, E5 introduces `items` with these three types and the same discriminator form (`type` with Ajv's `discriminator`), and `widget-answers` appends its own on its rebase (proposal, B10).
- **New schemas.** Under `schemas/input/`: `pointer.json` (`urn:askboard:input:pointer`, a string of 1 to `POINTER_MAX_CHARS`), which the molecules change may `$ref` for `wbs-pert`'s `excerpt`, plus `excerpt-props.json`, `reference-props.json` and `image-props.json`. Under `schemas/board-document/`: the three resolved item schemas. Under `schemas/board-protocol/`: `open-source`, `source-state`, `open-editor` and `editor-outcome`. In `output/warning.json`, the code `unresolved-pointer` and the optional `itemId`, `pointer` and `reason`. In the draft record's question, `context`. "Exactly one of `pointer` and `text`" (excerpt) and "of `pointer` and `url`" (reference) are checks in code, since a root `oneOf` would be a combinator, and so is the URL rule. They report like schema errors through E1's `requests.ts` wording (proposal, B7).
- **The pointer grammar** is one pure function, `readPointer(text)`, in `src/context/pointer.ts`. It returns `{path, anchor}` with `anchor` either `{kind: "lines", start, end}` or `{kind: "name", text}`, or `{invalid: reason}`. It runs in `excerpts`, `ask-core` (to tell an excerpt's pointer has its anchor) and the view (to print the caption), and touches no file (proposal, A6).
- **Routes and responses.** `BOARD_ROUTES.source = "/s/"`, `sourcePath(askId, itemId)`, `SOURCE_SCHEME_QUERY = "scheme"`. A `{kind: "source", askId, itemId}` member is added to `BoardRoute`, and `parseBoardRoute` matches exactly two ID segments after the prefix, with no decoding, so `%2e%2e` is not an ID. `BOARD_RESPONSES` gains `sourceView` (200 HTML), and the 403, 410 and 404 cases reuse E1's entries.
- **Policies.** `boardPagePolicy` gains `frame-src 'self'` before `base-uri` (ten directives). `sourceViewPolicy(styleSha256)` returns `default-src 'none'; style-src 'sha256-…'; img-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'` (proposal, A2).
- **Constants** (proposal, B4) go in `limits.ts`, in one appended block.
- **Exports**, each in one block appended to `src/index.ts`, `src/validate.ts` and `src/fixtures/index.ts`, as `tree-widget` and E3 do. Fixtures: board documents with each context item in each status, a recorded transcript of the reading panel and editor messages, and a fixture source view page for the view's test server.

### 3. `excerpts`: the `SourceFiles` adapter

The adapter is `createSourceFiles({projectRoot, fs?, clock?})` in `packages/server/src/excerpts/`, the unit's first code. It imports only `contract` and `core`'s port types (AD-1) and Node's `fs/promises`. Every operation takes a root and a pointer, and each runs these steps in order:

1. **Grammar.** `readPointer`; an invalid pointer is `invalid-pointer`, with no file system call. With no project root, everything is `no-root`.
2. **Real root.** `realpath` of the root, at each operation, since a worktree can vanish (F5).
3. **Candidate.** Join the root's real path and the pointer's segments, then `realpath`. A missing path is `not-found`. The real candidate must start with the real root plus `/`, compared as exact strings; otherwise `outside-root`. There is no case folding. On a case-insensitive volume, `realpath` of an in-root name in another case still lies under the real root, which both sides got from the same call. A path outside has a different real prefix in any case (proposal, B3).
4. **Open.** `open(realCandidate, O_RDONLY | O_NOFOLLOW | O_NONBLOCK)`, then `fstat` on the handle: it must be a regular file, and its `dev` and `ino` must equal those of a `stat` of the real candidate. Anything else is `not-a-file`, or `outside-root` when the identity differs. A FIFO opened non-blocking returns at once; the handle is always closed.
5. **Read.** At most the limit plus one byte, so an over-limit file is `too-large` without reading it whole.
6. **Decode and anchor**, as pure functions over the bytes: text (proposal, B5), images (B6), line ranges and Markdown sections (A5). The section finder tracks fenced code blocks (backtick and tilde fences, by their length) and ATX headings (`#` to `######`, followed by a space or the line's end), drops a closing run of `#`, and trims the text before comparing. A whole-word match uses letters, digits, `-`, `_` and `.` as word characters, so `FR-8` matches neither `FR-80` nor `XFR-8`.

Its operations:

- `resolveExcerpt(root, pointer)` gives `{status: "resolved", text, mediaType, lines}` or `{status: "unresolved", reason}`.
- `resolveImage(root, pointer)` gives `{status, mediaType, bytes}` or a reason.
- `resolveReference(root, pointer)` gives a status and lines, with no text.
- `sourceState(root, pointer, sentText?)` gives the reading panel's state, the current line and `changed`.
- `readSource(root, pointer)` gives the source view's text, within its own limit.
- `editorTarget(root, pointer)` gives `{file: realCandidate, line}`.

The budget and the concurrency bound (B4) run in `ask-core` through `Clock`, so the adapter stays plain.

*Alternative:* `fs.realpath` (the JavaScript form) instead of `fs.realpath.native`. Rejected: the native call is one system call per path. Tests run both platforms' forms against the same attacks.

### 4. `ask-core`: resolution per revision, and two answers for `board-host`

- **Port.** `SourceFiles` in `packages/core/src/context/ports.ts`, appended as an optional `sources` in `CorePorts`. Without it, every pointer is `no-root`, so E1's and E3's tests that build a core without it keep passing.
- **Root.** `rootOf(askId)` = `ownerOf(askId)?.origin?.root ?? projectRoot`. `projectRoot` is the value the composition passes, so the root never falls back to the working directory (proposal, B2) once E4's origin leaves `root` absent without `CLAUDE_PROJECT_DIR` (E4 cross-review, H1). At 2b8734a an owned ask's `origin.root` is then the working folder's real path; its pointers are `no-root` all the same, since the adapter has no project root (decision 3, step 1), and task 0.2 checks E4's fix.
- **When.** In `ask`, after validation and owner binding and before the rev-1 board document is stored. In `update`, for each question the update gives a new revision, before the revision is applied. Resolution is asynchronous and runs outside the aggregate. The update then applies in one synchronous step with E3's usual checks, so a concurrent act sees either the old revision or the new one, never half (AD-3). Reads run at most `CONTEXT_READS_MAX` at once, and when `CONTEXT_RESOLVE_BUDGET_MS` ends on the `Clock`, every pointer not yet resolved is `timeout`.
- **Storage.** `QuestionRecord` gains `context: Map<rev, ReadonlyMap<itemId, Resolution>>`, pruned with `revs`. `BoardModel.document` merges each revision's resolutions into its items' props, and the excerpt text and image bytes live only there (proposal, B8). Discard drops both maps with the board documents (AD-21).
- **Warnings.** Each unresolved pointer becomes `{code: "unresolved-pointer", itemId, pointer, reason, message}`. The message names the reason in plain words, never a path outside the root, and never says whether a file outside the root exists. Warnings join the `ask` or `update` result in item order.
- **For `board-host`:**
  - `sourceOf(askId, itemId)` finds the item among the current board document's pointer excerpts and pointer references. It returns undefined for anything else, otherwise the adapter's `sourceState` and `readSource` results for the ask's root, with an excerpt's stored text for `changed`.
  - `editorTarget(askId, itemId)` gives the adapter's confined real path and line (proposal, B17).
  - Both are appended to `AskCore`, and their names to `HostCore`'s `Pick`.
- **`fetch`** reads the board document and drops `text` from every excerpt and `bytes` from every image, at any depth of a question's `items`, before E3's paging.

*Alternative:* resolve in `mcp-tools` before calling the core. Rejected: AD-12 gives resolution to `ask-core`, and `update` needs the revision logic that only the core holds.

### 5. `board-host`: the source view, two message pairs and the editor launch

- **Route.** `http.ts`'s `replyTo` gains one appended branch for `kind: "source"`, before the header-token check, since this page takes its token in the query as the board link does (proposal, A1):
  - no `t`, or a token that does not open that ask: 403 plain text;
  - a discarded ask: 410;
  - `core.sourceOf` undefined: 404;
  - otherwise 200, with the page and `sourceViewPolicy`.

  The gate (`Host`, `Origin`) runs first, as for every route. There is no image route: image bytes reach the board page only inside the board document, over the WebSocket the token opened, so the source view is the one request E5 adds and it carries the token.
- **The page** is built by `sourceViewPage({path, state, text?, lines?, scheme})` in `board-host/source-view.ts`, a pure function:
  - Every character of the path and the text is escaped (`&`, `<`, `>`, `"`, `'`), and bidirectional controls become visible markers.
  - Each line is `<span id="L<n>" class="line">` with its number in a `user-select: none` span, so a copied range holds no numbers. The anchor's lines take `class="line hit"`.
  - One static stylesheet, inlined, its hash computed at build time. It uses DESIGN's code type and colours, with `color-scheme` light or dark from `scheme`, or the system's.
  - The page holds no element made from file content other than text inside those spans, no script, no link, no `<base>` and no form.

  States other than available render one line, "This file is not available", "This file cannot be shown as text" or "This file is too large to show here", with the path and, for the last, the size (proposal, A11 and A14).
- **Messages**, by E3's four appended steps: page to host `open-source {itemId}` and `open-editor {itemId}`; host to page `source-state {itemId, status, changed?, line?, editor}` and `editor-outcome {itemId, outcome}`. Both page messages are accepted only on the ask's live socket. `editor` is true when a command is set and the status is available.
- **Editor launch** (`board-host/editor.ts`), on `open-editor` (proposal, A4 and B17):
  1. Take the command from the `editorCommand()` dependency; with none, the outcome is `no-editor`.
  2. Refuse with `busy` a second launch for the ask within a second.
  3. Get `core.editorTarget`; with none, the outcome is `unavailable`.
  4. Build the vector with `editorArguments(command, file, line)`, a pure function that replaces only `{file}` and `{line}` and appends the file when the command has no `{file}`.
  5. Call `spawn(argv[0], argv.slice(1), {shell: false, detached: true, stdio: "ignore"})`, then `unref()`. A spawn error is `failed`.

  Diagnostics name the outcome, never the vector.
- **Composition.** `session-process.ts`:
  - reads `env.CLAUDE_PROJECT_DIR` itself and takes its real path, so E4's working-directory fallback never reaches pointers once E4's origin leaves `root` absent without the variable (E4 cross-review, H1); until then, decision 3's step 1 still makes an owned ask's pointers `no-root` (decision 4, Root);
  - passes `createSourceFiles({projectRoot})` to `ask-core` as `sources`, and `editorCommand: () => undefined` to `board-host`, which E8 replaces with its `Config` port;
  - lets tests inject both, as E3 injects `clock`. The shipped bundle has no override.

*Alternative:* serve the source view's state as HTTP headers or inside its page. Rejected: the reading panel's frame is sandboxed and opaque, so the board page can read neither. Its header needs the chip and the disabled state (DESIGN, Reading panel).

### 6. View: the context column and three components

- **Chunk.** One component chunk, `context`, registers `excerpt`, `reference` and `image` through the `CatalogRenderer` port (proposal, B14). `tools/build/` lists it, `selectChunks` picks it for any board that holds one of the three types, and `chunk-sizes.json` records it.
- **Question card.** `shell/question-card.tsx` sorts a question's items into context items (excerpts, then references) and the rest. The card splits when at least one excerpt is resolved or written and the question's placement is `beside`: a two-column grid, with the question column and the `{spacing.context-column}` context column separated by a `{colors.border}` rule. The rest of the items, images included, follow below both columns at full width (proposal, B19). Without a split, the context sits inline under the question text, and the "Beside | Inline" control shows only when the card could split (proposal, A9).
- **Placement.** The placement is read from the draft record's `context`, else `beside` (proposal, A13), and set by the segmented control in the column's title row. The view mirrors it into E3's `BoardDraft` and leaves it out of what counts as unsent work.
- **Excerpt.** A bordered card: the caption, then the body as an ordered list of lines whose numbers start at `lines.start`.
  - The caption holds the title, else the anchor's text, else the file name, then the source line, path, anchor and range, in the code type.
  - The body is capped at `{spacing.excerpt-max-height}` with scrolling inside. `text/markdown` soft-wraps with a hanging indent; anything else keeps its lines and scrolls sideways.
  - "Open in reading panel" is a `button-link` in the caption, shown for a pointer excerpt with a parent host.
  - An unresolved excerpt shows "Unresolved" and its pointer.
  - All text goes in through `textContent`.
- **Reference.** A two-line chip: the kind label (FILE, GITHUB, WEB), then the path or title, then the hint ("opens in a reading panel" or "opens in browser ↗", the external mark only on the second). A click or Enter sends `askboard.view.open-reference {itemId, inset}` (proposal, B12).
- **Image.** A `blob:` URL made from the base64 bytes and media type, set on an `<img alt>` and revoked on unmount. `ready` follows `img.decode()`, or comes at once for an unresolved image.
- **Snapshot look.** Each component reads `hosted` from a shell context that is true only when the view has a parent host (proposal, B15).
- **Focus.** When the board page reports `reading-panel-closed {itemId}`, a host notification appended to the view protocol, the view focuses that item's control (EXPERIENCE Accessibility Floor, F-03).

### 7. Board page: the reading panel and web links

- **`board-page/reading-panel.ts`**, a module of the board page outside the view, opens on `open-reference` for an item whose board-document props hold a `pointer`:
  1. It renders the side sheet at the right edge, `{spacing.side-sheet}` wide, with `inset.top` and `inset.bottom` (proposal, B12), in the loading state.
  2. It sends `open-source`.
  3. On `source-state`, it sets the iframe's `src` to `sourcePath(askId, itemId)?t=<token>&scheme=<theme>#L<line>`, the frame having `sandbox=""` and `referrerpolicy="no-referrer"`, and keeps the loading look until the frame's `load` event.
  4. The header shows the path from the board document, the chip, "Open in editor" (`button-secondary`, disabled unless `editor`) and ✕.

  The panel is non-modal. Esc on the panel's own elements and ✕ close it, and the board page then sends `reading-panel-closed`. `moved` and `discarded` close it; `closed` leaves it open.
- **Web references.** For an item whose props hold a `url`, the board page checks that the scheme is `http:` or `https:` and that the item is a reference of its current board document. It then calls `window.open(url, "_blank", "noopener,noreferrer")`. It opens nothing for any other message (AD-8).
- **Policy.** The board page's policy is the contract's ten-directive `boardPagePolicy`. The view's own policy keeps `frame-src 'none'`, since the view frames nothing.

### 8. Tests

- **Unit** (`bun test`, 80% per file or more), each written first and seen to fail for the right reason:
  - the pointer grammar as a table;
  - the adapter on real temporary folders, with every attack of the board-host spec plus `/proc/self/root`, a hard link and a root that is itself a symlink. Case and Unicode cases run on macOS and are skipped, named, on Linux, where a case-sensitive pair of files checks the exact comparison instead;
  - the section finder and decoders as tables;
  - `editorArguments` as a table;
  - `sourceViewPage` on hostile text;
  - `ask-core`'s resolution, storage, prune, warnings, budget (a fake `Clock` and a port that never settles) and `fetch` omission;
  - `board-host` routes and messages against recorded transcripts and a fake core;
  - the launch with a fake `spawn`.
- **Integration.** `session-process.test.ts` composes the real units with an injected editor command, a recorder script that writes its arguments to a file, and a temporary project.
- **Browser**, in Chromium, Firefox and WebKit, with no CSP violation from the view, the board page or the source view:
  - the context components on the widget host;
  - the split and inline layouts;
  - the reading panel against the test server's fixture source view and against the real session process;
  - frame refusal from `http://localhost:<port>`;
  - web links;
  - focus return.
- **End to end** (task group 7): the brief's scenario through the conformance runner on Bun and Node 24 and through the browser suite's session-process target.

## Risks / Trade-offs

- [A sandboxed frame's `frame-ancestors 'self'` might be read against its opaque origin in some engine, so the panel shows nothing] → The browser tests open the panel in the three engines first (task 6.6). If one refuses, the frame keeps its `sandbox` and the source view's policy names the board origin (`http://127.0.0.1:<port>`) explicitly. The PO is told.
- [Esc does not reach the board page while focus is inside the sandboxed frame, which runs no script] → ✕ always works. Opening the panel by keyboard focuses its close control. The tests check both, and the gap is recorded for the accessibility floor (EXPERIENCE Open Items 22).
- [`window.open` from the board page after a click in the sandboxed view may be blocked where user activation does not reach the parent frame] → Chromium shares activation with ancestors. The browser tests check each engine. Where an engine blocks it, the board page shows a one-line link the user clicks, and the PO is told, since FR-9 asks for one click.
- [A hard link inside the root to a file outside it reads that file, since paths cannot tell] → Making one needs write access to the file's own folder tree on the same volume, and an agent able to do that can copy the file. It is recorded as accepted, and the adapter's test pins the behaviour.
- [A folder in the root swapped for a symlink between `realpath` and `open`] → The `dev` and `ino` match catches a swapped file. A swapped intermediate folder in that window is the residual race, which needs Node's missing `openat`. Recorded for the security review.
- [The board token in the frame's URL] → The source view runs no script, loads nothing, sends no referrer and is not cached. The token is the one already in the board link, with the same lifetime (proposal, A1, where the alternative is recorded).
- [Image bytes in the board document make board messages and Snapshots large] → Capped per image and per ask (B4). E3's note on re-sending whole documents applies; a later minor may send one question.
- [The agent holds the board token (SOLUTION-DESIGN §6) and could send `open-editor` itself] → It can open only a file of its own ask's root in the user's configured editor, at most once a second. It never chooses the command (AD-8).
- [Reading files at send time adds to the time to visible (SM-3)] → Local reads within the limits take milliseconds. The budget bounds a slow disk, and the early benchmark's S3 case measures it once the WBS row detail lands.

## Migration Plan

None: nothing has been released. Reverting the change returns `excerpts` to an empty module and the sets to their previous minors.

## Merge points

What the later merges with E3, E4, `widget-answers`, `snapshot` and `molecules` bring together. Every entry is an appended block, an appended case or an appended field, and a conflict between two appended blocks keeps every line of each.

- **Contract:**
  - the four sets' version constants;
  - `sets.ts` and `SCHEMA_IDS` (appended IDs);
  - `BOARD_PROTOCOL_MESSAGES` (names appended at the end of each direction);
  - the input and board-document question `$defs/item` discriminator (three appended entries, or the `items` introduction of decision 2);
  - `output/warning.json` (enum value and optional fields appended);
  - the draft record question (`context` appended);
  - `tool-envelopes/update-result.json` (`warnings`, only if `widget-answers` has not added it);
  - `routes.ts` (the `source` route, response and `BoardRoute` member appended, and `parseBoardRoute`'s two-segment case added after E1's);
  - `hash.ts` (`frame-src 'self'` in `boardPagePolicy`; `sourceViewPolicy` appended);
  - `limits.ts`, and the three export blocks (`src/index.ts`, `src/validate.ts`, `src/fixtures/index.ts`);
  - `fixtures/transcript.ts` (one transcript appended).
- **Core:**
  - `ports.ts` (`sources` appended to `CorePorts`);
  - `lifecycle/model.ts` (`context` appended to `QuestionRecord`, the merge in `document`, the prune beside `revs`);
  - `core.ts` (resolution calls in `ask` and `update`, `sourceOf` and `editorTarget` appended);
  - the `fetch` path's omission;
  - new `context/` folder.
- **Server:**
  - `excerpts/` (E5 only);
  - `board-host/http.ts` (one appended branch);
  - `boards.ts` (two appended dispatch cases);
  - `board-host/index.ts` (`HostCore` gains two names; deps gain `editorCommand`);
  - new `source-view.ts` and `editor.ts`;
  - `mcp-tools` `ask` and `update` results (warnings appended after the others), `fetch`;
  - `session-process.ts` (three wiring lines beside E3's `clock` and E4's origins).
- **View:**
  - new `catalog/context/`;
  - `shell/question-card.tsx` (the split);
  - E3's `BoardDraft` (`context`);
  - `view-protocol.ts` (`open-reference` and `reading-panel-closed` appended);
  - `board-page/controller.ts` and `validators.ts` (appended cases);
  - new `board-page/reading-panel.ts`;
  - `tools/build/`'s chunk list (`context` appended);
  - `chunk-sizes.json`, re-recorded after a merge with `bun run build:view --record-sizes`.
- **Tests:** `packages/server/test/conformance/conformance.e2e.ts` (one appended `describe`); new `context.browser.ts` and `reading-panel.browser.ts`; the view's test server (the `/s/` route appended, answering with the fixture page).
- **Documents:** the spine's Structural Seed port list is also edited by `snapshot` (`SnapshotWriter`); both names are kept.

## Handed on

- **E8 (configuration):**
  - the `editor` key, in the argument-vector form of A4, read from the user configuration only, with a project-level one ignored and warned about (AD-14), wired to `board-host`'s `editorCommand`;
  - the `contextPlacement` default and its settings row;
  - the Italian strings of A14;
  - `.askboard/` and `media/` created at a session's first ask (AD-14), so screenshots in a project are ignored by git before any Snapshot is taken.
- **E7 (Snapshots), who builds what:**
  - E5 builds the resolution, the excerpt text and image bytes in the board document, the `context` chunk's components and their Snapshot look: a FILE reference as text, "not available in a Snapshot", no "Open in reading panel", web references as `noopener` `noreferrer` links (proposal, B15).
  - E7 builds the data block, which holds the board documents as `ask-core` holds them and so carries excerpts and images with no E5-specific code, and the Snapshot through `assemble`, which selects the `context` chunk like any other.
  - Shared: the shell's "has a parent host" signal, built by whichever change lands first and reused by the other.
  - Neither: the reading panel and the source view, which exist only on a live board page. Snapshot size grows with image bytes, within B4's caps.
- **The excerpt per work package (proposal, A12):** a follow-up after `tree-widget`, `molecules` and `widget-answers` merge. It adds the Tree's row detail, `wbs-pert` 1.1.0 filling it, and resolution of each node's `excerpt` through `SourceFiles`. `molecules` can already `$ref` `urn:askboard:input:pointer`.
- **Diff review:** its patch files and the paths they name resolve through `SourceFiles`' confined read (proposal, B16), and the source view's highlighting comes with its Shiki grammars (A8).
- **The Text atom:** Markdown rendering, if A7's alternative is chosen.
- **The benchmark epic:** S3's excerpt by pointer (SOLUTION-DESIGN §7) and SM-C1's check that rich questions keep their excerpts and references.
- **The skills:** teaching the three item types, `.askboard/media/`, and the warning's reasons, generated from `contract` (AD-6).

## Open Questions

None beyond the proposal's, which record the narrowest choice taken for each. The PO accepted every one as proposed on 2026-11-01 (decisions-5).
