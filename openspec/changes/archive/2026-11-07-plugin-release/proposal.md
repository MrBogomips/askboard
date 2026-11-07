# Proposal

## Why

AskBoard runs only as a development plugin: `--plugin-dir <checkout>` after `bun run build`, with the session process started by Bun and `dist/` and the mod gitignored. No user can install it, so FR-28 (user or project installation) is unmet. The PO asked on 2026-11-07 for the first release today: the smallest change that lets a user install a released AskBoard from a GitHub marketplace, at user or project scope, on macOS and Linux (NFR-7), in the form AD-19 allows until AXFX NFR-1 admits the Bun executable: the plain JavaScript bundle on Node 24.22.1 or later.

## What Changes

- **Node form of the plugin.** The server entry and every hook run `scripts/askboard`, a POSIX `sh` start script that runs the bundle on Node 24.22.1 or later. When Node is missing or older, it says why: the server answers the MCP handshake with no tools and the reason in its instructions (so Claude Code caches no failed start, AD-22), a hook exits 0 with one stderr line (AD-19). No download, no launcher, no cache: AD-22's launcher and the NFR-9 launcher exception stay unused. **BREAKING** for the development plugin only: `--plugin-dir` now needs Node 24.22.1 or later on `PATH`, not Bun.
- **One product version.** The root `package.json`, every `packages/*/package.json` and `.claude-plugin/plugin.json` carry the same semantic version, set by one command and checked by a test; the marketplace entry carries none, since the manifest's wins. The first release is 0.1.0.
- **A GitHub marketplace on the `release` branch.** A release assembles the plugin tree (manifest, hooks file, built mod, bundle, view build, skill, start script, licence, notices, README, CHANGELOG) with a generated `.claude-plugin/marketplace.json` whose one plugin, `askboard`, has the source `./`, and commits it to the `release` branch with the tag `v<version>`. A user adds the marketplace as `MrBogomips/askboard#release` (or `#v<version>` to hold one version), so Claude Code installs the built files with no build step on the user's machine, and `main` stays free of build output and of a marketplace file that would install an unbuilt tree.
- **Release workflow.** A `workflow_dispatch` workflow on `main` runs the checks, gates on AD-18's release rule, builds, assembles, smoke-tests the tree on macOS and Linux, pushes it to `release` with its tag, and publishes a GitHub release with the bundle, the plugin archive and their SHA-256 (NFR-6: every release publishes the plain bundle).
- **Notices for the bundle.** The release ships the licence notices of the third-party code bundled into `dist/askboard.mjs` (the view and the mod already carry theirs).
- **Documentation.** README: requirements, install for a user and for a project, update, uninstall (what it leaves, AD-22), WSL; `CHANGELOG.md` with 0.1.0.
- **Release plan.** 0.x releases precede the first version: each ships the widgets and molecules merged on `main` at release time; 0.1.0 ships Choice, Tree, Gantt and the ready molecules, plus Approval, Scale, Ranking, LaTeX, Kanban and Timeline if their changes merge first. The rest of FR-11 comes in later 0.x minors; 1.0.0 is the first version of PRD §8.1. The PRD records this in §8, the spine records the Node form in AD-19 (amended in place) and defers the executable, the launcher, `askboard doctor` and the mirror and log-level keys.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `packaging`: the server entry and the hooks run the start script on Node instead of the bundle on Bun; adds the Node prerequisite and its refusal, one product version, the marketplace, the release tree, the release workflow and the bundle's notices.

## Impact

- **Requirements:** FR-28 (met by the marketplace and the scopes), FR-29 (one install brings the tools, the skill and the hooks), NFR-6 (the plain bundle published with each release, notices shipped), NFR-7 (macOS and Linux; WSL documented), NFR-8 (a refusal that says why), NFR-9 (no launcher fetch: AskBoard's code still makes no outbound connection). PRD §8 gains the release plan; R5 unchanged.
- **Architecture:** AD-19 (amended in place: the Node form, its start script, the release tree), AD-22 (the launcher bullets apply to the executable form; uninstall unchanged), AD-18 (the release gate: `stable` at or above the declared minimum, checked by the workflow), AD-11 (no new listener, no outbound connection), AD-1 (no new package import). Spine: Structural Seed (`scripts/`, the release branch) and Deferred (the executable form and E11's operations items).
- **Code:** `.claude-plugin/plugin.json`, `hooks/hooks.json`, `scripts/askboard` (new), `package.json` and `packages/*/package.json` (version), `tools/release/` (new: version, assembly, notices, preflight, smoke, release files), `packages/bench/src/plugin.ts` (preflight of the start script), `.github/workflows/release.yml` (new), `README.md`, `CHANGELOG.md` (new), `CLAUDE.md`.
- **Users:** a new prerequisite, Node 24.22.1 or later on `PATH`, stated in the README and in the refusal.
- **Not in this change:** the Bun executable and the launcher (AD-19, AD-22; waits for AXFX NFR-1), `askboard doctor`, the mirror and log-level configuration keys, signed releases, a public mirror of the repository, Linux in the per-PR CI.
