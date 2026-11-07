# PRD update draft: latex-kanban-timeline

**Status: not yet applied (task 0.4).** It carries the default of the proposal's open question 11, taken under the PO's unattended handoff on 2026-11-07 and flagged for the PO in the pull request; a different answer comes back through `/opsx:update` before task 5.1. Two blocks: block 1 amends the adoption rule in the PRD addendum, which is the PRD change NFR-6 and AD-19 require for a licence the rule admits; block 2 keeps the solution design's restatement of the rule in step. The spine cites the addendum and needs no edit; no FR, NFR or AD ID changes. Each block quotes the current text exactly, as `main` holds it at 66fd51f3, then gives the replacement.

Why (group 3 review X-1): KaTeX 0.19.1's script holds SVG glyph outlines that its upstream adapted from KaTeX's own fonts. `dist/katex.js:6970-6974` says "Many of the KaTeX SVG images have been adapted from glyphs in KaTeX fonts. Copyright (c) 2009-2010, Design Science, Inc. (<www.mathjax.org>) Copyright (c) 2014-2017 Khan Academy (<www.khanacademy.org>) Licensed under the SIL Open Font License, Version 1.1."; the ESM build `dist/katex.mjs`, which the `latex` chunk bundles, holds the same outlines (`var path = {`) without the comment. They are neither font files nor unmodified, so the rule as written admits the fonts (design decision 8) but not the outlines.

How to apply: check that each current text stands once, word for word (`grep -c -F`), replace only it (the rest of its line stays), set `updated:` in the front matter of both files to the apply date, then run `openspec validate --all --strict --no-interactive`. If another change has merged a different text into either line meanwhile, keep its text, apply this block's addition to it, and say so in task 0.4's note.

## Block 1: the adoption rule's OFL clause

File: `docs/prd-askboard-2026-10-25/addendum.md`, Widget building blocks, Adoption rule, Licence.

Current:

```text
and SIL OFL-1.1 only for unmodified font files shipped with their licence text;
```

Replacement:

```text
and SIL OFL-1.1 only for unmodified font files, and for glyph outlines that the fonts' own upstream derived from them and ships in its package, each shipped with the OFL-1.1 text, the fonts' copyright lines and their Reserved Font Names;
```

## Block 2: the solution design's restatement

File: `docs/architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`, §9 Stack and component adoption, Adoption rule.

Current:

```text
and OFL-1.1 only for unmodified font files;
```

Replacement:

```text
and OFL-1.1 only for unmodified font files and for glyph outlines their upstream derived from them, with the licence text, copyright lines and Reserved Font Names;
```
