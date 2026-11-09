## ADDED Requirements

### Requirement: A common key vocabulary
A widget with keys of its own SHALL take the same keys for the same action: the arrows, Home and End move the cursor; Space selects and Shift with ArrowUp or ArrowDown extends; Alt+Shift with an arrow moves along the widget's axis; Alt+Shift+Home or End, or Cmd or Ctrl+Shift with ArrowUp or ArrowDown, moves to the top or the bottom; Enter or F2 edits, Enter commits and Escape cancels; Delete or Backspace deletes; Cmd or Ctrl+Z undoes (NFR-12).

#### Scenario: One move key in two widgets
- **WHEN** the user presses Alt+Shift+ArrowUp on a Ranking's current row and on a Tree's focused node
- **THEN** each moves up one place and keeps the focus

#### Scenario: To the top without Home
- **WHEN** the user presses Cmd+Shift+ArrowUp on macOS, or Ctrl+Shift+ArrowUp on Linux, on a Ranking's current row
- **THEN** the row moves to the top, as Alt+Shift+Home moves it

### Requirement: The approved keys outside the core vocabulary
A widget that gives one of these actions a key SHALL give it these keys, as the PO approved them: Cmd or Ctrl+A selects all; Escape, while something is selected, selects none; Alt+Shift+Enter adds after the current row and Cmd or Ctrl+Shift+Enter adds a child; Alt+Shift+Delete or Alt+Shift+Backspace deletes where Delete clears a cell; `%`, while something is selected, adjusts by a percentage; `?` opens the keys panel. None of them SHALL act in a text field (NFR-12).

#### Scenario: Escape where it acts
- **WHEN** two rows of a Ranking are selected, the user opens its keys panel and presses Escape, then presses Escape on the list
- **THEN** the first closes the panel and keeps the selection, and the second selects none

### Requirement: Keys left to the browser
A widget with a key table SHALL take only the keys its table names, with exactly the modifiers it names, or that its design names to stop a browser action, and SHALL leave to the browser every other key, a key pressed while an input method composes, and inside a text field every key but its editor's. A key it takes SHALL trigger no browser action. A toolbar's arrows, Home and End, and those among a question's options or a PickField's, SHALL act only with no modifier held (NFR-12).

#### Scenario: Alt with an arrow on a Kanban card
- **WHEN** the focus is on a Kanban card and the user presses Alt+ArrowLeft
- **THEN** the current card does not change and the key's default action is not prevented

#### Scenario: Alt with an arrow on a toolbar
- **WHEN** the focus is on a Ranking's "Move up", or on a Document review's "Comment", and the user presses Alt+ArrowRight
- **THEN** the focus stays on that tool and the key's default action is not prevented

#### Scenario: Alt with an arrow among options
- **WHEN** the focus is on an option of a single choice, then of a multiple choice, and the user presses Alt+ArrowDown
- **THEN** the focus stays on that option, nothing is selected, and the key's default action is not prevented

#### Scenario: Alt with an arrow on a Chart
- **WHEN** a Chart has the focus and the user presses Alt+ArrowRight
- **THEN** the current point does not change

#### Scenario: Shift with Enter on the Gantt's column edge
- **WHEN** the Task column's edge has the focus and the user presses Shift+Enter, then Shift+Home
- **THEN** the column's width does not change and neither key's default action is prevented

#### Scenario: No navigation, no scroll
- **WHEN** the user presses every key of a Ranking's key table on its list, in Chromium, Firefox and WebKit
- **THEN** the page has neither navigated nor scrolled

### Requirement: Keys taken only to stop a browser action
A widget MAY take, beside its table's keys, a key its change's design names as taken only to stop a browser action; such a key SHALL do nothing, SHALL have its default prevented, and is no action of the widget's key table (NFR-12).

