# Design

## Context

See proposal.md for the why. The branch starts on `origin/main` 46d3dcf7; it is rebased onto main once `answering-flow-guidance` and `answering-flow-visual` have merged (task 0.1, Merge points). What this design relies on, on `main` unless named:

- **Tokens.** `tools/build/tokens.ts`: `readDesignTokens` reads DESIGN.md's YAML `colors` and aliases; `tokensCss` writes `:root`, `.dark` and `.comfortable`, failing on a colour with no `-dark` twin. `tools/build/styles.ts` (`writeTokenFiles`, `tailwindInput`) imports `tokens.css` into the board page's and the shell's styles.
- **Chunks.** A manifest chunk's `styles` is already a list of files; `board-host` serves each (`server/src/board-host/view.ts:115`), `sourcesToFetch` fetches each (`view/src/assemble/select.ts:131`), and `assemble` inlines each as one `<style>` whose hash `viewPolicy` (`assemble/index.ts:56`) puts in the view's policy. `targetOf(data)` (`:102`) gives `selectChunks` a board or a Snapshot target.
- **Theme.** `view/src/theme.ts` (`applyTheme`, `applyDensity`, `resolveTheme`, `followTheme`, `DARK_QUERY`). The board page passes the resolved theme to the view (`board-page/start.ts:83`); a Snapshot follows the system itself (`shell/index.tsx:115-127`). `createThemeStore` watches the root's `class`; the Chart re-reads its tokens on `useTheme` (`widgets/src/chart/widget.tsx:82-90`). No Mermaid or PlantUML renderer is on `main`.
- **Settings.** `PRESENTATION_KEYS` and its kin (`contract/src/schemas/configuration/index.ts`), read generically by `ask-core` and `board-host`; `presentationNow` records `{theme, density}` (`core/src/config/configuration.ts:69`); the view's `setting` check (`view-protocol.ts:596-613`); the panel's `CHOICES` and `LABELS` (`board-page/settings-panel-data.ts:76-96`); `QuickToggles`, read-only through `fixedBy`.
- **Versions on `main` (46d3dcf7):** configuration 1.1, board protocol 1.10, Snapshot data 1.3. `answering-flow-guidance` widens configuration and the board protocol; `answering-flow-visual` widens the board protocol (draft record).

AD IDs relied on: AD-1 (no new import edge: the palette list crosses `contract` to `core`, `server` and `view` along existing edges; `tools/build` already imports `@askboard/contract`), AD-7 (three minors), AD-8 (agent content never chooses a palette's CSS; no browser storage), AD-9 (chunks, the Snapshot's inlined sheets), AD-14 (a presentation key, amended in place), AD-15 (the Snapshot record). UX: DESIGN.md Colors (Token layers, Swap rule, Modes, Dark theme mechanism, Colour role rules, Diagram theme, Contrast); EXPERIENCE.md Board chrome, Preferences and Settings, Snapshots, Accessibility Floor, Dark theme. Input: `drafts/ux-review-168/icons-and-theming-research-1.0.0.md` §5; `ux-review-report-1.1.0.md` §7 and P2-3; `proposals/proposal-b-cabina-1.0.0.html` (palette values; 1.1.0 on `answering-flow-visual`'s branch holds the same values and adds Carta's); `cabina-settling-1.0.0.md` §1 (Carta on B's pairs, on that branch).

## Goals / Non-Goals

**Goals:**

- A board with no palette set is byte-equal in its default tokens and computes the same colours as today.
- A palette is data in DESIGN.md: adding a fifth later is a YAML group, a contract enum value and two strings.
- A Snapshot's size grows by one palette at most.
- Every guard-rail of research §5.4 runs as a test, reporting where the PO said report.

**Non-Goals:**

- An accent-only choice (§5.2), a third density, `prefers-reduced-motion` (change 4 owns it), the Timeline's bar palette (#78), bundled fonts (D-4).
- Diagram renderers: none is on `main`; DESIGN.md's Diagram theme gains the rule the Diagram epic follows (D7).
- No key is added or altered: the palette row is a `Segmented` with its existing arrow keys, so no key table, `KeyHint` or keys-panel entry changes, and `keys-coverage.test.ts` is unaffected.

## Decisions

### D1. The palette key

`Palette = "carta" | "nordico" | "grafite" | "contrasto"` and `PALETTES` (that order) beside `ThemePreference` and `Density`; `config.json` gains `palette`; `PRESENTATION_KEYS` and `CONFIGURATION_KEYS` gain it after `afterAnswer` (appended); `ConfigurationValues.palette`; `CONFIGURATION_DEFAULTS.palette = "carta"`. The board protocol's `setting.json` key enum and its `if/then` chain admit it, `settings.json` gains an optional `palette` row (a required row would be a major) and `write.key` admits it, as `answering-flow-guidance` did for `afterAnswer`. The Snapshot data's `presentation` gains an optional `palette` (D6). Like the theme, the key is set at user and project level (PO, 2026-11-14); a project value wins and shows read-only (AD-14). `core` and `server` read the presentation keys generically, so their sources change only in `presentationNow` (`{theme, density, palette}`) and `SnapshotPresentation`.

*Alternative.* A `"system"` palette value that follows `prefers-contrast` was rejected: contrast follows the theme's System (D5), so one switch says "follow the system".

### D2. The palettes' values

DESIGN.md's YAML gains `palettes:`, one group per palette but Carta (`colors` stays Carta's), each holding every non-alias key of `colors` and its `-dark` twin, and nothing else. Sources and rules:

