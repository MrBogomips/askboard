# Design

## Context

See proposal.md (Why). State on `main` at efe92afb:

- `.claude-plugin/plugin.json` (version 0.0.0) starts `bun ${CLAUDE_PLUGIN_ROOT}/dist/askboard.mjs`; the four hooks in `hooks/hooks.json` run `bun "${CLAUDE_PLUGIN_ROOT}/dist/askboard.mjs" hook <event>`, and its `modules` names `./askboard-mod.js`. `dist/` and `hooks/askboard-mod.js` are gitignored; `skills/askboard/` is generated and committed.
- `dist/askboard.mjs` is one ESM bundle for Node 24.22.1 or later or Bun (packaging spec, "One bundle on Bun and Node"); `packages/server/src/main.ts` dispatches `hook`, `client` and the session process. The session process reports `packages/server/package.json`'s version (`session-entry.ts`). Every package is 0.0.0, and `bun.lock` records the workspace versions.
- The view build ships per-chunk licence notices and the mod build a notice at the top (`tools/build/licences.ts`: `chunkInputs`, `collectNotices`); `build:server` is a plain `bun build` command and ships none.
- CI: macOS only, `openspec` and `check` per pull request, browser and conformance on demand (CLAUDE.md, CI). The repository is private on GitHub Free.
- AD-19 permits the plain bundle on Node 24.22.1 or later until AXFX NFR-1 admits the Bun executable; AD-22's launcher rules (fetch, cache, 25 s budget, SHA-256) concern the executable. AD-18: release waits until Claude Code's `stable` reaches the declared minimum, `CLAUDE_CODE_MINIMUM` (2.1.311 in `contract/src/push/constants.ts:24`); on 2026-11-07 `stable` was 2.1.311 and `latest` 2.1.319.

Claude Code plugin facts, read from the plugin documentation on 2026-11-07 (marketplace reference, plugin loading, install, host a marketplace, CLI reference, manifest reference); the packaging spike's D1 to D20 (`spike-packaging/evidence/docs.md`) still hold:

