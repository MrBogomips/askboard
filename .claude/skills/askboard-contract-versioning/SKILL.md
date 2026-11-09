---
name: askboard-contract-versioning
description: Keeps concurrent AskBoard OpenSpec changes from colliding on the versions of the contract package's schema sets (input format, output format, tool envelopes, board document, board protocol, view manifest, Snapshot data, configuration, local API, session file) and on the seam names one change borrows from another. Use it whenever you design, implement, rebase or review an AskBoard change that adds or edits a schema under packages/contract, moves a *_VERSION or *_FORMAT constant, adds a board-protocol message or a schema set, or borrows or introduces a seam (appended registries and export blocks, dispatch tables, one-line unions, ports), including group 0 name checks, binding version labels at the rebase before a pull request, and spec review checkpoints. Not for package or plugin semver, dependency pins, molecule definition versions, or versioning questions outside this repository.
---

# Contract versions and seams across concurrent changes

AskBoard designs and builds several OpenSpec changes at once, in separate worktrees, and most of them widen the same schema sets in `packages/contract` and extend the same dispatch points. Every collision so far cost a relabel, an `/opsx:update` or a rebase with dozens of conflicting hunks. This skill says where a version number may be written, when it is bound, what moves with it, and how borrowed names stay valid until the merge. CLAUDE.md holds the commands and the working documents; `askboard-implementation` holds the Biome rule for appended export blocks; `askboard-review-protocol` holds the finding format.

## When it applies

- Designing a change (proposal, design, delta specs, tasks) that widens a schema set, adds a set or a board-protocol message, or uses a name another change defines.
- Implementing a task that edits a version constant, a schema JSON file, `SCHEMA_SETS`, `SCHEMA_IDS`, `BOARD_PROTOCOL_MESSAGES`, an export block of a contract entry module, or a seam listed under Rule 3.
- Rebasing a change onto `main` or preparing its pull request.
- Reviewing a task group or a pull request.

## Why: the history

