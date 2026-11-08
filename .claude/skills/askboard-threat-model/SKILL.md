---
name: askboard-threat-model
description: AskBoard's threat model for reviewing the diff range of an OpenSpec change for security and invariants - for each threat area the rule (NFR-3, NFR-4, NFR-5, NFR-9, NFR-10, AD-8, AD-10, AD-11, AD-12, AD-14, AD-19), where the defences live under packages/, the defects this project has actually shipped and fixed, and a cheap probe. Use it whenever an AskBoard change, task group, fix range or pull request is reviewed for security - tokens, fail-closed answers, bounds, prototype keys, ReDoS, session-folder races, the local API, the mod and hooks, the view sandbox, outbound traffic, licences - and when deciding whether a finding is new or already deferred. Not for generic security questions or code outside this repository.
---

# AskBoard threat model

What to look for in an AskBoard diff, and where. Pinning the target, refuting a candidate, rating it
(H, M, L) and the report format are in `askboard-review-protocol`; the invariants in one line each
are in CLAUDE.md. When a finding turns on wording, quote the binding text: the NFRs in
`docs/prd-askboard-2026-10-25/prd.md`, the ADs in the spine, the security model and the adoption
rule in `docs/prd-askboard-2026-10-25/addendum.md`.

Paths are under `packages/`, except `tools/` and `hooks/hooks.json` at the repository root. Short
paths (`board-host/`, `local-api/`, `excerpts/`, `snapshot/`, `notifier/`, `config-files.ts`) are
under `packages/server/src/`, and their tests under `packages/server/test/`.

## 1. Scope and triage

You get a pinned worktree `<wt>`, a range `<base>..<head>` and a change id. Review the range and what
its code reaches: callers and callees of each changed function, the schemas and constants it uses,
the tests that claim to cover it. An old defect the range reaches is in scope; untouched code is not.
List the paths (`git -C <wt> diff --stat <base>..<head>`), map them to areas, then read the change's
`design.md` (Risks / Trade-offs) and `tasks.md` notes for what it already accepted.

| Paths in the range | Areas |
|---|---|
| `server/src/board-host/` outside `local-api/` | 3.1, 3.2, 3.4, 3.8 |
| `board-host/local-api/`, `contract/src/push/` | 3.2, 3.6, 3.9, 3.11 |
| `server/src/excerpts/`, `snapshot/`, `config-files.ts`, `push-composition.ts` | 3.6, 3.11 |
| `contract/src/` schemas, validators, limits; `core/src/` | 3.3, 3.4, 3.5 |
| `compute/src/`, `contract/src/formula/` | 3.4, 3.5 |
| `view/src/`, `widgets/src/`, `tools/build/` | 3.1, 3.4, 3.8 |
| `mod/src/`, `hooks/src/`, `hooks/hooks.json` | 3.3, 3.9 |
| `server/src/notifier/`, `board-host/editor.ts`, `identity.ts`, `local-api/origin.ts` | 3.8 |
| `package.json` files, `bun.lock`, `tools/check-licences.ts`, `tools/licence-*.json` | 3.10 |
| any regular expression | 3.7 |

The adversaries are research risk R6's (addendum, security model): an agent sending hostile content
through the tools or writing project files; another web page on the machine reaching the board (DNS
rebinding, CSRF); another local process or user reading answers or racing the session folder.

## 2. Probing cheaply

- **Added lines:** `git -C <wt> diff -U0 <base>..<head> -- packages tools hooks | grep -E '^\+' |
  grep -nE '<pattern>'` with each area's pattern; read every hit in context.
- **Focused tests:** `cd <wt> && bun test <files>`. A weakened defence often still passes its old
  test: check that the test asserts the property, not a happy path.
- **Throwaway scripts** in a `mktemp -d` folder, never the worktree, import the worktree's source by
  absolute path (its `@askboard/*` imports resolve from the worktree), and run under `timeout`:

  ```sh
  P=$(mktemp -d); cat > "$P/probe.ts" <<'EOF'
  import { REFERENCE_PATTERNS } from "<wt>/packages/contract/src/push/references.ts";
  const t = performance.now(); REFERENCE_PATTERNS.pointer.test("a/".repeat(50_000) + String.fromCharCode(0x2028));
  console.log(`${(performance.now() - t).toFixed(1)} ms`);
  EOF
  timeout 60 bun "$P/probe.ts"; rm -rf "$P"
  ```
- **Browser and conformance runs** need `bun run build`, which writes `dist/` and
  `hooks/askboard-mod.js`: run them only when the caller allows it, else name the confirming scenario.

## 3. Threat areas

