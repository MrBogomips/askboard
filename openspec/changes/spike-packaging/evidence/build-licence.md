# The executable, tinycc, WebKit and the licence evidence (tasks 1.2, 1.3, 2.1 to 2.3)

Run on 2026-10-30 on macOS 26 (Darwin 25.6.0, arm64), Bun 1.4.4, from `openspec/changes/spike-packaging/probe/`. MB is 10^6 bytes, MiB 2^20.

## Criterion 1: executable size per target

Build `bun run build` (`build.ts`, 2026-10-30T10:33:44Z, `dist/manifest.json`): `server.ts` (the session-process stand-in: `@modelcontextprotocol/server` 2.4.0, `zod` 4.6.7, `node:http`) compiled with `bun build --compile --target=<target>`, plain and with `--minify`; gzip at level 9.

| Target | Plain, raw MB | Plain, gzip MB | `--minify`, raw MB | `--minify`, gzip MB |
| --- | --- | --- | --- | --- |
| `darwin-arm64` | 90.0 (85.8 MiB) | 40.7 | 89.6 | 40.6 |
| `darwin-x64` | 99.0 (94.4 MiB) | 43.3 | 98.6 | 43.2 |
| `linux-x64` | 109.9 (104.8 MiB) | 51.6 | 109.5 | 51.6 |
| `linux-arm64` | 110.0 (104.9 MiB) | 51.4 | 109.6 | 51.3 |
| `linux-x64-musl` | 103.5 (98.7 MiB) | 48.1 | 103.1 | 48.0 |
| `linux-arm64-musl` | 102.4 (97.7 MiB) | 47.6 | 102.0 | 47.6 |
| Node bundle `askboard.mjs` (`--target=node --minify`) | 0.43 | 0.12 | — | — |

