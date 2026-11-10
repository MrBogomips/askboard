---
name: AskBoard
description: 'Local web board where a Claude Code agent asks the user structured questions through widgets. First product to carry the shared AXFX family identity. shadcn/ui on Radix and Tailwind: this file holds the layered tokens and the brand-layer deltas; everything it does not override inherits shadcn.'
status: final
sources:
  - prd-askboard-2026-10-25/prd.md
  - prd-askboard-2026-10-25/addendum.md
  - architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md
  - architecture-askboard-2026-10-27/SOLUTION-DESIGN.md
  - prd-change-requests.md
  - architecture-change-requests.md
  - .working/technical-choices-proposal.md
  - reconcile-prd.md
  - reconcile-research.md
updated: 2026-11-10
colors:
  # ---- light (default scheme) ----
  # surfaces
  background: '#f7f5f0'
  card: '#fffdf9'
  muted: '#f0ece4'
  popover: '#fffdf9'
  # borders
  border: '#e3ddd2'
  border-strong: '#8f877a'
  # text
  foreground: '#2b2722'
  foreground-secondary: '#554e45'
  muted-foreground: '#6b6358'
  primary-foreground: '#ffffff'
  # accent (brand colour)
  primary: '#0b6e7f'
  primary-hover: '#085866'
  primary-subtle: '#e3f0f0'
  primary-text: '#0a6474'
  ring: '#2a8a9a'
  # status
  success: '#3d7a35'
  success-subtle: '#ecf3e4'
  success-text: '#2f6428'
  destructive: '#b42335'
  destructive-subtle: '#fbeaeb'
  destructive-text: '#9b1d2d'
  destructive-foreground: '#ffffff'
  warning: '#a87410'
  warning-subtle: '#fbf1da'
  warning-text: '#7a5006'
  info: '#1b7f8f'
  info-subtle: '#e3f0f0'
  info-text: '#0a6474'
  # user change (AskBoard extension)
  change: '#a3336f'
  change-foreground: '#ffffff'
  change-subtle: '#f9ecf2'
  change-text: '#8a2a5d'
  # agent state (AskBoard extension)
  agent: '#4057b2'
  agent-subtle: '#eceff9'
  agent-text: '#34489a'
  # diff and Gantt (AskBoard extensions)
  diff-add: '#e6f0dc'
  diff-add-mark: '#3d7a35'
  diff-del: '#f8e3e3'
  diff-del-mark: '#b42335'
  gantt-bar: '#8f877a'
  # Chart categorical palette (AskBoard extension; settles Open Items 7)
  chart-1: '#2a78d6'
  chart-2: '#eb6834'
  chart-3: '#1baf7a'
  chart-4: '#6250d6'
  chart-5: '#eda100'
  # syntax highlighting (AskBoard extension), set through classes
  syntax-keyword: '#6b3fa0'
  syntax-string: '#1d6b52'
  syntax-number: '#9a4a0b'
  syntax-function: '#2b5c8a'
  # aliases: CSS sets each as var(--target), identical in every palette; hex shown resolved
  card-foreground: '#2b2722'  # = foreground
  popover-foreground: '#2b2722'  # = foreground
  secondary: '#f0ece4'  # = muted
  secondary-foreground: '#2b2722'  # = foreground
  accent: '#f0ece4'  # = muted
  accent-foreground: '#2b2722'  # = foreground
  input: '#8f877a'  # = border-strong
  agent-waiting: '#6b6358'  # = muted-foreground
  ask-waiting: '#6b6358'  # = muted-foreground
  ask-partial: '#554e45'  # = foreground-secondary
  ask-answered: '#3d7a35'  # = success
  ask-closed: '#554e45'  # = foreground-secondary
  ask-discarded: '#b42335'  # = destructive
  recommended: '#34489a'  # = agent-text
  recommended-subtle: '#eceff9'  # = agent-subtle
  critical: '#2b2722'  # = foreground
  syntax-comment: '#6b6358'  # = muted-foreground
  # ---- dark: same keys with the -dark suffix ----
  # surfaces
  background-dark: '#1b1916'
  card-dark: '#23201c'
  muted-dark: '#161411'
  popover-dark: '#2c2925'
  # borders
  border-dark: '#3a352f'
  border-strong-dark: '#7a7266'
  # text
  foreground-dark: '#ebe6dd'
  foreground-secondary-dark: '#c8c0b4'
  muted-foreground-dark: '#a39a8d'
  primary-foreground-dark: '#10201f'
  # accent (brand colour)
  primary-dark: '#5fb4c2'
  primary-hover-dark: '#82c6d1'
  primary-subtle-dark: '#183033'
  primary-text-dark: '#6fc0cd'
  ring-dark: '#82c6d1'
  # status
  success-dark: '#79b56b'
  success-subtle-dark: '#1f2b1b'
  success-text-dark: '#9fcd92'
  destructive-dark: '#e0626e'
  destructive-subtle-dark: '#3b1c20'
  destructive-text-dark: '#f09aa2'
  destructive-foreground-dark: '#1b1916'
  warning-dark: '#ddb04a'
  warning-subtle-dark: '#33280f'
  warning-text-dark: '#e9c46a'
  info-dark: '#5fb4c2'
  info-subtle-dark: '#183033'
  info-text-dark: '#82c6d1'
  # user change (AskBoard extension)
  change-dark: '#db7fb2'
  change-foreground-dark: '#1b1916'
  change-subtle-dark: '#3a1f2e'
  change-text-dark: '#eeaacf'
  # agent state (AskBoard extension)
  agent-dark: '#8b9fe8'
  agent-subtle-dark: '#222943'
  agent-text-dark: '#b0bef2'
  # diff and Gantt (AskBoard extensions)
  diff-add-dark: '#1f2b1b'
  diff-add-mark-dark: '#8cc47e'
  diff-del-dark: '#3b1c20'
  diff-del-mark-dark: '#ec8590'
  gantt-bar-dark: '#7a7266'
  # Chart categorical palette (AskBoard extension)
  chart-1-dark: '#3987e5'
  chart-2-dark: '#d95926'
  chart-3-dark: '#199e70'
  chart-4-dark: '#9085e9'
  chart-5-dark: '#c98500'
  # syntax highlighting (AskBoard extension), set through classes
  syntax-keyword-dark: '#c3a6f0'
  syntax-string-dark: '#8fd1b0'
  syntax-number-dark: '#f0a875'
  syntax-function-dark: '#8fbde8'
  # aliases: CSS sets each as var(--target), identical in every palette; hex shown resolved
  card-foreground-dark: '#ebe6dd'  # = foreground
  popover-foreground-dark: '#ebe6dd'  # = foreground
  secondary-dark: '#161411'  # = muted
  secondary-foreground-dark: '#ebe6dd'  # = foreground
  accent-dark: '#161411'  # = muted
  accent-foreground-dark: '#ebe6dd'  # = foreground
  input-dark: '#7a7266'  # = border-strong
  agent-waiting-dark: '#a39a8d'  # = muted-foreground
  ask-waiting-dark: '#a39a8d'  # = muted-foreground
  ask-partial-dark: '#c8c0b4'  # = foreground-secondary
  ask-answered-dark: '#79b56b'  # = success
  ask-closed-dark: '#c8c0b4'  # = foreground-secondary
  ask-discarded-dark: '#e0626e'  # = destructive
  recommended-dark: '#b0bef2'  # = agent-text
  recommended-subtle-dark: '#222943'  # = agent-subtle
  critical-dark: '#ebe6dd'  # = foreground
  syntax-comment-dark: '#a39a8d'  # = muted-foreground
typography:
  # Compact ramp. Fonts are layered like colours: --font-sans and --font-mono point at the bundled family.
  question:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  body:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  control:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.3'
  badge:
    fontFamily: Inter
    fontSize: 11.5px
    fontWeight: '500'
    lineHeight: '1.3'
  label:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.06em
  code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.5'
  # Comfortable density: the same keys with the -comfortable suffix, deltas only (badge and label keep their sizes).
  question-comfortable:
    fontSize: 22px
  body-lg-comfortable:
    fontSize: 15px
  body-comfortable:
    fontSize: 14px
  control-comfortable:
    fontSize: 13px
  code-comfortable:
    fontSize: 13px
rounded:
  # Tailwind's names. shadcn's --radius is 6px (lg); shadcn derives md as --radius - 2px (4px). Its sm (2px) and xl (10px) are unused.
  md: 4px
  lg: 6px
  full: 9999px
spacing:
  # 8px grid with 4px steps; Tailwind's 4px-based scale is inherited.
  unit: 8px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  # compact metrics (default density)
  control-height: 28px
  header-row: 32px
  toolbar-row: 32px
  bottom-bar: 48px
  # layout
  viewport-floor: 1280px
  outline-rail: 212px
  context-column: 360px
  excerpt-max-height: 320px
  side-sheet: 560px
  # comfortable density: the same keys with the -comfortable suffix, deltas only
  sm-comfortable: 12px
  md-comfortable: 16px
  lg-comfortable: 24px
  xl-comfortable: 32px
  control-height-comfortable: 32px
  header-row-comfortable: 40px
  toolbar-row-comfortable: 36px
  bottom-bar-comfortable: 56px
elevation:
  # Outside the spec's token groups (see Elevation & Depth). CSS variables --shadow-*, read by Tailwind's shadow utilities.
  shadow-sm: '0 1px 2px rgba(43, 39, 34, 0.06)'
  shadow-md: '0 4px 8px -2px rgba(43, 39, 34, 0.12), 0 2px 4px -2px rgba(43, 39, 34, 0.08)'
  shadow-lg: '0 12px 24px -6px rgba(43, 39, 34, 0.16), 0 4px 8px -4px rgba(43, 39, 34, 0.10)'
  shadow-sm-dark: '0 1px 2px rgba(10, 9, 8, 0.40)'
  shadow-md-dark: '0 4px 8px -2px rgba(10, 9, 8, 0.50), 0 2px 4px -2px rgba(10, 9, 8, 0.40)'
  shadow-lg-dark: '0 12px 24px -6px rgba(10, 9, 8, 0.60), 0 4px 8px -4px rgba(10, 9, 8, 0.45)'