- K1. A marketplace is `.claude-plugin/marketplace.json` at the marketplace root, with `name`, `owner` and `plugins`; an entry needs `name` and `source`. A relative source (`./`) resolves from the marketplace root.
- K2. `claude plugin marketplace add` accepts `owner/repo#ref` and `owner/repo@ref`; a ref-pinned marketplace follows that ref, not the default branch. A `github` source naming the marketplace's own repository at another ref is not documented.
- K3. A git source is cloned, then copied to `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. No build step runs, except one: when the plugin root holds `package.json` and a supported lockfile (`bun.lock` included), Claude Code runs that package manager's install, which cannot be turned off.
- K4. The manifest's `version` wins over the entry's (validate warns when both are set); an unchanged version means no update. Third-party marketplaces do not auto-update by default.
- K5. Scopes: `claude plugin install <plugin>@<marketplace> --scope user|project|local`; project scope writes `enabledPlugins` to `.claude/settings.json`; each teammate still installs, and a project plugin's MCP server needs the user's approval.
- K6. Private repositories work with the machine's git credentials (for GitHub, `gh auth setup-git`); background updates only when the helper answers without a prompt.
- K7. `${CLAUDE_PLUGIN_ROOT}` is substituted in stdio servers' `command`, `args` and `env` and in hook commands; it changes on update. No manifest field declares a minimum Claude Code version or a runtime prerequisite.
- K8. `claude plugin validate <dir>` validates a marketplace file and the relative-source plugins it lists; it does not catch git fetch errors.

## Goals / Non-Goals

**Goals:** an installable 0.1.0 today (FR-28) with no build on the user's machine; the shipped form tested by the same tests as the development plugin; a release that cannot publish a broken or mislabelled tree; no new outbound connection in AskBoard's code (NFR-9).

**Non-Goals:** the Bun executable, the launcher, its cache and gzip assets (AD-19, AD-22; Deferred); `askboard doctor`, the mirror and log-level configuration keys (AD-22; Deferred); signed releases or provenance; publishing to npm; a public mirror; Linux in the per-PR CI; any schema set (this change widens none, so the askboard-contract-versioning rules on set versions do not apply; product semver is outside them).

## Decisions

### 1. The start script, on `main` and in the release

`scripts/askboard` (POSIX `sh`, `set -u`, no bashisms) resolves the plugin root from `$0`, reads `node`'s version with one `node -p process.versions.node`, and compares it with 24.22.1 numerically. Before any `node` runs, it exports `CLAUDE_PROJECT_DIR` (the working directory when unset) and changes to the plugin root, so no file in the user's project (a Volta `hooks.json` with a `distro` script, a version file a shim reads, a `bunfig.toml` preload) can choose or run code through the runtime's start (review 1.5, X-1); the session process reads the project from `CLAUDE_PROJECT_DIR` and the hooks from their input's `cwd`. When the check passes: `exec node "$ROOT/dist/askboard.mjs" "$@"`. Otherwise, by mode: no argument → serve the refusal (decision 2); `hook` → read and drop its input, one stderr line, exit 0; `client` → one stderr line, exit 1; any other first argument → exit 1. The mod's client fallback runs the same script (`sh <root>/scripts/askboard client`), not `bun` (review 1.5, S-1).

The server entry is `{"command": "sh", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/askboard"], "env": {"CLAUDE_PROJECT_DIR": "${CLAUDE_PROJECT_DIR}"}}`; the hooks run `sh "${CLAUDE_PLUGIN_ROOT}/scripts/askboard" hook <event>`. Running through `sh` needs no executable bit, which the documentation does not promise to keep (K7). The development plugin on `main` uses the same files, so `--plugin-dir` runs exactly what ships. Bun stays the toolchain and a supported runtime (conformance on both).

- Alternative: `"command": "node"` on the bundle. A missing `node` is a spawn failure that Claude Code caches for 15 minutes [F48] and a hook failing with exit 127, and an old Node fails with a parse error: no reason reaches the user (NFR-8).
- Alternative: the version check inside the bundle. An older Node may fail to parse the bundle before any check runs.
- Cost: one extra Node start (about 40 ms) per hook and per session start.

### 2. The refusal answers the handshake with no tools

When Node is unusable, the start script answers JSON-RPC lines as the packaging spike's stand-in did (`spike-packaging/probe/plugin/scripts/askboard`, `serve_unavailable`): `initialize` → `protocolVersion` echoed, `capabilities: {tools: {}}`, `serverInfo` `{name: "askboard", version}` (from `plugin.json`), and `instructions` "AskBoard cannot start: <reason>. Install it, then restart the session or reconnect AskBoard in /mcp. Until then, ask the user another way.", where the reason is "Node 24.22.1 or later is needed on PATH; found <version>" (the found version as one printable line of at most 64 characters) or, with no `node`, "Node 24.22.1 or later was not found on PATH"; `tools/list` → `{tools: []}`; `ping` → `{}`; any other request → `-32601`; notifications ignored; exit 0 at end of input. One stderr line carries the same reason.

No tool means no contract result: the `unavailable` outcome needs an epoch and an ask ID and has no reason for a missing runtime, so using it would widen the output and tool-envelope sets. AD-18 already covers absent tools: the main conversation asks through AskUserQuestion, a subagent returns the question; the skill teaches it. **Needs probe** (task 2.3): that Claude Code shows the server connected with no tools and no cached failure, and that the model or `/mcp` shows the instructions. If the probe shows a cached failure or a hidden reason, the fallback is the spike's form: one `ask` tool that returns an MCP error result naming the reason (`isError: true`), with no contract outcome.

### 3. One product version, lockstep

The version lives in the root `package.json` (new `version` field), the ten `packages/*/package.json` and `.claude-plugin/plugin.json`. `bun tools/release/version.ts <x.y.z>` writes them all and refreshes `bun.lock` (`bun install --lockfile-only`), refusing anything that is not `major.minor.patch`. `tools/release/versions.test.ts` fails, naming each differing file and both versions, when they disagree; it runs in `bun run test`, so the per-PR check covers it with no new script. The session process already reports the server package's version, which lockstep makes the product's. The marketplace entry carries no version (K4). This change sets 0.1.0. Other `0.0.0` literals in `bench` are client names in tests and stay.

### 4. The release tree and the marketplace on the `release` branch

`bun tools/release/assemble.ts --out <dir>` copies from a built checkout, by an explicit allowlist, into an empty directory:

```text
.claude-plugin/plugin.json      .claude-plugin/marketplace.json (generated)
hooks/hooks.json                hooks/askboard-mod.js
scripts/askboard                dist/askboard.mjs   dist/view/**
skills/askboard/**              LICENSE  README.md  CHANGELOG.md  THIRD-PARTY-NOTICES.md (generated)
```

It fails on a missing input, a symbolic link, a file outside the allowlist in the output, or versions that disagree. The tree holds no `package.json` or lockfile, so Claude Code runs no install on the user's machine (K3), and no `bin/` (D11) or `agents/` (packaging spec). `marketplace.json` is `{"name": "askboard", "owner": {"name": <the copyright holder in `LICENSE`>}, "plugins": [{"name": "askboard", "source": "./", "description": <plugin.json's>}]}`.

A release commits the tree to the branch `release` (first commit an orphan, then each release on top of the previous), message `release: v<version> from <main sha>`, and tags it `v<version>`. Users add `MrBogomips/askboard#release` to follow releases, or `#v<version>` to hold one (K2). The marketplace's own relative source avoids the undocumented same-repository `github` source (K2), and `main` carries no marketplace file, which would install an unbuilt tree.

