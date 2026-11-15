# As built: `icon-set`

In code since `icon-set` (Issue #188): one icon set, Lucide, drawn through one module and one library chunk, with an import rule that keeps it so. No contract set is widened and no version is bound beyond the dependency pin.

**The dependency.** `lucide-react` 1.73.0, exact, in `packages/view/package.json` and the spine's Stack. Evidence on 2026-11-15: ISC in package.json (the tarball's `LICENSE` holds the ISC text, then Feather's MIT text), 25,766 stars on `lucide-icons/lucide`, pushed 2026-11-14, not archived, peers `react` `^16.5.1 || ^17 || ^18 || ^19` and `@types/react` `*`. The icons write no `style` attribute and the tarball holds no `import.meta`, `eval` or `new Function`. Dependabot ignores its minor and patch releases (`.github/dependabot.yml`): a bump is by hand, with the adoption evidence re-read and the chunk sizes recorded.

**Where the code lives.**
- `packages/view/src/icons/index.ts` (with `index.test.ts`): the icon module, exported as `@askboard/view/icons`.
- `tools/build/shared-modules.ts`: the `icons` library chunk (`ICONS_MODULE`, the `BY_PATH` entry, the names read from the module's file); `ICONS_FILE` in `tools/build/paths.ts`.
- `tools/check-imports.ts`: `view/icons` among `VIEW_ENTRIES` and the widgets' allowed units, and the Lucide rule.
- `docs/ux-askboard-2026-10-27/DESIGN.md`, Icons: the table, sizes, names and the reading rule for quoted glyphs.

**Names and seams.**
- The nine exports of the module, named for their role: `IconNextOpen`, `IconReplies`, `IconAgentChanged`, `IconExternal`, `IconSelected`, `IconClose`, `IconCalendar`, `IconDisclosure`, `IconDragHandle`. No wrapper, class or default prop.
- The `icons` chunk is a library chunk needing `react`, with no styles; its notice carries the package's whole `LICENSE`. The shared-module test exempts the icon module (`EXEMPT_MODULES`) until task 5.2's `icons/index.test.ts`, which checks that each export is imported.
- The Lucide rule: Lucide is found in lower case (`Lucide-React/…` and `LUCIDE-REACT` fail, security finding X-1). A specifier `lucide-react/icons/<name>` passes only in the icon module or a test; the main entry, `icons`, `dynamic*` and `dist/…` fail everywhere. For `lucide` (the DOM package), only a static named import of `createElement` and PascalCase icons from its main entry passes, in `packages/view/src/board-page/icons.ts` or a test; `createIcons` (which scans the DOM), `icons`, namespace, default and dynamic imports, re-exports, subpaths, `lucide-*` and `@lucide/*` fail everywhere.

**Correction.** The Issue lists "↑/← widget moves" among the glyphs. The only ↑ and ← on `main` are key names in `catalog/keys/label.ts`, which stay text (DESIGN.md, Icons).

**The view's icons.**
- `shell/board-header.tsx` draws `IconNextOpen` after the jump's text; `shell/navigators.tsx` draws the outline's reply badge (`role="img"`, named by `header.newReplies`) and agent-change flag (named by `header.agentUpdated`) with `IconReplies` and `IconAgentChanged`; the question navigator's badge keeps a decorative `IconReplies`. `catalog/context/reference.tsx` draws `IconExternal` in the hint (inside `data-context-part="external"`); `catalog/date-field/index.tsx` draws `IconCalendar` in place of its own SVG.
- Strings: `header.nextOpen` lost its arrow in en-US and it-IT; `outline.newReplies` is removed (the badge's title uses `header.newReplies`). `strings/glyphs.test.ts` guards the catalogue; it exempts `navigator.nextOpen` and `tree.adjust.example` for the arrow.
- Because the shell and the date-field and context chunks import the module, their `needs` list `icons`; `tools/build/view.test.ts` states that.
- `packages/view/test/browser/icons.browser.ts`: the jump, the outline's marks, the hint, the calendar button, the theme colours and a Snapshot offline.

**The board page's close icon (Q1, the PO chose (a)).** `lucide` 1.73.0, exact, in `packages/view/package.json` and the spine's Stack, kept equal to `lucide-react` by a test in `tools/workspace.test.ts`; Dependabot ignores its minor and patch releases. `packages/view/src/board-page/icons.ts` exports `closeIcon(document)`, built from the package's `createElement` and the `X` icon, imported by name from its main entry (tree-shaken), with constant attributes (`aria-hidden="true"`, `class="size-4"`), no SVG string and no `createIcons`. `reading-panel.ts` and `settings-panel.ts` append it in place of the ✕ text, each button keeping its `aria-label`. The board page's notices list `lucide`'s ISC licence file.