- **Nordico, Grafite, Contrasto**: every role B's mockup draws, verbatim from `proposal-b-cabina-1.0.0.html` lines 14-39 and 66-118 (1.1.0 equal). `success-foreground` and `--shadow` are not adopted (not DESIGN.md roles; visual's merge point).
- **Roles the mockup does not draw**, derived per palette and scheme: `destructive-foreground` and `change-foreground` take the palette's `primary-foreground` in light and its `background` in dark (as Carta does); `diff-add` = `success-subtle`, `diff-del` = `destructive-subtle`; `diff-add-mark` and `diff-del-mark` = `success` and `destructive` in light, `success-text` and `destructive-text` in dark; `gantt-bar` = `border-strong`; `chart-1` to `chart-5` = Carta's values in that scheme (the ΔE rules of DESIGN.md Open Items 7 are distances between slots, so they hold unchanged); `syntax-*` = Carta's values, each darkened (light) or lightened (dark) along its own hue in steps of 2% OKLab lightness only until the report (D10) shows it at its minimum on the palette's `card`, `diff-add` and `diff-del`.
- **Grafite** is the dark-first palette: its dark scheme is the reference drawing; choosing it does not change the theme preference.
- **Contrasto** targets 7:1 text and 4.5:1 marks; its derived roles follow the same rules with those targets.

### D3. The token build

`readDesignTokens` returns `palettes: Record<string, Record<string, string>>`. A new `paletteCss(tokens, name)` returns `:root[data-palette="<name>"]{…light…}\n:root[data-palette="<name>"].dark{…dark…}\n`, roles only (aliases resolve through `var(--target)` from `:root`). Specificity: `:root[data-palette]` (0,2,0) beats `:root` and `.dark`, and its `.dark` form (0,3,0) beats both, so no `!important` and no order dependence. `tokensCss` is unchanged, so Carta's CSS is byte-equal. `paletteCss` and a `checkPalettes(tokens, PALETTES)` throw, naming the palette and the key, on: a role of `colors` missing, a `-dark` twin missing, a key `colors` lacks, an alias key, and a palette name not in `PALETTES` or a `PALETTES` name other than `carta` with no group.

### D4. One stylesheet per palette, and the Snapshot's choice

The view build writes each palette's CSS as its own file, `chunks/shell-palette-<name>.css`, appended to the shell chunk's `styles` after the shell's own; the board page's stylesheet carries every palette (one import after `tokens.css` in its Tailwind input), since it never goes into a Snapshot. A new plain module `packages/view/src/palettes.ts` holds `paletteStylePath(name)` and `paletteOfStyle(path)`, imported by the build and by `assemble`. `SelectionTarget`'s Snapshot form gains `palette` (from `targetOf`: the record's `presentation.palette` when it is in `PALETTES`, else `carta`); `selectChunks` keeps, of the shell's styles, its own and that palette's file, so `viewPolicy`'s hashes, `sourcesToFetch` and the inlined `<style>`s agree. A board keeps every file. Palette sheets pass the build's inline-safety checks like every stylesheet (no `@import`, no `url()`).

*Alternatives.* A view-manifest chunk kind `palette` (a minor of the view manifest and a `board-host` change) was rejected: the file list already carries what is needed. Filtering rules out of one CSS text by selector was rejected: Tailwind's minifier may rewrite or merge rules.

### D5. Applying and resolving the palette

