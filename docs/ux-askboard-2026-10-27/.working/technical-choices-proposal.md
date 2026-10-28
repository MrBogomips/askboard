---
title: AskBoard technical choices proposal — atoms and layouts, widget components, form library
run: ux-askboard-2026-10-27
status: proposal, for the user's approval or correction; nothing here is decided
created: 2026-10-27
sources:
  - .memlog.md (this run)
  - EXPERIENCE.md, DESIGN.md (draft spines)
  - extract-addendum.md §1, extract-visual-companion.md §3, §4
  - architecture-change-requests.md
  - architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md (AD-7, AD-8, AD-9, AD-12, AD-13, AD-20, Stack)
  - architecture-askboard-2026-10-27/SOLUTION-DESIGN.md (§9, §10.2, §10.3)
  - architecture-askboard-2026-10-27/research-stack-2026-10-27.md §C
  - external facts checked on 2026-10-27 (Sources at the end)
---

# AskBoard technical choices proposal

The final architecture gives three choices to the UX documents: the atom and layout set, the component behind each widget, and the form library (SOLUTION-DESIGN §1, §9; spine Deferred table). The renderer spike (§10.3) needs all three. This file proposes them. It decides nothing: the user approves or corrects, and the outcome then goes into the spines through the run's normal Finalize step.

**How to read it.**

- **[CALL]** marks a point that needs the user's call. Every [CALL] is repeated in **Decisions for the user** at the end.
- **[OPTIONAL]** marks an item that the set can do without.
- **(v)** marks a fact I checked today against a primary source: the npm registry, the GitHub REST API, the project's own docs or source. **(inferred)** marks my reading of source code that the spike must confirm.
- `Lnn` is line nn of this run's `.memlog.md`. AD, FR, NFR and the other IDs are as in the spines.
- Versions come from the architecture's pins and §9 status table. Where my check differs from §9, the difference is reported (Part 2.5), not applied.

## 0. Constraints that decide the components

These come from the architecture and the memlog. The last group is what actually eliminates components, so it is spelled out.