components:
  context-header:
    background: '{colors.card}'
    border: '{colors.border}'
    field-label: '{colors.muted-foreground}'
    field-label-type: '{typography.label}'
    field-value-type: '{typography.code}'
    row-height: '{spacing.header-row}'
    padding-x: '{spacing.lg}'
    gap: '{spacing.md}'
    shadow: '{elevation.shadow-sm}'
  # base: every state-pill-* variant below inherits these
  state-pill:
    type: '{typography.badge}'
    radius: '{rounded.md}'
  state-pill-ask-waiting:
    background: '{colors.muted}'
    foreground: '{colors.foreground-secondary}'
    border: '{colors.border}'
    marker: '{colors.ask-waiting}'
  state-pill-ask-partial:
    background: '{colors.card}'
    foreground: '{colors.foreground}'
    border: '{colors.border-strong}'
    marker: '{colors.ask-partial}'
  state-pill-ask-answered:
    background: '{colors.success-subtle}'
    foreground: '{colors.success-text}'
    marker: '{colors.ask-answered}'
  state-pill-ask-closed:
    background: '{colors.muted}'
    foreground: '{colors.foreground}'
    border: '{colors.border-strong}'
    marker: '{colors.ask-closed}'
  state-pill-ask-discarded:
    background: '{colors.destructive-subtle}'
    foreground: '{colors.destructive-text}'
    marker: '{colors.ask-discarded}'
  state-pill-agent-working:
    background: '{colors.agent-subtle}'
    foreground: '{colors.agent-text}'
    marker: '{colors.agent}'
  state-pill-agent-waiting:
    background: '{colors.muted}'
    foreground: '{colors.foreground-secondary}'
    border: '{colors.border}'
    marker: '{colors.agent-waiting}'
  outline-navigator:
    width: '{spacing.outline-rail}'
    background: '{colors.background}'
    divider: '{colors.border}'
    padding: '{spacing.sm}'
    entry-gap: '{spacing.xs}'
    current-indicator: '{colors.primary}'
  question-card:
    background: '{colors.card}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    question-type: '{typography.question}'
    padding: '{spacing.lg}'
    gap: '{spacing.md}'
  question-marker-held:
    marker: '{colors.ask-answered}'
    shape: dot-in-ring
  question-marker-postponed:
    marker: '{colors.muted-foreground}'
    shape: pause
  question-marker-declined:
    marker: '{colors.foreground-secondary}'
    shape: slashed-ring
  question-loading:
    background: '{colors.muted}'
    label: '{colors.muted-foreground}'
    label-type: '{typography.body}'
    radius: '{rounded.md}'
  section-label:
    foreground: '{colors.muted-foreground}'
    type: '{typography.label}'
  header-chip:
    background: '{colors.muted}'
    border: '{colors.border}'
    foreground: '{colors.foreground-secondary}'
    type: '{typography.badge}'
    radius: '{rounded.md}'
  option:
    background: '{colors.card}'
    border: '{colors.border}'
    radio-border: '{colors.input}'
    selected-border: '{colors.primary}'
    selected-mark: '{colors.primary}'
    type: '{typography.body-lg}'
    padding: '{spacing.sm}'
    gap: '{spacing.sm}'
    radius: '{rounded.md}'
  recommended-badge:
    background: '{colors.recommended-subtle}'
    foreground: '{colors.recommended}'
    border: '{colors.recommended}'
    type: '{typography.badge}'
    radius: '{rounded.md}'
  new-question-badge:
    background: '{colors.info-subtle}'
    foreground: '{colors.info-text}'
    type: '{typography.badge}'
    radius: '{rounded.md}'
  unread-reply-marker:
    background: '{colors.info-subtle}'
    foreground: '{colors.info-text}'
    type: '{typography.badge}'
    radius: '{rounded.md}'
  open-prompt:
    background: '{colors.card}'
    border: '{colors.input}'
    type: '{typography.body}'
    radius: '{rounded.md}'
  follow-up-thread:
    border: '{colors.border}'
    agent-message: '{colors.muted}'
    radius: '{rounded.md}'
  context-column:
    width: '{spacing.context-column}'
    divider: '{colors.border}'
    padding: '{spacing.lg}'
  excerpt:
    background: '{colors.card}'
    border: '{colors.border}'
    source-line-type: '{typography.code}'
    line-number: '{colors.muted-foreground}'
    max-height: '{spacing.excerpt-max-height}'
    radius: '{rounded.md}'
  reference:
    border: '{colors.border}'
    type-label: '{typography.label}'
    path: '{colors.primary-text}'
    path-type: '{typography.code}'
    hint: '{colors.muted-foreground}'
    radius: '{rounded.md}'
  reading-panel:
    width: '{spacing.side-sheet}'
    background: '{colors.popover}'
    border: '{colors.border}'
    shadow: '{elevation.shadow-lg}'
    path-type: '{typography.code}'
  settings-panel:
    # the reading panel's form (Components, Settings panel)
    width: '{components.reading-panel.width}'
    background: '{components.reading-panel.background}'
    border: '{components.reading-panel.border}'
    shadow: '{components.reading-panel.shadow}'
  setting-readonly:
    background: '{colors.muted}'
    label: '{colors.muted-foreground}'
    label-type: '{typography.label}'
    value: '{colors.foreground}'
    value-type: '{typography.code}'
    source: '{colors.muted-foreground}'
    source-type: '{typography.code}'
    padding: '{spacing.sm}'
    radius: '{rounded.md}'
  language-indicator:
    background: '{colors.muted}'
    label: '{colors.muted-foreground}'
    label-type: '{typography.label}'
    value: '{colors.foreground}'
    value-type: '{typography.body}'
    padding: '{spacing.sm}'
    radius: '{rounded.md}'
  user-annotation:
    background: '{colors.change-subtle}'
    border: '{colors.change}'
    label: '{colors.change-text}'
    radius: '{rounded.md}'
  annotation-pin:
    background: '{colors.change}'
    foreground: '{colors.change-foreground}'
    radius: '{rounded.full}'
  comment-card:
    background: '{colors.change-subtle}'
    border: '{colors.change}'
    label: '{colors.change-text}'
    type: '{typography.body}'
    padding: '{spacing.sm}'
    shadow: '{elevation.shadow-md}'
    radius: '{rounded.md}'
  change-highlight:
    mark: '{colors.change}'
    background: '{colors.change-subtle}'
    text: '{colors.change-text}'
  agent-change-notice:
    background: '{colors.info-subtle}'
    rule: '{colors.info}'
    title: '{colors.info-text}'
    foreground: '{colors.foreground}'
    type: '{typography.body}'
    padding: '{spacing.sm}'
    radius: '{rounded.md}'
  board-banner:
    border: '{colors.border}'
    type: '{typography.body}'
    padding-y: '{spacing.sm}'
    padding-x: '{spacing.lg}'
  field-error:
    foreground: '{colors.destructive-text}'
    border: '{colors.destructive}'
    type: '{typography.body}'
  approval-summary:
    background: '{colors.card}'
    border: '{colors.border}'
    title-type: '{typography.label}'
    marker: '{colors.change}'
    value-background: '{colors.change-subtle}'
    value-foreground: '{colors.change-text}'
    previous-value: '{colors.muted-foreground}'
    value-type: '{typography.code}'
    padding: '{spacing.md}'
    radius: '{rounded.md}'
  bottom-action-bar:
    background: '{colors.card}'
    border: '{colors.border}'
    height: '{spacing.bottom-bar}'
    padding-x: '{spacing.lg}'
    gap: '{spacing.sm}'
    shadow: '{elevation.shadow-sm}'
  button-primary:
    background: '{colors.primary}'
    hover: '{colors.primary-hover}'
    foreground: '{colors.primary-foreground}'
    type: '{typography.control}'
    height: '{spacing.control-height}'
    padding-x: '{spacing.md}'
    radius: '{rounded.md}'
  button-answer:
    background: '{colors.card}'
    border: '{colors.primary}'
    foreground: '{colors.primary-text}'
    hover: '{colors.primary-subtle}'
    ready-background: '{colors.primary-subtle}'
    single-question-background: '{colors.primary}'
    single-question-foreground: '{colors.primary-foreground}'
    type: '{typography.control}'
    height: '{spacing.control-height}'
    padding-x: '{spacing.md}'
    radius: '{rounded.md}'
  button-secondary:
    background: '{colors.muted}'
    border: '{colors.border}'
    foreground: '{colors.foreground}'
    type: '{typography.control}'
    height: '{spacing.control-height}'
    padding-x: '{spacing.md}'
    radius: '{rounded.md}'
  button-decision:
    background: '{colors.muted}'
    border: '{colors.border}'
    foreground: '{colors.foreground}'
    selected-background: '{colors.primary-subtle}'
    selected-border: '{colors.primary}'
    selected-foreground: '{colors.primary-text}'
    type: '{typography.control}'
    height: '{spacing.control-height}'
    padding-x: '{spacing.md}'
    radius: '{rounded.md}'
  button-link:
    background: transparent
    foreground: '{colors.primary-text}'
    hover-decoration: underline
    type: '{typography.control}'
  button-tool-active:
    background: '{colors.primary-subtle}'
    border: '{colors.primary}'
    foreground: '{colors.primary-text}'
  button-disabled:
    background: '{colors.muted}'
    foreground: '{colors.muted-foreground}'
    opacity: '0.5'
  segmented-control:
    track: '{colors.muted}'
    border: '{colors.border}'
    foreground: '{colors.muted-foreground}'
    selected-background: '{colors.card}'
    selected-foreground: '{colors.primary-text}'
    selected-weight: '600'
    selected-indicator: '{colors.primary}'
    selected-indicator-width: 2px
    height: '{spacing.control-height}'
    radius: '{rounded.md}'
  toggle-group:
    track: '{colors.muted}'
    border: '{colors.border}'
    foreground: '{colors.muted-foreground}'
    selected-background: '{colors.card}'
    selected-foreground: '{colors.primary-text}'
    selected-weight: '600'
    selected-indicator: '{colors.primary}'
    height: '{spacing.control-height}'
    radius: '{rounded.md}'
  divider:
    color: '{colors.border}'
    width: 1px
    margin: '{spacing.md}'
  focus-ring:
    color: '{colors.ring}'
    width: 2px
    offset: 1px
  # base: every status-chip-* variant below inherits these
  status-chip:
    type: '{typography.badge}'
    radius: '{rounded.md}'
  status-chip-accepted:
    background: '{colors.success-subtle}'
    foreground: '{colors.success-text}'
    marker: '{colors.success}'
  status-chip-rejected:
    background: '{colors.destructive-subtle}'
    foreground: '{colors.destructive-text}'
    marker: '{colors.destructive}'
  status-chip-warning:
    background: '{colors.warning-subtle}'
    foreground: '{colors.warning-text}'
    marker: '{colors.warning}'
  status-chip-info:
    background: '{colors.info-subtle}'
    foreground: '{colors.info-text}'
    marker: '{colors.info}'
  widget-frame:
    border: '{colors.border}'
    toolbar: '{colors.muted}'
    toolbar-height: '{spacing.toolbar-row}'
    padding: '{spacing.sm}'
    radius: '{rounded.md}'
  diff-file-header:
    background: '{colors.muted}'
    foreground: '{colors.primary-text}'
    type: '{typography.code}'
  diff-line-added:
    background: '{colors.diff-add}'
    sign: '{colors.diff-add-mark}'
  diff-line-removed:
    background: '{colors.diff-del}'
    sign: '{colors.diff-del-mark}'
  diagram:
    background: '{colors.card}'
    text: '{colors.foreground}'
    lifeline-head: '{colors.muted}'
    lifeline-head-border: '{colors.border-strong}'
    lifeline: '{colors.border-strong}'
    message: '{colors.foreground-secondary}'
    message-label-type: '{typography.code}'
    annotated-element: '{colors.change}'
  gantt-task:
    bar: '{colors.gantt-bar}'
    arrow-width: 1px
  gantt-critical:
    bar: '{colors.critical}'
    arrow-width: 2px
  gantt-user-change:
    outline: '{colors.change}'
    width: 2px
    offset: 1px
  hover:
    on-card: '{colors.muted}'
    on-muted: '{colors.card}'
    on-muted-border: '{colors.border-strong}'
    outline: '{colors.border-strong}'
    outline-width: 1px
---

# AskBoard — Design Spine

`DESIGN.md` owns how AskBoard looks; `EXPERIENCE.md` owns how it works. Both spines win on conflict with any mock in `mockups/`, Stitch output or working page in `.working/`.

**Citations.**

| Form | Means | File |
|---|---|---|
| `Lnn` | Line nn of this run's decision log | `.memlog.md` |
| `PCR-nn` | A PRD change this UX requires | `prd-change-requests.md` |
| `ACR-nn`, `S-n` | An architecture change this UX requires; a check for the renderer spike | `architecture-change-requests.md` |
| "pending" | A change request the askboard repository has not applied yet. EXPERIENCE.md, Depends on pending change requests, gives each one's fallback | — |
| `AD-nn` | An architecture decision | `ARCHITECTURE-SPINE.md` |
| `TC §x` | A section of the technical choices, whose 22 recommendations the user approved (L160). The component choices are in EXPERIENCE.md, Composition and Components | `.working/technical-choices-proposal.md` |
| `F-nn` | A validation finding; the user approved the group-B resolutions (L178) | `validation-report.md` |
| FR, NFR, SM, UJ | The AskBoard PRD's requirements, success metrics and user journeys | `prd-askboard-2026-10-25/prd.md` |
| "structural mock" | The layout variants page; variant A was chosen | [mockups/layout-split-view-variants-2026-10-27.html](mockups/layout-split-view-variants-2026-10-27.html) |
| "golden-1-base" | The Stitch proposal for the golden case | [mockups/stitch/golden-1-base.html](mockups/stitch/golden-1-base.html) |
| "colour page" | The palette page | [mockups/color-themes-1.html](mockups/color-themes-1.html) |
| "key-screen mocks" | The seven mocks drawn from these tokens, each with a PNG of the same name (L196, L206, L213) | `mockups/key-*.html` |

The PRD and the architecture are owned by the askboard repository, where they moved on 2026-10-27; they are cited here by their original folder names, which resolve under that repository's `docs/`.

## Brand & Style

AskBoard turns an agent's cryptic, acronym-heavy question into something a person can see and work on. Its design exists for one purpose: to lower the felt cognitive complexity of a problem (L116). A board may open for a single question, such as one that needs a UML diagram, and it must be as calm and effective there as on a large board with many areas. The design is judged on that single-question case, the golden case (EXPERIENCE.md, Key Flows), not on the large UJ-1 diff board (L116, L118).

AskBoard is the first product to carry the **shared AXFX family identity**. The identity is defined here first, and CueBoard and the AXFX surfaces reuse it later (L30). The character is **sober and technical** (L100). The reference is the look of Atlassian's developer documentation (L101): neutral surfaces, one restrained accent, 1px borders, small radii, a flat surface and a strong typographic hierarchy. It has no gradients, no illustrations and no decorative imagery. The reference is for the style, not the assets: no Atlassian typeface or asset ships (L104, L105). The golden-1-base screen sets the structure and character (L124): the board reads like a documentation page with one form on it.

The board is compact and tool-like by default, with a comfortable density that the user can switch to (L36). Motion is minimal and is used only where it helps the experience (L102). No anti-references were named (L107).

**UI system.** The UI system is shadcn/ui on Radix and Tailwind (L31). The tokens below extend shadcn's defaults. Components this file does not override inherit shadcn's visual specs with these tokens.

**Engineered for swapping.** The palette and the font pairing are both meant to be replaced later without touching components (L103). Colours and fonts are therefore layered (see Colors and Typography), and components read only the top layer.

## Colors

### Token layers

| Layer | What it holds | Where |
|---|---|---|
| 1. Primitives | The palette's raw hex values | The Light and Dark columns below |
| 2. Semantic roles | What a colour is for: page, sunken surface, accent, user change, agent working, ask answered… | The Role column below |
| 3. CSS variables | shadcn/ui variable names plus the AskBoard extensions | The YAML `colors` keys, as `--<key>` |

**Swap rule.** Components and Tailwind classes read only layer 3. A palette swap re-points the roles at other primitive values and leaves layer 3's names and every component unchanged. The aliases (below the main groups in the YAML) are set in CSS as `var(--target)`, the same in light and dark, and the shadcn aliases keep their targets in every palette. The YAML shows them resolved to hex.

**Modes.** Light is the base scheme, held by the unsuffixed keys, and dark uses the same keys with the `-dark` suffix. The board follows the system preference, and the header's Theme control sets System, Light or Dark (L24, F-78; behaviour in EXPERIENCE.md).

**Dark theme mechanism.** Both token sets become CSS variables, and a `.dark` class on the view root switches from light to dark. No theme library is used: next-themes writes browser storage, which the board's sandboxed view forbids (L160, S-5; AD-8). Canvas components such as the Chart rebuild their theme from the resolved variables on a switch. Diagrams re-render with the dark diagram theme (Diagram theme, below) rather than sitting on a light panel (L160). A Snapshot carries both token sets and a light and a dark render of every diagram. With no board page around it, it opens in the theme the board had when it was taken, System following the viewer's system theme, and the quick toggles switch it without saving (TC §2.2, F-14, F-69). [key-golden](mockups/key-golden.html) shows the board and its diagram in both modes, and [key-snapshot-view](mockups/key-snapshot-view.html) a Snapshot in both system themes.

