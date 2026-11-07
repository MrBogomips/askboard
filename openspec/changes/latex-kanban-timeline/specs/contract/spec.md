## ADDED Requirements

### Requirement: A whole field changes by one set
AD-20's generic diff SHALL take a shape that names fields of the item itself. Each named field the edited value changes SHALL give one `set` whose target is `<item>.<field>` and whose value is the whole edited field, `null` for a field that is gone, in the order the shape names them. A change to a key the shape does not name SHALL be a problem naming the item and the key. Applying the `set`s to the sent value SHALL give the edited value (AD-20, FR-18).

#### Scenario: A corrected expression
- **WHEN** the diff runs over a LaTeX item `formula` as sent, `{expression: "a^2+b^2"}`, and as edited, `{expression: "a^2+b^2=c^2"}`
- **THEN** it gives exactly one change, `{op: "set", target: "formula.expression", value: "a^2+b^2=c^2"}`, and applying it to the sent value gives the edited value

#### Scenario: An untouched field
- **WHEN** the edited value equals the sent value
- **THEN** the diff gives no change

#### Scenario: A key the shape does not name
- **WHEN** the shape names `expression` and the edited value also gains `display`
- **THEN** the diff fails, naming the item and `display`

#### Scenario: Odd field names stay keys
- **WHEN** a shape names `__proto__` and the edited value changes it
- **THEN** the diff gives one `set` of `<item>.__proto__`, and applying it sets an own key, never the prototype

### Requirement: A named field holding null reads as absent
In a fields shape, as in the list and keyed shapes, a named field holding `null` SHALL read as absent: a `set` to `null` SHALL apply as a delete, so an edited value that turns a field to `null` does not round-trip and `ask-core` refuses it (AD-10, AD-20).

#### Scenario: A field set to null
- **WHEN** a shape names `a`, the sent value is `{a: 1}` and the edited value is `{a: null}`
- **THEN** the diff gives one `set` of `<item>.a` to `null`, and applying it gives `{}`, not the edited value

### Requirement: LaTeX items
The registry SHALL hold `latex`, after the types `main` holds: an item `{type: "latex", id, props}` whose props hold `expression`, a text of 0 to 2,000 characters counted in code points, as JSON Schema's `maxLength` counts them, and nothing else. The contract SHALL NOT parse the expression; the board renders it (FR-11, AD-7).

#### Scenario: A LaTeX item in a question
- **WHEN** an ask holds a question whose `items` hold `{type: "latex", id: "formula", props: {expression: "\\frac{a}{b}"}}`
- **THEN** it passes, and the board document `ask-core` builds from it validates too

#### Scenario: An empty expression
- **WHEN** a LaTeX item's `expression` is the empty text
- **THEN** it passes

#### Scenario: An expression over the limit
- **WHEN** a LaTeX item's `expression` holds 2,001 characters
- **THEN** validation fails, naming the item and `expression`

#### Scenario: Characters outside the Basic Multilingual Plane
- **WHEN** a LaTeX item's `expression` holds 2,000 characters outside the Basic Multilingual Plane, then 2,001
- **THEN** the first passes, and the second fails naming the item and `expression`; the LaTeX's own check words the count 2,001

#### Scenario: A field the props do not define
- **WHEN** a LaTeX item's props hold `displayMode`
- **THEN** validation fails, naming the item and `displayMode`

### Requirement: LaTeX changes
A LaTeX item's element shape SHALL name `expression` alone, so its changes SHALL be one `set` of `<item>.expression` to a text of at most 2,000 characters; its changes schema SHALL admit nothing else (AD-20, FR-20).

#### Scenario: The LaTeX changes schema
- **WHEN** a list holding one `set` of `formula.expression` to a text is validated against the LaTeX changes schema, then one holding an `add`, then one holding a `set` of `formula.expression` to `null`
- **THEN** the first passes and the other two fail, naming the operation

### Requirement: Kanban items
The registry SHALL hold `kanban`: `columns`, 2 to 12 elements `{id, label}` with `label` 1 to 60 characters, and `cards`, 1 to 200 elements `{id, label, description?, column}` with `label` 1 to 200 characters, `description` 1 to 500, and `column` naming a column of the item. Column and card IDs SHALL match the ID pattern and be unique within the item (FR-11, AD-7).

#### Scenario: A Kanban in a question
- **WHEN** an ask holds a Kanban with the columns `todo`, `doing` and `done` and three cards, each naming one of them
- **THEN** it passes

#### Scenario: A card in no column
- **WHEN** a card's `column` names `blocked`, which is no column of the item
- **THEN** validation fails, naming the item, the card and `column`

#### Scenario: An ID twice
- **WHEN** a card and a column both have the ID `done`, or two cards have the ID `fix-login`
- **THEN** validation fails, naming the item and the repeated ID

#### Scenario: One column
- **WHEN** a Kanban holds a single column
- **THEN** validation fails, naming the item and `columns`

### Requirement: Kanban changes
A Kanban item's element shape SHALL be the flat list of its `cards`, and its changes schema SHALL admit only `set`s of `<item>.<card>.column` to an ID, so a moved card gives one `set` and no other edit of a card, nor a new card order, is a Kanban change (AD-20, FR-20).

#### Scenario: A moved card
- **WHEN** the diff runs over a Kanban whose card `fix-login` moved from `todo` to `doing`
- **THEN** it gives exactly one change, `{op: "set", target: "board.fix-login.column", value: "doing"}`

