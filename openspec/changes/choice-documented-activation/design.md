# Design

## Context

See proposal.md, Why. The code on `main` 433b4d29 (the base this change was designed on; `form-widget` merged there as #64 and was archived in #67; the change is rebased onto d6c67d87, task 0.2):

- `catalog/choice/single-choice.tsx`: Radix `RadioGroup.Root` and `Item` (`radix-ui` 1.8.1, through the `radix` library chunk). Each radio's `onFocus` sets a flag for one microtask and its `onClick` cancels a click while the flag is set (lines 31-39): that is the click Radix dispatches from its focus handler while an arrow key is down, which Radix does not document. Its `onKeyDown` makes Enter select (lines 51-55), since Radix's radio swallows Enter. Choosing an option clears the "Other…" text and choosing "Other…" clears the option (FR-3).
- `catalog/choice/multiple-choice.tsx`: Radix `Checkbox.Root` per option with AskBoard's own roving focus (`nextFocus`, `choice/selection.ts:29`), arrows moving the focus only; documented API only.
- `catalog/pick-field/index.tsx:138-143, 178-188`: Radix `RadioGroup` with its documented automatic activation (`form-widget` open question 12), "Clear" handing the focus to the first radio (`pick-field/selection.ts:28`); a filter above 10 options shows a subset of the rows, and a hidden pick stays picked.
- `tools/build/shared-modules.ts:72`: `RadioGroup` among `LIBRARY_CHUNKS.radix`'s names; `tools/build/shared-modules.test.ts:137` pins the list ("and no other yet").
- What Radix documents (radix-ui.com, Radio Group, read on 2026-11-08): Tab moves to the checked radio or the first; Space checks; ArrowDown and ArrowRight "move focus and check" (its table says only "moves focus" for ArrowUp and ArrowLeft, though both check); Root props `asChild, defaultValue, value, onValueChange, disabled, name, required, orientation, dir, loop`, Item props `asChild, value, disabled, required`: none selects manual activation. Toggle Group documents a manual keyboard (arrows, Home and End move the focus; Space and Enter activate or deactivate) and roving tabindex, and nothing about the roles it renders. WAI-ARIA APG, Radio Group pattern: outside a toolbar the arrows move and check; "For Radio Group Contained in a Toolbar", the arrows move the focus only and Space (Enter optional) checks the focused radio, doing nothing on a checked one; roles `radiogroup` and `radio` with `aria-checked`, the group labelled.

Binding text: EXPERIENCE Component Patterns, Option ("options use manual activation"), Interaction Primitives, Explicit acts ("Moving through the options with the arrow keys never selects", L168, F-02), Accessibility Floor, Keyboard core and Tab order; DESIGN Option (focus ring without the selected look, F-02); NFR-10, NFR-12; AD-10; the PO's rule of 2026-11-07 on dependency APIs.

## Goals / Non-Goals

**Goals:** manual activation for every single choice on the board with no reliance on undocumented library behaviour; the Choice's tested behaviour unchanged; one radio behaviour across the Choice and the PickField; no schema set, port member or dependency change.

**Non-Goals:** the multiple Choice and the multiple PickField; Toggle Group users (proposal, open question 3); RTL arrow mirroring (both locales are left to right).

## Decisions

### 1. AskBoard's own radio group (proposed default, open question 1)

| Option | Documented ground | EXPERIENCE and specs | Choice behaviour | Chunks | Test churn |
|---|---|---|---|---|---|
| (a) Radix's automatic activation | Yes | Reverses F-02 and L168: EXPERIENCE Option, Explicit acts, Keyboard core, Component per widget; DESIGN Option; spec "Nothing chosen for the user" and its scenario "Moving with the arrow keys" | An arrow press onto an option clears typed "Other…" text (FR-3), unreadies a ready answer in submitted delivery, and starts a revision on an answered question; screen readers announce each option as checked while browsing | `choice` shrinks a little | Rewrites `board.browser.ts` "the arrow keys move focus only…", `lifecycle-card.browser.ts` "…the arrow keys select nothing", the keyboard-core path of `lifecycle-keyboard.browser.ts` |
| **(b) Own radio group** (chosen) | Platform only: HTML `button` activation by Space and Enter, ARIA `radiogroup`/`radio`/`aria-checked`, `focus()`, roving `tabIndex` | Unchanged rules; docs name the component | Unchanged, plus decision 3's no-op on a checked radio | About 1 KB in `choice` and in `pick-field`; `radix` loses Radio Group | None of the Choice's tests; the PickField's keyboard test and DOM test |
| (c) Radix Toggle Group, single | Keyboard and roving tabindex documented; the radio roles, `aria-checked` and the clearing re-press (`onValueChange("")`) are not | Unchanged | Unchanged if the empty value is refused | `radix` already ships it | Classes: items carry `data-state="on"`, not `checked`; the CSSOM `outline: none` on the root stays |
| (d) Radix Radio Group, controlled, ignoring `onValueChange` while an arrow key is down | Relies on when Radix checks relative to the key events, which is undocumented | Unchanged | Unchanged | — | — |
| (e) Native `input type="radio"` | Yes | — | The browser checks on the arrow keys: automatic | — | — |

(b) is the only option whose radio semantics and manual activation both rest on documented ground. It follows the APG's manual-checking variant (the radio group in a toolbar) for the keys and the APG's roles for the semantics; outside a toolbar the APG checks on the arrows, and EXPERIENCE chose the manual variant on purpose (F-02: an arrow press must never become the user's choice, AD-10). It is the pattern the multiple Choice already uses beside Radix Checkbox, so the chunk keeps one roving model.

### 2. The PickField takes the same group (proposed default, open question 2)

EXPERIENCE's rule names the options without exception, and the Choice row of the atoms table covers the PickField (EXPERIENCE, Composition and Components, Atoms). `form-widget` left the PickField on automatic activation only because the documented manual path did not exist. Under (a) the PickField loses nothing an arrow could clear (no "Other…"), but a ready Form question would still unready on an arrow press. One behaviour per board wins; the spec's "The PickField" changes its keyboard scenario.

### 3. The group's code and behaviour

- `catalog/fields/roving.ts` (plain ECMAScript): `nextFocus(key, index, count)`, moved unchanged from `choice/selection.ts` (the multiple Choice imports it from here, its tests move with it); `radioTabStop(checked, count)`: the checked index, else 0, else none for an empty group; `radioAt(index, group)`: the attributes and handlers of radio `index`, given `{count, checked, disabled, onCheck, focus}`: `type: "button"`, `role: "radio"`, `aria-checked`, `data-state` `checked` or `unchecked` and `data-disabled` (so `ROW`, `MARK` and the board's ended look keep their selectors), `disabled`, `tabIndex` 0 on the tab stop and -1 elsewhere; `onKeyDown`: a key `nextFocus` maps prevents its default and calls `focus(next)`, any other key is left alone; `onClick`: `onCheck(index)` only when the radio is not checked. Space and Enter reach `onClick` through the button's own activation, so no key checks anything by script.
- `catalog/fields/radios.ts`: `useRadios({count, checked, disabled, onCheck})`, which keeps the buttons' refs and returns `radio(index)` (`radioAt` with `focus` bound to the refs). The group element is the component's own `div` with `role="radiogroup"`, its `aria-labelledby` (the question text for the Choice, the field's label for the PickField), `aria-describedby` as today and `aria-required` when a PickField is required; it takes no `tabIndex` and no `style`.
- The Choice: the options and "Other…" rows, in order, are radios 0 to n; `checked` is the chosen option's index or "Other…"'s; `onCheck` is today's `choose`. The checked dot is a `span` rendered while checked, in place of `RadioGroup.Indicator`. `onFocus`, `onClick` and `onEnter` go.
- The PickField: the rows the filter shows are the radios; `checked` is the picked option's position among them, none when the filter hides it; `onCheck` puts its ID. "Clear" still hands the focus to the first radio (`focusFirstRadio` reads `[role="radio"]`, unchanged).
- A checked radio pressed again does nothing (APG), so Space or Enter on the selected option no longer rewrites the draft (spec scenario "The selected option pressed again").
- Read-only: every radio `disabled`, checked state shown, no tab stop, as Radix's disabled group did.

### 4. Radio Group leaves the `radix` chunk

No source imports it after decision 3, so `LIBRARY_CHUNKS.radix` drops `RadioGroup` and its test's list follows; the build tests that use `RadioGroup` only as an example import take `Checkbox`. `choice` and `pick-field` still need `radix` (Checkbox). Sizes are re-recorded (`bun run build:view --record-sizes`), with each chunk's change in the task note.

### 5. Documents

EXPERIENCE: Option row ("Delta over Radix" becomes the group's own rule, with this change's name), Keyboard core's last sentence (the options' single choices are AskBoard's radio group, manual activation), the atoms table's Choice row and Component per widget's Choice and Form rows (AskBoard's own radio group and Radix Checkbox); `updated:` is the apply date. Spine Stack: `radix-ui`'s primitive list drops Radio Group (the Stack lists what ships; no AD changes). DESIGN's Input atoms row names shadcn's Radio Group as the look and stays. `form-widget`'s artifacts stay as merged; its archive carries them.

### 6. Versions

None: no schema set, board message, view message or port member changes (askboard-contract-versioning). Task 0.2 records `main`'s constants; the rebase task checks that none moved.

## Merge points

Read on 2026-11-08 at the heads named. If one of them merges first, this change's rebase keeps both sides and re-checks the names below.

| Change | Head | Overlap | What it takes |
|---|---|---|---|
| `form-widget` (#64) | merged on `main` 433b4d29 and archived (#67, on `main` d6c67d87) | Its requirement "The PickField", now in `openspec/specs/view-and-widgets/spec.md`, which this change's delta modifies | Nothing left: the archive merged before this change's rebase. Its design decision 4 and open question 12 describe the state this change replaces; they stay as history. |
| `document-review` | `worktree-feature-document-review` 778c3fe7 | Appends `markdown` to `LIBRARY_CHUNKS` and `MARKDOWN_RENDERER` to `BY_PATH` in `tools/build/shared-modules.ts`, edits its test, `chunk-sizes.json`, EXPERIENCE, the spine | Keep both: this change edits only `radix`'s names. Re-record chunk sizes after the rebase. |
| `table-widget` | `worktree-feature-table` 14f19ad4 | Edits `catalog/choice/preview.tsx` (two `ItemProps` members), `chunk-sizes.json`, EXPERIENCE, the spine | No shared line; `preview.tsx` is untouched here. Re-record sizes. |
| `keep-mine-shown-revision` (#66) | merged on `origin/main` d6f5e453 after this change's base, read at 32c804b0 | `chunk-sizes.json`, EXPERIENCE, the spine | Keep both; re-record sizes. |
| `oversized-acts` | `worktree-fix-oversized-acts` (proposal, this session) | EXPERIENCE (other rows), `chunk-sizes.json` | Keep both. |
| `image-annotation`, `graph-widget`, `diff-review`, `diagram-widget`, `spreadsheet-widget` | 5bf4d85b, 482223d0, dfb0e6cb, ed783fe5, 972b9622 (proposals) | Use Radix Toggle Group or Dropdown Menu from `radix`; `diagram-widget` appends to `LIBRARY_CHUNKS` | None uses Radio Group. A widget in `widgets` that needs a single choice cannot import `view/catalog/fields` (AD-1): it uses Toggle Group (open question 3) or asks for the group to move to a shared module. |

Names borrowed, all on `main` 433b4d29 and on d6c67d87 (task 0.2 records file and line): `nextFocus`, `toggled`, `optionAria`, `ROW` and `MARK` (choice and pick-field), `OptionText`, `OptionDetails`, `OtherField`, `otherLabelId`, `questionTextId`, `focusFirstRadio`, `clearing`, `filteredOptions`, `Field`, `fieldIds`, `register`, `useReadyAfterLayout`, `LIBRARY_CHUNKS`, `shimSource`, and the browser harness's `tabIntoGroup` (`test/browser/harness/tab-stops.ts`), `lifecycleScenario`, `openBoard`, `optionOf`. Seams this change creates: `radioAt`, `radioTabStop`, `useRadios`, and `nextFocus`'s new home `catalog/fields/roving.ts`.

## Risks / Trade-offs

- [Own keyboard code where Radix handled it] → about sixty lines, mostly pure (`radioAt`, `radioTabStop`) with unit tests; every existing Choice keyboard test in `board.browser.ts`, `lifecycle-card.browser.ts` and `lifecycle-keyboard.browser.ts` must pass unchanged in Chromium and WebKit; Firefox runs with the PO's manual CI dispatch, as for every view change.
- [Engines differ on button activation: Space checks on key release, Enter on key press] → the spec's scenarios press both in Chromium and WebKit; neither path runs script on the key itself.
- [Radix kept Enter from activating a radio, after WAI-ARIA; now Enter checks natively] → EXPERIENCE already says "Space or Enter selects", as the code did; the APG lists Enter as optional for the toolbar variant.
- [Screen readers lose nothing Radix gave] → the same roles, states, labels and descriptions. Radix's root also held a tab stop of its own that handed the focus on to the checked or first radio, and set `outline: none` through the CSSOM; here the radios carry the tab stop (decision 3), so the root never takes focus and needs neither. The Tab-order tests named in task 1.2 pin that the options stay one Tab stop.
- [The PickField's keyboard changes for a user used to native radios] → EXPERIENCE's rule and F-02; one behaviour per board.

## Migration Plan

None: the view alone changes, and one session process serves the board page. Rollback is a revert.

## Open Questions

The proposal's three questions carry their proposed defaults (task 0.1). No conflict between source documents: Radix's own table disagrees with itself (ArrowUp and ArrowLeft "move focus", ArrowDown and ArrowRight "move focus and check"), which this change no longer depends on.
