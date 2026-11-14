# Design

## Context

See proposal.md for the motivation. The question and the thirteen exit criteria are in SOLUTION-DESIGN §10.4; criteria 14 to 16 come from the mod delivery spike's findings (proposed outcomes rows 2 and 16, criterion 5's cleanup). The design relies on these rules:

- **AD-2:** one session process per Claude Code session, the stdio server Claude Code starts; no side effect (no port, no file, no download) before its first request other than `server/discover`; it exits when stdin closes.
- **AD-11:** the board listener binds `127.0.0.1`, the container interface only on explicit opt-in, with the port published as `127.0.0.1:<port>:<port>`. AskBoard's only outbound connection is the launcher fetching the pinned executable, written under a temporary name, checked against a SHA-256 shipped in the plugin, renamed into place under a lock. Hooks never fetch.
- **AD-18:** when no browser can reach a board, or on a remote host, `ask` returns `unavailable` before the ask is created; one minimum Claude Code version (2.1.311, confirmed by the mod delivery spike).
- **AD-19:** one plugin; the executable for darwin and linux, x64 and arm64, glibc and musl; no Bun-only API; hooks run `askboard hook <event>` through the launcher, 5 s timeout, exit 0 without a decision when the executable is missing; each release ships the LGPL texts and Bun's notices, names the Bun version, links the WebKit source and publishes the plain bundle; until the NFR-6 exception, the plain bundle on Node 24.22.1 or later.
- **AD-22:** cache `${CLAUDE_PLUGIN_DATA}/bin/<version>/`; each session runs the version pinned at its start; unpinned versions pruned at start; the launcher needs only POSIX `sh` and `curl` or `wget`; uninstalling leaves the executable cache.

What exists: the ten packages under `packages/` have empty entry points, so the spike builds its own stand-in. The mod delivery spike's probe (`spike-mod-delivery/probe/`) shows a plugin with a stdio server on `@modelcontextprotocol/server` 2.4.0 and `zod` 4.6.7 loaded with `--plugin-dir`. The plugin documentation read on 2026-10-30 adds facts the spike must weigh: a `command` plugin source (Claude Code 2.1.229 or later) runs a shell command at install, at update and once per session in the background, and copies the directory it prints into the plugin cache (256 MiB at most); `${CLAUDE_PLUGIN_DATA}` is deleted when the plugin is uninstalled from the last place it is installed, unless `--keep-data`; a plugin with a top-level `bin/` is skipped by claude.ai and Cowork. The installed Claude Code is 2.1.314.

## Goals / Non-Goals

**Goals:**

- A verdict for each of the sixteen criteria, per platform where it applies, backed by runs that someone else can repeat with one command.
- A recommended delivery path (launcher, `command` source, or the plain bundle on Node) from measured sizes, times and failure behaviour.
- The evidence the product owner needs for the NFR-6 licence exception, without deciding it.
- A spine update draft that the product owner can accept row by row.

**Non-Goals:**

- Product code: the `packaging` and `hooks` epics build the launcher and the executable on the decisions recorded here. The probe is not a starting point for them.
- Publishing anything: no npm package, GitHub release, repository or upload. The release server is a local stand-in.
- Installing or enabling plugins in the user's own Claude Code configuration.
- Real WSL, native Windows and GitHub-hosted runner runs: there is none on this machine and the spike never pushes. They are prepared for the product owner.
- Code signing and notarization on macOS: recorded as an open item if a run shows Gatekeeper blocking the fetched executable.

## Decisions

### 1. A probe package in the change, outside the workspace, with exact pins

`probe/` has its own `package.json`, `bunfig.toml` (`linker = "isolated"`, `exact = true`) and `bun.lock`: `@modelcontextprotocol/server` 2.4.0 and `zod` 4.6.7, as in the mod delivery probe, and `playwright` 1.64.1, as in the renderer probe. Each passes the adoption rule, checked with the GitHub API on the run date. No file in the probe is named `*.test.ts`, so the root `bun test` never collects it. *Alternative:* add the dependencies to the workspace, rejected because the root `package.json` and `bun.lock` stay unchanged.

### 2. A stand-in executable that carries the product's code paths

`probe/server.ts` is one entry with four modes, as AD-19 requires of the real executable: the stdio MCP server (one tool, `ask`, which returns a board link or `unavailable`), `hook <event>`, `doctor` and `detect` (prints the "no reachable browser" verdict and its inputs). On the first `tools/call` it binds a board listener on `127.0.0.1`, or on `0.0.0.0` when `ASKBOARD_BIND_CONTAINER=1`, and prints the link with the host-side address from `ASKBOARD_LINK_HOST` when set. It uses no Bun-only API, so the same file runs on Node from the plain bundle. `build.ts` compiles it with `bun build --compile` for `bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-linux-x64-musl` and `bun-linux-arm64-musl`, once plain and once with `--minify`, and bundles it for Node with `--target=node`. It writes `dist/manifest.json` with each file's raw and gzip bytes and SHA-256. Sizes come from that manifest. *Alternative:* measure an empty program, rejected because the SDK and its validation are what the product embeds.