`theme.ts` gains `CONTRAST_QUERY = "(prefers-contrast: more)"`, `resolvePalette(palette, themePreference, contrastMore)` (`contrasto` when the preference is `system` and the system asks for more contrast, else `palette`), `applyPalette(root, palette)` (sets `data-palette`, removes it for `carta`; only names in `PALETTES` reach the attribute), and `followPalette(query, apply)` with `prefer(palette, themePreference)` and `current()`, as `followTheme` does. The board page follows it for its own root. The hosted view resolves it itself from its presentation (`ViewPresentation.palette` and `.theme`) and its own `matchMedia(CONTRAST_QUERY)`: both documents see the same system, and no new host message is needed. An opened Snapshot applies its record's palette and follows no contrast query. The palette row's note (`data-askboard-palette-note`, `toggles.paletteSystemContrast`) shows while `resolvePalette` differs from the preference; it is a line under the row, not the `Segmented` description, which would make the row read-only.

### D6. Controls, protocol and Snapshot presentation

- **Theme popover** (`answering-flow-visual` at 73e3305f: `ThemeControl` in the ask row opens a non-modal popover whose body is `QuickToggles`, Theme and Density; its "The ask row" and "The Snapshot view's chrome" say so): a third `Segmented`, "Palette", appended after Density in `QuickToggles`, segments from `PALETTES`, its wrapper hooked `data-askboard-palette`, read-only through `fixedBy` when the project sets it, the note (D5) under it; absent in an opened Snapshot (it carries one palette), so visual's Snapshot scenario holds as written. D11's fit file opens the popover.
- **Settings panel**: `CHOICES.palette` and `LABELS.palette`, a segmented row after "After answering".
- **View protocol**: `ViewPresentation.palette`; `isPresentation` admits it (and `locked` admits `palette`); `PRESENTATION_VALUES.palette = PALETTES`, so the view's `setting` admits `palette` with a listed value (the quick toggles write it, as theme and density). `presentationOf` reads the row, `carta` when absent. `snapshotPresentationOf` passes the record's palette through `isPresentation`, `carta` when absent or unknown.
- **Strings** (en-US and it-IT): `toggles.palette` ("Palette"), `toggles.paletteCarta`, `toggles.paletteNordico`, `toggles.paletteGrafite`, `toggles.paletteContrasto` (the names, the same in both languages), `toggles.paletteSystemContrast` ("The system asks for more contrast: Contrasto is in use." / "Il sistema chiede più contrasto: è in uso Contrasto.", Italian "(to review)").

### D7. Renderers follow the palette

`createThemeStore` watches `class` and `data-palette`; a new catalog-port hook `useColourScheme()` returns `"<palette>/<theme>"` from the same store, and the Chart re-reads its tokens on it instead of `useTheme()` (kept for components that need only light or dark). DESIGN.md's Diagram theme says a diagram renders with the tokens of the palette in effect and re-renders on `useColourScheme`, and a Snapshot's kept renders are those of its palette: the rule the Diagram epic implements.

### D8. Contrasto's marks

`packages/view/src/styles/contrast.css`, imported by `base.css` outside Tailwind's layers (so it wins over `outline-2` and `border`): under `:root[data-palette="contrasto"]`, `:focus-visible` outlines are 3 px; question cards, buttons, inputs and text areas take 1.5 px borders, selected by their existing `data-askboard-*` hooks and element names, no component edited. DESIGN.md's Named palettes states both widths.

### D9. Forced colours

`packages/view/src/styles/forced-colors.css`, imported by `base.css`, inside `@media (forced-colors: active)`: `:focus-visible` outline `2px solid Highlight` (3 px under Contrasto); borders of cards, controls, the rail and the ledger `CanvasText`; pressed and selected states (`[aria-pressed="true"]`, `[aria-checked="true"]`, `[aria-selected="true"]`, `[data-state="on"]`, `[data-state="checked"]`) a 2 px `Highlight` outline or underline; disabled `GrayText`; state stripes (`styles/state.css`) `CanvasText`, keeping their dashed, dotted and solid styles. `forced-color-adjust: none` only on the Chart's host, diff marks and the change fill. Icons drawn with `currentColor` follow with no rule.

### D10. The contrast and role report

`tools/build/contrast.ts`, pure: `contrastRatio(a, b)` (WCAG 2 relative luminance), `CONTRAST_PAIRS` (each pair of DESIGN.md's Contrast table, a "lowest of" pair as a list of backgrounds, plus B's: `success-text`/`card` (ledger counts), `primary`/`card` and `success`/`card` and `muted-foreground`/`card` (stripes), `primary`/`primary-subtle` and `success`/`success-subtle` (segment underlines), `border-strong`/`muted`, `ring`/`background`), `contrastReport(tokens)` over the eight palette and scheme combinations with the thresholds (Contrasto 7:1 and 4.5:1), and `roleReport(tokens)`: hue distance in OKLCh of `agent` to `change` at least 60°, of `agent` and `change` to `primary` at least 20° and 60°. `critical` and `recommended` are aliases, which D3 forbids a palette to set, so their rules hold by construction. `contrast.test.ts` fails only on a pair naming a missing role or a wrong ratio of a known pair; it prints every pair under its minimum and every rule not met. `bun tools/build/contrast.ts` prints the Markdown table DESIGN.md's Contrast section takes.

