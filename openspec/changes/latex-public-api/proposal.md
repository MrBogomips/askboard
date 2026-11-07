# Proposal

## Why

The LaTeX widget (`latex-kanban-timeline`, design decision 7, Bounded output) measures KaTeX's output through `katex.__renderToDomTree`, an internal function KaTeX's documentation calls unstable, and guards it with tests that read lines of KaTeX 0.19.1's `katex.mjs`. Any KaTeX release, a patch included, fails those tests, so every Dependabot pull request on KaTeX is red and needs hand work. The PO rejected the choice on 2026-11-07: AskBoard uses only KaTeX's documented interface, and a pathological formula is a bug to handle later, not a mechanism to maintain now.

The risk assessment of 2026-11-07 (design.md, Context) found that no realistic formula comes near a hang or a crash, that the contract's scan with KaTeX's documented options bounds every known nesting form but one, stacked combining marks, and that counting them in the scan closes it.

## What Changes

- **Documented KaTeX only** (AD-8, AD-19): the preview is drawn by `katex.render` into an element outside the page, then moved in; the tests use `katex.render`, `katex.renderToString`, `katex.ParseError` and KaTeX's documented options only, and none reads KaTeX's files or pins its version. The exact pin `katex` 0.19.1 stays (AD-19).
- **No output bound**: the measurement of KaTeX's output tree (`tree.ts`, `LATEX_TREE_BOUNDS`) and the "too complex to preview" field error go, with the depth probe and its harness. The board refuses what the contract's scan refuses and draws the rest, so an expression the scan passes and the old bounds refused, such as about 2,000 empty matrix cells, is now drawn, slowly.
- **Combining marks counted** (NFR-5, AD-8): the contract's LaTeX scan counts a run of stacked combining marks (U+0300 to U+036F) as nesting, so `ask`, `update`, an answer and the board refuse the one known form that passes the scan and crashes Chromium's renderer (`x` and about 130 stacked accents). No schema set moves: it is a check.
- **Known issues, kept for later as bugs** (design.md, Risks): a nesting form nobody knows yet, a very wide pathological expression, and KaTeX releases that add a defining or infix command. The backlog note is task 4.2.
- **Documents**: EXPERIENCE (Voice and Tone strings table, Component Patterns: Widgets, LaTeX) loses the too-complex error; CLAUDE.md describes the board as built.
- **Not in this change**: the font licence evidence keyed by KaTeX's exact version (`tools/font-licences.json`), which a KaTeX bump still re-keys under the adoption rule (open question 4); a re-measure of the nesting limit; any change to the render queue, the source limit or the render options.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contract`: LaTeX nesting bounded (stacked combining marks counted; no board output bound to defer to).
- `view-and-widgets`: LaTeX output bounded removed; LaTeX bounded work gains the combining-marks scenario; the preview's height scenario moves to its own requirement.

## Impact

- Code: `packages/contract/src/widgets/latex/` (`scan.ts`, `constants.ts` comments) and its tests; `packages/widgets/src/latex/` (`render.ts`, `model.ts`, `widget.tsx` as needed; `tree.ts`, `tree.test.ts` and `katex-source.test.ts` deleted; `render.test.ts` and `model.test.ts` rewritten on the public API); `packages/view/src/strings/` (`latex.tooComplex` removed); `packages/view/test/browser/` (the probe and its harness deleted, the bounds suites trimmed); the KaTeX version literals in `tools/build/*.test.ts` and one browser test read from the installed package.
- No schema set, no dependency, no `chunk-sizes.json` record (the `latex` chunk shrinks), no PRD or spine change.
- Merge points with `atoms` and `layouts` (in flight): design.md, Merge points.
- IDs served: FR-11; NFR-5, NFR-6, NFR-10. ADs: AD-1, AD-8, AD-10, AD-19. UX: EXPERIENCE Voice and Tone (strings table, LaTeX row), Component Patterns (Widgets, LaTeX).

## Open questions for the PO

Each carries a proposed default, accepted under the PO's unattended handoff of 2026-11-07; a different answer comes back through `/opsx:update` before the group it touches.

1. **No output bound at all.** *Default:* none; a pathological output is a bug to handle when seen. *Alternative:* keep the bound, measured on the element `katex.render` fills outside the page (documented API and standard DOM), at the cost of re-measuring the bounds in browsers on KaTeX upgrades.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
2. **Combining marks.** *Default:* the scan counts a run of n marks of U+0300 to U+036F as n + 1 levels (one more for the script argument the marked character may be), so 11 stacked marks are refused as a nest past the limit; text has one or two marks per letter. *Alternative:* leave them uncounted and record the Chromium crash as a known issue.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
3. **The nesting limit.** *Default:* `LATEX_NESTING_MAX_DEPTH` stays 11, as measured on 0.19.1 (every counted form at the limit drew in 211 ms or less in WebKit); no re-measure. *Alternative:* re-measure in both engines (the probe is in git history).
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
4. **The font licence on a KaTeX bump.** *Default:* unchanged: `tools/font-licences.json` keeps its evidence by exact version (AD-19, the adoption rule), so a bump re-keys that one entry after re-reading the fonts' name tables; this change makes every other test read KaTeX's version from the installed package, so that entry is the only edit a bump needs. *Alternative:* a separate change that checks the fonts' licence fields in the build and keys the entry by package.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
5. **The depth probe.** *Default:* delete it and the harness modules only it uses (about 1,700 lines); git history keeps them (`0e151a84`). *Alternative:* keep them for a future re-measure.
   - Answer (2026-11-07): proposed default accepted under the PO's unattended handoff; the PO may revisit.