**shadcn aliases.** `card-foreground`, `popover-foreground`, `secondary-foreground` and `accent-foreground` point at `foreground`; `secondary` and `accent` point at `muted`; `input` points at `border-strong`. They are not in the palette table.

### The palette: Warm Paper & Petrol

The first AXFX family palette is variation 3 of the colour page, "Warm Paper & Petrol", in light and dark (L130; [colour page](mockups/color-themes-1.html)). [key-golden](mockups/key-golden.html) shows it in light and dark side by side. It pairs warm stone neutrals, like paper, with a deep petrol accent (`#0b6e7f`) at standard contrast. The register is calm and low-glare for long reviews. In this palette, info joins the accent family (petrol), as Atlassian does with blue. The agent takes indigo and the user's changes a plum magenta, so the two voices sit far apart on the hue wheel (colour page). In the table, † marks an AskBoard extension beyond shadcn's variables, and → an alias with its target.

| Group | Role (layer 2) | Variable (layer 3) | Light | Dark |
|---|---|---|---|---|
| Surfaces | page | `background` | `#f7f5f0` | `#1b1916` |
|  | surface · card | `card` | `#fffdf9` | `#23201c` |
|  | sunken · toolbars, chips, read-only rows | `muted` | `#f0ece4` | `#161411` |
|  | overlay | `popover` | `#fffdf9` | `#2c2925` |
| Borders | default | `border` | `#e3ddd2` | `#3a352f` |
|  | strong · inputs | `border-strong` † | `#8f877a` | `#7a7266` |
| Text | primary | `foreground` | `#2b2722` | `#ebe6dd` |
|  | secondary | `foreground-secondary` † | `#554e45` | `#c8c0b4` |
|  | muted | `muted-foreground` | `#6b6358` | `#a39a8d` |
|  | on accent | `primary-foreground` | `#ffffff` | `#10201f` |
| Accent | default | `primary` | `#0b6e7f` | `#5fb4c2` |
|  | hover | `primary-hover` † | `#085866` | `#82c6d1` |
|  | subtle background · pressed and selected fill | `primary-subtle` † | `#e3f0f0` | `#183033` |
|  | text on surfaces · links, paths | `primary-text` † | `#0a6474` | `#6fc0cd` |
|  | focus ring | `ring` | `#2a8a9a` | `#82c6d1` |
| User change | mark · line, pin, outline | `change` † | `#a3336f` | `#db7fb2` |
|  | pin label | `change-foreground` † | `#ffffff` | `#1b1916` |
|  | highlight background | `change-subtle` † | `#f9ecf2` | `#3a1f2e` |
|  | text on highlight | `change-text` † | `#8a2a5d` | `#eeaacf` |
| Agent state | working · dot | `agent` † | `#4057b2` | `#8b9fe8` |
|  | working · background | `agent-subtle` † | `#eceff9` | `#222943` |
|  | working · text | `agent-text` † | `#34489a` | `#b0bef2` |
|  | waiting for an answer · dot | `agent-waiting` † → `muted-foreground` | `#6b6358` | `#a39a8d` |
| Status | success · accepted | `success` † | `#3d7a35` | `#79b56b` |
|  | success · subtle | `success-subtle` † | `#ecf3e4` | `#1f2b1b` |
|  | success · text | `success-text` † | `#2f6428` | `#9fcd92` |
|  | danger · rejected, removed, errors | `destructive` | `#b42335` | `#e0626e` |
|  | danger · subtle | `destructive-subtle` † | `#fbeaeb` | `#3b1c20` |
|  | danger · text | `destructive-text` † | `#9b1d2d` | `#f09aa2` |
|  | danger · on solid | `destructive-foreground` | `#ffffff` | `#1b1916` |
|  | warning · below threshold | `warning` † | `#a87410` | `#ddb04a` |
|  | warning · subtle | `warning-subtle` † | `#fbf1da` | `#33280f` |
|  | warning · text | `warning-text` † | `#7a5006` | `#e9c46a` |
|  | info | `info` † | `#1b7f8f` | `#5fb4c2` |
|  | info · subtle | `info-subtle` † | `#e3f0f0` | `#183033` |
|  | info · text | `info-text` † | `#0a6474` | `#82c6d1` |
| Ask states (marker) | waiting | `ask-waiting` † → `muted-foreground` | `#6b6358` | `#a39a8d` |
|  | partly answered | `ask-partial` † → `foreground-secondary` | `#554e45` | `#c8c0b4` |
|  | answered | `ask-answered` † → `success` | `#3d7a35` | `#79b56b` |
|  | closed | `ask-closed` † → `foreground-secondary` | `#554e45` | `#c8c0b4` |
|  | discarded | `ask-discarded` † → `destructive` | `#b42335` | `#e0626e` |
| Diff | added line | `diff-add` † | `#e6f0dc` | `#1f2b1b` |
|  | added mark | `diff-add-mark` † | `#3d7a35` | `#8cc47e` |
|  | removed line | `diff-del` † | `#f8e3e3` | `#3b1c20` |
|  | removed mark | `diff-del-mark` † | `#b42335` | `#ec8590` |
| Gantt | task bar | `gantt-bar` † | `#8f877a` | `#7a7266` |
|  | critical path | `critical` † → `foreground` | `#2b2722` | `#ebe6dd` |
| Chart | series 1 · blue | `chart-1` † | `#2a78d6` | `#3987e5` |
|  | series 2 · orange | `chart-2` † | `#eb6834` | `#d95926` |
|  | series 3 · aqua | `chart-3` † | `#1baf7a` | `#199e70` |
|  | series 4 · violet | `chart-4` † | `#6250d6` | `#9085e9` |
|  | series 5 · yellow | `chart-5` † | `#eda100` | `#c98500` |
| Recommended badge | text, border | `recommended` † → `agent-text` | `#34489a` | `#b0bef2` |
|  | background | `recommended-subtle` † → `agent-subtle` | `#eceff9` | `#222943` |
| Syntax | keywords | `syntax-keyword` † | `#6b3fa0` | `#c3a6f0` |
|  | strings | `syntax-string` † | `#1d6b52` | `#8fd1b0` |
|  | numbers, booleans, constants | `syntax-number` † | `#9a4a0b` | `#f0a875` |
|  | function, class and type names | `syntax-function` † | `#2b5c8a` | `#8fbde8` |
|  | comments | `syntax-comment` † → `muted-foreground` | `#6b6358` | `#a39a8d` |

### Colour role rules (valid for any palette)

These rules come from L132 and the colour page's role conventions. A future palette keeps them.

- **Brand colour.** The brand colour is `{colors.primary}`. shadcn's `accent` is a hover surface (an alias of `muted`), never the brand colour (L132); it is not the hover look of controls that rest on `muted`, where it would not show. A `hover` token pair gives it: `hover.on-card` is `{colors.muted}`, for rows, option rows and cards; `hover.on-muted` is `{colors.card}` with a 1px `{colors.border-strong}` border, for toolbar buttons that rest on `muted`; `hover.outline` is a 1px inset `{colors.border-strong}`, added to editable cells, which has 3.49:1 and is neither the 2px focus ring nor the plum change border. `{colors.primary-hover}` and `{colors.primary-subtle}` stay for the buttons that have them. Disabled controls take no hover.
- **Accent.** The accent marks what is interactive and selected (colour page): links and link-weight actions, the Answer button, a selected option, the pressed and selected states, the selected segment's underline and the outline navigator's current entry. The user confirmed these uses of the accent on the key-screen mocks (L197).
- **Agent hue.** The agent hue is the agent's voice: "Agent: Working", and the Recommended badge as its alias (`recommended` → `agent-text`) (L132).
- **User-change hue.** The user-change hue is the user's voice: annotation pins, comment cards, changed values and the change highlight. It is never shared with warning or with agent state (L132). Anything the user did takes it, and the shape tells the kind of change: an added element is solid, a removed one is dashed (an edge, a bar) or struck through (text, a line), and a changed value sits on the change fill (F-51).
- **Waiting.** Waiting is neutral grey everywhere: the ask waiting, and the agent waiting for an answer (L132). The partly answered state is neutral too, so it never reads as an accent control (F-92).
- **Warning.** Warning is only for thresholds, such as a margin below the agent's minimum (L132, L75).
- **Danger.** Danger is for what a proposed change removes, what was rejected, what failed and what was lost: the diff's removed lines, with their "−" sign; "Rejected" chips, with their text; errors (`field-error`), with their message; and the discarded ask. It never marks something the user removed or changed, which takes the change hue (F-51; colour page).
- **Info.** Info marks news the user has not seen yet and neutral information: the agent-change notice, the new-question badge, the unread-reply marker, the board-moved banner and info chips (F-20, F-34, F-55; confirmed, L197).
- **Critical path.** The Gantt critical path has its own token, `{colors.critical}`, so it never reads as danger (L132). In this palette it points at `foreground`: critical tasks are solid dark bars with heavier dependency arrows, set apart from the other bars by lightness and stroke weight rather than by a red or orange hue, which sat within 50° of the change and danger hues (F-51; confirmed, L197).
- **Selection beyond hue.** A selected segment is semibold with a 2px `{colors.primary}` underline (F-92; confirmed, L197). A pressed tool, an answer marked ready and a selected Approval decision take the pressed fill, `{colors.primary-subtle}` with a `{colors.primary}` border, and the decision adds a ✓.
- **Markers.** Every state pill, status chip and question marker pairs its colour with a marker shape (colour page, F-08):
  - a hollow ring for waiting and unanswered;
  - a half-filled dot for partly answered;
  - a filled dot for answered, working, accepted, rejected and info;
  - a dot in a ring for an answer marked ready that Submit has not sent yet (held);
  - two short upright bars, like a pause sign, for postponed;
  - a ring with a diagonal slash for declined;
  - a square for closed;
  - a bar for discarded;
  - a triangle for warning.

### Syntax highlighting

Code in Diff review and every source view is highlighted through five tokens, never through colour styles written into markup, which the view CSP drops (L160). The highlighter's token scopes map onto them: `{colors.syntax-keyword}`, `{colors.syntax-string}`, `{colors.syntax-number}` (numbers, booleans, constants), `{colors.syntax-function}` (function, class and type names) and `{colors.syntax-comment}`. Everything else is `{colors.foreground}`. In Diff review, `@pierre/diffs` gives no token classes: its CSS-variables theme points each scope at the token's CSS variable, applied through the CSSOM, and the `.dark` class re-points them with no re-render (renderer spike). Each token is checked as text on `card`, `diff-add` and `diff-del` (Contrast). Highlighting is on in the first version, for a fixed list of languages (renderer spike). The palette is confirmed (L197).

### Diagram theme

The `diagram` component tokens resolved in light are the light diagram theme, and resolved with their `-dark` values they are the dark diagram theme (F-06). Each render sets them on the renderer: Mermaid's `base` theme with these `themeVariables` (plus `darkMode: true` for the dark render), and PlantUML's skinparams.

| `diagram` token | Mermaid | PlantUML skinparam |
|---|---|---|
| `background` → `{colors.card}` | `background` | `BackgroundColor` |
| `text` → `{colors.foreground}` | `textColor`, `primaryTextColor`, `actorTextColor`, `signalTextColor` | `DefaultFontColor` |
| `lifeline-head` → `{colors.muted}` | `actorBkg`, `primaryColor`, `mainBkg` | `ParticipantBackgroundColor`, `ActorBackgroundColor` |
| `lifeline-head-border` → `{colors.border-strong}` | `actorBorder`, `primaryBorderColor`, `nodeBorder` | `ParticipantBorderColor`, `ActorBorderColor` |
| `lifeline` → `{colors.border-strong}` | `actorLineColor` | `SequenceLifeLineBorderColor` |
| `message` → `{colors.foreground-secondary}` | `signalColor`, `lineColor` | `ArrowColor` |
| `message-label-type` → `{typography.code}` | the sequence config's `messageFontFamily` and `messageFontSize` | `ArrowFontName`, `ArrowFontSize` |
| `annotated-element` → `{colors.change}` | none: AskBoard recolours the element in the SVG (Components, Diagram) | none, as for Mermaid |

### Contrast

The colour page's calculator computed WCAG 2 ratios from the hex values, and the group-B pass added the rows for its new tokens. Every load-bearing pair meets its minimum in both modes. Accessibility is best effort, so a pair below its minimum is reported, not blocking (L27, L28; colour page).