#### Scenario: Delete in the Gantt's predecessors panel
- **WHEN** the Gantt's predecessors panel has the focus and the user presses Delete, then Backspace
- **THEN** nothing in the panel or the plan changes, neither key's default action is performed, and the Gantt's key table binds neither key in the predecessors panel

### Requirement: Key tables match the handlers
The keys a widget's handler takes SHALL be those of its key table: for each part of the widget, a key the table binds SHALL do its action and a key it does not bind SHALL do nothing, so that the tooltips, the keys panel and the skills describe what the board does (NFR-12).

#### Scenario: Today's keys of the Kanban
- **WHEN** each key of the Kanban's key table, and each arrow with Alt, Ctrl, Cmd or Shift held, is given to the Kanban's key handler
- **THEN** the table's keys move the current card as their entries say and the others do nothing

### Requirement: Keyboard shortcuts are discoverable
In a widget with a key table, each control whose action has keys SHALL show on hover and on keyboard focus a tooltip with the action's name and its keys, and SHALL carry them in `aria-keyshortcuts`; the widget SHALL show a Keys button. The keys the tooltips show, `aria-keyshortcuts` announces and the keys panel lists SHALL be those in effect for the widget, which its key handler takes (NFR-12).

#### Scenario: A tooltip on focus
- **WHEN** the user tabs to a Ranking's toolbar and moves to "Move up" with the arrow keys
- **THEN** a tooltip shows "Move up" with its keys, and the button's `aria-keyshortcuts` is `Alt+Shift+ArrowUp`

#### Scenario: A tooltip on hover
- **WHEN** the pointer rests on a Ranking's "To top"
- **THEN** a tooltip shows "To top" with Alt+Shift+Home and Cmd or Ctrl+Shift+ArrowUp as the platform writes them

#### Scenario: Every visible action in the table
- **WHEN** a Ranking's toolbar and key table are compared
- **THEN** each tool has an entry, and each entry other than a cursor move or the panel's has a tool, a check box or a click that does the same

### Requirement: The keys panel
The Keys button, and `?`, or the keys the user's file gives that action instead, pressed while the focus is in the widget but not in a text field or an editor, SHALL open a panel listing the widget's keys in effect by group, each with its action's name, from board strings only. A read-only widget's panel SHALL list only the keys that still act. Escape SHALL close it and return the focus where it was. In a text field `?` SHALL type a question mark (NFR-12, AD-8).

#### Scenario: Opening with the question mark
- **WHEN** the focus is on a Ranking's row and the user presses `?`, then Escape
- **THEN** the panel opens listing the Ranking's keys by group, and closes with the focus back on that row

#### Scenario: Opening with the Keys button
- **WHEN** the user clicks the Keys button of a Ranking
- **THEN** the panel opens, titled with the widget's name, and holds no text the agent sent

#### Scenario: A question mark typed in a field
- **WHEN** the focus is in a text field inside a widget that has a keys panel and the user types `?`
- **THEN** the field holds `?` and no panel opens

#### Scenario: A read-only Ranking
- **WHEN** the question holding a Ranking is locked and the user opens its panel
- **THEN** the panel lists the cursor keys and no move

### Requirement: Key labels by platform
Tooltips and the keys panel SHALL write keys as the platform names them, in the board's language: on macOS with ⌃, ⌥, ⇧, ⌘, ↩, ⌫ and ⌦, elsewhere with Ctrl, Alt, Shift and the key's name, and arrows as ↑, ↓, ← and → everywhere. `aria-keyshortcuts` SHALL use the WAI-ARIA names on every platform, naming both Control and Meta for Cmd or Ctrl (NFR-12, FR-34).

#### Scenario: macOS and Linux
- **WHEN** the tooltip of a Ranking's "Move up" shows on macOS, then on Linux
- **THEN** it reads ⌥⇧↑ on macOS and Alt+Shift+↑ on Linux, and `aria-keyshortcuts` is `Alt+Shift+ArrowUp` on both

