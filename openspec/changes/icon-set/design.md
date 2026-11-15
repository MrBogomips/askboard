# Design

## Context

See proposal.md for why. Today, on `origin/main` 583a0161:

- **Glyphs used as icons** (tests excluded): `header.nextOpen` "Next open ↓" and `navigator.nextOpen` "Next open →" (`packages/view/src/strings/{en-US,it-IT}.ts`), rendered by `shell/board-header.tsx:47` and `shell/navigators.tsx:192`; `` `↩ ${n}` `` (`navigators.tsx:30`, `:157`); `↻` (`navigators.tsx:35`); `↗` (`catalog/context/reference.tsx:33`); `✓` (`widgets/src/approval/widget.tsx:64`); `×` (`widgets/src/shared/annotations/card.tsx:142`); `✕` on the board page (`board-page/reading-panel.ts:180`, `board-page/settings-panel.ts:185`).
- **Hand-drawn SVG icons**: `CalendarIcon` (`catalog/date-field/index.tsx:59`), the Tree's `Chevron` and `DragHandle` (`widgets/src/tree/row.tsx:59`, `:80`), the Ranking's grip (`widgets/src/ranking/row.tsx:28`, `GRIP_DOTS`).
- **Shared code across chunks** goes through the view's shared-module registry. `LIBRARY_CHUNKS` (`tools/build/shared-modules.ts:65`) lists the library chunks. `BY_PATH` (`:40`) maps a file that components import by a relative path to its shared name. A names list makes an export missing from the list fail the build, and the port's list is read from its file by `portExports` (`:166`). The `markdown` chunk is the model: a module of `view`, exported as `@askboard/view/markdown`, provided by one library chunk to the Text and to the widgets.
- **Import rules**: `tools/check-imports.ts` transcribes AD-1. `VIEW_ENTRIES` (`:83`) lists the `view` entries that other units may import, and the widgets may import `view/catalog` and `view/markdown`.
- **Chunk budget**: `packages/view/chunk-sizes.json`. The build fails when a chunk grows more than 10% (`SIZE_MARGIN`, `tools/build/sizes.ts:8`) or has no recorded size. The shell is 223,354 bytes.
- **The board page** (`packages/view/src/board-page/`) is plain DOM. It holds no React, and it runs outside the sandboxed view.
- **React** is 19.3.1. `lucide-react` 1.73.0 declares the peers `react` `^16.5.1 || ^17 || ^18 || ^19.0.0` and `@types/react` `*`, so both are admitted.