| Pair | Kind, minimum | Light | Dark |
|---|---|---|---|
| Primary text / page | text, 4.5:1 | 13.61 | 14.11 |
| Primary text / surface | text, 4.5:1 | 14.60 | 13.05 |
| Secondary text / surface | text, 4.5:1 | 8.07 | 9.00 |
| Muted text / page | text, 4.5:1 | 5.43 | 6.32 |
| Muted text / sunken | text, 4.5:1 | 5.02 | 6.62 |
| Accent text / surface | text, 4.5:1 | 6.69 | 7.80 |
| Accent text / pressed fill | text, 4.5:1 | 5.83 | 6.69 |
| On-accent / accent | text, 4.5:1 | 5.91 | 7.04 |
| On-danger / danger | text, 4.5:1 | 6.50 | 5.13 |
| Error text / surface | text, 4.5:1 | 7.93 | 7.61 |
| Input border / surface | UI mark, 3:1 | 3.49 | 3.42 |
| Focus ring / surface | UI mark, 3:1 | 3.97 | 8.45 |
| Hover outline / surface | UI mark, 3:1 | 3.49 | 3.42 |
| Selected underline / track | UI mark, 3:1 | 5.02 | 7.70 |
| Change line, pin / surface | UI mark, 3:1 | 6.34 | 5.94 |
| Change text / change bg | text, 4.5:1 | 7.12 | 7.97 |
| Pin label / pin | text, 4.5:1 | 6.44 | 6.42 |
| Success text / subtle | text, 4.5:1 | 6.22 | 8.19 |
| Danger text / subtle | text, 4.5:1 | 6.93 | 7.17 |
| Warning text / subtle | text, 4.5:1 | 6.28 | 8.66 |
| Warning mark / surface | UI mark, 3:1 | 4.00 | 8.02 |
| Info text / subtle | text, 4.5:1 | 5.83 | 7.25 |
| Agent text / agent bg | text, 4.5:1 | 7.20 | 7.84 |
| Agent dot / agent bg | UI mark, 3:1 | 5.67 | 5.61 |
| Partly answered marker / surface | UI mark, 3:1 | 8.07 | 9.00 |
| Critical path / surface | UI mark, 3:1 | 14.60 | 13.05 |
| Critical bar / task bar | UI mark, 3:1 | 4.18 | 3.82 |
| Text / diff added | text, 4.5:1 | 12.61 | 11.90 |
| Text / diff removed | text, 4.5:1 | 12.07 | 12.31 |
| Syntax keyword / surface, diff added, diff removed (lowest) | text, 4.5:1 | 6.01 | 7.07 |
| Syntax string (lowest of the three) | text, 4.5:1 | 5.21 | 8.39 |
| Syntax number (lowest of the three) | text, 4.5:1 | 5.09 | 7.44 |
| Syntax function (lowest of the three) | text, 4.5:1 | 5.69 | 7.48 |
| Syntax comment (lowest of the three) | text, 4.5:1 | 4.81 | 5.33 |

Two distinguishability checks have no WCAG minimum (F-51). Change against critical is 2.30:1 in light and 2.20:1 in dark, and the hues differ, so a user-changed critical task stays readable. Change against danger is 1.01:1 in light and 1.25:1 in dark: colour alone cannot tell the two apart. They never meet on one element, and each carries its own shape or text (Colour role rules, User-change hue and Danger).

## Typography

**Faces.** The UI face is **Inter**, and **JetBrains Mono** sets code, paths and values. Both are under the SIL Open Font License 1.1 (L131). Both are **bundled**, because a board loads nothing from the network (AD-8) and a Snapshot opens offline (FR-27, L38). The view's CSP admits fonts only as `data:` URLs, so the faces are inlined into every board's view and every Snapshot (AD-8, AD-9; F-88).

**Font layering.** `--font-sans` and `--font-mono`, the shadcn and Tailwind theme names, point at the bundled families. Swapping the pairing changes those two variables only (colour page; L103).

**Ligatures.** Code views turn JetBrains Mono's ligatures off (`font-variant-ligatures: none`) (L131).

**Weights.** The weights are Regular 400, Medium 500 and Semibold 600 (colour page font preview).

**Compact ramp.** The base keys hold the run's compact sizes (colour page font section), with labels set in uppercase; the colour page and the structural mock add the control and badge sizes. Every compact token carries a line height (F-75).

| Token | Use |
|---|---|
| `{typography.question}` | Question text. The one large size on a board |
| `{typography.body-lg}` | Option labels, area headings (at Semibold 600), the document in Document review |
| `{typography.body}` | Default board text: option descriptions, follow-up messages, open prompt, notices, banners, field errors |
| `{typography.control}` | Buttons, segmented controls, toggles |
| `{typography.badge}` | State pills, status chips, header chips, the Recommended badge, the new-question badge, the unread-reply marker, the delivery receipt |
| `{typography.label}` | Section labels, set in uppercase: "Options · pick one", "Excerpt and references", "Delivery", the context header's field labels, the settings panel's labels, the Approval summary's title |
| `{typography.code}` | Diffs, source views, excerpt text, paths, values, the context header's field values, diagram message labels, reference paths, parsed-value echoes, read-only setting values with their file and key |

**Comfortable density.** The same keys with the `-comfortable` suffix hold the deltas (L36, F-30; confirmed, L197); the badge and label sizes do not change. Switching density re-points the variables, as the `.dark` class does for colours, so components read only the base keys.

**Agent strings.** Agent-written labels keep their type token and are cut with an ellipsis at their length limits (Components, Agent-written labels).

## Layout & Spacing

- **Platform.** Desktop and laptop only, with a viewport floor of `{spacing.viewport-floor}`. There is no tablet or phone layout (L25).
- **Grid.** The grid is 8px (`{spacing.unit}`), with 4px steps for tight gaps; the scale runs from `{spacing.xs}` to `{spacing.xl}`. The scale comes from the Stitch design system behind golden-1-base, and Tailwind's 4px-based scale is inherited.
- **Density.** Compact is the default, and the user can switch to comfortable (L36). The component tokens carry the compact metrics (F-74):
  - controls are `{spacing.control-height}` high, header rows `{spacing.header-row}`, widget toolbars `{spacing.toolbar-row}` and the bottom action bar `{spacing.bottom-bar}`;
  - a question card is padded `{spacing.lg}`, with `{spacing.md}` between its elements, and option rows are padded `{spacing.sm}`.

  Comfortable re-points `sm`, `md`, `lg`, `xl` and the four heights to their `-comfortable` values, which follow golden-1-base's roomier metrics (F-30; confirmed with the excerpt cap, L197).
- **Board frame**, top to bottom (L46, L110; [structural mock](mockups/layout-split-view-variants-2026-10-27.html), variant A):
  - the context header, sticky, in two rows, with the board banner under it when one shows;
  - the body: the outline navigator as a sticky left rail of `{spacing.outline-rail}` on the page background, then the content column; in the one-question-per-view presentation there is no rail, and the question navigator sits above the question card and scrolls with it (L211);
  - the bottom action bar, sticky.
- **Question card.** A question with excerpts splits into the question column and a context column of fixed width `{spacing.context-column}`. That is about a third of the card's width at the 1280px floor (L106, L110). A rule in `{colors.border}` separates the two columns. A question without excerpts takes the card's full width (L106). A question whose excerpts all fail to resolve does not split: its unresolved pointers show inline under the question text (F-104).
- **Wide widgets.** In a split card, the question text, the options and the context column sit side by side, and a wide widget spans the full card width below them: Diff review, Graph, Table, Spreadsheet, Tree, Gantt, Timeline and Kanban, and the molecules built on them. The widget starts below both columns, even when a taller context column leaves empty space under the options (L199). Diff review opens in Unified view when the widget is narrower than about 900px (F-47). [key-uj1-diff-review](mockups/key-uj1-diff-review.html) and [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html) show wide widgets under split cards.
- **Single-question board.** The board has no outline navigator, and the question card takes the whole content width (L120). The split rule still applies, as in the golden case. A one-question ask never shows the question navigator, whatever presentation the agent asked for (F-100), nor the open count and the next-open jump (L198). The bottom action bar holds only "Snapshot", with no delivery switch, no "Select recommended" and no Submit (L168), so Answer is the board's only primary action (Components, Answer).
- **Above and below the floor.** Not recorded below the floor or above it (Open Items, 5).

## Elevation & Depth

The surface is **near flat** (L101; golden-1-base). Hierarchy comes from three tonal surfaces and 1px borders, never from shadow:
- `{colors.background}` for the page;
- `{colors.card}` for cards, the header and the bottom action bar;
- `{colors.muted}` for toolbars, chips, read-only rows and sunken areas.

Shadows mark only what sticks or floats. They are tinted with the palette's warm neutral: `foreground` in light, a warm near-black in dark (F-31; confirmed, L197). The values are in the YAML `elevation` group, which sits outside the spec's token groups (see Open Items).

| Token | Light | Dark (`-dark`) | Used on |
|---|---|---|---|
| `{elevation.shadow-sm}` | 1px, 6% | 1px, 40% | The sticky context header; the sticky bottom action bar casts it upward |
| `{elevation.shadow-md}` | 4px, 12% | 4px, 50% | Floating cards and menus: the comment card, the More menu, the Kanban "Move to…" menu, popovers such as the Date Picker and Select |
| `{elevation.shadow-lg}` | 12px, 16% | 12px, 60% | Panels and dialogs: the settings panel, the reading panel, the mode-switch confirmation and any delete confirmation |

Overlays sit on `{colors.popover}`, which in dark is also lighter than `card`, so they rise by tone as well. Cards, inputs and buttons cast no shadow: shadcn's default `shadow-xs` on Input and Button and `shadow-sm` on Card are removed, so the inherited utilities never thicken the flat surface.

## Shapes

The radius tokens take Tailwind's names, and shadcn's `--radius` is 6px, so shadcn's derived scale lands on the recorded radii (F-91):