#### Scenario: What the Kanban changes schema refuses
- **WHEN** a list holding a `move` of a card, or a `set` of a card's `label`, is validated against the Kanban changes schema
- **THEN** it fails, naming the operation

### Requirement: Timeline items
The registry SHALL hold `timeline`: `lanes`, 1 to 20 elements `{id, label}` with `label` 1 to 60 characters, and `entries`, 1 to 200 elements `{id, label, lane}` with `label` 1 to 200 characters, `lane` naming a lane of the item, and either `date` alone (a milestone) or `start` and `end` (a range, `end` inclusive, on or after `start`). Dates SHALL be RFC 3339 full-dates that exist, from 1900-03-02 to 9999-12-31; IDs SHALL be unique within the item (FR-11, AD-7).

#### Scenario: A roadmap
- **WHEN** an ask holds a Timeline with the lanes `web` and `mobile`, a range from 2026-01-05 to 2026-02-27 in `web` and a milestone on 2026-03-02 in `mobile`
- **THEN** it passes

#### Scenario: A one-day range
- **WHEN** a range's `start` and `end` are both 2026-01-05
- **THEN** it passes

#### Scenario: An entry that is neither
- **WHEN** an entry holds `date` and `end`, or `start` without `end`, or no date at all
- **THEN** validation fails, naming the item, the entry and saying an entry holds `date` alone or `start` and `end`

#### Scenario: A range that ends before it starts
- **WHEN** a range's `end` is 2026-01-04 and its `start` 2026-01-05
- **THEN** validation fails, naming the item, the entry and `end`

#### Scenario: A day that does not exist
- **WHEN** a milestone's `date` is 2027-02-29
- **THEN** validation fails, naming the item, the entry and `date`

### Requirement: Timeline changes
A Timeline item's element shape SHALL be the flat list of its `entries`, and its changes schema SHALL admit only `set`s of `<item>.<entry>.lane` to an ID and of `<item>.<entry>.date`, `.start` or `.end` to a full-date. A milestone moved in time SHALL give one `set` of `date`, and a range two, `start` and `end` (AD-20, FR-20).

#### Scenario: A range moved to another lane
- **WHEN** the diff runs over a Timeline whose range `checkout` moved a week later and from `web` to `mobile`
- **THEN** it gives three changes, `set`s of `roadmap.checkout.end`, `roadmap.checkout.lane` and `roadmap.checkout.start`, each with its new value

#### Scenario: What the Timeline changes schema refuses
- **WHEN** a list holding a `set` of an entry's `end` to `null`, or of its `label`, is validated against the Timeline changes schema
- **THEN** it fails, naming the operation

### Requirement: Changes checked against their type
The contract SHALL check an item's changes against the changes schema of the item's type and return every problem, each naming the item and the operation; `ask-core` refuses an answer with the first. A type with no changes schema SHALL take no change; a type the registry does not hold SHALL give no problem, its value having been refused first (AD-7, AD-10, AD-20).

#### Scenario: A Kanban reorder
- **WHEN** the changes of a Kanban hold a `move` of the card `fix-login`
- **THEN** the check fails, naming the item and the operation on `fix-login`

#### Scenario: Tree and Gantt changes
- **WHEN** the changes of every approved and fixture Tree and Gantt answer are checked against their types
- **THEN** each passes

### Requirement: Teaching text of LaTeX, Kanban and Timeline
The `latex`, `kanban` and `timeline` entries SHALL each carry the teaching text the skill's references are generated from, within its bounds, and each entry's example item SHALL be accepted in an ask (FR-29, AD-6).

#### Scenario: The registry's own check
- **WHEN** the registry's own check runs over the shipped registry
- **THEN** it passes

#### Scenario: The skill names the three
- **WHEN** the skill is generated from the shipped registry
- **THEN** its item index lists LaTeX, Kanban and Timeline after the types `main` holds, in that order, each with a reference naming its changes

### Requirement: LaTeX, Kanban and Timeline in the sets' next minors
The input format, the output format, the tool envelopes and the board document SHALL each take the next minor after the one `main` holds, admitting the three types' items, props and changes; every other set SHALL keep `main`'s version (AD-7).

#### Scenario: The previous minor
- **WHEN** an ask holding a Kanban is validated by the input format's previous minor
- **THEN** it fails, naming the item and its type

#### Scenario: A fetch of a Timeline
- **WHEN** a `fetch` result holds a Timeline item with its edited props
- **THEN** it validates against the tool envelopes

#### Scenario: Sets this change leaves alone
- **WHEN** the version constants are read after this change
- **THEN** the board protocol, the Snapshot data, the view manifest, the configuration, the local API and the session file equal `main`'s

## MODIFIED Requirements

### Requirement: Element shapes and fields
An element shape SHALL be a list shape, a keyed shape or a fields shape. A list shape SHALL name the props key that holds a list of elements and, for a tree, the element key that holds its children; without a children key the elements SHALL form a flat list, and no `add` or `move` names a `parent`. Every other key of an element but `id` SHALL be a field whose values compare as JSON values, so that a changed field of any type gets one `set` with its whole new value. A fields shape SHALL name fields of the item itself (A whole field changes by one set).

#### Scenario: An array field in a flat list
- **WHEN** one element of a flat list gets a different array in a field, and another gets an array equal to the one it had
- **THEN** the diff returns one `set` holding the first element's whole new array, and no operation for the second

#### Scenario: Moving an element to the front of a flat list
- **WHEN** the last element of a flat list is moved to the front
- **THEN** the diff returns one `move` for it, with neither `parent` nor `after`, and no operation for the others
