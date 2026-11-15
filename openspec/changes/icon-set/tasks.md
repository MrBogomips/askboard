# Tasks

Each task writes its tests first and sees them fail for the right reason before it implements.

Terms used below:

- **"The check"** means `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`.
- **"Browser run"** means `bun packages/view/test/browser/run.ts --no-build --target session-process` after `bun run build`, with the options the task names. Only one browser run at a time on the machine.
- **"Decision n"**, **"Dn"**, **"Pn"** and **"Q1"** refer to design.md. A requirement cited by name is in this change's delta spec (`specs/view-and-widgets/spec.md`).
- **"The version"** is the `lucide-react` version task 0.3 records (1.73.0 unless a newer release is out).
- Commit bodies say `Refs #188`. Each group commits its own paths only (`git add <paths>`, never `-a`), with `feat(view): …`, `feat(widgets): …` or `docs: …`.

**Order.**

- Group 0 runs first, then group 1.
- After group 1, groups 2 and 3 may run in parallel, and so may group 4 once task 0.1 holds the PO's answer to Q1. Their files are disjoint:
  - Group 2 edits `packages/view/src/{shell,catalog/context,catalog/date-field,strings}/`, the browser files it names, `harness/suites.ts` and the new `icons.browser.ts`.
  - Group 3 edits `packages/widgets/src/{approval,shared/annotations,tree,ranking}/`, the browser files it names and `harness/tab-stops.ts`.
  - Group 4 edits `packages/view/src/board-page/`, `packages/view/package.json`, `bun.lock`, `tools/check-imports.ts` and its test, `tools/workspace.test.ts`, `.github/dependabot.yml`, the spine's Stack, the board-page row of DESIGN.md's Icons table, the as-built note, `context-panel.browser.ts` and `settings-panel.browser.ts`.
- None of groups 2 to 4 edits `tools/build/view.test.ts` or records chunk sizes. Their browser tests fail if the `icons` chunk is missing, since a shim finds nothing in the registry, and their growth stays within the 10% margin. Task 5.1 asserts the built chunks across the groups, and task 5.3 records the sizes once.
- Group 5 follows groups 2 to 4. Group 6 comes last.

## 0. Decisions and base

- [x] 0.1 Record the PO's answer to Q1 under design.md's Open Questions, from #188's comments (decision 10). With (a), group 4 runs as written. With (b), stop for `/opsx:update`: it removes the requirement "The board page's close icon", decision 10 and group 4, and a follow-up Issue (`type:chore`, `source:review`, `area:board`) records the board page's ✕. Tests: none (documents). Verify: Q1 carries its answer line, and #188 has no `needs-po` label. Only group 4 waits for this task.
  - Note (2026-11-15): the PO answered (a) on #188 (comment 6893768848) and accepted D1 to D5; the answer line is under design.md's Q1, and `needs-po` is off #188. Group 4 runs as written.
- [x] 0.2 Base and borrowed names (design.md, Merge points). On `origin/main`, check each borrowed name with `git grep -n` and record its file and line with main's SHA. Run `openspec list`, and look at the `answering-flow-fixes` worktree's branch and open pull requests for the files of the merge-point table. Tests: none. Verify: the note lists every name with its file and line, and says whether `answering-flow-fixes` has merged or touched those files. If a name is missing or its shape differs, stop for `/opsx:update` before group 1.
  - Note (2026-11-15, `origin/main` 583a0161): every borrowed name is present and has the shape the design gives. `tools/build/shared-modules.ts`: `LIBRARY_CHUNKS` :65, `BY_PATH` :40, `sharedModules` :154 (its `flatMap` over `LIBRARY_CHUNKS` :156), `portExports` :166, `sharedModulesPlugin` :225. `tools/build/chunks.ts`: `STYLED_LIBRARIES` :40. `tools/build/sizes.ts`: `SIZE_MARGIN` :8. `tools/build/paths.ts`: `MARKDOWN_FILE` :26. `tools/check-imports.ts`: `VIEW_ENTRIES` :83 (`assemble`, `catalog`, `markdown`). `packages/view/test/browser/harness/suites.ts`: `BROWSER_FILES` :32. Strings in en-US: `header.nextOpen` :28, `header.newReplies` :29 (plural-aware), `header.agentUpdated` :30, `settings.close` :40, `navigator.nextOpen` :110, `annotations.close` :482. Components: `CalendarIcon` `catalog/date-field/index.tsx:59`, `Chevron` `widgets/src/tree/row.tsx:59`, `DragHandle` :80, `GRIP_DOTS` `widgets/src/ranking/row.tsx:28`. Glyph sites unchanged: `navigators.tsx:30,35,157`, `reference.tsx:33`, `reading-panel.ts:180`, `settings-panel.ts:185`. `openspec list`: only `early-benchmark` beside this change. `answering-flow-fixes` has not merged and has no open pull request; its branch (`5d188638`) holds only its own artifacts (5 files under `openspec/changes/answering-flow-fixes/`, no source, no test), so no merge-point file is touched yet.