- **The runtime is the size.** An empty program (`console.log(1)`) compiles to 89.16 MB for `darwin-arm64` and 109.12 MB for `linux-x64` (`dist-extra/empty-*`), so the stand-in's code adds about 0.8 MB, and `--minify` saves 0.4 MB. The product's own code will not move these numbers much; the view bundle and widgets will add their own megabytes.
- **What a user downloads.** A GitHub release asset is served as stored. A raw asset is 86 to 105 MiB per target; a `.gz` asset is 41 to 52 MB, if the launcher decompresses them (`gzip -d` is on macOS here; on Linux images it was not checked by this task, and it is not in AD-22's prerequisite list). The six plain targets together: 586 MiB raw, 269 MiB gzip.
- **Warm start** (`bun handshake.ts <command>`, 5 runs each, spawn to the `initialize` answer, median): the `darwin-arm64` executable 46 ms (40 to 51; `tools/list` answered at 48 ms); the Node bundle on Node 24.22.2 (`~/.volta/tools/image/node/24.22.2/bin/node dist/askboard.mjs`) 84 ms (78 to 204, first run included).
- **First start of a new file on macOS.** A fresh copy of the `darwin-arm64` executable answered `initialize` in 1,465 ms on its first start and 41 ms on the second; the bundle recompiled in `dist-extra/` took 968 ms on its first start, then 37 to 41 ms. A launcher's first run after the download pays this once.
- **`darwin-x64` under Rosetta 2** (`oahd` running): `./dist/askboard-darwin-x64 doctor` reports `arch: x64`, `bun 1.4.4`; `initialize` in 761 to 765 ms over 3 runs.
- **Signature:** the compiled `darwin-arm64` file is ad-hoc, linker-signed (`codesign -dv`: `Signature=adhoc`, `TeamIdentifier=not set`). It ran from the launcher's cache after a `curl` download without a Gatekeeper prompt (task 3.1, run `smoke`); a file downloaded by a browser would carry the quarantine attribute (Bun docs, D18 in `docs.md`).

## Criterion 6: tinycc in the compiled output

Command, per executable: `strings -a <file> | grep -c -E 'tcc_new|tcc_compile_string|tcc_relocate|tcc_set_options'` (libtcc API names), `grep -c -i tinycc`, `grep -c -E 'libtcc1|tccdefs'`; `nm` finds no symbols because the executables are stripped (`nm -U` lists only `__mh_execute_header`). Positive control: `dist-extra/ffi-cc.ts`, which imports `cc` from `bun:ffi`, compiled for `darwin-arm64` and `linux-x64`.

| Executable | libtcc API strings | `tinycc` | `libtcc1`/`tccdefs` | Verdict |
| --- | --- | --- | --- | --- |
| `darwin-arm64` (plain, min) | 2 | 2 | 0 | present |
| `darwin-x64` (plain, min) | 2 | 4 | 1 | present |
| `linux-x64` (plain, min) | 2 | 4 | 1 | present |
| `linux-arm64` (plain, min) | 2 | 2 | 0 | present |
| `linux-x64-musl` (plain, min) | 2 | 4 | 1 | present |
| `linux-arm64-musl` (plain, min) | 2 | 2 | 0 | present |
| control `ffi-cc` `darwin-arm64` | 2 | 2 | 0 | present |
| control `ffi-cc` `linux-x64` | 2 | 4 | 1 | present |

The strings are libtcc's own messages (`'tcc_relocate()' twice is no longer supported`, `tcc_relocate returned a negative value`, `TinyCC failed`) and, on x64, Bun's `libtcc1` source. The stand-in never imports `bun:ffi`, and its counts equal the control's: **tinycc is in the output on all six targets, whether or not AskBoard uses `cc()`.** This matches Bun's build configuration at `bun-v1.4.4` (`scripts/build/config.ts`: `tinycc = !(abi === "android" || freebsd)`). TinyCC source: `oven-sh/tinycc` at `05f0fafaa3be31e31d7b4b5c17dc60f62c991171` (2026-07-20, `scripts/build/deps/tinycc.ts`), `COPYING` is LGPL-2.1 (26,428 bytes); the fork has 4 stars.

## Criterion 7: the WebKit commit and the relink steps

- **Pin:** `WEBKIT_VERSION = "d6375c72affe0f70222cdcb45012b10f0bf3a9d5"` in `scripts/build/deps/webkit.ts` at tag `bun-v1.4.4` (`gh api repos/oven-sh/bun/git/trees/bun-v1.4.4?recursive=1`; the `cmake/tools/SetupWebKit.cmake` path named in the brief no longer exists).
- **The commit exists:** `gh api repos/oven-sh/WebKit/commits/d6375c72…` → 2026-10-21T21:12:01Z, "[WTF] The suspend signal handler reads the interrupted stack pointer from the context (#817)", https://github.com/oven-sh/WebKit/commit/d6375c72affe0f70222cdcb45012b10f0bf3a9d5. Its prebuilt archives are release `autobuild-d6375c72affe0f70222cdcb45012b10f0bf3a9d5` (published 2026-10-21T21:32:19Z; `bun-webkit-{macos,linux}-{amd64,arm64}[-musl].tar.gz` among 47 assets).
- **Licence files at that commit:** `Source/JavaScriptCore/COPYING.LIB` (25,584 bytes, GNU LGPL), `Source/WebCore/LICENSE-LGPL-2` (25,378), `Source/WebCore/LICENSE-LGPL-2.1` (26,536). GitHub classifies the repository's licence as none (`license: null`); 119 stars, pushed 2026-10-30.
- **Bun's relink steps** (`LICENSE.md` at `bun-v1.4.4`): `git clone https://github.com/oven-sh/WebKit vendor/WebKit`; `bun sync-webkit-source` (checks out `WEBKIT_VERSION`); `bun run build:local`, which compiles JavaScriptCore and Bun's bindings and outputs a new `bun`.
- **Relinking AskBoard:** a user with a rebuilt `bun` recompiles AskBoard from the published plain bundle. Shown with the stock Bun in place of a modified one: `bun build dist/askboard.mjs --compile --target=bun-darwin-arm64 --outfile dist-extra/askboard-relinked-darwin-arm64` compiled in 175 ms, and the result answered `initialize` and listed `ask` (37 to 41 ms warm). So AD-19's obligation to publish the plain bundle is also what makes relinking possible. Not run: a Bun build from source (hours; out of the spike's time).

