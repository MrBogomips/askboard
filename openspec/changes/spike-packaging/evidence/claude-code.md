# Claude Code runs (group 4: criteria 2, 3, 14, 15 and 16)

Run on 2026-10-30 between 11:38 and 11:48 CET (debug-log times are UTC, CET minus one hour), macOS arm64. Raw files: `probe/runs/p-*/` (git ignores `runs/`). Harness: `probe/harness/cc-run.sh` (headless), `probe/harness/cc-session.sh` (interactive, in tmux), `probe/harness/cc-relserver.sh` (release-server stand-in on ports 47861 to 47866), `probe/cmd-source.sh` (the `command` source).

## Versions and configuration (task 4.1)

- Claude Code **2.1.314** (the installed `claude`). npm dist-tags on 2026-10-30: `stable` 2.1.308, `latest` 2.1.314, `next` 2.1.314.
- Isolated configuration: `CLAUDE_CONFIG_DIR=<scratch>/pkg/cc-config`, throwaway git project `<scratch>/pkg/project`, every command under `env -i` with only `HOME`, `USER`, `PATH`, `TERM`, `LANG`, `TMPDIR`, `CLAUDE_CONFIG_DIR` and the probe's `ASKBOARD_*` variables.
- **The isolated configuration cannot make model calls.** `claude auth status` reports `loggedIn: true` with `authMethod: oauth_token`, but the credential it resolves is a profile credential file whose access token has expired with no refresh token (debug log of `p-cold`: `Access token at <profile credential file> has expired and no refresh is available (client_id set, refresh_token empty)`). The headless run `p-cold` ended with `Login expired · Run /login to sign in again`. Logging in needs the PO at a browser, so the runs below are **interactive sessions with no prompt sent**: they observe MCP start-up, the `/mcp` panel and the files Claude Code writes, which is what criteria 2, 3, 14 and 16 need, but not a model calling the tool. "Remote managed settings failed to load" shows on every start for the same reason.
- User configuration untouched: SHA-256 of `<user config>/settings.json`, `plugins/installed_plugins.json` and `plugins/known_marketplaces.json` identical before (11:37) and after (11:47); `mcp-needs-auth-cache.json` absent before and after.

Sessions used: 7 = 6 runs plus 1 retry. `p-cold` (headless, failed on the credential: a harness failure) and its retry `p-cold2`; `p-fail-exit`, `p-fail-exit-next`, `p-fail-answer`, `p-fail-answer-next`, `p-cmdsrc`. None sent a prompt to the model. Model-free CLI commands (`plugin marketplace add/remove`, `plugin install/uninstall/list`, `mcp list`, `mcp get`) are not counted.

## Criterion 2: cold start through the launcher (`p-cold`, `p-cold2`)

`p-cold2`: launcher form with `--plugin-dir <scratch>/pkg/plugin-cold2` (a copy of `probe/plugin`), empty cache, release server at 50 Mbit/s (`RATE=6250000`) with a 300 ms first-byte delay, 89,968,994-byte darwin-arm64 executable.

```text
10:41:06.419Z MCP server "plugin:askboard:askboard": Starting connection with timeout of 30000ms
10:41:23.820Z MCP server "plugin:askboard:askboard": Successfully connected (transport: stdio) in 17403ms
10:41:23.820Z MCP server "plugin:askboard:askboard": stdio server answered the server/discover probe after its bound, so it was only slow to start and speaks the new protocol; not remembering it as a legacy peer
```

- **Connected in 17.4 s**, within `MCP_TIMEOUT` (30 s); `/mcp` then showed `✔ plugin:askboard:askboard 1 tool`.
- Claude Code first sends a `server/discover` probe with a short bound; a server that answers late is treated as slow, not as a legacy peer.
- **Criterion 15:** the session process's parent is the Claude Code process (`ps`: server PID 43279, PPID 43258 = `claude`); the launcher `exec`s, so no `sh` sits between them.
- `p-cold` (headless, same setup at 11:38): the session ended after 2 s on the credential while the launcher was mid-download; Claude Code logged `stdio server process … has no established connection at exit; sending SIGINT`, and the launcher's signal trap left no `.part` file and no lock.

### Finding: `${CLAUDE_PLUGIN_DATA}` is not substituted for a `--plugin-dir` plugin

