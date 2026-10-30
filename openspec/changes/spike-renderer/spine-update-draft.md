# Spine update draft: renderer spike

Replacement texts for task 8.4, drafted before the PO's decisions (task 8.2). Each block belongs to one row of "Proposed outcomes (awaiting the PO)" in `findings.md` and applies only if the PO accepts that row. Each block quotes the current text exactly, then gives the replacement. A block marked with a letter (`8.A`) applies only if the PO picks that row's alternative. AD IDs stay stable: every AD is amended in place, and no AD is added.

Files, all under `docs/`:

- **Spine:** `architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`
- **Solution design:** `architecture-askboard-2026-10-27/SOLUTION-DESIGN.md`
- **EXPERIENCE:** `ux-askboard-2026-10-27/EXPERIENCE.md`
- **DESIGN:** `ux-askboard-2026-10-27/DESIGN.md`
- **Addendum:** `prd-askboard-2026-10-25/addendum.md`

How to apply:

- Apply the blocks of accepted rows only. For a row accepted with changes, edit its blocks first.
- A phrase block replaces only the quoted phrase; the rest of the line stays. An "Insert after" or "Insert before" block adds its text next to the quoted anchor.
- Where two rows touch one passage, they replace different phrases of it, so their blocks apply in any order, except where a block says otherwise:
  - spine AD-9, "Build and assembly": rows 3, 16 and 18;
  - solution design §4.5, the CSP bullet: row 4 replaces the bullet, and 8.A then replaces a phrase of the new text;
  - solution design §9: rows 1, 8, 9, 10, 11, 13, 19, 20 and 21; the Diagram row takes phrases from rows 8 and 11;
  - EXPERIENCE, Component per widget, the Diagram row: rows 8 and 11;
  - spine Consistency Conventions, Tests: rows 17 and 18;
  - the addendum's licence bullet: rows 19 and 9.A, whose combined text is in 9.A.
- The mod delivery spike's draft touches the same front matter, the spine's Deferred table (other rows), solution design §12's "Architecture spikes" row (its block 18.4) and §13's introduction (its block 17.1). Whichever change applies second quotes the text the first one left: blocks 24.1 and 25.3 say how.
- A sentence tagged `[row N]` stays only if row N is accepted; drop the tag when applying.
- Set `updated:` to the apply date in every file changed.
- Verify with `git diff --exit-code origin/main -- docs/` before applying (empty: this draft changed nothing), then, after applying, with `openspec validate --all --strict --no-interactive`, `bun run check`, and a grep showing that no Deferred row of the spine still names the renderer spike as pending (task 8.4).

| Row | Touches |
| --- | --- |
| 1 | Spine AD-9; solution design §9 (spine Stack for 1.A) |
| 2 | Spine AD-9 |
| 3 | Spine AD-9, AD-15; solution design §5.6 |
| 4 | Spine AD-8; solution design §4.5 |
| 5 | Spine AD-8; solution design §4.5 |
| 6 | EXPERIENCE Atoms; DESIGN Components (Form) |
| 7 | EXPERIENCE Changes, values and board states; DESIGN Components |
| 8 | Solution design §9; EXPERIENCE Component per widget, State Patterns, Key Flows (spine AD-8 and solution design §4.5 for 8.A) |
| 9 | Solution design §9 (addendum for 9.A) |
| 10 | Spine AD-8; solution design §9 |
| 11 | Solution design §9; EXPERIENCE Component per widget |
| 12 | DESIGN Syntax highlighting; EXPERIENCE Component per widget |
| 13 | Solution design §9; EXPERIENCE Component per widget (spine Stack and AD-9 for 13.A) |
| 14 | Spine Stack |
| 15 | EXPERIENCE Dark theme |
| 16 | Spine AD-9 (spine AD-8 for 16.A) |
| 17 | Spine Consistency Conventions (Tests) |
| 18 | Spine AD-9; spine Consistency Conventions (Tests) |
| 19 | Addendum adoption rule; solution design §9; spine Stack (DESIGN Typography for 19.A) |
| 20 | Addendum adoption rule; solution design §9 |
| 21 | Solution design §9, §10.3 |
| 22 | EXPERIENCE Component Patterns, Composition and Components |
| 23 | EXPERIENCE Form library |
| 24 | Solution design §13 |
| 25 | Spine Deferred; solution design §10.3, §12; front matter |

## Row 1: the catalog renderer

