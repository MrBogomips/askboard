# Tasks

Commands run from `openspec/changes/spike-packaging/probe/` unless they name the repository root. Runs write `probe/runs/<run>/`, which git ignores; every verdict in `findings.md` names its run. Tasks marked **(needs the PO)** are prepared and left open, with "awaiting PO" in `findings.md`, until the product owner acts.

## 1. Probe and environment

- [x] 1.1 Read the documentation the criteria depend on: the plugins reference (`${CLAUDE_PLUGIN_DATA}`, `bin/`, Windows paths), the marketplace reference (`command`, `npm` and `archive` plugin sources), plugin loading (when a `command` source re-runs), plugin install and uninstall (`--yes`, `--keep-data`), the MCP page (`MCP_TIMEOUT`, failed servers), Bun's executables page and `LICENSE.md`. Verify that `findings.md`, § Documentation, lists each fact with its page and the date read, and every difference from SOLUTION-DESIGN §4.10, §8 and §10.4 and from AD-19 and AD-22.
- [x] 1.2 Write `tools/adoption.ts`: for Bun 1.4.4, Node 24.22.1, Deno 2.9.8 (the alternative named in §4.10) and each direct dependency of `probe/package.json`, read the licence, stars, last push, last release and archived flag from the GitHub API and the npm registry. Verify that `GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts` writes `evidence/adoption.json` with a pass or a named failure per row against the adoption rule, and that `findings.md` holds the table with the run date.
- [x] 1.3 Create `package.json` with the pins of design decision 1, `bunfig.toml`, `.gitignore` (`node_modules/`, `dist/`, `runs/`) and `tsconfig.json`, then `bun install` to write `bun.lock`. Verify that `bun install --frozen-lockfile` passes in `probe/`; that `GITHUB_TOKEN=$(gh auth token) bun tools/check-licences.ts openspec/changes/spike-packaging/probe`, run from the repository root, completes, with its output in `findings.md`; that `git diff --exit-code origin/main -- package.json bun.lock packages/` at the repository root is empty; and that the root `bun run check` passes.

## 2. The executable (criteria 1, 6 and 7; NFR-6 evidence)

- [x] 2.1 Write `server.ts` (design decision 2: stdio server with the `ask` tool, `hook`, `doctor` and `detect` modes, board listener) and `build.ts`. Verify that `bun run build` writes the six executables, plain and minified, the Node bundle and `dist/manifest.json`; that the darwin-arm64 executable and the Node bundle on Node 24 each answer `initialize` and list the tool (`bun handshake.ts -- <command>`); and that `findings.md`, § Criterion 1, gives raw and gzip bytes per target from the manifest.
- [x] 2.2 Criterion 6: search each target's executable for tinycc (`nm`, `strings`: `tcc_new`, `tcc_compile_string`, `TinyCC`, `tcc`) and compile a second stand-in that imports `bun:ffi`'s `cc` as a positive control. Verify with the per-target table in `findings.md`, § Criterion 6, naming the commands and the symbols found.
- [x] 2.3 Criterion 7: read `WEBKIT_VERSION` from oven-sh/bun at tag `bun-v1.4.4` (`gh api`), confirm the commit exists in `oven-sh/WebKit` and record its licence files, and record Bun's relink steps from its `LICENSE.md` and build documentation. Verify that `findings.md`, § Criterion 7, quotes the commit, the source links and the relink steps, and lists what each release must ship to meet AD-19's obligations (§ NFR-6 evidence).

## 3. The launcher (criteria 2, 4, 5, 11, 14 and 15, without Claude Code)

