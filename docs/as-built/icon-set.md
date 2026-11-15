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
- The `icons` chunk is a library chunk needing `react`, with no styles; its notice carries the package's whole `LICENSE`. The shared-module test lists each icon name as "listed ahead" until the source that draws it lands.
- The Lucide rule: a specifier `lucide-react/icons/<name>` passes only in the icon module or a test; the main entry, `icons`, `dynamic*` and `dist/…` fail everywhere.

**Correction.** The Issue lists "↑/← widget moves" among the glyphs. The only ↑ and ← on `main` are key names in `catalog/keys/label.ts`, which stay text (DESIGN.md, Icons).