Applies only if the PO accepts row 1 (AskBoard's own renderer).

### 1.1 Spine, AD-9, Rule, Components, first bullet (phrase)

Current (spine):

```text
No widget imports the renderer library.
```

Replacement:

```text
No widget imports the renderer behind the port, which is AskBoard's own.
```

### 1.2 Solution design, §9, the catalog renderer row

Current (solution design):

```text
| Catalog renderer | json-render 0.21.3 (0.x), or AskBoard's own | `@json-render/mcp`: pins SDK v1 and ext-apps v1 |
```

Replacement:

```text
| Catalog renderer | AskBoard's own, chosen by the renderer spike; json-render 0.21.3 (0.x) passes the rule but was not adopted | `@json-render/mcp`: pins SDK v1 and ext-apps v1 |
```

### 1.A If the PO picks json-render

Leave 1.1 out. Block 1.2's replacement reads instead:

```text
| Catalog renderer | json-render 0.21.3 (0.x), chosen by the renderer spike, with zod's `jitless` set first and its store bound to the draft record | `@json-render/mcp`: pins SDK v1 and ext-apps v1 |
```

And the spine's Stack gains this row after React's (block 14.1 holds zod's):

```text
| `@json-render/core`, `@json-render/react` (catalog renderer behind `CatalogRenderer`) | 0.21.3 |
```

## Row 2: AD-9, an item that throws, and items a container hides

Applies only if the PO accepts row 2.

### 2.1 Spine, AD-9, Rule, Components, fourth bullet

Current (spine):

```text
    - A component is ready when its asynchronous work has settled and its content has been laid out once. A question counts as visible when all its items are ready.
```

Replacement (two bullets):

```text
    - A component is ready when its asynchronous work has settled and its content has been laid out once. A question counts as visible when all its items are ready. A container that hides items, such as Tabs, still mounts them, hidden, so they report ready.
    - Each item renders inside an error boundary. An item that throws shows an error state and reports the error to the board page, and its question never counts as visible (AD-10).
```

## Row 3: AD-9 and AD-15, how a Snapshot carries diagrams

Applies only if the PO accepts row 3. If the PO accepts what a Snapshot carries but not the message path, apply 3.2 to 3.4, leave 3.1's second bullet out, and add the Deferred row of block 25.2.

### 3.1 Spine, AD-9, Rule, Build and assembly: two new bullets

Insert before (spine):

```text
    - The view boots from the `askboard-data` block when there is one.
```

Text:

```text
    - In a Snapshot, `assemble` carries each diagram that has a kept render as its light and dark SVG, which a small chunk shows as a `blob:` image, and leaves that diagram's renderer chunk out. A diagram with no kept render gets its renderer chunk.
    - The view renders each diagram in both themes and sends the SVG text to the board page as a typed view message. `board-host` keeps the latest render per item and board revision, as data: it never serves one as a page (AD-8).
```

### 3.2 Spine, AD-15, Rule, Content, second bullet (phrase)

Current (spine):

```text
each answer carried with its full edited value on its own revision (AD-20).
```

Replacement:

```text
each answer carried with its full edited value on its own revision (AD-20), and the kept light and dark render of each diagram (AD-9).
```

### 3.3 Spine, AD-15, Rule, Content, third bullet

Current (spine):

```text
    - After the data block come the chunks the board uses, their styles, the view CSP as a meta tag and the licence notices of the inlined code.
```

Replacement:

```text
    - After the data block come the chunks the board uses, their styles, the view CSP as a meta tag and the licence notices of the inlined code. A diagram whose renders the data block holds needs no renderer chunk.
```

### 3.4 Solution design, §5.6, step 2

Current (solution design):

```text
2. `assemble` writes the `askboard-data` block first (`<` escaped), with the board documents and the whole log, each answer's full value stored with its revision; then the chunks used, their styles, the view CSP and the licence notices.
```

Replacement:

```text
2. `assemble` writes the `askboard-data` block first (`<` escaped), with the board documents, the whole log, each answer's full value stored with its revision, and the light and dark render `board-host` kept for each diagram; then the chunks used, their styles, the view CSP and the licence notices. A diagram with a kept render needs no renderer chunk: the renderer spike's golden Snapshot was 429,393 bytes with renders against 5,044,979 with the PlantUML chunk.
```

## Row 4: AD-8, the board page's policy names the view's media sources

Applies only if the PO accepts row 4.

### 4.1 Spine, AD-8, Rule, Pages on the board origin, third bullet

Current (spine):

```text
    - The board page's CSP allows scripts and styles by hash, the view chunks' hashes, `connect-src 'self'` and `frame-src 'self'`, which serves only the reading panel's same-origin source view.
```

Replacement:

```text
    - The board page's CSP allows scripts and styles by hash, the view chunks' hashes, `connect-src 'self'` and `frame-src 'self'`, which serves only the reading panel's same-origin source view. It also allows the view's own media sources, `img-src data: blob:` and `font-src data:`: the srcdoc inherits this policy, which would otherwise block the view's diagram images and inlined fonts, and the view's own policy cannot widen it.
```

### 4.2 Solution design, §4.5, the CSP bullet

Current (solution design):

```text
- **CSP.** The view's meta policy and the board page's inherited policy both apply [F29], so the board page lists the view's hashes. `'wasm-unsafe-eval'` appears only for a WASM formula engine; all target browsers support it [F30].
```

Replacement:

```text
- **CSP.** The view's meta policy and the board page's inherited policy both apply [F29], so the board page lists the view's hashes and allows the view's media sources, `img-src data: blob:` and `font-src data:` [F39]. `'wasm-unsafe-eval'` appears only for a WASM formula engine; all target browsers support it [F30].
```

### 4.A If the PO picks `img-src blob:` only

In 4.1, the added sentence reads "It also allows `img-src blob:`, the view's diagram images: the srcdoc inherits this policy, which would otherwise block them." In 4.2, "and allows the view's media sources, `img-src data: blob:` and `font-src data:` [F39]" reads "and allows `img-src blob:` [F39]". Then KaTeX's fonts and the bundled faces stay blocked: rows 13 and 19 need another answer.

## Row 5: AD-8, style writes go through the CSSOM

Applies only if the PO accepts row 5.

### 5.1 Spine, AD-8, Rule, The view sandbox, last bullet

Current (spine):

```text
    - Diagram SVG is shown as `<img src="blob:…">`. The view never holds a token.
```

Replacement (two bullets):

```text
    - Diagram SVG is shown as `<img src="blob:…">`. The view never holds a token.
    - Styles reach the view only by hash or through the CSSOM: `style.cssText`, `insertRule` and constructed stylesheets (`adoptedStyleSheets`), which a hash-only `style-src` allows. Where a library writes a `style` attribute or adds a `<style>` element at run time, or parses markup that holds `style` attributes, AskBoard's view code routes the write through the CSSOM instead: the diagram renders, the modal dialogs and Diff review. The policy never gains `'unsafe-inline'` or `'unsafe-hashes'`.
```

### 5.2 Solution design, §4.5, the Diagrams bullet

Current (solution design):

```text
- **Diagrams** show as `<img src="blob:…">`: hash-only styles block the `style` attributes and `<style>` elements that SVG markup uses [F30], and an image's internal styles escape the page CSP.
```

Replacement (two bullets):

```text
- **Diagrams** show as `<img src="blob:…">`: hash-only styles block the `style` attributes and `<style>` elements that SVG markup uses [F30], and an image's internal styles escape the page CSP.
- **Style writes.** Mermaid and PlantUML write styles while they render, Radix's modal dialogs add a scroll-lock `<style>`, and `@pierre/diffs` builds markup that holds `style` attributes; the hash-only policy blocks all of it. The view routes these writes through the CSSOM and constructed stylesheets, which the policy allows [F40]: three small shims in the view (77, 50 and 81 lines in the renderer spike). A style set this way loads nothing, since `img-src` and `font-src` still bound any `url()`.
```

## Row 6: Radix Select is out

Applies only if the PO accepts row 6.

### 6.1 EXPERIENCE, Composition and Components, Atoms, the Choice row

Current (EXPERIENCE):

```text
| Choice | ChoicePicker | Radio Group, Checkbox, Select (Form pick fields only) |
```

Replacement:

```text
| Choice | ChoicePicker | Radio Group, Checkbox. Not Select: it fails the view CSP (renderer spike), so a Form's single pick from a list is a radio group too |
```

### 6.2 DESIGN, Components, Widgets, the Form row (phrase)

Current (DESIGN):

```text
A single pick from a list may render as a Select, the one place a dropdown appears (F-23, L183, L185); a multiple pick uses checkboxes
```

Replacement:

```text
A single pick from a list renders as radios, with the Choice atom's filter field for a long list: Select, the one dropdown the UX had planned (F-23, L183, L185), fails the view CSP (renderer spike); a multiple pick uses checkboxes
```

## Row 7: S-6, the mode-switch confirmation

Applies only if the PO accepts row 7 (a modal Alert Dialog with the style-element shim). It needs row 5.

### 7.1 EXPERIENCE, Component Patterns, Changes, values and board states, Mode-switch confirmation (phrase)

Current (EXPERIENCE):

```text
Whether it is modal is not recorded; if it is, S-6 applies.
```

Replacement:

```text
It is a modal Alert Dialog. Its scroll lock runs under the view CSP through the view's style-element shim (S-6, settled by the renderer spike).
```

### 7.2 DESIGN, Components, Mode-switch confirmation (phrase)

Current (DESIGN):

```text
shadcn dialog by inheritance, on `{colors.popover}` with `{elevation.shadow-lg}`, subject to the S-6 scroll-lock check if modal.
```

Replacement:

```text
shadcn Alert Dialog by inheritance, modal, on `{colors.popover}` with `{elevation.shadow-lg}`; its scroll lock runs through the view's style-element shim (S-6).
```

### 7.A If the PO picks non-modal

7.1's replacement reads "It is non-modal, like the settings panel: Radix's modal scroll lock does not run under the view CSP (S-6, settled by the renderer spike)." 7.2's reads "shadcn dialog by inheritance, non-modal, on `{colors.popover}` with `{elevation.shadow-lg}` (S-6)."

## Row 8: PlantUML laid out by Smetana

Applies only if the PO accepts row 8.

### 8.1 Solution design, §9, the Diagram row (phrase)

Current (solution design):

```text
`@plantuml/core` 1.2026.9 (MIT npm tarball)
```

Replacement:

```text
`@plantuml/core` 1.2026.9 (MIT npm tarball), `plantuml.js` only, laid out by its Smetana engine (renderer spike)
```

### 8.2 EXPERIENCE, Composition and Components, Component per widget, the Diagram row (phrase)

Current (EXPERIENCE):

```text
Mermaid 12.2.0 and `@plantuml/core` 1.2026.9, rendered to SVG
```

Replacement:

```text
Mermaid 12.2.0 and `@plantuml/core` 1.2026.9 (`plantuml.js` only, with its Smetana layout), rendered to SVG
```

### 8.3 EXPERIENCE, State Patterns, By surface, Board, Cold load (phrase)

This block and 8.4 record the render time, whichever layout the PO picks.

Current (EXPERIENCE):

```text
In the golden case, the PlantUML render is part of loading (a renderer spike item).
```

Replacement:

```text
In the golden case, the PlantUML render is part of loading: 86 to 93% of the time to visible in the renderer spike.
```

### 8.4 EXPERIENCE, Key Flows, Reference scenario: the golden single-question case (phrase)

Current (EXPERIENCE):

```text
the PlantUML render inside "visible" (SM-3, SM-C2), a renderer spike item.
```

Replacement:

```text
the PlantUML render inside "visible" (SM-3, SM-C2), measured by the renderer spike.
```

### 8.A If the PO keeps Graphviz

Leave 8.1 and 8.2 out, apply 8.3 and 8.4, and apply these two phrase blocks.

Current (spine), AD-8, Rule, The view sandbox, the CSP list:

```text
      - `'wasm-unsafe-eval'` only if the formula engine is WASM, never `'unsafe-eval'`, `'unsafe-inline'` or `'unsafe-hashes'`;
```

Replacement:

```text
      - `'wasm-unsafe-eval'` only for a WASM formula engine and for PlantUML's Graphviz (Viz.js), in both policies; never `'unsafe-eval'`, `'unsafe-inline'` or `'unsafe-hashes'`;
```

Current (solution design), §4.5, the CSP bullet (phrase; after 4.2 if row 4 is accepted):

```text
`'wasm-unsafe-eval'` appears only for a WASM formula engine;
```

Replacement:

```text
`'wasm-unsafe-eval'` appears only for a WASM formula engine and for PlantUML's Graphviz;
```

## Row 9: the licences of the files inside `@plantuml/core`

Applies only if the PO accepts row 9.

### 9.1 Solution design, §9, a paragraph after "Excluded traps"

Insert after (solution design):

```text
The addendum's avoid list (tldraw, Bryntum, Highcharts Gantt and others) stands.
```

Text (a new paragraph):

```text
**Inside `@plantuml/core`** (renderer spike). Only `plantuml.js` is bundled: `viz-global.js` (Viz.js, MIT; Graphviz, EPL-2.0; Expat, MIT), `emoji.js` (Twemoji graphics, CC-BY-4.0) and `themes.js` never are. `plantuml.js` compiles in TeaVM (Apache-2.0), Brotli (MIT), CafeUndZopfli (Apache-2.0) and ASCIIMathML (MIT), whose licence texts the tarball lacks: the PlantUML chunk's notices carry them, taken from their repositories. The rule's stars and activity criteria apply to the package AskBoard adopts, not to code vendored inside it.
```

### 9.A If the PO keeps Graphviz (row 8's alternative)

9.1's text reads instead: "**Inside `@plantuml/core`** (renderer spike). `plantuml.js` and `viz-global.js` are bundled; `emoji.js` (Twemoji graphics, CC-BY-4.0) and `themes.js` never are. `viz-global.js` holds Viz.js (MIT), Graphviz (EPL-2.0) and Expat (MIT); `plantuml.js` compiles in TeaVM (Apache-2.0), Brotli (MIT), CafeUndZopfli (Apache-2.0) and ASCIIMathML (MIT). The tarball lacks their licence texts: the PlantUML chunk's notices carry them, taken from their repositories. Graphviz as Viz.js builds it counts as an unmodified EPL-2.0 dependency. The rule's stars and activity criteria apply to the package AskBoard adopts, not to code vendored inside it."

And the addendum's licence bullet changes (with row 19 accepted too, use the second replacement).

Current (addendum), Widget building blocks, Adoption rule, Licence (phrase):

```text
MPL-2.0 or EPL-2.0 only for unmodified dependencies;
```

Replacement, without row 19:

```text
MPL-2.0 or EPL-2.0 only for unmodified dependencies (Graphviz as Viz.js compiles it, inside `@plantuml/core`, counts as one);
```

Replacement, with row 19:

```text
MPL-2.0 or EPL-2.0 only for unmodified dependencies (Graphviz as Viz.js compiles it, inside `@plantuml/core`, counts as one), and SIL OFL-1.1 only for unmodified font files shipped with their licence text;
```

## Row 10: PlantUML's resources and error images

Applies only if the PO accepts row 10.

### 10.1 Spine, AD-8, Rule, Content, second bullet

Current (spine):

```text
    - Script runs only in code bundled with AskBoard. A molecule or ask that carries code is refused.
```

Replacement:

```text
    - Script runs only in code bundled with AskBoard. A molecule or ask that carries code is refused. No view code creates a script element with a URL: a diagram renderer that loads resources that way gets a loader that refuses them, since Firefox runs a relative `<script src>` from a Snapshot opened from `file://` despite a hash-only `script-src`.
```

### 10.2 Solution design, §9, Excluded traps (phrase)

Current (solution design):

```text
with its sponsored-message images suppressed.
```

Replacement:

```text
with its loaders refusing every resource (themes, standard library, emoji, icons, files) and its error and crash images turned into render errors; 1.2026.9 shows no sponsored message (renderer spike).
```

## Row 11: Mermaid's configuration

Applies only if the PO accepts row 11.

### 11.1 EXPERIENCE, Composition and Components, Component per widget, the Diagram row (phrase)

Current (EXPERIENCE):

```text
Mermaid with `htmlLabels: false`
```

Replacement:

```text
Mermaid built without elkjs, with `layout: 'dagre'`, top-level `htmlLabels: false`, `securityLevel: 'strict'`, and its layout and theme keys in `secure`, so an agent's directive cannot change them
```

### 11.2 EXPERIENCE, the same row, its spike-check cell (phrase)

Current (EXPERIENCE):

```text
S-1 (elkjs); Mermaid text measurement; PlantUML render time |
```

Replacement:

```text
S-1, Mermaid text measurement and PlantUML render time: settled by the renderer spike |
```

### 11.3 Solution design, §9, the Diagram row (phrase)

Current (solution design):

```text
| Diagram | Mermaid 12.2.0;
```

Replacement:

```text
| Diagram | Mermaid 12.2.0, built without elkjs (checked in CI);
```

### 11.4 Solution design, §9, Excluded traps (phrase)

Current (solution design):

```text
elkjs (EPL or GPL);
```

Replacement:

```text
elkjs (EPL or GPL; stripped from Mermaid's build, with `layout: 'dagre'` set, and checked in CI);
```

## Row 12: Diff review's highlighting

Applies only if the PO accepts row 12 (highlighting on).

### 12.1 DESIGN, Colors, Syntax highlighting

Current (DESIGN):

```text
Code in Diff review and every source view is highlighted through classes, never inline colour styles, which the view CSP drops (L160). The highlighter's token classes map onto five tokens: `{colors.syntax-keyword}`, `{colors.syntax-string}`, `{colors.syntax-number}` (numbers, booleans, constants), `{colors.syntax-function}` (function, class and type names) and `{colors.syntax-comment}`. Everything else is `{colors.foreground}`. Each token is checked as text on `card`, `diff-add` and `diff-del` (Contrast). Highlighting may be off in the first version if the renderer spike fails it (L160, F-32). The palette is confirmed (L197).
```

Replacement:

```text
Code in Diff review and every source view is highlighted through five tokens, never through colour styles written into markup, which the view CSP drops (L160). The highlighter's token scopes map onto them: `{colors.syntax-keyword}`, `{colors.syntax-string}`, `{colors.syntax-number}` (numbers, booleans, constants), `{colors.syntax-function}` (function, class and type names) and `{colors.syntax-comment}`. Everything else is `{colors.foreground}`. In Diff review, `@pierre/diffs` gives no token classes: its CSS-variables theme points each scope at the token's CSS variable, applied through the CSSOM, and the `.dark` class re-points them with no re-render (renderer spike). Each token is checked as text on `card`, `diff-add` and `diff-del` (Contrast). Highlighting is on in the first version, for a fixed list of languages (renderer spike). The palette is confirmed (L197).
```

### 12.2 EXPERIENCE, Composition and Components, Component per widget, the Diff review row (phrase)

Current (EXPERIENCE):

```text
Syntax highlighting under the CSP: class-based, with DESIGN.md's `syntax-` colour tokens, or off in v1 |
```

Replacement:

```text
Syntax highlighting under the CSP: on, through DESIGN.md's `syntax-` colour tokens as CSS variables and the view's markup shim, for a fixed list of languages (renderer spike) |
```

### 12.A If the PO picks highlighting off

12.1's last two sentences read "Highlighting is off in the first version (L160, F-32; renderer spike): `@pierre/diffs` gives no token classes. The palette is confirmed (L197)." 12.2's replacement reads "Syntax highlighting off in v1 (renderer spike); the view's markup shim is still needed |".

## Row 13: MathLive not in the first version

Applies only if the PO accepts row 13.

### 13.1 EXPERIENCE, Composition and Components, Component per widget, the LaTeX row (phrase)

Current (EXPERIENCE):

```text
MathLive 0.111.1 optional
```

Replacement:

```text
MathLive is not in the first version: in the sandboxed view it needs three changes (renderer spike)
```

### 13.2 Solution design, §9, the LaTeX row

Current (solution design):

```text
| LaTeX | KaTeX 0.19.1; MathLive 0.111.1 | — |
```

Replacement:

```text
| LaTeX | KaTeX 0.19.1; MathLive 0.111.1 (passes; not in the first version, renderer spike) | — |
```

### 13.A If the PO keeps MathLive

13.1's replacement reads "MathLive 0.111.1 optional, with its virtual keyboard mounted in the view (`sandboxed` policy), the view's markup shim and a font chunk it shares with KaTeX (renderer spike)". Leave 13.2 out. Add ``| `mathlive` (LaTeX editing) | 0.111.1 |`` to the Stack rows of block 14.1. In block 18.1's replacement, "library chunks for code that several components use" reads "library chunks for code that several components use, the font files KaTeX and MathLive share included".

## Row 14: Stack pins for the view's components

Applies only if the PO accepts row 14. Leave out a row whose condition the PO did not accept (`findings.md`, Stack pins).

### 14.1 Spine, Stack, rows after `@dagrejs/dagre`

Insert after (spine):

```text
| `@dagrejs/dagre` (Graph widget initial layout and auto-layout; elkjs stays excluded) | 3.1.3 |
```

Text:

```text
| `radix-ui` (view primitives: Radio Group, Checkbox, Switch, Tabs, Slider, Toggle Group, Popover, Dialog, Alert Dialog; not Select) | 1.8.1 |
| `react-day-picker` (the Date Picker's calendar) | 10.0.2 |
| `markdown-it` (Markdown, `html: false`) | 15.0.3 |
| `dompurify` (the Markdown sanitizer) | 3.4.17 |
| `katex` (LaTeX) | 0.19.1 |
| `@tanstack/react-table` (Table, Tree, Spreadsheet, the Gantt's grid) | 9.3.1 |
| `@atlaskit/pragmatic-drag-and-drop` (Ranking, Kanban, Tree) | 4.0.0 |
| `echarts` (Chart, canvas renderer) | 6.1.0 |
| `@xyflow/react` (Graph) | 12.12.0 |
| `mermaid` (Diagram; built without elkjs) | 12.2.0 |
| `@plantuml/core` (Diagram; the MIT npm tarball, `plantuml.js` only) | 1.2026.9 |
| `@pierre/diffs` (Diff review) | 1.6.2 |
| `@rjsf/core`, `@rjsf/utils` (Form) | 6.11.0 |
| `tailwindcss`, `@tailwindcss/cli` (build-time styles) | 4.3.3 |
| `@modelcontextprotocol/core`, `@modelcontextprotocol/client` (ext-apps' peers) | 2.4.0 |
| `zod` (ext-apps' peer, with `jitless` set first) | 4.6.7 |
```

With row 19 accepted, add ``| `@fontsource-variable/inter` or `@fontsource/inter`, `@fontsource/jetbrains-mono` (DESIGN.md's faces; Fontsource's stars exception) | 5.3.0 |``, naming the Inter package the `view` epic picks. With 1.A or 13.A, add their rows.

## Row 15: Tailwind's `dark:` variant

Applies only if the PO accepts row 15.

### 15.1 EXPERIENCE, Composition and Components, Dark theme (phrase)

Current (EXPERIENCE):

```text
No theme library. The DESIGN.md tokens, light and `-dark`, are CSS variables, and a `.dark` class on the view root switches them.
```

Replacement:

```text
No theme library. The DESIGN.md tokens, light and `-dark`, are CSS variables, and a `.dark` class on the view root switches them. Tailwind's `dark:` variant is set to follow that class (`@custom-variant dark (&:where(.dark, .dark *))`), since by default it follows `prefers-color-scheme` (renderer spike).
```

## Row 16: ext-apps' `App` in the view

Applies only if the PO accepts row 16 (keep `App`).

### 16.1 Spine, AD-9, Rule, Build and assembly, the boot bullet (phrase)

Current (spine):

```text
It starts the view-protocol handshake only when it has a parent host.
```

Replacement:

```text
It starts the view-protocol handshake only when it has a parent host. A Snapshot, which has none, carries no view-protocol code (ext-apps' `App`).
```

### 16.A If the PO picks AskBoard's own channel

Apply 16.1, with "(ext-apps' `App`)" read as "(the view's channel)", and this block.

Current (spine), AD-8, Rule, Talking to the outside, first bullet (phrase):

```text
The view talks to the board page with the ext-apps 2.x message set and its `App` and `AppBridge` classes.
```

Replacement:

```text
The view talks to the board page with the ext-apps 2.x message set: the board page through `AppBridge`, the view through AskBoard's own channel, which carries no zod or MCP client.
```

## Row 17: the caught-probe rule for CI

Applies only if the PO accepts row 17.

### 17.1 Spine, Consistency Conventions, Tests, CI failures (phrase)

Current (spine):

```text
a licence outside the adoption rule (AD-19). **CI runs:**
```

Replacement:

```text
a licence outside the adoption rule (AD-19); any CSP violation in a browser test, a caught `eval` probe included, collected from the view, the board page and the console's CSP lines (zod's `jitless` is set before any module that uses zod loads). **CI runs:**
```

## Row 18: AD-9's manifest and the view build's CI checks

Applies only if the PO accepts row 18.

### 18.1 Spine, AD-9, Rule, Build and assembly, first bullet

Current (spine):

```text
    - At build time, `view` publishes a manifest: a shell chunk and one chunk per catalog component, each with its SHA-256, its styles and the licence notices of the code it contains. Nothing is bundled at run time.
```

Replacement:

```text
    - At build time, `view` publishes a manifest: a shell chunk, library chunks for code that several components use, and one chunk per catalog component, each with its SHA-256, its styles, the licence notices of the code it contains and the chunks it needs. Nothing is bundled at run time. Every chunk is a classic script, so a chunk that holds `import.meta` fails the build.
```

### 18.2 Spine, AD-9, Rule, Build and assembly, second bullet (phrase)

Current (spine):

```text
It inlines the shell and the chunks the board uses.
```

Replacement:

```text
It inlines the shell and the chunks the board's items need, with the library chunks those need in turn.
```

### 18.3 Spine, Consistency Conventions, Tests, CI failures (phrase)

Current (spine):

```text
a changed `tools/list` order;
```

Replacement:

```text
a changed `tools/list` order; a view chunk that grows past a set margin over the previous build without the change saying so, or that holds `import.meta`, an elkjs input or an elkjs identifier;
```

### 18.4 Spine, Consistency Conventions, Tests, CI runs (phrase)

Current (spine):

```text
a view `fetch` that fails);
```

Replacement:

```text
a view `fetch` that fails, an item's box unchanged 1 s after its question is visible, and PlantUML's images for an empty source and a syntax error turned into render errors);
```

## Row 19: the fonts' licence and source

Applies only if the PO accepts row 19.

### 19.1 Addendum, Widget building blocks, Adoption rule, Licence (phrase)

With 9.A accepted too, use 9.A's combined replacement instead.

Current (addendum):

```text
MPL-2.0 or EPL-2.0 only for unmodified dependencies;
```

Replacement:

```text
MPL-2.0 or EPL-2.0 only for unmodified dependencies, and SIL OFL-1.1 only for unmodified font files shipped with their licence text;
```

### 19.2 Solution design, §9, Adoption rule in brief, Licence (phrase)

Current (solution design):

```text
MPL-2.0 or EPL-2.0 only unmodified;
```

Replacement:

```text
MPL-2.0 or EPL-2.0 only unmodified, and OFL-1.1 only for unmodified font files;
```

### 19.3 Solution design, §9, Named exceptions

Row 20's tagged sentence stays only if row 20 is accepted.

Current (solution design):

```text
**Named exceptions.** Only one: the LGPL runtime components of the Bun executable (§4.10), conditional on the PRD change. No stars exception is named yet; Annotorious, git-diff-view or SVAR Gantt would need one if the final UX documents pick them.
```

Replacement:

```text
**Named exceptions.** Licence exceptions: the LGPL runtime components of the Bun executable (§4.10), conditional on the PRD change; `argparse` (PSF-2.0), which markdown-it's command-line tool needs and no view chunk contains [row 20]. A stars exception: Fontsource, whose packages `@fontsource/inter` and `@fontsource/jetbrains-mono` carry DESIGN.md's faces; their repository `fontsource/font-files` had 509 stars on 2026-10-30 and the Fontsource project 6,249, and both pass the activity criterion (renderer spike). Annotorious, git-diff-view or SVAR Gantt would need one if the final UX documents pick them.
```

### 19.A If the PO picks no bundled faces

Leave 19.1 to 19.3 out, except 19.3's `argparse` sentence if row 20 is accepted. Then apply this block.

Current (DESIGN), Typography:

```text
**Faces.** The UI face is **Inter**, and **JetBrains Mono** sets code, paths and values. Both are under the SIL Open Font License 1.1 (L131). Both are **bundled**, because a board loads nothing from the network (AD-8) and a Snapshot opens offline (FR-27, L38). The view's CSP admits fonts only as `data:` URLs, so the faces are inlined into every board's view and every Snapshot (AD-8, AD-9; F-88).
```

Replacement:

```text
**Faces.** The first version bundles no faces: the UI uses the system sans-serif stack, and code, paths and values the system monospace stack, through `--font-sans` and `--font-mono`. Inter and JetBrains Mono (SIL Open Font License 1.1, L131) had no source that met the adoption rule (renderer spike). A board loads nothing from the network (AD-8) and a Snapshot opens offline (FR-27, L38), so a face bundled later is inlined as a `data:` URL into every board's view and every Snapshot (AD-8, AD-9; F-88).
```

## Row 20: the licence check's findings

Applies only if the PO accepts row 20. The `view` epic changes `tools/check-licences.ts` (the Unlicense in its permissive set, bundled dependencies of another platform's package) and `tools/licence-overrides.json` (`khroma`, citing its licence file); this draft changes neither.

### 20.1 Addendum, Widget building blocks, Adoption rule: a licence exception

Insert after (addendum):

```text
Further traps: the bpmn-js watermark, elkjs (EPL or GPL), BlockNote XL (GPL).
```

Text (a new bullet):

```text
- **Licence exceptions:** `argparse` (PSF-2.0), which markdown-it's command-line tool needs and no shipped bundle contains (renderer spike).
```

### 20.2 Solution design, §9, Adoption rule in brief, Licence (phrase)

Current (solution design):

```text
permissive by default (MIT, Apache-2.0, BSD);
```

Replacement:

```text
permissive by default (MIT, Apache-2.0, BSD, and the like: ISC, 0BSD, the Unlicense);
```

Block 19.3 carries row 20's sentence in "Named exceptions".

## Row 21: S-2 and S-3 facts, and §9's status table

Applies only if the PO accepts row 21.

### 21.1 Solution design, §9, the status table's introduction

Current (solution design):

```text
**Component status on 2026-10-27** (research-stack §C). The final UX documents choose the components; this table only shows what the rule admits today.
```

Replacement:

```text
**Component status on 2026-10-27, corrected by the renderer spike on 2026-10-29** (research-stack §C; the spike's `evidence/adoption.json`). The final UX documents choose the components; this table only shows what the rule admits.
```

### 21.2 Solution design, §9, the Tree, Table, Spreadsheet grid row

Current (solution design):

```text
| Tree, Table, Spreadsheet grid | react-arborist 4.0.1; TanStack Table 9.3.1 | — |
```

Replacement:

```text
| Tree, Table, Spreadsheet grid | TanStack Table 9.3.1 | react-arborist 4.0.1: its peer react-dnd 16 last released on 2022-04-19 |
```

### 21.3 Solution design, §9, the Gantt, Timeline row

Current (solution design):

```text
| Gantt, Timeline | DHTMLX Gantt Community 10.0.3 (Community features); Frappe Gantt 1.2.2 (push window ends 2026-12-18); vis-timeline 8.5.6 | SVAR Gantt: 215 and 260 stars |
```

Replacement:

```text
| Gantt, Timeline | DHTMLX Gantt Community 10.0.3 (Community features); Frappe Gantt 1.2.2 (push window ends 2026-12-18) | SVAR Gantt: 215 and 260 stars; vis-timeline 8.5.6: its peer `@egjs/hammerjs` has 45 stars and was last pushed on 2021-02-01 |
```

### 21.4 Solution design, §10.3, S-2 (phrase)

Current (solution design):

```text
react-dnd's last release (2022-06-25)
```

Replacement:

```text
react-dnd's last release (2022-04-19; the UX run read 2022-06-25)
```

### 21.5 Solution design, §10.3, S-3 (phrase)

Current (solution design):

```text
**S-3, vis-timeline 8.5.6** depends on `@egjs/hammerjs`,
```

Replacement:

```text
**S-3, vis-timeline 8.5.6** has `@egjs/hammerjs` as a peer dependency,
```

## Row 22: the UX spike items

Applies only if the PO accepts row 22. Blocks 22.2, 22.3 and 22.5 apply only once task 6.2 records a pass in Chrome and Safari.

### 22.1 EXPERIENCE, Component Patterns, Widgets, Scale (phrase)

Current (EXPERIENCE):

```text
Whether a click on an unset slider's track sets a value is a spike item.
```

Replacement:

```text
A click on an unset slider's track sets the value at that point: Radix's Slider sets none there, so AskBoard's sets it itself (renderer spike).
```

### 22.2 EXPERIENCE, Composition and Components, Component per widget, the Ranking row

Current (EXPERIENCE):

```text
| Ranking | Own sortable list on Pragmatic drag and drop 4.0.0 | "Move up" and "Move down", the drop indicator, "Keep this order" | Native drag in the sandboxed frame |
```

Replacement:

```text
| Ranking | Own sortable list on Pragmatic drag and drop 4.0.0 | "Move up" and "Move down", the drop indicator, "Keep this order" | Native drag in the sandboxed frame: works (renderer spike) |
```

### 22.3 EXPERIENCE, the same table, the Kanban row

Current (EXPERIENCE):

```text
| Kanban | Own columns of cards on Pragmatic drag and drop 4.0.0 | A keyboard "Move to…" menu; columns mapped to a field | Native drag in the sandboxed frame |
```

Replacement:

```text
| Kanban | Own columns of cards on Pragmatic drag and drop 4.0.0 | A keyboard "Move to…" menu; columns mapped to a field | Native drag in the sandboxed frame: works (renderer spike) |
```

### 22.4 EXPERIENCE, the same table, the Scale row (phrase)

Current (EXPERIENCE):

```text
| The rating mode, the unset state, locale labels | The Slider's unset state |
```

Replacement:

```text
| The rating mode, the unset state, locale labels | The Slider's unset state: AskBoard sets the first click's value (renderer spike) |
```

### 22.5 EXPERIENCE, Composition and Components, Drag and drop (phrase)

Current (EXPERIENCE):

```text
Native drag inside the sandboxed frame is a spike item (L160, TC §2.2).
```

Replacement:

```text
Native drag works inside the sandboxed frame, in every engine the renderer spike drove and by hand in Chrome and Safari (L160, TC §2.2).
```

### 22.6 EXPERIENCE, Composition and Components, Dark theme (phrase)

Current (EXPERIENCE):

```text
Every component is audited for storage access at start-up (a spike item).
```

Replacement:

```text
No component the renderer spike ran reads browser storage or starts a worker (S-5).
```

## Row 23: the Form library's constraints

Applies only if the PO accepts row 23.

### 23.1 EXPERIENCE, Composition and Components, Form library, item 2

Current (EXPERIENCE):

```text
2. `tagName="div"`, and the submit button is never rendered. Enter never submits (S-7).
```

Replacement:

```text
2. `tagName="div"`, and the submit button is never rendered. Enter never submits (S-7). The sandbox alone would not stop it: WebKit fires a `<form>`'s submit event inside the sandbox, which runs RJSF's `onSubmit` (renderer spike).
```

### 23.2 EXPERIENCE, the same list, two items after item 5

Insert after (EXPERIENCE):

```text
5. Neither `@rjsf/shadcn` (it brings cmdk, S-5) nor `@rjsf/validator-ajv8` (it compiles with `eval`) is used.
```

Text:

```text
6. `showErrorList={false}`: errors show only under their fields.
7. The draft record drives the Form's `formData` (AD-9). RJSF keeps its own copy in state, which AskBoard never reads as the value.
```

## Row 24: §13, the facts the spike found

Applies only if the PO accepts row 24. A fact the PO rejects is left out, and the others keep their IDs.

### 24.1 Solution design, §13, introduction

If the mod delivery spike's block 17.1 has been applied, append this sentence after the one it added.

Current (solution design):

```text
All facts were checked on 2026-10-27. Status is empty when a primary source states the fact; otherwise it marks a secondary source, or an unverified fact with the spike that checks it. "research-cc" and "research-stack" are the research files that travel with the spine.
```

Replacement:

```text
All facts were checked on 2026-10-27. Status is empty when a primary source states the fact; otherwise it marks a secondary source, or an unverified fact with the spike that checks it. "research-cc" and "research-stack" are the research files that travel with the spine. F39 to F47 come from the renderer spike's runs, on 2026-10-29 and 2026-10-30, which also checked F28 and F30; its findings are in the archived OpenSpec change `spike-renderer`.
```

### 24.2 Solution design, §13, F28 and F30

Current (solution design):

```text
| F28 | ext-apps 2.0.4 has no supported host; a web host MUST use a sandbox proxy on another origin; its classes accept an opaque-origin view | AD-8 | https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx | |
```

Replacement:

```text
| F28 | ext-apps 2.0.4 has no supported host; a web host MUST use a sandbox proxy on another origin; its classes accept an opaque-origin view | AD-8 | https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx | Opaque-origin view verified: `App` reaches `AppBridge` in every engine, with zod's `jitless` set first (renderer spike) |
```

Current (solution design):

```text
| F30 | Hash-only `style-src` blocks `style` attributes and injected `<style>`; `'wasm-unsafe-eval'` works in Chrome 97, Firefox 102, Safari 16 | AD-8, AD-13 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy | |
```

Replacement:

```text
| F30 | Hash-only `style-src` blocks `style` attributes and injected `<style>`; `'wasm-unsafe-eval'` works in Chrome 97, Firefox 102, Safari 16 | AD-8, AD-13 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy | Blocking verified in Chromium, Firefox and WebKit (renderer spike); CSSOM writes pass (F40) |
```

### 24.3 Solution design, §13, new rows after F38

Insert after (solution design):

```text
| F38 | Agent Skills: `name` up to 64 characters, `description` up to 1,024 | AD-18 | https://agentskills.io/specification | |
```

Text:

```text
| F39 | The view's srcdoc inherits the board page's policy, so a `blob:` image or `data:` font that the view's policy allows is blocked unless the board page's policy allows it too | AD-8 | Renderer spike, runs `c3c4`, `c3c4-blob`, `matrix`, `matrix-media` | Verified |
| F40 | A hash-only `style-src` lets CSSOM writes (`style.cssText`, `insertRule`) and constructed stylesheets (`adoptedStyleSheets`) through, in Chromium, Firefox and WebKit | AD-8 | Renderer spike, run `negative` and the shims' runs | Verified |
| F41 | Chromium checks a `<style>` against `style-src` when it is connected, whatever its `type`; WebKit reports a `style-src-attr` violation for every native `<select>` it creates, reports a blocked `eval` only to the parent page, and reports a refused WebAssembly compile only in the console; Firefox blocks a sandboxed `<form>` submission silently, and WebKit fires its submit event | AD-8 | Renderer spike, runs `matrix`, `negative`, `plantuml`, `form` | Verified |
| F42 | Firefox runs a relative `<script src>` from a `file://` page despite a hash-only `script-src` (Firefox 157 and 124) | AD-8, AD-15 | Renderer spike, `tools/check-file-scripts.ts` | Verified |
| F43 | Mermaid 12.2.0: ELK is the default layout; the default `secure` list leaves out `htmlLabels`, `layout`, `theme`, `themeVariables`, `themeCSS` and `fontFamily`; `securityLevel: 'sandbox'` frames a `data:` URL; it brings its own KaTeX 0.18 | AD-8 | Mermaid 12.2.0's `dist/config.type.d.ts` and chunks; renderer spike, run `mermaid` | Verified |
| F44 | `@plantuml/core` 1.2026.9: Graphviz comes as Viz.js WebAssembly and needs `'wasm-unsafe-eval'`, and without it Smetana lays out; no sponsored message, but error and crash images; resources load by script tag unless the host supplies loaders; the tarball lacks the licence texts of the code compiled into it | AD-8, AD-19 | The tarball's `README.md`, `GITHUB_INTEGRATION.md`, `LICENSE`; renderer spike, runs `plantuml-wasm`, `sponsor`, `c3c4` | Verified |
| F45 | `@pierre/diffs` 1.6.2 writes token colours and layout as `style` attributes into markup it parses; its `useCSSClasses` option is declared but not read | AD-8 | Its `dist/utils/tokenStyle.js`, `types.d.ts`; renderer spike, run `diffs` | Verified |
| F46 | json-render 0.21.3: its store can be bound to an outside record; its error boundary renders nothing and tells only the console; zod 4 probes `new Function` unless `jitless` is set | AD-9 | `@json-render/react`'s README and `dist/index.mjs`; zod's `v4/core/util.js`; renderer spike, runs `c2`, `renderers` | Verified |
| F47 | Bun 1.4.4: a bundler plugin whose `onResolve` matches every import makes the bundler ignore the packages' `sideEffects` | AD-9 | Renderer spike, `findings.md`, "Sizes" | Verified |
```

## Row 25: the Deferred row, §12, §10.3's outcome and the front matter

Applies only if the PO accepts row 25, row by row as in `findings.md` ("Deferred and open items").

### 25.1 Spine, Deferred, the catalog renderer row: remove

Current (spine), removed:

```text
| Catalog renderer behind `CatalogRenderer` (json-render 0.21 or own); Mermaid and PlantUML rendering inside the view bundle | AD-9 isolates widgets from it; AD-8's CSP constrains it | Renderer spike, with UX final |
```

### 25.2 Spine, Deferred, a new row (only if row 3 is accepted without its message path)

Insert after (spine):

```text
| Formula engine (IronCalc or own restricted evaluator) and the content of the function whitelist | AD-13 fixes the port, the grammar and the interim function set | Formula spike |
```

Text:

```text
| How diagram renders reach `snapshot` (sent by the view through the board page, or rendered when the Snapshot is taken) | AD-9 and AD-15 fix what a Snapshot carries; until then a Snapshot inlines the renderer chunks | `view` and `snapshot` epics |
```

### 25.3 Solution design, §12, owners (phrase)

If the mod delivery spike's block 18.4 has been applied, remove the same phrase from the row it left.

Current (solution design):

```text
catalog renderer with Mermaid and PlantUML (renderer, with UX); 
```

Replacement: nothing (the phrase is removed).

### 25.4 Solution design, §10.3, a closing paragraph

Insert after (solution design):

```text
**What changes.** The renderer row closes and the Stack gains a pin, unless AskBoard's own wins; a component failing the CSP is out.
```

Text (drop each `[row N]` tag; replace or drop a sentence whose row was not accepted):

```text
**Outcome (OpenSpec change `spike-renderer`, 2026-10-29 and 2026-10-30).** AskBoard's own renderer stands behind `CatalogRenderer`: json-render 0.21.3 passed criteria 1 and 2 only with zod's `jitless`, and added about 158 KB to every board [row 1]. Mermaid and PlantUML render inside the bundle with no request in Chromium, Firefox, WebKit, Chrome and Edge, on macOS and on Linux arm64, with PlantUML's loaders refusing every resource (AD-8) [row 10]. Diagram images and inlined fonts need the board page's policy to allow the view's media sources (AD-8) [row 4]. The libraries' own style writes go through the CSSOM, by three shims in the view, so the policy stays hash-only (AD-8) [row 5]. Radix Select fails the CSP in Chromium, Chrome, Edge and WebKit and is out: a Form's single pick is a radio group [row 6]. PlantUML ships without Graphviz, laid out by Smetana [row 8], and Mermaid without elkjs, its configuration keys in `secure` [row 11]. Diff review highlights through the `syntax-*` tokens as CSS variables, for a fixed list of languages [row 12]; MathLive is not in the first version [row 13]. A Snapshot carries each diagram's light and dark render instead of its renderer: the golden Snapshot is 429,393 bytes instead of 5,044,979 (AD-9, AD-15) [row 3]. In the golden case, PlantUML takes 86 to 93% of the time to visible, which was 235.8 to 504 ms (median, macOS). The S-checks hold, and S-2's react-dnd date is corrected [row 21]. The PO judged the screenshots and dragged by hand in Chrome and Safari on <date> (tasks 6.1, 6.2). The change's findings hold the measurements.
```

### 25.5 Front matter

- Spine, `sources:`, add: `  - 'OpenSpec change spike-renderer, findings.md: the view CSP, the catalog renderer and the diagram renderers in Chromium, Firefox, WebKit, Chrome and Edge (2026-10-29 and 2026-10-30)'`.
- Solution design, `sources:`, add the same line.
- Every file changed (spine, solution design, EXPERIENCE, DESIGN, addendum): `updated:` set to the apply date.
