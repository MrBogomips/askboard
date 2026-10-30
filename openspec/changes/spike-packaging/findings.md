# Findings: packaging spike

The exit criteria are SOLUTION-DESIGN §10.4's thirteen, plus criteria 14 to 16 that the mod delivery spike added (proposal.md). The approach is in `design.md`. Raw runs stay in `probe/runs/`, which git ignores; the summaries every verdict rests on are in `evidence/`, and this file quotes them. No token, credential or session ID is recorded.

## Verdicts

One row per exit criterion. Verdicts: **pass** (holds as the design assumed), **pass with change** (holds once a rule or path changes, named in the proposed outcomes), **fail**, **untested** (with the reason) and **awaiting PO** (a run only the product owner can make). Every cell names its run.

| # | Criterion | macOS | Linux | Claude Code run | Verdict | Section |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Executable size per target | darwin-arm64 90.0 MB raw, 40.7 MB gzip; darwin-x64 99.0 and 43.3 (`bun run build`, `dist/manifest.json`); runs (`smoke`), and under Rosetta | linux 102.4 to 110.0 MB raw, 47.6 to 51.6 MB gzip; runs on glibc arm64 and x64 (emulated); musl runs only with `libstdc++` and `libgcc` (`linux-targets2`) | — | pass on macOS and glibc; pass with change on musl (row 3) | § Criterion 1 |
| 2 | Cold start within `MCP_TIMEOUT`, or the fetch moved out | always answered within the 25 s budget; the first fetch completes from about 31 Mbit/s (`cold`, `smoke`) | 498 to 695 ms on a local mirror, arm64 (`linux-targets2`) | `p-cold2`: connected in 17.4 s at 50 Mbit/s with a 300 ms first-byte delay | pass with change (row 1) | § Criterion 2 |
| 3 | Plugin `command` source compared with the launcher | — | — | `p-cmdsrc` and its CLI install: install prompt, 0.98 s install, no fetch at session start (`claude mcp list`); the once-per-session background re-run not observed | compared, launcher recommended (row 1); the background re-run: awaiting PO (task 7.5) | § Criterion 3 |
| 4 | Temporary-name download and rename under a lock, with concurrent sessions and the probe sibling | 9 launchers at once: 1 download, every SHA-256 right; SIGKILL and SIGTERM recovered (`concurrency`, `budget`) | one download per container, no partial file (`linux-targets2`) | — | pass with change (row 1) | § Criterion 4 |
| 5 | Offline installation | server down: `unavailable` in 52 ms; pre-seeded cache, HTTP and `file://` mirror and the Node bundle all start (`offline`) | — | — | pass with change (row 6) | § Criterion 5 |
| 6 | tinycc present or absent in the compiled output | present in both darwin targets, as in the `bun:ffi` control (`strings`) | present in all four linux targets | — | pass: present everywhere (row 7) | § Criterion 6 |
| 7 | The `oven-sh/WebKit` commit Bun 1.4.4 pins, and the relink steps | `d6375c72affe0f70222cdcb45012b10f0bf3a9d5`; relink from the plain bundle exercised (`bun build askboard.mjs --compile`) | — | — | pass (row 7) | § Criterion 7 |
| 8 | Devcontainers: opt-in binding, published port, host-side address in links | — | opt-in reached from the host (200), default unreachable, stderr warning; another host port breaks the printed link (`linux-devcontainer`) | — | pass with change (row 8) | § Criterion 8 |
| 9 | WSL: the three FR-23 notices and `$BROWSER` | — | untested: no Windows machine | — | awaiting PO (task 7.1) | § Criterion 9 |
| 10 | CI runners | — | Ubuntu 24.04 with `CI` and `GITHUB_ACTIONS`: launcher 305 ms, `ask` returns `unavailable` (`linux-ci-sim`) | — | pass for the stand-in; a hosted runner: awaiting PO (task 7.3) | § Criterion 10 |
| 11 | Native Windows: how the user sees the message naming WSL | `uname` shims for MINGW64, MSYS and CYGWIN: the WSL message in 32 to 38 ms (`windows-sim`) | — | — | pass, simulated (row 11); the real run: awaiting PO (task 7.2) | § Criterion 11 |
| 12 | "No reachable browser" detected per platform | `open`, `SSH_CONNECTION`, `CODESPACES`, `CI`, `BROWSER` rows (`linux-detect`, macOS part) | container, opt-in, `xdg-open` with and without `DISPLAY`, `wslview`, CI rows (`linux-detect`) | — | pass (row 9) | § Criterion 12 |
| 13 | A background board tab not discarded after an hour [F33] | no disconnect, freeze or discard in 65 minutes; hidden Chrome runs timers once a minute (`tab-hour`, `tab-drop`, `tab-forced`) | — | — | pass for the engines covered (row 10); branded Chrome with Memory Saver and Safari: awaiting PO (task 7.4) | § Criterion 13 |
| 14 | A failed start reaches the user without Claude Code caching it | the answering launcher answers every fault, the control exits (`failures`, `failures-fix`) | Debian slim without curl or wget: answered in 64 ms (`linux-targets2`) | exiting launcher cached, next session never spawned it (`p-fail-exit`, `p-fail-exit-next`); answering launcher: no cache entry, next session connected (`p-fail-answer`, `p-fail-answer-next`) | pass with change (row 2); what the model sees: awaiting PO (task 7.5) | § Criterion 14 |
| 15 | The launcher keeps Claude Code as the parent of the session process and of each hook | parent PID is the client's, cold, warm and in all nine concurrent starts (`parent`, `concurrency`) | — | `p-cold2`: the server's PPID is the `claude` process | pass | § Criterion 15 |
| 16 | What uninstalling the plugin leaves | — | — | `p-uninstall`: the data folder, with the executable cache, is deleted; `--keep-data` keeps it; the plugin cache stays | fail as AD-22 states it; pass with change (row 5) | § Criterion 16 |

## Failures and consequences

### Slow links never install at session start (criterion 2)

The launcher answers within `MCP_TIMEOUT` on every path, because it stops the download at 25 s and answers `unavailable`. The first fetch itself completes only from about 31 Mbit/s effective for the 90 MB darwin-arm64 executable, and about 37 Mbit/s for the 110 MB glibc ones (`cold`). Below that, each session gives up at 25 s and the next one starts again from zero, so AskBoard never installs. Row 1 proposes a detached download that outlives the budget, and gzip assets that halve the size.

### An exiting launcher's failure is cached (criterion 14)

When the launcher exits on a failure, Claude Code writes an entry to `mcp-needs-auth-cache.json`, and the next session does not even spawn the server, although the release server was back (`p-fail-exit`, `p-fail-exit-next`). Only `/mcp` Reconnect cleared it. A launcher that answers the handshake leaves no entry, and the next session fetched and connected in 1.2 s (`p-fail-answer`, `p-fail-answer-next`). Row 2.