In `p-cold`, `p-cold2` and every `--plugin-dir` run, the server's environment held `CLAUDE_PLUGIN_DATA=${CLAUDE_PLUGIN_DATA}` literally (`ps eww` on the server), while `CLAUDE_PROJECT_DIR` was substituted and `CLAUDE_PLUGIN_ROOT` was set. Claude Code did create `<config>/plugins/data/askboard-inline/` (empty). The launcher took the literal value as a relative path and cached the 86 MB executable **inside the project**, in a folder named `${CLAUDE_PLUGIN_DATA}` (server `execPath`: `<project>/${CLAUDE_PLUGIN_DATA}/bin/0.0.1-spike/askboard`). For the installed plugin (`p-cmdsrc`), `claude mcp get` lists `CLAUDE_PLUGIN_DATA` among the server's environment variables, and `<config>/plugins/data/askboard-askboard-spike-pkg/` was created. Not separated in these runs: whether the missing remote policy verdict (`compliance taints feed config ${VAR} expansion`, logged while the managed settings failed to load) plays a part. Consequence: the launcher must refuse a value that still contains `${` (or is relative) and fall back to a fixed per-user cache, and CI's `claude -p --plugin-dir` runs (SOLUTION-DESIGN §8) hit this path.

## Criterion 14: a failed start (`p-fail-exit`, `p-fail-exit-next`, `p-fail-answer`, `p-fail-answer-next`)

Each pair: first session with the release server down and an empty cache, second session right after with the server up and an empty cache.

| Run | Launcher | Release server | What Claude Code did | `/mcp` | `mcp-needs-auth-cache.json` after |
| --- | --- | --- | --- | --- | --- |
| `p-fail-exit` (11:42:13) | exits 1 (`ASKBOARD_LAUNCHER_ON_FAILURE=exit`) | down | spawned it twice: `version negotiation probe closed the stdio server (rmcp-class pre-init hard close); respawning pinned legacy`, then `Connection failed after 263ms … (CONNECTION_CLOSED)`; the launcher's stderr is in the debug log | `✘ plugin:askboard:askboard` | `{"plugin:askboard:askboard":{"timestamp":…,"id":…}}` (written at the failure) |
| `p-fail-exit-next` (11:42:52) | exits 1 | **up** | **never started the server**: no `Starting connection` line, no request at the release server | `✘ failed` (Reconnect / Disable) | unchanged |
| — `/mcp` → Reconnect in `p-fail-exit-next` (11:43:31) | | up | `Successfully connected … in 1092ms`, one download | `Reconnected to plugin:askboard:askboard.` | `{}` (entry cleared) |
| `p-fail-answer` (11:43:48) | answers the handshake (default) | down | `Successfully connected (transport: stdio) in 218ms`, `protocolEra: legacy`, `negotiatedProtocolVersion: 2025-11-25`; the launcher's stderr line logged as server stderr | `✔ connected`, 1 tool | `{}` |
| `p-fail-answer-next` (11:44:31) | answers | up | `Successfully connected … in 1202ms`, one download | `✔` | `{}` |

- **Verdict: pass with change.** The exiting launcher's failure is cached: the next session does not even spawn the server, so AskBoard stays absent until the user picks Reconnect in `/mcp` (or the entry expires: the mod delivery spike saw about 15 minutes). The answering launcher leaves no cache entry, and the next session fetches and connects.
- Cost of the answering launcher: `/mcp` shows the failed start as `✔ connected` with 1 tool. The reason reaches the model through the server's `instructions` and the tool's description and `unavailable` result, and the user only through the debug log and the agent. The answer to `server/discover` (`-32601`) makes Claude Code fall back to the 2025-11-25 handshake, which `sh` can serve.

## Criterion 3: the `command` plugin source (`p-cmdsrc`)

- Local marketplace `<scratch>/pkg/mp`, entry `{"name":"askboard","source":{"source":"command","command":"sh <probe>/cmd-source.sh","timeout":120}}` (131 characters; the limit is 500).
- `claude plugin marketplace add <scratch>/pkg/mp`: `Successfully added marketplace: askboard-spike-pkg (declared in user settings)`.
- **Install prompt** (`claude plugin install askboard@askboard-spike-pkg --scope user`, without `--yes`):

  ```text
  "askboard" is installed by running a command from marketplace "askboard-spike-pkg" on this machine:
    sh <probe>/cmd-source.sh
    (mode "copy": its output directory is copied into the plugin cache)
  Run this command now? [y/N]
  ```

