# Design

## Context

See proposal.md (Why). The input is Issue #187, report 1.1.0 of #168 (§5.1, §8.2 P1-7) and the PO's decision 6 of 2026-11-14. The draft never overrides `docs/` or `openspec/`.

This branch is stacked on `answering-flow-fixes` (#212, head 9eb5f364), whose seams are not on `main` yet (Merge points). Paths are under `packages/` unless absolute. The code as it stands on that head:

- **Key seam** (`keyboard-shortcuts-help`, `docs/as-built/keyboard-shortcuts-help.md`). `contract/src/keys/` holds `KEY_VOCABULARY`, `keyActionOf`, `keyTableProblems`, `keyOverridesProblems`, `effectiveKeys` and `changedKeyActions`. The override check, `keyExitActions` and `changedKeyActions` default to `REGISTERED_KEY_TABLES` (`overrides.ts:115`, `:286`, `effective.ts:87`). The user's `keys` is a flat map from an action to combinations, so an action name is global across tables. `reservedProblem` refuses `mod` on any key but Z and A (`check.ts:40`), so `Mod+Enter` cannot be bound today. `KEYS_OPEN_RESERVED_KEYS` and `takenByControls` (`overrides.ts:40-66`) refuse, for `keys.open` only, the keys native controls take. `KEY_TABLES_ON_BOARD` (`board.ts`) lists widget types whose chunk registers a table; `component-facts.test.ts` and the skill generator read it as such.
- **View keys.** `useKeyTable` (`view/src/catalog/keys/key-table.tsx`) applies the overrides that `BoardKeys` (`shell/board-keys.tsx`) provides. `KeyHint` takes an entry, looks it up in the item frame's `KeyTableContext`, and returns an entry that is already in effect unchanged (`effective.ts`, `entryInEffect`). `keyPressOf` (`catalog/keys/press.ts`) reads an event. `KeysFrame` and `keys-frame-actions.ts` open a widget's panel on `?` when no handler prevented the key. `KeysPanelBody` draws the groups of `panelGroups` (`catalog/keys/hint.ts`).
- **Board.** `nextOpenFrom` (`shell/board-view.ts`) finds the next open question from the question in view. `Board` (`shell/board.tsx:317-319`) wraps it in `nextOpen` → `go`, which sets the question in view and focuses the heading through `revealAndFocus`. The header's "Next open" (`board-header.tsx`, `Counts`) calls it. `counts` is absent on the single-question board and on an ended board. An opened Snapshot can show it, since its lock is unset.
- **Card.** The card's `<section data-askboard-question>` holds every item in an `ItemFrame` `[data-askboard-item=<item id>]`. That includes the question's own options, whose item id is the question's id (`renderer.tsx:143`, `question-card.tsx:515-530`). "Answer" calls `onAnswer(control)` (`question-card.tsx:447`), which runs `pressAnswer`, the reason check, the revision confirmation and the focus move of `answering-flow-fixes` D1. `cardState.canAnswer` is false for a field block, a pending agent change, nothing chosen, or an item not answerable (`question-state.ts`). `fieldToFixOf` gives the visible reason.
- **Options.** `checkboxKeyOf` flips a box on Enter whatever the modifiers (`catalog/fields/roving.ts:75`). Radix Checkbox then prevents Enter's default. A single choice is `button role="radio"`, whose Enter is the button's native activation.
- **Composer.** `thread.tsx:188-192` sends on `isSendKey`: Enter with Ctrl or Cmd, whatever else is held (`thread-text.ts:56`).
- **Focus at open.** The board page never focuses the view's frame (no `.focus()` in `view/src/board-page/`), so keys pressed before the user clicks or tabs into the board reach the board page's document, not the view's.
- **Help skill.** `skills/askboard-help/SKILL.md` holds 5,978 characters against `HELP_BUDGETS.skill` 6,000. `references/key-actions.md` holds 2,607 against 4,000.

Constraints: AD-1 (the view imports `contract`; no new edge), AD-8 (the panel shows board strings only), AD-10 and NFR-10 (a key never sends what the user did not choose), AD-14 (the user's keys come from the user file only), NFR-12, FR-34 (both languages), NFR-7.

## Goals / Non-Goals

**Goals:**

- Each key is the twin of a visible control, or of a navigation the panel names. It calls that control's own handler, so gates, confirmations, focus moves and status messages stay in one path. Change 4's after-answer advance then reaches the key without edits.
- The pure parts are unit-tested in Bun: the table, the override rules, the scope, the answer decision and `previousOpenFrom`. The DOM glue is thin and covered in Chromium, Firefox and WebKit.

**Non-Goals:**

- A key for sending all held answers (decision 6), for Postpone, or for the outline jump. The outline's entries are buttons that Enter activates natively, which EXPERIENCE records.
- Board keys inside a widget item (D2), visible key caps on the controls, and an icon on the Keys button (change 6).
- Key capture on the board: the user's keys come from the user file only (AD-14).

## Decisions

### D1. The board's key table lives in the contract (#187; decision 6)

`contract/src/keys/board-table.ts` exports `BOARD_KEYS`, checked by `keyTableProblems` under the name `BOARD_KEY_TYPE = "board"`. It also exports `BOARD_PART = "board"`, `type BoardKeyAction` and `BOARD_KEY_TABLE: RegisteredKeyTable`. `tables.ts` adds `ALL_KEY_TABLES = [BOARD_KEY_TABLE, ...REGISTERED_KEY_TABLES]`, frozen.

| Action | Part | Keys | Shows | `readOnly` | Label |
|---|---|---|---|---|---|
| `board.nextOpen` | `board` | `n` | `tool` (the header's next-open jump) | true | `header.nextOpen`, the jump's own string; change 4 changes its value, not its key |
| `board.previousOpen` | `board` | `n` with `shift` | `navigation` | true | `keys.action.board.previousOpen` |
| `board.answer` | `board` | `Enter` with `mod` | `tool` (the question's primary button) | false | `keys.action.board.answer`, its own: change 4 gives the primary one label per mode, so no button string names the action in both modes |
| `keys.open` | `board` | `?` (`char`) | `panel` | true | the vocabulary's |
| `board.sendFollowUp` | `editor` | `Enter` with `mod` | `tool` ("Send") | false | `keys.action.board.sendFollowUp` |

- N, Shift+N and the answer key share one part, since the scope where `N` acts (D2) contains the card's controls. The table check's double-binding rule and the override check's conflicts then see any overlap. The composer's send is in `editor`, the part the matcher admits inside a text field, so the override check refuses a typing key for it.
- **The board is not in `KEY_TABLES_ON_BOARD`**, which Issue #187 suggests. That list names widget types whose chunk registers a table, and `component-facts.test.ts`, the skill generator's reach text and the help references read it as such. `ALL_KEY_TABLES` is the seam for "every table the user's keys apply to". `REGISTERED_KEY_TABLES` and `keys-registered-tables.test.ts` stay tied to `WIDGET_TYPES`.
- A contract test fails when a registered widget type is named `board`, since `board.<name>` would then name two tables' actions.
- `MOD_KEYS` (`check.ts:40`) gains `Enter`. No engine binds Ctrl+Enter or Cmd+Enter in page content, except on a focused link, which it opens in a new tab. Every handler of the key therefore leaves links alone (D2), as `check.ts`'s comment will say. Every other Cmd or Ctrl letter but Z and A stays refused.

*Alternatives.* Vocabulary actions (`answer`, `question.next`) were rejected: no widget shares them, and the vocabulary is for actions widgets take alike. A view-only table was rejected: `ask-core`'s check would refuse the board's actions in the user file as unknown, and the skills could not list them.

### D2. Where the board's keys act

`shell/board-key-scope.ts` is pure over an element-like stand-in (`closest`, `getAttribute`, `tagName`). `boardKeyScopeOf(target)` returns one of three scopes:

- `none`: a text target (`isTextTarget`), an element in an open menu, list box, combo box, `select` or dialog (`[role=menu]`, `[role=listbox]`, `[role=combobox]`, `select`, `[role=dialog]`, `[role=alertdialog]`; the keys panels included), or one inside a widget item. A widget item is the nearest `[data-askboard-item]` whose id is not the enclosing card's question id, or any item frame outside a card (context and top-level items).
- `{card: questionId}`: inside `[data-askboard-question]`, where the nearest item frame is the question's own or none. Not on a link (`a[href]`, itself or an ancestor) and not inside the thread (`[data-askboard-thread]`, an attribute added to the thread's section).
- `board`: everywhere else in the view, `<body>` included.

`N`, Shift+N and `?` act in `board` and `card`. The answer key acts in `card` only.

The rule is stricter than report §5.1's "outside a widget with its own table". It follows decision 6's "outside fields and widgets". A widget without a table can act on a letter without preventing it, for example a select's typeahead in a PickField, or a grid's type-to-edit before its retrofit. Letting `N` through when nothing prevented it would then change an answer and jump at once (NFR-10).

### D3. `N`, `Shift+N` and `?`: one listener on the view's document

`shell/use-board-keys.ts` exports `useBoardKeys(handlers)`. `Board` calls it once, and it adds one `keydown` listener on `ownerDocument` in the bubbling phase. React's root, every widget handler and each `KeysFrame` run before it. The listener reads the press with `keyPressOf`, takes `keyActionOf(table, BOARD_PART, press, false)` from the board's table in effect (D6), and acts only when all of these hold: the key was not prevented, it is not a repeat (`event.repeat`), the scope is `board` or `card`, and the twin is available:

- `board.nextOpen`: `counts.onNextOpen`, the same closure as the button. With no target it does nothing.
- `board.previousOpen`: `previousOpenFrom(document, state, work, current)`, new and pure in `board-view.ts`, through `go`. It returns the open question before the question in view in board order, else the last open one (wrapping), never the question in view itself, and none when no other question is open. Unseen questions get no priority: the jump puts them first to show the agent's additions, while going back returns to a question the user skipped. It acts only while the header shows the jump. It mirrors `nextOpenFrom`'s order read backwards: change 4 keeps that function's name and signature and changes its order (to-do and draft first, postponed last). Whichever of the two changes lands second makes `previousOpenFrom` mirror it in the same commit (Merge points).
- `keys.open`: opens the board's keys panel while the header shows "Keys" (D5).
- `board.answer` is the card's (D4), so the listener never acts on it.

When the listener acts it prevents the key's default. Otherwise it leaves the key alone. The handlers live in a ref that each render updates, so the listener is added once and removed on unmount. The listener sits on the document because a click on blank space leaves focus on `<body>`, outside React's root, where no React handler hears the key. A newly opened board hears nothing until the user clicks or tabs into the frame (Context, Focus at open). Probe 0.2 checks that in the three engines.

*Alternatives.* A React `onKeyDown` on the board's root was rejected: it misses keys on `<body>`. A capturing listener was rejected: it would act before a widget could take the key.

### D4. The answer key: the card's own handler, `onAnswer`'s path

The card's `<section>` gets an `onKeyDown`. It acts when the press matches `board.answer` in the board's table in effect and `boardKeyScopeOf(event.target)` is `{card}` for this question. Bubbling order runs the options' own handlers first. The pure `shell/answer-key.ts` exports `answerKeyOf({opened, locked, canAnswer, pending, fieldToFix, empty, answerable})`, which returns one of three verdicts:

- `press`: the card calls `onAnswer(target)`, the function the primary button calls, with its reason check, revision confirmation, focus move, status message and change 4's after-answer step. `target` is the element that had focus, which a cancelled confirmation gives focus back to. It is the primary button only when the key was pressed on it, so no step after `onAnswer` may assume `control` is the primary. A step that needs the primary finds it in the card by `[data-askboard-primary]`.
- `announce`: nothing is sent or marked. The reasons, first match wins: an agent change waiting (`pending`) gives `status.answerChangePending`. A field to fix gives `status.answerBlocked` with `{reason: fieldToFix.text}`. Nothing chosen and no note on an answerable open question gives `status.answerEmpty`.
- `none`: any other disabled cause, such as loading, a command in flight, an answered card not being revised, a locked board or an opened Snapshot.

On the card's own controls the key is always taken: its default is prevented, whatever the verdict. Engines differ on whether Ctrl+Enter or Cmd+Enter activates a focused button, which would click "Postpone" or select a radio. The handler ignores `defaultPrevented`, because Radix Checkbox prevents Enter's default on a box, and it ignores repeats: a held key would otherwise toggle "ready" in submitted delivery. `checkboxKeyOf` flips on Enter only with no modifier (`pressHold(event) === "none"`), as `optionMoveOf` already does for the arrows. That is the fix that keeps `Mod+Enter` on a box from changing the answer it sends.

The primary button gets the attribute `data-askboard-primary`, the name change 4 gives it too, so this change's tests find the primary by role whichever change lands first.

*Alternatives.* Handling the key in D3's document listener was rejected: the board does not own a card's `onAnswer`, its confirmation state or its reason, and a registry of card handlers would duplicate them. A click on the primary element was rejected: it would bypass the disabled reason and depend on the button being rendered. Passing the primary as `control` was rejected: a cancelled confirmation would then leave focus on the primary, not where the user pressed the key.

### D5. Discoverable board keys

- `KeyHint` wraps the header's next-open jump (`board-header.tsx`), the question's primary button (`question-actions.tsx`) and the composer's "Send" (`thread.tsx`). Each gets its entry from the board's table in effect, which carries `source`, so `entryInEffect` passes it through. No `KeyTableContext` provider sits at board level. That context belongs to an item frame, and a board-level `KeysPanelContext` would make a tableless widget's `KeysButton` render. The primary keeps its own `aria-describedby`, the field reason: Radix's trigger takes the child's props over its own, which a unit test pins.
- The header's "Keys" button is a `button-secondary` with `keys.button`'s text. It sits after the counts and before the quick toggles, and shows on every board that is not ended (single-question boards included). Its tooltip holds `keys.open`'s keys in effect, the `KeysButton` look without its frame context.
- `shell/board-keys-panel.tsx` holds `BoardKeysPanel`, a non-modal Radix Popover anchored to the Keys button. It is built from `keys-frame-actions.ts` (`openFrom`, `controlOf`, `noteClose`, `restoreFocus`, `stopKey`) and `KeysPanelBody`. Its title is `keys.panel.boardTitle` and its closing note `keys.panel.boardNote`. `takesEdits` is false on a locked board and in an opened Snapshot, so the panel then lists only the entries that still act. `panelGroups` gains the group `board` (`keys.group.board`), first in `PANEL_GROUPS`. `groupOf` maps the family `board` to it. No widget table has that family, so the widgets' panels do not change.

### D6. The user's keys, one table in effect

`useBoardKeyTable()` (in `use-board-keys.ts`) is `useKeyTable(BOARD_KEYS)` under `BoardKeys`' overrides. The document listener, the card's handler, the composer, the hints and the panel all read it, so a remap reaches them together. A Snapshot has no board page and so takes the defaults (`BoardKeys`).

In the contract:

- `keyOverridesProblems`, `keyExitActions` and `changedKeyActions` default to `ALL_KEY_TABLES`. `ask-core` (`core/src/config/rules.ts:56`), the board page's `key-overrides.ts` and `settings-keys-data.ts` follow with no edit. A core test shows a user file with `board.nextOpen` applied, and one with `Enter` refused with `keys-not-applied`.
- `actionProblems` refuses `takenByControls` keys for every action any table has in part `board`, beside `keys.open`. The rule is "reserved".
- `openConflicts` already sets `keys.open` against every keyed binding of every table it reads, so `?` against a board key is reported once `ALL_KEY_TABLES` is the default.

The composer replaces `isSendKey` with `keyActionOf(table, "editor", keyPressOf(event), false)?.action === "board.sendFollowUp"`, and `isSendKey` and its tests go. By default this narrows the composer's send. Ctrl with Shift and Enter, and Ctrl with Cmd and Enter, no longer send, and Enter that confirms an input method's candidate never sends (`keyPressOf`'s composing rule).

### D7. The help skill within its budgets

`askboard-help` gets the board's keys from `BOARD_KEYS` and the English strings (`@askboard/view/strings`):

- `references/key-actions.md` opens with a "Board keys" section. Each row gives the action, where it acts ("outside text fields and widgets", "on a question's own controls", "in the follow-up composer") and its keys in the Linux form with the macOS form in brackets. The section also says that sending all held answers has no key. The usual list of every action an override may name follows, the board's included. `keyActionsText` and the examples' check read `[BOARD_KEY_TABLE, ...widgets]`.
- `references/configure-keys.md`'s reach text names the board's own keys and the Ranking.
- `SKILL.md`'s last line becomes "The board's own keys, and every action with its default keys: [key-actions](references/key-actions.md). Changing keys: [configure-keys](references/configure-keys.md)." That adds 8 characters, about 5,986 of 6,000. `HELP_BUDGETS` stays. Change 4 edits only the template's "The board" section, so the two edits do not overlap, but both draw on the same 22 characters: whichever lands second re-checks `check:skills` and trims its own text, and neither raises the budget without the PO. If the line does not fit, the group stops and reports to the architect.

### D8. Strings (FR-34)

Italian strings outside report §4's accepted table carry EXPERIENCE's "(to review)" mark.

| Key | en-US | it-IT |
|---|---|---|
| `keys.action.board.previousOpen` | Previous open | Precedente aperta |
| `keys.action.board.answer` | Answer the question in focus | Rispondi alla domanda attiva |
| `keys.action.board.sendFollowUp` | Send the follow-up | Invia il chiarimento |
| `keys.group.board` | Questions | Domande |
| `keys.panel.boardTitle` | Board keys | Tasti della board |
| `keys.panel.boardNote` | These keys do nothing in a text field or inside a widget, apart from sending a follow-up. Sending all held answers has no key. | Questi tasti non agiscono in un campo di testo né dentro un widget, tranne l'invio di un chiarimento. L'invio di tutte le risposte in attesa non ha tasto. |
| `status.answerBlocked` | Not answered. {reason} | Nessuna risposta. {reason} |
| `status.answerEmpty` | Not answered. Choose an answer or write a note first. | Nessuna risposta. Prima scegli una risposta o scrivi una nota. |
| `status.answerChangePending` | Not answered. Choose what to do with the agent's update first. | Nessuna risposta. Prima scegli cosa fare con l'aggiornamento dell'agente. |

`{reason}` is the visible reason's text (`question.entryHint`, `question.requiredHint` or the detached-comments hint), already in the ask's language. The new strings hold none of the glyphs `icon-set`'s `glyphs.test.ts` guards.

### D9. Records and versions

- **PRD**, NFR-12. After "...the other widgets get them with their retrofits.", add: "The board has keys of its own outside text fields and widgets, shown and changeable the same way: the next and previous open question, answering the question in focus and the follow-up's send; sending all held answers has none."
- **EXPERIENCE.md**:
  - Accessibility Floor, Keyboard core: the sentence "Key bindings outside the widgets … are not recorded (Open Items 21)" becomes the board's keys and where they act. Submit, Postpone and the outline jump have no key of their own; the outline jump is reached with Tab and Enter.
  - Accessibility Floor, Shortcuts: "the modifier is not recorded" becomes Ctrl or Cmd with Enter.
  - Board chrome: the Next-open jump row (N, Shift+N), the Context header row (the Keys button and the board's keys panel).
  - Voice and Tone: rows for D8's strings.
  - Open Items 21: closed, "decided by `board-keys`".
- **DESIGN.md**: the Context header's row 2 (the Keys button), the key hint on the next-open jump, the question's primary button and "Send" (the existing tooltip and key caps), and the board's keys panel (the widget panel's look with the note).
- **As-built.** `docs/as-built/board-keys.md`. In `docs/as-built/keyboard-shortcuts-help.md`, the sentence "`keyOverridesProblems` and `keyExitActions` (`overrides.ts`, defaulting to `REGISTERED_KEY_TABLES` in `tables.ts`)" becomes "defaulting to `ALL_KEY_TABLES`", and the new note says so.
- **Versions.** No set is widened. The configuration schema bounds `keys` by shape only (`maxProperties`, `propertyNames` 1 to 64 characters), and the override check, code in the same release, gives it its meaning. No view-protocol message, draft field or dependency changes, so no number is bound (askboard-contract-versioning, Rule 1). Task 0.1 checks that no file under `contract/src/schemas/` changes.
- **Chunks.** The shell grows about 5 to 8 KB: four modules, a panel, nine strings in two languages, and three `KeyHint`s, whose Tooltip is already in the `radix` chunk. `board-page` grows under 1 KB: the board table in the override check. The allowance is measured from the record on `main` after #212 (230,569 B). `chunk-sizes.json` is recorded once, in the last group.

## Merge points

| With | Shared paths | Rule at the rebase |
|---|---|---|
| `answering-flow-fixes` (#212, `worktree-feature-answering-flow-fixes`, base of this branch at 9eb5f364) | This change borrows `revealAndFocus` (`shell/reveal.ts`), `useQuestionInView` and `focusedQuestion` (`use-question-in-view.ts`), `StatusMessages` and `announce` (`status-messages.ts`), `StatusRegion`, `FieldToFix` and `fieldToFixOf` (`field-block.ts`), `AnswerOutcome` and `AnswerResult` (`revision-confirm.ts`), the header's single "Next open" (`HeaderCounts.onNextOpen`), `BoardContext.status` and `status.ready` | After #212 merges: `git rebase --onto origin/main 9eb5f364`, then `git grep` each name on `origin/main` (task 6.6). A name that differs stops the work for `/opsx:update` |
| `icon-set` (#210, `worktree-feature-icon-set` at 272d5e5f) | `shell/board-header.tsx` (`IconNextOpen` inside "Next open"; our `KeyHint` wraps the button, another hunk); `strings/en-US.ts`, `it-IT.ts`, `keys.ts` (both append; it drops `outline.newReplies`, and `header.nextOpen` loses its arrow, which our label reuses); `strings/glyphs.test.ts` (our strings hold no guarded glyph); `harness/suites.ts` (both add files); `chunk-sizes.json`; DESIGN.md (its Icons section; our Context header and key rows) | Keep both sides' lines. Regenerate the skills after the rebase, since `header.nextOpen`'s English text changes. Re-record `chunk-sizes.json` with `bun run build:view --record-sizes`, never by hand |
| `answering-flow-guidance` (change 4, stacked on #212; split agreed with its architect on 2026-11-15) | In both: `shell/question-card.tsx` (its "Continue" footer and `after-answer.ts` call, ours the section's `onKeyDown`); `question-actions.tsx` (its primary's label by mode and `data-askboard-primary`, ours `KeyHint` and the same attribute); `board.tsx` (its advance and completion, ours `useBoardKeys`, `previousOpen` and the panel control); `board-header.tsx` (its `header.nextOpen` value "Next to do", ours `KeyHint` and "Keys"); `board-view.ts` (its `nextOpenFrom` order, ours the new `previousOpenFrom`); `strings/*` (both append); `EXPERIENCE.md` (Accessibility Floor, the Next-open row, where ours is one appended sentence, Voice and Tone); `DESIGN.md`; `tools/build/skills/templates/help/SKILL.md` (its "The board" section, ours the last line); `skills/askboard-help/`; `harness/suites.ts`; `chunk-sizes.json`; the appended export block at the end of `contract/src/index.ts` (it widens the configuration and the board protocol for `afterAnswer`, we widen no set). It alone edits `harness/dom.ts` (`answer` and `submit` locators by `data-askboard-primary` and `data-askboard-submit`). We alone edit `thread.tsx`, `thread-text.ts`, `catalog/fields/roving.ts`, `catalog/keys/hint.ts` and `contract/src/keys/`. View spec: it MODIFIES "Keyboard core", "Counts and the next-open jump" and others; we ADD only, besides MODIFIED "Follow-up thread", so no requirement is modified by both | (a) Our jump entry's label is `header.nextOpen`, whose key change 4 keeps, so its new value flows into the tooltip, the panel and the help skill. `keys.action.board.previousOpen` becomes "Previous to do" / "Precedente da fare" in whichever change lands second. (b) The key calls `onAnswer(control)`, the function the primary calls, so change 4's after-answer step runs for it. `control` is the focused element, never assumed to be the primary (D4). (c) `previousOpenFrom` mirrors `nextOpenFrom`'s order: the second to land aligns it, and our requirement's wording, in the same commit. (d) If change 4 adds a visible reason for "nothing chosen", `answerKeyOf` announces that reason in place of `status.answerEmpty`. (e) A focus move into the view at load would break D3's "newly opened board" rule. (f) The help `SKILL.md` budget (D7). (g) Keep one `data-askboard-primary`, both export blocks, both sides' strings and suite entries; regenerate the skills and re-record the chunk sizes, never by hand |
| `early-benchmark` | none (`packages/bench`) | none |

Borrowed from `main` (task 0.1 checks each on `origin/main`): `KEY_VOCABULARY`, `keyBinding`, `ownEntry`, `vocabularyEntry`, `keyTableProblems`, `reservedProblem`, `keyOverridesProblems`, `keyExitActions`, `changedKeyActions`, `effectiveKeys`, `REGISTERED_KEY_TABLES`, `RegisteredKeyTable`, `KEYS_OPEN_RESERVED_KEYS`, `keyActionOf`, `pressHold`, `useKeyTable`, `KeyOverridesContext`, `BoardKeys`, `KeyHint`, `hintOf`, `panelGroups`, `groupOf`, `PANEL_GROUPS`, `KeysPanelBody`, `openFrom`, `controlOf`, `noteClose`, `restoreFocus`, `stopKey`, `useKeysOpenEntry`, `keyPressOf`, `isTextTarget`, `checkboxKeyOf`, `optionMoveOf`, `nextOpenFrom`, `isSendKey`, `pressAnswer`, `cardState`, `HeaderCounts`, `BoardHeader`, `ActionsRow`, `QuestionCard`, `data-askboard-question`, `data-askboard-item`, `generateHelpSkill`, `keyActionsText`, `configureKeysText`, `HELP_BUDGETS`, `STRING_KEYS`, `BROWSER_FILES`.

## Needs probe

None about Claude Code: the change makes no assumption about its run-time behaviour. Three browser behaviours the design relies on are checked in the three engines by probe 0.2, before group 3 builds on them: keys pressed before the view's frame has focus reach no listener in the view; Ctrl+Enter or Cmd+Enter on a focused button whose `keydown` was prevented clicks nothing; Radix Checkbox prevents Enter's default on a box.

## Risks / Trade-offs

- [A screen reader in browse mode takes letter keys (VoiceOver's single-key Quick Nav, Orca's browse mode)] → in focus mode the keys reach the page, "Next open" and "Answer" stay buttons, and the user file can move `N` (WCAG 2.2 SC 2.1.4). A by-hand check with VoiceOver and Orca goes to the PO as an Issue (task 6.4).
- [A layout whose N key types another letter (Cyrillic, Greek)] → keys match `KeyboardEvent.key`, as the vocabulary's Z and A do. Such a user rebinds the action in the user file, which the help skill teaches.
- [`N` does nothing inside a widget, an Approval included] → the user tabs out or uses "Next open". An Issue can later let a widget type opt in through its registry entry.
- [The composer's send narrows, D6] → only odd combinations stop sending. The spec's "Follow-up thread" names Ctrl+Enter and Cmd+Enter, which still send.
- [Interim labels until change 4] → the table names the actions with the buttons' own strings, so the panel and the tooltips read as the buttons do before and after change 4's renames.
- [Shell chunk] → about 5 to 8 KB of the roughly 23 KB allowance, which change 4 also draws on. Each change records its sizes, and the second to merge re-records after its rebase.

## Migration Plan

None. A user file that sets `board.*` today is refused as naming unknown actions. After this change it applies at the next board opened. Boards already open take the new view at their next load.

## Open Questions

- **Conflict: Issue #187 says `KEY_TABLES_ON_BOARD` gains the board's table.** Resolved in D1: that list means widget chunks, and `ALL_KEY_TABLES` is the seam for the board. The behaviour the Issue asks for is the same.
- **Conflict: report §5.1 scopes `N` "outside a widget with its own table", decision 6 "outside fields and widgets".** Resolved in D2 by decision 6, the PO's words, for the fail-closed reason given there. The PO may later widen the scope per widget type (Risks). Neither needs a PO answer before implementation.