#### Scenario: Cmd or Ctrl
- **WHEN** the panel lists "To top" on Linux
- **THEN** it reads Alt+Shift+Home and Ctrl+Shift+↑, and the tool's `aria-keyshortcuts` names `Control+Shift+ArrowUp` and `Meta+Shift+ArrowUp`

### Requirement: Ranking row selection
The user SHALL select a Ranking's rows with a check box in a leading column, out of the Tab order, that a click toggles and Shift+click extends from the last row clicked; with Space on the current row and Shift with ArrowUp or ArrowDown from it; and clear them with "Select none" or Escape on the list. The toolbar SHALL read how many rows are selected. The selection SHALL be view state, in no draft and no answer (FR-11, AD-9, AD-10).

#### Scenario: A range by keyboard
- **WHEN** the user makes the second row current, presses Space, then Shift+ArrowDown twice
- **THEN** the second to fourth rows are selected, the fourth is current, and the toolbar reads "3 selected"

#### Scenario: A range by mouse
- **WHEN** the user clicks the first row's check box, then Shift+clicks the third's
- **THEN** the first three rows are selected

#### Scenario: Select none with Escape
- **WHEN** two rows are selected, the focus is on the list and the user presses Escape, then Escape again
- **THEN** after the first no row is selected, the toolbar no longer reads a count and the current row stays current; the second's default action is not prevented

#### Scenario: Not in the answer
- **WHEN** the user selects two rows, answers, and reloads the board
- **THEN** the answer's order is the one shown, nothing in it names the selection, and no row is selected after the reload

### Requirement: Moving a Ranking's selection
"Move up", "Move down", "To top" and "To bottom", by tool or key, SHALL move the selected rows, else the current row. Up SHALL take each selected row one place past its nearest unselected row above, keeping their order and leaving rows packed at the top; "To top" SHALL gather them at the top in their order; down and "To bottom" alike. A tool that would move nothing SHALL be disabled, and the current row SHALL stay current (FR-11).

#### Scenario: Rows apart moving up
- **WHEN** the order is `a`, `b`, `c`, `d`, `e`, the user selects `b` and `d` and presses "Move up"
- **THEN** the order is `b`, `a`, `d`, `c`, `e` and both stay selected

#### Scenario: A row already at the top
- **WHEN** the order is `a`, `b`, `c`, `d`, the user selects `a` and `c` and presses Alt+Shift+ArrowUp
- **THEN** the order is `a`, `c`, `b`, `d`

#### Scenario: To the top
- **WHEN** the order is `a`, `b`, `c`, `d`, `e`, the user selects `b` and `d` and presses "To top"
- **THEN** the order is `b`, `d`, `a`, `c`, `e`, and "Move up" and "To top" are disabled

#### Scenario: No selection
- **WHEN** no row is selected, the third row is current, and the user presses Alt+Shift+End
- **THEN** that row is last and still current

### Requirement: The user's keys on the board
A widget with a Keys button SHALL take the keys in effect: its key table with the user's key overrides applied, or its default keys when the user file sets none or they were not applied. A key the overrides took away SHALL be left to the browser. A Snapshot SHALL use the default keys, and nothing on the board SHALL change the user's keys (NFR-12, AD-14).

#### Scenario: The user's keys on a Ranking
- **WHEN** the user file gives to the top `Mod+Alt+ArrowUp` and select none no key, and on Linux the user makes the third row current, presses Alt+Shift+Home, then Ctrl+Alt+ArrowUp, then selects two rows and presses Escape
- **THEN** Alt+Shift+Home moves nothing and its default is not prevented, Ctrl+Alt+ArrowUp moves the row to the top, Escape leaves both rows selected, and "To top"'s tooltip shows Ctrl+Alt+↑ and its `aria-keyshortcuts` is `Control+Alt+ArrowUp Meta+Alt+ArrowUp`

