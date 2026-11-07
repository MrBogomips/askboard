# Design

## Context

See proposal.md for why. Read on `origin/main` 0e151a84 (`latex-kanban-timeline` and `chart-widget` merged and archived):

- **How the preview draws** (`packages/widgets/src/latex/render.ts`): `renderInto(element, expression, bounds)` runs the contract's `scanLatex` and refuses a definition, an `@` name, `\show`, ``\char` `` or a depth past `LATEX_NESTING_MAX_DEPTH` (11) before KaTeX runs; then `renderTree` (`tree.ts`) calls `katex.__renderToDomTree`, `treeSizeOf` measures depth, nodes and nested `mfrac` against `LATEX_TREE_BOUNDS` (245, 21,344, 11), and past them `{tooComplex}` gives "too complex to preview"; else `tree.toNode()` replaces the element's children. `parseProblem` runs the same steps without nodes, for Bun. Render options: `trust: false`, `strict: "ignore"`, `maxExpand: 1000`, `maxSize: 20`, `output: "htmlAndMathml"`, fresh `macros`.
- **What pins KaTeX's files**: `katex-source.test.ts` (the installed version is 0.19.1, guards (e) to (m) read `katex.mjs` lines, the internal function, the MathML element names), `tree.test.ts`, `render.test.ts` (the measured bounds, spies on `__renderToDomTree`), and in the view's browser tests the depth probe `latex-depth-probe.ts` with its harness. The KaTeX version also appears as a literal in `tools/build/view.test.ts`, `licences.test.ts`, `font-licences.test.ts` and `edit-widgets-snapshot.browser.ts`, beside the font licence entry `katex@0.19.1` in `tools/font-licences.json`.
- **Risk assessment** (2026-11-07; Bun with `katex.renderToString` and the render options, plus the archived change's browser measurements on an Apple M3 Max, decision 7, Measuring):
  - Chromium's renderer crashes at about 130 nested vertical-list constructs (`x^{` 130 deep: markup depth 917; it drew tree depth 319 without a crash). WebKit's layout grows about 1.7 times per directly nested fraction (11: 386 ms, 18: 1.4 s, 20: 5.4 s, 30: over 30 s). Width: 21,344 nodes 368 ms, 32,012 nodes 538 ms in WebKit.
  - Realistic formulas (the skill's example, matrices, sums with limits, a `\cfrac` 5 deep, a 10-row `aligned`, a 2,000-code-point polynomial) reach scan depth 6, markup depth 47, 5 nested fractions, 4,677 elements, 3.7 ms of KaTeX work.
  - Every form the scan counts, at its limit of 11: at most 11 nested fractions and markup depth 93; recorded at 211 ms in WebKit and 37 ms in Chromium. `\ne` 201 times hits `maxExpand`; `\rule{1000em}{1000em}` is capped by `maxSize`.
  - One known form passes the scan: stacked combining marks. KaTeX nests each consecutive mark of U+0300 to U+036F that it knows (12 of them, in math and text mode) as an accent: `x` and 130 U+0302 is the output of `\hat{` 130 deep (depth 656), a recorded Chromium crash form, in 131 code points; 1,999 marks give depth 10,001. Interleaved spaces, line feeds or comments make KaTeX refuse the marks; a zero-width joiner between them draws flat; marks of U+1AB0, U+1DC0, U+20D0 and U+FE20 draw flat or fail. Optional arguments (`\sqrt[`) nest only through braces, which the scan counts.
  - Widest within the scan: about 2,000 empty matrix cells (`&` 1,985 times), 31,611 elements, 16 ms of KaTeX work; not timed in a browser (the browser lock was held).

## Goals / Non-Goals

**Goals:**

- No code or test of AskBoard uses a KaTeX name its documentation does not give (the API page: `render`, `renderToString`, `ParseError`, the options) or reads KaTeX's script; the documented stylesheet `katex/dist/katex.min.css` and its fonts stay read as resources by the build and the browser frame. A KaTeX release passes `bun run check` with one edit, the font licence entry (proposal, open question 4).
- Every known pathological formula is refused by the contract or merely slow; the rest is recorded as known issues.

**Non-Goals:**

- Re-measuring `LATEX_NESTING_MAX_DEPTH`, or a new bound of any kind.
- The render options, the render queue, the source limit, the field errors other than "too complex", the skill text, the font licence evidence.

## Decisions

### 1. Draw with `katex.render` into an element outside the page

`renderInto(element, expression)`, in order: the scan's refusal as today (KaTeX does not run); then `katex.render(expression, scratch, renderOptions())` into a `span` made by `element.ownerDocument.createElement` and never attached; on success the element's children are replaced by the scratch's (`replaceChildren(...scratch.childNodes)`). Every thrown value is caught as today: an `Error` gives `{error: message}`, anything else `{error: ""}` (the fixed text), and the element keeps its last render. `katex.render` makes its own quirks-mode check, so `QUIRKS_ERROR` goes. `Rendered` is `{error?, refused?}`; `renderInto` and `parseProblem` lose `bounds`. `parseProblem(expression)` is the scan's refusal, then `katex.renderToString` only to learn whether KaTeX throws; its markup is never used. In `packages/widgets/src`, only `render.ts` imports `katex` (tests aside), so every draw passes the scan.

The scratch element is needed because `katex.render` empties its target before it parses, which would lose the last render on a parse error (view-and-widgets spec: LaTeX parse errors). Building the nodes off the page costs KaTeX's script only (19 ms at most for any 2,000-code-point input in Bun); the costs the assessment found are the page's layout of attached nodes.

*Alternatives:* drawing straight into the element (loses the last render); `renderToString` and markup in the page (the page policy blocks KaTeX's inline styles, and AD-8 puts no agent-derived markup string in the page).

### 2. No output bound (open question 1)

`tree.ts` with `renderTree`, `treeSizeOf`, `LATEX_TREE_BOUNDS`, `TreeBounds`, `TreeSize` and `KatexTree` goes, with `{tooComplex}`, `FieldErrorKey`'s `latex.tooComplex` and the string. The view-and-widgets requirement "LaTeX output bounded" is removed; its preview-height scenario moves to "LaTeX preview within its box", whose behaviour (DESIGN Components: LaTeX, 400 px, scrolling inside) is CSS and already built.

*Alternative:* measure the scratch element's DOM (depth, elements, nested `mfrac`) with the same bounds: documented API and standard DOM, but the bounds were measured in KaTeX's tree units and would need browser re-measurement, the upkeep the PO declined.

### 3. Stacked combining marks counted by the scan (open question 2)

In `scanLatex`, a run of n consecutive code points in U+0300 to U+036F reaches n + 1 levels below the level that holds it: the deepest point recorded inside that level becomes at least n + 1. Any other code point ends the run. The run counts everywhere, comments and `\verb` bodies included, since the scan errs towards refusing more. The + 1 covers a marked character that is a script's argument (`x^y` and 130 marks: depth 663 in KaTeX), whose level the scan closes at `y`. The whole block is counted, not KaTeX's 12 marks, so a mark a later KaTeX learns there is counted already.

`latexPropsProblems` words the refusal as any nest past the limit; the limit stays 11 (open question 3); the skill's note "a nest deeper than 11 levels" stays true, so `skills/askboard/` is not regenerated. The comments of `scan.ts` and `constants.ts` stop naming the board's output bound and the probe, and cite KaTeX's documentation (its "Supported Functions" page) for the defining, infix and raw-token commands it lists there, with no line of `katex.mjs`. No schema set moves: the scan is a check, as in `latex-kanban-timeline` decision 3.

*Alternative:* refuse any run of more than a fixed number of marks with its own message: a new string and wording for one form, where the depth's field error already names the depth and the limit.

### 4. Tests through the public API only

- Deleted: `tree.ts`, `tree.test.ts`, `katex-source.test.ts`; `render.test.ts`'s output-bound and internal-spy blocks; the view's `latex-depth-probe.ts` and the harness modules only it uses (`latex-sweep.ts` and its test, `latex-bounds-rules.ts` and its test, `latex-probe-report.ts`, `latex-verify.ts`); `tree` in `LATEX_SOURCES`, the frame's bundled script and `Measure`; the readers of KaTeX's script `katexControlWords` (`latex-fixtures.ts`) and `optionalArgumentWords` (`latex-forms.ts`), with `controlWordConstructs`, `arityOf` and the measurer where nothing else uses them; the blocks "an output past bounds lowered by the test" of `latex-bounds.browser.ts` and "the LaTeX's output bound" of `latex.browser.ts` (open question 5).
- Rewritten: `render.test.ts` keeps the render options, the commands that reach outside (`renderToString`'s markup holds no anchor, image or foreign attribute), macros not outliving a render, `parseProblem`, the refusals before KaTeX, and the import guard of decision 1; `renderInto` runs on stand-ins for the element and its document with a spy on `katex.render`. `model.test.ts` maps `a` and 48 marks to `latex.tooDeep`. `latex-bounds.browser.ts` nests the fixed families (`LATEX_CONSTRUCTS` and `EXTRA_CONSTRUCTS`: the 17 constructs, the infix, hidden-opener, environment and style forms) instead of every control word read from KaTeX's script, and its block "combining marks at the default bounds" becomes the spec's "Stacked combining marks" scenario. `latex-forms.test.ts` and `latex-fixtures.test.ts` lose tree sizes, KaTeX's version and the control-word readers.
- Rule for what stays: a test may fail on a KaTeX release only when a documented behaviour changes (an option's effect, a command's output). None names KaTeX's version, a line of its files, an internal KaTeX name, its markup's structure beyond the absence of links, images and foreign attributes, or the wording of its messages; a refusal by KaTeX is asserted as a `katex.ParseError` or as a non-empty message.
- Version literals: the four tests that name 0.19.1 read the installed version from `katex`'s `package.json` or the font table's key. The entry `katex@0.19.1` in `tools/font-licences.json` stays (open question 4), so it is the one edit of a KaTeX bump.
- Browser suites keep every scenario of LaTeX source and preview, parse errors, untrusted commands, bounded work (with stacked marks), preview within its box, previews one at a time and read-only, in Chromium and WebKit.

### 5. Documents

- EXPERIENCE, Voice and Tone, the LaTeX row of the strings table: delete `the too-complex error "This expression is too complex to preview. Simplify it to see it drawn.";` and, in the Italian column, `l'errore di troppa complessità "Questa espressione è troppo complessa per l'anteprima. Semplificala per vederla disegnata.";`.
- EXPERIENCE, Component Patterns, Widgets, LaTeX: delete the sentence `An expression whose KaTeX output passes the board's bounds shows "too complex to preview" and does not block "Answer".`
- CLAUDE.md, "In code since `latex-kanban-timeline`": the sentence from "The board bounds KaTeX's own output" to "in Chromium and WebKit." becomes "The board draws through KaTeX's documented `katex.render`, into an element outside the page, after the contract's scan, which also counts stacked combining marks (`latex-public-api`); the nesting limit comes from one measurement in Chromium and WebKit."
- CHANGELOG, Unreleased: under Changed, the LaTeX preview uses only KaTeX's documented interface and refuses stacked accents past the nesting limit; under Known limits, issues K-1 and K-2 (Risks).
- No PRD, spine or DESIGN change: the spine's Stack keeps `katex` 0.19.1, and DESIGN's preview box stays.

### 6. Versions

None: no schema set, board-protocol message or seam of `contract` moves (askboard-contract-versioning). `atoms` and `layouts` bind their own minors; this change needs no rebind.

## Merge points

Borrowed from `main` (task 0.1 checks each): `scanLatex`, `LATEX_NESTING_MAX_DEPTH`, `LATEX_EXPRESSION_MAX_CHARS`, `latexPropsProblems`, `renderOptions`, `renderInto`, `parseProblem`, `Rendered`, `Refused`, `fieldErrorOf`, `FieldErrorKey`, `renderQueue`, `LatexFrame`, `LATEX_SOURCES`, `loadMeasurer`, `FONT_LICENCES`, the string key `latex.tooComplex`; KaTeX's documented `render`, `renderToString` and `ParseError`.

Changes in flight:

- **`atoms`** (branch `worktree-feature-atoms-and-layouts`, db4ea54a) and **`layouts`** (`worktree-feature-layouts`, 86ff60da, stacked on `atoms`): both edit `packages/view/src/strings/keys.ts`, `en-US.ts` and `it-IT.ts` (this change deletes the `latex.tooComplex` lines: keep both sides), `tools/font-licences.json` (they append entries; untouched here), `packages/view/chunk-sizes.json` (nothing recorded here: the `latex` chunk shrinks), CLAUDE.md and CHANGELOG (other paragraphs), and the main specs at archive (other requirements). Neither borrows a LaTeX seam: their designs name no `renderInto`, `tree.ts`, `LATEX_TREE_BOUNDS` or `scanLatex` (read at the heads above).
- **`diagram-render`** (proposed, 9281d923, no task done): Mermaid's own `katex` 0.18 is not touched; no overlap.

Seams removed: `tree.ts` and its exports, `Rendered.tooComplex`, the `bounds` parameters, `latex.tooComplex`. The archived design offered them to a later Markdown math; no change in flight borrows them.

## Risks / Trade-offs

Known issues, kept as the PO asked, to fix as bugs when seen (task 4.2):

- [K-1. A nesting form the scan does not count, today unknown or added by a KaTeX release, reaches Chromium's crash depth (about 130 levels): the board's tab crashes, on every load if the agent sent it] → the scan counts every form known on 0.19.1, its limit is about 12 times under the crash; the fix of such a bug is one more rule in the scan's count.
- [K-2. A very wide expression, such as about 2,000 empty matrix cells (31,611 elements), takes about 0.5 to 1 second in WebKit on an M3 Max and may pass the 2-second rule on slower hardware] → the old node bound refused it; the render queue keeps other items and input answering between draws; no realistic formula comes near (4,677 elements at most).
- [K-3. A KaTeX release adds a defining, infix or raw-token command, which no test now finds] → the scan's lists follow KaTeX's documented function list; the review of a KaTeX bump reads its release notes for such commands, as any dependency review does.

Other:

- [The limit of 11 was set by rule 4 of the archived measurement, from the output bounds that go] → every counted form at 11 drew in 211 ms or less in WebKit and 37 ms in Chromium; the realistic set reaches 6.
- [Removing a measured defence weakens AD-8's sandbox] → the sandbox, the page policy and `trust: false` are unchanged; the checkpoints of groups 1 and 2 add a security review.
- [A draft or an answer holding stacked marks past the limit, made before the merge, is now refused] → fail closed (NFR-10, AD-10): the field error names the depth, and `ask-core` refuses the answer as for any refused source.

## Migration Plan

None: no schema, no stored format. Rollback is a revert.

## Open Questions

None beyond the proposal's five, whose defaults are accepted under the PO's unattended handoff. No conflict between the binding documents: EXPERIENCE and the main specs carry the output bound, and this change removes it from both.