### Uninstalling deletes the executable cache (criterion 16)

AD-22 and §8 say uninstalling leaves the executable cache. Claude Code deletes `${CLAUDE_PLUGIN_DATA}`, and the cache inside it, on the last uninstall unless `--keep-data` (`p-uninstall`, docs D10). Row 5.

### `${CLAUDE_PLUGIN_DATA}` is not substituted under `--plugin-dir` (criterion 2)

In every `--plugin-dir` run the server received the literal text `${CLAUDE_PLUGIN_DATA}`. The launcher took it as a relative path and cached the 86 MB executable inside the project, in a folder of that name (`p-cold2`). An installed plugin gets the real path (`p-cmdsrc`). CI runs `claude -p --plugin-dir` (§8). Row 4.

### Missing prerequisites (criteria 1, 5 and 14)

- Bun's musl executables need `libstdc++` and `libgcc`, which Alpine 3.22 does not install; Claude Code's own setup page already requires both there (`linux-targets2`).
- Debian slim has neither curl nor wget; the launcher first reported "could not download" for it, and now names the missing tool (`failures-fix`).
- AD-22's "POSIX `sh` and `curl` or `wget`" leaves out the SHA-256 tool (`sha256sum`, `shasum` or `openssl`), which POSIX does not specify (`failures-fix`).

Row 3.

### The devcontainer link needs a port (criterion 8)

The printed link works only when the host port equals the container port. With `-p 127.0.0.1:47851:47850` it fails, and `-p 47852:47850` publishes on every host interface, which AD-11 forbids (`linux-devcontainer`). Row 8.

### Hidden Chrome tabs run timers once a minute (criterion 13)

No engine dropped the board in an hour, but hidden Chrome runs a repeating timer only every 60 s from about one minute after the tab is hidden (`tab-hour`). A board heartbeat that the session process waits for must allow more than 60 s. A forced discard closes the socket, and the tab reloads only when the user returns (`tab-forced`). Row 10.

### Windows without a POSIX `sh` (criterion 11)

Claude Code on Windows runs hooks through PowerShell when Git Bash is missing, and command sources through `cmd.exe` (docs D2, D16). Without a POSIX `sh`, nothing runs the launcher, so the WSL message cannot come from it alone. Row 11.

### The isolated configuration made no model calls (criteria 2, 3 and 14)

`claude auth status` reported a login in the isolated configuration, but its credential had expired with no refresh token, and the headless run `p-cold` stopped on "Login expired". The other runs were interactive sessions with no prompt sent: they show MCP start-up, `/mcp` and the files Claude Code writes, not a model calling the tool. Task 7.5 repeats them with a model after a login.

### The minified build is not smaller

`--minify` saves 0.4 MB of 90 to 110 MB: an empty program compiles to 89.2 MB (darwin-arm64), so the Bun runtime is the size (criterion 1). No row: the release builds plain.

## Delivery comparison

| | Launcher under `scripts/` (recommended, row 1) | `command` plugin source | Plain bundle on Node | `npm` or `archive` source |
| --- | --- | --- | --- | --- |
| Download per user | the executable for the user's target, once per version: 86 to 105 MiB raw, 41 to 52 MB as gzip assets | the same at install and update, plus the plugin repository | 0.43 MB inside the plugin | ruled out: `npm` never runs install scripts or installs per-platform packages at fetch (D7); one `archive` per entry, at most 256 MiB, while the six targets are 269 MiB gzip (D8) |
| When the fetch happens | the first session-process start, within a 25 s budget | install, update, and once per session in the background (documented; not observed) | never | — |
| Cold start | 1.1 s unthrottled, 17.0 s at 50 Mbit/s, `unavailable` at 25 s below about 31 to 37 Mbit/s; warm 53 ms (`cold`) | no fetch at session start; the server started from the plugin cache in about 2 s (`claude mcp list`, first exec) | warm 84 ms on Node 24.22.2 | — |
| Prompts | none beyond the plugin install | `Run this command now? [y/N]` at install; `--yes` in scripts; accepted again when the command changes | none | — |
| Offline | the cache works; a cold start offline answers `unavailable` in 52 ms; a pre-seeded cache or a mirror works (`offline`) | the installed copy works; install or update offline fails | works, with Node installed | — |
| Update | a new pin in `scripts/release.txt`, fetched at the next session start | the command re-runs at update; a changed hash installs a new version | ships with the plugin | — |
| Policy | none specific | `disableCommandPluginSources` turns it off | none | — |
| Windows | needs a POSIX `sh`; answers with the WSL message (simulated) | the command runs through `cmd.exe`; link mode refused | Node would run it; NFR-7 excludes native Windows | — |
| Hooks | the same launcher in hook mode, never fetching; exit 0 when the executable is missing | the hooks run the executable from the plugin cache | `node askboard.mjs hook <event>` | — |
| Disk | one executable per version in `${CLAUDE_PLUGIN_DATA}/bin/<version>/` | the plugin-cache copy plus the command's output (2 × 86 MB here) | 0.43 MB | — |
| Runs | `smoke`, `cold`, `concurrency`, `budget`, `offline`, `failures`, `failures-fix`, `parent`, `p-cold2`, `p-fail-*`, `linux-targets2` | `p-cmdsrc`, the CLI install and uninstall | `offline`, the warm-start run in `evidence/build-licence.md` | documentation only |

## Proposed outcomes (awaiting the PO)

Each row is a proposal until the PO records a decision. The replacement texts for each row are in `spine-update-draft.md`, beside this file; none applies before its row is accepted.

