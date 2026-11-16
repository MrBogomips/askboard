# Proposal

## Why

Issue: #189

The board has one palette, "Warm Paper & Petrol", in light and dark; #168 asks for "clean interfaces with different themes not only for dark and light". The PO decided the first set on 2026-11-14 (#168 decision 8, #189): "Carta" (today's palette, the default), "Nordico", "Grafite" and "Contrasto", each light and dark, with high contrast and a forced-colours layer, set by the user and by the project file. The token pipeline already separates roles from values (DESIGN.md, Colors, Swap rule), so palettes need the generator, the preference and the controls, not component changes. It serves FR-26, FR-35 and NFR-12 (accessibility best effort; PRD L27, L28).

## What Changes

- **Four named palettes**, each with every colour role and its dark twin, in a `palettes:` group of DESIGN.md's YAML: "Carta" stays on plain `:root` and `.dark`, so a board with no palette set renders as today; "Nordico", "Grafite" and "Contrasto" take the values drawn and measured on direction B's mockup, completed for the roles the mockup did not draw. The token build emits one stylesheet per palette and fails, naming the palette and the key, on a missing role, a missing dark twin, an unknown key or a redefined alias.
- **The palette preference**: a presentation key `palette` beside `theme`, `density`, `contextPlacement` and `afterAnswer`, in the user and the project file; a "Palette" row in the Theme popover and in the settings panel, applied at once to the board page and the view and written to the user file, read-only when the project sets it (AD-14, AD-8: never in browser storage).
- **High contrast**: "Contrasto" targets 7:1 for text and 4.5:1 for UI marks, with a 3 px focus ring and 1.5 px control and card borders; chosen explicitly, and applied while the theme preference is System and the system asks for more contrast (`prefers-contrast: more`).
- **Forced colours**: a `@media (forced-colors: active)` layer maps focus rings, borders, selected and disabled states to system colours; colour stays only where it carries data (Chart series, diff marks, the change highlight). Every answer state keeps its shape and text.
- **Renderers and Snapshots**: the Chart redraws on a palette switch as on a theme switch; a Snapshot records the palette and carries only that palette's stylesheet beside Carta's base.
- **Contrast and role report**: a test computes the WCAG 2 ratio of each pair of DESIGN.md's Contrast table, and of the pairs direction B's layout adds (stripes, ledger counts, segment underlines), for every palette and scheme, and the role-hue rules; it reports and never fails the build (PO, 2026-11-14). "Carta" is checked on direction B's layout in light and dark.
- **Out of scope**: an accent-only choice (research §5.2), a third density, the Timeline's own bar palette (#78), bundled fonts, palettes beyond the four, English names for the palettes (Open Questions).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contract`: the configuration's `palette` key and its values; the presentation keys and the board protocol's `setting` and `settings` admit it; the Snapshot data's `presentation` may name it ("The configuration schema set", "The configuration keys and their values", "The presentation keys are a closed list", "Settings messages on the board protocol", "The presentation in the Snapshot data").
- `core`: "Writing a presentation key" admits `palette`; "The presentation a Snapshot records" and "The presentation when the settings cannot be read" record it.
- `board-host`: "A board writes only presentation keys" admits `palette`.
- `view-and-widgets`: new requirements "Named palettes", "Palettes in the token build", "The palette preference", "High contrast follows the system", "Contrasto's marks", "Forced colours", "A palette in a Snapshot", "The contrast and role report", "Carta on the board's layout"; modified "A Chart follows the theme".

## Impact

- `packages/contract`: configuration, board protocol and Snapshot data schemas and constants, each at the next minor after main's; fixtures and tests. `packages/core`: the Snapshot's presentation; otherwise tests only (the presentation keys are read generically). `packages/server`: tests only.
- `packages/view`: `theme.ts`, the board page (start, presentation, settings panel), the shell (start, presentation, the Theme popover's body, opened Snapshot), `view-protocol.ts`, `assemble` (a Snapshot's palette stylesheet), the catalog port's theme store, `styles/` (contrast and forced-colours layers), strings, browser tests and the harness. `packages/widgets`: the Chart's theme dependency.
- `tools/build`: `tokens.ts` and its tests, the view build's stylesheets, a contrast module and its test; `packages/view/chunk-sizes.json`.
- Documents: DESIGN.md (YAML `palettes:`, Colors, Contrast, Dark theme mechanism, Diagram theme), EXPERIENCE.md (Board chrome, Preferences and Settings, Snapshots, Accessibility Floor, Dark theme), PRD FR-35, spine AD-14 amended in place, SOLUTION-DESIGN.md §4.4, the help skill if it fits its budget, `docs/as-built/palettes.md`.
- Stacks on `answering-flow-guidance` and `answering-flow-visual` (design, Merge points): implementation starts after both merge; the palette row joins visual's "Theme" popover. No new dependency. Platforms: macOS and Linux (NFR-7). New browser files run in Chromium inside the change; the three engines run later on CI's end-to-end train (PO, #227).
