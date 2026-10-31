# Tasks

Each task writes its tests first and sees them fail for the right reason before it implements (the repository's TDD rule). "The check" means `GITHUB_TOKEN=$(gh auth token) bun run check` (`bun test` at 80% coverage per file); "the browser suite" means `bun packages/view/test/browser/run.ts --engines chromium,firefox,webkit`, with no CSP violation in any engine (an option goes before `--`, as in `-- -t <name>`); "the conformance suite" means `bun run build`, then `bun packages/server/test/conformance/run.ts --runtime bun` and `--runtime node`. After each task: `openspec validate --all --strict --no-interactive`, `bun run format` with `git status` showing only the task's files, the check, and the browser suite when the task touches `packages/view` or `tools/build/`. Then tick the box with a `  - Note:` (what was built, the choices made, the evidence) and commit in conventional form with no attribution.

## Scope and order

- **May change:**
  - new files under `packages/contract/src/context/`, `src/schemas/*/` (the schemas of design decision 2), `src/fixtures/` and `packages/contract/test/`, plus the appended blocks and fields that design.md's Merge points list;
  - `packages/core/src/context/` and the lifecycle files Merge points name;
  - `packages/server/src/excerpts/`, `board-host/`, `mcp-tools/` and `session-process.ts`;
  - `packages/view/src/` and `packages/view/test/browser/`, `packages/view/chunk-sizes.json`, `tools/build/`;
  - `packages/server/test/conformance/`.
- **Never changes:** E1's, E3's and E4's existing schema files except the appended fields design.md names; `docs/` (spine and UX changes are drafted here, and applied only in task 9.1 after the PO's answers); every `package.json`, `tsconfig*.json` and `bun.lock` (no dependency is added); another change's folder; `.claude/commands/opsx/` and `.claude/skills/openspec-*`; any other worktree.
- **Order:**
  - the contract (group 1) first, since every unit reads it;
  - the adapter (group 2) and the core (group 3);
  - the MCP results (group 4) and the board host (group 5);
  - the view and board page (group 6), whose browser scenarios fail first against the group 5 host;
  - then the end-to-end scenario (group 7), the security review (group 8) and the records (group 9).

## 0. Decisions and base

