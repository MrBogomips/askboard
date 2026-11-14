## ADDED Requirements

### Requirement: Grouped lists in the generic diff
The generic diff SHALL take a flat list whose elements name their group in a field, order counting per group. Group by group, in code-unit order of group values, each element in edited order gives an `add`, or its `set`s then a `move` when outside its group's longest run in sent order, a tie going to the run keeping most elements of unchanged group; then the `remove`s. An `add` or `move` SHALL name as `after` its group's preceding element, omitted for the first, no `parent` (AD-20, FR-20).

#### Scenario: A card reordered in its column
- **WHEN** the diff runs over a grouped list whose group `todo` held `a`, `b`, `c` and now holds `c`, `a`, `b`
- **THEN** it gives one change, a `move` of `c` with no `after`, and applying it to the sent list gives `todo` as `c`, `a`, `b`

#### Scenario: A group the user kept
- **WHEN** the elements of `doing` keep their order and group while another group is reordered, the elements interleaved with `doing`'s in the list
- **THEN** no change names an element of `doing`

#### Scenario: A card moved to another group at its sent place
- **WHEN** `b` moves from `todo` to `doing` and stands among `doing`'s elements where its sent index puts it
- **THEN** the diff gives one `set` of `b`'s group field and no `move`

#### Scenario: A card moved to another group elsewhere
- **WHEN** `b` moves from `todo` to the top of `doing`, above an element that precedes it in the sent list
- **THEN** the diff gives a `set` of `b`'s group field, then a `move` of `b` with no `after`, and applying them gives `doing` with `b` first

#### Scenario: A card moved into another column is the one moved
- **WHEN** the sent list is `a` in `todo`, then `b` and `c` in `done`, and `a` moves into `done` between `b` and `c`, so that keeping `b` and `c` in place and keeping `a` and `c` are runs of equal length
- **THEN** the diff gives a `set` of `a`'s group field to `done`, then a `move` of `a` after `b`, no change names `b` or `c`, and the diff of the list they rebuild against the sent list gives those changes again

#### Scenario: Groups in the order of their values
- **WHEN** the user adds `n` to `todo` and `m` to `doing`, whatever the interleaving of the two groups in the flat edited list
- **THEN** the diff gives the `add` of `m` before the `add` of `n`, since `doing` precedes `todo` in code-unit order

#### Scenario: Two interleaved groups reversed
- **WHEN** the sent list is `a1`, `a2` in group `a` and `b1`, `b2` in group `b`, and the edited list reverses both groups, as `b2`, `b1`, `a2`, `a1` or as `a2`, `b2`, `a1`, `b1`
- **THEN** both edited lists give the same changes, a `move` of `a2` then a `move` of `b2`, and the diff of the list they rebuild against the sent list gives those changes again

### Requirement: The inverse of a grouped list
Applied in order to the sent list, a `move` or an `add` going right after `after`, or first in the list without it, a grouped list's changes SHALL rebuild every group's edited order. An `after` that is not in the placed element's group at that point, or a group field that is not a string on an element a `move` or an `add` places, SHALL make the inverse fail, naming the operation; a grouped shape that also names children SHALL make the diff and the inverse fail (AD-20, NFR-10).

#### Scenario: An after in another group
- **WHEN** changes holding a `move` of `a` with `after` naming an element of another group are applied to a grouped list
- **THEN** the inverse fails, naming the operation

#### Scenario: A grouped tree
- **WHEN** the diff runs with a shape naming both a group and children
- **THEN** it fails, saying a grouped list is flat

#### Scenario: Any edit round-trips
- **WHEN** a grouped list of 200 elements in 12 groups is edited by random moves within and between groups
- **THEN** applying its changes to the sent list gives each group in its edited order, and the diff of that result against the sent list gives the same changes

### Requirement: The Kanban's teaching text of its order
The `kanban` entry's teaching text SHALL say that the order of `cards` is each column's order, top to bottom, that the changes are `set`s of a card's column and `move`s of a card applied in order to the `cards` list, a `move` going right after `after` (a card of the same column) or first in the list without it, and that a column the user did not reorder gets no `move`; each note SHALL stay within the registry's bound, and the generated skill within its budgets (FR-29, AD-6).

#### Scenario: The skill teaches the order
- **WHEN** the skill is generated from the shipped registry
- **THEN** the Kanban's reference names `move` and `after` and says how to apply them, and the skill's budget check passes

### Requirement: Kanban order in the output format's next minor
The output format SHALL take the next minor after the one `main` holds, admitting the Kanban's `move`; every other set SHALL keep `main`'s version, and a receiver at the new minor SHALL accept the previous minor (AD-7).

#### Scenario: Sets this change leaves alone
- **WHEN** the version constants are read after this change
- **THEN** the output format is one minor past `main`'s, and the input format, the tool envelopes, the board document, the board protocol, the Snapshot data, the view manifest, the configuration, the local API and the session file equal `main`'s

#### Scenario: The previous minor
- **WHEN** a receiver at the new minor checks a message naming the output format's previous minor
- **THEN** it accepts it, and refuses major 2

## MODIFIED Requirements

### Requirement: Kanban changes
A Kanban item's element shape SHALL be the flat list of its `cards` grouped by their `column`, and its changes schema SHALL admit only `set`s of `<item>.<card>.column` to an ID and `move`s of `<item>.<card>` with an optional `after` naming a card, never a `parent`: a card moved to another column gives a `set`, followed by a `move` when it does not stand where the sent order puts it, a card reordered within its column gives a `move`, and no other edit of a card is a Kanban change (AD-20, FR-20).

#### Scenario: A moved card
- **WHEN** the diff runs over a Kanban whose card `fix-login` moved from `todo` to `doing`, the cards keeping their order in the list
- **THEN** it gives exactly one change, `{op: "set", target: "board.fix-login.column", value: "doing"}`

#### Scenario: A card placed first in its column
- **WHEN** the diff runs over a Kanban whose column `todo` held `fix-login` then `add-sso`, and now holds `add-sso` first
- **THEN** it gives exactly one change, `{op: "move", target: "board.add-sso"}`

#### Scenario: A card placed after another
- **WHEN** the card `audit` moves from `todo` into `doing`, right after `write-docs` and above a card of `doing` that precedes `audit` in the sent list
- **THEN** the changes are `{op: "set", target: "board.audit.column", value: "doing"}` then `{op: "move", target: "board.audit", after: "write-docs"}`

#### Scenario: What the Kanban changes schema refuses
- **WHEN** a list holding a `move` of a card with a `parent`, an `add` or `remove` of a card, a `set` of a card's `label`, or a `move` whose target names a field, is validated against the Kanban changes schema
- **THEN** it fails, naming the operation

### Requirement: Changes checked against their type
The contract SHALL check an item's changes against the changes schema of the item's type and return every problem, each naming the item and the operation; `ask-core` refuses an answer with the first. A type with no changes schema SHALL take no change; a type the registry does not hold SHALL give no problem, its value having been refused first (AD-7, AD-10, AD-20).

#### Scenario: A Kanban reorder
- **WHEN** the changes of a Kanban hold a `move` of the card `fix-login` after `add-sso`
- **THEN** the check passes

#### Scenario: A Kanban move with a parent
- **WHEN** the changes of a Kanban hold a `move` of the card `fix-login` naming a `parent`
- **THEN** the check fails, naming the item and the operation on `fix-login`

#### Scenario: Tree and Gantt changes
- **WHEN** the changes of every approved and fixture Tree and Gantt answer are checked against their types
- **THEN** each passes