#### Scenario: Keys not applied
- **WHEN** the user file gives to the top `Alt+Shift+ArrowUp`
- **THEN** the Ranking takes its default keys, and the settings panel's Keys row shows a problem naming to the top, the combination and move up

### Requirement: The keys panel shows the user's changes
The keys panel SHALL mark each action whose keys the user's file changed, and list an action whose keys it removed as having no key (NFR-12).

#### Scenario: Changed and removed keys
- **WHEN** the user file gives to the top `Mod+Alt+ArrowUp` and select none no key, and the user opens a Ranking's keys panel
- **THEN** "To top" is marked as changed with its new keys, and "Select none" is listed with no key

#### Scenario: The keys panel's own key
- **WHEN** the user file gives the keys panel `Mod+Alt+Enter`, and the focus is on a Ranking's row
- **THEN** Ctrl+Alt+Enter on Linux, or Cmd+Option+Enter on macOS, opens the panel, and `?` opens nothing

## MODIFIED Requirements

### Requirement: Ranking at the keyboard
A Ranking's list SHALL be one Tab stop whose ArrowUp, ArrowDown, Home and End move the current row, whose vocabulary move keys move rows, and whose Enter keeps the order; its toolbar, "Move up", "Move down", "To top", "To bottom", "Keep this order", "Select none" and the Keys button, another, with a "More" menu when crowded. A move SHALL keep the current row current, and a tool that cannot act SHALL be disabled without losing focus. The toolbar SHALL count the moved rows (FR-11, NFR-12).

#### Scenario: Moving a row down twice
- **WHEN** the user makes the first row current and presses "Move down" twice from the keyboard
- **THEN** that item is third, it is still the current row, and the counter reads "Your changes: 3 moved"

#### Scenario: The last row
- **WHEN** the current row is the last one
- **THEN** "Move down" is disabled and keeps the focus if it had it

#### Scenario: Moving with keys only
- **WHEN** the user makes the third row current and presses Alt+Shift+ArrowUp, then Alt+Shift+End
- **THEN** the row is second, then last, it is still current, and the page has not navigated

#### Scenario: Keeping the order from the list
- **WHEN** the user tabs to an untouched Ranking's list and presses Enter
- **THEN** the draft holds the agent's order for the item and "Answer" is enabled, as after "Keep this order"

#### Scenario: A crowded toolbar
- **WHEN** the Ranking's frame is too narrow for all its tools
- **THEN** "To top", "To bottom" and "Select none" are in a "More" menu, and the Keys button stays the toolbar's last stop

### Requirement: The settings panel
Every board SHALL open a settings panel from "Settings" in the context header: a non-modal side sheet on the board page, closed with Esc or its close control, holding the presentation keys as controls and, after them, the user's key overrides read-only with their file, key and problems and a note that they apply to the next board opened, the ask's language read-only, and each behaviour key read-only with its value, file and key (FR-35, AD-14; EXPERIENCE, Preferences and Settings; DESIGN, Settings panel).

#### Scenario: The panel's three groups
- **WHEN** the user presses "Settings"
- **THEN** the panel shows Theme, Density and Context placement as segmented controls and Keys read-only, then the Language indicator, then default language, asking rules, Snapshot folder and editor under "Applies from the next session"

#### Scenario: The board stays usable
- **WHEN** the panel is open and the user answers a question
- **THEN** the answer is sent, and the panel stays open

#### Scenario: From the keyboard
- **WHEN** the user opens the panel with the keyboard, moves through a segmented control with the arrow keys and presses Esc
- **THEN** the setting changes, the panel closes, and focus returns to "Settings"

#### Scenario: The user's keys
- **WHEN** the user file changes the keys of two actions
- **THEN** the Keys row reads that two actions are changed, names the user file and the key `keys`, and offers no control to change them

#### Scenario: Keys in the project file
- **WHEN** the project file sets `keys`
- **THEN** the Keys row shows a warning that the project's keys are ignored, and the keys in effect come from the user file or are the defaults