- With `--yes`: installed in **0.98 s** (local, unthrottled fetch); the release server logged one download at install. `claude plugin list`: `Version: 0.0.1-spike-9d587c131292` (manifest version plus a hash of the copied files), enabled.
- **Disk:** the copy in `<config>/plugins/cache/askboard-spike-pkg/askboard/0.0.1-spike-9d587c131292/` is 86 MB, and the command's own output folder holds another 86 MB, which the command may delete after it exits (copy mode).
- **Session start does not fetch.** `claude mcp list` (11:46:57) spawned the server straight from the plugin cache (`execPath …/plugins/cache/askboard-spike-pkg/askboard/0.0.1-spike-9d587c131292/bin-askboard/askboard`) and reported `✔ Connected` in about 2 s; the release server logged no request.
- **Not observed: the once-per-session background re-run.** In `p-cmdsrc` the plugin was not enabled, because the harness limited settings to `project,local` and the install is at user scope (`/mcp`: `No MCP servers configured`; debug: `Plugin autoupdate: not re-resolving askboard@askboard-spike-pkg (disabled or blocked by policy)`). With no retry left, the re-run is left to the PO (below).

Comparison facts for `findings.md` (launcher figures from `p-cold2` and the client runs):

| | Launcher under `scripts/` | `command` source |
| --- | --- | --- |
| When the executable is fetched | at the first session-process start (17.4 s at 50 Mbit/s in `p-cold2`) | at install and update, outside any session; again in the once-per-session background run (documented, not observed) |
| What the user sees at install | nothing beyond the plugin install | the command, shown for review, with a `[y/N]` prompt; `--yes` in scripts |
| Download per user | the executable for the user's target, once per version | the same, plus the plugin repository |
| Disk | one executable in `${CLAUDE_PLUGIN_DATA}/bin/<version>/` | the plugin-cache copy plus the command's own output (2 × 86 MB here, unless the command deletes its output) |
| Offline after install | works from the cache; a cold start offline fails at session start | works from the plugin cache; install or update offline fails at install |
| Organization policy | none specific | `disableCommandPluginSources` turns it off |
| Windows | `sh` launcher cannot run natively | the command runs through `cmd.exe` (documented) |
| Failure path | the launcher can answer the handshake (criterion 14) | the install or update fails with the command's exit; sessions keep the last good copy |

## Criterion 16: what uninstalling leaves (`p-uninstall`)

Stand-in executable cache written to `<config>/plugins/data/askboard-askboard-spike-pkg/bin/0.0.1-spike/askboard` before each uninstall:

- `claude plugin uninstall askboard@askboard-spike-pkg --scope user`: **the data folder, with the executable cache, is deleted**; the plugin cache `plugins/cache/askboard-spike-pkg/askboard/0.0.1-spike-9d587c131292/` (86 MB) stays.
- Reinstall, then `uninstall … --keep-data`: the data folder and the executable cache stay.
- The `--plugin-dir` data folder `plugins/data/askboard-inline/` stays after the sessions (empty here, since the executable went into the project, see above).
- The `command` source's own output folder (`<scratch>/pkg/cmdsrc-out/`, 86 MB) is outside Claude Code's control and stays.

So AD-22's "uninstalling leaves … the executable cache" holds only with `--keep-data`; by default Claude Code deletes it, and keeps the plugin cache instead.

## For the PO (awaiting PO)

Model calls in an isolated configuration need a login there. After `CLAUDE_CONFIG_DIR=<scratch>/pkg/cc-config claude` and `/login` in a browser, these repeat the runs with the model (from `openspec/changes/spike-packaging/probe/`):

```sh
bun release-server.ts   # in one terminal, PORT=47861 RATE=6250000 DELAY=300 WRITE_RELEASE=0
ASKBOARD_RELEASE_URL=http://127.0.0.1:47861/askboard/askboard/releases/download \
  sh harness/cc-run.sh p-cold-po <scratch>/pkg/plugin-cold2 \
  "Call the askboard ask tool with askId cold-1 and question 'hi', then reply with its result."
```

For the `command` source's once-per-session re-run: install at local scope in the project (`claude plugin install askboard@askboard-spike-pkg --scope local --yes`), start a session with `--setting-sources project,local`, and read the release server's log for a request shortly after the session starts.