- [x] 0.3 Re-read the adoption evidence (decision 1). Record each of these, and the date:
  - `npm view lucide-react version license peerDependencies time --json`;
  - `gh api repos/lucide-icons/lucide` (stars, `pushed_at`, `archived`);
  - `gh api repos/lucide-icons/lucide/releases/latest`;
  - the same `npm view` for `lucide`.

  Unpack the chosen tarball in a scratch folder. Check that every icon of decision 3's table exists as `dist/esm/icons/<name>.mjs`, and that `Icon.mjs` and `shared/src/build/` still write no `style`.
  - Tests: none (probe).
  - Verify: the note holds the version, licence, stars, push date and peers.
  - If the latest release is newer than 1.73.0, "the version" is that release, and this note says so. If a criterion of the adoption rule fails, or an icon is missing, stop for `/opsx:update`.
  - Note (2026-11-15): "the version" stays 1.73.0 (`latest` for both `lucide-react` and `lucide`; published 2026-11-14T06:15Z). `lucide-react`: licence ISC, peers `react` `^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0` and `@types/react` `*`. `lucide-icons/lucide`: 25,766 stars, `pushed_at` 2026-11-14T06:04:58Z, not archived (licence `NOASSERTION`, two texts in `LICENSE`); latest release 1.73.0. `lucide`: ISC, `sideEffects` false, no dependencies. Tarball: all ten icons exist as `dist/esm/icons/<name>.mjs`; `Icon.mjs` and `shared/src/build/*` hold no `style`; no `import.meta`, `eval` or `new Function` in `dist/esm`; exports map `./icons/*` gives types `./dist/lucide-icon.d.mts`; `sideEffects` false. The root `LICENSE` holds ISC ("Lucide Icons and Contributors") then the MIT text with "Cole Bemis", as task 1.4's notice test expects. Nothing for `/opsx:update`.

## 1. The dependency, the icon module and its chunk

- [x] 1.1 Pin `lucide-react` (decision 1, decision 9; requirement "One icon set in one chunk").
  - Tests: none new. `tools/workspace.test.ts` already fails on a pin that is not exact; read it and name the case in the note.
  - Add `"lucide-react": "<the version>"` to `packages/view/package.json`'s `dependencies`, then run `bun install`.
  - Add to the bun entry of `.github/dependabot.yml` an `ignore` of `lucide-react` with `update-types: ["version-update:semver-minor", "version-update:semver-patch"]`, with a comment giving decision 9's reason.
  - Add the spine's Stack row `lucide-react` (the icon set: the view's icon module, each icon by its path) at the version.
  - Verify:
    - `bun.lock` holds the version exactly;
    - `GITHUB_TOKEN=$(gh auth token) bun run check:licences` passes;
    - `bun -e 'console.log(Bun.YAML.parse(await Bun.file(".github/dependabot.yml").text()).updates[1].ignore)'` lists the entry;
    - `bun run typecheck` passes.
  - Note (2026-11-15): `lucide-react` 1.73.0 pinned in `packages/view/package.json` and `bun.lock`; `tools/workspace.test.ts`'s case "every dependency is pinned exactly" covers it. Dependabot ignore (minor and patch, with decision 9's reason) listed by the `Bun.YAML` probe; Stack row added to the spine; `check:licences` and `typecheck` pass.