- [x] 3.1 Write `release-server.ts` (design decision 4), `handshake.ts` (design decision 5), the launcher form of the stand-in plugin with `scripts/askboard` and `scripts/release.txt` generated from the manifest (design decisions 3 and 6). Verify with run `smoke`: an empty cache, one fetch logged by the release server, the executable in `<data>/bin/<version>/`, `initialize` answered, and a second start with no fetch.
- [x] 3.2 Criterion 2: cold and warm start through the launcher at each bandwidth of design decision 5. Verify with run `cold`: the median time per point in `findings.md`, § Criterion 2, and the lowest bandwidth at which the first fetch stays within 30 s, for the plain and the minified executable.
- [x] 3.3 Criterion 4: start 8 launchers at once on an empty cache, plus a ninth killed right after its `initialize` as the probe sibling; then kill a launcher with SIGKILL mid-download and start another. Verify with run `concurrency`: every process ran a file whose SHA-256 matches, the number of downloads logged, no `.part` file or lock left, the stale lock broken, and the lock-free control's result, in `findings.md`, § Criterion 4.
- [x] 3.4 Criterion 5: with the release server down, start the launcher with an empty cache, with a pre-seeded cache, and with a mirror URL override; and run the plain bundle on Node. Verify with run `offline`: which starts succeed and what the user is told, in `findings.md`, § Criterion 5.
- [x] 3.5 Criterion 14 (client side): with a 404, a truncated body, corrupted bytes, a hang and no download tool on `PATH`, start the answering launcher and the exiting control. Verify with run `failures`: the answering launcher's `initialize` result and `instructions` for each fault within 30 s, the control's exit status, and no file left in the cache, in `findings.md`, § Criterion 14.
- [x] 3.6 Criterion 15 and hooks: check that the session process's parent PID is the client's PID through the launcher, and that hook mode with no executable exits 0 with one stderr line and no fetch. Verify with run `parent` in `findings.md`, § Criterion 15.
- [x] 3.7 Criterion 11 (simulated): run the launcher with `uname` shims printing `MINGW64_NT-10.0`, `MSYS_NT-10.0` and `CYGWIN_NT-10.0`. Verify with run `windows-sim`: the handshake answer names WSL, in `findings.md`, § Criterion 11, beside the documentation of how Claude Code on Windows runs a server `command`.

## 4. Claude Code runs (criteria 2, 3, 14 and 16)

- [ ] 4.1 Prepare the isolated configuration and the throwaway project (design decision 7), and record the Claude Code version and the `latest` and `stable` channels from the npm registry. Verify that `CLAUDE_CONFIG_DIR=<scratch>/cc-config claude auth status` reports a login and that the user's configuration files are unchanged after group 4 (checksums before and after).
- [ ] 4.2 Run `p-cold`: the launcher form with `--plugin-dir`, an empty cache and the release server throttled to the bandwidth task 3.2 found near the limit. Verify from the debug log and the transcript: the server connected, the time from spawn to connection, and the `ask` tool listed, in `findings.md`, § Criterion 2.
- [ ] 4.3 Runs `p-fail-exit` and `p-fail-exit-next`, then `p-fail-answer` and `p-fail-answer-next`: a start with the release server down, then a session with it up, for the exiting and the answering launcher. Verify from the cache file in the isolated configuration, the debug log and the transcript whether the second session has the tools, and what the first session showed, in `findings.md`, § Criterion 14.
- [ ] 4.4 Criterion 3: install the `command`-sourced plugin from a local marketplace into the isolated configuration (`claude plugin marketplace add`, `claude plugin install --yes`), then run `p-cmdsrc`. Verify: the install prompt text, the fetch at install logged by the release server, no fetch at session start, the tool listed, and the comparison table of design decision 6, in `findings.md`, § Criterion 3.
- [ ] 4.5 Criterion 16: uninstall both plugins from the isolated configuration, with and without `--keep-data`. Verify with `ls` of `plugins/data/` and `plugins/cache/` before and after, in `findings.md`, § Criterion 16.

## 5. Linux (criteria 1, 8, 10 and 12 on Linux)