- [ ] 0.1 Wait until `ask-lifecycle` (E3) and `push-delivery` (E4) are both merged to `main`; then rebase this branch onto `main` and run `bun install --frozen-lockfile`. Verify that `git log origin/main` holds both merges, that the rebase left only this change's commits on top, and that the check passes on the rebased branch before any code task starts.
- [ ] 0.2 Check every name design decision 1 borrows from E3 and E4 against the merged code (`QuestionRecord`, `revs`, `BoardModel.document`, `LifecycleBoardDocument`, `BoardQuestion`, `DraftQuestion`, `BOARD_PROTOCOL_MESSAGES`, `SCHEMA_IDS`, `HostCore`, `CorePorts`, `Clock`, `validateBoardMessage`, `fixtures/transcript.ts`, `Origin`, `ownerOf`, `projectDir`, the `update` result envelope). Record which of `widget-answers`, `tree-widget` (5eec3ca's `update()` and `colorScheme`), `molecules` and `snapshot` are on `main`, and so the minor each set takes (design decision 2). Verify with a grep per name in `packages/`, recorded in the note; if any name or shape differs, stop and run `/opsx:update` before group 1.
- [ ] 0.3 Read the PO's answers to the proposal's open questions A1 to A14 and B1 to B19, and record each under its question. Verify that every answer matches the default this change takes; if one reverses a default, stop and run `/opsx:update` on the proposal, specs, design and these tasks before group 1.

## 1. Contract

- [ ] 1.1 Write tests first for `readPointer` in `packages/contract/src/context/pointer.ts` (design decision 2), as a table: line ranges (`L1-L1`, `L40-L62`, a reversed `L9-L3` read as a name, `L0-L2`, `L40` alone read as a name); headings with spaces and punctuation; the first `#` ending the path; every invalid form of the contract spec's "Paths that leave the root by their text" plus an empty path, a NUL, a tab, U+007F, a path of `POINTER_MAX_CHARS + 1`; `%2e%2e` kept as a literal segment. Implement, with no file system access. Verify that the tests pass with 100% coverage of `pointer.ts`, and that `check:imports` finds it importing nothing.
- [ ] 1.2 Write tests first for the input schemas `pointer.json`, `excerpt-props.json`, `reference-props.json` and `image-props.json`, for the question's `items` admitting `excerpt`, `reference` and `image` by the discriminator (design decision 2: appended to `widget-answers`' entries, or introduced with these three), and for the checks in code: exactly one of `pointer` and `text`, exactly one of `pointer` and `url`, the URL rule (absolute, `http:` or `https:`, a host, no user name or password, at most `URL_MAX_CHARS`), with the scenarios of the contract spec's "Context items in a question" and "Web reference URLs". Problems are worded through `requests.ts`, naming the item and field. Verify that the tests pass, that the approved UJ-1 ask's excerpt item validates while its `diff-review` item is still refused naming its type, and that the set's version constant is the minor task 0.2 recorded.
- [ ] 1.3 Write tests first for the board document's resolved items (contract spec, "Resolved context in the board document"): each status of each item type, a resolved excerpt without text refused, an unresolved image with bytes refused, `lines.start > lines.end` refused, `kind` only `file`, `github` or `web`. Add the schemas and fixtures (`contextBoardDocument` with every case). Verify that the tests pass and that the board page's standalone validators, rebuilt with `bun run build:view`, accept the fixture.
- [ ] 1.4 Write tests first for the warning code `unresolved-pointer` with `itemId`, `pointer` and `reason` (each of the ten reasons), the `update` result's `warnings` (only if task 0.2 found it absent), and the draft record question's `context`. Implement as appended fields. Verify that the tests pass and that a `no-hooks` warning and a draft record without `context` validate as before.
- [ ] 1.5 Write tests first for the four board-protocol messages (`open-source`, `open-editor`, `source-state`, `editor-outcome`), each by E3's four appended steps (schema, list, validation, transcript): a message with a `path` field refused; `source-state` with each status; `editor-outcome` with each outcome. Verify that the tests pass, that `BOARD_PROTOCOL_MESSAGES` lists them at the end of each direction, and that E1's and E3's transcripts still replay.
- [ ] 1.6 Write tests first for the source route: `parseBoardRoute` for `/s/<askId>/<itemId>` and each path of the contract spec's "A path that is not a source route"; `sourcePath`; `BOARD_RESPONSES.sourceView`. Then `boardPagePolicy` with ten directives, `frame-src 'self'` among them, and `sourceViewPolicy(styleSha256)` exactly as design decision 2 lists. Implement. Verify that the tests pass and that E1's board-page policy test now expects ten directives and fails on any other.
- [ ] 1.7 Add the context limits of proposal B4 to `limits.ts` in one appended block, and the three appended export blocks. Write a test that every limit is a positive integer and that the image limit per ask is at least the limit per image. Verify that the tests pass and that a grep finds no other definition of these values in `packages/`.

## 2. `excerpts`: confinement and reading

