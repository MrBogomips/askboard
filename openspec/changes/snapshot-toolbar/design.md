# Design

## Context

See proposal.md (Why) for the defect and its cause. What the fix stands on, all on `main` 8e2e1247:

- **The view.** `shell/index.tsx` `boot()`: `hosted` is `window.parent !== window`; a hosted view takes its theme from the board page (`channel.onTheme`) and applies the boot presentation's theme and density; a Snapshot follows the system through `followSystemTheme` and E7's `choice` store (`index.tsx:204-208`), which only `ThemeControl` sets. `startPresentation(data, channel, {hosted, report})` (`index.tsx:342`) builds the quick toggles' `PresentationControls` from `data.presentation ?? DEFAULT_PRESENTATION`; its `set` already handles a Snapshot's theme through an optional `followTheme` (`presentation-extras.ts:44-48`) that nobody passes, and ignores density. `QuickToggles` (`quick-toggles.tsx`) always renders Theme and renders density and "Settings" only when `controls.hosted`. `followTheme` (`theme.ts:46`) is the board page's preference follower (`board-page/start.ts:83`). The toggles' `Segmented` uses `radiogroup`/`radio` roles while `ThemeControl` uses `button`s, which is why `snapshot-view.browser.ts`' theme test only ever pressed E7's control.
- **The boot block.** `parseBootData` (`boot-data.ts`) keeps the `UPDATE_FIELDS` marked `atBoot`, `presentation` among them (`view-protocol.ts:840`, a `ViewPresentation` with `contextPlacement` and `locked`), and drops one that fails its check. A Snapshot's `askboard-data` block is its Snapshot data (AD-15).
- **The data.** `snapshot-data.json`'s `record` (`$defs/record`) is closed, with an `if`/`then`/`else` on `takenBy`; `SnapshotRecord` (`schemas/snapshot-data/index.ts:27`). `gatherSnapshot(sources)` builds it through `recordOf` (`core/src/snapshot/gather.ts:67`); `AskCore.snapshot` (`core.ts:904`) checks and gathers in one synchronous step, then awaits the writer.
- **The settings.** `Configuration.forBoard()` (`core/src/config/configuration.ts:53`) re-reads the user file's presentation keys over the first read, project keys winning (AD-14); writes queue on `#writes`; `CONFIGURATION_DEFAULTS` (`contract`, `schemas/configuration/index.ts:64`) holds `theme: "system"` and `density: "compact"`.