### D11. Carta on the board's layout

The settling measured B's pairs on the mockup; here they are checked on the build: D10's B pairs in Carta must meet their minimum (an assertion for Carta only, the rest reported), and a browser file runs `answering-flow-visual`'s fit check (no `scrollWidth` above `clientWidth` in the rail, the ledger and the header at 1280×800) in each palette and scheme, compact and comfortable, in it-IT. Screenshots of Carta on B, light and dark, compact, go to the pull request for the PO.

### D12. Records and versions

- **Versions.** Configuration, board protocol and Snapshot data, each at the next minor after main's, bound at the rebase task (askboard-contract-versioning). Guidance widens the configuration and the board protocol, visual the board protocol only; both merge first, so "main's" is read after their merges. The view manifest is unchanged (D4).
- **Delivery (PO, #227, 2026-11-16).** One implementer for the change; records land in the commit of the group they describe, the as-built note once at the end; each new browser file runs in Chromium only, as a File run of that file, with no local `test:e2e`, smoke or multi-engine run in the change (CI's smoke runs on the pull request; the three engines run later on CI's end-to-end train on `main`, and its failures go to a stabilisation change); `bun run check` once, before the pull request; one pre-PR review, spec at medium and security at high (the diff touches the contract's schemas and validators and the view's sandbox), one fix round, re-review of M and H findings only.
- **Spine and PRD.** AD-14 amended in place (the presentation keys, the board's writes and the accepted keys name `palette`); FR-35 names the palette among the presentation preferences; SOLUTION-DESIGN.md §4.4 likewise.
- **DESIGN.md**: the YAML `palettes:`; Colors (Modes and Dark theme mechanism: the attribute, the Snapshot's sheet; a section "Named palettes" with each palette's character, Grafite dark first, Contrasto's targets and widths, `prefers-contrast` and forced colours); Contrast (a table per palette from D10); Diagram theme (D7). **EXPERIENCE.md**: Board chrome (the Theme popover's palette row), Preferences and Settings, Snapshots, Accessibility Floor (high contrast, forced colours), Dark theme.

## Merge points

| With | Shared | Rule |
|---|---|---|
| `answering-flow-guidance` (change 4; `worktree-feature-answering-flow-guidance`, read at dd2c23e4) | `PRESENTATION_KEYS` and `CONFIGURATION_KEYS` with `afterAnswer` (this change appends after it), `AfterAnswer`'s pattern in `config.json`, `setting.json`'s `if/then` chain, `settings.json`'s optional row, `CHOICES` and `LABELS`' after-answer row, `styles/motion.css`; requirements this delta MODIFIES in its wording: contract "The configuration schema set", "The configuration keys and their values", "The presentation keys are a closed list", "Settings messages on the board protocol"; core "Writing a presentation key"; board-host "A board writes only presentation keys"; AD-14, FR-35 and SOLUTION-DESIGN.md §4.4, which it amends; EXPERIENCE.md Preferences and Settings | Merges first. Task 0.1 rebases after its merge and re-copies the six blocks from `openspec/specs/` if it is archived, else from its delta, re-applying only this change's edits; its configuration and board-protocol minors are main's when this change binds |
| `answering-flow-visual` (change 6; `worktree-feature-answering-flow-visual`, read at 73e3305f) | `ThemeControl` (`theme-control.tsx`) with `QuickToggles` as its popover's body ("`palettes` adds its row there", its D1); its requirements "The ask row" and "The Snapshot view's chrome" (not modified here: D6); `styles/state.css` (stripes); the ledger, the progress strip, `answering-flow-fit.browser.ts` and the harness locators `themeControl`, `askRow`, `rail`, `ledger(cell)`, `outbox`; the settings sheet placed at `open-settings`' inset; DESIGN.md's YAML components and Board chrome; EXPERIENCE.md Board chrome; its board-protocol minor; its validation Issue (its task 11.1: "task 10 with Carta only until `palettes` lands") | Merges second. Every task from group 3 on needs its layout; task 0.1 re-checks each name; if a name or shape differs, `/openspec-update-change` before group 1. Task 5.5 comments on its validation Issue |
| Diagram changes (`worktree-feature-diagram`, `-diagram-render`; parked since 2026-11-08) | Kept diagram renders per theme | No shared code; D7's rule is theirs to follow |
| `early-benchmark` | none (`packages/bench`) | none |

Borrowed from `main` (all found on `origin/main` 46d3dcf7): `PRESENTATION_KEYS`, `CONFIGURATION_KEYS`, `CONFIGURATION_DEFAULTS`, `ConfigurationValues`, `ThemePreference`, `Density`, `SnapshotPresentation`, `presentationNow`, `applyTheme`, `applyDensity`, `resolveTheme`, `followTheme`, `DARK_QUERY`, `ThemeRoot`, `SchemeQuery`, `readDesignTokens`, `tokensCss`, `themeCss`, `writeTokenFiles`, `tailwindInput`, `BASE_CSS`, `createThemeStore`, `themeOfClasses`, `useTheme`, `chartTokens`, `ViewPresentation`, `isPresentation`, `PRESENTATION_VALUES`, `presentationOf`, `snapshotPresentationOf`, `DEFAULT_PRESENTATION`, `startPresentation`, `fixedBy`, `Segmented`, `QuickToggles`, `CHOICES`, `LABELS`, `selectChunks`, `sourcesToFetch`, `targetOf`, `viewPolicy`, `SelectionTarget`, `STRING_KEYS`, `BROWSER_FILES`, `CONFIGURATION_VERSION`, `BOARD_PROTOCOL_VERSION`, `SNAPSHOT_DATA_VERSION`.

## Needs probe

None about Claude Code's run time: no mod, hook, agent or permission behaviour is assumed. Browser behaviour, checked in Chromium by task 0.2 before anything relies on it:

- **P1** Playwright 1.65's `emulateMedia({contrast: "more"})` and `({forcedColors: "active"})` reach the board's sandboxed `srcdoc` view: its `matchMedia` matches, its `change` event fires, and its CSS media queries apply.
- **P2** Under forced-colours emulation, the system colour keywords (`Highlight`, `CanvasText`, `GrayText`) resolve inside the sandboxed view, and `forced-color-adjust: none` keeps a token fill.

The forced-colours file is listed in `suites.ts` for Chromium only (the Issue's acceptance names Chromium's emulation); the other new files carry no `engines` restriction, and the end-to-end train reports any engine that differs.

## Risks / Trade-offs

- [Derived roles look wrong in a palette] → D2's rules are mechanical and D10 reports every pair; the PO sees the palettes on the build (D11 screenshots) before the merge.
- [Contrasto's 1.5 px borders shift the rail's fit] → D11's fit check runs Contrasto at 1280 px; a clipped label stops the group for the architect.
- [System contrast overrides an explicit palette] → only under the theme's System, with the note saying so; Open Questions 3.
- [Chunk growth] → three palette sheets, about 2.5 KB each, plus the two layers (about 2 KB) in the shell and the board page; the Snapshot carries at most one sheet. Task 5.4 records the sizes and stops above 12,000 B of growth per chunk.
- [Other engines untested in the change (#227)] → the forced-colours and contrast emulation may differ in Firefox and WebKit; the end-to-end train finds it, and its failures go to the stabilisation change, not back to this one.
- [Two documents resolve the palette] → one pure `resolvePalette`, unit-tested, used by both; P1 checks that the view sees the same media.

## Migration Plan

None for data: the key is optional and defaults to `carta`; Snapshot records without `palette` open in Carta; a board without the attribute renders as today. Rollback is the revert of the pull request.

## Open Questions

Defaults taken in an unattended run (2026-11-16); each is a `needs-po` question for #189, and the dependent tasks proceed on the default:

1. **The cool palette: "Nordico" or "Ardesia".** Default Nordico (report §7: drawn and measured on B). A swap is a YAML group, the enum value and its string (tasks 1.1, 2.3, 3.2).
2. **Palette names in English.** Default: the PO's Italian names in both languages, as proper names (D6). The alternative is English names in en-US ("Paper", "Nordic", "Graphite", "Contrast"): strings only.
3. **`prefers-contrast: more` over an explicit palette.** Default: under the theme's System, Contrasto replaces any chosen palette, with a note (D5). The alternative: only when the palette is Carta.
4. **Contrasto's widths.** Default: 3 px focus ring, 1.5 px borders on cards, buttons and inputs, as B's mockup draws (D8).
5. **Derived roles and chart colours.** Default: D2's rules; every palette keeps Carta's chart series.
