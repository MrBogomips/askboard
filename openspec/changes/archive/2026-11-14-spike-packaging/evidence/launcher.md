# The launcher without Claude Code (tasks 3.2 to 3.7)

Runs on 2026-10-30, macOS 26 (Darwin 25.6.0, arm64), Bun 1.4.4, curl 8.7.1, from `probe/`. Each run spawns the launcher as Claude Code does (stdio pipes, `CLAUDE_PLUGIN_DATA` set) through `handshake.ts`, which times `initialize` and `tools/list` from spawn. The release server is the local stand-in (`release-server.ts`, design decision 4) on a port in 47800 to 47819. Cache folders are fresh under the spike's scratch directory. Raw results: `probe/runs/<run>/results.jsonl` (git ignores `runs/`); harness: `probe/harness/`.

The executable fetched is `askboard-darwin-arm64` from `dist/` (89,968,994 bytes; `-min` 89,589,218). `/bin/sh` on this Mac is bash in POSIX mode; the launcher also passes under `dash` (run `dash`: warm start and the server-down answer).

## Launcher changes made during these runs

All keep design decision 3; the runs below use the final launcher unless a row says otherwise.

1. **The download runs in the background with a trap** (`fetch … & wait`, `trap … INT TERM HUP`): a session closed mid-download (SIGTERM, SIGINT, SIGHUP) stops curl, removes the `.part` file and releases the lock. Before, curl outlived the killed shell.
2. **Partial files of dead launchers are removed** when the lock is taken (SIGKILL cannot be trapped, and its orphaned curl keeps writing).
3. **One budget for the lock wait and the download** (`ASKBOARD_FETCH_TIMEOUT`, default 25 s): a waiter that takes over after a failed download gets only what is left, so every launcher answers within `MCP_TIMEOUT` (30 s). Before, a waiter could wait 28 s and then start its own 25 s download (about 53 s).

## Criterion 2: cold start within `MCP_TIMEOUT` (run `cold`)

`bun harness/cold.ts` (then `RERUN=… bun harness/cold.ts` for the 35 and 40 Mbit/s points and the minified 100 Mbit/s point, and `bun harness/warm.ts`). Empty cache per repetition; the launcher's budget is 25 s; the client gives up at 40 s. Bandwidths are the stand-in's nominal rate; its per-chunk throttle delivers less, so the effective rate (bytes over the time beyond the unthrottled start) is given too. The cold sweep ran with change 1 only; changes 2 and 3 do not touch a single launcher's path.

| Build | Nominal rate | First-byte delay | `initialize` answered (ms), median (runs) | Effective rate | Outcome |
| --- | --- | --- | --- | --- | --- |
| plain | unthrottled | 0 | 1,116 (5: 1,094 to 1,518) | — | started |
| plain | unthrottled | 300 ms | 1,473 (3) | — | started |
| plain | 100 Mbit/s | 0 | 9,526 (3) | 85.6 Mbit/s | started |
| plain | 100 Mbit/s | 300 ms | 9,879 (1) | — | started |
| plain | 50 Mbit/s | 0 | 16,974 (3) | 45.3 Mbit/s | started |
| plain | 50 Mbit/s | 300 ms | 17,208 (1) | — | started |
| plain | 40 Mbit/s | 0 | 21,117 (1) | 36.0 Mbit/s | started |
| plain | 35 Mbit/s | 0 | 22,491 (1) | 33.6 Mbit/s | started |
| plain | 30, 25, 20, 10, 5 Mbit/s | 0 | 25,056 to 25,079 (1 each) | — | `unavailable` at the budget: "could not download AskBoard …" |
| min | unthrottled | 0 | 1,080 (3) | — | started |
| min | 100 Mbit/s | 0 | 9,534 (3) | — | started |
| min | 50 Mbit/s | 0 | 16,929 (3) | — | started |
| plain | warm (file in place) | — | 53 (5: 53 to 58) | — | started |

