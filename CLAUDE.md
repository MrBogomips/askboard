# AskBoard

- Session context: MRB-ASKB

This file holds the rules for every coding agent working in this repository. Claude Code reads it as it is; Codex reads `AGENTS.md`, which is generated from it (Codex interop): change the rules here, never in `AGENTS.md`. Write Issues, comments, commits, pull requests and artifacts in English.

## Overview

AskBoard is a local web board where a Claude Code agent asks the user structured questions through widgets and gets typed answers back. It ships as one Claude Code plugin and works in any Claude Code project.

Where the project's state lives (`CLAUDE.md` holds no status, so parallel changes never edit it for their records):

- **Merged:** `git log origin/main`; each change's artifacts in `openspec/changes/archive/`; the current behaviour in `openspec/specs/`; what each change built, the names and seams it added and the versions it bound in `docs/as-built/<change-id>.md`.
- **In flight:** `openspec list` (the changes and their tasks), the open pull requests and the `in-change` Issues.
- **Left to the PO:** the Issues labelled `needs-po` (decisions, by-hand checks, live runs).
- **Build order:** the widgets AXFX needs come first (`SOLUTION-DESIGN.md` §3.1).

## Design documents

- `docs/prd-askboard-2026-10-25/prd.md` (FR, NFR, SM, R IDs) and `addendum.md` (adoption rule, security model, benchmark protocol).
- `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`: AD-1 to AD-22 bind every change; also Consistency Conventions, Stack, Structural Seed (planned source tree) and Deferred.
- `SOLUTION-DESIGN.md` beside it explains the spine and adds no rules: §3.1 capabilities and units, §10 spikes, §11 PRD changes and their status, §12 open items and owners, §13 verified facts.
- `docs/ux-askboard-2026-10-27/DESIGN.md` (how it looks: tokens, components) and `EXPERIENCE.md` (how it works: information architecture, states, interactions, accessibility, key flows); both win over the mockups in `mockups/`. Beside them are the UX run's change requests to the PRD (PCR) and to the architecture (ACR), together with the renderer spike checks S-1 to S-8. All were applied on 2026-10-28.
- `docs/README.md`: provenance and how the documents relate.

How they change:

- A change that alters a requirement or an AD updates the PRD or the spine in the same OpenSpec change.
- AD IDs stay stable: amend a decision in place, add the next AD-n for a new one, never renumber.
- Where the spine and the solution design differ, the spine wins.
- Keep the folder names: they are the original run names, and cross-references such as `prd-askboard-2026-10-25/prd.md` in the spine depend on them.
- Each `.memlog.md` is the append-only decision record of its run: never rewrite its entries.
- Citations of working files not under `docs/` (`extract-*.md`, `review-*.md`, the PRD and architecture `reconcile-*.md`) point to the planning repository's git history (`agentxema_prd`: PRD at `cf5ac80`, architecture at `73d5cb6`, UX at `fe3f319`); citations of `../prd-agentxema-2026-10-21/` point to the AXFX PRD, which lives in the planning repository.
- The AXFX contract (AXFX PRD §5.10, §6, §7) lives in the planning repository; changes to it are requested there, not made here.

## Invariants every change respects

One line each; the binding text is in the cited IDs.

- **Independence** (FR-31, AD-19): depends on nothing in AXFX; documentation may name AXFX only as a user.
- **Licence** (NFR-6, AD-19): MIT. Every adopted component meets the adoption rule in `addendum.md` (licence, stars, activity), pinned exactly; a licence exception exists only through a PRD change.
- **No telemetry** (NFR-9, AD-11): AskBoard's own code makes no outbound connection; the one exception is the launcher fetching the pinned executable.
- **Fail closed** (NFR-10, AD-10): never return an answer the user did not give; an ask unknown to the current epoch is `discarded`, never "no answer yet".
- **Local machine only** (NFR-3, NFR-4, AD-11): listen on `127.0.0.1` (a container interface only on explicit opt-in), a token on every request.
- **Agent content is data** (NFR-5, AD-8): shown as data in a sandboxed view; no agent markup or code runs.
- **Platforms** (NFR-7): macOS and Linux, including devcontainers and CI runners; Windows only through WSL.
- **Imports** (AD-1): only along the spine's dependency diagram; `compute` and `ask-core` use no DOM, Node-only or Bun-only API.