| # | Item | Evidence | Proposed decision | Alternative | PO decision |
| --- | --- | --- | --- | --- | --- |
| 1 | AD-19, AD-22: the delivery path | Criteria 2, 3, 4, 5 (`cold`, `concurrency`, `budget`, `offline`, `p-cold2`, `p-cmdsrc`; docs D1 to D8) | Keep the launcher under `scripts/` fetching the pinned executable from GitHub Releases: no install prompt, it works where `disableCommandPluginSources` is set, the same launcher runs hooks, and the plugin stays the plain GitHub-marketplace plugin of AD-19. Launcher rules: a `mkdir` lock with dead-owner recovery and removal of orphaned `.part` files; one 25 s budget for waiting and downloading, so the handshake is always answered within `MCP_TIMEOUT`; `exec` the executable. Because a first fetch completes in time only above about 31 Mbit/s (darwin-arm64, 90 MB) to 37 Mbit/s (linux, 110 MB), the first download continues detached (`nohup`) after the budget, holding the lock, and the launcher answers `unavailable` ("AskBoard is downloading; ready in a new session or after `/mcp` Reconnect"). Not measured: to verify in the packaging epic. Publish gzip assets beside the raw ones, and let the launcher prefer them when `gzip` is present (40.7 to 51.6 MB; not measured end to end). | A: the `command` plugin source: fetch at install (0.98 s locally), no 30 s limit (`timeout` up to 600 s), but an install prompt or `--yes`, a background re-run every session (not observed), off under `disableCommandPluginSources`, 86 MB copied into the plugin cache plus its own output, `cmd.exe` on Windows. AD-19 then names a command-sourced plugin, and AD-11's exception moves to install time. B: the plain bundle on Node only (no fetch, 0.43 MB, warm 84 ms); Node becomes a prerequisite. | |
| 2 | AD-22 (and AD-10): a failed start answers the handshake | Criterion 14 (`failures`, `failures-fix`, `p-fail-exit`, `p-fail-exit-next`, `p-fail-answer`, `p-fail-answer-next`; `mcp-needs-auth-cache.json`; docs D13) | The launcher never exits on a failure it can name (no download tool, no SHA-256 tool, fetch failed, checksum mismatch, unsupported platform, native Windows). It answers `initialize` with `instructions` stating the reason and one `ask` tool that returns `unavailable` with the reason, until stdin closes. This closes the mod delivery spike's proposed outcome row 16. Cost: `/mcp` shows AskBoard connected with 1 tool. | Exit non-zero and accept the cached failure (about 15 minutes): the user must use `/mcp` Reconnect or wait. | |
| 3 | AD-22: the launcher's prerequisites | Criteria 5 and 14 (`failures-fix`); Linux (`linux-targets2`: Alpine needs `libstdc++` and `libgcc`; Debian slim has neither curl nor wget; BusyBox `wget` and `sha256sum` work) | "POSIX `sh`, `curl` or `wget`, and one SHA-256 tool (`sha256sum`, `shasum` or `openssl`); on musl Linux, `libstdc++` and `libgcc`, which Claude Code also requires." The launcher checks them before taking the lock and names the missing one. | Keep "`sh` and `curl` or `wget`", and accept a wrong reason when no SHA-256 tool exists. | |
| 4 | AD-22: `${CLAUDE_PLUGIN_DATA}` for `--plugin-dir` plugins | `p-cold2` (the literal `${CLAUDE_PLUGIN_DATA}` reached the server; the executable was cached inside the project, in a folder of that name) | The launcher treats an unset, empty or unsubstituted value (`${…}`) as absent and falls back to `${XDG_CACHE_HOME:-$HOME/.cache}/askboard`. CI's `claude -p --plugin-dir` (§8) relies on it. | Refuse to start (answer `unavailable`) under `--plugin-dir`, which breaks CI. | |
| 5 | AD-22: uninstall deletes the executable cache | Criterion 16 (`p-uninstall`); docs D10 (X1) | AD-22 and §8 say uninstalling deletes `${CLAUDE_PLUGIN_DATA}`, and the executable cache with it, unless `--keep-data`; it still leaves `.askboard/` and the session-file folder. | Move the cache outside `${CLAUDE_PLUGIN_DATA}` (for example `~/.cache/askboard`) to keep the current sentence, leaving about 90 to 110 MB per version behind after uninstall. | |
| 6 | AD-22: offline installation | Criterion 5 (`offline`) | Document three offline paths, all checked: copy the executable into `${CLAUDE_PLUGIN_DATA}/bin/<version>/askboard`; a mirror setting (`ASKBOARD_RELEASE_URL`, `http` or `file://`, the checksum still checked); the plain bundle on Node 24.22.1 or later. Without one, the launcher answers `unavailable` in about 50 ms. | Only the Node bundle offline. | |
| 7 | AD-19, PRD NFR-6 and addendum (§11 entry 7): the licence exception, a PO decision | Criteria 6 and 7; adoption (`evidence/build-licence.md`, `evidence/adoption.json`) | The PO decides entry 7 on this evidence. The spike found nothing that blocks the obligations. tinycc is present on all six targets, so the exception names it without "if present", and the commits are named: `oven-sh/WebKit` at `d6375c72affe0f70222cdcb45012b10f0bf3a9d5`, `oven-sh/tinycc` at `05f0fafaa3be31e31d7b4b5c17dc60f62c991171`, with `WEBKIT_VERSION` now in `scripts/build/deps/webkit.ts`. The notices are Bun's whole `LICENSE.md` (about 50 libraries, none GPL-only). The relink path was exercised (`bun build askboard.mjs --compile`). | Refuse entry 7: the plain bundle on Node 24.22.1 or later stays the shipped form, as AD-19 already says. Or `deno compile` (MIT, passes the adoption rule; not built). | |
| 8 | AD-11 and AD-22: devcontainers | Criterion 8 (`linux-devcontainer`) | The opt-in binding and `-p 127.0.0.1:<port>:<port>` work (200 only with the opt-in; a warning on stderr). The host-side link setting carries host and port, because a different host port breaks the printed link. The devcontainer guide keeps the `127.0.0.1:` prefix: without it Docker publishes on every host interface, which AD-11 forbids. Open item: VS Code Dev Containers' `BROWSER` helper and port forwarding may make the opt-in unnecessary there (untested). | Require equal host and container ports, and keep a host-only setting. | |
| 9 | AD-18: the detection rule behind `unavailable` | Criteria 12 and 10 (`linux-detect`, its macOS rows, `linux-ci-sim`) | In order: a remote host (`SSH_CONNECTION`, `SSH_TTY`, `CODESPACES`) → `unavailable`; a container (`/.dockerenv`, `/run/.containerenv`, `REMOTE_CONTAINERS`, `DEVCONTAINER`) without the opt-in → `unavailable`, with it → the terminal link only; CI (`CI`, `GITHUB_ACTIONS`) without `BROWSER` → `unavailable`; otherwise an opener: `BROWSER`, `open` (macOS), `wslview` or `explorer.exe` (WSL), `xdg-open` with `DISPLAY` or `WAYLAND_DISPLAY` (Linux); none → `unavailable`. | Try to open, and treat a failed opener as `unavailable`: slower, and an opener can succeed with no visible browser. | |
| 10 | AD-21: background tabs | Criterion 13 (`tab-hour`, `tab-drop`, `tab-forced`) | No change to the grace rule: no engine discarded, froze or disconnected a hidden board in 65 minutes. Chrome runs a hidden tab's timers once per 60 s after about a minute, so liveness comes from the WebSocket close, and any board heartbeat timeout is at least 90 s. A forced discard closes the socket (1001) and the tab reloads only when activated, so a discarded tab's ask is discarded after the grace period, as AD-21 says. The branded-browser check (Memory Saver, Safari) awaits the PO. | Reopen AD-21 to keep asks across a discard (a longer grace period), weighed after the PO's check. | |
| 11 | SOLUTION-DESIGN §8 and AD-22: native Windows | Criterion 11 (`windows-sim`); docs D2, D16 (X8) | Where Claude Code on Windows can run the launcher through a POSIX `sh` (Git Bash, MSYS2, Cygwin), the launcher answers the handshake with the message naming WSL (32 to 38 ms, simulated). Without one, Claude Code reports that the server failed to start, the shipped skills fall back to AskUserQuestion (AD-18), and the README names WSL. The real run awaits the PO (task 7.2). | A `bun-windows-x64` stub executable that only answers with the WSL message; it needs a per-platform command, which a plugin `.mcp.json` cannot express. | |
| 12 | SOLUTION-DESIGN §13: facts | Criteria 1, 3, 6, 7, 13, 14, 16; docs D1 to D20 | Amend F23 (the `command`, `npm` and `archive` sources and their limits), F33 (checked: no discard in 65 minutes, Chrome's 60 s timer throttling) and F35 (tinycc present on every target; where `WEBKIT_VERSION` lives and its commit). Add F39 onwards: the failed-start cache for plugin servers and non-blocking MCP startup; `${CLAUDE_PLUGIN_DATA}` deleted on the last uninstall; not substituted under `--plugin-dir`; Alpine's runtime libraries; the executable sizes. | None: these are facts. | |
| 13 | Spine Deferred; SOLUTION-DESIGN §10.4, §11, §12 | All criteria | Close the Deferred rows "Bun packaging: …" and "Detecting 'no reachable browser' per platform" with the outcomes above, listing the PO runs still open (WSL, native Windows, a hosted runner, branded browsers, model runs). §10.4 gains an Outcome paragraph; §11 entry 7's status names this evidence; §12's "Architecture spikes" row drops the packaging items. | Keep the rows open until the PO runs (tasks 7.1 to 7.5) are done. | |

## NFR-6 evidence (for the PO, §11 entry 7)

From `evidence/build-licence.md`. The spike collects it; the PO decides.

- **What the exception would admit:** in every AskBoard executable, Bun 1.4.4's statically linked JavaScriptCore/WebKit (LGPL-2; WebCore files LGPL-2 and LGPL-2.1) from `oven-sh/WebKit` at `d6375c72affe0f70222cdcb45012b10f0bf3a9d5`, and tinycc (LGPL-2.1) from `oven-sh/tinycc` at `05f0fafaa3be31e31d7b4b5c17dc60f62c991171`, present on all six targets (criterion 6). AskBoard modifies neither: it adds only its JavaScript to Bun's runtime.
- **Relink path:** LGPL-2 asks that the user can relink with a modified library. Rebuild Bun with the modified WebKit (Bun's steps, criterion 7), then `bun build askboard.mjs --compile`. The second step was run with the stock Bun: the result answered `initialize` and listed `ask`. The path depends on Bun's build-from-source path staying public; a Bun build from source was not run.
- **What each release ships:** `COPYING.LIB` (LGPL-2) and the LGPL-2.1 text; Bun's `LICENSE.md` at `bun-v1.4.4` as the notices (about 50 statically linked libraries, all permissive or dual, among them `zstd` (BSD or GPLv2) and ICU 78; no GPL-only component listed); the exact Bun version, 1.4.4; links to `oven-sh/WebKit` and `oven-sh/tinycc` at those commits; the plain bundle `askboard.mjs` with the command that rebuilds the executable from it.
- **The adoption rule for the LGPL parts:** `oven-sh/WebKit` has 119 stars and `oven-sh/tinycc` 4, both under 1,000; both are forks the Bun team maintains. What §11 entry 7 requests is the licence exception, not a stars exception.
- **Alternatives with no exception:** the plain bundle on Node 24.22.1 or later (0.43 MB, warm start 84 ms on Node 24.22.2; Node must be installed); `deno compile` (Deno 2.9.8, MIT, passes the adoption rule; its executables embed V8, BSD-3-Clause; not built here).
- **AXFX NFR-1 (§11 entry 8):** decided in the planning repository; this evidence serves it unchanged.

**Adoption**, run date 2026-10-30 (`GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts` → `evidence/adoption.json`; rule: a permissive licence, at least 1,000 stars, a push within 6 months and a release within 12, not archived):

| Candidate | Licence | Stars | Last push | Last release | Verdict |
| --- | --- | --- | --- | --- | --- |
| Bun 1.4.4 (`oven-sh/bun`) | GitHub: NOASSERTION; the file: "Bun itself is MIT-licensed", with LGPL-2 JavaScriptCore and LGPL-2.1 tinycc statically linked | 96,468 | 2026-10-30 | 2026-10-22 | review: stars and activity pass; the licence needs §11 entry 7 |
| Node 24.22.1 (`nodejs/node`) | GitHub: NOASSERTION; the file: MIT, with bundled third-party notices | 123,097 | 2026-10-30 | 2026-10-29 | review: stars and activity pass; MIT; a host runtime, not bundled |
| Deno 2.9.8 (`denoland/deno`) | MIT | 108,771 | 2026-10-29 | 2026-10-21 | pass |
| `@modelcontextprotocol/server` 2.4.0 | Apache-2.0 | 13,685 | 2026-10-28 | 2026-10-23 | pass |
| `zod` 4.6.7 | MIT | 44,230 | 2026-10-29 | 2026-10-12 | pass |
| `playwright` 1.64.1 | Apache-2.0 | 98,860 | 2026-10-30 | 2026-10-14 | pass |

`check-licences` on the probe, from the repository root (`GITHUB_TOKEN=$(gh auth token) bun tools/check-licences.ts openspec/changes/spike-packaging/probe`, with `probe/tools/licence-overrides.json` holding `[]`):

```text
check:licences: 5 installed packages, 0 for other platforms read from the npm registry, 3 direct dependencies, archive step: checked, no problems
```

`git diff --exit-code origin/main -- package.json bun.lock packages/` at the repository root is empty, and `bun install --frozen-lockfile` passes in `probe/`.

## Method

- **Platform:** macOS 26 (Darwin 25.6.0, arm64), Bun 1.4.4, curl 8.7.1, Node 24.22.2 through Volta for the plain bundle. `/bin/sh` is bash in POSIX mode; the launcher also passes under `dash` (run `dash`).
- **Claude Code:** 2.1.314 installed. npm dist-tags on 2026-10-30: `stable` 2.1.308, `latest` 2.1.314, `next` 2.1.314. The declared minimum, 2.1.311, was not run here; the `command` source needs 2.1.229 or later, which is below it.
- **Isolated Claude Code configuration:** every Claude Code run used `CLAUDE_CONFIG_DIR=<scratch>/pkg/cc-config` and a throwaway git project, under `env -i` with only the variables the runs need. Its credential had expired, so no run called the model (§ Failures and consequences). The user's configuration was checked by SHA-256 before (11:37) and after (11:47): `settings.json`, `plugins/installed_plugins.json` and `plugins/known_marketplaces.json` unchanged, `mcp-needs-auth-cache.json` absent both times. Sessions: 7, that is 6 runs plus 1 retry (`p-cold` failed on the credential, `p-cold2` is its retry), in tmux sessions named `p-*`, all stopped.
- **Linux:** Docker Desktop engine 29.5.2 on arm64, `linux/amd64` under its emulation. Images pinned by index digest: `debian:12-slim` `sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3` (glibc), `alpine:3.22` `sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f` (musl), `ubuntu:24.04` `sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852` (CI stand-in). A scratch `DOCKER_CONFIG` held `{}`. Containers were named `p-pkg-*` and run with `--rm`; none is left.
- **Stand-ins:**
  - `probe/server.ts` is the session process: a stdio MCP server on `@modelcontextprotocol/server` 2.4.0 with one `ask` tool, plus `hook`, `doctor`, `detect` and `serve-board` commands. Its board listener binds `127.0.0.1`, or every interface with the opt-in.
  - `probe/build.ts` compiles it for six targets and bundles it for Node.
  - `probe/plugin/scripts/askboard` is the launcher (design decision 3).
  - `probe/release-server.ts` serves the executables as GitHub Releases would, on `127.0.0.1`, with throttling, a first-byte delay and faults. `linux/release-mirror.ts` does the same with a relative redirect for containers.
  - `probe/handshake.ts` spawns a command with stdio pipes, sends `initialize` and `tools/list`, and times the answers from spawn.
  - Nothing was published.
- **Browsers:** Playwright 1.64.1's Chromium, Firefox and WebKit, the installed Chrome 156.0.8078.79 and Firefox 124.0.2, all headless, with scratch profiles (`evidence/tab-hour.md`).
- **Verdict rule:** a criterion passes only on measured runs; documentation alone gives "untested" or "awaiting PO".
- **Times:** local time (CET, UTC+1) unless a quoted debug line ends in `Z`.

## Criterion 1: executable size per target

**Pass on macOS and glibc; pass with change on musl (row 3).** Build `bun run build` (`dist/manifest.json`), gzip at level 9:

| Target | Raw MB | Gzip MB |
| --- | --- | --- |
| `darwin-arm64` | 90.0 (85.8 MiB) | 40.7 |
| `darwin-x64` | 99.0 | 43.3 |
| `linux-x64` | 109.9 | 51.6 |
| `linux-arm64` | 110.0 | 51.4 |
| `linux-x64-musl` | 103.5 | 48.1 |
| `linux-arm64-musl` | 102.4 | 47.6 |
| Node bundle `askboard.mjs` | 0.43 | 0.12 |

- An empty program compiles to 89.2 MB (darwin-arm64) and 109.1 MB (linux-x64): the runtime is the size, and `--minify` saves 0.4 MB.
- Warm start, median of 5: the darwin-arm64 executable 46 ms, the Node bundle on Node 24.22.2 84 ms. The first start of a newly written executable on macOS takes 1.0 to 1.5 s, once. darwin-x64 under Rosetta answers `initialize` in 761 to 765 ms.
- The darwin-arm64 file is ad-hoc signed; fetched by curl, it ran with no Gatekeeper prompt (`smoke`).
- Linux (`linux-targets2`): glibc arm64 and x64 (emulated) run directly and through the launcher. Alpine's musl executables fail with `libstdc++.so.6` not found until `apk add libstdc++ libgcc`.

Details: `evidence/build-licence.md`, § Criterion 1; `evidence/linux.md`, § 5.1.

## Criterion 2: cold start within `MCP_TIMEOUT` (30 s)

**Pass with change (row 1).**

- **Smoke (task 3.1, run `smoke`, 11:35):** with an empty cache, the release server logged one fetch of the 90 MB file and `initialize` was answered in 1.4 s. The second start answered in 58 ms with no fetch. Hook mode exited 0. With the release server down, the launcher answered `unavailable` in 53 ms.
- **Sweep (run `cold`, `bun harness/cold.ts`):** median time to the `initialize` answer from spawn, empty cache, darwin-arm64:

  | Nominal rate | Answer | Effective rate |
  | --- | --- | --- |
  | unthrottled | 1.1 s (1.5 s with a 300 ms first-byte delay) | — |
  | 100 Mbit/s | 9.5 s | 85.6 Mbit/s |
  | 50 Mbit/s | 17.0 s (17.2 s with the delay) | 45.3 Mbit/s |
  | 40 Mbit/s | 21.1 s | 36.0 Mbit/s |
  | 35 Mbit/s | 22.5 s | 33.6 Mbit/s |
  | 30, 25, 20, 10, 5 Mbit/s | `unavailable` at 25.06 to 25.08 s | — |
  | warm | 53 ms | — |

- The first fetch fits the 25 s budget from about 31 Mbit/s effective for darwin-arm64; by size, darwin-x64 needs about 33 Mbit/s and linux glibc about 37 Mbit/s. Gzip assets would lower that to about 14 to 17.5 Mbit/s.
- **Claude Code (`p-cold2`, `--plugin-dir`, 50 Mbit/s, 300 ms delay):** the debug log shows `Starting connection with timeout of 30000ms`, then `Successfully connected (transport: stdio) in 17403ms`; `/mcp` showed the server with 1 tool. Claude Code first sends a `server/discover` probe with a short bound, and treats a late answer as a slow start, not a legacy peer.
- **Linux (`linux-targets2`):** cold start with the download from a local mirror took 498 ms on Debian arm64 and 695 ms on Alpine arm64, about 1.45 s on emulated amd64.

Details: `evidence/launcher.md`, § Criterion 2; `evidence/claude-code.md`, § Criterion 2.

## Criterion 3: the plugin `command` source compared with the launcher

**Compared; the launcher is recommended (row 1). The background re-run awaits the PO (task 7.5).**

- Local marketplace with `{"source":"command","command":"sh <probe>/cmd-source.sh","timeout":120}`. `probe/cmd-source.sh` fetches the executable for this machine, checks it, and prints a plugin folder whose `.mcp.json` runs it directly.
- Install without `--yes` shows the command and asks `Run this command now? [y/N]`. With `--yes` it installed in 0.98 s with one download (local, unthrottled); `claude plugin list` shows version `0.0.1-spike-9d587c131292` (manifest version plus a hash).
- The plugin cache copy is 86 MB, and the command's own output another 86 MB unless the command deletes it.
- `claude mcp list` started the server from the plugin cache and connected in about 2 s, with no request at the release server.
- Not observed: the once-per-session background re-run. In `p-cmdsrc` the user-scope install was not enabled under `--setting-sources project,local`.
- The comparison is in § Delivery comparison.

Details: `evidence/claude-code.md`, § Criterion 3; `evidence/docs.md`, D1 to D8.

## Criterion 4: download and rename under a lock, concurrent sessions and the probe sibling

**Pass with change (row 1).** Runs `concurrency` and `budget` (`bun harness/concurrency.ts`, `bun harness/budget.ts`), 50 Mbit/s nominal:

| Case | Downloads | Outcome |
| --- | --- | --- |
| 8 launchers plus the sibling, killed after its `initialize` | 1 | all 8 started at 16.80 to 16.81 s; the sibling answered and was killed; every SHA-256 right; only `askboard` left |
| Lock-free control, 9 at once | 9 | all started, correct, at nine times the traffic |
| SIGKILL of the downloading launcher, then a new start | 2 | the dead PID's lock was broken and its `.part` removed, and the new start ran; the killed launcher's curl kept running to its own timeout |
| SIGTERM instead | 2 | no lock, no `.part` and no curl left |
| A waiter behind a slow holder (20 Mbit/s) | 1 | both answered `unavailable` within the shared 25 s budget |

- Changes made during the runs:
  - the download runs in the background under a signal trap;
  - orphaned `.part` files of dead launchers are removed;
  - the lock wait and the download share one 25 s budget (before, a waiter could reach about 53 s).
- Residual race, not observed: a launcher killed between `mkdir` and writing its PID leaves a lock with no PID, which waiters treat as live until the budget ends.
- Linux: one download per container, no partial file (`linux-targets2`).

Details: `evidence/launcher.md`, § Criterion 4.

## Criterion 5: offline installation

**Pass with change (row 6).** Run `offline` (`bun harness/offline.ts offline`):

| Case | Outcome | `initialize` |
| --- | --- | --- |
| Release server down, empty cache | `unavailable`: "could not download AskBoard …" | 52 ms |
| Executable copied into `bin/<version>/` beforehand | started, no request | 1,781 ms (first exec) |
| Mirror as a `file://` tree (`ASKBOARD_RELEASE_URL=file://…`) | started, checksum checked | 1,067 ms |
| Mirror as a second HTTP server | started, one download from the mirror | 1,165 ms |
| The plain bundle on Node 24.22.2 | started | 194 ms |

AD-22 names neither the mirror nor how to seed the cache.

Details: `evidence/launcher.md`, § Criterion 5.

## Criterion 6: tinycc in the compiled output

**Pass: present on all six targets (row 7).**

- Commands: `strings -a <file> | grep -c -E 'tcc_new|tcc_compile_string|tcc_relocate|tcc_set_options'`, plus counts of `tinycc` and of `libtcc1`/`tccdefs`. `nm` finds nothing because the files are stripped.
- Every target shows libtcc's own strings, with counts equal to a positive control that imports `cc` from `bun:ffi` (`dist-extra/ffi-cc`). The stand-in never imports `bun:ffi`.
- Bun's build configuration at `bun-v1.4.4` turns tinycc off only for Android and FreeBSD.
- Source: `oven-sh/tinycc` at `05f0fafaa3be31e31d7b4b5c17dc60f62c991171`, LGPL-2.1.

Details: `evidence/build-licence.md`, § Criterion 6.

## Criterion 7: the WebKit commit and the relink steps

**Pass (row 7).**

- `WEBKIT_VERSION = "d6375c72affe0f70222cdcb45012b10f0bf3a9d5"` in `scripts/build/deps/webkit.ts` at tag `bun-v1.4.4`; the `cmake/tools/SetupWebKit.cmake` path no longer exists.
- The commit exists in `oven-sh/WebKit` (2026-10-21), with its prebuilt release `autobuild-d6375c72…`. It carries `Source/JavaScriptCore/COPYING.LIB`, `Source/WebCore/LICENSE-LGPL-2` and `Source/WebCore/LICENSE-LGPL-2.1`.
- Bun's relink steps (`LICENSE.md` at `bun-v1.4.4`): `git clone https://github.com/oven-sh/WebKit vendor/WebKit`, `bun sync-webkit-source`, `bun run build:local`.
- AskBoard's half: `bun build dist/askboard.mjs --compile --target=bun-darwin-arm64` built an executable that answered `initialize` and listed `ask`.

Details: `evidence/build-licence.md`, § Criterion 7.

## Criterion 8: devcontainers

**Pass with change (row 8).** Run `linux-devcontainer` (`RUN=linux-devcontainer linux/run.sh devcontainer`): Debian arm64, `askboard serve-board` with `ASKBOARD_PORT=47850`:

| Case | Publish | From the host |
| --- | --- | --- |
| Default (loopback) | `-p 127.0.0.1:47850:47850` | no answer |
| Opt-in (`ASKBOARD_BIND_CONTAINER=1`) | the same | 200, and the stderr warning `board listener bound to 0.0.0.0:47850, a non-loopback interface` |
| Opt-in, `ASKBOARD_LINK_HOST=localhost` | the same | 200 on the printed `http://localhost:47850/…` |
| Opt-in, another host port | `-p 127.0.0.1:47851:47850` | the printed link fails; 200 on 47851 |
| Opt-in, no host address | `-p 47852:47850` | published on every host interface |

Not covered: VS Code Dev Containers, which set `BROWSER` to a host helper and forward ports themselves.

Details: `evidence/linux.md`, § 5.2.

## Criterion 9: WSL

**Awaiting PO (task 7.1).** No Windows machine was available. The `detect` rule's WSL rows were forced in a container (`WSL_DISTRO_NAME` with and without a `wslview` shim, run `linux-detect`): that tests the rule, not WSL. The steps are in § Product owner runs.

## Criterion 10: CI runners

**Pass for the stand-in; a hosted runner awaits the PO (task 7.3).**

- Run `linux-ci-sim`: Ubuntu 24.04 arm64 with `CI=true GITHUB_ACTIONS=true`. The launcher answered `initialize` in 305 ms through the mirror.
- `detect` and the `ask` tool returned `unavailable` with `container-without-binding`, because the container rule comes first; the CI rule itself gives `ci-runner` in `linux-detect`.
- `ci/packaging-probe.yml` is ready for a hosted runner: `workflow_dispatch`, `ubuntu-24.04`, `macos-latest` on request, actions pinned by SHA. It lives in the change, not under `.github/`.

Details: `evidence/linux.md`, § 5.3.

## Criterion 11: native Windows

**Pass, simulated (row 11); the real run awaits the PO (task 7.2).**

- Run `windows-sim` (`bun harness/offline.ts windows-sim`), with an `uname` shim first on `PATH`. For `MINGW64_NT-10.0-26100`, `MSYS_NT-10.0-26100` and `CYGWIN_NT-10.0-26100`, the launcher answered `initialize` in 32 to 38 ms with "AskBoard cannot start: native Windows is not supported: install Claude Code in WSL and use AskBoard there", and `ask` returned `unavailable` with that reason.
- This covers a Windows machine where Claude Code runs the server's `command` through a POSIX `sh`.
- Untested: whether Claude Code on native Windows starts a shebang script with no extension at all.

Details: `evidence/launcher.md`, § Criterion 11; `evidence/docs.md`, D2, D16, X8.

## Criterion 12: "no reachable browser" per platform

**Pass (row 9).** Run `linux-detect` (`RUN=linux-detect linux/run.sh detect`); the macOS rows run `probe/dist/askboard-darwin-arm64 detect`:

| Platform | Inputs | Reachable | Reason |
| --- | --- | --- | --- |
| macOS | as is | yes | `open` |
| macOS | `SSH_CONNECTION` or `CODESPACES` set | no | `remote-host` |
| macOS | `BROWSER=firefox` | yes | `BROWSER` |
| macOS | `CI=true` | no | `ci-runner` |
| Container (Debian, Alpine) | as is; or `BROWSER`; or `WSL_DISTRO_NAME` | no | `container-without-binding` |
| Container | `ASKBOARD_BIND_CONTAINER=1` | yes | terminal link only |
| Linux | no `DISPLAY`, or no `xdg-open` | no | `no-opener` |
| Linux | `DISPLAY=:0` and `xdg-open` | yes | `xdg-open` |
| Linux | `CI=true`, with or without an opener | no | `ci-runner` |
| Linux | `WSL_DISTRO_NAME`, with `wslview` | yes | `wslview` |
| Linux | `WSL_DISTRO_NAME`, no `wslview` | no | `no-opener` |

- The openers in the Linux rows are shims, so the rows test the rule, not the opener.
- Question for the PO: inside a container, `BROWSER` does not count. That is right for plain Docker, but may not be for VS Code Dev Containers (row 8).

Details: `evidence/linux.md`, § 5.4.

## Criterion 13: a background board tab for an hour

**Pass for the engines covered (row 10); branded Chrome with Memory Saver and Safari await the PO (task 7.4).**

Run `tab-hour`, 10:20 to 11:29: headless, on AC power, no memory pressure. Command: `bun tab-drive.ts --run tab-hour --minutes 65 --engines raw-chrome,raw-firefox-installed,pw-chromium,pw-firefox,pw-webkit --scratch <scratch>`, plus `raw-chromium` started 4 minutes later.

| Engine | Board seen as | Disconnects in the hour | Longest heartbeat gap | Freeze or discard |
| --- | --- | --- | --- | --- |
| Chrome 156.0.8078.79 (`raw-chrome`) | hidden | 0 | 60.1 s (5 s, then 60 s from about 2.3 minutes after hiding) | none |
| Chrome for Testing 156.0.8078.4 (`raw-chromium`) | hidden | 0 | 60.1 s | none |
| Firefox 124.0.2 (`raw-firefox-installed`) | hidden | 0 | 5.1 s | none |
| Playwright Chromium, Firefox 157.0, WebKit 27.2 (`pw-*`) | visible: Playwright keeps its pages visible, so these rows do not cover discarding | 0 | 5.0 to 5.1 s | none |

- `tab-drop`: when the server closes a hidden board's socket, the board reconnects in 1.34 s in Chrome and 1.0 s in Firefox.
- `tab-forced`: a forced freeze keeps the socket open until resume; then it closes (1001) and reconnects in 1.2 s. A forced discard closes it (1001), with no reconnect until the tab is activated, which reloads it with `wasDiscarded: true`.
- Not covered: memory pressure, Memory Saver, Energy Saver, Safari, a current Firefox release, headed windows, App Nap and sleep.

Details: `evidence/tab-hour.md`.

## Criterion 14: a failed start is not cached

**Pass with change (row 2); what the model sees awaits the PO (task 7.5).**

- **Client side (run `failures`, `bun harness/offline.ts failures`):** five faults were tried: a 404, a truncated body, corrupted bytes, a hang after 64 KiB, and no curl or wget.
  - For each, the answering launcher answered `initialize` in 39 ms to 25.09 s and listed `ask`, and the tool's call returned `unavailable` with the reason. The control (`ASKBOARD_LAUNCHER_ON_FAILURE=exit`) exited 1.
  - The cache was left empty each time. The truncated body passed curl and was caught by the checksum.
- **Prerequisites (run `failures-fix`):** with no curl or wget, the reason is now `neither curl nor wget is installed` (37 ms). With no SHA-256 tool, it is `no SHA-256 tool is installed (sha256sum, shasum or openssl)` (32 ms). Before the fix, Debian slim got "could not download" (`linux-targets2`, 64 ms).
- **Claude Code (interactive, no prompt sent):**

  | Run | Launcher | Release server | What Claude Code did | `mcp-needs-auth-cache.json` after |
  | --- | --- | --- | --- | --- |
  | `p-fail-exit` | exits 1 | down | spawned it twice (a version probe, then a legacy respawn), then `Connection failed after 263ms`; `/mcp` showed it failed | an entry for `plugin:askboard:askboard` |
  | `p-fail-exit-next` | exits 1 | up | never started the server: no connection line, no request at the release server | unchanged; `/mcp` Reconnect then connected in 1.1 s and cleared it |
  | `p-fail-answer` | answers | down | `Successfully connected … in 218ms` on the 2025-11-25 handshake; `/mcp` showed 1 tool | `{}` |
  | `p-fail-answer-next` | answers | up | connected in 1.2 s after one download | `{}` |

- The launcher answers `server/discover` with `-32601`, and Claude Code falls back to the 2025-11-25 handshake, which `sh` can serve.
- Cost: `/mcp` shows the failed start as connected. The reason reaches the model through `instructions`, the tool's description and its `unavailable` result.

Details: `evidence/launcher.md`, § Criterion 14 and § Prerequisite checks; `evidence/claude-code.md`, § Criterion 14.

## Criterion 15: Claude Code stays the parent

**Pass.**

- Run `parent` (`bun harness/offline.ts parent`, with `ASKBOARD_PROBE_LOG`): through `exec`, the session process keeps the launcher's PID, and its parent is the spawning client. Cold: client 51335, server 51336, parent 51335; warm: the same pattern. The concurrency run confirms it for all nine starts.
- In `p-cold2`, `ps` showed that the server's PPID was the `claude` process.
- Hook mode with no executable exits 0 with one stderr line and makes no request. With the executable in place, the executable's hook mode runs and exits 0.
- This is what the mod delivery spike's PID-keyed session file needs (its proposed outcome row 2).

Details: `evidence/launcher.md`, § Criterion 15; `evidence/claude-code.md`, § Criterion 2.

## Criterion 16: what uninstalling leaves

**Fail as AD-22 states it; pass with change (row 5).** Run `p-uninstall`, in the isolated configuration, with a stand-in cache at `<config>/plugins/data/askboard-askboard-spike-pkg/bin/0.0.1-spike/askboard`:

- `claude plugin uninstall askboard@askboard-spike-pkg --scope user` deleted the data folder and the cache in it; the plugin cache (86 MB) stayed.
- After a reinstall, `uninstall … --keep-data` kept the data folder and the cache.
- The `--plugin-dir` data folder `plugins/data/askboard-inline/` stayed after the sessions.

Details: `evidence/claude-code.md`, § Criterion 16; `evidence/docs.md`, D10, X1.

## Product owner runs (awaiting PO)

Commands run from `openspec/changes/spike-packaging/probe/` unless they say otherwise. `bun run build` rebuilds `dist/`. `bun release-server.ts` starts the release stand-in on `127.0.0.1:47800` and rewrites `plugin/scripts/release.txt` to match.

### Task 7.1: WSL (criterion 9)

1. On Windows with WSL 2 (and once on WSL 1 if available), inside the distribution: install Bun 1.4.4 and Claude Code, clone the branch, then run `bun install --frozen-lockfile && bun run build` in `probe/`.
2. Record the opener inputs: `echo "$BROWSER"`, `command -v wslview explorer.exe xdg-open`, `echo "$WSL_DISTRO_NAME"`, and `./dist/askboard-linux-x64 detect`.
3. Start `bun release-server.ts`, then `claude --plugin-dir "$PWD/plugin"` in a throwaway project, and ask the agent to call the askboard `ask` tool.
4. Record the three FR-23 notices: the link in the terminal (does it open the board in the Windows browser?), a system notification, and the browser opening by itself. Record which opener worked.

### Task 7.2: native Windows (criterion 11)

1. On Windows with Git Bash installed, run `claude --plugin-dir <path to probe/plugin>` in a throwaway project. Open `/mcp` and record the server's state. Ask the agent to call the askboard `ask` tool and record what it says; the WSL message is expected.
2. Repeat with Git Bash absent or off `PATH`, so hooks run through PowerShell. Record `/mcp` (a failed server is expected), what the agent says, and whether a later session within 15 minutes retries.

### Task 7.3: a GitHub-hosted runner (criterion 10)

Copy `openspec/changes/spike-packaging/ci/packaging-probe.yml` to `.github/workflows/` on a branch of the PO's choice, push it, and run it with `workflow_dispatch`. Run macOS only when asked: macOS minutes cost about ten times Linux. Record each step's outcome in § Criterion 10, then delete the branch.

### Task 7.4: branded browsers (criterion 13)

From `evidence/tab-hour.md`, § Steps for the product owner:

1. Start `caffeinate -i bun tab.ts serve --run po-tab --engine chrome-memory-saver` and `caffeinate -i bun tab.ts serve --run po-tab --engine safari`.
2. Open each printed `board` URL and put another tab in front. Turn Memory Saver on in Chrome and note its mode.
3. Use the machine for an hour without returning to the board tabs.
4. Click each board tab, wait 10 s, and stop the servers.
5. Read `bun tab.ts report runs/po-tab/<engine>.jsonl`: `wsCloses`, `pageLoads`, `wasDiscarded`, `longestGapS`, `lifecycle`.

### Task 7.5: model runs (criteria 2, 3 and 14)

1. Log in in the isolated configuration: `CLAUDE_CONFIG_DIR=<scratch>/pkg/cc-config claude`, then `/login` in a browser.
2. Cold start with the model:

   ```sh
   PORT=47861 RATE=6250000 DELAY=300 WRITE_RELEASE=0 bun release-server.ts   # in one terminal
   ASKBOARD_RELEASE_URL=http://127.0.0.1:47861/askboard/askboard/releases/download \
     sh harness/cc-run.sh p-cold-po <scratch>/pkg/plugin-cold2 \
     "Call the askboard ask tool with askId cold-1 and question 'hi', then reply with its result."
   ```

3. A failed start with the model: the same with the release server stopped, and a prompt that asks the agent to call the tool and report what it got. Record whether it falls back to AskUserQuestion.
4. The `command` source's background re-run: run `claude plugin install askboard@askboard-spike-pkg --scope local --yes` in the project, start a session with `--setting-sources project,local`, and look for a request in the release server's log shortly after the session starts.

## Documentation read (task 1.1, 2026-10-30)

`evidence/docs.md` lists 20 facts (D1 to D20) with their pages:

- the `command`, `npm` and `archive` plugin sources and their limits;
- when a `command` source re-runs, and what the user accepts;
- `${CLAUDE_PLUGIN_DATA}` and its deletion on the last uninstall;
- `bin/` and the surfaces that skip it;
- `MCP_TIMEOUT`, non-blocking MCP startup and the 15-minute failed-start cache for plugin servers;
- Windows paths and shells;
- Bun's compile targets, code signing, licences and relink steps, and the targets it builds tinycc for.

The differences from the design documents:

| # | Design text | Documentation | Effect |
| --- | --- | --- | --- |
| X1 | AD-22 and SOLUTION-DESIGN §8: "uninstalling leaves `.askboard/`, the session-file folder, and the executable cache" | D10: the last uninstall deletes `${CLAUDE_PLUGIN_DATA}`, which holds the cache, unless `--keep-data` | AD-22's uninstall sentence is wrong for the cache (criterion 16; row 5) |
| X2 | §10.4 criterion 2 and §4.10: a cold start "within `MCP_TIMEOUT` (30 s)" | D12, D13: a start beyond 30 s is a failed first connection, and for a plugin server it is then cached for 15 minutes across sessions | The launcher must answer within 30 s whatever the download does (rows 1, 2) |
| X3 | SOLUTION-DESIGN §4.10 and §10.4 name the `command` source without its terms | D1 to D6: install-time prompt, a background re-run each session, a 256 MiB copy limit, `cmd.exe` on Windows, link mode refused there, `disableCommandPluginSources` | Weighed in criterion 3 (row 1) |
| X4 | §13 F23: official plugins ship servers via `npx`, `uvx`, `docker`, `bun run` or HTTP, none as a binary | D7, D8: the `npm` source never runs install scripts and refuses GitHub release tarballs; an `archive` is one zip per entry, `https` only, 256 MiB | Neither carries per-platform executables: the six targets are about 270 MiB gzip (row 12) |
| X5 | §13 F18 and §4.10 assume the 30 s limit bounds the session's first ask | D12: startup is non-blocking, so the agent can ask before AskBoard's tools are listed | The `ask` tool can be absent for the first seconds of a cold session; AD-18 already covers absent tools |
| X6 | F35: "tinycc in output: packaging spike" | D20 and criterion 6 | tinycc is in the output on every target, whether or not AskBoard calls `cc()` (row 7) |
| X7 | AD-19's obligations name "Bun's notices" | D19 and Bun's `LICENSE.md`: about 50 statically linked libraries, among them `zstd` (BSD or GPLv2) and ICU 78 | The notices file is Bun's whole `LICENSE.md` plus the LGPL texts; no GPL-only component is listed (row 7) |
| X8 | §8: "native Windows gets a message naming WSL (mechanism: packaging spike)" | D2, D16: forward-slash paths, `cmd.exe` for command sources, PowerShell for hooks without Git Bash | Without Git Bash nothing runs a POSIX launcher, so the message cannot come from the launcher alone (criterion 11; row 11) |