AD IDs relied on: AD-1 (imports), AD-8 (agent content is data; icons are AskBoard's own code), AD-9 (library chunks, the manifest, assemble), AD-11 (no outbound connection), AD-19 (adoption rule, licences, exact pins). UX: DESIGN.md Open point 2, Do's and Don'ts, and the component rows that quote glyphs (Settings panel, Reading panel, Unread-reply marker, Reference); EXPERIENCE.md Accessibility Floor.

## Goals / Non-Goals

**Goals:**

- One icon source for the view and the widgets, adopted under the adoption rule, bundled once, guarded by a check.
- Every glyph and hand-drawn SVG that serves as an icon today is replaced, and its accessible name is right.
- Later changes add an icon with one line in the module.

**Non-Goals:**

- New icons on controls that show text only today. Direction B's icons (the state ladder, the outbox, the header tools) belong to `answering-flow-guidance` and `answering-flow-visual`, which use this module.
- Palettes, forced colours and high contrast (#189, `palettes`). Icons drawn in `currentColor` are ready for them.
- The state markers' CSS shapes, the Gantt's duration pin (`widgets/src/gantt/grid.tsx:196`, a filled 10 px mark sized to the grid), and every chart, timeline or diagram SVG.
- Keys. No key table, tooltip, keys panel or `askboard-help` text changes. Key names stay text (decision 7), so `keys-coverage.test.ts` is untouched.

## Decisions

### 1. Lucide through `lucide-react`, pinned exactly

The PO chose Lucide (decision 7, 2026-11-14). The adoption rule (`docs/prd-askboard-2026-10-25/addendum.md`) was re-read on 2026-11-15:

| Criterion | Evidence (npm registry and GitHub API, 2026-11-15) |
|---|---|
| Licence | `ISC` in package.json. It is in `PERMISSIVE` (`tools/check-licences.ts:45`), with no exception needed. The tarball's `LICENSE` holds the ISC text, then Feather's MIT text for the icons derived from Feather (among them `x`, `check`, `calendar`, `chevron-right`, `external-link`, `arrow-down`). GitHub reports `NOASSERTION` because the file holds two texts; `check:licences` reads the package.json field. |
| Stars | 25,766 on `lucide-icons/lucide`. |
| Activity | Release and push 2026-11-14 (`1.73.0`). Not archived. |
| Peers | React 19.3.1 and `@types/react` 19.3.0 are admitted. |

- **The pin.** `"lucide-react": "1.73.0"`, in `packages/view/package.json` only. 1.73.0 is still `latest` on 2026-11-15. Task 0.3 re-reads the registry, and if a newer release is out, the change pins that one everywhere this design says 1.73.0.
- **Notices.** The view build ships the package's root `LICENSE` whole in the `icons` chunk's notice (`tools/build/licences.ts`), so both texts go out under the package.json's `ISC`. Neither `tools/licence-texts.json` nor `tools/licence-overrides.json` gets an entry. The package metadata is not wrong, and both licences are permissive.
- **What was checked.** The tarball holds no `import.meta`, `eval` or `new Function`. `Icon.mjs` and `buildLucideIconNode.mjs` write no `style` attribute and inject no CSS. They set `stroke="currentColor"`, the size as `width` and `height` attributes, and `aria-hidden="true"` unless an `aria-*`, `role` or `title` prop or children are given (`hasA11yProp`). So the icons pass the view's CSP and take their size from the callers' classes.
- **Alternatives.** Tabler (`@tabler/icons-react` 3.52.0, MIT) is the fallback the review named, and is unused because Lucide passes. Vendoring the paths would take the licence notices out of the build's pipeline (research §4.3).

### 2. Scope: what becomes an icon

The glyph sites and the four hand-drawn SVGs of the Context become icons of the module (default D2 below). They are icons in the sense of Open point 2, and "one source" is hollow while four components draw their own. What stays is listed under Non-Goals and in decision 7.

**Source conflict, resolved.** The Issue's acceptance criteria list "↑/← widget moves". On `main` the only ↑ and ← are key names in `catalog/keys/label.ts:18-21` (and comments). The Issue itself keeps key glyphs as text, so they stay. The as-built note says so.

### 3. The icon module and its names

`packages/view/src/icons/index.ts`, exported by `packages/view/package.json` as `@askboard/view/icons`, holds only re-exports:

```ts
export { default as IconClose } from "lucide-react/icons/x";
```

- **Names.** Each export is named for its role on the board, not for its Lucide icon, so a later swap or redraw touches only the module.
- **No wrappers.** The module adds no wrapper, class or default prop. Callers pass `className` (size and colour tokens) and, for a named mark, `role` and `aria-label` (decision 6).
- **The table.** DESIGN.md's Icons section and the module's unit test hold the same table:

| Export | Lucide icon | Where | Replaces |
|---|---|---|---|
| `IconNextOpen` | `arrow-down` | header's next-open jump (`board-header.tsx`) | ↓ in `header.nextOpen` |
| `IconReplies` | `message-square-reply` | unread-reply badge, outline and question navigator | ↩ |
| `IconAgentChanged` | `refresh-cw` | agent-change flag, outline | ↻ |
| `IconExternal` | `external-link` | a reference's "opens in browser" hint | ↗ |
| `IconSelected` | `check` | the Approval's selected decision | ✓ |
| `IconClose` | `x` | the comment card's close control | × |
| `IconCalendar` | `calendar` | the date field's calendar button | `CalendarIcon` |
| `IconDisclosure` | `chevron-right` | the Tree's chevron, turned 90° when open as today | `Chevron`'s SVG |
| `IconDragHandle` | `grip-vertical` | the Tree's and the Ranking's drag handles | `DragHandle`'s SVG, `GRIP_DOTS` |

The question navigator's "Next open →" gets no icon. `answering-flow-fixes` deletes that button and `navigator.nextOpen` (#184; the PO keeps the jump in the header), so icon-set leaves both as they are, and → is not among the glyphs drawn as icons (decision 7).

Every name above exists in the 1.73.0 tarball as `dist/esm/icons/<name>.mjs` (checked 2026-11-15). Icon modules also export `__iconData`, which is internal and never used.

### 4. One library chunk, `icons`

- **The chunk.** A new `LIBRARY_CHUNKS` entry, `icons`, provides `@askboard/view/icons`. The view's components import the module by its relative path, which a new `BY_PATH` entry maps (tail `icons/index.ts`, file `ICONS_FILE` in `tools/build/paths.ts`). The widgets import it by its name.
- **Its names.** The names list is read from the module's exports without running it, as `portExports` reads the port's, so adding an icon is one line and a name missing from the list cannot happen.
- **Its needs.** The chunk needs `react` through the shared `react` chunk, since Lucide imports `forwardRef`, `createElement`, `createContext`, `useContext` and `useMemo`. The shell needs `icons` on every board and Snapshot, because the header draws one, and `assemble`'s selection follows needs (`assemble/select.ts`).
- **No styles.** The chunk is not in `STYLED_LIBRARIES`: the module sets no class, and the callers' sources carry their own utilities.
- **Size.** Measured with `bun build --minify --format iife --external react` on the nine icons of decision 3: 5,934 bytes (2,670 gzip), against 4,087 for the runtime and one icon. Group 1 records it. The shell and the component chunks grow only by their shims, within the margin. Group 5 records the final sizes once.
- **Alternative.** Putting the module in the shell, shared as the port is: one script fewer, but the shell's budget would carry every icon a later change adds. The library chunk keeps the growth on its own line of `chunk-sizes.json`, as `markdown` does.

### 5. The import rule (AD-1 amended)

- **The view entry.** `VIEW_ENTRIES` gains `icons`, and the widgets' `ALLOWED` list gains `view/icons`. The spine's AD-1 and AD-9 bullets are amended in place to match (Records), since `tools/check-imports.ts` transcribes them.
- **The Lucide rule**, in `tools/check-imports.ts` beside the AD-1 rules, so `bun run check:imports` enforces it on CI:
  - A specifier `lucide-react` or `lucide-react/…` passes only as `lucide-react/icons/<kebab-name>`, and only in `packages/view/src/icons/index.ts`, or in a test file.
  - The package's main entry, `lucide-react/icons` (an alias of the main entry in its exports map), `lucide-react/dynamic*`, `lucide-react/dynamicIconImports*` and `lucide-react/dist/…` fail everywhere.
  - With Q1 (a), `lucide` passes only in `packages/view/src/board-page/icons.ts` (decision 10).
- **Alternative.** A separate unit test scanning the sources, as the Issue suggests. Rejected because `check-imports` already parses every specifier of every package, test files included, and fails CI with the file and the rule. Its tests show the failure the Issue asks for.

### 6. Accessible names

Three cases, each a scenario of the requirement "Accessible names of icons":

1. **Decorative**: an icon beside text that says what it means (both jumps, the hint, the selected decision, the calendar button whose name is unchanged, the chevron, both grips inside their named `role="img"` handles). Lucide's default `aria-hidden="true"` applies, and nothing is passed.
2. **A mark that is only an icon, or an icon and a count**: the outline's reply badge and agent-change flag. The badge `span` takes `role="img"` and `aria-label` from the existing strings: `header.newReplies` (plural-aware in both languages, "1 new reply") for the badge, `header.agentUpdated` for the flag. Its children are then presentational. The `title` stays for pointer users. The `outline.newReplies` title, whose en-US value is not plural-aware, gives way to `header.newReplies` in the badge's `title` too. In the question navigator the entry button carries its own `aria-label` (`navigator.entry`), so the badges there stay decorative.
3. **An icon-only control**: the comment card's close (`aria-label` "Close", kept) and the board page's two close buttons (their `aria-label`s, kept). The icon is hidden.

### 7. Strings, quoted glyphs and what stays text

- **Strings.** `header.nextOpen` loses its glyph in en-US and it-IT ("Next open", "Prossima aperta"), and the header draws the icon after the text. `navigator.nextOpen` ("Next open →") is not edited (decision 3).
- **A guard.** A unit test over the string catalogue fails on ↓ ↩ ↻ ↗ ✓ ✕ × in any value, and on → outside `tree.adjust.example` ("{from} → {to}", where the arrow is a word of a sentence) and `navigator.nextOpen`. `navigator.nextOpen` is exempt only while it exists, and task 6.1 drops the exemption once `answering-flow-fixes` has deleted it. The `key.*` values are exempt, since they are key names.
- **Quoted glyphs.** The specs and EXPERIENCE.md quote labels with their glyph ("Next open ↓", "opens in browser ↗", "the ✕"). Rather than rewrite those lines, several of which `answering-flow-fixes` amends (EXP 235, 241; the spec's "Counts and the next-open jump"), DESIGN.md's Icons section states the reading rule and the new requirement "Icons beside their labels" states it for the specs. EXPERIENCE.md is not edited.
- **What stays text.** Key names (⌃ ⌥ ⇧ ⌘ ↩ ⌫ ⌦ ↑ ↓ ← →) in caps, tooltips, the keys panel and `skills/askboard-help/`, which stays unchanged (`check:skills`). `…` stays typography.

### 8. Size, stroke and colour

- **Colour**: `currentColor` only. An icon takes the text colour of its element and so follows the theme, and later palettes and forced colours (#189). No icon gets a fill or a colour class of its own unless its text has one.
- **Size**: the caller's size utility, never the `size` prop.
  - 16 px (`size-4`) beside control text: the two jumps and the selected decision.
  - 12 px (`size-3`) in badges, hints and widget rows: the reply badge, the agent-change flag, the external hint, the chevron and the grips, as today.
  - 14 px (`size-3.5`) for the calendar, as today.
- **Stroke**: Lucide's 2 on its 24 grid, never set per icon.
- **Placement**: an icon sits before the text for a state (the selected decision) and after it for a direction (the jumps, the external hint), as the glyphs did.

### 9. Dependabot

Lucide released 1.63.0 to 1.73.0 between 2026-10-28 and 2026-11-14, every one a minor. The bun `ignore` list of `.github/dependabot.yml` gains `lucide-react` (and `lucide`) with `update-types: ["version-update:semver-minor", "version-update:semver-patch"]`. The Issue's "ignore patch releases" would suppress none of them.

- **Why.** Without the rule, Lucide would ride in the weekly `bun-dev` group, so a redrawn icon would ship inside an unrelated bump without review. A change that needs a new icon bumps Lucide by hand, re-reads the adoption evidence, looks at the icons and records the sizes. A major still gets its own pull request.
- **Risk.** The ignore also holds back security updates for Lucide (Risks).

### 10. The board page's close controls (Q1, proposed default (a))

`lucide-react` needs React, which the board page does not load. With the default, `lucide` 1.73.0 (Lucide's DOM package: same repository, licence and release; `sideEffects: false`, no dependencies) is pinned in `packages/view/package.json`, beside `lucide-react`.

- **The module.** `packages/view/src/board-page/icons.ts` exports `closeIcon(document)`, built with the package's documented `createElement(X, { "aria-hidden": "true", class: … })`. It is imported from the main entry, which tree-shakes to 1,135 bytes for `createElement` and `X` (measured on 1.73.0). `reading-panel.ts` and `settings-panel.ts` append it in place of the ✕ text.
- **Guards.**
  - `tools/workspace.test.ts` fails when the two pins differ.
  - A test of the built board page finds `x`'s path data and no other icon's (`check`'s).
  - The board-page chunk's 10% margin, about 100 KB, would also catch the whole set, 509,795 bytes measured.
- **With (b).** Task 0.1 removes the requirement "The board page's close icon", decision 10 and group 4 through `/opsx:update`, and files the follow-up Issue.

### 11. Records and versions

- **The spine**, in group 1, plus group 4's `lucide` row:
  - The Stack row `lucide-react` (the icon set: the view's icon module, each icon by its path) at 1.73.0.
  - AD-1: "`widgets` imports only `contract`, `compute`, `view`'s `CatalogRenderer` port, `view`'s Markdown renderer and `view`'s icon module, each provided at run time by one chunk (AD-9)".
  - AD-9, Build and assembly: the widget import sentence names the icon module, which the `icons` library chunk provides to the shell and to every chunk that draws an icon. Icons are Lucide's, each imported by its path in the icon module and nowhere else.
  - The Structural Seed's `view/` line adds "icon module".
  - The Tests row's CI failures add "an import of `lucide-react` other than an icon by its path in the icon module".
  - The front matter's `updated` and one `sources` line.
- **DESIGN.md**, in group 1:
  - A new `## Icons` section between Shapes and Components: the set, the source, the table of decision 3 plus the board page's close icon, sizes, stroke and colour, the three naming cases, the reading rule for quoted glyphs, what stays text, and how to add an icon.
  - Open point 2 marked settled by `icon-set`, in the form of Open point 7.
  - One Do's and Don'ts row.
- **`docs/as-built/icon-set.md`**: written in group 1, completed in group 5.
- **Versions.** No contract schema set changes (chunk names are not in `contract`; the manifest schema is unchanged). The product version is unchanged. Bound: `lucide-react` 1.73.0 (and `lucide` 1.73.0 with Q1 (a)).

## Defaults taken (PO may veto on #188)

- **D1** A library chunk `icons`, not the shell (decision 4).
- **D2** The four hand-drawn SVG icons come from the module too; the Gantt's duration pin and chart SVGs stay (decision 2).
- **D3** Dependabot ignores Lucide's minor and patch releases, not only patch (decision 9).
- **D4** The icon for each role (decision 3's table), from the research's §4.5 mapping. `message-square-reply` for ↩ and `refresh-cw` for ↻ are the two whose look differs most from the glyph.
- **D5** The Lucide rule lives in `check-imports`, not in a separate test (decision 5).

## Merge points

`openspec list` on 2026-11-15 shows only `early-benchmark` (`packages/bench` only, so no overlap). In flight beside it, with no artifacts on a branch yet: `answering-flow-fixes` (worktree `feature-answering-flow-fixes`, Issues #179 to #185, report §8.1 P0-1 to P0-7). Its touch points come from its architect's message of 2026-11-15, and that design records the same rules (its commits 5d188638 and 7a2af755).

| File | icon-set | answering-flow-fixes | Rule at the rebase |
|---|---|---|---|
| `packages/view/src/shell/navigators.tsx` | the `Badges` component (↩, ↻) and the question navigator's entry badge (:157) | deletes the question navigator's "Next open →" button (#184); outline `aria-current` (#181) | icon-set leaves that button and `navigator.nextOpen` untouched (decision 3). Merge line by line, keeping both sides: the entry badge sits in the same component as the deleted button. |
| `packages/view/src/shell/board-header.tsx` | the jump's icon | jump wiring (#180, #181); `header.nextOpen` kept as it is | Keep both; the icon follows the label wherever the button goes. |
| `packages/view/src/strings/{en-US,it-IT}.ts`, `keys.ts` | `header.nextOpen` loses its ↓; a guard test over the catalogue | deletes `navigator.nextOpen`; adds `status.*` and `bar.submittedHelp` | Merge line by line, then re-run the catalogue tests. Whoever lands second drops the exemption: icon-set's task 6.1 if `answering-flow-fixes` landed first, otherwise its own task 5.3 (its commit 7a2af755). |
| Browser tests: `lifecycle-header`, `languages`, `shown-revision-draft-session`, `lifecycle-acts`, `harness/suites.ts` | "Next open ↓" named "Next open"; a new `icons.browser.ts` | focus, jump and status tests, matching the jump by `/^Next open/` and `/^Prossima aperta/`; `lifecycle-presentations.browser.ts:136-152` rewritten onto the header's jump | Its tests match either name, so no rename is needed. At the rebase, keep its `lifecycle-presentations` rewrite as it is, since icon-set no longer edits that file. A test either side adds later that names the jump exactly uses "Next open" without ↓. |
| `packages/view/chunk-sizes.json` | `icons` added; shell and components | shell re-recorded (+3 to 6 KB expected) | Never merge the numbers: rebuild and `--record-sizes` after the rebase (task 6.1). |
| `docs/ux-askboard-2026-10-27/DESIGN.md` | new Icons section, Open point 2, one Do's row | rows Context header, Next-open jump, Question navigator, Bottom action bar, Answer | Different hunks; keep both. |
| `docs/ux-askboard-2026-10-27/EXPERIENCE.md` | not edited | Accessibility Floor, Board chrome, Presentations, Voice and Tone rows | None. |
| `openspec/specs/view-and-widgets/spec.md` (deltas) | ADDED requirements only | MODIFIED "Counts and the next-open jump" (the jump named "Next open", with no arrow), "One question per view", "Outline navigator", others | No shared requirement, so both sync. The ADDED requirement "Icons beside their labels" does not draw → as an icon, so the navigator's "Next open →" holds until it is deleted. |

The other files `answering-flow-fixes` touches (`question-actions.tsx`, `bottom-bar.tsx`, `agent-pill.tsx`, `board.tsx`, `question-card.tsx`) are not touched here.

Later consumers, not yet changes: `answering-flow-guidance`, `answering-flow-visual`, `board-keys` and `palettes` (#189). Each adds its icons as lines of the module and records the `icons` chunk's size.

**Borrowed names**, all on `origin/main` 583a0161:

- `tools/build/shared-modules.ts`: `LIBRARY_CHUNKS` :65, `BY_PATH` :40, `sharedModules` :154, `portExports` :166, `sharedModulesPlugin` :225.
- `tools/build/chunks.ts`: `STYLED_LIBRARIES` :40.
- `tools/build/sizes.ts`: `SIZE_MARGIN` :8.
- `tools/build/paths.ts`: `MARKDOWN_FILE` :26 (the pattern for `ICONS_FILE`).
- `tools/check-imports.ts`: `VIEW_ENTRIES` :83.
- `packages/view/test/browser/harness/suites.ts`: `BROWSER_FILES` :32.
- The strings `header.nextOpen`, `navigator.nextOpen` (only exempted by the guard, never edited), `header.agentUpdated`, `header.newReplies`, `annotations.close`, `settings.close`.
- The components `CalendarIcon` (`catalog/date-field/index.tsx:59`), `Chevron` and `DragHandle` (`widgets/src/tree/row.tsx:59`, `:80`), `GRIP_DOTS` (`widgets/src/ranking/row.tsx:28`).

Task 0.2 re-checks them, and task 6.1 checks them again after the rebase. No seam is borrowed from an unmerged change.

## Needs probe

None about Claude Code's run time: the change touches no mod, hook, agent or permission behaviour. Library behaviour, checked by tasks rather than assumed:

- **P1** Inside the view build, the `icons` chunk bundles only the module's icons and takes React from the `react` chunk. The shared-module plugin once made Bun ignore `sideEffects` (comment in `shared-modules.ts`). Task 1.4's build test checks the manifest's needs, and that `tree`'s and `ranking`'s outputs hold no Lucide code.
- **P2** TypeScript 7 under `moduleResolution: bundler` resolves `lucide-react/icons/<name>` to `dist/lucide-icon.d.mts`. Task 1.2's typecheck.
- **P3** Lucide's `aria-hidden` default and its dropping when `aria-label` and `role` are passed. Task 1.2's unit test renders both.

## Risks / Trade-offs

- **[A Lucide release redraws or renames an icon]** → Exact pin and deliberate bumps (decision 9). The module's unit test fails on a missing path, and a bump is reviewed by eye.
- **[Dependabot's ignore also holds back a Lucide security update]** → The package is static drawing code with no network, input parsing or `eval`. The by-hand bump is the path, and the security reviewer of group 1 confirms the exposure.
- **[The ISC notice understates the MIT part]** → The notice ships the whole `LICENSE`, both texts. Group 1's security review checks the built notice.
- **[The Tree's chevron or the grips look different]** (stroke 2 on a 24 grid at 12 px is 1 px, against 1.5 and 2 px today) → The Tree and Ranking drag and expand scenarios run unchanged in Chromium and WebKit (group 3), and DESIGN.md records the new look.
- **[Tests that read names break]** → Group 2 updates every test that names a glyph (listed in task 2.1), and the merge-point rule covers tests the other change adds.
- **[Snapshot size]** → It grows by the `icons` chunk, about 6 KB, once per Snapshot.

## Migration Plan

Merging is enough. A board opened after the merge draws the icons, and saved Snapshots keep their own chunks. Rollback: revert the merge commit, which also removes the pins and the `icons` size record.

## Open Questions

- **Q1 (PO, on #188, `needs-po`)**: how does the board page, plain DOM without React, draw its two ✕ close controls (reading panel, settings panel)?
  - Options:
    - (a) Adopt `lucide`, Lucide's DOM package from the same repository, licence (ISC) and release, pinned to the same version as `lucide-react`, with a test that keeps the two pins equal. It adds 1,135 bytes to the board-page chunk and a Stack row (decision 10).
    - (b) Keep the ✕ text in both buttons, whose names already come from `aria-label`. File a follow-up Issue; the Issue's acceptance criterion for ✕ is then met inside the view only.
  - Proposed default: (a). The same icon set everywhere the user looks, the same adoption evidence (one repository, one release train), about 1 KB, and no hand-copied paths outside the licence pipeline. (b) leaves a platform-font glyph beside Lucide icons in the same window.
  - Only group 4 and the requirement "The board page's close icon" depend on it. Task 0.1 records the answer before group 4 starts.
  - Posted on #188 on 2026-11-15 (comment 6893675552), with D1 to D5 for information; `needs-po` added.