- **`{rounded.md}`, 4px** (`--radius` − 2px, Tailwind `rounded-md`, which shadcn's Button and Input use): controls, inputs, the open prompt, option rows, chips, pills, badges, reference chips, read-only rows, notices, comment cards, Kanban cards and widget frames (golden-1-base; colour page).
- **`{rounded.lg}`, 6px** (`--radius`, `rounded-lg`): the question card, the outer container of a question (golden-1-base).
- **`{rounded.full}`:** annotation pins and status dots only.

shadcn's derived `rounded-sm` (2px) and `rounded-xl` (10px) are not used. The small radii keep the board reading as a tool. Nothing in the records asks for larger radii.

## Components

These are visual specs only; behaviour lives in EXPERIENCE.md, Component Patterns, under the same names and in the same order. Tokens are in the YAML `components` map. Shared controls (`button-*`, the segmented control, the status chip, the focus ring) are under Base controls; Field error and Change highlight are under Changes, values and board states. Every row ends with its mock: "Mock:" names the key-screen mock or earlier artifact that draws it, and "Not mocked" names what no mock draws yet (see Open Items). The seven key-screen mocks are defined in the Citations above. A label marked **provisional** is a string the mocks had to invent, listed for review in EXPERIENCE.md, Voice and Tone (L200).

### Board chrome

| Component | Visual spec |
|---|---|
| **Context header** | Sticky, on `{colors.card}` with a bottom border and `{elevation.shadow-sm}`, in two rows of `{spacing.header-row}` (L110). Row 1: who asked ("Main agent · <name>") on the left, then the labelled fields Project, Directory, Branch and Worktree on the right, as plain text with no chip or box (L200). Labels are in `{typography.label}` and `{colors.muted-foreground}`; values are in `{typography.code}` (golden-1-base). Row 2: an "Ask" label (provisional), the ask state pill, the agent state pill, the open count, the next-open jump (in the one-question-per-view presentation it moves to the question navigator, L210), the unread-reply count when a reply is unread (F-20) and the agent-change flag (L58), then the quick toggles and Settings on the right. A 1px `{colors.border}` separator sits before the open count and another before Settings (key-screen mocks). On a single-question board the open count and the next-open jump do not show (L198). Every field keeps its text label. Mock: [key-golden](mockups/key-golden.html). |
| **Agent-written labels** | Header chips, tab labels, outline entries, the agent's name in the context header and option labels keep their own type token and are cut with an ellipsis at their length limits (EXPERIENCE.md). The full text shows on hover and on keyboard focus, in a tooltip on `{colors.popover}` with `{elevation.shadow-md}` and `{typography.body}`. Agent strings are isolated for bidirectional text, and bidi control characters in paths, IDs and notifications show as visible escapes in `{typography.code}` and `{colors.muted-foreground}` (F-64). Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html), for the ellipsis on reference paths; not mocked: the tooltip and the escapes. |
| **State pill** | A `{typography.badge}` pill with a marker (Colors, Markers). The seven variants are the `state-pill-*` component tokens, on the shared `state-pill` base (colour page). The agent pill reads "Agent: Working" as `state-pill-agent-working`, or "Agent: Waiting for your answer" as `state-pill-agent-waiting`, in neutral grey. The partly answered pill sits on `{colors.card}` with a `{colors.border-strong}` border and a neutral half-filled dot, so it never reads as a selected control (F-92). Mock: [key-golden](mockups/key-golden.html); not mocked: the partly answered, closed and discarded pills. |
| **Next-open jump** | A secondary button ("Next open ↓") beside a bold count ("2 open") in header row 2 (structural mock, F-08). What the count includes follows EXPERIENCE.md's counting rule. Neither shows on a single-question board (L198). In the one-question-per-view presentation the count stays in header row 2, and the button moves to the right end of the question navigator, reading "Next open →" (L210). Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html). |
| **Quick toggles** | Header row 2, right side: the Theme control, a "System \| Light \| Dark" segmented control after a "Theme" label (provisional) (F-78), and a "Compact \| Comfortable" segmented control (structural mock, golden-1-base). There is no language control (L169). Mock: [key-golden](mockups/key-golden.html). |
| **Key tooltip** | `key-tooltip`: the tooltip of a control whose action has keys, on hover and on keyboard focus, closed by Escape. It is the agent-written labels' tooltip (`{colors.popover}`, `{elevation.shadow-md}`, `{typography.body}`) holding the action's name and then each key combination as key caps: a cap is `{typography.code}` on `{colors.muted}` with a 1px `{colors.border}` and Tailwind's small radius, one cap per key, a combination's caps side by side and its alternatives (Alt+Shift+Home, Ctrl+Shift+↑) one after the other. Keys are written as the platform names them (⌥⇧↑ on macOS, Alt+Shift+↑ elsewhere). An action whose keys the user took away keeps its tooltip with the name alone. The same caps stand at the end of a menu item (the Ranking's "More" menu), after its name and aligned right, in place of a tooltip, which a menu's own focus handling would fight; they are hidden from assistive technology, since the item announces its keys itself, and an item with no key or whose keys the user took away shows none. Not mocked. |
| **Keys button** | `button-secondary`, labelled "Keys", the last stop of a widget's toolbar and never in "More"; beside the counter where the widget has no toolbar. Its tooltip is "Keys" with the keys that open the panel (`?` by default). Opens the keys panel. Not mocked. |
| **Keys panel** | `keys-panel`: a non-modal popover anchored to the Keys button, on `{colors.popover}` with `{elevation.shadow-md}`. It has no visible title: "<Widget> keys" is the popover's accessible name. The body lists the widget's keys in effect by group (Move around, Select, Move items, Edit, Other), each group title in `{typography.body}` at Semibold 600 and `{colors.foreground}`, each action a row with its name in `{typography.body}` and its key caps at the right, alternatives one after the other; "Close", a `button-secondary`, comes last, at the right end. An action whose keys the user changed carries " · customised" in `{typography.label}` and `{colors.muted-foreground}` after its name and shows the new keys; an action with its keys taken away shows "no key" in `{colors.muted-foreground}` in place of the caps. A read-only widget lists only the keys that still act. Escape or "Close" closes it. Not mocked. |
| **Settings panel** | **Surface.** `settings-panel`, in the Reading panel's form (Context, Reading panel): the same side sheet, surface, width and shadow, opened by the "Settings" button at the right end of header row 2 (L204).<br>**Anatomy.** A header, with a bottom border, holds the title "Settings", semibold, and the close control, a square `button-secondary` with ✕. The body holds three groups separated by `{colors.border}` rules (L211):<br>• the presentation preferences, its only editable rows, each a label in `{typography.label}` and `{colors.muted-foreground}` beside a segmented control: Theme ("System \| Light \| Dark"), Density ("Compact \| Comfortable") and Context placement ("Beside \| Inline") (L171; pending ACR-02), then a read-only Keys row (`setting-readonly`) reading "Default keys" or "2 actions changed", with the user file and key `keys` under it and the note "Applies to boards opened after a change";<br>• the board's language (Language indicator);<br>• the behavioural settings, under the group note "Applies from the next session" in `{typography.body}` and `{colors.muted-foreground}`, each a read-only setting: default language, asking rules, Snapshot folder and editor (L171).<br>The labels and the group note are provisional (L209).<br>**States.** A failed or refused write shows a `field-error` under its row, with the settings file's path (F-80). A configuration file that is not applied shows once, above the behavioural group, as a `field-error` with the file's path and its problem. A row's warning (an unknown key, an editor set in the project file, a Snapshot folder outside the project, a project file's `keys` that are ignored, a user file's `keys` not applied with the problem in words) sits under its file line in `{typography.body}` and `{colors.muted-foreground}`. A presentation preference set in the project file shows as a read-only setting in place of its segmented control.<br>Mock: [key-settings-panel](mockups/key-settings-panel.html); not mocked: the failed write. |
| **Read-only setting** | `setting-readonly`: a row on `{colors.muted}` with no input border, so it never reads as a field. The label sits on top, in `{typography.label}` and `{colors.muted-foreground}`, then the value in `{typography.code}` and `{colors.foreground}`. Under the value, the file and key to edit, in `{typography.code}` and `{colors.muted-foreground}`, selectable as text (L171). Mock: [key-settings-panel](mockups/key-settings-panel.html). |
| **Language indicator** | `language-indicator`: the board's current language and locale as read-only text, such as "English (en-US)", or "English (en-US) · formats it-IT" when the formats differ, in `{typography.body}`, under a "Language" label (provisional), alone in the settings panel's second group (L211). It takes the read-only setting's look without the file line, since the agent sets the language per ask (L169, L179). No control anywhere on the board changes the language. Mock: [key-settings-panel](mockups/key-settings-panel.html). |
| **Outline navigator** | A sticky left rail, `{spacing.outline-rail}` wide, on the page background (`{colors.background}`) with a `{colors.border}` divider, and its entries carry no box or fill (L200). It scrolls on its own (F-94). Under an "Outline" section label it shows the area names, semibold, and under each a compact entry per question: header chip, question text in `{typography.body}`, and a state line: the question's marker with its state label in `{typography.badge}` and `{colors.foreground-secondary}` (Question marker; the ready and postponed labels are provisional). At the entry's right end sit, when they apply, the new-question badge, the unread-reply marker and the agent-change flag. The entry of the question in view carries a 2px `{colors.primary}` bar on its left (F-94). Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html); not mocked: the badges and the flag on an entry. |
| **Question navigator** | **Surface.** For the one-question-per-view presentation: a bar above the question card, on the page background with a `{colors.border}` rule under it, which scrolls with the page rather than sticking (L211). There is no outline navigator in this presentation (L121, L160).<br>**Anatomy.** On the left, "Question n of m" in `{typography.control}` at Semibold 600, then a segmented-control track (`segmented-control`) with one segment per question, holding its marker (Question marker). On the right, Previous and Next as `button-secondary`, then, after a 1px `{colors.border}` separator, the next-open jump as `button-secondary`, reading "Next open →" (L210).<br>**States.** The question in view is the selected segment, on `{colors.card}` with the 2px `{colors.primary}` underline (L211). Previous and Next take `button-disabled` at the ends of the list (F-61). An added question's marker carries the new-question badge, and when the agent deletes the question in view, the bar shows "Question removed by the agent" as an `agent-change-notice` (F-55).<br>Mock: [key-one-question-per-view](mockups/key-one-question-per-view.html); not mocked: the new-question badge and the removal notice. |
| **Area** | A section heading over its questions, in `{typography.body-lg}` at Semibold 600 above a `{colors.border}` rule (L200). When areas show as tabs, each tab label carries its area's open count (L160, F-08) and, while the area holds an added question not yet seen, the new-question badge (F-55). The tab strip scrolls when the labels overflow (F-64). Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html), as sections; not mocked: areas as tabs. |
| **Top-level item** | A display-only item outside any question sits at the top of its area, or of the board when it has no areas, in a card like the question card without header chip, options, open prompt or question actions. Its outline entry has no marker (F-70). Not mocked. |
| **Bottom action bar** | **Surface.** Sticky, `{spacing.bottom-bar}` high, on `{colors.card}` with a top border and `{elevation.shadow-sm}` cast upward.<br>**Anatomy.** Left: the "Delivery" label and the delivery mode switch, then helper text in `{colors.muted-foreground}` (the submitted-delivery text is provisional). Right: "Select recommended" and "Snapshot" as secondary buttons, then "Submit" as the bar's only primary button (L109, L170; structural mock).<br>**States.** While agent-change notices on ready answers await a choice, a `button-link` beside Submit gives their number and jumps to the first (F-16). While postponed questions remain open, the left side adds a fixed line after the helper text: the `question-marker-postponed` shape, then "You have 1 postponed question: closing loses this ask" in `{typography.body}` and `{colors.foreground}`, with no fill, no warning colour (warning is for thresholds) and no dismiss control; it goes when no postponed question is left (L190). On a single-question board the bar holds only "Snapshot": no delivery switch, no "Select recommended" and no Submit, so Answer is the board's one primary (L168).<br>Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html); not mocked: the notice count beside Submit. |
| **Select recommended** | `button-secondary` in the bottom action bar, labelled "Select recommended" (L170). The options it selects take Option's selected look, like any other selection. It is hidden when no question has a recommendation (F-102) and absent on a single-question board (L120). Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html). |
| **Delivery mode switch** | A segmented control, "Immediate \| Submitted". The selected mode is semibold with the 2px underline (Segmented control), so hue is not its only cue (F-92; confirmed, L197). Hidden on a single-question board (L168). Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html). |
| **Submit** | `button-primary`. It shows `button-disabled` in immediate delivery, when no answer is marked ready, while an agent-change notice on a ready answer awaits a choice, and while the connection is lost (L109, F-102, F-16, F-56). Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html). |
| **Snapshot control** | `button-secondary`, labelled "Snapshot". Its feedback shows beside it in the bar: the saved file's path in `{typography.code}` on success, or a `field-error` with the folder path when the write fails. When the user takes a Snapshot with unsent work, a note in `status-chip-info` colours first says the unsent work will not be in it (F-80). A discarded board offers no Snapshot (L137). Mock: [key-golden](mockups/key-golden.html); not mocked: the feedback, the unsent-work note and the control on a discarded board. |

### Question card

| Component | Visual spec |
|---|---|
| **Question card** | `{colors.card}`, a `{colors.border}` border and `{rounded.lg}`, padded `{spacing.lg}` with `{spacing.md}` between elements. The element order is: header chip, question, options, widget, open prompt, question actions, follow-up thread (L108, L168). The question is in `{typography.question}`. Above the options sits a section label such as "Options · pick one". Mock: [key-golden](mockups/key-golden.html). |
| **Section label** | `section-label`: an uppercase label in `{typography.label}` and `{colors.muted-foreground}` over a group on the card or in the context column: "Options · pick one", "Excerpt and references", "Delivery" (colour page; F-79). Mock: [key-golden](mockups/key-golden.html). |
| **Question actions** | The row under the open prompt: Postpone and More on the left, then the delivery receipt and Answer on the right (F-52). Mock: [key-golden](mockups/key-golden.html). |
| **Answer** | `button-answer`, at the right end of the question actions row (L168). On a board with Submit it is an outline button, `{colors.card}` with a `{colors.primary}` border and `{colors.primary-text}`, and never a second filled primary. In submitted delivery an answer marked ready shows the pressed fill, `{colors.primary-subtle}`, with the held marker inside the button, before its label (L200). On a single-question board it takes `button-primary`'s fill and is the board's only primary (L168; confirmed, L197). It shows `button-disabled` until the question has a choice, a widget change or a note (L198), and while a field check on its question fails (F-39). An empty required reason does not disable it (Open prompt). Mock: [key-golden](mockups/key-golden.html). |
| **Header chip** | A small `{typography.badge}` chip on `{colors.muted}` with a border, in `{colors.foreground-secondary}` (colour page). A held, postponed or declined question's marker sits just before it, and so does an answered question's filled dot, as the Snapshot mock draws it. Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html). |
| **Question marker** | `question-marker-held`, `question-marker-postponed` and `question-marker-declined`: the shapes of Colors, Markers, at the size of a state pill's marker, in the outline navigator, the question navigator and before the header chip (F-08). Held is a dot in a ring in `{colors.ask-answered}`: an answer marked ready with Answer in submitted delivery, which counts as answered on the board until Submit sends it (L168). Postponed is two short bars in `{colors.muted-foreground}`, and the card stays editable. Declined is a slashed ring in `{colors.foreground-secondary}`, and the card turns read-only, with the reason, if any, under the question (F-37). Unanswered and answered questions use the ask markers: a hollow ring and a filled dot. Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html); not mocked: the declined marker. |
| **Question loading** | `question-loading`: until every item of a question is ready, the card shows its header chip and question text, and each pending item as a static block on `{colors.muted}` with a short label in `{colors.muted-foreground}`. Nothing shimmers, since motion stays minimal (L102). An item that is not ready in time turns into a `field-error` in its place. The time limit is in EXPERIENCE.md (F-38, SM-C2). Not mocked. |
| **Option** | A bordered row on `{colors.card}`, padded `{spacing.sm}`, with an empty radio (or checkbox) ringed in `{colors.input}`. The label is in `{typography.body-lg}` with a description under it in `{colors.foreground-secondary}` (structural mock). A selected option fills its radio, or checks its box, in `{colors.primary}`, and its border turns `{colors.primary}`. Keyboard focus shows the focus ring on the row without the selected look (F-02). Nothing renders as selected before the user acts (L61, AD-10). A long list gains a filter field above the rows, in the input atoms' look, and never turns into a dropdown (F-23). Mock: [key-golden](mockups/key-golden.html); not mocked: the focused row and the filter field. |
| **Other row** | The last row of the options, labelled "Other…", with its own text field (L154). It follows the `option` tokens. Not mocked. |
| **Option preview** | "Show preview", a `button-link`, on an option that has one. The preview opens below the option, one at a time (L155). Not mocked. |
| **Recommended badge** | The "Recommended" badge in the agent's alias colours: `{colors.recommended}` text and border on `{colors.recommended-subtle}`. It sits beside the option label (L61; colour page). Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html). |
| **Accept recommended** | A `button-link` at the right end of the options label's row, per question, hidden on a question with no recommendation (structural mock; L200). After the click, the question shows Answer's sent or ready look (L186). Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html). |
| **Option annotation** | The agent's annotation sits under the option as an indented note with a left rule on a sunken fill, prefixed "Agent:" (structural mock). The user's own note takes the user-change colours (`user-annotation`). The "+ Add your note to this option" action is a `button-link` that shows on the selected option, and on any option under hover or focus (F-52). Whether the agent's annotation carries the agent hue is not decided. Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html); not mocked: the user's own note. |
| **Open prompt** | A multi-line field with a visible label above it, "Note for the agent (optional)" (the golden case's prompt, L118). The border is `{colors.input}`, and focus shows the focus ring. The label is never a placeholder. While "Approve with changes" is the selected decision, the label reads "Reason for the changes (required)" (F-04). Answer stays enabled: pressed with the field empty, it shows a `field-error` under the field, "Add the reason for your changes." (provisional) (L198). Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html); not mocked: the empty-reason error. |
| **Postpone** | `button-secondary`, labelled "Postpone", first in the question actions row. It shows `button-disabled` on an answered question (F-37). A postponed question carries `question-marker-postponed`. Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html). |
| **More** | A `button-secondary` labelled "More", beside Postpone. It opens a menu on `{colors.popover}` with `{elevation.shadow-md}` that holds Explain and Decline (F-52). Mock: [key-golden](mockups/key-golden.html); not mocked: the open menu. |
| **Decline** | An item of the More menu, labelled "Decline" (L153; pending ACR-08). It is disabled on an answered question (F-37). A declined question carries `question-marker-declined` and turns read-only. Not mocked. |
| **Explain** | An item of the More menu, labelled "Explain" (L152). It is disabled while its reply is pending (F-103). Not mocked. |
| **Delivery receipt** | Text in `{typography.badge}` and `{colors.muted-foreground}` beside Answer, on each delivered answer: "sent", then "delivered to the agent" (L159, F-48; pending ACR-09). An answer queued while the connection is lost shows "not sent yet" (F-56). A Snapshot keeps the receipt at the right end of the question actions row, where Answer is hidden (L211). Mock: [key-snapshot-view](mockups/key-snapshot-view.html); not mocked: "sent" and "not sent yet". |
| **Follow-up thread** | A bordered block under the question, collapsed until the user opens it (F-52). Its header row reads "Follow-up", the message count and "Collapse". Messages are separated by hairlines, each headed by the author, semibold, and the time in `{colors.muted-foreground}` ("5:42 PM" in en-US, provisional), and agent messages sit on `{colors.muted}`. The composer at the foot has a "Send" button that is secondary, never primary (structural mock; L123). When collapsed, it is one row: "Follow-up · no messages yet · Ask a follow-up". "Collapse" and "Ask a follow-up" are `button-link`s. Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html). |
| **New-question badge** | `new-question-badge`: a "New" badge in `{typography.badge}`, `{colors.info-text}` on `{colors.info-subtle}`, on a question the agent added: in its outline entry, its tab label and its question-navigator marker (F-55). Not mocked. |
| **Unread-reply marker** | `unread-reply-marker`: a badge in the same info colours with "↩" and the number of unread replies, at the right end of the question's outline entry and on its question-navigator marker. The header shows the total ("1 new reply") as a `button-link` (F-20). Not mocked. |

