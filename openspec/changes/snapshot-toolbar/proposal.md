# Proposal

## Why

Issue: #72. An opened Snapshot shows two "Theme" groups in its toolbar and one does nothing; it ignores the theme chosen on the board and has no density switch (end-to-end test 9.2, 2026-11-08). The cause is on `main` (8e2e1247): E7's own `ThemeControl` (`view/src/shell/theme-control.tsx`, rendered at `board-header.tsx:101`) survived E8's merge beside E8's quick toggles, whose Theme a Snapshot also renders (`quick-toggles.tsx:25`); the shell starts the toggles without `followTheme` (`shell/index.tsx:342`), so their Theme only moves its own pressed segment. The Snapshot data holds no presentation (`snapshot-data.json`, closed object; `core/src/snapshot/gather.ts:123`), and the shell applies the boot presentation's theme only when hosted (`index.tsx:202`), so a Snapshot always opens in the viewer's system theme, compact. EXPERIENCE and DESIGN prescribe the last two behaviours (Snapshots, Snapshot view: "opens in the viewer's system theme", "the density switch" hidden); the Issue asks for the board's theme and the density switch, so this change amends them.

## What Changes

- **One Theme control** (design decision 1): E7's `ThemeControl` and its store are removed; a Snapshot's quick toggles act on the page alone, saving nothing and touching no browser storage, as E8's `startPresentation` already intends, through the existing `followTheme` of `view/src/theme.ts`. The toggles' strings follow the ask's language, which E7's English-only control did not.
- **The board's presentation recorded** (decisions 2 and 3): the Snapshot's record gains an optional `presentation`, `{theme, density}`, the values a board would open with when the Snapshot is taken (the user file's presentation keys under the project's, AD-14), for the agent's Snapshots and the board's. A read that fails records none and never refuses the Snapshot.
- **The Snapshot opens as recorded** (decision 4): theme `light` or `dark` opens fixed; `system` follows the viewer's system, as does a Snapshot with no recorded presentation (one written before this change); density opens as recorded, else compact.
- **Density in a Snapshot** (decision 5): the "Compact | Comfortable" switch shows in a Snapshot and acts on the page alone; "Settings" stays hidden; no toggle is disabled by a project lock, since nothing is saved.
- **Documents**: AD-15's data block list (amended in place), EXPERIENCE Snapshots and Dark theme, DESIGN Dark theme mechanism and Snapshot view, CHANGELOG Unreleased (Fixed).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contract`: new requirements "The presentation in the Snapshot data" and "This change's Snapshot data at its next minor".
- `core`: new requirement "The presentation a Snapshot records".
- `view-and-widgets`: "The Snapshot view's chrome" and "Theme in a Snapshot" modified; new requirement "Density in a Snapshot".

## Impact

- Code: `packages/contract/src/schemas/snapshot-data/` (the record's schema, `SnapshotRecord`, the constant), a fixture in `src/fixtures/snapshot-toolbar.ts`; `packages/core/src/core.ts` (`snapshot`), `core/src/snapshot/gather.ts` (`SnapshotSources`), `core/src/config/configuration.ts` (a read after pending writes); `packages/view/src/boot-data.ts`, `view/src/shell/` (`index.tsx`, `board.tsx`, `board-header.tsx`, `quick-toggles.tsx`, `presentation-extras.ts`, `opened-snapshot.ts`; `theme-control.tsx` removed), `view/src/theme.ts` (`followSystemTheme` removed if unused); `packages/view/chunk-sizes.json` if the shell chunk moves.
- Versions: the Snapshot data takes the next minor after `main`'s; every other set keeps `main`'s (design decision 6). No board-protocol message, no dependency.
- IDs served: FR-26, FR-27, FR-34, FR-35; NFR-5, NFR-9. ADs: AD-7, AD-8, AD-9, AD-14, AD-15 (amended). UX: EXPERIENCE Snapshots (Snapshot view), Surfaces and ownership (Theme row), Dark theme, Component Patterns (Quick toggles); DESIGN Dark theme mechanism, Components (Quick toggles, Snapshot view).

## Open questions for the PO

Each carries a proposed default, accepted under the PO's unattended handoff; task 0.1 records them, and a different answer comes back through `/opsx:update` before group 1.

1. **Board's theme or viewer's system.** *Default:* the Snapshot opens in the theme the board had (the Issue's expectation), and its Theme toggle still switches it, saving nothing. *Alternative:* keep the viewer's system theme (EXPERIENCE as written) and fix only the duplicate control.
2. **The preference or the resolved theme.** *Default:* the preference: `system` stays `system`, so a board on System opens a Snapshot in the viewer's system theme. *Alternative:* the theme the board showed at capture, light or dark.
3. **Density in a Snapshot.** *Default:* the "Compact | Comfortable" switch shows and the Snapshot opens in the recorded density, reversing EXPERIENCE's "the density switch is hidden" (L211). *Alternative:* the recorded density with no switch.
4. **The agent's Snapshots.** *Default:* they record the presentation too, read from the same settings, since the same user opens them. *Alternative:* only a board's Snapshot records it (the board's request would carry it: a board-protocol minor).
5. **Context placement.** *Default:* not recorded; a Snapshot keeps opening with the context beside, as today (out of #72's scope). *Alternative:* record `contextPlacement` too and open the Snapshot with it.