- **The first fetch fits the 25 s budget from about 31 Mbit/s effective** for the 90 MB darwin-arm64 executable. By size, the other targets need about 33 (darwin-x64, 99 MB) to 37 Mbit/s (linux glibc, 110 MB). Below that, every session start gives up at 25 s and answers `unavailable`, and the next session starts the download again from zero (no resume): on a slow link AskBoard never installs at session start.
- **Minifying changes nothing that matters:** 0.4% smaller, the same times.
- **A `.gz` asset would halve the fetch:** gzip -9 sizes from `dist/manifest.json` are 40.7 MB (darwin-arm64) to 51.6 MB (linux-x64), so the threshold falls to about 14 to 17.5 Mbit/s. The launcher would then need `gunzip`, which POSIX does not specify (it is on macOS, in Debian's essential set and in BusyBox).
- **The first exec of a freshly written executable costs about 1 to 1.5 s on macOS** (unthrottled cold start 1.1 s; a pre-seeded copy 1.6 to 1.8 s on its first start, run `offline`), against 53 ms warm: the system checks a new 90 MB file on first exec.
- **Verdict: pass with change.** The launcher meets `MCP_TIMEOUT` on every path, because its budget cuts the fetch at 25 s and answers `unavailable` with the reason. The first fetch itself completes at session start only on links from about 31 Mbit/s (darwin-arm64) or 37 Mbit/s (linux). Slower users need the fetch moved out of session start (a `command` source, or a download that continues detached after the budget and is picked up by the next session, with `curl -C -` resume), or a smaller asset.

## Criterion 4: concurrent sessions and the probe sibling (runs `concurrency`, `budget`)

`bun harness/concurrency.ts`; `bun harness/budget.ts`. Nine launchers at once on one empty cache at 50 Mbit/s nominal: eight plus a ninth killed right after its `initialize` answer (the probe sibling).

| Case | Downloads logged | Outcomes | Executable SHA-256 | Left in `bin/<version>/` |
| --- | --- | --- | --- | --- |
| Locked, 9 at once (`concurrency/locked`) | 1 | 8 started at 16,796 to 16,808 ms; the sibling answered at 16,798 ms and was killed | matches | `askboard` only |
| Lock-free control, 9 at once (`concurrency/lock-free`) | 9 | 9 started at 17,034 to 17,920 ms | matches | `askboard` only |
| SIGKILL of the downloading launcher after 3 s at 20 Mbit/s, then a new start (`concurrency/sigkill`) | 2 | new start: lock of the dead PID broken, its `.part` removed, started at 38,805 ms (budget raised to 60 s for this case) | matches | `askboard` only |
| SIGTERM instead (`concurrency/sigterm`) | 2 | after the signal: no lock, no `.part`, no curl left; new start: started at 38,849 ms | matches | `askboard` only |
| Holder at 20 Mbit/s, waiter started 1 s later (`budget`) | 1 | holder `unavailable` at 25,079 ms; waiter `unavailable` at 23,627 ms after its spawn ("timed out after 23s waiting for another session's download") | — | nothing |
| 3 at once at 50 Mbit/s (`budget`) | 1 | 3 started at 17,013 to 17,017 ms | — | `askboard` only |

- No process ever ran a partial or wrong file: the rename is atomic, and every started server's executable matched the pinned SHA-256.
- The lock saves bandwidth (1 download instead of 9), and waiters start within milliseconds of the holder. Without it, correctness still holds, at nine times the traffic.
- **SIGKILL leaves an orphaned curl** (`curl … -o …/askboard.53645.part`, seen right after the kill); it runs until its own timeout, writing to a file the next launcher has already unlinked. Nothing can trap SIGKILL; the next launcher breaks the lock (`kill -0` on the recorded PID) and removes the dead launcher's `.part`.
- **Residual race, not observed:** a launcher killed between `mkdir` of the lock and writing its PID leaves a lock with no PID, which waiters treat as live until the budget ends. A product launcher can break a lock older than the budget by its modification time. `kill -0` also reports another user's live process as gone, so the cache must not be shared between users.
- **Verdict: pass with change** (changes 1 to 3 above).

## Criterion 5: offline installation (run `offline`)

`bun harness/offline.ts offline`.

| Case | Outcome | `initialize` (ms) |
| --- | --- | --- |
| Release server down, empty cache | `unavailable`: "could not download AskBoard 0.0.1-spike from http://127.0.0.1:47819/…" (curl exit 7) | 52 |
| Release server down, executable copied into `bin/<version>/` beforehand | started, no request made | 1,781 (first exec of the copied file) |
| Mirror as a `file://` tree with the release layout (`ASKBOARD_RELEASE_URL=file://…`) | started; checksum checked | 1,067 |
| Mirror as a second HTTP server (`ASKBOARD_RELEASE_URL=http://127.0.0.1:47806/…`) | started; 1 download from the mirror | 1,165 |
| The plain bundle on Node 24.22.2 (`node dist/askboard.mjs`), no fetch | started | 194 |

- Offline use works three ways: a pre-seeded cache, a mirror URL (an HTTP proxy or a `file://` tree, both checked against the SHA-256 shipped in the plugin), or the plain bundle on Node. Each needs a documented setting: the cache path (`${CLAUDE_PLUGIN_DATA}/bin/<version>/askboard`), the mirror variable, or a plugin variant whose server runs `node`.
- **Verdict: pass with change:** AD-22 names neither the mirror override nor how to seed the cache.

## Criterion 14, client side: a failed start answers the handshake (run `failures`)

`bun harness/offline.ts failures`: the answering launcher (default) against the control `ASKBOARD_LAUNCHER_ON_FAILURE=exit`, budget 25 s, client timeout 40 s.

| Fault | Answering launcher | Control | Cache after |
| --- | --- | --- | --- |
| 404 | `initialize` at 50 ms; `ask` listed; instructions "AskBoard cannot start: could not download AskBoard 0.0.1-spike from …" | exit 1 at 41 ms, no answer | empty |
| Truncated body | 122 ms; "checksum mismatch for the downloaded AskBoard 0.0.1-spike (…)" | exit 1 at 115 ms | empty |
| Corrupted bytes | 167 ms; "checksum mismatch …" | exit 1 at 222 ms | empty |
| Hang after 64 KiB | 25,086 ms; "could not download …" (curl exit 28 at 25,008 ms) | exit 1 at 25,061 ms | empty |
| No curl or wget on `PATH` | 39 ms; "could not download …", stderr "neither curl nor wget is installed" | exit 1 at 36 ms | empty |

- The answering launcher always completes the handshake well within 30 s, lists one tool, `ask`, whose call returns `{"result":"unavailable","reason":…}` (AD-18), and stays up until stdin closes. The truncated body passed curl and was caught by the checksum.
- The no-tool case found a launcher prerequisite AD-22 does not list: a SHA-256 tool (`sha256sum`, `shasum` or `openssl`), none of which POSIX specifies. With none, the launcher would report a checksum mismatch, which names the wrong cause (read from the code, not run).
- Whether Claude Code then caches the failure is Claude Code's side (task 4.3).
- **Verdict: pass** for the client side.

## Criterion 15: Claude Code stays the parent (run `parent`)

`bun harness/offline.ts parent`, with `ASKBOARD_PROBE_LOG`.

| Case | Client PID | Launcher PID | Session process PID | Its parent PID |
| --- | --- | --- | --- | --- |
| Cold fetch, then exec | 51335 | 51336 | 51336 | 51335 |
| Warm | 51358 | 51359 | 51359 | 51358 |

- `exec` keeps the launcher's PID, so the session process's parent is the process that spawned the launcher, as the mod delivery spike's session-file key needs; the concurrency runs confirm it for all nine starts (`parentIsClient: true`).
- Hook mode with no executable: exit 0, one stderr line ("askboard: executable 0.0.1-spike not installed yet; hook skipped"), no request to the release server. With the executable in place: the executable's hook mode runs, exit 0, no output.
- **Verdict: pass.**

## Criterion 11, simulated: native Windows (run `windows-sim`)

`bun harness/offline.ts windows-sim`: an `uname` shim first on `PATH`.

| `uname -s` | Outcome |
| --- | --- |
| `MINGW64_NT-10.0-26100` | `initialize` at 32 ms; instructions "AskBoard cannot start: native Windows is not supported: install Claude Code in WSL and use AskBoard there. …"; `ask` returns `unavailable` with that reason |
| `MSYS_NT-10.0-26100` | the same, 32 ms |
| `CYGWIN_NT-10.0-26100` | the same, 38 ms |

- This covers a Windows machine where Claude Code starts the server's `command` through a POSIX shell (Git Bash, MSYS2 or Cygwin). Whether Claude Code on native Windows can start `${CLAUDE_PLUGIN_ROOT}/scripts/askboard` at all (a file with no extension and a shebang) is untested here: that is task 7.2 for the product owner.
- **Verdict: pass (simulated); the real run awaits the PO.**

## Prerequisite checks added after the Linux run (run `failures-fix`)

The Linux run found that a launcher with neither curl nor wget told the agent "could not download" (`evidence/linux.md`, run `linux-targets2`). The launcher now checks for a download tool and a SHA-256 tool before it takes the lock, and answers the handshake with the missing prerequisite as the reason. Run `failures-fix` (macOS, `PATH` limited to a folder of the tools the launcher needs, from `probe/`):

| `PATH` holds | `initialize` | Reason the agent sees | Cache |
| --- | --- | --- | --- |
| no curl, no wget | 37 ms | `neither curl nor wget is installed` | nothing written |
| curl, no `sha256sum`, `shasum` or `openssl` | 32 ms | `no SHA-256 tool is installed (sha256sum, shasum or openssl)` | nothing written |

Command: `CLAUDE_PLUGIN_DATA=<scratch>/pkg/data-nocurl-fix bun handshake.ts env PATH=<scratch>/pkg/nocurl-bin sh plugin/scripts/askboard`.