### Context

| Component | Visual spec |
|---|---|
| **Context column** | `{spacing.context-column}` wide, padded `{spacing.lg}`, separated from the question by a `{colors.border}` rule. It is titled "Excerpt and references" in `{typography.label}` (L110; structural mock). The "Beside \| Inline" segmented control sits in that title row and stays there in both positions (L160). When inline, the same content sits under the question text (L111). Mock: [key-golden](mockups/key-golden.html); not mocked: the inline placement. |
| **Excerpt** | A bordered card. Its caption sits on a sunken fill, `{colors.muted}`, with a bottom border: the title, semibold, then the source line in `{typography.code}` and `{colors.muted-foreground}` (path, anchor, line range) (L200). The body is always source text with line numbers, in `{typography.code}`, with the numbers right-aligned in `{colors.muted-foreground}` (L199, F-60). Code never wraps and scrolls sideways. A Markdown excerpt soft-wraps, and its continuation lines take a hanging indent under the text, so each number stays on its own source line (L199). The body caps at `{spacing.excerpt-max-height}` and scrolls inside, and the caption then offers "Open in reading panel" as a `button-link` at the right of the title (F-60). Image atoms and Diff review alternatives reuse its unresolved state (F-41). Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html); not mocked: the unresolved state. |
| **Reference** | A bordered chip on two lines in the 360px context column (L199): the type label (FILE, GITHUB…) in `{typography.label}` and `{colors.muted-foreground}`, then the path or title in `{typography.code}` and `{colors.primary-text}`; under them, right-aligned, the hint in `{colors.muted-foreground}`: "opens in a reading panel" or "opens in browser ↗". A path too long for its line is cut with an ellipsis (Agent-written labels). **Only a reference that opens in the browser carries the external-link mark** (structural mock; L123). In a Snapshot, a FILE reference shows as plain text (Snapshot view). Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html). |
| **Reading panel** | **Surface.** `reading-panel`: a non-modal side sheet that the board page renders, since the source view cannot be framed inside the sandboxed view (AD-8; pending ACR-03). It is `{spacing.side-sheet}` wide, at the right edge, over the context column and part of the question, from under the context header down to the bottom action bar, on `{colors.popover}` with a `{colors.border}` left edge and `{elevation.shadow-lg}` (F-03, L199).<br>**Anatomy.** A header, with a bottom border, holds the file path in `{typography.code}` and `{colors.foreground}`, "Open in editor" as `button-secondary` (L79) and the close control, a square `button-secondary` with ✕. The body is the token-gated source view, which shows the file as text only, in `{typography.code}` with right-aligned line numbers in `{colors.muted-foreground}`, like every source view.<br>**States** (F-40). Loading takes the question-loading look. A missing file, a path outside the ask's root or a binary file shows a one-line message in `{colors.muted-foreground}` with the path in `{typography.code}`, and "Open in editor" shows `button-disabled` for a missing file. A referenced range that changed since the ask shows "Changed since the agent asked" as a `status-chip-info` in the header.<br>Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html), section 2; not mocked: the states, the large-file state included. |

### Changes, values and board states

| Component | Visual spec |
|---|---|
| **Change highlight** | Everything the user changed against what the agent sent takes the user-change hue (L76): changed values on `{colors.change-subtle}` in `{colors.change-text}`, and changed lines, outlines and diagram elements in `{colors.change}`. A changed field or cell also takes a `{colors.change}` border, which keeps the mark at 3:1 against its surface, and a row the user added carries a 2px `{colors.change}` bar on its left edge (L200). The shape tells the kind of change (Colors, User-change hue): an added element is solid, a removed one dashed or struck through (F-51). A widget toolbar can count changes ("Your changes: 1 annotation") with a `{colors.change}` dot (colour page). Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html). |
| **Derived value** | A Value in `{typography.code}`, right-aligned in a grid. A formula error shows as a `field-error` under it and never blocks the answer (AD-13, F-39). Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html); not mocked: the formula error. |
| **Field error** | `field-error`: a one-line message under the field, or under the cell's row in a grid, in `{typography.body}` and `{colors.destructive-text}`; the field's or cell's border turns `{colors.destructive}`. The message text carries the meaning, so the error never relies on colour alone (F-39). It serves failing field checks, which block their question's Answer; formula errors, which do not (AD-13); refused number and money input (F-26); a diagram source that does not render (F-07); and failed writes (F-80). Not mocked. In a grid the message begins with the column name, is tied to the editor and is indented to the edited cell. |
| **Agent-change notice** | `agent-change-notice`: a block at the top of the changed item, on `{colors.info-subtle}` with a 3px `{colors.info}` left rule, padded `{spacing.sm}` (F-34). A title line in `{colors.info-text}` ("The agent updated this"), then what is at stake in `{colors.foreground}` ("Your 17 changes on this question"), then the actions: "Show the agent's change" as a `button-link`, which opens a read-only view of the new revision (F-19), and "Reload, losing my work" and "Keep mine" as `button-secondary` (L58). Variants: a deleted item with unsent work turns read-only under a notice reading "Removed by the agent", with a dismiss action (L60); a reopened question carries the notice reading "Reopened by the agent" (Reopened question). The outline navigator entry and the context header carry the flag, a badge in the notice's colours (L58, F-34). Not mocked. |
| **Reopened question** | The card starts from the previous answer or from the agent's revision, as its line under the title says, under an `agent-change-notice` reading "Reopened by the agent". Under the notice, the previous answer shows read-only on `{colors.muted}`, headed by a section label, with its values in `{typography.code}` and no input borders, so it never reads as editable. "Start from my previous answer" sits beside it as a `button-secondary` (F-18). Not mocked. |
| **Board banner** | `board-banner`: a full-width band directly under the context header, sticky with it, with the message in `{typography.body}` and the actions on the right as `button-secondary` (F-34). Each variant takes the colours and the marker of a state pill or chip: closed as `state-pill-ask-closed` (square), with "Snapshot"; discarded as `state-pill-ask-discarded` (bar); connection lost as `state-pill-ask-waiting` (hollow ring); board moved as `status-chip-info` (filled dot), with "Continue here" (F-58). When the ask ended with unsent work, the closed and discarded banners add "Copy my unsent work", and the locked board keeps the draft visible and selectable (F-17). The header's ask state pill shows the same state. Not mocked. |
| **Snapshot view** | **Surface.** An opened Snapshot starts with a top line above the context header that says what it is, when and by whom it was taken: "Snapshot · taken Oct 28, 2026, 4:12 PM by the agent · read-only" (provisional; L207). The line is a full-width band padded like the board banner, on `{colors.muted}` with a `{colors.border}` bottom rule, in `{typography.body}` and `{colors.foreground-secondary}`, with "Snapshot" semibold in `{colors.foreground}`; it carries no marker and no action. The Snapshot opens in the theme and density the board had, System following the viewer's system theme, and each diagram carries a light and a dark render.<br>**Anatomy.** The board under the line hides the answer, delivery and settings controls (Answer, Postpone, More, "Ask a follow-up", Settings), the whole bottom action bar and the agent state pill, which would be stale once saved; the ask state pill stays (L211). It keeps the view controls (tabs, "Split \| Unified", "Diagram \| Source", zoom, expand), the one Theme control and the density switch, the quick toggles, which switch the page and save nothing, and the delivery receipt.<br>**States.** Inputs, switches, the open prompt and the decision buttons take the read-only look of a reopened question's previous answer: `{colors.muted}` fill and no input borders (L208). The chosen decision keeps its selected look, the pressed fill and ✓, and the other decision buttons are not shown (L208). A Switch shows its state as the text "on" or "off" (provisional) in that read-only look. Changed values, a switched line included, keep the change highlight. A FILE reference shows its type, path and anchor as plain text in `{typography.code}`, with "not available in a Snapshot" in `{colors.muted-foreground}` in the hint's place, and does not open (F-69, L211).<br>Mock: [key-snapshot-view](mockups/key-snapshot-view.html). |
| **Mode-switch confirmation** | shadcn Alert Dialog by inheritance, modal, on `{colors.popover}` with `{elevation.shadow-lg}`; its scroll lock runs through the view's style-element shim (S-6). Not mocked. |
| **Invalid-link page** | A short standalone page (L41). Not mocked. |

### Primitives

The FR-13 atoms and layouts the agent composes (EXPERIENCE.md, Composition and Components). They draw on shadcn's own visual specs under these tokens and add no look of their own beyond what is listed (L160).

| Component | Visual spec |
|---|---|
| **Display atoms** | Text is default board text in `{typography.body}`; Markdown code blocks are in `{typography.code}` with ligatures off. Image is an `<img>` with its alt text. Value is in `{typography.code}`, since JetBrains Mono sets values (L131); its formula error is under Derived value. Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html), for Text and Value; not mocked: Image. |
| **Input atoms** | shadcn's Field, Label, Input, Input Group (unit and currency affixes), Textarea, Date Picker, Radio Group, Checkbox, Switch and Slider, with `{colors.input}` borders and the focus ring; never Select, which fails the view CSP (renderer spike). Labels stay visible, and a required field's label ends with "(required)". Nothing renders as set before the user acts (AD-10): an unset Toggle is a Switch drawn off with "Not set" beside it in `{colors.muted-foreground}`, and a set one reads "On" or "Off" with a "Clear" `button-link`. A MoneyField whose currency the user picks shows the codes as a segmented control after the field, none pressed until picked. A DateField's calendar opens from a button after the field, in a non-modal popover with `{elevation.shadow-md}`. NumberField and MoneyField are text inputs, never `type="number"`: the parsed value is echoed beside the field in `{typography.code}` and `{colors.muted-foreground}` ("= 12.5"), and input that is ambiguous in the board's locale shows a `field-error` (F-26). Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html) and [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html), for NumberField, MoneyField, DateField and Switch; not mocked: the parsed-value echo and the other atoms. |
| **Divider** | `divider`: the optional Divider atom, a 1px rule in `{colors.border}` with `{spacing.md}` above and below (F-79). Not mocked. |
| **Layouts** | Stack and Row add only spacing on the 8px grid, `{spacing.md}` between items; a Row's items share its width by their weights, and stack in order when one would be narrower than 240 px. Group is a titled, bordered group on shadcn's Card structure: `{colors.border}`, `{rounded.md}`, padded `{spacing.md}`, its title in `{typography.label}` and its description in `{colors.foreground-secondary}`. Tabs inside a question use shadcn Tabs; a tab whose panel holds a field to correct carries a dot in `{colors.destructive}` after its title. Not mocked. |

### Base controls

AskBoard's own chrome controls, not FR-13 atoms (TC §1.3).