## Stack

TypeScript, built with Bun and shipped as a Bun-compiled executable under the NFR-6 licence exception; until AXFX NFR-1 admits the executable (§11 entry 8), the shipped form is the plain JavaScript bundle on Node 24.22.1 or later (AD-19). The plugin's server entry and hooks run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/askboard`, which `exec`s Node on `dist/askboard.mjs`, so the development plugin needs Node 24.22.1 or later, the default `node` (with Volta, the checkout's own pin applies from the plugin root); `claude mcp list` shows AskBoard connected even when Node is too old, so check `/mcp` for its five tools; the script leaves `CLAUDE_PROJECT_DIR` as the host gave it (AD-12) and never takes it from the working directory. The product has one version, in lockstep in the root `package.json`, the ten packages and `.claude-plugin/plugin.json`. Exact pins: the spine's **Stack** section; layout `packages/<unit>`, published as `@askboard/<unit>`: **Structural Seed**.

What each change built is in `docs/as-built/`, one file per OpenSpec change named after it (`docs/as-built/<change-id>.md`): where its code lives, the names and seams it added, the versions it bound. Before touching a package, read the notes that name it (`grep -l '<package or name>' docs/as-built/*.md`).

## Working documents

| Location | Role | Status | Git |
|---|---|---|---|
| `openspec/specs/` | Current behaviour specs | Authoritative; updated only through the OpenSpec sync or archive workflow | committed |
| `openspec/changes/` | Changes in flight; epics and spikes are changes | In-flight | committed |
| `openspec/changes/archive/` | Completed changes | Archive | committed |
| `docs/` | Design documents: PRD, architecture, UX. Owned by this repository since 2026-10-27 (UX since 2026-10-28), transferred from the planning repository, which removed its copies on 2026-10-28 | Authoritative | committed |
| `docs/as-built/` | One note per OpenSpec change, `<change-id>.md`, written in the change's own branch by its documents task: what it built, where the code lives, the names and seams it added, the versions it bound. No status (merged, awaiting, dates): that is in git, the pull requests and the Issues. A later change that makes a sentence of an earlier note wrong corrects that sentence and says so in its own note | Record; never overrides `openspec/specs/` or the code | committed |
| `ROADMAP.md` | The summary roadmap: what is done and what is left for 1.0.0, linked to the Issues; updated at each release, never by a change, so parallel changes do not conflict on it | Summary; never overrides the Issues, `openspec/` or the PRD | committed |
| `drafts/` | Working documents that later sessions need, such as spike research awaiting a decision before it becomes an OpenSpec change | Draft; never overrides `docs/` or `openspec/` | committed |
| GitHub Issues (MrBogomips/askboard) | The backlog: requests, defects, PO questions | Authoritative | remote |
| `issue-assets` branch | Images the Issues show (screenshots), uploaded through the Contents API and linked from the Issues; never merged into `main` | Evidence | remote only |
| `.claude/commands/opsx/`, `.claude/skills/openspec-*` | OpenSpec tooling, regenerated by `openspec update`; never hand-edited | Tooling | committed |
| `.claude/agents/askboard-*`, `.claude/skills/askboard-*` | The agent harness: project agents and their skills (see Agent harness); edited by hand | Tooling | committed |
| `AGENTS.md`, `.agents/skills/`, `.codex/` | The Codex form of this file, of the project skills and of the agents, generated by `setup.sh` (Codex interop); never edited | Generated | gitignored |
| `setup.sh` | Sets up a checkout, locally and on CI: toolchain check, dependencies, the Codex files | Tooling | committed |
| `.github/` | CI, Dependabot and the Issue templates | Tooling | committed |
| `packages/` | Source: the ten `@askboard/<unit>` packages (spine, Structural Seed) | Source | committed |
| `tools/` | Repository checks and their tests: import boundaries (AD-1), licences (AD-19), workspace layout; the view build in `tools/build/`; the skill generator in `tools/build/skills/` | Tooling | committed |
| `skills/` | The plugin's skill `skills/askboard/` (`SKILL.md`, `references/`): generated by `bun run build:skills`, committed, never hand-edited; `check:skills` fails on drift | Generated | committed |
| `hooks/` | The plugin's hooks file `hooks.json` (committed) and the built mod `askboard-mod.js` (gitignored, from `bun run build:mod`) | Source and generated | `hooks.json` committed, the mod gitignored |
| `release` branch | The built plugin tree and its `marketplace.json`, one commit per release, tagged `v<version>`; written only by `release.yml`, never merged into `main`, and `main` carries no build output or marketplace file (AD-19) | Generated | remote only |
| `scripts/` | `askboard`, the start script (Node form, AD-19) | Source | committed |
| `dist/` | Build output of `bun run build`: `askboard.mjs` (the session process) and `view/` (the board page, the chunks and their manifest), which the plugin and the end-to-end tests run | Generated | gitignored |

