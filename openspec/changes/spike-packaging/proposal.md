# Proposal

## Why

AD-19 ships the session process as a Bun-compiled executable, and AD-22 has a POSIX launcher fetch it before the session process starts. Neither has been tried: the executable's size, a cold start within `MCP_TIMEOUT` (30 s), safe concurrent fetches, offline use, the LGPL components in the output and the platforms of NFR-7 are all unmeasured, and the NFR-6 licence exception (SOLUTION-DESIGN §11 entry 7) waits for this spike's evidence. The mod delivery spike added two inputs: a failed server start is cached by Claude Code for about 15 minutes, and the session-file key needs the launcher to keep Claude Code as the session process's parent. So the packaging spike runs now (SOLUTION-DESIGN §10.4) and ends in a spine update.

## What Changes

- **A probe**, kept in this change under `probe/` as evidence and not shipped. It is a package of its own, outside the Bun workspace, with its own `package.json` and lockfile, every dependency pinned exactly; it builds with Bun 1.4.4. It has:
  - a session-process stand-in: a stdio MCP server on `@modelcontextprotocol/server` 2.4.0 with one tool, a board listener on `127.0.0.1` (the container interface only on opt-in), the "no reachable browser" check, and `hook` and `doctor` modes, so the compiled executable carries the code paths the product will;
  - a build of that stand-in for the six targets of AD-19 (darwin and linux, x64 and arm64, linux glibc and musl) with `bun build --compile`, and of the plain JavaScript bundle for Node;
  - a POSIX launcher (`scripts/` in the stand-in plugin) that fetches the pinned executable with `curl` or `wget` to a temporary name, checks its SHA-256, renames it under a lock and `exec`s it, and that answers the MCP handshake with the reason when it cannot start the executable;
  - a release-server stand-in on `127.0.0.1` that serves the executables as GitHub Releases would (redirects, throttling, faults), so nothing is published;
  - a stand-in plugin in two forms: the launcher form, and a `command` plugin source that fetches at install time;
  - a stdio client that times the handshake from spawn, and a browser driver for the background-tab check.
- **Runs** of §10.4's thirteen exit criteria: executable size per target; cold start with the first fetch within `MCP_TIMEOUT`, or the fetch moved out of session-process start; the plugin `command` source compared with the launcher; temporary-name download and rename under a lock with concurrent sessions and the probe sibling; offline installation; tinycc in the compiled output; the `oven-sh/WebKit` commit Bun 1.4.4 pins and Bun's relink steps; devcontainers (opt-in binding, published port, host-side address in links); WSL (the three FR-23 notices and `$BROWSER`); CI runners; native Windows (how the user sees the message naming WSL); "no reachable browser" per platform; a background board tab not discarded after an hour [F33].
- **Runs of three criteria the mod delivery spike adds** (its findings, proposed outcomes rows 2 and 16, and criterion 5's cleanup):
  14. a missing executable, a failed fetch or a failed checksum reaches the user without Claude Code caching a failed start;
  15. the launcher keeps Claude Code as the parent process of the session process and of each hook;
  16. what uninstalling the plugin leaves: the executable cache in `${CLAUDE_PLUGIN_DATA}`, which the plugin documentation says is deleted on the last uninstall, against AD-22.
- **Evidence for the NFR-6 licence exception** (§11 entry 7), collected for the product owner and not decided: the adoption-rule status of Bun, the LGPL components in each target's output, the WebKit source and the relink steps, and what each release would ship to meet the obligations.
- **`findings.md`**: each criterion with its verdict per platform and its evidence (the run, timings, sizes, logs), the delivery comparison, and "Proposed outcomes (awaiting the PO)". **`spine-update-draft.md`**: the replacement texts for each proposed outcome. Runs that need the product owner (WSL, native Windows, a real CI runner) are prepared with exact steps and left open.
- **Spine update**, in this change, decided by the product owner on the findings: AD-19 and AD-22 record the delivery path and the launcher's rules; AD-18 gains the detection rule behind `unavailable`; AD-21's grace rule only if tabs are discarded; the Deferred rows for Bun packaging and "no reachable browser" close; SOLUTION-DESIGN §4.10, §8, §9, §10.4, §11, §12 and §13. A licence decision goes to the PRD (NFR-6, addendum) only when the product owner takes it.

## Capabilities

### New Capabilities

None. The spike settles a delivery path and facts, and implements no product behaviour, so `.openspec.yaml` sets `skip_specs: true`. The `packaging` capability spec comes with the epic that builds it, on the decisions recorded here.

### Modified Capabilities

None.

## Impact

- **New, in this change:** `probe/` (stand-in server, build script, launcher, stand-in plugin forms, release-server stand-in, timing client, browser driver, its own `package.json`, `bunfig.toml` and `bun.lock`), `linux/` (container harness), `findings.md`, `evidence/`, `spine-update-draft.md`.
- **Changed after the product owner's decisions:** `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (AD-18, AD-19, AD-22, Deferred; AD-21 only if tabs are discarded) and `SOLUTION-DESIGN.md` (§4.10, §8, §9, §10.4, §11, §12, §13); `docs/prd-askboard-2026-10-25/` only for a licence decision.
- **No product code, no repository dependency:** nothing under `packages/` changes, and the root `package.json` and `bun.lock` stay as they are. Nothing is published: the release server is a local stand-in, plugin installs use an isolated Claude Code configuration, and containers and browsers run from the spike's scratch directory.
- **Invariants:** the probe is MIT and its dependencies meet the adoption rule (NFR-6, AD-19); its only outbound connection is the launcher's fetch, from the local stand-in (NFR-9, AD-11); it listens on `127.0.0.1` unless the container opt-in is set (NFR-3, AD-11); a failed start never yields an answer (NFR-10, AD-10).
- **Requirements and decisions served:** FR-23, FR-28, FR-31, NFR-3, NFR-6, NFR-7, NFR-8, NFR-9, NFR-10; AD-2, AD-11, AD-18, AD-19, AD-21, AD-22; evidence for AXFX NFR-1 (§11 entry 8), which is decided in the planning repository.
- **Gates:** the `packaging` and `hooks` epics build on the outcome, and the product owner's NFR-6 decision rests on its evidence.
