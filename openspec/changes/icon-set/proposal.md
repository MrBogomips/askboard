# Proposal

## Why

Issue: #188

The board draws its marks as Unicode glyphs in strings and JSX (↓ → ↩ ↻ ↗ ✓ ✕ ×) and four hand-drawn inline SVGs. Glyphs render differently per platform font, and a glyph inside a label is read aloud as part of its name ("Next open down arrow"). DESIGN.md's Open point 2 (F-76) says no icon set is chosen. The PO chose Lucide, pinned, on 2026-11-14 (decision 7 of the answering-flow review of #168, report §7 and §8.3 P2-2). Direction B "Cabina" (`answering-flow-visual`) and the answer-state ladder (`answering-flow-guidance`) both draw icons, so the set comes first (report §8.4). Serves NFR-5, NFR-6, NFR-9, NFR-12, FR-34; relies on AD-1, AD-8, AD-9, AD-11, AD-19.

## What Changes

- **Adopt Lucide.** `lucide-react`, pinned exactly (1.73.0, still the latest on 2026-11-15; re-read when the change adopts it), in `packages/view/package.json` only, and added to the spine's Stack. ISC licence, 25,766 stars, released and pushed 2026-11-14, not archived: it meets the adoption rule with no exception (design decision 1). Icons are bundled code: no icon font, no sprite, nothing fetched (NFR-9, AD-11).
- **One icon module, one chunk.** `packages/view/src/icons/index.ts`, exported as `@askboard/view/icons`, re-exports each icon the board uses under an AskBoard name, imported by its path (`lucide-react/icons/<name>`). A new library chunk, `icons`, provides it to the shell and to every component chunk, so Lucide's runtime is bundled once. `check:imports` fails on any other import of `lucide-react`.
- **Glyphs and ad-hoc SVGs replaced.** The glyphs become icons, each beside the text label it had: the two "Next open" jumps, the unread-reply badge, the agent-change flag, a reference's "opens in browser" hint, the Approval's selected decision, and the comment card's close control. The date field's calendar, the Tree's chevron and the Tree's and the Ranking's drag grips come from the module too (design decision 2). The glyph leaves the strings and the accessible names. **BREAKING** for tests only: "Next open ↓" is now named "Next open".
- **Accessible names.** A decorative icon is `aria-hidden`. A mark whose only content is an icon is an image named by the existing strings ("1 new reply", "The agent updated this"). An icon-only control is named by its button.
- **Board page (Q1, proposed default).** The board page is plain DOM, outside the sandbox, so `lucide-react` cannot draw its two ✕ close controls. By default it adopts `lucide`, Lucide's DOM package from the same repository and release, pinned with `lucide-react`. This waits for the PO's answer on #188.
- **What stays text or CSS.** Key names (⌃ ⌥ ⇧ ⌘ ↩ ⌫ ⌦ ↑ ↓ ← →) in key caps, tooltips, the keys panel and `askboard-help`. The state markers' CSS shapes and their text labels. The Gantt's duration pin and every chart SVG. An icon never replaces a label (DESIGN.md, Do's and Don'ts).
- **Records.** The spine: the Stack rows, AD-1 and AD-9 (widgets may import `view`'s icon module), the Structural Seed, and the Tests row (the import rule). DESIGN.md: a new Icons section, Open point 2 settled, one Do's and Don'ts row. Dependabot: Lucide's near-daily minor releases are bumped by hand (design decision 9). `docs/as-built/icon-set.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `view-and-widgets`: new requirements for the one icon set and its chunk, for icons beside their labels with their accessible names, and for the board page's close icon (default of Q1).

## Impact

- `packages/view`: `package.json` (the pin and the `./icons` export), `src/icons/` (new), `src/shell/board-header.tsx`, `src/shell/navigators.tsx`, `src/catalog/context/reference.tsx`, `src/catalog/date-field/index.tsx`, `src/strings/{en-US,it-IT}.ts` (two values lose their glyph), and `src/board-page/{reading-panel,settings-panel}.ts` with a new `src/board-page/icons.ts` (Q1). `chunk-sizes.json` gains the `icons` chunk: about 6 KB minified, measured on the planned ten icons.
- `packages/widgets/src`: `approval/widget.tsx`, `shared/annotations/card.tsx`, `tree/row.tsx`, `ranking/row.tsx`.
- `tools/`: `build/shared-modules.ts`, `build/paths.ts`, `check-imports.ts`, and their tests.
- Browser tests that name a glyph, and a new `icons.browser.ts`. `.github/dependabot.yml`. `bun.lock`.
- Documents: the spine, DESIGN.md, `docs/as-built/icon-set.md`. EXPERIENCE.md is unchanged: DESIGN.md's Icons section says how a glyph quoted in a label is drawn.
- No contract schema set changes. No keys change. No Claude Code run-time behaviour is assumed. Platforms: macOS and Linux, Chromium, Firefox and WebKit (NFR-7).