- OpenSpec conventions prevail (OpenSpec workflow and commands).
- Recorded on: 2026-10-27; `drafts/`, `packages/` and `tools/` added on 2026-10-29; `tools/build/` and `dist/` on 2026-10-31; `hooks/` on 2026-11-01; `scripts/` and the `release` branch on 2026-11-07; the agent harness on 2026-11-06; `skills/` on 2026-11-07; GitHub Issues as the backlog and the `issue-assets` branch on 2026-11-08; `docs/as-built/` on 2026-11-08, replacing the Status and "In code since" paragraphs of this file; `ROADMAP.md` on 2026-11-09; `setup.sh` and the generated Codex files on 2026-11-09, when the rules of `AGENTS.md` moved into this file.

## The backlog: GitHub Issues

The Issues of `MrBogomips/askboard` are the authoritative backlog: the PO's requests, defects, and
the decisions that belong to the PO. Session notes, agent memory, chat transcripts and `drafts/` are
not: an item kept only there is lost to the next session. Hand work between sessions as Issue
numbers, never as lists in a message.

**GitHub tools:** GitHub's official MCP server (`github-mcp-server`) and GitHub's own `github-issues` skill
(github/awesome-copilot), both set up at user level for every coding agent; where they have no tool, the
GitHub CLI `gh` (`gh issue`, `gh api`), which the commands below use. No project skill duplicates them.

### Labels

Each Issue has one type and one source; a defect also has one severity.

| Label | Meaning |
|---|---|
| `type:feature` | A capability the PO wants |
| `type:defect` | Behaviour that differs from the specs or the PO's intent |
| `type:question` | A decision that belongs to the PO |
| `type:chore` | Maintenance, cleanup, tooling |
| `sev:H` | High: a wrong or lost answer, security, data loss |
| `sev:M` | Medium: a requirement or scenario not met |
| `sev:L` | Low: wording, records, minor gaps |
| `source:po` | Asked by the PO |
| `source:e2e` | Found in an end-to-end test session |
| `source:review` | Found by a spec or security review, or during a change's work |
| `needs-po` | Waiting for a PO decision |
| `in-change` | An OpenSpec change is working on it |

The severities are the scale of the review findings (S-n, X-n): a finding rated M becomes `sev:M`.
GitHub's default labels and `full-ci` are not backlog labels.

### Lifecycle

Every `gh` command below takes `--repo MrBogomips/askboard`, left out for brevity. Write bodies and
comments to a file outside the repository and pass them with `--body-file`.

**An Issue is self-contained.** It holds, inline, the steps, the expected and the observed behaviour
and the evidence that matters (the error text, the request and the answer, the lines of a report or
a log that show the fault), so anyone can act on it without the machine it was found on. A path on
someone's machine is never the only evidence: quote what the file holds. Images go in as
attachments dragged in on GitHub, or as files on the `issue-assets` branch linked as
`https://github.com/MrBogomips/askboard/raw/issue-assets/<path>` (the Contents API: `gh api
repos/MrBogomips/askboard/contents/<path> -X PUT -f branch=issue-assets -f message=… -f content=<base64>`,
the method of the `github-issues` skill for private repositories), never as local paths. Never put a board link (it carries the token in `?t=`), a token or a session file in an Issue.