- [ ] 2.1 Write tests first for `createSourceFiles` in `packages/server/src/excerpts/`, on real temporary folders made per test (`mkdtemp`, removed after). Cover every invalid pointer reaching no file system call, checked with a spy `fs`, and `no-root` when no project root is given. Cover a missing file as `not-found`. Cover symlinks: a file symlink out of the root, a folder symlink out, a chain whose last link leaves, an absolute symlink to `/etc/hosts`, a link to `/proc/self/root/…` on Linux, a sibling folder sharing the root's prefix (`/w/proj` and `/w/proj-old`), a link that stays inside (followed), and a root that is itself a symlink (made real first). Implement steps 1 to 3 of design decision 3. Verify that the tests pass on macOS and in the Linux devcontainer, and that no test reads a byte of any outside file, checked by a sentinel file's access time and content never reaching a result.
- [ ] 2.2 Write tests first for steps 4 and 5: a FIFO (unresolved `not-a-file` within 100 ms, the test failing on a hang through a 2 s timer), a directory, a Unix socket, `/dev/null` reached through an in-root link (`outside-root`); a file swapped for a symlink to an outside file between the `realpath` and the `open`, through an injected hook in the test `fs` (`outside-root` or `not-a-file`, never the outside content); a file over the read limit read only up to the limit plus one byte (`too-large`); every handle closed, checked by counting open handles. Implement. Verify that the tests pass on both platforms.
- [ ] 2.3 Write tests first for case and Unicode forms: on macOS, on the default case-insensitive APFS volume, `DOCS/X.md` for `docs/x.md` resolves inside the root, an NFC name resolves the NFD file, and no case form of a path to a sibling outside the root resolves; on Linux, two files differing only by case resolve each to itself. Skip the platform's other half with a named reason. Verify that the tests pass on macOS and in the Linux devcontainer, and record both runs in the note.
- [ ] 2.4 Write tests first, as tables over bytes with no file system, for the decoders and anchors of design decision 3, step 6. Text: BOM dropped; NUL and invalid UTF-8 `not-text`; LF, CRLF and CR. Media types: `text/markdown` only for `.md` and `.markdown`. Images: PNG, JPEG, GIF87a, GIF89a and WebP recognised, and SVG, HTML named `.png`, and a truncated header `not-image`. Line ranges: in range, past the end, at the last line. Sections: exact heading, a whole-word ID (`FR-8` matching `#### FR-8: …` but not `FR-80` or `XFR-8`), a closing `#` run, headings inside backtick and tilde fences of several lengths ignored, a section ending at the next heading of the same or a higher level or at the end of the file, a heading anchor in a `.ts` file `anchor-not-found`, and an excerpt over 1,000 lines or 64 KiB `too-large`. Implement. Verify that the tests pass with 80% coverage or more of each file under `packages/server/src/excerpts/`.
- [ ] 2.5 Write tests first for the six operations of design decision 3 (`resolveExcerpt`, `resolveImage`, `resolveReference`, `sourceState` with `changed`, `readSource` within the source view's limit, `editorTarget` giving the real path and the line), each over the steps above. Implement. Verify that the tests pass and that `check:imports` finds `excerpts` importing only `contract`, `core` and Node built-ins.

## 3. Ask core

- [ ] 3.1 Write tests first for the `SourceFiles` port and `rootOf`: an ask whose origin has a root uses it; an unchecked ask and an ask without origin use the project root; no project root gives `no-root` for every pointer, even with an origin, since the project root decides whether pointers resolve at all (core spec, "The ask's root"); a core built without `sources` gives `no-root`. Add `packages/core/src/context/ports.ts` and the appended `sources` field. Verify that the tests pass, that E1's and E3's core tests pass unchanged, and that `core` still compiles without DOM, Node or Bun types.
- [ ] 3.2 Write tests first for resolution at `ask`, with a fake port. Cover each item type and status; an agent-written excerpt reading nothing; reads bounded by `CONTEXT_READS_MAX` at once; the budget ending with a fake `Clock` while a port call never settles (those pointers `timeout`, the ask created); warnings in item order with messages that name no path outside the root; and the board document holding the resolutions while the resend rule still compares the request as sent. Implement (design decision 4). Verify that the tests pass.
- [ ] 3.3 Write tests first for resolution at `update`: only the questions with a new revision are read again; the update applies in one step after resolution, and an act that arrives between sees the old revision; a change refused by E3's rules reads nothing; revisions pruned with their resolutions; discard dropping every resolution with the board documents (core spec, "Discard drops resolved context"). Implement. Verify that the tests pass and that E3's revision and discard tests pass unchanged.
- [ ] 3.4 Write tests first for `sourceOf` and `editorTarget`: each answers only for a pointer excerpt or pointer reference of the ask's current board document, and nothing for an image, a written excerpt, a web reference, an unknown or deleted item, or a discarded ask. `changed` compares an excerpt's stored text with the current range. `editorTarget` resolves again (a file swapped for an outside symlink after the send gives no target). Append both to `AskCore`. Verify that the tests pass with 80% coverage or more of each new file under `packages/core/src/context/`.

## 4. MCP adapter

- [ ] 4.1 Write tests first: `ask` and `update` results carry the `unresolved-pointer` warnings beside `no-hooks` and any `formula` warning, and validate against their envelopes. `fetch` of a question holding every context item returns no `text` on any excerpt and no `bytes` on any image, at any depth, with statuses and line ranges kept, before E3's paging (mcp-adapter spec). The tool definitions and instructions equal the approved fixtures. Implement. Verify that the tests pass against a fake core and that `tools/list` is byte for byte unchanged.

## 5. Board host and the session process

- [ ] 5.1 Write tests first for `sourceViewPage` (design decision 5), on hostile text. The board-host spec's markup scenario, `<!--`, `]]>`, a NUL-free control character, a 20,000-line file and each state's one line must give HTML whose only elements are the page's own, checked by parsing it, with every byte of the file present as text. Line IDs `L1` to `Ln`, the hit class on the anchor's lines, bidirectional controls as visible markers, and the stylesheet's hash equal to the one in `sourceViewPolicy`. Implement. Verify that the tests pass with 100% coverage of `source-view.ts`.
- [ ] 5.2 Write tests first for the `/s/` branch of `http.ts` against a fake core: each answer of the board-host spec's "The source view" (no `t`, another ask's token, a discarded ask, a non-pointer item, an unknown item, each source state), the gate refusing a non-loopback `Host` or a foreign `Origin` before anything, `HEAD` sending no body, and every response's headers (`nosniff`, `no-referrer`, `no-store`, the exact policy on 200, E1's plain policy otherwise). Implement as one appended branch. Verify that the tests pass and that E1's and E3's `http.ts` tests pass unchanged.
- [ ] 5.3 Write tests first for `open-source` and `source-state` on a recorded transcript appended to `fixtures/transcript.ts`: accepted only on the ask's live socket, refused on a moved socket, `editor` true only with a command and an available file. Append the dispatch case to `boards.ts`. Verify that the tests pass and that every earlier transcript still replays.
- [ ] 5.4 Write tests first for `editorArguments` as a table: `{file}` and `{line}` inside arguments (`--goto`, `+{line}`), several occurrences, no `{file}` appending the path, no other expansion (`$HOME`, `~`, `%s` and `{other}` kept as written), and a path with spaces, quotes, `$(…)`, backticks, `;` and a leading `-` in its name passed as one argument starting with `/`. Then the launch with a fake `spawn`: `shell: false`, `detached`, `stdio: "ignore"`, `unref` called, each outcome (`opened`, `no-editor`, `unavailable`, `failed`, `busy` within a second), the command's arguments never in diagnostics, and no launch on any other message. Implement `editor.ts` and the `open-editor` case. Verify that the tests pass with 100% coverage of `editor.ts`.
- [ ] 5.5 Write tests first in `session-process.test.ts`. Composed with a temporary project as `CLAUDE_PROJECT_DIR` and an injected editor command running a recorder script that writes its arguments to a file, an ask with every context item resolves. `open-editor` on a reference records exactly `[<real path>, <line>]` in the recorder's file. Started without `CLAUDE_PROJECT_DIR`, every pointer is `no-root` even with the working directory holding the file. Wire `session-process.ts` (design decision 5, Composition). Verify that the tests pass, that no recorder process is left running, and that the shipped bundle's composition passes `editorCommand: () => undefined`, checked by a test on the built entry.