ADs relied on: AD-7 (one minor), AD-8 (no browser storage in the view), AD-9 (`assemble`, the boot block), AD-14 (presentation keys, project over user), AD-15 (the data block's content, amended). UX implemented: EXPERIENCE Snapshots (Snapshot view), Surfaces and ownership (Theme), Dark theme, Component Patterns (Quick toggles); DESIGN Dark theme mechanism, Components (Quick toggles, Snapshot view).

## Goals / Non-Goals

**Goals:** one working Theme control in a Snapshot, in the ask's language; a Snapshot opens in the theme and density the board had; a density switch in a Snapshot; Snapshots written before open as today.

**Non-Goals:** recording `contextPlacement` (open question 5); recording the theme the board resolved (open question 2); any change to the hosted board's toggles, the settings panel or the board protocol; a theme other than the board's for a Snapshot taken while the user file cannot be read (the board's defaults and the project file's keys are recorded, review 2.3 S-1).

## Decisions

### 1. One control: the quick toggles, followed on the page

`theme-control.tsx`, `BoardExtras.theme`, `BoardHeader`'s `theme` prop and E7's `choice` store go. In a Snapshot, `boot()` creates `const follower = followTheme(scheme, setTheme)`, calls `follower.prefer(initial.theme)` before the first render, and passes `followTheme: follower.prefer` and `followDensity: (density) => applyDensity(root, density)` to `startPresentation`. `startPresentation`'s non-hosted `set` handles `density` as it does `theme`: it calls `followDensity` and sets the store. `QuickToggles` renders density whenever it renders Theme, and "Settings" with its separator only when hosted; in a Snapshot neither toggle carries a lock description, since the Snapshot's presentation has `locked: []`. `followSystemTheme` is removed from `theme.ts` with its tests when nothing else imports it. The hosted path is unchanged.

*Alternative:* keep E7's control and hide the toggles' Theme in a Snapshot. Rejected: it is English-only (FR-34), duplicates `followTheme`, and gives no density.

### 2. The record carries the presentation

The record gains `presentation: {theme, density}`, both required inside it, closed, outside the `if`/`then`/`else` so both takers have it. Its enums are written in the Snapshot data schema, and a contract test asserts they equal the configuration schema's `theme` and `density` enums, so a configuration minor that adds a value fails the test and is decided, never inherited silently.

*Alternatives:* a top-level `presentation`, rejected because the boot block already has a `presentation` field of another shape (`UPDATE_FIELDS`), which `parseBootData` would drop as unshowable and the types would collide; a `$ref` into `urn:askboard:configuration:config`, rejected because the Snapshot data would widen whenever the configuration does, without its own minor (AD-7).

### 3. `ask-core` reads the settings a board would open with

`Configuration` gains `presentationNow(): Promise<{theme, density} | undefined>`: it awaits the queued writes (`#writes`), then `forBoard()`, and gives `values.theme` and `values.density` as they are, since the settings in effect already hold each default; it gives `undefined` when the core has no configuration port (only tests build one without; the session process always passes it). A user file that cannot be read or fails its check is absorbed by `Configuration#file` as when a board opens (it contributes no key), so it never rejects here. `AskCore.snapshot` awaits it first, catching a rejection (the configuration cannot give the settings at all) into `report` and `undefined`, then runs the existing synchronous check and gather unchanged; `SnapshotSources` gains `presentation?` (appended last), and `recordOf` puts it in the record when present. Reading first keeps the one synchronous step (core spec, Taking a Snapshot); awaiting the writes makes a toggle pressed just before "Snapshot" count. The same path serves the agent's `snapshot` tool and the board's request, so no board-protocol field is needed (open question 4).

*Alternative:* the board's Snapshot command carries the board page's presentation. Rejected: a board-protocol minor, and the agent's Snapshots would still need this path.

### 4. Opening a Snapshot

`opened-snapshot.ts` gains `snapshotPresentationOf(record)`: a `ViewPresentation` with the record's `theme` and `density`, `contextPlacement` `beside` and `locked` `[]` when `isPresentation` accepts it, else `DEFAULT_PRESENTATION` (`system`, `compact`). `boot()` uses it for a Snapshot in place of `data.presentation`, applying density and theme before the first render, and hands it to `startPresentation` (a new `initial` option). `isSnapshotRecord` (`boot-data.ts`) stays as it is: a malformed `presentation` in a hand-edited file falls back to the defaults and never stops the page from opening.

### 5. Density in a Snapshot

Shown and live, as the Issue expects (open question 3), on the page alone. The `.comfortable` class re-points the tokens as on the board (`applyDensity`), so no component changes.

### 6. Versions

The Snapshot data takes the next minor after `main`'s (askboard-contract-versioning): its constant moves when group 1 starts, its module's header comment gains one sentence naming this change, and the number is bound at task 4.2. Every other set keeps `main`'s; the view manifest gains no chunk (decision 1 only removes code from the shell chunk). Comments, schema descriptions and test titles say "since snapshot-toolbar", never a number. Earlier exact pins of the Snapshot data's version (`packages/contract/test/*-sets.test.ts`, `snapshot-data.test.ts`, and the others the Rule 2 grep finds) move at the binding.

Bound on 2026-11-08, merged with origin/main a8f1d0a0 (the branch is pushed, so merged, not rebased): Snapshot data 1.2 (main 1.1). Every other set equals main's: input format 1.12, output format 1.11, tool envelopes 1.12, board document 1.11, board protocol 1.8, view manifest 1.1, configuration 1.0.

### 7. Strings

None new: the toggles' `toggles.theme`, `toggles.system`, `toggles.light`, `toggles.dark`, `toggles.density`, `toggles.compact` and `toggles.comfortable` exist in en-US and it-IT.

### 8. Documents

- Spine, AD-15, Content, the `askboard-data` bullet, amended in place: the record also names "the theme and density a board would open with when it was taken (AD-14)".
- EXPERIENCE: Snapshots, Snapshot view (the hidden list loses "the density switch"; the theme bullet says it opens in the theme the board had, System following the viewer's system, with Theme and density toggles that save nothing); Surfaces and ownership, the Theme row; Dark theme ("with no parent host, as in a Snapshot, the view follows the theme the Snapshot recorded, System following `prefers-color-scheme`"). `updated:` is the apply date.
- DESIGN: Dark theme mechanism (the last two sentences); Components, Snapshot view (Surface and Anatomy: the density switch kept, one Theme control). `updated:` likewise.
- PRD: unchanged (FR-26, FR-27 and FR-35 say nothing of a Snapshot's theme).
- CHANGELOG, Unreleased, Fixed: one line for Issue #72.

## Merge points

Heads read on 2026-11-08. Each was re-checked at task 0.2 and at the merge of `origin/main` a8f1d0a0 (task 4.2): `oversized-acts` (#88) and `choice-documented-activation` (#87) are merged and archived (#91), and this branch holds them; the entries below keep what each touched, for the record.

- **`oversized-acts`** (#88, `worktree-fix-oversized-acts` 25bfc33c): edits `shell/index.tsx` (imports; `boot()`'s stores and `channel.onUpdate`, near this change's theme lines), `view-protocol.ts`, `chunk-sizes.json`, the spine (AD-20, AD-21), EXPERIENCE (State Patterns, Voice and Tone), CHANGELOG Unreleased and CLAUDE.md. No set moves. Conflicts expected in `index.tsx` imports and `chunk-sizes.json` only; keep both sides.
- **`choice-documented-activation`** (#87, `worktree-fix-choice-activation` 57618b67): `chunk-sizes.json`, the spine (line 657 area), EXPERIENCE (other sections), CLAUDE.md. No set moves.
- **`document-review`** (`worktree-feature-document-review`, in progress; 2ce2023c on 2026-11-08 after its own merge of a8f1d0a0, Snapshot data still 1.1 there, so no version collision): widens the input and output formats, the tool envelopes and the board document, not the Snapshot data. A trial merge (`git merge-tree`, pre-PR review 4.3 S-1) against its heads 2ce2023c and db44022d merges `shell/board.tsx` cleanly; the conflicts are the appended export blocks of `contract/src/index.ts` and `contract/src/fixtures/index.ts` (keep both blocks, main's first) and `chunk-sizes.json` (re-record on a build of the merged head).
- **The widget proposals** (`diagram-widget` ed783fe5, `spreadsheet-widget` 972b9622, `graph-widget` 482223d0, `diff-review` dfb0e6cb, `image-annotation` 1f8f6811; `keyboard-shortcuts-help` 101a9498): none widens the Snapshot data. `diagram-widget` appends `renders` to `SnapshotSources` and fills `renders` in `gatherSnapshot`: append both fields, keep both. Its kept renders show "for the Snapshot's theme" through the `.dark` class, which this change still sets. `diagram-render` (9281d923, 2026-11-06) is the earlier form of that work.
- **Borrowed names**, all on `main`: `followTheme` (`view/src/theme.ts:46`), `applyDensity` (`theme.ts:65`), `startPresentation` and `PresentationOptions.followTheme` (`shell/presentation-extras.ts:25`, `:18`), `DEFAULT_PRESENTATION` (`shell/presentation-controls.ts:26`), `QuickToggles` (`shell/quick-toggles.tsx:13`), `snapshotTitleOf` (`shell/opened-snapshot.ts`), `isSnapshotRecord` (`boot-data.ts:45`), `isPresentation` (`view-protocol.ts:575`), `SnapshotRecord` (`contract/src/schemas/snapshot-data/index.ts:27`), `SNAPSHOT_DATA_VERSION` (`:14`), `CONFIGURATION_DEFAULTS` (`schemas/configuration/index.ts:64`), `gatherSnapshot`, `SnapshotSources`, `recordOf` (`core/src/snapshot/gather.ts`), `Configuration.forBoard` (`core/src/config/configuration.ts:53`), `lifecycleSnapshotData` (`contract/src/fixtures/snapshot.ts:132`).

Needs probe: none. Nothing here depends on Claude Code's run-time behaviour.

## Risks / Trade-offs

- [A board whose write failed shows a theme the file does not hold] → The Snapshot records the saved settings; the board already shows the write's field error (FR-35). Accepted.
- [Another session wrote the user file since the board opened] → The Snapshot records the file as it is at capture, as a newly opened board would. Accepted.
- [A configuration read hangs] → The read is a local file read, as each board's open does; no new wait beyond the queued writes.
- [Agent-readable data grows by two enums] → No user content, no token (AD-15 unchanged otherwise).

## Migration Plan

Snapshots already written have no `presentation` and open in the viewer's system theme, compact, with the toggles live. Rollback is a revert; Snapshots written in between keep a field an older view ignores (the record's check reads only `takenAt`, `takenBy` and `who`).

## Open Questions

The five PO questions are in proposal.md with their defaults, accepted under the PO's unattended handoff and recorded by task 0.1. Documents in conflict: the Issue's expected behaviour contradicts EXPERIENCE (Snapshots, Dark theme) and DESIGN (Dark theme mechanism, Snapshot view), which bind; under the defaults this change amends them (decision 8), and a "keep the viewer's system theme" answer to question 1 drops decisions 2 to 4 and the core and contract deltas.