- Alternative: a GitHub release archive as an `archive` source. It needs a marketplace file somewhere that names each release's URL and hash, so a commit per release on `main`; the branch gives the same with the documented `#ref` form.
- Alternative: commit `dist/` on `main`. Rejected: build output in every pull request and its conflicts.
- Alternative: a separate public repository for the marketplace. Deferred to the PO's visibility decision (Open Questions 1); the tree and the workflow work for either, with the push target changed.

### 5. Notices for the bundle

`tools/release/notices.ts` rebuilds `packages/server/src/main.ts` in memory with the options of `build:server` and `metafile: true`, checks that the output equals `dist/askboard.mjs` byte for byte (so the notices describe the shipped bundle; a mismatch fails, naming the build), and writes `THIRD-PARTY-NOTICES.md` from `chunkInputs` and `collectNotices` (`tools/build/licences.ts`), AskBoard's own packages excluded. `build:server` stays unchanged. If the in-memory output cannot match (a path or banner difference), the fallback is to move `build:server` to `tools/build/server.ts` with `metafile: true` and write the notices beside the bundle; the task note records which.

### 6. The release workflow

`.github/workflows/release.yml`, `on: workflow_dispatch` with no inputs, three jobs, actions pinned by SHA as in `ci.yml`:

1. `build` (`macos-latest`, `contents: read`): refuse unless `github.ref` is `refs/heads/main`; checkout with `fetch-depth: 0`, `fetch-tags: true` and `persist-credentials: false`; the shared setup; `bun tools/release/preflight.ts` (versions agree, tag `v<version>` absent among the fetched tags, a `## <version>` section in `CHANGELOG.md`, `stable` at or above `CLAUDE_CODE_MINIMUM` from `npm view @anthropic-ai/claude-code dist-tags`); `bun run check`; `bun run build`; assemble; the smoke (`tools/release/smoke.ts`: in the tree, `sh scripts/askboard` on Node answers `initialize` and lists `ask`, `update`, `collect`, `fetch`, `snapshot`; `hook SubagentStop` with `{}` exits 0); write the release notes (the CHANGELOG section), `askboard-<version>.mjs`, `askboard-<version>.zip` (the tree) and `SHA256SUMS`; upload them and the tree as one artifact.
2. `smoke-linux` (`ubuntu-24.04`, `contents: read`): Node 24 from `package.json` (no Bun, no install), download the artifact, run the same smoke checks with `sh` and Node only, and `sha256sum -c SHA256SUMS`.
3. `publish` (`ubuntu-24.04`, needs both, `contents: write`, the only job with a write token): no checkout of code it runs; git and `gh` only. Fetch `release` if it exists, commit the tree (from the artifact) on it, tag, push branch and tag, then `gh release create v<version> --notes-file notes.md` with the three files. A push refused because the tag exists fails the job.