| Component | Visual spec |
|---|---|
| **Button** | Six variants plus a disabled state, all in `{typography.control}` and `{spacing.control-height}` high (colour page):<br>• `button-primary`, accent fill, for the one main act in view: Submit, or Answer on a single-question board;<br>• `button-answer`, the per-question Answer (Question card, Answer);<br>• `button-secondary`, sunken fill with a border, for most actions;<br>• `button-decision`, secondary with a selected state, for Approval's decisions;<br>• `button-link`, link weight: `{colors.primary-text}` with no fill or border, underlined on hover, for light actions such as "Accept recommended", "+ Add your note to this option", "Ask a follow-up", "Show preview", "Collapse", "Open in reading panel" and "Show the agent's change" (F-77);<br>• `button-tool-active`, the pressed fill (`{colors.primary-subtle}` with a `{colors.primary}` border), for an active widget tool such as "Annotate";<br>• `button-disabled`.<br>Mock: [key-golden](mockups/key-golden.html); not mocked: `button-tool-active`. |
| **Segmented control** | A sunken track with a border, `{spacing.control-height}` high. The selected segment is on `{colors.card}` in `{colors.primary-text}`, semibold, with a 2px `{colors.primary}` underline, so it differs from the others by weight and shape as well as hue (F-92). The other segments are in `{colors.muted-foreground}` (colour page). Mock: [key-golden](mockups/key-golden.html). |
| **Toggle group** | `toggle-group`: the Scale's rating mode, a row of joined toggles, one per step, in the segmented control's look (F-79). Not mocked. |
| **Status chip** | A `{typography.badge}` chip with a marker, in four variants (`status-chip-*`) on the shared `status-chip` base: accepted, rejected, warning ("Margin 18% < 25%") and info (colour page). Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html), for accepted and rejected, and [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html), for warning; not mocked: info. |
| **Focus ring** | A 2px `{colors.ring}` outline, offset by 1px, on every focusable element (colour page, structural mock). Mock: colour page. |
| **Widget frame** | A bordered frame, `{rounded.md}`, with a `{spacing.toolbar-row}` toolbar row on `{colors.muted}` and a bottom border. The toolbar holds the widget's name, its segmented switches, its tools and its counters (structural mock, colour page). Mock: [key-golden](mockups/key-golden.html). |
| **Annotation pin** | `annotation-pin`: a `{rounded.full}` pin in `{colors.change}`, numbered in `{colors.change-foreground}`. It opens its comment card. A pin's hit region shows the focus ring on keyboard focus (golden-1-base, colour page). Mock: golden-1-base. |
| **Comment card** | `comment-card`: the card a pin opens, on `{colors.change-subtle}` with a `{colors.change}` border, `{rounded.md}` and `{elevation.shadow-md}`. A header with the pin's number in `{colors.change-text}` and, on the user's own comment, edit and delete as `button-link`s and a close control; then the comment in `{typography.body}`. While the user writes or edits, the body is a Textarea that writes into the draft as the user types, and "Done" as `button-secondary` closes the card (F-35; golden-1-base, colour page). A suggested edit's card holds the "Replace with" Textarea above the note's. Mock: golden-1-base; not mocked: the editing state. |

### Widgets

| Component | Visual spec |
|---|---|
| **Diff review** | **Surface.** In the widget frame. Its toolbar holds "Fix A \| Fix B \| A vs B", "Split \| Unified" and the file and line counts (structural mock; L69, L108).<br>**Anatomy.** Code is in `{typography.code}` with ligatures off, highlighted with the `syntax-*` tokens (Colors, Syntax highlighting). Line numbers are in `{colors.muted-foreground}`. An added line sits on `{colors.diff-add}` with its sign in `{colors.diff-add-mark}`, and a removed line on `{colors.diff-del}` with `{colors.diff-del-mark}`. A file header sits on `{colors.muted}`: a collapse chevron, the path in `{colors.primary-text}`, the file's added and removed counts, then "Accept file" and "Reject file" on the right. In "Fix A" and "Fix B" the per-line ✓ and ✕ controls are always visible, square and `{spacing.control-height}` wide. In the split view, the empty half of a row, where one side has no line, sits on `{colors.muted}` (L200). A line comment is an inline block under its line, in the comment card's colours without its shadow: `{colors.change-subtle}` with a `{colors.change}` border and `{rounded.md}`, headed by the author and line number in `{colors.change-text}`, semibold, with "Edit" as a `button-link` (L199).<br>**States.** The chosen ✓ or ✕ takes the pressed fill (L200), and decided lines carry "Accepted" or "Rejected" status chips. A rejected line is struck through (structural mock). "A vs B" shows no ✓ or ✕ and takes comments only (F-25). Unchanged context collapses into a full-width row on `{colors.muted}` in `{colors.muted-foreground}` that expands on click (its label is provisional), and a file collapses to its header (F-22). A fix whose patch file does not resolve shows disabled in the switch, and so does "A vs B" (F-41). The compact size of the per-line controls and the look of a whole-file decision are open (Open Items, 10 and 11).<br>Mock: [key-uj1-diff-review](mockups/key-uj1-diff-review.html); not mocked: "A vs B", the collapsed file and the unresolved fix. |
| **Graph** | A canvas inside the widget frame. The toolbar reads "Add state", "Add transition", "Delete", "Comment" and "Auto-layout" (L109; structural mock). Under the canvas, a checks row ("Checks · 1 cycle: …") and a changes row ("Changes vs agent's original · none yet"). User-changed nodes and edges take `{colors.change}`; a node or edge the user removed stays drawn, dashed, in `{colors.change}` (F-51). Pinned comments use `annotation-pin`. Mock: structural mock; not mocked: the change and removal marks. |
| **Diagram** | **Surface.** In the widget frame, with the tabs "Diagram \| Source", the "Annotate" tool (`button-tool-active` while on; confirmed, L197) and the counter "Your changes: N annotations", which reads "Changes vs agent's original · none yet" before the first one (provisional).<br>**Anatomy.** The diagram is drawn in the diagram theme (Colors, Diagram theme) and shown as an `<img>` from a `blob:` URL, so AskBoard never edits a live diagram DOM (AD-8). Everything interactive sits on AskBoard's **annotation overlay**: an SVG layer the size of the image, scaled with it, holding focusable hit regions, the numbered `annotation-pin`s and the selection outline. The overlay is keyed to element IDs, or quoted labels, taken from the render and recomputed on every render; it is never placed by pixel regions (L160, AD-7). Pins open comment cards (golden-1-base, colour page).<br>**States.** An annotated element is recoloured in `{colors.change}` by rewriting its stroke and fill in the SVG before it becomes a new blob, so the highlight follows the element's exact shapes. A source that does not render keeps the last good render and its pins on the Diagram tab, and shows the renderer's message and line as a `field-error` under Source (F-07).<br>Mock: [key-golden](mockups/key-golden.html); not mocked: annotations and the render error. |
| **Ranking** | A list in the widget frame, with a drop indicator while an item is dragged and "Keep this order" as a `button-secondary` (L160, TC §2.1). Each row holds a check box (`{colors.border}`, `{colors.primary}` when checked or partly, as the Tree's), a grip handle in `{colors.muted-foreground}`, its position number in `{typography.code}`, its label in `{typography.body}` and its description in `{colors.muted-foreground}`; the drop indicator is the Tree's line above or below the row. A moved row's position number takes the change highlight. The toolbar holds "Move up", "Move down", "To top", "To bottom", "Keep this order" and "Select none" as `button-secondary`s, each with a key tooltip, then "More" when the toolbar is crowded and the Keys button, and, at its right, the selected count ("2 selected", `{typography.control}` on `{colors.foreground-secondary}`) before the counter, as the Tree's toolbar does (provisional). A read-only Ranking shows no check box. Not mocked. |
| **Form** | Its fields are the input atoms and the PickField, so a Form looks like every other field on the board, and it renders no submit button of its own (L160, TC §3.3); a Group per section. A single pick from a list renders as radios, with a filter field above the list when it holds more than 10 options, and a "Clear" `button-link` while a pick is set: Select, the one dropdown the UX had planned (F-23, L183, L185), fails the view CSP (renderer spike); a multiple pick uses checkboxes, and the on/off field is a Switch (L165). A failing field check shows a `field-error` under its field (F-39). Not mocked. |
| **Image annotation** | The image as an `<img>` from a `blob:` URL, under the same annotation overlay as the Diagram (L160): numbered `annotation-pin`s and boxes in `{colors.change}`, each with its comment card. Positions are `xywh=percent:` regions, which is right for an image (AD-7). Not mocked. The image sits in a frame on `{colors.muted}` with a border and a caption line. |
| **Approval** | A block at the end of its widget or molecule, above a `{colors.border}` rule: on the left, under an "Approval" section label (provisional), three `button-decision`s in FR-11's order, "Approve", "Approve with changes" and "Reject"; on the right, the Approval summary (L74, F-04). The selected decision shows the pressed fill and a ✓. With board changes present, "Approve" shows `button-disabled`, and "Approve with changes" is the approving act (F-63). Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html). |
| **Approval summary** | `approval-summary`: a bordered block on `{colors.card}`, titled with the number of changes in `{typography.label}` ("2 changes", provisional). One line per change: a `{colors.change}` dot, the item's name, the previous value struck through in `{colors.muted-foreground}`, then the new value in `{colors.change-text}` on `{colors.change-subtle}`, with values in `{typography.code}`; a switched line reads "on" and "off" (provisional) (F-04). With no change it reads "No changes" and lists nothing; past 20 lines, a last line "and N more" in `{colors.muted-foreground}` (provisional). Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html). |
| **Choice** | The question card's option rows (Option, Other row, Option preview), with radios for a single choice and checkboxes for a multiple one (F-36). Mock: [key-golden](mockups/key-golden.html), for single choice; not mocked: multiple choice. |
| **Scale** | A Slider atom: the track on `{colors.muted}`, the range and the thumb in `{colors.primary}`, value labels in `{typography.code}`. In rating mode, a toggle group of the scale's steps (F-36), with the minimum and maximum labels at its ends in `{colors.muted-foreground}`. Unset, the slider's track shows no thumb and "Not set" in `{colors.muted-foreground}` where the value label goes, and keyboard focus rings the track (provisional). Not mocked, the unset state included (TC §2.5). |
| **Document review** | **Surface.** In the widget frame. Its toolbar holds "Comment" and "Suggest edit" as `button-secondary` and the counter ("No comments yet", "Your changes: 2 comments, 1 suggested edit"); a message about a refused passage sits beside them in `{colors.muted-foreground}`. A title, when given, heads the frame in `{typography.label}`.<br>**Anatomy.** The document through the Markdown renderer, in `{typography.body-lg}`. A commented passage sits on `{colors.change-subtle}` with a `{colors.change}` underline and a numbered `annotation-pin` after it, and a suggested edit shows the passage struck through and the suggestion in `{colors.change-text}` on `{colors.change-subtle}`, then its pin. Each pin opens a comment card. Marks are set through classes (F-36). The current block, from the keyboard, takes `{components.focus-ring}`. Detached annotations sit under the document on `{colors.muted}`, headed "Detached comments": each its quote in `{colors.muted-foreground}`, its text, and "Delete" as a `button-link`. Every element holding agent or user text wraps a long word.<br>**States.** Read-only (a closed ask, a locked board, a Snapshot): no toolbar; the marks and pins stay, and a card shows no "Edit" or "Delete". Not mocked. |
| **LaTeX** | A source field in `{typography.code}` with the input atoms' look, the KaTeX preview under it on `{colors.card}`, and a parse error as a `field-error` under the field (F-36). The field takes a `{colors.change}` border while it differs from the agent's expression, and a counter under the preview reads "Your changes: expression edited" in `{colors.muted-foreground}` (provisional). A preview wider than the frame scrolls sideways, and one taller than 400 px stays at that height and scrolls inside, so the controls under it stay in reach. Read-only, the field takes the read-only look. Not mocked. |
| **Table** | AskBoard's own grid with shadcn Table styling: an optional caption in `{typography.label}`; a header row on `{colors.muted}` with headers in `{typography.label}`, a computed column's header carrying an "ƒ" mark in `{colors.muted-foreground}`; rows separated by 1px `{colors.border}` rules, cells in `{typography.body}`, and numbers and money right-aligned in `{typography.code}`. Input cells read as text until edited, when an Input fills the cell; formula cells are Values. The Total row is a footer row set off by a `{colors.border-strong}` rule, its label semibold. The current cell is outlined 2px in `{colors.primary}`. Changed cells take the change highlight, an added row the change hue along its start, and formula cells and totals that moved the derived mark (`{colors.change-subtle}` fill, no border) (F-36). A cell holding an entry shows its text with a `{colors.destructive}` border and a `field-error` under its row; a column formula's problem shows one `field-error` over the grid, its cells "—" in `{colors.muted-foreground}`. Text wraps inside its cell, and a grid wider than the frame scrolls inside it. Rows are 32px compact and 40px comfortable. Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html), inside the sales estimate review; not mocked: a cell entry, an added row, a column problem. |
| **Spreadsheet** | An A1 grid: column letters and row numbers on `{colors.muted}` in `{typography.label}`, cells in `{typography.code}`, the selected cell outlined 2px in `{colors.primary}`, and a formula bar above the grid with the cell's address and formula in `{typography.code}`. Changed cells take the change highlight, and a formula error is a `field-error` (F-36). Not mocked. |
| **Chart** | Drawn on canvas with a theme built from the tokens and rebuilt on a theme switch (L160): axes and grid lines in `{colors.border}`, labels in `{typography.badge}` and `{colors.muted-foreground}`, tooltips drawn on the canvas on `{colors.popover}` with `{colors.popover-foreground}` text and a `{colors.border}` edge. Series and pie slices take `chart-1` to `chart-5` in order, never cycled, so a chart holds at most five (settles Open Items 7). Bars have 4px rounded ends away from the axis and a 2px gap between the bars of a category; lines are 2px with 8px markers; pie slices are parted by a 2px `{colors.card}` gap and labelled with their category. A legend above the plot names the series of a bar or line chart of two or more. The title sits above the chart in `{typography.label}`. A data point the user highlights takes a 2px `{colors.change}` ring (F-36); the counter under the chart is in `{typography.body}` and `{colors.muted-foreground}`. Focused, the chart takes `{components.focus-ring}` and its current point shows its tooltip. The plot is 320px high and as wide as the widget frame. Not mocked. |
| **Tree** | Rows in the widget frame, under a header row of column names in `{typography.label}` on `{colors.muted}`, indented by `{spacing.lg}` per level, each with a chevron, the node name in `{typography.body}` (semibold on parent rows) and the node's fields as columns; roll-ups are Values. The chevron, in `{colors.muted-foreground}`, points right when closed and down when open (L199). A drag shows the drop indicator, as in Ranking: a line above or below the row for before and after, `{colors.primary}` outline on the row for into, and a `{colors.destructive-text}` cue for a drop that is not allowed; the row has a grip handle at its start, in `{colors.muted-foreground}`, and a leading checkbox column holds the selection, with a tri-state one in the header. "Adjust by %…" opens a popover under the toolbar: check boxes, a signed percentage field (no echo), the preview in `{typography.body}` and the warning in the Field error pattern, "Apply" as the primary button. Changed nodes take the change highlight (F-36). The current row takes `{colors.primary-subtle}` with a 2px `{colors.primary}` left bar. Rows are 32px compact and 40px comfortable. The group question, which asks before a leaf becomes a group, takes the toolbar row's place: its sentence wraps, the leaf's name whole, with "Cancel" and "Continue" on a line under it, and the toolbar row grows from `{spacing.toolbar-row}` to hold it and returns to it once the question closes. A new row's empty roll-ups read "—" in `{colors.muted-foreground}`. Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html), inside the WBS with PERT; not mocked: the drag. |
| **Gantt** | **Surface.** AskBoard draws the Gantt itself, in SVG, with its grid on TanStack Table (L160).<br>**Anatomy.** A time axis on `{colors.muted}`, with its labels in `{typography.badge}` and `{colors.muted-foreground}` and its gridlines in `{colors.border}`. Task bars in `{colors.gantt-bar}`, with 1px finish-to-start elbow arrows in the same colour. The critical path in `{colors.critical}`, as solid bars with 2px arrows (`gantt-critical`; F-51). A legend under the chart reads task, critical path and "your change" (colour page).<br>**States.** A user-changed task has a 2px `{colors.change}` outline, offset by 1px (`gantt-user-change`). During a drag, the earliest start the dependencies allow shows as a guide (F-24). The Task column's header edge is a 1px `{colors.border}` line, 8px wide to grab, that takes `{components.focus-ring}` on focus and a col-resize cursor. A "Critical path" switch sits in the toolbar, on when the Gantt opens; off, critical bars and arrows are drawn as ordinary ones and the legend drops its critical entry. A requested duration shows a pin mark in its cell. The guide's look and how the working calendar shows on the axis are open (Open Items, 8 and 9). A bar whose dates differ from the agent's carries a baseline, a 2px dashed `{colors.border-strong}` line under it (settles Open Items 8). The drag guide is a full-height 2px dashed `{colors.foreground-secondary}` line with its label (settles Open Items 8). At Day zoom non-working days are shaded on `{colors.muted}` (settles Open Items 9). Rows are 32px compact and 40px comfortable.<br>Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html), inside the Gantt plan; not mocked: the drag guide. |
| **Timeline** | Lanes as rows on the Gantt's time axis (L160), ranges as `{colors.gantt-bar}` bars and milestones as diamonds in `{colors.foreground}`. A moved item takes the `gantt-user-change` outline (F-36). Lane labels sit in a fixed column at the left in `{typography.label}`, cut with an ellipsis; a lane whose entries overlap grows one track per overlap, each the Gantt's row height. An entry's label, in `{typography.badge}`, sits after its shape, or inside a range bar wide enough for it. The current entry takes `{components.focus-ring}`. The toolbar holds "Move earlier", "Move later" and "Move to lane…" as `button-secondary`s, and the counter at its right, as the Tree's toolbar does (provisional). Not mocked. |
| **Kanban** | Columns on `{colors.muted}`, each headed by its name in `{typography.label}` and a count, holding cards on `{colors.card}` with a `{colors.border}` border and `{rounded.md}`, titled in `{typography.body}`. A drag shows the drop indicator, and a moved card takes the change highlight. "Move to…" opens a menu on `{colors.popover}` with `{elevation.shadow-md}` (F-36). A card's description sits under its title in `{colors.muted-foreground}`. The drop indicator is the Tree's "into" outline, `{colors.primary}`, on the column under the card. The current card takes the Tree's current-row look, `{colors.primary-subtle}` with a 2px `{colors.primary}` left bar. The toolbar holds "Move to…" as a `button-secondary`, and the counter at its right (provisional). Not mocked. |