## 6. View and the board page

- [ ] 6.1 Write tests first: a real build lists the component chunk `context` registering `excerpt`, `reference` and `image`, needing `react` and `shell`, with no `import.meta`; `selectChunks` inlines it only for a board holding one of the three types. Write the chunk entry, rendering each item's text and reporting ready. Record the sizes with `bun run build:view --record-sizes`. Verify that the tests pass, that `bun run build:view` passes its size check, and record the chunk's size in the note.
- [ ] 6.2 Write the browser scenarios first, on the widget host (with `update()` and `colorScheme` if task 0.2 found them, else the light scheme only, said in the note), and see them fail against 6.1's chunk:
  - an excerpt's caption and numbered body (lines 40 to 52);
  - a long excerpt capped and scrolling inside;
  - Markdown soft-wrapping and code scrolling sideways;
  - markup in text, title, pointer and alt shown as text with no added element;
  - U+202E shown as a marker;
  - "Unresolved" with the pointer;
  - a reference's label, path and hint, the external mark only on GITHUB and WEB;
  - an image shown from a `blob:` URL with its alt and `ready` only after decode;
  - no network request.

  Implement the three components (design decision 6). Verify that the scenarios pass in the three engines with no CSP violation.
- [ ] 6.3 Write the browser scenarios first for the question card:
  - split with a resolved excerpt, and with a written one;
  - full width with every excerpt unresolved, the pointer and references inline;
  - a widget spanning both columns below;
  - "Beside | Inline" moving the context and surviving a reload and a takeover through the draft record;
  - placement alone arming no leave-page prompt and copying nothing;
  - a single-question board still splitting.

  Implement the split and the placement. Verify that the scenarios pass in the three engines and that E1's, E3's and the seams' browser scenarios pass unchanged.
