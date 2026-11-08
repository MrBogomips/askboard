## ADDED Requirements

### Requirement: Layout types in the registry
The registry SHALL hold the layouts `stack`, `row`, `group` and `tabs`, appended after the atoms, each with its props, checks, wording, example and teaching text, and with neither edits nor a result. A question's `items` and a layout's items SHALL take each (FR-13, AD-7, AD-9).

#### Scenario: A question arranged with layouts
- **WHEN** an ask holds a question whose items are a Tabs whose first tab holds a Group of a Row of a TextField and a NumberField, and whose second tab holds a Stack of a Toggle and a Divider
- **THEN** it passes, and each layout's example item passes alone

#### Scenario: A value or a result for a layout
- **WHEN** an answer carries a value or a result keyed by a Group's ID
- **THEN** it is refused, naming the item and saying the type gives neither

### Requirement: Stack, Row and Group props
A `stack` SHALL hold `items`, at least one. A `row` SHALL hold 2 to 4 `items` and optional `widths`, a whole number from 1 to 4 keyed by the ID of one of its items. A `group` SHALL hold a `title` of 1 to 200 code points, an optional `description` of 1 to 1,000 and `items`, at least one (FR-13, AD-7).

#### Scenario: A Row's widths
- **WHEN** a Row of `amount` and `days` holds `widths` `{"amount": 2}`, then `{"amount": 5}`, then `{"fee": 1}`, then `{"__proto__": 1}`
- **THEN** the first passes, and the others fail, naming the Row and the width

#### Scenario: Bounds
- **WHEN** a Row holds one item or five, a Stack holds none, or a Group's title is empty or 201 code points
- **THEN** each fails, naming the item and the field

### Requirement: Tabs props
A `tabs` item SHALL hold `tabs`, 2 to 8, each `{id, title, items}`: an `id` of the ID shape, unique in the Tabs and not starting with `u-`, a `title` of 1 to 80 code points, and `items`, at least one (FR-13, AD-7).

#### Scenario: Tab IDs
- **WHEN** a Tabs holds two tabs with the ID `costs`, or a tab with the ID `u-1`
- **THEN** it fails, naming the Tabs and the tab

#### Scenario: Tab count
- **WHEN** a Tabs holds one tab, then nine
- **THEN** each fails, naming the Tabs and `tabs`

### Requirement: What a layout holds
A layout's items SHALL be registered types only: atoms, widgets and layouts. An excerpt, reference, image, molecule reference, question or area inside a layout SHALL fail at its type, naming the item and saying that it belongs in the question's own `items` (FR-13, AD-7).

#### Scenario: An excerpt in a Group
- **WHEN** a Group's items hold an excerpt
- **THEN** validation fails, naming the excerpt's ID and the types a layout holds

### Requirement: Layout nesting depth
A question's layouts SHALL nest at most four deep. A deeper layout SHALL be refused before the schema runs, naming the first layout past the bound, and a request nested arbitrarily deep SHALL get that problem, never an exception (FR-13, AD-10).

#### Scenario: Four, then five
- **WHEN** Groups nest four deep around a TextField, then five deep
- **THEN** the first passes, and the second fails, naming the fifth Group

#### Scenario: A hostile depth
- **WHEN** a request nests 100,000 Groups
- **THEN** it is refused with the depth problem, and nothing throws

### Requirement: Item IDs at every level
Item IDs SHALL be unique in the ask at every level: its areas, its questions, their items and the items of their layouts at any depth. The `u-` prefix SHALL be refused at every level (FR-5, AD-7).

#### Scenario: A nested repeat
- **WHEN** a NumberField inside a tab's Group has the ID of another question of the ask
- **THEN** validation fails at the NumberField's path, naming the ID as used twice

### Requirement: Problems inside layouts name the inner item
A problem in an item inside a layout SHALL name that item's ID, read its field from that item's type's wording and point at its path (AD-6).

#### Scenario: A NumberField two layouts deep
- **WHEN** a NumberField in the second tab of a Tabs, inside a Group, holds `max` below `min`
- **THEN** the problem names the NumberField's ID and `max`, in a NumberField's wording, at its path under `props/tabs/1/items`

### Requirement: Layouts in the board document and fetch
The board document's question items and `fetch`'s items SHALL admit the four layouts with their props, each layout's items as the input format writes them (AD-7, FR-20).

#### Scenario: The arranged question on the wire
- **WHEN** the board document of the question arranged with layouts, and a `fetch` result holding its Group, are validated
- **THEN** both pass, and one holding an excerpt inside a Row fails at its type

### Requirement: Draft keys at every level
A draft record's value, result and entry keys SHALL name items of their question at any depth of its layouts; a key naming a layout SHALL be refused like an unknown item's (AD-20, NFR-10).

#### Scenario: Keys inside and of a layout
- **WHEN** a draft record holds a value for a NumberField inside a Group, then a value keyed by the Group
- **THEN** the first is accepted, and the second is refused, naming the key

### Requirement: A molecule's item is no layout
A molecule definition whose item is a layout SHALL be refused when it is read, naming the molecule and saying that a molecule composes one widget (AD-9).

#### Scenario: A Group as a molecule
- **WHEN** a molecule definition's one item is a `group`
- **THEN** it is refused, naming the molecule

### Requirement: Teaching text of the layouts
Each layout's entry SHALL carry its teaching text within the registry's bounds, and the generated skill SHALL list the four and say that a question's items may sit in layouts, within its budgets (askboard-skills, SM-1).

#### Scenario: The regenerated skill
- **WHEN** `bun run build:skills` runs after the four register
- **THEN** `check:skills` passes, every budget included, and each example item passes `AskCore.ask`
