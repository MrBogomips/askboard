# Icons and theming research for Issue #168

Version 1.0.0, 2026-11-14. Draft (Working documents: `drafts/`): it never overrides `docs/` or `openspec/`. It answers two asks of Issue #168: "Check also for a lib of icons to adopt smartly" and UI proposals "with different themes not only for dark and light", "based on the current stack and lib in use in order to minimize rework".

All library facts were checked on 2026-11-14 against the npm registry (`https://registry.npmjs.org/<package>`), the GitHub REST API (`https://api.github.com/repos/<owner>/<repo>`, its `releases/latest` and `contents/LICENSE`) and the published tarballs, unpacked and read. Anything not checked that way is marked **unverified**.

## 1. Constraints an icon package must meet

From the PRD addendum (Adoption rule), the spine (AD-19, Stack, Consistency Conventions) and the licence tooling:

| Constraint | Source | What it means for an icon package |
|---|---|---|
| Licence OSI-approved permissive | addendum, Adoption rule; `tools/check-licences.ts:45` accepts `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD` | A custom licence (Remix Icon License) is `outside` and fails `check:licences` |
| At least 1,000 GitHub stars, or a named exception | addendum | Counted on the repository that publishes the package |
| A push within 6 months, a release within 12, not archived | addendum | Phosphor React, Heroicons and Radix Icons fail the release criterion today |
| Pinned exactly | spine, Stack row "Dependencies" | `"lucide-react": "1.73.0"`, no range |
| Licence notice shipped per chunk | `tools/build/licences.ts` | The view build writes one notice per package found in a chunk's metafile, with the text of the package's own licence files; a package without a licence file needs an entry in `tools/licence-texts.json` |
| No runtime network access | NFR-9, AD-11; DESIGN.md Do/Don't "Load Google Fonts, an icon font or a CSS CDN at run time" | Icons are bundled as code; no icon font, no sprite fetched at run time |
| View CSP | `packages/view/src/assemble/index.ts:62` (`style-src` from the chunk hashes), `packages/view/src/shell/style-shim.ts` | The component must not rely on inline `style` attributes or injected `<style>`; colour must come from `currentColor` and Tailwind classes |
| Chunk budget | `packages/view/chunk-sizes.json`; the build fails over +10% | Per-icon ESM imports only; never the barrel; ideally one shared icon module so the runtime is bundled once |
| React 19.3.1 | spine, Stack | Peer range must admit React 19 |

## 2. What the view uses today

**Icons.** No icon package. The board draws its marks three ways:

- **Unicode glyphs in strings and JSX**, counted in `packages/view/src`, `packages/widgets/src` and `packages/contract/src` (tests excluded): `…` 107 (mostly wording), `→` 8, `↓` 5, `⌘` 4, `⇧` 4, `↩` 4, `⌥` 3, `✕` 2, `✓` 2, `↑` 2, `←` 2, `↻` 1, `↗` 1, `×` 1. The key glyphs (`⌘ ⇧ ⌥ ↩`) are key-help text, not icons, and should stay text.
- **Inline SVG drawn by components**: `packages/view/src/catalog/date-field/index.tsx:60` (the calendar mark), `packages/widgets/src/tree/row.tsx`, `ranking/row.tsx`, `gantt/chart.tsx`, `gantt/grid.tsx`, `timeline/chart.tsx`, `timeline/lanes.tsx`. The Gantt and Timeline SVGs are charts, not icons, and are out of scope.
- **CSS shapes** for markers (the state dots and pills).

DESIGN.md records the gap as Open point 2, "Icons (F-76). No icon set is chosen. It must be bundled under an open licence (L38). Stitch used Material Symbols. The marker shapes and the glyphs (✓ ✕ ↗ ↓ ↩) have no source yet." (`docs/ux-askboard-2026-10-27/DESIGN.md:1092`).

**Theme and tokens.**