Preflight, assembly, notices and smoke are TypeScript with tests (injected `fetch`, `git` and file roots); the YAML only calls them. The macOS job is about the cost of one `check` run plus a build; the two Linux jobs are about 2 minutes each at a tenth of the macOS rate (CLAUDE.md, CI).

### 7. Documents

- **PRD §8** gains, after §8.1's list: "**Releases before the first version.** AskBoard is released as 0.x versions before the first version, 1.0.0, which holds the whole of §8.1. Each 0.x release ships the capabilities merged at its release time: 0.1.0 ships asking, context, typed answers, the question lifecycle with push delivery, Snapshots, languages and settings, setup and independence, the light benchmark, the Choice, Tree and Gantt widgets and the two ready molecules, and any further widgets merged before it; the remaining widgets of FR-11 and molecules of FR-15 come in later 0.x releases." The implementer checks each listed capability against CLAUDE.md's "In code since" lines at the rebase and trims the sentence to what `main` holds; `updated:` follows.
- **Spine AD-19**, amended in place, two bullets appended under **Bundle**: "**Node form:** until the executable ships, the plugin carries the bundle and the view build; the server entry and every hook run `scripts/askboard`, a POSIX `sh` start script that `exec`s Node 24.22.1 or later on the bundle and makes no network request. When Node is missing or older, the server answers the MCP handshake with no tools and the reason in its instructions, and a hook exits 0 with one stderr line." and "**Releases:** a release commits the built plugin, with a marketplace file whose one plugin is the tree itself, to the `release` branch, tagged `v<version>`, and publishes the bundle, the tree and their SHA-256 as a GitHub release; `main` carries no build output and no marketplace file. The tree holds no `package.json` or lockfile, so installing runs nothing [F-a]." In **Hooks**, "through the launcher" becomes "through the start script in the Node form and the launcher in the executable form".
- **Spine AD-22**, **Executables**: one sentence first: "These rules apply to the executable form; the Node form (AD-19) fetches nothing and caches nothing." **Diagnostics**: unchanged (deferred, below).
- **Spine Structural Seed**: `scripts/  # start script (Node form); the launcher (executable form)`. **Deferred**, one row: "The Bun executable form: the executables, the launcher and its cache, gzip assets, `askboard doctor`, the mirror and log-level keys (AD-19, AD-22) | AD-19 ships the Node form until AXFX NFR-1 admits the executable; 0.x needs none of the operations items | AXFX NFR-1 admits the executable (SOLUTION-DESIGN §11 entry 8), or the PO asks for `askboard doctor`". Front matter: `updated:` and a `sources` line for this change's open questions.
- **SOLUTION-DESIGN §13**: facts K2 to K4 and K7 as the next free F numbers after main's at the rebase (labelled F-a to F-d until then; never a number taken from another change), with their pages and date; §8 Installation gains "Releases come from the `release` branch (AD-19)".
- **README** (Install, Update, Uninstall, Requirements, WSL) and **CHANGELOG.md** (Keep a Changelog layout; `## 0.1.0 - <date>`); **CLAUDE.md** (Status, Stack, the development plugin now on Node, the release commands, the `release` branch in Working documents).

## Merge points

