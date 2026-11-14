# Linux runs (tasks 5.1 to 5.4, 2026-10-30)

Criteria 1, 8, 10 and 12 on Linux, design decisions 8 and 9. Harness: `linux/run.sh <check>`, run from the repository with `DOCKER_CONFIG=<scratch>/pkg/docker-config` (its `config.json` is `{}`: the credential helper hangs otherwise). Raw output is in `probe/runs/<run>/`, which git ignores; the tables below copy it.

## Environment

- Docker Desktop on this Mac, engine 29.5.2, `linux/arm64`. `linux/amd64` runs under Docker Desktop's emulation (`uname -m` prints `x86_64`).
- Images, pinned by index digest. Each run pulls the tag for its platform and checks that the registry returns the pinned digest, because Docker Desktop's image store keeps one platform variant per tag and refuses a second platform pulled by digest (`docker: cannot overwrite digest …`).

  | Image | Index digest | Role |
  | --- | --- | --- |
  | `debian:12-slim` | `sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3` | glibc |
  | `alpine:3.22` | `sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f` | musl |
  | `ubuntu:24.04` | `sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852` | CI stand-in |

- `probe/dist/` and `probe/plugin/` are mounted read-only. The launcher reads a copy of `plugin/scripts/release.txt` (`ASKBOARD_RELEASE_FILE=/runs/release.txt`, checked against `dist/` by SHA-256 before the runs) so that other runs rewriting the file cannot change the pins mid-run.
- Release server: `linux/release-mirror.ts` on the host's `127.0.0.1:47841`, reached from the containers as `host.docker.internal` (`ASKBOARD_RELEASE_URL=http://host.docker.internal:47841/askboard/askboard/releases/download`). Docker Desktop forwards that name to the host's loopback: a `wget --spider` from Alpine got the `302`.
- Containers are named `p-pkg-*`, run with `--rm` and were removed after each check; `linux/run.sh cleanup` found none left.

## Harness finding: the probe's release server redirects to `127.0.0.1`

The first `linux-targets` attempt (run `linux-targets-first`) used `probe/release-server.ts`. Its `302` names `http://127.0.0.1:<port>/objects/…`, which inside a container is the container itself, so every container download failed (`could not download AskBoard …`, the launcher then answered the handshake with that reason, as designed). GitHub's own redirect goes to a public host, so this is a stand-in limitation, not a launcher fault. `linux/release-mirror.ts` answers with a relative `Location`, which both curl and BusyBox `wget` followed.

## 5.1 Executables and the launcher per target (run `linux-targets2`)

Command: `RUN=linux-targets2 linux/run.sh targets` (the mirror started first: `PORT=47841 LOG=probe/runs/linux-targets2/mirror.jsonl bun linux/release-mirror.ts`). Times are from `probe/handshake.ts` run on the host through `docker exec -i`, so they include about 50 ms of `docker exec`; amd64 runs are emulated.

| Image, platform | Download tool / SHA-256 tool the launcher found | Asset the launcher fetched | Direct `doctor` and `initialize` | Launcher cold (fetch included), to `initialize` | Launcher warm | Hook with the executable present |
| --- | --- | --- | --- | --- | --- | --- |
| debian arm64 | curl 7.88.1 (installed: the image has neither curl nor wget) / `sha256sum` | `askboard-linux-arm64` (110,021,624 B) | ok, `bun 1.4.4`, `linux/arm64` | 498 ms, `ask` listed | 85 ms | exit 0 |
| alpine arm64 | BusyBox `wget` / BusyBox `sha256sum` | `askboard-linux-arm64-musl` (102,440,040 B) | **fails as shipped**: `Error loading shared library libstdc++.so.6` and missing C++ runtime symbols; ok after `apk add libstdc++ libgcc` | 695 ms, `ask` listed | 92 ms | exit 0 |
| debian amd64 (emulated) | curl / `sha256sum` | `askboard-linux-x64` (109,934,768 B) | ok, `linux/x64` | 1,451 ms | 867 ms | exit 0 |
| alpine amd64 (emulated) | BusyBox `wget` / BusyBox `sha256sum` | `askboard-linux-x64-musl` (103,523,752 B) | fails as shipped, the same `libstdc++.so.6` error; ok after `apk add libstdc++ libgcc` | 1,478 ms | 807 ms | exit 0 |