- Board protocol: E3 took 1.1 (#13) and E5 took 1.2 (#28). E7 had designed 1.2 and was relabelled 1.3 after its rebase (`47f6a4ca` on `origin/worktree-feature-snapshot`: two constants, a fixture comment, four contract tests, a view test, a `tools/build` test, design and tasks). E8 wrote 1.2, then 1.3, and bound 1.4 after E7 merged (`98687894`, #31). `widget-answers` planned "five sets at 1.2" and was re-planned to input 1.4, output 1.3, tool envelopes 1.4, board document 1.4, board protocol 1.5 (`7b06400c`, six artifacts, #32).
- E3's design decision 2 already said "the minor is a label assigned at merge" (`openspec/changes/archive/2026-11-03-ask-lifecycle/design.md:40`) and E7's design repeated it. The numbers leaked anyway, into designs, task notes, specs, schema descriptions, comments and test titles.
- Numbers written early go stale where nobody re-reads them: `openspec/specs/contract/spec.md:305` and `packages/contract/src/molecules/index.ts:3` still say "until the input format reaches 1.1", though the widget schemas joined input 1.4; #18's PR body says "widget-answers (input format 1.2)". The Tree requirement at `openspec/specs/contract/spec.md:177` says "until the input format admits one" and stayed true.
- Seams: push-delivery turned its dispatch points into tables during its integration (final names at `432f2f0`), and excerpts, snapshot and settings-languages each needed a "use push-delivery's final names for its seams" commit (`c1b8222f`, `0f0b8a31`, `789bc9d1` on their branches).
- Rebases: #18 had 18 conflicting commits and 37 hunks (export blocks, shell, view protocol); #29 needed three "drop conflict leftovers" commits; stacked header comments from resolved conflicts are still on `main` at `packages/contract/src/index.ts:377-380`, `:405-413` and `:491-502`.

`main` takes each pull request as one squashed commit, so the commits cited above live on the `origin/worktree-feature-*` branches.

## The versioned sets

Read the current values from `main`, never from a document, a note or this skill:

```sh
git fetch origin && git grep -nE '^export const [A-Z_]+_(VERSION|FORMAT) = "' origin/main -- packages/contract/src
```

| Set (AD-7) | Constant | Module under `packages/contract/src/` | Owner | Registered in |
|---|---|---|---|---|
| input format | `INPUT_FORMAT_VERSION` | `schemas/input/index.ts` | contract | `SCHEMA_SETS` |
| output format | `OUTPUT_FORMAT_VERSION` | `schemas/output/index.ts` | contract | `SCHEMA_SETS` |
| tool envelopes | `TOOL_ENVELOPES_VERSION`, named with the output format in every result's `RESULT_VERSIONS` | `schemas/tool-envelopes/index.ts` | mcp-tools | `SCHEMA_SETS` |
| board document | `BOARD_DOCUMENT_VERSION` | `schemas/board-document/index.ts` | ask-core | `SCHEMA_SETS` |
| board protocol | `BOARD_PROTOCOL_VERSION` | `schemas/board-protocol/index.ts` | board-host | `SCHEMA_SETS`, message names in `BOARD_PROTOCOL_MESSAGES` |
| view manifest | `VIEW_MANIFEST_VERSION` | `schemas/view-manifest/index.ts` | view | `SCHEMA_SETS` |
| Snapshot data | `SNAPSHOT_DATA_VERSION` | `schemas/snapshot-data/index.ts` | snapshot | `SCHEMA_SETS` |
| configuration | `CONFIGURATION_VERSION` | `schemas/configuration/index.ts` | ask-core | `SCHEMA_SETS` |
| local API | `LOCAL_API_VERSION` | `push/local-api/index.ts` | board-host | standalone (push-delivery design decision 1) |
| session file | `SESSION_FILE_FORMAT`, in the file's `format` | `push/session-file/index.ts` | board-host | standalone |

- Push delivery's standalone schemas (`push/push-message.json`, `presence.json`, `origin.json`, `agent.json`) name the output format's or the board protocol's version, imported from those constants.
- `bench-timing` has an owner in `SCHEMA_SET_OWNERS` (`versions.ts:22`) and no schemas yet.
- Not schema sets: the molecule definition format (`MOLECULE_FORMAT_VERSION`, three-part semver, `molecules/index.ts:8`) and the client version gate (`packages/core/src/push/version.ts`, AD-18), which checks the client application's version against a minimum.

How a version is checked:

- Versions are `major.minor` on the wire, and a receiver compares the major only: `unsupportedVersion` (`versions.ts:59`), called by `validateVersioned` (`validate.ts:81`), `validateBoardMessage` (`validate.ts:110`), push delivery's validators (`push/validate.ts:83`), the board page's host messages (`packages/view/src/board-page/host-messages.ts:74`) and the view manifest loader (`packages/view/src/board-page/load-view.ts:43`). Each set's version schema pins major 1 with the pattern `^1\.(0|[1-9][0-9]*)$` (`schemas/board-protocol/version.json`, `schemas/tool-envelopes/versions.json`, and one per set).
- Tool requests name no version (AD-7); every tool result names `{result, output}`.
- `schemaSetProblems` (`validate.ts:291`, through `setProblems` at `:258`) fails a set whose name has no owner in AD-7's table or whose version is not `major.minor`.
- Consumers in `core`, `server`, `view`, `hooks` and `mod` import the constants and write no number. Contract fixtures take `version` from the constant (`fixtures/lifecycle-transcripts.ts:45`).

## Minor or major

A minor keeps its major's meaning (`versions.ts:1-9`): it may add fields and enum values, make a required field optional, and lift or add a limit. Every schema refuses what it does not define, so a minor's additions are usable only because one session process serves both the board page and `board-host`. Anything else (a field or value removed or renamed, a new required field, a changed meaning) is a major. No change has taken one: it rewrites the major pattern in every set's version schema and the fallbacks AD-7 names, so it is a design decision citing AD-7 and raised to the PO, never a task-level edit. A change takes at most one minor per set, however many fields it adds. Two changes merged together by one integration session may share one minor (E3 design decision 2).

## Rule 1: a label until the rebase, a number at the rebase

- In the proposal, design, delta specs and tasks, write the label "next minor after main's" for each set the change widens, and list those sets. Write no number. Never take a number from another change in flight: unmerged changes reserve nothing, and whichever merges first takes the next minor.
- Delta specs state what the set admits, as `openspec/specs/contract/spec.md:177` does, not the number that admits it. A compatibility scenario says "the previous minor".
- Schema `description` fields, doc comments, code comments, fixture comments and test titles name the change, not the number ("since widget-answers", "E7's minor adds…", as each set module's header comment does). That stays true after any rebind.
- The constant must hold a number while you build: set it to main's current minor plus one when the group starts. That number then appears in two places only: the constant and the change's own version test.
- Other new tests compare with the constant (`version: BOARD_PROTOCOL_VERSION`), never with a literal. A test that only needs "this change's additions are in" asserts an at-least version, as `packages/contract/test/lifecycle-fixtures.test.ts:152` does.
- Bind at the rebase right before the pull request: main's current minor plus one for each set the change widens; sets it does not widen keep main's value. If another change that widens the same set merges first, rebind after its merge. Re-read main's constants just before the merge too.
- Record the binding once in design.md, under the versions decision, as a dated line: "Bound on <date>, rebased onto origin/main <sha>: board protocol 1.6 (main 1.5), output format 1.4 (main 1.3)." Mirror it in the rebase task's note, the PR body and the change's as-built note `docs/as-built/<change-id>.md`, which names the bound versions.

## Rule 2: what moves with one minor

For each set the change widens:

1. The constant in the set's module, and one appended sentence in that module's header comment naming the change and what its minor adds.
2. The schema files in the set's folder, each with `$id` `urn:askboard:<set>:<name>` and only minor-compatible edits. A new schema is appended to the set's `schemas` list and to `SCHEMA_IDS` (`sets.ts:28`).
3. A board-protocol message follows E3's four appended steps (`openspec/changes/archive/2026-11-03-ask-lifecycle/design.md:115-122`): the schema; its name at the end of its direction in `BOARD_PROTOCOL_MESSAGES` (`schemas/board-protocol/index.ts:87`); one dispatch entry in `board-host/boards.ts` and in the board page's controller; a transcript in the change's own fixtures module.
4. A new set: a row in AD-7's table in the spine (same change), an owner in `SCHEMA_SET_OWNERS` (`versions.ts:22`), an entry appended to `SCHEMA_SETS` (`sets.ts:14`), a version schema pinning major 1, and version 1.0.
5. Exports: one appended block at the end of `src/index.ts`, `src/validate.ts` and `src/fixtures/index.ts`, laid out as `askboard-implementation` says. Never edit another change's block.
6. Fixtures and transcripts go in the change's own module under `src/fixtures/` (such as `<change>.ts` and `<change>-transcripts.ts`), with `version` from the constant. Never edit E1's `transcripts` or the approved examples in `packages/contract/test/fixtures/`, which stay at 1.0 and byte-identical to the archived `review-model-contract` examples (`approved-examples.test.ts`).
7. Tests: the change's version test pins the bound number, and every earlier exact pin of that set moves with it (grep below). `schemaSetProblems` covers new schemas with no new test. Literals that check another minor is accepted, such as `"1.0"` messages, stay.
8. Consumers need no edit for the number. A board-protocol message to the page also needs a member of `BoardHostMessage` and gets a generated standalone validator (`tools/build/validators.ts`): run `bun run build` and `tools/build/validators.test.ts`, and handle chunk growth as `askboard-implementation` says.
9. Documents: the binding line of Rule 1. The spine changes only for a new set or a major; the spine and SOLUTION-DESIGN.md record no current numbers, so keep it that way.

Find every exact pin before binding. The hits that equal a current constant are pins and move; the rest test acceptance of another minor and stay:

```sh
grep -rnE '"1\.[1-9][0-9]*"' packages/contract/test packages/view/src tools/build packages/server/test packages/core/test
```

## Rule 3: seams

A seam is a name one change defines and another extends or calls. In AskBoard they are:

- the appended registries and export blocks of `contract`: `SCHEMA_SETS`, `SCHEMA_IDS`, `BOARD_PROTOCOL_MESSAGES`, and the blocks at the end of `src/index.ts`, `src/validate.ts`, `src/fixtures/index.ts`;
- push-delivery's dispatch tables and one-line unions (`openspec/changes/push-delivery/design.md:180-185`, Merge points L8 to L10): `CoreEvent` (`packages/core/src/core.ts:122`), `HostCore` (`packages/server/src/board-host/index.ts:55`), `PageCommand`, `Boards.#openers` and `Boards.#commands` (`packages/server/src/board-host/boards.ts:176`, `:589`, `:642`), `ViewMessage` and `UPDATE_FIELDS` (`packages/view/src/view-protocol.ts:173`, `:760`), `BoardHostMessage` (`packages/view/src/board-page/host-messages.ts:29`), `#viewHandlers` (`packages/view/src/board-page/controller.ts:391`), `BoardExtras` (`packages/view/src/shell/board.tsx:88`);
- ports such as `CorePorts` (`packages/core/src/ports.ts:79`), `Clock` and `MoleculeSource`, and any function, type or fixture another change's design names.

Rules:

- Borrow only names present on `main`: `git grep -n '<name>' origin/main -- packages`.
- A name from an unmerged change is a merge point. List it in design.md under Merge points with the owning change, the branch commit you read it at, and the tasks that use it; those tasks wait for that change's merge, and the rebase re-checks the name.
- When your change creates a point later changes will extend, make it a table or a union they append to, and keep its name once another design cites it. If you must rename, find every design that cites it (`openspec/changes/*/design.md` on `main` and on the feature branches) and tell the coordinator, since each needs an `/opsx:update`.
- Append at the end; never reorder or rewrite another change's entries.

Group 0 task, in the repository's task style:

> - [ ] 0.N Check every name design.md borrows (Merge points) on `origin/main` with `git grep -n`, and record each with its file and line in this task's note. Record the version each set this change widens holds on `main`; the constants start at the next minor and are bound at the rebase task. Verify that the note lists every name and version; if a name, signature or shape differs, or a name is not on `main`, stop and run `/opsx:update` before group 1.

Last group, before the pull request:

> - [ ] N.M Rebase onto `origin/main` and bind the version labels (askboard-contract-versioning): each widened set at main's minor plus one, the earlier exact pins moved, the binding line in design.md, every borrowed name re-checked. Verify that `git grep` finds each borrowed name on the rebased head, that the diff carries no stale number, and that `bun run check`, `bun run build` and `openspec validate --all --strict --no-interactive` pass; record main's SHA, the bound versions and the counts in the note.

## Rebase procedure

1. `git fetch origin`. Read main's constants (command above) and `git log --oneline <old-base>..origin/main` for what merged since your base.
2. Find the changes still in flight. `openspec list` on `main` also lists merged changes not yet archived; unmerged work lives on branches. For each `worktree-feature-*` branch with `git rev-list --count origin/main..<branch>` above zero, `git diff --name-only origin/main...<branch> -- packages/contract/src/schemas packages/contract/src/push openspec/changes` shows whether it widens your sets. Check `gh pr list --state open` too. If one with an open pull request widens the same set, agree the merge order with the coordinator and bind after it merges.
3. Keep a backup: `git branch backup/<change>-pre-rebase-<date>`.
4. If your branch was built on another change's branch and that change has merged, run `git rebase --onto origin/main <that branch's last commit in yours>` so its squashed commits are not replayed; otherwise `git rebase origin/main`.
5. Resolve conflicts:
   - In registries, export blocks and one-line unions, keep every entry of both sides, main's first.
   - Keep one header comment per export block and delete any superseded versions of it.
   - Take main's version constant, then rebind it.
   - For `packages/view/chunk-sizes.json`, follow `askboard-implementation`.
   - Search for leftovers: `grep -rn '^<<<<<<<\|^>>>>>>>' packages tools`.
6. Bind the labels and move the pins (Rules 1 and 2). Re-check every borrowed name on the rebased head; a difference stops the work for `/opsx:update`.
7. Run `bun install --frozen-lockfile`, `bun run check`, `bun run build` and `openspec validate --all --strict --no-interactive`, plus `bun run test:e2e` when the view, the server or the conformance suite changed (CLAUDE.md).
8. Record the rebase task's note, the PR body and the as-built note. If another change merges first, repeat from step 1.

## What the spec reviewer checks

- Each set the diff widens moved exactly one minor past main's (`git show origin/main:packages/contract/src/<module>`); every other set equals main's.
- Each edit is minor-compatible (see Minor or major). Anything else is a finding unless a design decision cites AD-7 and records the PO's approval.
- Before the rebase task: the change's artifacts, comments, schema descriptions and test titles carry labels or change names, not numbers. After it: the bound number is the same in the constant, the version test, the design binding line, the task note, the PR body and CLAUDE.md.
- No number or name is taken from an unmerged change. Every borrowed name is in design.md's Merge points, and the group 0 note gives its file and line on `main`.
- Added lines carry no stale number. Read each hit of `git diff -U0 origin/main...HEAD -- packages tools openspec | grep -E '^\+[^+].*\b1\.[0-9]+\b'`.
- Registries and export blocks changed by appended lines only (plus the constant line). There is one header comment per block and no conflict residue.
- Fixtures take `version` from the constant. The approved examples are untouched. A new set has its AD-7 row, its `SCHEMA_SET_OWNERS` entry and its `SCHEMA_SETS` entry.