### Molecules

| Component | Visual spec |
|---|---|
| **WBS with PERT** | The Tree, with the three-point estimates as NumberFields with a "d" unit affix and the expected effort and spread as right-aligned Values. The column names are provisional. Changed estimates take the change highlight, and a package the user split off carries the added-row bar (Change highlight). The excerpt per work package opens from the leaf's chevron as a row detail under it, indented to the name column, as an Excerpt card (TC §2.1, L199). Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html). |
| **Gantt plan** | The Gantt (Widgets), linked to the WBS, with the scope the plan adds (L72, L73): a "Day \| Week \| Month" zoom, a segmented control in the toolbar, the critical path highlighted unless the user switches it off, and the agent's original plan as a baseline under the bars, drawn by AskBoard rather than by a paid library tier. Parent packages get no summary bar: only leaf tasks are drawn (L200). Changed start and duration fields take the change highlight. The grid's columns (task, start, duration) and the zoom carry provisional labels. The baseline's look is open (Open Items, 8). Mock: [key-uj2-wbs-gantt](mockups/key-uj2-wbs-gantt.html); not mocked: the baseline. |
| **Sales estimate review** | A Table with a Switch per optional line in its first column, then "Total" and "Margin" as footer rows (provisional labels), ending with an Approval. Changed values take the change highlight. A switched-off optional line stays visible and is never deleted (TC §2.1): its text turns `{colors.muted-foreground}`, its amount is struck through with a 1.5px `{colors.change}` line, and its switch takes a 2px `{colors.change}` outline, offset by 1px (L199). A margin below the minimum shows a `status-chip-warning` beside the "Margin" label (L75; colour page). With no minimum margin set, no chip shows (F-98). Mock: [key-uj3-estimate-approval](mockups/key-uj3-estimate-approval.html). |
| **Decision matrix** | A Table of options by weighted criteria, with the scores as Values. Not mocked. |

## Do's and Don'ts

Several rows correct where the Stitch outputs, [direction-1-pacific-blue](mockups/stitch/direction-1-pacific-blue.html) (pass 1) and golden-1-base, departed from the brief. Those departures are not decisions ([stitch index](mockups/stitch/stitch-index.md); L114, L123).

| Do | Don't |
|---|---|
| Read only layer-3 variables (`--primary`, `--change`…) in components | Hard-code a hex value in a component. A palette swap would miss it |
| Use `{colors.primary}` as the brand colour | Use shadcn's `accent` as the brand colour. It is a hover surface |
| Keep the user-change hue for the user's changes only | Use one hue for both a user change and agent state. golden-1-base gave both amber |
| Show a user's removal in the change hue, dashed or struck through | Colour something the user removed as danger. Danger is for the diff's removed lines, "Rejected" chips, errors and the discarded ask |
| Show waiting states in neutral grey | Colour "waiting" as warning or as agent activity |
| Keep warning for thresholds | Use warning for emphasis, notices or user changes |
| Draw the critical path in `{colors.critical}`, as solid bars with heavier arrows | Draw it in a red or orange hue, where it reads as danger |
| Show the recommended option with the Recommended badge, and select it only on the user's click ("Accept recommended", "Select recommended") | Preselect an option when the board opens, or open a widget on the recommended alternative. Stitch preselected Fix B with an "Agent recommended" badge |
| Draw only the elements the spines list | Invent status panels, logs or timestamps. Stitch added "State verification", "CLI bridge · Active", "Agent Conversation Log" and a "Just now" stamp on an annotation |
| Keep the context header to who and where, states and controls | Add a logo tile or an "AskBoard /" breadcrumb. No product mark is defined |
| Show the board's language as read-only text in the settings panel | Add a language toggle or selector anywhere on the board. The agent sets the language per ask (L169, L179) |
| Put the external-link mark only on references that open in the browser | Put an external-link icon on a reference that opens in the reading panel |
| Keep one filled primary in view: Submit on a multi-question board, Answer on a single-question board | Add a second filled primary, such as a filled Answer beside Submit or a filled follow-up Send. golden-1-base made Send the only filled primary |
| Colour added diff lines with `{colors.diff-add}` and `{colors.diff-add-mark}` | Colour additions with the accent. Stitch pass 1 made them blue |
| Keep every field's label visible: Project, Directory, Branch, Worktree, "Note for the agent (optional)" | Replace a label with an icon, or move it into the placeholder. Don't give the open prompt a second label ("Note to the agent", structural mock) |
| Keep the per-line accept and reject controls visible | Show them only on hover |
| Pair every state with a marker shape or text | Tell two states apart by hue alone, such as the selected delivery mode by its text colour |
| Keep change marks at 3:1 or more against their surface | Ship a change line under 3:1. golden-1-base's amber line was 2.15:1 |
| Keep shadows to the sticky bars, floating cards and panels (Elevation & Depth) | Let shadcn's default shadows on cards, inputs or buttons through |
| Bundle and inline Inter and JetBrains Mono | Load Google Fonts, an icon font or a CSS CDN at run time. The Stitch HTML does |
| Turn ligatures off in code views | Let `=>` or `!=` render as ligatures in a diff |
| Key diagram pins and highlights to element IDs on the annotation overlay, recomputed on every render | Place pins by pixel coordinates on a rendered diagram. Pixel regions are only for Image annotation |
| In dark mode, re-render diagrams with the dark diagram theme (Colors, Diagram theme) | Leave a light diagram, or a light "paper" panel, on a dark board (the alternative not chosen, L160) |
| Set code and syntax colours through classes | Write inline colour styles into rendered markup. The view CSP drops them |

## Open Items

Gaps the records leave open. Nothing here was filled in by this spine.

### Decided after distill

These were open in the draft and are now decided; the memlog holds the decisions (L135 to L161). The open-prompt label is "Note for the agent (optional)". The question navigator's structure, the tab labels' open counts and the place of the "Beside | Inline" control are set (L160). AskBoard draws the Gantt, its baseline included, in its own SVG (L160). Diagram and Image annotation share one annotation overlay keyed to element IDs (L160). The dark theme runs on a `.dark` class, and diagrams re-render dark (L160). The component choices behind these specs are in EXPERIENCE.md, Composition and Components.

### Open points

Not blocking. They stay open until the stories close them (L145).

**Identity and foundations**

1. **Motion.** No motion inventory, durations or reduced-motion behaviour is recorded (L102). The Stitch pulse on "Working" and its button press scale are illustrations.
2. **Icons** (F-76). No icon set is chosen. It must be bundled under an open licence (L38). Stitch used Material Symbols. The marker shapes and the glyphs (✓ ✕ ↗ ↓ ↩) have no source yet: an icon set, or CSS and inline SVG for the shapes and text for the glyphs.
3. **Product mark.** No logo or product mark exists. The Stitch "A" tile was invented.
4. **Tabular figures.** The font preview shows tabular figures for numbers, but no decision applies them.
5. **Width behaviour.** Nothing is recorded below the 1280px floor (EXPERIENCE.md, Open Items) or for a maximum content width above it; golden-1-base capped its content at 1440px with 24px gutters, as an illustration only. Header row 2 is checked with the Italian strings at the 1280px floor by the browser tests of the OpenSpec change `settings-languages` (L169, F-47).

**Colour roles and palettes**

6. **Agent-authored content.** It is not decided whether follow-up replies and the agent's option annotations carry the agent hue (L132 names only "Agent: Working" and the Recommended badge).
7. **Chart colours** (F-73). Settled by the OpenSpec change `chart-widget` (2026-11-07): the tokens `chart-1` to `chart-5`, light and dark (Colors), checked on the card colour of each theme: every pair of neighbouring slots, the last and the first included for a pie, is at least ΔE 8 apart under protanopia, deuteranopia and tritanopia and at least ΔE 15 for normal vision (OKLab ×100). `chart-3` and `chart-5` sit under 3:1 on the light card, so the legend, the tooltip and the keyboard reading name every point. The order holds no magenta or red, which the change highlight and destructive states take. shadcn's `chart-*` defaults were set aside: two of their light slots are near oranges.

**Left open by the mock review** (L201)

8. **Gantt baseline and drag guide.** The look of the agent's original plan under the bars, and of the earliest-start guide during a drag, is not decided. Settled by the OpenSpec change `widget-editing-plus` (Components, Gantt).
9. **Working calendar on the Gantt axis.** AD-7 computes dates on a working calendar, but how non-working days show on the axis is not decided; the UJ-2 mock uses calendar days. Settled by the OpenSpec change `widget-editing-plus` (Components, Gantt).
10. **Diff check controls.** The per-line ✓ and ✕ are `{spacing.control-height}` square, which makes a decided line taller than a context line. A compact size is not chosen.
11. **Whole-file decision.** The look of a file accepted or rejected as a whole is not decided.

How a WBS split is done is behaviour, open in EXPERIENCE.md, Open Items.

**Unmocked visuals**

12. **Unmocked visual specs.** Every Components row whose closing field reads "Not mocked", in whole or in part.

**Spec fit and editorial**

13. **Mechanism in DESIGN** (F-82). The Dark theme mechanism paragraph, the Diagram theme mapping and the Diagram row's overlay pipeline repeat mechanism that EXPERIENCE.md, Composition and Components, also holds. Keep the visual outcome here and link EXPERIENCE for the mechanism.
14. **History sections** (F-84). "Decided after distill" records history that the memlog already holds.
15. **Material outside the canonical body** (F-89). The H1, the Citations preamble, this Open Items section, and the frontmatter keys `status`, `sources`, `updated` and `elevation` sit outside the DESIGN.md spec. Tools that parse the spec may not expect them. Open Items stays last.