1. **Deduplicate, then open.** Search open and closed Issues with two or three wordings (the widget
   or tool name, the symptom, the API name):
   ```sh
   gh issue list --state all --search "<key words> in:title,body"
   ```
   An open match gets what is new as a comment (`gh issue comment <n> --body-file <file>`). A closed
   one that came back gets a new Issue whose Origin says "Regression of #n"; never reopen it.
   Otherwise:
   ```sh
   gh issue create --title "<what is wrong, or what is wanted>" --body-file <file> \
     --label type:defect --label sev:M --label source:e2e
   ```
   The title states the problem or the want, never the fix; a question starts with "Question:", a
   chore with "Chore:". The body follows the template of its kind in `.github/ISSUE_TEMPLATE/`,
   without its front matter and comments: the Origin first (test ID and commit, review finding and
   change, or the PO's words), References last, with the related Issues. One finding per Issue.
   Pass every label with `--label`, whatever the template says.
2. **Triage.** Check the type, the source and, for a defect, the severity. A decision only the PO can
   take gets `needs-po` and one comment: the question, the options with their consequences, and the
   proposed default with its reason. A question separate from any Issue is its own Issue
   (`type:question`, `needs-po`).
   ```sh
   gh issue edit <n> --add-label needs-po
   gh issue comment <n> --body-file <question.md>
   ```
   The PO answers in a comment, then the label comes off (`gh issue edit <n> --remove-label
   needs-po`). A proposed default is not an answer: work that depends on it waits for the PO; an
   unattended run that takes a default records it and leaves the label on.
3. **Change.** The OpenSpec proposal cites `Issue: #n`. Once the change exists, the Issue gets a
   comment naming the change and its branch, and the `in-change` label:
   ```sh
   gh issue comment <n> --body "OpenSpec change \`<id>\`, branch \`<branch>\`."
   gh issue edit <n> --add-label in-change
   ```
   Task notes and commit bodies name the Issue (`Refs #n`). A review finding deferred, or a defect
   found during the work and not fixed in the same change, becomes a new Issue with `source:review`,
   its severity, and the finding ID, the change and the range in its Origin. A change dropped or
   split: comment where the work went; remove `in-change` when nothing is on the Issue any more.
4. **Pull request.** The body says `Closes #n`. When one Issue spans several changes, each pull
   request says `Refs #n` and the last one says `Closes #n`. The PO's merge closes the Issue.
5. **Archive.** The archive pull request says `Refs #n`, never `Closes`, and never reopens the Issue.

An Issue that needs no change is closed by hand with the reason: `gh issue close <n> --duplicate-of
<m>`; `gh issue close <n> --reason "not planned" --comment "<why>"`; or, for a question answered
with nothing to build, `gh issue close <n> --comment "<the decision, and where it is recorded>"`.

### End-to-end test sessions

An end-to-end test session files its own findings: one self-contained Issue per finding, after the
duplicate search, labelled `source:e2e` with its type (and its severity, for a defect). The Origin
names the test ID and the commit tested; the lines of the report that show the fault are quoted and
its screenshots attached. It sends the coordinating session only the Issue numbers.

## OpenSpec workflow and commands

OpenSpec 1.15.0, schema `spec-driven`; run it as `npx --yes @fission-ai/openspec@1.15.0 <command>`, never a global `openspec` of another version (the commands below are shown bare). The rules for its artifacts (which IDs proposals and designs cite, capabilities per `SOLUTION-DESIGN.md` §3.1, platforms per NFR-7) are in the `context` field of `openspec/config.yaml`, which every OpenSpec workflow reads: change them there, not here. The same file's `rules` (for designs and tasks) and `operations` (guidance for apply and archive) wire in the agent harness.

- Create, change and archive its artifacts only through its workflow: propose, apply, verify, archive, under `openspec/changes/<id>/`; `openspec/specs/` changes only through sync or archive. Never hand-edit the generated tooling (`.claude/commands/opsx/`, `.claude/skills/openspec-*`).
- A proposal cites `Issue: #n` beside the FR, NFR and AD IDs it serves, one line per Issue it resolves.
- A change records what it built in its own note, `docs/as-built/<change-id>.md` (Working documents), never in this file: it changes only when a rule it states changes, so parallel changes do not conflict on it. What a change leaves to the PO is an Issue.
- Archive a change only after its pull request is merged.

The workflow steps, in order: explore (think; never writes code), propose (creates the change and all its artifacts, then stops before implementation), update (revises a change's artifacts), apply (implements its tasks), verify, sync (merges delta specs into `openspec/specs/` without archiving), archive. Claude Code runs them as the slash commands `/opsx:explore` to `/opsx:archive`; Codex as the skills `openspec-explore`, `openspec-propose`, `openspec-update-change`, `openspec-apply-change`, `openspec-verify-change`, `openspec-sync-specs` and `openspec-archive-change`. An agent with neither follows the same steps with the CLI: `new change <id>`, `instructions <artifact> --change <id>` (each artifact's template and the project's rules), `status --change <id>`, `validate <id> --strict`, `instructions apply --change <id>`, `archive <id>`.

```sh
openspec list                                      # changes in flight (--specs, --archived)
openspec status --change <name>                    # artifact completion of a change
openspec show <name>                               # a change or a spec
openspec validate --all --strict --no-interactive  # what CI runs
openspec update                                    # regenerate the opsx commands and skills
```

- The `openspec update` CLI command regenerates tooling; the update step (`/opsx:update`, `openspec-update-change`) revises a change. They are unrelated. After `openspec update`, regenerate the Codex files (Codex interop).
- Keep one OpenSpec version everywhere: the local CLI, the CI pin (`@fission-ai/openspec@1.15.0` in `ci.yml`) and the `generatedBy` of the generated skills. Upgrade them together.

## Agent harness

Goal: design, implement and review OpenSpec changes with project agents whose model, effort and domain skills fit each job, and review each task group as it lands instead of only before the pull request.

- Spec process: OpenSpec owns the artifacts. `askboard-architect` writes them only through the opsx skills. The apply step (`/opsx:apply`, `openspec-apply-change`) reads `operations.apply.guidance` in `openspec/config.yaml` and delegates through the `askboard-delivery` skill, which holds the flow, each agent's model and effort, and when to raise the effort.
- Entry point: there is no gate on every prompt; OpenSpec is the entry point. Use `askboard-delivery` to propose, apply, review, rebase or prepare the pull request of a change. Answer questions and make small fixes directly.
- The reviewers' memory (Claude Code) lives outside the repository, in the user's agent memory folder, so parallel worktrees never conflict on it. Patterns they see recur become skill rules at the kaizen step before a pull request, which the PO's Claude Code setup runs.
- Backlog: GitHub Issues, run by the procedure in The backlog above; a change starts from its Issue and its pull request closes it.
- Models: the `model`, `effort`, `tools` and preloaded `skills` of the agents in `.claude/agents/` hold for Claude Code only. Their Codex form in `.codex/agents/` keeps the name, the description and the instructions, and runs on the Codex session's model (Codex interop).

Change history:

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-11-06 | Initial setup: architect, implementer, spec and security reviewers; the delivery, review-protocol, threat-model, contract-versioning and implementation skills; design and tasks rules and apply and archive guidance in `openspec/config.yaml` | `.claude/agents/`, `.claude/skills/askboard-*`, `openspec/config.yaml` | Rework in PRs #8 to #35: version and seam collisions between changes, test timing and isolation, the chunk budget, spec drift found late, security findings. No gate on every prompt, by the PO's choice. |
| 2026-11-08 | The backlog moves to GitHub Issues: `AGENTS.md` (shared rules and the backlog procedure, imported by CLAUDE.md), the Issue link in the delivery, implementation and review-protocol skills, the architect and the threat model, the proposal's Issue citation in `openspec/config.yaml`, four Issue templates; no project skill for GitHub, by the PO's choice | `AGENTS.md`, `CLAUDE.md`, `.claude/skills/askboard-{delivery,implementation,review-protocol,threat-model}/SKILL.md`, `.claude/agents/askboard-architect.md`, `openspec/config.yaml`, `.github/ISSUE_TEMPLATE/` | The PO's decision: one backlog for Claude Code and Codex sessions, instead of items passed between sessions. |
| 2026-11-08 | A change's record moves out of `CLAUDE.md`: the Status paragraph gives way to where the state lives (git, `openspec list`, the Issues), the "In code since" paragraphs become `docs/as-built/<change-id>.md`, and the delivery skill, the spec reviewer, the contract-versioning skill, the archive guidance in `openspec/config.yaml` and `AGENTS.md` name the note instead; the PO checks left in the Status paragraph go to Issue #108 | `CLAUDE.md`, `AGENTS.md`, `docs/as-built/`, `.claude/skills/askboard-{delivery,contract-versioning}/SKILL.md`, `.claude/agents/askboard-spec-reviewer.md`, `openspec/config.yaml` | Every parallel change edited the same two places of `CLAUDE.md` (Status, "In code since"), so each merge of `main` conflicted there; the file was also about 70,000 characters loaded into every session and agent. |
| 2026-11-09 | Codex interop: the rules of `AGENTS.md` (the backlog, OpenSpec, git and pull requests) move into this file, which becomes the one source for every agent; `AGENTS.md`, `.agents/skills/` and `.codex/` become generated and gitignored, written by the codex-port block of the new `setup.sh` with the latest rulesync, which CI runs too; the skills, the architect and `openspec/config.yaml` cite this file for the backlog | `CLAUDE.md`, `AGENTS.md`, `setup.sh`, `.gitignore`, `.github/actions/setup-bun/action.yml`, `.claude/skills/askboard-{delivery,implementation,review-protocol}/SKILL.md`, `.claude/agents/askboard-architect.md`, `openspec/config.yaml`, `tools/codex-interop.test.ts`, `tools/codex-port.test.ts` | The PO's decision: Claude Code is the master and Codex is derived. A mechanical rulesync conversion overwrote the hand-written `AGENTS.md` that `CLAUDE.md` imported, losing the shared rules. |

## Codex interop

Claude Code is the master; the Codex files are derived from it and never edited.

| Source | Codex form |
|---|---|
| `CLAUDE.md` | `AGENTS.md` |
| `.claude/skills/` | `.agents/skills/` |
| `.claude/agents/*.md` | `.codex/agents/*.toml` |
| `.mcp.json`, hooks and permissions in `.claude/settings.json` (none today, so nothing is written) | `.codex/config.toml`, `.codex/hooks.json`, `.codex/rules/` |
| `disable-model-invocation: true` in a skill | `.agents/skills/<name>/agents/openai.yaml` with `allow_implicit_invocation: false` |

- The Codex files are gitignored. The codex-port block of `setup.sh` writes them with the latest rulesync (`npx --yes rulesync@latest`, never pinned, with package install scripts off). It converts a copy of the sources and checks the result before touching the checkout, so a failed conversion leaves the files as they were; it records what it wrote in `.codex/codex-port.manifest`, removes what an earlier run wrote for a source that is gone, and refuses to overwrite a file of the same name it did not write. The first line of `AGENTS.md` names the rulesync version used. `tools/codex-port.test.ts` runs the block against a stub rulesync.
- Regenerate after changing a source, after `openspec update` and after pulling `main`: `./setup.sh --codex-only` (or the whole `./setup.sh`; in Claude Code, the user skill `/codex-port` where installed). `./setup.sh --check` says, without the network, whether they are stale; `--dry-run` lists what a run would write. CI regenerates them on every run, so a source rulesync cannot convert fails the setup.
- Not carried to Codex: the slash commands (`/opsx:*`; Codex uses the `openspec-*` skills), the agents' model, effort, tools and preloaded skills, and `@` imports, which this file must not use. Codex loads `.codex/` only in a project the user has trusted.
- The codex-port block between its `>>>` and `<<<` markers belongs to the `codex-port` skill, which replaces it on its next run: change the rest of `setup.sh` freely, not the block.

## Development commands

```sh
./setup.sh                                           # set up a checkout or worktree: toolchain check, bun install, the Codex files
./setup.sh --ci                                      #   as CI runs it (set by CI=1 too): bun install --frozen-lockfile
./setup.sh --codex-only                              #   only regenerate the Codex files (Codex interop)
./setup.sh --check                                   #   whether the Codex files are stale, without the network (--dry-run: what a run writes)
bun install                                          # install the pinned dependencies (CI: --frozen-lockfile)
bun run check                                        # what CI runs, in this order, stopping at the first failure:
bun run typecheck                                    #   tsc -p on each package, then on tsconfig.test.json
bun run lint                                         #   Biome formatting and lint checks, no writes
bun run test                                         #   bun test with coverage, 80% threshold
bun run check:imports                                #   import boundaries (AD-1)
bun run check:skills                                 #   skills/askboard/ matches its generator and stays within budget
GITHUB_TOKEN=$(gh auth token) bun run check:licences #   licences and archived direct dependencies (AD-19)
bun run format                                       # Biome: format and apply safe fixes
bun run build:skills                                 # regenerate skills/askboard/ from the contract's teaching data
bun run build                                        # build:server, then build:view, then build:mod:
bun run build:server                                 #   the session process, dist/askboard.mjs (ESM for Node 24 or Bun)
bun run build:view                                   #   the view, dist/view/ (board page, chunks, manifest)
bun run build:mod                                    #   the mod, hooks/askboard-mod.js (one ESM file, git-ignored)
bun run test:e2e                                     # after a build: browser tests on the session process, then conformance in AD-1's three configurations, on Bun
bun tools/release/version.ts <x.y.z>                 # one version in every manifest and bun.lock (a test fails when they differ)
bun tools/release/assemble.ts --out <empty dir>      # after bun run build: the release tree and its marketplace file
node tools/release/smoke.ts <tree> --tools <file>    # the tree on plain Node (tool names from tools/release/tool-names.ts)
bun tools/release/package.ts --tree <tree> --out <dir> # notes.md, askboard-<version>.mjs and .zip, SHA256SUMS
```

- A release is the manual workflow `.github/workflows/release.yml`, dispatched on `main`: preflight (versions agree, tag `v<version>` free, a `## <version>` section in `CHANGELOG.md`, Claude Code's `stable` at or above `CLAUDE_CODE_MINIMUM`), the check, the build, the assembly, the smoke on macOS and on Linux, then `publish` (the only job with write access) commits the tree to `release`, tags it and creates the GitHub release. To release: `bun tools/release/version.ts <x.y.z>`, a CHANGELOG section naming only what has merged, `ROADMAP.md` brought up to the release, merge, dispatch.

- `test:e2e` needs Playwright's engines: `node_modules/.bin/playwright install chromium firefox webkit`. The same suites on Node 24, as CI runs them: `bun packages/server/test/conformance/run.ts --runtime node` and `bun packages/view/test/browser/run.ts --no-build --target session-process --runtime node --engines chromium`. The browser runner also takes `--engines a,b`, `--serial` and `-- <bun test arguments>` after another option, since Bun drops a leading `--`.
- The mod build bundles `packages/mod/src/index.ts` with standalone validators in place of `src/validators.ts`, and fails on an `import`, `require` or `import.meta` in its output, which the mod environment cannot load; it exports `register(on)` alone.
- The view build fails when a chunk grows more than 10% over `packages/view/chunk-sizes.json`; a change that means the growth runs `bun run build:view --record-sizes` and commits the file.
- The development plugin: after `bun run build`, `claude --plugin-dir <checkout>` loads it in any project, with its hooks and the mod. A server whose start fails is skipped by new sessions for 15 minutes, so build first.
- The conformance suite runs AD-1's three configurations: mod and hooks, mod disabled, hooks disabled (`--configuration` picks one). Hooks run as processes of the built bundle, and the mod runs in a stand-in host of the mod API (`packages/server/test/conformance/mod-host.ts`), whose process runs, clock and `http.fetch` are real and whose agents, turns, appends, submits and UI calls are recorded.
- `tools/check-imports.ts` holds the rules table transcribed from the spine's dependency diagram and AD-1: a change to the diagram updates the table in the same OpenSpec change. Files in `packages/server/src` outside the six server unit folders are the session process entry point (`main.ts` and the files beside it): they compose the units, may import `core`, `contract`, every server unit and `hooks`, whose hook and client modes they dispatch, and nothing imports them (AD-1 as amended by E1 and E4). `hooks` and `mod` import only `contract`. A relative path may not leave its package or go through `node_modules`: another package is imported as `@askboard/<name>`, so its `exports` and the importer's declared dependencies apply.
- `core`, `compute` and `mod` compile without DOM, Node or Bun types, each stating its `lib` and `types` in its own `tsconfig.json`; the import check fails on a Node or Bun built-in in their sources, and on a `/// <reference types>` or non-ECMAScript `/// <reference lib>` in their sources or in `contract`'s, and the workspace test fails on import aliases (`paths`, `baseUrl`, `rootDirs`, a package.json `imports` field). Tests are `*.test.ts` files or files under `packages/<name>/test/`; they and `tools/` compile under `tsconfig.test.json`, with `@types/bun`.
- `check:licences` needs network access: packages in `bun.lock` meant for another platform are not installed, so their licences come from the npm registry. Without `GITHUB_TOKEN` it skips the archive lookups and says so; with `CI` set it fails instead. `tools/licence-overrides.json` corrects wrong package metadata only, with evidence, and never admits a licence outside the adoption rule. `tools/licence-texts.json` holds, by package and exact version, the licence text the view build ships for a package whose tarball has no licence file, with its source at a commit, its date and why; it is used only when the package.json licence matches, an entry with nothing to do fails the build, and it never admits a licence outside the adoption rule.
- Biome leaves Markdown, `docs/`, `drafts/`, `openspec/` and `.claude/` alone.
- The checks still to come are listed in the spine's Consistency Conventions (Tests).

## CI (GitHub Actions, private repository on GitHub Free)

- macOS only for now (`macos-latest`); NFR-7 still targets Linux, which comes back by passing `runs-on: ubuntu-24.04` in `ci.yml`, one line per call. `ci.yml` only composes reusable workflows (`workflow_call`, each with a `runs-on` input defaulting to `macos-latest`): `openspec.yml` (strict validation, with `OPENSPEC_TELEMETRY=0`), `check.yml` (`bun run check` with `GITHUB_TOKEN`), `browser.yml` (build, Playwright install, the browser tests against the session process, one matrix job per engine: chromium, firefox, webkit) and `conformance.yml` (the suite in its three configurations, matrix Bun and Node 24). The shared setup (Node, Bun from npm, then `setup.sh --ci`: the toolchain check, `bun install --frozen-lockfile` and the Codex files) is the composite action `.github/actions/setup-bun`.
- Triggers: only openspec and check run automatically, on every pull request and push to `main`. Browser and conformance are suspended to save macOS minutes: run them locally (`bun run test:e2e`, with the conformance runs on both runtimes) before a merge that touches the view, the server or the conformance suite; in CI they run only on demand (`workflow_dispatch`). Known: `browser.yml` WebKit fails on "ten presses of Tab never reached Answer". Actions are pinned by commit SHA with the version as a comment; Dependabot bumps them and the Bun dependencies weekly, except `@types/bun`, which is bumped by hand together with the Bun pin in `packageManager` (a workspace test fails if they differ).
- 2,000 included Actions minutes per month, and macOS runners cost about 10x Linux minutes. The spine's CI plan covers macOS and Linux; with macOS only, the heavy suites stay on demand.
- When the minutes are used up, Actions usage is blocked.
- Branch rulesets and CodeQL code scanning are not available on private repositories with GitHub Free: a failing check does not block a merge, so check CI before merging.

## Git and pull requests

- Work on a branch in a worktree based on `origin/main`: one change, one worktree, one branch. Location and names are in Git / PR Working Policy below.
- Agents never merge into `main` or push to it: every change goes through a pull request, which the PO merges. The one exception is a small fix (documents, typos, configuration) that the PO commits on `main` or asks to have committed there.
- Conventional commits: `<type>(<scope>): <description>`, type `feat`, `fix`, `refactor`, `docs`,
  `test`, `chore`, `perf` or `ci`, the scope optional (a package or a change). A commit body may say
  `Refs #n`; only a pull request body says `Closes #n`.
- Before a pull request, run the checks in Development commands for what the change touches. The body says
  what changed and why, the checks run and their results, the `Closes` or `Refs` line, and what is
  left for the PO.
- No AI attribution of any kind: no tool, model or vendor named as author, co-author or generator;
  no co-author or session trailers; no links to an assistant's sessions or service; no "generated
  with" notes or badges. This holds for commits, pull requests, Issues, comments, code comments and
  documents.

## Git / PR Working Policy
- Worktree usage: enabled
- Worktree location: integrated
- Base branch: main
- Recorded on: 2026-10-27

Notes:

- Integrated worktrees live in `.claude/worktrees/<name>/` on branch `worktree-<name>`; name them `feature-<slug>` or `fix-<slug>`. `.claude/worktrees/` is excluded locally in `.git/info/exclude`, not in `.gitignore`.
- Claude Code creates them itself; with the default `worktree.baseRef` (`fresh`), a worktree branches from `origin/main`: unpushed local commits are not in it. Another agent creates one with `git worktree add .claude/worktrees/feature-<slug> -b worktree-feature-<slug> origin/main`.
- Run `./setup.sh` in a new worktree: `node_modules/` and the Codex files are not shared between checkouts.
- Small fixes (documents, typos, configuration) are committed directly on `main`; worktrees are for OpenSpec changes and extended work (recorded on 2026-10-28).