Each area: the rule, where the defence lives, what went wrong before, what to look for, and a probe
(a pattern for added lines; tests). `references/history.md` catalogues every past finding by area,
with its ID, PR, severity, file, how it was found and its fix or status: when a candidate resembles
an entry, the fix that worked there is usually the fix task to propose.

### 3.1 Token secrecy (NFR-4, AD-11, AD-8)

- **Rule:** a random token of 128 bits or more per board, in the URL of the board page and source
  view only, else in a header or the first WebSocket message; no cookies; `Referrer-Policy:
  no-referrer`; the view holds no token; diagnostics print none; board and session tokens never open
  each other's channel.
- **Where:** `board-host/tokens.ts` (constant time), `board-host/http.ts`, `tools/build/board-page.ts`
  (`<base href="/">`), `boardPagePolicy` (`contract/src/hash.ts`), `view/src/frame-transport.ts`.
- **Went wrong:** the view's `document.baseURI` held `?t=` in all three engines; a transport logged
  every board message to the console (both #8).
- **Look for:** a new page or frame on the board origin; a board URL in a log, error, notice, tool
  result or Snapshot; a token compared with `===`; one credential accepted on two channels.
- **Probe:** `token|[?&]t=|baseURI|referrer|location\.|console\.|stderr`; `server/test/board-host/requests.test.ts`,
  `contract/test/policy.test.ts`; in a browser run, `expectNoTokenInView` and `expectNoCspProblem`.

### 3.2 Network surface, no outbound traffic (NFR-3, NFR-9, AD-11)

- **Rule:** bind `127.0.0.1` (a container interface only on opt-in); `Host` a loopback name; `Origin`,
  if present, `http://` plus `Host`, and required on upgrades and non-GET/HEAD; the local API is a
  Unix socket refusing any `Origin`; no outbound connection but the launcher's pinned, hash-checked
  fetch; hooks never fetch.
- **Where:** `board-host/listener.ts`, `gate.ts`, `local-api/http.ts`, `bench/src/answerer/board.ts`.
- **Went wrong:** a target `new URL` cannot parse (`/\[`) threw in the `upgrade` event, which could end
  the process (#8); the benchmark answerer followed any board link (#10).
- **Look for:** another listen host; a route skipping the gate or token; a change an `Origin`-less
  request can make; `fetch`, `http.request`, `net.connect`, `WebSocket` to anything but the session's
  own port or socket; a URL from agent content fetched instead of shown as a link.
- **Probe:** `listen\(|0\.0\.0\.0|fetch\(|request\(|connect\(|WebSocket\(|https?://`;
  `server/test/board-host/requests.test.ts`, `listener.test.ts`, `local-api/`.

### 3.3 Fail closed (NFR-10, AD-10, AD-20)

- **Rule:** answers only from an explicit user act; nothing chosen by default; untouched review
  content reported unchanged; an ask unknown to the epoch is `discarded`, never "no answer yet"; a
  board command reaches the agent whole or not at all; a check that cannot decide refuses.
- **Where:** `contract/src/compiled.ts`, `core/src/lifecycle/`, `core/src/graph-check.ts`,
  `local-api/stop-block.ts`, `local-api/poll.ts`, `mod/src/carried.ts`.
- **Went wrong:** `schemaErrors` passed a value whose only error was an `if` (#13); a lazy `IF` let a
  refused formula yield a number (#9); `derived` travelled without `values` (#18); a delivery reported
  before carried, a poll cut inside a command (#23); an `update` with a molecule reference in a
  question's items throws at `core/src/context/board-props.ts:52` (#32, open).
- **Look for:** a `catch` returning success, a default or no errors; `?? true`, `|| []` on a check; a
  filter over validation errors; a state a `collect`, `fetch` or poll reads as "not yet"; a widget
  seeded with the recommended value; an act written in parts; a throw where a refusal belongs.
- **Probe:** `catch|\?\? *(true|\[\])|\|\| *(true|\[\])|recommended|default`; `contract/test/compiled.test.ts`,
  `core/test/graph-check-closed.test.ts`, `core/test/owner-checks.test.ts`, `local-api/stop-block.test.ts`;
  a new schema must fail a value faulty only inside an `if` or `oneOf` branch.

### 3.4 Bounds (AD-2, AD-7, AD-13, NFR-2)

- **Rule:** every input from an agent, page, file or peer has a limit in `contract` (`limits.ts`,
  `lifecycle-limits.ts`, `context/limits.ts`, `formula/limits.ts`), checked before work that grows
  with it. One session process serves every agent of a session: one stall stops every ask.
- **Where:** `board-host/boards.ts` (pre-connect, send-buffer, connect-timeout and waiting-socket
  limits), `local-api/http.ts`, `excerpts/open.ts`, `widgets/src/gantt/model/scale.ts`.
- **Went wrong:** a tokenless 6 MB message, schema-checked before its type, stalled the host 37 s
  (#13, HIGH); an unread socket buffer reached 18.9 MB (#8); a loop past 2^53 never ended, 2,912,138
  axis ticks (#18); an 8 KB formula took 2.1 GB (#9); a stop block not bounded by 1 MiB (#23).
- **Look for:** a loop stepping by an input number; work over a span or list before its size check;
  parsing before the size or token check; a wait or timer with no end; recursion over agent JSON; a
  map that only grows; a result that can pass 1 MiB or 30,000 characters.
- **Probe:** `while *\(|for *\(;;|setTimeout|setInterval|new Promise|\.repeat\(|JSON\.parse`; a script
  feeding the limit plus one, 2^53, `"1e400"`, `9999-12-31` and a 4 MiB string, timed.

### 3.5 Untrusted input: keys, agent JSON, formulas (NFR-5, AD-7, AD-13)

- **Rule:** input passes the contract's schemas and is read by own property only; no ID or text is
  pasted into formula, path, pattern or markup; formulas pass grammar, whitelist and limits before any
  engine; a molecule carrying code is refused.
- **Where:** `contract/src/validate.ts`, `contract/src/formula/`, `compute/src/formula/`,
  `contract/src/molecules/`, `view/src/view-protocol.ts`.
- **Went wrong:** a task ID `__proto__` lost its data in plain-object maps (#18); an ID
  `t1.ef]+100+[p.t1` pasted into formula text, `"1e400"` read as Infinity (#9); added molecule IDs not
  checked against question and area IDs (#32, `core/src/lifecycle/widget-update.ts:96`, open).
- **Look for:** `obj[key] =` or `key in obj` on a `{}` keyed by input (use `Map`, `Object.hasOwn`,
  entries); numbers without `Number.isFinite`; an ID namespace checked against part of itself.
- **Probe:** `\] *= |\bin [A-Za-z_.]+\)|Object\.assign|Record<string|new RegExp\(`; feed the IDs
  `__proto__`, `constructor`, `toString` and IDs holding `]`, `+`, `/`, `..`.

### 3.6 File system (AD-5, AD-11, AD-12, AD-14)

- **Rule:** session folder the user's, 0700; socket and session file 0600, set explicitly; the mod
  trusts the file only after checking owner and mode; pointers resolve read-only inside the root,
  never through `..` or a link out, and never tell whether an outside file exists; writes go to a
  temporary name and a rename; the project root is the real path of an absolute `CLAUDE_PROJECT_DIR`.
- **Where:** `contract/src/push/session-folder.ts`, `local-api/session-file.ts`, `mod/src/locate.ts`,
  `server/src/excerpts/`, `config-files.ts`, `snapshot/`, `push-composition.ts`, `local-api/origin.ts`.
- **Went wrong:** R2, a folder swapped for a link between `realpath` and `open`; L1, an existence leak
  (#28); H2, the mod trusted an unchecked session file; starters raced for one file; H1, git honoured
  `GIT_DIR` (#23); F1, a relative `CLAUDE_PROJECT_DIR`; F4, a write through a dangling link (#31).
- **Look for:** a check on a path, then a use of the path (check the handle: `fstat`, `O_NOFOLLOW_ANY`
  on macOS, `/proc/self/fd` on Linux); a mode left to the umask; reasons differing for outside files
  that exist and not; a blocking open of a FIFO; a root from agent text; children inheriting `GIT_*`.
- **Probe:** `realpath|lstat|stat\(|open\(|rename|link\(|unlink|chmod|mkdir|writeFile|O_[A-Z]`;
  `server/test/excerpts/`, `server/test/board-host/local-api/`, `server/test/config-*.test.ts`,
  `server/test/snapshot/`, `mod/test/start.test.ts`; swap hooks as in `excerpts/open.test.ts`.

### 3.7 Regular expressions (ReDoS)

- **Rule:** a pattern on agent, file or page text runs in linear time, on the session process's event
  loop or the board page. **Where:** `excerpts/anchor.ts`, `contract/src/push/references.ts`.
- **Went wrong:** R1, heading and fence patterns backtracked quadratically on runs of blanks or
  backticks ending in U+2028: hours for a 4 MiB line (#28, high).
- **Look for:** nested or adjacent quantifiers over overlapping classes (`(\s*)*`, `\s*[ \t]*`,
  `.*.*`); a quantified run before a token that fails late; `new RegExp` from input.
- **Probe:** `new RegExp|\.(test|exec|match|matchAll|replace|split|search)\(`; time each new pattern
  as in §2 on 100,000-character runs of its repeated class ending in `!` and in U+2028.

### 3.8 Agent content is data; process launches (NFR-5, AD-8)

- **Rule:** agent content renders as text and data only; scripts only from AskBoard's bundle; the
  view's iframe exactly `sandbox="allow-scripts"` under a hash-only CSP, never `'unsafe-*'`; links
  only `http:` and `https:`, `noopener noreferrer`; OS commands as argument vectors, never a shell;
  `editor` only from the user file, on a click, with the confined real path.
- **Where:** `view/src/board-page/page-chrome.ts`, `reading-panel.ts`, `view/src/assemble/index.ts`,
  `board-host/source-view.ts`, `view/src/catalog/context/marks.ts`, `board-host/editor.ts`, `notifier/`.
- **Went wrong:** bidirectional controls shown unmarked; an editor could open a non-text file by
  association (both #28); Firefox runs a relative `<script src>` from `file://` (renderer spike F42).
- **Look for:** `innerHTML`, `eval`, `new Function`, `on…` attributes, a script element with `src`; a
  sandbox token or CSP source added; a style attribute instead of the CSSOM; a project-level `editor`
  reaching a launch; untruncated agent text in an argument vector.
- **Probe:** `innerHTML|dangerouslySetInnerHTML|eval\(|new Function|sandbox|unsafe-|spawn|execFile|shell:`;
  `contract/test/policy.test.ts`, `server/test/board-host/source-view.test.ts`, `editor.test.ts`,
  `core/test/config-editor.test.ts`, `server/test/notifier/`.

### 3.9 The mod and the hooks (AD-4, AD-10, AD-11, AD-19)

- **Rule:** a hook that cannot reach the session process exits 0 with no decision and one stderr
  line, within 5 s; the SubagentStop guard blocks only while an owned ask holds events above
  `received` and `stop_hook_active` is false, never twice for one event; the built mod has no
  `import`, `require` or `import.meta`, and talks only to the local API, after `isPrivate`.
- **Where:** `hooks/src/` (`failure.ts`, `input.ts`, `subagent-stop.ts`), `mod/src/` (`locate.ts`,
  `poll.ts`, `transport.ts`, `carried.ts`), `tools/build/mod.ts`.
- **Went wrong:** H2 (3.6); a delivery reported before carried (#23); G1, an in-process teammate's
  idle stop closed its asks, so its answer never reached it (#24).
- **Look for:** a hook that blocks when AskBoard is down; hook input used before validation; a route
  without the session token or accepting `Origin`; a stop decision that repeats or blocks on a closed
  ask; the session file's contents used before the private check.
- **Probe:** `hooks/test/`, `mod/test/`; conformance (`server/test/conformance/run.ts`) needs a build.

### 3.10 Dependencies and licences (NFR-6, AD-19, adoption rule)

- **Rule:** every component meets the adoption rule (licence, stars or a named exception, activity,
  not archived), pinned exactly; no AGPL or GPL shipped; exceptions only through a PRD change;
  `tools/licence-overrides.json` and `tools/licence-texts.json` never admit a licence.
- **Look for:** `^` or `~`; a dependency reaching a shipped chunk; a JSON entry without evidence; a
  component on the addendum's Avoid list; one that phones home or evaluates code.
- **Probe:** `git -C <wt> diff <base>..<head> -- '*package.json' bun.lock 'tools/licence-*.json'`;
  `bun run check:licences` reaches the npm registry and GitHub: leave it to the caller or CI.

### 3.11 Cross-session state and ownership (NFR-2, AD-5, AD-14)

- **Rule:** shared files are written atomically by their owner without losing another session's
  write; a Snapshot never replaces a file; an agent reads and changes only the asks it owns.
- **Where:** `local-api/session-file.ts`, `config-files.ts`, `snapshot/name.ts`, `ownerRefusal` in
  `core/src/core.ts`. **Went wrong:** two starters under one key (#23); F2, a lost update (#31).
- **Look for:** read-modify-write without a lock or compare; a name another session can reuse; a
  file removed while another process holds it; a tool path without the owner check.
- **Probe:** `local-api/session-file.test.ts`, `core/test/owner-checks.test.ts`; run the new write
  twice at once from a script.

## 4. Deferred and accepted

Report these only when the range makes them worse, and say how; `references/history.md` lists each
with where it is recorded. Bun's `maxPayloadLength` before `connect` (E11); E8's F2 and F3
(`writableByOthers` checks no ancestor folder); E5's residual races and hard-link read; E4's merge
points and accepted risks; the Gantt's five LOWs and far-future chart width (#18). Open, not
deferred: #32's two review comments; when the range touches `board-props.ts` or `widget-update.ts`,
say whether it fixes them. Each change accepts risks of its own in its `design.md` and `tasks.md`.
Since 2026-11-08 a deferred finding is also an Issue labelled `source:review`: search them before
reporting (`askboard-review-protocol`, section 3).
