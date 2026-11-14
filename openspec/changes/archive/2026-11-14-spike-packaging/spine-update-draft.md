# Spine update draft: packaging spike

Replacement texts for task 8.4, drafted before the PO's decisions (task 8.2). Each block belongs to one row of "Proposed outcomes (awaiting the PO)" in `findings.md` and applies only if the PO accepts that row. Each block quotes the current text exactly, then gives the replacement. A block marked with a letter (`1.A`) applies only if the PO picks that row's alternative. AD IDs stay stable: every AD is amended in place, and no AD is added.

Files, all under `docs/`:

- **Spine:** `architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`
- **Solution design:** `architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`
- **PRD:** `prd-askboard-2026-10-25/prd.md` (row 7 only)
- **Addendum:** `prd-askboard-2026-10-25/addendum.md` (row 7 only)

How to apply:

- Apply the blocks of accepted rows only. For a row accepted with changes, edit its blocks first.
- A phrase block replaces only the quoted phrase; the rest of the line stays. An "Insert after" or "Insert before" block adds its text next to the quoted anchor.
- Where two rows touch one passage, they replace different phrases of it or insert at different anchors, so their blocks apply in any order, except where a block says otherwise:
  - spine AD-22, Executables: row 1 inserts after the "At start" bullet, rows 2 and 6 insert before "**Diagnostics:**" (row 2 first), row 3 replaces the launcher bullet, row 4 replaces the first bullet (5.A replaces the same bullet: apply 4.1 to 5.A's text if both are accepted);
  - spine AD-11, No outbound traffic: rows 1 (1.2) and 1.A replace the same phrase; only one applies;
  - solution design §4.10, the launcher bullet: row 3 replaces its first sentence, row 1 its second; rows 1 and 2 insert after it (1.4 first, then 2.2);
  - solution design §8: rows 4, 5, 6, 10 and 11 touch different bullets;
  - solution design §11 entry 7 and §9's named exceptions: rows 7 and 7.A are exclusive;
  - solution design §12: rows 8 and 13 touch different rows;
  - solution design §13: row 12 only.
- The mod delivery and renderer spikes' drafts touch the same front matter, the spine's Deferred table (other rows), solution design §12's "Architecture spikes" row and §13 (new facts F39 to F47 in the renderer draft). Whichever change applies second quotes the text the first one left: block 13.3 removes only this spike's phrase, and the new facts of block 12.5 take the next free IDs at apply time (numbered F48 onwards here, assuming the renderer draft's F39 to F47 are in place; renumber them and their citations otherwise).
- A sentence tagged `[row N]` stays only if row N is accepted; drop the tag when applying.
- Set `updated:` to the apply date in every file changed.
- Verify with `git diff --exit-code origin/main -- docs/` before applying (empty: this draft changed nothing), then, after applying, with `openspec validate --all --strict --no-interactive`, `bun run check`, and a grep showing that no Deferred row of the spine still names the packaging spike as pending (`grep -n 'Packaging spike |' docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` finds none) (task 8.4).

| Row | Touches |
| --- | --- |
| 1 | Spine AD-11, AD-22; solution design §4.10 (spine AD-19 for 1.A and 1.B) |
| 2 | Spine AD-22; solution design §4.10 |
| 3 | Spine AD-22; solution design §4.10 |
| 4 | Spine AD-22; solution design §8 (CI) |
| 5 | Spine AD-22; solution design §8 (solution design §4.10 for 5.A) |
| 6 | Spine AD-22; solution design §8 |
| 7 | PRD NFR-6; addendum adoption rule; spine AD-19; solution design §4.10, §9, §11 (7.A: spine AD-19; solution design §9, §11) |
| 8 | Spine AD-11, Deferred (implementation row); solution design §12 (implementation row) |
| 9 | Spine AD-18 |
| 10 | Solution design §8 (spine AD-21 for 10.A) |
| 11 | Spine AD-22; solution design §8 |
| 12 | Solution design §13 |
| 13 | Spine Deferred; solution design §10.4, §12; front matter |

## Row 1: the delivery path

Applies only if the PO accepts row 1 (the launcher under `scripts/`, fetching from GitHub Releases, with a detached first download and gzip assets).

### 1.1 Spine, AD-22, Rule, Executables (insert after)

Current (spine), the anchor:

```text
    - At start, versions the installed plugin no longer pins are pruned, along with session files whose process is gone.
```

Insert after:

```text
    - The launcher sits in `scripts/` and fetches the executable from the release the plugin pins. It takes a lock by `mkdir`, breaks a lock whose owner is gone, removes partial files left by killed launchers, downloads to a temporary name, checks the SHA-256 shipped in the plugin, renames the file into place and `exec`s it, so Claude Code stays the parent of the session process.
    - Waiting for another session's download and downloading share one 25 s budget, so the handshake is always answered within `MCP_TIMEOUT`. A first download still running when the budget ends continues detached, holding the lock, and the launcher answers as on a failed start that AskBoard is downloading; the next start uses the file.
    - Each release publishes every executable both raw and gzip-compressed; the launcher fetches the compressed asset when `gzip` is present.
```

### 1.2 Spine, AD-11, Rule, No outbound traffic, second bullet (phrase)

Current (spine):

```text
The one exception is the launcher fetching the pinned executable before the session process starts.
```

Replacement:

```text
The one exception is the launcher fetching the pinned executable before the session process starts; a first download that outlasts the launcher's 25 s budget continues detached and serves the next start.
```

### 1.3 Solution design, §4.10, the launcher bullet, second sentence (phrase)

Current (solution design):

```text
Before the session process starts, it fetches the pinned executable to a temporary name, checks the shipped SHA-256 and renames it under a lock, so concurrent sessions and the probe sibling never see a partial file.
```

Replacement:

```text
Before the session process starts, it fetches the pinned executable to a temporary name, checks the shipped SHA-256, renames it under a lock and `exec`s it, so concurrent sessions and the probe sibling never see a partial file and Claude Code stays the parent: nine launchers on one empty cache made one download (packaging spike, run `concurrency`). Waiting and downloading share a 25 s budget; a first download still running then continues detached, and the launcher answers that AskBoard is downloading.
```

### 1.4 Solution design, §4.10 (insert after the launcher bullet)

Current (solution design), the anchor: the bullet that starts

```text
- **The launcher** needs only POSIX `sh` and `curl` or `wget`.
```

Insert after that bullet:

```text
- **Delivery, measured** (packaging spike). The executable is 90 MB (darwin-arm64) to 110 MB (linux glibc), 41 to 52 MB gzip; Bun's runtime is almost all of it [F51]. A first fetch fits the 25 s budget from about 31 Mbit/s (darwin-arm64) to 37 Mbit/s (linux), about half that with gzip assets; a warm start answers in about 50 ms. A plugin `command` source would fetch at install instead, with no 30 s limit, but it shows the user an install prompt, re-runs in the background every session, is off where `disableCommandPluginSources` is set, and copies 86 MB into the plugin cache [F23]. Neither the `npm` nor the `archive` source carries per-platform executables. The launcher keeps the plain GitHub-marketplace plugin and runs the hooks too.
```

### 1.A If the PO picks the `command` source

Spine, AD-19, Rule, Bundle, second bullet (phrase). Current:

```text
One Claude Code plugin from a GitHub marketplace carries the MCP server, the skills, the agents and `hooks/hooks.json`.
```

Replacement:

```text
One Claude Code plugin from a GitHub marketplace carries the MCP server, the skills, the agents and `hooks/hooks.json`. Its marketplace entry is a `command` source: a POSIX script that fetches the executable for the machine, checks its SHA-256 and prints the plugin directory, at install, at update and in Claude Code's once-per-session background run.
```

Spine, AD-11, Rule, No outbound traffic, second bullet (phrase). Current:

```text
The one exception is the launcher fetching the pinned executable before the session process starts.
```

Replacement:

```text
The one exception is the plugin's `command` source fetching the pinned executable at install and update, and in Claude Code's once-per-session background run.
```

Spine, AD-22, Rule, Executables, first bullet. Current:

```text
    - Executables are cached under `${CLAUDE_PLUGIN_DATA}/bin/<version>/`. Each session runs the version its plugin pinned when the session started.
```

Replacement:

```text
    - The executable lives in the plugin directory the `command` source prints, which Claude Code copies into its plugin cache. Each session runs the version its plugin pinned when the session started. Installing needs the user to accept the command (`--yes` in scripts), and organizations that set `disableCommandPluginSources` cannot install AskBoard.
```

### 1.B If the PO picks the plain bundle on Node only

Spine, AD-19, Rule, Executable, first bullet. Current:

```text
    - The session process ships as a Bun-compiled executable for macOS and Linux on x64 and arm64, with Linux builds for glibc and musl.
```

Replacement:

```text
    - The session process ships as the plain JavaScript bundle inside the plugin, run on Node 24.22.1 or later, a declared prerequisite. Bun is the build tool only, and AskBoard fetches nothing.
```

## Row 2: a failed start answers the handshake

Applies only if the PO accepts row 2. It closes the mod delivery spike's proposed outcome row 16.

### 2.1 Spine, AD-22, Rule, Executables (insert before)

Current (spine), the anchor:

```text
  - **Diagnostics:**
```

Insert before (as the last bullet of Executables):

```text
    - When the launcher cannot start the executable (no download tool or SHA-256 tool, a failed fetch, a checksum mismatch, an unsupported platform, native Windows), it does not exit: it answers the MCP handshake with the reason in its instructions and one `ask` tool that returns `unavailable` with that reason, until stdin closes. Claude Code skips a plugin server whose start failed for 15 minutes across sessions [F48].
```

### 2.2 Solution design, §4.10 (insert after the launcher bullet, after block 1.4 if row 1 is accepted)

Insert:

```text
- **A failed start answers the handshake** (packaging spike, criterion 14). A launcher that exits leaves Claude Code skipping AskBoard in new sessions for 15 minutes, until `/mcp` Reconnect; one that answers the handshake with `unavailable` and the reason left no cached failure, and the next session started normally. The cost: `/mcp` shows AskBoard connected with one tool.
```

## Row 3: the launcher's prerequisites

Applies only if the PO accepts row 3.

### 3.1 Spine, AD-22, Rule, Executables, third bullet

Current (spine):

```text
    - The launcher needs only POSIX `sh` and `curl` or `wget`.
```

Replacement:

```text
    - The launcher needs POSIX `sh`, `curl` or `wget`, and one SHA-256 tool (`sha256sum`, `shasum` or `openssl`). On musl Linux the executable also needs `libstdc++` and `libgcc`, which Claude Code requires there too. The launcher checks them before taking the lock and names the missing one.
```

### 3.2 Solution design, §4.10, the launcher bullet, first sentence (phrase)

Current (solution design):

```text
**The launcher** needs only POSIX `sh` and `curl` or `wget`.
```

Replacement:

```text
**The launcher** needs POSIX `sh`, `curl` or `wget`, and one SHA-256 tool (`sha256sum`, `shasum` or `openssl`; none is POSIX, and macOS has no `sha256sum`), and on musl Linux `libstdc++` and `libgcc` [F52, F53].
```

## Row 4: `${CLAUDE_PLUGIN_DATA}` under `--plugin-dir`

Applies only if the PO accepts row 4.

### 4.1 Spine, AD-22, Rule, Executables, first bullet

Current (spine):

```text
    - Executables are cached under `${CLAUDE_PLUGIN_DATA}/bin/<version>/`. Each session runs the version its plugin pinned when the session started.
```

Replacement:

```text
    - Executables are cached under `${CLAUDE_PLUGIN_DATA}/bin/<version>/`. When that variable is unset, empty or not substituted (a plugin loaded with `--plugin-dir` [F50]), the cache is `${XDG_CACHE_HOME:-$HOME/.cache}/askboard/bin/<version>/`. Each session runs the version its plugin pinned when the session started.
```

### 4.2 Solution design, §8, the CI bullet

Current (solution design):

```text
- **CI** runs `claude -p --plugin-dir --max-turns`; mods and hooks run under `-p` [F11], where calls are not backgrounded by default [F18].
```

Replacement:

```text
- **CI** runs `claude -p --plugin-dir --max-turns`; mods and hooks run under `-p` [F11], where calls are not backgrounded by default [F18]. Under `--plugin-dir`, `${CLAUDE_PLUGIN_DATA}` reaches the server unsubstituted [F50], so the launcher caches the executable under `${XDG_CACHE_HOME:-$HOME/.cache}/askboard/` there (AD-22).
```

### 4.A If the PO picks refusing under `--plugin-dir`

Solution design, §8, the CI bullet. Current: as in 4.2. Replacement:

```text
- **CI** installs AskBoard from a local marketplace into an isolated configuration (`CLAUDE_CONFIG_DIR`), then runs `claude -p --max-turns`; mods and hooks run under `-p` [F11], where calls are not backgrounded by default [F18]. Under `--plugin-dir`, `${CLAUDE_PLUGIN_DATA}` reaches the server unsubstituted [F50], and the launcher answers `unavailable` there.
```

## Row 5: uninstall deletes the executable cache

Applies only if the PO accepts row 5.

### 5.1 Spine, AD-22, Rule, Environments, last bullet

Current (spine):

```text
    - Uninstalling leaves `.askboard/` in projects, and the documentation lists it with the session-file folder and the executable cache.
```

Replacement:

```text
    - Uninstalling the plugin from its last scope deletes `${CLAUDE_PLUGIN_DATA}`, and the executable cache with it, unless `claude plugin uninstall --keep-data` [F49]. It leaves `.askboard/` in projects and the session-file folder. The documentation lists all three, with the `--keep-data` case.
```

### 5.2 Solution design, §8, the devcontainers bullet (phrase)

Current (solution design):

```text
and uninstalling leaves `.askboard/`, the session-file folder, and the executable cache; the documentation lists all three (AD-22).
```

Replacement:

```text
and uninstalling leaves `.askboard/` and the session-file folder, while Claude Code deletes `${CLAUDE_PLUGIN_DATA}`, and the executable cache with it, unless `--keep-data` [F49]; the documentation lists all three (AD-22).
```

### 5.A If the PO picks a cache outside `${CLAUDE_PLUGIN_DATA}`

Spine, AD-22, Rule, Executables, first bullet. Current: as in 4.1. Replacement:

```text
    - Executables are cached under `${XDG_CACHE_HOME:-$HOME/.cache}/askboard/bin/<version>/`, outside `${CLAUDE_PLUGIN_DATA}`, which Claude Code deletes on uninstall [F49]. Each session runs the version its plugin pinned when the session started.
```

Solution design, §4.10, the launcher bullet (phrase). Current:

```text
The cache, `${CLAUDE_PLUGIN_DATA}/bin/<version>/`, survives updates;
```

Replacement:

```text
The cache, `${XDG_CACHE_HOME:-$HOME/.cache}/askboard/bin/<version>/`, survives updates and uninstalls, and the documentation tells users how to remove it (90 to 110 MB per version);
```

Block 5.1 then reads "Uninstalling leaves `.askboard/` in projects, the session-file folder and the executable cache, and the documentation lists all three." and 5.2 keeps the current text.

## Row 6: offline installation

Applies only if the PO accepts row 6.

### 6.1 Spine, AD-22, Rule, Executables (insert before, after block 2.1 if row 2 is accepted)

Current (spine), the anchor:

```text
  - **Diagnostics:**
```

Insert before:

```text
    - Offline, AskBoard starts from an executable copied into the cache, from a mirror named in configuration (`http` or `file://`, the checksum still checked), or as the plain bundle on Node 24.22.1 or later. Otherwise the launcher answers as on a failed start.
```

### 6.2 Solution design, §8 (insert after the Installation bullet)

Current (solution design), the anchor:

```text
- **Installation.** One GitHub-marketplace plugin carries the server, skills, agents and `hooks/hooks.json` (settings hooks plus the mod). Scopes are user, project and local [F23]; FR-28 uses the first two. Hooks match `mcp__plugin_askboard_askboard__<tool>` and, for `--mcp-config` loading, `mcp__askboard__<tool>`. The server entry passes `CLAUDE_PROJECT_DIR` and sets no `timeout` shorter than `collect`'s 20 minutes. Shipped agents declare no frontmatter hooks, servers or permission mode, which plugin agents ignore [F4].
```

Insert after:

```text
- **Offline.** Three paths, each checked by the packaging spike (run `offline`): copy the executable into `${CLAUDE_PLUGIN_DATA}/bin/<version>/askboard`; name a mirror (`http` or `file://`), whose file is still checked against the shipped SHA-256; or run the plain bundle on Node 24.22.1 or later. Without one, the launcher answers `unavailable` in about 50 ms.
```

## Row 7: the licence exception (§11 entry 7)

Applies only if the PO grants the exception. 7.A applies instead if the PO refuses it. Either way, AXFX NFR-1 (§11 entry 8) is decided in the planning repository.

### 7.1 PRD, NFR-6

Current (PRD):

```text
- **NFR-6. Licence.** AskBoard is open source under the MIT licence. Every component it adopts has a licence compatible with MIT and meets the adoption rule in the addendum (quality, GitHub stars, recent activity); AskBoard depends on no paid or licence-key feature of a component.
```

Replacement:

```text
- **NFR-6. Licence.** AskBoard is open source under the MIT licence. Every component it adopts has a licence compatible with MIT and meets the adoption rule in the addendum (quality, GitHub stars, recent activity); AskBoard depends on no paid or licence-key feature of a component. One licence exception exists, under the conditions in the addendum: the LGPL runtime components that the Bun executable links unmodified. AskBoard's own code stays MIT, and every release also publishes the plain JavaScript bundle.
```

### 7.2 Addendum, adoption rule (insert after)

Current (addendum), the anchor:

```text
- **Activity:** a push within 6 months, a release within 12, not archived.
```

Insert after:

```text
- **Licence exception (NFR-6):** the runtime that `bun build --compile` links into the AskBoard executable, unmodified: Bun's patched JavaScriptCore/WebKit (LGPL-2, `oven-sh/WebKit` at the `WEBKIT_VERSION` of the pinned Bun: `d6375c72affe0f70222cdcb45012b10f0bf3a9d5` for Bun 1.4.4) and tinycc (LGPL-2.1, `oven-sh/tinycc` at `05f0fafaa3be31e31d7b4b5c17dc60f62c991171` for Bun 1.4.4), present on every target. Every release meets these obligations: it ships the LGPL-2 and LGPL-2.1 texts and Bun's `LICENSE.md` as its notices, names the exact Bun version, links both sources at those commits, and publishes the plain JavaScript bundle with the command that rebuilds the executable from it, so that a user can relink with a modified library. The exception waives the licence criterion for these two components only; Bun itself meets the stars and activity criteria.
```

### 7.3 Spine, AD-19, Rule, Dependencies, second bullet (phrase)

Current (spine):

```text
These are Bun's patched JavaScriptCore/WebKit (LGPL-2), and tinycc (LGPL-2.1) if it is present in the compiled output.
```

Replacement:

```text
These are Bun's patched JavaScriptCore/WebKit (LGPL-2) and tinycc (LGPL-2.1), both present in every compiled target.
```

### 7.4 Solution design, §4.10, Obligations bullet (phrase)

Current (solution design):

```text
Each release ships the LGPL texts and Bun's notices, names the Bun version, links the `oven-sh/WebKit` source Bun pins, and publishes the plain JavaScript bundle.
```

Replacement:

```text
Each release ships the LGPL-2 and LGPL-2.1 texts and Bun's whole `LICENSE.md` as its notices (about 50 statically linked libraries, none GPL-only), names the Bun version, links `oven-sh/WebKit` and `oven-sh/tinycc` at the commits Bun pins, and publishes the plain JavaScript bundle with the command that rebuilds the executable from it (`bun build askboard.mjs --compile`, exercised by the packaging spike).
```

### 7.5 Solution design, §9, Named exceptions (phrase)

Current (solution design):

```text
Only one: the LGPL runtime components of the Bun executable (§4.10), conditional on the PRD change.
```

Replacement:

```text
Only one: the LGPL runtime components of the Bun executable (§4.10), granted in NFR-6 and the addendum on <apply date>; the executable ships once AXFX NFR-1 admits it (§11 entry 8).
```

### 7.6 Solution design, §11, entry 7

Current (solution design):

```text
| 7 | NFR-6; adoption rule | The exception covers Bun's patched JavaScriptCore/WebKit (LGPL-2, `oven-sh/WebKit` at `WEBKIT_VERSION`) and tinycc (LGPL-2.1) if present, obligations met; otherwise named exceptions waive only stars. Until applied, or if refused: the plain bundle on Node 24.22.1+ | AD-19 | Pending: the product owner decides after the packaging spike (§10.4); until then the plain bundle on Node (AD-19) |
```

Replacement:

```text
| 7 | NFR-6; adoption rule | The exception covers Bun's patched JavaScriptCore/WebKit (LGPL-2, `oven-sh/WebKit` at `WEBKIT_VERSION`) and tinycc (LGPL-2.1), present on every target, obligations met; otherwise named exceptions waive only stars. Until applied, or if refused: the plain bundle on Node 24.22.1+ | AD-19 | Applied on <apply date> by `spike-packaging`: the product owner granted it on the spike's evidence; the executable ships once entry 8 is confirmed, until then the plain bundle on Node (AD-19) |
```

### 7.A If the PO refuses the exception

Spine, AD-19, Rule, Executable, first bullet. Current:

```text
    - The session process ships as a Bun-compiled executable for macOS and Linux on x64 and arm64, with Linux builds for glibc and musl.
```

Replacement:

```text
    - The session process ships as the plain JavaScript bundle, run on Node 24.22.1 or later. Bun is the build tool only: the product owner refused the licence exception for the Bun executable on <apply date>.
```

Spine, AD-19, Rule, Dependencies, second and last bullets. Current:

```text
    - A licence exception exists only through a PRD change, and the first one rests on it: the LGPL components the Bun executable links. These are Bun's patched JavaScriptCore/WebKit (LGPL-2), and tinycc (LGPL-2.1) if it is present in the compiled output.
```

and

```text
    - The exception holds once the PRD change to NFR-6 is applied and AXFX NFR-1 is confirmed to admit it. Until then, and if either is refused, AskBoard ships as the plain JavaScript bundle on Node 24.22.1 or later.
```

Replacement (the first; the second is removed, and so is the "Each release" bullet with its four sub-bullets):

```text
    - A licence exception exists only through a PRD change; none is granted.
```

Solution design, §9, Named exceptions (phrase). Current: as in 7.5. Replacement:

```text
None: the licence exception for the Bun executable was refused on <apply date> (§11 entry 7).
```

Solution design, §11, entry 7, status cell (phrase). Current:

```text
Pending: the product owner decides after the packaging spike (§10.4); until then the plain bundle on Node (AD-19)
```

Replacement:

```text
Refused on <apply date> by the product owner, on the packaging spike's evidence: AskBoard ships the plain bundle on Node 24.22.1 or later (AD-19)
```

Rows 1 to 6 then apply to the launcher only if the PO keeps a fetched executable for a later version; otherwise their blocks are dropped and 1.B applies.

## Row 8: devcontainers

Applies only if the PO accepts row 8.

### 8.1 Spine, AD-11, Rule, Binding, second bullet

Current (spine):

```text
    - In a devcontainer, binding the container interface happens only on explicit opt-in. The devcontainer guide publishes the port as `127.0.0.1:<port>:<port>`, and the session process warns on stderr whenever it binds a non-loopback interface.
```

Replacement:

```text
    - In a devcontainer, binding the container interface happens only on explicit opt-in. The devcontainer guide publishes the port as `127.0.0.1:<port>:<port>`, and the session process warns on stderr whenever it binds a non-loopback interface. Without the `127.0.0.1:` prefix Docker publishes the port on every host interface, so the guide never drops it. The host-side address in printed links is configured as host and port, since the published port can differ from the container's.
```

### 8.2 Spine, Deferred, the implementation row (phrase)

Current (spine):

```text
the host-side address in printed links
```

Replacement:

```text
the host-side address and port in printed links, whether VS Code Dev Containers' `BROWSER` helper and port forwarding make the container opt-in unnecessary there
```

### 8.3 Solution design, §12, the Implementation row (phrase)

Current (solution design):

```text
host-side link address
```

Replacement:

```text
host-side link address and port, VS Code Dev Containers' `BROWSER` helper and port forwarding
```

## Row 9: the detection rule behind `unavailable`

Applies only if the PO accepts row 9.

### 9.1 Spine, AD-18, Rule, When no board can be shown (insert after the first bullet)

Current (spine), the anchor:

```text
    - When AskBoard cannot show a board (no browser can reach it, or a remote host, AD-22), `ask` returns the typed result `unavailable` with its reason. That check is made before the ask is created.
```

Insert after:

```text
    - The check, in order: a remote host (`SSH_CONNECTION`, `SSH_TTY`, `CODESPACES`) is `unavailable`; a container (`/.dockerenv`, `/run/.containerenv`, `REMOTE_CONTAINERS`, `DEVCONTAINER`) is `unavailable` without the opt-in binding and gets the terminal link only with it; a CI runner (`CI`, `GITHUB_ACTIONS`) without `BROWSER` is `unavailable`; otherwise a board is reachable through `BROWSER`, `open` on macOS, `wslview` or `explorer.exe` under WSL, or `xdg-open` with `DISPLAY` or `WAYLAND_DISPLAY` on Linux, and `unavailable` when none is present.
```

## Row 10: background tabs

Applies only if the PO accepts row 10 (no change to AD-21).

### 10.1 Solution design, §8 (insert after the Platforms bullet)

Current (solution design), the anchor:

```text
- **Platforms.** macOS and Linux, x64 and arm64, glibc and musl, where Claude Code runs [F34]. Browsers: current and previous major versions of Chrome, Edge, Firefox and Safari.
```

Insert after:

```text
- **Background board tabs.** No browser discarded, froze or disconnected a hidden board tab in 65 minutes, but Chrome runs a hidden tab's timers once per 60 s [F33]. Board liveness therefore comes from the WebSocket closing, and any heartbeat timeout the session process applies is at least 90 s. A discarded tab closes its socket and reloads only when activated, so its ask is discarded after the grace period (AD-21). Chrome's Memory Saver and Safari wait for the product owner's check.
```

### 10.A If the PO picks keeping asks across a discard

Spine, AD-21, Rule, Discard, first bullet (phrase). Current:

```text
A reload reconnects within the grace period and keeps the ask and its draft.
```

Replacement:

```text
A reload reconnects within the grace period and keeps the ask and its draft. A tab the browser discarded reconnects when the user returns to it, within a longer discard grace period set in configuration, and keeps the ask and its draft the same way.
```

## Row 11: native Windows

Applies only if the PO accepts row 11.

### 11.1 Spine, AD-22, Rule, Environments (insert after the remote-host bullet)

Current (spine), the anchor:

```text
    - Claude Code running on a remote host (SSH, Codespaces) is out of the first version, and `ask` returns `unavailable` there (AD-18).
```

Insert after:

```text
    - On native Windows, where Claude Code runs the launcher through a POSIX `sh` (Git Bash, MSYS2, Cygwin), the launcher answers the handshake with a message naming WSL, as on a failed start. Without one, Claude Code reports that the server failed to start, the shipped skills fall back to AskUserQuestion (AD-18), and the README names WSL.
```

### 11.2 Solution design, §8, the Unsupported bullet (phrase)

Current (solution design):

```text
native Windows gets a message naming WSL (mechanism: packaging spike)
```

Replacement:

```text
native Windows gets a message naming WSL from the launcher where a POSIX `sh` runs it, and otherwise a server that failed to start, with the README naming WSL (AD-22)
```

## Row 12: facts

Applies only if the PO accepts row 12. New facts are numbered from F48 on the assumption that the renderer draft's F39 to F47 are in place; renumber at apply time otherwise.

### 12.1 Solution design, §13, F35

Current (solution design):

```text
| F35 | Bun 1.4.4 compiles for darwin and linux, x64 and arm64, glibc and musl, and links a patched WebKit (LGPL-2) and tinycc (LGPL-2.1) | AD-19 | https://github.com/oven-sh/bun/blob/main/LICENSE.md; https://bun.com/docs/bundler/executables | tinycc in output: packaging spike |
```

Replacement:

```text
| F35 | Bun 1.4.4 compiles for darwin and linux, x64 and arm64, glibc and musl, and links a patched WebKit (LGPL-2, `oven-sh/WebKit` at `d6375c72affe0f70222cdcb45012b10f0bf3a9d5`, set in `scripts/build/deps/webkit.ts`) and tinycc (LGPL-2.1, `oven-sh/tinycc` at `05f0fafaa3be31e31d7b4b5c17dc60f62c991171`); tinycc is in the output of all six targets | AD-19 | https://github.com/oven-sh/bun/blob/bun-v1.4.4/LICENSE.md; packaging spike, criteria 6 and 7 | |
```

### 12.2 Solution design, §13, F23

Current (solution design):

```text
| F23 | Plugin tool naming and scopes; `${CLAUDE_PLUGIN_DATA}` survives updates; official plugins ship servers via `npx`, `uvx`, `docker`, `bun run` or HTTP, none as a binary; some surfaces skip plugins with `bin/` | AD-19, AD-22 | https://code.claude.com/docs/en/plugins-reference | |
```

Replacement:

```text
| F23 | Plugin tool naming and scopes; `${CLAUDE_PLUGIN_DATA}` survives updates; official plugins ship servers via `npx`, `uvx`, `docker`, `bun run` or HTTP, none as a binary; some surfaces skip plugins with `bin/`. Plugin sources also include `command` (2.1.229+: a command the user accepts, run at install, at update and once per session in the background, its output copied up to 256 MiB, off under `disableCommandPluginSources`, through `cmd.exe` on Windows), `npm` (no install scripts, GitHub release tarballs refused) and `archive` (one zip, `https`, 256 MiB) | AD-19, AD-22 | https://code.claude.com/docs/en/plugins-reference; plugins/marketplace-reference and plugins/loading in the same documentation | |
```

### 12.3 Solution design, §13, F33

Current (solution design):

```text
| F33 | Whether a browser discards a background board tab | AD-21 | none found | Not checked: packaging spike |
```

Replacement:

```text
| F33 | In 65 minutes, no browser discarded, froze or disconnected a hidden board tab (Chrome 156 and Firefox 124, headless, no memory pressure); Chrome runs a hidden tab's timers once per 60 s after about a minute; a forced discard closes the WebSocket (1001) and reloads the tab only when it is activated | AD-21 | Packaging spike, runs `tab-hour`, `tab-drop`, `tab-forced` | Memory Saver and Safari: awaiting the product owner |
```

### 12.4 Solution design, §13, F18 (phrase)

Current (solution design):

```text
`MCP_TIMEOUT` 30 s
```

Replacement:

```text
`MCP_TIMEOUT` 30 s, after which the start counts as failed [F48]
```

### 12.5 Solution design, §13 (insert after F38, or after the last fact another draft added)

Current (solution design), the anchor:

```text
| F38 | Agent Skills: `name` up to 64 characters, `description` up to 1,024 | AD-18 | https://agentskills.io/specification | |
```

Insert after:

```text
| F48 | A plugin's stdio server that fails its first connection, a start over `MCP_TIMEOUT` included, is skipped by new sessions for 15 minutes; `/mcp` Reconnect or a change to its `command`, `args` or `env` retries. MCP startup does not block the session, so tools can appear after it starts | AD-22 | mcp in the Claude Code documentation; packaging spike, runs `p-fail-exit` and `p-fail-exit-next` | |
| F49 | Uninstalling a plugin from its last scope deletes its `${CLAUDE_PLUGIN_DATA}` folder, unless `--keep-data` | AD-22 | plugins/cli-reference in the Claude Code documentation; packaging spike, run `p-uninstall` | |
| F50 | For a plugin loaded with `--plugin-dir`, `${CLAUDE_PLUGIN_DATA}` reaches a stdio server unsubstituted | AD-22 | Packaging spike, run `p-cold2` (Claude Code 2.1.314) | |
| F51 | Bun 1.4.4 executables are 90.0 MB (darwin-arm64) to 110.0 MB (linux-arm64), 40.7 to 51.6 MB gzip; an empty program is 89.2 MB; `--minify` saves 0.4 MB | AD-19 | Packaging spike, `bun run build`, `dist/manifest.json` | |
| F52 | Bun's musl executables need `libstdc++` and `libgcc`, which Alpine lacks by default | AD-22 | Packaging spike, run `linux-targets2` | |
| F53 | Debian slim images have neither curl nor wget; Alpine's BusyBox provides `wget` and `sha256sum`; macOS has `shasum` and `openssl` but no `sha256sum` | AD-22 | Packaging spike, runs `linux-targets2` and `failures-fix` | |
```

## Row 13: Deferred, §10.4, §11 and §12

Applies only if the PO accepts row 13. Its alternative keeps both Deferred rows open until the product owner's runs (tasks 7.1 to 7.5) are done; then no block of this row applies.

### 13.1 Spine, Deferred, the two packaging rows

Current (spine):

```text
| Bun packaging: executable size, delivery through a plugin `command` source or the launcher, offline installation, tinycc in the output, the native Windows message | AD-19 and AD-22 fix the shape | Packaging spike |
| Detecting "no reachable browser" per platform | AD-18 fixes the outcome (`unavailable`) | Packaging spike |
```

Replacement (one row):

```text
| Packaging checks left to the product owner: the WSL notices and `$BROWSER`, native Windows, a GitHub-hosted runner, Chrome's Memory Saver and Safari on a background board tab, model runs of a failed start and of the `command` source's background re-run | The packaging spike settled the delivery path and the detection rule (AD-18, AD-19, AD-22); these runs confirm them | The product owner's runs (`spike-packaging` tasks 7.1 to 7.5) |
```

### 13.2 Solution design, §10.4 (insert after "What changes")

Current (solution design), the anchor:

```text
**What changes.** AD-19 and AD-22 record the delivery path; unmet LGPL obligations mean the Node bundle (AD-19); AD-18 gains the detection rule behind `unavailable`; tab discarding would reopen AD-21's grace rule.
```

Insert after:

```text
**Outcome (<apply date>).** The launcher under `scripts/` stays the delivery path [row 1]: one download for concurrent sessions, Claude Code kept as the parent, a 25 s budget that always answers the handshake, and a failed start answered with `unavailable` rather than an exit, which Claude Code would cache for 15 minutes [row 2]. A first fetch fits the budget only from about 31 to 37 Mbit/s. The executable is 90 to 110 MB and links tinycc on every target; the WebKit and tinycc commits and Bun's relink path are recorded for the licence exception (§11 entry 7). AD-18 gained the detection rule [row 9]; no tab was discarded in an hour, so AD-21 stands [row 10]. WSL, native Windows, a hosted runner, branded browsers and model runs wait for the product owner (spine, Deferred). Evidence: `openspec/changes/spike-packaging/findings.md`.
```

### 13.3 Solution design, §12, Architecture spikes row (phrase)

Current (solution design):

```text
; Bun packaging and "no reachable browser" detection (packaging)
```

Replacement: the phrase is removed. If the other spikes' drafts have already emptied the row, remove the row.

### 13.4 Solution design, §12, Product owner outside the Deferred table (phrase)

Current (solution design):

```text
The licence exception for the Bun executable (§11 entry 7), after the packaging spike;
```

Replacement (only while row 7 is undecided; once 7 or 7.A applies, the phrase is removed):

```text
The licence exception for the Bun executable (§11 entry 7), on the packaging spike's evidence; the packaging checks left to the product owner (spine, Deferred);
```

### 13.5 Front matter

Set `updated:` to the apply date in the spine and the solution design, and in the PRD and the addendum when row 7 applies.