Changes in flight that touch the same files (`openspec list`; branches with commits ahead of `origin/main`; open pull requests on 2026-11-07: #47 only):

| Change (branch, head read) | Overlap | Handling |
| --- | --- | --- |
| `latex-kanban-timeline` (`worktree-feature-latex-kanban-timeline`, 46dc54a0) | Root `package.json` (a dev dependency) and `bun.lock`; `tools/build/licences.ts` (+159 lines: font licences); spine front matter, AD-19 Bundle, Stack, Structural Seed, Deferred; PRD; README; CLAUDE.md | The version lines conflict with nothing it adds; rerun `bun tools/release/version.ts` after a rebase over it. `chunkInputs` and `collectNotices` are borrowed from `main`; re-check their signatures at the rebase. Spine and PRD edits are appended rows and bullets. If it merges first, its widgets join the 0.1.0 CHANGELOG and the PRD sentence |
| `approval-scale-ranking` (`worktree-feature-approval-scale-ranking`, bf741700) | CLAUDE.md, `tools/build/` (skills, shared modules; not `licences.ts`) | Status lines only; its widgets join 0.1.0 if it merges first |
| `early-benchmark` (`origin/worktree-feature-early-benchmark`) | `packages/bench` reads the plugin's server entry (`packages/bench/src/plugin.ts`, `readPluginServer`, `preflightPlugin`) | Task 1.4 changes the preflight on `main`'s code; re-check at the rebase if that change touched the file |
| `skill-no-delegated-asks` archive (#47) | none | — |

Names borrowed from `main` (group 0 checks each): `chunkInputs`, `collectNotices` (`tools/build/licences.ts`), `CLAUDE_CODE_MINIMUM` (`packages/contract/src/push/constants.ts`), `readPluginServer`, `preflightPlugin` (`packages/bench/src/plugin.ts`), `.github/actions/setup-bun`. No seam comes from an unmerged change.

## Needs probe

- P1 (task 0.3 with a hand-copied tree, task 2.4 with the assembled one): the tree as a local marketplace (`claude plugin marketplace add <tree>`), installed at user scope in an isolated configuration, loads the server through `sh scripts/askboard` from the plugin cache, the skill, the four hooks and the mod (`modules` relative to the cached `hooks/hooks.json`); `claude plugin validate <tree>` has no error. Then project scope in a throwaway project (task 2.4).
- P2 (task 2.3): decision 2's refusal as Claude Code sees it.
- P3 (task 0.3): `node` is on the `PATH` Claude Code gives a plugin's server and hooks when Node comes from Volta, nvm or Homebrew; the README states what the probe finds.
- P4 (task 5.3, the PO): `MrBogomips/askboard#release` from GitHub with the PO's git credentials, user and project scope, on macOS, and Linux if possible.

## Risks / Trade-offs

- [Node becomes a user prerequisite] → AD-19's Node form; the README's Requirements; a refusal that names the versions.
- [The repository is private: only accounts with read access can install] → Open Questions 1; the README's credential note (K6).
- [A tag or branch pushed by a broken run] → the publish job runs only after both smoke jobs; tags are never moved; a bad release is followed by the next patch, and the README says how to hold a version.
- [The write token in a job that runs dependency code] → only `publish` has `contents: write`, and it runs git and `gh` alone.
- [Release notes or the PRD sentence naming widgets that did not merge] → task 5.3 checks both against `main` just before the dispatch.
- [Users stay on an old version: third-party marketplaces do not auto-update (K4)] → the README's Update section.

## Migration Plan

Merge this change (version 0.1.0, CHANGELOG 0.1.0). Before dispatching, check that `main`'s CHANGELOG section and the PRD sentence name only what has merged, and fix them on `main` if not (task 5.3). Dispatch `release.yml` on `main`. Rollback: none needed for `main`; a bad release gets a new patch version (`version.ts`, CHANGELOG, merge, dispatch). Later releases: bump with `version.ts`, add the CHANGELOG section, merge, dispatch.

## Open Questions

Each takes the proposed default, accepted under the PO's unattended handoff (2026-11-07); task 0.1 records them.

1. Repository visibility. Default: keep the repository private for 0.1.0; installers need read access and git credentials (K6). Making it public, or adding a public marketplace repository, is the PO's later decision and changes only the README and the push target.
2. Release plan. Default: as decision 7's PRD sentence; 1.0.0 is the first version of §8.1.
3. The refusal form. Default: no tools and instructions (decision 2), with the `isError` tool as the fallback if P2 fails.
4. Lockstep versions for all packages. Default: yes (decision 3).
5. The development plugin on Node. Default: yes, the same entry as the release (decision 1).
6. Linux in the release. Default: one Linux smoke job and the publish job on Linux; per-PR CI stays macOS only.
7. Marketplace and channel names. Default: marketplace `askboard`, plugin `askboard` (`askboard@askboard`), branch `release`, tags `v<version>`; the README recommends `#release`.