- **Agent content is data.** Only bundled code runs. Every component renders from the board document, the draft record and the compute graph, keeps no edit state of its own, makes no network call, and reports user actions as typed view messages (AD-8, AD-9, NFR-5).
- **The data format is AskBoard's own** (AD-7). A2UI is a future preference only, as an inbound translator. So no component may need the agent to write that component's own configuration: AskBoard maps its own format to each component.
- **Adoption rule** (SOLUTION-DESIGN §9): permissive licence; at least 1,000 stars, or a named exception that waives only stars; a push since 2026-04-27, a release since 2025-10-27, not archived.
- **Answers.** Nothing preselected and nothing prefilled counts as an answer (AD-10, L61). A review widget reports untouched agent content as unchanged.
- **Derived values** (field checks, roll-ups, PERT, CPM, scores, totals, margins) are AskBoard's own, computed by the compute graph (AD-13, FR-12). Gantt dates, critical path and baseline are never a paid tier (FR-12, R6, L73).
- **Widget scope** (L67 to L76): the journey widgets get their decided extras; every other widget stays at its FR-11 minimum, which is also its ceiling; change highlighting is board-wide and display only.
- **What the view's sandbox and CSP do to third-party code** (AD-8). These five effects rule components in or out:
  1. **No inline styles from markup.** `style-src` allows only the hashes of the inlined chunks. So a `style="…"` attribute that a library writes into an HTML string and sets through `innerHTML` is dropped, and so is any `<style>` element injected at run time with dynamic content. Styles set through the CSSOM (`el.style.left = …`, React's `style` prop, `cssText`) are not affected. Constructable stylesheets (`adoptedStyleSheets`) are, as far as I know, not treated as inline styles, but the spike must confirm it.
  2. **No `eval`.** `new Function` and `eval` are blocked. Only `'wasm-unsafe-eval'` may appear, and only for a WASM formula engine.
  3. **No storage.** The view has an opaque origin, so `localStorage` throws a `SecurityError`. Any library that touches Web Storage at start-up can crash the view (AD-20 also bans storage).
  4. **No form submission.** The sandbox has no `allow-forms`. Per the HTML spec, submission aborts before the `submit` event fires, and engines have differed on this (Mozilla bug 1287989). A component must never rely on submitting a `<form>`.
  5. **No remote loading.** `img-src data: blob:` and `font-src data:` only. Fonts must be inlined as `data:` URLs (DESIGN, Typography). Diagram SVG is shown as `<img src="blob:…">`, so the view never edits the displayed diagram's DOM.

## 1. Atoms and layouts

### 1.1 The two references

**A2UI basic catalogue v1** (protocol version 1.0, "a candidate for becoming stable"; catalogue last changed 2026-10-08) (v). It has 18 components:
- display: Text (variants `caption` and `body`; "simple Markdown … without HTML, images, or links"), Image, Icon, Video, AudioPlayer;
- layout: Row, Column, List, Card, Tabs, Modal, Divider;
- input: Button, TextField (`shortText`, `longText`, `number`, `obscured`), CheckBox, ChoicePicker (`mutuallyExclusive` or `multipleSelection`, shown as `checkbox` or `chips`, `filterable`), Slider (a single value), DateTimeInput (ISO 8601, date and/or time).

It also has functions: the checks `required`, `regex`, `length`, `numeric` and `email`; `formatString`, `formatNumber`, `formatCurrency`, `formatDate` and `pluralize`; `openUrl`; and `and`, `or`, `not`. It has no table, chart or diagram, which matches research-stack §A. Charts live in a separate VegaChart catalogue (one `VegaChart` component that takes a Vega-Lite or Vega spec). `@a2ui/react` 0.14.0 (2026-10-17) still documents protocol v0.9.

**shadcn/ui** (CLI 4.23.0 released today; repo 126,694 stars) (v). The registry now ships three parallel bases: Radix, Base UI and React Aria. The UI-system decision (L31) means the **Radix base**, which the project should name explicitly at init. The components relevant here:
- Field, Label, Input, Input Group, Textarea;
- Radio Group, Checkbox, Switch, Slider, Select, Toggle Group;
- Calendar and the Date Picker pattern (react-day-picker 10.0.2);
- Tabs, Card, Separator, Collapsible, Popover, Hover Card, Tooltip, Dropdown Menu, Dialog, Alert Dialog, Alert, Badge, Kbd;
- Table and the Data Table pattern (TanStack Table), Chart (Recharts).

Two new 2026 items are worth knowing: **Questionnaire**, a one-question-at-a-time multi-step form on `@shadcn/react` 0.3.1, and Message and Message Scroller.

Avoid two of them:
- **Command**, which is built on cmdk. cmdk fails the activity criterion: its last release was 1.1.1 on 2025-03-14, and its last push was 2025-10-29.
- **Sonner and the dark-mode recipe built on next-themes.** next-themes' last release was 2025-03-11, and it uses `localStorage`.

The Radix base's Combobox imports `@base-ui/react`, so it mixes in a second primitive library.

### 1.2 Atoms the agent can compose (FR-13)

These are the atoms of the input format. A question built only from atoms returns, as its typed answer, a map from each input atom's item ID to that atom's value (FR-13 testable consequence; AD-7 IDs). No atom carries HTML, CSS or layout geometry (AD-7).

| # | Atom | Purpose | A2UI basic v1 | shadcn / Radix | Typed answer (input atoms) | Why it is needed |
|---|---|---|---|---|---|---|
| A1 | **Text** | Plain text, or Markdown through the view's sanitizer (`format: plain \| markdown`); Markdown carries code blocks too | Text | none (typography classes) | — | FR-13; FR-3 option previews ("text or data"); agent-written excerpts (FR-8) use the same Markdown path |
| A2 | **Image** | An image from the board document, shown through a `blob:` URL; alt text required | Image (by URL; here by pointer, AD-12) | none (`<img>`) | — | FR-13; FR-3 previews of mockups; AD-12 |
| A3 | **Value** | A read-only typed value: number, money, date, duration or percent. It is given or derived (formula, built-in field), with locale formatting and a formula-error state | none (Text plus `formatNumber`, `formatCurrency`, `formatDate`) | none | — (answers carry derived values as they stood, AD-20) | FR-12, FR-14; totals, spreads and margins of the molecules; the margin warning (L75) |
| A4 | **TextField** | Short or long free text, with label and description | TextField (`shortText`, `longText`) | Field + Label + Input / Textarea | `string` | FR-11 Form "text"; FR-13 |
| A5 | **NumberField** | A number or an integer, with min, max, step and a unit label ("days", "h") | TextField (`number`), with no min or max | Field + Input Group (unit suffix), `inputMode="decimal"` | JSON number | FR-11 Form "number"; three-point estimates (FR-15); durations in whole days (AD-7) |
| A6 | **MoneyField** | An amount in a currency the agent fixes or lets the user pick from a list | none (only `formatCurrency`) | Field + Input Group (currency prefix) | `{ "amount": "<decimal string>", "currency": "<ISO 4217>" }` | FR-11 Form "money"; AD-7 money; rates in the sales estimate (FR-15) |
| A7 | **DateField** | A calendar date, without time | DateTimeInput (`enableDate`) | Date Picker: Popover + Calendar + Input | RFC 3339 `full-date` | FR-11 Form "date"; AD-7 dates; Gantt dates |
| A8 | **Choice** | Single or multiple choice. Options carry label, description and an optional "Other" free-text answer. Shown as radios or checkboxes, or as a dropdown for long lists | ChoicePicker | Radio Group, Checkbox; Select for the dropdown display | option ID, or list of IDs; plus `other` text when used | FR-3; FR-11 Choice and Form "list"; option descriptions (L47). The question card's option list is this atom plus chrome (Recommended badge, Accept recommended, annotations) |
| A9 | **Toggle** | On or off | CheckBox | Switch (or Checkbox) | `true` / `false`; an untouched toggle returns no answer | Optional scope lines switched on or off (L75); boolean parity with elicitation forms |
| A10 | **Slider** | A value, or a range, on a numeric scale | Slider (single value only) | Slider | number, or `[low, high]` | FR-11 Scale. The Scale widget is this atom plus a rating mode |
| A11 | Divider **[OPTIONAL]** | A separator between items | Divider | Separator | — | Cosmetic only |

Notes:
- **Nothing starts with a value** (AD-10). TextField, NumberField, MoneyField and DateField start empty, Choice starts with nothing selected, and Toggle and Slider start unset. The Radix Slider renders a thumb only for the values it is given, so "unset" means an empty value until the first interaction. Whether a click on the track then sets a value must be checked in the spike.
- **Review mode.** In a widget that reviews agent content (Table, Tree, Form over agent values), an atom starts from the agent's value, and an untouched value is reported unchanged (AD-10).
- **Locale.** Atoms display and accept input in the board's locale (EN or IT: `12.480,00`, `27/10/2026`). They store and return the contract's formats (AD-7, L26).
- **Typing never answers.** An input atom's value becomes an answer only through the question's answer act and the delivery mode (AD-20), never on typing or blur.

### 1.3 Chrome atoms (AskBoard's own, not in the input format)

These are the atoms of EXPERIENCE.md and DESIGN.md (Component Patterns, Atoms), named here so the catalog has one list.

| # | Atom | A2UI basic v1 | shadcn / Radix | Used by |
|---|---|---|---|---|
| C1 | **Button**: primary (Submit only), secondary, tool-active, disabled; Tailwind `ring` for the focus ring | Button | Button | Every surface (L109) |
| C2 | **Segmented control** | none | Toggle Group (single) | Delivery mode, EN \| IT, density, Split \| Unified, Fix A \| Fix B \| A vs B, Diagram \| Source, Beside \| Inline |
| C3 | **Status chip and state pill**, a label with a marker shape (L132) | none | Badge | Header, Diff review, the margin warning |
| C4 | **Widget frame**, a bordered frame with a toolbar row | Card (approx.) | Card (structure only) | Every widget (FR-11) |
| C5 | **Annotation pin and comment card**, a numbered pin in the user-change hue | none | Popover for the card | Image annotation, Diagram, Graph (L70, L118) |
| C6 | **Notice and banner** | none | Alert | Agent-change notice, ended board, connection lost (L52, L58, L85) |
| C7 | **Key hint** **[OPTIONAL]** | none | Kbd | Keyboard core (L28, L50), once key bindings exist (EXPERIENCE Open Item 19) |

### 1.4 A2UI components deliberately not adopted

| A2UI component | Why not |
|---|---|
| Button (agent-defined actions) | An answer comes only from an explicit user act on its question (AD-10). An agent-defined action would be a user event with agent-chosen meaning. Approval covers decisions |
| List (templated children over a data model) | AskBoard has no client-side data binding. The agent sends explicit items, and molecules expand at send time (AD-9) |
| Modal | Everything stays on the board (FR-1). An agent-opened modal hides content and needs focus management with no journey behind it |
| Icon, Video, AudioPlayer | No FR needs them. The icon set is not chosen yet (DESIGN Open Item 3). Icon can be added later at low cost |
| TextField `obscured` | A board never collects secrets. Elicitation itself forbids sensitive data in form mode |
| DateTimeInput time-of-day | The contract has only `full-date` values (AD-7) |

A later A2UI inbound translator (OQ5) can map Column to Stack, Row to Row, Card to Group, Tabs to Tabs, TextField to TextField or NumberField, CheckBox to Toggle, ChoicePicker to Choice, Slider to Slider, and DateTimeInput (date only) to DateField. The rest is refused or approximated.

### 1.5 Layouts

Layouts come at three levels: the board, the question, and composition (FR-13: "arrange any items on the board with layouts"). Layouts return no answer.

| # | Layout | Purpose | Chosen by | A2UI basic v1 | shadcn / Radix | Why it is needed |
|---|---|---|---|---|---|---|
| L1 | **Board shell** | Sticky two-row context header, sticky outline rail, content column, sticky bottom action bar | AskBoard, always | none | none (CSS grid, `position: sticky`) | L46, L110 |
| L2 | **Area sections** | Areas stacked as labelled sections. An ask without areas is one group | Agent, per ask | Column + Text | Separator | FR-2, L42 |
| L3 | **Area tabs** | One tab per area | Agent, per ask | Tabs | Tabs | L42 |
| L4 | **Question pager** | One question fills the view, with a question navigator (see 1.6) | Agent, per ask | none (Tabs is the nearest) | Toggle Group / Button for the navigator. The shadcn Questionnaire is a reference for the pattern only (see 1.6) | L121, L122 |
| L5 | **Slim single-question board** | L1 without the outline rail, the next-unanswered jump and "Accept all recommended". The question takes the full width | Automatic, when the ask has one question | none | none | L120; the golden case (L118) |
| L6 | **Split question** | Question column plus a context column of fixed width (360px at the 1280px floor) with the excerpts and references. A question without excerpts takes the full width. A switch places the context beside or inline | Automatic (excerpts present), plus the user's switch | Row with two weighted Columns (approx.) | none (CSS grid). Switch: Toggle Group "Beside \| Inline". Resizable is not used: the width is fixed (DESIGN) | FR-13 split view; L106, L110, L111, L112 |
| L7 | **Stack** | Items one under another | Agent (FR-13) | Column | none (flex) | FR-13 |
| L8 | **Row** | Items side by side, with relative widths | Agent (FR-13) | Row (`weight`) | none (flex or grid) | FR-13 (a label, a field and a value on one line; side-by-side comparisons) |
| L9 | **Group** | A titled, bordered group of items (fieldset semantics) | Agent (FR-13) | Card + Text | Card | FR-13 (form sections, grouped values) |
| L10 | Tabs inside a question **[OPTIONAL]** | Alternative views of one question's content | Agent | Tabs | Tabs | No FR minimum needs it |

The agent chooses the presentation (L2, L3 or L4) with one ask-level field. L5 and L6 need no field from the agent (L106, L120). In benchmark mode every area mounts whatever the presentation (AD-17), so L3 and L4 render hidden content with Radix `forceMount` and hide it.

### 1.6 Layout behaviour that the spines leave open

- **L6, the context switch** (EXPERIENCE Open Item 13). Proposal: a "Beside | Inline" segmented control in the title row of the context block ("Excerpt and references"). In both positions it stays in that title row, so it never jumps. The board-wide default lives in the settings panel, as a presentation preference that applies at once (ACR-02). **[CALL]**
- **L3 with the outline navigator** (Open Item 14). Proposal: an outline jump to a question in another area activates that tab. Each tab label carries its area's unanswered count, so the next-unanswered jump can also switch tabs. **[CALL]**
- **L4, the question navigator** (L122, Open Items 3 and 14). Proposal: a compact bar above the question. It shows "Question 3 of 8", a strip of per-question state markers (the same marker shapes as the state pills, L132) that are clickable, Previous / Next, and the next-unanswered jump. The outline rail is not shown, since the view is "simplified" (L121). On navigation, focus moves to the new question's heading. **[CALL]**
  - **Switching presentation.** Proposal: the user cannot switch an ask between L4 and the full board in v1. The agent chose, and a switch has no journey. **[CALL]**
  - **Why not the shadcn Questionnaire.** It "owns the ordered items, active item, answer state, validation, progress, and navigation" (v). That breaks AD-9 (no edit state of its own) unless every part is controlled. It also models only choice and free-text answers, not AskBoard's card (widget, open prompt, follow-ups, context). Its interaction details are worth copying: inactive questions are inert, focus moves on navigation, and the progress reads "Question n of m".

## 2. Component per widget

### 2.1 Widgets and molecules

Licence and rule: "pass" means it passes the adoption rule on §9's data and on my check today. "n/a" means AskBoard's own code. Sizes are bundlephobia's full-package figures (minified / gzipped, measured today). Tree-shaking can lower them.

| # | Widget | Recommended component (version) | Licence · rule | Covers of the decided scope | AskBoard builds on top | Alternatives | Risks |
|---|---|---|---|---|---|---|---|
| 1 | **Choice** | Atoms A8 (+ A1, A2 for previews) on Radix Radio Group and Checkbox (`radix-ui` 1.8.1, pin at init) | MIT · pass | Single and multiple choice; roving-focus keyboard | Descriptions, header chip, Recommended badge, Accept recommended, option annotations, "Other", previews | — | How previews are presented is open (EXPERIENCE Open Item 10) |
| 2 | **Ranking** | Own sortable list + Pragmatic drag and drop 4.0.0 | Apache-2.0 · pass | Drag to reorder | Keyboard "Move up / Move down" (ranking is answering, so it is in the keyboard core, L28); drop indicator; an explicit act to accept the agent's initial order (AD-10) **[CALL]** | `@dnd-kit/react` 0.5.1 (keyboard sensor built in; 0.x) | Pragmatic has no keyboard drag; native drag in a sandboxed srcdoc frame needs a spike check |
| 3 | **Scale** | Atom A10 on Radix Slider; rating mode on Toggle Group | MIT · pass | One value or a range (two thumbs) | Rating mode, the unset state, locale labels | Own pointer slider | Radix Slider's unset state (1.2) |
| 4 | **Form** | `@rjsf/core` + `@rjsf/utils` 6.11.0, themed with atoms A4 to A9 (Part 3) | Apache-2.0 · pass | Fields from a flat JSON Schema subset, list fields, fieldsets | Field checks from the compute graph; MoneyField; locale input; no-op validator | `@jsonforms/react` 3.8.0; no library (Part 3) | Part 3 |
| 5 | **Approval** | Own, from Button atoms | n/a | — | Approve, approve with changes, reject; "approve with changes" needs open-prompt text (L74); the summary of the user's changes, built with the same diff as the change highlight | — | The summary must stay display only |
| 6 | **Document review** | Own, on the Markdown renderer (X1), with text-quote anchors | MIT; MPL-2.0 OR Apache-2.0 · pass | Read-only rendering | Select a passage, then comment or suggest a replacement (Popover). Anchors as quote or position selectors (AD-7). Inline marks through the Range API and classes | `@tiptap/core` 3.32.0, core only (ProseMirror). Comments and track changes are Pro, so AskBoard would build its own marks; `injectCSS: false` under the CSP | Overlapping anchors; source and rendered offsets drift apart |
| 7 | **Diff review** | `@pierre/diffs` 1.6.2 | Apache-2.0 · pass | Split and unified views, line annotations and comments, a custom accept/reject UI, virtualisation (extract-visual-companion 4.6) | The "Fix A \| Fix B \| A vs B" source switch (three diffs computed from the board document); per-line and per-file accept/reject in the draft record; comment cards; status chips; anchors (side, path, line) | git-diff-view 0.1.8 (743 stars: named exception); own on `diff` | Under the CSP, code is set through `innerHTML` of HAST, so inline token-colour styles are dropped (inferred) and highlighting is lost, though the structure stays. Mitigation: a class-based Shiki transformer, or no highlighting in v1 **[CALL]**. Styles go through `adoptedStyleSheets` (v), to confirm. The JS regex engine must be used, never WASM. 1.x API; 491 / 130 KB plus grammars |
| 8 | **LaTeX** | KaTeX 0.19.1 to render; editing through a monospace TextField with live preview | MIT · pass | Rendering | The edit loop, the parse-error display, KaTeX fonts inlined as `data:` URLs | MathLive 0.111.1 as a visual editor **[OPTIONAL]** | Use `katex.render` into a node, or MathML output: `renderToString` plus `innerHTML` carries inline styles. Mermaid brings its own KaTeX ^0.18 (two copies unless deduplicated). MathLive loads fonts and sounds by URL and injects shadow-DOM styles; 789 / 216 KB |
| 9 | **Table** | TanStack Table 9.3.1 (headless), shadcn Table styling, atoms as cells | MIT · pass | Rows, columns, column definitions | Typed cells (A4 to A9); totals and formula columns from the compute graph; change highlight | Own plain table | v9 is a new major |
| 10 | **Spreadsheet** | TanStack Table 9.3.1 as an A1 grid, with an own cell editor and formula bar; values from the `FormulaEngine` (AD-13) | MIT · pass | Grid rendering | A1 addressing, cell editing, formula and error display, arrow-key cell moves | Own grid without TanStack | Spreadsheet keyboard habits (F2, Enter, Tab) are a large surface. Keep to the minimum |
| 11 | **Chart** | Apache ECharts 6.1.0 (2.3) **[CALL]** | Apache-2.0 · pass | Bar, line, scatter and pie; select and highlight points; canvas; light and dark themes | Mapping from AskBoard's chart format to ECharts options; selection state in the draft record; a theme built from the tokens; `tooltip.renderMode: 'richText'` | Vega-Lite 6.5.0; Recharts 3.10.1 (not in §9) | Canvas text is not selectable; a theme switch re-initialises the chart; full package 1,089 / 359 KB, tree-shaken size not measured |
| 12 | **Tree** | TanStack Table 9.3.1 tree mode (`rowExpandingFeature`, sub-rows) (v) + Pragmatic drag and drop 4.0.0 | MIT; Apache-2.0 · pass | Nested rows, expand state | Add, move, rename and delete; node fields as atoms; roll-ups from the compute graph; keyboard move actions | `react-arborist` 4.0.1 (its react-dnd peers fail activity, 2.5); react-complex-tree (1,383 stars, not in §9) | Drag to re-parent inside a table. Expand and collapse on a standalone Tree depends on EXPERIENCE Open Item 24 |
| 13 | **Graph** | `@xyflow/react` 12.12.0; `@dagrejs/dagre` 3.1.3 for auto-layout | MIT · pass. dagre is not in §9; on my check it passes: MIT, 5,840 stars, pushed and released 2026-10-24 | Node and edge editing, custom nodes and edge labels, selection, pan and zoom | Cycle checks from the compute graph; comments pinned by node or edge ID, so they survive re-layout (L70); the auto-layout action; change highlight; the toolbar | Own layered layout instead of dagre. **Never elkjs** (excluded, §9) | React Flow's keyboard editing is limited (beyond the core, Open Item 20) |
| 14 | **Diagram** | Mermaid 12.2.0 and `@plantuml/core` 1.2026.9 (MIT tarball), rendered to SVG and shown as `blob:` images; own annotation overlay (2.4) | MIT · pass, with the elkjs caveat (2.5) | SVG from source | Hit map, pins, change recolouring by SVG post-processing, "Diagram \| Source", source TextField, re-render, anchors by source ID | Pixel regions (an anti-pattern, extract-visual-companion 4.9) | Mermaid declares elkjs as a dependency. Mermaid's text measurement under the CSP. PlantUML weight (7 MB unpacked). Labels in `foreignObject` inside an image: set Mermaid `htmlLabels: false`. Dark theme open (DESIGN Open Item 13) |
| 15 | **Gantt** | **Own SVG Gantt** **[CALL]** (2.3): grid on TanStack Table; time axis, bars, dependency arrows, baseline and critical path drawn by AskBoard; pointer drag | n/a | — | Everything visual; dates and CPM come from the compute graph (AD-13) | Frappe Gantt 1.2.2 (push window ends 2026-12-18); DHTMLX Gantt Community 10.0.3 (not recommended) | Build cost; the R10 scope creep; keyboard for bars beyond the core |
| 16 | **Timeline** | Own, on the Gantt's time axis and drag code (lanes, ranges, milestones) **[CALL]** | n/a | — | Lanes, range and milestone drag across lanes | vis-timeline 8.5.6 (the choice if the Gantt goes to a library) | vis-timeline: item `content` is HTML by default (use a template that writes text); its dependency `@egjs/hammerjs` fails activity (2.5); 414 / 119 KB |
| 17 | **Kanban** | Own columns of cards + Pragmatic drag and drop 4.0.0 | Apache-2.0 · pass | Drag between columns | Keyboard "Move to…" menu (Dropdown Menu); mapping columns to a field (status, priority, owner) | `@dnd-kit/react` 0.5.1 | As Ranking |
| 18 | **Image annotation** | **No component passes.** Recommended: an own overlay shared with Diagram (2.4) **[CALL]** | n/a | — | The image as a `blob:` `<img>`; an SVG overlay for pins and boxes; comment cards; `xywh=percent:` selectors (AD-7) | Annotorious 3.9.5 with a **named stars exception** (BSD-3-Clause, 869 stars, pushed 2026-10-20) | A pin is a point; whether the contract stores it as a zero-size `xywh` region or as a small box is a contract detail (Media Fragments may not admit zero sizes; to check) |
| M1 | **WBS with PERT** (UJ-2) | Tree (12) + NumberFields for the three-point estimates + Values for expected effort and spread | as 12 | Expand and collapse (built into TanStack's expanding feature) | PERT from the compute graph's built-ins; an excerpt per work package in an expandable row detail; change highlight against the agent's values (L71) | as 12 | — |
| M2 | **Gantt plan** (UJ-2) | Gantt (15), linked to the WBS by item IDs | as 15 | — | Day, week and month zoom; the agent's plan as a baseline under the bars; the critical path always in `{colors.critical}` (L72) | as 15 | — |
| M3 | **Sales estimate review** (UJ-3) | Table (9) + Toggle per optional line + Money and Number atoms + Values for the totals and the margin, ending with Approval (5) | as 9 | — | A switched-off line stays visible, muted, and is never deleted; the warning chip below the agent's minimum margin (ACR-07 field); change highlight (L75) | as 9 | — |
| M4 | **Decision matrix** | Table (9): options by weighted criteria | as 9 | — | Scores from the compute graph; the minimum only (L68) | as 9 | — |

### 2.2 Markdown renderer, drag and drop, dark theme

| # | Need | Recommended (version) | Licence · rule | AskBoard builds on top | Alternatives | Risks |
|---|---|---|---|---|---|---|
| X1 | **Markdown renderer** | markdown-it 15.0.3 with `html: false`, then DOMPurify 3.4.17 | MIT; MPL-2.0 OR Apache-2.0 · pass | Renderer rules: images become links (remote URLs are never loaded, AD-8; local images enter as Image atoms through the board document, AD-12); links become open-link messages; table alignment becomes a class, because an inline `style` would be dropped. 125 / 51 KB together | streamdown 2.7.1 (React; rehype-sanitize and rehype-harden, but it includes rehype-raw and streaming support AskBoard doesn't need; 493 / 150 KB). react-markdown fails (no release since 2025-03-07) | Two sanitising layers to keep aligned; the Markdown profile (which syntax is allowed) must be fixed in `contract` |
| X2 | **Drag and drop** | Pragmatic drag and drop 4.0.0 | Apache-2.0 · pass | Explicit keyboard actions (Move up / Move down / Move to…) wherever drag is an answer path (Ranking, Kanban, Tree). Gantt and Graph use pointer drag, with no DnD library | `@dnd-kit/react` 0.5.1 (keyboard sensor, 0.x API); `@dnd-kit/core` fails (last release 2024-12-05) | Native HTML5 drag inside the sandboxed srcdoc frame needs a spike check |
| X3 | **Dark theme** | No library: the DESIGN tokens (light and `-dark`) as CSS variables; a `.dark` class on the view root, set from the theme preference (a board-page-to-view message, ACR-02), with `prefers-color-scheme` as the default | n/a | Canvas components (ECharts) rebuild their theme object from the resolved variables on a switch. Diagrams re-render with a dark diagram theme (DESIGN Open Item 13) **[CALL]**. Snapshots carry both token sets | next-themes is excluded: it uses `localStorage`, which throws in the opaque view, and its last release was 2025-03-11 | Every component must be audited for storage access at start-up |

### 2.3 Flagged choices

**Gantt: DHTMLX Gantt Community or Frappe Gantt — and a third way.** Both libraries leave AskBoard the hard parts: dates, the critical path and the baseline (FR-12, R6, L73).

- **DHTMLX Gantt Community 10.0.3** (MIT, 1,867 stars, pushed 2026-09-03). It has a grid, inline editing, link drag, zoom and multiple instances (all in Community). Three findings make it the weakest fit:
  - **CSP.** Its timeline scale and grid cells are built as HTML strings with inline `style='…'` attributes and set through `innerHTML` (v, source: `src/core/ui/timeline/timeline.js` L407 to L488, `src/core/ui/render/task_grid_line_render.js` L77). Under AD-8 those widths and heights are dropped, so it would very likely fail the renderer spike's criterion 1. Its date code also needs `gantt.config.csp = true`.
  - **Agent text as HTML.** Task text goes through `innerHTML` templates (`task_bar_render.js` L167, L214), so every template must be overridden to escape it.
  - **Baselines.** "Support for baselines, deadlines and other custom elements" is PRO-only (v, editions comparison), so the decided baseline (L72) would have to be drawn around the library rather than through it.
- **Frappe Gantt 1.2.2** (MIT, 6,154 stars). It is light (46 / 14 KB) and SVG-based, sets its styles mostly through the CSSOM, and has Day, Week and Month view modes, drag and resize, and dependency arrows. Against it:
  - It has no grid and no UI for editing dependencies, both in FR-11's minimum.
  - It has no baseline.
  - The task name goes in through `innerHTML` (v, `src/bar.js` L238), and so does the popup, so both must be escaped or disabled.
  - **Its push window ends on 2026-12-18.** The last commit on master was on 2026-03-05. A named exception waives only stars, so if no push comes, Frappe fails the rule, probably before the Gantt story ships.
- **Own SVG Gantt (recommended).** AskBoard already owns the scheduling, the critical path and the baseline data. What remains is a time axis with three zoom levels, bars, finish-to-start arrows, pointer drag and resize, and a grid. TanStack Table already provides the grid, shared with Table and Tree. This also clears the CSP problems, the HTML-from-agent-text problem and the activity-window risk, and it keeps the Gantt and Timeline on one time axis (16). Its cost is code AskBoard maintains, and R10 warns that a Gantt can grow into a product. The decided scope bounds it (L72; EXPERIENCE Open Item 24 for a standalone Gantt).
- **Between the two named libraries, Frappe is the better fit**, provided the user accepts the activity-window risk. DHTMLX is not recommended.

**Chart: ECharts or Vega-Lite.** AskBoard maps its own chart format to whichever library it uses. An agent-written ECharts option or Vega-Lite spec would be configuration, not data: ECharts formatter strings render HTML, and Vega-Lite specs carry data URLs, expressions and `href` channels.

- **ECharts 6.1.0 (recommended).**
  - No `eval`. The canvas renderer plus `tooltip.renderMode: 'richText'` puts no agent text into HTML.
  - Point selection (`selectedMode`, `selectchanged`) is easy to drive from the draft record.
  - Clean dependency tree: only `tslib` and `zrender`, both from the same team.
  - Tree-shakable through `echarts/core`.
- **Vega-Lite 6.5.0, with Vega 6.4.0.**
  - It matches A2UI's VegaChart catalogue, which would help a future inbound translator.
  - It needs `vega-interpreter` 2.3.2 with `ast: true`, since by default Vega "builds JavaScript functions with the Function constructor". Vega's docs report about a 10% penalty in their tests, and more on interactive updates (v).
  - Its runtime is not tree-shakable: 781 / 266 KB.
  - Driving the selection from outside goes through signals, which is more intricate.
- **A third option, outside §9's table: Recharts 3.10.1**, the base of shadcn's Chart (MIT, 27,666 stars, released 2026-10-24).
  - It is React-controlled, renders SVG with props, and reads the `--chart-*` token variables natively.
  - It depends on `decimal.js-light` 2.5.1, last released 2022-06-14, which fails activity transitively.
  - 548 / 146 KB.

### 2.4 Diagram and image annotation under the `blob:` rule

The view shows diagram SVG only as `<img src="blob:…">` (AD-8), so pins and highlights can never be made by editing the displayed diagram's DOM. The proposal treats the image as a picture and everything interactive as AskBoard's own overlay, built from data:

1. **Render** the source with Mermaid or PlantUML inside the bundle (renderer spike criterion 3). Mermaid: `securityLevel: 'strict'` and `htmlLabels: false`, so labels are SVG text rather than `foreignObject` HTML inside an image.
2. **Hit map.** While the SVG is still AskBoard's render output, before it becomes a blob, AskBoard extracts each anchorable element and its bounding box in SVG coordinates:
   - for Mermaid: nodes and edges by their IDs;
   - for PlantUML: participants and entities by their `data-*` attributes and IDs;
   - for any element with no ID, the quoted label (AD-7: "node or edge IDs as written in the diagram source, else the quoted label").
3. **Overlay.** An SVG layer the same size as the image sits over it, scaled with it. It holds focusable hit regions, the numbered pins (C5) and the selection outline. A click or keypress on a region opens the comment card.
4. **Change highlight.** An annotated or corrected element is recoloured in `{colors.change}` by post-processing the SVG text through `DOMParser` and `XMLSerializer`: AskBoard sets stroke and fill attributes on that element's shapes, then creates a new blob. Styles inside an image SVG don't reach the page CSP, so this is safe, and it follows the exact shapes (DESIGN, Diagram).
5. **Re-render.** When the user corrects the source ("Source" tab) and it re-renders, pins re-attach by source ID or label. A pin whose element is gone is listed as detached, never silently dropped. The answer returns the corrected source plus the annotations (FR-11).

**Image annotation reuses steps 3 and 4 without step 2.** Pins and boxes sit in the overlay, and their positions are `xywh=percent:` selectors (AD-7).

Risks for the spike:
- Mermaid measures text in a live node, and the `<style>` it injects there is blocked by the CSP. Measurement may then use a fallback font that differs from what the `<img>` shows. PlantUML writes font attributes as presentation attributes, so it is less exposed.
- A label used as an anchor can be ambiguous when two elements share it.
- Keyboard placement of a pin goes beyond the keyboard core (Open Item 20).

### 2.5 Findings that differ from SOLUTION-DESIGN §9 (reported, not applied)

1. **Mermaid 12.2.0 declares `elkjs` ^0.9.3 as a direct dependency** (v). elkjs is licensed `EPL-2.0 OR GPL-3.0-or-later`, and §9 lists it as an excluded trap. Mitigation: alias elkjs to an empty module in the view build (the ELK layout is not used), and have CI check that it is absent from every chunk.
2. **`react-arborist` 4.0.1** (§9: passing) requires the peers `react-dnd` and `react-dnd-html5-backend` ^16. Their last release was 2022-06-25 and the last push 2025-07-06, so it fails activity transitively. It also pins `react-window` ^1.8.
3. **vis-timeline 8.5.6** (§9: passing) depends on `@egjs/hammerjs` 2.0.17, from the naver/hammer.js repository (45 stars, last push 2021-02-01).
4. **Forms.** §9 lists both form libraries as passing, but neither one's default validator can check a run-time schema under the view CSP:
   - Ajv compiles to `new Function`.
   - Precompiled validators need the schema at build time.
   - The eval-free `@rjsf/validator-cfworker` 6.11.0 rests on `@cfworker/json-schema` 4.1.1. That fails the rule: 704 stars, last release 2025-01-31, last push 2026-04-10.
   - `@rjsf/validator-ata` rests on `ata-validator`, which has 389 stars.

   Hence Part 3's validator-less configuration.
5. **`@rjsf/shadcn` 6.11.0** depends on cmdk, which fails activity (1.1).
6. **DHTMLX Gantt Community** is "Pass, for Community features only" in §9. The source shows inline-style markup that the view CSP drops, and custom timeline elements (baselines) are PRO (2.3).
7. **Frappe Gantt.** Its newest GitHub release tag is v1.0.3 (2025-02-03), while npm has 1.2.2 (2026-02-25). §9's dates follow npm. Its release window therefore ends 2027-02-25, and its push window 2026-12-18 as §9 says.
8. **Radix modal primitives.** Dialog and Alert Dialog lock the page scroll through react-remove-scroll and react-style-singleton, which inject a `<style>` element at run time. That element is blocked under hash-only `style-src`, so the scroll lock is lost and the console shows a CSP report. This affects the settings panel and the mode-switch confirmation if they are modal. A spike item.

**Named exceptions.** None of the recommendations needs one. These would, if the user picks them:
- Annotorious (Image annotation);
- git-diff-view (Diff review);
- `ata-validator` (forms);
- headless-tree (910 stars, Tree).

These cannot be rescued by an exception, because an exception waives only stars:
- `@cfworker/json-schema` (fails activity too);
- react-dnd;
- Frappe Gantt after 2026-12-18 if no push comes.

**Additions for the renderer spike (§10.3)** that these choices create:
- `@pierre/diffs` highlighting and `adoptedStyleSheets` under the CSP;
- Radix modal scroll lock;
- Mermaid measurement with blocked styles;
- KaTeX fonts inlined as `data:` URLs;
- Pragmatic drag and drop in the sandbox;
- the Radix Slider unset state;
- an audit for storage access at start-up;
- elkjs absent from the chunks.

## 3. Form library

### 3.1 What the Form widget needs

- **Typed fields: text, number, money, date, list (FR-11).** "List" is ambiguous: a pick from a list (an enum, single or multiple), or a list of entries the user adds to. **[CALL]** I propose the first, which matches elicitation's enums, and repeated entries are out of v1 because of the minimum-as-ceiling rule (L68).
- **Field checks** are a derived value in FR-11. So they belong to the compute graph (AD-13), not to the library: AskBoard evaluates a fixed keyword set: `required`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `format: date`, plus a date range. The library only displays the resulting errors. A `pattern` from the agent can hang the view's thread with a pathological regex (ReDoS), so the contract should cap its length.
- **EN and IT** labels and locale formats (L26). Labels come from the agent, already in the ask's language; a translation is a resend (ACR-01).
- **shadcn and Tailwind look**, through AskBoard's own atoms, so the Form looks like every other field on the board.
- **Grouping.** Areas are board layouts (L2, L3) under AD-9, not something the form does. Inside a Form, fieldsets at most.
- **One question model.** The Form's field model maps to MCP elicitation's form schema without loss (3.4). Elicitation itself is set aside as a delivery path (SOLUTION-DESIGN §4.1).
- **Bundle size, CSP compatibility** (no `eval`, no `<form>` submission, no storage) and **maintenance**.

### 3.2 Comparison

| Criterion | `@rjsf/core` 6.11.0 (+ `@rjsf/utils`) | `@jsonforms/react` 3.8.0 (+ `@jsonforms/core`) |
|---|---|---|
| Licence, activity (v) | Apache-2.0 (the shadcn theme is MIT). 15,923 stars. 6.11.0 on 2026-09-29; releases every 2 to 4 weeks (6.7.1 Jul, 6.8.0 Aug, 6.10.0 and 6.10.1 Sep, 6.11.0 Sep 29); pushed today | MIT. 2,752 stars. 3.8.0 on 2026-06-16; 3.9.0-alpha.2 on 2026-10-26; pushed 2026-10-26 |
| Typed fields | String, number, integer, boolean, enum (select, radio, checkboxes), array (add, remove, reorder), `format: date`. Money is a custom widget | Same, through renderers. The vanilla set is minimal, so every shadcn-looking control is a custom renderer with a tester. Money is a custom renderer |
| Field checks | `extraErrors` takes errors computed outside the form; `customValidate` and `transformErrors` exist | `additionalErrors` with `validationMode: 'NoValidation'` |
| No `eval` (v) | A validator object is required. `validator-ajv8` compiles with `new Function`. Precompiled validators exist "to overcome issues with `unsafe-eval`", but only for schemas known at build time. Eval-free validators fail the rule (2.5). **So: a no-op `ValidatorType` adapter, with errors from the compute graph.** Generated schemas must avoid `oneOf`, `anyOf`, `if` and `dependencies`, because RJSF's schema utilities call `validator.isValid` for them | With `NoValidation`, the core reducer skips `ajv.compile` (v, 3.8.0 `reducers/core.ts` L129 to L135). Schema-based rule conditions still call `ajv.validate` (`util/runtime.ts` L93), so none may be emitted. Ajv is bundled anyway, because core imports it |
| No `<form>` submission | Renders a `<form>` by default, so use `tagName="div"` (supported, v) and hide the submit button. Enter no longer submits, which is what AskBoard wants (Submit is the bottom bar's) | Renders no `<form>` and no submit button |
| shadcn and Tailwind | An official `@rjsf/shadcn` theme exists (v). But it ships its own copies of shadcn components plus Radix, lucide-react and cmdk (2.5). **Better: AskBoard's own theme through `withTheme`, mapping RJSF widgets and templates to atoms A4 to A9**, so the atoms stay the single source | No shadcn renderer set. Every control and layout is a custom renderer |
| EN / IT | `translateString` for RJSF's own strings ("Add item"…). Labels come from the schema. Locale input lives in the atom widgets | `i18n` prop with `locale`, `translate` and `translateError` (v). That is stronger for key-based label translation, which AskBoard doesn't need, since labels arrive translated. Locale input lives in the renderers |
| Grouping | Nested objects as fieldsets; v6's `LayoutGridField` for grid layouts (v) | UI-schema Group and Categorization: the best grouping. But the research's argument ("categories group by area") no longer applies, since areas are board layouts |
| Elicitation model | Takes JSON Schema directly, so an elicitation-shaped flat schema renders unchanged. **By default it writes schema `default` values into the form data**, so AskBoard must never put `default` in a generated schema (AD-10; elicitation says clients "SHOULD pre-populate", and AskBoard deliberately doesn't) | Takes JSON Schema plus a UI schema. Defaults are applied only by Ajv's `useDefaults` during validation, which `NoValidation` skips |
| AD-9 (no edit state of its own) | Controlled through `formData` and `onChange` (it keeps an internal copy, re-synced from props) | Controlled through `data` and `onChange` (internal reducer state) |
| Markdown | `ui:enableMarkdownInDescription` uses markdown-to-jsx, which passes inline HTML. Keep it off; descriptions render as text | Descriptions as text |
| Bundle (bundlephobia, min / gz) | core 153 / 51 KB + utils 94 / 32 KB, no Ajv (the no-op validator adds nothing) | core 217 / 66 KB (Ajv and lodash included) + react 30 / 9 KB, plus own renderers |
| Maintenance | Large community, fast cadence, many themes | Smaller, backed by a company (EclipseSource), slower releases |

### 3.3 Recommendation

**`@rjsf/core` 6.11.0 with `@rjsf/utils` 6.11.0, under an AskBoard theme built from atoms A4 to A9.** It wins on the criteria that matter once areas are board layouts: it takes elicitation-shaped JSON Schema unchanged, its maintenance is stronger, it is lighter without Ajv, and it can be themed onto AskBoard's own atoms. Its two CSP issues have clean answers (`tagName="div"`, a no-op validator).

Configuration rules for the Form widget, to record in EXPERIENCE.md once approved:
1. A no-op validator adapter. Field errors come from the compute graph and are passed as `extraErrors`.
2. `tagName="div"`, and the submit button is never rendered.
3. Generated schemas carry no `default`, `oneOf`, `anyOf`, `if` or `dependencies`.
4. Markdown in descriptions stays off.
5. Neither `@rjsf/shadcn` nor `@rjsf/validator-ajv8` is used.

**Alternatives.**
- `@jsonforms/react` 3.8.0, with `NoValidation` and custom renderers. It is fine technically, but costs more renderer code and fewer stars.
- **No library**: compose the Form directly from atoms (a Group of field atoms). At FR-11's minimum this is a small amount of code, and it avoids a dependency. It gives up the ready-made list and fieldset handling, and the direct JSON Schema intake that keeps the one-question model cheap. **[CALL]**

### 3.4 Field model and elicitation mapping

| Form field | Typed answer | JSON Schema given to the form | Elicitation `requestedSchema` primitive (2025-11-25) |
|---|---|---|---|
| text | `string` | `type: string` (+ `minLength`, `maxLength`, `pattern`) | String schema |
| number | number | `type: number` or `integer` (+ `minimum`, `maximum`) | Number schema |
| money | `{amount, currency}` | `type: string`, `format: money` (AskBoard's own), currency in the field's options | No match. A string with a decimal `pattern` and the currency in the title; lossy |
| date | `full-date` | `type: string`, `format: date` | String schema, `format: date` |
| list (a pick) | ID, or list of IDs | `enum`, or `oneOf` of `const` and `title`; arrays of those for multiple choice | Enum schema, single or multi-select, with or without titles |
| boolean | `true` / `false` | `type: boolean` | Boolean schema |

Elicitation is limited to "flat objects with primitive properties only" (v). The Form keeps that shape, so any elicitation form can be shown on a board unchanged, apart from its defaults, which AskBoard never pre-fills.

## 4. Decisions for the user

1. **Agent-composable atoms.** Recommended: A1 to A10 (Text, Image, Value, TextField, NumberField, MoneyField, DateField, Choice, Toggle, Slider), with Divider optional. Alternatives: a smaller set that keeps Slider and Toggle inside the Scale and Form widgets only; or mirror A2UI's 18.
2. **Composition layouts.** Recommended: Stack, Row and Group, with Tabs inside a question optional. Alternative: add a collapsible Group. A2UI List and Modal are not adopted either way.
3. **One-question-per-view navigator.** Recommended: a compact bar with "Question n of m", clickable per-question state markers, Previous / Next and the next-unanswered jump; no outline rail; no user switch of presentation in v1. Alternatives: the outline rail doubles as the navigator; or let the user switch between pager and full board.
4. **Context placement switch.** Recommended: a "Beside | Inline" segmented control in the context block's title row, with the board default in the settings panel. Alternative: an icon toggle in the question card header.
5. **Areas as tabs with the outline.** Recommended: an outline jump activates the target tab, and tab labels carry unanswered counts. Alternative: hide the outline rail in tab presentation.
6. **Gantt.** Recommended: an own SVG Gantt (grid on TanStack Table; dates, CPM and baseline from AskBoard). Alternatives: Frappe Gantt 1.2.2, preferred over DHTMLX, if the activity-window risk (2026-12-18) is accepted; DHTMLX Gantt Community 10.0.3 is not recommended (CSP-dropped markup, PRO custom layers).
7. **Timeline.** Recommended: own, on the Gantt's time axis. Alternative: vis-timeline 8.5.6, if the Gantt goes to a library.
8. **Chart.** Recommended: ECharts 6.1.0, mapped from AskBoard's own chart format. Alternatives: Vega-Lite 6.5.0 (A2UI VegaChart parity, interpreter needed); Recharts 3.10.1 (shadcn Chart, not in §9, a stale transitive dependency).
9. **Image annotation.** Recommended: an own overlay shared with Diagram. Alternative: Annotorious 3.9.5 under a named stars exception.
10. **Diagram annotation under `blob:`.** Recommended: a hit map taken at render time, plus an overlay for pins and selection, plus recolouring by SVG post-processing into a new blob. Alternative: overlay-only highlights (outlined boxes, not exact shapes).
11. **Tree and WBS base.** Recommended: TanStack Table tree mode with Pragmatic drag and drop. Alternatives: react-arborist 4.0.1 (its react-dnd peers fail activity); react-complex-tree (needs a §9 entry).
12. **Graph auto-layout.** Recommended: `@dagrejs/dagre` 3.1.3, added to the adoption table. Alternative: an own simple layered layout. elkjs is excluded either way.
13. **Diff syntax highlighting.** Recommended: `@pierre/diffs` 1.6.2, with highlighting through a class-based transformer, or off in v1 if the spike fails it. Alternatives: never highlight in v1; git-diff-view under a named exception.
14. **Document review.** Recommended: own, on the Markdown renderer with text-quote anchors. Alternative: Tiptap core 3.32.0 with own marks.
15. **LaTeX editing.** Recommended: a source field with a live KaTeX 0.19.1 preview. Alternative: the MathLive 0.111.1 visual editor.
16. **Markdown renderer.** Recommended: markdown-it 15.0.3 with DOMPurify 3.4.17. Alternative: streamdown 2.7.1.
17. **Drag and drop.** Recommended: Pragmatic drag and drop 4.0.0, with explicit keyboard move actions. Alternative: `@dnd-kit/react` 0.5.1 (built-in keyboard, 0.x).
18. **Ranking and AD-10.** Recommended: accepting the agent's initial order takes an explicit act ("Keep this order"). Alternative: only a moved list counts as an answer.
19. **Form library.** Recommended: `@rjsf/core` 6.11.0 with an atom-based theme, a no-op validator and checks from the compute graph. Alternatives: `@jsonforms/react` 3.8.0; no library (the Form composed from atoms).
20. **Form "list" field.** Recommended: a pick from a list (enum, single or multiple), as in elicitation. Alternative: also repeatable entries (arrays), which goes beyond the minimum.
21. **Field checks.** Recommended: computed by AskBoard over a fixed keyword set, with a capped `pattern`. Alternative: none that passes; no eval-free run-time validator meets the rule.
22. **Dark theme and diagrams.** Recommended: a `.dark` class driven by the settings and the system preference, no next-themes, and diagrams re-rendered with a dark diagram theme. Alternative: diagrams on a light "paper" panel in dark mode.

## Sources

Checked on 2026-10-27.

- **A2UI.**
  - Basic catalogue v1: https://github.com/a2ui-project/a2ui/blob/main/catalogs/basic/v1/catalog.json
  - Spec v1.0 status: https://github.com/a2ui-project/a2ui/tree/main/specification/v1_0
  - VegaChart catalogue: https://github.com/a2ui-project/a2ui/tree/main/catalogs/vegachart
- **shadcn/ui.**
  - Components: https://ui.shadcn.com/docs/components
  - Radix-base registry: https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/radix/ui
  - Questionnaire: https://ui.shadcn.com/docs/components/radix/questionnaire
- **RJSF docs:** https://github.com/rjsf-team/react-jsonschema-form/tree/main/packages/docs/docs (`usage/themes.md`, `usage/validation.md`, `usage/layout-grid.md`, `api-reference/form-props.md`, `api-reference/validator-cfworker.md`, `api-reference/validator-ata.md`)
- **JSON Forms 3.8.0 source:**
  - https://github.com/eclipsesource/jsonforms/blob/v3.8.0/packages/core/src/reducers/core.ts
  - https://github.com/eclipsesource/jsonforms/blob/v3.8.0/packages/core/src/util/runtime.ts
  - https://github.com/eclipsesource/jsonforms/blob/v3.8.0/packages/core/src/store/i18nTypes.ts
- **MCP elicitation:** https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation
- **Vega CSP interpreter:** https://vega.github.io/vega/usage/interpreter/
- **DHTMLX Gantt.**
  - Editions: https://docs.dhtmlx.com/gantt/guides/editions-comparison/
  - CSP config: https://docs.dhtmlx.com/gantt/api/config/csp/
  - Source: https://github.com/DHTMLX/gantt/blob/master/src/core/ui/timeline/timeline.js, https://github.com/DHTMLX/gantt/blob/master/src/core/ui/render/task_grid_line_render.js, https://github.com/DHTMLX/gantt/blob/master/src/core/ui/render/task_bar_render.js
- **Frappe Gantt source:** https://github.com/frappe/gantt/blob/master/src/bar.js, https://github.com/frappe/gantt/blob/master/src/index.js, https://github.com/frappe/gantt/blob/master/src/popup.js
- **`@pierre/diffs` source:** https://github.com/pierrecomputer/pierre/blob/main/packages/diffs/src/components/File.ts, https://github.com/pierrecomputer/pierre/blob/main/packages/diffs/src/components/web-components.ts, https://github.com/pierrecomputer/pierre/blob/main/packages/diffs/src/highlighter/backends/shiki.ts
- **TanStack Table v9 features:** https://github.com/TanStack/table/blob/main/docs/guide/features.md
- **Sandbox and forms:** https://www.bugzilla.mozilla.org/show_bug.cgi?id=1287989
- **Validators:** https://github.com/cfworker/cfworker, https://github.com/ata-core/ata-validator
- **Versions, licences and dependencies:** npm registry (`npm view`). **Stars, pushes and archived flags:** GitHub REST API. **Sizes:** https://bundlephobia.com