- [ ] 6.4 Write the browser scenarios first for the Snapshot look (view spec, "Context in a Snapshot view"), booting the view from an `askboard-data` block with no parent host. A FILE reference shows its path and "not available in a Snapshot" and opens nothing; "Open in reading panel" is hidden; a web reference is a link with `target="_blank"` and `rel="noopener noreferrer"`. Implement the `hosted` context. Verify that the scenarios pass in the three engines.
- [ ] 6.5 Write tests first for `open-reference`, a view message appended to `view-protocol.ts`, and the board page's handling of it. A web reference of the board document opens through `window.open` with `noopener,noreferrer` and http or https only; a message naming an image, an unknown item or a reference whose URL changed in a later revision opens nothing. Browser scenarios check, in each engine, that one click opens the new tab and that the new page's `window.opener` is null. Implement. Verify that the tests and scenarios pass in the three engines, or record for the PO which engine blocks the popup and the fallback (design, Risks).
- [ ] 6.6 Write the browser scenarios first for the reading panel against the test server's fixture source view and then the real session process target:
  - it opens from a FILE reference and from an excerpt's "Open in reading panel" as a side sheet between the reported insets;
  - the frame carries `sandbox=""` and `referrerpolicy="no-referrer"`, and line 40 is at the top with 40 to 52 marked;
  - "Changed since the agent asked" shows after the file's range is edited;
  - the missing, outside, binary and too-large states each show their line and the path;
  - "Open in editor" is disabled with "No editor set";
  - Esc on the header and ✕ close it, with focus back on the reference;
  - moved and discarded close it, and closed keeps it;
  - the source view framed from `http://localhost:<port>` is refused.

  Implement `reading-panel.ts` and `reading-panel-closed`. Verify that the scenarios pass in the three engines with no CSP violation from the board page, the view or the source view.

## 7. End to end on the real session process

- [ ] 7.1 Write the conformance scenario first, appended to `conformance.e2e.ts` as one `describe`, and see it fail before group 5's wiring is in the bundle. A session started with `CLAUDE_PROJECT_DIR` set to its throwaway project, which holds `docs/adr/0012-payment-retries.md` with a `## Decision` heading, `.askboard/media/shot.png` and `src/retry.ts`. The agent asks one question with:
  - the approved UJ-1 excerpt pointer;
  - an agent-written excerpt;
  - the image;
  - a FILE reference to `src/retry.ts#L1-L5`;
  - an excerpt pointing at `docs/missing.md#Intro`.

  Then the scenario checks, in order:
  - the result succeeds with exactly one `unresolved-pointer` warning, for the missing file, with reason `not-found`;
  - the real board in Chromium shows the question split, both excerpts, the image and the reference, and the missing pointer as "Unresolved";
  - the reading panel opens `src/retry.ts` at line 1;
  - the user answers, and `collect` returns the answer;
  - `fetch` of the question holds no excerpt text or image bytes.

  Verify that the scenario passes with the conformance suite on Bun and on Node 24.
- [ ] 7.2 Write the same ask as a browser scenario on the session-process target (`--target session-process`), and see it fail first. The board shows every item; the reading panel opens at the anchor; the unresolved pointer leaves "Answer" usable. Verify that it passes in Chromium, Firefox and WebKit, and that `bun run test:e2e` passes whole.

## 8. Security review

- [ ] 8.1 Run the `security-review` skill on the branch's diff against `main`, and an independent review by the `pr-review-toolkit:code-reviewer` agent briefed only with the diff and the board-host spec. Each covers confinement, the source view, the reading panel's frame, the open-link path, the editor launch and agent content as data. Fix every critical and high finding, tests first; record medium ones fixed or answered. Verify that no critical or high finding is open, that each fix has a test that failed before it, and list in the note every finding with its outcome, including the residual races and the hard-link case of design.md's Risks.

## 9. Records and final checks

- [ ] 9.1 For each block of `spine-update-draft.md` and `ux-update-draft.md` whose open question the PO answered as proposed, apply it to `docs/` word for word. Set the spine's `updated:` and add a `sources` line for this change. Mark each block applied, with the date; leave a block whose question was reversed unapplied, saying why. Verify with a grep that each applied block's replacement text stands in its document and its current text no longer does.
- [ ] 9.2 Check that the proposal's open questions, design.md's Merge points and Handed on, and the notes describe what was built; where the apply changed a choice, revise the artifacts with `/opsx:update` and say so under the question. Verify that `openspec validate excerpts --strict` passes.
- [ ] 9.3 Run `openspec validate --all --strict --no-interactive`, `bun run format` (no file changed), the check, `bun run build:view` with the recorded sizes, the browser suite in the three engines twice in a row, and the conformance suite on Bun and Node 24. Verify that all pass, that no process started by the tests is still running, and record in the note the test counts, the coverage, the `context` chunk's size and each engine's result.

## Workflow follow-up

- Open the pull request once group 9 passes; the integration session merges it after E3 and E4, and re-records `chunk-sizes.json` after the merge.
- Archive the change with `/opsx:archive` only after E1, `ask-lifecycle`, `push-delivery` and `widget-answers` are archived, since its deltas build on their requirements.
- Start the excerpt-per-work-package follow-up (proposal, A12) once `tree-widget`, `molecules` and `widget-answers` have merged.