### 3. A POSIX launcher that fetches, verifies, renames under a lock and `exec`s

`probe/plugin/scripts/askboard` is POSIX `sh`. It reads the pinned version and, per target, the SHA-256 and URL from `scripts/release.txt` (one line per target, so `sh` parses it without `jq`). It detects the target with `uname -s` and `uname -m`, and musl by the presence of `/lib/ld-musl-*`. When `${CLAUDE_PLUGIN_DATA}/bin/<version>/askboard` exists it `exec`s it at once. Otherwise it takes a lock (`mkdir` of `<version>/.lock`, atomic on every POSIX file system, holding the owner's PID; a lock whose owner is dead is broken), downloads with `curl` or else `wget` to `askboard.<pid>.part` in the same directory, checks the SHA-256 with the first tool found among `sha256sum`, `shasum -a 256` and `openssl dgst -sha256`, renames it into place and `exec`s it, so Claude Code stays the parent (criterion 15). A waiter that finds the file in place after the lock clears `exec`s it without fetching. When it cannot start the executable (no download tool, fetch failed, checksum mismatch, native Windows), it does not exit: it answers the MCP handshake itself, with no tools and `instructions` stating the reason, and stays up until stdin closes (criterion 14). The control variant exits non-zero, as a naive launcher would. In hook mode it never fetches: no executable means exit 0 with one stderr line (AD-19). *Alternatives:* a lock-free download (each session downloads to its own temporary name, the last rename wins), measured in the concurrency run as the control; `flock`, rejected because it is not POSIX and absent on macOS.

### 4. A release-server stand-in on `127.0.0.1`

`probe/release-server.ts` serves `dist/` the way GitHub Releases does: `/<owner>/<repo>/releases/download/v<version>/<asset>` answers `302` to an object URL, which streams the file. Options set a bandwidth (bytes per second), a first-byte delay, and a fault: `404`, a truncated body, corrupted bytes, a hang, or the server down. It logs each request, so a run shows how many downloads happened. *Alternative:* a real GitHub release, ruled out (nothing is published).

### 5. Times measured from spawn to the first handshake answer

`probe/handshake.ts` spawns a command as Claude Code does (stdio pipes, the plugin's environment), sends `initialize`, and records the time to the answer and the server's `instructions`. Cold start is measured with an empty cache at several bandwidths (unthrottled, 100, 50, 20, 10 and 5 Mbit/s, plus a 300 ms first-byte delay), and warm with the file in place; each point is the median of 5 runs. The time is compared with `MCP_TIMEOUT` (30 s). The Claude Code runs (decision 7) confirm the end-to-end behaviour; the client gives the numbers.

### 6. A stand-in plugin in two delivery forms

- **Launcher form:** `.claude-plugin/plugin.json`, `.mcp.json` whose server `command` is `${CLAUDE_PLUGIN_ROOT}/scripts/askboard`, with `CLAUDE_PROJECT_DIR` and `CLAUDE_PLUGIN_DATA` in `env`, and `hooks/hooks.json` with one `PostToolUse` hook that runs the launcher in hook mode.
- **`command` source form:** a local marketplace whose plugin entry is `{ "source": "command", "command": "sh <abs>/probe/cmd-source.sh" }`. The script downloads the executable for the machine's target from the release-server stand-in, checks it, writes a complete plugin directory whose `.mcp.json` runs the executable directly, and prints its path. The fetch happens at install, at update and in the once-per-session background run, never at session-process start.

Both are compared on: the size each user downloads, cold start, offline behaviour, update path, prompts the user sees, organization policy (`disableCommandPluginSources`), and Windows (`cmd.exe` runs the command there).

### 7. Claude Code runs in an isolated configuration, at most six

Every Claude Code run uses `CLAUDE_CONFIG_DIR=<scratch>/cc-config`, which authenticates through the environment's OAuth token (`claude auth status` reports `oauth_token` there), and a throwaway project in the scratch directory. Plugins load with `--plugin-dir` or install from a local marketplace into that configuration only. Model `claude-opus-5-5`, `claude -p` with `--debug-file`, in tmux sessions named `p-*`; at most six runs plus one retry of a run that failed for a harness reason. The runs: a cold start through the launcher; a failed start with the exiting launcher, then a session after the release server is back; the same pair with the answering launcher; and a session with the `command`-sourced plugin. The model-free CLI commands (`claude plugin marketplace add`, `install --yes`, `list`, `uninstall`, `claude mcp list`) run in the same configuration and do not count. If the isolated configuration cannot authenticate, the runs are left to the product owner with exact commands.

### 8. Linux in containers

Docker Desktop on this Mac (arm64), with a scratch `DOCKER_CONFIG` holding `{}` as `config.json` because the credential helper hangs. Images pinned by digest: `debian:12-slim` (glibc), `alpine:3.22` (musl) and `ubuntu:24.04` with the GitHub runner's environment variables (`CI`, `GITHUB_ACTIONS`) as the CI stand-in, each on `linux/arm64` and, where Docker's emulation runs it, `linux/amd64`. The probe's `dist/` and `plugin/` are mounted read-only; containers run with `--rm` and are removed at the end. The devcontainer check runs the stand-in with the opt-in binding and `-p 127.0.0.1:<port>:<port>`, fetches the board link from the host, and repeats without the opt-in to show what the opt-in buys.

### 9. "No reachable browser", one rule per platform

The `detect` mode applies one rule and prints its inputs: remote host (`SSH_CONNECTION`, `SSH_TTY`, `CODESPACES`); container (`/.dockerenv`, `/run/.containerenv`, `REMOTE_CONTAINERS`, `DEVCONTAINER`), where a browser is reachable only with the opt-in binding; CI (`CI`, `GITHUB_ACTIONS`); then an opener: `open` on macOS, `$BROWSER`, `wslview` or `explorer.exe` under WSL, `xdg-open` with `DISPLAY` or `WAYLAND_DISPLAY` on Linux. It is run on macOS, in each container, and with each input forced, and the results form the per-platform table.

### 10. The background tab, measured for more than an hour

`probe/tab.ts` serves a board stand-in page on `127.0.0.1` that holds a WebSocket and sends a heartbeat every 5 s, and logs connects, disconnects, heartbeat gaps and the page's `visibilitychange`, `freeze`, `resume` and `document.wasDiscarded`. Playwright 1.64.1 opens it in Chromium, Firefox and WebKit, then opens a second tab in front, and the run lasts 65 minutes. Headless engines may not apply their discarding policies, so the verdict says which engines and modes the run covers; the branded browsers (Chrome's Memory Saver, Safari) are prepared for the product owner.

### 11. Platforms

macOS (arm64) on this machine for every criterion; x64 macOS only for size and a Rosetta run if Rosetta is installed. Linux through decision 8. WSL, native Windows and a GitHub-hosted runner are prepared for the product owner: the steps, and for the runner a workflow file kept in the change (`ci/packaging-probe.yml`), not under `.github/`, so nothing runs.

### 12. Findings, decisions and the spine update

As in `spike-mod-delivery` and `spike-renderer`: `findings.md` holds one row per criterion with its verdict per platform and its evidence; raw runs stay in `probe/runs/`, which git ignores, and summaries go to `evidence/`. Verdicts: **pass**, **pass with change** (the change named in a proposed outcome), **fail**, **untested** (with the reason) and **awaiting PO**. Proposed outcomes and `spine-update-draft.md` are written before any `docs/` edit; the product owner decides each outcome; amendments go into the spine in place, with AD IDs stable. Validation is `openspec validate --all --strict --no-interactive`, plus `bun run check` to show that nothing outside the change was touched.

## Risks / Trade-offs

- **[A local server is not the network]** → bandwidth and first-byte delay are swept, and the finding states the bandwidth below which the first fetch exceeds 30 s rather than one number.
- **[`sh` answering JSON-RPC is fragile]** → it answers only `initialize`, `tools/list`, `ping` and notifications, with the request ID copied by pattern; the Claude Code runs check that Claude Code accepts it.
- **[The failed-start cache is undocumented]** → the runs read the cache file in the isolated configuration before and after each session, and the finding quotes it.
- **[Docker cannot emulate amd64]** → x64 Linux targets are measured for size and marked untested for running, with the reason.
- **[Headless engines do not discard tabs]** → the run reports what it covers, and the branded-browser check goes to the product owner.
- **[The isolated configuration fails to authenticate mid-run]** → the run is retried once; otherwise the commands are left to the product owner.
- **[Six runs are not enough]** → the stdio client carries the measurements; Claude Code runs only confirm behaviour the client cannot show (caching, tool presence, the `command` source).
- **[The time limit, 13:30 on 2026-10-30]** → the hour-long tab run starts first; groups run in parallel where they share no files; anything unfinished stays `[ ]` with what remains recorded.

## Migration Plan

None: no shipped behaviour changes. When the change is archived, `probe/`, `linux/`, `evidence/` and `findings.md` stay in the archive as evidence. Nothing in the probe is referenced from `packages/`.

## Open Questions

- Code signing and notarization of the macOS executables: the spike records whether the fetched file runs unsigned; the release process decides signing.
- The port range and the container opt-in key stay with the implementation (spine, Deferred); the spike uses stand-in values.