## NFR-6 evidence (§11 entry 7), for the product owner

- **What the exception would admit:** in every AskBoard executable, Bun 1.4.4's statically linked JavaScriptCore/WebKit (LGPL-2; WebCore files LGPL-2 and LGPL-2.1) from `oven-sh/WebKit` at `d6375c72…`, and tinycc (LGPL-2.1) from `oven-sh/tinycc` at `05f0fafa…`, present on all six targets (criterion 6). Both unmodified by AskBoard: AskBoard adds only its JavaScript to Bun's runtime.
- **Relink path:** LGPL-2 §6 asks that the user can relink with a modified library. The path exists and was exercised from the bundle: rebuild Bun with the modified WebKit (Bun's steps above), then `bun build askboard.mjs --compile`. It depends on Bun's build-from-source path staying public.
- **What each release ships:** `COPYING.LIB` (LGPL-2) and LGPL-2.1 texts; Bun's `LICENSE.md` at `bun-v1.4.4` as the notices (about 50 statically linked libraries, all permissive or dual, among them `zstd` BSD or GPLv2 and ICU 78; no GPL-only component listed); the exact Bun version (1.4.4); links to `oven-sh/WebKit` at `d6375c72…` and `oven-sh/tinycc` at `05f0fafa…`; the plain bundle `askboard.mjs` with the command that rebuilds the executable from it.
- **The adoption rule for the LGPL parts:** `oven-sh/WebKit` has 119 stars and `oven-sh/tinycc` 4, both under the 1,000 threshold; they are forks maintained by the Bun team (stars exceptions name "an established team"). The licence exception, not a stars exception, is what §11 entry 7 requests.
- **Alternatives without an exception:** the plain bundle on Node 24.22.1 or later (0.43 MB, warm start 84 ms on Node 24.22.2; needs Node on the machine); `deno compile` (Deno 2.9.8, MIT, passes the adoption rule below; its executables embed V8, BSD-3-Clause, and were not built here).

## Adoption (task 1.2), run date 2026-10-30

`GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts` → `evidence/adoption.json` (rule: permissive licence; at least 1,000 stars; a push within 6 months and a release within 12; not archived).

| Candidate | Licence | Stars | Last push | Last release | Verdict |
| --- | --- | --- | --- | --- | --- |
| Bun 1.4.4 (`oven-sh/bun`) | GitHub: NOASSERTION; file: "Bun itself is MIT-licensed", with LGPL-2 JavaScriptCore and LGPL-2.1 tinycc statically linked | 96,468 | 2026-10-30 | 2026-10-22 | review: activity and stars pass; the licence needs the §11 entry 7 exception |
| Node 24.22.1 (`nodejs/node`) | GitHub: NOASSERTION; file: "Node.js is licensed for use as follows:" (MIT, with bundled third-party notices) | 123,097 | 2026-10-30 | 2026-10-29 | review: activity and stars pass; MIT; a host runtime, not bundled |
| Deno 2.9.8 (`denoland/deno`) | MIT | 108,771 | 2026-10-29 | 2026-10-21 | pass |
| `@modelcontextprotocol/server` 2.4.0 | Apache-2.0 | 13,685 | 2026-10-28 | 2026-10-23 | pass |
| `zod` 4.6.7 | MIT | 44,230 | 2026-10-29 | 2026-10-12 | pass |
| `playwright` 1.64.1 | Apache-2.0 | 98,860 | 2026-10-30 | 2026-10-14 | pass |

## `check-licences` on the probe (task 1.3)

From the repository root, `GITHUB_TOKEN=$(gh auth token) bun tools/check-licences.ts openspec/changes/spike-packaging/probe`, with `probe/tools/licence-overrides.json` holding `[]` (the first run failed only because that file was missing):

```text
check:licences: 5 installed packages, 0 for other platforms read from the npm registry, 3 direct dependencies, archive step: checked, no problems
```

`git diff --exit-code origin/main -- package.json bun.lock packages/` at the repository root: empty. `bun install --frozen-lockfile` in `probe/`: passes (6 packages, no changes).