- **Target detection:** the launcher picked the musl asset exactly where `/lib/ld-musl-*` exists (`/lib/ld-musl-aarch64.so.1`, `/lib/ld-musl-x86_64.so.1`) and the glibc asset on Debian; the mirror's log names each asset with the client's user agent (`curl/7.88.1` on Debian, `Wget` on Alpine).
- **One download per container, no partial file:** the cache held only `bin/0.0.1-spike/askboard` after the cold start, and the warm start fetched nothing (one `release` and one `download` line per container in `mirror.jsonl`).
- **Bun's musl executables need `libstdc++` and `libgcc`** (verdict for criterion 1 on musl: pass with change). Alpine 3.22 does not install them by default. Claude Code's setup page (https://code.claude.com/docs/en/setup, "Alpine Linux and musl-based distributions", read 2026-10-30) requires `libgcc`, `libstdc++` and `ripgrep` at runtime and `curl` to install, so a machine where Claude Code runs on Alpine already has both libraries and `curl`; AD-22's launcher prerequisites and the documentation must name them, and the launcher can check for `libstdc++.so.6` before fetching and say so instead of exec'ing a file that cannot load.
- **Debian slim has neither curl nor wget** (run `linux-targets2`, `nocurl.txt`): the launcher answers the handshake in 64 ms with the `ask` tool returning `unavailable`. Its `instructions` say `could not download AskBoard …`, while only its stderr says `neither curl nor wget is installed`: the reason the agent and the user see should name the missing tool (a launcher fix for its owner). The hook without the executable printed `executable 0.0.1-spike not installed yet; hook skipped` and exited 0.
- Verdict, criterion 1 on Linux: **pass** for glibc arm64 and x64 (x64 emulated), **pass with change** for musl (the two libraries).

## 5.2 Devcontainer binding (run `linux-devcontainer`, criterion 8)

Command: `RUN=linux-devcontainer linux/run.sh devcontainer`. The stand-in runs `askboard serve-board` in Debian arm64 with `ASKBOARD_PORT=47850`; the host then requests the printed link and `127.0.0.1:<host port>`.

| Case | Publish | Environment | Printed link | Printed link from the host | `127.0.0.1:<host port>` from the host | Stderr |
| --- | --- | --- | --- | --- | --- | --- |
| default (loopback) | `-p 127.0.0.1:47850:47850` | — | `http://127.0.0.1:47850/b/…` | no answer (`000`) | no answer | — |
| opt-in | `-p 127.0.0.1:47850:47850` | `ASKBOARD_BIND_CONTAINER=1` | `http://127.0.0.1:47850/b/…` | `200` | `200` | `askboard: warning: board listener bound to 0.0.0.0:47850, a non-loopback interface (container opt-in)` |
| opt-in, link host set | `-p 127.0.0.1:47850:47850` | opt-in, `ASKBOARD_LINK_HOST=localhost` | `http://localhost:47850/b/…` | `200` | `200` | the same warning |
| opt-in, other host port | `-p 127.0.0.1:47851:47850` | opt-in | `http://127.0.0.1:47850/b/…` | no answer | `200` on 47851 | the same warning |
| opt-in, no host address in `-p` | `-p 47852:47850` | opt-in | `http://127.0.0.1:47850/b/…` | no answer | `200` on 47852 | the same warning |

- **The opt-in is necessary:** a listener on the container's `127.0.0.1` is unreachable through a published port; with the opt-in, the host reaches the board and the stand-in warns on stderr, as AD-11 requires.
- **The host-side address in links** is right only when the host port equals the container port, as the devcontainer guide's `127.0.0.1:<port>:<port>` prescribes. With another host port, the printed link fails: the implementation's "host-side link address" setting (spine Deferred) needs a port as well as a host.
- **`-p <port>:<port>` without `127.0.0.1:`** publishes on every host interface (Docker's default), which AD-11 forbids; the guide must keep the `127.0.0.1:` prefix, and `doctor` could warn when it sees the container binding without being able to check the host side.
- Verdict, criterion 8: **pass** for the opt-in binding and the published port; **pass with change** for the host-side address (a port in the setting).
- Not covered: VS Code Dev Containers. They set `BROWSER` to a helper that opens URLs on the host and forward ports themselves, which may make the opt-in unnecessary there; this needs a run in VS Code (product owner).

## 5.3 CI stand-in (run `linux-ci-sim`, criterion 10)

Command: `RUN=linux-ci-sim linux/run.sh ci-sim`. Ubuntu 24.04 arm64 with `CI=true GITHUB_ACTIONS=true`, curl installed (6 s).

- Launcher cold start through the mirror: `initialize` in 305 ms, `ask` listed.
- `detect`: `{"reachable":false,"reason":"container-without-binding"}`: in a container, the container rule fires before the CI rule. A GitHub-hosted runner is a VM, not a container; the CI rule itself is exercised in the detect matrix below (`ci-runner`).
- The `ask` tool through the launcher returned `{"result":"unavailable","reason":"container-without-binding"}` before any ask was created.
- Verdict, criterion 10: **pass** for the container stand-in; **awaiting PO** for a real runner: `ci/packaging-probe.yml` (kept in the change, not under `.github/`) runs the build, the direct executable, the Node bundle, the launcher against the release server on the runner's `127.0.0.1` cold and warm, and the `ask` tool, on `ubuntu-24.04` and, on request, `macos-latest`. `ubuntu-24.04-arm` is left out: GitHub's arm64 Linux runners are free only for public repositories.

## 5.4 "No reachable browser" (run `linux-detect`, criterion 12)

Command: `RUN=linux-detect linux/run.sh detect`. The macOS rows run `probe/dist/askboard-darwin-arm64 detect` on this Mac; the container rows run in Debian and Alpine arm64. "Container marker hidden" moves `/.dockerenv` aside so the same container stands in for a plain Linux host; `xdg-open` and `wslview` are shims (`exit 0`), so these rows test the rule, not the opener.

| Platform | Inputs | Reachable | Reason |
| --- | --- | --- | --- |
| macOS | as is | true | `open` |
| macOS | `SSH_CONNECTION` set | false | `remote-host` |
| macOS | `BROWSER=firefox` | true | `BROWSER` |
| macOS | `CI=true` | false | `ci-runner` |
| macOS | `CODESPACES=true` | false | `remote-host` |
| Debian and Alpine container | as is | false | `container-without-binding` |
| Debian and Alpine container | `ASKBOARD_BIND_CONTAINER=1` | true | `container-binding-opt-in (terminal link only)` |
| Debian and Alpine container | `BROWSER=firefox` | false | `container-without-binding` |
| Debian and Alpine container | `WSL_DISTRO_NAME=Ubuntu` | false | `container-without-binding` |
| Linux (marker hidden) | no `DISPLAY`, no `xdg-open` | false | `no-opener` |
| Linux (marker hidden) | `CI=true GITHUB_ACTIONS=true` | false | `ci-runner` |
| Linux (marker hidden) | `DISPLAY=:0`, no `xdg-open` | false | `no-opener` |
| Linux (marker hidden) | `DISPLAY=:0`, `xdg-open` | true | `xdg-open` |
| Linux (marker hidden) | `xdg-open`, no `DISPLAY` | false | `no-opener` |
| Linux (marker hidden) | `CI=true`, `DISPLAY=:0`, `xdg-open` | false | `ci-runner` |
| Linux (marker hidden) | `WSL_DISTRO_NAME=Ubuntu`, no `wslview` | false | `no-opener` |
| Linux (marker hidden) | `WSL_DISTRO_NAME=Ubuntu`, `wslview` | true | `wslview` |

Debian and Alpine gave the same row for every input.

- The rule's order (remote host, container without opt-in, CI without `BROWSER`, then an opener) gives the expected verdict for every forced input, and the check runs before any ask is created (the CI stand-in's `ask` call).
- **Order question for the product owner:** in a container, `BROWSER` does not count, because the container rule comes first. That matches AD-11 for a plain Docker container, but VS Code Dev Containers set `BROWSER` to a host-opening helper and forward ports, so there a `BROWSER` inside a container may mean "reachable" (see 5.2).
- `explorer.exe` without `wslview` under WSL was not forced (the probe checks `explorer.exe` on `PATH`; WSL puts Windows' `PATH` entries there by default). WSL itself is untested here (task 7.1).

## Untested here

- WSL 1 and 2: no Windows machine (task 7.1, product owner).
- A GitHub-hosted runner: the spike never pushes (task 7.3, `ci/packaging-probe.yml`).
- amd64 on real hardware: the amd64 rows ran under Docker Desktop's emulation, which explains the slower warm starts (about 0.8 s against 0.09 s native).
- VS Code Dev Containers and Codespaces port forwarding.
- A real `xdg-open` with a desktop session, and Wayland.