- Source of truth: the YAML front matter of `docs/ux-askboard-2026-10-27/DESIGN.md`, group `colors:` with the light value under the plain key and the dark value under `<key>-dark` (for example `primary: '#0b6e7f'`), plus `aliases` marked `# = <target>`, `typography`, `rounded`, `spacing` (compact keys and `<key>-comfortable`).
- Generator: `tools/build/tokens.ts`. `tokensCss()` emits `:root{…light…; compact density; color-scheme:light}`, `.dark{…dark…; color-scheme:dark}` and `.comfortable{…}`; it fails the build when a colour has no `-dark` twin or an alias points nowhere. `themeCss()` emits Tailwind 4 `@theme inline{--color-*: initial; --color-<name>: var(--<name>) …}`, clearing Tailwind's default colour, text and radius namespaces so no utility bypasses a token. Fonts are the system stacks (`--font-sans`, `--font-mono`).
- Colour roles (layer 3, the only names components read): surfaces `background`, `card`, `muted`, `popover`; borders `border`, `border-strong`; text `foreground`, `foreground-secondary`, `muted-foreground`, `primary-foreground`; accent `primary`, `primary-hover`, `primary-subtle`, `primary-text`, `ring`; status `success*`, `destructive*`, `warning*`, `info*`; AskBoard roles `change*` (the user's edits, plum), `agent*` (indigo), `diff-*`, `gantt-bar`, `chart-1`…`chart-5`, `syntax-*`; aliases such as `ask-answered → success`, `recommended → agent-text`, `critical → foreground`, `input → border-strong`.
- Runtime: `packages/view/src/theme.ts`. A `.dark` class on the root (`applyTheme`), resolved from the preference `ThemePreference = "system" | "light" | "dark"` and `(prefers-color-scheme: dark)` (`followTheme`); a `.comfortable` class for `Density = "compact" | "comfortable"` (`applyDensity`). Types in `packages/contract/src/schemas/configuration/index.ts:38-39`. The board page resolves the theme and sends it to the sandboxed view; a Snapshot resolves it itself. No theme library: next-themes writes browser storage, which the sandbox forbids (DESIGN.md, Dark theme mechanism).
- User control: the quick toggles (`packages/view/src/shell/quick-toggles.tsx`, "Theme: System | Light | Dark", "Compact | Comfortable") and the same rows in the Settings panel; a value set in the project file shows read-only.
- Palettes: one shipped, "Warm Paper & Petrol" (DESIGN.md, The palette). The colour page `docs/ux-askboard-2026-10-27/mockups/color-themes-1.html` already holds five candidates: Atlassian Baseline, Monochrome Ink, Warm Paper & Petrol, Nordic Slate, Indigo Console. DESIGN.md states the swap rule: a palette re-points layer-3 roles at other primitives and leaves components unchanged.
- Accessibility today: the Contrast table in DESIGN.md (text 4.5:1, UI marks 3:1, both modes), "best effort, reported, not blocking" (L27, L28). No `prefers-contrast`, `forced-colors` or `prefers-reduced-motion` rule exists in `packages/view/src`, `packages/widgets/src` or `tools/build` (grep, 2026-11-14).

## 3. Icon libraries evaluated

| Package (npm) | Latest, date | Licence (package.json) | Repository, stars, last push, archived | Icons | Per-icon ESM | Verdict against the adoption rule |
|---|---|---|---|---|---|---|
| `lucide-react` | 1.73.0, 2026-11-14 | ISC (LICENSE also carries Feather's MIT text for ~120 derived icons) | lucide-icons/lucide, 25,756, 2026-11-14, no | 2,359 | yes: `lucide-react/icons/<kebab-name>` → `dist/esm/icons/*.mjs`; `sideEffects: false` | **Passes** |
| `@tabler/icons-react` | 3.52.0, 2026-11-14 | MIT | tabler/tabler-icons, 22,660, 2026-11-14, no | 6,546 (5,492 outline, 1,054 filled) | yes: `@tabler/icons-react/icons/<PascalName>`; `sideEffects: false` | **Passes** |
| `@phosphor-icons/react` | 2.1.10, 2025-05-22 | MIT | phosphor-icons/react, 1,796, 2026-01-06, no | 1,512 × 6 weights | yes: `@phosphor-icons/react/dist/csr/<Name>`; each icon carries all six weights | **Fails**: last release over 12 months ago |
| `@heroicons/react` | 2.2.0, 2024-11-18 | MIT | tailwindlabs/heroicons, 23,910, 2026-05-12, no | about 320 per style (**unverified** count) | yes | **Fails**: last release about 24 months ago; also too small a set (no keyboard, no drag handle in outline 24 — **unverified**) |
| `@radix-ui/react-icons` | 1.3.2, 2024-11-14 | MIT | radix-ui/icons, 2,708, 2026-04-02, no | about 330, 15 px grid (**unverified** count) | yes | **Fails**: last npm release about 24 months ago (GitHub's latest tagged release is 1.0.3, 2021-04-13) |
| `@remixicon/react` | 4.9.0, 2026-01-29 | "Remix Icon License 1.0" | Remix-Design/RemixIcon, 8,459, 2026-04-28, no | **unverified** | yes | **Fails**: not an OSI licence; `check-licences` would classify it `outside` |
| `@material-symbols/svg-400` | 0.49.0, 2026-11-12 | Apache-2.0 | marella/material-symbols, 298 (Google's google/material-design-icons: 54,298, 2026-10-23) | about 3,800 (**unverified**) | SVG files only, no React components: needs an SVG loader or a hand-made wrapper | **Fails** stars on the publishing repository unless a named exception is granted; adds a build step |
| `react-icons` | 5.7.0, 2026-06-30 | MIT (package); bundles many sets under their own licences | react-icons/react-icons (stars **unverified**) | tens of thousands | per-set entry points | **Not recommended**: mixed upstream licences inside one package; 88 MB unpacked |
| No package: a local icon module | n/a | ISC + MIT texts of the source icons, kept by hand | n/a | as many as copied | n/a | Passes, but the notices are outside the build's automatic licence pipeline (§4.3) |

Sources: `https://registry.npmjs.org/lucide-react`, `https://registry.npmjs.org/@tabler/icons-react`, `https://registry.npmjs.org/@phosphor-icons/react`, `https://registry.npmjs.org/@heroicons/react`, `https://registry.npmjs.org/@radix-ui/react-icons`, `https://registry.npmjs.org/@remixicon/react`, `https://registry.npmjs.org/@material-symbols/svg-400`, `https://registry.npmjs.org/react-icons`; `https://github.com/lucide-icons/lucide`, `https://github.com/tabler/tabler-icons`, `https://github.com/phosphor-icons/react`, `https://github.com/tailwindlabs/heroicons`, `https://github.com/radix-ui/icons`, `https://github.com/Remix-Design/RemixIcon`, `https://github.com/marella/material-symbols`, `https://github.com/google/material-design-icons`; Lucide's licence: `https://github.com/lucide-icons/lucide/blob/main/LICENSE`.

### Measured bundle cost (lucide-react 1.73.0)

Bundled with `bun build --minify --external react` from the unpacked tarball:

| Imports | Minified | gzip |
|---|---|---|
| runtime + 1 icon (`check`) | 3,306 B | 1,615 B |
| runtime + 10 icons | 6,193 B | 2,661 B |

So the shared runtime (`Icon`, `createLucideIcon`, context, helpers) costs about 3 KB minified once, and each further icon about 320 B minified. Twenty-five icons in one shared module cost about 11 KB minified, under 5 KB gzip. Tabler's runtime (`createReactComponent`, `defaultAttributes`) is smaller (no context), with a similar per-icon cost (**not measured**).

### Behaviour that matters for AskBoard

- **CSP-safe.** Neither Lucide's `Icon.mjs` nor Tabler's `createReactComponent.mjs` writes a `style` attribute or injects CSS: colour is `stroke="currentColor"` and size is `width`/`height` attributes, so Tailwind classes (`text-muted-foreground`, `size-4`) style them.
- **Accessibility default.** Lucide sets `aria-hidden="true"` unless the icon gets an accessible prop or children (`shared/src/build/buildLucideIconNode.mjs:48`, `hasA11yProp`). Tabler sets nothing; every decorative use would need `aria-hidden` by hand.
- **Style.** Both are 24×24, 2 px stroke, round caps and joins, outline style: consistent with the board's calm, low-chrome register and close enough to swap one for the other.
- **Release cadence.** Lucide published 1.68.0 to 1.73.0 between 2026-11-04 and 2026-11-14 (six releases in ten days); Tabler 3.47.0 to 3.52.0 between 2026-09-18 and 2026-11-14. With exact pins and Dependabot's weekly `bun` updates, Lucide would raise a pull request almost every week (see §4.2).

## 4. Recommendation

### 4.1 Primary: Lucide (`lucide-react`)

Reasons:

1. Meets every adoption criterion with margin: ISC (already in `PERMISSIVE`), 25.7k stars, released today, not archived, React 19 in its peer range.
2. Per-icon ESM entry points with `sideEffects: false`; measured cost about 3 KB runtime plus about 320 B per icon, minified.
3. `aria-hidden` by default for decorative icons, `currentColor` and no inline styles: fits the CSP and the token system with no adapter.
4. It is the set the shadcn/ui ecosystem uses by default, and DESIGN.md already follows shadcn's variable names; the Stitch mockups' Material Symbols concepts all have a Lucide counterpart (§4.5).
5. Every AskBoard concept in the brief maps to an existing name (checked against the 1.73.0 tarball).

**Version to pin:** `"lucide-react": "1.73.0"` (exact), in `packages/view/package.json` only; re-read the registry when the change adopts it and pin the latest release then. Add it to the spine's Stack table in the same OpenSpec change.

**Import style that keeps the chunk budget:**

- Never `import { Check } from "lucide-react"` (the barrel). Import each icon by its path: `import Check from "lucide-react/icons/check";` (the `./icons/*` export maps to `dist/esm/icons/*.mjs`).
- Put every adopted icon in one module of `view`, for example `packages/view/src/icons/index.ts`, which re-exports AskBoard-named components (`IconSubmit`, `IconPostpone`, …) built from the Lucide imports. Components and widgets import only that module.
- Register that module as a shared module (`tools/build/shared-modules.ts`, as the Markdown renderer is shared) or put it in the `shell` chunk, so the Lucide runtime is bundled once and widgets get the icons through the registry instead of each chunk bundling its own copy. Name the exported icons as a list, not `*`, so an icon used without being registered fails the build (the registry's `Names` list does exactly that).
- Record the growth with `bun run build:view --record-sizes` in the adopting change; expect about +11 KB minified on the chunk that holds the module for 25 icons.
- A test in `packages/view` that reads the icon module and fails on a `from "lucide-react"` import (barrel) anywhere in `packages/view/src` and `packages/widgets/src` keeps the rule.

**Licence obligations:** the package ships its `LICENSE` (ISC for Lucide, followed by the MIT notice of Feather, © 2013-present Cole Bemis, for the icons derived from Feather, among them `check`, `x`, `clock`, `info`, `search`, `external-link`, `chevron-*`, `alert-triangle`). The view build's notice pipeline (`tools/build/licences.ts`) picks up the package's root `LICENSE` automatically and ships it whole in the chunk notice, which covers both texts; no entry in `tools/licence-texts.json` or `tools/licence-overrides.json` is needed (the package.json says `ISC`, which matches). GitHub reports the repository licence as `NOASSERTION` because the file holds two texts; `check-licences` reads the package.json field, so this does not trip it (**to confirm** by running `check:licences` in the adopting change).

**Release cadence:** add a Dependabot rule for `lucide-react` (an `ignore` of `version-update:semver-patch`, or a monthly `groups` entry) so the near-daily releases do not raise a pull request every week; new icons are needed only when a change asks for one.

### 4.2 Fallback: Tabler (`@tabler/icons-react`)

MIT, 22.7k stars, released today, 6,546 icons (outline and filled), per-icon imports `@tabler/icons-react/icons/IconCheck` with `sideEffects: false`. Same 24 px, 2 px stroke style, so swapping costs only the icon module's imports. Drawbacks: no `aria-hidden` default (the icon module would add it), larger and busier set, and the same weekly release cadence. Pin `"@tabler/icons-react": "3.52.0"` if chosen.

### 4.3 The "no package" option

Copy the paths of the 20 to 30 icons needed from Lucide into `packages/view/src/icons/paths.ts` and render them with a ten-line component. It costs no dependency and no Dependabot churn, and saves about 2 KB of runtime. But the icons become AskBoard's own code in the eyes of the build: the licence pipeline ships notices only per package in the metafile, so the ISC and Feather MIT texts would have to be shipped by a new mechanism (a notice entry for vendored code), and nothing would check it. Each new icon is a hand copy. Worth it only if the PO wants zero new dependencies; otherwise the package with per-icon imports is the cheaper path to maintain.

### 4.4 What stays text or CSS

- Key-help glyphs (`⌘ ⇧ ⌥ ↩`) stay text in the keys panel and tooltips: they are key names, read by screen readers through the key table's words.
- The ask-state and agent-state markers stay CSS shapes coloured by tokens; an icon may be added beside them, never in place of the text label (DESIGN.md Do/Don't: never replace a label with an icon).
- `…` stays typography.

### 4.5 Mapping: AskBoard concept to Lucide icon

All names below exist in `lucide-react@1.73.0` as `dist/esm/icons/<name>.mjs` (checked 2026-11-14). The import is `lucide-react/icons/<name>`.

| AskBoard concept | Lucide icon (primary) | Alternative in Lucide | Tabler fallback |
|---|---|---|---|
| Next / previous question | `chevron-right` / `chevron-left` | `arrow-right` / `arrow-left` | `IconChevronRight` / `IconChevronLeft` |
| Send / submit (Answer) | `send-horizontal` | `send` | `IconSend` |
| Held / queued (delivery waiting) | `hourglass` | `circle-pause`, `list-ordered` | `IconHourglass`, `IconPlayerPause` |
| Delivered / check | `check` (✓ today) | `check-check` (delivered and read), `circle-check`, `mail-check` | `IconCheck`, `IconChecks`, `IconCircleCheck` |
| Postpone | `clock` | `alarm-clock`, `calendar-clock`, `clock-fading` | `IconClock`, `IconClockPause` |
| Decline | `ban` | `circle-x`, `x` | `IconBan` |
| Close / dismiss (✕ today) | `x` | | `IconX` |
| Recommended | `sparkles` | `star` | `IconSparkles`, `IconStar` |
| Snapshot | `camera` | | `IconCamera` |
| Settings | `settings` | `settings-2`, `sliders-horizontal` | `IconSettings`, `IconAdjustmentsHorizontal` |
| Theme | `sun-moon` | `palette` (palette choice), `contrast` (high contrast), `sun`, `moon` | `IconSunMoon`, `IconPalette` |
| Keyboard / keys panel | `keyboard` | `command` | `IconKeyboard` |
| Comment / follow-up | `message-square-reply` | `message-square`, `message-circle-question-mark` (ask a follow-up), `reply` | `IconMessageReply`, `IconMessageQuestion`, `IconMessage` |
| Warning | `triangle-alert` | | `IconAlertTriangle` |
| Error | `circle-alert` | `octagon-alert` | `IconAlertCircle` |
| Info | `info` | | `IconInfoCircle` |
| External link (↗ today) | `external-link` | `square-arrow-out-up-right` | `IconExternalLink` |
| Expand / collapse | `chevron-down` / `chevron-up` (disclosure) | `chevrons-up-down` (toggle all), `maximize-2` / `minimize-2` (expand a widget) | `IconChevronDown`, `IconSelector` |
| Drag handle | `grip-vertical` | | `IconGripVertical` |
| Filter | `funnel` | `list-filter` | `IconFilter` |
| Search | `search` | | `IconSearch` |
| Undo / revert (↩ as an action, not a key) | `undo-2` | `rotate-ccw` | `IconArrowBackUp` |
| Retry / reload (↻ today) | `refresh-cw` | `rotate-ccw` | (`IconRefresh`, **unverified**) |
| Copy, download (Snapshot, source) | `copy`, `download` | | (**unverified**) |
| More menu | `ellipsis` | `ellipsis-vertical` | (**unverified**) |
| Working (agent state spinner) | `loader-circle` (animate only under `prefers-reduced-motion: no-preference`) | | (**unverified**) |
| Reading panel, file reference | `panel-right`, `file-text` | | (**unverified**) |

## 5. Theming beyond dark and light

The token pipeline already separates roles from values (DESIGN.md swap rule) and switches values with root classes, so more themes need no component change: only the generator, the preference and the controls. Three mechanisms, which combine.

### 5.1 Named palettes, each with light and dark (recommended first step)

**Mechanism.** A `data-palette="<name>"` attribute on the root beside the existing `.dark` class. The generator emits, per palette, `:root[data-palette=x]{…light…}` and `:root[data-palette=x].dark{…dark…}`; the default palette stays on plain `:root` and `.dark`, so a board with no attribute is unchanged. Aliases stay emitted once, as now.

**Source of the values.** DESIGN.md's YAML gains a `palettes:` group (or one front-matter file per palette under `docs/ux-askboard-2026-10-27/palettes/`), each with the full role list and its `-dark` twins; `tokens.ts` already fails on a missing twin and would fail on a missing role per palette too. Candidates already designed on the colour page: Nordic Slate, Indigo Console, Monochrome Ink, Atlassian Baseline. Indigo Console clashes with the `agent` role (indigo) unless its accent moves; each candidate needs the role rules (DESIGN.md, Colour role rules) re-checked: agent and change hues far apart, critical never red or orange, info within the accent family.

**Rework.**

- `tools/build/tokens.ts` (`tokensCss`, `readDesignTokens`) and `tokens.test.ts`: a loop over palettes, about 40 lines.
- `packages/contract/src/schemas/configuration/index.ts`: a `Palette` preference (an enum of names) beside `ThemePreference` and `Density`, with its validator, the settings file schema and the generated skills' wording (`bun run build:skills`) if the agent can see it.
- `packages/view/src/theme.ts`: `applyPalette(root, palette)` (one `setAttribute`), and the board page passing it to the view as it passes the theme.
- `quick-toggles.tsx` and the Settings panel: a "Palette" select or segmented row; strings in every language of `packages/view/src/strings`.
- Canvas and diagram renderers (Chart, Mermaid, PlantUML) already rebuild from resolved variables on a theme switch: they must listen to the palette switch too.
- Snapshot: carries only the palette in use (two token sets, as now), so its size does not grow with the number of palettes.
- CSS size: about 60 colour declarations per scheme, roughly 2.5 KB minified per palette in the shell's CSS.

### 5.2 Accent choice only

**Mechanism.** A `data-accent="petrol|slate|green|…"` attribute that re-points only the accent family: `primary`, `primary-hover`, `primary-subtle`, `primary-text`, `primary-foreground`, `ring`, and `info*` where info follows the accent. Neutrals, status, agent, change, diff, chart and syntax stay.

**Rework.** Smaller than 5.1: about 7 roles × 2 schemes per accent in the generator, one preference, one control. The constraint is narrow: an accent must stay away from the agent's indigo, the change's plum, destructive red and success green, which leaves few hues (petrol, slate blue-grey, amber-brown, deep teal). Useful as a personal touch; it does not give a "different theme" in the sense of the Issue.

### 5.3 Contrast variants and system modes

**Mechanism.** A high-contrast palette (5.1's mechanism, values chosen for 7:1 text and 4.5:1 UI marks, with thicker focus ring and borders through `rounded`/border-width tokens), selected:

- automatically under `@media (prefers-contrast: more)` when the preference is System;
- explicitly as a palette choice ("High contrast").

Plus a `@media (forced-colors: active)` layer: borders, focus rings and selected states mapped to system colours (`CanvasText`, `Highlight`, `ButtonText`, `GrayText`), `forced-color-adjust: none` only where colour carries data (chart series, diff marks, the change highlight), and every state that today relies on colour alone (ask-state dots, the change highlight) shown also by a shape, an icon or text. Icons drawn with `currentColor` (Lucide, Tabler) follow forced colours with no work.

**Rework.** The forced-colors layer is a new CSS file beside `hover.css` and `segment.css` (about 60 lines) and a browser test with Chromium's forced-colors emulation; the high-contrast palette is one more palette under 5.1. Density already has two steps (`.comfortable`); a third is possible with the same `-<variant>` key scheme but is not asked for.

### 5.4 Guard-rails for every palette

- **Contrast as a build check.** Today the Contrast table is computed on the colour page and reported, not blocking (L27, L28). With more than one palette, hand checks will drift: add a test beside `tools/build/tokens.test.ts` that computes the WCAG 2 ratio of each pair of the Contrast table for every palette and scheme, failing below 4.5:1 for text and 3:1 for UI marks (focus ring, input border, hover outline, icons that carry meaning). Whether it fails or only reports is a PO decision, since L27 made accessibility best effort.
- **Chart palette.** The `chart-1`…`chart-5` ΔE rules (DESIGN.md Open point 7) run per palette and scheme.
- **Role rules.** Agent vs change hue distance, critical never red/orange, recommended never the accent fill: written as checks on hue angle in the same test.
- **System preferences.** `color-scheme` stays set per scheme (already in `tokensCss`); System follows `prefers-color-scheme` (already) and, with 5.3, `prefers-contrast`; any animation (the Working spinner) runs only under `prefers-reduced-motion: no-preference` (DESIGN.md Open point 1 has no motion rules yet).
- **Never colour alone.** Every state keeps its text label; icons add redundancy, never replace a label.
- **Sandbox.** The choice is stored in AskBoard's settings file through the board page, never in the view's browser storage (AD-8, the reason next-themes was set aside).

## 6. Open points for the PO

1. Adopt Lucide as the icon set (closes DESIGN.md Open point 2, F-76), with Tabler as the named fallback; or keep no package and vendor the paths (§4.3).
2. Which palettes beyond Warm Paper & Petrol to ship first, from the colour page's four other candidates, and whether a high-contrast palette is among them.
3. Whether the contrast check of §5.4 fails the build or only reports, given L27.
4. Whether the palette preference is user-level only or may also be set in the project file (as theme and density can).