- [ ] 5.1 Write `linux/run.sh` (design decision 8). Run the executables and the launcher in `debian:12-slim` and `alpine:3.22` on `linux/arm64`, and on `linux/amd64` where emulation works. Verify with run `linux-targets`: per image and architecture, `initialize` answered through the launcher, the target the launcher picked, and the time, in `findings.md`, § Linux; an image that cannot run is untested with the reason.
- [ ] 5.2 Criterion 8: in a container, the stand-in with and without the opt-in binding, port published as `127.0.0.1:<port>:<port>`, link host from `ASKBOARD_LINK_HOST`. Verify with run `devcontainer`: the host fetches the board link only with the opt-in, the printed link works from the host, and the stand-in warns on stderr when it binds a non-loopback interface, in `findings.md`, § Criterion 8.
- [ ] 5.3 Criterion 10 (stand-in): run the launcher and the `detect` mode in `ubuntu:24.04` with `CI=true` and `GITHUB_ACTIONS=true`, and prepare `ci/packaging-probe.yml` for a real runner. Verify with run `ci-sim` in `findings.md`, § Criterion 10.
- [ ] 5.4 Criterion 12: run `detect` on macOS, in each container, and with each input of design decision 9 forced. Verify with the per-platform table in `findings.md`, § Criterion 12, each row naming its run.

## 6. The background tab (criterion 13)

- [ ] 6.1 Write `tab.ts` (design decision 10) and run it for 65 minutes in Playwright's Chromium, Firefox and WebKit with a second tab in front. Verify with run `tab-hour`: per engine, the WebSocket disconnects, the longest heartbeat gap, the visibility state, and `freeze` or `wasDiscarded` events, in `findings.md`, § Criterion 13, with the modes the run covers.

## 7. Runs the product owner makes

- [ ] 7.1 **(needs the PO)** WSL (criterion 9): the three FR-23 notices and `$BROWSER`, with the steps in `findings.md`, § Criterion 9. Verify that the PO's outcome is recorded there.
- [ ] 7.2 **(needs the PO)** Native Windows (criterion 11): install the launcher-form plugin with `--plugin-dir` and record what `/mcp` and the model show, with the steps in `findings.md`, § Criterion 11. Verify that the PO's outcome is recorded there.
- [ ] 7.3 **(needs the PO)** A GitHub-hosted runner (criterion 10): copy `ci/packaging-probe.yml` to a branch the PO chooses and record the run. Verify that the outcome is recorded in `findings.md`, § Criterion 10.
- [ ] 7.4 **(needs the PO)** Branded browsers (criterion 13): leave a board stand-in tab in the background for an hour in Chrome with Memory Saver on, and in Safari, with the steps in `findings.md`, § Criterion 13. Verify that the outcome is recorded there.

## 8. Decisions and the spine

- [ ] 8.1 Complete `findings.md`: the verdict table (one row per criterion; columns macOS, Linux, Claude Code run, verdict, section), the delivery comparison, the NFR-6 evidence, and "Proposed outcomes (awaiting the PO)", a table with the item, the evidence, the proposed decision, the alternative and an empty "PO decision" column. Verify that every row has a verdict or "untested" with its reason, and that every proposed outcome cites its evidence.
- [ ] 8.2 Write `spine-update-draft.md`: for each proposed outcome, the exact replacement text quoted against the current text, by file and section, each block marked "applies only if the PO accepts row N", AD IDs stable. Verify that `git diff --exit-code origin/main -- docs/` is empty, and that `openspec validate --all --strict --no-interactive` and the root `bun run check` pass.
- [ ] 8.3 **(needs the PO)** Present the proposed outcomes to the product owner and record each decision in the "PO decision" column. Verify that no row of the table has an empty decision.
- [ ] 8.4 **(needs the PO's decisions)** Apply the decisions to the spine, SOLUTION-DESIGN and, for a licence decision, the PRD. Verify with `openspec validate --all --strict --no-interactive`, `bun run check`, and a grep showing that no Deferred row still names the packaging spike as pending.

## Workflow follow-up

- Open the pull request, check that CI passes, squash-merge after the product owner approves, then archive the change on main and remove the worktree and its branch.
- The `packaging` and `hooks` epics build on the decisions recorded here.
- The product owner decides §11 entry 7 (NFR-6) on the evidence, and requests entry 8 (AXFX NFR-1) in the planning repository.