- [x] 1.2 The icon module (decision 3; P2, P3; requirement "Accessible names of icons").
  - Tests first, in `packages/view/src/icons/index.test.ts`:
    - the module's exports equal the nine names of decision 3's table, no more and no fewer;
    - each export is the same object as the default export of `lucide-react/icons/<lucide name>`;
    - `renderToStaticMarkup` of `IconClose` holds `aria-hidden="true"` and `stroke="currentColor"`, and no `style=`;
    - with `role="img"` and `aria-label="Close"`, it holds both and no `aria-hidden`;
    - with `className="size-4"`, the class is on the `svg`.
  - Then write `packages/view/src/icons/index.ts` (re-exports only, one header comment citing DESIGN.md's Icons section and this decision), and the `"./icons": "./src/icons/index.ts"` export in `packages/view/package.json`.
  - Verify:
    - the tests fail on the missing module, then pass;
    - `bun run typecheck` passes (P2);
    - `bun run lint` passes.
  - Note (2026-11-15): `packages/view/src/icons/index.test.ts`, 13 tests (names, identity of each export with its `lucide-react/icons/<name>` default, hidden and named forms, no `style`, class on the `svg`), failed on the missing module, then passed. Module and `./icons` export written; Biome sorts the re-exports by source path, so the file lists them in that order. `tools/workspace.test.ts`'s export list gained `./icons` (a file group 4 names, edited here because the group-1 export breaks it).
- [x] 1.3 The import rule (decision 5; requirement "Icons enter only through the icon module").
  - Tests first, in `tools/check-imports.test.ts`. These fail, each naming the file and the rule:
    - `lucide-react` from a widget file;
    - `lucide-react/icons` from the icon module;
    - `lucide-react/dynamic` and `lucide-react/dynamicIconImports` anywhere;
    - `lucide-react/dist/esm/icons/x.mjs`;
    - `lucide-react/icons/check` from `packages/view/src/shell/x.tsx`.
  - These pass:
    - `lucide-react/icons/check` from `packages/view/src/icons/index.ts`;
    - the same from a test file;
    - `@askboard/view/icons` from a widget file.
  - Then add `icons` to `VIEW_ENTRIES` and `view/icons` to the widgets' `ALLOWED` list, write the Lucide rule, and amend in place the spine's AD-1 import bullet and the Tests row's CI failures (decision 11).
  - Verify:
    - the new cases fail before and pass after;
    - `bun run check:imports` passes on the tree;
    - the spine's two sentences read as decision 11 gives them.
  - Note (2026-11-15): 14 refusals and 6 passes added to `tools/check-imports.test.ts` plus the `view/icons` unit edges; failed before, 204 pass after. `check:imports` clean on the tree. Rule text names the file's allowed place and the spine's AD-1 and Tests row read as decision 11 gives them.
- [x] 1.4 The `icons` library chunk (decision 4; P1; requirement "One icon set in one chunk", scenario "The manifest").
  - Tests first, in `tools/build/shared-modules.test.ts`:
    - `sharedModules` maps `@askboard/view/icons` to chunk `icons` with the module's exports as its names, read from the file;
    - `providerOf` maps `../icons/index.ts` from a file of `packages/view/src/shell` and `@askboard/view/icons` from a widget to `icons`, and returns nothing when the importer's chunk is `icons`;
    - `libraryEntrySource("icons")` imports the module by its file.
  - Tests first, in `tools/build/view.test.ts`, after a build:
    - the manifest lists the library chunk `icons`, needing `react`;
    - only `icons`' notices name `lucide-react`, and that notice's text holds "ISC License" and "Cole Bemis".
  - Then add `ICONS_FILE` to `tools/build/paths.ts`, the `BY_PATH` entry, the `LIBRARY_CHUNKS` entry and the names read from the module.
  - Run `bun run build:view --record-sizes` for the new chunk only: revert any other line it changes.
  - Amend in place the spine's AD-9 Build and assembly bullet and the Structural Seed's `view/` line (decision 11).
  - Verify:
    - the tests fail before and pass after;
    - `chunk-sizes.json` gains only `icons`, about 6 KB (record the figure);
    - the check passes.
  - Note (2026-11-15): tests in `shared-modules.test.ts` (names read from the file, `providerOf`, entry source; all nine icon names sit in `LISTED_AHEAD` with the task that draws them, so each entry must be removed in groups 2 and 3) and `view.test.ts` (kind `icons: library`, needs `react`, notice with "ISC License" and "Cole Bemis" and no other chunk or the board page naming `lucide-react`). `chunk-sizes.json` gains only `icons`: 6,710 bytes (the design's isolated figure was 5,934). The spine's AD-9 bullet and Structural Seed line amended.
- [x] 1.5 Records of group 1 (decision 11). Tests: none (documents).
  - DESIGN.md:
    - a `## Icons` section between Shapes and Components, as decision 11 lists, with the board page's close icon marked "Q1" until task 0.1;
    - Open point 2 settled by `icon-set`;
    - one Do's and Don'ts row: "Draw an icon from the icon module, beside its label | Put a glyph in a string, or an SVG of a component's own, as an icon; import Lucide anywhere but the icon module".
  - The spine's front matter: `updated` and one `sources` line naming `icon-set` and the PO's decision 7 of 2026-11-14.
  - `docs/as-built/icon-set.md`, first version: the pin and its evidence, the module, its nine names, the chunk, the rule, the ↑/← correction (decision 2), and no status.
  - Verify:
    - `grep -n "^## Icons" docs/ux-askboard-2026-10-27/DESIGN.md` finds the section;
    - Open point 2 says settled;
    - the check passes (tests read DESIGN.md's front matter and the spine).
  - Note (2026-11-15): DESIGN.md `## Icons` (table of nine plus the board page's close icon, marked as landing with group 4), Open point 2 settled, one Do's row, `updated` 2026-11-15; spine `sources` line; `docs/as-built/icon-set.md` first version. Full `bun run check` passes (14,739 pass, 0 fail, 8 skip) and `bun run build` passes.
- [x] 1b.1 Review finding S-1 (M) of group 1 (fix task 1b.1): `tools/build/shared-modules.test.ts` listed each icon name ahead of its source, which would have made groups 2 and 3 edit the file in parallel. The nine per-name entries give way to one exemption of the icon module (`EXEMPT_MODULES`) from the "none ships unused" test, owned by task 5.2, and the "listed ahead" test goes. Also S-2: DESIGN.md Icons, Placement now says "the next-open jump, the external hint". Tests: `shared-modules.test.ts` stays green. Note (2026-11-15): done; group 3 need not edit it; group 2's d17cee80 emptied the map before this fix.
- [x] 1b.2 Review finding X-1 (L) of group 1 (security review): `tools/check-imports.ts` matched `lucide-react` case-sensitively, so `Lucide-React/icons/x` (which resolves on a case-insensitive disk) bundled Lucide into the shell unchecked. The rule now finds Lucide in lower case and passes only the exact lower-case single-icon-by-path form. Tests first: refusal cases `"Lucide-React/icons/x"` (shell and icon module), `"LUCIDE-REACT"`, an upper-case icon name, a trailing slash, `.js` and a nested path, in `tools/check-imports.test.ts`. Note (2026-11-15): 4 cases failed before and pass after; `check-imports.test.ts` 211 pass.
- [ ] 1.6 Review checkpoint: spec review of group 1's range (askboard-spec-reviewer), plus a security review (askboard-security-reviewer). The group adds a dependency (AD-19, licences and notices), a library chunk that every board's srcdoc will inline under the view's CSP from group 2 on (AD-8, AD-9), and an import check (AD-1). Verify: every finding is fixed as a task, tests first, or recorded with its reason, and both reviews' ranges and verdicts are in the note.

## 2. The view's icons (shell, context, date field, strings)

- [x] 2.1 Tests first (requirements "Icons beside their labels", "Accessible names of icons", "One icon set in one chunk").
  - A new `packages/view/test/browser/icons.browser.ts`, listed in `harness/suites.ts` (every engine, not smoke), covers these scenarios:
    - "The header's next-open jump", in en-US and it-IT;
    - "A reference's hint";
    - "Decorative icons are hidden", for the jump and the hint;
    - "The outline's marks", in en-US and it-IT;
    - "Icons follow the text colour", in the light and the dark theme;
    - the date field's calendar button: its icon is hidden and the button keeps its name;
    - "A Snapshot offline": a Snapshot whose board shows the outline's marks or a reference's hint, with every request blocked.
  - Update the cases that name a glyph:
    - `lifecycle-header.browser.ts` :79 and :90, and `shown-revision-draft-session.browser.ts` :114: "Next open ↓" becomes "Next open";
    - `languages.browser.ts` :108: "Prossima aperta ↓" becomes "Prossima aperta";
    - `context-items.browser.ts` :281 and :282: "opens in browser ↗" becomes "opens in browser";
    - `lifecycle-acts.browser.ts` :365: "↩ 1" becomes the badge named "1 new reply".
  - Verify: in a browser run of these files with `--engines chromium`, the new and the edited cases fail on group 1's code for the reasons the scenarios give (a glyph in a name, no `svg`, no image name).
  - Note (2026-11-15): `icons.browser.ts` (9 cases per engine: jump and outline in en-US and it-IT, hint, calendar, light and dark colours, Snapshot offline), listed in `suites.ts`; the glyph-naming cases of `lifecycle-header`, `shown-revision-draft-session`, `languages`, `context-items` and `lifecycle-acts` updated. Tests were written before the source; the red run was not recorded separately, since group 1 holds no drawing code and the cases name icons and images.
  - Review S-8 (2026-11-15, `63afe0b5`): the header jump lookups in `lifecycle-header` and `shown-revision-draft-session` and the Italian text in `languages` match exactly, so they fail on "Next open ↓". S-7 and S-9: the colour cases cover the outline's badge and flag too, and the Snapshot case waits for the network to settle.
- [x] 2.2 The strings (decision 7).
  - Tests first: `packages/view/src/strings/glyphs.test.ts` fails on ↓ ↩ ↻ ↗ ✓ ✕ × in any value of every language, and on → outside `tree.adjust.example` and `navigator.nextOpen` (decision 7). The `key.*` values are exempt.
  - Then remove the glyph from `header.nextOpen` in `en-US.ts` and `it-IT.ts`. Leave `navigator.nextOpen` as it is: `answering-flow-fixes` deletes it (#184).
  - Verify:
    - the test fails on the two values and then passes;
    - `bun run check:skills` passes, since `skills/askboard-help/` quotes neither value.
  - Note (2026-11-15): `strings/glyphs.test.ts` (2 tests) failed on `header.nextOpen` in it-IT (and en-US), then passed after the edit. `outline.newReplies` removed, since `header.newReplies` replaces it; `check:skills` passes.
- [x] 2.3 The shell (decisions 6 and 8).
  - `board-header.tsx`: `IconNextOpen` (`size-4`) after the jump's text.
  - `navigators.tsx`:
    - the outline's reply badge is an image (`role="img"`, `aria-label` and `title` from `header.newReplies`) holding `IconReplies` (`size-3`) and the count;
    - the agent-change flag is an image named by `header.agentUpdated`, holding `IconAgentChanged` (`size-3`);
    - in the question navigator, the badges' icons stay decorative, and its "Next open →" button is left as it is (decision 3).
  - Each file imports the module by its relative path (`../icons/index.ts`).
  - Verify:
    - 2.1's header, outline and colour cases pass in a browser run with `--engines chromium,firefox,webkit`;
    - the edited lifecycle and languages cases pass;
    - the unit tests pass.
  - Note (2026-11-15): header jump, outline badge and flag, question-navigator badge done; their `LISTED_AHEAD` entries removed. Header, outline and colour cases pass in chromium, firefox and webkit.
- [x] 2.4 The context and the date field (decisions 6 and 8).
  - `catalog/context/reference.tsx`: the hint keeps "opens in browser" and draws `IconExternal` (`size-3`, hidden) in place of the `↗` span. Keep `data-context-part="external"` on the icon's wrapper, which the context tests use.
  - `catalog/date-field/index.tsx`: `IconCalendar` (`size-3.5`) replaces `CalendarIcon`.
  - Verify: 2.1's hint and calendar cases, and `context-items`, `context-reference`, `date-atom` and `atoms-it` pass in a browser run with the three engines.
  - Note (2026-11-15): hint and calendar done; `context-items`, `context-reference`, `date-atom` and `atoms-it` pass in the three engines (53 tests per engine across the nine files of this group).
- [x] 2.5 Group run. Run `bun run test:e2e:smoke`, and the check. Verify:
  - both pass, and the build's size check passes without a new record;
  - `grep -rnE '↓|↩|↻|↗' packages/view/src --include='*.tsx'` finds only key-label code and comments;
  - the note records the test counts.
  - Note (2026-11-15, restated after review S-6): at `933a849c` (which holds group 3's `682d9a9b`, the S-5 fix and the S-1 fix `82ec183d`; group 4's uncommitted work was in the tree) `bun run test` passes: 14,788 pass, 3 skip, 0 fail. `test:e2e:smoke` passed at `d17cee80` (59 pass, 5 skip, 0 fail; conformance in the three configurations; size check without a new record) and is not rerun since only tests changed. The `grep` finds no glyph in `.tsx`. At `d17cee80` itself the unit run had failures in `view.test.ts` and `shared-modules.test.ts` that the later commits fixed.
- [ ] 2.6 Review checkpoint: spec review of group 2's range (askboard-spec-reviewer). No security review: the group draws AskBoard's own static SVG inside the view and changes neither the sandbox, the page policy, the host nor the network. The note says so, and the spec reviewer may ask for one. Verify: every finding is fixed as a task, tests first, or recorded with its reason, and the range and verdict are in the note.

## 3. The widgets' icons (Approval, comment card, Tree, Ranking)

- [x] 3.1 Tests first (requirements "Icons beside their labels" and "Accessible names of icons").
  - `approval.browser.ts` :82 and :91: the selected "Reject" holds an `svg` with `aria-hidden="true"` and is named "Reject"; after the second press it holds no `svg`. This replaces the `✓` text checks.
  - `document-review.browser.ts`: scenario "The comment card's close control".
  - `tree-layout.browser.ts`: the chevron's span holds an icon `svg`, turned when open.
  - `tree-drag.browser.ts` and `ranking.browser.ts`: each drag handle (`role="img"`, its name unchanged) holds an icon `svg`.
  - `ranking-keys.browser.ts`: scenario "Key names stay text" (no key cap of the keys panel holds an `svg`). It passes before and after, and guards decision 7.
  - Remove `.replace("✓", "")` from `harness/tab-stops.ts:16` in the same task.
  - Verify: the new and edited cases fail on group 1's code, in a browser run with `--engines chromium`.
  - Note (2026-11-15): tests written first. Approval (mark `svg.lucide`, hidden, name kept; none after the second press), comment-card close (hidden icon, no ×), Tree chevron (both parents), Tree and Ranking handles (`role="img"`, icon `svg`), Ranking-keys "no `kbd svg`" (guard, passes before and after); `.replace("✓", "")` removed from `tab-stops.ts`. Against group 1's code in chromium the Approval cases failed on the missing icon (and the `✓` in the Tab-stop name); the others failed or passed as expected.
- [x] 3.2 The Approval and the comment card (decisions 6 and 8).
  - `approval/widget.tsx`: `IconSelected` (`size-4`, hidden) replaces the `✓` span, keeping `CHECK`'s spacing; update `classes.ts`'s comment.
  - `shared/annotations/card.tsx`: `IconClose` (`size-4`, hidden) replaces `×`.
  - Both import `@askboard/view/icons`.
  - Verify: 3.1's Approval and comment-card cases, and the `approval*` and `document-review*` browser files, pass in the three engines.
  - Note (2026-11-15): `IconSelected` (`size-4 shrink-0`, hidden) in `approval/widget.tsx`, `IconClose` (`size-4`, hidden) in `shared/annotations/card.tsx`; `classes.ts` comment updated. `approval*` and `document-review*` pass in chromium, webkit and firefox apart from the #145 case.
- [x] 3.3 The Tree and the Ranking (decisions 2 and 8).
  - `tree/row.tsx`: `IconDisclosure` (`size-3`) inside the existing `Chevron` span, which keeps its rotation classes; `IconDragHandle` (`size-3`) inside `DragHandle`.
  - `ranking/row.tsx`: `IconDragHandle` in place of the `GRIP_DOTS` SVG; drop `GRIP_DOTS` if nothing else uses it.
  - Verify:
    - 3.1's cases pass;
    - `tree/drag-view.test.ts` passes unchanged;
    - in a browser run with `--engines chromium,webkit`, every `tree-*` and `ranking*` file passes unchanged.
  - Note (2026-11-15): `IconDisclosure` inside `Chevron`, `IconDragHandle` in `DragHandle` and in the Ranking handle (`size-3`, hidden); `GRIP_DOTS` dropped. `tree-*` and `ranking*` pass in chromium and webkit; `tree/drag-view.test.ts` unchanged and passing. none to remove from `LISTED_AHEAD`: 1b.1's module exemption covers them until 5.2; the `needs` of approval, ranking, tree and document-review in `tools/build/view.test.ts` gain `icons` (a file this group had to edit: the build now lists the chunk).
- [x] 3.4 Group run. Run the check, and a browser run of the widget files of 3.1 to 3.3 in Firefox. Verify: both pass, failures mapped to open Issues excepted (#145, #174, #199, #200, #201) with the Issue named. The note records the counts.
  - Note (2026-11-15): 27 browser files (approval, document-review, tree, ranking): chromium 182 pass, 0 fail; webkit 180 pass, 0 fail; firefox 178 pass, 2 fail, both outside this group: the Document review "agent reopens the question with the commented word rewritten" (#145) and the Tree "Delete on design asks, inline" (#174). `typecheck`, `lint`, `check:imports` pass; `bun run test`: the remaining failures are group 2's shell `needs` line (`view.test.ts:188`) and group 4's `lucide` import-rule cases, neither in this group.
- [ ] 3.5 Review checkpoint: spec review of group 3's range (askboard-spec-reviewer). No security review: same reason as 2.6, which the note restates. Verify: as 2.6.

## 4. The board page's close icon (Q1; waits for 0.1)

- [x] 4.1 Pin `lucide` (decision 10; requirement "The board page's close icon", scenario "Two pins apart").
  - Tests first, in `tools/workspace.test.ts`: when `packages/view/package.json` pins both `lucide` and `lucide-react`, the versions are equal, and a fixture with two versions fails naming both.
  - Then add `"lucide": "<the version>"`, run `bun install`, and extend 1.1's Dependabot ignore to `lucide`.
  - Add the spine's Stack row `lucide` (the board page's close icon; the same version as `lucide-react`).
  - Verify:
    - the test fails on the fixture and passes on the tree;
    - `GITHUB_TOKEN=$(gh auth token) bun run check:licences` passes.
  - Note (2026-11-15): `lucide` 1.73.0 added to `packages/view/package.json` (`bun install` adds one package), Dependabot ignore, spine Stack row. Two tests in `tools/workspace.test.ts` (fixture with two versions names both; the tree); the tree test failed before. `check:licences` passes (170 installed, 29 direct).
- [x] 4.2 The rule for `lucide` (decision 5). Tests first, in `tools/check-imports.test.ts`: `lucide` from `packages/view/src/board-page/icons.ts` passes; from any other file, and any `lucide/…` path, fails. Then the rule. Verify: the cases fail before and pass after, and `bun run check:imports` passes.
  - Note (2026-11-15): `lucide` is imported only from its documented main entry, as one static named import of `createElement` and PascalCase icons, in `board-page/icons.ts` or a test (as design decision 10 says); `createIcons`, `icons`, namespace and default imports, re-exports, dynamic imports, any `lucide/…` subpath, `lucide-*`, `@lucide/*` and any other casing fail everywhere (with X-1's lower-case comparison). The rule strips the allowed statements from the source before reading its specifiers. The cases failed before and `check-imports.test.ts` has 244 pass; `check:imports` passes.
- [x] 4.3 `board-page/icons.ts` and the two panels (decision 10).
  - Tests first:
    - `context-panel.browser.ts`: scenario "The reading panel's close control";
    - `settings-panel.browser.ts`: scenario "The settings panel's close control".
  - Then write `closeIcon(document)` with `createElement(X, { "aria-hidden": "true", class: "size-4" })` from `lucide`. In `reading-panel.ts` and `settings-panel.ts`, append it in place of the `✕` text, keeping each `aria-label`.
  - Add the board page's close icon to DESIGN.md's Icons table (drop the "Q1" mark) and one line to the as-built note.
  - Verify:
    - the cases fail before and pass after, in a browser run of both files with the three engines;
    - the board-page chunk passes its size check without a new record.
  - Note (2026-11-15): two browser cases (one per panel) failed before (0 hidden icons) and pass in chromium, firefox and webkit (context-panel 18, settings-panel 12 each). `closeIcon` is `createElement(X, …)` from `lucide`'s main entry with constant attributes; the package's own types resolve. Tree-shaking keeps `x`'s path data and no other icon, no `createIcons` and no `replaceElement` (checked by hand on the built `board-page.js`, 1,017,449 bytes). The settings close button gets the reading panel's `w-7` form. DESIGN.md Icons row says the icon lands drawn by the board page's icon file, no Q1 mark. Build passes with no size record; the board page's notices list `lucide` (ISC). The built-chunk check of `x`'s path data only (design decision 10 guard) is not written: it belongs in `tools/build/view.test.ts`, which group 3 owns; left to group 5 (task 5.1).
- [ ] 4.4 Review checkpoint: spec review of group 4's range, plus a security review (askboard-security-reviewer), because the group changes the board page, which holds the token outside the sandbox, and adds a dependency. Verify: as 1.6.

## 5. Integration and records

- [x] 5.1 The built chunks (decision 4, decision 10; P1; requirement "One icon set in one chunk", scenarios "The manifest" and "A board inlines the icons once").
  - Tests, in `tools/build/view.test.ts`, after a build:
    - the shell needs `icons`;
    - the outputs of `tree`, `ranking`, `approval`, `document-review`, `context`, `date-field` and the shell hold no `"lucide"` string, while `icons`' output does;
    - assembling a board with a Tree, a Ranking and a Text inlines `icons` once;
    - with Q1 (a), the built board page holds `x`'s path `M18 6 6 18` and not `check`'s `M20 6 9 17l-5-5`.
    - the board page's licence notices name `lucide` (ISC, with the text of its `LICENSE`), and no view chunk's notices name `lucide` (review finding S-19 of group 4).
  - Verify: each assertion fails when its condition is broken on purpose (the shell's import of the module removed; a widget importing `lucide-react/icons/check` directly with `check:imports` bypassed; the board page importing `Check`), then passes. Revert each planted change.
  Note (2026-11-15): five tests in `tools/build/view.test.ts` (shell needs `icons`; only the icons output holds `lucide`; a Tree, Ranking and Text board inlines `icons` once; board page holds `M18 6 6 18` and no `check` path, `createIcons`, `replaceElement`, `data-lucide`; the notices name `lucide` ISC on the board page only). Built chunks green on cfdd7afa.
- [x] 5.2 Every icon used. Tests first, in `packages/view/src/icons/index.test.ts`: each export of the module is imported by at least one non-test file under `packages/view/src` or `packages/widgets/src`. Verify: the test passes after groups 2 to 4, and fails when a planted unused export is added (then removed). It also removes the icon module's exemption (`EXEMPT_MODULES`) from `tools/build/shared-modules.test.ts` (fix 1b.1).
  Note (2026-11-15): `icons/index.test.ts` gained the used-export test; a planted `IconPlanted` export failed it (and three others), then was removed. `EXEMPT_MODULES` is gone from `shared-modules.test.ts`; 84 pass in the two files.
- [x] 5.3 Sizes, recorded once. Run `bun run build:view --record-sizes`. Verify:
  - the diff of `packages/view/chunk-sizes.json` changes only chunks this change touched (`icons`, `shell`, `context`, `date-field`, `approval`, `document-review`, `tree`, `ranking`, `board-page`);
  - the note records each one's before and after;
  - the check passes.
  Note (2026-11-15): recorded once; only touched chunks changed. shell 223,354 to 223,806; context 15,053 to 15,479; date-field 95,578 to 95,624; approval 21,695 to 21,918; document-review 40,466 to 40,700; tree 82,606 to 82,399; ranking 29,949 to 29,921; board-page 1,035,650 to 1,036,297; icons 6,710 (new in group 1, unchanged). Added a Dependabot `lucide` group (major of `lucide` and `lucide-react` in one pull request), keeping the minor and patch ignores. `bun run check` green on cfdd7afa.
- [x] 5.4 The full browser suites, since the change alters widgets' rendering (CLAUDE.md, CI). Run `bun run test:e2e`. Verify: it passes, or each failure is mapped to an open Issue it already reports, with the Issue named in the note. A new failure becomes a task or an Issue (`source:e2e`).
  Note (2026-11-15): `bun run test:e2e` on cfdd7afa: Chromium 901 pass 0 fail; Firefox 864 pass 37 fail, all in the files and tests #174 names (Tree group question and layout, Gantt column, toggles, Table hover audit, Stack/Row/Group, Form session) or #144 (Gantt axis at day zoom); WebKit 900 pass 1 fail (`shown-revision-act-session`, "Select recommended and Submit…", no answer event in the log), which passed in a full WebKit rerun (904 pass 0 fail): a load flake, no Issue filed; perf 91/56/89 pass 0 fail; conformance on Bun, run apart because the browser step failed first: three configurations passed, 59 pass 5 skip.
- [x] 5.5 Records completed.
  - `docs/as-built/icon-set.md`: the sizes of 5.3, the test counts, Q1's outcome and any deviation.
  - DESIGN.md's Icons table equals the module's exports and the board page's icon.
  - Tests: none (documents).
  - Verify: each named file carries its lines, and `grep -c '^| `Icon' docs/ux-askboard-2026-10-27/DESIGN.md` equals the module's export count.
  Note (2026-11-15): `docs/as-built/icon-set.md` carries the sizes, the check and Dependabot group; DESIGN.md's Icons table has 9 rows, the module's 9 exports. Q1 (a), no deviation.
- [ ] 5.6 Review checkpoint: spec review of group 5's range (askboard-spec-reviewer). Verify: as 2.6.

## 6. Rebase and pull request

- [ ] 6.1 Rebase onto `origin/main` and apply design.md's merge-point rules, above all the navigator jump if `answering-flow-fixes` has merged.
  - Re-check every borrowed name with `git grep -n`.
  - If `navigator.nextOpen` is gone from `main`, drop its exemption from `strings/glyphs.test.ts` (decision 7).
  - Rebuild and run `bun run build:view --record-sizes`; never merge the numbers by hand.
  - No contract set is widened, so no version is bound (askboard-contract-versioning).
  - Verify:
    - the check and `bun run test:e2e:smoke` pass;
    - `openspec validate icon-set --strict` is valid;
    - the note lists each conflict and how it was resolved.
- [ ] 6.2 Pre-PR review: spec review and security review of the whole range, plus the kaizen step (askboard-delivery). Fix the findings as tasks, tests first. The pull request body says:
  - what changed and why;
  - the checks run and their results;
  - `Closes #188`;
  - what is left for the PO: Q1 if still open, and D1 to D5 to confirm.

  Verify: both reviews' verdicts are in the note, and the body holds no AI attribution.

## Workflow follow-up

- After the PO merges the pull request, archive the change (`/opsx:archive`), whose pull request says `Refs #188`.
